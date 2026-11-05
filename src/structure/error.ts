/**
 * Options accepted by every semantic error constructor.
 *
 * The interface extends the native `ErrorOptions` so that the standard
 * `cause` channel remains available alongside the library-specific diagnostic
 * `context`.
 */
export interface SemanticErrorOptions extends ErrorOptions {
    /**
     * Diagnostic details that locate the failure, such as the method name, the
     * offending index, the argument name, or the rejected option combination.
     */
    context?: Record<string, unknown>;
}

/**
 * Base class for every error raised by the semantic structure library.
 *
 * Each concrete subclass records its own class name in `name`, forwards the
 * optional native `cause` channel, and can carry a diagnostic `context`.
 * Catching `SemanticError` therefore captures the whole hierarchy, while the
 * type guards exported at the end of this module distinguish its branches.
 */
export class SemanticError extends Error {
    /** Diagnostic details supplied at construction time, if any. */
    readonly context?: Record<string, unknown>;

    /**
     * Creates a semantic error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "SemanticError";
        this.context = options?.context;
    }

    /**
     * Converts this error into a JSON-safe object without losing its type name,
     * diagnostic context, or cause chain.
     * @returns A plain object suitable for `JSON.stringify`.
     */
    toJSON(): Record<string, unknown> {
        const serialized: Record<string, unknown> = {
            name: this.name,
            message: this.message,
        };
        if (this.context !== undefined) {
            serialized.context = this.context;
        }
        if (this.cause !== undefined) {
            if (this.cause instanceof SemanticError) {
                serialized.cause = this.cause.toJSON();
            } else if (this.cause instanceof Error) {
                serialized.cause = {
                    name: this.cause.name,
                    message: this.cause.message,
                };
            } else {
                serialized.cause = this.cause;
            }
        }
        return serialized;
    }
}

/**
 * Indicates that a requested operation is unsupported for this structure.
 */
export class IllegalOperationError extends SemanticError {
    /**
     * Creates an unsupported-operation error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "IllegalOperationError";
    }
}

/**
 * Indicates that an argument has an invalid type or an invalid value.
 *
 * This is the common base of positional errors, range errors, and
 * configuration errors, so catching `ValidationError` covers every rejected
 * input.
 */
export class ValidationError extends SemanticError {
    /**
     * Creates a validation error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "ValidationError";
    }
}

/**
 * Indicates that an index is negative, out of bounds, or otherwise not a legal
 * position, as opposed to a merely out-of-range numeric value.
 */
export class IndexError extends ValidationError {
    /**
     * Creates an index or position error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "IndexError";
    }
}

/**
 * Indicates that an argument lies outside the structure's permitted range.
 *
 * The class intentionally shares its name with the global `RangeError` while
 * remaining a library error; no library module imports it implicitly, so bare
 * `new RangeError(...)` expressions continue to resolve to the global
 * constructor.
 */
export class RangeError extends ValidationError {
    /**
     * Creates a range error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "RangeError";
    }
}

/**
 * The same class under a name that cannot shadow the global constructor.
 *
 * {@link RangeError} keeps its historical name, but a consumer that writes
 * `import { RangeError }` shadows the global for that whole module, which turns
 * an incidental `new RangeError(...)` in the same file into a library error.
 * Importing `SemanticRangeError` instead leaves the global untouched. The two
 * names denote one class, so `instanceof` checks work across both.
 */
export { RangeError as SemanticRangeError };

/**
 * Indicates that a combination of options is internally inconsistent.
 */
export class ConfigurationError extends ValidationError {
    /**
     * Creates a configuration error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "ConfigurationError";
    }
}

/**
 * Indicates that a capacity or resource limit has been exhausted.
 */
export class CapacityError extends SemanticError {
    /**
     * Creates a capacity or resource error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "CapacityError";
    }
}

/**
 * Indicates that an operation was invoked in an incompatible lifecycle state.
 *
 * This is the common base of state-machine failures, including
 * `IllegalStateError`.
 */
export class StateError extends SemanticError {
    /**
     * Creates a state error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "StateError";
    }
}

/**
 * Indicates that the structure's current state prevents an operation.
 */
export class IllegalStateError extends StateError {
    /**
     * Creates an illegal-state error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "IllegalStateError";
    }
}

/**
 * Indicates that concurrent or asynchronous operations violated their expected
 * ordering, such as a queue delivering results out of order or a promise being
 * settled twice.
 */
export class ConcurrencyError extends SemanticError {
    /**
     * Creates a concurrency or temporal-order error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "ConcurrencyError";
    }
}

/**
 * Indicates that a collection protocol was violated, such as an inconsistent
 * comparator, a duplicate key, or an element that cannot be hashed.
 */
export class CollectionError extends SemanticError {
    /**
     * Creates a collection-protocol error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "CollectionError";
    }
}

/**
 * Indicates that a value could not be serialized or restored, such as a
 * circular JSON structure or data that cannot be reconstructed.
 */
export class SerializationError extends SemanticError {
    /**
     * Creates a serialization error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "SerializationError";
    }
}

/**
 * Indicates that a numeric computation cannot produce a valid result, such as
 * an overflow, a division by zero, a non-finite value, or lost precision.
 *
 * This is the common base of arithmetic failures, including
 * `ArithmeticError`.
 */
export class NumericError extends SemanticError {
    /**
     * Creates a numeric error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "NumericError";
    }
}

/**
 * Indicates that an arithmetic operation cannot produce a valid result.
 */
export class ArithmeticError extends NumericError {
    /**
     * Creates an arithmetic error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "ArithmeticError";
    }
}

/**
 * Indicates that a phase, frequency, or angle lies outside its mathematical
 * domain, such as an invalid phase ring or a frequency without a real result.
 */
export class PhaseError extends SemanticError {
    /**
     * Creates a phase or periodic-domain error.
     * @param message - Human-readable description of the failure.
     * @param options - Native error options plus an optional diagnostic context.
     */
    constructor(message?: string, options?: SemanticErrorOptions) {
        super(message, options);
        this.name = "PhaseError";
    }
}

/**
 * Tests whether a value is a {@link SemanticError}.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from `SemanticError`.
 */
export let isSemanticError: (target: unknown) => target is SemanticError = (target: unknown): target is SemanticError => {
    return target instanceof SemanticError;
};

/**
 * Tests whether a value is an {@link IllegalOperationError}.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from `IllegalOperationError`.
 */
export let isIllegalOperationError: (target: unknown) => target is IllegalOperationError = (target: unknown): target is IllegalOperationError => {
    return target instanceof IllegalOperationError;
};

/**
 * Tests whether a value is a {@link ValidationError}.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from `ValidationError`.
 */
export let isValidationError: (target: unknown) => target is ValidationError = (target: unknown): target is ValidationError => {
    return target instanceof ValidationError;
};

/**
 * Tests whether a value is an {@link IndexError}.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from `IndexError`.
 */
export let isIndexError: (target: unknown) => target is IndexError = (target: unknown): target is IndexError => {
    return target instanceof IndexError;
};

/**
 * Tests whether a value is the semantic {@link RangeError}, not the global
 * constructor of the same name.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from the semantic `RangeError`.
 */
export let isRangeError: (target: unknown) => target is RangeError = (target: unknown): target is RangeError => {
    return target instanceof RangeError;
};

/**
 * Tests whether a value is a {@link ConfigurationError}.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from `ConfigurationError`.
 */
export let isConfigurationError: (target: unknown) => target is ConfigurationError = (target: unknown): target is ConfigurationError => {
    return target instanceof ConfigurationError;
};

/**
 * Tests whether a value is a {@link CapacityError}.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from `CapacityError`.
 */
export let isCapacityError: (target: unknown) => target is CapacityError = (target: unknown): target is CapacityError => {
    return target instanceof CapacityError;
};

/**
 * Tests whether a value is a {@link StateError}.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from `StateError`.
 */
export let isStateError: (target: unknown) => target is StateError = (target: unknown): target is StateError => {
    return target instanceof StateError;
};

/**
 * Tests whether a value is an {@link IllegalStateError}.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from `IllegalStateError`.
 */
export let isIllegalStateError: (target: unknown) => target is IllegalStateError = (target: unknown): target is IllegalStateError => {
    return target instanceof IllegalStateError;
};

/**
 * Tests whether a value is a {@link ConcurrencyError}.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from `ConcurrencyError`.
 */
export let isConcurrencyError: (target: unknown) => target is ConcurrencyError = (target: unknown): target is ConcurrencyError => {
    return target instanceof ConcurrencyError;
};

/**
 * Tests whether a value is a {@link CollectionError}.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from `CollectionError`.
 */
export let isCollectionError: (target: unknown) => target is CollectionError = (target: unknown): target is CollectionError => {
    return target instanceof CollectionError;
};

/**
 * Tests whether a value is a {@link SerializationError}.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from `SerializationError`.
 */
export let isSerializationError: (target: unknown) => target is SerializationError = (target: unknown): target is SerializationError => {
    return target instanceof SerializationError;
};

/**
 * Tests whether a value is a {@link NumericError}.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from `NumericError`.
 */
export let isNumericError: (target: unknown) => target is NumericError = (target: unknown): target is NumericError => {
    return target instanceof NumericError;
};

/**
 * Tests whether a value is an {@link ArithmeticError}.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from `ArithmeticError`.
 */
export let isArithmeticError: (target: unknown) => target is ArithmeticError = (target: unknown): target is ArithmeticError => {
    return target instanceof ArithmeticError;
};

/**
 * Tests whether a value is a {@link PhaseError}.
 * @param target - The value to inspect.
 * @returns Whether the value inherits from `PhaseError`.
 */
export let isPhaseError: (target: unknown) => target is PhaseError = (target: unknown): target is PhaseError => {
    return target instanceof PhaseError;
};
