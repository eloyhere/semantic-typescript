import { isNumber } from "#semantic/guard";
import { Angle } from "#semantic/mathematics/angle";
import { Bin, decibel, normalized, parabolicOffset } from "#semantic/mathematics/bin";
import type { Normalization } from "#semantic/mathematics/bin";
import { Complex } from "#semantic/mathematics/complex";
import { Frame } from "#semantic/mathematics/frame";
import { Frequency } from "#semantic/mathematics/frequency";
import { Sample } from "#semantic/mathematics/sample";
import { inverseFastFourierTransform } from "#semantic/mathematics/spectral";
import { Optional } from "#semantic/optional";
import { SpectrumSymbol } from "#semantic/symbol";

/**
 * A discrete frequency-domain view produced by a transform over a sampling plan.
 *
 * Bins are ordered by increasing frequency and start at zero hertz, so the bin
 * at index `k` denotes `k * rate / count`. A real input keeps the full complex
 * spectrum, including the conjugate-symmetric upper half; callers that want a
 * one-sided magnitude view can use `oneSided`. The plan is retained so that a
 * bin can be converted back into a frequency without extra arguments.
 *
 * A spectrum is immutable: the constructor freezes the bin array, every bin is
 * an immutable `Bin`, and the amplitude count must match the frame count of the
 * plan, so `size` always equals the count of the retained plan. A bin outside
 * the spectrum is reported through an empty `Optional` rather than by an
 * exception.
 */
export class Spectrum {

    /**
     * The sampling plan that produced this spectrum.
     *
     * Its frame count equals the number of bins and its rate fixes the spacing
     * between adjacent bins.
     */
    private readonly plan: Sample;
    /**
     * The bins, in increasing frequency order and frozen after construction.
     */
    private readonly bins: ReadonlyArray<Bin>;
    /**
     * The registered spectrum brand, read by the shared runtime guard.
     */
    protected readonly [SpectrumSymbol]: symbol = SpectrumSymbol;

    /**
     * Creates a spectrum from a plan and one complex amplitude per frame.
     *
     * Each amplitude becomes a bin, in the iteration order of the argument, and
     * its frequency follows from the position of the amplitude, so the caller
     * supplies amplitudes only. Amplitudes are validated one by one before the
     * plan and the bins are stored, so a rejected amplitude leaves no partial
     * spectrum behind.
     *
     * @param plan - the sampling plan that produced the amplitudes
     * @param amplitudes - the complex amplitudes, one per frame of the plan
     * @throws {TypeError} if the plan is not a `Sample` or an amplitude is not a
     *         `Complex`
     * @throws {RangeError} if the amplitudes do not match the frame count
     */
    public constructor(plan: Sample, amplitudes: Iterable<Complex>) {
        if (!(plan instanceof Sample)) {
            throw new TypeError("Spectrum plan must be a Sample.");
        }
        const collected: Array<Bin> = [];
        for (const amplitude of amplitudes) {
            if (!(amplitude instanceof Complex)) {
                throw new TypeError("Spectrum amplitudes must be Complex values.");
            }
            collected.push(new Bin(new Frequency(collected.length * plan.getRate() / plan.getCount()), amplitude));
        }
        if (collected.length !== plan.getCount()) {
            throw new RangeError("Spectrum amplitude count must match the frame count of its plan.");
        }
        this.plan = plan;
        this.bins = Object.freeze(collected);
    }

    /**
     * Returns the sampling plan that produced this spectrum.
     *
     * @returns the retained plan, not a copy
     */
    public getSample(): Sample {
        return this.plan;
    }

    /**
     * Returns the frozen bin array of this spectrum.
     *
     * @returns the stored bins, in increasing frequency order
     */
    public getBins(): ReadonlyArray<Bin> {
        return this.bins;
    }

    /**
     * Returns the number of bins.
     *
     * The count equals the frame count of the retained plan, which is at least one
     * because a plan covers at least one frame.
     *
     * @returns the number of bins
     */
    public size(): number {
        return this.bins.length;
    }

    /**
     * Returns whether this spectrum has no bins.
     *
     * A constructed spectrum always holds at least one bin, because a sampling
     * plan covers at least one frame, so this is `false` for every valid spectrum.
     * It remains part of the collection-like surface for callers that forward the
     * query.
     *
     * @returns `true` if this spectrum holds no bins
     */
    public isEmpty(): boolean {
        return this.bins.length === 0;
    }

    /**
     * Returns the frame rate of the source plan.
     *
     * @returns the frame rate in frames per second
     */
    public getRate(): number {
        return this.plan.getRate();
    }

    /**
     * Returns the frequency spacing between adjacent bins.
     *
     * The spacing is the frame rate divided by the frame count, so it is also the
     * frequency of bin one and the finest frequency difference this spectrum can
     * resolve.
     *
     * @returns the bin spacing in hertz
     */
    public getResolution(): Frequency {
        return new Frequency(this.plan.getRate() / this.plan.getCount());
    }

    /**
     * Returns the bin at the specified index.
     *
     * The index must be a finite integer, but it need not lie inside the spectrum:
     * a negative index or one at or beyond the size yields an empty `Optional`
     * rather than an exception, so probing a range needs no bounds check of its
     * own.
     *
     * @param index - the zero-based bin index
     * @returns the bin in an `Optional`, or an empty `Optional` outside the
     *         spectrum
     * @throws {TypeError} if the index is not a finite integer
     */
    public binAt(index: number): Optional<Bin> {
        if (!isNumber(index) || !Number.isInteger(index)) {
            throw new TypeError("Spectrum index must be a finite integer.");
        }
        return index < 0 || index >= this.bins.length ? Optional.empty() : Optional.of(this.bins[index]);
    }

    /**
     * Returns the frequency of the bin at the specified index.
     *
     * The index follows the boundary behaviour of `binAt`, so an index outside
     * the spectrum yields an empty `Optional` instead of an exception.
     *
     * @param index - the zero-based bin index
     * @returns the bin frequency in an `Optional`, or an empty `Optional` outside
     *         the spectrum
     * @throws {TypeError} if the index is not a finite integer
     */
    public frequencyAt(index: number): Optional<Frequency> {
        return this.binAt(index).map(bin => bin.frequency);
    }

    /**
     * Returns the complex amplitude of the bin at the specified index.
     *
     * The amplitude keeps both components, so the magnitude and the phase can be
     * taken from one value. An index outside the spectrum yields an empty
     * `Optional`.
     *
     * @param index - the zero-based bin index
     * @returns the complex amplitude in an `Optional`, or an empty `Optional`
     *         outside the spectrum
     * @throws {TypeError} if the index is not a finite integer
     */
    public amplitudeAt(index: number): Optional<Complex> {
        return this.binAt(index).map(bin => bin.amplitude);
    }

    /**
     * Returns the magnitude of the bin at the specified index.
     *
     * The magnitude is the Euclidean norm of the complex amplitude, so it is never
     * negative and a silent component has magnitude zero. An index outside the
     * spectrum yields an empty `Optional`.
     *
     * @param index - the zero-based bin index
     * @returns the magnitude in an `Optional`, or an empty `Optional` outside the
     *         spectrum
     * @throws {TypeError} if the index is not a finite integer
     */
    public magnitudeAt(index: number): Optional<number> {
        return this.binAt(index).map(bin => bin.amplitude.magnitude());
    }

    /**
     * Returns the phase of the bin at the specified index.
     *
     * The phase is the argument of the complex amplitude, measured
     * counter-clockwise from the positive real axis and normalised into one full
     * turn, so the value lies in the half-open interval from zero to one turn. An
     * index outside the spectrum yields an empty `Optional`.
     *
     * @param index - the zero-based bin index
     * @returns the phase in an `Optional`, or an empty `Optional` outside the
     *         spectrum
     * @throws {TypeError} if the index is not a finite integer
     */
    public phaseAt(index: number): Optional<Angle> {
        return this.binAt(index).map(bin => bin.amplitude.argument());
    }

    /**
     * Returns the bin with the largest magnitude.
     *
     * Bins are scanned in increasing frequency order and a candidate replaces the
     * current best only when its magnitude is strictly larger, so the first of
     * several equal peaks wins. Magnitudes are compared directly, which means the
     * conjugate-symmetric upper half can compete with the lower half.
     *
     * @returns the dominant bin in an `Optional`, or an empty `Optional` if this
     *         spectrum has no bins
     */
    public dominant(): Optional<Bin> {
        let best: Bin | undefined;
        let magnitude: number = Number.NEGATIVE_INFINITY;
        for (const bin of this.bins) {
            const current: number = bin.amplitude.magnitude();
            if (current > magnitude) {
                best = bin;
                magnitude = current;
            }
        }
        return Optional.ofNullable(best);
    }

    /**
     * Returns the frequency of the dominant bin.
     *
     * The peak follows the tie behaviour of `dominant`, so the lowest frequency
     * wins among equal magnitudes.
     *
     * @returns the peak frequency in an `Optional`, or an empty `Optional` if this
     *         spectrum has no bins
     */
    public peakFrequency(): Optional<Frequency> {
        return this.dominant().map(bin => bin.frequency);
    }

    /**
     * Returns the Nyquist frequency of the retained plan.
     *
     * The Nyquist frequency is half the frame rate, that is, the highest
     * frequency the plan can represent without aliasing. It is derived from the
     * plan on every call rather than stored, so it does not depend on how many
     * bins this spectrum retains: an even bin count places one bin exactly on the
     * Nyquist frequency, while an odd count places none. Reading it has no side
     * effects.
     *
     * @returns the Nyquist frequency in hertz, half the rate of the plan
     */
    public getNyquist(): Frequency {
        return new Frequency(this.plan.getRate() / 2);
    }

    /**
     * Returns the one-sided bins of this spectrum.
     *
     * A real frame keeps a conjugate-symmetric pair for every component, so the
     * upper half repeats the lower half. Slicing to the first half and doubling
     * every non-edge amplitude folds that pair into one bin, except for the
     * constant bin and the Nyquist bin, which have no mirror partner. The
     * returned bins keep their raw amplitudes; normalisation is a separate step.
     *
     * @returns the bins from zero hertz through the top of the lower half; an
     *         even bin count includes the Nyquist bin, while an odd count ends
     *         just below it
     */
    public oneSided(): Array<Bin> {
        const last: number = Math.floor(this.bins.length / 2);
        const even: boolean = this.bins.length % 2 === 0;
        const output: Array<Bin> = [];
        for (let index: number = 0; index <= last; index += 1) {
            const bin: Bin = this.bins[index];
            const edge: boolean = index === 0 || (even && index === last);
            output.push(edge ? bin : bin.withAmplitude(bin.amplitude.multiply(2)));
        }
        return output;
    }

    /**
     * Returns the complex amplitude of a bin after a normalisation.
     *
     * A raw transform coefficient is unnormalised, so its magnitude grows with
     * the frame count; the `normalization` argument rescales it without changing
     * its phase. `none` keeps the raw coefficient, `count` divides it by the bin
     * count and `root` divides it by the square root of the bin count, which is
     * also the frame count of the retained plan. An amplitude is dimensionless,
     * because a transform coefficient carries no physical unit of its own.
     *
     * The index must be a finite integer but need not lie inside the spectrum: a
     * negative index or one at or beyond the size yields an empty `Optional`
     * rather than an exception, and the normalisation is then not consulted.
     *
     * @param index - the zero-based bin index
     * @param normalization - the scaling to apply, one of `none`, `count` or
     *        `root`, and `none` by default
     * @returns the scaled amplitude in an `Optional`, or an empty `Optional`
     *         outside the spectrum
     * @throws {TypeError} if the index is not a finite integer, or if an
     *         in-range bin is requested with an unsupported normalisation name
     */
    public amplitudeOf(index: number, normalization: Normalization = "none"): Optional<Complex> {
        return this.binAt(index).map((bin: Bin): Complex => normalized(bin.amplitude, normalization, this.bins.length));
    }

    /**
     * Returns the magnitude of a bin after a normalisation.
     *
     * The magnitude is the Euclidean norm of the normalised complex amplitude,
     * so it is never negative and a silent bin reports zero. Normalisation
     * scales the magnitude only: `count` divides it by the bin count and `root`
     * by the square root of the bin count, while `none` keeps the raw value. The
     * magnitude is dimensionless and does not depend on the phase of the bin.
     *
     * The index follows the boundary behaviour of `binAt`, so an index outside
     * the spectrum yields an empty `Optional` without consulting the
     * normalisation.
     *
     * @param index - the zero-based bin index
     * @param normalization - the scaling applied to the amplitude before the norm
     *        is taken, and `none` by default
     * @returns the non-negative magnitude in an `Optional`, or an empty
     *         `Optional` outside the spectrum
     * @throws {TypeError} if the index is not a finite integer, or if an
     *         in-range bin is requested with an unsupported normalisation name
     */
    public magnitudeOf(index: number, normalization: Normalization = "none"): Optional<number> {
        return this.amplitudeOf(index, normalization).map((amplitude: Complex): number => amplitude.magnitude());
    }

    /**
     * Returns the power of a bin after a normalisation.
     *
     * The power is the squared magnitude of the normalised amplitude, so it is
     * never negative and a silent bin reports zero. Because the magnitude is
     * squared, a `count` normalisation divides the power by the squared bin
     * count and a `root` normalisation by the bin count itself, while `none`
     * keeps the raw power. The power is dimensionless.
     *
     * The index follows the boundary behaviour of `binAt`, so an index outside
     * the spectrum yields an empty `Optional` without consulting the
     * normalisation.
     *
     * @param index - the zero-based bin index
     * @param normalization - the scaling applied to the amplitude before it is
     *        squared, and `none` by default
     * @returns the non-negative power in an `Optional`, or an empty `Optional`
     *         outside the spectrum
     * @throws {TypeError} if the index is not a finite integer, or if an
     *         in-range bin is requested with an unsupported normalisation name
     */
    public powerOf(index: number, normalization: Normalization = "none"): Optional<number> {
        return this.magnitudeOf(index, normalization).map((magnitude: number): number => magnitude * magnitude);
    }

    /**
     * Returns the level of a bin in decibels after a normalisation.
     *
     * The level is `20 * log10(magnitude / reference)`, where the magnitude is
     * the one `magnitudeOf` reports for the same index and normalisation. A
     * magnitude equal to the reference reports zero decibels, a magnitude of one
     * tenth of the reference reports minus twenty, and a silent bin reports
     * negative infinity because silence is a normal measurement rather than an
     * error. Both the magnitude and the reference are dimensionless, so any
     * positive finite value can mark the zero-decibel point.
     *
     * The index follows the boundary behaviour of `binAt`, so an index outside
     * the spectrum yields an empty `Optional`; the normalisation and the
     * reference are then not consulted.
     *
     * @param index - the zero-based bin index
     * @param normalization - the scaling applied to the amplitude before the
     *        level is taken, and `none` by default
     * @param reference - the positive, finite magnitude that maps to zero
     *        decibels, and `1` by default
     * @returns the level in decibels in an `Optional`, or an empty `Optional`
     *         outside the spectrum
     * @throws {TypeError} if the index is not a finite integer, if an in-range
     *         bin is requested with an unsupported normalisation name, or if
     *         the reference is not a finite number
     * @throws {RangeError} if an in-range bin is requested with a reference
     *         that is not positive
     */
    public decibelOf(index: number, normalization: Normalization = "none", reference: number = 1): Optional<number> {
        return this.magnitudeOf(index, normalization).map((magnitude: number): number => decibel(magnitude, reference));
    }

    /**
     * Returns the dominant frequency refined by parabolic interpolation.
     *
     * The peak bin and its two neighbours fit a parabola, so a component that
     * falls between bins reports a fractional frequency instead of snapping to
     * the nearest bin. Edges fall back to the peak bin itself, and a flat
     * neighbourhood reports the unrefined frequency.
     *
     * @returns the refined peak frequency in an `Optional`, empty only when this
     *         spectrum holds no bins
     */
    public refinedPeakFrequency(): Optional<Frequency> {
        if (this.bins.length === 0) {
            return Optional.empty();
        }
        let position: number = 0;
        let best: number = Number.NEGATIVE_INFINITY;
        for (let index: number = 0; index < this.bins.length; index += 1) {
            const magnitude: number = this.bins[index].magnitude();
            if (magnitude > best) {
                best = magnitude;
                position = index;
            }
        }
        const center: number = this.bins[position].magnitude();
        const left: number = position > 0 ? this.bins[position - 1].magnitude() : center;
        const right: number = position + 1 < this.bins.length ? this.bins[position + 1].magnitude() : center;
        const offset: number = parabolicOffset(left, center, right);
        return Optional.of(new Frequency((position + offset) * this.plan.getRate() / this.plan.getCount()));
    }

    /**
     * Returns the magnitude-weighted mean frequency.
     *
     * The centroid weights every frequency by its magnitude, so it follows the
     * centre of the spectral mass rather than its largest peak. The conjugate
     * half is folded into one-sided bins first, so a real sinusoid reports its
     * own frequency instead of the midpoint of the full spectrum. A silent
     * spectrum has no centroid and yields an empty `Optional`.
     *
     * @returns the centroid frequency in an `Optional`
     */
    public centroid(): Optional<Frequency> {
        const bins: ReadonlyArray<Bin> = this.oneSided();
        let weighted: number = 0;
        let total: number = 0;
        for (const bin of bins) {
            const magnitude: number = bin.magnitude();
            weighted += bin.frequency.getHertz() * magnitude;
            total += magnitude;
        }
        return total === 0 ? Optional.empty() : Optional.of(new Frequency(weighted / total));
    }

    /**
     * Returns the magnitude-weighted standard deviation around the centroid.
     *
     * The spread is the square root of the magnitude-weighted mean squared
     * distance between the one-sided bin frequencies and `centroid`, so it
     * reports how widely the spectral mass is distributed around its centre. It
     * is measured in hertz, is never negative, and is zero when all of the mass
     * sits on the centroid frequency. The conjugate half is folded into
     * one-sided bins first, matching the centroid, so the upper half is not
     * counted twice.
     *
     * A silent spectrum has no centre and therefore no spread, so it yields an
     * empty `Optional`; computing the spread has no side effects.
     *
     * @returns the spread in hertz in an `Optional`, or an empty `Optional` for
     *         a silent spectrum
     */
    public spread(): Optional<Frequency> {
        const centroid: Optional<Frequency> = this.centroid();
        if (centroid.isEmpty()) {
            return Optional.empty();
        }
        const center: number = centroid.get().getHertz();
        const bins: ReadonlyArray<Bin> = this.oneSided();
        let weighted: number = 0;
        let total: number = 0;
        for (const bin of bins) {
            const magnitude: number = bin.magnitude();
            const delta: number = bin.frequency.getHertz() - center;
            weighted += magnitude * delta * delta;
            total += magnitude;
        }
        return total === 0 ? Optional.empty() : Optional.of(new Frequency(Math.sqrt(weighted / total)));
    }

    /**
     * Returns the spectral flatness of this spectrum.
     *
     * Flatness is the ratio of the geometric mean to the arithmetic mean of the
     * bin magnitudes, which compares how evenly the magnitude is spread across
     * frequency. A flat, noise-like spectrum approaches one and a tonal
     * spectrum, whose magnitude concentrates in one bin, approaches zero. Every
     * retained bin participates, including the conjugate-symmetric upper half,
     * and the phase of each coefficient is ignored.
     *
     * The geometric mean is undefined once a magnitude is zero, so any silent
     * bin makes the whole result zero. The value has no unit, and computing it
     * has no side effects.
     *
     * @returns the flatness ratio, approaching one for a flat spectrum and
     *         falling to zero for a tonal or silent one
     */
    public flatness(): number {
        let arithmetic: number = 0;
        let logarithmic: number = 0;
        for (const bin of this.bins) {
            const magnitude: number = bin.magnitude();
            if (magnitude === 0) {
                return 0;
            }
            arithmetic += magnitude;
            logarithmic += Math.log(magnitude);
        }
        if (arithmetic === 0) {
            return 0;
        }
        return Math.exp(logarithmic / this.bins.length) / (arithmetic / this.bins.length);
    }

    /**
     * Returns the frequency below which a ratio of the total magnitude lies.
     *
     * The cumulative magnitude is accumulated over the one-sided bins, so the
     * conjugate half is not counted twice, and the first bin that reaches the
     * requested fraction is returned. A silent spectrum has no rolloff and
     * yields an empty `Optional`.
     *
     * @param ratio - the fraction of the total magnitude, within `(0, 1]`
     * @returns the rolloff frequency in an `Optional`
     * @throws {TypeError} if the ratio is not a finite number
     * @throws {RangeError} if the ratio is not within `(0, 1]`
     */
    public rolloff(ratio: number = 0.85): Optional<Frequency> {
        if (!isNumber(ratio)) {
            throw new TypeError("Spectrum rolloff ratio must be a finite number.");
        }
        if (ratio <= 0 || ratio > 1) {
            throw new RangeError("Spectrum rolloff ratio must be within (0, 1].");
        }
        let total: number = 0;
        const bins: ReadonlyArray<Bin> = this.oneSided();
        for (const bin of bins) {
            total += bin.magnitude();
        }
        if (total === 0) {
            return Optional.empty();
        }
        const threshold: number = total * ratio;
        let cumulative: number = 0;
        for (const bin of bins) {
            cumulative += bin.magnitude();
            if (cumulative >= threshold) {
                return Optional.of(bin.frequency);
            }
        }
        return Optional.of(bins[bins.length - 1].frequency);
    }

    /**
     * Returns the summed power of the bins within a half-open frequency band.
     *
     * Every bin whose frequency lies in `[low, high)` contributes its power,
     * that is, the squared magnitude of its raw amplitude, and the contributions
     * are added in increasing frequency order. A bin exactly on `low` is counted
     * and a bin exactly on `high` is not, so equal bounds describe an empty band
     * and report zero; a band that contains no bin also reports zero. The bounds
     * are compared with the exact bin frequencies and no interpolation is
     * performed, so a band whose bounds fall between two bins still measures
     * whole bins.
     *
     * No normalisation is applied, so the value is a raw, unnormalised power;
     * for a transform-derived spectrum it scales with the number of frames. It
     * is dimensionless, and computing the band energy has no side effects.
     *
     * @param low - the inclusive lower bound of the band in hertz
     * @param high - the exclusive upper bound of the band in hertz
     * @returns the summed power within the band, zero for an empty band
     * @throws {TypeError} if either bound is not a `Frequency`
     * @throws {RangeError} if `high` lies below `low` in hertz
     */
    public bandEnergy(low: Frequency, high: Frequency): number {
        if (!(low instanceof Frequency) || !(high instanceof Frequency)) {
            throw new TypeError("Spectrum band bounds must be frequencies.");
        }
        if (high.getHertz() < low.getHertz()) {
            throw new RangeError("Spectrum band end must not precede its start.");
        }
        let total: number = 0;
        for (const bin of this.bins) {
            const hertz: number = bin.frequency.getHertz();
            if (hertz >= low.getHertz() && hertz < high.getHertz()) {
                total += bin.power();
            }
        }
        return total;
    }

    /**
     * Reconstructs the real samples of this spectrum with the inverse transform.
     *
     * Every retained amplitude is passed, in bin order, to the inverse fast
     * Fourier transform, and the real component of each resulting complex sample
     * is kept. The output therefore holds one sample per bin, in sample order,
     * and has the same length as the plan. Because the full complex spectrum is
     * retained, including the conjugate-symmetric upper half of a real input,
     * the reconstruction covers the whole frame; discarding the imaginary
     * components loses nothing for real input, where they stay near zero.
     *
     * The array is newly allocated, so a caller may modify it without affecting
     * this spectrum, and the reconstruction has no side effects.
     *
     * @returns a new array of the reconstructed real samples, one per frame of
     *         the retained plan
     */
    public toFrames(): Array<number> {
        return inverseFastFourierTransform(this.bins.map((bin: Bin): Complex => bin.amplitude))
            .map((value: Complex): number => value.getReal());
    }

    /**
     * Reconstructs the analysed frame with the inverse transform.
     *
     * The retained plan is reused unchanged, so the returned frame covers the
     * same rate, frame times and duration as the data the spectrum was produced
     * from, and its samples are the real samples of `toFrames`. The frame is a
     * new immutable value; this spectrum is not modified, and the only state
     * shared is the immutable plan.
     *
     * @returns a new frame holding the reconstructed samples and the retained
     *         plan
     */
    public toFrame(): Frame {
        return new Frame(this.plan, this.toFrames());
    }

    /**
     * Returns a copy of the bins in increasing frequency order.
     *
     * The result is a shallow copy, so adding or removing entries does not affect
     * this spectrum; the bins themselves are frozen and shared between both
     * arrays.
     *
     * @returns a new array of the bins
     */
    public toArray(): Array<Bin> {
        return this.bins.slice();
    }

    /**
     * Compares the plan and every bin within a tolerance.
     *
     * The plans must be equal, which fixes the count and the spacing, and the
     * sizes must match before any bin is compared. Frequencies and amplitudes are
     * then compared bin by bin with the same tolerance, so two spectra from
     * different but equivalent transforms agree within rounding. An operand that
     * is not a spectrum is rejected rather than reported as unequal.
     *
     * @param other - the spectrum to compare with this one
     * @param epsilon - the absolute tolerance applied to bins; defaults to `1E-9`
     * @returns `true` if the plans and all bins agree within the tolerance
     * @throws {TypeError} if the operand is not a `Spectrum` or the tolerance is
     *         not a finite number
     */
    public equals(other: Spectrum, epsilon: number = 1E-9): boolean {
        if (!(other instanceof Spectrum)) {
            throw new TypeError("Spectrum operand must be a Spectrum.");
        }
        if (!isNumber(epsilon)) {
            throw new TypeError("Spectrum epsilon must be a finite number.");
        }
        if (!this.plan.equals(other.plan) || this.bins.length !== other.bins.length) {
            return false;
        }
        return this.bins.every((bin: Bin, index: number): boolean =>
            bin.frequency.equals(other.bins[index].frequency, epsilon)
            && bin.amplitude.equals(other.bins[index].amplitude, epsilon));
    }

    /**
     * Renders the bin count and the bin spacing of this spectrum.
     *
     * The plan is described only through the spacing it implies, because the
     * spacing already fixes the rate and the count for a reader who knows the
     * plan.
     *
     * @returns a description of the form `Spectrum(count bins, resolution)`
     */
    public toString(): string {
        return `Spectrum(${this.bins.length} bins, ${this.getResolution()})`;
    }
}

/**
 * Tests whether a value is a `Spectrum`.
 *
 * The check is re-exported from the shared guard so that the spectrum brand test
 * sits next to the class it recognises. It inspects the `SpectrumSymbol` property
 * and accepts any object or function that advertises the brand, so a value is not
 * required to hold a valid plan or any bins; the shape and behaviour of the value
 * are not validated.
 *
 * @param target - the value to inspect
 * @returns `true` if the value advertises the spectrum brand
 */
export { isSpectrum } from "#semantic/guard";
