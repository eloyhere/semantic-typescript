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
await check('U14', 'nearest-rank quantile median matches README [1,2,3,4] -> 2', () => assert.equal(ST.useFrom([1,2,3,4]).toNumericStatistics().quantile(.5), 2));
await check('U15', 'bigint nearest-rank quantile matches numeric result', () => assert.equal(ST.useFrom([1n,2n,3n,4n]).toBigintStatistics().quantile(.5), 2n));
await check('U16', 'async numeric nearest-rank quantile', async () => assert.equal(await asyncStats([1,2,3,4]).quantile(.5), 2));
await check('U17', 'numeric quantile NaN is rejected as RangeError', () => assert.throws(() => ST.useFrom([1,2]).toNumericStatistics().quantile(NaN), RangeError));
await check('U18', 'projected range finds extrema after nonmonotonic mapper', () => assert.equal(ST.useFrom([-2,0,2]).toNumericStatistics().range(x => x*x), 4));
await check('U19', 'projected bigint range finds extrema after mapper', () => assert.equal(ST.useFrom([-2n,0n,2n]).toBigintStatistics().range(x => x*x), 4n));
await check('U20', 'async projected numeric range', async () => assert.equal(await asyncStats([-2,0,2]).range(x => x*x), 4));
await check('U21', 'bigint variance survives large translation of equal spread', () => {
  const base = 2n ** 60n;
  assert.equal(ST.useFrom([base,base+2n]).toBigintStatistics().variance(), 1n);
});
await check('U22', 'bigint stddev survives large translation of equal spread', () => {
  const base = 2n ** 60n;
  assert.equal(ST.useFrom([base,base+2n]).toBigintStatistics().standardDeviation(), 1n);
});
await check('U23', 'async bigint variance survives large translation', async () => {
  const base = 2n ** 60n;
  assert.equal(await asyncStats([base,base+2n], 'bigint').variance(), 1n);
});
await check('U24', 'all numeric empty statistical aggregates return zero', () => {
  const s = ST.useEmpty().toNumericStatistics();
  for (const method of ['summate','average','mean','median','mode','variance','standardDeviation','range','interquartileRange','skewness','kurtosis']) assert.equal(s[method](), 0, method);
});
await check('U25', 'constant numeric sample has zero variance, deviation and skewness', () => {
  const s = ST.useFrom([7,7,7]).toNumericStatistics();
  assert.equal(s.variance(),0); assert.equal(s.standardDeviation(),0); assert.equal(s.skewness(),0); assert.equal(s.range(),0);
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
await check('U32', 'safe small numeric population variance and bigint rounding', () => {
  assert.equal(ST.useFrom([1,2,3,4]).toNumericStatistics().variance(),1.25);
  assert.equal(ST.useFrom([1n,2n,3n,4n]).toBigintStatistics().variance(),1n);
});
await check('U33', 'numeric sum mapper is honored for numeric inputs', () => assert.equal(ST.useFrom([1,2]).toNumericStatistics().summate(x => x*10),30));
await check('U34', 'numeric mean mapper is honored for numeric inputs', () => assert.equal(ST.useFrom([1,2]).toNumericStatistics().average(x => x*10),15));
await check('U35', 'numeric median mapper is honored for numeric inputs', () => assert.equal(ST.useFrom([1,2]).toNumericStatistics().median(x => x*10),15));
await check('U36', 'numeric variance mapper is honored for numeric inputs', () => assert.equal(ST.useFrom([1,2]).toNumericStatistics().variance(x => x*10),25));
await check('U37', 'bigint sum mapper is honored for bigint inputs', () => assert.equal(ST.useFrom([1n,2n]).toBigintStatistics().summate(x => x*10n),30n));
await check('U38', 'async numeric sum mapper is honored', async () => assert.equal(await asyncStats([1,2]).summate(x => x*10),30));
await check('U39', 'async bigint sum mapper is honored', async () => assert.equal(await asyncStats([1n,2n], 'bigint').summate(x => x*10n),30n));
const summary = {total: results.length, passed: results.filter(x=>x.status==='pass').length, failed: results.filter(x=>x.status==='fail').length};
writeFileSync(new URL('./utilities-after-fixes.json',import.meta.url),JSON.stringify({summary,results},null,2)+'\n');
for (const r of results) console.log(`${r.status.toUpperCase()} ${r.id} ${r.name}${r.error ? '\n  '+r.error : ''}`);
console.log(JSON.stringify(summary));
process.exitCode = summary.failed ? 1 : 0;
