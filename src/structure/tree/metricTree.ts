import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

/**
 * Synchronous M-tree: a page-based metric index whose leaves hold objects and
 * whose branches hold routing objects with a covering radius.
 *
 * Bulk construction makes a leaf when a group has at most `order` elements
 * (default 4); otherwise it groups the elements and recurses, recording each
 * child's center, radius and distance to the parent center. Every entry keeps
 * its `parentDistance`, which lets a search prune by the triangle inequality.
 *
 * @template E the element type stored in the metric index
 */
export interface SynchronousMetricTree<E = unknown> extends SynchronousTree<Nodes.MTreeNode<E>, E> {}

/**
 * Asynchronous M-tree: the same leaf-capacity and routing-entry contract as the
 * synchronous M-tree, with promise-returning collection queries.
 *
 * Centers, radii and parent distances are fixed once the pages are built, and
 * navigation follows branch entries only. An async source is collected before
 * grouping, so every page covers a complete subset of the final elements.
 *
 * @template E the element type stored in the metric index
 */
export interface AsynchronousMetricTree<E = unknown> extends AsynchronousTree<Nodes.MTreeNode<E>, E> {}

/**
 * Constructs a `SynchronousMetricTree` from elements in a metric space.
 *
 * `options.distance` is required unless `options.pointOf` can derive a
 * Euclidean distance. `options.order` sets the leaf capacity (default 4 and at
 * least 3), and `options.buildNodes` may replace the page tree with a custom
 * routing structure.
 */
export interface SynchronousMetricTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.MTreeNode<E>>): SynchronousMetricTree<E>;
}

export const SynchronousMetricTree = createTreeConstructor("SynchronousMetricTree", false, "MetricTree") as unknown as SynchronousMetricTreeConstructor;

/**
 * Constructs an `AsynchronousMetricTree`; the source may be synchronous or
 * asynchronous.
 *
 * Distance derivation, leaf capacity and routing-entry creation match the
 * synchronous constructor. An async source is drained before any page is
 * grouped, so a routing radius is never computed from a partial group.
 */
export interface AsynchronousMetricTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.MTreeNode<E>>): AsynchronousMetricTree<E>;
}

export const AsynchronousMetricTree = createTreeConstructor("AsynchronousMetricTree", true, "MetricTree") as unknown as AsynchronousMetricTreeConstructor;
