/**
 * Extracts the null and undefined members of a union.
 * @template T - The type whose absent values are selected.
 */
export type Invalid<T> = T extends null | undefined ? T : never;
/**
 * Excludes null and undefined from a union.
 * @template T - The type whose present values are selected.
 */
export type Valid<T> = T extends (null | undefined) ? never : T;
/**
 * Allows a value to be absent through either null or undefined.
 * @template T - The type of a present value.
 */
export type MaybeInvalid<T> = T | null | undefined;
/**
 * Allows a value to be undefined.
 * @template T - The type of a defined value.
 */
export type MaybeUndefined<T> = T | undefined;
/**
 * Allows a value to be null.
 * @template T - The type of a non-null value.
 */
export type MaybeNull<T> = T | null;
/**
 * Tests whether a value is neither null nor undefined.
 * @template T - The type of a present value.
 * @param t - The value to inspect.
 * @returns Whether the value is present.
 */
export let validate: <T>(t: MaybeInvalid<T>) => t is T = <T>(t: T | null | undefined): t is T => {
    return t !== null && t !== (void 0);
};
/**
 * Tests whether a value is null or undefined.
 * @template T - The type of a present value.
 * @param t - The value to inspect.
 * @returns Whether the value is absent.
 */
export let invalidate: <T>(t: MaybeInvalid<T>) => t is (null | undefined) = <T>(t: T | null | undefined): t is (null | undefined) => {
    return t === null || t === (void 0);
};
/** Runtime type names, including a separate name for null. */
export type Type = "undefined" | "null" | "boolean" | "number" | "bigint" | "symbol" | "string" | "function" | "object";
/**
 * Returns the JavaScript type of a value, distinguishing null from objects.
 * @template T - The type of the inspected value.
 * @param t - The value to inspect.
 * @returns The runtime type name.
 */
export let typeOf: <T>(t: T) => Type = <T>(t: T): Type => {
    if (typeof t === "object") {
        if (t === null) {
            return "null";
        }
        return "object";
    }
    return typeof t;
};
/** Values treated as primitive by the library's type model, including callable functions. */
export type Primitive = null | undefined | string | number | boolean | symbol | bigint | CallableFunction;
/**
 * Combines a type with the library's primitive value types.
 * @template T - The additional value type.
 */
export type MaybePrimitive<T> = T | Primitive;
/** A function accepting arbitrary arguments and returning a promise. */
export type AsyncFunction = (...args: any[]) => Promise<unknown>;
/**
 * Preserves an object's property structure and replaces each non-object leaf value with its key.
 * @template T - The object type to traverse recursively.
 */
export type DeepPropertyKey<T extends object> = {
    [K in keyof T]: T[K] extends object ? DeepPropertyKey<T[K]> : K;
};
/**
 * Recursively maps object properties whilst retaining their non-object leaf values.
 * @template T - The object type to traverse recursively.
 */
export type DeepPropertyValue<T extends object> = {
    [K in keyof T]: T[K] extends object ? DeepPropertyValue<T[K]> : T[K];
};
/**
 * A constructor accepting arbitrary arguments.
 * @template T - The constructed instance type.
 */
export interface Constructor<T> {
    /**
     * Creates an instance.
     * @param args - Arguments passed to the constructor.
     * @returns The constructed instance.
     */
    new (...args: any[]): T;
}
/** An action that requires no arguments and returns no result. */
export interface Runnable {
    /** Performs the action. */
    (): void;
}
;
/**
 * Provides a value without requiring an argument.
 * @template R - The supplied value type.
 */
export interface Supplier<R> {
    /** @returns The supplied value. */
    (): R;
}
/**
 * Transforms one value into a result.
 * @template T - The input type.
 * @template R - The result type.
 */
export interface Functional<T, R> {
    /**
     * @param t - The input value.
     * @returns The transformed value.
     */
    (t: T): R;
}
;
/**
 * Tests a value against a condition.
 * @template T - The tested value type.
 */
export interface Predicate<T> {
    /**
     * @param t - The value to test.
     * @returns Whether the condition is satisfied.
     */
    (t: T): boolean;
}
;
/**
 * Transforms two values into a result.
 * @template T - The first input type.
 * @template U - The second input type.
 * @template R - The result type.
 */
export interface BiFunctional<T, U, R> {
    /**
     * @param t - The first input value.
     * @param u - The second input value.
     * @returns The transformed value.
     */
    (t: T, u: U): R;
}
;
/**
 * Tests a pair of values against a condition.
 * @template T - The first tested value type.
 * @template U - The second tested value type.
 */
export interface BiPredicate<T, U> {
    /**
     * @param t - The first value to test.
     * @param u - The second value to test.
     * @returns Whether the condition is satisfied.
     */
    (t: T, u: U): boolean;
}
;
/**
 * Tests three values against a condition.
 * @template T - The first tested value type.
 * @template U - The second tested value type.
 * @template V - The third tested value type.
 */
export interface TriPredicate<T, U, V> {
    /**
     * @param t - The first value to test.
     * @param u - The second value to test.
     * @param v - The third value to test.
     * @returns Whether the condition is satisfied.
     */
    (t: T, u: U, v: V): boolean;
}
;
/**
 * Compares two values using a negative, zero or positive result to express their order.
 * @template T - The compared value type.
 */
export interface Comparator<T> {
    /**
     * @param t1 - The first value.
     * @param t2 - The second value.
     * @returns A negative number if the first precedes the second, zero if equivalent, or a positive number otherwise.
     */
    (t1: T, t2: T): number;
}
/**
 * Transforms three values into a result.
 * @template T - The first input type.
 * @template U - The second input type.
 * @template V - The third input type.
 * @template R - The result type.
 */
export interface TriFunctional<T, U, V, R> {
    /**
     * @param t - The first input value.
     * @param u - The second input value.
     * @param v - The third input value.
     * @returns The transformed value.
     */
    (t: T, u: U, v: V): R;
}
;
/**
 * Performs an action with one value.
 * @template T - The consumed value type.
 */
export interface Consumer<T> {
    /** @param t - The value to consume. */
    (t: T): void;
}
;
/**
 * Performs an action with two values.
 * @template T - The first consumed value type.
 * @template U - The second consumed value type.
 */
export interface BiConsumer<T, U> {
    /**
     * @param t - The first value to consume.
     * @param u - The second value to consume.
     */
    (t: T, u: U): void;
}
;
/**
 * Performs an action with three values.
 * @template T - The first consumed value type.
 * @template U - The second consumed value type.
 * @template V - The third consumed value type.
 */
export interface TriConsumer<T, U, V> {
    /**
     * @param t - The first value to consume.
     * @param u - The second value to consume.
     * @param v - The third value to consume.
     */
    (t: T, u: U, v: V): void;
}
;
/**
 * Supplies values synchronously through callbacks, with optional bigint indices.
 * @template T - The generated element type.
 */
export interface SynchronousGenerator<T> {
    /**
     * @param accept - Receives generated elements.
     * @param interrupt - Tests whether generation should stop for an element.
     */
    (accept: Consumer<T>, interrupt: Predicate<T>): void;
    /**
     * @param accept - Receives generated elements.
     * @param interrupt - Tests whether generation should stop using an element and its index.
     */
    (accept: Consumer<T>, interrupt: BiPredicate<T, bigint>): void;
    /**
     * @param accept - Receives generated elements and their indices.
     * @param interrupt - Tests whether generation should stop for an element.
     */
    (accept: BiConsumer<T, bigint>, interrupt: Predicate<T>): void;
    /**
     * @param accept - Receives generated elements and their indices.
     * @param interrupt - Tests whether generation should stop using an element and its index.
     */
    (accept: BiConsumer<T, bigint>, interrupt: BiPredicate<T, bigint>): void;
}
;
/**
 * Supplies values asynchronously through callbacks, with optional bigint indices.
 * @template T - The generated element type.
 */
export interface AsynchronousGenerator<T> {
    /**
     * @param accept - Receives generated elements.
     * @param interrupt - Tests whether generation should stop for an element.
     * @returns A promise that resolves when generation finishes.
     */
    (accept: Consumer<T>, interrupt: Predicate<T>): Promise<void>;
    /**
     * @param accept - Receives generated elements.
     * @param interrupt - Tests whether generation should stop using an element and its index.
     * @returns A promise that resolves when generation finishes.
     */
    (accept: Consumer<T>, interrupt: BiPredicate<T, bigint>): Promise<void>;
    /**
     * @param accept - Receives generated elements and their indices.
     * @param interrupt - Tests whether generation should stop for an element.
     * @returns A promise that resolves when generation finishes.
     */
    (accept: BiConsumer<T, bigint>, interrupt: Predicate<T>): Promise<void>;
    /**
     * @param accept - Receives generated elements and their indices.
     * @param interrupt - Tests whether generation should stop using an element and its index.
     * @returns A promise that resolves when generation finishes.
     */
    (accept: BiConsumer<T, bigint>, interrupt: BiPredicate<T, bigint>): Promise<void>;
}
;
/**
 * Associates an element with a bigint index.
 * @template E - The indexed element type.
 */
export interface Indexed<E> {
    /** The element associated with the index. */
    element: E;
    /** The element's index in its source sequence. */
    index: bigint;
}
;
