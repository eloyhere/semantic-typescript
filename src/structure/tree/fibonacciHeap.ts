import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedForest, AsynchronousRootedForest } from "#semantic/structure/forest/rootedForest";

/**
 * Synchronous Fibonacci heap at its bulk-construction boundary: every element
 * becomes a singleton root in a circular root list.
 *
 * No consolidation is performed, so each root reports degree 0 and an unmarked
 * state, and `getPreviousSibling()` / `getNextSibling()` wrap around the root
 * list. Heap order is not established between those roots; the contract
 * captures the forest a later merge or decrease-key would start from.
 *
 * @template E the element type ordered by the heap comparator
 */
export interface SynchronousFibonacciHeap<E = unknown> extends SynchronousRootedForest<E, Nodes.FibonacciNode<E>> {}

/**
 * Asynchronous Fibonacci heap: the same circular root-list contract as the
 * synchronous Fibonacci heap, with `getRoots()` and collection queries
 * returning promises.
 *
 * Roots stay singleton and unconsolidated after construction, and sibling
 * navigation remains circular. An async source is fully read before the root
 * ring is created, so the ring does not change shape after its first query.
 *
 * @template E the element type ordered by the heap comparator
 */
export interface AsynchronousFibonacciHeap<E = unknown> extends AsynchronousRootedForest<E, Nodes.FibonacciNode<E>> {}

/**
 * Constructs a `SynchronousFibonacciHeap` from an optional synchronous source.
 *
 * The bulk builder creates one root per element, links the roots circularly,
 * and records degree 0 plus an unmarked state; no comparator-driven merge is
 * applied. `options.buildNodes` may supply a consolidated heap when callers
 * need one.
 */
export interface SynchronousFibonacciHeapConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.FibonacciNode<E>>): SynchronousFibonacciHeap<E>;
}

export const SynchronousFibonacciHeap = createTreeConstructor("SynchronousFibonacciHeap", false, "FibonacciHeap") as unknown as SynchronousFibonacciHeapConstructor;

/**
 * Constructs an `AsynchronousFibonacciHeap`; the source may be synchronous or
 * asynchronous.
 *
 * Root creation and circular sibling links follow the synchronous constructor.
 * An async source is drained first, so the root ring reflects the complete
 * element set rather than an initial prefix.
 */
export interface AsynchronousFibonacciHeapConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.FibonacciNode<E>>): AsynchronousFibonacciHeap<E>;
}

export const AsynchronousFibonacciHeap = createTreeConstructor("AsynchronousFibonacciHeap", true, "FibonacciHeap") as unknown as AsynchronousFibonacciHeapConstructor;
