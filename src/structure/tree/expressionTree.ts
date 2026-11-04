import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

export interface SynchronousExpressionTree<E = unknown, O = string> extends SynchronousRootedTree<E, Nodes.ExpressionNode<E, O>> {}

export interface AsynchronousExpressionTree<E = unknown, O = string> extends AsynchronousRootedTree<E, Nodes.ExpressionNode<E, O>> {}

export interface SynchronousExpressionTreeConstructor {
    new <E = unknown, O = string>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.ExpressionNode<E, O>>): SynchronousExpressionTree<E, O>;
}

export const SynchronousExpressionTree = createTreeConstructor("SynchronousExpressionTree", false, "ExpressionTree") as unknown as SynchronousExpressionTreeConstructor;

export interface AsynchronousExpressionTreeConstructor {
    new <E = unknown, O = string>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.ExpressionNode<E, O>>): AsynchronousExpressionTree<E, O>;
}

export const AsynchronousExpressionTree = createTreeConstructor("AsynchronousExpressionTree", true, "ExpressionTree") as unknown as AsynchronousExpressionTreeConstructor;
