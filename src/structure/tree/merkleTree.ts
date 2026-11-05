import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

/**
 * Synchronous Merkle tree: a hash tree in which every internal digest combines
 * the digests of its ordered children.
 *
 * `options.hash` is mandatory and receives a node's element (absent on
 * synthetic internal nodes) plus its children's digests. Without an explicit
 * topology the builder halves the element sequence into a balanced binary
 * tree; leaves hold elements, and each parent's digest covers its whole
 * subtree.
 *
 * @template E the element type stored at a leaf or supplied at a node
 * @template H the digest type returned by `getDigest()`
 */
export interface SynchronousMerkleTree<E = unknown, H = string> extends SynchronousRootedTree<E, Nodes.MerkleNode<E, H>> {}

/**
 * Asynchronous Merkle tree: the same child-digest composition as the
 * synchronous Merkle tree, with promise-returning collection queries.
 *
 * Digests are computed bottom-up once and never recomputed by reads. An async
 * element source is fully collected before hashing starts, because a parent
 * digest is a function of every descendant digest.
 *
 * @template E the element type stored at a leaf or supplied at a node
 * @template H the digest type returned by `getDigest()`
 */
export interface AsynchronousMerkleTree<E = unknown, H = string> extends AsynchronousRootedTree<E, Nodes.MerkleNode<E, H>> {}

/**
 * Constructs a `SynchronousMerkleTree` from an optional synchronous source.
 *
 * `options.hash` is mandatory for a nonempty tree. With `options.parentOf` or
 * `options.childrenOf` the digest follows the given topology; without either
 * the builder halves the element sequence into a balanced binary tree.
 * `options.buildNodes` may replace the whole hashing layout.
 */
export interface SynchronousMerkleTreeConstructor {
    new <E = unknown, H = string>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.MerkleNode<E, H>>): SynchronousMerkleTree<E, H>;
}

export const SynchronousMerkleTree = createTreeConstructor("SynchronousMerkleTree", false, "MerkleTree") as unknown as SynchronousMerkleTreeConstructor;

/**
 * Constructs an `AsynchronousMerkleTree`; the source may be synchronous or
 * asynchronous.
 *
 * The mandatory hash callback and the topology-or-halving rule match the
 * synchronous constructor. An async source is drained before the first digest
 * is computed, so parent digests never depend on a partially read element set.
 */
export interface AsynchronousMerkleTreeConstructor {
    new <E = unknown, H = string>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.MerkleNode<E, H>>): AsynchronousMerkleTree<E, H>;
}

export const AsynchronousMerkleTree = createTreeConstructor("AsynchronousMerkleTree", true, "MerkleTree") as unknown as AsynchronousMerkleTreeConstructor;
