import { Complex, Frequency, Sample, Sampler, Spectrum, Tone } from "#semantic/mathematics/index";
import type { SpectralWindow, WaveletLevel } from "#semantic/mathematics/index";
import { binFrequency, factorize, isFastLength, nextFastLength, zeroPad } from "#semantic/mathematics/spectral";
import { useHannWindow, windowed } from "#semantic/mathematics/window";

/** The spectrum keeps its plan and exposes typed bins. */
const plan = new Sample(8, 1);
const spectrum: Spectrum = new Spectrum(plan, [new Complex(1, 0)]);
const bins: ReadonlyArray<{ readonly frequency: Frequency; readonly amplitude: Complex }> = spectrum.getBins();
const resolution: Frequency = spectrum.getResolution();
void [bins, resolution];

/** Every transform returns the documented container type. */
const sampler = new Sampler(plan);
const tone = new Tone(new Frequency(1));
export const transformed: Spectrum = sampler.fastFourierTransform(tone);
export const direct: Spectrum = sampler.discreteFourierTransform(time => time);
export const frames: Array<Spectrum> = sampler.shortTimeFourierTransform(tone, 4, 2);
export const levels: Array<WaveletLevel> = sampler.waveletTransform(tone);
export const mellin: Array<Complex> = sampler.meilinTransform(tone, [1, 2]);
export const laplace: Array<Complex> = sampler.laplacianTransform(tone, [0]);
export const sampled: Sampler = sampler.resample(4);

/** radixN accepts extra prime radices. */
export const extended: Spectrum = sampler.radixN(tone, [11, 13]);
export const defaultRadices: Spectrum = sampler.radixN(tone);
// @ts-expect-error the radices must be an iterable of numbers.
sampler.radixN(tone, 11);

/** Windows are plain weights and helpers stay typed. */
export const window: SpectralWindow = useHannWindow;
export const weighted: Array<number> = windowed([1, 2, 3], window);
export const factors: Array<number> = factorize(12);
export const fast: boolean = isFastLength(12);
export const next: number = nextFastLength(11);
export const padded: Array<number> = zeroPad([1], 4);
export const bin: Frequency = binFrequency(plan, 2);

// @ts-expect-error a transform source must be a Tone, a Waveform, a Track, an Epicycle or an evaluator.
sampler.radix2(1);
// @ts-expect-error a window must be a function of index and count.
export const badWindow: SpectralWindow = 1;
// @ts-expect-error a wavelet level exposes readonly coefficient arrays.
levels[0].detail.push(1);
