import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

/**
 * Synchronous bounding volume hierarchy: a binary tree in which every node
 * owns the bounding volume that encloses its whole subtree.
 *
 * Bulk construction takes the widest axis of the current union volume, sorts
 * boxes by center on that axis, and splits at the median until a leaf is
 * reached. Only leaves list objects; an internal node's `getElements()` is
 * empty, and every child volume is contained in its parent's volume.
 *
 * @template E the element type indexed by the hierarchy
 * @template B the bounding volume type returned by `getVolume()`
 */
export interface SynchronousBoundingVolumeHierarchy<E = unknown, B = Nodes.BoundingBox> extends SynchronousTree<Nodes.BVHNode<E, B>, E> {}

/**
 * Asynchronous bounding volume hierarchy: the same subtree-volume contract as
 * the synchronous hierarchy, with `root()` and collection queries returning
 * promises.
 *
 * Volumes and the binary partition are frozen after construction; navigation
 * and traversal stay synchronous. An async element source is collected before
 * the widest-axis split runs, so partial boxes never appear in the hierarchy.
 *
 * @template E the element type indexed by the hierarchy
 * @template B the bounding volume type returned by `getVolume()`
 */
export interface AsynchronousBoundingVolumeHierarchy<E = unknown, B = Nodes.BoundingBox> extends AsynchronousTree<Nodes.BVHNode<E, B>, E> {}

/**
 * Constructs a `SynchronousBoundingVolumeHierarchy` from objects with
 * bounding volumes.
 *
 * `options.boundsOf` is mandatory for a nonempty tree and must return finite,
 * equally dimensional minimum/maximum coordinates. The generic overload
 * accepts a custom volume type and requires `options.buildNodes`; the element
 * overload uses `Nodes.BoundingBox`.
 */
export interface SynchronousBoundingVolumeHierarchyConstructor {
    new <E, B>(source: Iterable<E> | undefined, options: TreeOptions<E, Nodes.BVHNode<E, B>> & { buildNodes: (elements: readonly E[]) => readonly Nodes.BVHNode<E, B>[] }): SynchronousBoundingVolumeHierarchy<E, B>;
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.BVHNode<E, Nodes.BoundingBox>>): SynchronousBoundingVolumeHierarchy<E, Nodes.BoundingBox>;
}

export const SynchronousBoundingVolumeHierarchy = createTreeConstructor("SynchronousBoundingVolumeHierarchy", false, "BoundingVolumeHierarchy") as unknown as SynchronousBoundingVolumeHierarchyConstructor;

/**
 * Constructs an `AsynchronousBoundingVolumeHierarchy`; the source may be
 * synchronous or asynchronous.
 *
 * The same `boundsOf` requirement and custom-volume `buildNodes` overload
 * apply. An async source is drained before the widest-axis partition starts,
 * so the hierarchy is assembled from the complete object set.
 */
export interface AsynchronousBoundingVolumeHierarchyConstructor {
    new <E, B>(source: Iterable<E> | AsyncIterable<E> | undefined, options: TreeOptions<E, Nodes.BVHNode<E, B>> & { buildNodes: (elements: readonly E[]) => readonly Nodes.BVHNode<E, B>[] }): AsynchronousBoundingVolumeHierarchy<E, B>;
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.BVHNode<E, Nodes.BoundingBox>>): AsynchronousBoundingVolumeHierarchy<E, Nodes.BoundingBox>;
}

export const AsynchronousBoundingVolumeHierarchy = createTreeConstructor("AsynchronousBoundingVolumeHierarchy", true, "BoundingVolumeHierarchy") as unknown as AsynchronousBoundingVolumeHierarchyConstructor;
