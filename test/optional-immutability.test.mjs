import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as ST from "semantic-typescript";
describe("Optional 不可变性（回归：不得冻结全局内置原型）", () => {
    test("导入包不会冻结 Function.prototype", () => {
        // 回归：Object.freeze(Object.getPrototypeOf(Optional)) 在模块求值期冻结了
        // 共享的 Function.prototype，导致所有后续对函数原型的扩展都抛 TypeError。
        assert.equal(Object.getPrototypeOf(ST.Optional), Function.prototype);
        assert.equal(Object.isFrozen(Function.prototype), false);
        assert.equal(Object.isExtensible(Function.prototype), true);
        const call = Object.getOwnPropertyDescriptor(Function.prototype, "call");
        assert.equal(call.writable, true);
        assert.equal(call.configurable, true);
        assert.equal(Object.isFrozen(Object.prototype), false);
    });
    test("导入后 Function.prototype 仍可扩展", () => {
        const key = "__semanticOptionalProbe";
        try {
            Object.defineProperty(Function.prototype, key, {
                value: 1,
                writable: true,
                configurable: true
            });
            assert.equal(Function.prototype[key], 1);
        }
        finally {
            delete Function.prototype[key];
        }
        assert.equal(Object.isExtensible(Function.prototype), true);
    });
    test("Optional 实例仍然被冻结，字段无法改写或新增", () => {
        const optional = ST.Optional.of(42);
        assert.equal(Object.isFrozen(optional), true);
        assert.equal(optional.isPresent(), true);
        assert.equal(optional.get(), 42);
        // ES 模块处于严格模式：写入被冻结对象会抛 TypeError，而不是静默失败。
        assert.throws(() => { optional.value = 0; }, TypeError);
        assert.throws(() => { optional.injected = true; }, TypeError);
        assert.equal(optional.get(), 42);
        assert.equal(optional.injected, undefined);
    });
    test("Optional 类与其自身原型仍然被冻结", () => {
        assert.equal(Object.isFrozen(ST.Optional), true);
        assert.equal(Object.isFrozen(ST.Optional.prototype), true);
    });
});
