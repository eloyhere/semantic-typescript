import type { AsynchronousCollector } from "./asynchronous/collector";
import type {
    AsynchronousBigIntStatistics, AsynchronousNumericStatistics, AsynchronousOrderedCollectable, AsynchronousSemantic,
    AsynchronousStatistics, AsynchronousUnorderedCollectable, AsynchronousWindowCollectable
} from "./asynchronous/semantic";
import type { Optional } from "./optional";
import {
    AsynchronousBigIntStatisticsSymbol, AsynchronousCollectorSymbol, AsynchronousNumericStatisticsSymbol, AsynchronousOrderedCollectableSymbol, AsynchronousSemanticSymbol, AsynchronousStatisticsSymbol,
    AsynchronousUnorderedCollectableSymbol, AsynchronousWindowCollectableSymbol, OptionalSymbol, SynchronousBigIntStatisticsSymbol, SynchronousCollectorSymbol, SynchronousNumericStatisticsSymbol,
    SynchronousOrderedCollectableSymbol, SynchronousSemanticSymbol, SynchronousStatisticsSymbol, SynchronousUnorderedCollectableSymbol, SynchronousWindowCollectableSymbol
} from "./symbol";
import type { SynchronousCollector } from "./synchronous/collector";
import type {
    SynchronousBigIntStatistics, SynchronousNumericStatistics, SynchronousOrderedCollectable, SynchronousSemantic, SynchronousStatistics, SynchronousUnorderedCollectable,
    SynchronousWindowCollectable
} from "./synchronous/semantic";
import type { AsyncFunction, MaybePrimitive, Primitive } from "./utility";

export let isBoolean: (target: unknown) => target is boolean = (target: unknown): target is boolean => {
    return typeof target === "boolean";
};
export let isString: (target: unknown) => target is string = (target: unknown): target is string => {
    return typeof target === "string";
};
export let isNumber: (target: unknown) => target is number = (target: unknown): target is number => {
    return typeof target === "number" && !Number.isNaN(target) && Number.isFinite(target);
};
export let isFunction: (target: unknown) => target is Function = (target: unknown): target is Function => {
    return typeof target === "function";
};
export let isObject: (target: unknown) => target is object = (target: unknown): target is object => {
    return typeof target === "object" && target !== null;
};
export let isSymbol: (target: unknown) => target is symbol = (target: unknown): target is symbol => {
    return typeof target === "symbol";
};
export let isBigInt: (target: unknown) => target is bigint = (target: unknown): target is bigint => {
    return typeof target === "bigint";
};
export let isPrimitive: (target: MaybePrimitive<unknown>) => target is Primitive = (target: MaybePrimitive<unknown>): target is Primitive => {
    return isBoolean(target) || isString(target) || isNumber(target) || isSymbol(target) || isBigInt(target) || isFunction(target);
};

export let isAsyncIterable: (target: unknown) => target is AsyncIterable<unknown> = (target: unknown): target is AsyncIterable<unknown> => {
    if (isObject(target)) {
        return isFunction(Reflect.get(target, Symbol.asyncIterator));
    }
    return false;
};
export let isIterable: (target: unknown) => target is Iterable<unknown> = (target: unknown): target is Iterable<unknown> => {
    if (isObject(target)) {
        return isFunction(Reflect.get(target, Symbol.iterator));
    }
    return false;
};

export let isAsynchronousSemantic: (target: unknown) => target is AsynchronousSemantic<unknown> = (target: unknown): target is AsynchronousSemantic<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousSemantic") === AsynchronousSemanticSymbol;
    }
    return false;
};
export let isSynchronousSemantic: (target: unknown) => target is SynchronousSemantic<unknown> = (target: unknown): target is SynchronousSemantic<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousSemantic") === SynchronousSemanticSymbol;
    }
    return false;
};


export let isAsynchronousCollectable: (target: unknown) => target is AsynchronousSemantic<unknown> = (target: unknown): target is AsynchronousSemantic<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousCollectable") === AsynchronousSemanticSymbol || isAsynchronousSemantic(target) || isAsynchronousOrderedCollectable(target) || isAsynchronousUnorderedCollectable(target) || isAsynchronousStatistics(target) || isAsynchronousNumericStatistics(target) || isAsynchronousBigIntStatistics(target) || isAsynchronousWindowCollectable(target);
    }
    return false;
};
export let isSynchronousCollectable: (target: unknown) => target is SynchronousSemantic<unknown> = (target: unknown): target is SynchronousSemantic<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousCollectable") === SynchronousSemanticSymbol || isSynchronousSemantic(target) || isSynchronousOrderedCollectable(target) || isSynchronousUnorderedCollectable(target) || isSynchronousStatistics(target) || isSynchronousNumericStatistics(target) || isSynchronousBigIntStatistics(target) || isSynchronousWindowCollectable(target);
    }
    return false;
};

export let isAsynchronousOrderedCollectable: (target: unknown) => target is AsynchronousOrderedCollectable<unknown> = (target: unknown): target is AsynchronousOrderedCollectable<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousOrderedCollectable") === AsynchronousOrderedCollectableSymbol;
    }
    return false;
};
export let isSynchronousOrderedCollectable: (target: unknown) => target is SynchronousOrderedCollectable<unknown> = (target: unknown): target is SynchronousOrderedCollectable<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousOrderedCollectable") === SynchronousOrderedCollectableSymbol;
    }
    return false;
};

export let isAsynchronousUnorderedCollectable: (target: unknown) => target is AsynchronousUnorderedCollectable<unknown> = (target: unknown): target is AsynchronousUnorderedCollectable<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousUnorderedCollectable") === AsynchronousUnorderedCollectableSymbol;
    }
    return false;
};
export let isSynchronousUnorderedCollectable: (target: unknown) => target is SynchronousUnorderedCollectable<unknown> = (target: unknown): target is SynchronousUnorderedCollectable<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousUnorderedCollectable") === SynchronousUnorderedCollectableSymbol;
    }
    return false;
};

export let isAsynchronousStatistics: (target: unknown) => target is AsynchronousStatistics<unknown, number | bigint> = (target: unknown): target is AsynchronousStatistics<unknown, number | bigint> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousStatistics") === AsynchronousStatisticsSymbol;
    }
    return false;
};
export let isSynchronousStatistics: (target: unknown) => target is SynchronousStatistics<unknown, number | bigint> = (target: unknown): target is SynchronousStatistics<unknown, number | bigint> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousStatistics") === SynchronousStatisticsSymbol;
    }
    return false;
};

export let isAsynchronousBigIntStatistics: (target: unknown) => target is AsynchronousBigIntStatistics<unknown> = (target: unknown): target is AsynchronousBigIntStatistics<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousBigIntStatistics") === AsynchronousBigIntStatisticsSymbol;
    }
    return false;
};
export let isSynchronousBigIntStatistics: (target: unknown) => target is SynchronousBigIntStatistics<unknown> = (target: unknown): target is SynchronousBigIntStatistics<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousBigIntStatistics") === SynchronousBigIntStatisticsSymbol;
    }
    return false;
};

export let isAsynchronousNumericStatistics: (target: unknown) => target is AsynchronousNumericStatistics<unknown> = (target: unknown): target is AsynchronousNumericStatistics<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousBigIntStatistics") === AsynchronousNumericStatisticsSymbol;
    }
    return false;
};
export let isSynchronousNumericStatistics: (target: unknown) => target is SynchronousNumericStatistics<unknown> = (target: unknown): target is SynchronousNumericStatistics<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousNumericStatistics") === SynchronousNumericStatisticsSymbol;
    }
    return false;
};

export let isAsynchronousWindowCollectable: (target: unknown) => target is AsynchronousWindowCollectable<unknown> = (target: unknown): target is AsynchronousWindowCollectable<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousWindowCollectable") === AsynchronousWindowCollectableSymbol;
    }
    return false;
};
export let isSynchronousWindowCollectable: (target: unknown) => target is SynchronousWindowCollectable<unknown> = (target: unknown): target is SynchronousWindowCollectable<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousWindowCollectable") === SynchronousWindowCollectableSymbol;
    }
    return false;
};

export let isSynchronousCollector: (target: unknown) => target is SynchronousCollector<unknown, unknown, unknown> = (target: unknown): target is SynchronousCollector<unknown, unknown, unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousCollector") === SynchronousCollectorSymbol;
    }
    return false;
};
export let isAsynchronousCollector: (target: unknown) => target is AsynchronousCollector<unknown, unknown, unknown> = (target: unknown): target is AsynchronousCollector<unknown, unknown, unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousCollector") === AsynchronousCollectorSymbol;
    }
    return false;
};

export let isOptional: (target: unknown) => target is Optional<unknown> = (target: unknown): target is Optional<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "Optional") === OptionalSymbol;
    }
    return false;
};

export let isPromise: (target: unknown) => target is Promise<unknown> = (target: unknown): target is Promise<unknown> => {
    if (isObject(target)) {
        return isFunction(Reflect.get(target, "then")) && isFunction(Reflect.get(target, "catch"));
    }
    return false;
};

export let isAsyncFunction: (target: unknown) => target is AsyncFunction = (target: unknown): target is AsyncFunction => {
    if (isFunction(target)) {
        return Reflect.get(target, Symbol.toStringTag) === "AsyncFunction" && target.constructor.name === "AsyncFunction";
    }
    return false;
};

export let isGeneratorFunction: (target: unknown) => target is Generator<unknown, unknown, unknown> = (target: unknown): target is Generator<unknown, unknown, unknown> => {
    if (isObject(target)) {
        return isFunction(target) && Reflect.get(target, "constructor").name === "GeneratorFunction";
    }
    return false;
};

export let isAsyncGeneratorFunction: (target: unknown) => target is AsyncGenerator<unknown, unknown, unknown> = (target: unknown): target is AsyncGenerator<unknown, unknown, unknown> => {
    if (isObject(target)) {
        return isFunction(target) && Reflect.get(target, "constructor").name === "AsyncGeneratorFunction";
    }
    return false;
};

