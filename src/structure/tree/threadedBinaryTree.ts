import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

export interface SynchronousThreadedBinaryTree<E = unknown> extends SynchronousBinaryTree<E, Nodes.ThreadedBinaryNode<E>> {}

export interface AsynchronousThreadedBinaryTree<E = unknown> extends AsynchronousBinaryTree<E, Nodes.ThreadedBinaryNode<E>> {}

export interface SynchronousThreadedBinaryTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.ThreadedBinaryNode<E>>): SynchronousThreadedBinaryTree<E>;
}

export const SynchronousThreadedBinaryTree = createTreeConstructor("SynchronousThreadedBinaryTree", false, "ThreadedBinaryTree") as unknown as SynchronousThreadedBinaryTreeConstructor;

export interface AsynchronousThreadedBinaryTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.ThreadedBinaryNode<E>>): AsynchronousThreadedBinaryTree<E>;
}

export const AsynchronousThreadedBinaryTree = createTreeConstructor("AsynchronousThreadedBinaryTree", true, "ThreadedBinaryTree") as unknown as AsynchronousThreadedBinaryTreeConstructor;
