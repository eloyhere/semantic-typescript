import { useAsynchronousAnyMatch, useAsynchronousAllMatch, useAsynchronousCollect, useAsynchronousCount, useAsynchronousError, useAsynchronousFindAny, useAsynchronousFindAt, useAsynchronousFindFirst, useAsynchronousFindLast, useAsynchronousFindMaximum, useAsynchronousFindMinimum, useAsynchronousForEach, useAsynchronousGroup, useAsynchronousGroupBy, useAsynchronousJoin, useAsynchronousLog, useAsynchronousNoneMatch, useAsynchronousPartition, useAsynchronousPartitionBy, useAsynchronousReduce, useAsynchronousToArray, useAsynchronousToMap, useAsynchronousToSet, useAsynchronousWrite, useAsynchronousFrequency, useAsynchronousBigIntAverage, useAsynchronousBigIntMedian, useAsynchronousBigIntMode, useAsynchronousBigIntSummate, useAsynchronousNumericAverage, useAsynchronousNumericMedian, useAsynchronousNumericMode, useAsynchronousNumericSummate, useAsynchronousFindNegativeAt, useAsynchronousToIndexedArray, useAsynchronousToOrderedSet, useAsynchronousToUnorderedSet, useAsynchronousToOrderedMap, useAsynchronousToUnorderedMap, useAsynchronousToList, useAsynchronousToCycle, useAsynchronousToLRUSet, useAsynchronousToLRUMap, useAsynchronousToSkipSet, useAsynchronousToSkipMap, useAsynchronousToBinarySearchTree, useAsynchronousToRootedForest } from "#semantic/asynchronous/collectors";
import { isFunction, isAsynchronousSemantic, isIterable, isNumber, isBigInt, isObject, isString, isAsynchronousCollectable, isAsyncIterable, isAsynchronousCollector } from "#semantic/guard";
import { useCompare, useRandom, useToBigInt, useToNumber } from "#semantic/hook";
import { AsynchronousOrderedCollectableSymbol, AsynchronousBigIntStatisticsSymbol, AsynchronousCollectableSymbol, AsynchronousNumericStatisticsSymbol, AsynchronousSemanticSymbol, AsynchronousWindowCollectableSymbol, AsynchronousUnorderedCollectableSymbol, AsynchronousStatisticsSymbol } from "#semantic/symbol";
import { invalidate, validate, type BiConsumer, type BiFunctional, type BiPredicate, type Comparator, type Consumer, type Functional, type Indexed, type Predicate, type Supplier, type AsynchronousGenerator, type TriFunctional, type TriPredicate, type Runnable } from "#semantic/utility";
import { Optional } from "#semantic/optional";
import { isKurtosisEstimator, isQuantileMethod, isSkewnessEstimator, isVarianceDdof, quantileOfSorted, type KurtosisOptions, type QuantileOptions, type SkewnessOptions, type VarianceOptions } from "#semantic/mathematics/quantile";
import type { AsynchronousCollector } from "#semantic/asynchronous/collector";
import type { AsynchronousCycle } from "#semantic/structure/cycle";
import type { AsynchronousRootedForest } from "#semantic/structure/forest/rootedForest";
import type { AsynchronousList } from "#semantic/structure/list";
import type { AsynchronousUnorderedLRUMap, AsynchronousUnorderedLRUSet } from "#semantic/structure/lru";
import type { AsynchronousOrderedMap, AsynchronousUnorderedMap } from "#semantic/structure/map";
import type { AsynchronousOrderedSet, AsynchronousUnorderedSet } from "#semantic/structure/set";
import type { AsynchronousSkipMap, AsynchronousSkipSet } from "#semantic/structure/skip";
import type { AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";
const SURROGATE_BASE: bigint = 1n << 96n;
const SHUFFLE_BOUND: bigint = 1n << 62n;
function bigintOffsets(data: Array<bigint>): Array<number> {
    if (data.length === 0) {
        return [];
    }
    let origin: bigint = data[0];
    return data.map((value: bigint): number => {
        let offset: bigint = value - origin;
        return Number(offset);
    });
}
/**
 * A lazy callback-based pipeline whose transformations run when consumed.
 *
 * @template E - The source element type.
 */
export class AsynchronousSemantic<E> {
    protected generator: AsynchronousGenerator<E>;
    protected readonly AsynchronousSemantic: Symbol = AsynchronousSemanticSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "AsynchronousSemantic";
    /**
     * Creates a lazy source from the generator.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: AsynchronousGenerator<E>) {
        if (isFunction(generator)) {
            this.generator = generator;
            Object.defineProperties(this, {
                "AsynchronousSemantic": {
                    value: AsynchronousSemanticSymbol,
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
    public concat(other: AsynchronousSemantic<E>): AsynchronousSemantic<E>;
    /**
     * Creates a lazy pipeline emitting this source followed by another source.
     *
     * @param other - The source to append.
     * @returns A concatenated pipeline.
     */
    public concat(other: AsyncIterable<E>): AsynchronousSemantic<E>;
    /**
     * Creates a lazy pipeline emitting this source followed by another source.
     *
     * @param argument - The value or callback selected by the overload.
     * @returns A concatenated pipeline.
     */
    public concat(argument: AsynchronousSemantic<E> | AsyncIterable<E>): AsynchronousSemantic<E> {
        if (isAsynchronousSemantic(argument) || isAsyncIterable(argument)) {
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                let count: bigint = 0n;
                let stopped: boolean = false;
                let interrupted = (element: E): boolean => {
                    stopped = stopped || interrupt(element, count);
                    return stopped;
                };
                let append = (element: E): void => {
                    accept(element, count);
                    count++;
                    stopped = stopped || interrupt(element, count);
                };
                await this.generator(append, interrupted);
                if (stopped) {
                    return;
                }
                if (isAsynchronousSemantic(argument)) {
                    await (argument as AsynchronousSemantic<E>).source()(append, interrupted);
                }
                else {
                    for await (let element of argument as AsyncIterable<E>) {
                        if (interrupted(element)) {
                            break;
                        }
                        append(element);
                        if (stopped) {
                            break;
                        }
                    }
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
    public distinct(): AsynchronousSemantic<E>;
    /**
     * Keeps the first element for each extracted key using Set equality, preserving source indices.
     *
     * @template K - The extracted key type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @returns A lazy pipeline of distinct elements.
     */
    public distinct<K>(keyExtractor: Functional<E, K>): AsynchronousSemantic<E>;
    /**
     * Keeps the first element for each extracted key using Set equality, preserving source indices.
     *
     * @template K - The extracted key type.
     * @param keyExtractor - Extracts a key from each element and optional bigint index.
     * @returns A lazy pipeline of distinct elements.
     */
    public distinct<K>(keyExtractor: BiFunctional<E, bigint, K>): AsynchronousSemantic<E>;
    /**
     * Keeps the first element for each extracted key using Set equality, preserving source indices.
     *
     * @template K - The extracted key type.
     * @param argument1 - The first argument selected by the overload.
     * @returns A lazy pipeline of distinct elements.
     */
    public distinct<K = E>(argument1?: Functional<E, K> | BiFunctional<E, bigint, K>): AsynchronousSemantic<E> {
        let keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K> = validate(argument1) ? argument1 : (element: E): K => element as unknown as K;
        return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                try {
                    let set: Set<K> = new Set<K>();
                    this.generator((element: E, index: bigint) => {
                        let key: K = keyExtractor(element, index);
                        if (!set.has(key)) {
                            set.add(key);
                            accept(element, index);
                        }
                    }, interrupt).then(resolve).catch(reject);
                }
                catch (error) {
                    reject(error);
                }
            });
        });
    }
    /**
     * Drops the matching initial run, then emits the remaining elements with consecutive indices.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A pipeline without the matching prefix.
     */
    public dropWhile(predicate: Predicate<E>): AsynchronousSemantic<E>;
    /**
     * Drops the matching initial run, then emits the remaining elements with consecutive indices.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A pipeline without the matching prefix.
     */
    public dropWhile(predicate: BiPredicate<E, bigint>): AsynchronousSemantic<E>;
    /**
     * Drops the matching initial run, then emits the remaining elements with consecutive indices.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A pipeline without the matching prefix.
     */
    public dropWhile(predicate: Predicate<E> | BiPredicate<E, bigint>): AsynchronousSemantic<E> {
        if (isFunction(predicate)) {
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
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
                        }, interrupt).then(resolve).catch(reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
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
    public filter(predicate: Predicate<E>): AsynchronousSemantic<E>;
    /**
     * Forwards only matching elements, preserving their source indices.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A lazy filtered pipeline.
     */
    public filter(predicate: BiPredicate<E, bigint>): AsynchronousSemantic<E>;
    /**
     * Forwards only matching elements, preserving their source indices.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A lazy filtered pipeline.
     */
    public filter(predicate: Predicate<E> | BiPredicate<E, bigint>): AsynchronousSemantic<E> {
        if (isFunction(predicate)) {
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        this.generator((element: E, index: bigint): void => {
                            if (predicate(element, index)) {
                                accept(element, index);
                            }
                        }, interrupt).then(resolve).catch(reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
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
    public flat(mapper: Functional<E, Iterable<E>>): AsynchronousSemantic<E>;
    /**
     * Maps each element to a source and flattens its elements into the same element type.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A flattened pipeline with consecutive output indices.
     */
    public flat(mapper: BiFunctional<E, bigint, Iterable<E>>): AsynchronousSemantic<E>;
    /**
     * Maps each element to a source and flattens its elements into the same element type.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A flattened pipeline with consecutive output indices.
     */
    public flat(mapper: Functional<E, AsynchronousSemantic<E>>): AsynchronousSemantic<E>;
    /**
     * Maps each element to a source and flattens its elements into the same element type.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A flattened pipeline with consecutive output indices.
     */
    public flat(mapper: BiFunctional<E, bigint, AsynchronousSemantic<E>>): AsynchronousSemantic<E>;
    /**
     * Maps each element to a source and flattens its elements into the same element type.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A flattened pipeline with consecutive output indices.
     */
    public flat(mapper: Functional<E, Iterable<E>> | BiFunctional<E, bigint, Iterable<E>> | Functional<E, AsynchronousSemantic<E>> | BiFunctional<E, bigint, AsynchronousSemantic<E>>): AsynchronousSemantic<E> {
        if (isFunction(mapper)) {
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        let count: bigint = 0n;
                        let stop: boolean = false;
                        let pending: number = 0;
                        let completed: boolean = false;
                        let settle: Runnable = (): void => {
                            if (completed && pending === 0) {
                                resolve();
                            }
                        };
                        this.generator((element: E, index: bigint): void => {
                            let result: AsynchronousSemantic<E> | Iterable<E> = mapper(element, index);
                            if (isIterable(result)) {
                                for (let subElement of result) {
                                    accept(subElement, count);
                                    stop = stop || interrupt(subElement, count);
                                    count++;
                                }
                            }
                            else if (isAsynchronousSemantic(result)) {
                                pending++;
                                result.generator((subElement: E): void => {
                                    accept(subElement, count);
                                    stop = stop || interrupt(subElement, count);
                                    count++;
                                }, (element: E): boolean => interrupt(element, count) || stop).then((): void => {
                                    pending--;
                                    settle();
                                }, reject);
                            }
                        }, (): boolean => stop).then((): void => {
                            completed = true;
                            settle();
                        }, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
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
    public flatMap<R>(mapper: Functional<E, Iterable<R>>): AsynchronousSemantic<R>;
    /**
     * Maps each element to a source and flattens the resulting sources.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of flattened mapped elements.
     */
    public flatMap<R>(mapper: BiFunctional<E, bigint, Iterable<R>>): AsynchronousSemantic<R>;
    /**
     * Maps each element to a source and flattens the resulting sources.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of flattened mapped elements.
     */
    public flatMap<R>(mapper: Functional<E, AsynchronousSemantic<R>>): AsynchronousSemantic<R>;
    /**
     * Maps each element to a source and flattens the resulting sources.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of flattened mapped elements.
     */
    public flatMap<R>(mapper: BiFunctional<E, bigint, AsynchronousSemantic<R>>): AsynchronousSemantic<R>;
    /**
     * Maps each element to a source and flattens the resulting sources.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of flattened mapped elements.
     */
    public flatMap<R>(mapper: Functional<E, Iterable<R> | AsynchronousSemantic<R>> | BiFunctional<E, bigint, Iterable<R> | AsynchronousSemantic<R>>): AsynchronousSemantic<R> {
        if (isFunction(mapper)) {
            return new AsynchronousSemantic<R>(async (accept: Consumer<R> | BiConsumer<R, bigint>, interrupt: Predicate<R> | BiPredicate<R, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        let count: bigint = 0n;
                        let stop: boolean = false;
                        let pending: number = 0;
                        let completed: boolean = false;
                        let settle: Runnable = (): void => {
                            if (completed && pending === 0) {
                                resolve();
                            }
                        };
                        this.generator((element: E, index: bigint): void => {
                            let result: AsynchronousSemantic<R> | Iterable<R> = mapper(element, index);
                            if (isIterable(result)) {
                                for (let subElement of result) {
                                    accept(subElement, count);
                                    stop = stop || interrupt(subElement, count);
                                    count++;
                                }
                            }
                            else if (isAsynchronousSemantic(result)) {
                                pending++;
                                result.generator((subElement: R): void => {
                                    accept(subElement, count);
                                    stop = stop || interrupt(subElement, count);
                                    count++;
                                }, (element: R): boolean => interrupt(element, count) || stop).then((): void => {
                                    pending--;
                                    settle();
                                }, reject);
                            }
                        }, (): boolean => stop).then((): void => {
                            completed = true;
                            settle();
                        }, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
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
    public limit(count: number): AsynchronousSemantic<E>;
    /**
     * Emits at most the requested count and interrupts further traversal.
     *
     * @param count - The requested count.
     * @returns A lazy limited pipeline.
     */
    public limit(count: bigint): AsynchronousSemantic<E>;
    /**
     * Emits at most the requested count and interrupts further traversal.
     *
     * @param argument - The value or callback selected by the overload.
     * @returns A lazy limited pipeline.
     */
    public limit(argument: bigint | number): AsynchronousSemantic<E> {
        if (isNumber(argument)) {
            let limit: bigint = BigInt(argument);
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        let count: bigint = 0n;
                        this.generator((element: E): void => {
                            if (count < limit) {
                                accept(element, count);
                                count++;
                            }
                        }, (element: E, index: bigint): boolean => interrupt(element, index) || count >= limit).then(resolve, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
        }
        if (isBigInt(argument)) {
            let limit: bigint = argument;
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        let count: bigint = 0n;
                        this.generator((element: E): void => {
                            if (count < limit) {
                                accept(element, count);
                                count++;
                            }
                        }, (element: E, index: bigint): boolean => interrupt(element, index) || count >= limit).then(resolve, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
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
    public map(mapper: Functional<E, E>): AsynchronousSemantic<E>;
    /**
     * Transforms each element, preserving its source index.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of mapped elements.
     */
    public map(mapper: BiFunctional<E, bigint, E>): AsynchronousSemantic<E>;
    /**
     * Transforms each element, preserving its source index.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of mapped elements.
     */
    public map<R>(mapper: Functional<E, R>): AsynchronousSemantic<R>;
    /**
     * Transforms each element, preserving its source index.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of mapped elements.
     */
    public map<R>(mapper: BiFunctional<E, bigint, R>): AsynchronousSemantic<R>;
    /**
     * Transforms each element, preserving its source index.
     *
     * @template R - The mapped or finished result type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline of mapped elements.
     */
    public map<R = E>(mapper: Functional<E, R> | BiFunctional<E, bigint, R>): AsynchronousSemantic<R> {
        if (isFunction(mapper)) {
            return new AsynchronousSemantic<R>(async (accept: Consumer<R> | BiConsumer<R, bigint>, interrupt: Predicate<R> | BiPredicate<R, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        let stop: boolean = false;
                        this.generator((element: E, index: bigint): void => {
                            let resolved: R = mapper(element, index);
                            accept(resolved, index);
                            stop = stop || interrupt(resolved, index);
                        }, (): boolean => stop).then(resolve, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
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
    public peek(consumer: Consumer<E>): AsynchronousSemantic<E>;
    /**
     * Invokes an observer after each element is forwarded during traversal.
     *
     * @param consumer - Observes each forwarded element and optional bigint index.
     * @returns A pipeline that performs the observation when consumed.
     */
    public peek(consumer: BiConsumer<E, bigint>): AsynchronousSemantic<E>;
    /**
     * Invokes an observer after each element is forwarded during traversal.
     *
     * @param consumer - Observes each forwarded element and optional bigint index.
     * @returns A pipeline that performs the observation when consumed.
     */
    public peek(consumer: Consumer<E> | BiConsumer<E, bigint>): AsynchronousSemantic<E> {
        if (isFunction(consumer)) {
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        this.generator((element: E, index: bigint): void => {
                            accept(element, index);
                            consumer(element, index);
                        }, interrupt).then(resolve, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Passes the underlying generator to a pipeline conversion.
     *
     * @param conversion - Converts the source generator to a pipeline.
     * @returns The pipeline returned by the conversion.
     */
    public pipe(conversion: Functional<AsynchronousGenerator<E>, AsynchronousSemantic<E>>): AsynchronousSemantic<E>;
    /**
     * Passes the underlying generator to a pipeline conversion.
     *
     * @template R - The mapped or finished result type.
     * @param conversion - Converts the source generator to a pipeline.
     * @returns The pipeline returned by the conversion.
     */
    public pipe<R>(conversion: Functional<AsynchronousGenerator<E>, AsynchronousSemantic<R>>): AsynchronousSemantic<R>;
    /**
     * Passes the underlying generator to a pipeline conversion.
     *
     * @template R - The mapped or finished result type.
     * @param conversion - Converts the source generator to a pipeline.
     * @returns The pipeline returned by the conversion.
     */
    public pipe<R = E>(conversion: Functional<AsynchronousGenerator<E>, AsynchronousSemantic<R>>): AsynchronousSemantic<R> {
        return conversion(this.source());
    }
    /**
     * Replaces emitted indices with calculated indices, preserving emission order.
     *
     * @param redirector - Calculates the replacement bigint index.
     * @returns A pipeline with redirected indices.
     */
    public redirect(redirector: BiFunctional<E, bigint, bigint>): AsynchronousSemantic<E> {
        if (isFunction(redirector)) {
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        this.generator((element: E, index: bigint): void => {
                            accept(element, redirector(element, index));
                        }, interrupt).then(resolve, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Replaces each index with its negation minus one; an ordered collectable applies the resulting order.
     *
     * @returns A pipeline carrying reversed indices.
     */
    public reverse(): AsynchronousSemantic<E> {
        return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, -index - 1n);
                    }, interrupt).then(resolve, reject);
                }
                catch (error) {
                    reject(error);
                }
            });
        });
    }
    /**
     * Assigns random or mapped indices; an ordered collectable applies the resulting order.
     *
     * @returns A pipeline carrying shuffled indices.
     */
    public shuffle(): AsynchronousSemantic<E>;
    /**
     * Assigns random or mapped indices; an ordered collectable applies the resulting order.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline carrying shuffled indices.
     */
    public shuffle(mapper: BiFunctional<E, bigint, bigint>): AsynchronousSemantic<E>;
    /**
     * Assigns random or mapped indices; an ordered collectable applies the resulting order.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A pipeline carrying shuffled indices.
     */
    public shuffle(mapper?: BiFunctional<E, bigint, bigint>): AsynchronousSemantic<E> {
        if (isFunction(mapper)) {
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        this.generator((element: E, index: bigint): void => {
                            accept(element, mapper(element, index));
                        }, interrupt).then(resolve, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
        }
        return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                try {
                    this.generator((element: E, _index: bigint): void => {
                        accept(element, useRandom(0n, SHUFFLE_BOUND));
                    }, interrupt).then(resolve, reject);
                }
                catch (error) {
                    reject(error);
                }
            });
        });
    }
    /**
     * Skips the requested number of encountered elements, preserving the remaining indices.
     *
     * @param count - The requested count.
     * @returns A pipeline without the skipped prefix.
     */
    public skip(count: number): AsynchronousSemantic<E>;
    /**
     * Skips the requested number of encountered elements, preserving the remaining indices.
     *
     * @param count - The requested count.
     * @returns A pipeline without the skipped prefix.
     */
    public skip(count: bigint): AsynchronousSemantic<E>;
    /**
     * Skips the requested number of encountered elements, preserving the remaining indices.
     *
     * @param argument - The value or callback selected by the overload.
     * @returns A pipeline without the skipped prefix.
     */
    public skip(argument: number | bigint): AsynchronousSemantic<E> {
        if (isNumber(argument)) {
            let n: number = argument;
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
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
                        }, interrupt).then(resolve, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
        }
        if (isBigInt(argument)) {
            let n: bigint = argument;
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        let count: bigint = 0n;
                        this.generator((element: E, index: bigint): void => {
                            if (count < n) {
                                count++;
                            }
                            else {
                                accept(element, index);
                            }
                        }, interrupt).then(resolve, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
        }
        throw new TypeError("Invalid arguments.");
    }
    /**
     * Exposes the callback-based generator used to traverse this source.
     *
     * @returns The generator accepting element and interruption callbacks.
     */
    public source(): AsynchronousGenerator<E> {
        return this.generator;
    }
    /**
     * Selects positions from the smaller inclusive bound to the larger exclusive bound, preserving indices.
     *
     * @param start - The inclusive positional bound; the smaller supplied bound is used first.
     * @param end - The exclusive positional bound; the larger supplied bound is used last.
     * @returns A pipeline for the selected positional interval.
     */
    public sub(start: number, end: number): AsynchronousSemantic<E>;
    /**
     * Selects positions from the smaller inclusive bound to the larger exclusive bound, preserving indices.
     *
     * @param start - The inclusive positional bound; the smaller supplied bound is used first.
     * @param end - The exclusive positional bound; the larger supplied bound is used last.
     * @returns A pipeline for the selected positional interval.
     */
    public sub(start: bigint, end: bigint): AsynchronousSemantic<E>;
    /**
     * Selects positions from the smaller inclusive bound to the larger exclusive bound, preserving indices.
     *
     * @param start - The inclusive positional bound; the smaller supplied bound is used first.
     * @param end - The exclusive positional bound; the larger supplied bound is used last.
     * @returns A pipeline for the selected positional interval.
     */
    public sub(start: number | bigint, end: number | bigint): AsynchronousSemantic<E> {
        if ((isNumber(start) && isNumber(end)) || (isBigInt(start) && isBigInt(end))) {
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
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
                        }, (element: E, index: bigint): boolean => count >= maximum || interrupt(element, index)).then(resolve, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
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
    public takeWhile(predicate: Predicate<E>): AsynchronousSemantic<E>;
    /**
     * Forwards the matching initial run and stops at the first predicate failure.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A pipeline containing the matching prefix.
     */
    public takeWhile(predicate: BiPredicate<E, bigint>): AsynchronousSemantic<E>;
    /**
     * Forwards the matching initial run and stops at the first predicate failure.
     *
     * @param predicate - Tests each element and optional bigint index.
     * @returns A pipeline containing the matching prefix.
     */
    public takeWhile(predicate: Predicate<E> | BiPredicate<E, bigint>): AsynchronousSemantic<E> {
        return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                try {
                    let stop: boolean = false;
                    this.generator((element: E, index: bigint) => {
                        if (predicate(element, index) && stop === false) {
                            accept(element, index);
                        }
                        else {
                            stop = true;
                        }
                    }, (element: E, index: bigint): boolean => stop || interrupt(element, index)).then(resolve, reject);
                }
                catch (error) {
                    reject(error);
                }
            });
        });
    }
    /**
     * Creates a collectable, accepting a recognised mapper result or falling back to an unordered buffer.
     *
     * @returns The resulting collectable.
     */
    public toCollectable(): AsynchronousCollectable<E>;
    /**
     * Creates a collectable, accepting a recognised mapper result or falling back to an unordered buffer.
     *
     * @template C - The collectable implementation type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The resulting collectable.
     */
    public toCollectable<C extends AsynchronousCollectable<E>>(mapper: Functional<AsynchronousGenerator<E>, C>): C;
    /**
     * Creates a collectable, accepting a recognised mapper result or falling back to an unordered buffer.
     *
     * @template C - The collectable implementation type.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The resulting collectable.
     */
    public toCollectable<C extends AsynchronousCollectable<E>>(mapper?: Functional<AsynchronousGenerator<E>, C>): AsynchronousCollectable<E> | C {
        if (isFunction(mapper)) {
            try {
                let AsynchronousCollectable: C = mapper(this.generator);
                if (isAsynchronousCollectable(AsynchronousCollectable)) {
                    return AsynchronousCollectable;
                }
            }
            catch (error) {
                throw error;
            }
        }
        try {
            return new AsynchronousUnorderedCollectable(this.generator);
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
    public toBigintStatistics(): AsynchronousBigIntStatistics<E> {
        try {
            return new AsynchronousBigIntStatistics<E>(this.generator);
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
    public toNumericStatistics(): AsynchronousNumericStatistics<E> {
        try {
            return new AsynchronousNumericStatistics<E>(this.generator);
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
    public toOrdered(): AsynchronousOrderedCollectable<E>;
    /**
     * Buffers and sorts by a comparator, or by normalised source indices when omitted.
     *
     * @param comparator - The comparison function; defaults to the library comparator.
     * @returns An ordered collectable.
     */
    public toOrdered(comparator: Comparator<E>): AsynchronousOrderedCollectable<E>;
    /**
     * Buffers and sorts by a comparator, or by normalised source indices when omitted.
     *
     * @param comparator - The comparison function; defaults to the library comparator.
     * @returns An ordered collectable.
     */
    public toOrdered(comparator?: Comparator<E>): AsynchronousOrderedCollectable<E> {
        try {
            if (isFunction(comparator)) {
                return new AsynchronousOrderedCollectable(this.generator, comparator);
            }
            return new AsynchronousOrderedCollectable(this.generator);
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
    public toUnordered(): AsynchronousUnorderedCollectable<E> {
        try {
            return new AsynchronousUnorderedCollectable(this.source());
        }
        catch (error) {
            throw new Error(String(error));
        }
    }
    /**
     * Buffers and sorts the source for window operations.
     *
     * @returns A window-capable collectable.
     */
    public toWindow(): AsynchronousWindowCollectable<E> {
        try {
            return new AsynchronousWindowCollectable<E>(this.generator);
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
    public translate(offset: number): AsynchronousSemantic<E>;
    /**
     * Adds a fixed or calculated offset to each emitted index.
     *
     * @param offset - The offset added to each emitted index.
     * @returns A pipeline carrying translated indices.
     */
    public translate(offset: bigint): AsynchronousSemantic<E>;
    /**
     * Adds a fixed or calculated offset to each emitted index.
     *
     * @param translator - Calculates the offset to add to each index.
     * @returns A pipeline carrying translated indices.
     */
    public translate(translator: BiFunctional<E, bigint, bigint>): AsynchronousSemantic<E>;
    /**
     * Adds a fixed or calculated offset to each emitted index.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A pipeline carrying translated indices.
     */
    public translate(argument1: number | bigint | BiFunctional<E, bigint, bigint>): AsynchronousSemantic<E> {
        if (isNumber(argument1) || isBigInt(argument1)) {
            let offset: bigint = useToBigInt(argument1);
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        this.generator((element: E, index: bigint): void => {
                            accept(element, index + offset);
                        }, interrupt).then(resolve, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
        }
        else if (isFunction(argument1)) {
            let translator: BiFunctional<E, bigint, bigint> = argument1;
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        this.generator((element: E, index: bigint): void => {
                            accept(element, index + translator(element, index));
                        }, interrupt).then(resolve, reject);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
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
export abstract class AsynchronousCollectable<E> implements AsyncIterable<E> {
    protected readonly AsynchronousCollectable: symbol = AsynchronousCollectableSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "AsynchronousCollectable";
    /**
     * Initialises the collectable identity.
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
     * Iterates over the elements in this collectable traversal order.
     *
     * @returns An iterator over the collected elements.
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
     * Accumulates elements and applies a finisher, optionally stopping early.
     *
     * @template A - The accumulator type.
     * @template R - The mapped or finished result type.
     * @param argument1 - The first argument selected by the overload.
     * @param argument2 - The optional second argument selected by the overload.
     * @param argument3 - The optional third argument selected by the overload.
     * @param argument4 - The optional finisher for interruptible collection.
     * @returns A promise resolving to the finished result for the selected overload.
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
     * Invokes the action for every encountered element.
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
     * Creates a semantic pipeline backed by this collectable.
     *
     * @returns A semantic view of this source.
     */
    public semantic(): AsynchronousSemantic<E> {
        let source: AsynchronousGenerator<E> = this.source();
        if (isFunction(source)) {
            try {
                return new AsynchronousSemantic(source);
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
    public abstract source(): AsynchronousGenerator<E>;
    /**
     * Collects elements into an array in traversal order.
     *
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
     * Collects elements into a new asynchronous cycle.
     *
     * Elements become the positions of an `AsynchronousCycle`, a bounded
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
     * @template R - The element type of the finished cycle; defaults to the source element type.
     * @param span - Turns occupied by the ring, a positive finite number; defaults to one.
     * @returns A promise resolving to a new cycle over the elements in traversal order.
     * @throws {RangeError} If the span is not positive.
     * @throws {TypeError} If the span is not a finite number or the source contains `null` or `undefined`.
     */
    public async toCycle<R extends E = E>(span?: number): Promise<AsynchronousCycle<R>> {
        try {
            return await useAsynchronousToCycle<E>(span).collect(this.source()) as unknown as AsynchronousCycle<R>;
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
}
;
/**
 * A buffered source ordered by comparator or normalised source indices. Buffering starts at construction and terminal operations await completion.
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
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: AsynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
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
     * Exposes the callback-based generator used to traverse this source.
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
     * Checks whether the source has no elements.
     *
     * @returns A promise resolving to whether the element count is zero.
     */
    public override async isEmpty(): Promise<boolean> {
        await this.settled();
        return this.buffer.length === 0;
    }
    /**
     * Counts the elements in the source.
     *
     * @returns A promise resolving to the element count as a bigint.
     */
    public override async count(): Promise<bigint> {
        await this.settled();
        return BigInt(this.buffer.length);
    }
}
;
/**
 * A buffered source traversed in encounter order, preserving duplicate-index entries. Buffering starts at construction and terminal operations await completion.
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
     * Starts buffering the generator for this collectable.
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
     * Exposes the callback-based generator used to traverse this source.
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
}
;
/**
 * The base statistics API over a buffered ordered source. Buffering starts at construction and terminal operations await completion.
 *
 * @template E - The source element type.
 * @template D - The numeric result type.
 */
export abstract class AsynchronousStatistics<E, D extends number | bigint> extends AsynchronousOrderedCollectable<E> {
    protected readonly AsynchronousStatistics: symbol = AsynchronousStatisticsSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "AsynchronousStatistics";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: AsynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: AsynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param parameter - The callback-based source to buffer.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(parameter: AsynchronousGenerator<E>, comparator?: Comparator<E>) {
        super(parameter, validate(comparator) ? comparator : useCompare);
        Object.defineProperties(this, {
            "AsynchronousStatistics": {
                value: AsynchronousStatisticsSymbol,
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
    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
            yield element;
        }
    }
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @returns A promise resolving to the average; bigint division truncates towards zero.
     */
    public abstract average(): Promise<D>;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the average; bigint division truncates towards zero.
     */
    public abstract average(mapper: Functional<E, D>): Promise<D>;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @returns A promise resolving to the spread of the mapped values.
     */
    public abstract range(): Promise<D>;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the spread of the mapped values.
     */
    public abstract range(mapper: Functional<E, D>): Promise<D>;
    /**
     * Calculates the sample variance, dividing the squared deviations by
     * `n - 1` (Bessel's correction), the default of R `var`, pandas `var` and
     * NumPy `var(ddof=1)`.
     *
     * Pass `{ ddof: 0 }` to restore the previous population variance. An empty
     * view, or fewer than two observations when `ddof` is one, resolves to an
     * empty optional because the sample variance is undefined there; `ddof: 0`
     * remains defined for a single observation and resolves to zero.
     *
     * @returns A promise resolving to the variance, rounded to an integer for
     *          bigint results, or an empty optional when it is undefined.
     */
    public abstract variance(): Promise<Optional<D>>;
    /**
     * Calculates the sample variance with an explicit `ddof`; see the first
     * overload for the definition and the small-sample rule.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public abstract variance(options: VarianceOptions): Promise<Optional<D>>;
    /**
     * Calculates the sample variance of mapped values; see the first overload
     * for the definition and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public abstract variance(mapper: Functional<E, D>, options?: VarianceOptions): Promise<Optional<D>>;
    /**
     * Calculates the sample standard deviation, the square root of the
     * `n - 1` variance.
     *
     * Pass `{ ddof: 0 }` to restore the previous population standard
     * deviation. An empty view, or fewer than two observations when `ddof` is
     * one, resolves to an empty optional; `ddof: 0` remains defined for a
     * single observation and resolves to zero.
     *
     * @returns A promise resolving to the standard deviation, rounded for
     *          bigint results, or an empty optional when it is undefined.
     */
    public abstract standardDeviation(): Promise<Optional<D>>;
    /**
     * Calculates the sample standard deviation with an explicit `ddof`; see
     * the first overload for the definition and the small-sample rule.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public abstract standardDeviation(options: VarianceOptions): Promise<Optional<D>>;
    /**
     * Calculates the sample standard deviation of mapped values; see the first
     * overload for the definition and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public abstract standardDeviation(mapper: Functional<E, D>, options?: VarianceOptions): Promise<Optional<D>>;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @returns A promise resolving to the mean, or zero when empty; bigint division truncates towards zero.
     */
    public abstract mean(): Promise<D>;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the mean, or zero when empty; bigint division truncates towards zero.
     */
    public abstract mean(mapper: Functional<E, D>): Promise<D>;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @returns A promise resolving to the median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public abstract median(): Promise<D>;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public abstract median(mapper: Functional<E, D>): Promise<D>;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public abstract mode(): Promise<D>;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public abstract mode(mapper: Functional<E, D>): Promise<D>;
    /**
     * Counts occurrences using Map key equality.
     *
     * @returns A promise resolving to a map of elements to bigint occurrence counts.
     */
    public async frequency(): Promise<Map<E, bigint>> {
        return await useAsynchronousFrequency<E>().collect(this.source());
    }
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public abstract summate(): Promise<D>;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public abstract summate(mapper: Functional<E, D>): Promise<D>;
    /**
     * Selects a sample quantile with a Hyndman–Fan type.
     *
     * The default `"type-7"` matches R `quantile`, NumPy `linear` (the
     * `np.quantile` default) and Excel `PERCENTILE.INC`. Pass
     * `{ method: "type-1" }` to restore the previous nearest-rank behaviour;
     * the remaining types are available through the same option.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @returns A promise resolving to the quantile, or an empty optional for an
     *          empty statistics view.
     * @throws {RangeError} If probability is not finite or lies outside [0, 1].
     * @throws {TypeError} If the method is not one of the nine supported names.
     */
    public abstract quantile(probability: number): Promise<Optional<D>>;
    /**
     * Selects a sample quantile with an explicit Hyndman–Fan type; see the
     * first overload for the default and the empty-view rule.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public abstract quantile(probability: number, options: QuantileOptions): Promise<Optional<D>>;
    /**
     * Selects a sample quantile of mapped values; see the first overload for
     * the default and the empty-view rule.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public abstract quantile(probability: number, mapper: Functional<E, D>, options?: QuantileOptions): Promise<Optional<D>>;
    /**
     * Subtracts the first quartile from the third quartile using the same
     * Hyndman–Fan method as `quantile`.
     *
     * The default type 7 matches R and NumPy, so the fences derived from this
     * range line up with those tools. Pass `{ method }` to change the type.
     *
     * @returns A promise resolving to the interquartile range, or an empty
     *          optional for an empty statistics view.
     */
    public abstract interquartileRange(): Promise<Optional<D>>;
    /**
     * Subtracts the first quartile from the third quartile with an explicit
     * Hyndman–Fan type; see the first overload for the default.
     *
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public abstract interquartileRange(options: QuantileOptions): Promise<Optional<D>>;
    /**
     * Subtracts the first quartile from the third quartile of mapped values;
     * see the first overload for the default.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public abstract interquartileRange(mapper: Functional<E, D>, options?: QuantileOptions): Promise<Optional<D>>;
    /**
     * Calculates the sample skewness.
     *
     * The default `"G1"` is the bias-corrected Fisher–Pearson coefficient used
     * by Excel `SKEW`, pandas `skew` and SPSS; pass `{ estimator: "g1" }` to
     * restore the previous biased moment ratio `m3 / m2^(3 / 2)`. `G1` is
     * undefined below three observations and `g1` below two; a constant sample
     * is undefined for both. Those cases resolve to an empty optional.
     *
     * @returns A promise resolving to the skewness, rounded for bigint
     *          results, or an empty optional when it is undefined.
     */
    public abstract skewness(): Promise<Optional<D>>;
    /**
     * Calculates the sample skewness with an explicit estimator; see the first
     * overload for the default and the small-sample rule.
     *
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public abstract skewness(options: SkewnessOptions): Promise<Optional<D>>;
    /**
     * Calculates the sample skewness of mapped values; see the first overload
     * for the default and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public abstract skewness(mapper: Functional<E, D>, options?: SkewnessOptions): Promise<Optional<D>>;
    /**
     * Calculates the sample excess kurtosis.
     *
     * The default `"G2"` is the bias-corrected excess estimator used by Excel
     * `KURT` and pandas `kurt`; pass `{ estimator: "g2" }` to restore the
     * previous biased `m4 / m2^2 - 3`. `G2` is undefined below four
     * observations and `g2` below two; a constant sample is undefined for both.
     * `{ excess: false }` adds three back, reporting the non-excess fourth
     * standardised moment. Undefined cases resolve to an empty optional.
     *
     * @returns A promise resolving to the kurtosis, rounded for bigint
     *          results, or an empty optional when it is undefined.
     */
    public abstract kurtosis(): Promise<Optional<D>>;
    /**
     * Calculates the sample kurtosis with an explicit estimator and excess
     * flag; see the first overload for the defaults and the small-sample rule.
     *
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public abstract kurtosis(options: KurtosisOptions): Promise<Optional<D>>;
    /**
     * Calculates the sample kurtosis of mapped values; see the first overload
     * for the defaults and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public abstract kurtosis(mapper: Functional<E, D>, options?: KurtosisOptions): Promise<Optional<D>>;
}
;
/**
 * A buffered statistics view with bigint results and integer rounding where required. Buffering starts at construction and terminal operations await completion.
 *
 * @template E - The source element type.
 */
export class AsynchronousBigIntStatistics<E> extends AsynchronousStatistics<E, bigint> {
    protected readonly BigIntStatistics: symbol = AsynchronousBigIntStatisticsSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "AsynchronousBigIntStatistics";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: AsynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: AsynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param parameter - The callback-based source to buffer.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(parameter: AsynchronousGenerator<E>, comparator?: Comparator<E>) {
        super(parameter, comparator || useCompare);
        Object.defineProperties(this, {
            "AsynchronousBigIntStatistics": {
                value: AsynchronousBigIntStatisticsSymbol,
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
    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
            yield element;
        }
    }
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @returns A promise resolving to the average; bigint division truncates towards zero.
     */
    public async average(): Promise<bigint>;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the average; bigint division truncates towards zero.
     */
    public async average(mapper: Functional<E, bigint>): Promise<bigint>;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the average; bigint division truncates towards zero.
     */
    public async average(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return await useAsynchronousBigIntAverage(mapper).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @returns A promise resolving to the spread of the mapped values.
     */
    public async range(): Promise<bigint>;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the spread of the mapped values.
     */
    public async range(mapper: Functional<E, bigint>): Promise<bigint>;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the spread of the mapped values.
     */
    public async range(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (await this.toArray()).map(mapper);
            let minimum: bigint = data[0];
            let maximum: bigint = data[0];
            for (let value of data) {
                minimum = value < minimum ? value : minimum;
                maximum = value > maximum ? value : maximum;
            }
            return maximum - minimum;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample variance, dividing the squared deviations by
     * `n - 1` (Bessel's correction), the default of R `var`, pandas `var` and
     * NumPy `var(ddof=1)`.
     *
     * Pass `{ ddof: 0 }` to restore the previous population variance. An empty
     * view, or fewer than two observations when `ddof` is one, resolves to an
     * empty optional; with `ddof: 0` a single observation still has a defined
     * variance of zero.
     *
     * @returns A promise resolving to the variance rounded to a bigint, or an
     *          empty optional when it is undefined.
     */
    public async variance(): Promise<Optional<bigint>>;
    /**
     * Calculates the sample variance with an explicit `ddof`; see the first
     * overload for the definition and the small-sample rule.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public async variance(options: VarianceOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample variance of mapped values; see the first overload
     * for the definition and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public async variance(mapper: Functional<E, bigint>, options?: VarianceOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample variance with the selected denominator.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public async variance(argument1?: Functional<E, bigint> | VarianceOptions, argument2?: VarianceOptions): Promise<Optional<bigint>> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (await this.toArray()).map((element: E): bigint => mapper(element));
            let count: number = data.length;
            if (count - ddof < 1) {
                return Optional.empty();
            }
            let offsets: Array<number> = bigintOffsets(data);
            let mean: number = offsets.reduce((total: number, value: number): number => total + value, 0) / count;
            let variance: number = offsets.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0) / (count - ddof);
            return Optional.of(BigInt(Math.round(variance)));
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample standard deviation, the square root of the
     * `n - 1` variance.
     *
     * Pass `{ ddof: 0 }` to restore the previous population standard
     * deviation. An empty view, or fewer than two observations when `ddof` is
     * one, resolves to an empty optional; `ddof: 0` remains defined for a
     * single observation and resolves to zero.
     *
     * @returns A promise resolving to the standard deviation rounded to a
     *          bigint, or an empty optional when it is undefined.
     */
    public async standardDeviation(): Promise<Optional<bigint>>;
    /**
     * Calculates the sample standard deviation with an explicit `ddof`; see
     * the first overload for the definition and the small-sample rule.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public async standardDeviation(options: VarianceOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample standard deviation of mapped values; see the first
     * overload for the definition and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public async standardDeviation(mapper: Functional<E, bigint>, options?: VarianceOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample standard deviation with the selected denominator.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public async standardDeviation(argument1?: Functional<E, bigint> | VarianceOptions, argument2?: VarianceOptions): Promise<Optional<bigint>> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (await this.toArray()).map((element: E): bigint => mapper(element));
            let count: number = data.length;
            if (count - ddof < 1) {
                return Optional.empty();
            }
            let offsets: Array<number> = bigintOffsets(data);
            let mean: number = offsets.reduce((total: number, value: number): number => total + value, 0) / count;
            let variance: number = offsets.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0) / (count - ddof);
            return Optional.of(BigInt(Math.round(Math.sqrt(variance))));
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @returns A promise resolving to the mean, or zero when empty; bigint division truncates towards zero.
     */
    public async mean(): Promise<bigint>;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the mean, or zero when empty; bigint division truncates towards zero.
     */
    public async mean(mapper: Functional<E, bigint>): Promise<bigint>;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the mean, or zero when empty; bigint division truncates towards zero.
     */
    public async mean(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return await useAsynchronousBigIntAverage(mapper).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @returns A promise resolving to the median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public async median(): Promise<bigint>;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public async median(mapper: Functional<E, bigint>): Promise<bigint>;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public async median(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useAsynchronousBigIntMedian(mapper).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public async mode(): Promise<bigint>;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public async mode(mapper: Functional<E, bigint>): Promise<bigint>;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public async mode(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useAsynchronousBigIntMode(mapper).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public async summate(): Promise<bigint>;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public async summate(mapper: Functional<E, bigint>): Promise<bigint>;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public async summate(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return await useAsynchronousBigIntSummate(mapper).collect(this.source() as AsynchronousGenerator<bigint>);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Selects a sample quantile with a Hyndman–Fan type.
     *
     * The default `"type-7"` matches R `quantile`, NumPy `linear` and Excel
     * `PERCENTILE.INC`; pass `{ method: "type-1" }` to restore the previous
     * nearest-rank behaviour. Interpolated types round the interpolated offset
     * to the nearest bigint, while types 1–3 select an exact order statistic.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @returns A promise resolving to the quantile, or an empty optional for an
     *          empty statistics view.
     * @throws {RangeError} If probability is not finite or lies outside [0, 1].
     * @throws {TypeError} If the method is not one of the nine supported names.
     */
    public async quantile(probability: number): Promise<Optional<bigint>>;
    /**
     * Selects a sample quantile with an explicit Hyndman–Fan type; see the
     * first overload for the default and the empty-view rule.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public async quantile(probability: number, options: QuantileOptions): Promise<Optional<bigint>>;
    /**
     * Selects a sample quantile of mapped values; see the first overload for
     * the default and the empty-view rule.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public async quantile(probability: number, mapper: Functional<E, bigint>, options?: QuantileOptions): Promise<Optional<bigint>>;
    /**
     * Selects a sample quantile with the selected Hyndman–Fan type.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public async quantile(probability: number, argument1?: Functional<E, bigint> | QuantileOptions, argument2?: QuantileOptions): Promise<Optional<bigint>> {
        if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
            throw new RangeError("Invalid quantile.");
        }
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (await this.toArray()).map(mapper).sort(useCompare);
            let offsets: Array<number> = bigintOffsets(data);
            let offset: number = quantileOfSorted(offsets, probability, method);
            return Optional.of(data[0] + BigInt(Math.round(offset)));
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Subtracts the first quartile from the third quartile using the same
     * Hyndman–Fan method as `quantile`.
     *
     * The default type 7 matches R and NumPy. Because bigint quantiles are
     * rounded, the range is the difference of the two rounded quartiles.
     *
     * @returns A promise resolving to the interquartile range, or an empty
     *          optional for an empty statistics view.
     */
    public async interquartileRange(): Promise<Optional<bigint>>;
    /**
     * Subtracts the first quartile from the third quartile with an explicit
     * Hyndman–Fan type; see the first overload for the default.
     *
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public async interquartileRange(options: QuantileOptions): Promise<Optional<bigint>>;
    /**
     * Subtracts the first quartile from the third quartile of mapped values;
     * see the first overload for the default.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public async interquartileRange(mapper: Functional<E, bigint>, options?: QuantileOptions): Promise<Optional<bigint>>;
    /**
     * Subtracts the first quartile from the third quartile.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public async interquartileRange(argument1?: Functional<E, bigint> | QuantileOptions, argument2?: QuantileOptions): Promise<Optional<bigint>> {
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let lower: Optional<bigint> = await this.quantile(0.25, mapper, options);
            let upper: Optional<bigint> = await this.quantile(0.75, mapper, options);
            if (lower.isEmpty() || upper.isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(upper.get() - lower.get());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample skewness.
     *
     * The default `"G1"` is the bias-corrected Fisher–Pearson coefficient used
     * by Excel `SKEW`, pandas `skew` and SPSS; pass `{ estimator: "g1" }` to
     * restore the previous biased moment ratio `m3 / m2^(3 / 2)`. `G1` is
     * undefined below three observations and `g1` below two; a constant sample
     * is undefined for both. Those cases resolve to an empty optional.
     *
     * @returns A promise resolving to the skewness rounded to a bigint, or an
     *          empty optional when it is undefined.
     */
    public async skewness(): Promise<Optional<bigint>>;
    /**
     * Calculates the sample skewness with an explicit estimator; see the first
     * overload for the default and the small-sample rule.
     *
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public async skewness(options: SkewnessOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample skewness of mapped values; see the first overload
     * for the default and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public async skewness(mapper: Functional<E, bigint>, options?: SkewnessOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample skewness with the selected estimator.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public async skewness(argument1?: Functional<E, bigint> | SkewnessOptions, argument2?: SkewnessOptions): Promise<Optional<bigint>> {
        let options: SkewnessOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G1";
        if (!isSkewnessEstimator(estimator)) {
            throw new TypeError("Invalid skewness estimator.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (await this.toArray()).map((element: E): bigint => mapper(element));
            let count: number = data.length;
            if (estimator === "G1" ? count < 3 : count < 2) {
                return Optional.empty();
            }
            let offsets: Array<number> = bigintOffsets(data);
            let mean: number = offsets.reduce((total: number, value: number): number => total + value, 0) / count;
            let second: number = offsets.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0) / count;
            if (second === 0) {
                return Optional.empty();
            }
            let third: number = offsets.reduce((total: number, value: number): number => total + Math.pow(value - mean, 3), 0) / count;
            let g1: number = third / Math.pow(second, 1.5);
            let skewness: number = estimator === "G1" ? Math.sqrt(count * (count - 1)) / (count - 2) * g1 : g1;
            return Optional.of(BigInt(Math.round(skewness)));
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample excess kurtosis.
     *
     * The default `"G2"` is the bias-corrected excess estimator used by Excel
     * `KURT` and pandas `kurt`; pass `{ estimator: "g2" }` to restore the
     * previous biased `m4 / m2^2 - 3`. `G2` is undefined below four
     * observations and `g2` below two; a constant sample is undefined for both.
     * `{ excess: false }` adds three back, reporting the non-excess fourth
     * standardised moment. Undefined cases resolve to an empty optional.
     *
     * @returns A promise resolving to the kurtosis rounded to a bigint, or an
     *          empty optional when it is undefined.
     */
    public async kurtosis(): Promise<Optional<bigint>>;
    /**
     * Calculates the sample kurtosis with an explicit estimator and excess
     * flag; see the first overload for the defaults and the small-sample rule.
     *
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public async kurtosis(options: KurtosisOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample kurtosis of mapped values; see the first overload
     * for the defaults and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public async kurtosis(mapper: Functional<E, bigint>, options?: KurtosisOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample kurtosis with the selected estimator and excess
     * flag.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public async kurtosis(argument1?: Functional<E, bigint> | KurtosisOptions, argument2?: KurtosisOptions): Promise<Optional<bigint>> {
        let options: KurtosisOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G2";
        let excess: boolean = options.excess ?? true;
        if (!isKurtosisEstimator(estimator)) {
            throw new TypeError("Invalid kurtosis estimator.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (await this.toArray()).map((element: E): bigint => mapper(element));
            let count: number = data.length;
            if (estimator === "G2" ? count < 4 : count < 2) {
                return Optional.empty();
            }
            let offsets: Array<number> = bigintOffsets(data);
            let mean: number = offsets.reduce((total: number, value: number): number => total + value, 0) / count;
            let second: number = offsets.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0) / count;
            if (second === 0) {
                return Optional.empty();
            }
            let fourth: number = offsets.reduce((total: number, value: number): number => total + Math.pow(value - mean, 4), 0) / count;
            let g2: number = fourth / Math.pow(second, 2) - 3;
            let kurtosis: number = estimator === "G2" ? ((count - 1) / ((count - 2) * (count - 3))) * ((count + 1) * g2 + 6) : g2;
            return Optional.of(BigInt(Math.round(excess ? kurtosis : kurtosis + 3)));
        }
        catch (error) {
            throw error;
        }
    }
}
;
/**
 * A buffered statistics view with number results. Buffering starts at construction and terminal operations await completion.
 *
 * @template E - The source element type.
 */
export class AsynchronousNumericStatistics<E> extends AsynchronousStatistics<E, number> {
    protected readonly AsynchronousNumericStatistics: symbol = AsynchronousNumericStatisticsSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "AsynchronousNumericStatistics";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: AsynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: AsynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param parameter - The callback-based source to buffer.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(parameter: AsynchronousGenerator<E>, comparator?: Comparator<E>) {
        super(parameter, comparator || useCompare);
        Object.defineProperties(this, {
            "AsynchronousNumericStatistics": {
                value: AsynchronousNumericStatisticsSymbol,
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
    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
            yield element;
        }
    }
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @returns A promise resolving to the arithmetic average, or zero when empty.
     */
    public async average(): Promise<number>;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the arithmetic average, or zero when empty.
     */
    public async average(mapper: Functional<E, number>): Promise<number>;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the arithmetic average, or zero when empty.
     */
    public async average(mapper?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            if (isFunction(mapper)) {
                return useAsynchronousNumericAverage(mapper).collect(this.source() as AsynchronousGenerator<number>);
            }
            return useAsynchronousNumericAverage().collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @returns A promise resolving to the spread of the mapped values.
     */
    public async range(): Promise<number>;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the spread of the mapped values.
     */
    public async range(mapper: Functional<E, number>): Promise<number>;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the spread of the mapped values.
     */
    public async range(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            if (await this.count() === 1n) {
                return 0;
            }
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = (await this.toArray()).map(mapper);
            let minimum: number = data[0];
            let maximum: number = data[0];
            for (let value of data) {
                minimum = Math.min(minimum, value);
                maximum = Math.max(maximum, value);
            }
            return maximum - minimum;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample variance, dividing the squared deviations by
     * `n - 1` (Bessel's correction), the default of R `var`, pandas `var` and
     * NumPy `var(ddof=1)`.
     *
     * Pass `{ ddof: 0 }` to restore the previous population variance. An empty
     * view, or fewer than two observations when `ddof` is one, resolves to an
     * empty optional; with `ddof: 0` a single observation still has a defined
     * variance of zero. The two-pass computation avoids the catastrophic
     * cancellation of the `sum(x^2) - sum(x)^2 / n` form.
     *
     * @returns A promise resolving to the variance, or an empty optional when
     *          it is undefined.
     */
    public async variance(): Promise<Optional<number>>;
    /**
     * Calculates the sample variance with an explicit `ddof`; see the first
     * overload for the definition and the small-sample rule.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public async variance(options: VarianceOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample variance of mapped values; see the first overload
     * for the definition and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public async variance(mapper: Functional<E, number>, options?: VarianceOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample variance with the selected denominator.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public async variance(argument1?: Functional<E, number> | VarianceOptions, argument2?: VarianceOptions): Promise<Optional<number>> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = (await this.toArray()).map(mapper);
            let count: number = data.length;
            if (count - ddof < 1) {
                return Optional.empty();
            }
            let mean: number = data.reduce((total: number, value: number): number => total + value, 0) / count;
            let summate: number = data.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0);
            return Optional.of(summate / (count - ddof));
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample standard deviation, the square root of the
     * `n - 1` variance.
     *
     * Pass `{ ddof: 0 }` to restore the previous population standard
     * deviation. An empty view, or fewer than two observations when `ddof` is
     * one, resolves to an empty optional; `ddof: 0` remains defined for a
     * single observation and resolves to zero.
     *
     * @returns A promise resolving to the standard deviation, or an empty
     *          optional when it is undefined.
     */
    public async standardDeviation(): Promise<Optional<number>>;
    /**
     * Calculates the sample standard deviation with an explicit `ddof`; see
     * the first overload for the definition and the small-sample rule.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public async standardDeviation(options: VarianceOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample standard deviation of mapped values; see the first
     * overload for the definition and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public async standardDeviation(mapper: Functional<E, number>, options?: VarianceOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample standard deviation with the selected denominator.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public async standardDeviation(argument1?: Functional<E, number> | VarianceOptions, argument2?: VarianceOptions): Promise<Optional<number>> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = (await this.toArray()).map(mapper);
            let count: number = data.length;
            if (count - ddof < 1) {
                return Optional.empty();
            }
            let mean: number = data.reduce((total: number, value: number): number => total + value, 0) / count;
            let summate: number = data.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0);
            return Optional.of(Math.sqrt(summate / (count - ddof)));
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @returns A promise resolving to the mean, or zero when empty; bigint division truncates towards zero.
     */
    public async mean(): Promise<number>;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the mean, or zero when empty; bigint division truncates towards zero.
     */
    public async mean(mapper: Functional<E, number>): Promise<number>;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the mean, or zero when empty; bigint division truncates towards zero.
     */
    public async mean(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useAsynchronousNumericAverage(mapper).collect(this.source() as AsynchronousGenerator<number>);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @returns A promise resolving to the median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public async median(): Promise<number>;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public async median(mapper: Functional<E, number>): Promise<number>;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public async median(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return await useAsynchronousNumericMedian(mapper).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public async mode(): Promise<number>;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public async mode(mapper: Functional<E, number>): Promise<number>;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public async mode(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return await useAsynchronousNumericMode(mapper).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public async summate(): Promise<number>;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public async summate(mapper: Functional<E, number>): Promise<number>;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public async summate(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useAsynchronousNumericSummate(mapper).collect(this.source() as AsynchronousGenerator<number>);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Selects a sample quantile with a Hyndman–Fan type.
     *
     * The default `"type-7"` matches R `quantile`, NumPy `linear` (the
     * `np.quantile` default) and Excel `PERCENTILE.INC`. Pass
     * `{ method: "type-1" }` to restore the previous nearest-rank behaviour;
     * the remaining types are available through the same option.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @returns A promise resolving to the quantile, or an empty optional for an
     *          empty statistics view.
     * @throws {RangeError} If probability is not finite or lies outside [0, 1].
     * @throws {TypeError} If the method is not one of the nine supported names.
     */
    public async quantile(probability: number): Promise<Optional<number>>;
    /**
     * Selects a sample quantile with an explicit Hyndman–Fan type; see the
     * first overload for the default and the empty-view rule.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public async quantile(probability: number, options: QuantileOptions): Promise<Optional<number>>;
    /**
     * Selects a sample quantile of mapped values; see the first overload for
     * the default and the empty-view rule.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public async quantile(probability: number, mapper: Functional<E, number>, options?: QuantileOptions): Promise<Optional<number>>;
    /**
     * Selects a sample quantile with the selected Hyndman–Fan type.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public async quantile(probability: number, argument1?: Functional<E, number> | QuantileOptions, argument2?: QuantileOptions): Promise<Optional<number>> {
        if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
            throw new RangeError("Invalid quantile.");
        }
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = (await this.toArray()).map(mapper).sort(useCompare);
            return Optional.of(quantileOfSorted(data, probability, method));
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Subtracts the first quartile from the third quartile using the same
     * Hyndman–Fan method as `quantile`.
     *
     * The default type 7 matches R and NumPy, so the fences derived from this
     * range line up with those tools. Pass `{ method }` to change the type.
     *
     * @returns A promise resolving to the interquartile range, or an empty
     *          optional for an empty statistics view.
     */
    public async interquartileRange(): Promise<Optional<number>>;
    /**
     * Subtracts the first quartile from the third quartile with an explicit
     * Hyndman–Fan type; see the first overload for the default.
     *
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public async interquartileRange(options: QuantileOptions): Promise<Optional<number>>;
    /**
     * Subtracts the first quartile from the third quartile of mapped values;
     * see the first overload for the default.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public async interquartileRange(mapper: Functional<E, number>, options?: QuantileOptions): Promise<Optional<number>>;
    /**
     * Subtracts the first quartile from the third quartile.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public async interquartileRange(argument1?: Functional<E, number> | QuantileOptions, argument2?: QuantileOptions): Promise<Optional<number>> {
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let lower: Optional<number> = await this.quantile(0.25, mapper, options);
            let upper: Optional<number> = await this.quantile(0.75, mapper, options);
            if (lower.isEmpty() || upper.isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(upper.get() - lower.get());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample skewness.
     *
     * The default `"G1"` is the bias-corrected Fisher–Pearson coefficient used
     * by Excel `SKEW`, pandas `skew` and SPSS; pass `{ estimator: "g1" }` to
     * restore the previous biased moment ratio `m3 / m2^(3 / 2)`. `G1` is
     * undefined below three observations and `g1` below two; a constant sample
     * is undefined for both. Those cases resolve to an empty optional.
     *
     * @returns A promise resolving to the skewness, or an empty optional when
     *          it is undefined.
     */
    public async skewness(): Promise<Optional<number>>;
    /**
     * Calculates the sample skewness with an explicit estimator; see the first
     * overload for the default and the small-sample rule.
     *
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public async skewness(options: SkewnessOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample skewness of mapped values; see the first overload
     * for the default and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public async skewness(mapper: Functional<E, number>, options?: SkewnessOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample skewness with the selected estimator.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public async skewness(argument1?: Functional<E, number> | SkewnessOptions, argument2?: SkewnessOptions): Promise<Optional<number>> {
        let options: SkewnessOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G1";
        if (!isSkewnessEstimator(estimator)) {
            throw new TypeError("Invalid skewness estimator.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = (await this.toArray()).map((element: E): number => mapper(element));
            let count: number = data.length;
            if (estimator === "G1" ? count < 3 : count < 2) {
                return Optional.empty();
            }
            let mean: number = data.reduce((total: number, value: number): number => total + value, 0) / count;
            let second: number = data.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0) / count;
            if (second === 0) {
                return Optional.empty();
            }
            let third: number = data.reduce((total: number, value: number): number => total + Math.pow(value - mean, 3), 0) / count;
            let g1: number = third / Math.pow(second, 1.5);
            return Optional.of(estimator === "G1" ? Math.sqrt(count * (count - 1)) / (count - 2) * g1 : g1);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample excess kurtosis.
     *
     * The default `"G2"` is the bias-corrected excess estimator used by Excel
     * `KURT` and pandas `kurt`; pass `{ estimator: "g2" }` to restore the
     * previous biased `m4 / m2^2 - 3`. `G2` is undefined below four
     * observations and `g2` below two; a constant sample is undefined for both.
     * `{ excess: false }` adds three back, reporting the non-excess fourth
     * standardised moment. Undefined cases resolve to an empty optional.
     *
     * @returns A promise resolving to the kurtosis, or an empty optional when
     *          it is undefined.
     */
    public async kurtosis(): Promise<Optional<number>>;
    /**
     * Calculates the sample kurtosis with an explicit estimator and excess
     * flag; see the first overload for the defaults and the small-sample rule.
     *
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public async kurtosis(options: KurtosisOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample kurtosis of mapped values; see the first overload
     * for the defaults and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public async kurtosis(mapper: Functional<E, number>, options?: KurtosisOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample kurtosis with the selected estimator and excess
     * flag.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public async kurtosis(argument1?: Functional<E, number> | KurtosisOptions, argument2?: KurtosisOptions): Promise<Optional<number>> {
        let options: KurtosisOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G2";
        let excess: boolean = options.excess ?? true;
        if (!isKurtosisEstimator(estimator)) {
            throw new TypeError("Invalid kurtosis estimator.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = (await this.toArray()).map((element: E): number => mapper(element));
            let count: number = data.length;
            if (estimator === "G2" ? count < 4 : count < 2) {
                return Optional.empty();
            }
            let mean: number = data.reduce((total: number, value: number): number => total + value, 0) / count;
            let second: number = data.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0) / count;
            if (second === 0) {
                return Optional.empty();
            }
            let fourth: number = data.reduce((total: number, value: number): number => total + Math.pow(value - mean, 4), 0) / count;
            let g2: number = fourth / Math.pow(second, 2) - 3;
            let kurtosis: number = estimator === "G2" ? ((count - 1) / ((count - 2) * (count - 3))) * ((count + 1) * g2 + 6) : g2;
            return Optional.of(excess ? kurtosis : kurtosis + 3);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the normal-theory standard error of the reported skewness.
     *
     * The closed form is `sqrt(6n(n - 1) / ((n - 2)(n + 1)(n + 3)))`, the
     * standard error used by SAS, SPSS and `e1071::skewness` for `G1`; the
     * asymptotic counterpart for `g1` is `sqrt(6 / n)`. It requires at least
     * three observations, because the `n - 2` factor is in the denominator.
     * The bigint views omit this method: a standard error is real-valued, and
     * rounding it to an integer would report zero for most samples.
     *
     * @returns A promise resolving to the standard error, or an empty optional
     *          when it is undefined.
     */
    public async skewnessStandardError(): Promise<Optional<number>> {
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        let count: number = Number(await this.count());
        if (count < 3) {
            return Optional.empty();
        }
        return Optional.of(Math.sqrt(6 * count * (count - 1) / ((count - 2) * (count + 1) * (count + 3))));
    }
    /**
     * Calculates the normal-theory standard error of the reported kurtosis.
     *
     * The closed form is
     * `sqrt(24n(n - 1)^2 / ((n - 3)(n - 2)(n + 3)(n + 5)))`, the standard
     * error used by SAS, SPSS and `e1071::kurtosis` for `G2`; the asymptotic
     * counterpart for `g2` is `sqrt(24 / n)`. It requires at least four
     * observations, because the `n - 3` factor is in the denominator.
     *
     * @returns A promise resolving to the standard error, or an empty optional
     *          when it is undefined.
     */
    public async kurtosisStandardError(): Promise<Optional<number>> {
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        let count: number = Number(await this.count());
        if (count < 4) {
            return Optional.empty();
        }
        return Optional.of(Math.sqrt(24 * count * Math.pow(count - 1, 2) / ((count - 3) * (count - 2) * (count + 3) * (count + 5))));
    }
}
;
/**
 * A buffered ordered source supporting sliding and tumbling windows. Buffering starts at construction and terminal operations await completion.
 *
 * @template E - The source element type.
 */
export class AsynchronousWindowCollectable<E> extends AsynchronousOrderedCollectable<E> {
    protected readonly WindowCollectable: symbol = AsynchronousWindowCollectableSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "AsynchronousWindowCollectable";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: AsynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: AsynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param parameter - The callback-based source to buffer.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(parameter: AsynchronousGenerator<E>, comparator: Comparator<E> = useCompare) {
        super(parameter, comparator);
        Object.defineProperties(this, {
            "AsynchronousWindowCollectable": {
                value: AsynchronousWindowCollectableSymbol,
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
    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
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
    public slide(size: bigint, step: bigint = 1n): AsynchronousSemantic<AsynchronousSemantic<E>> {
        if (!isBigInt(size) || !isBigInt(step) || size <= 0n || step <= 0n) {
            throw new RangeError("Invalid arguments.");
        }
        return new AsynchronousSemantic<AsynchronousSemantic<E>>(async (accept: Consumer<AsynchronousSemantic<E>> | BiConsumer<AsynchronousSemantic<E>, bigint>, interrupt: Predicate<AsynchronousSemantic<E>> | BiPredicate<AsynchronousSemantic<E>, bigint>): Promise<void> => {
            await this.settled();
            let index: bigint = 0n;
            for (let start: bigint = 0n; start < BigInt(this.buffer.length); start += step) {
                let end: bigint = start + size;
                let inner: AsynchronousSemantic<E> = new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                    for (let index: bigint = start; index < end && index < BigInt(this.buffer.length); index++) {
                        let indexed: Indexed<E> = this.buffer[Number(index)];
                        if (interrupt(indexed.element, index)) {
                            break;
                        }
                        accept(indexed.element, index);
                    }
                });
                if (interrupt(inner, index)) {
                    break;
                }
                accept(inner, index);
                index++;
            }
        });
    }
    /**
     * Creates non-overlapping windows by using the size as the step.
     *
     * @param size - The positive maximum window size.
     * @returns A pipeline of windows, including a final partial window.
     */
    public tumble(size: bigint): AsynchronousSemantic<AsynchronousSemantic<E>> {
        if (isBigInt(size) && size > 0n) {
            try {
                return this.slide(size, size);
            }
            catch (error) {
                throw error;
            }
        }
        throw new RangeError("Invalid arguments.");
    }
}
;
