import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

/**
 * Synchronous ordered tree: a rooted tree whose child array order is
 * semantically significant.
 *
 * The bulk builder preserves input order and gives each parent up to the
 * configured arity (2 by default) children, so `getChildren()` is a sequence
 * rather than a set. The node contract adds the ordered marker to `TreeNode`
 * but no new methods; traversal visits children in their declared order.
 *
 * @template E the element type stored in the tree
 * @template N the ordered node contract used by navigation
 */
export interface SynchronousOrderedTree<E = unknown, N extends Nodes.OrderedTreeNode<E> = Nodes.OrderedTreeNode<E>> extends SynchronousRootedTree<E, N> {}

/**
 * Asynchronous ordered tree: the same ordered-child guarantee as the
 * synchronous ordered tree, with promise-returning collection queries.
 *
 * Child order is fixed by construction and traversal never reorders siblings.
 * An async source is materialised before children are attached, so the first
 * query already sees the final sibling sequence.
 *
 * @template E the element type stored in the tree
 * @template N the ordered node contract used by navigation
 */
export interface AsynchronousOrderedTree<E = unknown, N extends Nodes.OrderedTreeNode<E> = Nodes.OrderedTreeNode<E>> extends AsynchronousRootedTree<E, N> {}

/**
 * Constructs a `SynchronousOrderedTree` from an optional synchronous source.
 *
 * Elements keep their input order and are attached to parents with the
 * configured arity (default 2). The generic overload requires
 * `options.buildNodes` for a custom ordered node type; the element overload
 * uses `Nodes.OrderedTreeNode`.
 */
export interface SynchronousOrderedTreeConstructor {
    new <E, N extends Nodes.OrderedTreeNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousOrderedTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.OrderedTreeNode<E>>): SynchronousOrderedTree<E>;
}

export const SynchronousOrderedTree = createTreeConstructor("SynchronousOrderedTree", false, "OrderedTree") as unknown as SynchronousOrderedTreeConstructor;

/**
 * Constructs an `AsynchronousOrderedTree`; the source may be synchronous or
 * asynchronous.
 *
 * Ordered child attachment and the custom-node overload match the synchronous
 * constructor. An async source is read to completion before sibling order is
 * decided, so insertion timing cannot reorder children.
 */
export interface AsynchronousOrderedTreeConstructor {
    new <E, N extends Nodes.OrderedTreeNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousOrderedTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.OrderedTreeNode<E>>): AsynchronousOrderedTree<E>;
}

export const AsynchronousOrderedTree = createTreeConstructor("AsynchronousOrderedTree", true, "OrderedTree") as unknown as AsynchronousOrderedTreeConstructor;
