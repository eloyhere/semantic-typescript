import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

export interface SynchronousWeightBalancedTree<E = unknown> extends SynchronousBinarySearchTree<E, Nodes.WeightBalancedNode<E>> {}

export interface AsynchronousWeightBalancedTree<E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.WeightBalancedNode<E>> {}

export interface SynchronousWeightBalancedTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.WeightBalancedNode<E>>): SynchronousWeightBalancedTree<E>;
}

export const SynchronousWeightBalancedTree = createTreeConstructor("SynchronousWeightBalancedTree", false, "WeightBalancedTree") as unknown as SynchronousWeightBalancedTreeConstructor;

export interface AsynchronousWeightBalancedTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.WeightBalancedNode<E>>): AsynchronousWeightBalancedTree<E>;
}

export const AsynchronousWeightBalancedTree = createTreeConstructor("AsynchronousWeightBalancedTree", true, "WeightBalancedTree") as unknown as AsynchronousWeightBalancedTreeConstructor;
