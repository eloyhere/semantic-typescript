import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedForest, AsynchronousRootedForest } from "#semantic/structure/forest/rootedForest";

/**
 * Synchronous minimum spanning result forest: parent edges are the oriented
 * spanning-tree edges, and each non-root node records its incoming weight.
 *
 * `options.incomingWeightOf` is mandatory for every non-root vertex, while
 * `options.parentOf` or `options.childrenOf` supplies the result topology. A
 * disconnected graph yields several roots in `getRoots()`. The getters record
 * the supplied result; they do not by themselves prove minimality.
 *
 * @template V the element type representing a graph vertex
 * @template W the edge weight type
 */
export interface SynchronousMinimumSpanningTree<V = unknown, W = number> extends SynchronousRootedForest<V, Nodes.MinimumSpanningNode<V, W>> {}

/**
 * Asynchronous minimum spanning result forest: the same oriented-spanning-edge
 * contract as the synchronous result forest, with `getRoots()` returning a
 * promise.
 *
 * Incoming weights are metadata on the parent edge and are never recomputed by
 * traversal. An async vertex source is drained before the topology and weights
 * are validated, so a component root is never mistaken for an unprocessed
 * non-root.
 *
 * @template V the element type representing a graph vertex
 * @template W the edge weight type
 */
export interface AsynchronousMinimumSpanningTree<V = unknown, W = number> extends AsynchronousRootedForest<V, Nodes.MinimumSpanningNode<V, W>> {}

/**
 * Constructs a `SynchronousMinimumSpanningTree` from vertices plus a spanning
 * result topology.
 *
 * `parentOf` or `childrenOf` must describe the forest, and
 * `options.incomingWeightOf` must return a value for each non-root vertex.
 * Elements must be unique and the topology acyclic; `options.buildNodes` may
 * replace the built forest.
 */
export interface SynchronousMinimumSpanningTreeConstructor {
    new <V = unknown, W = number>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.MinimumSpanningNode<V, W>>): SynchronousMinimumSpanningTree<V, W>;
}

export const SynchronousMinimumSpanningTree = createTreeConstructor("SynchronousMinimumSpanningTree", false, "MinimumSpanningTree") as unknown as SynchronousMinimumSpanningTreeConstructor;

/**
 * Constructs an `AsynchronousMinimumSpanningTree`; the source may be
 * synchronous or asynchronous.
 *
 * The topology and non-root incoming-weight requirements match the synchronous
 * constructor. An async source is fully read before validation, so disconnected
 * components and their roots are known from the complete vertex set.
 */
export interface AsynchronousMinimumSpanningTreeConstructor {
    new <V = unknown, W = number>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.MinimumSpanningNode<V, W>>): AsynchronousMinimumSpanningTree<V, W>;
}

export const AsynchronousMinimumSpanningTree = createTreeConstructor("AsynchronousMinimumSpanningTree", true, "MinimumSpanningTree") as unknown as AsynchronousMinimumSpanningTreeConstructor;
