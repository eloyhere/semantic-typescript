/**
 * The synchronous window collectable: a buffered ordered source whose primary
 * operations split the buffered sequence into sliding, tumbling and partitioned
 * views.
 *
 * This module is the transitional home of the synchronous window API and
 * intentionally duplicates `SynchronousWindowCollectable` from
 * `#semantic/synchronous/semantic`. The class hierarchy, the buffered order and
 * the window boundaries are preserved. The one behavioural difference is that
 * `slide` and `tumble` return materialised window arrays instead of a lazy
 * `SynchronousSemantic<SynchronousSemantic<E>>` pipeline: constructing that
 * pipeline here would require a runtime import of
 * `#semantic/synchronous/semantic`, and the pipeline itself constructs the
 * window collectable in its `toWindow()` terminal, so the runtime edge would
 * close a module cycle once this file is wired into the package. Keeping the
 * duplicate free of that edge leaves the lazy pipeline to the pipeline layer;
 * callers that need one can pass the buffered generator to the inherited
 * `pipe()` with their own `SynchronousSemantic` constructor, and
 * {@link WindowPipeline} names the shape that `slide` and `tumble` used to
 * return.
 *
 * Ordering semantics: construction buffers the source in comparator order, or
 * in normalised encounter-index order when no comparator is supplied, exactly
 * as {@link OrderedCollectable} does. Every window is a contiguous run of that
 * buffered sequence, windows are reported in ascending start position, and the
 * elements inside a window keep the buffered order. The inherited `partition`
 * is not a contiguous split: it distributes elements by buffered position
 * modulo the requested count.
 *
 * Complexity: buffering costs O(n) memory and O(n log n) time. `slide` and
 * `tumble` copy O(w * s) elements for w windows of at most s elements (O(n)
 * when the step is at least the window size), and `partition` is O(n). Every
 * inherited terminal operation keeps its own documented cost.
 *
 * @module
 */

import { isBigInt } from "#semantic/guard";
import { useCompare } from "#semantic/hook";
import { SynchronousWindowCollectableSymbol } from "#semantic/symbol";
import { validate, type Comparator, type SynchronousGenerator } from "#semantic/utility";
import { OrderedCollectable } from "#semantic/synchronous/collectable";
import type { SynchronousSemantic } from "#semantic/synchronous/semantic";

/**
 * The lazy pipeline shape that `slide` and `tumble` produced before the module
 * split.
 *
 * The window methods of this module materialise their windows, so the lazy
 * form is no longer constructed here. The alias keeps that shape documented and
 * lets a caller annotate the value of the inherited `pipe()` conversion without
 * importing the pipeline class into this module at runtime.
 *
 * Ordering: the outer pipeline emits one inner pipeline per window in ascending
 * start position; each inner pipeline replays its window in buffered order.
 * Complexity: naming the type is free; building the pipeline is O(1) and
 * iterating it copies the windows lazily.
 *
 * @template E - The source element type.
 */
export type WindowPipeline<E> = SynchronousSemantic<SynchronousSemantic<E>>;

/**
 * A buffered ordered source supporting sliding, tumbling and partitioned
 * windows.
 *
 * Responsibility: exposes the window splits over the ordered buffer while
 * keeping every inherited collectable terminal available on the same object.
 * The buffer is built once in the constructor, so repeated window calls replay
 * the same sequence instead of re-running the generator.
 *
 * Ordering semantics: elements are held in comparator order, or in normalised
 * encounter-index order when no comparator is supplied. `slide` and `tumble`
 * emit contiguous runs of that order and report them by ascending start
 * position; `partition` keeps the inherited round-robin split by buffered
 * position. No window operation reorders the elements it returns.
 *
 * Complexity: construction is O(n) buffering plus O(n log n) sorting; inherited
 * terminals are O(n) unless they document otherwise; `slide` and `tumble` copy
 * the elements they return.
 *
 * @template E - The source element type.
 */
export class WindowCollectable<E> extends OrderedCollectable<E> {
    protected readonly WindowCollectable: symbol = SynchronousWindowCollectableSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     *
     * The tag keeps the historical `SynchronousWindowCollectable` name so
     * `Object.prototype.toString` and the runtime guards continue to report the
     * same value after the classes are merged.
     */
    [Symbol.toStringTag]: string = "SynchronousWindowCollectable";
    /**
     * Drains the source into an ordered buffer and installs the window brand.
     *
     * The element order is whatever {@link OrderedCollectable} establishes:
     * comparator order when a comparator is supplied, otherwise ascending
     * normalised encounter index. The window methods later read this fixed
     * buffer, so they never re-run the generator.
     *
     * Ordering: comparator order, or ascending normalised encounter index when
     * no comparator is supplied.
     * Complexity: O(n) buffering plus O(n log n) sorting, performed eagerly by
     * the base constructor.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: SynchronousGenerator<E>);
    /**
     * Drains the source into a comparator-ordered buffer and installs the
     * window brand.
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
            "SynchronousWindowCollectable": {
                value: SynchronousWindowCollectableSymbol,
                writable: false,
                enumerable: false,
                configurable: false
            }
        });
    }
    /**
     * Returns the window view of this collectable.
     *
     * The instance is already a window collectable whose buffer was built at
     * construction, so the conversion is the identity. The method exists so a
     * caller can normalise a source through the same `toWindow()` spelling that
     * the pipeline exposes, without paying for a second buffering pass.
     *
     * Ordering: unchanged; the same buffered order is retained.
     * Complexity: O(1) — no traversal and no allocation.
     *
     * @returns This collectable as a window view.
     */
    public toWindow(): WindowCollectable<E> {
        return this;
    }
    /**
     * Splits the buffered order into overlapping windows.
     *
     * Window `k` covers the half-open buffered position range
     * `[k * step, k * step + size)`, clipped to the buffer length: the last
     * window is partial, and a step larger than the size skips the elements
     * between windows. An empty buffer produces no windows. Because the result
     * is materialised, it holds `O(w * s)` elements for `w` windows of at most
     * `s` elements; the old pipeline handed the same bounds to a lazy iterator
     * instead.
     *
     * Ordering: windows are reported by ascending start position, and the
     * elements inside a window keep the buffered order. Positions are the
     * buffered positions, so a comparator-ordered source yields windows of the
     * sorted sequence.
     * Complexity: O(w * s) element copies and O(w * s) extra memory; O(n) when
     * the step is at least the window size.
     *
     * @param size - The positive maximum window size.
     * @param step - The positive distance between window starts; defaults to one.
     * @returns The windows, including the final partial window.
     * @throws {RangeError} If `size` or `step` is not a positive bigint.
     */
    public slide(size: bigint, step: bigint = 1n): Array<Array<E>> {
        if (!isBigInt(size) || !isBigInt(step) || size <= 0n || step <= 0n) {
            throw new RangeError("Invalid arguments.");
        }
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
     * This is `slide(size, size)`: window `k` covers the buffered positions
     * `[k * size, (k + 1) * size)` clipped to the buffer length, so only the
     * final window may be partial and no element appears in two windows.
     *
     * Ordering: windows are reported by ascending start position and preserve
     * the buffered order inside each window.
     * Complexity: O(n) element copies and O(n) extra memory.
     *
     * @param size - The positive window size.
     * @returns The windows, including the final partial window.
     * @throws {RangeError} If `size` is not a positive bigint.
     */
    public tumble(size: bigint): Array<Array<E>> {
        if (!isBigInt(size) || size <= 0n) {
            throw new RangeError("Invalid arguments.");
        }
        return this.slide(size, size);
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
     * Complexity: O(n) — one pass over the buffered elements.
     *
     * @param count - The requested bucket count; values below one use one bucket.
     * @returns The bucket arrays, including empty intervening buckets.
     * @throws {TypeError} If `count` is not a bigint.
     */
    public override partition(count: bigint): Array<Array<E>> {
        return super.partition(count);
    }
};
