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
    coherentGain, equivalentNoiseBandwidth,
    useBlackmanPeriodicWindow, useBlackmanWindow, useFlatTopPeriodicWindow, useFlatTopWindow,
    useHammingPeriodicWindow, useHammingWindow, useHannPeriodicWindow, useHannWindow,
    useRectangularWindow, windowed,
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
    // The default zero boundary extension adds floor(16 / 2) samples at each end,
    // so 64 samples produce nine frames rather than the seven complete frames
    // that the old unpadded path returned.
    const spectra = sampler(64).shortTimeFourierTransform(cos, 16, 8);

    assert.equal(spectra.length, 9);
    for (const spectrum of spectra) {
        assert.equal(spectrum.size(), 16);
        assert.equal(spectrum.getRate(), 64);
        assert.equal(spectrum.getSample().getDuration(), 16 / 64);
        assert.ok(spectrum.getResolution().equals(new Frequency(4)));
    }
    assert.throws(() => sampler(16).shortTimeFourierTransform(cos, 32, 8), RangeError);
    assert.throws(() => sampler(16).shortTimeFourierTransform(cos, 8, 0), TypeError);
});

test('the short-time transform pads boundaries and covers the tail by default', () => {
    const plan = sampler(64);
    const padded = plan.shortTimeFourierTransform(cos, 16, 8);
    const plain = plan.shortTimeFourierTransform(cos, 16, 8, useHannPeriodicWindow, { boundary: 'none', padded: false });
    assert.equal(padded.length, 9);
    assert.equal(plain.length, 7);

    // 60 samples with a frame of 16 and a hop of 8 leave four samples that the
    // unextended, unpadded path cannot frame. Zero extension adds eight samples
    // per side; tail padding then adds four more so the last frame ends on the
    // final sample, turning six frames into nine.
    const partial = sampler(60);
    assert.equal(partial.shortTimeFourierTransform(cos, 16, 8, useHannPeriodicWindow, { boundary: 'none', padded: false }).length, 6);
    assert.equal(partial.shortTimeFourierTransform(cos, 16, 8, useHannPeriodicWindow, { boundary: 'none', padded: true }).length, 7);
    assert.equal(partial.shortTimeFourierTransform(cos, 16, 8).length, 9);

    // Constant extension repeats the edge samples rather than zero-filling; the
    // frame geometry is unchanged, so the frame count is the same.
    assert.equal(partial.shortTimeFourierTransform(cos, 16, 8, useHannPeriodicWindow, { boundary: 'constant' }).length, 9);

    assert.throws(() => plan.shortTimeFourierTransform(cos, 16, 8, useHannPeriodicWindow, { boundary: 'even' }), TypeError);
    assert.throws(() => plan.shortTimeFourierTransform(cos, 16, 8, useHannPeriodicWindow, { padded: 1 }), TypeError);
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

const overlapAdd = (window, count, hop) => {
    const sum = new Array(count).fill(0);
    for (let start = 0; start < count; start += hop) {
        for (let index = 0; index < count; index += 1) {
            sum[(index + start) % count] += window(index, count);
        }
    }
    return sum;
};
const rippleDecibel = values => 20 * Math.log10(Math.max(...values) / Math.min(...values));

test('periodic windows are the DFT-even forms of the symmetric windows', () => {
    assert.equal(useHannPeriodicWindow(0, 5), 0);
    close(useHannPeriodicWindow(2, 5), 0.5 - 0.5 * Math.cos(4 * Math.PI / 5));
    assert.ok(useHannPeriodicWindow(4, 5) > 0, 'the periodic Hann last sample is not zero');
    assert.equal(useHannWindow(4, 5), 0, 'the symmetric Hann last sample is zero');

    close(useHammingPeriodicWindow(0, 8), 0.08, 1E-12);
    close(useHammingPeriodicWindow(4, 8), 1, 1E-12);
    close(useBlackmanPeriodicWindow(0, 8), 0, 1E-12);
    close(useBlackmanPeriodicWindow(4, 8), 1, 1E-12);
    close(useFlatTopPeriodicWindow(4, 8), 1, 1E-6);

    close(coherentGain(useHannPeriodicWindow, 8), 0.5, 1E-12);
    close(equivalentNoiseBandwidth(useHannPeriodicWindow, 8), 1.5, 1E-12);
    close(coherentGain(useHannWindow, 8), 0.4375, 1E-12);
    close(equivalentNoiseBandwidth(useHannWindow, 8), 1.7142857142857144, 1E-12);
});

test('periodic Hann satisfies COLA at half hop while symmetric Hann does not', () => {
    for (const count of [16, 64, 256, 1024]) {
        const periodic = overlapAdd(useHannPeriodicWindow, count, count / 2);
        periodic.forEach(value => close(value, 1, 1E-12));
        const symmetric = overlapAdd(useHannWindow, count, count / 2);
        assert.ok(rippleDecibel(symmetric) > 0, `symmetric Hann should ripple at ${count}`);
    }
    // The documented short-frame worst case is 0.841 dB at 16 samples.
    close(rippleDecibel(overlapAdd(useHannWindow, 16, 8)), 0.8414102017054326, 1E-9);
    close(rippleDecibel(overlapAdd(useHannWindow, 1024, 512)), 0.01332671514763897, 1E-9);
});

test('the flat-top window keeps its negative lobe', () => {
    const symmetric = Array.from({ length: 1024 }, (_, index) => useFlatTopWindow(index, 1024));
    const periodic = Array.from({ length: 1024 }, (_, index) => useFlatTopPeriodicWindow(index, 1024));
    for (const weights of [symmetric, periodic]) {
        assert.ok(weights.some(weight => weight < 0), 'flat-top must contain negative weights');
        assert.ok(Math.min(...weights) < -0.0705, `minimum ${Math.min(...weights)}`);
    }
    // Without the clamp the symmetric window recovers the designed coherent gain
    // and noise bandwidth; the old clamped version reported 0.233280 / 3.199558.
    close(coherentGain(useFlatTopWindow, 1024), 0.2153680124990236, 1E-9);
    close(equivalentNoiseBandwidth(useFlatTopWindow, 1024), 3.7739463420400616, 1E-9);

    const scallopingLoss = window => {
        let real = 0;
        let imaginary = 0;
        let total = 0;
        for (let index = 0; index < 1024; index += 1) {
            const weight = window(index, 1024);
            const angle = Math.PI * index / 1024;
            real += weight * Math.cos(angle);
            imaginary -= weight * Math.sin(angle);
            total += weight;
        }
        return 20 * Math.log10(Math.hypot(real, imaginary) / Math.abs(total));
    };
    close(scallopingLoss(useFlatTopWindow), -0.009695032103578964, 1E-9);
    assert.ok(scallopingLoss(useHannWindow) < -1);
});
