
import { isFunction, isNumber, isBigInt, isBoolean, isString, isObject, isAsyncFunction, isIterable } from "../guard";
import { useCompare, useToBigInt, useToNumber } from "../hook";
import { Optional } from "../optional";
import { SynchronousCollectorSymbol } from "../symbol";
import type { BiFunctional, BiPredicate, Functional, Predicate, Supplier, TriFunctional, TriPredicate, Consumer, BiConsumer, Comparator, SynchronousGenerator, MaybeInvalid } from "../utility";
import { invalidate, validate } from "../utility";

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
        } else {
            throw new TypeError("Invalid arguments");
        }
    }

    public collect(generator: SynchronousGenerator<E>): R;
    public collect(iterable: Iterable<E>): R;
    public collect(start: number, end: number): R;
    public collect(start: bigint, end: bigint): R;
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
            } catch (error) {
                throw error;
            }

        } else if (isIterable(argument1)) {
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
            } catch (error) {
                throw error;
            }
        } else if (isNumber(argument1) && isNumber(argument2)) {
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
            } catch (error) {
                throw error;
            }
        } else if (isBigInt(argument1) && isBigInt(argument2)) {
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
            } catch (error) {
                throw error;
            }
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

    public static full<E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    public static full<E, A, R>(identity: Supplier<A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    public static full<E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R> {
        return new SynchronousCollector(identity, () => false, accumulator, finisher);
    }

    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>
    public static shortable<E, A, R>(identity: Supplier<A>, interrupt: Predicate<E> | BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R> {
        return new SynchronousCollector<E, A, R>(identity, interrupt, accumulator, finisher);
    }
};

interface UseSynchronousAnyMatch {
    <E>(predicate: Predicate<E>): SynchronousCollector<E, boolean, boolean>;
    <E>(predicate: BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean>;
};
export let useSynchronousAnyMatch: UseSynchronousAnyMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return SynchronousCollector.shortable(
            (): boolean => false,
            (_element: E, _index: bigint, accumulator: boolean): boolean => isBoolean(accumulator) && accumulator,
            (accumulator: boolean, element: E, index: bigint): boolean => accumulator || predicate(element, index),
            (accumulator: boolean): boolean => accumulator
        );
    }
    throw new TypeError("Predicate must be a function.");
};

interface UseSynchronousAllMatch {
    <E>(predicate: Predicate<E>): SynchronousCollector<E, boolean, boolean>;
    <E>(predicate: BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean>;
};
export let useSynchronousAllMatch: UseSynchronousAllMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return SynchronousCollector.shortable(
            (): boolean => true,
            (_element: E, _index: bigint, accumulator: boolean): boolean => isBoolean(accumulator) && !accumulator,
            (accumulator: boolean, element: E, index: bigint): boolean => accumulator && predicate(element, index),
            (accumulator: boolean): boolean => accumulator
        );
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
};
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

export let useSynchronousCount: <E = unknown>() => SynchronousCollector<E, bigint, bigint> = <E = unknown>(): SynchronousCollector<E, bigint, bigint> => {
    return SynchronousCollector.full(
        (): bigint => 0n,
        (count: bigint): bigint => isBigInt(count) ? (count + 1n) : 1n,
        (count: bigint): bigint => isBigInt(count) ? count : 0n
    );
};

interface UseSynchronousError {
    <E = unknown>(): SynchronousCollector<E, string, string>;
    <E = unknown>(accumulator: BiFunctional<string, E, string>): SynchronousCollector<E, string, string>;
    <E = unknown>(accumulator: TriFunctional<string, E, bigint, string>): SynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): SynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): SynchronousCollector<E, string, string>;
};
export let useSynchronousError: UseSynchronousError = <E = unknown>(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): SynchronousCollector<E, string, string> => {
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return SynchronousCollector.full<E, string, string>(
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
        return SynchronousCollector.full<E, string, string>(
            (): string => prefix,
            accumulator,
            (text: string): string => {
                let result: string = text + suffix;
                console.error(result);
                return result;
            }
        );
    } else {
        return SynchronousCollector.full<E, string, string>(
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

interface UseSynchronousFindAt {
    <E>(index: number): SynchronousCollector<E, Optional<E>, Optional<E>>;
    <E>(index: bigint): SynchronousCollector<E, Optional<E>, Optional<E>>;
};
export let useSynchronousFindAt: UseSynchronousFindAt = <E>(index: number | bigint): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    let target: bigint = useToBigInt(index);
    if(target < 0n){
        throw new Error("use \"useSynchronousFindNegativeAt\" for negative index.");
    }
    return SynchronousCollector.shortable(
        Optional.empty,
        (_element: E, _index: bigint, accumulator: Optional<E>): boolean => accumulator.isPresent(),
        (accumulator: Optional<E>, element: E, index: bigint): Optional<E> => {
            if (index === target) {
                return Optional.of(element);
            }
            return accumulator;
        },
        (accumulator: Optional<E>): Optional<E> => accumulator
    );
};

interface UseSynchronousFindNegativeAt {
    <E>(index: number): SynchronousCollector<E, Array<E>, Optional<E>>;
    <E>(index: bigint): SynchronousCollector<E, Array<E>, Optional<E>>;
};
export let useSynchronousFindNegativeAt: UseSynchronousFindNegativeAt = <E>(index: number | bigint): SynchronousCollector<E, Array<E>, Optional<E>> => {
    let target: bigint = useToBigInt(index);
    if(target > -1n){
        throw new Error("use \"useSynchronousFindAt\" for none-negative index.");
    }
    return SynchronousCollector.full(
        () => [],
        (accumulator: Array<E>, element: E): Array<E> => {
            accumulator.push(element);
            return accumulator;
        },
        (accumulator: Array<E>): Optional<E> => {
            if(accumulator.length > 0){
                let count: bigint = BigInt(accumulator.length);
                let limit: bigint = ((target % count) + count) % count;
                let element: MaybeInvalid<E> = accumulator.at(Number(limit));
                return Optional.of(element);
            }
            return Optional.empty();
        }
    );
};

export let useSynchronousFindFirst: <E>() => SynchronousCollector<E, Optional<E>, Optional<E>> = <E>(): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    return SynchronousCollector.shortable(
        (): Optional<E> => Optional.empty<E>(),
        (_element: E, _index: bigint, accumulator: Optional<E>): boolean => validate(accumulator) && accumulator.isPresent(),
        (accumulator: Optional<E>, element: E): Optional<E> => {
            if (validate(accumulator) && accumulator.isPresent() && validate(element)) {
                return Optional.of(element);
            }
            return accumulator;
        },
        (result: Optional<E>): Optional<E> => result);
};

export let useSynchronousFindAny: <E>() => SynchronousCollector<E, Optional<E>, Optional<E>> = <E>(): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    return SynchronousCollector.shortable(
        (): Optional<E> => Optional.empty<E>(),
        (_element: E, _index: bigint, accumulator: Optional<E>): boolean => validate(accumulator) && accumulator.isPresent(),
        (accumulator: Optional<E>, element: E): Optional<E> => {
            if (validate(accumulator) && accumulator.isPresent() && validate(element) && Math.random() < 0.5) {
                return Optional.of(element);
            }
            return accumulator;
        },
        (result: Optional<E>): Optional<E> => result);
};

export let useSynchronousFindLast: <E>() => SynchronousCollector<E, Optional<E>, Optional<E>> = <E>(): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    return SynchronousCollector.full(
        (): Optional<E> => Optional.empty<E>(),
        (accumulator: Optional<E>, element: E): Optional<E> => {
            if (validate(accumulator) && accumulator.isPresent() && validate(element)) {
                return Optional.of(element);
            }
            return accumulator;
        },
        (result: Optional<E>): Optional<E> => result);
};

interface UseSynchronousFindMaximum {
    <E>(): SynchronousCollector<E, Optional<E>, Optional<E>>;
    <E>(comparator: Comparator<E>): SynchronousCollector<E, Optional<E>, Optional<E>>;
}
export let useSynchronousFindMaximum: UseSynchronousFindMaximum = <E>(comparator: Comparator<E> = useCompare<E>): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    if (isFunction(comparator)) {
        return SynchronousCollector.full(
            (): Optional<E> => Optional.empty<E>(),
            (accumulator: Optional<E>, element: E): Optional<E> => {
                if (validate(accumulator) && accumulator.isPresent()) {
                    return accumulator.map((previous: E): E => {
                        return comparator(previous, element) > 0 ? previous : element;
                    });
                }
                return accumulator;
            },
            (result: Optional<E>): Optional<E> => result);
    }
    throw new TypeError("Invalid argument.");
};

interface UseSynchronousFindMinimum {
    <E>(): SynchronousCollector<E, Optional<E>, Optional<E>>;
    <E>(comparator: Comparator<E>): SynchronousCollector<E, Optional<E>, Optional<E>>;
}
export let useSynchronousFindMinimum: UseSynchronousFindMinimum = <E>(comparator: Comparator<E> = useCompare<E>): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    if (isFunction(comparator)) {
        return SynchronousCollector.full(
            (): Optional<E> => Optional.empty<E>(),
            (accumulator: Optional<E>, element: E): Optional<E> => {
                if (validate(accumulator) && accumulator.isPresent()) {
                    return accumulator.map((previous: E): E => {
                        return comparator(previous, element) < 0 ? previous : element;
                    });
                }
                return accumulator;
            },
            (result: Optional<E>): Optional<E> => result);
    }
    throw new TypeError("Invalid argument.");
};

interface UseSynchronousForEach {
    <E>(action: Consumer<E>): SynchronousCollector<E, bigint, bigint>;
    <E>(action: BiConsumer<E, bigint>): SynchronousCollector<E, bigint, bigint>;
};
export let useSynchronousForEach: UseSynchronousForEach = <E>(action: Consumer<E> | BiConsumer<E, bigint>): SynchronousCollector<E, bigint, bigint> => {
    if (isFunction(action)) {
        return SynchronousCollector.full(
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

interface UseSynchronousNonMatch {
    <E>(predicate: Predicate<E>): SynchronousCollector<E, boolean, boolean>;
    <E>(predicate: BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean>;
};
export let useSynchronousNoneMatch: UseSynchronousNonMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return SynchronousCollector.shortable(
            (): boolean => true,
            (_element: E, _index: bigint, accumulator: boolean): boolean => !accumulator,
            (accumulator: boolean, element: E, index: bigint): boolean => accumulator && !predicate(element, index),
            (accumulator: boolean): boolean => !accumulator
        );
    }
    throw new TypeError("Predicate must be a function.");
};

interface UseSynchronousGroup {
    <E, K>(classifier: Functional<E, K>): SynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
    <E, K>(classifier: BiFunctional<E, bigint, K>): SynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
};
export let useSynchronousGroup: UseSynchronousGroup = <E, K>(classifier: Functional<E, K> | BiFunctional<E, bigint, K>): SynchronousCollector<E, Map<K, E[]>, Map<K, E[]>> => {
    if (isFunction(classifier)) {
        return SynchronousCollector.full(
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

interface UseSynchronousGroupBy {
    <E, K>(keyExtractor: Functional<E, K>): SynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousCollector<E, Map<K, V[]>, Map<K, V[]>>;
    <E, K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): SynchronousCollector<E, Map<K, V[]>, Map<K, V[]>>;
}
export let useSynchronousGroupBy: UseSynchronousGroupBy = <E, K, V = E>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E) => element as unknown as V): SynchronousCollector<E, Map<K, V[]>, Map<K, V[]>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return SynchronousCollector.full(
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

interface UseSynchronousJoin {
    <E = unknown>(): SynchronousCollector<E, string, string>;
    <E = unknown>(delimiter: string): SynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, delimiter: string, suffix: string): SynchronousCollector<E, string, string>;
    <E = unknown>(prefiex: string, accumulator: BiFunctional<string, E, string>, suffix: string): SynchronousCollector<E, string, string>;
    <E = unknown>(prefiex: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): SynchronousCollector<E, string, string>
};
export let useSynchronousJoin: UseSynchronousJoin = <E = unknown>(argument1?: string, argument2?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): SynchronousCollector<E, string, string> => {
    if (invalidate(argument1) && invalidate(argument2) && invalidate(argument3)) {
        return SynchronousCollector.full<E, string, string>(
            (): string => "[",
            (text: string, element: E): string => text + element + ",",
            (text: string): string => text.substring(0, text.length - 1) + "]"
        );
    }
    if (isString(argument1) && invalidate(argument2) && invalidate(argument3)) {
        let delimiter: string = argument1;
        return SynchronousCollector.full<E, string, string>(
            (): string => "[",
            (text: string, element: E): string => text + element + delimiter,
            (text: string): string => text.substring(0, text.length - delimiter.length) + "]"
        );
    }
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return SynchronousCollector.full<E, string, string>(
            (): string => prefix,
            accumulator,
            (text: string): string => text + suffix
        );
    }
    if (isString(argument1) && isString(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let delimiter: string = argument2;
        let suffix: string = argument3;
        return SynchronousCollector.full<E, string, string>(
            (): string => prefix,
            (text: string, element: E): string => text + element + delimiter,
            (text: string): string => text + suffix
        );
    }
    throw new TypeError("Invalid arguments.");
};

interface UseSynchronousLog {
    <E = unknown>(): SynchronousCollector<E, string, string>;
    <E = unknown>(accumulator: BiFunctional<string, E, string>): SynchronousCollector<E, string, string>;
    <E = unknown>(accumulator: TriFunctional<string, E, bigint, string>): SynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): SynchronousCollector<E, string, string>;
    <E = unknown>(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): SynchronousCollector<E, string, string>;
};

export let useSynchronousLog: UseSynchronousLog = <E = unknown>(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): SynchronousCollector<E, string, string> => {
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return SynchronousCollector.full<E, string, string>(
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
        return SynchronousCollector.full<E, string, string>(
            (): string => prefix,
            accumulator,
            (text: string): string => {
                let result: string = text + suffix;
                console.log(result);
                return result;
            }
        );
    } else {
        return SynchronousCollector.full<E, string, string>(
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

export let useSynchronousPartition: <E>(count: bigint) => SynchronousCollector<E, Array<Array<E>>, Array<Array<E>>> = <E>(count: bigint): SynchronousCollector<E, Array<Array<E>>, Array<Array<E>>> => {
    if (isBigInt(count)) {
        let limited = count > 1n ? count : 1n;
        return SynchronousCollector.full(
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

interface UseSynchronousPartitionBy {
    <E>(classifier: Functional<E, bigint>): SynchronousCollector<E, Array<E[]>, Array<E[]>>;
    <E>(classifier: BiFunctional<E, bigint, bigint>): SynchronousCollector<E, Array<E[]>, Array<E[]>>;
};
export let useSynchronousPartitionBy: UseSynchronousPartitionBy = <E>(classifier: Functional<E, bigint> | BiFunctional<E, bigint, bigint>): SynchronousCollector<E, Array<E[]>, Array<E[]>> => {
    if (isFunction(classifier)) {
        return SynchronousCollector.full(
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

interface UseSynchronousReduce {
    <E>(accumulator: BiFunctional<E, E, E>): SynchronousCollector<E, Optional<E>, Optional<E>>;
    <E>(accumulator: TriFunctional<E, E, bigint, E>): SynchronousCollector<E, Optional<E>, Optional<E>>;
    <E>(identity: E, accumulator: BiFunctional<E, E, E>): SynchronousCollector<E, E, E>;
    <E>(identity: E, accumulator: TriFunctional<E, E, bigint, E>): SynchronousCollector<E, E, E>;
    <E, R>(identity: R, accumulator: BiFunctional<R, E, R>, finisher: Functional<R, R>): SynchronousCollector<E, R, R>;
    <E, R>(identity: R, accumulator: TriFunctional<R, E, bigint, R>, finisher: Functional<R, R>): SynchronousCollector<E, R, R>;
};

export let useSynchronousReduce: UseSynchronousReduce = <E, R>(argument1?: R | E | BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E>, argument2?: BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E> | BiFunctional<R, E, R> | TriFunctional<R, E, bigint, R>, argument3?: Functional<R, R>): SynchronousCollector<E, Optional<E>, Optional<E>> | SynchronousCollector<E, E, E> | SynchronousCollector<E, R, R> => {
    if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
        let accumulator: BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E> = argument1 as BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E>;
        return SynchronousCollector.full<E, Optional<E>, Optional<E>>(
            (): Optional<E> => Optional.empty<E>(),
            (result: Optional<E>, element: E, index: bigint): Optional<E> => {
                if (validate(result) && result.isPresent()) {
                    return result.map((previous: E): E => accumulator(previous, element, index));
                }
                return result;
            },
            (result: Optional<E>): Optional<E> => result
        );
    } else if (validate(argument1) && isFunction(argument2) && invalidate(argument3)) {
        let identity = argument1 as E;
        let accumulator: BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E> = argument2 as BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E>;
        return SynchronousCollector.full<E, E, E>(() => identity, accumulator, (result: E): E => result);
    } else if (validate(argument1) && isFunction(argument2) && isFunction(argument3)) {
        let identity = argument1 as R;
        let accumulator: BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R> = argument2 as BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R>;
        let finisher = argument3 as Functional<R, R>;
        return SynchronousCollector.full<E, R, R>(() => identity, accumulator, finisher);
    } else {
        throw new TypeError("Invalid arguments.");
    }
};

export let useSynchronousToArray: <E>() => SynchronousCollector<E, E[], E[]> = <E>(): SynchronousCollector<E, E[], E[]> => {
    return SynchronousCollector.full<E, E[], E[]>(
        (): E[] => [],
        (array: E[], element: E): E[] => {
            array.push(element);
            return array;
        },
        (array: E[]): E[] => array
    );
};

interface UseSynchronousToMap {
    <E, K>(keyExtractor: Functional<E, K>): SynchronousCollector<E, Map<K, E>, Map<K, E>>;
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousCollector<E, Map<K, V>, Map<K, V>>;
    <E, K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): SynchronousCollector<E, Map<K, V>, Map<K, V>>;
};
export let useSynchronousToMap: UseSynchronousToMap = <E, K, V>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): SynchronousCollector<E, Map<K, V>, Map<K, V>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return SynchronousCollector.full<E, Map<K, V>, Map<K, V>>(
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

export let useSynchronousToSet: <E>() => SynchronousCollector<E, Set<E>, Set<E>> = <E>(): SynchronousCollector<E, Set<E>, Set<E>> => {
    return SynchronousCollector.full<E, Set<E>, Set<E>>(
        (): Set<E> => new Set<E>(),
        (set: Set<E>, element: E): Set<E> => {
            set.add(element);
            return set;
        },
        (set: Set<E>): Set<E> => set
    );
};

interface UseSynchronousWrite {
    <E, S = string>(stream: WritableStream<S>): SynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
    <E, S = string>(stream: WritableStream<S>, accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>>): SynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
    <E, S = string>(stream: WritableStream<S>, accumulator: TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): SynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
};

export let useSynchronousWrite: UseSynchronousWrite = <E, S = string>(argument1: WritableStream<S>, argument2?: BiFunctional<WritableStream<S>, E, WritableStream<S>> | TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): SynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>> => {
    if (isObject(argument1)) {
        if (isFunction(argument2)) {
            let stream: WritableStream<S> = argument1 as WritableStream<S>;
            let accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>> = argument2 as BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>;
            return SynchronousCollector.full<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>(
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
            return SynchronousCollector.full<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>(
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

interface UseSynchronousNumericSummate {
    <E>(): SynchronousCollector<E, number, number>;
    <E>(mapper: Functional<E, number>): SynchronousCollector<number, number, number>;
};
export let useSynchronousNumericSummate: UseSynchronousNumericSummate = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, number, number> | SynchronousCollector<E, number, number> => {
    return SynchronousCollector.full(
        (): number => 0,
        (accumulator: number, element: number | E): number => {
            let resolved: number = isNumber(element) ? element : mapper(element);
            return accumulator + (isNumber(resolved) ? resolved : 0);
        },
        (result: number): number => result
    ) as SynchronousCollector<number, number, number> | SynchronousCollector<E, number, number>;
};

interface UseSynchronousBigIntSummate {
    <E>(): SynchronousCollector<E, bigint, bigint>;
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<bigint, bigint, bigint>;
};
export let useSynchronousBigIntSummate: UseSynchronousBigIntSummate = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, bigint, bigint> | SynchronousCollector<E, bigint, bigint> => {
    return SynchronousCollector.full(
        (): bigint => 0n,
        (accumulator: bigint, element: bigint | E): bigint => {
            let resolved: bigint = isBigInt(element) ? element : mapper(element);
            return accumulator + (isBigInt(resolved) ? resolved : 0n);
        },
        (result: bigint): bigint => result
    ) as SynchronousCollector<bigint, bigint, bigint> | SynchronousCollector<E, bigint, bigint>;
};

interface UseSynchronousNumericAverage {
    <E>(): SynchronousCollector<E, NumericAverageAccumulator, number>;
    <E>(mapper: Functional<E, number>): SynchronousCollector<number, NumericAverageAccumulator, number>;
};
interface NumericAverageAccumulator {
    summate: number;
    count: number;
};
export let useSynchronousNumericAverage: UseSynchronousNumericAverage = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, NumericAverageAccumulator, number> | SynchronousCollector<E, NumericAverageAccumulator, number> => {
    return SynchronousCollector.full(
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
    ) as SynchronousCollector<number, NumericAverageAccumulator, number> | SynchronousCollector<E, NumericAverageAccumulator, number>;
};

interface UseSynchronousBigIntAverage {
    <E>(): SynchronousCollector<E, BigIntAverageAccumulator, bigint>;
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, BigIntAverageAccumulator, bigint>;
};
interface BigIntAverageAccumulator {
    summate: bigint;
    count: bigint;
};
export let useSynchronousBigIntAverage: UseSynchronousBigIntAverage = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, BigIntAverageAccumulator, bigint> | SynchronousCollector<E, BigIntAverageAccumulator, bigint> => {
    return SynchronousCollector.full(
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
    ) as SynchronousCollector<bigint, BigIntAverageAccumulator, bigint> | SynchronousCollector<E, BigIntAverageAccumulator, bigint>;
};

export let useSynchronousFrequency: <E>() => SynchronousCollector<E, Map<E, bigint>, Map<E, bigint>> = <E>(): SynchronousCollector<E, Map<E, bigint>, Map<E, bigint>> => {
    return SynchronousCollector.full(
        (): Map<E, bigint> => new Map<E, bigint>(),
        (map: Map<E, bigint>, element: E): Map<E, bigint> => {
            let count: bigint = map.get(element) || 0n;
            map.set(element, count + 1n);
            return map;
        },
        (map: Map<E, bigint>): Map<E, bigint> => map
    );
};

interface UseSynchronousNumericMode {
    <E>(): SynchronousCollector<E, Map<number, bigint>, number>;
    <E>(mapper: Functional<E, number>): SynchronousCollector<E, Map<number, bigint>, number>;
};
export let useSynchronousNumericMode: UseSynchronousNumericMode = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, Map<number, bigint>, number> | SynchronousCollector<E, Map<number, bigint>, number> => {
    return SynchronousCollector.full(
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
    ) as SynchronousCollector<number, Map<number, bigint>, number> | SynchronousCollector<E, Map<number, bigint>, number>;
};

interface UseSynchronousBigIntMode {
    <E>(): SynchronousCollector<E, Map<bigint, bigint>, bigint>;
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, Map<bigint, bigint>, bigint>;
};
export let useSynchronousBigIntMode: UseSynchronousBigIntMode = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, Map<bigint, bigint>, bigint> | SynchronousCollector<E, Map<bigint, bigint>, bigint> => {
    return SynchronousCollector.full(
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
    ) as SynchronousCollector<bigint, Map<bigint, bigint>, bigint> | SynchronousCollector<E, Map<bigint, bigint>, bigint>;
};

interface UseSynchronousNumericVariance {
    <E>(): SynchronousCollector<E, VarianceAccumulator, number>;
    <E>(mapper: Functional<E, number>): SynchronousCollector<E, VarianceAccumulator, number>;
};
interface VarianceAccumulator {
    summate: number;
    summateOfSquares: number;
    count: number;
};
export let useSynchronousNumericVariance: UseSynchronousNumericVariance = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, VarianceAccumulator, number> | SynchronousCollector<E, VarianceAccumulator, number> => {
    return SynchronousCollector.full(
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
    ) as SynchronousCollector<number, VarianceAccumulator, number> | SynchronousCollector<E, VarianceAccumulator, number>;
};

interface UseSynchronousBigIntVariance {
    <E>(): SynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
};
interface BigIntVarianceAccumulator {
    summate: bigint;
    summateOfSquares: bigint;
    count: bigint;
};
export let useSynchronousBigIntVariance: UseSynchronousBigIntVariance = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, BigIntVarianceAccumulator, bigint> | SynchronousCollector<E, BigIntVarianceAccumulator, bigint> => {
    return SynchronousCollector.full(
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
    ) as SynchronousCollector<bigint, BigIntVarianceAccumulator, bigint> | SynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
};

interface UseSynchronousNumericStandardDeviation {
    <E>(): SynchronousCollector<E, StandardDeviationAccumulator, number>;
    <E>(mapper: Functional<E, number>): SynchronousCollector<E, StandardDeviationAccumulator, number>;
};
interface StandardDeviationAccumulator {
    summate: number;
    summateOfSquares: number;
    count: number;
};
export let useSynchronousNumericStandardDeviation: UseSynchronousNumericStandardDeviation = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, StandardDeviationAccumulator, number> | SynchronousCollector<E, StandardDeviationAccumulator, number> => {
    return SynchronousCollector.full(
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
    ) as SynchronousCollector<number, StandardDeviationAccumulator, number> | SynchronousCollector<E, StandardDeviationAccumulator, number>;
};

interface UseSynchronousBigIntStandardDeviation {
    <E>(): SynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
};
interface BigIntStandardDeviationAccumulator {
    summate: bigint;
    summateOfSquares: bigint;
    count: bigint;
};
export let useSynchronousBigIntStandardDeviation: UseSynchronousBigIntStandardDeviation = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, BigIntStandardDeviationAccumulator, bigint> | SynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint> => {
    return SynchronousCollector.full(
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
    ) as SynchronousCollector<bigint, BigIntStandardDeviationAccumulator, bigint> | SynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
};

interface UseSynchronousNumericMedian {
    <E>(): SynchronousCollector<E, number[], number>;
    <E>(mapper: Functional<E, number>): SynchronousCollector<E, number[], number>;
};
export let useSynchronousNumericMedian: UseSynchronousNumericMedian = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, number[], number> | SynchronousCollector<E, number[], number> => {
    return SynchronousCollector.full(
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
    ) as SynchronousCollector<number, number[], number> | SynchronousCollector<E, number[], number>;
};

interface UseSynchronousBigIntMedian {
    <E>(): SynchronousCollector<E, bigint[], bigint>;
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, bigint[], bigint>;
};
export let useSynchronousBigIntMedian: UseSynchronousBigIntMedian = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, bigint[], bigint> | SynchronousCollector<E, bigint[], bigint> => {
    return SynchronousCollector.full(
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
    ) as SynchronousCollector<bigint, bigint[], bigint> | SynchronousCollector<E, bigint[], bigint>;
};

export let useSynchronousToGeneratorFunction: <E>() => SynchronousCollector<E, Array<E>, globalThis.Generator<E, void, undefined>> = <E>(): SynchronousCollector<E, Array<E>, globalThis.Generator<E, void, undefined>> => {
    return SynchronousCollector.full(
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

export let useSynchronousToAsyncGeneratorFunction: <E>() => SynchronousCollector<E, Array<E>, globalThis.AsyncGenerator<E, void, undefined>> = <E>(): SynchronousCollector<E, Array<E>, globalThis.AsyncGenerator<E, void, undefined>> => {
    return SynchronousCollector.full(
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