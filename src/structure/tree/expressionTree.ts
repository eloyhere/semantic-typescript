import { createTreeConstructor } from "#semantic/structure/tree/runtime";
import type { TreeOptions } from "#semantic/structure/tree/runtime";
import type * as Nodes from "#semantic/structure/node";
import type { SynchronousRootedTree, AsynchronousRootedTree } from "#semantic/structure/tree/rootedTree";

/**
 * Synchronous expression tree: an operator-labelled tree whose internal nodes
 * combine the operands held by their subtrees.
 *
 * The topology comes from `options.parentOf` or `options.childrenOf`, and
 * `options.operatorOf` is required: a node with children must yield an
 * operator, while a leaf is allowed to have none. `getArity()` is the child
 * count, so one contract covers unary, binary and n-ary operators.
 *
 * @template E the element type representing an operand or operator node
 * @template O the operator symbol type returned by `getOperator()`
 */
export interface SynchronousExpressionTree<E = unknown, O = string> extends SynchronousRootedTree<E, Nodes.ExpressionNode<E, O>> {}

/**
 * Asynchronous expression tree: the same operator/arity node contract as the
 * synchronous expression tree, with promise-returning collection queries.
 *
 * Operators are fixed during construction and never re-evaluated by queries;
 * navigation follows the child edges of the expression. An async element
 * source is drained before operator validation, because whether a node needs an
 * operator depends on its final child count.
 *
 * @template E the element type representing an operand or operator node
 * @template O the operator symbol type returned by `getOperator()`
 */
export interface AsynchronousExpressionTree<E = unknown, O = string> extends AsynchronousRootedTree<E, Nodes.ExpressionNode<E, O>> {}

/**
 * Constructs a `SynchronousExpressionTree` from elements plus expression
 * callbacks.
 *
 * `options.operatorOf` is mandatory for a nonempty tree, and `parentOf` or
 * `childrenOf` must describe an acyclic topology with unique elements.
 * Operators must be present on nodes that ended up with children;
 * `options.buildNodes` may replace the built expression shape.
 */
export interface SynchronousExpressionTreeConstructor {
    new <E = unknown, O = string>(source?: Iterable<E>, options?: TreeOptions<E, Nodes.ExpressionNode<E, O>>): SynchronousExpressionTree<E, O>;
}

export const SynchronousExpressionTree = createTreeConstructor("SynchronousExpressionTree", false, "ExpressionTree") as unknown as SynchronousExpressionTreeConstructor;

/**
 * Constructs an `AsynchronousExpressionTree`; the source may be synchronous or
 * asynchronous.
 *
 * Operator and topology requirements are shared with the synchronous
 * constructor. An async source is fully collected before the child-count check,
 * so a node cannot be classified as an operand and later receive children.
 */
export interface AsynchronousExpressionTreeConstructor {
    new <E = unknown, O = string>(source?: Iterable<E> | AsyncIterable<E>, options?: TreeOptions<E, Nodes.ExpressionNode<E, O>>): AsynchronousExpressionTree<E, O>;
}

export const AsynchronousExpressionTree = createTreeConstructor("AsynchronousExpressionTree", true, "ExpressionTree") as unknown as AsynchronousExpressionTreeConstructor;
