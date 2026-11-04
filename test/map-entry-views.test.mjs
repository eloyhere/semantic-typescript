import test from 'node:test';
import assert from 'node:assert/strict';
import { AsynchronousUnorderedMap, AsynchronousUnorderedSet, AsynchronousMapEntrySymbol } from '../dist/index.js';
import { useHash } from '../dist/hash.js';

const externalEntry = (key, value) => ({
    [AsynchronousMapEntrySymbol]: AsynchronousMapEntrySymbol,
    async getKey() { return key; },
    async getValue() { return value; },
    async setValue() { throw new TypeError('Read-only test entry.'); },
    async hashCode() { return useHash(key) ^ useHash(value); },
    async equals(other) { return await other.getKey() === key && await other.getValue() === value; },
});

test('async backed entry views await arbitrary entry accessors for contains and removal', async () => {
    const map = new AsynchronousUnorderedMap([['a', 1], ['b', 2]]);
    const entries = await map.entrySet();
    assert.equal(await entries.contains(externalEntry('a', 1)), true);
    assert.equal(await entries.contains(externalEntry('a', 9)), false);
    assert.equal(await entries.remove(externalEntry('a', 1)), true);
    assert.equal(await map.containsKey('a'), false);
    assert.equal(await entries.remove(externalEntry('a', 1)), false);
});

test('async entry views normalize bulk equality and set algebra operands', async () => {
    const map = new AsynchronousUnorderedMap([['a', 1], ['b', 2]]);
    const entries = await map.entrySet();
    const otherMap = new AsynchronousUnorderedMap([['b', 2], ['a', 1]]);
    const external = new AsynchronousUnorderedSet([externalEntry('a', 1), externalEntry('b', 2)]);
    assert.equal(await entries.containsAll(external), true);
    assert.equal(await entries.equals(external), true);
    assert.equal(await entries.hashCode(), await (await otherMap.entrySet()).hashCode());
    assert.equal(await entries.hashCode(), await map.hashCode());
    const subset = new AsynchronousUnorderedSet([externalEntry('a', 1)]);
    assert.equal(await (await entries.intersection(subset)).size(), 1n);
    assert.equal(await (await entries.union(subset)).size(), 2n);
    assert.equal(await entries.retainAll(subset), true);
    assert.equal(await map.containsKey('b'), false);
    assert.equal(await entries.removeAll(subset), true);
    assert.equal(await map.isEmpty(), true);
});

test('rejecting asynchronous entry accessors propagate without unhandled probes', async () => {
    const map = new AsynchronousUnorderedMap([['a', 1]]);
    const entries = await map.entrySet();
    const error = new Error('accessor failed');
    const broken = { ...externalEntry('a', 1), async getValue() { throw error; } };
    await assert.rejects(entries.contains(broken), error);
    await assert.rejects(entries.remove(broken), error);
    await assert.rejects((await map.entrySet()).equals(new AsynchronousUnorderedSet([broken])), error);
    assert.equal(await map.get('a'), 1);
});

test('clear cancels an entry removal waiting for external async accessors', async () => {
    const map = new AsynchronousUnorderedMap([['a', 1]]);
    const entries = await map.entrySet();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const delayed = { ...externalEntry('a', 1), async getKey() { await gate; return 'a'; } };
    const removal = entries.remove(delayed);
    map.clear();
    await map.put('a', 1);
    release();
    assert.equal(await removal, false);
    assert.equal(await map.get('a'), 1);
});
