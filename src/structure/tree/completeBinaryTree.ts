import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

export interface SynchronousCompleteBinaryTree<E = unknown, N extends Nodes.CompleteBinaryNode<E> = Nodes.CompleteBinaryNode<E>> extends SynchronousBinaryTree<E, N> {}

export interface AsynchronousCompleteBinaryTree<E = unknown, N extends Nodes.CompleteBinaryNode<E> = Nodes.CompleteBinaryNode<E>> extends AsynchronousBinaryTree<E, N> {}

export interface SynchronousCompleteBinaryTreeConstructor {
    new <E, N extends Nodes.CompleteBinaryNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousCompleteBinaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.CompleteBinaryNode<E>>): SynchronousCompleteBinaryTree<E>;
}

export const SynchronousCompleteBinaryTree = createTreeConstructor("SynchronousCompleteBinaryTree", false, "CompleteBinaryTree") as unknown as SynchronousCompleteBinaryTreeConstructor;

export interface AsynchronousCompleteBinaryTreeConstructor {
    new <E, N extends Nodes.CompleteBinaryNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousCompleteBinaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.CompleteBinaryNode<E>>): AsynchronousCompleteBinaryTree<E>;
}

export const AsynchronousCompleteBinaryTree = createTreeConstructor("AsynchronousCompleteBinaryTree", true, "CompleteBinaryTree") as unknown as AsynchronousCompleteBinaryTreeConstructor;
