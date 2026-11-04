import { isFunction, isNumber } from "#semantic/guard";
import { useRadian } from "#semantic/mathematics/angle";
import { Complex } from "#semantic/mathematics/complex";
import { Envelope } from "#semantic/mathematics/envelope";
import { Epicycle } from "#semantic/mathematics/epicycle";
import { Omega } from "#semantic/mathematics/omega";
import { fastFourierTransform } from "#semantic/mathematics/spectral";
import { asComplex } from "#semantic/mathematics/transform";
import { Waveform } from "#semantic/mathematics/waveform";
import type { SpectralWindow } from "#semantic/mathematics/window";
import { useHannWindow, useKaiserWindow, windowed } from "#semantic/mathematics/window";

/** A rational approximation of a real ratio. */
export interface ContinuedFraction {
    /** The numerator of the approximation. */
    readonly numerator: number;
    /** The positive denominator of the approximation. */
    readonly denominator: number;
}

/**
 * Options for the leap-style spectrum estimate.
 *
 * The analysis window is the taper applied after the integer-cycle window length
 * has been chosen; Kaiser beta widens the taper when the residual is still too
 * large. Verification retries the estimate with one more component and a wider
 * taper before accepting the result.
 */
export interface SpectralEstimateOptions {
    /** The taper applied to the analysis segment; defaults to a Kaiser window. */
    readonly window?: SpectralWindow;
    /** The Kaiser shape parameter used when no window is supplied; defaults to 8. */
    readonly kaiserBeta?: number;
    /** The residual energy ratio below which a result counts as verified; defaults to 1e-3. */
    readonly residualThreshold?: number;
    /** Whether a failed verification retries with one more component; defaults to true. */
    readonly enableVerification?: boolean;
    /** The smallest window the leap search may choose; defaults to max(64, count / 2). */
    readonly minimumWindow?: number;
}

/** One estimated real sinusoid in the continuous-time form `A*cos(omega*t + phase)`. */
interface Sinusoid {
    readonly amplitude: number;
    readonly omega: number;
    readonly phase: number;
}

/**
 * The outcome of a leap-style spectrum estimate.
 *
 * The waveform holds the accepted sinusoids in descending amplitude order, the
 * analysis window is the integer-cycle length chosen for the refinement, and the
 * residual ratio is the unexplained energy divided by the signal energy.
 */
export class SpectralEstimate {

    private readonly waveform: Waveform;
    private readonly analysisWindow: number;
    private readonly residualRatio: number;
    private readonly verified: boolean;

    /**
     * Creates an estimate from its components and verification figures.
     *
     * The waveform holds the accepted complex exponentials, the analysis window
     * records the integer-cycle length that produced them and the residual ratio
     * records how much of the signal energy stayed unexplained. An empty
     * estimate uses a zero window and a ratio of one.
     *
     * @param waveform the estimated components, in descending amplitude order
     * @param analysisWindow the window length used for refinement, zero when none
     * @param residualRatio the unexplained energy divided by the signal energy
     * @param verified whether the residual ratio reached the configured threshold
     * @throws {TypeError} if the waveform is not a `Waveform` or a number is invalid
     */
    public constructor(waveform: Waveform, analysisWindow: number, residualRatio: number, verified: boolean) {
        if (!(waveform instanceof Waveform)) {
            throw new TypeError("Spectral estimate waveform must be a Waveform.");
        }
        if (!isNumber(analysisWindow) || !Number.isInteger(analysisWindow) || analysisWindow < 0) {
            throw new TypeError("Spectral estimate analysis window must be a non-negative integer.");
        }
        if (!isNumber(residualRatio) || residualRatio < 0) {
            throw new TypeError("Spectral estimate residual ratio must be a non-negative finite number.");
        }
        this.waveform = waveform;
        this.analysisWindow = analysisWindow;
        this.residualRatio = residualRatio;
        this.verified = verified;
    }

    /**
     * Returns the estimated complex exponentials.
     *
     * The waveform is the accepted superposition in descending amplitude order;
     * its real part reconstructs the analysed real signal. A failed estimate
     * returns an empty waveform rather than throwing.
     *
     * @returns the estimated waveform, possibly empty
     */
    public getWaveform(): Waveform {
        return this.waveform;
    }

    /**
     * Returns the integer-cycle window length chosen for refinement.
     *
     * The length is expressed in samples and lies within the search bounds used
     * for the estimate. A rejected estimate reports zero because no window was
     * chosen.
     *
     * @returns the analysis window in samples, or zero when none was chosen
     */
    public getAnalysisWindow(): number {
        return this.analysisWindow;
    }

    /**
     * Returns the fraction of signal energy left unexplained.
     *
     * The ratio is `residualEnergy / signalEnergy`, so zero means a perfect
     * reconstruction and one means nothing was explained. A failed estimate
     * reports one.
     *
     * @returns the residual energy ratio in `[0, 1]` for ordinary signals
     */
    public getResidualRatio(): number {
        return this.residualRatio;
    }

    /**
     * Reports whether the residual ratio reached the configured threshold.
     *
     * Verification compares the final ratio with the option's residual threshold;
     * a retry that produced a smaller ratio is reported with its own comparison.
     *
     * @returns `true` when the residual is at or below the threshold
     */
    public isVerified(): boolean {
        return this.verified;
    }

    /**
     * Renders the component count, window length and residual ratio.
     *
     * @returns a description of the form `SpectralEstimate(components, window, residual)`
     */
    public toString(): string {
        return `SpectralEstimate(${this.waveform.size()} components, window ${this.analysisWindow}, residual ${this.residualRatio})`;
    }
}

/**
 * Approximates a ratio by a continued fraction.
 *
 * The loop stops when the denominator would exceed the limit, when the
 * denominator stops growing or after sixty-four terms, so a ratio with a huge
 * or irrational expansion still returns the best convergent found so far.
 *
 * @param ratio the positive ratio to approximate
 * @param maximumDenominator the largest accepted denominator
 * @returns the numerator and positive denominator of the convergent
 * @throws {TypeError} if the ratio is not finite or the limit is not an integer
 * @throws {RangeError} if the ratio or the limit is not positive
 */
export const continuedFraction: (ratio: number, maximumDenominator: number) => ContinuedFraction =
    (ratio: number, maximumDenominator: number): ContinuedFraction => {
        if (!isNumber(ratio)) {
            throw new TypeError("Continued fraction ratio must be a finite number.");
        }
        if (!isNumber(maximumDenominator) || !Number.isInteger(maximumDenominator)) {
            throw new TypeError("Continued fraction limit must be a finite integer.");
        }
        if (ratio <= 0) {
            throw new RangeError("Continued fraction ratio must be positive.");
        }
        if (maximumDenominator < 1) {
            throw new RangeError("Continued fraction limit must be positive.");
        }
        let previousNumerator: number = 0;
        let previousDenominator: number = 1;
        let currentNumerator: number = 1;
        let currentDenominator: number = 0;
        let value: number = ratio;
        for (let iteration: number = 0; iteration < 64; iteration += 1) {
            const integerPart: number = Math.floor(value);
            const nextNumerator: number = integerPart * currentNumerator + previousNumerator;
            const nextDenominator: number = integerPart * currentDenominator + previousDenominator;
            if (nextDenominator > maximumDenominator || nextDenominator <= 0
                || !Number.isSafeInteger(nextNumerator) || !Number.isSafeInteger(nextDenominator)) {
                break;
            }
            previousNumerator = currentNumerator;
            previousDenominator = currentDenominator;
            currentNumerator = nextNumerator;
            currentDenominator = nextDenominator;
            const fractionalPart: number = value - integerPart;
            if (fractionalPart < 1E-12) {
                break;
            }
            value = 1 / fractionalPart;
        }
        if (currentDenominator === 0) {
            return { numerator: 0, denominator: 1 };
        }
        return { numerator: currentNumerator, denominator: currentDenominator };
    }

/**
 * Chooses the integer-cycle window length that best fits a set of frequencies.
 *
 * Each frequency is approximated by a continued fraction, and every multiple of
 * its denominator becomes a candidate window. Near the maximum, the last thirty
 * two lengths are always considered as fallbacks. A candidate is scored by the
 * weighted distance of every component from a whole number of cycles, so zero
 * means every component completes exactly an integer number of periods.
 *
 * @param frequencies the component frequencies in hertz
 * @param weights the per-component weight, matching `frequencies`
 * @param samplingRate the frame rate in hertz
 * @param minimumWindow the smallest acceptable length
 * @param maximumWindow the largest acceptable length
 * @returns the length with the smallest weighted cycle distance
 * @throws {TypeError} if an argument is invalid
 * @throws {RangeError} if the rate is not positive or the weights do not match
 */
export const selectAnalysisWindow: (frequencies: readonly number[], weights: readonly number[], samplingRate: number, minimumWindow: number, maximumWindow: number) => number =
    (frequencies: readonly number[], weights: readonly number[], samplingRate: number, minimumWindow: number, maximumWindow: number): number => {
        if (!isNumber(samplingRate) || samplingRate <= 0) {
            throw new RangeError("Analysis window rate must be a positive finite number.");
        }
        if (!isNumber(minimumWindow) || !Number.isInteger(minimumWindow) || minimumWindow < 1) {
            throw new TypeError("Analysis window minimum must be a positive integer.");
        }
        if (!isNumber(maximumWindow) || !Number.isInteger(maximumWindow) || maximumWindow < 1) {
            throw new TypeError("Analysis window maximum must be a positive integer.");
        }
        if (weights.length !== frequencies.length) {
            throw new RangeError("Analysis window weights must match the frequency count.");
        }
        if (frequencies.length === 0 || maximumWindow <= minimumWindow) {
            return maximumWindow;
        }
        const candidates: Set<number> = new Set<number>();
        for (let component: number = 0; component < frequencies.length; component += 1) {
            const normalized: number = frequencies[component] / samplingRate;
            if (normalized <= 0 || normalized >= 0.5) {
                continue;
            }
            const approximation: ContinuedFraction = continuedFraction(normalized, maximumWindow);
            const denominator: number = approximation.denominator;
            if (denominator <= 0) {
                continue;
            }
            for (let multiplier: number = 1; multiplier * denominator <= maximumWindow; multiplier += 1) {
                const candidate: number = multiplier * denominator;
                if (candidate >= minimumWindow) {
                    candidates.add(candidate);
                }
            }
        }
        for (let offset: number = 0; offset < 32 && maximumWindow > minimumWindow + offset; offset += 1) {
            candidates.add(maximumWindow - offset);
        }
        const ordered: Array<number> = [...candidates].sort((left: number, right: number): number => left - right);
        let bestWindow: number = maximumWindow;
        let bestCost: number = Number.POSITIVE_INFINITY;
        for (const candidate of ordered) {
            if (candidate < minimumWindow || candidate > maximumWindow) {
                continue;
            }
            let cost: number = 0;
            let weightSum: number = 0;
            for (let component: number = 0; component < frequencies.length; component += 1) {
                const cycles: number = frequencies[component] * candidate / samplingRate;
                const fractional: number = cycles - Math.floor(cycles);
                const distance: number = Math.min(fractional, 1 - fractional);
                cost += weights[component] * distance;
                weightSum += weights[component];
            }
            if (weightSum > 0) {
                cost /= weightSum;
            }
            if (cost < bestCost) {
                bestCost = cost;
                bestWindow = candidate;
            }
        }
        return bestWindow;
    }

/**
 * Finds separated local maxima in a magnitude array.
 *
 * @param magnitudes the magnitude spectrum
 * @param numberOfPeaks the maximum number of peaks to return
 * @param minimumSeparation the smallest allowed bin distance between peaks
 * @returns the selected bins, in descending magnitude order
 */
const findPeakBins: (magnitudes: readonly number[], numberOfPeaks: number, minimumSeparation: number) => Array<number> =
    (magnitudes: readonly number[], numberOfPeaks: number, minimumSeparation: number): Array<number> => {
        if (magnitudes.length < 3) {
            return [];
        }
        const candidates: Array<{ bin: number; magnitude: number }> = [];
        for (let index: number = 1; index + 1 < magnitudes.length; index += 1) {
            if (magnitudes[index] > magnitudes[index - 1] && magnitudes[index] > magnitudes[index + 1]) {
                candidates.push({ bin: index, magnitude: magnitudes[index] });
            }
        }
        candidates.sort((left, right): number => right.magnitude - left.magnitude);
        const selected: Array<number> = [];
        for (const candidate of candidates) {
            if (selected.every((bin: number): boolean => Math.abs(candidate.bin - bin) >= minimumSeparation)) {
                selected.push(candidate.bin);
                if (selected.length === numberOfPeaks) {
                    break;
                }
            }
        }
        return selected;
    }

/**
 * Estimates the fractional peak offset from three logarithmic magnitudes.
 *
 * @param coefficients the complex spectrum
 * @param peakIndex the peak bin
 * @returns the offset within plus or minus half a bin
 */
const interpolateLogOffset: (coefficients: readonly Complex[], peakIndex: number) => number =
    (coefficients: readonly Complex[], peakIndex: number): number => {
        if (peakIndex === 0 || peakIndex + 1 >= coefficients.length) {
            return 0;
        }
        const left: number = Math.log(coefficients[peakIndex - 1].magnitude() + 1E-300);
        const center: number = Math.log(coefficients[peakIndex].magnitude() + 1E-300);
        const right: number = Math.log(coefficients[peakIndex + 1].magnitude() + 1E-300);
        const denominator: number = left - 2 * center + right;
        if (Math.abs(denominator) < 1E-12) {
            return 0;
        }
        return Math.min(0.5, Math.max(-0.5, 0.5 * (left - right) / denominator));
    }

/**
 * The magnitude of the correlation of a signal with one complex exponential.
 *
 * @param signal the real samples
 * @param samplingRate the frame rate in hertz
 * @param frequency the trial frequency in hertz
 * @returns the magnitude of the summed rotation
 */
const correlationMagnitude: (signal: readonly number[], samplingRate: number, frequency: number) => number =
    (signal: readonly number[], samplingRate: number, frequency: number): number => {
        const step: Complex = new Complex(Math.cos(-2 * Math.PI * frequency / samplingRate), Math.sin(-2 * Math.PI * frequency / samplingRate));
        let rotation: Complex = new Complex(1, 0);
        let sum: Complex = new Complex(0, 0);
        for (const sample of signal) {
            sum = sum.plus(rotation.multiply(sample));
            rotation = rotation.multiply(step);
        }
        return sum.magnitude();
    }

/**
 * Extracts amplitude, angular rate and phase at one frequency.
 *
 * @param signal the real samples
 * @param samplingRate the frame rate in hertz
 * @param frequency the frequency in hertz
 * @param normalization the sum used to normalize the amplitude, normally the sample count
 * @returns the fitted sinusoid
 */
const extractSinusoid: (signal: readonly number[], samplingRate: number, frequency: number, normalization: number) => Sinusoid =
    (signal: readonly number[], samplingRate: number, frequency: number, normalization: number): Sinusoid => {
        const step: Complex = new Complex(Math.cos(-2 * Math.PI * frequency / samplingRate), Math.sin(-2 * Math.PI * frequency / samplingRate));
        let rotation: Complex = new Complex(1, 0);
        let sum: Complex = new Complex(0, 0);
        for (const sample of signal) {
            sum = sum.plus(rotation.multiply(sample));
            rotation = rotation.multiply(step);
        }
        return {
            amplitude: 2 * sum.magnitude() / Math.max(1E-300, normalization),
            omega: 2 * Math.PI * frequency,
            phase: sum.argument().toRadianValue(),
        };
    }

/**
 * Maximizes a unimodal objective by golden-section search.
 *
 * @param objective the function to maximize
 * @param lowerBound the lower bracket
 * @param upperBound the upper bracket
 * @param iterations the number of shrinking steps
 * @returns the midpoint of the final bracket
 */
const goldenSectionMaximum: (objective: (value: number) => number, lowerBound: number, upperBound: number, iterations: number) => number =
    (objective: (value: number) => number, lowerBound: number, upperBound: number, iterations: number): number => {
        const goldenRatio: number = (Math.sqrt(5) - 1) / 2;
        let firstPoint: number = upperBound - goldenRatio * (upperBound - lowerBound);
        let secondPoint: number = lowerBound + goldenRatio * (upperBound - lowerBound);
        let firstValue: number = objective(firstPoint);
        let secondValue: number = objective(secondPoint);
        for (let iteration: number = 0; iteration < iterations; iteration += 1) {
            if (firstValue > secondValue) {
                upperBound = secondPoint;
                secondPoint = firstPoint;
                secondValue = firstValue;
                firstPoint = upperBound - goldenRatio * (upperBound - lowerBound);
                firstValue = objective(firstPoint);
            } else {
                lowerBound = firstPoint;
                firstPoint = secondPoint;
                firstValue = secondValue;
                secondPoint = lowerBound + goldenRatio * (upperBound - lowerBound);
                secondValue = objective(secondPoint);
            }
        }
        return 0.5 * (lowerBound + upperBound);
    }

/**
 * The unexplained energy fraction of a waveform against a signal.
 *
 * @param signal the real samples
 * @param samplingRate the frame rate in hertz
 * @param waveform the reconstructed waveform
 * @returns the residual energy divided by the signal energy
 */
const residualRatio: (signal: readonly number[], samplingRate: number, waveform: Waveform) => number =
    (signal: readonly number[], samplingRate: number, waveform: Waveform): number => {
        let signalEnergy: number = 0;
        let residualEnergy: number = 0;
        for (let index: number = 0; index < signal.length; index += 1) {
            const residual: number = signal[index] - waveform.value(index / samplingRate).getReal();
            signalEnergy += signal[index] * signal[index];
            residualEnergy += residual * residual;
        }
        return residualEnergy / (signalEnergy + 1E-300);
    }

/**
 * Estimates a waveform from real samples by integer-cycle windows.
 *
 * The pipeline mirrors the leap estimator: a Hann coarse spectrum supplies peak
 * frequencies, the leap search chooses a window that makes those frequencies
 * nearly periodic, the windowed spectrum refines each peak, and every component
 * is fitted on the residual by golden-section search before being subtracted.
 * Verification retries once with one more component and a wider Kaiser taper
 * when the residual exceeds the threshold.
 *
 * @param signal the real samples
 * @param samplingRate the frame rate in hertz
 * @param numberOfComponents the number of components to extract
 * @param options the taper, threshold and verification options
 * @returns the estimate, empty when the signal is too short or has no peaks
 * @throws {TypeError} if an option is invalid
 * @throws {RangeError} if the component count or an option value is out of range
 */
export const estimateSpectrum: (signal: readonly number[], samplingRate: number, numberOfComponents: number, options?: SpectralEstimateOptions) => SpectralEstimate =
    (signal: readonly number[], samplingRate: number, numberOfComponents: number, options: SpectralEstimateOptions = {}): SpectralEstimate => {
        if (!isNumber(samplingRate) || samplingRate <= 0) {
            throw new RangeError("Spectral estimate rate must be a positive finite number.");
        }
        if (!isNumber(numberOfComponents) || !Number.isInteger(numberOfComponents) || numberOfComponents < 1) {
            throw new RangeError("Spectral estimate component count must be a positive integer.");
        }
        const kaiserBeta: number = options.kaiserBeta === undefined ? 8 : options.kaiserBeta;
        if (!isNumber(kaiserBeta) || kaiserBeta < 0) {
            throw new RangeError("Spectral estimate Kaiser beta must be a non-negative finite number.");
        }
        const residualThreshold: number = options.residualThreshold === undefined ? 1E-3 : options.residualThreshold;
        if (!isNumber(residualThreshold) || residualThreshold <= 0) {
            throw new RangeError("Spectral estimate residual threshold must be positive.");
        }
        if (options.window !== undefined && !isFunction(options.window)) {
            throw new TypeError("Spectral estimate window must be a window function.");
        }
        if (options.minimumWindow !== undefined
            && (!isNumber(options.minimumWindow) || !Number.isInteger(options.minimumWindow) || options.minimumWindow < 1)) {
            throw new TypeError("Spectral estimate minimum window must be a positive integer.");
        }
        const length: number = signal.length;
        if (length < 8) {
            return new SpectralEstimate(new Waveform(), 0, 1, false);
        }
        const coarseSpectrum: Array<Complex> = fastFourierTransform(asComplex(windowed(signal, useHannWindow)));
        const coarseMagnitudes: Array<number> = [];
        for (let index: number = 0; index <= length / 2; index += 1) {
            coarseMagnitudes.push(coarseSpectrum[index].magnitude());
        }
        const coarseBins: Array<number> = findPeakBins(coarseMagnitudes, numberOfComponents, Math.max(2, Math.floor(length / 100)));
        if (coarseBins.length === 0) {
            return new SpectralEstimate(new Waveform(), 0, 1, false);
        }
        const coarseFrequencies: Array<number> = [];
        const coarseWeights: Array<number> = [];
        for (const bin of coarseBins) {
            coarseFrequencies.push((bin + interpolateLogOffset(coarseSpectrum, bin)) * samplingRate / length);
            coarseWeights.push(coarseMagnitudes[bin]);
        }
        const minimumWindow: number = options.minimumWindow === undefined ? Math.max(64, Math.floor(length / 2)) : options.minimumWindow;
        const analysisWindow: number = selectAnalysisWindow(coarseFrequencies, coarseWeights, samplingRate, minimumWindow, length);
        const window: SpectralWindow = options.window === undefined ? useKaiserWindow(kaiserBeta) : options.window;
        const windowedSpectrum: Array<Complex> = fastFourierTransform(asComplex(windowed(signal.slice(0, analysisWindow), window)));
        const windowedMagnitudes: Array<number> = [];
        for (let index: number = 0; index <= analysisWindow / 2; index += 1) {
            windowedMagnitudes.push(windowedSpectrum[index].magnitude());
        }
        const windowedBins: Array<number> = findPeakBins(windowedMagnitudes, numberOfComponents, Math.max(2, Math.floor(analysisWindow / 100)));
        if (windowedBins.length === 0) {
            return new SpectralEstimate(new Waveform(), analysisWindow, 1, false);
        }
        const initialFrequencies: Array<number> = windowedBins.map((bin: number): number =>
            (bin + interpolateLogOffset(windowedSpectrum, bin)) * samplingRate / analysisWindow);
        const order: Array<number> = windowedBins.map((_: number, index: number): number => index);
        order.sort((first: number, second: number): number =>
            windowedMagnitudes[windowedBins[second]] - windowedMagnitudes[windowedBins[first]]);
        const remaining: Array<number> = [...signal];
        const sinusoids: Array<Sinusoid> = [];
        const halfWidth: number = 0.5 * samplingRate / analysisWindow;
        let maximumAmplitude: number = 0;
        for (const orderIndex of order) {
            if (sinusoids.length >= numberOfComponents) {
                break;
            }
            const centerFrequency: number = initialFrequencies[orderIndex];
            const lowerFrequency: number = Math.max(1E-9, centerFrequency - halfWidth);
            const upperFrequency: number = Math.min(samplingRate * 0.5 - 1E-9, centerFrequency + halfWidth);
            if (upperFrequency <= lowerFrequency) {
                continue;
            }
            const refinedFrequency: number = goldenSectionMaximum(
                (trial: number): number => correlationMagnitude(remaining, samplingRate, trial),
                lowerFrequency,
                upperFrequency,
                50,
            );
            const parameters: Sinusoid = extractSinusoid(remaining, samplingRate, refinedFrequency, length);
            if (sinusoids.length === 0) {
                maximumAmplitude = parameters.amplitude;
            }
            if (parameters.amplitude < 1E-4 * Math.max(maximumAmplitude, 1E-12)) {
                continue;
            }
            sinusoids.push(parameters);
            for (let index: number = 0; index < length; index += 1) {
                remaining[index] -= parameters.amplitude * Math.cos(parameters.omega * index / samplingRate + parameters.phase);
            }
        }
        const waveform: Waveform = new Waveform(sinusoids.map((sinusoid: Sinusoid): Epicycle =>
            new Epicycle(new Envelope(sinusoid.amplitude), new Omega(sinusoid.omega), useRadian(sinusoid.phase))));
        const ratio: number = residualRatio(signal, samplingRate, waveform);
        const verified: boolean = ratio <= residualThreshold;
        const result: SpectralEstimate = new SpectralEstimate(waveform, analysisWindow, ratio, verified);
        if (!verified && options.enableVerification !== false) {
            const retryOptions: SpectralEstimateOptions = {
                ...options,
                kaiserBeta: Math.min(14, kaiserBeta + 3),
                enableVerification: false,
            };
            const retry: SpectralEstimate = estimateSpectrum(signal, samplingRate, numberOfComponents + 1, retryOptions);
            if (retry.getResidualRatio() < result.getResidualRatio()) {
                return new SpectralEstimate(retry.getWaveform(), retry.getAnalysisWindow(), retry.getResidualRatio(), retry.getResidualRatio() <= residualThreshold);
            }
        }
        return result;
    }
