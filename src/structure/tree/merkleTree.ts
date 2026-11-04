import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

export interface SynchronousMerkleTree<E = unknown, H = string> extends SynchronousRootedTree<E, Nodes.MerkleNode<E, H>> {}

export interface AsynchronousMerkleTree<E = unknown, H = string> extends AsynchronousRootedTree<E, Nodes.MerkleNode<E, H>> {}

export interface SynchronousMerkleTreeConstructor {
    new <E = unknown, H = string>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.MerkleNode<E, H>>): SynchronousMerkleTree<E, H>;
}

export const SynchronousMerkleTree = createTreeConstructor("SynchronousMerkleTree", false, "MerkleTree") as unknown as SynchronousMerkleTreeConstructor;

export interface AsynchronousMerkleTreeConstructor {
    new <E = unknown, H = string>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.MerkleNode<E, H>>): AsynchronousMerkleTree<E, H>;
}

export const AsynchronousMerkleTree = createTreeConstructor("AsynchronousMerkleTree", true, "MerkleTree") as unknown as AsynchronousMerkleTreeConstructor;
