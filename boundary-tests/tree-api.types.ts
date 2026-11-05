import type {
    Optional, Navigation, Navigable, NodeTraversal, TreeTraversal, AVLNode, BinaryNode, BPlusNode, BPlusLeafNode,
    FenwickNode, LinkCutNode, TopTreeNode, TrieNode,
    SynchronousAdelsonVelskyLandisTree, AsynchronousAdelsonVelskyLandisTree, SynchronousBPlusTree,
    SynchronousFenwickTree, SynchronousLinkCutTree, SynchronousTopTree,
    SynchronousTrie, SynchronousForest,
} from 'semantic-typescript';
import type * as API from 'semantic-typescript';
import type { SynchronousAdelsonVelskyLandisTree as ModuleAVLTree } from '#semantic/structure/tree/adelsonVelskyLandisTree';
import type { SynchronousBPlusTree as ModuleBPlusTree } from '#semantic/structure/tree/bPlusTree';
import type { SynchronousRootedForest as ModuleRootedForest } from '#semantic/structure/forest/rootedForest';
import type { SynchronousAdelsonVelskyLandisTree as DirectoryAVLTree } from '#semantic/structure/tree/index';

/** Public traversal retains specialised nodes and exposes the full Generator protocol. */
export function avlContracts(tree: SynchronousAdelsonVelskyLandisTree<number>, asyncTree: AsynchronousAdelsonVelskyLandisTree<number>): void {
    const root: Optional<AVLNode<number>> = tree.root();
    const parent: Optional<AVLNode<number>> = root.get().ancestor();
    const actualRoot: AVLNode<number> = root.get().root();
    const nodeNavigation: Navigable<AVLNode<number>> = actualRoot;
    const treeNavigation: Navigation<AVLNode<number>> = tree;
    const asyncNavigation: Navigation<AVLNode<number>> = asyncTree;
    const existingTreeTraversal: TreeTraversal<AVLNode<number>> = treeNavigation;
    const existingNodeTraversal: NodeTraversal<AVLNode<number>> = nodeNavigation;
    const nodeContract: Navigable<AVLNode<number>> = existingNodeTraversal;
    // @ts-expect-error trees traverse nodes but do not have a node's ancestor relation.
    const treeAsNode: Navigable<AVLNode<number>> = tree;
    void [asyncNavigation, existingTreeTraversal, nodeContract, treeAsNode];
    const traversals: Array<Generator<AVLNode<number>, void, unknown>> = [
        tree.preorder(), tree.inorder(), tree.postorder(), tree.breadthFirst(),
        actualRoot.preorder(), actualRoot.inorder(), actualRoot.postorder(), actualRoot.breadthFirst(),
        asyncTree.preorder(), asyncTree.inorder(), asyncTree.postorder(), asyncTree.breadthFirst(),
    ];
    const asyncRoot: Promise<Optional<AVLNode<number>>> = asyncTree.root();
    const size: bigint = tree.size();
    for (const node of tree.inorder()) {
        const factor: -1 | 0 | 1 = node.getBalanceFactor();
        const height: bigint = node.getHeight();
        void [factor, height];
    }
    // @ts-expect-error tree traversal yields nodes, not raw elements.
    const elements: Generator<number, void, unknown> = tree.preorder();
    // @ts-expect-error an ordinary binary node has no AVL metadata.
    const avl: AVLNode<number> = {} as BinaryNode<number>;
    void [parent, traversals, asyncRoot, size, elements, avl];
}

export function specialisedContracts(
    pages: SynchronousBPlusTree<string, number>,
    fenwick: SynchronousFenwickTree<bigint>,
    linkCut: SynchronousLinkCutTree<string, number, boolean>,
    top: SynchronousTopTree<string, number>,
    trie: SynchronousTrie<number, string>,
): void {
    const pageTraversal: Generator<BPlusNode<string, number>, void, unknown> = pages.inorder();
    for (const page of pageTraversal) {
        if (page.kind === 'leaf') {
            const leaf: BPlusLeafNode<string, number> = page;
            const values: ReadonlyArray<number> = leaf.getEntries().map(entry => entry.value);
            void values;
        } else {
            // @ts-expect-error record values belong only to B+ leaves.
            page.getEntries();
        }
    }
    const cells: Generator<FenwickNode<bigint>, void, unknown> = fenwick.postorder();
    const paths: Generator<LinkCutNode<string, number, boolean>, void, unknown> = linkCut.preorder();
    const clusters: Generator<TopTreeNode<string, number>, void, unknown> = top.breadthFirst();
    const prefixes: Generator<TrieNode<number, string>, void, unknown> = trie.inorder();
    const forest: SynchronousForest<FenwickNode<bigint>> = fenwick;
    // @ts-expect-error a forest exposes roots, not a synthetic common root.
    forest.root();
    const navigable: NodeTraversal<FenwickNode<bigint>> = fenwick.getRoots()[0]!;
    void [cells, paths, clusters, prefixes, navigable];
}

/** Inheritance follows node families without widening their root or traversal. */
export function hierarchyContracts(
    avl: API.SynchronousAdelsonVelskyLandisTree<number>,
    asyncAVL: API.AsynchronousAdelsonVelskyLandisTree<number>,
    huffman: API.SynchronousHuffmanTree<string>,
    heap: API.SynchronousBinaryHeap<number>,
    dary: API.AsynchronousDaryHeap<number>,
    interval: API.SynchronousIntervalTree<number, string>,
    bplus: API.AsynchronousBPlusTree<string, number>,
    fibonacci: API.SynchronousFibonacciHeap<string>,
    dfs: API.AsynchronousDepthFirstSearchTree<string>,
    rplus: API.SynchronousRPlusTree<string>,
): void {
    const search: API.SynchronousBinarySearchTree<number, API.AVLNode<number>> = avl;
    const binary: API.SynchronousBinaryTree<number, API.AVLNode<number>> = search;
    const ordered: API.SynchronousOrderedTree<number, API.AVLNode<number>> = binary;
    const rooted: API.SynchronousRootedTree<number, API.AVLNode<number>> = ordered;
    const asyncRooted: API.AsynchronousRootedTree<number, API.AVLNode<number>> = asyncAVL;
    const full: API.SynchronousFullBinaryTree<string, API.HuffmanNode<string>> = huffman;
    const complete: API.SynchronousCompleteBinaryTree<number, API.BinaryHeapNode<number>> = heap;
    const nary: API.AsynchronousNaryTree<number, API.DaryHeapNode<number>> = dary;
    const intervalSearch: API.SynchronousBinarySearchTree<string, API.IntervalNode<number, string>> = interval;
    const pages: API.AsynchronousSearchTree<string, API.BPlusNode<string, number>> = bplus;
    const forest: API.Forest<string> = fibonacci;
    const componentRoots: ReadonlyArray<API.FibonacciNode<string>> = fibonacci.getRoots();
    const asyncComponents: Promise<ReadonlyArray<API.DFSNode<string>>> = dfs.getRoots();
    const spatial: API.SynchronousRTree<string, API.RPlusNode<string>> = rplus;
    const spatialRoot: Optional<API.RPlusNode<string>> = spatial.root();
    // @ts-expect-error a root must be a navigable node, not an element value.
    const invalidTree: API.SynchronousTree<number> = {};
    // @ts-expect-error a binary-tree specialisation must use a binary node.
    const invalidBinary: API.SynchronousBinaryTree<number, API.TrieNode<number>> = {};
    // @ts-expect-error a page tree cannot use a single-element binary node.
    const invalidPages: API.SynchronousSearchTree<string, API.BinaryNode<string>> = {};
    // @ts-expect-error a forest matches node.ts getRoots, not the withdrawn roots spelling.
    fibonacci.roots();
    void [rooted, asyncRooted, full, complete, nary, intervalSearch, pages, forest,
        componentRoots, asyncComponents, spatialRoot, invalidTree, invalidBinary, invalidPages];
}

/** Direct family modules, directory exports and the existing entry expose identical contracts. */
export function moduleContracts(
    avl: ModuleAVLTree<number>,
    pages: ModuleBPlusTree<string, number>,
    forest: ModuleRootedForest<string>,
): void {
    const directory: DirectoryAVLTree<number> = avl;
    const publicAVL: API.SynchronousAdelsonVelskyLandisTree<number> = directory;
    const roundTrip: ModuleAVLTree<number> = publicAVL;
    const publicPages: API.SynchronousBPlusTree<string, number> = pages;
    const publicForest: API.SynchronousRootedForest<string> = forest;
    void [roundTrip, publicPages, publicForest];
}
