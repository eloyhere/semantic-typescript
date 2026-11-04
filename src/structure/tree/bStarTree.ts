import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousSearchTree, AsynchronousSearchTree } from "#semantic/structure/tree/searchTree";

export interface SynchronousBStarTree<K = unknown> extends SynchronousSearchTree<K, Nodes.BStarNode<K>> {}

export interface AsynchronousBStarTree<K = unknown> extends AsynchronousSearchTree<K, Nodes.BStarNode<K>> {}

export interface SynchronousBStarTreeConstructor {
    new <K = unknown>(source?: Iterable<K>, options?: TreeOptions<K, Nodes.BStarNode<K>>): SynchronousBStarTree<K>;
}

export const SynchronousBStarTree = createTreeConstructor("SynchronousBStarTree", false, "BStarTree") as unknown as SynchronousBStarTreeConstructor;

export interface AsynchronousBStarTreeConstructor {
    new <K = unknown>(source?: Iterable<K> | AsyncIterable<K>, options?: TreeOptions<K, Nodes.BStarNode<K>>): AsynchronousBStarTree<K>;
}

export const AsynchronousBStarTree = createTreeConstructor("AsynchronousBStarTree", true, "BStarTree") as unknown as AsynchronousBStarTreeConstructor;
