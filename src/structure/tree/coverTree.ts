import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

/**
 * Synchronous cover tree: a rooted metric tree whose nodes carry decreasing
 * integer levels and whose subtrees are covered by balls of radius 2^level.
 *
 * Construction takes its topology from `options.parentOf` and validates the
 * cover invariants: a child's level is strictly smaller than its parent's,
 * parent/child distance does not exceed 2^parentLevel, and any two nodes at the
 * same or lower level are separated by more than 2^minLevel. `getLevel()`
 * exposes the node level.
 *
 * @template E the element type stored as a cover-tree vertex
 */
export interface SynchronousCoverTree<E = unknown> extends SynchronousRootedTree<E, Nodes.CoverNode<E>> {}

/**
 * Asynchronous cover tree: the same covering, decreasing-level and separation
 * invariants as the synchronous cover tree, with promises on collection
 * queries.
 *
 * Levels and topology are fixed after construction; traversal stays
 * synchronous. An async source is collected and validated together, because
 * level separation is a pairwise property that cannot be checked incrementally.
 *
 * @template E the element type stored as a cover-tree vertex
 */
export interface AsynchronousCoverTree<E = unknown> extends AsynchronousRootedTree<E, Nodes.CoverNode<E>> {}

/**
 * Constructs a `SynchronousCoverTree` from elements plus metric topology
 * callbacks.
 *
 * `options.parentOf` defines the tree, `options.levelOf` supplies each node's
 * bigint level, and `options.distance` (or `options.pointOf` for Euclidean
 * distance) supplies distances. Violations of covering, decreasing levels or
 * separation throw rather than being repaired.
 */
export interface SynchronousCoverTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.CoverNode<E>>): SynchronousCoverTree<E>;
}

export const SynchronousCoverTree = createTreeConstructor("SynchronousCoverTree", false, "CoverTree") as unknown as SynchronousCoverTreeConstructor;

/**
 * Constructs an `AsynchronousCoverTree`; the source may be synchronous or
 * asynchronous.
 *
 * The same `parentOf`, `levelOf` and distance requirements apply, with
 * validation performed after the full element set exists. An async source is
 * therefore drained before any invariant is checked or any query resolves.
 */
export interface AsynchronousCoverTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.CoverNode<E>>): AsynchronousCoverTree<E>;
}

export const AsynchronousCoverTree = createTreeConstructor("AsynchronousCoverTree", true, "CoverTree") as unknown as AsynchronousCoverTreeConstructor;
