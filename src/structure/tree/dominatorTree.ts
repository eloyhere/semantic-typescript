import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

/**
 * Synchronous dominator tree: a result tree in which a node's parent is its
 * immediate dominator in the original graph, which need not be a graph edge.
 *
 * The tree is built entirely from the caller's topology (`options.parentOf` or
 * `options.childrenOf`); computing dominators is a graph algorithm outside
 * this structural family. The node contract adds no dominator-specific getter,
 * so the dominator relation is exactly the parent relation, with one root for
 * a nonempty tree.
 *
 * @template V the element type representing a graph vertex
 */
export interface SynchronousDominatorTree<V = unknown> extends SynchronousRootedTree<V, Nodes.DominatorNode<V>> {}

/**
 * Asynchronous dominator tree: the same parent-as-immediate-dominator contract
 * as the synchronous dominator tree, with promise-returning collection
 * queries.
 *
 * The topology is supplied by callbacks and is immutable after construction;
 * queries only read it. An async element source is drained before the
 * one-root and acyclicity checks run, so a late parent edge cannot change an
 * already-returned tree.
 *
 * @template V the element type representing a graph vertex
 */
export interface AsynchronousDominatorTree<V = unknown> extends AsynchronousRootedTree<V, Nodes.DominatorNode<V>> {}

/**
 * Constructs a `SynchronousDominatorTree` from vertices plus a dominator
 * topology.
 *
 * `options.parentOf` or `options.childrenOf` is mandatory; elements must be
 * unique, every node may have only one parent, the graph must be acyclic, and
 * a nonempty topology must have a single root. `options.buildNodes` may supply
 * the result directly.
 */
export interface SynchronousDominatorTreeConstructor {
    new <V = unknown>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.DominatorNode<V>>): SynchronousDominatorTree<V>;
}

export const SynchronousDominatorTree = createTreeConstructor("SynchronousDominatorTree", false, "DominatorTree") as unknown as SynchronousDominatorTreeConstructor;

/**
 * Constructs an `AsynchronousDominatorTree`; the source may be synchronous or
 * asynchronous.
 *
 * The topology and single-root requirements are shared with the synchronous
 * constructor. An async source is collected before validation, since the root
 * count and acyclicity cannot be decided from an incomplete vertex set.
 */
export interface AsynchronousDominatorTreeConstructor {
    new <V = unknown>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.DominatorNode<V>>): AsynchronousDominatorTree<V>;
}

export const AsynchronousDominatorTree = createTreeConstructor("AsynchronousDominatorTree", true, "DominatorTree") as unknown as AsynchronousDominatorTreeConstructor;
