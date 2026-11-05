import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

/**
 * Synchronous splay tree: a binary search tree whose node contract stores no
 * persistent balance metadata, because accesses would splay a node to the root.
 *
 * Bulk construction sorts by the comparator and lays the elements out as a
 * height-balanced midpoint tree; it does not replay splay rotations and records
 * no access counts or last-access state. `SplayNode` therefore adds nothing
 * beyond `BinarySearchNode`, and traversal leaves the shape unchanged.
 *
 * @template E the element type ordered by the tree comparator
 */
export interface SynchronousSplayTree<E = unknown> extends SynchronousBinarySearchTree<E, Nodes.SplayNode<E>> {}

/**
 * Asynchronous splay tree: the same access-metadata-free contract as the
 * synchronous splay tree, with `root()` and collection queries returning
 * promises.
 *
 * Reads never move nodes, so the built shape stays stable across queries; a
 * splaying implementation would maintain its own access bookkeeping outside
 * this structural contract. An async source is drained before the midpoint
 * layout is created.
 *
 * @template E the element type ordered by the tree comparator
 */
export interface AsynchronousSplayTree<E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.SplayNode<E>> {}

/**
 * Constructs a `SynchronousSplayTree` from an optional synchronous source.
 *
 * Elements are comparator-sorted and balanced by midpoint split; no splay
 * sequence is replayed and no access metadata is attached. `options.buildNodes`
 * may replace the layout with a tree shaped by a caller's own accesses.
 */
export interface SynchronousSplayTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.SplayNode<E>>): SynchronousSplayTree<E>;
}

export const SynchronousSplayTree = createTreeConstructor("SynchronousSplayTree", false, "SplayTree") as unknown as SynchronousSplayTreeConstructor;

/**
 * Constructs an `AsynchronousSplayTree`; the source may be synchronous or
 * asynchronous.
 *
 * Sorting, midpoint balancing and the absence of access metadata match the
 * synchronous constructor. An async source is fully read before balancing, so
 * the initial shape covers every element exactly once.
 */
export interface AsynchronousSplayTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.SplayNode<E>>): AsynchronousSplayTree<E>;
}

export const AsynchronousSplayTree = createTreeConstructor("AsynchronousSplayTree", true, "SplayTree") as unknown as AsynchronousSplayTreeConstructor;
