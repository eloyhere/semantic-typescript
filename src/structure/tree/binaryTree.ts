import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousOrderedTree, AsynchronousOrderedTree } from "#semantic/structure/tree/orderedTree";

export interface SynchronousBinaryTree<E = unknown, N extends Nodes.BinaryNode<E> = Nodes.BinaryNode<E>> extends SynchronousOrderedTree<E, N> {}

export interface AsynchronousBinaryTree<E = unknown, N extends Nodes.BinaryNode<E> = Nodes.BinaryNode<E>> extends AsynchronousOrderedTree<E, N> {}

export interface SynchronousBinaryTreeConstructor {
    new <E, N extends Nodes.BinaryNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousBinaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.BinaryNode<E>>): SynchronousBinaryTree<E>;
}

export const SynchronousBinaryTree = createTreeConstructor("SynchronousBinaryTree", false, "BinaryTree") as unknown as SynchronousBinaryTreeConstructor;

export interface AsynchronousBinaryTreeConstructor {
    new <E, N extends Nodes.BinaryNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousBinaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.BinaryNode<E>>): AsynchronousBinaryTree<E>;
}

export const AsynchronousBinaryTree = createTreeConstructor("AsynchronousBinaryTree", true, "BinaryTree") as unknown as AsynchronousBinaryTreeConstructor;
