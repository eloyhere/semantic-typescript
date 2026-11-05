import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

/**
 * Synchronous shortest-path result tree: parent edges are the chosen shortest
 * path predecessors, and each non-root vertex records its total distance and
 * incoming edge weight.
 *
 * `options.distanceOf` and `options.incomingWeightOf` supply the recorded
 * values, while `options.parentOf` or `options.childrenOf` supplies the result
 * topology. The getters record the supplied result; they do not run a shortest
 * path algorithm or prove optimality.
 *
 * @template V the element type representing a graph vertex
 * @template W the distance and edge-weight type
 */
export interface SynchronousShortestPathTree<V = unknown, W = number> extends SynchronousRootedTree<V, Nodes.ShortestPathNode<V, W>> {}

/**
 * Asynchronous shortest-path result tree: the same distance/incoming-weight
 * annotations as the synchronous result tree, with promise-returning collection
 * queries.
 *
 * The predecessor topology and recorded distances are immutable after
 * construction. An async vertex source is drained before distances are read, so
 * no node reports a value computed from an incomplete vertex set.
 *
 * @template V the element type representing a graph vertex
 * @template W the distance and edge-weight type
 */
export interface AsynchronousShortestPathTree<V = unknown, W = number> extends AsynchronousRootedTree<V, Nodes.ShortestPathNode<V, W>> {}

/**
 * Constructs a `SynchronousShortestPathTree` from vertices plus a shortest-path
 * result topology.
 *
 * `parentOf` or `childrenOf` defines the predecessor tree;
 * `options.distanceOf` is required for every vertex and
 * `options.incomingWeightOf` for every non-root vertex. Root vertices have no
 * incoming weight.
 */
export interface SynchronousShortestPathTreeConstructor {
    new <V = unknown, W = number>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.ShortestPathNode<V, W>>): SynchronousShortestPathTree<V, W>;
}

export const SynchronousShortestPathTree = createTreeConstructor("SynchronousShortestPathTree", false, "ShortestPathTree") as unknown as SynchronousShortestPathTreeConstructor;

/**
 * Constructs an `AsynchronousShortestPathTree`; the source may be synchronous or
 * asynchronous.
 *
 * The distance and incoming-weight requirements match the synchronous
 * constructor. An async source is collected before validation, so every vertex
 * is known when the root/non-root split is applied.
 */
export interface AsynchronousShortestPathTreeConstructor {
    new <V = unknown, W = number>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.ShortestPathNode<V, W>>): AsynchronousShortestPathTree<V, W>;
}

export const AsynchronousShortestPathTree = createTreeConstructor("AsynchronousShortestPathTree", true, "ShortestPathTree") as unknown as AsynchronousShortestPathTreeConstructor;
