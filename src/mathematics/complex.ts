import { isNumber } from "#semantic/guard";
import { Angle, arctangent2 } from "#semantic/mathematics/angle";
import { ComplexSymbol } from "#semantic/symbol";

/**
 * Absolute tolerance used by `equals` when no explicit epsilon is supplied.
 *
 * The default epsilon is `1E-9`, and `equals` compares each component difference
 * against its absolute value, so a difference of at most this amount counts as
 * equality.
 */
const Tolerance: number = 1E-9;

/**
 * Creates a complex number from polar coordinates.
 *
 * The magnitude must be finite and non-negative and the angle must be an `Angle`
 * in any unit; the rectangular components are the magnitude scaled by the cosine
 * and sine of that angle. The components are then stored without further
 * normalisation.
 *
 * @param magnitude the finite, non-negative distance from the origin
 * @param angle the polar angle, in any unit
 * @returns the complex number with those polar coordinates
 * @throws {TypeError} if the magnitude is not a finite number or the angle is not
 *         an `Angle`
 * @throws {RangeError} if the magnitude is negative
 */
export const usePolar: (magnitude: number, angle: Angle) => Complex = (magnitude: number, angle: Angle): Complex => {
    if (!isNumber(magnitude)) {
            throw new TypeError("Complex magnitude must be a finite number.");
        }
        if (magnitude < 0) {
            throw new RangeError("Complex magnitude must not be negative.");
        }
        if (!(angle instanceof Angle)) {
            throw new TypeError("Complex angle must be an Angle.");
        }
        return new Complex(magnitude * angle.cosine(), magnitude * angle.sine());
}

/**
 * An immutable complex number with real and imaginary components.
 *
 * Both components are finite real numbers stored exactly as supplied, with no
 * normalisation, so `isZero`, `isReal` and `isImaginary` are exact. The magnitude is the
 * Euclidean norm and the argument is the polar angle, so a number can be rebuilt from the
 * pair through `usePolar`.
 *
 * The argument is measured counter-clockwise from the positive real axis and is
 * normalised into one turn, `[0, 2 * PI)`. Operations evaluated from that argument,
 * namely the logarithms, `squareRoot` and `powerAsBase`, therefore have their branch cut
 * along the positive real axis: a number with a negative imaginary component uses an
 * argument close to a full turn, and its roots and non-integer powers differ from the
 * conventional principal values.
 *
 * Every result that is itself a `Complex` is built through the constructor, so an
 * operation whose components would overflow to infinity or become `NaN` throws a
 * `TypeError` rather than returning a non-finite number.
 */
export class Complex {

    private readonly real: number;
    private readonly imaginary: number;
    /**
     * The runtime brand that `isComplex` recognises.
     *
     * The symbol is stored on every instance and is not part of the public API.
     */
    protected readonly [ComplexSymbol]: symbol = ComplexSymbol;

    /**
     * Creates the complex number zero.
     *
     * Both components default to zero, so the result is the additive identity and is
     * exactly real, exactly imaginary and exactly zero at once.
     */
    public constructor();
    /**
     * Creates a complex number from its rectangular components.
     *
     * The components are stored exactly as supplied, without normalisation, and both
     * must be finite. The first argument measures along the real axis and the second
     * along the imaginary axis, whose positive direction is the direction of `i`.
     *
     * @param real the finite real component
     * @param imaginary the finite imaginary component
     * @throws {TypeError} if either component is not a finite number
     */
    public constructor(real: number, imaginary: number);
    public constructor(real: number = 0, imaginary: number = 0) {
        if (!isNumber(real)) {
            throw new TypeError("Complex real part must be a finite number.");
        }
        if (!isNumber(imaginary)) {
            throw new TypeError("Complex imaginary part must be a finite number.");
        }
        this.real = real;
        this.imaginary = imaginary;
    }

    /**
     * Returns the real component.
     *
     * The component is the value supplied at construction, without rounding, and it is
     * measured along the real axis.
     *
     * @returns the real component, unchanged since construction
     */
    public getReal(): number {
        return this.real;
    }

    /**
     * Returns the imaginary component.
     *
     * The component is the value supplied at construction, without rounding, and it is
     * the coefficient of `i`, measured along the imaginary axis.
     *
     * @returns the imaginary component, unchanged since construction
     */
    public getImaginary(): number {
        return this.imaginary;
    }

    /**
     * Returns the polar angle of this number.
     *
     * The argument is measured counter-clockwise from the positive real axis and is
     * normalised into one full turn, so it is never negative and the negative real
     * axis reports a half turn. Zero reports the zero angle.
     *
     * @returns the argument as a radian angle, normalised into `[0, 2 * PI)`
     */
    public argument(): Angle {
        return arctangent2(this.imaginary, this.real);
    }

    /**
     * Returns the counter-clockwise angle from this number to another one.
     *
     * The difference of the two arguments is normalised into one full turn, so the
     * result is never negative and a clockwise turn is reported as its positive
     * equivalent.
     *
     * @param other the complex number to turn towards
     * @returns the angular difference from this number's argument to the other's, as a
     *          radian angle
     * @throws {TypeError} if the operand is not a `Complex`
     */
    public angular(other: Complex): Angle {
        return requireComplex(other, "Complex operand").argument().minus(this.argument());
    }

    /**
     * Returns the Euclidean norm of this number.
     *
     * The norm is `Math.hypot` of the components, which avoids the intermediate
     * overflow or underflow that squaring the components could cause.
     *
     * @returns the distance from the origin, which is never negative; a distance
     *          beyond the largest finite double overflows to `Infinity`
     */
    public magnitude(): number {
        return Math.hypot(this.real, this.imaginary);
    }

    /**
     * Returns the additive inverse of this number.
     *
     * Both components are negated, which reflects the number through the origin.
     * The magnitude is unchanged and the argument advances by half a turn, so a
     * number on the positive real axis maps to the negative real axis. The
     * receiver itself is never modified.
     *
     * @returns the negated number, as a new instance
     */
    public negate(): Complex {
        return new Complex(-this.getReal(), -this.getImaginary());
    }

    /**
     * Returns a number whose components are the absolute values of this one.
     *
     * Each axis is folded independently into the non-negative half-plane, so the
     * real and imaginary parts both become non-negative. This is a component-wise
     * reflection, not the complex modulus: it preserves neither the magnitude nor
     * the argument in general. Use `magnitude` for the distance from the origin
     * and `conjugate` to mirror only the imaginary part.
     *
     * @returns the component-wise absolute value, as a new instance
     */
    public absolute(): Complex {
        return new Complex(Math.abs(this.getReal()), Math.abs(this.getImaginary()));
    }

    /**
     * Returns the complex conjugate of this number.
     *
     * The real component is kept and the imaginary component is negated, which
     * mirrors the number in the real axis and negates its argument.
     *
     * @returns the conjugate, as a new number
     */
    public conjugate(): Complex {
        return new Complex(this.real, -this.imaginary);
    }

    /**
     * Tests whether the imaginary component is exactly zero.
     *
     * The test is exact, so a component that merely approximates zero is reported
     * as imaginary; use `equals` for a tolerant comparison.
     *
     * @returns `true` if the imaginary component is zero
     */
    public isReal(): boolean {
        return this.imaginary === 0;
    }

    /**
     * Tests whether the real component is exactly zero.
     *
     * The test is exact, so a component that merely approximates zero is reported
     * as real; use `equals` for a tolerant comparison.
     *
     * @returns `true` if the real component is zero
     */
    public isImaginary(): boolean {
        return this.real === 0;
    }

    /**
     * Tests whether both components are exactly zero.
     *
     * The test is exact, so a number whose magnitude is merely small is not zero.
     *
     * @returns `true` if both components are zero
     */
    public isZero(): boolean {
        return this.real === 0 && this.imaginary === 0;
    }

    /**
     * Adds another complex number to this one.
     *
     * The sum is component-wise, so real parts add separately from imaginary parts.
     *
     * @param other the complex number to be added
     * @returns the component-wise sum, as a new number
     * @throws {TypeError} if the operand is not a `Complex`
     */
    public plus(other: Complex): Complex {
        const checked: Complex = requireComplex(other, "Complex operand");
        return new Complex(this.real + checked.real, this.imaginary + checked.imaginary);
    }

    /**
     * Subtracts another complex number from this one.
     *
     * The difference is component-wise, so real parts subtract separately from
     * imaginary parts.
     *
     * @param other the complex number to be subtracted
     * @returns the component-wise difference, as a new number
     * @throws {TypeError} if the operand is not a `Complex`
     */
    public minus(other: Complex): Complex {
        const checked: Complex = requireComplex(other, "Complex operand");
        return new Complex(this.real - checked.real, this.imaginary - checked.imaginary);
    }

    /**
     * Multiplies this number by a finite scalar.
     *
     * Both components are scaled by the factor, so the magnitude is scaled by its
     * absolute value. A positive factor keeps the argument, a negative factor shifts
     * it by a half turn, and a zero factor collapses the number to zero.
     *
     * @param scalar the finite scalar factor
     * @returns the product, with both components scaled
     * @throws {TypeError} if the factor is not a finite number
     */
    public multiply(scalar: number): Complex;
    /**
     * Multiplies this number by another complex number.
     *
     * The product follows the distributive rule, so the magnitudes multiply and the
     * arguments add; reading the result back through `argument` wraps the sum into
     * one turn.
     *
     * @param other the complex factor
     * @returns the product of the two numbers
     * @throws {TypeError} if the operand is not a `Complex`
     */
    public multiply(other: Complex): Complex;
    public multiply(parameter: number | Complex): Complex {
        if (isNumber(parameter)) {
            return new Complex(this.real * parameter, this.imaginary * parameter);
        }
        const checked: Complex = requireComplex(parameter, "Complex multiplier");
        return new Complex(
            this.real * checked.real - this.imaginary * checked.imaginary,
            this.real * checked.imaginary + this.imaginary * checked.real,
        );
    }

    /**
     * Divides this number by a finite, non-zero scalar.
     *
     * Both components are divided by the factor, so the magnitude is divided by its
     * absolute value.
     *
     * @param scalar the finite, non-zero scalar divisor
     * @returns the quotient, with both components divided
     * @throws {TypeError} if the divisor is not a finite number
     * @throws {RangeError} if the divisor is zero
     */
    public divide(scalar: number): Complex;
    /**
     * Divides this number by another complex number.
     *
     * The quotient multiplies by the conjugate of the divisor and divides by the
     * squared magnitude of the divisor, so the magnitudes divide and the arguments
     * subtract.
     *
     * @param other the non-zero complex divisor
     * @returns the quotient of the two numbers
     * @throws {TypeError} if the divisor is not a `Complex`
     * @throws {RangeError} if the divisor is zero
     */
    public divide(other: Complex): Complex;
    public divide(parameter: number | Complex): Complex {
        if (isNumber(parameter)) {
            if (parameter === 0) {
                throw new RangeError("Complex divisor must not be zero.");
            }
            return new Complex(this.real / parameter, this.imaginary / parameter);
        }
        const checked: Complex = requireComplex(parameter, "Complex divisor");
        const denominator: number = checked.real * checked.real + checked.imaginary * checked.imaginary;
        if (denominator === 0) {
            throw new RangeError("Complex divisor must not be zero.");
        }
        return new Complex(
            (this.real * checked.real + this.imaginary * checked.imaginary) / denominator,
            (this.imaginary * checked.real - this.real * checked.imaginary) / denominator,
        );
    }

    /**
     * Raises this number to a real exponent.
     *
     * The power is evaluated in polar form: the magnitude is raised to the exponent
     * and the argument is scaled by it. Because the argument is normalised into
     * `[0, 2 * PI)`, the result follows the branch cut along the positive real axis,
     * although integer exponents are unaffected. Zero raised to a positive exponent is
     * zero, whereas zero raised to zero or to a negative exponent has no value.
     *
     * @param exponent the finite real exponent
     * @returns this number raised to the exponent, as a new number
     * @throws {TypeError} if the exponent is not a finite number
     * @throws {RangeError} if this number is zero and the exponent is not positive
     */
    public powerAsBase(exponent: number): Complex;
    /**
     * Raises this number to a complex exponent.
     *
     * Only finite real exponents are evaluated, so a `Complex` exponent is rejected
     * with a `TypeError` rather than interpreted.
     *
     * @param exponent the complex exponent, rejected at runtime
     * @returns no value, because the argument is rejected before evaluation
     * @throws {TypeError} always, because only finite real exponents are evaluated
     */
    public powerAsBase(exponent: Complex): Complex
    public powerAsBase(exponent: number | Complex): Complex {
        if (!isNumber(exponent)) {
            throw new TypeError("Complex exponent must be a finite number.");
        }
        if (this.isZero()) {
            if (exponent > 0) {
                return new Complex(0, 0);
            }
            throw new RangeError("Zero cannot be raised to a non-positive exponent.");
        }
        const radius: number = Math.pow(this.magnitude(), exponent);
        const radian: number = this.argument().toRadianValue() * exponent;
        return new Complex(radius * Math.cos(radian), radius * Math.sin(radian));
    }

    /**
     * Uses this number as the exponent of a positive real base.
     *
     * The power is `base ** this`, evaluated as `base ** real` for the magnitude and
     * `imaginary * ln(base)` for the argument. The base is positive and real, so its
     * logarithm is unambiguous and the result is the single principal value.
     *
     * @param base the finite, positive real base
     * @returns the base raised to this exponent, as a new number
     * @throws {TypeError} if the base is not a finite number
     * @throws {RangeError} if the base is not positive
     */
    public powerAsExponent(base: number): Complex;
    /**
     * Uses this number as the exponent of a complex base.
     *
     * Only finite real bases are evaluated, so a `Complex` base is rejected with a
     * `TypeError` rather than interpreted.
     *
     * @param base the complex base, rejected at runtime
     * @returns no value, because the argument is rejected before evaluation
     * @throws {TypeError} always, because only finite real bases are evaluated
     */
    public powerAsExponent(base: Complex): Complex
    public powerAsExponent(base: number | Complex): Complex {
        if (!isNumber(base)) {
            throw new TypeError("Complex base must be a finite number.");
        }
        if (base <= 0) {
            throw new RangeError("Complex base must be positive.");
        }
        const radius: number = Math.pow(base, this.real);
        const radian: number = this.imaginary * Math.log(base);
        return new Complex(radius * Math.cos(radian), radius * Math.sin(radian));
    }

    /**
     * Returns the complex logarithm of this number.
     *
     * The logarithm has the natural logarithm of the magnitude as its real part and
     * the argument as its imaginary part. The argument lies in `[0, 2 * PI)`, so the
     * branch cut runs along the positive real axis and a number just below that axis
     * reports an imaginary part close to `2 * PI` rather than a small negative one.
     *
     * @returns the logarithm on that branch, as a new number
     * @throws {RangeError} if this number is zero, which has no logarithm
     */
    public logarithm(): Complex {
        if (this.isZero()) {
            throw new RangeError("Zero has no complex logarithm.");
        }
        return new Complex(Math.log(this.magnitude()), this.argument().toRadianValue());
    }

    /**
     * Returns the logarithm of a positive real number to this number's base.
     *
     * The result is the quotient of this number's logarithm and the logarithm of the
     * operand. Only finite positive real operands are evaluated, so the operand's own
     * logarithm is real and only this number's branch cut is involved.
     *
     * @param truth the finite, positive real number whose logarithm is taken
     * @returns the logarithm of the operand to this base, as a new number
     * @throws {TypeError} if the operand is not a finite number
     * @throws {RangeError} if the operand is not positive, this number is zero, or
     *         this number is one, whose logarithm is zero and cannot serve as the
     *         divisor
     */
    public logarithmAsBase(truth: number): Complex;
    /**
     * Returns the logarithm of a complex number to this number's base.
     *
     * Only finite positive real operands are evaluated, so a `Complex` operand is
     * rejected with a `TypeError` rather than interpreted.
     *
     * @param truth the complex operand, rejected at runtime
     * @returns no value, because the argument is rejected before evaluation
     * @throws {TypeError} always, because only finite real operands are evaluated
     */
    public logarithmAsBase(truth: Complex): Complex
    public logarithmAsBase(truth: number | Complex): Complex {
        if (!isNumber(truth)) {
            throw new TypeError("Complex logarithm operand must be a finite number.");
        }
        if (truth <= 0) {
            throw new RangeError("Complex logarithm operand must be positive.");
        }
        return new Complex(Math.log(truth), 0).divide(this.logarithm());
    }

    /**
     * Returns the logarithm of this number to a positive real base.
     *
     * The result is this number's logarithm divided by the logarithm of the base,
     * which is the change-of-base identity. The base is a positive real number, so its
     * logarithm is real, while this number's logarithm uses the branch described by
     * `logarithm`. The base must differ from one, where the denominator would vanish.
     *
     * @param base the finite, positive real base, not equal to one
     * @returns the logarithm of this number to the given base, as a new number
     * @throws {TypeError} if the base is not a finite number
     * @throws {RangeError} if the base is not positive, the base is one, or this
     *         number is zero
     */
    public logarithmAsTruth(base: number): Complex;
    /**
     * Returns the logarithm of this number to a complex base.
     *
     * Only finite positive real bases are evaluated, so a `Complex` base is rejected
     * with a `TypeError` rather than interpreted.
     *
     * @param base the complex base, rejected at runtime
     * @returns no value, because the argument is rejected before evaluation
     * @throws {TypeError} always, because only finite real bases are evaluated
     */
    public logarithmAsTruth(base: Complex): Complex
    public logarithmAsTruth(base: number | Complex): Complex {
        if (!isNumber(base)) {
            throw new TypeError("Complex logarithm base must be a finite number.");
        }
        if (base <= 0 || base === 1) {
            throw new RangeError("Complex logarithm base must be positive and not one.");
        }
        return this.logarithm().divide(new Complex(Math.log(base), 0));
    }

    /**
     * Returns a square root of this number.
     *
     * The magnitude is square-rooted and the argument halved. Halving an argument in
     * `[0, 2 * PI)` yields a radian measure in `[0, PI)`, so the result always has a
     * non-negative imaginary component, while its real component is negative once the
     * argument exceeds a half turn. Zero is returned unchanged as a zero number.
     *
     * @returns the square root on that branch, as a new number
     */
    public squareRoot(): Complex {
        if (this.isZero()) {
            return new Complex(0, 0);
        }
        const radius: number = Math.sqrt(this.magnitude());
        const radian: number = this.argument().toRadianValue() * 0.5;
        return new Complex(radius * Math.cos(radian), radius * Math.sin(radian));
    }

    /**
     * Returns the unit direction from this number towards another one.
     *
     * The direction is the unit vector of the angular difference, so the result
     * always has magnitude one and is independent of both magnitudes.
     *
     * @param other the complex number to turn towards
     * @returns the unit vector in the direction of the other number
     * @throws {TypeError} if the operand is not a `Complex`
     */
    public similarity(other: Complex): Complex {
        const diff: Angle = requireComplex(other, "Complex operand").argument().minus(this.argument());
        return new Complex(diff.cosine(), diff.sine());
    }

    /**
     * Returns the direction from this number towards another one, scaled by both magnitudes.
     *
     * The result equals the conjugate of this number multiplied by the other one, so
     * the magnitude is the product of both magnitudes and the argument is the
     * angular difference between them.
     *
     * @param other the complex number to turn towards
     * @returns the rotated and scaled direction towards the other number
     * @throws {TypeError} if the operand is not a `Complex`
     */
    public tendency(other: Complex): Complex {
        const checked: Complex = requireComplex(other, "Complex operand");
        const diff: Angle = checked.argument().minus(this.argument());
        const magnitude: number = this.magnitude() * checked.magnitude();
        return new Complex(magnitude * diff.cosine(), magnitude * diff.sine());
    }

    /**
     * Compares both components with another number within a tolerance.
     *
     * Each component is compared independently, and the tolerance is used as an
     * absolute value, so the two numbers are equal when neither component differs
     * by more than that amount.
     *
     * @param other the number to be compared
     * @param epsilon the tolerance for both components, defaulting to `1E-9`
     * @returns `true` if both components are within the tolerance
     * @throws {TypeError} if the operand is not a `Complex` or the tolerance is not
     *         a finite number
     */
    public equals(other: Complex, epsilon: number = Tolerance): boolean {
        const checked: Complex = requireComplex(other, "Complex operand");
        if (!isNumber(epsilon)) {
            throw new TypeError("Complex epsilon must be a finite number.");
        }
        return Math.abs(this.real - checked.real) <= Math.abs(epsilon)
            && Math.abs(this.imaginary - checked.imaginary) <= Math.abs(epsilon);
    }

    /**
     * Returns the number in algebraic form.
     *
     * The real component is printed first, then the sign of the imaginary component,
     * then its magnitude and the imaginary unit, so a negative component is not
     * printed with two signs.
     *
     * @returns a string such as `1+2i` or `1-2i`
     */
    public toString(): string {
        const sign: string = this.imaginary < 0 ? "-" : "+";
        return `${this.real}${sign}${Math.abs(this.imaginary)}i`;
    }
}

/**
 * Narrows an unknown operand to `Complex` or rejects it.
 *
 * Operations that accept another `Complex` route the operand through this check, so the
 * rejection is raised before any arithmetic is attempted.
 *
 * @param target the value to validate
 * @param name the operand name used in the rejection message
 * @returns the same instance, typed as `Complex`
 * @throws {TypeError} if the target is not a `Complex`
 */
const requireComplex: (target: unknown, name: string) => Complex = (target: unknown, name: string): Complex => {
    if (!(target instanceof Complex)) {
        throw new TypeError(`${name} must be a Complex.`);
    }
    return target;
}

/**
 * Tests whether a value is a `Complex` instance.
 *
 * Re-exported from the shared guard module, where the test checks the `ComplexSymbol`
 * brand carried by every instance rather than the shape of its methods.
 */
export { isComplex } from "#semantic/guard";
