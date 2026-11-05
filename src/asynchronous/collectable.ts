/**
 * The asynchronous collectable class family: buffered, async-iterable element
 * sources that expose promise-returning terminal operations over a
 * callback-based generator.
 *
 * This module is the single home of the asynchronous collectable API.
 * `#semantic/asynchronous/semantic` re-exports every class defined here, so the
 * public surface and the historical import paths are unchanged. The signal,
 * distribution, statistics and window modules extend the classes here and
 * import the same collector factories, so a change to the ordered buffer or to
 * a terminal operation is visible from all of them.
 *
 * The module deliberately holds only the base classes. Signal-specific
 * subclasses such as `AsynchronousSignalCollectable` live in their own modules,
 * which import the base class from here; nothing here imports them back, so a
 * subclass's `extends` heritage is always evaluated after this module's body has
 * run.
 *
 * The historical `semantic()` bridge, which constructed an
 * `AsynchronousSemantic` from `source()`, is deliberately absent: creating that
 * instance would introduce a runtime dependency on
 * `#semantic/asynchronous/semantic` and therefore a module cycle, so only the
 * type is imported. Callers build the pipeline from `source()` directly;
 * unlike the synchronous family there is no `pipe()` helper to replace it.
 *
 * Ordering contract of the family:
 *
 * - {@link AsynchronousCollectable} makes no ordering promise: it only defines
 *   the callback-based traversal and the promise-returning terminal operations
 *   built on it.
 * - {@link AsynchronousOrderedCollectable} starts buffering at construction and
 *   exposes elements in comparator order, or in normalised encounter-index
 *   order when no comparator is supplied.
 * - {@link AsynchronousUnorderedCollectable} buffers by encounter index and
 *   exposes elements in map insertion order, retaining duplicate-index entries
 *   under surrogate keys.
 *
 * Complexity: the concrete subclasses buffer eagerly in O(n); every terminal
 * operation awaits the same `ready` promise, so it is O(n) to drain the buffer
 * plus its own documented cost.
 *
 * @module
 */

import {
    useAsynchronousAnyMatch,
    useAsynchronousAllMatch,
    useAsynchronousCollect,
    useAsynchronousCount,
    useAsynchronousError,
    useAsynchronousFindAny,
    useAsynchronousFindAt,
    useAsynchronousFindFirst,
    useAsynchronousFindLast,
    useAsynchronousFindMaximum,
    useAsynchronousFindMinimum,
    useAsynchronousForEach,
    useAsynchronousGroup,
    useAsynchronousGroupBy,
    useAsynchronousJoin,
    useAsynchronousLog,
    useAsynchronousNoneMatch,
    useAsynchronousPartition,
    useAsynchronousPartitionBy,
    useAsynchronousReduce,
    useAsynchronousToArray,
    useAsynchronousToMap,
    useAsynchronousToSet,
    useAsynchronousWrite,
    useAsynchronousFindNegativeAt,
    useAsynchronousToIndexedArray,
    useAsynchronousToOrderedSet,
    useAsynchronousToUnorderedSet,
    useAsynchronousToOrderedMap,
    useAsynchronousToUnorderedMap,
    useAsynchronousToList,
    useAsynchronousToRing,
    useAsynchronousToLRUSet,
    useAsynchronousToLRUMap,
    useAsynchronousToSkipSet,
    useAsynchronousToSkipMap,
    useAsynchronousToBinarySearchTree,
    useAsynchronousToRootedForest
} from "#semantic/asynchronous/collectors";

import {
    isFunction,
    isNumber,
    isBigInt,
    isObject,
    isString,
    isAsynchronousCollector
} from "#semantic/guard";
import { useCompare } from "#semantic/hook";
import {
    AsynchronousOrderedCollectableSymbol,
    AsynchronousCollectableSymbol,
    AsynchronousUnorderedCollectableSymbol
} from "#semantic/symbol";
import {
    invalidate,
    validate,
    type BiConsumer,
    type BiFunctional,
    type BiPredicate,
    type Comparator,
    type Consumer,
    type Functional,
    type Indexed,
    type Predicate,
    type Supplier,
    type AsynchronousGenerator,
    type TriFunctional,
    type TriPredicate
} from "#semantic/utility";
import type { AsynchronousCollector } from "#semantic/asynchronous/collector";
import type { AsynchronousRing } from "#semantic/structure/ring";
import type { AsynchronousRootedForest } from "#semantic/structure/forest/rootedForest";
import type { AsynchronousList } from "#semantic/structure/list";
import type { AsynchronousUnorderedLRUMap, AsynchronousUnorderedLRUSet } from "#semantic/structure/lru";
import type { AsynchronousOrderedMap, AsynchronousUnorderedMap } from "#semantic/structure/map";
import type { AsynchronousOrderedSet, AsynchronousUnorderedSet } from "#semantic/structure/set";
import type { AsynchronousSkipMap, AsynchronousSkipSet } from "#semantic/structure/skip";
import type { AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

/**
 * First surrogate key used when a buffered entry repeats an encounter index.
 *
 * The unordered collectable stores elements in a `Map` keyed by encounter
 * index so that later duplicate indices do not overwrite earlier elements.
 * Duplicates are relocated above `2 ** 96` to stay clear of ordinary indices
 * while remaining exact as a `bigint`.
 */
const SURROGATE_BASE: bigint = 1n << 96n;

/**
 * The abstract root of the asynchronous collectable family.
 *
 * A collectable wraps a callback-based generator in a buffered, replayable
 * view: `source()` hands the raw generator back for re-traversal,
 * `[Symbol.asyncIterator]` materialises the elements, and every other member is
 * a terminal operation that drains `source()` exactly once and resolves to its
 * result.
 *
 * Ordering semantics: this class itself promises nothing about order — the
 * traversal order is whatever the concrete `source()` yields. Subclasses are
 * responsible for establishing a buffer and for documenting whether iteration
 * follows encounter order, comparator order or index order.
 *
 * Complexity: individual terminal operations are O(n) unless documented
 * otherwise, because each one drains the source once; subclasses that buffer
 * pay O(n) memory for replayability and start that work at construction.
 *
 * @template E - The source element type.
 */
export abstract class AsynchronousCollectable<E> implements AsyncIterable<E> {
    protected readonly AsynchronousCollectable: symbol = AsynchronousCollectableSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "AsynchronousCollectable";
    /**
     * Installs the asynchronous collectable brand used by the runtime guards.
     *
     * The marker is stored under the historical `AsynchronousCollectable` key as
     * a non-enumerable, non-writable property, matching the original class so
     * `#semantic/guard` keeps recognising instances of this family. No source is
     * traversed here: the concrete subclass supplies it through `source()`.
     *
     * Complexity: O(1) — only a property descriptor is installed.
     */
    public constructor() {
        Object.defineProperty(this, "AsynchronousCollectable", {
            value: AsynchronousCollectableSymbol,
            enumerable: false,
            writable: false,
            configurable: false
        });
    }
    /**
     * Asynchronously iterates the elements in this collectable's order.
     *
     * The base implementation awaits `toArray()` and then yields the materialised
     * array, so the source is fully drained before the first element is produced
     * and the traversal can be repeated safely for a buffered subclass.
     *
     * Ordering: exactly the order produced by `toArray()`, which for a concrete
     * subclass is whatever its `source()` promises.
     * Complexity: O(n) time and O(n) extra memory for the materialised array.
     *
     * @returns An async generator over the collected elements.
     */
    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
            yield element;
        }
    }
    /**
     * Tests for a matching element and stops after a match.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A promise resolving to whether a match was found; false when empty.
     */
    public async anyMatch(predicate: Predicate<E>): Promise<boolean> {
        if (isFunction(predicate)) {
            try {
                return await useAsynchronousAnyMatch(predicate).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        throw new TypeError("Predicate must be a function.");
    }
    /**
     * Tests the source elements with an all-match collector.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A promise resolving to the boolean produced by the all-match strategy.
     */
    public async allMatch(predicate: Predicate<E>): Promise<boolean> {
        return useAsynchronousAllMatch(predicate).collect(this.source());
    }
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param collector - The collection strategy to apply.
     * @returns A promise resolving to the finished result for the selected overload.
     */
    public async collect<A, R>(collector: AsynchronousCollector<E, A, R>): Promise<R>;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns A promise resolving to the finished result for the selected overload.
     */
    public async collect<A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): Promise<R>;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns A promise resolving to the finished result for the selected overload.
     */
    public async collect<A, R>(identity: Supplier<A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): Promise<R>;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param interruptor - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns A promise resolving to the finished result for the selected overload.
     */
    public async collect<A, R>(identity: Supplier<A>, interruptor: Predicate<E>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): Promise<R>;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param interruptor - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns A promise resolving to the finished result for the selected overload.
     */
    public async collect<A, R>(identity: Supplier<A>, interruptor: BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): Promise<R>;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param interruptor - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns A promise resolving to the finished result for the selected overload.
     */
    public async collect<A, R>(identity: Supplier<A>, interruptor: TriPredicate<E, bigint, A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): Promise<R>;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param interruptor - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns A promise resolving to the finished result for the selected overload.
     */
    public async collect<A, R>(identity: Supplier<A>, interruptor: Predicate<E>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): Promise<R>;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param interruptor - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns A promise resolving to the finished result for the selected overload.
     */
    public async collect<A, R>(identity: Supplier<A>, interruptor: BiPredicate<E, bigint>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): Promise<R>;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param interruptor - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns A promise resolving to the finished result for the selected overload.
     */
    public async collect<A, R>(identity: Supplier<A>, interruptor: TriPredicate<E, bigint, A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): Promise<R>;
    /**
     * Drains the source into a single result using a collection strategy.
     *
     * Three shapes are accepted: a ready-made `AsynchronousCollector`, a
     * supplier/accumulator/finisher triple, or that triple preceded by an
     * interruption predicate. The strategy receives `source()`, so
     * short-circuiting is cooperative and happens through the interrupt
     * callback rather than by slicing the buffer.
     *
     * Ordering: contributions accumulate in the order `source()` emits, so an
     * ordered collectable accumulates in sorted order and an unordered one in
     * insertion order.
     * Complexity: O(n) for one traversal plus the accumulator's own per-element
     * cost; an interruption predicate can stop the traversal early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param argument1 - The collector, or the supplier of a fresh accumulator.
     * @param argument2 - The accumulator, or the interruption predicate.
     * @param argument3 - The accumulator, or the finisher.
     * @param argument4 - The finisher of the interruptible overload.
     * @returns A promise resolving to the finished result for the selected overload.
     * @throws {TypeError} If the arguments match no overload.
     */
    public async collect<A, R>(argument1: Supplier<A> | AsynchronousCollector<E, A, R>, argument2?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Predicate<E> | BiPredicate<E, bigint> | TriPredicate<E, bigint, A>, argument3?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Functional<A, R>, argument4?: Functional<A, R>): Promise<R> {
        try {
            if (isAsynchronousCollector(argument1)) {
                let collector: AsynchronousCollector<E, A, R> = argument1 as AsynchronousCollector<E, A, R>;
                return await collector.collect(this.source());
            }
            if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3) && invalidate(argument4)) {
                let identity: Supplier<A> = argument1 as Supplier<A>;
                let accumulator: BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A> = argument2 as BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A>;
                let finisher: Functional<A, R> = argument3 as Functional<A, R>;
                return await useAsynchronousCollect(identity, accumulator, finisher).collect(this.source());
            }
            if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3) && isFunction(argument4)) {
                let identity: Supplier<A> = argument1 as Supplier<A>;
                let interrupt: Predicate<E> & BiPredicate<E, bigint> & TriPredicate<E, bigint, A> = argument2 as Predicate<E> & BiPredicate<E, bigint> & TriPredicate<E, bigint, A>;
                let accumulator: BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A> = argument3 as BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A>;
                let finisher: Functional<A, R> = argument4 as Functional<A, R>;
                return await useAsynchronousCollect(identity, interrupt, accumulator, finisher).collect(this.source());
            }
        }
        catch (error) {
            throw error;
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Counts the elements in the source.
     *
     * The base implementation drains `source()` with the count collector instead
     * of trusting a length, so it works for any subclass that only exposes a
     * generator.
     *
     * Ordering: irrelevant to the result, but the whole source is visited.
     * Complexity: O(n) time and O(1) extra memory; buffered subclasses override
     * this with a settled-buffer length lookup.
     *
     * @returns A promise resolving to the element count as a bigint.
     */
    public async count(): Promise<bigint> {
        return await useAsynchronousCount<E>().collect(this.source());
    }
    /**
     * Formats the elements and writes the resulting text with console.error.
     *
     * @returns A promise that resolves after the output completes.
     */
    public async error(): Promise<void>;
    /**
     * Formats the elements and writes the resulting text with console.error.
     *
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns A promise that resolves after the output completes.
     */
    public async error(accumulator: BiFunctional<string, E, string>): Promise<void>;
    /**
     * Formats the elements and writes the resulting text with console.error.
     *
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns A promise that resolves after the output completes.
     */
    public async error(accumulator: TriFunctional<string, E, bigint, string>): Promise<void>;
    /**
     * Formats the elements and writes the resulting text with console.error.
     *
     * @param prefix - The opening text.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param suffix - The closing text.
     * @returns A promise that resolves after the output completes.
     */
    public async error(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): Promise<void>;
    /**
     * Formats the elements and writes the resulting text with console.error.
     *
     * @param prefix - The opening text.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param suffix - The closing text.
     * @returns A promise that resolves after the output completes.
     */
    public async error(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): Promise<void>;
    /**
     * Formats the elements and writes the resulting text with console.error.
     *
     * @param argument1 - The first argument selected by the overload.
     * @param argument2 - The optional second argument selected by the overload.
     * @param argument3 - The optional third argument selected by the overload.
     * @returns A promise that resolves after the output completes.
     */
    public async error(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): Promise<void> {
        if (invalidate(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                await useAsynchronousError<E>().collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                await useAsynchronousError<E>(accumulator).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
            try {
                let prefix: string = argument1;
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                let suffix: string = argument3;
                await useAsynchronousError<E>(prefix, accumulator, suffix).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else {
            throw new TypeError("Invalid arguments.");
        }
    }
    /**
     * Checks whether the source has no elements.
     *
     * This is a thin wrapper over `count()`, so the base implementation still
     * drains the source; buffered subclasses answer from their settled buffer.
     *
     * Ordering: irrelevant, but a base-class call visits every element.
     * Complexity: O(n) time for the base implementation, O(1) when a buffered
     * subclass overrides it.
     *
     * @returns A promise resolving to whether the element count is zero.
     */
    public async isEmpty(): Promise<boolean> {
        return await this.count() === 0n;
    }
    /**
     * Selects an element using this collectable implementation.
     *
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findAny(): Promise<E> {
        try {
            return await useAsynchronousFindAny<E>().collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Finds the element at a non-negative encounter position.
     *
     * @param index - The requested position; negative lookup methods wrap modulo the source length.
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findAt(index: number): Promise<E>;
    /**
     * Finds the element at a non-negative encounter position.
     *
     * @param index - The requested position; negative lookup methods wrap modulo the source length.
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findAt(index: bigint): Promise<E>;
    /**
     * Finds the element at a non-negative encounter position.
     *
     * @param index - The requested position; negative lookup methods wrap modulo the source length.
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findAt(index: number | bigint): Promise<E> {
        if (isBigInt(index)) {
            try {
                return await useAsynchronousFindAt<E>(index).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else if (isNumber(index)) {
            try {
                return await useAsynchronousFindAt<E>(index).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        throw new TypeError("Index must be a bigint.");
    }
    /**
     * Buffers elements and resolves a negative position modulo the source length.
     *
     * @param index - The requested position; negative lookup methods wrap modulo the source length.
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findNegativeAt(index: number): Promise<E>;
    /**
     * Buffers elements and resolves a negative position modulo the source length.
     *
     * @param index - The requested position; negative lookup methods wrap modulo the source length.
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findNegativeAt(index: bigint): Promise<E>;
    /**
     * Buffers elements and resolves a negative position modulo the source length.
     *
     * @param index - The requested position; negative lookup methods wrap modulo the source length.
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findNegativeAt(index: number | bigint): Promise<E> {
        if (isBigInt(index)) {
            try {
                return await useAsynchronousFindNegativeAt<E>(index).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else if (isNumber(index)) {
            try {
                return await useAsynchronousFindNegativeAt<E>(index).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        throw new TypeError("Index must be a bigint or a number.");
    }
    /**
     * Finds the first element available to the lookup strategy.
     *
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findFirst(): Promise<E> {
        try {
            return await useAsynchronousFindFirst<E>().collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Finds the last element available to the lookup strategy.
     *
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findLast(): Promise<E> {
        try {
            return await useAsynchronousFindLast<E>().collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Finds the greatest element according to the comparator.
     *
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findMaximum(): Promise<E>;
    /**
     * Finds the greatest element according to the comparator.
     *
     * @param comparator - The comparison function; defaults to the library comparator.
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findMaximum(comparator: Comparator<E>): Promise<E>;
    /**
     * Finds the greatest element according to the comparator.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findMaximum(argument1?: Comparator<E>): Promise<E> {
        try {
            let comparator: Comparator<E> = isFunction(argument1) ? argument1 : useCompare;
            return await useAsynchronousFindMaximum(comparator).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Finds the least element according to the comparator.
     *
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findMinimum(): Promise<E>;
    /**
     * Finds the least element according to the comparator.
     *
     * @param comparator - The comparison function; defaults to the library comparator.
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findMinimum(comparator: Comparator<E>): Promise<E>;
    /**
     * Finds the least element according to the comparator.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public async findMinimum(argument1?: Comparator<E>): Promise<E> {
        try {
            let comparator: Comparator<E> = isFunction(argument1) ? argument1 : useCompare;
            return await useAsynchronousFindMinimum(comparator).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Invokes the action for every encountered element.
     *
     * @param action - Receives each element and optional bigint index.
     * @returns A promise that resolves after traversal completes.
     */
    public async forEach(action: Consumer<E>): Promise<void>;
    /**
     * Invokes the action for every encountered element.
     *
     * @param action - Receives each element and optional bigint index.
     * @returns A promise that resolves after traversal completes.
     */
    public async forEach(action: BiConsumer<E, bigint>): Promise<void>;
    /**
     * Invokes an observer for every element encountered during traversal.
     *
     * The action receives the element and its `bigint` index, which for a
     * buffered subclass is the buffered index rather than the original encounter
     * index. The resolved value of the action is discarded.
     *
     * Ordering: the traversal order defined by `source()`, with each awaited
     * element observed before the next one is pulled.
     * Complexity: O(n) — every element is visited and no early exit is exposed.
     *
     * @param action - Receives each element and optional bigint index.
     * @returns A promise that resolves after traversal completes.
     */
    public async forEach(action: Consumer<E> | BiConsumer<E, bigint>): Promise<void> {
        if (isFunction(action)) {
            try {
                await useAsynchronousForEach(action).collect(this);
            }
            catch (error) {
                throw error;
            }
        }
        else {
            throw new TypeError("Action must be a function.");
        }
    }
    /**
     * Groups elements into arrays by classifier key.
     *
     * @template K - The extracted key type.
     * @param classifier - Calculates the grouping key or bigint bucket.
     * @returns A promise resolving to a map of keys to element arrays in encounter order.
     */
    public async group<K>(classifier: Functional<E, K>): Promise<Map<K, Array<E>>>;
    /**
     * Groups elements into arrays by classifier key.
     *
     * @template K - The extracted key type.
     * @param classifier - Calculates the grouping key or bigint bucket.
     * @returns A promise resolving to a map of keys to element arrays in encounter order.
     */
    public async group<K>(classifier: BiFunctional<E, bigint, K>): Promise<Map<K, Array<E>>>;
    /**
     * Groups elements into arrays by classifier key.
     *
     * @template K - The extracted key type.
     * @param classifier - Calculates the grouping key or bigint bucket.
     * @returns A promise resolving to a map of keys to element arrays in encounter order.
     */
    public async group<K>(classifier: Functional<E, K> | BiFunctional<E, bigint, K>): Promise<Map<K, Array<E>>> {
        if (isFunction(classifier)) {
            try {
                return await useAsynchronousGroup(classifier).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        throw new TypeError("Classifier must be a function.");
    }
    /**
     * Groups extracted values into arrays by extracted key.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A promise resolving to a map of keys to extracted value arrays.
     */
    public async groupBy<K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): Promise<Map<K, Array<V>>>;
    /**
     * Groups extracted values into arrays by extracted key.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A promise resolving to a map of keys to extracted value arrays.
     */
    public async groupBy<K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, K>): Promise<Map<K, Array<V>>>;
    /**
     * Groups extracted values into arrays by extracted key.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A promise resolving to a map of keys to extracted value arrays.
     */
    public async groupBy<K, V>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V>): Promise<Map<K, Array<V>>> {
        if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
            try {
                return await useAsynchronousGroupBy(keyExtractor, valueExtractor).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        throw new TypeError("Key and value extractors must be functions.");
    }
    /**
     * Formats elements using separators or an accumulator; the default uses square brackets and commas.
     *
     * @returns A promise resolving to the formatted text.
     */
    public async join(): Promise<string>;
    /**
     * Formats elements using separators or an accumulator; the default uses square brackets and commas.
     *
     * @param delimiter - The separator inserted between elements.
     * @returns A promise resolving to the formatted text.
     */
    public async join(delimiter: string): Promise<string>;
    /**
     * Formats elements using separators or an accumulator; the default uses square brackets and commas.
     *
     * @param prefix - The opening text.
     * @param delimiter - The separator inserted between elements.
     * @param suffix - The closing text.
     * @returns A promise resolving to the formatted text.
     */
    public async join(prefix: string, delimiter: string, suffix: string): Promise<string>;
    /**
     * Formats elements using separators or an accumulator; the default uses square brackets and commas.
     *
     * @param prefiex - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param suffix - The closing text.
     * @returns A promise resolving to the formatted text.
     */
    public async join(prefiex: string, accumulator: BiFunctional<string, E, string>, suffix: string): Promise<string>;
    /**
     * Formats elements using separators or an accumulator; the default uses square brackets and commas.
     *
     * @param prefiex - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param suffix - The closing text.
     * @returns A promise resolving to the formatted text.
     */
    public async join(prefiex: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): Promise<string>;
    /**
     * Formats elements using separators or an accumulator; the default uses square brackets and commas.
     *
     * @param argument1 - The first argument selected by the overload.
     * @param argument2 - The optional second argument selected by the overload.
     * @param argument3 - The optional third argument selected by the overload.
     * @returns A promise resolving to the formatted text.
     */
    public async join(argument1?: string, argument2?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): Promise<string> {
        if (invalidate(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                return await useAsynchronousJoin<E>().collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else if (isString(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let delimiter: string = argument1;
                return await useAsynchronousJoin<E>(delimiter).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
            try {
                let prefix: string = argument1;
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                let suffix: string = argument3;
                return await useAsynchronousJoin<E>(prefix, accumulator, suffix).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else if (isString(argument1) && isString(argument2) && isString(argument3)) {
            try {
                let prefix: string = argument1;
                let delimiter: string = argument2;
                let suffix: string = argument3;
                return await useAsynchronousJoin<E>(prefix, delimiter, suffix).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Formats the elements and writes the resulting text with console.log.
     *
     * @returns A promise that resolves after the output completes.
     */
    public async log(): Promise<void>;
    /**
     * Formats the elements and writes the resulting text with console.log.
     *
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns A promise that resolves after the output completes.
     */
    public async log(accumulator: BiFunctional<string, E, string>): Promise<void>;
    /**
     * Formats the elements and writes the resulting text with console.log.
     *
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns A promise that resolves after the output completes.
     */
    public async log(accumulator: TriFunctional<string, E, bigint, string>): Promise<void>;
    /**
     * Formats the elements and writes the resulting text with console.log.
     *
     * @param prefix - The opening text.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param suffix - The closing text.
     * @returns A promise that resolves after the output completes.
     */
    public async log(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): Promise<void>;
    /**
     * Formats the elements and writes the resulting text with console.log.
     *
     * @param prefix - The opening text.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param suffix - The closing text.
     * @returns A promise that resolves after the output completes.
     */
    public async log(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): Promise<void>;
    /**
     * Formats the elements and writes the resulting text with console.log.
     *
     * @param argument1 - The first argument selected by the overload.
     * @param argument2 - The optional second argument selected by the overload.
     * @param argument3 - The optional third argument selected by the overload.
     * @returns A promise that resolves after the output completes.
     */
    public async log(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): Promise<void> {
        if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                await useAsynchronousLog<E>(accumulator).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
            try {
                let prefix: string = argument1;
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                let suffix: string = argument3;
                await useAsynchronousLog<E>(prefix, accumulator, suffix).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else {
            try {
                useAsynchronousLog<E>().collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
    }
    /**
     * Tests that no element matches, stopping after a match.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A promise resolving to whether no match was found; true when empty.
     */
    public async nonMatch(predicate: Predicate<E>): Promise<boolean>;
    /**
     * Tests that no element matches, stopping after a match.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A promise resolving to whether no match was found; true when empty.
     */
    public async nonMatch(predicate: BiPredicate<E, bigint>): Promise<boolean>;
    /**
     * Tests that no element matches, stopping after a match.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A promise resolving to whether no match was found; true when empty.
     */
    public async nonMatch(predicate: Predicate<E> | BiPredicate<E, bigint>): Promise<boolean> {
        if (isFunction(predicate)) {
            try {
                return await useAsynchronousNoneMatch(predicate).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        throw new TypeError("Predicate must be a function.");
    }
    /**
     * Distributes elements by index modulo the count, using at least one bucket.
     *
     * @param count - The requested count.
     * @returns A promise resolving to the allocated bucket arrays; an empty source produces an empty array.
     */
    public async partition(count: bigint): Promise<Array<Array<E>>> {
        if (isBigInt(count)) {
            try {
                return await useAsynchronousPartition<E>(count).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        throw new TypeError("Count must be a BigInt.");
    }
    /**
     * Distributes elements into bigint-numbered buckets, mapping negative bucket numbers to zero.
     *
     * @param classifier - Calculates the grouping key or bigint bucket.
     * @returns A promise resolving to the bucket arrays, including empty intervening buckets.
     */
    public async partitionBy(classifier: Functional<E, bigint>): Promise<Array<Array<E>>>;
    /**
     * Distributes elements into bigint-numbered buckets, mapping negative bucket numbers to zero.
     *
     * @param classifier - Calculates the grouping key or bigint bucket.
     * @returns A promise resolving to the bucket arrays, including empty intervening buckets.
     */
    public async partitionBy(classifier: BiFunctional<E, bigint, bigint>): Promise<Array<Array<E>>>;
    /**
     * Distributes elements into bigint-numbered buckets, mapping negative bucket numbers to zero.
     *
     * @param classifier - Calculates the grouping key or bigint bucket.
     * @returns A promise resolving to the bucket arrays, including empty intervening buckets.
     */
    public async partitionBy(classifier: Functional<E, bigint> | BiFunctional<E, bigint, bigint>): Promise<Array<Array<E>>> {
        if (isFunction(classifier)) {
            try {
                let collector: AsynchronousCollector<E, Array<E[]>, Array<E[]>> = useAsynchronousPartitionBy(classifier);
                return await collector.collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        throw new TypeError("Classifier must be a function.");
    }
    /**
     * Reduces elements with an optional initial value and finisher.
     *
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns A promise resolving to the result for the selected reduction overload.
     */
    public async reduce(accumulator: BiFunctional<E, E, E>): Promise<E>;
    /**
     * Reduces elements with an optional initial value and finisher.
     *
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns A promise resolving to the result for the selected reduction overload.
     */
    public async reduce(accumulator: TriFunctional<E, E, bigint, E>): Promise<E>;
    /**
     * Reduces elements with an optional initial value and finisher.
     *
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns A promise resolving to the result for the selected reduction overload.
     */
    public async reduce(identity: E, accumulator: BiFunctional<E, E, E>): Promise<E>;
    /**
     * Reduces elements with an optional initial value and finisher.
     *
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns A promise resolving to the result for the selected reduction overload.
     */
    public async reduce(identity: E, accumulator: TriFunctional<E, E, bigint, E>): Promise<E>;
    /**
     * Reduces elements with an optional initial value and finisher.
     *
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns A promise resolving to the result for the selected reduction overload.
     */
    public async reduce<R>(identity: R, accumulator: BiFunctional<R, E, R>, finisher: Functional<R, R>): Promise<R>;
    /**
     * Reduces elements with an optional initial value and finisher.
     *
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns A promise resolving to the result for the selected reduction overload.
     */
    public async reduce<R>(identity: R, accumulator: TriFunctional<R, E, bigint, R>, finisher: Functional<R, R>): Promise<R>;
    /**
     * Reduces elements with an optional initial value and finisher.
     *
     * @template R - The mapped or finished result type.
     * @param argument1 - The first argument selected by the overload.
     * @param argument2 - The optional second argument selected by the overload.
     * @param argument3 - The optional third argument selected by the overload.
     * @returns A promise resolving to the result for the selected reduction overload.
     */
    public async reduce<R>(argument1?: R | E | BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E>, argument2?: BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E> | BiFunctional<R, E, R> | TriFunctional<R, E, bigint, R>, argument3?: Functional<R, R>): Promise<E | R> {
        if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let accumulator = argument1 as BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E>;
                return await useAsynchronousReduce(accumulator).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else if (validate(argument1) && isFunction(argument2) && invalidate(argument3)) {
            try {
                let identity: E = argument1 as E;
                let accumulator: BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E> = argument2 as BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E>;
                return await useAsynchronousReduce(identity, accumulator).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else if (validate(argument1) && isFunction(argument2) && isFunction(argument3)) {
            try {
                let identity: R = argument1 as R;
                let accumulator: BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R> = argument2 as BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R>;
                let finisher: Functional<R, R> = argument3 as Functional<R, R>;
                return await useAsynchronousReduce(identity, accumulator, finisher).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else {
            throw new TypeError("Invalid arguments.");
        }
    }
    /**
     * Exposes the callback-based generator that traverses this source.
     *
     * An implementation awaits each element into `accept` together with its
     * `bigint` index and consults `interrupt` after every emission; returning
     * `true` from the interrupt callback must end the traversal. Every call
     * starts from the beginning, so the generator is re-traversable.
     *
     * Ordering: defined by the implementation — this contract promises no order
     * beyond the sequence the generator actually emits.
     * Complexity: implementation-defined; buffered subclasses are O(n) per
     * traversal and exit early when the interrupt callback fires.
     *
     * @returns The generator accepting element and interruption callbacks.
     */
    public abstract source(): AsynchronousGenerator<E>;
    /**
     * Returns the callback-based generator that traverses this source.
     *
     * This is a transparent alias of {@link source} that names the same object
     * with the vocabulary pipeline code uses. Concrete subclasses customise
     * traversal by overriding `source()` only; this member must not be
     * overridden separately.
     *
     * Ordering: identical to `source()` — calling it starts no traversal and
     * imposes no order of its own.
     * Complexity: O(1); the stored generator is returned as is.
     *
     * @returns The generator accepting element and interruption callbacks.
     */
    public generator(): AsynchronousGenerator<E> {
        return this.source();
    }
    /**
     * Materialises the source into a new array in traversal order.
     *
     * The array is freshly allocated per call and is the basis of
     * `[Symbol.asyncIterator]`, so the ordering decided here is the ordering
     * observed by `for await...of`.
     *
     * Ordering: exactly the order in which `source()` emits elements.
     * Complexity: O(n) time and O(n) additional memory.
     *
     * @template R - The element type of the finished array; defaults to the source element type.
     * @returns A promise resolving to a new element array.
     */
    public async toArray<R extends E = E>(): Promise<Array<R>> {
        try {
            return useAsynchronousToArray<E>().collect(this.source()) as unknown as Array<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects extracted keys and values; later duplicate keys replace earlier values.
     *
     * @template K - The extracted key type.
     * @template V - The stored value type; defaults to the source element type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @returns A promise resolving to the resulting map.
     */
    public async toMap<K, V = E>(keyExtractor: Functional<E, K>): Promise<Map<K, V>>;
    /**
     * Collects extracted keys and values; later duplicate keys replace earlier values.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A promise resolving to the resulting map.
     */
    public async toMap<K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): Promise<Map<K, V>>;
    /**
     * Collects extracted keys and values; later duplicate keys replace earlier values.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A promise resolving to the resulting map.
     */
    public async toMap<K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): Promise<Map<K, V>>;
    /**
     * Collects extracted keys and values; later duplicate keys replace earlier values.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A promise resolving to the resulting map.
     */
    public async toMap<K, V = E>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): Promise<Map<K, V>> {
        try {
            return await useAsynchronousToMap<E, K, V>(keyExtractor, valueExtractor).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a Set using JavaScript value equality.
     *
     * @returns A promise resolving to the set of distinct elements.
     */
    public async toSet<R extends E = E>(): Promise<Set<R>> {
        try {
            return await useAsynchronousToSet<E>().collect(this.source()) as unknown as Set<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new asynchronous ordered set.
     *
     * Every buffered element is offered to the `AsynchronousOrderedSet`
     * constructor, so a duplicate the comparator considers equal collapses to the
     * first representative and the result is a mutable set owned by the caller.
     * Membership, removal, set algebra and hashing use the same comparator
     * equality as iteration, and collection queries settle through promises.
     *
     * Order semantics: iteration is comparator-ascending, not traversal order,
     * because the ordered set stores elements by the supplied comparator; the
     * ordered-set default order applies when none is supplied. Complexity:
     * draining the source is O(n), while the build locates each insertion in
     * O(log n) and splices a sorted node array in O(n), so it is O(n^2) worst
     * case.
     *
     * @template R - The element type of the finished set; defaults to the source element type.
     * @param comparator - Total element order; defaults to the ordered-set default order.
     * @returns A promise resolving to a new ordered set of the distinct elements.
     * @throws {TypeError} If the comparator returns a non-finite number or does not compare a value equal to itself.
     */
    public async toOrderedSet<R extends E = E>(comparator?: Comparator<E>): Promise<AsynchronousOrderedSet<R>> {
        try {
            return await useAsynchronousToOrderedSet<E>(comparator).collect(this.source()) as unknown as AsynchronousOrderedSet<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new asynchronous unordered set.
     *
     * Every buffered element is inserted into an `AsynchronousUnorderedSet`,
     * which keeps elements distinct under SameValueZero: object identity is
     * preserved and `NaN` equals itself. The result is a mutable set owned by the
     * caller whose equality is independent of any comparator.
     *
     * Order semantics: iteration follows hash buckets derived from `useHash`, so
     * no iteration order is guaranteed and the traversal order of this source is
     * not preserved. Complexity: O(n) expected, because membership is
     * hash-bucketed.
     *
     * @template R - The element type of the finished set; defaults to the source element type.
     * @returns A promise resolving to a new unordered set of the distinct elements.
     */
    public async toUnorderedSet<R extends E = E>(): Promise<AsynchronousUnorderedSet<R>> {
        try {
            return await useAsynchronousToUnorderedSet<E>().collect(this.source()) as unknown as AsynchronousUnorderedSet<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects extracted keys and values into a new insertion-ordered map.
     *
     * This form stores each source element as the mapping value, so a duplicate
     * key replaces the previously stored element.
     *
     * Order semantics: an `AsynchronousOrderedMap` iterates in insertion order,
     * where the first occurrence of a key fixes its position and a later duplicate
     * replaces the value in place. Complexity: O(n) expected, because each pair is
     * placed in a hash-indexed insertion-order map.
     *
     * @template K - The extracted key type.
     * @template V - The stored value type; defaults to the source element type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @returns A promise resolving to a new insertion-ordered map of elements.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public async toOrderedMap<K, V = E>(keyExtractor: Functional<E, K>): Promise<AsynchronousOrderedMap<K, V>>;
    /**
     * Collects extracted keys and values into a new insertion-ordered map.
     *
     * Element-only extractors reduce each element to a key and a value, and the
     * last value wins when keys repeat.
     *
     * Order semantics: iteration follows insertion order, so the first occurrence
     * of a key fixes its position while a replacement keeps that position.
     * Complexity: O(n) expected.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A promise resolving to a new insertion-ordered map of values.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public async toOrderedMap<K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): Promise<AsynchronousOrderedMap<K, V>>;
    /**
     * Collects extracted keys and values into a new insertion-ordered map.
     *
     * Both extractors receive the bigint encounter index, so position-dependent
     * keys and values stay consistent with each other.
     *
     * Order semantics: iteration follows insertion order; the encounter index that
     * produced a key does not affect its position after a replacement. Complexity:
     * O(n) expected.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and its bigint index.
     * @param valueExtractor - Extracts a value from each element and its bigint index.
     * @returns A promise resolving to a new insertion-ordered map of values.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public async toOrderedMap<K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): Promise<AsynchronousOrderedMap<K, V>>;
    /**
     * Collects extracted keys and values into a new insertion-ordered map.
     *
     * Every element contributes one pair; a later duplicate replaces the earlier
     * value and stored values must be non-null.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A promise resolving to a new insertion-ordered map of values.
     * @throws {TypeError} If a completed pair holds a nullish value.
     */
    public async toOrderedMap<K, V = E>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): Promise<AsynchronousOrderedMap<K, V>> {
        try {
            return await useAsynchronousToOrderedMap<E, K, V>(keyExtractor, valueExtractor).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects extracted keys and values into a new unordered map.
     *
     * This form stores each source element as the mapping value, so a duplicate
     * key replaces the previously stored element.
     *
     * Order semantics: an `AsynchronousUnorderedMap` iterates in hash-bucket
     * order, so no iteration order is guaranteed and neither insertion order nor
     * source order is observable. Complexity: O(n) expected.
     *
     * @template K - The extracted key type.
     * @template V - The stored value type; defaults to the source element type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @returns A promise resolving to a new unordered map of elements.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public async toUnorderedMap<K, V = E>(keyExtractor: Functional<E, K>): Promise<AsynchronousUnorderedMap<K, V>>;
    /**
     * Collects extracted keys and values into a new unordered map.
     *
     * Element-only extractors reduce each element to a key and a value, and the
     * last value wins when keys repeat.
     *
     * Order semantics: no iteration order is guaranteed, because the map presents
     * hash buckets and treats bucket order as an implementation detail.
     * Complexity: O(n) expected.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A promise resolving to a new unordered map of values.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public async toUnorderedMap<K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): Promise<AsynchronousUnorderedMap<K, V>>;
    /**
     * Collects extracted keys and values into a new unordered map.
     *
     * Both extractors receive the bigint encounter index, so position-dependent
     * keys and values stay consistent with each other.
     *
     * Order semantics: the encounter index does not determine iteration order,
     * which follows hash buckets and is not guaranteed. Complexity: O(n) expected.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and its bigint index.
     * @param valueExtractor - Extracts a value from each element and its bigint index.
     * @returns A promise resolving to a new unordered map of values.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public async toUnorderedMap<K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): Promise<AsynchronousUnorderedMap<K, V>>;
    /**
     * Collects extracted keys and values into a new unordered map.
     *
     * Every element contributes one pair; a later duplicate replaces the earlier
     * value and stored values must be non-null.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A promise resolving to a new unordered map of values.
     * @throws {TypeError} If a completed pair holds a nullish value.
     */
    public async toUnorderedMap<K, V = E>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): Promise<AsynchronousUnorderedMap<K, V>> {
        try {
            return await useAsynchronousToUnorderedMap<E, K, V>(keyExtractor, valueExtractor).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new asynchronous positional list.
     *
     * Elements are appended in traversal order, duplicates are retained, and the
     * result is a mutable `AsynchronousList` owned by the caller. Positional
     * queries settle through promises while iteration stays synchronous. Nullish
     * elements are rejected because a list position must hold a value.
     *
     * Order semantics: positions follow the traversal order of this source
     * exactly, because appending preserves encounter order. Complexity: O(n),
     * since appending at the end of the list is O(1) per element.
     *
     * @template R - The element type of the finished list; defaults to the source element type.
     * @returns A promise resolving to a new list containing every element in traversal order.
     * @throws {TypeError} If the source contains `null` or `undefined`.
     */
    public async toList<R extends E = E>(): Promise<AsynchronousList<R>> {
        try {
            return await useAsynchronousToList<E>().collect(this.source()) as unknown as AsynchronousList<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new asynchronous ring.
     *
     * Elements become the positions of an `AsynchronousRing`, a bounded
     * positional list whose head and tail nodes are joined so sampling wraps
     * around the ring. Sampling and positional queries settle through promises
     * while iteration stays synchronous.
     *
     * Order semantics: encounter order fixes ring positions, so position `i`
     * carries the `i`-th element modulo the size and a negative position walks the
     * ring backwards. `span` is the number of turns the ring occupies; the default
     * of one places elements on the n-th roots of unity, and a span that shares a
     * factor with the size collapses positions onto a shorter orbit. Complexity:
     * O(n), because each element is spliced into the ring once.
     *
     * @template R - The element type of the finished ring; defaults to the source element type.
     * @param span - Turns occupied by the ring, a positive finite number; defaults to one.
     * @returns A promise resolving to a new ring over the elements in traversal order.
     * @throws {RangeError} If the span is not positive.
     * @throws {TypeError} If the span is not a finite number or the source contains `null` or `undefined`.
     */
    public async toRing<R extends E = E>(span?: number): Promise<AsynchronousRing<R>> {
        try {
            return await useAsynchronousToRing<E>(span).collect(this.source()) as unknown as AsynchronousRing<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new bounded asynchronous LRU set.
     *
     * Elements are inserted in traversal order, and each insertion marks the
     * element most recently used; capacity pressure evicts the least recently used
     * elements, so only the last `capacity` distinct elements of the source
     * survive. The result is a mutable `AsynchronousUnorderedLRUSet`, the
     * unordered root of the LRU set family.
     *
     * Order semantics: eviction follows access order rather than element order —
     * re-encountering an element refreshes its recency — while iteration order is
     * unspecified because this is the unordered LRU variant. Complexity: O(n)
     * expected for insertion, with each eviction scanning for the least recently
     * used element, so a build that evicts repeatedly is O(n^2) worst case.
     *
     * @template R - The element type of the finished set; defaults to the source element type.
     * @param capacity - The positive maximum number of elements to retain.
     * @returns A promise resolving to a new bounded LRU set with at most `capacity` distinct elements.
     * @throws {RangeError} If the capacity is not a positive bigint.
     * @throws {TypeError} If the source contains `null` or `undefined`.
     */
    public async toLRUSet<R extends E = E>(capacity: bigint): Promise<AsynchronousUnorderedLRUSet<R>> {
        try {
            return await useAsynchronousToLRUSet<E>(capacity).collect(this.source()) as unknown as AsynchronousUnorderedLRUSet<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects extracted keys and values into a new bounded asynchronous LRU map.
     *
     * This form stores each source element as the mapping value, and the capacity
     * bounds the map. A duplicate key replaces the value and refreshes recency.
     *
     * Order semantics: eviction follows access order, so capacity pressure removes
     * the least recently used mapping, while iteration order is unspecified
     * because this is the unordered LRU variant. Complexity: O(n) expected, with
     * constant-time eviction of the least recently used key.
     *
     * @template K - The extracted key type.
     * @template V - The stored value type; defaults to the source element type.
     * @param capacity - The positive maximum number of mappings to retain.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @returns A promise resolving to a new bounded LRU map of elements.
     * @throws {RangeError} If the capacity is not a positive bigint.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public async toLRUMap<K, V = E>(capacity: bigint, keyExtractor: Functional<E, K>): Promise<AsynchronousUnorderedLRUMap<K, V>>;
    /**
     * Collects extracted keys and values into a new bounded asynchronous LRU map.
     *
     * Element-only extractors reduce each element to a key and a value, and the
     * last value wins when keys repeat.
     *
     * Order semantics: recency, not key order, decides which mapping is evicted,
     * and no iteration order is guaranteed. Complexity: O(n) expected.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param capacity - The positive maximum number of mappings to retain.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A promise resolving to a new bounded LRU map of values.
     * @throws {RangeError} If the capacity is not a positive bigint.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public async toLRUMap<K, V>(capacity: bigint, keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): Promise<AsynchronousUnorderedLRUMap<K, V>>;
    /**
     * Collects extracted keys and values into a new bounded asynchronous LRU map.
     *
     * Both extractors receive the bigint encounter index, so position-dependent
     * keys and values stay consistent with each other.
     *
     * Order semantics: the encounter index does not decide eviction or iteration
     * order; recency alone evicts and no iteration order is guaranteed.
     * Complexity: O(n) expected.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param capacity - The positive maximum number of mappings to retain.
     * @param keyExtractor - Extracts a key from each element and its bigint index.
     * @param valueExtractor - Extracts a value from each element and its bigint index.
     * @returns A promise resolving to a new bounded LRU map of values.
     * @throws {RangeError} If the capacity is not a positive bigint.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public async toLRUMap<K, V>(capacity: bigint, keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): Promise<AsynchronousUnorderedLRUMap<K, V>>;
    /**
     * Collects extracted keys and values into a new bounded asynchronous LRU map.
     *
     * Every element contributes one pair; a later duplicate replaces the earlier
     * value and stored values must be non-null.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param capacity - The positive maximum number of mappings to retain.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A promise resolving to a new bounded LRU map of values.
     * @throws {RangeError} If the capacity is not a positive bigint.
     * @throws {TypeError} If a completed pair holds a nullish value.
     */
    public async toLRUMap<K, V = E>(capacity: bigint, keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): Promise<AsynchronousUnorderedLRUMap<K, V>> {
        try {
            return await useAsynchronousToLRUMap<E, K, V>(capacity, keyExtractor, valueExtractor).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new navigable asynchronous skip set.
     *
     * Elements are inserted into an `AsynchronousSkipSet`, which keeps them unique
     * under SameValueZero while navigating and iterating by the supplied total
     * order, so range views, `floor` and `ceiling` navigation and iteration agree
     * with the comparator. Nullish elements are rejected. Navigation results
     * settle through promises while iteration stays synchronous.
     *
     * Order semantics: iteration and navigation follow the comparator ascending,
     * and the comparator must compare equal exactly for SameValueZero-equal
     * elements. Complexity: draining the source is O(n); the runtime scans the
     * element array for duplicate detection, so a build is O(n^2) worst case and a
     * sorted snapshot read is O(n log n).
     *
     * @template R - The element type of the finished set; defaults to the source element type.
     * @param comparator - Total element order consistent with SameValueZero equality; defaults to the skip-set default order.
     * @returns A promise resolving to a new navigable skip set of the distinct elements.
     * @throws {TypeError} If the comparator disagrees with element equality or the source contains `null` or `undefined`.
     */
    public async toSkipSet<R extends E = E>(comparator?: Comparator<E>): Promise<AsynchronousSkipSet<R>> {
        try {
            return await useAsynchronousToSkipSet<E>(comparator).collect(this.source()) as unknown as AsynchronousSkipSet<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects extracted keys and values into a new navigable asynchronous skip map.
     *
     * This form stores each source element as the mapping value and uses the
     * skip-map default key order, which accepts homogeneous numbers, strings,
     * bigints and booleans.
     *
     * Order semantics: navigation, range views and iteration follow the key
     * comparator, so keys are presented comparator-ascending rather than in
     * encounter order. Complexity: O(n) expected, with comparator navigation over
     * sorted snapshots.
     *
     * @template K - The extracted key type.
     * @template V - The stored value type; defaults to the source element type.
     * @param keyExtractor - Computes the map key from the element.
     * @returns A promise resolving to a new navigable skip map of elements.
     * @throws {TypeError} If a key is nullish or the default order cannot compare it.
     */
    public async toSkipMap<K, V = E>(keyExtractor: Functional<E, K>): Promise<AsynchronousSkipMap<K, V>>;
    /**
     * Collects extracted keys and values into a new navigable asynchronous skip map.
     *
     * Element-only extractors reduce each element to a key and a value, and the
     * last value wins when keys repeat.
     *
     * Order semantics: keys are unique by comparator and presented
     * comparator-ascending, while stored values are not ordered. Complexity: O(n)
     * expected.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Computes the map key from the element.
     * @param valueExtractor - Computes the stored value from the element.
     * @returns A promise resolving to a new navigable skip map of values.
     * @throws {TypeError} If a key is nullish or the default order cannot compare it.
     */
    public async toSkipMap<K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): Promise<AsynchronousSkipMap<K, V>>;
    /**
     * Collects extracted keys and values into a new navigable asynchronous skip map.
     *
     * The comparator leads this form so it is never mistaken for a value
     * extractor; both extractors must be supplied with it.
     *
     * Order semantics: navigation, range views and iteration follow the supplied
     * key comparator, which must compare equal exactly for SameValueZero-equal
     * keys. Complexity: O(n) expected, plus a sorted snapshot per read.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param comparator - Total key order consistent with SameValueZero key equality.
     * @param keyExtractor - Computes the map key from the element.
     * @param valueExtractor - Computes the stored value from the element.
     * @returns A promise resolving to a new navigable skip map of values.
     * @throws {TypeError} If the comparator disagrees with key equality, a key or value is nullish, or an argument is not a function.
     */
    public async toSkipMap<K, V>(comparator: Comparator<K>, keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): Promise<AsynchronousSkipMap<K, V>>;
    /**
     * Collects extracted keys and values into a new navigable asynchronous skip map.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param argument1 - The key extractor when used alone or with a value extractor, otherwise the comparator.
     * @param argument2 - The value extractor, or the key extractor when a comparator leads.
     * @param argument3 - The value extractor when a comparator and key extractor lead.
     * @returns A promise resolving to a new navigable skip map over the extracted pairs.
     * @throws {TypeError} If the comparator disagrees with key equality, a key or value is nullish, or an argument is not a function.
     */
    public async toSkipMap<K, V>(argument1: Comparator<K> | Functional<E, K>, argument2?: Functional<E, K> | Functional<E, V>, argument3?: Functional<E, V>): Promise<AsynchronousSkipMap<K, V>> {
        try {
            let second: Functional<E, K> | Functional<E, V> | undefined = typeof argument2 === "function" ? argument2 : undefined;
            let third: Functional<E, V> | undefined = typeof argument3 === "function" ? argument3 : undefined;
            let factory: (first: Comparator<K> | Functional<E, K>, second?: Functional<E, K> | Functional<E, V>, third?: Functional<E, V>) => AsynchronousCollector<E, Array<[K, V]>, AsynchronousSkipMap<K, V>> = useAsynchronousToSkipMap as unknown as (first: Comparator<K> | Functional<E, K>, second?: Functional<E, K> | Functional<E, V>, third?: Functional<E, V>) => AsynchronousCollector<E, Array<[K, V]>, AsynchronousSkipMap<K, V>>;
            return await factory(argument1, second, third).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new asynchronous binary search tree.
     *
     * Buffered elements are sorted by the comparator and split at the midpoint
     * recursively, so the result is a height-balanced
     * `AsynchronousBinarySearchTree` that retains duplicate elements with a stable
     * input order. Traversals expose nodes while collection queries settle through
     * promises.
     *
     * Order semantics: tree order is comparator-ascending, so an in-order
     * traversal is nondecreasing rather than in traversal order, and the default
     * comparator only orders homogeneous numbers, strings, bigints and booleans.
     * Complexity: O(n log n), from sorting plus the midpoint split.
     *
     * @template R - The element type of the finished tree; defaults to the source element type.
     * @param comparator - Total element order; defaults to the scalar order of the tree builder.
     * @returns A promise resolving to a new binary search tree over the elements.
     * @throws {TypeError} If the comparator returns a non-finite number, an element cannot be ordered, or the source contains `null` or `undefined`.
     */
    public async toBinarySearchTree<R extends E = E>(comparator?: Comparator<E>): Promise<AsynchronousBinarySearchTree<R>> {
        try {
            return await useAsynchronousToBinarySearchTree<E>(comparator).collect(this.source()) as unknown as AsynchronousBinarySearchTree<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new asynchronous rooted forest.
     *
     * Elements are laid out by the forest builder as one rooted component whose
     * nodes keep source order, and the result exposes its roots through
     * `getRoots()`, which settles through a promise. Collection queries such as
     * `size()` count elements across every component, while traversals expose
     * nodes.
     *
     * Order semantics: the default layout keeps encounter order as structural
     * order instead of sorting, so a parent precedes its children by stream
     * position; a multi-root forest cannot be expressed from a stream alone and
     * needs the constructor's `buildNodes` option. Complexity: O(n), including the
     * depth, height and subtree-size metadata of the default layout.
     *
     * @template R - The element type of the finished forest; defaults to the source element type.
     * @returns A promise resolving to a new forest over the elements in traversal order.
     * @throws {TypeError} If the source contains `null` or `undefined`.
     */
    public async toRootedForest<R extends E = E>(): Promise<AsynchronousRootedForest<R>> {
        try {
            return await useAsynchronousToRootedForest<E>().collect(this.source()) as unknown as AsynchronousRootedForest<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Chains stream accumulation, writing stringified elements when no accumulator is supplied.
     *
     * @template S - The stream chunk type.
     * @param stream - The writable stream passed through the collection.
     * @returns A promise resolving to the stream after accumulation completes.
     */
    public async write<S = string>(stream: WritableStream<S>): Promise<WritableStream<S>>;
    /**
     * Chains stream accumulation, writing stringified elements when no accumulator is supplied.
     *
     * @template S - The stream chunk type.
     * @param stream - The writable stream passed through the collection.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns A promise resolving to the stream after accumulation completes.
     */
    public async write<S = string>(stream: WritableStream<S>, accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>>): Promise<WritableStream<S>>;
    /**
     * Chains stream accumulation, writing stringified elements when no accumulator is supplied.
     *
     * @template S - The stream chunk type.
     * @param stream - The writable stream passed through the collection.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns A promise resolving to the stream after accumulation completes.
     */
    public async write<S = string>(stream: WritableStream<S>, accumulator: TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): Promise<WritableStream<S>>;
    /**
     * Chains stream accumulation, writing stringified elements when no accumulator is supplied.
     *
     * @template S - The stream chunk type.
     * @param argument1 - The first argument selected by the overload.
     * @param argument2 - The optional second argument selected by the overload.
     * @returns A promise resolving to the stream after accumulation completes.
     */
    public async write<S = string>(argument1: WritableStream<S>, argument2?: BiFunctional<WritableStream<S>, E, WritableStream<S>> | TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): Promise<WritableStream<S>> {
        if (isObject(argument1)) {
            try {
                let stream: WritableStream<S> = argument1 as WritableStream<S>;
                if (isFunction(argument2)) {
                    let accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>> = argument2 as BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>;
                    return await useAsynchronousWrite(stream, accumulator).collect(this.source());
                }
                else {
                    return await useAsynchronousWrite(stream).collect(this.source());
                }
            }
            catch (error) {
                throw error;
            }
        }
        throw new TypeError("Invalid arguments.");
    }
};

/**
 * An asynchronous collectable that buffers the source and traverses it in
 * sorted order.
 *
 * Construction starts draining the generator into an indexed buffer; `ready`
 * resolves once the buffer is either sorted by the supplied comparator or
 * normalised to encounter indices modulo the buffer length. Every terminal
 * operation awaits that promise before reading `buffer`, and `source()` reports
 * the buffered index rather than the original encounter index.
 *
 * Ordering semantics: with a comparator, iteration is comparator-ascending and
 * the reported index is the element position in that sorted order; without one,
 * iteration is ascending by normalised encounter index, so a reverse or shuffle
 * that rewrote indices is observable here. Lookup overrides (`findAny`,
 * `findFirst`, `findLast`) read the buffer directly and therefore see that same
 * order.
 *
 * Complexity: buffering is O(n) and sorting is O(n log n); `findFirst` and
 * `findLast` are O(1) after `ready` settles, and `count`, `isEmpty` and
 * `source()` are O(1) to O(n) over the buffer.
 *
 * @template E - The source element type.
 */
export class AsynchronousOrderedCollectable<E> extends AsynchronousCollectable<E> {
    protected readonly OrderedCollectable: symbol = AsynchronousOrderedCollectableSymbol;
    protected buffer: Array<Indexed<E>> = [];
    protected readonly ready: Promise<void>;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "AsynchronousOrderedCollectable";
    /**
     * Starts draining the source into an indexed buffer ordered by index.
     *
     * The buffer is filled eagerly: `ready` resolves once every element has been
     * collected with its encounter index, the indices have been normalised
     * modulo the buffer length, and the buffer has been sorted ascending. Every
     * terminal operation awaits `ready` before reading the buffer.
     *
     * Ordering: ascending normalised encounter index, which makes `reverse` and
     * `shuffle` index rewrites observable.
     * Complexity: O(n) buffering plus O(n log n) sorting, started at construction.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: AsynchronousGenerator<E>);
    /**
     * Starts draining the source into an indexed buffer ordered by a comparator.
     *
     * The comparator decides the traversal order, and the buffered index is
     * reassigned to the element position in that sorted order, so every later
     * operation sees a contiguous, comparator-ascending sequence once `ready`
     * settles.
     *
     * Ordering: comparator-ascending; elements the comparator considers equal
     * keep their relative encounter order because the sort is stable.
     * Complexity: O(n) buffering plus O(n log n) sorting, started at construction.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: AsynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: AsynchronousGenerator<E>, comparator?: Comparator<E>) {
        super();
        if (!isFunction(generator)) {
            throw new TypeError("Source must be an iterable or a generator function.");
        }
        this.ready = useAsynchronousToIndexedArray<E>().collect(generator).then((indexed: Array<Indexed<E>>): void => {
            if (isFunction(comparator)) {
                this.buffer = indexed.slice().sort((a: Indexed<E>, b: Indexed<E>): number => comparator(a.element, b.element))
                    .map((entry: Indexed<E>, index: number): Indexed<E> => ({ element: entry.element, index: BigInt(index) }));
            }
            else {
                let count: bigint = BigInt(indexed.length);
                this.buffer = indexed.map((entry: Indexed<E>): Indexed<E> => ({
                    element: entry.element,
                    index: count === 0n ? entry.index : ((entry.index % count) + count) % count
                })).sort((a: Indexed<E>, b: Indexed<E>): number => Number(a.index - b.index));
            }
        });
        // Observe failures immediately while preserving rejection for every terminal.
        void this.ready.catch((): void => {});
        Object.defineProperty(this, "AsynchronousOrderedCollectable", {
            value: AsynchronousOrderedCollectableSymbol, writable: false, enumerable: false, configurable: false
        });
    }
    /**
     * Selects an element using this collectable implementation.
     *
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public override async findAny(): Promise<E> {
        await this.settled();
        if (this.buffer.length === 0) {
            throw new Error("No element found.");
        }
        return this.buffer[Math.floor(Math.random() * this.buffer.length)].element;
    }
    /**
     * Finds the first element available to the lookup strategy.
     *
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public override async findFirst(): Promise<E> {
        await this.settled();
        if (this.buffer.length === 0) {
            throw new Error("No element found.");
        }
        return this.buffer[0].element;
    }
    /**
     * Finds the last element available to the lookup strategy.
     *
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public override async findLast(): Promise<E> {
        await this.settled();
        if (this.buffer.length === 0) {
            throw new Error("No element found.");
        }
        return this.buffer[this.buffer.length - 1].element;
    }
    /**
     * Finds the greatest element according to the comparator.
     *
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public override async findMaximum(): Promise<E>;
    /**
     * Finds the greatest element according to the comparator.
     *
     * @param comparator - The comparison function; defaults to the library comparator.
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public override async findMaximum(comparator: Comparator<E>): Promise<E>;
    /**
     * Finds the greatest element according to the comparator.
     *
     * @param comparator - The comparison function; defaults to the library comparator.
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public override async findMaximum(comparator: Comparator<E> = useCompare): Promise<E> {
        return await useAsynchronousFindMaximum(comparator).collect(this.source());
    }
    /**
     * Finds the least element according to the comparator.
     *
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public override async findMinimum(): Promise<E>;
    /**
     * Finds the least element according to the comparator.
     *
     * @param comparator - The comparison function; defaults to the library comparator.
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public override async findMinimum(comparator: Comparator<E>): Promise<E>;
    /**
     * Finds the least element according to the comparator.
     *
     * @param comparator - The comparison function; defaults to the library comparator.
     * @returns A promise for the selected element, with absence handled by the lookup strategy.
     */
    public override async findMinimum(comparator: Comparator<E> = useCompare): Promise<E> {
        return await useAsynchronousFindMinimum(comparator).collect(this.source());
    }
    protected async settled(): Promise<void> {
        await this.ready;
    }
    /**
     * Exposes an async generator over the settled, sorted buffer.
     *
     * The original generator is never touched again: construction already drained
     * it, so each call awaits `settled()` and then replays `buffer`, reporting the
     * buffered index.
     *
     * Ordering: comparator order, or ascending normalised encounter index.
     * Complexity: O(n) per traversal and O(1) extra space.
     *
     * @returns The generator accepting element and interruption callbacks.
     */
    public override source(): AsynchronousGenerator<E> {
        return async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            await this.settled();
            for (let { index, element } of this.buffer) {
                if (interrupt(element, index)) {
                    break;
                }
                accept(element, index);
            }
        };
    }
    /**
     * Checks whether the settled buffer is empty.
     *
     * Ordering: irrelevant; emptiness is a property of the whole buffer.
     * Complexity: O(1) after `ready` settles, which the call awaits.
     *
     * @returns A promise resolving to whether the buffered count is zero.
     */
    public override async isEmpty(): Promise<boolean> {
        await this.settled();
        return this.buffer.length === 0;
    }
    /**
     * Counts the buffered elements.
     *
     * Ordering: irrelevant; the count covers the whole sorted buffer.
     * Complexity: O(1) after `ready` settles, which the call awaits.
     *
     * @returns A promise resolving to the buffered element count as a bigint.
     */
    public override async count(): Promise<bigint> {
        await this.settled();
        return BigInt(this.buffer.length);
    }
};

/**
 * An asynchronous collectable that buffers by encounter index and traverses by
 * insertion.
 *
 * Construction starts draining the generator into a `Map` keyed by the emitted
 * index, and `ready` resolves when that buffer is complete. Because a `Map`
 * keeps the first position of a key, a repeated index would overwrite its
 * value, so each duplicate is stored under a surrogate key above `2 ** 96`;
 * the original value survives in map insertion order.
 *
 * Ordering semantics: iteration follows insertion order of the buffer, which is
 * the encounter order of first occurrence for each index. No comparator is
 * applied, so this class is the choice when the source order must be preserved
 * literally, duplicate indices included, and no ordering guarantee beyond that
 * insertion order should be inferred.
 *
 * Complexity: buffering is O(n); iteration and `source()` are O(n); inherited
 * terminal operations are O(n) plus their own documented cost.
 *
 * @template E - The source element type.
 */
export class AsynchronousUnorderedCollectable<E> extends AsynchronousCollectable<E> {
    protected readonly AsynchronousUnorderedCollectable: symbol = AsynchronousUnorderedCollectableSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "AsynchronousUnorderedCollectable";
    protected buffer: Map<bigint, E> = new Map<bigint, E>();
    protected readonly ready: Promise<void>;
    /**
     * Starts draining the source into an index-keyed buffer at construction.
     *
     * Elements are stored in a `Map` under their emitted index; a repeated index
     * is moved above `2 ** 96` so it cannot overwrite an earlier value. `ready`
     * resolves when the source is exhausted, and every terminal operation awaits
     * that promise before reading the buffer.
     *
     * Ordering: map insertion order, i.e. the encounter order of each index and
     * of its first duplicate; no comparator is involved.
     * Complexity: O(n) time and O(n) memory, started at construction.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: AsynchronousGenerator<E>) {
        super();
        if (!isFunction(generator)) {
            throw new TypeError("Source must be an iterable or a generator function.");
        }
        this.ready = (async (): Promise<void> => {
            let surrogate: bigint = 0n;
            await generator((element: E, index: bigint): void => {
                let key: bigint = this.buffer.has(index) ? SURROGATE_BASE + (surrogate++) : index;
                this.buffer.set(key, element);
            }, (): boolean => false);
        })();
        void this.ready.catch((): void => {});
        Object.defineProperty(this, "AsynchronousUnorderedCollectable", {
            value: AsynchronousUnorderedCollectableSymbol, writable: false, enumerable: false, configurable: false
        });
    }
    protected async settled(): Promise<void> {
        await this.ready;
    }
    /**
     * Exposes an async generator over the settled, index-keyed buffer.
     *
     * Each buffered key, surrogate derived keys included, is reported as the
     * element index; consumers that care about indices can therefore observe the
     * relocated duplicate keys. Construction already drained the original
     * generator, so this only awaits `ready` and replays the buffer.
     *
     * Ordering: map insertion order, which is encounter order for first
     * occurrences.
     * Complexity: O(n) per traversal and O(1) extra space.
     *
     * @returns The generator accepting element and interruption callbacks.
     */
    public override source(): AsynchronousGenerator<E> {
        return async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            await this.settled();
            for (let [index, element] of this.buffer) {
                if (interrupt(element, index)) {
                    break;
                }
                accept(element, index);
            }
        };
    }
};
