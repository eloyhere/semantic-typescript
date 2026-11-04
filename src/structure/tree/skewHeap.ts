import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

export interface SynchronousSkewHeap<E = unknown> extends SynchronousBinaryTree<E, Nodes.SkewHeapNode<E>> {}

export interface AsynchronousSkewHeap<E = unknown> extends AsynchronousBinaryTree<E, Nodes.SkewHeapNode<E>> {}

export interface SynchronousSkewHeapConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.SkewHeapNode<E>>): SynchronousSkewHeap<E>;
}

export const SynchronousSkewHeap = createTreeConstructor("SynchronousSkewHeap", false, "SkewHeap") as unknown as SynchronousSkewHeapConstructor;

export interface AsynchronousSkewHeapConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.SkewHeapNode<E>>): AsynchronousSkewHeap<E>;
}

export const AsynchronousSkewHeap = createTreeConstructor("AsynchronousSkewHeap", true, "SkewHeap") as unknown as AsynchronousSkewHeapConstructor;
