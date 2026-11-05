import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

/**
 * Synchronous abstract syntax tree: a rooted tree whose nodes carry a typed
 * syntax kind and, when available, the half-open source span they came from.
 *
 * The topology is supplied by `options.parentOf` or `options.childrenOf`, and
 * `options.kindOf` is mandatory for every element, so `getKind()` is never
 * absent. Compared with a parse tree, incidental grammar symbols are dropped
 * in favour of the AST kind; spans are metadata rather than structure.
 *
 * @template E the element type stored in each syntax node
 * @template K the syntax kind returned by `getKind()`
 */
export interface SynchronousAbstractSyntaxTree<E = unknown, K = string> extends SynchronousRootedTree<E, Nodes.ASTNode<E, K>> {}

/**
 * Asynchronous abstract syntax tree: the same kind/span node contract and
 * topology-driven build as the synchronous variant, with `root()` and the
 * collection queries returning promises.
 *
 * The syntax tree is fixed once built; navigation and the four traversals stay
 * synchronous, and an asynchronous element source is consumed before the first
 * query resolves. Kinds remain mandatory and spans optional.
 *
 * @template E the element type stored in each syntax node
 * @template K the syntax kind returned by `getKind()`
 */
export interface AsynchronousAbstractSyntaxTree<E = unknown, K = string> extends AsynchronousRootedTree<E, Nodes.ASTNode<E, K>> {}

/**
 * Constructs a `SynchronousAbstractSyntaxTree` from elements plus topology
 * callbacks.
 *
 * `options.kindOf` is required for a nonempty tree and must return a non-null
 * kind; `options.spanOf` may add a nonnegative, half-open span. At least one of
 * `options.parentOf` and `options.childrenOf` must describe the tree, elements
 * must be unique, and every node may have only one structural parent.
 */
export interface SynchronousAbstractSyntaxTreeConstructor {
    new <E = unknown, K = string>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.ASTNode<E, K>>): SynchronousAbstractSyntaxTree<E, K>;
}

export const SynchronousAbstractSyntaxTree = createTreeConstructor("SynchronousAbstractSyntaxTree", false, "AbstractSyntaxTree") as unknown as SynchronousAbstractSyntaxTreeConstructor;

/**
 * Constructs an `AsynchronousAbstractSyntaxTree`; the element source may be
 * synchronous or asynchronous.
 *
 * The synchronous constructor's requirements still hold: `kindOf` is
 * mandatory, `spanOf` optional, and `parentOf` or `childrenOf` must form an
 * acyclic forest with unique elements. The constructor returns before an async
 * source is drained, and queries wait on the readiness gate.
 */
export interface AsynchronousAbstractSyntaxTreeConstructor {
    new <E = unknown, K = string>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.ASTNode<E, K>>): AsynchronousAbstractSyntaxTree<E, K>;
}

export const AsynchronousAbstractSyntaxTree = createTreeConstructor("AsynchronousAbstractSyntaxTree", true, "AbstractSyntaxTree") as unknown as AsynchronousAbstractSyntaxTreeConstructor;
