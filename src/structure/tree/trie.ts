import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

// 35–39. Trie nodes retain edge labels and suffix-source spans.
/**
 * Synchronous trie: a prefix tree whose edges are labelled by individual
 * symbols and whose terminal nodes store values.
 *
 * Bulk construction inserts each string key symbol by symbol, sharing existing
 * prefixes and marking the final node terminal; a terminal may still have
 * children, so one key can be a prefix of another. `getEdges()` exposes edge
 * labels and children, and duplicate keys are rejected because a terminal holds
 * one value.
 *
 * @template V the value stored at terminal nodes
 * @template S the symbol type of an edge label
 */
export interface SynchronousTrie<V = unknown, S = string> extends SynchronousTree<Nodes.TrieNode<V, S>, V> {}

/**
 * Asynchronous trie: the same symbol-labelled edges and terminal-value
 * contract as the synchronous trie, with promise-returning collection queries.
 *
 * Prefix sharing is decided during construction and the edge map is fixed
 * afterwards, so traversal never sees a partially inserted key. An async
 * element source is drained before insertion starts.
 *
 * @template V the value stored at terminal nodes
 * @template S the symbol type of an edge label
 */
export interface AsynchronousTrie<V = unknown, S = string> extends AsynchronousTree<Nodes.TrieNode<V, S>, V> {}

/**
 * Constructs a `SynchronousTrie` from optional synchronous values.
 *
 * `options.keyOf` must return a string key, or the elements themselves must be
 * strings; duplicate keys are rejected. The generic overload accepts a custom
 * symbol type and requires `options.buildNodes`; the element overload uses
 * string labels.
 */
export interface SynchronousTrieConstructor {
    new <V, S>(source: Iterable<V> | undefined, options: TreeOptions<V, Nodes.TrieNode<V, S>> & { buildNodes: (elements: readonly V[]) => readonly Nodes.TrieNode<V, S>[] }): SynchronousTrie<V, S>;
    new <V = unknown>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.TrieNode<V, string>>): SynchronousTrie<V, string>;
}

export const SynchronousTrie = createTreeConstructor("SynchronousTrie", false, "Trie") as unknown as SynchronousTrieConstructor;

/**
 * Constructs an `AsynchronousTrie`; the source may be synchronous or
 * asynchronous.
 *
 * Key extraction, duplicate rejection and the custom-symbol overload match the
 * synchronous constructor. An async source is fully collected before prefix
 * insertion, so shared prefixes are built from the complete key set.
 */
export interface AsynchronousTrieConstructor {
    new <V, S>(source: Iterable<V> | AsyncIterable<V> | undefined, options: TreeOptions<V, Nodes.TrieNode<V, S>> & { buildNodes: (elements: readonly V[]) => readonly Nodes.TrieNode<V, S>[] }): AsynchronousTrie<V, S>;
    new <V = unknown>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.TrieNode<V, string>>): AsynchronousTrie<V, string>;
}

export const AsynchronousTrie = createTreeConstructor("AsynchronousTrie", true, "Trie") as unknown as AsynchronousTrieConstructor;
