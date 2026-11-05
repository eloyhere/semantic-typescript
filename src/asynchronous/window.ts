/**
 * The asynchronous window API: asynchronously buffered ordered sources whose
 * primary operations split the buffered sequence into sliding, tumbling and
 * partitioned views.
 *
 * Two window collectables live here. {@link AsynchronousWindowCollectable}
 * re-exposes every window as a lazy `AsynchronousSemantic` pipeline, so a window
 * can be consumed without materialising it first; this is the form `toWindow()`
 * returns and the form the README documents.
 * {@link AsynchronousWindowArrayCollectable} materialises every window into an
 * array instead, which is the cheapest form when the caller consumes the
 * windows immediately and discards them.
 *
 * Ordering semantics: construction starts draining the source in comparator
 * order, or in normalised encounter-index order when no comparator is supplied,
 * exactly as {@link AsynchronousOrderedCollectable} does. Every window method
 * first awaits the settled buffer, so it always observes the complete sequence.
 * Windows are contiguous runs of that sequence, reported in ascending start
 * position, and the elements inside a window keep the buffered order. The
 * inherited `partition` is not a contiguous split: it distributes elements by
 * buffered position modulo the requested count.
 *
 * Complexity: buffering costs O(n) memory and O(n log n) time. `slide` and
 * `tumble` copy O(w * s) elements on the materialised class for w windows of at
 * most s elements (O(n) when the step is at least the window size) and copy no
 * elements on the pipeline class; `partition` is O(n). Every inherited terminal
 * operation keeps its own documented cost and awaits the same `ready` promise.
 *
 * The pipeline class references `AsynchronousSemantic` at runtime while
 * `#semantic/asynchronous/semantic` references the class back, so the two
 * modules form a cycle. The cycle is safe: the class body only reads
 * `AsynchronousOrderedCollectable`, and the `AsynchronousSemantic` binding is
 * read inside methods, after both modules have been evaluated.
 *
 * @module
 */

import { isBigInt } from "#semantic/guard";
import { useCompare } from "#semantic/hook";
import { AsynchronousWindowCollectableSymbol } from "#semantic/symbol";
import {
    validate,
    type AsynchronousGenerator,
    type BiConsumer,
    type BiPredicate,
    type Comparator,
    type Consumer,
    type Indexed,
    type Predicate
} from "#semantic/utility";
import { AsynchronousOrderedCollectable } from "#semantic/asynchronous/collectable";
import { AsynchronousSemantic } from "#semantic/asynchronous/semantic";

/**
 * The lazy pipeline shape that a window split produces.
 *
 * The outer pipeline emits one inner pipeline per window in ascending start
 * position; each inner pipeline replays its window in buffered order and reports
 * the buffered position as the bigint index.
 *
 * Complexity: naming the type is free; building the pipeline is O(1) and
 * iterating it reads the already buffered elements.
 *
 * @template E - The source element type.
 */
export type WindowPipeline<E> = AsynchronousSemantic<AsynchronousSemantic<E>>;

/**
 * An asynchronously buffered ordered source supporting sliding, tumbling and
 * partitioned windows materialised as arrays.
 *
 * Responsibility: exposes the window splits over the settled ordered buffer
 * while keeping every inherited collectable terminal available on the same
 * object. Draining starts in the constructor, so repeated window calls replay
 * the same sequence instead of re-running the generator.
 *
 * Ordering semantics: elements are held in comparator order, or in normalised
 * encounter-index order when no comparator is supplied. `slide` and `tumble`
 * emit contiguous runs of that order and report them by ascending start
 * position; `partition` keeps the inherited round-robin split by buffered
 * position. No window operation reorders the elements it resolves with.
 *
 * Complexity: construction is O(n) buffering plus O(n log n) sorting; inherited
 * terminals are O(n) unless they document otherwise; `slide` and `tumble` copy
 * the elements they return.
 *
 * @template E - The source element type.
 */
export class AsynchronousWindowArrayCollectable<E> extends AsynchronousOrderedCollectable<E> {
    protected readonly WindowCollectable: symbol = AsynchronousWindowCollectableSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     *
     * The tag keeps the historical `AsynchronousWindowCollectable` name so
     * `Object.prototype.toString` and the runtime guards continue to report the
     * same value after the classes are merged.
     */
    [Symbol.toStringTag]: string = "AsynchronousWindowCollectable";
    /**
     * Starts draining the source into an ordered buffer and installs the window
     * brand.
     *
     * The element order is whatever {@link AsynchronousOrderedCollectable}
     * establishes once its `ready` promise settles: comparator order when a
     * comparator is supplied, otherwise ascending normalised encounter index.
     * The window methods later read that fixed buffer, so they never re-run the
     * generator.
     *
     * Ordering: comparator order, or ascending normalised encounter index when
     * no comparator is supplied.
     * Complexity: O(n) buffering plus O(n log n) sorting, started eagerly by
     * the base constructor.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: AsynchronousGenerator<E>);
    /**
     * Starts draining the source into a comparator-ordered buffer and installs
     * the window brand.
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
            "AsynchronousWindowCollectable": {
                value: AsynchronousWindowCollectableSymbol,
                writable: false,
                enumerable: false,
                configurable: false
            }
        });
    }
    /**
     * Returns the window view of this collectable.
     *
     * The instance is already a window collectable whose buffer is being built
     * at construction, so the conversion is the identity. The method exists so
     * a caller can normalise a source through the same `toWindow()` spelling
     * that the pipeline exposes, without paying for a second buffering pass. No
     * settlement is awaited because no data is read.
     *
     * Ordering: unchanged; the same buffered order is retained once ready.
     * Complexity: O(1) — no traversal and no allocation.
     *
     * @returns This collectable as a window view.
     */
    public toWindow(): AsynchronousWindowArrayCollectable<E> {
        return this;
    }
    /**
     * Splits the buffered order into overlapping windows.
     *
     * The call first awaits the settled buffer, then window `k` covers the
     * half-open buffered position range `[k * step, k * step + size)`, clipped
     * to the buffer length: the last window is partial, and a step larger than
     * the size skips the elements between windows. An empty buffer produces no
     * windows. Because the result is materialised, it holds `O(w * s)`
     * elements for `w` windows of at most `s` elements;
     * {@link AsynchronousWindowCollectable} hands the same bounds to a lazy
     * iterator instead.
     *
     * Ordering: windows are reported by ascending start position, and the
     * elements inside a window keep the buffered order. Positions are the
     * buffered positions, so a comparator-ordered source yields windows of the
     * sorted sequence.
     * Complexity: O(w * s) element copies and O(w * s) extra memory after the
     * buffer settles; O(n) when the step is at least the window size.
     *
     * @param size - The positive maximum window size.
     * @param step - The positive distance between window starts; defaults to one.
     * @returns A promise resolving to the windows, including the final partial window.
     * @throws {RangeError} If `size` or `step` is not a positive bigint; the
     *         returned promise rejects in that case.
     */
    public async slide(size: bigint, step: bigint = 1n): Promise<Array<Array<E>>> {
        if (!isBigInt(size) || !isBigInt(step) || size <= 0n || step <= 0n) {
            throw new RangeError("Invalid arguments.");
        }
        await this.settled();
        let count: bigint = BigInt(this.buffer.length);
        let windows: Array<Array<E>> = [];
        for (let start: bigint = 0n; start < count; start += step) {
            let end: bigint = start + size < count ? start + size : count;
            let window: Array<E> = [];
            for (let index: bigint = start; index < end; index++) {
                window.push(this.buffer[Number(index)].element);
            }
            windows.push(window);
        }
        return windows;
    }
    /**
     * Splits the buffered order into adjacent, non-overlapping windows.
     *
     * This is `slide(size, size)`: after the buffer settles, window `k` covers
     * the buffered positions `[k * size, (k + 1) * size)` clipped to the buffer
     * length, so only the final window may be partial and no element appears in
     * two windows.
     *
     * Ordering: windows are reported by ascending start position and preserve
     * the buffered order inside each window.
     * Complexity: O(n) element copies and O(n) extra memory after the buffer
     * settles.
     *
     * @param size - The positive window size.
     * @returns A promise resolving to the windows, including the final partial window.
     * @throws {RangeError} If `size` is not a positive bigint; the returned
     *         promise rejects in that case.
     */
    public async tumble(size: bigint): Promise<Array<Array<E>>> {
        if (!isBigInt(size) || size <= 0n) {
            throw new RangeError("Invalid arguments.");
        }
        return await this.slide(size, size);
    }
    /**
     * Distributes the buffered elements across `count` round-robin buckets.
     *
     * This keeps the inherited collectable contract on the window surface:
     * bucket `k` receives the elements whose buffered position is congruent to
     * `k` modulo `count`. It is deliberately not a contiguous split; use
     * `tumble` for adjacent non-overlapping windows and `slide` for overlapping
     * ones. Delegating to the base implementation guarantees that the behaviour
     * matches every other collectable.
     *
     * Ordering: every bucket preserves the buffered order of its elements.
     * Complexity: O(n) — one pass over the buffered elements after the buffer
     * settles.
     *
     * @param count - The requested bucket count; values below one use one bucket.
     * @returns A promise resolving to the bucket arrays, including empty intervening buckets.
     * @throws {TypeError} If `count` is not a bigint; the returned promise rejects.
     */
    public override async partition(count: bigint): Promise<Array<Array<E>>> {
        return await super.partition(count);
    }
};

/**
 * An asynchronously buffered ordered source that re-exposes its windows as lazy
 * pipelines.
 *
 * Responsibility: the object `toWindow()` returns. Each window is an
 * `AsynchronousSemantic` that replays a contiguous run of the buffer, so a
 * caller can transform, filter or consume a window without materialising it
 * into an array. Construction starts draining the source once, exactly like
 * {@link AsynchronousWindowArrayCollectable}.
 *
 * Ordering semantics: elements are held in comparator order, or in normalised
 * encounter-index order when no comparator is supplied. Windows are reported in
 * ascending start position and each inner pipeline replays its window in
 * buffered order, reporting the buffered position as the bigint index.
 *
 * Complexity: construction is O(n) buffering plus O(n log n) sorting; `slide`
 * and `tumble` are O(1) to build, await the settled buffer once and read the
 * buffered elements lazily while the outer pipeline is iterated.
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
     * @returns An async iterator over the collected elements.
     */
    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
            yield element;
        }
    }
    /**
     * Creates windows over the buffered order, including a final partial window.
     *
     * The window pipeline first awaits the settled buffer, then window `k`
     * covers the half-open buffered position range `[k * step, k * step + size)`,
     * clipped to the buffer length, so the last window is partial and a step
     * larger than the size skips the elements between windows. An empty buffer
     * produces no windows. Every window is returned as a lazy pipeline, so no
     * elements are copied until the caller iterates it.
     *
     * Ordering: the outer pipeline emits one inner pipeline per window in
     * ascending start position, and each inner pipeline replays its window in
     * buffered order.
     * Complexity: O(1) to build after the buffer settles; iterating copies
     * nothing beyond the buffered elements.
     *
     * @param size - The positive maximum window size.
     * @param step - The positive distance between window starts; defaults to one.
     * @returns A pipeline of windows retaining the buffered element positions.
     * @throws {RangeError} If `size` or `step` is not a positive bigint.
     */
    public slide(size: bigint, step: bigint = 1n): WindowPipeline<E> {
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
     * This is `slide(size, size)`: only the final window may be partial and no
     * element appears in two windows.
     *
     * @param size - The positive maximum window size.
     * @returns A pipeline of windows, including a final partial window.
     * @throws {RangeError} If `size` is not a positive bigint.
     */
    public tumble(size: bigint): WindowPipeline<E> {
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
};
