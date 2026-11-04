import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRTree, AsynchronousRTree } from "#semantic/structure/tree/rTree";

export interface SynchronousRStarTree<E = unknown> extends SynchronousRTree<E, Nodes.RStarNode<E>> {}

export interface AsynchronousRStarTree<E = unknown> extends AsynchronousRTree<E, Nodes.RStarNode<E>> {}

export interface SynchronousRStarTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.RStarNode<E>>): SynchronousRStarTree<E>;
}

export const SynchronousRStarTree = createTreeConstructor("SynchronousRStarTree", false, "RStarTree") as unknown as SynchronousRStarTreeConstructor;

export interface AsynchronousRStarTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.RStarNode<E>>): AsynchronousRStarTree<E>;
}

export const AsynchronousRStarTree = createTreeConstructor("AsynchronousRStarTree", true, "RStarTree") as unknown as AsynchronousRStarTreeConstructor;
