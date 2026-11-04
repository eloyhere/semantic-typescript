import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree, TreeElement } from "#semantic/structure/tree/base";

/** Common hierarchy for multi-key search pages, distinct from element nodes. */
export interface SynchronousSearchTree<K, N extends Nodes.SearchPage<K, N>, E = TreeElement<N>> extends SynchronousTree<N, E> {}

export interface AsynchronousSearchTree<K, N extends Nodes.SearchPage<K, N>, E = TreeElement<N>> extends AsynchronousTree<N, E> {}

export interface SynchronousSearchTreeConstructor {
    new <K, N extends Nodes.SearchPage<K, N>, E = TreeElement<N>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousSearchTree<K, N, E>;
    new <K = unknown>(source?: Iterable<K>, options?: TreeOptions<K, Nodes.BTreeNode<K>>): SynchronousSearchTree<K, Nodes.BTreeNode<K>, K>;
}

export const SynchronousSearchTree = createTreeConstructor("SynchronousSearchTree", false, "SearchTree") as unknown as SynchronousSearchTreeConstructor;

export interface AsynchronousSearchTreeConstructor {
    new <K, N extends Nodes.SearchPage<K, N>, E = TreeElement<N>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousSearchTree<K, N, E>;
    new <K = unknown>(source?: Iterable<K> | AsyncIterable<K>, options?: TreeOptions<K, Nodes.BTreeNode<K>>): AsynchronousSearchTree<K, Nodes.BTreeNode<K>, K>;
}

export const AsynchronousSearchTree = createTreeConstructor("AsynchronousSearchTree", true, "SearchTree") as unknown as AsynchronousSearchTreeConstructor;
