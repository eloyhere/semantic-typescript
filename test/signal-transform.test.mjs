/**
 * Coverage for the ten spectral-transform families of the signal facades.
 *
 * Every family is checked four ways: the synchronous method against the
 * `Sampler` method that implements it, the synchronous factory against the same
 * reference, the asynchronous method against the synchronous result, and the
 * asynchronous factory against that same result. All comparisons are bin for bin
 * on fixed records, so a method wired to the wrong transform, or a facade that
 * stopped delegating, fails on a value rather than on a missing member.
 *
 * The boundary block pins the wavelet depth, the quadrature length and the
 * one-source contract that every transform collector shares.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    AsynchronousSignalCollectable, SynchronousSignalCollectable,
    useAsynchronousBlueStein, useAsynchronousDiscreteFourierTransform,
    useAsynchronousFastFourierTransform, useAsynchronousLaplacianTransform,
    useAsynchronousMeilinTransform, useAsynchronousRadix2, useAsynchronousRadix3,
    useAsynchronousRadix5, useAsynchronousRadix7, useAsynchronousWaveletTransform,
    useSynchronousBlueStein, useSynchronousDiscreteFourierTransform,
    useSynchronousFastFourierTransform, useSynchronousLaplacianTransform,
    useSynchronousMeilinTransform, useSynchronousRadix2, useSynchronousRadix3,
    useSynchronousRadix5, useSynchronousRadix7, useSynchronousWaveletTransform,
} from '../dist/index.js';
import { Sample } from '../dist/mathematics/sample.js';
import { Sampler } from '../dist/mathematics/sampler.js';

const RATE = 64;
const epsilon = 1E-9;

/** Asserts that a value equals an expectation within a tolerance. */
const close = (actual, expected, tolerance = epsilon, label = 'value') =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} is not within ${tolerance} of ${expected}`);

/**
 * Builds a deterministic record with energy on the third and fifth bin.
 *
 * The two tones are placed on exact bins of the record, so the transforms keep
 * a small and reproducible set of non-negligible coefficients.
 */
const record = (count) => Array.from({ length: count }, (_, index) =>
    Math.cos(2 * Math.PI * 3 * index / count) + 0.25 * Math.sin(2 * Math.PI * 5 * index / count));

/**
 * Builds the continuous source a signal presents to the sampler.
 *
 * The sampler evaluates a source at `index / rate` and the quadrature
 * transforms append one probe at the plan duration, so rounding recovers the
 * index and clamping to the record reproduces the facade contract exactly.
 */
const sourceOf = (values, rate) => (time) =>
    values[Math.max(0, Math.min(values.length - 1, Math.round(time * rate)))];

/** Builds the plan, the source, the sampler and both signals of one record. */
const fixture = (count) => {
    const values = record(count);
    const plan = new Sample(count, count / RATE);
    const source = sourceOf(values, RATE);
    return {
        count,
        values,
        plan,
        source,
        sampler: new Sampler(plan),
        synchronous: new SynchronousSignalCollectable(plan, values),
        asynchronous: new AsynchronousSignalCollectable(plan, values),
    };
};

/** Wraps sources in the asynchronous iterable an asynchronous collector takes. */
const streamOf = async function* (...sources) {
    for (const source of sources) {
        yield source;
    }
};

/** Reduces a spectrum to frequency, real part and imaginary part per bin. */
const binsOf = (spectrum) => spectrum.getBins().map((bin) => [
    bin.getFrequency().getHertz(), bin.getAmplitude().getReal(), bin.getAmplitude().getImaginary(),
]);

/** Reduces a wavelet decomposition to the coefficients of every level. */
const levelsOf = (levels) => levels.map((level) => [
    Array.from(level.approximation), Array.from(level.detail),
]);

/** Reduces complex values to real part and imaginary part. */
const complexOf = (values) => values.map((value) => [value.getReal(), value.getImaginary()]);

/**
 * The ten transform families and the record each one needs.
 *
 * `count` is a power of the radix for the pure-radix transforms, because the
 * sampler rejects any other frame count, and a plain count for the transforms
 * that accept every length. `extra` holds the factory arguments that follow the
 * sampler, which only the two quadrature transforms use.
 */
const TRANSFORMS = [
    {
        name: 'radix2', count: 16, extra: [], read: binsOf,
        synchronous: useSynchronousRadix2, asynchronous: useAsynchronousRadix2,
    },
    {
        name: 'radix3', count: 9, extra: [], read: binsOf,
        synchronous: useSynchronousRadix3, asynchronous: useAsynchronousRadix3,
    },
    {
        name: 'radix5', count: 25, extra: [], read: binsOf,
        synchronous: useSynchronousRadix5, asynchronous: useAsynchronousRadix5,
    },
    {
        name: 'radix7', count: 49, extra: [], read: binsOf,
        synchronous: useSynchronousRadix7, asynchronous: useAsynchronousRadix7,
    },
    {
        name: 'blueStein', count: 15, extra: [], read: binsOf,
        synchronous: useSynchronousBlueStein, asynchronous: useAsynchronousBlueStein,
    },
    {
        name: 'discreteFourierTransform', count: 15, extra: [], read: binsOf,
        synchronous: useSynchronousDiscreteFourierTransform, asynchronous: useAsynchronousDiscreteFourierTransform,
    },
    {
        name: 'fastFourierTransform', count: 15, extra: [], read: binsOf,
        synchronous: useSynchronousFastFourierTransform, asynchronous: useAsynchronousFastFourierTransform,
    },
    {
        name: 'waveletTransform', count: 16, extra: [], read: levelsOf,
        synchronous: useSynchronousWaveletTransform, asynchronous: useAsynchronousWaveletTransform,
    },
    {
        name: 'laplacianTransform', count: 15, extra: [[1, 2]], read: complexOf,
        synchronous: useSynchronousLaplacianTransform, asynchronous: useAsynchronousLaplacianTransform,
    },
    {
        name: 'meilinTransform', count: 15, extra: [[1, 2]], read: complexOf,
        synchronous: useSynchronousMeilinTransform, asynchronous: useAsynchronousMeilinTransform,
    },
];

test('both facades expose the ten transform methods and their twenty factories', () => {
    for (const transform of TRANSFORMS) {
        assert.equal(typeof SynchronousSignalCollectable.prototype[transform.name], 'function', transform.name);
        assert.equal(typeof AsynchronousSignalCollectable.prototype[transform.name], 'function', transform.name);
    }
    const factories = TRANSFORMS.flatMap((transform) => [transform.synchronous, transform.asynchronous]);
    assert.equal(factories.length, 20);
    for (const factory of factories) {
        assert.equal(typeof factory, 'function');
    }
    assert.equal(new Set(factories).size, 20, 'every transform must own a distinct factory');
});

for (const transform of TRANSFORMS) {
    test(`${transform.name}: the method and the factory reproduce Sampler.${transform.name}`, () => {
        const data = fixture(transform.count);
        const expected = transform.read(data.sampler[transform.name](data.source, ...transform.extra));

        assert.deepEqual(transform.read(data.synchronous[transform.name](...transform.extra)), expected);

        const collected = transform.synchronous(new Sampler(data.plan), ...transform.extra).collect([data.source]);
        assert.deepEqual(transform.read(collected), expected);
    });

    test(`${transform.name}: the asynchronous method and factory match the synchronous result`, async () => {
        const data = fixture(transform.count);
        const expected = transform.read(data.synchronous[transform.name](...transform.extra));

        assert.deepEqual(transform.read(await data.asynchronous[transform.name](...transform.extra)), expected);

        const collected = await transform.asynchronous(new Sampler(data.plan), ...transform.extra).collect(streamOf(data.source));
        assert.deepEqual(transform.read(collected), expected);
    });
}

test('the transform bins carry the expected signal and agree across paths', () => {
    const cosine = Array.from({ length: 16 }, (_, index) => Math.cos(2 * Math.PI * 3 * index / 16));
    const data = new SynchronousSignalCollectable(new Sample(16, 16 / RATE), cosine);
    const spectrum = data.radix2();

    // A cosine on bin three of sixteen is a pair of conjugate peaks of N / 2.
    close(spectrum.getBins()[3].magnitude(), 8, 1E-9, 'bin 3');
    close(spectrum.getBins()[13].magnitude(), 8, 1E-9, 'bin 13');
    for (const index of [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15]) {
        assert.ok(spectrum.getBins()[index].magnitude() < 1E-9, `bin ${index} is not empty`);
    }
    close(spectrum.frequencyAt(3).get().getHertz(), 3 * RATE / 16, 1E-12, 'bin 3 frequency');

    // The mixed-radix, Bluestein and direct paths implement the same transform.
    const direct = data.discreteFourierTransform();
    const bluestein = data.blueStein();
    const fast = data.fastFourierTransform();
    for (const other of [direct, bluestein, fast]) {
        assert.equal(other.size(), spectrum.size());
        for (let index = 0; index < spectrum.size(); index += 1) {
            assert.ok(spectrum.amplitudeAt(index).get().equals(other.amplitudeAt(index).get(), 1E-9),
                `bin ${index} disagrees between paths`);
        }
    }
});

test('an eight-point record yields three wavelet levels and two quadrature values', () => {
    const data = fixture(8);

    const levels = data.synchronous.waveletTransform();
    assert.equal(levels.length, 3);
    assert.deepEqual(levels.map((level) => level.approximation.length), [4, 2, 1]);
    assert.deepEqual(levels.map((level) => level.detail.length), [4, 2, 1]);

    assert.equal(data.synchronous.laplacianTransform([1, 2]).length, 2);
    assert.equal(data.synchronous.meilinTransform([1, 2]).length, 2);
});

test('the wavelet decomposition halves each level by the Haar rule', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8];
    const signal = new SynchronousSignalCollectable(new Sample(8, 1), values);
    const levels = signal.waveletTransform();
    const root = Math.SQRT2;

    assert.equal(levels.length, 3);
    for (let index = 0; index < 4; index += 1) {
        close(levels[0].approximation[index], (values[2 * index] + values[2 * index + 1]) / root, 1E-12, `approximation 0/${index}`);
        close(levels[0].detail[index], -1 / root, 1E-12, `detail 0/${index}`);
    }
    close(levels[1].approximation[0], 5, 1E-12, 'approximation 1/0');
    close(levels[1].approximation[1], 13, 1E-12, 'approximation 1/1');
    close(levels[1].detail[0], -2, 1E-12, 'detail 1/0');
    close(levels[1].detail[1], -2, 1E-12, 'detail 1/1');
    close(levels[2].approximation[0], 9 * root, 1E-12, 'approximation 2/0');
    close(levels[2].detail[0], -4 * root, 1E-12, 'detail 2/0');

    // The depth is capped by the frame count, defaults to the maximum and must
    // be a positive integer.
    assert.equal(signal.waveletTransform(2).length, 2);
    assert.deepEqual(signal.waveletTransform(2).map((level) => level.approximation.length), [4, 2]);
    assert.throws(() => signal.waveletTransform(4), RangeError);
    assert.throws(() => signal.waveletTransform(0), TypeError);
    assert.throws(() => signal.waveletTransform(1.5), TypeError);
});

test('the quadrature transforms integrate the power and exponential kernels', () => {
    const signal = new SynchronousSignalCollectable(new Sample(8, 1), new Array(8).fill(1));
    const sampler = new Sampler(new Sample(8, 1));
    const ones = () => 1;

    const meilin = signal.meilinTransform([1, 2]);
    assert.equal(meilin.length, 2);
    close(meilin[0].getReal(), 1, 1E-12, 'meilin parameter 1');
    close(meilin[1].getReal(), 0.5, 1E-12, 'meilin parameter 2');
    for (const value of meilin) {
        close(value.getImaginary(), 0, 1E-12, 'meilin imaginary part');
    }
    assert.deepEqual(complexOf(meilin), complexOf(sampler.meilinTransform(ones, [1, 2])));

    const laplacian = signal.laplacianTransform([1, 2]);
    assert.equal(laplacian.length, 2);
    for (const value of laplacian) {
        close(value.getImaginary(), 0, 1E-12, 'laplacian imaginary part');
        assert.ok(value.getReal() > 0, 'the exponential kernel of a constant is positive');
    }
    assert.ok(laplacian[0].getReal() > laplacian[1].getReal(), 'the kernel decays with the parameter');
    close(laplacian[0].getReal(), 1 - Math.exp(-1), 1E-2, 'laplacian parameter 1');
    close(laplacian[1].getReal(), (1 - Math.exp(-2)) / 2, 1E-2, 'laplacian parameter 2');
    assert.deepEqual(complexOf(laplacian), complexOf(sampler.laplacianTransform(ones, [1, 2])));
});

test('every transform factory rejects zero or several sources with a RangeError', async () => {
    for (const transform of TRANSFORMS) {
        const data = fixture(transform.count);
        const single = /exactly one source/;
        const many = [data.source, data.source];

        assert.throws(
            () => transform.synchronous(new Sampler(data.plan), ...transform.extra).collect([]),
            { name: 'RangeError', message: single },
            `${transform.name} accepts no source synchronously`,
        );
        assert.throws(
            () => transform.synchronous(new Sampler(data.plan), ...transform.extra).collect(many),
            { name: 'RangeError', message: single },
            `${transform.name} accepts two sources synchronously`,
        );
        await assert.rejects(
            transform.asynchronous(new Sampler(data.plan), ...transform.extra).collect(streamOf()),
            { name: 'RangeError', message: single },
            `${transform.name} accepts no source asynchronously`,
        );
        await assert.rejects(
            transform.asynchronous(new Sampler(data.plan), ...transform.extra).collect(streamOf(...many)),
            { name: 'RangeError', message: single },
            `${transform.name} accepts two sources asynchronously`,
        );
    }
});

test('the radix transforms keep the sampler frame-count validation', () => {
    const data = fixture(15);
    const sampler = () => new Sampler(data.plan);

    assert.throws(() => data.synchronous.radix2(), RangeError);
    assert.throws(() => data.synchronous.radix3(), RangeError);
    assert.throws(() => data.synchronous.radix5(), RangeError);
    assert.throws(() => data.synchronous.radix7(), RangeError);
    assert.throws(() => useSynchronousRadix2(sampler()).collect([data.source]), /power of 2/);
    assert.throws(() => useSynchronousRadix3(sampler()).collect([data.source]), /power of 3/);
    assert.throws(() => useSynchronousRadix5(sampler()).collect([data.source]), /power of 5/);
    assert.throws(() => useSynchronousRadix7(sampler()).collect([data.source]), /power of 7/);
    assert.throws(() => data.synchronous.waveletTransform(), RangeError);

    // The transforms that accept every count must still succeed on this record.
    assert.equal(data.synchronous.blueStein().size(), 15);
    assert.equal(data.synchronous.discreteFourierTransform().size(), 15);
    assert.equal(data.synchronous.fastFourierTransform().size(), 15);
});
