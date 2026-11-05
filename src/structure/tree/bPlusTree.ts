import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousSearchTree, AsynchronousSearchTree } from "#semantic/structure/tree/searchTree";

/**
 * Synchronous B+ tree: a multiway search tree whose records live only in the
 * leaves, with those leaves chained in key order.
 *
 * Bulk construction groups `TreeEntry` records into leaf pages of at most
 * `order - 1` entries (default order 4), builds branch pages from the minimum
 * key of each child, and links adjacent leaves through `getPrevious()` and
 * `getNext()`. Branch separators route searches but carry no record value;
 * collection elements are the entries themselves.
 *
 * @template K the key type used for ordering and routing
 * @template V the value type stored beside a key in a leaf
 */
export interface SynchronousBPlusTree<K = unknown, V = unknown> extends SynchronousSearchTree<K, Nodes.BPlusNode<K, V>, Nodes.TreeEntry<K, V>> {}

/**
 * Asynchronous B+ tree: the same leaf-record and leaf-chain contract as the
 * synchronous B+ tree, exposed through promise-returning collection queries.
 *
 * Leaf and branch pages are fixed after construction; navigation excludes the
 * leaf-chain links, so `getPrevious()` and `getNext()` are sequence metadata
 * rather than child edges. An async source of entries is drained before the
 * first query observes the pages.
 *
 * @template K the key type used for ordering and routing
 * @template V the value type stored beside a key in a leaf
 */
export interface AsynchronousBPlusTree<K = unknown, V = unknown> extends AsynchronousSearchTree<K, Nodes.BPlusNode<K, V>, Nodes.TreeEntry<K, V>> {}

/**
 * Constructs a `SynchronousBPlusTree` from an optional synchronous sequence of
 * `TreeEntry` records.
 *
 * Keys are ordered with `options.comparator` or a natural primitive order;
 * `options.keyOf` and `options.valueOf` may derive key/value from richer
 * element objects. `options.order` sets the page capacity (default 4), and
 * `options.buildNodes` may replace the built leaf and branch pages.
 */
export interface SynchronousBPlusTreeConstructor {
    new <K = unknown, V = unknown>(source?: Iterable<Nodes.TreeEntry<K, V>>, options?: TreeOptions<Nodes.TreeEntry<K, V>, Nodes.BPlusNode<K, V>>): SynchronousBPlusTree<K, V>;
}

export const SynchronousBPlusTree = createTreeConstructor("SynchronousBPlusTree", false, "BPlusTree") as unknown as SynchronousBPlusTreeConstructor;

/**
 * Constructs an `AsynchronousBPlusTree`; the source may be synchronous or
 * asynchronous.
 *
 * Entry ordering, key/value extraction and page capacity match the synchronous
 * constructor. An asynchronous source delays page construction until every
 * entry has arrived; leaf-chain links are then assigned in one pass.
 */
export interface AsynchronousBPlusTreeConstructor {
    new <K = unknown, V = unknown>(source?: Iterable<Nodes.TreeEntry<K, V>> | AsyncIterable<Nodes.TreeEntry<K, V>>, options?: TreeOptions<Nodes.TreeEntry<K, V>, Nodes.BPlusNode<K, V>>): AsynchronousBPlusTree<K, V>;
}

export const AsynchronousBPlusTree = createTreeConstructor("AsynchronousBPlusTree", true, "BPlusTree") as unknown as AsynchronousBPlusTreeConstructor;
