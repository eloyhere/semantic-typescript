import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRTree, AsynchronousRTree } from "#semantic/structure/tree/rTree";

/**
 * Synchronous R+ tree: the non-overlapping sibling variant of the R-tree,
 * intended to avoid duplicate routing regions.
 *
 * Bulk construction deliberately emits a single leaf page holding every entry
 * and its box. A one-leaf R+ tree is valid, and the builder does not invent
 * overlapping internal partitions; `getBounds()` is the union of the entries,
 * so sibling interiors cannot overlap.
 *
 * @template E the element type indexed by the tree
 */
export interface SynchronousRPlusTree<E = unknown> extends SynchronousRTree<E, Nodes.RPlusNode<E>> {}

/**
 * Asynchronous R+ tree: the same non-overlapping-sibling intent as the
 * synchronous R+ tree, realised here as one leaf page, with
 * promise-returning collection queries.
 *
 * The single page is fixed after construction, so there are no sibling boxes to
 * overlap. `options.order` does not change that bulk layout. An async source is
 * drained before the page and its union bound are created.
 *
 * @template E the element type indexed by the tree
 */
export interface AsynchronousRPlusTree<E = unknown> extends AsynchronousRTree<E, Nodes.RPlusNode<E>> {}

/**
 * Constructs a `SynchronousRPlusTree` from spatial objects.
 *
 * `options.boundsOf` is mandatory for a nonempty tree and must return finite,
 * equally dimensional boxes. The bulk result is a single leaf page, so
 * `options.order` does not affect it; `options.buildNodes` can provide a
 * genuinely partitioned R+ tree.
 */
export interface SynchronousRPlusTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.RPlusNode<E>>): SynchronousRPlusTree<E>;
}

export const SynchronousRPlusTree = createTreeConstructor("SynchronousRPlusTree", false, "RPlusTree") as unknown as SynchronousRPlusTreeConstructor;

/**
 * Constructs an `AsynchronousRPlusTree`; the source may be synchronous or
 * asynchronous.
 *
 * The `boundsOf` requirement and single-leaf bulk result match the synchronous
 * constructor. An async source is fully collected before the page and its union
 * bound are created.
 */
export interface AsynchronousRPlusTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.RPlusNode<E>>): AsynchronousRPlusTree<E>;
}

export const AsynchronousRPlusTree = createTreeConstructor("AsynchronousRPlusTree", true, "RPlusTree") as unknown as AsynchronousRPlusTreeConstructor;
