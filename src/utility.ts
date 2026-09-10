export type Invalid<T> = T extends null | undefined ? T : never;
export type Valid<T> = T extends (null | undefined) ? never : T;
export type MaybeInvalid<T> = T | null | undefined;
export type MaybeUndefined<T> = T | undefined;
export type MaybeNull<T> = T | null;
export let validate: <T>(t: MaybeInvalid<T>) => t is T = <T>(t: T | null | undefined): t is T => {
    return t !== null && t !== (void 0);
};
export let invalidate: <T>(t: MaybeInvalid<T>) => t is (null | undefined) = <T>(t: T | null | undefined): t is (null | undefined) => {
    return t === null || t === (void 0);
};
export type Type = "undefined" | "null" | "boolean" | "number" | "bigint" | "symbol" | "string" | "function" | "object";
export let typeOf: <T>(t: T) => Type = <T>(t: T): Type => {
    if (typeof t === "object") {
        if (t === null) {
            return "null";
        }
        return "object";
    }
    return typeof t;
};
export type Primitive = null | undefined | string | number | boolean | symbol | bigint | Function | ((...args: any[]) => any);
export type MaybePrimitive<T> = T | Primitive;
export type AsyncFunction = (...args: any[]) => Promise<unknown>;
export type DeepPropertyKey<T extends object> = {
    [K in keyof T]: T[K] extends object ? DeepPropertyKey<T[K]> : K;
};
export type DeepPropertyValue<T extends object> = {
    [K in keyof T]: T[K] extends object ? DeepPropertyValue<T[K]> : T[K];
};
export interface Constructor<T> {
    new (...args: any[]): T;
}
export interface Runnable {
    (): void;
}
;
export interface Supplier<R> {
    (): R;
}
export interface Functional<T, R> {
    (t: T): R;
}
;
export interface Predicate<T> {
    (t: T): boolean;
}
;
export interface BiFunctional<T, U, R> {
    (t: T, u: U): R;
}
;
export interface BiPredicate<T, U> {
    (t: T, u: U): boolean;
}
;
export interface TriPredicate<T, U, V> {
    (t: T, u: U, v: V): boolean;
}
;
export interface Comparator<T> {
    (t1: T, t2: T): number;
}
export interface TriFunctional<T, U, V, R> {
    (t: T, u: U, v: V): R;
}
;
export interface Consumer<T> {
    (t: T): void;
}
;
export interface BiConsumer<T, U> {
    (t: T, u: U): void;
}
;
export interface TriConsumer<T, U, V> {
    (t: T, u: U, v: V): void;
}
;
export interface SynchronousGenerator<T> {
    (accept: Consumer<T>, interrupt: Predicate<T>): void;
    (accept: Consumer<T>, interrupt: BiPredicate<T, bigint>): void;
    (accept: BiConsumer<T, bigint>, interrupt: Predicate<T>): void;
    (accept: BiConsumer<T, bigint>, interrupt: BiPredicate<T, bigint>): void;
}
;
export interface AsynchronousGenerator<T> {
    (accept: Consumer<T>, interrupt: Predicate<T>): Promise<void>;
    (accept: Consumer<T>, interrupt: BiPredicate<T, bigint>): Promise<void>;
    (accept: BiConsumer<T, bigint>, interrupt: Predicate<T>): Promise<void>;
    (accept: BiConsumer<T, bigint>, interrupt: BiPredicate<T, bigint>): Promise<void>;
}
;
export interface Indexed<E> {
    element: E;
    index: bigint;
}
;
