import test from 'node:test';
import assert from 'node:assert/strict';
import {
    Angle, useRadian, useDegree, arcsine, arccosine, arctangent, arctangent2,
    arcHyperbolicSine, arcHyperbolicCosine, arcHyperbolicTangent,
    Complex, Envelope, Epicycle, Frequency, useHertz, Omega, Sample, Sampler, Tone, Waveform,
} from '../dist/index.js';

const PI = Math.PI;
const close = (actual, expected, epsilon = 1e-9) => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
};

test('angle normalizes values into a single full turn', () => {
    close(useRadian(3 * PI).getValue(), PI);
    close(useDegree(450).getValue(), 90);
    close(useDegree(-90).getValue(), 270);
    close(useRadian(-PI / 2).toDegreeValue(), 270);
    assert.equal(new Angle().getValue(), 0);
    assert.throws(() => useRadian(NaN), TypeError);
    assert.throws(() => useRadian(Infinity), TypeError);
    assert.throws(() => new Angle(1, 0), RangeError);
});

test('angle converts between units and combines mixed units', () => {
    const half = useDegree(180);
    assert.ok(half.toRadian().isRadian());
    close(half.toRadian().getValue(), PI);
    assert.ok(half.isDegree());
    close(half.toRadian().toDegree().getValue(), 180);
    close(useDegree(180).plus(useRadian(PI)).getValue(), 0);
    close(useRadian(PI).minus(useDegree(90)).getValue(), PI / 2);
    close(useDegree(90).multiply(2).getValue(), 180);
    close(useDegree(180).divide(2).getValue(), 90);
    assert.throws(() => useDegree(90).divide(0), RangeError);
    assert.ok(useDegree(-10).equals(useDegree(350)));
    assert.ok(useDegree(0).equals(useRadian(2 * PI)));
    assert.ok(!useDegree(10).equals(useDegree(20)));
    assert.throws(() => useDegree(10).equals(null), TypeError);
});

test('angle evaluates circular and hyperbolic functions', () => {
    close(useRadian(PI / 6).sine(), 0.5);
    close(useRadian(PI / 3).cosine(), 0.5);
    close(useDegree(45).tangent(), 1);
    assert.throws(() => useDegree(90).tangent(), RangeError);
    close(useRadian(0).hyperbolicSine(), 0);
    close(useRadian(0).hyperbolicCosine(), 1);
    close(useRadian(0).hyperbolicTangent(), 0);
    close(arcsine(1).getValue(), PI / 2);
    close(arccosine(0).getValue(), PI / 2);
    close(arctangent(1).getValue(), PI / 4);
    close(arctangent2(1, 1).getValue(), PI / 4);
    close(arctangent2(-1, -1).getValue(), 5 * PI / 4);
    close(arcHyperbolicSine(0).getValue(), 0);
    close(arcHyperbolicCosine(1).getValue(), 0);
    close(arcHyperbolicTangent(0).getValue(), 0);
    assert.throws(() => arcsine(2), RangeError);
    assert.throws(() => arccosine(-2), RangeError);
    assert.throws(() => arcHyperbolicCosine(0), RangeError);
    assert.throws(() => arcHyperbolicTangent(1), RangeError);
});

test('complex arithmetic follows the principal branch', () => {
    const value = new Complex(3, 4);
    close(value.magnitude(), 5);
    close(value.argument().getValue(), Math.atan2(4, 3));
    close(value.conjugate().getImaginary(), -4);
    assert.equal(value.plus(new Complex(1, -1)).getReal(), 4);
    assert.equal(value.minus(new Complex(1, -1)).getImaginary(), 5);
    close(value.multiply(2).getReal(), 6);
    close(value.multiply(new Complex(1, 1)).getReal(), -1);
    close(value.divide(2).getImaginary(), 2);
    close(value.divide(new Complex(1, 1)).getReal(), 3.5);
    close(new Complex(0, 1).powerAsBase(2).getReal(), -1);
    close(new Complex(3, 0).powerAsExponent(2).getReal(), 8);
    close(new Complex(8, 0).logarithmAsTruth(2).getReal(), 3);
    close(new Complex(2, 0).logarithmAsBase(8).getReal(), 3);
    const root = new Complex(3, 4).squareRoot();
    close(root.getReal(), 2);
    close(root.getImaginary(), 1);
    const negativeRoot = new Complex(-1, 0).squareRoot();
    close(negativeRoot.getReal(), 0, 1e-12);
    close(negativeRoot.getImaginary(), 1);
    assert.throws(() => new Complex(NaN, 0), TypeError);
    assert.throws(() => new Complex(0, 0).logarithm(), RangeError);
    assert.throws(() => new Complex(1, 2).divide(new Complex(0, 0)), RangeError);
    assert.throws(() => new Complex(0, 0).powerAsBase(0), RangeError);
    assert.throws(() => new Complex(1, 1).powerAsExponent(0), RangeError);
    assert.throws(() => new Complex(1, 1).logarithmAsTruth(1), RangeError);
});

test('complex similarity and tendency project direction and magnitude', () => {
    const similarity = new Complex(1, 0).similarity(new Complex(0, 1));
    close(similarity.getReal(), 0);
    close(similarity.getImaginary(), 1);
    const tendency = new Complex(2, 0).tendency(new Complex(0, 3));
    close(tendency.getReal(), 0);
    close(tendency.getImaginary(), 6);
});

test('frequency and omega convert into each other', () => {
    const tone = useHertz(440);
    close(tone.getPeriod(), 1 / 440);
    close(tone.getRadianPerSecond(), 880 * PI);
    close(tone.toOmega().getHertz(), 440);
    close(tone.toOmega().getRadianPerSecond(), 880 * PI);
    assert.ok(tone.transpose(12).equals(useHertz(880)));
    assert.throws(() => useHertz(-1), RangeError);
    assert.throws(() => new Frequency(NaN), TypeError);
    const omega = new Omega(useRadian(PI), 0.5);
    close(omega.getRadianPerSecond(), 2 * PI);
    close(omega.getHertz(), 1);
    close(omega.getPeriod(), 1);
    close(omega.phase(0.25).getValue(), PI / 2);
    close(omega.toFrequency().getHertz(), 1);
    assert.throws(() => new Omega(useRadian(1), 0), RangeError);
    assert.throws(() => new Omega(useRadian(1), Infinity), TypeError);
});

test('envelope holds constants and shapes attack-decay-sustain-release', () => {
    const constant = new Envelope(0.5);
    assert.equal(constant.at(3), 0.5);
    assert.ok(constant.isConstant());
    close(constant.derivate().at(5), 0);
    const adsr = Envelope.useADSR(0.1, 0.1, 0.6, 0.2, 0.6);
    close(adsr.at(0), 0);
    close(adsr.at(0.05), 0.5);
    close(adsr.at(0.15), 0.8);
    close(adsr.at(0.4), 0.6);
    close(adsr.at(0.5), 0.3);
    close(adsr.at(0.6), 0);
    close(adsr.at(-1), 0);
    close(adsr.scale(2).at(0.05), 1);
    close(new Envelope(2).multiply(new Envelope(3)).at(0), 6);
    close(new Envelope(2).plus(new Envelope(3)).at(0), 5);
    assert.throws(() => Envelope.useADSR(0.1, 0.1, 1.5, 0.1, 1), RangeError);
    assert.throws(() => Envelope.useADSR(1, 2, 0.5, 1, 2), RangeError);
    assert.throws(() => new Envelope(() => 1).getConstant(), RangeError);
    assert.throws(() => new Envelope(() => NaN).at(0), RangeError);
    assert.throws(() => constant.at(NaN), TypeError);
});

test('epicycle evaluates, differentiates and integrates term wise', () => {
    const oneTurn = Omega.useHertz(1);
    const epicycle = new Epicycle(new Envelope(1), oneTurn, useRadian(0));
    const value = epicycle.value(0.25);
    close(value.getReal(), 0, 1e-9);
    close(value.getImaginary(), 1, 1e-9);
    const derivativeAt = epicycle.derivate(0.25);
    close(derivativeAt.getReal(), -2 * PI, 1e-9);
    close(derivativeAt.getImaginary(), 0, 1e-9);
    const derivative = epicycle.derivate();
    close(derivative.getAmplitude().getConstant(), 2 * PI);
    close(derivative.value(0.25).getReal(), -2 * PI, 1e-9);
    const integral = epicycle.integral(0, 0.5);
    close(integral.getReal(), 0, 1e-9);
    close(integral.getImaginary(), 1 / PI, 1e-9);
    const antiderivative = epicycle.integral();
    close(antiderivative.value(0).getImaginary(), -1 / (2 * PI), 1e-9);
    close(antiderivative.value(0.5).getImaginary(), 1 / (2 * PI), 1e-9);
    assert.throws(() => new Epicycle({}, oneTurn, useRadian(0)), TypeError);
});

test('epicycle handles time-varying amplitudes numerically', () => {
    const oneTurn = Omega.useHertz(1);
    const dynamic = new Epicycle(new Envelope((time) => 1 + time), oneTurn, useRadian(0));
    close(dynamic.value(0.25).getReal(), 0, 1e-9);
    close(dynamic.value(0.25).getImaginary(), 1.25, 1e-9);
    assert.throws(() => dynamic.derivate(), RangeError);
    assert.throws(() => dynamic.integral(), RangeError);
    const integral = dynamic.integral(0, 1);
    close(integral.getReal(), 0, 1e-9);
    close(integral.getImaginary(), -1 / (2 * PI), 1e-9);
});

test('waveform sums, differentiates and integrates its epicycles', () => {
    const oneTurn = Omega.useHertz(1);
    const first = new Epicycle(new Envelope(1), oneTurn, useRadian(0));
    const second = new Epicycle(new Envelope(0.5), Omega.useHertz(2), useRadian(PI / 2));
    const waveform = new Waveform([first, second]);
    assert.equal(waveform.size(), 2);
    assert.ok(!waveform.isEmpty());
    assert.ok(waveform.value(0.25).equals(first.value(0.25).plus(second.value(0.25)), 1e-9));
    assert.ok(waveform.derivate(0.1).equals(first.derivate(0.1).plus(second.derivate(0.1)), 1e-9));
    assert.ok(waveform.derivate().value(0.1).equals(waveform.derivate(0.1), 1e-9));
    assert.ok(waveform.integral(0, 0.5).equals(first.integral(0, 0.5).plus(second.integral(0, 0.5)), 1e-9));
    assert.equal(waveform.append(first).size(), 3);
    assert.ok(new Waveform().isEmpty());
    assert.throws(() => new Waveform([{}]), TypeError);
});

test('sample plans expose rate, interval and frame times', () => {
    const sample = new Sample(4, 0.004);
    close(sample.getRate(), 1000);
    close(sample.getInterval(), 0.001);
    close(sample.getTime(3), 0.003);
    assert.equal(sample.getIndex(0.0035), 3);
    assert.throws(() => sample.getTime(4), RangeError);
    assert.throws(() => sample.getIndex(0.004), RangeError);
    assert.throws(() => new Sample(0, 1), RangeError);
    assert.throws(() => new Sample(1.5, 1), TypeError);
    assert.equal(Sample.useRate(1000, 0.004).getCount(), 4);
    assert.throws(() => Sample.useRate(-1, 1), RangeError);
});

test('tone shapes a carrier with its envelope', () => {
    const tone = new Tone(useHertz(440));
    close(tone.value(1 / 1760), 1);
    const faded = tone.withEnvelope(new Envelope(0.5));
    close(faded.value(1 / 1760), 0.5);
    close(tone.toEpicycle().value(0.25 / 440).getReal(), 1);
    assert.equal(tone.toWaveform().size(), 1);
    assert.ok(tone.transpose(12).getFrequency().equals(useHertz(880)));
    close(tone.transpose(12).value(1 / 3520), 1);
    assert.throws(() => new Tone({}), TypeError);
});

test('sampler evaluates tones, epicycles, waveforms and functions', () => {
    const sampler = new Sampler(new Sample(4, 0.004));
    const line = sampler.sample((time) => time);
    [0, 0.001, 0.002, 0.003].forEach((expected, index) => close(line[index], expected));
    close(sampler.sampleAt((time) => time * 2, 2), 0.004);
    const oneTurn = Omega.useHertz(1);
    const epicycle = new Epicycle(new Envelope(1), oneTurn, useRadian(0));
    const tone = new Tone(useHertz(440));
    const waveform = new Waveform([epicycle]);
    for (const source of [tone, epicycle, waveform]) {
        const frames = sampler.sample(source);
        assert.equal(frames.length, 4);
        frames.forEach((value, index) => {
            const time = sampler.getSample().getTime(index);
            const expected = source instanceof Tone ? source.value(time) : source.value(time).getReal();
            close(value, expected);
        });
    }
    assert.throws(() => sampler.sampleAt((time) => time, 4), RangeError);
    assert.throws(() => sampler.sample(() => NaN), RangeError);
    assert.throws(() => new Sampler({}), TypeError);
});
