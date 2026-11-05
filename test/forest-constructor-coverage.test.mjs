import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../dist/index.js';
import * as forestApi from '../dist/structure/forest/index.js';
import { SynchronousCollection, AsynchronousCollection } from '../dist/structure/collection.js';

const modes = [
    ['Synchronous', SynchronousCollection],
    ['Asynchronous', AsynchronousCollection],
];
const constructors = Object.entries(forestApi)
    .filter(([name, value]) => /^(Synchronous|Asynchronous)/.test(name) && typeof value === 'function')
    .sort(([left], [right]) => left.localeCompare(right));

// Forests moved out of the tree directory into their own family. Discovery
// mirrors tree-constructor-coverage so the moved constructors keep their
// synchronous/asynchronous parity and empty-construction contract.
test('all public forest families have matching synchronous and asynchronous constructors', t => {
    const families = modes.map(([prefix]) => constructors
        .filter(([name]) => name.startsWith(prefix))
        .map(([name]) => name.slice(prefix.length))
        .sort());
    assert.ok(families[0].length > 0, 'forest constructor discovery must not be empty');
    assert.deepEqual(families[0], families[1], 'every forest family must support both modes');
    t.diagnostic(`${families[0].length} forest families; ${families[0].length} synchronous and ${families[1].length} asynchronous constructors; ${constructors.length} total`);
});

for (const [name, Constructor] of constructors) {
    const [, Collection] = modes.find(([prefix]) => name.startsWith(prefix));
    test(`${name} constructs an empty forest with the matching public name`, async () => {
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

test('forest constructors remain reachable from the package root', () => {
    for (const [name, Constructor] of constructors) {
        assert.equal(api[name], Constructor, `${name}: package-root export identity`);
    }
});
