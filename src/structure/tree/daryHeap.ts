import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousNaryTree, AsynchronousNaryTree } from "#semantic/structure/tree/naryTree";

/**
 * Synchronous d-ary heap: a heap-ordered tree stored implicitly, with each
 * parent having up to `arity` children.
 *
 * Bulk construction sorts by the comparator and writes the implicit layout
 * level by level, so the parent of index i is `floor((i - 1) / arity)` and heap
 * order holds across every parent/child pair. `getIndex()` returns the
 * zero-based position and `getArity()` the tree-wide branching factor.
 *
 * @template E the element type ordered by the heap comparator
 */
export interface SynchronousDaryHeap<E = unknown> extends SynchronousNaryTree<E, Nodes.DaryHeapNode<E>> {}

/**
 * Asynchronous d-ary heap: the same implicit d-ary layout and heap-order
 * property as the synchronous d-ary heap, with promise-based collection
 * queries.
 *
 * The arity is fixed for the whole tree and the array is written once, so
 * index and arity metadata stay consistent through traversal. An async source
 * is sorted and laid out before the readiness gate opens.
 *
 * @template E the element type ordered by the heap comparator
 */
export interface AsynchronousDaryHeap<E = unknown> extends AsynchronousNaryTree<E, Nodes.DaryHeapNode<E>> {}

/**
 * Constructs a `SynchronousDaryHeap` from an optional synchronous source.
 *
 * `options.arity` must be a positive safe integer (default 2) and is attached
 * to every node through `getArity()`. Elements are comparator-sorted into the
 * implicit array; `options.buildNodes` may replace that layout.
 */
export interface SynchronousDaryHeapConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.DaryHeapNode<E>>): SynchronousDaryHeap<E>;
}

export const SynchronousDaryHeap = createTreeConstructor("SynchronousDaryHeap", false, "DaryHeap") as unknown as SynchronousDaryHeapConstructor;

/**
 * Constructs an `AsynchronousDaryHeap`; the source may be synchronous or
 * asynchronous.
 *
 * Arity validation and comparator ordering are shared with the synchronous
 * constructor. An async source is collected before the implicit array is
 * written, so every node receives the same final arity and index.
 */
export interface AsynchronousDaryHeapConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.DaryHeapNode<E>>): AsynchronousDaryHeap<E>;
}

export const AsynchronousDaryHeap = createTreeConstructor("AsynchronousDaryHeap", true, "DaryHeap") as unknown as AsynchronousDaryHeapConstructor;
