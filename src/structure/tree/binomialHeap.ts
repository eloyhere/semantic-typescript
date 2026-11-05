import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedForest, AsynchronousRootedForest } from "#semantic/structure/forest/rootedForest";

/**
 * Synchronous binomial heap: a forest of heap-ordered binomial trees in which
 * a rank-r root has exactly 2^r descendants.
 *
 * Bulk construction merges singleton trees by rank, linking equal ranks so the
 * smaller element becomes the parent, then exposes the remaining roots in rank
 * order with `getNextSibling()` links. `getRank()` counts children, and the
 * number of roots equals the number of set bits in the element count.
 *
 * @template E the element type ordered by the heap comparator
 */
export interface SynchronousBinomialHeap<E = unknown> extends SynchronousRootedForest<E, Nodes.BinomialNode<E>> {}

/**
 * Asynchronous binomial heap: the same rank-based forest contract as the
 * synchronous binomial heap, with `getRoots()` and collection queries
 * returning promises.
 *
 * Rank links and sibling chains are built once and never change during
 * traversal. An async source is fully merged before the readiness gate opens,
 * so root ranks and sibling order are stable when first observed.
 *
 * @template E the element type ordered by the heap comparator
 */
export interface AsynchronousBinomialHeap<E = unknown> extends AsynchronousRootedForest<E, Nodes.BinomialNode<E>> {}

/**
 * Constructs a `SynchronousBinomialHeap` from an optional synchronous source.
 *
 * The builder creates one singleton per element and repeatedly links equal
 * ranks, comparing with `options.comparator`; the surviving roots form the
 * forest returned by `getRoots()`. `options.buildNodes` may replace this
 * carry-style merge.
 */
export interface SynchronousBinomialHeapConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.BinomialNode<E>>): SynchronousBinomialHeap<E>;
}

export const SynchronousBinomialHeap = createTreeConstructor("SynchronousBinomialHeap", false, "BinomialHeap") as unknown as SynchronousBinomialHeapConstructor;

/**
 * Constructs an `AsynchronousBinomialHeap`; the source may be synchronous or
 * asynchronous.
 *
 * The same equal-rank linking and comparator ordering apply. With an async
 * source the merge happens after the iterable completes, and queries wait on
 * readiness rather than observing a partially merged rank set.
 */
export interface AsynchronousBinomialHeapConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.BinomialNode<E>>): AsynchronousBinomialHeap<E>;
}

export const AsynchronousBinomialHeap = createTreeConstructor("AsynchronousBinomialHeap", true, "BinomialHeap") as unknown as AsynchronousBinomialHeapConstructor;
