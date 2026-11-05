import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree, TreeElement } from "#semantic/structure/tree/base";

/** Common hierarchy for multi-key search pages, distinct from element nodes. */
export interface SynchronousSearchTree<K, N extends Nodes.SearchPage<K, N>, E = TreeElement<N>> extends SynchronousTree<N, E> {}

/**
 * Asynchronous multi-key search tree: the page-oriented counterpart of the
 * synchronous search tree, exposing collection queries as promises.
 *
 * Pages hold sorted keys and one more child than keys; the element type is
 * inferred from the page contract, so B-tree keys and B+ leaf entries can share
 * this hierarchy. An async source is drained before page construction.
 *
 * @template K the key type stored in a page
 * @template N the concrete search-page node type
 * @template E the element type exposed by collection operations
 */
export interface AsynchronousSearchTree<K, N extends Nodes.SearchPage<K, N>, E = TreeElement<N>> extends AsynchronousTree<N, E> {}

/**
 * Constructs a `SynchronousSearchTree` from keys or page elements.
 *
 * The generic overload accepts a custom `SearchPage` node type and requires
 * `options.buildNodes`; the key overload builds default `BTreeNode` pages whose
 * order defaults to 4. Page keys are comparator-ordered, and all leaves share a
 * single depth.
 */
export interface SynchronousSearchTreeConstructor {
    new <K, N extends Nodes.SearchPage<K, N>, E = TreeElement<N>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousSearchTree<K, N, E>;
    new <K = unknown>(source?: Iterable<K>, options?: TreeOptions<K, Nodes.BTreeNode<K>>): SynchronousSearchTree<K, Nodes.BTreeNode<K>, K>;
}

export const SynchronousSearchTree = createTreeConstructor("SynchronousSearchTree", false, "SearchTree") as unknown as SynchronousSearchTreeConstructor;

/**
 * Constructs an `AsynchronousSearchTree`; the source may be synchronous or
 * asynchronous.
 *
 * The custom-page overload still requires `options.buildNodes`; the key
 * overload builds default `BTreeNode` pages. An async source is collected
 * before pages are allocated, so the chosen leaf depth fits the final key
 * count.
 */
export interface AsynchronousSearchTreeConstructor {
    new <K, N extends Nodes.SearchPage<K, N>, E = TreeElement<N>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousSearchTree<K, N, E>;
    new <K = unknown>(source?: Iterable<K> | AsyncIterable<K>, options?: TreeOptions<K, Nodes.BTreeNode<K>>): AsynchronousSearchTree<K, Nodes.BTreeNode<K>, K>;
}

export const AsynchronousSearchTree = createTreeConstructor("AsynchronousSearchTree", true, "SearchTree") as unknown as AsynchronousSearchTreeConstructor;
