import test from 'node:test';
import assert from 'node:assert/strict';
import { useRadian } from '../dist/mathematics/angle.js';
import { Complex } from '../dist/mathematics/complex.js';
import { useHertz } from '../dist/mathematics/frequency.js';
import { useField } from '../dist/mathematics/field.js';
import { Sample } from '../dist/mathematics/sample.js';
import {
    AsynchronousCycle, AsynchronousList, SynchronousCycle, SynchronousList,
    combineCycles, useAngularSpectrum,
} from '../dist/index.js';

const Turn = Math.PI * 2;
const Third = Turn / 3;
const Quarter = Math.PI / 2;

const totalOf = phasors => phasors.reduce((acc, value) => acc.plus(value), new Complex(0, 0));

test('a synchronous cycle is a list whose positions sample one phasor each', () => {
    const cycle = new SynchronousCycle(['a', 'b', 'c']);

    assert.ok(cycle instanceof SynchronousList);
    assert.equal(cycle.constructor, SynchronousCycle);
    assert.equal(cycle.size(), 3n);
    assert.deepEqual(cycle.toArray(), ['a', 'b', 'c']);
    assert.deepEqual([...cycle], ['a', 'b', 'c']);
    assert.equal(cycle.getSpan(), 1);

    const first = cycle.elementAt(0n).get();
    assert.equal(first.element, 'a');
    assert.ok(first.phase.equals(useRadian(0)));
    assert.ok(first.frequency.equals(useHertz(0)));
    assert.ok(first.complex.equals(new Complex(1, 0)));

    const second = cycle.elementAt(1n).get();
    assert.equal(second.element, 'b');
    assert.ok(second.phase.equals(useRadian(Third)));
    assert.ok(second.complex.equals(new Complex(-0.5, Math.sqrt(3) / 2)));

    assert.ok(cycle.phaseAt(2n).get().equals(useRadian(2 * Third)));
    assert.ok(cycle.frequencyAt(2n).get().equals(useHertz(0)));
    assert.ok(cycle.getPhase().equals(useRadian(0)));
    assert.ok(cycle.getFrequency().equals(useHertz(0)));
});

test('the ambient frequency rotates the ring without changing its intrinsic phases', () => {
    const still = new SynchronousCycle(['a', 'b', 'c']);
    const moving = new SynchronousCycle(['a', 'b', 'c'], { frequency: useHertz(1) });

    for (const index of [0n, 1n, 2n]) {
        assert.ok(moving.phaseAt(index).get().equals(still.phaseAt(index).get()));
        assert.ok(moving.toComplex(index).get().equals(still.toComplex(index).get()));
    }
    assert.ok(moving.getFrequency().equals(useHertz(1)));
    // One eighth of a second at one hertz advances the environment by an eighth of a turn.
    assert.ok(moving.relativeAt(0n, 0.125).get().equals(useRadian(-Math.PI / 4)));
    assert.ok(moving.relativeAt(1n, 0.0).get().equals(useRadian(Third)));
});

test('sampling wraps around the joined head and tail, forwards and backwards', () => {
    const cycle = new SynchronousCycle(['a', 'b', 'c']);

    // The successor of the tail is the head, so the first position repeats exactly.
    assert.equal(cycle.elementAt(3n).get().element, 'a');
    assert.equal(cycle.phaseAt(3n).get().getValue(), cycle.phaseAt(0n).get().getValue());
    // The predecessor of the head is the tail.
    assert.equal(cycle.elementAt(-1n).get().element, 'c');
    assert.ok(cycle.phaseAt(-1n).get().equals(useRadian(2 * Third)));
    assert.equal(cycle.elementAt(4n).get().element, 'b');
    assert.equal(cycle.elementAt(-4n).get().element, 'c');
    assert.equal(cycle.elementAt(1_000_003n).get().element, 'b');
});

test('the ring is exactly n-periodic, even far beyond the exact integer range', () => {
    const cycle = new SynchronousCycle(['a', 'b', 'c', 'd', 'e', 'f']);

    for (const index of [0n, 1n, -1n, 7n, 9007199254740993n, 123456789012345678901n]) {
        const here = cycle.phaseAt(index).get();
        const next = cycle.phaseAt(index + 6n).get();
        assert.equal(here.getValue(), next.getValue());
        assert.equal(cycle.elementAt(index).get().element, cycle.elementAt(index + 6n).get().element);
    }
    // 2^53 + 1 = 3 (mod 6), so it lands on the fourth position.
    assert.equal(cycle.elementAt(9007199254740993n).get().element, 'd');
    assert.ok(cycle.phaseAt(9007199254740993n).get().equals(useRadian(Math.PI)));
});

test('an empty cycle has no samples and malformed indices raise TypeError', () => {
    const empty = new SynchronousCycle();

    for (const index of [0n, 1n, -1n]) {
        assert.equal(empty.elementAt(index).isEmpty(), true);
        assert.equal(empty.phaseAt(index).isEmpty(), true);
        assert.equal(empty.frequencyAt(index).isEmpty(), true);
        assert.equal(empty.toComplex(index).isEmpty(), true);
        assert.equal(empty.zeroSequence().isEmpty(), true);
        assert.equal(empty.relativeAt(index, 0).isEmpty(), true);
    }
    assert.deepEqual(empty.toComplex(), []);
    assert.deepEqual(empty.sequences(), []);
    assert.equal(empty.purity(), 0);
    assert.equal(empty.isBalanced(), false);

    const cycle = new SynchronousCycle([1]);
    assert.throws(() => cycle.elementAt(0), TypeError);
    assert.throws(() => cycle.phaseAt(0), TypeError);
    assert.throws(() => cycle.toComplex(0), TypeError);
    assert.throws(() => cycle.relativeAt(0, 1), TypeError);
});

test('the positional list operations stay bounded by the ring size', () => {
    const cycle = new SynchronousCycle(['a', 'b']);

    assert.equal(cycle.get(1n), 'b');
    assert.throws(() => cycle.get(2n), RangeError);
    assert.throws(() => cycle.get(-1n), RangeError);
    assert.throws(() => cycle.removeAt(2n), RangeError);
});

test('toComplex maps every element to a unit phasor in ring order', () => {
    const cycle = new SynchronousCycle(['a', 'b', 'c', 'd']);
    const phasors = cycle.toComplex();

    assert.equal(phasors.length, 4);
    assert.ok(phasors[0].equals(new Complex(1, 0)));
    assert.ok(phasors[1].equals(new Complex(0, 1)));
    assert.ok(phasors[2].equals(new Complex(-1, 0)));
    assert.ok(phasors[3].equals(new Complex(0, -1)));
});

test('a phase anchor offsets every sample', () => {
    const cycle = new SynchronousCycle([0, 1], { phase: useRadian(Math.PI / 4) });

    assert.ok(cycle.phaseAt(0n).get().equals(useRadian(Math.PI / 4)));
    assert.ok(cycle.phaseAt(1n).get().equals(useRadian(Math.PI / 4 + Math.PI)));
    assert.ok(cycle.toComplex()[0].equals(new Complex(Math.SQRT1_2, Math.SQRT1_2)));
});

test('magnitude scales the phasor without changing the phase', () => {
    const cycle = new SynchronousCycle([1, 2, 4], { magnitude: element => element });

    assert.ok(cycle.toComplex(0n).get().equals(new Complex(1, 0)));
    assert.ok(cycle.toComplex(1n).get().equals(new Complex(-1, Math.sqrt(3))));
    assert.ok(cycle.phaseAt(1n).get().equals(useRadian(Third)));
});

test('a balanced ring carries one mode, a scattered magnitude does not', () => {
    for (let size = 2; size <= 12; size++) {
        const cycle = new SynchronousCycle(Array.from({ length: size }, (_, index) => index));
        const phasors = cycle.toComplex();

        assert.ok(totalOf(phasors).magnitude() <= 1e-9 * size, `size ${size} total`);
        assert.ok(Math.abs(cycle.purity() - 1) < 1e-9, `size ${size} purity`);
        assert.equal(cycle.isBalanced(), true);

        const sequences = cycle.sequences();
        assert.equal(sequences.length, size);
        for (let order = 0; order < size; order++) {
            if (order === 1) {
                assert.ok(Math.abs(sequences[order].magnitude() - size) < 1e-9);
            } else {
                assert.ok(sequences[order].magnitude() < 1e-9, `size ${size} order ${order}`);
            }
        }
        assert.ok(cycle.zeroSequence().get().magnitude() < 1e-9);
    }

    const weighted = new SynchronousCycle([1, 2, 4], { magnitude: element => element });
    assert.equal(weighted.isBalanced(), false);
    assert.ok(weighted.purity() < 1);
    assert.ok(weighted.zeroSequence().get().magnitude() > 0);
});

test('a span sharing a factor with the size collapses the orbit', () => {
    const folded = new SynchronousCycle(['a', 'b', 'c', 'd'], { span: 2 });

    // With four positions over two turns every other position coincides.
    assert.ok(folded.phaseAt(0n).get().equals(useRadian(0)));
    assert.ok(folded.phaseAt(1n).get().equals(useRadian(Math.PI)));
    assert.ok(folded.phaseAt(2n).get().equals(useRadian(0)));
    assert.equal(folded.isBalanced(), false);

    const whole = new SynchronousCycle(['a', 'b', 'c'], { span: 2 });
    // Three positions over two turns still visits every third of the circle.
    assert.equal(whole.isBalanced(), true);
});

test('balance heals itself after a structural change', () => {
    const cycle = new SynchronousCycle(['a', 'b', 'c']);
    assert.equal(cycle.isBalanced(), true);

    cycle.add(1n, 'x');
    assert.equal(cycle.size(), 4n);
    assert.equal(cycle.isBalanced(), true);
    assert.ok(cycle.phaseAt(1n).get().equals(useRadian(Quarter)));

    cycle.remove('x');
    assert.equal(cycle.isBalanced(), true);
    assert.ok(cycle.phaseAt(1n).get().equals(useRadian(Third)));

    cycle.clear();
    assert.equal(cycle.isBalanced(), false);
});

test('a bounded field scores every position within the closed unit interval', () => {
    const cosine = useField([1]);
    assert.equal(cosine.getOrder(), 1);
    assert.equal(cosine.getBudget(), 1);
    assert.ok(Math.abs(cosine.sample(useRadian(0)) - 1) < 1e-12);
    assert.ok(Math.abs(cosine.sample(useRadian(Math.PI)) + 1) < 1e-12);
    assert.ok(Math.abs(cosine.sample(useRadian(Quarter))) < 1e-12);

    const mixed = useField([0.4, 0.3, 0.3]);
    for (let step = 0; step < 720; step++) {
        const value = mixed.sample(useRadian(Turn * step / 720));
        assert.ok(value >= -1 && value <= 1, `step ${step} scored ${value}`);
    }

    assert.throws(() => useField([0.8, 0.8]), RangeError);
    assert.throws(() => useField([1], 1), RangeError);
    assert.throws(() => useField([Number.NaN]), TypeError);
    assert.throws(() => useField([1], Number.POSITIVE_INFINITY), TypeError);
    assert.throws(() => useField(null), TypeError);

    const constant = useField([], 0.25);
    assert.equal(constant.getOrder(), 0);
    assert.equal(constant.sample(useRadian(1)), 0.25);
    assert.ok(constant.equals(useField([], 0.25)));
    assert.equal(constant.equals(useField([0])), false);
    assert.equal(String(useField([0.5])), '0.5cos1');
});

test('the mean score of a balanced ring vanishes, and the field leaves it alone', () => {
    const field = useField([1]);
    const cycle = new SynchronousCycle(['a', 'b', 'c', 'd', 'e']);

    for (const time of [0, 0.125, 0.5, 1.75]) {
        const scores = cycle.scoresAt(time, field);
        assert.equal(scores.length, 5);
        for (const score of scores) assert.ok(score >= -1 && score <= 1);
        const mean = scores.reduce((acc, value) => acc + value, 0) / scores.length;
        assert.ok(Math.abs(mean) < 1e-9, `time ${time} mean ${mean}`);
    }

    // The first position starts aligned, so it scores one before the environment moves.
    assert.ok(Math.abs(cycle.scoreAt(0n, 0, field).get() - 1) < 1e-12);

    const moving = new SynchronousCycle(['a', 'b', 'c', 'd'], { frequency: useHertz(1) });
    // A quarter second at one hertz advances the environment by a quarter turn.
    assert.ok(Math.abs(moving.scoreAt(0n, 0.25, field).get() - 0) < 1e-12);
    assert.ok(Math.abs(moving.scoreAt(1n, 0, field).get() - 0) < 1e-12);
});

test('per-element rates let the ring drift against the environment', () => {
    const marker = new SynchronousCycle(['a', 'b', 'c', 'd'], { frequency: useHertz(1) });
    const rotor = new SynchronousCycle(['a', 'b', 'c', 'd'], {
        frequency: useHertz(1),
        rate: () => useHertz(2),
    });

    assert.ok(marker.jetAt(0n, 0).get().rate.equals(useHertz(0)));
    assert.equal(marker.jetAt(0n, 0).get().slip, -1);
    assert.equal(rotor.jetAt(0n, 0).get().slip, 1);
    assert.ok(rotor.jetAt(0n, 0).get().rate.equals(useHertz(2)));

    assert.equal(marker.windingAt(0n, 2).get(), -2n);
    assert.equal(rotor.windingAt(0n, 2).get(), 2n);

    assert.ok(Math.abs(marker.errorIntegralAt(0n, 2).get() + 2) < 1e-12);
    assert.ok(Math.abs(rotor.errorIntegralAt(0n, 2).get() - 2) < 1e-12);
});

test('a view reports the element phase, its relative phase and its rate', () => {
    const rotor = new SynchronousCycle(['a', 'b', 'c', 'd'], {
        frequency: useHertz(1),
        rate: () => useHertz(2),
    });

    const view = rotor.viewAt(1n, 0.5).get();
    assert.equal(view.element, 'b');
    assert.equal(view.index, 1n);
    assert.equal(view.time, 0.5);
    // 90 degrees plus two turns of its own motion lands back on a quarter turn.
    assert.ok(view.phase.equals(useRadian(Quarter)));
    // The environment advanced half a turn, so the relative phase is a quarter turn back.
    assert.ok(view.relative.equals(useRadian(-Quarter)));
    assert.ok(view.rate.equals(useHertz(2)));

    const views = rotor.viewsAt(0);
    assert.equal(views.length, 4);
    assert.ok(views[2].phase.equals(useRadian(Math.PI)));
    assert.ok(views[2].relative.equals(useRadian(Math.PI)));
});

test('winding counts whole turns only, in the direction of travel', () => {
    const half = new SynchronousCycle(['a', 'b'], { frequency: useHertz(1), rate: () => useHertz(0.5) });

    assert.equal(half.jetAt(0n, 0).get().slip, -0.5);
    assert.equal(half.windingAt(0n, 1).get(), 0n);
    assert.equal(half.windingAt(0n, 2).get(), -1n);
    assert.equal(half.windingAt(0n, 5).get(), -2n);
});

test('the accumulated error integral matches the analytic integral', () => {
    const cycle = new SynchronousCycle(['a', 'b'], { frequency: useHertz(1), rate: () => useHertz(3) });

    // Position one starts half a turn ahead and slips two turns per second.
    assert.ok(Math.abs(cycle.errorIntegralAt(1n, 2).get() - 5) < 1e-9);
    assert.ok(Math.abs(cycle.errorIntegralAt(1n, 2, 1).get() - 3.5) < 1e-9);
    assert.ok(Math.abs(cycle.errorIntegralAt(1n, 0).get()) < 1e-12);
});

test('the resultant starts at zero for a balanced ring and grows as rates differ', () => {
    const still = new SynchronousCycle(['a', 'b', 'c', 'd', 'e', 'f']);
    assert.ok(still.resultant().get() < 1e-9);
    assert.ok(still.resultant(0).get() < 1e-9);

    const rotor = new SynchronousCycle(['a', 'b', 'c', 'd', 'e', 'f'], {
        frequency: useHertz(1),
        rate: (element, index) => useHertz(1 + Number(index) * 0.05),
    });
    assert.ok(rotor.resultant(0).get() < 1e-9);
    // Differing rates de-phase the ring, so the resultant leaves zero.
    assert.ok(rotor.resultant(1).get() > 1e-3);
    assert.ok(rotor.resultant(1).get() <= 1);
});

test('drifting rates move the scores even when the intrinsic ring is balanced', () => {
    const field = useField([1]);
    const rotor = new SynchronousCycle(['a', 'b', 'c', 'd'], {
        frequency: useHertz(1),
        rate: () => useHertz(2),
    });

    // Between the two instants every relative phase turns by one half turn.
    const before = rotor.scoresAt(0, field);
    const after = rotor.scoresAt(0.5, field);
    for (let position = 0; position < before.length; position++) {
        assert.ok(Math.abs(before[position] + after[position]) < 1e-12);
    }

    assert.throws(() => new SynchronousCycle([], { rate: 1 }), TypeError);
    assert.throws(() => new SynchronousCycle([1], { rate: () => 1 }).jetAt(0n, 0), TypeError);
});

test('the ring is an insertion-ordered set and rejects duplicates', () => {
    const cycle = new SynchronousCycle(['a', 'b', 'c']);

    assert.equal(cycle.add('b'), false);
    assert.equal(cycle.size(), 3n);
    assert.equal(cycle.add('d'), true);
    assert.deepEqual(cycle.toArray(), ['a', 'b', 'c', 'd']);

    // A duplicate is rejected before the links change, whatever the position.
    cycle.add(0n, 'd');
    assert.deepEqual(cycle.toArray(), ['a', 'b', 'c', 'd']);
    assert.throws(() => cycle.set(0n, 'd'), RangeError);
    assert.deepEqual(cycle.toArray(), ['a', 'b', 'c', 'd']);

    // The constructor source keeps first occurrences only.
    assert.deepEqual(new SynchronousCycle(['x', 'y', 'x', 'z', 'y']).toArray(), ['x', 'y', 'z']);

    // A replacement that collapses values keeps the ring unique as well.
    const collapsed = new SynchronousCycle([1, 2, 3]);
    collapsed.replaceAll(() => 1);
    assert.deepEqual(collapsed.toArray(), [1]);

    // Two NaN values count as the same element.
    const numeric = new SynchronousCycle([Number.NaN, 1]);
    assert.equal(numeric.add(Number.NaN), false);
    assert.equal(numeric.size(), 2n);
});

test('analyse measures data against every ring element as a reference phase', () => {
    const ring = new SynchronousCycle(['a', 'b', 'c', 'd', 'e']);
    const analysis = ring.analyse(['a', 'c', 'c', 'a', 'zz', 'e']);

    assert.equal(analysis.size, 5);
    assert.equal(analysis.total, 6);
    assert.equal(analysis.matched, 5);
    assert.equal(analysis.missed, 1);
    assert.equal(analysis.readings.length, 5);

    assert.deepEqual(analysis.readings.map(reading => reading.element), ['a', 'c', 'c', 'a', 'e']);
    assert.deepEqual(analysis.readings.map(reading => reading.index), [0n, 2n, 2n, 0n, 4n]);
    assert.ok(analysis.readings[1].phase.equals(useRadian(2 * Turn / 5)));

    assert.deepEqual(analysis.references.map(reference => reference.count), [2, 0, 2, 0, 1]);
    assert.deepEqual(analysis.references.map(reference => reference.element), ['a', 'b', 'c', 'd', 'e']);

    // Rotating the baseline cannot change the concentration, only the mean.
    const first = analysis.references[0].resultant;
    for (const reference of analysis.references) {
        assert.ok(Math.abs(reference.resultant - first) < 1e-12);
        assert.ok(reference.resultant >= 0 && reference.resultant <= 1);
    }
    for (const reference of analysis.references) {
        const shift = analysis.references[0].mean.get().minus(reference.mean.get());
        assert.ok(shift.equals(ring.phaseAt(reference.index).get()));
    }

    // A single reference carrying every observation is fully concentrated.
    const single = new SynchronousCycle(['a']).analyse(['a', 'a', 'a']);
    assert.equal(single.references[0].count, 3);
    assert.ok(Math.abs(single.references[0].resultant - 1) < 1e-12);
    assert.ok(single.references[0].mean.get().equals(useRadian(0)));

    // With no matched observation there is nothing to average.
    const none = ring.analyse([]);
    assert.equal(none.matched, 0);
    assert.equal(none.missed, 0);
    assert.equal(none.references[0].mean.isEmpty(), true);
    assert.equal(none.references[0].resultant, 0);

    const allMissed = ring.analyse(['zz']);
    assert.equal(allMissed.matched, 0);
    assert.equal(allMissed.missed, 1);
    assert.equal(allMissed.readings.length, 0);

    assert.throws(() => ring.analyse(null), TypeError);
    assert.throws(() => ring.analyse([], Number.NaN), TypeError);
});

test('an asynchronous cycle analyses data asynchronously', async () => {
    const cycle = new AsynchronousCycle(['a', 'b', 'c']);

    const analysis = await cycle.analyse(['a', 'c', 'c', 'zz']);
    assert.equal(analysis.matched, 3);
    assert.equal(analysis.missed, 1);
    assert.deepEqual(analysis.references.map(reference => reference.count), [1, 0, 2]);

    const element = cycle.elementAt(2n);
    assert.equal((await element).get().element, 'c');
});

test('combining two cycles takes the least common multiple, not the product', () => {
    const branches = new SynchronousCycle(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);
    const stems = new SynchronousCycle(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);

    const joint = combineCycles(branches, stems);
    assert.equal(joint.period, 60n);
    assert.equal(joint.divisor, 2n);
    assert.equal(joint.cycle.size(), 60n);
    assert.equal(joint.cycle.isBalanced(), true);

    const pairs = joint.cycle.toArray();
    assert.deepEqual(pairs[0], ['子', '甲']);
    assert.deepEqual(pairs[1], ['丑', '乙']);
    assert.deepEqual(pairs[59], ['亥', '癸']);
    // Only sixty of the hundred and twenty pairs can be reached.
    assert.equal(new Set(pairs.map(pair => pair.join(''))).size, 60);

    // The compatibility test is the parity condition the joint ring enforces.
    assert.equal(joint.aligns(0n, 2n), true);
    assert.equal(joint.aligns(1n, 3n), true);
    assert.equal(joint.aligns(0n, 1n), false);
    assert.equal(joint.aligns(5n, 0n), false);
    assert.throws(() => joint.aligns(0, 1), TypeError);

    // Coprime lengths leave no pair unreachable, so the product is recovered.
    const coprime = combineCycles(new SynchronousCycle([0, 1, 2]), new SynchronousCycle([7, 8, 9, 10]));
    assert.equal(coprime.period, 12n);
    assert.equal(coprime.divisor, 1n);
    assert.equal(coprime.cycle.size(), 12n);
    assert.equal(coprime.aligns(0n, 3n), true);

    assert.throws(() => combineCycles(new SynchronousCycle(), stems), RangeError);
    assert.throws(() => combineCycles({}, stems), TypeError);
});

test('the spatial spectrum exposes the ring through the Spectrum container', () => {
    const balanced = new SynchronousCycle(['a', 'b', 'c', 'd', 'e', 'f']).toSpectrum().get();

    assert.equal(balanced.size(), 6);
    assert.equal(balanced.getBins()[1].magnitude(), 6);
    assert.ok(Math.abs(balanced.getBins()[0].magnitude()) < 1e-12);
    assert.equal(balanced.dominant().get().getFrequency().toString(), '1Hz');

    // A ring traversing the circle backwards puts its energy in the last bin.
    const reversed = new SynchronousCycle(['a', 'b', 'c'], { span: 2 }).toSpectrum().get();
    assert.equal(reversed.dominant().get().getFrequency().toString(), '2Hz');

    assert.equal(new SynchronousCycle().toSpectrum().isEmpty(), true);
});

test('the angular spectrum keeps both axes of an evolving ring', () => {
    const cycle = new SynchronousCycle(['a', 'b', 'c', 'd'], {
        frequency: useHertz(1),
        rate: (element, index) => useHertz([1, 1.5, 2, 2.5][Number(index)]),
    });
    const instants = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75];
    const plane = useAngularSpectrum(cycle, instants, new Sample(instants.length, 2));

    assert.equal(plane.order, 4);
    assert.equal(plane.frameCount, 8);
    assert.equal(plane.cells.length, 8);
    assert.equal(plane.cells[0].length, 4);
    assert.equal(plane.mode(1).get().length, 8);
    assert.equal(plane.spectrum(1).get().size(), 8);
    assert.equal(plane.mode(4).isEmpty(), true);
    assert.equal(plane.mode(-1).isEmpty(), true);

    // Frame zero is the intrinsic ring, so its fourth component is zero.
    assert.ok(plane.cells[0][3].magnitude() < 1e-12);
    // Later frames differ because the two rates disagree.
    assert.ok(plane.cells[7][1].magnitude() > 1e-12);

    assert.throws(() => useAngularSpectrum(cycle, instants, new Sample(4, 2)), RangeError);
    assert.throws(() => useAngularSpectrum(cycle, [Number.NaN], new Sample(1, 1)), TypeError);
    assert.throws(() => useAngularSpectrum(cycle, instants, {}), TypeError);
});

test('list mutations keep the ring closed and shift later samples', () => {
    const cycle = new SynchronousCycle(['a', 'b', 'c']);

    assert.equal(cycle.add(1n, 'x'), undefined);
    assert.deepEqual(cycle.toArray(), ['a', 'x', 'b', 'c']);
    assert.equal(cycle.elementAt(1n).get().element, 'x');
    assert.ok(cycle.phaseAt(1n).get().equals(useRadian(Quarter)));
    assert.equal(cycle.elementAt(4n).get().element, 'a');

    assert.equal(cycle.set(0n, 'A'), 'a');
    assert.deepEqual(cycle.toArray(), ['A', 'x', 'b', 'c']);
    assert.equal(cycle.elementAt(0n).get().element, 'A');

    assert.equal(cycle.remove('x'), true);
    assert.deepEqual(cycle.toArray(), ['A', 'b', 'c']);
    assert.equal(cycle.elementAt(1n).get().element, 'b');
    assert.equal(cycle.elementAt(3n).get().element, 'A');

    assert.equal(cycle.popFront().get(), 'A');
    assert.deepEqual(cycle.toArray(), ['b', 'c']);
    assert.ok(cycle.phaseAt(0n).get().equals(useRadian(0)));
    assert.equal(cycle.elementAt(2n).get().element, 'b');

    cycle.clear();
    assert.equal(cycle.elementAt(0n).isEmpty(), true);
    assert.equal(cycle.add('z'), true);
    assert.equal(cycle.elementAt(0n).get().element, 'z');
    assert.equal(cycle.elementAt(1n).get().element, 'z');
});

test('backed rings support sort and replaceAll', () => {
    const cycle = new SynchronousCycle([3, 1, 2]);

    cycle.sort((left, right) => left - right);
    assert.deepEqual(cycle.toArray(), [1, 2, 3]);
    assert.equal(cycle.elementAt(3n).get().element, 1);

    cycle.replaceAll(value => value * 2);
    assert.deepEqual(cycle.toArray(), [2, 4, 6]);
    assert.equal(cycle.elementAt(-1n).get().element, 6);
});

test('invalid options are rejected eagerly and invalid magnitudes lazily', () => {
    assert.throws(() => new SynchronousCycle([], { phase: 1 }), TypeError);
    assert.throws(() => new SynchronousCycle([], { frequency: 1 }), TypeError);
    assert.throws(() => new SynchronousCycle([], { magnitude: 1 }), TypeError);
    assert.throws(() => new SynchronousCycle([], { span: "one" }), TypeError);
    assert.throws(() => new SynchronousCycle([], { span: 0 }), RangeError);
    assert.throws(() => new SynchronousCycle([], { span: -1 }), RangeError);
    assert.throws(() => SynchronousCycle(), TypeError);
    assert.throws(() => new SynchronousCycle([1], { magnitude: () => Number.NaN }).toComplex(), RangeError);
    assert.throws(() => new SynchronousCycle([1], { magnitude: () => -1 }).elementAt(0n), RangeError);
    assert.throws(() => new SynchronousCycle(null), TypeError);
    assert.throws(() => new SynchronousCycle([1]).isBalanced(Number.NaN), TypeError);
    assert.throws(() => new SynchronousCycle([1]).scoresAt(0, {}), TypeError);
});

test('an asynchronous cycle is an asynchronous list that orders writes before reads', async () => {
    const cycle = new AsynchronousCycle([1, 2]);

    assert.ok(cycle instanceof AsynchronousList);
    assert.equal(cycle.constructor, AsynchronousCycle);

    const added = cycle.add(3);
    const sampled = cycle.elementAt(2n);
    const wrapped = cycle.elementAt(4n);
    const phasors = cycle.toComplex();
    assert.equal(await added, true);

    const element = await sampled;
    assert.equal(element.get().element, 3);
    assert.ok(element.get().phase.equals(useRadian(2 * Third)));
    assert.equal((await wrapped).get().element, 2);
    assert.equal((await phasors).length, 3);
    assert.ok((await cycle.frequencyAt(0n)).get().equals(useHertz(0)));
    assert.ok((await cycle.getFrequency()).equals(useHertz(0)));
    assert.equal(await cycle.isBalanced(), true);
    assert.ok(Math.abs(await cycle.purity() - 1) < 1e-12);
});

test('an asynchronous cycle awaits an async iterable source', async () => {
    async function* source() {
        yield 1;
        yield 2;
    }
    const cycle = new AsynchronousCycle(source(), { frequency: useHertz(0.5) });
    const field = useField([1]);

    assert.deepEqual(await cycle.toArray(), [1, 2]);
    assert.ok((await cycle.toComplex(1n)).get().equals(new Complex(-1, 0)));
    assert.equal((await cycle.elementAt(3n)).get().element, 2);
    assert.equal((await cycle.scoresAt(0, field)).length, 2);
    assert.ok(Math.abs((await cycle.scoreAt(0n, 0, field)).get() - 1) < 1e-12);
    assert.ok((await cycle.relativeAt(1n, 0.5)).get().equals(useRadian(Math.PI / 2)));

    cycle.clear();
    assert.equal((await cycle.elementAt(0n)).isEmpty(), true);
    assert.equal(await cycle.add(5), true);
    assert.deepEqual(await cycle.toArray(), [5]);
    assert.equal((await cycle.elementAt(3n)).get().element, 5);
});
