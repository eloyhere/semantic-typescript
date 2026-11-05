import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

/**
 * Synchronous heavy-light decomposition tree: the original rooted tree
 * annotated with subtree sizes, heavy children, chain heads and heavy-first
 * positions.
 *
 * The builder assigns parents and children structurally, chooses the largest
 * child as `getHeavyChild()`, walks heavy edges first to assign `getPosition()`,
 * and stamps `getChainHead()` for every chain. Parent links remain the original
 * tree's, so a non-root node's chain head is not necessarily the tree root.
 *
 * @template E the element type stored at each tree vertex
 */
export interface SynchronousHeavyLightTree<E = unknown> extends SynchronousRootedTree<E, Nodes.HeavyLightNode<E>> {}

/**
 * Asynchronous heavy-light decomposition tree: the same chain-head,
 * heavy-child and heavy-first-position metadata as the synchronous
 * decomposition, with promise-returning collection queries.
 *
 * Decomposition metadata is computed once from the built tree and never
 * changes during traversal. An async source is drained before heavy children
 * are chosen, since the choice compares complete subtree sizes.
 *
 * @template E the element type stored at each tree vertex
 */
export interface AsynchronousHeavyLightTree<E = unknown> extends AsynchronousRootedTree<E, Nodes.HeavyLightNode<E>> {}

/**
 * Constructs a `SynchronousHeavyLightTree` from an optional synchronous source.
 *
 * The builder lays elements out as a rooted tree using the configured arity
 * (2 by default), then derives subtree sizes, heavy children, chain heads and
 * positions. `options.buildNodes` may replace the layout, but decomposition
 * metadata is then taken as supplied.
 */
export interface SynchronousHeavyLightTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.HeavyLightNode<E>>): SynchronousHeavyLightTree<E>;
}

export const SynchronousHeavyLightTree = createTreeConstructor("SynchronousHeavyLightTree", false, "HeavyLightTree") as unknown as SynchronousHeavyLightTreeConstructor;

/**
 * Constructs an `AsynchronousHeavyLightTree`; the source may be synchronous or
 * asynchronous.
 *
 * Layout arity and decomposition metadata follow the synchronous constructor.
 * For an async source the tree is materialised before heavy-child selection,
 * so no chain is computed from an incomplete subtree.
 */
export interface AsynchronousHeavyLightTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.HeavyLightNode<E>>): AsynchronousHeavyLightTree<E>;
}

export const AsynchronousHeavyLightTree = createTreeConstructor("AsynchronousHeavyLightTree", true, "HeavyLightTree") as unknown as AsynchronousHeavyLightTreeConstructor;
