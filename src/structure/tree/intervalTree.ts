import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

export interface SynchronousIntervalTree<T = unknown, E = unknown> extends SynchronousBinarySearchTree<E, Nodes.IntervalNode<T, E>> {}

export interface AsynchronousIntervalTree<T = unknown, E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.IntervalNode<T, E>> {}

export interface SynchronousIntervalTreeConstructor {
    new <T, E>(source: Iterable<E> | undefined, options: TreeOptions<E, Nodes.IntervalNode<T, E>> & { buildNodes: (elements: readonly E[]) => readonly Nodes.IntervalNode<T, E>[] }): SynchronousIntervalTree<T, E>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.IntervalNode<number, E>>): SynchronousIntervalTree<number, E>;
}

export const SynchronousIntervalTree = createTreeConstructor("SynchronousIntervalTree", false, "IntervalTree") as unknown as SynchronousIntervalTreeConstructor;

export interface AsynchronousIntervalTreeConstructor {
    new <T, E>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, Nodes.IntervalNode<T, E>> & { buildNodes: (elements: readonly E[]) => readonly Nodes.IntervalNode<T, E>[] }): AsynchronousIntervalTree<T, E>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.IntervalNode<number, E>>): AsynchronousIntervalTree<number, E>;
}

export const AsynchronousIntervalTree = createTreeConstructor("AsynchronousIntervalTree", true, "IntervalTree") as unknown as AsynchronousIntervalTreeConstructor;
