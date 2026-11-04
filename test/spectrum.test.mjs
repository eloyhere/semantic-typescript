import test from 'node:test';
import assert from 'node:assert/strict';
import { Complex } from '../dist/mathematics/complex.js';
import { Frequency } from '../dist/mathematics/frequency.js';
import { Sample } from '../dist/mathematics/sample.js';
import { Sampler } from '../dist/mathematics/sampler.js';
import { Sampler as SamplerAgain } from '../dist/mathematics/index.js';
import {
    binFrequency, factorize, isFastLength, nextFastLength, zeroPad,
} from '../dist/mathematics/spectral.js';
import { isSpectrum, Spectrum } from '../dist/mathematics/spectrum.js';
import { Tone } from '../dist/mathematics/tone.js';
import {
    useBlackmanWindow, useHammingWindow, useHannWindow, useRectangularWindow, windowed,
} from '../dist/mathematics/window.js';

const epsilon = 1E-9;
const close = (actual, expected, tolerance = epsilon) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

const sampler = (count, duration = 1) => new Sampler(new Sample(count, duration));
const cos = time => Math.cos(2 * Math.PI * time);
const constant = () => 1;

test('a pure cosine concentrates its transform in the matching bins', () => {
    const spectrum = sampler(8).fastFourierTransform(cos);

    assert.ok(spectrum instanceof Spectrum);
    assert.ok(isSpectrum(spectrum));
    assert.equal(spectrum.size(), 8);
    assert.equal(spectrum.getRate(), 8);
    assert.ok(spectrum.getResolution().equals(new Frequency(1)));
    assert.ok(spectrum.amplitudeAt(1).get().equals(new Complex(4, 0), 1E-9));
    assert.ok(spectrum.amplitudeAt(7).get().equals(new Complex(4, 0), 1E-9));
    for (const index of [0, 2, 3, 4, 5, 6]) {
        assert.ok(spectrum.amplitudeAt(index).get().magnitude() < 1E-9);
    }
    assert.ok(spectrum.frequencyAt(1).get().equals(new Frequency(1)));
    assert.ok(spectrum.peakFrequency().get().equals(new Frequency(1)));
    assert.equal(spectrum.binAt(8).isEmpty(), true);
    assert.equal(spectrum.binAt(-1).isEmpty(), true);
});

test('the mixed-radix transform agrees with the direct transform', () => {
    const source = time => Math.sin(2 * Math.PI * 3 * time) + 0.5 * Math.cos(2 * Math.PI * 5 * time) + 0.25;
    for (const count of [8, 12, 18, 30]) {
        const plan = sampler(count);
        const fast = plan.fastFourierTransform(source);
        const reference = plan.discreteFourierTransform(source);
        assert.equal(fast.size(), count);
        for (let index = 0; index < count; index += 1) {
            assert.ok(fast.amplitudeAt(index).get().equals(reference.amplitudeAt(index).get(), 1E-9),
                `count ${count} bin ${index}`);
        }
    }
});

test('Bluestein agrees with the direct transform for awkward lengths', () => {
    const source = time => Math.cos(2 * Math.PI * 2 * time) + Math.sin(2 * Math.PI * 5 * time);
    for (const count of [5, 7, 11, 13]) {
        const plan = sampler(count);
        const bluestein = plan.blueStein(source);
        const reference = plan.discreteFourierTransform(source);
        assert.equal(bluestein.size(), count);
        for (let index = 0; index < count; index += 1) {
            assert.ok(bluestein.amplitudeAt(index).get().equals(reference.amplitudeAt(index).get(), 1E-9),
                `count ${count} bin ${index}`);
        }
    }
});

test('each radix transform handles its own exact power', () => {
    const source = time => Math.cos(2 * Math.PI * 2 * time) + 0.25;
    for (const count of [8, 9, 25, 49]) {
        const plan = sampler(count);
        const choice = count === 8 ? plan.radix2(source)
            : count === 9 ? plan.radix3(source)
                : count === 25 ? plan.radix5(source)
                    : plan.radix7(source);
        const reference = plan.discreteFourierTransform(source);
        for (let index = 0; index < count; index += 1) {
            assert.ok(choice.amplitudeAt(index).get().equals(reference.amplitudeAt(index).get(), 1E-9),
                `count ${count} bin ${index}`);
        }
    }
});

test('radix transforms reject frame counts they cannot factorise', () => {
    const source = constant;
    assert.throws(() => sampler(6).radix2(source), RangeError);
    assert.throws(() => sampler(8).radix3(source), RangeError);
    assert.throws(() => sampler(8).radix5(source), RangeError);
    assert.throws(() => sampler(8).radix7(source), RangeError);
    assert.throws(() => sampler(11).radixN(source), RangeError);
    assert.doesNotThrow(() => sampler(210).radixN(source));
});

test('radixN accepts extra prime radices', () => {
    const source = time => Math.cos(2 * Math.PI * 2 * time) + Math.sin(2 * Math.PI * 5 * time);
    for (const [count, radices] of [[11, [11]], [22, [2, 11]], [121, [11]], [39, [3, 13]], [14, [2, 7]]]) {
        const plan = sampler(count);
        const mixed = plan.radixN(source, radices);
        const reference = plan.discreteFourierTransform(source);
        for (let index = 0; index < count; index += 1) {
            assert.ok(mixed.amplitudeAt(index).get().equals(reference.amplitudeAt(index).get(), 1E-9),
                `count ${count} bin ${index}`);
        }
    }

    // Passing a radix does not accept a count that still has another factor.
    assert.throws(() => sampler(12).radixN(source, [11]), RangeError);
    assert.throws(() => sampler(22).radixN(source), RangeError);
    assert.throws(() => sampler(12).radixN(source, [8]), TypeError);
    assert.throws(() => sampler(12).radixN(source, [1]), TypeError);
    assert.throws(() => sampler(12).radixN(source, [2.5]), TypeError);
    assert.throws(() => sampler(12).radixN(source, 2), TypeError);
});

test('the short-time transform frames the source and keeps its rate', () => {
    const spectra = sampler(64).shortTimeFourierTransform(cos, 16, 8);

    assert.equal(spectra.length, 7);
    for (const spectrum of spectra) {
        assert.equal(spectrum.size(), 16);
        assert.equal(spectrum.getRate(), 64);
        assert.equal(spectrum.getSample().getDuration(), 16 / 64);
        assert.ok(spectrum.getResolution().equals(new Frequency(4)));
    }
    assert.throws(() => sampler(16).shortTimeFourierTransform(cos, 32, 8), RangeError);
    assert.throws(() => sampler(16).shortTimeFourierTransform(cos, 8, 0), TypeError);
});

test('a tone peaks at its own bin', () => {
    const plan = sampler(32);
    const spectrum = plan.fastFourierTransform(new Tone(new Frequency(4), undefined, undefined));

    assert.ok(spectrum.peakFrequency().get().equals(new Frequency(4)));
    close(spectrum.magnitudeAt(4).get(), 16, 1E-6);
});

test('the Haar decomposition halves each level and closes on one coefficient', () => {
    const levels = sampler(4).waveletTransform(time => time);

    assert.equal(levels.length, 2);
    assert.equal(levels[0].approximation.length, 2);
    assert.equal(levels[0].detail.length, 2);
    close(levels[0].approximation[0], 0.25 / Math.SQRT2);
    close(levels[0].approximation[1], 1.25 / Math.SQRT2);
    close(levels[0].detail[0], -0.25 / Math.SQRT2);
    close(levels[0].detail[1], -0.25 / Math.SQRT2);
    assert.equal(levels[1].approximation.length, 1);
    assert.equal(levels[1].detail.length, 1);
    close(levels[1].approximation[0], 0.75);
    close(levels[1].detail[0], -0.5);

    assert.throws(() => sampler(3).waveletTransform(time => time), RangeError);
    assert.throws(() => sampler(4).waveletTransform(time => time, 3), RangeError);
    assert.equal(sampler(4).waveletTransform(time => time, 1).length, 1);
});

test('the Mellin transform integrates t^(s-1) over the plan', () => {
    const values = sampler(16).meilinTransform(constant, [1, 2]);

    close(values[0].getReal(), 1, 1E-12);
    close(values[0].getImaginary(), 0, 1E-12);
    close(values[1].getReal(), 0.5, 1E-12);
    assert.throws(() => sampler(16).meilinTransform(constant, [0.5]), RangeError);
    assert.throws(() => sampler(16).meilinTransform(constant, [Number.NaN]), TypeError);
});

test('the Laplace transform integrates the exponential kernel', () => {
    const plan = sampler(256);
    const values = plan.laplacianTransform(constant, [0, 1]);

    close(values[0].getReal(), 1, 1E-9);
    close(values[1].getReal(), 1 - Math.exp(-1), 1E-4);
    const ramp = plan.laplacianTransform(time => time, [1]);
    close(ramp[0].getReal(), 1 - 2 * Math.exp(-1), 1E-3);
});

test('windows taper their ends and weight a frame', () => {
    assert.equal(useRectangularWindow(0, 5), 1);
    assert.equal(useHannWindow(0, 5), 0);
    close(useHannWindow(2, 5), 1);
    assert.equal(useHannWindow(4, 5), 0);
    close(useHammingWindow(0, 5), 0.08);
    close(useBlackmanWindow(0, 5), 0);
    close(useBlackmanWindow(2, 5), 1);

    const weighted = windowed([1, 1, 1, 1, 1], useHannWindow);
    assert.equal(weighted.length, 5);
    close(weighted[1], 0.5);
    close(weighted[2], 1);
    close(weighted[3], 0.5);
    assert.deepEqual(windowed([1, 2]), [1, 2]);
    assert.throws(() => windowed([1], () => Number.NaN), RangeError);
});

test('spectral helpers factor lengths, pad frames and name bins', () => {
    assert.deepEqual(factorize(12), [2, 2, 3]);
    assert.deepEqual(factorize(1), []);
    assert.equal(isFastLength(12), true);
    assert.equal(isFastLength(11), false);
    assert.equal(nextFastLength(11), 12);
    assert.equal(nextFastLength(12), 12);
    assert.deepEqual(zeroPad([1, 2], 4), [1, 2, 0, 0]);
    assert.throws(() => zeroPad([1, 2, 3], 2), RangeError);
    assert.throws(() => factorize(0), TypeError);
    assert.ok(binFrequency(new Sample(4, 1), 3).equals(new Frequency(3)));
    assert.ok(binFrequency(new Sample(8, 2), 2).equals(new Frequency(1)));
});

test('a spectrum validates its plan and amplitude count', () => {
    const plan = new Sample(4, 1);
    assert.throws(() => new Spectrum(plan, [new Complex(0, 0)]), RangeError);
    assert.throws(() => new Spectrum(plan, [1, 2, 3, 4]), TypeError);
    const spectrum = new Spectrum(plan, [new Complex(1, 0), new Complex(0, 1), new Complex(0, 0), new Complex(0, 0)]);
    assert.ok(spectrum.getSample().equals(plan));
    assert.equal(spectrum.toArray().length, 4);
    assert.equal(spectrum.toString(), 'Spectrum(4 bins, 1Hz)');
});

test('resample creates a new plan without mutating the original', () => {
    const original = sampler(8);
    const doubled = original.resample(4);

    assert.ok(doubled instanceof Sampler);
    assert.ok(doubled instanceof SamplerAgain);
    assert.equal(doubled.getSample().getCount(), 4);
    assert.equal(doubled.getSample().getDuration(), 1);
    assert.equal(original.getSample().getCount(), 8);
    assert.equal(original.resample(4, 2).getSample().getCount(), 8);
    assert.equal(original.resample(4, 2).getSample().getDuration(), 2);
    assert.throws(() => new Sampler({}), TypeError);
});
