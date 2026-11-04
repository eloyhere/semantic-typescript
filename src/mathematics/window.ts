import { isFunction, isNumber } from "#semantic/guard";

/**
 * A real-valued window weight evaluated at one frame position.
 *
 * The function receives a zero-based position within a frame and the number of
 * samples in that frame, and returns a dimensionless multiplier. Callers use
 * positions from zero to `count - 1`, with index zero at the first sample and
 * `count - 1` at the last; every built-in window is symmetric about the centre
 * for a length greater than one, so `w(index, count)` equals
 * `w(count - 1 - index, count)`.
 *
 * By contract a window is finite and non-negative at every position it is
 * applied to, and the built-in windows are designed to satisfy this. The runtime
 * guards only reject non-finite weights, so a custom window that returns a
 * negative multiplier is still accepted. A window returns a weight rather than a
 * scaled sample, so one window can be reused across frames of different lengths.
 */
export type SpectralWindow = (index: number, count: number) => number;

/**
 * A rectangular window, whose weights are all one.
 *
 * The weight is exactly one at every position and for every frame length, so
 * applying it leaves a frame unchanged. Both parameters are ignored, so
 * out-of-frame or fractional positions and lengths of one or less all receive
 * one, and the function never throws. This is the default of `windowed` and the
 * neutral choice when no taper is wanted; its coherent gain is one and its
 * equivalent noise bandwidth is one bin.
 *
 * @param index - the position within the frame; ignored, since every position
 *        weighs one
 * @param count - the number of samples in the frame; ignored, since every length
 *        weighs one
 * @returns exactly one, whatever the position and the frame length
 */
export const useRectangularWindow: SpectralWindow = (): number => 1;

/**
 * A Hann window, which tapers both ends to zero.
 *
 * For a frame longer than one sample, the weight follows the raised cosine
 * `0.5 - 0.5 * cos(2 * PI * index / (count - 1))`, so the first and last samples
 * of the frame reach zero and the discontinuity at the frame boundary is reduced.
 * The weights peak in the middle of the frame, reaching one on an odd-length
 * frame, which makes the window symmetric about that middle. A frame of one
 * sample or fewer has no boundary to taper and receives a weight of one, which
 * also avoids a division by zero.
 *
 * Neither argument is validated: for a frame longer than one sample, positions
 * outside `[0, count - 1]` follow the same periodic cosine instead of being
 * rejected and still weigh between zero and one, while a `NaN` position or length
 * yields `NaN`.
 *
 * @param index - the zero-based position within the frame
 * @param count - the number of samples in the frame
 * @returns the weight at that position: one for a frame of one sample or fewer,
 *          otherwise a value in `[0, 1]` for a finite position
 */
export const useHannWindow: SpectralWindow = (index: number, count: number): number => {
    if (count <= 1) {
        return 1;
    }
    return 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (count - 1));
};

/**
 * A Hamming window, which lifts the tapered ends above zero.
 *
 * For a frame longer than one sample, the weight is
 * `0.54 - 0.46 * cos(2 * PI * index / (count - 1))`, the same raised cosine as
 * the Hann window lifted by a constant offset. The first and last samples
 * therefore weigh about 0.08, roughly eight per cent of their unscaled value, and
 * the side lobes fall lower as a result. The weights peak in the middle of the
 * frame, reaching one on an odd-length frame, and a frame of one sample or fewer
 * receives a weight of one.
 *
 * Neither argument is validated: for a frame longer than one sample, positions
 * outside `[0, count - 1]` follow the same periodic cosine and still weigh
 * between 0.08 and one, while a `NaN` position or length yields `NaN`.
 *
 * @param index - the zero-based position within the frame
 * @param count - the number of samples in the frame
 * @returns the weight at that position: one for a frame of one sample or fewer,
 *          otherwise a value in `[0.08, 1]` for a finite position
 */
export const useHammingWindow: SpectralWindow = (index: number, count: number): number => {
    if (count <= 1) {
        return 1;
    }
    return 0.54 - 0.46 * Math.cos(2 * Math.PI * index / (count - 1));
};

/**
 * A Blackman window, which suppresses the side lobes further than Hann.
 *
 * For a frame longer than one sample, the weight combines a cosine with its
 * second harmonic, `0.42 - 0.5 * cos(r) + 0.08 * cos(2 * r)` with `r` equal to
 * `2 * PI * index / (count - 1)`. The taper is steeper near the ends and the
 * side lobes are much lower, at the cost of a wider main lobe. The first and last
 * samples weigh virtually zero, and the weights peak in the middle of the frame.
 * A frame of one sample or fewer receives a weight of one.
 *
 * Neither argument is validated: for a frame longer than one sample, positions
 * outside `[0, count - 1]` follow the periodic cosine, while a `NaN` position or
 * length yields `NaN`.
 *
 * @param index - the zero-based position within the frame
 * @param count - the number of samples in the frame
 * @returns the weight at that position: one for a frame of one sample or fewer,
 *          otherwise a raised-cosine weight that tapers to virtually zero at both
 *          ends
 */
export const useBlackmanWindow: SpectralWindow = (index: number, count: number): number => {
    if (count <= 1) {
        return 1;
    }
    const ratio: number = 2 * Math.PI * index / (count - 1);
    return 0.42 - 0.5 * Math.cos(ratio) + 0.08 * Math.cos(2 * ratio);
};

/**
 * Validates that a value is a window function.
 *
 * A window is accepted on the strength of being callable, because its weights
 * cannot be checked without a frame; `windowed`, `coherentGain` and
 * `equivalentNoiseBandwidth` check each weight as they apply it. The value is
 * returned unchanged and is never invoked here, so the result needs no further
 * cast.
 *
 * @param window - the candidate window
 * @param name - the role used in the error message
 * @returns the candidate, typed as a window
 * @throws {TypeError} if the candidate is not a function
 */
const requireWindow: (window: unknown, name: string) => SpectralWindow = (window: unknown, name: string): SpectralWindow => {
    if (!isFunction(window)) {
        throw new TypeError(`${name} must be a window function.`);
    }
    return window as SpectralWindow;
}

/**
 * Multiplies every sample by its window weight.
 *
 * The iterable is drained into a new array before any weight is computed, so the
 * source is never mutated and one-shot iterables are consumed exactly once. Every
 * sample must be a finite number; a `NaN` or infinite sample rejects the whole
 * call before the window runs. Positions are then assigned in iteration order,
 * the first sample at index zero and the last at the frame length minus one, and
 * the window is evaluated once per position against the final frame length. The
 * returned array therefore has the same length and order as the input.
 *
 * An empty iterable returns an empty array without calling the window. The window
 * is validated before the iterable is read, so an invalid window leaves a lazy
 * source untouched. Weights are only required to be finite: a negative weight is
 * accepted, even though a well-formed window is expected to be non-negative. A
 * window with side effects runs once per sample, and an exception thrown by the
 * window or by the iterable propagates unchanged.
 *
 * @param values - the frame to weight, as any iterable of finite numbers; the
 *        source is not mutated and is read once
 * @param window - the weight applied at each position; defaults to the
 *        rectangular window, which leaves every sample unchanged
 * @returns a new array holding the weighted samples, in the original order and
 *          of the original length
 * @throws {TypeError} if `window` is not a function, or if any sample is not a
 *         finite number
 * @throws {RangeError} if the window returns a non-finite weight
 */
export const windowed: (values: Iterable<number>, window?: SpectralWindow) => Array<number> =
    (values: Iterable<number>, window: SpectralWindow = useRectangularWindow): Array<number> => {
        const applied: SpectralWindow = requireWindow(window, "Window function");
        const frame: Array<number> = [];
        for (const value of values) {
            if (!isNumber(value)) {
                throw new TypeError("Windowed samples must be finite numbers.");
            }
            frame.push(value);
        }
        return frame.map((value: number, index: number): number => {
            const weight: unknown = applied(index, frame.length);
            if (!isNumber(weight)) {
                throw new RangeError("Window function must return a finite weight.");
            }
            return value * weight;
        });
    };

/**
 * Tests whether a value is a window function.
 *
 * The test is a callability check rather than a probe of any weight, so a
 * function that would return an invalid weight is still reported as a window, and
 * a class constructor is reported as one even though calling it without `new`
 * throws. Every non-function is rejected, including an object that merely has a
 * call-like method. The guard never throws and never evaluates the candidate.
 *
 * @param target - the value to test
 * @returns `true` if the value is callable, narrowing it to `SpectralWindow`;
 *          otherwise `false`
 */
export const isSpectralWindow: (target: unknown) => target is SpectralWindow = (target: unknown): target is SpectralWindow => {
    return isFunction(target);
}

/**
 * Evaluates the modified Bessel function of the first kind at order zero.
 *
 * The power series `sum((value / 2) ** (2 * order) / (order!) ** 2)` is
 * accumulated until a term falls below `sum * 1E-15` or the loop reaches
 * sixty-three iterations, which converges quickly for the small arguments a
 * Kaiser window uses. The function is even, so a negative argument gives the same
 * value as its magnitude, and an argument of zero returns one. No argument is
 * validated: a very large magnitude can overflow the series to infinity.
 *
 * @param value - the argument, expected to be small in magnitude; its sign does
 *        not affect the result
 * @returns the Bessel value at that argument, one at zero
 */
const besselI0: (value: number) => number = (value: number): number => {
    let sum: number = 1;
    let term: number = 1;
    for (let order: number = 1; order < 64; order += 1) {
        term *= (value / (2 * order)) * (value / (2 * order));
        sum += term;
        if (term < sum * 1E-15) {
            break;
        }
    }
    return sum;
}

/**
 * Creates a Kaiser window, whose shape is tuned by one parameter.
 *
 * A larger beta trades a wider main lobe for lower side lobes, so the same window
 * family covers a taper close to Hann and one far sharper than Blackman. The
 * normalising Bessel value is computed once when the window is created; for a
 * frame longer than one sample each weight is
 * `I0(beta * sqrt(1 - r^2)) / I0(beta)` with `r = 2 * index / (count - 1) - 1`.
 * The ends then weigh `1 / I0(beta)` rather than reaching zero, the weights peak
 * in the middle of the frame, and a frame of one sample or fewer receives a
 * weight of one.
 *
 * For a frame longer than one sample, positions outside `[0, count - 1]` make `r`
 * fall outside `[-1, 1]`; the square root argument is clamped at zero, so such
 * positions receive the endpoint weight instead of `NaN`. A `NaN` position or
 * length still yields `NaN`.
 *
 * @param beta - the shape parameter, a finite non-negative number; zero yields a
 *        rectangular window whose weights are all one, and larger values widen
 *        the main lobe while lowering the side lobes
 * @returns a window function implementing that shape
 * @throws {TypeError} if beta is not a finite number
 * @throws {RangeError} if beta is negative
 */
export const useKaiserWindow: (beta: number) => SpectralWindow = (beta: number): SpectralWindow => {
    if (!isNumber(beta)) {
        throw new TypeError("Kaiser beta must be a finite number.");
    }
    if (beta < 0) {
        throw new RangeError("Kaiser beta must not be negative.");
    }
    const normalization: number = besselI0(beta);
    return (index: number, count: number): number => {
        if (count <= 1) {
            return 1;
        }
        const ratio: number = 2 * index / (count - 1) - 1;
        return besselI0(beta * Math.sqrt(Math.max(0, 1 - ratio * ratio))) / normalization;
    };
}

/**
 * A flat-top window, which keeps the amplitude of a tone accurate at the cost of
 * a wide main lobe.
 *
 * The five-term cosine series makes the taper nearly flat around the centre and
 * suppresses scalloping, so the window is a good choice for amplitude
 * measurements rather than for resolving close frequencies. For a frame longer
 * than one sample the series is slightly negative at the very ends, so every
 * weight is clamped at zero with `Math.max`; the window is therefore non-negative
 * for finite arguments and its weights are largest near the middle of the frame,
 * reaching about one there for a sufficiently long frame. A frame of one sample
 * or fewer receives a weight of one, which also avoids a division by zero.
 *
 * Neither argument is validated: for a frame longer than one sample, positions
 * outside `[0, count - 1]` follow the same periodic cosine instead of being
 * rejected, while a `NaN` position or length yields `NaN`.
 *
 * @param index - the zero-based position within the frame
 * @param count - the number of samples in the frame
 * @returns the weight at that position: one for a frame of one sample or fewer,
 *          otherwise the clamped series value, which is never negative and is
 *          largest near the middle of the frame
 */
export const useFlatTopWindow: SpectralWindow = (index: number, count: number): number => {
    if (count <= 1) {
        return 1;
    }
    const ratio: number = 2 * Math.PI * index / (count - 1);
    return Math.max(0, 0.21557895
        - 0.41663158 * Math.cos(ratio)
        + 0.277263158 * Math.cos(2 * ratio)
        - 0.083578947 * Math.cos(3 * ratio)
        + 0.006947368 * Math.cos(4 * ratio));
}

/**
 * A Nuttall window, a four-term Blackman-Harris variant with continuous
 * endpoints.
 *
 * For a frame longer than one sample, the weight is
 * `0.355768 - 0.487396 * cos(r) + 0.144232 * cos(2 * r) -
 * 0.012604 * cos(3 * r)` with `r` equal to `2 * PI * index / (count - 1)`. The
 * taper is steeper than Blackman's and its side lobes fall further, at the cost
 * of a wider main lobe. Both ends of the frame fall to virtually zero and the
 * weights peak in the middle, so the window is continuous across the frame
 * boundary. A frame of one sample or fewer receives a weight of one.
 *
 * Neither argument is validated: for a frame longer than one sample, positions
 * outside `[0, count - 1]` follow the periodic cosine, while a `NaN` position or
 * length yields `NaN`.
 *
 * @param index - the zero-based position within the frame
 * @param count - the number of samples in the frame
 * @returns the weight at that position: one for a frame of one sample or fewer,
 *          otherwise a weight that tapers to virtually zero at both ends
 */
export const useNuttallWindow: SpectralWindow = (index: number, count: number): number => {
    if (count <= 1) {
        return 1;
    }
    const ratio: number = 2 * Math.PI * index / (count - 1);
    return 0.355768
        - 0.487396 * Math.cos(ratio)
        + 0.144232 * Math.cos(2 * ratio)
        - 0.012604 * Math.cos(3 * ratio);
}

/**
 * The coherent gain of a window, that is, the mean of its weights.
 *
 * A windowed tone loses this fraction of its amplitude, so dividing a measured
 * amplitude by the coherent gain restores the unwindowed value. The mean is taken
 * over the integer positions from zero to `count - 1`, which makes the result
 * depend on the length for most symmetric windows. The value is dimensionless,
 * with a rectangular window reporting one and a Hann window about one half for a
 * long frame.
 *
 * The window is evaluated once per position in increasing index order and its
 * weights are not cached. A custom window with negative weights can produce a
 * negative mean, because only finiteness is checked. Weights that cancel to
 * exactly zero, as a taper that zeroes every sample would, are rejected instead
 * of being averaged.
 *
 * @param window - the window to measure; must be callable
 * @param count - the frame length in samples, a positive integer
 * @returns the mean window weight, dimensionless; one for a rectangular window
 *          and about one half for a long Hann window
 * @throws {TypeError} if the window is not callable or the count is not a
 *         positive integer
 * @throws {RangeError} if a weight is not finite or the weights sum to zero
 */
export const coherentGain: (window: SpectralWindow, count: number) => number =
    (window: SpectralWindow, count: number): number => {
        const applied: SpectralWindow = requireWindow(window, "Coherent gain window");
        if (!isNumber(count) || !Number.isInteger(count) || count < 1) {
            throw new TypeError("Coherent gain count must be a positive integer.");
        }
        let total: number = 0;
        for (let index: number = 0; index < count; index += 1) {
            const weight: number = applied(index, count);
            if (!isNumber(weight)) {
                throw new RangeError("Window function must return finite weights.");
            }
            total += weight;
        }
        if (total === 0) {
            throw new RangeError("Window weights must not sum to zero.");
        }
        return total / count;
    }

/**
 * The equivalent noise bandwidth of a window, in bins.
 *
 * The value is `count * sum(w^2) / sum(w)^2`, the width of the rectangular
 * window that would admit the same white-noise power. A rectangular window
 * reports exactly one bin, Hann about one and a half bins for a long frame, and
 * flatter tapers report more. The result is dimensionless and at least one bin
 * for the built-in windows.
 *
 * The window is evaluated once per position in increasing index order, and the
 * sum of the weights and the sum of their squares are accumulated in the same
 * pass and are not cached. Weights are only required to be finite, so a custom
 * window may return negative weights and they contribute their square. A sum of
 * exactly zero cannot be normalised and is rejected.
 *
 * @param window - the window to measure; must be callable
 * @param count - the frame length in samples, a positive integer
 * @returns the equivalent noise bandwidth in bins, dimensionless and at least
 *          one for the built-in windows
 * @throws {TypeError} if the window is not callable or the count is not a
 *         positive integer
 * @throws {RangeError} if a weight is not finite or the weights sum to zero
 */
export const equivalentNoiseBandwidth: (window: SpectralWindow, count: number) => number =
    (window: SpectralWindow, count: number): number => {
        const applied: SpectralWindow = requireWindow(window, "Equivalent noise bandwidth window");
        if (!isNumber(count) || !Number.isInteger(count) || count < 1) {
            throw new TypeError("Equivalent noise bandwidth count must be a positive integer.");
        }
        let total: number = 0;
        let squared: number = 0;
        for (let index: number = 0; index < count; index += 1) {
            const weight: number = applied(index, count);
            if (!isNumber(weight)) {
                throw new RangeError("Window function must return finite weights.");
            }
            total += weight;
            squared += weight * weight;
        }
        if (total === 0) {
            throw new RangeError("Window weights must not sum to zero.");
        }
        return count * squared / (total * total);
    }
