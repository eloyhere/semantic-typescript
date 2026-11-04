import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousFullBinaryTree, AsynchronousFullBinaryTree } from "#semantic/structure/tree/fullBinaryTree";

export interface SynchronousPerfectBinaryTree<E = unknown> extends SynchronousFullBinaryTree<E, Nodes.PerfectBinaryNode<E>> {}

export interface AsynchronousPerfectBinaryTree<E = unknown> extends AsynchronousFullBinaryTree<E, Nodes.PerfectBinaryNode<E>> {}

export interface SynchronousPerfectBinaryTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.PerfectBinaryNode<E>>): SynchronousPerfectBinaryTree<E>;
}

export const SynchronousPerfectBinaryTree = createTreeConstructor("SynchronousPerfectBinaryTree", false, "PerfectBinaryTree") as unknown as SynchronousPerfectBinaryTreeConstructor;

export interface AsynchronousPerfectBinaryTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.PerfectBinaryNode<E>>): AsynchronousPerfectBinaryTree<E>;
}

export const AsynchronousPerfectBinaryTree = createTreeConstructor("AsynchronousPerfectBinaryTree", true, "PerfectBinaryTree") as unknown as AsynchronousPerfectBinaryTreeConstructor;
