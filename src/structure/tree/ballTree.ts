import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

export interface SynchronousBallTree<E = unknown, P = ReadonlyArray<number>> extends SynchronousBinaryTree<E, Nodes.BallNode<E, P>> {}

export interface AsynchronousBallTree<E = unknown, P = ReadonlyArray<number>> extends AsynchronousBinaryTree<E, Nodes.BallNode<E, P>> {}

export interface SynchronousBallTreeConstructor {
    new <E, P>(source: Iterable<E> | undefined, options: TreeOptions<E, Nodes.BallNode<E, P>> & { buildNodes: (elements: readonly E[]) => readonly Nodes.BallNode<E, P>[] }): SynchronousBallTree<E, P>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.BallNode<E, ReadonlyArray<number>>>): SynchronousBallTree<E, ReadonlyArray<number>>;
}

export const SynchronousBallTree = createTreeConstructor("SynchronousBallTree", false, "BallTree") as unknown as SynchronousBallTreeConstructor;

export interface AsynchronousBallTreeConstructor {
    new <E, P>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, Nodes.BallNode<E, P>> & { buildNodes: (elements: readonly E[]) => readonly Nodes.BallNode<E, P>[] }): AsynchronousBallTree<E, P>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.BallNode<E, ReadonlyArray<number>>>): AsynchronousBallTree<E, ReadonlyArray<number>>;
}

export const AsynchronousBallTree = createTreeConstructor("AsynchronousBallTree", true, "BallTree") as unknown as AsynchronousBallTreeConstructor;
