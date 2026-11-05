import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

/**
 * Synchronous suffix tree: a compact trie of every suffix of an immutable
 * element sequence, built without adding an artificial terminator.
 *
 * Bulk construction inserts each suffix from the source sequence, contracts
 * chains whose node has no suffix start and exactly one outgoing edge, and
 * records each edge's incoming span plus a leaf's suffix start. Suffix links
 * are absent in this build, and navigation follows child edges only.
 */
export interface SynchronousSuffixTree extends SynchronousTree<Nodes.SuffixNode, unknown> {}

/**
 * Asynchronous suffix tree: the same compressed-suffix and incoming-span
 * contract as the synchronous suffix tree, with `root()` and collection queries
 * returning promises.
 *
 * The source sequence is immutable, so spans and suffix starts cannot shift
 * after construction. An async source is drained before suffix insertion, which
 * keeps every recorded position relative to one stable sequence.
 */
export interface AsynchronousSuffixTree extends AsynchronousTree<Nodes.SuffixNode, unknown> {}

/**
 * Constructs a `SynchronousSuffixTree` from an optional synchronous element
 * sequence.
 *
 * The source elements are treated as the immutable text, and no terminator
 * element is inserted. `options.buildNodes` may replace the compact suffix
 * topology, including its span and suffix-start metadata.
 */
export interface SynchronousSuffixTreeConstructor {
    new (source?: Iterable<unknown>, options?: TreeOptions<unknown, Nodes.SuffixNode>): SynchronousSuffixTree;
}

export const SynchronousSuffixTree = createTreeConstructor("SynchronousSuffixTree", false, "SuffixTree") as unknown as SynchronousSuffixTreeConstructor;

/**
 * Constructs an `AsynchronousSuffixTree`; the source may be synchronous or
 * asynchronous.
 *
 * The immutable-sequence rule and terminator-free build match the synchronous
 * constructor. An async source is collected into one sequence before any suffix
 * is inserted, so spans refer to final positions.
 */
export interface AsynchronousSuffixTreeConstructor {
    new (source?: Iterable<unknown> | AsyncIterable<unknown>, options?: TreeOptions<unknown, Nodes.SuffixNode>): AsynchronousSuffixTree;
}

export const AsynchronousSuffixTree = createTreeConstructor("AsynchronousSuffixTree", true, "SuffixTree") as unknown as AsynchronousSuffixTreeConstructor;
