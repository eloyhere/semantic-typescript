import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

export interface SynchronousLoserTree<E = unknown> extends SynchronousTree<Nodes.LoserNode<E>, E> {}

export interface AsynchronousLoserTree<E = unknown> extends AsynchronousTree<Nodes.LoserNode<E>, E> {}

export interface SynchronousLoserTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.LoserNode<E>>): SynchronousLoserTree<E>;
}

export const SynchronousLoserTree = createTreeConstructor("SynchronousLoserTree", false, "LoserTree") as unknown as SynchronousLoserTreeConstructor;

export interface AsynchronousLoserTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.LoserNode<E>>): AsynchronousLoserTree<E>;
}

export const AsynchronousLoserTree = createTreeConstructor("AsynchronousLoserTree", true, "LoserTree") as unknown as AsynchronousLoserTreeConstructor;
