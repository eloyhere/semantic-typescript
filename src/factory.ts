import { AsynchronousSemantic } from "./asynchronous/semantic.js";
import { isBigInt, isFunction, isIterable, isNumber, isObject, isPromise, isAsyncIterable, isString } from "./guard.js";
import { useCompare, useToBigInt, useToNumber, useTraverse } from "./hook.js";
import { SynchronousSemantic } from "./synchronous/semantic.js";
import { invalidate, validate } from "./utility.js";
import type { BiPredicate, Predicate, Supplier, Consumer, BiConsumer, DeepPropertyKey, DeepPropertyValue, Runnable } from "./utility.js";

interface Attribute<T> {
    key: keyof T;
    value: T[keyof T];
};
export let useAttribute: <T extends object>(target: T) => SynchronousSemantic<Attribute<T>> = <T extends object>(target: T): SynchronousSemantic<Attribute<T>> => {
    if (isObject(target)) {
        return new SynchronousSemantic<Attribute<T>>((accept: Consumer<Attribute<T>> | BiConsumer<Attribute<T>, bigint>, interrupt: Predicate<Attribute<T>> | BiPredicate<Attribute<T>, bigint>): void => {
            try {
                let index: bigint = 0n;
                useTraverse(target, (key: DeepPropertyKey<T>, value: DeepPropertyValue<T>): boolean => {
                    let attribute: Attribute<T> = {
                        key: key as keyof T,
                        value: value as T[keyof T]
                    } as Attribute<T>;
                    if (interrupt(attribute, index)) {
                        return false;
                    }
                    accept(attribute, index);
                    index++;
                    return true;
                });
            } catch (error) {
                throw error;
            }
        });
    }
    throw new TypeError("Target must be an object.");
};

interface UseBlob {
    (blob: Blob): AsynchronousSemantic<Uint8Array>;
    (blob: Blob, chunk: bigint): AsynchronousSemantic<Uint8Array>;
};
export let useBlob: UseBlob = (blob: Blob, chunk: bigint = 64n * 1024n): AsynchronousSemantic<Uint8Array> => {
    let size: number = Number(chunk);
    if (size <= 0 || !Number.isSafeInteger(size)) {
        throw new RangeError("Chunk size must be a safe positive integer.");
    }
    if (invalidate(blob)) {
        throw new TypeError("Blob is invalid.");
    }
    // 读取过程本身是异步的，必须返回异步语义，否则同步收集器会得到空结果
    return new AsynchronousSemantic<Uint8Array>(async (accept: Consumer<Uint8Array> | BiConsumer<Uint8Array, bigint>, interrupt: Predicate<Uint8Array> | BiPredicate<Uint8Array, bigint>): Promise<void> => {
        let index: bigint = 0n;
        let stoppable: boolean = false;
        let stream: ReadableStream<Uint8Array> = blob.stream();
        let reader: ReadableStreamDefaultReader<Uint8Array> = stream.getReader();
        let buffer: Uint8Array = new Uint8Array(size);
        let offset: number = 0;
        try {
            while (!stoppable) {
                let { done, value } = await reader.read();
                if (done) {
                    if (offset > 0) {
                        // 必须拷贝，否则所有分块都会指向同一块被后续写入覆盖的内存
                        let element: Uint8Array = buffer.slice(0, offset);
                        if (interrupt(element, index)) {
                            stoppable = true;
                        } else {
                            accept(element, index);
                            index++;
                        }
                    }
                    break;
                }
                let chunkData: Uint8Array = value as Uint8Array;
                let position: number = 0;
                while (position < chunkData.length && !stoppable) {
                    let space: number = size - offset;
                    let toCopy: number = Math.min(space, chunkData.length - position);
                    buffer.set(chunkData.subarray(position, position + toCopy), offset);
                    offset += toCopy;
                    position += toCopy;

                    if (offset === size) {
                        let element: Uint8Array = buffer.slice(0, size);
                        if (interrupt(element, index)) {
                            stoppable = true;
                        } else {
                            accept(element, index);
                            index++;
                        }
                        offset = 0;
                    }
                }
            }
        } finally {
            if (stoppable) {
                await reader.cancel();
            }
            reader.releaseLock();
        }
    });
};

export let useEmpty: <E>() => SynchronousSemantic<E> = <E>(): SynchronousSemantic<E> => {
    return new SynchronousSemantic<E>(() => { });
};

interface UseFill {
    <E>(element: E, count: bigint): SynchronousSemantic<E>;
    <E>(supplier: Supplier<E>, count: bigint): SynchronousSemantic<E>;
};
export let useFill: UseFill = <E>(element: E | Supplier<E>, count: bigint): SynchronousSemantic<E> => {
    if (validate(element) && count > 0n) {
        return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>) => {
            try {
                for (let i = 0n; i < count; i++) {
                    let item: E = isFunction(element) ? element() : element;
                    if (interrupt(item, i)) {
                        break;
                    }
                    accept(item, i);
                }
            } catch (error) {
                throw error;
            }
        });
    }
    throw new TypeError("Invalid arguments.");
};

export interface UseFrom {
    <E>(iterable: Iterable<E>): SynchronousSemantic<E>;
    <E>(iterable: AsyncIterable<E>): AsynchronousSemantic<E>;
};
export let useFrom: UseFrom = (<E>(iterable: Iterable<E> | AsyncIterable<E>): SynchronousSemantic<E> | AsynchronousSemantic<E> => {
    if (isIterable(iterable)) {
        return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>) => {
            try {
                let index: bigint = 0n;
                for (let element of iterable) {
                    if (interrupt(element, index)) {
                        break;
                    }
                    accept(element, index);
                    index++;
                }
            } catch (error) {
                throw error;
            }
        });
    } else if (isAsyncIterable(iterable)) {
        // 异步可迭代对象必须交给异步语义，否则同步收集器会在数据到达前就结束，静默返回空结果
        return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            try {
                let index: bigint = 0n;
                for await (let element of iterable) {
                    if (interrupt(element, index)) {
                        break;
                    }
                    accept(element, index);
                    index++;
                }
            } catch (error) {
                throw error;
            }
        });
    }
    throw new TypeError("Invalid arguments");
}) as UseFrom;

interface UseGenerate {
    <E>(supplier: Supplier<E>, interrupt: Predicate<E>): SynchronousSemantic<E>;
    <E>(supplier: Supplier<E>, interrupt: BiPredicate<E, bigint>): SynchronousSemantic<E>;
};
export let useGenerate: UseGenerate = <E>(supplier: Supplier<E>, interrupter: Predicate<E> | BiPredicate<E, bigint>): SynchronousSemantic<E> => {
    if (isFunction(supplier) && isFunction(interrupter)) {
        return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            try {
                let index: bigint = 0n;
                while (true) {
                    let element: E = supplier();
                    // 原实现中用户传入的第二个参数被生成器同名参数遮蔽，导致该判断条件完全失效
                    if (interrupter(element, index) || interrupt(element, index)) {
                        break;
                    }
                    accept(element, index);
                    index++;
                }
            } catch (error) {
                throw error;
            }
        });
    }
    throw new TypeError("Invalid arguments");
};

interface UseInterval {
    (period: number): AsynchronousSemantic<number>;
    (period: number, delay: number): AsynchronousSemantic<number>;
};
export let useInterval: UseInterval = (period: number, delay: number = 0): AsynchronousSemantic<number> => {
    if (period > 0 && delay >= 0) {
        // 数据由定时器异步产生，必须返回异步语义；否则同步收集器会在第一个 tick 之前就结束收集（恒为空）
        return new AsynchronousSemantic<number>((accept: Consumer<number> | BiConsumer<number, bigint>, interrupt: Predicate<number> | BiPredicate<number, bigint>): Promise<void> => {
            return new Promise<void>((resolve: Runnable, reject: Consumer<any>): void => {
                try {
                    let count: number = 0;
                    let index: bigint = 0n;
                    let start: Runnable = (): void => {
                        let timer: ReturnType<typeof setInterval> = setInterval((): void => {
                            // 中断判断必须先于 accept，原实现在 clearInterval 之后仍然 accept，会漏出越界元素
                            if (interrupt(count, index)) {
                                clearInterval(timer);
                                resolve();
                                return;
                            }
                            accept(count, index);
                            index++;
                            count += period;
                        }, period);
                    };
                    if (delay > 0) {
                        setTimeout(start, delay);
                    } else {
                        start();
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });
    }
    throw new TypeError("Invalid arguments.");
};

interface UseIterate {
    <E>(iterable: Iterable<E>): SynchronousSemantic<E>;
    <E>(iterable: AsyncIterable<E>): AsynchronousSemantic<E>;
};
export let useIterate: UseIterate = (<E>(iterable: Iterable<E> | AsyncIterable<E>): SynchronousSemantic<E> | AsynchronousSemantic<E> => {
    if (isIterable(iterable)) {
        return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            try {
                let index: bigint = 0n;
                for (let element of iterable) {
                    if (interrupt(element, index)) {
                        break;
                    }
                    accept(element, index);
                    index++;
                }
            } catch (error) {
                throw error;
            }
        });
    }
    if (isAsyncIterable(iterable)) {
        return new AsynchronousSemantic<E>(async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            return await new Promise<void>(async (resolve: Runnable, reject: Consumer<any>): Promise<void> => {
                try {
                    let index: bigint = 0n;
                    for await (let element of iterable) {
                        if (interrupt(element, index)) {
                            break;
                        }
                        accept(element, index);
                        index++;
                    }
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }
    throw new TypeError("Invalid arguments.");
}) as UseIterate;

interface UsePromise {
    <T>(promise: Promise<T>): AsynchronousSemantic<T>;
};
export let usePromise: UsePromise = <T>(promise: Promise<T>): AsynchronousSemantic<T> => {
    if (isPromise(promise)) {
        return new AsynchronousSemantic<T>(async (accept: Consumer<T> | BiConsumer<T, bigint>, interrupt: Predicate<T> | BiPredicate<T, bigint>): Promise<void> => {
            return new Promise<void>(async (resolve: Runnable, reject: Consumer<any>): Promise<void> => {
                promise.then((value: T): void => {
                    if (interrupt(value, 0n)) {
                        reject(new Error("Promise was interrupted."));
                    } else {
                        accept(value, 0n);
                        resolve();
                    }
                })
            });
        });
    }
    throw new TypeError("Invalid arguments.");
};

export type KeyOfEventMap<EventMap> = keyof EventMap;
export type EventOfEventMap<EventMap, K extends KeyOfEventMap<EventMap> = KeyOfEventMap<EventMap>> = EventMap[K];

export interface Subscriber<T, EventMap> {
    mount(target: T): void;
    subscribe<K extends KeyOfEventMap<EventMap>>(key: K, accept: Consumer<EventOfEventMap<EventMap, K>>): void;
    unsubscribe<K extends KeyOfEventMap<EventMap>>(key: K, accept: Consumer<EventOfEventMap<EventMap, K>>): void;
    unmount(): void;
};
interface UseSubscription {
    <T, EventMap, K extends KeyOfEventMap<EventMap> = KeyOfEventMap<EventMap>>(target: T, subscriber: Supplier<Subscriber<T, EventMap>>, subscription: K): AsynchronousSemantic<EventOfEventMap<EventMap, K>>;
    <T, EventMap, K extends KeyOfEventMap<EventMap> = KeyOfEventMap<EventMap>>(target: T, subscriber: Supplier<Subscriber<T, EventMap>>, subscription: Iterable<K>): AsynchronousSemantic<EventOfEventMap<EventMap, K>>;
};
export let useSubscription: UseSubscription = <T, EventMap, K extends KeyOfEventMap<EventMap>>(argument1: T, argument2: Supplier<Subscriber<T, EventMap>>, argument3: K | Iterable<K>): AsynchronousSemantic<EventOfEventMap<EventMap, K>> => {
    if (isObject(argument1) && isFunction(argument2)) {
        let target: T = argument1;
        try {
            let subscriber: Subscriber<T, EventMap> = argument2();
            if (isString(argument3)) {
                let subscription: K = argument3;
                return new AsynchronousSemantic<EventOfEventMap<EventMap, K>>(async (accept: Consumer<EventOfEventMap<EventMap, K>> | BiConsumer<EventOfEventMap<EventMap, K>, bigint>, interrupt: Predicate<EventOfEventMap<EventMap, K>> | BiPredicate<EventOfEventMap<EventMap, K>, bigint>): Promise<void> => {
                    try {
                        subscriber.mount(target);
                        let index: bigint = 0n;
                        let unsubscriptions: Map<K, Consumer<EventOfEventMap<EventMap, K>>> = new Map<K, Consumer<EventOfEventMap<EventMap, K>>>();
                        return new Promise<void>(async (resolve: Runnable, reject: Consumer<any>): Promise<void> => {
                            try {
                                let handler: Consumer<EventOfEventMap<EventMap, K>> = (event: EventOfEventMap<EventMap, K>): void => {
                                    if (interrupt(event, index)) {
                                        for (let [unsubscriptionKey, unsubscriptionValue] of unsubscriptions) {
                                            subscriber.unsubscribe(unsubscriptionKey, unsubscriptionValue);
                                        }
                                        // 清空后若再收到事件，不会重复退订
                                        unsubscriptions.clear();
                                        subscriber.unmount();
                                        resolve();
                                    } else {
                                        accept(event, index);
                                        index++;
                                    }
                                };
                                subscriber.subscribe(subscription, handler);
                                unsubscriptions.set(subscription, handler);
                            } catch (error) {
                                for (let [unsubscriptionKey, unsubscriptionValue] of unsubscriptions) {
                                    subscriber.unsubscribe(unsubscriptionKey, unsubscriptionValue);
                                }
                                subscriber.unmount();
                                reject(error);
                            }
                        });
                    } catch (error) {
                        throw error;
                    }
                });
            }
            if (isIterable(argument3)) {
                let subscriptions: Iterable<K> = argument3;
                return new AsynchronousSemantic<EventOfEventMap<EventMap, K>>(async (accept: Consumer<EventOfEventMap<EventMap, K>> | BiConsumer<EventOfEventMap<EventMap, K>, bigint>, interrupt: Predicate<EventOfEventMap<EventMap, K>> | BiPredicate<EventOfEventMap<EventMap, K>, bigint>): Promise<void> => {
                    try {
                        subscriber.mount(target);
                        let index: bigint = 0n;
                        let unsubscriptions: Map<K, Consumer<EventOfEventMap<EventMap, K>>> = new Map<K, Consumer<EventOfEventMap<EventMap, K>>>();
                        return new Promise<void>(async (resolve: Runnable, reject: Consumer<any>): Promise<void> => {
                            try {
                                for (let subscription of subscriptions) {
                                    let handler: Consumer<EventOfEventMap<EventMap, K>> = (event: EventOfEventMap<EventMap, K>): void => {
                                        if (interrupt(event, index)) {
                                            for (let [unsubscriptionKey, unsubscriptionValue] of unsubscriptions) {
                                                subscriber.unsubscribe(unsubscriptionKey, unsubscriptionValue);
                                            }
                                            // 清空后若再收到事件，不会重复退订
                                            unsubscriptions.clear();
                                            subscriber.unmount();
                                            resolve();
                                        } else {
                                            accept(event, index);
                                            index++;
                                        }
                                    };
                                    subscriber.subscribe(subscription, handler);
                                    unsubscriptions.set(subscription, handler);
                                }
                            } catch (error) {
                                for (let [unsubscriptionKey, unsubscriptionValue] of unsubscriptions) {
                                    subscriber.unsubscribe(unsubscriptionKey, unsubscriptionValue);
                                }
                                subscriber.unmount();
                                reject(error);
                            }
                        });
                    } catch (error) {
                        throw error;
                    }
                });
            }
        } catch (error) {
            throw error;
        }
    }
    throw new TypeError("Invalid arguments.");
};

interface UseOf {
    <E>(target: E): SynchronousSemantic<E>;
    <E>(target: Iterable<E>): SynchronousSemantic<E>;
};

export let useOf: UseOf = <E>(...target: Array<E>): SynchronousSemantic<E> => {
    if (Array.isArray(target)) {
        return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>) => {
            try {
                let index: bigint = 0n;
                for (let element of target) {
                    if (interrupt(element, index)) {
                        break;
                    }
                    accept(element, index);
                    index++;
                }
            } catch (error) {
                throw error;
            }
        });
    }
    throw new TypeError("Invalid arguments.");
};

interface UseRange {
    <N extends number | bigint>(start: N, end: N): SynchronousSemantic<N extends number ? number : (N extends bigint ? bigint : never)>;
    <N extends number | bigint>(start: N, end: N, step: N): SynchronousSemantic<N extends number ? number : (N extends bigint ? bigint : never)>;
};
export let useRange: UseRange = <N extends number | bigint>(start: N, end: N, step: N = (isNumber(start) && isNumber(end) ? 1 : 1n) as N): SynchronousSemantic<N> => {
    if ((!isNumber(step) && !isBigInt(step)) || (isNumber(step) && useCompare(step as number, 0) === 0) || (isBigInt(step) && useCompare(step as bigint, 0n) === 0)) {
        throw new TypeError("Step must be numeric and cannot be zero.");
    }
    if (isNumber(start) && isNumber(end)) {
        let trusted: number = useToNumber(step);
        return new SynchronousSemantic<number>((accept: Consumer<number> | BiConsumer<number, bigint>, interrupt: Predicate<number> | BiPredicate<number, bigint>): void => {
            try {
                let index: bigint = 0n;
                for (let i: number = start; i < end; i += trusted) {
                    if (interrupt(i, index)) {
                        break;
                    }
                    accept(i, index);
                    index++;
                }
            } catch (error) {
                throw error;
            }
        }) as unknown as SynchronousSemantic<N>;
    } else if (isBigInt(start) && isBigInt(end)) {
        let trusted: bigint = useToBigInt(step);
        return new SynchronousSemantic<bigint>((accept: Consumer<bigint> | BiConsumer<bigint, bigint>, interrupt: Predicate<bigint> | BiPredicate<bigint, bigint>): void => {
            try {
                let index: bigint = 0n;
                for (let i: bigint = start; i < end; i += trusted) {
                    if (interrupt(i, index)) {
                        break;
                    }
                    accept(i, index);
                    index++;
                }
            } catch (error) {
                throw error;
            }
        }) as unknown as SynchronousSemantic<N>;
    }
    throw new TypeError("Invalid arguments.");
};

interface UseText {
    (text: string): SynchronousSemantic<string>;
    (text: string, delimeter: string): SynchronousSemantic<string>;
    (text: string, start: number): SynchronousSemantic<string>;
    (text: string, start: number, end: number): SynchronousSemantic<string>;
    (text: string, start: bigint): SynchronousSemantic<string>;
    (text: string, start: bigint, end: bigint): SynchronousSemantic<string>;
};

export let useText: UseText = (argument1: string | bigint, argument2?: number | bigint | string, argument3?: number | bigint): SynchronousSemantic<string> => {
    if (isString(argument1)) {
        let text: string = argument1;
        if (invalidate(argument2)) {
            // useText(text)：按 Unicode 码点逐个产出，可正确处理 emoji 等多字节字符（原实现缺少该分支，直接抛错）
            let characters: Array<string> = Array.from(text);
            return new SynchronousSemantic<string>((accept: Consumer<string> | BiConsumer<string, bigint>, interrupt: Predicate<string> | BiPredicate<string, bigint>): void => {
                let index: bigint = 0n;
                for (let character of characters) {
                    if (interrupt(character, index)) {
                        break;
                    }
                    accept(character, index);
                    index++;
                }
            });
        }
        if (isString(argument2)) {
            let delimeter: string = argument2;
            return new SynchronousSemantic<string>((accept: Consumer<string> | BiConsumer<string, bigint>, interrupt: Predicate<string> | BiPredicate<string, bigint>): void => {
                if (text.length > 0 && delimeter.length > 0) {
                    let splited: Array<string> = text.split(delimeter);
                    let index: bigint = 0n;
                    for (let split of splited) {
                        if (interrupt(split, index)) {
                            break;
                        }
                        accept(split, index);
                        // 必须自增，否则所有分片索引都是 0n，无序收集器（Map 按索引存储）会静默丢数据
                        index++;
                    }
                }
            });
        }
        if (isNumber(argument2) || isBigInt(argument2)) {
            let start: number = useToNumber(argument2);
            if (isNumber(argument3) || isBigInt(argument3)) {
                let end: number = useToNumber(argument3);
                let characters: Array<string> = Array.from(argument1.substring(start, end));
                return new SynchronousSemantic<string>((accept: Consumer<string> | BiConsumer<string, bigint>, interrupt: Predicate<string> | BiPredicate<string, bigint>) => {
                    let index: bigint = 0n;
                    for (let character of characters) {
                        if (interrupt(character, index)) {
                            break;
                        }
                        accept(character, index);
                        index++;
                    }
                });
            } else {
                let characters: Array<string> = Array.from(argument1.substring(start));
                return new SynchronousSemantic<string>((accept: Consumer<string> | BiConsumer<string, bigint>, interrupt: Predicate<string> | BiPredicate<string, bigint>) => {
                    let index: bigint = 0n;
                    for (let character of characters) {
                        if (interrupt(character, index)) {
                            break;
                        }
                        accept(character, index);
                        index++;
                    }
                });
            }
        }
    }
    throw new TypeError("Invalid arguments.");
};