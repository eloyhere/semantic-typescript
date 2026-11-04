import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousBinarySearchTree, AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

export interface SynchronousAdelsonVelskyLandisTree<E = unknown> extends SynchronousBinarySearchTree<E, Nodes.AVLNode<E>> {}

export interface AsynchronousAdelsonVelskyLandisTree<E = unknown> extends AsynchronousBinarySearchTree<E, Nodes.AVLNode<E>> {}

export interface SynchronousAdelsonVelskyLandisTreeConstructor {
    new <E = unknown>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.AVLNode<E>>): SynchronousAdelsonVelskyLandisTree<E>;
}

export const SynchronousAdelsonVelskyLandisTree = createTreeConstructor("SynchronousAdelsonVelskyLandisTree", false, "AdelsonVelskyLandisTree") as unknown as SynchronousAdelsonVelskyLandisTreeConstructor;

export interface AsynchronousAdelsonVelskyLandisTreeConstructor {
    new <E = unknown>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.AVLNode<E>>): AsynchronousAdelsonVelskyLandisTree<E>;
}

export const AsynchronousAdelsonVelskyLandisTree = createTreeConstructor("AsynchronousAdelsonVelskyLandisTree", true, "AdelsonVelskyLandisTree") as unknown as AsynchronousAdelsonVelskyLandisTreeConstructor;
