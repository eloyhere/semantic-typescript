import { createCollectionConstructor, type CollectionOptions } from "#semantic/structure/collection";
import { useCompare } from "#semantic/hook";
import {
    AsynchronousOrderedSetSymbol, AsynchronousUnorderedSetSymbol,
    SynchronousOrderedSetSymbol, SynchronousUnorderedSetSymbol,
} from "#semantic/symbol";
import type { AsynchronousCollection, SynchronousCollection } from "#semantic/structure/collection";
import type { Predicate } from "#semantic/utility";

/**
 * Deterministic type rank used only when `useCompare` cannot compare values of
 * different runtime types. It keeps the default order total instead of throwing.
 */
const typeRank = (value: unknown): number => {
    switch (typeof value) {
        case "undefined": return 0;
        case "boolean": return 1;
        case "number": return 2;
        case "bigint": return 3;
        case "string": return 4;
        case "symbol": return 5;
        case "function": return 7;
        default: return value === null ? 6 : 8;
    }
};

/**
 * Default ordered-set comparator. It delegates to `useCompare` and falls back
 * to a deterministic type rank plus textual order when `useCompare` either
 * rejects mixed types or cannot order a value (notably `NaN`).
 *
 * @template E the element type
 * @param left the left operand
 * @param right the right operand
 * @returns a negative number, zero or a positive number
 */
/** @internal Default order shared by ordered set families. */
export const useDefaultOrder = <E>(left: E, right: E): number => {
    if (Object.is(left, right)) return 0;
    try {
        const result = useCompare(left, right);
        if (Number.isFinite(result)) return result;
    } catch (error) {
        if (!(error instanceof TypeError)) throw error;
    }
    const leftType = typeof left;
    const rightType = typeof right;
    if (leftType !== rightType) return typeRank(left) - typeRank(right);
    if (leftType === "number") {
        if (Number.isNaN(left)) return 1;
        if (Number.isNaN(right)) return -1;
        return (left as number) < (right as number) ? -1 : 1;
    }
    return String(left).localeCompare(String(right));
};

/**
 * @internal
 * Shared synchronous set contract implemented by the ordered and unordered set
 * roots. It carries no brand of its own; concrete variants add their
 * ordered/unordered marker. Element equality and iteration order are specified
 * by the concrete variant.
 *
 * A set contains no duplicate elements. Set algebra operations return a set and
 * never modify either operand. Iteration and `clear` remain synchronous.
 *
 * @template E the type of elements maintained by this set
 */
export interface SynchronousSetContract<E> extends SynchronousCollection<E> {

    /**
     * Adds the specified element to this set if it is not already present.
     * If this set already contains the element, it remains unchanged.
     *
     * @param element the element to be added to this set
     * @returns `true` if this set did not already contain the specified element
     */
    add(element: E): boolean;

    /**
     * Adds all of the elements in the specified collection to this set if they
     * are not already present.
     *
     * @param elements the collection containing elements to be added to this set
     * @returns `true` if this set changed
     */
    addAll(elements: SynchronousCollection<E>): boolean;

    /**
     * Removes the specified element from this set if it is present.
     *
     * @param element the element to be removed from this set, if present
     * @returns `true` if this set contained the specified element
     */
    remove(element: E): boolean;

    /**
     * Removes all of this set's elements that are contained in the specified
     * collection.
     *
     * @param elements the collection containing elements to be removed
     * @returns `true` if this set changed
     */
    removeAll(elements: SynchronousCollection<E>): boolean;

    /**
     * Removes all of the elements of this set that satisfy the given predicate.
     *
     * @param filter the predicate that returns `true` for elements to be removed
     * @returns `true` if any elements were removed
     */
    removeIf(filter: Predicate<E>): boolean;

    /**
     * Retains only the elements in this set that are contained in the specified
     * collection. Unlike `intersection`, this operation modifies this set.
     *
     * @param collection the collection containing elements to be retained
     * @returns `true` if this set changed
     */
    retainAll(collection: SynchronousCollection<unknown>): boolean;

    /**
     * Compares the specified collection with this set for equality.
     * Sets are equal if they have the same size and contain the same elements
     * according to this set's element equality contract.
     *
     * @param other the collection to be compared for equality with this set
     * @returns `true` if the other collection is a set containing exactly
     *          the same elements
     */
    equals(other: SynchronousCollection<unknown>): boolean;

    /**
     * Returns the hash code value for this set.
     * The hash code is the sum of the hash codes of its elements, with `null`
     * and `undefined` contributing zero. Equal sets must have equal hash codes
     * when their element equality and hashing agree.
     *
     * @returns the hash code value for this set
     */
    hashCode(): bigint;

    /**
     * Returns the intersection of this set and the specified collection.
     * Neither operand is modified by this operation.
     *
     * @param other the collection with which the intersection is to be calculated
     * @returns a set containing the elements present in both operands
     */
    intersection(other: SynchronousCollection<E>): SynchronousSetContract<E>;

    /**
     * Returns the union of this set and the specified collection.
     * Neither operand is modified by this operation.
     *
     * @param other the collection with which the union is to be calculated
     * @returns a set containing the distinct elements present in either operand
     */
    union(other: SynchronousCollection<E>): SynchronousSetContract<E>;

    /**
     * Returns the complement of this set relative to the specified collection.
     * Neither operand is modified by this operation.
     *
     * @param relative the collection relative to which the complement is to be
     *        calculated
     * @returns a set containing the elements in `relative` that are not
     *          contained in this set
     */
    complement(relative: SynchronousCollection<E>): SynchronousSetContract<E>;
}

/**
 * @internal
 * Shared asynchronous set contract implemented by the ordered and unordered set
 * roots. It carries no brand of its own; concrete variants add their
 * ordered/unordered marker. Element equality and iteration order are specified
 * by the concrete variant.
 *
 * A set contains no duplicate elements. Set algebra operations return a set and
 * never modify either operand. Materialising operations return promises, while
 * iteration and `clear` remain synchronous.
 *
 * @template E the type of elements maintained by this set
 */
export interface AsynchronousSetContract<E> extends AsynchronousCollection<E> {

    /**
     * Adds the specified element to this set if it is not already present.
     * If this set already contains the element, it remains unchanged.
     *
     * @param element the element to be added to this set
     * @returns a promise that resolves to `true` if this set did not already
     *          contain the specified element
     */
    add(element: E): Promise<boolean>;

    /**
     * Adds all of the elements in the specified collection to this set if they
     * are not already present.
     *
     * @param elements the collection containing elements to be added to this set
     * @returns a promise that resolves to `true` if this set changed
     */
    addAll(elements: AsynchronousCollection<E>): Promise<boolean>;

    /**
     * Removes the specified element from this set if it is present.
     *
     * @param element the element to be removed from this set, if present
     * @returns a promise that resolves to `true` if this set contained
     *          the specified element
     */
    remove(element: E): Promise<boolean>;

    /**
     * Removes all of this set's elements that are contained in the specified
     * collection.
     *
     * @param elements the collection containing elements to be removed
     * @returns a promise that resolves to `true` if this set changed
     */
    removeAll(elements: AsynchronousCollection<E>): Promise<boolean>;

    /**
     * Removes all of the elements of this set that satisfy the given predicate.
     *
     * @param filter the synchronous predicate that returns `true` for elements
     *        to be removed
     * @returns a promise that resolves to `true` if any elements were removed
     */
    removeIf(filter: Predicate<E>): Promise<boolean>;

    /**
     * Retains only the elements in this set that are contained in the specified
     * collection. Unlike `intersection`, this operation modifies this set.
     *
     * @param collection the collection containing elements to be retained
     * @returns a promise that resolves to `true` if this set changed
     */
    retainAll(collection: AsynchronousCollection<unknown>): Promise<boolean>;

    /**
     * Compares the specified collection with this set for equality.
     * Sets are equal if they have the same size and contain the same elements
     * according to this set's element equality contract.
     *
     * @param other the collection to be compared for equality with this set
     * @returns a promise that resolves to `true` if the other collection is
     *          a set containing exactly the same elements
     */
    equals(other: AsynchronousCollection<unknown>): Promise<boolean>;

    /**
     * Returns the hash code value for this set.
     * The hash code is the sum of the hash codes of its elements, with `null`
     * and `undefined` contributing zero. Equal sets must have equal hash codes
     * when their element equality and hashing agree.
     *
     * @returns a promise that resolves to the hash code value for this set
     */
    hashCode(): Promise<bigint>;

    /**
     * Returns the intersection of this set and the specified collection.
     * Neither operand is modified by this operation.
     *
     * @param other the collection with which the intersection is to be calculated
     * @returns a promise that resolves to a set containing the elements
     *          present in both operands
     */
    intersection(other: AsynchronousCollection<E>): Promise<AsynchronousSetContract<E>>;

    /**
     * Returns the union of this set and the specified collection.
     * Neither operand is modified by this operation.
     *
     * @param other the collection with which the union is to be calculated
     * @returns a promise that resolves to a set containing the distinct elements
     *          present in either operand
     */
    union(other: AsynchronousCollection<E>): Promise<AsynchronousSetContract<E>>;

    /**
     * Returns the complement of this set relative to the specified collection.
     * Neither operand is modified by this operation.
     *
     * @param relative the collection relative to which the complement is to be
     *        calculated
     * @returns a promise that resolves to a set containing the elements in
     *          `relative` that are not contained in this set
     */
    complement(relative: AsynchronousCollection<E>): Promise<AsynchronousSetContract<E>>;
}

/**
 * An ordered set supporting synchronous operations.
 *
 * Two elements are equal when the comparator returns zero. The set stores one
 * representative of each comparator-equivalence class and iterates in
 * comparator-ascending order. When no comparator is supplied, `useCompare`
 * provides the primary order, with a deterministic fallback for mixed types and
 * otherwise incomparable values. Supplying a comparator makes membership,
 * removal, set algebra and hashing use comparator equality, so the comparator
 * should also preserve hash-code agreement between elements it considers equal.
 *
 * @template E the type of elements maintained by this set
 */
export interface SynchronousOrderedSet<E> extends SynchronousSetContract<E> {

    /** Runtime marker identifying this interface as a synchronous ordered set. */
    readonly [SynchronousOrderedSetSymbol]: unique symbol;

    /**
     * Returns the intersection, preserving comparator order and equality.
     *
     * @param other the collection with which the intersection is to be calculated
     * @returns an ordered set containing the elements present in both operands
     */
    intersection(other: SynchronousCollection<E>): SynchronousOrderedSet<E>;

    /**
     * Returns the union, preserving comparator order and equality.
     *
     * @param other the collection with which the union is to be calculated
     * @returns an ordered set containing the distinct elements present in either operand
     */
    union(other: SynchronousCollection<E>): SynchronousOrderedSet<E>;

    /**
     * Returns the relative complement, preserving comparator order and equality.
     *
     * @param relative the collection relative to which the complement is to be
     *        calculated
     * @returns an ordered set containing the elements in `relative` that are not
     *          contained in this set
     */
    complement(relative: SynchronousCollection<E>): SynchronousOrderedSet<E>;
}

/**
 * An unordered set supporting synchronous operations.
 *
 * Elements are unique under SameValueZero: object identity is preserved and
 * `NaN` equals itself. Elements are partitioned into hash buckets with
 * `useHash`, so iteration follows bucket order; bucket collisions and bucket
 * order are implementation details and no iteration order is guaranteed.
 *
 * @template E the type of elements maintained by this set
 */
export interface SynchronousUnorderedSet<E> extends SynchronousSetContract<E> {

    /** Runtime marker identifying this interface as a synchronous unordered set. */
    readonly [SynchronousUnorderedSetSymbol]: unique symbol;

    /**
     * Returns the intersection under SameValueZero equality.
     *
     * @param other the collection with which the intersection is to be calculated
     * @returns an unordered set containing the elements present in both operands
     */
    intersection(other: SynchronousCollection<E>): SynchronousUnorderedSet<E>;

    /**
     * Returns the union under SameValueZero equality.
     *
     * @param other the collection with which the union is to be calculated
     * @returns an unordered set containing the distinct elements present in either operand
     */
    union(other: SynchronousCollection<E>): SynchronousUnorderedSet<E>;

    /**
     * Returns the relative complement under SameValueZero equality.
     *
     * @param relative the collection relative to which the complement is to be
     *        calculated
     * @returns an unordered set containing the elements in `relative` that are
     *          not contained in this set
     */
    complement(relative: SynchronousCollection<E>): SynchronousUnorderedSet<E>;
}

/**
 * An ordered set supporting asynchronous operations.
 *
 * Two elements are equal when the comparator returns zero. The set stores one
 * representative of each comparator-equivalence class and iterates in
 * comparator-ascending order. When no comparator is supplied, `useCompare`
 * provides the primary order, with a deterministic fallback for mixed types and
 * otherwise incomparable values. Supplying a comparator makes membership,
 * removal, set algebra and hashing use comparator equality, so the comparator
 * should also preserve hash-code agreement between elements it considers equal.
 *
 * Promise operations wait for source initialisation. Iteration remains
 * synchronous.
 *
 * @template E the type of elements maintained by this set
 */
export interface AsynchronousOrderedSet<E> extends AsynchronousSetContract<E> {

    /** Runtime marker identifying this interface as an asynchronous ordered set. */
    readonly [AsynchronousOrderedSetSymbol]: unique symbol;

    /**
     * Returns the intersection, preserving comparator order and equality.
     *
     * @param other the collection with which the intersection is to be calculated
     * @returns a promise that resolves to an ordered set containing the elements
     *          present in both operands
     */
    intersection(other: AsynchronousCollection<E>): Promise<AsynchronousOrderedSet<E>>;

    /**
     * Returns the union, preserving comparator order and equality.
     *
     * @param other the collection with which the union is to be calculated
     * @returns a promise that resolves to an ordered set containing the distinct
     *          elements present in either operand
     */
    union(other: AsynchronousCollection<E>): Promise<AsynchronousOrderedSet<E>>;

    /**
     * Returns the relative complement, preserving comparator order and equality.
     *
     * @param relative the collection relative to which the complement is to be
     *        calculated
     * @returns a promise that resolves to an ordered set containing the elements
     *          in `relative` that are not contained in this set
     */
    complement(relative: AsynchronousCollection<E>): Promise<AsynchronousOrderedSet<E>>;
}

/**
 * An unordered set supporting asynchronous operations.
 *
 * Elements are unique under SameValueZero: object identity is preserved and
 * `NaN` equals itself. Elements are partitioned into hash buckets with
 * `useHash`, so iteration follows bucket order; bucket collisions and bucket
 * order are implementation details and no iteration order is guaranteed.
 *
 * Promise operations wait for source initialisation. Iteration remains
 * synchronous.
 *
 * @template E the type of elements maintained by this set
 */
export interface AsynchronousUnorderedSet<E> extends AsynchronousSetContract<E> {

    /** Runtime marker identifying this interface as an asynchronous unordered set. */
    readonly [AsynchronousUnorderedSetSymbol]: unique symbol;

    /**
     * Returns the intersection under SameValueZero equality.
     *
     * @param other the collection with which the intersection is to be calculated
     * @returns a promise that resolves to an unordered set containing the
     *          elements present in both operands
     */
    intersection(other: AsynchronousCollection<E>): Promise<AsynchronousUnorderedSet<E>>;

    /**
     * Returns the union under SameValueZero equality.
     *
     * @param other the collection with which the union is to be calculated
     * @returns a promise that resolves to an unordered set containing the
     *          distinct elements present in either operand
     */
    union(other: AsynchronousCollection<E>): Promise<AsynchronousUnorderedSet<E>>;

    /**
     * Returns the relative complement under SameValueZero equality.
     *
     * @param relative the collection relative to which the complement is to be
     *        calculated
     * @returns a promise that resolves to an unordered set containing the
     *          elements in `relative` that are not contained in this set
     */
    complement(relative: AsynchronousCollection<E>): Promise<AsynchronousUnorderedSet<E>>;
}

/** Creates a synchronous ordered set; the default comparator is `useCompare` with a deterministic fallback. */
export interface SynchronousOrderedSetConstructor {
    new <E = unknown>(): SynchronousOrderedSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): SynchronousOrderedSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): SynchronousOrderedSet<E>;
}

/** Creates a synchronous set with SameValueZero equality and hash-bucket iteration. */
export interface SynchronousUnorderedSetConstructor {
    new <E = unknown>(): SynchronousUnorderedSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): SynchronousUnorderedSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): SynchronousUnorderedSet<E>;
}

/** Creates an asynchronous ordered set; the default comparator is `useCompare` with a deterministic fallback. */
export interface AsynchronousOrderedSetConstructor {
    new <E = unknown>(): AsynchronousOrderedSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): AsynchronousOrderedSet<E>;
    new <E>(source: AsyncIterable<E>, options?: CollectionOptions<E>): AsynchronousOrderedSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): AsynchronousOrderedSet<E>;
}

/** Creates an asynchronous set with SameValueZero equality and hash-bucket iteration. */
export interface AsynchronousUnorderedSetConstructor {
    new <E = unknown>(): AsynchronousUnorderedSet<E>;
    new <E>(source: Iterable<E>, options?: CollectionOptions<E>): AsynchronousUnorderedSet<E>;
    new <E>(source: AsyncIterable<E>, options?: CollectionOptions<E>): AsynchronousUnorderedSet<E>;
    new <E = unknown>(source: undefined, options: CollectionOptions<E>): AsynchronousUnorderedSet<E>;
}

/**
 * Creates a set whose elements are unique under the configured comparator and
 * whose iteration follows comparator-ascending order. Promise operations wait
 * for source initialisation.
 */
export const AsynchronousOrderedSet: AsynchronousOrderedSetConstructor = createCollectionConstructor("AsynchronousOrderedSet", true, "set", "base", { ordered: true, comparator: useDefaultOrder }) as unknown as AsynchronousOrderedSetConstructor;
/**
 * Creates a set whose elements are unique under SameValueZero equality and whose
 * iteration follows implementation-defined hash-bucket order. Promise operations
 * wait for source initialisation.
 */
export const AsynchronousUnorderedSet: AsynchronousUnorderedSetConstructor = createCollectionConstructor("AsynchronousUnorderedSet", true, "set", "base", { ordered: false }) as unknown as AsynchronousUnorderedSetConstructor;
/**
 * Creates a set whose elements are unique under the configured comparator and
 * whose iteration follows comparator-ascending order. Operations return their
 * results directly.
 */
export const SynchronousOrderedSet: SynchronousOrderedSetConstructor = createCollectionConstructor("SynchronousOrderedSet", false, "set", "base", { ordered: true, comparator: useDefaultOrder }) as unknown as SynchronousOrderedSetConstructor;
/**
 * Creates a set whose elements are unique under SameValueZero equality and whose
 * iteration follows implementation-defined hash-bucket order. Operations return
 * their results directly.
 */
export const SynchronousUnorderedSet: SynchronousUnorderedSetConstructor = createCollectionConstructor("SynchronousUnorderedSet", false, "set", "base", { ordered: false }) as unknown as SynchronousUnorderedSetConstructor;
