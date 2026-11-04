import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

export interface SynchronousEulerTourTree<V = unknown, A = V> extends SynchronousBinaryTree<V, Nodes.EulerTourNode<V, A>> {}

export interface AsynchronousEulerTourTree<V = unknown, A = V> extends AsynchronousBinaryTree<V, Nodes.EulerTourNode<V, A>> {}

export interface SynchronousEulerTourTreeConstructor {
    new <V = unknown, A = V>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.EulerTourNode<V, A>>): SynchronousEulerTourTree<V, A>;
}

export const SynchronousEulerTourTree = createTreeConstructor("SynchronousEulerTourTree", false, "EulerTourTree") as unknown as SynchronousEulerTourTreeConstructor;

export interface AsynchronousEulerTourTreeConstructor {
    new <V = unknown, A = V>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.EulerTourNode<V, A>>): AsynchronousEulerTourTree<V, A>;
}

export const AsynchronousEulerTourTree = createTreeConstructor("AsynchronousEulerTourTree", true, "EulerTourTree") as unknown as AsynchronousEulerTourTreeConstructor;
