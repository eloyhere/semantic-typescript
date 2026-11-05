import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

/**
 * Synchronous treap: a binary search tree on elements whose priorities obey
 * min-heap order, combining search and heap invariants in one shape.
 *
 * Bulk construction sorts by the comparator (duplicates stable), assigns each
 * element a finite priority from `options.priority` or a fresh random value,
 * then runs a Cartesian build. In-order therefore matches search order, each
 * parent outranks its children, and `getPriority()` exposes the priority.
 *
 * @template E the element type ordered by the tree comparator
 */
export interface SynchronousTreap<E = unknown> extends SynchronousBinarySearchTree<E, Nodes.TreapNode<E>> {}

/**
 * Asynchronous treap: the same search-order/min-heap-priority contract as the
 * synchronous treap, with promise-returning collection queries.
 *
 * Priorities are assigned once during construction and never recomputed, so the
 * shape is stable across queries. An async source is drained before priorities
 * are drawn, keeping the pairing of elements and priorities fixed.
 *
 * @template E the element type ordered by the tree comparator
 */
export interface AsynchronousTreap<E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.TreapNode<E>> {}

/**
 * Constructs a `SynchronousTreap` from an optional synchronous source.
 *
 * Elements are comparator-sorted; `options.priority` may supply finite
 * priorities per element and index, otherwise each element receives a fresh
 * random priority. `options.buildNodes` may replace the Cartesian build with a
 * custom priority layout.
 */
export interface SynchronousTreapConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.TreapNode<E>>): SynchronousTreap<E>;
}

export const SynchronousTreap = createTreeConstructor("SynchronousTreap", false, "Treap") as unknown as SynchronousTreapConstructor;

/**
 * Constructs an `AsynchronousTreap`; the source may be synchronous or
 * asynchronous.
 *
 * Priority assignment and finite-value validation match the synchronous
 * constructor. An async source is collected first, so priorities attach to a
 * complete element list rather than to arriving elements.
 */
export interface AsynchronousTreapConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.TreapNode<E>>): AsynchronousTreap<E>;
}

export const AsynchronousTreap = createTreeConstructor("AsynchronousTreap", true, "Treap") as unknown as AsynchronousTreapConstructor;
