# **Semantic-TypeScript**

**流式，索引化。** 数据尽在精准掌控。

[English](./readme.md) · 简体中文 · [繁體中文](./readme.tw.md) · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

一个类型安全的流处理库，统一了 **JavaScript generators**、**Java Stream** 与**基于索引的数据寻址**。每个元素都携带一个 `bigint` 索引，每条管道都是惰性的，而每个终止操作都是显式选择（opt-in）。

```bash
npm install semantic-typescript
```

- 零运行时依赖，纯 ESM，自带类型定义。
- 684 个回归测试：`npm test`。
- 完整变更历史：[CHANGELOG.md](./CHANGELOG.md)。

---

## 目录

1. [设计哲学](#1-design-philosophy)
2. [架构](#2-architecture)
3. [快速开始](#3-quick-start)
4. [工厂函数](#4-factory-functions)
5. [转换操作符](#5-transformation-operators)
6. [可收集对象与终止操作](#6-collectables-and-terminal-operations)
7. [统计与窗口](#7-statistics-and-windows)
8. [索引模型](#8-the-index-model)
9. [异步模型](#9-the-asynchronous-model)
10. [周期分析：环、场与得分](#10-periodic-analysis-rings-fields-and-scores)
11. [工具辅助函数](#11-utility-helpers)
12. [性能与陷阱](#12-performance-and-pitfalls)
13. [相位环：一个精确的循环](#13-phase-rings)
14. [信号分析：窗、频谱与时间](#14-signal-analysis)
15. [许可证](#15-license)

---

<a id="1-design-philosophy"></a>
## 1. 设计哲学

三个理念，一条管道：

**索引即数据。** 每个元素都由一个 `bigint` 寻址。反转、旋转、洗牌与分区都是索引运算，而非缓冲区操作。在某个可收集对象索取之前，什么都不会被物化。

**惰性是默认。** 工厂包裹一个 generator；操作符包裹另一个 generator。在终止操作运行之前不会请求任何元素，因此只要下游有东西能让它停下，无限源就完全合法。

**终止操作是显式的。** `map` 返回的是一个 `Semantic`，而非数组。只有当你显式指定一个可收集对象时，值才会出现——`toUnordered()`、`toOrdered()`、`toNumericStatistics()`、`toWindow()`——而每一个都说明了它付出什么代价、产出什么顺序。

同样的纪律也适用于这个库的数学部分。一个 `Complex`、一个 `Angle` 或一个 `Frequency` 都是不可变值，其不变量在构造时即被检查；`Optional` 取代了 `null`；而一个相位环会确切说明它容纳多少元素、周期是多少，以及它有多均衡。

---

<a id="2-architecture"></a>
## 2. 架构

```
factory  ──▶  Semantic  ──▶  Semantic  ──▶  Collectable  ──▶  result
 (source)      (map)         (filter)        (terminal)
                    ▲
                    └── every operator returns a new Semantic wrapping a generator
```

| 层 | 模块 | 职责 |
| :--- | :--- | :--- |
| 源 | `synchronous/collectors`, `asynchronous/collectors` | 包裹一个可迭代对象、一个 generator、一个 promise、一个 blob、一个事件目标 |
| 管道 | `synchronous/semantic`, `asynchronous/semantic` | 惰性操作符与索引重写 |
| 可收集对象 | `synchronous/semantic`, `asynchronous/semantic` | 有序、无序、统计、窗口与自定义终止操作 |
| 收集器 | `synchronous/collector`, `asynchronous/collector` | 每个终止操作都由其构建的折叠原语 |
| 数学 | `mathematics/*` | 角、复数、频率、频谱、窗口、估计量、本轮、相位环 |
| 结构 | `structure/*` | 列表、集合、映射、树、森林、环、场 |
| 错误 | `structure/error` | 类型化的 `SemanticError` 层级及其品牌守卫 |

同步与异步两个家族共享同一套词汇：相同的操作符名称、相同的索引语义、相同的可收集对象。异步变体只是返回 promise，并且会把写入排队，使得在写入之后发出的读取总能观察到它。

### 2.1 本次发布移动了什么、破坏了什么

有三个模块改变了位置或形态，另有一组默认值的含义发生了变化。每一种旧行为都仍可通过显式选项抵达；没有任何东西在没有替代品的情况下被移除。

| 变更 | 之前 | 现在 |
| :--- | :--- | :--- |
| 森林 | `structure/tree/rootedForest`、`structure/tree/unionFindForest` | `structure/forest/rootedForest`、`structure/forest/unionFindForest`；`tree/index.ts` 不再重新导出它们 |
| 错误 | 临时的原生错误 | `structure/error.ts` 中的十五类层级，每类各带一个品牌守卫，另有 `SemanticRangeError` 别名 |
| 估计量选项 | 固定定义 | `mathematics/quantile.ts` 导出 `QuantileMethod`、`QuantileOptions`、`SkewnessEstimator`、`KurtosisEstimator` 与 `VarianceOptions` |
| `quantile` | Hyndman–Fan 类型 1 | 类型 7 —— R `quantile`、NumPy `linear`、Excel `PERCENTILE.INC` |
| `skewness` / `kurtosis` | `g1` / `g2` | 偏差校正的 `G1` / `G2` |
| `variance` / `standardDeviation` | `ddof = 0` | `ddof = 1`，并以 `Optional` 包装 |
| `decibel` | 一个 `20·log10` 函数 | 已移除；改为 `amplitudeDecibel`（20·log10）与 `powerDecibel`（10·log10） |
| `Spectrum.flatness()` | 两半的幅度 | 单边半的功率 |
| `Spectrum.bandEnergy()` | 原始双边求和 | 默认单边，并折叠共轭半边 |
| `shortTimeFourierTransform` / `spectrogram` | 对称 Hann、仅完整帧 | 周期 Hann、`boundary: "zeros"`、`padded: true` |

第 6、7、10 章记录了这些替代品；实测影响见 [CHANGELOG.md](./CHANGELOG.md)。

---

<a id="3-quick-start"></a>
## 3. 快速开始

```typescript
import {
  useOf, useFrom, useRange, useText, useStringify, usePromise
} from "semantic-typescript";

// Numeric aggregation
const sum: number = useOf(10, 20, 30, 40)
  .map(n => n * 2)
  .toNumericStatistics()
  .summate();                                   // 200

// BigInt aggregation
const bigSum: bigint = useOf(10n, 20n, 30n, 40n)
  .map(n => n * 2n)
  .toBigintStatistics()
  .summate();                                   // 200n

// Reordering is index arithmetic — collect with toOrdered() for it to take effect
const reversed: number[] = useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();      // [5,4,3,2,1]
const rotated: number[]  = useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();   // [4,5,1,2,3]

// Lazy evaluation over a large range
const multiples: bigint[] = useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)
  .limit(10n)
  .toUnordered()
  .toArray();                                   // [0n,17n,…,153n]

// Unicode-safe string processing (code points, not UTF-16 units)
useText("semantic 👍").toUnordered().forEach(character => console.log(character));

// Circular-safe serialisation
const cyclic: any = { a: 1 }; cyclic.self = cyclic;
useStringify(cyclic);                           // '{"a":1}'

// Terminals hand the elements to real structures, not only to arrays
useOf(3, 1, 4, 1, 5).toCollectable().toOrderedSet().toArray();          // [1,3,4,5]
useFrom([3, 1, 4, 1, 5]).toCollectable().toBinarySearchTree().size();   // 5n

// Async sources
const total = await usePromise(Promise.resolve(7)).toNumericStatistics().summate();       // 7
```

---

<a id="4-factory-functions"></a>
## 4. 工厂函数

构造始终是 O(1)——工厂只包裹一个 generator。下表说明*消费* `n` 个元素的代价，以及源自身所需的额外空间。

| 工厂 | 签名（结果） | 时间（消费 n） | 空间（源） | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | 索引为 0..n−1；展开参数在调用前已被物化 |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | 包裹任意可迭代对象；收集时迭代一次 |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` 为开区间；`step` 必须非零；`number` 与 `bigint` 均可 |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | 每个元素调用一次 supplier |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | `concat` 的单位元 |
| `useText` | `useText(text, delimiter?)` | O(n) | 文本本身占 O(n) | 按**码点（code point）**迭代，因此 emoji 与 CJK 字符保持为单个元素 |
| `useAttribute` | `useAttribute<T>(object)` | O(v + e) | O(d + v) | 递归遍历嵌套对象，并带环保护 |
| `useGenerate` | `useGenerate<E>(supplier, interrupt)` | O(n) × supplier 代价 | O(1) | **必须**带一个用于停止的 `interrupt`，或下游的 `limit` |
| `useIterate` | `useIterate<E>(Iterable<E>)` / `(AsyncIterable<E>)` | 每次收集 O(n) | O(1) | 每次收集时重放迭代器 |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period（真实时间） | O(1) | 发出经过的时间 |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | 位于索引 `0n` 的单个元素 |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob 大小) | 每份副本 O(chunk) | 默认分块为 64 KiB |
| `useSubscription` | `useSubscription(target, subscriber, event) → AsynchronousSemantic<Event>` | 每个事件一个元素 | O(1) | `limit()` / `takeWhile()` 定义退订边界 |

```typescript
useOf(1, 2, 3).toUnordered().toArray();                       // [1,2,3]
useFrom(new Set([1, 2, 2])).toUnordered().toArray();          // [1,2]
useRange(0, 5).toUnordered().toArray();                       // [0,1,2,3,4]
useRange(10n, 0n, -5n).toUnordered().toArray();               // [10n,5n]
useFill("x", 3n).toUnordered().toArray();                     // ["x","x","x"]
useText("A😊B").toUnordered().toArray();                      // ["A","😊","B"]
useGenerate(() => 7, (_e, index) => index >= 3n).toUnordered().toArray();   // [7,7,7]
```

---

<a id="5-transformation-operators"></a>
## 5. 转换操作符

每个操作符都返回一个新的 `Semantic`；在可收集对象运行之前，它们都不会触碰任何元素。时间是**每个元素**的额外开销；空间是操作符在管道运行期间保留的部分。

| 操作符 | 用途 | 索引效果 | 时间 | 空间 |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | 1:1 转换 | 转发 | O(1) | O(1) |
| `filter(predicate)` | 保留匹配的元素 | 转发 | O(1) | O(1) |
| `flat(mapper)` / `flatMap(mapper)` | 1:N 扁平化 | 从 0 重新索引 | 每次发出 O(1) | O(1) |
| `distinct(keyExtractor?)` | 丢弃重复键，保留首个 | 转发 | 平均 O(1) | O(n) |
| `peek(consumer)` | 副作用，元素原样通过 | 转发 | O(1) | O(1) |
| `limit(count)` | 取前 *n* 个 | 从 0 重新索引 | O(1) | O(1) |
| `skip(count)` | 丢弃前 *n* 个 | 转发 | O(1) | O(1) |
| `sub(start, end)` | 按位置的切片 `[start, end)` | 转发 | O(1) | O(1) |
| `takeWhile(predicate)` | 谓词成立时持续取用 | 转发 | O(1) | O(1) |
| `dropWhile(predicate)` | 谓词成立时持续丢弃 | 从 0 重新索引 | O(1) | O(1) |
| `concat(other)` | 追加一个语义对象或可迭代对象 | 延续索引 | O(1) | O(1) |
| `redirect(redirector)` | 按你的意愿计算新索引 | **由你决定** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | 取负并平移 | O(1) | O(1) |
| `translate(offset \| mapper)` | 平移每个索引 | `i + offset` | O(1) | O(1) |
| `shuffle(mapper?)` | 随机化索引 | 随机 | O(1) | O(1) |
| `pipe(conversion)` | 把 generator 交给自定义函数 | 由你决定 | 由你 | 由你 |
| `semantic()` | 将可收集对象提升回语义对象 | 不变 | O(1) | O(1) |

**`reverse`、`translate` 与 `shuffle` 只重写索引。** 在 `toOrdered()` 按元素数量对索引取模归一化之前，不会缓冲或旋转任何内容：

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

---

<a id="6-collectables-and-terminal-operations"></a>
## 6. 可收集对象与终止操作

### 6.1 可收集对象

可收集对象同时掌管**顺序**与**索引记账**。`n` 为元素数量。

| 可收集对象 | 结构 | 时间 | 顺序 | 使用场景 |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | 以索引为键的 `Map<bigint, E>` | O(n) | 插入顺序 | 吞吐最大；原始索引原样保留，不被改写 |
| `toOrdered()` | 按元素索引排序的数组 | O(n log n) | 按归一化索引 | 反转/旋转必须生效时 |
| `toOrdered(comparator)` | 按你的比较器排序 | O(n log n) | 按你的比较器 | 排序视图 |
| `toNumericStatistics()` | 按值排序的缓冲区 | O(n log n) | 按值 | 对 `number` 做统计 |
| `toBigintStatistics()` | 按值排序的缓冲区 | O(n log n) | 按值 | 对 `bigint` 做统计 |
| `toWindow()` | 按值排序的缓冲区 | O(n log n) | 按值 | `slide` / `tumble` |
| `toCollectable(mapper)` | mapper 返回的任何内容 | — | — | 自定义可收集对象 |

### 6.2 终止操作

每个终止操作都活在**可收集对象**上，而不是 `Semantic` 上。这正是「终止操作是显式的」在实践中的含义：在指定一个可收集对象之前，管道不产生任何东西，而不带 mapper 的 `toCollectable()` 就是最便宜的指定方式。

| 终止操作 | 返回 | 时间 | 说明 |
| :--- | :--- | :--- | :--- |
| `toArray()` / `toSet()` | `Array<E>` / `Set<E>` | O(n) | 排空缓冲区；`toSet` 按标识去重 |
| `toMap(key, value?)` | `Map<K, V>` | 平均 O(n) | 后写覆盖 |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | 缓冲区本就知道 |
| `forEach(action)` | `void` | O(n) | `action(element, index)` |
| `join(…)` | `string` | O(n) | `join()`、`join(delimiter)`、`join(prefix, delimiter, suffix)` |
| `reduce(…)` | `Optional<E>` / `E` / `R` | O(n) | 空流 → 空 `Optional` |
| `group(classifier)` / `groupBy(key, value)` | `Map<K, E[]>` | 平均 O(n) | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | 按索引轮询分配 |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | 桶编号来自分类器 |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) 最坏，可短路 | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | 按物化顺序定位 |
| `findAt(k)` / `findNegativeAt(k)` | `Optional<E>` | O(k) / O(n−k) | 自前端 / 自末端计数 |
| `findMaximum(cmp?)` / `findMinimum(cmp?)` | `Optional<E>` | O(n) | 默认为结构性比较 |
| `frequency()` | `Map<E, bigint>` | 平均 O(n) | 仅统计类可收集对象 |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | 类 IO 的终止操作 |
| `collect(collector)` | `R` | O(n) | 上述每个终止操作背后的通用折叠 |

### 6.3 结构收集器

`toArray`、`toSet` 与 `toMap` 把管道终结在 JavaScript 容器里。另有十二个终止操作把它终结在库自有的某个结构中，于是结果携带的是那个结构所保证的不变量，而不是数组恰好具有的那些。它们在每个可收集对象上都可用，包括 `toCollectable()` 给出的那个裸收集对象。

| 终止操作 | 返回 | 顺序 | 代价 |
| :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | 遍历顺序 | O(n) |
| `toSet()` | `Set<E>` | 插入顺序，SameValueZero | 平均 O(n) |
| `toMap(key, value?)` | `Map<K, V>` | 插入顺序；后写覆盖 | 平均 O(n) |
| `toOrderedSet(comparator?)` | `SynchronousOrderedSet<E>` | 按比较器升序 | 最坏 O(n²) |
| `toUnorderedSet()` | `SynchronousUnorderedSet<E>` | 未指定（哈希桶） | 期望 O(n) |
| `toOrderedMap(key, value?)` | `SynchronousOrderedMap<K, V>` | 插入顺序；后写覆盖 | 期望 O(n) |
| `toUnorderedMap(key, value?)` | `SynchronousUnorderedMap<K, V>` | 未指定 | 期望 O(n) |
| `toList()` | `SynchronousList<E>` | 遍历顺序，保留重复 | O(n) |
| `toRing(span?)` | `SynchronousRing<E>` | 遍历顺序决定环上位置 | O(n) |
| `toLRUSet(capacity)` | `SynchronousUnorderedLRUSet<E>` | 按最近使用；只留最后 `capacity` 个 | 最坏 O(n²) |
| `toLRUMap(capacity, key, value?)` | `SynchronousUnorderedLRUMap<K, V>` | 按最近使用 | 期望 O(n) |
| `toSkipSet(comparator?)` | `SynchronousSkipSet<E>` | 按比较器升序，可导航 | 最坏 O(n²) |
| `toSkipMap(key, value?)` | `SynchronousSkipMap<K, V>` | 按键比较器，可导航 | 期望 O(n) |
| `toBinarySearchTree(comparator?)` | `SynchronousBinarySearchTree<E>` | 按比较器升序，高度平衡 | O(n log n) |
| `toRootedForest()` | `SynchronousRootedForest<E>` | 遍历顺序即结构顺序 | O(n) |

结果类型跟随可收集对象自身的元素类型，因此没有任何终止操作需要类型参数：一个 `SynchronousCollectable<E>` 直接交给你 `Array<E>`、`SynchronousList<E>` 或 `SynchronousOrderedSet<E>`。剩下的只有业务参数——`toOrderedSet` / `toSkipSet` / `toBinarySearchTree` 的比较器、LRU 对的容量、`toRing` 的跨度，以及映射族的键与值提取器。

一个环是集合，因此重复元素只保留首次出现的位置；上述其余结构除非自身契约另有规定，否则都保留重复（`toOrderedSet`、`toUnorderedSet`、`toSkipSet` 是集合；`toBinarySearchTree` 与 `toList` 不是）。

```typescript
const numbers = useOf(3, 1, 4, 1, 5).toCollectable();

numbers.toOrderedSet().toArray();                        // [1,3,4,5]
numbers.toUnorderedSet().size();                         // 4n — the duplicate 1 collapses
numbers.toList().toArray();                              // [3,1,4,1,5]
numbers.toSkipSet().first().get();                       // 1 — navigable by comparator
numbers.toBinarySearchTree().size();                     // 5n — duplicates retained
numbers.toRootedForest().getRoots().length;              // 1
useOf(1, 2, 3).toCollectable().toRing().phaseAt(3n).get().toDegreeValue();      // 0
useOf(3, 1, 3).toCollectable().toOrderedMap(n => n, n => `v${n}`).get(3).get();  // "v3"
```

异步可收集对象暴露同一批终止操作，并把每一个都解析进 promise，因此调用形式只多了一个 `await`。

---

<a id="7-statistics-and-windows"></a>
## 7. 统计与窗口

### 7.1 统计接口

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();                    // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();                    // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();                     // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                       // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance().get();             // 3.2    (n − 1)
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation().get();    // 1.7889 (n − 1)
```

两族统计都暴露同一套接口——`summate`、`average`、`median`、`mode`、`variance`、`standardDeviation`、`frequency`、`findMaximum`、`findMinimum`——而 `toBigintStatistics()` 使用 `bigint` 运算。离散度量与分位数一族返回 `Optional`，因为样本可能小到让它们无法定义；请用 `.get()`、`.orElse(…)` 或 `.isPresent()` 取出。

### 7.2 估计量与默认定义

这些默认值就是 R、NumPy、pandas 与 Excel 所使用的定义，因此这里算出的值可以直接与那些工具比对，无需任何修正因子。

| 统计量 | 默认 | 旧默认 | 恢复旧值的方式 |
| :--- | :--- | :--- | :--- |
| `quantile(probability)` | Hyndman–Fan 类型 7 | 类型 1 | `{ method: "type-1" }` |
| `interquartileRange()` | Hyndman–Fan 类型 7 | 类型 1 | `{ method: "type-1" }` |
| `skewness()` | 偏差校正的 `G1` | `g1` | `{ estimator: "g1" }` |
| `kurtosis()` | 偏差校正的超额 `G2` | `g2` | `{ estimator: "g2" }` |
| `variance()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |
| `standardDeviation()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |

九种 Hyndman–Fan 类型均可写为 `"type-1"` … `"type-9"`，而 `{ excess: false }` 会把三加回峰度，报告非超额的四阶标准化矩。这些选项类型——`QuantileMethod`、`QuantileOptions`、`SkewnessEstimator`、`KurtosisEstimator`、`VarianceOptions`——由 `mathematics/quantile.ts` 导出。

```typescript
const sample = useOf(1, 2, 3, 4).toNumericStatistics();

sample.variance().get();                                // 1.6667  (5/3, ddof = 1)
sample.variance({ ddof: 0 }).get();                     // 1.25
sample.standardDeviation().get();                       // 1.2910
sample.skewness().get();                                // 0
sample.kurtosis().get();                                // -1.2    (G2)
sample.kurtosis({ estimator: "g2" }).get();             // -1.36
sample.kurtosis({ excess: false }).get();               // 1.8

const quartiles = useOf(1, 2, 3, 4, 5, 6, 7, 8).toNumericStatistics();
quartiles.quantile(0.75).get();                         // 6.25    (type 7)
quartiles.quantile(0.75, { method: "type-1" }).get();   // 6       (nearest rank)
quartiles.interquartileRange().get();                   // 3.5
```

`G1` 与 `G2` 分别在少于三个、四个观测时无定义；在 `ddof = 1` 下，样本方差与标准差在少于两个观测时无定义。此时库返回空 `Optional`，而不是一个误导性的零：

```typescript
useOf(1, 2, 3).toNumericStatistics().kurtosis().isEmpty();     // true  (G2 needs four observations)
useOf(1, 2).toNumericStatistics().skewness().isEmpty();        // true  (G1 needs three)
useOf(1).toNumericStatistics().variance().isEmpty();           // true  (ddof = 1 needs two)
useOf(1).toNumericStatistics().variance({ ddof: 0 }).get();    // 0
```

bigint 视图接受相同的选项，并把每个结果四舍五入回整数 `bigint`。

### 7.3 窗口

窗口把缓冲区中的元素重新暴露为「管道的管道」，因此一个窗口无需先物化成数组就能被消费。两种形式都包含最后一个不完整的窗口。

```typescript
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[2,3],[3,4],[4]]

useFrom([1, 2, 3, 4]).toWindow().tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[3,4]]
```

---

<a id="8-the-index-model"></a>
## 8. 索引模型

索引是附加在每个元素上的一个 `bigint`。操作符要么**转发**它，要么从零**重新索引**，要么让你自行**计算**。

有序收集会把每个索引按元素数量取模归一化，再按结果排序。这就是为什么在五个元素上 `translate(7)` 等同于 `translate(2)`：`7 ≡ 2 (mod 5)`。

无序收集则保留管道所产生的任何索引，并按到达顺序返回元素。负索引是合法的，归一化后会自然排在非负索引之前。

---

<a id="9-the-asynchronous-model"></a>
## 9. 异步模型

`AsynchronousSemantic` 镜像同步侧的接口，但返回 promise。写入会被排队，因此在写入之后发出的读取总能观察到它。

```typescript
const ring = new AsynchronousRing([1, 2]);
const added   = ring.add(3);          // queued
const sampled = ring.elementAt(2n);   // observes the write above
await added;
(await sampled).get().element;         // 3
```

天生异步的工厂——`usePromise`、`useBlob`、`useInterval`、`useSubscription`——直接返回 `AsynchronousSemantic`，而 `useFrom` / `useIterate` 在收到 `AsyncIterable` 时会自动升级为异步。

---

<a id="10-periodic-analysis-rings-fields-and-scores"></a>
## 10. 周期分析：环、场与得分

这个库的数学部分把周期视为一等对象，而非查找表。三种构造协同工作。

### 10.1 环就是一个整数

一个 `Ring` 是一个 **n 重环**：元素数量、位置周期与不同相位的数量都是同一个整数 `n`。一个位置的相位由其精确余数算出，因此这个环的周期性精确到比特：

```typescript
import { SynchronousRing } from "semantic-typescript";

const ring = new SynchronousRing(["a", "b", "c", "d", "e", "f"]);
ring.phaseAt(0n).get().toDegreeValue();   // 0
ring.phaseAt(1n).get().toDegreeValue();   // 60
ring.phaseAt(6n).get().getValue() === ring.phaseAt(0n).get().getValue();   // true, exactly
ring.purity();                             // 1
ring.isBalanced();                         // true
ring.sequences().map(z => z.magnitude());  // [0, 6, 0, 0, 0, 0]
```

`frequency` 是**环境**的旋转速率，而不是位置之间的相位步长：环境把每个相量都移动同一个角度，因此它永远不会破坏内在图样。`span` 决定这个环占据多少圈。

`purity()` 是基模所携带的能量占比，即 `max(|c₁|², |c_{n−1}|²) / (n · Σ|z|²)`。当这个环在旋转意义下恰好是 `n` 次单位根时，它恰为 `1`；其代价是 `O(n)`，因为只需要两个频格。两个方向都会被检查，因为环可以沿任一方向绕行圆周。

### 10.2 场是一个有界的得分

一个 `PhaseField` 把相对相位映射为 `[-1, 1]` 区间内的得分：

```typescript
import { useField, useRadian } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ): +1 aligned, −1 opposed
const mixed  = useField([0.4, 0.3, 0.3]);  // first three harmonics

cosine.sample(useRadian(0));               //  1
cosine.sample(useRadian(Math.PI));         // -1
```

得分是一个截断的余弦级数 `a₀ + Σ wₘ·cos(2πmΔ)`，构造函数强制满足 `|a₀| + Σ|wₘ| ≤ 1`。由三角不等式可知，得分永远不会离开 `[-1, 1]`——这个界是**构造的推论**，而不是事后施加的截断（clamp）。

之所以用级数而非查找表：一个 `n` 点表能精确复现自身的采样点，但其三角插值在采样点之间会过冲。一个五点的表若取得分 `[+1, +0.5, −1, −0.5, 0]`，其插值范围为 `[−1.0428, 1.0041]`，这已经违背了承诺。而有界级数不会。

### 10.3 分析把数据与每个元素对照度量

环上的每个元素都是一个参考相位。`analyse` 把每个观测定位回环上，并相对每个参考进行度量：

```typescript
const ring = new SynchronousRing(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                              // 5
report.missed;                               // 1  ('zz' is not on the ring)
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

每个参考行报告 `count`、平均相对相位 `mean` 与平均合向量长度（mean resultant length）`resultant`。有一条恒等式值得记住：**`resultant` 对每个参考都相同**，因为改变基线只是把所有相对相位旋转一个常数。每个参考之间不同的是计数与均值。

```typescript
const ring = new SynchronousRing(["a", "b", "c"]);
ring.scoresAt(0, cosine);                   // one score per position, in [-1, 1]
```

### 10.4 相关工具

| 调用 | 回答 | 代价 |
| :--- | :--- | :--- |
| `purity()` | 这个环仍然是 `n` 次单位根吗？ | O(n) |
| `resultant(t?)` | 当下的相量有多集中？ | O(n) |
| `analyse(data)` | 这份数据相对每个元素处于什么位置？ | O(n · m) |
| `toSpectrum()` | 把环看作频谱，波数位于频率轴 | O(n²) |
| `useAngularSpectrum(ring, instants, plan)` | 随时间展开的 `(ω, n)` 平面 | O(n² · frames) |

还有两个原语使这个模型更完整：`combineRings(a, b)` 按最小公倍数把两个环连接起来（这是一次拉回，而非乘积——无法共享同一时刻的配对直接缺席）；`rate()` 给每个元素它自己的固有频率，使环能够相对环境漂移。`jetAt`、`windingAt` 与 `errorIntegralAt` 暴露这种漂移的微分状态。

### 10.5 频谱窗

环的构造是分析接口的一半；另一半工作在采样信号上。它最常被复用的原语是窗函数，而这里的每一种形状都有两种形式。对称形式用 `count − 1` 去除帧长；周期（DFT-even）形式用 `count`，比一个完整周期少一个采样，因此在 DFT 所设想的周期延拓下，这个渐变是连续的。

```typescript
useHannWindow(1, 4);                                   // 0.75  symmetric
useHannPeriodicWindow(1, 4);                           // 0.5   periodic
coherentGain(useHannPeriodicWindow, 16);               // 0.5
equivalentNoiseBandwidth(useHannPeriodicWindow, 16);   // 1.5
```

| 形状 | 对称 | 周期 | 说明 |
| :--- | :--- | :--- | :--- |
| 矩形 | `useRectangularWindow` | — | 无渐变；没有周期之分 |
| Hann | `useHannWindow` | `useHannPeriodicWindow` | 短时变换的默认窗 |
| Hamming | `useHammingWindow` | `useHammingPeriodicWindow` | — |
| Blackman | `useBlackmanWindow` | `useBlackmanPeriodicWindow` | — |
| Nuttall | `useNuttallWindow` | `useNuttallPeriodicWindow` | 四项 Blackman–Harris |
| 平顶 | `useFlatTopWindow` | `useFlatTopPeriodicWindow` | 以分辨率换取幅度精度 |
| Kaiser | `useKaiserWindow(beta)` | `useKaiserPeriodicWindow(beta)` | `beta` 决定主瓣宽度 |

分析与重叠相加请用周期形式：在半帧跳距下，周期 Hann 窗在任何长度上都求和为 `1.000000`，而对称形式在 `N = 16` 时起伏 `0.841 dB`，到 `N = 1024` 仍有 `0.013 dB`。滤波器设计请保留对称形式，那里的帧并不是渐变的一个周期。

平顶窗在帧的两端返回**负权重**，因为平顶窗本来就是这样。它们原样返回而不被截断，因为截断会扰动主瓣、摧毁这个窗存在的唯一理由——低扇贝损失：

```typescript
useFlatTopWindow(0, 1024);                             // -0.000421 — negative by definition
Array.from({ length: 1024 }, (_unused, index) => useFlatTopWindow(index, 1024))
  .filter(weight => weight < 0).length;                // 578
```

### 10.6 电平、平坦度与频带能量

`decibel` 作为单一函数已不复存在，因为幅度与功率并不共享同一个因子。`amplitudeDecibel` 对类似电压的比值施加 `20·log10`；`powerDecibel` 对功率、能量、均方或功率谱密度施加 `10·log10`：

```typescript
amplitudeDecibel(0.25);                                // -12.0412
powerDecibel(0.25);                                    //  -6.0206
```

`Bin.decibel` 与 `Spectrum.decibelOf` 是幅度电平；`Spectrum.powerDecibelOf` 是对应的功率电平。把一个功率喂给幅度形式会报出 `20·log10(power)`，把分贝值翻倍。

有两项频谱测量改变了读法：

```typescript
const twoBins = new Spectrum(new Sample(2, 1), [new Complex(2, 0), new Complex(1, 0)]);
twoBins.flatness();                                    // 0.8 — geometric over arithmetic mean of power

const shape = new Spectrum(new Sample(4, 1), [
  new Complex(1, 0), new Complex(2, 0), new Complex(0, 0), new Complex(0, 0),
]);
shape.bandEnergy(new Frequency(0), new Frequency(2));                // 9
shape.bandEnergy(new Frequency(0), new Frequency(2), "two-sided");   // 5
```

`flatness()` 比较的是频谱单边半上 `power()` 的几何平均与算术平均，而不是两半上的幅度平均，并且刻意不施加 `oneSided()` 那个仅用于显示的幅度加倍。`bandEnergy()` 默认采用单边读法，折叠共轭半边，使 DC 与 Nyquist 各计一次、每个内部频格计两次；覆盖整个频带的频带由此满足 Parseval，即 `Σ|X|² = N·Σx²`。对复频谱请传 `"two-sided"`，它的频格本来就是独立的。

### 10.7 短时分析

`Sampler.shortTimeFourierTransform` 与 `Sampler.spectrogram` 遵循 SciPy `stft` 的约定：周期 Hann 窗、两端零填充边界，以及尾部零填充。

```typescript
const sampler = new Sampler(new Sample(64, 1));
const spectrogram = sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8);

spectrogram.size();                     // 9 frames
spectrogram.getBoundary();              // "zeros"
spectrogram.getTime(6);                 // 0.75 — frame centres, not frame starts
sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8, useHannWindow,
  { boundary: "none", padded: false }).size();                       // 7 — complete frames only
```

两端延拓把第一帧的中心对准第一个采样，尾部填充则让最后几个采样不再不可达：64 个采样、帧长 16、跳距 8 会产出 9 帧而不是 7 帧；1000 个采样、帧长 256、跳距 128 会产出 9 帧而不是 6 帧。帧时间是中心而非起点——有延拓的视图为 `(k·hop + (frameSize mod 2)/2)/rate`，无延拓的视图为 `(k·hop + frameSize/2)/rate`——而 `toFrame()` 在反变换前会裁掉延拓。

---

<a id="11-utility-helpers"></a>
## 11. 工具辅助函数

### 11.1 错误层级

`structure/error.ts` 导出一个十五类的层级，用于在管道**周围**抛出的错误——来自你自己的代码、自定义收集器或适配器：

```text
SemanticError
├── IllegalOperationError
├── ValidationError
│   ├── IndexError
│   ├── RangeError        (also exported as SemanticRangeError)
│   └── ConfigurationError
├── CapacityError
├── StateError
│   └── IllegalStateError
├── ConcurrencyError
├── CollectionError
├── SerializationError
├── NumericError
│   └── ArithmeticError
└── PhaseError
```

每个类固定 `name`、转发原生 `cause`、携带可选的 `context` 诊断包，并通过 `toJSON()` 序列化；每个类都有一个同名的品牌守卫。

```typescript
const error = new CapacityError("LRU capacity exhausted", { context: { capacity: 0 } });

error.name;                 // "CapacityError"
isCapacityError(error);     // true
isValidationError(error);   // false — a capacity failure is not a validation failure
isSemanticError(error);     // true
error.toJSON();             // { name: "CapacityError", message: "…", context: { capacity: 0 } }
```

`SemanticRangeError` 与导出的 `RangeError` 是同一个类，因此 `instanceof` 在两个名字之间都成立；而导入 `RangeError` 会在整个模块内遮蔽全局构造器，这正是该别名存在的原因。这两个类都不会被库自身的参数检查抛出——那里仍然抛原生的 `TypeError` 与 `RangeError`——这个层级是给上层使用的词汇表。

### 11.2 工具表

| 辅助函数 | 用途 |
| :--- | :--- |
| `useCompare(a, b)` | 跨混合基础类型的全序 |
| `useToNumber` / `useToBigInt` | 无损、带范围检查的数值转换 |
| `useRandom` | 带种子或不带种子的随机辅助 |
| `useTraverse` | 对嵌套对象与数组的结构化遍历 |
| `useStringify` | 抗循环引用的 JSON 序列化 |
| `useHash` / `maskOf` / `register` / `unregister` | 结构化哈希与哈希策略注册表 |
| `invalidate` / `validate` | 抛出统一错误形态的卫语句 |
| `Optional<T>` | 本库的 `null` 替代：`Optional.of(x)` / `Optional.empty()` |

### 11.3 `useTraverse`

`useTraverse(target, callback)` 把任意对象摊平成它的**非空叶子**。它下钻嵌套对象、按位置遍历可迭代值、跳过 `null` 与 `undefined`，并且永不重新进入已经访问过的对象——因此带环的对象图会终止，而不是撑爆调用栈。

```typescript
const source = { id: 7, tags: ["a", "b"], owner: { name: "Ada", note: null } };
const leaves: string[] = [];

useTraverse(source, (key, value, path) => {
  leaves.push(`${path.join(".")} = ${String(value)}`);
  return true;
});

leaves;   // ["id = 7", "tags.0 = a", "tags.1 = b", "owner.name = Ada"]
```

回调对每个叶子运行一次，收到叶子自身的键（叶子来自可迭代对象时是它的下标）、值，以及抵达它的路径。返回 `false` 会放弃**整次**遍历，而不只是当前分支：

```typescript
let visited = 0;
useTraverse({ a: 1, b: 2, c: 3 }, () => {
  visited += 1;
  return false;
});
visited;   // 1 — the first leaf already stops the walk
```

环之所以安全，原因相同：

```typescript
const cyclic: any = { name: "root", child: { name: "leaf" } };
cyclic.child.parent = cyclic;

const names: string[] = [];
useTraverse(cyclic, (_key, value) => {
  if (typeof value === "string") names.push(value);
  return true;
});
names;     // ["root", "leaf"] — the back edge to `cyclic` is not revisited
```

**每次回调都会拿到独立的路径快照。** 遍历内部只保留一个工作数组，在交出叶子的那一刻把它复制成一个用 `Object.freeze` 冻结的新数组。快照之后不再变化，因此可以原样留存；两个回调之间从不共享同一个数组，再次遍历也不会扰动已经发出的快照。它的类型是 `ReadonlyArray`，所以写入它是编译错误，而被冻结的数组在运行期写入还会抛 `TypeError`。这份安全性的代价是每个上报叶子多一次 `O(depth)` 的分配，而不会上报任何叶子的分支不产生额外分配。

```typescript
const paths: Array<ReadonlyArray<PropertyKey>> = [];
useTraverse({ a: { b: 1 }, c: 2 }, (_key, _value, path) => {
  paths.push(path);                      // safe to keep as-is
  return true;
});
paths[0] === paths[1];                   // false — one array per call
paths.map(path => path.join("."));       // ["a.b", "c"]
```

`useAttribute` 就是把这次遍历变成工厂：它以 `{ key, value }` 对的形式报告同样的叶子，因此规则与代价完全一致。

```typescript
useAttribute({ a: 1, b: { c: 2 } }).toUnordered().toArray();
// [{ key: "a", value: 1 }, { key: "c", value: 2 }]
```

---

<a id="12-performance-and-pitfalls"></a>
## 12. 性能与陷阱

**惰性在每一级都有代价。** 每个操作符都会增加一次 generator 跳转。对内存数组上的紧凑数值循环而言，普通的 `for` 循环会胜过任何管道；当源是惰性的、无限的，或管道足够长、让索引纪律的收益能够兑现时，管道才会胜出。

**`toOrdered()` 会排序；`toUnordered()` 不会。** 如果反转看起来“没有生效”，那是因为收集器是无序的——只有当索引被归一化时，索引重写才会成为顺序。

**不带 `interrupt` 的 `useGenerate` 永不结束。** 始终提供一个停止谓词，或下游的 `limit` / `takeWhile`。

**`Ring` 是一个保持插入顺序的集合。** 元素唯一，并保留各自首次加入时的顺序。重复的 `add` 返回 `false`，而会引入重复的 `set` 会抛出异常。这正是相位可以成为*元素*的函数、而非取决于它恰好占据哪个位置的原因。

**`Spectrum` 的单边辅助方法假定输入是实信号。** `oneSided()`、`getNyquist()` 与 `centroid()` 都假定共轭对称。相位环的空间频谱是复值的，且一般并不对称——一个反向绕行圆周的环会把全部能量放进频格 `n − 1`，越过 Nyquist。请直接读取频格。

**结构收集器是终止操作，不是视图。** 每一个都会先排空管道，再构建一个完整结构，因此它花费 O(n) 时间与 O(n) 空间，且不能在无限源上运行。请在管道末尾使用它们，绝不要在遍历管道的循环中使用。

**`variance()` 及其同伴返回 `Optional`。** 在过小的样本上调用 `variance().get()` 会抛出异常；当样本量不由你掌控时，请用 `.orElse(0)` 或先检查 `.isPresent()`。`standardDeviation`、`quantile`、`interquartileRange`、`skewness` 与 `kurtosis` 同理。

**周期窗才是分析用的窗。** `useHannWindow` 等对称形式用于滤波器设计；短时变换需要 `useHannPeriodicWindow` 及其同族，否则重叠相加的和会在帧与帧相接处起伏。

---

<a id="13-phase-rings"></a>
## 13. 相位环：一个精确的循环

第 10 章把环引介为库对"周期"的建模，并用它把一组数据对照每个相位来度量。本章给出完整接口：
位置如何变成角度、环境转速改变了什么又不改变什么，以及按时间、按数据、按另一个环来读取这个
环的那些工具。

`SynchronousRing` 是一个位置列表，底层是首尾相接的循环双向链表。它同时是一个按插入顺序的
*集合*：同一个元素不会出现两次，被拒绝的写入既不改动链接也不改动样本。让它成为环而不是普通
列表的，是位置的相位只由它对当前长度的余数决定，因此环逐位周期，平衡也不会漂移。

### 13.1 一个整数，精确计算

一个环带 `n` 个元素，而元素个数、位置周期与不同相位的个数是同一个整数。位置 `i` 的相位是

`phase + span · 2π · (((i mod n) + n) mod n) / n`

其中余数在变成 `number` 之前先在 `bigint` 里归约。正因如此，`phaseAt(i)` 与 `phaseAt(i + n)`
是*逐位相同*，而不只是接近：第二次调用归约到同一个整数，计算同一个乘积，得到同一个双精度值。
远超 `number` 精确整数范围的索引仍然落在正确位置，负索引则反向绕环。

| 调用 | 返回 | 含义 |
| :--- | :--- | :--- |
| `new SynchronousRing(source, options?)` | 环 | `source` 是任意可迭代对象，重复元素被丢弃 |
| `getPhase()` / `getFrequency()` / `getSpan()` | `Angle`、`Frequency`、`number` | 三个构造参数 |
| `size()` | `bigint` | 同时也是周期的那个 `n` |
| `phaseAt(index)` | `Optional<Angle>` | 只给固有相位；忽略时间、速率与频率 |
| `elementAt(index)` | `Optional<RingElement>` | 元素、固有相位、环境频率、相量 |
| `frequencyAt(index)` | `Optional<Frequency>` | 环境转速，空环返回空 |
| `toComplex()` / `toComplex(index)` | `Complex[]` / `Optional<Complex>` | 固有相量 |

`RingOptions` 另有两个逐元素函数：`magnitude(element, index)` 给出相量长度，默认 1；
`rate(element, index)` 给元素自己的固有频率，默认 0，即固定标记。

```typescript
import { SynchronousRing } from "semantic-typescript";

const ring = new SynchronousRing(["a", "b", "c", "d", "e", "f"]);

ring.size();                                                             // 6n
ring.phaseAt(0n).get().toDegreeValue();                                  // 0
ring.phaseAt(1n).get().toDegreeValue();                                  // 60
ring.phaseAt(-1n).get().toDegreeValue();                                 // 300
ring.phaseAt(6n).get().getValue() === ring.phaseAt(0n).get().getValue(); // true
ring.phaseAt(10n ** 20n).get().toDegreeValue();                          // 240
```

在六元素环上 `phaseAt(-1n)` 是 `300`，而 `10n ** 20n` 对六取余是 `4`，所以读作 `240`。两种
情况都不累积浮点乘积，这正是身份在索引表示改变时仍然精确的原因。

### 13.2 环境转速与某一瞬间的状态

`frequency` 是环所嵌入环境的**环境转速**，不是位置之间的相位步进。环境把每个元素的相位推进
同一个角度，因此它不能改变固有图案、不能破坏平衡，也不能改变任何 `phaseAt` 的结果。它默认
是 `0 Hz`。

`relativeAt(index, time)` 减掉这个公共角度，留下 `PhaseField` 打分所用的坐标。`viewAt` 与
`viewsAt` 返回某一瞬间的完整状态，含元素自己的 `rate`；微分访问器则暴露漂移：

| 调用 | 公式 | 读取什么 |
| :--- | :--- | :--- |
| `relativeAt(index, time)` | `固有相位 + 自身速率 · t − 环境转速 · t` | 环境看到的相位 |
| `viewAt(index, time)` / `viewsAt(time)` | 同上，外加元素、索引、时间、速率、相量 | 完整状态 |
| `jetAt(index, time)` | `t` 时刻的相位、自身速率、`slip = 自身速率 − 环境转速` | 微分状态 |
| `windingAt(index, time)` | `trunc(slip · t)` | 滑过的整圈数，向零截断 |
| `errorIntegralAt(index, time, origin?)` | `∫ 相对相位 dt`，单位 圈 · 秒 | 元素领先或落后了多久 |
| `resultant(time?)` | `abs(Σ w · e^{iθ}) / Σ w` | 相位集中度，不受环境旋转影响 |
| `analyse(data, time?)` | 每个参考的计数与均值 | 把数据对照每个元素度量 |
| `scoreAt(index, time, field)` / `scoresAt(time, field)` | 用相对相位采样场 | 每个位置一个界内得分 |

```typescript
import { SynchronousRing, useHertz } from "semantic-typescript";

const moving = new SynchronousRing(["a", "b", "c", "d", "e", "f"], {
  frequency: useHertz(1),
});

moving.getFrequency().getHertz();                        // 1
moving.phaseAt(1n).get().toDegreeValue();                // 60 — intrinsic
moving.relativeAt(1n, 0.25).get().toDegreeValue();       // 330 — 60 − 90
moving.viewAt(1n, 0.25).get().relative.toDegreeValue();  // 330
moving.jetAt(1n, 0.25).get().slip;                       // -1
moving.purity();                                         // 1 — rotation cannot break it
```

在 `1 Hz` 下，环境在 `0.25 s` 内推进四分之一圈，所以位置一的相对相位是 `60 − 90 = 330`
度，而它的固有相位仍是 `60`。jet 报告的 `slip` 是 `-1` 赫兹，因为元素自身没有动；而
`purity()` 仍是 `1`：把所有相量旋转同一个角度不是形变。

### 13.3 纯度与平衡

`purity()` 是环的能量中由基模携带的份额：

`max(abs(c₁)², abs(c_{n−1})²) / (n · Σ abs(z)²)`

两个基模 bin 都要看，因为环可以沿任一方向绕圈。六个元素、`span: 5` 的环每步 `300` 度，即
`−60` 度：它反向行走，把全部能量放进 `c₅`，只看 `c₁` 的公式会把它误判为不纯。代价仍是
`O(n)`，因为只需要这两个 bin 和总能量。

边界情形是约定的一部分。少于两个元素的环没有基模，无论内容如何都报告 `purity() === 0` 与
`isBalanced() === false`。所有相量长度为零的环没有能量，同样报告零。`isBalanced(epsilon?)`
即 `1 − purity() <= epsilon`，默认容差 `1E-9`。

```typescript
import { SynchronousRing } from "semantic-typescript";

const forward = new SynchronousRing(["a", "b", "c", "d", "e", "f"]);
const backward = new SynchronousRing(["a", "b", "c", "d", "e", "f"], { span: 5 });
const weighted = new SynchronousRing(["a", "b", "c", "d"], {
  magnitude: element => element === "a" ? 1 : 0,
});

forward.purity();                             // 1
backward.phaseAt(1n).get().toDegreeValue();   // 300 — it runs backwards
backward.purity();                            // 1 — the energy sits in c₅
new SynchronousRing(["only"]).purity();       // 0
new SynchronousRing(["only"]).isBalanced();   // false
weighted.purity();                            // 0.25
```

### 13.4 合向量长度与对称分量

`resultant(time?)` 是平均合向量长度：相量和的模除以长度之和。`purity` 问的是环是否仍是
`n` 次单位根，而 `resultant` 问的是此刻相量有多集中。平衡环报告 `0`；所有元素共享同一角度
的环会报告 `1`，但集合语义禁止重复元素，所以实践中 `1` 出现在 `magnitude` 把所有元素清零、
只留一个的时候。

`zeroSequence()` 是平均相量，也就是 `c₀ / n`。`sequences()` 用直接变换返回全部 `n` 个对称
分量，最低阶在前。`toSpectrum()` 把它们装进一个 `Spectrum`，其第 `j` 个 bin 报告每环转
`j` 个周期，因此频率轴就是波数轴。

```typescript
import { SynchronousRing } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const ring = new SynchronousRing(["a", "b", "c", "d", "e", "f"]);

round(ring.resultant().get());                                        // 0
round(ring.zeroSequence().get().magnitude());                         // 0
ring.sequences().map(component => round(component.magnitude()));      // [0, 6, 0, 0, 0, 0]
ring.toSpectrum().get().size();                                       // 6
ring.toSpectrum().get().getResolution().getHertz();                   // 1
```

这些分量是复数，一般**不满足共轭对称**：平衡环把全部能量放在 bin 一，反向环放在 bin
`n − 1`。`Spectrum` 的单边辅助函数假设实信号，所以请直接读 bin，不要折叠。

### 13.5 把数据对照每个元素来分析

`analyse(data, time?)` 按身份把每个观测匹配回环，并以每个元素为参考相位来度量它。环不持有
的观测记为 `missed`，而不是猜测，因为环是相位的唯一来源。每个参考行报告 `count`、平均相对
相位 `mean` 与平均合向量长度 `resultant`。

有一个值得记住的恒等式：**`resultant` 对每个参考都相同**。改变基准只是把所有相对相位旋转
一个常数，而旋转不会改变合向量长度。每个参考不同的是计数与均值。

```typescript
import { SynchronousRing } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const ring = new SynchronousRing(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                                                  // 5
report.missed;                                                   // 1
report.references.map(row => row.count);                         // [2, 0, 2, 0, 1]
report.references.map(row => round(row.resultant));              // [0.1453, 0.1453, 0.1453, 0.1453, 0.1453]
```

打分是同一枚硬币的另一面。`PhaseField` 是有界的余弦级数（第 10.2 节），`scoreAt` /
`scoresAt` 在相对相位处采样它，所以同一个环可以对照对齐、对照某个谐波图案、或对照任意
场来打分，而环本身不变。

```typescript
import { SynchronousRing, useField } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const ring = new SynchronousRing(["a", "b", "c", "d", "e", "f"]);
const cosine = useField([1]);

round(ring.scoreAt(0n, 0, cosine).get());                                  // 1
round(ring.scoreAt(1n, 0, cosine).get());                                  // 0.5
ring.scoresAt(0, cosine).map(score => round(score));                       // [1, 0.5, -0.5, -1, -0.5, 0.5]
```

### 13.6 合成环与角谱

`combineRings(left, right)` 按最小公倍数而不是乘积把两个环接在一起。联合环的第 `i` 个瞬间
读取左环的 `i mod m` 与右环的 `i mod n`，所以它在 `lcm(m, n)` 个瞬间后闭合。永远不可能
共现的配对——位置模 `gcd(m, n)` 不一致的那些——直接不存在，这就是结果是一个拉回而不是乘积
的原因；`aligns(left, right)` 报告给定配对是否可表示。

`useAngularSpectrum(ring, instants, plan)` 构造 `(ω, n)` 平面：每个瞬间贡献一帧相量，模式
`j` 的第 `k` 帧是该帧的第 `j` 个对称分量，`cells[frame][order]` 是系数。取一列就是单个空间
模式的时间序列，`spectrum(order)` 是它的时间频谱。

```typescript
import { Sample, SynchronousRing, combineRings, useAngularSpectrum } from "semantic-typescript";

const left = new SynchronousRing(["a", "b", "c", "d"]);
const right = new SynchronousRing(["x", "y", "z", "w", "v", "u"]);
const joined = combineRings(left, right);

joined.period;                                     // 12n
joined.divisor;                                    // 2n
joined.ring.size();                                // 12n
joined.aligns(0n, 0n);                             // true
joined.aligns(1n, 0n);                             // false
joined.ring.get(0n).join("-");                     // a-x

const angular = useAngularSpectrum(left, [0, 0.25, 0.5, 0.75], new Sample(4, 1));
angular.order;                                     // 4
angular.frameCount;                                // 4
angular.cells[0][1].magnitude();                   // 4
angular.spectrum(1).get().size();                  // 4
```

### 13.7 陷阱

**精确就是精确。** `phaseAt(i)` 与 `phaseAt(i + n)` 是同一个双精度值，不是容差内的两个值。
按每个元素累加 `2π / n` 构造的环做不到这一点；这个环先在 `bigint` 里归约索引。

**`frequency` 不是相位步进。** 它是环境转速，默认零，把所有相量旋转同一角度不会破坏固有
图案。想让位置之间相对推进，请用 `rate`，不要用 `frequency`。

**`purity()` 必须看两个基模 bin。** 反向环仍是 `n` 次单位根；只看 `c₁` 会把它判为不纯。

**`n < 2` 是已定义的边界。** `purity()` 返回 `0`，`isBalanced()` 返回 `false`；空环的采样
方法返回空 `Optional`。

**与 `n` 有公因子的 span 会坍缩轨道。** 六个元素配 `span: 2` 只访问三个不同相位，环不再
平衡。

**`resultant` 是旋转不变，不是时间不变。** 环境旋转不改变它；逐元素 `rate` 会随着环失相而
改变它。

**环是集合，`analyse` 按身份匹配。** 重复元素在构造时被丢弃；与某个环元素结构相等但不是同一
个引用的对象会被计为 missed。

**`toSpectrum()` 是复数谱。** 它的 bin 不满足共轭对称，`Spectrum` 的单边辅助函数不适用。
请直接读 bin。

**`windingAt` 向零截断，`errorIntegralAt` 积分的是相位。** 滑过半圈报告 `0n`；误差积分的
单位是 圈 · 秒，不是速率。

```typescript
import { SynchronousRing, useHertz } from "semantic-typescript";

const collapsed = new SynchronousRing(["a", "b", "c", "d", "e", "f"], { span: 2 });
collapsed.phaseAt(1n).get().toDegreeValue();   // 120
collapsed.phaseAt(3n).get().toDegreeValue();   // 0
Number(collapsed.purity().toFixed(4));         // 0

const falling = new SynchronousRing(["a", "b", "c", "d"], {
  frequency: useHertz(2),
  rate: () => useHertz(0.5),
});
falling.jetAt(0n, 2).get().slip;               // -1.5
falling.windingAt(0n, 1).get();                // -1n
falling.windingAt(0n, 0.5).get();              // 0n

const objects = new SynchronousRing([{ key: 1 }, { key: 2 }]);
objects.analyse([{ key: 1 }]).missed;          // 1 — identity, not structure
```

---

<a id="14-signal-analysis"></a>
## 14. 信号分析：窗、频谱与时间

第 10 章把环当作相位的周期来讨论。本章是它的时间对应物：一段实值记录，除了样本本身，还
携带每个频谱公式都需要的两项上下文——把 bin 序号变成赫兹的采样计划，以及同时决定相干增益
与噪声带宽的窗。

值对象是 `SynchronousSignalCollectable`，它的排队孪生是 `AsynchronousSignalCollectable`。
两者暴露同一套 `SignalCollectable` 接口：二十三个方法，每个恰好委托给
`synchronous/collectors` 里的一个 `useSynchronous<Method>` 工厂。这个拆分是刻意的：类是
有文档的门面，工厂持有累加过程，构造函数只在当前长度上计算一次 `sum(w) / count` 与
`count * sum(w^2) / sum(w)^2`。需要自己记住"除以相干增益"的调用者迟早会忘，而由此产生的
6.02 分贝看起来却像一个合理的测量值。

### 14.1 信号自带标定

信号可以从一个可迭代对象加采样率构造，也可以来自已有的 `Frame`，或者用构造函数配一个显式
的 `Sample`。默认窗是周期 Hann 窗；任何不指定窗的分析都使用它，而每个分析都接受覆盖。
元数据访问器读取的是构造时固定下来的状态，耗时恒定，因此信号可以在传递过程中不丢失上下文。

| 调用 | 返回 | 含义 |
| :--- | :--- | :--- |
| `SynchronousSignalCollectable.useRate(values, rate, window?)` | 信号 | 时长 `count / rate` |
| `SynchronousSignalCollectable.useFrame(frame, window?)` | 信号 | 保留该 frame 的采样计划 |
| `new SynchronousSignalCollectable(plan, values, window?)` | 信号 | 计划的帧数必须等于样本数 |
| `getSample()` / `getValues()` / `getWindow()` | 计划、样本、窗 | 冻结的上下文 |
| `getRate()` | `number` | 每秒样本数 |
| `getNyquist()` / `getResolution()` | `Frequency` | `rate / 2` 与 `rate / count` |
| `getCoherentGain()` / `getNoiseBandwidth()` | `number` | 在当前长度上重新计算 |
| `size()` / `at(index)` / `toFrame()` / `equals(other)` / `toString()` | — | 值语义 |

```typescript
import { SynchronousSignalCollectable } from "semantic-typescript";

const signal = SynchronousSignalCollectable.useRate(
  Array.from({ length: 64 }, (_unused, index) => Math.cos(2 * Math.PI * 8 * index / 64)),
  64,
);

signal.size();                       // 64n
signal.getRate();                    // 64
signal.getNyquist().getHertz();      // 32
signal.getResolution().getHertz();   // 1
signal.getCoherentGain();            // 0.5
signal.getNoiseBandwidth();          // 1.5
```

`getResolution()` 是 bin 间距，不是分辨能力：它是 `rate / count`，因为变换有 `count` 个
bin；补零会改变间距，却不会改变窗能分开什么（见 14.8 节）。

### 14.2 二十三个方法

这些方法分成六族。七个是频谱读数，两个是时频变换，四个是解析量，三个是序列统计量，五个是
形状描述子，还有两个返回新的信号。

| 方法 | 返回 | 约定 |
| :--- | :--- | :--- |
| `spectrum(size?, window?)` | `Spectrum` | 原始未归一化，保留完整复网格 |
| `oneSided(size?, window?)` | `Bin[]` | 折叠共轭半，DC 与 Nyquist 不翻倍 |
| `amplitude(window?)` | `number[]` | `2·abs(X) / (count · CG)`，DC 与 Nyquist 只算一次 |
| `power(window?)` | `number[]` | 内部 bin 为 `A² / 2`，DC 与 Nyquist 为 `A²` |
| `decibel(window?)` | `number[]` | `20·log10(幅度)` |
| `powerDecibel(window?)` | `number[]` | `10·log10(功率)` |
| `powerSpectralDensity(frameSize?, hopSize?, window?)` | `SpectralDensity` | Welch 平均，`abs(X)² / (rate · Σw²)` |
| `shortTimeFourierTransform(frameSize, hopSize, window?)` | `Spectrum[]` | 两端延拓，按帧中心报告时间 |
| `spectrogram(frameSize, hopSize, window?)` | `Spectrogram` | 同一批列，带时间轴 |
| `analyticSignal()` | `Complex[]` | Hilbert 对 `x + i·H(x)` |
| `instantaneousPhase()` | `Angle[]` | 折叠进 `[0, 2π)` |
| `instantaneousFrequency(rate?, gate?)` | `number[]` | 解缠后的相位差分，受包络门限保护 |
| `envelope()` | `number[]` | `abs(z[n])`，两端受循环影响 |
| `zeroCrossingRate(perSecond?)` | `number` | 相邻样本对的过零比例 |
| `spectralFlux(frameSize?, hopSize?, window?)` | `number[]` | 帧间单位范数幅度距离 |
| `autocorrelation(maximumLag?, normalization?)` | `number[]` | 默认系数约定，`ρ[0] = 1` |
| `spectralCentroid(window?)` | `Optional<Frequency>` | 功率加权平均频率 |
| `spectralBandwidth(window?)` | `Optional<Frequency>` | 功率加权标准差 |
| `spectralRolloff(ratio?, window?)` | `Optional<Frequency>` | 累计功率首次达到 `ratio` 的 bin |
| `spectralFlatness(window?)` | `number` | 功率的几何均值 / 算术均值 |
| `signalToNoiseRatio(frameSize?, hopSize?, window?, floorQuantile?)` | `Optional<number>` | 中位数噪声底，`10·log10` |
| `detrended(mode?)` | 信号 | `"none"`、`"constant"`（默认）、`"linear"` |
| `windowed(window?)` | 信号 | 施加窗并采用它 |

可选参数不是装饰。`frameSize` 默认 `min(256, size)`，跳长默认为半帧向下取整，
`instantaneousFrequency` 的默认门限是峰值包络的 `1E-3`，`spectralRolloff` 默认 `0.85`。
每个默认值都是参考实现在"给参数命名而不传值"时选择的那个值。

### 14.3 幅度、功率与密度

需要三种归一化，因为问的是三个不同的问题。

`amplitude()` 回答"这个 bin 上的正弦有多大"：内部 bin 为 `2·abs(X[k]) / (count · CG)`，
DC 与 Nyquist 为 `abs(X[k]) / (count · CG)`。因子 2 折叠共轭半；相干增益去掉窗的影响。
少做任何一步，单位幅度正弦都会读成 `0.5`，也就是负 6.02 分贝。

`power()` 回答"这个 bin 上的正弦会有多大均方"：内部 bin 为 `A² / 2`，DC 与 Nyquist 为
`A²`，因为后两者不振荡。这是峰值约定，它刻意不满足帕塞瓦尔定理：窗把每条谱线摊到主瓣上，
所以所有 bin 之和会比均方多出等效噪声带宽——Hann 窗是 `1.5`。

`powerSpectralDensity()` 回答"每赫兹有多少功率"：`abs(X)² / (rate · Σw²)`，并在重叠段上
平均。只有用权重平方和作分母，白噪声底才是无偏的；除以 `count` 会把单位噪声读成 `0.375`，
除以 `count · CG²` 会读成 `1.5`。

```typescript
import { SynchronousSignalCollectable } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const tone = SynchronousSignalCollectable.useRate(
  Array.from({ length: 256 }, (_unused, index) => Math.cos(2 * Math.PI * 32 * index / 256)),
  256,
);

round(tone.amplitude()[32]);                                 // 1
round(tone.power()[32]);                                     // 0.5
round(tone.power().reduce((sum, power) => sum + power, 0));  // 0.75
round(tone.powerSpectralDensity(64n, 32n).totalPower());     // 0.5
tone.powerSpectralDensity(64n, 32n).getSegments();           // 7n
```

值得记住的是这两个总量：峰值约定的和是 `0.75`，密度积分是 `0.5`，比值恰好是噪声带宽。
三者之中也只有密度能在改变帧长后继续成立。

### 14.4 电平：两种分贝约定

幅度与功率不共享同一个因子，因此也不共享同一个对数。`amplitudeDecibel` 用 `20·log10`，
适用于电压、位移或声压；`powerDecibel` 用 `10·log10`，适用于功率、能量、均方或密度。
信号上的方法名遵循同样的划分。

```typescript
import { amplitudeDecibel, powerDecibel, SynchronousSignalCollectable } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const tone = SynchronousSignalCollectable.useRate(
  Array.from({ length: 256 }, (_unused, index) => Math.cos(2 * Math.PI * 32 * index / 256)),
  256,
);

amplitudeDecibel(0.25);           // -12.0412
powerDecibel(0.25);               // -6.0206
round(tone.decibel()[32]);        // 0
round(tone.powerDecibel()[32]);   // -3.0103
```

同一个音的两个读数都是对的：它的幅度是 1（零分贝），均方是二分之一（负 3.01 分贝）。把功率
送进幅度约定会让分贝值翻倍，把正确的负 6.02 变成负 12.04。

### 14.5 单边折叠

实信号满足 `X[count − k] = conj(X[k])`，所以负频率半不携带独立信息。折叠把每个内部 bin
翻倍，而把两个自共轭 bin——DC 以及偶数长度下的 Nyquist——原样保留。这两个 bin 是自己的镜像，
翻倍等于凭空制造能量，读数正好高 6.02 分贝。

```typescript
import { SynchronousSignalCollectable } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const edge = SynchronousSignalCollectable.useRate(
  Array.from({ length: 16 }, (_unused, index) => 2 + Math.cos(Math.PI * index)),
  16,
);
const bins = edge.oneSided();

bins.length;                  // 9
round(bins[0].magnitude());   // 16
round(bins[8].magnitude());   // 8
round(edge.amplitude()[0]);   // 2
round(edge.amplitude()[8]);   // 1
```

原始幅度是 `16` 与 `8`，因为窗的权重和是 8；除以 `count · CG = 8` 就得到标定后的幅度
`2` 与 `1`。若把边缘 bin 也翻倍，会读成 `4` 与 `2`，而这个错误永远不会抛出异常。

### 14.6 时频视图

`shortTimeFourierTransform` 与 `spectrogram` 按参考短时变换的方式分帧：两端各补半帧零，
再在尾部补零以凑成整数个跳长。第一帧以第一个样本为中心，最后一帧覆盖到最后一个样本，第
`m` 帧的中心在 `m · hop / rate` 秒。只保留完整帧会丢掉最多 `frameSize − 1` 个样本——1000
个样本、帧长 256、跳长 128 时是 104 个，约为整段记录的十分之一。

```typescript
import { SynchronousSignalCollectable } from "semantic-typescript";

const tone = SynchronousSignalCollectable.useRate(
  Array.from({ length: 64 }, (_unused, index) => Math.cos(2 * Math.PI * 4 * index / 64)),
  64,
);
const spectrogram = tone.spectrogram(16n, 8n);

spectrogram.size();                               // 9
spectrogram.getFrameSize();                       // 16
spectrogram.getBoundary();                        // "zeros"
spectrogram.getTime(0);                           // 0
spectrogram.getTime(6);                           // 0.75
tone.shortTimeFourierTransform(16n, 8n).length;   // 9
tone.spectralFlux(16n, 8n).length;                // 8
```

每一列都是一个 `frameSize` 个 bin 的 `Spectrum`，与对同一帧调用 `spectrum()` 完全一致；
`getTime()` 报告的是帧中心，不是帧起点。

### 14.7 窗、相干增益与 COLA

每种形状都有两种形式。对称形式用 `count − 1` 作分母；周期（DFT 偶数）形式用 `count` 作
分母，比一个整周期少一个样本，因此在 DFT 所假设的周期延拓下是连续的。分析路径与重叠相加
需要周期形式；滤波器设计保留对称形式。

差异可以测量，且永远不会报错。在 50% 重叠下，周期 Hann 窗在每个位置的和都等于 1；对称形式
则有波纹，16 个样本时 `0.84` 分贝，64 个样本时 `0.21`，1024 个样本时仍有 `0.013`。类会
暴露它所持窗的相干增益与等效噪声带宽，所以校正量从不硬编码：对称 Hann 在 8 个样本时读作
`0.4375`，不是 `0.5`。

```typescript
import {
  coherentGain, equivalentNoiseBandwidth, useFlatTopWindow,
  useHannPeriodicWindow, useHannWindow,
} from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));

round(useHannWindow(1, 4));                           // 0.75
round(useHannPeriodicWindow(1, 4));                   // 0.5
coherentGain(useHannPeriodicWindow, 16);              // 0.5
equivalentNoiseBandwidth(useHannPeriodicWindow, 16);  // 1.5
useFlatTopWindow(0, 1024);                            // -0.000421
Array.from({ length: 1024 }, (_unused, i) => useFlatTopWindow(i, 1024)).filter(w => w < 0).length;  // 578
```

平顶窗那一行不是表格出错。平顶窗按定义就是部分取负的——这里 1024 个权重中有 578 个为负——
把这些权重截断为零会扰动主瓣，破坏这个窗存在的理由：极低的扇贝损失。库原样返回该序列。

### 14.8 陷阱

**零填充是插值，永远不是分辨。** 变换长度大于样本数只是在更密的网格上采样同一个 DTFT：
峰值*位置*更精细，bin 间距变成 `rate / size`，但能否分开两个分量仍由窗长与窗形决定。正好
落在两个 bin 中间的音，在未补零的网格上读作 `82.1093` 与 `80.8598`，在补零网格上自己的
频率处读作 `128`。

```typescript
import { SynchronousSignalCollectable, useRectangularWindow } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const tone = SynchronousSignalCollectable.useRate(
  Array.from({ length: 256 }, (_unused, index) => Math.cos(2 * Math.PI * 100.5 * index / 256)),
  256,
);
const flat = tone.spectrum(256n, useRectangularWindow);
const padded = tone.spectrum(1024n, useRectangularWindow);

flat.getResolution().getHertz();           // 1
padded.getResolution().getHertz();         // 0.25
round(flat.magnitudeAt(100).get());        // 82.1093
round(flat.magnitudeAt(101).get());        // 80.8598
round(padded.magnitudeAt(402).get());      // 128
padded.frequencyAt(402).get().getHertz();  // 100.5
```

相隔 `0.4` 个 bin 的两个等幅音在任何补零下都保持合并：256 点记录加 Hann 窗，补零到 8192
只产生一个局部极大值，而不是两个。

**Hilbert 变换是循环的。** `analyticSignal`、`envelope` 与 `instantaneousPhase` 把首尾
样本当作邻居，因此周期不能整除长度的记录两端都受到污染。记录中段可信，两端不可信。

```typescript
import { SynchronousSignalCollectable } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const edge = SynchronousSignalCollectable.useRate(
  Array.from({ length: 512 }, (_unused, index) => Math.cos(2 * Math.PI * 8.3 * index / 512)),
  512,
);
const envelope = edge.envelope();

round(envelope.slice(8, -8).reduce((sum, value) => sum + value, 0) / 496);  // 1.0025
round(Math.max(...envelope.slice(0, 8)));                                   // 1.2592
round(Math.min(...envelope.slice(-8)));                                     // 0.1314
```

**包络消失处不定义相位。** 包络塌陷时，两个舍入噪声角度之差可以是半圈，读出来就是采样率的
一半。门限正是让这个数字有意义的东西，默认值是峰值包络的 `1E-3`。

```typescript
import { SynchronousSignalCollectable } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const beat = SynchronousSignalCollectable.useRate(
  Array.from({ length: 4096 }, (_unused, index) =>
    Math.cos(2 * Math.PI * 100 * index / 2048) + Math.cos(2 * Math.PI * 102 * index / 2048)),
  2048,
);

round(Math.max(...beat.instantaneousFrequency(2048, 0).map(Math.abs)));  // 920.218
round(Math.max(...beat.instantaneousFrequency().map(Math.abs)));         // 101
```

**未归一化的相关不是相似度。** 原始和 `r[k]` 随记录长度增长，因此两个长度无法比较。默认的
`"coefficient"` 规则除以 `r[0]`，把所有值留在 `[-1, 1]`；`"unbiased"` 除以 `count − k`，
代价是方差随延迟增长。

```typescript
import { SynchronousSignalCollectable } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const periodic = SynchronousSignalCollectable.useRate(
  Array.from({ length: 1024 }, (_unused, index) => Math.cos(2 * Math.PI * 8 * index / 1024)),
  1024,
);
const rho = periodic.autocorrelation(200n);

round(rho[0]);                                     // 1
round(rho[128]);                                   // 0.875
round(rho[64]);                                    // -0.9375
round(periodic.autocorrelation(200n, "none")[0]);  // 512
```

还有一个读数值得提醒：`spectralFlux` 在比较前会把每帧归一化，所以纯粹的电平变化产生零通量。
它的首尾两个值是零边界的边缘效应，不是起音。

---

<a id="15-license"></a>
## 15. 许可证

MIT © Eloy Kim
