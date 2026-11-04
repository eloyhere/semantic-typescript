import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

export interface SynchronousCompressedTrie<V = unknown, S = string> extends SynchronousTree<Nodes.CompressedTrieNode<V, S>, V> {}

export interface AsynchronousCompressedTrie<V = unknown, S = string> extends AsynchronousTree<Nodes.CompressedTrieNode<V, S>, V> {}

export interface SynchronousCompressedTrieConstructor {
    new <V = unknown, S = string>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.CompressedTrieNode<V, S>>): SynchronousCompressedTrie<V, S>;
}

export const SynchronousCompressedTrie = createTreeConstructor("SynchronousCompressedTrie", false, "CompressedTrie") as unknown as SynchronousCompressedTrieConstructor;

export interface AsynchronousCompressedTrieConstructor {
    new <V = unknown, S = string>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.CompressedTrieNode<V, S>>): AsynchronousCompressedTrie<V, S>;
}

export const AsynchronousCompressedTrie = createTreeConstructor("AsynchronousCompressedTrie", true, "CompressedTrie") as unknown as AsynchronousCompressedTrieConstructor;
