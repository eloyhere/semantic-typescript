import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinaryTree, AsynchronousBinaryTree } from "#semantic/structure/tree/binaryTree";

/**
 * Synchronous threaded binary tree: a binary tree whose empty left/right links
 * become threads to the in-order predecessor and successor.
 *
 * Bulk construction fills the implicit binary layout, then walks the in-order
 * sequence to connect predecessor/successor threads. `getLeftLink()` and
 * `getRightLink()` report "child", "thread" or "empty"; traversal still follows
 * structural left/root/right slots and never treats a thread as a child edge.
 *
 * @template E the element type stored in the tree
 */
export interface SynchronousThreadedBinaryTree<E = unknown> extends SynchronousBinaryTree<E, Nodes.ThreadedBinaryNode<E>> {}

/**
 * Asynchronous threaded binary tree: the same child-or-thread link contract as
 * the synchronous threaded tree, with promise-returning collection queries.
 *
 * Threads are installed once from the in-order sequence and are not navigated
 * as structural children. An async source is drained before the thread pass
 * runs, so predecessor/successor links reflect the final element order.
 *
 * @template E the element type stored in the tree
 */
export interface AsynchronousThreadedBinaryTree<E = unknown> extends AsynchronousBinaryTree<E, Nodes.ThreadedBinaryNode<E>> {}

/**
 * Constructs a `SynchronousThreadedBinaryTree` from an optional synchronous
 * source.
 *
 * Elements are placed in the implicit binary layout and then threaded in
 * in-order. `options.buildNodes` may replace the shape, but the supplied nodes
 * must expose consistent child/thread/empty links.
 */
export interface SynchronousThreadedBinaryTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.ThreadedBinaryNode<E>>): SynchronousThreadedBinaryTree<E>;
}

export const SynchronousThreadedBinaryTree = createTreeConstructor("SynchronousThreadedBinaryTree", false, "ThreadedBinaryTree") as unknown as SynchronousThreadedBinaryTreeConstructor;

/**
 * Constructs an `AsynchronousThreadedBinaryTree`; the source may be synchronous
 * or asynchronous.
 *
 * Layout and in-order threading match the synchronous constructor. An async
 * source is fully collected before threads are linked, so no predecessor link
 * points at a provisional position.
 */
export interface AsynchronousThreadedBinaryTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.ThreadedBinaryNode<E>>): AsynchronousThreadedBinaryTree<E>;
}

export const AsynchronousThreadedBinaryTree = createTreeConstructor("AsynchronousThreadedBinaryTree", true, "ThreadedBinaryTree") as unknown as AsynchronousThreadedBinaryTreeConstructor;
