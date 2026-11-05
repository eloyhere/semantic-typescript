import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

/**
 * Synchronous game tree: states are nodes, actions are labelled edges, and a
 * node may name the player to move and a numeric score.
 *
 * `playerOf`, `scoreOf` and `labelOf` are required; `probabilityOf` is
 * optional. A chance node must omit the player and its outgoing probabilities
 * must lie in [0, 1] and sum to one, while ordinary move nodes carry no
 * probabilities. `getMoves()` returns each action with its optional
 * probability.
 *
 * @template S the state type stored at each game node
 * @template A the action type labelling a move edge
 */
export interface SynchronousGameTree<S = unknown, A = unknown> extends SynchronousTree<Nodes.GameNode<S, A>, S> {}

/**
 * Asynchronous game tree: the same state/move/probability contract as the
 * synchronous game tree, with promise-returning collection queries.
 *
 * Players, scores and move probabilities are fixed at construction; traversal
 * only follows the move edges. An async source is drained before the
 * chance-node sum check, because that rule needs every outgoing move at once.
 *
 * @template S the state type stored at each game node
 * @template A the action type labelling a move edge
 */
export interface AsynchronousGameTree<S = unknown, A = unknown> extends AsynchronousTree<Nodes.GameNode<S, A>, S> {}

/**
 * Constructs a `SynchronousGameTree` from states plus game callbacks.
 *
 * `playerOf`, `scoreOf`, `labelOf` and a topology callback are mandatory for a
 * nonempty tree; `probabilityOf` may add chance moves. Scores must be finite,
 * and a chance node must have no player and probabilities summing to one.
 */
export interface SynchronousGameTreeConstructor {
    new <S = unknown, A = unknown>(source?: Iterable<S>, options?: TreeOptions<S, Nodes.GameNode<S, A>>): SynchronousGameTree<S, A>;
}

export const SynchronousGameTree = createTreeConstructor("SynchronousGameTree", false, "GameTree") as unknown as SynchronousGameTreeConstructor;

/**
 * Constructs an `AsynchronousGameTree`; the source may be synchronous or
 * asynchronous.
 *
 * The same callbacks, finite-score rule and chance-node probability sum apply.
 * An async source is collected before validation, so probabilities are summed
 * over the final move set rather than over a partial one.
 */
export interface AsynchronousGameTreeConstructor {
    new <S = unknown, A = unknown>(source?: Iterable<S> | AsyncIterable<S>, options?: TreeOptions<S, Nodes.GameNode<S, A>>): AsynchronousGameTree<S, A>;
}

export const AsynchronousGameTree = createTreeConstructor("AsynchronousGameTree", true, "GameTree") as unknown as AsynchronousGameTreeConstructor;
