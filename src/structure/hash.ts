import { XXHash64, useHash as useStructuralHash } from "#semantic/hash";
import type { Primitive } from "#semantic/utility";

let sequence: bigint = 0n;

const nextSequence = (): bigint => {
    sequence += 1n;
    return sequence;
};

/**
 * Records the most recent access sequence for primitive keys.
 *
 * Sequence values are shared with `ObjectiveLastNearestUsage`, so access times
 * can be compared across both registries. This registry retains keys strongly;
 * call `delete` when a key is removed from its owning map.
 */
class PrimitiveLastNearestUsage {
    private readonly cache: Map<Primitive, bigint> = new Map<Primitive, bigint>();

    /**
     * Records an access and returns its sequence number.
     *
     * @param key the primitive key that was accessed
     * @returns the monotonically increasing access sequence
     */
    touch(key: Primitive): bigint {
        const value = nextSequence();
        this.cache.set(key, value);
        return value;
    }

    /**
     * Returns the sequence number of the most recent recorded access.
     *
     * @param key the key whose access sequence is requested
     * @returns the access sequence, or `undefined` if the key is not registered
     */
    get(key: Primitive): bigint | undefined {
        return this.cache.get(key);
    }

    /**
     * Removes a key from this registry.
     *
     * @param key the key to remove
     * @returns `true` if the key was registered
     */
    delete(key: Primitive): boolean {
        return this.cache.delete(key);
    }

    /**
     * Tests whether an access has been recorded for the specified key.
     *
     * @param key the key to test
     * @returns `true` if this registry contains the key
     */
    has(key: Primitive): boolean {
        return this.cache.has(key);
    }

    /** Removes all primitive keys without resetting the shared sequence. */
    clear(): void {
        this.cache.clear();
    }

    /** Returns the number of registered primitive keys. */
    size(): bigint {
        return BigInt(this.cache.size);
    }
}

/**
 * Records the most recent access sequence for object and function keys.
 *
 * Sequence values are shared with `PrimitiveLastNearestUsage`, allowing access
 * times to be compared across both registries. Keys are weakly held and do not
 * keep objects alive. A weak registry does not expose its size or iteration.
 */
class ObjectiveLastNearestUsage {
    private cache: WeakMap<WeakKey, bigint> = new WeakMap<WeakKey, bigint>();

    /**
     * Records an access and returns its sequence number.
     *
     * @param key the object or function key that was accessed
     * @returns the monotonically increasing access sequence
     */
    touch(key: WeakKey): bigint {
        const value = nextSequence();
        this.cache.set(key, value);
        return value;
    }

    /**
     * Returns the sequence number of the most recent recorded access.
     *
     * @param key the key whose access sequence is requested
     * @returns the access sequence, or `undefined` if the key is not registered
     */
    get(key: WeakKey): bigint | undefined {
        return this.cache.get(key);
    }

    /**
     * Removes a key from this registry.
     *
     * @param key the key to remove
     * @returns `true` if the key was registered
     */
    delete(key: WeakKey): boolean {
        return this.cache.delete(key);
    }

    /**
     * Tests whether an access has been recorded for the specified key.
     *
     * @param key the key to test
     * @returns `true` if this registry contains the key
     */
    has(key: WeakKey): boolean {
        return this.cache.has(key);
    }

    /** Removes all weak registrations without resetting the shared sequence. */
    clear(): void {
        this.cache = new WeakMap<WeakKey, bigint>();
    }
}

/** Shared registry for primitive access records. */
export const primitiveLastNearestUsage = new PrimitiveLastNearestUsage();

/** Shared registry for weak object and function access records. */
export const objectiveLastNearestUsage = new ObjectiveLastNearestUsage();

/** Hashes `null` using the shared structural hash implementation. */
export const useHashNull = <T extends null>(target: T): bigint => {
    if (target !== null) {
        throw new TypeError("useHashNull requires null.");
    }
    return useStructuralHash(target);
};

/** Hashes `undefined` using the shared structural hash implementation. */
export const useHashUndefined = <T extends undefined>(target: T): bigint => {
    if (target !== undefined) {
        throw new TypeError("useHashUndefined requires undefined.");
    }
    return useStructuralHash(target);
};

/** Hashes a primitive boolean; boxed booleans are not accepted. */
export const useHashBoolean = <T extends boolean>(target: T): bigint => {
    if (typeof target !== "boolean") {
        throw new TypeError("useHashBoolean requires a boolean.");
    }
    return useStructuralHash(target);
};

/** Hashes a function using the shared structural hash implementation. */
export const useHashFunction = <T extends CallableFunction>(target: T): bigint => {
    if (typeof target !== "function") {
        throw new TypeError("useHashFunction requires a function.");
    }
    return useStructuralHash(target);
};

/** Hashes a primitive symbol; different symbols may have colliding hashes. */
export const useHashSymbol = <T extends symbol>(target: T): bigint => {
    if (typeof target !== "symbol") {
        throw new TypeError("useHashSymbol requires a symbol.");
    }
    return useStructuralHash(target);
};

/** Hashes a primitive number, including NaN and infinities, with shared caching. */
export const useHashNumber = <T extends number>(target: T): bigint => {
    if (typeof target !== "number") {
        throw new TypeError("useHashNumber requires a number.");
    }
    return useStructuralHash(target);
};

/** Hashes a primitive string; boxed strings are not accepted. */
export const useHashString = <T extends string>(target: T): bigint => {
    if (typeof target !== "string") {
        throw new TypeError("useHashString requires a string.");
    }
    return useStructuralHash(target);
};

/**
 * Hashes a non-null object or function with the shared structural hash cache.
 *
 * This preserves the existing cycle handling and cached-after-mutation behavior;
 * hashes are not identity tokens, so distinct objects can share a hash.
 */
export const useHashObject = <T extends object>(target: T): bigint => {
    if (target === null || (typeof target !== "object" && typeof target !== "function")) {
        throw new TypeError("useHashObject requires a non-null object or function.");
    }
    return useStructuralHash(target);
};

/**
 * Consumes an iterable into a type-framed, ordered XXH64 digest.
 *
 * Each element contributes its shared structural hash as eight bytes. State and
 * results stay within 64 bits regardless of input length; the input is consumed
 * once with constant hashing state. Normal iterator cleanup applies on failure.
 * Results, including the empty digest, differ from the legacy rolling hash.
 */
export const useHashIterable = <T extends Iterable<unknown>>(target: T): bigint => {
    if (target === null || target === undefined || typeof target[Symbol.iterator] !== "function") {
        throw new TypeError("useHashIterable requires an iterable.");
    }
    const hash = new XXHash64().updateByte(9);
    for (const value of target) {
        hash.updateWord(useStructuralHash(value));
    }
    return hash.digest();
};

/**
 * Consumes an async iterable using the same ordered XXH64 as `useHashIterable`.
 *
 * Empty sync and async sources have the same unsigned 64-bit digest. Hashing
 * failures reject; `for await...of` awaits cleanup on abrupt loop termination.
 */
export const useHashAsyncIterable = async <T extends AsyncIterable<unknown>>(target: T): Promise<bigint> => {
    if (target === null || target === undefined || typeof target[Symbol.asyncIterator] !== "function") {
        throw new TypeError("useHashAsyncIterable requires an async iterable.");
    }
    const hash = new XXHash64().updateByte(9);
    for await (const value of target) {
        hash.updateWord(useStructuralHash(value));
    }
    return hash.digest();
};

/**
 * Call signatures of the structural `useHash` dispatcher.
 *
 * The overload family lets the return type follow the argument: every
 * synchronous input hashes to a `bigint`, while an async iterable is consumed
 * asynchronously and therefore yields `Promise<bigint>`. At runtime the
 * implementation chooses by `typeof` and by protocol presence rather than by
 * the selected overload: `null` is handled before the switch, strings are
 * hashed as scalars instead of being iterated, and async iteration wins when a
 * value implements both iteration protocols.
 *
 * The signatures below describe the branch each argument type reaches. The
 * final `unknown` signature is the fallback selected when the argument type is
 * too wide for a more specific one, and it keeps the union return type.
 */
interface UseHash {
    /**
     * Hashes `null` as a scalar.
     *
     * This branch runs before `typeof`, because `typeof null` is `"object"` and
     * a null would otherwise be treated as a structural object. The result is
     * synchronous and identical for every null input.
     *
     * @param target - the only accepted value, `null`
     * @returns the 64-bit structural hash of `null`
     */
    (target: null): bigint;
    /**
     * Hashes `undefined` through its dedicated handler.
     *
     * `undefined` is a value here rather than a missing argument, so the
     * dispatcher hashes it instead of rejecting the call. The digest is
     * synchronous and stable.
     *
     * @param target - the only accepted value, `undefined`
     * @returns the 64-bit structural hash of `undefined`
     */
    (target: undefined): bigint;
    /**
     * Hashes a primitive boolean without boxing it.
     *
     * The branch is selected by `typeof target === "boolean"`; a `Boolean`
     * object is `"object"` at runtime and takes the structural path instead, so
     * the two forms do not share a digest.
     *
     * @param target - the boolean to hash
     * @returns the 64-bit structural hash of the boolean
     */
    (target: boolean): bigint;
    /**
     * Hashes a primitive number, including `NaN` and the infinities.
     *
     * Numbers are encoded as their IEEE-754 bytes after a same-value-zero
     * canonicalisation, so `0` and `-0` agree and every `NaN` payload agrees.
     * Primitive number hashes are memoized, so repeating a value does not
     * re-encode it.
     *
     * @param target - the number to hash, including non-finite values
     * @returns the 64-bit structural hash of the number
     */
    (target: number): bigint;
    /**
     * Hashes a primitive bigint through the shared structural hash.
     *
     * Unlike the other primitives, bigint has no dedicated wrapper in this
     * module: the switch falls straight through to the shared hash, so there is
     * no extra argument check beyond the `typeof` that selected the branch. The
     * digest is synchronous and derived from the integer's hexadecimal form.
     *
     * @param target - the bigint to hash
     * @returns the 64-bit structural hash of the bigint
     */
    (target: bigint): bigint;
    /**
     * Hashes a string as a scalar rather than as an iterable of characters.
     *
     * Strings reach this branch before the iteration checks, so a string is
     * never walked element by element even though it implements
     * `Symbol.iterator`. Every UTF-16 code unit contributes two bytes, including
     * unpaired surrogates, and the length is framed into the digest.
     *
     * @param target - the string to hash
     * @returns the 64-bit structural hash of the string
     */
    (target: string): bigint;
    /**
     * Hashes a symbol by its registered key or its description.
     *
     * A symbol created with `Symbol.for` contributes its key, while a local
     * symbol contributes its description, so local symbols with equal
     * descriptions collide. A symbol without a description hashes the shared
     * empty representation.
     *
     * @param target - the symbol to hash
     * @returns the 64-bit structural hash of the symbol
     */
    (target: symbol): bigint;
    /**
     * Consumes an async iterable and hashes its elements in order.
     *
     * This is the only overload that returns a promise. Its protocol check runs
     * before the synchronous one, so a value implementing both is consumed
     * asynchronously. Each element contributes its structural hash under a
     * dedicated tag, so order and length are significant; the source is
     * traversed once and a failure rejects the promise.
     *
     * @param target - the asynchronous source to consume
     * @returns a promise for the 64-bit digest of the consumed elements
     */
    (target: AsyncIterable<unknown>): Promise<bigint>;
    /**
     * Consumes a synchronous iterable and hashes its elements in order.
     *
     * Arrays, sets, maps, typed arrays and generators reach this branch when
     * they do not also expose `Symbol.asyncIterator`; strings do not, because
     * they were handled as scalars earlier. The iterator is consumed exactly
     * once, each element contributes its structural hash, and the digest is
     * returned directly rather than wrapped in a promise.
     *
     * @param target - the synchronous source to consume
     * @returns the 64-bit digest of the consumed elements
     */
    (target: Iterable<unknown>): bigint;
    /**
     * Hashes an object or function structurally and memoizes the result.
     *
     * This branch catches everything that survived both iteration checks, which
     * includes plain objects, class instances and functions. The walker frames
     * the built-in toString tag, follows own keys in `Reflect.ownKeys` order and
     * records visited objects so cycles terminate; distinct objects with equal
     * contents therefore share a digest. The weak cache returns the first result
     * again, so mutating an object does not change its hash.
     *
     * @param target - the object or function to hash
     * @returns the 64-bit structural hash of the value
     */
    (target: object): bigint;
    /**
     * Dispatches an unrefined value at runtime and widens the return type.
     *
     * This signature is selected when the argument is typed as `unknown` or as
     * a union wide enough to match several overloads, so the static result is
     * the union of both outcomes. The implementation still makes one concrete
     * decision: async iterables produce a promise, and every other value,
     * including functions, produces a bigint immediately. Callers that need a
     * promise can narrow the argument with `isAsyncIterable` first.
     *
     * @param target - any value accepted by the dispatcher
     * @returns the digest, or a promise for it when the value iterates
     *          asynchronously
     */
    (target: unknown): bigint | Promise<bigint>;
}

/**
 * Hashes primitives and objects, or consumes iterable values in their order.
 *
 * Async iteration takes precedence over synchronous iteration for values that
 * implement both protocols. Strings retain their scalar hash. Async iterable
 * inputs return a promise; all other inputs return a bigint synchronously.
 */
export const useHash: UseHash = ((target: unknown): bigint | Promise<bigint> => {
    if (target === null) {
        return useHashNull(target);
    }
    switch (typeof target) {
        case "undefined":
            return useHashUndefined(target);
        case "boolean":
            return useHashBoolean(target);
        case "number":
            return useHashNumber(target);
        case "bigint":
            return useStructuralHash(target);
        case "string":
            return useHashString(target);
        case "symbol":
            return useHashSymbol(target);
    }
    if (typeof (target as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function") {
        return useHashAsyncIterable(target as AsyncIterable<unknown>);
    }
    if (typeof (target as Iterable<unknown>)[Symbol.iterator] === "function") {
        return useHashIterable(target as Iterable<unknown>);
    }
    return useHashObject(target as object);
}) as UseHash;