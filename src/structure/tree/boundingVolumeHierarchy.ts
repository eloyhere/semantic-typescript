import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

export interface SynchronousBoundingVolumeHierarchy<E = unknown, B = Nodes.BoundingBox> extends SynchronousTree<Nodes.BVHNode<E, B>, E> {}

export interface AsynchronousBoundingVolumeHierarchy<E = unknown, B = Nodes.BoundingBox> extends AsynchronousTree<Nodes.BVHNode<E, B>, E> {}

export interface SynchronousBoundingVolumeHierarchyConstructor {
    new <E, B>(source: Iterable<E> | undefined, options: TreeOptions<E, Nodes.BVHNode<E, B>> & { buildNodes: (elements: readonly E[]) => readonly Nodes.BVHNode<E, B>[] }): SynchronousBoundingVolumeHierarchy<E, B>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.BVHNode<E, Nodes.BoundingBox>>): SynchronousBoundingVolumeHierarchy<E, Nodes.BoundingBox>;
}

export const SynchronousBoundingVolumeHierarchy = createTreeConstructor("SynchronousBoundingVolumeHierarchy", false, "BoundingVolumeHierarchy") as unknown as SynchronousBoundingVolumeHierarchyConstructor;

export interface AsynchronousBoundingVolumeHierarchyConstructor {
    new <E, B>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, Nodes.BVHNode<E, B>> & { buildNodes: (elements: readonly E[]) => readonly Nodes.BVHNode<E, B>[] }): AsynchronousBoundingVolumeHierarchy<E, B>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.BVHNode<E, Nodes.BoundingBox>>): AsynchronousBoundingVolumeHierarchy<E, Nodes.BoundingBox>;
}

export const AsynchronousBoundingVolumeHierarchy = createTreeConstructor("AsynchronousBoundingVolumeHierarchy", true, "BoundingVolumeHierarchy") as unknown as AsynchronousBoundingVolumeHierarchyConstructor;
