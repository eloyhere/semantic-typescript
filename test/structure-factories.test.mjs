import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../dist/index.js';

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

for (const prefix of ['Synchronous', 'Asynchronous']) {
    for (const family of ['Collection', 'List', 'OrderedSet', 'UnorderedSet', 'LRUList', 'LRUSet', 'OrderedLRUSet', 'UnorderedLRUSet', 'SkipList', 'SkipSet', 'OrderedSkipSet', 'UnorderedSkipSet']) {
        const name = prefix + family;
        test(`${name} constructor produces a branded usable container`, async () => {
            const value = new api[name]([3n, 1n, 2n], { comparator: compare, capacity: 10n });
            assert.equal(api[`is${name}`](value), true);
            assert.equal(value instanceof api[name], true);
            assert.equal(api[name].name, name);
            assert.equal(`use${name}` in api, false);
            assert.throws(() => api[name](), TypeError);
            assert.equal(value instanceof Promise, false);
            assert.equal(await value.size(), 3n);
            assert.equal(await value.contains(1n), true);
            assert.equal(await value.add(4n), true);
            assert.equal(await value.remove(1n), true);
            assert.equal(await value.contains(1n), false);
            const stream = value.stream();
            assert.equal(stream instanceof Promise, false);
            assert.equal(api[`is${prefix}Collection`](stream), true);
            value.clear();
            assert.equal(await value.isEmpty(), true);
        });
    }
    for (const family of ['OrderedMap', 'UnorderedMap', 'LRUMap', 'OrderedLRUMap', 'UnorderedLRUMap', 'SkipMap', 'OrderedSkipMap', 'UnorderedSkipMap']) {
        const name = prefix + family;
        test(`${name} constructor preserves mappings and brands`, async () => {
            const value = new api[name]([['b', 2n], ['a', 1n]], { comparator: compare, capacity: 10n });
            assert.equal(api[`is${name}`](value), true);
            assert.equal(value instanceof api[name], true);
            assert.equal(api[name].name, name);
            assert.equal(`use${name}` in api, false);
            assert.throws(() => api[name](), TypeError);
            assert.equal(value instanceof Promise, false);
            assert.equal(await value.size(), 2n);
            const old = await value.put('a', 3n);
            assert.equal(prefix === 'Synchronous' ? old.get() : old, 1n);
            const current = await value.get('a');
            assert.equal(prefix === 'Synchronous' ? current.get() : current, 3n);
            assert.equal(await value.containsKey('b'), true);
            const keys = await value.keySet();
            assert.equal(await keys.remove('b'), true);
            assert.equal(await value.containsKey('b'), false);
            await assert.rejects(async () => keys.add('missing'));
            value.clear();
            assert.equal(await value.isEmpty(), true);
        });
    }
}

test('list indices, duplicates and backed ranges retain positional semantics', () => {
    const list = new api.SynchronousList([1n, 2n, 1n, 3n]);
    assert.equal(list.indexOf(1n), 0n);
    assert.equal(list.lastIndexOf(1n), 2n);
    list.add(1n, 4n);
    assert.deepEqual(list.toArray(), [1n, 4n, 2n, 1n, 3n]);
    const range = list.subList(1n, 3n);
    range.set(0n, 9n);
    assert.equal(list.get(1n), 9n);
    assert.equal(range.removeAt(1n), 2n);
    assert.deepEqual(list.toArray(), [1n, 9n, 1n, 3n]);
    assert.throws(() => list.get(-1n), RangeError);
    assert.throws(() => list.get(100n), RangeError);
    list.sort(compare);
    assert.deepEqual(list.toArray(), [1n, 1n, 3n, 9n]);
});

test('LRU list tracks duplicate occurrences independently of positions', () => {
    const list = new api.SynchronousLRUList([1n, 1n, 2n], { capacity: 3n });
    list.get(0n);
    list.add(3n);
    assert.deepEqual(list.toArray(), [1n, 2n, 3n]);
    assert.equal(list.peekLeastRecent().get(), 2n);
    list.setCapacity(1n);
    assert.deepEqual(list.toArray(), [3n]);
    assert.throws(() => list.setCapacity(0n), RangeError);
    assert.equal(list.capacity(), 1n);
});

test('LRU set touches duplicate additions and evicts by recency', () => {
    const set = new api.SynchronousLRUSet([1n, 2n], { capacity: 2n });
    assert.equal(set.add(1n), false);
    assert.equal(set.add(3n), true);
    assert.deepEqual(set.toArray(), [1n, 3n]);
    assert.equal(set.contains(2n), false);
    assert.equal(set.touch(5n), false);
});

test('ordered LRU map iteration follows accesses and eviction', () => {
    const map = new api.SynchronousOrderedLRUMap([['a', 1n], ['b', 2n]], { capacity: 2n });
    map.get('a');
    assert.deepEqual([...(map.keySet())], ['b', 'a']);
    map.put('c', 3n);
    assert.equal(map.containsKey('b'), false);
    assert.deepEqual([...map.keySet()], ['a', 'c']);
    assert.equal(map.peekLeastRecent().get().getKey(), 'a');
});

test('ordered map replacement preserves insertion position', () => {
    const map = new api.SynchronousOrderedMap([['b', 1n], ['a', 2n]]);
    map.put('b', 3n);
    assert.deepEqual([...map.keySet()], ['b', 'a']);
    map.remove('b');
    map.put('b', 4n);
    assert.deepEqual([...map.keySet()], ['a', 'b']);
});

test('Skip set comparator navigation and ranges are backed', () => {
    const set = new api.SynchronousSkipSet([4n, 1n, 3n, 2n], { comparator: compare });
    assert.deepEqual(set.toArray(), [1n, 2n, 3n, 4n]);
    assert.equal(set.lower(3n).get(), 2n);
    assert.equal(set.floor(3n).get(), 3n);
    assert.equal(set.ceiling(3n).get(), 3n);
    assert.equal(set.higher(3n).get(), 4n);
    assert.equal(set.lower(1n).isEmpty(), true);
    const range = set.subSet(2n, true, 4n, false);
    assert.deepEqual(range.toArray(), [2n, 3n]);
    range.remove(2n);
    assert.equal(set.contains(2n), false);
    assert.throws(() => range.add(5n), RangeError);
    const descending = set.descendingSet();
    assert.deepEqual(descending.toArray(), [4n, 3n, 1n]);
    assert.equal(descending.lower(3n).get(), 4n);
});

test('Skip map navigation, range mutations and snapshot entries', () => {
    const map = new api.SynchronousOrderedSkipMap([['c', 3n], ['a', 1n], ['b', 2n]], { comparator: compare });
    assert.deepEqual([...map.keySet()], ['a', 'b', 'c']);
    assert.equal(map.floorKey('b').get(), 'b');
    assert.equal(map.lowerKey('b').get(), 'a');
    const snapshot = map.firstEntry().get();
    assert.throws(() => snapshot.setValue(5n));
    map.put('a', 9n);
    assert.equal(snapshot.getValue(), 1n);
    const range = map.subMap('a', true, 'c', false);
    range.put('b', 7n);
    assert.equal(map.get('b').get(), 7n);
    assert.throws(() => range.put('z', 1n), RangeError);
    range.clear();
    assert.deepEqual([...map.keySet()], ['c']);
});

test('async map absence rejects after computation removal and insertion returns void', async () => {
    const map = new api.AsynchronousUnorderedMap();
    assert.equal(await map.put('a', 1n), undefined);
    assert.equal(await map.putIfAbsent('b', 2n), undefined);
    assert.equal(await map.putIfAbsent('b', 3n), 2n);
    await assert.rejects(map.get('absent'));
    await assert.rejects(map.compute('a', () => undefined));
    assert.equal(await map.containsKey('a'), false);
    assert.equal(await map.remove('b'), 2n);
    await assert.rejects(map.remove('b'));
});

test('async source constructors return containers immediately and await initial values', async () => {
    async function* source() { yield 1n; yield 2n; }
    const list = new api.AsynchronousList(source());
    assert.equal(list instanceof Promise, false);
    assert.equal(await list.size(), 2n);
    assert.deepEqual(await list.toArray(), [1n, 2n]);
    async function* mappings() { yield ['a', 1n]; yield ['b', 2n]; }
    const map = new api.AsynchronousOrderedMap(mappings());
    assert.equal(map instanceof Promise, false);
    assert.equal(await map.get('b'), 2n);
});

test('sync constructors reject async sources instead of returning a promise', () => {
    async function* source() { yield 1n; }
    assert.throws(() => new api.SynchronousCollection(source()), TypeError);
});

for (const prefix of ['Synchronous', 'Asynchronous']) {
    const name = `${prefix}MapEntry`;
    test(`${name} constructs a branded mutable entry and requires new`, async () => {
        const entry = new api[name]('key', 1n);
        assert.equal(entry instanceof api[name], true);
        assert.equal(api[`is${name}`](entry), true);
        assert.equal(await entry.getKey(), 'key');
        assert.equal(await entry.getValue(), 1n);
        assert.equal(await entry.setValue(2n), 1n);
        assert.equal(await entry.getValue(), 2n);
        assert.equal(`use${name}` in api, false);
        assert.throws(() => api[name]('key', 1n), TypeError);
    });
}

test('constructors preserve subclass prototypes', async () => {
    class NamedList extends api.SynchronousList { label = 'list'; }
    const list = new NamedList([1n]);
    assert.equal(list instanceof NamedList, true);
    assert.equal(list instanceof api.SynchronousList, true);
    assert.equal(list.label, 'list');
    assert.deepEqual(list.toArray(), [1n]);
    class NamedMap extends api.AsynchronousUnorderedMap { label = 'map'; }
    const map = new NamedMap([['key', 1n]]);
    assert.equal(map instanceof NamedMap, true);
    assert.equal(map instanceof api.AsynchronousUnorderedMap, true);
    assert.equal(map.label, 'map');
    assert.equal(await map.get('key'), 1n);
});
