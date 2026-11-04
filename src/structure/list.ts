import { createCollectionConstructor, type CollectionOptions } from "#semantic/structure/collection";
import { AsynchronousListSymbol, SynchronousListSymbol } from "#semantic/symbol";
import type { Optional } from "#semantic/optional";
import type { AsynchronousCollection, SynchronousCollection } from "#semantic/structure/collection";
import type { Comparator, Functional, Predicate } from "#semantic/utility";

/**
 * An ordered collection supporting asynchronous operations and access at both ends.
 *
 * Lists may contain duplicate elements. Positions are zero-based and represented
 * by `bigint` values. Iteration returns elements in their list order and remains
 * synchronous, as does `clear`.
 *
 * The inherited `remove(element)` operation removes the first matching element.
 * Positional removal is named `removeAt` to avoid ambiguity when `E` is `bigint`.
 * Empty end-access results are represented by `Optional`, not by an exception.
 * Implementations must document restrictions on elements they accept; an empty
 * `Optional` cannot distinguish absence from a stored `null` or `undefined`.
 *
 * @template E the type of elements in this list
 */
export interface AsynchronousList<E> extends AsynchronousCollection<E>{

    /** Runtime marker identifying this interface as an asynchronous list. */
    readonly [AsynchronousListSymbol]: unique symbol;

    /**
     * Appends the specified element to the end of this list.
     *
     * @param element the element to be appended to this list
     * @returns a promise that resolves to `true` if this list changed
     */
    add(element: E): Promise<boolean>;

    /**
     * Inserts the specified element at the specified position in this list.
     * Shifts that element, if any, and subsequent elements one position right.
     *
     * @param index the insertion position, between zero and the size, inclusive
     * @param element the element to be inserted
     * @returns a promise that resolves when the element has been inserted;
     *          rejects with `RangeError` if the index is out of range
     */
    add(index: bigint, element: E): Promise<void>;

    /**
     * Appends all of the elements in the specified collection to this list,
     * in the order in which they are returned by that collection's iterator.
     *
     * @param elements the collection containing elements to be appended
     * @returns a promise that resolves to `true` if this list changed
     */
    addAll(elements: AsynchronousCollection<E>): Promise<boolean>;

    /**
     * Inserts all of the elements in the specified collection into this list
     * at the specified position, preserving their iteration order.
     *
     * @param index the insertion position, between zero and the size, inclusive
     * @param elements the collection containing elements to be inserted
     * @returns a promise that resolves to `true` if this list changed;
     *          rejects with `RangeError` if the index is out of range
     */
    addAll(index: bigint, elements: AsynchronousCollection<E>): Promise<boolean>;

    /**
     * Returns the element at the specified position in this list.
     *
     * @param index the index of the element to be returned
     * @returns a promise that resolves to the element at the specified position;
     *          rejects with `RangeError` if `index < 0n` or `index >= size()`
     */
    get(index: bigint): Promise<E>;

    /**
     * Replaces the element at the specified position with the specified element.
     *
     * @param index the index of the element to be replaced
     * @param element the element to be stored at the specified position
     * @returns a promise that resolves to the element previously at that position;
     *          rejects with `RangeError` if `index < 0n` or `index >= size()`
     */
    set(index: bigint, element: E): Promise<E>;

    /**
     * Removes the element at the specified position in this list.
     * Shifts subsequent elements one position left.
     *
     * @param index the index of the element to be removed
     * @returns a promise that resolves to the element previously at that position;
     *          rejects with `RangeError` if `index < 0n` or `index >= size()`
     */
    removeAt(index: bigint): Promise<E>;

    /**
     * Removes all of the elements of this list that satisfy the given predicate.
     *
     * @param filter the synchronous predicate that returns `true` for elements
     *        to be removed
     * @returns a promise that resolves to `true` if any elements were removed
     */
    removeIf(filter: Predicate<E>): Promise<boolean>;

    /**
     * Retains only the elements in this list that are contained in the specified
     * collection, preserving their relative order.
     *
     * @param collection the collection containing elements to be retained
     * @returns a promise that resolves to `true` if this list changed
     */
    retainAll(collection: AsynchronousCollection<unknown>): Promise<boolean>;

    /**
     * Returns the index of the first occurrence of the specified element.
     *
     * @param target the element to be searched for
     * @returns a promise that resolves to the first matching index, or `-1n`
     *          if this list does not contain the element
     */
    indexOf(target: unknown): Promise<bigint>;

    /**
     * Returns the index of the last occurrence of the specified element.
     *
     * @param target the element to be searched for
     * @returns a promise that resolves to the last matching index, or `-1n`
     *          if this list does not contain the element
     */
    lastIndexOf(target: unknown): Promise<bigint>;

    /**
     * Replaces each element with the result of applying the given operator.
     *
     * @param operator the synchronous operator to be applied to each element
     * @returns a promise that resolves when all elements have been replaced
     */
    replaceAll(operator: Functional<E, E>): Promise<void>;

    /**
     * Sorts this list according to the order induced by the specified comparator.
     * The sort is stable: equal elements retain their relative order.
     *
     * @param comparator the synchronous comparator used to compare list elements
     * @returns a promise that resolves when this list has been sorted
     */
    sort(comparator: Comparator<E>): Promise<void>;

    /**
     * Returns a view of the portion of this list between the specified endpoints.
     * The view is backed by this list, so element replacements are reflected
     * in both directions. Its behaviour is unspecified if this list is
     * structurally modified other than through the view.
     *
     * @param fromIndex the low endpoint, inclusive
     * @param toIndex the high endpoint, exclusive
     * @returns a promise that resolves to a view of the specified range;
     *          rejects with `RangeError` if `fromIndex < 0n`, `toIndex > size()`
     *          or `fromIndex > toIndex`
     */
    subList(fromIndex: bigint, toIndex: bigint): Promise<AsynchronousList<E>>;

    /**
     * Inserts the specified element at the end of this list, returning a failure
     * result rather than throwing when a capacity restriction prevents insertion.
     *
     * @param element the element to be inserted
     * @returns a promise that resolves to `true` if the element was added,
     *          or `false` if capacity prevents insertion
     */
    offerBack(element: E): Promise<boolean>;

    /**
     * Inserts the specified element at the front of this list, returning a failure
     * result rather than throwing when a capacity restriction prevents insertion.
     *
     * @param element the element to be inserted
     * @returns a promise that resolves to `true` if the element was added,
     *          or `false` if capacity prevents insertion
     */
    offerFront(element: E): Promise<boolean>;

    /**
     * Retrieves, but does not remove, the last element of this list.
     *
     * @returns a promise that resolves to the last element in an `Optional`,
     *          or an empty `Optional` if this list is empty
     */
    peekBack(): Promise<Optional<E>>;

    /**
     * Retrieves, but does not remove, the first element of this list.
     *
     * @returns a promise that resolves to the first element in an `Optional`,
     *          or an empty `Optional` if this list is empty
     */
    peekFront(): Promise<Optional<E>>;

    /**
     * Retrieves and removes the last element of this list.
     *
     * @returns a promise that resolves to the removed element in an `Optional`,
     *          or an empty `Optional` if this list is empty
     */
    popBack(): Promise<Optional<E>>;

    /**
     * Retrieves and removes the first element of this list.
     *
     * @returns a promise that resolves to the removed element in an `Optional`,
     *          or an empty `Optional` if this list is empty
     */
    popFront(): Promise<Optional<E>>;

    /**
     * Inserts the specified element at the end of this list.
     *
     * @param element the element to be inserted
     * @returns a promise that resolves to `true` on successful insertion;
     *          rejects with `IllegalStateError` if capacity prevents insertion
     */
    pushBack(element: E): Promise<boolean>;

    /**
     * Inserts the specified element at the front of this list.
     *
     * @param element the element to be inserted
     * @returns a promise that resolves to `true` on successful insertion;
     *          rejects with `IllegalStateError` if capacity prevents insertion
     */
    pushFront(element: E): Promise<boolean>;

    /**
     * Compares the specified collection with this list for equality.
     * Lists are equal if they contain equal elements in the same order.
     *
     * @param other the collection to be compared for equality with this list
     * @returns a promise that resolves to `true` if the other collection is
     *          a list of the same size with equal corresponding elements
     */
    equals(other: AsynchronousCollection<unknown>): Promise<boolean>;

    /**
     * Returns the hash code value for this list.
     * Equal lists must have equal hash codes; element order is significant.
     *
     * @returns a promise that resolves to the hash code value for this list
     */
    hashCode(): Promise<bigint>;
}

/**
 * An ordered collection supporting synchronous operations and access at both ends.
 *
 * Lists may contain duplicate elements. Positions are zero-based and represented
 * by `bigint` values. Iteration returns elements in their list order.
 *
 * The inherited `remove(element)` operation removes the first matching element.
 * Positional removal is named `removeAt` to avoid ambiguity when `E` is `bigint`.
 * Empty end-access results are represented by `Optional`, not by an exception.
 * Implementations must document restrictions on elements they accept; an empty
 * `Optional` cannot distinguish absence from a stored `null` or `undefined`.
 *
 * @template E the type of elements in this list
 */
export interface SynchronousList<E> extends SynchronousCollection<E>{

    /** Runtime marker identifying this interface as a synchronous list. */
    readonly [SynchronousListSymbol]: unique symbol;

    /**
     * Appends the specified element to the end of this list.
     *
     * @param element the element to be appended to this list
     * @returns `true` if this list changed
     */
    add(element: E): boolean;

    /**
     * Inserts the specified element at the specified position in this list.
     * Shifts that element, if any, and subsequent elements one position right.
     *
     * @param index the insertion position, between zero and the size, inclusive
     * @param element the element to be inserted
     * @throws {RangeError} if the index is out of range
     */
    add(index: bigint, element: E): void;

    /**
     * Appends all of the elements in the specified collection to this list,
     * in the order in which they are returned by that collection's iterator.
     *
     * @param elements the collection containing elements to be appended
     * @returns `true` if this list changed
     */
    addAll(elements: SynchronousCollection<E>): boolean;

    /**
     * Inserts all of the elements in the specified collection into this list
     * at the specified position, preserving their iteration order.
     *
     * @param index the insertion position, between zero and the size, inclusive
     * @param elements the collection containing elements to be inserted
     * @returns `true` if this list changed
     * @throws {RangeError} if the index is out of range
     */
    addAll(index: bigint, elements: SynchronousCollection<E>): boolean;

    /**
     * Returns the element at the specified position in this list.
     *
     * @param index the index of the element to be returned
     * @returns the element at the specified position
     * @throws {RangeError} if `index < 0n` or `index >= size()`
     */
    get(index: bigint): E;

    /**
     * Replaces the element at the specified position with the specified element.
     *
     * @param index the index of the element to be replaced
     * @param element the element to be stored at the specified position
     * @returns the element previously at the specified position
     * @throws {RangeError} if `index < 0n` or `index >= size()`
     */
    set(index: bigint, element: E): E;

    /**
     * Removes the element at the specified position in this list.
     * Shifts subsequent elements one position left.
     *
     * @param index the index of the element to be removed
     * @returns the element previously at the specified position
     * @throws {RangeError} if `index < 0n` or `index >= size()`
     */
    removeAt(index: bigint): E;

    /**
     * Removes all of the elements of this list that satisfy the given predicate.
     *
     * @param filter the predicate that returns `true` for elements to be removed
     * @returns `true` if any elements were removed
     */
    removeIf(filter: Predicate<E>): boolean;

    /**
     * Retains only the elements in this list that are contained in the specified
     * collection, preserving their relative order.
     *
     * @param collection the collection containing elements to be retained
     * @returns `true` if this list changed
     */
    retainAll(collection: SynchronousCollection<unknown>): boolean;

    /**
     * Returns the index of the first occurrence of the specified element.
     *
     * @param target the element to be searched for
     * @returns the first matching index, or `-1n` if this list does not
     *          contain the element
     */
    indexOf(target: unknown): bigint;

    /**
     * Returns the index of the last occurrence of the specified element.
     *
     * @param target the element to be searched for
     * @returns the last matching index, or `-1n` if this list does not
     *          contain the element
     */
    lastIndexOf(target: unknown): bigint;

    /**
     * Replaces each element with the result of applying the given operator.
     *
     * @param operator the operator to be applied to each element
     */
    replaceAll(operator: Functional<E, E>): void;

    /**
     * Sorts this list according to the order induced by the specified comparator.
     * The sort is stable: equal elements retain their relative order.
     *
     * @param comparator the comparator used to compare list elements
     */
    sort(comparator: Comparator<E>): void;

    /**
     * Returns a view of the portion of this list between the specified endpoints.
     * The view is backed by this list, so element replacements are reflected
     * in both directions. Its behaviour is unspecified if this list is
     * structurally modified other than through the view.
     *
     * @param fromIndex the low endpoint, inclusive
     * @param toIndex the high endpoint, exclusive
     * @returns a view of the specified range within this list
     * @throws {RangeError} if `fromIndex < 0n`, `toIndex > size()`
     *         or `fromIndex > toIndex`
     */
    subList(fromIndex: bigint, toIndex: bigint): SynchronousList<E>;

    /**
     * Inserts the specified element at the end of this list, returning a failure
     * result rather than throwing when a capacity restriction prevents insertion.
     *
     * @param element the element to be inserted
     * @returns `true` if the element was added, or `false` if capacity
     *          prevents insertion
     */
    offerBack(element: E): boolean;

    /**
     * Inserts the specified element at the front of this list, returning a failure
     * result rather than throwing when a capacity restriction prevents insertion.
     *
     * @param element the element to be inserted
     * @returns `true` if the element was added, or `false` if capacity
     *          prevents insertion
     */
    offerFront(element: E): boolean;

    /**
     * Retrieves, but does not remove, the last element of this list.
     *
     * @returns the last element in an `Optional`, or an empty `Optional`
     *          if this list is empty
     */
    peekBack(): Optional<E>;

    /**
     * Retrieves, but does not remove, the first element of this list.
     *
     * @returns the first element in an `Optional`, or an empty `Optional`
     *          if this list is empty
     */
    peekFront(): Optional<E>;

    /**
     * Retrieves and removes the last element of this list.
     *
     * @returns the removed element in an `Optional`, or an empty `Optional`
     *          if this list is empty
     */
    popBack(): Optional<E>;

    /**
     * Retrieves and removes the first element of this list.
     *
     * @returns the removed element in an `Optional`, or an empty `Optional`
     *          if this list is empty
     */
    popFront(): Optional<E>;

    /**
     * Inserts the specified element at the end of this list.
     *
     * @param element the element to be inserted
     * @returns `true` on successful insertion
     * @throws {IllegalStateError} if capacity prevents insertion
     */
    pushBack(element: E): boolean;

    /**
     * Inserts the specified element at the front of this list.
     *
     * @param element the element to be inserted
     * @returns `true` on successful insertion
     * @throws {IllegalStateError} if capacity prevents insertion
     */
    pushFront(element: E): boolean;

    /**
     * Compares the specified collection with this list for equality.
     * Lists are equal if they contain equal elements in the same order.
     *
     * @param other the collection to be compared for equality with this list
     * @returns `true` if the other collection is a list of the same size
     *          with equal corresponding elements
     */
    equals(other: SynchronousCollection<unknown>): boolean;

    /**
     * Returns the hash code value for this list.
     * Equal lists must have equal hash codes; element order is significant.
     *
     * @returns the hash code value for this list
     */
    hashCode(): bigint;
}

/** Creates an asynchronous positional list. Null and undefined are rejected. */
export interface AsynchronousListConstructor {
    new <E = unknown>(): AsynchronousList<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): AsynchronousList<E>;
    new <E>(source: AsyncIterable<E>, options?: CollectionOptions<E>): AsynchronousList<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): AsynchronousList<E>;
}
/** Creates a synchronous positional list. Null and undefined are rejected. */
export interface SynchronousListConstructor {
    new <E = unknown>(): SynchronousList<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): SynchronousList<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): SynchronousList<E>;
}

/**
 * Creates a positional list that preserves duplicate elements and rejects nullish values.
 * Promise operations wait for source initialisation.
 */
export const AsynchronousList: AsynchronousListConstructor = createCollectionConstructor("AsynchronousList", true, "list", "base") as unknown as AsynchronousListConstructor;
/**
 * Creates a positional list that preserves duplicate elements and rejects nullish values.
 * Operations return their results directly.
 */
export const SynchronousList: SynchronousListConstructor = createCollectionConstructor("SynchronousList", false, "list", "base") as unknown as SynchronousListConstructor;
