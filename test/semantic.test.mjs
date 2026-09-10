import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as ST from "../dist/index.js";
describe("导出与品牌校验", () => {
    test("P0-14 hash 模块已导出", () => {
        assert.equal(typeof ST.useHash, "function");
        assert.equal(typeof ST.register, "function");
        assert.equal(typeof ST.maskOf, "function");
    });
    test("P0-16 同步/异步 Statistics Symbol 不再复键", () => {
        assert.notEqual(ST.SynchronousStatisticsSymbol, ST.AsynchronousStatisticsSymbol);
        assert.notEqual(ST.SynchronousNumericStatisticsSymbol, ST.AsynchronousNumericStatisticsSymbol);
        assert.notEqual(ST.SynchronousBigIntStatisticsSymbol, ST.AsynchronousBigIntStatisticsSymbol);
    });
    test("P0-16 数字统计对象能被正确识别", () => {
        const numeric = ST.useOf(1, 2, 3).toNumericStatistics();
        const big = ST.useOf(1n, 2n).toBigintStatistics();
        assert.equal(ST.isSynchronousNumericStatistics(numeric), true);
        assert.equal(ST.isSynchronousBigIntStatistics(big), true);
        assert.equal(ST.isAsynchronousNumericStatistics(numeric), false);
        assert.equal(ST.isSynchronousStatistics(numeric), true);
    });
});
describe("索引重排（P0-2 / P0-15）", () => {
    const source = () => ST.useFrom([1, 2, 3, 4, 5]);
    test("reverse + toOrdered 真正逆转", () => {
        assert.deepEqual(source().reverse().toOrdered().toArray(), [5, 4, 3, 2, 1]);
    });
    test("redirect(-index - 1) + toOrdered 逆转", () => {
        assert.deepEqual(source().redirect((_element, index) => -index - 1n).toOrdered().toArray(), [5, 4, 3, 2, 1]);
    });
    test("translate(2) 按 README 语义循环右旋", () => {
        assert.deepEqual(source().translate(2).toOrdered().toArray(), [4, 5, 1, 2, 3]);
    });
    test("translate(-2) 循环左旋", () => {
        assert.deepEqual(source().translate(-2).toOrdered().toArray(), [3, 4, 5, 1, 2]);
    });
    test("toOrdered 归一化索引（按总数取余）", () => {
        const ordered = source().reverse().toOrdered();
        assert.deepEqual(ordered.buffer.map((entry) => String(entry.index)), ["0", "1", "2", "3", "4"]);
        const shifted = source().translate(7).toOrdered();
        assert.deepEqual(shifted.buffer.map((entry) => String(entry.index)), ["0", "1", "2", "3", "4"]);
    });
    test("toOrdered(comparator) 仍按值排序并重排索引", () => {
        const ordered = ST.useOf(3, 1, 2).toOrdered((a, b) => a - b);
        assert.deepEqual(ordered.buffer.map((entry) => entry.element), [1, 2, 3]);
        assert.deepEqual(ordered.buffer.map((entry) => String(entry.index)), ["0", "1", "2"]);
    });
    test("shuffle 每次调用产生不同顺序", () => {
        const elements = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const first = ST.useFrom(elements).shuffle().toOrdered().toArray();
        const second = ST.useFrom(elements).shuffle().toOrdered().toArray();
        assert.deepEqual([...first].sort((a, b) => a - b), elements);
        assert.deepEqual([...second].sort((a, b) => a - b), elements);
        assert.notDeepEqual(first, second);
    });
    test("shuffle(mapper) 使用自定义索引映射", () => {
        assert.deepEqual(ST.useOf(1, 2, 3).shuffle((_element, index) => -index - 1n).toOrdered().toArray(), [3, 2, 1]);
    });
    test("重复索引不再静默丢数据", () => {
        assert.deepEqual(ST.useText("a,b,c", ",").toUnordered().toArray(), ["a", "b", "c"]);
        assert.deepEqual(ST.useOf(1, 2, 3).redirect(() => 0n).toUnordered().toArray(), [1, 2, 3]);
    });
});
describe("查找与归约（P0-4）", () => {
    test("findFirst / findLast / findAny", () => {
        assert.equal(ST.useOf(10, 20, 30).toUnordered().findFirst().orElse(-1), 10);
        assert.equal(ST.useOf(10, 20, 30).toUnordered().findLast().orElse(-1), 30);
        assert.equal(ST.useOf(10, 20, 30).toUnordered().findAny().orElse(-1), 10);
    });
    test("findMaximum / findMinimum", () => {
        assert.equal(ST.useOf(10, 30, 20).toUnordered().findMaximum().orElse(-1), 30);
        assert.equal(ST.useOf(10, 30, 20).toUnordered().findMinimum().orElse(-1), 10);
        assert.equal(ST.useOf(10, 30, 20).toUnordered().findMaximum((a, b) => b - a).orElse(-1), 10);
    });
    test("空流返回空 Optional 而不是抛错", () => {
        assert.equal(ST.useEmpty().toUnordered().findFirst().isPresent(), false);
        assert.equal(ST.useEmpty().toUnordered().findMaximum().orElse(-1), -1);
    });
    test("findAt / findNegativeAt", () => {
        assert.equal(ST.useOf(10, 20, 30).toUnordered().findAt(1n).orElse(-1), 20);
        assert.equal(ST.useOf(10, 20, 30).toUnordered().findNegativeAt(-1n).orElse(-1), 30);
    });
    test("reduce 无初值以第一个元素作为初值", () => {
        assert.equal(ST.useOf(1, 2, 3).toUnordered().reduce((a, b) => a + b).orElse(-1), 6);
        assert.equal(ST.useEmpty().toUnordered().reduce((a, b) => a + b).isPresent(), false);
    });
    test("reduce 带初值与 finisher", () => {
        assert.equal(ST.useOf(1, 2, 3).toUnordered().reduce(10, (a, b) => a + b), 16);
        assert.equal(ST.useOf(1, 2, 3).toUnordered().reduce("", (a, b) => a + String(b), (text) => text.length), 3);
    });
});
describe("分区与切片（P0-5 / P0-6）", () => {
    test("partition 按索引轮转分桶", () => {
        assert.deepEqual(ST.useRange(0n, 9n).toUnordered().partition(3n), [[0n, 3n, 6n], [1n, 4n, 7n], [2n, 5n, 8n]]);
    });
    test("partitionBy 使用分类结果", () => {
        assert.deepEqual(ST.useRange(0n, 6n).toUnordered().partitionBy((_element, index) => index % 2n), [[0n, 2n, 4n], [1n, 3n, 5n]]);
    });
    test("sub 正常切片", () => {
        assert.deepEqual(ST.useOf(1, 2, 3, 4, 5).sub(1, 3).toUnordered().toArray(), [2, 3]);
        assert.deepEqual(ST.useOf(1, 2, 3, 4, 5).sub(0, 2).toUnordered().toArray(), [1, 2]);
    });
    test("limit / skip / takeWhile / dropWhile", () => {
        assert.deepEqual(ST.useOf(1, 2, 3, 4, 5).limit(2n).toUnordered().toArray(), [1, 2]);
        assert.deepEqual(ST.useOf(1, 2, 3, 4, 5).skip(2n).toUnordered().toArray(), [3, 4, 5]);
        assert.deepEqual(ST.useOf(1, 2, 3, 4, 1).takeWhile((n) => n < 3).toUnordered().toArray(), [1, 2]);
        assert.deepEqual(ST.useOf(1, 2, 3, 4, 1).dropWhile((n) => n < 3).toUnordered().toArray(), [3, 4, 1]);
    });
});
describe("工厂函数（P0-7 / P0-8 / P0-10 / P0-12）", () => {
    test("useText 单参数按 Unicode 码点切分", () => {
        assert.deepEqual(ST.useText("A😊B").toUnordered().toArray(), ["A", "😊", "B"]);
    });
    test("useText 分隔符切分保留全部片段与索引", () => {
        assert.deepEqual(ST.useText("a,b,c", ",").toUnordered().toArray(), ["a", "b", "c"]);
    });
    test("useText 区间切分", () => {
        assert.deepEqual(ST.useText("abcdef", 1, 3).toUnordered().toArray(), ["b", "c"]);
        assert.deepEqual(ST.useText("abcdef", 3).toUnordered().toArray(), ["d", "e", "f"]);
    });
    test("useStringify 支持循环引用", () => {
        const target = { a: 1, b: "text" };
        target.self = target;
        assert.equal(ST.useStringify(target), '{"a":1,"b":"text"}');
        assert.deepEqual(Object.keys(JSON.parse(ST.useStringify({ a: [1, 2], b: { c: 3 } }))), ["a", "b"]);
    });
    test("useStringify 支持自定义序列化回调", () => {
        const text = ST.useStringify({ a: 1 }, (_key, value) => String(value));
        assert.equal(text, '{"a":"1"}');
    });
    test("useRandom 大整数区间可终止且落在范围内", () => {
        for (let i = 0; i < 50; i++) {
            const value = ST.useRandom(1n, 10n);
            assert.ok(value >= 1n && value <= 10n, `越界: ${value}`);
        }
        assert.equal(ST.useRandom(5n, 5n), 5n);
        assert.ok(ST.useRandom(100n) < 100n);
    });
    test("P0-8 useRandom 大整数分布不退化", () => {
        const seen = new Set();
        for (let i = 0; i < 300; i++) {
            seen.add(String(ST.useRandom(2n, 12n)));
        }
        assert.ok(seen.size >= 8, `分布退化，仅出现 ${seen.size} 种取值`);
    });
    test("useGenerate 的 interrupt 参数生效", () => {
        const generated = ST.useGenerate(() => 7, (_element, index) => index >= 3n);
        assert.deepEqual(generated.toUnordered().toArray(), [7, 7, 7]);
    });
    test("useAttribute 遍历对象属性", () => {
        const attributes = ST.useAttribute({ a: 1, b: { c: 2 } }).toUnordered().toArray();
        assert.deepEqual(attributes.map((entry) => `${String(entry.key)}=${String(entry.value)}`), ["a=1", "c=2"]);
    });
    test("useHash 稳定且可区分不同输入", () => {
        assert.equal(ST.useHash("abc"), ST.useHash("abc"));
        assert.notEqual(ST.useHash("abc"), ST.useHash("abd"));
        assert.equal(ST.useHash({ a: 1 }), ST.useHash({ a: 1 }));
    });
    test("useCompare 同类型比较", () => {
        assert.ok(ST.useCompare(1, 2) < 0);
        assert.ok(ST.useCompare("b", "a") > 0);
        assert.equal(ST.useCompare(3, 3), 0);
        assert.throws(() => ST.useCompare(1, "1"));
    });
});
describe("统计", () => {
    test("数值统计基础量", () => {
        const statistics = ST.useOf(1, 2, 3, 4).toNumericStatistics();
        assert.equal(statistics.summate(), 10);
        assert.equal(statistics.average(), 2.5);
        assert.equal(statistics.mean(), 2.5);
        assert.equal(statistics.median(), 2.5);
        assert.equal(statistics.variance(), 1.25);
        assert.equal(Math.round(statistics.standardDeviation() * 1000) / 1000, 1.118);
        assert.equal(statistics.skewness(), 0);
        assert.equal(statistics.range(), 3);
        assert.equal(statistics.interquartileRange(), 2);
    });
    test("P0-11 峰度使用 n 而不是 n^2", () => {
        assert.equal(Math.round(ST.useOf(1, 2, 3, 4).toNumericStatistics().kurtosis() * 100) / 100, -1.36);
    });
    test("mode / frequency", () => {
        const statistics = ST.useOf(1, 2, 2, 3, 3, 3).toNumericStatistics();
        assert.equal(statistics.mode(), 3);
        assert.deepEqual([...statistics.frequency()].map(([key, value]) => `${key}:${value}`), ["1:1", "2:2", "3:3"]);
    });
    test("P0-11 大整数统计不再抛错", () => {
        const statistics = ST.useOf(1n, 2n, 3n, 4n).toBigintStatistics();
        assert.equal(statistics.summate(), 10n);
        assert.equal(statistics.average(), 2n);
        assert.equal(statistics.median(), 2n);
        assert.equal(statistics.variance(), 1n);
        assert.equal(statistics.standardDeviation(), 1n);
        assert.equal(statistics.skewness(), 0n);
        assert.equal(statistics.kurtosis(), -1n);
        assert.equal(statistics.range(), 3n);
    });
    test("空流统计返回 0", () => {
        assert.equal(ST.useEmpty().toNumericStatistics().summate(), 0);
        assert.equal(ST.useEmpty().toBigintStatistics().average(), 0n);
    });
});
describe("惰性与终止操作", () => {
    test("百万区间上 filter + limit 立即返回", () => {
        const result = ST.useRange(0n, 1000000n).filter((n) => n % 17n === 0n).limit(10n).toUnordered().toArray();
        assert.equal(result.length, 10);
        assert.equal(String(result[0]), "0");
        assert.equal(String(result[9]), "153");
    });
    test("终止操作", () => {
        const stream = () => ST.useOf(1, 2, 3).toUnordered();
        assert.equal(stream().count(), 3n);
        assert.equal(stream().isEmpty(), false);
        assert.equal(stream().anyMatch((n) => n > 2), true);
        assert.equal(stream().allMatch((n) => n > 0), true);
        assert.equal(stream().nonMatch((n) => n > 5), true);
        assert.equal(stream().join(","), "[1,2,3]");
        assert.deepEqual([...stream()], [1, 2, 3]);
        assert.deepEqual([...stream().toSet()], [1, 2, 3]);
        assert.deepEqual([...stream().group((n) => n % 2).keys()], [1, 0]);
    });
    test("收集器可重复消费", () => {
        const collectable = ST.useOf(1, 2, 3).toOrdered();
        assert.deepEqual(collectable.toArray(), [1, 2, 3]);
        assert.deepEqual(collectable.toArray(), [1, 2, 3]);
    });
    test("concat / distinct / flatMap", () => {
        assert.deepEqual(ST.useOf(1, 2).concat([3, 4]).toUnordered().toArray(), [1, 2, 3, 4]);
        assert.deepEqual(ST.useOf(1, 1, 2).distinct().toUnordered().toArray(), [1, 2]);
        assert.deepEqual(ST.useOf(1, 2).flatMap((n) => [n, n * 10]).toUnordered().toArray(), [1, 10, 2, 20]);
    });
});
describe("窗口（README Core Concepts 中的 toWindow）", () => {
    const flatten = (semantics) => semantics.map((semantic) => semantic.toUnordered().toArray());
    test("tumble 按固定大小切分", () => {
        const windows = ST.useOf(1, 2, 3, 4, 5).toWindow().tumble(2n).toUnordered().toArray();
        assert.deepEqual(flatten(windows), [[1, 2], [3, 4], [5]]);
    });
    test("slide 按步长滑动切分", () => {
        const windows = ST.useOf(1, 2, 3, 4, 5).toWindow().slide(3n, 1n).toUnordered().toArray();
        assert.deepEqual(flatten(windows), [[1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5], [5]]);
    });
    test("异步流同样支持窗口", async () => {
        async function* generator() {
            yield 1;
            yield 2;
            yield 3;
        }
        const windows = await ST.useFrom(generator()).toWindow().tumble(2n).toUnordered().toArray();
        const contents = [];
        for (const window of windows) {
            contents.push(await window.toUnordered().toArray());
        }
        assert.deepEqual(contents, [[1, 2], [3]]);
    });
});
describe("Optional", () => {
    test("基础语义", () => {
        assert.equal(ST.Optional.of(0).isPresent(), true);
        assert.equal(ST.Optional.of(null).isPresent(), false);
        assert.equal(ST.Optional.ofNullable(undefined).orElse(5), 5);
        assert.equal(ST.Optional.of(1).map((n) => n + 1).get(), 2);
        assert.equal(ST.Optional.ofNullable(null).flatMap(() => ST.Optional.of(1)).isPresent(), false);
        assert.equal(ST.Optional.of(2).filter((n) => n > 1).get(), 2);
        assert.equal(ST.Optional.of(1).filter((n) => n > 1).isPresent(), false);
        assert.deepEqual(ST.Optional.of(3).semantic().toUnordered().toArray(), [3]);
    });
});
describe("异步链路（P0-3 / P0-13）", () => {
    const asyncGenerator = async function* () {
        yield 10n;
        yield 20n;
        yield 30n;
    };
    test("usePromise：有序 / 统计 / 计数全部可用", async () => {
        assert.deepEqual(await ST.usePromise(Promise.resolve(7)).toUnordered().toArray(), [7]);
        assert.deepEqual(await ST.usePromise(Promise.resolve(7)).toOrdered().toArray(), [7]);
        assert.equal(await ST.usePromise(Promise.resolve(7)).toNumericStatistics().summate(), 7);
        assert.equal(await ST.usePromise(Promise.resolve(7)).toOrdered().count(), 1n);
        assert.equal(await ST.usePromise(Promise.resolve(7)).toOrdered().isEmpty(), false);
    });
    test("useFrom(AsyncIterable) 返回异步语义并可完整消费", async () => {
        const result = await ST.useFrom(asyncGenerator()).map((n) => n * 2n).filter((n) => n > 10n).limit(5n).toUnordered().toArray();
        assert.deepEqual(result, [20n, 40n, 60n]);
        assert.equal(await ST.useFrom(asyncGenerator()).toBigintStatistics().summate(), 60n);
    });
    test("useIterate 消费完整异步迭代器", async () => {
        assert.deepEqual(await ST.useIterate(asyncGenerator()).toUnordered().toArray(), [10n, 20n, 30n]);
    });
    test("useInterval 返回异步语义且不泄漏越界元素", async () => {
        const ticks = await ST.useInterval(1, 0).limit(3n).toUnordered().toArray();
        assert.deepEqual(ticks, [0, 1, 2]);
    });
    test("useBlob 分块互不别名", async () => {
        const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])]);
        const chunks = await ST.useBlob(blob, 4n).toUnordered().toArray();
        assert.deepEqual(chunks.map((chunk) => Array.from(chunk)), [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]);
        assert.notEqual(chunks[0], chunks[1]);
    });
    test("useBlob 处理不整除的尾块", async () => {
        const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);
        const chunks = await ST.useBlob(blob, 4n).toUnordered().toArray();
        assert.deepEqual(chunks.map((chunk) => Array.from(chunk)), [[1, 2, 3, 4], [5]]);
    });
    test("异步有序收集器支持查找与顺序", async () => {
        const ordered = ST.useFrom(asyncGenerator()).reverse().toOrdered();
        assert.deepEqual(await ordered.toArray(), [30n, 20n, 10n]);
        assert.equal(await ordered.findFirst(), 30n);
        assert.equal(await ordered.findLast(), 10n);
        assert.equal(await ordered.findMaximum(), 30n);
        assert.equal(await ordered.findMinimum(), 10n);
        assert.equal(await ordered.findNegativeAt(-1n), 10n);
        const plain = ST.useFrom(asyncGenerator()).toOrdered();
        assert.equal(await plain.findAt(1n), 20n);
        assert.equal(await ordered.findAt(1n), 20n);
        assert.equal(await ordered.findAt(0n), 30n);
    });
    test("useSubscription 在边界处自动退订一次", async () => {
        let subscribed = 0;
        let unsubscribed = 0;
        let handler = null;
        const subscriber = () => ({
            mount: () => { },
            unmount: () => { },
            subscribe: (_key, callback) => {
                subscribed++;
                handler = callback;
            },
            unsubscribe: () => {
                unsubscribed++;
            }
        });
        const collectable = ST.useSubscription({ id: "target" }, subscriber, "resize").limit(3n).toUnordered();
        for (let i = 0; i < 5; i++) {
            handler({ type: "resize", i });
        }
        assert.equal((await collectable.toArray()).length, 3);
        assert.equal(subscribed, 1);
        assert.equal(unsubscribed, 1);
    });
    test("异步 reduce / 分组 / 终结操作", async () => {
        assert.equal(await ST.useFrom(asyncGenerator()).toUnordered().reduce((a, b) => a + b), 60n);
        assert.equal(await ST.useFrom(asyncGenerator()).toUnordered().count(), 3n);
        const groups = await ST.useFrom(asyncGenerator()).toUnordered().group((n) => (n > 10n ? "big" : "small"));
        assert.deepEqual(groups.get("big"), [20n, 30n]);
    });
});
