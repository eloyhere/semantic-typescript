import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

/**
 * Synchronous quadtree: a two-dimensional region tree whose nodes own an
 * axis-aligned box and split it into four quadrants.
 *
 * Bulk construction takes the union of all points as the root box, splits at
 * the midpoint, and routes points into quadrants (bit 0 = x-high, bit 1 =
 * y-high, giving SW, SE, NW, NE slot order). Coincident points need a bucket
 * policy and are rejected without `buildNodes`; absent quadrants remain empty
 * optionals.
 *
 * @template E the element type that carries a two-dimensional point
 */
export interface SynchronousQuadtree<E = unknown> extends SynchronousTree<Nodes.QuadNode<E>, E> {}

/**
 * Asynchronous quadtree: the same midpoint subdivision and SW/SE/NW/NE slot
 * order as the synchronous quadtree, with promise-returning collection
 * queries.
 *
 * Region bounds and quadrant occupancy are fixed after construction, and
 * traversal skips empty slots. An async source is drained before the root box
 * is computed, because every subdivision depends on the full point extent.
 *
 * @template E the element type that carries a two-dimensional point
 */
export interface AsynchronousQuadtree<E = unknown> extends AsynchronousTree<Nodes.QuadNode<E>, E> {}

/**
 * Constructs a `SynchronousQuadtree` from two-dimensional points.
 *
 * `options.pointOf` is mandatory for a nonempty tree and must return exactly
 * two finite coordinates per element. The root box is their union; coincident
 * or precision-sensitive points require `options.buildNodes` with an explicit
 * bucket policy.
 */
export interface SynchronousQuadtreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.QuadNode<E>>): SynchronousQuadtree<E>;
}

export const SynchronousQuadtree = createTreeConstructor("SynchronousQuadtree", false, "Quadtree") as unknown as SynchronousQuadtreeConstructor;

/**
 * Constructs an `AsynchronousQuadtree`; the source may be synchronous or
 * asynchronous.
 *
 * The two-coordinate requirement and bucket limitation match the synchronous
 * constructor. An async source is collected before the root box is formed, so
 * no point falls outside the region chosen at the start.
 */
export interface AsynchronousQuadtreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.QuadNode<E>>): AsynchronousQuadtree<E>;
}

export const AsynchronousQuadtree = createTreeConstructor("AsynchronousQuadtree", true, "Quadtree") as unknown as AsynchronousQuadtreeConstructor;
