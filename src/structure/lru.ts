import { createCollectionConstructor, type CollectionOptions } from "#semantic/structure/collection";
import { createMapConstructor, type MapOptions, type MapSource } from "#semantic/structure/map";
import { useDefaultOrder } from "#semantic/structure/set";
import type { SynchronousCollection, AsynchronousCollection } from "#semantic/structure/collection";
import {
    AsynchronousLRUListSymbol, SynchronousLRUListSymbol, AsynchronousLRUSetSymbol, SynchronousLRUSetSymbol,
    AsynchronousOrderedLRUSetSymbol, AsynchronousUnorderedLRUSetSymbol,
    SynchronousOrderedLRUSetSymbol, SynchronousUnorderedLRUSetSymbol,
    AsynchronousLRUMapSymbol, SynchronousLRUMapSymbol,
    AsynchronousOrderedLRUMapSymbol, AsynchronousUnorderedLRUMapSymbol,
    SynchronousOrderedLRUMapSymbol, SynchronousUnorderedLRUMapSymbol,
} from "#semantic/symbol";
import type { Optional } from "#semantic/optional";
import type { AsynchronousList, SynchronousList } from "#semantic/structure/list";
import type {
    AsynchronousOrderedSet, AsynchronousSetContract, AsynchronousUnorderedSet,
    SynchronousOrderedSet, SynchronousSetContract, SynchronousUnorderedSet,
} from "#semantic/structure/set";
import type {
    AsynchronousMapContract, AsynchronousMapEntry, AsynchronousOrderedMap, AsynchronousUnorderedMap,
    SynchronousMapContract, SynchronousMapEntry, SynchronousOrderedMap, SynchronousUnorderedMap,
} from "#semantic/structure/map";
import type { Comparator } from "#semantic/utility";

/**
 * Ordered-set behaviour shared by the ordered LRU sets.
 *
 * This module sits in the cycle
 * `set -> hook -> synchronous/collectors -> lru -> set`: `synchronous/collectors`
 * imports `lru`, so this module's body can run while `set`'s body is still
 * suspended at its own imports (for example when `structure/lru.js` is the first
 * module imported, or when another cycle member is). Reading the
 * `useDefaultOrder` binding here would hit its temporal dead zone. The accessor
 * defers exactly that read to construction time, after the module graph has
 * finished evaluating, and it still yields the very same `useDefaultOrder`
 * function: the comparator and its ordering semantics are unchanged.
 */
const orderedSetBehavior: { ordered: boolean; comparator: Comparator<unknown> } = {
    ordered: true,
    get comparator(): Comparator<unknown> {
        return useDefaultOrder;
    },
};

/**
 * A bounded list that evicts the least recently used element when necessary.
 *
 * Each occurrence has its own access record, including duplicate elements.
 * Insertion, positional replacement and successful indexed retrieval mark the
 * affected occurrence as most recently used. Bulk insertion processes elements
 * in source iteration order. Other queries, iteration, sorting and reordering
 * do not count as accesses; access records move with their occurrences.
 *
 * Recency is independent of positional order: reading an element does not move
 * it to another index. Insertion positions are checked before insertion; any
 * subsequent eviction closes the removed occurrence's position. Backed list
 * views share access records and the capacity limit with this list.
 *
 * The capacity is positive. Inserting beyond it evicts the least recently used
 * occurrence after insertion. Reducing capacity evicts occurrences in that same
 * order. No atomicity or synchronisation is guaranteed. New value-returning
 * methods reject when empty; inherited methods retain their own contracts.
 *
 * @template E the type of elements in this list
 */
export interface AsynchronousLRUList<E> extends AsynchronousList<E>{

    /** Runtime marker identifying this interface as an asynchronous LRU list. */
    readonly [AsynchronousLRUListSymbol]: unique symbol;

    /**
     * Returns the maximum number of elements retained by this list.
     *
     * @returns a promise that resolves to the positive capacity
     */
    capacity(): Promise<bigint>;

    /**
     * Sets the capacity, evicting least recently used occurrences if necessary.
     *
     * @param capacity the positive maximum number of elements to retain
     * @returns a promise that resolves after resizing and eviction;
     *          rejects with `RangeError` if `capacity < 1n`, without changing this list
     */
    setCapacity(capacity: bigint): Promise<void>;

    /**
     * Marks the occurrence at the specified position as most recently used.
     * Does not change its position or retrieve its value.
     *
     * @param index the position of the occurrence to be accessed
     * @returns a promise that resolves when the access has been recorded;
     *          rejects with `RangeError` if the index is out of range
     */
    touch(index: bigint): Promise<void>;

    /**
     * Retrieves, but does not remove or access, the least recently used element.
     *
     * @returns a promise that resolves to the least recently used element;
     *          rejects if this list is empty
     */
    peekLeastRecent(): Promise<E>;

    /**
     * Retrieves, but does not remove or access, the most recently used element.
     *
     * @returns a promise that resolves to the most recently used element;
     *          rejects if this list is empty
     */
    peekMostRecent(): Promise<E>;

    /**
     * Removes and returns the least recently used occurrence.
     *
     * @returns a promise that resolves to the removed element;
     *          rejects if this list is empty
     */
    pollLeastRecent(): Promise<E>;
}

/**
 * A bounded list that evicts the least recently used element when necessary.
 *
 * Each occurrence, including a duplicate, has its own access record. Insertion,
 * positional replacement and successful indexed retrieval mark it as most
 * recently used. Bulk insertion follows source iteration order. Other queries,
 * iteration, sorting and reordering do not count as accesses; records move with
 * their occurrences. Recency is independent of positional order.
 *
 * Insertion positions are checked before insertion. Subsequent eviction closes
 * the removed occurrence's position. Backed views share access records and the
 * capacity limit. Capacity is positive; insertion beyond it and capacity
 * reduction evict least recently used occurrences until the limit is met.
 *
 * @template E the type of elements in this list
 */
export interface SynchronousLRUList<E> extends SynchronousList<E>{

    /** Runtime marker identifying this interface as a synchronous LRU list. */
    readonly [SynchronousLRUListSymbol]: unique symbol;

    /**
     * Returns the maximum number of elements retained by this list.
     *
     * @returns the positive capacity
     */
    capacity(): bigint;

    /**
     * Sets the capacity, evicting least recently used occurrences if necessary.
     *
     * @param capacity the positive maximum number of elements to retain
     * @throws {RangeError} if `capacity < 1n`, without changing this list
     */
    setCapacity(capacity: bigint): void;

    /**
     * Marks the occurrence at the specified position as most recently used.
     * Does not change its position or retrieve its value.
     *
     * @param index the position of the occurrence to be accessed
     * @throws {RangeError} if the index is out of range
     */
    touch(index: bigint): void;

    /**
     * Retrieves, but does not remove or access, the least recently used element.
     *
     * @returns an optional containing the least recently used element,
     *          or an empty optional if this list is empty
     */
    peekLeastRecent(): Optional<E>;

    /**
     * Retrieves, but does not remove or access, the most recently used element.
     *
     * @returns an optional containing the most recently used element,
     *          or an empty optional if this list is empty
     */
    peekMostRecent(): Optional<E>;

    /**
     * Removes and returns the least recently used occurrence.
     *
     * @returns an optional containing the removed element,
     *          or an empty optional if this list is empty
     */
    pollLeastRecent(): Optional<E>;
}

/** @internal LRU operations shared by base and ordered/unordered LRU set variants. */
interface AsynchronousLRUSetOperations<E> {
    capacity(): Promise<bigint>;
    setCapacity(capacity: bigint): Promise<void>;
    touch(element: E): Promise<boolean>;
    peekLeastRecent(): Promise<E>;
    peekMostRecent(): Promise<E>;
    pollLeastRecent(): Promise<E>;
}

/** @internal LRU operations shared by base and ordered/unordered LRU set variants. */
interface SynchronousLRUSetOperations<E> {
    capacity(): bigint;
    setCapacity(capacity: bigint): void;
    touch(element: E): boolean;
    peekLeastRecent(): Optional<E>;
    peekMostRecent(): Optional<E>;
    pollLeastRecent(): Optional<E>;
}

/**
 * A bounded set with least recently used eviction and asynchronous operations.
 *
 * Adding an element marks it as most recently used, even if already present.
 * Duplicate insertion still returns `false`. Bulk insertion processes elements
 * in source iteration order. Only insertion and a successful `touch` count as
 * accesses; membership queries and iteration do not change access order.
 * Iteration proceeds from least to most recently used.
 *
 * Capacity is positive. Insertion beyond capacity and capacity reduction evict
 * the least recently used elements until the limit is met. Set algebra results
 * retain their inherited set contracts and need not be bounded LRU sets.
 * No atomicity or synchronisation is guaranteed. Elements must not be `null`
 * or `undefined`, since these represent absence in the synchronous counterpart.
 *
 * @template E the type of elements maintained by this set
 */
export interface AsynchronousLRUSet<E> extends AsynchronousSetContract<E>, AsynchronousLRUSetOperations<E>{

    /** Runtime marker identifying this interface as an asynchronous LRU set. */
    readonly [AsynchronousLRUSetSymbol]: unique symbol;

    /**
     * Returns the intersection under this family's inherited set contract.
     *
     * @param other the collection with which the intersection is to be calculated
     * @returns a promise that resolves to the intersection set
     */
    intersection(other: AsynchronousCollection<E>): Promise<AsynchronousSetContract<E>>;

    /**
     * Returns the union under this family's inherited set contract.
     *
     * @param other the collection with which the union is to be calculated
     * @returns a promise that resolves to the union set
     */
    union(other: AsynchronousCollection<E>): Promise<AsynchronousSetContract<E>>;

    /**
     * Returns the relative complement under this family's inherited set contract.
     *
     * @param relative the collection relative to which the complement is to be
     *        calculated
     * @returns a promise that resolves to the complement set
     */
    complement(relative: AsynchronousCollection<E>): Promise<AsynchronousSetContract<E>>;

    /**
     * Returns the maximum number of elements retained by this set.
     *
     * @returns a promise that resolves to the positive capacity
     */
    capacity(): Promise<bigint>;

    /**
     * Sets the capacity, evicting least recently used elements if necessary.
     *
     * @param capacity the positive maximum number of elements to retain
     * @returns a promise that resolves after resizing and eviction;
     *          rejects with `RangeError` if `capacity < 1n`, without changing this set
     */
    setCapacity(capacity: bigint): Promise<void>;

    /**
     * Marks the specified element as most recently used, if it is present.
     * Does not insert a missing element.
     *
     * @param element the element whose access is to be recorded
     * @returns a promise that resolves to `true` if the element is present,
     *          or `false` otherwise
     */
    touch(element: E): Promise<boolean>;

    /**
     * Retrieves, but does not remove or access, the least recently used element.
     *
     * @returns a promise that resolves to the least recently used element;
     *          rejects if this set is empty
     */
    peekLeastRecent(): Promise<E>;

    /**
     * Retrieves, but does not remove or access, the most recently used element.
     *
     * @returns a promise that resolves to the most recently used element;
     *          rejects if this set is empty
     */
    peekMostRecent(): Promise<E>;

    /**
     * Removes and returns the least recently used element.
     *
     * @returns a promise that resolves to the removed element;
     *          rejects if this set is empty
     */
    pollLeastRecent(): Promise<E>;
}

/**
 * A bounded set with least recently used eviction and synchronous operations.
 *
 * Adding an element marks it as most recently used, even if already present.
 * Duplicate insertion still returns `false`. Bulk insertion follows source
 * iteration order. Only insertion and a successful `touch` count as accesses;
 * membership queries and iteration do not. Iteration proceeds from least to
 * most recently used. Elements must not be `null` or `undefined`.
 *
 * Capacity is positive. Insertion beyond capacity and capacity reduction evict
 * least recently used elements until the limit is met. Set algebra results
 * need not be bounded LRU sets.
 *
 * @template E the type of elements maintained by this set
 */
export interface SynchronousLRUSet<E> extends SynchronousSetContract<E>, SynchronousLRUSetOperations<E>{

    /** Runtime marker identifying this interface as a synchronous LRU set. */
    readonly [SynchronousLRUSetSymbol]: unique symbol;

    /**
     * Returns the intersection under this family's inherited set contract.
     *
     * @param other the collection with which the intersection is to be calculated
     * @returns the intersection set
     */
    intersection(other: SynchronousCollection<E>): SynchronousSetContract<E>;

    /**
     * Returns the union under this family's inherited set contract.
     *
     * @param other the collection with which the union is to be calculated
     * @returns the union set
     */
    union(other: SynchronousCollection<E>): SynchronousSetContract<E>;

    /**
     * Returns the relative complement under this family's inherited set contract.
     *
     * @param relative the collection relative to which the complement is to be
     *        calculated
     * @returns the complement set
     */
    complement(relative: SynchronousCollection<E>): SynchronousSetContract<E>;

    /**
     * Returns the maximum number of elements retained by this set.
     *
     * @returns the positive capacity
     */
    capacity(): bigint;

    /**
     * Sets the capacity, evicting least recently used elements if necessary.
     *
     * @param capacity the positive maximum number of elements to retain
     * @throws {RangeError} if `capacity < 1n`, without changing this set
     */
    setCapacity(capacity: bigint): void;

    /**
     * Marks the specified element as most recently used, if it is present.
     * Does not insert a missing element.
     *
     * @param element the element whose access is to be recorded
     * @returns `true` if the element is present, or `false` otherwise
     */
    touch(element: E): boolean;

    /**
     * Retrieves, but does not remove or access, the least recently used element.
     *
     * @returns an optional containing the least recently used element,
     *          or an empty optional if this set is empty
     */
    peekLeastRecent(): Optional<E>;

    /**
     * Retrieves, but does not remove or access, the most recently used element.
     *
     * @returns an optional containing the most recently used element,
     *          or an empty optional if this set is empty
     */
    peekMostRecent(): Optional<E>;

    /**
     * Removes and returns the least recently used element.
     *
     * @returns an optional containing the removed element,
     *          or an empty optional if this set is empty
     */
    pollLeastRecent(): Optional<E>;
}

/**
 * An LRU set whose elements are unique under a comparator and iterate in
 * comparator-ascending order.
 *
 * Recency remains the eviction criterion: adding or touching an element marks
 * it as most recently used, and capacity pressure evicts the least recently
 * used element. Iteration order is independent of recency and follows the
 * comparator. The default comparator is `useCompare` with a deterministic fallback.
 *
 * @template E the type of elements maintained by this set
 */
export interface AsynchronousOrderedLRUSet<E> extends AsynchronousOrderedSet<E>, AsynchronousLRUSetOperations<E> {
    /** Runtime marker identifying this interface as a member of the LRU set family. */
    readonly [AsynchronousLRUSetSymbol]: unique symbol;

    /** Runtime marker identifying this interface as an asynchronous ordered LRU set. */
    readonly [AsynchronousOrderedLRUSetSymbol]: unique symbol;
}

/**
 * An LRU set whose elements are unique under SameValueZero and whose iteration
 * order is unspecified.
 *
 * Recency remains the eviction criterion: adding or touching an element marks
 * it as most recently used, and capacity pressure evicts the least recently
 * used element. Elements are partitioned into hash buckets with `useHash`;
 * bucket order is an implementation detail and no iteration order is promised.
 *
 * @template E the type of elements maintained by this set
 */
export interface AsynchronousUnorderedLRUSet<E> extends AsynchronousUnorderedSet<E>, AsynchronousLRUSetOperations<E> {
    /** Runtime marker identifying this interface as a member of the LRU set family. */
    readonly [AsynchronousLRUSetSymbol]: unique symbol;

    /** Runtime marker identifying this interface as an asynchronous unordered LRU set. */
    readonly [AsynchronousUnorderedLRUSetSymbol]: unique symbol;
}

/**
 * An LRU set whose elements are unique under a comparator and iterate in
 * comparator-ascending order.
 *
 * Recency remains the eviction criterion: adding or touching an element marks
 * it as most recently used, and capacity pressure evicts the least recently
 * used element. Iteration order is independent of recency and follows the
 * comparator. The default comparator is `useCompare` with a deterministic fallback.
 *
 * @template E the type of elements maintained by this set
 */
export interface SynchronousOrderedLRUSet<E> extends SynchronousOrderedSet<E>, SynchronousLRUSetOperations<E> {
    /** Runtime marker identifying this interface as a member of the LRU set family. */
    readonly [SynchronousLRUSetSymbol]: unique symbol;

    /** Runtime marker identifying this interface as a synchronous ordered LRU set. */
    readonly [SynchronousOrderedLRUSetSymbol]: unique symbol;
}

/**
 * An LRU set whose elements are unique under SameValueZero and whose iteration
 * order is unspecified.
 *
 * Recency remains the eviction criterion: adding or touching an element marks
 * it as most recently used, and capacity pressure evicts the least recently
 * used element. Elements are partitioned into hash buckets with `useHash`;
 * bucket order is an implementation detail and no iteration order is promised.
 *
 * @template E the type of elements maintained by this set
 */
export interface SynchronousUnorderedLRUSet<E> extends SynchronousUnorderedSet<E>, SynchronousLRUSetOperations<E> {
    /** Runtime marker identifying this interface as a member of the LRU set family. */
    readonly [SynchronousLRUSetSymbol]: unique symbol;

    /** Runtime marker identifying this interface as a synchronous unordered LRU set. */
    readonly [SynchronousUnorderedLRUSetSymbol]: unique symbol;
}

/** @internal LRU operations shared by base and ordered/unordered LRU map variants. */
interface AsynchronousLRUMapOperations<K, V> {
    capacity(): Promise<bigint>;
    setCapacity(capacity: bigint): Promise<void>;
    touch(key: unknown): Promise<boolean>;
    peekLeastRecent(): Promise<AsynchronousMapEntry<K, V>>;
    peekMostRecent(): Promise<AsynchronousMapEntry<K, V>>;
    pollLeastRecent(): Promise<AsynchronousMapEntry<K, V>>;
}

/** @internal LRU operations shared by base and ordered/unordered LRU map variants. */
interface SynchronousLRUMapOperations<K, V> {
    capacity(): bigint;
    setCapacity(capacity: bigint): void;
    touch(key: unknown): boolean;
    peekLeastRecent(): Optional<SynchronousMapEntry<K, V>>;
    peekMostRecent(): Optional<SynchronousMapEntry<K, V>>;
    pollLeastRecent(): Optional<SynchronousMapEntry<K, V>>;
}

/**
 * A bounded map with least recently used eviction and asynchronous operations.
 *
 * Successful `get` and `getOrDefault` lookups, `put`, `putIfAbsent`, `compute`,
 * `computeIfAbsent`, `computeIfPresent` and `merge` mark the resulting mapping
 * as most recently used if it exists. Replacement counts only if it succeeds.
 * `putAll` processes accesses in source entry iteration order. A successful
 * `touch` also records access. Other operations, including iteration, collection
 * view operations and `replaceAll`, do not record access. The base interface
 * does not specify view iteration order; ordered variants iterate from least
 * to most recently used. Changing access order may invalidate iteration.
 *
 * Capacity is positive. Insertion beyond capacity and capacity reduction evict
 * the least recently used mappings until the limit is met. Accesses are recorded
 * when the mapping operation takes effect. As in the shared map contract, `put` and
 * `putIfAbsent` fulfil without a value after a new insertion; an absent result
 * from another value-returning operation rejects. No atomicity is guaranteed.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface AsynchronousLRUMap<K, V> extends AsynchronousMapContract<K, V>, AsynchronousLRUMapOperations<K, V>{

    /** Runtime marker identifying this interface as an asynchronous LRU map. */
    readonly [AsynchronousLRUMapSymbol]: unique symbol;

    /**
     * Returns the maximum number of mappings retained by this map.
     *
     * @returns a promise that resolves to the positive capacity
     */
    capacity(): Promise<bigint>;

    /**
     * Sets the capacity, evicting least recently used mappings if necessary.
     *
     * @param capacity the positive maximum number of mappings to retain
     * @returns a promise that resolves after resizing and eviction;
     *          rejects with `RangeError` if `capacity < 1n`, without changing this map
     */
    setCapacity(capacity: bigint): Promise<void>;

    /**
     * Marks the specified key's mapping as most recently used, if present.
     * Does not insert a missing mapping.
     *
     * @param key the key whose access is to be recorded
     * @returns a promise that resolves to `true` if a mapping is present,
     *          or `false` otherwise
     */
    touch(key: unknown): Promise<boolean>;

    /**
     * Returns a snapshot of the least recently used mapping without accessing it.
     * The returned entry does not support `setValue`.
     *
     * @returns a promise that resolves to the least recently used entry;
     *          rejects if this map is empty
     */
    peekLeastRecent(): Promise<AsynchronousMapEntry<K, V>>;

    /**
     * Returns a snapshot of the most recently used mapping without accessing it.
     * The returned entry does not support `setValue`.
     *
     * @returns a promise that resolves to the most recently used entry;
     *          rejects if this map is empty
     */
    peekMostRecent(): Promise<AsynchronousMapEntry<K, V>>;

    /**
     * Removes and returns a snapshot of the least recently used mapping.
     * The returned entry does not support `setValue`.
     *
     * @returns a promise that resolves to the removed entry;
     *          rejects if this map is empty
     */
    pollLeastRecent(): Promise<AsynchronousMapEntry<K, V>>;
}

/**
 * A bounded map with least recently used eviction and synchronous operations.
 *
 * Successful `get` and `getOrDefault` lookups, `put`, `putIfAbsent`, `compute`,
 * `computeIfAbsent`, `computeIfPresent` and `merge` mark the resulting mapping
 * as most recently used if it exists. Replacement counts only if it succeeds.
 * `putAll` processes accesses in source entry iteration order. A successful
 * `touch` also records access. Other operations, including iteration, collection
 * view operations and `replaceAll`, do not record access. The base interface
 * does not specify view iteration order; ordered variants iterate from least
 * to most recently used. Changing access order may invalidate iteration.
 *
 * Capacity is positive. Insertion beyond capacity and capacity reduction evict
 * the least recently used mappings until the limit is met.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface SynchronousLRUMap<K, V> extends SynchronousMapContract<K, V>, SynchronousLRUMapOperations<K, V>{

    /** Runtime marker identifying this interface as a synchronous LRU map. */
    readonly [SynchronousLRUMapSymbol]: unique symbol;

    /**
     * Returns the maximum number of mappings retained by this map.
     *
     * @returns the positive capacity
     */
    capacity(): bigint;

    /**
     * Sets the capacity, evicting least recently used mappings if necessary.
     *
     * @param capacity the positive maximum number of mappings to retain
     * @throws {RangeError} if `capacity < 1n`, without changing this map
     */
    setCapacity(capacity: bigint): void;

    /**
     * Marks the specified key's mapping as most recently used, if present.
     * Does not insert a missing mapping.
     *
     * @param key the key whose access is to be recorded
     * @returns `true` if a mapping is present, or `false` otherwise
     */
    touch(key: unknown): boolean;

    /**
     * Returns a snapshot of the least recently used mapping without accessing it.
     * The returned entry does not support `setValue`.
     *
     * @returns an optional containing the least recently used entry,
     *          or an empty optional if this map is empty
     */
    peekLeastRecent(): Optional<SynchronousMapEntry<K, V>>;

    /**
     * Returns a snapshot of the most recently used mapping without accessing it.
     * The returned entry does not support `setValue`.
     *
     * @returns an optional containing the most recently used entry,
     *          or an empty optional if this map is empty
     */
    peekMostRecent(): Optional<SynchronousMapEntry<K, V>>;

    /**
     * Removes and returns a snapshot of the least recently used mapping.
     * The returned entry does not support `setValue`.
     *
     * @returns an optional containing the removed entry,
     *          or an empty optional if this map is empty
     */
    pollLeastRecent(): Optional<SynchronousMapEntry<K, V>>;
}

/**
 * An asynchronous LRU map whose views iterate from least to most recently used.
 *
 * Key, value and entry views, and `forEach`, follow access order rather than
 * insertion order. All inherited access-recording and eviction rules apply.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface AsynchronousOrderedLRUMap<K, V> extends AsynchronousOrderedMap<K, V>, AsynchronousLRUMapOperations<K, V> {
    /** Runtime marker identifying this interface as a member of the LRU map family. */
    readonly [AsynchronousLRUMapSymbol]: unique symbol;

    /** Runtime marker identifying this interface as an asynchronous ordered LRU map. */
    readonly [AsynchronousOrderedLRUMapSymbol]: unique symbol;
}

/**
 * An asynchronous LRU map without a guaranteed view iteration order.
 *
 * Access records, capacity limits and least recently used eviction are retained.
 * The `peekLeastRecent`, `peekMostRecent` and `pollLeastRecent` methods still
 * refer to access order, independently of view iteration order.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface AsynchronousUnorderedLRUMap<K, V> extends AsynchronousUnorderedMap<K, V>, AsynchronousLRUMapOperations<K, V> {
    /** Runtime marker identifying this interface as a member of the LRU map family. */
    readonly [AsynchronousLRUMapSymbol]: unique symbol;

    /** Runtime marker identifying this interface as an asynchronous unordered LRU map. */
    readonly [AsynchronousUnorderedLRUMapSymbol]: unique symbol;
}

/**
 * A synchronous LRU map whose views iterate from least to most recently used.
 *
 * Key, value and entry views, and `forEach`, follow access order rather than
 * insertion order. All inherited access-recording and eviction rules apply.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface SynchronousOrderedLRUMap<K, V> extends SynchronousOrderedMap<K, V>, SynchronousLRUMapOperations<K, V> {
    /** Runtime marker identifying this interface as a member of the LRU map family. */
    readonly [SynchronousLRUMapSymbol]: unique symbol;

    /** Runtime marker identifying this interface as a synchronous ordered LRU map. */
    readonly [SynchronousOrderedLRUMapSymbol]: unique symbol;
}

/**
 * A synchronous LRU map without a guaranteed view iteration order.
 *
 * Access records, capacity limits and least recently used eviction are retained.
 * Recency queries and eviction are independent of view iteration order.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface SynchronousUnorderedLRUMap<K, V> extends SynchronousUnorderedMap<K, V>, SynchronousLRUMapOperations<K, V> {
    /** Runtime marker identifying this interface as a member of the LRU map family. */
    readonly [SynchronousLRUMapSymbol]: unique symbol;

    /** Runtime marker identifying this interface as a synchronous unordered LRU map. */
    readonly [SynchronousUnorderedLRUMapSymbol]: unique symbol;
}

/** Creates an asynchronous bounded list with per-occurrence LRU records. */
export interface AsynchronousLRUListConstructor {
    new <E = unknown>(): AsynchronousLRUList<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): AsynchronousLRUList<E>;
    new <E>(source: AsyncIterable<E>, options?: CollectionOptions<E>): AsynchronousLRUList<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): AsynchronousLRUList<E>;
}
/** Creates a synchronous bounded list with per-occurrence LRU records. */
export interface SynchronousLRUListConstructor {
    new <E = unknown>(): SynchronousLRUList<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): SynchronousLRUList<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): SynchronousLRUList<E>;
}
/** Creates an asynchronous LRU set; duplicate insertion updates recency. */
export interface AsynchronousLRUSetConstructor {
    new <E = unknown>(): AsynchronousLRUSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): AsynchronousLRUSet<E>;
    new <E>(source: AsyncIterable<E>, options?: CollectionOptions<E>): AsynchronousLRUSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): AsynchronousLRUSet<E>;
}
/** Creates a synchronous LRU set; duplicate insertion updates recency. */
export interface SynchronousLRUSetConstructor {
    new <E = unknown>(): SynchronousLRUSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): SynchronousLRUSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): SynchronousLRUSet<E>;
}
/** Creates an asynchronous ordered LRU set; the default comparator is `useCompare` with a deterministic fallback. */
export interface AsynchronousOrderedLRUSetConstructor {
    new <E = unknown>(): AsynchronousOrderedLRUSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): AsynchronousOrderedLRUSet<E>;
    new <E>(source: AsyncIterable<E>, options?: CollectionOptions<E>): AsynchronousOrderedLRUSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): AsynchronousOrderedLRUSet<E>;
}
/** Creates an asynchronous LRU set with SameValueZero equality and unspecified iteration order. */
export interface AsynchronousUnorderedLRUSetConstructor {
    new <E = unknown>(): AsynchronousUnorderedLRUSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): AsynchronousUnorderedLRUSet<E>;
    new <E>(source: AsyncIterable<E>, options?: CollectionOptions<E>): AsynchronousUnorderedLRUSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): AsynchronousUnorderedLRUSet<E>;
}
/** Creates a synchronous ordered LRU set; the default comparator is `useCompare` with a deterministic fallback. */
export interface SynchronousOrderedLRUSetConstructor {
    new <E = unknown>(): SynchronousOrderedLRUSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): SynchronousOrderedLRUSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): SynchronousOrderedLRUSet<E>;
}
/** Creates a synchronous LRU set with SameValueZero equality and unspecified iteration order. */
export interface SynchronousUnorderedLRUSetConstructor {
    new <E = unknown>(): SynchronousUnorderedLRUSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): SynchronousUnorderedLRUSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): SynchronousUnorderedLRUSet<E>;
}

/**
 * Creates a bounded list with separate access records for duplicate occurrences.
 * Promise operations wait for source initialisation.
 */
export const AsynchronousLRUList: AsynchronousLRUListConstructor = createCollectionConstructor("AsynchronousLRUList", true, "list", "lru") as unknown as AsynchronousLRUListConstructor;
/**
 * Creates a bounded list with separate access records for duplicate occurrences.
 * Operations return their results directly.
 */
export const SynchronousLRUList: SynchronousLRUListConstructor = createCollectionConstructor("SynchronousLRUList", false, "list", "lru") as unknown as SynchronousLRUListConstructor;
/**
 * Creates a bounded set whose duplicate insertions refresh element recency.
 * Promise operations wait for source initialisation.
 */
export const AsynchronousLRUSet: AsynchronousLRUSetConstructor = createCollectionConstructor("AsynchronousLRUSet", true, "set", "lru", { ordered: false }) as unknown as AsynchronousLRUSetConstructor;
/**
 * Creates a bounded set whose duplicate insertions refresh element recency.
 * Operations return their results directly.
 */
export const SynchronousLRUSet: SynchronousLRUSetConstructor = createCollectionConstructor("SynchronousLRUSet", false, "set", "lru", { ordered: false }) as unknown as SynchronousLRUSetConstructor;
/**
 * Creates a bounded LRU set whose elements are unique by comparator and iterate
 * in comparator order. Duplicate insertions refresh element recency.
 */
export const AsynchronousOrderedLRUSet: AsynchronousOrderedLRUSetConstructor = createCollectionConstructor("AsynchronousOrderedLRUSet", true, "set", "lru", orderedSetBehavior) as unknown as AsynchronousOrderedLRUSetConstructor;
/**
 * Creates a bounded LRU set whose elements are unique by comparator and iterate
 * in comparator order. Duplicate insertions refresh element recency.
 */
export const SynchronousOrderedLRUSet: SynchronousOrderedLRUSetConstructor = createCollectionConstructor("SynchronousOrderedLRUSet", false, "set", "lru", orderedSetBehavior) as unknown as SynchronousOrderedLRUSetConstructor;
/**
 * Creates a bounded LRU set with SameValueZero equality and no iteration-order
 * guarantee. Duplicate insertions refresh element recency.
 */
export const AsynchronousUnorderedLRUSet: AsynchronousUnorderedLRUSetConstructor = createCollectionConstructor("AsynchronousUnorderedLRUSet", true, "set", "lru", { ordered: false }) as unknown as AsynchronousUnorderedLRUSetConstructor;
/**
 * Creates a bounded LRU set with SameValueZero equality and no iteration-order
 * guarantee. Duplicate insertions refresh element recency.
 */
export const SynchronousUnorderedLRUSet: SynchronousUnorderedLRUSetConstructor = createCollectionConstructor("SynchronousUnorderedLRUSet", false, "set", "lru", { ordered: false }) as unknown as SynchronousUnorderedLRUSetConstructor;

/**
 * Constructor for SynchronousLRUMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Values must be non-null. Constructors return the container immediately.
 * Positive capacity defaults to 1024n. Access and eviction follow the LRU contract.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface SynchronousLRUMapConstructor {
    new <K, V>(): SynchronousLRUMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): SynchronousLRUMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): SynchronousLRUMap<K, V>;
}

/** Creates a SynchronousLRUMap with its complete inherited runtime contract. */
export const SynchronousLRUMap: SynchronousLRUMapConstructor = createMapConstructor("SynchronousLRUMap", { asynchronous: false, family: "lru" }) as unknown as SynchronousLRUMapConstructor;

/**
 * Constructor for AsynchronousLRUMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Values must be non-null. Constructors return the container immediately.
 * Async sources load in iteration order; promise operations wait for loading
 * and execute in invocation order. clear() is synchronous and cancels unread
 * source mappings and earlier queued writes. Iterable sources load eagerly.
 * Positive capacity defaults to 1024n. Access and eviction follow the LRU contract.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface AsynchronousLRUMapConstructor {
    new <K, V>(): AsynchronousLRUMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): AsynchronousLRUMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousLRUMap<K, V>;
    new <K, V>(target: AsyncIterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousLRUMap<K, V>;
    new <K, V>(target: MapSource<K, V>, options?: MapOptions<K>): AsynchronousLRUMap<K, V>;
}

/** Creates an AsynchronousLRUMap with its complete inherited runtime contract. */
export const AsynchronousLRUMap: AsynchronousLRUMapConstructor = createMapConstructor("AsynchronousLRUMap", { asynchronous: true, family: "lru" }) as unknown as AsynchronousLRUMapConstructor;

/**
 * Constructor for SynchronousOrderedLRUMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Values must be non-null. Constructors return the container immediately.
 * Positive capacity defaults to 1024n. Access and eviction follow the LRU contract.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface SynchronousOrderedLRUMapConstructor {
    new <K, V>(): SynchronousOrderedLRUMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): SynchronousOrderedLRUMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): SynchronousOrderedLRUMap<K, V>;
}

/** Creates a SynchronousOrderedLRUMap with its complete inherited runtime contract. */
export const SynchronousOrderedLRUMap: SynchronousOrderedLRUMapConstructor = createMapConstructor("SynchronousOrderedLRUMap", { asynchronous: false, family: "lru", ordered: true }) as unknown as SynchronousOrderedLRUMapConstructor;

/**
 * Constructor for AsynchronousOrderedLRUMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Values must be non-null. Constructors return the container immediately.
 * Async sources load in iteration order; promise operations wait for loading
 * and execute in invocation order. clear() is synchronous and cancels unread
 * source mappings and earlier queued writes. Iterable sources load eagerly.
 * Positive capacity defaults to 1024n. Access and eviction follow the LRU contract.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface AsynchronousOrderedLRUMapConstructor {
    new <K, V>(): AsynchronousOrderedLRUMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): AsynchronousOrderedLRUMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousOrderedLRUMap<K, V>;
    new <K, V>(target: AsyncIterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousOrderedLRUMap<K, V>;
    new <K, V>(target: MapSource<K, V>, options?: MapOptions<K>): AsynchronousOrderedLRUMap<K, V>;
}

/** Creates an AsynchronousOrderedLRUMap with its complete inherited runtime contract. */
export const AsynchronousOrderedLRUMap: AsynchronousOrderedLRUMapConstructor = createMapConstructor("AsynchronousOrderedLRUMap", { asynchronous: true, family: "lru", ordered: true }) as unknown as AsynchronousOrderedLRUMapConstructor;

/**
 * Constructor for SynchronousUnorderedLRUMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Values must be non-null. Constructors return the container immediately.
 * Positive capacity defaults to 1024n. Access and eviction follow the LRU contract.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface SynchronousUnorderedLRUMapConstructor {
    new <K, V>(): SynchronousUnorderedLRUMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): SynchronousUnorderedLRUMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): SynchronousUnorderedLRUMap<K, V>;
}

/** Creates a SynchronousUnorderedLRUMap with its complete inherited runtime contract. */
export const SynchronousUnorderedLRUMap: SynchronousUnorderedLRUMapConstructor = createMapConstructor("SynchronousUnorderedLRUMap", { asynchronous: false, family: "lru", ordered: false }) as unknown as SynchronousUnorderedLRUMapConstructor;

/**
 * Constructor for AsynchronousUnorderedLRUMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Values must be non-null. Constructors return the container immediately.
 * Async sources load in iteration order; promise operations wait for loading
 * and execute in invocation order. clear() is synchronous and cancels unread
 * source mappings and earlier queued writes. Iterable sources load eagerly.
 * Positive capacity defaults to 1024n. Access and eviction follow the LRU contract.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface AsynchronousUnorderedLRUMapConstructor {
    new <K, V>(): AsynchronousUnorderedLRUMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): AsynchronousUnorderedLRUMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousUnorderedLRUMap<K, V>;
    new <K, V>(target: AsyncIterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousUnorderedLRUMap<K, V>;
    new <K, V>(target: MapSource<K, V>, options?: MapOptions<K>): AsynchronousUnorderedLRUMap<K, V>;
}

/** Creates an AsynchronousUnorderedLRUMap with its complete inherited runtime contract. */
export const AsynchronousUnorderedLRUMap: AsynchronousUnorderedLRUMapConstructor = createMapConstructor("AsynchronousUnorderedLRUMap", { asynchronous: true, family: "lru", ordered: false }) as unknown as AsynchronousUnorderedLRUMapConstructor;
