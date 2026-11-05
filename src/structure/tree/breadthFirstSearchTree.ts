import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedForest, AsynchronousRootedForest } from "#semantic/structure/forest/rootedForest";

/**
 * Synchronous breadth-first search result forest: nodes record their
 * unweighted depth from the component root, the value a BFS would assign.
 *
 * Composition is structural rather than algorithmic: the builder lays elements
 * out in input order with the configured arity (2 by default), then derives
 * depth from that layout. Disconnected inputs remain separate roots in
 * `getRoots()`, and no comparator or priority is consulted.
 *
 * @template V the vertex type stored at each search node
 */
export interface SynchronousBreadthFirstSearchTree<V = unknown> extends SynchronousRootedForest<V, Nodes.BFSNode<V>> {}

/**
 * Asynchronous breadth-first search result forest: the same depth-annotated
 * node contract as the synchronous BFS forest, with `getRoots()` returning a
 * promise.
 *
 * The parent/children layout and its depths are fixed once built; the four
 * traversals stay synchronous. For an async source the forest becomes
 * observable only after the whole vertex sequence is available, so depth
 * values are never recalculated mid-stream.
 *
 * @template V the vertex type stored at each search node
 */
export interface AsynchronousBreadthFirstSearchTree<V = unknown> extends AsynchronousRootedForest<V, Nodes.BFSNode<V>> {}

/**
 * Constructs a `SynchronousBreadthFirstSearchTree` from an optional
 * synchronous vertex sequence.
 *
 * `options.arity` controls the branching of the structural layout (default 2),
 * and every element receives exactly one parent except the component roots.
 * `options.buildNodes` may supply a custom forest when callers need a specific
 * search topology.
 */
export interface SynchronousBreadthFirstSearchTreeConstructor {
    new <V = unknown>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.BFSNode<V>>): SynchronousBreadthFirstSearchTree<V>;
}

export const SynchronousBreadthFirstSearchTree = createTreeConstructor("SynchronousBreadthFirstSearchTree", false, "BreadthFirstSearchTree") as unknown as SynchronousBreadthFirstSearchTreeConstructor;

/**
 * Constructs an `AsynchronousBreadthFirstSearchTree`; the source may be
 * synchronous or async.
 *
 * Vertex layout and `options.arity` behave as in the synchronous constructor,
 * and `options.buildNodes` still overrides the layout. An async source is
 * collected before the forest is built, so component roots are known before
 * the first query resolves.
 */
export interface AsynchronousBreadthFirstSearchTreeConstructor {
    new <V = unknown>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.BFSNode<V>>): AsynchronousBreadthFirstSearchTree<V>;
}

export const AsynchronousBreadthFirstSearchTree = createTreeConstructor("AsynchronousBreadthFirstSearchTree", true, "BreadthFirstSearchTree") as unknown as AsynchronousBreadthFirstSearchTreeConstructor;
