import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

export interface SynchronousDominatorTree<V = unknown> extends SynchronousRootedTree<V, Nodes.DominatorNode<V>> {}

export interface AsynchronousDominatorTree<V = unknown> extends AsynchronousRootedTree<V, Nodes.DominatorNode<V>> {}

export interface SynchronousDominatorTreeConstructor {
    new <V = unknown>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.DominatorNode<V>>): SynchronousDominatorTree<V>;
}

export const SynchronousDominatorTree = createTreeConstructor("SynchronousDominatorTree", false, "DominatorTree") as unknown as SynchronousDominatorTreeConstructor;

export interface AsynchronousDominatorTreeConstructor {
    new <V = unknown>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.DominatorNode<V>>): AsynchronousDominatorTree<V>;
}

export const AsynchronousDominatorTree = createTreeConstructor("AsynchronousDominatorTree", true, "DominatorTree") as unknown as AsynchronousDominatorTreeConstructor;
