import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

// 40–54. A logical Fenwick node denotes an array cell, not an allocated branch.
/**
 * Synchronous segment tree: a binary tree over array positions in which each
 * node covers a half-open range and stores that range's aggregate.
 *
 * Bulk construction recursively halves `[0, n)` until ranges have length one,
 * then computes each aggregate with `options.aggregate`, or by folding with
 * `options.combine` and optional `options.valueOf`. `getRange()` exposes the
 * covered positions, and nodes carry no pending update in this build.
 *
 * @template A the aggregate type stored at each segment
 * @template U the lazy-update tag type; the bulk build leaves it absent
 */
export interface SynchronousSegmentTree<A = unknown, U = never> extends SynchronousTree<Nodes.SegmentNode<A, U>, A> {}

/**
 * Asynchronous segment tree: the same half-open range/aggregate contract as the
 * synchronous segment tree, with promise-returning collection queries.
 *
 * Ranges and aggregates are fixed after construction; `getPendingUpdate()` is
 * empty because the bulk build performs no lazy propagation. An async source is
 * drained before the recursive halving starts.
 *
 * @template A the aggregate type stored at each segment
 * @template U the lazy-update tag type
 */
export interface AsynchronousSegmentTree<A = unknown, U = never> extends AsynchronousTree<Nodes.SegmentNode<A, U>, A> {}

/**
 * Constructs a `SynchronousSegmentTree` from an optional synchronous source.
 *
 * For a nonempty tree, `options.aggregate` or `options.combine` must define how
 * a range is reduced. Ranges are derived from position, not supplied by the
 * caller; `options.buildNodes` may replace the segment layout.
 */
export interface SynchronousSegmentTreeConstructor {
    new <A = unknown, U = never>(source?: Iterable<A>, options?: TreeOptions<A, Nodes.SegmentNode<A, U>>): SynchronousSegmentTree<A, U>;
}

export const SynchronousSegmentTree = createTreeConstructor("SynchronousSegmentTree", false, "SegmentTree") as unknown as SynchronousSegmentTreeConstructor;

/**
 * Constructs an `AsynchronousSegmentTree`; the source may be synchronous or
 * asynchronous.
 *
 * Aggregate/combine requirements and positional ranges match the synchronous
 * constructor. An async source is fully collected before any range aggregate is
 * computed, because the root range ends at the last element.
 */
export interface AsynchronousSegmentTreeConstructor {
    new <A = unknown, U = never>(source?: Iterable<A> | AsyncIterable<A>, options?: TreeOptions<A, Nodes.SegmentNode<A, U>>): AsynchronousSegmentTree<A, U>;
}

export const AsynchronousSegmentTree = createTreeConstructor("AsynchronousSegmentTree", true, "SegmentTree") as unknown as AsynchronousSegmentTreeConstructor;
