import { useSynchronousFrequency, useSynchronousBigIntAverage, useSynchronousBigIntMedian, useSynchronousBigIntMode, useSynchronousBigIntSummate, useSynchronousNumericAverage, useSynchronousNumericMedian, useSynchronousNumericMode, useSynchronousNumericSummate } from "#semantic/synchronous/collectors";
import { isFunction, isSynchronousSemantic, isIterable, isNumber, isBigInt, isSynchronousCollectable } from "#semantic/guard";
import { useCompare, useRandom, useToBigInt, useToNumber } from "#semantic/hook";
import { SynchronousBigIntStatisticsSymbol, SynchronousNumericStatisticsSymbol, SynchronousSemanticSymbol, SynchronousWindowCollectableSymbol, SynchronousStatisticsSymbol } from "#semantic/symbol";
import { invalidate, validate, type BiConsumer, type BiFunctional, type BiPredicate, type Comparator, type Consumer, type Functional, type Indexed, type Predicate, type SynchronousGenerator } from "#semantic/utility";
import { Optional } from "#semantic/optional";
import { isKurtosisEstimator, isQuantileMethod, isSkewnessEstimator, isVarianceDdof, quantileOfSorted, type KurtosisOptions, type QuantileOptions, type SkewnessOptions, type VarianceOptions } from "#semantic/mathematics/quantile";
import { SynchronousCollectable, SynchronousOrderedCollectable, SynchronousUnorderedCollectable } from "#semantic/synchronous/collectable";
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
 * Re-export of the synchronous collectable family.
 *
 * `SynchronousCollectable`, `SynchronousOrderedCollectable` and
 * `SynchronousUnorderedCollectable` are defined in
 * `#semantic/synchronous/collectable` and re-exported here so that the
 * historical import path `#semantic/synchronous/semantic` keeps exposing
 * them. Keeping the definitions outside this module is what lets
 * `src/index.ts` publish both the synchronous and the asynchronous family
 * without a name clash.
 */
export {
    SynchronousCollectable, SynchronousOrderedCollectable, SynchronousUnorderedCollectable
} from "#semantic/synchronous/collectable";

const SHUFFLE_BOUND: bigint = 1n << 62n;
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
     * Calculates the sample variance, dividing the squared deviations by
     * `n - 1` (Bessel's correction).
     *
     * This matches R `var`, pandas `var` and NumPy `var(ddof=1)`. Pass
     * `{ ddof: 0 }` to restore the previous population variance. An empty view,
     * or fewer than two observations when `ddof` is one, returns an empty
     * optional because the sample variance is undefined there; `ddof: 0`
     * remains defined for a single observation and returns zero.
     *
     * @returns The variance, rounded to an integer for bigint results, or an
     *          empty optional when it is undefined.
     */
    public abstract variance(): Optional<D>;
    /**
     * Calculates the sample variance with an explicit `ddof`; see the first
     * overload for the definition and the small-sample rule.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The variance, or an empty optional when it is undefined.
     */
    public abstract variance(options: VarianceOptions): Optional<D>;
    /**
     * Calculates the sample variance of mapped values; see the first overload
     * for the definition and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The variance, or an empty optional when it is undefined.
     */
    public abstract variance(mapper: Functional<E, D>, options?: VarianceOptions): Optional<D>;
    /**
     * Calculates the sample standard deviation, the square root of the
     * `n - 1` variance.
     *
     * Pass `{ ddof: 0 }` to restore the previous population standard
     * deviation. An empty view, or fewer than two observations when `ddof` is
     * one, returns an empty optional; `ddof: 0` remains defined for a single
     * observation and returns zero. The result is slightly biased even under
     * normality because the square root is concave.
     *
     * @returns The standard deviation, rounded for bigint results, or an empty
     *          optional when it is undefined.
     */
    public abstract standardDeviation(): Optional<D>;
    /**
     * Calculates the sample standard deviation with an explicit `ddof`; see the
     * first overload for the definition and the small-sample rule.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The standard deviation, or an empty optional when it is undefined.
     */
    public abstract standardDeviation(options: VarianceOptions): Optional<D>;
    /**
     * Calculates the sample standard deviation of mapped values; see the first
     * overload for the definition and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The standard deviation, or an empty optional when it is undefined.
     */
    public abstract standardDeviation(mapper: Functional<E, D>, options?: VarianceOptions): Optional<D>;
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
     * Selects a sample quantile with a Hyndman–Fan type.
     *
     * The default `"type-7"` matches R `quantile`, NumPy `linear` (the
     * `np.quantile` default) and Excel `PERCENTILE.INC`. Pass
     * `{ method: "type-1" }` to restore the previous nearest-rank behaviour;
     * the remaining types are available through the same option.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @returns The quantile, or an empty optional for an empty statistics view.
     * @throws {RangeError} If probability is not finite or lies outside [0, 1].
     * @throws {TypeError} If the method is not one of the nine supported names.
     */
    public abstract quantile(probability: number): Optional<D>;
    /**
     * Selects a sample quantile with an explicit Hyndman–Fan type; see the
     * first overload for the default and the empty-view rule.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public abstract quantile(probability: number, options: QuantileOptions): Optional<D>;
    /**
     * Selects a sample quantile of mapped values; see the first overload for
     * the default and the empty-view rule.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public abstract quantile(probability: number, mapper: Functional<E, D>, options?: QuantileOptions): Optional<D>;
    /**
     * Subtracts the first quartile from the third quartile using the same
     * Hyndman–Fan method as `quantile`.
     *
     * The default type 7 matches R and NumPy, so the fences derived from this
     * range line up with those tools. Pass `{ method }` to change the type.
     *
     * @returns The interquartile range, or an empty optional for an empty
     *          statistics view.
     */
    public abstract interquartileRange(): Optional<D>;
    /**
     * Subtracts the first quartile from the third quartile with an explicit
     * Hyndman–Fan type; see the first overload for the default.
     *
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public abstract interquartileRange(options: QuantileOptions): Optional<D>;
    /**
     * Subtracts the first quartile from the third quartile of mapped values;
     * see the first overload for the default.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public abstract interquartileRange(mapper: Functional<E, D>, options?: QuantileOptions): Optional<D>;
    /**
     * Calculates the sample skewness.
     *
     * The default `"G1"` is the bias-corrected Fisher–Pearson coefficient used
     * by Excel `SKEW`, pandas `skew` and SPSS; pass `{ estimator: "g1" }` to
     * restore the previous biased moment ratio `m3 / m2^(3 / 2)`. `G1` is
     * undefined below three observations and `g1` below two; a constant sample
     * is undefined for both. Those cases return an empty optional.
     *
     * @returns The skewness, rounded for bigint results, or an empty optional
     *          when it is undefined.
     */
    public abstract skewness(): Optional<D>;
    /**
     * Calculates the sample skewness with an explicit estimator; see the first
     * overload for the default and the small-sample rule.
     *
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns The skewness, or an empty optional when it is undefined.
     */
    public abstract skewness(options: SkewnessOptions): Optional<D>;
    /**
     * Calculates the sample skewness of mapped values; see the first overload
     * for the default and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns The skewness, or an empty optional when it is undefined.
     */
    public abstract skewness(mapper: Functional<E, D>, options?: SkewnessOptions): Optional<D>;
    /**
     * Calculates the sample excess kurtosis.
     *
     * The default `"G2"` is the bias-corrected excess estimator used by Excel
     * `KURT` and pandas `kurt`; pass `{ estimator: "g2" }` to restore the
     * previous biased `m4 / m2^2 - 3`. `G2` is undefined below four
     * observations and `g2` below two; a constant sample is undefined for both.
     * `{ excess: false }` adds three back, reporting the non-excess fourth
     * standardised moment. Undefined cases return an empty optional.
     *
     * @returns The kurtosis, rounded for bigint results, or an empty optional
     *          when it is undefined.
     */
    public abstract kurtosis(): Optional<D>;
    /**
     * Calculates the sample kurtosis with an explicit estimator and excess
     * flag; see the first overload for the defaults and the small-sample rule.
     *
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns The kurtosis, or an empty optional when it is undefined.
     */
    public abstract kurtosis(options: KurtosisOptions): Optional<D>;
    /**
     * Calculates the sample kurtosis of mapped values; see the first overload
     * for the defaults and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns The kurtosis, or an empty optional when it is undefined.
     */
    public abstract kurtosis(mapper: Functional<E, D>, options?: KurtosisOptions): Optional<D>;
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
            throw error;
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
     * view, or fewer than two observations when `ddof` is one, returns an
     * empty optional; with `ddof: 0` a single observation still has a defined
     * variance of zero.
     *
     * @returns The variance rounded to a bigint, or an empty optional when it
     *          is undefined.
     */
    public variance(): Optional<bigint>;
    /**
     * Calculates the sample variance with an explicit `ddof`; see the first
     * overload for the definition and the small-sample rule.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The variance rounded to a bigint, or an empty optional when it is undefined.
     */
    public variance(options: VarianceOptions): Optional<bigint>;
    /**
     * Calculates the sample variance of mapped values; see the first overload
     * for the definition and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The variance rounded to a bigint, or an empty optional when it is undefined.
     */
    public variance(mapper: Functional<E, bigint>, options?: VarianceOptions): Optional<bigint>;
    /**
     * Calculates the sample variance with the selected denominator.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The variance rounded to a bigint, or an empty optional when it is undefined.
     */
    public variance(argument1?: Functional<E, bigint> | VarianceOptions, argument2?: VarianceOptions): Optional<bigint> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = this.toArray().map((element: E): bigint => mapper(element));
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
     * one, returns an empty optional; `ddof: 0` remains defined for a single
     * observation and returns zero.
     *
     * @returns The standard deviation rounded to a bigint, or an empty
     *          optional when it is undefined.
     */
    public standardDeviation(): Optional<bigint>;
    /**
     * Calculates the sample standard deviation with an explicit `ddof`; see
     * the first overload for the definition and the small-sample rule.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The standard deviation rounded to a bigint, or an empty optional when it is undefined.
     */
    public standardDeviation(options: VarianceOptions): Optional<bigint>;
    /**
     * Calculates the sample standard deviation of mapped values; see the first
     * overload for the definition and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The standard deviation rounded to a bigint, or an empty optional when it is undefined.
     */
    public standardDeviation(mapper: Functional<E, bigint>, options?: VarianceOptions): Optional<bigint>;
    /**
     * Calculates the sample standard deviation with the selected denominator.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The standard deviation rounded to a bigint, or an empty optional when it is undefined.
     */
    public standardDeviation(argument1?: Functional<E, bigint> | VarianceOptions, argument2?: VarianceOptions): Optional<bigint> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = this.toArray().map((element: E): bigint => mapper(element));
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
            throw error;
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
            throw error;
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
            throw error;
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
     * @returns The quantile, or an empty optional for an empty statistics view.
     * @throws {RangeError} If probability is not finite or lies outside [0, 1].
     * @throws {TypeError} If the method is not one of the nine supported names.
     */
    public quantile(probability: number): Optional<bigint>;
    /**
     * Selects a sample quantile with an explicit Hyndman–Fan type; see the
     * first overload for the default and the empty-view rule.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public quantile(probability: number, options: QuantileOptions): Optional<bigint>;
    /**
     * Selects a sample quantile of mapped values; see the first overload for
     * the default and the empty-view rule.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public quantile(probability: number, mapper: Functional<E, bigint>, options?: QuantileOptions): Optional<bigint>;
    /**
     * Selects a sample quantile with the selected Hyndman–Fan type.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public quantile(probability: number, argument1?: Functional<E, bigint> | QuantileOptions, argument2?: QuantileOptions): Optional<bigint> {
        if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
            throw new RangeError("Invalid quantile.");
        }
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = this.toArray().map(mapper).sort(useCompare);
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
     * @returns The interquartile range, or an empty optional for an empty
     *          statistics view.
     */
    public interquartileRange(): Optional<bigint>;
    /**
     * Subtracts the first quartile from the third quartile with an explicit
     * Hyndman–Fan type; see the first overload for the default.
     *
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public interquartileRange(options: QuantileOptions): Optional<bigint>;
    /**
     * Subtracts the first quartile from the third quartile of mapped values;
     * see the first overload for the default.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public interquartileRange(mapper: Functional<E, bigint>, options?: QuantileOptions): Optional<bigint>;
    /**
     * Subtracts the first quartile from the third quartile.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public interquartileRange(argument1?: Functional<E, bigint> | QuantileOptions, argument2?: QuantileOptions): Optional<bigint> {
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let lower: Optional<bigint> = this.quantile(0.25, mapper, options);
            let upper: Optional<bigint> = this.quantile(0.75, mapper, options);
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
     * is undefined for both. Those cases return an empty optional.
     *
     * @returns The skewness rounded to a bigint, or an empty optional when it
     *          is undefined.
     */
    public skewness(): Optional<bigint>;
    /**
     * Calculates the sample skewness with an explicit estimator; see the first
     * overload for the default and the small-sample rule.
     *
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns The skewness rounded to a bigint, or an empty optional when it is undefined.
     */
    public skewness(options: SkewnessOptions): Optional<bigint>;
    /**
     * Calculates the sample skewness of mapped values; see the first overload
     * for the default and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns The skewness rounded to a bigint, or an empty optional when it is undefined.
     */
    public skewness(mapper: Functional<E, bigint>, options?: SkewnessOptions): Optional<bigint>;
    /**
     * Calculates the sample skewness with the selected estimator.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The skewness rounded to a bigint, or an empty optional when it is undefined.
     */
    public skewness(argument1?: Functional<E, bigint> | SkewnessOptions, argument2?: SkewnessOptions): Optional<bigint> {
        let options: SkewnessOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G1";
        if (!isSkewnessEstimator(estimator)) {
            throw new TypeError("Invalid skewness estimator.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = this.toArray().map((element: E): bigint => mapper(element));
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
     * standardised moment. Undefined cases return an empty optional.
     *
     * @returns The kurtosis rounded to a bigint, or an empty optional when it
     *          is undefined.
     */
    public kurtosis(): Optional<bigint>;
    /**
     * Calculates the sample kurtosis with an explicit estimator and excess
     * flag; see the first overload for the defaults and the small-sample rule.
     *
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns The kurtosis rounded to a bigint, or an empty optional when it is undefined.
     */
    public kurtosis(options: KurtosisOptions): Optional<bigint>;
    /**
     * Calculates the sample kurtosis of mapped values; see the first overload
     * for the defaults and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns The kurtosis rounded to a bigint, or an empty optional when it is undefined.
     */
    public kurtosis(mapper: Functional<E, bigint>, options?: KurtosisOptions): Optional<bigint>;
    /**
     * Calculates the sample kurtosis with the selected estimator and excess
     * flag.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The kurtosis rounded to a bigint, or an empty optional when it is undefined.
     */
    public kurtosis(argument1?: Functional<E, bigint> | KurtosisOptions, argument2?: KurtosisOptions): Optional<bigint> {
        let options: KurtosisOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G2";
        let excess: boolean = options.excess ?? true;
        if (!isKurtosisEstimator(estimator)) {
            throw new TypeError("Invalid kurtosis estimator.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = this.toArray().map((element: E): bigint => mapper(element));
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
            throw error;
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
            if (this.count() === 1n) {
                return 0;
            }
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
            throw error;
        }
    }
    /**
     * Calculates the sample variance, dividing the squared deviations by
     * `n - 1` (Bessel's correction), the default of R `var`, pandas `var` and
     * NumPy `var(ddof=1)`.
     *
     * Pass `{ ddof: 0 }` to restore the previous population variance. An empty
     * view, or fewer than two observations when `ddof` is one, returns an
     * empty optional; with `ddof: 0` a single observation still has a defined
     * variance of zero. The two-pass computation avoids the catastrophic
     * cancellation of the `sum(x^2) - sum(x)^2 / n` form.
     *
     * @returns The variance, or an empty optional when it is undefined.
     */
    public variance(): Optional<number>;
    /**
     * Calculates the sample variance with an explicit `ddof`; see the first
     * overload for the definition and the small-sample rule.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The variance, or an empty optional when it is undefined.
     */
    public variance(options: VarianceOptions): Optional<number>;
    /**
     * Calculates the sample variance of mapped values; see the first overload
     * for the definition and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The variance, or an empty optional when it is undefined.
     */
    public variance(mapper: Functional<E, number>, options?: VarianceOptions): Optional<number>;
    /**
     * Calculates the sample variance with the selected denominator.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The variance, or an empty optional when it is undefined.
     */
    public variance(argument1?: Functional<E, number> | VarianceOptions, argument2?: VarianceOptions): Optional<number> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = this.toArray().map(mapper);
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
     * one, returns an empty optional; `ddof: 0` remains defined for a single
     * observation and returns zero. The result is slightly biased even under
     * normality because the square root is concave.
     *
     * @returns The standard deviation, or an empty optional when it is undefined.
     */
    public standardDeviation(): Optional<number>;
    /**
     * Calculates the sample standard deviation with an explicit `ddof`; see
     * the first overload for the definition and the small-sample rule.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The standard deviation, or an empty optional when it is undefined.
     */
    public standardDeviation(options: VarianceOptions): Optional<number>;
    /**
     * Calculates the sample standard deviation of mapped values; see the first
     * overload for the definition and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The standard deviation, or an empty optional when it is undefined.
     */
    public standardDeviation(mapper: Functional<E, number>, options?: VarianceOptions): Optional<number>;
    /**
     * Calculates the sample standard deviation with the selected denominator.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The standard deviation, or an empty optional when it is undefined.
     */
    public standardDeviation(argument1?: Functional<E, number> | VarianceOptions, argument2?: VarianceOptions): Optional<number> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = this.toArray().map(mapper);
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
            throw error;
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
            throw error;
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
            throw error;
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
     * @returns The quantile, or an empty optional for an empty statistics view.
     * @throws {RangeError} If probability is not finite or lies outside [0, 1].
     * @throws {TypeError} If the method is not one of the nine supported names.
     */
    public quantile(probability: number): Optional<number>;
    /**
     * Selects a sample quantile with an explicit Hyndman–Fan type; see the
     * first overload for the default and the empty-view rule.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public quantile(probability: number, options: QuantileOptions): Optional<number>;
    /**
     * Selects a sample quantile of mapped values; see the first overload for
     * the default and the empty-view rule.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public quantile(probability: number, mapper: Functional<E, number>, options?: QuantileOptions): Optional<number>;
    /**
     * Selects a sample quantile with the selected Hyndman–Fan type.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public quantile(probability: number, argument1?: Functional<E, number> | QuantileOptions, argument2?: QuantileOptions): Optional<number> {
        if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
            throw new RangeError("Invalid quantile.");
        }
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = this.toArray().map(mapper).sort(useCompare);
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
     * @returns The interquartile range, or an empty optional for an empty
     *          statistics view.
     */
    public interquartileRange(): Optional<number>;
    /**
     * Subtracts the first quartile from the third quartile with an explicit
     * Hyndman–Fan type; see the first overload for the default.
     *
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public interquartileRange(options: QuantileOptions): Optional<number>;
    /**
     * Subtracts the first quartile from the third quartile of mapped values;
     * see the first overload for the default.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public interquartileRange(mapper: Functional<E, number>, options?: QuantileOptions): Optional<number>;
    /**
     * Subtracts the first quartile from the third quartile.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public interquartileRange(argument1?: Functional<E, number> | QuantileOptions, argument2?: QuantileOptions): Optional<number> {
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let lower: Optional<number> = this.quantile(0.25, mapper, options);
            let upper: Optional<number> = this.quantile(0.75, mapper, options);
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
     * is undefined for both. Those cases return an empty optional.
     *
     * @returns The skewness, or an empty optional when it is undefined.
     */
    public skewness(): Optional<number>;
    /**
     * Calculates the sample skewness with an explicit estimator; see the first
     * overload for the default and the small-sample rule.
     *
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns The skewness, or an empty optional when it is undefined.
     */
    public skewness(options: SkewnessOptions): Optional<number>;
    /**
     * Calculates the sample skewness of mapped values; see the first overload
     * for the default and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns The skewness, or an empty optional when it is undefined.
     */
    public skewness(mapper: Functional<E, number>, options?: SkewnessOptions): Optional<number>;
    /**
     * Calculates the sample skewness with the selected estimator.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The skewness, or an empty optional when it is undefined.
     */
    public skewness(argument1?: Functional<E, number> | SkewnessOptions, argument2?: SkewnessOptions): Optional<number> {
        let options: SkewnessOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G1";
        if (!isSkewnessEstimator(estimator)) {
            throw new TypeError("Invalid skewness estimator.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = this.toArray().map((element: E): number => mapper(element));
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
     * standardised moment. Undefined cases return an empty optional.
     *
     * @returns The kurtosis, or an empty optional when it is undefined.
     */
    public kurtosis(): Optional<number>;
    /**
     * Calculates the sample kurtosis with an explicit estimator and excess
     * flag; see the first overload for the defaults and the small-sample rule.
     *
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns The kurtosis, or an empty optional when it is undefined.
     */
    public kurtosis(options: KurtosisOptions): Optional<number>;
    /**
     * Calculates the sample kurtosis of mapped values; see the first overload
     * for the defaults and the small-sample rule.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns The kurtosis, or an empty optional when it is undefined.
     */
    public kurtosis(mapper: Functional<E, number>, options?: KurtosisOptions): Optional<number>;
    /**
     * Calculates the sample kurtosis with the selected estimator and excess
     * flag.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The kurtosis, or an empty optional when it is undefined.
     */
    public kurtosis(argument1?: Functional<E, number> | KurtosisOptions, argument2?: KurtosisOptions): Optional<number> {
        let options: KurtosisOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G2";
        let excess: boolean = options.excess ?? true;
        if (!isKurtosisEstimator(estimator)) {
            throw new TypeError("Invalid kurtosis estimator.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = this.toArray().map((element: E): number => mapper(element));
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
     * @returns The standard error, or an empty optional when it is undefined.
     */
    public skewnessStandardError(): Optional<number> {
        if (this.isEmpty()) {
            return Optional.empty();
        }
        let count: number = Number(this.count());
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
     * @returns The standard error, or an empty optional when it is undefined.
     */
    public kurtosisStandardError(): Optional<number> {
        if (this.isEmpty()) {
            return Optional.empty();
        }
        let count: number = Number(this.count());
        if (count < 4) {
            return Optional.empty();
        }
        return Optional.of(Math.sqrt(24 * count * Math.pow(count - 1, 2) / ((count - 3) * (count - 2) * (count + 3) * (count + 5))));
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
