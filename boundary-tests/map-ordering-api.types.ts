import type {
    AsynchronousCollection,
    // Updated for the 1.2.0 -> 1.3.0 structure split: the shared `SynchronousMap`
    // and `AsynchronousMap` names were removed in favour of the explicit
    // ordered/unordered variants; the family-wide base is the Contract interface.
    AsynchronousMapContract, SynchronousMapContract,
    AsynchronousOrderedMap, AsynchronousUnorderedMap,
    SynchronousOrderedMap, SynchronousUnorderedMap,
    AsynchronousOrderedLRUMap, AsynchronousUnorderedLRUMap,
    SynchronousOrderedLRUMap, SynchronousUnorderedLRUMap,
    AsynchronousOrderedSkipMap, AsynchronousUnorderedSkipMap,
    SynchronousOrderedSkipMap, SynchronousUnorderedSkipMap,
    AsynchronousSkipSet, SynchronousSkipSet,
} from 'semantic-typescript';
import { isAsynchronousOrderedSkipMap, isSynchronousUnorderedLRUMap } from 'semantic-typescript';

export function synchronousOrdering(
    ordered: SynchronousOrderedMap<string, bigint>,
    unordered: SynchronousUnorderedMap<string, bigint>,
    orderedLRU: SynchronousOrderedLRUMap<string, bigint>,
    unorderedLRU: SynchronousUnorderedLRUMap<string, bigint>,
    orderedSkip: SynchronousOrderedSkipMap<string, bigint>,
    unorderedSkip: SynchronousUnorderedSkipMap<string, bigint>,
): void {
    const orderedBase: SynchronousOrderedMap<string, bigint>[] = [ordered, orderedLRU, orderedSkip];
    const unorderedBase: SynchronousUnorderedMap<string, bigint>[] = [unordered, unorderedLRU, unorderedSkip];
    // Updated for the 1.2.0 -> 1.3.0 structure split: ordered and unordered maps
    // share only the family-wide Contract base, so the union narrows to it.
    const base: SynchronousMapContract<string, bigint>[] = [...orderedBase, ...unorderedBase];
    const flag: true = orderedSkip.ordered;
    const otherFlag: false = unorderedSkip.ordered;
    const orderedRange: SynchronousOrderedSkipMap<string, bigint> = orderedSkip.subMap('a', true, 'z', false).descendingMap();
    const unorderedRange: SynchronousUnorderedSkipMap<string, bigint> = unorderedSkip.subMap('a', 'z').headMap('m').tailMap('b');
    const keys: SynchronousSkipSet<string> = orderedSkip.keySet();
    const navigable: SynchronousSkipSet<string> = unorderedSkip.navigableKeySet();
    void [base, flag, otherFlag, orderedRange, unorderedRange, keys, navigable];
    // @ts-expect-error ordered and unordered interfaces have distinct brands and discriminants.
    const invalid: SynchronousOrderedMap<string, bigint> = unordered;
    void invalid;
    // @ts-expect-error an unordered map's ordinary key view need not be navigable.
    unorderedSkip.keySet().lower('a');
}

export async function asynchronousOrdering(
    ordered: AsynchronousOrderedMap<string, bigint>,
    unordered: AsynchronousUnorderedMap<string, bigint>,
    orderedLRU: AsynchronousOrderedLRUMap<string, bigint>,
    unorderedLRU: AsynchronousUnorderedLRUMap<string, bigint>,
    orderedSkip: AsynchronousOrderedSkipMap<string, bigint>,
    unorderedSkip: AsynchronousUnorderedSkipMap<string, bigint>,
    collection: AsynchronousCollection<bigint>,
): Promise<void> {
    const orderedBase: AsynchronousOrderedMap<string, bigint>[] = [ordered, orderedLRU, orderedSkip];
    const unorderedBase: AsynchronousUnorderedMap<string, bigint>[] = [unordered, unorderedLRU, unorderedSkip];
    const base: AsynchronousMapContract<string, bigint>[] = [...orderedBase, ...unorderedBase];
    const orderedRange: AsynchronousOrderedSkipMap<string, bigint> = await orderedSkip.subMap('a', 'z');
    const unorderedRange: AsynchronousUnorderedSkipMap<string, bigint> = await unorderedSkip.descendingMap();
    const keys: AsynchronousSkipSet<string> = await orderedSkip.keySet();
    const navigable: AsynchronousSkipSet<string> = await unorderedSkip.descendingKeySet();
    const stream: AsynchronousCollection<bigint> = collection.stream();
    // @ts-expect-error stream creation is synchronous; the view handles asynchronous work.
    const wrapped: Promise<AsynchronousCollection<bigint>> = collection.stream();
    void [base, orderedRange, unorderedRange, keys, navigable, stream, wrapped];
}

export function rejectUnbrandedStructure(collection: AsynchronousCollection<bigint>): void {
    type UnbrandedCollection = Omit<AsynchronousCollection<bigint>, symbol>;
    const structural: UnbrandedCollection = collection;
    // @ts-expect-error matching methods do not supply the required symbol brand.
    const branded: AsynchronousCollection<bigint> = structural;
    void branded;
}

export function narrowedStructure(target: unknown): void {
    if (isAsynchronousOrderedSkipMap(target)) {
        const map: AsynchronousOrderedSkipMap<unknown, unknown> = target;
        const ordered: true = target.ordered;
        void [map, ordered];
    }
    if (isSynchronousUnorderedLRUMap(target)) {
        const map: SynchronousUnorderedLRUMap<unknown, unknown> = target;
        const ordered: false = target.ordered;
        void [map, ordered];
    }
}
