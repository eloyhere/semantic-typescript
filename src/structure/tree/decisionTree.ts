import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousTree, AsynchronousTree } from "#semantic/structure/tree/base";

/**
 * Synchronous decision tree: an edge-labelled tree that alternates test
 * branches with prediction leaves.
 *
 * Construction requires `options.testOf`, `options.predictionOf` and
 * `options.labelOf`. An internal node must own a test and no prediction; a leaf
 * must own a prediction and no test. `getEdges()` pairs each child with its
 * edge label, so a decision path is data rather than an embedded algorithm.
 *
 * @template E the element type stored at each decision node
 * @template T the test type attached to branch nodes
 * @template L the edge label type connecting a branch to its children
 */
export interface SynchronousDecisionTree<E = unknown, T = unknown, L = string> extends SynchronousTree<Nodes.DecisionNode<E, T, L>, E> {}

/**
 * Asynchronous decision tree: the same branch-test/leaf-prediction contract as
 * the synchronous decision tree, with promise-returning collection queries.
 *
 * Tests, predictions and edge labels are immutable once built; navigation and
 * traversal stay synchronous. An async element source is collected before the
 * branch/leaf validation runs, so a leaf cannot be observed before its
 * prediction callback has been applied.
 *
 * @template E the element type stored at each decision node
 * @template T the test type attached to branch nodes
 * @template L the edge label type connecting a branch to its children
 */
export interface AsynchronousDecisionTree<E = unknown, T = unknown, L = string> extends AsynchronousTree<Nodes.DecisionNode<E, T, L>, E> {}

/**
 * Constructs a `SynchronousDecisionTree` from elements plus decision
 * callbacks.
 *
 * `testOf`, `predictionOf` and `labelOf` are mandatory for a nonempty tree,
 * and `parentOf` or `childrenOf` must describe the topology. The builder
 * enforces the branch/leaf split and rejects a node that has both a test and a
 * prediction, or neither.
 */
export interface SynchronousDecisionTreeConstructor {
    new <E = unknown, T = unknown, L = string>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.DecisionNode<E, T, L>>): SynchronousDecisionTree<E, T, L>;
}

export const SynchronousDecisionTree = createTreeConstructor("SynchronousDecisionTree", false, "DecisionTree") as unknown as SynchronousDecisionTreeConstructor;

/**
 * Constructs an `AsynchronousDecisionTree`; the source may be synchronous or
 * asynchronous.
 *
 * The decision callbacks and topology requirements are unchanged. Because the
 * branch/leaf rule is checked per node against its child count, an async source
 * is fully drained before validation so a later child cannot invalidate an
 * earlier classification.
 */
export interface AsynchronousDecisionTreeConstructor {
    new <E = unknown, T = unknown, L = string>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.DecisionNode<E, T, L>>): AsynchronousDecisionTree<E, T, L>;
}

export const AsynchronousDecisionTree = createTreeConstructor("AsynchronousDecisionTree", true, "DecisionTree") as unknown as AsynchronousDecisionTreeConstructor;
