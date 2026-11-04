import type { Optional } from "#semantic/optional";
import type { Navigable, Navigation } from "#semantic/structure/navigation";
import type { SynchronousCollection, AsynchronousCollection } from "#semantic/structure/collection";
import type * as Nodes from "#semantic/structure/node";
import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";

/** Shared generator contract retained for existing tree traversal consumers. */
export interface TreeTraversal<N> extends Navigation<N> {}

/** Element type inferred from a known node contract; custom nodes may specify E explicitly. */
export type TreeElement<N> =
    N extends Nodes.ElementNode<infer E> ? E :
    N extends Nodes.BPlusNode<infer K, infer V> ? Nodes.TreeEntry<K, V> :
    N extends Nodes.SearchPage<infer K, unknown> ? K :
    N extends Nodes.SegmentNode<infer A, infer _U> ? A :
    N extends Nodes.FenwickNode<infer A> ? A :
    N extends Nodes.TournamentParticipant<infer E> ? E :
    N extends Nodes.WinnerNode<infer E> ? E :
    N extends Nodes.LoserNode<infer E> ? E :
    N extends Nodes.RTreeNode<infer E> ? E :
    N extends Nodes.BVHNode<infer E, infer _B> ? E :
    N extends Nodes.MTreeNode<infer E> ? E :
    N extends Nodes.DecisionNode<infer E, infer _T, infer _L> ? E :
    N extends Nodes.TopTreeNode<infer V, infer _A> ? V :
    unknown;

/**
 * A single-root collection of elements E with structural navigation over nodes N.
 * Ordinary iteration and collection methods use elements; the four traversals use nodes.
 * Size counts collection elements, including keys/records held together in a page.
 * Empty trees have an empty root and empty traversal. Child order and cross-link
 * exclusions follow the node contract. Implementations maintain family invariants.
 */
export interface SynchronousTree<N extends Navigable<unknown> = Navigable<unknown>, E = TreeElement<N>>
    extends SynchronousCollection<E>, TreeTraversal<N> {
    root(): Optional<N>;
}

/** Traversal and element iteration remain synchronous; collection queries return promises. */
export interface AsynchronousTree<N extends Navigable<unknown> = Navigable<unknown>, E = TreeElement<N>>
    extends AsynchronousCollection<E>, TreeTraversal<N> {
    root(): Promise<Optional<N>>;
}

/**
 * A collection of elements in disjoint structural roots, without a synthetic parent.
 * Depth-first orders finish each root in root-array order; breadth-first starts
 * with all roots. Collection size counts elements across all components.
 */
export interface SynchronousForest<N extends Navigable<unknown> = Navigable<unknown>, E = TreeElement<N>>
    extends SynchronousCollection<E>, TreeTraversal<N> {
    getRoots(): ReadonlyArray<N>;
}

export interface AsynchronousForest<N extends Navigable<unknown> = Navigable<unknown>, E = TreeElement<N>>
    extends AsynchronousCollection<E>, TreeTraversal<N> {
    getRoots(): Promise<ReadonlyArray<N>>;
}

export type TreeTraversalOrder = "preorder" | "inorder" | "postorder" | "breadthFirst";

/** Custom node types can supply their structural roots through options.buildNodes. */
export interface SynchronousTreeConstructor {
    new <N extends Navigable<unknown>, E = TreeElement<N>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousTree<N, E>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.TreeNode<E>>): SynchronousTree<Nodes.TreeNode<E>, E>;
}

export interface AsynchronousTreeConstructor {
    new <N extends Navigable<unknown>, E = TreeElement<N>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousTree<N, E>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.TreeNode<E>>): AsynchronousTree<Nodes.TreeNode<E>, E>;
}

export interface SynchronousForestConstructor {
    new <N extends Navigable<unknown>, E = TreeElement<N>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousForest<N, E>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.TreeNode<E>>): SynchronousForest<Nodes.TreeNode<E>, E>;
}

export interface AsynchronousForestConstructor {
    new <N extends Navigable<unknown>, E = TreeElement<N>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousForest<N, E>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.TreeNode<E>>): AsynchronousForest<Nodes.TreeNode<E>, E>;
}

export const SynchronousTree = createTreeConstructor("SynchronousTree", false, "Tree") as unknown as SynchronousTreeConstructor;
export const AsynchronousTree = createTreeConstructor("AsynchronousTree", true, "Tree") as unknown as AsynchronousTreeConstructor;
export const SynchronousForest = createTreeConstructor("SynchronousForest", false, "Forest") as unknown as SynchronousForestConstructor;
export const AsynchronousForest = createTreeConstructor("AsynchronousForest", true, "Forest") as unknown as AsynchronousForestConstructor;
