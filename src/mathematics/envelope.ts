import { isFunction, isNumber } from "#semantic/guard";
import { EnvelopeSymbol } from "#semantic/symbol";

/**
 * Slack allowed when checking that the ADSR segments fit the note duration.
 *
 * The attack, decay and release durations may exceed the total duration by at
 * most 1E-12 seconds without `useADSR` rejecting them. The comparison is made
 * once when `useADSR` runs, and the tolerance is not applied to any individual
 * segment or to the sustain level.
 */
const Tolerance: number = 1E-12;

/**
 * Base step of the symmetric difference used by `derivate`.
 *
 * The step is one microsecond while the evaluation time is within one second of
 * zero and, beyond that, grows in proportion to the magnitude of the time, so
 * the relative step is 1E-6 there. `derivate` samples the envelope at
 * `time - step` and `time + step`, with all three times in seconds.
 */
const DerivativeStep: number = 1E-6;

/**
 * A function mapping a time in seconds to a finite amplitude level.
 *
 * The time is a finite number of seconds and the returned level is a unitless
 * linear amplitude. An evaluator is stored by reference and called afresh on
 * every evaluation, including both samples taken by `derivate` for each
 * derivative value, so it should be pure: a stateful evaluator would make the
 * derived envelopes inconsistent and could return different amplitudes for the
 * same time.
 *
 * Evaluators are not validated at construction. `Envelope.at` rejects a result
 * that is not a finite number with a `RangeError`, and an exception raised by
 * the evaluator itself propagates out of `at` unchanged.
 */
export type EnvelopeEvaluator = (time: number) => number;

/**
 * Narrows an unknown time argument to a finite number of seconds.
 *
 * The check is shared by `useADSR` and `at`, so a non-finite time is rejected
 * before any segment arithmetic or evaluator call is attempted. `NaN`, both
 * infinities and values that are not numbers take the same branch because
 * `isNumber` tests finiteness.
 *
 * @param value the candidate time
 * @param name the argument name used in the rejection message
 * @returns the same value, narrowed to a finite number
 * @throws {TypeError} if the value is not a finite number
 */
const requireTime: (value: unknown, name: string) => number = (value: unknown, name: string): number => {
    if (!isNumber(value)) {
        throw new TypeError(`${name} must be a finite number of seconds.`);
    }
    return value;
}

/**
 * Narrows an unknown amplitude argument to a finite number.
 *
 * Levels are unitless linear amplitudes, so only finiteness is checked: zero and
 * negative values are accepted. The helper is also used by
 * `requireNonNegative` for segment durations. The direct callers are
 * `useConstant`, the sustain argument of `useADSR` and the gain of `scale`; they
 * apply their own range restrictions where one exists.
 *
 * @param value the candidate level
 * @param name the argument name used in the rejection message
 * @returns the same value, narrowed to a finite number
 * @throws {TypeError} if the value is not a finite number
 */
const requireLevel: (value: unknown, name: string) => number = (value: unknown, name: string): number => {
    if (!isNumber(value)) {
        throw new TypeError(`${name} must be a finite level.`);
    }
    return value;
}

/**
 * Narrows a duration argument to a finite, non-negative number of seconds.
 *
 * The finiteness check is delegated to `requireLevel`, so a non-number or a
 * non-finite value throws `TypeError`; a finite negative value is then rejected
 * with `RangeError`. Zero is accepted and denotes an absent segment in
 * `useADSR`.
 *
 * @param value the candidate duration
 * @param name the argument name used in the rejection message
 * @returns the same value, finite and at least zero
 * @throws {TypeError} if the value is not a finite number
 * @throws {RangeError} if the value is negative
 */
const requireNonNegative: (value: unknown, name: string) => number = (value: unknown, name: string): number => {
    const checked: number = requireLevel(value, name);
    if (checked < 0) {
        throw new RangeError(`${name} must not be negative.`);
    }
    return checked;
}

/**
 * An amplitude shape over time, either a constant level or an evaluator
 * function.
 *
 * An envelope maps a time in seconds to a finite, unitless linear amplitude.
 * The constant form stores one level and returns it for every finite time,
 * while the evaluator form stores a function by reference and calls it for
 * every evaluation. The distinction is visible through `isConstant`,
 * `getConstant` and `toString`, and it decides whether the envelope can take
 * part in symbolic work.
 *
 * Keeping the constant case distinct lets `scale`, `plus` and `multiply` fold
 * constants eagerly, so arithmetic between constant envelopes stays constant
 * and exact, and lets symbolic consumers such as `Epicycle.derivate()` and
 * `Epicycle.integral()` read the level through `getConstant`. An evaluator-backed
 * envelope supports pointwise evaluation, pointwise arithmetic and numerical
 * differentiation through `derivate`, but it has no level for symbolic work, so
 * `getConstant` throws.
 *
 * Envelopes are immutable: no operation mutates an instance, and every derived
 * envelope is a new instance, so the receiver and any operand are unchanged.
 * Instances carry the registered `Envelope` brand, which `isEnvelope` reads at
 * runtime, while operations that accept another envelope require an actual
 * `Envelope` instance. `Epicycle` stores an envelope as its amplitude and
 * `Tone` stores one as its amplitude envelope.
 */
export class Envelope {

    private readonly evaluator: EnvelopeEvaluator;
    private readonly constant: boolean;
    private readonly level: number;
    protected readonly [EnvelopeSymbol]: symbol = EnvelopeSymbol;

    public constructor(evaluator: EnvelopeEvaluator);
    public constructor(level: number);
    /**
     * Creates an envelope from an evaluator function or a constant level.
     *
     * A number selects the constant form: the level is validated as finite and
     * stored once, alongside an evaluator that returns it for every time. A
     * function selects the evaluator form: it is stored by reference, not called
     * or validated during construction, and it must return a finite amplitude
     * when it is later invoked. Any other value, including `NaN` and both
     * infinities, is rejected.
     *
     * The level is a unitless linear amplitude and may be zero or negative. An
     * evaluator-backed envelope stores no meaningful level internally, so
     * `getConstant` rejects it and `isConstant` reports `false`; its function is
     * only checked when `at` or another evaluation runs it.
     *
     * @param parameter the evaluator function or the constant level
     * @throws {TypeError} if the parameter is neither a finite number nor a
     *         function
     */
    public constructor(parameter: EnvelopeEvaluator | number) {
        if (isNumber(parameter)) {
            this.constant = true;
            this.level = parameter;
            this.evaluator = (): number => parameter;
        } else if (isFunction(parameter)) {
            this.constant = false;
            this.level = Number.NaN;
            this.evaluator = parameter as EnvelopeEvaluator;
        } else {
            throw new TypeError("Envelope expects a finite level or an evaluator function.");
        }
    }

    /**
     * Creates a constant envelope holding one level for every time.
     *
     * The level is a unitless linear amplitude and may be any finite number,
     * including zero and negative values; no non-negativity constraint applies.
     * The returned envelope reports `true` from `isConstant`, returns the level
     * from `getConstant`, and evaluates to the level at every finite time.
     *
     * @param level the finite, unitless amplitude held at every time
     * @returns a constant envelope at the specified level
     * @throws {TypeError} if the level is not a finite number
     */
    public static useConstant(level: number): Envelope {
        return new Envelope(requireLevel(level, "Envelope level"));
    }

    /**
     * Creates a piecewise linear attack-decay-sustain-release envelope.
     *
     * The note lasts for `duration`, which defaults to the sum of the three
     * segments. A longer duration leaves a sustain plateau between the end of the
     * decay and the start of the release. The amplitude rises linearly from zero
     * to one over the attack, falls linearly to the sustain level over the decay,
     * holds that level, and falls linearly to zero over the release.
     *
     * The window is half-open: a time below zero or at or beyond `duration` is
     * silent, so the envelope returns zero at the end of the note. A zero-length
     * segment is skipped rather than interpolated: an absent attack begins at
     * the full level before the decay, or at the sustain level when the decay is
     * also absent; an absent decay jumps to the sustain level; and an absent
     * release cuts off without a fade.
     *
     * The result is evaluator-backed, so `isConstant` reports `false` and
     * `getConstant` throws, even though every segment is linear. All times are
     * in seconds, the sustain level is a unitless fraction of the full level,
     * and the segment lengths must fit inside `duration` within a tolerance of
     * 1E-12 seconds. Because the total must be positive, omitting `duration`
     * while all three segments are zero is rejected.
     *
     * @param attack the attack duration in seconds, at least zero
     * @param decay the decay duration in seconds, at least zero
     * @param sustain the unitless sustain level, within [0, 1]
     * @param release the release duration in seconds, at least zero
     * @param duration the total note duration in seconds, positive and at least
     *        the sum of the segments; defaults to that sum
     * @returns a piecewise linear, evaluator-backed envelope over the note window
     * @throws {TypeError} if a segment duration or the sustain level is not a
     *         finite number, or if the supplied duration is not a finite number
     * @throws {RangeError} if a segment duration is negative, the sustain level
     *         is outside [0, 1], the total duration is not positive, or the
     *         segments exceed it by more than the tolerance
     */
    public static useADSR(attack: number, decay: number, sustain: number, release: number, duration?: number): Envelope {
        const attackTime: number = requireNonNegative(attack, "Envelope attack");
        const decayTime: number = requireNonNegative(decay, "Envelope decay");
        const releaseTime: number = requireNonNegative(release, "Envelope release");
        const sustainLevel: number = requireLevel(sustain, "Envelope sustain");
        if (sustainLevel < 0 || sustainLevel > 1) {
            throw new RangeError("Envelope sustain must be within [0, 1].");
        }
        const total: number = duration === undefined ? attackTime + decayTime + releaseTime : requireTime(duration, "Envelope duration");
        if (total <= 0) {
            throw new RangeError("Envelope duration must be positive.");
        }
        if (attackTime + decayTime + releaseTime > total + Tolerance) {
            throw new RangeError("Envelope segments must fit within the duration.");
        }
        const releaseStart: number = total - releaseTime;
        return new Envelope((time: number): number => {
            if (time < 0 || time >= total) {
                return 0;
            }
            if (attackTime > 0 && time < attackTime) {
                return time / attackTime;
            }
            if (decayTime > 0 && time < attackTime + decayTime) {
                return 1 + (sustainLevel - 1) * (time - attackTime) / decayTime;
            }
            if (time < releaseStart) {
                return sustainLevel;
            }
            if (releaseTime > 0) {
                return Math.max(0, sustainLevel * (1 - (time - releaseStart) / releaseTime));
            }
            return 0;
        });
    }

    /**
     * Evaluates the amplitude at a point in time.
     *
     * The time is validated first, even for a constant envelope: `NaN`, an
     * infinity and a non-number are all rejected before any evaluation. The
     * stored evaluator is then called directly, so the result is only as smooth
     * as that function, and an exception it raises propagates unchanged. A
     * constant envelope ignores the time when computing its amplitude, while an
     * evaluator-backed envelope is sampled afresh on every call.
     *
     * The returned value is a finite, unitless linear amplitude; a result that
     * is not a finite number is rejected rather than returned. Evaluation is
     * defined for every envelope and is the only operation needed for numerical
     * differentiation; symbolic differentiation and integration additionally
     * require a constant level.
     *
     * @param time the finite time in seconds at which to evaluate this envelope
     * @returns the finite, unitless amplitude at the specified time
     * @throws {TypeError} if the time is not a finite number
     * @throws {RangeError} if the evaluator returns a value that is not a finite
     *         number
     */
    public at(time: number): number {
        const value: number = this.evaluator(requireTime(time, "Envelope time"));
        if (!isNumber(value)) {
            throw new RangeError("Envelope evaluator must return a finite level.");
        }
        return value;
    }

    /**
     * Reports whether this envelope holds one level for every time.
     *
     * The flag is stored at construction and is never recomputed from samples,
     * so an evaluator-backed envelope reports `false` even when its function
     * happens to return the same value everywhere. The number constructor and
     * `useConstant` produce constant envelopes; so do `scale` on a constant
     * envelope, `plus` and `multiply` when both operands are constant, and
     * `derivate` on a constant envelope. `useADSR` always reports `false`.
     *
     * Only a constant envelope exposes a level through `getConstant`, so
     * symbolic work such as `Epicycle.derivate()` and `Epicycle.integral()`
     * requires this method to return `true`.
     *
     * @returns `true` if this envelope is constant, `false` if it is
     *          evaluator-backed
     */
    public isConstant(): boolean {
        return this.constant;
    }

    /**
     * Returns the held level of a constant envelope.
     *
     * The level is the unitless linear amplitude stored by the number
     * constructor, `useConstant` or constant folding; it is returned unchanged,
     * including when it is zero or negative. An evaluator-backed envelope has no
     * single level, so this method rejects it instead of returning a sampled or
     * sentinel value.
     *
     * @returns the finite, unitless level held at every time
     * @throws {RangeError} if this envelope is evaluator-backed
     */
    public getConstant(): number {
        if (!this.constant) {
            throw new RangeError("Envelope is not constant.");
        }
        return this.level;
    }

    /**
     * Multiplies the amplitude of this envelope by a finite factor.
     *
     * The factor is a unitless linear gain: a magnitude above one amplifies, a
     * magnitude between zero and one attenuates, a negative factor flips the
     * sign of every amplitude, and zero collapses the result to silence. A
     * constant envelope is folded eagerly into a new constant envelope, while an
     * evaluator-backed envelope is scaled lazily, so its evaluator runs with the
     * original time and the product is formed on every evaluation.
     *
     * A zero factor on an evaluator-backed envelope yields zero at every time but
     * still reports `false` from `isConstant`, because the form is not folded. A
     * product that overflows to a non-finite value is not clamped: a constant
     * fold is rejected by the constructor with a `TypeError`, while an
     * evaluator-backed result rejects the overflowing time in `at` with a
     * `RangeError`. Neither this envelope nor any evaluator it holds is modified.
     *
     * @param factor the finite, unitless multiplicative factor
     * @returns a new envelope whose amplitude is `factor` times this one's
     * @throws {TypeError} if the factor is not a finite number, or if folding a
     *         constant level overflows
     */
    public scale(factor: number): Envelope {
        const checked: number = requireLevel(factor, "Envelope factor");
        if (this.constant) {
            return new Envelope(this.level * checked);
        }
        return new Envelope((time: number): number => this.at(time) * checked);
    }

    /**
     * Adds another envelope to this one sample-wise.
     *
     * The amplitudes are added point by point, so the result at a time is
     * `this.at(t) + other.at(t)`. When both operands are constant the sum is
     * folded eagerly into a new constant envelope; otherwise the sum is computed
     * lazily on every evaluation, and the result is evaluator-backed even if one
     * operand is constant. Addition is commutative in value, though the two
     * envelopes are sampled in receiver-then-operand order, and neither operand
     * is modified.
     *
     * The operand must be an actual `Envelope` instance; a value that merely
     * carries the envelope brand is rejected. A sum that overflows on evaluation
     * is not clamped, and `at` on the result then throws a `RangeError`; a
     * constant fold that overflows is rejected immediately by the constructor
     * with a `TypeError`.
     *
     * @param other the envelope added to this one
     * @returns a new envelope whose amplitude is the sum of both amplitudes
     * @throws {TypeError} if the operand is not an `Envelope`, or if folding two
     *         constant levels overflows
     */
    public plus(other: Envelope): Envelope {
        const checked: Envelope = requireEnvelope(other, "Envelope operand");
        if (this.constant && checked.constant) {
            return new Envelope(this.level + checked.level);
        }
        return new Envelope((time: number): number => this.at(time) + checked.at(time));
    }

    /**
     * Multiplies another envelope into this one sample-wise.
     *
     * The amplitudes are multiplied point by point, so the result at a time is
     * `this.at(t) * other.at(t)`. When both operands are constant the product is
     * folded eagerly into a new constant envelope; otherwise the product is
     * computed lazily on every evaluation, and the result is evaluator-backed
     * even if one operand is constant. Multiplication is commutative in value,
     * and neither operand is modified.
     *
     * The operand must be an actual `Envelope` instance; a value that merely
     * carries the envelope brand is rejected. A product that overflows on
     * evaluation is not clamped, and `at` on the result then throws a
     * `RangeError`; a constant fold that overflows is rejected immediately by
     * the constructor with a `TypeError`.
     *
     * @param other the envelope multiplied into this one
     * @returns a new envelope whose amplitude is the product of both amplitudes
     * @throws {TypeError} if the operand is not an `Envelope`, or if folding two
     *         constant levels overflows
     */
    public multiply(other: Envelope): Envelope {
        const checked: Envelope = requireEnvelope(other, "Envelope operand");
        if (this.constant && checked.constant) {
            return new Envelope(this.level * checked.level);
        }
        return new Envelope((time: number): number => this.at(time) * checked.at(time));
    }

    /**
     * Returns the numerical derivative of this envelope.
     *
     * A constant envelope yields a new constant zero envelope, because its slope
     * is zero everywhere; the stored evaluator is not consulted. An
     * evaluator-backed envelope yields a new evaluator-backed envelope that
     * estimates the slope with a symmetric difference,
     * `(f(t + h) - f(t - h)) / (2 * h)`, where the step `h` is 1E-6 seconds when
     * `|t|` is at most one second and `1E-6 * |t|` otherwise. The estimate is
     * second-order accurate in `h`. Beyond one second the step grows with the
     * magnitude of the time, so the truncation error grows with the square of
     * the time, and the estimate blurs across sharp transitions.
     *
     * For an evaluator-backed receiver the returned envelope calls this
     * envelope's `at` twice per evaluation, so it inherits the finite-time and
     * finite-result checks of `at`, and any exception raised by the underlying
     * evaluator propagates unchanged. No stored state is modified.
     *
     * @returns a new envelope approximating the derivative of this one
     */
    public derivate(): Envelope {
        if (this.constant) {
            return new Envelope(0);
        }
        return new Envelope((time: number): number => {
            const step: number = DerivativeStep * Math.max(1, Math.abs(time));
            return (this.at(time + step) - this.at(time - step)) / (2 * step);
        });
    }

    /**
     * Renders this envelope for debugging.
     *
     * A constant envelope renders as `Envelope(level)`, with the level inserted
     * using JavaScript number formatting; an evaluator-backed envelope renders
     * as `Envelope(function)` and never exposes the function source or a sampled
     * value. The rendering has no side effects and does not call the evaluator.
     *
     * @returns `Envelope(level)` for a constant envelope, or `Envelope(function)`
     *          for an evaluator-backed one
     */
    public toString(): string {
        return this.constant ? `Envelope(${this.level})` : "Envelope(function)";
    }
}

/**
 * Narrows an unknown operand to an `Envelope` instance or rejects it.
 *
 * The check is an `instanceof` test rather than the brand test used by
 * `isEnvelope`, so an object that merely copies the brand is rejected. `plus`
 * and `multiply` route their operand through this helper, so the rejection is
 * raised before any envelope is constructed or evaluated.
 *
 * @param target the value to validate
 * @param name the operand name used in the rejection message
 * @returns the same instance, typed as `Envelope`
 * @throws {TypeError} if the target is not an `Envelope` instance
 */
const requireEnvelope: (target: unknown, name: string) => Envelope = (target: unknown, name: string): Envelope => {
    if (!(target instanceof Envelope)) {
        throw new TypeError(`${name} must be an Envelope.`);
    }
    return target;
}

/**
 * Tests whether a value advertises the `Envelope` brand.
 *
 * Re-exported from the shared guard module, where the test reads the
 * symbol-keyed brand carried by every instance rather than the shape of its
 * methods. The test is therefore structural: a value that merely copies the
 * brand passes, while `plus`, `multiply` and the constructors of `Epicycle` and
 * `Tone` require a real `Envelope` instance.
 *
 * @param target the value to inspect
 * @returns `true` if the value carries the envelope brand
 */
export { isEnvelope } from "#semantic/guard";
