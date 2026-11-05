import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

/**
 * Synchronous skewed binary tree: every node has at most one child, always on
 * the declared side.
 *
 * Bulk construction chains elements in input order toward `options.direction`
 * ("left" by default), so the tree degenerates into a path and
 * `getDirection()` reports the side shared by all links. The opposite child slot
 * stays empty at every node, and no balancing is attempted.
 *
 * @template E the element type stored along the chain
 */
export interface SynchronousSkewedBinaryTree<E = unknown> extends SynchronousBinaryTree<E, Nodes.SkewedBinaryNode<E>> {}

/**
 * Asynchronous skewed binary tree: the same one-sided chain and direction
 * metadata as the synchronous skewed tree, with promise-returning collection
 * queries.
 *
 * Direction is fixed once the chain is built, and traversal simply follows the
 * occupied slot. An async source is drained before chaining, so the direction
 * applies uniformly to the complete element sequence.
 *
 * @template E the element type stored along the chain
 */
export interface AsynchronousSkewedBinaryTree<E = unknown> extends AsynchronousBinaryTree<E, Nodes.SkewedBinaryNode<E>> {}

/**
 * Constructs a `SynchronousSkewedBinaryTree` from an optional synchronous
 * source.
 *
 * `options.direction` must be "left" or "right" when supplied and defaults to
 * "left"; the chain is built in input order. `options.buildNodes` may replace
 * the chain, but a custom build must keep each node to at most one child on the
 * declared side.
 */
export interface SynchronousSkewedBinaryTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.SkewedBinaryNode<E>>): SynchronousSkewedBinaryTree<E>;
}

export const SynchronousSkewedBinaryTree = createTreeConstructor("SynchronousSkewedBinaryTree", false, "SkewedBinaryTree") as unknown as SynchronousSkewedBinaryTreeConstructor;

/**
 * Constructs an `AsynchronousSkewedBinaryTree`; the source may be synchronous or
 * asynchronous.
 *
 * Direction validation and input-order chaining match the synchronous
 * constructor. An async source is fully read before links are created, so the
 * chain direction is uniform across all nodes.
 */
export interface AsynchronousSkewedBinaryTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.SkewedBinaryNode<E>>): AsynchronousSkewedBinaryTree<E>;
}

export const AsynchronousSkewedBinaryTree = createTreeConstructor("AsynchronousSkewedBinaryTree", true, "SkewedBinaryTree") as unknown as AsynchronousSkewedBinaryTreeConstructor;
