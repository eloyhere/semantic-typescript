import test from "node:test";
import assert from "node:assert/strict";
import * as api from "../dist/index.js";

const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const collectable = (...elements) => api.useOf(...elements).toCollectable();
const asyncCollectable = (...elements) => api.useFrom((async function* () {
    for (const element of elements) {
        yield element;
    }
})()).toCollectable();

const newFactories = ["ToOrderedSet", "ToUnorderedSet", "ToOrderedMap", "ToUnorderedMap", "ToList", "ToCycle",
    "ToLRUSet", "ToLRUMap", "ToSkipSet", "ToSkipMap", "ToBinarySearchTree", "ToRootedForest"];

test("every terminal method is backed by its own exported collector factory", () => {
    for (const suffix of newFactories) {
        assert.equal(typeof api[`useSynchronous${suffix}`], "function", `useSynchronous${suffix}`);
        assert.equal(typeof api[`useAsynchronous${suffix}`], "function", `useAsynchronous${suffix}`);
    }
});

test("toOrderedSet returns a comparator-ordered SynchronousOrderedSet", () => {
    const set = collectable(3, 1, 2, 2).toOrderedSet(compare);
    assert.equal(set instanceof api.SynchronousOrderedSet, true);
    assert.equal(api.isSynchronousOrderedSet(set), true);
    assert.deepEqual(set.toArray(), [1, 2, 3], "iterates comparator-ascending, not encounter order");
    assert.equal(set.contains(2), true);
});

test("toUnorderedSet returns a SameValueZero SynchronousUnorderedSet", () => {
    const shared = {};
    const set = collectable(NaN, NaN, shared, shared, 0, -0).toUnorderedSet();
    assert.equal(set instanceof api.SynchronousUnorderedSet, true);
    assert.equal(api.isSynchronousUnorderedSet(set), true);
    assert.equal(set.size(), 3n);
    assert.equal(set.contains(NaN), true);
    assert.equal(set.contains(shared), true);
});

test("toOrderedMap keeps insertion order and the last value per key", () => {
    const map = collectable(3, 1, 3).toOrderedMap((element) => element, (element) => `v${element}`);
    assert.equal(map instanceof api.SynchronousOrderedMap, true);
    assert.equal(api.isSynchronousOrderedMap(map), true);
    assert.deepEqual([...map.keySet()], [3, 1], "first occurrence fixes insertion order");
    assert.equal(map.get(3).get(), "v3", "later duplicate replaces the value in place");
});

test("toUnorderedMap returns a SynchronousUnorderedMap with the last value per key", () => {
    const map = collectable(3, 1, 3).toUnorderedMap((element) => element);
    assert.equal(map instanceof api.SynchronousUnorderedMap, true);
    assert.equal(api.isSynchronousUnorderedMap(map), true);
    assert.equal(map.size(), 2n);
    assert.equal(map.containsKey(1), true);
    assert.equal(map.get(3).get(), 3);
});

test("toList returns a SynchronousList in encounter order with duplicates", () => {
    const list = collectable(3, 1, 2, 2).toList();
    assert.equal(list instanceof api.SynchronousList, true);
    assert.equal(api.isSynchronousList(list), true);
    assert.deepEqual(list.toArray(), [3, 1, 2, 2]);
    assert.equal(list.get(2n), 2);
    assert.throws(() => api.useFrom([1, null]).toCollectable().toList(), TypeError);
});

test("toCycle returns a SynchronousCycle with source order and span", () => {
    const cycle = collectable(3, 1, 2).toCycle(2);
    assert.equal(cycle instanceof api.SynchronousCycle, true);
    assert.deepEqual(cycle.toArray(), [3, 1, 2], "encounter order fixes ring positions");
    assert.equal(cycle.getSpan(), 2);
    assert.equal(cycle.phaseAt(0n).get().toString(), cycle.phaseAt(3n).get().toString(), "ring is n-periodic");
    assert.throws(() => collectable(1).toCycle(0), RangeError);
});

test("toLRUSet returns a bounded SynchronousUnorderedLRUSet with recency eviction", () => {
    const set = collectable(1, 2, 3).toLRUSet(2n);
    assert.equal(set instanceof api.SynchronousUnorderedLRUSet, true);
    assert.equal(api.isSynchronousUnorderedLRUSet(set), true);
    assert.equal(set.capacity(), 2n);
    assert.equal(set.contains(1), false, "first inserted element is least recently used and evicted");
    assert.equal(set.add(2), false, "re-adding an element only refreshes its recency");
    assert.equal(set.add(4), true);
    assert.equal(set.contains(3), false, "the untouched element is evicted next");
    assert.equal(set.contains(2), true);
    assert.throws(() => collectable(1).toLRUSet(0n), RangeError);
});

test("toLRUMap returns a bounded SynchronousUnorderedLRUMap with recency eviction", () => {
    const map = collectable(1, 2, 3).toLRUMap(2n, (element) => element);
    assert.equal(map instanceof api.SynchronousUnorderedLRUMap, true);
    assert.equal(api.isSynchronousUnorderedLRUMap(map), true);
    assert.equal(map.capacity(), 2n);
    assert.equal(map.containsKey(1), false);
    assert.equal(map.containsKey(2), true);
    assert.equal(map.get(3).get(), 3);
});

test("toSkipSet returns a comparator-ordered SynchronousSkipSet", () => {
    const set = collectable(3, 1, 2).toSkipSet(compare);
    assert.equal(set instanceof api.SynchronousSkipSet, true);
    assert.equal(api.isSynchronousSkipSet(set), true);
    assert.deepEqual(set.toArray(), [1, 2, 3], "iteration follows the comparator");
    assert.equal(set.first().get(), 1);
    assert.equal(set.last().get(), 3);
    assert.equal(set.higher(1).get(), 2);
    assert.deepEqual(set.subSet(1, 3).toArray(), [1, 2]);
});

test("toSkipMap returns a key-ordered SynchronousSkipMap", () => {
    const map = collectable(3, 1, 2).toSkipMap(compare, (element) => element, (element) => `v${element}`);
    assert.equal(map instanceof api.SynchronousSkipMap, true);
    assert.equal(api.isSynchronousSkipMap(map), true);
    assert.equal(map.firstEntry().get().getKey(), 1);
    assert.equal(map.lastEntry().get().getKey(), 3);
    assert.equal(map.get(2).get(), "v2");
    const defaulted = collectable(3, 1, 2).toSkipMap((element) => element);
    assert.equal(defaulted.size(), 3n);
    assert.equal(defaulted.get(1).get(), 1);
});

test("toBinarySearchTree returns a comparator-ordered SynchronousBinarySearchTree", () => {
    const tree = collectable(3, 1, 2, 2).toBinarySearchTree(compare);
    assert.equal(tree instanceof api.SynchronousBinarySearchTree, true);
    assert.deepEqual([...tree.inorder()].map((node) => node.getElement().get()), [1, 2, 2, 3]);
    assert.equal(tree.size(), 4n, "duplicates are retained");
});

test("toRootedForest returns a SynchronousRootedForest preserving encounter order", () => {
    const forest = collectable(3, 1, 2).toRootedForest();
    assert.equal(forest instanceof api.SynchronousRootedForest, true);
    assert.equal(forest.size(), 3n);
    assert.deepEqual(forest.toArray(), [3, 1, 2]);
    assert.equal(forest.getRoots().length >= 1, true);
    assert.equal([...forest.preorder()].length, 3);
});

test("toOrderedSet returns a Promise of an AsynchronousOrderedSet", async () => {
    const pending = asyncCollectable(3, 1, 2, 2).toOrderedSet(compare);
    assert.equal(pending instanceof Promise, true);
    const set = await pending;
    assert.equal(set instanceof api.AsynchronousOrderedSet, true);
    assert.equal(api.isAsynchronousOrderedSet(set), true);
    assert.deepEqual(await set.toArray(), [1, 2, 3]);
});

test("toUnorderedSet returns a Promise of an AsynchronousUnorderedSet", async () => {
    const set = await asyncCollectable(NaN, NaN, 1, 1).toUnorderedSet();
    assert.equal(set instanceof api.AsynchronousUnorderedSet, true);
    assert.equal(api.isAsynchronousUnorderedSet(set), true);
    assert.equal(await set.size(), 2n);
    assert.equal(await set.contains(NaN), true);
});

test("toOrderedMap returns a Promise of an AsynchronousOrderedMap", async () => {
    const map = await asyncCollectable(3, 1, 3).toOrderedMap((element) => element, (element) => `v${element}`);
    assert.equal(map instanceof api.AsynchronousOrderedMap, true);
    assert.equal(api.isAsynchronousOrderedMap(map), true);
    assert.deepEqual(await (await map.keySet()).toArray(), [3, 1]);
    assert.equal(await map.get(3), "v3");
});

test("toUnorderedMap returns a Promise of an AsynchronousUnorderedMap", async () => {
    const map = await asyncCollectable(3, 1, 3).toUnorderedMap((element) => element);
    assert.equal(map instanceof api.AsynchronousUnorderedMap, true);
    assert.equal(api.isAsynchronousUnorderedMap(map), true);
    assert.equal(await map.size(), 2n);
    assert.equal(await map.containsKey(1), true);
    assert.equal(await map.get(3), 3);
});

test("toList returns a Promise of an AsynchronousList", async () => {
    const list = await asyncCollectable(3, 1, 2, 2).toList();
    assert.equal(list instanceof api.AsynchronousList, true);
    assert.equal(api.isAsynchronousList(list), true);
    assert.deepEqual(await list.toArray(), [3, 1, 2, 2]);
});

test("toCycle returns a Promise of an AsynchronousCycle", async () => {
    const cycle = await asyncCollectable(3, 1, 2).toCycle(2);
    assert.equal(cycle instanceof api.AsynchronousCycle, true);
    assert.deepEqual(await cycle.toArray(), [3, 1, 2]);
    assert.equal(cycle.getSpan(), 2);
    assert.equal((await cycle.phaseAt(0n)).get().toString(), (await cycle.phaseAt(3n)).get().toString());
});

test("toLRUSet returns a Promise of an AsynchronousUnorderedLRUSet", async () => {
    const set = await asyncCollectable(1, 2, 3).toLRUSet(2n);
    assert.equal(set instanceof api.AsynchronousUnorderedLRUSet, true);
    assert.equal(api.isAsynchronousUnorderedLRUSet(set), true);
    assert.equal(await set.capacity(), 2n);
    assert.equal(await set.contains(1), false);
    assert.equal(await set.add(2), false);
    assert.equal(await set.add(4), true);
    assert.equal(await set.contains(3), false);
});

test("toLRUMap returns a Promise of an AsynchronousUnorderedLRUMap", async () => {
    const map = await asyncCollectable(1, 2, 3).toLRUMap(2n, (element) => element);
    assert.equal(map instanceof api.AsynchronousUnorderedLRUMap, true);
    assert.equal(api.isAsynchronousUnorderedLRUMap(map), true);
    assert.equal(await map.capacity(), 2n);
    assert.equal(await map.containsKey(1), false);
    assert.equal(await map.get(3), 3);
});

test("toSkipSet returns a Promise of an AsynchronousSkipSet", async () => {
    const set = await asyncCollectable(3, 1, 2).toSkipSet(compare);
    assert.equal(set instanceof api.AsynchronousSkipSet, true);
    assert.equal(api.isAsynchronousSkipSet(set), true);
    assert.deepEqual(await set.toArray(), [1, 2, 3]);
    assert.equal(await set.first(), 1);
    assert.equal(await set.last(), 3);
    assert.equal(await set.higher(1), 2);
});

test("toSkipMap returns a Promise of an AsynchronousSkipMap", async () => {
    const map = await asyncCollectable(3, 1, 2).toSkipMap(compare, (element) => element, (element) => `v${element}`);
    assert.equal(map instanceof api.AsynchronousSkipMap, true);
    assert.equal(api.isAsynchronousSkipMap(map), true);
    assert.equal(await map.size(), 3n);
    const first = await map.firstEntry();
    assert.equal(await first.getKey(), 1);
    assert.equal(await map.get(2), "v2");
    const defaulted = await asyncCollectable(3, 1, 2).toSkipMap((element) => element);
    assert.equal(await defaulted.size(), 3n);
});

test("toBinarySearchTree returns a Promise of an AsynchronousBinarySearchTree", async () => {
    const tree = await asyncCollectable(3, 1, 2, 2).toBinarySearchTree(compare);
    assert.equal(tree instanceof api.AsynchronousBinarySearchTree, true);
    assert.deepEqual([...tree.inorder()].map((node) => node.getElement().get()), [1, 2, 2, 3]);
    assert.equal(await tree.size(), 4n);
});

test("toRootedForest returns a Promise of an AsynchronousRootedForest", async () => {
    const forest = await asyncCollectable(3, 1, 2).toRootedForest();
    assert.equal(forest instanceof api.AsynchronousRootedForest, true);
    assert.equal(await forest.size(), 3n);
    assert.deepEqual(await forest.toArray(), [3, 1, 2]);
    assert.equal((await forest.getRoots()).length >= 1, true);
});

test("every asynchronous terminal resolves through a promise, never a bare structure", () => {
    const calls = [
        (collectable) => collectable.toOrderedSet(compare),
        (collectable) => collectable.toUnorderedSet(),
        (collectable) => collectable.toOrderedMap((element) => element),
        (collectable) => collectable.toUnorderedMap((element) => element),
        (collectable) => collectable.toList(),
        (collectable) => collectable.toCycle(),
        (collectable) => collectable.toLRUSet(4n),
        (collectable) => collectable.toLRUMap(4n, (element) => element),
        (collectable) => collectable.toSkipSet(compare),
        (collectable) => collectable.toSkipMap(compare, (element) => element, (element) => element),
        (collectable) => collectable.toBinarySearchTree(compare),
        (collectable) => collectable.toRootedForest(),
    ];
    for (const call of calls) {
        assert.equal(call(asyncCollectable(1, 2)).constructor, Promise);
    }
});

test("the existing toSet and toMap terminals keep their native structures", () => {
    const collectable = api.useOf(1, 2, 2).toCollectable();
    assert.equal(collectable.toSet() instanceof Set, true);
    assert.equal(collectable.toSet().size, 2);
    assert.equal(collectable.toMap((element) => element) instanceof Map, true);
    assert.equal(collectable.toMap((element) => element).get(2), 2);
});

test("nullish elements still fail at the new structure terminals", () => {
    const collectable = api.useFrom([1, null]).toCollectable();
    assert.throws(() => collectable.toList(), TypeError);
    assert.throws(() => collectable.toCycle(), TypeError);
    assert.throws(() => collectable.toBinarySearchTree(), TypeError);
    assert.throws(() => collectable.toRootedForest(), TypeError);
    assert.throws(() => collectable.toOrderedMap((element) => element, () => null), TypeError);
});
