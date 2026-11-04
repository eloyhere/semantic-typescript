import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

// 35–39. Trie nodes retain edge labels and suffix-source spans.
export interface SynchronousTrie<V = unknown, S = string> extends SynchronousTree<Nodes.TrieNode<V, S>, V> {}

export interface AsynchronousTrie<V = unknown, S = string> extends AsynchronousTree<Nodes.TrieNode<V, S>, V> {}

export interface SynchronousTrieConstructor {
    new <V, S>(source: Iterable<V> | undefined, options: TreeOptions<V, Nodes.TrieNode<V, S>> & { buildNodes: (elements: readonly V[]) => readonly Nodes.TrieNode<V, S>[] }): SynchronousTrie<V, S>;
    new <V = unknown>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.TrieNode<V, string>>): SynchronousTrie<V, string>;
}

export const SynchronousTrie = createTreeConstructor("SynchronousTrie", false, "Trie") as unknown as SynchronousTrieConstructor;

export interface AsynchronousTrieConstructor {
    new <V, S>(source: Iterable<V> | AsyncIterable<V> | undefined, options: TreeOptions<V, Nodes.TrieNode<V, S>> & { buildNodes: (elements: readonly V[]) => readonly Nodes.TrieNode<V, S>[] }): AsynchronousTrie<V, S>;
    new <V = unknown>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.TrieNode<V, string>>): AsynchronousTrie<V, string>;
}

export const AsynchronousTrie = createTreeConstructor("AsynchronousTrie", true, "Trie") as unknown as AsynchronousTrieConstructor;
