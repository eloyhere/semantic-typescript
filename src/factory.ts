import { AsynchronousSemantic } from "#semantic/asynchronous/semantic";
import { isBigInt, isFunction, isIterable, isNumber, isObject, isPromise, isAsyncIterable, isString } from "#semantic/guard";
import { useCompare, useToBigInt, useToNumber, useTraverse } from "#semantic/hook";
import { SynchronousSemantic } from "#semantic/synchronous/semantic";
import { invalidate, validate } from "#semantic/utility";
import type { BiPredicate, Predicate, Supplier, Consumer, BiConsumer, DeepPropertyKey, DeepPropertyValue, Runnable } from "#semantic/utility";
/**
 * Combines a primary failure with the failures raised while cleaning up.
 *
 * The primary value is returned unchanged whenever its identity can be kept, so
 * a caller still observes the original error. Secondary failures are exposed
 * through `cause`: one failure is attached directly and several are attached as
 * an `AggregateError`. A `cause` already present on the primary is preserved
 * inside that aggregate instead of being replaced, so no failure is dropped.
 * When the primary value cannot carry a `cause` — it is a primitive or a frozen
 * object — an `AggregateError` holding every failure is returned instead.
 *
 * @param primary the failure that caused the cleanup, or the first cleanup failure
 * @param secondary the remaining failures, in the order they were raised
 * @returns the value to throw or reject with
 */
let combineFailure = (primary: unknown, secondary: Array<unknown>): unknown => {
    let message: string = "Multiple failures occurred while cleaning up.";
    if (secondary.length === 0) {
        return primary;
    }
    if (primary === null || (typeof primary !== "object" && typeof primary !== "function")) {
        return new AggregateError([primary, ...secondary], message);
    }
    let existing: unknown;
    try {
        existing = (primary as { cause?: unknown }).cause;
    }
    catch {
        return new AggregateError([primary, ...secondary], message);
    }
    let cause: unknown = secondary.length === 1
        ? secondary[0]
        : new AggregateError(secondary, message);
    if (existing !== undefined && existing !== null) {
        cause = new AggregateError([existing, ...secondary], message);
    }
    try {
        Object.defineProperty(primary, "cause", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: cause
        });
        return primary;
    }
    catch {
        return new AggregateError([primary, ...secondary], message);
    }
};
/**
 * One leaf reached by `useAttribute`.
 *
 * The pair is produced for every non-null leaf of the source, so nested objects
 * report their deepest values rather than the containers that hold them.
 *
 * @template T the traversed object, whose keys and values this pair mirrors
 */
interface Attribute<T> {
    key: keyof T;
    value: T[keyof T];
}
;
/**
 * Emits one key/value pair for every non-null leaf of an object.
 *
 * The walk is delegated to `useTraverse`, so it shares the same rules: nested
 * objects are descended, iterable values are walked by position, `null` and
 * `undefined` are skipped, and an object already visited is not revisited. A
 * function met during the walk is reported as a leaf rather than called.
 *
 * Values are emitted in traversal order with consecutive indices starting at
 * zero. Asking the returned semantic to stop halts the whole walk immediately,
 * so a downstream `limit` costs only the leaves it consumes plus one.
 *
 * The walk itself is eager with respect to discovery but lazy with respect to
 * delivery: the traversal only begins when the semantic is collected.
 *
 * @param target the object to flatten into key/value pairs
 * @returns a semantic over the non-null leaves of `target`
 * @throws {TypeError} if `target` is not an object
 * @template T the traversed object
 */
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
            }
            catch (error) {
                throw error;
            }
        });
    }
    throw new TypeError("Target must be an object.");
};
/**
 * The part of a `Blob` this factory actually relies on.
 *
 * The shape is described structurally instead of naming the DOM `Blob` type, so
 * the published declarations stay valid in a project compiled without the DOM
 * library — a Node project, for instance, where `Blob` is a runtime global but
 * may not be a declared type. A real `Blob` satisfies this interface, and so
 * does any object exposing a readable byte stream.
 */
export interface BlobLike {
    /** Opens a byte stream over the blob's contents. */
    stream(): {
        /** Takes the stream's single reader. */
        getReader(): {
            /** Resolves to the next chunk, or to a done marker at the end. */
            read(): Promise<{ done: boolean; value?: Uint8Array }>;
            /** Abandons the stream and releases its underlying source. */
            cancel(): Promise<void>;
            /** Releases the reader so the stream can be reused or collected. */
            releaseLock(): void;
        };
    };
}
;
/**
 * The chunked binary reader, with an optional chunk size.
 *
 * The size defaults to 64 KiB; every overload still produces one fixed-size
 * chunk per emitted element except the last, which carries the remainder.
 */
interface UseBlob {
    /**
     * Reads the whole blob in the default chunk size of 64 KiB.
     *
     * Every emitted array holds exactly 64 KiB except the last, which carries the
     * remainder; the tail is never padded to reach the chunk size.
     */
    (blob: BlobLike): AsynchronousSemantic<Uint8Array>;
    /**
     * Reads the blob in chunks of the requested size.
     *
     * The size is fixed when the semantic is built, so a different chunking needs
     * a different semantic. Only the final chunk may be shorter than the size, and
     * an empty blob therefore emits nothing at all.
     */
    (blob: BlobLike, chunk: bigint): AsynchronousSemantic<Uint8Array>;
}
;
/**
 * Reads a blob as a sequence of fixed-size byte chunks.
 *
 * The blob is consumed through its own stream, so the bytes are never held in
 * memory as a whole. Each emitted `Uint8Array` is an independent copy of exactly
 * `chunk` bytes, except the final chunk, which is shorter and may be empty of
 * padding — the reader never pads the tail.
 *
 * Collection starts the read; a downstream stop cancels the reader as well as
 * releasing its lock, so an abandoned read does not keep the stream open. The
 * lock is released on every exit path, including an error thrown by the consumer
 * or by the stream itself. A failure raised by `cancel()` or `releaseLock()` is
 * never swallowed: on a normal exit it rejects the collection, and when the
 * consumer or the stream had already failed, that original error stays primary
 * and the cleanup failure is attached to it as its `cause`.
 *
 * @param blob the blob to read
 * @param chunk the chunk size in bytes, a safe positive integer; defaults to 64 KiB
 * @returns a semantic emitting one byte array per chunk
 * @throws {RangeError} if the chunk size is not a safe positive integer
 * @throws {TypeError} if the blob is nullish or otherwise unusable
 */
export let useBlob: UseBlob = (blob: BlobLike, chunk: bigint = 64n * 1024n): AsynchronousSemantic<Uint8Array> => {
    let size: number = Number(chunk);
    if (size <= 0 || !Number.isSafeInteger(size)) {
        throw new RangeError("Chunk size must be a safe positive integer.");
    }
    if (invalidate(blob) || !isObject(blob) || !isFunction((blob as BlobLike).stream)) {
        throw new TypeError("Blob is invalid.");
    }
    return new AsynchronousSemantic<Uint8Array>(async (accept: Consumer<Uint8Array> | BiConsumer<Uint8Array, bigint>, interrupt: Predicate<Uint8Array> | BiPredicate<Uint8Array, bigint>): Promise<void> => {
        let index: bigint = 0n;
        let stoppable: boolean = false;
        let failed: boolean = false;
        let failure: unknown = undefined;
        let stream = blob.stream();
        let reader = stream.getReader();
        let buffer: Uint8Array = new Uint8Array(size);
        let offset: number = 0;
        try {
            while (!stoppable) {
                let { done, value } = await reader.read();
                if (done) {
                    if (offset > 0) {
                        let element: Uint8Array = buffer.slice(0, offset);
                        if (interrupt(element, index)) {
                            stoppable = true;
                        }
                        else {
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
                        }
                        else {
                            accept(element, index);
                            index++;
                        }
                        offset = 0;
                    }
                }
            }
        }
        catch (error) {
            failed = true;
            failure = error;
        }
        finally {
            let cleanup: Array<unknown> = [];
            if (stoppable || failed) {
                try {
                    await reader.cancel();
                }
                catch (error) {
                    cleanup.push(error);
                }
            }
            try {
                reader.releaseLock();
            }
            catch (error) {
                cleanup.push(error);
            }
            if (failed) {
                throw combineFailure(failure, cleanup);
            }
            if (cleanup.length > 0) {
                throw combineFailure(cleanup[0], cleanup.slice(1));
            }
        }
    });
};
/**
 * Creates an empty semantic.
 *
 * The result emits nothing and never calls its consumer, which makes it the
 * identity element of `concat`: appending it to a pipeline, or a pipeline to it,
 * leaves the other side unchanged.
 *
 * @returns a semantic with no elements
 * @template E the element type, never actually produced
 */
export let useEmpty: <E>() => SynchronousSemantic<E> = <E>(): SynchronousSemantic<E> => {
    return new SynchronousSemantic<E>(() => { });
};
/**
 * The repetition factory, taking a value or a supplier.
 *
 * A supplier is called once per emitted element, so each element can differ; a
 * plain value is emitted unchanged every time.
 *
 * @template E the element type
 */
interface UseFill {
    /**
     * Repeats one value.
     *
     * The same reference reaches the consumer on every position, so mutating the
     * element downstream is visible for the rest of the run rather than being
     * confined to the first occurrence.
     */
    <E>(element: E, count: bigint): SynchronousSemantic<E>;
    /**
     * Repeats the result of a supplier.
     *
     * The supplier is invoked once per emitted element, not once per collection,
     * so each position may carry a different value — a fresh object from a
     * constructor, for instance.
     */
    <E>(supplier: Supplier<E>, count: bigint): SynchronousSemantic<E>;
}
;
/**
 * Repeats a value or a supplier result a fixed number of times.
 *
 * The supplier, when one is given, is invoked once per element rather than once
 * per collection, so successive elements may be different objects. The index runs
 * from zero to `count - 1` and the consumer is consulted after the interrupt, so
 * a downstream stop short-circuits the repetition instead of discarding elements
 * that were already produced.
 *
 * @param element the value to repeat, or a supplier invoked per element
 * @param count the number of elements to emit
 * @returns a semantic emitting `count` elements
 * @throws {TypeError} if the element is nullish, if the count is not positive, or
 *         if the supplier is not callable when one is expected
 * @template E the element type
 */
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
            }
            catch (error) {
                throw error;
            }
        });
    }
    throw new TypeError("Invalid arguments.");
};
/**
 * The source adapter, dispatching on the protocol its argument implements.
 *
 * An `Iterable` yields a synchronous semantic and an `AsyncIterable` yields an
 * asynchronous one, so the return type follows the argument rather than the call
 * site. The two overloads are the whole public surface of the adapter.
 *
 * @template E the element type
 */
export interface UseFrom {
    /**
     * Adapts a source that iterates synchronously.
     *
     * The result is a synchronous semantic. The source is not touched when the
     * semantic is built; it is iterated when the semantic is collected, so the
     * wrapper is cheap to create and may be created before the data exists.
     */
    <E>(iterable: Iterable<E>): SynchronousSemantic<E>;
    /**
     * Adapts a source that iterates asynchronously.
     *
     * The result is an asynchronous semantic: each element is awaited in turn, and
     * a terminal only resolves once the source is exhausted or the consumer asks
     * to stop.
     */
    <E>(iterable: AsyncIterable<E>): AsynchronousSemantic<E>;
}
;
/**
 * Wraps an iterable or an async iterable as a semantic.
 *
 * The protocol is detected once, when the factory is called, and fixes the kind
 * of semantic that comes back: an `Iterable` produces a synchronous pipeline and
 * an `AsyncIterable` produces an asynchronous one. Nothing is read at
 * construction time — the source is iterated when the semantic is collected, and
 * once per collection, so the same wrapper may be collected repeatedly.
 *
 * `null` and `undefined` are not iterable and are rejected rather than treated as
 * empty; use `useEmpty` for an empty source.
 *
 * @param iterable the source to adapt
 * @returns a semantic over the elements of `iterable`
 * @throws {TypeError} if the argument implements neither iteration protocol
 * @template E the element type
 */
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
            }
            catch (error) {
                throw error;
            }
        });
    }
    else if (isAsyncIterable(iterable)) {
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
            }
            catch (error) {
                throw error;
            }
        });
    }
    throw new TypeError("Invalid arguments");
}) as UseFrom;
/**
 * The unbounded supplier factory.
 *
 * The second parameter is the source's own stop condition; it may ignore the
 * index or use it to bound the run by count.
 *
 * @template E the element type
 */
interface UseGenerate {
    /**
     * Stops on the element alone.
     *
     * The predicate sees each freshly supplied element and, when it answers
     * `true`, ends the run before that element reaches the consumer.
     */
    <E>(supplier: Supplier<E>, interrupt: Predicate<E>): SynchronousSemantic<E>;
    /**
     * Stops on the element together with its position.
     *
     * The index makes a count-based bound expressible without inspecting the
     * element, for example `(_element, index) => index >= 3n` for three elements.
     */
    <E>(supplier: Supplier<E>, interrupt: BiPredicate<E, bigint>): SynchronousSemantic<E>;
}
;
/**
 * Generates elements from a supplier until the source or the consumer says stop.
 *
 * The supplier is called once per element, before any stop is considered, so the
 * element that trips the boundary has already been produced and is discarded
 * unevaluated by the consumer. Two conditions can stop the run: the `interrupter`
 * given here, which is the source's own bound, and the downstream `interrupt`,
 * which is whatever a collected operator such as `limit` installs. Either one
 * answering `true` ends the run.
 *
 * Without a stopping condition on one of those two sides the supplier is called
 * forever; this factory does not impose a limit of its own.
 *
 * @param supplier the function producing each element
 * @param interrupter the source-side stop predicate, applied before the consumer
 * @returns an unbounded semantic over the supplier's results
 * @throws {TypeError} if either argument is not callable
 * @template E the element type
 */
export let useGenerate: UseGenerate = <E>(supplier: Supplier<E>, interrupter: Predicate<E> | BiPredicate<E, bigint>): SynchronousSemantic<E> => {
    if (isFunction(supplier) && isFunction(interrupter)) {
        return new SynchronousSemantic<E>((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            try {
                let index: bigint = 0n;
                while (true) {
                    let element: E = supplier();
                    if (interrupter(element, index) || interrupt(element, index)) {
                        break;
                    }
                    accept(element, index);
                    index++;
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
    throw new TypeError("Invalid arguments");
};
/**
 * The periodic emitter, with or without an initial delay.
 *
 * The delay is in the same unit as the period and postpones the first tick; it
 * does not change the interval between ticks once the run has started.
 */
interface UseInterval {
    /**
     * Ticks once per period, starting as soon as collection begins.
     *
     * The first element is `0` and arrives one period after the timer is armed, so
     * a consumer never sees the instant of collection itself.
     */
    (period: number): AsynchronousSemantic<number>;
    /**
     * Waits before the first tick, then ticks once per period.
     *
     * The delay postpones the whole run by that amount; it neither shortens nor
     * stretches the interval between the later ticks, which remains the period.
     */
    (period: number, delay: number): AsynchronousSemantic<number>;
}
;
/**
 * Emits elapsed time on a fixed period, optionally after an initial delay.
 *
 * Each element is the accumulated count rather than the wall-clock instant: the
 * first value is `0` and every subsequent value is the previous one plus the
 * period, so the sequence is independent of scheduling jitter and of how long a
 * consumer takes to process an element.
 *
 * The timer is armed lazily, when the semantic is collected. The consumer is
 * consulted after the interrupt, and the timer is cleared as soon as either the
 * consumer asks to stop or the consumer throws; in the latter case the thrown
 * error is propagated unchanged, so a failing callback cannot leave an interval
 * running behind it. A pending initial delay is cleared on the same paths.
 *
 * @param period the interval in milliseconds, greater than zero
 * @param delay the delay before the first tick in milliseconds, defaulting to zero
 * @returns a semantic emitting the running total on each tick
 * @throws {TypeError} if the period is not positive or the delay is negative,
 *         including the infinite values
 */
export let useInterval: UseInterval = (period: number, delay: number = 0): AsynchronousSemantic<number> => {
    if (!isNumber(period) || !isNumber(delay) || period <= 0 || delay < 0) {
        throw new TypeError("Invalid arguments.");
    }
    return new AsynchronousSemantic<number>((accept: Consumer<number> | BiConsumer<number, bigint>, interrupt: Predicate<number> | BiPredicate<number, bigint>): Promise<void> => {
        return new Promise<void>((resolve: Runnable, reject: Consumer<any>): void => {
            let settled: boolean = false;
            let timer: ReturnType<typeof setInterval> | undefined;
            let timeout: ReturnType<typeof setTimeout> | undefined;
            let teardown: Runnable = (): void => {
                if (settled) {
                    return;
                }
                settled = true;
                if (timeout !== undefined) {
                    clearTimeout(timeout);
                    timeout = undefined;
                }
                if (timer !== undefined) {
                    clearInterval(timer);
                    timer = undefined;
                }
            };
            let count: number = 0;
            let index: bigint = 0n;
            let start: Runnable = (): void => {
                if (settled) {
                    return;
                }
                timer = setInterval((): void => {
                    if (settled) {
                        return;
                    }
                    try {
                        if (interrupt(count, index)) {
                            teardown();
                            resolve();
                            return;
                        }
                        accept(count, index);
                        index++;
                        count += period;
                    }
                    catch (error) {
                        teardown();
                        reject(error);
                    }
                }, period);
            };
            try {
                if (delay > 0) {
                    timeout = setTimeout((): void => {
                        timeout = undefined;
                        start();
                    }, delay);
                }
                else {
                    start();
                }
            }
            catch (error) {
                teardown();
                reject(error);
            }
        });
    });
}
/**
 * The replaying adapter, dispatching on the protocol its argument implements.
 *
 * The adapter is named for its intent — a source that is meant to be walked
 * again — and both protocols are supported.
 *
 * @template E the element type
 */
interface UseIterate {
    /**
     * Walks a synchronous source.
     *
     * A fresh iterator is requested on every collection, so a replayable source
     * yields its elements again each time. A source that is itself a one-shot
     * iterator is exhausted after its first collection.
     */
    <E>(iterable: Iterable<E>): SynchronousSemantic<E>;
    /**
     * Walks an asynchronous source.
     *
     * Each element is awaited in order and a fresh async iterator is requested on
     * every collection, so replayability depends on the source returning a new
     * iterator per call in exactly the same way.
     */
    <E>(iterable: AsyncIterable<E>): AsynchronousSemantic<E>;
}
;
/**
 * Wraps an iterable and re-obtains an iterator for every collection.
 *
 * Each collection asks the source for a fresh iterator, so a value whose
 * `[Symbol.iterator]()` returns a new iterator per call — an array, a `Set`, a
 * string — can be collected repeatedly and independently. A source that is
 * itself a one-shot iterator, such as a generator object, returns the same
 * exhausted iterator on the second call and therefore yields nothing after its
 * first collection; that is a property of the source, not of this adapter.
 *
 * The synchronous and asynchronous cases are both supported and produce the
 * matching kind of semantic. Anything implementing neither protocol is rejected.
 *
 * @param iterable the source to walk on each collection
 * @returns a semantic that re-iterates `iterable` on each collection
 * @throws {TypeError} if the argument implements neither iteration protocol
 * @template E the element type
 */
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
            }
            catch (error) {
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
                }
                catch (error) {
                    reject(error);
                }
            });
        });
    }
    throw new TypeError("Invalid arguments.");
}) as UseIterate;
/**
 * The single-promise adapter.
 *
 * The promised value becomes the only element of the pipeline, at index `0n`.
 */
interface UsePromise {
    /**
     * Emits the promise's value as the only element.
     *
     * The value is placed at index `0n` once the promise settles. A rejection of
     * the source rejects the collection with that same reason, unwrapped, so the
     * original failure survives the adapter unchanged.
     */
    <T>(promise: Promise<T>): AsynchronousSemantic<T>;
}
;
/**
 * Wraps a promise so that its value becomes the only element of a semantic.
 *
 * The element is emitted at index `0n` once the promise settles. A rejected
 * promise rejects the collection with the original rejection, so the failure is
 * not wrapped or replaced. If the consumer asks to stop before the value is
 * accepted, the collection rejects with an interruption error rather than
 * completing silently, which keeps a stopped run distinguishable from an empty
 * one.
 *
 * @param promise the promise whose value should be emitted
 * @returns a semantic over the promise's value
 * @throws {TypeError} if the argument is not a promise
 * @template T the resolved type
 */
export let usePromise: UsePromise = <T>(promise: Promise<T>): AsynchronousSemantic<T> => {
    if (!isPromise(promise)) {
        throw new TypeError("Invalid arguments.");
    }
    return new AsynchronousSemantic<T>((accept: Consumer<T> | BiConsumer<T, bigint>, interrupt: Predicate<T> | BiPredicate<T, bigint>): Promise<void> => {
        return new Promise<void>((resolve: Runnable, reject: Consumer<any>): void => {
            promise.then((value: T): void => {
                try {
                    if (!interrupt(value, 0n)) {
                        accept(value, 0n);
                    }
                    resolve();
                }
                catch (error) {
                    reject(error);
                }
            }, reject);
        });
    });
};
/**
 * The key type of an event map.
 *
 * @template EventMap the map from event name to event payload
 */
export type KeyOfEventMap<EventMap> = keyof EventMap;
/**
 * The payload type stored under one key of an event map.
 *
 * @template EventMap the map from event name to event payload
 * @template K the event name being read, defaulting to every key
 */
export type EventOfEventMap<EventMap, K extends KeyOfEventMap<EventMap> = KeyOfEventMap<EventMap>> = EventMap[K];
/**
 * The lifecycle contract a subscription needs from its host object.
 *
 * A subscriber is supplied as a factory rather than as a value, so the host may
 * build a fresh instance per collection; this is what makes independent repeated
 * collections possible.
 *
 * `mount` runs once before any subscription and `unmount` once after the last,
 * which lets a host acquire and release resources around the run. `subscribe` and
 * `unsubscribe` are called with the same key and handler pair, so a host that
 * keys its listeners by identity unregisters exactly the handler it added.
 *
 * @template T the target the subscriber attaches to
 * @template EventMap the map from event name to event payload
 */
export interface Subscriber<T, EventMap> {
    mount(target: T): void;
    subscribe<K extends KeyOfEventMap<EventMap>>(key: K, accept: Consumer<EventOfEventMap<EventMap, K>>): void;
    unsubscribe<K extends KeyOfEventMap<EventMap>>(key: K, accept: Consumer<EventOfEventMap<EventMap, K>>): void;
    unmount(): void;
}
;
/**
 * The event source adapter, taking one event name or many.
 *
 * A single name may be any property key, including a symbol or a number; an
 * iterable supplies several names and emits whichever fires first.
 *
 * @template T the target the subscriber attaches to
 * @template EventMap the map from event name to event payload
 * @template K the event name being subscribed to
 */
interface UseSubscription {
    /**
     * Subscribes to a single event name.
     *
     * The name is used as a property key exactly as supplied, so a symbol or a
     * number reaches the subscriber without being stringified on the way.
     */
    <T, EventMap, K extends KeyOfEventMap<EventMap> = KeyOfEventMap<EventMap>>(target: T, subscriber: Supplier<Subscriber<T, EventMap>>, subscription: K): AsynchronousSemantic<EventOfEventMap<EventMap, K>>;
    /**
     * Subscribes to several event names at once.
     *
     * Whichever event fires first is emitted, and elements from different names
     * share one index sequence, so the order of the name list does not privilege
     * any of them. Teardown unsubscribes every name that was subscribed.
     */
    <T, EventMap, K extends KeyOfEventMap<EventMap> = KeyOfEventMap<EventMap>>(target: T, subscriber: Supplier<Subscriber<T, EventMap>>, subscription: Iterable<K>): AsynchronousSemantic<EventOfEventMap<EventMap, K>>;
}
;
/**
 * Streams the events a target emits, unsubscribing when the run ends.
 *
 * The subscriber factory is called once per collection, so repeated collections
 * are independent: each mounts, subscribes and unmounts on its own. Mounting
 * happens before the first subscription and every subscription is recorded so it
 * can be undone later. Registrations are keyed by event name, so a name that
 * appears more than once is overwritten by its later registration and only the
 * survivor is tracked for teardown.
 *
 * Teardown is idempotent and runs on every exit path — a consumer asking to stop,
 * a consumer throwing, a subscription failing part-way through, or an event
 * arriving after the run has already ended. Every recorded `unsubscribe` is
 * attempted even if an earlier one throws, and `unmount` is attempted even if an
 * unsubscribe threw, so one failing host method cannot strand the others. A
 * failure raised during teardown is never swallowed: it rejects the collection
 * when the consumer completed normally, while a consumer error stays primary and
 * the teardown failures are attached to it as its `cause`. When several teardown
 * steps fail, the first failure is the one propagated and the rest are folded
 * into the same `cause` chain.
 *
 * An empty name list completes immediately, having mounted and unmounted without
 * subscribing to anything.
 *
 * @param target the object emiting the events
 * @param subscriber the factory producing the subscriber for this collection
 * @param subscription one event name, or an iterable of names
 * @returns a semantic emitting the payload of each matching event
 * @throws {TypeError} if the target is not an object, if the subscriber factory is
 *         not callable, or if the subscription is neither a name nor iterable
 * @template T the target type
 * @template EventMap the map from event name to event payload
 * @template K the subscribed event name
 */
export let useSubscription: UseSubscription = <T, EventMap, K extends KeyOfEventMap<EventMap>>(argument1: T, argument2: Supplier<Subscriber<T, EventMap>>, argument3: K | Iterable<K>): AsynchronousSemantic<EventOfEventMap<EventMap, K>> => {
    if (!isObject(argument1) || !isFunction(argument2)) {
        throw new TypeError("Invalid arguments.");
    }
    let target: T = argument1;
    let keys: Array<K> = isString(argument3)
        ? [argument3]
        : (isIterable(argument3) ? [...argument3] : [argument3 as K]);
    return new AsynchronousSemantic<EventOfEventMap<EventMap, K>>((accept: Consumer<EventOfEventMap<EventMap, K>> | BiConsumer<EventOfEventMap<EventMap, K>, bigint>, interrupt: Predicate<EventOfEventMap<EventMap, K>> | BiPredicate<EventOfEventMap<EventMap, K>, bigint>): Promise<void> => {
        let subscriber: Subscriber<T, EventMap> = argument2();
        let handlers: Map<K, Consumer<EventOfEventMap<EventMap, K>>> = new Map<K, Consumer<EventOfEventMap<EventMap, K>>>();
        let settled: boolean = false;
        return new Promise<void>((resolve: Runnable, reject: Consumer<any>): void => {
            let registering: boolean = false;
            let deferred: { failed: boolean; error: unknown; failures: Array<unknown> } | null = null;
            let teardown: () => Array<unknown> = (): Array<unknown> => {
                if (settled) {
                    return [];
                }
                settled = true;
                let failures: Array<unknown> = [];
                for (let [key, handler] of handlers) {
                    try {
                        subscriber.unsubscribe(key, handler);
                    }
                    catch (error) {
                        failures.push(error);
                    }
                }
                handlers.clear();
                try {
                    subscriber.unmount();
                }
                catch (error) {
                    failures.push(error);
                }
                return failures;
            };
            let settle: (failed: boolean, error: unknown, failures: Array<unknown>) => void = (failed: boolean, error: unknown, failures: Array<unknown>): void => {
                if (failed) {
                    reject(combineFailure(error, failures));
                    return;
                }
                if (failures.length > 0) {
                    reject(combineFailure(failures[0], failures.slice(1)));
                    return;
                }
                resolve();
            };
            let conclude: Runnable = (): void => {
                let failures: Array<unknown> = teardown();
                if (registering) {
                    if (deferred === null) {
                        deferred = { failed: false, error: undefined, failures };
                    }
                    return;
                }
                settle(false, undefined, failures);
            };
            let abandon: Consumer<any> = (error: any): void => {
                let failures: Array<unknown> = teardown();
                if (registering) {
                    if (deferred === null) {
                        deferred = { failed: true, error, failures };
                    }
                    return;
                }
                settle(true, error, failures);
            };
            try {
                subscriber.mount(target);
                let index: bigint = 0n;
                for (let key of keys) {
                    if (settled) {
                        break;
                    }
                    let handler: Consumer<EventOfEventMap<EventMap, K>> = (event: EventOfEventMap<EventMap, K>): void => {
                        if (settled) {
                            return;
                        }
                        try {
                            if (interrupt(event, index)) {
                                conclude();
                                return;
                            }
                            accept(event, index);
                            index++;
                            if (interrupt(event, index)) {
                                conclude();
                            }
                        }
                        catch (error) {
                            abandon(error);
                        }
                    };
                    registering = true;
                    try {
                        subscriber.subscribe(key, handler);
                    }
                    finally {
                        registering = false;
                    }
                    if (settled) {
                        let cleanup: Array<unknown> = [];
                        try {
                            subscriber.unsubscribe(key, handler);
                        }
                        catch (error) {
                            cleanup.push(error);
                        }
                        if (deferred !== null) {
                            let outcome: { failed: boolean; error: unknown; failures: Array<unknown> } = deferred;
                            deferred = null;
                            settle(outcome.failed, outcome.error, outcome.failures.concat(cleanup));
                        }
                    }
                    else {
                        handlers.set(key, handler);
                    }
                }
                if (!settled && keys.length === 0) {
                    conclude();
                }
            }
            catch (error) {
                abandon(error);
            }
        });
    });
}
/**
 * The variadic source.
 *
 * Every argument becomes one element; an array argument is emitted as a single
 * element, because the arguments themselves are the elements.
 *
 * @template E the element type
 */
interface UseOf {
    /**
     * Emits each argument as one element.
     *
     * Every argument becomes one element, so an array argument becomes a single
     * array element rather than being spread over several positions.
     */
    <E>(...target: Array<E>): SynchronousSemantic<E>;
}
;
/**
 * Creates a semantic from the arguments themselves.
 *
 * The arguments are treated as the elements, not as a source to be unwrapped: a
 * single array argument becomes one element that happens to be an array. Call
 * `useFrom` when an existing collection should be flattened instead.
 *
 * Indices run from zero in argument order, and the consumer is consulted after
 * the interrupt, so a downstream stop avoids producing the remaining arguments.
 *
 * @param target the elements to emit, one per argument
 * @returns a semantic over the supplied arguments
 * @template E the element type
 */
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
            }
            catch (error) {
                throw error;
            }
        });
    }
    throw new TypeError("Invalid arguments.");
};
/**
 * The half-open numeric range, with an optional step.
 *
 * The step defaults to one in whichever numeric kind the bounds use, and it may
 * be negative for a descending range.
 *
 * @template N the numeric kind, either `number` or `bigint`
 */
interface UseRange {
    /**
     * Counts by one between the bounds.
     *
     * The kind of the implicit step follows the bounds — `1` for numbers and `1n`
     * for bigints — so no conversion between the two numeric representations
     * takes place.
     */
    <N extends number | bigint>(start: N, end: N): SynchronousSemantic<N extends number ? number : (N extends bigint ? bigint : never)>;
    /**
     * Counts by the given step.
     *
     * A negative step counts downwards from the first bound; the second bound still
     * decides where the run stops, and both bounds and the step must share one
     * numeric kind.
     */
    <N extends number | bigint>(start: N, end: N, step: N): SynchronousSemantic<N extends number ? number : (N extends bigint ? bigint : never)>;
}
;
/**
 * Emits a numeric sequence over a half-open interval.
 *
 * The lower bound is included and the upper bound is excluded, so a range whose
 * bounds are equal is empty. Both bounds must share one numeric kind — `number`
 * with `number`, or `bigint` with `bigint` — and the step must match them too; a
 * mixed call is rejected rather than coerced, which keeps precision from changing
 * silently between the two representations.
 *
 * The step may be negative, in which case the range counts downwards and the
 * upper bound still serves as the stopping point. A zero step would never
 * advance and is rejected instead of looping forever.
 *
 * The values are computed on demand, one per iteration, so a very large range
 * costs nothing until it is consumed.
 *
 * @param start the inclusive lower bound, or the first value when stepping down
 * @param end the exclusive upper bound
 * @param step the increment, defaulting to one of the bounds' numeric kind
 * @returns a semantic over the sequence
 * @throws {TypeError} if the step is not numeric, is zero, or the bounds do not
 *         share a numeric kind
 * @template N the numeric kind
 */
export let useRange: UseRange = <N extends number | bigint>(start: N, end: N, step: N = (isNumber(start) && isNumber(end) ? 1 : 1n) as N): SynchronousSemantic<N> => {
    if ((!isNumber(step) && !isBigInt(step)) || (isNumber(step) && useCompare(step as number, 0) === 0) || (isBigInt(step) && useCompare(step as bigint, 0n) === 0)) {
        throw new TypeError("Step must be numeric and cannot be zero.");
    }
    if ((isNumber(start) && isNumber(end) && !isNumber(step)) || (isBigInt(start) && isBigInt(end) && !isBigInt(step))) {
        throw new TypeError("Step must share the numeric kind of the bounds.");
    }
    if (isNumber(start) && isNumber(end)) {
        let trusted: number = useToNumber(step);
        return new SynchronousSemantic<number>((accept: Consumer<number> | BiConsumer<number, bigint>, interrupt: Predicate<number> | BiPredicate<number, bigint>): void => {
            try {
                let index: bigint = 0n;
                for (let i: number = start; trusted > 0 ? i < end : i > end; i += trusted) {
                    if (interrupt(i, index)) {
                        break;
                    }
                    accept(i, index);
                    index++;
                }
            }
            catch (error) {
                throw error;
            }
        }) as unknown as SynchronousSemantic<N>;
    }
    else if (isBigInt(start) && isBigInt(end)) {
        let trusted: bigint = useToBigInt(step);
        return new SynchronousSemantic<bigint>((accept: Consumer<bigint> | BiConsumer<bigint, bigint>, interrupt: Predicate<bigint> | BiPredicate<bigint, bigint>): void => {
            try {
                let index: bigint = 0n;
                for (let i: bigint = start; trusted > 0n ? i < end : i > end; i += trusted) {
                    if (interrupt(i, index)) {
                        break;
                    }
                    accept(i, index);
                    index++;
                }
            }
            catch (error) {
                throw error;
            }
        }) as unknown as SynchronousSemantic<N>;
    }
    throw new TypeError("Invalid arguments.");
};
/**
 * The text source, splitting by delimiter or by position.
 *
 * Without a second argument the text is read as code points; a string second
 * argument is a delimiter, and a numeric one selects a slice before the code
 * points are taken.
 */
interface UseText {
    /**
     * Reads the text as code points.
     *
     * Astral characters stay whole, so an emoji occupies one element instead of
     * the two UTF-16 units it is stored as.
     */
    (text: string): SynchronousSemantic<string>;
    /**
     * Splits the text on a delimiter.
     *
     * Empty leading and trailing pieces are emitted like any other piece, so the
     * number of elements is one more than the number of separators. An empty text
     * or an empty delimiter emits nothing rather than parsing surprisingly.
     */
    (text: string, delimeter: string): SynchronousSemantic<string>;
    /**
     * Reads the code points from a start position to the end of the text.
     *
     * The position is applied through `String.prototype.substring`, so a negative
     * value is clamped to zero and one past the end is clamped to the length.
     */
    (text: string, start: number): SynchronousSemantic<string>;
    /**
     * Reads the code points of a bounded slice.
     *
     * The slice follows `substring` semantics, which means inverted bounds are
     * swapped rather than yielding an empty result.
     */
    (text: string, start: number, end: number): SynchronousSemantic<string>;
    /**
     * Reads the code points from a bigint position to the end.
     *
     * The bigint is narrowed to a number before slicing, so a position beyond the
     * safe integer range cannot be applied exactly; the same clamping rules then
     * apply as for the numeric overload.
     */
    (text: string, start: bigint): SynchronousSemantic<string>;
    /**
     * Reads the code points of a bigint-bounded slice.
     *
     * Both bounds are narrowed to numbers before `substring` is called, so the
     * swapping and clamping behaviour of that method is inherited unchanged.
     */
    (text: string, start: bigint, end: bigint): SynchronousSemantic<string>;
}
;
/**
 * Emits the characters or the delimited pieces of a string.
 *
 * Without a second argument the text is walked by **code point**, not by UTF-16
 * code unit, so an emoji or any other astral character stays a single element
 * instead of being split into its surrogate pair.
 *
 * A string second argument is a delimiter: the text is split on it and the pieces
 * are emitted, an empty leading or trailing piece included. If either the text or
 * the delimiter is empty nothing is emitted at all.
 *
 * A numeric second argument selects a slice, and a numeric third argument closes
 * it. The slice is taken with `String.prototype.substring`, so it inherits that
 * method's clarifications: a negative position is clamped to zero, an out-of-range
 * one is clamped to the length, and inverted bounds are swapped rather than
 * producing an empty slice.
 *
 * In every form the indices of the emitted elements restart at zero and the
 * consumer is consulted after the interrupt.
 *
 * @param argument1 the text to read
 * @param argument2 a delimiter, or the start of the slice
 * @param argument3 the exclusive end of the slice
 * @returns a semantic over the characters or pieces
 * @throws {TypeError} if the text is not a string, or the second and third
 *         arguments do not form a supported combination
 */
export let useText: UseText = (argument1: string | bigint, argument2?: number | bigint | string, argument3?: number | bigint): SynchronousSemantic<string> => {
    if (isString(argument1)) {
        let text: string = argument1;
        if (invalidate(argument2)) {
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
                        index++;
                    }
                }
            });
        }
        if (isNumber(argument2) || isBigInt(argument2)) {
            let start: number = useToNumber(argument2);
            if (isNumber(argument3) || isBigInt(argument3)) {
                let end: number = useToNumber(argument3);
                let lower: number = Math.max(0, start < end ? start : end);
                let upper: number = Math.max(0, start < end ? end : start);
                let characters: Array<string> = Array.from(argument1).slice(lower, upper);
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
            else {
                let characters: Array<string> = Array.from(argument1).slice(Math.max(0, start));
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
