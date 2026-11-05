import type {
    AsynchronousCollection,
    AsynchronousList,
    AsynchronousMapContract,
    AsynchronousMapEntry,
    AsynchronousSetContract,
    Optional,
    SynchronousCollection,
    SynchronousList,
    SynchronousMapContract,
    SynchronousMapEntry,
    SynchronousSetContract,
    // Updated for the 1.2.0 -> 1.3.0 structure split: map entry views are their
    // own unordered set variant, not the removed generic `Set` name.
    AsynchronousUnorderedSet,
    SynchronousUnorderedSet,
} from 'semantic-typescript';

export function synchronousContracts(
    list: SynchronousList<bigint>,
    // Updated for the 1.2.0 -> 1.3.0 structure split: `SynchronousSet`/`SynchronousMap`
    // were replaced by the Contract base interfaces plus the ordered/unordered
    // variants. These functions exercise family-wide base behaviour, so the
    // Contract types are the faithful replacement.
    set: SynchronousSetContract<bigint>,
    map: SynchronousMapContract<string, bigint>,
): void {
    const collection: SynchronousCollection<bigint> = list;
    const added: boolean = list.add(1n);
    const inserted: void = list.add(0n, 2n);
    const appended: boolean = list.addAll(set);
    const insertedAll: boolean = list.addAll(0n, set);
    const removedByValue: boolean = list.remove(1n);
    const removedByIndex: bigint = list.removeAt(0n);
    const element: bigint = list.get(0n);
    const previous: bigint = list.set(0n, 3n);
    const first: Optional<bigint> = list.peekFront();
    const range: SynchronousList<bigint> = list.subList(0n, 1n);
    const index: bigint = list.indexOf(1n);
    const retained: boolean = list.retainAll(set);
    const filtered: boolean = list.removeIf(value => value < 0n);
    list.replaceAll(value => value + 1n);
    list.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
    // Updated for the 1.2.0 -> 1.3.0 definition change: set algebra on the family
    // base returns the base set Contract.
    const union: SynchronousSetContract<bigint> = set.union(list);
    const intersection: SynchronousSetContract<bigint> = set.intersection(list);
    const complement: SynchronousSetContract<bigint> = set.complement(list);
    const value: Optional<bigint> = map.get('key');
    const replaced: Optional<bigint> = map.put('key', 1n);
    const removed: Optional<bigint> = map.remove('key');
    const conditionalRemoval: boolean = map.remove('key', 1n);
    const oldValue: Optional<bigint> = map.replace('key', 2n);
    const conditionalReplacement: boolean = map.replace('key', 1n, 2n);
    const computed: Optional<bigint> = map.compute('key', (_key, current) => current ?? 1n);
    const absent: Optional<bigint> = map.computeIfAbsent('key', key => BigInt(key.length));
    const present: Optional<bigint> = map.computeIfPresent('key', (_key, current) => current > 0n ? current : null);
    const merged: Optional<bigint> = map.merge('key', 1n, (left, right) => left + right);
    const keys: SynchronousSetContract<string> = map.keySet();
    const values: SynchronousCollection<bigint> = map.values();
    const entries: SynchronousUnorderedSet<SynchronousMapEntry<string, bigint>> = map.entrySet();
    const size: bigint = map.size();
    void [collection, added, inserted, appended, insertedAll, removedByValue,
        removedByIndex, element, previous, first, range, index, retained, filtered,
        union, intersection, complement, value, replaced, removed, conditionalRemoval,
        oldValue, conditionalReplacement, computed, absent, present, merged, keys,
        values, entries, size];
    // @ts-expect-error list indices follow the bigint collection-size convention.
    list.get(0);
    // @ts-expect-error maps must not be treated as element collections.
    const invalidCollection: SynchronousCollection<bigint> = map;
    void invalidCollection;
}

export async function asynchronousContracts(
    list: AsynchronousList<bigint>,
    // Updated for the 1.2.0 -> 1.3.0 structure split: see the synchronous case.
    set: AsynchronousSetContract<bigint>,
    map: AsynchronousMapContract<string, bigint>,
): Promise<void> {
    const collection: AsynchronousCollection<bigint> = list;
    const added: boolean = await list.add(1n);
    const inserted: void = await list.add(0n, 2n);
    const appended: boolean = await list.addAll(set);
    const insertedAll: boolean = await list.addAll(0n, set);
    const removedByValue: boolean = await list.remove(1n);
    const removedByIndex: bigint = await list.removeAt(0n);
    const first: Optional<bigint> = await list.peekFront();
    const range: AsynchronousList<bigint> = await list.subList(0n, 1n);
    const union: AsynchronousSetContract<bigint> = await set.union(list);
    const intersection: AsynchronousSetContract<bigint> = await set.intersection(list);
    const complement: AsynchronousSetContract<bigint> = await set.complement(list);
    const previous: bigint | void = await map.put('key', 1n);
    const insertedValue: bigint | void = await map.putIfAbsent('key', 2n);
    const retrieved: bigint = await map.get('key');
    void [insertedValue, retrieved];
    const removed: bigint = await map.remove('key');
    const conditionalRemoval: boolean = await map.remove('key', 1n);
    const oldValue: bigint = await map.replace('key', 2n);
    const conditionalReplacement: boolean = await map.replace('key', 1n, 2n);
    const computed: bigint = await map.compute('key', (_key, value) => value ?? 1n);
    const absent: bigint = await map.computeIfAbsent('key', key => BigInt(key.length));
    const present: bigint = await map.computeIfPresent('key', (_key, value) => value > 0n ? value : undefined);
    const merged: bigint = await map.merge('key', 1n, (left, right) => left + right);
    const keys: AsynchronousSetContract<string> = await map.keySet();
    const values: AsynchronousCollection<bigint> = await map.values();
    const entries: AsynchronousUnorderedSet<AsynchronousMapEntry<string, bigint>> = await map.entrySet();
    const size: bigint = await map.size();
    const cleared: void = map.clear();
    const listCleared: void = list.clear();
    const iterator: Iterator<bigint> = list[Symbol.iterator]();
    void [collection, added, inserted, appended, insertedAll, removedByValue,
        removedByIndex, first, range, union, intersection, complement, previous,
        removed, conditionalRemoval, oldValue, conditionalReplacement, computed,
        absent, present, merged, keys, values, entries, size, cleared, listCleared,
        iterator];
    // @ts-expect-error indexed values must be awaited before use.
    const notAwaited: bigint = list.get(0n);
    void notAwaited;
    // @ts-expect-error synchronous and asynchronous collections are distinct.
    const synchronous: SynchronousCollection<bigint> = list;
    void synchronous;
}
