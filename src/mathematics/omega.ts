import { isNumber } from "#semantic/guard";
import { Angle, useRadian } from "#semantic/mathematics/angle";
import { Frequency } from "#semantic/mathematics/frequency";
import { OmegaSymbol } from "#semantic/symbol";

/**
 * Full-turn magnitude in radians, that is, `2 * PI`.
 *
 * A cyclic rate is converted into an angular rate by multiplying by this value, and
 * an angular rate is converted back into a cyclic rate by dividing by it.
 */
const FullTurn: number = Math.PI * 2;

/**
 * An angular rate measured in radians per second.
 *
 * An instance can be built from a rate directly or from an angle covered over a positive
 * duration. The angle form stores the angle and the duration and derives the rate from
 * them; the rate form stores the rate and treats the angle as one second of rotation.
 *
 * Because angles normalise into one full turn, a whole-turn angle is indistinguishable
 * from no rotation; use the rate form for faster rotations. Building from a rate stores
 * the rate as an angle over one second, so `getAngle()` then reports the rate wrapped
 * into a single turn.
 *
 * The stored rate is never negative and is finite for every rate-form instance; an
 * angle divided by a duration short enough to overflow the division stores positive
 * infinity instead. Instances are immutable, so accessors and conversions never change
 * the receiver. The protected, symbol-keyed `OmegaSymbol` member brands instances for
 * the `isOmega()` guard.
 */
export class Omega {

    private readonly radianPerSecond: number;
    private readonly angle: Angle;
    private readonly duration: number;
    protected readonly [OmegaSymbol]: symbol = OmegaSymbol;

    /**
     * Creates an angular rate from an angle covered over a duration, or from a rate.
     *
     * With an `Angle` and a duration the rate is the angle's radian measure divided by
     * the duration, while `getAngle()` returns the supplied angle itself and
     * `getDuration()` returns the duration. With a number the value is taken as a rate
     * in radians per second, the stored angle becomes that many radians over one second
     * and `getDuration()` reports one second. A numeric parameter always selects the
     * rate form, so a second argument is ignored in that case.
     *
     * Zero is accepted by both forms: a zero angle over any positive duration and a zero
     * rate both describe a static rotation whose period is positive infinity. A negative
     * rate is rejected rather than interpreted as a reverse direction, and an `Angle`
     * parameter must be paired with a positive finite duration. Because the angle is
     * normalised into one full turn before use, the derived rate is always strictly
     * below one turn per duration; the division itself is unchecked, so a duration
     * short enough to overflow it stores positive infinity.
     *
     * @param parameter - the angle covered over `duration` when it is an `Angle`, or the
     *        rate in radians per second when it is a number
     * @param duration - the positive duration in seconds over which an `Angle` parameter
     *        is covered; required for the angle form and ignored for the rate form
     * @throws {TypeError} when the parameter is neither an `Angle` nor a finite number,
     *         when an `Angle` is given without a duration, or when the duration is not a
     *         finite number
     * @throws {RangeError} when the duration paired with an `Angle` is finite and zero
     *         or negative, or when a finite rate is negative
     */
    public constructor(angle: Angle, duration: number);
    public constructor(radianPerSecond: number);
    public constructor(parameter: Angle | number, duration?: number) {
        if (parameter instanceof Angle) {
            if (duration === undefined) {
                throw new TypeError("Omega duration is required when constructing from an angle.");
            }
            if (!isNumber(duration)) {
                throw new TypeError("Omega duration must be a finite number of seconds.");
            }
            if (duration <= 0) {
                throw new RangeError("Omega duration must be positive.");
            }
            this.radianPerSecond = parameter.toRadianValue() / duration;
            this.angle = parameter;
            this.duration = duration;
            return;
        }
        if (!isNumber(parameter)) {
            throw new TypeError("Omega rate must be a finite number of radians per second.");
        }
        if (parameter < 0) {
            throw new RangeError("Omega rate must not be negative.");
        }
        this.radianPerSecond = parameter;
        this.angle = useRadian(parameter);
        this.duration = 1;
    }

    /**
     * Creates an angular rate from radians per second.
     *
     * This is the rate form of the constructor: the rate is stored verbatim and the
     * stored angle becomes that many radians over one second, so `getAngle()` reports
     * the rate wrapped into `[0, 2 * PI)` whenever the rate reaches one full turn.
     * A rate of zero produces a static rotation whose period is positive infinity.
     *
     * Each call returns a new, independent instance and no shared state is read or
     * written.
     *
     * @param rate - the finite, non-negative rate in radians per second
     * @returns a new angular rate of `rate` radians per second
     * @throws {TypeError} when the rate is not a finite number
     * @throws {RangeError} when the rate is a finite negative number
     */
    public static useRadianPerSecond(rate: number): Omega {
        return new Omega(rate);
    }

    /**
     * Creates an angular rate from a cyclic rate in hertz.
     *
     * The cyclic rate is converted by multiplying by `2 * PI`, so the result completes
     * `hertz` turns per second; one hertz yields `2 * PI` radians per second, and a
     * fractional rate such as `0.5` describes half a turn per second. The argument is
     * validated before the multiplication, so a rejected value never reaches the
     * constructor, and zero hertz describes a static rotation whose period is positive
     * infinity.
     *
     * The result is built through the rate form, so `getAngle()` reports the rate
     * wrapped into a single turn while `getRadianPerSecond()` keeps the full value.
     *
     * @param hertz - the finite, non-negative cyclic rate in cycles per second
     * @returns a new angular rate of `2 * PI * hertz` radians per second
     * @throws {TypeError} when the rate is not a finite number, or when
     *         `2 * PI * hertz` overflows to infinity and the constructor rejects it
     * @throws {RangeError} when the rate is a finite negative number
     */
    public static useHertz(hertz: number): Omega {
        if (!isNumber(hertz)) {
            throw new TypeError("Omega hertz must be a finite number.");
        }
        if (hertz < 0) {
            throw new RangeError("Omega hertz must not be negative.");
        }
        return new Omega(hertz * FullTurn);
    }

    /**
     * Returns the angle covered over one duration.
     *
     * The angle is normalised into one full turn, so a stored angle of one turn or
     * more is reported modulo that turn. When the instance was built from a rate,
     * the duration is one second and this value is the rate wrapped into a turn.
     *
     * The angle form returns the very `Angle` supplied to the constructor, so the
     * result keeps that angle's unit; the rate form returns a radian angle. Angles
     * are immutable, so no copy is made and no state changes.
     *
     * @returns the stored angle, in its own unit, normalised into one full turn
     */
    public getAngle(): Angle {
        return this.angle;
    }

    /**
     * Returns the duration in seconds over which the stored angle is covered.
     *
     * The duration is positive; an instance built from a rate uses one second.
     *
     * The value is the divisor used to derive `getRadianPerSecond()` in the angle
     * form, and it is exactly `1` in the rate form. It is never zero or negative, so
     * it can be used as a divisor without a guard.
     *
     * @returns the positive duration in seconds
     */
    public getDuration(): number {
        return this.duration;
    }

    /**
     * Returns the rate in radians per second.
     *
     * This is the primary stored measure, and it is never negative.
     *
     * In the angle form the value is the angle's radian measure divided by the
     * duration, so it is the average rate over that duration and stays strictly
     * below one turn per duration; in the rate form it is the constructor argument
     * unchanged. Zero means a static rotation rather than an error, while a duration
     * short enough to overflow the division reports `Number.POSITIVE_INFINITY`.
     *
     * @returns the non-negative rate in radians per second
     */
    public getRadianPerSecond(): number {
        return this.radianPerSecond;
    }

    /**
     * Returns the cyclic rate implied by this angular rate.
     *
     * The rate is divided by `2 * PI`, one full turn per cycle, so a rate of
     * `2 * PI` radians per second reports one hertz and a zero rate reports zero.
     * The result is non-negative because the stored rate is, and the conversion has
     * no side effects.
     *
     * @returns the non-negative rate in cycles per second, infinite only when the
     *          stored rate is infinite
     */
    public getHertz(): number {
        return this.radianPerSecond / FullTurn;
    }

    /**
     * Returns the duration of one cycle in seconds.
     *
     * A rate of zero describes a static rotation, so its period is positive infinity
     * rather than a division by zero.
     *
     * For every other rate the value is the reciprocal of `getHertz()`, so it is
     * measured in seconds and shrinks as the rate grows; a rate so small that the
     * reciprocal exceeds the largest representable number also reports positive
     * infinity, and an infinite rate reports zero.
     *
     * @returns the period in seconds, `Number.POSITIVE_INFINITY` for a zero or
     *          vanishingly small rate, and `0` for an infinite rate
     */
    public getPeriod(): number {
        const hertz: number = this.getHertz();
        return hertz === 0 ? Number.POSITIVE_INFINITY : 1 / hertz;
    }

    /**
     * Converts this angular rate into its cyclic equivalent.
     *
     * The stored rate is divided by `2 * PI` and wrapped in a new `Frequency`, so the
     * result reports `getHertz()` cycles per second. The receiver is left unchanged.
     *
     * @returns a new `Frequency` of `getHertz()` cycles per second
     * @throws {TypeError} when the stored rate is infinite, because `Frequency`
     *         accepts only finite rates
     */
    public toFrequency(): Frequency {
        return new Frequency(this.getHertz());
    }

    /**
     * Returns the angle travelled after a given elapsed time.
     *
     * The angle is the rate multiplied by the time in seconds and is normalised into
     * one full turn, so a negative time rotates backwards and a whole number of
     * turns reports zero.
     *
     * The result is always a radian angle, whatever unit the stored angle uses, and
     * the normalisation discards whole turns: one second at one hertz reports the zero
     * angle rather than a full turn. The receiver is left unchanged.
     *
     * @param time - the elapsed time in seconds, which may be negative or zero
     * @returns the angle travelled, in radians and normalised into `[0, 2 * PI)`
     * @throws {TypeError} when the time is not a finite number, or when the stored
     *         rate is infinite and the product is therefore not finite
     */
    public phase(time: number): Angle {
        if (!isNumber(time)) {
            throw new TypeError("Omega time must be a finite number of seconds.");
        }
        return useRadian(this.radianPerSecond * time);
    }

    /**
     * Compares this angular rate with another within a tolerance.
     *
     * The rates are compared in radians per second directly, and the tolerance is
     * used as an absolute value.
     *
     * No normalisation or wrapping is applied, so two rates that differ by a whole
     * number of turns are unequal unless the tolerance covers the difference; this is
     * a comparison of rates, not of the angles they would cover in the same time. A
     * zero rate therefore matches only a rate within the tolerance of zero.
     *
     * @param other - the angular rate to compare against
     * @param epsilon - the tolerance in radians per second, defaulting to `1E-9` and
     *        treated as an absolute value
     * @returns `true` when the rates differ by no more than the tolerance
     * @throws {TypeError} when the operand is not an `Omega`, or when the tolerance is
     *         not a finite number
     */
    public equals(other: Omega, epsilon: number = 1E-9): boolean {
        if (!(other instanceof Omega)) {
            throw new TypeError("Omega operand must be an Omega.");
        }
        if (!isNumber(epsilon)) {
            throw new TypeError("Omega epsilon must be a finite number.");
        }
        return Math.abs(this.radianPerSecond - other.radianPerSecond) <= Math.abs(epsilon);
    }

    /**
     * Returns the rate in radians per second.
     *
     * The number is rendered with the default JavaScript number-to-string conversion,
     * so a whole-valued rate loses its decimal point (a zero rate appears as `0`), and
     * the unit suffix is `rad/s` with no separating space.
     *
     * @returns the rate followed by the angular unit, such as `6.283185307179586rad/s`
     */
    public toString(): string {
        return `${this.radianPerSecond}rad/s`;
    }
}

/**
 * Tests whether a value carries the `Omega` brand.
 *
 * The predicate is defined in the guard module alongside the other brand checks and
 * re-exported here for convenience. Only a symbol-typed property at the `OmegaSymbol`
 * key is inspected, so an object that advertises the brand passes without its methods
 * being validated.
 *
 * @param target - the value to be inspected
 * @returns `true` when the value advertises the `Omega` brand
 */
export { isOmega } from "#semantic/guard";
