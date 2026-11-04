import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

export interface SynchronousParseTree<E = unknown, S = string> extends SynchronousRootedTree<E, Nodes.ParseNode<E, S>> {}

export interface AsynchronousParseTree<E = unknown, S = string> extends AsynchronousRootedTree<E, Nodes.ParseNode<E, S>> {}

export interface SynchronousParseTreeConstructor {
    new <E = unknown, S = string>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.ParseNode<E, S>>): SynchronousParseTree<E, S>;
}

export const SynchronousParseTree = createTreeConstructor("SynchronousParseTree", false, "ParseTree") as unknown as SynchronousParseTreeConstructor;

export interface AsynchronousParseTreeConstructor {
    new <E = unknown, S = string>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.ParseNode<E, S>>): AsynchronousParseTree<E, S>;
}

export const AsynchronousParseTree = createTreeConstructor("AsynchronousParseTree", true, "ParseTree") as unknown as AsynchronousParseTreeConstructor;
