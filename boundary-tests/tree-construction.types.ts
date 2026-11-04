import {
    SynchronousTree, AsynchronousTree, SynchronousForest,
    SynchronousBinaryTree, AsynchronousBinaryTree, SynchronousRootedTree,
    SynchronousSearchTree, AsynchronousBPlusTree, SynchronousSegmentTree,
    SynchronousMerkleTree, SynchronousExpressionTree, SynchronousParseTree, SynchronousAbstractSyntaxTree,
    SynchronousDecisionTree, SynchronousShortestPathTree, SynchronousVirtualTree,
    SynchronousTrie, SynchronousPatriciaTrie, SynchronousIntervalTree,
    SynchronousBallTree, SynchronousBoundingVolumeHierarchy,
} from "#semantic/structure/tree/index";
import type { SynchronousCollection, AsynchronousCollection } from "#semantic/structure/collection";
import type * as Nodes from "#semantic/structure/node";
import type { TreeOptions } from "#semantic/structure/tree/options";

interface CustomNode extends Nodes.BinaryNode<number> {
    getApplicationTag(): "custom";
}
declare const roots: readonly CustomNode[];

/** Default constructors infer collection elements, while traversals expose nodes. */
export const inferred = new SynchronousBinaryTree([1, 2]);
export const explicit = new SynchronousBinaryTree<number>([1]);
export const collection: SynchronousCollection<number> = inferred;
export const traversals: Generator<Nodes.BinaryNode<number>, void, unknown>[] = [
    inferred.preorder(), inferred.inorder(), inferred.postorder(), inferred.breadthFirst(),
];
export class Derived extends SynchronousBinaryTree<number> {}
export class AsyncDerived extends AsynchronousBinaryTree<number> {}
export const asyncCollection: AsynchronousCollection<number> = new AsynchronousTree([1]);
export const baseCollection: SynchronousCollection<number> = new SynchronousTree([1]);
export const forestCollection: SynchronousCollection<number> = new SynchronousForest([1]);
export const custom = new SynchronousBinaryTree<number, CustomNode>([1], { buildNodes: () => roots });
export const inferredCustom = new SynchronousBinaryTree([1], { buildNodes: () => roots });
export const customTraversal: Generator<CustomNode, void, unknown> = inferredCustom.preorder();
export const customBase = new SynchronousTree<CustomNode>([1], { buildNodes: () => roots });
export const customAsync = new AsynchronousBinaryTree<number, CustomNode>([1], { buildNodes: () => roots });
export const customForest = new SynchronousForest<CustomNode>([1], { buildNodes: () => roots });
export class CustomDerived extends SynchronousBinaryTree<number, CustomNode> {}
// @ts-expect-error the default builder cannot promise an application-specific node.
export const forgedCustom = new SynchronousBinaryTree<number, CustomNode>([1]);
// @ts-expect-error supplying options without a builder cannot promise a custom node.
export const forgedCustomOptions = new SynchronousBinaryTree<number, CustomNode>([1], {});
// @ts-expect-error the base constructor also requires a builder for a custom node.
export const forgedBase = new SynchronousTree<CustomNode>([1]);
// @ts-expect-error rooted-tree default construction cannot promise a custom subtype.
export const forgedRooted = new SynchronousRootedTree<number, CustomNode>([1]);

/** Independent metadata parameters are validated against callback outputs. */
export const aggregates: TreeOptions<number, Nodes.EulerTourNode<number, string>> = {
    aggregate: values => values.join(","), combine: (left, right) => left + right,
};
export const optionalMetadata: TreeOptions<string, Nodes.ExpressionNode<string, boolean>> = { operatorOf: () => undefined };
export const defaultValueOf: TreeOptions<number, Nodes.EulerTourNode<number, string>> = { aggregate: values => values.join(",") };
export const explicitValueOf: TreeOptions<number, Nodes.EulerTourNode<number, string>> = { valueOf: value => String(value), combine: (left, right) => left + right };
// @ts-expect-error an aggregate callback must produce the declared aggregate type.
export const badAggregate: TreeOptions<number, Nodes.EulerTourNode<number, string>> = { aggregate: () => 1 };
// @ts-expect-error combine must preserve the declared aggregate type.
export const badCombine: TreeOptions<number, Nodes.LinkCutNode<number, string>> = { combine: () => 1 };
// @ts-expect-error a digest callback must produce the declared digest type.
export const badHash: TreeOptions<number, Nodes.MerkleNode<number, string>> = { hash: () => 1 };
// @ts-expect-error AST kinds must match the declared kind type.
export const badKind: TreeOptions<number, Nodes.ASTNode<number, string>> = { kindOf: () => 1 };
// @ts-expect-error Optional operator values are unwrapped before checking the callback.
export const badOperator: TreeOptions<number, Nodes.ExpressionNode<number, string>> = { operatorOf: () => 1 };
// @ts-expect-error parse symbols retain their declared type.
export const badSymbol: TreeOptions<number, Nodes.ParseNode<number, string>> = { symbolOf: () => 1 };
// @ts-expect-error interval endpoints retain their declared type.
export const badInterval: TreeOptions<string, Nodes.IntervalNode<number, string>> = { intervalOf: () => ({ start: "a", end: "b" }) };
// @ts-expect-error distances retain their independent weight type.
export const badDistance: TreeOptions<string, Nodes.ShortestPathNode<string, bigint>> = { distanceOf: () => 1 };
// @ts-expect-error incoming weights unwrap Optional and retain their type.
export const badIncoming: TreeOptions<string, Nodes.MinimumSpanningNode<string, bigint>> = { incomingWeightOf: () => 1 };
// @ts-expect-error path weights unwrap Optional and retain their type.
export const badPath: TreeOptions<string, Nodes.VirtualNode<string, bigint>> = { pathWeightOf: () => 1 };
// @ts-expect-error decision tests unwrap Optional and retain their type.
export const badTest: TreeOptions<number, Nodes.DecisionNode<number, boolean>> = { testOf: () => "yes" };
// @ts-expect-error decision labels are inferred from getEdges.
export const badLabel: TreeOptions<number, Nodes.DecisionNode<number, boolean, string>> = { labelOf: () => 1 };
// @ts-expect-error game actions are inferred from getMoves.
export const badAction: TreeOptions<number, Nodes.GameNode<number, string>> = { labelOf: () => 1 };

export const segment = new SynchronousSegmentTree<number>([1], { aggregate: values => values.length });
export const merkle = new SynchronousMerkleTree<number, string>([1], { hash: (_element, digests) => digests.join("") });
export const expression = new SynchronousExpressionTree<number, string>([1], { operatorOf: () => undefined });
export const parse = new SynchronousParseTree<number, string>([1], { symbolOf: () => "number" });
export const decision = new SynchronousDecisionTree<number, boolean, string>([1], { testOf: () => true, labelOf: () => "yes" });
export const shortest = new SynchronousShortestPathTree<string, bigint>(["a"], { distanceOf: () => 0n, incomingWeightOf: () => undefined });
export const virtual = new SynchronousVirtualTree<string, bigint>(["a"], { pathWeightOf: () => 0n });
// @ts-expect-error constructor options cannot forge a digest type.
export const forgedDigest = new SynchronousMerkleTree<number, string>([1], { hash: () => 1 });
// @ts-expect-error constructor options cannot forge an operator type.
export const forgedOperator = new SynchronousExpressionTree<number, string>([1], { operatorOf: () => 1 });
// @ts-expect-error constructor options cannot forge an AST kind type.
export const forgedKind = new SynchronousAbstractSyntaxTree<number, string>([1], { kindOf: () => 1 });
// @ts-expect-error constructor options cannot forge a distance type.
export const forgedDistance = new SynchronousShortestPathTree<string, bigint>(["a"], { distanceOf: () => "far" });
// @ts-expect-error constructor options cannot forge a decision label type.
export const forgedLabel = new SynchronousDecisionTree<number, boolean, string>([1], { labelOf: () => 1 });

/** Defaults cannot promise representations that their builders never produce. */
// @ts-expect-error the default trie builder emits string edge labels.
export const forgedTrie = new SynchronousTrie<number, number>([1]);
// @ts-expect-error the default Patricia builder emits string keys.
export const forgedPatricia = new SynchronousPatriciaTrie<number, number>([1]);
// @ts-expect-error the default interval builder handles numeric endpoints.
export const forgedInterval = new SynchronousIntervalTree<string, number>([1]);
// @ts-expect-error the default ball builder emits coordinate arrays.
export const forgedBall = new SynchronousBallTree<number, string>([1]);
// @ts-expect-error the default BVH builder emits bounding boxes.
export const forgedBVH = new SynchronousBoundingVolumeHierarchy<number, string>([1]);

declare const trieRoots: readonly Nodes.TrieNode<number, number>[];
declare const patriciaRoots: readonly Nodes.PatriciaNode<number, number>[];
declare const intervalRoots: readonly Nodes.IntervalNode<string, number>[];
declare const ballRoots: readonly Nodes.BallNode<number, string>[];
declare const volumeRoots: readonly Nodes.BVHNode<number, string>[];
export const customTrie = new SynchronousTrie<number, number>([1], { buildNodes: () => trieRoots });
export const customPatricia = new SynchronousPatriciaTrie<number, number>([1], { buildNodes: () => patriciaRoots });
export const customInterval = new SynchronousIntervalTree<string, number>([1], { buildNodes: () => intervalRoots });
export const customBall = new SynchronousBallTree<number, string>([1], { buildNodes: () => ballRoots });
export const customVolume = new SynchronousBoundingVolumeHierarchy<number, string>([1], { buildNodes: () => volumeRoots });

/** The search-page parent derives B+ collection elements from its node contract. */
export function bplusParent(tree: AsynchronousBPlusTree<string, number>): void {
    const parent: import("#semantic/structure/tree/searchTree").AsynchronousSearchTree<string, Nodes.BPlusNode<string, number>> = tree;
    const entries: AsynchronousCollection<Nodes.TreeEntry<string, number>> = parent;
    void entries;
}
export const search = new SynchronousSearchTree([1, 2]);
// @ts-expect-error custom pages require a builder even when their keys match.
export const forgedPage = new SynchronousSearchTree<string, Nodes.BPlusNode<string, number>>([{ key: "a", value: 1 }]);
