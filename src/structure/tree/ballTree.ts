import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

/**
 * Synchronous ball tree over a metric space: every node owns a center and a
 * radius, and its two subtrees partition the remaining elements by distance to
 * that center.
 *
 * Bulk construction takes the first element as the pivot, sorts the rest by
 * distance, and splits at the median distance. `getThreshold()` is that median
 * and `getRadius()` the farthest distance, so every descendant lies inside the
 * node's ball. Centers come from `options.pointOf`.
 *
 * @template E the element type stored at each ball
 * @template P the coordinate representation returned by `getCenter()`
 */
export interface SynchronousBallTree<E = unknown, P = ReadonlyArray<number>> extends SynchronousBinaryTree<E, Nodes.BallNode<E, P>> {}

/**
 * Asynchronous ball tree: the same center/threshold/radius node contract as the
 * synchronous metric ball tree, with promises on collection queries.
 *
 * Ball structure is static after construction and traversal stays synchronous.
 * Child order depends on distances, so the tree is built only once the whole
 * source is available, which the readiness gate guarantees for an async
 * iterable.
 *
 * @template E the element type stored at each ball
 * @template P the coordinate representation returned by `getCenter()`
 */
export interface AsynchronousBallTree<E = unknown, P = ReadonlyArray<number>> extends AsynchronousBinaryTree<E, Nodes.BallNode<E, P>> {}

/**
 * Constructs a `SynchronousBallTree` from elements that carry coordinates.
 *
 * `options.pointOf` is mandatory for a nonempty tree: it supplies both the
 * center coordinates and, unless `options.distance` is supplied, the Euclidean
 * distance used for the median split. `options.buildNodes` may replace the
 * metric layout entirely.
 */
export interface SynchronousBallTreeConstructor {
    new <E, P>(source: Iterable<E> | undefined, options: TreeOptions<E, Nodes.BallNode<E, P>> & { buildNodes: (elements: readonly E[]) => readonly Nodes.BallNode<E, P>[] }): SynchronousBallTree<E, P>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.BallNode<E, ReadonlyArray<number>>>): SynchronousBallTree<E, ReadonlyArray<number>>;
}

export const SynchronousBallTree = createTreeConstructor("SynchronousBallTree", false, "BallTree") as unknown as SynchronousBallTreeConstructor;

/**
 * Constructs an `AsynchronousBallTree`; the source may be synchronous or
 * asynchronous.
 *
 * `options.pointOf` is still required for nonempty construction, with
 * `options.distance` optionally overriding the Euclidean metric. Because the
 * split depends on all pairwise distances from the pivot, an async source is
 * fully drained before any query sees the ball structure.
 */
export interface AsynchronousBallTreeConstructor {
    new <E, P>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, Nodes.BallNode<E, P>> & { buildNodes: (elements: readonly E[]) => readonly Nodes.BallNode<E, P>[] }): AsynchronousBallTree<E, P>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.BallNode<E, ReadonlyArray<number>>>): AsynchronousBallTree<E, ReadonlyArray<number>>;
}

export const AsynchronousBallTree = createTreeConstructor("AsynchronousBallTree", true, "BallTree") as unknown as AsynchronousBallTreeConstructor;
