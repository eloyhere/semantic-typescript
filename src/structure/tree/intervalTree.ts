import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

/**
 * Synchronous interval tree: an ordered binary tree over interval starts whose
 * nodes also cache the maximum end found anywhere in their subtree.
 *
 * Bulk construction sorts by `intervalOf(element).start`, splits at the
 * midpoint, and folds each subtree's largest end into `getMaximumEnd()`. That
 * augmented bound lets a query skip a whole subtree when no interval in it can
 * overlap; stored intervals must be nonempty and half-open.
 *
 * @template T the numeric endpoint type of a stored interval
 * @template E the element type that carries an interval
 */
export interface SynchronousIntervalTree<T = unknown, E = unknown> extends SynchronousBinarySearchTree<E, Nodes.IntervalNode<T, E>> {}

/**
 * Asynchronous interval tree: the same start ordering and subtree maximum-end
 * augmentation as the synchronous interval tree, with promises on collection
 * queries.
 *
 * Intervals and cached maxima are fixed after construction, so a query never
 * waits for a bound to be repaired. An async source is drained before the
 * midpoint split, because each maximum-end value covers a complete subtree.
 *
 * @template T the numeric endpoint type of a stored interval
 * @template E the element type that carries an interval
 */
export interface AsynchronousIntervalTree<T = unknown, E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.IntervalNode<T, E>> {}

/**
 * Constructs a `SynchronousIntervalTree` from elements that carry intervals.
 *
 * `options.intervalOf` is mandatory for a nonempty tree and must return a
 * finite, nonempty half-open interval with `start < end`. The generic overload
 * accepts a custom endpoint type and requires `options.buildNodes`; the element
 * overload uses `number` endpoints.
 */
export interface SynchronousIntervalTreeConstructor {
    new <T, E>(source: Iterable<E> | undefined, options: TreeOptions<E, Nodes.IntervalNode<T, E>> & { buildNodes: (elements: readonly E[]) => readonly Nodes.IntervalNode<T, E>[] }): SynchronousIntervalTree<T, E>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.IntervalNode<number, E>>): SynchronousIntervalTree<number, E>;
}

export const SynchronousIntervalTree = createTreeConstructor("SynchronousIntervalTree", false, "IntervalTree") as unknown as SynchronousIntervalTreeConstructor;

/**
 * Constructs an `AsynchronousIntervalTree`; the source may be synchronous or
 * asynchronous.
 *
 * The same `intervalOf` validation and custom-endpoint `buildNodes` overload
 * apply. An async element source is materialised before maxima are folded, so
 * no cached bound is computed from a partial interval set.
 */
export interface AsynchronousIntervalTreeConstructor {
    new <T, E>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, Nodes.IntervalNode<T, E>> & { buildNodes: (elements: readonly E[]) => readonly Nodes.IntervalNode<T, E>[] }): AsynchronousIntervalTree<T, E>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.IntervalNode<number, E>>): AsynchronousIntervalTree<number, E>;
}

export const AsynchronousIntervalTree = createTreeConstructor("AsynchronousIntervalTree", true, "IntervalTree") as unknown as AsynchronousIntervalTreeConstructor;
