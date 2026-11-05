import { test } from "node:test";
import assert from "node:assert/strict";
import * as ST from "semantic-typescript";

test("useTraverse hands every callback its own path instance", () => {
    const paths = [];
    ST.useTraverse({ a: { b: 1 }, c: [2, 3] }, (_key, _value, path) => {
        paths.push(path);
        return true;
    });

    assert.equal(paths.length, 3);

    // 1. Every call received a distinct array, not one shared and reused buffer.
    assert.notEqual(paths[0], paths[1]);
    assert.notEqual(paths[1], paths[2]);
    assert.notEqual(paths[0], paths[2]);
    assert.equal(new Set(paths).size, 3);
});

test("useTraverse path contents follow traversal order and outlive the walk", () => {
    const paths = [];
    ST.useTraverse({ a: { b: 1 }, c: [2, 3] }, (_key, _value, path) => {
        paths.push(path);
        return true;
    });

    // 2. Each snapshot holds what the walk looked like at that leaf, and entries
    //    differ from one another instead of all collapsing onto the last state.
    assert.deepEqual(paths.map((path) => [...path]), [["a", "b"], ["c", 0], ["c", 1]]);

    // 3. The retained snapshots are still intact after traversal finished; a
    //    later walk over another target cannot reach into them either.
    assert.deepEqual(paths.map((path) => [...path]), [["a", "b"], ["c", 0], ["c", 1]]);
    ST.useTraverse({ z: { y: 1 } }, () => true);
    assert.deepEqual(paths.map((path) => [...path]), [["a", "b"], ["c", 0], ["c", 1]]);
});

test("useTraverse path snapshots are frozen at runtime", () => {
    const frozen = [];
    ST.useTraverse({ a: { b: 1 }, c: [2, 3] }, (_key, _value, path) => {
        frozen.push(Object.isFrozen(path));
        // 4. Strict mode turns a write to the frozen snapshot into a TypeError,
        //    so a caller cannot corrupt a path that was already handed out.
        assert.throws(() => { path.push("injected"); }, TypeError);
        assert.throws(() => { path[0] = "injected"; }, TypeError);
        assert.throws(() => { path.length = 0; }, TypeError);
        return true;
    });
    assert.deepEqual(frozen, [true, true, true]);
});

test("useAttribute ignores the path and keeps reporting the same leaves", () => {
    const target = { a: 1, b: { c: 2 }, d: [3, 4] };
    const attributes = ST.useAttribute(target).toUnordered().toArray();
    assert.deepEqual(
        attributes.map((entry) => `${String(entry.key)}=${String(entry.value)}`),
        ["a=1", "c=2", "0=3", "1=4"],
    );

    // The same leaves, in the same order, as walking the object directly.
    const leaves = [];
    ST.useTraverse(target, (key, value) => {
        leaves.push(`${String(key)}=${String(value)}`);
        return true;
    });
    assert.deepEqual(leaves, ["a=1", "c=2", "0=3", "1=4"]);
});
