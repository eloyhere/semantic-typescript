import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../dist/index.js';
import * as treeApi from '../dist/structure/tree/index.js';

const families = [
    ['AbstractSyntaxTree', 'AST'],
    ['AdelsonVelskyLandisTree', 'AVLTree'],
    ['AnderssonTree', 'AATree'],
    ['KDimensionalTree', 'KDTree'],
    ['VantagePointTree', 'VPTree'],
    ['MetricTree', 'MTree'],
    ['BoundingVolumeHierarchy', 'BVH'],
    ['DepthFirstSearchTree', 'DFSTree'],
    ['BreadthFirstSearchTree', 'BFSTree'],
];

for (const [family, oldName] of families) {
    for (const prefix of ['Synchronous', 'Asynchronous']) {
        const name = prefix + family;
        test(`${name} is exported under its expanded name only`, () => {
            for (const exports of [api, treeApi]) {
                assert.equal(typeof exports[name], 'function', `${name} export`);
                const empty = new exports[name]();
                assert.equal(exports[name].name, name);
                assert.equal(empty.constructor.name, name);
                assert.equal(Object.hasOwn(exports, `${prefix}${oldName}`), false, `legacy ${prefix}${oldName} export`);
            }
        });
    }
}

const astRoot = { kind: 'root', children: [] };
const astChild = { kind: 'identifier', children: [] };
astRoot.children.push(astChild);
const boxes = [
    { minimum: [0, 0], maximum: [1, 1] },
    { minimum: [2, 2], maximum: [3, 3] },
];

const samples = [
    ['AbstractSyntaxTree', [astRoot, astChild], {
        childrenOf: value => value.children,
        kindOf: value => value.kind,
    }],
    ['AdelsonVelskyLandisTree', [2, 1, 3], {}],
    ['AnderssonTree', [2, 1, 3], {}],
    ['KDimensionalTree', [[0, 1], [2, 3]], { pointOf: point => point }],
    ['VantagePointTree', [1, 3, 7], { distance: (left, right) => Math.abs(left - right) }],
    ['MetricTree', [1, 3, 7], { distance: (left, right) => Math.abs(left - right) }],
    ['BoundingVolumeHierarchy', boxes, { boundsOf: box => box }],
    ['DepthFirstSearchTree', ['root', 'child'], {}],
    ['BreadthFirstSearchTree', ['root', 'child'], {}],
];

for (const [family, values, options] of samples) {
    test(`${family} builds a nonempty sample with its current family name`, () => {
        const name = `Synchronous${family}`;
        const tree = new api[name](values, options);
        assert.equal(tree.constructor.name, name);
        assert.equal(tree.size(), BigInt(values.length));
        assert.ok([...tree.preorder()].length > 0);
    });
}
