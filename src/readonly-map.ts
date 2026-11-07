/**
 * Exposes a Map through a read-only facade that does not leak its mutable target.
 * `Object.freeze(map)` alone cannot disable Map.prototype.set/delete/clear.
 */
export const readonlyMap = <K, V>(source: Map<K, V>): ReadonlyMap<K, V> => {
    const target = new Map(source);
    const mutators = new Set<PropertyKey>(["set", "delete", "clear"]);
    let facade: ReadonlyMap<K, V>;
    facade = new Proxy(target, {
        get(map, property): unknown {
            if (mutators.has(property)) {
                return (): never => { throw new TypeError("This Map is read-only."); };
            }
            if (property === "forEach") {
                return (callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown): void => {
                    map.forEach((value: V, key: K): void => callback.call(thisArg, value, key, facade));
                };
            }
            if (property === "valueOf") {
                return (): ReadonlyMap<K, V> => facade;
            }
            const value: unknown = Reflect.get(map, property, map);
            return typeof value === "function" ? value.bind(map) : value;
        },
        set(): boolean { return false; },
        defineProperty(): boolean { return false; },
        deleteProperty(): boolean { return false; }
    });
    return facade;
};
