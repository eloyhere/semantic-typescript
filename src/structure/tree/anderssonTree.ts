import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

export interface SynchronousAnderssonTree<E = unknown> extends SynchronousBinarySearchTree<E, Nodes.AANode<E>> {}

export interface AsynchronousAnderssonTree<E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.AANode<E>> {}

export interface SynchronousAnderssonTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.AANode<E>>): SynchronousAnderssonTree<E>;
}

export const SynchronousAnderssonTree = createTreeConstructor("SynchronousAnderssonTree", false, "AnderssonTree") as unknown as SynchronousAnderssonTreeConstructor;

export interface AsynchronousAnderssonTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.AANode<E>>): AsynchronousAnderssonTree<E>;
}

export const AsynchronousAnderssonTree = createTreeConstructor("AsynchronousAnderssonTree", true, "AnderssonTree") as unknown as AsynchronousAnderssonTreeConstructor;
