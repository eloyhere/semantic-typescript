import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as ST from "semantic-typescript";

const classes = [
    { name: "SemanticError", constructor: ST.SemanticError, parent: Error, guard: ST.isSemanticError },
    { name: "IllegalOperationError", constructor: ST.IllegalOperationError, parent: ST.SemanticError, guard: ST.isIllegalOperationError },
    { name: "ValidationError", constructor: ST.ValidationError, parent: ST.SemanticError, guard: ST.isValidationError },
    { name: "IndexError", constructor: ST.IndexError, parent: ST.ValidationError, guard: ST.isIndexError },
    { name: "RangeError", constructor: ST.RangeError, parent: ST.ValidationError, guard: ST.isRangeError },
    { name: "ConfigurationError", constructor: ST.ConfigurationError, parent: ST.ValidationError, guard: ST.isConfigurationError },
    { name: "CapacityError", constructor: ST.CapacityError, parent: ST.SemanticError, guard: ST.isCapacityError },
    { name: "StateError", constructor: ST.StateError, parent: ST.SemanticError, guard: ST.isStateError },
    { name: "IllegalStateError", constructor: ST.IllegalStateError, parent: ST.StateError, guard: ST.isIllegalStateError },
    { name: "ConcurrencyError", constructor: ST.ConcurrencyError, parent: ST.SemanticError, guard: ST.isConcurrencyError },
    { name: "CollectionError", constructor: ST.CollectionError, parent: ST.SemanticError, guard: ST.isCollectionError },
    { name: "SerializationError", constructor: ST.SerializationError, parent: ST.SemanticError, guard: ST.isSerializationError },
    { name: "NumericError", constructor: ST.NumericError, parent: ST.SemanticError, guard: ST.isNumericError },
    { name: "ArithmeticError", constructor: ST.ArithmeticError, parent: ST.NumericError, guard: ST.isArithmeticError },
    { name: "PhaseError", constructor: ST.PhaseError, parent: ST.SemanticError, guard: ST.isPhaseError },
];

describe("语义错误类型树", () => {
    for (const { name, constructor, parent, guard } of classes) {
        test(`${name} 设置 name、继承层级并可被守卫识别`, () => {
            const error = new constructor("boom");

            assert.equal(error.name, name);
            assert.equal(error.message, "boom");
            assert.equal(error instanceof Error, true);
            assert.equal(error instanceof ST.SemanticError, true);
            assert.equal(error instanceof parent, true);
            assert.equal(guard(error), true);
            assert.equal(guard(new Error("plain")), false);
            assert.equal(guard(null), false);
            assert.equal(guard(undefined), false);
            assert.equal(guard({ name }), false);
        });

        test(`${name} 转发 cause 与 context`, () => {
            const cause = new Error("root cause");
            const context = { method: "add", index: 2, argument: "element" };
            const error = new constructor("boom", { cause, context });

            assert.equal(error.cause, cause);
            assert.deepEqual(error.context, context);
        });
    }

    test("直接原型链与类型树声明一致", () => {
        for (const { constructor, parent } of classes) {
            assert.equal(Object.getPrototypeOf(constructor.prototype), parent.prototype);
            assert.equal(Object.getPrototypeOf(constructor), parent);
        }
        assert.equal(Object.getPrototypeOf(ST.SemanticError.prototype), Error.prototype);
    });

    test("守卫沿继承链生效且不越级", () => {
        const indexError = new ST.IndexError("index 4");
        assert.equal(ST.isSemanticError(indexError), true);
        assert.equal(ST.isValidationError(indexError), true);
        assert.equal(ST.isIndexError(indexError), true);
        assert.equal(ST.isRangeError(indexError), false);
        assert.equal(ST.isConfigurationError(indexError), false);

        const stateError = new ST.IllegalStateError("not initialized");
        assert.equal(ST.isSemanticError(stateError), true);
        assert.equal(ST.isStateError(stateError), true);
        assert.equal(ST.isIllegalStateError(stateError), true);
        assert.equal(ST.isStateError(new ST.SemanticError("base")), false);

        const arithmeticError = new ST.ArithmeticError("division by zero");
        assert.equal(ST.isNumericError(arithmeticError), true);
        assert.equal(ST.isArithmeticError(arithmeticError), true);
        assert.equal(ST.isArithmeticError(new ST.NumericError("overflow")), false);

        assert.equal(ST.isValidationError(new ST.SemanticError("base")), false);
        assert.equal(ST.isSemanticError(new Error("plain")), false);
        assert.equal(ST.isSemanticError(null), false);
        assert.equal(ST.isSemanticError({ name: "SemanticError" }), false);
    });

    test("四个既有类保持原有名称与构造方式", () => {
        assert.equal(new ST.IllegalOperationError("unsupported").name, "IllegalOperationError");
        assert.equal(new ST.IllegalStateError("invalid state").name, "IllegalStateError");
        assert.equal(new ST.ArithmeticError("overflow").name, "ArithmeticError");
        assert.equal(new ST.RangeError("outside").name, "RangeError");
        assert.equal(new ST.IllegalStateError().message, "");
        assert.equal(ST.isIllegalOperationError(new ST.IllegalOperationError()), true);
        assert.equal(ST.isIllegalStateError(new ST.IllegalStateError()), true);
        assert.equal(ST.isArithmeticError(new ST.ArithmeticError()), true);
        assert.equal(ST.isRangeError(new ST.RangeError()), true);
    });

    test("语义 RangeError 与全局 RangeError 互不混淆", () => {
        const semantic = new ST.RangeError("range");
        const native = new globalThis.RangeError("native");

        assert.equal(semantic instanceof globalThis.RangeError, false);
        assert.equal(native instanceof ST.RangeError, false);
        assert.equal(semantic instanceof ST.ValidationError, true);
        assert.equal(ST.isRangeError(semantic), true);
        assert.equal(ST.isRangeError(native), false);
        assert.equal(ST.RangeError === globalThis.RangeError, false);
    });
});

describe("语义错误序列化", () => {
    test("toJSON 保留 name 与 message，省略空的 context/cause", () => {
        const error = new ST.ValidationError("bad argument");

        assert.deepEqual(error.toJSON(), {
            name: "ValidationError",
            message: "bad argument",
        });
        assert.deepEqual(JSON.parse(JSON.stringify(error)), error.toJSON());
    });

    test("toJSON 保留 context 与普通 Error 的 cause", () => {
        const cause = new Error("root cause");
        const error = new ST.SerializationError("cannot write", {
            cause,
            context: { path: "/tmp/a.json" },
        });
        const json = error.toJSON();

        assert.equal(json.name, "SerializationError");
        assert.equal(json.message, "cannot write");
        assert.deepEqual(json.context, { path: "/tmp/a.json" });
        assert.deepEqual(json.cause, { name: "Error", message: "root cause" });
        assert.deepEqual(JSON.parse(JSON.stringify(error)), json);
    });

    test("toJSON 递归序列化 SemanticError 的 cause 链", () => {
        const origin = new globalThis.RangeError("native origin");
        const middle = new ST.ConcurrencyError("queue settled twice", {
            cause: origin,
            context: { order: 2 },
        });
        const outer = new ST.SerializationError("write failed", {
            cause: middle,
            context: { path: "/tmp/b.json" },
        });

        assert.deepEqual(outer.toJSON(), {
            name: "SerializationError",
            message: "write failed",
            context: { path: "/tmp/b.json" },
            cause: {
                name: "ConcurrencyError",
                message: "queue settled twice",
                context: { order: 2 },
                cause: { name: "RangeError", message: "native origin" },
            },
        });
    });

    test("toJSON 保留非 Error 的 cause", () => {
        const error = new ST.CapacityError("capacity exhausted", { cause: "limit=0" });

        assert.equal(error.cause, "limit=0");
        assert.equal(error.toJSON().cause, "limit=0");
    });

    test("toString 使用类名作为前缀", () => {
        assert.equal(String(new ST.IndexError("index 4")), "IndexError: index 4");
        assert.equal(String(new ST.IndexError()), "IndexError");
        assert.equal(String(new ST.RangeError("outside")), "RangeError: outside");
    });
});
