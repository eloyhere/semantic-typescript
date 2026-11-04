import test from 'node:test';
import assert from 'node:assert/strict';
import { useHashNull, useHashUndefined, useHashBoolean, useHashNumber, useHashString,
    useHashSymbol, useHashObject, useHashFunction, useHashIterable, useHashAsyncIterable,
    useStructureHash, useHash } from '../dist/index.js';

test('typed hash hooks match existing scalar and object hashing', () => {
    for (const [fn, value] of [[useHashNull, null], [useHashUndefined, undefined], [useHashBoolean, true],
        [useHashNumber, 3], [useHashString, 'text'], [useHashSymbol, Symbol('s')],
        [useHashObject, { x: 1 }], [useHashFunction, () => 1]]) {
        assert.equal(fn(value), useHash(value));
        assert.equal(fn(value), fn(value));
    }
    assert.throws(() => useHashNumber('3'), TypeError);
    assert.throws(() => useHashObject(null), TypeError);
});

test('synchronous and asynchronous iterable hashes preserve the same element order', async () => {
    async function* source() { yield 1n; yield 2n; yield 3n; }
    const hash = useHashIterable([1n, 2n, 3n]);
    assert.equal(await useHashAsyncIterable(source()), hash);
    assert.equal(await useStructureHash(source()), hash);
    assert.equal(useStructureHash([1n, 2n, 3n]), hash);
    assert.notEqual(useHashIterable([3n, 2n, 1n]), hash);
    assert.equal(await useHashAsyncIterable((async function* () {})()), useHashIterable([]));
    assert.notEqual(useHashIterable([]), useHashIterable([undefined]));
    assert.ok(hash >= 0n && hash <= 0xffffffffffffffffn);
    assert.equal(useStructureHash('abc'), useHashString('abc'));
});

test('long iterables keep a fixed-width digest and consume the source once', () => {
    let visits = 0;
    function* source() {
        for (let index = 0; index < 20000; index++) { visits++; yield index; }
    }
    const result = useHashIterable(source());
    assert.equal(visits, 20000);
    assert.ok(result >= 0n && result <= 0xffffffffffffffffn);
});

test('hash failures close synchronous and asynchronous iterators', async () => {
    const failure = new Error('property failed');
    const invalid = Object.defineProperty({}, 'value', { get() { throw failure; } });
    let closed = 0;
    function* source() { try { yield invalid; } finally { closed++; } }
    async function* asyncSource() { try { yield invalid; } finally { closed++; } }
    assert.throws(() => useHashIterable(source()), error => error === failure);
    await assert.rejects(useHashAsyncIterable(asyncSource()), error => error === failure);
    assert.equal(closed, 2);
});

test('asynchronous iterable failures propagate', async () => {
    const failure = new Error('source failed');
    async function* source() { yield 1n; throw failure; }
    await assert.rejects(useHashAsyncIterable(source()), error => error === failure);
});
