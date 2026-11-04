import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

export interface SynchronousScapegoatTree<E = unknown> extends SynchronousBinarySearchTree<E, Nodes.ScapegoatNode<E>> {}

export interface AsynchronousScapegoatTree<E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.ScapegoatNode<E>> {}

export interface SynchronousScapegoatTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.ScapegoatNode<E>>): SynchronousScapegoatTree<E>;
}

export const SynchronousScapegoatTree = createTreeConstructor("SynchronousScapegoatTree", false, "ScapegoatTree") as unknown as SynchronousScapegoatTreeConstructor;

export interface AsynchronousScapegoatTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.ScapegoatNode<E>>): AsynchronousScapegoatTree<E>;
}

export const AsynchronousScapegoatTree = createTreeConstructor("AsynchronousScapegoatTree", true, "ScapegoatTree") as unknown as AsynchronousScapegoatTreeConstructor;
