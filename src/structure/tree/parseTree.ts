import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

/**
 * Synchronous parse tree: a grammar-shaped tree whose nodes carry a grammar
 * symbol and, optionally, the source span they cover.
 *
 * `options.symbolOf` is mandatory for a nonempty tree; `options.spanOf` may add
 * a nonnegative half-open span. The topology comes from `options.parentOf` or
 * `options.childrenOf`, and `getSymbol()` keeps punctuation and production
 * structure that a later AST would discard.
 *
 * @template E the element type stored at a parse node
 * @template S the grammar symbol type returned by `getSymbol()`
 */
export interface SynchronousParseTree<E = unknown, S = string> extends SynchronousRootedTree<E, Nodes.ParseNode<E, S>> {}

/**
 * Asynchronous parse tree: the same symbol/span contract as the synchronous
 * parse tree, with promise-returning collection queries.
 *
 * Symbols are mandatory on every node, while spans remain optional metadata
 * that traversal does not interpret. An async source is drained before the
 * symbol check, so no node is validated against a provisional token sequence.
 *
 * @template E the element type stored at a parse node
 * @template S the grammar symbol type returned by `getSymbol()`
 */
export interface AsynchronousParseTree<E = unknown, S = string> extends AsynchronousRootedTree<E, Nodes.ParseNode<E, S>> {}

/**
 * Constructs a `SynchronousParseTree` from grammar elements plus topology.
 *
 * `options.symbolOf` is required for a nonempty tree and must not return
 * null/undefined; `options.spanOf` is optional but must produce nonnegative,
 * half-open spans. Unique elements and an acyclic, single-parent topology are
 * required.
 */
export interface SynchronousParseTreeConstructor {
    new <E = unknown, S = string>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.ParseNode<E, S>>): SynchronousParseTree<E, S>;
}

export const SynchronousParseTree = createTreeConstructor("SynchronousParseTree", false, "ParseTree") as unknown as SynchronousParseTreeConstructor;

/**
 * Constructs an `AsynchronousParseTree`; the source may be synchronous or
 * asynchronous.
 *
 * Symbol and span rules match the synchronous constructor. An async source is
 * collected before parsing structure is validated, so a node's symbol is
 * checked once its position in the final grammar tree is known.
 */
export interface AsynchronousParseTreeConstructor {
    new <E = unknown, S = string>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.ParseNode<E, S>>): AsynchronousParseTree<E, S>;
}

export const AsynchronousParseTree = createTreeConstructor("AsynchronousParseTree", true, "ParseTree") as unknown as AsynchronousParseTreeConstructor;
