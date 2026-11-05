/**
 * The synchronous collectable class family: buffered, iterable element sources
 * that expose terminal operations over a callback-based generator.
 *
 * This module is the transitional home of the synchronous collectable API and
 * intentionally duplicates `SynchronousCollectable`,
 * `SynchronousOrderedCollectable` and `SynchronousUnorderedCollectable` from
 * `#semantic/synchronous/semantic`. Every preserved method body is copied
 * verbatim from that implementation; the class names, the module boundary and
 * the documentation differ, and a convenience `generator()` alias is added on
 * top of `source()`. The signal, distribution, statistics and window modules
 * extend the classes here and import the same collector factories, so a change
 * to the buffered source or to a terminal operation is visible from all of them.
 *
 * {@link SignalCollectable} also lives in this module, immediately after
 * {@link OrderedCollectable}, because its `extends` heritage is evaluated when
 * this module's body runs. Declaring the subclass in
 * `#semantic/synchronous/signal` would read `OrderedCollectable` through a
 * temporal dead zone whenever a dependency cycle evaluated that module first;
 * keeping the heritage in one module removes that read. The signal module
 * re-exports the class, so its import path is unchanged.
 *
 * One member of the original class is deliberately not reproduced here: the
 * `semantic()` bridge, which constructed a `SynchronousSemantic` from
 * `source()`. Creating that instance would introduce a runtime dependency on
 * `#semantic/synchronous/semantic` and therefore a module cycle once this file
 * is wired in, so only the type is imported. The same bridge remains available
 * through `pipe()`, which receives the generator from the caller and therefore
 * stays dependency-free.
 *
 * Ordering contract of the family:
 *
 * - {@link Collectable} makes no ordering promise: it only defines the
 *   callback-based traversal and the terminal operations built on it.
 * - {@link OrderedCollectable} buffers the source at construction and exposes
 *   elements in comparator order, or in normalised encounter-index order when
 *   no comparator is supplied.
 * - {@link UnorderedCollectable} buffers by encounter index and exposes
 *   elements in map insertion order, retaining duplicate-index entries under
 *   surrogate keys.
 *
 * Complexity: the concrete buffered subclasses hold O(n) elements; terminal
 * operations drain the source once, so they are O(n) unless a method documents
 * a stricter bound.
 *
 * @module
 */

import {
    useSynchronousAnyMatch,
    useSynchronousAllMatch,
    useSynchronousCollect,
    useSynchronousCount,
    useSynchronousError,
    useSynchronousFindAny,
    useSynchronousFindAt,
    useSynchronousFindFirst,
    useSynchronousFindLast,
    useSynchronousFindMaximum,
    useSynchronousFindMinimum,
    useSynchronousForEach,
    useSynchronousGroup,
    useSynchronousGroupBy,
    useSynchronousJoin,
    useSynchronousLog,
    useSynchronousNoneMatch,
    useSynchronousPartition,
    useSynchronousPartitionBy,
    useSynchronousReduce,
    useSynchronousToArray,
    useSynchronousToMap,
    useSynchronousToSet,
    useSynchronousWrite,
    useSynchronousFindNegativeAt,
    useSynchronousToIndexedArray,
    useSynchronousToOrderedSet,
    useSynchronousToUnorderedSet,
    useSynchronousToOrderedMap,
    useSynchronousToUnorderedMap,
    useSynchronousToList,
    useSynchronousToCycle,
    useSynchronousToLRUSet,
    useSynchronousToLRUMap,
    useSynchronousToSkipSet,
    useSynchronousToSkipMap,
    useSynchronousToBinarySearchTree,
    useSynchronousToRootedForest,
    useSynchronousAmplitude,
    useSynchronousAnalyticSignal,
    useSynchronousAutocorrelation,
    useSynchronousDecibel,
    useSynchronousDetrended,
    useSynchronousEnvelope,
    useSynchronousInstantaneousFrequency,
    useSynchronousInstantaneousPhase,
    useSynchronousOneSided,
    useSynchronousPower,
    useSynchronousPowerDecibel,
    useSynchronousPowerSpectralDensity,
    useSynchronousShortTimeFourierTransform,
    useSynchronousSignalToNoiseRatio,
    useSynchronousSpectralBandwidth,
    useSynchronousSpectralCentroid,
    useSynchronousSpectralFlatness,
    useSynchronousSpectralFlux,
    useSynchronousSpectralRolloff,
    useSynchronousSpectrogram,
    useSynchronousSpectrum,
    useSynchronousWindowed,
    useSynchronousZeroCrossingRate
} from "#semantic/synchronous/collectors";

import type { Angle } from "#semantic/mathematics/angle";
import type { Bin } from "#semantic/mathematics/bin";
import type { Complex } from "#semantic/mathematics/complex";
import { Frame } from "#semantic/mathematics/frame";
import { Frequency } from "#semantic/mathematics/frequency";
import { Sample } from "#semantic/mathematics/sample";
import type { Spectrogram } from "#semantic/mathematics/spectrogram";
import type { Spectrum } from "#semantic/mathematics/spectrum";
import {
    coherentGain,
    equivalentNoiseBandwidth,
    useHannPeriodicWindow,
    useRectangularWindow,
    type SpectralWindow
} from "#semantic/mathematics/window";
import {
    DefaultEnvelopeGate,
    DefaultFrameSize,
    DefaultRolloffRatio,
    Tolerance,
    requireCount,
    requireSignalValues,
    resolveWindow,
    sequenceGenerator,
    type CorrelationNormalization,
    type DetrendMode,
    type SpectralDensity
} from "#semantic/synchronous/signal";
import {
    isFunction,
    isNumber,
    isBigInt,
    isObject,
    isString,
    isSynchronousCollector
} from "#semantic/guard";
import { useCompare } from "#semantic/hook";
import {
    SynchronousOrderedCollectableSymbol,
    SynchronousCollectableSymbol,
    SynchronousUnorderedCollectableSymbol
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
    type SynchronousGenerator,
    type TriFunctional,
    type TriPredicate
} from "#semantic/utility";
import { SynchronousCollector } from "#semantic/synchronous/collector";
import { Optional } from "#semantic/optional";
import type { SynchronousSemantic } from "#semantic/synchronous/semantic";
import type { SynchronousCycle } from "#semantic/structure/cycle";
import type { SynchronousRootedForest } from "#semantic/structure/forest/rootedForest";
import type { SynchronousList } from "#semantic/structure/list";
import type { SynchronousUnorderedLRUMap, SynchronousUnorderedLRUSet } from "#semantic/structure/lru";
import type { SynchronousOrderedMap, SynchronousUnorderedMap } from "#semantic/structure/map";
import type { SynchronousOrderedSet, SynchronousUnorderedSet } from "#semantic/structure/set";
import type { SynchronousSkipMap, SynchronousSkipSet } from "#semantic/structure/skip";
import type { SynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";

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
 * The abstract root of the synchronous collectable family.
 *
 * A collectable wraps a callback-based generator in a buffered, replayable
 * view: `source()` hands the raw generator back for re-traversal,
 * `[Symbol.iterator]` materialises the elements, and every other member is a
 * terminal operation that drains `source()` exactly once and returns its
 * result synchronously.
 *
 * Ordering semantics: this class itself promises nothing about order — the
 * traversal order is whatever the concrete `source()` yields. Subclasses are
 * responsible for establishing a buffer and for documenting whether iteration
 * follows encounter order, comparator order or index order.
 *
 * Complexity: individual terminal operations are O(n) unless documented
 * otherwise, because each one drains the source once; subclasses that buffer
 * pay O(n) memory for replayability.
 *
 * @template E - The source element type.
 */
export abstract class Collectable<E> implements Iterable<E> {
    protected readonly SynchronousCollectable: symbol = SynchronousCollectableSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "SynchronousCollectable";
    /**
     * Installs the synchronous collectable brand used by the runtime guards.
     *
     * The marker is stored under the historical `SynchronousCollectable` key as
     * a non-enumerable, non-writable property, matching the original class so
     * `#semantic/guard` keeps recognising instances of this family. No source is
     * traversed here: the concrete subclass supplies it through `source()`.
     *
     * Complexity: O(1) — only a property descriptor is installed.
     */
    public constructor() {
        Object.defineProperty(this, "SynchronousCollectable", {
            value: SynchronousCollectableSymbol,
            enumerable: false,
            writable: false,
            configurable: false
        });
    }
    /**
     * Iterates the elements in this collectable's traversal order.
     *
     * The base implementation materialises the source with `toArray()` and then
     * yields the result, so the traversal drains the source once and can be
     * repeated safely for a buffered subclass.
     *
     * Ordering: exactly the order produced by `toArray()`, which for a concrete
     * subclass is whatever its `source()` promises.
     * Complexity: O(n) time and O(n) extra memory for the materialised array.
     *
     * @returns A generator over the collected elements.
     */
    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let element of this.toArray()) {
            yield element;
        }
    }
    /**
     * Tests for a matching element and stops after a match.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns Whether a match was found; false when empty.
     */
    public anyMatch(predicate: Predicate<E>): boolean;
    /**
     * Tests for a matching element and stops after a match.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns Whether a match was found; false when empty.
     */
    public anyMatch(predicate: BiPredicate<E, bigint>): boolean;
    /**
     * Tests for a matching element and stops after a match.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns Whether a match was found; false when empty.
     */
    public anyMatch(predicate: Predicate<E> | BiPredicate<E, bigint>): boolean {
        if (isFunction(predicate)) {
            try {
                return useSynchronousAnyMatch(predicate).collect(this.source());
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
     * @returns The boolean produced by the all-match strategy.
     */
    public allMatch(predicate: Predicate<E>): boolean;
    /**
     * Tests the source elements with an all-match collector.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns The boolean produced by the all-match strategy.
     */
    public allMatch(predicate: BiPredicate<E, bigint>): boolean;
    /**
     * Tests the source elements with an all-match collector.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns The boolean produced by the all-match strategy.
     */
    public allMatch(predicate: Predicate<E> | BiPredicate<E, bigint>): boolean {
        return useSynchronousAllMatch(predicate).collect(this.source());
    }
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param collector - The collection strategy to apply.
     * @returns The finished result for the selected overload.
     */
    public collect<A, R>(collector: SynchronousCollector<E, A, R>): R;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns The finished result for the selected overload.
     */
    public collect<A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): R;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns The finished result for the selected overload.
     */
    public collect<A, R>(identity: Supplier<A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): R;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param interruptor - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns The finished result for the selected overload.
     */
    public collect<A, R>(identity: Supplier<A>, interruptor: Predicate<E>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): R;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param interruptor - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns The finished result for the selected overload.
     */
    public collect<A, R>(identity: Supplier<A>, interruptor: BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): R;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param interruptor - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns The finished result for the selected overload.
     */
    public collect<A, R>(identity: Supplier<A>, interruptor: TriPredicate<E, bigint, A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): R;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param interruptor - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns The finished result for the selected overload.
     */
    public collect<A, R>(identity: Supplier<A>, interruptor: Predicate<E>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): R;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param interruptor - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns The finished result for the selected overload.
     */
    public collect<A, R>(identity: Supplier<A>, interruptor: BiPredicate<E, bigint>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): R;
    /**
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param interruptor - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns The finished result for the selected overload.
     */
    public collect<A, R>(identity: Supplier<A>, interruptor: TriPredicate<E, bigint, A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): R;
    /**
     * Drains the source into a single result using a collection strategy.
     *
     * Three shapes are accepted: a ready-made `SynchronousCollector`, a
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
     * @returns The finished result for the selected overload.
     * @throws {TypeError} If the arguments match no overload.
     */
    public collect<A, R>(argument1: Supplier<A> | SynchronousCollector<E, A, R>, argument2?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Predicate<E> | BiPredicate<E, bigint> | TriPredicate<E, bigint, A>, argument3?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Functional<A, R>, argument4?: Functional<A, R>): R {
        try {
            if (isSynchronousCollector(argument1)) {
                let collector: SynchronousCollector<E, A, R> = argument1 as SynchronousCollector<E, A, R>;
                return collector.collect(this.source());
            }
            if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3) && invalidate(argument4)) {
                let identity: Supplier<A> = argument1 as Supplier<A>;
                let accumulator: BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A> = argument2 as BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A>;
                let finisher: Functional<A, R> = argument3 as Functional<A, R>;
                return useSynchronousCollect(identity, accumulator, finisher).collect(this.source());
            }
            if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3) && isFunction(argument4)) {
                let identity: Supplier<A> = argument1 as Supplier<A>;
                let interrupt: Predicate<E> & BiPredicate<E, bigint> & TriPredicate<E, bigint, A> = argument2 as Predicate<E> & BiPredicate<E, bigint> & TriPredicate<E, bigint, A>;
                let accumulator: BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A> = argument3 as BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A>;
                let finisher: Functional<A, R> = argument4 as Functional<A, R>;
                return useSynchronousCollect(identity, interrupt, accumulator, finisher).collect(this.source());
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
     * this with an O(1) buffer length.
     *
     * @returns The element count as a bigint.
     */
    public count(): bigint {
        return useSynchronousCount<E>().collect(this.source());
    }
    /**
     * Formats the elements and writes the resulting text with console.error.
     *
     * @returns Nothing after the output completes.
     */
    public error(): void;
    /**
     * Formats the elements and writes the resulting text with console.error.
     *
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns Nothing after the output completes.
     */
    public error(accumulator: BiFunctional<string, E, string>): void;
    /**
     * Formats the elements and writes the resulting text with console.error.
     *
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns Nothing after the output completes.
     */
    public error(accumulator: TriFunctional<string, E, bigint, string>): void;
    /**
     * Formats the elements and writes the resulting text with console.error.
     *
     * @param prefix - The opening text.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param suffix - The closing text.
     * @returns Nothing after the output completes.
     */
    public error(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): void;
    /**
     * Formats the elements and writes the resulting text with console.error.
     *
     * @param prefix - The opening text.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param suffix - The closing text.
     * @returns Nothing after the output completes.
     */
    public error(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): void;
    /**
     * Formats the elements and writes the resulting text with console.error.
     *
     * @param argument1 - The first argument selected by the overload.
     * @param argument2 - The optional second argument selected by the overload.
     * @param argument3 - The optional third argument selected by the overload.
     * @returns Nothing after the output completes.
     */
    public error(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): void {
        if (invalidate(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                useSynchronousError<E>().collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                useSynchronousError<E>(accumulator).collect(this.source());
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
                useSynchronousError<E>(prefix, accumulator, suffix).collect(this.source());
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
     * drains the source; buffered subclasses answer from their buffer instead.
     *
     * Ordering: irrelevant, but a base-class call visits every element.
     * Complexity: O(n) time for the base implementation, O(1) when a buffered
     * subclass overrides it.
     *
     * @returns Whether the element count is zero.
     */
    public isEmpty(): boolean {
        return this.count() === 0n;
    }
    /**
     * Selects an element using this collectable implementation.
     *
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findAny(): Optional<E> {
        try {
            return useSynchronousFindAny<E>().collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Finds the element at a non-negative encounter position.
     *
     * @param index - The requested position; negative lookup methods wrap modulo the source length.
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findAt(index: number): Optional<E>;
    /**
     * Finds the element at a non-negative encounter position.
     *
     * @param index - The requested position; negative lookup methods wrap modulo the source length.
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findAt(index: bigint): Optional<E>;
    /**
     * Finds the element at a non-negative encounter position.
     *
     * @param index - The requested position; negative lookup methods wrap modulo the source length.
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findAt(index: number | bigint): Optional<E> {
        if (isBigInt(index)) {
            try {
                return useSynchronousFindAt<E>(index).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else if (isNumber(index)) {
            try {
                return useSynchronousFindAt<E>(index).collect(this.source());
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
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findNegativeAt(index: number): Optional<E>;
    /**
     * Buffers elements and resolves a negative position modulo the source length.
     *
     * @param index - The requested position; negative lookup methods wrap modulo the source length.
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findNegativeAt(index: bigint): Optional<E>;
    /**
     * Buffers elements and resolves a negative position modulo the source length.
     *
     * @param index - The requested position; negative lookup methods wrap modulo the source length.
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findNegativeAt(index: number | bigint): Optional<E> {
        if (isBigInt(index)) {
            try {
                return useSynchronousFindNegativeAt<E>(index).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else if (isNumber(index)) {
            try {
                return useSynchronousFindNegativeAt<E>(index).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        throw new TypeError("Index must be a bigint.");
    }
    /**
     * Finds the first element available to the lookup strategy.
     *
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findFirst(): Optional<E> {
        try {
            return useSynchronousFindFirst<E>().collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Finds the last element available to the lookup strategy.
     *
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findLast(): Optional<E> {
        try {
            return useSynchronousFindLast<E>().collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Finds the greatest element according to the comparator.
     *
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findMaximum(): Optional<E>;
    /**
     * Finds the greatest element according to the comparator.
     *
     * @param comparator - The comparison function; defaults to the library comparator.
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findMaximum(comparator: Comparator<E>): Optional<E>;
    /**
     * Finds the greatest element according to the comparator.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findMaximum(argument1?: Comparator<E>): Optional<E> {
        try {
            let comparator: Comparator<E> = isFunction(argument1) ? argument1 : useCompare;
            return useSynchronousFindMaximum(comparator).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Finds the least element according to the comparator.
     *
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findMinimum(): Optional<E>;
    /**
     * Finds the least element according to the comparator.
     *
     * @param comparator - The comparison function; defaults to the library comparator.
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findMinimum(comparator: Comparator<E>): Optional<E>;
    /**
     * Finds the least element according to the comparator.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns An Optional containing the selected non-nullish element, or an empty Optional when unavailable.
     */
    public findMinimum(argument1?: Comparator<E>): Optional<E> {
        try {
            let comparator: Comparator<E> = isFunction(argument1) ? argument1 : useCompare;
            return useSynchronousFindMinimum(comparator).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Invokes the action for every encountered element.
     *
     * @param action - Receives each element and optional bigint index.
     * @returns Nothing after traversal completes.
     */
    public forEach(action: Consumer<E>): void;
    /**
     * Invokes the action for every encountered element.
     *
     * @param action - Receives each element and optional bigint index.
     * @returns Nothing after traversal completes.
     */
    public forEach(action: BiConsumer<E, bigint>): void;
    /**
     * Invokes an observer for every element encountered during traversal.
     *
     * The action receives the element and its `bigint` index, which for a
     * buffered subclass is the buffered index rather than the original encounter
     * index. The return value of the action is discarded.
     *
     * Ordering: the traversal order defined by `source()`.
     * Complexity: O(n) — every element is visited and no early exit is exposed.
     *
     * @param action - Receives each element and optional bigint index.
     * @returns Nothing after traversal completes.
     */
    public forEach(action: Consumer<E> | BiConsumer<E, bigint>): void {
        if (isFunction(action)) {
            try {
                useSynchronousForEach(action).collect(this.source());
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
     * @returns A map of keys to element arrays in encounter order.
     */
    public group<K>(classifier: Functional<E, K>): Map<K, Array<E>>;
    /**
     * Groups elements into arrays by classifier key.
     *
     * @template K - The extracted key type.
     * @param classifier - Calculates the grouping key or bigint bucket.
     * @returns A map of keys to element arrays in encounter order.
     */
    public group<K>(classifier: BiFunctional<E, bigint, K>): Map<K, Array<E>>;
    /**
     * Groups elements into arrays by classifier key.
     *
     * @template K - The extracted key type.
     * @param classifier - Calculates the grouping key or bigint bucket.
     * @returns A map of keys to element arrays in encounter order.
     */
    public group<K>(classifier: Functional<E, K> | BiFunctional<E, bigint, K>): Map<K, Array<E>> {
        if (isFunction(classifier)) {
            try {
                return useSynchronousGroup(classifier).collect(this.source());
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
     * @returns A map of keys to extracted value arrays.
     */
    public groupBy<K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): Map<K, Array<V>>;
    /**
     * Groups extracted values into arrays by extracted key.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A map of keys to extracted value arrays.
     */
    public groupBy<K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, K>): Map<K, Array<V>>;
    /**
     * Groups extracted values into arrays by extracted key.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A map of keys to extracted value arrays.
     */
    public groupBy<K, V>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V>): Map<K, Array<V>> {
        if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
            try {
                return useSynchronousGroupBy(keyExtractor, valueExtractor).collect(this.source());
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
     * @returns The formatted text.
     */
    public join(): string;
    /**
     * Formats elements using separators or an accumulator; the default uses square brackets and commas.
     *
     * @param delimiter - The separator inserted between elements.
     * @returns The formatted text.
     */
    public join(delimiter: string): string;
    /**
     * Formats elements using separators or an accumulator; the default uses square brackets and commas.
     *
     * @param prefix - The opening text.
     * @param delimiter - The separator inserted between elements.
     * @param suffix - The closing text.
     * @returns The formatted text.
     */
    public join(prefix: string, delimiter: string, suffix: string): string;
    /**
     * Formats elements using separators or an accumulator; the default uses square brackets and commas.
     *
     * @param prefiex - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param suffix - The closing text.
     * @returns The formatted text.
     */
    public join(prefiex: string, accumulator: BiFunctional<string, E, string>, suffix: string): string;
    /**
     * Formats elements using separators or an accumulator; the default uses square brackets and commas.
     *
     * @param prefiex - The value used by this operation.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param suffix - The closing text.
     * @returns The formatted text.
     */
    public join(prefiex: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): string;
    /**
     * Formats elements using separators or an accumulator; the default uses square brackets and commas.
     *
     * @param argument1 - The first argument selected by the overload.
     * @param argument2 - The optional second argument selected by the overload.
     * @param argument3 - The optional third argument selected by the overload.
     * @returns The formatted text.
     */
    public join(argument1?: string, argument2?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): string {
        if (invalidate(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                return useSynchronousJoin<E>().collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else if (isString(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let delimiter: string = argument1;
                return useSynchronousJoin<E>(delimiter).collect(this.source());
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
                return useSynchronousJoin<E>(prefix, accumulator, suffix).collect(this.source());
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
                return useSynchronousJoin<E>(prefix, delimiter, suffix).collect(this.source());
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
     * @returns Nothing after the output completes.
     */
    public log(): void;
    /**
     * Formats the elements and writes the resulting text with console.log.
     *
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns Nothing after the output completes.
     */
    public log(accumulator: BiFunctional<string, E, string>): void;
    /**
     * Formats the elements and writes the resulting text with console.log.
     *
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns Nothing after the output completes.
     */
    public log(accumulator: TriFunctional<string, E, bigint, string>): void;
    /**
     * Formats the elements and writes the resulting text with console.log.
     *
     * @param prefix - The opening text.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param suffix - The closing text.
     * @returns Nothing after the output completes.
     */
    public log(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): void;
    /**
     * Formats the elements and writes the resulting text with console.log.
     *
     * @param prefix - The opening text.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param suffix - The closing text.
     * @returns Nothing after the output completes.
     */
    public log(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): void;
    /**
     * Formats the elements and writes the resulting text with console.log.
     *
     * @param argument1 - The first argument selected by the overload.
     * @param argument2 - The optional second argument selected by the overload.
     * @param argument3 - The optional third argument selected by the overload.
     * @returns Nothing after the output completes.
     */
    public log(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): void {
        if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                useSynchronousLog<E>(accumulator).collect(this.source());
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
                useSynchronousLog<E>(prefix, accumulator, suffix).collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        else {
            try {
                useSynchronousLog<E>().collect(this.source());
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
     * @returns Whether no match was found; true when empty.
     */
    public nonMatch(predicate: Predicate<E>): boolean;
    /**
     * Tests that no element matches, stopping after a match.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns Whether no match was found; true when empty.
     */
    public nonMatch(predicate: BiPredicate<E, bigint>): boolean;
    /**
     * Tests that no element matches, stopping after a match.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns Whether no match was found; true when empty.
     */
    public nonMatch(predicate: Predicate<E> | BiPredicate<E, bigint>): boolean {
        if (isFunction(predicate)) {
            try {
                return useSynchronousNoneMatch(predicate).collect(this.source());
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
     * @returns The allocated bucket arrays; an empty source produces an empty array.
     */
    public partition(count: bigint): Array<Array<E>> {
        if (isBigInt(count)) {
            try {
                return useSynchronousPartition<E>(count).collect(this.source());
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
     * @returns The bucket arrays, including empty intervening buckets.
     */
    public partitionBy(classifier: Functional<E, bigint>): Array<Array<E>>;
    /**
     * Distributes elements into bigint-numbered buckets, mapping negative bucket numbers to zero.
     *
     * @param classifier - Calculates the grouping key or bigint bucket.
     * @returns The bucket arrays, including empty intervening buckets.
     */
    public partitionBy(classifier: BiFunctional<E, bigint, bigint>): Array<Array<E>>;
    /**
     * Distributes elements into bigint-numbered buckets, mapping negative bucket numbers to zero.
     *
     * @param classifier - Calculates the grouping key or bigint bucket.
     * @returns The bucket arrays, including empty intervening buckets.
     */
    public partitionBy(classifier: Functional<E, bigint> | BiFunctional<E, bigint, bigint>): Array<Array<E>> {
        if (isFunction(classifier)) {
            try {
                let collector: SynchronousCollector<E, Array<E[]>, Array<E[]>> = useSynchronousPartitionBy(classifier);
                return collector.collect(this.source());
            }
            catch (error) {
                throw error;
            }
        }
        throw new TypeError("Classifier must be a function.");
    }
    /**
     * Passes the underlying generator to a pipeline conversion.
     *
     * @param conversion - Converts the source generator to a pipeline.
     * @returns The pipeline returned by the conversion.
     */
    public pipe(conversion: Functional<SynchronousGenerator<E>, SynchronousSemantic<E>>): SynchronousSemantic<E>;
    /**
     * Passes the underlying generator to a pipeline conversion.
     *
     * @template R - The mapped or finished result type.
     * @param conversion - Converts the source generator to a pipeline.
     * @returns The pipeline returned by the conversion.
     */
    public pipe<R>(conversion: Functional<SynchronousGenerator<E>, SynchronousSemantic<R>>): SynchronousSemantic<R>;
    /**
     * Lifts this collectable back into a lazy semantic pipeline.
     *
     * The conversion receives `source()` and builds the pipeline; nothing is
     * traversed until that pipeline is consumed. This is the bridge from the
     * buffered terminal API back to the lazy transformations of
     * `#semantic/synchronous/semantic`, and it needs only the generator, so it
     * introduces no runtime dependency on the pipeline class itself.
     *
     * Ordering: inherited from `source()`, so a buffered subclass keeps its
     * buffered order and indices.
     * Complexity: O(1) — only the generator is handed over; the evaluation cost
     * belongs to the returned pipeline.
     *
     * @template R - The element type of the converted pipeline.
     * @param conversion - Converts the source generator to a pipeline.
     * @returns The pipeline returned by the conversion.
     */
    public pipe<R = E>(conversion: Functional<SynchronousGenerator<E>, SynchronousSemantic<R>>): SynchronousSemantic<R> {
        return conversion(this.source());
    }
    /**
     * Reduces elements with an optional initial value and finisher.
     *
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns The result for the selected reduction overload.
     */
    public reduce(accumulator: BiFunctional<E, E, E>): E;
    /**
     * Reduces elements with an optional initial value and finisher.
     *
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns The result for the selected reduction overload.
     */
    public reduce(accumulator: TriFunctional<E, E, bigint, E>): E;
    /**
     * Reduces elements with an optional initial value and finisher.
     *
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns The result for the selected reduction overload.
     */
    public reduce(identity: E, accumulator: BiFunctional<E, E, E>): E;
    /**
     * Reduces elements with an optional initial value and finisher.
     *
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns The result for the selected reduction overload.
     */
    public reduce(identity: E, accumulator: TriFunctional<E, E, bigint, E>): E;
    /**
     * Reduces elements with an optional initial value and finisher.
     *
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns The result for the selected reduction overload.
     */
    public reduce<R>(identity: R, accumulator: BiFunctional<R, E, R>, finisher: Functional<R, R>): R;
    /**
     * Reduces elements with an optional initial value and finisher.
     *
     * @template R - The mapped or finished result type.
     * @param identity - Supplies a fresh accumulator, or provides an initial reduction value.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @param finisher - Converts the final accumulator to the result.
     * @returns The result for the selected reduction overload.
     */
    public reduce<R>(identity: R, accumulator: TriFunctional<R, E, bigint, R>, finisher: Functional<R, R>): R;
    /**
     * Reduces elements with an optional initial value and finisher.
     *
     * @template R - The mapped or finished result type.
     * @param argument1 - The first argument selected by the overload.
     * @param argument2 - The optional second argument selected by the overload.
     * @param argument3 - The optional third argument selected by the overload.
     * @returns The result for the selected reduction overload.
     */
    public reduce<R = E>(argument1?: R | E | BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E>, argument2?: BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E> | BiFunctional<R, E, R> | TriFunctional<R, E, bigint, R>, argument3?: Functional<R, R>): R {
        if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let accumulator = argument1 as BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E>;
                return useSynchronousReduce(accumulator).collect(this.source()) as R;
            }
            catch (error) {
                throw error;
            }
        }
        else if (validate(argument1) && isFunction(argument2) && invalidate(argument3)) {
            try {
                let identity = argument1 as E;
                let accumulator = argument2 as BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E>;
                return useSynchronousReduce(identity, accumulator).collect(this.source()) as unknown as R;
            }
            catch (error) {
                throw error;
            }
        }
        else if (validate(argument1) && isFunction(argument2) && isFunction(argument3)) {
            try {
                let identity = argument1 as R;
                let accumulator = argument2 as BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R>;
                let finisher = argument3 as Functional<R, R>;
                return useSynchronousReduce(identity, accumulator, finisher).collect(this.source());
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
     * An implementation pushes each element into `accept` together with its
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
    public abstract source(): SynchronousGenerator<E>;
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
    public generator(): SynchronousGenerator<E> {
        return this.source();
    }
    /**
     * Materialises the source into a new array in traversal order.
     *
     * The array is freshly allocated per call and is the basis of
     * `[Symbol.iterator]`, so the ordering decided here is the ordering observed
     * by `for...of` and by array destructuring.
     *
     * Ordering: exactly the order in which `source()` emits elements.
     * Complexity: O(n) time and O(n) additional memory.
     *
     * @template R - The element type of the finished array; defaults to the source element type.
     * @returns A new element array.
     */
    public toArray<R extends E = E>(): Array<R> {
        try {
            return useSynchronousToArray<E>().collect(this.source()) as unknown as Array<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects extracted keys and values; later duplicate keys replace earlier values.
     *
     * @template K - The extracted key type.
     * @template E - The source element type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @returns The resulting map.
     */
    public toMap<K, V = E>(keyExtractor: Functional<E, K>): Map<K, V>;
    /**
     * Collects extracted keys and values; later duplicate keys replace earlier values.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns The resulting map.
     */
    public toMap<K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): Map<K, V>;
    /**
     * Collects extracted keys and values; later duplicate keys replace earlier values.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns The resulting map.
     */
    public toMap<K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): Map<K, V>;
    /**
     * Collects extracted keys and values; later duplicate keys replace earlier values.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns The resulting map.
     */
    public toMap<K, V = E>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): Map<K, V> {
        try {
            return useSynchronousToMap<E, K, V>(keyExtractor, valueExtractor).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a Set using JavaScript value equality.
     *
     * @template R - The element type of the finished set; defaults to the source element type.
     * @returns The set of distinct elements.
     */
    public toSet<R extends E = E>(): Set<R> {
        try {
            return useSynchronousToSet<E>().collect(this.source()) as unknown as Set<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new synchronous ordered set.
     *
     * Every buffered element is offered to the `SynchronousOrderedSet`
     * constructor, so a duplicate the comparator considers equal collapses to the
     * first representative and the result is a mutable set owned by the caller.
     * Membership, removal, set algebra and hashing use the same comparator
     * equality as iteration.
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
     * @returns A new ordered set containing the distinct elements.
     * @throws {TypeError} If the comparator returns a non-finite number or does not compare a value equal to itself.
     */
    public toOrderedSet<R extends E = E>(comparator?: Comparator<E>): SynchronousOrderedSet<R> {
        try {
            return useSynchronousToOrderedSet<E>(comparator).collect(this.source()) as unknown as SynchronousOrderedSet<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new synchronous unordered set.
     *
     * Every buffered element is inserted into a `SynchronousUnorderedSet`, which
     * keeps elements distinct under SameValueZero: object identity is preserved
     * and `NaN` equals itself. The result is a mutable set owned by the caller
     * whose equality is independent of any comparator.
     *
     * Order semantics: iteration follows hash buckets derived from `useHash`, so
     * no iteration order is guaranteed and the traversal order of this source is
     * not preserved. Complexity: O(n) expected, because membership is
     * hash-bucketed.
     *
     * @template R - The element type of the finished set; defaults to the source element type.
     * @returns A new unordered set containing the distinct elements.
     */
    public toUnorderedSet<R extends E = E>(): SynchronousUnorderedSet<R> {
        try {
            return useSynchronousToUnorderedSet<E>().collect(this.source()) as unknown as SynchronousUnorderedSet<R>;
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
     * Order semantics: a `SynchronousOrderedMap` iterates in insertion order,
     * where the first occurrence of a key fixes its position and a later duplicate
     * replaces the value in place. Complexity: O(n) expected, because each pair is
     * placed in a hash-indexed insertion-order map.
     *
     * @template K - The extracted key type.
     * @template V - The stored value type; defaults to the source element type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @returns A new insertion-ordered map of elements.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public toOrderedMap<K, V = E>(keyExtractor: Functional<E, K>): SynchronousOrderedMap<K, V>;
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
     * @returns A new insertion-ordered map of values.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public toOrderedMap<K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousOrderedMap<K, V>;
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
     * @returns A new insertion-ordered map of values.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public toOrderedMap<K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): SynchronousOrderedMap<K, V>;
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
     * @returns A new insertion-ordered map of values.
     * @throws {TypeError} If a completed pair holds a nullish value.
     */
    public toOrderedMap<K, V = E>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): SynchronousOrderedMap<K, V> {
        try {
            return useSynchronousToOrderedMap<E, K, V>(keyExtractor, valueExtractor).collect(this.source());
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
     * Order semantics: a `SynchronousUnorderedMap` iterates in hash-bucket order,
     * so no iteration order is guaranteed and neither insertion order nor source
     * order is observable. Complexity: O(n) expected.
     *
     * @template K - The extracted key type.
     * @template V - The stored value type; defaults to the source element type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @returns A new unordered map of elements.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public toUnorderedMap<K, V = E>(keyExtractor: Functional<E, K>): SynchronousUnorderedMap<K, V>;
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
     * @returns A new unordered map of values.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public toUnorderedMap<K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousUnorderedMap<K, V>;
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
     * @returns A new unordered map of values.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public toUnorderedMap<K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): SynchronousUnorderedMap<K, V>;
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
     * @returns A new unordered map of values.
     * @throws {TypeError} If a completed pair holds a nullish value.
     */
    public toUnorderedMap<K, V = E>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): SynchronousUnorderedMap<K, V> {
        try {
            return useSynchronousToUnorderedMap<E, K, V>(keyExtractor, valueExtractor).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new synchronous positional list.
     *
     * Elements are appended in traversal order, duplicates are retained, and the
     * result is a mutable `SynchronousList` owned by the caller. Nullish elements
     * are rejected because a list position must hold a value.
     *
     * Order semantics: positions follow the traversal order of this source
     * exactly, because appending preserves encounter order. Complexity: O(n),
     * since appending at the end of the list is O(1) per element.
     *
     * @returns A new list containing every element in traversal order.
     * @throws {TypeError} If the source contains `null` or `undefined`.
     */
    public toList<R extends E = E>(): SynchronousList<R> {
        try {
            return useSynchronousToList<E>().collect(this.source()) as unknown as SynchronousList<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new synchronous cycle.
     *
     * Elements become the positions of a `SynchronousCycle`, a bounded positional
     * list whose head and tail nodes are joined so sampling wraps around the ring.
     * The result is mutable and owned by the caller.
     *
     * Order semantics: encounter order fixes ring positions, so position `i`
     * carries the `i`-th element modulo the size and a negative position walks the
     * ring backwards. `span` is the number of turns the ring occupies; the default
     * of one places elements on the n-th roots of unity, and a span that shares a
     * factor with the size collapses positions onto a shorter orbit. Complexity:
     * O(n), because each element is spliced into the ring once.
     *
     * @template R - The element type of the finished cycle; defaults to the source element type.
     * @param span - Turns occupied by the ring, a positive finite number; defaults to one.
     * @returns A new cycle over the elements in traversal order.
     * @throws {RangeError} If the span is not positive.
     * @throws {TypeError} If the span is not a finite number or the source contains `null` or `undefined`.
     */
    public toCycle<R extends E = E>(span?: number): SynchronousCycle<R> {
        try {
            return useSynchronousToCycle<E>(span).collect(this.source()) as unknown as SynchronousCycle<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new bounded synchronous LRU set.
     *
     * Elements are inserted in traversal order, and each insertion marks the
     * element most recently used; capacity pressure evicts the least recently used
     * elements, so only the last `capacity` distinct elements of the source
     * survive. The result is a mutable `SynchronousUnorderedLRUSet`, the unordered
     * root of the LRU set family.
     *
     * Order semantics: eviction follows access order rather than element order —
     * re-encountering an element refreshes its recency — while iteration order is
     * unspecified because this is the unordered LRU variant. Complexity: O(n)
     * expected for insertion, with each eviction scanning for the least recently
     * used element, so a build that evicts repeatedly is O(n^2) worst case.
     *
     * @template R - The element type of the finished set; defaults to the source element type.
     * @param capacity - The positive maximum number of elements to retain.
     * @returns A new bounded LRU set with at most `capacity` distinct elements.
     * @throws {RangeError} If the capacity is not a positive bigint.
     * @throws {TypeError} If the source contains `null` or `undefined`.
     */
    public toLRUSet<R extends E = E>(capacity: bigint): SynchronousUnorderedLRUSet<R> {
        try {
            return useSynchronousToLRUSet<E>(capacity).collect(this.source()) as unknown as SynchronousUnorderedLRUSet<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects extracted keys and values into a new bounded synchronous LRU map.
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
     * @returns A new bounded LRU map of elements.
     * @throws {RangeError} If the capacity is not a positive bigint.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public toLRUMap<K, V = E>(capacity: bigint, keyExtractor: Functional<E, K>): SynchronousUnorderedLRUMap<K, V>;
    /**
     * Collects extracted keys and values into a new bounded synchronous LRU map.
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
     * @returns A new bounded LRU map of values.
     * @throws {RangeError} If the capacity is not a positive bigint.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public toLRUMap<K, V>(capacity: bigint, keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousUnorderedLRUMap<K, V>;
    /**
     * Collects extracted keys and values into a new bounded synchronous LRU map.
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
     * @returns A new bounded LRU map of values.
     * @throws {RangeError} If the capacity is not a positive bigint.
     * @throws {TypeError} If a key maps to a nullish value.
     */
    public toLRUMap<K, V>(capacity: bigint, keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): SynchronousUnorderedLRUMap<K, V>;
    /**
     * Collects extracted keys and values into a new bounded synchronous LRU map.
     *
     * Every element contributes one pair; a later duplicate replaces the earlier
     * value and stored values must be non-null.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param capacity - The positive maximum number of mappings to retain.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @param valueExtractor - Extracts a value from each element and optional bigint index.
     * @returns A new bounded LRU map of values.
     * @throws {RangeError} If the capacity is not a positive bigint.
     * @throws {TypeError} If a completed pair holds a nullish value.
     */
    public toLRUMap<K, V = E>(capacity: bigint, keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): SynchronousUnorderedLRUMap<K, V> {
        try {
            return useSynchronousToLRUMap<E, K, V>(capacity, keyExtractor, valueExtractor).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new navigable synchronous skip set.
     *
     * Elements are inserted into a `SynchronousSkipSet`, which keeps them unique
     * under SameValueZero while navigating and iterating by the supplied total
     * order, so range views, `floor` and `ceiling` navigation and iteration agree
     * with the comparator. Nullish elements are rejected.
     *
     * Order semantics: iteration and navigation follow the comparator ascending,
     * and the comparator must compare equal exactly for SameValueZero-equal
     * elements. Complexity: draining the source is O(n); the runtime scans the
     * element array for duplicate detection, so a build is O(n^2) worst case and a
     * sorted snapshot read is O(n log n).
     *
     * @template R - The element type of the finished set; defaults to the source element type.
     * @param comparator - Total element order consistent with SameValueZero equality; defaults to the skip-set default order.
     * @returns A new navigable skip set containing the distinct elements.
     * @throws {TypeError} If the comparator disagrees with element equality or the source contains `null` or `undefined`.
     */
    public toSkipSet<R extends E = E>(comparator?: Comparator<E>): SynchronousSkipSet<R> {
        try {
            return useSynchronousToSkipSet<E>(comparator).collect(this.source()) as unknown as SynchronousSkipSet<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects extracted keys and values into a new navigable synchronous skip map.
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
     * @returns A new navigable skip map of elements.
     * @throws {TypeError} If a key is nullish or the default order cannot compare it.
     */
    public toSkipMap<K, V = E>(keyExtractor: Functional<E, K>): SynchronousSkipMap<K, V>;
    /**
     * Collects extracted keys and values into a new navigable synchronous skip map.
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
     * @returns A new navigable skip map of values.
     * @throws {TypeError} If a key is nullish or the default order cannot compare it.
     */
    public toSkipMap<K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousSkipMap<K, V>;
    /**
     * Collects extracted keys and values into a new navigable synchronous skip map.
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
     * @returns A new navigable skip map of values.
     * @throws {TypeError} If the comparator disagrees with key equality, a key or value is nullish, or an argument is not a function.
     */
    public toSkipMap<K, V>(comparator: Comparator<K>, keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousSkipMap<K, V>;
    /**
     * Collects extracted keys and values into a new navigable synchronous skip map.
     *
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param argument1 - The key extractor when used alone or with a value extractor, otherwise the comparator.
     * @param argument2 - The value extractor, or the key extractor when a comparator leads.
     * @param argument3 - The value extractor when a comparator and key extractor lead.
     * @returns A new navigable skip map over the extracted pairs.
     * @throws {TypeError} If the comparator disagrees with key equality, a key or value is nullish, or an argument is not a function.
     */
    public toSkipMap<K, V = E>(argument1: Comparator<K> | Functional<E, K>, argument2?: Functional<E, K> | Functional<E, V>, argument3?: Functional<E, V>): SynchronousSkipMap<K, V> {
        try {
            let second: Functional<E, K> | Functional<E, V> | undefined = typeof argument2 === "function" ? argument2 : undefined;
            let third: Functional<E, V> | undefined = typeof argument3 === "function" ? argument3 : undefined;
            let factory: (first: Comparator<K> | Functional<E, K>, second?: Functional<E, K> | Functional<E, V>, third?: Functional<E, V>) => SynchronousCollector<E, Array<[K, V]>, SynchronousSkipMap<K, V>> = useSynchronousToSkipMap as unknown as (first: Comparator<K> | Functional<E, K>, second?: Functional<E, K> | Functional<E, V>, third?: Functional<E, V>) => SynchronousCollector<E, Array<[K, V]>, SynchronousSkipMap<K, V>>;
            return factory(argument1, second, third).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new synchronous binary search tree.
     *
     * Buffered elements are sorted by the comparator and split at the midpoint
     * recursively, so the result is a height-balanced
     * `SynchronousBinarySearchTree` that retains duplicate elements with a stable
     * input order. Traversals expose nodes while collection queries expose
     * elements.
     *
     * Order semantics: tree order is comparator-ascending, so an in-order
     * traversal is nondecreasing rather than in traversal order, and the default
     * comparator only orders homogeneous numbers, strings, bigints and booleans.
     * Complexity: O(n log n), from sorting plus the midpoint split.
     *
     * @template R - The element type of the finished tree; defaults to the source element type.
     * @param comparator - Total element order; defaults to the scalar order of the tree builder.
     * @returns A new binary search tree over the elements.
     * @throws {TypeError} If the comparator returns a non-finite number, an element cannot be ordered, or the source contains `null` or `undefined`.
     */
    public toBinarySearchTree<R extends E = E>(comparator?: Comparator<E>): SynchronousBinarySearchTree<R> {
        try {
            return useSynchronousToBinarySearchTree<E>(comparator).collect(this.source()) as unknown as SynchronousBinarySearchTree<R>;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Collects elements into a new synchronous rooted forest.
     *
     * Elements are laid out by the forest builder as one rooted component whose
     * nodes keep source order, and the result exposes its roots through
     * `getRoots()`. Collection queries such as `size()` count elements across every
     * component, while traversals expose nodes.
     *
     * Order semantics: the default layout keeps encounter order as structural
     * order instead of sorting, so a parent precedes its children by stream
     * position; a multi-root forest cannot be expressed from a stream alone and
     * needs the constructor's `buildNodes` option. Complexity: O(n), including the
     * depth, height and subtree-size metadata of the default layout.
     *
     * @template R - The element type of the finished forest; defaults to the source element type.
     * @returns A new forest over the elements in traversal order.
     * @throws {TypeError} If the source contains `null` or `undefined`.
     */
    public toRootedForest<R extends E = E>(): SynchronousRootedForest<R> {
        try {
            return useSynchronousToRootedForest<E>().collect(this.source()) as unknown as SynchronousRootedForest<R>;
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
    public write<S = string>(stream: WritableStream<S>): Promise<WritableStream<S>>;
    /**
     * Chains stream accumulation, writing stringified elements when no accumulator is supplied.
     *
     * @template S - The stream chunk type.
     * @param stream - The writable stream passed through the collection.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns A promise resolving to the stream after accumulation completes.
     */
    public write<S = string>(stream: WritableStream<S>, accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>>): Promise<WritableStream<S>>;
    /**
     * Chains stream accumulation, writing stringified elements when no accumulator is supplied.
     *
     * @template S - The stream chunk type.
     * @param stream - The writable stream passed through the collection.
     * @param accumulator - Combines the accumulator with an element and optional bigint index.
     * @returns A promise resolving to the stream after accumulation completes.
     */
    public write<S = string>(stream: WritableStream<S>, accumulator: TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): Promise<WritableStream<S>>;
    /**
     * Chains stream accumulation, writing stringified elements when no accumulator is supplied.
     *
     * @template S - The stream chunk type.
     * @param argument1 - The first argument selected by the overload.
     * @param argument2 - The optional second argument selected by the overload.
     * @returns A promise resolving to the stream after accumulation completes.
     */
    public write<S = string>(argument1: WritableStream<S>, argument2?: BiFunctional<WritableStream<S>, E, WritableStream<S>> | TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): Promise<WritableStream<S>> {
        if (isObject(argument1)) {
            try {
                let stream: WritableStream<S> = argument1 as WritableStream<S>;
                if (isFunction(argument2)) {
                    let accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>> = argument2 as BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>;
                    return useSynchronousWrite(stream, accumulator).collect(this.source());
                }
                else {
                    return useSynchronousWrite(stream).collect(this.source());
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
 * A collectable that buffers the source and traverses it in sorted order.
 *
 * Construction drains the generator into an indexed buffer, then either sorts
 * by the supplied comparator or normalises every encounter index modulo the
 * buffer length and sorts by that index. Terminal operations therefore see a
 * fixed, replayable sequence, and `source()` reports the buffered index rather
 * than the original encounter index.
 *
 * Ordering semantics: with a comparator, iteration is comparator-ascending and
 * the reported index is the element position in that sorted order; without one,
 * iteration is ascending by normalised encounter index, so a reverse or shuffle
 * that rewrote indices is observable here.
 *
 * Complexity: construction is O(n log n) for the sort; `count`, `isEmpty` and
 * `source()` are O(1) to O(n) over the buffer, while inherited terminal
 * operations are O(n) plus their own documented cost.
 *
 * @template E - The source element type.
 */
export class OrderedCollectable<E> extends Collectable<E> {
    protected readonly OrderedCollectable: symbol = SynchronousOrderedCollectableSymbol;
    protected buffer: Array<Indexed<E>> = [];
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "SynchronousOrderedCollectable";
    /**
     * Drains the source into an indexed buffer and orders it by index.
     *
     * Every element is collected with its encounter index, the indices are
     * normalised modulo the buffer length (so negative and out-of-range indices
     * wrap), and the buffer is sorted ascending. The buffer is fixed at
     * construction; terminal operations replay it instead of the generator.
     *
     * Ordering: ascending normalised encounter index, which makes `reverse` and
     * `shuffle` index rewrites observable.
     * Complexity: O(n) buffering plus O(n log n) sorting.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: SynchronousGenerator<E>);
    /**
     * Drains the source into an indexed buffer and orders it by a comparator.
     *
     * The comparator decides the traversal order, and the buffered index is
     * reassigned to the element position in that sorted order, so every later
     * operation sees a contiguous, comparator-ascending sequence.
     *
     * Ordering: comparator-ascending; elements the comparator considers equal
     * keep their relative encounter order because the sort is stable.
     * Complexity: O(n) buffering plus O(n log n) sorting with the comparator.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: SynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param argument1 - The first argument selected by the overload.
     * @param argument2 - The optional second argument selected by the overload.
     */
    public constructor(argument1: SynchronousGenerator<E>, argument2?: Comparator<E>) {
        super();
        if (isFunction(argument1)) {
            try {
                let collector: SynchronousCollector<E, Array<Indexed<E>>, Array<Indexed<E>>> = useSynchronousToIndexedArray();
                let indexed: Array<Indexed<E>> = collector.collect(argument1);
                if (isFunction(argument2)) {
                    let comparator: Comparator<E> = argument2;
                    this.buffer = indexed.slice().sort((a: Indexed<E>, b: Indexed<E>): number => {
                        return comparator(a.element, b.element);
                    }).map((entry: Indexed<E>, index: number): Indexed<E> => {
                        return {
                            element: entry.element,
                            index: BigInt(index)
                        };
                    });
                }
                else {
                    let count: bigint = BigInt(indexed.length);
                    this.buffer = indexed.map((entry: Indexed<E>): Indexed<E> => {
                        return {
                            element: entry.element,
                            index: count === 0n ? entry.index : ((entry.index % count) + count) % count
                        };
                    }).sort((a: Indexed<E>, b: Indexed<E>): number => {
                        return Number(a.index - b.index);
                    });
                }
                Object.defineProperties(this, {
                    "SynchronousOrderedCollectable": {
                        value: SynchronousOrderedCollectableSymbol,
                        writable: false,
                        enumerable: false,
                        configurable: false
                    },
                    "buffer": {
                        value: this.buffer,
                        writable: false,
                        enumerable: false,
                        configurable: false
                    }
                });
            }
            catch (error) {
                throw new Error(`Uncaught error on creating buffer: ${String(error)}`);
            }
        }
        else {
            throw new TypeError("Source must be an iterable or a generator function.");
        }
    }
    /**
     * Iterates the buffered elements in sorted order.
     *
     * Because the buffer is built eagerly in the constructor, iteration is a
     * stable replay of the sorted sequence and never re-runs the source.
     *
     * Ordering: comparator order, or ascending normalised encounter index when no
     * comparator was supplied.
     * Complexity: O(n) time and O(1) extra memory over the existing buffer.
     *
     * @returns A generator over the buffered elements.
     */
    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let { element } of this.buffer) {
            yield element;
        }
    }
    /**
     * Evaluates the ordered-buffer all-match strategy, whose false initial accumulator is retained by each conjunction.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns False with the current ordered-buffer strategy, including for an empty buffer.
     */
    public override allMatch(predicate: Predicate<E>): boolean;
    /**
     * Evaluates the ordered-buffer all-match strategy, whose false initial accumulator is retained by each conjunction.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns False with the current ordered-buffer strategy, including for an empty buffer.
     */
    public override allMatch(predicate: BiPredicate<E, bigint>): boolean;
    /**
     * Evaluates the ordered-buffer all-match strategy, whose false initial accumulator is retained by each conjunction.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns False with the current ordered-buffer strategy, including for an empty buffer.
     */
    public override allMatch(predicate: Predicate<E> | BiPredicate<E, bigint>): boolean {
        let collector: SynchronousCollector<Indexed<E>, boolean, boolean> = SynchronousCollector.shortable((): boolean => false, (element: Indexed<E>, index: bigint, accumulator: boolean): boolean => predicate(element.element, index) && accumulator, (accumulator: boolean, element: Indexed<E>, index: bigint): boolean => predicate(element.element, index) && accumulator, (result: boolean): boolean => result);
        return collector.collect(this.buffer);
    }
    /**
     * Exposes a generator over the buffered elements and their sorted indices.
     *
     * Unlike the base contract this never touches the original generator again:
     * the constructor already drained it, so each call replays `buffer` and
     * reports the buffered index.
     *
     * Ordering: comparator order, or ascending normalised encounter index.
     * Complexity: O(n) per traversal and O(1) extra space.
     *
     * @returns The generator accepting element and interruption callbacks.
     */
    public override source(): SynchronousGenerator<E> {
        return (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            for (let { element, index } of this.buffer) {
                if (interrupt(element, index)) {
                    break;
                }
                accept(element, index);
            }
        };
    }
    /**
     * Checks whether the sorted buffer is empty.
     *
     * Ordering: irrelevant; emptiness is a property of the whole buffer.
     * Complexity: O(1).
     *
     * @returns Whether the buffered element count is zero.
     */
    public override isEmpty(): boolean {
        return this.buffer.length === 0;
    }
    /**
     * Counts the buffered elements.
     *
     * Ordering: irrelevant; the count covers the whole sorted buffer.
     * Complexity: O(1) — the buffer length is already known.
     *
     * @returns The buffered element count as a bigint.
     */
    public override count(): bigint {
        return BigInt(this.buffer.length);
    }
};

/**
 * A collectable that buffers by encounter index and traverses by insertion.
 *
 * Construction drains the generator into a `Map` keyed by the emitted index and
 * freezes that buffer. Because a `Map` keeps the first position of a key, a
 * repeated index would overwrite its value, so each duplicate is stored under a
 * surrogate key above `2 ** 96`; the original value survives in map insertion
 * order.
 *
 * Ordering semantics: iteration follows insertion order of the buffer, which is
 * the encounter order of first occurrence for each index. No comparator is
 * applied, so this class is the choice when the source order must be preserved
 * literally, duplicate indices included, and no ordering guarantee beyond that
 * insertion order should be inferred.
 *
 * Complexity: construction is O(n); iteration and `source()` are O(n);
 * inherited terminal operations are O(n) plus their own documented cost.
 *
 * @template E - The source element type.
 */
export class UnorderedCollectable<E> extends Collectable<E> {
    protected readonly SynchronousUnorderedCollectable: symbol = SynchronousUnorderedCollectableSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "SynchronousUnorderedCollectable";
    protected buffer: Map<bigint, E> = new Map<bigint, E>();
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: SynchronousGenerator<E>);
    /**
     * Drains the source into an index-keyed buffer at construction.
     *
     * Elements are stored in a `Map` under their emitted index. A repeated index
     * is moved above `2 ** 96` so it cannot overwrite an earlier value, and the
     * map is frozen once the source is exhausted, which makes terminal
     * operations read-only replays.
     *
     * Ordering: map insertion order, i.e. the encounter order of each index and
     * of its first duplicate; no comparator is involved.
     * Complexity: O(n) time and O(n) memory.
     *
     * @param argument1 - The callback-based source to consume.
     */
    public constructor(argument1: SynchronousGenerator<E>) {
        super();
        if (isFunction(argument1)) {
            let generator: SynchronousGenerator<E> = argument1;
            let surrogate: bigint = 0n;
            generator((element: E, index: bigint): void => {
                let key: bigint = this.buffer.has(index) ? SURROGATE_BASE + (surrogate++) : index;
                this.buffer.set(key, element);
            }, (): boolean => false);
            Object.freeze(this.buffer);
            Object.defineProperties(this, {
                "SynchronousUnorderedCollectable": {
                    value: SynchronousUnorderedCollectableSymbol,
                    writable: false,
                    enumerable: false,
                    configurable: false
                }
            });
        }
        else {
            throw new TypeError("Source must be an iterable or a generator function.");
        }
    }
    /**
     * Iterates the buffered values in map insertion order.
     *
     * Keys are discarded, so the surrogate keys that keep duplicate-index
     * elements alive never surface to consumers.
     *
     * Ordering: insertion order of the buffer, including relocated duplicates.
     * Complexity: O(n) time and O(1) extra memory over the existing buffer.
     *
     * @returns A generator over the buffered elements.
     */
    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let [_index, element] of this.buffer) {
            yield element;
        }
    }
    /**
     * Exposes a generator over the buffered pairs.
     *
     * Each buffered key, surrogate derived keys included, is reported as the
     * element index; consumers that care about indices can therefore observe the
     * relocated duplicate keys.
     *
     * Ordering: map insertion order, which is encounter order for first
     * occurrences.
     * Complexity: O(n) per traversal and O(1) extra space.
     *
     * @returns The generator accepting element and interruption callbacks.
     */
    public override source(): SynchronousGenerator<E> {
        return (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            for (let [_index, element] of this.buffer) {
                if (interrupt(element, _index)) {
                    break;
                }
                accept(element, _index);
            }
        };
    }
};


/**
 * A real-valued signal bound to its sampling plan and its analysis window.
 *
 * The class is a thin, ordered collectable over the samples that also carries the
 * two pieces of context every spectral formula needs: the sampling rate, which
 * turns bin indices into hertz, and the taper, which decides both the coherent gain
 * and the equivalent noise bandwidth. Keeping them on the value object is the whole
 * point — a caller who has to remember "divide by the coherent gain" will
 * eventually forget, and the resulting 6.02 decibel error looks like a plausible
 * measurement.
 *
 * Two conventions are fixed and documented because they are the ones that cause
 * silent errors elsewhere in the wild:
 *
 * - A *one-sided* fold keeps DC and Nyquist un-doubled. They are self-conjugate and
 *   have no mirror partner, so doubling them invents energy.
 * - A *peak* power is not a *density*. `power()` reports the mean square a sinusoid
 *   on that bin would have, and sums to the equivalent noise bandwidth times the
 *   mean square; `powerSpectralDensity()` reports a density and integrates to the
 *   mean square itself.
 *
 * Every analysis method delegates to exactly one `useSynchronous<Method>` factory
 * from `#semantic/synchronous/collectors`, and the factory owns the accumulation.
 * The constructor-time metadata accessors only read the frozen state of the
 * instance in constant time and therefore have no strategy to select.
 *
 * Complexity: construction buffers and sorts O(n) samples; every analysis method
 * documents its own bound and is at least O(n).
 *
 * @template E - The element type, constrained to `number` so that the spectral
 *               formulas are total.
 */
export class SignalCollectable<E extends number> extends OrderedCollectable<E> {

    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "SynchronousSignalCollectable";
    /**
     * The sampling plan that fixes the rate and the covered duration.
     */
    private readonly plan: Sample;
    /**
     * The samples, in acquisition order and frozen after construction.
     */
    private readonly values: ReadonlyArray<E>;
    /**
     * The taper applied by every spectral method that does not override it.
     */
    private readonly taper: SpectralWindow;
    /**
     * The coherent gain of `taper` at this length, recomputed per instance.
     */
    private readonly coherent: number;
    /**
     * The equivalent noise bandwidth of `taper` at this length, in bins.
     */
    private readonly bandwidth: number;

    /**
     * Buffers a value sequence under a sampling plan and an analysis window.
     *
     * The samples are copied and validated before the ordered buffer is built, so a
     * rejected sample leaves no partially constructed instance behind. The coherent
     * gain and the equivalent noise bandwidth of the window are computed once, at
     * this exact length, and reused by every later call; recomputing them per call
     * would be correct but would also invite the assumption that they are constants,
     * which they are not.
     *
     * @param plan - the sampling plan; its frame count must equal the sample count.
     * @param values - the samples, at least one, every one a finite number.
     * @param window - the analysis taper; defaults to the periodic Hann window.
     * @throws {TypeError} if the plan is not a `Sample`, a sample is not a finite
     *         number, or the window is not callable.
     * @throws {RangeError} if the samples are empty, their count differs from the
     *         plan's frame count, or the window weights sum to zero.
     */
    public constructor(plan: Sample, values: Iterable<E>, window?: SpectralWindow) {
        const collected: Array<E> = requireSignalValues<E>(values);
        super(sequenceGenerator<E>(collected));
        if (!(plan instanceof Sample)) {
            throw new TypeError("Signal plan must be a Sample.");
        }
        if (plan.getCount() !== collected.length) {
            throw new RangeError("Signal plan frame count must match the signal length.");
        }
        const taper: SpectralWindow = resolveWindow(window);
        this.plan = plan;
        this.values = Object.freeze(collected);
        this.taper = taper;
        this.coherent = coherentGain(taper, collected.length);
        this.bandwidth = equivalentNoiseBandwidth(taper, collected.length);
    }

    /**
     * Creates a signal from samples and a sampling rate.
     *
     * The covered duration is derived as `count / rate`, so the plan's last sample
     * starts one sampling interval before the end. At least one sample is required,
     * and the rate is validated before the samples are read, so an invalid rate is
     * reported without consuming the source.
     *
     * @param values - the samples, at least one.
     * @param rate - the sampling rate in hertz, positive and finite.
     * @param window - the analysis taper; defaults to the periodic Hann window.
     * @returns a new signal over the samples.
     * @throws {TypeError} if the rate is not a finite number, a sample is not finite,
     *         or the window is not callable.
     * @throws {RangeError} if the rate is not positive, the samples are empty, or the
     *         window weights sum to zero.
     */
    public static useRate<E extends number>(values: Iterable<E>, rate: number, window?: SpectralWindow): SignalCollectable<E> {
        if (!isNumber(rate)) {
            throw new TypeError("Signal rate must be a finite number.");
        }
        if (rate <= 0) {
            throw new RangeError("Signal rate must be positive.");
        }
        const collected: Array<E> = requireSignalValues<E>(values);
        return new SignalCollectable<E>(new Sample(collected.length, collected.length / rate), collected, window);
    }

    /**
     * Creates a signal from an existing frame.
     *
     * The frame contributes both its samples and its sampling plan, so the rate and
     * the covered duration are preserved exactly. The frame itself is not modified.
     *
     * @param frame - the frame to reinterpret as a signal, holding at least one
     *        sample.
     * @param window - the analysis taper; defaults to the periodic Hann window.
     * @returns a new signal over the frame's samples.
     * @throws {TypeError} if the argument is not a `Frame`, or the window is not
     *         callable.
     * @throws {RangeError} if the window weights sum to zero.
     */
    public static useFrame(frame: Frame, window?: SpectralWindow): SignalCollectable<number> {
        if (!(frame instanceof Frame)) {
            throw new TypeError("Signal frame must be a Frame.");
        }
        return new SignalCollectable<number>(frame.getSample(), frame.getValues(), window);
    }

    /**
     * Returns the sampling plan of this signal.
     *
     * @returns the retained plan, not a copy.
     */
    public getSample(): Sample {
        return this.plan;
    }

    /**
     * Returns the samples in acquisition order.
     *
     * @returns the frozen sample array, whose length equals `size()`.
     */
    public getValues(): ReadonlyArray<E> {
        return this.values;
    }

    /**
     * Returns the analysis window configured for this signal.
     *
     * @returns the taper applied by default.
     */
    public getWindow(): SpectralWindow {
        return this.taper;
    }

    /**
     * Returns the coherent gain of the configured window at this length.
     *
     * The value is `sum(w) / count`, the factor by which a sinusoid's spectral line
     * is scaled by the taper. It is recomputed for this instance rather than assumed,
     * because a symmetric window deviates from its closed-form value at short lengths
     * and a custom window has no closed form at all.
     *
     * @returns the mean window weight, dimensionless.
     */
    public getCoherentGain(): number {
        return this.coherent;
    }

    /**
     * Returns the equivalent noise bandwidth of the configured window, in bins.
     *
     * The value is `count * sum(w^2) / sum(w)^2`, the width of the rectangular window
     * that would admit the same white-noise power. It is what a sum of
     * peak-convention bin powers exceeds the mean square by.
     *
     * @returns the noise bandwidth in bins, dimensionless and at least one.
     */
    public getNoiseBandwidth(): number {
        return this.bandwidth;
    }

    /**
     * Returns the number of samples.
     *
     * @returns the sample count as a `bigint`, matching the collectable layer.
     */
    public size(): bigint {
        return BigInt(this.values.length);
    }

    /**
     * Returns one sample by index.
     *
     * The index must be a `bigint` but need not lie inside the signal: a negative
     * index or one at or beyond `size()` yields an empty `Optional` rather than an
     * exception.
     *
     * @param index - the zero-based sample index.
     * @returns the sample in an `Optional`.
     * @throws {TypeError} if the index is not a `bigint`.
     */
    public at(index: bigint): Optional<E> {
        if (!isBigInt(index)) {
            throw new TypeError("Signal index must be a bigint.");
        }
        if (index < 0n || index >= BigInt(this.values.length)) {
            return Optional.empty();
        }
        return Optional.of(this.values[Number(index)]);
    }

    /**
     * Returns the sampling rate in hertz.
     *
     * @returns the rate that converts a bin index into a frequency.
     */
    public getRate(): number {
        return this.plan.getRate();
    }

    /**
     * Returns the Nyquist frequency, half the sampling rate.
     *
     * @returns the highest frequency a one-sided spectrum can describe.
     */
    public getNyquist(): Frequency {
        return new Frequency(this.plan.getRate() / 2);
    }

    /**
     * Returns the spacing between adjacent transform bins.
     *
     * The value is `rate / count`, the grid resolution. It is not the resolving
     * power: two components closer than about one bin of a rectangular window, or
     * one and a half bins of a Hann window, remain merged no matter how the transform
     * is padded.
     *
     * @returns the bin spacing in hertz.
     */
    public getResolution(): Frequency {
        return new Frequency(this.plan.getRate() / this.values.length);
    }

    /**
     * Converts this signal to a plain frame over the same plan.
     *
     * The frame copies the samples, so mutating the returned frame's source array
     * cannot affect this signal; the two objects share only the immutable plan.
     *
     * @returns a new frame holding the same samples under the same plan.
     */
    public toFrame(): Frame {
        return new Frame(this.plan, this.values);
    }

    /**
     * Compares this signal with another value by value.
     *
     * Two signals are equal when their plans match and every sample agrees within the
     * tolerance. The window is compared by identity, because two distinct window
     * functions are not comparable without evaluating them.
     *
     * @param other - the signal to compare with.
     * @param epsilon - the absolute tolerance applied to the samples, and `1E-9` by
     *        default.
     * @returns whether the two signals are indistinguishable.
     * @throws {TypeError} if the argument is not a `SignalCollectable`, or the
     *         tolerance is not a finite number.
     * @throws {RangeError} if the tolerance is negative.
     */
    public equals(other: SignalCollectable<E>, epsilon: number = Tolerance): boolean {
        if (!(other instanceof SignalCollectable)) {
            throw new TypeError("Signal comparison requires a SignalCollectable.");
        }
        if (!isNumber(epsilon)) {
            throw new TypeError("Signal tolerance must be a finite number.");
        }
        if (epsilon < 0) {
            throw new RangeError("Signal tolerance must not be negative.");
        }
        if (!this.plan.equals(other.plan) || this.taper !== other.taper) {
            return false;
        }
        if (this.values.length !== other.values.length) {
            return false;
        }
        for (let index: number = 0; index < this.values.length; index += 1) {
            if (Math.abs(this.values[index] - other.values[index]) > epsilon) {
                return false;
            }
        }
        return true;
    }

    /**
     * Returns a short, stable description of this signal.
     *
     * @returns a description naming the sample count, the rate and the window.
     */
    public toString(): string {
        const label: string = this.taper === useHannPeriodicWindow ? "hann-periodic" : this.taper === useRectangularWindow ? "rectangular" : "custom";
        return `SynchronousSignalCollectable(size=${this.values.length}, rate=${this.plan.getRate()}, window=${label})`;
    }

    /**
     * Removes a trend from this signal and returns the result as a new signal.
     *
     * A constant offset leaks into the low bins of a windowed transform and a drift
     * smears the whole low band, so both are usually removed before a density
     * estimate. `"constant"` subtracts the mean and `"linear"` subtracts the
     * least-squares line; `"none"` is the identity. The plan, the rate and the window
     * are preserved, so the result is the same signal with different samples.
     *
     * @param mode - the trend to remove; defaults to `"constant"`.
     * @returns a new signal over the detrended samples, typed over `number`
     *          because a detrended sample is an arbitrary real value rather than
     *          a member of a narrower numeric domain.
     * @throws {TypeError} if the mode is not one of the three supported names.
     */
    public detrended(mode: DetrendMode = "constant"): SignalCollectable<number> {
        return useSynchronousDetrended<E>(this.plan, this.taper, mode).collect(this.source());
    }

    /**
     * Weights every sample by a window and returns the result as a new signal.
     *
     * The window becomes the analysis window of the result as well, so a later
     * spectral call does not apply it a second time unless it is asked to. Passing a
     * different window re-tapers an already tapered signal, which is occasionally
     * what a cross-fade wants and is otherwise a mistake worth making explicit.
     *
     * @param window - the taper to apply; defaults to the window of this signal.
     * @returns a new signal over the weighted samples, typed over `number`
     *          because a weight is an arbitrary real value.
     * @throws {TypeError} if the window is not callable.
     * @throws {RangeError} if a window weight is not finite.
     */
    public windowed(window?: SpectralWindow): SignalCollectable<number> {
        return useSynchronousWindowed<E>(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the complex spectrum of this signal.
     *
     * The signal is tapered, optionally zero-padded and then transformed, so the
     * coefficients are raw and unnormalised: their magnitude grows with the transform
     * length and with the window. Use `amplitude()` or `power()` for calibrated
     * values, and `oneSided()` for the folded view.
     *
     * The returned `Spectrum` keeps the full complex grid, because its constructor
     * derives each bin frequency from the bin position over the plan's frame count: a
     * one-sided fold has half as many bins and would report every frequency at twice
     * its true value. The fold itself is available through {@link oneSided}, which is
     * the only place the DC and Nyquist rule is applied.
     *
     * Padding does not improve resolution. A transform length above the sample count
     * samples the same windowed DTFT more densely, which sharpens the peak *location*
     * and turns `rate / size` into the bin spacing; the ability to separate two
     * components stays governed by the window length and shape. Two equal tones `0.4`
     * bins apart stay merged at any padding: with a 256-point record and a Hann
     * window, padding to 8192 produces two local maxima whose dip is only 0.79
     * decibels, far too shallow to call them resolved.
     *
     * @param size - the transform length in samples, at least the sample count;
     *        defaults to the sample count, which means no padding.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the spectrum over `size` bins.
     * @throws {TypeError} if the length is not a `bigint` or does not fit a safe
     *         integer, or the window is not callable.
     * @throws {RangeError} if the length is below the sample count, which would
     *         truncate the observation.
     */
    public spectrum(size?: bigint, window?: SpectralWindow): Spectrum {
        const length: bigint = size === undefined ? BigInt(this.values.length) : size;
        return useSynchronousSpectrum(this.plan, requireCount(length, "Spectrum transform length"), window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the one-sided bins of this signal, with DC and Nyquist un-doubled.
     *
     * A real signal satisfies `X[count - k] = conj(X[k])`, so the negative frequencies
     * carry no independent information and are folded onto the positive half by
     * doubling every interior bin. The constant bin and, for an even length, the
     * Nyquist bin are self-conjugate: they are their own mirror, so doubling them
     * would report four instead of two at DC for `2 + cos(PI * n)` and two instead of
     * one at Nyquist, exactly 6.02 decibels too high in each case. Those two bins are
     * therefore kept exactly as the transform produced them.
     *
     * The returned amplitudes are still raw, so the doubling is a fold and not a
     * calibration; use `amplitude()` for calibrated values.
     *
     * @param size - the transform length in samples, at least the sample count;
     *        defaults to the sample count.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the bins from zero hertz through the top of the lower half.
     * @throws {TypeError} if the length or the window is invalid.
     * @throws {RangeError} if the length would truncate the signal.
     */
    public oneSided(size?: bigint, window?: SpectralWindow): Array<Bin> {
        const length: bigint = size === undefined ? BigInt(this.values.length) : size;
        return useSynchronousOneSided(this.plan, requireCount(length, "Spectrum transform length"), window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the calibrated one-sided amplitudes of this signal.
     *
     * The estimate is `2 * |X[k]| / (count * CG)` for an interior bin and
     * `|X[k]| / (count * CG)` for DC and Nyquist. Both corrections matter: an interior
     * tone at unit amplitude reads `0.5` without the factor of two and `0.5` again
     * without the gain correction, so omitting either reports minus 6.02 decibels.
     * The gain itself is never assumed to be one half; it is recomputed from the
     * actual window vector.
     *
     * The value is a narrow-band measurement. A broadband noise floor has no
     * amplitude, and its level belongs in `powerSpectralDensity()`.
     *
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns one amplitude per one-sided bin, in units of the samples.
     * @throws {TypeError} if the window is not callable.
     * @throws {RangeError} if the window weights sum to zero.
     */
    public amplitude(window?: SpectralWindow): Array<number> {
        return useSynchronousAmplitude(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the one-sided power of this signal, with DC and Nyquist un-doubled.
     *
     * An interior bin reports `A[k]^2 / 2`, the mean square of a sinusoid of
     * amplitude `A[k]`, and DC or Nyquist report `A[k]^2` because they do not
     * oscillate. This is the peak convention: each bin answers "what mean square
     * would a tone on this bin have". It is not the Parseval convention — a window
     * spreads each line over its main lobe, so summing every bin over-counts by the
     * equivalent noise bandwidth, which is 1.5 for Hann — and the total power
     * question belongs to `powerSpectralDensity()`.
     *
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns one power per one-sided bin, in squared units of the samples.
     * @throws {TypeError} if the window is not callable.
     * @throws {RangeError} if the window weights sum to zero.
     */
    public power(window?: SpectralWindow): Array<number> {
        return useSynchronousPower(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the amplitude levels of the one-sided bins in decibels.
     *
     * The conversion is `20 * log10(amplitude)`, the amplitude convention. It is
     * correct for an amplitude, a voltage, a displacement or a sound pressure, and
     * wrong for a power or a density: quartering a power is minus 6.02 decibels but
     * reads minus 12.04 under this convention. Use {@link powerDecibel} for those. A
     * silent bin reports negative infinity.
     *
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns one level per one-sided bin, in decibels relative to one.
     * @throws {TypeError} if the window is not callable.
     * @throws {RangeError} if the window weights sum to zero.
     */
    public decibel(window?: SpectralWindow): Array<number> {
        return useSynchronousDecibel(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the power levels of the one-sided bins in decibels.
     *
     * The conversion is `10 * log10(power)`, the power convention, and it is the only
     * correct choice for a power, an energy, a mean square or a density. The two
     * conventions agree only through the square relation between their quantities, so
     * a power of one quarter reports minus 6.02 decibels here and would report minus
     * 12.04 under {@link decibel}. A silent bin reports negative infinity.
     *
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns one level per one-sided bin, in decibels relative to one.
     * @throws {TypeError} if the window is not callable.
     * @throws {RangeError} if the window weights sum to zero.
     */
    public powerDecibel(window?: SpectralWindow): Array<number> {
        return useSynchronousPowerDecibel(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Estimates the one-sided power spectral density of this signal by Welch's
     * method.
     *
     * The record is cut into overlapping segments, each segment is detrended,
     * weighted and transformed, and the periodograms are averaged. The normalisation
     * is `|X|^2 / (rate * sum(w^2))` with the interior bins doubled and DC and
     * Nyquist not, which is the only divisor that keeps a white-noise floor unbiased:
     * dividing by the segment length reads `0.375` for unit noise instead of `1.0`,
     * and dividing by `count * CG^2` reads `1.5`.
     *
     * Averaging is what makes the estimate usable. A single periodogram is unbiased
     * but inconsistent — its variance does not shrink as the record grows — so `M`
     * segments buy roughly `1 / M` of the variance at the cost of a coarser
     * resolution, because each segment is `M` times shorter. An estimate reporting a
     * single segment is therefore valid but noisy, and the segment count is part of
     * the result rather than a hidden detail.
     *
     * @param frameSize - the segment length in samples; defaults to the smaller of
     *        256 and the sample count.
     * @param hopSize - the samples between segment starts; defaults to half a segment,
     *        rounded down.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the averaged one-sided density.
     * @throws {TypeError} if a length is not a `bigint` or does not fit a safe
     *         integer, or the window is not callable.
     * @throws {RangeError} if the segment exceeds the signal, the hop exceeds the
     *         segment, or the window weights are all zero.
     */
    public powerSpectralDensity(frameSize?: bigint, hopSize?: bigint, window?: SpectralWindow): SpectralDensity {
        const length: number = this.values.length;
        const segment: bigint = frameSize === undefined ? BigInt(Math.min(DefaultFrameSize, length)) : frameSize;
        const resolved: number = requireCount(segment, "Density segment length");
        const rawHop: bigint = hopSize === undefined ? BigInt(Math.max(1, Math.floor(resolved / 2))) : hopSize;
        const step: number = requireCount(rawHop, "Density hop size");
        return useSynchronousPowerSpectralDensity(this.plan, resolved, step, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the short-time Fourier transform of this signal.
     *
     * The signal is extended by half a frame at each end and padded at the tail, so
     * the first frame is centred on the first sample, the last frame reaches the last
     * sample and no sample is lost. Retaining only complete frames instead discards up
     * to `frameSize - 1` samples: for 1000 samples with a frame of 256 and a hop of
     * 128 that is 232 samples, nearly a quarter of the record.
     *
     * Frame centres lie at `m * hopSize / rate` seconds on the original axis, which is
     * the convention `Spectrogram.getTime` reports. Every column is a raw `Spectrum`
     * over `frameSize` bins, exactly as `spectrum()` would produce for the same frame.
     *
     * @param frameSize - the frame length in samples, at most the sample count.
     * @param hopSize - the samples between frame starts, at most the frame length.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns one spectrum per frame, in centre-time order.
     * @throws {TypeError} if a length is not a `bigint` or does not fit a safe
     *         integer, or the window is not callable.
     * @throws {RangeError} if the frame exceeds the signal, the hop exceeds the frame,
     *         or the framing yields no frame.
     */
    public shortTimeFourierTransform(frameSize: bigint, hopSize: bigint, window?: SpectralWindow): Array<Spectrum> {
        const size: number = requireCount(frameSize, "Short-time frame size");
        const step: number = requireCount(hopSize, "Short-time hop size");
        return useSynchronousShortTimeFourierTransform(this.plan, size, step, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the time-frequency view of this signal.
     *
     * The columns are exactly the spectra of `shortTimeFourierTransform` with the same
     * framing, and the view retains the hop, the taper and the zero boundary so that
     * it can report frame centre times and trim the extension when it rebuilds a
     * frame. The default taper is the periodic Hann window, which satisfies the
     * constant-overlap-add condition at fifty percent overlap; the symmetric form of
     * the same window does not, and ripples by 0.84 decibels at sixteen samples, 0.21
     * at sixty-four and 0.013 at one thousand and twenty-four. That difference never
     * raises an error, it only modulates the reconstruction.
     *
     * @param frameSize - the frame length in samples, at most the sample count.
     * @param hopSize - the samples between frame starts, at most the frame length.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the time-frequency view of this signal.
     * @throws {TypeError} if a length or the window is invalid.
     * @throws {RangeError} if the framed columns cannot be built.
     */
    public spectrogram(frameSize: bigint, hopSize: bigint, window?: SpectralWindow): Spectrogram {
        const size: number = requireCount(frameSize, "Spectrogram frame size");
        const step: number = requireCount(hopSize, "Spectrogram hop size");
        return useSynchronousSpectrogram(this.plan, size, step, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the analytic signal of this signal.
     *
     * The negative-frequency half of the transform is cleared and the positive half is
     * doubled, so the inverse yields `x[n] + i * H(x)[n]`. The real part recovers the
     * samples and the modulus is the envelope; the argument is the instantaneous
     * phase. Because the transform is circular, the first and last samples of a record
     * whose period does not divide its length are contaminated by the wrap-around: a
     * tone of 8.3 cycles over 512 samples has a middle envelope within 0.2 percent of
     * the truth and last-eight-sample errors of up to 87 percent. Mirror-pad before
     * analysis or discard the ends.
     *
     * @returns one analytic sample per input sample, in order.
     */
    public analyticSignal(): Array<Complex> {
        return useSynchronousAnalyticSignal(this.plan).collect(this.source());
    }

    /**
     * Returns the instantaneous phase of this signal in radians.
     *
     * Each analytic sample is mapped to its argument, normalised into `[0, 2 * PI)`.
     * The phase is folded into one turn, so it jumps by a full turn once per cycle;
     * the instantaneous frequency below unwraps it before differentiating.
     *
     * @returns one radian phase per sample.
     */
    public instantaneousPhase(): Array<Angle> {
        return useSynchronousInstantaneousPhase(this.plan).collect(this.source());
    }

    /**
     * Returns the instantaneous envelope of this signal.
     *
     * The envelope is `|z[n]|`, which is a constant `A` for `A * cos(w * t + p)`. It
     * inherits the circular edge behaviour of the Hilbert transform, so the two ends of
     * a non-integer-periodic record are the least trustworthy samples.
     *
     * @returns one non-negative amplitude per sample, in units of the samples.
     */
    public envelope(): Array<number> {
        return useSynchronousEnvelope(this.plan).collect(this.source());
    }

    /**
     * Returns the instantaneous frequency of this signal in hertz.
     *
     * The unwrapped analytic phase is differentiated by a forward difference and
     * scaled by `rate / (2 * PI)`. The first sample has no predecessor and reports
     * zero.
     *
     * The envelope gate is not optional in practice. Where the envelope vanishes the
     * phase is undefined and the difference of two rounding-noise angles can reach
     * half a turn, which reads as half the sampling rate: two equal tones at 100 and
     * 102 hertz sampled at 2048 hertz drop to an envelope of `1.2e-14` at their beat
     * nodes and report 932 hertz out of a possible 1024. Every sample whose envelope,
     * or whose predecessor's envelope, falls below `gate` times the peak therefore
     * reports zero instead of that artefact.
     *
     * @param rate - the sampling rate in hertz used to scale the phase step; defaults
     *        to the rate of this signal.
     * @param gate - the envelope threshold as a fraction of the peak envelope, within
     *        `[0, 1]`; defaults to `1E-3`.
     * @returns one frequency in hertz per sample, whose first entry is zero.
     * @throws {TypeError} if the rate or the gate is not a finite number.
     * @throws {RangeError} if the rate is not positive, or the gate lies outside
     *         `[0, 1]`.
     */
    public instantaneousFrequency(rate?: number, gate?: number): Array<number> {
        const resolved: number = rate === undefined ? this.plan.getRate() : rate;
        const threshold: number = gate === undefined ? DefaultEnvelopeGate : gate;
        return useSynchronousInstantaneousFrequency(this.plan, resolved, threshold).collect(this.source());
    }

    /**
     * Returns the zero-crossing rate of this signal.
     *
     * The rate is the fraction of adjacent sample pairs with strictly opposite signs,
     * that is the crossing count divided by `count - 1`. A sine of `f` hertz sampled
     * at `rate` hertz reads `2 * f / rate`, and a signal that alternates on every
     * sample reads one, the maximum. The absolute difference of the sign function that
     * some texts use counts two per crossing and must be halved before dividing, which
     * is the same quantity; this module reports the crossing count rather than twice
     * it.
     *
     * This is a rate, not a count. `Frame.zeroCrossings` returns an integer, which
     * cannot be compared across record lengths.
     *
     * @param perSecond - whether to report crossings per second rather than per sample;
     *        defaults to `false`.
     * @returns the zero-crossing rate, zero for a one-sample signal.
     * @throws {TypeError} if the flag is not a boolean.
     */
    public zeroCrossingRate(perSecond: boolean = false): number {
        return useSynchronousZeroCrossingRate(this.plan, perSecond).collect(this.source());
    }

    /**
     * Returns the spectral flux of this signal, one value per frame transition.
     *
     * Each frame's one-sided magnitude spectrum is scaled to unit Euclidean norm and
     * compared with the previous frame by the Euclidean distance of the two normalised
     * vectors. Normalising first makes the value a statement about spectral shape
     * rather than loudness: two frames of different level but the same spectrum
     * produce zero flux. The result holds `frames - 1` values and is empty when the
     * framing yields a single frame.
     *
     * @param frameSize - the frame length in samples; defaults to the smaller of 256
     *        and the sample count.
     * @param hopSize - the samples between frame starts; defaults to half a frame.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns one flux value per adjacent frame pair, in frame order.
     * @throws {TypeError} if a length or the window is invalid.
     * @throws {RangeError} if the framed columns cannot be built.
     */
    public spectralFlux(frameSize?: bigint, hopSize?: bigint, window?: SpectralWindow): Array<number> {
        const length: number = this.values.length;
        const segment: bigint = frameSize === undefined ? BigInt(Math.min(DefaultFrameSize, length)) : frameSize;
        const resolved: number = requireCount(segment, "Spectral flux frame size");
        const rawHop: bigint = hopSize === undefined ? BigInt(Math.max(1, Math.floor(resolved / 2))) : hopSize;
        const step: number = requireCount(rawHop, "Spectral flux hop size");
        return useSynchronousSpectralFlux(this.plan, resolved, step, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the normalised auto-correlation of this signal.
     *
     * The raw estimate `r[k] = sum(x[n] * x[n + k])` grows linearly with the record
     * length, so comparing two lengths by the raw peak is meaningless: the same tone
     * in a record twice as long reports a peak twice as large. The default
     * normalisation therefore divides by `r[0]`, which makes `rho[0]` exactly one and
     * every value lie in `[-1, 1]`. The `"unbiased"` rule divides by `count - k`
     * instead, removing the triangular taper at the cost of a variance that grows with
     * the lag. A periodic component peaks at its own period; the biased peak is
     * slightly below one, so a tone of period 128 in a record of 1024 reads `0.875` at
     * lag 128 and `-0.9375` at lag 64.
     *
     * @param maximumLag - the largest lag to report, at most `size - 1`; defaults to
     *        `size - 1`.
     * @param normalization - the normalisation rule; defaults to `"coefficient"`.
     * @returns one value per lag from zero through `maximumLag`.
     * @throws {TypeError} if the lag is not a `bigint` or the rule is not a supported
     *         name.
     * @throws {RangeError} if the lag is negative or not below the sample count.
     */
    public autocorrelation(maximumLag?: bigint, normalization: CorrelationNormalization = "coefficient"): Array<number> {
        const limit: bigint = maximumLag === undefined ? BigInt(this.values.length - 1) : maximumLag;
        if (!isBigInt(limit)) {
            throw new TypeError("Autocorrelation maximum lag must be a bigint.");
        }
        if (limit < 0n) {
            throw new RangeError("Autocorrelation maximum lag must not be negative.");
        }
        if (limit >= BigInt(this.values.length)) {
            throw new RangeError("Autocorrelation maximum lag must be below the signal length.");
        }
        if (limit > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new TypeError("Autocorrelation maximum lag must fit a safe integer.");
        }
        return useSynchronousAutocorrelation(this.plan, Number(limit), normalization).collect(this.source());
    }

    /**
     * Returns the power-weighted centroid of the one-sided spectrum in hertz.
     *
     * The centroid is `sum(f[k] * p[k]) / sum(p[k])` with `p[k] = |X[k]|^2`, the centre
     * of mass of the spectral power. A pure tone reports its own frequency; a
     * broadband record reports the middle of its band. The value is empty for a silent
     * signal, which has no centre of mass.
     *
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the centroid in hertz in an `Optional`.
     * @throws {TypeError} if the window is not callable.
     */
    public spectralCentroid(window?: SpectralWindow): Optional<Frequency> {
        return useSynchronousSpectralCentroid(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the power-weighted spectral bandwidth in hertz.
     *
     * The value is the standard deviation of the power distribution around the
     * centroid, so a pure tone reports approximately zero and a flat band reports
     * roughly the standard deviation of a uniform distribution over it. It is empty for
     * a silent signal.
     *
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the bandwidth in hertz in an `Optional`.
     * @throws {TypeError} if the window is not callable.
     */
    public spectralBandwidth(window?: SpectralWindow): Optional<Frequency> {
        return useSynchronousSpectralBandwidth(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Returns the frequency below which a fraction of the spectral power lies.
     *
     * The cumulative power over the one-sided half is accumulated in increasing
     * frequency order and the first bin that reaches `ratio` of the total is reported.
     * The default is eighty-five percent, matching `Spectrum.rolloff`; the value is an
     * application convention rather than a theorem. The result is empty for a silent
     * signal.
     *
     * @param ratio - the cumulative fraction, within `(0, 1]`; defaults to `0.85`.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the rolloff frequency in hertz in an `Optional`.
     * @throws {TypeError} if the ratio or the window is invalid.
     * @throws {RangeError} if the ratio lies outside `(0, 1]`.
     */
    public spectralRolloff(ratio: number = DefaultRolloffRatio, window?: SpectralWindow): Optional<Frequency> {
        return useSynchronousSpectralRolloff(this.plan, window ?? this.taper, ratio).collect(this.source());
    }

    /**
     * Returns the spectral flatness of this signal.
     *
     * The value is the ratio of the geometric mean to the arithmetic mean of the
     * one-sided **power** spectrum, so it approaches one for a flat, noise-like record
     * and zero for a tonal one. The definition is over power and over the one-sided
     * half: an amplitude version has a different numeric value, and a two-sided
     * traversal counts the same information twice. Any exactly zero bin makes the value
     * zero, which is the correct reading of a perfectly tonal record. The ratio is
     * usually quoted in decibels, which is `10 * log10` of this value because it
     * compares powers.
     *
     * @param window - the analysis taper; defaults to the window of this signal.
     * @returns the flatness ratio, between zero and one.
     * @throws {TypeError} if the window is not callable.
     */
    public spectralFlatness(window?: SpectralWindow): number {
        return useSynchronousSpectralFlatness(this.plan, window ?? this.taper).collect(this.source());
    }

    /**
     * Estimates the signal-to-noise ratio of this signal in decibels.
     *
     * The noise floor is the median of the density, which is robust against the few
     * bins a tone occupies where a mean would be dragged up by them. The in-band power
     * is the integral of the density, the in-band noise is the floor times the band
     * width, and the estimate is `10 * log10((band - noise) / noise)`. Both the
     * flat-noise and the negligible-out-of-band-leakage assumptions are stated because
     * the number is an indicator when either fails.
     *
     * @param frameSize - the segment length used by the density; defaults to the
     *        smaller of 256 and the sample count.
     * @param hopSize - the samples between segment starts; defaults to half a segment.
     * @param window - the analysis taper; defaults to the window of this signal.
     * @param floorQuantile - the quantile used as the noise floor, within `(0, 1)`;
     *        defaults to the median.
     * @returns the ratio in decibels in an `Optional`, empty when the band holds no
     *         power above the estimated floor.
     * @throws {TypeError} if a length, the window or the quantile is invalid.
     * @throws {RangeError} if the framing is impossible, or the quantile lies outside
     *         `(0, 1)`.
     */
    public signalToNoiseRatio(frameSize?: bigint, hopSize?: bigint, window?: SpectralWindow, floorQuantile: number = 0.5): Optional<number> {
        const length: number = this.values.length;
        const segment: bigint = frameSize === undefined ? BigInt(Math.min(DefaultFrameSize, length)) : frameSize;
        const resolved: number = requireCount(segment, "Density segment length");
        const rawHop: bigint = hopSize === undefined ? BigInt(Math.max(1, Math.floor(resolved / 2))) : hopSize;
        const step: number = requireCount(rawHop, "Density hop size");
        return useSynchronousSignalToNoiseRatio(this.plan, resolved, step, window ?? this.taper, floorQuantile).collect(this.source());
    }
}