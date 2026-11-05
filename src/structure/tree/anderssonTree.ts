import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

/**
 * Synchronous AA tree: a binary search tree whose nodes store an integer level
 * standing in for black height, with horizontal links allowed only to the
 * right.
 *
 * Bulk construction replays AA insertion along the right spine: each new
 * sorted element is appended, then `skew` and `split` rotations restore the
 * right-leaning level invariant and promote levels. Duplicate elements keep
 * their stable input order, and `getLevel()` exposes the resulting AA level.
 *
 * @template E the element type ordered by the tree comparator
 */
export interface SynchronousAnderssonTree<E = unknown> extends SynchronousBinarySearchTree<E, Nodes.AANode<E>> {}

/**
 * Asynchronous AA tree: the same level-based node contract and skew/split
 * construction as the synchronous AA tree, with promise-returning collection
 * queries.
 *
 * The right-leaning level invariant is fixed at build time; navigation and the
 * traversals never mutate it. An async source is consumed into a snapshot
 * before queries resolve, so level metadata is complete when observed.
 *
 * @template E the element type ordered by the tree comparator
 */
export interface AsynchronousAnderssonTree<E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.AANode<E>> {}

/**
 * Constructs a `SynchronousAnderssonTree` from an optional synchronous source.
 *
 * Elements are sorted by `options.comparator` (duplicates stay stable) and
 * inserted one at a time through the AA skew/split procedure, including level
 * promotion. `options.buildNodes` bypasses that procedure and must supply
 * nodes whose `getLevel()` already encodes a valid AA shape.
 */
export interface SynchronousAnderssonTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.AANode<E>>): SynchronousAnderssonTree<E>;
}

export const SynchronousAnderssonTree = createTreeConstructor("SynchronousAnderssonTree", false, "AnderssonTree") as unknown as SynchronousAnderssonTreeConstructor;

/**
 * Constructs an `AsynchronousAnderssonTree`; the source may be synchronous or
 * asynchronous.
 *
 * The AA insertion procedure and comparator ordering match the synchronous
 * constructor, including optional `buildNodes`. An async source delays
 * observability, not construction semantics: queries resolve only after the
 * complete element list has been inserted.
 */
export interface AsynchronousAnderssonTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.AANode<E>>): AsynchronousAnderssonTree<E>;
}

export const AsynchronousAnderssonTree = createTreeConstructor("AsynchronousAnderssonTree", true, "AnderssonTree") as unknown as AsynchronousAnderssonTreeConstructor;
