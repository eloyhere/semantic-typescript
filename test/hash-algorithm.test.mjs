import test from 'node:test';
import assert from 'node:assert/strict';
import { XXHash64, useHash, maskOf, register } from '../dist/hash.js';

const bytes = value => new TextEncoder().encode(value);
const mask = 0xffffffffffffffffn;

test('XXH64 matches published seed-zero reference vectors', () => {
    const vectors = [
        ['', 'ef46db3751d8e999'],
        ['a', 'd24ec4f1a98c6e5b'],
        ['abc', '44bc2cf5ad770999'],
        ['message digest', '066ed728fceeb3be'],
        ['abcdefghijklmnopqrstuvwxyz', 'cfe1f278fa89835c'],
        ['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'aaa46907d3047814'],
        ['1234567890'.repeat(8), 'e04a477f19ee145d'],
    ];
    for (const [input, expected] of vectors) {
        assert.equal(new XXHash64().update(bytes(input)).digest().toString(16).padStart(16, '0'), expected);
    }
});

test('XXH64 matches official seeded sanity vectors around 32- and 64-byte stripes', () => {
    // Numerical test data from https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h
    const data = new Uint8Array(65);
    let generator = 2654435761n;
    for (let index = 0; index < data.length; index++) {
        data[index] = Number(generator >> 56n);
        generator = (generator * 11400714785074694797n) & mask;
    }
    const vectors = [
        [0, 0n, 0xef46db3751d8e999n], [0, 0x9e3779b1n, 0xac75fda2929b17efn],
        [31, 0n, 0x299b39a290e6d783n], [31, 0x9e3779b1n, 0xda673d5feb5c1d79n],
        [32, 0n, 0x18b216492bb44b70n], [32, 0x9e3779b1n, 0xb3f33bdf93ade409n],
        [33, 0n, 0x55c8dc3e578f5b59n], [33, 0x9e3779b1n, 0xe92c292f64bc3071n],
        [63, 0n, 0xa9efbe0fa0f3f4e7n], [63, 0x9e3779b1n, 0x6c911fadb05b6fc2n],
        [64, 0n, 0xef558f8acac2b5cdn], [64, 0x9e3779b1n, 0xb5eeba99264cc44fn],
        [65, 0n, 0xde0f20dc2631af7an], [65, 0x9e3779b1n, 0xd3f6ff3941e310can],
    ];
    for (const [length, seed, expected] of vectors) {
        assert.equal(new XXHash64(seed).update(data.subarray(0, length)).digest(), expected);
    }
});

test('XXH64 handles every stripe boundary and chunk split without changing the digest', () => {
    const storage = Uint8Array.from({ length: 274 }, (_, index) => (index * 73) & 255);
    for (const length of [0, 1, 4, 7, 8, 15, 16, 31, 32, 33, 63, 64, 65, 255]) {
        // Nonzero byte offsets also exercise DataView addressing.
        const input = storage.subarray(3, length + 3);
        for (const seed of [0n, 1n, mask, -1n]) {
            const expected = new XXHash64(seed).update(input).digest();
            for (let split = 0; split <= length; split++) {
                const hash = new XXHash64(seed).update(input.subarray(0, split));
                hash.digest(); // A digest must not consume the pending bytes.
                hash.update(input.subarray(split));
                assert.equal(hash.digest(), expected, `length=${length} split=${split} seed=${seed}`);
            }
            const bytewise = new XXHash64(seed);
            for (const byte of input) bytewise.updateByte(byte);
            assert.equal(bytewise.digest(), expected);
            let random = 0x12345678;
            const chunked = new XXHash64(seed);
            for (let position = 0; position < length;) {
                random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
                const size = 1 + (random % 47);
                chunked.update(input.subarray(position, position + size));
                position += size;
            }
            assert.equal(chunked.digest(), expected);
        }
    }
});

test('XXH64 word appends match byte encoding at every buffer alignment', () => {
    for (let padding = 0; padding < 32; padding++) {
        const prefix = new Uint8Array(padding).fill(0xa5);
        const values = [0n, 1n, -1n, 1n << 64n, 0x123456789abcdef0n];
        const encoded = new Uint8Array(padding + values.length * 8);
        encoded.set(prefix);
        const view = new DataView(encoded.buffer);
        const hash = new XXHash64().update(prefix);
        for (let index = 0; index < values.length; index++) {
            view.setBigUint64(padding + index * 8, values[index] & mask, true);
            hash.updateWord(values[index]);
        }
        assert.equal(hash.digest(), new XXHash64().update(encoded).digest());
    }
});

test('hashing examines previously skipped characters and preserves UTF-16 distinctions', () => {
    const original = 'a'.repeat(1024);
    const changed = `${original.slice(0, 1)}b${original.slice(2)}`;
    assert.notEqual(useHash(original), useHash(changed));
    assert.notEqual(useHash('\ud800'), useHash('\ud801'));
    assert.notEqual(useHash('\ud800'), useHash('\ufffd'));
    assert.notEqual(useHash('ab', 'c'), useHash('a', 'bc'));
});

test('scalar encoding retains all bigint bits and handles every numeric category', () => {
    assert.notEqual(useHash(1n), useHash(1n + (1n << 64n)));
    assert.notEqual(useHash(-(1n << 256n)), useHash(1n << 256n));
    assert.equal(useHash(0), useHash(-0));
    assert.equal(useHash(NaN), useHash(Number('NaN')));
    const values = [undefined, null, false, true, 0, 1, NaN, Infinity, -Infinity, 0n, 1n, '', '0'];
    const hashes = values.map(value => useHash(value));
    assert.equal(new Set(hashes).size, values.length);
    for (const hash of hashes) assert.ok(hash >= 0n && hash <= mask);
    assert.equal(maskOf('undefined'), 0n);
});

test('structural object hashing keeps cycles, sharing, and cached-after-mutation semantics', () => {
    const left = { name: 'cycle' }; left.self = left;
    const right = { name: 'cycle' }; right.self = right;
    assert.equal(useHash(left), useHash(right));
    const initial = useHash(left);
    left.name = 'changed';
    assert.equal(useHash(left), initial);
    assert.notEqual(useHash({ key: null }), useHash({ key: undefined }));
    assert.notEqual(useHash({ key: {} }), useHash({}));
    assert.notEqual(useHash(new Map([['key', 1]])), useHash(new Map([['key', 2]])));
    assert.notEqual(useHash(new Set([1])), useHash(new Set([2])));
    assert.notEqual(useHash(new Date(0)), useHash(new Date(1)));
    assert.notEqual(useHash(new Uint8Array([1])), useHash(new Uint8Array([2])));
    assert.equal(useHash(1, 2, 3), useHash([1, 2, 3]));
});

test('functions use the weak cache and nested custom iterators are not consumed', () => {
    const fn = () => 1;
    const initial = useHash(fn);
    for (let index = 0; index < 100005; index++) useHash(index);
    assert.equal(useHash(fn), initial);
    let iterations = 0;
    const nested = { *[Symbol.iterator]() { iterations++; yield 1; } };
    useHash({ nested });
    assert.equal(iterations, 0);
});

test('registered scalar handlers remain usable', () => {
    // Restore the built-in observable behavior in a separate process-isolated test file.
    const expected = useHash('override');
    register('string', () => expected);
    assert.equal(useHash('anything'), expected);
});
