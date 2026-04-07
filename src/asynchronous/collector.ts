import { isFunction, isNumber, isBigInt, isBoolean, isString, isObject, isAsyncIterable, isAsyncFunction } from "../guard";
import { useCompare, useToBigInt, useToNumber } from "../hook";
import { Optional } from "../optional";
import { AsynchronousCollectorSymbol } from "../symbol";
import type {
    BiFunctional, BiPredicate, Functional, Predicate, Supplier, TriFunctional, TriPredicate, Consumer, BiConsumer,
    Comparator, AsynchronousGenerator,
    MaybeInvalid
} from "../utility";
import { invalidate, validate } from "../utility";

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
        } else {
            throw new TypeError("Invalid arguments");
        }
    }

    public async collect(generator: AsynchronousGenerator<E>): Promise<R>;
    public async collect(iterable: AsyncIterable<E>): Promise<R>;
    public async collect(start: number, end: number): Promise<R>;
    public async collect(start: bigint, end: bigint): Promise<R>;
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

                } catch (error) {
                    reject(error);
                }
            });
        } else if (isAsyncIterable(argument1)) {
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
                } catch (error) {
                    reject(error);
                }
            });

        } else if (isNumber(argument1) && isNumber(argument2)) {
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
                } catch (error) {
                    reject(error);
                }
            });
        } else if (isBigInt(argument1) && isBigInt(argument2)) {
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
                } catch (error) {
                    reject(error);
                }
            });
        }
        throw new Error("Invalid arguments.");
    }

    public getIdentity(): Supplier<A> {
        return this.identity;
    }

    public getInterrupt(): Predicate<E> | BiPredicate<E, bigint> | TriPredicate<E, bigint, A> {
        return this.interrupt;
    }

    public getAccumulator(): BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> {
        return this.accumulator;
    }

    public getFinisher(): Functional<A, R> {
        return this.finisher;
    }

    public static full<E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    public static full<E, A, R>(identity: Supplier<A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    public static full<E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R> {
        return new AsynchronousCollector(identity, () => false, accumulator, finisher);
    }

    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: Predicate<E> | BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R> {
        return new AsynchronousCollector<E, A, R>(identity, interrupt, accumulator, finisher);
    }
};

interface UseAsynchronousAnyMatch {
    <E>(predicate: Predicate<E>): AsynchronousCollector<E, boolean, boolean>;
    <E>(predicate: BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean>;
};
export let useAsynchronousAnyMatch: UseAsynchronousAnyMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return AsynchronousCollector.shortable(
            (): boolean => false,
            (_element: E, _index: bigint, accumulator: boolean): boolean => isBoolean(accumulator) && accumulator,
            (accumulator: boolean, element: E, index: bigint): boolean => accumulator || predicate(element, index),
            (accumulator: boolean): boolean => accumulator
        );
    }
    throw new TypeError("Predicate must be a function.");
};

interface UseAsynchronousAllMatch {
    <E>(predicate: Predicate<E>): AsynchronousCollector<E, boolean, boolean>;
    <E>(predicate: BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean>;
};
export let useAsynchronousAllMatch: UseAsynchronousAllMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return AsynchronousCollector.shortable(
            (): boolean => true,
            (_element: E, _index: bigint, accumulator: boolean): boolean => isBoolean(accumulator) && !accumulator,
            (accumulator: boolean, element: E, index: bigint): boolean => accumulator && predicate(element, index),
            (accumulator: boolean): boolean => accumulator
        );
    }
    throw new TypeError("Predicate must be a function.");
};

interface UseAsynchronousCollect {
    <E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    <E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
};
export let useAsynchronousCollect: UseAsynchronousCollect = <E, A, R>(argument1: Supplier<A> | AsynchronousCollector<E, A, R>, argument2?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Predicate<E> | BiPredicate<E, bigint> | TriPredicate<E, bigint, A>, argument3?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Functional<A, R>, argument4?: Functional<A, R>): AsynchronousCollector<E, A, R> => {
    if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3) && isFunction(argument4)) {
        let identity: Supplier<A> = argument1 as Supplier<A>;
        let interrupt: Predicate<E> & BiPredicate<E, bigint> & TriPredicate<E, bigint, A> = argument2 as Predicate<E> & BiPredicate<E, bigint> & TriPredicate<E, bigint, A>;
        let accumulator: BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A> = argument3 as BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A>;
        let finisher: Functional<A, R> = argument4 as Functional<A, R>;
        return AsynchronousCollector.shortable(identity, interrupt, accumulator, finisher);
    }
    if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3)) {
        let identity: Supplier<A> = argument1 as Supplier<A>;
        let accumulator: BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A> = argument2 as BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A>;
        let finisher: Functional<A, R> = argument3 as Functional<A, R>;
        return AsynchronousCollector.full(identity, accumulator, finisher);
    }
    throw new TypeError("Identity, accumulator, and finisher must be functions.");
};

export let useAsynchronousCount: <E = unknown>() => AsynchronousCollector<E, bigint, bigint> = <E = unknown>(): AsynchronousCollector<E, bigint, bigint> => {
    return AsynchronousCollector.full(
        (): bigint => 0n,
        (count: bigint): bigint => count + 1n,
        (count: bigint): bigint => count
    );
};

interface UseAsynchronousError {
    <E = unknown>(): AsynchronousCollector<E, string, string>;
    <E = unknown>(accumulator: BiFunctional<string, E, string>): AsynchronousCollector<E, string, string>;
    <E = unknown>(accumulator: TriFunctional<string, E, bigint, string>): AsynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): AsynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): AsynchronousCollector<E, string, string>;
};
export let useAsynchronousError: UseAsynchronousError = <E = unknown>(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): AsynchronousCollector<E, string, string> => {
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return AsynchronousCollector.full<E, string, string>(
            (): string => prefix,
            accumulator,
            (text: string): string => {
                let result: string = text + suffix;
                console.error(result);
                return result;
            }
        );
    } else if (isFunction(argument1)) {
        let prefix: string = "[";
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = "]";
        return AsynchronousCollector.full<E, string, string>(
            (): string => prefix,
            accumulator,
            (text: string): string => {
                let result: string = text + suffix;
                console.error(result);
                return result;
            }
        );
    } else {
        return AsynchronousCollector.full<E, string, string>(
            (): string => "[",
            (accumulator: string, element: E): string => {
                if (isString(accumulator) && isString(element)) {
                    return accumulator + element + ",";
                }
                return String(accumulator) + String(element) + ",";
            },
            (text: string): string => {
                let result: string = text.substring(0, Math.max(1, text.length - 1)) + "]";
                console.error(result);
                return result;
            }
        );
    }
};

interface UseAsynchronousFindAt {
    <E>(index: number): AsynchronousCollector<E, Optional<E>, Promise<E>>;
    <E>(index: bigint): AsynchronousCollector<E, Optional<E>, Promise<E>>;
};
export let useAsynchronousFindAt: UseAsynchronousFindAt = <E>(index: number | bigint): AsynchronousCollector<E, Optional<E>, Promise<E>> => {
    let target: bigint = useToBigInt(index);
    if(target < 0n){
        throw new Error("Use \"useAsynchronousFindNegativeAt\" for negative index.");
    }
    return AsynchronousCollector.shortable(
        Optional.empty,
        (_element: E, _index: bigint, accumulator: Optional<E>): boolean => accumulator.isPresent(),
        (accumulator: Optional<E>, element: E, index: bigint): Optional<E> => {
            if(target === index){
                return Optional.of(element);
            }
            return accumulator;
        },
        (a) => {
            return new Promise<E>((resolve, reject): void => {
                a.ifPresent(resolve, reject);
            });
        }
    );
};

interface UseAsynchronousFindNegativeAt {
    <E>(index: number): AsynchronousCollector<E, Array<E>, Promise<E>>;
    <E>(index: bigint): AsynchronousCollector<E, Array<E>, Promise<E>>;
};
export let useAsynchronousFindNegativeAt: UseAsynchronousFindNegativeAt = <E>(index: number | bigint): AsynchronousCollector<E, Array<E>, Promise<E>> => {
    let target: bigint = useToBigInt(index);
    if(target > -1n){
        throw new Error("Use \"useAsynchronousFindAt\" for none-negative index.");
    }
    return AsynchronousCollector.full(
        () => [],
        (accumulator: Array<E>, element: E): Array<E> => {
            accumulator.push(element);
            return accumulator;
        },
        (accumulator: Array<E>): Promise<E> => {
            return new Promise<E>((resolve, reject): void => {
                if(accumulator.length > 0){
                    let count: bigint = BigInt(accumulator.length);
                    let limit: bigint = (((target) % count) + count) % count;
                    let element: MaybeInvalid<E> = accumulator.at(Number(limit));
                    if(validate(element)){
                        resolve(element);
                    }else{
                        reject("Element could not be found with given index.");
                    }
                }else{
                    reject("Not element to be found.");
                }
            });
        }
    );
};

export let useAsynchronousFindFirst: <E>() => AsynchronousCollector<E, Array<E>, Promise<E>> = <E>(): AsynchronousCollector<E, Array<E>, Promise<E>> => {
    return AsynchronousCollector.shortable(
        (): Array<E> => [],
        (_element: E, _index: bigint, accumulator: Array<E>): boolean => validate(accumulator) && accumulator.length === 1,
        (accumulator: Array<E>, element: E): Array<E> => {
            if (validate(accumulator) && accumulator.length === 0) {
                accumulator.push(element);
                return accumulator;
            }
            return accumulator;
        },
        (accumulator: Array<E>): Promise<E> => {
            if (validate(accumulator) && accumulator.length > 0) {
                return Promise.resolve(accumulator[0]);
            }
            return Promise.reject(new Error("No element found."));
        });
};

export let useAsynchronousFindAny: <E>() => AsynchronousCollector<E, Array<E>, Promise<E>> = <E>(): AsynchronousCollector<E, Array<E>, Promise<E>> => {
    return AsynchronousCollector.shortable(
        (): Array<E> => [],
        (_element: E, _index: bigint, accumulator: Array<E>): boolean => validate(accumulator) && accumulator.length == 1,
        (accumulator: Array<E>, element: E): Array<E> => {
            if (validate(accumulator) && accumulator.length === 0 && Math.random() < 0.5) {
                accumulator.push(element);
                return accumulator;
            }
            return accumulator;
        },
        (accumulator: Array<E>): Promise<E> => Promise.resolve(accumulator[0]));
};

export let useAsynchronousFindLast: <E>() => AsynchronousCollector<E, Array<E>, Promise<E>> = <E>(): AsynchronousCollector<E, Array<E>, Promise<E>> => {
    return AsynchronousCollector.full(
        (): Array<E> => [],
        (accumulator: Array<E>, element: E): Array<E> => {
            if (validate(accumulator)) {
                accumulator.push(element);
            }
            return accumulator;
        },
        (accumulator: Array<E>): Promise<E> => Promise.resolve(accumulator[accumulator.length - 1]));
};

interface UseAsynchronousFindMaximum {
    <E>(): AsynchronousCollector<E, Promise<E>, Promise<E>>;
    <E>(comparator: Comparator<E>): AsynchronousCollector<E, Promise<E>, Promise<E>>;
}
export let useAsynchronousFindMaximum: UseAsynchronousFindMaximum = <E>(comparator: Comparator<E> = useCompare<E>): AsynchronousCollector<E, Promise<E>, Promise<E>> => {
    if (isFunction(comparator)) {
        return AsynchronousCollector.full(
            (): Promise<E> => Promise.reject(new Error("No element found.")),
            async (accumulator: Promise<E>, element: E): Promise<E> => {
                if (validate(accumulator)) {
                    return accumulator.then((accumulator: E): E => {
                        if (comparator(accumulator, element) < 0) {
                            return element;
                        } else {
                            return accumulator;
                        }
                    });
                }
                return Promise.reject(new Error("No element found."));
            },
            (result: Promise<E>): Promise<E> => result);
    }
    throw new TypeError("Invalid argument.");
};

interface UseAsynchronousFindMinimum {
    <E>(): AsynchronousCollector<E, Promise<E>, Promise<E>>;
    <E>(comparator: Comparator<E>): AsynchronousCollector<E, Promise<E>, Promise<E>>;
}
export let useAsynchronousFindMinimum: UseAsynchronousFindMinimum = <E>(comparator: Comparator<E> = useCompare<E>): AsynchronousCollector<E, Promise<E>, Promise<E>> => {
    if (isFunction(comparator)) {
        return AsynchronousCollector.full(
            (): Promise<E> => Promise.reject(new Error("No element found.")),
            async (accumulator: Promise<E>, element: E): Promise<E> => {
                if (validate(accumulator)) {
                    return accumulator.then((accumulator: E): E => {
                        if (comparator(accumulator, element) > 0) {
                            return element;
                        } else {
                            return accumulator;
                        }
                    });
                }
                return Promise.reject(new Error("No element found."));
            },
            (result: Promise<E>): Promise<E> => result);
    }
    throw new TypeError("Invalid argument.");
};

interface UseAsynchronousForEach {
    <E>(action: Consumer<E>): AsynchronousCollector<E, bigint, bigint>;
    <E>(action: BiConsumer<E, bigint>): AsynchronousCollector<E, bigint, bigint>;
};
export let useAsynchronousForEach: UseAsynchronousForEach = <E>(action: Consumer<E> | BiConsumer<E, bigint>): AsynchronousCollector<E, bigint, bigint> => {
    if (isFunction(action)) {
        return AsynchronousCollector.full(
            (): bigint => 0n,
            (accumulator: bigint, element: E, index: bigint): bigint => {
                action(element, index);
                return accumulator + 1n;
            },
            (accumulator: bigint): bigint => accumulator
        );
    }
    throw new TypeError("Action must be a function.");
};

interface UseAsynchronousNonMatch {
    <E>(predicate: Predicate<E>): AsynchronousCollector<E, boolean, boolean>;
    <E>(predicate: BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean>;
};
export let useAsynchronousNoneMatch: UseAsynchronousNonMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return AsynchronousCollector.shortable(
            (): boolean => true,
            (_element: E, _index: bigint, accumulator: boolean): boolean => !accumulator,
            (accumulator: boolean, element: E, index: bigint): boolean => accumulator && !predicate(element, index),
            (accumulator: boolean): boolean => !accumulator
        );
    }
    throw new TypeError("Predicate must be a function.");
};

interface UseAsynchronousGroup {
    <E, K>(classifier: Functional<E, K>): AsynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
    <E, K>(classifier: BiFunctional<E, bigint, K>): AsynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
};
export let useAsynchronousGroup: UseAsynchronousGroup = <E, K>(classifier: Functional<E, K> | BiFunctional<E, bigint, K>): AsynchronousCollector<E, Map<K, E[]>, Map<K, E[]>> => {
    if (isFunction(classifier)) {
        return AsynchronousCollector.full(
            (): Map<K, E[]> => new Map<K, E[]>(),
            (accumulator: Map<K, E[]>, element: E, index: bigint): Map<K, E[]> => {
                let key: K = classifier(element, index);
                let group: E[] = accumulator.get(key) || [];
                group.push(element);
                accumulator.set(key, group);
                return accumulator;
            },
            (accumulator: Map<K, E[]>): Map<K, E[]> => accumulator
        );
    }
    throw new TypeError("Classifier must be a function.");
};

interface UseAsynchronousGroupBy {
    <E, K>(keyExtractor: Functional<E, K>): AsynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): AsynchronousCollector<E, Map<K, V[]>, Map<K, V[]>>;
    <E, K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): AsynchronousCollector<E, Map<K, V[]>, Map<K, V[]>>;
}
export let useAsynchronousGroupBy: UseAsynchronousGroupBy = <E, K, V = E>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E) => element as unknown as V): AsynchronousCollector<E, Map<K, V[]>, Map<K, V[]>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return AsynchronousCollector.full(
            (): Map<K, V[]> => new Map<K, V[]>(),
            (accumulator: Map<K, V[]>, element: E, index: bigint): Map<K, V[]> => {
                let key: K = keyExtractor(element, index);
                let group: V[] = accumulator.get(key) || [];
                group.push(valueExtractor(element, index));
                accumulator.set(key, group);
                return accumulator;
            },
            (accumulator: Map<K, V[]>): Map<K, V[]> => accumulator
        );
    }
    throw new TypeError("Key extractor and value extractor must be functions.");
};

interface UseAsynchronousJoin {
    <E = unknown>(): AsynchronousCollector<E, string, string>;
    <E = unknown>(delimiter: string): AsynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, delimiter: string, suffix: string): AsynchronousCollector<E, string, string>;
    <E = unknown>(prefiex: string, accumulator: BiFunctional<string, E, string>, suffix: string): AsynchronousCollector<E, string, string>;
    <E = unknown>(prefiex: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): AsynchronousCollector<E, string, string>
};
export let useAsynchronousJoin: UseAsynchronousJoin = <E = unknown>(argument1?: string, argument2?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): AsynchronousCollector<E, string, string> => {
    if (invalidate(argument1) && invalidate(argument2) && invalidate(argument3)) {
        return AsynchronousCollector.full<E, string, string>(
            (): string => "[",
            (text: string, element: E): string => text + element + ",",
            (text: string): string => text.substring(0, text.length - 1) + "]"
        );
    }
    if (isString(argument1) && invalidate(argument2) && invalidate(argument3)) {
        let delimiter: string = argument1;
        return AsynchronousCollector.full<E, string, string>(
            (): string => "[",
            (text: string, element: E): string => text + element + delimiter,
            (text: string): string => text.substring(0, text.length - delimiter.length) + "]"
        );
    }
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return AsynchronousCollector.full<E, string, string>(
            (): string => prefix,
            accumulator,
            (text: string): string => text + suffix
        );
    }
    if (isString(argument1) && isString(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let delimiter: string = argument2;
        let suffix: string = argument3;
        return AsynchronousCollector.full<E, string, string>(
            (): string => prefix,
            (text: string, element: E): string => text + element + delimiter,
            (text: string): string => text + suffix
        );
    }
    throw new TypeError("Invalid arguments.");
};

interface UseAsynchronousLog {
    <E = unknown>(): AsynchronousCollector<E, string, string>;
    <E = unknown>(accumulator: BiFunctional<string, E, string>): AsynchronousCollector<E, string, string>;
    <E = unknown>(accumulator: TriFunctional<string, E, bigint, string>): AsynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): AsynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): AsynchronousCollector<E, string, string>;
};

export let useAsynchronousLog: UseAsynchronousLog = <E = unknown>(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): AsynchronousCollector<E, string, string> => {
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return AsynchronousCollector.full<E, string, string>(
            (): string => prefix,
            accumulator,
            (text: string): string => {
                let result: string = text + suffix;
                console.log(result);
                return result;
            }
        );
    } else if (isFunction(argument1)) {
        let prefix: string = "[";
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = "]";
        return AsynchronousCollector.full<E, string, string>(
            (): string => prefix,
            accumulator,
            (text: string): string => {
                let result: string = text + suffix;
                console.log(result);
                return result;
            }
        );
    } else {
        return AsynchronousCollector.full<E, string, string>(
            (): string => "[",
            (accumulator: string, element: E): string => {
                if (isString(accumulator) && isString(element)) {
                    return accumulator + element + ",";
                }
                return String(accumulator) + String(element) + ",";
            },
            (text: string): string => {
                let result: string = text.substring(0, Math.max(1, text.length - 1)) + "]";
                console.log(result);
                return result;
            }
        );
    }
};

export let useAsynchronousPartition: <E>(count: bigint) => AsynchronousCollector<E, Array<Array<E>>, Array<Array<E>>> = <E>(count: bigint): AsynchronousCollector<E, Array<Array<E>>, Array<Array<E>>> => {
    if (isBigInt(count)) {
        let limited = count > 1n ? count : 1n;
        return AsynchronousCollector.full(
            (): Array<Array<E>> => {
                return [];
            }, (array: Array<Array<E>>, element: E): Array<Array<E>> => {
                let index: bigint = limited % BigInt(array.length);
                if (index === 0n) {
                    array.push([]);
                }
                array[Number(index)].push(element);
                return array;
            }, (result: Array<Array<E>>,): Array<Array<E>> => {
                return result;
            });
    }
    throw new TypeError("Count must be a BigInt.");
};

interface UseAsynchronousPartitionBy {
    <E>(classifier: Functional<E, bigint>): AsynchronousCollector<E, Array<E[]>, Array<E[]>>;
    <E>(classifier: BiFunctional<E, bigint, bigint>): AsynchronousCollector<E, Array<E[]>, Array<E[]>>;
};
export let useAsynchronousPartitionBy: UseAsynchronousPartitionBy = <E>(classifier: Functional<E, bigint> | BiFunctional<E, bigint, bigint>): AsynchronousCollector<E, Array<E[]>, Array<E[]>> => {
    if (isFunction(classifier)) {
        return AsynchronousCollector.full(
            (): Array<Array<E>> => {
                return [];
            }, (array: Array<Array<E>>, element: E, index: bigint): Array<Array<E>> => {
                let resolved: bigint = classifier(element, index);
                while (resolved > BigInt(array.length) - 1n) {
                    array.push([]);
                }
                array[Number(index)].push(element);
                return array;
            }, (result: Array<Array<E>>,): Array<Array<E>> => {
                return result;
            });
    }
    throw new TypeError("Classifier must be a function.");
};

interface UseAsynchronousReduce {
    <E>(accumulator: BiFunctional<E, E, E>): AsynchronousCollector<E, Promise<E>, Promise<E>>;
    <E>(accumulator: TriFunctional<E, E, bigint, E>): AsynchronousCollector<E, Promise<E>, Promise<E>>;
    <E>(identity: E, accumulator: BiFunctional<E, E, E>): AsynchronousCollector<E, E, E>;
    <E>(identity: E, accumulator: TriFunctional<E, E, bigint, E>): AsynchronousCollector<E, E, E>;
    <E, R>(identity: R, accumulator: BiFunctional<R, E, R>, finisher: Functional<R, R>): AsynchronousCollector<E, R, R>;
    <E, R>(identity: R, accumulator: TriFunctional<R, E, bigint, R>, finisher: Functional<R, R>): AsynchronousCollector<E, R, R>;
};

export let useAsynchronousReduce: UseAsynchronousReduce = <E, R>(argument1?: R | E | BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E>, argument2?: BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E> | BiFunctional<R, E, R> | TriFunctional<R, E, bigint, R>, argument3?: Functional<R, R>): AsynchronousCollector<E, Promise<E>, Promise<E>> | AsynchronousCollector<E, E, E> | AsynchronousCollector<E, R, R> => {
    if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
        let accumulator: BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E> = argument1 as BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E>;
        return AsynchronousCollector.full<E, Promise<E>, Promise<E>>(
            (): Promise<E> => Promise.reject<E>(),
            async (result: Promise<E>, element: E, index: bigint): Promise<E> => {
                if (validate(result)) {
                    return result.then((result: E) => {
                        return accumulator(result, element, index);
                    });
                }
                return Promise.reject<E>();
            },
            (result: Promise<E>): Promise<E> => result
        );
    } else if (validate(argument1) && isFunction(argument2) && invalidate(argument3)) {
        let identity = argument1 as E;
        let accumulator: BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E> = argument2 as BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E>;
        return AsynchronousCollector.full<E, E, E>(() => identity, accumulator, (result: E): E => result);
    } else if (validate(argument1) && isFunction(argument2) && isFunction(argument3)) {
        let identity = argument1 as R;
        let accumulator: BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R> = argument2 as BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R>;
        let finisher = argument3 as Functional<R, R>;
        return AsynchronousCollector.full<E, R, R>(() => identity, accumulator, finisher);
    } else {
        throw new TypeError("Invalid arguments.");
    }
};

export let useAsynchronousToArray: <E>() => AsynchronousCollector<E, E[], E[]> = <E>(): AsynchronousCollector<E, E[], E[]> => {
    return AsynchronousCollector.full<E, E[], E[]>(
        (): E[] => [],
        (array: E[], element: E): E[] => {
            array.push(element);
            return array;
        },
        (array: E[]): E[] => array
    );
};

interface UseAsynchronousToMap {
    <E, K>(keyExtractor: Functional<E, K>): AsynchronousCollector<E, Map<K, E>, Map<K, E>>;
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): AsynchronousCollector<E, Map<K, V>, Map<K, V>>;
    <E, K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): AsynchronousCollector<E, Map<K, V>, Map<K, V>>;
};
export let useAsynchronousToMap: UseAsynchronousToMap = <E, K, V>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): AsynchronousCollector<E, Map<K, V>, Map<K, V>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return AsynchronousCollector.full<E, Map<K, V>, Map<K, V>>(
            (): Map<K, V> => new Map<K, V>(),
            (map: Map<K, V>, element: E, index: bigint): Map<K, V> => {
                let key: K = keyExtractor(element, index);
                let value: V = valueExtractor(element, index);
                map.set(key, value);
                return map;
            },
            (map: Map<K, V>): Map<K, V> => map
        );
    }
    throw new TypeError("Key extractor and value extractor must be functions.");
};

export let useAsynchronousToSet: <E>() => AsynchronousCollector<E, Set<E>, Set<E>> = <E>(): AsynchronousCollector<E, Set<E>, Set<E>> => {
    return AsynchronousCollector.full<E, Set<E>, Set<E>>(
        (): Set<E> => new Set<E>(),
        (set: Set<E>, element: E): Set<E> => {
            set.add(element);
            return set;
        },
        (set: Set<E>): Set<E> => set
    );
};

interface UseAsynchronousWrite {
    <E, S = string>(stream: WritableStream<S>): AsynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
    <E, S = string>(stream: WritableStream<S>, accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>>): AsynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
    <E, S = string>(stream: WritableStream<S>, accumulator: TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): AsynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
};

export let useAsynchronousWrite: UseAsynchronousWrite = <E, S = string>(argument1: WritableStream<S>, argument2?: BiFunctional<WritableStream<S>, E, WritableStream<S>> | TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): AsynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>> => {
    if (isObject(argument1)) {
        if (isFunction(argument2)) {
            let stream: WritableStream<S> = argument1 as WritableStream<S>;
            let accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>> = argument2 as BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>;
            return AsynchronousCollector.full<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>(
                (): Promise<WritableStream<S>> => Promise.resolve(stream),
                (promise: Promise<WritableStream<S>>, element: E, index: bigint): Promise<WritableStream<S>> => {
                    return new Promise<WritableStream<S>>((resolve, reject) => {
                        promise.then((stream: WritableStream<S>): void => {
                            try {
                                resolve(accumulator(stream, element, index));
                            } catch (error) {
                                reject(error);
                            }
                        }).catch(reject);
                    });
                },
                (promise: Promise<WritableStream<S>>): Promise<WritableStream<S>> => promise);
        } else {
            let stream: WritableStream<S> = argument1 as WritableStream<S>;
            return AsynchronousCollector.full<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>(
                (): Promise<WritableStream<S>> => Promise.resolve(stream),
                (promise: Promise<WritableStream<S>>, element: E): Promise<WritableStream<S>> => {
                    return new Promise<WritableStream<S>>((resolve, reject) => {
                        promise.then((stream: WritableStream<S>): void => {
                            try {
                                let writer: WritableStreamDefaultWriter<S> = stream.getWriter();
                                writer.write(String(element) as S);
                                resolve(stream);
                            } catch (error) {
                                reject(error);
                            }
                        }).catch(reject);
                    });
                },
                (promise: Promise<WritableStream<S>>): Promise<WritableStream<S>> => promise);
        }
    }
    throw new TypeError("Invalid arguments.");
};

interface UseAsynchronousNumericSummate {
    <E>(): AsynchronousCollector<E, number, number>;
    <E>(mapper: Functional<E, number>): AsynchronousCollector<number, number, number>;
};
export let useAsynchronousNumericSummate: UseAsynchronousNumericSummate = <E>(mapper: Functional<E, number> = useToNumber): AsynchronousCollector<number, number, number> | AsynchronousCollector<E, number, number> => {
    return AsynchronousCollector.full(
        (): number => 0,
        (accumulator: number, element: number | E): number => {
            let resolved: number = isNumber(element) ? element : mapper(element);
            return accumulator + (isNumber(resolved) ? resolved : 0);
        },
        (result: number): number => result
    ) as AsynchronousCollector<number, number, number> | AsynchronousCollector<E, number, number>;
};

interface UseAsynchronousBigIntSummate {
    <E>(): AsynchronousCollector<E, bigint, bigint>;
    <E>(mapper: Functional<E, bigint>): AsynchronousCollector<bigint, bigint, bigint>;
};
export let useAsynchronousBigIntSummate: UseAsynchronousBigIntSummate = <E>(mapper: Functional<E, bigint> = useToBigInt): AsynchronousCollector<bigint, bigint, bigint> | AsynchronousCollector<E, bigint, bigint> => {
    return AsynchronousCollector.full(
        (): bigint => 0n,
        (accumulator: bigint, element: bigint | E): bigint => {
            let resolved: bigint = isBigInt(element) ? element : mapper(element);
            return accumulator + (isBigInt(resolved) ? resolved : 0n);
        },
        (result: bigint): bigint => result
    ) as AsynchronousCollector<bigint, bigint, bigint> | AsynchronousCollector<E, bigint, bigint>;
};

interface UseAsynchronousNumericAverage {
    <E>(): AsynchronousCollector<E, NumericAverageAccumulator, number>;
    <E>(mapper: Functional<E, number>): AsynchronousCollector<number, NumericAverageAccumulator, number>;
};
interface NumericAverageAccumulator {
    summate: number;
    count: number;
};
export let useAsynchronousNumericAverage: UseAsynchronousNumericAverage = <E>(mapper: Functional<E, number> = useToNumber): AsynchronousCollector<number, NumericAverageAccumulator, number> | AsynchronousCollector<E, NumericAverageAccumulator, number> => {
    return AsynchronousCollector.full(
        (): NumericAverageAccumulator => {
            return {
                summate: 0,
                count: 0
            };
        },
        (accumulator: NumericAverageAccumulator, element: number | E): NumericAverageAccumulator => {
            let resolved: number = isNumber(element) ? element : mapper(element);
            return {
                summate: accumulator.summate + (isNumber(resolved) ? resolved : 0),
                count: accumulator.count + 1
            };
        },
        (result: NumericAverageAccumulator): number => {
            if (result.count === 0) {
                return 0;
            }
            return result.summate / result.count;
        }
    ) as AsynchronousCollector<number, NumericAverageAccumulator, number> | AsynchronousCollector<E, NumericAverageAccumulator, number>;
};

interface UseAsynchronousBigIntAverage {
    <E>(): AsynchronousCollector<E, BigIntAverageAccumulator, bigint>;
    <E>(mapper: Functional<E, bigint>): AsynchronousCollector<E, BigIntAverageAccumulator, bigint>;
};
interface BigIntAverageAccumulator {
    summate: bigint;
    count: bigint;
};
export let useAsynchronousBigIntAverage: UseAsynchronousBigIntAverage = <E>(mapper: Functional<E, bigint> = useToBigInt): AsynchronousCollector<bigint, BigIntAverageAccumulator, bigint> | AsynchronousCollector<E, BigIntAverageAccumulator, bigint> => {
    return AsynchronousCollector.full(
        (): BigIntAverageAccumulator => {
            return {
                summate: 0n,
                count: 0n
            };
        },
        (accumulator: BigIntAverageAccumulator, element: bigint | E): BigIntAverageAccumulator => {
            let resolved: bigint = isBigInt(element) ? element : mapper(element);
            return {
                summate: accumulator.summate + (isBigInt(resolved) ? resolved : 0n),
                count: accumulator.count + 1n
            };
        },
        (result: BigIntAverageAccumulator): bigint => {
            if (result.count === 0n) {
                return 0n;
            }
            return result.summate / result.count;
        }
    ) as AsynchronousCollector<bigint, BigIntAverageAccumulator, bigint> | AsynchronousCollector<E, BigIntAverageAccumulator, bigint>;
};

export let useAsynchronousFrequency: <E>() => AsynchronousCollector<E, Map<E, bigint>, Map<E, bigint>> = <E>(): AsynchronousCollector<E, Map<E, bigint>, Map<E, bigint>> => {
    return AsynchronousCollector.full(
        (): Map<E, bigint> => new Map<E, bigint>(),
        (map: Map<E, bigint>, element: E): Map<E, bigint> => {
            let count: bigint = map.get(element) || 0n;
            map.set(element, count + 1n);
            return map;
        },
        (map: Map<E, bigint>): Map<E, bigint> => map
    );
};

interface UseAsynchronousNumericMode {
    <E>(): AsynchronousCollector<E, Map<number, bigint>, number>;
    <E>(mapper: Functional<E, number>): AsynchronousCollector<E, Map<number, bigint>, number>;
};
export let useAsynchronousNumericMode: UseAsynchronousNumericMode = <E>(mapper: Functional<E, number> = useToNumber): AsynchronousCollector<number, Map<number, bigint>, number> | AsynchronousCollector<E, Map<number, bigint>, number> => {
    return AsynchronousCollector.full(
        (): Map<number, bigint> => new Map<number, bigint>(),
        (map: Map<number, bigint>, element: number | E): Map<number, bigint> => {
            let resolved: number = isNumber(element) ? element : mapper(element);
            let count: bigint = map.get(resolved) || 0n;
            map.set(resolved, count + 1n);
            return map;
        },
        (map: Map<number, bigint>): number => {
            let maxCount: bigint = 0n;
            let mode: number = 0;
            for (let [key, value] of map) {
                if (value > maxCount) {
                    maxCount = value;
                    mode = key;
                }
            }
            return mode;
        }
    ) as AsynchronousCollector<number, Map<number, bigint>, number> | AsynchronousCollector<E, Map<number, bigint>, number>;
};

interface UseAsynchronousBigIntMode {
    <E>(): AsynchronousCollector<E, Map<bigint, bigint>, bigint>;
    <E>(mapper: Functional<E, bigint>): AsynchronousCollector<E, Map<bigint, bigint>, bigint>;
};
export let useAsynchronousBigIntMode: UseAsynchronousBigIntMode = <E>(mapper: Functional<E, bigint> = useToBigInt): AsynchronousCollector<bigint, Map<bigint, bigint>, bigint> | AsynchronousCollector<E, Map<bigint, bigint>, bigint> => {
    return AsynchronousCollector.full(
        (): Map<bigint, bigint> => new Map<bigint, bigint>(),
        (map: Map<bigint, bigint>, element: bigint | E): Map<bigint, bigint> => {
            let resolved: bigint = isBigInt(element) ? element : mapper(element);
            let count: bigint = map.get(resolved) || 0n;
            map.set(resolved, count + 1n);
            return map;
        },
        (map: Map<bigint, bigint>): bigint => {
            let maxCount: bigint = 0n;
            let mode: bigint = 0n;
            for (let [key, value] of map) {
                if (value > maxCount) {
                    maxCount = value;
                    mode = key;
                }
            }
            return mode;
        }
    ) as AsynchronousCollector<bigint, Map<bigint, bigint>, bigint> | AsynchronousCollector<E, Map<bigint, bigint>, bigint>;
};

interface UseAsynchronousNumericVariance {
    <E>(): AsynchronousCollector<E, VarianceAccumulator, number>;
    <E>(mapper: Functional<E, number>): AsynchronousCollector<E, VarianceAccumulator, number>;
};
interface VarianceAccumulator {
    summate: number;
    summateOfSquares: number;
    count: number;
};
export let useAsynchronousNumericVariance: UseAsynchronousNumericVariance = <E>(mapper: Functional<E, number> = useToNumber): AsynchronousCollector<number, VarianceAccumulator, number> | AsynchronousCollector<E, VarianceAccumulator, number> => {
    return AsynchronousCollector.full(
        (): VarianceAccumulator => {
            return {
                summate: 0,
                summateOfSquares: 0,
                count: 0
            };
        },
        (accumulator: VarianceAccumulator, element: number | E): VarianceAccumulator => {
            let resolved: number = isNumber(element) ? element : mapper(element);
            return {
                summate: accumulator.summate + (isNumber(resolved) ? resolved : 0),
                summateOfSquares: accumulator.summateOfSquares + (isNumber(resolved) ? Math.pow(resolved, 2) : 0),
                count: accumulator.count + 1
            };
        },
        (result: VarianceAccumulator): number => {
            if (result.count < 2) {
                return 0;
            }
            let mean: number = result.summate / result.count;
            let variance: number = (result.summateOfSquares / result.count) - Math.pow(mean, 2);
            return variance;
        }
    ) as AsynchronousCollector<number, VarianceAccumulator, number> | AsynchronousCollector<E, VarianceAccumulator, number>;
};

interface UseAsynchronousBigIntVariance {
    <E>(): AsynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
    <E>(mapper: Functional<E, bigint>): AsynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
};
interface BigIntVarianceAccumulator {
    summate: bigint;
    summateOfSquares: bigint;
    count: bigint;
};
export let useAsynchronousBigIntVariance: UseAsynchronousBigIntVariance = <E>(mapper: Functional<E, bigint> = useToBigInt): AsynchronousCollector<bigint, BigIntVarianceAccumulator, bigint> | AsynchronousCollector<E, BigIntVarianceAccumulator, bigint> => {
    return AsynchronousCollector.full(
        (): BigIntVarianceAccumulator => {
            return {
                summate: 0n,
                summateOfSquares: 0n,
                count: 0n
            };
        },
        (accumulator: BigIntVarianceAccumulator, element: bigint | E): BigIntVarianceAccumulator => {
            let resolved: bigint = isBigInt(element) ? element : mapper(element);
            return {
                summate: accumulator.summate + (isBigInt(resolved) ? resolved : 0n),
                summateOfSquares: accumulator.summateOfSquares + (isBigInt(resolved) ? resolved * resolved : 0n),
                count: accumulator.count + 1n
            };
        },
        (result: BigIntVarianceAccumulator): bigint => {
            if (result.count < 2n) {
                return 0n;
            }
            let mean: bigint = result.summate / result.count;
            let variance: bigint = (result.summateOfSquares / result.count) - (mean * mean);
            return variance;
        }
    ) as AsynchronousCollector<bigint, BigIntVarianceAccumulator, bigint> | AsynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
};

interface UseAsynchronousNumericStandardDeviation {
    <E>(): AsynchronousCollector<E, StandardDeviationAccumulator, number>;
    <E>(mapper: Functional<E, number>): AsynchronousCollector<E, StandardDeviationAccumulator, number>;
};
interface StandardDeviationAccumulator {
    summate: number;
    summateOfSquares: number;
    count: number;
};
export let useAsynchronousNumericStandardDeviation: UseAsynchronousNumericStandardDeviation = <E>(mapper: Functional<E, number> = useToNumber): AsynchronousCollector<number, StandardDeviationAccumulator, number> | AsynchronousCollector<E, StandardDeviationAccumulator, number> => {
    return AsynchronousCollector.full(
        (): StandardDeviationAccumulator => {
            return {
                summate: 0,
                summateOfSquares: 0,
                count: 0
            };
        },
        (accumulator: StandardDeviationAccumulator, element: number | E): StandardDeviationAccumulator => {
            let resolved: number = isNumber(element) ? element : mapper(element);
            return {
                summate: accumulator.summate + (isNumber(resolved) ? resolved : 0),
                summateOfSquares: accumulator.summateOfSquares + (isNumber(resolved) ? Math.pow(resolved, 2) : 0),
                count: accumulator.count + 1
            };
        },
        (result: StandardDeviationAccumulator): number => {
            if (result.count < 2) {
                return 0;
            }
            let mean: number = result.summate / result.count;
            let variance: number = (result.summateOfSquares / result.count) - Math.pow(mean, 2);
            let standardDeviation: number = Math.sqrt(variance);
            return standardDeviation;
        }
    ) as AsynchronousCollector<number, StandardDeviationAccumulator, number> | AsynchronousCollector<E, StandardDeviationAccumulator, number>;
};

interface UseAsynchronousBigIntStandardDeviation {
    <E>(): AsynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
    <E>(mapper: Functional<E, bigint>): AsynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
};
interface BigIntStandardDeviationAccumulator {
    summate: bigint;
    summateOfSquares: bigint;
    count: bigint;
};
export let useAsynchronousBigIntStandardDeviation: UseAsynchronousBigIntStandardDeviation = <E>(mapper: Functional<E, bigint> = useToBigInt): AsynchronousCollector<bigint, BigIntStandardDeviationAccumulator, bigint> | AsynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint> => {
    return AsynchronousCollector.full(
        (): BigIntStandardDeviationAccumulator => {
            return {
                summate: 0n,
                summateOfSquares: 0n,
                count: 0n
            };
        },
        (accumulator: BigIntStandardDeviationAccumulator, element: bigint | E): BigIntStandardDeviationAccumulator => {
            let resolved: bigint = isBigInt(element) ? element : mapper(element);
            return {
                summate: accumulator.summate + (isBigInt(resolved) ? resolved : 0n),
                summateOfSquares: accumulator.summateOfSquares + (isBigInt(resolved) ? resolved * resolved : 0n),
                count: accumulator.count + 1n
            };
        },
        (result: BigIntStandardDeviationAccumulator): bigint => {
            if (result.count < 2n) {
                return 0n;
            }
            let mean: bigint = result.summate / result.count;
            let variance: bigint = (result.summateOfSquares / result.count) - (mean * mean);
            let standardDeviation: bigint = BigInt(Math.sqrt(Number(variance)));
            return standardDeviation;
        }
    ) as AsynchronousCollector<bigint, BigIntStandardDeviationAccumulator, bigint> | AsynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
};

interface UseAsynchronousNumericMedian {
    <E>(): AsynchronousCollector<E, number[], number>;
    <E>(mapper: Functional<E, number>): AsynchronousCollector<E, number[], number>;
};
export let useAsynchronousNumericMedian: UseAsynchronousNumericMedian = <E>(mapper: Functional<E, number> = useToNumber): AsynchronousCollector<number, number[], number> | AsynchronousCollector<E, number[], number> => {
    return AsynchronousCollector.full(
        (): number[] => [],
        (array: number[], element: number | E): number[] => {
            let resolved: number = isNumber(element) ? element : mapper(element);
            array.push(resolved);
            array.sort((a: number, b: number): number => a - b);
            return array;
        },
        (array: number[]): number => {
            let length: number = array.length;
            if (length % 2 === 0) {
                let mid: number = length / 2;
                return (array[mid - 1] + array[mid]) / 2;
            } else {
                let mid: number = Math.floor(length / 2);
                return array[mid];
            }
        }
    ) as AsynchronousCollector<number, number[], number> | AsynchronousCollector<E, number[], number>;
};

interface UseAsynchronousBigIntMedian {
    <E>(): AsynchronousCollector<E, bigint[], bigint>;
    <E>(mapper: Functional<E, bigint>): AsynchronousCollector<E, bigint[], bigint>;
};
export let useAsynchronousBigIntMedian: UseAsynchronousBigIntMedian = <E>(mapper: Functional<E, bigint> = useToBigInt): AsynchronousCollector<bigint, bigint[], bigint> | AsynchronousCollector<E, bigint[], bigint> => {
    return AsynchronousCollector.full(
        (): bigint[] => [],
        (array: bigint[], element: bigint | E): bigint[] => {
            let resolved: bigint = isBigInt(element) ? element : mapper(element);
            array.push(resolved);
            array.sort((a: bigint, b: bigint): number => Number(a - b));
            return array;
        },
        (array: bigint[]): bigint => {
            let length: number = array.length;
            if (length % 2 === 0) {
                let mid: number = length / 2;
                return (array[Number(mid - 1)] + array[mid]) / 2n;
            } else {
                let mid: number = Math.floor(length / 2);
                return array[mid];
            }
        }
    ) as AsynchronousCollector<bigint, bigint[], bigint> | AsynchronousCollector<E, bigint[], bigint>;
};

export let useAsynchronousToGeneratorFunction: <E>() => AsynchronousCollector<E, Array<E>, globalThis.Generator<E, void, undefined>> = <E>(): AsynchronousCollector<E, Array<E>, globalThis.Generator<E, void, undefined>> => {
    return AsynchronousCollector.full(
        (): Array<E> => [],
        (array: Array<E>, element: E): Array<E> => {
            array.push(element);
            return array;
        },
        (array: Array<E>): globalThis.Generator<E, void, undefined> => {
            return (function* () {
                for (let element of array) {
                    yield element;
                }
            })();
        }
    );
};

export let useAsynchronousToAsyncGeneratorFunction: <E>() => AsynchronousCollector<E, Array<E>, globalThis.AsyncGenerator<E, void, undefined>> = <E>(): AsynchronousCollector<E, Array<E>, globalThis.AsyncGenerator<E, void, undefined>> => {
    return AsynchronousCollector.full(
        (): Array<E> => [],
        (array: Array<E>, element: E): Array<E> => {
            array.push(element);
            return array;
        },
        (array: Array<E>): globalThis.AsyncGenerator<E, void, undefined> => {
            return (async function* () {
                for (let element of array) {
                    yield element;
                }
            })();
        }
    );
};