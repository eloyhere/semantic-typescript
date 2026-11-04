import test from 'node:test';
import assert from 'node:assert/strict';
import {
    Bin, Complex, Frame, Frequency, Sample, Sampler, Spectrogram, Spectrum,
    decibel, isBin, isFrame, isSpectrogram, isSpectrum, normalized, parabolicOffset,
    useRectangularWindow,
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
    close(decibel(1), 0);
    close(decibel(0.1), -20);
    close(decibel(1, 2), -20 * Math.log10(2));
    assert.equal(decibel(0), Number.NEGATIVE_INFINITY);
    assert.throws(() => decibel(-1), RangeError);
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
    close(spectrum.bandEnergy(new Frequency(0), new Frequency(2)), 5);
    assert.throws(() => spectrum.rolloff(0), RangeError);
    const silent = new Spectrum(new Sample(2, 1), [new Complex(0, 0), new Complex(0, 0)]);
    assert.equal(silent.centroid().isEmpty(), true);
    assert.equal(silent.rolloff().isEmpty(), true);
});

test('a spectrogram reports frame times and inverts back to a frame', () => {
    const source = time => Math.cos(2 * PI * 4 * time);
    const sampler = new Sampler(new Sample(64, 1));
    const spectrogram = sampler.spectrogram(source, 16, 8, useRectangularWindow);
    assert.ok(isSpectrogram(spectrogram));
    assert.equal(spectrogram.size(), 7);
    assert.equal(spectrogram.getFrameSize(), 16);
    assert.equal(spectrogram.getHopSize(), 8);
    assert.equal(spectrogram.getRate(), 64);
    close(spectrogram.getTime(6), 0.75);
    close(spectrogram.getDuration(), 1);
    assert.equal(spectrogram.magnitudeMatrix().length, 7);
    assert.equal(spectrogram.magnitudeMatrix()[0].length, 16);
    close(spectrogram.binAt(0, 1).get().magnitude(), 8);
    close(spectrogram.dominantFrequencyAt(0).get().getHertz(), 4);
    close(spectrogram.spectralCentroidAt(0).get().getHertz(), 4);
    assert.equal(spectrogram.binAt(0, 20).isEmpty(), true);
    assert.equal(spectrogram.at(7).isEmpty(), true);
    assert.throws(() => spectrogram.getTime(7), RangeError);

    const reconstructed = spectrogram.toFrame();
    assert.equal(reconstructed.size(), 64);
    reconstructed.getValues().forEach((value, index) => close(value, source(index / 64)));
});

test('a spectrogram validates its columns and hop', () => {
    const sampler = new Sampler(new Sample(16, 1));
    const columns = sampler.shortTimeFourierTransform(time => time, 8, 4);
    assert.throws(() => new Spectrogram([], 4), RangeError);
    assert.throws(() => new Spectrogram(columns, 0), TypeError);
    assert.throws(() => new Spectrogram(columns, 4, 1), TypeError);
    assert.throws(() => new Spectrogram([columns[0], sampler.shortTimeFourierTransform(time => time, 16, 16)[0]], 4), RangeError);
});
