import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

export interface SynchronousGameTree<S = unknown, A = unknown> extends SynchronousTree<Nodes.GameNode<S, A>, S> {}

export interface AsynchronousGameTree<S = unknown, A = unknown> extends AsynchronousTree<Nodes.GameNode<S, A>, S> {}

export interface SynchronousGameTreeConstructor {
    new <S = unknown, A = unknown>(source?: Iterable<S>, options?: TreeOptions<S, Nodes.GameNode<S, A>>): SynchronousGameTree<S, A>;
}

export const SynchronousGameTree = createTreeConstructor("SynchronousGameTree", false, "GameTree") as unknown as SynchronousGameTreeConstructor;

export interface AsynchronousGameTreeConstructor {
    new <S = unknown, A = unknown>(source?: Iterable<S> | AsyncIterable<S>, options?: TreeOptions<S, Nodes.GameNode<S, A>>): AsynchronousGameTree<S, A>;
}

export const AsynchronousGameTree = createTreeConstructor("AsynchronousGameTree", true, "GameTree") as unknown as AsynchronousGameTreeConstructor;
