import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousForest, AsynchronousForest } from "#semantic/structure/tree/base";

export interface SynchronousFenwickTree<A = unknown> extends SynchronousForest<Nodes.FenwickNode<A>, A> {}

export interface AsynchronousFenwickTree<A = unknown> extends AsynchronousForest<Nodes.FenwickNode<A>, A> {}

export interface SynchronousFenwickTreeConstructor {
    new <A = unknown>(source?: Iterable<A>, options?: TreeOptions<A, Nodes.FenwickNode<A>>): SynchronousFenwickTree<A>;
}

export const SynchronousFenwickTree = createTreeConstructor("SynchronousFenwickTree", false, "FenwickTree") as unknown as SynchronousFenwickTreeConstructor;

export interface AsynchronousFenwickTreeConstructor {
    new <A = unknown>(source?: Iterable<A> | AsyncIterable<A>, options?: TreeOptions<A, Nodes.FenwickNode<A>>): AsynchronousFenwickTree<A>;
}

export const AsynchronousFenwickTree = createTreeConstructor("AsynchronousFenwickTree", true, "FenwickTree") as unknown as AsynchronousFenwickTreeConstructor;
