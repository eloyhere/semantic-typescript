import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

export interface SynchronousTreap<E = unknown> extends SynchronousBinarySearchTree<E, Nodes.TreapNode<E>> {}

export interface AsynchronousTreap<E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.TreapNode<E>> {}

export interface SynchronousTreapConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.TreapNode<E>>): SynchronousTreap<E>;
}

export const SynchronousTreap = createTreeConstructor("SynchronousTreap", false, "Treap") as unknown as SynchronousTreapConstructor;

export interface AsynchronousTreapConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.TreapNode<E>>): AsynchronousTreap<E>;
}

export const AsynchronousTreap = createTreeConstructor("AsynchronousTreap", true, "Treap") as unknown as AsynchronousTreapConstructor;
