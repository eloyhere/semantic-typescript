import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousFullBinaryTree, AsynchronousFullBinaryTree } from "#semantic/structure/tree/fullBinaryTree";

// 55–66. Dynamic-tree representations retain their distinct structural links.
// Link-cut forest roots are auxiliary splay roots. Euler-tour roots refer to
// sequence occurrences, and top-tree roots refer to cluster decompositions.
/**
 * Synchronous Huffman tree: a full binary tree whose leaves hold symbols and
 * whose internal weight is the sum of its children's weights.
 *
 * Bulk construction repeatedly merges the two smallest weights reported by
 * `options.weightOf` until one root remains. Elements stay at leaves, internal
 * nodes hold no element, and `getWeight()` exposes each subtree's total weight
 * as a nonnegative bigint.
 *
 * @template E the symbol type stored at a leaf
 */
export interface SynchronousHuffmanTree<E = unknown> extends SynchronousFullBinaryTree<E, Nodes.HuffmanNode<E>> {}

/**
 * Asynchronous Huffman tree: the same leaf-symbol/accumulated-weight contract
 * as the synchronous Huffman tree, with promise-returning collection queries.
 *
 * The merge order is recomputed only during construction and is stable
 * afterwards; traversal reads the resulting full binary shape. An async source
 * is fully collected before merging, since each step needs the complete
 * remaining weight set.
 *
 * @template E the symbol type stored at a leaf
 */
export interface AsynchronousHuffmanTree<E = unknown> extends AsynchronousFullBinaryTree<E, Nodes.HuffmanNode<E>> {}

/**
 * Constructs a `SynchronousHuffmanTree` from an optional synchronous source.
 *
 * `options.weightOf` is mandatory for a nonempty tree and must return a
 * nonnegative bigint; the builder merges the two smallest weights repeatedly
 * until one root remains. `options.buildNodes` may supply a pre-built Huffman
 * shape instead.
 */
export interface SynchronousHuffmanTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.HuffmanNode<E>>): SynchronousHuffmanTree<E>;
}

export const SynchronousHuffmanTree = createTreeConstructor("SynchronousHuffmanTree", false, "HuffmanTree") as unknown as SynchronousHuffmanTreeConstructor;

/**
 * Constructs an `AsynchronousHuffmanTree`; the source may be synchronous or
 * asynchronous.
 *
 * Nonnegative bigint weights and pairwise smallest-first merging match the
 * synchronous constructor. An async source is drained before merging starts,
 * so the two smallest weights are always chosen from the full symbol set.
 */
export interface AsynchronousHuffmanTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.HuffmanNode<E>>): AsynchronousHuffmanTree<E>;
}

export const AsynchronousHuffmanTree = createTreeConstructor("AsynchronousHuffmanTree", true, "HuffmanTree") as unknown as AsynchronousHuffmanTreeConstructor;
