import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
    SynchronousDistributionCollectable,
    DensityEstimate,
    EmpiricalDistribution,
    Histogram,
    HistogramBin,
    MomentSummary,
    RobustSummary
} from "../dist/synchronous/distribution.js";
import { AsynchronousDistributionCollectable } from "../dist/asynchronous/distribution.js";
import {
    useSynchronousDensity,
    useSynchronousEmpiricalDistribution,
    useSynchronousEntropy,
    useSynchronousHistogram,
    useSynchronousKurtosis,
    useSynchronousMedianAbsoluteDeviation,
    useSynchronousMoments,
    useSynchronousQuantile,
    useSynchronousRobust,
    useSynchronousSkewness
} from "../dist/synchronous/collectors.js";
import { useAsynchronousQuantile } from "../dist/asynchronous/collectors.js";

const closeTo = (actual, expected, epsilon = 1e-12, label = "") => {
    assert.ok(
        Math.abs(actual - expected) <= epsilon,
        `${label}${actual} is not within ${epsilon} of ${expected}`
    );
};

const present = (optional, label = "") => {
    assert.equal(optional.isPresent(), true, `expected a present optional ${label}`);
    return optional.get();
};

const absent = (optional, label = "") => {
    assert.equal(optional.isEmpty(), true, `expected an empty optional ${label}`);
};

const distribution = (...values) => new SynchronousDistributionCollectable(values);

const closeDensity = (left, right, epsilon = 1e-9) => {
    const expected = right.getDensities();
    const actual = left.getDensities();
    assert.equal(actual.length, expected.length);
    for (let index = 0; index < actual.length; index++) {
        closeTo(actual[index], expected[index], epsilon, `density[${index}]: `);
    }
};

const RULES = ["sturges", "scott", "freedman-diaconis", "sqrt", "rice", "doane", "terrell-scott"];

const RULE_BIN_COUNTS = {
    "sturges": 5,
    "scott": 2,
    "freedman-diaconis": 3,
    "sqrt": 3,
    "rice": 5,
    "doane": 5,
    "terrell-scott": 3
};

const QUANTILE_VALUES = [2, 4, 4, 4, 5, 5, 7, 9];

const QUANTILE_TABLE = {
    "type-1": [2, 4, 4, 5, 9],
    "type-2": [2, 4, 4.5, 6, 9],
    "type-3": [2, 4, 4, 5, 7],
    "type-4": [2, 4, 4, 5, 7.4],
    "type-5": [2.6, 4, 4.5, 6, 8.4],
    "type-6": [2, 4, 4.5, 6.5, 9],
    "type-7": [3.4, 4, 4.5, 5.5, 7.6],
    "type-8": [2 + 1 / 3, 4, 4.5, 6 + 1 / 6, 8 + 2 / 3],
    "type-9": [2.4, 4, 4.5, 6.125, 8.6]
};

const QUANTILE_PROBABILITIES = [0.1, 0.25, 0.5, 0.75, 0.9];

// The kurtosis example from the research document: n = 20, one extreme value.
const SHAPE_VALUES = [0, 3, 4, 1, 2, 3, 0, 2, 1, 3, 2, 0, 2, 2, 3, 2, 5, 2, 3, 999];

describe("histogram binning", () => {
    test("every rule derives its documented bin count and all counts sum to n", () => {
        const sample = distribution(1, 2, 2, 3, 3, 3, 4, 4, 5);
        for (const rule of RULES) {
            const histogram = sample.histogram({ binning: rule });
            const counts = histogram.getCounts();
            assert.equal(counts.length, RULE_BIN_COUNTS[rule], `${rule} bin count`);
            let total = 0n;
            for (const count of counts) {
                total += count;
            }
            assert.equal(total, 9n, `${rule} sum of counts`);
            assert.equal(histogram.getTotal(), 9n, `${rule} total`);
            assert.equal(histogram.getOmitted(), 0n, `${rule} omitted`);
            assert.equal(histogram.getSampleCount(), 9n, `${rule} sample count`);
            assert.equal(histogram.getRule(), rule);
        }
    });

    test("bins are left-closed and only the terminal bin closes on the right", () => {
        const histogram = distribution(0, 1, 2).histogram({ binning: [0, 1, 2] });
        assert.deepEqual(histogram.getCounts().map(String), ["1", "2"]);
        assert.equal(histogram.getTotal(), 3n);
        const bins = histogram.getBins();
        assert.equal(bins[0].contains(0), true);
        assert.equal(bins[0].contains(1), false);
        assert.equal(bins[1].contains(1), true);
        assert.equal(bins[1].contains(2), true);
        assert.equal(bins[1].isTerminal(), true);
        assert.equal(bins[0].isTerminal(), false);
        assert.equal(histogram.getBinWidth(), 1);
        assert.equal(bins[0].getClosure(), "left");
    });

    test("a right-closed convention moves the interior boundary to the left bin", () => {
        const right = distribution(0, 1, 2).histogram({ binning: [0, 1, 2], closed: "right" });
        assert.deepEqual(right.getCounts().map(String), ["2", "1"]);
        assert.equal(right.getBins()[0].contains(1), true);
        assert.equal(right.getBins()[0].isTerminal(), true);
        assert.equal(right.getBins()[1].contains(1), false);
        assert.equal(right.getBins()[1].contains(2), true);
        assert.equal(right.getClosure(), "right");
        const internal = distribution(0, 0.5, 1).histogram({ binning: [0, 0.5, 1] });
        assert.deepEqual(internal.getCounts().map(String), ["1", "2"]);
    });

    test("explicit edges report omitted observations and keep empty bins", () => {
        const histogram = distribution(-1, 0, 0.5, 2, 3).histogram({ binning: [0, 1, 2] });
        assert.deepEqual(histogram.getCounts().map(String), ["2", "1"]);
        assert.equal(histogram.getTotal(), 3n);
        assert.equal(histogram.getOmitted(), 2n);
        assert.equal(histogram.getSampleCount(), 5n);
        assert.equal(histogram.getRule(), "manual");
        const emptyBin = distribution(0, 0).histogram({ binning: [0, 1, 2] });
        assert.deepEqual(emptyBin.getCounts().map(String), ["2", "0"]);
    });

    test("density is count / (n * width) and integrates to one", () => {
        const histogram = distribution(1, 2, 2, 3, 3, 3, 4, 4, 5).histogram({ binning: "sturges" });
        const width = histogram.getBinWidth();
        const densities = histogram.getDensities();
        const counts = histogram.getCounts();
        let mass = 0;
        for (let index = 0; index < densities.length; index++) {
            closeTo(densities[index], Number(counts[index]) / (9 * width), 1e-12, `bin ${index}: `);
            mass += densities[index] * width;
        }
        closeTo(mass, 1, 1e-12, "density mass: ");
    });

    test("a constant sample becomes one unit-width bin", () => {
        const histogram = distribution(5, 5, 5).histogram();
        assert.equal(histogram.getBins().length, 1);
        assert.equal(histogram.getBins()[0].getLower(), 4.5);
        assert.equal(histogram.getBins()[0].getUpper(), 5.5);
        assert.deepEqual(histogram.getCounts().map(String), ["3"]);
        assert.equal(histogram.getBinWidth(), 1);
    });

    test("bin edges stay representable for extreme magnitudes", () => {
        const huge = distribution(1e16, 1e16, 1e16 + 2).histogram({ binning: "sturges" });
        assert.equal(huge.getTotal(), 3n);
        assert.equal(huge.getBins().length, 1);
        const constant = distribution(1e308, 1e308).histogram();
        assert.equal(constant.getBins().length, 1);
        assert.deepEqual(constant.getCounts().map(String), ["2"]);
        assert.ok(constant.getBinWidth() > 0);
    });

    test("an empty sample yields a histogram without bins", () => {
        const histogram = distribution().histogram();
        assert.equal(histogram.getBins().length, 0);
        assert.equal(histogram.getTotal(), 0n);
        assert.equal(histogram.getSampleCount(), 0n);
        assert.equal(histogram.getEntropy(), 0);
        const manual = distribution().histogram({ binning: [0, 1, 2] });
        assert.equal(manual.getBins().length, 2);
        assert.deepEqual(manual.getCounts().map(String), ["0", "0"]);
    });

    test("invalid edges, heterogeneous widths and the bin cap fail loudly", () => {
        assert.throws(() => distribution(1).histogram({ binning: [1] }), RangeError);
        assert.throws(() => distribution(1).histogram({ binning: [0, 0, 1] }), RangeError);
        assert.throws(() => distribution(1).histogram({ binning: [0, 1, Number.NaN] }), TypeError);
        assert.throws(() => distribution(1).histogram({ binning: [0, 1, 2], maximumBins: 1n }), RangeError);
        assert.throws(() => distribution(1, 2, 3, 4, 5).histogram({ binning: "sturges", maximumBins: 3n }), RangeError);
        const heterogeneous = distribution(1, 2).histogram({ binning: [0, 1, 3] });
        assert.throws(() => heterogeneous.getBinWidth(), RangeError);
        assert.throws(() => distribution(0, 0, 0, 0, 1).histogram({ binning: "freedman-diaconis" }), RangeError);
    });

    test("histogram entropy reports discrete and differential forms", () => {
        const histogram = distribution(0, 0, 1, 1).histogram({ binning: [0, 0.5, 1] });
        closeTo(histogram.getEntropy(), Math.LN2, 1e-12);
        closeTo(histogram.getEntropy({ base: 2 }), 1, 1e-12);
        closeTo(histogram.getEntropy({ base: 2, differential: true }), 0, 1e-12);
        assert.throws(() => histogram.getEntropy({ base: 1 }), RangeError);
        assert.throws(() => histogram.getEntropy({ base: -2 }), RangeError);
    });

    test("Histogram and HistogramBin are immutable value objects", () => {
        const histogram = distribution(1, 2, 3).histogram({ binning: [0, 2, 4] });
        assert.equal(Object.isFrozen(histogram), true);
        assert.equal(Object.isFrozen(histogram.getBins()), true);
        assert.equal(Object.isFrozen(histogram.getBins()[0]), true);
        const bin = new HistogramBin(0, 1, 2n, 0.5);
        assert.equal(bin.getMidpoint(), 0.5);
        assert.equal(bin.contains(0), true);
        assert.equal(bin.contains(1), false);
        assert.equal(bin.equals(bin), true);
        assert.equal(String(bin).startsWith("HistogramBin([0, 1)"), true);
        assert.throws(() => new HistogramBin(1, 1, 0n, 0), RangeError);
        assert.throws(() => new HistogramBin(0, 1, -1n, 0), RangeError);
        assert.throws(() => Histogram.use({ rule: "nope", closed: "left", bins: [], width: null, total: 0n, omitted: 0n, sampleCount: 0n }), TypeError);
    });
});

describe("quantiles", () => {
    test("the nine Hyndman–Fan types reproduce the reference table", () => {
        const sample = distribution(...QUANTILE_VALUES);
        for (const [method, expected] of Object.entries(QUANTILE_TABLE)) {
            expected.forEach((value, index) => {
                const probability = QUANTILE_PROBABILITIES[index];
                closeTo(present(sample.quantile(probability, { method }), `${method} p=${probability}`), value, 1e-12, `${method} p=${probability}: `);
            });
        }
        closeTo(present(sample.quantile(0.75)), 5.5, 1e-12, "default type-7: ");
    });

    test("ties separate step types from interpolating types", () => {
        const sample = distribution(1, 1, 1, 1, 100);
        closeTo(present(sample.quantile(0.5, { method: "type-3" })), 1);
        closeTo(present(sample.quantile(0.9, { method: "type-3" })), 1);
        closeTo(present(sample.quantile(0.9, { method: "type-4" })), 50.5);
        closeTo(present(sample.quantile(0.9, { method: "type-7" })), 60.4, 1e-12);
        closeTo(present(sample.quantile(0.9, { method: "type-1" })), 100);
    });

    test("probabilities are validated instead of clipped", () => {
        const sample = distribution(1, 2, 3);
        assert.throws(() => sample.quantile(-0.1), RangeError);
        assert.throws(() => sample.quantile(1.1), RangeError);
        assert.throws(() => sample.quantile(Number.NaN), TypeError);
        assert.throws(() => sample.quantile(0.5, { method: "type-10" }), TypeError);
        assert.throws(() => distribution().empiricalDistribution().quantile(2), RangeError);
    });

    test("quantile is empty only for an empty sample", () => {
        absent(distribution().quantile(0.5));
        closeTo(present(distribution(42).quantile(0.5)), 42);
        const unfilled = distribution(1, 2, 3, 4);
        closeTo(present(unfilled.quantile(0)), 1);
        closeTo(present(unfilled.quantile(1)), 4);
    });
});

describe("moments and shape", () => {
    test("G1/G2 and g1/g2 differ by the documented factors", () => {
        const moments = distribution(...SHAPE_VALUES).moments();
        closeTo(present(moments.getSkewness("g1")), 4.129251496378207, 1e-9);
        closeTo(present(moments.getSkewness("G1")), 4.471885014799229, 1e-9);
        closeTo(present(moments.getKurtosis("g2")), 15.051426543784178, 1e-9);
        closeTo(present(moments.getKurtosis("G2")), 19.998428728659764, 1e-9);
        closeTo(present(moments.getKurtosis("g2", false)), 18.051426543784178, 1e-9);
        closeTo(present(moments.getSkewnessStandardError()), 0.5121033367077574, 1e-12);
        closeTo(present(moments.getKurtosisStandardError()), 0.992383612541845, 1e-12);
        const sample = distribution(...SHAPE_VALUES);
        closeTo(present(sample.skewness()), 4.471885014799229, 1e-9);
        closeTo(present(sample.skewness({ estimator: "g1" })), 4.129251496378207, 1e-9);
        closeTo(present(sample.kurtosis()), 19.998428728659764, 1e-9);
        closeTo(present(sample.kurtosis({ estimator: "g2" })), 15.051426543784178, 1e-9);
    });

    test("variance and standard deviation expose both denominators", () => {
        const moments = distribution(1, 2, 3, 4, 5).moments();
        assert.equal(moments.getVariance(0), 2);
        closeTo(moments.getVariance(1), 2.5, 1e-12);
        closeTo(moments.getStandardDeviation(0), Math.SQRT2, 1e-12);
        closeTo(moments.getStandardDeviation(1), Math.sqrt(2.5), 1e-12);
        closeTo(moments.getVariance(), 2.5, 1e-12);
        assert.throws(() => moments.getVariance(2), TypeError);
    });

    test("small samples report empty optionals instead of zero", () => {
        absent(distribution().skewness(), "empty skewness");
        absent(distribution().kurtosis(), "empty kurtosis");
        absent(distribution().medianAbsoluteDeviation(), "empty MAD");
        absent(distribution(1).skewness(), "n=1 skewness");
        absent(distribution(1).kurtosis(), "n=1 kurtosis");
        absent(distribution(1, 2).skewness(), "n=2 G1");
        absent(distribution(1, 2).kurtosis(), "n=2 G2");
        absent(distribution(1, 2, 3).kurtosis(), "n=3 G2");
        present(distribution(1, 2, 3).skewness(), "n=3 G1");
        closeTo(present(distribution(1, 2).skewness({ estimator: "g1" })), 0);
        closeTo(present(distribution(1, 2).kurtosis({ estimator: "g2" })), -2);
        absent(distribution(7, 7, 7).skewness(), "constant skewness");
        absent(distribution(7, 7, 7).kurtosis(), "constant kurtosis");
        absent(distribution(7, 7, 7).moments().getKurtosisStandardError(), "constant SE");
        closeTo(present(distribution(7).medianAbsoluteDeviation()), 0);
        assert.equal(distribution().moments().getMean(), 0);
        assert.equal(distribution().moments().getVariance(0), 0);
    });

    test("invalid estimators are rejected", () => {
        const moments = distribution(1, 2, 3, 4).moments();
        assert.throws(() => moments.getSkewness("nope"), TypeError);
        assert.throws(() => moments.getKurtosis("nope"), TypeError);
        assert.throws(() => distribution(1, 2, 3).skewness({ estimator: "nope" }), TypeError);
        assert.throws(() => distribution(1, 2, 3).kurtosis({ estimator: "nope" }), TypeError);
    });
});

describe("robust statistics", () => {
    test("median absolute deviation uses 1.4826 by default", () => {
        const sample = distribution(1, 2, 3, 4, 5, 6, 7, 8, 9);
        closeTo(present(sample.medianAbsoluteDeviation()), 2.9652, 1e-12);
        closeTo(present(sample.medianAbsoluteDeviation(1)), 2, 1e-12);
        assert.throws(() => sample.medianAbsoluteDeviation(0), RangeError);
        assert.throws(() => sample.medianAbsoluteDeviation(-1), RangeError);
        const summary = sample.robust();
        closeTo(present(summary.getMedian()), 5);
        closeTo(present(summary.getMedianAbsoluteDeviation()), 2.9652, 1e-12);
        closeTo(present(summary.getMedianAbsoluteDeviation(1)), 2, 1e-12);
        closeTo(present(summary.getInterquartileRange()), 4);
        closeTo(present(summary.getLowerFence()), -3);
        closeTo(present(summary.getUpperFence()), 13);
        closeTo(present(summary.getUpperFence(3)), 19);
        assert.deepEqual(summary.getOutliers(), []);
        assert.equal(summary.getOutlierCount(), 0n);
    });

    test("one outlier moves the mean and standard deviation but not median, MAD or IQR", () => {
        const clean = distribution(1, 2, 3, 4, 5, 6, 7, 8, 9);
        const dirty = distribution(1, 2, 3, 4, 5, 6, 7, 8, 100);
        closeTo(dirty.moments().getMean(), 15.11111111111111, 1e-12);
        closeTo(dirty.moments().getStandardDeviation(1), 31.915687539376478, 1e-12);
        const cleanRobust = clean.robust();
        const dirtyRobust = dirty.robust();
        assert.equal(present(dirtyRobust.getMedian()), present(cleanRobust.getMedian()));
        closeTo(present(dirtyRobust.getMedianAbsoluteDeviation(1)), present(cleanRobust.getMedianAbsoluteDeviation(1)));
        closeTo(present(dirtyRobust.getInterquartileRange()), present(cleanRobust.getInterquartileRange()));
        assert.ok(3 * present(dirtyRobust.getMedianAbsoluteDeviation()) < 95);
        assert.deepEqual(dirtyRobust.getOutliers(), [100]);
        assert.equal(dirtyRobust.getOutlierCount(), 1n);
        assert.deepEqual(dirtyRobust.getOutliers(30), []);
        assert.equal(dirtyRobust.getOutlierCount(30), 0n);
        assert.throws(() => dirtyRobust.getOutliers(0), RangeError);
    });

    test("trimmed means support truncation and interpolation", () => {
        const symmetric = distribution(1, 2, 3, 4, 5, 6, 7, 8, 9);
        closeTo(present(symmetric.robust().getTrimmedMean()), 5);
        closeTo(present(symmetric.robust().getTrimmedMean({ trim: 0.2 })), 5);
        const skewed = [1, 2, 100, 101, 102, 103, 104, 105, 106, 107];
        const truncated = distribution(...skewed).robust({ trim: 0.15, trimPolicy: "truncate" });
        const interpolated = distribution(...skewed).robust({ trim: 0.15, trimPolicy: "interpolate" });
        closeTo(present(truncated.getTrimmedMean()), 90.375, 1e-12);
        closeTo(present(interpolated.getTrimmedMean()), 96.4375, 1e-12);
        closeTo(present(interpolated.getTrimmedMean({ trim: 0.2 })), 102.5, 1e-12);
        assert.throws(() => distribution(1, 2).robust({ trim: 0.5 }), RangeError);
        assert.throws(() => distribution(1, 2).robust({ trim: -0.1 }), RangeError);
        assert.throws(() => distribution(1, 2).robust({ fence: 0 }), RangeError);
        assert.throws(() => distribution(1, 2).robust({ trimPolicy: "nope" }), TypeError);
    });

    test("the robust summary is immutable and its values empty for an empty sample", () => {
        const summary = distribution(1, 2, 3).robust();
        assert.equal(Object.isFrozen(summary), true);
        assert.equal(summary.getCount(), 3n);
        const empty = distribution().robust();
        absent(empty.getMedian());
        absent(empty.getMedianAbsoluteDeviation());
        absent(empty.getInterquartileRange());
        absent(empty.getTrimmedMean());
        absent(empty.getLowerFence());
        absent(empty.getUpperFence());
        assert.equal(RobustSummary.use({ values: [1, 2, 3], median: 2, medianAbsoluteDeviation: 1, trim: 0.1, trimPolicy: "truncate", fence: 1.5 }).getCount(), 3n);
    });
});

describe("empirical distribution", () => {
    test("evaluate is right-continuous and leftLimit is the value from below", () => {
        const ecdf = distribution(1, 2, 2, 3).empiricalDistribution();
        assert.equal(ecdf.getStep(), 0.25);
        assert.equal(ecdf.getCount(), 4n);
        closeTo(ecdf.evaluate(0.5), 0);
        closeTo(ecdf.leftLimit(0.5), 0);
        closeTo(ecdf.evaluate(1), 0.25);
        closeTo(ecdf.leftLimit(1), 0);
        closeTo(ecdf.evaluate(1.5), 0.25);
        closeTo(ecdf.evaluate(2), 0.75);
        closeTo(ecdf.leftLimit(2), 0.25);
        closeTo(ecdf.evaluate(3), 1);
        closeTo(ecdf.leftLimit(3), 0.75);
        closeTo(ecdf.evaluate(100), 1);
        closeTo(ecdf.leftLimit(100), 1);
        closeTo(ecdf.evaluate(2) - ecdf.leftLimit(2), 0.5);
    });

    test("leftLimit is what makes the Kolmogorov–Smirnov statistic complete", () => {
        const ecdf = distribution(1, 2, 2, 3).empiricalDistribution();
        const values = ecdf.getOrderStatistics();
        let complete = 0;
        let usingOnlyEvaluate = 0;
        for (let index = 0; index < values.length; index++) {
            const right = ecdf.evaluate(values[index]);
            const below = ecdf.leftLimit(values[index]);
            complete = Math.max(complete, (index + 1) / values.length - right, right - index / values.length);
            usingOnlyEvaluate = Math.max(usingOnlyEvaluate, Math.abs(right - (index + 1) / values.length));
        }
        closeTo(complete, 0.5, 1e-12);
        closeTo(usingOnlyEvaluate, 0.25, 1e-12);
        assert.ok(complete > usingOnlyEvaluate);
        assert.ok(belowOfEdge(ecdf) > 0);
    });

    test("the ECDF quantile agrees with the distribution quantile for every type", () => {
        const sample = distribution(...QUANTILE_VALUES);
        const ecdf = sample.empiricalDistribution();
        for (const method of Object.keys(QUANTILE_TABLE)) {
            for (const probability of QUANTILE_PROBABILITIES) {
                closeTo(present(ecdf.quantile(probability, { method })), present(sample.quantile(probability, { method })), 1e-12, `${method} ${probability}: `);
            }
        }
    });

    test("an empty ECDF is a degenerate staircase and rejects unsorted input", () => {
        const empty = distribution().empiricalDistribution();
        assert.equal(empty.getStep(), 0);
        assert.equal(empty.evaluate(1), 0);
        assert.equal(empty.leftLimit(1), 0);
        absent(empty.getMinimum());
        absent(empty.getMaximum());
        absent(empty.quantile(0.5));
        assert.throws(() => new EmpiricalDistribution([2, 1]), RangeError);
        assert.throws(() => new EmpiricalDistribution([1, Number.POSITIVE_INFINITY]), TypeError);
        const copied = distribution(1, 2).empiricalDistribution();
        const copy = copied.toArray();
        copy.push(3);
        assert.equal(copied.getOrderStatistics().length, 2);
    });
});

describe("entropy and density", () => {
    test("entropy reuses one histogram for both binning and reporting", () => {
        const sample = distribution(0, 0, 1, 1);
        const histogram = sample.histogram({ binning: [0, 0.5, 1] });
        closeTo(sample.entropy({ binning: [0, 0.5, 1] }), Math.LN2, 1e-12);
        closeTo(sample.entropy({ histogram }), Math.LN2, 1e-12);
        closeTo(sample.entropy({ binning: [0, 0.5, 1], base: 2 }), 1, 1e-12);
        closeTo(sample.entropy({ binning: [0, 0.5, 1], base: 2, differential: true }), 0, 1e-12);
        assert.throws(() => sample.entropy({ base: 1 }), RangeError);
        assert.throws(() => sample.entropy({ histogram: {} }), TypeError);
    });

    test("the Silverman bandwidth follows the documented rule and the kernel integrates to one", () => {
        const sample = distribution(1, 2, 3);
        const estimate = sample.density();
        assert.equal(estimate.getKernel(), "gaussian");
        assert.equal(estimate.getBoundary(), "none");
        const bandwidth = 0.9 * Math.min(1, 1 / 1.34) * Math.pow(3, -0.2);
        closeTo(estimate.getBandwidth(), bandwidth, 1e-12);
        const phi = (u) => Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
        const expected = (phi((2 - 1) / bandwidth) + phi(0) + phi((2 - 3) / bandwidth)) / (3 * bandwidth);
        closeTo(estimate.evaluate(2), expected, 1e-12);
        closeTo(estimate.integrate(-100, 100), 1, 1e-5);
        closeTo(estimate.integrate(-10, 10), 1, 1e-5);
        assert.equal(estimate.getPoints().length, 512);
        assert.throws(() => estimate.evaluate(Number.NaN), TypeError);
        assert.throws(() => estimate.integrate(1, 0), RangeError);
        assert.equal(Object.isFrozen(estimate), true);
    });

    test("boundary corrections double the density at a hard boundary", () => {
        const sample = distribution(1, 2, 3);
        const plain = sample.density();
        const reflected = sample.density({ boundary: "reflection", support: [0, Number.POSITIVE_INFINITY] });
        const renormalized = sample.density({ boundary: "renormalize", support: [0, Number.POSITIVE_INFINITY] });
        closeTo(reflected.evaluate(0) / plain.evaluate(0), 2, 1e-12);
        closeTo(renormalized.evaluate(0) / plain.evaluate(0), 2, 1e-12);
        closeTo(reflected.evaluate(2), plain.evaluate(2), 1e-3);
        closeTo(reflected.getBoundarySupport().get()[0], 0);
        assert.throws(() => sample.density({ boundary: "reflection" }), RangeError);
        assert.throws(() => sample.density({ bandwidth: 0 }), RangeError);
        assert.throws(() => sample.density({ gridSize: 1n }), RangeError);
        assert.throws(() => sample.density({ cut: -1 }), RangeError);
        assert.throws(() => sample.density({ kernel: "nope" }), TypeError);
    });

    test("density needs dispersion unless a bandwidth is given explicitly", () => {
        assert.throws(() => distribution(5, 5, 5).density(), RangeError);
        const explicit = distribution(5, 5, 5).density({ bandwidth: 0.5 });
        closeTo(explicit.getBandwidth(), 0.5, 1e-12);
        closeTo(explicit.evaluate(5), 1 / (3 * 0.5) * 3 * Math.exp(0) / Math.sqrt(2 * Math.PI), 1e-9);
        assert.throws(() => distribution().density({ bandwidth: 0.5 }), RangeError);
        const explicitPoints = distribution(1, 2, 3).density({ points: [0, 2, 4], bandwidth: 1 });
        assert.deepEqual(explicitPoints.getPoints(), [0, 2, 4]);
        assert.deepEqual(explicitPoints.getSupport(), [0, 4]);
        assert.equal(explicitPoints.getDensities().length, 3);
        const positional = distribution(1, 2, 3).density([0, 2]);
        assert.deepEqual(positional.getPoints(), [0, 2]);
        assert.equal(positional.getDensities().length, 2);
    });
});

describe("collector factories", () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const sample = distribution(...values);

    test("each capability has a one-to-one synchronous factory", () => {
        const histogram = useSynchronousHistogram({ binning: "sturges" }).collect(values);
        assert.deepEqual(histogram.bins.map((bin) => bin.count.toString()), sample.histogram({ binning: "sturges" }).getCounts().map(String));
        closeTo(present(useSynchronousQuantile(0.75).collect(values)), present(sample.quantile(0.75)));
        closeTo(present(useSynchronousQuantile(0.75, { method: "type-1" }).collect(values)), present(sample.quantile(0.75, { method: "type-1" })));
        assert.deepEqual(useSynchronousEmpiricalDistribution().collect(values), sample.empiricalDistribution().getOrderStatistics());
        closeTo(present(useSynchronousMedianAbsoluteDeviation().collect(values)), present(sample.medianAbsoluteDeviation()));
        const robust = useSynchronousRobust().collect(values);
        closeTo(robust.median, present(sample.robust().getMedian()));
        closeTo(robust.medianAbsoluteDeviation, 0.5);
        closeTo(present(useSynchronousSkewness().collect(values)), present(sample.skewness()));
        closeTo(present(useSynchronousKurtosis({ estimator: "g2" }).collect(values)), present(sample.kurtosis({ estimator: "g2" })));
        const moments = useSynchronousMoments().collect(values);
        closeTo(moments.mean, sample.moments().getMean());
        closeTo(moments.m2, sample.moments().getVariance(0));
        closeTo(useSynchronousEntropy({ binning: [2, 4, 6, 10] }).collect(values), sample.entropy({ binning: [2, 4, 6, 10] }));
        closeDensity(
            DensityEstimate.use(useSynchronousDensity({ bandwidth: 1 }).collect(values)),
            sample.density({ bandwidth: 1 })
        );
    });

    test("streaming factories reject non-finite values at entry", () => {
        assert.throws(() => useSynchronousQuantile(0.5).collect([1, Number.NaN]), TypeError);
        assert.throws(() => useSynchronousHistogram().collect([1, Number.POSITIVE_INFINITY]), TypeError);
        assert.throws(() => useSynchronousQuantile(-1), RangeError);
        assert.throws(() => useSynchronousSkewness({ estimator: "nope" }), TypeError);
        assert.throws(() => useSynchronousDensity({ boundary: "reflection" }), RangeError);
        assert.throws(() => new SynchronousDistributionCollectable([1, Number.NaN]), TypeError);
    });

    test("moment and robust value objects round-trip their plain data", () => {
        const moments = sample.moments();
        const restored = MomentSummary.use({
            count: moments.getCount(),
            mean: moments.getMean(),
            m2: moments.getVariance(0),
            m3: 0,
            m4: 0
        });
        closeTo(restored.getMean(), moments.getMean());
        assert.throws(() => MomentSummary.use({ count: -1n, mean: 0, m2: 0, m3: 0, m4: 0 }), RangeError);
        const summary = sample.robust();
        const rebuilt = RobustSummary.use({
            values: sample.empiricalDistribution().getOrderStatistics(),
            median: present(summary.getMedian()),
            medianAbsoluteDeviation: present(summary.getMedianAbsoluteDeviation(1)),
            trim: 0.1,
            trimPolicy: "truncate",
            fence: 1.5
        });
        closeTo(present(rebuilt.getMedian()), present(summary.getMedian()));
    });
});

describe("asynchronous distribution", () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];

    const sourceOf = (elements) => (async function* () {
        for (const element of elements) {
            yield element;
        }
    })();

    test("matches the synchronous definitions for every capability", async () => {
        const synchronous = distribution(...values);
        const asynchronous = await AsynchronousDistributionCollectable.use(sourceOf(values));
        assert.equal(await asynchronous.getCount(), 8n);
        closeTo(present(await asynchronous.getMinimum()), 2);
        closeTo(present(await asynchronous.getMaximum()), 9);
        closeTo(present(await asynchronous.quantile(0.75)), present(synchronous.quantile(0.75)));
        closeTo(present(await asynchronous.quantile(0.9, { method: "type-3" })), present(synchronous.quantile(0.9, { method: "type-3" })));
        const asyncHistogram = await asynchronous.histogram({ binning: "sturges" });
        assert.deepEqual(asyncHistogram.getCounts(), synchronous.histogram({ binning: "sturges" }).getCounts());
        const asyncEcdf = await asynchronous.empiricalDistribution();
        const syncEcdf = synchronous.empiricalDistribution();
        for (const value of [-1, 2, 4, 4.5, 9, 10]) {
            closeTo(asyncEcdf.evaluate(value), syncEcdf.evaluate(value));
            closeTo(asyncEcdf.leftLimit(value), syncEcdf.leftLimit(value));
        }
        closeTo(present(await asynchronous.medianAbsoluteDeviation()), present(synchronous.medianAbsoluteDeviation()));
        const asyncRobust = await asynchronous.robust();
        closeTo(present(asyncRobust.getInterquartileRange()), present(synchronous.robust().getInterquartileRange()));
        closeTo(present(await asynchronous.skewness()), present(synchronous.skewness()));
        closeTo(present(await asynchronous.kurtosis()), present(synchronous.kurtosis()));
        closeTo((await asynchronous.moments()).getVariance(0), synchronous.moments().getVariance(0));
        closeTo(await asynchronous.entropy({ binning: [2, 4, 6, 10] }), synchronous.entropy({ binning: [2, 4, 6, 10] }));
        closeDensity(await asynchronous.density({ bandwidth: 1 }), synchronous.density({ bandwidth: 1 }));
        assert.deepEqual((await asynchronous.density([0, 2])).getPoints(), [0, 2]);
        assert.equal(await asynchronous.equals(await AsynchronousDistributionCollectable.use(sourceOf(values.slice().reverse()))), true);
    });

    test("the asynchronous factory applies the synchronous finisher", async () => {
        const optional = await useAsynchronousQuantile(0.75).collect(sourceOf(values));
        closeTo(present(optional), 5.5);
        assert.throws(() => useAsynchronousQuantile(2), RangeError);
    });

    test("non-finite values reject the prepared sample", async () => {
        const invalid = await AsynchronousDistributionCollectable.use(sourceOf([1, 2, Number.NaN]));
        await assert.rejects(() => invalid.quantile(0.5), TypeError);
        await assert.rejects(() => invalid.histogram(), TypeError);
    });
});

/**
 * Returns the largest jump of an empirical distribution, which is only visible
 * when both sides of the step are evaluated.
 *
 * @param ecdf - The empirical distribution to inspect.
 * @returns The largest `evaluate - leftLimit` gap.
 */
function belowOfEdge(ecdf) {
    let jump = 0;
    for (const value of ecdf.getOrderStatistics()) {
        jump = Math.max(jump, ecdf.evaluate(value) - ecdf.leftLimit(value));
    }
    return jump;
}
