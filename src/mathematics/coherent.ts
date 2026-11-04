import { isFunction, isNumber } from "#semantic/guard";
import { Angle } from "#semantic/mathematics/angle";
import { Complex } from "#semantic/mathematics/complex";
import { Frame } from "#semantic/mathematics/frame";
import { Frequency } from "#semantic/mathematics/frequency";
import { Sample } from "#semantic/mathematics/sample";
import { Spectrum } from "#semantic/mathematics/spectrum";
import { fastFourierTransform } from "#semantic/mathematics/spectral";
import { asComplex } from "#semantic/mathematics/transform";
import type { SpectralWindow } from "#semantic/mathematics/window";
import { useHannWindow, windowed } from "#semantic/mathematics/window";
import { Optional } from "#semantic/optional";
import { CoherenceSymbol } from "#semantic/symbol";

/**
 * The segmentation used by the coherence estimate.
 *
 * Coherence needs several short-time spectra to average, so the frames are cut
 * into segments of `frameSize` samples starting every `hopSize` samples. A
 * shorter segment resolves less frequency detail but yields more averages and
 * therefore a less biased estimate. `window` tapers each segment before its
 * transform; defaults keep the whole frame, half-overlap and a Hann taper.
 *
 * The options are read once when an estimate starts and are never stored by the
 * result, so later changes to an object that was passed in cannot alter an
 * estimate that has already been built. Every explicit size must be an integer:
 * `frameSize` must also fit within the frame length, while `hopSize` need only
 * be positive.
 */
export interface CoherenceOptions {
    /**
     * The number of samples per segment.
     *
     * The value must be a positive integer no greater than the frame length, and
     * it is counted in samples rather than in seconds. An omitted value uses the
     * whole frame, which leaves room for exactly one segment whatever the hop
     * size and makes the transform span the entire input. A shorter segment
     * yields a coarser frequency resolution but more segments to average.
     */
    readonly frameSize?: number;
    /**
     * The number of samples between consecutive segment starts.
     *
     * The value must be a positive integer and is counted in samples, not in
     * seconds. It may be smaller than `frameSize`, in which case consecutive
     * segments overlap, or larger, in which case they leave a gap. An omitted
     * value uses half a segment, floored and never less than one sample, so the
     * default overlap is about half a segment.
     */
    readonly hopSize?: number;
    /**
     * The window applied to every segment before its transform.
     *
     * The function receives a zero-based position within the segment and the
     * segment length and returns a finite, dimensionless weight, which is applied
     * independently to every segment. An omitted value uses the Hann window,
     * which tapers both ends of every segment longer than one sample to zero.
     */
    readonly window?: SpectralWindow;
}

/**
 * One frequency bin of a coherence estimate.
 *
 * The magnitude is the squared coherence within `[0, 1]`, the phase is the
 * argument of the averaged cross-spectrum and the cross value keeps the full
 * complex average, so a caller can inspect the same estimate without replaying
 * the segments. A point is a frozen plain object produced by
 * `Coherence.toArray`; it carries no behaviour of its own.
 */
export interface CoherencePoint {
    /**
     * The frequency of this bin.
     *
     * The value is `index * rate / segmentLength` hertz, where `rate` is the
     * frame rate of the sources, so the first bin sits at zero hertz and adjacent
     * bins are one resolution apart.
     */
    readonly frequency: Frequency;
    /**
     * The squared coherence of this bin.
     *
     * The value is dimensionless and lies within `[0, 1]`: one means the two
     * signals are perfectly linearly related at this frequency, while zero means
     * they are not. The estimate clamps the ratio into that interval, and the
     * constructor rejects a supplied value outside it.
     */
    readonly magnitude: number;
    /**
     * The phase of the averaged cross-spectrum at this bin.
     *
     * The value is a radian angle normalised into one positive turn, so it lies
     * within `[0, 2 * PI)`. A positive phase means the second signal leads the
     * first at this frequency, and a phase of zero means the two are aligned.
     */
    readonly phase: Angle;
    /**
     * The averaged cross-spectrum value of this bin.
     *
     * The value is `mean(conj(A) * B)` over the retained segments, where `A` and
     * `B` are the windowed segment spectra. Its magnitude is the cross power and
     * its argument is the relative phase. The transform is unnormalised, so the
     * magnitude scales with the squared segment length and carries the squared
     * units of the samples.
     */
    readonly cross: Complex;
}

/**
 * The validated segmentation shared by the estimators.
 *
 * A value of this shape is produced only after both frames and every option have
 * been checked, so the estimators can read its fields without validating them
 * again. The plan covers one segment rather than the whole input frame.
 */
interface Segmentation {
    /**
     * The sampling plan of one segment.
     *
     * Its frame count equals `frameSize` and its rate follows the sources, so its
     * duration is `frameSize / rate` seconds.
     */
    readonly plan: Sample;
    /**
     * The number of samples in each segment.
     *
     * The value is a positive integer no greater than the frame length and is
     * stored in samples, not seconds.
     */
    readonly frameSize: number;
    /**
     * The number of samples between consecutive segment starts.
     *
     * The value is a positive integer and may exceed the frame size, in which
     * case consecutive segments leave a gap.
     */
    readonly hopSize: number;
    /**
     * The window applied to every segment before its transform.
     *
     * The callable receives a position and a length and returns a finite,
     * dimensionless weight.
     */
    readonly window: SpectralWindow;
}

/**
 * Validates two frames and derives the segmentation.
 *
 * Both frames must cover the same sampling plan, because a coherence estimate
 * compares samples at identical times. The frame size defaults to the frame
 * length, the hop defaults to half a segment and the window defaults to Hann;
 * every explicit value is validated before any transform runs. The returned plan
 * covers exactly one segment and derives its rate from the inputs, so its frame
 * count is the frame size and its duration is `frameSize / rate` seconds.
 *
 * The validation is pure: it reads the frames and the options and constructs a
 * new plan, but it transforms nothing and modifies no argument.
 *
 * @param first - the first frame, which supplies the frame length and the rate
 * @param second - the second frame, which must cover the same plan as `first`
 * @param options - the optional overrides; an omitted field takes its default
 * @returns the validated segmentation and the derived segment plan
 * @throws {TypeError} if either frame is not a `Frame`, or the window is not
 *         callable
 * @throws {RangeError} if the frames do not share a sampling plan, if
 *         `frameSize` is not an integer within `[1, frame length]`, or if
 *         `hopSize` is not a positive integer
 */
const segment: (first: Frame, second: Frame, options: CoherenceOptions) => Segmentation =
    (first: Frame, second: Frame, options: CoherenceOptions): Segmentation => {
        if (!(first instanceof Frame) || !(second instanceof Frame)) {
            throw new TypeError("Coherence inputs must be frames.");
        }
        if (!first.getSample().equals(second.getSample())) {
            throw new RangeError("Coherence frames must share the same sampling plan.");
        }
        const count: number = first.size();
        const frameSize: number = options.frameSize === undefined ? count : options.frameSize;
        if (!isNumber(frameSize) || !Number.isInteger(frameSize) || frameSize < 1 || frameSize > count) {
            throw new RangeError("Coherence frame size must be an integer within the frame length.");
        }
        const hopSize: number = options.hopSize === undefined ? Math.max(1, Math.floor(frameSize / 2)) : options.hopSize;
        if (!isNumber(hopSize) || !Number.isInteger(hopSize) || hopSize < 1) {
            throw new RangeError("Coherence hop size must be a positive integer.");
        }
        const window: SpectralWindow = options.window === undefined ? useHannWindow : options.window;
        if (!isFunction(window)) {
            throw new TypeError("Coherence window must be a window function.");
        }
        return {
            plan: new Sample(frameSize, frameSize / first.getSample().getRate()),
            frameSize,
            hopSize,
            window,
        };
    }

/**
 * The averaged spectra shared by the coherence and cross-spectrum estimators.
 *
 * A value of this shape holds the segmentation that was used, the per-bin
 * averages over the retained segments and the number of segments that were
 * summed. The arrays hold one entry per bin, so an estimate can derive every
 * reported value without transforming the frames again.
 */
interface Averages {
    /**
     * The validated segmentation that produced the averages.
     */
    readonly segmentation: Segmentation;
    /**
     * The averaged cross-spectrum values, one per bin.
     *
     * Each entry is `mean(conj(A) * B)` and keeps both components, so its
     * magnitude is the cross power and its argument the relative phase.
     */
    readonly cross: ReadonlyArray<Complex>;
    /**
     * The averaged power of the first frame, one per bin.
     *
     * Each entry is the mean of `|A|^2`, where `A` is the windowed segment
     * spectrum, so it is non-negative. The transform is unnormalised, so the
     * value scales with the squared segment length and carries the squared units
     * of the samples.
     */
    readonly powerFirst: ReadonlyArray<number>;
    /**
     * The averaged power of the second frame, one per bin.
     *
     * Each entry is the mean of `|B|^2` and has the same unit and meaning as
     * `powerFirst`.
     */
    readonly powerSecond: ReadonlyArray<number>;
    /**
     * The number of segments that were averaged.
     *
     * The value is at least one, because the frame size cannot exceed the frame
     * length and the first segment always starts at index zero.
     */
    readonly segments: number;
}

/**
 * Averages the cross and auto spectra over the segmented frames.
 *
 * Every segment is tapered, transformed and accumulated, so the result is the
 * Welch estimate of `mean(conj(A) * B)`, `mean(|A|^2)` and `mean(|B|^2)`. Two
 * forward transforms are taken per segment, one for each input, and the bins are
 * then accumulated in a single pass, so the cost grows with the segment count and
 * the segment length. At least one segment is guaranteed because the frame size
 * cannot exceed the frame length.
 *
 * The arrays cover every bin of the transform, including the conjugate-symmetric
 * upper half of a real input, and their length equals the frame size. The source
 * frames are not modified. The window is applied independently to every segment
 * and must return finite weights.
 *
 * @param first - the first frame, read once in frame order
 * @param second - the second frame, which must cover the same plan
 * @param options - the optional segmentation overrides, empty by default
 * @returns the averaged spectra and the segment count
 * @throws {TypeError} if a frame is not a `Frame`, the window is not callable, or
 *         a transform component overflows to a non-finite value
 * @throws {RangeError} if the frames do not share a plan, a size is invalid, or
 *         the window returns a non-finite weight
 */
const average: (first: Frame, second: Frame, options: CoherenceOptions) => Averages =
    (first: Frame, second: Frame, options: CoherenceOptions): Averages => {
        const segmentation: Segmentation = segment(first, second, options);
        const cross: Array<Complex> = [];
        const powerFirst: Array<number> = [];
        const powerSecond: Array<number> = [];
        for (let index: number = 0; index < segmentation.frameSize; index += 1) {
            cross.push(new Complex(0, 0));
            powerFirst.push(0);
            powerSecond.push(0);
        }
        const firstValues: ReadonlyArray<number> = first.getValues();
        const secondValues: ReadonlyArray<number> = second.getValues();
        let segments: number = 0;
        for (let start: number = 0; start + segmentation.frameSize <= firstValues.length; start += segmentation.hopSize) {
            const firstSpectrum: Array<Complex> = fastFourierTransform(
                asComplex(windowed(firstValues.slice(start, start + segmentation.frameSize), segmentation.window)));
            const secondSpectrum: Array<Complex> = fastFourierTransform(
                asComplex(windowed(secondValues.slice(start, start + segmentation.frameSize), segmentation.window)));
            for (let bin: number = 0; bin < segmentation.frameSize; bin += 1) {
                cross[bin] = cross[bin].plus(firstSpectrum[bin].conjugate().multiply(secondSpectrum[bin]));
                powerFirst[bin] += firstSpectrum[bin].magnitude() ** 2;
                powerSecond[bin] += secondSpectrum[bin].magnitude() ** 2;
            }
            segments += 1;
        }
        return {
            segmentation,
            cross: cross.map((value: Complex): Complex => value.divide(segments)),
            powerFirst: powerFirst.map((value: number): number => value / segments),
            powerSecond: powerSecond.map((value: number): number => value / segments),
            segments,
        };
    }

/**
 * Estimates the magnitude-squared coherence of two frames.
 *
 * The estimate is `|mean(conj(A)*B)|^2 / (mean(|A|^2) * mean(|B|^2))` over the
 * segmented spectra, which lies in `[0, 1]`: one means the two signals are
 * linearly related at that frequency, zero means they are not. The phase is the
 * argument of the averaged cross-spectrum, so a positive value means the second
 * signal leads the first. A bin whose averaged auto power is zero for either
 * signal reports a coherence of zero rather than an undefined ratio, and any
 * numerical overshoot is clamped into `[0, 1]`.
 *
 * A single segment reports one wherever both transforms are non-zero, so a
 * meaningful estimate needs several segments; the default options produce one
 * segment because the whole frame becomes the only segment. Reduce `frameSize`
 * to obtain more segments and a less biased estimate.
 *
 * @param first - the first frame, read once in frame order
 * @param second - the second frame, which must cover the same plan
 * @param options - the optional segmentation overrides, empty by default
 * @returns a new estimate retaining the plan, the magnitudes, the phases and the
 *         averaged crosses
 * @throws {TypeError} if a frame is not a `Frame`, the window is not callable, or
 *         a transform component overflows to a non-finite value
 * @throws {RangeError} if the frames do not share a plan, a size is invalid, or
 *         the window returns a non-finite weight
 */
export const coherence: (first: Frame, second: Frame, options?: CoherenceOptions) => Coherence =
    (first: Frame, second: Frame, options: CoherenceOptions = {}): Coherence => {
        const averages: Averages = average(first, second, options);
        const magnitudes: Array<number> = [];
        const phases: Array<Angle> = [];
        for (let bin: number = 0; bin < averages.segmentation.frameSize; bin += 1) {
            const product: number = averages.powerFirst[bin] * averages.powerSecond[bin];
            const magnitude: number = product === 0 ? 0 : averages.cross[bin].magnitude() ** 2 / product;
            magnitudes.push(Math.min(1, Math.max(0, magnitude)));
            phases.push(averages.cross[bin].argument());
        }
        return new Coherence(averages.segmentation.plan, magnitudes, phases, averages.cross);
    }

/**
 * Estimates the averaged cross-spectrum of two frames.
 *
 * The result is `mean(conj(A)*B)` over the same segmentation that `coherence`
 * uses, wrapped as a `Spectrum` whose plan covers one segment. Its magnitude is
 * the cross-power and its argument is the relative phase, so the two estimators
 * always describe the same segmentation and can be compared bin by bin.
 *
 * The bins cover every transform bin, including the conjugate-symmetric upper
 * half of a real input, and the returned spectrum is a new immutable value.
 *
 * @param first - the first frame, read once in frame order
 * @param second - the second frame, which must cover the same plan
 * @param options - the optional segmentation overrides, empty by default
 * @returns a new spectrum holding the averaged cross-spectrum values over the
 *         segment plan
 * @throws {TypeError} if a frame is not a `Frame`, the window is not callable, or
 *         a transform component overflows to a non-finite value
 * @throws {RangeError} if the frames do not share a plan, a size is invalid, or
 *         the window returns a non-finite weight
 */
export const crossSpectrum: (first: Frame, second: Frame, options?: CoherenceOptions) => Spectrum =
    (first: Frame, second: Frame, options: CoherenceOptions = {}): Spectrum => {
        const averages: Averages = average(first, second, options);
        return new Spectrum(averages.segmentation.plan, averages.cross);
    }

/**
 * A discrete coherence estimate over one segment plan.
 *
 * The bins follow the plan of the segmentation, so bin `k` denotes
 * `k * rate / frameSize` hertz and adjacent bins are `rate / frameSize` hertz
 * apart. Each bin carries the squared coherence, the phase and the averaged
 * cross-spectrum value, and the full transform is retained, including the
 * conjugate-symmetric upper half of a real input. A coherence is immutable:
 * every array is frozen after construction and a bin outside the estimate yields
 * an empty `Optional` rather than an exception.
 *
 * The constructor validates every component and the three arrays must all hold
 * exactly one value per bin, so an instance always describes a complete
 * estimate. Instances carry the registered brand, so `isCoherence` recognises
 * them at runtime.
 */
export class Coherence {

    /**
     * The segment plan retained by this estimate.
     *
     * Its frame count is the number of bins and its rate is the rate of the
     * source signals.
     */
    private readonly plan: Sample;
    /**
     * The squared coherence of every bin, frozen after construction.
     */
    private readonly magnitudes: ReadonlyArray<number>;
    /**
     * The averaged cross-spectrum phase of every bin, frozen after construction.
     */
    private readonly phases: ReadonlyArray<Angle>;
    /**
     * The averaged cross-spectrum value of every bin, frozen after construction.
     */
    private readonly crosses: ReadonlyArray<Complex>;
    /**
     * The registered coherence brand, read by the shared runtime guard.
     */
    protected readonly [CoherenceSymbol]: symbol = CoherenceSymbol;

    /**
     * Creates a coherence estimate from a plan and one value per bin.
     *
     * The plan fixes the bin count and the bin spacing, so the three iterables
     * must each yield exactly `plan.getCount()` values, in increasing frequency
     * order. Magnitudes are squared coherences and must lie within `[0, 1]`;
     * phases are angles, and crosses are the averaged cross-spectrum values.
     * Each iterable is consumed once, in iteration order, and copied into a new
     * frozen array, so later changes to the sources cannot affect the estimate.
     *
     * Validation runs before any field is stored, so a rejected call leaves no
     * partially built estimate behind. The constructor computes nothing: it
     * stores the values as supplied, so `coherence` is the operation that
     * derives them from frames.
     *
     * @param plan - the segment plan that fixes the count and the spacing
     * @param magnitudes - the squared coherences, one per bin, each within
     *        `[0, 1]`
     * @param phases - the cross-spectrum phases, one per bin
     * @param crosses - the averaged cross-spectrum values, one per bin
     * @throws {TypeError} if the plan is not a `Sample`, a phase is not an
     *         `Angle`, or a cross is not a `Complex`
     * @throws {RangeError} if a magnitude is not a finite number within
     *         `[0, 1]`, or a collection does not yield `plan.getCount()` values
     */
    public constructor(plan: Sample, magnitudes: Iterable<number>, phases: Iterable<Angle>, crosses: Iterable<Complex>) {
        if (!(plan instanceof Sample)) {
            throw new TypeError("Coherence plan must be a Sample.");
        }
        const magnitudeValues: Array<number> = [];
        for (const magnitude of magnitudes) {
            if (!isNumber(magnitude) || magnitude < 0 || magnitude > 1) {
                throw new RangeError("Coherence magnitudes must lie within [0, 1].");
            }
            magnitudeValues.push(magnitude);
        }
        const phaseValues: Array<Angle> = [];
        for (const phase of phases) {
            if (!(phase instanceof Angle)) {
                throw new TypeError("Coherence phases must be angles.");
            }
            phaseValues.push(phase);
        }
        const crossValues: Array<Complex> = [];
        for (const cross of crosses) {
            if (!(cross instanceof Complex)) {
                throw new TypeError("Coherence crosses must be complex values.");
            }
            crossValues.push(cross);
        }
        if (magnitudeValues.length !== plan.getCount()
            || phaseValues.length !== plan.getCount()
            || crossValues.length !== plan.getCount()) {
            throw new RangeError("Coherence arrays must match the frame count of their plan.");
        }
        this.plan = plan;
        this.magnitudes = Object.freeze(magnitudeValues);
        this.phases = Object.freeze(phaseValues);
        this.crosses = Object.freeze(crossValues);
    }

    /**
     * Returns the segment plan that produced this estimate.
     *
     * The plan is the stored instance, not a copy. Its frame count equals the bin
     * count and its rate is the frame rate of the source signals in hertz, so the
     * plan fixes the frequency of every bin.
     *
     * @returns the retained segment plan
     */
    public getSample(): Sample {
        return this.plan;
    }

    /**
     * Returns the number of frequency bins.
     *
     * The count equals the frame count of the retained plan, which is the segment
     * length, and is at least one because a plan covers at least one frame.
     *
     * @returns the number of bins, always at least one
     */
    public size(): number {
        return this.magnitudes.length;
    }

    /**
     * Returns whether this estimate holds no bins.
     *
     * A constructed estimate always holds at least one bin, because the plan
     * covers at least one frame and the three arrays must match its count, so this
     * is `false` for every valid instance. It remains part of the collection-like
     * surface for callers that forward the query.
     *
     * @returns `false` for every constructed estimate
     */
    public isEmpty(): boolean {
        return this.magnitudes.length === 0;
    }

    /**
     * Returns the frame rate of the source signals.
     *
     * The rate comes from the retained segment plan, so it is the rate of the
     * frames that produced the estimate rather than a rate derived from the bin
     * count.
     *
     * @returns the frame rate in frames per second, that is hertz
     */
    public getRate(): number {
        return this.plan.getRate();
    }

    /**
     * Returns the frequency spacing between adjacent bins.
     *
     * The spacing is the frame rate divided by the bin count, which is also the
     * frequency of bin one and the finest frequency difference this estimate can
     * resolve.
     *
     * @returns a new bin spacing in hertz
     */
    public getResolution(): Frequency {
        return new Frequency(this.plan.getRate() / this.plan.getCount());
    }

    /**
     * Returns the Nyquist frequency of the segment plan.
     *
     * The Nyquist frequency is half the frame rate, the highest frequency the
     * plan can represent without aliasing. It is derived from the plan on every
     * call rather than stored, and an even bin count places one bin exactly on it
     * while an odd count stops just below.
     *
     * @returns the Nyquist frequency in hertz
     */
    public getNyquist(): Frequency {
        return new Frequency(this.plan.getRate() / 2);
    }

    /**
     * Returns the squared coherence of one bin.
     *
     * The value is dimensionless and lies within `[0, 1]`, where one means the
     * two signals are perfectly linearly related at that frequency and zero means
     * they are not. The index must be a finite integer but need not lie inside the
     * estimate: a negative index or one at or beyond the size yields an empty
     * `Optional`, so probing a range needs no bounds check of its own.
     *
     * @param index - the zero-based bin index
     * @returns the squared coherence in an `Optional`, or an empty `Optional`
     *         outside the estimate
     * @throws {TypeError} if the index is not a finite integer
     */
    public magnitudeAt(index: number): Optional<number> {
        if (!isNumber(index) || !Number.isInteger(index)) {
            throw new TypeError("Coherence index must be a finite integer.");
        }
        return index < 0 || index >= this.magnitudes.length ? Optional.empty() : Optional.of(this.magnitudes[index]);
    }

    /**
     * Returns the cross-spectrum phase of one bin.
     *
     * The phase is the argument of the averaged cross-spectrum, a radian angle
     * normalised into one positive turn, so it lies in `[0, 2 * PI)`. A positive
     * value means the second signal leads the first at this frequency. If the
     * averaged cross value is exactly zero its argument is the zero angle, so a
     * phase of zero does not by itself imply non-zero cross power. The index
     * follows the boundary behaviour of `magnitudeAt`, so an index outside the
     * estimate yields an empty `Optional` rather than an exception.
     *
     * @param index - the zero-based bin index
     * @returns the phase in an `Optional`, or an empty `Optional` outside the
     *         estimate
     * @throws {TypeError} if the index is not a finite integer
     */
    public phaseAt(index: number): Optional<Angle> {
        if (!isNumber(index) || !Number.isInteger(index)) {
            throw new TypeError("Coherence index must be a finite integer.");
        }
        return index < 0 || index >= this.phases.length ? Optional.empty() : Optional.of(this.phases[index]);
    }

    /**
     * Returns the averaged cross-spectrum value of one bin.
     *
     * The value is `mean(conj(A) * B)` over the retained segments and keeps both
     * components, so its magnitude is the cross power and its argument the
     * relative phase. It is unnormalised, so its magnitude scales with the squared
     * segment length. The index follows the boundary behaviour of `magnitudeAt`,
     * so an index outside the estimate yields an empty `Optional`.
     *
     * @param index - the zero-based bin index
     * @returns the averaged cross-spectrum value in an `Optional`, or an empty
     *         `Optional` outside the estimate
     * @throws {TypeError} if the index is not a finite integer
     */
    public crossAt(index: number): Optional<Complex> {
        if (!isNumber(index) || !Number.isInteger(index)) {
            throw new TypeError("Coherence index must be a finite integer.");
        }
        return index < 0 || index >= this.crosses.length ? Optional.empty() : Optional.of(this.crosses[index]);
    }

    /**
     * Returns the largest squared coherence among the bins.
     *
     * Every bin participates, including the conjugate-symmetric upper half of a
     * real input, and the magnitudes are compared directly, so the value is
     * dimensionless and lies within `[0, 1]`. Several bins may share the maximum;
     * only the value is returned, so the tie does not affect the result. The
     * result is a new `Optional`; the estimate is not modified.
     *
     * @returns the largest squared coherence in an `Optional`, or an empty
     *         `Optional` if this estimate has no bins
     */
    public peakMagnitude(): Optional<number> {
        if (this.magnitudes.length === 0) {
            return Optional.empty();
        }
        let best: number = Number.NEGATIVE_INFINITY;
        for (const magnitude of this.magnitudes) {
            best = Math.max(best, magnitude);
        }
        return Optional.of(best);
    }

    /**
     * Returns the frequency with the largest averaged cross-spectrum magnitude.
     *
     * The peak is chosen by cross magnitude rather than by squared coherence,
     * because coherence is scale-invariant: two identical frames report one even
     * on a numerical noise floor, while their cross magnitude still follows the
     * signal energy. Only the one-sided bins, from zero through
     * `floor(count / 2)`, are searched, so a real signal reports its positive
     * frequency instead of the conjugate mirror. Ties keep the lowest frequency,
     * because a candidate must be strictly stronger to replace the current best.
     *
     * @returns the peak frequency in an `Optional`, empty only when this estimate
     *         has no bins
     */
    public peakFrequency(): Optional<Frequency> {
        if (this.crosses.length === 0) {
            return Optional.empty();
        }
        const last: number = Math.floor(this.crosses.length / 2);
        let position: number = 0;
        let best: number = Number.NEGATIVE_INFINITY;
        for (let index: number = 0; index <= last; index += 1) {
            const strength: number = this.crosses[index].magnitude();
            if (strength > best) {
                best = strength;
                position = index;
            }
        }
        return Optional.of(new Frequency(position * this.plan.getRate() / this.plan.getCount()));
    }

    /**
     * Returns one point per bin, in increasing frequency order.
     *
     * Each point is a new frozen object carrying the bin frequency in hertz, its
     * squared coherence, its phase and its averaged cross value, so the array is
     * an independent snapshot of the estimate. The returned array itself is
     * mutable, but changing it does not affect this estimate and the frozen points
     * cannot be modified.
     *
     * @returns a new array of bin points, one per bin
     */
    public toArray(): Array<CoherencePoint> {
        return this.magnitudes.map((magnitude: number, index: number): CoherencePoint => Object.freeze({
            frequency: new Frequency(index * this.plan.getRate() / this.plan.getCount()),
            magnitude,
            phase: this.phases[index],
            cross: this.crosses[index],
        }));
    }

    /**
     * Compares the plan and every bin within a tolerance.
     *
     * The plans must be equal, which fixes the bin count and the spacing, and the
     * sizes must match before any bin is compared; the tolerance is not applied to
     * the plan itself. Magnitudes are then compared by absolute difference and
     * crosses component by component, with the tolerance as an absolute bound,
     * while phases use `Angle.equals`, whose comparison wraps to the shortest turn
     * and works in radians. The first mismatching bin stops the comparison, and an
     * operand of another type is rejected rather than reported as unequal.
     *
     * @param other - the estimate to compare with this one
     * @param epsilon - the absolute tolerance, applied in each compared value's
     *        own units, and `1E-9` by default
     * @returns `true` if the plans and all bins agree within the tolerance
     * @throws {TypeError} if the operand is not a `Coherence` or the tolerance is
     *         not a finite number
     */
    public equals(other: Coherence, epsilon: number = 1E-9): boolean {
        if (!(other instanceof Coherence)) {
            throw new TypeError("Coherence operand must be a Coherence.");
        }
        if (!isNumber(epsilon)) {
            throw new TypeError("Coherence epsilon must be a finite number.");
        }
        if (!this.plan.equals(other.plan) || this.magnitudes.length !== other.magnitudes.length) {
            return false;
        }
        return this.magnitudes.every((magnitude: number, index: number): boolean =>
            Math.abs(magnitude - other.magnitudes[index]) <= Math.abs(epsilon)
            && this.phases[index].equals(other.phases[index], epsilon)
            && this.crosses[index].equals(other.crosses[index], epsilon));
    }

    /**
     * Renders the bin count and the resolution.
     *
     * The text has the form `Coherence(count bins, resolution)`, where the
     * resolution renders with its hertz unit, such as `Coherence(8 bins, 2Hz)`.
     * The plan, the rate and the bin values are not included, so the rendering is
     * meant for logs and debugging rather than for machine parsing.
     *
     * @returns a description of the form `Coherence(count bins, resolution)`
     */
    public toString(): string {
        return `Coherence(${this.magnitudes.length} bins, ${this.getResolution()})`;
    }
}

/**
 * Tests whether a value is a `Coherence`.
 *
 * The check is re-exported from the shared guard so that the coherence brand
 * test sits next to the class it recognises. It inspects the `CoherenceSymbol`
 * property and accepts any object or function that advertises the brand, so a
 * value is not required to hold a valid plan or any bins; the shape and the
 * behaviour of the value are not validated.
 *
 * @param target - the value to inspect
 * @returns `true` if the value advertises the coherence brand
 */
export { isCoherence } from "#semantic/guard";
