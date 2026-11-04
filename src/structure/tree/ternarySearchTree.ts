import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

export interface SynchronousTernarySearchTree<V = unknown, S = string> extends SynchronousTree<Nodes.TernarySearchNode<V, S>, V> {}

export interface AsynchronousTernarySearchTree<V = unknown, S = string> extends AsynchronousTree<Nodes.TernarySearchNode<V, S>, V> {}

export interface SynchronousTernarySearchTreeConstructor {
    new <V = unknown, S = string>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.TernarySearchNode<V, S>>): SynchronousTernarySearchTree<V, S>;
}

export const SynchronousTernarySearchTree = createTreeConstructor("SynchronousTernarySearchTree", false, "TernarySearchTree") as unknown as SynchronousTernarySearchTreeConstructor;

export interface AsynchronousTernarySearchTreeConstructor {
    new <V = unknown, S = string>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.TernarySearchNode<V, S>>): AsynchronousTernarySearchTree<V, S>;
}

export const AsynchronousTernarySearchTree = createTreeConstructor("AsynchronousTernarySearchTree", true, "TernarySearchTree") as unknown as AsynchronousTernarySearchTreeConstructor;
