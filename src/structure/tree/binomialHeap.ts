import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedForest, AsynchronousRootedForest } from "#semantic/structure/tree/rootedForest";

export interface SynchronousBinomialHeap<E = unknown> extends SynchronousRootedForest<E, Nodes.BinomialNode<E>> {}

export interface AsynchronousBinomialHeap<E = unknown> extends AsynchronousRootedForest<E, Nodes.BinomialNode<E>> {}

export interface SynchronousBinomialHeapConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.BinomialNode<E>>): SynchronousBinomialHeap<E>;
}

export const SynchronousBinomialHeap = createTreeConstructor("SynchronousBinomialHeap", false, "BinomialHeap") as unknown as SynchronousBinomialHeapConstructor;

export interface AsynchronousBinomialHeapConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.BinomialNode<E>>): AsynchronousBinomialHeap<E>;
}

export const AsynchronousBinomialHeap = createTreeConstructor("AsynchronousBinomialHeap", true, "BinomialHeap") as unknown as AsynchronousBinomialHeapConstructor;
