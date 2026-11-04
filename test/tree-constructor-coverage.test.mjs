import test from 'node:test';
import assert from 'node:assert/strict';
import * as treeApi from '../dist/structure/tree/index.js';
import { SynchronousCollection, AsynchronousCollection } from '../dist/structure/collection.js';

const modes = [
    ['Synchronous', SynchronousCollection],
    ['Asynchronous', AsynchronousCollection],
];
const constructors = Object.entries(treeApi)
    .filter(([name, value]) => /^(Synchronous|Asynchronous)/.test(name) && typeof value === 'function')
    .sort(([left], [right]) => left.localeCompare(right));

// Only public, mode-prefixed functions are candidates; type-only options,
// symbols, guards, and errors are not tree constructors.
test('all public tree families have matching synchronous and asynchronous constructors', t => {
    const families = modes.map(([prefix]) => constructors
        .filter(([name]) => name.startsWith(prefix))
        .map(([name]) => name.slice(prefix.length))
        .sort());
    assert.ok(families[0].length > 0, 'tree constructor discovery must not be empty');
    assert.deepEqual(families[0], families[1], 'every tree family must support both modes');
    t.diagnostic(`${families[0].length} tree families; ${families[0].length} synchronous and ${families[1].length} asynchronous constructors; ${constructors.length} total`);
});

for (const [name, Constructor] of constructors) {
    const [, Collection] = modes.find(([prefix]) => name.startsWith(prefix));
    test(`${name} constructs an empty collection with the matching public name`, async () => {
        assert.equal(Constructor.name, name, `${name}: exported constructor name`);
        for (const source of [undefined, []]) {
            const sourceLabel = source === undefined ? 'omitted source' : 'empty iterable';
            const instance = source === undefined ? new Constructor() : new Constructor(source);
            assert.ok(instance instanceof Collection, `${name} (${sourceLabel}): instanceof ${Collection.name}`);
            assert.equal(instance.constructor, Constructor, `${name} (${sourceLabel}): constructor identity`);
            assert.equal(instance.constructor.name, name, `${name} (${sourceLabel}): instance constructor name`);
            assert.equal(await instance.size(), 0n, `${name} (${sourceLabel}): empty collection size`);
        }
    });
}
