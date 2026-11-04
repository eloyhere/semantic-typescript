import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

export interface SynchronousPrioritySearchTree<E = unknown> extends SynchronousBinaryTree<E, Nodes.PrioritySearchNode<E>> {}

export interface AsynchronousPrioritySearchTree<E = unknown> extends AsynchronousBinaryTree<E, Nodes.PrioritySearchNode<E>> {}

export interface SynchronousPrioritySearchTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.PrioritySearchNode<E>>): SynchronousPrioritySearchTree<E>;
}

export const SynchronousPrioritySearchTree = createTreeConstructor("SynchronousPrioritySearchTree", false, "PrioritySearchTree") as unknown as SynchronousPrioritySearchTreeConstructor;

export interface AsynchronousPrioritySearchTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.PrioritySearchNode<E>>): AsynchronousPrioritySearchTree<E>;
}

export const AsynchronousPrioritySearchTree = createTreeConstructor("AsynchronousPrioritySearchTree", true, "PrioritySearchTree") as unknown as AsynchronousPrioritySearchTreeConstructor;
