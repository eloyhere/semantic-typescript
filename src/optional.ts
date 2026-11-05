import { isFunction, isOptional } from "#semantic/guard";
import { IllegalStateError } from "#semantic/structure/error";
import { OptionalSymbol } from "#semantic/symbol";
import type { SynchronousSemantic } from "#semantic/synchronous/semantic";
import { invalidate, validate, type Consumer, type Functional, type MaybeInvalid, type Predicate, type Runnable, type Valid } from "#semantic/utility";
/**
 * The synchronous semantic operations used by {@link Optional.semantic}.
 *
 * They are injected lazily instead of imported directly. A static value import
 * of the factory would close the cycle
 * `collectable -> collectors -> optional -> factory -> semantic -> collectable`,
 * in which the statistics and window classes of `semantic.ts` extend collectable
 * classes that have not been initialised yet.
 */
export interface SynchronousSemanticFactory {
    /**
     * Creates a synchronous semantic that emits nothing.
     * @template E - The element type, never actually produced.
     * @returns An empty synchronous semantic.
     */
    useEmpty<E>(): SynchronousSemantic<E>;
    /**
     * Creates a synchronous semantic over the supplied values.
     * @template E - The element type.
     * @param values - The values to emit, one per argument.
     * @returns A synchronous semantic over the supplied values.
     */
    useOf<E>(...values: Array<E>): SynchronousSemantic<E>;
}
/** The factory bound by the semantic layer at module evaluation time. */
let synchronousSemanticFactory: SynchronousSemanticFactory | undefined;
/**
 * Binds the synchronous semantic factory used by {@link Optional.semantic}.
 *
 * The binding module is evaluated after this module, because it is downstream of
 * `optional.ts` in the import graph, so the factory is always available before a
 * caller can reach the method.
 *
 * @param factory - The synchronous semantic operations to use.
 */
export const bindSemanticFactory = (factory: SynchronousSemanticFactory): void => {
    synchronousSemanticFactory = factory;
};
/**
 * An immutable container whose value is present unless it is null or undefined.
 * Instances are created through the static factory methods; stored objects are not deep-frozen.
 * @template T - The contained value type.
 */
export class Optional<T> {
    /** The contained value, with null and undefined representing absence. */
    protected value: MaybeInvalid<T>;
    /** The immutable marker recognised by the optional type guard. */
    protected readonly Optional: Symbol = OptionalSymbol;
    /**
     * Stores a value and freezes the container.
     * @param value - The value to contain, or null or undefined for an empty container.
     */
    protected constructor(value?: MaybeInvalid<T>) {
        this.value = value;
        Object.defineProperties(this, {
            "Optional": {
                value: OptionalSymbol,
                writable: false,
                enumerable: false,
                configurable: false
            },
            "value": {
                value: value,
                writable: false,
                enumerable: false,
                configurable: false
            }
        });
        Object.freeze(this);
    }
    /**
     * Retains a present value only when the predicate accepts it.
     * @param predicate - The condition evaluated for a present value; a non-function produces an empty result.
     * @returns A new container holding the accepted value, or an empty container.
     */
    public filter(predicate: Predicate<T>): Optional<T> {
        if (this.isPresent() && isFunction(predicate) && predicate(this.value as T)) {
            return new Optional<T>(this.value as T);
        }
        return new Optional<T>((void 0));
    }
    /**
     * Retrieves the present value.
     * @returns The contained value with null and undefined excluded.
     * @throws {TypeError} If the container is empty.
     */
    public get(): Valid<T>;
    /**
     * Retrieves the present value or uses a non-null, defined default.
     * @param defaultValue - The fallback used when this container is empty.
     * @returns The contained value or the valid default.
     * @throws {TypeError} If both the container and the default are absent.
     */
    public get(defaultValue: T): Valid<T>;
    public get(defaultValue?: T): Valid<T> {
        if (this.isPresent()) {
            return this.value as Valid<T>;
        }
        else {
            if (validate(defaultValue)) {
                return defaultValue as Valid<T>;
            }
            else {
                throw new TypeError("Optional is empty.");
            }
        }
    }
    /**
     * Invokes an action with the contained value when present.
     * @param action - The action to invoke; a non-function is ignored.
     */
    public ifPresent(action: Consumer<T>): void;
    /**
     * Invokes an action for a present value, otherwise invokes a fallback action.
     * @param action - The action receiving the value when present and callable.
     * @param elseAction - The fallback invoked when the value is absent or action is not callable.
     */
    public ifPresent(action: Consumer<T>, elseAction: Runnable): void;
    public ifPresent(action: Consumer<T>, elseAction?: Runnable): void {
        if (this.isPresent() && isFunction(action)) {
            action(this.value as T);
        }
        else if (isFunction(elseAction)) {
            elseAction();
        }
    }
    /** @returns Whether the contained value is null or undefined. */
    public isEmpty(): boolean {
        return invalidate(this.value);
    }
    /** @returns Whether the contained value is neither null nor undefined. */
    public isPresent(): boolean {
        return validate(this.value);
    }
    /**
     * Maps a present value into a new container.
     * @template R - The mapped value type.
     * @param mapper - The transformation applied to a present value; a non-function produces an empty result.
     * @returns A container holding the result, or an empty container if absent or mapped to null or undefined.
     */
    public map<R>(mapper: Functional<T, R>): Optional<R> {
        if (this.isPresent() && isFunction(mapper)) {
            return new Optional<R>(mapper(this.value as T));
        }
        return new Optional<R>(null);
    }
    /**
     * Maps a present value directly to an optional of the same value type.
     * @param mapper - The optional-producing transformation; a non-function produces an empty result.
     * @returns The mapper's optional, or an empty container when this value is absent.
     * @throws {TypeError} If the invoked mapper does not return a value recognised by isOptional.
     */
    public flat(mapper: Functional<T, Optional<T>>): Optional<T> {
        if (this.isPresent() && isFunction(mapper)) {
            let result: Optional<T> = mapper(this.value as T);
            if (isOptional(result)) {
                return result;
            }
            throw new TypeError("Must return an Optional.");
        }
        return new Optional<T>(null);
    }
    /**
     * Maps a present value directly to an optional of another value type.
     * @template R - The mapped value type.
     * @param mapper - The optional-producing transformation; a non-function produces an empty result.
     * @returns The mapper's optional, or an empty container when this value is absent.
     * @throws {TypeError} If the invoked mapper does not return a value recognised by isOptional.
     */
    public flatMap<R>(mapper: Functional<T, Optional<R>>): Optional<R> {
        if (this.isPresent() && isFunction(mapper)) {
            let result: Optional<R> = mapper(this.value as T);
            if (isOptional(result)) {
                return result;
            }
            throw new TypeError("Must return an Optional.");
        }
        return new Optional<R>(null);
    }
    /**
     * Retrieves the contained value or an unrestricted fallback.
     * @param other - The value returned when this container is empty, including null or undefined.
     * @returns The present value, or other when absent.
     */
    public orElse(other: MaybeInvalid<T>): MaybeInvalid<T> {
        if (this.isPresent()) {
            return this.value as T;
        }
        return other;
    }
    /**
     * Exposes the contained value as a synchronous semantic sequence.
     * @returns A sequence containing the present value, or an empty sequence.
     * @throws {IllegalStateError} If the semantic factory has not been bound yet,
     *         which indicates that this module was loaded without the semantic layer.
     */
    public semantic(): SynchronousSemantic<T> {
        if (synchronousSemanticFactory === undefined) {
            throw new IllegalStateError("Optional.semantic() requires the synchronous semantic factory to be bound before use.");
        }
        if (this.isPresent()) {
            return synchronousSemanticFactory.useOf(this.value as T);
        }
        return synchronousSemanticFactory.useEmpty();
    }
    /**
     * Creates an empty container.
     * @template T - The value type expected by subsequent operations.
     * @returns A new empty optional.
     */
    public static empty<T>() {
        return new Optional<T>(null);
    }
    /**
     * Creates a container, accepting null and undefined as empty values.
     * @template T - The contained value type.
     * @param value - The value to wrap.
     * @returns A new optional with the same absence rules as ofNullable.
     */
    public static of<T>(value: MaybeInvalid<T>) {
        return Optional.ofNullable<T>(value);
    }
    /**
     * Creates a container that is empty for null, undefined or an omitted value.
     * @template T - The contained value type.
     * @param value - The value to wrap; defaults to undefined.
     * @returns A new optional containing the supplied value when present.
     */
    public static ofNullable<T>(value: MaybeInvalid<T> = (void 0)) {
        return new Optional<T>(value);
    }
    /**
     * Creates a container from a value that must be present.
     * @template T - The contained value type.
     * @param value - A value other than null or undefined.
     * @returns A new optional containing the value.
     * @throws {TypeError} If value is null or undefined.
     */
    public static ofNonNull<T>(value: T) {
        if (validate(value)) {
            return new Optional<T>(value);
        }
        throw new TypeError("Value is not valid");
    }
}
;
Object.freeze(Optional);
Object.freeze(Optional.prototype);
Object.freeze(Object.getPrototypeOf(Optional));
