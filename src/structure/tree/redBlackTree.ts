import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

/**
 * Synchronous red-black tree: a binary search tree with a black root, no
 * red/red edge, and equal black height on every root-to-null path.
 *
 * Bulk construction sorts by the comparator and lays elements out as a
 * height-balanced midpoint tree, then assigns red only at one computed depth
 * and black everywhere else. That colouring fixes the black height of every
 * root-to-null path, prevents adjacent red nodes, and keeps the height within
 * twice that black height; duplicates keep stable input order.
 *
 * @template E the element type ordered by the tree comparator
 */
export interface SynchronousRedBlackTree<E = unknown> extends SynchronousBinarySearchTree<E, Nodes.RedBlackNode<E>> {}

/**
 * Asynchronous red-black tree: the same colour/black-height node contract and
 * midpoint construction as the synchronous red-black tree, with promise-based
 * collection queries.
 *
 * Colours are settled during construction and are not changed by traversal or
 * reads. An async source is drained before the colouring pass, so no node is
 * painted while the element order is still arriving.
 *
 * @template E the element type ordered by the tree comparator
 */
export interface AsynchronousRedBlackTree<E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.RedBlackNode<E>> {}

/**
 * Constructs a `SynchronousRedBlackTree` from an optional synchronous source.
 *
 * Elements are sorted with `options.comparator` (duplicates stable), built into
 * a midpoint tree, and coloured red-black by depth. `options.buildNodes` may
 * replace the layout, in which case the colour invariants become the caller's
 * responsibility.
 */
export interface SynchronousRedBlackTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.RedBlackNode<E>>): SynchronousRedBlackTree<E>;
}

export const SynchronousRedBlackTree = createTreeConstructor("SynchronousRedBlackTree", false, "RedBlackTree") as unknown as SynchronousRedBlackTreeConstructor;

/**
 * Constructs an `AsynchronousRedBlackTree`; the source may be synchronous or
 * asynchronous.
 *
 * Sorting and the depth-based colouring match the synchronous constructor.
 * With an async source the tree is not observable until the colouring pass is
 * complete, so queries never see an intermediate colour assignment.
 */
export interface AsynchronousRedBlackTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.RedBlackNode<E>>): AsynchronousRedBlackTree<E>;
}

export const AsynchronousRedBlackTree = createTreeConstructor("AsynchronousRedBlackTree", true, "RedBlackTree") as unknown as AsynchronousRedBlackTreeConstructor;
