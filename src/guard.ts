import type { AsynchronousOrderedCollectable, AsynchronousUnorderedCollectable } from "#semantic/asynchronous/collectable";
import type { AsynchronousCollector } from "#semantic/asynchronous/collector";
import type { AsynchronousSemantic } from "#semantic/asynchronous/semantic";
import type { AsynchronousBigIntStatistics, AsynchronousNumericStatistics, AsynchronousStatistics } from "#semantic/asynchronous/statistics";
import type { AsynchronousWindowCollectable } from "#semantic/asynchronous/window";
import type { Optional } from "#semantic/optional";
import type { AsynchronousCollection, SynchronousCollection } from "#semantic/structure/collection";
import type { AsynchronousList, SynchronousList } from "#semantic/structure/list";
import type { AsynchronousLRUList, AsynchronousLRUMap, AsynchronousLRUSet, AsynchronousOrderedLRUMap, AsynchronousOrderedLRUSet, AsynchronousUnorderedLRUMap, AsynchronousUnorderedLRUSet, SynchronousLRUList, SynchronousLRUMap, SynchronousLRUSet, SynchronousOrderedLRUMap, SynchronousOrderedLRUSet, SynchronousUnorderedLRUMap, SynchronousUnorderedLRUSet } from "#semantic/structure/lru";
import type { AsynchronousMapEntry, AsynchronousOrderedMap, AsynchronousUnorderedMap, SynchronousMapEntry, SynchronousOrderedMap, SynchronousUnorderedMap } from "#semantic/structure/map";
import type { AsynchronousOrderedSet, AsynchronousUnorderedSet, SynchronousOrderedSet, SynchronousUnorderedSet } from "#semantic/structure/set";
import type { AsynchronousOrderedSkipMap, AsynchronousOrderedSkipSet, AsynchronousSkipList, AsynchronousSkipMap, AsynchronousSkipSet, AsynchronousUnorderedSkipMap, AsynchronousUnorderedSkipSet, SynchronousOrderedSkipMap, SynchronousOrderedSkipSet, SynchronousSkipList, SynchronousSkipMap, SynchronousSkipSet, SynchronousUnorderedSkipMap, SynchronousUnorderedSkipSet } from "#semantic/structure/skip";
import {
    AsynchronousBigIntStatisticsSymbol, AsynchronousCollectionSymbol, AsynchronousCollectorSymbol,
    AsynchronousListSymbol, AsynchronousLRUListSymbol, AsynchronousLRUMapSymbol, AsynchronousLRUSetSymbol,
    AsynchronousMapEntrySymbol, AsynchronousNumericStatisticsSymbol,
    AsynchronousOrderedCollectableSymbol, AsynchronousOrderedLRUMapSymbol, AsynchronousOrderedLRUSetSymbol,
    AsynchronousOrderedMapSymbol, AsynchronousOrderedSetSymbol, AsynchronousOrderedSkipMapSymbol, AsynchronousOrderedSkipSetSymbol,
    AsynchronousSemanticSymbol, AsynchronousSkipListSymbol, AsynchronousSkipMapSymbol, AsynchronousSkipSetSymbol,
    AsynchronousStatisticsSymbol, AsynchronousUnorderedCollectableSymbol, AsynchronousUnorderedLRUMapSymbol,
    AsynchronousUnorderedLRUSetSymbol, AsynchronousUnorderedMapSymbol, AsynchronousUnorderedSetSymbol,
    AsynchronousUnorderedSkipMapSymbol, AsynchronousUnorderedSkipSetSymbol, AsynchronousWindowCollectableSymbol,
    OptionalSymbol, PhaseFieldSymbol, SynchronousBigIntStatisticsSymbol, SynchronousCollectionSymbol,
    SynchronousCollectorSymbol, SynchronousListSymbol, SynchronousLRUListSymbol, SynchronousLRUMapSymbol,
    SynchronousLRUSetSymbol, SynchronousMapEntrySymbol, SynchronousNumericStatisticsSymbol,
    SynchronousOrderedCollectableSymbol, SynchronousOrderedLRUMapSymbol, SynchronousOrderedLRUSetSymbol,
    SynchronousOrderedMapSymbol, SynchronousOrderedSetSymbol, SynchronousOrderedSkipMapSymbol, SynchronousOrderedSkipSetSymbol,
    SynchronousSemanticSymbol, SynchronousSkipListSymbol, SynchronousSkipMapSymbol, SynchronousSkipSetSymbol,
    SynchronousStatisticsSymbol, SynchronousUnorderedCollectableSymbol, SynchronousUnorderedLRUMapSymbol,
    SynchronousUnorderedLRUSetSymbol, SynchronousUnorderedMapSymbol, SynchronousUnorderedSetSymbol,
    SynchronousUnorderedSkipMapSymbol, SynchronousUnorderedSkipSetSymbol, SynchronousWindowCollectableSymbol,
    AngleSymbol, BinSymbol, CoherenceSymbol, ComplexSymbol, EnvelopeSymbol, EpicycleSymbol, FrameSymbol, FrequencySymbol, OmegaSymbol,
    SampleSymbol, SamplerSymbol, SpectrogramSymbol, SpectrumSymbol, ToneSymbol, TrackSymbol, TrackEventSymbol, WaveformSymbol,
} from "#semantic/symbol";
import type { Angle } from "#semantic/mathematics/angle";
import type { Bin } from "#semantic/mathematics/bin";
import type { Coherence } from "#semantic/mathematics/coherent";
import type { Complex } from "#semantic/mathematics/complex";
import type { Envelope } from "#semantic/mathematics/envelope";
import type { Epicycle } from "#semantic/mathematics/epicycle";
import type { PhaseField } from "#semantic/mathematics/field";
import type { Frame } from "#semantic/mathematics/frame";
import type { Frequency } from "#semantic/mathematics/frequency";
import type { Omega } from "#semantic/mathematics/omega";
import type { Sample } from "#semantic/mathematics/sample";
import type { Sampler } from "#semantic/mathematics/sampler";
import type { Spectrogram } from "#semantic/mathematics/spectrogram";
import type { Spectrum } from "#semantic/mathematics/spectrum";
import type { Tone } from "#semantic/mathematics/tone";
import type { Track, TrackEvent } from "#semantic/mathematics/track";
import type { Waveform } from "#semantic/mathematics/waveform";
import type { SynchronousOrderedCollectable, SynchronousUnorderedCollectable } from "#semantic/synchronous/collectable";
import type { SynchronousCollector } from "#semantic/synchronous/collector";
import type { SynchronousSemantic } from "#semantic/synchronous/semantic";
import type { SynchronousBigIntStatistics, SynchronousNumericStatistics, SynchronousStatistics } from "#semantic/synchronous/statistics";
import type { SynchronousWindowCollectable } from "#semantic/synchronous/window";
import type { AsyncFunction, MaybePrimitive, Primitive } from "#semantic/utility";
/**
 * Tests whether a value is a primitive boolean.
 * @param target - The value to inspect.
 * @returns Whether the value has the boolean runtime type.
 */
export let isBoolean: (target: unknown) => target is boolean = (target: unknown): target is boolean => {
    return typeof target === "boolean";
};
/**
 * Tests whether a value is a primitive string.
 * @param target - The value to inspect.
 * @returns Whether the value has the string runtime type.
 */
export let isString: (target: unknown) => target is string = (target: unknown): target is string => {
    return typeof target === "string";
};
/**
 * Tests whether a value is a finite primitive number, excluding NaN and infinities.
 * @param target - The value to inspect.
 * @returns Whether the value is a finite number.
 */
export let isNumber: (target: unknown) => target is number = (target: unknown): target is number => {
    return typeof target === "number" && !Number.isNaN(target) && Number.isFinite(target);
};
/**
 * Tests whether a value has the function runtime type.
 * @param target - The value to inspect.
 * @returns Whether the value is a function.
 */
export let isFunction: (target: unknown) => target is Function = (target: unknown): target is Function => {
    return typeof target === "function";
};
/**
 * Tests whether a value has the object runtime type and is not null.
 * @param target - The value to inspect.
 * @returns Whether the value is a non-null object; functions are excluded.
 */
export let isObject: (target: unknown) => target is object = (target: unknown): target is object => {
    return typeof target === "object" && target !== null;
};
/**
 * Tests whether a value is a primitive symbol.
 * @param target - The value to inspect.
 * @returns Whether the value has the symbol runtime type.
 */
export let isSymbol: (target: unknown) => target is symbol = (target: unknown): target is symbol => {
    return typeof target === "symbol";
};
/**
 * Tests whether a value is a primitive bigint.
 * @param target - The value to inspect.
 * @returns Whether the value has the bigint runtime type.
 */
export let isBigInt: (target: unknown) => target is bigint = (target: unknown): target is bigint => {
    return typeof target === "bigint";
};
/**
 * Tests for booleans, strings, finite numbers, symbols, bigints or functions.
 * Unlike the Primitive type alias, this check excludes null and undefined.
 * @param target - The value to inspect.
 * @returns Whether one of the supported primitive or function checks succeeds.
 */
export let isPrimitive: (target: MaybePrimitive<unknown>) => target is Primitive = (target: MaybePrimitive<unknown>): target is Primitive => {
    return isBoolean(target) || isString(target) || isNumber(target) || isSymbol(target) || isBigInt(target) || isFunction(target);
};
/**
 * Tests whether a non-null object exposes a callable Symbol.asyncIterator property.
 * @param target - The value to inspect.
 * @returns Whether the object advertises asynchronous iteration; iterator results are not checked.
 */
export let isAsyncIterable: (target: unknown) => target is AsyncIterable<unknown> = (target: unknown): target is AsyncIterable<unknown> => {
    if (isObject(target)) {
        return isFunction(Reflect.get(target, Symbol.asyncIterator));
    }
    return false;
};
/**
 * Tests for a string or an object or function with a callable Symbol.iterator property.
 * @param target - The value to inspect.
 * @returns Whether the value advertises synchronous iteration; iterator results are not checked.
 */
export let isIterable: (target: unknown) => target is Iterable<unknown> = (target: unknown): target is Iterable<unknown> => {
    if (isString(target)) {
        return true;
    }
    if (isObject(target) || isFunction(target)) {
        return isFunction(Reflect.get(target, Symbol.iterator));
    }
    return false;
};
/**
 * Tests whether a non-null object carries the AsynchronousSemantic marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isAsynchronousSemantic: (target: unknown) => target is AsynchronousSemantic<unknown> = (target: unknown): target is AsynchronousSemantic<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousSemantic") === AsynchronousSemanticSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the SynchronousSemantic marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isSynchronousSemantic: (target: unknown) => target is SynchronousSemantic<unknown> = (target: unknown): target is SynchronousSemantic<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousSemantic") === SynchronousSemanticSymbol;
    }
    return false;
};
/**
 * Tests for the asynchronous collectable marker or a recognised asynchronous collectable brand.
 * @param target - The value to inspect.
 * @returns Whether a supported collectable brand is present; methods are not validated.
 */
export let isAsynchronousCollectable: (target: unknown) => target is AsynchronousSemantic<unknown> = (target: unknown): target is AsynchronousSemantic<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousCollectable") === AsynchronousSemanticSymbol || isAsynchronousSemantic(target) || isAsynchronousOrderedCollectable(target) || isAsynchronousUnorderedCollectable(target) || isAsynchronousStatistics(target) || isAsynchronousNumericStatistics(target) || isAsynchronousBigIntStatistics(target) || isAsynchronousWindowCollectable(target);
    }
    return false;
};
/**
 * Tests for the synchronous collectable marker or a recognised synchronous collectable brand.
 * @param target - The value to inspect.
 * @returns Whether a supported collectable brand is present; methods are not validated.
 */
export let isSynchronousCollectable: (target: unknown) => target is SynchronousSemantic<unknown> = (target: unknown): target is SynchronousSemantic<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousCollectable") === SynchronousSemanticSymbol || isSynchronousSemantic(target) || isSynchronousOrderedCollectable(target) || isSynchronousUnorderedCollectable(target) || isSynchronousStatistics(target) || isSynchronousNumericStatistics(target) || isSynchronousBigIntStatistics(target) || isSynchronousWindowCollectable(target);
    }
    return false;
};
/**
 * Tests whether a non-null object carries the AsynchronousOrderedCollectable marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isAsynchronousOrderedCollectable: (target: unknown) => target is AsynchronousOrderedCollectable<unknown> = (target: unknown): target is AsynchronousOrderedCollectable<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousOrderedCollectable") === AsynchronousOrderedCollectableSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the SynchronousOrderedCollectable marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isSynchronousOrderedCollectable: (target: unknown) => target is SynchronousOrderedCollectable<unknown> = (target: unknown): target is SynchronousOrderedCollectable<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousOrderedCollectable") === SynchronousOrderedCollectableSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the AsynchronousUnorderedCollectable marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isAsynchronousUnorderedCollectable: (target: unknown) => target is AsynchronousUnorderedCollectable<unknown> = (target: unknown): target is AsynchronousUnorderedCollectable<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousUnorderedCollectable") === AsynchronousUnorderedCollectableSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the SynchronousUnorderedCollectable marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isSynchronousUnorderedCollectable: (target: unknown) => target is SynchronousUnorderedCollectable<unknown> = (target: unknown): target is SynchronousUnorderedCollectable<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousUnorderedCollectable") === SynchronousUnorderedCollectableSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the AsynchronousStatistics marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isAsynchronousStatistics: (target: unknown) => target is AsynchronousStatistics<unknown, number | bigint> = (target: unknown): target is AsynchronousStatistics<unknown, number | bigint> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousStatistics") === AsynchronousStatisticsSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the SynchronousStatistics marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isSynchronousStatistics: (target: unknown) => target is SynchronousStatistics<unknown, number | bigint> = (target: unknown): target is SynchronousStatistics<unknown, number | bigint> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousStatistics") === SynchronousStatisticsSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the AsynchronousBigIntStatistics marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isAsynchronousBigIntStatistics: (target: unknown) => target is AsynchronousBigIntStatistics<unknown> = (target: unknown): target is AsynchronousBigIntStatistics<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousBigIntStatistics") === AsynchronousBigIntStatisticsSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the SynchronousBigIntStatistics marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isSynchronousBigIntStatistics: (target: unknown) => target is SynchronousBigIntStatistics<unknown> = (target: unknown): target is SynchronousBigIntStatistics<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousBigIntStatistics") === SynchronousBigIntStatisticsSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the AsynchronousNumericStatistics marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isAsynchronousNumericStatistics: (target: unknown) => target is AsynchronousNumericStatistics<unknown> = (target: unknown): target is AsynchronousNumericStatistics<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousNumericStatistics") === AsynchronousNumericStatisticsSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the SynchronousNumericStatistics marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isSynchronousNumericStatistics: (target: unknown) => target is SynchronousNumericStatistics<unknown> = (target: unknown): target is SynchronousNumericStatistics<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousNumericStatistics") === SynchronousNumericStatisticsSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the AsynchronousWindowCollectable marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isAsynchronousWindowCollectable: (target: unknown) => target is AsynchronousWindowCollectable<unknown> = (target: unknown): target is AsynchronousWindowCollectable<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousWindowCollectable") === AsynchronousWindowCollectableSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the SynchronousWindowCollectable marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isSynchronousWindowCollectable: (target: unknown) => target is SynchronousWindowCollectable<unknown> = (target: unknown): target is SynchronousWindowCollectable<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousWindowCollectable") === SynchronousWindowCollectableSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the SynchronousCollector marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isSynchronousCollector: (target: unknown) => target is SynchronousCollector<unknown, unknown, unknown> = (target: unknown): target is SynchronousCollector<unknown, unknown, unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "SynchronousCollector") === SynchronousCollectorSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the AsynchronousCollector marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isAsynchronousCollector: (target: unknown) => target is AsynchronousCollector<unknown, unknown, unknown> = (target: unknown): target is AsynchronousCollector<unknown, unknown, unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "AsynchronousCollector") === AsynchronousCollectorSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object carries the Optional marker.
 * @param target - The value to inspect.
 * @returns Whether the marker matches the registered symbol; methods are not validated.
 */
export let isOptional: (target: unknown) => target is Optional<unknown> = (target: unknown): target is Optional<unknown> => {
    if (isObject(target)) {
        return Reflect.get(target, "Optional") === OptionalSymbol;
    }
    return false;
};
/**
 * Tests whether a non-null object exposes callable then and catch properties.
 * @param target - The value to inspect.
 * @returns Whether both promise-like methods exist; native Promise identity is not required.
 */
export let isPromise: (target: unknown) => target is Promise<unknown> = (target: unknown): target is Promise<unknown> => {
    if (isObject(target)) {
        return isFunction(Reflect.get(target, "then")) && isFunction(Reflect.get(target, "catch"));
    }
    return false;
};
/**
 * Tests a function for the AsyncFunction string tag and constructor name.
 * @param target - The value to inspect.
 * @returns Whether both asynchronous function markers match.
 */
export let isAsyncFunction: (target: unknown) => target is AsyncFunction = (target: unknown): target is AsyncFunction => {
    if (isFunction(target)) {
        return Reflect.get(target, Symbol.toStringTag) === "AsyncFunction" && target.constructor.name === "AsyncFunction";
    }
    return false;
};
/**
 * Checks for generator constructor metadata after requiring an object runtime type.
 * The subsequent function check cannot pass for such an object, so this currently returns false.
 * @param target - The value to inspect.
 * @returns False under the current object and function checks.
 */
export let isGeneratorFunction: (target: unknown) => target is Generator<unknown, unknown, unknown> = (target: unknown): target is Generator<unknown, unknown, unknown> => {
    if (isObject(target)) {
        return isFunction(target) && Reflect.get(target, "constructor").name === "GeneratorFunction";
    }
    return false;
};
/**
 * Checks for asynchronous generator constructor metadata after requiring an object runtime type.
 * The subsequent function check cannot pass for such an object, so this currently returns false.
 * @param target - The value to inspect.
 * @returns False under the current object and function checks.
 */
export let isAsyncGeneratorFunction: (target: unknown) => target is AsyncGenerator<unknown, unknown, unknown> = (target: unknown): target is AsyncGenerator<unknown, unknown, unknown> => {
    if (isObject(target)) {
        return isFunction(target) && Reflect.get(target, "constructor").name === "AsyncGeneratorFunction";
    }
    return false;
};
const hasBrand = (target: unknown, key: symbol): boolean => {
    return (isObject(target) || isFunction(target)) && typeof Reflect.get(target, key) === "symbol";
};
/**
 * Tests for the SynchronousCollection symbol-keyed brand and any required base brands.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousCollection: (target: unknown) => target is SynchronousCollection<unknown> = (target: unknown): target is SynchronousCollection<unknown> => {
    return hasBrand(target, SynchronousCollectionSymbol);
};
/**
 * Tests for the AsynchronousCollection symbol-keyed brand and any required base brands.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousCollection: (target: unknown) => target is AsynchronousCollection<unknown> = (target: unknown): target is AsynchronousCollection<unknown> => {
    return hasBrand(target, AsynchronousCollectionSymbol);
};
/**
 * Tests for the AsynchronousList symbol-keyed brand and any required base brands.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousList: (target: unknown) => target is AsynchronousList<unknown> = (target: unknown): target is AsynchronousList<unknown> => {
    return hasBrand(target, AsynchronousListSymbol) && isAsynchronousCollection(target);
};
/**
 * Tests for the SynchronousList symbol-keyed brand and any required base brands.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousList: (target: unknown) => target is SynchronousList<unknown> = (target: unknown): target is SynchronousList<unknown> => {
    return hasBrand(target, SynchronousListSymbol) && isSynchronousCollection(target);
};
/**
 * Tests for the AsynchronousOrderedSet symbol-keyed brand and the collection brand.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousOrderedSet: (target: unknown) => target is AsynchronousOrderedSet<unknown> = (target: unknown): target is AsynchronousOrderedSet<unknown> => {
    return hasBrand(target, AsynchronousOrderedSetSymbol) && isAsynchronousCollection(target);
};
/**
 * Tests for the AsynchronousUnorderedSet symbol-keyed brand and the collection brand.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousUnorderedSet: (target: unknown) => target is AsynchronousUnorderedSet<unknown> = (target: unknown): target is AsynchronousUnorderedSet<unknown> => {
    return hasBrand(target, AsynchronousUnorderedSetSymbol) && isAsynchronousCollection(target);
};
/**
 * Tests for the SynchronousOrderedSet symbol-keyed brand and the collection brand.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousOrderedSet: (target: unknown) => target is SynchronousOrderedSet<unknown> = (target: unknown): target is SynchronousOrderedSet<unknown> => {
    return hasBrand(target, SynchronousOrderedSetSymbol) && isSynchronousCollection(target);
};
/**
 * Tests for the SynchronousUnorderedSet symbol-keyed brand and the collection brand.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousUnorderedSet: (target: unknown) => target is SynchronousUnorderedSet<unknown> = (target: unknown): target is SynchronousUnorderedSet<unknown> => {
    return hasBrand(target, SynchronousUnorderedSetSymbol) && isSynchronousCollection(target);
};
/**
 * Tests for the AsynchronousOrderedMap symbol-keyed brand.
 * Also checks that the ordered flag agrees with the requested map kind.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousOrderedMap: (target: unknown) => target is AsynchronousOrderedMap<unknown, unknown> = (target: unknown): target is AsynchronousOrderedMap<unknown, unknown> => {
    return hasBrand(target, AsynchronousOrderedMapSymbol) && Reflect.get(Object(target), "ordered") === true;
};
/**
 * Tests for the AsynchronousUnorderedMap symbol-keyed brand.
 * Also checks that the ordered flag agrees with the requested map kind.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousUnorderedMap: (target: unknown) => target is AsynchronousUnorderedMap<unknown, unknown> = (target: unknown): target is AsynchronousUnorderedMap<unknown, unknown> => {
    return hasBrand(target, AsynchronousUnorderedMapSymbol) && Reflect.get(Object(target), "ordered") === false;
};
/**
 * Tests for the SynchronousOrderedMap symbol-keyed brand.
 * Also checks that the ordered flag agrees with the requested map kind.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousOrderedMap: (target: unknown) => target is SynchronousOrderedMap<unknown, unknown> = (target: unknown): target is SynchronousOrderedMap<unknown, unknown> => {
    return hasBrand(target, SynchronousOrderedMapSymbol) && Reflect.get(Object(target), "ordered") === true;
};
/**
 * Tests for the SynchronousUnorderedMap symbol-keyed brand.
 * Also checks that the ordered flag agrees with the requested map kind.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousUnorderedMap: (target: unknown) => target is SynchronousUnorderedMap<unknown, unknown> = (target: unknown): target is SynchronousUnorderedMap<unknown, unknown> => {
    return hasBrand(target, SynchronousUnorderedMapSymbol) && Reflect.get(Object(target), "ordered") === false;
};
/**
 * Tests for the AsynchronousMapEntry symbol-keyed brand and any required base brands.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousMapEntry: (target: unknown) => target is AsynchronousMapEntry<unknown, unknown> = (target: unknown): target is AsynchronousMapEntry<unknown, unknown> => {
    return hasBrand(target, AsynchronousMapEntrySymbol);
};
/**
 * Tests for the SynchronousMapEntry symbol-keyed brand and any required base brands.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousMapEntry: (target: unknown) => target is SynchronousMapEntry<unknown, unknown> = (target: unknown): target is SynchronousMapEntry<unknown, unknown> => {
    return hasBrand(target, SynchronousMapEntrySymbol);
};
/**
 * Tests for the AsynchronousLRUList symbol-keyed brand and any required base brands.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousLRUList: (target: unknown) => target is AsynchronousLRUList<unknown> = (target: unknown): target is AsynchronousLRUList<unknown> => {
    return hasBrand(target, AsynchronousLRUListSymbol) && isAsynchronousList(target);
};
/**
 * Tests for the SynchronousLRUList symbol-keyed brand and any required base brands.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousLRUList: (target: unknown) => target is SynchronousLRUList<unknown> = (target: unknown): target is SynchronousLRUList<unknown> => {
    return hasBrand(target, SynchronousLRUListSymbol) && isSynchronousList(target);
};
/**
 * Tests for the AsynchronousLRUSet symbol-keyed brand and an ordered/unordered set core.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousLRUSet: (target: unknown) => target is AsynchronousLRUSet<unknown> = (target: unknown): target is AsynchronousLRUSet<unknown> => {
    return hasBrand(target, AsynchronousLRUSetSymbol) && (isAsynchronousOrderedSet(target) || isAsynchronousUnorderedSet(target));
};
/**
 * Tests for the SynchronousLRUSet symbol-keyed brand and an ordered/unordered set core.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousLRUSet: (target: unknown) => target is SynchronousLRUSet<unknown> = (target: unknown): target is SynchronousLRUSet<unknown> => {
    return hasBrand(target, SynchronousLRUSetSymbol) && (isSynchronousOrderedSet(target) || isSynchronousUnorderedSet(target));
};
/**
 * Tests for the AsynchronousOrderedLRUSet symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousOrderedLRUSet: (target: unknown) => target is AsynchronousOrderedLRUSet<unknown> = (target: unknown): target is AsynchronousOrderedLRUSet<unknown> => {
    return hasBrand(target, AsynchronousOrderedLRUSetSymbol) && isAsynchronousLRUSet(target) && isAsynchronousOrderedSet(target);
};
/**
 * Tests for the AsynchronousUnorderedLRUSet symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousUnorderedLRUSet: (target: unknown) => target is AsynchronousUnorderedLRUSet<unknown> = (target: unknown): target is AsynchronousUnorderedLRUSet<unknown> => {
    return hasBrand(target, AsynchronousUnorderedLRUSetSymbol) && isAsynchronousLRUSet(target) && isAsynchronousUnorderedSet(target);
};
/**
 * Tests for the SynchronousOrderedLRUSet symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousOrderedLRUSet: (target: unknown) => target is SynchronousOrderedLRUSet<unknown> = (target: unknown): target is SynchronousOrderedLRUSet<unknown> => {
    return hasBrand(target, SynchronousOrderedLRUSetSymbol) && isSynchronousLRUSet(target) && isSynchronousOrderedSet(target);
};
/**
 * Tests for the SynchronousUnorderedLRUSet symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousUnorderedLRUSet: (target: unknown) => target is SynchronousUnorderedLRUSet<unknown> = (target: unknown): target is SynchronousUnorderedLRUSet<unknown> => {
    return hasBrand(target, SynchronousUnorderedLRUSetSymbol) && isSynchronousLRUSet(target) && isSynchronousUnorderedSet(target);
};
/**
 * Tests for the AsynchronousLRUMap symbol-keyed brand and any required base brands.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousLRUMap: (target: unknown) => target is AsynchronousLRUMap<unknown, unknown> = (target: unknown): target is AsynchronousLRUMap<unknown, unknown> => {
    return hasBrand(target, AsynchronousLRUMapSymbol) && (isAsynchronousOrderedMap(target) || isAsynchronousUnorderedMap(target));
};
/**
 * Tests for the SynchronousLRUMap symbol-keyed brand and any required base brands.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousLRUMap: (target: unknown) => target is SynchronousLRUMap<unknown, unknown> = (target: unknown): target is SynchronousLRUMap<unknown, unknown> => {
    return hasBrand(target, SynchronousLRUMapSymbol) && (isSynchronousOrderedMap(target) || isSynchronousUnorderedMap(target));
};
/**
 * Tests for the AsynchronousOrderedLRUMap symbol-keyed brand and any required base brands.
 * Also checks that the ordered flag agrees with the requested map kind.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousOrderedLRUMap: (target: unknown) => target is AsynchronousOrderedLRUMap<unknown, unknown> = (target: unknown): target is AsynchronousOrderedLRUMap<unknown, unknown> => {
    return hasBrand(target, AsynchronousOrderedLRUMapSymbol) && isAsynchronousLRUMap(target) && isAsynchronousOrderedMap(target);
};
/**
 * Tests for the AsynchronousUnorderedLRUMap symbol-keyed brand and any required base brands.
 * Also checks that the ordered flag agrees with the requested map kind.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousUnorderedLRUMap: (target: unknown) => target is AsynchronousUnorderedLRUMap<unknown, unknown> = (target: unknown): target is AsynchronousUnorderedLRUMap<unknown, unknown> => {
    return hasBrand(target, AsynchronousUnorderedLRUMapSymbol) && isAsynchronousLRUMap(target) && isAsynchronousUnorderedMap(target);
};
/**
 * Tests for the SynchronousOrderedLRUMap symbol-keyed brand and any required base brands.
 * Also checks that the ordered flag agrees with the requested map kind.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousOrderedLRUMap: (target: unknown) => target is SynchronousOrderedLRUMap<unknown, unknown> = (target: unknown): target is SynchronousOrderedLRUMap<unknown, unknown> => {
    return hasBrand(target, SynchronousOrderedLRUMapSymbol) && isSynchronousLRUMap(target) && isSynchronousOrderedMap(target);
};
/**
 * Tests for the SynchronousUnorderedLRUMap symbol-keyed brand and any required base brands.
 * Also checks that the ordered flag agrees with the requested map kind.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousUnorderedLRUMap: (target: unknown) => target is SynchronousUnorderedLRUMap<unknown, unknown> = (target: unknown): target is SynchronousUnorderedLRUMap<unknown, unknown> => {
    return hasBrand(target, SynchronousUnorderedLRUMapSymbol) && isSynchronousLRUMap(target) && isSynchronousUnorderedMap(target);
};
/**
 * Tests for the AsynchronousSkipList symbol-keyed brand and any required base brands.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousSkipList: (target: unknown) => target is AsynchronousSkipList<unknown> = (target: unknown): target is AsynchronousSkipList<unknown> => {
    return hasBrand(target, AsynchronousSkipListSymbol) && isAsynchronousList(target);
};
/**
 * Tests for the SynchronousSkipList symbol-keyed brand and any required base brands.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousSkipList: (target: unknown) => target is SynchronousSkipList<unknown> = (target: unknown): target is SynchronousSkipList<unknown> => {
    return hasBrand(target, SynchronousSkipListSymbol) && isSynchronousList(target);
};
/**
 * Tests for the AsynchronousSkipSet symbol-keyed brand and an ordered/unordered set core.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousSkipSet: (target: unknown) => target is AsynchronousSkipSet<unknown> = (target: unknown): target is AsynchronousSkipSet<unknown> => {
    return hasBrand(target, AsynchronousSkipSetSymbol) && (isAsynchronousOrderedSet(target) || isAsynchronousUnorderedSet(target));
};
/**
 * Tests for the SynchronousSkipSet symbol-keyed brand and an ordered/unordered set core.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousSkipSet: (target: unknown) => target is SynchronousSkipSet<unknown> = (target: unknown): target is SynchronousSkipSet<unknown> => {
    return hasBrand(target, SynchronousSkipSetSymbol) && (isSynchronousOrderedSet(target) || isSynchronousUnorderedSet(target));
};
/**
 * Tests for the AsynchronousOrderedSkipSet symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousOrderedSkipSet: (target: unknown) => target is AsynchronousOrderedSkipSet<unknown> = (target: unknown): target is AsynchronousOrderedSkipSet<unknown> => {
    return hasBrand(target, AsynchronousOrderedSkipSetSymbol) && isAsynchronousSkipSet(target) && isAsynchronousOrderedSet(target);
};
/**
 * Tests for the AsynchronousUnorderedSkipSet symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousUnorderedSkipSet: (target: unknown) => target is AsynchronousUnorderedSkipSet<unknown> = (target: unknown): target is AsynchronousUnorderedSkipSet<unknown> => {
    return hasBrand(target, AsynchronousUnorderedSkipSetSymbol) && isAsynchronousSkipSet(target) && isAsynchronousUnorderedSet(target);
};
/**
 * Tests for the SynchronousOrderedSkipSet symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousOrderedSkipSet: (target: unknown) => target is SynchronousOrderedSkipSet<unknown> = (target: unknown): target is SynchronousOrderedSkipSet<unknown> => {
    return hasBrand(target, SynchronousOrderedSkipSetSymbol) && isSynchronousSkipSet(target) && isSynchronousOrderedSet(target);
};
/**
 * Tests for the SynchronousUnorderedSkipSet symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousUnorderedSkipSet: (target: unknown) => target is SynchronousUnorderedSkipSet<unknown> = (target: unknown): target is SynchronousUnorderedSkipSet<unknown> => {
    return hasBrand(target, SynchronousUnorderedSkipSetSymbol) && isSynchronousSkipSet(target) && isSynchronousUnorderedSet(target);
};
/**
 * Tests for the AsynchronousSkipMap symbol-keyed brand and any required base brands.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousSkipMap: (target: unknown) => target is AsynchronousSkipMap<unknown, unknown> = (target: unknown): target is AsynchronousSkipMap<unknown, unknown> => {
    return hasBrand(target, AsynchronousSkipMapSymbol) && (isAsynchronousOrderedMap(target) || isAsynchronousUnorderedMap(target));
};
/**
 * Tests for the SynchronousSkipMap symbol-keyed brand and any required base brands.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousSkipMap: (target: unknown) => target is SynchronousSkipMap<unknown, unknown> = (target: unknown): target is SynchronousSkipMap<unknown, unknown> => {
    return hasBrand(target, SynchronousSkipMapSymbol) && (isSynchronousOrderedMap(target) || isSynchronousUnorderedMap(target));
};
/**
 * Tests for the AsynchronousOrderedSkipMap symbol-keyed brand and any required base brands.
 * Also checks that the ordered flag agrees with the requested map kind.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousOrderedSkipMap: (target: unknown) => target is AsynchronousOrderedSkipMap<unknown, unknown> = (target: unknown): target is AsynchronousOrderedSkipMap<unknown, unknown> => {
    return hasBrand(target, AsynchronousOrderedSkipMapSymbol) && isAsynchronousSkipMap(target) && isAsynchronousOrderedMap(target);
};
/**
 * Tests for the AsynchronousUnorderedSkipMap symbol-keyed brand and any required base brands.
 * Also checks that the ordered flag agrees with the requested map kind.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isAsynchronousUnorderedSkipMap: (target: unknown) => target is AsynchronousUnorderedSkipMap<unknown, unknown> = (target: unknown): target is AsynchronousUnorderedSkipMap<unknown, unknown> => {
    return hasBrand(target, AsynchronousUnorderedSkipMapSymbol) && isAsynchronousSkipMap(target) && isAsynchronousUnorderedMap(target);
};
/**
 * Tests for the SynchronousOrderedSkipMap symbol-keyed brand and any required base brands.
 * Also checks that the ordered flag agrees with the requested map kind.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousOrderedSkipMap: (target: unknown) => target is SynchronousOrderedSkipMap<unknown, unknown> = (target: unknown): target is SynchronousOrderedSkipMap<unknown, unknown> => {
    return hasBrand(target, SynchronousOrderedSkipMapSymbol) && isSynchronousSkipMap(target) && isSynchronousOrderedMap(target);
};
/**
 * Tests for the SynchronousUnorderedSkipMap symbol-keyed brand and any required base brands.
 * Also checks that the ordered flag agrees with the requested map kind.
 * @param target - The value to inspect.
 * @returns Whether the structure advertises the required brands; its methods are not validated.
 */
export let isSynchronousUnorderedSkipMap: (target: unknown) => target is SynchronousUnorderedSkipMap<unknown, unknown> = (target: unknown): target is SynchronousUnorderedSkipMap<unknown, unknown> => {
    return hasBrand(target, SynchronousUnorderedSkipMapSymbol) && isSynchronousSkipMap(target) && isSynchronousUnorderedMap(target);
};
/**
 * Tests for the Angle symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Angle brand; its methods are not validated.
 */
export let isAngle: (target: unknown) => target is Angle = (target: unknown): target is Angle => {
    return hasBrand(target, AngleSymbol);
};
/**
 * Tests for the PhaseField symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the PhaseField brand; its methods are not validated.
 */
export let isPhaseField: (target: unknown) => target is PhaseField = (target: unknown): target is PhaseField => {
    return hasBrand(target, PhaseFieldSymbol);
};
/**
 * Tests for the Bin symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Bin brand; its methods are not validated.
 */
export let isBin: (target: unknown) => target is Bin = (target: unknown): target is Bin => {
    return hasBrand(target, BinSymbol);
};
/**
 * Tests for the Coherence symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Coherence brand; its methods are not validated.
 */
export let isCoherence: (target: unknown) => target is Coherence = (target: unknown): target is Coherence => {
    return hasBrand(target, CoherenceSymbol);
};
/**
 * Tests for the Complex symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Complex brand; its methods are not validated.
 */
export let isComplex: (target: unknown) => target is Complex = (target: unknown): target is Complex => {
    return hasBrand(target, ComplexSymbol);
};
/**
 * Tests for the Envelope symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Envelope brand; its methods are not validated.
 */
export let isEnvelope: (target: unknown) => target is Envelope = (target: unknown): target is Envelope => {
    return hasBrand(target, EnvelopeSymbol);
};
/**
 * Tests for the Epicycle symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Epicycle brand; its methods are not validated.
 */
export let isEpicycle: (target: unknown) => target is Epicycle = (target: unknown): target is Epicycle => {
    return hasBrand(target, EpicycleSymbol);
};
/**
 * Tests for the Frame symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Frame brand; its methods are not validated.
 */
export let isFrame: (target: unknown) => target is Frame = (target: unknown): target is Frame => {
    return hasBrand(target, FrameSymbol);
};
/**
 * Tests for the Frequency symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Frequency brand; its methods are not validated.
 */
export let isFrequency: (target: unknown) => target is Frequency = (target: unknown): target is Frequency => {
    return hasBrand(target, FrequencySymbol);
};
/**
 * Tests for the Omega symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Omega brand; its methods are not validated.
 */
export let isOmega: (target: unknown) => target is Omega = (target: unknown): target is Omega => {
    return hasBrand(target, OmegaSymbol);
};
/**
 * Tests for the Sample symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Sample brand; its methods are not validated.
 */
export let isSample: (target: unknown) => target is Sample = (target: unknown): target is Sample => {
    return hasBrand(target, SampleSymbol);
};
/**
 * Tests for the Sampler symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Sampler brand; its methods are not validated.
 */
export let isSampler: (target: unknown) => target is Sampler = (target: unknown): target is Sampler => {
    return hasBrand(target, SamplerSymbol);
};
/**
 * Tests for the Spectrogram symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Spectrogram brand; its methods are not validated.
 */
export let isSpectrogram: (target: unknown) => target is Spectrogram = (target: unknown): target is Spectrogram => {
    return hasBrand(target, SpectrogramSymbol);
};
/**
 * Tests for the Spectrum symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Spectrum brand; its methods are not validated.
 */
export let isSpectrum: (target: unknown) => target is Spectrum = (target: unknown): target is Spectrum => {
    return hasBrand(target, SpectrumSymbol);
};
/**
 * Tests for the Tone symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Tone brand; its methods are not validated.
 */
export let isTone: (target: unknown) => target is Tone = (target: unknown): target is Tone => {
    return hasBrand(target, ToneSymbol);
};
/**
 * Tests for the Track symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Track brand; its methods are not validated.
 */
export let isTrack: (target: unknown) => target is Track = (target: unknown): target is Track => {
    return hasBrand(target, TrackSymbol);
};
/**
 * Tests for the TrackEvent symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the TrackEvent brand; its methods are not validated.
 */
export let isTrackEvent: (target: unknown) => target is TrackEvent = (target: unknown): target is TrackEvent => {
    return hasBrand(target, TrackEventSymbol);
};
/**
 * Tests for the Waveform symbol-keyed brand.
 * @param target - The value to inspect.
 * @returns Whether the value advertises the Waveform brand; its methods are not validated.
 */
export let isWaveform: (target: unknown) => target is Waveform = (target: unknown): target is Waveform => {
    return hasBrand(target, WaveformSymbol);
};
