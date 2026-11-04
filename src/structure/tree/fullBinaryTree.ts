import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

export interface SynchronousFullBinaryTree<E = unknown, N extends Nodes.FullBinaryNode<E> = Nodes.FullBinaryNode<E>> extends SynchronousBinaryTree<E, N> {}

export interface AsynchronousFullBinaryTree<E = unknown, N extends Nodes.FullBinaryNode<E> = Nodes.FullBinaryNode<E>> extends AsynchronousBinaryTree<E, N> {}

export interface SynchronousFullBinaryTreeConstructor {
    new <E, N extends Nodes.FullBinaryNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousFullBinaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.FullBinaryNode<E>>): SynchronousFullBinaryTree<E>;
}

export const SynchronousFullBinaryTree = createTreeConstructor("SynchronousFullBinaryTree", false, "FullBinaryTree") as unknown as SynchronousFullBinaryTreeConstructor;

export interface AsynchronousFullBinaryTreeConstructor {
    new <E, N extends Nodes.FullBinaryNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousFullBinaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.FullBinaryNode<E>>): AsynchronousFullBinaryTree<E>;
}

export const AsynchronousFullBinaryTree = createTreeConstructor("AsynchronousFullBinaryTree", true, "FullBinaryTree") as unknown as AsynchronousFullBinaryTreeConstructor;
