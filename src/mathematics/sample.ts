import { isNumber } from "#semantic/guard";
import { SampleSymbol } from "#semantic/symbol";

/**
 * A discrete sampling plan: a frame count over a duration.
 *
 * The rate follows from the count and the duration, and frames are spaced evenly
 * across the duration, so frame `i` starts at `i / rate` seconds and the interval
 * between frames is `duration / count`. The plan is half-open: the last frame
 * starts one interval before the duration, and the instant at the duration itself
 * belongs to no frame.
 *
 * A plan is immutable once constructed: no operation mutates an existing
 * instance, and the accessors return stored fields or values derived from them.
 * Equality compares the count and the duration exactly rather than the derived
 * rate, so plans that render the same frames compare equal. `isSample` recognises
 * instances at runtime.
 */
export class Sample {

    private readonly count: number;
    private readonly duration: number;
    private readonly rate: number;
    protected readonly [SampleSymbol]: symbol = SampleSymbol;

    /**
     * Creates a sampling plan from a frame count and a duration.
     *
     * The rate is derived once at construction, so a plan never observes a
     * changing count or duration.
     *
     * @param count the number of frames, a positive integer
     * @param duration the covered duration in seconds, positive and finite
     * @throws {TypeError} if the count is not an integer or the duration is not a
     *         finite number
     * @throws {RangeError} if the count is less than one or the duration is not
     *         positive
     */
    public constructor(count: number, duration: number) {
        if (!isNumber(count) || !Number.isInteger(count)) {
            throw new TypeError("Sample count must be a finite integer.");
        }
        if (count < 1) {
            throw new RangeError("Sample count must be at least one.");
        }
        if (!isNumber(duration)) {
            throw new TypeError("Sample duration must be a finite number of seconds.");
        }
        if (duration <= 0) {
            throw new RangeError("Sample duration must be positive.");
        }
        this.count = count;
        this.duration = duration;
        this.rate = count / duration;
    }

    /**
     * Creates a sampling plan from a rate and a duration.
     *
     * The frame count is the rounded product of the rate and the duration, so the
     * effective rate can differ slightly from the requested one.
     *
     * @param rate the frame rate in frames per second, positive and finite
     * @param duration the covered duration in seconds, positive and finite
     * @returns a plan whose count is the rounded product of rate and duration
     * @throws {TypeError} if the rate or the duration is not a finite number
     * @throws {RangeError} if the rate is not positive, the duration is not
     *         positive, or the rounded product is less than one frame
     */
    public static useRate(rate: number, duration: number): Sample {
        if (!isNumber(rate)) {
            throw new TypeError("Sample rate must be a finite number of frames per second.");
        }
        if (rate <= 0) {
            throw new RangeError("Sample rate must be positive.");
        }
        if (!isNumber(duration)) {
            throw new TypeError("Sample duration must be a finite number of seconds.");
        }
        if (duration <= 0) {
            throw new RangeError("Sample duration must be positive.");
        }
        const count: number = Math.round(rate * duration);
        if (count < 1) {
            throw new RangeError("Sample rate and duration must cover at least one frame.");
        }
        return new Sample(count, duration);
    }

    /**
     * Returns the number of frames.
     *
     * The count is a positive integer and determines the rate together with the
     * duration.
     *
     * @returns the number of frames, always at least one
     */
    public getCount(): number {
        return this.count;
    }

    /**
     * Returns the covered duration.
     *
     * The duration is stored exactly as supplied and never changes, because a plan
     * is immutable. Plans that differ in the duration therefore differ in the
     * derived rate and interval even when their frame counts match.
     *
     * @returns the covered duration in seconds, always positive and finite
     */
    public getDuration(): number {
        return this.duration;
    }

    /**
     * Returns the frame rate.
     *
     * The rate is the count divided by the duration and is the reciprocal of the
     * interval.
     *
     * @returns the frame rate in frames per second
     */
    public getRate(): number {
        return this.rate;
    }

    /**
     * Returns the spacing between frames.
     *
     * The interval is the duration divided by the count, which is the reciprocal
     * of the rate; it is finite and strictly positive.
     *
     * @returns the sampling interval in seconds
     */
    public getInterval(): number {
        return this.duration / this.count;
    }

    /**
     * Returns the start time of a frame.
     *
     * Frame zero starts at time zero and the last frame starts one interval before
     * the duration, so every returned time lies inside the covered range.
     *
     * @param index the zero-based frame index, from 0 to count - 1
     * @returns the start time of the frame in seconds
     * @throws {TypeError} if the index is not an integer
     * @throws {RangeError} if the index is negative or not less than the count
     */
    public getTime(index: number): number {
        if (!isNumber(index) || !Number.isInteger(index)) {
            throw new TypeError("Sample index must be a finite integer.");
        }
        if (index < 0 || index >= this.count) {
            throw new RangeError("Sample index must be within the frame count.");
        }
        return index * this.getInterval();
    }

    /**
     * Returns the frame that contains a point in time.
     *
     * The frame is found by flooring the time divided by the interval, so a time
     * inside a frame maps to that frame: frame zero covers times from zero up to
     * but excluding one interval, and the last frame ends at the duration. The
     * duration itself lies outside the plan because the plan is half-open.
     *
     * @param time the finite time in seconds to locate
     * @returns the zero-based index of the containing frame
     * @throws {TypeError} if the time is not a finite number
     * @throws {RangeError} if the time is negative or not before the duration
     */
    public getIndex(time: number): number {
        if (!isNumber(time)) {
            throw new TypeError("Sample time must be a finite number of seconds.");
        }
        const index: number = Math.floor(time / this.getInterval());
        if (index < 0 || index >= this.count) {
            throw new RangeError("Sample time must be within the covered duration.");
        }
        return index;
    }

    /**
     * Compares the frame count and duration of two sampling plans.
     *
     * Only the primary fields are compared: plans with the same count and duration
     * are equal, because the rate and the interval derive from them.
     *
     * @param other the plan to compare with this one
     * @returns `true` if the counts and durations are identical, `false` otherwise
     * @throws {TypeError} if the operand is not a sample
     */
    public equals(other: Sample): boolean {
        if (!(other instanceof Sample)) {
            throw new TypeError("Sample operand must be a Sample.");
        }
        return this.count === other.count && this.duration === other.duration;
    }

    /**
     * Renders the frame count, rate and duration for debugging.
     *
     * The interval is omitted because it follows from the rate.
     *
     * @returns a description containing the count, the rate in hertz and the duration
     */
    public toString(): string {
        return `Sample(${this.count} frames, ${this.rate}Hz, ${this.duration}s)`;
    }
}

/**
 * Tests whether a value is a `Sample`.
 *
 * The check is re-exported from the guard so that the sample brand test sits next
 * to the class it recognises. It inspects the `SampleSymbol` property and accepts
 * any object or function that advertises the brand; the instance's methods are
 * not validated.
 *
 * @param target the value to inspect
 * @returns `true` if the value advertises the sample brand
 */
export { isSample } from "#semantic/guard";
