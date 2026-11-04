import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedForest, AsynchronousRootedForest } from "#semantic/structure/tree/rootedForest";

// 67–72. Graph results preserve original vertex and weight types.
export interface SynchronousDepthFirstSearchTree<V = unknown> extends SynchronousRootedForest<V, Nodes.DFSNode<V>> {}

export interface AsynchronousDepthFirstSearchTree<V = unknown> extends AsynchronousRootedForest<V, Nodes.DFSNode<V>> {}

export interface SynchronousDepthFirstSearchTreeConstructor {
    new <V = unknown>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.DFSNode<V>>): SynchronousDepthFirstSearchTree<V>;
}

export const SynchronousDepthFirstSearchTree = createTreeConstructor("SynchronousDepthFirstSearchTree", false, "DepthFirstSearchTree") as unknown as SynchronousDepthFirstSearchTreeConstructor;

export interface AsynchronousDepthFirstSearchTreeConstructor {
    new <V = unknown>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.DFSNode<V>>): AsynchronousDepthFirstSearchTree<V>;
}

export const AsynchronousDepthFirstSearchTree = createTreeConstructor("AsynchronousDepthFirstSearchTree", true, "DepthFirstSearchTree") as unknown as AsynchronousDepthFirstSearchTreeConstructor;
