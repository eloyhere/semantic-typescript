import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

export interface SynchronousSkewedBinaryTree<E = unknown> extends SynchronousBinaryTree<E, Nodes.SkewedBinaryNode<E>> {}

export interface AsynchronousSkewedBinaryTree<E = unknown> extends AsynchronousBinaryTree<E, Nodes.SkewedBinaryNode<E>> {}

export interface SynchronousSkewedBinaryTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.SkewedBinaryNode<E>>): SynchronousSkewedBinaryTree<E>;
}

export const SynchronousSkewedBinaryTree = createTreeConstructor("SynchronousSkewedBinaryTree", false, "SkewedBinaryTree") as unknown as SynchronousSkewedBinaryTreeConstructor;

export interface AsynchronousSkewedBinaryTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.SkewedBinaryNode<E>>): AsynchronousSkewedBinaryTree<E>;
}

export const AsynchronousSkewedBinaryTree = createTreeConstructor("AsynchronousSkewedBinaryTree", true, "SkewedBinaryTree") as unknown as AsynchronousSkewedBinaryTreeConstructor;
