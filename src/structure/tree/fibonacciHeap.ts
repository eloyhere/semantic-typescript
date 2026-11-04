import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedForest, AsynchronousRootedForest } from "#semantic/structure/tree/rootedForest";

export interface SynchronousFibonacciHeap<E = unknown> extends SynchronousRootedForest<E, Nodes.FibonacciNode<E>> {}

export interface AsynchronousFibonacciHeap<E = unknown> extends AsynchronousRootedForest<E, Nodes.FibonacciNode<E>> {}

export interface SynchronousFibonacciHeapConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.FibonacciNode<E>>): SynchronousFibonacciHeap<E>;
}

export const SynchronousFibonacciHeap = createTreeConstructor("SynchronousFibonacciHeap", false, "FibonacciHeap") as unknown as SynchronousFibonacciHeapConstructor;

export interface AsynchronousFibonacciHeapConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.FibonacciNode<E>>): AsynchronousFibonacciHeap<E>;
}

export const AsynchronousFibonacciHeap = createTreeConstructor("AsynchronousFibonacciHeap", true, "FibonacciHeap") as unknown as AsynchronousFibonacciHeapConstructor;
