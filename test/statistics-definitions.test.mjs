import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as ST from "semantic-typescript";

const numeric = (...values) => ST.useOf(...values).toNumericStatistics();
const bigint = (...values) => ST.useOf(...values.map((value) => BigInt(value))).toBigintStatistics();
const asynchronous = (...values) => ST.useIterate({ async *[Symbol.asyncIterator]() { yield* values; } });
const asynchronousNumeric = (...values) => asynchronous(...values).toNumericStatistics();
const asynchronousBigint = (...values) => asynchronous(...values.map((value) => BigInt(value))).toBigintStatistics();

const closeTo = (actual, expected, epsilon = 1e-12, label = "") => {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${label}${actual} is not within ${epsilon} of ${expected}`);
};
const present = (optional) => {
    assert.equal(optional.isPresent(), true, "expected a present optional");
    return optional.get();
};

describe("统计量的主流默认定义（1.2.0 → 1.3.0）", () => {
    test("quantile 默认使用 Hyndman–Fan 类型 7，并支持全部九种类型", () => {
        // 调研文档 §2.2.2 的对照表：x = [2,4,4,4,5,5,7,9]，n = 8。
        const statistics = numeric(2, 4, 4, 4, 5, 5, 7, 9);
        const probabilities = [0.10, 0.25, 0.50, 0.75, 0.90];
        const table = {
            "type-1": [2, 4, 4, 5, 9],
            "type-2": [2, 4, 4.5, 6, 9],
            "type-3": [2, 4, 4, 5, 7],
            "type-4": [2, 4, 4, 5, 7.4],
            "type-5": [2.6, 4, 4.5, 6, 8.4],
            "type-6": [2, 4, 4.5, 6.5, 9],
            "type-7": [3.4, 4, 4.5, 5.5, 7.6],
            "type-8": [2 + 1 / 3, 4, 4.5, 6 + 1 / 6, 8 + 2 / 3],
            "type-9": [2.4, 4, 4.5, 6.125, 8.6],
        };
        for (const [method, row] of Object.entries(table)) {
            row.forEach((expected, index) => {
                const actual = present(statistics.quantile(probabilities[index], { method }));
                closeTo(actual, expected, 1e-12, `${method} p=${probabilities[index]}: `);
            });
        }
        // 默认值就是类型 7（R / NumPy `linear` / Excel PERCENTILE.INC）。
        closeTo(present(statistics.quantile(0.75)), 5.5);
        closeTo(present(statistics.quantile(0.90)), 7.6);
    });

    test("quantile 在 [1..8] 的验收数值：类型 7 为 6.25，类型 1 为 6", () => {
        const statistics = numeric(1, 2, 3, 4, 5, 6, 7, 8);
        assert.equal(present(statistics.quantile(0.75)), 6.25);
        assert.equal(present(statistics.quantile(0.75, { method: "type-1" })), 6);
        // IQR 也随之与 R 的 IQR(1:8) = 3.5 一致；旧类型 1 给出 4。
        assert.equal(present(statistics.interquartileRange()), 3.5);
        assert.equal(present(statistics.interquartileRange({ method: "type-1" })), 4);
    });

    test("quantile 在重复值上不再塌缩", () => {
        const statistics = numeric(1, 1, 1, 1, 100);
        // 调研文档 §2.2.3：类型 3 在 P90 上返回 1，类型 7 返回 60.4。
        assert.equal(present(statistics.quantile(0.9, { method: "type-3" })), 1);
        closeTo(present(statistics.quantile(0.9)), 60.4);
        closeTo(present(statistics.quantile(0.9, { method: "type-1" })), 100);
        // 类型 2 在跳点取平均：n = 4、p = 0.25 时 np = 1 是整数，返回 (x1 + x2) / 2。
        assert.equal(present(numeric(1, 2, 3, 4).quantile(0.25, { method: "type-2" })), 1.5);
    });

    test("variance 与 standardDeviation 默认除以 n-1", () => {
        const statistics = numeric(1, 2, 3, 4);
        closeTo(present(statistics.variance()), 5 / 3);
        closeTo(present(statistics.variance({ ddof: 0 })), 5 / 4);
        closeTo(present(statistics.standardDeviation()), Math.sqrt(5 / 3));
        closeTo(present(statistics.standardDeviation({ ddof: 0 })), Math.sqrt(5 / 4));
        // 与 R var(c(1,2,3,4)) / sd()，pandas var(ddof=1)，NumPy var(ddof=1) 一致。
        const integers = bigint(1, 2, 3, 4);
        assert.equal(present(integers.variance()), 2n);       // 5/3 四舍五入
        assert.equal(present(integers.variance({ ddof: 0 })), 1n);
        assert.equal(present(integers.standardDeviation()), 1n);
    });

    test("skewness 默认 G1，kurtosis 默认超额 G2，并可用选项切回 g1 / g2", () => {
        const symmetric = numeric(1, 2, 3, 4);
        assert.equal(present(symmetric.skewness()), 0);
        closeTo(present(symmetric.kurtosis()), -1.2);
        closeTo(present(symmetric.kurtosis({ estimator: "g2" })), -1.36);
        closeTo(present(symmetric.kurtosis({ excess: false })), 1.8);

        // pandas: Series([1,2,3,10]).skew() == 1.763632614803888，.kurt() == 3.228。
        const asymmetric = numeric(1, 2, 3, 10);
        closeTo(present(asymmetric.skewness()), 1.763632614803888);
        closeTo(present(asymmetric.skewness({ estimator: "g1" })), 1.0182337649086284);
        closeTo(present(asymmetric.kurtosis()), 3.228);
        closeTo(present(asymmetric.kurtosis({ estimator: "g2" })), -0.7696);

        const integers = bigint(1, 2, 3, 10);
        assert.equal(present(integers.skewness()), 2n);       // 1.7636 四舍五入
        assert.equal(present(integers.skewness({ estimator: "g1" })), 1n);
        assert.equal(present(integers.kurtosis()), 3n);
        assert.equal(present(integers.kurtosis({ estimator: "g2" })), -1n);
    });

    test("skewness / kurtosis 提供闭式标准误", () => {
        // 调研文档 §2.4.3 的 Wikipedia 原始例子（n = 20）。
        const statistics = numeric(0, 3, 4, 1, 2, 3, 0, 2, 1, 3, 2, 0, 2, 2, 3, 2, 5, 2, 3, 999);
        closeTo(present(statistics.skewness()), 4.471885014799229);
        closeTo(present(statistics.skewness({ estimator: "g1" })), 4.129251496378207);
        closeTo(present(statistics.kurtosis()), 19.998428728659764);
        closeTo(present(statistics.kurtosis({ estimator: "g2" })), 15.051426543784178);
        closeTo(present(statistics.skewnessStandardError()), 0.5121033367077574);
        closeTo(present(statistics.kurtosisStandardError()), 0.992383612541845);
    });
});

describe("小样本诚实返回空 Optional", () => {
    test("空样本的所有统计量都是空 Optional", async () => {
        const emptyNumeric = ST.useEmpty().toNumericStatistics();
        const emptyBigint = ST.useEmpty().toBigintStatistics();
        const emptyAsynchronous = asynchronousNumeric();
        for (const optional of [
            emptyNumeric.variance(), emptyNumeric.standardDeviation(), emptyNumeric.skewness(),
            emptyNumeric.kurtosis(), emptyNumeric.quantile(0.5), emptyNumeric.interquartileRange(),
            emptyNumeric.skewnessStandardError(), emptyNumeric.kurtosisStandardError(),
            emptyBigint.variance(), emptyBigint.standardDeviation(), emptyBigint.skewness(),
            emptyBigint.kurtosis(), emptyBigint.quantile(0.5), emptyBigint.interquartileRange(),
        ]) {
            assert.equal(optional.isEmpty(), true);
        }
        for (const optional of [
            await emptyAsynchronous.variance(), await emptyAsynchronous.standardDeviation(),
            await emptyAsynchronous.skewness(), await emptyAsynchronous.kurtosis(),
            await emptyAsynchronous.quantile(0.5), await emptyAsynchronous.interquartileRange(),
            await emptyAsynchronous.skewnessStandardError(), await emptyAsynchronous.kurtosisStandardError(),
        ]) {
            assert.equal(optional.isEmpty(), true);
        }
    });

    test("n = 1：样本方差、标准差、G1、G2 与标准误均为空；ddof=0 的总体方差为 0", () => {
        const statistics = numeric(7);
        assert.equal(statistics.variance().isEmpty(), true);
        assert.equal(statistics.standardDeviation().isEmpty(), true);
        assert.equal(statistics.skewness().isEmpty(), true);
        assert.equal(statistics.skewness({ estimator: "g1" }).isEmpty(), true);
        assert.equal(statistics.kurtosis().isEmpty(), true);
        assert.equal(statistics.kurtosis({ estimator: "g2" }).isEmpty(), true);
        assert.equal(statistics.skewnessStandardError().isEmpty(), true);
        assert.equal(statistics.kurtosisStandardError().isEmpty(), true);
        assert.equal(present(statistics.variance({ ddof: 0 })), 0);
        assert.equal(present(statistics.standardDeviation({ ddof: 0 })), 0);
        assert.equal(present(statistics.quantile(0.5)), 7);
    });

    test("n = 2：g1 为 0、g2 为 -2，但 G1、G2 与标准误仍为空", () => {
        const statistics = numeric(1, 2);
        assert.equal(present(statistics.variance()), 0.5);
        assert.equal(statistics.skewness().isEmpty(), true);
        assert.equal(present(statistics.skewness({ estimator: "g1" })), 0);
        assert.equal(statistics.kurtosis().isEmpty(), true);
        assert.equal(present(statistics.kurtosis({ estimator: "g2" })), -2);
        assert.equal(statistics.skewnessStandardError().isEmpty(), true);
        assert.equal(statistics.kurtosisStandardError().isEmpty(), true);
    });

    test("n = 3：G1 已定义，G2 因 n-3 = 0 仍为空", () => {
        const statistics = numeric(1, 2, 3);
        assert.equal(present(statistics.skewness()), 0);
        assert.equal(statistics.kurtosis().isEmpty(), true);
        assert.equal(present(statistics.kurtosis({ estimator: "g2" })), -1.5);
        closeTo(present(statistics.skewnessStandardError()), Math.sqrt(6 * 3 * 2 / (1 * 4 * 6)));
        assert.equal(statistics.kurtosisStandardError().isEmpty(), true);
    });

    test("常数样本的偏度与峰度无定义，方差为 0", () => {
        const statistics = numeric(5, 5, 5, 5);
        assert.equal(present(statistics.variance()), 0);
        assert.equal(present(statistics.standardDeviation()), 0);
        assert.equal(statistics.skewness().isEmpty(), true);
        assert.equal(statistics.kurtosis().isEmpty(), true);
    });
});

describe("同步 / 异步 / numeric / bigint 语义一致", () => {
    test("四个入口算出同一组值（bigint 按四舍五入）", async () => {
        const values = [1, 2, 3, 10];
        const syncNumeric = numeric(...values);
        const asyncNumeric = asynchronousNumeric(...values);
        closeTo(present(await asyncNumeric.variance()), present(syncNumeric.variance()));
        closeTo(present(await asyncNumeric.standardDeviation()), present(syncNumeric.standardDeviation()));
        closeTo(present(await asyncNumeric.skewness()), present(syncNumeric.skewness()));
        closeTo(present(await asyncNumeric.skewness({ estimator: "g1" })), present(syncNumeric.skewness({ estimator: "g1" })));
        closeTo(present(await asyncNumeric.kurtosis()), present(syncNumeric.kurtosis()));
        closeTo(present(await asyncNumeric.kurtosis({ estimator: "g2" })), present(syncNumeric.kurtosis({ estimator: "g2" })));
        closeTo(present(await asyncNumeric.quantile(0.75)), present(syncNumeric.quantile(0.75)));
        closeTo(present(await asyncNumeric.quantile(0.75, { method: "type-1" })), present(syncNumeric.quantile(0.75, { method: "type-1" })));
        closeTo(present(await asyncNumeric.interquartileRange()), present(syncNumeric.interquartileRange()));
        closeTo(present(await asyncNumeric.skewnessStandardError()), present(syncNumeric.skewnessStandardError()));
        closeTo(present(await asyncNumeric.kurtosisStandardError()), present(syncNumeric.kurtosisStandardError()));

        const syncBigint = bigint(...values);
        const asyncBigint = asynchronousBigint(...values);
        assert.equal(present(await asyncBigint.variance()), present(syncBigint.variance()));
        assert.equal(present(await asyncBigint.standardDeviation()), present(syncBigint.standardDeviation()));
        assert.equal(present(await asyncBigint.skewness()), present(syncBigint.skewness()));
        assert.equal(present(await asyncBigint.kurtosis()), present(syncBigint.kurtosis()));
        assert.equal(present(await asyncBigint.quantile(0.75)), present(syncBigint.quantile(0.75)));
        assert.equal(present(await asyncBigint.interquartileRange()), present(syncBigint.interquartileRange()));
        assert.equal(present(await asyncBigint.kurtosis({ estimator: "g2" })), present(syncBigint.kurtosis({ estimator: "g2" })));
    });

    test("mapper 与选项可以同时使用", async () => {
        const statistics = numeric(-2, 0, 2);
        assert.equal(present(statistics.quantile(0.5, (value) => value * value)), 4);
        assert.equal(present(statistics.quantile(0.5, (value) => value * 10, { method: "type-1" })), 0);
        const asynchronousStatistics = asynchronousNumeric(-2, 0, 2);
        assert.equal(present(await asynchronousStatistics.quantile(0.5, (value) => value * value)), 4);
        assert.equal(present(await asynchronousStatistics.variance((value) => value * 10)), 400);
    });
});

describe("选项校验", () => {
    test("未知的 method / estimator / ddof 抛出 TypeError", () => {
        const statistics = numeric(1, 2, 3, 4);
        assert.throws(() => statistics.quantile(0.5, { method: "type-0" }), TypeError);
        assert.throws(() => statistics.quantile(0.5, { method: "nearest" }), TypeError);
        assert.throws(() => statistics.skewness({ estimator: "b1" }), TypeError);
        assert.throws(() => statistics.kurtosis({ estimator: "b2" }), TypeError);
        assert.throws(() => statistics.variance({ ddof: 2 }), TypeError);
        assert.throws(() => statistics.standardDeviation({ ddof: -1 }), TypeError);
        assert.throws(() => bigint(1, 2, 3, 4).quantile(0.5, { method: "type-10" }), TypeError);
    });
});
