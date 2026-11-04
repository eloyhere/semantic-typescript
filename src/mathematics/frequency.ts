import { isNumber } from "#semantic/guard";
import { Omega } from "#semantic/mathematics/omega";
import { FrequencySymbol } from "#semantic/symbol";

const FullTurn: number = Math.PI * 2;
const SemitoneRatio: number = Math.pow(2, 1 / 12);

/**
 * A cyclic rate expressed in hertz, that is, cycles per second.
 *
 * A frequency is immutable: the rate is validated once at construction and never
 * changes afterwards, so accessors return plain numbers and conversions return new
 * values. The rate is finite and non-negative, and zero is a valid rate that
 * denotes a static signal, whose period is positive infinity and whose angular
 * rate is zero.
 *
 * The angular equivalent follows from one full turn per cycle, so the radian rate
 * is `2 * PI` times the hertz rate. Frequencies appear as the rate of a `Tone`, the
 * resolution, bin positions and spectral statistics of a `Spectrum`, and the cyclic
 * view of an `Omega`. Instances carry the registered brand, so `isFrequency`
 * recognises them at runtime.
 */
export class Frequency {

    private readonly hertz: number;
    protected readonly [FrequencySymbol]: symbol = FrequencySymbol;

    /**
     * Creates a frequency from a rate in hertz.
     *
     * The rate is stored as supplied once both checks pass, so a rejected argument
     * throws before the rate is stored. Zero is accepted and denotes a static
     * signal; a negative or non-finite rate is rejected.
     *
     * @param hertz the finite, non-negative rate in cycles per second
     * @throws {TypeError} if the rate is not a finite number, including `NaN`,
     *         both infinities and values that are not numbers
     * @throws {RangeError} if the rate is negative
     */
    public constructor(hertz: number) {
        if (!isNumber(hertz)) {
            throw new TypeError("Frequency must be a finite number of hertz.");
        }
        if (hertz < 0) {
            throw new RangeError("Frequency must not be negative.");
        }
        this.hertz = hertz;
    }

    /**
     * Returns the rate in cycles per second.
     *
     * The rate is the value supplied at construction, so it is finite and never
     * negative. Zero reports a static signal. The accessor only reads the stored
     * value and has no side effects.
     *
     * @returns the finite rate in hertz
     */
    public getHertz(): number {
        return this.hertz;
    }

    /**
     * Returns the duration of one cycle in seconds.
     *
     * The period is the reciprocal of the rate. A rate of zero describes a static
     * signal, so its period is reported as positive infinity rather than as a
     * division by zero; for a non-zero rate the period is `1 / getHertz()` and is
     * therefore positive. The accessor has no side effects.
     *
     * @returns the period in seconds, which is positive infinity for a zero rate
     */
    public getPeriod(): number {
        return this.hertz === 0 ? Number.POSITIVE_INFINITY : 1 / this.hertz;
    }

    /**
     * Returns the angular rate in radians per second.
     *
     * One cycle spans `2 * PI` radians, so the rate is `getHertz() * 2 * PI` and a
     * zero hertz rate yields zero. The accessor has no side effects.
     *
     * @returns the angular rate in radians per second
     */
    public getRadianPerSecond(): number {
        return this.hertz * FullTurn;
    }

    /**
     * Converts this rate into its angular equivalent.
     *
     * The conversion wraps `getRadianPerSecond()` in a new `Omega`, so the result
     * completes the same number of turns per second as this frequency, and a zero
     * hertz rate yields a zero angular rate.
     *
     * @returns an `Omega` of `2 * PI * getHertz()` radians per second
     * @throws {TypeError} if the angular rate is not finite, which happens only
     *         when `2 * PI * getHertz()` overflows
     */
    public toOmega(): Omega {
        return new Omega(this.getRadianPerSecond());
    }

    /**
     * Transposes this rate by a number of equal-tempered semitones.
     *
     * The rate is multiplied by `2 ** (semitones / 12)`, so twelve semitones double
     * it, a negative count lowers a positive rate and a count of zero returns an
     * equal rate. The result is a new frequency; the receiver is unchanged. Because
     * the factor is positive, a non-negative rate stays non-negative and a zero rate
     * stays zero.
     *
     * @param semitones the signed number of equal-tempered semitones
     * @returns a new frequency at the transposed rate
     * @throws {TypeError} if the semitone count is not a finite number, or if the
     *         transposed rate overflows to a non-finite value
     */
    public transpose(semitones: number): Frequency {
        if (!isNumber(semitones)) {
            throw new TypeError("Frequency semitones must be a finite number.");
        }
        return new Frequency(this.hertz * Math.pow(SemitoneRatio, semitones));
    }

    /**
     * Compares this rate with another within a tolerance.
     *
     * The two hertz values are compared directly, without a round trip through
     * `Omega`, and the difference must be at most the absolute tolerance. A negative
     * tolerance is therefore treated as its magnitude, and a zero tolerance requires
     * exact equality. The comparison has no side effects.
     *
     * @param other the rate to compare with this one
     * @param epsilon the tolerance in hertz, defaulting to `1E-9`
     * @returns `true` if the rates differ by no more than the tolerance
     * @throws {TypeError} if the operand is not a `Frequency` or the tolerance is
     *         not a finite number
     */
    public equals(other: Frequency, epsilon: number = 1E-9): boolean {
        if (!(other instanceof Frequency)) {
            throw new TypeError("Frequency operand must be a Frequency.");
        }
        if (!isNumber(epsilon)) {
            throw new TypeError("Frequency epsilon must be a finite number.");
        }
        return Math.abs(this.hertz - other.hertz) <= Math.abs(epsilon);
    }

    /**
     * Renders this rate with its hertz unit.
     *
     * The rate uses JavaScript number formatting followed by `Hz`, so an integer
     * reports without a decimal point while an extreme value may use exponential
     * notation. The rendering is meant for logs and debugging rather than for
     * machine parsing.
     *
     * @returns the rate followed by the hertz unit, such as `440Hz`
     */
    public toString(): string {
        return `${this.hertz}Hz`;
    }
}

/**
 * Creates a frequency from a rate in hertz.
 *
 * This is the functional shorthand for constructing a `Frequency`; it forwards the
 * argument unchanged and applies the same validation, so the result is a new
 * immutable frequency.
 *
 * @param hertz the finite, non-negative rate in cycles per second
 * @returns the corresponding frequency
 * @throws {TypeError} if the rate is not a finite number
 * @throws {RangeError} if the rate is negative
 */
export const useHertz: (hertz: number) => Frequency = (hertz: number): Frequency => {
    return new Frequency(hertz);
}

/**
 * Tests whether a value is a frequency.
 *
 * The check is re-exported from the shared guard, which recognises values by their
 * registered brand rather than by validating the rate they carry.
 *
 * @param target the value to inspect
 * @returns `true` if the value advertises the frequency brand
 */
export { isFrequency } from "#semantic/guard";
