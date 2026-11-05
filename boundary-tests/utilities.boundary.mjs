import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import * as ST from 'semantic-typescript';

const results = [];
const check = async (id, name, fn) => {
  try { await fn(); results.push({ id, name, status: 'pass' }); }
  catch (error) { results.push({ id, name, status: 'fail', error: error.message }); }
};
const array = (s) => s.toUnordered().toArray();
const asyncStats = (values, kind = 'number') => {
  async function* generate() { yield* values; }
  return kind === 'bigint' ? ST.useFrom(generate()).toBigintStatistics() : ST.useFrom(generate()).toNumericStatistics();
};
await check('U01', 'number descending range matches documented half-open interval', () => assert.deepEqual(array(ST.useRange(5, 0, -2)), [5,3,1]));
await check('U02', 'bigint descending range matches README example', () => assert.deepEqual(array(ST.useRange(10n, 0n, -5n)), [10n,5n]));
await check('U03', 'ascending bounds with negative step does not emit runaway negative values', () => assert.deepEqual(array(ST.useRange(0, 5, -1).limit(5)), []));
await check('U04', 'zero step is rejected', () => assert.throws(() => ST.useRange(0, 5, 0), /zero/));
await check('U05', 'equal range bounds are empty', () => assert.deepEqual(array(ST.useRange(3n, 3n)), []));
await check('U06', 'string accepted as Iterable by useFrom', () => assert.deepEqual(array(ST.useFrom('A😊B')), ['A','😊','B']));
await check('U07', 'isIterable recognizes strings', () => assert.equal(ST.isIterable('abc'), true));
await check('U08', 'Unicode slice uses code-point bounds', () => assert.deepEqual(array(ST.useText('A😊B', 1, 2)), ['😊']));
await check('U09', 'Unicode text without bounds remains intact', () => assert.deepEqual(array(ST.useText('A😊B')), ['A','😊','B']));
await check('U10', 'generator helper advances bigint indices', () => {
  const indices = [];
  ST.useGenerator(['a','b','c'])((_v, i) => indices.push(i), () => false);
  assert.deepEqual(indices, [0n,1n,2n]);
});
await check('U11', 'maskOf returns undefined type mask 0', () => assert.equal(ST.maskOf('undefined'), 0n));
await check('U12', 'undefined and null hashes are distinct', () => assert.notEqual(ST.useHash(undefined), ST.useHash(null)));
await check('U13', 'hash collisions do not remove distinct numeric values', () => assert.deepEqual(array(ST.useFrom([0,2,4]).distinct()), [0,2,4]));
// Updated for the 1.2.0 -> 1.3.0 definition change: quantile now defaults to the
// Hyndman-Fan type 7 (R/NumPy/Excel) and returns an Optional; { method: "type-1" }
// restores the previous nearest-rank definition, so both values are asserted.
await check('U14', 'type-7 quantile median of README [1,2,3,4] is 2.5 with type-1 fallback at 2', () => {
  const statistics = ST.useFrom([1,2,3,4]).toNumericStatistics();
  assert.equal(statistics.quantile(.5).get(), 2.5);
  assert.equal(statistics.quantile(.5, { method: 'type-1' }).get(), 2);
});
// Updated for the same definition change: bigint quantiles interpolate and round
// the type-7 result to 3n, while the type-1 fallback keeps the old value of 2n.
await check('U15', 'bigint type-7 quantile rounds the interpolated median to 3n with type-1 at 2n', () => {
  const statistics = ST.useFrom([1n,2n,3n,4n]).toBigintStatistics();
  assert.equal(statistics.quantile(.5).get(), 3n);
  assert.equal(statistics.quantile(.5, { method: 'type-1' }).get(), 2n);
});
// Updated for the same definition change: the async view also defaults to type 7
// and resolves an Optional, so the interpolated median is 2.5 rather than 2.
await check('U16', 'async numeric type-7 quantile interpolates the median to 2.5', async () => {
  assert.equal((await asyncStats([1,2,3,4]).quantile(.5)).get(), 2.5);
  assert.equal((await asyncStats([1,2,3,4]).quantile(.5, { method: 'type-1' })).get(), 2);
});
await check('U17', 'numeric quantile NaN is rejected as RangeError', () => assert.throws(() => ST.useFrom([1,2]).toNumericStatistics().quantile(NaN), RangeError));
await check('U18', 'projected range finds extrema after nonmonotonic mapper', () => assert.equal(ST.useFrom([-2,0,2]).toNumericStatistics().range(x => x*x), 4));
await check('U19', 'projected bigint range finds extrema after mapper', () => assert.equal(ST.useFrom([-2n,0n,2n]).toBigintStatistics().range(x => x*x), 4n));
await check('U20', 'async projected numeric range', async () => assert.equal(await asyncStats([-2,0,2]).range(x => x*x), 4));
// Updated for the 1.2.0 -> 1.3.0 definition change: variance now divides by n - 1
// (R/NumPy/pandas) and returns an Optional; { ddof: 0 } restores the population value.
await check('U21', 'bigint sample variance survives large translation of equal spread', () => {
  const base = 2n ** 60n;
  const statistics = ST.useFrom([base,base+2n]).toBigintStatistics();
  assert.equal(statistics.variance().get(), 2n);
  assert.equal(statistics.variance({ ddof: 0 }).get(), 1n);
});
// Updated for the same definition change: the standard deviation now uses ddof 1
// and resolves an Optional; sqrt(2) still rounds to 1n for bigint results.
await check('U22', 'bigint stddev survives large translation of equal spread', () => {
  const base = 2n ** 60n;
  const statistics = ST.useFrom([base,base+2n]).toBigintStatistics();
  assert.equal(statistics.standardDeviation().get(), 1n);
  assert.equal(statistics.standardDeviation({ ddof: 0 }).get(), 1n);
});
// Updated for the same definition change: the async bigint view defaults to ddof 1
// and resolves an Optional, so the translated sample variance is 2n.
await check('U23', 'async bigint sample variance survives large translation', async () => {
  const base = 2n ** 60n;
  assert.equal((await asyncStats([base,base+2n], 'bigint').variance()).get(), 2n);
});
// Updated for the 1.2.0 -> 1.3.0 definition change: variance, standardDeviation,
// interquartileRange, skewness and kurtosis now return Optional and are empty for
// an empty sample, while the plain aggregates still return zero.
await check('U24', 'empty statistical view returns zero for plain aggregates and empty optionals where undefined', () => {
  const s = ST.useEmpty().toNumericStatistics();
  for (const method of ['summate','average','mean','median','mode','range']) assert.equal(s[method](), 0, method);
  for (const method of ['variance','standardDeviation','interquartileRange','skewness','kurtosis']) assert.equal(s[method]().isPresent(), false, method);
});
// Updated for the 1.2.0 -> 1.3.0 definition change: variance and deviation still
// have spread zero, but the default skewness is now G1, which is undefined (0/0)
// for a zero-spread sample and therefore an empty Optional instead of 0.
await check('U25', 'constant numeric sample has zero variance and deviation but an undefined G1 skewness', () => {
  const s = ST.useFrom([7,7,7]).toNumericStatistics();
  assert.equal(s.variance().get(),0); assert.equal(s.standardDeviation().get(),0); assert.equal(s.skewness().isPresent(),false); assert.equal(s.range(),0);
});
await check('U26', 'Optional preserves zero false empty string and NaN', () => {
  for (const value of [0,false,'',NaN]) assert.equal(ST.Optional.of(value).isPresent(),true);
});
await check('U27', 'Optional empty mapper is not evaluated', () => {
  let calls=0;
  ST.Optional.empty().map(() => ++calls); assert.equal(calls,0);
});
await check('U28', 'cyclic attribute traversal terminates and preserves leaves', () => {
  const target = { a:1 }; target.self=target;
  assert.deepEqual(array(ST.useAttribute(target)).map(x=>x.value), [1]);
});
await check('U29', 'nested traversal false stops the entire walk', () => {
  const seen=[];
  ST.useTraverse({a:{x:1},b:2}, (k,v) => { seen.push(v); return false; });
  assert.deepEqual(seen,[1]);
});
await check('U30', 'number random single upper bound respects half-open range', () => {
  const original = Math.random;
  try { Math.random=()=>0.5; assert.ok(ST.useRandom(.1)>=0 && ST.useRandom(.1)<.1); }
  finally { Math.random=original; }
});
await check('U31', 'two-argument number and bigint random respect bounds', () => {
  for (let i=0; i<100; i++) {
    const n=ST.useRandom(-5,5); assert.ok(n>=-5 && n<5);
    const b=ST.useRandom(-5n,5n); assert.ok(b>=-5n && b<5n);
  }
});
// Updated for the 1.2.0 -> 1.3.0 definition change: the default ddof is now 1.
// [1,2,3,4] has sample variance 5/3 and the bigint variant rounds it to 2n; both
// results are wrapped in an Optional now.
await check('U32', 'safe small numeric sample variance and bigint rounding', () => {
  assert.equal(ST.useFrom([1,2,3,4]).toNumericStatistics().variance().get(), 5 / 3);
  assert.equal(ST.useFrom([1n,2n,3n,4n]).toBigintStatistics().variance().get(), 2n);
});
await check('U33', 'numeric sum mapper is honored for numeric inputs', () => assert.equal(ST.useFrom([1,2]).toNumericStatistics().summate(x => x*10),30));
await check('U34', 'numeric mean mapper is honored for numeric inputs', () => assert.equal(ST.useFrom([1,2]).toNumericStatistics().average(x => x*10),15));
await check('U35', 'numeric median mapper is honored for numeric inputs', () => assert.equal(ST.useFrom([1,2]).toNumericStatistics().median(x => x*10),15));
// Updated for the 1.2.0 -> 1.3.0 definition change: the mapped [10,20] sample now
// uses the ddof 1 denominator, so its variance is 50 instead of the population 25.
await check('U36', 'numeric sample variance mapper is honored for numeric inputs', () => assert.equal(ST.useFrom([1,2]).toNumericStatistics().variance(x => x*10).get(),50));
await check('U37', 'bigint sum mapper is honored for bigint inputs', () => assert.equal(ST.useFrom([1n,2n]).toBigintStatistics().summate(x => x*10n),30n));
await check('U38', 'async numeric sum mapper is honored', async () => assert.equal(await asyncStats([1,2]).summate(x => x*10),30));
await check('U39', 'async bigint sum mapper is honored', async () => assert.equal(await asyncStats([1n,2n], 'bigint').summate(x => x*10n),30n));
const summary = {total: results.length, passed: results.filter(x=>x.status==='pass').length, failed: results.filter(x=>x.status==='fail').length};
writeFileSync(new URL('./utilities-after-fixes.json',import.meta.url),JSON.stringify({summary,results},null,2)+'\n');
for (const r of results) console.log(`${r.status.toUpperCase()} ${r.id} ${r.name}${r.error ? '\n  '+r.error : ''}`);
console.log(JSON.stringify(summary));
process.exitCode = summary.failed ? 1 : 0;
