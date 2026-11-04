import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

export interface SynchronousShortestPathTree<V = unknown, W = number> extends SynchronousRootedTree<V, Nodes.ShortestPathNode<V, W>> {}

export interface AsynchronousShortestPathTree<V = unknown, W = number> extends AsynchronousRootedTree<V, Nodes.ShortestPathNode<V, W>> {}

export interface SynchronousShortestPathTreeConstructor {
    new <V = unknown, W = number>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.ShortestPathNode<V, W>>): SynchronousShortestPathTree<V, W>;
}

export const SynchronousShortestPathTree = createTreeConstructor("SynchronousShortestPathTree", false, "ShortestPathTree") as unknown as SynchronousShortestPathTreeConstructor;

export interface AsynchronousShortestPathTreeConstructor {
    new <V = unknown, W = number>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.ShortestPathNode<V, W>>): AsynchronousShortestPathTree<V, W>;
}

export const AsynchronousShortestPathTree = createTreeConstructor("AsynchronousShortestPathTree", true, "ShortestPathTree") as unknown as AsynchronousShortestPathTreeConstructor;
