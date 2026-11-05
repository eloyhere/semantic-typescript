import test from 'node:test';
import assert from 'node:assert/strict';
import { SynchronousSignalCollectable, SpectralDensity, signalColaResidual } from '../dist/synchronous/signal.js';
import { AsynchronousSignalCollectable } from '../dist/asynchronous/signal.js';
import { Frequency } from '../dist/mathematics/frequency.js';
import {
    useFlatTopPeriodicWindow, useHannPeriodicWindow, useHannWindow, useRectangularWindow,
} from '../dist/mathematics/window.js';

const PI = Math.PI;
const RATE = 1024;
const COUNT = 1024;
const BIN = 8;

/** Asserts that a value equals an expectation within a tolerance. */
const close = (actual, expected, epsilon = 1e-9, label = 'value') => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${label}: ${actual} is not within ${epsilon} of ${expected}`);
};

/** Builds a sine that lands exactly on a bin of a record of the given length. */
const tone = (count, bin) => Array.from({ length: count }, (_, index) => Math.cos(2 * PI * bin * index / count));

/** Builds a signal whose single tone sits exactly on a bin. */
const sine = (bin = BIN, count = COUNT, rate = RATE, window) =>
    SynchronousSignalCollectable.useRate(tone(count, bin), rate, window);

/** Returns the largest-magnitude bin of a bin array. */
const peakOf = (bins) => bins.reduce((best, bin) => bin.magnitude() > best.magnitude() ? bin : best, bins[0]);

/** Returns the mean square of a real sequence. */
const meanSquareOf = (values) => values.reduce((total, value) => total + value * value, 0) / values.length;

/** A deterministic standard normal generator, so the density checks never flake. */
const standardNormal = (count, seed = 12345) => {
    let state = seed;
    const uniform = () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return Math.max(state / 2147483648, 1e-12);
    };
    return Array.from({ length: count }, () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * PI * uniform()));
};

const samples = tone(COUNT, BIN);
const signal = sine();

test('a signal reports its plan, its window metrics and its samples', () => {
    assert.equal(signal.size(), BigInt(COUNT));
    assert.equal(signal.getRate(), RATE);
    assert.equal(signal.getResolution().getHertz(), RATE / COUNT);
    assert.equal(signal.getNyquist().getHertz(), RATE / 2);
    assert.equal(signal.getSample().getCount(), COUNT);
    assert.equal(signal.getWindow(), useHannPeriodicWindow);
    // The periodic Hann window has a coherent gain of exactly one half and an
    // equivalent noise bandwidth of exactly three halves, and both are recomputed
    // from the actual window vector rather than assumed.
    close(signal.getCoherentGain(), 0.5, 1e-12, 'coherent gain');
    close(signal.getNoiseBandwidth(), 1.5, 1e-12, 'noise bandwidth');
    assert.equal(signal.getValues().length, COUNT);
    assert.equal(signal.at(0n).get(), 1);
    close(signal.at(512n).get(), 1, 1e-12, 'sample 512');
    assert.equal(signal.at(-1n).isEmpty(), true);
    assert.equal(signal.at(BigInt(COUNT)).isEmpty(), true);
    assert.throws(() => signal.at(1), TypeError);
    assert.equal(signal.toFrame().size(), COUNT);
    assert.equal(signal.equals(sine()), true);
    assert.equal(signal.equals(sine(BIN + 1)), false);
    assert.match(signal.toString(), /SynchronousSignalCollectable/);
});

test('a sine peaks on its own bin and the one-sided fold reports that frequency', () => {
    const spectrum = signal.spectrum();
    assert.equal(spectrum.size(), COUNT);
    assert.equal(spectrum.getResolution().getHertz(), 1);
    // The two-sided grid is conjugate symmetric, so the raw peak magnitude is
    // count * coherent gain / 2 = 256 for a unit sinusoid.
    const dominant = spectrum.dominant().get();
    close(dominant.magnitude(), 256, 1e-9, 'raw peak magnitude');
    assert.ok(Math.abs(dominant.getFrequency().getHertz() - BIN) < 1e-9
        || Math.abs(dominant.getFrequency().getHertz() - (RATE - BIN)) < 1e-9);
    // The folded view is unambiguous: exactly one bin carries the component.
    const bins = signal.oneSided();
    assert.equal(bins.length, COUNT / 2 + 1);
    assert.equal(peakOf(bins).getFrequency().getHertz(), BIN);
    close(peakOf(bins).magnitude(), 512, 1e-9, 'one-sided peak magnitude');
});

test('the one-sided fold never doubles DC or Nyquist', () => {
    // `2 + cos(PI * n)` puts 2.0 on DC and 1.0 on Nyquist. Doubling either reports
    // exactly 6.02 decibels too much, which is the classic one-sided error.
    const values = Array.from({ length: COUNT }, (_, index) => 2 + Math.cos(PI * index));
    const offset = SynchronousSignalCollectable.useRate(values, RATE);
    const amplitude = offset.amplitude();
    const power = offset.power();
    close(amplitude[0], 2, 1e-9, 'DC amplitude');
    close(amplitude[amplitude.length - 1], 1, 1e-9, 'Nyquist amplitude');
    close(power[0], 4, 1e-9, 'DC power');
    close(power[power.length - 1], 1, 1e-9, 'Nyquist power');
    // The un-doubled one-sided energy is the Parseval sum, byte for byte. A
    // rectangular window is used because it leaves the samples themselves in the
    // transform; a taper would instead give `count * sum((x * w)^2)`.
    const spectrum = offset.spectrum(undefined, useRectangularWindow);
    const energy = spectrum.bandEnergy(new Frequency(0), new Frequency(RATE), 'one-sided');
    close(energy, COUNT * values.reduce((total, value) => total + value * value, 0), 1e-6, 'Parseval energy');
});

test('coherent gain is recomputed per length and never hard-coded', () => {
    // A symmetric Hann window reads 0.4375 at eight samples instead of 0.5, so a
    // hard-coded gain would misread the amplitude by 1.16 decibels. Both gains are
    // therefore measured from the window vector itself.
    const periodicShort = sine(1, 8, 8, useHannPeriodicWindow);
    const symmetricShort = sine(1, 8, 8, useHannWindow);
    close(periodicShort.getCoherentGain(), 0.5, 1e-12, 'periodic coherent gain');
    close(symmetricShort.getCoherentGain(), 0.4375, 1e-12, 'symmetric coherent gain');
    close(symmetricShort.getNoiseBandwidth(), 12 / 7, 1e-12, 'symmetric noise bandwidth');
    close(periodicShort.getNoiseBandwidth(), 1.5, 1e-12, 'periodic noise bandwidth');
    // The hard-coded gain would be off by more than a decibel at this length.
    assert.ok(Math.abs(20 * Math.log10(symmetricShort.getCoherentGain() / 0.5)) > 1);
    // At a length where the conjugate image no longer leaks into the bin, both
    // windows calibrate a bin-centred unit tone exactly.
    close(sine(8, 1024, 1024, useHannWindow).amplitude()[8], 1, 1e-4, 'symmetric amplitude');
    close(sine(8, 1024, 1024).amplitude()[8], 1, 1e-9, 'periodic amplitude');
});

test('power is the peak convention and sums to the noise bandwidth times the mean square', () => {
    const power = signal.power();
    close(power[BIN], 0.5, 1e-12, 'tone power');
    const total = power.reduce((sum, value) => sum + value, 0);
    close(total / meanSquareOf(samples), signal.getNoiseBandwidth(), 1e-9, 'power sum over mean square');
    // A tone plus a constant behaves the same way: the ratio is the bandwidth.
    const mixed = Array.from({ length: COUNT }, (_, index) => 0.5 + Math.cos(2 * PI * BIN * index / COUNT));
    const mixedPower = SynchronousSignalCollectable.useRate(mixed, RATE).power();
    close(mixedPower.reduce((sum, value) => sum + value, 0) / meanSquareOf(mixed), 1.5, 1e-9, 'mixed power ratio');
});

test('amplitude uses 20 log10 and power uses 10 log10', () => {
    const amplitude = signal.amplitude();
    const power = signal.power();
    const decibel = signal.decibel();
    const powerDecibel = signal.powerDecibel();
    close(decibel[BIN], 0, 1e-9, 'unit amplitude level');
    close(powerDecibel[BIN], 10 * Math.log10(0.5), 1e-12, 'half power level');
    // The two conventions differ by exactly the factor the square relation predicts.
    close(powerDecibel[BIN], 20 * Math.log10(Math.sqrt(0.5)), 1e-9, 'power level through the square root');
    assert.ok(Math.abs(20 * Math.log10(power[BIN]) - powerDecibel[BIN]) > 3, 'a power must not use the amplitude convention');
    for (let index = 0; index < amplitude.length; index += 1) {
        if (amplitude[index] > 1e-6) {
            close(decibel[index] / (20 * Math.log10(amplitude[index])), 1, 1e-9, 'amplitude level ratio');
        }
    }
});

test('the one-sided density satisfies Parseval and the one-sided band energy agrees', () => {
    const density = signal.powerSpectralDensity();
    close(density.totalPower(), meanSquareOf(samples), 1e-9, 'density total power');
    assert.equal(density.size(), 256 / 2 + 1);
    assert.equal(density.getSegments(), 7n);
    close(density.getResolution().getHertz(), 4, 1e-12, 'density resolution');
    assert.ok(density instanceof SpectralDensity);
    // The band energy of the raw spectrum is the same identity in transform units,
    // measured against the rectangular window so the samples are not tapered.
    const spectrum = signal.spectrum(undefined, useRectangularWindow);
    const energy = spectrum.bandEnergy(new Frequency(0), new Frequency(RATE), 'one-sided');
    close(energy, COUNT * samples.reduce((total, value) => total + value * value, 0), 1e-6, 'band energy');
    // A white-noise record integrates to its variance within a few percent, which
    // is the check that catches a wrong `sum(w^2)` divisor.
    const noise = standardNormal(4096);
    const noiseSignal = SynchronousSignalCollectable.useRate(noise, 4096);
    const noiseDensity = noiseSignal.powerSpectralDensity(512n, 256n);
    const ratio = noiseDensity.totalPower() / meanSquareOf(noise);
    assert.ok(ratio > 0.95 && ratio < 1.05, `white-noise density integral ratio ${ratio}`);
    const perHertz = noiseDensity.densityAt(16).get();
    assert.ok(perHertz > 0 && noiseSignal.spectralFlatness() > 0.3);
});

test('zero padding interpolates the peak but never changes the resolving power', () => {
    const padded = signal.spectrum(4096n);
    assert.equal(padded.size(), 4096);
    close(padded.getResolution().getHertz(), 0.25, 1e-12, 'padded bin spacing');
    close(signal.getResolution().getHertz(), 1, 1e-12, 'unpadded bin spacing');
    assert.equal(peakOf(signal.oneSided(4096n)).getFrequency().getHertz(), BIN);
    // A tone between two bins reads the nearer coarse bin without padding and a
    // finer location with it, yet two tones 0.4 bins apart stay merged either way.
    const between = SynchronousSignalCollectable.useRate(tone(COUNT, 8.4), RATE);
    assert.equal(peakOf(between.oneSided()).getFrequency().getHertz(), 8);
    close(peakOf(between.oneSided(4096n)).getFrequency().getHertz(), 8.5, 1e-9, 'padded peak location');
    assert.throws(() => signal.spectrum(16n), RangeError);
});

test('the periodic window satisfies constant overlap-add and the symmetric one does not', () => {
    close(signalColaResidual(useHannPeriodicWindow, 64, 32), 0, 1e-12, 'periodic Hann at 50 percent');
    close(signalColaResidual(useHannPeriodicWindow, 16, 8), 0, 1e-12, 'periodic Hann at sixteen samples');
    close(signalColaResidual(useHannPeriodicWindow, 1024, 512), 0, 1e-12, 'periodic Hann at 1024 samples');
    // The symmetric form ripples, and the ripple grows as the frame shortens.
    assert.ok(signalColaResidual(useHannWindow, 16, 8) > 0.8);
    assert.ok(signalColaResidual(useHannWindow, 64, 32) > 0.2);
    assert.ok(signalColaResidual(useHannWindow, 1024, 512) > 0.01);
    // A rectangular window conforms at any hop.
    close(signalColaResidual(useRectangularWindow, 256, 128), 0, 1e-12, 'rectangular window');
});

test('a flat-top window keeps its negative lobe and its flat main lobe', () => {
    const weights = Array.from({ length: 1024 }, (_, index) => useFlatTopPeriodicWindow(index, 1024));
    assert.ok(Math.min(...weights) < 0, 'the flat-top window must stay partially negative');
    // Halfway between two bins is the worst case. Hann loses about 1.42 decibels
    // there; the flat top is chosen precisely because it does not.
    const between = tone(COUNT, 8.5);
    const hann = Math.max(...SynchronousSignalCollectable.useRate(between, RATE).amplitude().slice(1, -1));
    const flat = Math.max(...SynchronousSignalCollectable.useRate(between, RATE, useFlatTopPeriodicWindow).amplitude().slice(1, -1));
    assert.ok(hann > 0.84 && hann < 0.86, `Hann scalloping ${hann}`);
    assert.ok(flat > 0.99, `flat-top scalloping ${flat}`);
});

test('the spectrogram frames every sample and reports centre times', () => {
    const columns = signal.shortTimeFourierTransform(256n, 128n);
    assert.equal(columns.length, 9);
    assert.equal(columns[0].size(), 256);
    const gram = signal.spectrogram(256n, 128n);
    assert.equal(gram.size(), 9);
    assert.equal(gram.getFrameSize(), 256);
    assert.equal(gram.getHopSize(), 128);
    assert.equal(gram.getWindow(), useHannPeriodicWindow);
    close(gram.getTime(0), 0, 1e-12, 'first centre');
    close(gram.getTime(1), 128 / RATE, 1e-12, 'second centre');
    close(gram.getTime(4), 512 / RATE, 1e-12, 'middle centre');
    close(gram.spectralCentroidAt(4).get().getHertz(), 8, 1e-6, 'middle spectral centroid');
    close(gram.magnitudeAt(4, 2).get(), 64, 1e-9, 'middle bin magnitude');
    // A thousand samples with a 256 frame and a 128 hop keep every sample: nine
    // frames cover 1280 extended samples, not the six complete frames a naive loop
    // would retain.
    const long = SynchronousSignalCollectable.useRate(new Array(1000).fill(0).map((_, index) => Math.cos(2 * PI * 4 * index / 1000)), 1000);
    assert.ok(long.shortTimeFourierTransform(256n, 128n).length > 6);
});

test('the analytic signal, its phase and its envelope follow the carrier', () => {
    const analytic = signal.analyticSignal();
    assert.equal(analytic.length, COUNT);
    // The real part recovers the samples up to rounding.
    close(analytic[100].getReal(), samples[100], 1e-9, 'analytic real part');
    const envelope = signal.envelope();
    const middle = envelope.slice(100, 900).reduce((sum, value) => sum + value, 0) / 800;
    close(middle, 1, 1e-6, 'envelope of a unit tone');
    const phase = signal.instantaneousPhase();
    assert.equal(phase.length, COUNT);
    for (const angle of phase.slice(0, 16)) {
        assert.ok(angle.toRadianValue() >= 0 && angle.toRadianValue() < 2 * PI);
    }
});

test('the instantaneous frequency reads the carrier and gates the envelope zeros', () => {
    const frequency = signal.instantaneousFrequency();
    close(frequency[0], 0, 1e-12, 'first sample has no predecessor');
    const middle = frequency.slice(100, 900).reduce((sum, value) => sum + value, 0) / 800;
    close(middle, 8, 1e-6, 'instantaneous frequency of an eight hertz tone');
    // Two tones two hertz apart beat; at the beat nodes the envelope vanishes and
    // the phase is undefined. The gate must suppress the resulting spikes, which
    // reach several hundred hertz without it.
    const beat = Array.from({ length: 2048 }, (_, index) =>
        Math.cos(2 * PI * 100 * index / 2048) + Math.cos(2 * PI * 102 * index / 2048));
    const beatSignal = SynchronousSignalCollectable.useRate(beat, 2048);
    const gated = beatSignal.instantaneousFrequency();
    const ungated = beatSignal.instantaneousFrequency(2048, 0);
    assert.ok(Math.max(...ungated.map(Math.abs)) > 300, 'the ungated path must expose the spike');
    assert.ok(Math.max(...gated.map(Math.abs)) < 110, 'the gate must suppress the spike');
    assert.ok(gated.some((value) => value === 0), 'the gate must report zero where the phase is undefined');
    assert.throws(() => beatSignal.instantaneousFrequency(2048, 2), RangeError);
});

test('the zero-crossing rate is a rate rather than a count', () => {
    close(signal.zeroCrossingRate(), 16 / 1023, 1e-12, 'crossings per sample');
    close(signal.zeroCrossingRate(true), 16 / 1023 * RATE, 1e-9, 'crossings per second');
    // A signal that alternates on every sample reads one, the maximum.
    const alternating = SynchronousSignalCollectable.useRate([1, -1, 1, -1, 1, -1, 1, -1], 8);
    close(alternating.zeroCrossingRate(), 1, 1e-12, 'alternating signal');
    close(SynchronousSignalCollectable.useRate([1], 1).zeroCrossingRate(), 0, 1e-12, 'one sample');
    assert.throws(() => signal.zeroCrossingRate('yes'), TypeError);
});

test('the auto-correlation is normalised by default and peaks at the period', () => {
    const rho = signal.autocorrelation(256n);
    assert.equal(rho.length, 257);
    close(rho[0], 1, 1e-12, 'zero lag');
    // The tone has a period of 128 samples, so lag 64 is antiphase and lag 128 is
    // back in phase. The biased estimator tapers them by (count - lag) / count.
    close(rho[64], -0.9375, 1e-9, 'antiphase lag');
    close(rho[128], 0.875, 1e-9, 'period lag');
    assert.ok(Math.max(...rho.map(Math.abs)) <= 1 + 1e-12);
    // The raw sum is the zero-lag energy and grows with the record.
    const raw = signal.autocorrelation(8n, 'none');
    close(raw[0], samples.reduce((total, value) => total + value * value, 0), 1e-6, 'raw zero lag');
    // The unbiased sum divides by the overlap length.
    const unbiased = signal.autocorrelation(128n, 'unbiased');
    close(unbiased[0], raw[0] / COUNT, 1e-9, 'unbiased zero lag');
    assert.throws(() => signal.autocorrelation(2048n), RangeError);
    assert.throws(() => signal.autocorrelation(-1n), RangeError);
});

test('the spectral shape descriptors describe a tone and a noise floor', () => {
    close(signal.spectralCentroid().get().getHertz(), 8, 1e-6, 'centroid');
    close(signal.spectralBandwidth().get().getHertz(), Math.sqrt(0.5 / 1.5), 1e-9, 'bandwidth');
    close(signal.spectralRolloff().get().getHertz(), 9, 1e-12, 'rolloff at eighty-five percent');
    close(signal.spectralRolloff(0.95).get().getHertz(), 9, 1e-12, 'rolloff at ninety-five percent');
    // A rectangular window concentrates the whole line in one bin, so the rolloff
    // lands exactly on the carrier.
    close(signal.spectralRolloff(0.85, useRectangularWindow).get().getHertz(), 8, 1e-12, 'rectangular rolloff');
    // The flatness is a power ratio over the one-sided half: a tone is nearly zero
    // and a white-noise floor approaches the exponential of minus Euler's constant.
    const tonal = signal.spectralFlatness();
    const noisy = SynchronousSignalCollectable.useRate(standardNormal(4096), 4096).spectralFlatness();
    assert.ok(tonal >= 0 && tonal < 1e-10, `tonal flatness ${tonal}`);
    assert.ok(noisy > 0.3 && noisy < 1, `noise flatness ${noisy}`);
    // A silent signal has no spectral mass, so every descriptor is absent.
    const silent = SynchronousSignalCollectable.useRate(new Array(64).fill(0), 64);
    assert.equal(silent.spectralCentroid().isEmpty(), true);
    assert.equal(silent.spectralBandwidth().isEmpty(), true);
    assert.equal(silent.spectralRolloff().isEmpty(), true);
    assert.equal(silent.spectralFlatness(), 0);
    assert.throws(() => signal.spectralRolloff(1.5), RangeError);
});

test('the spectral flux measures shape change rather than loudness', () => {
    const flux = signal.spectralFlux(256n, 128n);
    assert.equal(flux.length, 8);
    // Interior transitions of a stationary tone are numerically zero; only the two
    // boundary frames, which are half zero padding, differ.
    const interior = flux.slice(1, -1);
    assert.ok(Math.max(...interior) < 1e-9, `interior flux ${Math.max(...interior)}`);
    assert.ok(flux[0] > 0.1, 'the first transition sees the zero-padded boundary');
    // An onset produces a larger change than a steady tone.
    const onset = Array.from({ length: COUNT }, (_, index) =>
        index < COUNT / 2 ? Math.cos(2 * PI * BIN * index / COUNT) : Math.cos(2 * PI * 64 * index / COUNT));
    const onsetFlux = SynchronousSignalCollectable.useRate(onset, RATE).spectralFlux(256n, 128n);
    assert.ok(Math.max(...onsetFlux) > Math.max(...interior) + 0.5);
});

test('the signal-to-noise estimate is positive for a tone and absent for silence', () => {
    const ratio = signal.signalToNoiseRatio();
    assert.equal(ratio.isEmpty(), false);
    assert.ok(ratio.get() > 20, `sinusoidal SNR ${ratio.get()}`);
    const silent = SynchronousSignalCollectable.useRate(new Array(64).fill(0), 64);
    assert.equal(silent.signalToNoiseRatio().isEmpty(), true);
    assert.throws(() => signal.signalToNoiseRatio(256n, 128n, useHannPeriodicWindow, 1), RangeError);
});

test('detrending and windowing return new signals over the same plan', () => {
    const offset = SynchronousSignalCollectable.useRate(Array.from({ length: COUNT }, (_, index) => 3 + samples[index]), RATE);
    close(offset.detrended().getValues().reduce((total, value) => total + value, 0) / COUNT, 0, 1e-9, 'mean removed');
    close(offset.detrended('none').getValues()[0], 4, 1e-12, 'identity detrend');
    const ramp = SynchronousSignalCollectable.useRate(Array.from({ length: COUNT }, (_, index) => samples[index] + 0.5 * index), RATE);
    assert.ok(Math.max(...ramp.detrended('linear').getValues().map(Math.abs)) < 1.01);
    const tapered = signal.windowed();
    close(tapered.getValues()[0], 0, 1e-12, 'periodic Hann starts at zero');
    close(tapered.getValues()[512], samples[512], 1e-12, 'periodic Hann peaks at one');
    assert.equal(tapered.getWindow(), useHannPeriodicWindow);
    assert.throws(() => signal.detrended('cubic'), TypeError);
    assert.throws(() => signal.windowed(7), TypeError);
});

test('construction and analysis validate their arguments', () => {
    assert.throws(() => new SynchronousSignalCollectable(null, [1, 2]), TypeError);
    assert.throws(() => new SynchronousSignalCollectable(new (signal.getSample().constructor)(2, 2), [1]), RangeError);
    assert.throws(() => SynchronousSignalCollectable.useRate([], 8), RangeError);
    assert.throws(() => SynchronousSignalCollectable.useRate([1, 2], 0), RangeError);
    assert.throws(() => SynchronousSignalCollectable.useRate([1, 2], Number.NaN), TypeError);
    assert.throws(() => SynchronousSignalCollectable.useRate([1, Number.NaN], 8), TypeError);
    assert.throws(() => signal.spectrum(undefined, 7), TypeError);
    assert.throws(() => signal.spectrogram(2048n, 128n), RangeError);
    assert.throws(() => signal.spectrogram(256n, 512n), RangeError);
    assert.throws(() => signal.powerSpectralDensity(4096n), RangeError);
    assert.throws(() => signal.oneSided(16n), RangeError);
});

test('the asynchronous signal reproduces the synchronous numbers', async () => {
    const asynchronous = AsynchronousSignalCollectable.useRate(samples.slice(), RATE);
    assert.match(Object.prototype.toString.call(asynchronous), /AsynchronousSignalCollectable/);
    assert.equal(await asynchronous.count(), BigInt(COUNT));
    assert.equal(await asynchronous.isEmpty(), false);
    assert.equal((await asynchronous.toArray()).length, COUNT);
    close((await asynchronous.amplitude())[BIN], signal.amplitude()[BIN], 1e-12, 'amplitude parity');
    close((await asynchronous.oneSided()).length, signal.oneSided().length, 0, 'one-sided parity');
    close(peakOf(await asynchronous.oneSided()).getFrequency().getHertz(), BIN, 1e-12, 'async peak');
    close((await asynchronous.powerSpectralDensity()).totalPower(), signal.powerSpectralDensity().totalPower(), 1e-12, 'density parity');
    close((await asynchronous.spectralCentroid()).get().getHertz(), 8, 1e-9, 'async centroid');
    close(await asynchronous.zeroCrossingRate(), signal.zeroCrossingRate(), 1e-12, 'async zero crossing rate');
    close((await asynchronous.autocorrelation(64n))[64], signal.autocorrelation(64n)[64], 1e-12, 'async correlation');
    close((await asynchronous.envelope())[512], 1, 1e-6, 'async envelope');
    close((await asynchronous.instantaneousFrequency())[512], 8, 1e-6, 'async instantaneous frequency');
    close((await asynchronous.spectralFlatness()), signal.spectralFlatness(), 1e-15, 'async flatness');
    close((await asynchronous.spectrogram(256n, 128n)).getTime(1), 128 / RATE, 1e-12, 'async spectrogram time');
    await assert.rejects(async () => asynchronous.autocorrelation(4096n), RangeError);
    assert.throws(() => AsynchronousSignalCollectable.useRate([], 8), RangeError);
});
