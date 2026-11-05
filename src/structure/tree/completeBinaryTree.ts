import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

/**
 * Synchronous complete binary tree: every level is full except possibly the
 * last, which fills from left to right.
 *
 * The implicit array layout (left 2i+1, right 2i+2) over the input order is
 * complete by construction for any element count; an empty right slot can only
 * occur at the end of the last level. The node contract adds no search order,
 * so this type describes shape rather than ordering.
 *
 * @template E the element type stored in the tree
 * @template N the complete-binary node contract used by navigation
 */
export interface SynchronousCompleteBinaryTree<E = unknown, N extends Nodes.CompleteBinaryNode<E> = Nodes.CompleteBinaryNode<E>> extends SynchronousBinaryTree<E, N> {}

/**
 * Asynchronous complete binary tree: the same level-order shape guarantee as
 * the synchronous complete tree, with promise-returning collection queries.
 *
 * The implicit array is written once, so the "last level fills left to right"
 * property is never transient. Navigation and traversal stay synchronous, and
 * an async source is consumed before any index-based node is exposed.
 *
 * @template E the element type stored in the tree
 * @template N the complete-binary node contract used by navigation
 */
export interface AsynchronousCompleteBinaryTree<E = unknown, N extends Nodes.CompleteBinaryNode<E> = Nodes.CompleteBinaryNode<E>> extends AsynchronousBinaryTree<E, N> {}

/**
 * Constructs a `SynchronousCompleteBinaryTree` from an optional synchronous
 * source.
 *
 * Elements are written into the implicit array in input order, which yields a
 * complete shape for every size. The generic overload requires
 * `options.buildNodes` for a custom complete-binary node type; the element
 * overload uses `Nodes.CompleteBinaryNode`.
 */
export interface SynchronousCompleteBinaryTreeConstructor {
    new <E, N extends Nodes.CompleteBinaryNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousCompleteBinaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.CompleteBinaryNode<E>>): SynchronousCompleteBinaryTree<E>;
}

export const SynchronousCompleteBinaryTree = createTreeConstructor("SynchronousCompleteBinaryTree", false, "CompleteBinaryTree") as unknown as SynchronousCompleteBinaryTreeConstructor;

/**
 * Constructs an `AsynchronousCompleteBinaryTree`; the source may be
 * synchronous or asynchronous.
 *
 * Shape and input order follow the synchronous constructor, including the
 * custom-node `buildNodes` overload. For an async source the array is built
 * only after the iterable ends, so the completeness boundary is not observed
 * half-way through.
 */
export interface AsynchronousCompleteBinaryTreeConstructor {
    new <E, N extends Nodes.CompleteBinaryNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousCompleteBinaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.CompleteBinaryNode<E>>): AsynchronousCompleteBinaryTree<E>;
}

export const AsynchronousCompleteBinaryTree = createTreeConstructor("AsynchronousCompleteBinaryTree", true, "CompleteBinaryTree") as unknown as AsynchronousCompleteBinaryTreeConstructor;
