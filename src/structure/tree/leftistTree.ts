import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

/**
 * Synchronous leftist heap: a heap-ordered binary tree whose nodes store a
 * null-path length and whose node contract requires the left rank to be no
 * smaller than the right rank.
 *
 * Bulk construction sorts by the comparator and fills the implicit complete
 * binary layout, then computes every null-path length bottom-up: a missing
 * child is -1 and a leaf is 0. `getNullPathLength()` exposes the rank a leftist
 * merge compares, while heap order supplies the priority relation.
 *
 * @template E the element type ordered by the heap comparator
 */
export interface SynchronousLeftistTree<E = unknown> extends SynchronousBinaryTree<E, Nodes.LeftistNode<E>> {}

/**
 * Asynchronous leftist heap: the same null-path-length metadata and rank
 * requirement as the synchronous leftist tree, with promises on collection
 * queries.
 *
 * Ranks are computed during construction and are never recomputed by reads,
 * so the leftist shape is stable across traversals. An async source is sorted
 * and laid out before the bottom-up rank pass runs.
 *
 * @template E the element type ordered by the heap comparator
 */
export interface AsynchronousLeftistTree<E = unknown> extends AsynchronousBinaryTree<E, Nodes.LeftistNode<E>> {}

/**
 * Constructs a `SynchronousLeftistTree` from an optional synchronous source.
 *
 * Elements are comparator-sorted into an implicit complete binary layout, and
 * null-path lengths are derived from that shape. `options.buildNodes` may
 * replace the layout; a custom build must then provide ranks consistent with
 * the leftist node contract.
 */
export interface SynchronousLeftistTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.LeftistNode<E>>): SynchronousLeftistTree<E>;
}

export const SynchronousLeftistTree = createTreeConstructor("SynchronousLeftistTree", false, "LeftistTree") as unknown as SynchronousLeftistTreeConstructor;

/**
 * Constructs an `AsynchronousLeftistTree`; the source may be synchronous or
 * asynchronous.
 *
 * Sorting, implicit layout and bottom-up rank computation match the
 * synchronous constructor. An async source is drained first, so ranks are
 * assigned once to the final complete-tree shape.
 */
export interface AsynchronousLeftistTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.LeftistNode<E>>): AsynchronousLeftistTree<E>;
}

export const AsynchronousLeftistTree = createTreeConstructor("AsynchronousLeftistTree", true, "LeftistTree") as unknown as AsynchronousLeftistTreeConstructor;
