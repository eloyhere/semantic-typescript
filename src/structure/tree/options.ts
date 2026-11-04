import type { Optional } from "#semantic/optional";
import type { BinaryTreeOptions } from "#semantic/structure/tree/binaryBuilder";
import type { SpecializedTreeOptions } from "#semantic/structure/tree/specializedBuilder";

type Getter<N, K extends PropertyKey, F = unknown> =
    N extends Record<K, (...args: never[]) => infer R> ? R : F;
type Unwrap<T> = T extends Optional<infer V> ? V : T;
type Item<T> = T extends readonly (infer V)[] ? V : never;
type Field<T, K extends PropertyKey> = T extends Record<K, infer V> ? V : unknown;
type Label<N> = N extends { getEdges(): infer R } ? Field<Item<R>, "label"> :
    N extends { getMoves(): infer R } ? Field<Item<R>, "action"> : unknown;
type Key<N> = N extends { getKey(): infer R } ? Unwrap<R> :
    N extends { getKeys(): infer R } ? Item<R> : unknown;

type MetadataKey = "buildNodes" | "aggregate" | "combine" | "hash" | "keyOf" |
    "operatorOf" | "symbolOf" | "kindOf" | "intervalOf" | "distanceOf" |
    "incomingWeightOf" | "pathWeightOf" | "testOf" | "labelOf";

/** Callback outputs follow the metadata exposed by the constructed nodes. */
export interface TreeOptions<E, N = object>
    extends Omit<BinaryTreeOptions<E>, MetadataKey>, Omit<SpecializedTreeOptions<E>, MetadataKey> {
    buildNodes?: (elements: readonly E[]) => readonly N[];
    aggregate?: (elements: readonly E[]) => Getter<N, "getAggregate">;
    combine?: (left: Getter<N, "getAggregate">, right: Getter<N, "getAggregate">) => Getter<N, "getAggregate">;
    hash?: (element: E | undefined, childDigests: readonly Getter<N, "getDigest">[]) => Getter<N, "getDigest">;
    keyOf?: (element: E) => Key<N>;
    operatorOf?: (element: E) => Unwrap<Getter<N, "getOperator">> | undefined;
    symbolOf?: (element: E) => Getter<N, "getSymbol">;
    kindOf?: (element: E) => Getter<N, "getKind">;
    intervalOf?: (element: E) => Getter<N, "getInterval", { readonly start: number; readonly end: number }>;
    distanceOf?: (element: E) => Getter<N, "getDistance">;
    incomingWeightOf?: (element: E) => Unwrap<Getter<N, "getIncomingWeight">> | undefined;
    pathWeightOf?: (element: E) => Unwrap<Getter<N, "getPathWeight">> | undefined;
    testOf?: (element: E) => Unwrap<Getter<N, "getTest">> | undefined;
    labelOf?: (parent: E, child: E, index: number) => Label<N>;
}
