import { useSynchronousToArray, type SynchronousCollector } from "./synchronous/collector.js";
import { isBigInt, isFunction, isIterable, isNumber, isObject, isPrimitive } from "./guard.js";
import { invalidate, validate, type BiPredicate, type DeepPropertyKey, type DeepPropertyValue, type MaybePrimitive } from "./utility.js";
import type { BiConsumer, BiFunctional, Comparator, Consumer, Indexed, Predicate, Supplier, SynchronousGenerator } from "./utility.js";

export let useCompare: <T>(t1: T, t2: T) => number = <T>(t1: T, t2: T): number => {
    if (t1 === t2 || Object.is(t1, t2)) {
        return 0;
    }
    if (typeof t1 === typeof t2) {
        switch (typeof t1) {
            case "string":
                return t1.localeCompare(t2 as string);
            case "number":
                return t1 - (t2 as number);
            case "bigint":
                return Number(t1 - (t2 as bigint));
            case "boolean":
                return t1 === t2 ? 0 : (t1 ? 1 : -1);
            case "symbol":
                if (t1.description === (t2 as symbol).description) {
                    return 0;
                }
                return (t1.description || "").localeCompare(((t2 as symbol).description) || "");
            case "function":
                throw new TypeError("Cannot compare functions.");
            case "undefined":
                return 0;
            case "object":
                if (isFunction(Reflect.get(t1 as object, Symbol.toPrimitive)) && isFunction(Reflect.get(t2 as object, Symbol.toPrimitive))) {
                    let a: MaybePrimitive<object> = Reflect.apply(Reflect.get(t1 as object, Symbol.toPrimitive), t1, ["default"]);
                    let b: MaybePrimitive<object> = Reflect.apply(Reflect.get(t2 as object, Symbol.toPrimitive), t2, ["default"]);
                    if (isPrimitive(a) && isPrimitive(b)) {
                        return useCompare(a, b);
                    }
                }
                let a: MaybePrimitive<object> = Object.prototype.valueOf.call(t1);
                let b: MaybePrimitive<object> = Object.prototype.valueOf.call(t2);
                if (isPrimitive(a) && isPrimitive(b)) {
                    return useCompare(a, b);
                }
                return useCompare(Object.prototype.toString.call(t1), Object.prototype.toString.call(t2));
            default:
                throw new TypeError("Invalid type.");
        }
    }
    throw new TypeError("Cannot compare values of different types.");
};

interface UseRandom {
    <N extends number | bigint>(start: N): N extends number ? number : (N extends bigint ? bigint : never);
    <N extends number | bigint>(start: N, end: N): N;
};
export let useRandom: UseRandom = <N extends number | bigint>(start: N, end?: N): N => {
    let getRandomBits: Supplier<[number, number]> = (): [number, number] => {
        let random = Math.random();
        let full = random * 0x10000000000000;
        let high = Math.floor(full / 0x100000000);
        let low = Math.floor(full) & 0xFFFFFFFF
        return [high, low];
    };
    // 原实现的每个分片都至少左移 3 位，导致结果的低 3 位恒为 0（useRandom(1n,10n) 只会得到 1 或 9）。
    // 这里按 53 位一段拼接，保证低位也是均匀随机的。
    let getRandomBigInt: Supplier<bigint> = (): bigint => {
        let result: bigint = 0n;
        for (let i = 0; i < 4; i++) {
            let [high, low] = getRandomBits();
            result = (result << 53n) | (BigInt(high) << 32n) | BigInt(low);
        }
        return result;
    };
    if (isNumber(start)) {
        let seed = Math.random();
        if (isNumber(end)) {
            let minimum: number = Math.min(start, end);
            let maximum: number = Math.max(start, end);
            let range: number = maximum - minimum;
            return (minimum + seed * range) as N;
        } else {
            return Math.exp(-seed) as N;
        }
    }
    /** 以拒绝采样返回 [0n, bound) 内的随机大整数；原实现在 do/while 里复用同一个随机数，会死循环。 */
    let getRandomBelow: (bound: bigint) => bigint = (bound: bigint): bigint => {
        if (bound <= 0n) {
            return 0n;
        }
        let mask: bigint = 1n;
        while (mask < bound) {
            mask <<= 1n;
        }
        mask -= 1n;
        let result: bigint = 0n;
        do {
            result = getRandomBigInt() & mask;
        } while (result >= bound);
        return result;
    };
    if (isBigInt(start)) {
        if (isBigInt(end)) {
            let minimum: bigint = start < end ? start : end;
            let maximum: bigint = start < end ? end : start;
            let range: bigint = maximum - minimum;
            if (range === 0n) {
                return minimum as N;
            }
            return (minimum + getRandomBelow(range)) as N;
        } else {
            if (start <= 0n) {
                return 0n as N;
            }
            return getRandomBelow(start) as N;
        }
    }
    throw new TypeError("Invalid arguments.");
};

export type UseTraverseKey<T extends object> = DeepPropertyKey<T> & (symbol | string | number);
export type UseTraverseValue<T extends object> = DeepPropertyValue<T>;
export type UseTraversePath<T extends object> = Array<UseTraverseKey<T> & (symbol | string | number)>;
export interface UseTraverseCallback<T extends object> {
    (key: UseTraverseKey<T>, value: UseTraverseValue<T>): boolean;
};
export interface UseTraversePathCallback<T extends object> {
    (key: UseTraverseKey<T>, value: UseTraverseValue<T>, path: UseTraversePath<T>): boolean;
};
interface UseTraverse {
    <T extends object>(t: T, callback: UseTraverseCallback<T>): void;
    <T extends object>(t: T, callback: UseTraversePathCallback<T>): void;
};
export let useTraverse: UseTraverse = <T extends object>(t: T, callback: UseTraverseCallback<T> | UseTraversePathCallback<T>): void => {
    if (isObject(t)) {
        let seen: WeakSet<object> = new WeakSet<object>();
        let path: UseTraversePath<T> = [];
        let traverse = (target: object): void => {
            if (seen.has(target)) {
                return;
            }
            seen.add(target);
            let stop: boolean = false;
            let properties: Array<string | symbol> = Reflect.ownKeys(target);
            for (let property of properties) {
                if (stop) {
                    break;
                }
                path.push(property as DeepPropertyKey<T> & (symbol | string | number));
                let value: T[keyof T] = Reflect.get(target, property) as T[keyof T];
                if (validate(value)) {
                    if (isObject(value)) {
                        if (isIterable(value)) {
                            let index: number = 0;
                            for (let item of value) {
                                if (stop) {
                                    break;
                                }
                                path.push(index as DeepPropertyKey<T> & (symbol | string | number));
                                if (validate(item)) {
                                    if (isObject(item)) {
                                        traverse(item);
                                    } else {
                                        if (!callback(index as UseTraverseKey<T>, item as UseTraverseValue<T>, path)) {
                                            stop = true;
                                        }
                                    }
                                }
                                path.pop();
                                index++;
                            }
                        } else {
                            traverse(value);
                        }
                    } else {
                        if (!callback(property as UseTraverseKey<T>, value as UseTraverseValue<T>, path)) {
                            stop = true;
                        }
                    }
                }
                // 必须成对弹出，否则 path 会跨兄弟节点累积（原来只 push 不 pop）
                path.pop();
            }
        }
        traverse(t);
    }
};

export let useGenerator: <E>(iterable: Iterable<E>) => SynchronousGenerator<E> = <E>(iterable: Iterable<E>): SynchronousGenerator<E> => {
    if (isIterable(iterable)) {
        return (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            let index: bigint = 0n;
            for (let element of iterable) {
                if (interrupt(element, index)) {
                    break;
                }
                accept(element, index);
            }
        };
    }
    return (): void => { };
};

interface UseArrange {
    <E>(source: Iterable<E>): SynchronousGenerator<E>;
    <E>(source: Iterable<E>, comparator: Comparator<E>): SynchronousGenerator<E>;
    <E>(source: SynchronousGenerator<E>): SynchronousGenerator<E>;
    <E>(source: SynchronousGenerator<E>, comparator: Comparator<E>): SynchronousGenerator<E>;
};

export let useArrange: UseArrange = <E>(source: Iterable<E> | SynchronousGenerator<E>, comparator?: Comparator<E>): SynchronousGenerator<E> => {
    if (isIterable(source)) {
        let buffer: Array<E> = [...source];
        if (validate(comparator) && isFunction(comparator)) {
            return useGenerator(buffer.sort(comparator));
        } else {
            return useGenerator(buffer.map((element: E, index: number): Indexed<E> => {
                return {
                    element: element,
                    index: BigInt(((index % buffer.length) + buffer.length) % buffer.length)
                };
            }).sort((a: Indexed<E>, b: Indexed<E>): number => {
                return Number(a.index - b.index);
            }).map((indexed: Indexed<E>): E => {
                return indexed.element;
            }));
        }
    } else if (isFunction(source)) {
        let collector: SynchronousCollector<E, Array<E>, Array<E>> = useSynchronousToArray();
        let buffer: Array<E> = collector.collect(source);
        if (validate(comparator) && isFunction(comparator)) {
            return useGenerator(buffer.sort(comparator));
        } else {
            return useGenerator(buffer.map((element: E, index: number): Indexed<E> => {
                return {
                    element: element,
                    index: BigInt(((index % buffer.length) + buffer.length) % buffer.length)
                };
            }).sort((a: Indexed<E>, b: Indexed<E>): number => {
                return Number(a.index - b.index);
            }).map((indexed: Indexed<E>): E => {
                return indexed.element;
            }));
        }
    }
    return useGenerator([]);
};

export let useToNumber: <T = unknown>(target: T) => number = <T>(target: T): number => {
    switch (typeof target) {
        case "number":
            return isNumber(target) ? target : 0;
        case "boolean":
            return target ? 1 : 0;
        case "string":
            let result: number = Number(target);
            return isNumber(result) ? result : 0;
        case "bigint":
            return Number(target);
        case "object":
            if (invalidate(target)) {
                return 0;
            }
            if (Reflect.has(target, Symbol.toPrimitive)) {
                let resolved: number = Reflect.apply(Reflect.get(target as object, Symbol.toPrimitive), target, ["number"]);
                return isNumber(resolved) ? resolved : 0;
            }
            return 0;
        default:
            return 0;
    }
};

export let useToBigInt: <T = unknown>(target: T) => bigint = <T>(target: T): bigint => {
    switch (typeof target) {
        case "number":
            return isNumber(target) ? BigInt(Math.floor(target)) : 0n;
        case "boolean":
            return target ? 1n : 0n;
        case "string":
            let regex = /^[-+]?\d+$/;
            return regex.test(target) ? BigInt(target) : 0n;
        case "bigint":
            return target;
        case "object":
            if (invalidate(target)) {
                return 0n;
            }
            if (Reflect.has(target, Symbol.toPrimitive)) {
                let resolved: bigint = Reflect.apply(Reflect.get(target as object, Symbol.toPrimitive), target, ["bigint"]);
                return isBigInt(resolved) ? resolved : 0n;
            }
            return 0n;
        default:
            return 0n;
    }
};

interface UseStringify {
    <T extends object>(target: T): string;
    <T extends object, K extends DeepPropertyKey<T>, V extends DeepPropertyValue<T>>(target: T, callback: BiFunctional<K, V, string>): string;
};
export let useStringify: UseStringify = <T extends object, K extends DeepPropertyKey<T> & string, V extends DeepPropertyValue<T>>(target: T, callback?: BiFunctional<K, V, string>): string => {
    let seen: WeakSet<object> = new WeakSet<object>();
    // 原实现在 replacer 内部再次调用 JSON.stringify(value)，等于在序列化过程中重复递归，
    // 一旦遇到循环引用就会抛 TypeError。这里改为原样返回，由最外层的一次序列化负责编码。
    // 根节点（key 为空串）不参与回调，否则整份文档会被替换成回调对根对象的返回值
    let resolve: BiFunctional<K, V, unknown> = isFunction(callback) ? ((key: K, value: V): unknown => (String(key).length > 0 ? callback(key, value) as unknown : value)) : (_key: K, value: V): unknown => (value as unknown);
    return JSON.stringify(target, (key: string, value: V): unknown => {
        if (isObject(value)) {
            if (seen.has(value)) {
                return (void 0);
            }
            seen.add(value);
            return resolve(key as K, value as V);
        }
        return resolve(key as K, value as V);
    });
};