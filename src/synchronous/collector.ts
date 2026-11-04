import { isFunction, isNumber, isBigInt, isBoolean, isString, isObject, isAsyncFunction, isIterable } from "#semantic/guard";
import { useCompare, useToBigInt, useToNumber } from "#semantic/hook";
import { Optional } from "#semantic/optional";
import { SynchronousCollectorSymbol } from "#semantic/symbol";
import type { BiFunctional, BiPredicate, Functional, Predicate, Supplier, TriFunctional, TriPredicate, Consumer, BiConsumer, Comparator, SynchronousGenerator, MaybeInvalid, Indexed } from "#semantic/utility";
import { invalidate, validate } from "#semantic/utility";
/**
 * An immutable collection strategy for synchronous sources, with fresh accumulation state per collection.
 *
 * @template E - The source element type.
 * @template A - The accumulator type.
 * @template R - The finished result type.
 */
export class SynchronousCollector<E, A, R> {
    protected identity: Supplier<A>;
    protected interrupt: Predicate<E> | BiPredicate<E, bigint> | TriPredicate<E, bigint, A>;
    protected accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>;
    protected finisher: Functional<A, R>;
    protected readonly SynchronousCollector: symbol = SynchronousCollectorSymbol;
    protected constructor(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>);
    protected constructor(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>);
    protected constructor(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>);
    protected constructor(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>);
    protected constructor(identity: Supplier<A>, interrupt: Predicate<E> | BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>) {
        if (isFunction(identity) && isFunction(interrupt) && isFunction(accumulator) && isFunction(finisher)) {
            this.identity = identity;
            this.interrupt = interrupt;
            this.accumulator = accumulator;
            this.finisher = finisher;
            Object.defineProperties(this, {
                "identity": {
                    value: identity,
                    writable: false,
                    enumerable: true,
                    configurable: false
                },
                "interrupt": {
                    value: interrupt,
                    writable: false,
                    enumerable: true,
                    configurable: false
                },
                "accumulator": {
                    value: accumulator,
                    writable: false,
                    enumerable: true,
                    configurable: false
                },
                "finisher": {
                    value: finisher,
                    writable: false,
                    enumerable: true,
                    configurable: false
                },
                "SynchronousCollector": {
                    value: SynchronousCollectorSymbol,
                    writable: false,
                    enumerable: false,
                    configurable: false
                }
            });
            Object.freeze(this);
        }
        else {
            throw new TypeError("Invalid arguments");
        }
    }
    /**
     * Consumes a generator, iterable or ascending unit-step numeric range, checking interruption before accumulation. Numeric ranges use the smaller inclusive bound and larger exclusive bound.
     *
     * @param generator - The callback-based source to consume.
     * @returns The finished accumulation result.
     */
    public collect(generator: SynchronousGenerator<E>): R;
    /**
     * Consumes a generator, iterable or ascending unit-step numeric range, checking interruption before accumulation. Numeric ranges use the smaller inclusive bound and larger exclusive bound.
     *
     * @param iterable - The iterable source to consume.
     * @returns The finished accumulation result.
     */
    public collect(iterable: Iterable<E>): R;
    /**
     * Consumes a generator, iterable or ascending unit-step numeric range, checking interruption before accumulation. Numeric ranges use the smaller inclusive bound and larger exclusive bound.
     *
     * @param start - The first numeric bound; the smaller bound is inclusive.
     * @param end - The second numeric bound; the larger bound is exclusive.
     * @returns The finished accumulation result.
     */
    public collect(start: number, end: number): R;
    /**
     * Consumes a generator, iterable or ascending unit-step numeric range, checking interruption before accumulation. Numeric ranges use the smaller inclusive bound and larger exclusive bound.
     *
     * @param start - The first numeric bound; the smaller bound is inclusive.
     * @param end - The second numeric bound; the larger bound is exclusive.
     * @returns The finished accumulation result.
     */
    public collect(start: bigint, end: bigint): R;
    /**
     * Consumes a generator, iterable or ascending unit-step numeric range, checking interruption before accumulation. Numeric ranges use the smaller inclusive bound and larger exclusive bound.
     *
     * @param argument1 - The source generator, iterable or first numeric range bound.
     * @param argument2 - The second bound when a numeric range is supplied.
     * @returns The finished accumulation result.
     */
    public collect(argument1: SynchronousGenerator<E> | Iterable<E> | number | bigint, argument2?: number | bigint): R {
        if (isAsyncFunction(argument1) || isFunction(argument1)) {
            try {
                let generator: SynchronousGenerator<E> = argument1 as SynchronousGenerator<E>;
                let accumulator: A = this.identity();
                let count: bigint = 0n;
                generator((element: E, index: bigint): void => {
                    accumulator = this.accumulator(accumulator, element, index);
                    count++;
                }, (element: E, index: bigint): boolean => this.interrupt(element, index, accumulator));
                return this.finisher(accumulator);
            }
            catch (error) {
                throw error;
            }
        }
        else if (isIterable(argument1)) {
            try {
                let iterable: Iterable<E> = argument1 as Iterable<E>;
                let accumulator: A = this.identity();
                let count: bigint = 0n;
                for (let element of iterable) {
                    if (this.interrupt(element, count, accumulator)) {
                        break;
                    }
                    accumulator = this.accumulator(accumulator, element, count);
                    count++;
                }
                return this.finisher(accumulator);
            }
            catch (error) {
                throw error;
            }
        }
        else if (isNumber(argument1) && isNumber(argument2)) {
            try {
                let start: number = argument1 < argument2 ? argument1 : argument2;
                let end: number = argument1 > argument2 ? argument1 : argument2;
                let accumulator: A = this.identity();
                let count: bigint = 0n;
                for (let i: number = start; i < end; i++) {
                    if (this.interrupt(i as E, count, accumulator)) {
                        break;
                    }
                    accumulator = this.accumulator(accumulator, i as E, count);
                    count++;
                }
                return this.finisher(accumulator);
            }
            catch (error) {
                throw error;
            }
        }
        else if (isBigInt(argument1) && isBigInt(argument2)) {
            try {
                let start: bigint = argument1 < argument2 ? argument1 : argument2;
                let end: bigint = argument1 > argument2 ? argument1 : argument2;
                let accumulator: A = this.identity();
                let count: bigint = 0n;
                for (let i: bigint = start; i < end; i++) {
                    if (this.interrupt(i as E, count, accumulator)) {
                        break;
                    }
                    accumulator = this.accumulator(accumulator, i as E, count);
                    count++;
                }
                return this.finisher(accumulator);
            }
            catch (error) {
                throw error;
            }
        }
        throw new Error("Invalid arguments.");
    }
    /**
     * Returns the supplier used to initialise each collection.
     *
     * @returns The initial accumulator supplier.
     */
    public getIdentity(): Supplier<A> {
        return this.identity;
    }
    /**
     * Returns the predicate checked before accumulating an element.
     *
     * @returns The interruption predicate.
     */
    public getInterrupt(): Predicate<E> | BiPredicate<E, bigint> | TriPredicate<E, bigint, A> {
        return this.interrupt;
    }
    /**
     * Returns the function that combines elements with the accumulator.
     *
     * @returns The accumulation function.
     */
    public getAccumulator(): BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> {
        return this.accumulator;
    }
    /**
     * Returns the function applied to the completed accumulator.
     *
     * @returns The finishing function.
     */
    public getFinisher(): Functional<A, R> {
        return this.finisher;
    }
    /**
     * Creates a collector whose interruption predicate always returns false.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh initial accumulator.
     * @param accumulator - Combines an accumulator with an element and optional bigint index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns An immutable collector that consumes the complete source.
     */
    public static full<E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    /**
     * Creates a collector whose interruption predicate always returns false.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh initial accumulator.
     * @param accumulator - Combines an accumulator with an element and optional bigint index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns An immutable collector that consumes the complete source.
     */
    public static full<E, A, R>(identity: Supplier<A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    /**
     * Creates a collector whose interruption predicate always returns false.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh initial accumulator.
     * @param accumulator - Combines an accumulator with an element and optional bigint index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns An immutable collector that consumes the complete source.
     */
    public static full<E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R> {
        return new SynchronousCollector(identity, () => false, accumulator, finisher);
    }
    /**
     * Creates a collector that can stop before accumulating an element.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh initial accumulator.
     * @param interrupt - Returns true to stop before the current element is accumulated.
     * @param accumulator - Combines an accumulator with an element and optional bigint index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns An immutable collector using the supplied interruption predicate.
     */
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    /**
     * Creates a collector that can stop before accumulating an element.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh initial accumulator.
     * @param interrupt - Returns true to stop before the current element is accumulated.
     * @param accumulator - Combines an accumulator with an element and optional bigint index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns An immutable collector using the supplied interruption predicate.
     */
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    /**
     * Creates a collector that can stop before accumulating an element.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh initial accumulator.
     * @param interrupt - Returns true to stop before the current element is accumulated.
     * @param accumulator - Combines an accumulator with an element and optional bigint index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns An immutable collector using the supplied interruption predicate.
     */
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    /**
     * Creates a collector that can stop before accumulating an element.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh initial accumulator.
     * @param interrupt - Returns true to stop before the current element is accumulated.
     * @param accumulator - Combines an accumulator with an element and optional bigint index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns An immutable collector using the supplied interruption predicate.
     */
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    /**
     * Creates a collector that can stop before accumulating an element.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh initial accumulator.
     * @param interrupt - Returns true to stop before the current element is accumulated.
     * @param accumulator - Combines an accumulator with an element and optional bigint index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns An immutable collector using the supplied interruption predicate.
     */
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    /**
     * Creates a collector that can stop before accumulating an element.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh initial accumulator.
     * @param interrupt - Returns true to stop before the current element is accumulated.
     * @param accumulator - Combines an accumulator with an element and optional bigint index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns An immutable collector using the supplied interruption predicate.
     */
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    /**
     * Creates a collector that can stop before accumulating an element.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh initial accumulator.
     * @param interrupt - Returns true to stop before the current element is accumulated.
     * @param accumulator - Combines an accumulator with an element and optional bigint index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns An immutable collector using the supplied interruption predicate.
     */
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: Predicate<E> | BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R> {
        return new SynchronousCollector<E, A, R>(identity, interrupt, accumulator, finisher);
    }
}
;
interface UseSynchronousAnyMatch {
    <E>(predicate: Predicate<E>): SynchronousCollector<E, boolean, boolean>;
    <E>(predicate: BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests for a matching element and stops after a match.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousAnyMatch: UseSynchronousAnyMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return SynchronousCollector.shortable((): boolean => false, (_element: E, _index: bigint, accumulator: boolean): boolean => isBoolean(accumulator) && accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator || predicate(element, index), (accumulator: boolean): boolean => accumulator);
    }
    throw new TypeError("Predicate must be a function.");
};
interface UseSynchronousAllMatch {
    <E>(predicate: Predicate<E>): SynchronousCollector<E, boolean, boolean>;
    <E>(predicate: BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests that every element matches, returning true when empty.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousAllMatch: UseSynchronousAllMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return SynchronousCollector.shortable((): boolean => true, (_element: E, _index: bigint, accumulator: boolean): boolean => isBoolean(accumulator) && !accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator && predicate(element, index), (accumulator: boolean): boolean => accumulator);
    }
    throw new TypeError("Predicate must be a function.");
};
interface UseSynchronousCollect {
    <E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
}
;
/**
 * Creates a collector that combines identity, accumulation and finishing, with optional early interruption.
 *
 * @template E - The source element type.
 * @template A - The accumulator type.
 * @template R - The finished result type.
 * @param argument1 - Supplies a fresh initial accumulator.
 * @param argument2 - The accumulator, or interruption predicate in the four-argument overload.
 * @param argument3 - The finisher, or accumulator in the four-argument overload.
 * @param argument4 - The finisher in the four-argument overload.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousCollect: UseSynchronousCollect = <E, A, R>(argument1: Supplier<A> | SynchronousCollector<E, A, R>, argument2?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Predicate<E> | BiPredicate<E, bigint> | TriPredicate<E, bigint, A>, argument3?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Functional<A, R>, argument4?: Functional<A, R>): SynchronousCollector<E, A, R> => {
    if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3) && isFunction(argument4)) {
        let identity: Supplier<A> = argument1 as Supplier<A>;
        let interrupt: Predicate<E> & BiPredicate<E, bigint> & TriPredicate<E, bigint, A> = argument2 as Predicate<E> & BiPredicate<E, bigint> & TriPredicate<E, bigint, A>;
        let accumulator: BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A> = argument3 as BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A>;
        let finisher: Functional<A, R> = argument4 as Functional<A, R>;
        return SynchronousCollector.shortable(identity, interrupt, accumulator, finisher);
    }
    if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3)) {
        let identity: Supplier<A> = argument1 as Supplier<A>;
        let accumulator: BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A> = argument2 as BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A>;
        let finisher: Functional<A, R> = argument3 as Functional<A, R>;
        return SynchronousCollector.full(identity, accumulator, finisher);
    }
    throw new TypeError("Identity, accumulator, and finisher must be functions.");
};
/**
 * Creates a collector that counts elements as a bigint.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousCount: <E = unknown>() => SynchronousCollector<E, bigint, bigint> = <E = unknown>(): SynchronousCollector<E, bigint, bigint> => {
    return SynchronousCollector.full((): bigint => 0n, (count: bigint): bigint => isBigInt(count) ? (count + 1n) : 1n, (count: bigint): bigint => isBigInt(count) ? count : 0n);
};
interface UseSynchronousError {
    <E = unknown>(): SynchronousCollector<E, string, string>;
    <E = unknown>(accumulator: BiFunctional<string, E, string>): SynchronousCollector<E, string, string>;
    <E = unknown>(accumulator: TriFunctional<string, E, bigint, string>): SynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): SynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): SynchronousCollector<E, string, string>;
}
;
/**
 * Creates a collector that formats elements, writes text with console.error and returns the text.
 *
 * @template E - The source element type.
 * @param argument1 - The opening text or string accumulator; omit for default formatting.
 * @param argument2 - The custom string accumulator when opening and closing text are supplied.
 * @param argument3 - The closing text.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousError: UseSynchronousError = <E = unknown>(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): SynchronousCollector<E, string, string> => {
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return SynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.error(result);
            return result;
        });
    }
    else if (isFunction(argument1)) {
        let prefix: string = "[";
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = "]";
        return SynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.error(result);
            return result;
        });
    }
    else {
        return SynchronousCollector.full<E, string, string>((): string => "[", (accumulator: string, element: E): string => {
            if (isString(accumulator) && isString(element)) {
                return accumulator + element + ",";
            }
            return String(accumulator) + String(element) + ",";
        }, (text: string): string => {
            let result: string = text.substring(0, Math.max(1, text.length - 1)) + "]";
            console.error(result);
            return result;
        });
    }
};
interface FindAtAccumulator<E> {
    position: bigint;
    element: MaybeInvalid<E>;
}
interface FindAtAccumulator<E> {
    position: bigint;
    element: MaybeInvalid<E>;
}
interface UseSynchronousFindAt {
    <E>(index: number): SynchronousCollector<E, FindAtAccumulator<E>, Optional<E>>;
    <E>(index: bigint): SynchronousCollector<E, FindAtAccumulator<E>, Optional<E>>;
}
/**
 * Creates a collector that selects a non-negative encounter position. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @param index - The requested non-negative position, or a negative position for the negative-index factory.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindAt: UseSynchronousFindAt = <E>(index: number | bigint): SynchronousCollector<E, FindAtAccumulator<E>, Optional<E>> => {
    let target: bigint = useToBigInt(index);
    if (target < 0n) {
        throw new Error("use \"useSynchronousFindNegativeAt\" for negative index.");
    }
    return SynchronousCollector.shortable(((): FindAtAccumulator<E> => {
        return {
            position: 0n,
            element: (void 0)
        };
    }), (_element: E, _index: bigint, accumulator: FindAtAccumulator<E>): boolean => {
        return accumulator.position > target;
    }, (accumulator: FindAtAccumulator<E>, element: E): FindAtAccumulator<E> => {
        if (accumulator.position === target) {
            accumulator.element = element;
        }
        return {
            position: accumulator.position + 1n,
            element: accumulator.element
        };
    }, (accumulator: FindAtAccumulator<E>): Optional<E> => {
        return Optional.of(accumulator.element);
    });
};
interface UseSynchronousFindNegativeAt {
    <E>(index: number): SynchronousCollector<E, Array<E>, Optional<E>>;
    <E>(index: bigint): SynchronousCollector<E, Array<E>, Optional<E>>;
}
;
/**
 * Creates a collector that buffers elements and resolves a negative position modulo the collected length. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @param index - The requested non-negative position, or a negative position for the negative-index factory.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindNegativeAt: UseSynchronousFindNegativeAt = <E>(index: number | bigint): SynchronousCollector<E, Array<E>, Optional<E>> => {
    let target: bigint = useToBigInt(index);
    if (target > -1n) {
        throw new Error("use \"useSynchronousFindAt\" for none-negative index.");
    }
    return SynchronousCollector.full(() => [], (accumulator: Array<E>, element: E): Array<E> => {
        accumulator.push(element);
        return accumulator;
    }, (accumulator: Array<E>): Optional<E> => {
        if (accumulator.length > 0) {
            let count: bigint = BigInt(accumulator.length);
            let limit: bigint = ((target % count) + count) % count;
            let element: MaybeInvalid<E> = accumulator.at(Number(limit));
            return Optional.of(element);
        }
        return Optional.empty();
    });
};
/**
 * Creates a collector that selects the first non-nullish element, stopping once it is present.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindFirst: <E>() => SynchronousCollector<E, Optional<E>, Optional<E>> = <E>(): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    return SynchronousCollector.shortable((): Optional<E> => Optional.empty<E>(), (_element: E, _index: bigint, accumulator: Optional<E>): boolean => accumulator.isPresent(), (accumulator: Optional<E>, element: E): Optional<E> => {
        if (accumulator.isPresent() || invalidate(element)) {
            return accumulator;
        }
        return Optional.of(element);
    }, (result: Optional<E>): Optional<E> => result);
};
/**
 * Creates a collector that selects the first non-nullish element, stopping once it is present.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindAny: <E>() => SynchronousCollector<E, Optional<E>, Optional<E>> = <E>(): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    return SynchronousCollector.shortable((): Optional<E> => Optional.empty<E>(), (_element: E, _index: bigint, accumulator: Optional<E>): boolean => accumulator.isPresent(), (accumulator: Optional<E>, element: E): Optional<E> => {
        if (accumulator.isPresent() || invalidate(element)) {
            return accumulator;
        }
        return Optional.of(element);
    }, (result: Optional<E>): Optional<E> => result);
};
/**
 * Creates a collector that selects the last available element. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindLast: <E>() => SynchronousCollector<E, Optional<E>, Optional<E>> = <E>(): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    return SynchronousCollector.full((): Optional<E> => Optional.empty<E>(), (accumulator: Optional<E>, element: E): Optional<E> => {
        if (invalidate(element)) {
            return accumulator;
        }
        return Optional.of(element);
    }, (result: Optional<E>): Optional<E> => result);
};
interface UseSynchronousFindMaximum {
    <E>(): SynchronousCollector<E, Optional<E>, Optional<E>>;
    <E>(comparator: Comparator<E>): SynchronousCollector<E, Optional<E>, Optional<E>>;
}
/**
 * Creates a collector that selects the greatest element according to the comparator. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @param comparator - The element comparison function; defaults to the library comparator.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindMaximum: UseSynchronousFindMaximum = <E>(comparator: Comparator<E> = useCompare<E>): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    if (isFunction(comparator)) {
        return SynchronousCollector.full((): Optional<E> => Optional.empty<E>(), (accumulator: Optional<E>, element: E): Optional<E> => {
            if (invalidate(element)) {
                return accumulator;
            }
            if (!accumulator.isPresent()) {
                return Optional.of(element);
            }
            return accumulator.map((previous: E): E => {
                return comparator(previous, element) >= 0 ? previous : element;
            });
        }, (result: Optional<E>): Optional<E> => result);
    }
    throw new TypeError("Invalid argument.");
};
interface UseSynchronousFindMinimum {
    <E>(): SynchronousCollector<E, Optional<E>, Optional<E>>;
    <E>(comparator: Comparator<E>): SynchronousCollector<E, Optional<E>, Optional<E>>;
}
/**
 * Creates a collector that selects the least element according to the comparator. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @param comparator - The element comparison function; defaults to the library comparator.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindMinimum: UseSynchronousFindMinimum = <E>(comparator: Comparator<E> = useCompare<E>): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    if (isFunction(comparator)) {
        return SynchronousCollector.full((): Optional<E> => Optional.empty<E>(), (accumulator: Optional<E>, element: E): Optional<E> => {
            if (invalidate(element)) {
                return accumulator;
            }
            if (!accumulator.isPresent()) {
                return Optional.of(element);
            }
            return accumulator.map((previous: E): E => {
                return comparator(previous, element) <= 0 ? previous : element;
            });
        }, (result: Optional<E>): Optional<E> => result);
    }
    throw new TypeError("Invalid argument.");
};
interface UseSynchronousForEach {
    <E>(action: Consumer<E>): SynchronousCollector<E, bigint, bigint>;
    <E>(action: BiConsumer<E, bigint>): SynchronousCollector<E, bigint, bigint>;
}
;
/**
 * Creates a collector that invokes an action for every element and returns the bigint count processed.
 *
 * @template E - The source element type.
 * @param action - Receives each element and its optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousForEach: UseSynchronousForEach = <E>(action: Consumer<E> | BiConsumer<E, bigint>): SynchronousCollector<E, bigint, bigint> => {
    if (isFunction(action)) {
        return SynchronousCollector.full((): bigint => 0n, (accumulator: bigint, element: E, index: bigint): bigint => {
            action(element, index);
            return accumulator + 1n;
        }, (accumulator: bigint): bigint => accumulator);
    }
    throw new TypeError("Action must be a function.");
};
interface UseSynchronousNonMatch {
    <E>(predicate: Predicate<E>): SynchronousCollector<E, boolean, boolean>;
    <E>(predicate: BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests that no element matches, returning true when empty.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNoneMatch: UseSynchronousNonMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return SynchronousCollector.shortable((): boolean => true, (_element: E, _index: bigint, accumulator: boolean): boolean => !accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator && !predicate(element, index), (accumulator: boolean): boolean => accumulator);
    }
    throw new TypeError("Predicate must be a function.");
};
interface UseSynchronousGroup {
    <E, K>(classifier: Functional<E, K>): SynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
    <E, K>(classifier: BiFunctional<E, bigint, K>): SynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
}
;
/**
 * Creates a collector that groups elements into arrays by classifier key.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @param classifier - Calculates the grouping key or bigint partition bucket.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousGroup: UseSynchronousGroup = <E, K>(classifier: Functional<E, K> | BiFunctional<E, bigint, K>): SynchronousCollector<E, Map<K, E[]>, Map<K, E[]>> => {
    if (isFunction(classifier)) {
        return SynchronousCollector.full((): Map<K, E[]> => new Map<K, E[]>(), (accumulator: Map<K, E[]>, element: E, index: bigint): Map<K, E[]> => {
            let key: K = classifier(element, index);
            let group: E[] = accumulator.get(key) || [];
            group.push(element);
            accumulator.set(key, group);
            return accumulator;
        }, (accumulator: Map<K, E[]>): Map<K, E[]> => accumulator);
    }
    throw new TypeError("Classifier must be a function.");
};
interface UseSynchronousGroupBy {
    <E, K>(keyExtractor: Functional<E, K>): SynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousCollector<E, Map<K, V[]>, Map<K, V[]>>;
    <E, K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): SynchronousCollector<E, Map<K, V[]>, Map<K, V[]>>;
}
/**
 * Creates a collector that groups extracted values into arrays by extracted key.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted value type.
 * @param keyExtractor - Extracts the grouping or map key.
 * @param valueExtractor - Extracts the value to store.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousGroupBy: UseSynchronousGroupBy = <E, K, V = E>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E) => element as unknown as V): SynchronousCollector<E, Map<K, V[]>, Map<K, V[]>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return SynchronousCollector.full((): Map<K, V[]> => new Map<K, V[]>(), (accumulator: Map<K, V[]>, element: E, index: bigint): Map<K, V[]> => {
            let key: K = keyExtractor(element, index);
            let group: V[] = accumulator.get(key) || [];
            group.push(valueExtractor(element, index));
            accumulator.set(key, group);
            return accumulator;
        }, (accumulator: Map<K, V[]>): Map<K, V[]> => accumulator);
    }
    throw new TypeError("Key extractor and value extractor must be functions.");
};
interface UseSynchronousJoin {
    <E = unknown>(): SynchronousCollector<E, string, string>;
    <E = unknown>(delimiter: string): SynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, delimiter: string, suffix: string): SynchronousCollector<E, string, string>;
    <E = unknown>(prefiex: string, accumulator: BiFunctional<string, E, string>, suffix: string): SynchronousCollector<E, string, string>;
    <E = unknown>(prefiex: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): SynchronousCollector<E, string, string>;
}
;
/**
 * Creates a collector that joins elements into text, using square brackets and commas by default.
 *
 * @template E - The source element type.
 * @param argument1 - The delimiter, or opening text in a three-argument overload.
 * @param argument2 - The delimiter or custom string accumulator.
 * @param argument3 - The closing text.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousJoin: UseSynchronousJoin = <E = unknown>(argument1?: string, argument2?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): SynchronousCollector<E, string, string> => {
    if (invalidate(argument1) && invalidate(argument2) && invalidate(argument3)) {
        return SynchronousCollector.full<E, string, string>((): string => "[", (text: string, element: E): string => text + element + ",", (text: string): string => text.substring(0, Math.max(1, text.length - 1)) + "]");
    }
    if (isString(argument1) && invalidate(argument2) && invalidate(argument3)) {
        let delimiter: string = argument1;
        return SynchronousCollector.full<E, string, string>((): string => "[", (text: string, element: E): string => text + element + delimiter, (text: string): string => text.substring(0, Math.max(1, text.length - delimiter.length)) + "]");
    }
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return SynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => text + suffix);
    }
    if (isString(argument1) && isString(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let delimiter: string = argument2;
        let suffix: string = argument3;
        return SynchronousCollector.full<E, string, string>((): string => prefix, (text: string, element: E): string => text + element + delimiter, (text: string): string => text.substring(0, Math.max(prefix.length, text.length - delimiter.length)) + suffix);
    }
    throw new TypeError("Invalid arguments.");
};
interface UseSynchronousLog {
    <E = unknown>(): SynchronousCollector<E, string, string>;
    <E = unknown>(accumulator: BiFunctional<string, E, string>): SynchronousCollector<E, string, string>;
    <E = unknown>(accumulator: TriFunctional<string, E, bigint, string>): SynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): SynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): SynchronousCollector<E, string, string>;
}
;
/**
 * Creates a collector that formats elements, writes text with console.log and returns the text.
 *
 * @template E - The source element type.
 * @param argument1 - The opening text or string accumulator; omit for default formatting.
 * @param argument2 - The custom string accumulator when opening and closing text are supplied.
 * @param argument3 - The closing text.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousLog: UseSynchronousLog = <E = unknown>(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): SynchronousCollector<E, string, string> => {
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return SynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.log(result);
            return result;
        });
    }
    else if (isFunction(argument1)) {
        let prefix: string = "[";
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = "]";
        return SynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.log(result);
            return result;
        });
    }
    else {
        return SynchronousCollector.full<E, string, string>((): string => "[", (accumulator: string, element: E): string => {
            if (isString(accumulator) && isString(element)) {
                return accumulator + element + ",";
            }
            return String(accumulator) + String(element) + ",";
        }, (text: string): string => {
            let result: string = text.substring(0, Math.max(1, text.length - 1)) + "]";
            console.log(result);
            return result;
        });
    }
};
/**
 * Creates a collector that distributes elements by index modulo the count, using at least one bucket.
 *
 * @template E - The source element type.
 * @param count - The bigint bucket count; values below one use one bucket.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousPartition: <E>(count: bigint) => SynchronousCollector<E, Array<Array<E>>, Array<Array<E>>> = <E>(count: bigint): SynchronousCollector<E, Array<Array<E>>, Array<Array<E>>> => {
    if (isBigInt(count)) {
        let limited: bigint = count > 0n ? count : 1n;
        return SynchronousCollector.full((): Array<Array<E>> => {
            return [];
        }, (array: Array<Array<E>>, element: E, index: bigint): Array<Array<E>> => {
            let resolved: bigint = ((index % limited) + limited) % limited;
            let bucket: number = Number(resolved);
            while (array.length <= bucket) {
                array.push([]);
            }
            array[bucket].push(element);
            return array;
        }, (result: Array<Array<E>>): Array<Array<E>> => {
            return result;
        });
    }
    throw new TypeError("Count must be a BigInt.");
};
interface UseSynchronousPartitionBy {
    <E>(classifier: Functional<E, bigint>): SynchronousCollector<E, Array<E[]>, Array<E[]>>;
    <E>(classifier: BiFunctional<E, bigint, bigint>): SynchronousCollector<E, Array<E[]>, Array<E[]>>;
}
;
/**
 * Creates a collector that distributes elements into classifier-numbered buckets, treating negative bucket numbers as zero.
 *
 * @template E - The source element type.
 * @param classifier - Calculates the grouping key or bigint partition bucket.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousPartitionBy: UseSynchronousPartitionBy = <E>(classifier: Functional<E, bigint> | BiFunctional<E, bigint, bigint>): SynchronousCollector<E, Array<E[]>, Array<E[]>> => {
    if (isFunction(classifier)) {
        return SynchronousCollector.full((): Array<Array<E>> => {
            return [];
        }, (array: Array<Array<E>>, element: E, index: bigint): Array<Array<E>> => {
            let resolved: bigint = classifier(element, index);
            let bucket: number = resolved < 0n ? 0 : Number(resolved);
            while (array.length <= bucket) {
                array.push([]);
            }
            array[bucket].push(element);
            return array;
        }, (result: Array<Array<E>>): Array<Array<E>> => {
            return result;
        });
    }
    throw new TypeError("Classifier must be a function.");
};
interface UseSynchronousReduce {
    <E>(accumulator: BiFunctional<E, E, E>): SynchronousCollector<E, Optional<E>, Optional<E>>;
    <E>(accumulator: TriFunctional<E, E, bigint, E>): SynchronousCollector<E, Optional<E>, Optional<E>>;
    <E>(identity: E, accumulator: BiFunctional<E, E, E>): SynchronousCollector<E, E, E>;
    <E>(identity: E, accumulator: TriFunctional<E, E, bigint, E>): SynchronousCollector<E, E, E>;
    <E, R>(identity: R, accumulator: BiFunctional<R, E, R>, finisher: Functional<R, R>): SynchronousCollector<E, R, R>;
    <E, R>(identity: R, accumulator: TriFunctional<R, E, bigint, R>, finisher: Functional<R, R>): SynchronousCollector<E, R, R>;
}
;
/**
 * Creates a collector that reduces elements with an optional initial value and finisher.
 *
 * @template E - The source element type.
 * @template R - The finished result type.
 * @param argument1 - The reducer when used alone, or the initial reduction value.
 * @param argument2 - The reducer when an initial value is supplied.
 * @param argument3 - The optional result finisher.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousReduce: UseSynchronousReduce = <E, R>(argument1?: R | E | BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E>, argument2?: BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E> | BiFunctional<R, E, R> | TriFunctional<R, E, bigint, R>, argument3?: Functional<R, R>): SynchronousCollector<E, Optional<E>, Optional<E>> | SynchronousCollector<E, E, E> | SynchronousCollector<E, R, R> => {
    if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
        let accumulator: BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E> = argument1 as BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E>;
        return SynchronousCollector.full<E, Optional<E>, Optional<E>>((): Optional<E> => Optional.empty<E>(), (result: Optional<E>, element: E, index: bigint): Optional<E> => {
            if (result.isPresent()) {
                return result.map((previous: E): E => accumulator(previous, element, index));
            }
            if (invalidate(element)) {
                return result;
            }
            return Optional.of(element);
        }, (result: Optional<E>): Optional<E> => result);
    }
    else if (validate(argument1) && isFunction(argument2) && invalidate(argument3)) {
        let identity = argument1 as E;
        let accumulator: BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E> = argument2 as BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E>;
        return SynchronousCollector.full<E, E, E>(() => identity, accumulator, (result: E): E => result);
    }
    else if (validate(argument1) && isFunction(argument2) && isFunction(argument3)) {
        let identity = argument1 as R;
        let accumulator: BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R> = argument2 as BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R>;
        let finisher = argument3 as Functional<R, R>;
        return SynchronousCollector.full<E, R, R>(() => identity, accumulator, finisher);
    }
    else {
        throw new TypeError("Invalid arguments.");
    }
};
/**
 * Creates a collector that collects elements in encounter order into a new array.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousToArray: <E>() => SynchronousCollector<E, E[], E[]> = <E>(): SynchronousCollector<E, E[], E[]> => {
    return SynchronousCollector.full<E, E[], E[]>((): E[] => [], (array: E[], element: E): E[] => {
        array.push(element);
        return array;
    }, (array: E[]): E[] => array);
};
/**
 * Creates a collector that collects each element with its original bigint index.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousToIndexedArray: <E>() => SynchronousCollector<E, Array<Indexed<E>>, Array<Indexed<E>>> = <E>(): SynchronousCollector<E, Array<Indexed<E>>, Array<Indexed<E>>> => {
    return SynchronousCollector.full<E, Array<Indexed<E>>, Array<Indexed<E>>>((): Array<Indexed<E>> => [], (array: Array<Indexed<E>>, element: E, index: bigint): Array<Indexed<E>> => {
        array.push({
            element: element,
            index: index
        });
        return array;
    }, (array: Array<Indexed<E>>): Array<Indexed<E>> => array);
};
interface UseSynchronousToMap {
    <E, K>(keyExtractor: Functional<E, K>): SynchronousCollector<E, Map<K, E>, Map<K, E>>;
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousCollector<E, Map<K, V>, Map<K, V>>;
    <E, K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): SynchronousCollector<E, Map<K, V>, Map<K, V>>;
}
;
/**
 * Creates a collector that collects extracted keys and values, replacing earlier values for duplicate keys.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted value type.
 * @param keyExtractor - Extracts the grouping or map key.
 * @param valueExtractor - Extracts the value to store.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousToMap: UseSynchronousToMap = <E, K, V>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): SynchronousCollector<E, Map<K, V>, Map<K, V>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return SynchronousCollector.full<E, Map<K, V>, Map<K, V>>((): Map<K, V> => new Map<K, V>(), (map: Map<K, V>, element: E, index: bigint): Map<K, V> => {
            let key: K = keyExtractor(element, index);
            let value: V = valueExtractor(element, index);
            map.set(key, value);
            return map;
        }, (map: Map<K, V>): Map<K, V> => map);
    }
    throw new TypeError("Key extractor and value extractor must be functions.");
};
/**
 * Creates a collector that collects distinct elements into a Set.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousToSet: <E>() => SynchronousCollector<E, Set<E>, Set<E>> = <E>(): SynchronousCollector<E, Set<E>, Set<E>> => {
    return SynchronousCollector.full<E, Set<E>, Set<E>>((): Set<E> => new Set<E>(), (set: Set<E>, element: E): Set<E> => {
        set.add(element);
        return set;
    }, (set: Set<E>): Set<E> => set);
};
interface UseSynchronousWrite {
    <E, S = string>(stream: WritableStream<S>): SynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
    <E, S = string>(stream: WritableStream<S>, accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>>): SynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
    <E, S = string>(stream: WritableStream<S>, accumulator: TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): SynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
}
;
/**
 * Creates a collector that chains stream accumulation, writing stringified elements when no accumulator is supplied.
 *
 * @template E - The source element type.
 * @template S - The stream chunk type.
 * @param argument1 - The writable stream used by the collection.
 * @param argument2 - The optional stream accumulator; the default writes stringified elements.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousWrite: UseSynchronousWrite = <E, S = string>(argument1: WritableStream<S>, argument2?: BiFunctional<WritableStream<S>, E, WritableStream<S>> | TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): SynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>> => {
    if (isObject(argument1)) {
        if (isFunction(argument2)) {
            let stream: WritableStream<S> = argument1 as WritableStream<S>;
            let accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>> = argument2 as BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>;
            return SynchronousCollector.full<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>((): Promise<WritableStream<S>> => Promise.resolve(stream), (promise: Promise<WritableStream<S>>, element: E, index: bigint): Promise<WritableStream<S>> => {
                return new Promise<WritableStream<S>>((resolve, reject) => {
                    promise.then((stream: WritableStream<S>): void => {
                        try {
                            resolve(accumulator(stream, element, index));
                        }
                        catch (error) {
                            reject(error);
                        }
                    }).catch(reject);
                });
            }, (promise: Promise<WritableStream<S>>): Promise<WritableStream<S>> => promise);
        }
        else {
            let stream: WritableStream<S> = argument1 as WritableStream<S>;
            return SynchronousCollector.full<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>((): Promise<WritableStream<S>> => Promise.resolve(stream), (promise: Promise<WritableStream<S>>, element: E): Promise<WritableStream<S>> => {
                return new Promise<WritableStream<S>>((resolve, reject) => {
                    promise.then((stream: WritableStream<S>): void => {
                        try {
                            let writer: WritableStreamDefaultWriter<S> = stream.getWriter();
                            writer.write(String(element) as S);
                            resolve(stream);
                        }
                        catch (error) {
                            reject(error);
                        }
                    }).catch(reject);
                });
            }, (promise: Promise<WritableStream<S>>): Promise<WritableStream<S>> => promise);
        }
    }
    throw new TypeError("Invalid arguments.");
};
interface UseSynchronousNumericSummate {
    <E>(): SynchronousCollector<E, number, number>;
    <E>(mapper: Functional<E, number>): SynchronousCollector<number, number, number>;
}
;
/**
 * Creates a collector that adds mapped numbers, treating non-number results as zero.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNumericSummate: UseSynchronousNumericSummate = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, number, number> | SynchronousCollector<E, number, number> => {
    return SynchronousCollector.full((): number => 0, (accumulator: number, element: number | E): number => {
        let resolved: number = mapper(element as E);
        return accumulator + (isNumber(resolved) ? resolved : 0);
    }, (result: number): number => result) as SynchronousCollector<number, number, number> | SynchronousCollector<E, number, number>;
};
interface UseSynchronousBigIntSummate {
    <E>(): SynchronousCollector<E, bigint, bigint>;
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<bigint, bigint, bigint>;
}
;
/**
 * Creates a collector that adds mapped bigints, treating non-bigint results as zero.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousBigIntSummate: UseSynchronousBigIntSummate = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, bigint, bigint> | SynchronousCollector<E, bigint, bigint> => {
    return SynchronousCollector.full((): bigint => 0n, (accumulator: bigint, element: bigint | E): bigint => {
        let resolved: bigint = mapper(element as E);
        return accumulator + (isBigInt(resolved) ? resolved : 0n);
    }, (result: bigint): bigint => result) as SynchronousCollector<bigint, bigint, bigint> | SynchronousCollector<E, bigint, bigint>;
};
interface UseSynchronousNumericAverage {
    <E>(): SynchronousCollector<E, NumericAverageAccumulator, number>;
    <E>(mapper: Functional<E, number>): SynchronousCollector<number, NumericAverageAccumulator, number>;
}
;
interface NumericAverageAccumulator {
    summate: number;
    count: number;
}
;
/**
 * Creates a collector that averages mapped numbers, counting every source element and returning zero when empty.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNumericAverage: UseSynchronousNumericAverage = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, NumericAverageAccumulator, number> | SynchronousCollector<E, NumericAverageAccumulator, number> => {
    return SynchronousCollector.full((): NumericAverageAccumulator => {
        return {
            summate: 0,
            count: 0
        };
    }, (accumulator: NumericAverageAccumulator, element: number | E): NumericAverageAccumulator => {
        let resolved: number = mapper(element as E);
        return {
            summate: accumulator.summate + (isNumber(resolved) ? resolved : 0),
            count: accumulator.count + 1
        };
    }, (result: NumericAverageAccumulator): number => {
        if (result.count === 0) {
            return 0;
        }
        return result.summate / result.count;
    }) as SynchronousCollector<number, NumericAverageAccumulator, number> | SynchronousCollector<E, NumericAverageAccumulator, number>;
};
interface UseSynchronousBigIntAverage {
    <E>(): SynchronousCollector<E, BigIntAverageAccumulator, bigint>;
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, BigIntAverageAccumulator, bigint>;
}
;
interface BigIntAverageAccumulator {
    summate: bigint;
    count: bigint;
}
;
/**
 * Creates a collector that averages mapped bigints with division truncated towards zero, returning zero when empty.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousBigIntAverage: UseSynchronousBigIntAverage = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, BigIntAverageAccumulator, bigint> | SynchronousCollector<E, BigIntAverageAccumulator, bigint> => {
    return SynchronousCollector.full((): BigIntAverageAccumulator => {
        return {
            summate: 0n,
            count: 0n
        };
    }, (accumulator: BigIntAverageAccumulator, element: bigint | E): BigIntAverageAccumulator => {
        let resolved: bigint = mapper(element as E);
        return {
            summate: accumulator.summate + (isBigInt(resolved) ? resolved : 0n),
            count: accumulator.count + 1n
        };
    }, (result: BigIntAverageAccumulator): bigint => {
        if (result.count === 0n) {
            return 0n;
        }
        return result.summate / result.count;
    }) as SynchronousCollector<bigint, BigIntAverageAccumulator, bigint> | SynchronousCollector<E, BigIntAverageAccumulator, bigint>;
};
/**
 * Creates a collector that counts each distinct element with bigint frequencies.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFrequency: <E>() => SynchronousCollector<E, Map<E, bigint>, Map<E, bigint>> = <E>(): SynchronousCollector<E, Map<E, bigint>, Map<E, bigint>> => {
    return SynchronousCollector.full((): Map<E, bigint> => new Map<E, bigint>(), (map: Map<E, bigint>, element: E): Map<E, bigint> => {
        let count: bigint = map.get(element) || 0n;
        map.set(element, count + 1n);
        return map;
    }, (map: Map<E, bigint>): Map<E, bigint> => map);
};
interface UseSynchronousNumericMode {
    <E>(): SynchronousCollector<E, Map<number, bigint>, number>;
    <E>(mapper: Functional<E, number>): SynchronousCollector<E, Map<number, bigint>, number>;
}
;
/**
 * Creates a collector that selects the most frequent mapped number, keeping the first encountered value on ties and returning zero when empty.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNumericMode: UseSynchronousNumericMode = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, Map<number, bigint>, number> | SynchronousCollector<E, Map<number, bigint>, number> => {
    return SynchronousCollector.full((): Map<number, bigint> => new Map<number, bigint>(), (map: Map<number, bigint>, element: number | E): Map<number, bigint> => {
        let resolved: number = mapper(element as E);
        let count: bigint = map.get(resolved) || 0n;
        map.set(resolved, count + 1n);
        return map;
    }, (map: Map<number, bigint>): number => {
        let maxCount: bigint = 0n;
        let mode: number = 0;
        for (let [key, value] of map) {
            if (value > maxCount) {
                maxCount = value;
                mode = key;
            }
        }
        return mode;
    }) as SynchronousCollector<number, Map<number, bigint>, number> | SynchronousCollector<E, Map<number, bigint>, number>;
};
interface UseSynchronousBigIntMode {
    <E>(): SynchronousCollector<E, Map<bigint, bigint>, bigint>;
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, Map<bigint, bigint>, bigint>;
}
;
/**
 * Creates a collector that selects the most frequent mapped bigint, keeping the first encountered value on ties and returning zero when empty.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousBigIntMode: UseSynchronousBigIntMode = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, Map<bigint, bigint>, bigint> | SynchronousCollector<E, Map<bigint, bigint>, bigint> => {
    return SynchronousCollector.full((): Map<bigint, bigint> => new Map<bigint, bigint>(), (map: Map<bigint, bigint>, element: bigint | E): Map<bigint, bigint> => {
        let resolved: bigint = mapper(element as E);
        let count: bigint = map.get(resolved) || 0n;
        map.set(resolved, count + 1n);
        return map;
    }, (map: Map<bigint, bigint>): bigint => {
        let maxCount: bigint = 0n;
        let mode: bigint = 0n;
        for (let [key, value] of map) {
            if (value > maxCount) {
                maxCount = value;
                mode = key;
            }
        }
        return mode;
    }) as SynchronousCollector<bigint, Map<bigint, bigint>, bigint> | SynchronousCollector<E, Map<bigint, bigint>, bigint>;
};
interface UseSynchronousNumericVariance {
    <E>(): SynchronousCollector<E, VarianceAccumulator, number>;
    <E>(mapper: Functional<E, number>): SynchronousCollector<E, VarianceAccumulator, number>;
}
;
interface VarianceAccumulator {
    summate: number;
    summateOfSquares: number;
    count: number;
}
;
/**
 * Creates a collector that calculates population variance of mapped numbers, returning zero for fewer than two elements.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNumericVariance: UseSynchronousNumericVariance = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, VarianceAccumulator, number> | SynchronousCollector<E, VarianceAccumulator, number> => {
    return SynchronousCollector.full((): VarianceAccumulator => {
        return {
            summate: 0,
            summateOfSquares: 0,
            count: 0
        };
    }, (accumulator: VarianceAccumulator, element: number | E): VarianceAccumulator => {
        let resolved: number = mapper(element as E);
        return {
            summate: accumulator.summate + (isNumber(resolved) ? resolved : 0),
            summateOfSquares: accumulator.summateOfSquares + (isNumber(resolved) ? Math.pow(resolved, 2) : 0),
            count: accumulator.count + 1
        };
    }, (result: VarianceAccumulator): number => {
        if (result.count < 2) {
            return 0;
        }
        let mean: number = result.summate / result.count;
        let variance: number = (result.summateOfSquares / result.count) - Math.pow(mean, 2);
        return variance;
    }) as SynchronousCollector<number, VarianceAccumulator, number> | SynchronousCollector<E, VarianceAccumulator, number>;
};
interface UseSynchronousBigIntVariance {
    <E>(): SynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
}
;
interface BigIntVarianceAccumulator {
    baseline: bigint;
    mean: number;
    squaredDeviations: number;
    count: number;
}
;
/**
 * Creates a collector that calculates integer-rounded population variance of mapped bigints, returning zero for fewer than two elements.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousBigIntVariance: UseSynchronousBigIntVariance = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, BigIntVarianceAccumulator, bigint> | SynchronousCollector<E, BigIntVarianceAccumulator, bigint> => {
    return SynchronousCollector.full((): BigIntVarianceAccumulator => {
        return { baseline: 0n, mean: 0, squaredDeviations: 0, count: 0 };
    }, (accumulator: BigIntVarianceAccumulator, element: bigint | E): BigIntVarianceAccumulator => {
        let resolved: bigint = mapper(element as E);
        let value: bigint = isBigInt(resolved) ? resolved : 0n;
        let baseline: bigint = accumulator.count === 0 ? value : accumulator.baseline;
        let offset: number = Number(value - baseline);
        let count: number = accumulator.count + 1;
        let delta: number = offset - accumulator.mean;
        let mean: number = accumulator.mean + delta / count;
        return {
            baseline,
            mean,
            squaredDeviations: accumulator.squaredDeviations + delta * (offset - mean),
            count
        };
    }, (result: BigIntVarianceAccumulator): bigint => {
        return result.count < 2 ? 0n : BigInt(Math.round(result.squaredDeviations / result.count));
    }) as SynchronousCollector<bigint, BigIntVarianceAccumulator, bigint> | SynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
};
interface UseSynchronousNumericStandardDeviation {
    <E>(): SynchronousCollector<E, StandardDeviationAccumulator, number>;
    <E>(mapper: Functional<E, number>): SynchronousCollector<E, StandardDeviationAccumulator, number>;
}
;
interface StandardDeviationAccumulator {
    summate: number;
    summateOfSquares: number;
    count: number;
}
;
/**
 * Creates a collector that calculates population standard deviation of mapped numbers, returning zero for fewer than two elements.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNumericStandardDeviation: UseSynchronousNumericStandardDeviation = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, StandardDeviationAccumulator, number> | SynchronousCollector<E, StandardDeviationAccumulator, number> => {
    return SynchronousCollector.full((): StandardDeviationAccumulator => {
        return {
            summate: 0,
            summateOfSquares: 0,
            count: 0
        };
    }, (accumulator: StandardDeviationAccumulator, element: number | E): StandardDeviationAccumulator => {
        let resolved: number = mapper(element as E);
        return {
            summate: accumulator.summate + (isNumber(resolved) ? resolved : 0),
            summateOfSquares: accumulator.summateOfSquares + (isNumber(resolved) ? Math.pow(resolved, 2) : 0),
            count: accumulator.count + 1
        };
    }, (result: StandardDeviationAccumulator): number => {
        if (result.count < 2) {
            return 0;
        }
        let mean: number = result.summate / result.count;
        let variance: number = (result.summateOfSquares / result.count) - Math.pow(mean, 2);
        let standardDeviation: number = Math.sqrt(variance);
        return standardDeviation;
    }) as SynchronousCollector<number, StandardDeviationAccumulator, number> | SynchronousCollector<E, StandardDeviationAccumulator, number>;
};
interface UseSynchronousBigIntStandardDeviation {
    <E>(): SynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
}
;
interface BigIntStandardDeviationAccumulator {
    baseline: bigint;
    mean: number;
    squaredDeviations: number;
    count: number;
}
;
/**
 * Creates a collector that calculates integer-rounded population standard deviation of mapped bigints.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousBigIntStandardDeviation: UseSynchronousBigIntStandardDeviation = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, BigIntStandardDeviationAccumulator, bigint> | SynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint> => {
    return SynchronousCollector.full((): BigIntStandardDeviationAccumulator => {
        return { baseline: 0n, mean: 0, squaredDeviations: 0, count: 0 };
    }, (accumulator: BigIntStandardDeviationAccumulator, element: bigint | E): BigIntStandardDeviationAccumulator => {
        let resolved: bigint = mapper(element as E);
        let value: bigint = isBigInt(resolved) ? resolved : 0n;
        let baseline: bigint = accumulator.count === 0 ? value : accumulator.baseline;
        let offset: number = Number(value - baseline);
        let count: number = accumulator.count + 1;
        let delta: number = offset - accumulator.mean;
        let mean: number = accumulator.mean + delta / count;
        return {
            baseline,
            mean,
            squaredDeviations: accumulator.squaredDeviations + delta * (offset - mean),
            count
        };
    }, (result: BigIntStandardDeviationAccumulator): bigint => {
        return result.count < 2 ? 0n : BigInt(Math.round(Math.sqrt(result.squaredDeviations / result.count)));
    }) as SynchronousCollector<bigint, BigIntStandardDeviationAccumulator, bigint> | SynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
};
interface UseSynchronousNumericMedian {
    <E>(): SynchronousCollector<E, number[], number>;
    <E>(mapper: Functional<E, number>): SynchronousCollector<E, number[], number>;
}
;
/**
 * Creates a collector that sorts mapped numbers and selects the middle value or averages the two middle values. An empty source produces NaN.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNumericMedian: UseSynchronousNumericMedian = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, number[], number> | SynchronousCollector<E, number[], number> => {
    return SynchronousCollector.full((): number[] => [], (array: number[], element: number | E): number[] => {
        let resolved: number = mapper(element as E);
        array.push(resolved);
        array.sort((a: number, b: number): number => a - b);
        return array;
    }, (array: number[]): number => {
        let length: number = array.length;
        if (length % 2 === 0) {
            let mid: number = length / 2;
            return (array[mid - 1] + array[mid]) / 2;
        }
        else {
            let mid: number = Math.floor(length / 2);
            return array[mid];
        }
    }) as SynchronousCollector<number, number[], number> | SynchronousCollector<E, number[], number>;
};
interface UseSynchronousBigIntMedian {
    <E>(): SynchronousCollector<E, bigint[], bigint>;
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, bigint[], bigint>;
}
;
/**
 * Creates a collector that sorts mapped bigints and selects the middle value or averages the two middle values with truncating division. Finishing an empty source throws when averaging missing values.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousBigIntMedian: UseSynchronousBigIntMedian = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, bigint[], bigint> | SynchronousCollector<E, bigint[], bigint> => {
    return SynchronousCollector.full((): bigint[] => [], (array: bigint[], element: bigint | E): bigint[] => {
        let resolved: bigint = mapper(element as E);
        array.push(resolved);
        array.sort((a: bigint, b: bigint): number => Number(a - b));
        return array;
    }, (array: bigint[]): bigint => {
        let length: number = array.length;
        if (length % 2 === 0) {
            let mid: number = length / 2;
            return (array[Number(mid - 1)] + array[mid]) / 2n;
        }
        else {
            let mid: number = Math.floor(length / 2);
            return array[mid];
        }
    }) as SynchronousCollector<bigint, bigint[], bigint> | SynchronousCollector<E, bigint[], bigint>;
};
/**
 * Creates a collector that buffers elements and finishes with a synchronous generator object over the buffer.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousToGeneratorFunction: <E>() => SynchronousCollector<E, Array<E>, globalThis.Generator<E, void, undefined>> = <E>(): SynchronousCollector<E, Array<E>, globalThis.Generator<E, void, undefined>> => {
    return SynchronousCollector.full((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): globalThis.Generator<E, void, undefined> => {
        return (function* () {
            for (let element of array) {
                yield element;
            }
        })();
    });
};
/**
 * Creates a collector that buffers elements and finishes with an asynchronous generator object over the buffer.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousToAsyncGeneratorFunction: <E>() => SynchronousCollector<E, Array<E>, globalThis.AsyncGenerator<E, void, undefined>> = <E>(): SynchronousCollector<E, Array<E>, globalThis.AsyncGenerator<E, void, undefined>> => {
    return SynchronousCollector.full((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): globalThis.AsyncGenerator<E, void, undefined> => {
        return (async function* () {
            for (let element of array) {
                yield element;
            }
        })();
    });
};
