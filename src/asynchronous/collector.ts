import { isFunction, isNumber, isBigInt, isAsyncIterable, isAsyncFunction } from "#semantic/guard";
import { AsynchronousCollectorSymbol } from "#semantic/symbol";
import type { BiFunctional, BiPredicate, Functional, Predicate, Supplier, TriFunctional, TriPredicate, Consumer, AsynchronousGenerator } from "#semantic/utility";
/**
 * An immutable collection strategy for asynchronous sources, with fresh accumulation state per collection.
 *
 * @template E - The source element type.
 * @template A - The accumulator type.
 * @template R - The finished result type.
 */
export class AsynchronousCollector<E, A, R> {
    protected identity: Supplier<A>;
    protected interrupt: Predicate<E> | BiPredicate<E, bigint> | TriPredicate<E, bigint, A>;
    protected accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>;
    protected finisher: Functional<A, R>;
    protected readonly AsynchronousCollector: symbol = AsynchronousCollectorSymbol;
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
                "AsynchronousCollector": {
                    value: AsynchronousCollectorSymbol,
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
     * @returns A promise resolving to the finished accumulation result.
     */
    public async collect(generator: AsynchronousGenerator<E>): Promise<R>;
    /**
     * Consumes a generator, iterable or ascending unit-step numeric range, checking interruption before accumulation. Numeric ranges use the smaller inclusive bound and larger exclusive bound.
     *
     * @param iterable - The iterable source to consume.
     * @returns A promise resolving to the finished accumulation result.
     */
    public async collect(iterable: AsyncIterable<E>): Promise<R>;
    /**
     * Consumes a generator, iterable or ascending unit-step numeric range, checking interruption before accumulation. Numeric ranges use the smaller inclusive bound and larger exclusive bound.
     *
     * @param start - The first numeric bound; the smaller bound is inclusive.
     * @param end - The second numeric bound; the larger bound is exclusive.
     * @returns A promise resolving to the finished accumulation result.
     */
    public async collect(start: number, end: number): Promise<R>;
    /**
     * Consumes a generator, iterable or ascending unit-step numeric range, checking interruption before accumulation. Numeric ranges use the smaller inclusive bound and larger exclusive bound.
     *
     * @param start - The first numeric bound; the smaller bound is inclusive.
     * @param end - The second numeric bound; the larger bound is exclusive.
     * @returns A promise resolving to the finished accumulation result.
     */
    public async collect(start: bigint, end: bigint): Promise<R>;
    /**
     * Consumes a generator, iterable or ascending unit-step numeric range, checking interruption before accumulation. Numeric ranges use the smaller inclusive bound and larger exclusive bound.
     *
     * @param argument1 - The source generator, iterable or first numeric range bound.
     * @param argument2 - The second bound when a numeric range is supplied.
     * @returns A promise resolving to the finished accumulation result.
     */
    public async collect(argument1: AsynchronousGenerator<E> | AsyncIterable<E> | number | bigint, argument2?: number | bigint): Promise<R> {
        if (isAsyncFunction(argument1) || isFunction(argument1)) {
            return await new Promise<R>(async (resolve: Consumer<R>, reject: Consumer<any>): Promise<void> => {
                try {
                    let generator: AsynchronousGenerator<E> = argument1 as AsynchronousGenerator<E>;
                    let accumulator: A = this.identity();
                    let count: bigint = 0n;
                    await generator((element: E, index: bigint): void => {
                        accumulator = this.accumulator(accumulator, element, index);
                        count++;
                    }, (element: E, index: bigint): boolean => this.interrupt(element, index, accumulator))
                        .then((): void => {
                        resolve(this.finisher(accumulator));
                    }, reject);
                }
                catch (error) {
                    reject(error);
                }
            });
        }
        else if (isAsyncIterable(argument1)) {
            return new Promise<R>(async (resolve: Consumer<R>, reject: Consumer<any>): Promise<void> => {
                try {
                    let iterable: AsyncIterable<E> = argument1 as AsyncIterable<E>;
                    let accumulator: A = this.identity();
                    let count: bigint = 0n;
                    for await (let element of iterable) {
                        if (this.interrupt(element, count, accumulator)) {
                            break;
                        }
                        accumulator = this.accumulator(accumulator, element, count);
                        count++;
                    }
                    resolve(this.finisher(accumulator));
                }
                catch (error) {
                    reject(error);
                }
            });
        }
        else if (isNumber(argument1) && isNumber(argument2)) {
            return new Promise<R>(async (resolve: Consumer<R>, reject: Consumer<any>): Promise<void> => {
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
                    resolve(this.finisher(accumulator));
                }
                catch (error) {
                    reject(error);
                }
            });
        }
        else if (isBigInt(argument1) && isBigInt(argument2)) {
            return new Promise<R>(async (resolve: Consumer<R>, reject: Consumer<any>): Promise<void> => {
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
                    resolve(this.finisher(accumulator));
                }
                catch (error) {
                    reject(error);
                }
            });
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
    public static full<E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
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
    public static full<E, A, R>(identity: Supplier<A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
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
    public static full<E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R> {
        return new AsynchronousCollector(identity, () => false, accumulator, finisher);
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
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
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
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
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
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
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
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
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
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
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
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
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
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: Predicate<E> | BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R> {
        return new AsynchronousCollector<E, A, R>(identity, interrupt, accumulator, finisher);
    }
}
;
