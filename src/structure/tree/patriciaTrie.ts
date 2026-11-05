import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

/**
 * Synchronous Patricia trie: a radix tree over the bits of UTF-16 code units,
 * with a presence bit that makes the encoding prefix-free.
 *
 * Bulk construction expands each string key into bits (a presence bit plus
 * sixteen bits per code unit, then a terminator) and branches at the first
 * differing bit. Internal nodes expose `getBitIndex()` and zero/one children;
 * only leaves store a key, and bit positions increase down a path.
 *
 * @template K the key type returned by `getKey()`
 * @template V the value stored at a leaf
 */
export interface SynchronousPatriciaTrie<K = unknown, V = unknown> extends SynchronousTree<Nodes.PatriciaNode<K, V>, V> {}

/**
 * Asynchronous Patricia trie: the same bit-indexed, prefix-free radix contract
 * as the synchronous Patricia trie, with promise-returning collection queries.
 *
 * Branch bits and leaf keys are fixed after construction; navigation follows
 * the zero/one links. An async element source is drained before bit expansion,
 * so a key cannot be split at a bit position that later shifts.
 *
 * @template K the key type returned by `getKey()`
 * @template V the value stored at a leaf
 */
export interface AsynchronousPatriciaTrie<K = unknown, V = unknown> extends AsynchronousTree<Nodes.PatriciaNode<K, V>, V> {}

/**
 * Constructs a `SynchronousPatriciaTrie` from optional synchronous values.
 *
 * `options.keyOf` must return a string key for a nonempty tree. The generic
 * overload accepts a custom key type and requires `options.buildNodes`; the
 * element overload uses string keys. Duplicate keys are rejected because a leaf
 * stores one value.
 */
export interface SynchronousPatriciaTrieConstructor {
    new <K, V>(source: Iterable<V> | undefined, options: TreeOptions<V, Nodes.PatriciaNode<K, V>> & { buildNodes: (elements: readonly V[]) => readonly Nodes.PatriciaNode<K, V>[] }): SynchronousPatriciaTrie<K, V>;
    new <V = unknown>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.PatriciaNode<string, V>>): SynchronousPatriciaTrie<string, V>;
}

export const SynchronousPatriciaTrie = createTreeConstructor("SynchronousPatriciaTrie", false, "PatriciaTrie") as unknown as SynchronousPatriciaTrieConstructor;

/**
 * Constructs an `AsynchronousPatriciaTrie`; the source may be synchronous or
 * asynchronous.
 *
 * String-key extraction and duplicate rejection match the synchronous
 * constructor. An async source is fully collected before the prefix tree is
 * built, since branch bits depend on the complete key set.
 */
export interface AsynchronousPatriciaTrieConstructor {
    new <K, V>(source: Iterable<V> | AsyncIterable<V> | undefined, options: TreeOptions<V, Nodes.PatriciaNode<K, V>> & { buildNodes: (elements: readonly V[]) => readonly Nodes.PatriciaNode<K, V>[] }): AsynchronousPatriciaTrie<K, V>;
    new <V = unknown>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.PatriciaNode<string, V>>): AsynchronousPatriciaTrie<string, V>;
}

export const AsynchronousPatriciaTrie = createTreeConstructor("AsynchronousPatriciaTrie", true, "PatriciaTrie") as unknown as AsynchronousPatriciaTrieConstructor;
