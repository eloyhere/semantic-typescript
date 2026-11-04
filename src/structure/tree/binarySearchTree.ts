import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

// 12–20. Specialised traversal retains height, colour, priority and level getters.
export interface SynchronousBinarySearchTree<E = unknown, N extends Nodes.BinarySearchNode<E> = Nodes.BinarySearchNode<E>> extends SynchronousBinaryTree<E, N> {}

export interface AsynchronousBinarySearchTree<E = unknown, N extends Nodes.BinarySearchNode<E> = Nodes.BinarySearchNode<E>> extends AsynchronousBinaryTree<E, N> {}

export interface SynchronousBinarySearchTreeConstructor {
    new <E, N extends Nodes.BinarySearchNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousBinarySearchTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.BinarySearchNode<E>>): SynchronousBinarySearchTree<E>;
}

export const SynchronousBinarySearchTree = createTreeConstructor("SynchronousBinarySearchTree", false, "BinarySearchTree") as unknown as SynchronousBinarySearchTreeConstructor;

export interface AsynchronousBinarySearchTreeConstructor {
    new <E, N extends Nodes.BinarySearchNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousBinarySearchTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.BinarySearchNode<E>>): AsynchronousBinarySearchTree<E>;
}

export const AsynchronousBinarySearchTree = createTreeConstructor("AsynchronousBinarySearchTree", true, "BinarySearchTree") as unknown as AsynchronousBinarySearchTreeConstructor;
