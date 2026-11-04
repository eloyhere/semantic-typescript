import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ST from 'semantic-typescript';

const array = source => source.toUnordered().toArray();
const timeout = promise => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Source did not settle')), 500);
  })]).finally(() => clearTimeout(timer));
};

test('descending ranges terminate and incompatible directions stay empty', () => {
  assert.deepEqual(array(ST.useRange(5, -1, -2)), [5, 3, 1]);
  assert.deepEqual(array(ST.useRange(5n, -1n, -2n)), [5n, 3n, 1n]);
  assert.deepEqual(array(ST.useRange(0, 5, -1)), []);
  assert.deepEqual(array(ST.useRange(5n, 0n, 1n)), []);
  assert.throws(() => ST.useRange(0, 5, 0), TypeError);
  assert.throws(() => ST.useRange(0, 5, 1n), TypeError);
});

test('string iterables and bounded Unicode text preserve whole code points', () => {
  assert.equal(ST.isIterable('A😊B'), true);
  assert.deepEqual(array(ST.useFrom('A😊B')), ['A', '😊', 'B']);
  assert.deepEqual(array(ST.useText('A😊B', 1, 2)), ['😊']);
  assert.deepEqual(array(ST.useText('A😊B', 1n)), ['😊', 'B']);
  assert.deepEqual(array(ST.useText('A😊B', 2, 1)), ['😊']);
});

test('generator and arranged callbacks advance bigint indexes', () => {
  const seen = [];
  ST.useArrange([3, 1, 2], (a, b) => a - b)((value, index) => seen.push([value, index]), () => false);
  assert.deepEqual(seen, [[1, 0n], [2, 1n], [3, 2n]]);
});

test('traversal short circuit stops nested and sibling work', () => {
  const seen = [];
  ST.useTraverse({ a: { b: 1, c: 2 }, d: 3 }, (_key, value) => { seen.push(value); return false; });
  assert.deepEqual(seen, [1]);
  let laterReads = 0;
  const target = { a: { b: 1 }, get later() { laterReads++; return 2; } };
  assert.equal(array(ST.useAttribute(target).limit(1)).length, 1);
  // The generator protocol can inspect one candidate beyond its accepted limit,
  // but recursive cancellation must not continue through subsequent branches.
  assert.ok(laterReads <= 1);
});

test('zero type mask is retained and numeric random uses its upper bound', () => {
  assert.equal(ST.maskOf('undefined'), 0n);
  const original = Math.random;
  try {
    Math.random = () => 0.5;
    assert.equal(ST.useRandom(0.1), 0.05);
    assert.equal(ST.useRandom(0), 0);
  } finally { Math.random = original; }
});

test('Promise sources propagate the original failure and normal interruption', async () => {
  const boom = new Error('source failure');
  await assert.rejects(timeout(ST.usePromise(Promise.reject(boom)).toUnordered().toArray()), error => error === boom);
  await assert.rejects(timeout(ST.usePromise(Promise.resolve(1)).map(() => { throw boom; }).toUnordered().toArray()), error => error === boom);
  assert.deepEqual(await timeout(ST.usePromise(Promise.resolve(1)).limit(0n).toUnordered().toArray()), []);
});

test('interval rejects callback errors and clears the timer', async () => {
  const boom = new Error('timer callback');
  await assert.rejects(timeout(ST.useInterval(1).map(() => { throw boom; }).toUnordered().toArray()), error => error === boom);
  assert.throws(() => ST.useInterval(Infinity), TypeError);
  assert.throws(() => ST.useInterval(1, Infinity), TypeError);
});

function subscription({ immediate = false, unsubscribeError, unmountError } = {}) {
  const handlers = new Set();
  const state = { made: 0, unmounted: 0 };
  const supplier = () => {
    state.made++;
    return {
      mount() {},
      subscribe(_key, handler) {
        // Exercise emit-before-registration, not just the usual reverse order.
        if (immediate) handler(1);
        handlers.add(handler);
      },
      unsubscribe(_key, handler) { handlers.delete(handler); if (unsubscribeError) throw unsubscribeError; },
      unmount() { state.unmounted++; if (unmountError) throw unmountError; },
    };
  };
  return { handlers, state, supplier, emit: value => { for (const handler of [...handlers]) handler(value); } };
}

test('subscription completes at its accepted limit without an additional event', async () => {
  const f = subscription();
  const result = ST.useSubscription({}, f.supplier, 'event').limit(1n).toUnordered().toArray();
  f.emit(7);
  assert.equal(f.handlers.size, 0);
  assert.deepEqual(await timeout(result), [7]);
  assert.equal(f.state.unmounted, 1);
});

test('subscription cleanup waits for synchronous registration to finish', async () => {
  const f = subscription({ immediate: true });
  assert.deepEqual(await timeout(ST.useSubscription({}, f.supplier, ['event', 'event']).limit(0n).toUnordered().toArray()), []);
  assert.equal(f.handlers.size, 0);
  assert.equal(f.state.unmounted, 1);
});

test('subscription instances are lazy and independent for repeated consumers', async () => {
  const f = subscription();
  const source = ST.useSubscription({}, f.supplier, 'event').limit(1n);
  assert.equal(f.state.made, 0);
  const a = source.toUnordered().toArray();
  const b = source.toUnordered().toArray();
  assert.equal(f.state.made, 2);
  f.emit(9);
  assert.deepEqual(await timeout(Promise.all([a, b])), [[9], [9]]);
  assert.equal(f.state.unmounted, 2);
});

test('subscription preserves callback errors while still attempting all cleanup', async () => {
  const boom = new Error('callback');
  const f = subscription({ unsubscribeError: new Error('unsubscribe'), unmountError: new Error('unmount') });
  const result = ST.useSubscription({}, f.supplier, 'event').map(() => { throw boom; }).toUnordered().toArray();
  f.emit(1);
  await assert.rejects(timeout(result), error => error === boom);
  assert.equal(f.handlers.size, 0);
  assert.equal(f.state.unmounted, 1);
});

test('empty subscription sets complete normally', async () => {
  const f = subscription();
  assert.deepEqual(await timeout(ST.useSubscription({}, f.supplier, []).toUnordered().toArray()), []);
  assert.equal(f.handlers.size, 0);
  assert.equal(f.state.unmounted, 1);
});
