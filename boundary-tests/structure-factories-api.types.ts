import {
    SynchronousCollection, AsynchronousCollection,
    // Updated for the 1.2.0 -> 1.3.0 structure split: the removed plain
    // `Set` constructors map to their ordered defaults.
    SynchronousList, AsynchronousList, SynchronousOrderedSet, AsynchronousOrderedSet,
    SynchronousLRUList, AsynchronousLRUList, SynchronousLRUSet, AsynchronousLRUSet,
    SynchronousSkipList, AsynchronousSkipList, SynchronousSkipSet, AsynchronousSkipSet,
    // Updated for the same split: the removed plain `Map` names were the
    // family-wide base, which is now the Contract interface (type-only import).
    SynchronousMapEntry, AsynchronousMapEntry,
    SynchronousOrderedMap, AsynchronousOrderedMap, SynchronousUnorderedMap, AsynchronousUnorderedMap,
    SynchronousLRUMap, AsynchronousLRUMap,
    SynchronousOrderedLRUMap, AsynchronousOrderedLRUMap, SynchronousUnorderedLRUMap, AsynchronousUnorderedLRUMap,
    SynchronousSkipMap, AsynchronousSkipMap,
    SynchronousOrderedSkipMap, AsynchronousOrderedSkipMap, SynchronousUnorderedSkipMap, AsynchronousUnorderedSkipMap,
    useHashAsyncIterable, useHashIterable, useStructureHash,
} from 'semantic-typescript';
import type { SynchronousMapContract, AsynchronousMapContract } from 'semantic-typescript';

export function collectionConstructors(asyncSource: AsyncIterable<bigint>): void {
    const sync = [new SynchronousCollection([1n]), new SynchronousList([1n]), new SynchronousOrderedSet([1n]),
        new SynchronousLRUList([1n]), new SynchronousLRUSet([1n]), new SynchronousSkipList([1n]), new SynchronousSkipSet([1n])];
    const async = [new AsynchronousCollection(asyncSource), new AsynchronousList(asyncSource), new AsynchronousOrderedSet(asyncSource),
        new AsynchronousLRUList(asyncSource), new AsynchronousLRUSet(asyncSource), new AsynchronousSkipList(asyncSource), new AsynchronousSkipSet(asyncSource)];
    const synchronous: SynchronousCollection<bigint>[] = sync;
    const asynchronous: AsynchronousCollection<bigint>[] = async;
    const empty: SynchronousCollection<string> = new SynchronousCollection<string>();
    const direct: AsynchronousCollection<bigint> = new AsynchronousCollection([1n]).stream();
    const hashed: bigint = useHashIterable([1n]);
    const asyncHash: Promise<bigint> = useHashAsyncIterable(asyncSource);
    const dispatched: Promise<bigint> = useStructureHash(asyncSource);
    void [synchronous, asynchronous, empty, direct, hashed, asyncHash, dispatched];
    // @ts-expect-error synchronous constructors require a synchronous source.
    new SynchronousCollection(asyncSource);
    // @ts-expect-error the synchronous constructor produces a synchronous interface.
    const wrong: AsynchronousCollection<bigint> = new SynchronousCollection([1n]);
    void wrong;
}

export function mapConstructors(source: Iterable<readonly [string, bigint]>, asyncSource: AsyncIterable<readonly [string, bigint]>): void {
    // Updated for the 1.2.0 -> 1.3.0 structure split: the removed plain
    // `SynchronousMap`/`AsynchronousMap` constructors map to the ordered default;
    // every family is still asserted assignable to the Contract base.
    const sync: SynchronousMapContract<string, bigint>[] = [
        new SynchronousOrderedMap(source), new SynchronousOrderedMap(source), new SynchronousUnorderedMap(source),
        new SynchronousLRUMap(source), new SynchronousOrderedLRUMap(source), new SynchronousUnorderedLRUMap(source),
        new SynchronousSkipMap(source), new SynchronousOrderedSkipMap(source), new SynchronousUnorderedSkipMap(source),
    ];
    const async: AsynchronousMapContract<string, bigint>[] = [
        new AsynchronousOrderedMap(asyncSource), new AsynchronousOrderedMap(asyncSource), new AsynchronousUnorderedMap(asyncSource),
        new AsynchronousLRUMap(asyncSource), new AsynchronousOrderedLRUMap(asyncSource), new AsynchronousUnorderedLRUMap(asyncSource),
        new AsynchronousSkipMap(asyncSource), new AsynchronousOrderedSkipMap(asyncSource), new AsynchronousUnorderedSkipMap(asyncSource),
    ];
    const key: string = new SynchronousMapEntry('key', 1n).getKey();
    const asyncKey: Promise<string> = new AsynchronousMapEntry('key', 1n).getKey();
    const flag: true = new SynchronousOrderedSkipMap(source).descendingMap().ordered;
    const capacity: bigint = new SynchronousUnorderedLRUMap(source, { capacity: 2n }).capacity();
    void [sync, async, key, asyncKey, flag, capacity];
}

/** Constructor values share their names with instance interfaces and cannot be called. */
export function constructorCallBoundaries(): void {
    // @ts-expect-error AsynchronousCollection requires new.
    AsynchronousCollection();
    // @ts-expect-error SynchronousCollection requires new.
    SynchronousCollection();
    // @ts-expect-error AsynchronousList requires new.
    AsynchronousList();
    // @ts-expect-error SynchronousList requires new.
    SynchronousList();
    // Updated for the 1.2.0 -> 1.3.0 structure split: the removed plain set/map
    // constructors map to their ordered defaults for the requires-new boundary.
    // @ts-expect-error AsynchronousOrderedSet requires new.
    AsynchronousOrderedSet();
    // @ts-expect-error SynchronousOrderedSet requires new.
    SynchronousOrderedSet();
    // @ts-expect-error SynchronousOrderedMap requires new.
    SynchronousOrderedMap();
    // @ts-expect-error AsynchronousOrderedMap requires new.
    AsynchronousOrderedMap();
    // @ts-expect-error SynchronousOrderedMap requires new.
    SynchronousOrderedMap();
    // @ts-expect-error AsynchronousOrderedMap requires new.
    AsynchronousOrderedMap();
    // @ts-expect-error SynchronousUnorderedMap requires new.
    SynchronousUnorderedMap();
    // @ts-expect-error AsynchronousUnorderedMap requires new.
    AsynchronousUnorderedMap();
    // @ts-expect-error SynchronousMapEntry requires new.
    SynchronousMapEntry('key', 1n);
    // @ts-expect-error AsynchronousMapEntry requires new.
    AsynchronousMapEntry('key', 1n);
    // @ts-expect-error AsynchronousLRUList requires new.
    AsynchronousLRUList();
    // @ts-expect-error SynchronousLRUList requires new.
    SynchronousLRUList();
    // @ts-expect-error AsynchronousLRUSet requires new.
    AsynchronousLRUSet();
    // @ts-expect-error SynchronousLRUSet requires new.
    SynchronousLRUSet();
    // @ts-expect-error SynchronousLRUMap requires new.
    SynchronousLRUMap();
    // @ts-expect-error AsynchronousLRUMap requires new.
    AsynchronousLRUMap();
    // @ts-expect-error SynchronousOrderedLRUMap requires new.
    SynchronousOrderedLRUMap();
    // @ts-expect-error AsynchronousOrderedLRUMap requires new.
    AsynchronousOrderedLRUMap();
    // @ts-expect-error SynchronousUnorderedLRUMap requires new.
    SynchronousUnorderedLRUMap();
    // @ts-expect-error AsynchronousUnorderedLRUMap requires new.
    AsynchronousUnorderedLRUMap();
    // @ts-expect-error AsynchronousSkipList requires new.
    AsynchronousSkipList();
    // @ts-expect-error SynchronousSkipList requires new.
    SynchronousSkipList();
    // @ts-expect-error AsynchronousSkipSet requires new.
    AsynchronousSkipSet();
    // @ts-expect-error SynchronousSkipSet requires new.
    SynchronousSkipSet();
    // @ts-expect-error SynchronousSkipMap requires new.
    SynchronousSkipMap();
    // @ts-expect-error AsynchronousSkipMap requires new.
    AsynchronousSkipMap();
    // @ts-expect-error SynchronousOrderedSkipMap requires new.
    SynchronousOrderedSkipMap();
    // @ts-expect-error AsynchronousOrderedSkipMap requires new.
    AsynchronousOrderedSkipMap();
    // @ts-expect-error SynchronousUnorderedSkipMap requires new.
    SynchronousUnorderedSkipMap();
    // @ts-expect-error AsynchronousUnorderedSkipMap requires new.
    AsynchronousUnorderedSkipMap();
}

/** Generic constructor signatures retain instance type arguments and subclass prototypes. */
export function constructorGenerics(): void {
    const map: SynchronousOrderedMap<string, bigint> = new SynchronousOrderedMap<string, bigint>();
    const asyncMap: AsynchronousOrderedMap<string, bigint> = new AsynchronousOrderedMap<string, bigint>();
    const list: SynchronousCollection<bigint> = new SynchronousList<bigint>(undefined, { capacity: 2n });
    const entry = new SynchronousMapEntry<string, bigint>('key', 1n);
    class StringList extends SynchronousList<string> {}
    const derived: SynchronousCollection<string> = new StringList(['value']);
    // @ts-expect-error synchronous map constructors reject async-only sources.
    new SynchronousOrderedMap((async function* () { yield ['key', 1n] as const; })());
    void [map, asyncMap, list, entry, derived];
}
