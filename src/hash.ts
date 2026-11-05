import { typeOf, type Primitive, type Type } from "#semantic/utility";

const UINT64_MASK = 0xffffffffffffffffn;
const PRIME64_1 = 0x9e3779b185ebca87n;
const PRIME64_2 = 0xc2b2ae3d27d4eb4fn;
const PRIME64_3 = 0x165667b19e3779f9n;
const PRIME64_4 = 0x85ebca77c2b2ae63n;
const PRIME64_5 = 0x27d4eb2f165667c5n;
const rotateLeft = (value: bigint, bits: bigint): bigint =>
    /* A shift pair implements the rotation; the mask drops the bits shifted in. */
    ((value << bits) | (value >> (64n - bits))) & UINT64_MASK;
const round = (accumulator: bigint, lane: bigint): bigint =>
    /* XXH64 round: fold the lane in, rotate by 31, then mix with PRIME64_1. */
    (rotateLeft((accumulator + lane * PRIME64_2) & UINT64_MASK, 31n) * PRIME64_1) & UINT64_MASK;
const merge = (accumulator: bigint, lane: bigint): bigint =>
    /* XXH64 merge step: run one round from a zero accumulator and fold the result in. */
    ((accumulator ^ round(0n, lane)) * PRIME64_1 + PRIME64_4) & UINT64_MASK;

/**
 * Incremental XXH64 with a 32-byte buffer and unsigned 64-bit state.
 * Implements the official algorithm, including little-endian lanes and avalanche:
 * https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md#xxh64-algorithm-description
 * This non-cryptographic hash does not protect against deliberate collisions.
 * @internal Shared by the structural and iterable hashing implementations.
 */
export class XXHash64 {
    private readonly seed: bigint;
    private readonly buffer = new Uint8Array(32);
    private readonly view = new DataView(this.buffer.buffer);
    private readonly word = new Uint8Array(8);
    private readonly wordView = new DataView(this.word.buffer);
    private buffered = 0;
    private length = 0n;
    private striped = false;
    private accumulator1: bigint;
    private accumulator2: bigint;
    private accumulator3: bigint;
    private accumulator4: bigint;

    /** Creates a stream with an optional seed reduced modulo 2^64. */
    constructor(seed = 0n) {
        this.seed = seed & UINT64_MASK;
        this.accumulator1 = (this.seed + PRIME64_1 + PRIME64_2) & UINT64_MASK;
        this.accumulator2 = (this.seed + PRIME64_2) & UINT64_MASK;
        this.accumulator3 = this.seed;
        this.accumulator4 = (this.seed - PRIME64_1) & UINT64_MASK;
    }

    private stripe(view: DataView, offset: number): void {
        this.accumulator1 = round(this.accumulator1, view.getBigUint64(offset, true));
        this.accumulator2 = round(this.accumulator2, view.getBigUint64(offset + 8, true));
        this.accumulator3 = round(this.accumulator3, view.getBigUint64(offset + 16, true));
        this.accumulator4 = round(this.accumulator4, view.getBigUint64(offset + 24, true));
        this.striped = true;
    }

    /** Appends bytes in their given order, without retaining the input array. */
    update(bytes: Uint8Array): this {
        this.length = (this.length + BigInt(bytes.byteLength)) & UINT64_MASK;
        let offset = 0;
        if (this.buffered + bytes.byteLength < 32) {
            this.buffer.set(bytes, this.buffered);
            this.buffered += bytes.byteLength;
            return this;
        }
        if (this.buffered > 0) {
            const needed = 32 - this.buffered;
            this.buffer.set(bytes.subarray(0, needed), this.buffered);
            this.stripe(this.view, 0);
            this.buffered = 0;
            offset = needed;
        }
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        for (; offset + 32 <= bytes.byteLength; offset += 32) {
            this.stripe(view, offset);
        }
        this.buffer.set(bytes.subarray(offset), 0);
        this.buffered = bytes.byteLength - offset;
        return this;
    }

    /** Appends one framing byte without allocating an input array. */
    updateByte(value: number): this {
        this.buffer[this.buffered++] = value;
        this.length = (this.length + 1n) & UINT64_MASK;
        if (this.buffered === 32) {
            this.stripe(this.view, 0);
            this.buffered = 0;
        }
        return this;
    }

    /** Appends a little-endian 64-bit word, reducing custom hashes modulo 2^64. */
    updateWord(value: bigint): this {
        if (this.buffered <= 24) {
            this.view.setBigUint64(this.buffered, value & UINT64_MASK, true);
            this.buffered += 8;
            this.length = (this.length + 8n) & UINT64_MASK;
            if (this.buffered === 32) {
                this.stripe(this.view, 0);
                this.buffered = 0;
            }
            return this;
        }
        this.wordView.setBigUint64(0, value & UINT64_MASK, true);
        return this.update(this.word);
    }

    /** Returns the digest without mutating the state, allowing further updates. */
    digest(): bigint {
        let result = this.striped
            ? (rotateLeft(this.accumulator1, 1n) + rotateLeft(this.accumulator2, 7n)
                + rotateLeft(this.accumulator3, 12n) + rotateLeft(this.accumulator4, 18n)) & UINT64_MASK
            : (this.seed + PRIME64_5) & UINT64_MASK;
        if (this.striped) {
            result = merge(result, this.accumulator1);
            result = merge(result, this.accumulator2);
            result = merge(result, this.accumulator3);
            result = merge(result, this.accumulator4);
        }
        result = (result + this.length) & UINT64_MASK;
        let offset = 0;
        for (; offset + 8 <= this.buffered; offset += 8) {
            result ^= round(0n, this.view.getBigUint64(offset, true));
            result = (rotateLeft(result, 27n) * PRIME64_1 + PRIME64_4) & UINT64_MASK;
        }
        if (offset + 4 <= this.buffered) {
            result ^= (BigInt(this.view.getUint32(offset, true)) * PRIME64_1) & UINT64_MASK;
            result = (rotateLeft(result, 23n) * PRIME64_2 + PRIME64_3) & UINT64_MASK;
            offset += 4;
        }
        for (; offset < this.buffered; offset++) {
            result ^= (BigInt(this.buffer[offset]) * PRIME64_5) & UINT64_MASK;
            result = (rotateLeft(result, 11n) * PRIME64_1) & UINT64_MASK;
        }
        result = ((result ^ (result >> 33n)) * PRIME64_2) & UINT64_MASK;
        result = ((result ^ (result >> 29n)) * PRIME64_3) & UINT64_MASK;
        return result ^ (result >> 32n);
    }
}

const types: Type[] = ["undefined", "null", "boolean", "number", "bigint", "symbol", "string", "function", "object"];
const masks = new Map<Type, bigint>(types.map((type, index) => [type, BigInt(index)]));
/** Returns the legacy type identifier; hashes now mix type tags across all 64 bits. */
export let maskOf = (type: Type): bigint => masks.get(type) ?? 8n;
const primitive = new Map<Primitive, bigint>();
const complex = new WeakMap<object, bigint>();
const PRIMITIVE_CACHE_LIMIT = 100000;
/**
 * A hashing strategy for one runtime type.
 *
 * The dispatcher keeps one handler per `Type` name and selects it with
 * `typeOf`, so this single contract covers both the built-in scalar and
 * structural strategies and any custom strategy installed through `register`.
 * A handler owns its digest completely: `useHash` adds no framing around the
 * returned value and only consults `typeOf` to choose the handler, so a
 * strategy that throws or ignores part of its input defines the observable
 * behaviour for that type. Registering or removing a handler also clears the
 * memoized primitive hashes, so a result cached under the old strategy is not
 * reused.
 *
 * @template T - the value type this handler is registered for
 */
interface Handler<T> {
    /**
     * Hashes one value of the registered type.
     *
     * The value has already been selected by its runtime type name, so the
     * handler may rely on the shape promised by `T`; the dispatcher does not
     * check that the registered name and the handler's assumptions agree. The
     * returned bigint becomes the hash of the value as it is, which makes the
     * handler the only place where that type's digest can be changed.
     *
     * @param value - the value whose runtime type selected this handler
     * @returns the hash of the value, conventionally an unsigned 64-bit
     *          number
     */
    (value: T): bigint;
}
const handlers = new Map<Type, Handler<unknown>>();
/** Registers a hashing handler and invalidates primitive memoized values. */
export let register = <T>(type: Type, handler: Handler<T>): void => {
    if (typeof type === "string" && typeof handler === "function") {
        handlers.set(type, handler as Handler<unknown>);
        primitive.clear();
    }
};
/** Removes a custom handler; built-in type handlers remain registered. */
export let unregister = (type: Type): void => {
    if (typeof type === "string" && !types.includes(type)) {
        handlers.delete(type);
        primitive.clear();
    }
};

/** Encodes every UTF-16 code unit, preserving even unpaired surrogates. */
const appendString = (hash: XXHash64, value: string): void => {
    hash.updateWord(BigInt(value.length));
    const bytes = new Uint8Array(Math.min(value.length, 2048) * 2);
    for (let offset = 0; offset < value.length; offset += 2048) {
        const size = Math.min(value.length - offset, 2048);
        for (let index = 0; index < size; index++) {
            const code = value.charCodeAt(offset + index);
            bytes[index * 2] = code & 0xff;
            bytes[index * 2 + 1] = code >>> 8;
        }
        hash.update(bytes.subarray(0, size * 2));
    }
};
const scalarHash = (value: Primitive | Function): bigint => {
    const type = typeOf(value);
    const hash = new XXHash64().updateByte(Number(maskOf(type)));
    switch (typeof value) {
        case "boolean":
            hash.updateByte(value ? 1 : 0);
            break;
        case "number": {
            const bytes = new Uint8Array(8);
            const view = new DataView(bytes.buffer);
            // SameValueZero semantics: both zeros and all NaN representations agree.
            if (Number.isNaN(value)) {
                view.setBigUint64(0, 0x7ff8000000000000n, true);
            } else {
                view.setFloat64(0, value === 0 ? 0 : value, true);
            }
            hash.update(bytes);
            break;
        }
        case "bigint":
            appendString(hash, value.toString(16));
            break;
        case "string":
            appendString(hash, value);
            break;
        case "symbol": {
            const key = Symbol.keyFor(value);
            hash.updateByte(key === undefined ? 0 : 1);
            // Symbols with equal descriptions may collide; hashes are not identities.
            hash.updateByte(value.description === undefined ? 0 : 1);
            appendString(hash, key ?? value.description ?? "");
            break;
        }
        case "function":
            appendString(hash, Function.prototype.toString.call(value));
            break;
    }
    return hash.digest();
};
const cachePrimitive = (value: Primitive): bigint => {
    const cached = primitive.get(value);
    if (cached !== undefined) {
        return cached;
    }
    const result = scalarHash(value);
    if (primitive.size >= PRIMITIVE_CACHE_LIMIT) {
        primitive.clear();
    }
    primitive.set(value, result);
    return result;
};
for (const type of types) {
    if (type !== "object" && type !== "function") {
        register(type, cachePrimitive);
    }
}
register("function", (value: Function): bigint => {
    const cached = complex.get(value);
    if (cached !== undefined) {
        return cached;
    }
    const result = scalarHash(value);
    complex.set(value, result);
    return result;
});
register("object", (value: object): bigint => {
    const cached = complex.get(value);
    if (cached !== undefined) {
        return cached;
    }
    const hash = new XXHash64().updateByte(Number(maskOf("object")));
    const seen = new WeakMap<object, bigint>();
    let nextReference = 0n;
    const append = (target: unknown): void => {
        if (target === null || typeof target !== "object") {
            hash.updateByte(0).updateWord(useHash(target));
            return;
        }
        const reference = seen.get(target);
        if (reference !== undefined) {
            hash.updateByte(1).updateWord(reference);
            return;
        }
        seen.set(target, nextReference++);
        hash.updateByte(2);
        appendString(hash, Object.prototype.toString.call(target));
        if (target instanceof Date) {
            hash.updateWord(useHash(target.getTime()));
        } else if (target instanceof RegExp) {
            appendString(hash, target.source);
            appendString(hash, target.flags);
        } else if (target instanceof Map) {
            hash.updateWord(BigInt(target.size));
            for (const [key, item] of target) {
                append(key);
                append(item);
            }
        } else if (target instanceof Set) {
            hash.updateWord(BigInt(target.size));
            for (const item of target) {
                append(item);
            }
        } else if (target instanceof ArrayBuffer) {
            hash.updateWord(BigInt(target.byteLength)).update(new Uint8Array(target));
        } else if (ArrayBuffer.isView(target)) {
            hash.updateWord(BigInt(target.byteLength))
                .update(new Uint8Array(target.buffer, target.byteOffset, target.byteLength));
        }
        // Inspect properties rather than invoking arbitrary nested iteration protocols.
        const keys = Reflect.ownKeys(target);
        hash.updateWord(BigInt(keys.length));
        for (const key of keys) {
            hash.updateWord(useHash(key));
            append(Reflect.get(target, key));
        }
        hash.updateByte(3);
    };
    append(value);
    const result = hash.digest();
    complex.set(value, result);
    return result;
});

/**
 * The call signatures of the internal `useHash` function.
 *
 * The two forms differ only in how many arguments the caller supplies: a single
 * argument is hashed as that value, while any other count is hashed as the
 * argument array. Both forms return a bigint because this dispatcher never
 * consumes an async iterable; `src/structure/hash.ts` exports a wider overload
 * set under the same name for asynchronous sources.
 */
interface UseHash {
    /**
     * Hashes a single value through the handler for its runtime type.
     *
     * The value is passed to the handler selected by `typeOf(target)` and the
     * digest is returned unchanged; no array framing or extra type byte is added
     * at this level. When no handler is installed for the type the lookup falls
     * back to `0n` instead of throwing, a defensive branch that the built-in
     * registrations do not normally reach.
     *
     * @template T - the type of the value, inferred from the call site
     * @param target - the value to hash; its runtime type selects the handler
     * @returns the digest produced by the selected handler, or `0n` when the
     *          type has no handler
     */
    <T = unknown>(target: T): bigint;
    /**
     * Hashes several arguments as one array-shaped value.
     *
     * Rather than hashing each argument separately, the arguments are collected
     * into a fresh array and that array is hashed structurally, so `useHash(a,
     * b)` and `useHash([a, b])` produce the same digest. The implementation
     * branches on the argument count rather than on the selected overload, so a
     * lone argument still takes the scalar path above, and a call with no
     * arguments hashes the empty array.
     *
     * @param value - the arguments to hash together, in the given order
     * @returns the structural hash of the argument array
     */
    (...value: Array<unknown>): bigint;
}
/**
 * Hashes complete, type-framed values with XXH64. Multiple arguments hash as an array.
 * Object/function hashes are weakly memoized and remain stable after mutation.
 * Property order is significant; local symbols with equal descriptions may collide.
 * Results changed from the legacy algorithm and are not persistent identifiers.
 */
export let useHash: UseHash = <T = unknown>(...value: Array<T>): bigint => {
    const target: unknown = value.length === 1 ? value[0] : value;
    const handler = handlers.get(typeOf(target));
    return handler ? handler(target) : 0n;
};
