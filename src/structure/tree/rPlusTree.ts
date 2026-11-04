import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRTree, AsynchronousRTree } from "#semantic/structure/tree/rTree";

export interface SynchronousRPlusTree<E = unknown> extends SynchronousRTree<E, Nodes.RPlusNode<E>> {}

export interface AsynchronousRPlusTree<E = unknown> extends AsynchronousRTree<E, Nodes.RPlusNode<E>> {}

export interface SynchronousRPlusTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.RPlusNode<E>>): SynchronousRPlusTree<E>;
}

export const SynchronousRPlusTree = createTreeConstructor("SynchronousRPlusTree", false, "RPlusTree") as unknown as SynchronousRPlusTreeConstructor;

export interface AsynchronousRPlusTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.RPlusNode<E>>): AsynchronousRPlusTree<E>;
}

export const AsynchronousRPlusTree = createTreeConstructor("AsynchronousRPlusTree", true, "RPlusTree") as unknown as AsynchronousRPlusTreeConstructor;
