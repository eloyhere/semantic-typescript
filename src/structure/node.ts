import type { Optional } from "#semantic/optional";
import type { Navigable } from "#semantic/structure/navigation";

/**
 * Node contracts follow the collection API: methods, Optional for absence and
 * bigint for counts/positions. A contract describes storage, not an algorithm.
 * Implementations maintain acyclicity, ownership, ordering and cached metadata.
 * References returned by getters are live; child arrays are readonly snapshots.
 * Null and undefined cannot be stored as elements (Optional reserves them).
 */
/**
 * Navigation follows structural child edges only: never sibling, thread,
 * suffix, routing, or auxiliary cross-links. ancestor means immediate parent.
 * root returns this node when ancestor is empty. Generators include their start
 * node. Generalised inorder visits first child, node, then remaining children;
 * binary nodes preserve empty left/right slots and use left, node, right.
 * TreeNode navigation uses getParent/getChildren. Search pages use their page
 * hierarchy, excluding B+ leaf-chain links. Heap sibling lists are not children.
 * Trie navigation follows edge children; Patricia uses zero/one branches and
 * ternary search uses less/equal/greater, in that order. Quad/octree traversal
 * uses occupied slots in slot order; missing slots do not create visited nodes.
 * Suffix/segment/BVH navigation uses their declared children (segment: left/right).
 * R-tree and M-tree navigation follows branch-entry children in entry order;
 * object entries and routing objects are not nodes. Decision/game navigation
 * follows edge children in edge/move order. Winner/loser navigation follows
 * tournament children, never the referenced winner/loser participant.
 * Each ancestor/root pair follows the same structural relation as traversal.
 * Other implicit/sequence relations are specified on the corresponding node.
 */
export interface NodeTraversal<N> extends Navigable<N> {}

/**
 * The default navigation type is this interface. Member redeclarations retain
 * polymorphic this for specialised nodes, e.g. an AVL traversal yields AVLNode.
 */
export interface ElementNode<E> extends Navigable<ElementNode<E>> {
    ancestor(): Optional<this>;
    root(): this;
    preorder(): Generator<this, void, unknown>;
    inorder(): Generator<this, void, unknown>;
    postorder(): Generator<this, void, unknown>;
    breadthFirst(): Generator<this, void, unknown>;
    setElement(element: E): void;
    getElement(): Optional<E>;
}

/**
 * Doubly linked node. set changes one link; link updates both ends.
 * Navigation treats previous as ancestor and next as the sole structural child;
 * root is the list head. The owning list must be finite and noncircular.
 */
export interface LinearNode<E> extends ElementNode<E> {
    setPrevious(previous: LinearNode<E>): void;
    setNext(next: LinearNode<E>): void;
    linkPrevious(previous: LinearNode<E>): void;
    linkNext(next: LinearNode<E>): void;
    /** @deprecated Historical spelling; use linkNext. */
    slinkNext(next: LinearNode<E>): void;
    /** Disconnects the specified neighbour only when it is currently linked. */
    dropPrevious(previous: LinearNode<E>): void;
    dropNext(next: LinearNode<E>): void;
    getPrevious(): Optional<LinearNode<E>>;
    getNext(): Optional<LinearNode<E>>;
}

// 1–11: general shapes. Shape invariants apply to a whole tree, not one node.
/** 1. Rooted tree node. Topology is changed by its owning tree, not by callers. */
export interface TreeNode<E> extends ElementNode<E> {
    getParent(): Optional<TreeNode<E>>;
    getChildren(): ReadonlyArray<TreeNode<E>>;
}
/** 2. Child array order is significant. */
export interface OrderedTreeNode<E> extends TreeNode<E> {}
/** 3. Enumeration order has no semantic meaning. */
export interface UnorderedTreeNode<E> extends TreeNode<E> {}
/** 4. A forest is a collection of disjoint roots, not a synthetic parent node. */
export interface Forest<E> {
    getRoots(): ReadonlyArray<TreeNode<E>>;
    size(): bigint;
}
/** 5. Child count is at most the positive, tree-wide arity. */
export interface NaryNode<E> extends OrderedTreeNode<E> {
    getArity(): bigint;
}
/** 6. Missing left/right positions are distinct; children omit empty slots. */
export interface BinaryNode<E> extends OrderedTreeNode<E> {
    getParent(): Optional<this>;
    getChildren(): ReadonlyArray<this>;
    getLeft(): Optional<this>;
    getRight(): Optional<this>;
}
/** 7. Each node has either zero or two children. */
export interface FullBinaryNode<E> extends BinaryNode<E> {}
/** 8. Last level is filled from left to right; earlier levels are full. */
export interface CompleteBinaryNode<E> extends BinaryNode<E> {}
/** 9. Full binary tree whose leaves all have the same depth. */
export interface PerfectBinaryNode<E> extends FullBinaryNode<E> {}
/** 10. Each node has at most one child, on the tree's declared side. */
export interface SkewedBinaryNode<E> extends BinaryNode<E> {
    getDirection(): "left" | "right";
}
/** A thread is not a child edge. Empty links represent an absent neighbour. */
export type ThreadedLink<N> =
    | { readonly kind: "child"; readonly node: N }
    | { readonly kind: "thread"; readonly node: N }
    | { readonly kind: "empty" };
/** 11. Child traversal excludes predecessor/successor threads. */
export interface ThreadedBinaryNode<E> extends BinaryNode<E> {
    getLeftLink(): ThreadedLink<this>;
    getRightLink(): ThreadedLink<this>;
}

// 12–20: ordered binary search trees. Comparator and duplicate policy live on the tree.
/** 12. All keys in the left/right subtrees compare below/above this element. */
export interface BinarySearchNode<E> extends BinaryNode<E> {}
/** 13. Leaf height is 1; balance = left height - right height, in {-1,0,1}. */
export interface AVLNode<E> extends BinarySearchNode<E> {
    getHeight(): bigint;
    getBalanceFactor(): -1 | 0 | 1;
}
/** 14. Black root, no red/red edge and equal black height to null leaves. */
export interface RedBlackNode<E> extends BinarySearchNode<E> {
    getColor(): "red" | "black";
}
/** 15. AA level encodes black height; horizontal links only lean right. */
export interface AANode<E> extends BinarySearchNode<E> {
    getLevel(): bigint;
}
/** 16. Access operations splay nodes; no extra persistent metadata is required. */
export interface SplayNode<E> extends BinarySearchNode<E> {}
/** 17. Search order on elements and min-heap order on random priorities. */
export interface TreapNode<E> extends BinarySearchNode<E> {
    getPriority(): number;
}
/** 18. The owning tree rebuilds subtrees according to its alpha threshold. */
export interface ScapegoatNode<E> extends BinarySearchNode<E> {
    getSubtreeSize(): bigint;
}
/** 19. Subtree sizes, including this node, determine the balance criterion. */
export interface WeightBalancedNode<E> extends BinarySearchNode<E> {
    getSubtreeSize(): bigint;
}
/** 20. In-order traversal follows input position; priorities obey heap order. */
export interface CartesianNode<E> extends BinaryNode<E> {
    getPosition(): bigint;
    getPriority(): number;
}

// 21–25: multiway search pages, deliberately distinct from single-element nodes.
/** Keys sorted by the tree comparator; internal child count = key count + 1. */
export interface SearchPage<K, N> extends NodeTraversal<N> {
    getKeys(): ReadonlyArray<K>;
    getChildren(): ReadonlyArray<N>;
    getParent(): Optional<N>;
    isLeaf(): boolean;
}
/** 21. One/two keys and two/three children; all leaves share a depth. */
export interface TwoThreeNode<K> extends SearchPage<K, TwoThreeNode<K>> {}
/** 22. One to three keys and two to four children. Root/leaf exceptions apply. */
export interface TwoThreeFourNode<K> extends SearchPage<K, TwoThreeFourNode<K>> {}
/** 23. Order is maximum child count (>=3); root has relaxed minimum occupancy. */
export interface BTreeNode<K> extends SearchPage<K, BTreeNode<K>> {
    getOrder(): bigint;
}
/** A key/value stored only in a B+ leaf. */
export interface TreeEntry<K, V> {
    readonly key: K;
    readonly value: V;
}
/** 24. Internal separators route searches; they do not carry record values. */
export interface BPlusBranchNode<K, V> extends SearchPage<K, BPlusNode<K, V>> {
    readonly kind: "branch";
    getOrder(): bigint;
}
/** Leaf records are ordered; leaf-chain order agrees with search order. */
export interface BPlusLeafNode<K, V> extends SearchPage<K, BPlusNode<K, V>> {
    readonly kind: "leaf";
    getChildren(): readonly [];
    getEntries(): ReadonlyArray<TreeEntry<K, V>>;
    getPrevious(): Optional<BPlusLeafNode<K, V>>;
    getNext(): Optional<BPlusLeafNode<K, V>>;
    getOrder(): bigint;
}
export type BPlusNode<K, V> = BPlusBranchNode<K, V> | BPlusLeafNode<K, V>;
/** 25. B* occupancy and sibling redistribution are tree-level algorithms. */
export interface BStarNode<K> extends SearchPage<K, BStarNode<K>> {
    getOrder(): bigint;
}

// 26–34: heaps. Comparator determines min/max orientation.
/** 26. Implicit complete-tree position is zero-based. */
export interface BinaryHeapNode<E> extends CompleteBinaryNode<E> {
    getIndex(): bigint;
}
/** 27. Array position identifies a node in a d-ary heap. */
export interface DaryHeapNode<E> extends NaryNode<E> {
    getIndex(): bigint;
}
/** 28. Rank r means a binomial tree with 2^r nodes. */
export interface BinomialNode<E> extends TreeNode<E> {
    getParent(): Optional<this>;
    getChildren(): ReadonlyArray<this>;
    getRank(): bigint;
    getNextSibling(): Optional<this>;
}
/** 29. Sibling links form a circular list; a root is unmarked. */
export interface FibonacciNode<E> extends TreeNode<E> {
    getParent(): Optional<this>;
    getChildren(): ReadonlyArray<this>;
    getDegree(): bigint;
    isMarked(): boolean;
    getPreviousSibling(): this;
    getNextSibling(): this;
}
/** 30. Pairwise merging, rather than a balance field, maintains this heap. */
export interface PairingNode<E> extends TreeNode<E> {
    getParent(): Optional<this>;
    getChildren(): ReadonlyArray<this>;
    getNextSibling(): Optional<this>;
}
/** 31. Null-path-length: null = -1, leaf = 0; left rank >= right rank. */
export interface LeftistNode<E> extends BinaryNode<E> {
    getNullPathLength(): bigint;
}
/** 32. Meld swaps children; no stored leftist rank is required. */
export interface SkewHeapNode<E> extends BinaryNode<E> {}
/**
 * A tournament leaf identifies an input run, even if that run is exhausted.
 * Participant navigation is a singleton: ancestor is empty, root is this node,
 * and each traversal yields this node once. Winner/loser references are cross-links.
 */
export interface TournamentParticipant<E> extends NodeTraversal<TournamentParticipant<E>> {
    getRunIndex(): bigint;
    getElement(): Optional<E>;
}
/** 33. Internal nodes retain the winner among descendant participants. */
export interface WinnerNode<E> extends NodeTraversal<WinnerNode<E>> {
    getWinner(): Optional<TournamentParticipant<E>>;
    getChildren(): ReadonlyArray<WinnerNode<E>>;
}
/** 34. The overall winner is held separately by the tournament container. */
export interface LoserNode<E> extends NodeTraversal<LoserNode<E>> {
    getLoser(): Optional<TournamentParticipant<E>>;
    getChildren(): ReadonlyArray<LoserNode<E>>;
}

// 35–39: prefix indexes. Edge labels, not node elements, encode the key.
export interface TrieEdge<S, N> {
    readonly label: S;
    readonly child: N;
}
/** 35. A terminal may have children (one key can prefix another). */
export interface TrieNode<V, S = string> extends ElementNode<V> {
    isTerminal(): boolean;
    getEdges(): ReadonlyArray<TrieEdge<S, TrieNode<V, S>>>;
}
/** 36. Each non-root compressed edge label is a nonempty symbol sequence. */
export interface CompressedTrieNode<V, S = string> extends ElementNode<V> {
    isTerminal(): boolean;
    getEdges(): ReadonlyArray<TrieEdge<ReadonlyArray<S>, CompressedTrieNode<V, S>>>;
}
/** 37. Branch bit positions increase down a path; leaves store the full key. */
export interface PatriciaNode<K, V> extends ElementNode<V> {
    getKey(): Optional<K>;
    getBitIndex(): bigint;
    getZero(): Optional<PatriciaNode<K, V>>;
    getOne(): Optional<PatriciaNode<K, V>>;
}
/** 38. Only the equal link advances the symbol position. */
export interface TernarySearchNode<V, S = string> extends ElementNode<V> {
    getSymbol(): S;
    isTerminal(): boolean;
    getLess(): Optional<TernarySearchNode<V, S>>;
    getEqual(): Optional<TernarySearchNode<V, S>>;
    getGreater(): Optional<TernarySearchNode<V, S>>;
}
/** Half-open interval in the owning suffix tree's immutable source sequence. */
export interface TextSpan {
    readonly start: bigint;
    readonly end: bigint;
}
/** 39. Root has an empty incoming span; suffix links do not denote children. */
export interface SuffixNode extends NodeTraversal<SuffixNode> {
    getIncomingSpan(): TextSpan;
    getChildren(): ReadonlyArray<SuffixNode>;
    getSuffixLink(): Optional<SuffixNode>;
    getSuffixStart(): Optional<bigint>;
}

// 40–54: interval, spatial and metric indexes.
/** Nonempty half-open interval [start,end). */
export interface TreeInterval<T> {
    readonly start: T;
    readonly end: T;
}
/** 40. Aggregate and lazy update tag are independent types. */
export interface SegmentNode<A, U = never> extends NodeTraversal<SegmentNode<A, U>> {
    getRange(): TreeInterval<bigint>;
    getAggregate(): A;
    getPendingUpdate(): Optional<U>;
    getLeft(): Optional<SegmentNode<A, U>>;
    getRight(): Optional<SegmentNode<A, U>>;
}
/**
 * 41. Implicit array cell; positive index i covers (i-lowbit(i),i].
 * Navigation uses the update forest: the ancestor index is i + lowbit(i),
 * or absent when beyond the owning array. Children are inverse update links,
 * ordered by index; root is the terminal in-range ancestor, not a synthetic zero.
 */
export interface FenwickNode<A> extends NodeTraversal<FenwickNode<A>> {
    getIndex(): bigint;
    getAggregate(): A;
}
/** 42. Subtree maximum end accelerates overlap queries on half-open intervals. */
export interface IntervalNode<T, E> extends BinarySearchNode<E> {
    getInterval(): TreeInterval<T>;
    getMaximumEnd(): T;
}
/** 43. Search split and heap priority represent different coordinates. */
export interface PrioritySearchNode<E> extends BinaryNode<E> {
    getSplit(): number;
    getPriority(): number;
}
/** Coordinate arrays have the tree's fixed dimensionality; min <= max. */
export interface BoundingBox {
    readonly minimum: ReadonlyArray<number>;
    readonly maximum: ReadonlyArray<number>;
}
/** 44. Split axis is zero-based and less than the fixed dimension count. */
export interface KDNode<E> extends BinaryNode<E> {
    getPoint(): ReadonlyArray<number>;
    getAxis(): bigint;
    getSplit(): number;
}
/** 45. Slots are SW, SE, NW, NE; absent slots are preserved. */
export interface QuadNode<E> extends ElementNode<E> {
    getBounds(): BoundingBox;
    getQuadrants(): readonly [Optional<QuadNode<E>>, Optional<QuadNode<E>>, Optional<QuadNode<E>>, Optional<QuadNode<E>>];
}
/** 46. Octant bit 0 selects x-high, bit 1 y-high, bit 2 z-high. */
export interface OctNode<E> extends ElementNode<E> {
    getBounds(): BoundingBox;
    getOctants(): readonly [Optional<OctNode<E>>, Optional<OctNode<E>>, Optional<OctNode<E>>, Optional<OctNode<E>>, Optional<OctNode<E>>, Optional<OctNode<E>>, Optional<OctNode<E>>, Optional<OctNode<E>>];
}
export type SpatialEntry<E, N> =
    | { readonly kind: "branch"; readonly bounds: BoundingBox; readonly child: N }
    | { readonly kind: "leaf"; readonly bounds: BoundingBox; readonly element: E };
/** 47. An internal page contains branches; a leaf page contains objects. */
export interface RTreeNode<E> extends NodeTraversal<RTreeNode<E>> {
    isLeaf(): boolean;
    getBounds(): BoundingBox;
    getEntries(): ReadonlyArray<SpatialEntry<E, this>>;
}
/** 48. Sibling interiors do not overlap; an object may have duplicate entries. */
export interface RPlusNode<E> extends RTreeNode<E> {}
/** 49. Reinsertion and split heuristics are maintained by the owning tree. */
export interface RStarNode<E> extends RTreeNode<E> {}
/** 50. Each child volume is contained in its parent volume. */
export interface BVHNode<E, B = BoundingBox> extends NodeTraversal<BVHNode<E, B>> {
    getVolume(): B;
    getElements(): ReadonlyArray<E>;
    getChildren(): ReadonlyArray<BVHNode<E, B>>;
}
/** 51. All descendant objects lie within this metric ball. */
export interface BallNode<E, P = ReadonlyArray<number>> extends BinaryNode<E> {
    getCenter(): P;
    getRadius(): number;
}
/** 52. Vantage element partitions points by their distance to the threshold. */
export interface VPNode<E> extends BinaryNode<E> {
    getThreshold(): number;
}
/** 53. Nesting, covering and separation constraints depend on the base metric. */
export interface CoverNode<E> extends TreeNode<E> {
    getLevel(): bigint;
    getChildren(): ReadonlyArray<this>;
}
export type MetricEntry<E> =
    | { readonly kind: "branch"; readonly center: E; readonly radius: number; readonly parentDistance: number; readonly child: MTreeNode<E> }
    | { readonly kind: "leaf"; readonly element: E; readonly parentDistance: number };
/** 54. Routing objects, covering radii and distances index a metric space. */
export interface MTreeNode<E> extends NodeTraversal<MTreeNode<E>> {
    isLeaf(): boolean;
    getEntries(): ReadonlyArray<MetricEntry<E>>;
}

// 55–66: specialised trees and tree-derived representations.
/** 55. Only leaves hold symbols; internal weight equals child-weight sum. */
export interface HuffmanNode<E> extends FullBinaryNode<E> {
    getWeight(): bigint;
}
/** 56. Operand nodes have no operator; operators declare their arity. */
export interface ExpressionNode<E, O = string> extends TreeNode<E> {
    getOperator(): Optional<O>;
    getArity(): bigint;
    getChildren(): ReadonlyArray<ExpressionNode<E, O>>;
}
/** 57. Grammar symbols include punctuation and production structure. */
export interface ParseNode<E, S = string> extends TreeNode<E> {
    getSymbol(): S;
    getSpan(): Optional<TextSpan>;
    getChildren(): ReadonlyArray<ParseNode<E, S>>;
}
/** 58. Abstract syntax kinds omit incidental grammar details. */
export interface ASTNode<E, K = string> extends TreeNode<E> {
    getKind(): K;
    getSpan(): Optional<TextSpan>;
    getChildren(): ReadonlyArray<ASTNode<E, K>>;
}
export interface DecisionEdge<E, T, L> {
    readonly label: L;
    readonly child: DecisionNode<E, T, L>;
}
/** 59. A leaf has a prediction and no test; branches have a test and labelled edges. */
export interface DecisionNode<E, T, L = string> extends NodeTraversal<DecisionNode<E, T, L>> {
    getTest(): Optional<T>;
    getPrediction(): Optional<E>;
    getEdges(): ReadonlyArray<DecisionEdge<E, T, L>>;
}
export interface GameEdge<S, A> {
    readonly action: A;
    readonly probability?: number;
    readonly child: GameNode<S, A>;
}
/** 60. Probabilities apply only to chance moves; state is the node element. */
export interface GameNode<S, A> extends ElementNode<S> {
    getPlayer(): Optional<bigint>;
    getScore(): Optional<number>;
    getMoves(): ReadonlyArray<GameEdge<S, A>>;
}
/** 61. Digest encoding and ordered child hashing must be specified by the tree. */
export interface MerkleNode<E, H = string> extends TreeNode<E> {
    getDigest(): H;
    getChildren(): ReadonlyArray<MerkleNode<E, H>>;
}
/**
 * 62. Navigation follows the current representative-parent forest, not history.
 * A representative's stored parent is itself, but ancestor is empty there;
 * root is that representative. Children are nodes whose current parent is this
 * node, excluding this node itself; traversal never follows the self-parent loop.
 */
export interface UnionFindNode<E> extends ElementNode<E> {
    getRepresentativeParent(): UnionFindNode<E>;
    getRank(): bigint;
    getSetSize(): bigint;
}
/**
 * 63. Navigation follows the current auxiliary splay tree: ancestor is the
 * auxiliary parent, root is its auxiliary root, and children are left/right.
 * Represented-tree path-parent links are separate and never traversed.
 */
export interface LinkCutNode<E, A = E, U = never> extends ElementNode<E> {
    getAuxiliaryParent(): Optional<LinkCutNode<E, A, U>>;
    getLeft(): Optional<LinkCutNode<E, A, U>>;
    getRight(): Optional<LinkCutNode<E, A, U>>;
    getPathParent(): Optional<LinkCutNode<E, A, U>>;
    isReversed(): boolean;
    getAggregate(): A;
    getPendingUpdate(): Optional<U>;
}
/**
 * 64. A vertex can have multiple sequence occurrences in an Euler tour.
 * Navigation follows the balanced sequence tree of occurrences: ancestor/root
 * refer to sequence nodes, not to the represented graph's vertex-parent relation.
 */
export interface EulerTourNode<V, A = V> extends BinaryNode<V> {
    getOccurrence(): bigint;
    getSubtreeSize(): bigint;
    getAggregate(): A;
}
/**
 * 65. A cluster has zero, one or two boundary vertices, not a graph-node parent.
 * Navigation follows the cluster decomposition: ancestor is the containing
 * parent cluster, root is the decomposition root, and children are subclusters.
 */
export interface TopTreeNode<V, A> extends NodeTraversal<TopTreeNode<V, A>> {
    getBoundaries(): readonly [] | readonly [V] | readonly [V, V];
    getChildren(): readonly [] | readonly [TopTreeNode<V, A>, TopTreeNode<V, A>];
    getAggregate(): A;
}
/**
 * 66. Decomposition metadata over the original rooted tree. Navigation follows
 * that original tree's parent/children; root is not necessarily the chain head.
 */
export interface HeavyLightNode<E> extends TreeNode<E> {
    getParent(): Optional<this>;
    getChildren(): ReadonlyArray<this>;
    getDepth(): bigint;
    getSubtreeSize(): bigint;
    getHeavyChild(): Optional<this>;
    getChainHead(): this;
    getPosition(): bigint;
}

// 67–72: graph algorithm results. Getters record results; they do not prove optimality.
/**
 * These result nodes navigate their result forest, not all original graph edges.
 * ancestor/root follow discovery predecessors, shortest-path predecessors,
 * oriented spanning edges, immediate dominators, or virtual-tree parent edges,
 * respectively. An isolated/component root has no ancestor.
 */
/** 67. Discovery/finish timestamps are global to the search forest. */
export interface DFSNode<V> extends TreeNode<V> {
    getDiscoveredAt(): bigint;
    getFinishedAt(): bigint;
}
/** 68. Depth equals unweighted distance from the component's search root. */
export interface BFSNode<V> extends TreeNode<V> {
    getDepth(): bigint;
}
/** 69. Parent edge and total source distance retain the original weight type. */
export interface ShortestPathNode<V, W = number> extends TreeNode<V> {
    getDistance(): W;
    getIncomingWeight(): Optional<W>;
}
/** 70. A disconnected graph produces a minimum spanning forest. */
export interface MinimumSpanningNode<V, W = number> extends TreeNode<V> {
    getIncomingWeight(): Optional<W>;
}
/** 71. Parent denotes immediate dominator, not necessarily a graph edge. */
export interface DominatorNode<V> extends TreeNode<V> {
    getParent(): Optional<this>;
    getChildren(): ReadonlyArray<this>;
}
/** 72. Virtual parent edge represents an entire original-tree path. */
export interface VirtualNode<V, W = bigint> extends TreeNode<V> {
    isKeyVertex(): boolean;
    getOriginalDepth(): bigint;
    getPathWeight(): Optional<W>;
}

