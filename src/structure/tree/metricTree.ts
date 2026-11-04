import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

export interface SynchronousMetricTree<E = unknown> extends SynchronousTree<Nodes.MTreeNode<E>, E> {}

export interface AsynchronousMetricTree<E = unknown> extends AsynchronousTree<Nodes.MTreeNode<E>, E> {}

export interface SynchronousMetricTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.MTreeNode<E>>): SynchronousMetricTree<E>;
}

export const SynchronousMetricTree = createTreeConstructor("SynchronousMetricTree", false, "MetricTree") as unknown as SynchronousMetricTreeConstructor;

export interface AsynchronousMetricTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.MTreeNode<E>>): AsynchronousMetricTree<E>;
}

export const AsynchronousMetricTree = createTreeConstructor("AsynchronousMetricTree", true, "MetricTree") as unknown as AsynchronousMetricTreeConstructor;
