import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

export interface SynchronousHeavyLightTree<E = unknown> extends SynchronousRootedTree<E, Nodes.HeavyLightNode<E>> {}

export interface AsynchronousHeavyLightTree<E = unknown> extends AsynchronousRootedTree<E, Nodes.HeavyLightNode<E>> {}

export interface SynchronousHeavyLightTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.HeavyLightNode<E>>): SynchronousHeavyLightTree<E>;
}

export const SynchronousHeavyLightTree = createTreeConstructor("SynchronousHeavyLightTree", false, "HeavyLightTree") as unknown as SynchronousHeavyLightTreeConstructor;

export interface AsynchronousHeavyLightTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.HeavyLightNode<E>>): AsynchronousHeavyLightTree<E>;
}

export const AsynchronousHeavyLightTree = createTreeConstructor("AsynchronousHeavyLightTree", true, "HeavyLightTree") as unknown as AsynchronousHeavyLightTreeConstructor;
