import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousForest, AsynchronousForest } from "#semantic/structure/tree/base";

export interface SynchronousUnionFindForest<E = unknown> extends SynchronousForest<Nodes.UnionFindNode<E>, E> {}

export interface AsynchronousUnionFindForest<E = unknown> extends AsynchronousForest<Nodes.UnionFindNode<E>, E> {}

export interface SynchronousUnionFindForestConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.UnionFindNode<E>>): SynchronousUnionFindForest<E>;
}

export const SynchronousUnionFindForest = createTreeConstructor("SynchronousUnionFindForest", false, "UnionFindForest") as unknown as SynchronousUnionFindForestConstructor;

export interface AsynchronousUnionFindForestConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.UnionFindNode<E>>): AsynchronousUnionFindForest<E>;
}

export const AsynchronousUnionFindForest = createTreeConstructor("AsynchronousUnionFindForest", true, "UnionFindForest") as unknown as AsynchronousUnionFindForestConstructor;
