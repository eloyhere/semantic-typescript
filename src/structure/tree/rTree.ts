import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

export interface SynchronousRTree<E = unknown, N extends Nodes.RTreeNode<E> = Nodes.RTreeNode<E>> extends SynchronousTree<N, E> {}

export interface AsynchronousRTree<E = unknown, N extends Nodes.RTreeNode<E> = Nodes.RTreeNode<E>> extends AsynchronousTree<N, E> {}

export interface SynchronousRTreeConstructor {
    new <E, N extends Nodes.RTreeNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousRTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.RTreeNode<E>>): SynchronousRTree<E>;
}

export const SynchronousRTree = createTreeConstructor("SynchronousRTree", false, "RTree") as unknown as SynchronousRTreeConstructor;

export interface AsynchronousRTreeConstructor {
    new <E, N extends Nodes.RTreeNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousRTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.RTreeNode<E>>): AsynchronousRTree<E>;
}

export const AsynchronousRTree = createTreeConstructor("AsynchronousRTree", true, "RTree") as unknown as AsynchronousRTreeConstructor;
