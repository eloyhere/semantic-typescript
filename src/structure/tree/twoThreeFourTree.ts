import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousSearchTree, AsynchronousSearchTree } from "#semantic/structure/tree/searchTree";

/**
 * Synchronous 2-3-4 tree: a multiway search tree with one to three keys per
 * page and two to four children; every leaf sits at the same depth.
 *
 * The bulk builder fixes the order at 4, ignoring `options.order`, sorts keys
 * by the comparator, and packs them into pages with the B-tree minimum
 * occupancy. `TwoThreeFourNode` exposes keys, children, parent and leaf status;
 * split and merge history is not represented.
 *
 * @template K the key type ordered by the search comparator
 */
export interface SynchronousTwoThreeFourTree<K = unknown> extends SynchronousSearchTree<K, Nodes.TwoThreeFourNode<K>> {}

/**
 * Asynchronous 2-3-4 tree: the same four-way page contract and fixed order 4 as
 * the synchronous 2-3-4 tree, with promise-returning collection queries.
 *
 * The page hierarchy is static after construction, so a query never observes a
 * transitional three-way page. An async key source is collected before pages
 * are packed, keeping every leaf at one depth.
 *
 * @template K the key type ordered by the search comparator
 */
export interface AsynchronousTwoThreeFourTree<K = unknown> extends AsynchronousSearchTree<K, Nodes.TwoThreeFourNode<K>> {}

/**
 * Constructs a `SynchronousTwoThreeFourTree` from an optional synchronous key
 * sequence.
 *
 * The branching factor is fixed at 4, so `options.order` is not consulted;
 * keys are comparator-sorted into pages of one to three keys, allowing up to
 * four children per page. `options.keyOf` may map elements to keys, and
 * `options.buildNodes` may replace the pages.
 */
export interface SynchronousTwoThreeFourTreeConstructor {
    new <K = unknown>(source?: Iterable<K>, options?: TreeOptions<K, Nodes.TwoThreeFourNode<K>>): SynchronousTwoThreeFourTree<K>;
}

export const SynchronousTwoThreeFourTree = createTreeConstructor("SynchronousTwoThreeFourTree", false, "TwoThreeFourTree") as unknown as SynchronousTwoThreeFourTreeConstructor;

/**
 * Constructs an `AsynchronousTwoThreeFourTree`; the source may be synchronous
 * or asynchronous.
 *
 * The fixed order and key extraction match the synchronous constructor. An
 * async source is drained before packing, so the chosen leaf depth and page
 * occupancy describe the final key count.
 */
export interface AsynchronousTwoThreeFourTreeConstructor {
    new <K = unknown>(source?: Iterable<K> | AsyncIterable<K>, options?: TreeOptions<K, Nodes.TwoThreeFourNode<K>>): AsynchronousTwoThreeFourTree<K>;
}

export const AsynchronousTwoThreeFourTree = createTreeConstructor("AsynchronousTwoThreeFourTree", true, "TwoThreeFourTree") as unknown as AsynchronousTwoThreeFourTreeConstructor;
