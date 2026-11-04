import { Optional } from "#semantic/optional";
import type { Navigable } from "#semantic/structure/navigation";

type Links = {
    parent: () => object | undefined;
    children: () => readonly object[];
    inorder?: () => readonly (object | undefined)[];
};
const links = new WeakMap<object, Links>();

/** @internal Structural children exclude threads, siblings and routing references. */
export function structuralChildren(node: object): readonly object[] {
    const navigation = links.get(node);
    if (navigation) return navigation.children();
    // This helper is only for nodes installed by attachNavigation. Public custom
    // nodes own their traversal contract: the tree runtime delegates to their
    // generators rather than guessing child fields (Optional slots, threads,
    // routing entries and payload objects are not interchangeable with nodes).
    throw new TypeError("Missing owned node navigation.");
}

/** @internal Adds navigation to an owned node without changing its storage fields. */
export function attachNavigation<N extends object>(
    node: N,
    parent: () => object | undefined,
    children: () => readonly object[],
    inorder?: () => readonly (object | undefined)[],
): N & Navigable<N> {
    links.set(node, { parent, children, inorder });
    function* traverse(start: object, order: "preorder" | "inorder" | "postorder"): Generator<object, void, unknown> {
        const stack: Array<{ node: object; visit: boolean }> = [{ node: start, visit: false }];
        while (stack.length) {
            const current = stack.pop()!;
            if (current.visit) { yield current.node; continue; }
            const navigation = links.get(current.node);
            if (!navigation) throw new TypeError("Missing node navigation.");
            const childNodes = navigation.children();
            let sequence: readonly (object | undefined)[];
            if (order === "preorder") sequence = [undefined, ...childNodes];
            else if (order === "postorder") sequence = [...childNodes, undefined];
            else sequence = navigation.inorder?.() ?? (childNodes.length ? [childNodes[0], undefined, ...childNodes.slice(1)] : [undefined]);
            for (let index = sequence.length - 1; index >= 0; index--) {
                const next = sequence[index];
                stack.push({ node: next ?? current.node, visit: next === undefined });
            }
        }
    }
    Object.assign(node, {
        ancestor: () => Optional.ofNullable(parent()),
        root: () => {
            let current: object = node;
            const seen = new Set<object>();
            while (true) {
                if (seen.has(current)) throw new TypeError("Cyclic ancestor links.");
                seen.add(current);
                const next = links.get(current)?.parent();
                if (!next) return current;
                current = next;
            }
        },
        preorder: () => traverse(node, "preorder"),
        inorder: () => traverse(node, "inorder"),
        postorder: () => traverse(node, "postorder"),
        breadthFirst: function* () {
            let level: object[] = [node];
            while (level.length) {
                const next: object[] = [];
                for (const current of level) {
                    yield current;
                    for (const child of structuralChildren(current)) next.push(child);
                }
                level = next;
            }
        },
    });
    return node as N & Navigable<N>;
}
