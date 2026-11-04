import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

export interface SynchronousTopTree<V = unknown, A = unknown> extends SynchronousTree<Nodes.TopTreeNode<V, A>, V> {}

export interface AsynchronousTopTree<V = unknown, A = unknown> extends AsynchronousTree<Nodes.TopTreeNode<V, A>, V> {}

export interface SynchronousTopTreeConstructor {
    new <V = unknown, A = unknown>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.TopTreeNode<V, A>>): SynchronousTopTree<V, A>;
}

export const SynchronousTopTree = createTreeConstructor("SynchronousTopTree", false, "TopTree") as unknown as SynchronousTopTreeConstructor;

export interface AsynchronousTopTreeConstructor {
    new <V = unknown, A = unknown>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.TopTreeNode<V, A>>): AsynchronousTopTree<V, A>;
}

export const AsynchronousTopTree = createTreeConstructor("AsynchronousTopTree", true, "TopTree") as unknown as AsynchronousTopTreeConstructor;
