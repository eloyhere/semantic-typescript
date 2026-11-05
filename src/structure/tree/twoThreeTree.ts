import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousSearchTree, AsynchronousSearchTree } from "#semantic/structure/tree/searchTree";

// 21–25. Pages, not individual keys, are yielded. B+ leaf values stay typed.
/**
 * Synchronous 2-3 tree: a multiway search tree with one or two keys per page
 * and two or three children; all leaves share one depth.
 *
 * The bulk builder fixes the order at 3, ignoring `options.order`, sorts keys
 * by the comparator, and builds pages with at least one key outside the root.
 * `getKeys()` and `isLeaf()` describe a page; split and merge history is not
 * represented.
 *
 * @template K the key type ordered by the search comparator
 */
export interface SynchronousTwoThreeTree<K = unknown> extends SynchronousSearchTree<K, Nodes.TwoThreeNode<K>> {}

/**
 * Asynchronous 2-3 tree: the same three-way page contract and fixed order 3 as
 * the synchronous 2-3 tree, with promise-returning collection queries.
 *
 * Pages and separators are fixed after construction, and traversal yields pages
 * rather than individual keys. An async key source is collected before packing,
 * so no page is split after it has been observed.
 *
 * @template K the key type ordered by the search comparator
 */
export interface AsynchronousTwoThreeTree<K = unknown> extends AsynchronousSearchTree<K, Nodes.TwoThreeNode<K>> {}

/**
 * Constructs a `SynchronousTwoThreeTree` from an optional synchronous key
 * sequence.
 *
 * The branching factor is fixed at 3, so `options.order` is not consulted; keys
 * are comparator-sorted into pages that can hold only one or two keys, each
 * with two or three children. `options.keyOf` may map elements to keys, and
 * `options.buildNodes` may replace the pages.
 */
export interface SynchronousTwoThreeTreeConstructor {
    new <K = unknown>(source?: Iterable<K>, options?: TreeOptions<K, Nodes.TwoThreeNode<K>>): SynchronousTwoThreeTree<K>;
}

export const SynchronousTwoThreeTree = createTreeConstructor("SynchronousTwoThreeTree", false, "TwoThreeTree") as unknown as SynchronousTwoThreeTreeConstructor;

/**
 * Constructs an `AsynchronousTwoThreeTree`; the source may be synchronous or
 * asynchronous.
 *
 * The fixed order and key extraction match the synchronous constructor. An
 * async source is drained before pages are packed, so every leaf depth is
 * decided from the complete key count.
 */
export interface AsynchronousTwoThreeTreeConstructor {
    new <K = unknown>(source?: Iterable<K> | AsyncIterable<K>, options?: TreeOptions<K, Nodes.TwoThreeNode<K>>): AsynchronousTwoThreeTree<K>;
}

export const AsynchronousTwoThreeTree = createTreeConstructor("AsynchronousTwoThreeTree", true, "TwoThreeTree") as unknown as AsynchronousTwoThreeTreeConstructor;
