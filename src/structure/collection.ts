import { Optional } from "#semantic/optional";
import { useHash } from "#semantic/hash";
import * as brands from "#semantic/symbol";
import { AsynchronousCollectionSymbol, SynchronousCollectionSymbol } from "#semantic/symbol";
import type { BiConsumer, Comparator, Consumer } from "#semantic/utility";

/**
 * A collection of elements supporting asynchronous operations.
 *
 * Most operations return a promise representing their result. Iteration
 * through `Iterable`, the `clear` operation and creation of the `stream` view
 * remain synchronous.
 *
 * @template E the type of elements in this collection
 */
export interface AsynchronousCollection<E> extends Iterable<E>{

    /** Identifies this value as an asynchronous collection at runtime. */
    readonly [AsynchronousCollectionSymbol]: unique symbol;

    /**
     * Adds the specified element to this collection.
     *
     * @param element the element to be added to this collection
     * @returns a promise that resolves to `true` if this collection
     *         changed as a result of the call
     */
    add(element: E): Promise<boolean>;

    /**
     * Adds all of the elements in the specified collection to this collection.
     *
     * @param elements the collection containing elements to be added to this
     *        collection
     * @returns a promise that resolves to `true` if this collection
     *         changed as a result of the call
     */
    addAll(elements: AsynchronousCollection<E>): Promise<boolean>;

    /**
     * Removes all of the elements from this collection.
     *
     * The collection will be empty after this method returns.
     */
    clear(): void;

    /**
     * Returns a promise indicating whether this collection contains the
     * specified element.
     *
     * @param element the element whose presence in this collection is to be tested
     * @returns a promise that resolves to `true` if this collection
     *         contains the specified element
     */
    contains(element: E): Promise<boolean>;

    /**
     * Returns a promise indicating whether this collection contains the
     * specified value.
     *
     * @param target the value whose presence in this collection is to be tested
     * @returns a promise that resolves to `true` if this collection
     *         contains the specified value
     */
    contains(target: unknown): Promise<boolean>;

    /**
     * Returns a promise indicating whether this collection contains all of the
     * elements in the specified collection.
     *
     * @param collection the collection to be checked for containment in this
     *        collection
     * @returns a promise that resolves to `true` if this collection
     *         contains all of the elements in the specified collection
     */
    containsAll(collection: AsynchronousCollection<unknown>): Promise<boolean>;

    /**
     * Compares the specified collection with this collection for equality.
     *
     * The equality criteria are defined by the implementation.
     *
     * @param other the collection to be compared for equality with this collection
     * @returns a promise that resolves to `true` if the specified
     *         collection is equal to this collection
     */
    equals(other: AsynchronousCollection<unknown>): Promise<boolean>;

    /**
     * Performs the given action for each element of this collection.
     *
     * @param action the action to be performed for each element
     * @returns a promise that resolves when all actions have been performed
     */
    forEach(action: Consumer<E>): Promise<void>;

    /**
     * Performs the given action for each element of this collection, supplying
     * the element and its index to the action.
     *
     * @param action the action to be performed for each element and its index
     * @returns a promise that resolves when all actions have been performed
     */
    forEach(action: BiConsumer<E, bigint>): Promise<void>;

    /**
     * Returns a promise containing the hash code value for this collection.
     *
     * @returns a promise that resolves to the hash code value for this collection
     */
    hashCode(): Promise<bigint>;

    /**
     * Returns a promise indicating whether this collection contains no elements.
     *
     * @returns a promise that resolves to `true` if this collection
     *         contains no elements
     */
    isEmpty(): Promise<boolean>;

    /**
     * Removes a single instance of the specified element from this collection,
     * if it is present.
     *
     * @param element the element to be removed from this collection, if present
     * @returns a promise that resolves to `true` if an element was removed
     *         as a result of the call
     */
    remove(element: E): Promise<boolean>;

    /**
     * Removes all of this collection's elements that are also contained in the
     * specified collection.
     *
     * @param elements the collection containing elements to be removed from this
     *        collection
     * @returns a promise that resolves to `true` if this collection
     *         changed as a result of the call
     */
    removeAll(elements: AsynchronousCollection<E>): Promise<boolean>;

    /**
     * Returns a promise containing the intersection of this collection and the
     * specified collection.
     *
     * @param other the collection with which the intersection is to be calculated
     * @returns a promise that resolves to a collection containing the elements
     *         present in both collections
     */
    intersection(other: AsynchronousCollection<E>): Promise<AsynchronousCollection<E>>;

    /**
     * Returns a promise containing the union of this collection and the
     * specified collection.
     *
     * @param other the collection with which the union is to be calculated
     * @returns a promise that resolves to a collection containing the elements
     *         present in either collection
     */
    union(other: AsynchronousCollection<E>): Promise<AsynchronousCollection<E>>;

    /**
     * Returns a promise containing the complement of this collection relative
     * to the specified collection.
     *
     * @param relative the collection relative to which the complement is to be
     *        calculated
     * @returns a promise that resolves to the relative complement of this
     *         collection
     */
    complement(relative: AsynchronousCollection<E>): Promise<AsynchronousCollection<E>>;
    
    /**
     * Returns a promise containing the number of elements in this collection.
     *
     * @returns a promise that resolves to the number of elements in this collection
     */
    size(): Promise<bigint>;

    /**
     * Returns a stream view of this collection directly.
     *
     * Asynchronous processing is handled by the returned view itself.
     *
     * @returns a stream view of this collection
     */
    stream(): AsynchronousCollection<E>;

    /**
     * Returns a promise containing an array of all of the elements in this
     * collection.
     *
     * @returns a promise that resolves to an array containing all of the elements
     *         in this collection
     */
    toArray(): Promise<Array<E>>;
}

/**
 * A collection of elements supporting synchronous operations.
 *
 * Each operation returns its result directly rather than through a promise.
 *
 * @template E the type of elements in this collection
 */
export interface SynchronousCollection<E> extends Iterable<E>{

    /** Identifies this value as a synchronous collection at runtime. */
    readonly [SynchronousCollectionSymbol]: unique symbol;

    /**
     * Adds the specified element to this collection.
     *
     * @param element the element to be added to this collection
     * @returns `true` if this collection changed as a result of the call
     */
    add(element: E): boolean;

    /**
     * Adds all of the elements in the specified collection to this collection.
     *
     * @param elements the collection containing elements to be added to this
     *        collection
     * @returns `true` if this collection changed as a result of the call
     */
    addAll(elements: SynchronousCollection<E>): boolean;

    /**
     * Removes all of the elements from this collection.
     *
     * The collection will be empty after this method returns.
     */
    clear(): void;

    /**
     * Returns `true` if this collection contains the specified element.
     *
     * @param element the element whose presence in this collection is to be tested
     * @returns `true` if this collection contains the specified element
     */
    contains(element: E): boolean;

    /**
     * Returns `true` if this collection contains the specified value.
     *
     * @param target the value whose presence in this collection is to be tested
     * @returns `true` if this collection contains the specified value
     */
    contains(target: unknown): boolean;

    /**
     * Returns `true` if this collection contains all of the elements in
     * the specified collection.
     *
     * @param collection the collection to be checked for containment in this
     *        collection
     * @returns `true` if this collection contains all of the elements in
     *         the specified collection
     */
    containsAll(collection: SynchronousCollection<unknown>): boolean;

    /**
     * Compares the specified collection with this collection for equality.
     *
     * The equality criteria are defined by the implementation.
     *
     * @param other the collection to be compared for equality with this collection
     * @returns `true` if the specified collection is equal to this collection
     */
    equals(other: SynchronousCollection<unknown>): boolean;

    /**
     * Performs the given action for each element of this collection.
     *
     * @param action the action to be performed for each element
     */
    forEach(action: Consumer<E>): void;

    /**
     * Performs the given action for each element of this collection, supplying
     * the element and its index to the action.
     *
     * @param action the action to be performed for each element and its index
     */
    forEach(action: BiConsumer<E, bigint>): void;

    /**
     * Returns the hash code value for this collection.
     *
     * @returns the hash code value for this collection
     */
    hashCode(): bigint;

    /**
     * Returns `true` if this collection contains no elements.
     *
     * @returns `true` if this collection contains no elements
     */
    isEmpty(): boolean;

    /**
     * Removes a single instance of the specified element from this collection,
     * if it is present.
     *
     * @param element the element to be removed from this collection, if present
     * @returns `true` if an element was removed as a result of the call
     */
    remove(element: E): boolean;

    /**
     * Removes all of this collection's elements that are also contained in the
     * specified collection.
     *
     * @param elements the collection containing elements to be removed from this
     *        collection
     * @returns `true` if this collection changed as a result of the call
     */
    removeAll(elements: SynchronousCollection<E>): boolean;

    /**
     * Returns the intersection of this collection and the specified collection.
     *
     * @param other the collection with which the intersection is to be calculated
     * @returns a collection containing the elements present in both collections
     */
    intersection(other: SynchronousCollection<E>): SynchronousCollection<E>;

    /**
     * Returns the union of this collection and the specified collection.
     *
     * @param other the collection with which the union is to be calculated
     * @returns a collection containing the elements present in either collection
     */
    union(other: SynchronousCollection<E>): SynchronousCollection<E>;

    /**
     * Returns the complement of this collection relative to the specified
     * collection.
     *
     * @param relative the collection relative to which the complement is to be
     *        calculated
     * @returns the relative complement of this collection
     */
    complement(relative: SynchronousCollection<E>): SynchronousCollection<E>;
    
    /**
     * Returns the number of elements in this collection.
     *
     * @returns the number of elements in this collection
     */
    size(): bigint;

    /**
     * Returns a stream view of this collection.
     *
     * @returns a stream view of this collection
     */
    stream(): SynchronousCollection<E>;

    /**
     * Returns an array containing all of the elements in this collection.
     *
     * @returns an array containing all of the elements in this collection
     */
    toArray(): Array<E>;
}

/**
 * Collection constructor options. LRU capacity defaults to 1024n and must be positive.
 * Skip sets accept a total comparator consistent with SameValueZero equality;
 * ordered sets use the comparator for equality and iteration order. When no
 * comparator is supplied, ordered sets use `useCompare`, while skip sets use a
 * default that compares same-type strings, booleans, numbers or bigints, with
 * NaN after other numbers. Other element types require an explicit comparator.
 */
export interface CollectionOptions<E> {
    /** Positive LRU capacity; defaults to 1024n. */
    capacity?: bigint;
    /** Total element order used by ordered and navigable sets. */
    comparator?: Comparator<E>;
}

/**
 * Creates an asynchronous collection directly. Promise methods wait for source
 * initialisation; synchronous iteration snapshots currently ready elements.
 * clear() immediately clears ready elements and discards earlier queued writes
 * and remaining source values. Later operations execute in invocation order.
 * Brands are immutable own symbol properties, including all inherited brands;
 * each property's value equals its symbol key. Elements use SameValueZero equality.
 */
export interface AsynchronousCollectionConstructor {
    new <E = unknown>(): AsynchronousCollection<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): AsynchronousCollection<E>;
    new <E>(source: AsyncIterable<E>, options?: CollectionOptions<E>): AsynchronousCollection<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): AsynchronousCollection<E>;
}
/** Creates a synchronous collection; async-only sources throw TypeError. */
export interface SynchronousCollectionConstructor {
    new <E = unknown>(): SynchronousCollection<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): SynchronousCollection<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): SynchronousCollection<E>;
}

/** @internal Shared configuration for owned collections and backed map collection views. */
export interface CollectionRuntimeConfig<E> {
    /** Whether operations join the asynchronous invocation queue. */
    asynchronous: boolean;
    /** Collection contract implemented by this instance. */
    kind: "collection" | "list" | "set";
    /** Optional eviction or navigation behaviour layered over the collection. */
    family?: "base" | "lru" | "skip";
    /** Whether a set uses comparator equality and comparator-ascending iteration. */
    ordered?: boolean;
    /** Initial elements; asynchronous sources require asynchronous operations. */
    source?: Iterable<E> | AsyncIterable<E>;
    capacity?: bigint;
    comparator?: Comparator<E>;
    /** Reads the current elements of a collection backed by another container. */
    getValues?: () => E[];
    /** Optional insertion callback for a backed view. */
    addValue?: (value: E) => boolean;
    /** Optional positional insertion callback for a backed list view. */
    insertValue?: (index: number, value: E) => boolean;
    /** Optional positional replacement callback for a backed list view. */
    setValue?: (index: number, value: E) => void;
    /** Optional removal callback for a backed view. */
    removeValue?: (value: E) => boolean;
    /** Atomically replaces all values in a backed container. */
    replaceValues?: (values: readonly E[]) => boolean;
    /** Optional callback that clears the backing container. */
    clearValues?: () => void;
    /** Initialisation of the backing container, awaited before operations. */
    readiness?: Promise<void>;
    /** Overrides SameValueZero equality, for example for backed map entries. */
    equalsValue?: (left: unknown, right: unknown) => boolean;
    /** Hashes values consistently with the configured equality. */
    hashValue?: (value: E) => bigint;
}

const runtimeViews = new WeakMap<object, {
    read: () => unknown[];
    ready: () => Promise<void>;
    query: (read: () => unknown) => unknown;
    owner: object;
}>();

/** @internal Reads a backed container's metadata in the same invocation queue as its elements. */
export function readCollection<T>(collection: object, read: () => T): T | Promise<T> {
    const runtime = runtimeViews.get(collection);
    if (!runtime) throw new TypeError("Expected an owned collection runtime.");
    return runtime.query(read) as T | Promise<T>;
}

type Node<E> = { value: E; access: bigint; bucket?: bigint };
type Bound<E> = { value: E; inclusive: boolean };
type View<E> = {
    start?: number;
    end?: number;
    parent?: View<E>;
    lower?: Bound<E>;
    upper?: Bound<E>;
    descending?: boolean;
};

/** SameValueZero equality preserves object identity and considers NaN equal to NaN. */
const collectionValueEquals = (left: unknown, right: unknown): boolean =>
    left === right || (left !== left && right !== right);

/** Default total order for non-null strings, booleans, numbers and bigints of one type. */
function defaultCollectionComparator<E>(left: E, right: E): number {
    const type = typeof left;
    if (left == null || right == null || type !== typeof right ||
        !["string", "boolean", "number", "bigint"].includes(type)) {
        throw new TypeError("Supply a comparator for values other than same-type strings, booleans, numbers or bigints.");
    }
    if (collectionValueEquals(left, right)) return 0;
    if (type === "number") {
        if (Number.isNaN(left)) return 1;
        if (Number.isNaN(right)) return -1;
    }
    return left < right ? -1 : 1;
}

/**
 * @internal
 * Creates the runtime behind the typed public constructors. Every instance carries
 * its collection, list/set and family symbol brands as immutable own properties;
 * each brand's value is its symbol key. Iterators capture a synchronous snapshot.
 *
 * Async operations wait for initialisation and run in invocation order. clear()
 * empties the currently visible view immediately and cancels writes submitted
 * before it, including unread async source values; subsequent writes remain valid.
 * A getValues view without addValue supports removal but rejects insertion.
 */
export function createCollection<E>(config: CollectionRuntimeConfig<E>): unknown {
    const family = config.family ?? "base";
    const ordered = config.kind === "set" && config.ordered === true;
    const equal = config.equalsValue ?? collectionValueEquals;
    const compare = config.comparator ?? defaultCollectionComparator<E>;
    /** Ordered sets derive element equality from the comparator. */
    const elementEquals = ordered
        ? (left: unknown, right: unknown): boolean => compare(left as E, right as E) === 0
        : equal;
    let capacity = config.capacity ?? 1024n;
    const checkCapacity = (value: bigint): void => {
        if (typeof value !== "bigint" || value < 1n) throw new RangeError("Capacity must be a positive bigint.");
    };
    if (family === "lru") checkCapacity(capacity);
    if (!config.asynchronous && config.source && !(Symbol.iterator in Object(config.source))) {
        throw new TypeError("Synchronous constructors require an Iterable source.");
    }
    const external = config.getValues !== undefined;
    /** Base unordered sets hash elements into buckets for membership and iteration. */
    const hashBuckets = !external && config.kind === "set" && !ordered && family === "base";
    const buckets = new Map<bigint, Node<E>[]>();
    const bucketHash = (value: E): bigint => {
        const normalized = value === 0 ? 0 : value;
        const hashed = config.hashValue ? config.hashValue(value) : useHash(normalized as E);
        return typeof hashed === "bigint" ? hashed : 0n;
    };
    const findBucketNode = (value: E): Node<E> | undefined => {
        const bucket = buckets.get(bucketHash(value));
        return bucket?.find(node => equal(node.value, value));
    };
    let nodes: Node<E>[] = [];
    let sequence = 0n;
    let epoch = 0;
    let readiness: Promise<void> = config.readiness ?? Promise.resolve();
    let queue: Promise<unknown> = readiness;
    const root: View<E> = {};
    const owner = {};
    const validateValue = (value: E): void => {
        if ((config.kind === "list" || family === "lru" || family === "skip") && value == null) {
            throw new TypeError("Lists, LRU collections and skip collections do not accept null or undefined.");
        }
        if (ordered) {
            const self = compare(value, value);
            if (!Number.isFinite(self) || self !== 0) {
                throw new TypeError("Comparator must return zero for a value compared with itself.");
            }
        } else if (family === "skip" && config.kind === "set") {
            compare(value, value);
        }
    };
    const inBounds = (value: E, view: View<E>): boolean => {
        if (view.lower) {
            const result = compare(value, view.lower.value);
            if (result < 0 || (result === 0 && !view.lower.inclusive)) return false;
        }
        if (view.upper) {
            const result = compare(value, view.upper.value);
            if (result > 0 || (result === 0 && !view.upper.inclusive)) return false;
        }
        return true;
    };
    const visibleNodes = (view: View<E>): Node<E>[] => {
        let result: Node<E>[];
        if (external) result = config.getValues!().map(value => ({ value, access: 0n }));
        else if (hashBuckets) result = [...buckets.values()].flat();
        else result = nodes.slice();
        if (config.kind === "list" && view.start !== undefined) result = result.slice(view.start, view.end);
        if (config.kind === "set" && ordered) result.sort((a, b) => compare(a.value, b.value));
        if (family === "skip" && config.kind === "set") {
            result = result.filter(node => inBounds(node.value, view));
            if (!ordered) result.sort((a, b) => compare(a.value, b.value));
            if (view.descending) result.reverse();
        } else if (family === "lru" && config.kind === "set" && !ordered) {
            result.sort((a, b) => a.access < b.access ? -1 : a.access > b.access ? 1 : 0);
        }
        return result;
    };
    const values = (view: View<E>): E[] => visibleNodes(view).map(node => node.value);
    const updateEnds = (view: View<E>, delta: number): void => {
        for (let current: View<E> | undefined = view; current; current = current.parent) {
            if (current.end !== undefined) current.end += delta;
        }
    };
    const removeNode = (node: Node<E>, view: View<E>): boolean => {
        if (external) {
            if (!config.removeValue) throw new TypeError("This view does not support removal.");
            return config.removeValue(node.value);
        }
        const index = nodes.indexOf(node);
        if (index < 0) return false;
        nodes.splice(index, 1);
        if (hashBuckets && node.bucket !== undefined) {
            const bucket = buckets.get(node.bucket);
            if (bucket) {
                const position = bucket.indexOf(node);
                if (position >= 0) bucket.splice(position, 1);
                if (bucket.length === 0) buckets.delete(node.bucket);
            }
        }
        updateEnds(view, -1);
        return true;
    };
    const trim = (view: View<E>): void => {
        while (BigInt(nodes.length) > capacity) {
            const least = nodes.reduce((a, b) => a.access < b.access ? a : b);
            const position = nodes.indexOf(least);
            nodes.splice(position, 1);
            for (let current: View<E> | undefined = view; current; current = current.parent) {
                if (current.start !== undefined && current.end !== undefined) {
                    if (position < current.start) { current.start--; current.end--; }
                    else if (position < current.end) current.end--;
                }
            }
        }
    };
    const checkedIndex = (index: unknown, length: number, insert = false): number => {
        if (typeof index !== "bigint" || index < 0n || index > BigInt(length) || (!insert && index === BigInt(length))) {
            throw new RangeError("List index is out of bounds.");
        }
        return Number(index);
    };
    const insert = (value: E, view: View<E>, position?: number): boolean => {
        validateValue(value);
        if (!inBounds(value, view)) throw new RangeError("Element is outside the view's range.");
        if (external) {
            const target: number = (view.start ?? 0) + (position ?? visibleNodes(view).length);
            if (config.kind === "list" && config.insertValue) return config.insertValue(target, value);
            if (!config.addValue) throw new TypeError("This view does not support insertion.");
            return config.addValue(value);
        }
        if (config.kind === "set") {
            if (ordered) {
                let low = 0;
                let high = nodes.length;
                while (low < high) {
                    const middle = (low + high) >>> 1;
                    if (compare(nodes[middle].value, value) < 0) low = middle + 1;
                    else high = middle;
                }
                const existing = nodes[low];
                if (existing && compare(existing.value, value) === 0) {
                    if (family === "skip" && !equal(existing.value, value)) {
                        throw new TypeError("Comparator must be consistent with element equality.");
                    }
                    if (family === "lru") existing.access = ++sequence;
                    return false;
                }
                const node: Node<E> = { value, access: ++sequence };
                nodes.splice(low, 0, node);
                updateEnds(view, 1);
                if (family === "lru") trim(view);
                return true;
            }
            const existing = hashBuckets ? findBucketNode(value) : nodes.find(node => equal(node.value, value));
            if (existing) {
                if (family === "lru") existing.access = ++sequence;
                return false;
            }
            if (family === "skip" && nodes.some(node => compare(node.value, value) === 0)) {
                throw new TypeError("Comparator must be consistent with element equality.");
            }
            const node: Node<E> = { value, access: ++sequence };
            if (hashBuckets) {
                const bucket = bucketHash(value);
                node.bucket = bucket;
                const keys = buckets.get(bucket);
                if (keys) keys.push(node);
                else buckets.set(bucket, [node]);
            }
            nodes.push(node);
            updateEnds(view, 1);
            if (family === "lru") trim(view);
            return true;
        }
        const index = config.kind === "list" ? (view.start ?? 0) + (position ?? visibleNodes(view).length) : nodes.length;
        nodes.splice(index, 0, { value, access: ++sequence });
        updateEnds(view, 1);
        if (family === "lru") trim(view);
        return true;
    };
    const clearView = (view: View<E>): void => {
        if (external && view === root && config.clearValues) config.clearValues();
        else for (const node of visibleNodes(view)) removeNode(node, view);
    };
    const ownSource = config.source;
    if (ownSource) {
        if (Symbol.iterator in Object(ownSource)) {
            for (const value of ownSource as Iterable<E>) insert(value, root);
        } else if (Symbol.asyncIterator in Object(ownSource)) {
            const initialEpoch = epoch;
            readiness = readiness.then(async () => {
                for await (const value of ownSource) {
                    if (epoch !== initialEpoch) break;
                    insert(value, root);
                }
            });
        } else throw new TypeError("Source must be iterable.");
    }
    queue = readiness;
    // Install a rejection observer immediately; methods still propagate readiness errors.
    void readiness.catch(() => undefined);

    const build = (view: View<E>): Record<PropertyKey, any> => {
        const api: Record<PropertyKey, any> = {};
        const readOther = (other: any): E[] | Promise<E[]> => {
            if (other === api) return values(view);
            const runtime = other && runtimeViews.get(other);
            if (runtime) {
                if (!config.asynchronous || runtime.owner === owner) return runtime.read() as E[];
                return runtime.ready().then(() => runtime.read() as E[]);
            }
            if (other && typeof other.toArray === "function") return other.toArray();
            if (other && Symbol.iterator in Object(other)) return Array.from(other as Iterable<E>);
            throw new TypeError("Expected a collection or iterable.");
        };
        const run = (operation: (writeAllowed: () => boolean) => unknown): unknown => {
            if (!config.asynchronous) return operation(() => true);
            const submittedEpoch = epoch;
            const result = queue.then(async () => {
                await readiness;
                return operation(() => submittedEpoch === epoch);
            });
            queue = result.then(() => undefined, () => undefined);
            return result;
        };
        const define = (name: string, operation: (args: any[], writeAllowed: () => boolean) => unknown): void => {
            api[name] = (...args: any[]) => {
                // Capture another runtime's current queue at invocation, so bulk
                // reads see preceding writes without creating mutual queue waits.
                const collectionArgument = ["addAll", "containsAll", "equals", "removeAll", "retainAll", "intersection", "union", "complement"].includes(name);
                if (config.asynchronous && collectionArgument) {
                    const index = name === "addAll" && args.length === 2 ? 1 : 0;
                    const other = args[index];
                    const runtime = other && runtimeViews.get(other);
                    if (runtime && runtime.owner !== owner) {
                        const snapshot = runtime.ready().then(() => runtime.read());
                        void snapshot.catch(() => undefined);
                        const proxy = Object.create(other);
                        proxy.toArray = () => snapshot;
                        args[index] = proxy;
                    }
                }
                return run(allowed => operation(args, allowed));
            };
        };
        const withOther = (other: any, operation: (items: E[]) => unknown): unknown => {
            const items = readOther(other);
            return items instanceof Promise ? items.then(operation) : operation(items);
        };
        const has = (items: unknown[], value: unknown): boolean => items.some(item => elementEquals(item, value));
        const containsValue = (value: unknown): boolean => {
            if (hashBuckets) {
                const bucket = buckets.get(bucketHash(value as E));
                return !!bucket && bucket.some(node => equal(node.value, value));
            }
            return values(view).some(item => elementEquals(item, value));
        };
        const setMarkers = [
            brands.AsynchronousOrderedSetSymbol, brands.AsynchronousUnorderedSetSymbol,
            brands.SynchronousOrderedSetSymbol, brands.SynchronousUnorderedSetSymbol,
            brands.AsynchronousLRUSetSymbol, brands.AsynchronousSkipSetSymbol,
            brands.SynchronousLRUSetSymbol, brands.SynchronousSkipSetSymbol,
        ];
        const removeWhere = (predicate: (value: E) => boolean, allowed: () => boolean): boolean => {
            if (!allowed()) return false;
            if (external && config.replaceValues && view === root) {
                const current = values(view);
                const candidate = current.filter(value => !predicate(value));
                return candidate.length !== current.length && config.replaceValues(candidate);
            }
            let changed = false;
            for (const node of visibleNodes(view)) {
                if (predicate(node.value)) changed = removeNode(node, view) || changed;
            }
            return changed;
        };
        const resultCollection = (items: E[]): unknown => createCollection({
            asynchronous: config.asynchronous, kind: config.kind === "set" ? "set" : "collection", source: items,
            equalsValue: config.equalsValue, hashValue: config.hashValue,
            ordered, comparator: config.comparator,
        });
        define("add", (args, allowed) => {
            if (config.kind === "list" && args.length === 2) {
                const index = checkedIndex(args[0], visibleNodes(view).length, true);
                if (allowed()) insert(args[1], view, index);
                return;
            }
            return allowed() && insert(args[0], view);
        });
        define("addAll", (args, allowed) => {
            const indexed = config.kind === "list" && args.length === 2;
            let position = indexed ? checkedIndex(args[0], visibleNodes(view).length, true) : undefined;
            return withOther(args[indexed ? 1 : 0], items => {
                if (external && config.replaceValues && view === root && position === undefined) {
                    const current = values(view);
                    const candidate = [...current, ...items];
                    return allowed() && config.replaceValues(candidate);
                }
                let changed = false;
                if (allowed()) for (const value of items) {
                    // Capacity eviction can shrink the view during a bulk insertion.
                    if (position !== undefined) position = Math.min(position, visibleNodes(view).length);
                    changed = insert(value, view, position) || changed;
                    if (position !== undefined) position++;
                }
                return changed;
            });
        });
        api.clear = (): void => {
            epoch++;
            clearView(view);
            // A cleared container must not remain blocked by an unfinished source
            // or an old bulk operation waiting on another collection. Their writes
            // still carry the previous epoch and cannot repopulate this container.
            readiness = Promise.resolve();
            queue = readiness;
        };
        define("contains", args => containsValue(args[0]));
        define("containsAll", args => withOther(args[0], items => items.every(item => containsValue(item))));
        define("equals", args => {
            const other = args[0];
            const marker = config.kind === "set" ? "Set" : config.kind === "list" ? "List" : "Collection";
            if (!other || !(brands.AsynchronousCollectionSymbol in Object(other) || brands.SynchronousCollectionSymbol in Object(other))) return false;
            if (marker === "List" && !(Symbol.for("AsynchronousList") in other || Symbol.for("SynchronousList") in other)) return false;
            if (marker === "Set" && !setMarkers.some(markerSymbol => markerSymbol in Object(other))) return false;
            return withOther(other, items => {
                const own = values(view);
                return own.length === items.length && (config.kind === "set" ? own.every(item => has(items, item)) : own.every((item, index) => equal(item, items[index])));
            });
        });
        define("forEach", args => { values(view).forEach((value, index) => args[0](value, BigInt(index))); });
        define("hashCode", () => values(view).reduce((hash, value) => {
            const itemHash = value == null ? 0n : (config.hashValue ? config.hashValue(value) : useHash(value));
            return config.kind === "set" ? hash + itemHash : 31n * hash + itemHash;
        }, config.kind === "set" ? 0n : 1n));
        define("isEmpty", () => visibleNodes(view).length === 0);
        define("remove", (args, allowed) => {
            const node = hashBuckets ? findBucketNode(args[0] as E)
                : visibleNodes(view).find(item => elementEquals(item.value, args[0]));
            return allowed() && node !== undefined && removeNode(node, view);
        });
        define("removeAll", (args, allowed) => withOther(args[0], items => removeWhere(value => has(items, value), allowed)));
        define("removeIf", (args, allowed) => removeWhere(args[0], allowed));
        define("retainAll", (args, allowed) => withOther(args[0], items => removeWhere(value => !has(items, value), allowed)));
        define("intersection", args => withOther(args[0], items => resultCollection(values(view).filter(value => has(items, value)))));
        define("union", args => withOther(args[0], items => resultCollection([...values(view), ...items])));
        define("complement", args => withOther(args[0], items => resultCollection(items.filter(value => !has(values(view), value)))));
        define("size", () => BigInt(visibleNodes(view).length));
        define("toArray", () => values(view));
        api.stream = () => api;
        api[Symbol.iterator] = () => values(view)[Symbol.iterator]();

        if (config.kind === "list") {
            define("get", args => {
                const items = visibleNodes(view);
                const node = items[checkedIndex(args[0], items.length)];
                if (family === "lru") node.access = ++sequence;
                return node.value;
            });
            define("set", (args, allowed) => {
                const items = visibleNodes(view);
                const index = checkedIndex(args[0], items.length);
                const node = items[index];
                validateValue(args[1]);
                const previous = node.value;
                if (allowed()) {
                    if (external) {
                        if (!config.setValue) throw new TypeError("This view does not support replacement.");
                        config.setValue((view.start ?? 0) + index, args[1]);
                    } else {
                        node.value = args[1];
                        if (family === "lru") node.access = ++sequence;
                    }
                }
                return previous;
            });
            define("removeAt", (args, allowed) => {
                const items = visibleNodes(view);
                const node = items[checkedIndex(args[0], items.length)];
                if (allowed()) removeNode(node, view);
                return node.value;
            });
            define("indexOf", args => BigInt(values(view).findIndex(value => equal(value, args[0]))));
            define("lastIndexOf", args => {
                const items = values(view);
                for (let index = items.length - 1; index >= 0; index--) if (equal(items[index], args[0])) return BigInt(index);
                return -1n;
            });
            define("replaceAll", (args, allowed) => {
                if (!allowed()) return;
                if (external) {
                    if (view !== root || !config.replaceValues) throw new TypeError("This view does not support replacement.");
                    const replaced: E[] = values(view).map(value => {
                        const next: E = args[0](value);
                        validateValue(next);
                        return next;
                    });
                    config.replaceValues(replaced);
                    return;
                }
                for (const node of visibleNodes(view)) {
                    const value = args[0](node.value); validateValue(value); node.value = value;
                    if (family === "lru") node.access = ++sequence;
                }
            });
            define("sort", (args, allowed) => {
                if (!allowed()) return;
                const items = visibleNodes(view).sort((a, b) => args[0](a.value, b.value));
                if (external) {
                    if (view !== root || !config.replaceValues) throw new TypeError("This view does not support sorting.");
                    config.replaceValues(items.map(node => node.value));
                    return;
                }
                nodes.splice(view.start ?? 0, items.length, ...items);
            });
            define("subList", args => {
                const length = visibleNodes(view).length;
                const start = checkedIndex(args[0], length, true);
                const end = checkedIndex(args[1], length, true);
                if (start > end) throw new RangeError("Range endpoints are reversed.");
                return build({ start: (view.start ?? 0) + start, end: (view.start ?? 0) + end, parent: view });
            });
            for (const end of ["Front", "Back"]) {
                const front = end === "Front";
                define(`peek${end}`, () => {
                    const items = visibleNodes(view);
                    return Optional.ofNullable(items[front ? 0 : items.length - 1]?.value);
                });
                define(`pop${end}`, (_args, allowed) => {
                    const items = visibleNodes(view);
                    const node = items[front ? 0 : items.length - 1];
                    if (node && allowed()) removeNode(node, view);
                    return Optional.ofNullable(node?.value);
                });
                for (const operation of ["offer", "push"]) define(`${operation}${end}`, (args, allowed) => allowed() && insert(args[0], view, front ? 0 : visibleNodes(view).length));
            }
        }
        if (family === "lru") {
            define("capacity", () => capacity);
            define("setCapacity", (args, allowed) => { checkCapacity(args[0]); if (allowed()) { capacity = args[0]; trim(view); } });
            define("touch", (args, allowed) => {
                const items = visibleNodes(view);
                const node = config.kind === "list" ? items[checkedIndex(args[0], items.length)] : items.find(item => equal(item.value, args[0]));
                if (node && allowed()) node.access = ++sequence;
                return config.kind === "list" ? undefined : node !== undefined;
            });
            for (const name of ["peekLeastRecent", "peekMostRecent", "pollLeastRecent"]) define(name, (_args, allowed) => {
                const items = visibleNodes(view).sort((a, b) => a.access < b.access ? -1 : a.access > b.access ? 1 : 0);
                const node = items[name === "peekMostRecent" ? items.length - 1 : 0];
                if (node && name === "pollLeastRecent" && allowed()) removeNode(node, view);
                if (!config.asynchronous) return Optional.ofNullable(node?.value);
                if (!node) throw new RangeError("Collection is empty.");
                return node.value;
            });
        }
        if (family === "skip" && config.kind === "set") {
            const viewCompare: Comparator<E> = (a, b) => (view.descending ? -1 : 1) * compare(a, b);
            define("comparator", () => viewCompare);
            const navigationResult = (node: Node<E> | undefined, remove: boolean, allowed: () => boolean): unknown => {
                if (node && remove && allowed()) removeNode(node, view);
                if (!config.asynchronous) return Optional.ofNullable(node?.value);
                if (!node) throw new RangeError("No matching element.");
                return node.value;
            };
            for (const name of ["first", "last", "pollFirst", "pollLast"]) define(name, (_args, allowed) => {
                const items = visibleNodes(view);
                return navigationResult(items[name.toLowerCase().endsWith("last") ? items.length - 1 : 0], name.startsWith("poll"), allowed);
            });
            for (const name of ["lower", "floor", "ceiling", "higher"]) define(name, args => {
                validateValue(args[0]);
                const lower = name === "lower" || name === "floor";
                const inclusive = name === "floor" || name === "ceiling";
                const items = visibleNodes(view).filter(node => {
                    const order = viewCompare(node.value, args[0]);
                    return lower ? order < 0 || (inclusive && order === 0) : order > 0 || (inclusive && order === 0);
                });
                return navigationResult(items[lower ? items.length - 1 : 0], false, () => true);
            });
            define("descendingSet", () => build({ ...view, descending: !view.descending }));
            api.descendingIterator = () => values(view).reverse()[Symbol.iterator]();
            const checkEndpoint = (value: E, inclusive: boolean): void => {
                validateValue(value);
                for (const [bound, direction] of [[view.lower, 1], [view.upper, -1]] as const) {
                    if (!bound) continue;
                    const order = compare(value, bound.value) * direction;
                    if (order < 0 || (order === 0 && inclusive && !bound.inclusive)) throw new RangeError("Endpoint is outside the enclosing range.");
                }
            };
            const range = (from?: Bound<E>, to?: Bound<E>): unknown => {
                if (from) checkEndpoint(from.value, from.inclusive);
                if (to) checkEndpoint(to.value, to.inclusive);
                if (from && to && viewCompare(from.value, to.value) > 0) throw new RangeError("Range endpoints are reversed.");
                const lower = view.descending ? to : from;
                const upper = view.descending ? from : to;
                return build({ ...view, lower: lower ?? view.lower, upper: upper ?? view.upper });
            };
            define("subSet", args => args.length === 2 ? range({ value: args[0], inclusive: true }, { value: args[1], inclusive: false }) : range({ value: args[0], inclusive: args[1] }, { value: args[2], inclusive: args[3] }));
            define("headSet", args => range(undefined, { value: args[0], inclusive: args[1] ?? false }));
            define("tailSet", args => range({ value: args[0], inclusive: args[1] ?? true }, undefined));
        }
        const prefix = config.asynchronous ? "Asynchronous" : "Synchronous";
        const names = [`${prefix}Collection`];
        if (config.kind === "list") names.push(`${prefix}List`);
        if (config.kind === "set") names.push(`${prefix}${ordered ? "Ordered" : "Unordered"}Set`);
        if (family !== "base") {
            const familyName = family === "lru" ? "LRU" : "Skip";
            names.push(`${prefix}${familyName}${config.kind === "list" ? "List" : "Set"}`);
            if (config.kind === "set") names.push(`${prefix}${ordered ? "Ordered" : "Unordered"}${familyName}Set`);
        }
        for (const name of names) {
            const key = brands[`${name}Symbol` as keyof typeof brands];
            Object.defineProperty(api, key, { value: key, writable: false, enumerable: false, configurable: false });
        }
        runtimeViews.set(api, { read: () => values(view), ready: () => Promise.all([readiness, queue]).then(() => undefined), query: read => run(read), owner });
        return api;
    };
    return build(root);
}

/**
 * @internal Creates a constructor for a collection family and kind.
 * Each constructor requires new and attaches its prototype to the returned container.
 * The optional behaviour fixes set ordering and supplies the ordered-set default
 * comparator; per-call options still take precedence.
 */
export function createCollectionConstructor(
    name: string,
    asynchronous: boolean,
    kind: CollectionRuntimeConfig<unknown>["kind"],
    family: CollectionRuntimeConfig<unknown>["family"] = "base",
    behavior: { ordered?: boolean; comparator?: Comparator<unknown> } = {},
) {
    const constructor = function <E>(source?: Iterable<E> | AsyncIterable<E>, options: CollectionOptions<E> = {}): object {
        if (!new.target) throw new TypeError(`${name} requires new.`);
        const result = createCollection<E>({
            ...options,
            asynchronous, kind, family, source,
            ordered: behavior.ordered,
            comparator: options.comparator ?? behavior.comparator,
        }) as object;
        return Object.setPrototypeOf(result, new.target.prototype);
    };
    Object.defineProperty(constructor, "name", { value: name });
    return constructor;
}

/**
 * Creates a collection that preserves source order and permits duplicate elements.
 * Promise operations wait for source initialisation.
 */
export const AsynchronousCollection: AsynchronousCollectionConstructor = createCollectionConstructor("AsynchronousCollection", true, "collection", "base") as unknown as AsynchronousCollectionConstructor;
/**
 * Creates a collection that preserves source order and permits duplicate elements.
 * Operations return their results directly.
 */
export const SynchronousCollection: SynchronousCollectionConstructor = createCollectionConstructor("SynchronousCollection", false, "collection", "base") as unknown as SynchronousCollectionConstructor;
