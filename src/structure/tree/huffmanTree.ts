import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousFullBinaryTree, AsynchronousFullBinaryTree } from "#semantic/structure/tree/fullBinaryTree";

// 55–66. Dynamic-tree representations retain their distinct structural links.
// Link-cut forest roots are auxiliary splay roots. Euler-tour roots refer to
// sequence occurrences, and top-tree roots refer to cluster decompositions.
export interface SynchronousHuffmanTree<E = unknown> extends SynchronousFullBinaryTree<E, Nodes.HuffmanNode<E>> {}

export interface AsynchronousHuffmanTree<E = unknown> extends AsynchronousFullBinaryTree<E, Nodes.HuffmanNode<E>> {}

export interface SynchronousHuffmanTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.HuffmanNode<E>>): SynchronousHuffmanTree<E>;
}

export const SynchronousHuffmanTree = createTreeConstructor("SynchronousHuffmanTree", false, "HuffmanTree") as unknown as SynchronousHuffmanTreeConstructor;

export interface AsynchronousHuffmanTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.HuffmanNode<E>>): AsynchronousHuffmanTree<E>;
}

export const AsynchronousHuffmanTree = createTreeConstructor("AsynchronousHuffmanTree", true, "HuffmanTree") as unknown as AsynchronousHuffmanTreeConstructor;
