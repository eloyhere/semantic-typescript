import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

/**
 * Synchronous priority search tree: a two-coordinate index that behaves as a
 * search tree on x and as a priority queue on y.
 *
 * Bulk construction takes the element with the smallest y as the node (the
 * heap priority), orders the rest by x, and splits them at the median x. Each
 * node therefore holds the minimum y of its subtree, while `getSplit()` records
 * the x boundary. At least two coordinates are required.
 *
 * @template E the element type that carries the point
 */
export interface SynchronousPrioritySearchTree<E = unknown> extends SynchronousBinaryTree<E, Nodes.PrioritySearchNode<E>> {}

/**
 * Asynchronous priority search tree: the same x-split/y-priority contract as
 * the synchronous priority search tree, with promise-returning collection
 * queries.
 *
 * Split values and priorities are fixed once the tree is built; navigation
 * never recomputes them. An async source is drained before the minimum-y root
 * is chosen, so the heap priority reflects the complete point set.
 *
 * @template E the element type that carries the point
 */
export interface AsynchronousPrioritySearchTree<E = unknown> extends AsynchronousBinaryTree<E, Nodes.PrioritySearchNode<E>> {}

/**
 * Constructs a `SynchronousPrioritySearchTree` from points with at least two
 * coordinates.
 *
 * `options.pointOf` is mandatory for a nonempty tree and must return finite
 * coordinates of a fixed dimension; two or more coordinates are required, with
 * x at index 0 and the priority at index 1. `options.buildNodes` may replace
 * the built tree.
 */
export interface SynchronousPrioritySearchTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.PrioritySearchNode<E>>): SynchronousPrioritySearchTree<E>;
}

export const SynchronousPrioritySearchTree = createTreeConstructor("SynchronousPrioritySearchTree", false, "PrioritySearchTree") as unknown as SynchronousPrioritySearchTreeConstructor;

/**
 * Constructs an `AsynchronousPrioritySearchTree`; the source may be synchronous
 * or asynchronous.
 *
 * The point callback and the two-coordinate minimum are shared with the
 * synchronous constructor. An async source is collected before priorities are
 * compared, so the root is never chosen from a partial set.
 */
export interface AsynchronousPrioritySearchTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.PrioritySearchNode<E>>): AsynchronousPrioritySearchTree<E>;
}

export const AsynchronousPrioritySearchTree = createTreeConstructor("AsynchronousPrioritySearchTree", true, "PrioritySearchTree") as unknown as AsynchronousPrioritySearchTreeConstructor;
