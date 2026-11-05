import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

/**
 * Synchronous weight-balanced tree: a binary search tree balanced by subtree
 * sizes rather than by height or colour.
 *
 * Bulk construction sorts by the comparator and splits the sorted array at its
 * midpoint, so sibling subtree sizes differ by at most one and every node caches
 * `getSubtreeSize()`. That cached weight is the quantity a weight-balanced
 * rebuild would compare against an alpha threshold.
 *
 * @template E the element type ordered by the tree comparator
 */
export interface SynchronousWeightBalancedTree<E = unknown> extends SynchronousBinarySearchTree<E, Nodes.WeightBalancedNode<E>> {}

/**
 * Asynchronous weight-balanced tree: the same subtree-size contract as the
 * synchronous weight-balanced tree, with promise-returning collection queries.
 *
 * Subtree weights are computed once from the built midpoint layout; reads never
 * repair them. An async source is sorted and balanced before the first query,
 * so cached sizes describe final subtrees.
 *
 * @template E the element type ordered by the tree comparator
 */
export interface AsynchronousWeightBalancedTree<E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.WeightBalancedNode<E>> {}

/**
 * Constructs a `SynchronousWeightBalancedTree` from an optional synchronous
 * source.
 *
 * Elements are comparator-sorted and split at the midpoint, and each node's
 * subtree size is cached during construction. `options.buildNodes` may replace
 * the layout, in which case the supplied nodes must carry correct sizes.
 */
export interface SynchronousWeightBalancedTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.WeightBalancedNode<E>>): SynchronousWeightBalancedTree<E>;
}

export const SynchronousWeightBalancedTree = createTreeConstructor("SynchronousWeightBalancedTree", false, "WeightBalancedTree") as unknown as SynchronousWeightBalancedTreeConstructor;

/**
 * Constructs an `AsynchronousWeightBalancedTree`; the source may be synchronous
 * or asynchronous.
 *
 * Sorting, midpoint splitting and size caching match the synchronous
 * constructor. An async source is drained before sizes are computed, so no
 * cached weight covers an element still in flight.
 */
export interface AsynchronousWeightBalancedTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.WeightBalancedNode<E>>): AsynchronousWeightBalancedTree<E>;
}

export const AsynchronousWeightBalancedTree = createTreeConstructor("AsynchronousWeightBalancedTree", true, "WeightBalancedTree") as unknown as AsynchronousWeightBalancedTreeConstructor;
