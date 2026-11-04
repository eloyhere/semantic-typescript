import { isNumber } from "#semantic/guard";
import { AngleSymbol } from "#semantic/symbol";

/**
 * Full-turn magnitude of an angle measured in radians.
 *
 * One turn spans the half-open interval `[0, 2 * PI)`.
 */
const RadianUnit: number = Math.PI * 2;
/**
 * Full-turn magnitude of an angle measured in degrees.
 *
 * One turn spans the half-open interval `[0, 360)`.
 */
const DegreeUnit: number = 360;
/**
 * Tolerance for detecting the tangent singularity.
 *
 * A radian measure whose cosine magnitude is at most this value is treated as a
 * quarter turn, at which the tangent is undefined.
 */
const Tolerance: number = 1E-12;

const requireFinite: (value: unknown, name: string) => number = (value: unknown, name: string): number => {
    if (!isNumber(value)) {
        throw new TypeError(`${name} must be a finite number.`);
    }
    return value;
}

const requireRange: (value: unknown, minimum: number, maximum: number, name: string) => number =
    (value: unknown, minimum: number, maximum: number, name: string): number => {
        const checked: number = requireFinite(value, name);
        if (checked < minimum || checked > maximum) {
            throw new RangeError(`${name} must be within [${minimum}, ${maximum}].`);
        }
        return checked;
    }

/**
 * Normalises a value into the half-open interval `[0, unit)`.
 *
 * A negative remainder gains one unit, and an exact multiple of the unit becomes
 * positive zero rather than `-0`.
 */
const normalize: (value: number, unit: number) => number = (value: number, unit: number): number => {
    const remainder: number = value % unit;
    const normalized: number = remainder < 0 ? remainder + unit : remainder;
    return normalized === 0 ? 0 : normalized;
}

/**
 * Creates an angle from a measure in radians.
 *
 * The measure is normalised into `[0, 2 * PI)`, so a value of one full turn or
 * more is reduced to the equivalent measure within a single turn, a negative
 * value gains a full turn, and an exact multiple of a turn collapses to positive
 * zero. The full-turn unit of the result is `2 * PI`, which `isRadian()` reports.
 *
 * @param radian the radian measure, wrapped into one positive turn
 * @returns an angle whose full-turn unit is `2 * PI`
 * @throws {TypeError} if the measure is not a finite number
 */
export const useRadian: (radian: number) => Angle = (radian: number): Angle => {
    return new Angle(radian, RadianUnit);
}

/**
 * Creates an angle from a measure in degrees.
 *
 * The measure is normalised into `[0, 360)`, so a value of one full turn or more
 * is reduced to the equivalent measure within a single turn, a negative value
 * gains a full turn, and an exact multiple of a turn collapses to positive zero.
 * The full-turn unit of the result is `360`, which `isDegree()` reports.
 *
 * @param radian the degree measure, wrapped into one positive turn
 * @returns an angle whose full-turn unit is `360`
 * @throws {TypeError} if the measure is not a finite number
 */
export const useDegree: (radian: number) => Angle = (radian: number): Angle => {
    return new Angle(radian, DegreeUnit);
}

/**
 * Builds an angle from its sine.
 *
 * The principal arcsine lies in `[-PI / 2, PI / 2]`; the result is normalised, so
 * a negative principal value is expressed as the equivalent measure within one
 * positive turn. The boundaries map to quarter turns: a sine of `1` yields the
 * quarter turn and a sine of `-1` yields three quarters of a turn, while a sine of
 * `0` yields the zero angle.
 *
 * @param radian the sine of the angle, within `[-1, 1]`
 * @returns the principal angle in radians, normalised into `[0, 2 * PI)`
 * @throws {TypeError} if the operand is not a finite number
 * @throws {RangeError} if the operand lies outside `[-1, 1]`
 */
export const arcsine: (radian: number) => Angle = (radian: number): Angle => {
    return useRadian(Math.asin(requireRange(radian, -1, 1, "arcsine operand")));
}

/**
 * Builds an angle from its cosine.
 *
 * The principal arccosine lies in `[0, PI]`, which is already within one turn, so
 * normalisation never changes it. A cosine of `1` yields the zero angle, a cosine
 * of `0` yields the quarter turn and a cosine of `-1` yields half a turn.
 *
 * @param radian the cosine of the angle, within `[-1, 1]`
 * @returns the principal angle in radians, within `[0, PI]`
 * @throws {TypeError} if the operand is not a finite number
 * @throws {RangeError} if the operand lies outside `[-1, 1]`
 */
export const arccosine: (radian: number) => Angle = (radian: number): Angle => {
    return useRadian(Math.acos(requireRange(radian, -1, 1, "arccosine operand")));
}

/**
 * Builds an angle from a tangent-like ratio.
 *
 * The principal arctangent lies in `(-PI / 2, PI / 2)`; the result is normalised,
 * so a negative principal value becomes its equivalent in `(3 * PI / 2, 2 * PI)`
 * and a ratio of zero yields the zero angle. Because one ratio cannot distinguish
 * opposite quadrants, use `arctangent2` when both coordinates are known.
 *
 * @param radian the finite ratio to invert
 * @returns the principal angle in radians, normalised into `[0, 2 * PI)`
 * @throws {TypeError} if the operand is not a finite number
 */
export const arctangent: (radian: number) => Angle = (radian: number): Angle => {
    return useRadian(Math.atan(requireFinite(radian, "arctangent operand")));
}

/**
 * Builds the angle of a point in the Cartesian plane.
 *
 * The quadrant is decided by both coordinates, so the angle of `(-1, -1)` is three
 * quarters of a turn rather than one quarter. An origin written with positive zeros
 * yields the zero angle, while signed zeros otherwise follow `Math.atan2`; the
 * two-argument arctangent result is normalised into one positive turn.
 *
 * @param y the finite vertical coordinate
 * @param x the finite horizontal coordinate
 * @returns the quadrant-aware angle in radians, normalised into `[0, 2 * PI)`
 * @throws {TypeError} if either coordinate is not a finite number
 */
export const arctangent2: (y: number, x: number) => Angle = (y: number, x: number): Angle => {
    return useRadian(Math.atan2(requireFinite(y, "arctangent2 y"), requireFinite(x, "arctangent2 x")));
}

/**
 * Builds the inverse hyperbolic sine of a value.
 *
 * The inverse hyperbolic sine is defined for every finite number and preserves the
 * sign of its operand before normalisation; the result is wrapped into a single
 * turn because an angle always represents the equivalent rotation rather than the
 * raw real value. A zero operand yields the zero angle.
 *
 * @param radian the finite value to invert
 * @returns the inverse hyperbolic sine, normalised into `[0, 2 * PI)`
 * @throws {TypeError} if the operand is not a finite number
 */
export const arcHyperbolicSine: (radian: number) => Angle = (radian: number): Angle => {
    return useRadian(Math.asinh(requireFinite(radian, "arcHyperbolicSine operand")));
}

/**
 * Builds the inverse hyperbolic cosine of a value.
 *
 * The principal value is non-negative; values beyond one full turn are wrapped, so
 * a large operand yields its equivalent measure within a single turn. The lower
 * boundary `1` yields the zero angle.
 *
 * @param radian the value to invert, greater than or equal to one
 * @returns the inverse hyperbolic cosine, normalised into `[0, 2 * PI)`
 * @throws {TypeError} if the operand is not a finite number
 * @throws {RangeError} if the operand is less than one
 */
export const arcHyperbolicCosine: (radian: number) => Angle = (radian: number): Angle => {
    return useRadian(Math.acosh(requireRange(radian, 1, Number.POSITIVE_INFINITY, "arcHyperbolicCosine operand")));
}

/**
 * Builds the inverse hyperbolic tangent of a value.
 *
 * The operand must lie strictly between minus one and one, where the principal
 * value is finite; the closer the operand is to either boundary, the larger the
 * magnitude of the result, without reaching it. The result is normalised into one
 * positive turn, and a zero operand yields the zero angle.
 *
 * @param radian the value to invert, strictly between `-1` and `1`
 * @returns the inverse hyperbolic tangent, normalised into `[0, 2 * PI)`
 * @throws {TypeError} if the operand is not a finite number
 * @throws {RangeError} if the operand is at most `-1` or at least `1`
 */
export const arcHyperbolicTangent: (radian: number) => Angle = (radian: number): Angle => {
    const checked: number = requireFinite(radian, "arcHyperbolicTangent operand");
    if (checked <= -1 || checked >= 1) {
        throw new RangeError("arcHyperbolicTangent operand must be within (-1, 1).");
    }
    return useRadian(Math.atanh(checked));
}

/**
 * An immutable angle normalised into `[0, unit)`, where `unit` is the full-turn measure.
 *
 * Radian angles use `2 * PI` and degree angles use `360`; the constructor accepts any
 * positive finite unit, so a custom turn such as gradians is also expressible. The stored
 * measure is therefore never negative and always strictly below one turn, and a measure
 * that is an exact multiple of the unit collapses to zero.
 *
 * Addition and subtraction accept angles in mixed units and convert the operand into the
 * receiver's unit before taking the result, which keeps the receiver's unit. Multiplication
 * and division accept only scalar factors and also keep that unit, and trigonometric
 * functions convert to radians first. No method mutates the instance: a transformation
 * returns a new angle, or the receiver itself when a conversion is a no-op. Angles appear
 * as the argument of `Complex`, as the rotation covered by an `Omega`, and as the phase of
 * a `Tone`.
 */
export class Angle {

    private readonly value: number;
    private readonly unit: number;
    protected readonly [AngleSymbol]: symbol = AngleSymbol;

    /**
     * Creates the zero radian angle.
     *
     * The value defaults to `0` and the unit to `2 * PI`, so the result is the zero
     * radian angle.
     */
    public constructor();
    /**
     * Creates a radian angle from a measure.
     *
     * The measure is normalised into `[0, 2 * PI)`: a value of one full turn or
     * more is reduced modulo a turn, a negative value gains a turn, and an exact
     * multiple of a turn collapses to positive zero.
     *
     * @param value the finite radian measure, wrapped into one positive turn
     * @throws {TypeError} if the measure is not a finite number
     */
    public constructor(value: number);
    /**
     * Creates an angle from a measure in an arbitrary unit.
     *
     * The unit is the magnitude of one full turn, so gradians use `400`. It is
     * validated before the measure and must be a positive finite number; the
     * measure is then normalised into `[0, unit)`.
     *
     * @param value the finite measure, wrapped into one positive turn
     * @param unit the positive, finite full-turn magnitude of the unit
     * @throws {TypeError} if either the unit or the measure is not a finite number
     * @throws {RangeError} if the unit is not positive
     */
    public constructor(value: number, unit: number);
    public constructor(value: number = 0, unit: number = RadianUnit) {
        const checkedUnit: number = requireFinite(unit, "Angle unit");
        if (checkedUnit <= 0) {
            throw new RangeError("Angle unit must be a positive finite number.");
        }
        this.unit = checkedUnit;
        this.value = normalize(requireFinite(value, "Angle value"), checkedUnit);
    }

    /**
     * Returns the normalised measure in this angle's own unit.
     *
     * The value is never negative and is always strictly below `getUnit()`, so one
     * full turn and zero are indistinguishable. The stored measure is returned
     * unchanged; it is neither converted nor rounded, and reading it has no side
     * effects.
     *
     * @returns the measure in this angle's unit, within `[0, unit)`
     */
    public getValue(): number {
        return this.value;
    }

    /**
     * Returns the full-turn magnitude of this angle's unit.
     *
     * It is `2 * PI` for radian angles, `360` for degree angles, and the value
     * supplied to the constructor otherwise. The unit is always a positive finite
     * number and is the exclusive upper bound of `getValue()`.
     *
     * @returns the full-turn magnitude in this angle's own unit
     */
    public getUnit(): number {
        return this.unit;
    }

    /**
     * Returns the measure converted to radians.
     *
     * The stored measure is scaled by `2 * PI / getUnit()` without further
     * normalisation, so the result also lies within one full turn. Conversion is
     * pure: the angle is not modified and its own unit is unchanged.
     *
     * @returns the measure in radians, within `[0, 2 * PI)`
     */
    public toRadianValue(): number {
        return this.value / this.unit * RadianUnit;
    }

    /**
     * Returns the measure converted to degrees.
     *
     * The stored measure is scaled by `360 / getUnit()` without further
     * normalisation, so the result also lies within one full turn. Conversion is
     * pure: the angle is not modified and its own unit is unchanged.
     *
     * @returns the measure in degrees, within `[0, 360)`
     */
    public toDegreeValue(): number {
        return this.value / this.unit * DegreeUnit;
    }

    /**
     * Adds another angle to this one.
     *
     * The operand is converted into this angle's unit before the sum is taken and
     * the result is normalised, so a sum of one full turn or more wraps. The result
     * keeps this angle's unit rather than the operand's, and neither input is
     * modified.
     *
     * @param other the angle to be added
     * @returns a new angle holding the sum, expressed in this angle's unit
     * @throws {TypeError} if the operand is not an `Angle`
     */
    public plus(other: Angle): Angle {
        return new Angle(this.value + requireAngle(other, "Angle operand").value / other.unit * this.unit, this.unit);
    }

    /**
     * Subtracts another angle from this one.
     *
     * The operand is converted into this angle's unit before the difference is
     * taken and the result is normalised, so a difference below zero wraps into the
     * upper part of the turn. The result keeps this angle's unit, and neither input
     * is modified.
     *
     * @param other the angle to be subtracted
     * @returns a new angle holding the difference, expressed in this angle's unit
     * @throws {TypeError} if the operand is not an `Angle`
     */
    public minus(other: Angle): Angle {
        return new Angle(this.value - requireAngle(other, "Angle operand").value / other.unit * this.unit, this.unit);
    }

    /**
     * Scales this angle by a finite factor.
     *
     * The product is normalised into the same unit, so a whole-number factor
     * discards the winding count and returns only the position within one turn.
     * A factor of zero yields the zero angle, and a negative factor reverses the
     * direction before normalisation.
     *
     * @param scale the finite factor to multiply by
     * @returns a new angle holding the scaled measure, in this angle's unit
     * @throws {TypeError} if the factor is not a finite number
     */
    public multiply(scale: number): Angle {
        return new Angle(this.value * requireFinite(scale, "Angle scale"), this.unit);
    }

    /**
     * Divides this angle by a finite, non-zero factor.
     *
     * The quotient is normalised into the same unit, so a value outside one turn
     * wraps and a negative divisor reverses the direction before normalisation.
     * Division by zero is rejected rather than producing an infinite measure.
     *
     * @param scale the finite, non-zero factor to divide by
     * @returns a new angle holding the quotient, in this angle's unit
     * @throws {TypeError} if the factor is not a finite number
     * @throws {RangeError} if the factor is zero
     */
    public divide(scale: number): Angle {
        const checked: number = requireFinite(scale, "Angle divisor");
        if (checked === 0) {
            throw new RangeError("Angle divisor must not be zero.");
        }
        return new Angle(this.value / checked, this.unit);
    }

    /**
     * Tests whether this angle is expressed in radians.
     *
     * The unit is compared with `2 * PI` exactly, so a custom unit equal to that
     * value is also treated as radians.
     *
     * @returns `true` if this angle's full-turn unit is `2 * PI`
     */
    public isRadian(): boolean {
        return this.unit === RadianUnit;
    }

    /**
     * Tests whether this angle is expressed in degrees.
     *
     * The unit is compared with `360` exactly, so a custom unit equal to that value
     * is also treated as degrees.
     *
     * @returns `true` if this angle's full-turn unit is `360`
     */
    public isDegree(): boolean {
        return this.unit === DegreeUnit;
    }

    /**
     * Converts this angle to radians.
     *
     * An angle already in radians is returned as the same instance, so the
     * conversion preserves identity whenever it is a no-op; any other unit is
     * converted and normalised into `[0, 2 * PI)`. The receiver is never mutated.
     *
     * @returns this angle when it is a radian angle, otherwise a new radian angle
     *          of the same measure
     */
    public toRadian(): Angle {
        if (this.isRadian()) {
            return this;
        }
        return new Angle(this.toRadianValue(), RadianUnit);
    }

    /**
     * Converts this angle to degrees.
     *
     * An angle already in degrees is returned as the same instance; any other unit
     * is converted and normalised into `[0, 360)`. The receiver is never mutated.
     *
     * @returns this angle when it is a degree angle, otherwise a new degree angle
     *          of the same measure
     */
    public toDegree(): Angle {
        if (this.isDegree()) {
            return this;
        }
        return new Angle(this.toDegreeValue(), DegreeUnit);
    }

    /**
     * Returns the sine of this angle.
     *
     * The measure is converted to radians before evaluation.
     *
     * @returns the sine, within `[-1, 1]`
     */
    public sine(): number {
        return Math.sin(this.toRadianValue());
    }

    /**
     * Returns the cosine of this angle.
     *
     * The measure is converted to radians before evaluation.
     *
     * @returns the cosine, within `[-1, 1]`
     */
    public cosine(): number {
        return Math.cos(this.toRadianValue());
    }

    /**
     * Returns the tangent of this angle.
     *
     * The measure is converted to radians before evaluation. The tangent is
     * undefined at odd quarter turns, which the singularity tolerance detects
     * before a huge value could be produced.
     *
     * @returns the tangent of the converted measure
     * @throws {RangeError} if the cosine magnitude is at most the singularity
     *         tolerance, as happens at odd quarter turns
     */
    public tangent(): number {
        const radian: number = this.toRadianValue();
        if (Math.abs(Math.cos(radian)) <= Tolerance) {
            throw new RangeError("Tangent is undefined at odd quarter turns.");
        }
        return Math.tan(radian);
    }

    /**
     * Returns the hyperbolic sine of this angle's radian measure.
     *
     * The result is non-negative, because the measure normalised at construction is
     * never negative.
     *
     * @returns the hyperbolic sine of the radian measure
     */
    public hyperbolicSine(): number {
        return Math.sinh(this.toRadianValue());
    }

    /**
     * Returns the hyperbolic cosine of this angle's radian measure.
     *
     * The result is at least one, and equals one only at the zero angle.
     *
     * @returns the hyperbolic cosine of the radian measure
     */
    public hyperbolicCosine(): number {
        return Math.cosh(this.toRadianValue());
    }

    /**
     * Returns the hyperbolic tangent of this angle's radian measure.
     *
     * The result lies in `[0, 1)`, approaching one as the measure grows.
     *
     * @returns the hyperbolic tangent of the radian measure
     */
    public hyperbolicTangent(): number {
        return Math.tanh(this.toRadianValue());
    }

    /**
     * Compares this angle with another within a tolerance.
     *
     * The radian difference is wrapped into `[-PI, PI)` before its magnitude is
     * compared with the tolerance, so the comparison follows the shortest turn and
     * treats zero and one full turn as equal. Both angles are converted to radians,
     * neither is modified, and a negative tolerance is compared by magnitude, so it
     * behaves like its positive counterpart.
     *
     * @param other the angle to be compared
     * @param epsilon the tolerance in radians, defaulting to `1E-9`
     * @returns `true` if the wrapped difference is within the tolerance
     * @throws {TypeError} if the operand is not an `Angle` or the tolerance is not
     *         a finite number
     */
    public equals(other: Angle, epsilon: number = 1E-9): boolean {
        const tolerance: number = requireFinite(epsilon, "Angle epsilon");
        const delta: number = this.toRadianValue() - requireAngle(other, "Angle operand").toRadianValue();
        const wrapped: number = ((delta + Math.PI) % RadianUnit + RadianUnit) % RadianUnit - Math.PI;
        return Math.abs(wrapped) <= Math.abs(tolerance);
    }

    /**
     * Returns the normalised measure together with its unit.
     *
     * Radian angles end in `rad`, degree angles in `deg`, and any other unit is
     * rendered as the full-turn magnitude after a slash. The numeric part uses
     * JavaScript's default number formatting, so the text depends on the stored
     * floating-point value; the angle is not modified.
     *
     * @returns a string such as `0.5rad`, `90deg` or `1/400`
     */
    public toString(): string {
        return `${this.value}${this.isDegree() ? "deg" : this.isRadian() ? "rad" : `/${this.unit}`}`;
    }
}

const requireAngle: (target: unknown, name: string) => Angle = (target: unknown, name: string): Angle => {
    if (!(target instanceof Angle)) {
        throw new TypeError(`${name} must be an Angle.`);
    }
    return target;
}

/**
 * Tests whether a value carries the `Angle` brand.
 *
 * The guard reads the symbol-keyed brand installed by the `Angle` constructor,
 * so it accepts any object or function that advertises the brand and rejects
 * values without it; the shape and behaviour of the value are not validated. The
 * implementation lives in the shared guard module and is re-exported here
 * unchanged.
 *
 * @param target the value to inspect
 * @returns `true` if the value advertises the `Angle` brand
 */
export { isAngle } from "#semantic/guard";
