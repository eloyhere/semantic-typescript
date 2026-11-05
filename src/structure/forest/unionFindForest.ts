import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousForest, AsynchronousForest } from "#semantic/structure/tree/base";

/**
 * Synchronous union-find forest: disjoint sets represented as
 * representative-parent trees, with one root per set.
 *
 * This is a different contract from `RootedForest`. A rooted forest stores
 * several disjoint trees and hands their roots out directly, whereas a
 * union-find forest stores elements whose representative-parent links define
 * the sets. Its dynamic operations are `find` (walk to the set representative)
 * and `union` (link two representatives, typically merging by rank), not
 * "take a tree out of the forest"; path compression may rewrite parent links
 * during later finds, which no forest-level tree selection would do.
 *
 * Bulk construction initialises every element as a singleton: its stored parent
 * is itself, `ancestor()` is empty, `getRank()` is 0 and the set size is 1. No
 * union, path compression or rank merge is applied, because those are dynamic
 * operations; navigation follows the current representative forest and never
 * traverses the self-parent loop.
 *
 * @template E the element type held by each singleton set
 */
export interface SynchronousUnionFindForest<E = unknown> extends SynchronousForest<Nodes.UnionFindNode<E>, E> {}

/**
 * Asynchronous union-find forest: the same singleton representative-parent
 * contract as the synchronous forest, with `getRoots()` returning a promise.
 *
 * Every element starts as its own representative and `ancestor()` stays empty;
 * the forest becomes observable only after the complete element set is read,
 * and node navigation remains synchronous. Collection mutations are queued and
 * committed in invocation order, so a read issued after an earlier write
 * observes that write once its own promise settles. No union or compression
 * step is replayed by queries. As in `SynchronousUnionFindForest`, `find` and
 * `union` are the dynamic disjoint-set operations; they are not the same thing
 * as listing the roots of a rooted forest.
 *
 * @template E the element type held by each singleton set
 */
export interface AsynchronousUnionFindForest<E = unknown> extends AsynchronousForest<Nodes.UnionFindNode<E>, E> {}

/**
 * Constructor contract for `SynchronousUnionFindForest`, and the type of the
 * `SynchronousUnionFindForest` value export.
 *
 * The builder produces only singleton sets: each element becomes a root with
 * rank 0 and set size 1. `options.buildNodes` may supply pre-unioned trees,
 * including representative parents that differ from the element itself. This is
 * the synchronous counterpart of `AsynchronousUnionFindForestConstructor`; the
 * roots are available as soon as `new` returns.
 *
 * @template E the element type accepted from the source
 */
export interface SynchronousUnionFindForestConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.UnionFindNode<E>>): SynchronousUnionFindForest<E>;
}

export const SynchronousUnionFindForest = createTreeConstructor("SynchronousUnionFindForest", false, "UnionFindForest") as unknown as SynchronousUnionFindForestConstructor;

/**
 * Constructor contract for `AsynchronousUnionFindForest`, and the type of the
 * `AsynchronousUnionFindForest` value export.
 *
 * Singleton initialisation matches the synchronous constructor, and the source
 * may be synchronous or asynchronous. An async source is drained before the
 * roots are listed, so `getRoots()` reflects the complete element set; writes
 * issued before that point are queued in call order, and a later read observes
 * them once its promise settles.
 *
 * @template E the element type accepted from the source
 */
export interface AsynchronousUnionFindForestConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.UnionFindNode<E>>): AsynchronousUnionFindForest<E>;
}

export const AsynchronousUnionFindForest = createTreeConstructor("AsynchronousUnionFindForest", true, "UnionFindForest") as unknown as AsynchronousUnionFindForestConstructor;
