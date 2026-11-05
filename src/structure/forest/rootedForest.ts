import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousForest, AsynchronousForest } from "#semantic/structure/tree/base";

/**
 * Synchronous rooted-forest contract: a collection of elements arranged as
 * several mutually disjoint trees, each exposed through `getRoots()`.
 *
 * This is the "rooted" forest of the family. Unlike a single-rooted tree it has
 * no synthetic common parent: the roots are the stored components themselves, a
 * depth-first traversal finishes one component before the next in root order,
 * breadth-first interleaves components by structural depth, and `size()` counts
 * elements across every component. `getRoots()` therefore returns the trees held
 * by the forest; that is not the union-find `find`/`union` operation (see
 * `UnionFindForest`, whose components are representative-parent sets rather
 * than trees chosen from the container).
 *
 * @template E the element type stored by each tree node
 * @template N the tree-node contract used by navigation; defaults to
 * `Nodes.TreeNode<E>` and is narrowed by binary, heap and graph-result families
 */
export interface SynchronousRootedForest<E = unknown, N extends Nodes.TreeNode<E> = Nodes.TreeNode<E>>
    extends SynchronousForest<N, E> {
    getRoots(): ReadonlyArray<N>;
}

/**
 * Asynchronous rooted forest: the same element-bearing, disjoint-root contract
 * as `SynchronousRootedForest`, but `getRoots()` and every collection query
 * settle through a promise.
 *
 * Child arrays retain node order, and each root is an ordinary `TreeNode`
 * without a synthetic parent. Collection mutations such as `add`, `remove`,
 * `clear` and `setElement` are queued and committed in invocation order, so a
 * read issued after an earlier write observes that write once its own promise
 * settles. An async source is materialised before roots are built, so the
 * reported root set is complete from the first query, while node navigation
 * stays synchronous.
 *
 * @template E the element type stored by each tree node
 * @template N the tree-node contract used by navigation; defaults to
 * `Nodes.TreeNode<E>`
 */
export interface AsynchronousRootedForest<E = unknown, N extends Nodes.TreeNode<E> = Nodes.TreeNode<E>>
    extends AsynchronousForest<N, E> {}

/**
 * Constructor contract for `SynchronousRootedForest`, and the type of the
 * `SynchronousRootedForest` value export.
 *
 * The generic overload takes a `TreeNode` subtype and requires
 * `options.buildNodes`; the element overload uses `Nodes.TreeNode` and the
 * default layout. The builder may return multiple roots, which become the
 * disjoint components of the forest. Because construction is synchronous, the
 * roots are available as soon as `new` returns; the asynchronous counterpart is
 * `AsynchronousRootedForestConstructor`.
 *
 * @template E the element type accepted from the source
 * @template N the tree-node contract produced by `options.buildNodes`
 */
export interface SynchronousRootedForestConstructor {
    new <E, N extends Nodes.TreeNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousRootedForest<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.TreeNode<E>>): SynchronousRootedForest<E>;
}

export const SynchronousRootedForest = createTreeConstructor("SynchronousRootedForest", false, "RootedForest") as unknown as SynchronousRootedForestConstructor;

/**
 * Constructor contract for `AsynchronousRootedForest`, and the type of the
 * `AsynchronousRootedForest` value export.
 *
 * The source may be synchronous or asynchronous. The generic overload still
 * requires `options.buildNodes`, and a builder may return several `TreeNode`
 * roots. For an async source the forest is assembled only after the iterable
 * completes, and `getRoots()` awaits that readiness. Writes issued during that
 * window are queued behind initialisation, so their order relative to later
 * reads is preserved.
 *
 * @template E the element type accepted from the source
 * @template N the tree-node contract produced by `options.buildNodes`
 */
export interface AsynchronousRootedForestConstructor {
    new <E, N extends Nodes.TreeNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousRootedForest<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.TreeNode<E>>): AsynchronousRootedForest<E>;
}

export const AsynchronousRootedForest = createTreeConstructor("AsynchronousRootedForest", true, "RootedForest") as unknown as AsynchronousRootedForestConstructor;
