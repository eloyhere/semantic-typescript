import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

/**
 * Synchronous octree: a three-dimensional region tree whose nodes own an
 * axis-aligned box and split it into eight octants.
 *
 * Bulk construction takes the union of all points as the root region, splits at
 * the region midpoint, and routes each point by coordinate bit tests (octant
 * bit 0 = x-high, bit 1 = y-high, bit 2 = z-high). Coincident points cannot be
 * separated and are rejected unless `buildNodes` supplies a bucket policy.
 *
 * @template E the element type that carries a three-dimensional point
 */
export interface SynchronousOctree<E = unknown> extends SynchronousTree<Nodes.OctNode<E>, E> {}

/**
 * Asynchronous octree: the same midpoint-subdivision and octant-routing
 * contract as the synchronous octree, with promise-returning collection
 * queries.
 *
 * Region boxes and octant occupancy are fixed after construction; traversal
 * follows occupied slots only. An async source is drained before the root
 * region is computed, because every subdivision depends on the point bounds.
 *
 * @template E the element type that carries a three-dimensional point
 */
export interface AsynchronousOctree<E = unknown> extends AsynchronousTree<Nodes.OctNode<E>, E> {}

/**
 * Constructs a `SynchronousOctree` from three-dimensional points.
 *
 * `options.pointOf` is mandatory for a nonempty tree and must return exactly
 * three finite coordinates per element. Splitting at region midpoints follows
 * from those bounds; `options.buildNodes` may supply a bucketed topology for
 * coincident or precision-sensitive points.
 */
export interface SynchronousOctreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.OctNode<E>>): SynchronousOctree<E>;
}

export const SynchronousOctree = createTreeConstructor("SynchronousOctree", false, "Octree") as unknown as SynchronousOctreeConstructor;

/**
 * Constructs an `AsynchronousOctree`; the source may be synchronous or
 * asynchronous.
 *
 * `pointOf` and the exact three-coordinate requirement are unchanged. An async
 * source is collected before the root region is formed, so the subdivision
 * never starts from a partial bound.
 */
export interface AsynchronousOctreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.OctNode<E>>): AsynchronousOctree<E>;
}

export const AsynchronousOctree = createTreeConstructor("AsynchronousOctree", true, "Octree") as unknown as AsynchronousOctreeConstructor;
