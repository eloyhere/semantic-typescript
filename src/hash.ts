import { isBigInt, isBoolean, isFunction, isNumber, isObject, isString, isSymbol } from "./guard";
import { useTraverse, type UseTraverseKey, type UseTraversePath, type UseTraverseValue } from "./hook";
import { typeOf, type DeepPropertyKey, type DeepPropertyValue, type Primitive, type Type } from "./utility";

const masks: Map<Type, bigint> = new Map<Type, bigint>();
masks.set("undefined", BigInt(masks.size));
masks.set("null", BigInt(masks.size));
masks.set("boolean", BigInt(masks.size));
masks.set("number", BigInt(masks.size));
masks.set("bigint", BigInt(masks.size));
masks.set("symbol", BigInt(masks.size));
masks.set("string", BigInt(masks.size));
masks.set("function", BigInt(masks.size));
masks.set("object", BigInt(masks.size));
Object.freeze(masks);
export let maskOf: (type: Type) => bigint = (type: Type): bigint => {
    return masks.get(type) || masks.get("object") || 0n;
};

let primitive: Map<Primitive, bigint> = new Map<Primitive, bigint>();
let complex: WeakMap<object, bigint> = new WeakMap<object, bigint>();

interface Handler<T> {
    (value: T): bigint;
}
const handlers: Map<Type, Handler<unknown>> = new Map<Type, Handler<unknown>>();
export let register = <T>(type: Type, handler: Handler<T>): void => {
    if (isString(type) && isFunction(handler)) {
        handlers.set(type, handler as Handler<unknown>);
    }
};
export let unregister = (type: Type): void => {
    let whiteList = ["undefined", "null", "boolean", "number", "bigint", "symbol", "string", "function", "object"];
    if (isString(type) && handlers.has(type) && !whiteList.includes(type)) {
        handlers.delete(type);
    }
};
register("undefined", (value: undefined): bigint => {
    if (value === (void 0)) {
        if (primitive.has(value)) {
            return primitive.get(value) || 0n;
        }
        let mask: bigint = maskOf("undefined");
        let result: bigint = (0n << 4n) | mask;
        primitive.set(value, result);
        return result;
    }
    return 0n;
});
register("null", (value: null): bigint => {
    if (value === null) {
        if (primitive.has(value)) {
            return primitive.get(value) || 0n;
        }
        let mask: bigint = maskOf("null");
        let result: bigint = (0n << 4n) | mask;
        primitive.set(value, result);
        return result;
    }
    return 0n;
});
register("boolean", (value: boolean): bigint => {
    if (isBoolean(value)) {
        if (primitive.has(value)) {
            return primitive.get(value) || 0n;
        }
        let mask: bigint = maskOf("boolean");
        let result: bigint = ((value === true ? 1n : 0n) << 4n) | mask;
        primitive.set(value, result);
        return result;
    }
    return 0n;
});
register("number", (value: number): bigint => {
    if (isNumber(value)) {
        if (primitive.has(value)) {
            return primitive.get(value) || 0n;
        }
        if(Number.isNaN(value)){
            return 0x7FF8000000000000n;
        }
        let mask: bigint = maskOf("number");
        let bit: bigint = 0xFFFFFFFFFFFFFFFFn;
        let buffer = new ArrayBuffer(8);
        let array = new Float64Array(buffer);
        array[0] = value;
        let view = new BigInt64Array(buffer);
        let result: bigint = ((view[0] << 4n) & bit) | mask;
        primitive.set(value, result);
        return result;
    }
    return 0n;
});
register("bigint", (value: bigint): bigint => {
    if (isBigInt(value)) {
        if (primitive.has(value)) {
            return primitive.get(value) || 0n;
        }
        let mask: bigint = maskOf("bigint");
        let bit: bigint = 0xFFFFFFFFFFFFFFFFn;
        let result: bigint = ((value << 4n) & bit) | mask;
        primitive.set(value, result);
        return result;
    }
    return 0n;
});
register("string", (value: string): bigint => {
    if (isString(value)) {
        if (primitive.has(value)) {
            return primitive.get(value) || 0n;
        }
        let mask: bigint = maskOf("string");
        let bit: bigint = 0xFFFFFFFFFFFFFFFFn;
        let gap: number = value.length < 64 ? 1 : Math.ceil(Math.log2(value.length));
        let result: bigint = 0n;
        for (let i = 0; i < value.length; i += gap) {
            result = (((result * 33n) & bit) ^ BigInt(value.charCodeAt(i))) + BigInt(i);
        }
        result = (result ^ (result >> 32n)) * 0x9e3779b97f4a7c15n;
        result = (((result ^ (result >> 32n)) << 4n) & bit) | mask;
        primitive.set(value, result);
        return result;
    }
    return 0n;
});
register("symbol", (value: symbol): bigint => {
    if (isSymbol(value)) {
        if (primitive.has(value)) {
            return primitive.get(value) || 0n;
        }
        let mask: bigint = maskOf("symbol");
        let bit: bigint = 0xFFFFFFFFFFFFFFFFn;
        let description: string = (value.description || "") + String(value);
        let result: bigint = 0n;
        let gap: number = description.length < 64 ? 1 : Math.ceil(Math.log2(description.length));
        for (let i = 0; i < description.length; i += gap) {
            result = (((result * 33n) & bit) ^ BigInt(description.charCodeAt(i))) + BigInt(i);
        }
        result = (result ^ (result >> 32n)) * 0x9e3779b97f4a7c15n;
        result = (((result ^ (result >> 32n)) << 4n) & bit) | mask;
        primitive.set(value, result);
        return result;
    }
    return 0n;
});
register("function", (value: Function): bigint => {
    if (isFunction(value)) {
        if (primitive.has(value)) {
            return primitive.get(value) || 0n;
        }
        let mask: bigint = maskOf("function");
        let bit: bigint = 0xFFFFFFFFFFFFFFFFn;
        let description: string = (value.name || "") + String(value);
        let result: bigint = 0n;
        let gap: number = description.length < 64 ? 1 : Math.ceil(Math.log2(description.length));
        for (let i = 0; i < description.length; i += gap) {
            result = (((result * 33n) & bit) ^ BigInt(description.charCodeAt(i))) + BigInt(i);
        }
        result = (result ^ (result >> 32n)) * 0x9e3779b97f4a7c15n;
        result = (((result ^ (result >> 32n)) << 4n) & bit) | mask;
        primitive.set(value, result);
        return result;
    }
    return 0n;
});
register("object", (value: object): bigint => {
    if (isObject(value)) {
        if (complex.has(value)) {
            return complex.get(value) || 0n;
        }
        try {
            let mask: bigint = maskOf("object");
            let bit: bigint = 0xFFFFFFFFFFFFFFFFn;
            let result: bigint = 0n;
            useTraverse(value, (key: UseTraverseKey<object>, value: UseTraverseValue<object>, path: UseTraversePath<object>): boolean => {
                let keyHashHandler: Handler<DeepPropertyKey<object>> = handlers.get(typeOf(key)) as Handler<DeepPropertyKey<object>>;
                let keyHash: bigint = keyHashHandler ? keyHashHandler(key) : 0n;
                let valueHashHandler: Handler<DeepPropertyValue<object>> = handlers.get(typeOf(value)) as Handler<DeepPropertyValue<object>>;
                let valueHash: bigint = valueHashHandler ? valueHashHandler(value) : 0n;
                let pathHash: bigint = 0n;
                if (complex.has(path)) {
                    pathHash = complex.get(path) || 0n;
                } else {
                    for (let p of path) {
                        let pathHashHandler: Handler<unknown> = handlers.get(typeOf(p)) as Handler<unknown>;
                        pathHash = (((pathHash << 5n) - pathHash) ^ (pathHashHandler ? pathHashHandler(p) : 0n)) & bit;
                    }
                    complex.set(path, pathHash);
                }
                result = (((result << 13n) | (result >> 51n)) ^ (keyHash * 0x243F6A8885A308D3n) ^ (valueHash * 0x517CC1B727220A95n) ^ (pathHash * 0x9E3779B97F4A7C15n)) & bit;
                return true;
            });
            result = (result ^ (result >> 32n)) * 0x9e3779b97f4a7c15n;
            result = (((result ^ (result >> 32n)) << 4n) & bit) | mask;
            complex.set(value, result);
            return result;
        } catch (error) {
            throw new Error("Uncaught error on hashing object.");
        }
    }
    return 0n;
});

interface UseHash {
    <T = unknown>(target: T): bigint;
    (...value: Array<unknown>): bigint;
};
export let useHash: UseHash = <T = unknown>(...value: Array<T>): bigint => {
    let target: unknown = value.length === 1 ? value[0] : value;
    let type: Type = typeOf(target);
    let handler: Handler<unknown> | undefined = handlers.get(type);
    if (handler) {
        return handler(target);
    }
    return 0n;
}