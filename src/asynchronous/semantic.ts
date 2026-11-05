import { useAsynchronousFrequency, useAsynchronousBigIntAverage, useAsynchronousBigIntMedian, useAsynchronousBigIntMode, useAsynchronousBigIntSummate, useAsynchronousNumericAverage, useAsynchronousNumericMedian, useAsynchronousNumericMode, useAsynchronousNumericSummate } from "#semantic/asynchronous/collectors";
import { isFunction, isAsynchronousSemantic, isIterable, isNumber, isBigInt, isAsynchronousCollectable, isAsyncIterable } from "#semantic/guard";
import { useCompare, useRandom, useToBigInt, useToNumber } from "#semantic/hook";
import { AsynchronousBigIntStatisticsSymbol, AsynchronousNumericStatisticsSymbol, AsynchronousSemanticSymbol, AsynchronousWindowCollectableSymbol, AsynchronousStatisticsSymbol } from "#semantic/symbol";
import { validate, type BiConsumer, type BiFunctional, type BiPredicate, type Comparator, type Consumer, type Functional, type Indexed, type Predicate, type AsynchronousGenerator, type Runnable } from "#semantic/utility";
import { Optional } from "#semantic/optional";
import { isKurtosisEstimator, isQuantileMethod, isSkewnessEstimator, isVarianceDdof, quantileOfSorted, type KurtosisOptions, type QuantileOptions, type SkewnessOptions, type VarianceOptions } from "#semantic/mathematics/quantile";
import { AsynchronousCollectable, AsynchronousOrderedCollectable, AsynchronousUnorderedCollectable } from "#semantic/asynchronous/collectable";
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
 * Re-export of the asynchronous collectable family.
 *
 * `AsynchronousCollectable`, `AsynchronousOrderedCollectable` and
 * `AsynchronousUnorderedCollectable` are defined in
 * `#semantic/asynchronous/collectable` and re-exported here so that the
 * historical import path `#semantic/asynchronous/semantic` keeps exposing
 * them. Keeping the definitions outside this module is what lets
 * `src/index.ts` publish both the synchronous and the asynchronous family
 * without a name clash.
 */
export {
    AsynchronousCollectable, AsynchronousOrderedCollectable, AsynchronousUnorderedCollectable
} from "#semantic/asynchronous/collectable";

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
