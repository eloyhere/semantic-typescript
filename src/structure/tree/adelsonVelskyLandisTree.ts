import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

/**
 * Synchronous AVL (Adelson-Velsky-Landis) tree: a binary search tree whose
 * nodes expose a height and a balance factor restricted to -1, 0 and 1.
 *
 * Bulk construction sorts by the comparator and splits the sorted array at its
 * midpoint recursively, so every node satisfies the strict AVL bound rather
 * than the looser red-black bound. `getBalanceFactor()` throws when the cached
 * heights leave that range, which makes the invariant directly testable.
 * Equal elements keep their stable input order.
 *
 * @template E the element type ordered by the tree comparator
 */
export interface SynchronousAdelsonVelskyLandisTree<E = unknown> extends SynchronousBinarySearchTree<E, Nodes.AVLNode<E>> {}

/**
 * Asynchronous AVL tree: the same height-balanced node contract as the
 * synchronous AVL tree, with `root()` and collection queries returning
 * promises.
 *
 * Node navigation, the height/balance getters and the four traversals stay
 * synchronous. The AVL shape is established during construction rather than
 * recomputed by queries, so an async element source must be drained before the
 * first query observes the tree.
 *
 * @template E the element type ordered by the tree comparator
 */
export interface AsynchronousAdelsonVelskyLandisTree<E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.AVLNode<E>> {}

/**
 * Constructs a `SynchronousAdelsonVelskyLandisTree` from an optional
 * synchronous element source.
 *
 * The builder sorts with `options.comparator`, then halves the sorted array
 * into a midpoint layout that is AVL-balanced by construction. Duplicate
 * elements remain in input order. `options.buildNodes` may substitute a
 * caller-built tree, whose balance is then checked by the node getter.
 */
export interface SynchronousAdelsonVelskyLandisTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.AVLNode<E>>): SynchronousAdelsonVelskyLandisTree<E>;
}

export const SynchronousAdelsonVelskyLandisTree = createTreeConstructor("SynchronousAdelsonVelskyLandisTree", false, "AdelsonVelskyLandisTree") as unknown as SynchronousAdelsonVelskyLandisTreeConstructor;

/**
 * Constructs an `AsynchronousAdelsonVelskyLandisTree`; the source may be a
 * synchronous or asynchronous iterable.
 *
 * Construction follows the synchronous AVL build: comparator ordering, sorted
 * midpoint layout, and optional `buildNodes`. For an async source the
 * constructor returns immediately and the tree becomes observable only after
 * the readiness gate resolves.
 */
export interface AsynchronousAdelsonVelskyLandisTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.AVLNode<E>>): AsynchronousAdelsonVelskyLandisTree<E>;
}

export const AsynchronousAdelsonVelskyLandisTree = createTreeConstructor("AsynchronousAdelsonVelskyLandisTree", true, "AdelsonVelskyLandisTree") as unknown as AsynchronousAdelsonVelskyLandisTreeConstructor;
