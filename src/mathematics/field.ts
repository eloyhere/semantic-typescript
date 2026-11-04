import { isNumber } from "#semantic/guard";
import { Angle } from "#semantic/mathematics/angle";
import { PhaseFieldSymbol } from "#semantic/symbol";

/**
 * Full-turn magnitude in radians, that is, `2 * PI`.
 *
 * A relative phase measured in turns is obtained by dividing the radian measure
 * by this value, and a harmonic of that measure is taken by multiplying it back.
 */
const FullTurn: number = Math.PI * 2;

const requireFinite: (value: unknown, name: string) => number = (value: unknown, name: string): number => {
    if (!isNumber(value)) {
        throw new TypeError(`${name} must be a finite number.`);
    }
    return value;
}

/**
 * A bounded real-valued field on the phase circle, in the range `[-1, 1]`.
 *
 * The field is a truncated cosine series
 *
 *     score(turns) = offset + sum over m of weight[m] * cos(2*PI * (m + 1) * turns)
 *
 * so it carries an explicit harmonic content: entry `m` of the weight list is
 * the `m + 1`-th harmonic, and each harmonic completes `m + 1` full turns per
 * cycle. A field with a single unit weight on the first harmonic is the plain
 * `cos` of the relative phase, which scores `1` when a position is aligned with
 * the environment and `-1` when it is opposed.
 *
 * The range is guaranteed by construction rather than by clamping: the
 * constructor enforces `abs(offset) + sum(abs(weight)) <= 1`, and since every
 * cosine lies in `[-1, 1]` the series cannot leave the interval. This bound is
 * the reason the field is a cosine series instead of a lookup table: a table
 * sampled on `n` points reproduces those points exactly, but its trigonometric
 * interpolant overshoots the interval between them, so it cannot honour a
 * `[-1, 1]` contract at arbitrary phases.
 *
 * A field is immutable and stateless, so the same field may be shared by many
 * cycles. It is not tied to a cycle length; the caller is responsible for
 * choosing harmonics whose periodicity is meaningful for the ring being scored.
 * Instances carry the registered brand, which `isPhaseField` recognises.
 */
export class PhaseField {

    /**
     * The harmonic weights, in increasing harmonic order and frozen at
     * construction.
     */
    private readonly weights: ReadonlyArray<number>;
    /**
     * The constant term of the series.
     */
    private readonly offset: number;
    /**
     * The registered field brand, read by the shared runtime guard.
     */
    protected readonly [PhaseFieldSymbol]: symbol = PhaseFieldSymbol;

    /**
     * Creates a field from its harmonic weights and a constant offset.
     *
     * Every weight and the offset must be finite numbers, and their absolute
     * values must together consume at most one unit of budget: a series whose
     * budget exceeds one can reach beyond `[-1, 1]`, so it is rejected before
     * any state is stored. The offset defaults to zero, and an empty weight list
     * yields a constant field of value `offset`.
     *
     * @param weights the harmonic weights, lowest harmonic first
     * @param offset the constant term, within the remaining budget
     * @throws {TypeError} if the weights are not iterable, or if any weight or
     *         the offset is not a finite number
     * @throws {RangeError} if `abs(offset) + sum(abs(weight))` exceeds one
     */
    public constructor(weights: Iterable<number>, offset: number = 0) {
        if (weights === null || weights === undefined) {
            throw new TypeError("PhaseField weights must be iterable.");
        }
        let budget: number = Math.abs(requireFinite(offset, "PhaseField offset"));
        const collected: number[] = [];
        for (const weight of weights) {
            const checked: number = requireFinite(weight, "PhaseField weight");
            budget += Math.abs(checked);
            collected.push(checked);
        }
        if (budget > 1) {
            throw new RangeError("PhaseField budget must not exceed one.");
        }
        this.weights = Object.freeze(collected);
        this.offset = offset;
    }

    /**
     * Returns the harmonic weights, lowest harmonic first.
     *
     * The returned array is the frozen array stored at construction, so it is
     * not a copy and cannot be modified. Its length is the order of the series,
     * and entry `m` belongs to harmonic `m + 1`.
     *
     * @returns the frozen weights, in increasing harmonic order
     */
    public getWeights(): ReadonlyArray<number> {
        return this.weights;
    }

    /**
     * Returns the constant term of the series.
     *
     * The value was supplied at construction and lies within `[-1, 1]`, since
     * it consumes part of the unit budget on its own.
     *
     * @returns the constant term
     */
    public getOffset(): number {
        return this.offset;
    }

    /**
     * Returns the number of harmonics carried by this field.
     *
     * A field with order zero is constant; otherwise the highest harmonic is
     * `getOrder()` and completes that many turns per cycle.
     *
     * @returns the harmonic count, which is never negative
     */
    public getOrder(): number {
        return this.weights.length;
    }

    /**
     * Returns the total budget consumed by the weights and the offset.
     *
     * The value is `abs(offset) + sum(abs(weight))` and never exceeds one, so it
     * can be used to prove that `sample` stays within `[-1, 1]` without
     * evaluating the series.
     *
     * @returns the non-negative budget, at most one
     */
    public getBudget(): number {
        let budget: number = Math.abs(this.offset);
        for (const weight of this.weights) budget += Math.abs(weight);
        return budget;
    }

    /**
     * Evaluates the field at a relative phase.
     *
     * The phase is converted to turns, each harmonic is evaluated at its own
     * multiple of that argument, and the weighted sum is returned. Because the
     * budget never exceeds one, the result lies in `[-1, 1]`; the final
     * comparison only pins values that floating-point rounding placed a few
     * ulps outside the interval, so it never changes a value that the series
     * itself produced inside the range.
     *
     * @param relative the phase of the scored position relative to the environment
     * @returns the score, within `[-1, 1]`
     * @throws {TypeError} if the argument is not an `Angle`
     */
    public sample(relative: Angle): number {
        if (!(relative instanceof Angle)) {
            throw new TypeError("PhaseField relative must be an Angle.");
        }
        const turns: number = relative.toRadianValue() / FullTurn;
        let value: number = this.offset;
        for (let order = 0; order < this.weights.length; order++) {
            value += this.weights[order] * Math.cos(FullTurn * (order + 1) * turns);
        }
        return value > 1 ? 1 : value < -1 ? -1 : value;
    }

    /**
     * Compares this field with another within a tolerance.
     *
     * The offsets and the weights are compared term by term, and a field with a
     * different order is never equal because a missing harmonic is not the same
     * as a zero harmonic: the orders describe different series even when both
     * happen to evaluate identically. The tolerance is used as an absolute
     * value, and neither field is modified.
     *
     * @param other the field to compare against
     * @param epsilon the tolerance on each term, defaulting to `1E-9`
     * @returns `true` if both fields carry the same order and matching terms
     * @throws {TypeError} if the operand is not a `PhaseField` or the tolerance
     *         is not a finite number
     */
    public equals(other: PhaseField, epsilon: number = 1E-9): boolean {
        if (!(other instanceof PhaseField)) {
            throw new TypeError("PhaseField operand must be a PhaseField.");
        }
        const tolerance: number = Math.abs(requireFinite(epsilon, "PhaseField epsilon"));
        if (this.weights.length !== other.weights.length) {
            return false;
        }
        if (Math.abs(this.offset - other.offset) > tolerance) {
            return false;
        }
        for (let order = 0; order < this.weights.length; order++) {
            if (Math.abs(this.weights[order] - other.weights[order]) > tolerance) {
                return false;
            }
        }
        return true;
    }

    /**
     * Renders the series as a readable sum.
     *
     * The constant term is omitted when it is exactly zero, and each harmonic is
     * written as its weight followed by `cos` and the harmonic number, so a
     * single first-harmonic field reads as `0.5cos1`. The rendering is meant for
     * logs and debugging rather than for machine parsing.
     *
     * @returns a string such as `0.5cos1+0.3cos2` or `0.25`
     */
    public toString(): string {
        const terms: string[] = [];
        if (this.offset !== 0) terms.push(String(this.offset));
        for (let order = 0; order < this.weights.length; order++) {
            terms.push(`${this.weights[order]}cos${order + 1}`);
        }
        return terms.length === 0 ? "0" : terms.join("+");
    }
}

/**
 * Creates a bounded phase field from its harmonic weights.
 *
 * This is the functional shorthand for constructing a `PhaseField`; it forwards
 * both arguments unchanged and applies the same validation, so the result
 * honours the same `[-1, 1]` budget.
 *
 * @param weights the harmonic weights, lowest harmonic first
 * @param offset the constant term, defaulting to zero
 * @returns the corresponding field
 * @throws {TypeError} if a term is not a finite number
 * @throws {RangeError} if the total budget exceeds one
 */
export const useField: (weights: Iterable<number>, offset?: number) => PhaseField =
    (weights: Iterable<number>, offset: number = 0): PhaseField => {
        return new PhaseField(weights, offset);
    }

/**
 * Tests whether a value carries the `PhaseField` brand.
 *
 * The predicate is defined in the guard module alongside the other brand checks
 * and re-exported here for convenience. Only the symbol-keyed brand is
 * inspected, so an object that advertises it passes without its series being
 * validated.
 *
 * @param target the value to inspect
 * @returns `true` if the value advertises the `PhaseField` brand
 */
export { isPhaseField } from "#semantic/guard";
