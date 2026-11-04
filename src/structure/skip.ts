import { createCollectionConstructor, type CollectionOptions } from "#semantic/structure/collection";
import { createMapConstructor, type MapOptions, type MapSource } from "#semantic/structure/map";
import { useDefaultOrder } from "#semantic/structure/set";
import { AsynchronousSkipListSymbol, SynchronousSkipListSymbol, AsynchronousSkipSetSymbol, SynchronousSkipSetSymbol, AsynchronousOrderedSkipSetSymbol, AsynchronousUnorderedSkipSetSymbol, SynchronousOrderedSkipSetSymbol, SynchronousUnorderedSkipSetSymbol, AsynchronousSkipMapSymbol, SynchronousSkipMapSymbol, AsynchronousOrderedSkipMapSymbol, AsynchronousUnorderedSkipMapSymbol, SynchronousOrderedSkipMapSymbol, SynchronousUnorderedSkipMapSymbol } from "#semantic/symbol";
import type { Optional } from "#semantic/optional";
import type { AsynchronousList, SynchronousList } from "#semantic/structure/list";
import type { AsynchronousSetContract, AsynchronousOrderedSet, AsynchronousUnorderedSet, SynchronousSetContract, SynchronousOrderedSet, SynchronousUnorderedSet } from "#semantic/structure/set";
import type { AsynchronousMapContract, AsynchronousMapEntry, AsynchronousOrderedMap, AsynchronousUnorderedMap, SynchronousMapContract, SynchronousMapEntry, SynchronousOrderedMap, SynchronousUnorderedMap } from "#semantic/structure/map";
import type { Comparator } from "#semantic/utility";

/**
 * An indexed list intended for implementation with positional skip links.
 *
 * Skip links index positions, not element values. This list preserves arbitrary
 * positional insertion, duplicate elements and the inherited sorting contract.
 * Expected search performance depends on the implementation; this interface
 * makes no complexity or concurrency guarantee. Iteration remains synchronous.
 *
 * @template E the type of elements in this list
 */
export interface AsynchronousSkipList<E> extends AsynchronousList<E>{

    /** Identifies this interface at runtime. */
    readonly [AsynchronousSkipListSymbol]: unique symbol;

    /**
     * Returns a backed view between the specified positions. Changes through
     * the view affect this list. Structural changes made outside the view
     * leave the view's behaviour unspecified.
     *
     * @param fromIndex the low endpoint, inclusive
     * @param toIndex the high endpoint, exclusive
     * @returns a promise that resolves to the indexed range view;
     *          rejects with `RangeError` if the endpoints are out of bounds
     *          or `fromIndex > toIndex`
     */
    subList(fromIndex: bigint, toIndex: bigint): Promise<AsynchronousSkipList<E>>;
}

/**
 * An indexed list intended for implementation with positional skip links.
 *
 * Skip links index positions, not element values. Arbitrary positional insertion,
 * duplicates and sorting retain their inherited contracts. No complexity or
 * concurrency guarantee is imposed by this interface.
 *
 * @template E the type of elements in this list
 */
export interface SynchronousSkipList<E> extends SynchronousList<E>{

    /** Identifies this interface at runtime. */
    readonly [SynchronousSkipListSymbol]: unique symbol;

    /**
     * Returns a backed view between the specified positions. Changes through
     * the view affect this list. Structural changes made outside the view
     * leave the view's behaviour unspecified.
     *
     * @param fromIndex the low endpoint, inclusive
     * @param toIndex the high endpoint, exclusive
     * @returns the indexed range view
     * @throws {RangeError} if the endpoints are out of bounds or
     *         `fromIndex > toIndex`
     */
    subList(fromIndex: bigint, toIndex: bigint): SynchronousSkipList<E>;
}

/** @internal Skip-set operations shared by base and ordered/unordered skip set variants. */
interface AsynchronousSkipSetOperations<E> {
    comparator(): Promise<Comparator<E>>;
    first(): Promise<E>;
    last(): Promise<E>;
    lower(element: E): Promise<E>;
    floor(element: E): Promise<E>;
    ceiling(element: E): Promise<E>;
    higher(element: E): Promise<E>;
    pollFirst(): Promise<E>;
    pollLast(): Promise<E>;
    descendingSet(): Promise<AsynchronousSkipSet<E>>;
    descendingIterator(): Iterator<E>;
    subSet(fromElement: E, toElement: E): Promise<AsynchronousSkipSet<E>>;
    subSet(fromElement: E, fromInclusive: boolean, toElement: E, toInclusive: boolean): Promise<AsynchronousSkipSet<E>>;
    headSet(toElement: E, inclusive?: boolean): Promise<AsynchronousSkipSet<E>>;
    tailSet(fromElement: E, inclusive?: boolean): Promise<AsynchronousSkipSet<E>>;
}

/** @internal Skip-set operations shared by base and ordered/unordered skip set variants. */
interface SynchronousSkipSetOperations<E> {
    comparator(): Comparator<E>;
    first(): Optional<E>;
    last(): Optional<E>;
    lower(element: E): Optional<E>;
    floor(element: E): Optional<E>;
    ceiling(element: E): Optional<E>;
    higher(element: E): Optional<E>;
    pollFirst(): Optional<E>;
    pollLast(): Optional<E>;
    descendingSet(): SynchronousSkipSet<E>;
    descendingIterator(): Iterator<E>;
    subSet(fromElement: E, toElement: E): SynchronousSkipSet<E>;
    subSet(fromElement: E, fromInclusive: boolean, toElement: E, toInclusive: boolean): SynchronousSkipSet<E>;
    headSet(toElement: E, inclusive?: boolean): SynchronousSkipSet<E>;
    tailSet(fromElement: E, inclusive?: boolean): SynchronousSkipSet<E>;
}

/**
 * An ordered, navigable set intended for implementation with skip links.
 *
 * Iteration follows comparator order. The comparator must define a total order
 * consistent with element equality: comparison yields zero exactly when two
 * elements are equal. Elements must not be `null` or `undefined`.
 *
 * Descending and range views are backed by this set; supported changes are
 * reflected in both directions. Descending views reverse the comparator and
 * navigation direction. Range views reject insertions outside their bounds.
 * Invalid or reversed range endpoints reject with `RangeError`; endpoints of
 * nested views must respect their enclosing range. Empty ranges are valid.
 *
 * Navigation rejects if no matching element exists. Iteration, including
 * `descendingIterator`, remains synchronous. Neither concurrency safety nor
 * a particular complexity is guaranteed by this interface.
 *
 * @template E the type of elements maintained by this set
 */
export interface AsynchronousSkipSet<E> extends AsynchronousSetContract<E>, AsynchronousSkipSetOperations<E>{

    /** Identifies this interface at runtime. */
    readonly [AsynchronousSkipSetSymbol]: unique symbol;

    /**
     * Returns the comparator defining this set's order.
     *
     * @returns a promise that resolves to the comparator, including for an empty set
     */
    comparator(): Promise<Comparator<E>>;

    /**
     * Returns the first element in this set's order without removing it.
     *
     * @returns a promise that resolves to the first element, or rejects if empty
     */
    first(): Promise<E>;

    /**
     * Returns the last element in this set's order without removing it.
     *
     * @returns a promise that resolves to the last element, or rejects if empty
     */
    last(): Promise<E>;

    /**
     * Returns the greatest element strictly less than the given element.
     *
     * @param element the value to be matched
     * @returns a promise that resolves to the closest match, or rejects if absent
     */
    lower(element: E): Promise<E>;

    /**
     * Returns the greatest element less than or equal to the given element.
     *
     * @param element the value to be matched
     * @returns a promise that resolves to the closest match, or rejects if absent
     */
    floor(element: E): Promise<E>;

    /**
     * Returns the least element greater than or equal to the given element.
     *
     * @param element the value to be matched
     * @returns a promise that resolves to the closest match, or rejects if absent
     */
    ceiling(element: E): Promise<E>;

    /**
     * Returns the least element strictly greater than the given element.
     *
     * @param element the value to be matched
     * @returns a promise that resolves to the closest match, or rejects if absent
     */
    higher(element: E): Promise<E>;

    /**
     * Retrieves and removes the first element in this set's order.
     *
     * @returns a promise that resolves to the removed element, or rejects if empty
     */
    pollFirst(): Promise<E>;

    /**
     * Retrieves and removes the last element in this set's order.
     *
     * @returns a promise that resolves to the removed element, or rejects if empty
     */
    pollLast(): Promise<E>;

    /**
     * Returns a backed view of this set in reverse order.
     *
     * @returns a promise that resolves to the descending view
     */
    descendingSet(): Promise<AsynchronousSkipSet<E>>;

    /**
     * Returns an iterator over this set in reverse order.
     *
     * @returns a synchronous iterator in descending comparator order
     */
    descendingIterator(): Iterator<E>;

    /**
     * Returns a backed view from the lower endpoint, inclusive, to the upper
     * endpoint, exclusive.
     *
     * @param fromElement the lower endpoint
     * @param toElement the upper endpoint
     * @returns a promise that resolves to the range view; rejects with
     *          `RangeError` for invalid or reversed endpoints
     */
    subSet(fromElement: E, toElement: E): Promise<AsynchronousSkipSet<E>>;

    /**
     * Returns a backed view between the specified endpoints.
     *
     * @param fromElement the lower endpoint
     * @param fromInclusive whether to include the lower endpoint
     * @param toElement the upper endpoint
     * @param toInclusive whether to include the upper endpoint
     * @returns a promise that resolves to the range view; rejects with
     *          `RangeError` for invalid or reversed endpoints
     */
    subSet(fromElement: E, fromInclusive: boolean, toElement: E, toInclusive: boolean): Promise<AsynchronousSkipSet<E>>;

    /**
     * Returns a backed view of elements below the specified endpoint.
     *
     * @param toElement the upper endpoint
     * @param inclusive whether to include the endpoint; defaults to `false`
     * @returns a promise that resolves to the range view; rejects with
     *          `RangeError` if the endpoint is outside an enclosing range
     */
    headSet(toElement: E, inclusive?: boolean): Promise<AsynchronousSkipSet<E>>;

    /**
     * Returns a backed view of elements above the specified endpoint.
     *
     * @param fromElement the lower endpoint
     * @param inclusive whether to include the endpoint; defaults to `true`
     * @returns a promise that resolves to the range view; rejects with
     *          `RangeError` if the endpoint is outside an enclosing range
     */
    tailSet(fromElement: E, inclusive?: boolean): Promise<AsynchronousSkipSet<E>>;
}

/**
 * An ordered, navigable set intended for implementation with skip links.
 *
 * Iteration follows a total comparator order consistent with element equality.
 * Elements must not be `null` or `undefined`. Missing navigation results are
 * represented by empty optionals, including `first` and `last` on an empty set.
 *
 * Descending and range views are backed by this set. Descending views reverse
 * the comparator and navigation direction. Range views reject insertions outside
 * their bounds. Nested endpoints must respect the enclosing range; reversed
 * or invalid endpoints cause `RangeError`. Empty ranges are valid.
 * No complexity or concurrency guarantee is imposed by this interface.
 *
 * @template E the type of elements maintained by this set
 */
export interface SynchronousSkipSet<E> extends SynchronousSetContract<E>, SynchronousSkipSetOperations<E>{

    /** Identifies this interface at runtime. */
    readonly [SynchronousSkipSetSymbol]: unique symbol;

    /**
     * Returns the comparator defining this set's order.
     *
     * @returns the comparator, including for an empty set
     */
    comparator(): Comparator<E>;

    /**
     * Returns the first element without removing it.
     *
     * @returns an optional containing the first element, or empty if this set is empty
     */
    first(): Optional<E>;

    /**
     * Returns the last element without removing it.
     *
     * @returns an optional containing the last element, or empty if this set is empty
     */
    last(): Optional<E>;

    /**
     * Returns the greatest element strictly less than the given element.
     *
     * @param element the value to be matched
     * @returns an optional containing the closest match, or empty if absent
     */
    lower(element: E): Optional<E>;

    /**
     * Returns the greatest element less than or equal to the given element.
     *
     * @param element the value to be matched
     * @returns an optional containing the closest match, or empty if absent
     */
    floor(element: E): Optional<E>;

    /**
     * Returns the least element greater than or equal to the given element.
     *
     * @param element the value to be matched
     * @returns an optional containing the closest match, or empty if absent
     */
    ceiling(element: E): Optional<E>;

    /**
     * Returns the least element strictly greater than the given element.
     *
     * @param element the value to be matched
     * @returns an optional containing the closest match, or empty if absent
     */
    higher(element: E): Optional<E>;

    /**
     * Retrieves and removes the first element in this set's order.
     *
     * @returns an optional containing the removed element, or empty if this set is empty
     */
    pollFirst(): Optional<E>;

    /**
     * Retrieves and removes the last element in this set's order.
     *
     * @returns an optional containing the removed element, or empty if this set is empty
     */
    pollLast(): Optional<E>;

    /**
     * Returns a backed view of this set in reverse order.
     *
     * @returns the descending view
     */
    descendingSet(): SynchronousSkipSet<E>;

    /**
     * Returns an iterator over this set in reverse order.
     *
     * @returns an iterator in descending comparator order
     */
    descendingIterator(): Iterator<E>;

    /**
     * Returns a backed view from the lower endpoint, inclusive, to the upper
     * endpoint, exclusive.
     *
     * @param fromElement the lower endpoint
     * @param toElement the upper endpoint
     * @returns the range view
     * @throws {RangeError} if endpoints are invalid or reversed
     */
    subSet(fromElement: E, toElement: E): SynchronousSkipSet<E>;

    /**
     * Returns a backed view between the specified endpoints.
     *
     * @param fromElement the lower endpoint
     * @param fromInclusive whether to include the lower endpoint
     * @param toElement the upper endpoint
     * @param toInclusive whether to include the upper endpoint
     * @returns the range view
     * @throws {RangeError} if endpoints are invalid or reversed
     */
    subSet(fromElement: E, fromInclusive: boolean, toElement: E, toInclusive: boolean): SynchronousSkipSet<E>;

    /**
     * Returns a backed view of elements below the specified endpoint.
     *
     * @param toElement the upper endpoint
     * @param inclusive whether to include the endpoint; defaults to `false`
     * @returns the range view
     * @throws {RangeError} if the endpoint is outside an enclosing range
     */
    headSet(toElement: E, inclusive?: boolean): SynchronousSkipSet<E>;

    /**
     * Returns a backed view of elements above the specified endpoint.
     *
     * @param fromElement the lower endpoint
     * @param inclusive whether to include the endpoint; defaults to `true`
     * @returns the range view
     * @throws {RangeError} if the endpoint is outside an enclosing range
     */
    tailSet(fromElement: E, inclusive?: boolean): SynchronousSkipSet<E>;
}

/**
 * A navigable skip set whose elements are unique by comparator and iterate in
 * comparator-ascending order.
 *
 * Navigation, range views, descending views and element equality all use the
 * same total comparator. The default comparator is `useCompare` with a deterministic fallback; elements must
 * not be `null` or `undefined`.
 *
 * @template E the type of elements maintained by this set
 */
export interface AsynchronousOrderedSkipSet<E> extends AsynchronousOrderedSet<E>, AsynchronousSkipSetOperations<E> {
    /** Runtime marker identifying this interface as a member of the skip set family. */
    readonly [AsynchronousSkipSetSymbol]: unique symbol;

    /** Runtime marker identifying this interface as an asynchronous ordered skip set. */
    readonly [AsynchronousOrderedSkipSetSymbol]: unique symbol;
}

/**
 * A navigable skip set with no guaranteed iteration order.
 *
 * Comparator navigation and range views remain available, and elements are
 * unique under SameValueZero. Iteration order is unspecified and may expose
 * internal hash-bucket or navigation order; no order is promised.
 *
 * @template E the type of elements maintained by this set
 */
export interface AsynchronousUnorderedSkipSet<E> extends AsynchronousUnorderedSet<E>, AsynchronousSkipSetOperations<E> {
    /** Runtime marker identifying this interface as a member of the skip set family. */
    readonly [AsynchronousSkipSetSymbol]: unique symbol;

    /** Runtime marker identifying this interface as an asynchronous unordered skip set. */
    readonly [AsynchronousUnorderedSkipSetSymbol]: unique symbol;
}

/**
 * A navigable skip set whose elements are unique by comparator and iterate in
 * comparator-ascending order.
 *
 * Navigation, range views, descending views and element equality all use the
 * same total comparator. The default comparator is `useCompare` with a deterministic fallback; elements must
 * not be `null` or `undefined`.
 *
 * @template E the type of elements maintained by this set
 */
export interface SynchronousOrderedSkipSet<E> extends SynchronousOrderedSet<E>, SynchronousSkipSetOperations<E> {
    /** Runtime marker identifying this interface as a member of the skip set family. */
    readonly [SynchronousSkipSetSymbol]: unique symbol;

    /** Runtime marker identifying this interface as a synchronous ordered skip set. */
    readonly [SynchronousOrderedSkipSetSymbol]: unique symbol;
}

/**
 * A navigable skip set with no guaranteed iteration order.
 *
 * Comparator navigation and range views remain available, and elements are
 * unique under SameValueZero. Iteration order is unspecified and may expose
 * internal hash-bucket or navigation order; no order is promised.
 *
 * @template E the type of elements maintained by this set
 */
export interface SynchronousUnorderedSkipSet<E> extends SynchronousUnorderedSet<E>, SynchronousSkipSetOperations<E> {
    /** Runtime marker identifying this interface as a member of the skip set family. */
    readonly [SynchronousSkipSetSymbol]: unique symbol;

    /** Runtime marker identifying this interface as a synchronous unordered skip set. */
    readonly [SynchronousUnorderedSkipSetSymbol]: unique symbol;
}

/** @internal Skip-map operations shared by base and ordered/unordered skip map variants. */
interface AsynchronousSkipMapOperations<K, V> {
    comparator(): Promise<Comparator<K>>;
    firstKey(): Promise<K>;
    lastKey(): Promise<K>;
    firstEntry(): Promise<AsynchronousMapEntry<K, V>>;
    lastEntry(): Promise<AsynchronousMapEntry<K, V>>;
    lowerKey(key: K): Promise<K>;
    lowerEntry(key: K): Promise<AsynchronousMapEntry<K, V>>;
    floorKey(key: K): Promise<K>;
    floorEntry(key: K): Promise<AsynchronousMapEntry<K, V>>;
    ceilingKey(key: K): Promise<K>;
    ceilingEntry(key: K): Promise<AsynchronousMapEntry<K, V>>;
    higherKey(key: K): Promise<K>;
    higherEntry(key: K): Promise<AsynchronousMapEntry<K, V>>;
    pollFirstEntry(): Promise<AsynchronousMapEntry<K, V>>;
    pollLastEntry(): Promise<AsynchronousMapEntry<K, V>>;
    descendingMap(): Promise<AsynchronousSkipMap<K, V>>;
    keySet(): Promise<AsynchronousSetContract<K>>;
    navigableKeySet(): Promise<AsynchronousSkipSet<K>>;
    descendingKeySet(): Promise<AsynchronousSkipSet<K>>;
    subMap(fromKey: K, toKey: K): Promise<AsynchronousSkipMap<K, V>>;
    subMap(fromKey: K, fromInclusive: boolean, toKey: K, toInclusive: boolean): Promise<AsynchronousSkipMap<K, V>>;
    headMap(toKey: K, inclusive?: boolean): Promise<AsynchronousSkipMap<K, V>>;
    tailMap(fromKey: K, inclusive?: boolean): Promise<AsynchronousSkipMap<K, V>>;
}

/** @internal Skip-map operations shared by base and ordered/unordered skip map variants. */
interface SynchronousSkipMapOperations<K, V> {
    comparator(): Comparator<K>;
    firstKey(): Optional<K>;
    lastKey(): Optional<K>;
    firstEntry(): Optional<SynchronousMapEntry<K, V>>;
    lastEntry(): Optional<SynchronousMapEntry<K, V>>;
    lowerKey(key: K): Optional<K>;
    lowerEntry(key: K): Optional<SynchronousMapEntry<K, V>>;
    floorKey(key: K): Optional<K>;
    floorEntry(key: K): Optional<SynchronousMapEntry<K, V>>;
    ceilingKey(key: K): Optional<K>;
    ceilingEntry(key: K): Optional<SynchronousMapEntry<K, V>>;
    higherKey(key: K): Optional<K>;
    higherEntry(key: K): Optional<SynchronousMapEntry<K, V>>;
    pollFirstEntry(): Optional<SynchronousMapEntry<K, V>>;
    pollLastEntry(): Optional<SynchronousMapEntry<K, V>>;
    descendingMap(): SynchronousSkipMap<K, V>;
    keySet(): SynchronousSetContract<K>;
    navigableKeySet(): SynchronousSkipSet<K>;
    descendingKeySet(): SynchronousSkipSet<K>;
    subMap(fromKey: K, toKey: K): SynchronousSkipMap<K, V>;
    subMap(fromKey: K, fromInclusive: boolean, toKey: K, toInclusive: boolean): SynchronousSkipMap<K, V>;
    headMap(toKey: K, inclusive?: boolean): SynchronousSkipMap<K, V>;
    tailMap(fromKey: K, inclusive?: boolean): SynchronousSkipMap<K, V>;
}

/**
 * A navigable map intended for implementation with skip links.
 *
 * Navigation follows a total comparator order consistent with key equality.
 * Keys must not be `null` or `undefined`. Collection-view iteration and
 * `forEach` have no ordering guarantee. The explicit `navigableKeySet` and
 * `descendingKeySet` views always iterate in their comparator order.
 * Descending maps reverse the comparator and all navigation directions without
 * imposing a collection-view iteration order. Range views are backed by this
 * map and reject insertions outside their bounds. Nested endpoints must respect
 * enclosing bounds; invalid or reversed endpoints reject with `RangeError`.
 * Empty ranges and empty views are valid results.
 *
 * Navigation rejects if no matching key or entry exists. Entry-returning
 * navigation methods produce snapshots that do not support `setValue`.
 * Collection-view iteration remains synchronous. No complexity, atomicity or
 * concurrency guarantee is imposed by this interface.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface AsynchronousSkipMap<K, V> extends AsynchronousMapContract<K, V>, AsynchronousSkipMapOperations<K, V>{

    /** Identifies this interface at runtime. */
    readonly [AsynchronousSkipMapSymbol]: unique symbol;

    /**
     * Returns the comparator defining this map's key order.
     *
     * @returns a promise that resolves to the comparator, including for an empty map
     */
    comparator(): Promise<Comparator<K>>;

    /**
     * Returns the first key in this map's order.
     *
     * @returns a promise that resolves to the first key, or rejects if empty
     */
    firstKey(): Promise<K>;

    /**
     * Returns the last key in this map's order.
     *
     * @returns a promise that resolves to the last key, or rejects if empty
     */
    lastKey(): Promise<K>;

    /**
     * Returns a snapshot of the first mapping without removing it.
     *
     * @returns a promise that resolves to the first entry, or rejects if empty
     */
    firstEntry(): Promise<AsynchronousMapEntry<K, V>>;

    /**
     * Returns a snapshot of the last mapping without removing it.
     *
     * @returns a promise that resolves to the last entry, or rejects if empty
     */
    lastEntry(): Promise<AsynchronousMapEntry<K, V>>;

    /**
     * Returns the greatest key strictly less than the given key.
     *
     * @param key the key to be matched
     * @returns a promise that resolves to the closest key, or rejects if absent
     */
    lowerKey(key: K): Promise<K>;

    /**
     * Returns the entry with the greatest key strictly less than the given key.
     *
     * @param key the key to be matched
     * @returns a promise that resolves to the matching snapshot, or rejects if absent
     */
    lowerEntry(key: K): Promise<AsynchronousMapEntry<K, V>>;

    /**
     * Returns the greatest key less than or equal to the given key.
     *
     * @param key the key to be matched
     * @returns a promise that resolves to the closest key, or rejects if absent
     */
    floorKey(key: K): Promise<K>;

    /**
     * Returns the entry with the greatest key less than or equal to the given key.
     *
     * @param key the key to be matched
     * @returns a promise that resolves to the matching snapshot, or rejects if absent
     */
    floorEntry(key: K): Promise<AsynchronousMapEntry<K, V>>;

    /**
     * Returns the least key greater than or equal to the given key.
     *
     * @param key the key to be matched
     * @returns a promise that resolves to the closest key, or rejects if absent
     */
    ceilingKey(key: K): Promise<K>;

    /**
     * Returns the entry with the least key greater than or equal to the given key.
     *
     * @param key the key to be matched
     * @returns a promise that resolves to the matching snapshot, or rejects if absent
     */
    ceilingEntry(key: K): Promise<AsynchronousMapEntry<K, V>>;

    /**
     * Returns the least key strictly greater than the given key.
     *
     * @param key the key to be matched
     * @returns a promise that resolves to the closest key, or rejects if absent
     */
    higherKey(key: K): Promise<K>;

    /**
     * Returns the entry with the least key strictly greater than the given key.
     *
     * @param key the key to be matched
     * @returns a promise that resolves to the matching snapshot, or rejects if absent
     */
    higherEntry(key: K): Promise<AsynchronousMapEntry<K, V>>;

    /**
     * Retrieves and removes the first mapping in this map's order.
     *
     * @returns a promise that resolves to a snapshot of the removed entry,
     *          or rejects if this map is empty
     */
    pollFirstEntry(): Promise<AsynchronousMapEntry<K, V>>;

    /**
     * Retrieves and removes the last mapping in this map's order.
     *
     * @returns a promise that resolves to a snapshot of the removed entry,
     *          or rejects if this map is empty
     */
    pollLastEntry(): Promise<AsynchronousMapEntry<K, V>>;

    /**
     * Returns a backed view with the comparator and navigation directions
     * reversed. Collection-view iteration order remains unspecified.
     *
     * @returns a promise that resolves to the descending view
     */
    descendingMap(): Promise<AsynchronousSkipMap<K, V>>;

    /**
     * Returns a backed set view of the keys, supporting removal but not
     * insertion. Iteration order is unspecified; use `navigableKeySet` for
     * traversal in comparator order.
     *
     * @returns a promise that resolves to the key view
     */
    keySet(): Promise<AsynchronousSetContract<K>>;

    /**
     * Returns a backed navigable set view of the keys in this map's order.
     * The view supports removal but not insertion.
     *
     * @returns a promise that resolves to the ordered key view
     */
    navigableKeySet(): Promise<AsynchronousSkipSet<K>>;

    /**
     * Returns a backed navigable set view of the keys in reverse order.
     * The view supports removal but not insertion.
     *
     * @returns a promise that resolves to the descending key view
     */
    descendingKeySet(): Promise<AsynchronousSkipSet<K>>;

    /**
     * Returns a backed view from the lower key, inclusive, to the upper key,
     * exclusive.
     *
     * @param fromKey the lower endpoint
     * @param toKey the upper endpoint
     * @returns a promise that resolves to the range view; rejects with
     *          `RangeError` for invalid or reversed endpoints
     */
    subMap(fromKey: K, toKey: K): Promise<AsynchronousSkipMap<K, V>>;

    /**
     * Returns a backed view between the specified keys.
     *
     * @param fromKey the lower endpoint
     * @param fromInclusive whether to include the lower endpoint
     * @param toKey the upper endpoint
     * @param toInclusive whether to include the upper endpoint
     * @returns a promise that resolves to the range view; rejects with
     *          `RangeError` for invalid or reversed endpoints
     */
    subMap(fromKey: K, fromInclusive: boolean, toKey: K, toInclusive: boolean): Promise<AsynchronousSkipMap<K, V>>;

    /**
     * Returns a backed view of mappings below the specified key.
     *
     * @param toKey the upper endpoint
     * @param inclusive whether to include the endpoint; defaults to `false`
     * @returns a promise that resolves to the range view; rejects with
     *          `RangeError` if the endpoint is outside an enclosing range
     */
    headMap(toKey: K, inclusive?: boolean): Promise<AsynchronousSkipMap<K, V>>;

    /**
     * Returns a backed view of mappings above the specified key.
     *
     * @param fromKey the lower endpoint
     * @param inclusive whether to include the endpoint; defaults to `true`
     * @returns a promise that resolves to the range view; rejects with
     *          `RangeError` if the endpoint is outside an enclosing range
     */
    tailMap(fromKey: K, inclusive?: boolean): Promise<AsynchronousSkipMap<K, V>>;
}

/**
 * A navigable map intended for implementation with skip links.
 *
 * Navigation follows a total comparator order consistent with key equality.
 * Keys must not be `null` or `undefined`. Collection-view iteration and
 * `forEach` have no ordering guarantee. The explicit `navigableKeySet` and
 * `descendingKeySet` views always iterate in their comparator order.
 * Descending maps reverse the comparator and navigation directions without
 * imposing a collection-view iteration order. Range views are backed by this
 * map and reject out-of-range insertions. Invalid, reversed or
 * out-of-enclosing-range endpoints cause `RangeError`. Empty ranges are valid.
 *
 * Missing keys and entries are represented by empty optionals, including at
 * either end of an empty map. Entry-returning navigation methods produce
 * snapshots that do not support `setValue`. No complexity or concurrency
 * guarantee is imposed by this interface.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface SynchronousSkipMap<K, V> extends SynchronousMapContract<K, V>, SynchronousSkipMapOperations<K, V>{

    /** Identifies this interface at runtime. */
    readonly [SynchronousSkipMapSymbol]: unique symbol;

    /**
     * Returns the comparator defining this map's key order.
     *
     * @returns the comparator, including for an empty map
     */
    comparator(): Comparator<K>;

    /**
     * Returns the first key in this map's order.
     *
     * @returns an optional containing the first key, or empty if this map is empty
     */
    firstKey(): Optional<K>;

    /**
     * Returns the last key in this map's order.
     *
     * @returns an optional containing the last key, or empty if this map is empty
     */
    lastKey(): Optional<K>;

    /**
     * Returns a snapshot of the first mapping without removing it.
     *
     * @returns an optional containing the first entry, or empty if this map is empty
     */
    firstEntry(): Optional<SynchronousMapEntry<K, V>>;

    /**
     * Returns a snapshot of the last mapping without removing it.
     *
     * @returns an optional containing the last entry, or empty if this map is empty
     */
    lastEntry(): Optional<SynchronousMapEntry<K, V>>;

    /**
     * Returns the greatest key strictly less than the given key.
     *
     * @param key the key to be matched
     * @returns an optional containing the closest key, or empty if absent
     */
    lowerKey(key: K): Optional<K>;

    /**
     * Returns the entry with the greatest key strictly less than the given key.
     *
     * @param key the key to be matched
     * @returns an optional containing the matching snapshot, or empty if absent
     */
    lowerEntry(key: K): Optional<SynchronousMapEntry<K, V>>;

    /**
     * Returns the greatest key less than or equal to the given key.
     *
     * @param key the key to be matched
     * @returns an optional containing the closest key, or empty if absent
     */
    floorKey(key: K): Optional<K>;

    /**
     * Returns the entry with the greatest key less than or equal to the given key.
     *
     * @param key the key to be matched
     * @returns an optional containing the matching snapshot, or empty if absent
     */
    floorEntry(key: K): Optional<SynchronousMapEntry<K, V>>;

    /**
     * Returns the least key greater than or equal to the given key.
     *
     * @param key the key to be matched
     * @returns an optional containing the closest key, or empty if absent
     */
    ceilingKey(key: K): Optional<K>;

    /**
     * Returns the entry with the least key greater than or equal to the given key.
     *
     * @param key the key to be matched
     * @returns an optional containing the matching snapshot, or empty if absent
     */
    ceilingEntry(key: K): Optional<SynchronousMapEntry<K, V>>;

    /**
     * Returns the least key strictly greater than the given key.
     *
     * @param key the key to be matched
     * @returns an optional containing the closest key, or empty if absent
     */
    higherKey(key: K): Optional<K>;

    /**
     * Returns the entry with the least key strictly greater than the given key.
     *
     * @param key the key to be matched
     * @returns an optional containing the matching snapshot, or empty if absent
     */
    higherEntry(key: K): Optional<SynchronousMapEntry<K, V>>;

    /**
     * Retrieves and removes the first mapping in this map's order.
     *
     * @returns an optional containing the removed snapshot, or empty if this map is empty
     */
    pollFirstEntry(): Optional<SynchronousMapEntry<K, V>>;

    /**
     * Retrieves and removes the last mapping in this map's order.
     *
     * @returns an optional containing the removed snapshot, or empty if this map is empty
     */
    pollLastEntry(): Optional<SynchronousMapEntry<K, V>>;

    /**
     * Returns a backed view with the comparator and navigation directions
     * reversed. Collection-view iteration order remains unspecified.
     *
     * @returns the descending view
     */
    descendingMap(): SynchronousSkipMap<K, V>;

    /**
     * Returns a backed set view of the keys, supporting removal but not
     * insertion. Iteration order is unspecified; use `navigableKeySet` for
     * traversal in comparator order.
     *
     * @returns the key view
     */
    keySet(): SynchronousSetContract<K>;

    /**
     * Returns a backed navigable key view supporting removal but not insertion.
     *
     * @returns the ordered key view
     */
    navigableKeySet(): SynchronousSkipSet<K>;

    /**
     * Returns a backed navigable key view in reverse order, supporting removal
     * but not insertion.
     *
     * @returns the descending key view
     */
    descendingKeySet(): SynchronousSkipSet<K>;

    /**
     * Returns a backed view from the lower key, inclusive, to the upper key,
     * exclusive.
     *
     * @param fromKey the lower endpoint
     * @param toKey the upper endpoint
     * @returns the range view
     * @throws {RangeError} if endpoints are invalid or reversed
     */
    subMap(fromKey: K, toKey: K): SynchronousSkipMap<K, V>;

    /**
     * Returns a backed view between the specified keys.
     *
     * @param fromKey the lower endpoint
     * @param fromInclusive whether to include the lower endpoint
     * @param toKey the upper endpoint
     * @param toInclusive whether to include the upper endpoint
     * @returns the range view
     * @throws {RangeError} if endpoints are invalid or reversed
     */
    subMap(fromKey: K, fromInclusive: boolean, toKey: K, toInclusive: boolean): SynchronousSkipMap<K, V>;

    /**
     * Returns a backed view of mappings below the specified key.
     *
     * @param toKey the upper endpoint
     * @param inclusive whether to include the endpoint; defaults to `false`
     * @returns the range view
     * @throws {RangeError} if the endpoint is outside an enclosing range
     */
    headMap(toKey: K, inclusive?: boolean): SynchronousSkipMap<K, V>;

    /**
     * Returns a backed view of mappings above the specified key.
     *
     * @param fromKey the lower endpoint
     * @param inclusive whether to include the endpoint; defaults to `true`
     * @returns the range view
     * @throws {RangeError} if the endpoint is outside an enclosing range
     */
    tailMap(fromKey: K, inclusive?: boolean): SynchronousSkipMap<K, V>;
}

/**
 * A navigable skip map whose collection views follow comparator order.
 *
 * Key, value and entry iteration, and `forEach` actions, follow the map's key
 * comparator. Descending views reverse that order; range views retain it within
 * their inherited bounds. All other navigation and backed-view contracts are
 * inherited from `AsynchronousSkipMap`.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface AsynchronousOrderedSkipMap<K, V> extends AsynchronousOrderedMap<K, V>, AsynchronousSkipMapOperations<K, V> {
    /** Runtime marker identifying this interface as a member of the skip map family. */
    readonly [AsynchronousSkipMapSymbol]: unique symbol;

    /** Identifies this interface at runtime. */
    readonly [AsynchronousOrderedSkipMapSymbol]: unique symbol;
}

/**
 * A navigable skip map with no collection-view iteration-order guarantee.
 *
 * Key, value and entry iteration, and `forEach` actions, have unspecified order.
 * Comparator navigation is retained. The explicit `navigableKeySet` and
 * `descendingKeySet` views remain ordered skip sets. Descending and range maps
 * preserve this unordered variant and all inherited navigation and bound
 * restrictions.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface AsynchronousUnorderedSkipMap<K, V> extends AsynchronousUnorderedMap<K, V>, AsynchronousSkipMapOperations<K, V> {
    /** Runtime marker identifying this interface as a member of the skip map family. */
    readonly [AsynchronousSkipMapSymbol]: unique symbol;

    /** Identifies this interface at runtime. */
    readonly [AsynchronousUnorderedSkipMapSymbol]: unique symbol;
}

/**
 * A navigable skip map whose collection views follow comparator order.
 *
 * Key, value and entry iteration, and `forEach` actions, follow the map's key
 * comparator. Descending views reverse that order; range views retain it within
 * their inherited bounds. All other navigation and backed-view contracts are
 * inherited from `SynchronousSkipMap`.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface SynchronousOrderedSkipMap<K, V> extends SynchronousOrderedMap<K, V>, SynchronousSkipMapOperations<K, V> {
    /** Runtime marker identifying this interface as a member of the skip map family. */
    readonly [SynchronousSkipMapSymbol]: unique symbol;

    /** Identifies this interface at runtime. */
    readonly [SynchronousOrderedSkipMapSymbol]: unique symbol;
}

/**
 * A navigable skip map with no collection-view iteration-order guarantee.
 *
 * Key, value and entry iteration, and `forEach` actions, have unspecified order.
 * Comparator navigation is retained. The explicit `navigableKeySet` and
 * `descendingKeySet` views remain ordered skip sets. Descending and range maps
 * preserve this unordered variant and all inherited navigation and bound
 * restrictions.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface SynchronousUnorderedSkipMap<K, V> extends SynchronousUnorderedMap<K, V>, SynchronousSkipMapOperations<K, V> {
    /** Runtime marker identifying this interface as a member of the skip map family. */
    readonly [SynchronousSkipMapSymbol]: unique symbol;

    /** Identifies this interface at runtime. */
    readonly [SynchronousUnorderedSkipMapSymbol]: unique symbol;
}

/** Creates an asynchronous skip list whose indexing follows positions, not values. */
export interface AsynchronousSkipListConstructor {
    new <E = unknown>(): AsynchronousSkipList<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): AsynchronousSkipList<E>;
    new <E>(source: AsyncIterable<E>, options?: CollectionOptions<E>): AsynchronousSkipList<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): AsynchronousSkipList<E>;
}
/** Creates a synchronous positional skip list. No complexity guarantee is made. */
export interface SynchronousSkipListConstructor {
    new <E = unknown>(): SynchronousSkipList<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): SynchronousSkipList<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): SynchronousSkipList<E>;
}
/** Creates an asynchronous navigable set with backed range and descending views. */
export interface AsynchronousSkipSetConstructor {
    new <E = unknown>(): AsynchronousSkipSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): AsynchronousSkipSet<E>;
    new <E>(source: AsyncIterable<E>, options?: CollectionOptions<E>): AsynchronousSkipSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): AsynchronousSkipSet<E>;
}
/** Creates a synchronous navigable set with backed range and descending views. */
export interface SynchronousSkipSetConstructor {
    new <E = unknown>(): SynchronousSkipSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): SynchronousSkipSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): SynchronousSkipSet<E>;
}
/** Creates an asynchronous ordered skip set; the default comparator is `useCompare` with a deterministic fallback. */
export interface AsynchronousOrderedSkipSetConstructor {
    new <E = unknown>(): AsynchronousOrderedSkipSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): AsynchronousOrderedSkipSet<E>;
    new <E>(source: AsyncIterable<E>, options?: CollectionOptions<E>): AsynchronousOrderedSkipSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): AsynchronousOrderedSkipSet<E>;
}
/** Creates an asynchronous skip set with SameValueZero equality and unspecified iteration order. */
export interface AsynchronousUnorderedSkipSetConstructor {
    new <E = unknown>(): AsynchronousUnorderedSkipSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): AsynchronousUnorderedSkipSet<E>;
    new <E>(source: AsyncIterable<E>, options?: CollectionOptions<E>): AsynchronousUnorderedSkipSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): AsynchronousUnorderedSkipSet<E>;
}
/** Creates a synchronous ordered skip set; the default comparator is `useCompare` with a deterministic fallback. */
export interface SynchronousOrderedSkipSetConstructor {
    new <E = unknown>(): SynchronousOrderedSkipSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): SynchronousOrderedSkipSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): SynchronousOrderedSkipSet<E>;
}
/** Creates a synchronous skip set with SameValueZero equality and unspecified iteration order. */
export interface SynchronousUnorderedSkipSetConstructor {
    new <E = unknown>(): SynchronousUnorderedSkipSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): SynchronousUnorderedSkipSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): SynchronousUnorderedSkipSet<E>;
}

/**
 * Creates a positional skip list with backed sublist views.
 * Promise operations wait for source initialisation.
 */
export const AsynchronousSkipList: AsynchronousSkipListConstructor = createCollectionConstructor("AsynchronousSkipList", true, "list", "skip") as unknown as AsynchronousSkipListConstructor;
/**
 * Creates a positional skip list with backed sublist views.
 * Operations return their results directly.
 */
export const SynchronousSkipList: SynchronousSkipListConstructor = createCollectionConstructor("SynchronousSkipList", false, "list", "skip") as unknown as SynchronousSkipListConstructor;
/**
 * Creates a navigable set with backed comparator-ordered range views.
 * Promise operations wait for source initialisation.
 */
export const AsynchronousSkipSet: AsynchronousSkipSetConstructor = createCollectionConstructor("AsynchronousSkipSet", true, "set", "skip", { ordered: false }) as unknown as AsynchronousSkipSetConstructor;
/**
 * Creates a navigable set with backed comparator-ordered range views.
 * Operations return their results directly.
 */
export const SynchronousSkipSet: SynchronousSkipSetConstructor = createCollectionConstructor("SynchronousSkipSet", false, "set", "skip", { ordered: false }) as unknown as SynchronousSkipSetConstructor;
/**
 * Creates a navigable skip set whose elements are unique by comparator and
 * iterate in comparator order. Promise operations wait for source initialisation.
 */
export const AsynchronousOrderedSkipSet: AsynchronousOrderedSkipSetConstructor = createCollectionConstructor("AsynchronousOrderedSkipSet", true, "set", "skip", { ordered: true, comparator: useDefaultOrder }) as unknown as AsynchronousOrderedSkipSetConstructor;
/**
 * Creates a navigable skip set whose elements are unique by comparator and
 * iterate in comparator order. Operations return their results directly.
 */
export const SynchronousOrderedSkipSet: SynchronousOrderedSkipSetConstructor = createCollectionConstructor("SynchronousOrderedSkipSet", false, "set", "skip", { ordered: true, comparator: useDefaultOrder }) as unknown as SynchronousOrderedSkipSetConstructor;
/**
 * Creates a navigable skip set with SameValueZero equality and no iteration-order
 * guarantee. Promise operations wait for source initialisation.
 */
export const AsynchronousUnorderedSkipSet: AsynchronousUnorderedSkipSetConstructor = createCollectionConstructor("AsynchronousUnorderedSkipSet", true, "set", "skip", { ordered: false }) as unknown as AsynchronousUnorderedSkipSetConstructor;
/**
 * Creates a navigable skip set with SameValueZero equality and no iteration-order
 * guarantee. Operations return their results directly.
 */
export const SynchronousUnorderedSkipSet: SynchronousUnorderedSkipSetConstructor = createCollectionConstructor("SynchronousUnorderedSkipSet", false, "set", "skip", { ordered: false }) as unknown as SynchronousUnorderedSkipSetConstructor;

/**
 * Constructor for SynchronousSkipMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Values must be non-null. Constructors return the container immediately.
 * Supply options.comparator for custom keys. The default accepts homogeneous
 * strings, numbers, bigints or booleans (NaN sorts last). Comparators must
 * return finite numbers and compare equal exactly for SameValueZero keys.
 * Nullish keys are rejected. Navigation entries are read-only snapshots.
 * The runtime uses sorted snapshots; no skip-link complexity is promised.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface SynchronousSkipMapConstructor {
    new <K, V>(): SynchronousSkipMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): SynchronousSkipMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): SynchronousSkipMap<K, V>;
}

/** Creates a SynchronousSkipMap with its complete inherited runtime contract. */
export const SynchronousSkipMap: SynchronousSkipMapConstructor = createMapConstructor("SynchronousSkipMap", { asynchronous: false, family: "skip" }) as unknown as SynchronousSkipMapConstructor;

/**
 * Constructor for AsynchronousSkipMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Values must be non-null. Constructors return the container immediately.
 * Async sources load in iteration order; promise operations wait for loading
 * and execute in invocation order. clear() is synchronous and cancels unread
 * source mappings and earlier queued writes. Iterable sources load eagerly.
 * Supply options.comparator for custom keys. The default accepts homogeneous
 * strings, numbers, bigints or booleans (NaN sorts last). Comparators must
 * return finite numbers and compare equal exactly for SameValueZero keys.
 * Nullish keys are rejected. Navigation entries are read-only snapshots.
 * The runtime uses sorted snapshots; no skip-link complexity is promised.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface AsynchronousSkipMapConstructor {
    new <K, V>(): AsynchronousSkipMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): AsynchronousSkipMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousSkipMap<K, V>;
    new <K, V>(target: AsyncIterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousSkipMap<K, V>;
    new <K, V>(target: MapSource<K, V>, options?: MapOptions<K>): AsynchronousSkipMap<K, V>;
}

/** Creates an AsynchronousSkipMap with its complete inherited runtime contract. */
export const AsynchronousSkipMap: AsynchronousSkipMapConstructor = createMapConstructor("AsynchronousSkipMap", { asynchronous: true, family: "skip" }) as unknown as AsynchronousSkipMapConstructor;

/**
 * Constructor for SynchronousOrderedSkipMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Values must be non-null. Constructors return the container immediately.
 * Supply options.comparator for custom keys. The default accepts homogeneous
 * strings, numbers, bigints or booleans (NaN sorts last). Comparators must
 * return finite numbers and compare equal exactly for SameValueZero keys.
 * Nullish keys are rejected. Navigation entries are read-only snapshots.
 * The runtime uses sorted snapshots; no skip-link complexity is promised.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface SynchronousOrderedSkipMapConstructor {
    new <K, V>(): SynchronousOrderedSkipMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): SynchronousOrderedSkipMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): SynchronousOrderedSkipMap<K, V>;
}

/** Creates a SynchronousOrderedSkipMap with its complete inherited runtime contract. */
export const SynchronousOrderedSkipMap: SynchronousOrderedSkipMapConstructor = createMapConstructor("SynchronousOrderedSkipMap", { asynchronous: false, family: "skip", ordered: true }) as unknown as SynchronousOrderedSkipMapConstructor;

/**
 * Constructor for AsynchronousOrderedSkipMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Values must be non-null. Constructors return the container immediately.
 * Async sources load in iteration order; promise operations wait for loading
 * and execute in invocation order. clear() is synchronous and cancels unread
 * source mappings and earlier queued writes. Iterable sources load eagerly.
 * Supply options.comparator for custom keys. The default accepts homogeneous
 * strings, numbers, bigints or booleans (NaN sorts last). Comparators must
 * return finite numbers and compare equal exactly for SameValueZero keys.
 * Nullish keys are rejected. Navigation entries are read-only snapshots.
 * The runtime uses sorted snapshots; no skip-link complexity is promised.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface AsynchronousOrderedSkipMapConstructor {
    new <K, V>(): AsynchronousOrderedSkipMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): AsynchronousOrderedSkipMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousOrderedSkipMap<K, V>;
    new <K, V>(target: AsyncIterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousOrderedSkipMap<K, V>;
    new <K, V>(target: MapSource<K, V>, options?: MapOptions<K>): AsynchronousOrderedSkipMap<K, V>;
}

/** Creates an AsynchronousOrderedSkipMap with its complete inherited runtime contract. */
export const AsynchronousOrderedSkipMap: AsynchronousOrderedSkipMapConstructor = createMapConstructor("AsynchronousOrderedSkipMap", { asynchronous: true, family: "skip", ordered: true }) as unknown as AsynchronousOrderedSkipMapConstructor;

/**
 * Constructor for SynchronousUnorderedSkipMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Values must be non-null. Constructors return the container immediately.
 * Supply options.comparator for custom keys. The default accepts homogeneous
 * strings, numbers, bigints or booleans (NaN sorts last). Comparators must
 * return finite numbers and compare equal exactly for SameValueZero keys.
 * Nullish keys are rejected. Navigation entries are read-only snapshots.
 * The runtime uses sorted snapshots; no skip-link complexity is promised.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface SynchronousUnorderedSkipMapConstructor {
    new <K, V>(): SynchronousUnorderedSkipMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): SynchronousUnorderedSkipMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): SynchronousUnorderedSkipMap<K, V>;
}

/** Creates a SynchronousUnorderedSkipMap with its complete inherited runtime contract. */
export const SynchronousUnorderedSkipMap: SynchronousUnorderedSkipMapConstructor = createMapConstructor("SynchronousUnorderedSkipMap", { asynchronous: false, family: "skip", ordered: false }) as unknown as SynchronousUnorderedSkipMapConstructor;

/**
 * Constructor for AsynchronousUnorderedSkipMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Values must be non-null. Constructors return the container immediately.
 * Async sources load in iteration order; promise operations wait for loading
 * and execute in invocation order. clear() is synchronous and cancels unread
 * source mappings and earlier queued writes. Iterable sources load eagerly.
 * Supply options.comparator for custom keys. The default accepts homogeneous
 * strings, numbers, bigints or booleans (NaN sorts last). Comparators must
 * return finite numbers and compare equal exactly for SameValueZero keys.
 * Nullish keys are rejected. Navigation entries are read-only snapshots.
 * The runtime uses sorted snapshots; no skip-link complexity is promised.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface AsynchronousUnorderedSkipMapConstructor {
    new <K, V>(): AsynchronousUnorderedSkipMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): AsynchronousUnorderedSkipMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousUnorderedSkipMap<K, V>;
    new <K, V>(target: AsyncIterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousUnorderedSkipMap<K, V>;
    new <K, V>(target: MapSource<K, V>, options?: MapOptions<K>): AsynchronousUnorderedSkipMap<K, V>;
}

/** Creates an AsynchronousUnorderedSkipMap with its complete inherited runtime contract. */
export const AsynchronousUnorderedSkipMap: AsynchronousUnorderedSkipMapConstructor = createMapConstructor("AsynchronousUnorderedSkipMap", { asynchronous: true, family: "skip", ordered: false }) as unknown as AsynchronousUnorderedSkipMapConstructor;
