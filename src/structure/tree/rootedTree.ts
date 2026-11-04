import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

// 1–11. Shape hierarchy follows the corresponding node interfaces.
export interface SynchronousRootedTree<E = unknown, N extends Nodes.TreeNode<E> = Nodes.TreeNode<E>> extends SynchronousTree<N, E> {}

export interface AsynchronousRootedTree<E = unknown, N extends Nodes.TreeNode<E> = Nodes.TreeNode<E>> extends AsynchronousTree<N, E> {}

export interface SynchronousRootedTreeConstructor {
    new <E, N extends Nodes.TreeNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousRootedTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.TreeNode<E>>): SynchronousRootedTree<E>;
}

export const SynchronousRootedTree = createTreeConstructor("SynchronousRootedTree", false, "RootedTree") as unknown as SynchronousRootedTreeConstructor;

export interface AsynchronousRootedTreeConstructor {
    new <E, N extends Nodes.TreeNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousRootedTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.TreeNode<E>>): AsynchronousRootedTree<E>;
}

export const AsynchronousRootedTree = createTreeConstructor("AsynchronousRootedTree", true, "RootedTree") as unknown as AsynchronousRootedTreeConstructor;
