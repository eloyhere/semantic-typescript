import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRTree, AsynchronousRTree } from "#semantic/structure/tree/rTree";

/**
 * Synchronous R* tree: the R-tree variant whose tree-level algorithms reinsert
 * entries and choose splits to reduce overlap.
 *
 * Bulk construction groups entries into pages of at most `order` boxes
 * (default 4) and stacks pages until one root remains, each node's bounds being
 * the union of its children. The star-specific reinsertion heuristic is not
 * replayed by this structural build; it belongs to dynamic maintenance.
 *
 * @template E the element type indexed by the tree
 */
export interface SynchronousRStarTree<E = unknown> extends SynchronousRTree<E, Nodes.RStarNode<E>> {}

/**
 * Asynchronous R* tree: the same page grouping and union-bounds contract as the
 * synchronous R* tree, with promise-returning collection queries.
 *
 * Pages are static after the bulk build, so no reinsertion occurs while queries
 * observe the tree. An async source is drained before entries are grouped,
 * since every page's box depends on its final member set.
 *
 * @template E the element type indexed by the tree
 */
export interface AsynchronousRStarTree<E = unknown> extends AsynchronousRTree<E, Nodes.RStarNode<E>> {}

/**
 * Constructs a `SynchronousRStarTree` from spatial objects.
 *
 * `options.boundsOf` is mandatory for a nonempty tree, `options.order` sets the
 * page capacity (default 4), and `options.buildNodes` may replace the page
 * hierarchy. The builder produces a static R* layout, not a dynamically
 * reinserting tree.
 */
export interface SynchronousRStarTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.RStarNode<E>>): SynchronousRStarTree<E>;
}

export const SynchronousRStarTree = createTreeConstructor("SynchronousRStarTree", false, "RStarTree") as unknown as SynchronousRStarTreeConstructor;

/**
 * Constructs an `AsynchronousRStarTree`; the source may be synchronous or
 * asynchronous.
 *
 * Box extraction, page capacity and the static bulk layout match the
 * synchronous constructor. An async source is collected before grouping, so a
 * page is never opened for an element that arrives later.
 */
export interface AsynchronousRStarTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.RStarNode<E>>): AsynchronousRStarTree<E>;
}

export const AsynchronousRStarTree = createTreeConstructor("AsynchronousRStarTree", true, "RStarTree") as unknown as AsynchronousRStarTreeConstructor;
