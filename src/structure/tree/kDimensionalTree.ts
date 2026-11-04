import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

export interface SynchronousKDimensionalTree<E = unknown> extends SynchronousBinaryTree<E, Nodes.KDNode<E>> {}

export interface AsynchronousKDimensionalTree<E = unknown> extends AsynchronousBinaryTree<E, Nodes.KDNode<E>> {}

export interface SynchronousKDimensionalTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.KDNode<E>>): SynchronousKDimensionalTree<E>;
}

export const SynchronousKDimensionalTree = createTreeConstructor("SynchronousKDimensionalTree", false, "KDimensionalTree") as unknown as SynchronousKDimensionalTreeConstructor;

export interface AsynchronousKDimensionalTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.KDNode<E>>): AsynchronousKDimensionalTree<E>;
}

export const AsynchronousKDimensionalTree = createTreeConstructor("AsynchronousKDimensionalTree", true, "KDimensionalTree") as unknown as AsynchronousKDimensionalTreeConstructor;
