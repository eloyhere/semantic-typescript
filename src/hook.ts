import { useSynchronousToArray } from "#semantic/synchronous/collectors";
import type { SynchronousCollector } from "#semantic/synchronous/collector";
import { isBigInt, isFunction, isIterable, isNumber, isObject, isPrimitive } from "#semantic/guard";
import { invalidate, validate, type BiPredicate, type MaybePrimitive } from "#semantic/utility";
import type { BiConsumer, BiFunctional, Comparator, Consumer, Indexed, Predicate, Supplier, SynchronousGenerator } from "#semantic/utility";
/**
 * Compares two values, returning a negative number, zero, or a positive number.
 *
 * Identity is decided first: two references that match by `===` or by `Object.is`
 * compare equal without any further inspection. Values of different runtime types
 * are never ordered, and functions are never ordered either, so both cases throw
 * rather than inventing an order.
 *
 * Within one runtime type the comparison is: strings by `localeCompare`, numbers
 * by subtraction, bigints by subtraction converted back through `number`, booleans
 * as `false` before `true`, symbols by description, and `undefined` as always
 * equal. Objects are reduced through their `Symbol.toPrimitive` hook with the
 * `"default"` hint, then through `Object.prototype.valueOf`, and finally through
 * the string form of `Object.prototype.toString`.
 *
 * Two consequences are worth knowing. A bigint difference is narrowed through
 * `number`, so operands separated by more than the safe integer range lose
 * precision. Symbols are ordered by description, so two distinct symbols that
 * share a description compare as equal.
 *
 * @param t1 the left operand
 * @param t2 the right operand
 * @returns a negative number, zero, or a positive number as `t1` sorts before,
 *          with, or after `t2`
 * @throws {TypeError} if the operands have different runtime types, or if either
 *         operand is a function
 * @template T the operand type
 */
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
/**
 * Selects a random value from a bounded or a zero-based range.
 *
 * The single-argument form reads `[0, start)`; the two-argument form reads
 * between the two bounds regardless of the order they are given in. The upper
 * bound is always exclusive.
 *
 * @template N the operand type, either `number` or `bigint`
 */
interface UseRandom {
    /**
     * Reads from a zero-based range.
     *
     * The argument is the exclusive upper bound. A number result keeps its
     * fractional part, while a bigint result stays integral.
     */
    <N extends number | bigint>(start: N): N extends number ? number : (N extends bigint ? bigint : never);
    /**
     * Reads between two bounds.
     *
     * The bounds may be supplied in either order and the upper one is exclusive,
     * so a range of width zero returns its single point rather than failing.
     */
    <N extends number | bigint>(start: N, end: N): N;
}
;
/**
 * Returns a random value from a bounded or a zero-based range.
 *
 * The single-argument form reads `[0, start)` and the two-argument form reads
 * between the supplied bounds in either order, with the upper bound exclusive.
 * Number results come from one `Math.random` sample scaled into the interval, so
 * they keep a fractional part. Bigint results are integral and are drawn by
 * rejection sampling over a bit mask, so every value in the range is equally
 * likely instead of being biased towards the low end by rounding.
 *
 * A non-positive bound yields zero: a negative or zero `start` gives `0` or `0n`,
 * and a bigint range of width zero returns its single point.
 *
 * @param start the exclusive upper bound, or one of the two bounds
 * @param end the other bound, supplied when a two-sided range is wanted
 * @returns a value within the requested range
 * @throws {TypeError} if `start` is neither a `number` nor a `bigint`
 * @template N the operand type
 */
export let useRandom: UseRandom = <N extends number | bigint>(start: N, end?: N): N => {
    let getRandomBits: Supplier<[
        number,
        number
    ]> = (): [
        number,
        number
    ] => {
        let random = Math.random();
        let full = random * 0x10000000000000;
        let high = Math.floor(full / 0x100000000);
        let low = Math.floor(full) & 0xFFFFFFFF;
        return [high, low];
    };
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
        }
        else {
            return (seed * Math.max(0, start)) as N;
        }
    }
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
        }
        else {
            if (start <= 0n) {
                return 0n as N;
            }
            return getRandomBelow(start) as N;
        }
    }
    throw new TypeError("Invalid arguments.");
};
/**
 * Recursion budget for the traversal conditional types.
 *
 * Each visited level consumes one element of this tuple, so twelve levels are
 * expanded and anything deeper resolves to the open `TraverseEntry` form instead
 * of recursing further. Without the budget a recursive or very deep structure
 * would make the compiler expand types without bound; with it, a depth beyond
 * twelve still type-checks, it is simply described less precisely.
 */
type HookDepth = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
type HookLeaf = string | number | boolean | bigint | symbol | Function;
type HookPropertyKey<K> = K extends number ? `${K}` : Extract<K, string | symbol>;
type TraverseEntry<K extends PropertyKey = PropertyKey, V = HookLeaf, P extends PropertyKey = PropertyKey> = {
    key: K;
    value: V;
    path: P;
};
type TraverseObject<T, D extends unknown[]> = T extends object
    ? D extends [unknown, ...infer Rest]
        ? object extends T ? TraverseEntry
            : T extends readonly unknown[]
                ? TraverseProperty<T[number], number extends T["length"] ? `${number}` : Extract<keyof T, `${number}`>, Rest> | TraverseEntry<"length", T["length"], "length">
                : { [K in keyof T]-?: TraverseProperty<T[K], HookPropertyKey<K>, Rest> }[keyof T]
        : TraverseEntry
    : never;
type TraverseProperty<V, K extends PropertyKey, D extends unknown[]> = unknown extends V ? TraverseEntry<PropertyKey, HookLeaf, PropertyKey>
    : V extends null | undefined ? never
    : V extends Function ? TraverseEntry<K, V, K>
    : V extends object
        ? V extends Iterable<infer E> ? TraverseItem<E, K | number, D>
            : TraverseWithPath<TraverseObject<V, D>, K>
        : TraverseEntry<K, V extends HookLeaf ? V : HookLeaf, K>;
type TraverseItem<V, P extends PropertyKey, D extends unknown[]> = unknown extends V ? TraverseEntry<PropertyKey, HookLeaf, PropertyKey>
    : V extends null | undefined ? never
    : V extends Function ? TraverseEntry<number, V, P>
    : V extends object ? TraverseWithPath<TraverseObject<V, D>, P>
    : TraverseEntry<number, V extends HookLeaf ? V : HookLeaf, P>;
type TraverseWithPath<E, P extends PropertyKey> = E extends TraverseEntry<infer K, infer V, infer Path>
    ? TraverseEntry<K, V, P | Path> : never;
type TraverseField<T extends object, K extends keyof TraverseEntry> = TraverseObject<T, HookDepth> extends infer E
    ? E extends TraverseEntry ? E[K] : never : never;

/**
 * Keys reported for non-null leaves during traversal.
 *
 * Own object properties keep their declared key, a numeric own property appears
 * under its string form, and an iterable item is reported by its numeric
 * position instead of a key.
 *
 * @template T the object being traversed
 */
export type UseTraverseKey<T extends object> = TraverseField<T, "key">;
/**
 * Non-null leaf values reported during traversal.
 *
 * The type includes callable values: a function reached during traversal is
 * reported as a leaf rather than being descended into, and `null` and
 * `undefined` are never reported at all.
 *
 * @template T the object being traversed
 */
export type UseTraverseValue<T extends object> = TraverseField<T, "value">;
/**
 * The path leading to one leaf, as a read-only snapshot.
 *
 * The array begins at the root object and holds each key or iterable index along
 * the way down to the reported leaf. It is **built for a single callback call and
 * never touched again**: its contents do not change after the call returns, and
 * two calls never share one array, so a callback may store it as it is instead of
 * copying it.
 *
 * The type is read-only and the runtime array is frozen, so a write is a compile
 * error and an attempt to bypass the type raises a `TypeError` in strict mode
 * rather than silently changing a path another callback may still hold.
 *
 * @template T the object being traversed
 */
export type UseTraversePath<T extends object> = ReadonlyArray<TraverseField<T, "path">>;
/**
 * Callback invoked once per non-null leaf.
 *
 * Returning `false` abandons the whole traversal rather than only the current
 * branch, so the walk stops at the first leaf that answers `false`.
 *
 * @template T the object being traversed
 */
export interface UseTraverseCallback<T extends object> {
    /**
     * Visits one non-null leaf.
     *
     * @param key the leaf's own key, or its index when it came from an iterable
     * @param value the leaf value itself
     * @returns `true` to continue the traversal, `false` to abandon it entirely
     */
    (key: UseTraverseKey<T>, value: UseTraverseValue<T>): boolean;
}
;
/**
 * Callback invoked once per non-null leaf, together with a snapshot of the path.
 *
 * Returning `false` abandons the whole traversal. The path belongs to this call
 * alone: it reflects the walk at the moment of the call, is never mutated
 * afterwards, and is not shared with any other call, so it is safe to retain.
 *
 * @template T the object being traversed
 */
export interface UseTraversePathCallback<T extends object> {
    /**
     * Visits one non-null leaf together with the path that reached it.
     *
     * @param key the leaf's own key, or its index when it came from an iterable
     * @param value the leaf value itself
     * @param path the frozen path snapshot that reached the leaf; it never changes
     *        afterwards and may be stored as it is
     * @returns `true` to continue the traversal, `false` to abandon it entirely
     */
    (key: UseTraverseKey<T>, value: UseTraverseValue<T>, path: UseTraversePath<T>): boolean;
}
;
/**
 * The traversal entry point, accepting a callback that receives the path.
 *
 * Only one overload is exposed: a callback written with two parameters is still
 * accepted, because a function that ignores its third argument satisfies a
 * three-parameter signature.
 *
 * @template T the object being traversed
 */
interface UseTraverse {
    /**
     * Walks every non-null leaf reachable from an object.
     *
     * @param t the object to traverse; a non-object is ignored silently
     * @param callback the visitor, invoked once per leaf with that call's path snapshot
     */
    <T extends object>(t: T, callback: UseTraversePathCallback<NoInfer<T>>): void;
}
;
/**
 * Visits every non-null leaf reachable from an object.
 *
 * Traversal descends through own enumerable and non-enumerable keys alike, and
 * through the items of any value that is iterable, reporting an item's numeric
 * position in place of a key. `null` and `undefined` are skipped rather than
 * reported, and a function is reported as a leaf instead of being invoked or
 * descended into.
 *
 * Objects already visited are remembered in a `WeakSet`, so a structure that
 * refers back to itself terminates instead of recursing forever; a shared
 * sub-object is therefore reported once, on its first path only.
 *
 * The callback returns `false` to abandon the entire traversal, not merely the
 * current branch. The path handed to the callback is a separate frozen snapshot
 * per call — never the walk's own working array — so it can be stored directly
 * and no two calls can observe each other's mutations.
 *
 * That safety costs one extra `O(depth)` allocation per reported leaf: the walk
 * keeps a single mutable path internally and copies it into the snapshot only at
 * the moment a leaf is handed over. The overhead therefore follows the depth of
 * the leaf rather than the size of the traversed structure, and descending a
 * branch that reports nothing allocates nothing extra.
 *
 * A value that is not an object is ignored: the function returns without calling
 * the callback at all.
 *
 * @param t the object to traverse
 * @param callback the visitor invoked for each non-null leaf
 * @throws {TypeError} if the callback is not a function, as raised by the call itself
 * @template T the object being traversed
 */
export let useTraverse: UseTraverse = <T extends object>(t: T, callback: UseTraversePathCallback<T>): void => {
    if (isObject(t)) {
        let seen: WeakSet<object> = new WeakSet<object>();
        let path: Array<PropertyKey> = [];
        let snapshot: Supplier<UseTraversePath<T>> = (): UseTraversePath<T> => Object.freeze([...path]) as UseTraversePath<T>;
        let stop: boolean = false;
        let traverse = (target: object): void => {
            if (seen.has(target)) {
                return;
            }
            seen.add(target);
            let properties: Array<string | symbol> = Reflect.ownKeys(target);
            for (let property of properties) {
                if (stop) {
                    break;
                }
                path.push(property);
                let value: T[keyof T] = Reflect.get(target, property) as T[keyof T];
                if (validate(value)) {
                    if (isObject(value)) {
                        if (isIterable(value)) {
                            let index: number = 0;
                            for (let item of value) {
                                if (stop) {
                                    break;
                                }
                                path.push(index);
                                if (validate(item)) {
                                    if (isObject(item)) {
                                        traverse(item);
                                    }
                                    else {
                                        if (!callback(index as UseTraverseKey<T>, item as UseTraverseValue<T>, snapshot())) {
                                            stop = true;
                                        }
                                    }
                                }
                                path.pop();
                                index++;
                            }
                        }
                        else {
                            traverse(value);
                        }
                    }
                    else {
                        if (!callback(property as UseTraverseKey<T>, value as UseTraverseValue<T>, snapshot())) {
                            stop = true;
                        }
                    }
                }
                path.pop();
            }
        };
        traverse(t);
    }
};
/**
 * Adapts an iterable to the generator protocol used throughout the pipeline.
 *
 * The returned function accepts a consumer and an interrupt predicate and walks
 * the source exactly once per call. The interrupt is consulted **before** each
 * element is handed to the consumer, so a predicate that answers `true` on the
 * first element emits nothing at all and the element itself is never consumed by
 * the consumer.
 *
 * A value that is not iterable does not raise: the result is a generator that
 * emits nothing and never calls its consumer, which lets callers treat a missing
 * or unsupported source as an empty one.
 *
 * @param iterable the source to replay
 * @returns a generator that drives the source through the supplied callbacks
 * @template E the element type
 */
export let useGenerator: <E>(iterable: Iterable<E>) => SynchronousGenerator<E> = <E>(iterable: Iterable<E>): SynchronousGenerator<E> => {
    if (isIterable(iterable)) {
        return (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            let index: bigint = 0n;
            for (let element of iterable) {
                if (interrupt(element, index)) {
                    break;
                }
                accept(element, index);
                index++;
            }
        };
    }
    return (): void => { };
};
/**
 * The arrangement entry point, accepting an iterable or an existing generator.
 *
 * Both source shapes are supported because a pipeline may be arranged either at
 * the start or in the middle of a chain; the comparator is optional in every
 * overload.
 *
 * @template E the element type
 */
interface UseArrange {
    /**
     * Replays an iterable in its arrival order.
     *
     * Nothing is reordered, yet the whole source is still buffered before the
     * first value is emitted, so this is not a lazy pass-through.
     */
    <E>(source: Iterable<E>): SynchronousGenerator<E>;
    /**
     * Replays an iterable in comparator order.
     *
     * The buffer is sorted with `Array.prototype.sort`, so the comparator must
     * define a total order and is responsible for breaking ties consistently.
     */
    <E>(source: Iterable<E>, comparator: Comparator<E>): SynchronousGenerator<E>;
    /**
     * Replays an existing generator in its arrival order.
     *
     * The generator is drained first, which means a generator over an unbounded
     * source never returns from this call at all.
     */
    <E>(source: SynchronousGenerator<E>): SynchronousGenerator<E>;
    /**
     * Collects an existing generator and replays it in comparator order.
     *
     * Draining happens before sorting, so the comparator sees the whole data set
     * at once instead of comparing elements as they arrive.
     */
    <E>(source: SynchronousGenerator<E>, comparator: Comparator<E>): SynchronousGenerator<E>;
}
;
/**
 * Buffers a source and replays it in comparator order, or in its original order.
 *
 * The source may be an iterable or an existing generator. With a comparator the
 * buffer is sorted through `Array.prototype.sort`, so the comparator must be a
 * total order and is called once per comparison. Without one the values are
 * replayed in the order they arrived, which means this function never reorders
 * data behind the caller's back.
 *
 * The whole source is materialised before the first value is emitted, so this is
 * **not** a lazy operator: an unbounded source never yields anything and a very
 * large one is held in memory twice, once as the buffer and once as the sorted
 * copy. A source that is neither iterable nor a function yields an empty
 * generator.
 *
 * @param source the iterable or generator to arrange
 * @param comparator the ordering to apply, omitted to preserve the arrival order
 * @returns a generator over the buffered values
 * @throws {TypeError} if a comparator is supplied but is not callable
 * @template E the element type
 */
export let useArrange: UseArrange = <E>(source: Iterable<E> | SynchronousGenerator<E>, comparator?: Comparator<E>): SynchronousGenerator<E> => {
    if (isIterable(source)) {
        let buffer: Array<E> = [...source];
        if (validate(comparator) && isFunction(comparator)) {
            return useGenerator(buffer.sort(comparator));
        }
        else {
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
    else if (isFunction(source)) {
        let collector: SynchronousCollector<E, Array<E>, Array<E>> = useSynchronousToArray();
        let buffer: Array<E> = collector.collect(source);
        if (validate(comparator) && isFunction(comparator)) {
            return useGenerator(buffer.sort(comparator));
        }
        else {
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
/**
 * Converts a supported value to a finite number, falling back to zero.
 *
 * Numbers pass through only when they are finite, so `NaN` and both infinities
 * collapse to zero instead of leaking into arithmetic. Booleans map to one and
 * zero, numeric strings are parsed, and bigints are narrowed through `Number`,
 * which loses precision beyond the safe integer range. An object is read through
 * its `Symbol.toPrimitive` hook with the `"number"` hint when one is installed;
 * any other object, and every unsupported type, yields zero.
 *
 * The function never throws. That makes it safe on data of unknown shape, but it
 * also means a genuine conversion failure is indistinguishable from a legitimate
 * zero — callers that must distinguish the two should validate before converting.
 *
 * @param target the value to convert
 * @returns a finite number, or zero when conversion is unavailable
 * @template T the input type
 */
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
/**
 * Converts a supported value to a bigint, falling back to zero.
 *
 * Numbers are floored before conversion, and a non-finite number yields zero.
 * Booleans map to one and zero. Strings are accepted only when they are purely
 * integral — an optional sign followed by digits — so `"1.5"`, `"1e3"` and
 * `"0x10"` all yield zero rather than being interpreted, which keeps the
 * conversion from silently guessing at a different radix or a rounded value. An
 * object is read through its `Symbol.toPrimitive` hook with the `"bigint"` hint
 * when one is installed.
 *
 * The function never throws. A rejected conversion is reported as zero, so a
 * failure cannot be told apart from a legitimate zero; callers that must
 * distinguish the two should validate before converting.
 *
 * @param target the value to convert
 * @returns a bigint, or zero when conversion is unavailable
 * @template T the input type
 */
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
type StringifyEntry<K extends string = string, V = unknown> = { key: K; value: V };
type StringifyValue<T> = T extends { toJSON(key: string): infer V } ? V : T;
type StringifyProperty<V, K extends string, D extends unknown[]> = V extends unknown
    ? (K extends "" ? never : StringifyEntry<K, StringifyValue<V>>) | StringifyObject<StringifyValue<V>, D> : never;
type StringifyObject<T, D extends unknown[]> = T extends Function ? never
    : T extends object
        ? D extends [unknown, ...infer Rest]
            ? object extends T ? StringifyEntry
                : T extends readonly (infer E)[] ? StringifyProperty<E, `${number}`, Rest>
                : { [K in keyof T]-?: K extends string | number
                    ? StringifyProperty<T[K], `${K}`, Rest>
                    : never }[keyof T]
            : StringifyEntry
        : never;
type StringifyField<T extends object, K extends keyof StringifyEntry> = StringifyObject<StringifyValue<T>, HookDepth> extends infer E
    ? E extends StringifyEntry ? E[K] : never : never;

/**
 * The serialisation entry point, with or without a replacer callback.
 *
 * Both overloads infer the keys and values the replacer will actually observe,
 * so the callback parameters are contextually typed without a cast.
 *
 * @template T the object being serialised
 */
interface UseStringify {
    /**
     * Serialises without a replacer.
     *
     * A reference that was already written is dropped rather than raising, so a
     * structure that points back at itself still produces a document.
     */
    <T extends object>(target: T): string;
    /**
     * Serialises with a replacer.
     *
     * The callback receives each non-root key together with the already converted
     * value, and whatever it returns replaces that entry.
     */
    <T extends object, K extends StringifyField<T, "key"> = StringifyField<T, "key">, V extends StringifyField<T, "value"> = StringifyField<T, "value">>(target: T, callback: BiFunctional<NoInfer<K>, NoInfer<V>, string>): string;
}
;
/**
 * Serialises an object to JSON, omitting references it has already written.
 *
 * A reference that appears a second time is dropped instead of raising the
 * `TypeError` a cycle normally produces, so a structure that points back at
 * itself serialises to a finite document. The check is by object identity and
 * uses a `WeakSet`, so it costs no memory that outlives the call.
 *
 * The optional callback is the JSON replacer: it receives each key and the
 * already converted value and returns the replacement. It is never called for
 * the empty root key, matching `JSON.stringify`.
 *
 * One consequence deserves care. A dropped **property** simply disappears, but a
 * dropped **element** leaves a hole in the array, which `JSON.stringify` renders
 * as `null`. A repeated reference inside an array therefore changes the length of
 * the output rather than shortening it.
 *
 * @param target the object to serialise
 * @param callback the optional replacer, receiving each non-root key and value
 * @returns the JSON text
 * @throws {TypeError} if the target is not serialisable, as raised by `JSON.stringify`
 * @template T the object being serialised
 */
export let useStringify: UseStringify = <T extends object>(target: T, callback?: BiFunctional<StringifyField<T, "key">, StringifyField<T, "value">, string>): string => {
    let seen: WeakSet<object> = new WeakSet<object>();
    let resolve: BiFunctional<string, unknown, unknown> = isFunction(callback) ? ((key: string, value: unknown): unknown => (String(key).length > 0 ? callback(key as StringifyField<T, "key">, value as StringifyField<T, "value">) as unknown : value)) : (_key: string, value: unknown): unknown => (value as unknown);
    return JSON.stringify(target, (key: string, value: unknown): unknown => {
        if (isObject(value)) {
            if (seen.has(value)) {
                return (void 0);
            }
            seen.add(value);
            return resolve(key, value);
        }
        return resolve(key, value);
    });
};