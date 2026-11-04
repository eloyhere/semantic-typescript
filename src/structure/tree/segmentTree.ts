import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

// 40–54. A logical Fenwick node denotes an array cell, not an allocated branch.
export interface SynchronousSegmentTree<A = unknown, U = never> extends SynchronousTree<Nodes.SegmentNode<A, U>, A> {}

export interface AsynchronousSegmentTree<A = unknown, U = never> extends AsynchronousTree<Nodes.SegmentNode<A, U>, A> {}

export interface SynchronousSegmentTreeConstructor {
    new <A = unknown, U = never>(source?: Iterable<A>, options?: TreeOptions<A, Nodes.SegmentNode<A, U>>): SynchronousSegmentTree<A, U>;
}

export const SynchronousSegmentTree = createTreeConstructor("SynchronousSegmentTree", false, "SegmentTree") as unknown as SynchronousSegmentTreeConstructor;

export interface AsynchronousSegmentTreeConstructor {
    new <A = unknown, U = never>(source?: Iterable<A> | AsyncIterable<A>, options?: TreeOptions<A, Nodes.SegmentNode<A, U>>): AsynchronousSegmentTree<A, U>;
}

export const AsynchronousSegmentTree = createTreeConstructor("AsynchronousSegmentTree", true, "SegmentTree") as unknown as AsynchronousSegmentTreeConstructor;
