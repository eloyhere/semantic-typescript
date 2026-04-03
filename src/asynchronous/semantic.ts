import {
    useAsynchronousAnyMatch, useAsynchronousAllMatch, useAsynchronousCollect, useAsynchronousCount, useAsynchronousError, useAsynchronousFindAny, useAsynchronousFindAt,
    useAsynchronousFindFirst, useAsynchronousFindLast, useAsynchronousFindMaximum, useAsynchronousFindMinimum, useAsynchronousForEach, useAsynchronousGroup,
    useAsynchronousGroupBy, useAsynchronousJoin, useAsynchronousLog, useAsynchronousNoneMatch, useAsynchronousPartition, useAsynchronousPartitionBy, useAsynchronousReduce,
    useAsynchronousToArray, useAsynchronousToMap, useAsynchronousToSet, useAsynchronousWrite, useAsynchronousFrequency, useAsynchronousBigIntAverage,
    useAsynchronousBigIntMedian, useAsynchronousBigIntMode, useAsynchronousBigIntSummate, useAsynchronousBigIntVariance, useAsynchronousNumericAverage,
    useAsynchronousNumericMedian, useAsynchronousNumericMode, useAsynchronousNumericStandardDeviation, useAsynchronousNumericSummate, useAsynchronousNumericVariance
} from "./collector";
import { isFunction, isAsynchronousSemantic, isIterable, isNumber, isBigInt, isObject, isString, isAsynchronousCollectable, isAsyncIterable, isAsynchronousCollector } from "../guard";
import { useHash } from "../hash";
import { useCompare, useToBigInt, useToNumber } from "../hook";
import {
    AsynchronousOrderedCollectableSymbol, AsynchronousBigIntStatisticsSymbol, AsynchronousCollectableSymbol, AsynchronousNumericStatisticsSymbol, AsynchronousSemanticSymbol, AsynchronousWindowCollectableSymbol,
    AsynchronousUnorderedCollectableSymbol, AsynchronousStatisticsSymbol
} from "../symbol";
import { invalidate, validate, type BiConsumer, type BiFunctional, type BiPredicate, type Comparator, type Consumer, type Functional, type Indexed, type Predicate, type Supplier, type AsynchronousGenerator, type TriFunctional, type TriPredicate, type Runnable } from "../utility";
import type { AsynchronousCollector } from "./collector";

export class AsynchronousSemantic<E> {

    protected generator: AsynchronousGenerator<E>;

    protected readonly AsynchronousSemantic: Symbol = AsynchronousSemanticSymbol;

    [Symbol.toStringTag]: string = "AsynchronousSemantic";

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
        } else {
            throw new TypeError("Invalid arguments.");
        }
    }

    public concat(other: AsynchronousSemantic<E>): AsynchronousSemantic<E>;
    public concat(other: AsyncIterable<E>): AsynchronousSemantic<E>;
    public concat(argument: AsynchronousSemantic<E> | AsyncIterable<E>): AsynchronousSemantic<E> {
        if (isAsynchronousSemantic(argument)) {
            let other: AsynchronousSemantic<E> = argument as unknown as AsynchronousSemantic<E>;
            let generator: AsynchronousGenerator<E> = Reflect.get(other, "generator") as AsynchronousGenerator<E>;
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                let count: bigint = 0n;
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>) => {
                    this.generator((element: E) => {
                        accept(element, count);
                        count++;
                    }, interrupt).then((): void => {
                        generator((element: E) => {
                            accept(element, count);
                            count++;
                        }, interrupt);
                    }).then(resolve, reject);
                });
            });
        }
        if (isAsyncIterable(argument)) {
            let other: AsyncIterable<E> = argument as unknown as AsyncIterable<E>;
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        let count: bigint = 0n;
                        this.generator((element: E, index: bigint) => {
                            accept(element, index);
                            count++;
                        }, interrupt).then(async (): Promise<void> => {
                            for await (let element of other) {
                                accept(element, count);
                                count++;
                            }
                            resolve();
                        }).catch(reject);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public distinct(): AsynchronousSemantic<E>;
    public distinct<K>(keyExtractor: Functional<E, K>): AsynchronousSemantic<E>;
    public distinct<K>(keyExtractor: BiFunctional<E, bigint, K>): AsynchronousSemantic<E>;
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
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    public dropWhile(predicate: Predicate<E>): AsynchronousSemantic<E>;
    public dropWhile(predicate: BiPredicate<E, bigint>): AsynchronousSemantic<E>;
    public dropWhile(predicate: Predicate<E> | BiPredicate<E, bigint>): AsynchronousSemantic<E> {
        if (isFunction(predicate)) {
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
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
                        }, interrupt).then(resolve).catch(reject);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public filter(predicate: Predicate<E>): AsynchronousSemantic<E>;
    public filter(predicate: BiPredicate<E, bigint>): AsynchronousSemantic<E>;
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
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public flat(mapper: Functional<E, Iterable<E>>): AsynchronousSemantic<E>;
    public flat(mapper: BiFunctional<E, bigint, Iterable<E>>): AsynchronousSemantic<E>;
    public flat(mapper: Functional<E, AsynchronousSemantic<E>>): AsynchronousSemantic<E>;
    public flat(mapper: BiFunctional<E, bigint, AsynchronousSemantic<E>>): AsynchronousSemantic<E>;
    public flat(mapper: Functional<E, Iterable<E>> | BiFunctional<E, bigint, Iterable<E>> | Functional<E, AsynchronousSemantic<E>> | BiFunctional<E, bigint, AsynchronousSemantic<E>>): AsynchronousSemantic<E> {
        if (isFunction(mapper)) {
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        let count: bigint = 0n;
                        let stop: boolean = false;
                        this.generator((element: E, index: bigint): void => {
                            let result: AsynchronousSemantic<E> | Iterable<E> = mapper(element, index);
                            if (isIterable(result)) {
                                for (let subElement of result) {
                                    accept(subElement, count);
                                    stop = stop || interrupt(subElement, count);
                                    count++;
                                }
                            } else if (isAsynchronousSemantic(result)) {
                                result.generator((subElement: E): void => {
                                    accept(subElement, count);
                                    stop = stop || interrupt(subElement, count);
                                    count++;
                                }, (element: E): boolean => interrupt(element, count) || stop);
                            }
                        }, (element: E): boolean => interrupt(element, count) || stop).then(resolve, reject);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public flatMap<R>(mapper: Functional<E, Iterable<R>>): AsynchronousSemantic<R>;
    public flatMap<R>(mapper: BiFunctional<E, bigint, Iterable<R>>): AsynchronousSemantic<R>;
    public flatMap<R>(mapper: Functional<E, AsynchronousSemantic<R>>): AsynchronousSemantic<R>;
    public flatMap<R>(mapper: BiFunctional<E, bigint, AsynchronousSemantic<R>>): AsynchronousSemantic<R>;
    public flatMap<R>(mapper: Functional<E, Iterable<R> | AsynchronousSemantic<R>> | BiFunctional<E, bigint, Iterable<R> | AsynchronousSemantic<R>>): AsynchronousSemantic<R> {
        if (isFunction(mapper)) {
            return new AsynchronousSemantic<R>(async (accept: Consumer<R> | BiConsumer<R, bigint>, interrupt: Predicate<R> | BiPredicate<R, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        let count: bigint = 0n;
                        let stop: boolean = false;
                        this.generator((element: E, index: bigint): void => {
                            let result: AsynchronousSemantic<R> | Iterable<R> = mapper(element, index);
                            if (isIterable(result)) {
                                for (let subElement of result) {
                                    accept(subElement, count);
                                    stop = stop || interrupt(subElement, count);
                                    count++;
                                }
                                resolve();
                            } else if (isAsynchronousSemantic(result)) {
                                result.generator((subElement: R): void => {
                                    accept(subElement, count);
                                    stop = stop || interrupt(subElement, count);
                                    count++;
                                }, (element: R): boolean => interrupt(element, count) || stop).then(resolve, reject);
                            }
                        }, (): boolean => stop);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public limit(count: number): AsynchronousSemantic<E>;
    public limit(count: bigint): AsynchronousSemantic<E>;
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
                    } catch (error) {
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
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public map(mapper: Functional<E, E>): AsynchronousSemantic<E>;
    public map(mapper: BiFunctional<E, bigint, E>): AsynchronousSemantic<E>;
    public map<R>(mapper: Functional<E, R>): AsynchronousSemantic<R>;
    public map<R>(mapper: BiFunctional<E, bigint, R>): AsynchronousSemantic<R>;
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
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public peek(consumer: Consumer<E>): AsynchronousSemantic<E>;
    public peek(consumer: BiConsumer<E, bigint>): AsynchronousSemantic<E>;
    public peek(consumer: Consumer<E> | BiConsumer<E, bigint>): AsynchronousSemantic<E> {
        if (isFunction(consumer)) {
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        this.generator((element: E, index: bigint): void => {
                            accept(element, index);
                            consumer(element, index);
                        }, interrupt).then(resolve, reject);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public pipe(conversion: Functional<AsynchronousGenerator<E>, AsynchronousSemantic<E>>): AsynchronousSemantic<E>;
    public pipe<R>(conversion: Functional<AsynchronousGenerator<E>, AsynchronousSemantic<R>>): AsynchronousSemantic<R>;
    public pipe<R = E>(conversion: Functional<AsynchronousGenerator<E>, AsynchronousSemantic<R>>): AsynchronousSemantic<R> {
        return conversion(this.source());
    }

    public redirect(redirector: BiFunctional<E, bigint, bigint>): AsynchronousSemantic<E> {
        if (isFunction(redirector)) {
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        this.generator((element: E, index: bigint): void => {
                            accept(element, redirector(element, index));
                        }, interrupt).then(resolve, reject);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public reverse(): AsynchronousSemantic<E> {
        return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, -index);
                    }, interrupt).then(resolve, reject);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    public shuffle(): AsynchronousSemantic<E>;
    public shuffle(mapper: BiFunctional<E, bigint, bigint>): AsynchronousSemantic<E>;
    public shuffle(mapper?: BiFunctional<E, bigint, bigint>): AsynchronousSemantic<E> {
        if (isFunction(mapper)) {
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                    try {
                        this.generator((element: E, index: bigint): void => {
                            accept(element, mapper(element, index));
                        }, interrupt).then(resolve, reject);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }
        return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, useHash(element, index));
                    }, interrupt).then(resolve, reject);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    public skip(count: number): AsynchronousSemantic<E>;
    public skip(count: bigint): AsynchronousSemantic<E>;
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
                            } else {
                                accept(element, index);
                            }
                        }, interrupt).then(resolve, reject);
                    } catch (error) {
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
                            } else {
                                accept(element, index);
                            }
                        }, interrupt).then(resolve, reject);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public source(): AsynchronousGenerator<E> {
        return this.generator;
    }

    public sub(start: number, end: number): AsynchronousSemantic<E>;
    public sub(start: bigint, end: bigint): AsynchronousSemantic<E>;
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
                                count++;
                            }
                        }, (element: E, index: bigint): boolean => count >= maximum || interrupt(element, index)).then(resolve, reject);
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public takeWhile(predicate: Predicate<E>): AsynchronousSemantic<E>;
    public takeWhile(predicate: BiPredicate<E, bigint>): AsynchronousSemantic<E>;
    public takeWhile(predicate: Predicate<E> | BiPredicate<E, bigint>): AsynchronousSemantic<E> {
        return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            return new Promise<void>((resolve: Consumer<void>, reject: Consumer<any>): void => {
                try {
                    let stop: boolean = false;
                    this.generator((element: E, index: bigint) => {
                        if (predicate(element, index) && stop === false) {
                            accept(element, index);
                        } else {
                            stop = true;
                        }
                    }, (element: E, index: bigint): boolean => stop || interrupt(element, index)).then(resolve, reject);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    public toCollectable(): AsynchronousCollectable<E>;
    public toCollectable<C extends AsynchronousCollectable<E>>(mapper: Functional<AsynchronousGenerator<E>, C>): C;
    public toCollectable<C extends AsynchronousCollectable<E>>(mapper?: Functional<AsynchronousGenerator<E>, C>): AsynchronousCollectable<E> | C {
        if (isFunction(mapper)) {
            try {
                let AsynchronousCollectable: C = mapper(this.generator);
                if (isAsynchronousCollectable(AsynchronousCollectable)) {
                    return AsynchronousCollectable;
                }
            } catch (error) {
                throw new Error("Uncaught error on toAsynchronousCollectable.");
            }
        }
        try {
            return new AsynchronousUnorderedCollectable(this.generator);
        } catch (error) {
            throw new Error("Uncaught error on toAsynchronousCollectable.");
        }
    }

    public toBigintStatistics(): AsynchronousBigIntStatistics<E> {
        try {
            return new AsynchronousBigIntStatistics<E>(this.generator);
        } catch (error) {
            throw new Error("Uncaught error on toBigintStatistics.");
        }
    }

    public toNumericStatistics(): AsynchronousNumericStatistics<E> {
        try {
            return new AsynchronousNumericStatistics<E>(this.generator);
        } catch (error) {
            throw new Error("Uncaught error on toNumericStatistics.");
        }
    }

    public toOrdered(): AsynchronousOrderedCollectable<E> {
        try {
            return new AsynchronousOrderedCollectable(this.generator);
        } catch (error) {
            throw new Error("Uncaught error on toOrdered.");
        }
    }

    public toUnordered(): AsynchronousUnorderedCollectable<E> {
        try {
            return new AsynchronousUnorderedCollectable(this.source());
        } catch (error) {
            throw new Error(String(error));
        }
    }

    public toWindow(): AsynchronousWindowCollectable<E> {
        try {
            return new AsynchronousWindowCollectable<E>(this.generator);
        } catch (error) {
            throw new Error("Uncaught error on toWindow.");
        }
    }

    public translate(offset: number): AsynchronousSemantic<E>;
    public translate(offset: bigint): AsynchronousSemantic<E>;
    public translate(translator: BiFunctional<E, bigint, bigint>): AsynchronousSemantic<E>;
    public translate(argument1: number | bigint | BiFunctional<E, bigint, bigint>): AsynchronousSemantic<E> {
        if (isNumber(argument1)) {
            let offset: number = argument1;
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, index + BigInt(offset));
                    }, interrupt);
                } catch (error) {
                    throw new Error("Uncaught error on translate.");
                }
            });
        } else if (isBigInt(argument1)) {
            let offset: bigint = argument1;
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, index + offset);
                    }, interrupt);
                } catch (error) {
                    throw new Error("Uncaught error on translate.");
                }
            });
        } else if (isFunction(argument1)) {
            let translator: BiFunctional<E, bigint, bigint> = argument1;
            return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                try {
                    this.generator((element: E, index: bigint): void => {
                        accept(element, index + translator(element, index));
                    }, interrupt);
                } catch (error) {
                    throw new Error("Uncaught error on translate.");
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }
};

export abstract class AsynchronousCollectable<E> implements AsyncIterable<E> {

    protected readonly AsynchronousCollectable: symbol = AsynchronousCollectableSymbol;

    [Symbol.toStringTag]: string = "AsynchronousCollectable";

    public constructor() {
        Object.defineProperty(this, "AsynchronousCollectable", {
            value: AsynchronousCollectableSymbol,
            enumerable: false,
            writable: false,
            configurable: false
        });
    }

    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
            yield element;
        }
    }

    public async anyMatch(predicate: Predicate<E>): Promise<boolean> {
        if (isFunction(predicate)) {
            try {
                return await useAsynchronousAnyMatch(predicate).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on anyMatch.");
            }
        }
        throw new TypeError("Predicate must be a function.");
    }

    public async allMatch(predicate: Predicate<E>): Promise<boolean> {
        return useAsynchronousAllMatch(predicate).collect(this.source());
    }

    public async collect<A, R>(collector: AsynchronousCollector<E, A, R>): Promise<R>;
    public async collect<A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): Promise<R>;
    public async collect<A, R>(identity: Supplier<A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): Promise<R>;
    public async collect<A, R>(identity: Supplier<A>, interruptor: Predicate<E>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): Promise<R>;
    public async collect<A, R>(identity: Supplier<A>, interruptor: BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): Promise<R>;
    public async collect<A, R>(identity: Supplier<A>, interruptor: TriPredicate<E, bigint, A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): Promise<R>;
    public async collect<A, R>(identity: Supplier<A>, interruptor: Predicate<E>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): Promise<R>;
    public async collect<A, R>(identity: Supplier<A>, interruptor: BiPredicate<E, bigint>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): Promise<R>;
    public async collect<A, R>(identity: Supplier<A>, interruptor: TriPredicate<E, bigint, A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): Promise<R>;
    public async collect<A, R>(argument1: Supplier<A> | AsynchronousCollector<E, A, R>, argument2?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Predicate<E> | BiPredicate<E, bigint> | TriPredicate<E, bigint, A>, argument3?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Functional<A, R>, argument4?: Functional<A, R>): Promise<R> {
        try {
            if (isAsynchronousCollector(argument1)) {
                let collector: AsynchronousCollector<E, A, R> = argument1 as AsynchronousCollector<E, A, R>;
                return await collector.collect(this.source());
            }
            if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3)) {
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
        } catch (error) {
            throw new Error("Uncaught error on collect.");
        }
        throw new TypeError("Invalid arguments.");
    }

    public async count(): Promise<bigint> {
        return await useAsynchronousCount<E>().collect(this.source());
    }

    public async error(): Promise<void>;
    public async error(accumulator: BiFunctional<string, E, string>): Promise<void>;
    public async error(accumulator: TriFunctional<string, E, bigint, string>): Promise<void>;
    public async error(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): Promise<void>;
    public async error(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): Promise<void>;
    public async error(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): Promise<void> {
        if (invalidate(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                await useAsynchronousError<E>().collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on error.");
            }
        } else if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                await useAsynchronousError<E>(accumulator).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on error.");
            }
        } else if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
            try {
                let prefix: string = argument1;
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                let suffix: string = argument3;
                await useAsynchronousError<E>(prefix, accumulator, suffix).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on error.");
            }
        } else {
            throw new TypeError("Invalid arguments.");
        }
    }

    public async isEmpty(): Promise<boolean> {
        return await this.count() === 0n;
    }

    public async findAny(): Promise<E> {
        try {
            return await useAsynchronousFindAny<E>().collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on findAny.");
        }
    }

    public async findAt(index: number): Promise<E>;
    public async findAt(index: bigint): Promise<E>;
    public async findAt(index: number | bigint): Promise<E> {
        if (isBigInt(index)) {
            try {
                return await useAsynchronousFindAt<E>(index).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on findAt.");
            }
        } else if (isNumber(index)) {
            try {
                return await useAsynchronousFindAt<E>(index).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on findAt.");
            }
        }
        throw new TypeError("Index must be a bigint.");
    }

    public async findFirst(): Promise<E> {
        try {
            return await useAsynchronousFindFirst<E>().collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on findFirst.");
        }
    }

    public async findLast(): Promise<E> {
        try {
            return await useAsynchronousFindLast<E>().collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on findLast.");
        }
    }

    public async findMaximum(): Promise<E>;
    public async findMaximum(comparator: Comparator<E>): Promise<E>;
    public async findMaximum(argument1?: Comparator<E>): Promise<E> {
        try {
            let comparator: Comparator<E> = isFunction(argument1) ? argument1 : useCompare;
            return await useAsynchronousFindMaximum(comparator).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on findMaximum.");
        }
    }

    public async findMinimum(): Promise<E>;
    public async findMinimum(comparator: Comparator<E>): Promise<E>;
    public async findMinimum(argument1?: Comparator<E>): Promise<E> {
        try {
            let comparator: Comparator<E> = isFunction(argument1) ? argument1 : useCompare;
            return await useAsynchronousFindMinimum(comparator).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on findMinimum.");
        }
    }

    public async forEach(action: Consumer<E>): Promise<void>;
    public async forEach(action: BiConsumer<E, bigint>): Promise<void>;
    public async forEach(action: Consumer<E> | BiConsumer<E, bigint>): Promise<void> {
        if (isFunction(action)) {
            try {
                await useAsynchronousForEach(action).collect(this);
            } catch (error) {
                throw new Error("Uncaught error on forEach.");
            }
        } else {
            throw new TypeError("Action must be a function.");
        }
    }

    public async group<K>(classifier: Functional<E, K>): Promise<Map<K, Array<E>>>;
    public async group<K>(classifier: BiFunctional<E, bigint, K>): Promise<Map<K, Array<E>>>
    public async group<K>(classifier: Functional<E, K> | BiFunctional<E, bigint, K>): Promise<Map<K, Array<E>>> {
        if (isFunction(classifier)) {
            try {
                return await useAsynchronousGroup(classifier).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on group.");
            }
        }
        throw new TypeError("Classifier must be a function.");
    }

    public async groupBy<K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): Promise<Map<K, Array<V>>>;
    public async groupBy<K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, K>): Promise<Map<K, Array<V>>>
    public async groupBy<K, V>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V>): Promise<Map<K, Array<V>>> {
        if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
            try {
                return await useAsynchronousGroupBy(keyExtractor, valueExtractor).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on groupBy.");
            }
        }
        throw new TypeError("Key and value extractors must be functions.");
    }

    public async join(): Promise<string>;
    public async join(delimiter: string): Promise<string>;
    public async join(prefix: string, delimiter: string, suffix: string): Promise<string>;
    public async join(prefiex: string, accumulator: BiFunctional<string, E, string>, suffix: string): Promise<string>;
    public async join(prefiex: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): Promise<string>;
    public async join(argument1?: string, argument2?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): Promise<string> {
        if (invalidate(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                return await useAsynchronousJoin<E>().collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on join.");
            }
        } else if (isString(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let delimiter: string = argument1;
                return await useAsynchronousJoin<E>(delimiter).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on join.");
            }
        } else if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
            try {
                let prefix: string = argument1;
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                let suffix: string = argument3;
                return await useAsynchronousJoin<E>(prefix, accumulator, suffix).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on join.");
            }
        } else if (isString(argument1) && isString(argument2) && isString(argument3)) {
            try {
                let prefix: string = argument1;
                let delimiter: string = argument2;
                let suffix: string = argument3;
                return await useAsynchronousJoin<E>(prefix, delimiter, suffix).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on join.");
            }
        }
        throw new TypeError("Invalid arguments.");
    }

    public async log(): Promise<void>;
    public async log(accumulator: BiFunctional<string, E, string>): Promise<void>;
    public async log(accumulator: TriFunctional<string, E, bigint, string>): Promise<void>;
    public async log(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): Promise<void>;
    public async log(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): Promise<void>;
    public async log(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): Promise<void> {
        if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                await useAsynchronousLog<E>(accumulator).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on log.");
            }
        } else if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
            try {
                let prefix: string = argument1;
                let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
                let suffix: string = argument3;
                await useAsynchronousLog<E>(prefix, accumulator, suffix).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on log.");
            }
        } else {
            try {
                useAsynchronousLog<E>().collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on log.");
            }
        }
    }

    public async nonMatch(predicate: Predicate<E>): Promise<boolean>;
    public async nonMatch(predicate: BiPredicate<E, bigint>): Promise<boolean>;
    public async nonMatch(predicate: Predicate<E> | BiPredicate<E, bigint>): Promise<boolean> {
        if (isFunction(predicate)) {
            try {
                return await useAsynchronousNoneMatch(predicate).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on nonMatch.");
            }
        }
        throw new TypeError("Predicate must be a function.");
    }

    public async partition(count: bigint): Promise<Array<Array<E>>> {
        if (isBigInt(count)) {
            try {
                return await useAsynchronousPartition<E>(count).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on partition.");
            }
        }
        throw new TypeError("Count must be a BigInt.");
    }

    public async partitionBy(classifier: Functional<E, bigint>): Promise<Array<Array<E>>>;
    public async partitionBy(classifier: BiFunctional<E, bigint, bigint>): Promise<Array<Array<E>>>;
    public async partitionBy(classifier: Functional<E, bigint> | BiFunctional<E, bigint, bigint>): Promise<Array<Array<E>>> {
        if (isFunction(classifier)) {
            try {
                let collector: AsynchronousCollector<E, Array<E[]>, Array<E[]>> = useAsynchronousPartitionBy(classifier);
                return await collector.collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on partitionBy.");
            }
        }
        throw new TypeError("Classifier must be a function.");
    }

    public async reduce(accumulator: BiFunctional<E, E, E>): Promise<E>;
    public async reduce(accumulator: TriFunctional<E, E, bigint, E>): Promise<E>;
    public async reduce(identity: E, accumulator: BiFunctional<E, E, E>): Promise<E>;
    public async reduce(identity: E, accumulator: TriFunctional<E, E, bigint, E>): Promise<E>;
    public async reduce<R>(identity: R, accumulator: BiFunctional<R, E, R>, finisher: Functional<R, R>): Promise<R>;
    public async reduce<R>(identity: R, accumulator: TriFunctional<R, E, bigint, R>, finisher: Functional<R, R>): Promise<R>;
    public async reduce<R>(argument1?: R | E | BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E>, argument2?: BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E> | BiFunctional<R, E, R> | TriFunctional<R, E, bigint, R>, argument3?: Functional<R, R>): Promise<E | R> {
        if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
            try {
                let accumulator = argument1 as BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E>;
                return await useAsynchronousReduce(accumulator).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on reduce.");
            }
        } else if (validate(argument1) && isFunction(argument2) && invalidate(argument3)) {
            try {
                let identity = argument1 as E;
                let accumulator = argument2 as BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E>;
                return await useAsynchronousReduce(identity, accumulator).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on reduce.");
            }
        } else if (validate(argument1) && isFunction(argument2) && isFunction(argument3)) {
            try {
                let identity = argument1 as R;
                let accumulator = argument2 as BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R>;
                let finisher = argument3 as Functional<R, R>;
                return await useAsynchronousReduce(identity, accumulator, finisher).collect(this.source());
            } catch (error) {
                throw new Error("Uncaught error on reduce.");
            }
        } else {
            throw new TypeError("Invalid arguments.");
        }
    }

    public semantic(): AsynchronousSemantic<E> {
        let source: AsynchronousGenerator<E> = this.source();
        if (isFunction(source)) {
            try {
                return new AsynchronousSemantic(source);
            } catch (error) {
                throw new Error("Uncaught error on semantic.");
            }
        } else {
            throw new TypeError("Invalid source.");
        }
    }

    public abstract source(): AsynchronousGenerator<E>;

    public async toArray(): Promise<Array<E>> {
        try {
            return useAsynchronousToArray<E>().collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on toArray.");
        }
    }

    public async toMap<K, E>(keyExtractor: Functional<E, K>): Promise<Map<K, E>>;
    public async toMap<K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): Promise<Map<K, V>>;
    public async toMap<K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): Promise<Map<K, V>>;
    public async toMap<K, V = E>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): Promise<Map<K, V>> {
        try {
            return await useAsynchronousToMap<E, K, V>(keyExtractor, valueExtractor).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on toMap.");
        }
    }

    public async toSet(): Promise<Set<E>> {
        try {
            return await useAsynchronousToSet<E>().collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on toSet.");
        }
    }

    public async write<S = string>(stream: WritableStream<S>): Promise<WritableStream<S>>;
    public async write<S = string>(stream: WritableStream<S>, accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>>): Promise<WritableStream<S>>;
    public async write<S = string>(stream: WritableStream<S>, accumulator: TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): Promise<WritableStream<S>>;
    public async write<S = string>(argument1: WritableStream<S>, argument2?: BiFunctional<WritableStream<S>, E, WritableStream<S>> | TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): Promise<WritableStream<S>> {
        if (isObject(argument1)) {
            try {
                let stream: WritableStream<S> = argument1 as WritableStream<S>;
                if (isFunction(argument2)) {
                    let accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>> = argument2 as BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>;
                    return await useAsynchronousWrite(stream, accumulator).collect(this.source());
                } else {
                    return await useAsynchronousWrite(stream).collect(this.source());
                }
            } catch (error) {
                throw new Error("Uncaught error on write.");
            }
        }
        throw new TypeError("Invalid arguments.");
    }
};

export class AsynchronousOrderedCollectable<E> extends AsynchronousCollectable<E> {

    protected readonly OrderedCollectable: symbol = AsynchronousOrderedCollectableSymbol;

    protected buffer: Array<Indexed<E>> = [];

    protected listeners: Array<Consumer<Array<Indexed<E>>>> = [];

    protected complete: boolean = false;

    [Symbol.toStringTag]: string = "AsynchronousOrderedCollectable";

    public constructor(generator: AsynchronousGenerator<E>);
    public constructor(generator: AsynchronousGenerator<E>, comparator: Comparator<E>);
    public constructor(argument1: AsynchronousGenerator<E>, argument2?: Comparator<E>) {
        super();
        if (isFunction(argument1)) {
            try {
                if (isFunction(argument2)) {
                    let collector: AsynchronousCollector<E, Array<E>, Array<E>> = useAsynchronousToArray();
                    collector.collect(argument1).then((elements: Array<E>) => {
                        this.buffer = elements.sort(argument2).map((element: E, index: number): Indexed<E> => {
                            return {
                                element: element,
                                index: BigInt(index)
                            };
                        });
                        for (let listener of this.listeners) {
                            listener(this.buffer);
                        }
                        this.complete = true;
                        Object.freeze(this.complete);
                        Object.freeze(this.buffer);
                    });
                } else {
                    let collector: AsynchronousCollector<E, Array<E>, Array<E>> = useAsynchronousToArray();
                    collector.collect(argument1).then((elements: Array<E>) => {
                        this.buffer = elements.sort(useCompare).map((element: E, index: number, array: Array<E>): Indexed<E> => {
                            return {
                                element: element,
                                index: BigInt(((index % array.length) + array.length) % array.length)
                            };
                        });
                        for (let listener of this.listeners) {
                            listener(this.buffer);
                        }
                        this.complete = true;
                        Object.freeze(this.complete);
                        Object.freeze(this.buffer);
                    });
                }
                Object.defineProperties(this, {
                    "AsynchronousOrderedCollectable": {
                        value: AsynchronousOrderedCollectableSymbol,
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

    public override async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
            yield element;
        }
    }

    public override async findAny(): Promise<E> {
        if (this.complete === true) {
            return await new Promise<E>((resolve: Consumer<E>, reject: Consumer<any>): void => {
                try {
                    if (this.buffer.length > 0) {
                        for (let { element } of this.buffer) {
                            if (Math.random() < 0.5) {
                                resolve(element);
                            }
                        }
                    }
                } catch (error) {
                    reject(error);
                }
            });
        }
        return await new Promise<E>((resolve: Consumer<E>, reject: Consumer<any>): void => {
            try {
                this.listeners.push((buffer: Array<Indexed<E>>): void => {
                    if (this.buffer.length > 0) {
                        for (let { element } of buffer) {
                            if (Math.random() < 0.5) {
                                resolve(element);
                            }
                        }
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }


    public override async findAt(index: number): Promise<E>;
    public override async findAt(index: bigint): Promise<E>;
    public override async findAt(target: number | bigint): Promise<E> {
        if (isBigInt(target)) {
            return await new Promise<E>((resolve: Consumer<E>, reject: Consumer<any>): void => {
                try {
                    if (this.complete === true) {
                        if (this.buffer.length > 0) {
                            for (let { element, index } of this.buffer) {
                                if (index === target) {
                                    resolve(element);
                                }
                            }
                        }
                    } else {
                        this.listeners.push((buffer: Array<Indexed<E>>): void => {
                            if (this.buffer.length > 0) {
                                for (let { element, index } of buffer) {
                                    if (index === target) {
                                        resolve(element);
                                    }
                                }
                            }
                        });
                    }
                } catch (error) {
                    reject(error);
                }
            });
        } else if (isNumber(target)) {
            return await new Promise<E>((resolve: Consumer<E>, reject: Consumer<any>): void => {
                try {
                    if (this.complete === true) {
                        if (this.buffer.length > 0) {
                            for (let { element, index } of this.buffer) {
                                if (Number(index) === target) {
                                    resolve(element);
                                }
                            }
                        }
                    } else {
                        this.listeners.push((buffer: Array<Indexed<E>>): void => {
                            if (this.buffer.length > 0) {
                                for (let { element, index } of buffer) {
                                    if (Number(index) === target) {
                                        resolve(element);
                                    }
                                }
                            }
                        });
                    }
                } catch (error) {
                    reject(error);
                }
            });
        }
        throw new TypeError("Invalid arguments.");
    }

    public override async findFirst(): Promise<E> {
        return await new Promise<E>((resolve: Consumer<E>, reject: Consumer<any>): void => {
            try {
                if (this.complete === true) {
                    if (this.buffer.length > 0) {
                        resolve(this.buffer[0].element);
                    }
                } else {
                    this.listeners.push((buffer: Array<Indexed<E>>): void => {
                        if (buffer.length > 0) {
                            resolve(buffer[0].element);
                        }
                    });
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    public override async findLast(): Promise<E> {
        return await new Promise<E>((resolve: Consumer<E>, reject: Consumer<any>): void => {
            try {
                if (this.complete === true) {
                    if (this.buffer.length > 0) {
                        resolve(this.buffer[this.buffer.length - 1].element);
                    }
                } else {
                    this.listeners.push((buffer: Array<Indexed<E>>): void => {
                        if (buffer.length > 0) {
                            resolve(buffer[this.buffer.length - 1].element);
                        }
                    });
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    public override async findMaximum(): Promise<E>;
    public override async findMaximum(comparator: Comparator<E>): Promise<E>;
    public override async findMaximum(argument1?: Comparator<E>): Promise<E> {
        if (isFunction(argument1)) {
            let comparator: Comparator<E> = argument1;
            return await new Promise<E>((resolve: Consumer<E>, reject: Consumer<any>): void => {
                try {
                    if (this.complete === true) {
                        if (this.buffer.length > 0) {
                            resolve(this.buffer.map((indexed: Indexed<E>): E => indexed.element).sort(comparator)[this.buffer.length - 1]);
                        }
                    } else {
                        this.listeners.push((buffer: Array<Indexed<E>>): void => {
                            if (buffer.length > 0) {
                                resolve(this.buffer.map((indexed: Indexed<E>): E => indexed.element).sort(comparator)[this.buffer.length - 1]);
                            }
                        });
                    }
                } catch (error) {
                    reject(error);
                }
            });
        } else {
            let comparator: Comparator<Indexed<E>> = (a: Indexed<E>, b: Indexed<E>): number => Number(a.index - b.index);
            return await new Promise<E>((resolve: Consumer<E>, reject: Consumer<any>): void => {
                try {
                    if (this.complete === true) {
                        if (this.buffer.length > 0) {
                            resolve(this.buffer.sort(comparator).map((indexed: Indexed<E>): E => indexed.element)[this.buffer.length - 1]);
                        }
                    } else {
                        this.listeners.push((buffer: Array<Indexed<E>>): void => {
                            if (buffer.length > 0) {
                                resolve(this.buffer.sort(comparator).map((indexed: Indexed<E>): E => indexed.element)[this.buffer.length - 1]);
                            }
                        });
                    }
                } catch (error) {
                    reject(error);
                }
            });
        }
    }

    public override async findMinimum(): Promise<E>;
    public override async findMinimum(comparator: Comparator<E>): Promise<E>;
    public override async findMinimum(argument1?: Comparator<E>): Promise<E> {
        if (isFunction(argument1)) {
            let comparator: Comparator<E> = argument1;
            return await new Promise<E>((resolve: Consumer<E>, reject: Consumer<any>): void => {
                try {
                    if (this.complete === true) {
                        if (this.buffer.length > 0) {
                            resolve(this.buffer.map((indexed: Indexed<E>): E => indexed.element).sort(comparator)[0]);
                        }
                    } else {
                        this.listeners.push((buffer: Array<Indexed<E>>): void => {
                            if (buffer.length > 0) {
                                resolve(this.buffer.map((indexed: Indexed<E>): E => indexed.element).sort(comparator)[0]);
                            }
                        });
                    }
                } catch (error) {
                    reject(error);
                }
            });
        } else {
            let comparator: Comparator<Indexed<E>> = (a: Indexed<E>, b: Indexed<E>): number => Number(a.index - b.index);
            return await new Promise<E>((resolve: Consumer<E>, reject: Consumer<any>): void => {
                try {
                    if (this.complete === true) {
                        if (this.buffer.length > 0) {
                            resolve(this.buffer.sort(comparator).map((indexed: Indexed<E>): E => indexed.element)[0]);
                        }
                    } else {
                        this.listeners.push((buffer: Array<Indexed<E>>): void => {
                            if (buffer.length > 0) {
                                resolve(this.buffer.sort(comparator).map((indexed: Indexed<E>): E => indexed.element)[0]);
                            }
                        });
                    }
                } catch (error) {
                    reject(error);
                }
            });
        }
    }

    public override source(): AsynchronousGenerator<E> {
        return async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            return await new Promise<void>((resolve: Runnable, reject: Consumer<any>): void => {
                try {
                    if (this.complete === true) {
                        for (let { index, element } of this.buffer) {
                            if (interrupt(element, index)) {
                                break;
                            }
                            accept(element, index);
                        }
                        resolve();
                    } else {
                        this.listeners.push((buffer: Array<Indexed<E>>): void => {
                            for (let { index, element } of buffer) {
                                if (interrupt(element, index)) {
                                    break;
                                }
                                accept(element, index);
                            }
                        });
                        resolve();
                    }
                } catch (error) {
                    reject(error);
                }
            });
        };
    }

    public override async isEmpty(): Promise<boolean> {
        return new Promise<boolean>((resolve: Consumer<boolean>): void => {
            this.listeners.push((buffer: Array<Indexed<E>>): void => {
                resolve(buffer.length === 0);
            });
        });
    }

    public override async count(): Promise<bigint> {
        if (this.complete === true) {
            return BigInt(this.buffer.length);
        }
        return await new Promise<bigint>((resolve: Consumer<bigint>): void => {
            this.listeners.push((buffer: Array<Indexed<E>>): void => {
                resolve(BigInt(buffer.length));
            });
        });
    }
};

export class AsynchronousUnorderedCollectable<E> extends AsynchronousCollectable<E> {

    protected readonly AsynchronousUnorderedCollectable: symbol = AsynchronousUnorderedCollectableSymbol;

    [Symbol.toStringTag]: string = "AsynchronousUnorderedCollectable";

    protected buffer: Map<bigint, E> = new Map<bigint, E>();

    protected complete: boolean = false;

    protected listeners: Array<Consumer<Map<bigint, E>>> = [];

    public constructor(generator: AsynchronousGenerator<E>);
    public constructor(argument1: AsynchronousGenerator<E>) {
        super();
        if (isFunction(argument1)) {
            let generator: AsynchronousGenerator<E> = argument1;
            generator((element: E, index: bigint): void => {
                this.buffer.set(index, element);
            }, (): boolean => false).then((): void => {
                for (let listener of this.listeners) {
                    listener(this.buffer);
                }
                this.complete = true;
                Object.freeze(this.complete);
                Object.freeze(this.buffer);
            });
            Object.defineProperties(this, {
                "AsynchronousUnorderedCollectable": {
                    value: AsynchronousUnorderedCollectableSymbol,
                    writable: false,
                    enumerable: false,
                    configurable: false
                }
            });
        } else {
            throw new TypeError("Source must be an iterable or a generator function.");
        }
    }

    public override source(): AsynchronousGenerator<E> {
        return async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            return await new Promise<void>((resolve: Runnable, reject: Consumer<any>): void => {
                try {
                    if (this.complete === true) {
                        for (let [index, element] of this.buffer) {
                            if (interrupt(element, index)) {
                                break;
                            }
                            accept(element, index);
                        }
                        resolve();
                    } else {
                        this.listeners.push((buffer: Map<bigint, E>): void => {
                            for (let [index, element] of buffer) {
                                if (interrupt(element, index)) {
                                    break;
                                }
                                accept(element, index);
                            }
                            resolve();
                        });

                    }
                } catch (error) {
                    reject(error);
                }
            });
        };
    }

    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        let buffer: Map<bigint, E> = await new Promise<Map<bigint, E>>((resolve: Consumer<Map<bigint, E>>, reject: Consumer<any>): void => {
            if (this.complete === true) {
                resolve(this.buffer);
            } else {
                this.listeners.push((buffer: Map<bigint, E>): void => {
                    resolve(buffer);
                }, reject);
            }
        });
        for await (let [_index, element] of buffer) {
            yield element;
        }
    }

};

export abstract class AsynchronousStatistics<E, D extends number | bigint> extends AsynchronousOrderedCollectable<E> {

    protected readonly AsynchronousStatistics: symbol = AsynchronousStatisticsSymbol;

    [Symbol.toStringTag]: string = "AsynchronousStatistics";

    public constructor(generator: AsynchronousGenerator<E>);
    public constructor(generator: AsynchronousGenerator<E>, comparator: Comparator<E>);
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

    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
            yield element;
        }
    }

    public abstract average(): Promise<D>;
    public abstract average(mapper: Functional<E, D>): Promise<D>;

    public abstract range(): Promise<D>;
    public abstract range(mapper: Functional<E, D>): Promise<D>;

    public abstract variance(): Promise<D>;
    public abstract variance(mapper: Functional<E, D>): Promise<D>;

    public abstract standardDeviation(): Promise<D>;
    public abstract standardDeviation(mapper: Functional<E, D>): Promise<D>;

    public abstract mean(): Promise<D>;
    public abstract mean(mapper: Functional<E, D>): Promise<D>;

    public abstract median(): Promise<D>;
    public abstract median(mapper: Functional<E, D>): Promise<D>;

    public abstract mode(): Promise<D>;
    public abstract mode(mapper: Functional<E, D>): Promise<D>;

    public async frequency(): Promise<Map<E, bigint>> {
        return await useAsynchronousFrequency<E>().collect(this.source());
    }

    public abstract summate(): Promise<D>;
    public abstract summate(mapper: Functional<E, D>): Promise<D>;

    public abstract quantile(quantile: number): Promise<D>;
    public abstract quantile(quantile: number, mapper: Functional<E, D>): Promise<D>;

    public abstract interquartileRange(): Promise<D>;
    public abstract interquartileRange(mapper: Functional<E, D>): Promise<D>;

    public abstract skewness(): Promise<D>;
    public abstract skewness(mapper: Functional<E, D>): Promise<D>;

    public abstract kurtosis(): Promise<D>;
    public abstract kurtosis(mapper: Functional<E, D>): Promise<D>;
};

export class AsynchronousBigIntStatistics<E> extends AsynchronousStatistics<E, bigint> {

    protected readonly BigIntStatistics: symbol = AsynchronousBigIntStatisticsSymbol;

    [Symbol.toStringTag]: string = "AsynchronousBigIntStatistics";

    public constructor(generator: AsynchronousGenerator<E>);
    public constructor(generator: AsynchronousGenerator<E>, comparator: Comparator<E>);
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

    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
            yield element;
        }
    }

    public async average(): Promise<bigint>;
    public async average(mapper: Functional<E, bigint>): Promise<bigint>;
    public async average(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return await useAsynchronousBigIntAverage(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on average.");
        }
    }

    public async range(): Promise<bigint>;
    public async range(mapper: Functional<E, bigint>): Promise<bigint>;
    public async range(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let minimum: E = await this.findFirst();
            let maximum: E = await this.findLast();
            let difference: bigint = mapper(maximum) - mapper(minimum);
            return difference < 0 ? -difference : difference;
        } catch (error) {
            throw new Error("Uncaught error on range.");
        }
    }

    public async variance(): Promise<bigint>;
    public async variance(mapper: Functional<E, bigint>): Promise<bigint>;
    public async variance(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty() || await this.count() === 1n) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return await useAsynchronousBigIntVariance(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on variance.");
        }
    }

    public async standardDeviation(): Promise<bigint>;
    public async standardDeviation(mapper: Functional<E, bigint>): Promise<bigint>;
    public async standardDeviation(argument1?: Functional<E, bigint>): Promise<bigint> {
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let variance: bigint = await this.variance(mapper);
            return BigInt(Math.sqrt(Number(variance)));
        } catch (error) {
            throw new Error("Uncaught error on standardDeviation.");
        }
    }

    public async mean(): Promise<bigint>;
    public async mean(mapper: Functional<E, bigint>): Promise<bigint>;
    public async mean(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return await useAsynchronousBigIntAverage(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on mean.");
        }
    }

    public async median(): Promise<bigint>;
    public async median(mapper: Functional<E, bigint>): Promise<bigint>;
    public async median(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useAsynchronousBigIntMedian(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on median.");
        }
    }

    public async mode(): Promise<bigint>;
    public async mode(mapper: Functional<E, bigint>): Promise<bigint>;
    public async mode(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useAsynchronousBigIntMode(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on mode.");
        }
    }

    public async summate(): Promise<bigint>;
    public async summate(mapper: Functional<E, bigint>): Promise<bigint>;
    public async summate(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return await useAsynchronousBigIntSummate(mapper).collect(this.source() as AsynchronousGenerator<bigint>);
        } catch (error) {
            throw new Error("Uncaught error on summate.");
        }
    }

    public async quantile(quantile: number): Promise<bigint>;
    public async quantile(quantile: number, mapper: Functional<E, bigint>): Promise<bigint>;
    public async quantile(quantile: number, argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
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
            let value: bigint = mapper(await this.findAt(index));
            return value;
        } catch (error) {
            throw new Error("Uncaught error on quantile.");
        }
    }

    public async interquartileRange(): Promise<bigint>;
    public async interquartileRange(mapper: Functional<E, bigint>): Promise<bigint>;
    public async interquartileRange(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let lower: bigint = await this.quantile(0.25, mapper);
            let upper: bigint = await this.quantile(0.75, mapper);
            return upper - lower;
        } catch (error) {
            throw new Error("Uncaught error on interquartileRange.");
        }
    }

    public async skewness(): Promise<bigint>;
    public async skewness(mapper: Functional<E, bigint>): Promise<bigint>;
    public async skewness(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let mean: bigint = await this.mean(mapper);
            let standardDeviation: bigint = await this.standardDeviation(mapper);
            if (standardDeviation === 0n) {
                return 0n;
            }
            let data: Array<bigint> = (await this.toArray()).map((element: E): bigint => mapper(element));
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

    public async kurtosis(): Promise<bigint>;
    public async kurtosis(mapper: Functional<E, bigint>): Promise<bigint>;
    public async kurtosis(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let mean: bigint = await this.mean(mapper);
            let standardDeviation: bigint = await this.standardDeviation(mapper);
            if (standardDeviation === 0n) {
                return 0n;
            }
            let data: Array<bigint> = (await this.toArray()).map((element: E): bigint => mapper(element));
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

export class AsynchronousNumericStatistics<E> extends AsynchronousStatistics<E, number> {

    protected readonly AsynchronousNumericStatistics: symbol = AsynchronousNumericStatisticsSymbol;

    [Symbol.toStringTag]: string = "AsynchronousNumericStatistics";

    public constructor(generator: AsynchronousGenerator<E>);
    public constructor(generator: AsynchronousGenerator<E>, comparator: Comparator<E>);
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

    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
            yield element;
        }
    }

    public async average(): Promise<number>;
    public async average(mapper: Functional<E, number>): Promise<number>;
    public async average(mapper?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            if (isFunction(mapper)) {
                return useAsynchronousNumericAverage(mapper).collect(this.source() as AsynchronousGenerator<number>);
            }
            return useAsynchronousNumericAverage().collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on average.");
        }
    }

    public async range(): Promise<number>;
    public async range(mapper: Functional<E, number>): Promise<number>;
    public async range(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            if (await this.count() === 1n) {
                return 0;
            }
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let minimum: E = await this.findFirst();
            let maximum: E = await this.findLast();
            return mapper(maximum) - mapper(minimum);
        } catch (error) {
            throw new Error("Uncaught error on range.");
        }
    }

    public async variance(): Promise<number>;
    public async variance(mapper: Functional<E, number>): Promise<number>;
    public async variance(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty() || await this.count() === 1n) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return await useAsynchronousNumericVariance(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on variance.");
        }
    }

    public async standardDeviation(): Promise<number>;
    public async standardDeviation(mapper: Functional<E, number>): Promise<number>;
    public async standardDeviation(argument1?: Functional<E, number>): Promise<number> {
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return await useAsynchronousNumericStandardDeviation(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on standardDeviation.");
        }
    }

    public async mean(): Promise<number>;
    public async mean(mapper: Functional<E, number>): Promise<number>;
    public async mean(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useAsynchronousNumericAverage(mapper).collect(this.source() as AsynchronousGenerator<number>);
        } catch (error) {
            throw new Error("Uncaught error on mean.");
        }
    }

    public async median(): Promise<number>;
    public async median(mapper: Functional<E, number>): Promise<number>;
    public async median(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return await useAsynchronousNumericMedian(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on median.");
        }
    }

    public async mode(): Promise<number>;
    public async mode(mapper: Functional<E, number>): Promise<number>;
    public async mode(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return await useAsynchronousNumericMode(mapper).collect(this.source());
        } catch (error) {
            throw new Error("Uncaught error on mode.");
        }
    }

    public async summate(): Promise<number>;
    public async summate(mapper: Functional<E, number>): Promise<number>;
    public async summate(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useAsynchronousNumericSummate(mapper).collect(this.source() as AsynchronousGenerator<number>);
        } catch (error) {
            throw new Error("Uncaught error on summate.");
        }
    }

    public async quantile(quantile: number): Promise<number>;
    public async quantile(quantile: number, mapper: Functional<E, number>): Promise<number>;
    public async quantile(quantile: number, argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        if (quantile < 0 || quantile > 1) {
            throw new RangeError("Invalid quantile.");
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let count: number = Number(await this.count());
            let index: number = Math.floor(quantile * count);
            if (index === count) {
                index--;
            }
            let value = mapper(await this.findAt(index));
            return value;
        } catch (error) {
            throw new Error("Uncaught error on quantile.");
        }
    }

    public async interquartileRange(): Promise<number>;
    public async interquartileRange(mapper: Functional<E, number>): Promise<number>;
    public async interquartileRange(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let lower: number = await this.quantile(0.25, mapper);
            let upper: number = await this.quantile(0.75, mapper);
            return upper - lower;
        } catch (error) {
            throw new Error("Uncaught error on interquartileRange.");
        }
    }

    public async skewness(): Promise<number>;
    public async skewness(mapper: Functional<E, number>): Promise<number>;
    public async skewness(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let mean: number = await this.mean(mapper);
            let standardDeviation: number = await this.standardDeviation(mapper);
            if (standardDeviation === 0) {
                return 0;
            }
            let data: Array<number> = (await this.toArray()).map((element: E): number => mapper(element));
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

    public async kurtosis(): Promise<number>;
    public async kurtosis(mapper: Functional<E, number>): Promise<number>;
    public async kurtosis(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let mean: number = await this.mean(mapper);
            let standardDeviation: number = await this.standardDeviation(mapper);
            if (standardDeviation === 0) {
                return 0;
            }
            let data: Array<number> = (await this.toArray()).map((element: E): number => mapper(element));
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

export class AsynchronousWindowCollectable<E> extends AsynchronousOrderedCollectable<E> {

    protected readonly WindowCollectable: symbol = AsynchronousWindowCollectableSymbol;

    [Symbol.toStringTag]: string = "AsynchronousWindowCollectable";

    public constructor(generator: AsynchronousGenerator<E>);
    public constructor(generator: AsynchronousGenerator<E>, comparator: Comparator<E>);
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

    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
            yield element;
        }
    }

    public slide(size: bigint, step: bigint = 1n): AsynchronousSemantic<AsynchronousSemantic<E>> {
        if (size > 0n && step > 0n) {
            return new AsynchronousSemantic<AsynchronousSemantic<E>>(async (accepet: Consumer<AsynchronousSemantic<E>> | BiConsumer<AsynchronousSemantic<E>, bigint>, interrupt: Predicate<AsynchronousSemantic<E>> | BiPredicate<AsynchronousSemantic<E>, bigint>): Promise<void> => {
                return await new Promise<void>((resolve: Runnable, reject: Consumer<any>): void => {
                    try {
                        let index: bigint = 0n;
                        for (let start: bigint = 0n; start < BigInt(this.buffer.length); start += step) {
                            let end: bigint = start + size;
                            let inner: AsynchronousSemantic<E> = new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
                                return await new Promise<void>((resolve: Runnable, reject: Consumer<any>): void => {
                                    for (let index: bigint = start; index < end && index < BigInt(this.buffer.length); index++) {
                                        let indexed: Indexed<E> = this.buffer[Number(index)];
                                        if (invalidate(indexed)) {
                                            continue;
                                        }
                                        if (interrupt(indexed.element, index)) {
                                            reject(new Error("Interrupted."));
                                            break;
                                        }
                                        accept(indexed.element, index);
                                    }
                                    resolve();
                                });
                            });
                            if (interrupt(inner, index)) {
                                reject(new Error("Interrupted."));
                                break;
                            }
                            accepet(inner, index);
                            index++;
                        }
                        resolve();
                    } catch (error) {
                        throw new Error("Uncaught error on slide.");
                    }
                });
            });
        }
        throw new RangeError("Invalid arguments.");
    }

    public tumble(size: bigint): AsynchronousSemantic<AsynchronousSemantic<E>> {
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
