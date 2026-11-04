import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousOrderedTree, AsynchronousOrderedTree } from "#semantic/structure/tree/orderedTree";

export interface SynchronousNaryTree<E = unknown, N extends Nodes.NaryNode<E> = Nodes.NaryNode<E>> extends SynchronousOrderedTree<E, N> {}

export interface AsynchronousNaryTree<E = unknown, N extends Nodes.NaryNode<E> = Nodes.NaryNode<E>> extends AsynchronousOrderedTree<E, N> {}

export interface SynchronousNaryTreeConstructor {
    new <E, N extends Nodes.NaryNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousNaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.NaryNode<E>>): SynchronousNaryTree<E>;
}

export const SynchronousNaryTree = createTreeConstructor("SynchronousNaryTree", false, "NaryTree") as unknown as SynchronousNaryTreeConstructor;

export interface AsynchronousNaryTreeConstructor {
    new <E, N extends Nodes.NaryNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousNaryTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.NaryNode<E>>): AsynchronousNaryTree<E>;
}

export const AsynchronousNaryTree = createTreeConstructor("AsynchronousNaryTree", true, "NaryTree") as unknown as AsynchronousNaryTreeConstructor;
