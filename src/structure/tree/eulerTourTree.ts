import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

/**
 * Synchronous Euler-tour tree: a balanced sequence tree over the occurrences
 * of vertices in an Euler tour, not over the represented graph's vertices.
 *
 * Bulk construction uses the midpoint layout over the occurrence sequence in
 * input order; each node exposes `getOccurrence()`, its subtree size and the
 * aggregate of its subtree. `options.aggregate` is required and is applied to
 * the in-order elements of every subtree, so a vertex may appear as several
 * occurrences.
 *
 * @template V the vertex type whose occurrences form the sequence
 * @template A the aggregate type produced for a subtree
 */
export interface SynchronousEulerTourTree<V = unknown, A = V> extends SynchronousBinaryTree<V, Nodes.EulerTourNode<V, A>> {}

/**
 * Asynchronous Euler-tour tree: the same occurrence-sequence and
 * subtree-aggregate contract as the synchronous Euler-tour tree, with
 * promise-returning collection queries.
 *
 * Occurrence order, subtree sizes and aggregates are fixed once built;
 * navigation follows the balanced sequence, not the graph. An async source is
 * drained before aggregates are computed, because each aggregate covers a
 * complete subtree.
 *
 * @template V the vertex type whose occurrences form the sequence
 * @template A the aggregate type produced for a subtree
 */
export interface AsynchronousEulerTourTree<V = unknown, A = V> extends AsynchronousBinaryTree<V, Nodes.EulerTourNode<V, A>> {}

/**
 * Constructs a `SynchronousEulerTourTree` from the occurrence sequence.
 *
 * `options.aggregate` is mandatory for a nonempty tree; the builder applies it
 * to each subtree's in-order elements, in sequence order. `options.buildNodes`
 * may replace the balanced sequence tree, in which case aggregate and
 * occurrence metadata must already be attached.
 */
export interface SynchronousEulerTourTreeConstructor {
    new <V = unknown, A = V>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.EulerTourNode<V, A>>): SynchronousEulerTourTree<V, A>;
}

export const SynchronousEulerTourTree = createTreeConstructor("SynchronousEulerTourTree", false, "EulerTourTree") as unknown as SynchronousEulerTourTreeConstructor;

/**
 * Constructs an `AsynchronousEulerTourTree`; the source may be synchronous or
 * an async iterable of occurrences.
 *
 * The mandatory `options.aggregate` and the per-subtree computation match the
 * synchronous constructor. For an async source the constructor returns
 * immediately, and the readiness gate delays queries until every occurrence
 * has been placed.
 */
export interface AsynchronousEulerTourTreeConstructor {
    new <V = unknown, A = V>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.EulerTourNode<V, A>>): AsynchronousEulerTourTree<V, A>;
}

export const AsynchronousEulerTourTree = createTreeConstructor("AsynchronousEulerTourTree", true, "EulerTourTree") as unknown as AsynchronousEulerTourTreeConstructor;
