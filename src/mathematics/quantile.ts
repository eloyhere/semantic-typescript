/**
 * Estimator selectors and closed-form helpers shared by the synchronous and
 * asynchronous statistics views.
 *
 * The selectors are string-literal unions rather than enums because the build
 * enables `erasableSyntaxOnly`. The defaults are deliberately the definitions
 * used by R, NumPy, pandas and Excel, so a value computed here can be compared
 * with those tools without a correction factor:
 *
 * - quantiles default to the Hyndman–Fan type 7 (R `quantile`, NumPy `linear`,
 *   Excel `PERCENTILE.INC`);
 * - skewness defaults to `G1` (Excel `SKEW`, pandas `skew`);
 * - kurtosis defaults to the excess `G2` (Excel `KURT`, pandas `kurt`);
 * - variance and standard deviation divide by `n - 1` (R `var`/`sd`, pandas,
 *   NumPy with `ddof=1`).
 *
 * The previous definitions remain available through the options documented on
 * each interface.
 */

/**
 * The nine Hyndman–Fan sample-quantile types, named after R's `type` argument.
 *
 * `"type-1"` is the inverse empirical distribution function (a step function);
 * `"type-7"` is the R / NumPy / Excel default (linear interpolation at
 * `(n - 1)p + 1`).
 */
export type QuantileMethod =
    | "type-1" | "type-2" | "type-3" | "type-4" | "type-5"
    | "type-6" | "type-7" | "type-8" | "type-9";

/**
 * The supported sample-skewness estimators.
 *
 * - `"G1"` — the bias-corrected Fisher–Pearson coefficient, default.
 * - `"g1"` — the biased moment ratio `m3 / m2^(3 / 2)`, the previous default.
 */
export type SkewnessEstimator = "g1" | "G1";

/**
 * The supported sample-kurtosis estimators.
 *
 * - `"G2"` — the bias-corrected excess estimator, default.
 * - `"g2"` — the biased excess moment ratio `m4 / m2^2 - 3`, the previous
 *   default.
 */
export type KurtosisEstimator = "g2" | "G2";

/** Options for `quantile` and `interquartileRange`. */
export interface QuantileOptions {
    /** The Hyndman–Fan type; defaults to `"type-7"`. */
    readonly method?: QuantileMethod;
}

/** Options for `skewness`. */
export interface SkewnessOptions {
    /** The estimator; defaults to `"G1"`. */
    readonly estimator?: SkewnessEstimator;
}

/** Options for `kurtosis`. */
export interface KurtosisOptions {
    /** The estimator; defaults to `"G2"`. */
    readonly estimator?: KurtosisEstimator;
    /** Whether to subtract three (excess kurtosis); defaults to `true`. */
    readonly excess?: boolean;
}

/** Options for `variance` and `standardDeviation`. */
export interface VarianceOptions {
    /** The denominator is `n - ddof`; defaults to `1` (Bessel's correction). */
    readonly ddof?: 0 | 1;
}

const QUANTILE_METHODS: ReadonlyArray<string> = Object.freeze([
    "type-1", "type-2", "type-3", "type-4", "type-5",
    "type-6", "type-7", "type-8", "type-9",
] as const);

const SKEWNESS_ESTIMATORS: ReadonlyArray<string> = Object.freeze(["g1", "G1"] as const);

const KURTOSIS_ESTIMATORS: ReadonlyArray<string> = Object.freeze(["g2", "G2"] as const);

/**
 * Reports whether a value names one of the nine Hyndman–Fan quantile types.
 *
 * @param value - The value to test.
 * @returns Whether the value is a supported quantile method.
 */
export function isQuantileMethod(value: unknown): value is QuantileMethod {
    return typeof value === "string" && QUANTILE_METHODS.includes(value);
}

/**
 * Reports whether a value names a supported skewness estimator.
 *
 * @param value - The value to test.
 * @returns Whether the value is a supported skewness estimator.
 */
export function isSkewnessEstimator(value: unknown): value is SkewnessEstimator {
    return typeof value === "string" && SKEWNESS_ESTIMATORS.includes(value);
}

/**
 * Reports whether a value names a supported kurtosis estimator.
 *
 * @param value - The value to test.
 * @returns Whether the value is a supported kurtosis estimator.
 */
export function isKurtosisEstimator(value: unknown): value is KurtosisEstimator {
    return typeof value === "string" && KURTOSIS_ESTIMATORS.includes(value);
}

/**
 * Reports whether a value is a supported variance degrees-of-freedom setting.
 *
 * @param value - The value to test.
 * @returns Whether the value is the population (`0`) or sample (`1`) setting.
 */
export function isVarianceDdof(value: unknown): value is 0 | 1 {
    return value === 0 || value === 1;
}

/**
 * Selects a quantile from ascending order statistics with the Hyndman–Fan
 * parameterisation shared by R's `quantile` and NumPy's `quantile`.
 *
 * The unified definition is `Q_i(p) = (1 - γ) x_j + γ x_(j + 1)` with
 * `j = floor(n p + m)`, `g = n p + m - j` and `γ` fixed by the type. Types 1–3
 * are step functions, types 4–9 interpolate linearly.
 *
 * @param values - The ascending order statistics; must not be empty.
 * @param probability - The probability from zero to one, inclusive.
 * @param method - One of the nine Hyndman–Fan types.
 * @returns The selected quantile.
 * @throws {RangeError} If `values` is empty.
 */
export function quantileOfSorted(values: ReadonlyArray<number>, probability: number, method: QuantileMethod): number {
    const count: number = values.length;
    if (count === 0) {
        throw new RangeError("Empty order statistics.");
    }
    let m: number;
    switch (method) {
        case "type-1":
        case "type-2":
        case "type-4":
            m = 0;
            break;
        case "type-3":
            m = -0.5;
            break;
        case "type-5":
            m = 0.5;
            break;
        case "type-6":
            m = probability;
            break;
        case "type-7":
            m = 1 - probability;
            break;
        case "type-8":
            m = (probability + 1) / 3;
            break;
        default:
            m = probability / 4 + 3 / 8;
            break;
    }
    const h: number = count * probability + m;
    if (h < 1) {
        return values[0];
    }
    if (h >= count) {
        return values[count - 1];
    }
    const j: number = Math.floor(h);
    const g: number = h - j;
    switch (method) {
        case "type-1":
            return g === 0 ? values[j - 1] : values[j];
        case "type-2":
            return g === 0 ? (values[j - 1] + values[j]) / 2 : values[j];
        case "type-3":
            return g === 0 && j % 2 === 0 ? values[j - 1] : values[j];
        default:
            return (1 - g) * values[j - 1] + g * values[j];
    }
}
