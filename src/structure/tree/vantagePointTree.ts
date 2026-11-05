import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

/**
 * Synchronous vantage-point tree: a binary metric index that partitions
 * elements by their distance to a chosen vantage point.
 *
 * Bulk construction takes the first element as the vantage point, sorts the
 * rest by distance, and splits at the median distance; `getThreshold()` is that
 * median. Center and radius getters are backed by `options.pointOf` when it is
 * supplied, while distances come from `options.distance` or that geometry.
 *
 * @template E the element type stored in the metric index
 */
export interface SynchronousVantagePointTree<E = unknown> extends SynchronousBinaryTree<E, Nodes.VPNode<E>> {}

/**
 * Asynchronous vantage-point tree: the same median-distance partition and
 * threshold metadata as the synchronous vantage-point tree, with
 * promise-returning collection queries.
 *
 * Vantage points and thresholds are fixed after construction, so traversal is
 * read-only. An async source is drained before distances are compared, since
 * the median threshold depends on the complete distance distribution.
 *
 * @template E the element type stored in the metric index
 */
export interface AsynchronousVantagePointTree<E = unknown> extends AsynchronousBinaryTree<E, Nodes.VPNode<E>> {}

/**
 * Constructs a `SynchronousVantagePointTree` from elements in a metric space.
 *
 * `options.distance` or `options.pointOf` is mandatory for a nonempty tree;
 * without `distance`, Euclidean distance is derived from the points. An
 * optional `pointOf` also supplies center coordinates, and `options.buildNodes`
 * may replace the partition.
 */
export interface SynchronousVantagePointTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.VPNode<E>>): SynchronousVantagePointTree<E>;
}

export const SynchronousVantagePointTree = createTreeConstructor("SynchronousVantagePointTree", false, "VantagePointTree") as unknown as SynchronousVantagePointTreeConstructor;

/**
 * Constructs an `AsynchronousVantagePointTree`; the source may be synchronous
 * or asynchronous.
 *
 * Distance derivation and the optional center geometry match the synchronous
 * constructor. An async source is collected before the median split, because a
 * vantage point chosen early would otherwise be compared against a partial set.
 */
export interface AsynchronousVantagePointTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.VPNode<E>>): AsynchronousVantagePointTree<E>;
}

export const AsynchronousVantagePointTree = createTreeConstructor("AsynchronousVantagePointTree", true, "VantagePointTree") as unknown as AsynchronousVantagePointTreeConstructor;
