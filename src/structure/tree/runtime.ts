import { Optional } from "#semantic/optional";
import { AsynchronousCollection, SynchronousCollection, createCollection, readCollection } from "#semantic/structure/collection";
import type { Navigable } from "#semantic/structure/navigation";
import { buildBinaryTree } from "#semantic/structure/tree/binaryBuilder";
import type { BinaryTreeOptions } from "#semantic/structure/tree/binaryBuilder";
import { buildSpecializedTree } from "#semantic/structure/tree/specializedBuilder";
import type { SpecializedTreeOptions } from "#semantic/structure/tree/specializedBuilder";
import type { TreeOptions } from "#semantic/structure/tree/options";

export type { TreeOptions } from "#semantic/structure/tree/options";

type RuntimeOptions = TreeOptions<unknown> & BinaryTreeOptions<unknown> & SpecializedTreeOptions<unknown>;
const binaryFamilies = new Set([
    "Tree", "Forest", "RootedTree", "RootedForest", "OrderedTree", "UnorderedTree", "NaryTree",
    "BinaryTree", "FullBinaryTree", "CompleteBinaryTree", "PerfectBinaryTree", "SkewedBinaryTree",
    "ThreadedBinaryTree", "BinarySearchTree", "AdelsonVelskyLandisTree", "RedBlackTree", "AnderssonTree", "SplayTree",
    "Treap", "ScapegoatTree", "WeightBalancedTree", "CartesianTree", "BinaryHeap", "DaryHeap",
    "PairingHeap", "LeftistTree", "SkewHeap", "EulerTourTree", "BreadthFirstSearchTree", "DepthFirstSearchTree",
    "UnionFindForest", "HeavyLightTree",
]);
const forestFamilies = new Set([
    "Forest", "RootedForest", "BinomialHeap", "FibonacciHeap", "FenwickTree", "UnionFindForest",
    "LinkCutTree", "DepthFirstSearchTree", "BreadthFirstSearchTree", "MinimumSpanningTree",
]);
type RuntimeNode = Navigable<RuntimeNode> & object;
type ElementNode = RuntimeNode & { getElement(): Optional<unknown>; setElement(value: unknown): void };
const sameValue = (left: unknown, right: unknown): boolean => left === right || (left !== left && right !== right);

/** Merge public per-root BFS generators by structural depth, without guessing child fields. */
function* forestBreadthFirst(roots: readonly RuntimeNode[]): Generator<RuntimeNode, void, unknown> {
    const depths = new Map<RuntimeNode, number>();
    for (const root of roots) depths.set(root, 0);
    const depthOf = (node: RuntimeNode): number => {
        const path: RuntimeNode[] = [];
        const seen = new Set<RuntimeNode>();
        let current = node;
        while (!depths.has(current)) {
            if (seen.has(current)) throw new TypeError("Cyclic ancestor links.");
            seen.add(current);
            path.push(current);
            const ancestor = current.ancestor();
            if (ancestor.isEmpty()) throw new TypeError("Traversal node is outside the forest roots.");
            current = ancestor.get();
        }
        let depth = depths.get(current)!;
        while (path.length) depths.set(path.pop()!, ++depth);
        return depths.get(node)!;
    };
    const streams = roots.map(root => ({ iterator: root.breadthFirst(), pending: undefined as IteratorResult<RuntimeNode, void> | undefined }));
    try {
        let depth = 0;
        while (true) {
            let remaining = false;
            for (const stream of streams) {
                stream.pending ??= stream.iterator.next();
                while (!stream.pending.done && depthOf(stream.pending.value) === depth) {
                    yield stream.pending.value;
                    stream.pending = stream.iterator.next();
                }
                if (!stream.pending.done) {
                    if (depthOf(stream.pending.value) < depth) throw new TypeError("breadthFirst must yield nondecreasing structural depth.");
                    remaining = true;
                }
            }
            if (!remaining) return;
            depth++;
        }
    } finally {
        for (const stream of streams) if (!stream.pending?.done) stream.iterator.return();
    }
}

/**
 * @internal Shared implementation behind the public named constructors.
 * Collection operations store elements; the four traversals expose nodes.
 * A mutation atomically rebuilds the node view. Previously returned nodes and
 * iterators remain pre-mutation snapshots, not live handles. setElement on a
 * current element node replaces that occurrence and rebuilds the whole tree;
 * it does not modify the old node. Setters on stale nodes throw instead of
 * silently changing detached state. Structural nodes without an element cannot
 * acquire one through setElement. Node setters, like navigation, are synchronous.
 */
export function createTreeConstructor(name: string, asynchronous: boolean, family: string) {
    const constructor = function (
        this: object,
        source?: Iterable<unknown> | AsyncIterable<unknown>,
        options: RuntimeOptions = {},
    ): object {
        if (!new.target) throw new TypeError(`${name} must be constructed with new.`);
        let elements: unknown[] = [];
        let roots: RuntimeNode[] = [];
        let epoch = 0;
        let generation = 0;
        const isForest = forestFamilies.has(family);
        const build = (candidate: readonly unknown[]): RuntimeNode[] => {
            if (candidate.some(element => element == null)) throw new TypeError("Trees do not accept null or undefined elements.");
            const built = options.buildNodes
                ? options.buildNodes(Object.freeze(candidate.slice()))
                : binaryFamilies.has(family)
                    ? buildBinaryTree(family === "Tree" || family === "Forest" || family === "RootedForest" ? "RootedTree" : family, candidate, options)
                    : buildSpecializedTree(family, candidate, options);
            if (!Array.isArray(built)) throw new TypeError("A tree builder must return an array of roots.");
            if (!isForest && built.length > 1) throw new TypeError("A tree has at most one root.");
            for (const node of built) {
                if (node == null || typeof node !== "object" || !["ancestor", "root", "preorder", "inorder", "postorder", "breadthFirst"].every(method => typeof (node as Record<string, unknown>)[method] === "function")) {
                    throw new TypeError("A tree builder must return navigable nodes.");
                }
            }
            return built.slice() as RuntimeNode[];
        };
        const replace = (candidate: readonly unknown[]): void => {
            const nextElements = candidate.slice();
            const nextRoots = build(nextElements);
            const nextGeneration = generation + 1;
            // Assign duplicate occurrences independently. Traversal order may differ
            // from collection order (search trees/heaps), so use element identity.
            const slots = new Map<unknown, { indices: number[]; next: number }>();
            nextElements.forEach((value, index) => {
                let entry = slots.get(value);
                if (!entry) { entry = { indices: [], next: 0 }; slots.set(value, entry); }
                entry.indices.push(index);
            });
            const visited = new Set<RuntimeNode>();
            for (const root of nextRoots) for (const node of root.preorder()) {
                if (visited.has(node)) continue;
                visited.add(node);
                const elementNode = node as Partial<ElementNode>;
                if (typeof elementNode.getElement !== "function" || typeof elementNode.setElement !== "function") continue;
                const element = elementNode.getElement();
                const entry = element.isPresent() ? slots.get(element.get()) : undefined;
                const index = entry && entry.indices[entry.next++];
                Object.defineProperty(node, "setElement", {
                    configurable: true, enumerable: true, writable: true,
                    value: (value: unknown): void => {
                        if (generation !== nextGeneration) throw new TypeError("Cannot mutate a stale tree node snapshot.");
                        if (index === undefined) throw new TypeError("This structural node has no collection element occurrence.");
                        if (value == null) throw new TypeError("Tree elements cannot be null or undefined.");
                        const replacement = elements.slice();
                        replacement[index] = value;
                        replace(replacement);
                    },
                });
            }
            // Nothing observable is committed until construction and setter binding succeed.
            elements = nextElements;
            roots = nextRoots;
            generation = nextGeneration;
        };
        let readiness = Promise.resolve();
        if (source !== undefined) {
            if (source == null) throw new TypeError("Source must be iterable.");
            if (typeof source[Symbol.iterator as keyof typeof source] === "function") {
                replace(Array.from(source as Iterable<unknown>));
            } else if (asynchronous && typeof source[Symbol.asyncIterator as keyof typeof source] === "function") {
                const initialEpoch = epoch;
                readiness = (async () => {
                    const pending: unknown[] = [];
                    for await (const element of source as AsyncIterable<unknown>) {
                        if (epoch !== initialEpoch) return;
                        pending.push(element);
                    }
                    if (epoch === initialEpoch) replace(pending);
                })();
                void readiness.catch(() => undefined);
            } else throw new TypeError(asynchronous ? "Source must be iterable." : "Synchronous trees require an Iterable source.");
        }
        const collection = createCollection<unknown>({
            asynchronous, kind: "collection", readiness,
            getValues: () => elements.slice(),
            addValue: element => { replace([...elements, element]); return true; },
            removeValue: element => {
                const index = elements.findIndex(value => sameValue(value, element));
                if (index < 0) return false;
                replace([...elements.slice(0, index), ...elements.slice(index + 1)]);
                return true;
            },
            replaceValues: candidate => {
                if (candidate.length === elements.length && candidate.every((value, index) => sameValue(value, elements[index]))) return false;
                replace(candidate);
                return true;
            },
            clearValues: () => { epoch++; generation++; elements = []; roots = []; },
        }) as SynchronousCollection<unknown> | AsynchronousCollection<unknown>;
        const query = <T>(read: () => T): T | Promise<T> => readCollection(collection, read);
        const traversals = {
            preorder: () => { const snapshot = roots.slice(); return (function* () { for (const root of snapshot) yield* root.preorder(); })(); },
            inorder: () => { const snapshot = roots.slice(); return (function* () { for (const root of snapshot) yield* root.inorder(); })(); },
            postorder: () => { const snapshot = roots.slice(); return (function* () { for (const root of snapshot) yield* root.postorder(); })(); },
            breadthFirst: () => {
                const snapshot = roots.slice();
                return isForest ? forestBreadthFirst(snapshot) : (function* () { if (snapshot[0]) yield* snapshot[0].breadthFirst(); })();
            },
        };
        Object.assign(collection, traversals, isForest
            ? { getRoots: () => query(() => roots.slice()) }
            : { root: () => query(() => Optional.ofNullable(roots[0])) });
        return Object.setPrototypeOf(collection, new.target.prototype);
    };
    Object.defineProperty(constructor, "name", { value: name });
    const parent = asynchronous ? AsynchronousCollection : SynchronousCollection;
    Object.setPrototypeOf(constructor.prototype, parent.prototype);
    Object.setPrototypeOf(constructor, parent);
    return constructor;
}
