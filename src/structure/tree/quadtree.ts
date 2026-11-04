import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

export interface SynchronousQuadtree<E = unknown> extends SynchronousTree<Nodes.QuadNode<E>, E> {}

export interface AsynchronousQuadtree<E = unknown> extends AsynchronousTree<Nodes.QuadNode<E>, E> {}

export interface SynchronousQuadtreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.QuadNode<E>>): SynchronousQuadtree<E>;
}

export const SynchronousQuadtree = createTreeConstructor("SynchronousQuadtree", false, "Quadtree") as unknown as SynchronousQuadtreeConstructor;

export interface AsynchronousQuadtreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.QuadNode<E>>): AsynchronousQuadtree<E>;
}

export const AsynchronousQuadtree = createTreeConstructor("AsynchronousQuadtree", true, "Quadtree") as unknown as AsynchronousQuadtreeConstructor;
