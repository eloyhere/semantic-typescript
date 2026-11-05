import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

/**
 * Synchronous scapegoat tree: a binary search tree whose nodes cache subtree
 * sizes, the weight a scapegoat rebuild would inspect.
 *
 * Bulk construction sorts by the comparator and uses the height-balanced
 * midpoint layout, so no alpha threshold is exercised and no subtree is rebuilt
 * during the build. `getSubtreeSize()` exposes the cached weight; duplicate
 * elements keep stable input order.
 *
 * @template E the element type ordered by the tree comparator
 */
export interface SynchronousScapegoatTree<E = unknown> extends SynchronousBinarySearchTree<E, Nodes.ScapegoatNode<E>> {}

/**
 * Asynchronous scapegoat tree: the same subtree-size metadata as the synchronous
 * scapegoat tree, with promise-returning collection queries.
 *
 * Subtree sizes are computed once from the built midpoint layout and are not
 * repaired by reads. An async source is sorted and balanced before the first
 * query, so cached sizes always describe final subtrees.
 *
 * @template E the element type ordered by the tree comparator
 */
export interface AsynchronousScapegoatTree<E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.ScapegoatNode<E>> {}

/**
 * Constructs a `SynchronousScapegoatTree` from an optional synchronous source.
 *
 * Elements are comparator-sorted and balanced by midpoint split; the builder
 * exposes no alpha option, so rebalancing thresholds are not configurable here.
 * `options.buildNodes` may replace the layout, including the cached subtree
 * sizes.
 */
export interface SynchronousScapegoatTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.ScapegoatNode<E>>): SynchronousScapegoatTree<E>;
}

export const SynchronousScapegoatTree = createTreeConstructor("SynchronousScapegoatTree", false, "ScapegoatTree") as unknown as SynchronousScapegoatTreeConstructor;

/**
 * Constructs an `AsynchronousScapegoatTree`; the source may be synchronous or
 * asynchronous.
 *
 * Sorting, midpoint balancing and the absence of an alpha option match the
 * synchronous constructor. An async source is fully read before subtree sizes
 * are cached, so no cached weight covers a partial subtree.
 */
export interface AsynchronousScapegoatTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.ScapegoatNode<E>>): AsynchronousScapegoatTree<E>;
}

export const AsynchronousScapegoatTree = createTreeConstructor("AsynchronousScapegoatTree", true, "ScapegoatTree") as unknown as AsynchronousScapegoatTreeConstructor;
