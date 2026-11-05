import { useHash } from "#semantic/hash";
import * as brands from "#semantic/symbol";
import { createCollection } from "#semantic/structure/collection";
import {
    AsynchronousMapEntrySymbol, SynchronousMapEntrySymbol,
    AsynchronousOrderedMapSymbol, AsynchronousUnorderedMapSymbol,
    SynchronousOrderedMapSymbol, SynchronousUnorderedMapSymbol,
    AsynchronousLRUSetSymbol, AsynchronousSkipSetSymbol, SynchronousLRUSetSymbol, SynchronousSkipSetSymbol,
    AsynchronousOrderedSetSymbol, AsynchronousUnorderedSetSymbol,
    SynchronousOrderedSetSymbol, SynchronousUnorderedSetSymbol,
} from "#semantic/symbol";
import { Optional } from "#semantic/optional";
import type { AsynchronousCollection, SynchronousCollection } from "#semantic/structure/collection";
import type { AsynchronousSetContract, AsynchronousUnorderedSet, SynchronousSetContract, SynchronousUnorderedSet } from "#semantic/structure/set";
import type { BiConsumer, BiFunctional, Comparator, Functional, MaybeInvalid } from "#semantic/utility";

/**
 * A key-value pair represented by properties rather than entry operations.
 *
 * The key is read-only through this interface; the value may be replaced.
 * This structural data shape does not imply a connection to a backing map.
 *
 * @template K the type of the key
 * @template V the type of the value
 */
export interface Entry<K, V> {
    /** The key identifying this pair. */
    readonly key: K;

    /** The value associated with the key. */
    value: V;
}

/**
 * @internal
 * Shared asynchronous map contract implemented by the ordered and unordered
 * map roots. It carries no brand of its own; concrete variants add their
 * ordered/unordered marker. Ordering, equality and hashing are specified by
 * the concrete variant.
 *
 * A map cannot contain duplicate keys; each key can map to at most one value.
 * Its contents can be viewed as a set of keys, a collection of values, or a set
 * of entries. The map itself is neither a collection nor an iterable. Any
 * ordering guarantees apply to iteration over its collection views.
 *
 * Unlike the JDK map contract, this interface does not permit `null` or
 * `undefined` as stored values; both represent absence. Methods returning
 * `Promise<V>` resolve to a value on success and reject if there is no result
 * value, as specified by the individual operation. Such rejection indicates
 * an absent result, not necessarily a failed mutation: a completed removal
 * remains in effect and is not rolled back. As an exception, `put` and
 * `putIfAbsent` return `Promise<V | void>` and resolve without a result value
 * after successfully inserting a new mapping. Methods returning
 * `Promise<boolean>` may legitimately resolve to `false`, and methods returning
 * `Promise<void>` resolve on successful completion without a result value.
 * Computation callbacks may return `null` or `undefined` to leave a mapping
 * absent or remove it, as specified by the individual operation. Implementations
 * determine which keys they permit and how keys and values are compared and
 * hashed, consistently with the equality and hash code contracts below.
 *
 * All operations except `clear` return promises. Callbacks are synchronous;
 * their return values are not awaited. No operation guarantees atomicity or
 * synchronisation unless the implementation documents stronger guarantees.
 * Callbacks should not modify this map during their execution. Modifying
 * operations are optional and may fail if the implementation does not support
 * the requested change.
 *
 * Changing a key in a way that affects equality while it is in this map leaves
 * the behaviour of the map unspecified.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface AsynchronousMapContract<K, V> {

    /**
     * Removes all of the mappings from this map (optional operation).
     *
     * The map will be empty after this method returns. This operation remains
     * synchronous, consistently with the collection interfaces.
     */
    clear(): void;

    /**
     * Attempts to compute a mapping for the specified key and its current value.
     *
     * The synchronous function receives the key and its current value, or
     * `null` or `undefined` if there is no mapping. A non-absent result replaces
     * the value or creates a mapping. A `null` or `undefined` result removes
     * the mapping, or leaves it absent if it was absent initially. If the
     * function throws, the promise rejects and this operation leaves the
     * current mapping unchanged. The function should not modify this map.
     * No atomicity or synchronisation is guaranteed.
     *
     * @param key the key with which the computed value is to be associated
     * @param remappingFunction the synchronous function to compute a value
     * @returns a `Promise<V>` that resolves to the new value, or rejects if the
     *         mapping is absent after computation; any removal is completed
     *         before rejection and is not rolled back
     */
    compute(key: K, remappingFunction: BiFunctional<K, MaybeInvalid<V>, MaybeInvalid<V>>): Promise<V>;

    /**
     * Computes a value for the specified key only if it has no mapping.
     *
     * An existing value is returned without invoking the synchronous function.
     * Otherwise the function receives the key, and a non-absent result is
     * entered into this map. If the result is `null` or `undefined`, no mapping
     * is recorded. If the function throws, the promise rejects and no mapping
     * is recorded by this operation. The function should not modify this map.
     * No atomicity or synchronisation is guaranteed.
     *
     * @param key the key with which the computed value is to be associated
     * @param mappingFunction the synchronous function to compute a value
     * @returns a `Promise<V>` that resolves to the existing or computed value,
     *         or rejects if the function returns `null` or `undefined` and no
     *         mapping is recorded
     */
    computeIfAbsent(key: K, mappingFunction: Functional<K, MaybeInvalid<V>>): Promise<V>;

    /**
     * Computes a new value only if the specified key has a mapping.
     *
     * The synchronous function receives the key and its current value. A
     * non-absent result replaces the current value; `null` or `undefined`
     * removes the mapping. If the key is absent, the function is not invoked.
     * If the function throws, the promise rejects and this operation leaves
     * the current mapping unchanged. The function should not modify this map.
     * No atomicity or synchronisation is guaranteed.
     *
     * @param key the key whose associated value is to be recomputed
     * @param remappingFunction the synchronous function to compute a new value
     * @returns a `Promise<V>` that resolves to the new value, or rejects if the
     *         mapping is absent after computation; any removal is completed
     *         before rejection and is not rolled back
     */
    computeIfPresent(key: K, remappingFunction: BiFunctional<K, V, MaybeInvalid<V>>): Promise<V>;

    /**
     * Tests whether this map contains a mapping for the specified key.
     *
     * A mapping is present if its key is equal to the specified key according
     * to this map's key equality contract.
     *
     * @param key the key whose presence in this map is to be tested
     * @returns a promise that resolves to `true` if this map contains a mapping
     *         for the specified key
     */
    containsKey(key: unknown): Promise<boolean>;

    /**
     * Tests whether this map maps one or more keys to the specified value.
     *
     * Values are compared according to this map's value equality contract.
     *
     * @param value the value whose presence in this map is to be tested
     * @returns a promise that resolves to `true` if this map contains at least
     *         one mapping to the specified value
     */
    containsValue(value: unknown): Promise<boolean>;

    /**
     * Returns a set view of the mappings contained in this map.
     *
     * The set is backed by this map: changes to the map are reflected in the
     * set, and supported removals from the set remove the corresponding
     * mappings from the map. Clearing either clears the other. The set does
     * not support adding entries through `add` or `addAll`. An entry's
     * supported `setValue` operation writes through to this map.
     *
     * If the map is modified during iteration over the set, except through an
     * entry's supported `setValue` operation or a supported removal by the
     * iterator itself, the results of iteration are undefined.
     *
     * @returns a promise that resolves to a backed set view of this map's entries
     */
    entrySet(): Promise<AsynchronousUnorderedSet<AsynchronousMapEntry<K, V>>>;

    /**
     * Compares the specified map with this map for equality.
     *
     * Two maps are equal if they represent the same mappings, irrespective of
     * iteration order or implementation. Equivalently, their entry sets are
     * equal: each key and corresponding value in either map has an equal key
     * and value in the other. Equal maps must have equal hash codes.
     *
     * @param other the map to be compared for equality with this map
     * @returns a promise that resolves to `true` if the maps represent the same
     *         mappings
     */
    equals(other: AsynchronousMapContract<unknown, unknown>): Promise<boolean>;

    /**
     * Performs the given synchronous action for each entry in this map.
     *
     * The action receives the key and value. Unless the implementation specifies
     * otherwise, actions follow entry-set iteration order, if an order is
     * specified. Processing stops if the action throws, and the promise rejects
     * with that error. The action should not modify this map.
     *
     * @param action the synchronous action to be performed for each key and value
     * @returns a promise that resolves when all actions have been performed
     */
    forEach(action: BiConsumer<K, V>): Promise<void>;

    /**
     * Returns the value to which the specified key is mapped, if present.
     *
     * @param key the key whose associated value is to be returned
     * @returns a `Promise<V>` that resolves to the mapped value, or rejects if
     *         this map has no mapping for the key
     */
    get(key: unknown): Promise<V>;

    /**
     * Returns the mapped value, or the specified default if the key is absent.
     *
     * This operation does not add a mapping for the default value.
     *
     * @param key the key whose associated value is to be returned
     * @param defaultValue the value to return if the key has no mapping
     * @returns a promise that resolves to the mapped value, or `defaultValue`
     *         if this map contains no mapping for the key
     */
    getOrDefault(key: unknown, defaultValue: V): Promise<V>;

    /**
     * Returns the hash code value for this map.
     *
     * The hash code is the sum of the hash codes of the entries in the entry
     * set. Consequently it is independent of iteration order, and equal maps
     * must have equal hash codes.
     *
     * @returns a promise that resolves to the hash code value for this map
     */
    hashCode(): Promise<bigint>;

    /**
     * Tests whether this map contains no key-value mappings.
     *
     * @returns a promise that resolves to `true` if this map contains no mappings
     */
    isEmpty(): Promise<boolean>;

    /**
     * Returns a set view of the keys contained in this map.
     *
     * The set is backed by this map: changes to the map are reflected in the
     * set, and supported removals from the set remove the corresponding
     * mappings from the map. Clearing either clears the other. The set does
     * not support adding keys through `add` or `addAll`. Results of iteration
     * are undefined if the map is modified during iteration, except through
     * a supported removal by the iterator itself.
     *
     * @returns a promise that resolves to a backed set view of this map's keys
     */
    keySet(): Promise<AsynchronousSetContract<K>>;

    /**
     * Associates a value with the key, combining it with an existing value.
     *
     * If the key is absent, the specified value is inserted without invoking
     * the synchronous function. Otherwise the function receives the existing
     * value and the specified value, in that order. A non-absent result replaces
     * the existing value; `null` or `undefined` removes the mapping. If the
     * function throws, the promise rejects and this operation leaves the
     * current mapping unchanged. The function should not modify this map.
     * No atomicity or synchronisation is guaranteed.
     *
     * @param key the key with which the resulting value is to be associated
     * @param value the non-absent value to insert or combine with an existing value
     * @param remappingFunction the synchronous function to combine the values
     * @returns a `Promise<V>` that resolves to the new value, or rejects after
     *         removing the mapping if the function returns `null` or `undefined`;
     *         the removal is not rolled back
     */
    merge(key: K, value: V, remappingFunction: BiFunctional<V, V, MaybeInvalid<V>>): Promise<V>;

    /**
     * Associates the specified value with the specified key (optional operation).
     *
     * If this map previously contained a mapping for the key, the old value is
     * replaced by the specified value.
     *
     * @param key the key with which the specified value is to be associated
     * @param value the non-absent value to be associated with the specified key
     * @returns a `Promise<V | void>` that resolves to the previous value if the
     *         key had a mapping, or completes successfully without a result value
     *         after inserting a new mapping
     */
    put(key: K, value: V): Promise<V | void>;

    /**
     * Copies all mappings from the specified map to this map (optional operation).
     *
     * Each copied mapping replaces any existing mapping for the same key. The
     * behaviour is undefined if the source map is modified during this operation.
     *
     * @param map the map whose mappings are to be stored in this map
     * @returns a promise that resolves when all mappings have been copied
     */
    putAll(map: AsynchronousMapContract<K, V>): Promise<void>;

    /**
     * Associates the value with the key only if the key has no mapping.
     *
     * An existing mapping is left unchanged. No atomicity or synchronisation
     * is guaranteed.
     *
     * @param key the key with which the specified value is to be associated
     * @param value the non-absent value to insert if the key is absent
     * @returns a `Promise<V | void>` that resolves to the existing value if the
     *         key has a mapping, or completes successfully without a result value
     *         after inserting a new mapping
     */
    putIfAbsent(key: K, value: V): Promise<V | void>;

    /**
     * Removes the mapping for the specified key, if present (optional operation).
     *
     * @param key the key whose mapping is to be removed from this map
     * @returns a `Promise<V>` that resolves to the previous value, or rejects if
     *         the key had no mapping
     */
    remove(key: unknown): Promise<V>;

    /**
     * Removes the mapping only if the key is mapped to the specified value.
     *
     * Values are compared according to this map's value equality contract.
     * No atomicity or synchronisation is guaranteed.
     *
     * @param key the key whose mapping is to be removed
     * @param value the value expected to be associated with the specified key
     * @returns a promise that resolves to `true` if the mapping was removed
     */
    remove(key: unknown, value: unknown): Promise<boolean>;

    /**
     * Replaces the value for the specified key only if the key has a mapping.
     *
     * No atomicity or synchronisation is guaranteed.
     *
     * @param key the key whose associated value is to be replaced
     * @param value the non-absent replacement value
     * @returns a `Promise<V>` that resolves to the previous value, or rejects if
     *         the key had no mapping
     */
    replace(key: K, value: V): Promise<V>;

    /**
     * Replaces the value only if the key is mapped to the expected old value.
     *
     * Values are compared according to this map's value equality contract.
     * No atomicity or synchronisation is guaranteed.
     *
     * @param key the key whose associated value is to be replaced
     * @param oldValue the value expected to be associated with the specified key
     * @param newValue the non-absent value to be associated with the specified key
     * @returns a promise that resolves to `true` if the value was replaced
     */
    replace(key: K, oldValue: V, newValue: V): Promise<boolean>;

    /**
     * Replaces each entry's value with the result of the given synchronous function.
     *
     * The function receives each key and its value and must return a value
     * other than `null` or `undefined`. It should not modify this map. Processing
     * stops if it throws, and the promise rejects with that error; earlier
     * replacements need not be undone. No atomicity or synchronisation is
     * guaranteed.
     *
     * @param remappingFunction the synchronous function to apply to each entry
     * @returns a promise that resolves when all values have been replaced
     */
    replaceAll(remappingFunction: BiFunctional<K, V, V>): Promise<void>;

    /**
     * Returns the number of key-value mappings in this map.
     *
     * @returns a promise that resolves to the number of mappings in this map
     */
    size(): Promise<bigint>;

    /**
     * Returns a collection view of the values contained in this map.
     *
     * The collection is backed by this map: changes to the map are reflected
     * in the collection, and supported removals remove corresponding mappings
     * from the map. Removing a single value removes one matching mapping;
     * duplicate values may remain. Clearing either clears the other. The
     * collection does not support `add` or `addAll`. Results of iteration are
     * undefined if the map is modified during iteration, except through a
     * supported removal by the iterator itself.
     *
     * @returns a promise that resolves to a backed collection view of this map's values
     */
    values(): Promise<AsynchronousCollection<V>>;
}

/**
 * @internal
 * Shared synchronous map contract implemented by the ordered and unordered
 * map roots. It carries no brand of its own; concrete variants add their
 * ordered/unordered marker. Ordering, equality and hashing are specified by
 * the concrete variant.
 *
 * A map cannot contain duplicate keys; each key can map to at most one value.
 * Its contents can be viewed as a set of keys, a collection of values, or a set
 * of entries. The map itself is neither a collection nor an iterable. Any
 * ordering guarantees apply to iteration over its collection views.
 *
 * Unlike the JDK map contract, this interface does not permit `null` or
 * `undefined` as stored values: the project's `Optional` treats both as absent.
 * Methods returning an optional use an empty optional for a missing mapping.
 * Computation callbacks may return `null` or `undefined` to leave a mapping
 * absent or remove it, as specified by the individual operation. Implementations
 * determine which keys they permit and how keys and values are compared and
 * hashed, consistently with the equality and hash code contracts below.
 *
 * Each operation returns its result directly. Callbacks are synchronous and
 * should not modify this map during their execution. No operation guarantees
 * atomicity or synchronisation unless the implementation documents stronger
 * guarantees. Modifying operations are optional and may fail if the
 * implementation does not support the requested change.
 *
 * Changing a key in a way that affects equality while it is in this map leaves
 * the behaviour of the map unspecified.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface SynchronousMapContract<K, V> {

    /**
     * Removes all of the mappings from this map (optional operation).
     *
     * The map will be empty after this method returns.
     */
    clear(): void;

    /**
     * Attempts to compute a mapping for the specified key and its current value.
     *
     * The function receives the key and its current value, or `null` or
     * `undefined` if there is no mapping. A non-absent result replaces the value
     * or creates a mapping. A `null` or `undefined` result removes the mapping,
     * or leaves it absent if it was absent initially. If the function throws,
     * the error is relayed to the caller and this operation leaves the current
     * mapping unchanged. The function should not modify this map. No atomicity
     * or synchronisation is guaranteed.
     *
     * @param key the key with which the computed value is to be associated
     * @param remappingFunction the function to compute a value
     * @returns an optional containing the new value, or an empty optional if
     *         the mapping is absent after computation
     */
    compute(key: K, remappingFunction: BiFunctional<K, MaybeInvalid<V>, MaybeInvalid<V>>): Optional<V>;

    /**
     * Computes a value for the specified key only if it has no mapping.
     *
     * An existing value is returned without invoking the function. Otherwise
     * the function receives the key, and a non-absent result is entered into
     * this map. If the result is `null` or `undefined`, no mapping is recorded.
     * If the function throws, the error is relayed to the caller and no mapping
     * is recorded by this operation. The function should not modify this map.
     * No atomicity or synchronisation is guaranteed.
     *
     * @param key the key with which the computed value is to be associated
     * @param mappingFunction the function to compute a value
     * @returns an optional containing the existing or computed value, or an
     *         empty optional if no value is recorded
     */
    computeIfAbsent(key: K, mappingFunction: Functional<K, MaybeInvalid<V>>): Optional<V>;

    /**
     * Computes a new value only if the specified key has a mapping.
     *
     * The function receives the key and its current value. A non-absent result
     * replaces the current value; `null` or `undefined` removes the mapping.
     * If the key is absent, the function is not invoked. If the function throws,
     * the error is relayed to the caller and this operation leaves the current
     * mapping unchanged. The function should not modify this map. No atomicity
     * or synchronisation is guaranteed.
     *
     * @param key the key whose associated value is to be recomputed
     * @param remappingFunction the function to compute a new value
     * @returns an optional containing the new value, or an empty optional if
     *         the mapping is absent after computation
     */
    computeIfPresent(key: K, remappingFunction: BiFunctional<K, V, MaybeInvalid<V>>): Optional<V>;

    /**
     * Returns `true` if this map contains a mapping for the specified key.
     *
     * A mapping is present if its key is equal to the specified key according
     * to this map's key equality contract.
     *
     * @param key the key whose presence in this map is to be tested
     * @returns `true` if this map contains a mapping for the specified key
     */
    containsKey(key: unknown): boolean;

    /**
     * Returns `true` if this map maps one or more keys to the specified value.
     *
     * Values are compared according to this map's value equality contract.
     *
     * @param value the value whose presence in this map is to be tested
     * @returns `true` if this map contains at least one mapping to the specified value
     */
    containsValue(value: unknown): boolean;

    /**
     * Returns a set view of the mappings contained in this map.
     *
     * The set is backed by this map: changes to the map are reflected in the
     * set, and supported removals from the set remove the corresponding
     * mappings from the map. Clearing either clears the other. The set does
     * not support adding entries through `add` or `addAll`. An entry's
     * supported `setValue` operation writes through to this map.
     *
     * If the map is modified during iteration over the set, except through an
     * entry's supported `setValue` operation or a supported removal by the
     * iterator itself, the results of iteration are undefined.
     *
     * @returns a backed set view of this map's entries
     */
    entrySet(): SynchronousUnorderedSet<SynchronousMapEntry<K, V>>;

    /**
     * Compares the specified map with this map for equality.
     *
     * Two maps are equal if they represent the same mappings, irrespective of
     * iteration order or implementation. Equivalently, their entry sets are
     * equal: each key and corresponding value in either map has an equal key
     * and value in the other. Equal maps must have equal hash codes.
     *
     * @param other the map to be compared for equality with this map
     * @returns `true` if the maps represent the same mappings
     */
    equals(other: SynchronousMapContract<unknown, unknown>): boolean;

    /**
     * Performs the given action for each entry in this map.
     *
     * The action receives the key and value. Unless the implementation specifies
     * otherwise, actions follow entry-set iteration order, if an order is
     * specified. Processing stops if the action throws, and the error is relayed
     * to the caller. The action should not modify this map.
     *
     * @param action the action to be performed for each key and value
     */
    forEach(action: BiConsumer<K, V>): void;

    /**
     * Returns the value to which the specified key is mapped, if present.
     *
     * @param key the key whose associated value is to be returned
     * @returns an optional containing the mapped value, or an empty optional
     *         if this map has no mapping for the key
     */
    get(key: unknown): Optional<V>;

    /**
     * Returns the mapped value, or the specified default if the key is absent.
     *
     * This operation does not add a mapping for the default value.
     *
     * @param key the key whose associated value is to be returned
     * @param defaultValue the value to return if the key has no mapping
     * @returns the mapped value, or `defaultValue` if this map contains no
     *         mapping for the key
     */
    getOrDefault(key: unknown, defaultValue: V): V;

    /**
     * Returns the hash code value for this map.
     *
     * The hash code is the sum of the hash codes of the entries in the entry
     * set. Consequently it is independent of iteration order, and equal maps
     * must have equal hash codes.
     *
     * @returns the hash code value for this map
     */
    hashCode(): bigint;

    /**
     * Returns `true` if this map contains no key-value mappings.
     *
     * @returns `true` if this map contains no mappings
     */
    isEmpty(): boolean;

    /**
     * Returns a set view of the keys contained in this map.
     *
     * The set is backed by this map: changes to the map are reflected in the
     * set, and supported removals from the set remove the corresponding
     * mappings from the map. Clearing either clears the other. The set does
     * not support adding keys through `add` or `addAll`. Results of iteration
     * are undefined if the map is modified during iteration, except through
     * a supported removal by the iterator itself.
     *
     * @returns a backed set view of this map's keys
     */
    keySet(): SynchronousSetContract<K>;

    /**
     * Associates a value with the key, combining it with an existing value.
     *
     * If the key is absent, the specified value is inserted without invoking
     * the function. Otherwise the function receives the existing value and the
     * specified value, in that order. A non-absent result replaces the existing
     * value; `null` or `undefined` removes the mapping. If the function throws,
     * the error is relayed to the caller and this operation leaves the current
     * mapping unchanged. The function should not modify this map. No atomicity
     * or synchronisation is guaranteed.
     *
     * @param key the key with which the resulting value is to be associated
     * @param value the non-absent value to insert or combine with an existing value
     * @param remappingFunction the function to combine the values
     * @returns an optional containing the new value, or an empty optional if
     *         the mapping was removed
     */
    merge(key: K, value: V, remappingFunction: BiFunctional<V, V, MaybeInvalid<V>>): Optional<V>;

    /**
     * Associates the specified value with the specified key (optional operation).
     *
     * If this map previously contained a mapping for the key, the old value is
     * replaced by the specified value.
     *
     * @param key the key with which the specified value is to be associated
     * @param value the non-absent value to be associated with the specified key
     * @returns an optional containing the previous value, or an empty optional
     *         if the key had no mapping
     */
    put(key: K, value: V): Optional<V>;

    /**
     * Copies all mappings from the specified map to this map (optional operation).
     *
     * Each copied mapping replaces any existing mapping for the same key. The
     * behaviour is undefined if the source map is modified during this operation.
     *
     * @param map the map whose mappings are to be stored in this map
     */
    putAll(map: SynchronousMapContract<K, V>): void;

    /**
     * Associates the value with the key only if the key has no mapping.
     *
     * An existing mapping is left unchanged. No atomicity or synchronisation
     * is guaranteed.
     *
     * @param key the key with which the specified value is to be associated
     * @param value the non-absent value to insert if the key is absent
     * @returns an optional containing the previous value, or an empty optional
     *         if the new mapping was inserted
     */
    putIfAbsent(key: K, value: V): Optional<V>;

    /**
     * Removes the mapping for the specified key, if present (optional operation).
     *
     * @param key the key whose mapping is to be removed from this map
     * @returns an optional containing the previous value, or an empty optional
     *         if the key had no mapping
     */
    remove(key: unknown): Optional<V>;

    /**
     * Removes the mapping only if the key is mapped to the specified value.
     *
     * Values are compared according to this map's value equality contract.
     * No atomicity or synchronisation is guaranteed.
     *
     * @param key the key whose mapping is to be removed
     * @param value the value expected to be associated with the specified key
     * @returns `true` if the mapping was removed
     */
    remove(key: unknown, value: unknown): boolean;

    /**
     * Replaces the value for the specified key only if the key has a mapping.
     *
     * No atomicity or synchronisation is guaranteed.
     *
     * @param key the key whose associated value is to be replaced
     * @param value the non-absent replacement value
     * @returns an optional containing the previous value, or an empty optional
     *         if the key had no mapping
     */
    replace(key: K, value: V): Optional<V>;

    /**
     * Replaces the value only if the key is mapped to the expected old value.
     *
     * Values are compared according to this map's value equality contract.
     * No atomicity or synchronisation is guaranteed.
     *
     * @param key the key whose associated value is to be replaced
     * @param oldValue the value expected to be associated with the specified key
     * @param newValue the non-absent value to be associated with the specified key
     * @returns `true` if the value was replaced
     */
    replace(key: K, oldValue: V, newValue: V): boolean;

    /**
     * Replaces each entry's value with the result of the given function.
     *
     * The function receives each key and its value and must return a value
     * other than `null` or `undefined`. It should not modify this map. Processing
     * stops if it throws, and the error is relayed to the caller; earlier
     * replacements need not be undone. No atomicity or synchronisation is
     * guaranteed.
     *
     * @param remappingFunction the function to apply to each entry
     */
    replaceAll(remappingFunction: BiFunctional<K, V, V>): void;

    /**
     * Returns the number of key-value mappings in this map.
     *
     * @returns the number of mappings in this map
     */
    size(): bigint;

    /**
     * Returns a collection view of the values contained in this map.
     *
     * The collection is backed by this map: changes to the map are reflected
     * in the collection, and supported removals remove corresponding mappings
     * from the map. Removing a single value removes one matching mapping;
     * duplicate values may remain. Clearing either clears the other. The
     * collection does not support `add` or `addAll`. Results of iteration are
     * undefined if the map is modified during iteration, except through a
     * supported removal by the iterator itself.
     *
     * @returns a backed collection view of this map's values
     */
    values(): SynchronousCollection<V>;
}

/**
 * A map entry (key-value pair) supporting asynchronous operations.
 *
 * An entry may be independent of a map or belong to a map's entry-set view.
 * An entry obtained by iterating that view is connected to the backing map
 * only for the duration of iteration. Its behaviour outside that iteration,
 * or after the map is modified other than through this entry's supported
 * `setValue` operation, is undefined. Values exclude `null` and `undefined`,
 * consistently with the backing map.
 *
 * @template K the type of the key
 * @template V the type of the value, excluding `null` and `undefined`
 */
export interface AsynchronousMapEntry<K, V> {

    /** Runtime marker identifying this interface as an asynchronous map entry. */
    readonly [AsynchronousMapEntrySymbol]: unique symbol;

    /**
     * Returns the key corresponding to this entry.
     *
     * @returns a promise that resolves to the key corresponding to this entry
     */
    getKey(): Promise<K>;

    /**
     * Returns the value corresponding to this entry.
     *
     * The behaviour of this call is undefined if the mapping has been removed
     * from the backing map.
     *
     * @returns a promise that resolves to the value corresponding to this entry
     */
    getValue(): Promise<V>;

    /**
     * Replaces the value corresponding to this entry (optional operation).
     *
     * For a connected entry, this operation writes through to the backing map.
     * Its behaviour is undefined if the mapping has already been removed.
     *
     * @param value the non-absent value to be stored in this entry
     * @returns a promise that resolves to the previous value corresponding to this entry
     */
    setValue(value: V): Promise<V>;

    /**
     * Compares the specified entry with this entry for equality.
     *
     * Two entries are equal if their keys are equal and their values are equal,
     * irrespective of implementation or backing map. Equal entries must have
     * equal hash codes.
     *
     * @param other the entry to be compared for equality with this entry
     * @returns a promise that resolves to `true` if the entries represent the
     *         same mapping
     */
    equals(other: AsynchronousMapEntry<unknown, unknown>): Promise<boolean>;

    /**
     * Returns the hash code value for this entry.
     *
     * The hash code is the bitwise exclusive OR of the key's hash code and the
     * value's hash code, using `0n` for a `null` or `undefined` key if permitted.
     * Hashing must be consistent with key and value equality so that equal
     * entries have equal hash codes.
     *
     * @returns a promise that resolves to the hash code value for this entry
     */
    hashCode(): Promise<bigint>;
}

/**
 * A map entry (key-value pair) supporting synchronous operations.
 *
 * An entry may be independent of a map or belong to a map's entry-set view.
 * An entry obtained by iterating that view is connected to the backing map
 * only for the duration of iteration. Its behaviour outside that iteration,
 * or after the map is modified other than through this entry's supported
 * `setValue` operation, is undefined. Values exclude `null` and `undefined`,
 * consistently with the backing map.
 *
 * @template K the type of the key
 * @template V the type of the value, excluding `null` and `undefined`
 */
export interface SynchronousMapEntry<K, V> {

    /** Runtime marker identifying this interface as a synchronous map entry. */
    readonly [SynchronousMapEntrySymbol]: unique symbol;

    /**
     * Returns the key corresponding to this entry.
     *
     * @returns the key corresponding to this entry
     */
    getKey(): K;

    /**
     * Returns the value corresponding to this entry.
     *
     * The behaviour of this call is undefined if the mapping has been removed
     * from the backing map.
     *
     * @returns the value corresponding to this entry
     */
    getValue(): V;

    /**
     * Replaces the value corresponding to this entry (optional operation).
     *
     * For a connected entry, this operation writes through to the backing map.
     * Its behaviour is undefined if the mapping has already been removed.
     *
     * @param value the non-absent value to be stored in this entry
     * @returns the previous value corresponding to this entry
     */
    setValue(value: V): V;

    /**
     * Compares the specified entry with this entry for equality.
     *
     * Two entries are equal if their keys are equal and their values are equal,
     * irrespective of implementation or backing map. Equal entries must have
     * equal hash codes.
     *
     * @param other the entry to be compared for equality with this entry
     * @returns `true` if the entries represent the same mapping
     */
    equals(other: SynchronousMapEntry<unknown, unknown>): boolean;

    /**
     * Returns the hash code value for this entry.
     *
     * The hash code is the bitwise exclusive OR of the key's hash code and the
     * value's hash code, using `0n` for a `null` or `undefined` key if permitted.
     * Hashing must be consistent with key and value equality so that equal
     * entries have equal hash codes.
     *
     * @returns the hash code value for this entry
     */
    hashCode(): bigint;
}

/**
 * An asynchronous map whose collection views share a defined iteration order.
 *
 * Mappings follow insertion order. Replacing a value preserves its position;
 * removing and reinserting the key places it last. Key, value and entry views,
 * and `forEach`, follow the same mapping order. Equality and hashing remain
 * independent of order. This root variant is the insertion-ordered counterpart
 * of `AsynchronousUnorderedMap`.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface AsynchronousOrderedMap<K, V> extends AsynchronousMapContract<K, V> {
    /** Runtime marker identifying this interface as an asynchronous ordered map. */
    readonly [AsynchronousOrderedMapSymbol]: unique symbol;

    /** Indicates that iteration follows this map's documented order. */
    readonly ordered: true;
}

/**
 * An asynchronous map without a guaranteed collection-view iteration order.
 *
 * Iteration follows hash buckets derived from {@link useHash}; bucket collisions
 * and bucket order are implementation details, so no observable order is
 * promised. `ordered` being `false` expresses that absence of a public order
 * guarantee. Equality, hashing and mapping operations retain their inherited
 * contracts.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface AsynchronousUnorderedMap<K, V> extends AsynchronousMapContract<K, V> {
    /** Runtime marker identifying this interface as an asynchronous unordered map. */
    readonly [AsynchronousUnorderedMapSymbol]: unique symbol;

    /** Indicates that no iteration order is guaranteed. */
    readonly ordered: false;
}

/**
 * A synchronous map whose collection views share a defined iteration order.
 *
 * Mappings follow insertion order. Replacing a value preserves its position;
 * removing and reinserting the key places it last. Key, value and entry views,
 * and `forEach`, follow the same mapping order. Equality and hashing remain
 * independent of order. This root variant is the insertion-ordered counterpart
 * of `SynchronousUnorderedMap`.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface SynchronousOrderedMap<K, V> extends SynchronousMapContract<K, V> {
    /** Runtime marker identifying this interface as a synchronous ordered map. */
    readonly [SynchronousOrderedMapSymbol]: unique symbol;

    /** Indicates that iteration follows this map's documented order. */
    readonly ordered: true;
}

/**
 * A synchronous map without a guaranteed collection-view iteration order.
 *
 * Iteration follows hash buckets derived from {@link useHash}; bucket collisions
 * and bucket order are implementation details, so no observable order is
 * promised. `ordered` being `false` expresses that absence of a public order
 * guarantee. Equality, hashing and mapping operations retain their inherited
 * contracts.
 *
 * @template K the type of keys maintained by this map
 * @template V the type of mapped values, excluding `null` and `undefined`
 */
export interface SynchronousUnorderedMap<K, V> extends SynchronousMapContract<K, V> {
    /** Runtime marker identifying this interface as a synchronous unordered map. */
    readonly [SynchronousUnorderedMapSymbol]: unique symbol;

    /** Indicates that no iteration order is guaranteed. */
    readonly ordered: false;
}

/** Configuration shared by the public map constructors. */
export interface MapOptions<K> {
    /** Positive LRU capacity; defaults to 1024n. */
    capacity?: bigint;
    /**
     * Total key order used by navigable skip maps. Ordered root maps keep their
     * insertion order; unordered root maps iterate hash buckets. Skip maps
     * require the comparator to be consistent with SameValueZero key equality.
     */
    comparator?: Comparator<K>;
}

/** @internal Initial key-value pairs accepted by asynchronous map constructors. */
export type MapSource<K, V> = Iterable<readonly [K, V]> | AsyncIterable<readonly [K, V]>;
type Family = "base" | "lru" | "skip";
type Pair<K, V> = [K, V];
type RuntimeMapEntry<K, V> = SynchronousMapEntry<K, V> | AsynchronousMapEntry<K, V>;
type Operation = (...args: never[]) => unknown;
type Bound<K> = { key: K; inclusive: boolean };
/**
 * The key window a view is restricted to.
 *
 * `lower` and `upper` are optional bounds and each is either inclusive or
 * exclusive, so an open-ended range leaves one side undefined. `descending`
 * reverses the presentation order without changing which keys are in scope.
 *
 * @template K the key type
 */
interface View<K> { lower?: Bound<K>; upper?: Bound<K>; descending: boolean }
/**
 * The storage a map instance keeps between operations.
 *
 * `data` holds the entries in iteration order, `recent` records recency for the
 * LRU family, and the two bucket maps index keys by hash so the unordered family
 * can find them without a scan. `capacity` bounds the LRU and SKIP families,
 * `comparator` orders the ordered family, and `readiness`/`queue` serialise
 * asynchronous work so a read issued after a write observes it. `generation`
 * lets an in-flight asynchronous source notice that the map was cleared or
 * replaced under it.
 *
 * @template K the key type
 * @template V the value type
 */
interface State<K, V> {
    data: Map<K, V>;
    recent: Map<K, true>;
    buckets: Map<bigint, K[]>;
    bucketIndex: Map<K, bigint>;
    capacity: bigint;
    comparator: Comparator<K>;
    readiness: Promise<void>;
    queue: Promise<unknown>;
    generation: number;
}
/**
 * The minimal handle an asynchronous source keeps on a map instance.
 *
 * `readiness` is awaited before the source's values are published, and `pairs`
 * reads the current contents at that moment, so a source attached to a map does
 * not observe a half-applied write.
 */
interface RuntimeMap { readiness: Promise<void>; pairs: () => Pair<unknown, unknown>[] }
const runtimeMaps = new WeakMap<object, RuntimeMap>();
const runtimeEntries = new WeakMap<object, () => Pair<unknown, unknown>>();
/** Set brands that identify a set operand, including specialised families. */
const setSymbols: readonly symbol[] = [
    AsynchronousOrderedSetSymbol, AsynchronousUnorderedSetSymbol, AsynchronousLRUSetSymbol, AsynchronousSkipSetSymbol,
    SynchronousOrderedSetSymbol, SynchronousUnorderedSetSymbol, SynchronousLRUSetSymbol, SynchronousSkipSetSymbol,
];
const same = (left: unknown, right: unknown): boolean => left === right || (left !== left && right !== right);
const present = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;
const requireValue = <T>(value: T): T => {
    if (!present(value)) throw new TypeError("Map values must not be null or undefined.");
    return value;
};
const hash = (value: unknown): bigint => value == null ? 0n : useHash(value === 0 ? 0 : value);
const entryHash = (key: unknown, value: unknown): bigint => hash(key) ^ hash(value);
/** Bucket used when a key cannot be hashed synchronously, such as an async iterable. */
const fallbackBucket = 0n;
const bucketHash = (key: unknown): bigint => {
    const candidate = useHash(key);
    return typeof candidate === "bigint" ? candidate : fallbackBucket;
};
const capacityValue = (value: bigint): bigint => {
    if (typeof value !== "bigint" || value < 1n) throw new RangeError("Capacity must be a positive bigint.");
    return value;
};

/**
 * Natural order for homogeneous strings, numbers, bigints or booleans. NaN sorts
 * after other numbers. Objects, symbols, nullish keys and mixed types require a
 * caller-supplied comparator (skip maps always reject nullish keys).
 */
function defaultMapComparator<K>(left: K, right: K): number {
    const type = typeof left;
    if (type !== typeof right || !["string", "number", "bigint", "boolean"].includes(type)) {
        throw new TypeError("Supply a comparator for keys other than homogeneous JavaScript scalar values.");
    }
    if (same(left, right)) return 0;
    if (typeof left === "number" && Number.isNaN(left)) return 1;
    if (typeof right === "number" && Number.isNaN(right)) return -1;
    return left < right ? -1 : 1;
}

function entryPair(value: unknown): Pair<unknown, unknown> | undefined {
    if ((typeof value !== "object" && typeof value !== "function") || value === null) return undefined;
    const stored = runtimeEntries.get(value);
    if (stored) return stored();
    // Unknown asynchronous entries must be awaited by the async operand adapter.
    // Calling their accessors here would leave rejected promises unobserved.
    if (!(brands.SynchronousMapEntrySymbol in value)) return undefined;
    const entry = value as Partial<SynchronousMapEntry<unknown, unknown>>;
    if (typeof entry.getKey !== "function" || typeof entry.getValue !== "function") return undefined;
    const key = entry.getKey();
    const mapped = entry.getValue();
    if (key instanceof Promise || mapped instanceof Promise) return undefined;
    return [key, mapped];
}

/** Creates an independent entry, a read-only snapshot, or a backed entry. */
function createMapEntry<K, V>(asynchronous: boolean, key: K, value: V,
    access?: { get: () => V; set?: (value: V) => V }, readonly = false): unknown {
    requireValue(value);
    let stored = value;
    const read = (): V => access ? access.get() : stored;
    const operations = {
        getKey: () => key,
        getValue: read,
        setValue: (replacement: V): V => {
            requireValue(replacement);
            if (readonly || (access && !access.set)) throw new TypeError("This entry is a read-only snapshot.");
            if (access?.set) return access.set(replacement);
            const previous = stored;
            stored = replacement;
            return previous;
        },
        equals: (other: RuntimeMapEntry<unknown, unknown>): boolean | Promise<boolean> => {
            const pair = entryPair(other);
            if (pair) return same(key, pair[0]) && same(read(), pair[1]);
            if (!asynchronous || !other || typeof other.getKey !== "function" || typeof other.getValue !== "function") return false;
            return Promise.all([other.getKey(), other.getValue()]).then(([otherKey, otherValue]) => same(key, otherKey) && same(read(), otherValue));
        },
        hashCode: () => entryHash(key, read()),
    };
    const result: Record<PropertyKey, unknown> = {};
    const brand = asynchronous ? brands.AsynchronousMapEntrySymbol : brands.SynchronousMapEntrySymbol;
    Object.defineProperty(result, brand, { value: brand });
    for (const [name, operation] of Object.entries(operations)) {
        result[name] = asynchronous
            ? (...args: never[]) => Promise.resolve().then(() => (operation as Operation)(...args))
            : operation;
    }
    runtimeEntries.set(result, () => [key, read()]);
    return result;
}

/**
 * @internal Creates a branded map and its backed collection views.
 * Asynchronous operations wait for initialisation and run in invocation order;
 * synchronous clear cancels earlier queued mutations and unread source mappings.
 */
export function createMap<K, V>(config: {
    /** Whether operations join the asynchronous invocation queue. */
    asynchronous: boolean;
    /** Optional eviction or navigation behaviour layered over the map. */
    family?: Family;
    /** Whether iteration follows insertion, recency or comparator order. */
    ordered?: boolean;
    /** Initial mappings; synchronous constructors reject async-only sources. */
    source?: MapSource<K, V>;
    /** Capacity and key-comparator settings for specialised map families. */
    options?: MapOptions<K>;
}): unknown {
    const family = config.family ?? "base";
    const ordered = config.ordered === true;
    const initialComparator = config.options?.comparator ?? defaultMapComparator<K>;
    const comparator: Comparator<K> = (left, right) => {
        if (family === "skip" && (!present(left) || !present(right))) throw new TypeError("Skip-map keys must not be null or undefined.");
        const result = initialComparator(left, right);
        if (typeof result !== "number" || !Number.isFinite(result) || ((result === 0) !== same(left, right))) {
            throw new TypeError("Comparator must define a finite total order consistent with SameValueZero equality.");
        }
        return result;
    };
    const state: State<K, V> = {
        data: new Map(), recent: new Map(), buckets: new Map(), bucketIndex: new Map(),
        capacity: capacityValue(config.options?.capacity ?? 1024n), comparator,
        readiness: Promise.resolve(), queue: Promise.resolve(), generation: 0,
    };
    const bucketAdd = (key: K): void => {
        if (ordered) return;
        const bucket = bucketHash(key);
        state.bucketIndex.set(key, bucket);
        const keys = state.buckets.get(bucket);
        if (keys) keys.push(key);
        else state.buckets.set(bucket, [key]);
    };
    const bucketRemove = (key: K): void => {
        if (ordered) return;
        const bucket = state.bucketIndex.get(key);
        if (bucket === undefined) return;
        const keys = state.buckets.get(bucket);
        if (keys) {
            const index = keys.indexOf(key);
            if (index >= 0) keys.splice(index, 1);
            if (keys.length === 0) state.buckets.delete(bucket);
        }
        state.bucketIndex.delete(key);
    };
    const bucketKeys = (): K[] => {
        const keys: K[] = [];
        for (const bucket of state.buckets.values()) keys.push(...bucket);
        return keys;
    };
    let writeAllowed: () => boolean = () => true;
    const evict = (): void => {
        while (BigInt(state.data.size) > state.capacity) {
            const key = state.recent.keys().next().value as K;
            state.data.delete(key);
            state.recent.delete(key);
            bucketRemove(key);
        }
    };
    const access = (key: K): void => {
        if (writeAllowed() && family === "lru" && state.data.has(key)) {
            state.recent.delete(key);
            state.recent.set(key, true);
        }
    };
    const validateKey = (key: K): void => {
        if (family === "skip") {
            comparator(key, key);
            for (const existing of state.data.keys()) comparator(key, existing);
        }
    };
    const insert = (key: K, value: V, record = true): V | undefined => {
        requireValue(value);
        validateKey(key);
        const previous = state.data.get(key);
        if (!writeAllowed()) return previous;
        const added = !state.data.has(key);
        state.data.set(key, value);
        if (added) bucketAdd(key);
        if (record) access(key);
        if (family === "lru") evict();
        return previous;
    };
    if (config.source) {
        const source = config.source;
        if (Symbol.asyncIterator in Object(source)) {
            if (!config.asynchronous) throw new TypeError("Synchronous maps require an Iterable source.");
            const generation = state.generation;
            state.readiness = (async () => {
                for await (const [key, value] of source) {
                    if (state.generation !== generation) break;
                    insert(key, value);
                }
            })();
            // Observe initialisation failures even when the caller never invokes a method.
            void state.readiness.catch(() => undefined);
        } else {
            for (const [key, value] of source as Iterable<readonly [K, V]>) insert(key, value);
        }
    }
    state.queue = state.readiness;

    const build = (view: View<K>): unknown => {
        const order: Comparator<K> = view.descending ? (left, right) => comparator(right, left) : comparator;
        const inRange = (key: K): boolean => {
            if (view.lower) {
                const comparison = comparator(key, view.lower.key);
                if (comparison < 0 || (comparison === 0 && !view.lower.inclusive)) return false;
            }
            if (view.upper) {
                const comparison = comparator(key, view.upper.key);
                if (comparison > 0 || (comparison === 0 && !view.upper.inclusive)) return false;
            }
            return true;
        };
        const visible = (key: unknown): key is K => {
            if (family === "skip") validateKey(key as K);
            return state.data.has(key as K) && inRange(key as K);
        };
        const checkInsert = (key: K): void => {
            validateKey(key);
            if (!inRange(key)) throw new RangeError("Key is outside the map view's bounds.");
        };
        const removeKey = (key: unknown): V | undefined => {
            if (!visible(key)) return undefined;
            const old = state.data.get(key);
            if (writeAllowed()) {
                state.data.delete(key);
                state.recent.delete(key);
                bucketRemove(key);
            }
            return old;
        };
        const pairs = (sorted = false): Pair<K, V>[] => {
            const keys = family === "lru" && ordered ? state.recent.keys()
                : ordered ? state.data.keys() : bucketKeys();
            const result = Array.from(keys).filter(inRange).map(key => [key, state.data.get(key)!] as Pair<K, V>);
            if (family === "skip" && (sorted || ordered)) result.sort((left, right) => order(left[0], right[0]));
            return result;
        };
        const clear = (): void => {
            state.generation++;
            for (const [key] of pairs()) {
                state.data.delete(key);
                state.recent.delete(key);
                bucketRemove(key);
            }
        };
        const snapshot = (pair: Pair<K, V> | undefined): unknown => pair
            ? createMapEntry(config.asynchronous, pair[0], pair[1], undefined, true) : undefined;
        const backed = ([key, value]: Pair<K, V>): unknown => createMapEntry(config.asynchronous, key, value, {
            get: () => state.data.get(key)!,
            set: replacement => {
                const previous = state.data.get(key)!;
                requireValue(replacement);
                state.data.set(key, replacement);
                return previous;
            },
        });
        const keysView = (navigable = false, reverse = false): unknown => createCollection<K>({
            asynchronous: config.asynchronous, kind: "set", family: navigable ? "skip" : "base",
            ordered: navigable,
            comparator: reverse ? (left, right) => order(right, left) : order,
            getValues: () => {
                const values = pairs(navigable).map(([key]) => key);
                return reverse ? values.reverse() : values;
            },
            removeValue: key => present(removeKey(key)), clearValues: clear, readiness: state.readiness,
        });
        const valuesView = (): unknown => createCollection<V>({
            asynchronous: config.asynchronous, kind: "collection", getValues: () => pairs().map(([, value]) => value),
            removeValue: value => {
                const match = pairs().find(([, mapped]) => same(mapped, value));
                return match ? present(removeKey(match[0])) : false;
            }, clearValues: clear, readiness: state.readiness,
        });
        const entriesView = (): unknown => {
            const collection = createCollection<unknown>({
            asynchronous: config.asynchronous, kind: "set", ordered: false, getValues: () => pairs().map(backed),
            hashValue: entry => {
                const pair = entryPair(entry);
                return pair ? entryHash(pair[0], pair[1]) : 0n;
            },
            equalsValue: (left: unknown, right: unknown) => {
                const a = entryPair(left), b = entryPair(right);
                return !!a && !!b && same(a[0], b[0]) && same(a[1], b[1]);
            },
            removeValue: entry => {
                const pair = entryPair(entry);
                if (!pair || !visible(pair[0]) || !same(state.data.get(pair[0]), pair[1])) return false;
                removeKey(pair[0]);
                return true;
            }, clearValues: clear, readiness: state.readiness,
            }) as Record<PropertyKey, unknown>;
            if (!config.asynchronous) return collection;
            // Entry accessors are asynchronous even though collection iteration is
            // synchronous. Normalise unknown operands before equality/removal.
            const normalize = async (value: unknown): Promise<unknown> => {
                if ((typeof value !== "object" && typeof value !== "function") || value === null) return value;
                if (runtimeEntries.has(value)) return value;
                const entry = value as Partial<AsynchronousMapEntry<unknown, unknown>>;
                if (typeof entry.getKey !== "function" || typeof entry.getValue !== "function") return value;
                const [key, mapped] = await Promise.all([entry.getKey(), entry.getValue()]);
                return createMapEntry(true, key, mapped, undefined, true);
            };
            let viewQueue: Promise<unknown> = state.readiness;
            for (const name of ["contains", "remove", "containsAll", "equals", "removeAll", "retainAll", "intersection", "union", "complement"]) {
                const original = collection[name] as (value: unknown) => Promise<unknown>;
                collection[name] = (operand: unknown): Promise<unknown> => {
                    const generation = state.generation;
                    const pending = viewQueue.then(async () => {
                        const single = name === "contains" || name === "remove";
                        let normalized: unknown;
                        if (single) normalized = await normalize(operand);
                        else {
                            const source = operand as { toArray?: () => unknown[] | Promise<unknown[]>; [Symbol.iterator]?: () => Iterator<unknown> };
                            const values = source && typeof source.toArray === "function" ? await source.toArray()
                                : source && source[Symbol.iterator] ? Array.from(source as Iterable<unknown>) : undefined;
                            if (!values) throw new TypeError("Expected a collection or iterable.");
                            const entries = await Promise.all(values.map(normalize));
                            const isSet = (typeof operand === "object" && operand !== null) &&
                                setSymbols.some(symbol => symbol in operand);
                            normalized = createCollection({ asynchronous: true, kind: isSet ? "set" : "collection", ordered: false, source: entries,
                                equalsValue: (left, right) => {
                                    const a = entryPair(left), b = entryPair(right);
                                    return !!a && !!b && same(a[0], b[0]) && same(a[1], b[1]);
                                }, hashValue: entry => {
                                    const pair = entryPair(entry);
                                    return pair ? entryHash(pair[0], pair[1]) : 0n;
                                },
                            });
                        }
                        if (generation !== state.generation && (name === "remove" || name === "removeAll" || name === "retainAll")) return false;
                        return original(normalized);
                    });
                    viewQueue = pending.then(() => undefined, () => undefined);
                    return pending;
                };
            }
            return collection;
        };
        const get = (key: unknown): V | undefined => {
            if (!visible(key)) return undefined;
            access(key);
            return state.data.get(key);
        };
        const computed = (key: K, value: V | null | undefined): V | undefined => {
            if (!present(value)) { removeKey(key); return undefined; }
            checkInsert(key);
            insert(key, value);
            return value;
        };
        const endpoint = (key: K, inclusive: boolean): Bound<K> => {
            validateKey(key);
            for (const bound of [view.lower, view.upper]) {
                if (!bound) continue;
                const comparison = comparator(key, bound.key);
                if ((bound === view.lower && comparison < 0) || (bound === view.upper && comparison > 0) ||
                    (comparison === 0 && inclusive && !bound.inclusive)) throw new RangeError("Endpoint is outside the enclosing range.");
            }
            return { key, inclusive };
        };
        const range = (lower?: Bound<K>, upper?: Bound<K>): unknown => {
            const next = { ...view, lower: lower ?? view.lower, upper: upper ?? view.upper };
            if (next.lower && next.upper && comparator(next.lower.key, next.upper.key) > 0) throw new RangeError("Range endpoints are reversed.");
            return build(next);
        };
        const edge = (last = false): Pair<K, V> | undefined => {
            const all = pairs(true);
            return last ? all[all.length - 1] : all[0];
        };
        const near = (key: K, direction: "lower" | "floor" | "ceiling" | "higher"): Pair<K, V> | undefined => {
            validateKey(key);
            const all = pairs(true).filter(([candidate]) => {
                const comparison = order(candidate, key);
                return direction === "lower" ? comparison < 0 : direction === "floor" ? comparison <= 0
                    : direction === "ceiling" ? comparison >= 0 : comparison > 0;
            });
            return direction === "lower" || direction === "floor" ? all[all.length - 1] : all[0];
        };
        const recency = (last = false, remove = false): unknown => {
            const all = Array.from(state.recent.keys()).filter(inRange);
            const key = last ? all[all.length - 1] : all[0];
            if (all.length === 0) return undefined;
            const result = snapshot([key, state.data.get(key)!]);
            if (remove) removeKey(key);
            return result;
        };
        const raw = {
            clear,
            compute: (key: K, fn: (key: K, value: V | undefined) => V | null | undefined) => {
                checkInsert(key);
                return computed(key, fn(key, visible(key) ? state.data.get(key) : undefined));
            },
            computeIfAbsent: (key: K, fn: (key: K) => V | null | undefined) => {
                checkInsert(key);
                return visible(key) ? get(key) : computed(key, fn(key));
            },
            computeIfPresent: (key: K, fn: (key: K, value: V) => V | null | undefined) =>
                visible(key) ? computed(key, fn(key, state.data.get(key)!)) : undefined,
            containsKey: visible,
            containsValue: (value: unknown) => pairs().some(([, mapped]) => same(mapped, value)),
            entrySet: entriesView,
            equals: (other: SynchronousMapContract<unknown, unknown> | AsynchronousMapContract<unknown, unknown>): boolean | Promise<boolean> => {
                const compare = (otherPairs: Pair<unknown, unknown>[]) => {
                    const own = pairs();
                    return own.length === otherPairs.length && own.every(([key, value]) => otherPairs.some(([otherKey, otherValue]) => same(key, otherKey) && same(value, otherValue)));
                };
                if ((other as unknown) === result) return true;
                if (!other || typeof other.entrySet !== "function") return false;
                const runtime = runtimeMaps.get(other);
                if (runtime) return config.asynchronous ? runtime.readiness.then(() => compare(runtime.pairs())) : compare(runtime.pairs());
                if (config.asynchronous) return (async () => {
                    const entries = await other.entrySet();
                    const otherPairs: Pair<unknown, unknown>[] = [];
                    for (const entry of entries) otherPairs.push([await entry.getKey(), await entry.getValue()]);
                    return compare(otherPairs);
                })();
                const entries = (other as SynchronousMapContract<unknown, unknown>).entrySet();
                return compare(Array.from(entries, entry => [entry.getKey(), entry.getValue()]));
            },
            forEach: (fn: (key: K, value: V) => void): void => { for (const [key, value] of pairs()) fn(key, value); },
            get,
            getOrDefault: (key: unknown, fallback: V): V => get(key) ?? fallback,
            hashCode: (): bigint => pairs().reduce((sum, [key, value]) => sum + entryHash(key, value), 0n),
            isEmpty: (): boolean => pairs().length === 0,
            keySet: () => keysView(family === "skip" && ordered),
            merge: (key: K, value: V, fn: (old: V, value: V) => V | null | undefined) => {
                requireValue(value); checkInsert(key);
                return computed(key, visible(key) ? fn(state.data.get(key)!, value) : value);
            },
            put: (key: K, value: V) => { checkInsert(key); return insert(key, value); },
            putAll: (other: SynchronousMapContract<K, V> | AsynchronousMapContract<K, V>): void | Promise<void> => {
                const allowed = writeAllowed;
                const copy = (entries: Pair<K, V>[]) => { for (const [key, value] of entries) { checkInsert(key); if (allowed()) insert(key, value); } };
                const runtime = runtimeMaps.get(other);
                if (runtime) {
                    const apply = () => copy(runtime.pairs() as Pair<K, V>[]);
                    return config.asynchronous ? runtime.readiness.then(apply) : apply();
                }
                if (config.asynchronous) return (async () => {
                    for (const entry of await other.entrySet()) {
                        const key = await entry.getKey(), value = await entry.getValue();
                        checkInsert(key); if (allowed()) insert(key, value);
                    }
                })();
                copy(Array.from((other as SynchronousMapContract<K, V>).entrySet(), entry => [entry.getKey(), entry.getValue()]));
            },
            putIfAbsent: (key: K, value: V) => { requireValue(value); checkInsert(key); return visible(key) ? get(key) : insert(key, value); },
            remove: (...args: [unknown, unknown?]): V | boolean | undefined => {
                const [key, expected] = args;
                if (args.length === 1) return removeKey(key);
                if (!visible(key) || !same(state.data.get(key), expected)) return false;
                removeKey(key); return true;
            },
            replace: (...args: [K, V, V?]): V | boolean | undefined => {
                const [key, expected, replacement] = args;
                requireValue(args.length === 2 ? expected : replacement);
                if (!visible(key)) return args.length === 2 ? undefined : false;
                if (args.length === 3 && !same(state.data.get(key), expected)) return false;
                const old = insert(key, args.length === 2 ? expected : replacement!);
                return args.length === 2 ? old : true;
            },
            replaceAll: (fn: (key: K, value: V) => V): void => {
                for (const [key, value] of pairs()) insert(key, requireValue(fn(key, value)), false);
            },
            size: (): bigint => BigInt(pairs().length),
            values: valuesView,
            capacity: (): bigint => state.capacity,
            setCapacity: (capacity: bigint): void => { capacityValue(capacity); if (writeAllowed()) { state.capacity = capacity; evict(); } },
            touch: (key: unknown): boolean => { if (!visible(key)) return false; access(key); return true; },
            peekLeastRecent: () => recency(), peekMostRecent: () => recency(true), pollLeastRecent: () => recency(false, true),
            comparator: () => order,
            firstKey: () => edge()?.[0], lastKey: () => edge(true)?.[0],
            firstEntry: () => snapshot(edge()), lastEntry: () => snapshot(edge(true)),
            lowerKey: (key: K) => near(key, "lower")?.[0], lowerEntry: (key: K) => snapshot(near(key, "lower")),
            floorKey: (key: K) => near(key, "floor")?.[0], floorEntry: (key: K) => snapshot(near(key, "floor")),
            ceilingKey: (key: K) => near(key, "ceiling")?.[0], ceilingEntry: (key: K) => snapshot(near(key, "ceiling")),
            higherKey: (key: K) => near(key, "higher")?.[0], higherEntry: (key: K) => snapshot(near(key, "higher")),
            pollFirstEntry: () => { const pair = edge(); const entry = snapshot(pair); if (pair) removeKey(pair[0]); return entry; },
            pollLastEntry: () => { const pair = edge(true); const entry = snapshot(pair); if (pair) removeKey(pair[0]); return entry; },
            descendingMap: () => build({ ...view, descending: !view.descending }),
            navigableKeySet: () => keysView(true), descendingKeySet: () => keysView(true, true),
            subMap: (...args: [K, K] | [K, boolean, K, boolean]) => {
                const from = args[0], to = args.length === 2 ? args[1] : args[2];
                if (order(from, to) > 0) throw new RangeError("Range endpoints are reversed.");
                const low = endpoint(from, args.length === 2 ? true : args[1]);
                const high = endpoint(to, args.length === 2 ? false : args[3]);
                return view.descending ? range(high, low) : range(low, high);
            },
            headMap: (key: K, inclusive = false) => view.descending ? range(endpoint(key, inclusive)) : range(undefined, endpoint(key, inclusive)),
            tailMap: (key: K, inclusive = true) => view.descending ? range(undefined, endpoint(key, inclusive)) : range(endpoint(key, inclusive)),
        };
        const optional = new Set(["compute", "computeIfAbsent", "computeIfPresent", "get", "merge", "put", "putIfAbsent", "remove", "replace",
            "peekLeastRecent", "peekMostRecent", "pollLeastRecent", "firstKey", "lastKey", "firstEntry", "lastEntry", "lowerKey", "lowerEntry",
            "floorKey", "floorEntry", "ceilingKey", "ceilingEntry", "higherKey", "higherEntry", "pollFirstEntry", "pollLastEntry"]);
        const result: Record<PropertyKey, unknown> = {};
        const prefix = config.asynchronous ? "Asynchronous" : "Synchronous";
        const variantName = ordered ? "Ordered" : "Unordered";
        const brandNames = [`${prefix}${variantName}Map`];
        if (family !== "base") {
            const familyName = family === "lru" ? "LRU" : "Skip";
            brandNames.push(`${prefix}${familyName}Map`, `${prefix}${variantName}${familyName}Map`);
        }
        Object.defineProperty(result, "ordered", { value: ordered, enumerable: true });
        for (const name of brandNames) {
            const brand = (brands as Record<string, symbol>)[`${name}Symbol`];
            Object.defineProperty(result, brand, { value: brand });
        }
        const lruMethods = new Set(["capacity", "setCapacity", "touch", "peekLeastRecent", "peekMostRecent", "pollLeastRecent"]);
        const skipMethods = new Set(["comparator", "firstKey", "lastKey", "firstEntry", "lastEntry", "lowerKey", "lowerEntry", "floorKey", "floorEntry",
            "ceilingKey", "ceilingEntry", "higherKey", "higherEntry", "pollFirstEntry", "pollLastEntry", "descendingMap", "navigableKeySet", "descendingKeySet", "subMap", "headMap", "tailMap"]);
        for (const [name, operation] of Object.entries(raw)) {
            if ((lruMethods.has(name) && family !== "lru") || (skipMethods.has(name) && family !== "skip")) continue;
            if (name === "clear") { result[name] = clear; continue; }
            result[name] = (...args: never[]) => {
                const isOptional = optional.has(name) && !(name === "remove" && args.length === 2) && !(name === "replace" && args.length === 3);
                const submittedGeneration = state.generation;
                const invoke = () => {
                    const previousPermission = writeAllowed;
                    writeAllowed = () => submittedGeneration === state.generation;
                    let value: unknown;
                    try { value = (operation as Operation)(...args); }
                    finally { writeAllowed = previousPermission; }
                    if (!config.asynchronous) return isOptional ? Optional.ofNullable(value) : value;
                    return Promise.resolve(value).then(resolved => {
                        if (isOptional && !present(resolved) && name !== "put" && name !== "putIfAbsent") throw new TypeError("No mapping or navigation result is present.");
                        return resolved;
                    });
                };
                if (!config.asynchronous) return invoke();
                const pending = state.queue.then(() => state.readiness).then(invoke);
                state.queue = pending.then(() => undefined, () => undefined);
                return pending;
            };
        }
        runtimeMaps.set(result, { readiness: state.readiness, pairs: pairs as () => Pair<unknown, unknown>[] });
        return result;
    };
    return build({ descending: false });
}

/**
 * Constructor for SynchronousOrderedMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Mappings iterate in insertion order; replacing a value preserves its position.
 * Values must be non-null. Constructors return the container immediately.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface SynchronousOrderedMapConstructor {
    new <K, V>(): SynchronousOrderedMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): SynchronousOrderedMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): SynchronousOrderedMap<K, V>;
}

/** Creates a SynchronousOrderedMap with its complete inherited runtime contract. */
export const SynchronousOrderedMap: SynchronousOrderedMapConstructor = createMapConstructor("SynchronousOrderedMap", { asynchronous: false, family: "base", ordered: true }) as unknown as SynchronousOrderedMapConstructor;

/**
 * Constructor for AsynchronousOrderedMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Mappings iterate in insertion order; replacing a value preserves its position.
 * Values must be non-null. Constructors return the container immediately.
 * Async sources load in iteration order; promise operations wait for loading
 * and execute in invocation order. clear() is synchronous and cancels unread
 * source mappings and earlier queued writes. Iterable sources load eagerly.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface AsynchronousOrderedMapConstructor {
    new <K, V>(): AsynchronousOrderedMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): AsynchronousOrderedMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousOrderedMap<K, V>;
    new <K, V>(target: AsyncIterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousOrderedMap<K, V>;
    new <K, V>(target: MapSource<K, V>, options?: MapOptions<K>): AsynchronousOrderedMap<K, V>;
}

/** Creates an AsynchronousOrderedMap with its complete inherited runtime contract. */
export const AsynchronousOrderedMap: AsynchronousOrderedMapConstructor = createMapConstructor("AsynchronousOrderedMap", { asynchronous: true, family: "base", ordered: true }) as unknown as AsynchronousOrderedMapConstructor;

/**
 * Constructor for SynchronousUnorderedMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Values must be non-null. Constructors return the container immediately.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface SynchronousUnorderedMapConstructor {
    new <K, V>(): SynchronousUnorderedMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): SynchronousUnorderedMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): SynchronousUnorderedMap<K, V>;
}

/** Creates a SynchronousUnorderedMap with its complete inherited runtime contract. */
export const SynchronousUnorderedMap: SynchronousUnorderedMapConstructor = createMapConstructor("SynchronousUnorderedMap", { asynchronous: false, family: "base", ordered: false }) as unknown as SynchronousUnorderedMapConstructor;

/**
 * Constructor for AsynchronousUnorderedMap.
 *
 * Keys and values use SameValueZero equality (objects retain identity).
 * Values must be non-null. Constructors return the container immediately.
 * Async sources load in iteration order; promise operations wait for loading
 * and execute in invocation order. clear() is synchronous and cancels unread
 * source mappings and earlier queued writes. Iterable sources load eagerly.
 * @template K key type
 * @template V non-null mapped value type
 */
export interface AsynchronousUnorderedMapConstructor {
    new <K, V>(): AsynchronousUnorderedMap<K, V>;
    new <K, V>(target: undefined, options?: MapOptions<K>): AsynchronousUnorderedMap<K, V>;
    new <K, V>(target: Iterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousUnorderedMap<K, V>;
    new <K, V>(target: AsyncIterable<readonly [K, V]>, options?: MapOptions<K>): AsynchronousUnorderedMap<K, V>;
    new <K, V>(target: MapSource<K, V>, options?: MapOptions<K>): AsynchronousUnorderedMap<K, V>;
}

/** Creates an AsynchronousUnorderedMap with its complete inherited runtime contract. */
export const AsynchronousUnorderedMap: AsynchronousUnorderedMapConstructor = createMapConstructor("AsynchronousUnorderedMap", { asynchronous: true, family: "base", ordered: false }) as unknown as AsynchronousUnorderedMapConstructor;

/** Constructor for an independent mutable map entry with a non-null value. */
export interface SynchronousMapEntryConstructor {
    new <K, V>(key: K, value: V): SynchronousMapEntry<K, V>;
}

/** Creates an independent entry whose supported setValue replaces its stored value. */
export const SynchronousMapEntry: SynchronousMapEntryConstructor = function SynchronousMapEntry<K, V>(key: K, value: V): object {
    if (!new.target) throw new TypeError("SynchronousMapEntry requires new.");
    const result = createMapEntry(false, key, value) as object;
    return Object.setPrototypeOf(result, new.target.prototype);
} as unknown as SynchronousMapEntryConstructor;

/** Constructor for an independent mutable map entry with a non-null value. */
export interface AsynchronousMapEntryConstructor {
    new <K, V>(key: K, value: V): AsynchronousMapEntry<K, V>;
}

/** Creates an independent entry whose supported setValue replaces its stored value. */
export const AsynchronousMapEntry: AsynchronousMapEntryConstructor = function AsynchronousMapEntry<K, V>(key: K, value: V): object {
    if (!new.target) throw new TypeError("AsynchronousMapEntry requires new.");
    const result = createMapEntry(true, key, value) as object;
    return Object.setPrototypeOf(result, new.target.prototype);
} as unknown as AsynchronousMapEntryConstructor;

/** @internal Creates a map constructor that requires new and preserves subclass prototypes. */
export function createMapConstructor(name: string, config: { asynchronous: boolean; family?: Family; ordered?: boolean }) {
    const constructor = function <K, V>(source?: MapSource<K, V>, options?: MapOptions<K>): object {
        if (!new.target) throw new TypeError(`${name} requires new.`);
        const result = createMap({ ...config, source, options }) as object;
        return Object.setPrototypeOf(result, new.target.prototype);
    };
    Object.defineProperty(constructor, "name", { value: name });
    return constructor;
}
