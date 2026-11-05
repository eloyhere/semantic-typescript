import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousForest, AsynchronousForest } from "#semantic/structure/tree/base";

/**
 * Synchronous link-cut forest: every element is a node of an auxiliary splay
 * tree, while represented-tree edges are kept apart as path-parent links.
 *
 * Bulk construction starts from singleton preferred paths: no auxiliary parent
 * or children, `isReversed()` false, and an empty pending update. When
 * `options.parentOf` or `options.childrenOf` is supplied, the parent edge
 * becomes `getPathParent()`; no splay operation is replayed, so each aggregate
 * is computed from that node's own element only.
 *
 * @template E the element type stored at each represented vertex
 * @template A the aggregate type maintained for a preferred path
 * @template U the pending-update tag type
 */
export interface SynchronousLinkCutTree<E = unknown, A = E, U = never> extends SynchronousForest<Nodes.LinkCutNode<E, A, U>, E> {}

/**
 * Asynchronous link-cut forest: the same auxiliary-splay/path-parent split as
 * the synchronous link-cut tree, with `getRoots()` and collection queries
 * returning promises.
 *
 * Preferred paths remain singleton after construction, and the path-parent
 * links derived from the optional topology are not navigated. An async source
 * is collected before those links are attached, so auxiliary and represented
 * edges stay distinct.
 *
 * @template E the element type stored at each represented vertex
 * @template A the aggregate type maintained for a preferred path
 * @template U the pending-update tag type
 */
export interface AsynchronousLinkCutTree<E = unknown, A = E, U = never> extends AsynchronousForest<Nodes.LinkCutNode<E, A, U>, E> {}

/**
 * Constructs a `SynchronousLinkCutTree` from an optional synchronous source.
 *
 * The builder creates one auxiliary splay node per element and, when
 * `options.parentOf` or `options.childrenOf` is present, attaches represented
 * parent edges as path-parent links. Aggregates use `options.aggregate` or
 * `options.combine`; `options.buildNodes` may replace the forest.
 */
export interface SynchronousLinkCutTreeConstructor {
    new <E = unknown, A = E, U = never>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.LinkCutNode<E, A, U>>): SynchronousLinkCutTree<E, A, U>;
}

export const SynchronousLinkCutTree = createTreeConstructor("SynchronousLinkCutTree", false, "LinkCutTree") as unknown as SynchronousLinkCutTreeConstructor;

/**
 * Constructs an `AsynchronousLinkCutTree`; the source may be synchronous or
 * asynchronous.
 *
 * Singleton auxiliary nodes and the optional path-parent topology follow the
 * synchronous constructor. An async source is drained before links are
 * attached, so every node exists before any represented edge is interpreted.
 */
export interface AsynchronousLinkCutTreeConstructor {
    new <E = unknown, A = E, U = never>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.LinkCutNode<E, A, U>>): AsynchronousLinkCutTree<E, A, U>;
}

export const AsynchronousLinkCutTree = createTreeConstructor("AsynchronousLinkCutTree", true, "LinkCutTree") as unknown as AsynchronousLinkCutTreeConstructor;
