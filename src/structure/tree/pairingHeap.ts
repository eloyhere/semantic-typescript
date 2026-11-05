import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

/**
 * Synchronous pairing heap: a heap-ordered tree whose root holds the minimum
 * and whose remaining elements hang from it as chained siblings.
 *
 * Bulk construction sorts by the comparator, makes the first element the root,
 * and attaches every other element as a direct child in order, linking them
 * through `getNextSibling()`. No balance field is stored; pairwise merging is
 * the tree-level operation this bulk shape seeds.
 *
 * @template E the element type ordered by the heap comparator
 */
export interface SynchronousPairingHeap<E = unknown> extends SynchronousRootedTree<E, Nodes.PairingNode<E>> {}

/**
 * Asynchronous pairing heap: the same root-minimum/sibling-list contract as the
 * synchronous pairing heap, with promise-returning collection queries.
 *
 * The root, its children and the sibling chain are fixed after construction;
 * navigation never follows sibling links as child edges. An async source is
 * sorted and attached before the readiness gate opens.
 *
 * @template E the element type ordered by the heap comparator
 */
export interface AsynchronousPairingHeap<E = unknown> extends AsynchronousRootedTree<E, Nodes.PairingNode<E>> {}

/**
 * Constructs a `SynchronousPairingHeap` from an optional synchronous source.
 *
 * Elements are comparator-sorted and attached to the root as a sibling chain,
 * preserving duplicates. `options.buildNodes` may replace this seeded shape
 * with a heap produced by pairwise merging.
 */
export interface SynchronousPairingHeapConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.PairingNode<E>>): SynchronousPairingHeap<E>;
}

export const SynchronousPairingHeap = createTreeConstructor("SynchronousPairingHeap", false, "PairingHeap") as unknown as SynchronousPairingHeapConstructor;

/**
 * Constructs an `AsynchronousPairingHeap`; the source may be synchronous or
 * asynchronous.
 *
 * Comparator ordering and the root/sibling-chain layout match the synchronous
 * constructor. An async source is drained before the root is chosen, so the
 * minimum is selected from the complete element set.
 */
export interface AsynchronousPairingHeapConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.PairingNode<E>>): AsynchronousPairingHeap<E>;
}

export const AsynchronousPairingHeap = createTreeConstructor("AsynchronousPairingHeap", true, "PairingHeap") as unknown as AsynchronousPairingHeapConstructor;
