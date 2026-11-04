import { Optional } from "#semantic/optional";
import { attachNavigation } from "#semantic/structure/tree/navigationRuntime";

export { attachNavigation } from "#semantic/structure/tree/navigationRuntime";
import type * as Nodes from "#semantic/structure/node";
import type { Comparator } from "#semantic/utility";

/** Options for rebuilding element-oriented structural trees. */
export interface BinaryTreeOptions<E> {
    comparator?: Comparator<E>;
    arity?: number | bigint;
    direction?: "left" | "right";
    /** Finite min-heap priority. Defaults to a fresh random priority per element. */
    priority?: (element: E, index: number) => number;
    /** Euler sequence aggregate, computed in sequence order for each subtree. */
    aggregate?: (elements: readonly E[]) => unknown;
}

/** Default comparison is deliberately restricted to naturally ordered primitives. */
function defaultCompare<E>(a: E, b: E): number {
    if (typeof a === "number" && Number.isNaN(a) || typeof b === "number" && Number.isNaN(b))
        throw new TypeError("NaN requires an explicit comparator.");
    if (Object.is(a, b)) return 0;
    if (typeof a === "number" && typeof b === "number") {
        return a === b ? 0 : a < b ? -1 : 1;
    }
    if (typeof a === "string" && typeof b === "string") return a < b ? -1 : 1;
    if (typeof a === "bigint" && typeof b === "bigint") return a < b ? -1 : 1;
    if (typeof a === "boolean" && typeof b === "boolean") return a ? 1 : -1;
    throw new TypeError("A comparator is required for these elements.");
}

function requireElement<E>(element: E): void {
    if (element === null || element === undefined) throw new TypeError("Tree elements cannot be null or undefined.");
}

/** Internal nodes are created from elements; topology never leaks as constructor input. */
class RuntimeNode<E> implements Nodes.BinaryNode<E> {
    parent: RuntimeNode<E> | undefined;
    children: RuntimeNode<E>[] = [];
    left: RuntimeNode<E> | undefined;
    right: RuntimeNode<E> | undefined;
    height = 1n;
    subtreeSize = 1n;
    depth = 0n;
    color: "red" | "black" = "black";
    level = 1n;
    priority = 0;
    position = 0n;
    index = 0n;
    nullPathLength = 0n;
    discovered = 0n;
    finished = 0n;
    heavy: RuntimeNode<E> | undefined;
    chainHead: RuntimeNode<E> = this;
    nextSibling: RuntimeNode<E> | undefined;
    predecessor: RuntimeNode<E> | undefined;
    successor: RuntimeNode<E> | undefined;
    aggregate: unknown;
    arity = 2n;
    direction: "left" | "right" = "left";

    private element: E;
    constructor(element: E) { requireElement(element); this.element = element; }
    setElement(element: E): void { requireElement(element); this.element = element; }
    getElement(): Optional<E> { return Optional.of(this.element); }
    getParent(): Optional<this> { return Optional.ofNullable(this.parent as this | undefined); }
    getChildren(): readonly this[] { return this.children.slice() as this[]; }
    getLeft(): Optional<this> { return Optional.ofNullable(this.left as this | undefined); }
    getRight(): Optional<this> { return Optional.ofNullable(this.right as this | undefined); }
    getHeight(): bigint { return this.height; }
    getBalanceFactor(): -1 | 0 | 1 {
        const difference = (this.left?.height ?? 0n) - (this.right?.height ?? 0n);
        if (difference < -1n || difference > 1n) throw new RangeError("Node is not AVL balanced.");
        return Number(difference) as -1 | 0 | 1;
    }
    getColor(): "red" | "black" { return this.color; }
    getLevel(): bigint { return this.level; }
    getPriority(): number { return this.priority; }
    getSubtreeSize(): bigint { return this.subtreeSize; }
    getPosition(): bigint { return this.position; }
    getOccurrence(): bigint { return this.index; }
    getIndex(): bigint { return this.index; }
    getArity(): bigint { return this.arity; }
    getDirection(): "left" | "right" { return this.direction; }
    getNullPathLength(): bigint { return this.nullPathLength; }
    getDepth(): bigint { return this.depth; }
    getDiscoveredAt(): bigint { return this.discovered; }
    getFinishedAt(): bigint { return this.finished; }
    getHeavyChild(): Optional<this> { return Optional.ofNullable(this.heavy as this | undefined); }
    getChainHead(): this { return this.chainHead as this; }
    getNextSibling(): Optional<this> { return Optional.ofNullable(this.nextSibling as this | undefined); }
    getRepresentativeParent(): this { return (this.parent ?? this) as this; }
    getRank(): bigint { return 0n; } // Only singleton union-find sets are constructed.
    getSetSize(): bigint { return this.subtreeSize; }
    getAggregate(): unknown { return this.aggregate; }
    getLeftLink(): Nodes.ThreadedLink<this> {
        if (this.left) return { kind: "child", node: this.left as this };
        return this.predecessor ? { kind: "thread", node: this.predecessor as this } : { kind: "empty" };
    }
    getRightLink(): Nodes.ThreadedLink<this> {
        if (this.right) return { kind: "child", node: this.right as this };
        return this.successor ? { kind: "thread", node: this.successor as this } : { kind: "empty" };
    }
    // Installed on each instance by attachNavigation after topology is complete.
    declare ancestor: () => Optional<this>;
    declare root: () => this;
    declare preorder: () => Generator<this, void, unknown>;
    declare inorder: () => Generator<this, void, unknown>;
    declare postorder: () => Generator<this, void, unknown>;
    declare breadthFirst: () => Generator<this, void, unknown>;
}

const SEARCH_FAMILIES = new Set([
    "BinarySearchTree", "AdelsonVelskyLandisTree", "RedBlackTree", "AnderssonTree", "SplayTree", "Treap", "ScapegoatTree", "WeightBalancedTree",
]);
const HEAP_FAMILIES = new Set(["BinaryHeap", "DaryHeap", "PairingHeap", "LeftistTree", "SkewHeap"]);
const GENERAL_FAMILIES = new Set(["RootedTree", "OrderedTree", "UnorderedTree", "NaryTree", "BreadthFirstSearchTree", "DepthFirstSearchTree", "HeavyLightTree"]);
const BINARY_FAMILIES = new Set([
    "BinaryTree", "FullBinaryTree", "CompleteBinaryTree", "PerfectBinaryTree", "SkewedBinaryTree", "ThreadedBinaryTree", "CartesianTree", "EulerTourTree",
]);

function connectBinary<E>(node: RuntimeNode<E>): void {
    node.children = [];
    if (node.left) { node.children.push(node.left); node.left.parent = node; }
    if (node.right) { node.children.push(node.right); node.right.parent = node; }
}

function buildMidpoints<E>(nodes: RuntimeNode<E>[], redBlack: boolean): RuntimeNode<E> {
    let redLevel = 0;
    for (let count = nodes.length - 1; count >= 0; count = Math.floor(count / 2) - 1) redLevel++;
    const frames: Array<{ low: number; high: number; parent?: RuntimeNode<E>; side?: "left" | "right"; depth: number }> = [
        { low: 0, high: nodes.length - 1, depth: 0 },
    ];
    let root = nodes[0];
    while (frames.length) {
        const { low, high, parent, side, depth } = frames.pop()!;
        if (low > high) continue;
        const middle = Math.floor((low + high) / 2);
        const node = nodes[middle];
        node.parent = parent;
        if (parent && side) parent[side] = node; else root = node;
        if (redBlack && depth === redLevel) node.color = "red";
        frames.push({ low: middle + 1, high, parent: node, side: "right", depth: depth + 1 });
        frames.push({ low, high: middle - 1, parent: node, side: "left", depth: depth + 1 });
    }
    return root;
}

/** Stack insertion with the AA skew/split rotations, including true level updates. */
function buildAA<E>(nodes: RuntimeNode<E>[]): RuntimeNode<E> {
    let root = nodes[0];
    for (let i = 1; i < nodes.length; i++) {
        const inserted = nodes[i];
        const path: RuntimeNode<E>[] = [];
        let cursor: RuntimeNode<E> | undefined = root;
        while (cursor) {
            path.push(cursor);
            // Nodes arrive in stable composite-key order, including equivalent elements.
            cursor = cursor.right;
        }
        let rebuilt = inserted;
        while (path.length) {
            const previous = path.pop()!;
            previous.right = rebuilt;
            rebuilt = previous;
            if (rebuilt.left?.level === rebuilt.level) {
                const promoted = rebuilt.left;
                rebuilt.left = promoted.right;
                promoted.right = rebuilt;
                rebuilt = promoted;
            }
            if (rebuilt.right?.right?.level === rebuilt.level) {
                const promoted = rebuilt.right;
                rebuilt.right = promoted.left;
                promoted.left = rebuilt;
                promoted.level++;
                rebuilt = promoted;
            }
        }
        root = rebuilt;
    }
    return root;
}

/** Linear monotonic-stack Cartesian construction; in-order retains node-array order. */
function buildCartesian<E>(nodes: RuntimeNode<E>[]): RuntimeNode<E> {
    const stack: RuntimeNode<E>[] = [];
    for (const node of nodes) {
        let last: RuntimeNode<E> | undefined;
        while (stack.length && stack[stack.length - 1].priority > node.priority) last = stack.pop()!;
        node.left = last;
        if (stack.length) stack[stack.length - 1].right = node;
        stack.push(node);
    }
    return stack[0];
}

/**
 * Build roots satisfying the selected node contract. Every element is retained.
 * Search duplicates use stable input positions as an implicit secondary key;
 * element-only comparisons therefore expose nondecreasing (weak) search order.
 * Full/perfect cardinality restrictions are checked rather than padded.
 */
export function buildBinaryTree<E>(family: string, values: readonly E[], options: BinaryTreeOptions<E>): unknown[] {
    if (!SEARCH_FAMILIES.has(family) && !HEAP_FAMILIES.has(family) && !GENERAL_FAMILIES.has(family)
        && !BINARY_FAMILIES.has(family) && family !== "UnionFindForest") {
        throw new RangeError(`Unsupported structural tree family: ${family}`);
    }
    for (const value of values) requireElement(value);
    if (family === "FullBinaryTree" && values.length > 0 && values.length % 2 === 0)
        throw new RangeError("A nonempty full binary tree requires an odd number of elements.");
    if (family === "PerfectBinaryTree" && values.length > 0) {
        let count = BigInt(values.length) + 1n;
        while (count > 1n && count % 2n === 0n) count /= 2n;
        if (count !== 1n) throw new RangeError("A perfect binary tree requires 2^k - 1 elements.");
    }
    if (options.direction !== undefined && options.direction !== "left" && options.direction !== "right")
        throw new RangeError("direction must be left or right.");
    const arity = Number(options.arity ?? 2);
    if (!Number.isSafeInteger(arity) || arity < 1) throw new RangeError("arity must be a positive safe integer.");
    const compare: Comparator<E> = (a, b) => {
        const result = (options.comparator ?? defaultCompare)(a, b);
        if (typeof result !== "number" || !Number.isFinite(result)) throw new TypeError("Comparator must return a finite number.");
        return result;
    };
    const entries = Array.from(values, (element, index) => ({ element, index }));
    if (SEARCH_FAMILIES.has(family) || HEAP_FAMILIES.has(family))
        entries.sort((a, b) => compare(a.element, b.element) || a.index - b.index);
    const source = entries.map(entry => entry.element);
    const nodes = source.map(element => new RuntimeNode(element));
    if (!nodes.length) return [];
    if (family === "EulerTourTree" && !options.aggregate)
        throw new TypeError("EulerTourTree requires an aggregate(elements) callback.");
    for (let i = 0; i < nodes.length; i++) {
        nodes[i].index = BigInt(i);
        nodes[i].position = BigInt(i);
        nodes[i].arity = BigInt(arity);
        nodes[i].direction = options.direction ?? "left";
    }
    let root = nodes[0];
    if (family === "UnionFindForest") {
        for (const node of nodes) attachNavigation(node, () => undefined, () => node.children);
        return nodes;
    }
    const binary = !GENERAL_FAMILIES.has(family) && family !== "DaryHeap" && family !== "PairingHeap";
    if (family === "AnderssonTree") root = buildAA(nodes);
    else if (family === "Treap" || family === "CartesianTree") {
        for (let i = 0; i < nodes.length; i++) {
            const priority = options.priority?.(source[i], entries[i].index) ?? Math.random();
            if (!Number.isFinite(priority)) throw new TypeError("Priorities must be finite numbers.");
            nodes[i].priority = priority;
        }
        root = buildCartesian(nodes);
    } else if (SEARCH_FAMILIES.has(family) || family === "EulerTourTree") {
        root = buildMidpoints(nodes, family === "RedBlackTree");
    } else if (family === "SkewedBinaryTree") {
        for (let i = 0; i + 1 < nodes.length; i++) nodes[i][options.direction ?? "left"] = nodes[i + 1];
    } else if (family === "FullBinaryTree") {
        // Expanding the earliest leaf in pairs preserves fullness for every odd size.
        for (let i = 1, parent = 0; i < nodes.length; i += 2, parent++) {
            nodes[parent].left = nodes[i];
            nodes[parent].right = nodes[i + 1];
        }
    } else if (family === "PairingHeap") {
        root.children = nodes.slice(1);
        for (let i = 1; i < nodes.length; i++) {
            nodes[i].parent = root;
            nodes[i].nextSibling = nodes[i + 1];
        }
    } else if (!binary) {
        for (let i = 1; i < nodes.length; i++) {
            const parent = nodes[Math.floor((i - 1) / arity)];
            parent.children.push(nodes[i]);
            nodes[i].parent = parent;
        }
    } else {
        for (let i = 1; i < nodes.length; i++) {
            const parent = nodes[Math.floor((i - 1) / 2)];
            if (i % 2) parent.left = nodes[i]; else parent.right = nodes[i];
        }
    }
    if (binary) for (const node of nodes) connectBinary(node);
    root.parent = undefined;
    for (const node of nodes) {
        attachNavigation(node, () => node.parent, () => node.children, binary
            ? () => [...(node.left ? [node.left] : []), undefined, ...(node.right ? [node.right] : [])]
            : undefined);
    }
    let clock = 0n;
    const frames: Array<{ node: RuntimeNode<E>; exit: boolean }> = [{ node: root, exit: false }];
    while (frames.length) {
        const { node, exit } = frames.pop()!;
        if (!exit) {
            node.depth = node.parent ? node.parent.depth + 1n : 0n;
            node.discovered = ++clock;
            frames.push({ node, exit: true });
            for (let i = node.children.length - 1; i >= 0; i--) frames.push({ node: node.children[i], exit: false });
        } else {
            node.finished = ++clock;
            node.subtreeSize = 1n;
            node.height = 1n;
            for (const child of node.children) {
                node.subtreeSize += child.subtreeSize;
                if (child.height + 1n > node.height) node.height = child.height + 1n;
                if (!node.heavy || child.subtreeSize > node.heavy.subtreeSize) node.heavy = child;
            }
            node.nullPathLength = 1n + ((node.left?.nullPathLength ?? -1n) < (node.right?.nullPathLength ?? -1n)
                ? node.left?.nullPathLength ?? -1n : node.right?.nullPathLength ?? -1n);
            if (family === "EulerTourTree") {
                const elements = Array.from(node.inorder(), current => current.getElement().get() as E);
                node.aggregate = options.aggregate!(elements);
            }
        }
    }
    if (family === "HeavyLightTree") {
        const stack: Array<{ node: RuntimeNode<E>; head: RuntimeNode<E> }> = [{ node: root, head: root }];
        let position = 0n;
        while (stack.length) {
            const { node, head } = stack.pop()!;
            node.chainHead = head;
            node.position = position++;
            for (let i = node.children.length - 1; i >= 0; i--) {
                const child = node.children[i];
                if (child !== node.heavy) stack.push({ node: child, head: child });
            }
            if (node.heavy) stack.push({ node: node.heavy, head });
        }
    }
    if (family === "ThreadedBinaryTree") {
        let previous: RuntimeNode<E> | undefined;
        for (const node of root.inorder()) {
            node.predecessor = previous;
            if (previous) previous.successor = node;
            previous = node;
        }
    }
    return [root];
}
