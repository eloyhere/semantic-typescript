import { isNumber } from "#semantic/guard";
import { Angle } from "#semantic/mathematics/angle";
import { Complex } from "#semantic/mathematics/complex";
import { Frequency } from "#semantic/mathematics/frequency";
import { BinSymbol } from "#semantic/symbol";

/**
 * Amplitude scaling applied to a raw transform coefficient.
 *
 * A raw coefficient is the unnormalised sum of a transform, so its magnitude
 * grows with the frame count. `none` keeps that raw value and is the historical
 * default, `count` divides by the frame count so that the coefficient becomes a
 * mean, and `root` divides by the square root of the frame count so that its
 * squared magnitude becomes a mean square. The name is validated by
 * `normalized`, which rejects any other value with a `TypeError`.
 */
export type Normalization = "none" | "count" | "root";

const Normalizations: ReadonlyArray<Normalization> = Object.freeze(["none", "count", "root"]);

/**
 * Validates a normalisation name.
 *
 * @param normalization the candidate name
 * @returns the name, typed as a normalisation
 * @throws {TypeError} if the value is not one of the supported names
 */
const requireNormalization: (normalization: unknown) => Normalization = (normalization: unknown): Normalization => {
    if (typeof normalization !== "string" || !Normalizations.includes(normalization as Normalization)) {
        throw new TypeError("Normalization must be one of none, count or root.");
    }
    return normalization as Normalization;
}

/**
 * Converts a non-negative ratio into decibels relative to a reference.
 *
 * The conversion is `20 * log10(ratio / reference)`, so a ratio equal to the
 * reference is zero decibels and a ratio of one tenth is minus twenty. The
 * factor of twenty is the amplitude convention, so squaring a ratio adds twice
 * its decibel value. A ratio of zero has no finite logarithm and reports
 * negative infinity rather than throwing, because silence is a normal
 * measurement. `Bin.decibel` and `Spectrum.decibelOf` both route their levels
 * through this function.
 *
 * @param ratio the measured ratio; must be finite and non-negative
 * @param reference the reference ratio, which must be finite and positive;
 *        defaults to one
 * @returns the level in decibels, or negative infinity for a zero ratio
 * @throws {TypeError} if either argument is not a finite number
 * @throws {RangeError} if the ratio is negative or the reference is not positive
 */
export const decibel: (ratio: number, reference?: number) => number = (ratio: number, reference: number = 1): number => {
    if (!isNumber(ratio)) {
        throw new TypeError("Decibel ratio must be a finite number.");
    }
    if (!isNumber(reference)) {
        throw new TypeError("Decibel reference must be a finite number.");
    }
    if (ratio < 0) {
        throw new RangeError("Decibel ratio must not be negative.");
    }
    if (reference <= 0) {
        throw new RangeError("Decibel reference must be positive.");
    }
    return ratio === 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(ratio / reference);
}

/**
 * Applies a normalisation to a raw transform coefficient.
 *
 * The coefficient is divided by the frame count for `count`, by its square root
 * for `root`, and left untouched for `none`. The divisor is a positive real
 * number, so a normalised coefficient keeps the phase of the raw coefficient and
 * only its magnitude changes; the result is a new `Complex` except for `none`,
 * which returns the amplitude itself. All arguments are validated before any
 * division is attempted, and none of them is modified.
 *
 * @param amplitude the raw coefficient, in amplitude units
 * @param normalization the scaling to apply; defaults to `none`
 * @param count the frame count that produced the coefficient; must be a
 *        positive integer and defaults to `1`
 * @returns the scaled coefficient, or the same `Complex` for `none`
 * @throws {TypeError} if the amplitude is not a `Complex`, the normalisation is
 *         unknown or the count is not a positive integer
 */
export const normalized: (amplitude: Complex, normalization?: Normalization, count?: number) => Complex =
    (amplitude: Complex, normalization: Normalization = "none", count: number = 1): Complex => {
        if (!(amplitude instanceof Complex)) {
            throw new TypeError("Normalized amplitude must be a Complex.");
        }
        const scaling: Normalization = requireNormalization(normalization);
        if (!isNumber(count) || !Number.isInteger(count) || count < 1) {
            throw new TypeError("Normalized count must be a positive integer.");
        }
        if (scaling === "none") {
            return amplitude;
        }
        return scaling === "count" ? amplitude.divide(count) : amplitude.divide(Math.sqrt(count));
    }

/**
 * Estimates the fractional bin offset of a peak from three neighbouring magnitudes.
 *
 * The estimate fits a parabola through the left, centre and right magnitudes and
 * returns the position of its vertex relative to the centre, in bins. A zero
 * second difference leaves the formula undefined, and an estimate whose
 * magnitude exceeds half a bin is discarded, so both cases report zero rather
 * than a position away from the centre bin. A triplet that does not peak at the
 * centre still yields the vertex of its parabola. Only the relative sizes of the
 * three magnitudes enter the formula, so they need not be normalised, and the
 * function has no side effects.
 *
 * @param left the magnitude of the bin before the peak
 * @param center the magnitude of the peak bin
 * @param right the magnitude of the bin after the peak
 * @returns the fractional offset from the centre bin, within plus or minus 0.5
 * @throws {TypeError} if a magnitude is not a finite number
 */
export const parabolicOffset: (left: number, center: number, right: number) => number =
    (left: number, center: number, right: number): number => {
        if (!isNumber(left) || !isNumber(center) || !isNumber(right)) {
            throw new TypeError("Parabolic magnitudes must be finite numbers.");
        }
        const denominator: number = left - 2 * center + right;
        if (denominator === 0) {
            return 0;
        }
        const offset: number = 0.5 * (left - right) / denominator;
        return Math.abs(offset) <= 0.5 ? offset : 0;
    }

/**
 * One frequency-domain coefficient: a frequency and its complex amplitude.
 *
 * A bin pairs the `Frequency` of a component, in hertz, with the raw `Complex`
 * amplitude that a transform produced at that frequency. It is immutable: both
 * fields are read-only, the accessors return the stored instances rather than
 * copies, and derivations such as `withAmplitude` return a new bin instead of
 * modifying the receiver. A bin carries no normalisation of its own, because the
 * frame count that would define the scaling lives with the spectrum.
 *
 * The magnitude is the strength of the component and the phase is its argument,
 * so the two accessors describe the same amplitude without losing either half;
 * `power` squares the magnitude, while `decibel` converts it into a level.
 * Instances carry the registered bin brand, so `isBin` recognises them at
 * runtime.
 */
export class Bin {

    /**
     * The frequency this coefficient belongs to.
     *
     * The value is a `Frequency` and is therefore finite and non-negative; the
     * rate is expressed in cycles per second and `getHertz()` exposes it as a
     * plain number.
     */
    public readonly frequency: Frequency;
    /**
     * The raw complex amplitude of this coefficient.
     *
     * The value is the unnormalised coefficient produced by the transform,
     * stored as supplied and never `undefined`; applying a `Normalization` is
     * left to `normalized`, which takes the frame count separately.
     */
    public readonly amplitude: Complex;
    /**
     * The registered bin brand, read by the shared runtime guard.
     *
     * The property is protected and keyed by the shared `BinSymbol`, so it is
     * not part of the public API; `isBin` reads it to recognise a bin at runtime
     * rather than by inspecting the methods of the value.
     */
    protected readonly [BinSymbol]: symbol = BinSymbol;

    /**
     * Creates a bin from a frequency and a complex amplitude.
     *
     * Both arguments are validated before either field is stored, so a rejected
     * argument never produces an instance. The two values are kept as supplied
     * rather than copied, so the new bin shares the given `Frequency` and
     * `Complex` instances; use `withAmplitude` to derive a bin that keeps the
     * frequency.
     *
     * @param frequency the frequency of the coefficient, in hertz
     * @param amplitude the raw complex amplitude at that frequency
     * @throws {TypeError} if the frequency is not a `Frequency` or the amplitude
     *         is not a `Complex`
     */
    public constructor(frequency: Frequency, amplitude: Complex) {
        if (!(frequency instanceof Frequency)) {
            throw new TypeError("Bin frequency must be a Frequency.");
        }
        if (!(amplitude instanceof Complex)) {
            throw new TypeError("Bin amplitude must be a Complex.");
        }
        this.frequency = frequency;
        this.amplitude = amplitude;
    }

    /**
     * Returns the frequency of this coefficient.
     *
     * The stored `Frequency` instance is returned, not a copy, and the accessor
     * has no side effects. The rate is finite and non-negative and is expressed
     * in cycles per second.
     *
     * @returns the frequency stored at construction
     */
    public getFrequency(): Frequency {
        return this.frequency;
    }

    /**
     * Returns the raw complex amplitude of this coefficient.
     *
     * The stored `Complex` instance is returned, without normalisation and
     * without a copy, so the value is never `undefined`; `magnitude`, `phase`,
     * `power` and `decibel` derive scalar views from the same amplitude.
     *
     * @returns the unnormalised amplitude stored at construction
     */
    public getAmplitude(): Complex {
        return this.amplitude;
    }

    /**
     * Returns the Euclidean norm of the amplitude.
     *
     * The magnitude is `amplitude.magnitude()`, so it is never negative and is
     * zero exactly when both components of the amplitude are zero. It is derived
     * from the raw amplitude and therefore grows with the frame count that
     * produced the coefficient; apply a `Normalization` through `normalized`
     * before comparing magnitudes across frame lengths. A distance beyond the
     * largest finite double overflows to positive infinity, matching
     * `Complex.magnitude`. The accessor has no side effects.
     *
     * @returns the non-negative magnitude of the raw amplitude
     */
    public magnitude(): number {
        return this.amplitude.magnitude();
    }

    /**
     * Returns the argument of the amplitude, in one full turn.
     *
     * The phase is `amplitude.argument()`: it is measured counter-clockwise from
     * the positive real axis and normalised into `[0, 2 * PI)` radians, so it is
     * never negative and a component below the real axis reports a value close
     * to a full turn. A zero amplitude reports the zero angle. The accessor has
     * no side effects.
     *
     * @returns the phase in radians, within `[0, 2 * PI)`
     */
    public phase(): Angle {
        return this.amplitude.argument();
    }

    /**
     * Returns the squared magnitude, that is, the raw power of this coefficient.
     *
     * The power is `magnitude() * magnitude()`, so it is non-negative and is the
     * square of `magnitude`. Like the magnitude it is derived from the raw
     * amplitude and is therefore unnormalised. The accessor has no side effects.
     *
     * @returns the squared magnitude of the raw amplitude
     */
    public power(): number {
        const magnitude: number = this.magnitude();
        return magnitude * magnitude;
    }

    /**
     * Returns the level of this coefficient in decibels relative to a reference
     * magnitude.
     *
     * The level is the shared `decibel` conversion of `magnitude()` against the
     * reference, so a magnitude equal to the reference is zero decibels, one
     * tenth of it is minus twenty, and a silent coefficient reports negative
     * infinity. The conversion uses the raw amplitude, because a bin carries no
     * normalisation of its own; pass a `Normalization` to `Spectrum.decibelOf`
     * to obtain a level that accounts for the frame count. The receiver is not
     * modified.
     *
     * @param reference the positive, finite reference magnitude, defaulting to `1`
     * @returns the level in decibels, or negative infinity for a zero magnitude
     * @throws {TypeError} if the reference is not a finite number, or if the
     *         magnitude overflows to infinity
     * @throws {RangeError} if the reference is not positive
     */
    public decibel(reference: number = 1): number {
        return decibel(this.magnitude(), reference);
    }

    /**
     * Returns a copy of this bin with another amplitude.
     *
     * The frequency is reused unchanged and only the amplitude is replaced, so
     * the result is a new `Bin` that shares the stored `Frequency` with this
     * one; the receiver is not modified. The amplitude is validated by the
     * constructor, so an invalid value is rejected before a bin is produced.
     *
     * @param amplitude the replacement raw complex amplitude
     * @returns a new bin at the same frequency with the given amplitude
     * @throws {TypeError} if the amplitude is not a `Complex`
     */
    public withAmplitude(amplitude: Complex): Bin {
        return new Bin(this.frequency, amplitude);
    }

    /**
     * Compares frequency and amplitude within a tolerance.
     *
     * Both parts must match: the frequencies are compared with
     * `Frequency.equals` and the amplitudes with `Complex.equals`. Each
     * comparison uses the tolerance as an absolute value, so a negative `epsilon`
     * behaves like its magnitude and a zero tolerance requires exact equality.
     * The default is `1E-9`, and the comparison has no side effects.
     *
     * @param other the bin to compare with this one
     * @param epsilon the tolerance, used in hertz for the frequency and in
     *        component units for the amplitude; defaults to `1E-9`
     * @returns `true` if the frequency and both amplitude components lie within
     *         the tolerance
     * @throws {TypeError} if the operand is not a `Bin` or the tolerance is not a
     *         finite number
     */
    public equals(other: Bin, epsilon: number = 1E-9): boolean {
        if (!(other instanceof Bin)) {
            throw new TypeError("Bin operand must be a Bin.");
        }
        if (!isNumber(epsilon)) {
            throw new TypeError("Bin epsilon must be a finite number.");
        }
        return this.frequency.equals(other.frequency, epsilon)
            && this.amplitude.equals(other.amplitude, epsilon);
    }

    /**
     * Renders the frequency and the raw amplitude.
     *
     * The text is `Bin(<frequency>, <amplitude>)`, where the frequency includes
     * its hertz suffix and the amplitude uses algebraic form such as `1+2i`. The
     * rendering is meant for logs and debugging rather than for machine parsing,
     * and it does not mention a normalisation, which a bin does not carry.
     *
     * @returns a string such as `Bin(440Hz, 1+2i)`
     */
    public toString(): string {
        return `Bin(${this.frequency}, ${this.amplitude})`;
    }
}

/**
 * Tests whether a value is a bin.
 *
 * The check is re-exported from the shared guard, which recognises a value by
 * the symbol-keyed brand installed by the `Bin` constructor rather than by
 * validating its fields or methods. A value that advertises that brand passes
 * even if it is not a `Bin`, while an unbranded object of the same shape does
 * not. The predicate only inspects the target and has no side effects.
 *
 * @param target the value to inspect
 * @returns `true` if the value advertises the bin brand
 */
export { isBin } from "#semantic/guard";
