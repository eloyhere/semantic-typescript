import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedForest, AsynchronousRootedForest } from "#semantic/structure/tree/rootedForest";

export interface SynchronousBreadthFirstSearchTree<V = unknown> extends SynchronousRootedForest<V, Nodes.BFSNode<V>> {}

export interface AsynchronousBreadthFirstSearchTree<V = unknown> extends AsynchronousRootedForest<V, Nodes.BFSNode<V>> {}

export interface SynchronousBreadthFirstSearchTreeConstructor {
    new <V = unknown>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.BFSNode<V>>): SynchronousBreadthFirstSearchTree<V>;
}

export const SynchronousBreadthFirstSearchTree = createTreeConstructor("SynchronousBreadthFirstSearchTree", false, "BreadthFirstSearchTree") as unknown as SynchronousBreadthFirstSearchTreeConstructor;

export interface AsynchronousBreadthFirstSearchTreeConstructor {
    new <V = unknown>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.BFSNode<V>>): AsynchronousBreadthFirstSearchTree<V>;
}

export const AsynchronousBreadthFirstSearchTree = createTreeConstructor("AsynchronousBreadthFirstSearchTree", true, "BreadthFirstSearchTree") as unknown as AsynchronousBreadthFirstSearchTreeConstructor;
