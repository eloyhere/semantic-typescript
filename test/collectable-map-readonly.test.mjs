import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as ST from "semantic-typescript";

describe("无序 collectable 缓冲区不可变", () => {
    test("同步缓冲区不能通过 Map mutator 修改", () => {
        const collectable = ST.useOf("a", "b", "c").toUnordered();
        const buffer = collectable.buffer;
        assert.deepEqual(collectable.toArray(), ["a", "b", "c"]);
        assert.throws(() => buffer.set(10n, "injected"), TypeError);
        assert.throws(() => buffer.delete(0n), TypeError);
        assert.throws(() => buffer.clear(), TypeError);
        assert.throws(() => Map.prototype.clear.call(buffer), TypeError);
        assert.equal(buffer.valueOf(), buffer);
        assert.deepEqual(collectable.toArray(), ["a", "b", "c"]);
        assert.equal(buffer.size, 3);
    });

    test("异步缓冲区完成后不能通过 Map mutator 修改", async () => {
        const collectable = ST.useFrom((async function* () {
            yield "a";
            yield "b";
        })()).toUnordered();
        assert.deepEqual(await collectable.toArray(), ["a", "b"]);
        const buffer = collectable.buffer;
        assert.throws(() => buffer.set(10n, "injected"), TypeError);
        assert.throws(() => buffer.delete(0n), TypeError);
        assert.throws(() => buffer.clear(), TypeError);
        assert.throws(() => Map.prototype.clear.call(buffer), TypeError);
        assert.equal(buffer.valueOf(), buffer);
        assert.deepEqual(await collectable.toArray(), ["a", "b"]);
        assert.equal(buffer.size, 2);
    });
});
