import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

/**
 * Synchronous full binary tree: every node has either zero or two children, so
 * leaves are created in sibling pairs.
 *
 * Bulk construction expands the earliest leaf with the next two elements,
 * which preserves fullness for every odd element count. A nonempty even-sized
 * input is rejected rather than padded, and navigation still distinguishes the
 * left and right slots of each internal node.
 *
 * @template E the element type stored in the tree
 * @template N the full-binary node contract used by navigation
 */
export interface SynchronousFullBinaryTree<E = unknown, N extends Nodes.FullBinaryNode<E> = Nodes.FullBinaryNode<E>> extends SynchronousBinaryTree<E, N> {}

/**
 * Asynchronous full binary tree: the same zero-or-two-children guarantee as the
 * synchronous full binary tree, with promise-returning collection queries.
 *
 * The pairing is completed during construction, so no query can observe a node
 * with a single child. An async source is read in full before pairing starts,
 * which also lets the odd-size requirement be checked once.
 *
 * @template E the element type stored in the tree
 * @template N the full-binary node contract used by navigation
 */
export interface AsynchronousFullBinaryTree<E = unknown, N extends Nodes.FullBinaryNode<E> = Nodes.FullBinaryNode<E>> extends AsynchronousBinaryTree<E, N> {}

/**
 * Constructs a `SynchronousFullBinaryTree` from an optional synchronous source.
 *
 * A nonempty source must contain an odd number of elements, otherwise a
 * `RangeError` is raised instead of padding the tree. The generic overload
 * requires `options.buildNodes` for a custom full-binary node type.
 */
export interface SynchronousFullBinaryTreeConstructor {
    new <E, N extends Nodes.FullBinaryNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousFullBinaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.FullBinaryNode<E>>): SynchronousFullBinaryTree<E>;
}

export const SynchronousFullBinaryTree = createTreeConstructor("SynchronousFullBinaryTree", false, "FullBinaryTree") as unknown as SynchronousFullBinaryTreeConstructor;

/**
 * Constructs an `AsynchronousFullBinaryTree`; the source may be synchronous or
 * asynchronous.
 *
 * The odd-cardinality rule and custom-node overload match the synchronous
 * constructor. For an async source the size is known only after the iterable
 * ends, so the constructor defers validation and construction until then.
 */
export interface AsynchronousFullBinaryTreeConstructor {
    new <E, N extends Nodes.FullBinaryNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousFullBinaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.FullBinaryNode<E>>): AsynchronousFullBinaryTree<E>;
}

export const AsynchronousFullBinaryTree = createTreeConstructor("AsynchronousFullBinaryTree", true, "FullBinaryTree") as unknown as AsynchronousFullBinaryTreeConstructor;
