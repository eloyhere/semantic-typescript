import test from 'node:test';
import assert from 'node:assert/strict';
import {
    Complex, Frame, Frequency, Sample,
    analyticSignal, applyBiquad, applyFir, applyOnePole, biquadResponse, coherentGain,
    discreteFourierTransform, equivalentNoiseBandwidth, fastFourierTransform,
    instantaneousAmplitude, instantaneousFrequency, inverseDiscreteFourierTransform,
    inverseFastFourierTransform, unwrapPhase, useBandPass, useDegree, useFirLowPass,
    useFlatTopWindow, useHannWindow, useHighPass, useKaiserWindow,
    useHannPeriodicWindow, useHammingPeriodicWindow, useBlackmanPeriodicWindow,
    useFlatTopPeriodicWindow,
    useLowPass, useNuttallWindow, useNotch, useOnePole, useRectangularWindow,
} from '../dist/index.js';

const PI = Math.PI;
const close = (actual, expected, epsilon = 1e-9) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
};
const complexTolerance = (left, right, epsilon = 1e-9) => {
    close(left.getReal(), right.getReal(), epsilon);
    close(left.getImaginary(), right.getImaginary(), epsilon);
};

const samplesOf = (count, evaluate) => Array.from({ length: count }, (_, index) => evaluate(index));

test('the fast transform agrees with the direct reference', () => {
    for (const count of [5, 7, 8, 12, 30]) {
        const values = samplesOf(count, index => new Complex(Math.sin(index), Math.cos(2 * index)));
        const direct = discreteFourierTransform(values);
        const fast = fastFourierTransform(values);
        assert.equal(fast.length, count);
        for (let index = 0; index < count; index += 1) {
            complexTolerance(fast[index], direct[index], 1e-9);
        }
        const backDirect = inverseDiscreteFourierTransform(direct);
        const backFast = inverseFastFourierTransform(direct);
        for (let index = 0; index < count; index += 1) {
            complexTolerance(backFast[index], backDirect[index], 1e-9);
            complexTolerance(backFast[index], values[index], 1e-9);
        }
    }
    assert.throws(() => fastFourierTransform([]), RangeError);
    assert.throws(() => fastFourierTransform([1, 2]), TypeError);
});

test('an impulse transforms flat and inverts back', () => {
    const impulse = [new Complex(1, 0), new Complex(0, 0), new Complex(0, 0), new Complex(0, 0)];
    const spectrum = fastFourierTransform(impulse);
    spectrum.forEach(value => complexTolerance(value, new Complex(1, 0)));
    const back = inverseFastFourierTransform(spectrum);
    back.forEach((value, index) => complexTolerance(value, impulse[index]));
});

test('biquad sections shape their frequency response', () => {
    const rate = 64;
    const lowPass = useLowPass(rate, 4);
    close(biquadResponse(lowPass, new Frequency(0), rate).magnitude(), 1, 1e-9);
    assert.ok(biquadResponse(lowPass, new Frequency(20), rate).magnitude() < 0.1);
    const highPass = useHighPass(rate, 20);
    assert.ok(biquadResponse(highPass, new Frequency(0), rate).magnitude() < 1e-12);
    const bandPass = useBandPass(rate, 8, 2);
    close(biquadResponse(bandPass, new Frequency(8), rate).magnitude(), 1, 1e-6);
    const notch = useNotch(rate, 8);
    assert.ok(biquadResponse(notch, new Frequency(8), rate).magnitude() < 1e-6);
    assert.throws(() => useLowPass(0, 4), RangeError);
    assert.throws(() => useLowPass(64, 32), RangeError);
    assert.throws(() => useNotch(64, 8, 0), RangeError);
});

test('biquad and one-pole filtering run over a frame', () => {
    const rate = 64;
    const constant = new Frame(new Sample(64, 1), new Array(64).fill(1));
    const filtered = applyBiquad(constant, useLowPass(rate, 4));
    close(filtered.getValues()[63], 1, 1e-6);

    const fast = new Frame(new Sample(64, 1), samplesOf(64, index => Math.cos(2 * PI * 16 * index / 64)));
    const slow = new Frame(new Sample(64, 1), samplesOf(64, index => Math.cos(2 * PI * 2 * index / 64)));
    const fastEnergy = applyBiquad(fast, useLowPass(rate, 4)).energy();
    const slowEnergy = applyBiquad(slow, useLowPass(rate, 4)).energy();
    assert.ok(fastEnergy < slowEnergy / 10);

    const smoothed = applyOnePole(constant, useOnePole(rate, 4));
    close(smoothed.getValues()[63], 1, 1e-3);
    assert.ok(smoothed.getValues()[0] < smoothed.getValues()[1]);
    assert.throws(() => applyOnePole(constant, 0), RangeError);
});

test('a windowed-sinc FIR kernel keeps direct current', () => {
    const taps = useFirLowPass(64, 8, 31);
    close(taps.reduce((total, value) => total + value, 0), 1, 1e-9);
    const constant = new Frame(new Sample(64, 1), new Array(64).fill(1));
    const filtered = applyFir(constant, taps);
    close(filtered.getValues()[32], 1, 1e-9);
    assert.ok(filtered.getValues()[0] < 1);
    assert.throws(() => useFirLowPass(64, 8, 30), RangeError);
});

test('the analytic signal reports envelope and instantaneous frequency', () => {
    const rate = 64;
    const frequency = 4;
    const frame = new Frame(new Sample(64, 1), samplesOf(64, index => Math.cos(2 * PI * frequency * index / rate)));
    const analytic = analyticSignal(frame);
    analytic.forEach((value, index) => close(value.getReal(), frame.getValues()[index], 1e-9));
    const amplitude = instantaneousAmplitude(analytic);
    close(amplitude[10], 1, 1e-9);
    const instantaneous = instantaneousFrequency(analytic, rate);
    close(instantaneous[10], frequency, 1e-9);
    const frequencyFrame = new Frame(new Sample(64, 1), samplesOf(64, index => Math.cos(2 * PI * 2 * index / 64)));
    close(instantaneousFrequency(analyticSignal(frequencyFrame), rate)[20], 2, 1e-9);
});

test('phase unwrapping follows a continuous radian curve', () => {
    const unwrapped = unwrapPhase([useDegree(350), useDegree(10), useDegree(30)]);
    close(unwrapped[0], 350 * PI / 180);
    close(unwrapped[1], 370 * PI / 180);
    close(unwrapped[2], 390 * PI / 180);
    assert.throws(() => unwrapPhase([]), RangeError);
});

test('windows expose shape parameters, coherent gain and noise bandwidth', () => {
    assert.equal(useKaiserWindow(0)(3, 8), 1);
    close(useKaiserWindow(8)(4, 9), 1, 1e-9);
    assert.ok(useKaiserWindow(8)(0, 9) < 0.01);
    close(useFlatTopWindow(4, 9), 1, 1e-6);
    assert.ok(useNuttallWindow(0, 9) < 0.01);
    close(coherentGain(useRectangularWindow, 8), 1);
    assert.ok(coherentGain(useHannWindow, 8) > 0.4 && coherentGain(useHannWindow, 8) < 0.5);
    close(equivalentNoiseBandwidth(useRectangularWindow, 256), 1, 1e-12);
    close(equivalentNoiseBandwidth(useHannWindow, 256), 1.5, 0.01);
    assert.throws(() => coherentGain(useHannWindow, 0), TypeError);

    // The periodic forms are DFT-even: their coherent gain and noise bandwidth do
    // not drift with the frame length, and the flat-top keeps its negative lobe.
    assert.equal(useHannPeriodicWindow(0, 8), 0);
    close(coherentGain(useHannPeriodicWindow, 8), 0.5, 1e-12);
    close(equivalentNoiseBandwidth(useHannPeriodicWindow, 8), 1.5, 1e-12);
    close(coherentGain(useHammingPeriodicWindow, 8), 0.54, 1e-12);
    close(coherentGain(useBlackmanPeriodicWindow, 8), 0.42, 1e-12);
    assert.ok(useFlatTopWindow(0, 64) < 0);
    assert.ok(useFlatTopPeriodicWindow(0, 64) < 0);
});
