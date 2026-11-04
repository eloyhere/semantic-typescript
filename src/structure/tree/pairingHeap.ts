import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

export interface SynchronousPairingHeap<E = unknown> extends SynchronousRootedTree<E, Nodes.PairingNode<E>> {}

export interface AsynchronousPairingHeap<E = unknown> extends AsynchronousRootedTree<E, Nodes.PairingNode<E>> {}

export interface SynchronousPairingHeapConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.PairingNode<E>>): SynchronousPairingHeap<E>;
}

export const SynchronousPairingHeap = createTreeConstructor("SynchronousPairingHeap", false, "PairingHeap") as unknown as SynchronousPairingHeapConstructor;

export interface AsynchronousPairingHeapConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.PairingNode<E>>): AsynchronousPairingHeap<E>;
}

export const AsynchronousPairingHeap = createTreeConstructor("AsynchronousPairingHeap", true, "PairingHeap") as unknown as AsynchronousPairingHeapConstructor;
