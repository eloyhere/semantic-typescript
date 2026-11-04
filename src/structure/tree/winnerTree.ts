import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

export interface SynchronousWinnerTree<E = unknown> extends SynchronousTree<Nodes.WinnerNode<E>, E> {}

export interface AsynchronousWinnerTree<E = unknown> extends AsynchronousTree<Nodes.WinnerNode<E>, E> {}

export interface SynchronousWinnerTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.WinnerNode<E>>): SynchronousWinnerTree<E>;
}

export const SynchronousWinnerTree = createTreeConstructor("SynchronousWinnerTree", false, "WinnerTree") as unknown as SynchronousWinnerTreeConstructor;

export interface AsynchronousWinnerTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.WinnerNode<E>>): AsynchronousWinnerTree<E>;
}

export const AsynchronousWinnerTree = createTreeConstructor("AsynchronousWinnerTree", true, "WinnerTree") as unknown as AsynchronousWinnerTreeConstructor;
