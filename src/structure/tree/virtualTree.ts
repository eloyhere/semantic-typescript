import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

export interface SynchronousVirtualTree<V = unknown, W = bigint> extends SynchronousRootedTree<V, Nodes.VirtualNode<V, W>> {}

export interface AsynchronousVirtualTree<V = unknown, W = bigint> extends AsynchronousRootedTree<V, Nodes.VirtualNode<V, W>> {}

export interface SynchronousVirtualTreeConstructor {
    new <V = unknown, W = bigint>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.VirtualNode<V, W>>): SynchronousVirtualTree<V, W>;
}

export const SynchronousVirtualTree = createTreeConstructor("SynchronousVirtualTree", false, "VirtualTree") as unknown as SynchronousVirtualTreeConstructor;

export interface AsynchronousVirtualTreeConstructor {
    new <V = unknown, W = bigint>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.VirtualNode<V, W>>): AsynchronousVirtualTree<V, W>;
}

export const AsynchronousVirtualTree = createTreeConstructor("AsynchronousVirtualTree", true, "VirtualTree") as unknown as AsynchronousVirtualTreeConstructor;
