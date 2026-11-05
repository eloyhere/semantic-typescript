import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousSearchTree, AsynchronousSearchTree } from "#semantic/structure/tree/searchTree";

/**
 * Synchronous B-tree: a balanced multiway search tree whose pages hold up to
 * `order - 1` separator keys and one more child than keys.
 *
 * Bulk construction picks a common leaf depth, packs keys evenly while
 * respecting the non-root minimum of `ceil(order / 2) - 1` keys, and promotes
 * separators into internal pages. The root may hold as few as one key, and
 * every leaf sits at the same depth. `options.order` defaults to 4.
 *
 * @template K the key type ordered by the search comparator
 */
export interface SynchronousBTree<K = unknown> extends SynchronousSearchTree<K, Nodes.BTreeNode<K>> {}

/**
 * Asynchronous B-tree: the same page/occupancy contract as the synchronous
 * B-tree, with `root()` and collection queries returning promises.
 *
 * The page hierarchy is static after construction, and traversal yields pages
 * exactly as the synchronous variant does. An async key sequence is fully
 * collected before the common leaf depth is selected, so no page is rebuilt
 * while queries can observe it.
 *
 * @template K the key type ordered by the search comparator
 */
export interface AsynchronousBTree<K = unknown> extends AsynchronousSearchTree<K, Nodes.BTreeNode<K>> {}

/**
 * Constructs a `SynchronousBTree` from an optional synchronous key sequence.
 *
 * `options.order` is the maximum child count (default 4, minimum 3);
 * non-root pages keep at least `ceil(order / 2) - 1` keys. Keys are ordered by
 * `options.comparator` or the natural primitive order, and `options.buildNodes`
 * can replace the generated pages.
 */
export interface SynchronousBTreeConstructor {
    new <K = unknown>(source?: Iterable<K>, options?: TreeOptions<K, Nodes.BTreeNode<K>>): SynchronousBTree<K>;
}

export const SynchronousBTree = createTreeConstructor("SynchronousBTree", false, "BTree") as unknown as SynchronousBTreeConstructor;

/**
 * Constructs an `AsynchronousBTree`; the source may be synchronous or an
 * `AsyncIterable`.
 *
 * Page order, minimum occupancy and the `options.order` default match the
 * synchronous constructor. An async source is drained before page allocation,
 * and collection queries await that readiness instead of exposing a partial
 * page tree.
 */
export interface AsynchronousBTreeConstructor {
    new <K = unknown>(source?: Iterable<K> | AsyncIterable<K>, options?: TreeOptions<K, Nodes.BTreeNode<K>>): AsynchronousBTree<K>;
}

export const AsynchronousBTree = createTreeConstructor("AsynchronousBTree", true, "BTree") as unknown as AsynchronousBTreeConstructor;
