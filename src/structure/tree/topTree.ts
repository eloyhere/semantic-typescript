import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

/**
 * Synchronous top tree: a cluster decomposition of an underlying tree in which
 * every cluster has zero, one or two boundary vertices.
 *
 * Bulk construction copies the element list into a balanced binary cluster
 * tree; `options.boundariesOf` supplies each cluster's boundary set, capped at
 * two. Two sibling clusters must share exactly one boundary and together
 * contain their parent's boundaries, and `getAggregate()` reduces each cluster.
 *
 * @template V the vertex type appearing on cluster boundaries
 * @template A the aggregate type stored for a cluster
 */
export interface SynchronousTopTree<V = unknown, A = unknown> extends SynchronousTree<Nodes.TopTreeNode<V, A>, V> {}

/**
 * Asynchronous top tree: the same two-boundary cluster contract as the
 * synchronous top tree, with promise-returning collection queries.
 *
 * Boundary sets and aggregates are fixed after construction; navigation follows
 * subclusters rather than original graph edges. An async source is drained
 * before boundaries are validated, since the shared-boundary rule is a pairwise
 * property.
 *
 * @template V the vertex type appearing on cluster boundaries
 * @template A the aggregate type stored for a cluster
 */
export interface AsynchronousTopTree<V = unknown, A = unknown> extends AsynchronousTree<Nodes.TopTreeNode<V, A>, V> {}

/**
 * Constructs a `SynchronousTopTree` from the underlying tree's vertices.
 *
 * `options.boundariesOf` is mandatory for a nonempty tree and must return at
 * most two boundary vertices per cluster; `options.aggregate` or
 * `options.combine` defines the cluster aggregate. Sibling clusters that do not
 * share exactly one boundary are rejected.
 */
export interface SynchronousTopTreeConstructor {
    new <V = unknown, A = unknown>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.TopTreeNode<V, A>>): SynchronousTopTree<V, A>;
}

export const SynchronousTopTree = createTreeConstructor("SynchronousTopTree", false, "TopTree") as unknown as SynchronousTopTreeConstructor;

/**
 * Constructs an `AsynchronousTopTree`; the source may be synchronous or
 * asynchronous.
 *
 * The boundary and aggregate requirements match the synchronous constructor.
 * An async source is collected before clusters are formed, so boundary checks
 * compare the final sibling sets.
 */
export interface AsynchronousTopTreeConstructor {
    new <V = unknown, A = unknown>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.TopTreeNode<V, A>>): AsynchronousTopTree<V, A>;
}

export const AsynchronousTopTree = createTreeConstructor("AsynchronousTopTree", true, "TopTree") as unknown as AsynchronousTopTreeConstructor;
