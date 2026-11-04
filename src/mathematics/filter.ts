import { isNumber } from "#semantic/guard";
import { Complex } from "#semantic/mathematics/complex";
import { Frame } from "#semantic/mathematics/frame";
import { Frequency } from "#semantic/mathematics/frequency";
import type { SpectralWindow } from "#semantic/mathematics/window";
import { useHannWindow } from "#semantic/mathematics/window";

/**
 * The five normalised coefficients of a direct-form biquad section.
 *
 * A section computes `y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2]
 * - a1*y[n-1] - a2*y[n-2]` for every input sample `x`, where `y` is the output
 * and `a0` has already been divided out of all five values. The feed-forward
 * coefficients `b0`, `b1` and `b2` place the zeros and the feedback
 * coefficients `a1` and `a2` place the poles, so one record can describe a
 * low-pass, high-pass, band-pass, notch or any other second-order response.
 *
 * The record is a plain immutable object that validates nothing by itself: it
 * can be built as an object literal, and a bad coefficient is only rejected when
 * the record reaches `applyBiquad` or `biquadResponse`. All five values are
 * dimensionless. Stability is not checked; it requires both roots of
 * `z^2 + a1*z + a2` to lie strictly inside the unit circle.
 */
export interface BiquadCoefficients {
    /**
     * The feed-forward coefficient of the current input sample.
     *
     * Dimensionless and already divided by `a0`, like the other four values.
     */
    readonly b0: number;
    /**
     * The feed-forward coefficient of the previous input sample.
     *
     * Dimensionless and already divided by `a0`; it multiplies `x[n-1]`.
     */
    readonly b1: number;
    /**
     * The feed-forward coefficient of the input two samples earlier.
     *
     * Dimensionless and already divided by `a0`; it multiplies `x[n-2]`.
     */
    readonly b2: number;
    /**
     * The feedback coefficient of the previous output sample.
     *
     * The recursion subtracts `a1 * y[n-1]`, so a negative value adds the
     * previous output back. The value is dimensionless and already divided by
     * `a0`.
     */
    readonly a1: number;
    /**
     * The feedback coefficient of the output two samples earlier.
     *
     * The recursion subtracts `a2 * y[n-2]`, so a negative value adds the older
     * output back. The value is dimensionless and already divided by `a0`.
     */
    readonly a2: number;
}

/**
 * Validates a biquad coefficient record.
 *
 * Each of the five coefficients is checked with the shared finite-number guard,
 * so a missing property, `NaN`, an infinity or a non-numeric value rejects the
 * whole record. The check is shallow and proves neither stability nor any
 * particular response shape. The record is returned by reference rather than
 * copied, so the caller's object is passed straight through.
 *
 * @param coefficients - the candidate coefficient record
 * @returns the same record, unchanged
 * @throws {TypeError} if any of `b0`, `b1`, `b2`, `a1` or `a2` is missing or not
 *         a finite number
 */
const requireBiquad: (coefficients: BiquadCoefficients) => BiquadCoefficients =
    (coefficients: BiquadCoefficients): BiquadCoefficients => {
        for (const value of [coefficients.b0, coefficients.b1, coefficients.b2, coefficients.a1, coefficients.a2]) {
            if (!isNumber(value)) {
                throw new TypeError("Biquad coefficients must be finite numbers.");
            }
        }
        return coefficients;
    }

/**
 * Validates a sampling rate and a cutoff below Nyquist.
 *
 * Both values must be finite numbers, the rate must be strictly positive, and
 * the cutoff must lie strictly inside `(0, rate / 2)`. Zero and exactly-Nyquist
 * cutoffs are therefore rejected as well as negative ones, which keeps every
 * caller's normalised frequency inside `(0, 0.5)`. The helper only inspects its
 * arguments: it returns nothing and has no side effects.
 *
 * @param rate - the frame rate in hertz, a positive finite number
 * @param frequency - the cutoff or centre frequency in hertz, strictly between
 *        zero and `rate / 2`
 * @throws {TypeError} if either value is not a finite number, including `NaN`,
 *         both infinities and non-numeric values
 * @throws {RangeError} if the rate is not positive, or the cutoff is not inside
 *         `(0, rate / 2)`
 */
const requireCutoff: (rate: number, frequency: number) => void = (rate: number, frequency: number): void => {
    if (!isNumber(rate) || !isNumber(frequency)) {
        throw new TypeError("Filter rate and frequency must be finite numbers.");
    }
    if (rate <= 0) {
        throw new RangeError("Filter rate must be positive.");
    }
    if (frequency <= 0 || frequency >= rate / 2) {
        throw new RangeError("Filter frequency must lie strictly between zero and Nyquist.");
    }
}

/**
 * Normalises the raw cookbook coefficients by their `a0`.
 *
 * Every returned value is the corresponding raw value divided by `a0`, so the
 * resulting section has an implied leading feedback coefficient of one. The
 * division is not guarded: `a0` is expected to be non-zero, and the designers in
 * this module always pass `1 + alpha`, which is positive. The calculation is
 * pure, reads no state and allocates a new record instead of mutating its
 * arguments.
 *
 * @param b0 - the raw feed-forward zero coefficient
 * @param b1 - the raw feed-forward one coefficient
 * @param b2 - the raw feed-forward two coefficient
 * @param a0 - the raw feedback zero coefficient; must not be zero
 * @param a1 - the raw feedback one coefficient
 * @param a2 - the raw feedback two coefficient
 * @returns the five coefficients divided by `a0`, as a new record
 */
const normalize: (b0: number, b1: number, b2: number, a0: number, a1: number, a2: number) => BiquadCoefficients =
    (b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): BiquadCoefficients =>
        ({ b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 });

/**
 * Designs a second-order low-pass biquad section.
 *
 * The design follows the bilinear cookbook: with
 * `omega = 2 * PI * frequency / rate` and `alpha = sin(omega) / (2 * q)`, the
 * five values are normalised by `1 + alpha` before being returned. The
 * mathematical response has unit gain at zero hertz, magnitude `q` at the
 * cutoff and a zero at Nyquist, and above the cutoff it rolls off
 * asymptotically at twelve decibels per octave. The default quality factor of
 * one over the square root of two gives the maximally flat Butterworth
 * response, about 0.7071 at the cutoff, that is -3 dB; a larger factor raises a
 * resonant peak around the cutoff and a smaller one over-damps the response.
 *
 * The function is pure: it validates its arguments, computes five numbers and
 * returns them in a new record, keeping no state and allocating no frame. The
 * cutoff is never clamped or folded, so a value at or above Nyquist is rejected
 * rather than mapped back into the pass band.
 *
 * @param rate - the frame rate in hertz, a positive finite number
 * @param frequency - the cutoff in hertz, strictly between zero and `rate / 2`
 * @param q - the dimensionless quality factor, a positive finite number;
 *        defaults to `Math.SQRT1_2`, about 0.7071
 * @returns the normalised coefficients of a low-pass section
 * @throws {TypeError} if `rate` or `frequency` is not a finite number
 * @throws {RangeError} if `rate` is not positive, `frequency` is not strictly
 *         inside `(0, rate / 2)`, or `q` is not a positive finite number
 */
export const useLowPass: (rate: number, frequency: number, q?: number) => BiquadCoefficients =
    (rate: number, frequency: number, q: number = Math.SQRT1_2): BiquadCoefficients => {
        requireCutoff(rate, frequency);
        if (!isNumber(q) || q <= 0) {
            throw new RangeError("Filter quality factor must be a positive finite number.");
        }
        const omega: number = 2 * Math.PI * frequency / rate;
        const cosine: number = Math.cos(omega);
        const alpha: number = Math.sin(omega) / (2 * q);
        const one: number = 1 - cosine;
        return normalize(one / 2, one, one / 2, 1 + alpha, -2 * cosine, 1 - alpha);
    }

/**
 * Designs a second-order high-pass biquad section.
 *
 * It shares the low-pass angular terms, `omega = 2 * PI * frequency / rate` and
 * `alpha = sin(omega) / (2 * q)`, but builds the feed-forward coefficients from
 * `1 + cos(omega)` instead of `1 - cos(omega)`. The mathematical response
 * therefore has a zero at zero hertz, unit gain at Nyquist and magnitude `q` at
 * the cutoff, and below the cutoff it rolls off asymptotically at twelve
 * decibels per octave. The default quality factor gives the maximally flat
 * Butterworth response, about 0.7071 at the cutoff, that is -3 dB, while a
 * larger factor raises a resonant peak around the cutoff.
 *
 * The function is pure: it validates its arguments, computes five numbers and
 * returns them in a new record, keeping no state and allocating no frame. The
 * cutoff is never clamped or folded, so a value at or above Nyquist is rejected
 * rather than mapped back into the pass band.
 *
 * @param rate - the frame rate in hertz, a positive finite number
 * @param frequency - the cutoff in hertz, strictly between zero and `rate / 2`
 * @param q - the dimensionless quality factor, a positive finite number;
 *        defaults to `Math.SQRT1_2`, about 0.7071
 * @returns the normalised coefficients of a high-pass section
 * @throws {TypeError} if `rate` or `frequency` is not a finite number
 * @throws {RangeError} if `rate` is not positive, `frequency` is not strictly
 *         inside `(0, rate / 2)`, or `q` is not a positive finite number
 */
export const useHighPass: (rate: number, frequency: number, q?: number) => BiquadCoefficients =
    (rate: number, frequency: number, q: number = Math.SQRT1_2): BiquadCoefficients => {
        requireCutoff(rate, frequency);
        if (!isNumber(q) || q <= 0) {
            throw new RangeError("Filter quality factor must be a positive finite number.");
        }
        const omega: number = 2 * Math.PI * frequency / rate;
        const cosine: number = Math.cos(omega);
        const alpha: number = Math.sin(omega) / (2 * q);
        const one: number = 1 + cosine;
        return normalize(one / 2, -one, one / 2, 1 + alpha, -2 * cosine, 1 - alpha);
    }

/**
 * Designs a second-order band-pass section with unity gain at its centre.
 *
 * With `omega = 2 * PI * frequency / rate` and
 * `alpha = sin(omega) / (2 * q)`, the raw feed-forward coefficients are
 * `alpha`, zero and `-alpha`, normalised by `1 + alpha`. The mathematical
 * response is zero at zero hertz, reaches unity at the centre frequency and
 * returns to zero at Nyquist, so the section passes one band and rejects the
 * rest. The width of that band is approximately `frequency / q` hertz, so a
 * larger quality factor selects a narrower band. This is the constant
 * zero-decibel peak-gain form of the cookbook band-pass, not the constant-skirt
 * form whose peak gain equals `q`.
 *
 * The function is pure: it validates its arguments, computes five numbers and
 * returns them in a new record, keeping no state and allocating no frame. The
 * centre frequency is never clamped or folded, so a value at or above Nyquist is
 * rejected.
 *
 * @param rate - the frame rate in hertz, a positive finite number
 * @param frequency - the centre frequency in hertz, strictly between zero and
 *        `rate / 2`
 * @param q - the dimensionless quality factor, a positive finite number;
 *        defaults to `Math.SQRT1_2`, about 0.7071
 * @returns the normalised coefficients of a band-pass section
 * @throws {TypeError} if `rate` or `frequency` is not a finite number
 * @throws {RangeError} if `rate` is not positive, `frequency` is not strictly
 *         inside `(0, rate / 2)`, or `q` is not a positive finite number
 */
export const useBandPass: (rate: number, frequency: number, q?: number) => BiquadCoefficients =
    (rate: number, frequency: number, q: number = Math.SQRT1_2): BiquadCoefficients => {
        requireCutoff(rate, frequency);
        if (!isNumber(q) || q <= 0) {
            throw new RangeError("Filter quality factor must be a positive finite number.");
        }
        const omega: number = 2 * Math.PI * frequency / rate;
        const cosine: number = Math.cos(omega);
        const alpha: number = Math.sin(omega) / (2 * q);
        return normalize(alpha, 0, -alpha, 1 + alpha, -2 * cosine, 1 - alpha);
    }

/**
 * Designs a second-order notch section that rejects one frequency.
 *
 * With `omega = 2 * PI * frequency / rate` and
 * `alpha = sin(omega) / (2 * q)`, the raw feed-forward coefficients are `1`,
 * `-2 * cos(omega)` and `1`, normalised by `1 + alpha`. The mathematical
 * response is zero at the centre frequency, so a sinusoid there is removed,
 * while zero hertz and Nyquist pass with unit gain. The rejected band is narrow
 * for a large quality factor and broad for a small one, with an approximate
 * -3 dB bandwidth of `frequency / q` hertz.
 *
 * The function is pure: it validates its arguments, computes five numbers and
 * returns them in a new record, keeping no state and allocating no frame. The
 * centre frequency is never clamped or folded, so a value at or above Nyquist is
 * rejected.
 *
 * @param rate - the frame rate in hertz, a positive finite number
 * @param frequency - the centre frequency in hertz, strictly between zero and
 *        `rate / 2`
 * @param q - the dimensionless quality factor, a positive finite number;
 *        defaults to `Math.SQRT1_2`, about 0.7071
 * @returns the normalised coefficients of a notch section
 * @throws {TypeError} if `rate` or `frequency` is not a finite number
 * @throws {RangeError} if `rate` is not positive, `frequency` is not strictly
 *         inside `(0, rate / 2)`, or `q` is not a positive finite number
 */
export const useNotch: (rate: number, frequency: number, q?: number) => BiquadCoefficients =
    (rate: number, frequency: number, q: number = Math.SQRT1_2): BiquadCoefficients => {
        requireCutoff(rate, frequency);
        if (!isNumber(q) || q <= 0) {
            throw new RangeError("Filter quality factor must be a positive finite number.");
        }
        const omega: number = 2 * Math.PI * frequency / rate;
        const cosine: number = Math.cos(omega);
        const alpha: number = Math.sin(omega) / (2 * q);
        return normalize(1, -2 * cosine, 1, 1 + alpha, -2 * cosine, 1 - alpha);
    }

/**
 * Runs a biquad section over a frame with zero initial state.
 *
 * The section is applied in direct form one: both input and output history
 * start at zero, each output sample is computed from the current input, the two
 * previous inputs and the two previous outputs, and the history is then shifted
 * by one sample. Because the filter is causal and starts from rest, the first
 * samples include a start-up transient and the phase response is not linear;
 * there is no warm-up pass and no compensation for the missing history.
 *
 * The input frame is not modified. The result is a new `Frame` that shares the
 * plan object of the input, and therefore its rate, frame times and duration,
 * and has the same length, so the output can be compared sample by sample with
 * the source.
 *
 * @param frame - the frame to filter; must be a `Frame`
 * @param coefficients - the five normalised coefficients of the section
 * @returns a new frame holding the filtered samples and the input's plan
 * @throws {TypeError} if `frame` is not a `Frame`, any coefficient is not a
 *         finite number, or the recursion overflows to a non-finite sample
 */
export const applyBiquad: (frame: Frame, coefficients: BiquadCoefficients) => Frame =
    (frame: Frame, coefficients: BiquadCoefficients): Frame => {
        if (!(frame instanceof Frame)) {
            throw new TypeError("Biquad input must be a Frame.");
        }
        const section: BiquadCoefficients = requireBiquad(coefficients);
        const input: ReadonlyArray<number> = frame.getValues();
        const output: Array<number> = [];
        let previousInput: number = 0;
        let beforePreviousInput: number = 0;
        let previousOutput: number = 0;
        let beforePreviousOutput: number = 0;
        for (const sample of input) {
            const value: number = section.b0 * sample
                + section.b1 * previousInput
                + section.b2 * beforePreviousInput
                - section.a1 * previousOutput
                - section.a2 * beforePreviousOutput;
            output.push(value);
            beforePreviousInput = previousInput;
            previousInput = sample;
            beforePreviousOutput = previousOutput;
            previousOutput = value;
        }
        return new Frame(frame.getSample(), output);
    }

/**
 * Evaluates the complex frequency response of a biquad section.
 *
 * The response is
 * `H(z) = (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^-1 + a2*z^-2)` with
 * `z = exp(i*omega)` and `omega = 2 * PI * frequency / rate`, so the returned
 * `Complex` gives the gain and phase shift that the section applies to a
 * sinusoid at that frequency: its magnitude is the amplitude ratio and its
 * argument is the phase shift in radians. The formula is periodic in `omega`,
 * so frequencies are evaluated modulo `rate`, and nothing requires the
 * frequency to lie below Nyquist.
 *
 * The frequency is a `Frequency`, which guarantees a finite, non-negative
 * hertz value; the rate is a plain number. The coefficients are validated, but
 * no check proves stability, so a pole on the unit circle at the evaluated
 * angle makes the denominator vanish.
 *
 * @param coefficients - the five normalised coefficients of the section
 * @param frequency - the frequency at which to evaluate the response
 * @param rate - the sampling rate in hertz, a positive finite number
 * @returns the complex gain at that frequency; the magnitude is dimensionless
 *          and the argument is in radians
 * @throws {TypeError} if a coefficient is not a finite number, `frequency` is
 *         not a `Frequency`, or the computed response overflows to a non-finite
 *         component
 * @throws {RangeError} if `rate` is not a positive finite number, or the
 *         denominator vanishes at that frequency because of a pole on the unit
 *         circle
 */
export const biquadResponse: (coefficients: BiquadCoefficients, frequency: Frequency, rate: number) => Complex =
    (coefficients: BiquadCoefficients, frequency: Frequency, rate: number): Complex => {
        const section: BiquadCoefficients = requireBiquad(coefficients);
        if (!(frequency instanceof Frequency)) {
            throw new TypeError("Biquad response frequency must be a Frequency.");
        }
        if (!isNumber(rate) || rate <= 0) {
            throw new RangeError("Biquad response rate must be a positive finite number.");
        }
        const omega: number = 2 * Math.PI * frequency.getHertz() / rate;
        const cosine: number = Math.cos(omega);
        const sine: number = Math.sin(omega);
        const numeratorReal: number = section.b0 + section.b1 * cosine + section.b2 * Math.cos(2 * omega);
        const numeratorImaginary: number = -section.b1 * sine - section.b2 * Math.sin(2 * omega);
        const denominatorReal: number = 1 + section.a1 * cosine + section.a2 * Math.cos(2 * omega);
        const denominatorImaginary: number = -section.a1 * sine - section.a2 * Math.sin(2 * omega);
        return new Complex(numeratorReal, numeratorImaginary).divide(new Complex(denominatorReal, denominatorImaginary));
    }

/**
 * Computes the smoothing factor of a one-pole low-pass.
 *
 * The factor is `1 - exp(-2 * PI * frequency / rate)`, the fraction of each new
 * sample that `applyOnePole` mixes into its running state. It corresponds to a
 * continuous-time cutoff of `frequency` hertz, with an equivalent time constant
 * of `rate / (2 * PI * frequency)` samples: a larger factor follows the input
 * faster. For an accepted cutoff the factor lies in `(0, 1)`, rising with the
 * cutoff and staying below `1 - exp(-PI)`, about 0.9568, because the cutoff must
 * remain under Nyquist. An extremely small cutoff relative to the rate can still
 * round the subtraction to zero.
 *
 * The function is pure and does not create the filter; it only returns the
 * number to pass to `applyOnePole`.
 *
 * @param rate - the frame rate in hertz, a positive finite number
 * @param frequency - the cutoff in hertz, strictly between zero and `rate / 2`
 * @returns the dimensionless smoothing factor, normally inside `(0, 1)` and at
 *          most about 0.9568 for a cutoff just below Nyquist
 * @throws {TypeError} if `rate` or `frequency` is not a finite number
 * @throws {RangeError} if `rate` is not positive, or `frequency` is not strictly
 *         inside `(0, rate / 2)`
 */
export const useOnePole: (rate: number, frequency: number) => number = (rate: number, frequency: number): number => {
    requireCutoff(rate, frequency);
    return 1 - Math.exp(-2 * Math.PI * frequency / rate);
}

/**
 * Runs a one-pole low-pass over a frame with zero initial state.
 *
 * Each output sample is `alpha * sample + (1 - alpha) * previous`, so the state
 * starts at zero, `alpha` controls how quickly the output follows the input,
 * and every output stays within the range spanned by zero and the samples seen
 * so far. The filter is causal and starts from rest, so the first samples
 * include a start-up transient and the phase response is not linear; no warm-up
 * pass is performed.
 *
 * The input frame is not modified. The result is a new `Frame` that shares the
 * plan object of the input and has the same length. Because every output is a
 * convex combination of finite values, the output stays finite.
 *
 * @param frame - the frame to filter; must be a `Frame`
 * @param alpha - the smoothing factor in `(0, 1]`, normally from `useOnePole`;
 *        one copies the input, values below one smooth it
 * @returns a new frame holding the filtered samples and the input's plan
 * @throws {TypeError} if `frame` is not a `Frame`, or `alpha` is not a finite
 *         number
 * @throws {RangeError} if `alpha` is not inside `(0, 1]`
 */
export const applyOnePole: (frame: Frame, alpha: number) => Frame = (frame: Frame, alpha: number): Frame => {
    if (!(frame instanceof Frame)) {
        throw new TypeError("One-pole input must be a Frame.");
    }
    if (!isNumber(alpha)) {
        throw new TypeError("One-pole factor must be a finite number.");
    }
    if (alpha <= 0 || alpha > 1) {
        throw new RangeError("One-pole factor must be within (0, 1].");
    }
    let previous: number = 0;
    const output: Array<number> = frame.getValues().map((sample: number): number => {
        previous = alpha * sample + (1 - alpha) * previous;
        return previous;
    });
    return new Frame(frame.getSample(), output);
}

/**
 * Designs a windowed-sinc low-pass FIR kernel with unity direct-current gain.
 *
 * For a kernel of `taps` coefficients the ideal impulse response is sampled
 * around its centre: with `normalised = frequency / rate` and
 * `offset = index - (taps - 1) / 2`, the ideal value is `2 * normalised` at
 * offset zero and `sin(2 * PI * normalised * offset) / (PI * offset)` otherwise.
 * Each ideal value is multiplied by `window(index, taps)`, and the tapered
 * kernel is finally divided by its own sum, so the coefficients are normalised
 * to unit direct-current gain and add up to one up to floating-point rounding.
 * The taper lowers the side lobes at the cost of a wider transition band, and
 * the Hann window is used when none is supplied.
 *
 * The tap count must be a positive odd integer, which makes the centre index an
 * integer and keeps the kernel symmetric about its middle coefficient. The
 * cutoff is never clamped, so a value at or above Nyquist is rejected. The
 * function returns a new mutable array and keeps no state.
 *
 * @param rate - the frame rate in hertz, a positive finite number
 * @param frequency - the cutoff in hertz, strictly between zero and `rate / 2`
 * @param taps - the number of coefficients, a positive odd integer
 * @param window - the taper evaluated at each kernel position; defaults to
 *        `useHannWindow`
 * @returns a new array of `taps` normalised coefficients, centred on the middle
 *          coefficient and summing to one up to rounding
 * @throws {TypeError} if `rate` or `frequency` is not a finite number, or
 *         `window` is not callable
 * @throws {RangeError} if `rate` is not positive, `frequency` is not strictly
 *         inside `(0, rate / 2)`, `taps` is not a positive odd integer, a window
 *         weight is not finite, or the tapered kernel sums to zero
 */
export const useFirLowPass: (rate: number, frequency: number, taps: number, window?: SpectralWindow) => Array<number> =
    (rate: number, frequency: number, taps: number, window: SpectralWindow = useHannWindow): Array<number> => {
        requireCutoff(rate, frequency);
        if (!isNumber(taps) || !Number.isInteger(taps) || taps < 1 || taps % 2 === 0) {
            throw new RangeError("FIR tap count must be a positive odd integer.");
        }
        const normalized: number = frequency / rate;
        const middle: number = (taps - 1) / 2;
        const coefficients: Array<number> = [];
        let total: number = 0;
        for (let index: number = 0; index < taps; index += 1) {
            const offset: number = index - middle;
            const ideal: number = offset === 0 ? 2 * normalized : Math.sin(2 * Math.PI * normalized * offset) / (Math.PI * offset);
            const value: number = ideal * window(index, taps);
            if (!isNumber(value)) {
                throw new RangeError("FIR window must return finite weights.");
            }
            coefficients.push(value);
            total += value;
        }
        if (total === 0) {
            throw new RangeError("FIR kernel must not sum to zero.");
        }
        return coefficients.map((value: number): number => value / total);
    }

/**
 * Runs a finite impulse response kernel over a frame, keeping the frame length.
 *
 * The kernel is centred on each sample at index
 * `floor((length - 1) / 2)`, where `length` is the number of coefficients, so a
 * symmetric kernel with an odd number of taps preserves the alignment of the
 * input; an even-length kernel is accepted, but its centre then falls between
 * samples. Samples near the edges only see the taps that fit: an out-of-range
 * source contributes nothing, as though the signal were zero outside the frame,
 * so the output near the edges is not corrected for the missing taps and no
 * renormalisation is applied.
 *
 * The coefficients are drained from the iterable exactly once and checked
 * before any output is computed. The input frame is not modified; the result is
 * a new `Frame` that shares the plan object of the input and has the same
 * length as it.
 *
 * @param frame - the frame to filter; must be a `Frame`
 * @param coefficients - the finite kernel coefficients, ordered from the first
 *        tap to the last and consumed once
 * @returns a new frame holding the filtered samples and the input's plan
 * @throws {TypeError} if `frame` is not a `Frame`, a coefficient is not a finite
 *         number, or a filtered sum overflows to a non-finite value
 * @throws {RangeError} if the kernel contains no coefficients
 */
export const applyFir: (frame: Frame, coefficients: Iterable<number>) => Frame =
    (frame: Frame, coefficients: Iterable<number>): Frame => {
        if (!(frame instanceof Frame)) {
            throw new TypeError("FIR input must be a Frame.");
        }
        const taps: Array<number> = [];
        for (const coefficient of coefficients) {
            if (!isNumber(coefficient)) {
                throw new TypeError("FIR coefficients must be finite numbers.");
            }
            taps.push(coefficient);
        }
        if (taps.length < 1) {
            throw new RangeError("FIR kernel must contain at least one coefficient.");
        }
        const middle: number = Math.floor((taps.length - 1) / 2);
        const input: ReadonlyArray<number> = frame.getValues();
        const output: Array<number> = new Array<number>(input.length).fill(0);
        for (let index: number = 0; index < input.length; index += 1) {
            let total: number = 0;
            for (let tap: number = 0; tap < taps.length; tap += 1) {
                const source: number = index - tap + middle;
                if (source >= 0 && source < input.length) {
                    total += taps[tap] * input[source];
                }
            }
            output[index] = total;
        }
        return new Frame(frame.getSample(), output);
    }
