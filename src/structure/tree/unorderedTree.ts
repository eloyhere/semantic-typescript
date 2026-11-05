import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

/**
 * Synchronous unordered tree: a rooted tree whose child enumeration order
 * carries no semantic meaning.
 *
 * The bulk builder still emits children in input order, but the node contract
 * marks that order as incidental, so algorithms must not depend on it. The
 * layout uses the configured arity (2 by default) and otherwise matches
 * `RootedTree`.
 *
 * @template E the element type stored in the tree
 */
export interface SynchronousUnorderedTree<E = unknown> extends SynchronousRootedTree<E, Nodes.UnorderedTreeNode<E>> {}

/**
 * Asynchronous unordered tree: the same order-agnostic child contract as the
 * synchronous unordered tree, with promise-returning collection queries.
 *
 * Children are stored in input order but that order is explicitly not part of
 * the contract, so consumers may reorder or compare them only as a set. An
 * async source is drained before the tree is assembled.
 *
 * @template E the element type stored in the tree
 */
export interface AsynchronousUnorderedTree<E = unknown> extends AsynchronousRootedTree<E, Nodes.UnorderedTreeNode<E>> {}

/**
 * Constructs a `SynchronousUnorderedTree` from an optional synchronous source.
 *
 * Elements are attached with the configured arity (default 2); the resulting
 * child order is an implementation detail rather than a promise. There is no
 * custom-node overload, because the node type is fixed to
 * `Nodes.UnorderedTreeNode`.
 */
export interface SynchronousUnorderedTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.UnorderedTreeNode<E>>): SynchronousUnorderedTree<E>;
}

export const SynchronousUnorderedTree = createTreeConstructor("SynchronousUnorderedTree", false, "UnorderedTree") as unknown as SynchronousUnorderedTreeConstructor;

/**
 * Constructs an `AsynchronousUnorderedTree`; the source may be synchronous or
 * asynchronous.
 *
 * The arity-based layout and order-agnostic contract match the synchronous
 * constructor. An async source is fully read before children are attached, so
 * the initial enumeration order is at least stable.
 */
export interface AsynchronousUnorderedTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.UnorderedTreeNode<E>>): AsynchronousUnorderedTree<E>;
}

export const AsynchronousUnorderedTree = createTreeConstructor("AsynchronousUnorderedTree", true, "UnorderedTree") as unknown as AsynchronousUnorderedTreeConstructor;
