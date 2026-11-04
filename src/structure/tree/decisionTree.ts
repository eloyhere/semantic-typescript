import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

export interface SynchronousDecisionTree<E = unknown, T = unknown, L = string> extends SynchronousTree<Nodes.DecisionNode<E, T, L>, E> {}

export interface AsynchronousDecisionTree<E = unknown, T = unknown, L = string> extends AsynchronousTree<Nodes.DecisionNode<E, T, L>, E> {}

export interface SynchronousDecisionTreeConstructor {
    new <E = unknown, T = unknown, L = string>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.DecisionNode<E, T, L>>): SynchronousDecisionTree<E, T, L>;
}

export const SynchronousDecisionTree = createTreeConstructor("SynchronousDecisionTree", false, "DecisionTree") as unknown as SynchronousDecisionTreeConstructor;

export interface AsynchronousDecisionTreeConstructor {
    new <E = unknown, T = unknown, L = string>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.DecisionNode<E, T, L>>): AsynchronousDecisionTree<E, T, L>;
}

export const AsynchronousDecisionTree = createTreeConstructor("AsynchronousDecisionTree", true, "DecisionTree") as unknown as AsynchronousDecisionTreeConstructor;
