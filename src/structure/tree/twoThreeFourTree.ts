import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousSearchTree, AsynchronousSearchTree } from "#semantic/structure/tree/searchTree";

export interface SynchronousTwoThreeFourTree<K = unknown> extends SynchronousSearchTree<K, Nodes.TwoThreeFourNode<K>> {}

export interface AsynchronousTwoThreeFourTree<K = unknown> extends AsynchronousSearchTree<K, Nodes.TwoThreeFourNode<K>> {}

export interface SynchronousTwoThreeFourTreeConstructor {
    new <K = unknown>(source?: Iterable<K>, options?: TreeOptions<K, Nodes.TwoThreeFourNode<K>>): SynchronousTwoThreeFourTree<K>;
}

export const SynchronousTwoThreeFourTree = createTreeConstructor("SynchronousTwoThreeFourTree", false, "TwoThreeFourTree") as unknown as SynchronousTwoThreeFourTreeConstructor;

export interface AsynchronousTwoThreeFourTreeConstructor {
    new <K = unknown>(source?: Iterable<K> | AsyncIterable<K>, options?: TreeOptions<K, Nodes.TwoThreeFourNode<K>>): AsynchronousTwoThreeFourTree<K>;
}

export const AsynchronousTwoThreeFourTree = createTreeConstructor("AsynchronousTwoThreeFourTree", true, "TwoThreeFourTree") as unknown as AsynchronousTwoThreeFourTreeConstructor;
