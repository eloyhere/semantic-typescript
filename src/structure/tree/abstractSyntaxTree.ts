import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

export interface SynchronousAbstractSyntaxTree<E = unknown, K = string> extends SynchronousRootedTree<E, Nodes.ASTNode<E, K>> {}

export interface AsynchronousAbstractSyntaxTree<E = unknown, K = string> extends AsynchronousRootedTree<E, Nodes.ASTNode<E, K>> {}

export interface SynchronousAbstractSyntaxTreeConstructor {
    new <E = unknown, K = string>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.ASTNode<E, K>>): SynchronousAbstractSyntaxTree<E, K>;
}

export const SynchronousAbstractSyntaxTree = createTreeConstructor("SynchronousAbstractSyntaxTree", false, "AbstractSyntaxTree") as unknown as SynchronousAbstractSyntaxTreeConstructor;

export interface AsynchronousAbstractSyntaxTreeConstructor {
    new <E = unknown, K = string>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.ASTNode<E, K>>): AsynchronousAbstractSyntaxTree<E, K>;
}

export const AsynchronousAbstractSyntaxTree = createTreeConstructor("AsynchronousAbstractSyntaxTree", true, "AbstractSyntaxTree") as unknown as AsynchronousAbstractSyntaxTreeConstructor;
