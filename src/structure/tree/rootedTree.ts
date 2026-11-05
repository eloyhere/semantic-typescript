import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

// 1–11. Shape hierarchy follows the corresponding node interfaces.
/**
 * Synchronous rooted tree: the element-bearing tree root contract, with one
 * optional root and `TreeNode`-based parent/children navigation.
 *
 * Bulk construction is the general n-ary layout: input order is preserved and
 * each parent receives up to `options.arity` children (2 by default). This is
 * the base that ordered, unordered, binary, search, heap and result-tree
 * families narrow; it implies no ordering beyond the structure itself.
 *
 * @template E the element type stored in the tree
 * @template N the tree-node contract used by navigation
 */
export interface SynchronousRootedTree<E = unknown, N extends Nodes.TreeNode<E> = Nodes.TreeNode<E>> extends SynchronousTree<N, E> {}

/**
 * Asynchronous rooted tree: the same single-root/parent-children contract as the
 * synchronous rooted tree, with `root()` and collection queries returning
 * promises.
 *
 * The builder and its arity layout are unchanged, and node navigation stays
 * synchronous. An async source is drained before the root is exposed, so a
 * query never sees a partially attached tree.
 *
 * @template E the element type stored in the tree
 * @template N the tree-node contract used by navigation
 */
export interface AsynchronousRootedTree<E = unknown, N extends Nodes.TreeNode<E> = Nodes.TreeNode<E>> extends AsynchronousTree<N, E> {}

/**
 * Constructs a `SynchronousRootedTree` from an optional synchronous source.
 *
 * The generic overload accepts a `TreeNode` subtype and requires
 * `options.buildNodes`; the element overload uses `Nodes.TreeNode`. The default
 * layout preserves input order and gives each parent up to `options.arity`
 * children.
 */
export interface SynchronousRootedTreeConstructor {
    new <E, N extends Nodes.TreeNode<E>>(source: Iterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): SynchronousRootedTree<E, N>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.TreeNode<E>>): SynchronousRootedTree<E>;
}

export const SynchronousRootedTree = createTreeConstructor("SynchronousRootedTree", false, "RootedTree") as unknown as SynchronousRootedTreeConstructor;

/**
 * Constructs an `AsynchronousRootedTree`; the source may be synchronous or
 * asynchronous.
 *
 * Custom-node construction still requires `options.buildNodes`, and the default
 * layout keeps input order with the configured arity. An async source delays
 * construction until the iterable completes, and `root()` waits on readiness.
 */
export interface AsynchronousRootedTreeConstructor {
    new <E, N extends Nodes.TreeNode<E>>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, N> & { buildNodes: (elements: readonly E[]) => readonly N[] }): AsynchronousRootedTree<E, N>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.TreeNode<E>>): AsynchronousRootedTree<E>;
}

export const AsynchronousRootedTree = createTreeConstructor("AsynchronousRootedTree", true, "RootedTree") as unknown as AsynchronousRootedTreeConstructor;
