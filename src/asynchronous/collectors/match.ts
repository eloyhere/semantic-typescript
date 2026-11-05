/**
 * Asynchronous collectors that inspect elements without materialising them:
 * existential and universal predicates, positional lookups, counting, iteration and
 * diagnostic terminals.
 */
import { isFunction, isBoolean, isString } from "#semantic/guard";
import { useCompare, useToBigInt } from "#semantic/hook";
import { AsynchronousCollector } from "#semantic/asynchronous/collector";
import type { BiFunctional, BiPredicate, Predicate, TriFunctional, Consumer, BiConsumer, Comparator, MaybeInvalid } from "#semantic/utility";
import { validate } from "#semantic/utility";

/**
 * Creates collectors that report whether at least one element matches a predicate.
 *
 * The collector short-circuits on the first accepted element and finishes with
 * true; an empty asynchronous source finishes with false. It is the existential
 * counterpart of useAsynchronousAllMatch and the inverse of useAsynchronousNoneMatch.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousAnyMatch {
    /**
     * Tests each element with a predicate that only receives the element value.
     *
     * The accumulator starts as false, so an empty or fully rejected source
     * finishes with false, and a true answer interrupts the asynchronous source
     * after the element has been observed.
     *
     * @template E - The source element type.
     * @param predicate - Decides whether an element counts as a match.
     * @returns A collector that finishes with true when a match was seen.
     */
    <E>(predicate: Predicate<E>): AsynchronousCollector<E, boolean, boolean>;
    /**
     * Tests each element with a predicate that also receives its encounter index.
     *
     * The index is the bigint position of the element in encounter order, so the
     * predicate can match a value at a particular offset as well as by content.
     *
     * @template E - The source element type.
     * @param predicate - Receives the element and its bigint encounter index.
     * @returns A collector that finishes with true when a match was seen.
     */
    <E>(predicate: BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests for a matching element and stops after a match.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousAnyMatch: UseAsynchronousAnyMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return AsynchronousCollector.shortable((): boolean => false, (_element: E, _index: bigint, accumulator: boolean): boolean => isBoolean(accumulator) && accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator || predicate(element, index), (accumulator: boolean): boolean => accumulator);
    }
    throw new TypeError("Predicate must be a function.");
};
/**
 * Creates collectors that report whether every element matches a predicate.
 *
 * The short-circuit is inverted compared with useAsynchronousAnyMatch: the
 * accumulator starts as true, an empty source finishes with true, and the first
 * rejected element stops further waiting on the asynchronous source.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousAllMatch {
    /**
     * Tests each element with a predicate that only receives the element value.
     *
     * Accumulation stops before the first element the predicate rejects, so a
     * failing element near the front leaves the remaining asynchronous values
     * unobserved.
     *
     * @template E - The source element type.
     * @param predicate - Decides whether an element is acceptable.
     * @returns A collector that finishes with false only when some element failed.
     */
    <E>(predicate: Predicate<E>): AsynchronousCollector<E, boolean, boolean>;
    /**
     * Tests each element with a predicate that also receives its encounter index.
     *
     * The bigint index advances in encounter order and lets the predicate treat
     * positions differently, for example by validating only the first element.
     *
     * @template E - The source element type.
     * @param predicate - Receives the element and its bigint encounter index.
     * @returns A collector that finishes with false only when some element failed.
     */
    <E>(predicate: BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests that every element matches, returning true when empty.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousAllMatch: UseAsynchronousAllMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return AsynchronousCollector.shortable((): boolean => true, (_element: E, _index: bigint, accumulator: boolean): boolean => isBoolean(accumulator) && !accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator && predicate(element, index), (accumulator: boolean): boolean => accumulator);
    }
    throw new TypeError("Predicate must be a function.");
};
/**
 * Creates a collector that counts elements as a bigint.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousCount: <E = unknown>() => AsynchronousCollector<E, bigint, bigint> = <E = unknown>(): AsynchronousCollector<E, bigint, bigint> => {
    return AsynchronousCollector.full((): bigint => 0n, (count: bigint): bigint => count + 1n, (count: bigint): bigint => count);
};
/**
 * Creates collectors that format elements into one text line, write it with
 * console.error and return the same text.
 *
 * The default form wraps the elements in square brackets and separates them with
 * commas. The other overloads replace the accumulator and optionally the
 * surrounding text. useAsynchronousLog prints with console.log instead, and
 * useAsynchronousJoin builds the same kind of text without writing it.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousError {
    /**
     * Formats with the default square-bracket and comma notation.
     *
     * Awaited elements are stringified and joined, the trailing comma is trimmed,
     * the closing bracket appended and the finished line written with console.error.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(): AsynchronousCollector<E, string, string>;
    /**
     * Uses a custom two-argument accumulator inside the default brackets.
     *
     * The accumulator receives the text built so far and the next awaited element;
     * the prefix and suffix stay "[" and "]" and the finished text goes to console.error.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the current text with the next element.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(accumulator: BiFunctional<string, E, string>): AsynchronousCollector<E, string, string>;
    /**
     * Uses a custom index-aware accumulator inside the default brackets.
     *
     * The accumulator additionally receives the bigint encounter index, which
     * lets numbering or positional formatting happen while the text is built.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the current text with the element and its index.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(accumulator: TriFunctional<string, E, bigint, string>): AsynchronousCollector<E, string, string>;
    /**
     * Wraps a two-argument accumulator in caller-supplied opening and closing text.
     *
     * The identity is the prefix, the accumulator appends elements and the suffix
     * is appended before the complete text is written with console.error.
     *
     * @template E - The source element type.
     * @param prefix - Text the accumulator starts from.
     * @param accumulator - Combines the current text with the next element.
     * @param suffix - Text appended before the result is printed.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): AsynchronousCollector<E, string, string>;
    /**
     * Wraps an index-aware accumulator in caller-supplied opening and closing text.
     *
     * The accumulator can use the bigint encounter index; prefix and suffix frame
     * the accumulated text and the finished line is written with console.error.
     *
     * @template E - The source element type.
     * @param prefix - Text the accumulator starts from.
     * @param accumulator - Combines the current text with the element and its index.
     * @param suffix - Text appended before the result is printed.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): AsynchronousCollector<E, string, string>;
}
;
/**
 * Creates a collector that formats elements, writes text with console.error and returns the text.
 *
 * @template E - The source element type.
 * @param argument1 - The opening text or string accumulator; omit for default formatting.
 * @param argument2 - The custom string accumulator when opening and closing text are supplied.
 * @param argument3 - The closing text.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousError: UseAsynchronousError = <E = unknown>(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): AsynchronousCollector<E, string, string> => {
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return AsynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.error(result);
            return result;
        });
    }
    else if (isFunction(argument1)) {
        let prefix: string = "[";
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = "]";
        return AsynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.error(result);
            return result;
        });
    }
    else {
        return AsynchronousCollector.full<E, string, string>((): string => "[", (accumulator: string, element: E): string => {
            if (isString(accumulator) && isString(element)) {
                return accumulator + element + ",";
            }
            return String(accumulator) + String(element) + ",";
        }, (text: string): string => {
            let result: string = text.substring(0, Math.max(1, text.length - 1)) + "]";
            console.error(result);
            return result;
        });
    }
};
/**
 * Accumulator state for the non-negative find-at collectors.
 *
 * It remembers the requested bigint position and the element found there. The
 * element field stays MaybeInvalid until the encounter counter reaches the
 * position, which is how the finder distinguishes "not reached" from a value.
 *
 * @template E - The source element type.
 */
interface FindAtAccumulator<E> {
    position: bigint;
    element: MaybeInvalid<E>;
}
/**
 * Repeats the find-at accumulator contract for declaration merging.
 *
 * TypeScript merges this declaration with the one above, so both find-at
 * factories and their overloads share a single accumulator shape.
 *
 * @template E - The source element type.
 */
interface FindAtAccumulator<E> {
    position: bigint;
    element: MaybeInvalid<E>;
}
/**
 * Creates collectors that return the element at a non-negative encounter position.
 *
 * The collector counts from 0n and interrupts the source once the requested
 * position has been accumulated, so early positions avoid draining the whole
 * stream. The finished value is a promise that rejects when no element is
 * available. Negative positions belong to useAsynchronousFindNegativeAt instead.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousFindAt {
    /**
     * Accepts the position as a number.
     *
     * The number is converted to the bigint encounter counter, which is convenient
     * for small literal positions but cannot express positions beyond the safe
     * integer range exactly. A missing element rejects the finished promise.
     *
     * @template E - The source element type.
     * @param index - The non-negative number position to select.
     * @returns A collector that finishes with a promise of the element at that position.
     */
    <E>(index: number): AsynchronousCollector<E, FindAtAccumulator<E>, Promise<E>>;
    /**
     * Accepts the position as a bigint.
     *
     * Keeping the position in bigint form avoids the range limits of number and
     * matches the bigint counter used internally, so very large positions remain
     * exact; a missing element rejects the finished promise.
     *
     * @template E - The source element type.
     * @param index - The non-negative bigint position to select.
     * @returns A collector that finishes with a promise of the element at that position.
     */
    <E>(index: bigint): AsynchronousCollector<E, FindAtAccumulator<E>, Promise<E>>;
}
/**
 * Creates a collector that selects a non-negative encounter position. The finished promise rejects when no element is available.
 *
 * @template E - The source element type.
 * @param index - The requested non-negative position, or a negative position for the negative-index factory.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFindAt: UseAsynchronousFindAt = <E>(index: number | bigint): AsynchronousCollector<E, FindAtAccumulator<E>, Promise<E>> => {
    let target: bigint = useToBigInt(index);
    if (target < 0n) {
        throw new Error("Use \"useAsynchronousFindNegativeAt\" for negative index.");
    }
    return AsynchronousCollector.shortable(((): FindAtAccumulator<E> => {
        return {
            position: 0n,
            element: (void 0)
        };
    }), (_element: E, _index: bigint, accumulator: FindAtAccumulator<E>): boolean => {
        return accumulator.position > target;
    }, (accumulator: FindAtAccumulator<E>, element: E): FindAtAccumulator<E> => {
        if (accumulator.position === target) {
            accumulator.element = element;
        }
        return {
            position: accumulator.position + 1n,
            element: accumulator.element
        };
    }, (accumulator: FindAtAccumulator<E>): Promise<E> => {
        return new Promise<E>((resolve: Consumer<E>, reject: Consumer<any>): void => {
            let element: MaybeInvalid<E> = accumulator.element;
            if (validate(element)) {
                resolve(element);
            }
            else {
                reject(new Error("Element could not be found with given index."));
            }
        });
    });
};
/**
 * Creates collectors that return an element counted backwards from the end.
 *
 * Every element is buffered because the length is only known when the source
 * ends; the negative position is then reduced modulo that length. The finished
 * promise rejects when the position does not resolve to a stored element, unlike
 * the streaming useAsynchronousFindAt factory.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousFindNegativeAt {
    /**
     * Accepts the negative position as a number.
     *
     * The position is resolved against the buffered length after the source
     * completes; number form is convenient for ordinary negative literals, and a
     * missing element rejects the finished promise.
     *
     * @template E - The source element type.
     * @param index - The negative number position to resolve from the end.
     * @returns A collector that finishes with a promise of the selected element.
     */
    <E>(index: number): AsynchronousCollector<E, Array<E>, Promise<E>>;
    /**
     * Accepts the negative position as a bigint.
     *
     * The whole calculation stays in bigint arithmetic, so positions near the
     * safe integer limits are reduced exactly against the collected length; a
     * missing element rejects the finished promise.
     *
     * @template E - The source element type.
     * @param index - The negative bigint position to resolve from the end.
     * @returns A collector that finishes with a promise of the selected element.
     */
    <E>(index: bigint): AsynchronousCollector<E, Array<E>, Promise<E>>;
}
;
/**
 * Creates a collector that buffers elements and resolves a negative position modulo the collected length. The finished promise rejects when no element is available.
 *
 * @template E - The source element type.
 * @param index - The requested non-negative position, or a negative position for the negative-index factory.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFindNegativeAt: UseAsynchronousFindNegativeAt = <E>(index: number | bigint): AsynchronousCollector<E, Array<E>, Promise<E>> => {
    let target: bigint = useToBigInt(index);
    if (target > -1n) {
        throw new Error("Use \"useAsynchronousFindAt\" for none-negative index.");
    }
    return AsynchronousCollector.full(() => [], (accumulator: Array<E>, element: E): Array<E> => {
        accumulator.push(element);
        return accumulator;
    }, (accumulator: Array<E>): Promise<E> => {
        return new Promise<E>((resolve, reject): void => {
            if (accumulator.length > 0) {
                let count: bigint = BigInt(accumulator.length);
                let limit: bigint = (((target) % count) + count) % count;
                let element: MaybeInvalid<E> = accumulator.at(Number(limit));
                if (validate(element)) {
                    resolve(element);
                }
                else {
                    reject("Element could not be found with given index.");
                }
            }
            else {
                reject("Not element to be found.");
            }
        });
    });
};
/**
 * Creates a collector that selects the first available element. The finished promise rejects when no element is available.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFindFirst: <E>() => AsynchronousCollector<E, Array<E>, Promise<E>> = <E>(): AsynchronousCollector<E, Array<E>, Promise<E>> => {
    return AsynchronousCollector.shortable((): Array<E> => [], (_element: E, _index: bigint, accumulator: Array<E>): boolean => validate(accumulator) && accumulator.length === 1, (accumulator: Array<E>, element: E): Array<E> => {
        if (validate(accumulator) && accumulator.length === 0) {
            accumulator.push(element);
            return accumulator;
        }
        return accumulator;
    }, (accumulator: Array<E>): Promise<E> => {
        if (validate(accumulator) && accumulator.length > 0) {
            return Promise.resolve(accumulator[0]);
        }
        return Promise.reject(new Error("No element found."));
    });
};
/**
 * Creates a collector that accepts each element with probability one half until selected; it may finish with undefined.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFindAny: <E>() => AsynchronousCollector<E, Array<E>, Promise<E>> = <E>(): AsynchronousCollector<E, Array<E>, Promise<E>> => {
    return AsynchronousCollector.shortable((): Array<E> => [], (_element: E, _index: bigint, accumulator: Array<E>): boolean => validate(accumulator) && accumulator.length == 1, (accumulator: Array<E>, element: E): Array<E> => {
        if (validate(accumulator) && accumulator.length === 0 && Math.random() < 0.5) {
            accumulator.push(element);
            return accumulator;
        }
        return accumulator;
    }, (accumulator: Array<E>): Promise<E> => Promise.resolve(accumulator[0]));
};
/**
 * Creates a collector that selects the last available element. An empty source resolves to undefined.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFindLast: <E>() => AsynchronousCollector<E, Array<E>, Promise<E>> = <E>(): AsynchronousCollector<E, Array<E>, Promise<E>> => {
    return AsynchronousCollector.full((): Array<E> => [], (accumulator: Array<E>, element: E): Array<E> => {
        if (validate(accumulator)) {
            accumulator.push(element);
        }
        return accumulator;
    }, (accumulator: Array<E>): Promise<E> => Promise.resolve(accumulator[accumulator.length - 1]));
};
const uninitializedResults: WeakSet<Promise<unknown>> = new WeakSet<Promise<unknown>>();
function uninitializedResult<E>(): Promise<E> {
    let result: Promise<E> = Promise.resolve(undefined as E);
    uninitializedResults.add(result);
    return result;
}
function observeResult<E>(result: Promise<E>): Promise<E> {
    void result.catch((): void => {});
    return result;
}
function finishResult<E>(result: Promise<E>): Promise<E> {
    return uninitializedResults.has(result) ? Promise.reject(new Error("No element found.")) : result;
}
/**
 * Creates collectors that select the greatest element seen.
 *
 * The collector keeps one running value rather than buffering the source, and
 * nullish elements are skipped. The finished promise rejects when no comparable
 * element exists. useAsynchronousFindMinimum is the mirrored factory.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousFindMaximum {
    /**
     * Compares with the library comparator from useCompare.
     *
     * The default comparator orders primitives and throws for values it cannot
     * order; callers with custom elements should pick the explicit overload.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with a promise of the greatest element.
     */
    <E>(): AsynchronousCollector<E, Promise<E>, Promise<E>>;
    /**
     * Compares with a caller-supplied comparator.
     *
     * The comparator receives the running greatest value first and the next
     * element second, and a negative result means the new element wins.
     *
     * @template E - The source element type.
     * @param comparator - Orders the running greatest value against the next element.
     * @returns A collector that finishes with a promise of the greatest element.
     */
    <E>(comparator: Comparator<E>): AsynchronousCollector<E, Promise<E>, Promise<E>>;
}
/**
 * Creates a collector that selects the greatest element according to the comparator. The finished promise rejects when no element is available.
 *
 * @template E - The source element type.
 * @param comparator - The element comparison function; defaults to the library comparator.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFindMaximum: UseAsynchronousFindMaximum = <E>(comparator: Comparator<E> = useCompare<E>): AsynchronousCollector<E, Promise<E>, Promise<E>> => {
    if (isFunction(comparator)) {
        return AsynchronousCollector.full(uninitializedResult<E>, (result: Promise<E>, element: E): Promise<E> => {
            if (uninitializedResults.has(result)) {
                return observeResult(Promise.resolve(element));
            }
            return observeResult(result.then((previous: E): E => comparator(previous, element) < 0 ? element : previous));
        }, finishResult<E>);
    }
    throw new TypeError("Invalid argument.");
};
/**
 * Creates collectors that select the least element seen.
 *
 * The mirror image of useAsynchronousFindMaximum: one running value is kept,
 * nullish elements are skipped, and the finished promise rejects when no
 * comparable element exists.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousFindMinimum {
    /**
     * Compares with the library comparator from useCompare.
     *
     * This default is intended for primitive elements; custom element types
     * should supply their own ordering through the other overload.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with a promise of the least element.
     */
    <E>(): AsynchronousCollector<E, Promise<E>, Promise<E>>;
    /**
     * Compares with a caller-supplied comparator.
     *
     * The comparator receives the running least value first and the next element
     * second, and a positive result means the new element wins.
     *
     * @template E - The source element type.
     * @param comparator - Orders the running least value against the next element.
     * @returns A collector that finishes with a promise of the least element.
     */
    <E>(comparator: Comparator<E>): AsynchronousCollector<E, Promise<E>, Promise<E>>;
}
/**
 * Creates a collector that selects the least element according to the comparator. The finished promise rejects when no element is available.
 *
 * @template E - The source element type.
 * @param comparator - The element comparison function; defaults to the library comparator.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFindMinimum: UseAsynchronousFindMinimum = <E>(comparator: Comparator<E> = useCompare<E>): AsynchronousCollector<E, Promise<E>, Promise<E>> => {
    if (isFunction(comparator)) {
        return AsynchronousCollector.full(uninitializedResult<E>, (result: Promise<E>, element: E): Promise<E> => {
            if (uninitializedResults.has(result)) {
                return observeResult(Promise.resolve(element));
            }
            return observeResult(result.then((previous: E): E => comparator(previous, element) > 0 ? element : previous));
        }, finishResult<E>);
    }
    throw new TypeError("Invalid argument.");
};
/**
 * Creates collectors that invoke a side effect for every awaited element.
 *
 * No element is retained: the accumulator is only the bigint count, so the
 * finished value tells how many elements were processed. It differs from
 * useAsynchronousToArray and the statistical collectors, which keep state.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousForEach {
    /**
     * Invokes an action that only receives the element value.
     *
     * The action runs during accumulation for every awaited element; interrupt
     * support comes from the collector machinery rather than the action itself.
     *
     * @template E - The source element type.
     * @param action - Consumes each element.
     * @returns A collector that finishes with the bigint number of elements visited.
     */
    <E>(action: Consumer<E>): AsynchronousCollector<E, bigint, bigint>;
    /**
     * Invokes an action that also receives the bigint encounter index.
     *
     * The index starts at 0n and increments once per visited element, letting the
     * side effect log or label positions in the asynchronous source.
     *
     * @template E - The source element type.
     * @param action - Consumes each element together with its index.
     * @returns A collector that finishes with the bigint number of elements visited.
     */
    <E>(action: BiConsumer<E, bigint>): AsynchronousCollector<E, bigint, bigint>;
}
;
/**
 * Creates a collector that invokes an action for every element and returns the bigint count processed.
 *
 * @template E - The source element type.
 * @param action - Receives each element and its optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousForEach: UseAsynchronousForEach = <E>(action: Consumer<E> | BiConsumer<E, bigint>): AsynchronousCollector<E, bigint, bigint> => {
    if (isFunction(action)) {
        return AsynchronousCollector.full((): bigint => 0n, (accumulator: bigint, element: E, index: bigint): bigint => {
            action(element, index);
            return accumulator + 1n;
        }, (accumulator: bigint): bigint => accumulator);
    }
    throw new TypeError("Action must be a function.");
};
/**
 * Creates collectors that report whether no element matches a predicate.
 *
 * The accumulator starts as true, an empty source finishes with true, and the
 * first accepted element interrupts the source and finishes with false. It is
 * the negation of useAsynchronousAnyMatch.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousNonMatch {
    /**
     * Tests with a predicate that only receives the element value.
     *
     * The accumulator starts as true; a predicate that returns true for any
     * element interrupts the source and forces the final answer to false.
     *
     * @template E - The source element type.
     * @param predicate - Decides whether an element is a match.
     * @returns A collector that finishes with true when nothing matched.
     */
    <E>(predicate: Predicate<E>): AsynchronousCollector<E, boolean, boolean>;
    /**
     * Tests with a predicate that also receives the bigint encounter index.
     *
     * The index allows position-sensitive rules such as "no element after the
     * first may match" while keeping the same short-circuit behaviour.
     *
     * @template E - The source element type.
     * @param predicate - Receives the element and its bigint encounter index.
     * @returns A collector that finishes with true when nothing matched.
     */
    <E>(predicate: BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests that no element matches, returning true when empty.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousNoneMatch: UseAsynchronousNonMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return AsynchronousCollector.shortable((): boolean => true, (_element: E, _index: bigint, accumulator: boolean): boolean => !accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator && !predicate(element, index), (accumulator: boolean): boolean => accumulator);
    }
    throw new TypeError("Predicate must be a function.");
};
/**
 * Creates collectors that format elements into one text line, write it with
 * console.log and return the same text.
 *
 * The overload set mirrors useAsynchronousError, which prints with console.error.
 * The default form uses square brackets and commas; other overloads replace the
 * accumulator or the surrounding text, while useAsynchronousJoin only returns text.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousLog {
    /**
     * Formats with the default square-bracket and comma notation.
     *
     * Awaited elements are stringified and joined, the trailing comma is trimmed,
     * the closing bracket appended and the finished line written with console.log.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(): AsynchronousCollector<E, string, string>;
    /**
     * Uses a custom two-argument accumulator inside the default brackets.
     *
     * The accumulator receives the running text and the next awaited element; the
     * default "[" and "]" framing is kept and the finished text is written with console.log.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the current text with the next element.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(accumulator: BiFunctional<string, E, string>): AsynchronousCollector<E, string, string>;
    /**
     * Uses a custom index-aware accumulator inside the default brackets.
     *
     * The accumulator also receives the bigint encounter index, allowing numbered
     * lines while keeping the default bracket framing and console.log output.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the current text with the element and its index.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(accumulator: TriFunctional<string, E, bigint, string>): AsynchronousCollector<E, string, string>;
    /**
     * Wraps a two-argument accumulator in caller-supplied opening and closing text.
     *
     * The prefix seeds the accumulator, the suffix is appended by the finisher and
     * the complete line is written with console.log instead of console.error.
     *
     * @template E - The source element type.
     * @param prefix - Text the accumulator starts from.
     * @param accumulator - Combines the current text with the next element.
     * @param suffix - Text appended before the result is printed.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): AsynchronousCollector<E, string, string>;
    /**
     * Wraps an index-aware accumulator in caller-supplied opening and closing text.
     *
     * The accumulator may use the bigint encounter index, prefix and suffix frame
     * the result, and the finished line is written with console.log.
     *
     * @template E - The source element type.
     * @param prefix - Text the accumulator starts from.
     * @param accumulator - Combines the current text with the element and its index.
     * @param suffix - Text appended before the result is printed.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): AsynchronousCollector<E, string, string>;
}
;
/**
 * Creates a collector that formats elements, writes text with console.log and returns the text.
 *
 * @template E - The source element type.
 * @param argument1 - The opening text or string accumulator; omit for default formatting.
 * @param argument2 - The custom string accumulator when opening and closing text are supplied.
 * @param argument3 - The closing text.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousLog: UseAsynchronousLog = <E = unknown>(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): AsynchronousCollector<E, string, string> => {
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return AsynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.log(result);
            return result;
        });
    }
    else if (isFunction(argument1)) {
        let prefix: string = "[";
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = "]";
        return AsynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.log(result);
            return result;
        });
    }
    else {
        return AsynchronousCollector.full<E, string, string>((): string => "[", (accumulator: string, element: E): string => {
            if (isString(accumulator) && isString(element)) {
                return accumulator + element + ",";
            }
            return String(accumulator) + String(element) + ",";
        }, (text: string): string => {
            let result: string = text.substring(0, Math.max(1, text.length - 1)) + "]";
            console.log(result);
            return result;
        });
    }
};
