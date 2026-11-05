/**
 * The asynchronous pipeline API: the lazy, promise-based `AsynchronousSemantic`
 * class together with the single constant its `shuffle` step needs.
 *
 * This module carries the pipeline itself and nothing else. Every materialised
 * family lives in its own module, and `src/index.ts` publishes each of them
 * straight from there: `#semantic/asynchronous/collectable` owns the collectable
 * classes, `#semantic/asynchronous/statistics` the statistics views,
 * `#semantic/asynchronous/window` the window views,
 * `#semantic/asynchronous/signal` the signal views and
 * `#semantic/asynchronous/distribution` the distribution views. The historical
 * import path `#semantic/asynchronous/semantic` therefore exposes exactly
 * {@link AsynchronousSemantic}; a family type is no longer reachable through it.
 *
 * The module imports the base collectable classes and the statistics and window
 * views because the terminal bridges of the class construct them lazily:
 * `toCollectable`, `toOrdered`, `toUnordered`, `toBigintStatistics`,
 * `toNumericStatistics` and `toWindow`. `#semantic/asynchronous/window` imports
 * `AsynchronousSemantic` back, so the two modules form a cycle. The cycle is
 * safe: the window module only reads the class inside method bodies, after both
 * modules have been evaluated.
 *
 * Complexity: constructing a pipeline is O(1) and allocates one closure per
 * step; a step only schedules work, and a chain of k steps costs O(k) extra
 * memory while the terminal operation awaits the source exactly once.
 *
 * @module
 */

import { isFunction, isAsynchronousSemantic, isIterable, isNumber, isBigInt, isAsynchronousCollectable, isAsyncIterable } from "#semantic/guard";
import { useRandom, useToBigInt } from "#semantic/hook";
import { AsynchronousSemanticSymbol } from "#semantic/symbol";
import { validate, type BiConsumer, type BiFunctional, type BiPredicate, type Comparator, type Consumer, type Functional, type Predicate, type AsynchronousGenerator, type Runnable } from "#semantic/utility";
import { AsynchronousCollectable, AsynchronousOrderedCollectable, AsynchronousUnorderedCollectable } from "#semantic/asynchronous/collectable";
import { AsynchronousBigIntStatistics, AsynchronousNumericStatistics } from "#semantic/asynchronous/statistics";
import { AsynchronousWindowCollectable } from "#semantic/asynchronous/window";

/**
 * The exclusive upper bound of the random index `shuffle` assigns to each
 * element that carries no mapper.
 */
const SHUFFLE_BOUND: bigint = 1n << 62n;

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
     * Buffers the source for window operations.
     *
     * @returns A lazy window pipeline.
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
};
