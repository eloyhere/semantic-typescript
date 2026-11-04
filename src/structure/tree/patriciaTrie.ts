import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

export interface SynchronousPatriciaTrie<K = unknown, V = unknown> extends SynchronousTree<Nodes.PatriciaNode<K, V>, V> {}

export interface AsynchronousPatriciaTrie<K = unknown, V = unknown> extends AsynchronousTree<Nodes.PatriciaNode<K, V>, V> {}

export interface SynchronousPatriciaTrieConstructor {
    new <K, V>(source: Iterable<V> | undefined, options: TreeOptions<V, Nodes.PatriciaNode<K, V>> & { buildNodes: (elements: readonly V[]) => readonly Nodes.PatriciaNode<K, V>[] }): SynchronousPatriciaTrie<K, V>;
    new <V = unknown>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.PatriciaNode<string, V>>): SynchronousPatriciaTrie<string, V>;
}

export const SynchronousPatriciaTrie = createTreeConstructor("SynchronousPatriciaTrie", false, "PatriciaTrie") as unknown as SynchronousPatriciaTrieConstructor;

export interface AsynchronousPatriciaTrieConstructor {
    new <K, V>(source: Iterable<V> | AsyncIterable<V> | undefined, options: TreeOptions<V, Nodes.PatriciaNode<K, V>> & { buildNodes: (elements: readonly V[]) => readonly Nodes.PatriciaNode<K, V>[] }): AsynchronousPatriciaTrie<K, V>;
    new <V = unknown>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.PatriciaNode<string, V>>): AsynchronousPatriciaTrie<string, V>;
}

export const AsynchronousPatriciaTrie = createTreeConstructor("AsynchronousPatriciaTrie", true, "PatriciaTrie") as unknown as AsynchronousPatriciaTrieConstructor;
