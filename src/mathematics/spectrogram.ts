import { isIterable, isNumber } from "#semantic/guard";
import { Bin } from "#semantic/mathematics/bin";
import { Frame } from "#semantic/mathematics/frame";
import { Frequency } from "#semantic/mathematics/frequency";
import { Sample } from "#semantic/mathematics/sample";
import { Spectrum } from "#semantic/mathematics/spectrum";
import type { SpectralWindow } from "#semantic/mathematics/window";
import { isSpectralWindow, useRectangularWindow } from "#semantic/mathematics/window";
import { Optional } from "#semantic/optional";
import { SpectrogramSymbol } from "#semantic/symbol";

/**
 * How the analysed signal was extended beyond its first and last sample.
 *
 * `"zeros"` extends with zero samples, `"constant"` repeats the first and last
 * sample, and `"none"` does not extend at all. The extension is what lets the
 * first windowed segment be centred on the first input sample; when it is used,
 * the spectrogram stores the mode so that it can trim the extension during
 * overlap-add reconstruction.
 */
export type BoundaryExtension = "zeros" | "constant" | "none";

const BoundaryExtensions: ReadonlyArray<BoundaryExtension> = Object.freeze(["zeros", "constant", "none"]);

/**
 * A time-frequency view: one spectrum per analysis frame, with the hop that
 * separates consecutive frame starts.
 *
 * The frame size and the rate come from the columns, because every column keeps
 * the plan that produced it. Column `k` is centred at
 * `(k * hop + frameSize / 2) / rate` seconds when the signal was not extended,
 * and at `(k * hop + (frameSize mod 2) / 2) / rate` seconds when it was
 * extended, so the first extended frame is centred on the first input sample.
 * The whole view covers `(columns - 1) * hop / rate + frameSize / rate` seconds
 * when the signal was not extended; an extended view trims the extension from
 * both ends, so its duration is the retained sample count, which still includes
 * any zero padding that the transform added at the tail. The window and the
 * boundary mode are retained so the view can be inverted with the same taper and
 * the same trimming.
 *
 * A spectrogram is immutable: the column array is frozen, every column is a
 * spectrum, and a column outside the view is reported through an empty
 * `Optional` rather than by an exception.
 */
export class Spectrogram {

    /** The spectra, in frame-start order, frozen after construction. */
    private readonly columns: ReadonlyArray<Spectrum>;
    /** The number of samples between consecutive frame starts. */
    private readonly hopSize: number;
    /** The analysis window retained for the overlap-add inversion. */
    private readonly window: SpectralWindow;
    /** How the analysed signal was extended at its ends, for trimming. */
    private readonly boundary: BoundaryExtension;
    /** The registered spectrogram brand, read by the shared runtime guard. */
    protected readonly [SpectrogramSymbol]: symbol = SpectrogramSymbol;

    /**
     * Creates a spectrogram from a non-empty iterable of equally planned spectra.
     *
     * The columns are collected in iteration order, so column `k` is the spectrum
     * of the frame that covers samples `k * hopSize` through
     * `k * hopSize + frameSize - 1` of the signal as it was presented to the
     * transform, after any boundary extension. Every column must be a `Spectrum`,
     * and all columns must share one frame size and one frame rate, because a
     * single frame size and rate are derived from the first column. The hop size
     * is not checked against the frame size, so overlapping frames and gaps
     * between frames are both accepted. The window and the boundary mode are
     * stored as supplied and are not applied during construction: they matter only
     * to `toFrame`, which re-weights the overlap-added samples and trims the
     * extension. Validation finishes before any field is stored, so a rejected
     * argument leaves no partially constructed spectrogram behind, and the
     * collected array is frozen before it is retained.
     *
     * @param columns - the spectra of the analysis frames, in frame-start order
     * @param hopSize - the number of samples between consecutive frame starts, a
     *        positive integer
     * @param window - the analysis window retained for inversion; defaults to the
     *        rectangular window
     * @param boundary - how the signal was extended at its ends; defaults to
     *        `"none"`, which reproduces the unextended frame coordinates
     * @throws {TypeError} if the columns are not iterable, the hop size is not a
     *         positive integer, the window is not callable, the boundary mode is
     *         not one of the supported names, or a column is not a `Spectrum`
     * @throws {RangeError} if the columns do not share one frame size or one
     *         frame rate, or if the iterable yields no column
     */
    public constructor(columns: Iterable<Spectrum>, hopSize: number, window: SpectralWindow = useRectangularWindow, boundary: BoundaryExtension = "none") {
        if (!isIterable(columns)) {
            throw new TypeError("Spectrogram expects an iterable of spectra.");
        }
        if (!isNumber(hopSize) || !Number.isInteger(hopSize) || hopSize < 1) {
            throw new TypeError("Spectrogram hop size must be a positive integer.");
        }
        if (!isSpectralWindow(window)) {
            throw new TypeError("Spectrogram window must be a window function.");
        }
        if (typeof boundary !== "string" || !BoundaryExtensions.includes(boundary as BoundaryExtension)) {
            throw new TypeError("Spectrogram boundary must be zeros, constant or none.");
        }
        const collected: Array<Spectrum> = [];
        for (const column of columns) {
            if (!(column instanceof Spectrum)) {
                throw new TypeError("Spectrogram columns must be spectra.");
            }
            if (collected.length > 0) {
                if (column.size() !== collected[0].size()) {
                    throw new RangeError("Spectrogram columns must share one frame size.");
                }
                if (column.getRate() !== collected[0].getRate()) {
                    throw new RangeError("Spectrogram columns must share one frame rate.");
                }
            }
            collected.push(column);
        }
        if (collected.length < 1) {
            throw new RangeError("Spectrogram requires at least one column.");
        }
        this.columns = Object.freeze(collected);
        this.hopSize = hopSize;
        this.window = window;
        this.boundary = boundary;
    }

    /**
     * Returns the spectra of the analysis frames.
     *
     * The result is the frozen array retained by the constructor, not a copy, and
     * the spectra are in frame-start order: index `k` describes the frame that
     * begins at `k * hop / rate` seconds. The array is frozen, so a caller cannot
     * add, remove or replace a column, and every spectrum is itself immutable.
     *
     * @returns the frozen array of spectra, in frame-start order
     */
    public getColumns(): ReadonlyArray<Spectrum> {
        return this.columns;
    }

    /**
     * Returns the number of analysis frames.
     *
     * The count equals the number of retained spectra and is at least one, because
     * the constructor rejects an iterable that yields no column.
     *
     * @returns the number of frames, a positive integer
     */
    public size(): number {
        return this.columns.length;
    }

    /**
     * Returns whether this spectrogram holds no frames.
     *
     * The constructor requires at least one column, so a constructed spectrogram
     * always holds a frame and this is `false`. It remains part of the
     * collection-like surface for callers that forward the query.
     *
     * @returns `true` if this spectrogram holds no columns; `false` for every
     *         constructed spectrogram
     */
    public isEmpty(): boolean {
        return this.columns.length === 0;
    }

    /**
     * Returns the number of samples in one analysis frame.
     *
     * The size is read from the first column and equals the bin count of its
     * spectrum, which is the frame count of the sampling plan behind it. Every
     * column shares that size, so all frames cover the same number of samples, and
     * together with the hop and the rate it fixes the covered duration.
     *
     * @returns the frame size in samples, a positive integer
     */
    public getFrameSize(): number {
        return this.columns[0].size();
    }

    /**
     * Returns the number of samples between consecutive frame starts.
     *
     * The hop is the positive integer supplied to the constructor and is never
     * derived from the frame size, so consecutive frames overlap when it is
     * smaller than the frame size and leave a gap between frames when it is
     * larger.
     *
     * @returns the hop size in samples, a positive integer
     */
    public getHopSize(): number {
        return this.hopSize;
    }

    /**
     * Returns the frame rate of the source signal.
     *
     * The rate is read from the sampling plan retained by the first column and is
     * shared by every column, because the constructor rejects mixed rates. It is
     * measured in frames per second, where one frame is one sample of the source
     * signal, and is the rate that converts a frame index and a hop into seconds.
     *
     * @returns the frame rate in frames per second, positive and finite
     */
    public getRate(): number {
        return this.columns[0].getRate();
    }

    /**
     * Returns the analysis window retained for inversion.
     *
     * The window is the function supplied to the constructor, stored as supplied
     * and not applied while the spectrogram is built. `toFrame` evaluates it at
     * every position of every frame when it re-weights the overlap-added signal.
     * The window is not stored in the columns, so it has no effect on the spectra
     * that were already analysed.
     *
     * @returns the window function; the rectangular window unless one was
     *         supplied
     */
    public getWindow(): SpectralWindow {
        return this.window;
    }

    /**
     * Returns how the analysed signal was extended beyond its ends.
     *
     * The mode is the value supplied to the constructor and is not inferred from
     * the columns. `"none"` means the frames were taken from the signal exactly
     * as given, while `"zeros"` and `"constant"` mean the signal was extended by
     * `floor(frameSize / 2)` samples at each end before framing. `toFrame` trims
     * that extension, and `getTime` reports frame centres on the original time
     * axis.
     *
     * @returns the retained boundary extension mode
     */
    public getBoundary(): BoundaryExtension {
        return this.boundary;
    }

    /**
     * Returns the centre time of one analysis frame.
     *
     * For an unextended view the centre is `(index * hopSize + frameSize / 2) /
     * rate` seconds from the start of the signal, so the first frame is centred
     * half a frame into the signal. When the signal was extended at its ends, the
     * extension shifts the frames back, and the centre is `(index * hopSize +
     * (frameSize mod 2) / 2) / rate` seconds on the original time axis: the first
     * frame is centred on the first input sample and consecutive centres are one
     * hop apart. Unlike `at`, this method does not report an index outside the
     * frame count through an empty value, so the index must lie inside the view.
     *
     * @param index - the zero-based frame index
     * @returns the centre time of that frame in seconds
     * @throws {TypeError} if the index is not a finite integer
     * @throws {RangeError} if the index is negative or at least the frame count
     */
    public getTime(index: number): number {
        if (!isNumber(index) || !Number.isInteger(index)) {
            throw new TypeError("Spectrogram frame index must be a finite integer.");
        }
        if (index < 0 || index >= this.columns.length) {
            throw new RangeError("Spectrogram frame index must be within the frame count.");
        }
        const offset: number = this.boundary === "none" ? this.getFrameSize() / 2 : (this.getFrameSize() % 2) / 2;
        return (index * this.hopSize + offset) / this.getRate();
    }

    /**
     * Returns the covered duration in seconds.
     *
     * An unextended view runs from the start of the first frame to the end of the
     * last one, that is `(columns - 1) * hop / rate + frameSize / rate` seconds,
     * and counts the whole last frame. An extended view trims the
     * `floor(frameSize / 2)` extension samples from both ends, because they
     * correspond to padding rather than to the original signal; its duration is
     * therefore `((columns - 1) * hop + frameSize - 2 * floor(frameSize / 2)) /
     * rate`, which equals the duration of the frame returned by `toFrame`.
     * Zero padding that the transform added at the tail is not distinguishable
     * from source samples here and remains included.
     *
     * @returns the covered duration in seconds, positive and finite for a view
     *          that retains at least one sample
     */
    public getDuration(): number {
        const length: number = (this.columns.length - 1) * this.hopSize + this.getFrameSize();
        const extension: number = this.boundary === "none" ? 0 : 2 * Math.floor(this.getFrameSize() / 2);
        return (length - extension) / this.getRate();
    }

    /**
     * Returns the spectrum of one analysis frame.
     *
     * The index is validated as a finite integer but need not lie inside the view:
     * a negative index or one at or beyond `size()` yields an empty `Optional`
     * rather than an exception, so probing a range needs no caller-side bounds
     * check.
     *
     * @param index - the zero-based frame index
     * @returns the spectrum of that frame in an `Optional`, or an empty `Optional`
     *         outside the view
     * @throws {TypeError} if the index is not a finite integer
     */
    public at(index: number): Optional<Spectrum> {
        if (!isNumber(index) || !Number.isInteger(index)) {
            throw new TypeError("Spectrogram frame index must be a finite integer.");
        }
        return index < 0 || index >= this.columns.length ? Optional.empty() : Optional.of(this.columns[index]);
    }

    /**
     * Returns one bin of one analysis frame.
     *
     * The frame index is validated and then bounds-checked against the view: a
     * frame outside it yields an empty `Optional` before the bin index is
     * examined. A frame inside the view forwards the bin index to `binAt` of its
     * spectrum, which validates it and also reports a bin outside that spectrum
     * through an empty `Optional`, so neither index needs a caller-side bounds
     * check.
     *
     * @param frameIndex - the zero-based frame index
     * @param binIndex - the zero-based bin index within that frame
     * @returns the bin in an `Optional`, or an empty `Optional` if either index is
     *         outside its range
     * @throws {TypeError} if the frame index is not a finite integer, or if the
     *         bin index of an in-range frame is not a finite integer
     */
    public binAt(frameIndex: number, binIndex: number): Optional<Bin> {
        if (!isNumber(frameIndex) || !Number.isInteger(frameIndex)) {
            throw new TypeError("Spectrogram frame index must be a finite integer.");
        }
        if (frameIndex < 0 || frameIndex >= this.columns.length) {
            return Optional.empty();
        }
        return this.columns[frameIndex].binAt(binIndex);
    }

    /**
     * Returns the magnitude of one bin of one analysis frame.
     *
     * The magnitude is the Euclidean norm of the complex amplitude of that bin, so
     * it is never negative and a silent component reports zero. No normalisation
     * is applied: the value is the raw coefficient magnitude of the frame's
     * spectrum. The lookup follows `binAt`, so an index outside the frame or the
     * bin count yields an empty `Optional` instead of an exception.
     *
     * @param frameIndex - the zero-based frame index
     * @param binIndex - the zero-based bin index within that frame
     * @returns the magnitude in an `Optional`, or an empty `Optional` if either
     *         index is outside its range
     * @throws {TypeError} if the frame index is not a finite integer, or if the
     *         bin index of an in-range frame is not a finite integer
     */
    public magnitudeAt(frameIndex: number, binIndex: number): Optional<number> {
        return this.binAt(frameIndex, binIndex).map((bin: Bin): number => bin.magnitude());
    }

    /**
     * Returns the peak frequency of one analysis frame.
     *
     * The frequency is the one carried by the dominant bin of that frame's
     * spectrum, that is the bin with the largest magnitude; when several bins
     * share the largest magnitude, the lowest frequency wins. The lookup follows
     * `at`, so a frame index outside the view yields an empty `Optional`.
     *
     * @param frameIndex - the zero-based frame index
     * @returns the peak frequency in an `Optional`, or an empty `Optional` outside
     *         the view
     * @throws {TypeError} if the frame index is not a finite integer
     */
    public dominantFrequencyAt(frameIndex: number): Optional<Frequency> {
        return this.at(frameIndex).flatMap((spectrum: Spectrum): Optional<Frequency> => spectrum.peakFrequency());
    }

    /**
     * Returns the spectral centroid of one analysis frame.
     *
     * The centroid is the magnitude-weighted mean of the bin frequencies, taken
     * over the one-sided bins so that the conjugate half is not counted twice, so
     * it follows the centre of the spectral mass rather than the largest peak. A
     * frame whose bins all have magnitude zero has no centroid, and a frame index
     * outside the view has no frame, so both cases yield an empty `Optional`.
     *
     * @param frameIndex - the zero-based frame index
     * @returns the centroid frequency in an `Optional`, or an empty `Optional`
     *         outside the view or for a silent frame
     * @throws {TypeError} if the frame index is not a finite integer
     */
    public spectralCentroidAt(frameIndex: number): Optional<Frequency> {
        return this.at(frameIndex).flatMap((spectrum: Spectrum): Optional<Frequency> => spectrum.centroid());
    }

    /**
     * Returns the magnitudes of every bin as a row-per-frame matrix.
     *
     * The outer array holds one entry per frame, in frame-start order, and each
     * inner array holds one entry per bin of that frame, in increasing frequency
     * order, so entry `[frame][bin]` is the magnitude returned by `magnitudeAt`
     * for that frame and bin. Frequencies are not included; callers that need
     * them can pair the matrix with the bin frequencies of a column. The rows and
     * their entries are freshly allocated on every call and are not frozen, so
     * mutating them does not affect the spectrogram.
     *
     * @returns a new array of rows, one per frame, in frame-start order
     */
    public magnitudeMatrix(): Array<Array<number>> {
        return this.columns.map((spectrum: Spectrum): Array<number> =>
            spectrum.getBins().map((bin: Bin): number => bin.magnitude()));
    }

    /**
     * Reconstructs the analysed signal by weighted overlap-add.
     *
     * Every column is inverted, weighted by the analysis window and accumulated
     * at its start offset; the sum is then divided by the accumulated squared
     * window, which is exact wherever the frames overlap at least once. A sample
     * covered by no frame, or covered only by zero weights, stays zero.
     *
     * When the signal was extended at its ends, the `floor(frameSize / 2)`
     * extension samples are trimmed from both sides of the accumulated result,
     * so the returned frame covers the original signal plus any zero padding that
     * the transform added at the tail, without the boundary extension; an
     * unextended view is returned whole. A frame that covered fewer than one
     * retained sample cannot be represented and is rejected. The retained window
     * is evaluated once per position of every frame during this call, so a window
     * with side effects runs `size() * frameSize` times.
     *
     * @returns a new frame at the source rate, covering the view's retained
     *         duration
     * @throws {RangeError} if the retained window returns a non-finite weight, or
     *         if trimming the boundary extension leaves no sample
     */
    public toFrame(): Frame {
        const frameSize: number = this.getFrameSize();
        const length: number = (this.columns.length - 1) * this.hopSize + frameSize;
        const total: Array<number> = new Array<number>(length).fill(0);
        const weight: Array<number> = new Array<number>(length).fill(0);
        for (let column: number = 0; column < this.columns.length; column += 1) {
            const samples: Array<number> = this.columns[column].toFrames();
            const offset: number = column * this.hopSize;
            for (let index: number = 0; index < frameSize; index += 1) {
                const taper: number = this.window(index, frameSize);
                if (!isNumber(taper)) {
                    throw new RangeError("Spectrogram window must return finite weights.");
                }
                total[offset + index] += samples[index] * taper;
                weight[offset + index] += taper * taper;
            }
        }
        const extension: number = this.boundary === "none" ? 0 : Math.floor(frameSize / 2);
        const covered: number = length - 2 * extension;
        if (covered < 1) {
            throw new RangeError("Spectrogram boundary trimming must retain at least one sample.");
        }
        const values: Array<number> = [];
        for (let index: number = extension; index < extension + covered; index += 1) {
            values.push(weight[index] > 0 ? total[index] / weight[index] : 0);
        }
        return new Frame(new Sample(covered, covered / this.getRate()), values);
    }

    /**
     * Renders the frame count, the frame size and the hop size.
     *
     * The text has the form `Spectrogram(12 frames, 256 samples, hop 128)` and
     * describes the geometry of the view only; the window and the frame rate are
     * omitted.
     *
     * @returns a description of the form `Spectrogram(frames, samples, hop)`
     */
    public toString(): string {
        return `Spectrogram(${this.columns.length} frames, ${this.getFrameSize()} samples, hop ${this.hopSize})`;
    }
}

/**
 * Tests whether a value advertises the Spectrogram brand.
 *
 * The test is the shared runtime guard: a non-null object or function passes when
 * it exposes a symbol value under the registered spectrogram symbol, which every
 * constructed `Spectrogram` does through its protected brand field. Only the brand
 * is inspected, so methods, columns and the hop size are not validated and a
 * value that merely mimics the brand is reported as a spectrogram.
 *
 * @param target - the value to inspect
 * @returns whether the value advertises the Spectrogram brand
 */
export { isSpectrogram } from "#semantic/guard";
