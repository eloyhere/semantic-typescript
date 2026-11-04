import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

export interface SynchronousSuffixTree extends SynchronousTree<Nodes.SuffixNode, unknown> {}

export interface AsynchronousSuffixTree extends AsynchronousTree<Nodes.SuffixNode, unknown> {}

export interface SynchronousSuffixTreeConstructor {
    new (source?: Iterable<unknown>, options?: TreeOptions<unknown, Nodes.SuffixNode>): SynchronousSuffixTree;
}

export const SynchronousSuffixTree = createTreeConstructor("SynchronousSuffixTree", false, "SuffixTree") as unknown as SynchronousSuffixTreeConstructor;

export interface AsynchronousSuffixTreeConstructor {
    new (source?: Iterable<unknown> | AsyncIterable<unknown>, options?: TreeOptions<unknown, Nodes.SuffixNode>): AsynchronousSuffixTree;
}

export const AsynchronousSuffixTree = createTreeConstructor("AsynchronousSuffixTree", true, "SuffixTree") as unknown as AsynchronousSuffixTreeConstructor;
