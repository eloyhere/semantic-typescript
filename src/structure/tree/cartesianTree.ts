import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

export interface SynchronousCartesianTree<E = unknown> extends SynchronousBinaryTree<E, Nodes.CartesianNode<E>> {}

export interface AsynchronousCartesianTree<E = unknown> extends AsynchronousBinaryTree<E, Nodes.CartesianNode<E>> {}

export interface SynchronousCartesianTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.CartesianNode<E>>): SynchronousCartesianTree<E>;
}

export const SynchronousCartesianTree = createTreeConstructor("SynchronousCartesianTree", false, "CartesianTree") as unknown as SynchronousCartesianTreeConstructor;

export interface AsynchronousCartesianTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.CartesianNode<E>>): AsynchronousCartesianTree<E>;
}

export const AsynchronousCartesianTree = createTreeConstructor("AsynchronousCartesianTree", true, "CartesianTree") as unknown as AsynchronousCartesianTreeConstructor;
