import { isNumber } from "#semantic/guard";
import { Optional } from "#semantic/optional";
import { Sample } from "#semantic/mathematics/sample";
import type { SpectralWindow } from "#semantic/mathematics/window";
import { windowed } from "#semantic/mathematics/window";
import { FrameSymbol } from "#semantic/symbol";

/**
 * Collects finite samples from an iterable into a new array.
 *
 * The iterable is consumed exactly once, in iteration order, and each value is
 * checked with the shared finite-number guard, so `NaN`, infinities and
 * non-numeric values are rejected rather than collected. The returned array is
 * a fresh copy and is not frozen, because the caller decides whether to store or
 * freeze it; an empty iterable is accepted and yields an empty array.
 *
 * @param values - the candidate samples, consumed once in iteration order
 * @param name - the role used in the rejection message, such as `Frame values`
 * @returns a new array holding the accepted samples in iteration order
 * @throws {TypeError} if any value is not a finite number
 */
const requireSamples: (values: Iterable<number>, name: string) => Array<number> = (values: Iterable<number>, name: string): Array<number> => {
    const collected: Array<number> = [];
    for (const value of values) {
        if (!isNumber(value)) {
            throw new TypeError(`${name} must contain finite numbers.`);
        }
        collected.push(value);
    }
    return collected;
}

/**
 * A finite block of samples tied to the sampling plan that produced it.
 *
 * The plan fixes the rate, the frame times and the covered duration, while the
 * values hold one finite sample per frame, so a frame can report time-domain
 * measurements without an extra rate argument. The constructor enforces that the
 * sample count equals the plan's frame count, so `size()`, the valid index range
 * and the plan's count always agree, and the samples are stored in a frozen
 * array that no operation mutates.
 *
 * A frame is immutable: every derived frame is a new value and the original is
 * left unchanged. Measurements use the sample values as they are, without a unit
 * conversion, so their units are the units of the samples. `isFrame` recognises
 * instances at runtime through the symbol-keyed brand each instance carries.
 */
export class Frame {

    private readonly plan: Sample;
    private readonly values: ReadonlyArray<number>;
    /**
     * The registered frame brand read by the shared runtime guard.
     *
     * The property is symbol-keyed, carries the registered `FrameSymbol` value and
     * is present on every instance, so `isFrame` recognises subclasses as frames
     * as well.
     */
    protected readonly [FrameSymbol]: symbol = FrameSymbol;

    /**
     * Creates a frame from a sampling plan and one sample per frame.
     *
     * The values are copied into a new frozen array, so neither the samples nor
     * their order can change through this frame afterwards. The value count must
     * equal the plan's frame count exactly; because a plan always covers at least
     * one frame, a successfully constructed frame is never empty.
     *
     * @param plan - the sampling plan fixing the rate, the frame times and the
     *        covered duration
     * @param values - the finite samples in frame order, one per frame of the
     *        plan
     * @throws {TypeError} if the plan is not a `Sample`, or a value is not a
     *         finite number
     * @throws {RangeError} if the number of values differs from the plan's frame
     *         count
     */
    public constructor(plan: Sample, values: Iterable<number>) {
        if (!(plan instanceof Sample)) {
            throw new TypeError("Frame plan must be a Sample.");
        }
        const collected: Array<number> = requireSamples(values, "Frame values");
        if (collected.length !== plan.getCount()) {
            throw new RangeError("Frame value count must match the frame count of its plan.");
        }
        this.plan = plan;
        this.values = Object.freeze(collected);
    }

    /**
     * Creates a frame from samples and a frame rate, deriving the duration.
     *
     * The duration is the sample count divided by the rate. That is the covered
     * span of the plan, not the distance between the first and the last sample:
     * the last sample starts one sampling interval before the duration, matching
     * the half-open plan. The rate is validated before the samples are collected,
     * and at least one sample is required.
     *
     * @param values - the finite samples in frame order, at least one
     * @param rate - the frame rate in frames per second, positive and finite
     * @returns a new frame whose plan has the sample count of `values` and a
     *         covered duration of count / rate seconds
     * @throws {TypeError} if the rate is not a finite number, or a value is not a
     *         finite number
     * @throws {RangeError} if the rate is not positive, or `values` yields no
     *         samples
     */
    public static useRate(values: Iterable<number>, rate: number): Frame {
        if (!isNumber(rate)) {
            throw new TypeError("Frame rate must be a finite number.");
        }
        if (rate <= 0) {
            throw new RangeError("Frame rate must be positive.");
        }
        const collected: Array<number> = requireSamples(values, "Frame values");
        if (collected.length < 1) {
            throw new RangeError("Frame must contain at least one sample.");
        }
        return new Frame(new Sample(collected.length, collected.length / rate), collected);
    }

    /**
     * Returns the sampling plan of this frame.
     *
     * The plan is the stored plan itself, not a copy, and it fixes the frame rate
     * in hertz, the frame times in seconds and the covered duration in seconds.
     *
     * @returns the plan that produced this frame
     */
    public getSample(): Sample {
        return this.plan;
    }

    /**
     * Returns the samples of this frame.
     *
     * The returned array is the frame's frozen storage rather than a copy, so it
     * cannot be modified and its length equals `size()`. Its elements appear in
     * frame order, and callers that need a mutable array should use `toArray`.
     *
     * @returns the frozen samples in frame order
     */
    public getValues(): ReadonlyArray<number> {
        return this.values;
    }

    /**
     * Returns the number of samples in this frame.
     *
     * The count equals the frame count of the sampling plan and is always at
     * least one for a constructed frame.
     *
     * @returns the sample count, always at least one
     */
    public size(): number {
        return this.values.length;
    }

    /**
     * Reports whether this frame holds no samples.
     *
     * A frame always holds at least one sample, because a sampling plan covers at
     * least one frame and the constructor requires the value count to match it.
     * This always returns `false` for a constructed frame.
     *
     * @returns `false` for every constructed frame
     */
    public isEmpty(): boolean {
        return this.values.length === 0;
    }

    /**
     * Returns the sample at a zero-based index.
     *
     * A negative or past-the-end integer index does not throw: it produces an
     * empty `Optional`, so a lookup never clamps to the edge of the frame. A
     * sample whose value is zero is present rather than empty, and the frame is
     * not modified.
     *
     * @param index - the zero-based sample index, which may be negative or past
     *        the end of the frame
     * @returns an `Optional` holding the sample, or an empty `Optional` when the
     *         index lies outside `[0, size - 1]`
     * @throws {TypeError} if the index is not a finite integer
     */
    public at(index: number): Optional<number> {
        if (!isNumber(index) || !Number.isInteger(index)) {
            throw new TypeError("Frame index must be a finite integer.");
        }
        return index < 0 || index >= this.values.length ? Optional.empty() : Optional.of(this.values[index]);
    }

    /**
     * Returns the start time of the frame at an index.
     *
     * The time is delegated to the sampling plan, so it equals the index
     * multiplied by the sampling interval. Frame zero starts at zero seconds and
     * the last frame starts one interval before the covered duration. Because the
     * plan's frame count always equals `size()`, every index below the size is
     * accepted and every other index is rejected.
     *
     * @param index - the zero-based frame index, from 0 to `size() - 1`
     * @returns the start time of that frame in seconds
     * @throws {TypeError} if the index is not a finite integer
     * @throws {RangeError} if the index is negative or not less than the sample
     *         count
     */
    public getTime(index: number): number {
        return this.plan.getTime(index);
    }

    /**
     * Returns the arithmetic mean of the samples.
     *
     * The mean is the sum of every sample divided by the sample count, so it uses
     * the units of the samples and lies between the smallest and the largest
     * sample. A frame always holds at least one sample, so the result is always
     * defined; a silent frame returns zero. The frame is not modified.
     *
     * @returns the mean sample value
     */
    public mean(): number {
        let total: number = 0;
        for (const value of this.values) {
            total += value;
        }
        return total / this.values.length;
    }

    /**
     * Returns the root mean square of the samples.
     *
     * The value is the square root of the average of the squared samples, so it
     * is non-negative and carries the units of the samples. It is zero for a
     * silent frame, and the frame is not modified.
     *
     * @returns the root mean square sample value, always at least zero
     */
    public rms(): number {
        return Math.sqrt(this.power());
    }

    /**
     * Returns the largest absolute sample.
     *
     * The result is the maximum of `|sample|` over the frame, so it is
     * non-negative, carries the units of the samples and is zero for a silent
     * frame. The search starts from zero, so frames whose samples are all
     * negative still report their magnitude.
     *
     * @returns the largest absolute sample, always at least zero
     */
    public peak(): number {
        let maximum: number = 0;
        for (const value of this.values) {
            maximum = Math.max(maximum, Math.abs(value));
        }
        return maximum;
    }

    /**
     * Returns the difference between the largest and the smallest sample.
     *
     * The result is non-negative, carries the units of the samples and is zero
     * for a constant frame, including a silent one. A frame always holds at least
     * one sample, so both extremes are found rather than left at their initial
     * bounds.
     *
     * @returns the peak-to-peak span of the samples, always at least zero
     */
    public peakToPeak(): number {
        let minimum: number = Number.POSITIVE_INFINITY;
        let maximum: number = Number.NEGATIVE_INFINITY;
        for (const value of this.values) {
            minimum = Math.min(minimum, value);
            maximum = Math.max(maximum, value);
        }
        return maximum - minimum;
    }

    /**
     * Returns the sum of the squared samples.
     *
     * This is the discrete signal energy: the sum of `sample * sample` over the
     * frame, expressed in the square of the sample units and always at least
     * zero. A silent frame returns zero, and the value is not normalized by the
     * sample count; use `power()` for the average.
     *
     * @returns the sum of the squared samples, always at least zero
     */
    public energy(): number {
        let total: number = 0;
        for (const value of this.values) {
            total += value * value;
        }
        return total;
    }

    /**
     * Returns the mean squared sample.
     *
     * The value is `energy() / size()`, the average signal power, in the square of
     * the sample units and always at least zero. Because a frame holds at least
     * one sample, the division is always defined; a silent frame returns zero.
     *
     * @returns the mean squared sample value, always at least zero
     */
    public power(): number {
        return this.energy() / this.values.length;
    }

    /**
     * Returns the ratio of the peak to the root mean square.
     *
     * The ratio is dimensionless and at least one for a non-silent frame, because
     * the root mean square never exceeds the peak. A silent frame has a root mean
     * square of zero, for which the method returns positive infinity instead of
     * dividing by zero.
     *
     * @returns the crest factor, or `Infinity` when the root mean square is zero
     */
    public crestFactor(): number {
        const rms: number = this.rms();
        return rms === 0 ? Number.POSITIVE_INFINITY : this.peak() / rms;
    }

    /**
     * Returns the population variance of the samples.
     *
     * The variance is the average of the squared deviations from `mean()`, divided
     * by the sample count rather than by `size() - 1`, so the frame is treated as
     * the whole population. It is non-negative, expressed in the square of the
     * sample units and zero for a constant frame, including a single-sample frame.
     *
     * @returns the population variance, always at least zero
     */
    public variance(): number {
        const mean: number = this.mean();
        let total: number = 0;
        for (const value of this.values) {
            const difference: number = value - mean;
            total += difference * difference;
        }
        return total / this.values.length;
    }

    /**
     * Returns the population standard deviation of the samples.
     *
     * The value is the square root of `variance()`, so it is non-negative, carries
     * the units of the samples rather than their square and is zero for a
     * constant frame.
     *
     * @returns the population standard deviation, always at least zero
     */
    public standardDeviation(): number {
        return Math.sqrt(this.variance());
    }

    /**
     * Returns the number of sign changes between adjacent samples.
     *
     * A crossing is counted when the product of two adjacent samples is strictly
     * negative, so a transition through zero is not counted: any pair that
     * includes a zero sample has a product of zero and is skipped. The result is a
     * non-negative integer no greater than `size() - 1`, and a frame of one sample
     * reports zero.
     *
     * @returns the number of strict sign changes between adjacent samples
     */
    public zeroCrossings(): number {
        let crossings: number = 0;
        for (let index: number = 1; index < this.values.length; index += 1) {
            if (this.values[index - 1] * this.values[index] < 0) {
                crossings += 1;
            }
        }
        return crossings;
    }

    /**
     * Returns the root mean square level in decibels relative to a reference.
     *
     * The level is `20 * log10(rms / reference)`, so the reference is an amplitude
     * rather than a power. The result is negative when the root mean square is
     * below the reference and zero when the two are equal; the default reference
     * of one expresses the level relative to unit amplitude. A silent frame has a
     * root mean square of zero and returns negative infinity instead of dividing
     * by zero.
     *
     * @param reference - the positive finite reference amplitude in the sample
     *        units; defaults to one
     * @returns the level in decibels, or `-Infinity` for a silent frame
     * @throws {TypeError} if the reference is not a finite number
     * @throws {RangeError} if the reference is not positive
     */
    public decibel(reference: number = 1): number {
        if (!isNumber(reference)) {
            throw new TypeError("Frame decibel reference must be a finite number.");
        }
        if (reference <= 0) {
            throw new RangeError("Frame decibel reference must be positive.");
        }
        const rms: number = this.rms();
        return rms === 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(rms / reference);
    }

    /**
     * Returns a frame with the mean removed.
     *
     * Every sample is replaced by `sample - mean()`, which shifts the frame so its
     * mean is zero and removes the DC component. The sampling plan, the rate and
     * the covered duration are reused unchanged, the result is a new frame and
     * this frame is left untouched; a silent frame produces another silent frame.
     *
     * @returns a new frame holding the mean-subtracted samples with the same plan
     */
    public detrended(): Frame {
        const mean: number = this.mean();
        return new Frame(this.plan, this.values.map((value: number): number => value - mean));
    }

    /**
     * Returns a frame with every sample multiplied by a finite factor.
     *
     * The factor is applied sample by sample and the sampling plan is reused
     * unchanged, so the rate, the frame times and the covered duration are
     * preserved. A factor of zero produces a silent frame, a negative factor
     * inverts the sign, and a factor of one reproduces the values. The original
     * frame is not modified.
     *
     * @param factor - the finite dimensionless scale applied to every sample; it
     *        may be zero or negative
     * @returns a new frame holding the scaled samples with the same plan
     * @throws {TypeError} if the factor is not a finite number
     */
    public scaled(factor: number): Frame {
        if (!isNumber(factor)) {
            throw new TypeError("Frame scale must be a finite number.");
        }
        return new Frame(this.plan, this.values.map((value: number): number => value * factor));
    }

    /**
     * Returns a frame scaled so that its largest absolute sample is one.
     *
     * The frame is divided by `peak()`, so the result keeps the shape and sign of
     * this frame but has a peak magnitude of one and the same sampling plan. A
     * silent frame has no peak to normalize against, so it is rejected rather than
     * returned unchanged. The original frame is not modified.
     *
     * @returns a new frame whose largest absolute sample is one, with the same
     *         plan
     * @throws {RangeError} if every sample is zero
     */
    public normalized(): Frame {
        const peak: number = this.peak();
        if (peak === 0) {
            throw new RangeError("A silent frame cannot be normalized.");
        }
        return this.scaled(1 / peak);
    }

    /**
     * Returns the sample-wise sum of two frames that share one plan.
     *
     * The result holds `this.values[index] + other.values[index]` at every index
     * and reuses this frame's plan, so the rate, the frame times and the covered
     * duration are preserved. Both operands must have equal plans, which `Sample`
     * decides by comparing the frame count and the duration exactly; samples are
     * not aligned by time or resampled. Neither operand is modified.
     *
     * @param other - the frame to add, which must share this frame's sampling plan
     * @returns a new frame holding the sample-wise sums with the shared plan
     * @throws {TypeError} if the operand is not a `Frame`
     * @throws {RangeError} if the plans are not equal
     */
    public plus(other: Frame): Frame {
        if (!(other instanceof Frame)) {
            throw new TypeError("Frame operand must be a Frame.");
        }
        if (!this.plan.equals(other.plan)) {
            throw new RangeError("Frame operands must share the same sampling plan.");
        }
        return new Frame(this.plan, this.values.map((value: number, index: number): number => value + other.values[index]));
    }

    /**
     * Returns a frame with a window applied to every sample.
     *
     * Each sample is multiplied by `window(index, size())`, so the window receives
     * the zero-based position and the frame length and returns a weight rather
     * than a scaled sample. The weights are used as returned: they are checked for
     * finiteness but not clipped, so a negative weight inverts the sign and a
     * weight above one amplifies the sample. The sampling plan is reused
     * unchanged, and this frame is not modified.
     *
     * @param window - the weight function evaluated once per sample with its index
     *        and the frame length; it must return a finite weight
     * @returns a new frame holding the weighted samples with the same plan
     * @throws {TypeError} if the window is not callable
     * @throws {RangeError} if the window returns a non-finite weight
     */
    public windowed(window: SpectralWindow): Frame {
        return new Frame(this.plan, windowed(this.values, window));
    }

    /**
     * Returns the linearly interpolated sample at a point in time.
     *
     * The time is converted to a fractional sample position with
     * `time * getSample().getRate()`, then the two neighbouring samples are mixed
     * in proportion to the fractional part. Times in the final interval, from the
     * start of the last sample up to and including the covered duration, return
     * the last sample instead of extrapolating. At an exact frame start the method
     * returns that frame's sample.
     *
     * @param time - the finite time in seconds since the start of the frame,
     *        within `[0, getSample().getDuration()]`
     * @returns the interpolated sample, in the units of the samples
     * @throws {TypeError} if the time is not a finite number
     * @throws {RangeError} if the time is negative or greater than the covered
     *         duration
     */
    public interpolate(time: number): number {
        if (!isNumber(time)) {
            throw new TypeError("Frame time must be a finite number of seconds.");
        }
        if (time < 0 || time > this.plan.getDuration()) {
            throw new RangeError("Frame time must lie inside the covered duration.");
        }
        const position: number = time * this.plan.getRate();
        const index: number = Math.floor(position);
        if (index >= this.values.length - 1) {
            return this.values[this.values.length - 1];
        }
        const fraction: number = position - index;
        return this.values[index] * (1 - fraction) + this.values[index + 1] * fraction;
    }

    /**
     * Returns this frame resampled to another frame rate.
     *
     * A new plan is derived for the requested rate over the same covered duration,
     * so the frame count becomes the rounded product of the rate and the duration
     * and the effective rate can differ slightly from the requested one. Every new
     * frame time is then evaluated with linear interpolation, and the original
     * frame is not modified.
     *
     * @param rate - the target frame rate in frames per second, positive and
     *        finite
     * @returns a new frame covering the same duration at the requested rate,
     *         rounded to a whole frame count
     * @throws {TypeError} if the rate is not a finite number
     * @throws {RangeError} if the rate is not positive, or the rate multiplied by
     *         the covered duration rounds to less than one frame
     */
    public resample(rate: number): Frame {
        if (!isNumber(rate)) {
            throw new TypeError("Frame resample rate must be a finite number.");
        }
        if (rate <= 0) {
            throw new RangeError("Frame resample rate must be positive.");
        }
        const plan: Sample = Sample.useRate(rate, this.plan.getDuration());
        const values: Array<number> = [];
        for (let index: number = 0; index < plan.getCount(); index += 1) {
            values.push(this.interpolate(plan.getTime(index)));
        }
        return new Frame(plan, values);
    }

    /**
     * Returns the full linear convolution of this frame with a finite kernel.
     *
     * The result sample at index `n` is the sum of `this.values[k] * taps[n - k]`
     * over every in-range `k`, so the output holds `size() + taps.length - 1`
     * samples and no truncation is applied. The new frame is sampled at this
     * frame's rate and covers the longer duration implied by the extended sample
     * count; a kernel given as a `Frame` contributes its samples in frame order,
     * and its own plan is ignored. Neither operand is modified.
     *
     * @param kernel - the finite kernel samples, either an iterable of finite
     *        numbers or a `Frame` whose samples are used; at least one sample is
     *        required
     * @returns a new frame holding the full convolution, sampled at this frame's
     *         rate
     * @throws {TypeError} if the kernel is not a `Frame` and yields a value that
     *         is not a finite number
     * @throws {RangeError} if the kernel is empty
     */
    public convolve(kernel: Iterable<number> | Frame): Frame {
        const taps: Array<number> = kernel instanceof Frame
            ? [...kernel.getValues()]
            : requireSamples(kernel, "Frame kernel");
        if (taps.length < 1) {
            throw new RangeError("Frame kernel must contain at least one sample.");
        }
        const length: number = this.values.length + taps.length - 1;
        const output: Array<number> = new Array<number>(length).fill(0);
        for (let index: number = 0; index < this.values.length; index += 1) {
            for (let tap: number = 0; tap < taps.length; tap += 1) {
                output[index + tap] += this.values[index] * taps[tap];
            }
        }
        return new Frame(new Sample(length, length / this.plan.getRate()), output);
    }

    /**
     * Returns the full cross-correlation of two equally sized frames.
     *
     * The result is an array of `2 * size() - 1` sums in ascending lag order, with
     * lag zero at index `size() - 1`: index `n` corresponds to lag
     * `n - (size() - 1)` and holds the sum of
     * `this.values[j + lag] * other.values[j]` over the overlapping positions `j`.
     * The frames are aligned by index rather than by time, so only their sample
     * counts must match and their sampling plans may differ. The sums are not
     * normalized, so their units are the product of the two frames' sample units.
     *
     * @param other - the frame to correlate with this one, with the same number of
     *        samples
     * @returns the correlation sums in ascending lag order, with lag zero at the
     *         centre index
     * @throws {TypeError} if the operand is not a `Frame`
     * @throws {RangeError} if the operand has a different sample count
     */
    public correlate(other: Frame): Array<number> {
        if (!(other instanceof Frame)) {
            throw new TypeError("Frame operand must be a Frame.");
        }
        if (other.size() !== this.size()) {
            throw new RangeError("Frame correlation requires equally sized frames.");
        }
        const count: number = this.values.length;
        const output: Array<number> = [];
        for (let lag: number = -(count - 1); lag <= count - 1; lag += 1) {
            let total: number = 0;
            for (let index: number = 0; index < count; index += 1) {
                const shifted: number = index - lag;
                if (shifted >= 0 && shifted < count) {
                    total += this.values[index] * other.values[shifted];
                }
            }
            output.push(total);
        }
        return output;
    }

    /**
     * Returns the autocorrelation of this frame as a symmetric lag series.
     *
     * The result is `correlate(this)`, so it holds `2 * size() - 1` sums with lag
     * zero at index `size() - 1`. The series is symmetric about that centre, whose
     * value equals `energy()`. The sums are not normalized and the frame is not
     * modified.
     *
     * @returns the autocorrelation sums in ascending lag order, symmetric about
     *         the centre index
     */
    public autocorrelate(): Array<number> {
        return this.correlate(this);
    }

    /**
     * Returns a mutable copy of the samples.
     *
     * The array is newly allocated, so changing it does not affect this frame, and
     * its order matches the frame order. Use `getValues()` to read the frozen
     * storage without copying.
     *
     * @returns a new mutable array holding the samples in frame order
     */
    public toArray(): Array<number> {
        return [...this.values];
    }

    /**
     * Compares the plan and every sample within a tolerance.
     *
     * Two frames are equal when `Sample.equals` accepts their plans, which
     * compares the frame count and the duration exactly rather than the derived
     * rate, and when every sample differs by no more than the absolute tolerance.
     * The tolerance is used as a magnitude, so a negative value behaves like its
     * positive counterpart and zero requires identical samples. Neither frame is
     * modified.
     *
     * @param other - the frame to compare with this one
     * @param epsilon - the finite absolute tolerance in the units of the samples;
     *        defaults to `1E-9` and is used as a magnitude
     * @returns `true` if the plans are equal and every sample lies within the
     *         tolerance, `false` otherwise
     * @throws {TypeError} if the operand is not a `Frame` or the tolerance is not
     *         a finite number
     */
    public equals(other: Frame, epsilon: number = 1E-9): boolean {
        if (!(other instanceof Frame)) {
            throw new TypeError("Frame operand must be a Frame.");
        }
        if (!isNumber(epsilon)) {
            throw new TypeError("Frame epsilon must be a finite number.");
        }
        if (!this.plan.equals(other.plan) || this.values.length !== other.values.length) {
            return false;
        }
        return this.values.every((value: number, index: number): boolean => Math.abs(value - other.values[index]) <= Math.abs(epsilon));
    }

    /**
     * Renders the sample count and the sampling plan for debugging.
     *
     * The text is `Frame(<count> samples, <plan>)`, where the plan renders its own
     * frame count, rate in hertz and duration in seconds. The output is meant for
     * inspection and is not a parsable serialization.
     *
     * @returns a description containing the sample count and the sampling plan
     */
    public toString(): string {
        return `Frame(${this.values.length} samples, ${this.plan})`;
    }
}

/**
 * Tests whether a value is a `Frame`.
 *
 * The check is re-exported from the shared guard so that the frame brand test
 * sits next to the class it recognises. It inspects the `FrameSymbol` property
 * and accepts any object or function that advertises the brand; the samples, the
 * sampling plan and the methods of the value are not validated.
 *
 * @param target - the value to inspect
 * @returns `true` if the value advertises the frame brand
 */
export { isFrame } from "#semantic/guard";
