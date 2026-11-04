import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousSearchTree, AsynchronousSearchTree } from "#semantic/structure/tree/searchTree";

export interface SynchronousBTree<K = unknown> extends SynchronousSearchTree<K, Nodes.BTreeNode<K>> {}

export interface AsynchronousBTree<K = unknown> extends AsynchronousSearchTree<K, Nodes.BTreeNode<K>> {}

export interface SynchronousBTreeConstructor {
    new <K = unknown>(source?: Iterable<K>, options?: TreeOptions<K, Nodes.BTreeNode<K>>): SynchronousBTree<K>;
}

export const SynchronousBTree = createTreeConstructor("SynchronousBTree", false, "BTree") as unknown as SynchronousBTreeConstructor;

export interface AsynchronousBTreeConstructor {
    new <K = unknown>(source?: Iterable<K> | AsyncIterable<K>, options?: TreeOptions<K, Nodes.BTreeNode<K>>): AsynchronousBTree<K>;
}

export const AsynchronousBTree = createTreeConstructor("AsynchronousBTree", true, "BTree") as unknown as AsynchronousBTreeConstructor;
