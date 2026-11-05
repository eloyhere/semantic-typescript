import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousForest, AsynchronousForest } from "#semantic/structure/tree/base";

/**
 * Synchronous Fenwick tree exposed as a forest of array-cell nodes rather than
 * one rooted tree.
 *
 * Each node is a one-based cell i covering `(i - lowbit(i), i]`; its update
 * parent is `i + lowbit(i)` when that index stays in range, so the roots are
 * the cells whose parent falls outside the array. `getAggregate()` combines the
 * covered slice through `options.aggregate` or `options.combine`, and
 * `getRoots()` returns the update-forest roots.
 *
 * @template A the aggregate type stored at each Fenwick cell
 */
export interface SynchronousFenwickTree<A = unknown> extends SynchronousForest<Nodes.FenwickNode<A>, A> {}

/**
 * Asynchronous Fenwick tree: the same one-based cell coverage and update-forest
 * navigation as the synchronous Fenwick tree, with `getRoots()` returning a
 * promise.
 *
 * Cell boundaries and aggregates are fixed once the array is built; traversal
 * stays synchronous over the update links. An async source is drained before
 * lowbit ranges are computed, so aggregate slices always cover final indices.
 *
 * @template A the aggregate type stored at each Fenwick cell
 */
export interface AsynchronousFenwickTree<A = unknown> extends AsynchronousForest<Nodes.FenwickNode<A>, A> {}

/**
 * Constructs a `SynchronousFenwickTree` from an optional synchronous source.
 *
 * For a nonempty tree, `options.aggregate` or `options.combine` (with optional
 * `options.valueOf`) must define how a covered slice is reduced. Cell indices
 * are one-based and derived from position; `options.buildNodes` may replace the
 * generated update forest.
 */
export interface SynchronousFenwickTreeConstructor {
    new <A = unknown>(source?: Iterable<A>, options?: TreeOptions<A, Nodes.FenwickNode<A>>): SynchronousFenwickTree<A>;
}

export const SynchronousFenwickTree = createTreeConstructor("SynchronousFenwickTree", false, "FenwickTree") as unknown as SynchronousFenwickTreeConstructor;

/**
 * Constructs an `AsynchronousFenwickTree`; the source may be synchronous or
 * asynchronous.
 *
 * The aggregate/combine requirement and one-based indexing match the
 * synchronous constructor. An async source is buffered before cell aggregates
 * are computed, since each aggregate depends on a range that may end at the
 * last element.
 */
export interface AsynchronousFenwickTreeConstructor {
    new <A = unknown>(source?: Iterable<A> | AsyncIterable<A>, options?: TreeOptions<A, Nodes.FenwickNode<A>>): AsynchronousFenwickTree<A>;
}

export const AsynchronousFenwickTree = createTreeConstructor("AsynchronousFenwickTree", true, "FenwickTree") as unknown as AsynchronousFenwickTreeConstructor;
