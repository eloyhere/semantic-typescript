import test from "node:test";
import assert from "node:assert/strict";
import * as api from "../dist/index.js";

const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const unwrap = async value => {
    const resolved = await value;
    return resolved && typeof resolved.get === "function" ? resolved.get() : resolved;
};

test("SynchronousOrderedSet dedupes by comparator and iterates ascending", () => {
    const set = new api.SynchronousOrderedSet([3, 1, 2, 1], { comparator: compare });
    assert.deepEqual(set.toArray(), [1, 2, 3]);
    assert.equal(set.add(2), false);
    assert.equal(set.add(0), true);
    assert.deepEqual(set.toArray(), [0, 1, 2, 3]);
    assert.equal(api.isSynchronousOrderedSet(set), true);
});

test("AsynchronousOrderedSet default order handles mixed primitive values", async () => {
    const set = new api.AsynchronousOrderedSet(["b", 2n, 1, true]);
    assert.deepEqual(await set.toArray(), [true, 1, 2n, "b"]);
    assert.equal(await set.add(1), false);
    assert.equal(await set.contains("b"), true);
    assert.equal(api.isAsynchronousOrderedSet(set), true);
});

test("OrderedSet membership uses comparator equality for non-identical keys", () => {
    const set = new api.SynchronousOrderedSet([{ id: 2 }, { id: 1 }], {
        comparator: (left, right) => left.id - right.id,
    });
    assert.equal(set.contains({ id: 1 }), true);
    assert.equal(set.remove({ id: 2 }), true);
    assert.deepEqual(set.toArray().map(value => value.id), [1]);
});

test("SynchronousUnorderedSet dedupes NaN and signed zero with SameValueZero", () => {
    const left = {};
    const right = {};
    const set = new api.SynchronousUnorderedSet([NaN, NaN, 0, -0, left, right, undefined, null]);
    assert.equal(set.size(), 6n);
    assert.equal(set.contains(NaN), true);
    assert.equal(set.contains(0), true);
    assert.equal(set.contains(-0), true);
    assert.equal(set.contains(left), true);
    assert.equal(set.remove(NaN), true);
    assert.equal(set.contains(NaN), false);
    assert.equal(api.isSynchronousUnorderedSet(set), true);
});

test("AsynchronousUnorderedSet accepts many elements and removes by value", async () => {
    const values = Array.from({ length: 5000 }, (_value, index) => index);
    const set = new api.AsynchronousUnorderedSet(values);
    assert.equal(await set.size(), 5000n);
    assert.equal(await set.contains(4999), true);
    assert.equal(await set.remove(2500), true);
    assert.equal(await set.contains(2500), false);
    assert.equal(await set.size(), 4999n);
    assert.equal(api.isAsynchronousUnorderedSet(set), true);
});

for (const prefix of ["Synchronous", "Asynchronous"]) {
    for (const [family, ordered] of [["OrderedLRUSet", true], ["UnorderedLRUSet", false]]) {
        const name = `${prefix}${family}`;
        test(`${name} keeps LRU eviction and its ordered/unordered brand`, async () => {
            const set = new api[name]([3n, 1n, 2n], { comparator: compare, capacity: 3n });
            assert.equal(api[`is${name}`](set), true);
            assert.equal(api[`is${prefix}LRUSet`](set), true);
            assert.equal(api[`is${prefix}${ordered ? "Ordered" : "Unordered"}Set`](set), true);
            assert.equal(await set.add(1n), false);
            assert.equal(await set.add(4n), true);
            assert.equal(await set.contains(3n), false);
            assert.equal(await set.size(), 3n);
        });
        test(`${name} reports the expected iteration order`, async () => {
            const set = new api[name]([3n, 1n, 2n], { comparator: compare, capacity: 10n });
            const values = await set.toArray();
            if (ordered) assert.deepEqual(values, [1n, 2n, 3n]);
            else assert.deepEqual([...values].sort(compare), [1n, 2n, 3n]);
        });
    }
    for (const [family, ordered] of [["OrderedSkipSet", true], ["UnorderedSkipSet", false]]) {
        const name = `${prefix}${family}`;
        test(`${name} keeps comparator navigation and its ordered/unordered brand`, async () => {
            const set = new api[name]([4n, 1n, 3n, 2n], { comparator: compare });
            assert.equal(api[`is${name}`](set), true);
            assert.equal(api[`is${prefix}SkipSet`](set), true);
            assert.equal(api[`is${prefix}${ordered ? "Ordered" : "Unordered"}Set`](set), true);
            assert.equal(await unwrap(set.first()), 1n);
            assert.equal(await unwrap(set.last()), 4n);
            assert.equal(await unwrap(set.floor(3n)), 3n);
            assert.equal(await unwrap(set.higher(3n)), 4n);
        });
        test(`${name} reports the expected iteration order`, async () => {
            const set = new api[name]([4n, 1n, 3n, 2n], { comparator: compare });
            const values = await set.toArray();
            if (ordered) assert.deepEqual(values, [1n, 2n, 3n, 4n]);
            else assert.deepEqual([...values].sort(compare), [1n, 2n, 3n, 4n]);
        });
    }
}
