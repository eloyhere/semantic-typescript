import test from 'node:test';
import assert from 'node:assert/strict';
import {
    Bin, Complex, Frame, Frequency, Sample, Sampler, Spectrogram, Spectrum,
    amplitudeDecibel, isBin, isFrame, isSpectrogram, isSpectrum, normalized, parabolicOffset,
    powerDecibel, useRectangularWindow,
} from '../dist/index.js';

const PI = Math.PI;
const close = (actual, expected, epsilon = 1e-9) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
};

test('a frame reports time-domain measurements', () => {
    const frame = new Frame(new Sample(4, 1), [1, -1, 1, -1]);
    assert.equal(frame.size(), 4);
    assert.equal(frame.isEmpty(), false);
    close(frame.mean(), 0);
    close(frame.rms(), 1);
    close(frame.peak(), 1);
    close(frame.peakToPeak(), 2);
    close(frame.energy(), 4);
    close(frame.power(), 1);
    close(frame.crestFactor(), 1);
    close(frame.variance(), 1);
    close(frame.standardDeviation(), 1);
    assert.equal(frame.zeroCrossings(), 3);
    close(frame.decibel(), 0);
    close(frame.scaled(0.1).decibel(), -20);
    assert.equal(frame.at(-1).isEmpty(), true);
    assert.equal(frame.at(0).get(), 1);
    assert.throws(() => frame.at(1.5), TypeError);
});

test('a frame derives detrended, normalized and resampled copies', () => {
    const ramp = new Frame(new Sample(4, 1), [0, 1, 2, 3]);
    const detrended = ramp.detrended();
    close(detrended.mean(), 0);
    close(detrended.peak(), 1.5);
    const normalized = ramp.normalized();
    close(normalized.peak(), 1);
    close(normalized.getValues()[3], 1);
    assert.throws(() => new Frame(new Sample(2, 1), [0, 0]).normalized(), RangeError);
    close(ramp.interpolate(0.125), 0.5);
    close(ramp.interpolate(0.5), 2);
    assert.throws(() => ramp.interpolate(2), RangeError);
    const resampled = ramp.resample(8);
    assert.equal(resampled.size(), 8);
    close(resampled.getSample().getRate(), 8);
    [0, 0.5, 1, 1.5, 2, 2.5, 3, 3].forEach((expected, index) => close(resampled.getValues()[index], expected));
    assert.equal(Frame.useRate([1, 2, 3, 4], 4).getSample().getDuration(), 1);
    assert.throws(() => Frame.useRate([], 4), RangeError);
    assert.throws(() => Frame.useRate([1], 0), RangeError);
});

test('a frame convolves and correlates its samples', () => {
    const frame = new Frame(new Sample(2, 1), [1, 2]);
    const convolved = frame.convolve([1, 1]);
    assert.equal(convolved.size(), 3);
    assert.deepEqual(convolved.toArray(), [1, 3, 2]);
    close(convolved.getSample().getRate(), 2);

    const line = new Frame(new Sample(3, 1), [1, 2, 3]);
    assert.deepEqual(line.autocorrelate(), [3, 8, 14, 8, 3]);
    assert.throws(() => line.correlate(frame), RangeError);
    assert.throws(() => frame.convolve([]), RangeError);
});

test('a bin exposes magnitude, power, phase and decibels', () => {
    const bin = new Bin(new Frequency(2), new Complex(3, 4));
    close(bin.magnitude(), 5);
    close(bin.power(), 25);
    close(bin.phase().getValue(), Math.atan2(4, 3));
    close(bin.decibel(), 20 * Math.log10(5));
    assert.ok(isBin(bin));
    assert.ok(bin.equals(new Bin(new Frequency(2), new Complex(3, 4))));
    assert.throws(() => new Bin(new Frequency(1), 1), TypeError);
});

test('normalisation and decibel helpers apply documented scaling', () => {
    const amplitude = new Complex(3, 4);
    close(normalized(amplitude, 'count', 10).getReal(), 0.3);
    close(normalized(amplitude, 'root', 10).getImaginary(), 4 / Math.sqrt(10));
    close(normalized(amplitude, 'none', 10).magnitude(), 5);
    // The amplitude convention uses 20 log10, so one tenth is minus 20 dB.
    close(amplitudeDecibel(1), 0);
    close(amplitudeDecibel(0.1), -20);
    close(amplitudeDecibel(1, 2), -20 * Math.log10(2));
    assert.equal(amplitudeDecibel(0), Number.NEGATIVE_INFINITY);
    assert.throws(() => amplitudeDecibel(-1), RangeError);
    // The power convention uses 10 log10: 0.25 is -6.02 dB, not the -12.04 dB
    // that the amplitude convention reports for the same number.
    close(powerDecibel(1), 0);
    close(powerDecibel(0.25), 10 * Math.log10(0.25));
    close(powerDecibel(1, 4), -10 * Math.log10(4));
    close(amplitudeDecibel(0.25), 20 * Math.log10(0.25));
    assert.equal(powerDecibel(0), Number.NEGATIVE_INFINITY);
    assert.throws(() => powerDecibel(-1), RangeError);
    assert.throws(() => powerDecibel(1, 0), RangeError);
    assert.throws(() => normalized(amplitude, 'bad', 10), TypeError);
    close(parabolicOffset(1, 2, 1.5), 0.5 * (1 - 1.5) / (1 - 4 + 1.5));
    assert.equal(parabolicOffset(2, 2, 2), 0);
});

test('a spectrum folds one-sided bins and scales amplitudes', () => {
    const sampler = new Sampler(new Sample(8, 1));
    const spectrum = sampler.fastFourierTransform(time => Math.cos(2 * PI * time));
    const folded = spectrum.oneSided();
    assert.equal(folded.length, 5);
    close(folded[1].magnitude(), 8);
    close(folded[0].magnitude(), 0);
    close(folded[4].magnitude(), 0);
    close(spectrum.amplitudeOf(1, 'count').get().getReal(), 0.5);
    close(spectrum.magnitudeOf(1, 'root').get(), 4 / Math.sqrt(8));
    close(spectrum.decibelOf(1, 'count').get(), 20 * Math.log10(0.5));
    // The same bin read as a power uses 10 log10, so 0.25 is -6.02 dB.
    close(spectrum.powerDecibelOf(1, 'count').get(), 10 * Math.log10(0.25));
    close(spectrum.getNyquist().getHertz(), 4);
    close(spectrum.refinedPeakFrequency().get().getHertz(), 1);
    assert.ok(isSpectrum(spectrum));
});

test('a spectrum reconstructs its frame with the inverse transform', () => {
    const sampler = new Sampler(new Sample(8, 1));
    const source = time => Math.cos(2 * PI * time);
    const spectrum = sampler.fastFourierTransform(source);
    const samples = spectrum.toFrames();
    assert.equal(samples.length, 8);
    samples.forEach((value, index) => close(value, source(index / 8)));
    const frame = spectrum.toFrame();
    assert.ok(frame instanceof Frame);
    assert.ok(frame.getSample().equals(spectrum.getSample()));
    assert.ok(isFrame(frame));
});

test('a spectrum reports shape statistics', () => {
    const spectrum = new Spectrum(new Sample(4, 1), [
        new Complex(1, 0), new Complex(2, 0), new Complex(0, 0), new Complex(0, 0),
    ]);
    close(spectrum.centroid().get().getHertz(), 0.8);
    close(spectrum.spread().get().getHertz(), 0.4);
    assert.equal(spectrum.flatness(), 0);
    close(spectrum.rolloff(0.85).get().getHertz(), 1);
    // The one-sided reading folds the conjugate half of a real spectrum: the
    // interior bin at 1 Hz contributes its power twice, DC once, while the
    // Nyquist bin at 2 Hz is outside the half-open band. The old two-sided raw
    // sum, still available explicitly, counted the interior bin once.
    close(spectrum.bandEnergy(new Frequency(0), new Frequency(2)), 9);
    close(spectrum.bandEnergy(new Frequency(0), new Frequency(2), 'two-sided'), 5);
    assert.throws(() => spectrum.bandEnergy(new Frequency(0), new Frequency(2), 'both'), TypeError);
    // The Nyquist bin is self-conjugate and counted once, but the upper bound is
    // exclusive: [0, Nyquist) excludes it while [0, Nyquist + 1) includes it.
    const nyquist = new Spectrum(new Sample(8, 1), [
        new Complex(0, 0), new Complex(0, 0), new Complex(0, 0), new Complex(0, 0),
        new Complex(8, 0), new Complex(0, 0), new Complex(0, 0), new Complex(0, 0),
    ]);
    close(nyquist.bandEnergy(new Frequency(0), new Frequency(4)), 0);
    close(nyquist.bandEnergy(new Frequency(0), new Frequency(5)), 64);
    close(nyquist.bandEnergy(new Frequency(0), new Frequency(5), 'two-sided'), 64);
    assert.throws(() => spectrum.rolloff(0), RangeError);
    const silent = new Spectrum(new Sample(2, 1), [new Complex(0, 0), new Complex(0, 0)]);
    assert.equal(silent.centroid().isEmpty(), true);
    assert.equal(silent.rolloff().isEmpty(), true);
});

test('flatness uses the one-sided power spectrum', () => {
    // Two bins with powers 4 and 1: the power flatness is sqrt(4) / 2.5 = 0.8.
    // The old amplitude reading of the same two bins gave sqrt(2) / 1.5 = 0.9428.
    const twoBins = new Spectrum(new Sample(2, 1), [new Complex(2, 0), new Complex(1, 0)]);
    close(twoBins.flatness(), 0.8);
    // A unit impulse has a perfectly flat power spectrum, so the ratio is one.
    const impulse = new Sampler(new Sample(8, 1)).fastFourierTransform(time => time === 0 ? 1 : 0);
    close(impulse.flatness(), 1);
    // A tone concentrates its power in one bin, so flatness falls to almost zero.
    const tone = new Sampler(new Sample(8, 1)).fastFourierTransform(time => Math.cos(2 * PI * time));
    assert.ok(tone.flatness() < 1E-12, `tone flatness ${tone.flatness()}`);
});

test('a spectrogram reports frame times and inverts back to a frame', () => {
    const source = time => Math.cos(2 * PI * 4 * time);
    const sampler = new Sampler(new Sample(64, 1));
    const spectrogram = sampler.spectrogram(source, 16, 8, useRectangularWindow);
    assert.ok(isSpectrogram(spectrogram));
    // The default zero boundary extension prepends and appends eight samples,
    // so the 64-sample source yields nine frames instead of seven.
    assert.equal(spectrogram.size(), 9);
    assert.equal(spectrogram.getFrameSize(), 16);
    assert.equal(spectrogram.getHopSize(), 8);
    assert.equal(spectrogram.getRate(), 64);
    assert.equal(spectrogram.getBoundary(), 'zeros');
    close(spectrogram.getTime(6), 0.75);
    close(spectrogram.getDuration(), 1);
    assert.equal(spectrogram.magnitudeMatrix().length, 9);
    assert.equal(spectrogram.magnitudeMatrix()[0].length, 16);
    // The first frame is half extension zeros, so its leakage spreads across the
    // band: bin 1 reads 4 rather than the 8 of a frame that starts on the tone,
    // and the magnitude-weighted centroid rises to 9.9341 Hz.
    close(spectrogram.binAt(0, 1).get().magnitude(), 4);
    close(spectrogram.dominantFrequencyAt(0).get().getHertz(), 4);
    close(spectrogram.spectralCentroidAt(0).get().getHertz(), 9.934147226250369, 1E-9);
    assert.equal(spectrogram.binAt(0, 20).isEmpty(), true);
    assert.equal(spectrogram.at(9).isEmpty(), true);
    assert.throws(() => spectrogram.getTime(9), RangeError);

    // Overlap-add trims the eight-sample extension at both ends, so the
    // reconstruction covers the original 64 samples rather than the padded 80.
    const reconstructed = spectrogram.toFrame();
    assert.equal(reconstructed.size(), 64);
    reconstructed.getValues().forEach((value, index) => close(value, source(index / 64)));

    const unpadded = sampler.spectrogram(source, 16, 8, useRectangularWindow, { boundary: 'none', padded: false });
    assert.equal(unpadded.getBoundary(), 'none');
    assert.equal(unpadded.size(), 7);
    close(unpadded.getTime(6), 0.875);
    close(unpadded.getDuration(), 1);
    assert.equal(unpadded.toFrame().size(), 64);
});

test('a spectrogram validates its columns and hop', () => {
    const sampler = new Sampler(new Sample(16, 1));
    const columns = sampler.shortTimeFourierTransform(time => time, 8, 4);
    assert.throws(() => new Spectrogram([], 4), RangeError);
    assert.throws(() => new Spectrogram(columns, 0), TypeError);
    assert.throws(() => new Spectrogram(columns, 4, 1), TypeError);
    assert.throws(() => new Spectrogram(columns, 4, useRectangularWindow, 'even'), TypeError);
    assert.doesNotThrow(() => new Spectrogram(columns, 4, useRectangularWindow, 'zeros'));
    assert.throws(() => new Spectrogram([columns[0], sampler.shortTimeFourierTransform(time => time, 16, 16)[0]], 4), RangeError);
});
