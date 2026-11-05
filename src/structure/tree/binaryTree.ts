import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousOrderedTree, AsynchronousOrderedTree } from "#semantic/structure/tree/orderedTree";

/**
 * Synchronous binary tree: an ordered rooted tree in which each node has
 * distinct left and right positions, either of which may be empty.
 *
 * Bulk construction fills the implicit complete-tree array (left 2i+1, right
 * 2i+2) in input order, so no search or heap order is implied. Empty slots are
 * preserved during navigation even though they never appear as children; the
 * node contract adds `getLeft()` and `getRight()` to the ordered tree.
 *
 * @template E the element type stored in the tree
 * @template N the binary node contract used by navigation
 */
export interface SynchronousBinaryTree<E = unknown, N extends Nodes.BinaryNode<E> = Nodes.BinaryNode<E>> extends SynchronousOrderedTree<E, N> {}

/**
 * Asynchronous binary tree: the same left/right node contract and implicit
 * array build as the synchronous binary tree, with promise-returning
 * collection queries.
 *
 * Structure and slot emptiness are fixed at build time; the four traversals
 * and node navigation stay synchronous. An async source is drained before the
 * tree becomes observable, so left/right slots are never partially assigned.
 *
 * @template E the element type stored in the tree
 * @template N the binary node contract used by navigation
 */
export interface AsynchronousBinaryTree<E = unknown, N extends Nodes.BinaryNode<E> = Nodes.BinaryNode<E>> extends AsynchronousOrderedTree<E, N> {}

/**
 * Constructs a `SynchronousBinaryTree` from an optional synchronous source.
 *
 * The generic overload takes a `BinaryNode` subtype and requires
 * `options.buildNodes`; the element overload fills the implicit left/right
 * array layout in input order. The builder retains every occurrence and
 * rejects null or undefined elements.
 */
export interface SynchronousBinaryTreeConstructor {
    new <E, N extends Nodes.BinaryNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousBinaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.BinaryNode<E>>): SynchronousBinaryTree<E>;
}

export const SynchronousBinaryTree = createTreeConstructor("SynchronousBinaryTree", false, "BinaryTree") as unknown as SynchronousBinaryTreeConstructor;

/**
 * Constructs an `AsynchronousBinaryTree`; the source may be a synchronous or
 * asynchronous iterable.
 *
 * The generic overload again requires `options.buildNodes` for a custom
 * `BinaryNode` type. The element overload uses the implicit left/right layout;
 * for async sources the constructor returns before the source is drained.
 */
export interface AsynchronousBinaryTreeConstructor {
    new <E, N extends Nodes.BinaryNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousBinaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.BinaryNode<E>>): AsynchronousBinaryTree<E>;
}

export const AsynchronousBinaryTree = createTreeConstructor("AsynchronousBinaryTree", true, "BinaryTree") as unknown as AsynchronousBinaryTreeConstructor;
