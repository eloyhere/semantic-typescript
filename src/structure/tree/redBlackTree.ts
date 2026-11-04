import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

export interface SynchronousRedBlackTree<E = unknown> extends SynchronousBinarySearchTree<E, Nodes.RedBlackNode<E>> {}

export interface AsynchronousRedBlackTree<E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.RedBlackNode<E>> {}

export interface SynchronousRedBlackTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.RedBlackNode<E>>): SynchronousRedBlackTree<E>;
}

export const SynchronousRedBlackTree = createTreeConstructor("SynchronousRedBlackTree", false, "RedBlackTree") as unknown as SynchronousRedBlackTreeConstructor;

export interface AsynchronousRedBlackTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.RedBlackNode<E>>): AsynchronousRedBlackTree<E>;
}

export const AsynchronousRedBlackTree = createTreeConstructor("AsynchronousRedBlackTree", true, "RedBlackTree") as unknown as AsynchronousRedBlackTreeConstructor;
