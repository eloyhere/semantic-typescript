import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedForest, AsynchronousRootedForest } from "#semantic/structure/tree/rootedForest";

export interface SynchronousMinimumSpanningTree<V = unknown, W = number> extends SynchronousRootedForest<V, Nodes.MinimumSpanningNode<V, W>> {}

export interface AsynchronousMinimumSpanningTree<V = unknown, W = number> extends AsynchronousRootedForest<V, Nodes.MinimumSpanningNode<V, W>> {}

export interface SynchronousMinimumSpanningTreeConstructor {
    new <V = unknown, W = number>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.MinimumSpanningNode<V, W>>): SynchronousMinimumSpanningTree<V, W>;
}

export const SynchronousMinimumSpanningTree = createTreeConstructor("SynchronousMinimumSpanningTree", false, "MinimumSpanningTree") as unknown as SynchronousMinimumSpanningTreeConstructor;

export interface AsynchronousMinimumSpanningTreeConstructor {
    new <V = unknown, W = number>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.MinimumSpanningNode<V, W>>): AsynchronousMinimumSpanningTree<V, W>;
}

export const AsynchronousMinimumSpanningTree = createTreeConstructor("AsynchronousMinimumSpanningTree", true, "MinimumSpanningTree") as unknown as AsynchronousMinimumSpanningTreeConstructor;
