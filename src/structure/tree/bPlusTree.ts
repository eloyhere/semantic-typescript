import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousSearchTree, AsynchronousSearchTree } from "#semantic/structure/tree/searchTree";

export interface SynchronousBPlusTree<K = unknown, V = unknown> extends SynchronousSearchTree<K, Nodes.BPlusNode<K, V>, Nodes.TreeEntry<K, V>> {}

export interface AsynchronousBPlusTree<K = unknown, V = unknown> extends AsynchronousSearchTree<K, Nodes.BPlusNode<K, V>, Nodes.TreeEntry<K, V>> {}

export interface SynchronousBPlusTreeConstructor {
    new <K = unknown, V = unknown>(source?: Iterable<Nodes.TreeEntry<K, V>>, options?: TreeOptions<Nodes.TreeEntry<K, V>, Nodes.BPlusNode<K, V>>): SynchronousBPlusTree<K, V>;
}

export const SynchronousBPlusTree = createTreeConstructor("SynchronousBPlusTree", false, "BPlusTree") as unknown as SynchronousBPlusTreeConstructor;

export interface AsynchronousBPlusTreeConstructor {
    new <K = unknown, V = unknown>(source?: Iterable<Nodes.TreeEntry<K, V>> | AsyncIterable<Nodes.TreeEntry<K, V>>, options?: TreeOptions<Nodes.TreeEntry<K, V>, Nodes.BPlusNode<K, V>>): AsynchronousBPlusTree<K, V>;
}

export const AsynchronousBPlusTree = createTreeConstructor("AsynchronousBPlusTree", true, "BPlusTree") as unknown as AsynchronousBPlusTreeConstructor;
