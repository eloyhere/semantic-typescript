import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

export interface SynchronousSplayTree<E = unknown> extends SynchronousBinarySearchTree<E, Nodes.SplayNode<E>> {}

export interface AsynchronousSplayTree<E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.SplayNode<E>> {}

export interface SynchronousSplayTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.SplayNode<E>>): SynchronousSplayTree<E>;
}

export const SynchronousSplayTree = createTreeConstructor("SynchronousSplayTree", false, "SplayTree") as unknown as SynchronousSplayTreeConstructor;

export interface AsynchronousSplayTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.SplayNode<E>>): AsynchronousSplayTree<E>;
}

export const AsynchronousSplayTree = createTreeConstructor("AsynchronousSplayTree", true, "SplayTree") as unknown as AsynchronousSplayTreeConstructor;
