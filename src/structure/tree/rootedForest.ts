import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousForest, AsynchronousForest } from "#semantic/structure/tree/base";

/** 4. Element-bearing forest whose collection size counts elements. */
export interface SynchronousRootedForest<E = unknown, N extends Nodes.TreeNode<E> = Nodes.TreeNode<E>>
    extends SynchronousForest<N, E> {
    getRoots(): ReadonlyArray<N>;
}

export interface AsynchronousRootedForest<E = unknown, N extends Nodes.TreeNode<E> = Nodes.TreeNode<E>>
    extends AsynchronousForest<N, E> {}

export interface SynchronousRootedForestConstructor {
    new <E, N extends Nodes.TreeNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousRootedForest<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.TreeNode<E>>): SynchronousRootedForest<E>;
}

export const SynchronousRootedForest = createTreeConstructor("SynchronousRootedForest", false, "RootedForest") as unknown as SynchronousRootedForestConstructor;

export interface AsynchronousRootedForestConstructor {
    new <E, N extends Nodes.TreeNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousRootedForest<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.TreeNode<E>>): AsynchronousRootedForest<E>;
}

export const AsynchronousRootedForest = createTreeConstructor("AsynchronousRootedForest", true, "RootedForest") as unknown as AsynchronousRootedForestConstructor;
