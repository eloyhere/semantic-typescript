import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

/**
 * Synchronous compressed trie: a prefix index in which chains of
 * single-child, non-terminal nodes collapse into one edge labelled by a whole
 * symbol sequence.
 *
 * Bulk construction walks each string key symbol by symbol, then contracts
 * every non-terminal chain with exactly one outgoing edge. `isTerminal()`
 * marks nodes that end a key, and `getEdges()` reports `ReadonlyArray<S>`
 * labels, so the number of edges follows branching rather than key length.
 * Keys must be unique.
 *
 * @template V the value stored at terminal nodes
 * @template S the symbol type inside a compressed edge label
 */
export interface SynchronousCompressedTrie<V = unknown, S = string> extends SynchronousTree<Nodes.CompressedTrieNode<V, S>, V> {}

/**
 * Asynchronous compressed trie: the same contracted-prefix node contract as
 * the synchronous compressed trie, with promise-returning collection queries.
 *
 * The edge contraction is a build-time step, so traversal sees only the final
 * compressed labels. An async element source is drained before contraction,
 * which prevents a chain from being compressed around a key that has not
 * arrived yet.
 *
 * @template V the value stored at terminal nodes
 * @template S the symbol type inside a compressed edge label
 */
export interface AsynchronousCompressedTrie<V = unknown, S = string> extends AsynchronousTree<Nodes.CompressedTrieNode<V, S>, V> {}

/**
 * Constructs a `SynchronousCompressedTrie` from optional synchronous elements.
 *
 * Each element must yield a string key through `options.keyOf`, or be a string
 * itself; duplicate keys are rejected because a terminal holds one value.
 * `options.buildNodes` can supply a custom compressed topology, including a
 * caller-defined duplicate policy.
 */
export interface SynchronousCompressedTrieConstructor {
    new <V = unknown, S = string>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.CompressedTrieNode<V, S>>): SynchronousCompressedTrie<V, S>;
}

export const SynchronousCompressedTrie = createTreeConstructor("SynchronousCompressedTrie", false, "CompressedTrie") as unknown as SynchronousCompressedTrieConstructor;

/**
 * Constructs an `AsynchronousCompressedTrie`; the source may be synchronous or
 * asynchronous.
 *
 * Key extraction and duplicate rejection match the synchronous constructor.
 * For an async source the whole key set is collected before compression
 * starts, since contraction decisions depend on every sibling key.
 */
export interface AsynchronousCompressedTrieConstructor {
    new <V = unknown, S = string>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.CompressedTrieNode<V, S>>): AsynchronousCompressedTrie<V, S>;
}

export const AsynchronousCompressedTrie = createTreeConstructor("AsynchronousCompressedTrie", true, "CompressedTrie") as unknown as AsynchronousCompressedTrieConstructor;
