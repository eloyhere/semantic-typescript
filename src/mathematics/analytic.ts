import { isIterable, isNumber } from "#semantic/guard";
import { Angle } from "#semantic/mathematics/angle";
import { Complex } from "#semantic/mathematics/complex";
import { Frame } from "#semantic/mathematics/frame";
import { fastFourierTransform, inverseFastFourierTransform } from "#semantic/mathematics/spectral";

/**
 * Collects a complex signal from an iterable, validating every sample.
 *
 * The iterable is consumed exactly once, in iteration order, and every yielded
 * value is checked to be a `Complex`. The accepted samples are copied into a new
 * mutable array, so the caller's iterable can be reused or modified afterwards
 * without affecting the result. An empty iterable is rejected because every
 * function in this module needs at least one sample to produce its output.
 *
 * @param signal - the candidate samples, consumed once in iteration order
 * @param name - the role used in error messages, such as
 *        `Instantaneous amplitude signal`
 * @returns a new mutable array of accepted samples in iteration order
 * @throws {TypeError} if the input is not iterable or a sample is not a
 *         `Complex`
 * @throws {RangeError} if the signal yields no samples
 */
const requireSignal: (signal: Iterable<Complex>, name: string) => Array<Complex> =
    (signal: Iterable<Complex>, name: string): Array<Complex> => {
        if (!isIterable(signal)) {
            throw new TypeError(`${name} must be an iterable of complex samples.`);
        }
        const collected: Array<Complex> = [];
        for (const sample of signal) {
            if (!(sample instanceof Complex)) {
                throw new TypeError(`${name} samples must be Complex values.`);
            }
            collected.push(sample);
        }
        if (collected.length < 1) {
            throw new RangeError(`${name} requires at least one sample.`);
        }
        return collected;
    }

/**
 * Builds the analytic signal of a real frame.
 *
 * The frame is transformed with the unnormalised forward transform and the
 * spectrum is folded one-sided: the constant bin, and the Nyquist bin when the
 * frame count is even, keep their coefficient; bins at strictly positive
 * frequencies are doubled; and the remaining negative frequencies are dropped.
 * An odd frame count has no Nyquist bin, so only the constant bin is kept
 * unchanged. The inverse transform then yields `x[n] + i*H(x)[n]`, where `H` is
 * the Hilbert transform, so the real part recovers the frame up to
 * floating-point rounding and the magnitude is the instantaneous envelope.
 *
 * The result holds one sample per frame sample, in frame order, in a new array;
 * the frame is not modified. Because a `Frame` always holds at least one sample,
 * the input is never empty; a single-sample frame yields that sample with a zero
 * imaginary part. The transform is circular, so a frame whose period does not
 * divide its length shows edge effects.
 *
 * @param frame - the real frame to analyse, holding at least one finite sample
 * @returns a new array of analytic samples, one per frame sample
 * @throws {TypeError} if the argument is not a `Frame`, or an intermediate
 *         transform value overflows to a non-finite component
 */
export const analyticSignal: (frame: Frame) => Array<Complex> = (frame: Frame): Array<Complex> => {
    if (!(frame instanceof Frame)) {
        throw new TypeError("Analytic signal input must be a Frame.");
    }
    const count: number = frame.size();
    const spectrum: Array<Complex> = fastFourierTransform(frame.getValues().map((value: number): Complex => new Complex(value, 0)));
    const folded: Array<Complex> = [];
    for (let index: number = 0; index < count; index += 1) {
        const edge: boolean = index === 0 || (count % 2 === 0 && index === count / 2);
        const positive: boolean = index > 0 && index < count / 2;
        const factor: number = edge ? 1 : positive ? 2 : 0;
        folded.push(spectrum[index].multiply(factor));
    }
    return inverseFastFourierTransform(folded);
}

/**
 * The instantaneous amplitude, that is, the magnitude of the analytic signal.
 *
 * Each sample is mapped to its Euclidean norm, so the result is non-negative and
 * a zero sample reports zero. The amplitude is a distance from the origin, so it
 * carries the units of the samples rather than a separate amplitude unit. The
 * input is consumed once and is not modified, and the result is a new array with
 * one entry per sample.
 *
 * @param signal - the analytic samples in order, at least one
 * @returns a new array of non-negative amplitudes, one per sample
 * @throws {TypeError} if the signal is not iterable or a sample is not a
 *         `Complex`
 * @throws {RangeError} if the signal yields no samples
 */
export const instantaneousAmplitude: (signal: Iterable<Complex>) => Array<number> =
    (signal: Iterable<Complex>): Array<number> =>
        requireSignal(signal, "Instantaneous amplitude signal").map((sample: Complex): number => sample.magnitude());

/**
 * The instantaneous phase of the analytic signal, normalized into one turn.
 *
 * Each sample is mapped to its argument, measured counter-clockwise from the
 * positive real axis and normalized into `[0, 2 * PI)` radians. A phase that
 * reaches a full turn therefore wraps back to zero instead of continuing to
 * grow, and a zero sample reports the zero angle. Use `unwrapPhase` when a
 * continuous curve is required rather than one value per sample.
 *
 * The input is consumed once and is not modified; the result is a new array with
 * one radian angle per sample.
 *
 * @param signal - the analytic samples in order, at least one
 * @returns a new array of phases in radians, each within `[0, 2 * PI)`
 * @throws {TypeError} if the signal is not iterable or a sample is not a
 *         `Complex`
 * @throws {RangeError} if the signal yields no samples
 */
export const instantaneousPhase: (signal: Iterable<Complex>) => Array<Angle> =
    (signal: Iterable<Complex>): Array<Angle> =>
        requireSignal(signal, "Instantaneous phase signal").map((sample: Complex): Angle => sample.argument());

/**
 * Unwraps a phase sequence into a continuous radian curve.
 *
 * The first angle is converted to radians and taken as given, so the curve keeps
 * the branch of its first sample. Each later angle is compared with the previous
 * unwrapped value: the raw step is reduced by whole turns into the half-open
 * interval `[-PI, PI)`, and that step is added to the previous value. The output
 * can therefore leave the single-turn interval, becoming negative or exceeding a
 * full turn, while adjacent values stay no further apart than half a turn. A step
 * of exactly half a turn in either direction is represented as `-PI`, the lower
 * end of that interval.
 *
 * The angles are consumed once in iteration order and are not modified; the
 * result is a new array with one radian value per angle.
 *
 * @param phases - the phase samples in order, at least one
 * @returns a new array of unwrapped phases in radians, one per sample
 * @throws {TypeError} if the input is not iterable or a sample is not an `Angle`
 * @throws {RangeError} if the sequence yields no samples
 */
export const unwrapPhase: (phases: Iterable<Angle>) => Array<number> = (phases: Iterable<Angle>): Array<number> => {
    if (!isIterable(phases)) {
        throw new TypeError("Unwrapped phases must be an iterable of angles.");
    }
    const collected: Array<Angle> = [];
    for (const phase of phases) {
        if (!(phase instanceof Angle)) {
            throw new TypeError("Unwrapped phases must be Angle values.");
        }
        collected.push(phase);
    }
    if (collected.length < 1) {
        throw new RangeError("Unwrapping requires at least one phase.");
    }
    const full: number = 2 * Math.PI;
    const output: Array<number> = [collected[0].toRadianValue()];
    for (let index: number = 1; index < collected.length; index += 1) {
        const current: number = collected[index].toRadianValue();
        const previous: number = output[index - 1];
        let delta: number = current - previous;
        delta = ((delta + Math.PI) % full + full) % full - Math.PI;
        output.push(previous + delta);
    }
    return output;
}

/**
 * The instantaneous frequency in hertz from the analytic phase.
 *
 * The phases of the analytic samples are extracted and unwrapped, then
 * differentiated by a forward difference: each output after the first is
 * `(phase[n] - phase[n - 1]) * rate / (2 * PI)`. The first sample reports zero
 * because it has no predecessor, so a one-sample signal yields `[0]`. A negative
 * value means the phase turns backwards at that sample, so the result is a plain
 * number rather than a `Frequency`, which cannot be negative. Because the
 * unwrapped step is reduced into `[-PI, PI)`, each later value lies in
 * `[-rate / 2, rate / 2)`.
 *
 * The rate is validated before the signal is consumed, so an invalid rate is
 * reported without iterating the signal. The signal is consumed once and is not
 * modified; the result is a new array with one frequency per sample.
 *
 * @param signal - the analytic samples in order, at least one
 * @param rate - the sampling rate in hertz, finite and positive
 * @returns a new array of frequencies in hertz, one per sample, whose first
 *          entry is zero
 * @throws {TypeError} if the rate is not a finite number, or the signal is not
 *         iterable or holds a sample that is not a `Complex`
 * @throws {RangeError} if the rate is not positive, or the signal yields no
 *         samples
 */
export const instantaneousFrequency: (signal: Iterable<Complex>, rate: number) => Array<number> =
    (signal: Iterable<Complex>, rate: number): Array<number> => {
        if (!isNumber(rate)) {
            throw new TypeError("Instantaneous frequency rate must be a finite number.");
        }
        if (rate <= 0) {
            throw new RangeError("Instantaneous frequency rate must be positive.");
        }
        const phases: Array<number> = unwrapPhase(instantaneousPhase(signal));
        const output: Array<number> = [0];
        for (let index: number = 1; index < phases.length; index += 1) {
            output.push((phases[index] - phases[index - 1]) * rate / (2 * Math.PI));
        }
        return output;
    }

/**
 * The analytic samples as angles, keeping only their phase.
 *
 * This is the phase form of `analyticSignal`. The frame is analysed in the same
 * way and each analytic sample is replaced by its argument, so the result equals
 * `analyticSignal(frame)` mapped through `argument()`: one radian angle per frame
 * sample, each normalized into `[0, 2 * PI)`. The complex signal is still built
 * internally, so this is a convenience rather than a cheaper route, and the frame
 * is not modified.
 *
 * @param frame - the real frame to analyse, holding at least one finite sample
 * @returns a new array of radian phases, each within `[0, 2 * PI)`, one per
 *          frame sample
 * @throws {TypeError} if the argument is not a `Frame`, or an intermediate
 *         transform value overflows to a non-finite component
 */
export const analyticPhase: (frame: Frame) => Array<Angle> = (frame: Frame): Array<Angle> =>
    analyticSignal(frame).map((sample: Complex): Angle => sample.argument());
