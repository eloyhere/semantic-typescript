import test from 'node:test';
import assert from 'node:assert/strict';
import * as ST from 'semantic-typescript';
import * as treeApi from '../dist/structure/tree/index.js';

const nodeValues = nodes => [...nodes].map(node => node.getElement().get());

test('collection iteration exposes elements while tree traversals expose nodes', () => {
    const tree = new ST.SynchronousBinaryTree([1, 2, 3]);

    assert.deepEqual([...tree], [1, 2, 3]);
    assert.deepEqual(nodeValues(tree.inorder()), [2, 1, 3]);
    assert.equal(tree.add(4), true);
    assert.deepEqual(tree.toArray(), [1, 2, 3, 4]);
    assert.deepEqual(nodeValues(tree.preorder()), [1, 2, 4, 3]);
    assert.equal(tree.remove(2), true);
    assert.deepEqual([...tree], [1, 3, 4]);
    assert.deepEqual(nodeValues(tree.inorder()), [3, 1, 4]);
});

test('setElement atomically replaces a collection occurrence and rejects stale node setters', () => {
    const tree = new ST.SynchronousBinaryTree([1, 2, 3]);
    const oldRoot = tree.root().get();
    const oldChild = [...oldRoot.preorder()][1];

    oldRoot.setElement(10);
    assert.deepEqual(tree.toArray(), [10, 2, 3]);
    assert.equal(oldRoot.getElement().get(), 1); // returned nodes are snapshots
    assert.deepEqual(nodeValues(tree.preorder()), [10, 2, 3]);
    assert.throws(() => oldRoot.setElement(11), TypeError);
    assert.throws(() => oldChild.setElement(12), TypeError);
    assert.deepEqual(tree.toArray(), [10, 2, 3]);
});

test('PerfectBinaryTree bulk updates validate final shapes and roll back failures', () => {
    const tree = new ST.SynchronousPerfectBinaryTree([1, 2, 3]);
    assert.equal(tree.addAll([4, 5, 6, 7]), true); // 3 -> 7 is valid; no invalid intermediate shape
    assert.deepEqual(tree.toArray(), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(tree.removeAll([4, 5, 6, 7]), true); // 7 -> 3 is valid; no invalid intermediate shape
    assert.deepEqual(tree.toArray(), [1, 2, 3]);

    const committedRoot = tree.root().get();
    assert.throws(() => tree.addAll([6]), RangeError);
    assert.throws(() => tree.removeAll([1]), RangeError);
    assert.deepEqual(tree.toArray(), [1, 2, 3]);
    assert.equal(tree.root().get(), committedRoot);
});

test('asynchronous add and root queries preserve invocation order and node snapshots', async () => {
    const tree = new ST.AsynchronousTree([1, 2]);
    const addFirst = tree.add(3);
    const rootAfterFirst = tree.root();
    const addSecond = tree.add(4);
    const rootAfterSecond = tree.root();

    const [firstChanged, firstRoot, secondChanged, secondRoot] = await Promise.all([
        addFirst, rootAfterFirst, addSecond, rootAfterSecond,
    ]);
    assert.equal(firstChanged, true);
    assert.equal(secondChanged, true);
    assert.deepEqual(nodeValues(firstRoot.get().preorder()), [1, 2, 3]);
    assert.deepEqual(nodeValues(secondRoot.get().preorder()), [1, 2, 4, 3]);
    assert.deepEqual(await tree.toArray(), [1, 2, 3, 4]);
});

test('async source initialization is awaited by collection operations', async () => {
    let release;
    let signalStarted;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { signalStarted = resolve; });
    async function* source() {
        signalStarted();
        yield 1;
        await gate;
        yield 2;
    }

    const tree = new ST.AsynchronousTree(source());
    await started;
    let settled = false;
    const initialized = tree.toArray().then(values => { settled = true; return values; });
    await Promise.resolve();
    assert.equal(settled, false);
    release();
    assert.deepEqual(await initialized, [1, 2]);
    assert.deepEqual(nodeValues(tree.breadthFirst()), [1, 2]);
});

test('clear discards the remaining values of an unfinished async source', async () => {
    let release;
    let signalStarted;
    let signalClosed;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { signalStarted = resolve; });
    const closed = new Promise(resolve => { signalClosed = resolve; });
    async function* source() {
        try {
            signalStarted();
            yield 1;
            await gate;
            yield 2;
        } finally { signalClosed(); }
    }

    const tree = new ST.AsynchronousTree(source());
    await started;
    tree.clear();
    assert.equal(await tree.add(9), true);
    release();
    await closed;
    assert.deepEqual(await tree.toArray(), [9]);
});

test('wide owned-node breadthFirst does not spread a large child array into push', () => {
    const count = 140_000;
    const tree = new ST.SynchronousNaryTree(Array.from({ length: count }, (_, index) => index), { arity: count });
    let visited = 0;
    for (const _node of tree.breadthFirst()) visited++;
    assert.equal(visited, count);
});

test('custom tree breadthFirst delegates to its root traversal', () => {
    let breadthFirstCalls = 0;
    const root = {
        ancestor: () => ({ isEmpty: () => true }),
        root: () => root,
        preorder: function* () { yield root; },
        inorder: function* () { yield root; },
        postorder: function* () { yield root; },
        breadthFirst: function* () { breadthFirstCalls++; yield root; },
        getElement: () => ({ isPresent: () => true, get: () => 42 }),
        setElement() {},
    };
    const tree = new ST.SynchronousTree([42], { buildNodes: () => [root] });

    assert.equal(breadthFirstCalls, 0);
    assert.deepEqual([...tree.breadthFirst()], [root]);
    assert.equal(breadthFirstCalls, 1);
});

test('every exported tree family instance inherits its matching collection runtime', () => {
    let checked = 0;
    for (const [name, Constructor] of Object.entries(treeApi)) {
        const match = /^(Synchronous|Asynchronous)/.exec(name);
        if (!match || typeof Constructor !== 'function' || name.endsWith('Constructor')) continue;
        const tree = new Constructor();
        const Collection = match[1] === 'Asynchronous' ? ST.AsynchronousCollection : ST.SynchronousCollection;
        assert.ok(tree instanceof Collection, `${name} instanceof ${Collection.name}`);
        checked++;
    }
    assert.ok(checked > 0, 'tree constructor exports were discovered');
});
