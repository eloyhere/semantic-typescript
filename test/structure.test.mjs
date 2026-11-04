import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../dist/index.js';

const families = [
    ['Collection', []],
    ['List', ['Collection']],
    ['OrderedSet', ['Collection']],
    ['UnorderedSet', ['Collection']],
    ['OrderedMap', []],
    ['UnorderedMap', []],
    ['MapEntry', []],
    ['LRUList', ['List', 'Collection']],
    ['LRUSet', ['UnorderedSet', 'Collection']],
    ['OrderedLRUSet', ['LRUSet', 'OrderedSet', 'Collection']],
    ['UnorderedLRUSet', ['LRUSet', 'UnorderedSet', 'Collection']],
    ['LRUMap', ['UnorderedMap']],
    ['OrderedLRUMap', ['LRUMap', 'OrderedMap']],
    ['UnorderedLRUMap', ['LRUMap', 'UnorderedMap']],
    ['SkipList', ['List', 'Collection']],
    ['SkipSet', ['UnorderedSet', 'Collection']],
    ['OrderedSkipSet', ['SkipSet', 'OrderedSet', 'Collection']],
    ['UnorderedSkipSet', ['SkipSet', 'UnorderedSet', 'Collection']],
    ['SkipMap', ['UnorderedMap']],
    ['OrderedSkipMap', ['SkipMap', 'OrderedMap']],
    ['UnorderedSkipMap', ['SkipMap', 'UnorderedMap']],
];

for (const prefix of ['Asynchronous', 'Synchronous']) {
    for (const [family, ancestors] of families) {
        const name = prefix + family;
        test(`${name} guard checks symbol keys and inherited brands`, () => {
            const brand = api[`${name}Symbol`];
            const guard = api[`is${name}`];
            assert.equal(typeof brand, 'symbol');
            assert.equal(brand, Symbol.for(name));
            assert.equal(typeof guard, 'function');
            const prototype = {};
            for (const part of [family, ...ancestors]) {
                prototype[api[`${prefix}${part}Symbol`]] = Symbol(`${part} implementation`);
            }
            const isMapFamily = family !== 'MapEntry' && family.endsWith('Map');
            if (isMapFamily && family.startsWith('Ordered')) prototype.ordered = true;
            if (isMapFamily && family.startsWith('Unordered')) prototype.ordered = false;
            if (isMapFamily && (family === 'LRUMap' || family === 'SkipMap')) prototype.ordered = false;
            const target = Object.create(prototype);
            assert.equal(guard(target), true);
            for (const invalid of [null, undefined, 1, 'value', Symbol(), {}, { [name]: brand }]) {
                assert.equal(guard(invalid), false);
            }
            assert.equal(guard({ ...prototype, [brand]: true }), false);
            if (ancestors.length > 0) {
                const incomplete = { ...prototype };
                delete incomplete[api[`${prefix}${ancestors[0]}Symbol`]];
                assert.equal(guard(incomplete), false);
            }
            if (isMapFamily && (family.startsWith('Ordered') || family.startsWith('Unordered'))) {
                assert.equal(guard({ ...prototype, ordered: !prototype.ordered }), false);
            }
        });
    }
}

test('usage sequences increase across primitive and weak registries', () => {
    const primitive = api.primitiveLastNearestUsage;
    const objective = api.objectiveLastNearestUsage;
    const object = {};
    const first = primitive.touch('first');
    const second = objective.touch(object);
    const third = primitive.touch('first');
    assert.ok(first < second && second < third);
    assert.equal(primitive.get('first'), third);
    assert.equal(objective.get(object), second);
    assert.equal(primitive.size(), 1n);
    assert.equal(primitive.get('absent'), undefined);
    assert.equal(objective.get({}), undefined);
    assert.equal(primitive.has('first'), true);
    assert.equal(primitive.delete('first'), true);
    assert.equal(primitive.delete('first'), false);
    assert.equal(primitive.size(), 0n);
    assert.equal(objective.has(object), true);
    assert.equal(objective.delete(object), true);
    assert.equal(objective.has(object), false);
    assert.equal(objective.delete(object), false);
});

test('primitive identity follows Map semantics and weak keys retain reference identity', () => {
    const primitive = api.primitiveLastNearestUsage;
    const objective = api.objectiveLastNearestUsage;
    primitive.touch(NaN);
    assert.equal(typeof primitive.get(NaN), 'bigint');
    primitive.touch(-0);
    assert.equal(primitive.get(0), primitive.get(-0));
    const left = Symbol('same');
    const right = Symbol('same');
    primitive.touch(left);
    assert.equal(primitive.has(right), false);
    primitive.touch(null);
    primitive.touch(undefined);
    assert.equal(primitive.has(null), true);
    assert.equal(primitive.has(undefined), true);
    const functionKey = () => {};
    const object = { key: 1 };
    objective.touch(functionKey);
    objective.touch(object);
    assert.equal(typeof objective.get(functionKey), 'bigint');
    assert.equal(objective.get({ key: 1 }), undefined);
});

test('clearing either registry preserves global monotonicity', () => {
    const primitive = api.primitiveLastNearestUsage;
    const objective = api.objectiveLastNearestUsage;
    const object = {};
    const previous = objective.touch(object);
    primitive.touch('key');
    objective.clear();
    primitive.clear();
    assert.equal(objective.has(object), false);
    assert.equal(primitive.has('key'), false);
    assert.equal(primitive.size(), 0n);
    assert.ok(primitive.touch('key') > previous);
    assert.ok(objective.touch(object) > primitive.get('key'));
    assert.equal(typeof api.primitiveLastNearestUsage.touch, 'function');
    assert.equal(typeof api.objectiveLastNearestUsage.touch, 'function');
});
