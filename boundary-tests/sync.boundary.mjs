import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as ST from "semantic-typescript";

const values = (...items) => ST.useOf(...items);
const collect = (semantic) => semantic.toUnordered();
const nested = (windows) => collect(windows).toArray().map((window) => window.toUnordered().toArray());

// Keep pathological iterators isolated so a short-circuit regression cannot hang node:test.
function isolatedInfiniteFlatten(operation) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", `
    import * as ST from "semantic-typescript";
    const assert = (await import("node:assert/strict")).default;
    let pulls = 0;
    let closed = 0;
    function* forever() { try { while (true) yield pulls++; } finally { closed++; } }
    assert.deepEqual(ST.useOf(1)[${JSON.stringify(operation)}](() => forever()).limit(1).toUnordered().toArray(), [0]);
    assert.equal(pulls, 1);
    assert.equal(closed, 1);
  `], { cwd: new URL("../", import.meta.url), timeout: 1500, stdio: "ignore" });
}

test("empty and singleton sync boundaries", async (t) => {
  await t.test("empty operators and terminals", () => {
    assert.deepEqual(collect(values()).toArray(), []);
    assert.deepEqual(collect(values().concat([])).toArray(), []);
    assert.deepEqual(collect(values().flatMap(() => [])).toArray(), []);
    assert.deepEqual(values().sub(0, 3).toUnordered().toArray(), []);
    assert.deepEqual(values().limit(0).toUnordered().toArray(), []);
    assert.deepEqual(values().skip(0).toUnordered().toArray(), []);
    assert.equal(collect(values()).reduce((a, b) => a + b).isPresent(), false);
    assert.deepEqual(nested(ST.useEmpty().toWindow().slide(2n)), []);
  });
  await t.test("singleton indexing, find and reduce", () => {
    assert.deepEqual(values(7).map((_x, i) => i).toUnordered().toArray(), [0n]);
    assert.equal(collect(values(7)).findAt(0).orElse(-1), 7);
    assert.equal(collect(values(7)).findAt(1n).isPresent(), false);
    assert.equal(collect(values(7)).findNegativeAt(-1).orElse(-1), 7);
    assert.equal(collect(values(7)).reduce((a, b) => a + b).get(), 7);
    assert.deepEqual(nested(ST.useOf(7).toWindow().tumble(2n)), [[7]]);
  });
});

test("index bounds and slices", async (t) => {
  await t.test("negative and out-of-range indexes", () => {
    assert.throws(() => collect(values(1, 2)).findAt(-1), /negative index/i);
    assert.throws(() => collect(values(1, 2)).findNegativeAt(0), /negative index/i);
    // Contract does not specify whether overly negative offsets wrap; assert behavior separately in report.
    assert.deepEqual(values(1, 2, 3).sub(-2, 99).toUnordered().toArray(), [1, 2, 3]);
    assert.deepEqual(values(1, 2, 3).sub(99, 100).toUnordered().toArray(), []);
    assert.deepEqual(values(1, 2, 3).sub(2, 2).toUnordered().toArray(), []);
    assert.deepEqual(values(1, 2, 3).sub(3, 1).toUnordered().toArray(), [2, 3]);
  });
  await t.test("large position and count boundary", () => {
    assert.equal(collect(values(1, 2)).findAt(1_000_000).isPresent(), false);
    assert.deepEqual(values(1, 2).limit(1_000_000).toUnordered().toArray(), [1, 2]);
    assert.deepEqual(values(1, 2).skip(1_000_000).toUnordered().toArray(), []);
    assert.deepEqual(values(1, 2).sub(1_000_000, 2_000_000).toUnordered().toArray(), []);
  });
  await t.test("zero and negative skip/limit", () => {
    assert.deepEqual(values(1, 2, 3).skip(0).toUnordered().toArray(), [1, 2, 3]);
    assert.deepEqual(values(1, 2, 3).skip(-1).toUnordered().toArray(), [1, 2, 3]);
    assert.deepEqual(values(1, 2, 3).limit(0).toUnordered().toArray(), []);
    assert.deepEqual(values(1, 2, 3).limit(-1).toUnordered().toArray(), []);
  });
});

test("filter, skip, limit, concat and flatMap composition", async (t) => {
  await t.test("filter then skip/limit composition", () => {
    assert.deepEqual(values(1, 2, 3, 4, 5, 6).filter((x) => x % 2 === 0).skip(1).limit(2).toUnordered().toArray(), [4, 6]);
    assert.deepEqual(values(1, 2, 3, 4, 5, 6).skip(2).filter((x) => x % 2 === 0).limit(1).toUnordered().toArray(), [4]);
  });
  await t.test("concat preserves source then appended order", () => {
    assert.deepEqual(values(1, 2).concat([3, 4]).toUnordered().toArray(), [1, 2, 3, 4]);
    assert.deepEqual(values(1, 2).concat(ST.useOf(3, 4)).toUnordered().toArray(), [1, 2, 3, 4]);
    assert.deepEqual(values(1, 2).concat([3, 4]).map((_x, i) => i).toUnordered().toArray(), [0n, 1n, 2n, 3n]);
  });
  await t.test("flatMap reindexes flattened elements and preserves order", () => {
    assert.deepEqual(values(2, 1, 3).flatMap((x) => [x, -x]).toUnordered().toArray(), [2, -2, 1, -1, 3, -3]);
    assert.deepEqual(values(2, 1, 3).flatMap((x) => [x, -x]).map((_x, i) => i).toUnordered().toArray(), [0n, 1n, 2n, 3n, 4n, 5n]);
    assert.deepEqual(values(1, 2, 3).flatMap((x) => x === 2 ? [] : [x]).toUnordered().toArray(), [1, 3]);
  });
});

test("window validation and documented window boundaries", async (t) => {
  await t.test("rejects non-positive size and step", () => {
    const windows = ST.useOf(1, 2).toWindow();
    assert.throws(() => windows.slide(0n), RangeError);
    assert.throws(() => windows.slide(-1n), RangeError);
    assert.throws(() => windows.slide(1n, 0n), RangeError);
    assert.throws(() => windows.slide(1n, -1n), RangeError);
    assert.throws(() => windows.tumble(0n), RangeError);
    assert.throws(() => windows.tumble(-1n), RangeError);
    assert.throws(() => windows.tumble(1), RangeError);
  });
  await t.test("matches README tumble and trailing slide semantics", () => {
    const windows = ST.useOf(1, 2, 3, 4, 5).toWindow();
    assert.deepEqual(nested(windows.tumble(2n)), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(nested(windows.slide(3n, 1n)), [[1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5], [5]]);
  });
  await t.test("step greater than size leaves expected gaps", () => {
    assert.deepEqual(nested(ST.useOf(1, 2, 3, 4, 5, 6).toWindow().slide(2n, 3n)), [[1, 2], [4, 5]]);
  });
});

test("short-circuit laziness", async (t) => {
  await t.test("limit does not request an extra upstream element", () => {
    let produced = 0;
    const source = ST.useGenerate(() => produced++, () => false);
    assert.deepEqual(source.limit(2).toUnordered().toArray(), [0, 1]);
    assert.equal(produced, 3, "checks next element's interrupt before producing it");
  });
  await t.test("downstream limit stops an infinite synchronous source promptly", () => {
    let produced = 0;
    const source = ST.useGenerate(() => produced++, () => false);
    assert.deepEqual(source.limit(1).toUnordered().toArray(), [0]);
    assert.equal(produced, 2);
  });
  for (const operation of ["flat", "flatMap"]) {
    await t.test(`${operation} plus downstream limit terminates and closes an infinite inner iterable`, () => {
      const child = isolatedInfiniteFlatten(operation);
      assert.equal(child.error, undefined, child.error?.message);
      assert.equal(child.status, 0, child.signal === "SIGTERM" ? "child timed out" : `child exit ${child.status}, signal ${child.signal}`);
    });
  }
});
