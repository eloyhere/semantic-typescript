import { useEmpty, useOf } from "./factory.js";
import { isFunction, isOptional } from "./guard.js";
import { OptionalSymbol } from "./symbol.js";
import type { SynchronousSemantic } from "./synchronous/semantic.js";
import { invalidate, validate, type Consumer, type Functional, type MaybeInvalid, type Predicate, type Runnable, type Valid } from "./utility.js";
export class Optional<T> {
    protected value: MaybeInvalid<T>;
    protected readonly Optional: Symbol = OptionalSymbol;
    protected constructor(value: MaybeInvalid<T>) {
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
    public filter(predicate: Predicate<T>): Optional<T> {
        if (this.isPresent() && isFunction(predicate) && predicate(this.value as T)) {
            return new Optional<T>(this.value as T);
        }
        return new Optional<T>((void 0));
    }
    public get(): Valid<T>;
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
    public ifPresent(action: Consumer<T>): void;
    public ifPresent(action: Consumer<T>, elseAction: Runnable): void;
    public ifPresent(action: Consumer<T>, elseAction?: Runnable): void {
        if (this.isPresent() && isFunction(action)) {
            action(this.value as T);
        }
        else if (isFunction(elseAction)) {
            elseAction();
        }
    }
    public isEmpty(): boolean {
        return invalidate(this.value);
    }
    public isPresent(): boolean {
        return validate(this.value);
    }
    public map<R>(mapper: Functional<T, R>): Optional<R> {
        if (this.isPresent() && isFunction(mapper)) {
            return new Optional<R>(mapper(this.value as T));
        }
        return new Optional<R>(null);
    }
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
    public orElse(other: MaybeInvalid<T>): MaybeInvalid<T> {
        if (this.isPresent()) {
            return this.value as T;
        }
        return other;
    }
    public semantic(): SynchronousSemantic<T> {
        if (this.isPresent()) {
            return useOf(this.value as T);
        }
        return useEmpty();
    }
    public static empty<T>() {
        return new Optional<T>(null);
    }
    public static of<T>(value: MaybeInvalid<T>) {
        return Optional.ofNullable<T>(value);
    }
    public static ofNullable<T>(value: MaybeInvalid<T> = (void 0)) {
        return new Optional<T>(value);
    }
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
