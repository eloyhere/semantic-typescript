import { isIterable, isNumber } from "#semantic/guard";
import { Complex } from "#semantic/mathematics/complex";
import { Frequency } from "#semantic/mathematics/frequency";
import { Sample } from "#semantic/mathematics/sample";
import { directTransform, inverseAny, transformAny } from "#semantic/mathematics/transform";

/**
 * One Haar decomposition level.
 *
 * `approximation` holds the coarse coefficients of this level, each of which
 * becomes one sample of the next level; `detail` holds the matching wavelet
 * coefficients. Both arrays have half the length of the input to the level, and
 * the producing decomposition freezes the arrays together with the record, so a
 * level is a read-only snapshot of one decomposition step.
 *
 * A level stores no plan or sample rate of its own, so its coefficients are
 * meaningful only in the order and scale of the decomposition that produced
 * them.
 */
export interface WaveletLevel {
    /**
     * The coarse coefficients of this level.
     *
     * Each value is the average of one adjacent pair of the level's input, scaled
     * by one over the square root of two, so the array is the approximation that
     * the next level decomposes. Its length is half that of the level's input and
     * matches `detail`, and the producing decomposition freezes it.
     */
    readonly approximation: ReadonlyArray<number>;
    /**
     * The detail coefficients of this level.
     *
     * Each value is the difference of one adjacent pair of the level's input,
     * scaled by one over the square root of two, so the array holds the
     * information that the next level discards. Its length is half that of the
     * level's input and matches `approximation`, and the producing decomposition
     * freezes it.
     */
    readonly detail: ReadonlyArray<number>;
}

/**
 * The radices that the mixed-radix transform can factorise.
 *
 * A frame count is fast exactly when all of its prime factors appear here, so
 * this set also defines the values accepted by `isFastLength`. The array is
 * frozen to keep that classification stable for every caller.
 */
const FastRadices: ReadonlyArray<number> = Object.freeze([2, 3, 5, 7]);

/**
 * Tests whether a value is a positive integer usable as a length.
 *
 * The value must be finite, whole and at least one, which excludes zero,
 * negative integers and non-numbers. This is the guard shared by every length in
 * this module, so the same boundary applies to padding, factoring and length
 * rounding.
 *
 * @param value the value to inspect
 * @returns `true` if the value is a positive integer
 */
const isLength: (value: unknown) => value is number = (value: unknown): value is number =>
    isNumber(value) && Number.isInteger(value) && value >= 1;

/**
 * Returns the prime factors of a positive integer in ascending order.
 *
 * Trial division starts at two and continues only while the divisor squared does
 * not exceed the remainder, so the cost grows with the square root of the count.
 * A repeated factor is emitted once per occurrence, which means the result
 * multiplies back to the count; a count of one has no factors and yields an empty
 * array.
 *
 * The call has no side effects: the argument is a primitive, and the returned
 * array is freshly allocated, so a caller may modify it without affecting later
 * calls.
 *
 * @param count the frame count to factorise, a positive integer
 * @returns the prime factors in ascending order, empty for a count of one
 * @throws {TypeError} if the value is not a finite positive integer, which
 *         rejects zero, negatives, fractions, `NaN` and both infinities
 */
export const factorize: (count: number) => Array<number> = (count: number): Array<number> => {
    if (!isLength(count)) {
        throw new TypeError("Factorization count must be a positive integer.");
    }
    const factors: Array<number> = [];
    let remaining: number = count;
    for (let divisor: number = 2; divisor * divisor <= remaining; divisor += 1) {
        while (remaining % divisor === 0) {
            factors.push(divisor);
            remaining /= divisor;
        }
    }
    if (remaining > 1) {
        factors.push(remaining);
    }
    return factors;
}

/**
 * Tests whether a frame count is a product of the supported radices.
 *
 * The count is factorised and every prime factor is compared with the fast
 * radices, so the answer is exact rather than an estimate. A count of one is fast
 * because it has no factors at all, and every other count must be a positive
 * integer, because factorisation rejects anything else. The count is classified
 * exactly as given: no padding, rounding or caching is applied.
 *
 * @param count the frame count to inspect, a positive integer
 * @returns `true` if every prime factor is two, three, five or seven, which
 *          includes a count of one
 * @throws {TypeError} if the value is not a finite positive integer
 */
export const isFastLength: (count: number) => boolean = (count: number): boolean =>
    factorize(count).every((factor: number): boolean => FastRadices.includes(factor));

/**
 * Returns the smallest supported length at least as large as the given count.
 *
 * A count that is already supported is returned unchanged. Larger counts are
 * reached by incrementing and re-testing, which is exhaustive from the given
 * count upwards, so no supported length is skipped; a power of two is always
 * supported and lies within twice the count. The scan advances numerically, so
 * it relies on the successor of the candidate being a distinct value, which holds
 * throughout the safe-integer range but not for every larger double.
 *
 * @param count the requested minimum frame count, a positive integer
 * @returns the smallest length whose prime factors are two, three, five or
 *          seven, never less than the count
 * @throws {TypeError} if the count is not a finite positive integer
 */
export const nextFastLength: (count: number) => number = (count: number): number => {
    if (!isLength(count)) {
        throw new TypeError("Fast length must be a positive integer.");
    }
    let candidate: number = count;
    while (!isFastLength(candidate)) {
        candidate += 1;
    }
    return candidate;
}

/**
 * Appends zero samples until the frame reaches the requested length.
 *
 * A frame that is already long enough is returned as a new array, never the
 * original, so a caller may modify the result without disturbing the input. The
 * input is drained in iteration order and every sample must be finite, so a frame
 * of any iterable provenance can be padded; nothing is truncated, and a length
 * below the frame length rejects instead of dropping samples. An empty frame is
 * valid and produces an array of zeros.
 *
 * The length is validated first, then every sample is collected, and only then is
 * truncation rejected, so an invalid length reports before an invalid sample.
 *
 * @param values the frame to pad, in sample order; every sample must be a finite
 *        number
 * @param length the requested frame length in samples, at least the frame length
 * @returns a new, mutable frame of exactly the requested length, with zeros
 *          appended
 * @throws {TypeError} if the length is not a positive integer, the input is not
 *         iterable, or a sample is not a finite number
 * @throws {RangeError} if the length is shorter than the frame
 */
export const zeroPad: (values: Iterable<number>, length: number) => Array<number> =
    (values: Iterable<number>, length: number): Array<number> => {
        if (!isLength(length)) {
            throw new TypeError("Zero padding length must be a positive integer.");
        }
        const frame: Array<number> = [];
        for (const value of values) {
            if (!isNumber(value)) {
                throw new TypeError("Zero padded samples must be finite numbers.");
            }
            frame.push(value);
        }
        if (length < frame.length) {
            throw new RangeError("Zero padding length must not truncate the frame.");
        }
        while (frame.length < length) {
            frame.push(0);
        }
        return frame;
    }

/**
 * Returns the frequency denoted by one bin of a sampling plan.
 *
 * The bins of a spectrum divide the frame rate evenly, so bin `k` denotes
 * `k * rate / count` hertz and bin zero is the constant component. The index must
 * be a non-negative integer but need not lie inside the plan: an index at or
 * beyond the frame count yields a frequency at or above the frame rate rather
 * than wrapping. This lets a caller compute the frequency of a bin outside the
 * analysed plan without a separate range check.
 *
 * The call has no side effects: the plan is immutable and only read, and the
 * result is a new `Frequency`.
 *
 * @param plan the sampling plan that produced the spectrum; must be a `Sample`
 *        instance
 * @param index the zero-based bin index, a finite non-negative integer
 * @returns the bin frequency in hertz
 * @throws {TypeError} if the plan is not a `Sample` instance, the index is not a
 *         finite non-negative integer, or the computed frequency overflows to a
 *         non-finite value
 */
export const binFrequency: (plan: Sample, index: number) => Frequency = (plan: Sample, index: number): Frequency => {
    if (!(plan instanceof Sample)) {
        throw new TypeError("Bin frequency plan must be a Sample.");
    }
    if (!isNumber(index) || !Number.isInteger(index) || index < 0) {
        throw new TypeError("Bin index must be a non-negative integer.");
    }
    return new Frequency(index * plan.getRate() / plan.getCount());
}

/**
 * Reconstructs complex frames from a set of transform coefficients.
 *
 * The inverse sums `A[k] * exp(+i * 2*PI * k * n / count)` over every bin and
 * divides by the count, which is the convention that pairs with the raw forward
 * transforms of `Sampler`. Twiddle factors are tabulated once, so the cost is
 * quadratic in the bin count but independent of trigonometric calls. The result
 * has the same length as the coefficient sequence, and a conjugate-symmetric
 * input produces a numerically real frame whose imaginary parts stay near zero.
 *
 * The coefficients are read into a new array before any arithmetic, so the input
 * is not modified, and every returned frame is a new `Complex` value. A count of
 * one is legal and returns one frame equal in value to the single coefficient.
 *
 * @param amplitudes the transform coefficients in bin order, at least one; every
 *        coefficient must be a `Complex`
 * @returns the reconstructed complex frames in sample order, with one frame per
 *          coefficient
 * @throws {TypeError} if the input is not iterable, a coefficient is not a
 *         `Complex`, or an intermediate sum overflows to a non-finite component
 * @throws {RangeError} if the sequence is empty
 */
export const inverseDiscreteFourierTransform: (amplitudes: Iterable<Complex>) => Array<Complex> =
    (amplitudes: Iterable<Complex>): Array<Complex> => {
        if (!isIterable(amplitudes)) {
            throw new TypeError("Inverse transform amplitudes must be iterable.");
        }
        const bins: Array<Complex> = [];
        for (const amplitude of amplitudes) {
            if (!(amplitude instanceof Complex)) {
                throw new TypeError("Inverse transform amplitudes must be Complex values.");
            }
            bins.push(amplitude);
        }
        const count: number = bins.length;
        if (count < 1) {
            throw new RangeError("Inverse transform requires at least one bin.");
        }
        const twiddles: Array<Complex> = [];
        for (let index: number = 0; index < count; index += 1) {
            const angle: number = 2 * Math.PI * index / count;
            twiddles.push(new Complex(Math.cos(angle), Math.sin(angle)));
        }
        const output: Array<Complex> = [];
        for (let sample: number = 0; sample < count; sample += 1) {
            let sum: Complex = new Complex(0, 0);
            for (let bin: number = 0; bin < count; bin += 1) {
                sum = sum.plus(bins[bin].multiply(twiddles[(bin * sample) % count]));
            }
            output.push(sum.divide(count));
        }
        return output;
    }

/**
 * Collects complex frames from an iterable, validating every element.
 *
 * The elements are drained in iteration order into a fresh array, so the caller's
 * iterable can be reused or modified afterwards without affecting the result. An
 * empty iterable is rejected because every transform needs at least one frame,
 * and an invalid element is reported as soon as it is reached.
 *
 * @param values the candidate frames, at least one
 * @param name the transform name used in error messages
 * @returns the frames in iteration order, as a new mutable array
 * @throws {TypeError} if the input is not iterable or a frame is not a `Complex`
 * @throws {RangeError} if the sequence is empty
 */
const requireComplexFrames: (values: Iterable<Complex>, name: string) => Array<Complex> =
    (values: Iterable<Complex>, name: string): Array<Complex> => {
        if (!isIterable(values)) {
            throw new TypeError(`${name} frames must be iterable.`);
        }
        const frames: Array<Complex> = [];
        for (const frame of values) {
            if (!(frame instanceof Complex)) {
                throw new TypeError(`${name} frames must be Complex values.`);
            }
            frames.push(frame);
        }
        if (frames.length < 1) {
            throw new RangeError(`${name} requires at least one frame.`);
        }
        return frames;
    }

/**
 * Direct forward transform of complex frames, valid for every frame count.
 *
 * The input may already hold an imaginary part, so the result is not assumed to
 * be conjugate-symmetric. This is the reference path; `fastFourierTransform`
 * returns the same values at a lower cost for most counts. The transform is
 * unnormalised, so each bin is the raw sum over the frames, without division by
 * the frame count; pair it with `inverseDiscreteFourierTransform`, which divides
 * by that count.
 *
 * The result has the same length as the input, is returned in a new array, and
 * does not modify the input frames.
 *
 * @param values the complex frames to transform, in sample order, at least one
 * @returns the complex spectrum in bin order, with one bin per frame
 * @throws {TypeError} if the input is not iterable, a frame is not a `Complex`,
 *         or an intermediate value overflows to a non-finite component
 * @throws {RangeError} if the sequence is empty
 */
export const discreteFourierTransform: (values: Iterable<Complex>) => Array<Complex> =
    (values: Iterable<Complex>): Array<Complex> => directTransform(requireComplexFrames(values, "Discrete transform"));

/**
 * Fastest available forward transform of complex frames.
 *
 * Mixed-radix decimation is used when the frame count factors into two, three,
 * five and seven, and Bluestein covers every other count, so a non-empty frame
 * count is always accepted and the result keeps its length without caller
 * padding. The values agree with `discreteFourierTransform` at a lower cost, and
 * the transform is unnormalised in the same way, so each bin is the raw sum of
 * the frames.
 *
 * The result has the same length as the input, is returned in a new array, and
 * does not modify the input frames.
 *
 * @param values the complex frames to transform, in sample order, at least one
 * @returns the complex spectrum in bin order, with one bin per frame
 * @throws {TypeError} if the input is not iterable, a frame is not a `Complex`,
 *         or an intermediate value overflows to a non-finite component
 * @throws {RangeError} if the sequence is empty
 */
export const fastFourierTransform: (values: Iterable<Complex>) => Array<Complex> =
    (values: Iterable<Complex>): Array<Complex> => transformAny(requireComplexFrames(values, "Fast transform"));

/**
 * Fastest available inverse transform of complex coefficients.
 *
 * The inverse reuses the forward factorisation by conjugation, so a count that
 * is not a product of the default radices still runs through Bluestein instead
 * of falling back to the quadratic direct sum. Every reconstructed frame is
 * divided by the coefficient count, so a forward transform followed by this
 * inverse recovers the frames up to rounding.
 *
 * The result has the same length as the input, is returned in a new array, and
 * does not modify the input coefficients.
 *
 * @param values the complex coefficients to invert, in bin order, at least one
 * @returns the complex frames in sample order, with one frame per coefficient
 * @throws {TypeError} if the input is not iterable, a coefficient is not a
 *         `Complex`, or an intermediate value overflows to a non-finite
 *         component
 * @throws {RangeError} if the sequence is empty
 */
export const inverseFastFourierTransform: (values: Iterable<Complex>) => Array<Complex> =
    (values: Iterable<Complex>): Array<Complex> => inverseAny(requireComplexFrames(values, "Inverse transform"));
