import test from 'node:test';
import assert from 'node:assert/strict';
import {
    Angle, Coherence, Complex, Frame, Sample, coherence, crossSpectrum, isCoherence,
    useRadian, useRectangularWindow,
} from '../dist/index.js';

const PI = Math.PI;
const close = (actual, expected, epsilon = 1e-9) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
};
const wave = (count, frequency, phase = 0) =>
    new Frame(new Sample(count, 1), Array.from({ length: count }, (_, index) => Math.cos(2 * PI * frequency * index / count + phase)));
const noise = (seed, count) => {
    let state = seed;
    return Array.from({ length: count }, () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648 * 2 - 1;
    });
};
const options = { window: useRectangularWindow };

test('identical frames are fully coherent in their occupied bins', () => {
    const frame = wave(64, 4);
    const estimate = coherence(frame, frame, options);
    assert.ok(isCoherence(estimate));
    assert.equal(estimate.size(), 64);
    assert.equal(estimate.getRate(), 64);
    close(estimate.getResolution().getHertz(), 1);
    close(estimate.getNyquist().getHertz(), 32);
    close(estimate.magnitudeAt(4).get(), 1, 1e-9);
    close(estimate.magnitudeAt(60).get(), 1, 1e-9);
    close(estimate.phaseAt(4).get().getValue(), 0, 1e-9);
    close(estimate.peakFrequency().get().getHertz(), 4);
    close(estimate.peakMagnitude().get(), 1, 1e-9);
    assert.equal(estimate.toArray().length, 64);
    assert.equal(estimate.magnitudeAt(64).isEmpty(), true);
    assert.equal(estimate.magnitudeAt(-1).isEmpty(), true);
});

test('anti-phase frames report a half-turn cross phase', () => {
    const frame = wave(64, 4);
    const inverted = new Frame(frame.getSample(), frame.getValues().map(value => -value));
    const estimate = coherence(frame, inverted, options);
    close(estimate.magnitudeAt(4).get(), 1, 1e-9);
    close(estimate.phaseAt(4).get().getValue(), PI, 1e-9);
});

test('a delayed frame shifts the cross phase by one bin step per sample', () => {
    const frame = wave(64, 4);
    const delayed = new Frame(frame.getSample(), frame.getValues().map((_, index) => frame.getValues()[(index - 1 + 64) % 64]));
    const estimate = coherence(frame, delayed, options);
    close(estimate.magnitudeAt(4).get(), 1, 1e-9);
    close(estimate.phaseAt(4).get().toRadianValue(), 2 * PI - 2 * PI * 4 / 64, 1e-9);
});

test('independent noise averages to low coherence', () => {
    const first = new Frame(new Sample(512, 1), noise(1, 512));
    const second = new Frame(new Sample(512, 1), noise(2, 512));
    const estimate = coherence(first, second, { frameSize: 64, hopSize: 32, window: useRectangularWindow });
    let total = 0;
    let count = 0;
    for (let index = 1; index <= 32; index += 1) {
        total += estimate.magnitudeAt(index).get();
        count += 1;
    }
    assert.ok(total / count < 0.3, `average coherence ${total / count}`);
});

test('averaging several segments keeps identical signals coherent', () => {
    const frame = wave(128, 4);
    const estimate = coherence(frame, frame, { frameSize: 64, hopSize: 32, window: useRectangularWindow });
    assert.equal(estimate.size(), 64);
    close(estimate.magnitudeAt(4).get(), 1, 1e-9);
    close(estimate.peakFrequency().get().getHertz(), 4);
});

test('the cross-spectrum reuses the same segmentation', () => {
    const frame = wave(64, 4);
    const spectrum = crossSpectrum(frame, frame, options);
    assert.equal(spectrum.size(), 64);
    close(spectrum.magnitudeAt(4).get(), 32 * 32, 1e-6);
    close(spectrum.magnitudeAt(5).get(), 0, 1e-6);
});

test('coherence estimates validate their inputs', () => {
    const frame = wave(64, 4);
    const other = new Frame(new Sample(32, 1), new Array(32).fill(0));
    assert.throws(() => coherence(frame, other), RangeError);
    assert.throws(() => coherence(frame, frame, { frameSize: 0 }), RangeError);
    assert.throws(() => coherence(frame, frame, { frameSize: 128 }), RangeError);
    assert.throws(() => coherence(frame, frame, { hopSize: 0 }), RangeError);
    assert.throws(() => coherence(frame, frame, { window: 1 }), TypeError);
    assert.throws(() => coherence(frame, {}), TypeError);
    assert.throws(() => coherence(frame, frame, { window: () => Number.NaN }), RangeError);
});

test('a coherence validates its bins and compares estimates', () => {
    const plan = new Sample(2, 1);
    const phases = [useRadian(0), useRadian(PI / 2)];
    const crosses = [new Complex(1, 0), new Complex(0, 1)];
    const estimate = new Coherence(plan, [0.5, 1], phases, crosses);
    assert.equal(estimate.size(), 2);
    assert.ok(estimate.equals(estimate));
    assert.equal(estimate.toString(), 'Coherence(2 bins, 1Hz)');
    assert.throws(() => new Coherence(plan, [1.5, 0], phases, crosses), RangeError);
    assert.throws(() => new Coherence(plan, [0.5], phases, crosses), RangeError);
    assert.throws(() => new Coherence(plan, [0.5, 0], [0, 0], crosses), TypeError);
    assert.throws(() => new Coherence(plan, [0.5, 0], phases, [1, 2]), TypeError);
    assert.throws(() => new Coherence({}, [0.5, 0], phases, crosses), TypeError);
    assert.throws(() => estimate.magnitudeAt(0.5), TypeError);
    assert.throws(() => estimate.equals({}), TypeError);
});
