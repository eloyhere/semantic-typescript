import { isNumber } from "#semantic/guard";
import { Angle, useRadian } from "#semantic/mathematics/angle";
import { Complex } from "#semantic/mathematics/complex";
import { Envelope } from "#semantic/mathematics/envelope";
import { Omega } from "#semantic/mathematics/omega";
import { EpicycleSymbol } from "#semantic/symbol";

const QuarterTurn: number = Math.PI * 0.5;
const DerivativeStep: number = 1E-6;
const IntegrationTolerance: number = 1E-10;
const IntegrationDepth: number = 20;

const simpson: (evaluate: (time: number) => Complex, start: number, end: number) => Complex =
    (evaluate: (time: number) => Complex, start: number, end: number): Complex => {
        const middle: number = (start + end) * 0.5;
        return evaluate(start).plus(evaluate(middle).multiply(4)).plus(evaluate(end)).multiply((end - start) / 6);
    }

const adaptive: (evaluate: (time: number) => Complex, start: number, end: number, epsilon: number, depth: number) => Complex =
    (evaluate: (time: number) => Complex, start: number, end: number, epsilon: number, depth: number): Complex => {
        const middle: number = (start + end) * 0.5;
        const whole: Complex = simpson(evaluate, start, end);
        const halves: Complex = simpson(evaluate, start, middle).plus(simpson(evaluate, middle, end));
        if (depth <= 0 || halves.minus(whole).magnitude() <= 15 * epsilon) {
            return halves.plus(halves.minus(whole).divide(15));
        }
        return adaptive(evaluate, start, middle, epsilon * 0.5, depth - 1)
            .plus(adaptive(evaluate, middle, end, epsilon * 0.5, depth - 1));
    }

const integrate: (evaluate: (time: number) => Complex, start: number, end: number) => Complex =
    (evaluate: (time: number) => Complex, start: number, end: number): Complex => {
        if (start === end) {
            return new Complex(0, 0);
        }
        return adaptive(evaluate, start, end, IntegrationTolerance, IntegrationDepth);
    }

/**
 * A single rotating complex exponential: an amplitude envelope, an angular rate
 * and a phase.
 *
 * The contribution at a time `t` in seconds is `amplitude(t) * exp(i*(omega*t +
 * phase))`, so the value is complex and its real part is the familiar cosine.
 * The envelope may vary over time for evaluation and numerical differentiation,
 * while symbolic differentiation and integration require a constant amplitude
 * and, for integration, a non-zero angular rate.
 *
 * A phasor is immutable, so every derived phasor is a new instance. `equals`
 * compares parameters within a tolerance rather than sampling values, and
 * `isEpicycle` recognises instances at runtime. A `Waveform` is a superposition
 * of epicycles, and a `Tone` projects into one.
 */
export class Epicycle {

    private readonly amplitude: Envelope;
    private readonly omega: Omega;
    private readonly phase: Angle;
    protected readonly [EpicycleSymbol]: symbol = EpicycleSymbol;

    /**
     * Creates a phasor from an amplitude envelope, an angular rate and a phase.
     *
     * All three arguments are stored by reference and must already be instances
     * of their respective types; the constructor performs no conversion.
     *
     * @param amplitude the amplitude envelope
     * @param omega the angular rate in radians per second
     * @param phase the phase offset
     * @throws {TypeError} if an argument is not an instance of its expected type
     */
    public constructor(amplitude: Envelope, omega: Omega, phase: Angle) {
        if (!(amplitude instanceof Envelope)) {
            throw new TypeError("Epicycle amplitude must be an Envelope.");
        }
        if (!(omega instanceof Omega)) {
            throw new TypeError("Epicycle omega must be an Omega.");
        }
        if (!(phase instanceof Angle)) {
            throw new TypeError("Epicycle phase must be an Angle.");
        }
        this.amplitude = amplitude;
        this.omega = omega;
        this.phase = phase;
    }

    /**
     * Returns the amplitude envelope of this phasor.
     *
     * The envelope is shared rather than copied, so the returned instance is the
     * one supplied at construction.
     *
     * @returns the amplitude envelope
     */
    public getAmplitude(): Envelope {
        return this.amplitude;
    }

    /**
     * Returns the angular rate of this phasor.
     *
     * The rate is expressed in radians per second and is the omega of the carrier
     * argument `omega * t + phase`.
     *
     * @returns the angular rate
     */
    public getOmega(): Omega {
        return this.omega;
    }

    /**
     * Returns the phase offset of this phasor.
     *
     * The offset is an angle added to the accumulated rotation, normalised into
     * one full turn by its own type.
     *
     * @returns the phase offset
     */
    public getPhase(): Angle {
        return this.phase;
    }

    /**
     * Evaluates the complex contribution of this phasor at a point in time.
     *
     * The amplitude is sampled at the same time and multiplied by
     * `exp(i*(omega*t + phase))`, so the returned value is complex. Its magnitude
     * is the envelope level and its argument is the accumulated rotation; the
     * real part is the cosine carrier and the imaginary part is the sine carrier.
     *
     * @param time the finite time in seconds at which to evaluate this phasor
     * @returns the complex contribution at the specified time
     * @throws {TypeError} if the time is not a finite number
     */
    public value(time: number): Complex {
        if (!isNumber(time)) {
            throw new TypeError("Epicycle time must be a finite number of seconds.");
        }
        const rotation: number = this.omega.getRadianPerSecond() * time + this.phase.toRadianValue();
        return new Complex(Math.cos(rotation), Math.sin(rotation)).multiply(this.amplitude.at(time));
    }

    /**
     * Evaluates the complex contribution of this phasor at a point in time.
     *
     * This is an alias for `value`, kept for symmetry with `Envelope.at` and
     * `Waveform.at`, and it rejects the same non-finite times.
     *
     * @param time the finite time in seconds at which to evaluate this phasor
     * @returns the complex contribution at the specified time
     * @throws {TypeError} if the time is not a finite number
     */
    public at(time: number): Complex {
        return this.value(time);
    }

    /**
     * Returns the symbolic derivative phasor.
     *
     * Differentiating `amplitude * exp(i*(omega*t + phase))` with a constant
     * amplitude multiplies the amplitude by the angular rate and advances the
     * phase by a quarter turn, because the derivative equals `i*omega` times the
     * original value. The result is another phasor rather than an approximation.
     *
     * @returns the derivative phasor
     * @throws {RangeError} if the amplitude is not constant
     */
    public derivate(): Epicycle;
    /**
     * Evaluates the complex derivative of the contribution at a point in time.
     *
     * A constant amplitude gives the exact symbolic derivative `i*omega` times
     * the value at that time. A varying amplitude falls back to a symmetric
     * finite difference with a step of 1E-6 seconds widened to 1E-6 times
     * `|time|` where the time exceeds one second, so the estimate loses relative
     * accuracy near sharp envelope transitions.
     *
     * @param time the finite time in seconds at which to differentiate
     * @returns the complex derivative at the specified time
     * @throws {TypeError} if the time is not a finite number
     */
    public derivate(time: number): Complex;
    public derivate(time?: number): Epicycle | Complex {
        const rate: number = this.omega.getRadianPerSecond();
        if (time === undefined) {
            if (!this.amplitude.isConstant()) {
                throw new RangeError("Epicycle derivate() requires a constant amplitude.");
            }
            return new Epicycle(new Envelope(this.amplitude.getConstant() * rate), this.omega, this.phase.plus(useRadian(QuarterTurn)));
        }
        if (!isNumber(time)) {
            throw new TypeError("Epicycle time must be a finite number of seconds.");
        }
        if (this.amplitude.isConstant()) {
            return this.value(time).multiply(new Complex(0, rate));
        }
        const step: number = DerivativeStep * Math.max(1, Math.abs(time));
        return this.value(time + step).minus(this.value(time - step)).divide(2 * step);
    }

    /**
     * Returns the symbolic antiderivative phasor.
     *
     * Integrating with a constant amplitude divides the amplitude by the angular
     * rate and retreats the phase by a quarter turn, because dividing by `i*omega`
     * is a quarter-turn rotation. The rate must not be zero, because a static
     * phasor has no antiderivative of this form.
     *
     * @returns the antiderivative phasor
     * @throws {RangeError} if the amplitude is not constant or the rate is zero
     */
    public integral(): Epicycle;
    /**
     * Integrates the complex contribution over a closed interval.
     *
     * A constant amplitude and a non-zero rate give the exact symbolic result,
     * while a varying amplitude or a static rate falls back to adaptive Simpson
     * quadrature of the complex value with a tolerance of 1E-10 and a recursion
     * depth of twenty. The numerical result is therefore an approximation, and a
     * reversed interval is rejected rather than negated.
     *
     * @param start the inclusive lower bound in seconds
     * @param end the inclusive upper bound in seconds, not before the start
     * @returns the complex definite integral of the contribution over the interval
     * @throws {TypeError} if a bound is missing or is not a finite number
     * @throws {RangeError} if the end precedes the start
     */
    public integral(start: number, end: number): Complex;
    public integral(start?: number, end?: number): Epicycle | Complex {
        const rate: number = this.omega.getRadianPerSecond();
        if (start === undefined && end === undefined) {
            if (!this.amplitude.isConstant()) {
                throw new RangeError("Epicycle integral() requires a constant amplitude.");
            }
            if (rate === 0) {
                throw new RangeError("Epicycle integral() requires a non-zero angular rate.");
            }
            return new Epicycle(new Envelope(this.amplitude.getConstant() / rate), this.omega, this.phase.minus(useRadian(QuarterTurn)));
        }
        if (start === undefined || end === undefined) {
            throw new TypeError("Epicycle integral requires both a start and an end.");
        }
        if (!isNumber(start) || !isNumber(end)) {
            throw new TypeError("Epicycle integral bounds must be finite numbers of seconds.");
        }
        if (end < start) {
            throw new RangeError("Epicycle integral end must not precede the start.");
        }
        if (this.amplitude.isConstant() && rate !== 0) {
            const level: number = this.amplitude.getConstant();
            const antiderivative: Epicycle = new Epicycle(new Envelope(level / rate), this.omega, this.phase.minus(useRadian(QuarterTurn)));
            return antiderivative.value(end).minus(antiderivative.value(start));
        }
        return integrate((time: number): Complex => this.value(time), start, end);
    }

    /**
     * Compares the parameters of this phasor with another.
     *
     * The angular rate and phase are compared within the tolerance. The amplitudes
     * are compared only when both are constant, so an evaluator-backed amplitude
     * never equals a constant one and two evaluator-backed amplitudes match on
     * their constant flags alone. Values are sampled nowhere, so the comparison
     * is cheap regardless of how irregular the envelopes are.
     *
     * @param other the phasor to compare with this one
     * @param epsilon the tolerance applied to the rate and phase; defaults to 1E-9
     * @returns `true` if the parameters match within the tolerance
     * @throws {TypeError} if the operand is not an epicycle or the tolerance is
     *         not a finite number
     */
    public equals(other: Epicycle, epsilon: number = 1E-9): boolean {
        if (!(other instanceof Epicycle)) {
            throw new TypeError("Epicycle operand must be an Epicycle.");
        }
        if (!isNumber(epsilon)) {
            throw new TypeError("Epicycle epsilon must be a finite number.");
        }
        return this.omega.equals(other.omega, epsilon)
            && this.phase.equals(other.phase, epsilon)
            && this.amplitude.isConstant() === other.amplitude.isConstant()
            && (!this.amplitude.isConstant() || Math.abs(this.amplitude.getConstant() - other.amplitude.getConstant()) <= Math.abs(epsilon));
    }

    /**
     * Renders the parameters of this phasor for debugging.
     *
     * Each component uses its own rendering, so a constant amplitude reports its
     * level while an evaluator-backed one reports only that it is a function.
     *
     * @returns a description containing the amplitude, rate and phase
     */
    public toString(): string {
        return `Epicycle(${this.amplitude}, ${this.omega}, ${this.phase})`;
    }
}

export { isEpicycle } from "#semantic/guard";
