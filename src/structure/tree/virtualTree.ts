import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

/**
 * Synchronous virtual tree: a compressed tree over selected original vertices
 * whose parent edges stand for whole paths in the underlying tree.
 *
 * `options.originalDepthOf` supplies each vertex's depth in the original tree
 * and must strictly decrease toward the root; `options.pathWeightOf` supplies
 * the path weight for non-root edges; `options.isKeyVertex` marks selected
 * vertices. A parent edge is therefore a path summary, not a single original
 * edge.
 *
 * @template V the vertex type stored in the virtual tree
 * @template W the weight type summarizing a compressed path
 */
export interface SynchronousVirtualTree<V = unknown, W = bigint> extends SynchronousRootedTree<V, Nodes.VirtualNode<V, W>> {}

/**
 * Asynchronous virtual tree: the same compressed-path parent contract as the
 * synchronous virtual tree, with promise-returning collection queries.
 *
 * Original depths and path weights are fixed after construction and are never
 * recomputed by traversal. An async source is drained before the depth check,
 * so parent depths are compared once against the final vertex set.
 *
 * @template V the vertex type stored in the virtual tree
 * @template W the weight type summarizing a compressed path
 */
export interface AsynchronousVirtualTree<V = unknown, W = bigint> extends AsynchronousRootedTree<V, Nodes.VirtualNode<V, W>> {}

/**
 * Constructs a `SynchronousVirtualTree` from original vertices plus virtual
 * topology callbacks.
 *
 * `originalDepthOf`, `pathWeightOf` and `isKeyVertex` are mandatory, together
 * with `parentOf` or `childrenOf`. Parent depth must be strictly smaller than
 * child depth, and non-root edges must provide a path weight.
 */
export interface SynchronousVirtualTreeConstructor {
    new <V = unknown, W = bigint>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.VirtualNode<V, W>>): SynchronousVirtualTree<V, W>;
}

export const SynchronousVirtualTree = createTreeConstructor("SynchronousVirtualTree", false, "VirtualTree") as unknown as SynchronousVirtualTreeConstructor;

/**
 * Constructs an `AsynchronousVirtualTree`; the source may be synchronous or
 * asynchronous.
 *
 * The depth, path-weight and key-vertex requirements match the synchronous
 * constructor. An async source is fully collected before validation, so the
 * strictly-decreasing-depth rule is checked on the final topology.
 */
export interface AsynchronousVirtualTreeConstructor {
    new <V = unknown, W = bigint>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.VirtualNode<V, W>>): AsynchronousVirtualTree<V, W>;
}

export const AsynchronousVirtualTree = createTreeConstructor("AsynchronousVirtualTree", true, "VirtualTree") as unknown as AsynchronousVirtualTreeConstructor;
