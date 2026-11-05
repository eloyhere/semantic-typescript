import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

/**
 * Synchronous winner tree: a binary tournament in which each internal node
 * retains the winning participant among its descendants.
 *
 * Bulk construction recursively splits the participant array at its midpoint,
 * compares the two subtree winners with `options.comparator`, and stores the
 * winner at `getWinner()`. Leaves identify input runs through `getRunIndex()`;
 * winner references are cross-links, while navigation follows the bracket.
 *
 * @template E the element type of a tournament participant
 */
export interface SynchronousWinnerTree<E = unknown> extends SynchronousTree<Nodes.WinnerNode<E>, E> {}

/**
 * Asynchronous winner tree: the same bracket-wide winner annotation as the
 * synchronous winner tree, with promise-returning collection queries.
 *
 * Winners are fixed after construction; the overall winner is not exposed as a
 * node property. An async source is collected before matches are resolved, so
 * no bracket node is compared against a partial participant list.
 *
 * @template E the element type of a tournament participant
 */
export interface AsynchronousWinnerTree<E = unknown> extends AsynchronousTree<Nodes.WinnerNode<E>, E> {}

/**
 * Constructs a `SynchronousWinnerTree` from an optional synchronous participant
 * sequence.
 *
 * The builder pairs subtree winners with `options.comparator` (default natural
 * primitive order) and records the winner at each internal node. The root's
 * winner is therefore the overall champion, and `getWinner()` never follows a
 * loser cross-link. `options.buildNodes` may supply a tournament bracket whose
 * winner references are already correct.
 */
export interface SynchronousWinnerTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.WinnerNode<E>>): SynchronousWinnerTree<E>;
}

export const SynchronousWinnerTree = createTreeConstructor("SynchronousWinnerTree", false, "WinnerTree") as unknown as SynchronousWinnerTreeConstructor;

/**
 * Constructs an `AsynchronousWinnerTree`; the source may be synchronous or
 * asynchronous.
 *
 * Comparator ordering and winner recording match the synchronous constructor.
 * An async source is materialised before the bracket is built, so every match
 * compares participants from the complete run set.
 */
export interface AsynchronousWinnerTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.WinnerNode<E>>): AsynchronousWinnerTree<E>;
}

export const AsynchronousWinnerTree = createTreeConstructor("AsynchronousWinnerTree", true, "WinnerTree") as unknown as AsynchronousWinnerTreeConstructor;
