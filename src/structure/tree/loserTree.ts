import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

/**
 * Synchronous loser tree: a binary tournament in which each internal node
 * stores the participant that lost the corresponding match.
 *
 * Bulk construction recursively splits the participant array at its midpoint,
 * compares the two subtree winners, and keeps the loser at `getLoser()`; leaves
 * identify input runs through `getRunIndex()`. Loser references are cross-links
 * rather than child edges, so navigation follows the tournament bracket only.
 *
 * @template E the element type of a tournament participant
 */
export interface SynchronousLoserTree<E = unknown> extends SynchronousTree<Nodes.LoserNode<E>, E> {}

/**
 * Asynchronous loser tree: the same match-loser annotation and bracket
 * navigation as the synchronous loser tree, with promise-returning collection
 * queries.
 *
 * The bracket and its loser references are fixed after construction; the
 * overall winner is not part of this node contract. An async source is
 * collected before matches are resolved, so no bracket node is compared twice.
 *
 * @template E the element type of a tournament participant
 */
export interface AsynchronousLoserTree<E = unknown> extends AsynchronousTree<Nodes.LoserNode<E>, E> {}

/**
 * Constructs a `SynchronousLoserTree` from an optional synchronous participant
 * sequence.
 *
 * The builder pairs subtree winners with `options.comparator` (default natural
 * primitive order) and records the loser at each internal node. The root keeps
 * the loser of the final match rather than the champion, so a reader must
 * follow the propagated winners to find the overall best participant.
 * `options.buildNodes` may supply a custom bracket whose loser references are
 * already correct.
 */
export interface SynchronousLoserTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.LoserNode<E>>): SynchronousLoserTree<E>;
}

export const SynchronousLoserTree = createTreeConstructor("SynchronousLoserTree", false, "LoserTree") as unknown as SynchronousLoserTreeConstructor;

/**
 * Constructs an `AsynchronousLoserTree`; the source may be synchronous or
 * asynchronous.
 *
 * Comparator ordering and loser recording match the synchronous constructor.
 * An async source is materialised before the bracket is built, so every match
 * compares participants from the complete run set.
 */
export interface AsynchronousLoserTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.LoserNode<E>>): AsynchronousLoserTree<E>;
}

export const AsynchronousLoserTree = createTreeConstructor("AsynchronousLoserTree", true, "LoserTree") as unknown as AsynchronousLoserTreeConstructor;
