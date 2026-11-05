import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

/**
 * Synchronous k-dimensional tree: a binary space partition in which each level
 * splits on one coordinate axis, cycling through the fixed dimension count.
 *
 * Bulk construction sorts the current point set by the depth's axis, takes the
 * median as the node, and recurses on both halves. `getAxis()` records the
 * zero-based axis and `getSplit()` the median coordinate. Every point must have
 * the same positive dimension with finite coordinates.
 *
 * @template E the element type that carries a point
 */
export interface SynchronousKDimensionalTree<E = unknown> extends SynchronousBinaryTree<E, Nodes.KDNode<E>> {}

/**
 * Asynchronous k-dimensional tree: the same axis-cycling median partition as
 * the synchronous k-d tree, with promise-returning collection queries.
 *
 * The split axes and median coordinates are immutable once built; traversal
 * reads them synchronously. An async source is collected before sorting, since
 * the dimension count and every median depend on all points.
 *
 * @template E the element type that carries a point
 */
export interface AsynchronousKDimensionalTree<E = unknown> extends AsynchronousBinaryTree<E, Nodes.KDNode<E>> {}

/**
 * Constructs a `SynchronousKDimensionalTree` from points.
 *
 * `options.pointOf` is mandatory for a nonempty tree and must return a
 * nonempty, fixed-dimension coordinate array with finite entries. The axis
 * cycle and median split are derived from that dimensionality;
 * `options.buildNodes` may replace the partition.
 */
export interface SynchronousKDimensionalTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.KDNode<E>>): SynchronousKDimensionalTree<E>;
}

export const SynchronousKDimensionalTree = createTreeConstructor("SynchronousKDimensionalTree", false, "KDimensionalTree") as unknown as SynchronousKDimensionalTreeConstructor;

/**
 * Constructs an `AsynchronousKDimensionalTree`; the source may be synchronous
 * or asynchronous.
 *
 * `pointOf` and its finite, fixed-dimension validation are unchanged. An async
 * source is fully collected before the first median is chosen, so the axis
 * cycle cannot change midway through the build.
 */
export interface AsynchronousKDimensionalTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.KDNode<E>>): AsynchronousKDimensionalTree<E>;
}

export const AsynchronousKDimensionalTree = createTreeConstructor("AsynchronousKDimensionalTree", true, "KDimensionalTree") as unknown as AsynchronousKDimensionalTreeConstructor;
