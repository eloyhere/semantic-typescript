import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousCompleteBinaryTree, AsynchronousCompleteBinaryTree } from "#semantic/structure/tree/completeBinaryTree";

// 26–34. A binomial/Fibonacci heap may contain a forest of heap-ordered roots.
/**
 * Synchronous binary min-heap: a complete binary tree stored implicitly, with
 * array position 0 as the root and children at 2i+1 and 2i+2.
 *
 * The bulk builder sorts by the comparator and fills the implicit array level
 * by level, so the heap-order property holds for every parent/child pair and
 * the last level fills from left to right. `getIndex()` exposes the implicit
 * zero-based position; no search order is implied.
 *
 * @template E the element type ordered by the heap comparator
 */
export interface SynchronousBinaryHeap<E = unknown> extends SynchronousCompleteBinaryTree<E, Nodes.BinaryHeapNode<E>> {}

/**
 * Asynchronous binary min-heap: the same implicit complete-tree layout and
 * heap-order property as the synchronous binary heap, exposed through
 * promise-returning collection queries.
 *
 * Navigation and traversal remain synchronous over the built node view. An
 * async element source is sorted and laid out before the readiness gate opens,
 * so index metadata never reflects a partially built array.
 *
 * @template E the element type ordered by the heap comparator
 */
export interface AsynchronousBinaryHeap<E = unknown> extends AsynchronousCompleteBinaryTree<E, Nodes.BinaryHeapNode<E>> {}

/**
 * Constructs a `SynchronousBinaryHeap` from an optional synchronous source.
 *
 * Elements are sorted with `options.comparator` and written into the implicit
 * complete-tree array, preserving duplicates as separate occurrences.
 * `options.buildNodes` may replace that layout; null and undefined elements are
 * rejected.
 */
export interface SynchronousBinaryHeapConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.BinaryHeapNode<E>>): SynchronousBinaryHeap<E>;
}

export const SynchronousBinaryHeap = createTreeConstructor("SynchronousBinaryHeap", false, "BinaryHeap") as unknown as SynchronousBinaryHeapConstructor;

/**
 * Constructs an `AsynchronousBinaryHeap`; the source may be synchronous or an
 * `AsyncIterable`.
 *
 * The same comparator-driven sort and implicit array layout apply. The
 * constructor returns before an async source finishes; heap queries resolve
 * only after the complete array has been built, so `getIndex()` values are
 * stable by the time they are observed.
 */
export interface AsynchronousBinaryHeapConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.BinaryHeapNode<E>>): AsynchronousBinaryHeap<E>;
}

export const AsynchronousBinaryHeap = createTreeConstructor("AsynchronousBinaryHeap", true, "BinaryHeap") as unknown as AsynchronousBinaryHeapConstructor;
