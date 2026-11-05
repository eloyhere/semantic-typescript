import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

/**
 * Synchronous ternary search tree: a string index whose nodes each own one
 * symbol and three ordered links: less, equal and greater.
 *
 * Bulk construction splits the key set by the median symbol at the current
 * depth; only the equal link advances the symbol position, while less and
 * greater stay at the same position. `isTerminal()` marks nodes that end a key,
 * and empty keys are rejected because they have no root symbol.
 *
 * @template V the value stored at a terminal node
 * @template S the symbol type compared at each node
 */
export interface SynchronousTernarySearchTree<V = unknown, S = string> extends SynchronousTree<Nodes.TernarySearchNode<V, S>, V> {}

/**
 * Asynchronous ternary search tree: the same three-way symbol comparison and
 * terminal marking as the synchronous ternary search tree, with promises on
 * collection queries.
 *
 * The per-node symbol and the less/equal/greater topology are fixed after
 * construction, so traversal never re-splits a symbol set. An async source is
 * drained before the median-symbol recursion starts.
 *
 * @template V the value stored at a terminal node
 * @template S the symbol type compared at each node
 */
export interface AsynchronousTernarySearchTree<V = unknown, S = string> extends AsynchronousTree<Nodes.TernarySearchNode<V, S>, V> {}

/**
 * Constructs a `SynchronousTernarySearchTree` from optional synchronous values.
 *
 * `options.keyOf` must return a nonempty string key for every element in a
 * nonempty tree; duplicate keys are rejected because a terminal stores one
 * value. `options.buildNodes` may provide a custom three-way topology.
 */
export interface SynchronousTernarySearchTreeConstructor {
    new <V = unknown, S = string>(source?: Iterable<V>, options?: TreeOptions<V, Nodes.TernarySearchNode<V, S>>): SynchronousTernarySearchTree<V, S>;
}

export const SynchronousTernarySearchTree = createTreeConstructor("SynchronousTernarySearchTree", false, "TernarySearchTree") as unknown as SynchronousTernarySearchTreeConstructor;

/**
 * Constructs an `AsynchronousTernarySearchTree`; the source may be synchronous
 * or asynchronous.
 *
 * Key extraction, empty-key rejection and duplicate handling match the
 * synchronous constructor. An async source is fully collected before symbols
 * are split, because the median symbol depends on the complete key set.
 */
export interface AsynchronousTernarySearchTreeConstructor {
    new <V = unknown, S = string>(source?: Iterable<V> | AsyncIterable<V>, options?: TreeOptions<V, Nodes.TernarySearchNode<V, S>>): AsynchronousTernarySearchTree<V, S>;
}

export const AsynchronousTernarySearchTree = createTreeConstructor("AsynchronousTernarySearchTree", true, "TernarySearchTree") as unknown as AsynchronousTernarySearchTreeConstructor;
