import {
    useSynchronousAnyMatch, useSynchronousAllMatch, useSynchronousCollect, useSynchronousCount, useSynchronousError, useSynchronousFindAny, useSynchronousFindAt,
    useSynchronousFindFirst, useSynchronousFindLast, useSynchronousFindMaximum, useSynchronousFindMinimum, useSynchronousForEach, useSynchronousGroup, useSynchronousGroupBy,
    useSynchronousJoin, useSynchronousLog, useSynchronousNoneMatch, useSynchronousPartition, useSynchronousPartitionBy, useSynchronousReduce, useSynchronousToArray,
    useSynchronousToMap, useSynchronousToSet, useSynchronousWrite, useSynchronousFrequency, useSynchronousBigIntAverage, useSynchronousBigIntMedian, useSynchronousBigIntMode,
    useSynchronousBigIntSummate, useSynchronousBigIntVariance, useSynchronousNumericAverage, useSynchronousNumericMedian, useSynchronousNumericMode,
    useSynchronousNumericStandardDeviation, useSynchronousNumericSummate, useSynchronousNumericVariance
} from "./collector";
import { isFunction, isSynchronousSemantic, isIterable, isNumber, isBigInt, isObject, isString, isSynchronousCollectable, isSynchronousCollector } from "../guard";
import { useHash } from "../hash";
import { useCompare, useToBigInt, useToNumber } from "../hook";
import {
    SynchronousOrderedCollectableSymbol, SynchronousBigIntStatisticsSymbol, SynchronousCollectableSymbol, SynchronousNumericStatisticsSymbol, SynchronousSemanticSymbol,
    SynchronousWindowCollectableSymbol, SynchronousUnorderedCollectableSymbol, SynchronousStatisticsSymbol
} from "../symbol";
import { invalidate, validate, type BiConsumer, type BiFunctional, type BiPredicate, type Comparator, type Consumer, type Functional, type Indexed, type Predicate, 
    type Supplier, type SynchronousGenerator, type TriFunctional, type TriPredicate } from "../utility";
import { SynchronousCollector } from "./collector";
import type { Optional } from "../optional";

export class SynchronousSemantic<E> {

    protected generator: SynchronousGenerator<E>;

    protected readonly SynchronousSemantic: Symbol = SynchronousSemanticSymbol;

    [Symbol.toStringTag]: string = "SynchronousSemantic";

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
        } else {
            throw new TypeError("Invalid arguments.");
        }
    }

    public concat(other: SynchronousSemantic<E>): SynchronousSemantic<E>;
    public concat(other: Iterable<E>): SynchronousSemantic<E>;
    public concat(argument: SynchronousSemantic<E> | Iterable<E>): SynchronousSemantic<E> {
        if (isSynchronousSemantic(argument)) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    let other: SynchronousSemantic<E> = argument as unknown as SynchronousSemantic<E>;
                    let generator: SynchronousGenerator<E> = other.source();
                    let count: bigint = 0n;
                    this.generator((element: E) => {
                        accept(element, count);
                        count++;
                    }, interrupt);
                    generator((element: E) => {
                        accept(element, count);
                        count++;
                    }, interrupt);
                } catch (error) {
                    throw error;
                }
            });
        }
        if (isIterable(argument)) {
            let other: Iterable<E> = argument as unknown as Iterable<E>;
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    let count: bigint = 0n;
                    this.generator((element: E, index: bigint) => {
                        accept(element, index);
                        count++;
                    }, interrupt);
                    for (let element of other) {
                        accept(element, count);
                        count++;
                    }
                } catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public distinct(): SynchronousSemantic<E>;
    public distinct<K>(keyExtractor: Functional<E, K>): SynchronousSemantic<E>;
    public distinct<K>(keyExtractor: BiFunctional<E, bigint, K>): SynchronousSemantic<E>;
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
            } catch (error) {
                throw error;
            }
        });
    }

    public dropWhile(predicate: Predicate<E>): SynchronousSemantic<E>;
    public dropWhile(predicate: BiPredicate<E, bigint>): SynchronousSemantic<E>;
    public dropWhile(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousSemantic<E> {
        if (isFunction(predicate)) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    let count: bigint = -1n;
                    this.generator((element: E, index: bigint): void => {
                        if (count === -1n) {
                            if (!predicate(element, index)) {
                                count++;
                            }
                        } else {
                            accept(element, count);
                            count++;
                        }
                    }, interrupt);
                } catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public filter(predicate: Predicate<E>): SynchronousSemantic<E>;
    public filter(predicate: BiPredicate<E, bigint>): SynchronousSemantic<E>;
    public filter(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousSemantic<E> {
        if (isFunction(predicate)) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        if (predicate(element, index)) {
                            accept(element, index);
                        }
                    }, interrupt);
                } catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public flat(mapper: Functional<E, Iterable<E>>): SynchronousSemantic<E>;
    public flat(mapper: BiFunctional<E, bigint, Iterable<E>>): SynchronousSemantic<E>;
    public flat(mapper: Functional<E, SynchronousSemantic<E>>): SynchronousSemantic<E>;
    public flat(mapper: BiFunctional<E, bigint, SynchronousSemantic<E>>): SynchronousSemantic<E>;
    public flat(mapper: Functional<E, Iterable<E>> | BiFunctional<E, bigint, Iterable<E>> | Functional<E, SynchronousSemantic<E>> | BiFunctional<E, bigint, SynchronousSemantic<E>>): SynchronousSemantic<E> {
        if (isFunction(mapper)) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    let count: bigint = 0n;
                    let stop: boolean = false;
                    this.generator((element: E, index: bigint): void => {
                        let result: SynchronousSemantic<E> | Iterable<E> = mapper(element, index);
                        if (isIterable(result)) {
                            for (let subElement of result) {
                                accept(subElement, count);
                                stop = stop || interrupt(subElement, count);
                                count++;
                            }
                        } else if (isSynchronousSemantic(result)) {
                            result.generator((subElement: E): void => {
                                accept(subElement, count);
                                stop = stop || interrupt(subElement, count);
                                count++;
                            }, (element: E): boolean => interrupt(element, count) || stop);
                        }
                    }, (element: E): boolean => interrupt(element, count) || stop);
                } catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public flatMap<R>(mapper: Functional<E, Iterable<R>>): SynchronousSemantic<R>;
    public flatMap<R>(mapper: BiFunctional<E, bigint, Iterable<R>>): SynchronousSemantic<R>;
    public flatMap<R>(mapper: Functional<E, SynchronousSemantic<R>>): SynchronousSemantic<R>;
    public flatMap<R>(mapper: BiFunctional<E, bigint, SynchronousSemantic<R>>): SynchronousSemantic<R>;
    public flatMap<R>(mapper: Functional<E, Iterable<R> | SynchronousSemantic<R>> | BiFunctional<E, bigint, Iterable<R> | SynchronousSemantic<R>>): SynchronousSemantic<R> {
        if (isFunction(mapper)) {
            return new SynchronousSemantic<R>((accept: Consumer<R> | BiConsumer<R, bigint>, interrupt: Predicate<R> | BiPredicate<R, bigint>): void => {
                try {
                    let count: bigint = 0n;
                    let stop: boolean = false;
                    this.generator((element: E, index: bigint): void => {
                        let transform: SynchronousSemantic<R> | Iterable<R> = mapper(element, index);
                        if (isIterable(transform)) {
                            for (let subElement of transform) {
                                accept(subElement, count);
                                stop = stop || interrupt(subElement, count);
                                count++;
                            }
                        } else if (isSynchronousSemantic(transform)) {
                            transform.source()((subElement: R): void => {
                                accept(subElement, count);
                                stop = stop || interrupt(subElement, count);
                                count++;
                            }, (element: R): boolean => interrupt(element, count) || stop)
                        }
                    }, (): boolean => stop);
                } catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public limit(count: number): SynchronousSemantic<E>;
    public limit(count: bigint): SynchronousSemantic<E>;
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
                } catch (error) {
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
                } catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public map(mapper: Functional<E, E>): SynchronousSemantic<E>;
    public map(mapper: BiFunctional<E, bigint, E>): SynchronousSemantic<E>;
    public map<R>(mapper: Functional<E, R>): SynchronousSemantic<R>;
    public map<R>(mapper: BiFunctional<E, bigint, R>): SynchronousSemantic<R>;
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
                } catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public peek(consumer: Consumer<E>): SynchronousSemantic<E>;
    public peek(consumer: BiConsumer<E, bigint>): SynchronousSemantic<E>;
    public peek(consumer: Consumer<E> | BiConsumer<E, bigint>): SynchronousSemantic<E> {
        if (isFunction(consumer)) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, index);
                        consumer(element, index);
                    }, interrupt);
                } catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public redirect(redirector: BiFunctional<E, bigint, bigint>): SynchronousSemantic<E> {
        if (isFunction(redirector)) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, redirector(element, index));
                    }, interrupt);
                } catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public reverse(): SynchronousSemantic<E> {
        return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            try {
                this.generator((element: E, index: bigint): void => {
                    accept(element, -index);
                }, interrupt);
            } catch (error) {
                throw error;
            }
        });
    }

    public shuffle(): SynchronousSemantic<E>;
    public shuffle(mapper: BiFunctional<E, bigint, bigint>): SynchronousSemantic<E>;
    public shuffle(mapper?: BiFunctional<E, bigint, bigint>): SynchronousSemantic<E> {
        if (isFunction(mapper)) {
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, mapper(element, index));
                    }, interrupt);
                } catch (error) {
                    throw error;
                }
            });
        }
        return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            try {
                this.generator((element: E, index: bigint): void => {
                    accept(element, useHash(element, index));
                }, interrupt);
            } catch (error) {
                throw error;
            }
        });
    }

    public skip(count: number): SynchronousSemantic<E>;
    public skip(count: bigint): SynchronousSemantic<E>;
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
                        } else {
                            accept(element, index);
                        }
                    }, interrupt);
                } catch (error) {
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
                        } else {
                            accept(element, index);
                        }
                    }, interrupt);
                } catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public source(): SynchronousGenerator<E> {
        return this.generator;
    }

    public sub(start: number, end: number): SynchronousSemantic<E>;
    public sub(start: bigint, end: bigint): SynchronousSemantic<E>;
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
                            count++;
                        }
                    }, (element: E, index: bigint): boolean => count >= maximum || interrupt(element, index));
                } catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public takeWhile(predicate: Predicate<E>): SynchronousSemantic<E>;
    public takeWhile(predicate: BiPredicate<E, bigint>): SynchronousSemantic<E>;
    public takeWhile(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousSemantic<E> {
        return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            try {
                let stop: boolean = false;
                this.generator((element: E, index: bigint) => {
                    if (predicate(element, index) && !stop) {
                        accept(element, index);
                    } else {
                        stop = true;
                    }
                }, (element: E, index: bigint): boolean => stop || interrupt(element, index));
            } catch (error) {
                throw error;
            }
        });
    }

    public toCollectable(): SynchronousCollectable<E>;
    public toCollectable<C extends SynchronousCollectable<E>>(mapper: Functional<SynchronousGenerator<E>, C>): C;
    public toCollectable<C extends SynchronousCollectable<E>>(mapper?: Functional<SynchronousGenerator<E>, C>): SynchronousCollectable<E> | C {
        if (isFunction(mapper)) {
            try {
                let SynchronousCollectable: C = mapper(this.generator);
                if (isSynchronousCollectable(SynchronousCollectable)) {
                    return SynchronousCollectable;
                }
            } catch (error) {
                throw error;
            }
        }
        try {
            return new SynchronousUnorderedCollectable(this.generator);
        } catch (error) {
            throw error;
        }
    }

    public toBigintStatistics(): SynchronousBigIntStatistics<E> {
        try {
            return new SynchronousBigIntStatistics<E>(this.generator);
        } catch (error) {
            throw error;
        }
    }

    public toNumericStatistics(): SynchronousNumericStatistics<E> {
        try {
            return new SynchronousNumericStatistics<E>(this.generator);
        } catch (error) {
            throw error;
        }
    }

    public toOrdered(): SynchronousOrderedCollectable<E> {
        try {
            return new SynchronousOrderedCollectable(this.generator);
        } catch (error) {
            throw error;
        }
    }

    public toUnordered(): SynchronousUnorderedCollectable<E> {
        try {
            return new SynchronousUnorderedCollectable(this.generator);
        } catch (error) {
            throw error;
        }
    }

    public toWindow(): SynchronousWindowCollectable<E> {
        try {
            return new SynchronousWindowCollectable<E>(this.generator);
        } catch (error) {
            throw error;
        }
    }

    public translate(offset: number): SynchronousSemantic<E>;
    public translate(offset: bigint): SynchronousSemantic<E>;
    public translate(translator: BiFunctional<E, bigint, bigint>): SynchronousSemantic<E>;
    public translate(argument1: number | bigint | BiFunctional<E, bigint, bigint>): SynchronousSemantic<E> {
        if (isNumber(argument1)) {
            let offset: number = argument1;
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, index + BigInt(offset));
                    }, interrupt);
                } catch (error) {
                    throw error;
                }
            });
        } else if (isBigInt(argument1)) {
            let offset: bigint = argument1;
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, index + offset);
                    }, interrupt);
                } catch (error) {
                    throw error;
                }
            });
        } else if (isFunction(argument1)) {
            let translator: BiFunctional<E, bigint, bigint> = argument1;
            return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, index + translator(element, index));
                    }, interrupt);
                } catch (error) {
                    throw error;
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }
};

export abstract class SynchronousCollectable<E> implements Iterable<E> {

    protected readonly SynchronousCollectable: symbol = SynchronousCollectableSymbol;

    [Symbol.toStringTag]: string = "SynchronousCollectable";

    public constructor() {
        Object.defineProperty(this, "SynchronousCollectable", {
            value: SynchronousCollectableSymbol,
            enumerable: false,
            writable: false,
            configurable: false
        });
    }

    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let element of this.toArray()) {
            yield element;
        }
    }

    public anyMatch(predicate: Predicate<E>): boolean;
    public anyMatch(predicate: BiPredicate<E, bigint>): boolean;
    public anyMatch(predicate: Predicate<E> | BiPredicate<E, bigint>): boolean {
        if (isFunction(predicate)) {
            try {
                return useSynchronousAnyMatch(predicate).collect(this.source());
            } catch (error) {
                throw error;
            }
        }
        throw new TypeError("Predicate must be a function.");
    }

    public allMatch(predicate: Predicate<E>): boolean;
    public allMatch(predicate: BiPredicate<E, bigint>): boolean;
    public allMatch(predicate: Predicate<E> | BiPredicate<E, bigint>): boolean {
        return useSynchronousAllMatch(predicate).collect(this.source());
    }

    public collect<A, R>(collector: SynchronousCollector<E, A, R>): R;
    public collect<A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): R;
    public collect<A, R>(identity: Supplier<A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): R;
    public collect<A, R>(identity: Supplier<A>, interruptor: Predicate<E>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): R;
    public collect<A, R>(identity: Supplier<A>, interruptor: BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): R;
    public collect<A, R>(identity: Supplier<A>, interruptor: TriPredicate<E, bigint, A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): R;
    public collect<A, R>(identity: Supplier<A>, interruptor: Predicate<E>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): R;
    public collect<A, R>(identity: Supplier<A>, interruptor: BiPredicate<E, bigint>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): R;
    public collect<A, R>(identity: Supplier<A>, interruptor: TriPredicate<E, bigint, A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): R;
    public collect<A, R>(argument1: Supplier<A> | SynchronousCollector<E, A, R>, argument2?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Predicate<E> | BiPredicate<E, bigint> | TriPredicate<E, bigint, A>, argument3?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Functional<A, R>, argument4?: Functional<A, R>): R {
        try {
            if (isSynchronousCollector(argument1)) {
                let collector: SynchronousCollector<E, A, R> = argument1 as SynchronousCollector<E, A, R>;
                return collector.collect(this.source());
            }
            if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3)) {
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
        } catch (error) {
            throw error;
        }
        throw new TypeError("Invalid arguments.");
    }

    public count(): bigint {
        return useSynchronousCount<E>().collect(this.source());
    }

    public error(): void;
    public error(accumulator: BiFunctional<string, E, string>): void;
    public error(accumulator: TriFunctional<string, E, bigint, string>): void;
    public error(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): void;
    public error(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): void;
    public error(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): void {
        if (invalidate(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                useSynchronousError<E>().collect(this.source());
            } catch (error) {
                throw error;
            }
        } else if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                useSynchronousError<E>(accumulator).collect(this.source());
            } catch (error) {
                throw error;
            }
        } else if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
            try {
                let prefix: string = argument1;
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                let suffix: string = argument3;
                useSynchronousError<E>(prefix, accumulator, suffix).collect(this.source());
            } catch (error) {
                throw error;
            }
        } else {
            throw new TypeError("Invalid arguments.");
        }
    }

    public isEmpty(): boolean {
        return this.count() === 0n;
    }

    public findAny(): Optional<E> {
        try {
            return useSynchronousFindAny<E>().collect(this.source());
        } catch (error) {
            throw error;
        }
    }

    public findAt(index: number): Optional<E>;
    public findAt(index: bigint): Optional<E>;
    public findAt(index: number | bigint): Optional<E> {
        if (isBigInt(index)) {
            try {
                return useSynchronousFindAt<E>(index).collect(this.source());
            } catch (error) {
                throw error;
            }
        } else if (isNumber(index)) {
            try {
                return useSynchronousFindAt<E>(index).collect(this.source());
            } catch (error) {
                throw error;
            }
        }
        throw new TypeError("Index must be a bigint.");
    }

    public findFirst(): Optional<E> {
        try {
            return useSynchronousFindFirst<E>().collect(this.source());
        } catch (error) {
            throw error;
        }
    }

    public findLast(): Optional<E> {
        try {
            return useSynchronousFindLast<E>().collect(this.source());
        } catch (error) {
            throw error;
        }
    }

    public findMaximum(): Optional<E>;
    public findMaximum(comparator: Comparator<E>): Optional<E>;
    public findMaximum(argument1?: Comparator<E>): Optional<E> {
        try {
            let comparator: Comparator<E> = isFunction(argument1) ? argument1 : useCompare;
            return useSynchronousFindMaximum(comparator).collect(this.source());
        } catch (error) {
            throw error;
        }
    }

    public findMinimum(): Optional<E>;
    public findMinimum(comparator: Comparator<E>): Optional<E>;
    public findMinimum(argument1?: Comparator<E>): Optional<E> {
        try {
            let comparator: Comparator<E> = isFunction(argument1) ? argument1 : useCompare;
            return useSynchronousFindMinimum(comparator).collect(this.source());
        } catch (error) {
            throw error;
        }
    }

    public forEach(action: Consumer<E>): void;
    public forEach(action: BiConsumer<E, bigint>): void;
    public forEach(action: Consumer<E> | BiConsumer<E, bigint>): void {
        if (isFunction(action)) {
            try {
                useSynchronousForEach(action).collect(this.source());
            } catch (error) {
                throw error;
            }
        } else {
            throw new TypeError("Action must be a function.");
        }
    }

    public group<K>(classifier: Functional<E, K>): Map<K, Array<E>>;
    public group<K>(classifier: BiFunctional<E, bigint, K>): Map<K, Array<E>>
    public group<K>(classifier: Functional<E, K> | BiFunctional<E, bigint, K>): Map<K, Array<E>> {
        if (isFunction(classifier)) {
            try {
                return useSynchronousGroup(classifier).collect(this.source());
            } catch (error) {
                throw error;
            }
        }
        throw new TypeError("Classifier must be a function.");
    }

    public groupBy<K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): Map<K, Array<V>>;
    public groupBy<K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, K>): Map<K, Array<V>>
    public groupBy<K, V>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V>): Map<K, Array<V>> {
        if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
            try {
                return useSynchronousGroupBy(keyExtractor, valueExtractor).collect(this.source());
            } catch (error) {
                throw error;
            }
        }
        throw new TypeError("Key and value extractors must be functions.");
    }

    public join(): string;
    public join(delimiter: string): string;
    public join(prefix: string, delimiter: string, suffix: string): string;
    public join(prefiex: string, accumulator: BiFunctional<string, E, string>, suffix: string): string;
    public join(prefiex: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): string;
    public join(argument1?: string, argument2?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): string {
        if (invalidate(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                return useSynchronousJoin<E>().collect(this.source());
            } catch (error) {
                throw error;
            }
        } else if (isString(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let delimiter: string = argument1;
                return useSynchronousJoin<E>(delimiter).collect(this.source());
            } catch (error) {
                throw error;
            }
        } else if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
            try {
                let prefix: string = argument1;
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                let suffix: string = argument3;
                return useSynchronousJoin<E>(prefix, accumulator, suffix).collect(this.source());
            } catch (error) {
                throw error;
            }
        } else if (isString(argument1) && isString(argument2) && isString(argument3)) {
            try {
                let prefix: string = argument1;
                let delimiter: string = argument2;
                let suffix: string = argument3;
                return useSynchronousJoin<E>(prefix, delimiter, suffix).collect(this.source());
            } catch (error) {
                throw error;
            }
        }
        throw new TypeError("Invalid arguments.");
    }

    public log(): void;
    public log(accumulator: BiFunctional<string, E, string>): void;
    public log(accumulator: TriFunctional<string, E, bigint, string>): void;
    public log(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): void;
    public log(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): void;
    public log(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): void {
        if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                useSynchronousLog<E>(accumulator).collect(this.source());
            } catch (error) {
                throw error;
            }
        } else if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
            try {
                let prefix: string = argument1;
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                let suffix: string = argument3;
                useSynchronousLog<E>(prefix, accumulator, suffix).collect(this.source());
            } catch (error) {
                throw error;
            }
        } else {
            try {
                useSynchronousLog<E>().collect(this.source());
            } catch (error) {
                throw error;
            }
        }
    }

    public nonMatch(predicate: Predicate<E>): boolean;
    public nonMatch(predicate: BiPredicate<E, bigint>): boolean;
    public nonMatch(predicate: Predicate<E> | BiPredicate<E, bigint>): boolean {
        if (isFunction(predicate)) {
            try {
                return useSynchronousNoneMatch(predicate).collect(this.source());
            } catch (error) {
                throw error;
            }
        }
        throw new TypeError("Predicate must be a function.");
    }

    public partition(count: bigint): Array<Array<E>> {
        if (isBigInt(count)) {
            try {
                return useSynchronousPartition<E>(count).collect(this.source());
            } catch (error) {
                throw error;
            }
        }
        throw new TypeError("Count must be a BigInt.");
    }

    public partitionBy(classifier: Functional<E, bigint>): Array<Array<E>>;
    public partitionBy(classifier: BiFunctional<E, bigint, bigint>): Array<Array<E>>;
    public partitionBy(classifier: Functional<E, bigint> | BiFunctional<E, bigint, bigint>): Array<Array<E>> {
        if (isFunction(classifier)) {
            try {
                let collector: SynchronousCollector<E, Array<E[]>, Array<E[]>> = useSynchronousPartitionBy(classifier);
                return collector.collect(this.source());
            } catch (error) {
                throw error;
            }
        }
        throw new TypeError("Classifier must be a function.");
    }

    public pipe(conversion: Functional<SynchronousGenerator<E>, SynchronousSemantic<E>>): SynchronousSemantic<E>;
    public pipe<R>(conversion: Functional<SynchronousGenerator<E>, SynchronousSemantic<R>>): SynchronousSemantic<R>;
    public pipe<R = E>(conversion: Functional<SynchronousGenerator<E>, SynchronousSemantic<R>>): SynchronousSemantic<R> {
        return conversion(this.source());
    }

    public reduce(accumulator: BiFunctional<E, E, E>): E;
    public reduce(accumulator: TriFunctional<E, E, bigint, E>): E;
    public reduce(identity: E, accumulator: BiFunctional<E, E, E>): E;
    public reduce(identity: E, accumulator: TriFunctional<E, E, bigint, E>): E;
    public reduce<R>(identity: R, accumulator: BiFunctional<R, E, R>, finisher: Functional<R, R>): R;
    public reduce<R>(identity: R, accumulator: TriFunctional<R, E, bigint, R>, finisher: Functional<R, R>): R;
    public reduce<R = E>(argument1?: R | E | BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E>, argument2?: BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E> | BiFunctional<R, E, R> | TriFunctional<R, E, bigint, R>, argument3?: Functional<R, R>): R {
        if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let accumulator = argument1 as BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E>;
                return useSynchronousReduce(accumulator).collect(this.source()) as R;
            } catch (error) {
                throw error;
            }
        } else if (validate(argument1) && isFunction(argument2) && invalidate(argument3)) {
            try {
                let identity = argument1 as E;
                let accumulator = argument2 as BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E>;
                return useSynchronousReduce(identity, accumulator).collect(this.source()) as unknown as R;
            } catch (error) {
                throw error;
            }
        } else if (validate(argument1) && isFunction(argument2) && isFunction(argument3)) {
            try {
                let identity = argument1 as R;
                let accumulator = argument2 as BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R>;
                let finisher = argument3 as Functional<R, R>;
                return useSynchronousReduce(identity, accumulator, finisher).collect(this.source());
            } catch (error) {
                throw error;
            }
        } else {
            throw new TypeError("Invalid arguments.");
        }
    }

    public semantic(): SynchronousSemantic<E> {
        let source: SynchronousGenerator<E> = this.source();
        if (isFunction(source)) {
            try {
                return new SynchronousSemantic(source);
            } catch (error) {
                throw error;
            }
        } else {
            throw new TypeError("Invalid source.");
        }
    }

    public abstract source(): SynchronousGenerator<E>;

    public toArray(): Array<E> {
        try {
            return useSynchronousToArray<E>().collect(this.source());
        } catch (error) {
            throw error;
        }
    }

    public toMap<K, E>(keyExtractor: Functional<E, K>): Map<K, E>;
    public toMap<K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): Map<K, V>;
    public toMap<K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): Map<K, V>;
    public toMap<K, V = E>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): Map<K, V> {
        try {
            return useSynchronousToMap<E, K, V>(keyExtractor, valueExtractor).collect(this.source());
        } catch (error) {
            throw error;
        }
    }

    public toSet(): Set<E> {
        try {
            return useSynchronousToSet<E>().collect(this.source());
        } catch (error) {
            throw error;
        }
    }

    public write<S = string>(stream: WritableStream<S>): Promise<WritableStream<S>>;
    public write<S = string>(stream: WritableStream<S>, accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>>): Promise<WritableStream<S>>;
    public write<S = string>(stream: WritableStream<S>, accumulator: TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): Promise<WritableStream<S>>;
    public write<S = string>(argument1: WritableStream<S>, argument2?: BiFunctional<WritableStream<S>, E, WritableStream<S>> | TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): Promise<WritableStream<S>> {
        if (isObject(argument1)) {
            try {
                let stream: WritableStream<S> = argument1 as WritableStream<S>;
                if (isFunction(argument2)) {
                    let accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>> = argument2 as BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>;
                    return useSynchronousWrite(stream, accumulator).collect(this.source());
                } else {
                    return useSynchronousWrite(stream).collect(this.source());
                }
            } catch (error) {
                throw error;
            }
        }
        throw new TypeError("Invalid arguments.");
    }
};

export class SynchronousOrderedCollectable<E> extends SynchronousCollectable<E> {

    protected readonly OrderedCollectable: symbol = SynchronousOrderedCollectableSymbol;

    protected buffer: Array<Indexed<E>> = [];

    [Symbol.toStringTag]: string = "SynchronousOrderedCollectable";

    public constructor(generator: SynchronousGenerator<E>);
    public constructor(generator: SynchronousGenerator<E>, comparator: Comparator<E>);
    public constructor(argument1: SynchronousGenerator<E>, argument2?: Comparator<E>) {
        super();
        if (isFunction(argument1)) {
            try {
                if (isFunction(argument2)) {
                    let collector: SynchronousCollector<E, Array<E>, Array<E>> = useSynchronousToArray();
                    let generator: SynchronousGenerator<E> = argument1;
                    let comparator: Comparator<E> = argument2;
                    this.buffer = collector.collect(generator).sort(comparator).map((element: E, index: number): Indexed<E> => {
                        return {
                            element: element,
                            index: BigInt(index)
                        };
                    });
                    Object.freeze(this.buffer);
                } else {
                    let collector: SynchronousCollector<E, Array<E>, Array<E>> = useSynchronousToArray();
                    let generator: SynchronousGenerator<E> = argument1;
                    this.buffer = collector.collect(generator).map((element: E, index: number, array: Array<E>): Indexed<E> => {
                        return {
                            element: element,
                            index: BigInt(((index % array.length) + array.length) % array.length)
                        };
                    }).sort((a: Indexed<E>, b: Indexed<E>): number => {
                        return Number(a.index - b.index);
                    });
                    Object.freeze(this.buffer);
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
            } catch (error) {
                throw new Error("Uncaught error on creating buffer.");
            }
        } else {
            throw new TypeError("Source must be an iterable or a generator function.");
        }
    }

    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let { element } of this.buffer) {
            yield element;
        }
    }

    public override allMatch(predicate: Predicate<E>): boolean;
    public override allMatch(predicate: BiPredicate<E, bigint>): boolean;
    public override allMatch(predicate: Predicate<E> | BiPredicate<E, bigint>): boolean {
        let collector: SynchronousCollector<Indexed<E>, boolean, boolean> = SynchronousCollector.shortable(
            (): boolean => false,
            (element: Indexed<E>, index: bigint, accumulator: boolean): boolean => predicate(element.element, index) && accumulator,
            (accumulator: boolean, element: Indexed<E>, index: bigint): boolean => predicate(element.element, index) && accumulator,
            (result: boolean): boolean => result
        );
        return collector.collect(this.buffer);
    }

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

    public override isEmpty(): boolean {
        return this.buffer.length === 0;
    }

    public override count(): bigint {
        return BigInt(this.buffer.length);
    }
};

export class SynchronousUnorderedCollectable<E> extends SynchronousCollectable<E> {

    protected readonly SynchronousUnorderedCollectable: symbol = SynchronousUnorderedCollectableSymbol;

    [Symbol.toStringTag]: string = "SynchronousUnorderedCollectable";

    protected buffer: Map<bigint, E> = new Map<bigint, E>();

    public constructor(generator: SynchronousGenerator<E>);
    public constructor(argument1: SynchronousGenerator<E>) {
        super();
        if (isFunction(argument1)) {
            let generator: SynchronousGenerator<E> = argument1;
            generator((element: E, index: bigint): void => {
                this.buffer.set(index, element);
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
        } else {
            throw new TypeError("Source must be an iterable or a generator function.");
        }
    }

    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let [_index, element] of this.buffer) {
            yield element;
        }
    }

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

export abstract class SynchronousStatistics<E, D extends number | bigint> extends SynchronousOrderedCollectable<E> {

    protected readonly SynchronousStatistics: symbol = SynchronousStatisticsSymbol;

    [Symbol.toStringTag]: string = "SynchronousStatistics";

    public constructor(generator: SynchronousGenerator<E>);
    public constructor(generator: SynchronousGenerator<E>, comparator: Comparator<E>);
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

    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let { element } of this.buffer) {
            yield element;
        }
    }

    public abstract average(): D;
    public abstract average(mapper: Functional<E, D>): D;

    public abstract range(): D;
    public abstract range(mapper: Functional<E, D>): D;

    public abstract variance(): D;
    public abstract variance(mapper: Functional<E, D>): D;

    public abstract standardDeviation(): D;
    public abstract standardDeviation(mapper: Functional<E, D>): D;

    public abstract mean(): D;
    public abstract mean(mapper: Functional<E, D>): D;

    public abstract median(): D;
    public abstract median(mapper: Functional<E, D>): D;

    public abstract mode(): D;
    public abstract mode(mapper: Functional<E, D>): D;

    public frequency(): Map<E, bigint> {
        return useSynchronousFrequency<E>().collect(this.source());
    }

    public abstract summate(): D;
    public abstract summate(mapper: Functional<E, D>): D;

    public abstract quantile(quantile: number): D;
    public abstract quantile(quantile: number, mapper: Functional<E, D>): D;

    public abstract interquartileRange(): D;
    public abstract interquartileRange(mapper: Functional<E, D>): D;

    public abstract skewness(): D;
    public abstract skewness(mapper: Functional<E, D>): D;

    public abstract kurtosis(): D;
    public abstract kurtosis(mapper: Functional<E, D>): D;
};

export class SynchronousBigIntStatistics<E> extends SynchronousStatistics<E, bigint> {

    protected readonly BigIntStatistics: symbol = SynchronousBigIntStatisticsSymbol;

    [Symbol.toStringTag]: string = "SynchronousBigIntStatistics";

    public constructor(generator: SynchronousGenerator<E>);
    public constructor(generator: SynchronousGenerator<E>, comparator: Comparator<E>);
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

    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let { element } of this.buffer) {
            yield element;
        }
    }

    public average(): bigint;
    public average(mapper: Functional<E, bigint>): bigint;
    public average(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntAverage(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on average.");
        }
    }

    public range(): bigint;
    public range(mapper: Functional<E, bigint>): bigint;
    public range(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let minimum: Optional<E> = this.findFirst();
            let maximum: Optional<E> = this.findLast();
            return minimum.flatMap((minimum: E): Optional<bigint> => {
                return maximum.map((maximum: E): bigint => {
                    let difference: bigint = mapper(maximum) - mapper(minimum);
                    return difference < 0n ? -difference : difference;
                });
            }).get(0n);
        } catch (error) {
            throw new Error("Uncaught error on range.");
        }
    }

    public variance(): bigint;
    public variance(mapper: Functional<E, bigint>): bigint;
    public variance(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty() || this.count() === 1n) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntVariance(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on variance.");
        }
    }

    public standardDeviation(): bigint;
    public standardDeviation(mapper: Functional<E, bigint>): bigint;
    public standardDeviation(argument1?: Functional<E, bigint>): bigint {
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let variance: bigint = this.variance(mapper);
            return BigInt(Math.sqrt(Number(variance)));
        } catch (error) {
            throw new Error("Uncaught error on standardDeviation.");
        }
    }

    public mean(): bigint;
    public mean(mapper: Functional<E, bigint>): bigint;
    public mean(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntAverage(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on mean.");
        }
    }

    public median(): bigint;
    public median(mapper: Functional<E, bigint>): bigint;
    public median(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntMedian(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on median.");
        }
    }

    public mode(): bigint;
    public mode(mapper: Functional<E, bigint>): bigint;
    public mode(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntMode(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on mode.");
        }
    }

    public summate(): bigint;
    public summate(mapper: Functional<E, bigint>): bigint;
    public summate(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntSummate(mapper).collect(this.source() as SynchronousGenerator<bigint>);
        } catch (error) {
            throw new Error("Uncaught error on summate.");
        }
    }

    public quantile(quantile: number): bigint;
    public quantile(quantile: number, mapper: Functional<E, bigint>): bigint;
    public quantile(quantile: number, argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        if (!isNumber(quantile) || quantile < 0 || quantile > 1) {
            throw new RangeError("Invalid quantile.");
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let count: number = Number(this.count());
            let index: number = Math.floor(quantile * count);
            if (index === count) {
                index--;
            }
            return this.findAt(index).map(mapper).get(0n);
        } catch (error) {
            throw new Error("Uncaught error on quantile.");
        }
    }

    public interquartileRange(): bigint;
    public interquartileRange(mapper: Functional<E, bigint>): bigint;
    public interquartileRange(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let lower: bigint = this.quantile(0.25, mapper);
            let upper: bigint = this.quantile(0.75, mapper);
            return upper - lower;
        } catch (error) {
            throw new Error("Uncaught error on interquartileRange.");
        }
    }

    public skewness(): bigint;
    public skewness(mapper: Functional<E, bigint>): bigint;
    public skewness(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let mean: bigint = this.mean(mapper);
            let standardDeviation: bigint = this.standardDeviation(mapper);
            if (standardDeviation === 0n) {
                return 0n;
            }
            let data: Array<bigint> = (this.toArray()).map((element: E): bigint => mapper(element));
            let summate: bigint = 0n;
            for (let value of data) {
                let z: bigint = value - mean;
                summate += z * z * z;
            }
            return summate / BigInt(data.length);
        } catch (error) {
            throw new Error("Uncaught error on skewness.");
        }
    }

    public kurtosis(): bigint;
    public kurtosis(mapper: Functional<E, bigint>): bigint;
    public kurtosis(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let mean: bigint = this.mean(mapper);
            let standardDeviation: bigint = this.standardDeviation(mapper);
            if (standardDeviation === 0n) {
                return 0n;
            }
            let data: Array<bigint> = (this.toArray()).map((element: E): bigint => mapper(element));
            let summate: bigint = 0n;
            let count: number = data.length;
            for (let value of data) {
                let z: bigint = value - mean;
                summate += z * z * z * z;
            }
            return summate / BigInt(count * count) - 3n;
        } catch (error) {
            throw new Error("Uncaught error on kurtosis.");
        }
    }
};

export class SynchronousNumericStatistics<E> extends SynchronousStatistics<E, number> {

    protected readonly SynchronousNumericStatistics: symbol = SynchronousNumericStatisticsSymbol;

    [Symbol.toStringTag]: string = "SynchronousNumericStatistics";

    public constructor(generator: SynchronousGenerator<E>);
    public constructor(generator: SynchronousGenerator<E>, comparator: Comparator<E>);
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

    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let { element } of this.buffer) {
            yield element;
        }
    }

    public average(): number;
    public average(mapper: Functional<E, number>): number;
    public average(mapper?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            if (isFunction(mapper)) {
                return useSynchronousNumericAverage(mapper).collect(this.source() as SynchronousGenerator<number>);
            }
            return useSynchronousNumericAverage().collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on average.");
        }
    }

    public range(): number;
    public range(mapper: Functional<E, number>): number;
    public range(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            if (this.count() === 1n) {
                return 0;
            }
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let minimum: Optional<E> = this.findFirst();
            let maximum: Optional<E> = this.findLast();
            return minimum.flatMap((minimum: E): Optional<number> => {
                return maximum.map((maximum: E): number => {
                    let difference: number = mapper(maximum) - mapper(minimum);
                    return difference < 0 ? -difference : difference;
                });
            }).get(0);
        } catch (error) {
            throw new Error("Uncaught error on range.");
        }
    }

    public variance(): number;
    public variance(mapper: Functional<E, number>): number;
    public variance(argument1?: Functional<E, number>): number {
        if (this.isEmpty() || this.count() === 1n) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericVariance(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on variance.");
        }
    }

    public standardDeviation(): number;
    public standardDeviation(mapper: Functional<E, number>): number;
    public standardDeviation(argument1?: Functional<E, number>): number {
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericStandardDeviation(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on standardDeviation.");
        }
    }

    public mean(): number;
    public mean(mapper: Functional<E, number>): number;
    public mean(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericAverage(mapper).collect(this.source() as SynchronousGenerator<number>);
        } catch (error) {
            throw new Error("Uncaught error on mean.");
        }
    }

    public median(): number;
    public median(mapper: Functional<E, number>): number;
    public median(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericMedian(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on median.");
        }
    }

    public mode(): number;
    public mode(mapper: Functional<E, number>): number;
    public mode(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericMode(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on mode.");
        }
    }

    public summate(): number;
    public summate(mapper: Functional<E, number>): number;
    public summate(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericSummate(mapper).collect(this.source() as SynchronousGenerator<number>);
        } catch (error) {
            throw new Error("Uncaught error on summate.");
        }
    }

    public quantile(quantile: number): number;
    public quantile(quantile: number, mapper: Functional<E, number>): number;
    public quantile(quantile: number, argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        if (quantile < 0 || quantile > 1) {
            throw new RangeError("Invalid quantile.");
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let count: number = Number(this.count());
            let index: number = Math.floor(quantile * count);
            if (index === count) {
                index--;
            }
            return this.findAt(index).map(mapper).get(0);
        } catch (error) {
            throw new Error("Uncaught error on quantile.");
        }
    }

    public interquartileRange(): number;
    public interquartileRange(mapper: Functional<E, number>): number;
    public interquartileRange(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let lower: number = this.quantile(0.25, mapper);
            let upper: number = this.quantile(0.75, mapper);
            return upper - lower;
        } catch (error) {
            throw new Error("Uncaught error on interquartileRange.");
        }
    }

    public skewness(): number;
    public skewness(mapper: Functional<E, number>): number;
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
        } catch (error) {
            throw new Error("Uncaught error on skewness.");
        }
    }

    public kurtosis(): number;
    public kurtosis(mapper: Functional<E, number>): number;
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
            return summate / (data.length * data.length) - 3;
        } catch (error) {
            throw new Error("Uncaught error on kurtosis.");
        }
    }
};

export class SynchronousWindowCollectable<E> extends SynchronousOrderedCollectable<E> {

    protected readonly WindowCollectable: symbol = SynchronousWindowCollectableSymbol;

    [Symbol.toStringTag]: string = "SynchronousWindowCollectable";

    public constructor(generator: SynchronousGenerator<E>);
    public constructor(generator: SynchronousGenerator<E>, comparator: Comparator<E>);
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

    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let { element } of this.buffer) {
            yield element;
        }
    }

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
                } catch (error) {
                    throw new Error("Uncaught error on slide.");
                }
            });
        }
        throw new RangeError("Invalid arguments.");
    }

    public tumble(size: bigint): SynchronousSemantic<SynchronousSemantic<E>> {
        if (isBigInt(size) && size > 0n) {
            try {
                return this.slide(size, size);
            } catch (error) {
                throw new Error("Uncaught error on tumble.");
            }
        }
        throw new RangeError("Invalid arguments.");
    }
};
