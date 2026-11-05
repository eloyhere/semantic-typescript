import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousFullBinaryTree, AsynchronousFullBinaryTree } from "#semantic/structure/tree/fullBinaryTree";

/**
 * Synchronous perfect binary tree: a full binary tree in which every leaf sits
 * at the same depth, so a nonempty tree has exactly 2^k - 1 elements.
 *
 * Bulk construction requires a cardinality of 2^k - 1 and fills the implicit
 * complete binary layout, which is perfect for that size; any other size is
 * rejected rather than truncated or padded. `PerfectBinaryNode` adds the
 * perfect-shape marker to the full-binary contract.
 *
 * @template E the element type stored in the tree
 */
export interface SynchronousPerfectBinaryTree<E = unknown> extends SynchronousFullBinaryTree<E, Nodes.PerfectBinaryNode<E>> {}

/**
 * Asynchronous perfect binary tree: the same 2^k - 1 cardinality rule and
 * uniform leaf depth as the synchronous perfect tree, with promise-returning
 * collection queries.
 *
 * Because the size constraint is checked once at construction, every query sees
 * the same perfect shape. An async source is fully read before the check, since
 * neither fullness nor uniform depth can be established from a prefix.
 *
 * @template E the element type stored in the tree
 */
export interface AsynchronousPerfectBinaryTree<E = unknown> extends AsynchronousFullBinaryTree<E, Nodes.PerfectBinaryNode<E>> {}

/**
 * Constructs a `SynchronousPerfectBinaryTree` from an optional synchronous
 * source.
 *
 * A nonempty source must contain exactly 2^k - 1 elements; the builder rejects
 * every other cardinality with a `RangeError` instead of padding. There is no
 * custom-node overload: the node type is fixed to `PerfectBinaryNode`.
 */
export interface SynchronousPerfectBinaryTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.PerfectBinaryNode<E>>): SynchronousPerfectBinaryTree<E>;
}

export const SynchronousPerfectBinaryTree = createTreeConstructor("SynchronousPerfectBinaryTree", false, "PerfectBinaryTree") as unknown as SynchronousPerfectBinaryTreeConstructor;

/**
 * Constructs an `AsynchronousPerfectBinaryTree`; the source may be synchronous
 * or asynchronous.
 *
 * The 2^k - 1 rule is unchanged and is evaluated after the source completes.
 * With an async iterable the constructor returns first and queries wait on
 * readiness, so an invalid size surfaces through that first awaited operation.
 */
export interface AsynchronousPerfectBinaryTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.PerfectBinaryNode<E>>): AsynchronousPerfectBinaryTree<E>;
}

export const AsynchronousPerfectBinaryTree = createTreeConstructor("AsynchronousPerfectBinaryTree", true, "PerfectBinaryTree") as unknown as AsynchronousPerfectBinaryTreeConstructor;
