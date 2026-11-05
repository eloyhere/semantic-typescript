import type {
    AsynchronousLRUList, AsynchronousLRUSet, AsynchronousLRUMap,
    SynchronousLRUList, SynchronousLRUSet, SynchronousLRUMap,
    AsynchronousSkipList, AsynchronousSkipSet, AsynchronousSkipMap,
    SynchronousSkipList, SynchronousSkipSet, SynchronousSkipMap,
    // Updated for the 1.2.0 -> 1.3.0 structure split: the shared `Set`/`Map`
    // names were removed. Positions that only need the family-wide base now use
    // the Contract interfaces (which `src/index.ts` must export); the concrete
    // ordered/unordered variants are covered in map-ordering-api.types.ts.
    AsynchronousList, AsynchronousSetContract, AsynchronousMapContract, AsynchronousMapEntry,
    SynchronousList, SynchronousSetContract, SynchronousMapContract, SynchronousMapEntry,
    Optional, Comparator,
} from 'semantic-typescript';

export function synchronousAdvancedContracts(
    list: SynchronousLRUList<bigint>,
    set: SynchronousLRUSet<bigint>,
    map: SynchronousLRUMap<string, bigint>,
    skipList: SynchronousSkipList<bigint>,
    skipSet: SynchronousSkipSet<bigint>,
    skipMap: SynchronousSkipMap<string, bigint>,
): void {
    const baseList: SynchronousList<bigint> = list;
    // Updated for the 1.2.0 -> 1.3.0 definition change: the LRU set/map extend the
    // family-wide Contract interfaces, so those are the base types to assert.
    const baseSet: SynchronousSetContract<bigint> = set;
    const baseMap: SynchronousMapContract<string, bigint> = map;
    const capacity: bigint = list.capacity();
    list.setCapacity(10n);
    list.touch(0n);
    set.setCapacity(10n);
    map.setCapacity(10n);
    const touched: boolean = set.touch(1n);
    const accessed: boolean = map.touch('key');
    const oldest: Optional<bigint> = list.peekLeastRecent();
    const newest: Optional<bigint> = set.peekMostRecent();
    const evicted: Optional<SynchronousMapEntry<string, bigint>> = map.pollLeastRecent();
    const range: SynchronousSkipList<bigint> = skipList.subList(0n, 1n);
    const comparator: Comparator<bigint> = skipSet.comparator();
    const lower: Optional<bigint> = skipSet.lower(1n);
    const first: Optional<bigint> = skipSet.first();
    const subset: SynchronousSkipSet<bigint> = skipSet.subSet(1n, 5n);
    const inclusiveSubset: SynchronousSkipSet<bigint> = skipSet.subSet(1n, true, 5n, true);
    const reversed: SynchronousSkipSet<bigint> = skipSet.descendingSet();
    const iterator: Iterator<bigint> = skipSet.descendingIterator();
    const key: Optional<string> = skipMap.floorKey('key');
    const entry: Optional<SynchronousMapEntry<string, bigint>> = skipMap.ceilingEntry('key');
    const subMap: SynchronousSkipMap<string, bigint> = skipMap.subMap('a', 'z');
    const inclusiveMap: SynchronousSkipMap<string, bigint> = skipMap.subMap('a', true, 'z', true);
    const tail: SynchronousSkipMap<string, bigint> = skipMap.tailMap('a', false);
    // Updated for the 1.2.0 -> 1.3.0 definition change: skip-map key views expose
    // the set Contract (the explicit navigableKeySet is the navigable view).
    const keys: SynchronousSetContract<string> = skipMap.keySet();
    void [baseList, baseSet, baseMap, capacity, touched, accessed, oldest, newest,
        evicted, range, comparator, lower, first, subset, inclusiveSubset, reversed,
        iterator, key, entry, subMap, inclusiveMap, tail, keys];
    // @ts-expect-error capacity follows the bigint size convention.
    map.setCapacity(10);
    // @ts-expect-error four-argument ranges require boolean endpoint flags.
    skipMap.subMap('a', 1n, 'z', true);
}

export async function asynchronousAdvancedContracts(
    list: AsynchronousLRUList<bigint>,
    set: AsynchronousLRUSet<bigint>,
    map: AsynchronousLRUMap<string, bigint>,
    skipList: AsynchronousSkipList<bigint>,
    skipSet: AsynchronousSkipSet<bigint>,
    skipMap: AsynchronousSkipMap<string, bigint>,
): Promise<void> {
    const baseList: AsynchronousList<bigint> = list;
    // Updated for the 1.2.0 -> 1.3.0 definition change: see the synchronous case;
    // the Contract interfaces are the family-wide base types.
    const baseSet: AsynchronousSetContract<bigint> = set;
    const baseMap: AsynchronousMapContract<string, bigint> = map;
    const capacity: bigint = await map.capacity();
    await list.setCapacity(10n);
    await list.touch(0n);
    await set.setCapacity(10n);
    await map.setCapacity(10n);
    const touched: boolean = await set.touch(1n);
    const accessed: boolean = await map.touch('key');
    const oldest: bigint = await list.peekLeastRecent();
    const newest: bigint = await set.peekMostRecent();
    const evicted: AsynchronousMapEntry<string, bigint> = await map.pollLeastRecent();
    const range: AsynchronousSkipList<bigint> = await skipList.subList(0n, 1n);
    const comparator: Comparator<bigint> = await skipSet.comparator();
    const floor: bigint = await skipSet.floor(1n);
    const last: bigint = await skipSet.pollLast();
    const subset: AsynchronousSkipSet<bigint> = await skipSet.subSet(1n, 5n);
    const inclusiveSubset: AsynchronousSkipSet<bigint> = await skipSet.subSet(1n, false, 5n, true);
    const reversed: AsynchronousSkipSet<bigint> = await skipSet.descendingSet();
    const iterator: Iterator<bigint> = skipSet.descendingIterator();
    const key: string = await skipMap.higherKey('key');
    const entry: AsynchronousMapEntry<string, bigint> = await skipMap.firstEntry();
    const subMap: AsynchronousSkipMap<string, bigint> = await skipMap.subMap('a', 'z');
    const inclusiveMap: AsynchronousSkipMap<string, bigint> = await skipMap.subMap('a', true, 'z', false);
    const head: AsynchronousSkipMap<string, bigint> = await skipMap.headMap('z', true);
    const keys: AsynchronousSkipSet<string> = await skipMap.navigableKeySet();
    const inserted: bigint | void = await map.put('key', 1n);
    const insertedIfAbsent: bigint | void = await map.putIfAbsent('key', 2n);
    void [baseList, baseSet, baseMap, capacity, touched, accessed, oldest, newest,
        evicted, range, comparator, floor, last, subset, inclusiveSubset, reversed,
        iterator, key, entry, subMap, inclusiveMap, head, keys, inserted, insertedIfAbsent];
    // @ts-expect-error async navigation resolves a value, without Optional nesting.
    const nested: Optional<string> = await skipMap.firstKey();
    void nested;
    // @ts-expect-error insertion may complete without a previous value.
    const previous: bigint = await map.put('new-key', 1n);
    void previous;
}
