/**
 * Window-aware spectral analysis for a real-valued signal.
 *
 * This module re-exports the value object {@link SignalCollectable}, a buffered,
 * ordered sequence of numbers that also knows its sampling plan and its analysis
 * window, so that every spectral quantity can be reported with the normalisation
 * its definition requires instead of the one a raw transform happens to produce.
 * The class itself is defined in `#semantic/synchronous/collectable`, beside the
 * ordered base class it extends, so its heritage is evaluated by the module that
 * defines the base. This module keeps the numeric helpers its methods delegate
 * to and re-exports the class so that its import path is unchanged.
 *
 * Module layout. The numeric work lives in the exported `signal*` helpers, which
 * are pure functions over a value sequence plus a configuration. Each analysis
 * method of {@link SignalCollectable} delegates to exactly one factory from
 * `#semantic/synchronous/collectors` — `useSynchronous<Method>` for the method
 * `<Method>` — and the factory is the only place that owns the accumulation. That
 * split is deliberate: the class is a thin, documented facade, the helper holds
 * the formula, and the factory is the strategy the collectable applies. No two
 * methods share a factory and no method inlines one. The constructor-time
 * metadata accessors are the sole exception: `getSample`, `getValues`,
 * `getWindow`, `getCoherentGain`, `getNoiseBandwidth`, `getRate`, `getNyquist`,
 * `getResolution`, `size`, `at`, `toFrame`, `equals` and `toString` only read the
 * frozen state of the instance in constant time, so there is no accumulation for
 * a strategy to own.
 *
 * The 16 traps of `docs/research/signal-analysis.md` and where each is handled:
 *
 * 1. DC and Nyquist are never doubled. See {@link signalOneSided},
 *    {@link signalAmplitude} and {@link signalPowerSpectralDensity}; the edge
 *    test is `index === 0 || (even && index === last)` in all three.
 * 2. `10 * log10` is only used for power and `20 * log10` only for amplitude.
 *    {@link SignalCollectable.decibel} is the amplitude convention,
 *    {@link SignalCollectable.powerDecibel} the power one, and
 *    {@link SpectralDensity.decibelAt} the power one.
 * 3. Coherent-gain correction is mandatory for amplitudes. {@link signalAmplitude}
 *    divides by `count * coherentGain(window, count)`.
 * 4. No hard-coded gain. The gain is recomputed from the actual window vector at
 *    the actual length, so a symmetric Hann reads `0.4375` at eight samples
 *    rather than `0.5`.
 * 5. Noise is normalised by `sum(w^2)`, not by `count` and not by
 *    `count * gain * gain`; only that divisor makes a white-noise density
 *    unbiased. See {@link signalPowerSpectralDensity}.
 * 6. Negative window lobes are preserved. The module uses the library windows as
 *    supplied and never clips a weight to zero, so the flat-top main lobe stays
 *    flat and its scalloping loss stays near zero.
 * 7. Time-frequency analysis uses the periodic (DFT-even) windows. The default
 *    taper of this module is the periodic Hann window, which satisfies the
 *    constant-overlap-add condition at fifty percent overlap;
 *    {@link signalColaResidual} measures the residual so the claim can be
 *    asserted rather than assumed.
 * 8. Zero padding interpolates, it never resolves. `spectrum(size)` accepts a
 *    transform length above the signal length and documents that only the peak
 *    *location* becomes finer; the resolving power stays governed by the window.
 * 9. One-sided folding is never applied to a complex sequence. Every helper here
 *    consumes a real sequence, and {@link SignalCollectable.oneSided} documents
 *    that the fold is valid only because the input is real.
 * 10. The Hilbert transform is circular. {@link SignalCollectable.analyticSignal}
 *     documents the edge contamination and the recommended remedy.
 * 11. A vanishing envelope does not define a phase.
 *     {@link SignalCollectable.instantaneousFrequency} gates on the envelope and
 *     reports zero where the phase is meaningless.
 * 12. Correlation is reported normalised. {@link SignalCollectable.autocorrelation}
 *     defaults to the coefficient convention, so `rho[0]` is exactly one and the
 *     profile is comparable across signal lengths.
 * 13. Coherence is not offered here: a single segment makes it identically one,
 *     so a correct implementation would have to force a segment count of at least
 *     two and report that count. The method is therefore deliberately absent
 *     rather than silently wrong.
 * 14. Band energy is only integrated over the one-sided axis. The density of this
 *     module is already folded, with DC and Nyquist un-doubled.
 * 15. Flatness uses the *power* spectrum over the one-sided half.
 *     {@link signalSpectralFlatness} never traverses the conjugate half.
 * 16. Frames cover every sample. {@link signalShortTimeFourierTransform} extends
 *     the signal by half a frame at each end and pads the tail, so no sample is
 *     silently dropped.
 *
 * The published relations this module relies on are Parseval's theorem in its
 * density form (`sum(Pxx[k]) * resolution` equals the mean square) and the
 * identity `power = amplitude^2 / 2` for every interior bin, which is why
 * {@link SignalCollectable.power} sums to the equivalent noise bandwidth times
 * the mean square rather than to the mean square itself.
 *
 * Dependency note: the value object itself lives in
 * `#semantic/synchronous/collectable` and is re-exported here; the collector
 * factories in `#semantic/synchronous/collectors` import the helpers of this
 * module. Those cross-module values are only dereferenced inside function
 * bodies, never during module evaluation, so the remaining cycle is inert for
 * every entry order.
 *
 * @module
 */

import {
    coherentGain,
    isSpectralWindow,
    useHannPeriodicWindow,
    windowed
} from "#semantic/mathematics/window";
import { amplitudeDecibel, powerDecibel } from "#semantic/mathematics/bin";
import { analyticSignal, instantaneousAmplitude, instantaneousPhase, unwrapPhase } from "#semantic/mathematics/analytic";
import { asComplex } from "#semantic/mathematics/transform";
import { fastFourierTransform } from "#semantic/mathematics/spectral";
import { Frame } from "#semantic/mathematics/frame";
import { Frequency } from "#semantic/mathematics/frequency";
import { Sample } from "#semantic/mathematics/sample";
import { Spectrogram } from "#semantic/mathematics/spectrogram";
import { Spectrum } from "#semantic/mathematics/spectrum";
import { isBigInt, isIterable, isNumber } from "#semantic/guard";
import { Optional } from "#semantic/optional";
import type { Angle } from "#semantic/mathematics/angle";
import type { Bin } from "#semantic/mathematics/bin";
import type { Complex } from "#semantic/mathematics/complex";
import type { SpectralWindow } from "#semantic/mathematics/window";
import type { BiConsumer, BiPredicate, Consumer, Predicate } from "#semantic/utility";

/**
 * Removes a trend before a transform: nothing, the mean only, or a least-squares
 * line.
 *
 * A constant offset leaks into the low bins of a windowed transform and a drift
 * smears the whole low band, so both are usually removed before estimating a
 * density. `"none"` keeps the samples untouched and is the right choice when the
 * constant component is itself the measurement.
 */
export type DetrendMode = "none" | "constant" | "linear";

/**
 * Correlation normalisation: raw lag sums, the Pearson coefficient, or unbiased
 * sums.
 *
 * `"none"` reports `r[k] = sum(x[n] * x[n + k])` and therefore grows with the
 * signal length, which makes two lengths incomparable. `"coefficient"` reports
 * `rho[k] = r[k] / r[0]`, so `rho[0]` is exactly one and every value lies in
 * `[-1, 1]`. `"unbiased"` reports `r[k] / (count - k)`, which removes the
 * triangular taper of the raw sum but has a variance that grows with the lag.
 */
export type CorrelationNormalization = "none" | "coefficient" | "unbiased";

/**
 * The supported trend modes, in the order they are documented.
 */
const DetrendModes: ReadonlyArray<DetrendMode> = ["none", "constant", "linear"];

/**
 * The supported correlation normalisations, in the order they are documented.
 */
const CorrelationNormalizations: ReadonlyArray<CorrelationNormalization> = ["none", "coefficient", "unbiased"];

/**
 * The default segment length of a Welch estimate, as recommended by the survey.
 *
 * A short segment trades frequency resolution for variance reduction, and 256
 * samples is the value the reference implementations pick when the window is
 * given by name. It is clamped to the signal length by the callers.
 */
export const DefaultFrameSize: number = 256;

/**
 * The default envelope gate used by the instantaneous-frequency helper.
 *
 * Below this fraction of the peak envelope the phase is dominated by rounding
 * noise, so the reported frequency is meaningless and is replaced by zero.
 */
export const DefaultEnvelopeGate: number = 1E-3;

/**
 * The default cumulative fraction used by the spectral rolloff.
 *
 * The value matches `Spectrum.rolloff` so that the two agree on a spectrum they
 * both accept; it is an application choice rather than a theorem.
 */
export const DefaultRolloffRatio: number = 0.85;

/**
 * The absolute tolerance used when two values are compared for equality.
 */
export const Tolerance: number = 1E-9;

/**
 * Copies a value sequence after checking that every sample is a finite number.
 *
 * The argument is read exactly once, in iteration order, and the accepted
 * samples are placed in a new mutable array, so the caller's source can be
 * reused afterwards. An empty source is rejected because every quantity in this
 * module needs at least one sample to be defined.
 *
 * @param values - the candidate samples, consumed once in iteration order.
 * @param name - the role used in the error message, such as `Signal values`.
 * @returns a new array of the accepted samples, in iteration order.
 * @throws {TypeError} if the input is not iterable, or a sample is not a finite
 *         number.
 * @throws {RangeError} if the input yields no samples.
 */
const collectSamples: (values: Iterable<number>, name: string) => Array<number> =
    (values: Iterable<number>, name: string): Array<number> => {
        if (!isIterable(values)) {
            throw new TypeError(`${name} must be an iterable of numbers.`);
        }
        const collected: Array<number> = [];
        for (const value of values) {
            if (!isNumber(value)) {
                throw new TypeError(`${name} must contain finite numbers.`);
            }
            collected.push(value);
        }
        if (collected.length < 1) {
            throw new RangeError(`${name} must contain at least one sample.`);
        }
        return collected;
    }

/**
 * Converts a positive `bigint` count into a safe `number` index.
 *
 * The collectable layer speaks `bigint` while the mathematics layer speaks
 * `number`, so every boundary converts explicitly instead of relying on an
 * implicit coercion. The conversion rejects zero, negative values and anything a
 * double cannot represent exactly, because such a length would wrap once it
 * reaches an array index.
 *
 * @param value - the candidate count.
 * @param name - the role used in the error message, such as `Frame size`.
 * @returns the same count as a positive safe integer.
 * @throws {TypeError} if the value is not a `bigint`, or does not fit a safe
 *         integer.
 * @throws {RangeError} if the value is not positive.
 */
export const requireCount: (value: bigint, name: string) => number = (value: bigint, name: string): number => {
    if (!isBigInt(value)) {
        throw new TypeError(`${name} must be a bigint.`);
    }
    if (value < 1n) {
        throw new RangeError(`${name} must be positive.`);
    }
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new TypeError(`${name} must fit a safe integer.`);
    }
    return Number(value);
}

/**
 * Resolves an optional window argument to a callable taper.
 *
 * The absent case returns the default analysis window of this module, the
 * periodic Hann window, which is the taper the reference implementations use
 * when the window is named rather than supplied. A supplied value must be
 * callable; it is not probed for the weights it returns, because that is the job
 * of the first consumer.
 *
 * @param window - the caller's window, or `undefined` to accept the default.
 * @returns the window to apply.
 * @throws {TypeError} if the argument is present and not callable.
 */
export const resolveWindow: (window?: SpectralWindow) => SpectralWindow = (window?: SpectralWindow): SpectralWindow => {
    if (window === undefined) {
        return useHannPeriodicWindow;
    }
    if (!isSpectralWindow(window)) {
        throw new TypeError("Analysis window must be a window function.");
    }
    return window;
}

/**
 * Checks that a sampling plan describes the samples that were collected.
 *
 * The plan fixes the rate, the covered duration and therefore every frequency
 * this module reports, so a mismatch is a type error in all but name. The check
 * runs before any transform so that a rejected plan leaves no partial result
 * behind.
 *
 * @param plan - the sampling plan to validate.
 * @param count - the number of collected samples.
 * @throws {TypeError} if the plan is not a `Sample`.
 * @throws {RangeError} if the plan's frame count differs from `count`.
 */
const requirePlan: (plan: Sample, count: number) => void = (plan: Sample, count: number): void => {
    if (!(plan instanceof Sample)) {
        throw new TypeError("Signal plan must be a Sample.");
    }
    if (plan.getCount() !== count) {
        throw new RangeError("Signal plan frame count must match the signal length.");
    }
}

/**
 * Checks that a numeric argument is a finite number inside a closed range.
 *
 * @param value - the candidate value.
 * @param minimum - the inclusive lower bound.
 * @param maximum - the inclusive upper bound.
 * @param name - the role used in the error message.
 * @throws {TypeError} if the value is not a finite number.
 * @throws {RangeError} if the value lies outside the range.
 */
const requireWithin: (value: number, minimum: number, maximum: number, name: string) => void =
    (value: number, minimum: number, maximum: number, name: string): void => {
        if (!isNumber(value)) {
            throw new TypeError(`${name} must be a finite number.`);
        }
        if (value < minimum || value > maximum) {
            throw new RangeError(`${name} must be within [${minimum}, ${maximum}].`);
        }
    }

/**
 * Returns the index of the highest one-sided bin, and whether it is Nyquist.
 *
 * For an even length the last one-sided index is `count / 2` and that bin is the
 * Nyquist bin, which is self-conjugate. For an odd length the last index is
 * `(count - 1) / 2` and there is no Nyquist bin. Every one-sided fold in this
 * module is driven by these two values, so the edge rule cannot drift between
 * methods.
 *
 * @param count - the transform length, a positive integer.
 * @returns the last one-sided index and whether the last bin is Nyquist.
 */
const oneSidedEdge: (count: number) => { last: number; even: boolean } = (count: number): { last: number; even: boolean } => {
    return { last: Math.floor(count / 2), even: count % 2 === 0 };
}

/**
 * Removes a trend from a value sequence.
 *
 * `"none"` returns a copy of the samples, `"constant"` subtracts the mean and
 * `"linear"` subtracts the least-squares line through the samples. The line is
 * fitted against the sample index rather than against time, which is the same
 * thing up to the constant sampling interval and avoids one multiplication per
 * sample. Detrending is defined for a single sample: the mean version returns
 * zero and the linear version returns zero as well, because a one-point line has
 * no slope to remove.
 *
 * The input is consumed once and is not modified; the result is a new array of
 * the same length.
 *
 * @param values - the samples to detrend, at least one.
 * @param mode - the trend to remove.
 * @returns a new array of detrended samples, in the original order.
 * @throws {TypeError} if the input is not iterable, a sample is not finite, or
 *         the mode is not one of the three supported names.
 * @throws {RangeError} if the input yields no samples.
 */
export const signalDetrend: (values: Iterable<number>, mode: DetrendMode) => Array<number> =
    (values: Iterable<number>, mode: DetrendMode): Array<number> => {
        const collected: Array<number> = collectSamples(values, "Detrended signal");
        if (!DetrendModes.includes(mode)) {
            throw new TypeError("Detrend mode must be none, constant or linear.");
        }
        if (mode === "none") {
            return collected;
        }
        const count: number = collected.length;
        let mean: number = 0;
        for (const value of collected) {
            mean += value;
        }
        mean /= count;
        const centered: Array<number> = collected.map((value: number): number => value - mean);
        if (mode === "constant" || count < 2) {
            return centered;
        }
        let covariance: number = 0;
        let variance: number = 0;
        const middle: number = (count - 1) / 2;
        for (let index: number = 0; index < count; index += 1) {
            const offset: number = index - middle;
            covariance += offset * centered[index];
            variance += offset * offset;
        }
        const slope: number = variance === 0 ? 0 : covariance / variance;
        return collected.map((value: number, index: number): number => value - mean - slope * (index - middle));
    }

/**
 * Returns the windowed complex transform of a real sequence.
 *
 * The taper is applied to the samples first and the zero padding is applied
 * afterwards, so the window still spans exactly the observed samples and the
 * padded region contributes nothing. The result holds one raw, unnormalised
 * coefficient per transform bin, in increasing frequency order; no coherent-gain
 * correction is applied because a raw `Spectrum` is expected to carry the
 * untouched coefficients.
 *
 * Zero padding is interpolation, not resolution. A transform length `size` above
 * `count` samples the same underlying DTFT more densely, so a peak can be located
 * more precisely and the bin spacing becomes `rate / size`, but the ability to
 * separate two components is still governed by the window length and shape:
 * about `rate / count` for a rectangular taper and about `1.44 * rate / count`
 * for Hann. Padding a short frame never turns two merged tones into two resolved
 * ones.
 *
 * @param plan - the sampling plan of the signal, used for the frame rate.
 * @param values - the real samples, at least one.
 * @param size - the transform length in samples, at least the signal length.
 * @param window - the analysis taper applied before padding.
 * @returns a spectrum over `size` bins.
 * @throws {TypeError} if the plan is not a `Sample`, the samples are not finite
 *         numbers, the length is not a positive integer, or the window is not
 *         callable.
 * @throws {RangeError} if the signal is empty, or `size` is below the signal
 *         length, which would truncate the observation.
 */
export const signalSpectrum: (plan: Sample, values: Iterable<number>, size: number, window: SpectralWindow) => Spectrum =
    (plan: Sample, values: Iterable<number>, size: number, window: SpectralWindow): Spectrum => {
        const collected: Array<number> = collectSamples(values, "Spectrum signal");
        requirePlan(plan, collected.length);
        if (!isNumber(size) || !Number.isInteger(size) || size < 1) {
            throw new TypeError("Spectrum transform length must be a positive integer.");
        }
        if (size < collected.length) {
            throw new RangeError("Spectrum transform length must not truncate the signal.");
        }
        const taper: SpectralWindow = resolveWindow(window);
        const weighted: Array<number> = windowed(collected, taper);
        const padded: Array<number> = weighted.slice();
        while (padded.length < size) {
            padded.push(0);
        }
        const transformPlan: Sample = new Sample(size, size / plan.getRate());
        return new Spectrum(transformPlan, fastFourierTransform(asComplex(padded)));
    }

/**
 * Folds a spectrum into its one-sided bins without doubling DC or Nyquist.
 *
 * A real signal satisfies `X[count - k] = conj(X[k])`, so the negative-frequency
 * half carries no information and its energy is folded onto the positive half by
 * doubling every interior bin. The constant bin and, for an even length, the
 * Nyquist bin are self-conjugate: they are their own mirror image, so doubling
 * them would invent energy the signal never contained. Doing so on the test
 * signal `2 + cos(PI * n)` reports an amplitude of four instead of two at DC and
 * two instead of one at Nyquist, exactly 6.02 decibels too high in both cases.
 * That is the single most common one-sided spectrum error, and this function is
 * the only place in the module where the fold is expressed.
 *
 * The returned bins keep their raw amplitudes: the doubling is a fold of the
 * conjugate half, not a normalisation, so amplitude calibration is a separate
 * step.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param size - the transform length in samples, at least the signal length.
 * @param window - the analysis taper applied before the transform.
 * @returns the bins from zero hertz through the top of the lower half.
 * @throws {TypeError} if the plan, the samples, the length or the window is
 *         invalid.
 * @throws {RangeError} if the signal is empty or the length would truncate it.
 */
export const signalOneSided: (plan: Sample, values: Iterable<number>, size: number, window: SpectralWindow) => Array<Bin> =
    (plan: Sample, values: Iterable<number>, size: number, window: SpectralWindow): Array<Bin> => {
        const spectrum: Spectrum = signalSpectrum(plan, values, size, window);
        const bins: ReadonlyArray<Bin> = spectrum.getBins();
        const edge: { last: number; even: boolean } = oneSidedEdge(bins.length);
        const output: Array<Bin> = [];
        for (let index: number = 0; index <= edge.last; index += 1) {
            const bin: Bin = bins[index];
            const selfConjugate: boolean = index === 0 || (edge.even && index === edge.last);
            output.push(selfConjugate ? bin : bin.withAmplitude(bin.getAmplitude().multiply(2)));
        }
        return output;
    }

/**
 * Returns the one-sided amplitudes of a signal after coherent-gain correction.
 *
 * The estimate is `A[k] = 2 * |X[k]| / (count * CG)` for an interior bin and
 * `A[k] = |X[k]| / (count * CG)` for DC and Nyquist, where `CG` is the coherent
 * gain of the window at this exact length. Both corrections are required: without
 * the factor of two an interior tone reads half its amplitude, and without the
 * gain correction it reads half again, for a combined error of 6.02 decibels.
 *
 * The gain is recomputed per call from the actual window vector and never
 * hard-coded, because a symmetric taper deviates from its closed-form value at
 * short lengths: a symmetric Hann reads `0.4375` at eight samples and `0.4688` at
 * sixteen, so assuming `0.5` misreads the amplitude by 1.16 and 0.56 decibels
 * respectively.
 *
 * The amplitude convention holds for a narrow-band or sinusoidal component. A
 * broadband noise floor has no single amplitude, and its level must be taken from
 * the power spectral density instead.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param window - the analysis taper.
 * @returns one amplitude per one-sided bin, in units of the samples.
 * @throws {TypeError} if the plan, the samples or the window is invalid.
 * @throws {RangeError} if the signal is empty, or the window weights sum to zero,
 *         which cannot be normalised.
 */
export const signalAmplitude: (plan: Sample, values: Iterable<number>, window: SpectralWindow) => Array<number> =
    (plan: Sample, values: Iterable<number>, window: SpectralWindow): Array<number> => {
        const collected: Array<number> = collectSamples(values, "Amplitude signal");
        requirePlan(plan, collected.length);
        const taper: SpectralWindow = resolveWindow(window);
        const count: number = collected.length;
        const gain: number = coherentGain(taper, count);
        const weighted: Array<number> = windowed(collected, taper);
        const transformed: Array<Complex> = fastFourierTransform(asComplex(weighted));
        const edge: { last: number; even: boolean } = oneSidedEdge(count);
        const scale: number = count * gain;
        const output: Array<number> = [];
        for (let index: number = 0; index <= edge.last; index += 1) {
            const magnitude: number = transformed[index].magnitude();
            const selfConjugate: boolean = index === 0 || (edge.even && index === edge.last);
            output.push((selfConjugate ? magnitude : 2 * magnitude) / scale);
        }
        return output;
    }

/**
 * Returns the one-sided power of a signal, with DC and Nyquist not doubled.
 *
 * The power of an interior bin is `A[k]^2 / 2` because a sinusoid of amplitude
 * `A` has mean square `A^2 / 2`; DC and Nyquist carry their full `A[k]^2` because
 * they are not oscillating components. This is the "peak" convention: a single
 * bin states the mean square that a sinusoid landing exactly on it would have,
 * which is what a narrow-band measurement wants.
 *
 * It is deliberately not the Parseval convention. A window spreads each line over
 * its main lobe, so summing every bin over-counts by the equivalent noise
 * bandwidth: for Hann the sum is `1.5` times the mean square for a tone, for a
 * pair of tones and for a tone plus a constant alike. Use
 * {@link signalPowerSpectralDensity} when the total power or a noise level is the
 * question.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param window - the analysis taper.
 * @returns one power per one-sided bin, in squared units of the samples.
 * @throws {TypeError} if the plan, the samples or the window is invalid.
 * @throws {RangeError} if the signal is empty or the window weights sum to zero.
 */
export const signalPower: (plan: Sample, values: Iterable<number>, window: SpectralWindow) => Array<number> =
    (plan: Sample, values: Iterable<number>, window: SpectralWindow): Array<number> => {
        const collected: Array<number> = collectSamples(values, "Power signal");
        const amplitudes: Array<number> = signalAmplitude(plan, collected, window);
        const edge: { last: number; even: boolean } = oneSidedEdge(collected.length);
        const output: Array<number> = [];
        for (let index: number = 0; index < amplitudes.length; index += 1) {
            const amplitude: number = amplitudes[index];
            const selfConjugate: boolean = index === 0 || (edge.even && index === edge.last);
            output.push(selfConjugate ? amplitude * amplitude : amplitude * amplitude / 2);
        }
        return output;
    }

/**
 * Returns the one-sided amplitude levels in decibels.
 *
 * This is `20 * log10(A[k])`, the amplitude convention, and it is only correct for
 * an amplitude. A power or a density fed through it reports twice the level it
 * should: a power of one quarter is correctly minus 6.02 decibels but reads minus
 * 12.04 decibels under the amplitude convention. Use {@link signalPowerDecibel}
 * for those quantities.
 *
 * A silent bin reports negative infinity rather than throwing, because silence is
 * a normal measurement.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param window - the analysis taper.
 * @returns one level per one-sided bin, in decibels relative to one.
 * @throws {TypeError} if the plan, the samples or the window is invalid.
 * @throws {RangeError} if the signal is empty or the window weights sum to zero.
 */
export const signalDecibel: (plan: Sample, values: Iterable<number>, window: SpectralWindow) => Array<number> =
    (plan: Sample, values: Iterable<number>, window: SpectralWindow): Array<number> => {
        return signalAmplitude(plan, values, window).map((amplitude: number): number => amplitudeDecibel(amplitude, 1));
    }

/**
 * Returns the one-sided power levels in decibels.
 *
 * This is `10 * log10(P[k])`, the power convention, and it is the only correct
 * choice for a power, an energy, a mean square or a density. The two conventions
 * agree only through the square relation between their quantities, so
 * `10 * log10(A^2) = 20 * log10(A)`; applying the amplitude factor to a power
 * halves the reported level in decibels.
 *
 * A silent bin reports negative infinity rather than throwing.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param window - the analysis taper.
 * @returns one level per one-sided bin, in decibels relative to one.
 * @throws {TypeError} if the plan, the samples or the window is invalid.
 * @throws {RangeError} if the signal is empty or the window weights sum to zero.
 */
export const signalPowerDecibel: (plan: Sample, values: Iterable<number>, window: SpectralWindow) => Array<number> =
    (plan: Sample, values: Iterable<number>, window: SpectralWindow): Array<number> => {
        return signalPower(plan, values, window).map((power: number): number => powerDecibel(power, 1));
    }

/**
 * An immutable one-sided power spectral density on a fixed frequency grid.
 *
 * A density carries the physical unit of the samples squared per hertz, so it can
 * be integrated over a band, compared across segment lengths and combined with
 * the equivalent noise bandwidth. That is precisely what a plain power cannot do:
 * a bare `unit^2` value changes meaning when the frame length changes, while
 * `unit^2 / Hz` does not.
 *
 * Every grid entry is one bin, and `integrate` multiplies each density by the bin
 * spacing before summing, so integrating the whole grid yields the mean square of
 * the analysed signal whenever the estimate is unbiased. The class is a value
 * object: the arrays are copied and frozen at construction and every query is a
 * pure read.
 */
export class SpectralDensity {

    /**
     * The frequency of every bin, in increasing order and frozen.
     */
    private readonly frequencies: ReadonlyArray<Frequency>;
    /**
     * The density of every bin, in `unit^2 / Hz`, aligned with `frequencies`.
     */
    private readonly densities: ReadonlyArray<number>;
    /**
     * The spacing between adjacent bins, which is also the integration step.
     */
    private readonly resolution: Frequency;
    /**
     * The number of segments that were averaged into this estimate.
     */
    private readonly segments: bigint;
    /**
     * The taper the segments were weighted with.
     */
    private readonly taper: SpectralWindow;

    /**
     * Creates a density from a frequency grid and a matching density vector.
     *
     * Both sequences are consumed once, copied and frozen, and they must have the
     * same length, because a density without a frequency is not addressable. The
     * resolution is stored as supplied rather than recomputed from the grid, so a
     * caller that integrates a sub-grid still pays the original bin spacing.
     *
     * @param frequencies - the frequency of every bin, in increasing order.
     * @param densities - the density of every bin, in `unit^2 / Hz`.
     * @param resolution - the spacing between adjacent bins.
     * @param segments - the number of averaged segments, at least one.
     * @param taper - the window the segments were weighted with.
     * @throws {TypeError} if a frequency is not a `Frequency`, a density is not a
     *         finite number, the resolution is not a `Frequency`, the segment
     *         count is not a `bigint`, or the taper is not callable.
     * @throws {RangeError} if the grid and the density vector differ in length,
     *         the grid is empty, or the segment count is not positive.
     */
    public constructor(frequencies: Iterable<Frequency>, densities: Iterable<number>, resolution: Frequency, segments: bigint, taper: SpectralWindow) {
        if (!isIterable(frequencies)) {
            throw new TypeError("Spectral density frequencies must be iterable.");
        }
        const grid: Array<Frequency> = [];
        for (const frequency of frequencies) {
            if (!(frequency instanceof Frequency)) {
                throw new TypeError("Spectral density frequencies must be Frequency values.");
            }
            grid.push(frequency);
        }
        if (!isIterable(densities)) {
            throw new TypeError("Spectral density values must be iterable.");
        }
        const values: Array<number> = [];
        for (const density of densities) {
            if (!isNumber(density)) {
                throw new TypeError("Spectral density values must be finite numbers.");
            }
            values.push(density);
        }
        if (!(resolution instanceof Frequency)) {
            throw new TypeError("Spectral density resolution must be a Frequency.");
        }
        if (!isBigInt(segments)) {
            throw new TypeError("Spectral density segment count must be a bigint.");
        }
        if (!isSpectralWindow(taper)) {
            throw new TypeError("Spectral density window must be a window function.");
        }
        if (grid.length !== values.length) {
            throw new RangeError("Spectral density grid and values must have the same length.");
        }
        if (grid.length < 1) {
            throw new RangeError("Spectral density requires at least one bin.");
        }
        if (segments < 1n) {
            throw new RangeError("Spectral density segment count must be positive.");
        }
        this.frequencies = Object.freeze(grid);
        this.densities = Object.freeze(values);
        this.resolution = resolution;
        this.segments = segments;
        this.taper = taper;
    }

    /**
     * Returns the number of bins on the grid.
     *
     * @returns the bin count, a positive integer.
     */
    public size(): number {
        return this.densities.length;
    }

    /**
     * Returns whether this density holds no bins.
     *
     * The constructor requires at least one bin, so this is `false` for every
     * constructed density; it remains part of the surface for callers that forward
     * the query.
     *
     * @returns `true` if the grid is empty.
     */
    public isEmpty(): boolean {
        return this.densities.length === 0;
    }

    /**
     * Returns the spacing between adjacent bins.
     *
     * @returns the bin spacing in hertz.
     */
    public getResolution(): Frequency {
        return this.resolution;
    }

    /**
     * Returns the number of segments that were averaged.
     *
     * A count of one means the estimate is a single periodogram: unbiased, but with
     * a variance that does not shrink as the record grows. Averaging at least a
     * handful of segments is what makes the estimate usable, at the cost of a
     * coarser resolution because each segment is shorter.
     *
     * @returns the averaged segment count.
     */
    public getSegments(): bigint {
        return this.segments;
    }

    /**
     * Returns the taper applied to every segment.
     *
     * @returns the analysis window.
     */
    public getWindow(): SpectralWindow {
        return this.taper;
    }

    /**
     * Returns the frequency of one bin.
     *
     * The index must be an integer but need not lie inside the grid: an
     * out-of-range index yields an empty `Optional` rather than an exception, so
     * probing a range needs no caller-side bounds check.
     *
     * @param index - the zero-based bin index.
     * @returns the bin frequency in an `Optional`.
     * @throws {TypeError} if the index is not a finite integer.
     */
    public frequencyAt(index: number): Optional<Frequency> {
        if (!isNumber(index) || !Number.isInteger(index)) {
            throw new TypeError("Spectral density index must be a finite integer.");
        }
        if (index < 0 || index >= this.frequencies.length) {
            return Optional.empty();
        }
        return Optional.of(this.frequencies[index]);
    }

    /**
     * Returns the density of one bin.
     *
     * @param index - the zero-based bin index.
     * @returns the density in `unit^2 / Hz` in an `Optional`.
     * @throws {TypeError} if the index is not a finite integer.
     */
    public densityAt(index: number): Optional<number> {
        if (!isNumber(index) || !Number.isInteger(index)) {
            throw new TypeError("Spectral density index must be a finite integer.");
        }
        if (index < 0 || index >= this.densities.length) {
            return Optional.empty();
        }
        return Optional.of(this.densities[index]);
    }

    /**
     * Returns the level of one bin in decibels.
     *
     * The conversion is `10 * log10(density / reference)`, the power convention,
     * because a density is a power per hertz and not an amplitude. Passing it
     * through the amplitude convention would halve the level: minus 6.02 would
     * report as minus 12.04 decibels. A zero density reports negative infinity.
     *
     * @param index - the zero-based bin index.
     * @param reference - the positive density that maps to zero decibels, and one
     *        by default.
     * @returns the level in decibels in an `Optional`.
     * @throws {TypeError} if the index is not a finite integer, or the reference is
     *         not a finite number.
     * @throws {RangeError} if an in-range bin is requested with a reference that is
     *         not positive.
     */
    public decibelAt(index: number, reference: number = 1): Optional<number> {
        if (!isNumber(index) || !Number.isInteger(index)) {
            throw new TypeError("Spectral density index must be a finite integer.");
        }
        if (index < 0 || index >= this.densities.length) {
            return Optional.empty();
        }
        return Optional.of(powerDecibel(this.densities[index], reference));
    }

    /**
     * Integrates the density over a half-open frequency band.
     *
     * Every bin whose frequency lies in `[low, high)` contributes its density
     * multiplied by the bin spacing, which is the rectangle rule on a uniform grid.
     * A bin on the lower edge is counted and a bin on the upper edge is not, so
     * equal bounds describe an empty band and report zero. Because the grid is
     * uniform and the bounds are compared with exact frequencies, no interpolation
     * is performed: a band whose bounds fall between two bins still measures whole
     * bins.
     *
     * Integrating the whole grid yields the mean square of the analysed signal,
     * which is Parseval's theorem in its density form. That identity is what makes
     * a density the right tool for noise and for total power, and it is why this
     * class exists next to the peak-convention power array.
     *
     * @param low - the inclusive lower bound in hertz.
     * @param high - the exclusive upper bound in hertz.
     * @returns the integrated power in squared units of the samples.
     * @throws {TypeError} if either bound is not a `Frequency`.
     */
    public integrate(low: Frequency, high: Frequency): number {
        if (!(low instanceof Frequency)) {
            throw new TypeError("Integration lower bound must be a Frequency.");
        }
        if (!(high instanceof Frequency)) {
            throw new TypeError("Integration upper bound must be a Frequency.");
        }
        const step: number = this.resolution.getHertz();
        let total: number = 0;
        for (let index: number = 0; index < this.densities.length; index += 1) {
            const frequency: number = this.frequencies[index].getHertz();
            if (frequency >= low.getHertz() && frequency < high.getHertz()) {
                total += this.densities[index] * step;
            }
        }
        return total;
    }

    /**
     * Integrates the density over the whole grid.
     *
     * For an unbiased density this equals the mean square of the detrended signal,
     * so a white-noise record reads its variance and a unit sinusoid reads one
     * half. That is Parseval's theorem, and it is the check that distinguishes a
     * correctly normalised density from one that is off by the equivalent noise
     * bandwidth.
     *
     * @returns the total power in squared units of the samples.
     */
    public totalPower(): number {
        const step: number = this.resolution.getHertz();
        let total: number = 0;
        for (const density of this.densities) {
            total += density * step;
        }
        return total;
    }

    /**
     * Returns a quantile of the density, the usual robust noise floor.
     *
     * The default median is a robust estimate of a flat noise floor because it
     * ignores the few bins a tonal component occupies, whereas the mean would be
     * dragged upwards by exactly those bins. The quantile is computed on a copy and
     * interpolates linearly between order statistics, so it is defined for any
     * fraction strictly between zero and one.
     *
     * @param quantile - the fraction of bins at or below the floor, and `0.5` by
     *        default.
     * @returns the density at that quantile in an `Optional`.
     * @throws {TypeError} if the quantile is not a finite number.
     * @throws {RangeError} if the quantile is not within `(0, 1)`, or the grid is
     *         empty.
     */
    public noiseFloor(quantile: number = 0.5): Optional<number> {
        if (!isNumber(quantile)) {
            throw new TypeError("Noise floor quantile must be a finite number.");
        }
        if (quantile <= 0 || quantile >= 1) {
            throw new RangeError("Noise floor quantile must be within (0, 1).");
        }
        if (this.densities.length < 1) {
            return Optional.empty();
        }
        const sorted: Array<number> = this.densities.slice().sort((first: number, second: number): number => first - second);
        const position: number = quantile * (sorted.length - 1);
        const lower: number = Math.floor(position);
        const upper: number = Math.min(sorted.length - 1, lower + 1);
        const fraction: number = position - lower;
        return Optional.of(sorted[lower] * (1 - fraction) + sorted[upper] * fraction);
    }

    /**
     * Compares this density with another entry by entry.
     *
     * Two densities are equal when their resolutions, segment counts, tapers and
     * grids match and every density agrees within the tolerance. The taper is
     * compared by identity, because two distinct window functions are not
     * meaningfully comparable without evaluating them.
     *
     * @param other - the density to compare with.
     * @param epsilon - the absolute tolerance applied to the densities, and `1E-9`
     *        by default.
     * @returns whether the two estimates are indistinguishable.
     * @throws {TypeError} if the argument is not a `SpectralDensity`, or the
     *         tolerance is not a finite number.
     * @throws {RangeError} if the tolerance is negative.
     */
    public equals(other: SpectralDensity, epsilon: number = Tolerance): boolean {
        if (!(other instanceof SpectralDensity)) {
            throw new TypeError("Spectral density comparison requires a SpectralDensity.");
        }
        if (!isNumber(epsilon)) {
            throw new TypeError("Spectral density tolerance must be a finite number.");
        }
        if (epsilon < 0) {
            throw new RangeError("Spectral density tolerance must not be negative.");
        }
        if (this.densities.length !== other.densities.length) {
            return false;
        }
        if (this.segments !== other.segments || this.taper !== other.taper) {
            return false;
        }
        if (Math.abs(this.resolution.getHertz() - other.resolution.getHertz()) > epsilon) {
            return false;
        }
        for (let index: number = 0; index < this.densities.length; index += 1) {
            if (Math.abs(this.frequencies[index].getHertz() - other.frequencies[index].getHertz()) > epsilon) {
                return false;
            }
            if (Math.abs(this.densities[index] - other.densities[index]) > epsilon) {
                return false;
            }
        }
        return true;
    }

    /**
     * Returns a short, stable description of this density.
     *
     * @returns a description naming the bin count, the resolution and the segment
     *          count.
     */
    public toString(): string {
        return `SpectralDensity(bins=${this.densities.length}, resolution=${this.resolution.getHertz()}, segments=${this.segments})`;
    }
}

/**
 * Estimates a one-sided power spectral density with Welch's method.
 *
 * The signal is cut into overlapping segments, each segment is detrended,
 * weighted and transformed, and the resulting periodograms are averaged. A single
 * periodogram is unbiased but inconsistent: its variance does not shrink as the
 * record grows, so the only cure is averaging independent segments. That trade is
 * explicit here — the segment length fixes the frequency resolution
 * `rate / frameSize`, the hop fixes the number of segments, and averaging `M`
 * segments divides the variance by roughly `M` while blurring the estimate over
 * the equivalent noise bandwidth.
 *
 * The normalisation is the one that makes the density unbiased for noise:
 *
 * ```
 * Pxx[k] = |X[k]|^2 / (rate * sum(w[n]^2)),   doubled for 0 < k < N / 2
 * ```
 *
 * The divisor is `sum(w^2)`, and it is not interchangeable with `count` or with
 * `count * CG^2`. For unit white noise the three choices read `1.0`, `0.375` and
 * `1.5` respectively, so the wrong divisor misstates a noise floor by 4.26 or
 * 1.76 decibels. The `sum(w^2)` form already contains both the coherent gain and
 * the equivalent noise bandwidth, which is why no further correction is applied
 * here and why a density must never be "fixed" by dividing by `CG`.
 *
 * The DC and Nyquist bins are never doubled; only the interior of the one-sided
 * half is, because only those bins have a conjugate mirror. Integrating the result
 * over the whole grid reproduces the mean square of each detrended segment, so
 * `sum(Pxx) * resolution` is the Parseval check.
 *
 * The default trend is `"constant"` and the default segment length is the smaller
 * of 256 samples and the signal length, with a hop of half a segment. Those are
 * the reference defaults: a constant offset leaks into the low bins, and the short
 * segment keeps the short-time stationarity assumption plausible.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param frameSize - the segment length in samples, at least one and at most the
 *        signal length.
 * @param hopSize - the samples between segment starts, at least one and at most
 *        `frameSize`.
 * @param window - the analysis taper, applied to every segment.
 * @returns the averaged one-sided density.
 * @throws {TypeError} if the plan, the samples, the segment or hop size, or the
 *         window is invalid.
 * @throws {RangeError} if the signal is empty, the segment length exceeds the
 *         signal, the hop exceeds the segment, or the window weights are all zero.
 */
export const signalPowerSpectralDensity: (plan: Sample, values: Iterable<number>, frameSize: number, hopSize: number, window: SpectralWindow) => SpectralDensity =
    (plan: Sample, values: Iterable<number>, frameSize: number, hopSize: number, window: SpectralWindow): SpectralDensity => {
        const collected: Array<number> = collectSamples(values, "Density signal");
        requirePlan(plan, collected.length);
        if (!isNumber(frameSize) || !Number.isInteger(frameSize) || frameSize < 1) {
            throw new TypeError("Density segment length must be a positive integer.");
        }
        if (!isNumber(hopSize) || !Number.isInteger(hopSize) || hopSize < 1) {
            throw new TypeError("Density hop size must be a positive integer.");
        }
        if (frameSize > collected.length) {
            throw new RangeError("Density segment length must not exceed the signal length.");
        }
        if (hopSize > frameSize) {
            throw new RangeError("Density hop size must not exceed the segment length.");
        }
        const taper: SpectralWindow = resolveWindow(window);
        const rate: number = plan.getRate();
        const weights: Array<number> = [];
        let squared: number = 0;
        for (let index: number = 0; index < frameSize; index += 1) {
            const weight: number = taper(index, frameSize);
            if (!isNumber(weight)) {
                throw new RangeError("Window function must return finite weights.");
            }
            weights.push(weight);
            squared += weight * weight;
        }
        if (squared === 0) {
            throw new RangeError("Window weights must not all be zero.");
        }
        const segments: number = Math.floor((collected.length - frameSize) / hopSize) + 1;
        const edge: { last: number; even: boolean } = oneSidedEdge(frameSize);
        const accumulated: Array<number> = new Array<number>(edge.last + 1).fill(0);
        for (let segment: number = 0; segment < segments; segment += 1) {
            const start: number = segment * hopSize;
            let mean: number = 0;
            for (let offset: number = 0; offset < frameSize; offset += 1) {
                mean += collected[start + offset];
            }
            mean /= frameSize;
            const prepared: Array<number> = [];
            for (let offset: number = 0; offset < frameSize; offset += 1) {
                prepared.push((collected[start + offset] - mean) * weights[offset]);
            }
            const transformed: Array<Complex> = fastFourierTransform(asComplex(prepared));
            for (let index: number = 0; index <= edge.last; index += 1) {
                const power: number = transformed[index].magnitude() * transformed[index].magnitude() / (rate * squared);
                const selfConjugate: boolean = index === 0 || (edge.even && index === edge.last);
                accumulated[index] += selfConjugate ? power : 2 * power;
            }
        }
        const grid: Array<Frequency> = [];
        const densities: Array<number> = [];
        for (let index: number = 0; index < accumulated.length; index += 1) {
            grid.push(new Frequency(index * rate / frameSize));
            densities.push(accumulated[index] / segments);
        }
        return new SpectralDensity(grid, densities, new Frequency(rate / frameSize), BigInt(segments), taper);
    }

/**
 * Frames a signal for short-time analysis so that no sample is dropped.
 *
 * The signal is extended by `floor(frameSize / 2)` samples at each end and the
 * tail is then zero-padded until a whole number of hops remains, which is the
 * default boundary handling of the reference short-time transform. The
 * consequence is that the first frame is centred on the first input sample and the
 * last frame reaches the last sample, so the frame count is
 * `floor((extended - frameSize) / hopSize) + 1` and the centre of frame `m` sits
 * at `m * hopSize / rate` seconds on the original axis. Dropping the tail instead,
 * as a "complete frames only" loop does, silently discards up to
 * `frameSize - 1` samples: for 1000 samples, a frame of 256 and a hop of 128 that
 * is 232 samples, nearly a quarter of the record.
 *
 * Each frame is weighted with the supplied taper and transformed at its own
 * length, so every column of the result is a `Spectrum` over `frameSize` bins with
 * a bin spacing of `rate / frameSize`. The result is in frame order.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param frameSize - the frame length in samples, at least one and at most the
 *        signal length.
 * @param hopSize - the samples between frame starts, at least one and at most
 *        `frameSize`.
 * @param window - the analysis taper, applied to every frame.
 * @returns one spectrum per frame, in centre-time order.
 * @throws {TypeError} if the plan, the samples, the frame or hop size, or the
 *         window is invalid.
 * @throws {RangeError} if the signal is empty, the frame exceeds the signal, the
 *         hop exceeds the frame, or the framing yields no frame.
 */
export const signalShortTimeFourierTransform: (plan: Sample, values: Iterable<number>, frameSize: number, hopSize: number, window: SpectralWindow) => Array<Spectrum> =
    (plan: Sample, values: Iterable<number>, frameSize: number, hopSize: number, window: SpectralWindow): Array<Spectrum> => {
        const collected: Array<number> = collectSamples(values, "Short-time signal");
        requirePlan(plan, collected.length);
        if (!isNumber(frameSize) || !Number.isInteger(frameSize) || frameSize < 1) {
            throw new TypeError("Short-time frame size must be a positive integer.");
        }
        if (!isNumber(hopSize) || !Number.isInteger(hopSize) || hopSize < 1) {
            throw new TypeError("Short-time hop size must be a positive integer.");
        }
        if (frameSize > collected.length) {
            throw new RangeError("Short-time frame size must not exceed the signal length.");
        }
        if (hopSize > frameSize) {
            throw new RangeError("Short-time hop size must not exceed the frame size.");
        }
        const taper: SpectralWindow = resolveWindow(window);
        const rate: number = plan.getRate();
        const extension: number = Math.floor(frameSize / 2);
        const extended: Array<number> = [];
        for (let index: number = 0; index < extension; index += 1) {
            extended.push(0);
        }
        for (const value of collected) {
            extended.push(value);
        }
        for (let index: number = 0; index < extension; index += 1) {
            extended.push(0);
        }
        const remainder: number = (extended.length - frameSize) % hopSize;
        const tail: number = remainder === 0 ? 0 : hopSize - remainder;
        for (let index: number = 0; index < tail; index += 1) {
            extended.push(0);
        }
        const columnPlan: Sample = new Sample(frameSize, frameSize / rate);
        const output: Array<Spectrum> = [];
        for (let start: number = 0; start + frameSize <= extended.length; start += hopSize) {
            const frame: Array<number> = windowed(extended.slice(start, start + frameSize), taper);
            output.push(new Spectrum(columnPlan, fastFourierTransform(asComplex(frame))));
        }
        if (output.length < 1) {
            throw new RangeError("Short-time framing must yield at least one frame.");
        }
        return output;
    }

/**
 * Builds a time-frequency view of a signal over the given framing.
 *
 * The columns are exactly the spectra of {@link signalShortTimeFourierTransform}
 * with the same taper and framing, and the view retains the hop, the taper and the
 * zero boundary so that it reports frame *centre* times on the original axis and
 * can trim the extension when it rebuilds a frame. The default taper is the
 * periodic Hann window, which satisfies the constant-overlap-add condition at
 * fifty percent overlap, so the overlap-add reconstruction of this view has no
 * periodic amplitude ripple. A symmetric taper would look identical at a glance
 * and ripple by 0.84 decibels at sixteen samples, 0.21 at sixty-four and 0.013 at
 * one thousand and twenty-four; the difference never raises an error, it only
 * biases the result.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param frameSize - the frame length in samples.
 * @param hopSize - the samples between frame starts.
 * @param window - the analysis taper, applied to every frame.
 * @returns the time-frequency view of the signal.
 * @throws {TypeError} if the plan, the samples, the frame or hop size, or the
 *         window is invalid.
 * @throws {RangeError} if the framed columns cannot be built.
 */
export const signalSpectrogram: (plan: Sample, values: Iterable<number>, frameSize: number, hopSize: number, window: SpectralWindow) => Spectrogram =
    (plan: Sample, values: Iterable<number>, frameSize: number, hopSize: number, window: SpectralWindow): Spectrogram => {
        const taper: SpectralWindow = resolveWindow(window);
        const columns: Array<Spectrum> = signalShortTimeFourierTransform(plan, values, frameSize, hopSize, taper);
        return new Spectrogram(columns, hopSize, taper, "zeros");
    }

/**
 * Builds the analytic signal of a real sequence.
 *
 * The negative-frequency half of the transform is cleared and the
 * positive-frequency half is doubled, so the inverse transform yields
 * `x[n] + i * H(x)[n]`, where `H` is the Hilbert transform. The real part then
 * recovers the samples and the modulus is the instantaneous envelope. The
 * transform is circular, which means the first and the last samples see each
 * other as neighbours: for a tone of 8.3 cycles across 512 samples the middle
 * envelope is within 0.2 percent of the true amplitude while the last eight
 * samples are off by up to 87 percent. Treat the two ends as contaminated, or
 * mirror-pad before analysis, and never quote an envelope value from the first or
 * last few percent of a non-integer-periodic record.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @returns one analytic sample per input sample, in order.
 * @throws {TypeError} if the plan is not a `Sample`, or a sample is not a finite
 *         number.
 * @throws {RangeError} if the signal is empty or the plan does not match it.
 */
export const signalAnalyticSignal: (plan: Sample, values: Iterable<number>) => Array<Complex> =
    (plan: Sample, values: Iterable<number>): Array<Complex> => {
        const collected: Array<number> = collectSamples(values, "Analytic signal");
        requirePlan(plan, collected.length);
        return analyticSignal(new Frame(plan, collected));
    }

/**
 * Returns the instantaneous phase of a real sequence.
 *
 * Each analytic sample is mapped to its argument, measured from the positive real
 * axis and normalised into `[0, 2 * PI)`. Because the phase is folded into a
 * single turn it jumps by a full turn whenever the signal completes a cycle;
 * unwrap the sequence through the analytic form if a continuous curve is needed.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @returns one radian phase per sample.
 * @throws {TypeError} if the plan is not a `Sample`, or a sample is not a finite
 *         number.
 * @throws {RangeError} if the signal is empty or the plan does not match it.
 */
export const signalInstantaneousPhase: (plan: Sample, values: Iterable<number>) => Array<Angle> =
    (plan: Sample, values: Iterable<number>): Array<Angle> => {
        return instantaneousPhase(signalAnalyticSignal(plan, values));
    }

/**
 * Returns the instantaneous envelope of a real sequence.
 *
 * The envelope is the modulus of the analytic signal,
 * `sqrt(x[n]^2 + H(x)[n]^2)`, which is a constant `A` for `A * cos(w * t + p)`
 * and follows the outline of a modulated carrier. It inherits the circular edge
 * behaviour of the Hilbert transform, so the first and last samples of a record
 * whose period does not divide its length are the least trustworthy.
 *
 * The result carries the units of the samples; computing it has no side effects.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @returns one non-negative amplitude per sample.
 * @throws {TypeError} if the plan is not a `Sample`, or a sample is not a finite
 *         number.
 * @throws {RangeError} if the signal is empty or the plan does not match it.
 */
export const signalEnvelope: (plan: Sample, values: Iterable<number>) => Array<number> =
    (plan: Sample, values: Iterable<number>): Array<number> => {
        return instantaneousAmplitude(signalAnalyticSignal(plan, values));
    }

/**
 * Returns the instantaneous frequency of a real sequence in hertz.
 *
 * The unwrapped analytic phase is differentiated by a forward difference and
 * scaled by `rate / (2 * PI)`, so a single tone reports its own frequency and a
 * sweep reports the current value. The first sample has no predecessor and reports
 * zero.
 *
 * The guard is not optional. Where the envelope vanishes the phase is undefined
 * and the difference of two rounding-noise angles can be as large as half a turn,
 * which reads as half the sampling rate: two equal tones at 100 and 102 hertz
 * sampled at 2048 hertz drop to an envelope of `1.2e-14` at their beat nodes and
 * report spikes of 932 hertz out of a maximum of 1024. Every sample whose envelope,
 * or whose predecessor's envelope, falls below `gate` times the peak envelope
 * therefore reports zero instead of a meaningless number.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param rate - the sampling rate in hertz, used to scale the phase step.
 * @param gate - the envelope threshold as a fraction of the peak envelope, within
 *        `[0, 1]`.
 * @returns one frequency in hertz per sample, whose first entry is zero.
 * @throws {TypeError} if the plan, the samples, the rate or the gate is invalid.
 * @throws {RangeError} if the signal is empty, the rate is not positive, or the
 *         gate lies outside `[0, 1]`.
 */
export const signalInstantaneousFrequency: (plan: Sample, values: Iterable<number>, rate: number, gate: number) => Array<number> =
    (plan: Sample, values: Iterable<number>, rate: number, gate: number): Array<number> => {
        const collected: Array<number> = collectSamples(values, "Instantaneous frequency signal");
        requirePlan(plan, collected.length);
        if (!isNumber(rate)) {
            throw new TypeError("Instantaneous frequency rate must be a finite number.");
        }
        if (rate <= 0) {
            throw new RangeError("Instantaneous frequency rate must be positive.");
        }
        requireWithin(gate, 0, 1, "Envelope gate");
        const analytic: Array<Complex> = signalAnalyticSignal(plan, collected);
        const envelope: Array<number> = instantaneousAmplitude(analytic);
        const phases: Array<number> = unwrapPhase(instantaneousPhase(analytic));
        let peak: number = 0;
        for (const amplitude of envelope) {
            peak = amplitude > peak ? amplitude : peak;
        }
        const threshold: number = gate * peak;
        const output: Array<number> = [0];
        for (let index: number = 1; index < phases.length; index += 1) {
            if (envelope[index] <= threshold || envelope[index - 1] <= threshold) {
                output.push(0);
                continue;
            }
            output.push((phases[index] - phases[index - 1]) * rate / (2 * Math.PI));
        }
        return output;
    }

/**
 * Returns the zero-crossing rate of a real sequence.
 *
 * The rate counts the adjacent pairs with strictly opposite signs and divides by
 * `count - 1`, the number of pairs, so it is the fraction of sample transitions
 * that cross zero. A sine of `f` hertz sampled at `rate` hertz crosses zero
 * `2 * f / rate` times per sample and therefore reads that value, and a signal
 * that alternates on every sample reads one, the maximum. The absolute difference
 * of the sign function that some texts use counts two per crossing and must
 * therefore be halved before it is divided by `count - 1`; the two normalisations
 * describe the same quantity, and this module reports the crossing count rather
 * than twice it.
 *
 * This is a rate, not a count. `Frame.zeroCrossings` returns an integer number of
 * crossings, which cannot be compared across record lengths; multiplying this rate
 * by the sampling rate gives crossings per second instead.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param perSecond - whether to report crossings per second rather than per
 *        sample.
 * @returns the zero-crossing rate, zero for a record of fewer than two samples.
 * @throws {TypeError} if the plan is not a `Sample`, a sample is not finite, or the
 *         flag is not a boolean.
 * @throws {RangeError} if the signal is empty or the plan does not match it.
 */
export const signalZeroCrossingRate: (plan: Sample, values: Iterable<number>, perSecond: boolean) => number =
    (plan: Sample, values: Iterable<number>, perSecond: boolean): number => {
        const collected: Array<number> = collectSamples(values, "Zero-crossing signal");
        requirePlan(plan, collected.length);
        if (typeof perSecond !== "boolean") {
            throw new TypeError("Zero-crossing per-second flag must be a boolean.");
        }
        if (collected.length < 2) {
            return 0;
        }
        let crossings: number = 0;
        for (let index: number = 1; index < collected.length; index += 1) {
            if (collected[index - 1] * collected[index] < 0) {
                crossings += 1;
            }
        }
        const rate: number = crossings / (collected.length - 1);
        return perSecond ? rate * plan.getRate() : rate;
    }

/**
 * Returns the spectral flux of a signal, one value per frame transition.
 *
 * For each frame the one-sided magnitude spectrum is scaled to unit Euclidean norm
 * and then compared with the previous frame by the Euclidean distance of the two
 * normalised vectors. Normalising first is what makes the value a statement about
 * spectral *shape* rather than about loudness: a quiet frame and a loud frame with
 * the same spectrum produce zero flux. The result holds one value per adjacent
 * pair, so `frames - 1` values, and is empty when the framing yields a single
 * frame.
 *
 * A steady tone reads values near zero and an onset or a timbre change reads a
 * value near one, which is why the quantity is used for change detection.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param frameSize - the frame length in samples.
 * @param hopSize - the samples between frame starts.
 * @param window - the analysis taper, applied to every frame.
 * @returns one flux value per adjacent frame pair, in frame order.
 * @throws {TypeError} if the plan, the samples, the frame or hop size, or the
 *         window is invalid.
 * @throws {RangeError} if the framed columns cannot be built.
 */
export const signalSpectralFlux: (plan: Sample, values: Iterable<number>, frameSize: number, hopSize: number, window: SpectralWindow) => Array<number> =
    (plan: Sample, values: Iterable<number>, frameSize: number, hopSize: number, window: SpectralWindow): Array<number> => {
        const columns: Array<Spectrum> = signalShortTimeFourierTransform(plan, values, frameSize, hopSize, window);
        const normalized: Array<Array<number>> = [];
        for (const column of columns) {
            const bins: ReadonlyArray<Bin> = column.getBins();
            const edge: { last: number; even: boolean } = oneSidedEdge(bins.length);
            const magnitudes: Array<number> = [];
            let norm: number = 0;
            for (let index: number = 0; index <= edge.last; index += 1) {
                const magnitude: number = bins[index].magnitude();
                magnitudes.push(magnitude);
                norm += magnitude * magnitude;
            }
            const length: number = Math.sqrt(norm);
            normalized.push(length === 0 ? magnitudes.map((): number => 0) : magnitudes.map((value: number): number => value / length));
        }
        const output: Array<number> = [];
        for (let index: number = 1; index < normalized.length; index += 1) {
            const previous: Array<number> = normalized[index - 1];
            const current: Array<number> = normalized[index];
            let squared: number = 0;
            for (let bin: number = 0; bin < current.length; bin += 1) {
                const delta: number = current[bin] - previous[bin];
                squared += delta * delta;
            }
            output.push(Math.sqrt(squared));
        }
        return output;
    }

/**
 * Returns the auto-correlation of a signal up to a maximum lag.
 *
 * The raw estimate is `r[k] = sum(x[n] * x[n + k])` over the overlapping part,
 * which is what `Frame.autocorrelate` reports and what grows linearly with the
 * record length. Three normalisations are offered because the raw sum is not a
 * similarity: `"coefficient"`, the default, divides by `r[0]` so that `rho[0]` is
 * exactly one and every value lies in `[-1, 1]`, which makes profiles from
 * different lengths comparable; `"unbiased"` divides by `count - k` so that the
 * triangular taper of the raw estimate disappears, at the cost of a variance that
 * grows with the lag; `"none"` keeps the raw sums.
 *
 * A periodic component produces a peak at its own period. Because the estimator is
 * biased, that peak does not quite reach one for a finite record: a tone with a
 * period of 128 samples in a record of 1024 reaches `0.875` at lag 128 and
 * `-0.9375` at lag 64, both of which are the values the taper predicts.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param maximumLag - the largest lag to report, at most `count - 1`.
 * @param normalization - the normalisation rule.
 * @returns one value per lag from zero through `maximumLag`.
 * @throws {TypeError} if the plan, the samples or the normalisation is invalid, or
 *         the lag is not an integer.
 * @throws {RangeError} if the signal is empty, or the lag is negative or not below
 *         the signal length.
 */
export const signalAutocorrelation: (plan: Sample, values: Iterable<number>, maximumLag: number, normalization: CorrelationNormalization) => Array<number> =
    (plan: Sample, values: Iterable<number>, maximumLag: number, normalization: CorrelationNormalization): Array<number> => {
        const collected: Array<number> = collectSamples(values, "Autocorrelation signal");
        requirePlan(plan, collected.length);
        if (!isNumber(maximumLag) || !Number.isInteger(maximumLag)) {
            throw new TypeError("Autocorrelation maximum lag must be a finite integer.");
        }
        if (maximumLag < 0) {
            throw new RangeError("Autocorrelation maximum lag must not be negative.");
        }
        if (maximumLag >= collected.length) {
            throw new RangeError("Autocorrelation maximum lag must be below the signal length.");
        }
        if (!CorrelationNormalizations.includes(normalization)) {
            throw new TypeError("Autocorrelation normalisation must be none, coefficient or unbiased.");
        }
        const count: number = collected.length;
        const raw: Array<number> = [];
        for (let lag: number = 0; lag <= maximumLag; lag += 1) {
            let sum: number = 0;
            for (let index: number = 0; index + lag < count; index += 1) {
                sum += collected[index] * collected[index + lag];
            }
            raw.push(sum);
        }
        if (normalization === "none") {
            return raw;
        }
        if (normalization === "unbiased") {
            return raw.map((value: number, lag: number): number => value / (count - lag));
        }
        const reference: number = raw[0];
        if (reference === 0) {
            return raw.map((): number => 0);
        }
        return raw.map((value: number): number => value / reference);
    }

/**
 * Builds the one-sided power spectrum used by the shape descriptors.
 *
 * Every descriptor in this module reads the same quantity: the squared magnitude
 * of the raw transform over the one-sided half, with the conjugate mirror left out
 * and no doubling applied. Doubling the interior bins would be harmless for a
 * ratio of two sums, but it is not harmless for a geometric mean, where weighting
 * only the interior would bias the result against DC and Nyquist. The helper is
 * not exported because it is an implementation detail of the descriptors rather
 * than a public quantity.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param window - the analysis taper.
 * @returns the frequencies and the powers of the one-sided half.
 * @throws {TypeError} if the plan, the samples or the window is invalid.
 * @throws {RangeError} if the signal is empty or the plan does not match it.
 */
const shapeSpectrum: (plan: Sample, values: Iterable<number>, window: SpectralWindow) => { frequencies: Array<number>; powers: Array<number> } =
    (plan: Sample, values: Iterable<number>, window: SpectralWindow): { frequencies: Array<number>; powers: Array<number> } => {
        const collected: Array<number> = collectSamples(values, "Spectral shape signal");
        requirePlan(plan, collected.length);
        const taper: SpectralWindow = resolveWindow(window);
        const count: number = collected.length;
        const transform: Array<Complex> = fastFourierTransform(asComplex(windowed(collected, taper)));
        const edge: { last: number; even: boolean } = oneSidedEdge(count);
        const frequencies: Array<number> = [];
        const powers: Array<number> = [];
        for (let index: number = 0; index <= edge.last; index += 1) {
            frequencies.push(index * plan.getRate() / count);
            powers.push(transform[index].magnitude() * transform[index].magnitude());
        }
        return { frequencies: frequencies, powers: powers };
    }

/**
 * Returns the power-weighted centroid of a signal's one-sided spectrum.
 *
 * The centroid is `sum(f[k] * p[k]) / sum(p[k])` with `p[k] = |X[k]|^2`, the
 * centre of mass of the spectral power. It is the frequency that a single tone
 * would need in order to have the same first moment as the actual spectrum, so a
 * pure tone reports its own frequency and a broadband record reports the middle of
 * its band.
 *
 * The weighting is by power and the sum runs over the one-sided half only. The
 * conjugate half is symmetric, so including it would leave the ratio unchanged but
 * double the work; weighting by magnitude rather than by power would move the
 * centroid towards whatever leaks furthest, which is a different descriptor.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param window - the analysis taper.
 * @returns the centroid in hertz in an `Optional`, empty for a silent signal.
 * @throws {TypeError} if the plan, the samples or the window is invalid.
 * @throws {RangeError} if the signal is empty or the plan does not match it.
 */
export const signalSpectralCentroid: (plan: Sample, values: Iterable<number>, window: SpectralWindow) => Optional<Frequency> =
    (plan: Sample, values: Iterable<number>, window: SpectralWindow): Optional<Frequency> => {
        const shape: { frequencies: Array<number>; powers: Array<number> } = shapeSpectrum(plan, values, window);
        let weighted: number = 0;
        let total: number = 0;
        for (let index: number = 0; index < shape.powers.length; index += 1) {
            weighted += shape.frequencies[index] * shape.powers[index];
            total += shape.powers[index];
        }
        return total === 0 ? Optional.empty() : Optional.of(new Frequency(weighted / total));
    }

/**
 * Returns the power-weighted standard deviation around the spectral centroid.
 *
 * The bandwidth is `sqrt(sum((f[k] - c)^2 * p[k]) / sum(p[k]))`, the second central
 * moment of the spectral power, so it states how widely the power spreads around
 * its own centre rather than where that centre is. A pure tone reports zero up to
 * the leakage of the window and a flat band reports roughly the standard deviation
 * of a uniform distribution over that band.
 *
 * The measurement is in hertz, is never negative, and is empty for a silent
 * signal, which has no centre to spread around.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param window - the analysis taper.
 * @returns the bandwidth in hertz in an `Optional`, empty for a silent signal.
 * @throws {TypeError} if the plan, the samples or the window is invalid.
 * @throws {RangeError} if the signal is empty or the plan does not match it.
 */
export const signalSpectralBandwidth: (plan: Sample, values: Iterable<number>, window: SpectralWindow) => Optional<Frequency> =
    (plan: Sample, values: Iterable<number>, window: SpectralWindow): Optional<Frequency> => {
        const shape: { frequencies: Array<number>; powers: Array<number> } = shapeSpectrum(plan, values, window);
        let weighted: number = 0;
        let total: number = 0;
        for (let index: number = 0; index < shape.powers.length; index += 1) {
            weighted += shape.frequencies[index] * shape.powers[index];
            total += shape.powers[index];
        }
        if (total === 0) {
            return Optional.empty();
        }
        const center: number = weighted / total;
        let spread: number = 0;
        for (let index: number = 0; index < shape.powers.length; index += 1) {
            const offset: number = shape.frequencies[index] - center;
            spread += offset * offset * shape.powers[index];
        }
        return Optional.of(new Frequency(Math.sqrt(spread / total)));
    }

/**
 * Returns the frequency below which a fraction of the spectral power lies.
 *
 * The cumulative power is accumulated over the one-sided half in increasing
 * frequency order and the first bin that reaches `ratio` times the total is
 * reported, so the answer states "this much of the power is below this frequency".
 * It is a robust timbre boundary: a quiet record and a loud record with the same
 * shape give the same answer, because the ratio cancels.
 *
 * The default fraction is eighty-five percent, matching `Spectrum.rolloff`. That
 * value is an application convention rather than a theorem; the widely quoted
 * ninety-five percent belongs to a different specification family and is not
 * derivable from the definition.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param window - the analysis taper.
 * @param ratio - the cumulative fraction, within `(0, 1]`.
 * @returns the rolloff frequency in hertz in an `Optional`, empty for a silent
 *         signal.
 * @throws {TypeError} if the plan, the samples, the window or the ratio is invalid.
 * @throws {RangeError} if the ratio lies outside `(0, 1]`, or the signal is empty.
 */
export const signalSpectralRolloff: (plan: Sample, values: Iterable<number>, window: SpectralWindow, ratio: number) => Optional<Frequency> =
    (plan: Sample, values: Iterable<number>, window: SpectralWindow, ratio: number): Optional<Frequency> => {
        if (!isNumber(ratio)) {
            throw new TypeError("Spectral rolloff ratio must be a finite number.");
        }
        if (ratio <= 0 || ratio > 1) {
            throw new RangeError("Spectral rolloff ratio must be within (0, 1].");
        }
        const shape: { frequencies: Array<number>; powers: Array<number> } = shapeSpectrum(plan, values, window);
        let total: number = 0;
        for (const power of shape.powers) {
            total += power;
        }
        if (total === 0) {
            return Optional.empty();
        }
        const threshold: number = total * ratio;
        let cumulative: number = 0;
        for (let index: number = 0; index < shape.powers.length; index += 1) {
            cumulative += shape.powers[index];
            if (cumulative >= threshold) {
                return Optional.of(new Frequency(shape.frequencies[index]));
            }
        }
        return Optional.of(new Frequency(shape.frequencies[shape.frequencies.length - 1]));
    }

/**
 * Returns the spectral flatness of a signal, the geometric-to-arithmetic mean ratio
 * of the one-sided power spectrum.
 *
 * The value lies in `[0, 1]`: a flat, noise-like spectrum approaches one and a
 * tonal spectrum, whose power concentrates in a few bins, approaches zero. It is
 * the standard "how much does this spectrum look like noise" descriptor and is
 * usually quoted in decibels, which is `10 * log10` of this ratio because it
 * compares powers.
 *
 * The definition is over the **power** spectrum and over the one-sided half. An
 * amplitude version has the same monotonic relation but a different numeric value,
 * so two implementations that disagree on the convention report different tonality
 * for the same record; a two-sided traversal is worse still, because it counts the
 * same information twice. Any exactly zero bin makes the geometric mean zero, which
 * is the correct reading of a perfectly tonal record.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param window - the analysis taper.
 * @returns the flatness ratio, between zero and one.
 * @throws {TypeError} if the plan, the samples or the window is invalid.
 * @throws {RangeError} if the signal is empty or the plan does not match it.
 */
export const signalSpectralFlatness: (plan: Sample, values: Iterable<number>, window: SpectralWindow) => number =
    (plan: Sample, values: Iterable<number>, window: SpectralWindow): number => {
        const shape: { frequencies: Array<number>; powers: Array<number> } = shapeSpectrum(plan, values, window);
        const count: number = shape.powers.length;
        let arithmetic: number = 0;
        let logarithmic: number = 0;
        for (const power of shape.powers) {
            if (power === 0) {
                return 0;
            }
            arithmetic += power;
            logarithmic += Math.log(power);
        }
        if (arithmetic === 0) {
            return 0;
        }
        return Math.exp(logarithmic / count) / (arithmetic / count);
    }

/**
 * Estimates the signal-to-noise ratio in decibels from a spectral density.
 *
 * The noise floor is a quantile of the density, the median by default, which is
 * robust against the handful of bins a tonal component occupies whereas a mean
 * would be dragged up by exactly those bins. The in-band power is the integral of
 * the density over the band, the in-band noise is the floor times the band width,
 * and the estimate is `10 * log10((band - noise) / noise)`, the power convention.
 *
 * Two assumptions are baked in and are worth stating: the noise is flat across the
 * band, and the signal leaks negligibly outside it. When either fails the number is
 * an indicator, not a measurement.
 *
 * @param plan - the sampling plan of the signal.
 * @param values - the real samples, at least one.
 * @param frameSize - the segment length used by the underlying density.
 * @param hopSize - the samples between segment starts.
 * @param window - the analysis taper.
 * @param floorQuantile - the quantile used as the noise floor, within `(0, 1)`.
 * @returns the ratio in decibels in an `Optional`, empty when the band holds no
 *         power above the estimated floor.
 * @throws {TypeError} if the plan, the samples, the framing, the window or the
 *         quantile is invalid.
 * @throws {RangeError} if the framing is impossible, the quantile lies outside
 *         `(0, 1)`, or the signal is empty.
 */
export const signalSignalToNoiseRatio: (plan: Sample, values: Iterable<number>, frameSize: number, hopSize: number, window: SpectralWindow, floorQuantile: number) => Optional<number> =
    (plan: Sample, values: Iterable<number>, frameSize: number, hopSize: number, window: SpectralWindow, floorQuantile: number): Optional<number> => {
        if (!isNumber(floorQuantile)) {
            throw new TypeError("Signal-to-noise floor quantile must be a finite number.");
        }
        if (floorQuantile <= 0 || floorQuantile >= 1) {
            throw new RangeError("Signal-to-noise floor quantile must be within (0, 1).");
        }
        const density: SpectralDensity = signalPowerSpectralDensity(plan, values, frameSize, hopSize, window);
        const floor: Optional<number> = density.noiseFloor(floorQuantile);
        if (floor.isEmpty()) {
            return Optional.empty();
        }
        const step: number = density.getResolution().getHertz();
        const band: number = density.size() * step;
        const noise: number = floor.get() * band;
        if (noise <= 0) {
            return Optional.empty();
        }
        const total: number = density.totalPower();
        if (total <= noise) {
            return Optional.empty();
        }
        return Optional.of(powerDecibel(total - noise, noise));
    }

/**
 * Measures the constant-overlap-add residual of a taper in decibels.
 *
 * The overlap-add sum of a window `w` at hop `H` is `S[n] = sum(w[n - m * H])` over
 * every frame that covers sample `n`. The window satisfies the
 * constant-overlap-add condition when `S` is constant, which is what makes an
 * overlap-add reconstruction free of periodic amplitude modulation. The residual
 * here is the peak-to-peak ripple of `S` over one hop period expressed in decibels,
 * `20 * log10(max / min)`, so an exact window reports zero and a non-conforming one
 * reports a positive number.
 *
 * The periodic Hann window at fifty percent overlap is exact: its residual is zero
 * to machine precision for every length. The symmetric Hann window, whose
 * denominator is `count - 1` instead of `count`, is not, and the error is largest at
 * short frame sizes: sixteen samples ripple by 0.84 decibels, sixty-four by 0.21 and
 * one thousand and twenty-four still by 0.013. Nothing throws and nothing looks
 * wrong; the reconstruction is simply modulated, which is why analysis and
 * synthesis must use the periodic form.
 *
 * The ripple is evaluated over one hop period, because the sum is periodic in the
 * hop for any window, so a single period contains the worst case.
 *
 * @param window - the taper to measure.
 * @param count - the frame length in samples, at least one.
 * @param hopSize - the hop between frame starts, at least one.
 * @returns the peak-to-peak ripple in decibels, zero for an exact window.
 * @throws {TypeError} if the window is not callable, or the lengths are not positive
 *         integers.
 * @throws {RangeError} if a window weight is not finite, or the overlap-add sum does
 *         not stay positive and therefore has no decibel value.
 */
export const signalColaResidual: (window: SpectralWindow, count: number, hopSize: number) => number =
    (window: SpectralWindow, count: number, hopSize: number): number => {
        if (!isSpectralWindow(window)) {
            throw new TypeError("Overlap-add window must be a window function.");
        }
        if (!isNumber(count) || !Number.isInteger(count) || count < 1) {
            throw new TypeError("Overlap-add frame length must be a positive integer.");
        }
        if (!isNumber(hopSize) || !Number.isInteger(hopSize) || hopSize < 1) {
            throw new TypeError("Overlap-add hop size must be a positive integer.");
        }
        const frames: number = Math.ceil(count / hopSize) + 1;
        let smallest: number = Number.POSITIVE_INFINITY;
        let largest: number = Number.NEGATIVE_INFINITY;
        for (let position: number = 0; position < hopSize; position += 1) {
            let sum: number = 0;
            for (let frame: number = 0; frame <= frames; frame += 1) {
                const index: number = position + frame * hopSize;
                if (index < count) {
                    const weight: number = window(index, count);
                    if (!isNumber(weight)) {
                        throw new RangeError("Window function must return finite weights.");
                    }
                    sum += weight;
                }
            }
            smallest = sum < smallest ? sum : smallest;
            largest = sum > largest ? sum : largest;
        }
        if (smallest <= 0) {
            throw new RangeError("Overlap-add sum must stay positive to have a decibel value.");
        }
        return 20 * Math.log10(largest / smallest);
    }

/**
 * The signal value object.
 *
 * `SignalCollectable` is defined in `#semantic/synchronous/collectable`, beside
 * the `OrderedCollectable` class it extends. Keeping the heritage in one module
 * removes the temporal-dead-zone read that occurred when this module was reached
 * through a dependency cycle before the base class had been initialized; the class
 * is re-exported here so that the import path of this module is unchanged.
 */
export { SignalCollectable } from "#semantic/synchronous/collectable";


/**
 * Validates and copies the samples of a signal.
 *
 * The helper exists so that the constructor can validate before it calls `super`,
 * which is required because the ordered base class drains its source during
 * construction. Every sample must be a finite number, and at least one sample is
 * required, because a signal with no samples has no rate, no resolution and no
 * spectrum.
 *
 * @param values - the candidate samples, consumed once in iteration order.
 * @returns a new mutable array of the accepted samples.
 * @throws {TypeError} if the input is not iterable, or a sample is not a finite
 *         number.
 * @throws {RangeError} if the input yields no samples.
 */
export const requireSignalValues: <E extends number>(values: Iterable<E>) => Array<E> =
    <E extends number>(values: Iterable<E>): Array<E> => {
        if (!isIterable(values)) {
            throw new TypeError("Signal values must be an iterable of numbers.");
        }
        const collected: Array<E> = [];
        for (const value of values) {
            if (!isNumber(value)) {
                throw new TypeError("Signal values must be finite numbers.");
            }
            collected.push(value);
        }
        if (collected.length < 1) {
            throw new RangeError("Signal must contain at least one sample.");
        }
        return collected;
    }

/**
 * Adapts a collected sample array to the callback-based source contract.
 *
 * The ordered base class drains this generator during construction and replays the
 * resulting buffer afterwards, so the closure only needs to report each element
 * with its position. Indices are `bigint` to match the collectable layer, and the
 * interruption predicate is consulted before each element is emitted, exactly as
 * the base contract specifies.
 *
 * @param values - the samples to emit, at least one.
 * @returns a synchronous generator over the samples.
 */
export const sequenceGenerator: <E extends number>(values: ReadonlyArray<E>) => (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>) => void =
    <E extends number>(values: ReadonlyArray<E>): (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>) => void => {
        return (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            for (let index: number = 0; index < values.length; index += 1) {
                if (interrupt(values[index], BigInt(index))) {
                    break;
                }
                accept(values[index], BigInt(index));
            }
        };
    }
