import test from 'node:test';
import assert from 'node:assert/strict';
import {
    Frequency, Sample, Sampler, SpectralEstimate, useHertz,
} from '../dist/index.js';

const PI = Math.PI;
const close = (actual, expected, epsilon) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
};
const twoTone = time => Math.cos(2 * PI * 123.4 * time + 0.3) + 0.55 * Math.cos(2 * PI * 251.7 * time + 1.1);

test('continued fractions approximate ratios within the denominator limit', () => {
    assert.deepEqual(Sampler.continuedFraction(0.5, 100), { numerator: 1, denominator: 2 });
    assert.deepEqual(Sampler.continuedFraction(0.3, 100), { numerator: 3, denominator: 10 });
    assert.deepEqual(Sampler.continuedFraction(0.025, 1000), { numerator: 1, denominator: 40 });
    const approximation = Sampler.continuedFraction(123.4 / 500, 500);
    assert.ok(approximation.denominator > 0 && approximation.denominator <= 500);
    close(approximation.numerator / approximation.denominator, 123.4 / 500, 1 / 500);
    assert.throws(() => Sampler.continuedFraction(0, 100), RangeError);
    assert.throws(() => Sampler.continuedFraction(0.5, 0), RangeError);
});

test('the leap search picks a window with whole cycles', () => {
    const sampler = new Sampler(new Sample(1000, 1));
    assert.equal(sampler.selectAnalysisWindow([useHertz(10)]), 500);
    assert.equal(sampler.selectAnalysisWindow([useHertz(10), useHertz(25)]), 600);
    assert.equal(sampler.selectAnalysisWindow([useHertz(10), useHertz(25)], [1, 0]), 500);
    const bounded = sampler.selectAnalysisWindow([useHertz(10)], [1], 320, 640);
    close(bounded, 400, 0);
    assert.throws(() => sampler.selectAnalysisWindow([useHertz(10)], [1, 2]), RangeError);
    assert.throws(() => sampler.selectAnalysisWindow([10]), TypeError);
});

test('the estimate recovers exact tones', () => {
    const sampler = new Sampler(new Sample(500, 0.5));
    const estimate = sampler.estimate(twoTone, 2);
    assert.ok(estimate instanceof SpectralEstimate);
    assert.equal(estimate.getWaveform().size(), 2);
    assert.ok(estimate.getAnalysisWindow() >= 250 && estimate.getAnalysisWindow() <= 500);
    assert.ok(estimate.isVerified());
    assert.ok(estimate.getResidualRatio() < 1e-3);
    const frequencies = estimate.getWaveform().getEpicycles().map(epicycle => epicycle.getOmega().getHertz());
    const amplitudes = estimate.getWaveform().getEpicycles().map(epicycle => epicycle.getAmplitude().getConstant());
    close(frequencies[0], 123.4, 0.5);
    close(frequencies[1], 251.7, 0.5);
    close(amplitudes[0], 1, 0.02);
    close(amplitudes[1], 0.55, 0.02);
    let squared = 0;
    for (let index = 0; index < 500; index += 1) {
        const time = index / 1000;
        const residual = twoTone(time) - estimate.getWaveform().value(time).getReal();
        squared += residual * residual;
    }
    assert.ok(Math.sqrt(squared / 500) < 0.01);
});

test('a single component leaves a residual when verification is off', () => {
    const sampler = new Sampler(new Sample(500, 0.5));
    const estimate = sampler.estimate(twoTone, 1, { enableVerification: false });
    assert.equal(estimate.getWaveform().size(), 1);
    assert.equal(estimate.isVerified(), false);
    assert.ok(estimate.getResidualRatio() > 1e-3);
});

test('verification retries with one more component', () => {
    const sampler = new Sampler(new Sample(500, 0.5));
    const estimate = sampler.estimate(twoTone, 1, { residualThreshold: 1e-3, enableVerification: true });
    assert.equal(estimate.getWaveform().size(), 2);
    assert.ok(estimate.isVerified());
});

test('the estimate validates its inputs', () => {
    const sampler = new Sampler(new Sample(500, 0.5));
    const short = new Sampler(new Sample(4, 0.004)).estimate(twoTone, 2);
    assert.equal(short.getWaveform().size(), 0);
    assert.equal(short.getAnalysisWindow(), 0);
    assert.equal(short.isVerified(), false);
    assert.throws(() => sampler.estimate(twoTone, 0), RangeError);
    assert.throws(() => sampler.estimate(twoTone, 1, { residualThreshold: -1 }), RangeError);
    assert.throws(() => sampler.estimate(twoTone, 1, { kaiserBeta: -1 }), RangeError);
    assert.throws(() => sampler.estimate(twoTone, 1, { window: 1 }), TypeError);
    assert.throws(() => sampler.estimate(twoTone, 1, { minimumWindow: 0 }), TypeError);
    const custom = sampler.estimate(twoTone, 2, { window: () => 1, minimumWindow: 300 });
    assert.equal(custom.getWaveform().size(), 2);
});

test('a frequency list is accepted for the window search', () => {
    const sampler = new Sampler(new Sample(1000, 1));
    const window = sampler.selectAnalysisWindow([new Frequency(10), new Frequency(25)]);
    assert.equal(window, 600);
});
