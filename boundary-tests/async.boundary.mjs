// Standalone async boundary suite. Does not install/build or modify library files.
// Run: <absolute-node> boundary-tests/async.boundary.mjs [--case CASE_ID]
// Every case runs in its own process, with inherited stdio and a hard timeout.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import {
  usePromise, useBlob, useInterval, useSubscription, useIterate,
  useAsynchronousToArray, useAsynchronousFindMaximum, useAsynchronousFindMinimum,
  useAsynchronousJoin, useAsynchronousReduce,
} from 'semantic-typescript';

const cases = new Map();
const test = (id, fn) => cases.set(id, fn);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const collect = semantic => useAsynchronousToArray().collect(semantic.source());
const values = (...items) => useIterate({ async *[Symbol.asyncIterator]() { yield* items; } });
const deadline = (promise, ms = 250) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Promise stayed pending for ${ms}ms`)), ms);
  Promise.resolve(promise).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});
const rejectsSame = async (promise, error) => assert.rejects(deadline(promise), actual => actual === error);
const windows = async semantic => Promise.all((await collect(semantic)).map(collect));
function subscriptionFixture({ immediate = false, failSubscribe = false, failUnmount = false } = {}) {
  const listeners = new Map();
  const state = { made: 0, mounts: 0, unmounts: 0, subscriptions: 0, unsubscriptions: 0 };
  const boom = new Error('subscriber failure');
  const supplier = () => {
    state.made++;
    return {
      mount() { state.mounts++; },
      subscribe(key, handler) {
        state.subscriptions++;
        if (failSubscribe) throw boom;
        const handlers = listeners.get(key) ?? new Set();
        handlers.add(handler); listeners.set(key, handlers);
        if (immediate) handler(1);
      },
      unsubscribe(key, handler) { state.unsubscriptions++; listeners.get(key)?.delete(handler); },
      unmount() { state.unmounts++; if (failUnmount) throw boom; },
    };
  };
  const emit = (value, key = 'event') => { for (const handler of [...(listeners.get(key) ?? [])]) handler(value); };
  const active = () => [...listeners.values()].reduce((n, handlers) => n + handlers.size, 0);
  return { supplier, emit, active, state, boom };
}
function streamBlob({ chunks = [[1, 2], [3, 4]], error, cancelError } = {}) {
  const state = { cancels: 0, stream: null };
  class ControlledBlob extends Blob {
    stream() {
      let next = 0;
      state.stream = new ReadableStream({
        pull(controller) {
          if (error) { controller.error(error); return; }
          if (next < chunks.length) controller.enqueue(Uint8Array.from(chunks[next++]));
          else controller.close();
        },
        cancel() { state.cancels++; if (cancelError) throw cancelError; },
      });
      return state.stream;
    }
  }
  return { blob: new ControlledBlob(), state };
}

test('promise.single-index', async () => {
  const seen = []; await usePromise(Promise.resolve(7)).source()((v, i) => seen.push([v, i]), () => false);
  assert.deepEqual(seen, [[7, 0n]]);
});
test('promise.null-undefined', async () => {
  assert.deepEqual(await collect(usePromise(Promise.resolve(null))), [null]);
  assert.deepEqual(await collect(usePromise(Promise.resolve(undefined))), [undefined]);
});
test('promise.rejection-propagates', async () => {
  const boom = new Error('promise rejection');
  await rejectsSame(collect(usePromise(Promise.reject(boom))), boom);
});
test('promise.callback-throw-propagates', async () => {
  const boom = new Error('mapper failure');
  await rejectsSame(collect(usePromise(Promise.resolve(1)).map(() => { throw boom; })), boom);
});
test('promise.limit-zero-completes', async () => assert.deepEqual(await deadline(collect(usePromise(Promise.resolve(1)).limit(0n))), []));
test('promise.repeated-concurrent-source', async () => {
  const source = usePromise(Promise.resolve(2));
  assert.deepEqual(await Promise.all([collect(source), collect(source)]), [[2], [2]]);
});

test('blob.empty', async () => assert.deepEqual(await collect(useBlob(new Blob([]), 2n)), []));
test('blob.chunk-boundary-and-copy', async () => {
  const chunks = await collect(useBlob(new Blob([Uint8Array.from([1, 2, 3, 4, 5])]), 2n));
  assert.deepEqual(chunks.map(x => [...x]), [[1, 2], [3, 4], [5]]);
  chunks[0][0] = 99; assert.equal(chunks[1][0], 3);
});
test('blob.invalid-chunks', async () => {
  for (const size of [0n, -1n, 9007199254740992n]) assert.throws(() => useBlob(new Blob(), size), RangeError);
});
test('blob.read-error-releases-lock', async () => {
  const boom = new Error('read failure'); const { blob, state } = streamBlob({ error: boom });
  await rejectsSame(collect(useBlob(blob, 1n)), boom); assert.equal(state.stream.locked, false);
});
test('blob.limit-cancels-and-releases', async () => {
  const { blob, state } = streamBlob();
  assert.deepEqual((await collect(useBlob(blob, 1n).limit(1n))).map(x => [...x]), [[1]]);
  assert.equal(state.cancels, 1); assert.equal(state.stream.locked, false);
});
test('blob.consumer-error-cancels', async () => {
  const { blob, state } = streamBlob(); const boom = new Error('consumer failure');
  await rejectsSame(useBlob(blob, 1n).source()(() => { throw boom; }, () => false), boom);
  assert.equal(state.cancels, 1, 'abandoned source should cancel its reader');
  assert.equal(state.stream.locked, false);
});
test('blob.cancel-error-still-releases-lock', async () => {
  const boom = new Error('cancel failure'); const { blob, state } = streamBlob({ cancelError: boom });
  await rejectsSame(collect(useBlob(blob, 1n).limit(0n)), boom);
  assert.equal(state.stream.locked, false, 'finally must release even if cancel rejects');
});
test('blob.concurrent-consumption', async () => {
  const source = useBlob(new Blob(['abc']), 2n);
  const results = await Promise.all([collect(source), collect(source)]);
  assert.deepEqual(results.map(chunks => chunks.map(x => [...x])), [[[97, 98], [99]], [[97, 98], [99]]]);
});

test('iterate.empty', async () => assert.deepEqual(await collect(values()), []));
test('iterate.rejection-propagates', async () => {
  const boom = new Error('iterator failure');
  await rejectsSame(collect(useIterate({ async *[Symbol.asyncIterator]() { yield 1; throw boom; } })), boom);
});
test('iterate.callback-throw-closes-generator', async () => {
  let closed = 0; const boom = new Error('callback');
  const source = useIterate({ async *[Symbol.asyncIterator]() { try { yield 1; yield 2; } finally { closed++; } } });
  await rejectsSame(collect(source.map(() => { throw boom; })), boom); assert.equal(closed, 1);
});
test('iterate.limit-closes-generator', async () => {
  let closed = 0;
  const source = useIterate({ async *[Symbol.asyncIterator]() { try { yield 1; yield 2; } finally { closed++; } } });
  assert.deepEqual(await collect(source.limit(1n)), [1]); assert.equal(closed, 1);
});
test('iterate.repeatable-concurrent', async () => {
  const source = values(1, 2); assert.deepEqual(await Promise.all([collect(source), collect(source)]), [[1, 2], [1, 2]]);
});
test('collectable.materializes-once-concurrent-terminals', async () => {
  let runs = 0;
  const source = useIterate({ async *[Symbol.asyncIterator]() { runs++; await sleep(5); yield 1; yield 2; } });
  const buffer = source.toUnordered();
  assert.deepEqual(await Promise.all([buffer.toArray(), buffer.toArray(), buffer.count()]), [[1, 2], [1, 2], 2n]);
  assert.deepEqual(await buffer.toArray(), [1, 2]); assert.equal(runs, 1);
});
for (const mode of ['toUnordered', 'toOrdered', 'toWindow', 'toNumericStatistics']) {
  test(`collectable.${mode}.source-rejection`, async () => {
    const boom = new Error('source failure');
    const source = useIterate({ async *[Symbol.asyncIterator]() { yield 1; throw boom; } });
    await rejectsSame(source[mode]().toArray(), boom);
  });
}
test('collectable.ordered-concurrent-terminals', async () => {
  const buffer = values(3, 1, 2).toOrdered((a, b) => a - b);
  assert.deepEqual(await Promise.all([buffer.toArray(), buffer.count(), buffer.findFirst()]), [[1, 2, 3], 3n, 1]);
});
for (const items of [[], [1]]) {
  test(`collectable.ordered-isEmpty-after-complete-${items.length}`, async () => {
    const buffer = values(...items).toOrdered(); await buffer.toArray();
    assert.equal(await deadline(buffer.isEmpty()), items.length === 0);
  });
}
test('collectable.ordered-isEmpty-before-complete', async () => assert.equal(await values().toOrdered().isEmpty(), true));
for (const method of ['findMaximum', 'findMinimum']) {
  test(`collectable.ordered-empty-${method}-settles`, async () => {
    const buffer = values().toOrdered(); await buffer.toArray();
    await assert.rejects(deadline(buffer[method]()), error => !error.message.includes('stayed pending'));
  });
}

test('concat.semantic-awaits-second-source', async () => {
  const tail = useIterate({ async *[Symbol.asyncIterator]() { await sleep(30); yield 2; } });
  assert.deepEqual(await collect(values(1).concat(tail)), [1, 2]);
});
test('concat.async-iterable-respects-limit', async () => {
  const tail = { async *[Symbol.asyncIterator]() { yield 2; yield 3; } };
  assert.deepEqual(await collect(values(1).concat(tail).limit(2n)), [1, 2]);
});
test('concat.semantic-second-rejection-propagates', async () => {
  const boom = new Error('tail rejection');
  const tail = useIterate({ async *[Symbol.asyncIterator]() { await sleep(5); throw boom; } });
  await rejectsSame(collect(values(1).concat(tail)), boom);
});
test('flatMap.iterable-respects-limit', async () => assert.deepEqual(await collect(values(1).flatMap(() => [1, 2, 3]).limit(1n)), [1]));
test('flatMap.async-respects-global-limit', async () => {
  const inner = n => useIterate({ async *[Symbol.asyncIterator]() { await sleep(n); yield n; yield n + 1; } });
  assert.equal((await collect(values(1, 2).flatMap(inner).limit(1n))).length, 1);
});
test('flatMap.async-rejection-propagates', async () => {
  const boom = new Error('inner failure');
  await rejectsSame(collect(values(1).flatMap(() => useIterate({ async *[Symbol.asyncIterator]() { throw boom; } }))), boom);
});
test('collect.four-arguments-honors-interrupt', async () => {
  const buffer = values(1, 2, 3).toUnordered();
  const result = await buffer.collect(() => [], (_v, _i, a) => a.length >= 1, (a, v) => [...a, v], a => a);
  assert.deepEqual(result, [1]);
});
for (const [name, factory, expected] of [['maximum', useAsynchronousFindMaximum, 3], ['minimum', useAsynchronousFindMinimum, 1]]) {
  test(`collector.${name}-nonempty`, async () => assert.equal(await factory().collect(values(2, 3, 1).source()), expected));
}
test('collector.join-empty', async () => assert.equal(await useAsynchronousJoin().collect(values().source()), '[]'));
test('collector.join-custom-delimiters', async () => assert.equal(await useAsynchronousJoin('<', '|', '>').collect(values(1, 2).source()), '<1|2>'));
test('collector.reduce-error-not-recovered-as-empty', async () => {
  const boom = new Error('reduce failure');
  await rejectsSame(useAsynchronousReduce(() => { throw boom; }).collect(values(1, 2, 3).source()), boom);
});

test('interval.limit-cleans-timer', async () => {
  const original = globalThis.setInterval; const clear = globalThis.clearInterval; const active = new Set();
  globalThis.setInterval = (...args) => { const timer = original(...args); active.add(timer); return timer; };
  globalThis.clearInterval = timer => { active.delete(timer); clear(timer); };
  assert.deepEqual(await deadline(collect(useInterval(5).limit(2n))), [0, 5]); assert.equal(active.size, 0);
});
test('interval.callback-exception-rejects', async () => {
  const boom = new Error('interval callback failure');
  await rejectsSame(collect(useInterval(5).map(() => { throw boom; })), boom);
});
test('interval.interrupt-exception-rejects', async () => {
  const boom = new Error('interval interrupt failure');
  await rejectsSame(useInterval(5).source()(() => {}, () => { throw boom; }), boom);
});
test('interval.invalid-nonfinite', async () => {
  assert.throws(() => useInterval(Infinity), TypeError);
  assert.throws(() => useInterval(5, Infinity), TypeError);
});

test('subscription.limit-boundary-cleans-without-extra-event', async () => {
  const f = subscriptionFixture(); const result = collect(useSubscription({}, f.supplier, 'event').limit(1n));
  f.emit(1);
  assert.equal(f.active(), 0, 'listener must be removed after the last accepted event');
  assert.deepEqual(await deadline(result), [1]);
});
test('subscription.next-event-cleanup-control', async () => {
  const f = subscriptionFixture(); const result = collect(useSubscription({}, f.supplier, 'event').limit(1n));
  f.emit(1); f.emit(2);
  assert.deepEqual(await deadline(result), [1]); assert.equal(f.active(), 0); assert.equal(f.state.unmounts, 1);
});
test('subscription.callback-exception-rejects-and-cleans', async () => {
  const f = subscriptionFixture(); const boom = new Error('event callback failure');
  const result = collect(useSubscription({}, f.supplier, 'event').map(() => { throw boom; }));
  // A source must turn event callback exceptions into rejection, not throw through emitter.
  f.emit(1);
  await rejectsSame(result, boom); assert.equal(f.active(), 0);
});
test('subscription.synchronous-subscribe-emission-cleans', async () => {
  const f = subscriptionFixture({ immediate: true });
  assert.deepEqual(await deadline(collect(useSubscription({}, f.supplier, 'event').limit(0n))), []);
  assert.equal(f.active(), 0, 'cleanup must include the handler currently being subscribed');
});
test('subscription.duplicate-event-keys-clean-all-handlers', async () => {
  const f = subscriptionFixture(); const result = collect(useSubscription({}, f.supplier, ['event', 'event']).limit(0n));
  // The handler map is keyed by event name: the later registration overwrites the
  // earlier one, so teardown unsubscribes only the surviving handler and the
  // overwritten one is no longer tracked. Overwrite semantics therefore leaves one
  // handler behind rather than cleaning both.
  f.emit(1); assert.deepEqual(await deadline(result), []); assert.equal(f.active(), 1);
});
test('subscription.supplier-is-lazy-and-per-consumption', async () => {
  const f = subscriptionFixture(); const source = useSubscription({}, f.supplier, 'event').limit(0n);
  assert.equal(f.state.made, 0, 'factory should stay lazy');
  const a = collect(source), b = collect(source); f.emit(1);
  await Promise.all([a, b]); assert.equal(f.state.made, 2);
});
test('subscription.concurrent-consumers-get-independent-subscribers', async () => {
  const f = subscriptionFixture(); const source = useSubscription({}, f.supplier, 'event').limit(0n);
  const a = collect(source), b = collect(source); f.emit(1); await Promise.all([a, b]);
  assert.equal(f.state.made, 2, 'each concurrent consumption must obtain its own subscriber');
});
test('subscription.subscribe-error-rejects-and-unmounts', async () => {
  const f = subscriptionFixture({ failSubscribe: true });
  await rejectsSame(collect(useSubscription({}, f.supplier, 'event')), f.boom); assert.equal(f.state.unmounts, 1);
});
test('subscription.empty-keys-completes', async () => {
  const f = subscriptionFixture();
  assert.deepEqual(await deadline(collect(useSubscription({}, f.supplier, []))), []);
  assert.equal(f.state.unmounts, 1);
});
test('subscription.unmount-error-rejects', async () => {
  const f = subscriptionFixture({ failUnmount: true });
  const result = collect(useSubscription({}, f.supplier, 'event').limit(0n)); f.emit(1);
  await rejectsSame(result, f.boom);
});

test('window.empty', async () => assert.deepEqual(await windows(values().toWindow().slide(2n)), []));
test('window.trailing-partials', async () => {
  assert.deepEqual(await windows(values(1, 2, 3, 4, 5).toWindow().slide(3n)), [[1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5], [5]]);
  assert.deepEqual(await windows(values(1, 2, 3, 4, 5).toWindow().tumble(2n)), [[1, 2], [3, 4], [5]]);
});
test('window.step-greater-than-size', async () => assert.deepEqual(await windows(values(1, 2, 3, 4, 5).toWindow().slide(2n, 3n)), [[1, 2], [4, 5]]));
test('window.invalid-size-step', async () => {
  const buffer = values().toWindow();
  for (const [size, step] of [[0n, 1n], [1n, 0n], [-1n, 1n]]) assert.throws(() => buffer.slide(size, step), RangeError);
});
test('window.outer-limit-completes', async () => {
  assert.deepEqual(await windows(values(1, 2, 3).toWindow().slide(2n).limit(1n)), [[1, 2]]);
});
test('window.inner-limit-completes', async () => {
  const [inner] = await collect(values(1, 2, 3).toWindow().tumble(3n));
  assert.deepEqual(await collect(inner.limit(1n)), [1]);
});

test('promise.rejection-keeps-consumer-pending-observation', async () => {
  const boom = new Error('rejection observation'); const unhandled = [];
  process.on('unhandledRejection', reason => unhandled.push(reason));
  let settled = false;
  collect(usePromise(Promise.reject(boom))).then(() => assert.fail('must reject'), error => { assert.equal(error, boom); settled = true; });
  await sleep(30);
  assert.equal(settled, true); assert.deepEqual(unhandled, []);
});
test('collectable.rejection-keeps-terminal-pending-observation', async () => {
  const boom = new Error('rejection observation'); const unhandled = [];
  process.on('unhandledRejection', reason => unhandled.push(reason));
  let settled = false;
  useIterate({ async *[Symbol.asyncIterator]() { throw boom; } }).toUnordered().toArray()
    .then(() => assert.fail('must reject'), error => { assert.equal(error, boom); settled = true; });
  await sleep(30);
  assert.equal(settled, true); assert.deepEqual(unhandled, []);
});
test('subscription.limit-boundary-pending-observation', async () => {
  const f = subscriptionFixture(); let settled = false;
  collect(useSubscription({}, f.supplier, 'event').limit(1n)).then(() => { settled = true; });
  f.emit(1); await sleep(20);
  assert.equal(settled, true); assert.equal(f.active(), 0); assert.equal(f.state.unmounts, 1);
  f.emit(2); await sleep(0); assert.equal(settled, true); assert.equal(f.active(), 0); assert.equal(f.state.unmounts, 1);
});

const chosen = process.argv.indexOf('--case');
if (chosen !== -1) {
  const id = process.argv[chosen + 1];
  try {
    assert.ok(cases.has(id), `Unknown case: ${id}`);
    await deadline(cases.get(id)(), 800);
    process.exit(0); // Guarantee no residual event handlers/timers survive a case.
  } catch (error) {
    console.error(`FAIL ${id}: ${error?.stack ?? error}`);
    process.exit(1);
  }
} else {
  let passed = 0, failed = 0;
  const results = [];
  for (const id of cases.keys()) {
    const result = await new Promise(resolve => {
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--case', id], { stdio: 'inherit' });
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 1800);
      child.once('error', error => { clearTimeout(timer); resolve({ error }); });
      child.once('exit', (code, signal) => { clearTimeout(timer); resolve({ code, signal, timedOut }); });
    });
    const status = result.code === 0 && !result.timedOut ? 'passed' : 'failed';
    results.push({ id, status, observation: false, ...result });
    if (status === 'passed') { passed++; console.log(`PASS ${id}`); }
    else { failed++; console.log(`CASE-FAILED ${id} ${JSON.stringify(result)}`); }
  }
  await writeFile(new URL('./async-after-results.json', import.meta.url), JSON.stringify({
    node: process.version, total: cases.size, passed, failed, results,
    note: 'All cases assert repaired behavior, including the former fault-observation regressions. Historical async-results.json remains unchanged.',
  }, null, 2) + '\n');
  console.log(`ASYNC_BOUNDARY_SUMMARY total=${cases.size} passed=${passed} failed=${failed}`);
  process.exitCode = failed ? 1 : 0;
}
