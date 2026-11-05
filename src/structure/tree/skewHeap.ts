import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

/**
 * Synchronous skew heap: a heap-ordered binary tree that stores no rank or
 * balance metadata, because a meld swaps children instead of repairing ranks.
 *
 * Bulk construction sorts by the comparator and fills the implicit complete
 * binary layout, leaving every node without a null-path length. Heap order is
 * the only ordering invariant; `SkewHeapNode` deliberately adds no getter
 * beyond the binary node contract.
 *
 * @template E the element type ordered by the heap comparator
 */
export interface SynchronousSkewHeap<E = unknown> extends SynchronousBinaryTree<E, Nodes.SkewHeapNode<E>> {}

/**
 * Asynchronous skew heap: the same rank-free, heap-ordered contract as the
 * synchronous skew heap, with promise-returning collection queries.
 *
 * The complete binary layout is written once and no merge metadata is stored,
 * so reads cannot invalidate the shape. An async source is sorted and laid out
 * before the readiness gate opens.
 *
 * @template E the element type ordered by the heap comparator
 */
export interface AsynchronousSkewHeap<E = unknown> extends AsynchronousBinaryTree<E, Nodes.SkewHeapNode<E>> {}

/**
 * Constructs a `SynchronousSkewHeap` from an optional synchronous source.
 *
 * Elements are comparator-sorted into the implicit complete binary layout,
 * preserving duplicates and rejecting null/undefined elements.
 * `options.buildNodes` may supply a heap whose child-swapping melds have
 * already been applied.
 */
export interface SynchronousSkewHeapConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.SkewHeapNode<E>>): SynchronousSkewHeap<E>;
}

export const SynchronousSkewHeap = createTreeConstructor("SynchronousSkewHeap", false, "SkewHeap") as unknown as SynchronousSkewHeapConstructor;

/**
 * Constructs an `AsynchronousSkewHeap`; the source may be synchronous or
 * asynchronous.
 *
 * Comparator ordering and the rank-free layout match the synchronous
 * constructor. An async source is drained before elements are placed, so the
 * complete-tree shape reflects the final size.
 */
export interface AsynchronousSkewHeapConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.SkewHeapNode<E>>): AsynchronousSkewHeap<E>;
}

export const AsynchronousSkewHeap = createTreeConstructor("AsynchronousSkewHeap", true, "SkewHeap") as unknown as AsynchronousSkewHeapConstructor;
