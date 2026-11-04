import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousForest, AsynchronousForest } from "#semantic/structure/tree/base";

export interface SynchronousLinkCutTree<E = unknown, A = E, U = never> extends SynchronousForest<Nodes.LinkCutNode<E, A, U>, E> {}

export interface AsynchronousLinkCutTree<E = unknown, A = E, U = never> extends AsynchronousForest<Nodes.LinkCutNode<E, A, U>, E> {}

export interface SynchronousLinkCutTreeConstructor {
    new <E = unknown, A = E, U = never>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.LinkCutNode<E, A, U>>): SynchronousLinkCutTree<E, A, U>;
}

export const SynchronousLinkCutTree = createTreeConstructor("SynchronousLinkCutTree", false, "LinkCutTree") as unknown as SynchronousLinkCutTreeConstructor;

export interface AsynchronousLinkCutTreeConstructor {
    new <E = unknown, A = E, U = never>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.LinkCutNode<E, A, U>>): AsynchronousLinkCutTree<E, A, U>;
}

export const AsynchronousLinkCutTree = createTreeConstructor("AsynchronousLinkCutTree", true, "LinkCutTree") as unknown as AsynchronousLinkCutTreeConstructor;
