import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousSearchTree, AsynchronousSearchTree } from "#semantic/structure/tree/searchTree";

// 21–25. Pages, not individual keys, are yielded. B+ leaf values stay typed.
export interface SynchronousTwoThreeTree<K = unknown> extends SynchronousSearchTree<K, Nodes.TwoThreeNode<K>> {}

export interface AsynchronousTwoThreeTree<K = unknown> extends AsynchronousSearchTree<K, Nodes.TwoThreeNode<K>> {}

export interface SynchronousTwoThreeTreeConstructor {
    new <K = unknown>(source?: Iterable<K>, options?: TreeOptions<K, Nodes.TwoThreeNode<K>>): SynchronousTwoThreeTree<K>;
}

export const SynchronousTwoThreeTree = createTreeConstructor("SynchronousTwoThreeTree", false, "TwoThreeTree") as unknown as SynchronousTwoThreeTreeConstructor;

export interface AsynchronousTwoThreeTreeConstructor {
    new <K = unknown>(source?: Iterable<K> | AsyncIterable<K>, options?: TreeOptions<K, Nodes.TwoThreeNode<K>>): AsynchronousTwoThreeTree<K>;
}

export const AsynchronousTwoThreeTree = createTreeConstructor("AsynchronousTwoThreeTree", true, "TwoThreeTree") as unknown as AsynchronousTwoThreeTreeConstructor;
