import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

export interface SynchronousOctree<E = unknown> extends SynchronousTree<Nodes.OctNode<E>, E> {}

export interface AsynchronousOctree<E = unknown> extends AsynchronousTree<Nodes.OctNode<E>, E> {}

export interface SynchronousOctreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.OctNode<E>>): SynchronousOctree<E>;
}

export const SynchronousOctree = createTreeConstructor("SynchronousOctree", false, "Octree") as unknown as SynchronousOctreeConstructor;

export interface AsynchronousOctreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.OctNode<E>>): AsynchronousOctree<E>;
}

export const AsynchronousOctree = createTreeConstructor("AsynchronousOctree", true, "Octree") as unknown as AsynchronousOctreeConstructor;
