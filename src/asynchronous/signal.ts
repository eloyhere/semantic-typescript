/**
 * Window-aware spectral analysis for a real-valued signal.
 *
 * This module is the facade and the numeric home of the asynchronous signal API:
 * it defines the `signal*` helpers and the value class
 * {@link AsynchronousSignalCollectable}. The 23 `useAsynchronous*` collector
 * factories that the class delegates to live in
 * `#semantic/asynchronous/collectors/signal`; this module imports them for the
 * class methods and re-exports them so that the public surface of
 * `#semantic/asynchronous/signal` is unchanged.
 *
 * The two modules form an import cycle by construction: the factories call the
 * helpers defined here, and the class methods call the factories. The cycle is
 * safe because every cross-module use is deferred to a closure — the factories
 * read the helpers only inside their finishers, and the class reads the
 * factories only inside its method bodies. The factory module also declares its
 * binder state with `var` and its binder function as a declaration, so the bind
 * call at the end of this module is safe even when the factory module is the
 * entry point and this module is evaluated during its import phase. First-import
 * of either module therefore succeeds without a temporal-dead-zone error.
 *
 * The numeric specification, including the 16 traps and the normalisation
 * conventions, is documented beside each helper below. `SpectralDensity` is
 * defined once in `#semantic/synchronous/signal` and re-exported here so that
 * both families report the same value object.
 *
 * @module
 */

import {
    coherentGain,
    equivalentNoiseBandwidth,
    isSpectralWindow,
    useHannPeriodicWindow,
    useRectangularWindow,
    windowed
} from "#semantic/mathematics/window";
import { amplitudeDecibel, powerDecibel } from "#semantic/mathematics/bin";
import { analyticSignal, instantaneousAmplitude, instantaneousPhase, unwrapPhase } from "#semantic/mathematics/analytic";
import { asComplex } from "#semantic/mathematics/transform";
import { fastFourierTransform } from "#semantic/mathematics/spectral";
import { Frame } from "#semantic/mathematics/frame";
import { Frequency } from "#semantic/mathematics/frequency";
import { Sampler } from "#semantic/mathematics/sampler";
import { Sample } from "#semantic/mathematics/sample";
import { Spectrogram } from "#semantic/mathematics/spectrogram";
import { Spectrum } from "#semantic/mathematics/spectrum";
import { isBigInt, isIterable, isNumber } from "#semantic/guard";
import { Optional } from "#semantic/optional";
import { SpectralDensity } from "#semantic/synchronous/signal";
import { AsynchronousOrderedCollectable } from "#semantic/asynchronous/collectable";
import {
    bindSignalCollectableFactory,
    useAsynchronousAmplitude,
    useAsynchronousAnalyticSignal,
    useAsynchronousAutocorrelation,
    useAsynchronousBlueStein,
    useAsynchronousDecibel,
    useAsynchronousDetrended,
    useAsynchronousDiscreteFourierTransform,
    useAsynchronousEnvelope,
    useAsynchronousFastFourierTransform,
    useAsynchronousInstantaneousFrequency,
    useAsynchronousInstantaneousPhase,
    useAsynchronousLaplacianTransform,
    useAsynchronousMeilinTransform,
    useAsynchronousOneSided,
    useAsynchronousPower,
    useAsynchronousPowerDecibel,
    useAsynchronousPowerSpectralDensity,
    useAsynchronousRadix2,
    useAsynchronousRadix3,
    useAsynchronousRadix5,
    useAsynchronousRadix7,
    useAsynchronousShortTimeFourierTransform,
    useAsynchronousSignalToNoiseRatio,
    useAsynchronousSpectralBandwidth,
    useAsynchronousSpectralCentroid,
    useAsynchronousSpectralFlatness,
    useAsynchronousSpectralFlux,
    useAsynchronousSpectralRolloff,
    useAsynchronousSpectrogram,
    useAsynchronousSpectrum,
    useAsynchronousWaveletTransform,
    useAsynchronousWindowed,
    useAsynchronousZeroCrossingRate
} from "#semantic/asynchronous/collectors/signal";
import type { Angle } from "#semantic/mathematics/angle";
import type { Bin } from "#semantic/mathematics/bin";
import type { Complex } from "#semantic/mathematics/complex";
import type { Samplable } from "#semantic/mathematics/sampler";
import type { WaveletLevel } from "#semantic/mathematics/spectral";
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
 * The power spectral density value object.
 *
 * `SpectralDensity` is defined in `#semantic/synchronous/signal`: a density is
 * arithmetic over a finite sample, so the synchronous and the asynchronous module
 * must report the same class rather than two structurally identical copies. The
 * class is re-exported here so that the import path of this module is unchanged.
 */
export { SpectralDensity } from "#semantic/synchronous/signal";

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
 * The ordered base class starts draining this generator during construction and
 * replays the resulting buffer once it settles, so the closure only needs to
 * report each element with its position. Indices are `bigint` to match the
 * collectable layer, and the interruption predicate is consulted before each
 * element is emitted, exactly as the base contract specifies. The generator is
 * asynchronous because the base contract of this family is, even though the
 * emission itself is immediate.
 *
 * @param values - the samples to emit, at least one.
 * @returns an asynchronous generator over the samples.
 */
export const sequenceGenerator: <E extends number>(values: ReadonlyArray<E>) => (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>) => Promise<void> =
    <E extends number>(values: ReadonlyArray<E>): (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>) => Promise<void> => {
        return async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            for (let index: number = 0; index < values.length; index += 1) {
                if (interrupt(values[index], BigInt(index))) {
                    break;
                }
                accept(values[index], BigInt(index));
            }
        };
    }

/**
 * A real-valued signal bound to its sampling plan and its analysis window.
 *
 * The class is a thin, ordered collectable over the samples that also carries the
 * two pieces of context every spectral formula needs: the sampling rate, which
 * turns bin indices into hertz, and the taper, which decides both the coherent gain
 * and the equivalent noise bandwidth. Keeping them on the value object is the whole
 * point — a caller who has to remember "divide by the coherent gain" will
 * eventually forget, and the resulting 6.02 decibel error looks like a plausible
 * measurement.
 *
 * Two conventions are fixed and documented because they are the ones that cause
 * silent errors elsewhere in the wild:
 *
 * - A *one-sided* fold keeps DC and Nyquist un-doubled. They are self-conjugate and
 *   have no mirror partner, so doubling them invents energy.
 * - A *peak* power is not a *density*. `power()` reports the mean square a sinusoid
 *   on that bin would have, and sums to the equivalent noise bandwidth times the
 *   mean square; `powerSpectralDensity()` reports a density and integrates to the
 *   mean square itself.
 *
 * Every analysis method delegates to exactly one `useAsynchronous<Method>` factory
 * from `#semantic/asynchronous/collectors/signal`, and the factory owns the
 * accumulation.
 * The constructor-time metadata accessors only read the frozen state of the
 * instance in constant time and therefore have no strategy to select.
 *
 * Complexity: construction buffers and sorts O(n) samples; every analysis method
 * documents its own bound and is at least O(n).
 *
 * @template E - The element type, constrained to `number` so that the spectral
 *               formulas are total.
 */
export class AsynchronousSignalCollectable<E extends number> extends AsynchronousOrderedCollectable<E> {

    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "AsynchronousSignalCollectable";
    /**
     * The sampling plan that fixes the rate and the covered duration.
     */
    private readonly plan: Sample;
    /**
     * The samples, in acquisition order and frozen after construction.
     */
    private readonly values: ReadonlyArray<E>;
    /**
     * The taper applied by every spectral method that does not override it.
     */
    private readonly taper: SpectralWindow;
    /**
     * The coherent gain of `taper` at this length, recomputed per instance.
     */
    private readonly coherent: number;
    /**
     * The equivalent noise bandwidth of `taper` at this length, in bins.
     */
    private readonly bandwidth: number;

    /**
     * Buffers a value sequence under a sampling plan and an analysis window.
     *
     * The samples are copied and validated before the ordered buffer is built, so a
     * rejected sample leaves no partially constructed instance behind. The coherent
     * gain and the equivalent noise bandwidth of the window are computed once, at
     * this exact length, and reused by every later call; recomputing them per call
     * would be correct but would also invite the assumption that they are constants,
     * which they are not.
     *
     * @param plan - the sampling plan; its frame count must equal the sample count.
     * @param values - the samples, at least one, every one a finite number.
     * @param window - the analysis taper; defaults to the periodic Hann window.
     * @throws {TypeError} if the plan is not a `Sample`, a sample is not a finite
     *         number, or the window is not callable.
     * @throws {RangeError} if the samples are empty, their count differs from the
     *         plan's frame count, or the window weights sum to zero.
     */
    public constructor(plan: Sample, values: Iterable<E>, window?: SpectralWindow) {
        const collected: Array<E> = requireSignalValues<E>(values);
        super(sequenceGenerator<E>(collected));
        if (!(plan instanceof Sample)) {
            throw new TypeError("Signal plan must be a Sample.");
        }
        if (plan.getCount() !== collected.length) {
            throw new RangeError("Signal plan frame count must match the signal length.");
        }
        const taper: SpectralWindow = resolveWindow(window);
        this.plan = plan;
        this.values = Object.freeze(collected);
        this.taper = taper;
        this.coherent = coherentGain(taper, collected.length);
        this.bandwidth = equivalentNoiseBandwidth(taper, collected.length);
    }

    /**
     * Creates a signal from samples and a sampling rate.
     *
     * The covered duration is derived as `count / rate`, so the plan's last sample
     * starts one sampling interval before the end. At least one sample is required,
     * and the rate is validated before the samples are read, so an invalid rate is
     * reported without consuming the source.
     *
     * @param values - the samples, at least one.
     * @param rate - the sampling rate in hertz, positive and finite.
     * @param window - the analysis taper; defaults to the periodic Hann window.
     * @returns a new signal over the samples.
     * @throws {TypeError} if the rate is not a finite number, a sample is not finite,
     *         or the window is not callable.
     * @throws {RangeError} if the rate is not positive, the samples are empty, or the
     *         window weights sum to zero.
     */
    public static useRate<E extends number>(values: Iterable<E>, rate: number, window?: SpectralWindow): AsynchronousSignalCollectable<E> {
        if (!isNumber(rate)) {
            throw new TypeError("Signal rate must be a finite number.");
        }
        if (rate <= 0) {
            throw new RangeError("Signal rate must be positive.");
        }
        const collected: Array<E> = requireSignalValues<E>(values);
        return new AsynchronousSignalCollectable<E>(new Sample(collected.length, collected.length / rate), collected, window);
    }

    /**
     * Creates a signal from an existing frame.
     *
     * The frame contributes both its samples and its sampling plan, so the rate and
     * the covered duration are preserved exactly. The frame itself is not modified.
     *
     * @param frame - the frame to reinterpret as a signal, holding at least one
     *        sample.
     * @param window - the analysis taper; defaults to the periodic Hann window.
     * @returns a new signal over the frame's samples.
     * @throws {TypeError} if the argument is not a `Frame`, or the window is not
     *         callable.
     * @throws {RangeError} if the window weights sum to zero.
     */
    public static useFrame(frame: Frame, window?: SpectralWindow): AsynchronousSignalCollectable<number> {
        if (!(frame instanceof Frame)) {
            throw new TypeError("Signal frame must be a Frame.");
        }
        return new AsynchronousSignalCollectable<number>(frame.getSample(), frame.getValues(), window);
    }

    /**
     * Returns the sampling plan of this signal.
     *
     * @returns the retained plan, not a copy.
     */
    public getSample(): Sample {
        return this.plan;
    }

    /**
     * Returns the samples in acquisition order.
     *
     * @returns the frozen sample array, whose length equals `size()`.
     */
    public getValues(): ReadonlyArray<E> {
        return this.values;
    }

    /**
     * Returns the analysis window configured for this signal.
     *
     * @returns the taper applied by default.
     */
    public getWindow(): SpectralWindow {
        return this.taper;
    }

    /**
     * Returns the coherent gain of the configured window at this length.
     *
     * The value is `sum(w) / count`, the factor by which a sinusoid's spectral line
     * is scaled by the taper. It is recomputed for this instance rather than assumed,
     * because a symmetric window deviates from its closed-form value at short lengths
     * and a custom window has no closed form at all.
     *
     * @returns the mean window weight, dimensionless.
     */
    public getCoherentGain(): number {
        return this.coherent;
    }

    /**
     * Returns the equivalent noise bandwidth of the configured window, in bins.
     *
     * The value is `count * sum(w^2) / sum(w)^2`, the width of the rectangular window
     * that would admit the same white-noise power. It is what a sum of
     * peak-convention bin powers exceeds the mean square by.
     *
     * @returns the noise bandwidth in bins, dimensionless and at least one.
     */
    public getNoiseBandwidth(): number {
        return this.bandwidth;
    }

    /**
     * Returns the number of samples.
     *
     * @returns the sample count as a `bigint`, matching the collectable layer.
     */
    public size(): bigint {
        return BigInt(this.values.length);
    }

    /**
     * Returns one sample by index.
     *
     * The index must be a `bigint` but need not lie inside the signal: a negative
     * index or one at or beyond `size()` yields an empty `Optional` rather than an
     * exception.
     *
     * @param index - the zero-based sample index.
     * @returns the sample in an `Optional`.
     * @throws {TypeError} if the index is not a `bigint`.
     */
    public at(index: bigint): Optional<E> {
        if (!isBigInt(index)) {
            throw new TypeError("Signal index must be a bigint.");
        }
        if (index < 0n || index >= BigInt(this.values.length)) {
            return Optional.empty();
        }
        return Optional.of(this.values[Number(index)]);
    }

    /**
     * Returns the sampling rate in hertz.
     *
     * @returns the rate that converts a bin index into a frequency.
     */
    public getRate(): number {
        return this.plan.getRate();
    }

    /**
     * Returns the Nyquist frequency, half the sampling rate.
     *
     * @returns the highest frequency a one-sided spectrum can describe.
     */
    public getNyquist(): Frequency {
        return new Frequency(this.plan.getRate() / 2);
    }

    /**
     * Returns the spacing between adjacent transform bins.
     *
     * The value is `rate / count`, the grid resolution. It is not the resolving
     * power: two components closer than about one bin of a rectangular window, or
     * one and a half bins of a Hann window, remain merged no matter how the transform
     * is padded.
     *
     * @returns the bin spacing in hertz.
     */
    public getResolution(): Frequency {
        return new Frequency(this.plan.getRate() / this.values.length);
    }

    /**
     * Converts this signal to a plain frame over the same plan.
     *
     * The frame copies the samples, so mutating the returned frame's source array
     * cannot affect this signal; the two objects share only the immutable plan.
     *
     * @returns a new frame holding the same samples under the same plan.
     */
    public toFrame(): Frame {
        return new Frame(this.plan, this.values);
    }

    /**
     * Compares this signal with another value by value.
     *
     * Two signals are equal when their plans match and every sample agrees within the
     * tolerance. The window is compared by identity, because two distinct window
     * functions are not comparable without evaluating them.
     *
     * @param other - the signal to compare with.
     * @param epsilon - the absolute tolerance applied to the samples, and `1E-9` by
     *        default.
     * @returns whether the two signals are indistinguishable.
     * @throws {TypeError} if the argument is not a `AsynchronousSignalCollectable`, or the
     *         tolerance is not a finite number.
     * @throws {RangeError} if the tolerance is negative.
     */
    public equals(other: AsynchronousSignalCollectable<E>, epsilon: number = Tolerance): boolean {
        if (!(other instanceof AsynchronousSignalCollectable)) {
            throw new TypeError("Signal comparison requires a AsynchronousSignalCollectable.");
        }
        if (!isNumber(epsilon)) {
            throw new TypeError("Signal tolerance must be a finite number.");
        }
        if (epsilon < 0) {
            throw new RangeError("Signal tolerance must not be negative.");
        }
        if (!this.plan.equals(other.plan) || this.taper !== other.taper) {
            return false;
        }
        if (this.values.length !== other.values.length) {
            return false;
        }
        for (let index: number = 0; index < this.values.length; index += 1) {
            if (Math.abs(this.values[index] - other.values[index]) > epsilon) {
                return false;
            }
        }
        return true;
    }

    /**
     * Returns a short, stable description of this signal.
     *
     * @returns a description naming the sample count, the rate and the window.
     */
    public toString(): string {
        const label: string = this.taper === useHannPeriodicWindow ? "hann-periodic" : this.taper === useRectangularWindow ? "rectangular" : "custom";
        return `AsynchronousSignalCollectable(size=${this.values.length}, rate=${this.plan.getRate()}, window=${label})`;
    }

    /**
     * Removes a trend from this signal and returns the result as a new signal.
     *
     * A constant offset leaks into the low bins of a windowed transform and a drift
     * smears the whole low band, so both are usually removed before a density
     * estimate. `"constant"` subtracts the mean and `"linear"` subtracts the
     * least-squares line; `"none"` is the identity. The plan, the rate and the window
     * are preserved, so the result is the same signal with different samples.
     *
     * @param mode - the trend to remove; defaults to `"constant"`.
     * @returns a new signal over the detrended samples, typed over `number`
     *          because a detrended sample is an arbitrary real value rather than
     *          a member of a narrower numeric domain.
     * @throws {TypeError} if the mode is not one of the three supported names.
     */
    public async detrended(mode: DetrendMode = "constant"): Promise<AsynchronousSignalCollectable<number>> {
        return await useAsynchronousDetrended<E>(this.plan, this.taper, mode).collect(this.source());
    }

    /**
     * Weights every sample by a window and returns the result as a new signal.
     *
     * The window becomes the analysis window of the result as well, so a later
     * spectral call does not apply it a second time unless it is asked to. Passing a
     * different window re-tapers an already tapered signal, which is occasionally
     * what a cross-fade wants and is otherwise a mistake worth making explicit.
     *
     * @param window - the taper to apply; defaults to the window of this signal.
     * @returns a new signal over the weighted samples, typed over `number`
     *          because a weight is an arbitrary real value.
     * @throws {TypeError} if the window is not callable.
     * @throws {RangeError} if a window weight is not finite.
     */
    public async windowed(window?: SpectralWindow): Promise<AsynchronousSignalCollectable<number>> {
        return await useAsynchronousWindowed<E>(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the complex spectrum of this signal.
     *
     * The signal is tapered, optionally zero-padded and then transformed, so the
     * coefficients are raw and unnormalised: their magnitude grows with the transform
     * length and with the window. Use `amplitude()` or `power()` for calibrated
     * values, and `oneSided()` for the folded view.
     *
     * The returned `Spectrum` keeps the full complex grid, because its constructor
     * derives each bin frequency from the bin position over the plan's frame count: a
     * one-sided fold has half as many bins and would report every frequency at twice
     * its true value. The fold itself is available through {@link oneSided}, which is
     * the only place the DC and Nyquist rule is applied.
     *
     * Padding does not improve resolution. A transform length above the sample count
     * samples the same windowed DTFT more densely, which sharpens the peak *location*
     * and turns `rate / size` into the bin spacing; the ability to separate two
     * components stays governed by the window length and shape. Two equal tones `0.4`
     * bins apart stay merged at any padding: with a 256-point record and a Hann
     * window, padding to 8192 produces two local maxima whose dip is only 0.79
     * decibels, far too shallow to call them resolved.
     *
     * @param size - the transform length in samples, at least the sample count;
     *        defaults to the sample count, which means no padding.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the spectrum over `size` bins.
     * @throws {TypeError} if the length is not a `bigint` or does not fit a safe
     *         integer, or the window is not callable.
     * @throws {RangeError} if the length is below the sample count, which would
     *         truncate the observation.
     */
    public async spectrum(size?: bigint, window?: SpectralWindow): Promise<Spectrum> {
        const length: bigint = size === undefined ? BigInt(this.values.length) : size;
        return await useAsynchronousSpectrum(this.plan, requireCount(length, "Spectrum transform length"), window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the one-sided bins of this signal, with DC and Nyquist un-doubled.
     *
     * A real signal satisfies `X[count - k] = conj(X[k])`, so the negative frequencies
     * carry no independent information and are folded onto the positive half by
     * doubling every interior bin. The constant bin and, for an even length, the
     * Nyquist bin are self-conjugate: they are their own mirror, so doubling them
     * would report four instead of two at DC for `2 + cos(PI * n)` and two instead of
     * one at Nyquist, exactly 6.02 decibels too high in each case. Those two bins are
     * therefore kept exactly as the transform produced them.
     *
     * The returned amplitudes are still raw, so the doubling is a fold and not a
     * calibration; use `amplitude()` for calibrated values.
     *
     * @param size - the transform length in samples, at least the sample count;
     *        defaults to the sample count.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the bins from zero hertz through the top of the lower half.
     * @throws {TypeError} if the length or the window is invalid.
     * @throws {RangeError} if the length would truncate the signal.
     */
    public async oneSided(size?: bigint, window?: SpectralWindow): Promise<Array<Bin>> {
        const length: bigint = size === undefined ? BigInt(this.values.length) : size;
        return await useAsynchronousOneSided(this.plan, requireCount(length, "Spectrum transform length"), window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the calibrated one-sided amplitudes of this signal.
     *
     * The estimate is `2 * |X[k]| / (count * CG)` for an interior bin and
     * `|X[k]| / (count * CG)` for DC and Nyquist. Both corrections matter: an interior
     * tone at unit amplitude reads `0.5` without the factor of two and `0.5` again
     * without the gain correction, so omitting either reports minus 6.02 decibels.
     * The gain itself is never assumed to be one half; it is recomputed from the
     * actual window vector.
     *
     * The value is a narrow-band measurement. A broadband noise floor has no
     * amplitude, and its level belongs in `powerSpectralDensity()`.
     *
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns one amplitude per one-sided bin, in units of the samples.
     * @throws {TypeError} if the window is not callable.
     * @throws {RangeError} if the window weights sum to zero.
     */
    public async amplitude(window?: SpectralWindow): Promise<Array<number>> {
        return await useAsynchronousAmplitude(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the one-sided power of this signal, with DC and Nyquist un-doubled.
     *
     * An interior bin reports `A[k]^2 / 2`, the mean square of a sinusoid of
     * amplitude `A[k]`, and DC or Nyquist report `A[k]^2` because they do not
     * oscillate. This is the peak convention: each bin answers "what mean square
     * would a tone on this bin have". It is not the Parseval convention — a window
     * spreads each line over its main lobe, so summing every bin over-counts by the
     * equivalent noise bandwidth, which is 1.5 for Hann — and the total power
     * question belongs to `powerSpectralDensity()`.
     *
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns one power per one-sided bin, in squared units of the samples.
     * @throws {TypeError} if the window is not callable.
     * @throws {RangeError} if the window weights sum to zero.
     */
    public async power(window?: SpectralWindow): Promise<Array<number>> {
        return await useAsynchronousPower(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the amplitude levels of the one-sided bins in decibels.
     *
     * The conversion is `20 * log10(amplitude)`, the amplitude convention. It is
     * correct for an amplitude, a voltage, a displacement or a sound pressure, and
     * wrong for a power or a density: quartering a power is minus 6.02 decibels but
     * reads minus 12.04 under this convention. Use {@link powerDecibel} for those. A
     * silent bin reports negative infinity.
     *
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns one level per one-sided bin, in decibels relative to one.
     * @throws {TypeError} if the window is not callable.
     * @throws {RangeError} if the window weights sum to zero.
     */
    public async decibel(window?: SpectralWindow): Promise<Array<number>> {
        return await useAsynchronousDecibel(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the power levels of the one-sided bins in decibels.
     *
     * The conversion is `10 * log10(power)`, the power convention, and it is the only
     * correct choice for a power, an energy, a mean square or a density. The two
     * conventions agree only through the square relation between their quantities, so
     * a power of one quarter reports minus 6.02 decibels here and would report minus
     * 12.04 under {@link decibel}. A silent bin reports negative infinity.
     *
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns one level per one-sided bin, in decibels relative to one.
     * @throws {TypeError} if the window is not callable.
     * @throws {RangeError} if the window weights sum to zero.
     */
    public async powerDecibel(window?: SpectralWindow): Promise<Array<number>> {
        return await useAsynchronousPowerDecibel(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Estimates the one-sided power spectral density of this signal by Welch's
     * method.
     *
     * The record is cut into overlapping segments, each segment is detrended,
     * weighted and transformed, and the periodograms are averaged. The normalisation
     * is `|X|^2 / (rate * sum(w^2))` with the interior bins doubled and DC and
     * Nyquist not, which is the only divisor that keeps a white-noise floor unbiased:
     * dividing by the segment length reads `0.375` for unit noise instead of `1.0`,
     * and dividing by `count * CG^2` reads `1.5`.
     *
     * Averaging is what makes the estimate usable. A single periodogram is unbiased
     * but inconsistent — its variance does not shrink as the record grows — so `M`
     * segments buy roughly `1 / M` of the variance at the cost of a coarser
     * resolution, because each segment is `M` times shorter. An estimate reporting a
     * single segment is therefore valid but noisy, and the segment count is part of
     * the result rather than a hidden detail.
     *
     * @param frameSize - the segment length in samples; defaults to the smaller of
     *        256 and the sample count.
     * @param hopSize - the samples between segment starts; defaults to half a segment,
     *        rounded down.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the averaged one-sided density.
     * @throws {TypeError} if a length is not a `bigint` or does not fit a safe
     *         integer, or the window is not callable.
     * @throws {RangeError} if the segment exceeds the signal, the hop exceeds the
     *         segment, or the window weights are all zero.
     */
    public async powerSpectralDensity(frameSize?: bigint, hopSize?: bigint, window?: SpectralWindow): Promise<SpectralDensity> {
        const length: number = this.values.length;
        const segment: bigint = frameSize === undefined ? BigInt(Math.min(DefaultFrameSize, length)) : frameSize;
        const resolved: number = requireCount(segment, "Density segment length");
        const rawHop: bigint = hopSize === undefined ? BigInt(Math.max(1, Math.floor(resolved / 2))) : hopSize;
        const step: number = requireCount(rawHop, "Density hop size");
        return await useAsynchronousPowerSpectralDensity(this.plan, resolved, step, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the short-time Fourier transform of this signal.
     *
     * The signal is extended by half a frame at each end and padded at the tail, so
     * the first frame is centred on the first sample, the last frame reaches the last
     * sample and no sample is lost. Retaining only complete frames instead discards up
     * to `frameSize - 1` samples: for 1000 samples with a frame of 256 and a hop of
     * 128 that is 232 samples, nearly a quarter of the record.
     *
     * Frame centres lie at `m * hopSize / rate` seconds on the original axis, which is
     * the convention `Spectrogram.getTime` reports. Every column is a raw `Spectrum`
     * over `frameSize` bins, exactly as `spectrum()` would produce for the same frame.
     *
     * @param frameSize - the frame length in samples, at most the sample count.
     * @param hopSize - the samples between frame starts, at most the frame length.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns one spectrum per frame, in centre-time order.
     * @throws {TypeError} if a length is not a `bigint` or does not fit a safe
     *         integer, or the window is not callable.
     * @throws {RangeError} if the frame exceeds the signal, the hop exceeds the frame,
     *         or the framing yields no frame.
     */
    public async shortTimeFourierTransform(frameSize: bigint, hopSize: bigint, window?: SpectralWindow): Promise<Array<Spectrum>> {
        const size: number = requireCount(frameSize, "Short-time frame size");
        const step: number = requireCount(hopSize, "Short-time hop size");
        return await useAsynchronousShortTimeFourierTransform(this.plan, size, step, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the time-frequency view of this signal.
     *
     * The columns are exactly the spectra of `shortTimeFourierTransform` with the same
     * framing, and the view retains the hop, the taper and the zero boundary so that
     * it can report frame centre times and trim the extension when it rebuilds a
     * frame. The default taper is the periodic Hann window, which satisfies the
     * constant-overlap-add condition at fifty percent overlap; the symmetric form of
     * the same window does not, and ripples by 0.84 decibels at sixteen samples, 0.21
     * at sixty-four and 0.013 at one thousand and twenty-four. That difference never
     * raises an error, it only modulates the reconstruction.
     *
     * @param frameSize - the frame length in samples, at most the sample count.
     * @param hopSize - the samples between frame starts, at most the frame length.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the time-frequency view of this signal.
     * @throws {TypeError} if a length or the window is invalid.
     * @throws {RangeError} if the framed columns cannot be built.
     */
    public async spectrogram(frameSize: bigint, hopSize: bigint, window?: SpectralWindow): Promise<Spectrogram> {
        const size: number = requireCount(frameSize, "Spectrogram frame size");
        const step: number = requireCount(hopSize, "Spectrogram hop size");
        return await useAsynchronousSpectrogram(this.plan, size, step, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the spectrum of this signal through the Sampler's radix-two path.
     *
     * The samples are presented to `Sampler.radix2` as a time-continuous source
     * over this signal's plan, so the transform runs entirely in the mathematics
     * module. The plan's frame count must be a power of two.
     *
     * @returns the complex spectrum of the signal.
     * @throws {RangeError} if the frame count is not a power of two.
     */
    public async radix2(): Promise<Spectrum> {
        return await useAsynchronousRadix2(new Sampler(this.plan)).collect(this.samplables());
    }

    /**
     * Returns the spectrum of this signal through the Sampler's radix-three path.
     *
     * The plan's frame count must be a power of three.
     *
     * @returns the complex spectrum of the signal.
     * @throws {RangeError} if the frame count is not a power of three.
     */
    public async radix3(): Promise<Spectrum> {
        return await useAsynchronousRadix3(new Sampler(this.plan)).collect(this.samplables());
    }

    /**
     * Returns the spectrum of this signal through the Sampler's radix-five path.
     *
     * The plan's frame count must be a power of five.
     *
     * @returns the complex spectrum of the signal.
     * @throws {RangeError} if the frame count is not a power of five.
     */
    public async radix5(): Promise<Spectrum> {
        return await useAsynchronousRadix5(new Sampler(this.plan)).collect(this.samplables());
    }

    /**
     * Returns the spectrum of this signal through the Sampler's radix-seven path.
     *
     * The plan's frame count must be a power of seven.
     *
     * @returns the complex spectrum of the signal.
     * @throws {RangeError} if the frame count is not a power of seven.
     */
    public async radix7(): Promise<Spectrum> {
        return await useAsynchronousRadix7(new Sampler(this.plan)).collect(this.samplables());
    }

    /**
     * Returns the spectrum of this signal through the Sampler's Bluestein path.
     *
     * Every frame count is accepted; the convolution is padded internally.
     *
     * @returns the complex spectrum of the signal.
     */
    public async blueStein(): Promise<Spectrum> {
        return await useAsynchronousBlueStein(new Sampler(this.plan)).collect(this.samplables());
    }

    /**
     * Returns the spectrum of this signal through the direct discrete transform.
     *
     * The direct path is the quadratic reference implementation; prefer
     * {@link fastFourierTransform} for large signals.
     *
     * @returns the complex spectrum of the signal.
     */
    public async discreteFourierTransform(): Promise<Spectrum> {
        return await useAsynchronousDiscreteFourierTransform(new Sampler(this.plan)).collect(this.samplables());
    }

    /**
     * Returns the spectrum of this signal through the fastest available path.
     *
     * The Sampler selects mixed-radix or Bluestein from the frame count.
     *
     * @returns the complex spectrum of the signal.
     */
    public async fastFourierTransform(): Promise<Spectrum> {
        return await useAsynchronousFastFourierTransform(new Sampler(this.plan)).collect(this.samplables());
    }

    /**
     * Returns the wavelet decomposition of this signal.
     *
     * The plan's frame count must be a power of two.
     *
     * @param levels - the number of decomposition levels, defaulting to the maximum.
     * @returns one level per decomposition step.
     * @throws {RangeError} if the frame count or the level count is invalid.
     */
    public async waveletTransform(levels?: number): Promise<Array<WaveletLevel>> {
        return await useAsynchronousWaveletTransform(new Sampler(this.plan), levels).collect(this.samplables());
    }

    /**
     * Returns the Laplacian transform of this signal.
     *
     * @param parameters - the real parameters of the transform.
     * @returns one complex value per parameter.
     * @throws {RangeError} if a parameter is outside the transform's domain.
     */
    public async laplacianTransform(parameters: Iterable<number>): Promise<Array<Complex>> {
        return await useAsynchronousLaplacianTransform(new Sampler(this.plan), parameters).collect(this.samplables());
    }

    /**
     * Returns the Mellin transform of this signal.
     *
     * @param parameters - the real parameters of the transform.
     * @returns one complex value per parameter.
     * @throws {RangeError} if a parameter is outside the transform's domain.
     */
    public async meilinTransform(parameters: Iterable<number>): Promise<Array<Complex>> {
        return await useAsynchronousMeilinTransform(new Sampler(this.plan), parameters).collect(this.samplables());
    }

    /**
     * Adapts the buffered samples to the time-continuous source contract.
     *
     * The sampler evaluates the source at `index / rate`, so rounding recovers
     * the index exactly. A probe at the plan's duration, which the quadrature
     * transforms append, clamps to the last observed sample because the signal
     * holds no value beyond its record.
     *
     * @returns a source that reads this signal's samples by time.
     */
    private samplable(): Samplable {
        const rate: number = this.plan.getRate();
        const values: ReadonlyArray<E> = this.values;
        return (time: number): number => {
            const index: number = Math.round(time * rate);
            return values[Math.max(0, Math.min(values.length - 1, index))];
        };
    }

    /**
     * Wraps the signal's source descriptor in an asynchronous iterable.
     *
     * @returns an asynchronous generator over the single source descriptor.
     */
    private async *samplables(): AsyncGenerator<Samplable> {
        yield this.samplable();
    }

    /**
     * Returns the analytic signal of this signal.
     *
     * The negative-frequency half of the transform is cleared and the positive half is
     * doubled, so the inverse yields `x[n] + i * H(x)[n]`. The real part recovers the
     * samples and the modulus is the envelope; the argument is the instantaneous
     * phase. Because the transform is circular, the first and last samples of a record
     * whose period does not divide its length are contaminated by the wrap-around: a
     * tone of 8.3 cycles over 512 samples has a middle envelope within 0.2 percent of
     * the truth and last-eight-sample errors of up to 87 percent. Mirror-pad before
     * analysis or discard the ends.
     *
     * @returns one analytic sample per input sample, in order.
     */
    public async analyticSignal(): Promise<Array<Complex>> {
        return await useAsynchronousAnalyticSignal(this.plan).collect(this.source());
    }

    /**
     * Returns the instantaneous phase of this signal in radians.
     *
     * Each analytic sample is mapped to its argument, normalised into `[0, 2 * PI)`.
     * The phase is folded into one turn, so it jumps by a full turn once per cycle;
     * the instantaneous frequency below unwraps it before differentiating.
     *
     * @returns one radian phase per sample.
     */
    public async instantaneousPhase(): Promise<Array<Angle>> {
        return await useAsynchronousInstantaneousPhase(this.plan).collect(this.source());
    }

    /**
     * Returns the instantaneous envelope of this signal.
     *
     * The envelope is `|z[n]|`, which is a constant `A` for `A * cos(w * t + p)`. It
     * inherits the circular edge behaviour of the Hilbert transform, so the two ends of
     * a non-integer-periodic record are the least trustworthy samples.
     *
     * @returns one non-negative amplitude per sample, in units of the samples.
     */
    public async envelope(): Promise<Array<number>> {
        return await useAsynchronousEnvelope(this.plan).collect(this.source());
    }

    /**
     * Returns the instantaneous frequency of this signal in hertz.
     *
     * The unwrapped analytic phase is differentiated by a forward difference and
     * scaled by `rate / (2 * PI)`. The first sample has no predecessor and reports
     * zero.
     *
     * The envelope gate is not optional in practice. Where the envelope vanishes the
     * phase is undefined and the difference of two rounding-noise angles can reach
     * half a turn, which reads as half the sampling rate: two equal tones at 100 and
     * 102 hertz sampled at 2048 hertz drop to an envelope of `1.2e-14` at their beat
     * nodes and report 932 hertz out of a possible 1024. Every sample whose envelope,
     * or whose predecessor's envelope, falls below `gate` times the peak therefore
     * reports zero instead of that artefact.
     *
     * @param rate - the sampling rate in hertz used to scale the phase step; defaults
     *        to the rate of this signal.
     * @param gate - the envelope threshold as a fraction of the peak envelope, within
     *        `[0, 1]`; defaults to `1E-3`.
     * @returns one frequency in hertz per sample, whose first entry is zero.
     * @throws {TypeError} if the rate or the gate is not a finite number.
     * @throws {RangeError} if the rate is not positive, or the gate lies outside
     *         `[0, 1]`.
     */
    public async instantaneousFrequency(rate?: number, gate?: number): Promise<Array<number>> {
        const resolved: number = rate === undefined ? this.plan.getRate() : rate;
        const threshold: number = gate === undefined ? DefaultEnvelopeGate : gate;
        return await useAsynchronousInstantaneousFrequency(this.plan, resolved, threshold).collect(this.source());
    }

    /**
     * Returns the zero-crossing rate of this signal.
     *
     * The rate is the fraction of adjacent sample pairs with strictly opposite signs,
     * that is the crossing count divided by `count - 1`. A sine of `f` hertz sampled
     * at `rate` hertz reads `2 * f / rate`, and a signal that alternates on every
     * sample reads one, the maximum. The absolute difference of the sign function that
     * some texts use counts two per crossing and must be halved before dividing, which
     * is the same quantity; this module reports the crossing count rather than twice
     * it.
     *
     * This is a rate, not a count. `Frame.zeroCrossings` returns an integer, which
     * cannot be compared across record lengths.
     *
     * @param perSecond - whether to report crossings per second rather than per sample;
     *        defaults to `false`.
     * @returns the zero-crossing rate, zero for a one-sample signal.
     * @throws {TypeError} if the flag is not a boolean.
     */
    public async zeroCrossingRate(perSecond: boolean = false): Promise<number> {
        return await useAsynchronousZeroCrossingRate(this.plan, perSecond).collect(this.source());
    }

    /**
     * Returns the spectral flux of this signal, one value per frame transition.
     *
     * Each frame's one-sided magnitude spectrum is scaled to unit Euclidean norm and
     * compared with the previous frame by the Euclidean distance of the two normalised
     * vectors. Normalising first makes the value a statement about spectral shape
     * rather than loudness: two frames of different level but the same spectrum
     * produce zero flux. The result holds `frames - 1` values and is empty when the
     * framing yields a single frame.
     *
     * @param frameSize - the frame length in samples; defaults to the smaller of 256
     *        and the sample count.
     * @param hopSize - the samples between frame starts; defaults to half a frame.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns one flux value per adjacent frame pair, in frame order.
     * @throws {TypeError} if a length or the window is invalid.
     * @throws {RangeError} if the framed columns cannot be built.
     */
    public async spectralFlux(frameSize?: bigint, hopSize?: bigint, window?: SpectralWindow): Promise<Array<number>> {
        const length: number = this.values.length;
        const segment: bigint = frameSize === undefined ? BigInt(Math.min(DefaultFrameSize, length)) : frameSize;
        const resolved: number = requireCount(segment, "Spectral flux frame size");
        const rawHop: bigint = hopSize === undefined ? BigInt(Math.max(1, Math.floor(resolved / 2))) : hopSize;
        const step: number = requireCount(rawHop, "Spectral flux hop size");
        return await useAsynchronousSpectralFlux(this.plan, resolved, step, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the normalised auto-correlation of this signal.
     *
     * The raw estimate `r[k] = sum(x[n] * x[n + k])` grows linearly with the record
     * length, so comparing two lengths by the raw peak is meaningless: the same tone
     * in a record twice as long reports a peak twice as large. The default
     * normalisation therefore divides by `r[0]`, which makes `rho[0]` exactly one and
     * every value lie in `[-1, 1]`. The `"unbiased"` rule divides by `count - k`
     * instead, removing the triangular taper at the cost of a variance that grows with
     * the lag. A periodic component peaks at its own period; the biased peak is
     * slightly below one, so a tone of period 128 in a record of 1024 reads `0.875` at
     * lag 128 and `-0.9375` at lag 64.
     *
     * @param maximumLag - the largest lag to report, at most `size - 1`; defaults to
     *        `size - 1`.
     * @param normalization - the normalisation rule; defaults to `"coefficient"`.
     * @returns one value per lag from zero through `maximumLag`.
     * @throws {TypeError} if the lag is not a `bigint` or the rule is not a supported
     *         name.
     * @throws {RangeError} if the lag is negative or not below the sample count.
     */
    public async autocorrelation(maximumLag?: bigint, normalization: CorrelationNormalization = "coefficient"): Promise<Array<number>> {
        const limit: bigint = maximumLag === undefined ? BigInt(this.values.length - 1) : maximumLag;
        if (!isBigInt(limit)) {
            throw new TypeError("Autocorrelation maximum lag must be a bigint.");
        }
        if (limit < 0n) {
            throw new RangeError("Autocorrelation maximum lag must not be negative.");
        }
        if (limit >= BigInt(this.values.length)) {
            throw new RangeError("Autocorrelation maximum lag must be below the signal length.");
        }
        if (limit > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new TypeError("Autocorrelation maximum lag must fit a safe integer.");
        }
        return await useAsynchronousAutocorrelation(this.plan, Number(limit), normalization).collect(this.source());
    }

    /**
     * Returns the power-weighted centroid of the one-sided spectrum in hertz.
     *
     * The centroid is `sum(f[k] * p[k]) / sum(p[k])` with `p[k] = |X[k]|^2`, the centre
     * of mass of the spectral power. A pure tone reports its own frequency; a
     * broadband record reports the middle of its band. The value is empty for a silent
     * signal, which has no centre of mass.
     *
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the centroid in hertz in an `Optional`.
     * @throws {TypeError} if the window is not callable.
     */
    public async spectralCentroid(window?: SpectralWindow): Promise<Optional<Frequency>> {
        return await useAsynchronousSpectralCentroid(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the power-weighted spectral bandwidth in hertz.
     *
     * The value is the standard deviation of the power distribution around the
     * centroid, so a pure tone reports approximately zero and a flat band reports
     * roughly the standard deviation of a uniform distribution over it. It is empty for
     * a silent signal.
     *
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the bandwidth in hertz in an `Optional`.
     * @throws {TypeError} if the window is not callable.
     */
    public async spectralBandwidth(window?: SpectralWindow): Promise<Optional<Frequency>> {
        return await useAsynchronousSpectralBandwidth(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the frequency below which a fraction of the spectral power lies.
     *
     * The cumulative power over the one-sided half is accumulated in increasing
     * frequency order and the first bin that reaches `ratio` of the total is reported.
     * The default is eighty-five percent, matching `Spectrum.rolloff`; the value is an
     * application convention rather than a theorem. The result is empty for a silent
     * signal.
     *
     * @param ratio - the cumulative fraction, within `(0, 1]`; defaults to `0.85`.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the rolloff frequency in hertz in an `Optional`.
     * @throws {TypeError} if the ratio or the window is invalid.
     * @throws {RangeError} if the ratio lies outside `(0, 1]`.
     */
    public async spectralRolloff(ratio: number = DefaultRolloffRatio, window?: SpectralWindow): Promise<Optional<Frequency>> {
        return await useAsynchronousSpectralRolloff(this.plan, window ?? this.taper, ratio).collect(this.source());
    }

    /**
     * Returns the spectral flatness of this signal.
     *
     * The value is the ratio of the geometric mean to the arithmetic mean of the
     * one-sided **power** spectrum, so it approaches one for a flat, noise-like record
     * and zero for a tonal one. The definition is over power and over the one-sided
     * half: an amplitude version has a different numeric value, and a two-sided
     * traversal counts the same information twice. Any exactly zero bin makes the value
     * zero, which is the correct reading of a perfectly tonal record. The ratio is
     * usually quoted in decibels, which is `10 * log10` of this value because it
     * compares powers.
     *
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the flatness ratio, between zero and one.
     * @throws {TypeError} if the window is not callable.
     */
    public async spectralFlatness(window?: SpectralWindow): Promise<number> {
        return await useAsynchronousSpectralFlatness(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Estimates the signal-to-noise ratio of this signal in decibels.
     *
     * The noise floor is the median of the density, which is robust against the few
     * bins a tone occupies where a mean would be dragged up by them. The in-band power
     * is the integral of the density, the in-band noise is the floor times the band
     * width, and the estimate is `10 * log10((band - noise) / noise)`. Both the
     * flat-noise and the negligible-out-of-band-leakage assumptions are stated because
     * the number is an indicator when either fails.
     *
     * @param frameSize - the segment length used by the density; defaults to the
     *        smaller of 256 and the sample count.
     * @param hopSize - the samples between segment starts; defaults to half a segment.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @param floorQuantile - the quantile used as the noise floor, within `(0, 1)`;
     *        defaults to the median.
     * @returns the ratio in decibels in an `Optional`, empty when the band holds no
     *         power above the estimated floor.
     * @throws {TypeError} if a length, the window or the quantile is invalid.
     * @throws {RangeError} if the framing is impossible, or the quantile lies outside
     *         `(0, 1)`.
     */
    public async signalToNoiseRatio(frameSize?: bigint, hopSize?: bigint, window?: SpectralWindow, floorQuantile: number = 0.5): Promise<Optional<number>> {
        const length: number = this.values.length;
        const segment: bigint = frameSize === undefined ? BigInt(Math.min(DefaultFrameSize, length)) : frameSize;
        const resolved: number = requireCount(segment, "Density segment length");
        const rawHop: bigint = hopSize === undefined ? BigInt(Math.max(1, Math.floor(resolved / 2))) : hopSize;
        const step: number = requireCount(rawHop, "Density hop size");
        return await useAsynchronousSignalToNoiseRatio(this.plan, resolved, step, window ?? this.taper, floorQuantile).collect(this.source());
    }
}

/*
 * ---------------------------------------------------------------------------
 * Public re-exports: collector factories
 * ---------------------------------------------------------------------------
 *
 * The factory layer is the single definition site of every collector factory.
 * Re-exporting them here, name for name, keeps the public import path
 * `#semantic/asynchronous/signal` unchanged.
 */
export {
    useAsynchronousAmplitude,
    useAsynchronousAnalyticSignal,
    useAsynchronousAutocorrelation,
    useAsynchronousDecibel,
    useAsynchronousDetrended,
    useAsynchronousEnvelope,
    useAsynchronousInstantaneousFrequency,
    useAsynchronousInstantaneousPhase,
    useAsynchronousOneSided,
    useAsynchronousPower,
    useAsynchronousPowerDecibel,
    useAsynchronousPowerSpectralDensity,
    useAsynchronousShortTimeFourierTransform,
    useAsynchronousSignalToNoiseRatio,
    useAsynchronousSpectralBandwidth,
    useAsynchronousSpectralCentroid,
    useAsynchronousSpectralFlatness,
    useAsynchronousSpectralFlux,
    useAsynchronousSpectralRolloff,
    useAsynchronousSpectrogram,
    useAsynchronousSpectrum,
    useAsynchronousWindowed,
    useAsynchronousZeroCrossingRate
} from "#semantic/asynchronous/collectors/signal";

/*
 * ---------------------------------------------------------------------------
 * Constructor binding
 * ---------------------------------------------------------------------------
 *
 * The class and its `AsynchronousOrderedCollectable` base are fully evaluated at
 * this point. The factory module declares the binder state with `var` and the
 * binder function as a declaration, so this call also succeeds when the factory
 * module is the first import and this module is evaluated inside its import
 * phase.
 */
bindSignalCollectableFactory({
    create: (plan, values, window) => new AsynchronousSignalCollectable<number>(plan, values, window)
});
