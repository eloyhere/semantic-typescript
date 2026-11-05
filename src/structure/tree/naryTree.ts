import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousOrderedTree, AsynchronousOrderedTree } from "#semantic/structure/tree/orderedTree";

/**
 * Synchronous n-ary tree: an ordered rooted tree whose nodes have at most the
 * tree-wide arity and expose that limit through `getArity()`.
 *
 * Bulk construction lays elements out in input order, giving each parent up to
 * `options.arity` children (default 2); child order is significant. An arity of
 * one degenerates into a chain, and the contract implies no search order beyond
 * the arity bound and child sequence.
 *
 * @template E the element type stored in the tree
 * @template N the n-ary node contract used by navigation
 */
export interface SynchronousNaryTree<E = unknown, N extends Nodes.NaryNode<E> = Nodes.NaryNode<E>> extends SynchronousOrderedTree<E, N> {}

/**
 * Asynchronous n-ary tree: the same arity-bounded, ordered-child contract as
 * the synchronous n-ary tree, with promise-returning collection queries.
 *
 * The layout is fixed once built, so `getArity()` and child order are stable
 * through traversal. An async source is drained before children are assigned,
 * keeping every parent within the declared arity.
 *
 * @template E the element type stored in the tree
 * @template N the n-ary node contract used by navigation
 */
export interface AsynchronousNaryTree<E = unknown, N extends Nodes.NaryNode<E> = Nodes.NaryNode<E>> extends AsynchronousOrderedTree<E, N> {}

/**
 * Constructs a `SynchronousNaryTree` from an optional synchronous source.
 *
 * `options.arity` is a positive safe integer (default 2) and bounds the child
 * count of every node. The generic overload requires `options.buildNodes` for a
 * custom n-ary node type; the element overload uses `Nodes.NaryNode`.
 */
export interface SynchronousNaryTreeConstructor {
    new <E, N extends Nodes.NaryNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousNaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.NaryNode<E>>): SynchronousNaryTree<E>;
}

export const SynchronousNaryTree = createTreeConstructor("SynchronousNaryTree", false, "NaryTree") as unknown as SynchronousNaryTreeConstructor;

/**
 * Constructs an `AsynchronousNaryTree`; the source may be synchronous or
 * asynchronous.
 *
 * Arity validation and ordered layout match the synchronous constructor,
 * including the custom-node `buildNodes` overload. For an async source the
 * children are assigned only after the full element sequence is known.
 */
export interface AsynchronousNaryTreeConstructor {
    new <E, N extends Nodes.NaryNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousNaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.NaryNode<E>>): AsynchronousNaryTree<E>;
}

export const AsynchronousNaryTree = createTreeConstructor("AsynchronousNaryTree", true, "NaryTree") as unknown as AsynchronousNaryTreeConstructor;
