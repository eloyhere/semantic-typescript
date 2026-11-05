/**
 * Synchronous collectors that inspect elements without materialising them:
 * existential and universal predicates, positional lookups, counting, iteration and
 * diagnostic terminals.
 */
import { isFunction, isBigInt, isBoolean, isString } from "#semantic/guard";
import { useCompare, useToBigInt } from "#semantic/hook";
import { Optional } from "#semantic/optional";
import { SynchronousCollector } from "#semantic/synchronous/collector";
import type { BiFunctional, BiPredicate, Predicate, TriFunctional, Consumer, BiConsumer, Comparator, MaybeInvalid } from "#semantic/utility";
import { invalidate } from "#semantic/utility";

/**
 * Creates collectors that report whether at least one element matches a predicate.
 *
 * The collector short-circuits on the first accepted element and finishes with
 * true; an empty source finishes with false. It is the existential counterpart of
 * useSynchronousAllMatch and the inverse of useSynchronousNoneMatch.
 *
 * @template E - The source element type.
 */
interface UseSynchronousAnyMatch {
    /**
     * Tests each element with a predicate that only receives the element value.
     *
     * The accumulator starts as false, so an empty or fully rejected source
     * finishes with false, and a true answer interrupts the source immediately.
     *
     * @template E - The source element type.
     * @param predicate - Decides whether an element counts as a match.
     * @returns A collector that finishes with true when a match was seen.
     */
    <E>(predicate: Predicate<E>): SynchronousCollector<E, boolean, boolean>;
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
    <E>(predicate: BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests for a matching element and stops after a match.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousAnyMatch: UseSynchronousAnyMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return SynchronousCollector.shortable((): boolean => false, (_element: E, _index: bigint, accumulator: boolean): boolean => isBoolean(accumulator) && accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator || predicate(element, index), (accumulator: boolean): boolean => accumulator);
    }
    throw new TypeError("Predicate must be a function.");
};
/**
 * Creates collectors that report whether every element matches a predicate.
 *
 * The short-circuit is inverted compared with useSynchronousAnyMatch: the
 * accumulator starts as true, an empty source finishes with true, and the first
 * rejected element interrupts the source and finishes with false.
 *
 * @template E - The source element type.
 */
interface UseSynchronousAllMatch {
    /**
     * Tests each element with a predicate that only receives the element value.
     *
     * Accumulation stops before the first element the predicate rejects, so a
     * failing element near the front leaves the rest of the stream unconsumed.
     *
     * @template E - The source element type.
     * @param predicate - Decides whether an element is acceptable.
     * @returns A collector that finishes with false only when some element failed.
     */
    <E>(predicate: Predicate<E>): SynchronousCollector<E, boolean, boolean>;
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
    <E>(predicate: BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests that every element matches, returning true when empty.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousAllMatch: UseSynchronousAllMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return SynchronousCollector.shortable((): boolean => true, (_element: E, _index: bigint, accumulator: boolean): boolean => isBoolean(accumulator) && !accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator && predicate(element, index), (accumulator: boolean): boolean => accumulator);
    }
    throw new TypeError("Predicate must be a function.");
};
/**
 * Creates a collector that counts elements as a bigint.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousCount: <E = unknown>() => SynchronousCollector<E, bigint, bigint> = <E = unknown>(): SynchronousCollector<E, bigint, bigint> => {
    return SynchronousCollector.full((): bigint => 0n, (count: bigint): bigint => isBigInt(count) ? (count + 1n) : 1n, (count: bigint): bigint => isBigInt(count) ? count : 0n);
};
/**
 * Creates collectors that format elements into one text line, write it with
 * console.error and return the same text.
 *
 * The default form wraps the elements in square brackets and separates them with
 * commas. The other overloads replace the accumulator and optionally the
 * surrounding text. useSynchronousLog prints with console.log instead, and
 * useSynchronousJoin builds the same kind of text without writing it.
 *
 * @template E - The source element type.
 */
interface UseSynchronousError {
    /**
     * Formats with the default square-bracket and comma notation.
     *
     * Elements are stringified and joined, a trailing comma is trimmed, the
     * closing bracket is appended and the resulting line goes to console.error.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(): SynchronousCollector<E, string, string>;
    /**
     * Uses a custom two-argument accumulator inside the default brackets.
     *
     * The accumulator receives the text built so far and the next element; the
     * prefix and suffix stay "[" and "]" and the finished text is sent to console.error.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the current text with the next element.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(accumulator: BiFunctional<string, E, string>): SynchronousCollector<E, string, string>;
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
    <E = unknown>(accumulator: TriFunctional<string, E, bigint, string>): SynchronousCollector<E, string, string>;
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
    <E = unknown>(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): SynchronousCollector<E, string, string>;
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
    <E = unknown>(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): SynchronousCollector<E, string, string>;
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
export let useSynchronousError: UseSynchronousError = <E = unknown>(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): SynchronousCollector<E, string, string> => {
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return SynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.error(result);
            return result;
        });
    }
    else if (isFunction(argument1)) {
        let prefix: string = "[";
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = "]";
        return SynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.error(result);
            return result;
        });
    }
    else {
        return SynchronousCollector.full<E, string, string>((): string => "[", (accumulator: string, element: E): string => {
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
 * stream. Missing or nullish matches finish as an empty Optional. Negative
 * positions belong to useSynchronousFindNegativeAt instead.
 *
 * @template E - The source element type.
 */
interface UseSynchronousFindAt {
    /**
     * Accepts the position as a number.
     *
     * The number is converted to the bigint encounter counter, which is convenient
     * for small literal positions but cannot express positions beyond the safe
     * integer range exactly.
     *
     * @template E - The source element type.
     * @param index - The non-negative number position to select.
     * @returns A collector that finishes with the element at that position, if any.
     */
    <E>(index: number): SynchronousCollector<E, FindAtAccumulator<E>, Optional<E>>;
    /**
     * Accepts the position as a bigint.
     *
     * Keeping the position in bigint form avoids the range limits of number and
     * matches the bigint counter used internally, so very large positions remain exact.
     *
     * @template E - The source element type.
     * @param index - The non-negative bigint position to select.
     * @returns A collector that finishes with the element at that position, if any.
     */
    <E>(index: bigint): SynchronousCollector<E, FindAtAccumulator<E>, Optional<E>>;
}
/**
 * Creates a collector that selects a non-negative encounter position. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @param index - The requested non-negative position, or a negative position for the negative-index factory.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindAt: UseSynchronousFindAt = <E>(index: number | bigint): SynchronousCollector<E, FindAtAccumulator<E>, Optional<E>> => {
    let target: bigint = useToBigInt(index);
    if (target < 0n) {
        throw new Error("use \"useSynchronousFindNegativeAt\" for negative index.");
    }
    return SynchronousCollector.shortable(((): FindAtAccumulator<E> => {
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
    }, (accumulator: FindAtAccumulator<E>): Optional<E> => {
        return Optional.of(accumulator.element);
    });
};
/**
 * Creates collectors that return an element counted backwards from the end.
 *
 * Every element is buffered because the length is only known when the source
 * ends; the negative position is then reduced modulo that length. A position that
 * does not resolve to a stored element finishes as an empty Optional, unlike the
 * streaming useSynchronousFindAt factory.
 *
 * @template E - The source element type.
 */
interface UseSynchronousFindNegativeAt {
    /**
     * Accepts the negative position as a number.
     *
     * The position is resolved against the buffered length after the source
     * completes; number form is convenient for ordinary negative literals.
     *
     * @template E - The source element type.
     * @param index - The negative number position to resolve from the end.
     * @returns A collector that finishes with the selected element, if any.
     */
    <E>(index: number): SynchronousCollector<E, Array<E>, Optional<E>>;
    /**
     * Accepts the negative position as a bigint.
     *
     * The whole calculation stays in bigint arithmetic, so positions near the
     * safe integer limits are reduced exactly against the collected length.
     *
     * @template E - The source element type.
     * @param index - The negative bigint position to resolve from the end.
     * @returns A collector that finishes with the selected element, if any.
     */
    <E>(index: bigint): SynchronousCollector<E, Array<E>, Optional<E>>;
}
;
/**
 * Creates a collector that buffers elements and resolves a negative position modulo the collected length. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @param index - The requested non-negative position, or a negative position for the negative-index factory.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindNegativeAt: UseSynchronousFindNegativeAt = <E>(index: number | bigint): SynchronousCollector<E, Array<E>, Optional<E>> => {
    let target: bigint = useToBigInt(index);
    if (target > -1n) {
        throw new Error("use \"useSynchronousFindAt\" for none-negative index.");
    }
    return SynchronousCollector.full(() => [], (accumulator: Array<E>, element: E): Array<E> => {
        accumulator.push(element);
        return accumulator;
    }, (accumulator: Array<E>): Optional<E> => {
        if (accumulator.length > 0) {
            let count: bigint = BigInt(accumulator.length);
            let limit: bigint = ((target % count) + count) % count;
            let element: MaybeInvalid<E> = accumulator.at(Number(limit));
            return Optional.of(element);
        }
        return Optional.empty();
    });
};
/**
 * Creates a collector that selects the first non-nullish element, stopping once it is present.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindFirst: <E>() => SynchronousCollector<E, Optional<E>, Optional<E>> = <E>(): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    return SynchronousCollector.shortable((): Optional<E> => Optional.empty<E>(), (_element: E, _index: bigint, accumulator: Optional<E>): boolean => accumulator.isPresent(), (accumulator: Optional<E>, element: E): Optional<E> => {
        if (accumulator.isPresent() || invalidate(element)) {
            return accumulator;
        }
        return Optional.of(element);
    }, (result: Optional<E>): Optional<E> => result);
};
/**
 * Creates a collector that selects the first non-nullish element, stopping once it is present.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindAny: <E>() => SynchronousCollector<E, Optional<E>, Optional<E>> = <E>(): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    return SynchronousCollector.shortable((): Optional<E> => Optional.empty<E>(), (_element: E, _index: bigint, accumulator: Optional<E>): boolean => accumulator.isPresent(), (accumulator: Optional<E>, element: E): Optional<E> => {
        if (accumulator.isPresent() || invalidate(element)) {
            return accumulator;
        }
        return Optional.of(element);
    }, (result: Optional<E>): Optional<E> => result);
};
/**
 * Creates a collector that selects the last available element. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindLast: <E>() => SynchronousCollector<E, Optional<E>, Optional<E>> = <E>(): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    return SynchronousCollector.full((): Optional<E> => Optional.empty<E>(), (accumulator: Optional<E>, element: E): Optional<E> => {
        if (invalidate(element)) {
            return accumulator;
        }
        return Optional.of(element);
    }, (result: Optional<E>): Optional<E> => result);
};
/**
 * Creates collectors that select the greatest element seen.
 *
 * The collector keeps one running value rather than buffering the source, and
 * nullish elements are skipped. An empty or entirely nullish source finishes as
 * an empty Optional. useSynchronousFindMinimum is the mirrored factory.
 *
 * @template E - The source element type.
 */
interface UseSynchronousFindMaximum {
    /**
     * Compares with the library comparator from useCompare.
     *
     * The default comparator orders primitives and throws for values it cannot
     * order, so callers with custom elements should pick the explicit overload.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the greatest element, if any.
     */
    <E>(): SynchronousCollector<E, Optional<E>, Optional<E>>;
    /**
     * Compares with a caller-supplied comparator.
     *
     * The comparator receives the running greatest value first and the next
     * element second, and a negative result means the new element wins.
     *
     * @template E - The source element type.
     * @param comparator - Orders the running greatest value against the next element.
     * @returns A collector that finishes with the greatest element, if any.
     */
    <E>(comparator: Comparator<E>): SynchronousCollector<E, Optional<E>, Optional<E>>;
}
/**
 * Creates a collector that selects the greatest element according to the comparator. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @param comparator - The element comparison function; defaults to the library comparator.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindMaximum: UseSynchronousFindMaximum = <E>(comparator: Comparator<E> = useCompare<E>): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    if (isFunction(comparator)) {
        return SynchronousCollector.full((): Optional<E> => Optional.empty<E>(), (accumulator: Optional<E>, element: E): Optional<E> => {
            if (invalidate(element)) {
                return accumulator;
            }
            if (!accumulator.isPresent()) {
                return Optional.of(element);
            }
            return accumulator.map((previous: E): E => {
                return comparator(previous, element) >= 0 ? previous : element;
            });
        }, (result: Optional<E>): Optional<E> => result);
    }
    throw new TypeError("Invalid argument.");
};
/**
 * Creates collectors that select the least element seen.
 *
 * The mirror image of useSynchronousFindMaximum: one running value is kept,
 * nullish elements are skipped, and an empty source finishes as an empty Optional.
 *
 * @template E - The source element type.
 */
interface UseSynchronousFindMinimum {
    /**
     * Compares with the library comparator from useCompare.
     *
     * This default is intended for primitive elements; custom element types
     * should supply their own ordering through the other overload.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the least element, if any.
     */
    <E>(): SynchronousCollector<E, Optional<E>, Optional<E>>;
    /**
     * Compares with a caller-supplied comparator.
     *
     * The comparator receives the running least value first and the next element
     * second, and a positive result means the new element wins.
     *
     * @template E - The source element type.
     * @param comparator - Orders the running least value against the next element.
     * @returns A collector that finishes with the least element, if any.
     */
    <E>(comparator: Comparator<E>): SynchronousCollector<E, Optional<E>, Optional<E>>;
}
/**
 * Creates a collector that selects the least element according to the comparator. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @param comparator - The element comparison function; defaults to the library comparator.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindMinimum: UseSynchronousFindMinimum = <E>(comparator: Comparator<E> = useCompare<E>): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    if (isFunction(comparator)) {
        return SynchronousCollector.full((): Optional<E> => Optional.empty<E>(), (accumulator: Optional<E>, element: E): Optional<E> => {
            if (invalidate(element)) {
                return accumulator;
            }
            if (!accumulator.isPresent()) {
                return Optional.of(element);
            }
            return accumulator.map((previous: E): E => {
                return comparator(previous, element) <= 0 ? previous : element;
            });
        }, (result: Optional<E>): Optional<E> => result);
    }
    throw new TypeError("Invalid argument.");
};
/**
 * Creates collectors that invoke a side effect for every element.
 *
 * No element is retained: the accumulator is only the bigint count, so the
 * finished value tells how many elements were processed. It differs from
 * useSynchronousToArray and the statistical collectors, which keep state.
 *
 * @template E - The source element type.
 */
interface UseSynchronousForEach {
    /**
     * Invokes an action that only receives the element value.
     *
     * The action runs during accumulation for every visited element; interrupt
     * support comes from the collector machinery rather than the action itself.
     *
     * @template E - The source element type.
     * @param action - Consumes each element.
     * @returns A collector that finishes with the bigint number of elements visited.
     */
    <E>(action: Consumer<E>): SynchronousCollector<E, bigint, bigint>;
    /**
     * Invokes an action that also receives the bigint encounter index.
     *
     * The index starts at 0n and increments once per visited element, letting the
     * side effect log or label positions in the source.
     *
     * @template E - The source element type.
     * @param action - Consumes each element together with its index.
     * @returns A collector that finishes with the bigint number of elements visited.
     */
    <E>(action: BiConsumer<E, bigint>): SynchronousCollector<E, bigint, bigint>;
}
;
/**
 * Creates a collector that invokes an action for every element and returns the bigint count processed.
 *
 * @template E - The source element type.
 * @param action - Receives each element and its optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousForEach: UseSynchronousForEach = <E>(action: Consumer<E> | BiConsumer<E, bigint>): SynchronousCollector<E, bigint, bigint> => {
    if (isFunction(action)) {
        return SynchronousCollector.full((): bigint => 0n, (accumulator: bigint, element: E, index: bigint): bigint => {
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
 * the negation of useSynchronousAnyMatch.
 *
 * @template E - The source element type.
 */
interface UseSynchronousNonMatch {
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
    <E>(predicate: Predicate<E>): SynchronousCollector<E, boolean, boolean>;
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
    <E>(predicate: BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests that no element matches, returning true when empty.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNoneMatch: UseSynchronousNonMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return SynchronousCollector.shortable((): boolean => true, (_element: E, _index: bigint, accumulator: boolean): boolean => !accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator && !predicate(element, index), (accumulator: boolean): boolean => accumulator);
    }
    throw new TypeError("Predicate must be a function.");
};
/**
 * Creates collectors that format elements into one text line, write it with
 * console.log and return the same text.
 *
 * The overload set mirrors useSynchronousError, which prints with console.error.
 * The default form uses square brackets and commas; other overloads replace the
 * accumulator or the surrounding text, while useSynchronousJoin only returns text.
 *
 * @template E - The source element type.
 */
interface UseSynchronousLog {
    /**
     * Formats with the default square-bracket and comma notation.
     *
     * Elements are stringified and joined, the trailing comma is trimmed, the
     * closing bracket appended and the finished line written with console.log.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(): SynchronousCollector<E, string, string>;
    /**
     * Uses a custom two-argument accumulator inside the default brackets.
     *
     * The accumulator receives the running text and the next element; the default
     * "[" and "]" framing is kept and the finished text is written with console.log.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the current text with the next element.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(accumulator: BiFunctional<string, E, string>): SynchronousCollector<E, string, string>;
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
    <E = unknown>(accumulator: TriFunctional<string, E, bigint, string>): SynchronousCollector<E, string, string>;
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
    <E = unknown>(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): SynchronousCollector<E, string, string>;
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
    <E = unknown>(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): SynchronousCollector<E, string, string>;
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
export let useSynchronousLog: UseSynchronousLog = <E = unknown>(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): SynchronousCollector<E, string, string> => {
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return SynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.log(result);
            return result;
        });
    }
    else if (isFunction(argument1)) {
        let prefix: string = "[";
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = "]";
        return SynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.log(result);
            return result;
        });
    }
    else {
        return SynchronousCollector.full<E, string, string>((): string => "[", (accumulator: string, element: E): string => {
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
