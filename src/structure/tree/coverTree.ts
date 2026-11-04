import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

export interface SynchronousCoverTree<E = unknown> extends SynchronousRootedTree<E, Nodes.CoverNode<E>> {}

export interface AsynchronousCoverTree<E = unknown> extends AsynchronousRootedTree<E, Nodes.CoverNode<E>> {}

export interface SynchronousCoverTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.CoverNode<E>>): SynchronousCoverTree<E>;
}

export const SynchronousCoverTree = createTreeConstructor("SynchronousCoverTree", false, "CoverTree") as unknown as SynchronousCoverTreeConstructor;

export interface AsynchronousCoverTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.CoverNode<E>>): AsynchronousCoverTree<E>;
}

export const AsynchronousCoverTree = createTreeConstructor("AsynchronousCoverTree", true, "CoverTree") as unknown as AsynchronousCoverTreeConstructor;
