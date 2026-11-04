import type { Optional } from "#semantic/optional";

/**
 * Generator traversal over structural nodes. Generators yield nodes, not their
 * elements, and include the starting node. An empty tree yields no nodes.
 * Child order is defined by the structure; cross-links are never traversed.
 * Binary inorder preserves left/right positions: left subtree, node, right
 * subtree. Ordered multiway inorder visits first child, node, remaining children.
 * Mutation during traversal is specified by the implementing structure.
 */
export interface Navigation<N> {
    preorder(): Generator<N, void, unknown>;
    inorder(): Generator<N, void, unknown>;
    postorder(): Generator<N, void, unknown>;
    breadthFirst(): Generator<N, void, unknown>;
}

/**
 * A node that can navigate its structural hierarchy and traverse its subtree.
 * ancestor is the immediate parent, or empty for a root. root follows that same
 * parent relation and returns this node when ancestor is empty. Neither method
 * follows threads, sibling links or other cross-links.
 */
export interface Navigable<N> extends Navigation<N> {
    ancestor(): Optional<N>;
    root(): N;
}
