import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedForest, AsynchronousRootedForest } from "#semantic/structure/forest/rootedForest";

// 67–72. Graph results preserve original vertex and weight types.
/**
 * Synchronous depth-first search result forest: nodes carry global discovery
 * and finish timestamps from a depth-first walk.
 *
 * The builder lays elements out structurally in input order with the
 * configured arity (2 by default), then stamps `getDiscoveredAt()` on entry and
 * `getFinishedAt()` on exit. A descendant's interval therefore nests inside
 * its ancestor's, and disconnected inputs remain separate roots.
 *
 * @template V the vertex type stored at each search node
 */
export interface SynchronousDepthFirstSearchTree<V = unknown> extends SynchronousRootedForest<V, Nodes.DFSNode<V>> {}

/**
 * Asynchronous depth-first search result forest: the same discovery/finish
 * timestamps as the synchronous DFS forest, with `getRoots()` returning a
 * promise.
 *
 * Timestamps are assigned once from the built forest and never recomputed by
 * queries. An async vertex source is materialised before the walk, so the
 * global clock covers the complete input rather than an initial prefix.
 *
 * @template V the vertex type stored at each search node
 */
export interface AsynchronousDepthFirstSearchTree<V = unknown> extends AsynchronousRootedForest<V, Nodes.DFSNode<V>> {}

/**
 * Constructs a `SynchronousDepthFirstSearchTree` from an optional synchronous
 * vertex sequence.
 *
 * `options.arity` controls the structural branching (default 2); timestamps
 * are derived from that layout, not from a graph adjacency structure.
 * `options.buildNodes` may supply a custom forest; its timestamp metadata is
 * not recomputed.
 */
export interface SynchronousDepthFirstSearchTreeConstructor {
    new <V = unknown>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.DFSNode<V>>): SynchronousDepthFirstSearchTree<V>;
}

export const SynchronousDepthFirstSearchTree = createTreeConstructor("SynchronousDepthFirstSearchTree", false, "DepthFirstSearchTree") as unknown as SynchronousDepthFirstSearchTreeConstructor;

/**
 * Constructs an `AsynchronousDepthFirstSearchTree`; the source may be
 * synchronous or asynchronous.
 *
 * Structural arity and timestamp assignment follow the synchronous
 * constructor. An async source is fully read before the depth-first clock
 * starts, so discovery order is not split across readiness boundaries.
 */
export interface AsynchronousDepthFirstSearchTreeConstructor {
    new <V = unknown>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.DFSNode<V>>): AsynchronousDepthFirstSearchTree<V>;
}

export const AsynchronousDepthFirstSearchTree = createTreeConstructor("AsynchronousDepthFirstSearchTree", true, "DepthFirstSearchTree") as unknown as AsynchronousDepthFirstSearchTreeConstructor;
