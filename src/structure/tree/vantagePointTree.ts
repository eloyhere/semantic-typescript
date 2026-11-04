import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

export interface SynchronousVantagePointTree<E = unknown> extends SynchronousBinaryTree<E, Nodes.VPNode<E>> {}

export interface AsynchronousVantagePointTree<E = unknown> extends AsynchronousBinaryTree<E, Nodes.VPNode<E>> {}

export interface SynchronousVantagePointTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.VPNode<E>>): SynchronousVantagePointTree<E>;
}

export const SynchronousVantagePointTree = createTreeConstructor("SynchronousVantagePointTree", false, "VantagePointTree") as unknown as SynchronousVantagePointTreeConstructor;

export interface AsynchronousVantagePointTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.VPNode<E>>): AsynchronousVantagePointTree<E>;
}

export const AsynchronousVantagePointTree = createTreeConstructor("AsynchronousVantagePointTree", true, "VantagePointTree") as unknown as AsynchronousVantagePointTreeConstructor;
