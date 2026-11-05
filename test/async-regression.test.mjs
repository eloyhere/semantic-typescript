import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ST from 'semantic-typescript';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const values = (...items) => ST.useIterate({ async *[Symbol.asyncIterator]() { yield* items; } });
const collect = semantic => ST.useAsynchronousToArray().collect(semantic.source());
const sameError = error => actual => actual === error;

for (const mode of ['toUnordered', 'toOrdered', 'toWindow', 'toNumericStatistics', 'toBigintStatistics']) {
  test(`${mode}: one failing materialization rejects concurrent and delayed consumers`, { timeout: 1200 }, async () => {
    const boom = new Error('source failure'); let runs = 0;
    const buffer = ST.useIterate({ async *[Symbol.asyncIterator]() { runs++; yield 1; await delay(5); throw boom; } })[mode]();
    await Promise.all([
      assert.rejects(buffer.toArray(), sameError(boom)),
      assert.rejects(buffer.count(), sameError(boom)),
      assert.rejects(buffer.isEmpty(), sameError(boom)),
      assert.rejects(buffer.findFirst(), sameError(boom)),
      assert.rejects((async () => { for await (const _ of buffer) assert.fail('failed source must not yield partial data'); })(), sameError(boom)),
    ]);
    await assert.rejects(buffer.toArray(), sameError(boom));
    await assert.rejects(buffer.findMaximum(), sameError(boom));
    await assert.rejects(buffer.findMinimum(), sameError(boom));
    if (mode === 'toWindow') await assert.rejects(collect(buffer.slide(2n)), sameError(boom));
    if (mode.endsWith('Statistics')) await assert.rejects(buffer.average(), sameError(boom));
    assert.equal(runs, 1);
  });
  test(`${mode}: failure before the first terminal remains observed`, { timeout: 1200 }, async () => {
    const boom = new Error('early failure');
    const buffer = ST.useIterate({ async *[Symbol.asyncIterator]() { throw boom; } })[mode]();
    await delay(15);
    await assert.rejects(buffer.toArray(), sameError(boom));
  });
}

test('ordered completed empty terminals settle and falsy extrema stay valid', { timeout: 1200 }, async () => {
  const empty = values().toOrdered();
  assert.deepEqual(await empty.toArray(), []);
  assert.equal(await empty.isEmpty(), true);
  for (const method of ['findFirst', 'findLast', 'findMaximum', 'findMinimum', 'findAny']) await assert.rejects(empty[method](), /No element/);
  assert.equal(await values(0).toOrdered().findMinimum(), 0);
  assert.equal(await values(undefined).toOrdered().findMaximum(), undefined);
  assert.equal(await values(false).toOrdered().isEmpty(), false);
});

test('concat awaits tails, uses global indexes, and skips a tail after interruption', { timeout: 1200 }, async () => {
  const seen = [];
  await values(1).concat(values(2, 3)).source()((value, index) => seen.push([value, index]), () => false);
  assert.deepEqual(seen, [[1, 0n], [2, 1n], [3, 2n]]);
  let starts = 0;
  const tail = ST.useIterate({ async *[Symbol.asyncIterator]() { starts++; throw new Error('unreachable'); } });
  assert.deepEqual(await collect(values(1).concat(tail).limit(1n)), [1]);
  assert.equal(starts, 0);
  let closed = 0;
  const iterable = { async *[Symbol.asyncIterator]() { try { yield 2; yield 3; } finally { closed++; } } };
  assert.deepEqual(await collect(values(1).concat(iterable).limit(2n)), [1, 2]);
  assert.equal(closed, 1);
  assert.deepEqual(await collect(values(1).concat({ async *[Symbol.asyncIterator]() { starts++; throw new Error('unreachable'); } }).limit(1n)), [1]);
  assert.equal(starts, 0);
});

test('four argument collect honors accumulator state and indexes', { timeout: 1200 }, async () => {
  const result = await values(4, 5, 6).toUnordered().collect(
    () => [], (_value, _index, acc) => acc.length === 2,
    (acc, value, index) => [...acc, [value, index]], acc => acc,
  );
  assert.deepEqual(result, [[4, 0n], [5, 1n]]);
});

for (const [name, factory, expected] of [
  ['max', ST.useAsynchronousFindMaximum, 3], ['min', ST.useAsynchronousFindMinimum, 1],
]) {
  test(`${name} initializes once per collect and preserves comparator errors`, { timeout: 1200 }, async () => {
    const collector = factory();
    assert.deepEqual(await Promise.all([collector.collect(values(1, 3, 2).source()), collector.collect(values(3, 1).source())]), [expected, expected]);
    await assert.rejects(collector.collect(values().source()), /No element/);
    assert.equal(await collector.collect(values(undefined).source()), undefined);
    const boom = new Error('comparator');
    const failing = factory(() => { throw boom; });
    await assert.rejects(failing.collect(values(1, 2, 3).source()), sameError(boom));
  });
}

test('reduce distinguishes an empty source from callback failure', { timeout: 1200 }, async () => {
  const reducer = ST.useAsynchronousReduce((a, b) => a + b);
  await assert.rejects(reducer.collect(values().source()), /No element/);
  assert.equal(await reducer.collect(values(1, 2, 3).source()), 6);
  assert.deepEqual(await Promise.all([reducer.collect(values(1, 2).source()), reducer.collect(values(5).source())]), [3, 5]);
  const boom = new Error('reduce');
  let calls = 0;
  const failing = ST.useAsynchronousReduce(() => { calls++; throw boom; });
  await assert.rejects(failing.collect(values(1, 2, 3).source()), sameError(boom));
  assert.equal(calls, 1);
  await assert.rejects(failing.collect(ST.useIterate({ async *[Symbol.asyncIterator]() { yield 1; yield 2; await delay(20); yield 3; } }).source()), sameError(boom));
});

test('join formats empty, singleton, multi-character delimiters and custom callbacks', { timeout: 1200 }, async () => {
  for (const items of [[], [1], [1, 2]]) {
    assert.equal(await ST.useAsynchronousJoin().collect(values(...items).source()), `[${items.join(',')}]`);
    assert.equal(await ST.useAsynchronousJoin('::').collect(values(...items).source()), `[${items.join('::')}]`);
    assert.equal(await ST.useAsynchronousJoin('<', '::', '>').collect(values(...items).source()), `<${items.join('::')}>`);
    assert.equal(await ST.useAsynchronousJoin('', '', '').collect(values(...items).source()), items.join(''));
  }
  assert.equal(await ST.useAsynchronousJoin('<', (acc, value, index) => `${acc}${value}:${index};`, '>').collect(values(1, 2).source()), '<1:0;2:1;>');
});

for (const [mode, input, mapper, expected] of [
  ['toNumericStatistics', [1, 2, 2], x => x * 10, [50, 50 / 3, 20, 20]],
  ['toBigintStatistics', [1n, 2n, 2n], x => x * 10n, [50n, 16n, 20n, 20n]],
]) {
  test(`${mode} applies explicit mappers to primitive values`, { timeout: 1200 }, async () => {
    const stats = values(...input)[mode]();
    assert.deepEqual(await Promise.all([stats.summate(mapper), stats.average(mapper), stats.median(mapper), stats.mode(mapper)]), expected);
    const boom = new Error('mapper');
    for (const method of ['summate', 'average', 'median', 'mode', 'range', 'variance', 'standardDeviation', 'quantile']) {
      const call = method === 'quantile' ? stats.quantile(0.5, () => { throw boom; }) : stats[method](() => { throw boom; });
      await assert.rejects(call, sameError(boom));
    }
  });
}

test('numeric projections determine range, variance and nearest rank', { timeout: 1200 }, async () => {
  const stats = values(-2, 0, 2).toNumericStatistics();
  assert.equal(await stats.range(x => x * x), 4);
  assert.equal((await stats.quantile(0.5, x => x * x)).get(), 4);
  // 此处因 1.2.0 → 2.0.0 的定义变更而更新：variance 由总体 25 改为样本 50，标准差由 5 改为 sqrt(50)。
  assert.equal((await values(1, 2).toNumericStatistics().variance(x => x * 10)).get(), 50);
  assert.equal((await values(1, 2).toNumericStatistics().standardDeviation(x => x * 10)).get(), Math.sqrt(50));
});

for (const mode of ['toNumericStatistics', 'toBigintStatistics']) {
  test(`${mode} quantile endpoints, even samples, NaN and projected ordering`, { timeout: 1200 }, async () => {
    const bigint = mode === 'toBigintStatistics'; const cast = value => bigint ? BigInt(value) : value;
    const stats = values(...[1, 2, 3, 4].map(cast))[mode]();
    // 此处因 1.2.0 → 2.0.0 的定义变更而更新：默认 H&F 类型 7，旧值 [1, 1, 2, 3, 4]。
    const expected = bigint ? [1n, 2n, 3n, 3n, 4n] : [1, 1.75, 2.5, 3.25, 4];
    assert.deepEqual(await Promise.all([0, 0.25, 0.5, 0.75, 1].map(q => stats.quantile(q).then(result => result.get()))), expected);
    assert.equal((await stats.quantile(0.25, value => -value)).get(), bigint ? -3n : -3.25);
    for (const q of [NaN, Infinity, -0.1, 1.1]) {
      await assert.rejects(stats.quantile(q), RangeError);
      await assert.rejects(values()[mode]().quantile(q), RangeError);
    }
    assert.equal((await values()[mode]().quantile(0.5)).isEmpty(), true);
  });
}

test('bigint statistics preserve small differences around large origins', { timeout: 1200 }, async () => {
  const b = 2n ** 60n;
  const stats = values(b, b + 2n).toBigintStatistics();
  // 此处因 1.2.0 → 2.0.0 的定义变更而更新：样本方差为 2n（旧总体方差 1n），标准差仍为 1n。
  const [variance, deviation, range] = await Promise.all([stats.variance(), stats.standardDeviation(), stats.range()]);
  assert.equal(variance.get(), 2n);
  assert.equal(deviation.get(), 1n);
  assert.equal(range, 2n);
  assert.equal(await values(-2n, 0n, 2n).toBigintStatistics().range(x => x * x), 4n);
  for (const factory of [ST.useAsynchronousBigIntVariance, ST.useAsynchronousBigIntStandardDeviation]) {
    assert.equal(await factory().collect(values(1n, 2n, 3n, 4n).source()), 1n);
    assert.equal(await factory().collect(values(b, b + 2n).source()), 1n);
    assert.equal(await factory(x => x * 10n).collect(values(1n, 2n).source()), factory === ST.useAsynchronousBigIntVariance ? 25n : 5n);
  }
});

test('window inner and outer limits complete normally and callback failures propagate', { timeout: 1200 }, async () => {
  const outer = await collect(values(1, 2, 3).toWindow().slide(2n).limit(1n));
  assert.equal(outer.length, 1);
  assert.deepEqual(await collect(outer[0].limit(1n)), [1]);
  const boom = new Error('window callback');
  await assert.rejects(values(1).toWindow().slide(1n).source()(() => { throw boom; }, () => false), sameError(boom));
  await assert.rejects(outer[0].source()(() => { throw boom; }, () => false), sameError(boom));
});
