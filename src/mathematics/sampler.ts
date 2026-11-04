import { isFunction, isIterable, isNumber } from "#semantic/guard";
import { Complex } from "#semantic/mathematics/complex";
import { Epicycle } from "#semantic/mathematics/epicycle";
import { Frequency } from "#semantic/mathematics/frequency";
import { continuedFraction as rationalApproximation, estimateSpectrum, selectAnalysisWindow as selectWindow } from "#semantic/mathematics/leap";
import type { ContinuedFraction, SpectralEstimate, SpectralEstimateOptions } from "#semantic/mathematics/leap";
import { Sample } from "#semantic/mathematics/sample";
import type { WaveletLevel } from "#semantic/mathematics/spectral";
import { Spectrogram } from "#semantic/mathematics/spectrogram";
import { Spectrum } from "#semantic/mathematics/spectrum";
import { Tone } from "#semantic/mathematics/tone";
import { Track } from "#semantic/mathematics/track";
import { asComplex, bluesteinTransform, directTransform, factorsFor, transform, transformAny } from "#semantic/mathematics/transform";
import { Waveform } from "#semantic/mathematics/waveform";
import { useHannWindow, windowed, type SpectralWindow } from "#semantic/mathematics/window";
import { SamplerSymbol } from "#semantic/symbol";

/**
 * A continuous source that the sampler can evaluate at a frame time.
 *
 * A source is either a signal object exposing a `value(time)` method, such as a
 * `Tone`, an `Epicycle`, a `Waveform` or a `Track`, or a plain function from a
 * time in seconds to a sample value. A `Tone` and a `Track` are already real;
 * an `Epicycle` and a `Waveform` are complex exponentials, so the sampler uses
 * their real part. Signal objects enforce their own amplitude and range
 * contracts; a function must return a finite number. Anything else is rejected
 * at the first frame rather than sampled as silence, so a mistyped source fails
 * loudly instead of yielding an all-zero spectrum.
 */
export type Samplable = Tone | Epicycle | Waveform | Track | ((time: number) => number);

/**
 * Adapts a samplable source to a function of time.
 *
 * A signal object is unwrapped through its own `value` method, so its units and
 * validations are preserved. A bare evaluator is wrapped and its result checked,
 * because a non-finite sample would otherwise propagate silently through every
 * transform that consumes the frames.
 *
 * @param source the source to adapt
 * @returns an evaluator over the source, in seconds
 * @throws {TypeError} if the source is not a recognised signal or function
 */
const evaluate: (source: Samplable) => (time: number) => number = (source: Samplable): (time: number) => number => {
    if (source instanceof Tone) {
        return (time: number): number => source.value(time);
    }
    if (source instanceof Epicycle) {
        return (time: number): number => source.value(time).getReal();
    }
    if (source instanceof Waveform) {
        return (time: number): number => source.value(time).getReal();
    }
    if (source instanceof Track) {
        return (time: number): number => source.value(time);
    }
    if (isFunction(source)) {
        return (time: number): number => {
            const value: unknown = source(time);
            if (!isNumber(value)) {
                throw new RangeError("Sampler source must return a finite value.");
            }
            return value;
        };
    }
    throw new TypeError("Sampler source must be a Tone, an Epicycle, a Waveform, a Track or an evaluator function.");
}

/**
 * Tests whether a length is an exact power of one radix.
 *
 * The length is divided by the radix while the division stays exact, so a length
 * of one counts as a power of every radix while any residual remainder means it
 * is not a power. Counts are expected to be at least one, as produced by a
 * sampling plan; a count of zero would loop indefinitely.
 *
 * @param count the candidate frame count
 * @param radix the radix to divide by
 * @returns `true` if the count is an exact power of the radix
 */
const isRadixLength: (count: number, radix: number) => boolean = (count: number, radix: number): boolean => {
    let remaining: number = count;
    while (remaining % radix === 0) {
        remaining /= radix;
    }
    return remaining === 1;
}

/**
 * The default radices of the mixed-radix transform.
 *
 * The primes two, three, five and seven dominate the smooth frame counts used
 * for audio, so a plan of such a length transforms without extra arguments. The
 * array is frozen so that one caller cannot widen the default for every later
 * call.
 */
const DefaultRadices: ReadonlyArray<number> = Object.freeze([2, 3, 5, 7]);

/**
 * Tests whether a finite number is a prime integer.
 *
 * Values below two and fractions are not prime. Even values are handled
 * separately and trial division then advances by two up to the square root, so
 * the check stays cheap for the small radices a caller is likely to supply.
 *
 * @param value the value to test
 * @returns `true` if the value is a prime integer
 */
const isPrime: (value: number) => boolean = (value: number): boolean => {
    if (value < 2 || !Number.isInteger(value)) {
        return false;
    }
    if (value % 2 === 0) {
        return value === 2;
    }
    for (let divisor: number = 3; divisor * divisor <= value; divisor += 2) {
        if (value % divisor === 0) {
            return false;
        }
    }
    return true;
}

/**
 * Validates and deduplicates the radices accepted by the mixed-radix transform.
 *
 * Every radix must be a prime integer. Duplicates are dropped while the order of
 * first occurrence is preserved, so a repeated prime cannot make the
 * factorisation ambiguous and later calls see a stable radix list.
 *
 * @param radices the candidate radices
 * @returns the distinct prime radices, in first-occurrence order
 * @throws {TypeError} if the argument is not iterable or a radix is not a prime
 *         integer
 */
const requireRadices: (radices: Iterable<number>) => Array<number> = (radices: Iterable<number>): Array<number> => {
    if (!isIterable(radices)) {
        throw new TypeError("radixN radices must be an iterable of prime numbers.");
    }
    const collected: Set<number> = new Set<number>();
    for (const radix of radices) {
        if (!isNumber(radix) || !isPrime(radix)) {
            throw new TypeError("radixN radices must be prime integers.");
        }
        collected.add(radix);
    }
    return [...collected];
}

/**
 * Factors a frame count into the supplied radices, largest first.
 *
 * Larger radices are consumed first, which matches the order in which the
 * recursive transform consumes them. A prime factor outside the supplied set is
 * reported rather than ignored, because the count could not then be transformed
 * by those radices alone.
 *
 * @param count the frame count to factorise
 * @param radices the radices permitted in the factorisation
 * @returns the factors, largest first, whose product is the count
 * @throws {RangeError} if the count has a prime factor outside the supplied
 *         radices
 */
const factorsOver: (count: number, radices: readonly number[]) => Array<number> =
    (count: number, radices: readonly number[]): Array<number> => {
        const factors: Array<number> = [];
        let remaining: number = count;
        for (const radix of [...radices].sort((left: number, right: number): number => right - left)) {
            while (remaining % radix === 0) {
                factors.push(radix);
                remaining /= radix;
            }
        }
        if (remaining !== 1) {
            throw new RangeError(`Frame count ${count} is not a product of the radices ${radices.join(", ")}.`);
        }
        return factors;
    }

/**
 * Validates and collects the parameters of a quadrature transform.
 *
 * Parameters keep the given order, since each one produces one output in the
 * same position, and duplicates are retained because repeating an exponent
 * legitimately repeats its integral.
 *
 * @param parameters the candidate real parameters
 * @param name the transform name used in error messages
 * @returns the parameters, in the given order
 * @throws {TypeError} if the argument is not iterable or a parameter is not a
 *         finite number
 */
const requireParameters: (parameters: Iterable<number>, name: string) => Array<number> =
    (parameters: Iterable<number>, name: string): Array<number> => {
        if (!isIterable(parameters)) {
            throw new TypeError(`${name} parameters must be an iterable of finite numbers.`);
        }
        const collected: Array<number> = [];
        for (const parameter of parameters) {
            if (!isNumber(parameter)) {
                throw new TypeError(`${name} parameters must be finite numbers.`);
            }
            collected.push(parameter);
        }
        return collected;
    }

/**
 * Turns a continuous source into discrete frames at the start times of a plan.
 *
 * The sampler itself is stateless: the `Sample` plan supplies the rate, the
 * frame count and the frame spacing, so one sampler can analyse any number of
 * sources without accumulating history. Frames sit at the start of each interval
 * and never at the end of the duration, which keeps every frame inside the
 * covered interval.
 *
 * Spectral methods first render the source into frames on the plan, then apply
 * one transform per call. They never mutate the plan or the source, so repeated
 * calls with equal arguments return equal results. A transform that cannot
 * handle the frame count of the plan rejects with `RangeError`; an unusable
 * source rejects with `TypeError` at its first evaluation.
 */
export class Sampler {

    /**
     * The sampling plan consulted for the rate, the frame count and the duration.
     *
     * The same object is returned by `getSample`, and its frame count fixes the
     * number of bins in every spectrum this sampler produces.
     */
    private readonly plan: Sample;
    /**
     * The registered sampler brand, read by the shared runtime guard.
     */
    protected readonly [SamplerSymbol]: symbol = SamplerSymbol;

    /**
     * Creates a sampler over an existing sampling plan.
     *
     * The plan is retained rather than copied, so the sampler describes exactly
     * the frames of that plan. The argument is checked by type, which means an
     * instance of a subclass of `Sample` is accepted as well.
     *
     * @param sample the sampling plan describing the frames
     * @throws {TypeError} if the plan is not a `Sample`
     */
    public constructor(sample: Sample) {
        if (!(sample instanceof Sample)) {
            throw new TypeError("Sampler plan must be a Sample.");
        }
        this.plan = sample;
    }

    /**
     * Creates a sampler from a rate and a duration.
     *
     * The frame count is rounded from the rate and the duration, so a rate that
     * does not divide the duration evenly still yields a whole number of frames.
     * Both arguments are validated by `Sample.useRate` before the sampler exists.
     *
     * @param rate the frame rate in frames per second
     * @param duration the covered duration in seconds
     * @returns a sampler over the derived plan
     * @throws {TypeError} if the rate or the duration is not a finite number
     * @throws {RangeError} if the rate or the duration is not positive, or the
     *         product covers less than one frame
     */
    public static useRate(rate: number, duration: number): Sampler {
        return new Sampler(Sample.useRate(rate, duration));
    }

    /**
     * Approximates a positive ratio by a continued fraction.
     *
     * The denominator limitation keeps the convergent usable as a cycle count
     * for the leap window search. The returned denominator is always positive,
     * falling back to `1` when no convergent fits.
     *
     * @param ratio the positive ratio to approximate
     * @param maximumDenominator the largest accepted denominator
     * @returns the numerator and denominator of the convergent
     * @throws {TypeError} if the ratio or the limit is not a finite number
     * @throws {RangeError} if the ratio or the limit is not positive
     */
    public static continuedFraction(ratio: number, maximumDenominator: number): ContinuedFraction {
        return rationalApproximation(ratio, maximumDenominator);
    }

    /**
     * Returns the sampling plan used by this sampler.
     *
     * The plan is the exact object supplied at construction rather than a copy,
     * so equality with the original plan holds by identity.
     *
     * @returns the sampling plan of this sampler
     */
    public getSample(): Sample {
        return this.plan;
    }

    /**
     * Chooses the integer-cycle window length that best fits a set of frequencies.
     *
     * Every frequency is approximated by a continued fraction and each multiple
     * of its denominator becomes a candidate length. A candidate is scored by the
     * weighted distance of each component from a whole number of cycles, so the
     * chosen length makes the analysed tones nearly periodic and reduces leakage.
     *
     * @param frequencies the component frequencies in hertz
     * @param weights the per-component weight; defaults to one each
     * @param minimumWindow the smallest acceptable length; defaults to max(64, count / 2)
     * @param maximumWindow the largest acceptable length; defaults to the frame count
     * @returns the length with the smallest weighted cycle distance
     * @throws {TypeError} if a frequency, weight or size is invalid
     * @throws {RangeError} if the weights do not match the frequencies
     */
    public selectAnalysisWindow(frequencies: Iterable<Frequency>, weights?: Iterable<number>, minimumWindow?: number, maximumWindow?: number): number {
        if (!isIterable(frequencies)) {
            throw new TypeError("Analysis window frequencies must be iterable.");
        }
        const hertz: Array<number> = [];
        for (const frequency of frequencies) {
            if (!(frequency instanceof Frequency)) {
                throw new TypeError("Analysis window frequencies must be Frequency values.");
            }
            hertz.push(frequency.getHertz());
        }
        let weightValues: Array<number>;
        if (weights === undefined) {
            weightValues = hertz.map((): number => 1);
        } else {
            if (!isIterable(weights)) {
                throw new TypeError("Analysis window weights must be iterable.");
            }
            weightValues = [];
            for (const weight of weights) {
                if (!isNumber(weight)) {
                    throw new TypeError("Analysis window weights must be finite numbers.");
                }
                weightValues.push(weight);
            }
        }
        const count: number = this.plan.getCount();
        const minimum: number = minimumWindow === undefined ? Math.max(64, Math.floor(count / 2)) : minimumWindow;
        const maximum: number = maximumWindow === undefined ? count : maximumWindow;
        return selectWindow(hertz, weightValues, this.plan.getRate(), minimum, maximum);
    }

    /**
     * Estimates a waveform from a source by the integer-cycle leap pipeline.
     *
     * The source is sampled on this plan, a Hann coarse spectrum supplies peak
     * frequencies, the leap search chooses an analysis length that makes those
     * frequencies nearly periodic, and each peak is refined on the residual by
     * golden-section search before being subtracted. A failed verification
     * retries with one more component and a wider Kaiser taper.
     *
     * @param source the continuous source to analyse
     * @param numberOfComponents the number of sinusoids to extract
     * @param options the taper, threshold and verification options
     * @returns the estimate, empty when the signal is too short or has no peaks
     * @throws {RangeError} if the component count is not a positive integer
     */
    public estimate(source: Samplable, numberOfComponents: number, options: SpectralEstimateOptions = {}): SpectralEstimate {
        return estimateSpectrum(this.sample(source), this.plan.getRate(), numberOfComponents, options);
    }

    /**
     * Evaluates the source at one frame of the plan.
     *
     * The frame time is the start of the frame, that is, the index divided by
     * the frame rate. The index is checked before the source is touched, so an
     * invalid index never evaluates it; the source is then evaluated exactly
     * once, so an evaluator with side effects runs once per call.
     *
     * @param source the continuous source to evaluate
     * @param index the zero-based frame index
     * @returns the sample value at the start time of that frame
     * @throws {TypeError} if the index is not a finite integer, or the source is
     *         not a recognised signal or function
     * @throws {RangeError} if the index lies outside the frame count, or a
     *         function source returns a non-finite value
     */
    public sampleAt(source: Samplable, index: number): number {
        if (!isNumber(index) || !Number.isInteger(index)) {
            throw new TypeError("Sampler index must be a finite integer.");
        }
        if (index < 0 || index >= this.plan.getCount()) {
            throw new RangeError("Sampler index must be within the frame count.");
        }
        return evaluate(source)(this.plan.getTime(index));
    }

    /**
     * Evaluates the source at every frame of the plan, in frame order.
     *
     * The result holds one entry per frame, so its length equals the frame count
     * of the plan; each entry is taken at the start of its frame and none at the
     * end of the duration. A failure on any frame aborts the call and discards
     * the frames gathered so far, so a partial plan is never returned.
     *
     * @param source the continuous source to evaluate
     * @returns the frame values, ordered from the first frame to the last
     * @throws {TypeError} if the source is not a recognised signal or function
     * @throws {RangeError} if a function source returns a non-finite value
     */
    public sample(source: Samplable): Array<number> {
        const evaluateSource: (time: number) => number = evaluate(source);
        const frames: Array<number> = [];
        for (let index: number = 0; index < this.plan.getCount(); index += 1) {
            frames.push(evaluateSource(this.plan.getTime(index)));
        }
        return frames;
    }

    /**
     * Returns a sampler over a new plan, leaving this sampler unchanged.
     *
     * The duration defaults to the duration of the current plan and the frame
     * count is rounded from the new rate, so a resampled plan covers the same
     * interval unless another duration is supplied. This sampler keeps its own
     * plan and is never modified.
     *
     * @param rate the new frame rate in frames per second
     * @param duration the new covered duration in seconds; defaults to the
     *        duration of the current plan
     * @returns a new sampler over the derived plan
     * @throws {TypeError} if the rate or the duration is not a finite number
     * @throws {RangeError} if the rate or the duration is not positive, or the
     *         product covers less than one frame
     */
    public resample(rate: number, duration?: number): Sampler {
        return new Sampler(Sample.useRate(rate, duration ?? this.plan.getDuration()));
    }

    /**
     * Transforms the frames with a pure radix-two decimation.
     *
     * The frame count of the plan must be an exact power of two; any other count
     * rejects before the source is sampled rather than being padded. The spectrum
     * holds one bin per frame, ordered by increasing frequency.
     *
     * @param source the continuous source to analyse
     * @returns the complex spectrum of the frames
     * @throws {RangeError} if the frame count is not a power of two
     * @throws {TypeError} if the source is not a recognised signal or function
     */
    public radix2(source: Samplable): Spectrum {
        return this.useRadix(source, 2);
    }

    /**
     * Transforms the frames with a pure radix-three decimation.
     *
     * The frame count of the plan must be an exact power of three; any other
     * count rejects before the source is sampled rather than being padded. The
     * spectrum holds one bin per frame, ordered by increasing frequency.
     *
     * @param source the continuous source to analyse
     * @returns the complex spectrum of the frames
     * @throws {RangeError} if the frame count is not a power of three
     * @throws {TypeError} if the source is not a recognised signal or function
     */
    public radix3(source: Samplable): Spectrum {
        return this.useRadix(source, 3);
    }

    /**
     * Transforms the frames with a pure radix-five decimation.
     *
     * The frame count of the plan must be an exact power of five; any other count
     * rejects before the source is sampled rather than being padded. The spectrum
     * holds one bin per frame, ordered by increasing frequency.
     *
     * @param source the continuous source to analyse
     * @returns the complex spectrum of the frames
     * @throws {RangeError} if the frame count is not a power of five
     * @throws {TypeError} if the source is not a recognised signal or function
     */
    public radix5(source: Samplable): Spectrum {
        return this.useRadix(source, 5);
    }

    /**
     * Transforms the frames with a pure radix-seven decimation.
     *
     * The frame count of the plan must be an exact power of seven; any other
     * count rejects before the source is sampled rather than being padded. The
     * spectrum holds one bin per frame, ordered by increasing frequency.
     *
     * @param source the continuous source to analyse
     * @returns the complex spectrum of the frames
     * @throws {RangeError} if the frame count is not a power of seven
     * @throws {TypeError} if the source is not a recognised signal or function
     */
    public radix7(source: Samplable): Spectrum {
        return this.useRadix(source, 7);
    }

    /**
     * Mixed-radix transform over the frames of the plan.
     *
     * The frame count must factor completely into the supplied prime radices. By
     * default the radices are two, three, five and seven; passing extra prime
     * factors extends the set, so a count such as eleven squared becomes
     * transformable with `radixN(source, [11])`. A radix that does not divide the
     * count is harmless, whereas a prime factor missing from the set rejects.
     *
     * @param source the continuous source to analyse
     * @param radices the prime radices the frame count may use; defaults to 2, 3, 5 and 7
     * @returns the complex spectrum of the frames
     * @throws {TypeError} if the radices are not an iterable of prime integers
     * @throws {RangeError} if the frame count has a prime factor outside the
     *         supplied radices
     */
    public radixN(source: Samplable, radices: Iterable<number> = DefaultRadices): Spectrum {
        const accepted: Array<number> = requireRadices(radices);
        const factors: Array<number> = factorsOver(this.plan.getCount(), accepted);
        return this.calculate(source, (values: readonly Complex[]): Array<Complex> => transform(values, factors));
    }

    /**
     * Bluestein transform over the frames of the plan.
     *
     * Every frame count is accepted, including prime counts with factors beyond
     * the default radices, because the convolution is padded to a power of two
     * internally. The cost is three transforms over a padded length of less than
     * four times the frame count.
     *
     * @param source the continuous source to analyse
     * @returns the complex spectrum of the frames
     * @throws {TypeError} if the source is not a recognised signal or function
     * @throws {RangeError} if a function source returns a non-finite value
     */
    public blueStein(source: Samplable): Spectrum {
        return this.calculate(source, bluesteinTransform);
    }

    /**
     * Direct discrete transform over the frames of the plan.
     *
     * Every frame count is accepted and the work grows with the square of the
     * count, so this is the reference path rather than the fast one. Prefer
     * `fastFourierTransform` for large plans; both return identical spectra up to
     * floating-point rounding.
     *
     * @param source the continuous source to analyse
     * @returns the complex spectrum of the frames
     * @throws {TypeError} if the source is not a recognised signal or function
     * @throws {RangeError} if a function source returns a non-finite value
     */
    public discreteFourierTransform(source: Samplable): Spectrum {
        return this.calculate(source, directTransform);
    }

    /**
     * Fastest available transform over the frames of the plan.
     *
     * The mixed-radix transform is used when the frame count factors into two,
     * three, five and seven, and Bluestein is used otherwise, so every count is
     * accepted. The choice depends only on the count, never on the samples, so
     * equal plans always take the same path.
     *
     * @param source the continuous source to analyse
     * @returns the complex spectrum of the frames
     * @throws {TypeError} if the source is not a recognised signal or function
     * @throws {RangeError} if a function source returns a non-finite value
     */
    public fastFourierTransform(source: Samplable): Spectrum {
        return this.calculate(source, transformAny);
    }

    /**
     * Short-time transform over overlapping frames.
     *
     * Each frame is weighted by the window, transformed, and wrapped in its own
     * plan whose count and duration are the frame size, so the frame rate of the
     * source is preserved. A frame that is not a supported radix length is
     * handled by Bluestein rather than padded.
     *
     * Frames start every `hopSize` samples and the final one starts no later than
     * the frame count minus the frame size, so trailing samples that cannot fill a
     * whole frame are dropped; a hop larger than the frame size therefore leaves
     * gaps. The frame and hop sizes are validated before the source is sampled, so
     * an invalid size never evaluates the source. At least one spectrum is
     * returned because the frame size may not exceed the frame count.
     *
     * @param source the continuous source to analyse
     * @param frameSize the number of samples per frame
     * @param hopSize the number of samples between consecutive frame starts
     * @param window the weighting applied to every frame; defaults to Hann
     * @returns one spectrum per frame, in start-time order
     * @throws {TypeError} if the frame size or the hop size is not a positive
     *         integer, or the window is unusable
     * @throws {RangeError} if the frame size exceeds the frame count of the plan
     */
    public shortTimeFourierTransform(source: Samplable, frameSize: number, hopSize: number, window: SpectralWindow = useHannWindow): Array<Spectrum> {
        if (!isNumber(frameSize) || !Number.isInteger(frameSize) || frameSize < 1) {
            throw new TypeError("Short-time frame size must be a positive integer.");
        }
        if (!isNumber(hopSize) || !Number.isInteger(hopSize) || hopSize < 1) {
            throw new TypeError("Short-time hop size must be a positive integer.");
        }
        if (frameSize > this.plan.getCount()) {
            throw new RangeError("Short-time frame size must not exceed the frame count.");
        }
        const frames: Array<number> = this.sample(source);
        const framePlan: Sample = new Sample(frameSize, frameSize / this.plan.getRate());
        const output: Array<Spectrum> = [];
        for (let start: number = 0; start + frameSize <= frames.length; start += hopSize) {
            const frame: Array<number> = windowed(frames.slice(start, start + frameSize), window);
            output.push(new Spectrum(framePlan, transformAny(asComplex(frame))));
        }
        return output;
    }

    /**
     * Short-time transform wrapped in a time-frequency view.
     *
     * The columns are exactly the spectra of `shortTimeFourierTransform`, and the
     * view retains the hop and the window so that it can report frame times and
     * invert itself. The window must be the one the columns were analysed with,
     * which is why it is a parameter rather than being recovered from a spectrum.
     *
     * @param source the continuous source to analyse
     * @param frameSize the number of samples per frame
     * @param hopSize the number of samples between consecutive frame starts
     * @param window the weighting applied to every frame; defaults to Hann
     * @returns the time-frequency view of the source
     * @throws {TypeError} if the frame size or the hop size is not a positive integer
     * @throws {RangeError} if the frame size exceeds the frame count of the plan
     */
    public spectrogram(source: Samplable, frameSize: number, hopSize: number, window: SpectralWindow = useHannWindow): Spectrogram {
        return new Spectrogram(this.shortTimeFourierTransform(source, frameSize, hopSize, window), hopSize, window);
    }

    /**
     * Orthonormal Haar decomposition of the frames of the plan.
     *
     * The frame count must be a power of two. Each level averages and differences
     * adjacent samples by one over the square root of two; the approximation of a
     * level feeds the next one, and the detail array holds the coefficients that
     * the averaging discards. Halving continues to a single sample, so the full
     * depth is the base-two logarithm of the frame count.
     *
     * Levels are returned in decomposition order, so the first level carries the
     * finest detail band and the last the coarsest approximation; both arrays of a
     * level are half the length of that level's input and are frozen. Validation
     * precedes the first level: the frame count is checked first, then the
     * requested depth, so a count that is not a power of two reports the frame
     * count rather than the depth.
     *
     * @param source the continuous source to analyse
     * @param levels the number of decomposition levels; defaults to the full depth
     * @returns one level per decomposition step, in decomposition order
     * @throws {RangeError} if the frame count is not a power of two, or the level
     *         count exceeds the power-of-two depth
     * @throws {TypeError} if the level count is not a positive integer
     */
    public waveletTransform(source: Samplable, levels?: number): Array<WaveletLevel> {
        const frames: Array<number> = this.sample(source);
        if (!isRadixLength(frames.length, 2)) {
            throw new RangeError("waveletTransform requires a power-of-two frame count.");
        }
        const maximum: number = Math.round(Math.log2(frames.length));
        const depth: number = levels === undefined ? maximum : levels;
        if (!isNumber(depth) || !Number.isInteger(depth) || depth < 1) {
            throw new TypeError("Wavelet level count must be a positive integer.");
        }
        if (depth > maximum) {
            throw new RangeError("Wavelet level count must not exceed the power-of-two depth.");
        }
        let approximation: Array<number> = frames.slice();
        const output: Array<WaveletLevel> = [];
        for (let level: number = 0; level < depth; level += 1) {
            const next: Array<number> = [];
            const detail: Array<number> = [];
            for (let index: number = 0; index < approximation.length; index += 2) {
                next.push((approximation[index] + approximation[index + 1]) / Math.SQRT2);
                detail.push((approximation[index] - approximation[index + 1]) / Math.SQRT2);
            }
            output.push(Object.freeze({ approximation: Object.freeze(next), detail: Object.freeze(detail) }));
            approximation = next;
        }
        return output;
    }

    /**
     * Mellin transform at real parameters, that is, the integral of
     * `f(t) * t^(s-1)` over the plan duration.
     *
     * Parameters must be at least one so that the kernel stays finite at the
     * origin. The integral uses the trapezoid rule over the sampled times and
     * includes one evaluation at the exact plan duration, which closes the final
     * trapezium. The result is purely real, so each imaginary part is zero.
     *
     * @param source the continuous source to integrate
     * @param parameters the real exponents to evaluate
     * @returns one complex value per parameter, in the given order
     * @throws {TypeError} if the parameters are not an iterable of finite numbers
     * @throws {RangeError} if a parameter is below one, or a kernel value is not
     *         finite
     */
    public meilinTransform(source: Samplable, parameters: Iterable<number>): Array<Complex> {
        return this.quadrature(source, parameters, "Mellin", 1,
            (time: number, parameter: number): number => Math.pow(time, parameter - 1));
    }

    /**
     * Laplace transform at real parameters, that is, the integral of
     * `f(t) * exp(-s * t)` over the plan duration.
     *
     * Parameters are unconstrained, since the exponential kernel is finite for
     * every finite rate; a large rate merely decays faster. The integral uses the
     * trapezoid rule over the sampled times and includes one evaluation at the
     * exact plan duration, which closes the final trapezium. The result is purely
     * real, so each imaginary part is zero.
     *
     * @param source the continuous source to integrate
     * @param parameters the real rates to evaluate
     * @returns one complex value per parameter, in the given order
     * @throws {TypeError} if the parameters are not an iterable of finite numbers
     * @throws {RangeError} if a kernel value is not finite
     */
    public laplacianTransform(source: Samplable, parameters: Iterable<number>): Array<Complex> {
        return this.quadrature(source, parameters, "Laplace", undefined,
            (time: number, parameter: number): number => Math.exp(-parameter * time));
    }

    /**
     * Transforms the frames with one radix and wraps the result in a spectrum.
     *
     * The frame count is checked against the radix before the source is sampled,
     * so an unsupported count rejects without evaluating the source.
     *
     * @param source the continuous source to analyse
     * @param radix the radix whose power the frame count must be
     * @returns the complex spectrum of the frames
     * @throws {RangeError} if the frame count is not a power of the radix
     */
    private useRadix(source: Samplable, radix: number): Spectrum {
        const count: number = this.plan.getCount();
        if (!isRadixLength(count, radix)) {
            throw new RangeError(`radix${radix} requires a frame count that is a power of ${radix}.`);
        }
        return this.calculate(source, (values: readonly Complex[]): Array<Complex> => transform(values, factorsFor(count)));
    }

    /**
     * Samples the source and applies one transform to the complex frames.
     *
     * The plan is reused for the resulting spectrum, so its bins can be converted
     * back into frequencies without further arguments. The transform runs only
     * once the whole sample array exists, so a sampling failure yields no
     * spectrum at all.
     *
     * @param source the continuous source to analyse
     * @param change the transform applied to the complex frames
     * @returns the spectrum of the transformed frames
     */
    private calculate(source: Samplable, change: (values: readonly Complex[]) => Array<Complex>): Spectrum {
        const amplitudes: Array<Complex> = change(asComplex(this.sample(source)));
        return new Spectrum(this.plan, amplitudes);
    }

    /**
     * Integrates the source against one kernel over the plan duration.
     *
     * The sampled frames supply the interior times and one extra evaluation is
     * appended at the exact duration, giving closed trapezoids up to the end. Each
     * parameter is checked against the minimum when its turn comes, after the
     * source has been sampled once for all parameters, and both kernel values of a
     * trapezium are checked for finiteness before the area is accumulated.
     *
     * @param source the continuous source to integrate
     * @param parameters the real parameters to evaluate
     * @param name the transform name used in error messages
     * @param minimum the smallest permitted parameter, or `undefined` for no bound
     * @param kernel the real kernel evaluated at a time and a parameter
     * @returns one complex value per parameter, in the given order
     * @throws {RangeError} if a parameter is below the minimum, or a kernel value
     *         is not finite
     */
    private quadrature(
        source: Samplable,
        parameters: Iterable<number>,
        name: string,
        minimum: number | undefined,
        kernel: (time: number, parameter: number) => number,
    ): Array<Complex> {
        const collected: Array<number> = requireParameters(parameters, name);
        const values: Array<number> = this.sample(source);
        const times: Array<number> = [];
        for (let index: number = 0; index < values.length; index += 1) {
            times.push(this.plan.getTime(index));
        }
        const duration: number = this.plan.getDuration();
        values.push(evaluate(source)(duration));
        times.push(duration);
        const output: Array<Complex> = [];
        for (const parameter of collected) {
            if (minimum !== undefined && parameter < minimum) {
                throw new RangeError(`${name} parameters must be at least ${minimum}.`);
            }
            let total: number = 0;
            for (let index: number = 1; index < values.length; index += 1) {
                const left: number = values[index - 1] * kernel(times[index - 1], parameter);
                const right: number = values[index] * kernel(times[index], parameter);
                if (!isNumber(left) || !isNumber(right)) {
                    throw new RangeError(`${name} kernel must stay finite over the sampled interval.`);
                }
                total += (left + right) * (times[index] - times[index - 1]) / 2;
            }
            output.push(new Complex(total, 0));
        }
        return output;
    }

    /**
     * Renders the sampling plan of this sampler.
     *
     * The text names the plan rather than a source, because a sampler holds no
     * source of its own.
     *
     * @returns a description of the form `Sampler(plan)`
     */
    public toString(): string {
        return `Sampler(${this.plan})`;
    }
}

export { isSampler } from "#semantic/guard";
