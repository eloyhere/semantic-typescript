import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

export interface SynchronousOrderedTree<E = unknown, N extends Nodes.OrderedTreeNode<E> = Nodes.OrderedTreeNode<E>> extends SynchronousRootedTree<E, N> {}

export interface AsynchronousOrderedTree<E = unknown, N extends Nodes.OrderedTreeNode<E> = Nodes.OrderedTreeNode<E>> extends AsynchronousRootedTree<E, N> {}

export interface SynchronousOrderedTreeConstructor {
    new <E, N extends Nodes.OrderedTreeNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousOrderedTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.OrderedTreeNode<E>>): SynchronousOrderedTree<E>;
}

export const SynchronousOrderedTree = createTreeConstructor("SynchronousOrderedTree", false, "OrderedTree") as unknown as SynchronousOrderedTreeConstructor;

export interface AsynchronousOrderedTreeConstructor {
    new <E, N extends Nodes.OrderedTreeNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousOrderedTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.OrderedTreeNode<E>>): AsynchronousOrderedTree<E>;
}

export const AsynchronousOrderedTree = createTreeConstructor("AsynchronousOrderedTree", true, "OrderedTree") as unknown as AsynchronousOrderedTreeConstructor;
