import { describe, test } from "node:test";
import assert from "node:assert/strict";
// 回归：src/optional.ts 曾经在模块求值期执行
// Object.freeze(Object.getPrototypeOf(Optional))，而基类的 [[Prototype]] 就是
// 共享的 Function.prototype，导致整个进程的函数原型被冻结。
// 本测试把「导入不得改动任何内置对象」固化为项目级不变量。
const targets = new Map([
    ["Object", Object],
    ["Function", Function],
    ["Array", Array],
    ["String", String],
    ["Number", Number],
    ["Boolean", Boolean],
    ["Symbol", Symbol],
    ["BigInt", BigInt],
    ["Promise", Promise],
    ["Date", Date],
    ["RegExp", RegExp],
    ["Map", Map],
    ["Set", Set],
    ["WeakMap", WeakMap],
    ["WeakSet", WeakSet],
    ["ArrayBuffer", ArrayBuffer],
    ["Uint8Array", Uint8Array],
    ["DataView", DataView],
    ["Error", Error],
    ["TypeError", TypeError],
    ["RangeError", RangeError],
    ["AggregateError", AggregateError],
    ["Math", Math],
    ["JSON", JSON],
    ["Reflect", Reflect],
    ["Intl", Intl],
    ["console", console],
    ["Object.prototype", Object.prototype],
    ["Function.prototype", Function.prototype],
    ["Array.prototype", Array.prototype],
    ["String.prototype", String.prototype],
    ["Number.prototype", Number.prototype],
    ["Boolean.prototype", Boolean.prototype],
    ["Symbol.prototype", Symbol.prototype],
    ["BigInt.prototype", BigInt.prototype],
    ["Promise.prototype", Promise.prototype],
    ["Date.prototype", Date.prototype],
    ["RegExp.prototype", RegExp.prototype],
    ["Map.prototype", Map.prototype],
    ["Set.prototype", Set.prototype],
    ["WeakMap.prototype", WeakMap.prototype],
    ["WeakSet.prototype", WeakSet.prototype],
    ["ArrayBuffer.prototype", ArrayBuffer.prototype],
    ["Uint8Array.prototype", Uint8Array.prototype],
    ["DataView.prototype", DataView.prototype],
    ["Error.prototype", Error.prototype],
    ["globalThis", globalThis]
]);
const propertyStateOf = (object, key) => {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return "value" in descriptor
        ? {
            kind: "data",
            value: descriptor.value,
            writable: descriptor.writable,
            enumerable: descriptor.enumerable,
            configurable: descriptor.configurable
        }
        : {
            kind: "accessor",
            get: descriptor.get,
            set: descriptor.set,
            enumerable: descriptor.enumerable,
            configurable: descriptor.configurable
        };
};
const snapshotOf = (source) => new Map([...source].map(([name, object]) => [name, {
    frozen: Object.isFrozen(object),
    sealed: Object.isSealed(object),
    extensible: Object.isExtensible(object),
    properties: new Map(Reflect.ownKeys(object).map((key) => [key, propertyStateOf(object, key)]))
}]));
const differencesOf = (before, after) => {
    const differences = [];
    for (const [name, oldState] of before) {
        const newState = after.get(name);
        for (const flag of ["frozen", "sealed", "extensible"]) {
            if (oldState[flag] !== newState[flag]) {
                differences.push(`${name}: ${flag} ${oldState[flag]} -> ${newState[flag]}`);
            }
        }
        for (const [key, oldProperty] of oldState.properties) {
            if (!newState.properties.has(key)) {
                differences.push(`${name}: removed ${String(key)}`);
                continue;
            }
            const newProperty = newState.properties.get(key);
            if (oldProperty.kind !== newProperty.kind) {
                differences.push(`${name}.${String(key)}: data/accessor kind changed`);
            }
            else if (oldProperty.kind === "data") {
                if (!Object.is(oldProperty.value, newProperty.value)) {
                    differences.push(`${name}.${String(key)}: value changed`);
                }
            }
            else if (!Object.is(oldProperty.get, newProperty.get) || !Object.is(oldProperty.set, newProperty.set)) {
                differences.push(`${name}.${String(key)}: accessor changed`);
            }
            for (const attribute of ["writable", "enumerable", "configurable"]) {
                if (oldProperty[attribute] !== newProperty[attribute]) {
                    differences.push(`${name}.${String(key)}: ${attribute} ${oldProperty[attribute]} -> ${newProperty[attribute]}`);
                }
            }
        }
        for (const key of newState.properties.keys()) {
            if (!oldState.properties.has(key)) {
                differences.push(`${name}: added ${String(key)}`);
            }
        }
    }
    return differences;
};
const warmUpGlobalThis = () => {
    // Node 在首次逐项读取 globalThis 描述符时会懒安装 undici 调度器符号；
    // 先预热，避免把探针自身的副作用误判为包的副作用。
    for (const key of Reflect.ownKeys(globalThis)) Object.getOwnPropertyDescriptor(globalThis, key);
};
describe("导入副作用（全局内置对象不被污染）", () => {
    test("导入整包不冻结、不密封、不扩展、不改写任何内置对象", async () => {
        warmUpGlobalThis();
        const before = snapshotOf(targets);
        await import("semantic-typescript");
        const after = snapshotOf(targets);
        const differences = differencesOf(before, after);
        assert.deepEqual(differences, [], `导入 semantic-typescript 时改动了内置对象：\n${differences.join("\n")}`);
    });
});
