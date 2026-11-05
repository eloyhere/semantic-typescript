import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousSearchTree, AsynchronousSearchTree } from "#semantic/structure/tree/searchTree";

/**
 * Synchronous B* tree: a multiway search tree with stricter occupancy than a
 * plain B-tree, requiring non-root pages to be at least two thirds full.
 *
 * Bulk construction chooses the smallest common leaf depth that can satisfy
 * that occupancy, packs keys into pages of at most `order - 1` keys (default
 * order 4), and rejects size/order combinations no legal packing can
 * represent. It performs no sibling redistribution; feasibility is decided
 * before any page is created.
 *
 * @template K the key type ordered by the search comparator
 */
export interface SynchronousBStarTree<K = unknown> extends SynchronousSearchTree<K, Nodes.BStarNode<K>> {}

/**
 * Asynchronous B* tree: the same two-thirds occupancy contract and
 * feasibility-first bulk build as the synchronous B* tree, with promise-based
 * collection queries.
 *
 * Pages and their separators are immutable after construction, so traversal
 * sees one fixed occupancy pattern. An async key source must complete before
 * the feasible leaf depth can be chosen, which the readiness gate enforces.
 *
 * @template K the key type ordered by the search comparator
 */
export interface AsynchronousBStarTree<K = unknown> extends AsynchronousSearchTree<K, Nodes.BStarNode<K>> {}

/**
 * Constructs a `SynchronousBStarTree` from an optional synchronous key
 * sequence.
 *
 * `options.order` sets the maximum child count (default 4) and must be an
 * integer of at least 3; the two-thirds minimum is derived from it.
 * `options.comparator` defaults to natural primitive ordering.
 * `options.buildNodes` may replace the built pages, including their occupancy.
 */
export interface SynchronousBStarTreeConstructor {
    new <K = unknown>(source?: Iterable<K>, options?: TreeOptions<K, Nodes.BStarNode<K>>): SynchronousBStarTree<K>;
}

export const SynchronousBStarTree = createTreeConstructor("SynchronousBStarTree", false, "BStarTree") as unknown as SynchronousBStarTreeConstructor;

/**
 * Constructs an `AsynchronousBStarTree`; the source may be synchronous or
 * asynchronous.
 *
 * Order validation, comparator defaults and the two-thirds occupancy rule are
 * shared with the synchronous constructor. Async keys are buffered before the
 * build so the tree never exposes a preliminary page split that would later
 * violate the minimum occupancy.
 */
export interface AsynchronousBStarTreeConstructor {
    new <K = unknown>(source?: Iterable<K> | AsyncIterable<K>, options?: TreeOptions<K, Nodes.BStarNode<K>>): AsynchronousBStarTree<K>;
}

export const AsynchronousBStarTree = createTreeConstructor("AsynchronousBStarTree", true, "BStarTree") as unknown as AsynchronousBStarTreeConstructor;
