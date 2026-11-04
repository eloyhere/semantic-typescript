import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

export interface SynchronousUnorderedTree<E = unknown> extends SynchronousRootedTree<E, Nodes.UnorderedTreeNode<E>> {}

export interface AsynchronousUnorderedTree<E = unknown> extends AsynchronousRootedTree<E, Nodes.UnorderedTreeNode<E>> {}

export interface SynchronousUnorderedTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.UnorderedTreeNode<E>>): SynchronousUnorderedTree<E>;
}

export const SynchronousUnorderedTree = createTreeConstructor("SynchronousUnorderedTree", false, "UnorderedTree") as unknown as SynchronousUnorderedTreeConstructor;

export interface AsynchronousUnorderedTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.UnorderedTreeNode<E>>): AsynchronousUnorderedTree<E>;
}

export const AsynchronousUnorderedTree = createTreeConstructor("AsynchronousUnorderedTree", true, "UnorderedTree") as unknown as AsynchronousUnorderedTreeConstructor;
