import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousCompleteBinaryTree, AsynchronousCompleteBinaryTree } from "#semantic/structure/tree/completeBinaryTree";

// 26–34. A binomial/Fibonacci heap may contain a forest of heap-ordered roots.
export interface SynchronousBinaryHeap<E = unknown> extends SynchronousCompleteBinaryTree<E, Nodes.BinaryHeapNode<E>> {}

export interface AsynchronousBinaryHeap<E = unknown> extends AsynchronousCompleteBinaryTree<E, Nodes.BinaryHeapNode<E>> {}

export interface SynchronousBinaryHeapConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.BinaryHeapNode<E>>): SynchronousBinaryHeap<E>;
}

export const SynchronousBinaryHeap = createTreeConstructor("SynchronousBinaryHeap", false, "BinaryHeap") as unknown as SynchronousBinaryHeapConstructor;

export interface AsynchronousBinaryHeapConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.BinaryHeapNode<E>>): AsynchronousBinaryHeap<E>;
}

export const AsynchronousBinaryHeap = createTreeConstructor("AsynchronousBinaryHeap", true, "BinaryHeap") as unknown as AsynchronousBinaryHeapConstructor;
