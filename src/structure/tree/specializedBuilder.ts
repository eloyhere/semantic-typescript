import { Optional } from "#semantic/optional";
import type { BoundingBox, TextSpan, TreeInterval } from "#semantic/structure/node";
import { attachNavigation } from "#semantic/structure/tree/navigationRuntime";

/** Callbacks describe information that cannot be inferred from collection elements. */
export interface SpecializedTreeOptions<E> {
    comparator?: (left: E, right: E) => number;
    order?: number | bigint;
    keyOf?: (element: E) => unknown;
    valueOf?: (element: E) => unknown;
    aggregate?: (values: readonly E[]) => unknown;
    combine?: (left: unknown, right: unknown) => unknown;
    pointOf?: (element: E) => readonly number[];
    boundsOf?: (element: E) => BoundingBox;
    buildNodes?: (values: readonly E[]) => readonly object[];
    intervalOf?: (element: E) => TreeInterval<number>;
    distance?: (left: E, right: E) => number;
    weightOf?: (element: E) => bigint;
    hash?: (element: E | undefined, childDigests: readonly unknown[]) => unknown;
    childrenOf?: (element: E) => readonly E[];
    parentOf?: (element: E) => E | undefined;
    operatorOf?: (element: E) => unknown;
    symbolOf?: (element: E) => unknown;
    kindOf?: (element: E) => unknown;
    spanOf?: (element: E) => TextSpan | undefined;
    testOf?: (element: E) => unknown;
    predictionOf?: (element: E) => E | undefined;
    labelOf?: (parent: E, child: E, index: number) => unknown;
    playerOf?: (element: E) => bigint | undefined;
    scoreOf?: (element: E) => number | undefined;
    probabilityOf?: (parent: E, child: E, index: number) => number | undefined;
    distanceOf?: (element: E) => unknown;
    incomingWeightOf?: (element: E) => unknown;
    originalDepthOf?: (element: E) => bigint;
    pathWeightOf?: (element: E) => unknown;
    isKeyVertex?: (element: E) => boolean;
    boundariesOf?: (values: readonly E[]) => readonly E[];
    levelOf?: (element: E) => bigint;
}

type Node = Record<string, unknown>;
interface State { node: Node; parent?: State; children: State[]; element?: unknown; }
const stateOf = new WeakMap<object, State>();
const optional = <T>(value?: T): Optional<T> => Optional.ofNullable(value);
const empty = (): Optional<never> => Optional.empty();

function create(element?: unknown, binary = false): State {
    const state: State = { node: {}, children: [], element };
    stateOf.set(state.node, state);
    const n = state.node;
    n.getElement = () => optional(state.element);
    n.setElement = (value: unknown) => {
        if (value === null || value === undefined) throw new TypeError("Node elements cannot be null or undefined");
        state.element = value;
    };
    n.getParent = () => optional(state.parent?.node);
    n.getChildren = () => state.children.filter(Boolean).map(child => child.node);
    if (binary) {
        n.getLeft = () => optional(state.children[0]?.node);
        n.getRight = () => optional(state.children[1]?.node);
    }
    attachNavigation(n, () => state.parent?.node, () => state.children.filter(Boolean).map(child => child.node),
        binary ? () => [state.children[0]?.node, undefined, state.children[1]?.node].filter((value, index) => index === 1 || value !== undefined) : undefined);
    return state;
}
function adopt(parent: State, children: State[]): void {
    parent.children = children;
    for (const child of children) if (child) child.parent = parent;
}
function requireOption<E, K extends keyof SpecializedTreeOptions<E>>(family: string, options: SpecializedTreeOptions<E>, key: K): NonNullable<SpecializedTreeOptions<E>[K]> {
    const value = options[key];
    if (value === undefined) throw new TypeError(`${family} requires options.${key} for nonempty construction`);
    return value as NonNullable<SpecializedTreeOptions<E>[K]>;
}
function defaultCompare(a: unknown, b: unknown): number {
    if (Object.is(a, b)) return 0;
    if (typeof a !== typeof b || !["number", "bigint", "string", "boolean"].includes(typeof a)) {
        throw new TypeError("A comparator is required for non-scalar keys");
    }
    if (typeof a === "number" && (Number.isNaN(a) || Number.isNaN(b as number))) throw new TypeError("NaN is not an ordered key");
    return (a as string | number | bigint | boolean) < (b as string | number | bigint | boolean) ? -1 : 1;
}
function orderOf<E>(options: SpecializedTreeOptions<E>, fallback = 4): number {
    const order = Number(options.order ?? fallback);
    if (!Number.isSafeInteger(order) || order < 3) throw new TypeError("options.order must be a safe integer >= 3");
    return order;
}
function groups<T>(items: readonly T[], maximum: number): T[][] {
    const count = Math.ceil(items.length / maximum);
    const size = Math.floor(items.length / count), extra = items.length % count;
    const result: T[][] = [];
    let offset = 0;
    for (let i = 0; i < count; i++) {
        const length = size + (i < extra ? 1 : 0);
        result.push(items.slice(offset, offset + length)); offset += length;
    }
    return result;
}
function numeric(value: number, name: string): number {
    if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
    return value;
}
function bounds(box: BoundingBox): BoundingBox {
    if (!box.minimum.length || box.minimum.length !== box.maximum.length || box.minimum.some((x, i) => !Number.isFinite(x) || !Number.isFinite(box.maximum[i]) || x > box.maximum[i])) {
        throw new TypeError("boundsOf must return finite, equally dimensional minimum <= maximum coordinates");
    }
    return { minimum: [...box.minimum], maximum: [...box.maximum] };
}
function union(boxes: readonly BoundingBox[]): BoundingBox {
    const dimensions = boxes[0].minimum.length;
    if (boxes.some(box => box.minimum.length !== dimensions)) throw new TypeError("Spatial dimensions must be fixed");
    return { minimum: Array.from({ length: dimensions }, (_, i) => Math.min(...boxes.map(box => box.minimum[i]))), maximum: Array.from({ length: dimensions }, (_, i) => Math.max(...boxes.map(box => box.maximum[i]))) };
}
function aggregate<E>(family: string, items: readonly E[], options: SpecializedTreeOptions<E>): unknown {
    if (options.aggregate) return options.aggregate(items);
    const combine = requireOption(family, options, "combine");
    const values = items.map(value => Object.hasOwn(options, "valueOf") && options.valueOf ? options.valueOf(value) : value);
    return values.slice(1).reduce((a, b) => combine(a, b), values[0]);
}

function searchPages<E>(family: string, values: readonly E[], options: SpecializedTreeOptions<E>): object[] {
    const order = family === "TwoThreeTree" ? 3 : family === "TwoThreeFourTree" ? 4 : orderOf(options);
    const bplus = family === "BPlusTree";
    const key = (value: E): unknown => options.keyOf ? options.keyOf(value) : bplus && typeof value === "object" && value !== null && "key" in value ? (value as { key: unknown }).key : value;
    const compare = options.comparator as ((a: unknown, b: unknown) => number) | undefined ?? defaultCompare;
    const sorted = [...values].sort((a, b) => compare(key(a), key(b)));
    const keys = new WeakMap<State, unknown[]>();
    const page = (pageKeys: unknown[], children: State[] = []): State => {
        const s = create(); keys.set(s, pageKeys); adopt(s, children);
        s.node.getKeys = () => [...keys.get(s)!];
        s.node.isLeaf = () => s.children.length === 0;
        s.node.getOrder = () => BigInt(order);
        return s;
    };
    if (bplus) {
        const leaves = groups(sorted, order - 1).map(items => {
            const s = page(items.map(key)); s.node.kind = "leaf";
            s.node.getEntries = () => items.map(value => ({ key: key(value), value: Object.hasOwn(options, "valueOf") && options.valueOf ? options.valueOf(value) : typeof value === "object" && value !== null && "value" in value ? (value as { value: unknown }).value : value }));
            return s;
        });
        leaves.forEach((s, i) => { s.node.getPrevious = () => optional(leaves[i - 1]?.node); s.node.getNext = () => optional(leaves[i + 1]?.node); });
        const minimum = (s: State): unknown => s.children.length ? minimum(s.children[0]) : keys.get(s)![0];
        let level = leaves;
        while (level.length > 1) level = groups(level, order).map(children => { const s = page(children.slice(1).map(minimum), children); s.node.kind = "branch"; return s; });
        return [level[0].node];
    }
    // Bulk construction chooses a feasible common leaf depth, including odd orders.
    // B* uses 2/3 occupancy outside the root. Impossible order/size pairs are rejected.
    const star = family === "BStarTree";
    const maximumKeys = order - 1;
    const minimumKeys = star ? Math.ceil(2 * maximumKeys / 3) : Math.ceil(order / 2) - 1;
    const minimum = (height: number): number => height === 0 ? minimumKeys : minimumKeys + (minimumKeys + 1) * minimum(height - 1);
    const maximum = (height: number): number => height === 0 ? maximumKeys : maximumKeys + order * maximum(height - 1);
    let height = 0;
    while (sorted.length > maximum(height)) height++;
    const build = (items: readonly E[], h: number, root: boolean): State => {
        if (h === 0) return page(items.map(key));
        const low = root ? 1 : minimumKeys, high = maximumKeys;
        let count = low;
        while (count <= high && !(items.length - count >= (count + 1) * minimum(h - 1) && items.length - count <= (count + 1) * maximum(h - 1))) count++;
        if (count > high) throw new TypeError(`${family}: order ${order} cannot represent this size with its occupancy invariant; use a compatible order or buildNodes`);
        const sizes = Array.from({ length: count + 1 }, () => minimum(h - 1));
        let remaining = items.length - count - sizes.reduce((a, b) => a + b, 0);
        for (let i = 0; i < sizes.length; i++) { const delta = Math.min(remaining, maximum(h - 1) - sizes[i]); sizes[i] += delta; remaining -= delta; }
        let offset = 0; const children: State[] = [], separators: unknown[] = [];
        for (let i = 0; i < sizes.length; i++) {
            children.push(build(items.slice(offset, offset + sizes[i]), h - 1, false)); offset += sizes[i];
            if (i < count) separators.push(key(items[offset++]));
        }
        return page(separators, children);
    };
    return [build(sorted, height, true).node];
}

function heaps<E>(family: string, values: readonly E[], options: SpecializedTreeOptions<E>): object[] {
    const compare = options.comparator ?? defaultCompare;
    if (family === "FibonacciHeap") {
        const roots = values.map(value => create(value));
        roots.forEach((s, i) => { s.node.getDegree = () => 0n; s.node.isMarked = () => false; s.node.getPreviousSibling = () => roots[(i + roots.length - 1) % roots.length].node; s.node.getNextSibling = () => roots[(i + 1) % roots.length].node; });
        return roots.map(s => s.node);
    }
    const ranks = new Map<number, State>();
    const link = (a: State, b: State): State => {
        if (compare(a.element as E, b.element as E) > 0) [a, b] = [b, a];
        adopt(a, [...a.children, b]); return a;
    };
    for (const value of values) {
        let s = create(value), rank = 0;
        while (ranks.has(rank)) { s = link(ranks.get(rank)!, s); ranks.delete(rank++); }
        ranks.set(rank, s);
    }
    const roots = [...ranks.entries()].sort((a, b) => a[0] - b[0]).map(([, s]) => s);
    const metadata = (s: State, siblings: State[], index: number): void => {
        s.node.getRank = () => BigInt(s.children.length);
        s.node.getNextSibling = () => optional(siblings[index + 1]?.node);
        s.children.forEach((child, i) => metadata(child, s.children, i));
    };
    roots.forEach((s, i) => metadata(s, roots, i));
    return roots.map(s => s.node);
}

function tournament<E>(family: string, values: readonly E[], options: SpecializedTreeOptions<E>): object[] {
    const compare = options.comparator ?? defaultCompare;
    const participants = values.map((value, i) => { const s = create(value); s.node.getRunIndex = () => BigInt(i); return s; });
    const build = (items: State[]): { state: State; winner: State } => {
        const s = create();
        if (items.length === 1) {
            s.node.getWinner = () => optional(items[0].node); s.node.getLoser = empty;
            return { state: s, winner: items[0] };
        }
        const middle = Math.ceil(items.length / 2), left = build(items.slice(0, middle)), right = build(items.slice(middle));
        adopt(s, [left.state, right.state]);
        const wins = compare(left.winner.element as E, right.winner.element as E) <= 0;
        const winner = wins ? left.winner : right.winner, loser = wins ? right.winner : left.winner;
        s.node.getWinner = () => optional(winner.node); s.node.getLoser = () => optional(loser.node);
        return { state: s, winner };
    };
    const root = build(participants).state;
    void family;
    return [root.node];
}

interface PrefixState extends State { edges: Map<string, PrefixState>; terminal: boolean; }
function prefix<E>(family: string, values: readonly E[], options: SpecializedTreeOptions<E>): object[] {
    const keyOf = options.keyOf ?? ((value: E) => value);
    const strings = values.map(value => {
        const key = keyOf(value);
        if (typeof key !== "string") throw new TypeError(`${family} requires string keys or options.keyOf returning a string`);
        return { value, key };
    });
    if (new Set(strings.map(item => item.key)).size !== strings.length) throw new TypeError(`${family} has one terminal value per key; duplicate keys require buildNodes with an explicit duplicate policy`);
    if (family === "PatriciaTrie") {
        // UTF-16 code units with a presence bit encode finite strings prefix-free.
        const bits = (text: string): number[] => { const result: number[] = []; for (let i = 0; i < text.length; i++) { result.push(1); for (let bit = 15; bit >= 0; bit--) result.push((text.charCodeAt(i) >>> bit) & 1); } result.push(0); return result; };
        const records = strings.map(record => ({ ...record, bits: bits(record.key) }));
        const build = (items: typeof records, start: number): State => {
            let index = start;
            while (index < Math.max(...items.map(item => item.bits.length)) && items.every(item => item.bits[index] === items[0].bits[index])) index++;
            if (index >= Math.max(...items.map(item => item.bits.length))) {
                const item = items[items.length - 1], s = create(item.value);
                s.node.getKey = () => optional(item.key); s.node.getBitIndex = () => BigInt(item.bits.length); s.node.getZero = empty; s.node.getOne = empty; return s;
            }
            const s = create(), zero = build(items.filter(item => item.bits[index] === 0), index + 1), one = build(items.filter(item => item.bits[index] === 1), index + 1);
            adopt(s, [zero, one]); s.node.getKey = empty; s.node.getBitIndex = () => BigInt(index); s.node.getZero = () => optional(zero.node); s.node.getOne = () => optional(one.node); return s;
        };
        return [build(records, 0).node];
    }
    if (family === "TernarySearchTree") {
        if (strings.some(item => item.key.length === 0)) throw new TypeError("TernarySearchTree cannot encode an empty key; use Trie or buildNodes");
        const build = (items: { value: E; symbols: string[] }[], depth: number): State => {
            const symbols = [...new Set(items.map(item => item.symbols[depth]))].sort(), symbol = symbols[Math.floor(symbols.length / 2)];
            const less = items.filter(item => item.symbols[depth] < symbol), equal = items.filter(item => item.symbols[depth] === symbol), greater = items.filter(item => item.symbols[depth] > symbol);
            const terminal = equal.filter(item => item.symbols.length === depth + 1), advance = equal.filter(item => item.symbols.length > depth + 1);
            const s = create(terminal.at(-1)?.value), l = less.length ? build(less, depth) : undefined, e = advance.length ? build(advance, depth + 1) : undefined, g = greater.length ? build(greater, depth) : undefined;
            adopt(s, [l, e, g].filter((x): x is State => x !== undefined));
            s.node.getSymbol = () => symbol; s.node.isTerminal = () => terminal.length > 0; s.node.getLess = () => optional(l?.node); s.node.getEqual = () => optional(e?.node); s.node.getGreater = () => optional(g?.node); return s;
        };
        return [build(strings.map(item => ({ value: item.value, symbols: [...item.key] })), 0).node];
    }
    const make = (): PrefixState => Object.assign(create(), { edges: new Map<string, PrefixState>(), terminal: false });
    const root = make();
    for (const { value, key } of strings) {
        let s = root;
        for (const symbol of key) { let next = s.edges.get(symbol); if (!next) { next = make(); s.edges.set(symbol, next); } s = next; }
        s.terminal = true; s.element = value;
    }
    const finish = (s: PrefixState): void => {
        const edges = [...s.edges].map(([label, child]) => {
            const labels = [label];
            if (family === "CompressedTrie") while (!child.terminal && child.edges.size === 1) { const entry = [...child.edges][0]; labels.push(entry[0]); child = entry[1]; }
            finish(child); return { label: family === "CompressedTrie" ? labels : label, child: child.node };
        });
        adopt(s, edges.map(edge => stateOf.get(edge.child)!)); s.node.isTerminal = () => s.terminal; s.node.getEdges = () => [...edges];
    };
    finish(root); return [root.node];
}

function suffix<E>(values: readonly E[]): object[] {
    // A compact suffix trie; no artificial terminator is inserted into the source.
    interface SuffixState extends State { start: number; end: number; suffix?: number; edges: Map<E, SuffixState>; }
    const make = (start: number, end: number): SuffixState => Object.assign(create(), { start, end, edges: new Map<E, SuffixState>() });
    const root = make(0, 0);
    for (let start = 0; start < values.length; start++) {
        let s = root;
        for (let i = start; i < values.length; i++) { let next = s.edges.get(values[i]); if (!next) { next = make(i, i + 1); s.edges.set(values[i], next); } s = next; }
        s.suffix = start;
    }
    const finish = (s: SuffixState): void => {
        const children = [...s.edges.values()].map(initial => { let child = initial; while (child.suffix === undefined && child.edges.size === 1) { const next = [...child.edges.values()][0]; next.start = child.start; child = next; } finish(child); return child; });
        adopt(s, children); s.node.getIncomingSpan = () => ({ start: BigInt(s.start), end: BigInt(s.end) }); s.node.getSuffixStart = () => optional(s.suffix === undefined ? undefined : BigInt(s.suffix)); s.node.getSuffixLink = empty;
    };
    finish(root); return [root.node];
}

function ranges<E>(family: string, values: readonly E[], options: SpecializedTreeOptions<E>): object[] {
    if (family === "SegmentTree") {
        const build = (start: number, end: number): State => {
            const s = create(undefined, true), middle = Math.floor((start + end) / 2);
            if (end - start > 1) adopt(s, [build(start, middle), build(middle, end)]);
            const result = aggregate(family, values.slice(start, end), options);
            s.node.getRange = () => ({ start: BigInt(start), end: BigInt(end) }); s.node.getAggregate = () => result; s.node.getPendingUpdate = empty; return s;
        };
        return [build(0, values.length).node];
    }
    const nodes = values.map((_, i) => {
        const index = i + 1, lowbit = Number(BigInt(index) & -BigInt(index)), result = aggregate(family, values.slice(index - lowbit, index), options), s = create();
        s.node.getIndex = () => BigInt(index); s.node.getAggregate = () => result; return s;
    });
    const roots: State[] = [];
    nodes.forEach((s, i) => { const index = i + 1, parent = index + Number(BigInt(index) & -BigInt(index)); if (parent <= nodes.length) { nodes[parent - 1].children.push(s); s.parent = nodes[parent - 1]; } else roots.push(s); });
    return roots.map(s => s.node);
}

function interval<E>(values: readonly E[], options: SpecializedTreeOptions<E>): object[] {
    const intervalOf = requireOption("IntervalTree", options, "intervalOf");
    const items = values.map(value => { const range = intervalOf(value); numeric(range.start, "interval start"); numeric(range.end, "interval end"); if (range.start >= range.end) throw new TypeError("intervalOf must return a nonempty half-open interval"); return { value, range }; }).sort((a, b) => a.range.start - b.range.start);
    const build = (entries: typeof items): { state: State; maximum: number } => {
        const middle = Math.floor(entries.length / 2), item = entries[middle], s = create(item.value, true), left = middle ? build(entries.slice(0, middle)) : undefined, right = middle + 1 < entries.length ? build(entries.slice(middle + 1)) : undefined;
        s.children = [left?.state, right?.state] as State[]; for (const child of s.children) if (child) child.parent = s;
        const maximum = Math.max(item.range.end, left?.maximum ?? -Infinity, right?.maximum ?? -Infinity);
        s.node.getInterval = () => ({ ...item.range }); s.node.getMaximumEnd = () => maximum; return { state: s, maximum };
    };
    return [build(items).state.node];
}

function points<E>(family: string, values: readonly E[], options: SpecializedTreeOptions<E>): object[] {
    const pointOf = requireOption(family, options, "pointOf");
    const items = values.map(value => ({ value, point: [...pointOf(value)] }));
    const dimensions = items[0].point.length;
    if (!dimensions || items.some(item => item.point.length !== dimensions || item.point.some(x => !Number.isFinite(x)))) throw new TypeError("pointOf must return finite points of fixed positive dimension");
    if (family === "PrioritySearchTree" && dimensions < 2) throw new TypeError("PrioritySearchTree requires at least two coordinates");
    if (family === "Quadtree" || family === "Octree") {
        const dimension = family === "Quadtree" ? 2 : 3;
        if (dimensions !== dimension) throw new TypeError(`${family} requires ${dimension} coordinates`);
        const pointBounds = (entries: typeof items): BoundingBox => union(entries.map(item => ({ minimum: item.point, maximum: item.point })));
        const build = (entries: typeof items, region: BoundingBox): State => {
            if (entries.length === 1) { const s = create(entries[0].value); s.node.getBounds = () => region; s.node[dimension === 2 ? "getQuadrants" : "getOctants"] = () => Array.from({ length: 2 ** dimension }, empty); return s; }
            if (entries.every(item => item.point.every((x, axis) => x === entries[0].point[axis]))) throw new TypeError(`${family} cannot store coincident points without a bucket policy; use buildNodes`);
            const middle = region.minimum.map((x, i) => x + (region.maximum[i] - x) / 2), buckets: (typeof items)[] = Array.from({ length: 2 ** dimension }, () => []);
            for (const item of entries) { let slot = 0; for (let axis = 0; axis < dimension; axis++) if (item.point[axis] >= middle[axis]) slot |= 1 << axis; buckets[slot].push(item); }
            const occupiedSlot = buckets.findIndex(bucket => bucket.length === entries.length);
            if (occupiedSlot >= 0 && region.minimum.every((x, axis) => (occupiedSlot & (1 << axis) ? middle[axis] : x) === x && (occupiedSlot & (1 << axis) ? region.maximum[axis] : middle[axis]) === region.maximum[axis])) throw new TypeError(`${family} cannot separate coincident points at floating-point precision; use buildNodes with a bucket policy`);
            const s = create(), slots = buckets.map((bucket, slot) => bucket.length ? build(bucket, { minimum: region.minimum.map((x, axis) => slot & (1 << axis) ? middle[axis] : x), maximum: region.maximum.map((x, axis) => slot & (1 << axis) ? x : middle[axis]) }) : undefined);
            adopt(s, slots.filter((x): x is State => x !== undefined)); s.node.getBounds = () => region; s.node[dimension === 2 ? "getQuadrants" : "getOctants"] = () => slots.map(child => optional(child?.node)); return s;
        };
        return [build(items, pointBounds(items)).node];
    }
    const build = (entries: typeof items, depth: number): State => {
        const axis = depth % dimensions;
        let item: (typeof items)[number], rest: typeof items, split: number, leftCount: number;
        if (family === "PrioritySearchTree") {
            entries.sort((a, b) => a.point[1] - b.point[1]); item = entries[0]; rest = entries.slice(1).sort((a, b) => a.point[0] - b.point[0]); leftCount = Math.floor(rest.length / 2); split = rest.length ? rest[leftCount].point[0] : item.point[0];
        } else { entries.sort((a, b) => a.point[axis] - b.point[axis]); const middle = Math.floor(entries.length / 2); item = entries[middle]; rest = [...entries.slice(0, middle), ...entries.slice(middle + 1)]; leftCount = middle; split = item.point[axis]; }
        const s = create(item.value, true), left = leftCount ? build(rest.slice(0, leftCount), depth + 1) : undefined, right = leftCount < rest.length ? build(rest.slice(leftCount), depth + 1) : undefined;
        s.children = [left, right] as State[]; for (const child of s.children) if (child) child.parent = s;
        s.node.getPoint = () => [...item.point]; s.node.getAxis = () => BigInt(axis); s.node.getSplit = () => split; s.node.getPriority = () => item.point[1]; return s;
    };
    return [build(items, 0).node];
}

function spatial<E>(family: string, values: readonly E[], options: SpecializedTreeOptions<E>): object[] {
    const boundsOf = requireOption(family, options, "boundsOf");
    const entries = values.map(element => ({ kind: "leaf" as const, element, bounds: bounds(boundsOf(element)) }));
    const maximum = orderOf(options);
    if (family === "BoundingVolumeHierarchy") {
        const build = (items: typeof entries): State => {
            const s = create(), volume = union(items.map(entry => entry.bounds));
            const axis = volume.minimum.map((x, i) => volume.maximum[i] - x).reduce((best, x, i, all) => x > all[best] ? i : best, 0);
            items.sort((a, b) => a.bounds.minimum[axis] + a.bounds.maximum[axis] - b.bounds.minimum[axis] - b.bounds.maximum[axis]);
            if (items.length > 1) { const middle = Math.floor(items.length / 2); adopt(s, [build(items.slice(0, middle)), build(items.slice(middle))]); }
            s.node.getVolume = () => volume; s.node.getElements = () => s.children.length ? [] : items.map(entry => entry.element); return s;
        };
        return [build(entries).node];
    }
    interface Page { state: State; box: BoundingBox; }
    const page = (items: readonly unknown[], box: BoundingBox, children: State[]): Page => { const s = create(); adopt(s, children); s.node.getBounds = () => box; s.node.isLeaf = () => !children.length; s.node.getEntries = () => [...items]; return { state: s, box }; };
    // One leaf is a valid R+ tree and avoids inventing overlapping spatial partitions.
    if (family === "RPlusTree") return [page(entries, union(entries.map(entry => entry.bounds)), []).state.node];
    let level = groups(entries, maximum).map(items => page(items, union(items.map(entry => entry.bounds)), []));
    while (level.length > 1) level = groups(level, maximum).map(pages => page(pages.map(p => ({ kind: "branch", bounds: p.box, child: p.state.node })), union(pages.map(p => p.box)), pages.map(p => p.state)));
    return [level[0].state.node];
}

function metric<E>(family: string, values: readonly E[], options: SpecializedTreeOptions<E>): object[] {
    const pointOf = options.pointOf;
    const distance = options.distance ?? (pointOf ? ((a: E, b: E) => { const p = pointOf(a), q = pointOf(b); if (p.length !== q.length || !p.length || [...p, ...q].some(x => !Number.isFinite(x))) throw new TypeError("pointOf must return finite equal-dimensional points"); return Math.hypot(...p.map((x, i) => x - q[i])); }) : undefined);
    if (!distance) throw new TypeError(`${family} requires options.distance or options.pointOf`);
    const d = (a: E, b: E): number => { const result = numeric(distance(a, b), "distance"); if (result < 0) throw new TypeError("distance must be nonnegative"); return result; };
    if (family === "MetricTree") {
        const maximum = orderOf(options);
        interface Page { state: State; center: E; radius: number; values: E[]; }
        const build = (items: E[]): Page => {
            const s = create(), center = items[0], radius = Math.max(...items.map(value => d(center, value)));
            if (items.length <= maximum) { s.node.isLeaf = () => true; s.node.getEntries = () => items.map(element => ({ kind: "leaf", element, parentDistance: d(center, element) })); }
            else {
                const children = groups(items, Math.max(maximum, Math.ceil(items.length / maximum))).map(group => build(group)); adopt(s, children.map(child => child.state)); s.node.isLeaf = () => false;
                s.node.getEntries = () => children.map(child => ({ kind: "branch", center: child.center, radius: child.radius, parentDistance: d(center, child.center), child: child.state.node }));
            }
            return { state: s, center, radius, values: items };
        };
        return [build([...values]).state.node];
    }
    if (family === "CoverTree") {
        const parentOf = requireOption(family, options, "parentOf"), levelOf = requireOption(family, options, "levelOf");
        const roots = topology(family, values, { ...options, parentOf });
        const all = values.map(value => ({ value, level: levelOf(value), state: topologyLookup(roots, value) }));
        for (const item of all) {
            if (typeof item.level !== "bigint" || !Number.isFinite(2 ** Number(item.level)) || 2 ** Number(item.level) === 0) throw new TypeError("CoverTree levels must be bigint with finite positive scale");
            item.state.node.getLevel = () => item.level;
            if (item.state.parent) { const parent = all.find(other => other.state === item.state.parent)!; if (parent.level <= item.level || d(parent.value, item.value) > 2 ** Number(parent.level)) throw new TypeError("CoverTree violates covering or decreasing levels"); }
        }
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (d(all[i].value, all[j].value) <= 2 ** Number(all[i].level < all[j].level ? all[i].level : all[j].level)) throw new TypeError("CoverTree violates level separation");
        return roots.map(s => s.node);
    }
    if (family === "BallTree" && !pointOf) throw new TypeError("BallTree requires options.pointOf to determine its center coordinates");
    const build = (items: E[]): State => {
        const element = items[0], rest = items.slice(1).map(value => ({ value, distance: d(element, value) })).sort((a, b) => a.distance - b.distance), middle = Math.floor(rest.length / 2);
        const s = create(element, true), left = middle ? build(rest.slice(0, middle).map(item => item.value)) : undefined, right = middle < rest.length ? build(rest.slice(middle).map(item => item.value)) : undefined;
        s.children = [left, right] as State[]; for (const child of s.children) if (child) child.parent = s;
        const threshold = rest[middle]?.distance ?? 0, radius = rest.length ? rest[rest.length - 1].distance : 0;
        s.node.getThreshold = () => threshold; s.node.getCenter = () => [...pointOf!(element)]; s.node.getRadius = () => radius; return s;
    };
    return [build([...values]).node];
}

function topologyLookup(roots: State[], value: unknown): State {
    const pending = [...roots];
    while (pending.length) { const s = pending.pop()!; if (Object.is(s.element, value)) return s; pending.push(...s.children); }
    throw new TypeError("Unknown topology element");
}
function topology<E>(family: string, values: readonly E[], options: SpecializedTreeOptions<E>): State[] {
    if (!options.parentOf && !options.childrenOf) throw new TypeError(`${family} requires options.parentOf or options.childrenOf to define its topology`);
    if (new Set(values).size !== values.length) throw new TypeError(`${family}: repeated identical elements require buildNodes to identify occurrences`);
    const states = new Map<E, State>(values.map(value => [value, create(value)]));
    const link = (parent: E, child: E): void => {
        const p = states.get(parent), c = states.get(child);
        if (!p || !c) throw new TypeError(`${family}: topology references an element outside values`);
        if (c.parent) throw new TypeError(`${family}: each node must have one structural parent`);
        p.children.push(c); c.parent = p;
    };
    if (options.childrenOf) for (const value of values) for (const child of options.childrenOf(value)) link(value, child);
    else for (const value of values) { const parent = options.parentOf!(value); if (parent !== undefined) link(parent, value); }
    const roots = [...states.values()].filter(s => !s.parent), visited = new Set<State>();
    const walk = (s: State): void => { if (visited.has(s)) throw new TypeError(`${family}: topology contains a cycle`); visited.add(s); s.children.forEach(walk); };
    roots.forEach(walk); if (visited.size !== values.length) throw new TypeError(`${family}: topology contains a cycle`);
    return roots;
}

function huffman<E>(values: readonly E[], options: SpecializedTreeOptions<E>): object[] {
    const weightOf = requireOption("HuffmanTree", options, "weightOf"), weights = new WeakMap<State, bigint>();
    const queue = values.map(value => { const s = create(value, true), weight = weightOf(value); if (typeof weight !== "bigint" || weight < 0n) throw new TypeError("weightOf must return a nonnegative bigint"); weights.set(s, weight); s.node.getWeight = () => weights.get(s)!; return s; });
    while (queue.length > 1) {
        queue.sort((a, b) => weights.get(a)! < weights.get(b)! ? -1 : weights.get(a)! > weights.get(b)! ? 1 : 0);
        const left = queue.shift()!, right = queue.shift()!, s = create(undefined, true); adopt(s, [left, right]); weights.set(s, weights.get(left)! + weights.get(right)!); s.node.getWeight = () => weights.get(s)!; queue.push(s);
    }
    return [queue[0].node];
}

function semantic<E>(family: string, values: readonly E[], options: SpecializedTreeOptions<E>): object[] {
    if (family === "MerkleTree" && !options.parentOf && !options.childrenOf) {
        const hash = requireOption(family, options, "hash");
        const build = (items: readonly E[]): State => {
            const s = create(items.length === 1 ? items[0] : undefined);
            if (items.length > 1) { const middle = Math.floor(items.length / 2); adopt(s, [build(items.slice(0, middle)), build(items.slice(middle))]); }
            const digest = hash(s.element as E | undefined, s.children.map(child => (child.node.getDigest as () => unknown)()));
            s.node.getDigest = () => digest; return s;
        };
        return [build(values).node];
    }
    const roots = topology(family, values, options);
    const visit = (s: State): void => {
        s.children.forEach(visit); const value = s.element as E, n = s.node;
        switch (family) {
            case "ExpressionTree": {
                const operatorOf = requireOption(family, options, "operatorOf"), operator = operatorOf(value);
                if (s.children.length && operator == null) throw new TypeError("ExpressionTree internal nodes require an operator");
                n.getOperator = () => optional(operator); n.getArity = () => BigInt(s.children.length); break;
            }
            case "ParseTree": case "AbstractSyntaxTree": {
                const callback = family === "AbstractSyntaxTree" ? requireOption(family, options, "kindOf") : requireOption(family, options, "symbolOf");
                const kind = callback(value), span = options.spanOf?.(value);
                if (kind == null) throw new TypeError(`${family} kind/symbol cannot be absent`);
                if (span && (span.start < 0n || span.end < span.start)) throw new TypeError("Source spans must be nonnegative half-open intervals");
                n[family === "AbstractSyntaxTree" ? "getKind" : "getSymbol"] = () => kind; n.getSpan = () => optional(span); break;
            }
            case "DecisionTree": {
                const testOf = requireOption(family, options, "testOf"), predictionOf = requireOption(family, options, "predictionOf"), labelOf = requireOption(family, options, "labelOf");
                const test = testOf(value), prediction = predictionOf(value);
                if (s.children.length ? test == null || prediction != null : test != null || prediction == null) throw new TypeError("DecisionTree branches need a test, and leaves need only a prediction");
                n.getTest = () => optional(test); n.getPrediction = () => optional(prediction); n.getEdges = () => s.children.map((child, i) => ({ label: labelOf(value, child.element as E, i), child: child.node })); break;
            }
            case "GameTree": {
                const playerOf = requireOption(family, options, "playerOf"), scoreOf = requireOption(family, options, "scoreOf"), labelOf = requireOption(family, options, "labelOf");
                const player = playerOf(value), score = scoreOf(value), moves = s.children.map((child, i) => ({ action: labelOf(value, child.element as E, i), probability: options.probabilityOf?.(value, child.element as E, i), child: child.node }));
                if (score !== undefined) numeric(score, "game score");
                if (moves.some(move => move.probability !== undefined)) { if (player !== undefined || moves.some(move => move.probability === undefined || move.probability < 0 || move.probability > 1) || Math.abs(moves.reduce((sum, move) => sum + (move.probability ?? 0), 0) - 1) > 1e-12) throw new TypeError("Chance moves require absent player and probabilities summing to one"); }
                n.getPlayer = () => optional(player); n.getScore = () => optional(score); n.getMoves = () => [...moves]; break;
            }
            case "MerkleTree": {
                const hash = requireOption(family, options, "hash"), digest = hash(value, s.children.map(child => (child.node.getDigest as () => unknown)())); n.getDigest = () => digest; break;
            }
            case "ShortestPathTree": {
                const distanceOf = requireOption(family, options, "distanceOf"), incomingWeightOf = requireOption(family, options, "incomingWeightOf"), distance = distanceOf(value), incoming = s.parent ? incomingWeightOf(value) : undefined;
                if (distance == null || (s.parent && incoming == null)) throw new TypeError("ShortestPathTree requires distances and nonroot incoming weights");
                n.getDistance = () => distance; n.getIncomingWeight = () => optional(incoming); break;
            }
            case "MinimumSpanningTree": {
                const incomingWeightOf = requireOption(family, options, "incomingWeightOf"), incoming = s.parent ? incomingWeightOf(value) : undefined;
                if (s.parent && incoming == null) throw new TypeError("MinimumSpanningTree requires each nonroot incoming weight"); n.getIncomingWeight = () => optional(incoming); break;
            }
            case "DominatorTree": break;
            case "VirtualTree": {
                const originalDepthOf = requireOption(family, options, "originalDepthOf"), pathWeightOf = requireOption(family, options, "pathWeightOf"), isKeyVertex = requireOption(family, options, "isKeyVertex"), depth = originalDepthOf(value), path = s.parent ? pathWeightOf(value) : undefined;
                if (typeof depth !== "bigint" || depth < 0n || (s.parent && path == null)) throw new TypeError("VirtualTree requires nonnegative bigint original depths and nonroot path weights");
                if (s.parent && originalDepthOf(s.parent.element as E) >= depth) throw new TypeError("VirtualTree parent depth must be smaller than child depth");
                n.getOriginalDepth = () => depth; n.getPathWeight = () => optional(path); n.isKeyVertex = () => isKeyVertex(value); break;
            }
        }
    };
    roots.forEach(visit); return roots.map(s => s.node);
}

function linkCut<E>(values: readonly E[], options: SpecializedTreeOptions<E>): object[] {
    // Start with singleton preferred paths. Represented-tree edges remain path-parent links.
    const represented = options.parentOf || options.childrenOf ? topology("LinkCutTree", values, options) : values.map(value => create(value));
    const roots: State[] = [];
    const visit = (s: State): void => {
        const parent = s.parent, children = [...s.children];
        s.parent = undefined; s.children = []; const result = aggregate("LinkCutTree", [s.element as E], options);
        s.node.getAuxiliaryParent = empty; s.node.getLeft = empty; s.node.getRight = empty; s.node.getPathParent = () => optional(parent?.node); s.node.isReversed = () => false; s.node.getAggregate = () => result; s.node.getPendingUpdate = empty;
        roots.push(s); children.forEach(visit);
    };
    represented.forEach(visit); return roots.map(s => s.node);
}
function topTree<E>(values: readonly E[], options: SpecializedTreeOptions<E>): object[] {
    const boundariesOf = requireOption("TopTree", options, "boundariesOf");
    const build = (items: readonly E[]): State => {
        const s = create(), boundaries = [...boundariesOf(items)], result = aggregate("TopTree", items, options);
        if (boundaries.length > 2) throw new TypeError("TopTree clusters have at most two boundary vertices");
        if (items.length > 1) { const middle = Math.floor(items.length / 2); adopt(s, [build(items.slice(0, middle)), build(items.slice(middle))]); }
        ncheck(s, boundaries); s.node.getBoundaries = () => [...boundaries]; s.node.getAggregate = () => result; return s;
    };
    const ncheck = (s: State, boundary: E[]): void => {
        if (!s.children.length) return;
        const a = (s.children[0].node.getBoundaries as () => E[])(), b = (s.children[1].node.getBoundaries as () => E[])();
        if (a.filter(x => b.includes(x)).length !== 1 || boundary.some(x => !a.includes(x) && !b.includes(x))) throw new TypeError("TopTree sibling clusters must share one boundary and contain the parent boundaries");
    };
    return [build(values).node];
}

/** Builds structural roots, preserving each family's actual node and navigation contract. */
export function buildSpecializedTree<E>(family: string, values: readonly E[], options: SpecializedTreeOptions<E>): unknown[] {
    if (!values.length) return [];
    if (options.buildNodes) return [...options.buildNodes(values)];
    if (values.some(value => value === null || value === undefined)) throw new TypeError("Tree elements cannot be null or undefined");
    switch (family) {
        case "SearchTree": case "TwoThreeTree": case "TwoThreeFourTree": case "BTree": case "BPlusTree": case "BStarTree": return searchPages(family, values, options);
        case "BinomialHeap": case "FibonacciHeap": return heaps(family, values, options);
        case "WinnerTree": case "LoserTree": return tournament(family, values, options);
        case "Trie": case "CompressedTrie": case "PatriciaTrie": case "TernarySearchTree": return prefix(family, values, options);
        case "SuffixTree": return suffix(values);
        case "SegmentTree": case "FenwickTree": return ranges(family, values, options);
        case "IntervalTree": return interval(values, options);
        case "PrioritySearchTree": case "KDimensionalTree": case "Quadtree": case "Octree": return points(family, values, options);
        case "RTree": case "RPlusTree": case "RStarTree": case "BoundingVolumeHierarchy": return spatial(family, values, options);
        case "BallTree": case "VantagePointTree": case "CoverTree": case "MetricTree": return metric(family, values, options);
        case "HuffmanTree": return huffman(values, options);
        case "ExpressionTree": case "ParseTree": case "AbstractSyntaxTree": case "DecisionTree": case "GameTree": case "MerkleTree": case "ShortestPathTree": case "MinimumSpanningTree": case "DominatorTree": case "VirtualTree": return semantic(family, values, options);
        case "LinkCutTree": return linkCut(values, options);
        case "TopTree": return topTree(values, options);
        default: throw new TypeError(`Unknown specialized tree family: ${family}`);
    }
}
