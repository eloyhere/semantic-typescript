import { Complex } from "#semantic/mathematics/complex";

/**
 * The default radices used by the mixed-radix transform.
 *
 * The entries are the first four primes, `2`, `3`, `5` and `7`, so a positive
 * frame count whose prime factors all belong to this set can be transformed
 * without caller configuration. The array is frozen and is only read, never
 * modified. `factorsOver` sorts a copy in descending order before use, so this
 * declared ascending order does not affect the order of the returned factors.
 */
const DefaultRadices: ReadonlyArray<number> = Object.freeze([2, 3, 5, 7]);

/**
 * Tests whether a number is a prime integer.
 *
 * A value is prime when it is an integer of at least two with no positive
 * divisor other than one and itself. Non-integers, `NaN`, infinities and values
 * below two are therefore not prime, as are all even values apart from two.
 * Larger candidates are tested against the odd divisors up to their square
 * root. The function is deterministic and has no side effects.
 *
 * @param value - the number to test, treated as a dimensionless integer candidate
 * @returns `true` if the value is a prime integer, `false` otherwise
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
 * Factors a frame count into the supplied prime radices, largest first.
 *
 * The radices are copied and processed in descending order. Every radix is
 * validated as a prime integer, then the current remainder is divided by that
 * radix as often as possible and the radix is appended to the result once per
 * division. The returned factors are therefore non-increasing, and their
 * product is the original count. The supplied radices array is not modified.
 *
 * The count is expected to be a positive integer. A count of zero is outside
 * that domain: once a valid radix is reached, zero is divisible by it forever,
 * so the division loop does not terminate. Negative and fractional counts that
 * cannot be reduced to one fail the final check instead.
 *
 * @param count - the frame count to factorise; expected to be a positive integer
 * @param radices - the prime integers permitted in the factorisation, in any order
 * @returns the factors of `count`, largest first; an empty array when the count
 *          is one
 * @throws {TypeError} if any radix is not a prime integer
 * @throws {RangeError} if the count is not a product of the supplied radices
 */
const factorsOver: (count: number, radices: readonly number[]) => Array<number> =
    (count: number, radices: readonly number[]): Array<number> => {
        const factors: Array<number> = [];
        let remaining: number = count;
        for (const radix of [...radices].sort((left: number, right: number): number => right - left)) {
            if (!isPrime(radix)) {
                throw new TypeError("Transform radices must be prime integers.");
            }
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
 * Factors a frame count into the default radices `2`, `3`, `5` and `7`.
 *
 * This is the public test for whether a length is suitable for the mixed-radix
 * transform: a positive integer whose prime factors all belong to the default
 * set is factorised, while one with any other prime factor is rejected. The
 * factors are returned largest first and multiply to the count. A count of one
 * is valid and yields an empty array.
 *
 * The count is expected to be a positive integer. Zero is not supported: it is
 * divisible by every radix, so the factorisation loop does not terminate. The
 * call has no side effects: it returns a new factors array and does not modify
 * the shared defaults.
 *
 * @param count - the frame count to factorise; expected to be a positive integer
 * @returns the factors of `count` over `2`, `3`, `5` and `7`, largest first; an
 *          empty array when the count is one
 * @throws {RangeError} if a non-zero count is not a product of the default
 *         radices, as when it has a prime factor greater than seven, is
 *         negative, or is fractional
 */
export const factorsFor: (count: number) => Array<number> = (count: number): Array<number> => factorsOver(count, DefaultRadices);

/**
 * Attempts to factor a frame count over the default radices.
 *
 * The factorisation is delegated to `factorsFor`, and any exception it raises
 * is treated as evidence that the length is unsuitable for the mixed-radix
 * kernel. The exception is swallowed and `undefined` is returned so that the
 * caller can fall back to Bluestein; nothing is logged or otherwise reported.
 *
 * As with `factorsFor`, the count is expected to be a positive integer. A count
 * of zero does not terminate, because factoring it never returns.
 *
 * @param count - the frame count to factorise; expected to be a positive integer
 * @returns the default factors, largest first, or `undefined` when the count
 *          cannot be expressed over the default radices
 */
const attemptFactors: (count: number) => Array<number> | undefined = (count: number): Array<number> | undefined => {
    try {
        return factorsFor(count);
    } catch {
        return undefined;
    }
}

/**
 * Converts real frames into complex frames with zero imaginary parts.
 *
 * Each sample becomes a new `Complex` whose real component is the sample and
 * whose imaginary component is exactly zero, so every converted frame lies on
 * the real axis. The input array and its values are not modified. The result
 * has the same length and order as the input, including when the input is
 * empty, and the conversion applies no scaling to the samples.
 *
 * `Complex` accepts only finite numbers, so a `NaN` or an infinity is rejected
 * rather than converted.
 *
 * @param frames - the real samples to convert, in their original order; the
 *        values carry no unit and are left unchanged
 * @returns a new array of complex frames with one entry per sample, each with
 *          the sample as its real part and zero as its imaginary part
 * @throws {TypeError} if any sample is not a finite number
 */
export const asComplex: (frames: readonly number[]) => Array<Complex> =
    (frames: readonly number[]): Array<Complex> => frames.map((value: number): Complex => new Complex(value, 0));

/**
 * Computes the discrete Fourier transform with a mixed-radix
 * decimation-in-time kernel.
 *
 * The frames are split into `radix` interleaved subsequences, each subsequence
 * is transformed recursively, and the partial spectra are combined with
 * twiddle factors. The result contains one bin per input frame in increasing
 * frequency order: bin `k` represents `k` cycles over the frame, or the
 * normalised frequency `k / count`. No `1 / count` scaling is applied, so this
 * is the unnormalised forward transform and `inverseTransform` supplies the
 * matching normalisation.
 *
 * The factors are trusted rather than validated. For a count greater than one
 * they must be a non-empty sequence of positive integers whose product is
 * `values.length`; the first entry is consumed at this recursion level and the
 * remaining entries are passed to the subsequences. A sequence whose product is
 * not the count has no dedicated error path and can return an incorrect
 * spectrum or fail while a missing sub-frame is read.
 *
 * An empty input returns an empty array regardless of the factors, and a
 * single frame is returned as a one-element array holding that same `Complex`
 * instance without consulting the factors. The input arrays are never modified,
 * and for longer inputs the returned array and its bins are newly created.
 *
 * @param values - the complex frames to transform, in acquisition order, in
 *        arbitrary units
 * @param factors - the dimensionless positive integer radices whose product is
 *        `values.length`, ordered as the recursion consumes them; required to
 *        be non-empty when there is more than one frame
 * @returns the unnormalised complex spectrum, one bin per frame, in increasing
 *          frequency order
 * @throws {TypeError} if a sample is not a `Complex`, a sub-frame referenced by
 *         the factors is missing, or complex arithmetic overflows to a
 *         non-finite component
 */
export const transform: (values: readonly Complex[], factors: readonly number[]) => Array<Complex> =
    (values: readonly Complex[], factors: readonly number[]): Array<Complex> => {
        const count: number = values.length;
        if (count === 1) {
            return [values[0]];
        }
        const radix: number = factors[0];
        const remainder: ReadonlyArray<number> = factors.slice(1);
        const width: number = count / radix;
        const parts: Array<Array<Complex>> = [];
        for (let offset: number = 0; offset < radix; offset += 1) {
            const part: Array<Complex> = [];
            for (let index: number = 0; index < width; index += 1) {
                part.push(values[index * radix + offset]);
            }
            parts.push(transform(part, remainder));
        }
        const output: Array<Complex> = [];
        for (let frequency: number = 0; frequency < count; frequency += 1) {
            let sum: Complex = new Complex(0, 0);
            for (let offset: number = 0; offset < radix; offset += 1) {
                const angle: number = -2 * Math.PI * ((offset * frequency) % count) / count;
                const twiddle: Complex = new Complex(Math.cos(angle), Math.sin(angle));
                sum = sum.plus(parts[offset][frequency % width].multiply(twiddle));
            }
            output.push(sum);
        }
        return output;
    }

/**
 * Computes the inverse discrete Fourier transform by conjugating the forward
 * mixed-radix kernel.
 *
 * Each input bin is conjugated, transformed with `transform`, and conjugated
 * again; the result is then divided by the frame count. This returns the
 * normalised inverse transform: output frame `n` is the value at index `n` of
 * the original sequence, with the `1 / count` factor that the forward transform
 * omits. The returned frames are in original order, and the input spectrum is
 * not modified.
 *
 * The factors follow the same contract as `transform`: for a count greater than
 * one they must be a non-empty sequence of positive integers whose product is
 * the frame count, and they are trusted rather than validated. An empty input
 * produces an empty array, while a one-frame input produces a new `Complex`
 * equal to that frame.
 *
 * @param values - the complex spectrum to invert, in increasing frequency order,
 *        in arbitrary units
 * @param factors - the dimensionless positive integer radices whose product is
 *        `values.length`, ordered as the forward recursion consumes them;
 *        required to be non-empty when there is more than one bin
 * @returns the normalised complex frames, in original order, with one value per
 *          input bin
 * @throws {TypeError} if a bin is not a `Complex`, a sub-frame referenced by the
 *         factors is missing, or complex arithmetic overflows to a non-finite
 *         component
 */
export const inverseTransform: (values: readonly Complex[], factors: readonly number[]) => Array<Complex> =
    (values: readonly Complex[], factors: readonly number[]): Array<Complex> => {
        const transformed: Array<Complex> = transform(values.map((value: Complex): Complex => value.conjugate()), factors);
        return transformed.map((value: Complex): Complex => value.conjugate().divide(values.length));
    }

/**
 * Computes the discrete Fourier transform directly, with one pass per bin.
 *
 * Every output bin is evaluated as the sum over all frames of the frame times
 * the corresponding root of unity. The kernel works for every positive frame
 * count, including prime and otherwise non-smooth lengths, at the cost of
 * quadratic time. It is the reference form for the same unnormalised spectrum
 * that `transform` and `bluesteinTransform` compute, with bin `k` representing
 * `k` cycles over the frame.
 *
 * The input is not modified. An empty input returns an empty array, and a
 * one-frame input returns a new one-element array containing a new `Complex`
 * equal to that frame. Samples are expected to be `Complex` instances and are
 * not validated before arithmetic.
 *
 * @param values - the complex frames to transform, in acquisition order, in
 *        arbitrary units
 * @returns the unnormalised complex spectrum, one bin per frame, in increasing
 *          frequency order
 * @throws {TypeError} if a sample is not a `Complex` or complex arithmetic
 *         overflows to a non-finite component
 */
export const directTransform: (values: readonly Complex[]) => Array<Complex> = (values: readonly Complex[]): Array<Complex> => {
    const count: number = values.length;
    const output: Array<Complex> = [];
    for (let frequency: number = 0; frequency < count; frequency += 1) {
        let sum: Complex = new Complex(0, 0);
        for (let index: number = 0; index < count; index += 1) {
            const angle: number = -2 * Math.PI * ((index * frequency) % count) / count;
            sum = sum.plus(values[index].multiply(new Complex(Math.cos(angle), Math.sin(angle))));
        }
        output.push(sum);
    }
    return output;
}

/**
 * Computes the discrete Fourier transform with Bluestein's chirp-z algorithm.
 *
 * The transform is rewritten as a convolution with a chirp sequence, zero-padded
 * to a power of two and evaluated with the mixed-radix kernel. It therefore
 * works for every positive frame count, including lengths such as large primes
 * that are not products of the default radices, at the cost of temporary arrays
 * and a convolution. The result is unnormalised and uses the same increasing
 * frequency order as `transform`, with bin `k` representing `k` cycles over the
 * frame.
 *
 * The input is not modified. A one-frame input is returned as a one-element
 * array holding that same `Complex`; the general path builds new values. An
 * empty input is not supported: there is no chirp sample to build the
 * convolution from, and the setup ends in a `TypeError` rather than an empty
 * spectrum.
 *
 * @param values - the complex frames to transform, in acquisition order, in
 *        arbitrary units
 * @returns the unnormalised complex spectrum, one bin per frame, in increasing
 *          frequency order
 * @throws {TypeError} if the input is empty, a sample is not a `Complex`, or
 *         complex arithmetic overflows to a non-finite component
 */
export const bluesteinTransform: (values: readonly Complex[]) => Array<Complex> = (values: readonly Complex[]): Array<Complex> => {
    const count: number = values.length;
    if (count === 1) {
        return [values[0]];
    }
    let size: number = 1;
    while (size < 2 * count - 1) {
        size *= 2;
    }
    const chirp: Array<Complex> = [];
    for (let index: number = 0; index < count; index += 1) {
        const angle: number = Math.PI * ((index * index) % (2 * count)) / count;
        chirp.push(new Complex(Math.cos(angle), Math.sin(angle)));
    }
    const weighted: Array<Complex> = values.map((value: Complex, index: number): Complex => value.multiply(chirp[index].conjugate()));
    const left: Array<Complex> = [];
    for (let index: number = 0; index < size; index += 1) {
        left.push(index < count ? weighted[index] : new Complex(0, 0));
    }
    const right: Array<Complex> = [];
    for (let index: number = 0; index < size; index += 1) {
        right.push(new Complex(0, 0));
    }
    right[0] = chirp[0];
    for (let index: number = 1; index < count; index += 1) {
        right[index] = chirp[index];
        right[size - index] = chirp[index];
    }
    const factors: ReadonlyArray<number> = factorsFor(size);
    const leftSpectrum: Array<Complex> = transform(left, factors);
    const rightSpectrum: Array<Complex> = transform(right, factors);
    const product: Array<Complex> = leftSpectrum.map((value: Complex, index: number): Complex => value.multiply(rightSpectrum[index]));
    const convolution: Array<Complex> = inverseTransform(product, factors);
    return chirp.map((value: Complex, index: number): Complex => value.conjugate().multiply(convolution[index]));
}

/**
 * Computes the discrete Fourier transform with an appropriate fast kernel.
 *
 * The frame count is first offered to `factorsFor`. If it factors over the
 * default radices `2`, `3`, `5` and `7`, the mixed-radix `transform` is used;
 * otherwise the length is handled by `bluesteinTransform`. Both paths produce
 * the same unnormalised spectrum, so callers do not have to know whether a
 * length is smooth. No `1 / count` scaling is applied.
 *
 * An empty input is not supported: the factor search asks for the factors of
 * zero and does not terminate, so this function never returns for that input. A
 * one-frame input is returned as a one-element array holding that same
 * `Complex`. The input is not modified.
 *
 * @param values - the complex frames to transform, in acquisition order, in
 *        arbitrary units
 * @returns the unnormalised complex spectrum, one bin per frame, in increasing
 *          frequency order
 * @throws {TypeError} if a sample is not a `Complex` or complex arithmetic
 *         overflows to a non-finite component
 */
export const transformAny: (values: readonly Complex[]) => Array<Complex> = (values: readonly Complex[]): Array<Complex> => {
    const factors: Array<number> | undefined = attemptFactors(values.length);
    return factors === undefined ? bluesteinTransform(values) : transform(values, factors);
}

/**
 * Computes the inverse discrete Fourier transform with the fastest applicable
 * kernel.
 *
 * A frame count that factors over the default radices is inverted with
 * `inverseTransform`. Any other count is inverted through Bluestein: the
 * spectrum is conjugated, transformed forward and conjugated again, and the
 * result is divided by the count. That division supplies the `1 / count`
 * normalisation, so the returned frames are directly comparable with the
 * original sequence. Both paths return frames in original order and do not
 * modify the input.
 *
 * An empty input is not supported: the factor search asks for the factors of
 * zero and does not terminate. A one-frame spectrum is inverted through the
 * mixed-radix path and yields a new `Complex` equal to that frame.
 *
 * @param values - the complex spectrum to invert, in increasing frequency order,
 *        in arbitrary units
 * @returns the normalised complex frames, in original order, with one value per
 *          input bin
 * @throws {TypeError} if a bin is not a `Complex` or complex arithmetic
 *         overflows to a non-finite component
 */
export const inverseAny: (values: readonly Complex[]) => Array<Complex> = (values: readonly Complex[]): Array<Complex> => {
    const factors: Array<number> | undefined = attemptFactors(values.length);
    if (factors !== undefined) {
        return inverseTransform(values, factors);
    }
    const transformed: Array<Complex> = bluesteinTransform(values.map((value: Complex): Complex => value.conjugate()));
    return transformed.map((value: Complex): Complex => value.conjugate().divide(values.length));
}
