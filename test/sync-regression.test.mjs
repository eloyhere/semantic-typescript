import { test } from "node:test";
import assert from "node:assert/strict";
import * as ST from "semantic-typescript";

for (const operation of ["flat", "flatMap"]) {
  test(`${operation} honors interruption before accepting and closes the inner iterator`, () => {
    let outerCalls = 0;
    let pulls = 0;
    let closed = 0;
    function* inner() {
      try {
        while (pulls < 10) yield ++pulls;
        throw new Error("downstream interruption was ignored");
      } finally { closed++; }
    }
    const result = ST.useOf(1, 2)[operation](() => { outerCalls++; return inner(); })
      .map((x) => x * 10).limit(1).toUnordered().toArray();
    assert.deepEqual(result, [10]);
    assert.equal(pulls, 1);
    assert.equal(closed, 1);
    assert.equal(outerCalls, 1);

    let downstreamCalls = 0;
    const empty = ST.useOf(1)[operation](() => [1, 2]).limit(0)
      .map((x) => { downstreamCalls++; return x; }).toUnordered().toArray();
    assert.deepEqual(empty, []);
    assert.equal(downstreamCalls, 0);
    let outerZeroCalls = 0;
    assert.deepEqual(ST.useOf(1, 2)[operation](() => { outerZeroCalls++; return [1, 2]; })
      .limit(0).toUnordered().toArray(), []);
    assert.equal(outerZeroCalls, 1);
  });

  test(`${operation} checks interruption before an inner downstream mapper`, () => {
    let calls = 0;
    const result = ST.useOf(1)[operation](() => [1, 2])
      .limit(0).toUnordered().toArray();
    assert.deepEqual(result, []);
    const collector = ST.SynchronousCollector.shortable(() => [], () => true,
      (a, x) => { calls++; a.push(x); return a; }, (a) => a);
    assert.deepEqual(collector.collect(ST.useOf(1)[operation](() => [1, 2]).source()), []);
    assert.equal(calls, 0);
  });

  test(`${operation} stops semantic inner sources without invoking a second outer mapper`, () => {
    let calls = 0;
    const result = ST.useOf(1, 2)[operation]((x) => { calls++; return ST.useOf(x, x + 10); })
      .limit(1).toUnordered().toArray();
    assert.deepEqual(result, [1]);
    assert.equal(calls, 1);
  });
}

test("flat and flatMap check a value-sensitive interrupt before calling accept", () => {
  for (const operation of ["flat", "flatMap"]) {
    for (const inner of [[1, 2, 3], ST.useOf(1, 2, 3)]) {
      const accepted = [];
      ST.useOf(1)[operation](() => inner).source()((x) => accepted.push(x), (x) => x === 2);
      assert.deepEqual(accepted, [1]);
    }
  }
});

test("concat obeys limits across iterable and semantic boundaries", () => {
  for (const tail of [[2, 3], ST.useOf(2, 3)]) {
    let calls = 0;
    assert.deepEqual(ST.useOf(1).concat(tail).map((x) => { calls++; return x; })
      .limit(1).toUnordered().toArray(), [1]);
    assert.equal(calls, 1);
  }
  let pulled = 0;
  function* tail() { while (pulled < 10) yield ++pulled; throw new Error("ignored interruption"); }
  assert.deepEqual(ST.useEmpty().concat(tail()).limit(1).toUnordered().toArray(), [1]);
  assert.equal(pulled, 1);
});

test("numeric statistics always apply an explicit mapper", () => {
  const statistics = ST.useOf(1, 2, 2).toNumericStatistics();
  // 此处因 1.2.0→1.3.0 的定义变更而更新：variance / standardDeviation 改为样本定义（n-1）并返回 Optional。
  for (const [method, expected, optional] of [["summate", 50], ["average", 50 / 3], ["mean", 50 / 3],
    ["median", 20], ["mode", 20], ["variance", 100 / 3, true], ["standardDeviation", Math.sqrt(100 / 3), true]]) {
    let calls = 0;
    const result = statistics[method]((x) => { calls++; return x * 10; });
    const actual = optional ? result.get() : result;
    assert.ok(Math.abs(actual - expected) < 1e-10, `${method}: ${actual}`);
    assert.equal(calls, 3, method);
  }
});

test("bigint statistics always apply an explicit mapper", () => {
  const statistics = ST.useOf(1n, 2n, 2n).toBigintStatistics();
  // 此处因 1.2.0→1.3.0 的定义变更而更新：样本方差 100/3 四舍五入为 33n（旧总体方差 22n），标准差 6n（旧 5n）。
  for (const [method, expected, optional] of [["summate", 50n], ["average", 16n], ["mean", 16n],
    ["median", 20n], ["mode", 20n], ["variance", 33n, true], ["standardDeviation", 6n, true]]) {
    let calls = 0;
    const result = statistics[method]((x) => { calls++; return x * 10n; });
    assert.equal(optional ? result.get() : result, expected, method);
    assert.equal(calls, 3, method);
  }
});

test("all exported numeric and bigint collectors apply their mapper", () => {
  for (const [kind, values, mapper, expected] of [
    ["Numeric", [1, 2], (x) => x * 10, [30, 15, 10, 15, 25, 5]],
    ["BigInt", [1n, 2n], (x) => x * 10n, [30n, 15n, 10n, 15n, 25n, 5n]],
  ]) {
    for (const [index, method] of ["Summate", "Average", "Mode", "Median", "Variance", "StandardDeviation"].entries()) {
      let calls = 0;
      assert.equal(ST[`useSynchronous${kind}${method}`]((x) => { calls++; return mapper(x); }).collect(values), expected[index], `${kind}${method}`);
      assert.equal(calls, 2);
    }
  }
});

test("range and quantile operate on projected values", () => {
  const numeric = ST.useOf(-2, 0, 2).toNumericStatistics();
  const big = ST.useOf(-2n, 0n, 2n).toBigintStatistics();
  assert.equal(numeric.range((x) => x * x), 4);
  assert.equal(big.range((x) => x * x), 4n);
  // 此处因 1.2.0→1.3.0 的定义变更而更新：quantile 返回 Optional。
  assert.equal(numeric.quantile(0, (x) => x * x).get(), 0);
  assert.equal(big.quantile(0, (x) => x * x).get(), 0n);
  assert.equal(numeric.quantile(1, (x) => -x).get(), 2);
  assert.equal(big.quantile(1, (x) => -x).get(), 2n);
});

test("quantiles follow Hyndman–Fan type 7 by default and expose earlier types", () => {
  const numeric = ST.useOf(1, 2, 3, 4).toNumericStatistics();
  const big = ST.useOf(1n, 2n, 3n, 4n).toBigintStatistics();
  // 此处因 1.2.0→1.3.0 的定义变更而更新：默认由类型 1 改为类型 7，旧值为 [1, 1, 2, 2, 3, 4]。
  for (const [q, expected] of [[0, 1], [0.25, 1.75], [0.26, 1.78], [0.5, 2.5], [0.75, 3.25], [1, 4]]) {
    assert.ok(Math.abs(numeric.quantile(q).get() - expected) < 1e-12, `${q}`);
    assert.equal(big.quantile(q).get(), BigInt(Math.round(expected)), `${q}`);
  }
  // 旧的 IQR（类型 1）是 2；类型 7 在 [1,2,3,4] 上是 1.5。
  assert.equal(numeric.interquartileRange().get(), 1.5);
  assert.equal(big.interquartileRange().get(), 1n);
  // 旧行为仍可由 method 选项精确恢复。
  for (const [q, expected] of [[0.25, 1], [0.5, 2], [0.75, 3]]) {
    assert.equal(numeric.quantile(q, { method: "type-1" }).get(), expected);
    assert.equal(big.quantile(q, { method: "type-1" }).get(), BigInt(expected));
  }
  assert.equal(numeric.interquartileRange({ method: "type-1" }).get(), 2);
  assert.equal(big.interquartileRange({ method: "type-1" }).get(), 2n);
  for (const statistics of [ST.useEmpty().toNumericStatistics(), ST.useEmpty().toBigintStatistics(),
    ST.useOf(1).toNumericStatistics(), ST.useOf(1n).toBigintStatistics()]) {
    for (const q of [NaN, Infinity, -Infinity, -0.1, 1.1]) assert.throws(() => statistics.quantile(q), RangeError);
  }
  assert.throws(() => numeric.quantile(0.5, { method: "type-10" }), TypeError);
  assert.throws(() => big.quantile(0.5, { method: "type-0" }), TypeError);
});

test("bigint variance and standard deviation retain translation invariance and rounding", () => {
  for (const offset of [0n, 2n ** 60n, -(2n ** 60n)]) {
    // 此处因 1.2.0→1.3.0 的定义变更而更新：统计类改为样本定义（n-1），收集器仍是总体定义。
    for (const [values, sampleVariance, sampleDeviation, populationVariance, populationDeviation] of [
      [[0n, 2n], 2n, 1n, 1n, 1n], [[0n, 1n, 2n, 3n], 2n, 1n, 1n, 1n], [[0n, 3n], 5n, 2n, 2n, 2n],
    ]) {
      const translated = values.map((x) => x + offset);
      const statistics = ST.useFrom(translated).toBigintStatistics();
      assert.equal(statistics.variance().get(), sampleVariance);
      assert.equal(statistics.standardDeviation().get(), sampleDeviation);
      assert.equal(statistics.variance({ ddof: 0 }).get(), populationVariance);
      assert.equal(statistics.standardDeviation({ ddof: 0 }).get(), populationDeviation);
      assert.equal(ST.useSynchronousBigIntVariance().collect(translated), populationVariance);
      assert.equal(ST.useSynchronousBigIntStandardDeviation().collect(translated), populationDeviation);
    }
  }
});

test("four-argument collect invokes interruptor and finisher in their roles", () => {
  let finishCalls = 0;
  const result = ST.useOf(1, 2, 3).toUnordered().collect(
    () => [], (_x, _i, a) => a.length >= 1,
    (a, x) => [...a, x], (a) => { finishCalls++; return `values=${a.join(",")}`; });
  assert.equal(result, "values=1");
  assert.equal(finishCalls, 1);
});

test("join preserves empty delimiters and removes only the trailing separator", () => {
  for (const values of [[], [1], [1, 2]]) {
    const c = ST.useFrom(values).toUnordered();
    assert.equal(c.join(), `[${values.join(",")}]`);
    assert.equal(c.join("::"), `[${values.join("::")}]`);
    assert.equal(c.join("<", "::", ">"), `<${values.join("::")}>`);
    assert.equal(c.join("prefix", "", "suffix"), `prefix${values.join("")}suffix`);
  }
});

test("single-argument log and error collectors use the supplied accumulator", () => {
  for (const [factory, method] of [[ST.useSynchronousLog, "log"], [ST.useSynchronousError, "error"]]) {
    const original = console[method];
    const output = [];
    console[method] = (text) => output.push(text);
    try {
      assert.equal(factory((text, value) => text + value * 2).collect([1, 2]), "[24]");
      assert.deepEqual(output, ["[24]"]);
    } finally { console[method] = original; }
  }
});
