import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousNaryTree, AsynchronousNaryTree } from "#semantic/structure/tree/naryTree";

export interface SynchronousDaryHeap<E = unknown> extends SynchronousNaryTree<E, Nodes.DaryHeapNode<E>> {}

export interface AsynchronousDaryHeap<E = unknown> extends AsynchronousNaryTree<E, Nodes.DaryHeapNode<E>> {}

export interface SynchronousDaryHeapConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.DaryHeapNode<E>>): SynchronousDaryHeap<E>;
}

export const SynchronousDaryHeap = createTreeConstructor("SynchronousDaryHeap", false, "DaryHeap") as unknown as SynchronousDaryHeapConstructor;

export interface AsynchronousDaryHeapConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.DaryHeapNode<E>>): AsynchronousDaryHeap<E>;
}

export const AsynchronousDaryHeap = createTreeConstructor("AsynchronousDaryHeap", true, "DaryHeap") as unknown as AsynchronousDaryHeapConstructor;
