import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

export interface SynchronousLeftistTree<E = unknown> extends SynchronousBinaryTree<E, Nodes.LeftistNode<E>> {}

export interface AsynchronousLeftistTree<E = unknown> extends AsynchronousBinaryTree<E, Nodes.LeftistNode<E>> {}

export interface SynchronousLeftistTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.LeftistNode<E>>): SynchronousLeftistTree<E>;
}

export const SynchronousLeftistTree = createTreeConstructor("SynchronousLeftistTree", false, "LeftistTree") as unknown as SynchronousLeftistTreeConstructor;

export interface AsynchronousLeftistTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.LeftistNode<E>>): AsynchronousLeftistTree<E>;
}

export const AsynchronousLeftistTree = createTreeConstructor("AsynchronousLeftistTree", true, "LeftistTree") as unknown as AsynchronousLeftistTreeConstructor;
