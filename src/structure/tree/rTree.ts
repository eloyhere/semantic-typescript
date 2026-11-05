import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

/**
 * Synchronous R-tree: a height-balanced spatial index whose pages own the union
 * bounding box of their entries.
 *
 * Bulk construction groups objects into leaf pages of at most `order` boxes
 * (default 4), then groups those pages until a single root remains. Internal
 * pages hold branch entries with child references, leaves hold object entries;
 * `isLeaf()` distinguishes them, and entry order within a page is preserved.
 *
 * @template E the element type indexed by the tree
 * @template N the R-tree node contract used by navigation
 */
export interface SynchronousRTree<E = unknown, N extends Nodes.RTreeNode<E> = Nodes.RTreeNode<E>> extends SynchronousTree<N, E> {}

/**
 * Asynchronous R-tree: the same page hierarchy and union-bounds contract as the
 * synchronous R-tree, with promise-returning collection queries.
 *
 * Page bounds and entry order are fixed after construction; navigation follows
 * branch-entry children only. An async source is drained before leaf grouping
 * starts, so no page bound is computed twice.
 *
 * @template E the element type indexed by the tree
 * @template N the R-tree node contract used by navigation
 */
export interface AsynchronousRTree<E = unknown, N extends Nodes.RTreeNode<E> = Nodes.RTreeNode<E>> extends AsynchronousTree<N, E> {}

/**
 * Constructs a `SynchronousRTree` from spatial objects.
 *
 * `options.boundsOf` is mandatory for a nonempty tree; `options.order` sets the
 * maximum page size (default 4). The generic overload accepts a custom R-tree
 * node type and requires `options.buildNodes`; the element overload uses
 * `Nodes.RTreeNode`.
 */
export interface SynchronousRTreeConstructor {
    new <E, N extends Nodes.RTreeNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousRTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.RTreeNode<E>>): SynchronousRTree<E>;
}

export const SynchronousRTree = createTreeConstructor("SynchronousRTree", false, "RTree") as unknown as SynchronousRTreeConstructor;

/**
 * Constructs an `AsynchronousRTree`; the source may be synchronous or
 * asynchronous.
 *
 * Bounds extraction, page capacity and the custom-node overload match the
 * synchronous constructor. An async source is fully read before pages are
 * grouped, so every union bound covers a complete page.
 */
export interface AsynchronousRTreeConstructor {
    new <E, N extends Nodes.RTreeNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousRTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.RTreeNode<E>>): AsynchronousRTree<E>;
}

export const AsynchronousRTree = createTreeConstructor("AsynchronousRTree", true, "RTree") as unknown as AsynchronousRTreeConstructor;
