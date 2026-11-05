import { useStringify, useTraverse, type UseTraverseKey, type UseTraversePath, type UseTraverseValue } from "../src/hook.js";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;

const nested = { profile: { name: "Ada", count: 2 }, active: true };
export type NestedKey = Assert<Equal<UseTraverseKey<typeof nested>, "name" | "count" | "active">>;
export type NestedValue = Assert<Equal<UseTraverseValue<typeof nested>, string | number | boolean>>;
export type NestedPath = Assert<Equal<UseTraversePath<typeof nested>, ReadonlyArray<"profile" | "name" | "count" | "active">>>;

useTraverse(nested, (key, value, path) => {
    const inferredKey: "name" | "count" | "active" = key;
    const inferredValue: string | number | boolean = value;
    const inferredPath: ReadonlyArray<"profile" | "name" | "count" | "active"> = path;
    // @ts-expect-error A path snapshot is read-only and cannot be mutated in place.
    path.push("other");
    // @ts-expect-error Object containers are not passed to the leaf callback.
    const container: typeof nested.profile = value;
    void [inferredKey, inferredValue, inferredPath, container];
    return true;
});

useStringify(nested, (key, value) => {
    const inferredKey: "profile" | "name" | "count" | "active" = key;
    const inferredValue: typeof nested.profile | string | number | boolean = value;
    void [inferredKey, inferredValue];
    return String(value);
});

const symbolKey = Symbol("leaf");
type Branches = {
    optional?: { label: "optional" } | null;
    union: { left: 1 } | { right: 2 };
    ignored: null | undefined;
    items: ReadonlyArray<{ code: bigint } | "plain" | null>;
    set: Set<boolean>;
    callback: () => void;
    7: "numeric";
    [symbolKey]: symbol;
};
export type BranchKey = Assert<Equal<UseTraverseKey<Branches>, "label" | "left" | "right" | "code" | "callback" | "7" | number | typeof symbolKey>>;
export type BranchValue = Assert<Equal<UseTraverseValue<Branches>, "optional" | 1 | 2 | bigint | "plain" | boolean | (() => void) | "numeric" | symbol>>;
export type BranchPath = Assert<Equal<UseTraversePath<Branches>, ReadonlyArray<"optional" | "label" | "union" | "left" | "right" | "items" | "code" | "set" | "callback" | "7" | number | typeof symbolKey>>>;
export type RootArrayKey = Assert<Equal<UseTraverseKey<string[]>, `${number}` | "length">>;
export type RootTupleKey = Assert<Equal<UseTraverseKey<readonly ["one", 2]>, "0" | "1" | "length">>;
export type RootArrayValue = Assert<Equal<UseTraverseValue<string[]>, string | number>>;
export type EmptyKey = Assert<Equal<UseTraverseKey<Record<string, never>>, never>>;
export type OpenKey = Assert<Equal<UseTraverseKey<object>, PropertyKey>>;
export type OpenValue = Assert<Equal<UseTraverseValue<object>, string | number | boolean | bigint | symbol | Function>>;
export type UnknownValue = Assert<Equal<UseTraverseValue<Record<string, unknown>>, UseTraverseValue<object>>>;

interface RecursiveNode {
    value: number;
    next?: RecursiveNode;
    children: RecursiveNode[];
}
declare const recursive: RecursiveNode;
export type RecursiveKey = Assert<Equal<UseTraverseKey<RecursiveNode>, PropertyKey>>;
export type RecursiveValue = Assert<Equal<UseTraverseValue<RecursiveNode>, UseTraverseValue<object>>>;
export type RecursivePath = Assert<Equal<UseTraversePath<RecursiveNode>, ReadonlyArray<PropertyKey>>>;
useTraverse(recursive, (key, value, path) => {
    const safeKey: PropertyKey = key;
    const safeValue: UseTraverseValue<object> = value;
    const safePath: ReadonlyArray<PropertyKey> = path;
    // @ts-expect-error Recursive fallback values still exclude null and object containers.
    const objectValue: object = value;
    void [safeKey, safeValue, safePath, objectValue];
    return true;
});
useStringify(recursive, (key, value) => {
    type ContextKey = Assert<Equal<typeof key, string>>;
    type ContextValue = Assert<Equal<typeof value, unknown>>;
    const checks: [ContextKey, ContextValue] = [true, true];
    // @ts-expect-error Replacer values include object containers.
    const unsafeNumber: number = value;
    void [checks, unsafeNumber];
    return String(value);
});

type PlainNest<Depth extends unknown[]> = Depth extends [unknown, ...infer Rest] ? { child: PlainNest<Rest> } : { end: number };
export type FiniteSameShapeKey = Assert<Equal<UseTraverseKey<PlainNest<[1, 1, 1, 1, 1]>>, "end">>;

type Nest<Depth extends unknown[]> = Depth extends [unknown, ...infer Rest] ? { depth: Depth["length"]; child: Nest<Rest> } : { end: number };
type Deep = Nest<[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]>;
export type DeepKey = Assert<Equal<UseTraverseKey<Deep>, PropertyKey>>;
export type DeepValue = Assert<Equal<UseTraverseValue<Deep>, UseTraverseValue<object>>>;
declare const deep: Deep;
useStringify(deep, (_key, value) => {
    type DepthFallback = Assert<Equal<typeof value, unknown>>;
    const check: DepthFallback = true;
    // @ts-expect-error The depth fallback is unknown rather than any.
    const unsafeNumber: number = value;
    void [check, unsafeNumber];
    return String(value);
});

useTraverse(nested, (key, value) => {
    type ContextKey = Assert<Equal<typeof key, "name" | "count" | "active">>;
    type ContextValue = Assert<Equal<typeof value, string | number | boolean>>;
    const checks: [ContextKey, ContextValue] = [true, true];
    void checks;
    return false;
});
// @ts-expect-error Callback values cannot be restricted to a single leaf type.
useTraverse(nested, (_key, value: number) => value > 0);
// @ts-expect-error Traversal callbacks must return a boolean.
useTraverse(nested, () => "continue");
// @ts-expect-error Primitive roots are outside the traversal API.
useTraverse(3, () => true);

useStringify(nested, (key, value) => {
    type ContextKey = Assert<Equal<typeof key, "profile" | "name" | "count" | "active">>;
    type ContextValue = Assert<Equal<typeof value, typeof nested.profile | string | number | boolean>>;
    const checks: [ContextKey, ContextValue] = [true, true];
    // @ts-expect-error JSON replacer keys are strings.
    const numericKey: number = key;
    void [checks, numericKey];
    return String(value);
});
useStringify({ rows: [1, 2], date: new Date(), 3: true, [symbolKey]: "ignored" }, (key, value) => {
    type ContextKey = Assert<Equal<typeof key, "rows" | `${number}` | "date" | "3">>;
    type ContextValue = Assert<Equal<typeof value, number[] | number | string | boolean>>;
    const checks: [ContextKey, ContextValue] = [true, true];
    void checks;
    return String(value);
});
// @ts-expect-error A callback must handle container values as well as primitive leaves.
useStringify(nested, (_key, value: number) => String(value));
// @ts-expect-error Stringify callbacks must return strings.
useStringify(nested, () => 1);
