import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

/**
 * Synchronous Cartesian tree: a binary tree whose in-order sequence is the
 * input order and whose priorities obey min-heap order.
 *
 * Bulk construction assigns a finite priority per element (from
 * `options.priority`, otherwise a fresh random value) and runs a linear
 * monotonic-stack build. In-order traversal therefore reproduces input
 * positions, each parent's priority is no greater than its children's, and no
 * comparator ordering is applied.
 *
 * @template E the element type stored in the Cartesian tree
 */
export interface SynchronousCartesianTree<E = unknown> extends SynchronousBinaryTree<E, Nodes.CartesianNode<E>> {}

/**
 * Asynchronous Cartesian tree: the same input-order/min-heap-priority contract
 * as the synchronous Cartesian tree, with promises on collection queries.
 *
 * Priorities are assigned once during construction and never recomputed, so
 * the shape is stable across traversals. An async source is buffered before
 * the monotonic-stack pass, keeping input positions and priority order aligned.
 *
 * @template E the element type stored in the Cartesian tree
 */
export interface AsynchronousCartesianTree<E = unknown> extends AsynchronousBinaryTree<E, Nodes.CartesianNode<E>> {}

/**
 * Constructs a `SynchronousCartesianTree` from an optional synchronous source.
 *
 * `options.priority` chooses each element's priority and must return a finite
 * number; when absent a fresh random priority is used. Elements are not sorted,
 * and `options.buildNodes` may replace the monotonic-stack layout with a custom
 * Cartesian shape.
 */
export interface SynchronousCartesianTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.CartesianNode<E>>): SynchronousCartesianTree<E>;
}

export const SynchronousCartesianTree = createTreeConstructor("SynchronousCartesianTree", false, "CartesianTree") as unknown as SynchronousCartesianTreeConstructor;

/**
 * Constructs an `AsynchronousCartesianTree`; the source may be synchronous or
 * asynchronous.
 *
 * The priority callback and its finite-number validation are unchanged from
 * the synchronous constructor. An async source is materialised before
 * priorities are assigned, so the random or computed priorities attach to a
 * complete, stable input order.
 */
export interface AsynchronousCartesianTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.CartesianNode<E>>): AsynchronousCartesianTree<E>;
}

export const AsynchronousCartesianTree = createTreeConstructor("AsynchronousCartesianTree", true, "CartesianTree") as unknown as AsynchronousCartesianTreeConstructor;
