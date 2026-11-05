import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

// 12–20. Specialised traversal retains height, colour, priority and level getters.
/**
 * Synchronous binary search tree: the shared root contract for ordered binary
 * trees whose left subtree compares below and right subtree above each node.
 *
 * The concrete build sorts by the comparator and recursively splits at the
 * midpoint, producing a height-balanced search tree with stable ordering among
 * equal elements. The interface adds no members of its own; heights, subtree
 * sizes, colours and priorities arrive through the specialised node contracts.
 *
 * @template E the element type ordered by the search comparator
 * @template N the concrete binary search node contract
 */
export interface SynchronousBinarySearchTree<E = unknown, N extends Nodes.BinarySearchNode<E> = Nodes.BinarySearchNode<E>> extends SynchronousBinaryTree<E, N> {}

/**
 * Asynchronous binary search tree: the binary-search node contract of the
 * synchronous root, with `root()` and collection queries returning promises.
 *
 * The search order is materialised during construction; traversal and node
 * navigation stay synchronous. The generic node parameter lets asynchronous
 * AVL, red-black, AA, treap and splay trees reuse this contract without
 * redeclaring binary search semantics.
 *
 * @template E the element type ordered by the search comparator
 * @template N the concrete binary search node contract
 */
export interface AsynchronousBinarySearchTree<E = unknown, N extends Nodes.BinarySearchNode<E> = Nodes.BinarySearchNode<E>> extends AsynchronousBinaryTree<E, N> {}

/**
 * Constructs a `SynchronousBinarySearchTree` from an optional synchronous
 * source.
 *
 * The generic overload accepts a custom `BinarySearchNode` subtype and
 * requires `options.buildNodes`; the element overload uses the default node and
 * the built-in sorted midpoint layout. The comparator defaults to numbers,
 * strings, bigints and booleans, and rejects `NaN`.
 */
export interface SynchronousBinarySearchTreeConstructor {
    new <E, N extends Nodes.BinarySearchNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousBinarySearchTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.BinarySearchNode<E>>): SynchronousBinarySearchTree<E>;
}

export const SynchronousBinarySearchTree = createTreeConstructor("SynchronousBinarySearchTree", false, "BinarySearchTree") as unknown as SynchronousBinarySearchTreeConstructor;

/**
 * Constructs an `AsynchronousBinarySearchTree`; the source may be synchronous
 * or asynchronous.
 *
 * As in the synchronous constructor, the generic overload requires
 * `options.buildNodes` for custom node types, while the element overload uses
 * the built-in sorted midpoint layout. Async sources are drained behind the
 * readiness gate before any query observes the search order.
 */
export interface AsynchronousBinarySearchTreeConstructor {
    new <E, N extends Nodes.BinarySearchNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousBinarySearchTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.BinarySearchNode<E>>): AsynchronousBinarySearchTree<E>;
}

export const AsynchronousBinarySearchTree = createTreeConstructor("AsynchronousBinarySearchTree", true, "BinarySearchTree") as unknown as AsynchronousBinarySearchTreeConstructor;
