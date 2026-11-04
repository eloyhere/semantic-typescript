import { useSynchronousAnyMatch, useSynchronousAllMatch, useSynchronousCollect, useSynchronousCount, useSynchronousError, useSynchronousFindAny, useSynchronousFindAt, useSynchronousFindFirst, useSynchronousFindLast, useSynchronousFindMaximum, useSynchronousFindMinimum, useSynchronousForEach, useSynchronousGroup, useSynchronousGroupBy, useSynchronousJoin, useSynchronousLog, useSynchronousNoneMatch, useSynchronousPartition, useSynchronousPartitionBy, useSynchronousReduce, useSynchronousToArray, useSynchronousToMap, useSynchronousToSet, useSynchronousWrite, useSynchronousFrequency, useSynchronousBigIntAverage, useSynchronousBigIntMedian, useSynchronousBigIntMode, useSynchronousBigIntSummate, useSynchronousNumericAverage, useSynchronousNumericMedian, useSynchronousNumericMode, useSynchronousNumericStandardDeviation, useSynchronousNumericSummate, useSynchronousNumericVariance, useSynchronousFindNegativeAt, useSynchronousToIndexedArray } from "#semantic/synchronous/collector";
import { isFunction, isSynchronousSemantic, isIterable, isNumber, isBigInt, isObject, isString, isSynchronousCollectable, isSynchronousCollector } from "#semantic/guard";
import { useCompare, useRandom, useToBigInt, useToNumber } from "#semantic/hook";
import { SynchronousOrderedCollectableSymbol, SynchronousBigIntStatisticsSymbol, SynchronousCollectableSymbol, SynchronousNumericStatisticsSymbol, SynchronousSemanticSymbol, SynchronousWindowCollectableSymbol, SynchronousUnorderedCollectableSymbol, SynchronousStatisticsSymbol } from "#semantic/symbol";
import { invalidate, validate, type BiConsumer, type BiFunctional, type BiPredicate, type Comparator, type Consumer, type Functional, type Indexed, type Predicate, type Supplier, type SynchronousGenerator, type TriFunctional, type TriPredicate } from "#semantic/utility";
import { SynchronousCollector } from "#semantic/synchronous/collector";
import type { Optional } from "#semantic/optional";
/**
 * A lazy callback-based pipeline whose transformations run when consumed.
 *
 * @template E - The source element type.
 */
export class SynchronousSemantic<E> {
    protected generator: SynchronousGenerator<E>;
    protected readonly SynchronousSemantic: Symbol = SynchronousSemanticSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "SynchronousSemantic";
    /**
     * Creates a lazy source from the generator.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: SynchronousGenerator<E>) {
        if (isFunction(generator)) {
            this.generator = generator;
            Object.defineProperties(this, {
                "SynchronousSemantic": {
                    value: SynchronousSemanticSymbol,
                    writable: false,
                    enumerable: false,
                    configurable: false
                },
                "generator": {
                    value: generator,
                    writable: false,
                    enumerable: false,
                    configurable: false
                }
            });
        }
        else {
            throw new TypeError("Invalid arguments.");
        }
    }
    /**
     * Creates a lazy pipeline emitting this source followed by another source.
     *
     * @param other - The source to append.
     * @returns A concatenated pipeline.
     */
    public concat(other: SynchronousSemantic<E>): SynchronousSemantic<E>;
    /**
     * Creates a lazy pipeline emitting this source followed by another source.
     *
     * @param other - The source to append.
     * @returns A concatenated pipeline.
     */
    public concat(other: Iterable<E>): SynchronousSemantic<E>;
    /**
     * Creates a lazy pipeline emitting this source followed by another source.
     *
     * @param argument - The value or callback selected by the overload.
     * @returns A concatenated pipeline.
     */
    public concat(argument: SynchronousSemantic<E> | Iterable<E>): SynchronousSemantic<E> {
        if (isSynchronousSemantic(argument)) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    let other: SynchronousSemantic<E> = argument as unknown as SynchronousSemantic<E>;
                    let generator: SynchronousGenerator<E> = other.source();
                    let count: bigint = 0n;
                    let stop: boolean = false;
                    let interrupted = (element: E): boolean => stop = stop || interrupt(element, count);
                    let emit = (element: E): void => {
                        if (interrupted(element)) {
                            return;
                        }
                        accept(element, count);
                        stop = stop || interrupt(element, count);
                        count++;
                    };
                    this.generator(emit, interrupted);
                    if (!stop) {
                        generator(emit, interrupted);
                    }
                }
                catch (error) {
                    throw error;
                }
            });
        }
        if (isIterable(argument)) {
            let other: Iterable<E> = argument as unknown as Iterable<E>;
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    let count: bigint = 0n;
                    let stop: boolean = false;
                    let interrupted = (element: E): boolean => stop = stop || interrupt(element, count);
                    this.generator((element: E): void => {
                        if (interrupted(element)) {
                            return;
                        }
                        accept(element, count);
                        stop = stop || interrupt(element, count);
                        count++;
                    }, interrupted);
                    if (!stop) {
                        for (let element of other) {
                            if (interrupted(element)) {
                                break;
                            }
                            accept(element, count);
                            stop = stop || interrupt(element, count);
                            count++;
                            if (stop) {
                                break;
                            }
                        }
                    }
                }
                catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Keeps the first element for each extracted key using Set equality, preserving source indices.
     *
     * @returns A lazy pipeline of distinct elements.
     */
    public distinct(): SynchronousSemantic<E>;
    /**
     * Keeps the first element for each extracted key using Set equality, preserving source indices.
     *
     * @template K - The extracted key type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @returns A lazy pipeline of distinct elements.
     */
    public distinct<K>(keyExtractor: Functional<E, K>): SynchronousSemantic<E>;
    /**
     * Keeps the first element for each extracted key using Set equality, preserving source indices.
     *
     * @template K - The extracted key type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @returns A lazy pipeline of distinct elements.
     */
    public distinct<K>(keyExtractor: BiFunctional<E, bigint, K>): SynchronousSemantic<E>;
    /**
     * Keeps the first element for each extracted key using Set equality, preserving source indices.
     *
     * @template K - The extracted key type.
     * @param argument1 - The first argument selected by the overload.
     * @returns A lazy pipeline of distinct elements.
     */
    public distinct<K = E>(argument1?: Functional<E, K> | BiFunctional<E, bigint, K>): SynchronousSemantic<E> {
        let keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K> = validate(argument1) ? argument1 : (element: E): K => element as unknown as K;
        return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            try {
                let set: Set<K> = new Set<K>();
                this.generator((element: E, index: bigint) => {
                    let key: K = keyExtractor(element, index);
                    if (!set.has(key)) {
                        set.add(key);
                        accept(element, index);
                    }
                }, interrupt);
            }
            catch (error) {
                throw error;
            }
        });
    }
    /**
     * Drops the matching initial run, then emits the remaining elements with consecutive indices.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A pipeline without the matching prefix.
     */
    public dropWhile(predicate: Predicate<E>): SynchronousSemantic<E>;
    /**
     * Drops the matching initial run, then emits the remaining elements with consecutive indices.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A pipeline without the matching prefix.
     */
    public dropWhile(predicate: BiPredicate<E, bigint>): SynchronousSemantic<E>;
    /**
     * Drops the matching initial run, then emits the remaining elements with consecutive indices.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A pipeline without the matching prefix.
     */
    public dropWhile(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousSemantic<E> {
        if (isFunction(predicate)) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    let count: bigint = 0n;
                    let dropping: boolean = true;
                    this.generator((element: E, index: bigint): void => {
                        if (dropping && predicate(element, index)) {
                            return;
                        }
                        dropping = false;
                        accept(element, count);
                        count++;
                    }, interrupt);
                }
                catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Forwards only matching elements, preserving their source indices.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A lazy filtered pipeline.
     */
    public filter(predicate: Predicate<E>): SynchronousSemantic<E>;
    /**
     * Forwards only matching elements, preserving their source indices.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A lazy filtered pipeline.
     */
    public filter(predicate: BiPredicate<E, bigint>): SynchronousSemantic<E>;
    /**
     * Forwards only matching elements, preserving their source indices.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A lazy filtered pipeline.
     */
    public filter(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousSemantic<E> {
        if (isFunction(predicate)) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        if (predicate(element, index)) {
                            accept(element, index);
                        }
                    }, interrupt);
                }
                catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Maps each element to a source and flattens its elements into the same element type.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A flattened pipeline with consecutive output indices.
     */
    public flat(mapper: Functional<E, Iterable<E>>): SynchronousSemantic<E>;
    /**
     * Maps each element to a source and flattens its elements into the same element type.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A flattened pipeline with consecutive output indices.
     */
    public flat(mapper: BiFunctional<E, bigint, Iterable<E>>): SynchronousSemantic<E>;
    /**
     * Maps each element to a source and flattens its elements into the same element type.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A flattened pipeline with consecutive output indices.
     */
    public flat(mapper: Functional<E, SynchronousSemantic<E>>): SynchronousSemantic<E>;
    /**
     * Maps each element to a source and flattens its elements into the same element type.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A flattened pipeline with consecutive output indices.
     */
    public flat(mapper: BiFunctional<E, bigint, SynchronousSemantic<E>>): SynchronousSemantic<E>;
    /**
     * Maps each element to a source and flattens its elements into the same element type.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A flattened pipeline with consecutive output indices.
     */
    public flat(mapper: Functional<E, Iterable<E>> | BiFunctional<E, bigint, Iterable<E>> | Functional<E, SynchronousSemantic<E>> | BiFunctional<E, bigint, SynchronousSemantic<E>>): SynchronousSemantic<E> {
        if (isFunction(mapper)) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    let count: bigint = 0n;
                    let stop: boolean = false;
                    this.generator((element: E, index: bigint): void => {
                        if (stop) {
                            return;
                        }
                        let result: SynchronousSemantic<E> | Iterable<E> = mapper(element, index);
                        if (isIterable(result)) {
                            for (let subElement of result) {
                                if (stop || interrupt(subElement, count)) {
                                    stop = true;
                                    break;
                                }
                                accept(subElement, count);
                                stop = stop || interrupt(subElement, count);
                                count++;
                                if (stop) {
                                    break;
                                }
                            }
                        }
                        else if (isSynchronousSemantic(result)) {
                            result.generator((subElement: E): void => {
                                if (stop || interrupt(subElement, count)) {
                                    stop = true;
                                    return;
                                }
                                accept(subElement, count);
                                stop = stop || interrupt(subElement, count);
                                count++;
                            }, (element: E): boolean => stop = stop || interrupt(element, count));
                        }
                    }, (): boolean => stop);
                }
                catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Maps each element to a source and flattens the resulting sources.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of flattened mapped elements.
     */
    public flatMap<R>(mapper: Functional<E, Iterable<R>>): SynchronousSemantic<R>;
    /**
     * Maps each element to a source and flattens the resulting sources.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of flattened mapped elements.
     */
    public flatMap<R>(mapper: BiFunctional<E, bigint, Iterable<R>>): SynchronousSemantic<R>;
    /**
     * Maps each element to a source and flattens the resulting sources.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of flattened mapped elements.
     */
    public flatMap<R>(mapper: Functional<E, SynchronousSemantic<R>>): SynchronousSemantic<R>;
    /**
     * Maps each element to a source and flattens the resulting sources.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of flattened mapped elements.
     */
    public flatMap<R>(mapper: BiFunctional<E, bigint, SynchronousSemantic<R>>): SynchronousSemantic<R>;
    /**
     * Maps each element to a source and flattens the resulting sources.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of flattened mapped elements.
     */
    public flatMap<R>(mapper: Functional<E, Iterable<R> | SynchronousSemantic<R>> | BiFunctional<E, bigint, Iterable<R> | SynchronousSemantic<R>>): SynchronousSemantic<R> {
        if (isFunction(mapper)) {
            return new SynchronousSemantic<R>((accept: Consumer<R> | BiConsumer<R, bigint>, interrupt: Predicate<R> | BiPredicate<R, bigint>): void => {
                try {
                    let count: bigint = 0n;
                    let stop: boolean = false;
                    this.generator((element: E, index: bigint): void => {
                        if (stop) {
                            return;
                        }
                        let transform: SynchronousSemantic<R> | Iterable<R> = mapper(element, index);
                        if (isIterable(transform)) {
                            for (let subElement of transform) {
                                if (stop || interrupt(subElement, count)) {
                                    stop = true;
                                    break;
                                }
                                accept(subElement, count);
                                stop = stop || interrupt(subElement, count);
                                count++;
                                if (stop) {
                                    break;
                                }
                            }
                        }
                        else if (isSynchronousSemantic(transform)) {
                            transform.source()((subElement: R): void => {
                                if (stop || interrupt(subElement, count)) {
                                    stop = true;
                                    return;
                                }
                                accept(subElement, count);
                                stop = stop || interrupt(subElement, count);
                                count++;
                            }, (element: R): boolean => stop = stop || interrupt(element, count));
                        }
                    }, (): boolean => stop);
                }
                catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Emits at most the requested count and interrupts further traversal.
     *
     * @param count - The requested count.
     * @returns A lazy limited pipeline.
     */
    public limit(count: number): SynchronousSemantic<E>;
    /**
     * Emits at most the requested count and interrupts further traversal.
     *
     * @param count - The requested count.
     * @returns A lazy limited pipeline.
     */
    public limit(count: bigint): SynchronousSemantic<E>;
    /**
     * Emits at most the requested count and interrupts further traversal.
     *
     * @param argument - The value or callback selected by the overload.
     * @returns A lazy limited pipeline.
     */
    public limit(argument: bigint | number): SynchronousSemantic<E> {
        if (isNumber(argument)) {
            let limit: bigint = BigInt(argument);
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    let count: bigint = 0n;
                    this.generator((element: E): void => {
                        if (count < limit) {
                            accept(element, count);
                            count++;
                        }
                    }, (element: E, index: bigint): boolean => interrupt(element, index) || count >= limit);
                }
                catch (error) {
                    throw error;
                }
            });
        }
        if (isBigInt(argument)) {
            let limit: bigint = argument;
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    let count: bigint = 0n;
                    this.generator((element: E): void => {
                        if (count < limit) {
                            accept(element, count);
                            count++;
                        }
                    }, (element: E, index: bigint): boolean => interrupt(element, index) || count >= limit);
                }
                catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Transforms each element, preserving its source index.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of mapped elements.
     */
    public map(mapper: Functional<E, E>): SynchronousSemantic<E>;
    /**
     * Transforms each element, preserving its source index.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of mapped elements.
     */
    public map(mapper: BiFunctional<E, bigint, E>): SynchronousSemantic<E>;
    /**
     * Transforms each element, preserving its source index.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of mapped elements.
     */
    public map<R>(mapper: Functional<E, R>): SynchronousSemantic<R>;
    /**
     * Transforms each element, preserving its source index.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of mapped elements.
     */
    public map<R>(mapper: BiFunctional<E, bigint, R>): SynchronousSemantic<R>;
    /**
     * Transforms each element, preserving its source index.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of mapped elements.
     */
    public map<R = E>(mapper: Functional<E, R> | BiFunctional<E, bigint, R>): SynchronousSemantic<R> {
        if (isFunction(mapper)) {
            return new SynchronousSemantic<R>((accept: Consumer<R> | BiConsumer<R, bigint>, interrupt: Predicate<R> | BiPredicate<R, bigint>): void => {
                try {
                    let stop: boolean = false;
                    this.generator((element: E, index: bigint): void => {
                        let resolved: R = mapper(element, index);
                        accept(resolved, index);
                        stop = stop || interrupt(resolved, index);
                    }, (): boolean => stop);
                }
                catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Invokes an observer after each element is forwarded during traversal.
     *
     * @param consumer - Observes each forwarded element and optional bigint index.
     * @returns A pipeline that performs the observation when consumed.
     */
    public peek(consumer: Consumer<E>): SynchronousSemantic<E>;
    /**
     * Invokes an observer after each element is forwarded during traversal.
     *
     * @param consumer - Observes each forwarded element and optional bigint index.
     * @returns A pipeline that performs the observation when consumed.
     */
    public peek(consumer: BiConsumer<E, bigint>): SynchronousSemantic<E>;
    /**
     * Invokes an observer after each element is forwarded during traversal.
     *
     * @param consumer - Observes each forwarded element and optional bigint index.
     * @returns A pipeline that performs the observation when consumed.
     */
    public peek(consumer: Consumer<E> | BiConsumer<E, bigint>): SynchronousSemantic<E> {
        if (isFunction(consumer)) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, index);
                        consumer(element, index);
                    }, interrupt);
                }
                catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Replaces emitted indices with calculated indices, preserving emission order.
     *
     * @param redirector - Calculates the replacement bigint index.
     * @returns A pipeline with redirected indices.
     */
    public redirect(redirector: BiFunctional<E, bigint, bigint>): SynchronousSemantic<E> {
        if (isFunction(redirector)) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, redirector(element, index));
                    }, interrupt);
                }
                catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Replaces each index with its negation minus one; an ordered collectable applies the resulting order.
     *
     * @returns A pipeline carrying reversed indices.
     */
    public reverse(): SynchronousSemantic<E> {
        return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            try {
                this.generator((element: E, index: bigint): void => {
                    accept(element, -index - 1n);
                }, interrupt);
            }
            catch (error) {
                throw error;
            }
        });
    }
    /**
     * Assigns random or mapped indices; an ordered collectable applies the resulting order.
     *
     * @returns A pipeline carrying shuffled indices.
     */
    public shuffle(): SynchronousSemantic<E>;
    /**
     * Assigns random or mapped indices; an ordered collectable applies the resulting order.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline carrying shuffled indices.
     */
    public shuffle(mapper: BiFunctional<E, bigint, bigint>): SynchronousSemantic<E>;
    /**
     * Assigns random or mapped indices; an ordered collectable applies the resulting order.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline carrying shuffled indices.
     */
    public shuffle(mapper?: BiFunctional<E, bigint, bigint>): SynchronousSemantic<E> {
        if (isFunction(mapper)) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, mapper(element, index));
                    }, interrupt);
                }
                catch (error) {
                    throw error;
                }
            });
        }
        return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            try {
                this.generator((element: E, _index: bigint): void => {
                    accept(element, useRandom(0n, SHUFFLE_BOUND));
                }, interrupt);
            }
            catch (error) {
                throw error;
            }
        });
    }
    /**
     * Skips the requested number of encountered elements, preserving the remaining indices.
     *
     * @param count - The requested count.
     * @returns A pipeline without the skipped prefix.
     */
    public skip(count: number): SynchronousSemantic<E>;
    /**
     * Skips the requested number of encountered elements, preserving the remaining indices.
     *
     * @param count - The requested count.
     * @returns A pipeline without the skipped prefix.
     */
    public skip(count: bigint): SynchronousSemantic<E>;
    /**
     * Skips the requested number of encountered elements, preserving the remaining indices.
     *
     * @param argument - The value or callback selected by the overload.
     * @returns A pipeline without the skipped prefix.
     */
    public skip(argument: number | bigint): SynchronousSemantic<E> {
        if (isNumber(argument)) {
            let n: number = argument;
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    let count: bigint = 0n;
                    let limit: bigint = BigInt(n);
                    this.generator((element: E, index: bigint): void => {
                        if (count < limit) {
                            count++;
                        }
                        else {
                            accept(element, index);
                        }
                    }, interrupt);
                }
                catch (error) {
                    throw error;
                }
            });
        }
        if (isBigInt(argument)) {
            let n: bigint = argument;
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    let count: bigint = 0n;
                    this.generator((element: E, index: bigint): void => {
                        if (count < n) {
                            count++;
                        }
                        else {
                            accept(element, index);
                        }
                    }, interrupt);
                }
                catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Exposes the callback-based generator used to traverse this source.
     *
     * @returns The generator accepting element and interruption callbacks.
     */
    public source(): SynchronousGenerator<E> {
        return this.generator;
    }
    /**
     * Selects positions from the smaller inclusive bound to the larger exclusive bound, preserving indices.
     *
     * @param start - The inclusive positional bound; the smaller supplied bound is used first.
     * @param end - The exclusive positional bound; the larger supplied bound is used last.
     * @returns A pipeline for the selected positional interval.
     */
    public sub(start: number, end: number): SynchronousSemantic<E>;
    /**
     * Selects positions from the smaller inclusive bound to the larger exclusive bound, preserving indices.
     *
     * @param start - The inclusive positional bound; the smaller supplied bound is used first.
     * @param end - The exclusive positional bound; the larger supplied bound is used last.
     * @returns A pipeline for the selected positional interval.
     */
    public sub(start: bigint, end: bigint): SynchronousSemantic<E>;
    /**
     * Selects positions from the smaller inclusive bound to the larger exclusive bound, preserving indices.
     *
     * @param start - The inclusive positional bound; the smaller supplied bound is used first.
     * @param end - The exclusive positional bound; the larger supplied bound is used last.
     * @returns A pipeline for the selected positional interval.
     */
    public sub(start: number | bigint, end: number | bigint): SynchronousSemantic<E> {
        if ((isNumber(start) && isNumber(end)) || (isBigInt(start) && isBigInt(end))) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    let count: bigint = 0n;
                    let resolvedStart: bigint = useToBigInt(start);
                    let resolvedEnd: bigint = useToBigInt(end);
                    let minimum: bigint = resolvedStart < resolvedEnd ? resolvedStart : resolvedEnd;
                    let maximum: bigint = resolvedStart < resolvedEnd ? resolvedEnd : resolvedStart;
                    this.generator((element: E, index: bigint): void => {
                        if (minimum <= count && count < maximum) {
                            accept(element, index);
                        }
                        count++;
                    }, (element: E, index: bigint): boolean => count >= maximum || interrupt(element, index));
                }
                catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Forwards the matching initial run and stops at the first predicate failure.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A pipeline containing the matching prefix.
     */
    public takeWhile(predicate: Predicate<E>): SynchronousSemantic<E>;
    /**
     * Forwards the matching initial run and stops at the first predicate failure.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A pipeline containing the matching prefix.
     */
    public takeWhile(predicate: BiPredicate<E, bigint>): SynchronousSemantic<E>;
    /**
     * Forwards the matching initial run and stops at the first predicate failure.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A pipeline containing the matching prefix.
     */
    public takeWhile(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousSemantic<E> {
        return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            try {
                let stop: boolean = false;
                this.generator((element: E, index: bigint) => {
                    if (predicate(element, index) && !stop) {
                        accept(element, index);
                    }
                    else {
                        stop = true;
                    }
                }, (element: E, index: bigint): boolean => stop || interrupt(element, index));
            }
            catch (error) {
                throw error;
            }
        });
    }
    /**
     * Creates a collectable, accepting a recognised mapper result or falling back to an unordered buffer.
     *
     * @returns The resulting collectable.
     */
    public toCollectable(): SynchronousCollectable<E>;
    /**
     * Creates a collectable, accepting a recognised mapper result or falling back to an unordered buffer.
     *
     * @template C - The collectable implementation type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The resulting collectable.
     */
    public toCollectable<C extends SynchronousCollectable<E>>(mapper: Functional<SynchronousGenerator<E>, C>): C;
    /**
     * Creates a collectable, accepting a recognised mapper result or falling back to an unordered buffer.
     *
     * @template C - The collectable implementation type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The resulting collectable.
     */
    public toCollectable<C extends SynchronousCollectable<E>>(mapper?: Functional<SynchronousGenerator<E>, C>): SynchronousCollectable<E> | C {
        if (isFunction(mapper)) {
            try {
                let SynchronousCollectable: C = mapper(this.generator);
                if (isSynchronousCollectable(SynchronousCollectable)) {
                    return SynchronousCollectable;
                }
            }
            catch (error) {
                throw error;
            }
        }
        try {
            return new SynchronousUnorderedCollectable(this.generator);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Buffers the source for statistics with bigint results.
     *
     * @returns A bigint statistics view.
     */
    public toBigintStatistics(): SynchronousBigIntStatistics<E> {
        try {
            return new SynchronousBigIntStatistics<E>(this.generator);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Buffers the source for statistics with number results.
     *
     * @returns A numeric statistics view.
     */
    public toNumericStatistics(): SynchronousNumericStatistics<E> {
        try {
            return new SynchronousNumericStatistics<E>(this.generator);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Buffers and sorts by a comparator, or by normalised source indices when omitted.
     *
     * @returns An ordered collectable.
     */
    public toOrdered(): SynchronousOrderedCollectable<E>;
    /**
     * Buffers and sorts by a comparator, or by normalised source indices when omitted.
     *
     * @param comparator - The comparison function; defaults to the library comparator.
     * @returns An ordered collectable.
     */
    public toOrdered(comparator: Comparator<E>): SynchronousOrderedCollectable<E>;
    /**
     * Buffers and sorts by a comparator, or by normalised source indices when omitted.
     *
     * @param comparator - The comparison function; defaults to the library comparator.
     * @returns An ordered collectable.
     */
    public toOrdered(comparator?: Comparator<E>): SynchronousOrderedCollectable<E> {
        try {
            if (isFunction(comparator)) {
                return new SynchronousOrderedCollectable(this.generator, comparator);
            }
            return new SynchronousOrderedCollectable(this.generator);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Buffers the source in encounter order, preserving entries with duplicate indices.
     *
     * @returns An unordered collectable.
     */
    public toUnordered(): SynchronousUnorderedCollectable<E> {
        try {
            return new SynchronousUnorderedCollectable(this.generator);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Buffers and sorts the source for window operations.
     *
     * @returns A window-capable collectable.
     */
    public toWindow(): SynchronousWindowCollectable<E> {
        try {
            return new SynchronousWindowCollectable<E>(this.generator);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Adds a fixed or calculated offset to each emitted index.
     *
     * @param offset - The offset added to each emitted index.
     * @returns A pipeline carrying translated indices.
     */
    public translate(offset: number): SynchronousSemantic<E>;
    /**
     * Adds a fixed or calculated offset to each emitted index.
     *
     * @param offset - The offset added to each emitted index.
     * @returns A pipeline carrying translated indices.
     */
    public translate(offset: bigint): SynchronousSemantic<E>;
    /**
     * Adds a fixed or calculated offset to each emitted index.
     *
     * @param translator - Calculates the offset to add to each index.
     * @returns A pipeline carrying translated indices.
     */
    public translate(translator: BiFunctional<E, bigint, bigint>): SynchronousSemantic<E>;
    /**
     * Adds a fixed or calculated offset to each emitted index.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A pipeline carrying translated indices.
     */
    public translate(argument1: number | bigint | BiFunctional<E, bigint, bigint>): SynchronousSemantic<E> {
        if (isNumber(argument1) || isBigInt(argument1)) {
            let offset: bigint = useToBigInt(argument1);
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, index + offset);
                    }, interrupt);
                }
                catch (error) {
                    throw error;
                }
            });
        }
        else if (isFunction(argument1)) {
            let translator: BiFunctional<E, bigint, bigint> = argument1;
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, index + translator(element, index));
                    }, interrupt);
                }
                catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }
}
;
/**
 * The base terminal-operation API for traversable element sources.
 *
 * @template E - The source element type.
 */
export abstract class SynchronousCollectable<E> implements Iterable<E> {
    protected readonly SynchronousCollectable: symbol = SynchronousCollectableSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "SynchronousCollectable";
    /**
     * Initialises the collectable identity.
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
     * Iterates over the elements in this collectable traversal order.
     *
     * @returns An iterator over the collected elements.
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
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param argument1 - The first argument selected by the overload.
     * @param argument2 - The optional second argument selected by the overload.
     * @param argument3 - The optional third argument selected by the overload.
     * @param argument4 - The optional finisher for interruptible collection.
     * @returns The finished result for the selected overload.
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
     * Invokes the action for every encountered element.
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
     * Passes the underlying generator to a pipeline conversion.
     *
     * @template R - The mapped or finished result type.
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
     * Creates a semantic pipeline backed by this collectable.
     *
     * @returns A semantic view of this source.
     */
    public semantic(): SynchronousSemantic<E> {
        let source: SynchronousGenerator<E> = this.source();
        if (isFunction(source)) {
            try {
                return new SynchronousSemantic(source);
            }
            catch (error) {
                throw error;
            }
        }
        else {
            throw new TypeError("Invalid source.");
        }
    }
    /**
     * Exposes the callback-based generator used to traverse this source.
     *
     * @returns The generator accepting element and interruption callbacks.
     */
    public abstract source(): SynchronousGenerator<E>;
    /**
     * Collects elements into an array in traversal order.
     *
     * @returns A new element array.
     */
    public toArray(): Array<E> {
        try {
            return useSynchronousToArray<E>().collect(this.source());
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
    public toMap<K, E>(keyExtractor: Functional<E, K>): Map<K, E>;
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
     * @returns The set of distinct elements.
     */
    public toSet(): Set<E> {
        try {
            return useSynchronousToSet<E>().collect(this.source());
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
}
;
const SURROGATE_BASE: bigint = 1n << 96n;
const SHUFFLE_BOUND: bigint = 1n << 62n;
/**
 * A buffered source ordered by comparator or normalised source indices.
 *
 * @template E - The source element type.
 */
export class SynchronousOrderedCollectable<E> extends SynchronousCollectable<E> {
    protected readonly OrderedCollectable: symbol = SynchronousOrderedCollectableSymbol;
    protected buffer: Array<Indexed<E>> = [];
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "SynchronousOrderedCollectable";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: SynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
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
     * Iterates over the elements in this collectable traversal order.
     *
     * @returns An iterator over the collected elements.
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
     * Exposes the callback-based generator used to traverse this source.
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
     * Checks whether the source has no elements.
     *
     * @returns Whether the element count is zero.
     */
    public override isEmpty(): boolean {
        return this.buffer.length === 0;
    }
    /**
     * Counts the elements in the source.
     *
     * @returns The element count as a bigint.
     */
    public override count(): bigint {
        return BigInt(this.buffer.length);
    }
}
;
/**
 * A buffered source traversed in encounter order, preserving duplicate-index entries.
 *
 * @template E - The source element type.
 */
export class SynchronousUnorderedCollectable<E> extends SynchronousCollectable<E> {
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
     * Starts buffering the generator for this collectable.
     *
     * @param argument1 - The first argument selected by the overload.
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
     * Iterates over the elements in this collectable traversal order.
     *
     * @returns An iterator over the collected elements.
     */
    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let [_index, element] of this.buffer) {
            yield element;
        }
    }
    /**
     * Exposes the callback-based generator used to traverse this source.
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
}
;
/**
 * The base statistics API over a buffered ordered source.
 *
 * @template E - The source element type.
 * @template D - The numeric result type.
 */
export abstract class SynchronousStatistics<E, D extends number | bigint> extends SynchronousOrderedCollectable<E> {
    protected readonly SynchronousStatistics: symbol = SynchronousStatisticsSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "SynchronousStatistics";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: SynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: SynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param parameter - The callback-based source to buffer.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(parameter: SynchronousGenerator<E>, comparator?: Comparator<E>) {
        super(parameter, validate(comparator) ? comparator : useCompare);
        Object.defineProperties(this, {
            "SynchronousStatistics": {
                value: SynchronousStatisticsSymbol,
                enumerable: false,
                writable: false,
                configurable: false
            }
        });
    }
    /**
     * Iterates over the elements in this collectable traversal order.
     *
     * @returns An iterator over the collected elements.
     */
    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let { element } of this.buffer) {
            yield element;
        }
    }
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @returns The average; bigint division truncates towards zero.
     */
    public abstract average(): D;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The average; bigint division truncates towards zero.
     */
    public abstract average(mapper: Functional<E, D>): D;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @returns The spread of the mapped values.
     */
    public abstract range(): D;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The spread of the mapped values.
     */
    public abstract range(mapper: Functional<E, D>): D;
    /**
     * Calculates population variance, returning zero for fewer than two elements.
     *
     * @returns The population variance, rounded to an integer for bigint results.
     */
    public abstract variance(): D;
    /**
     * Calculates population variance, returning zero for fewer than two elements.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The population variance, rounded to an integer for bigint results.
     */
    public abstract variance(mapper: Functional<E, D>): D;
    /**
     * Calculates the population standard deviation of mapped values.
     *
     * @returns The standard deviation, or zero when empty, rounded for bigint results.
     */
    public abstract standardDeviation(): D;
    /**
     * Calculates the population standard deviation of mapped values.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The standard deviation, or zero when empty, rounded for bigint results.
     */
    public abstract standardDeviation(mapper: Functional<E, D>): D;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @returns The mean, or zero when empty; bigint division truncates towards zero.
     */
    public abstract mean(): D;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The mean, or zero when empty; bigint division truncates towards zero.
     */
    public abstract mean(mapper: Functional<E, D>): D;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @returns The median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public abstract median(): D;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public abstract median(mapper: Functional<E, D>): D;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @returns The mode, or zero when empty.
     */
    public abstract mode(): D;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The mode, or zero when empty.
     */
    public abstract mode(mapper: Functional<E, D>): D;
    /**
     * Counts occurrences using Map key equality.
     *
     * @returns A map of elements to bigint occurrence counts.
     */
    public frequency(): Map<E, bigint> {
        return useSynchronousFrequency<E>().collect(this.source());
    }
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @returns The sum, or zero when empty.
     */
    public abstract summate(): D;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The sum, or zero when empty.
     */
    public abstract summate(mapper: Functional<E, D>): D;
    /**
     * Selects a nearest-rank quantile from sorted mapped values; probability zero selects the minimum.
     *
     * @param quantile - The finite probability from zero to one, inclusive.
     * @returns The selected value, or zero when empty.
     */
    public abstract quantile(quantile: number): D;
    /**
     * Selects a nearest-rank quantile from sorted mapped values; probability zero selects the minimum.
     *
     * @param quantile - The finite probability from zero to one, inclusive.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The selected value, or zero when empty.
     */
    public abstract quantile(quantile: number, mapper: Functional<E, D>): D;
    /**
     * Subtracts the first nearest-rank quartile from the third quartile.
     *
     * @returns The interquartile range, or zero when empty.
     */
    public abstract interquartileRange(): D;
    /**
     * Subtracts the first nearest-rank quartile from the third quartile.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The interquartile range, or zero when empty.
     */
    public abstract interquartileRange(mapper: Functional<E, D>): D;
    /**
     * Calculates the population third standardised moment.
     *
     * @returns The skewness, or zero when empty or constant; bigint results are rounded.
     */
    public abstract skewness(): D;
    /**
     * Calculates the population third standardised moment.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The skewness, or zero when empty or constant; bigint results are rounded.
     */
    public abstract skewness(mapper: Functional<E, D>): D;
    /**
     * Calculates population excess kurtosis by subtracting three from the fourth standardised moment.
     *
     * @returns The excess kurtosis, or zero when empty or constant; bigint results are rounded.
     */
    public abstract kurtosis(): D;
    /**
     * Calculates population excess kurtosis by subtracting three from the fourth standardised moment.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The excess kurtosis, or zero when empty or constant; bigint results are rounded.
     */
    public abstract kurtosis(mapper: Functional<E, D>): D;
}
;
/**
 * A buffered statistics view with bigint results and integer rounding where required.
 *
 * @template E - The source element type.
 */
export class SynchronousBigIntStatistics<E> extends SynchronousStatistics<E, bigint> {
    protected readonly BigIntStatistics: symbol = SynchronousBigIntStatisticsSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "SynchronousBigIntStatistics";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: SynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: SynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param parameter - The callback-based source to buffer.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(parameter: SynchronousGenerator<E>, comparator?: Comparator<E>) {
        super(parameter, comparator || useCompare);
        Object.defineProperties(this, {
            "SynchronousBigIntStatistics": {
                value: SynchronousBigIntStatisticsSymbol,
                enumerable: false,
                writable: false,
                configurable: false
            }
        });
    }
    /**
     * Iterates over the elements in this collectable traversal order.
     *
     * @returns An iterator over the collected elements.
     */
    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let { element } of this.buffer) {
            yield element;
        }
    }
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @returns The average; bigint division truncates towards zero.
     */
    public average(): bigint;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The average; bigint division truncates towards zero.
     */
    public average(mapper: Functional<E, bigint>): bigint;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The average; bigint division truncates towards zero.
     */
    public average(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntAverage(mapper).collect(this.source());
        }
        catch (error) {
            throw new Error("Uncaught error on average.");
        }
    }
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @returns The spread of the mapped values.
     */
    public range(): bigint;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The spread of the mapped values.
     */
    public range(mapper: Functional<E, bigint>): bigint;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The spread of the mapped values.
     */
    public range(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = this.toArray().map(mapper);
            let minimum: bigint = data[0];
            let maximum: bigint = data[0];
            for (let value of data) {
                if (value < minimum) minimum = value;
                if (value > maximum) maximum = value;
            }
            return maximum - minimum;
        }
        catch (error) {
            throw new Error("Uncaught error on range.");
        }
    }
    /**
     * Calculates population variance, returning zero for fewer than two elements.
     *
     * @returns The population variance, rounded to an integer for bigint results.
     */
    public variance(): bigint;
    /**
     * Calculates population variance, returning zero for fewer than two elements.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The population variance, rounded to an integer for bigint results.
     */
    public variance(mapper: Functional<E, bigint>): bigint;
    /**
     * Calculates population variance, returning zero for fewer than two elements.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The population variance, rounded to an integer for bigint results.
     */
    public variance(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty() || this.count() === 1n) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (this.toArray()).map((element: E): bigint => mapper(element));
            let count: number = data.length;
            let baseline: bigint = data[0];
            let offsets: Array<number> = data.map((value: bigint): number => Number(value - baseline));
            let mean: number = offsets.reduce((total: number, value: number): number => total + value, 0) / count;
            let variance: number = offsets.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0) / count;
            return BigInt(Math.round(variance));
        }
        catch (error) {
            throw new Error("Uncaught error on variance.");
        }
    }
    /**
     * Calculates the population standard deviation of mapped values.
     *
     * @returns The standard deviation, or zero when empty, rounded for bigint results.
     */
    public standardDeviation(): bigint;
    /**
     * Calculates the population standard deviation of mapped values.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The standard deviation, or zero when empty, rounded for bigint results.
     */
    public standardDeviation(mapper: Functional<E, bigint>): bigint;
    /**
     * Calculates the population standard deviation of mapped values.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The standard deviation, or zero when empty, rounded for bigint results.
     */
    public standardDeviation(argument1?: Functional<E, bigint>): bigint {
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (this.toArray()).map((element: E): bigint => mapper(element));
            let count: number = data.length;
            if (count === 0) {
                return 0n;
            }
            let baseline: bigint = data[0];
            let offsets: Array<number> = data.map((value: bigint): number => Number(value - baseline));
            let mean: number = offsets.reduce((total: number, value: number): number => total + value, 0) / count;
            let variance: number = offsets.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0) / count;
            return BigInt(Math.round(Math.sqrt(variance)));
        }
        catch (error) {
            throw new Error("Uncaught error on standardDeviation.");
        }
    }
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @returns The mean, or zero when empty; bigint division truncates towards zero.
     */
    public mean(): bigint;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The mean, or zero when empty; bigint division truncates towards zero.
     */
    public mean(mapper: Functional<E, bigint>): bigint;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The mean, or zero when empty; bigint division truncates towards zero.
     */
    public mean(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntAverage(mapper).collect(this.source());
        }
        catch (error) {
            throw new Error("Uncaught error on mean.");
        }
    }
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @returns The median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public median(): bigint;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public median(mapper: Functional<E, bigint>): bigint;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public median(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntMedian(mapper).collect(this.source());
        }
        catch (error) {
            throw new Error("Uncaught error on median.");
        }
    }
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @returns The mode, or zero when empty.
     */
    public mode(): bigint;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The mode, or zero when empty.
     */
    public mode(mapper: Functional<E, bigint>): bigint;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The mode, or zero when empty.
     */
    public mode(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntMode(mapper).collect(this.source());
        }
        catch (error) {
            throw new Error("Uncaught error on mode.");
        }
    }
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @returns The sum, or zero when empty.
     */
    public summate(): bigint;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The sum, or zero when empty.
     */
    public summate(mapper: Functional<E, bigint>): bigint;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The sum, or zero when empty.
     */
    public summate(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntSummate(mapper).collect(this.source() as SynchronousGenerator<bigint>);
        }
        catch (error) {
            throw new Error("Uncaught error on summate.");
        }
    }
    /**
     * Selects a nearest-rank quantile from sorted mapped values; probability zero selects the minimum.
     *
     * @param quantile - The finite probability from zero to one, inclusive.
     * @returns The selected value, or zero when empty.
     */
    public quantile(quantile: number): bigint;
    /**
     * Selects a nearest-rank quantile from sorted mapped values; probability zero selects the minimum.
     *
     * @param quantile - The finite probability from zero to one, inclusive.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The selected value, or zero when empty.
     */
    public quantile(quantile: number, mapper: Functional<E, bigint>): bigint;
    /**
     * Selects a nearest-rank quantile from sorted mapped values; probability zero selects the minimum.
     *
     * @param quantile - The finite probability from zero to one, inclusive.
     * @param argument1 - The first argument selected by the overload.
     * @returns The selected value, or zero when empty.
     */
    public quantile(quantile: number, argument1?: Functional<E, bigint>): bigint {
        if (!isNumber(quantile) || !Number.isFinite(quantile) || quantile < 0 || quantile > 1) {
            throw new RangeError("Invalid quantile.");
        }
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = this.toArray().map(mapper).sort((a: bigint, b: bigint): number => a < b ? -1 : a > b ? 1 : 0);
            let index: number = Math.max(0, Math.ceil(quantile * data.length) - 1);
            return data[index];
        }
        catch (error) {
            throw new Error("Uncaught error on quantile.");
        }
    }
    /**
     * Subtracts the first nearest-rank quartile from the third quartile.
     *
     * @returns The interquartile range, or zero when empty.
     */
    public interquartileRange(): bigint;
    /**
     * Subtracts the first nearest-rank quartile from the third quartile.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The interquartile range, or zero when empty.
     */
    public interquartileRange(mapper: Functional<E, bigint>): bigint;
    /**
     * Subtracts the first nearest-rank quartile from the third quartile.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The interquartile range, or zero when empty.
     */
    public interquartileRange(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let lower: bigint = this.quantile(0.25, mapper);
            let upper: bigint = this.quantile(0.75, mapper);
            return upper - lower;
        }
        catch (error) {
            throw new Error("Uncaught error on interquartileRange.");
        }
    }
    /**
     * Calculates the population third standardised moment.
     *
     * @returns The skewness, or zero when empty or constant; bigint results are rounded.
     */
    public skewness(): bigint;
    /**
     * Calculates the population third standardised moment.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The skewness, or zero when empty or constant; bigint results are rounded.
     */
    public skewness(mapper: Functional<E, bigint>): bigint;
    /**
     * Calculates the population third standardised moment.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The skewness, or zero when empty or constant; bigint results are rounded.
     */
    public skewness(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (this.toArray()).map((element: E): bigint => mapper(element));
            let count: number = data.length;
            let mean: number = data.reduce((total: number, value: bigint): number => total + Number(value), 0) / count;
            let deviation: number = Math.sqrt(data.reduce((total: number, value: bigint): number => total + Math.pow(Number(value) - mean, 2), 0) / count);
            if (deviation === 0) {
                return 0n;
            }
            let summate: number = data.reduce((total: number, value: bigint): number => total + Math.pow((Number(value) - mean) / deviation, 3), 0);
            return BigInt(Math.round(summate / count));
        }
        catch (error) {
            throw new Error("Uncaught error on skewness.");
        }
    }
    /**
     * Calculates population excess kurtosis by subtracting three from the fourth standardised moment.
     *
     * @returns The excess kurtosis, or zero when empty or constant; bigint results are rounded.
     */
    public kurtosis(): bigint;
    /**
     * Calculates population excess kurtosis by subtracting three from the fourth standardised moment.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The excess kurtosis, or zero when empty or constant; bigint results are rounded.
     */
    public kurtosis(mapper: Functional<E, bigint>): bigint;
    /**
     * Calculates population excess kurtosis by subtracting three from the fourth standardised moment.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The excess kurtosis, or zero when empty or constant; bigint results are rounded.
     */
    public kurtosis(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (this.toArray()).map((element: E): bigint => mapper(element));
            let count: number = data.length;
            let mean: number = data.reduce((total: number, value: bigint): number => total + Number(value), 0) / count;
            let deviation: number = Math.sqrt(data.reduce((total: number, value: bigint): number => total + Math.pow(Number(value) - mean, 2), 0) / count);
            if (deviation === 0) {
                return 0n;
            }
            let summate: number = data.reduce((total: number, value: bigint): number => total + Math.pow((Number(value) - mean) / deviation, 4), 0);
            return BigInt(Math.round(summate / count - 3));
        }
        catch (error) {
            throw new Error("Uncaught error on kurtosis.");
        }
    }
}
;
/**
 * A buffered statistics view with number results.
 *
 * @template E - The source element type.
 */
export class SynchronousNumericStatistics<E> extends SynchronousStatistics<E, number> {
    protected readonly SynchronousNumericStatistics: symbol = SynchronousNumericStatisticsSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "SynchronousNumericStatistics";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: SynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: SynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param parameter - The callback-based source to buffer.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(parameter: SynchronousGenerator<E>, comparator?: Comparator<E>) {
        super(parameter, comparator || useCompare);
        Object.defineProperties(this, {
            "SynchronousNumericStatistics": {
                value: SynchronousNumericStatisticsSymbol,
                enumerable: false,
                writable: false,
                configurable: false
            }
        });
    }
    /**
     * Iterates over the elements in this collectable traversal order.
     *
     * @returns An iterator over the collected elements.
     */
    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let { element } of this.buffer) {
            yield element;
        }
    }
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @returns The arithmetic average, or zero when empty.
     */
    public average(): number;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The arithmetic average, or zero when empty.
     */
    public average(mapper: Functional<E, number>): number;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The arithmetic average, or zero when empty.
     */
    public average(mapper?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            if (isFunction(mapper)) {
                return useSynchronousNumericAverage(mapper).collect(this.source() as SynchronousGenerator<number>);
            }
            return useSynchronousNumericAverage().collect(this.source());
        }
        catch (error) {
            throw new Error("Uncaught error on average.");
        }
    }
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @returns The spread of the mapped values.
     */
    public range(): number;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The spread of the mapped values.
     */
    public range(mapper: Functional<E, number>): number;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The spread of the mapped values.
     */
    public range(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = this.toArray().map(mapper);
            let minimum: number = data[0];
            let maximum: number = data[0];
            for (let value of data) {
                minimum = Math.min(minimum, value);
                maximum = Math.max(maximum, value);
            }
            return maximum - minimum;
        }
        catch (error) {
            throw new Error("Uncaught error on range.");
        }
    }
    /**
     * Calculates population variance, returning zero for fewer than two elements.
     *
     * @returns The population variance, rounded to an integer for bigint results.
     */
    public variance(): number;
    /**
     * Calculates population variance, returning zero for fewer than two elements.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The population variance, rounded to an integer for bigint results.
     */
    public variance(mapper: Functional<E, number>): number;
    /**
     * Calculates population variance, returning zero for fewer than two elements.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The population variance, rounded to an integer for bigint results.
     */
    public variance(argument1?: Functional<E, number>): number {
        if (this.isEmpty() || this.count() === 1n) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericVariance(mapper).collect(this.source());
        }
        catch (error) {
            throw new Error("Uncaught error on variance.");
        }
    }
    /**
     * Calculates the population standard deviation of mapped values.
     *
     * @returns The standard deviation, or zero when empty, rounded for bigint results.
     */
    public standardDeviation(): number;
    /**
     * Calculates the population standard deviation of mapped values.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The standard deviation, or zero when empty, rounded for bigint results.
     */
    public standardDeviation(mapper: Functional<E, number>): number;
    /**
     * Calculates the population standard deviation of mapped values.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The standard deviation, or zero when empty, rounded for bigint results.
     */
    public standardDeviation(argument1?: Functional<E, number>): number {
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericStandardDeviation(mapper).collect(this.source());
        }
        catch (error) {
            throw new Error("Uncaught error on standardDeviation.");
        }
    }
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @returns The mean, or zero when empty; bigint division truncates towards zero.
     */
    public mean(): number;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The mean, or zero when empty; bigint division truncates towards zero.
     */
    public mean(mapper: Functional<E, number>): number;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The mean, or zero when empty; bigint division truncates towards zero.
     */
    public mean(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericAverage(mapper).collect(this.source() as SynchronousGenerator<number>);
        }
        catch (error) {
            throw new Error("Uncaught error on mean.");
        }
    }
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @returns The median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public median(): number;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public median(mapper: Functional<E, number>): number;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public median(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericMedian(mapper).collect(this.source());
        }
        catch (error) {
            throw new Error("Uncaught error on median.");
        }
    }
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @returns The mode, or zero when empty.
     */
    public mode(): number;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The mode, or zero when empty.
     */
    public mode(mapper: Functional<E, number>): number;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The mode, or zero when empty.
     */
    public mode(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericMode(mapper).collect(this.source());
        }
        catch (error) {
            throw new Error("Uncaught error on mode.");
        }
    }
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @returns The sum, or zero when empty.
     */
    public summate(): number;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The sum, or zero when empty.
     */
    public summate(mapper: Functional<E, number>): number;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The sum, or zero when empty.
     */
    public summate(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericSummate(mapper).collect(this.source() as SynchronousGenerator<number>);
        }
        catch (error) {
            throw new Error("Uncaught error on summate.");
        }
    }
    /**
     * Selects a nearest-rank quantile from sorted mapped values; probability zero selects the minimum.
     *
     * @param quantile - The finite probability from zero to one, inclusive.
     * @returns The selected value, or zero when empty.
     */
    public quantile(quantile: number): number;
    /**
     * Selects a nearest-rank quantile from sorted mapped values; probability zero selects the minimum.
     *
     * @param quantile - The finite probability from zero to one, inclusive.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The selected value, or zero when empty.
     */
    public quantile(quantile: number, mapper: Functional<E, number>): number;
    /**
     * Selects a nearest-rank quantile from sorted mapped values; probability zero selects the minimum.
     *
     * @param quantile - The finite probability from zero to one, inclusive.
     * @param argument1 - The first argument selected by the overload.
     * @returns The selected value, or zero when empty.
     */
    public quantile(quantile: number, argument1?: Functional<E, number>): number {
        if (!isNumber(quantile) || !Number.isFinite(quantile) || quantile < 0 || quantile > 1) {
            throw new RangeError("Invalid quantile.");
        }
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = this.toArray().map(mapper).sort((a: number, b: number): number => a - b);
            let index: number = Math.max(0, Math.ceil(quantile * data.length) - 1);
            return data[index];
        }
        catch (error) {
            throw new Error("Uncaught error on quantile.");
        }
    }
    /**
     * Subtracts the first nearest-rank quartile from the third quartile.
     *
     * @returns The interquartile range, or zero when empty.
     */
    public interquartileRange(): number;
    /**
     * Subtracts the first nearest-rank quartile from the third quartile.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The interquartile range, or zero when empty.
     */
    public interquartileRange(mapper: Functional<E, number>): number;
    /**
     * Subtracts the first nearest-rank quartile from the third quartile.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The interquartile range, or zero when empty.
     */
    public interquartileRange(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let lower: number = this.quantile(0.25, mapper);
            let upper: number = this.quantile(0.75, mapper);
            return upper - lower;
        }
        catch (error) {
            throw new Error("Uncaught error on interquartileRange.");
        }
    }
    /**
     * Calculates the population third standardised moment.
     *
     * @returns The skewness, or zero when empty or constant; bigint results are rounded.
     */
    public skewness(): number;
    /**
     * Calculates the population third standardised moment.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The skewness, or zero when empty or constant; bigint results are rounded.
     */
    public skewness(mapper: Functional<E, number>): number;
    /**
     * Calculates the population third standardised moment.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The skewness, or zero when empty or constant; bigint results are rounded.
     */
    public skewness(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let mean: number = this.mean(mapper);
            let standardDeviation: number = this.standardDeviation(mapper);
            if (standardDeviation === 0) {
                return 0;
            }
            let data: Array<number> = (this.toArray()).map((element: E): number => mapper(element));
            let summate: number = 0;
            for (let value of data) {
                let z: number = (value - mean) / standardDeviation;
                summate += Math.pow(z, 3);
            }
            return summate / data.length;
        }
        catch (error) {
            throw new Error("Uncaught error on skewness.");
        }
    }
    /**
     * Calculates population excess kurtosis by subtracting three from the fourth standardised moment.
     *
     * @returns The excess kurtosis, or zero when empty or constant; bigint results are rounded.
     */
    public kurtosis(): number;
    /**
     * Calculates population excess kurtosis by subtracting three from the fourth standardised moment.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The excess kurtosis, or zero when empty or constant; bigint results are rounded.
     */
    public kurtosis(mapper: Functional<E, number>): number;
    /**
     * Calculates population excess kurtosis by subtracting three from the fourth standardised moment.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The excess kurtosis, or zero when empty or constant; bigint results are rounded.
     */
    public kurtosis(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let mean: number = this.mean(mapper);
            let standardDeviation: number = this.standardDeviation(mapper);
            if (standardDeviation === 0) {
                return 0;
            }
            let data: Array<number> = (this.toArray()).map((element: E): number => mapper(element));
            let summate: number = 0;
            for (let value of data) {
                let z: number = (value - mean) / standardDeviation;
                summate += Math.pow(z, 4);
            }
            return summate / data.length - 3;
        }
        catch (error) {
            throw new Error("Uncaught error on kurtosis.");
        }
    }
}
;
/**
 * A buffered ordered source supporting sliding and tumbling windows.
 *
 * @template E - The source element type.
 */
export class SynchronousWindowCollectable<E> extends SynchronousOrderedCollectable<E> {
    protected readonly WindowCollectable: symbol = SynchronousWindowCollectableSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "SynchronousWindowCollectable";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: SynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: SynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param parameter - The callback-based source to buffer.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(parameter: SynchronousGenerator<E>, comparator: Comparator<E> = useCompare) {
        super(parameter, comparator);
        Object.defineProperties(this, {
            "SynchronousWindowCollectable": {
                value: SynchronousWindowCollectableSymbol,
                writable: false,
                enumerable: false,
                configurable: false
            }
        });
    }
    /**
     * Iterates over the elements in this collectable traversal order.
     *
     * @returns An iterator over the collected elements.
     */
    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let { element } of this.buffer) {
            yield element;
        }
    }
    /**
     * Creates windows over the buffered order, including a final partial window.
     *
     * @param size - The positive maximum window size.
     * @param step - The positive distance between window starts; defaults to one.
     * @returns A pipeline of windows retaining the buffered element positions.
     */
    public slide(size: bigint, step: bigint = 1n): SynchronousSemantic<SynchronousSemantic<E>> {
        if (size > 0n && step > 0n) {
            return new SynchronousSemantic<SynchronousSemantic<E>>((accepet: Consumer<SynchronousSemantic<E>> | BiConsumer<SynchronousSemantic<E>, bigint>, interrupt: Predicate<SynchronousSemantic<E>> | BiPredicate<SynchronousSemantic<E>, bigint>): void => {
                try {
                    let index: bigint = 0n;
                    for (let start: bigint = 0n; start < BigInt(this.buffer.length); start += step) {
                        let end: bigint = start + size;
                        let inner: SynchronousSemantic<E> = new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                            for (let index: bigint = start; index < end && index < BigInt(this.buffer.length); index++) {
                                let indexed: Indexed<E> = this.buffer[Number(index)];
                                if (invalidate(indexed)) {
                                    continue;
                                }
                                if (interrupt(indexed.element, index)) {
                                    break;
                                }
                                accept(indexed.element, index);
                            }
                        });
                        if (interrupt(inner, index)) {
                            break;
                        }
                        accepet(inner, index);
                        index++;
                    }
                }
                catch (error) {
                    throw new Error("Uncaught error on slide.");
                }
            });
        }
        throw new RangeError("Invalid arguments.");
    }
    /**
     * Creates non-overlapping windows by using the size as the step.
     *
     * @param size - The positive maximum window size.
     * @returns A pipeline of windows, including a final partial window.
     */
    public tumble(size: bigint): SynchronousSemantic<SynchronousSemantic<E>> {
        if (isBigInt(size) && size > 0n) {
            try {
                return this.slide(size, size);
            }
            catch (error) {
                throw new Error("Uncaught error on tumble.");
            }
        }
        throw new RangeError("Invalid arguments.");
    }
}
;
