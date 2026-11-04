# **Semantic-TypeScript**

**流式，索引化。** 数据尽在精准掌控。

[English](./readme.md) · 简体中文 · [繁體中文](./readme.tw.md) · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

一个类型安全的流处理库，统一了 **JavaScript generators**、**Java Stream** 与**基于索引的数据寻址**。每个元素都携带一个 `bigint` 索引，每条管道都是惰性的，而每个终止操作都是显式选择（opt-in）。

```bash
npm install semantic-typescript
```

- 零运行时依赖，纯 ESM，自带类型定义。
- 496 个回归测试：`npm test`。
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
13. [许可证](#13-license)

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
| 数学 | `mathematics/*` | 角、复数、频率、频谱、窗口、本轮、相位环 |
| 结构 | `structure/*` | 列表、集合、映射、树、环、场 |

同步与异步两个家族共享同一套词汇：相同的操作符名称、相同的索引语义、相同的可收集对象。异步变体只是返回 promise，并且会把写入排队，使得在写入之后发出的读取总能观察到它。

---

<a id="3-quick-start"></a>
## 3. 快速开始

```typescript
import {
  useOf, useFrom, useRange, useText, useStringify, usePromise
} from "semantic-typescript";

// 数值聚合
const sum: number = useOf(10, 20, 30, 40)
  .map(n => n * 2)
  .toNumericStatistics()
  .summate();                                   // 200

// BigInt 聚合
const bigSum: bigint = useOf(10n, 20n, 30n, 40n)
  .map(n => n * 2n)
  .toBigintStatistics()
  .summate();                                   // 200n

// 重排序是索引运算——须用 toOrdered() 收集才会生效
const reversed: number[] = useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();      // [5,4,3,2,1]
const rotated: number[]  = useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();   // [4,5,1,2,3]

// 在大范围上的惰性求值
const multiples: bigint[] = useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)
  .limit(10n)
  .toUnordered()
  .toArray();                                   // [0n,17n,…,153n]

// Unicode 安全的字符串处理（按码点，而非 UTF-16 单元）
useText("semantic 👍").toUnordered().forEach(character => console.log(character));

// 抗循环引用的序列化
const cyclic: any = { a: 1 }; cyclic.self = cyclic;
useStringify(cyclic);                           // '{"a":1}'

// 异步源
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
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  （旋转）
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

---

<a id="6-collectables-and-terminal-operations"></a>
## 6. 可收集对象与终止操作

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

---

<a id="7-statistics-and-windows"></a>
## 7. 统计与窗口

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();              // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();              // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();               // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                 // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance();             // 2.56
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation();    // 1.6
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n);                    // [[1,2],[2,3],[3,4]]
```

两族统计都暴露同一套接口——`summate`、`average`、`median`、`mode`、`variance`、`standardDeviation`、`frequency`、`findMaximum`、`findMinimum`——而 `toBigintStatistics()` 使用 `bigint` 运算。窗口支持 `slide(size, hop)` 与 `tumble(size)`。

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
const cycle = new AsynchronousCycle([1, 2]);
const added   = cycle.add(3);          // 已排队
const sampled = cycle.elementAt(2n);   // 观察到上方的写入
await added;
(await sampled).get().element;         // 3
```

天生异步的工厂——`usePromise`、`useBlob`、`useInterval`、`useSubscription`——直接返回 `AsynchronousSemantic`，而 `useFrom` / `useIterate` 在收到 `AsyncIterable` 时会自动升级为异步。

---

<a id="10-periodic-analysis-rings-fields-and-scores"></a>
## 10. 周期分析：环、场与得分

这个库的数学部分把周期视为一等对象，而非查找表。三种构造协同工作。

### 10.1 环就是一个整数

一个 `Cycle` 是一个 **n 重环**：元素数量、位置周期与不同相位的数量都是同一个整数 `n`。一个位置的相位由其精确余数算出，因此这个环的周期性精确到比特：

```typescript
import { SynchronousCycle } from "semantic-typescript";

const ring = new SynchronousCycle(["a", "b", "c", "d", "e", "f"]);
ring.phaseAt(0n).get().toDegreeValue();   // 0
ring.phaseAt(1n).get().toDegreeValue();   // 60
ring.phaseAt(6n).get().getValue() === ring.phaseAt(0n).get().getValue();   // true，精确成立
ring.purity();                             // 1
ring.isBalanced();                         // true
ring.sequences().map(z => z.magnitude());  // [0, 6, 0, 0, 0, 0]
```

`frequency` 是**环境**的旋转速率，而不是位置之间的相位步长：环境把每个相量都移动同一个角度，因此它永远不会破坏内在图样。`span` 决定这个环占据多少圈。

`purity()` 是基模所携带的能量占比，即 `max(|c₁|², |c_{n−1}|²) / (n · Σ|z|²)`。当这个环在旋转意义下恰好是 `n` 次单位根时，它恰为 `1`；其代价是 `O(n)`，因为只需要两个频格。两个方向都会被检查，因为环可以沿任一方向绕行圆周。

### 10.2 场是一个有界的得分

一个 `PhaseField` 把相对相位映射为 `[-1, 1]` 区间内的得分：

```typescript
import { useField } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ)：+1 对齐，−1 相反
const mixed  = useField([0.4, 0.3, 0.3]);  // 前三个谐波

cosine.sample(useRadian(0));               //  1
cosine.sample(useRadian(Math.PI));         // -1
```

得分是一个截断的余弦级数 `a₀ + Σ wₘ·cos(2πmΔ)`，构造函数强制满足 `|a₀| + Σ|wₘ| ≤ 1`。由三角不等式可知，得分永远不会离开 `[-1, 1]`——这个界是**构造的推论**，而不是事后施加的截断（clamp）。

之所以用级数而非查找表：一个 `n` 点表能精确复现自身的采样点，但其三角插值在采样点之间会过冲。一个五点的表若取得分 `[+1, +0.5, −1, −0.5, 0]`，其插值范围为 `[−1.0428, 1.0041]`，这已经违背了承诺。而有界级数不会。

### 10.3 分析把数据与每个元素对照度量

环上的每个元素都是一个参考相位。`analyse` 把每个观测定位回环上，并相对每个参考进行度量：

```typescript
const ring = new SynchronousCycle(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                              // 5
report.missed;                               // 1（'zz' 不在环上）
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

每个参考行报告 `count`、平均相对相位 `mean` 与平均合向量长度（mean resultant length）`resultant`。有一条恒等式值得记住：**`resultant` 对每个参考都相同**，因为改变基线只是把所有相对相位旋转一个常数。每个参考之间不同的是计数与均值。

```typescript
const cycle = new SynchronousCycle(["a", "b", "c"]);
cycle.scoresAt(0, cosine);                   // 每个位置一个得分，落在 [-1, 1]
```

### 10.4 相关工具

| 调用 | 回答 | 代价 |
| :--- | :--- | :--- |
| `purity()` | 这个环仍然是 `n` 次单位根吗？ | O(n) |
| `resultant(t?)` | 当下的相量有多集中？ | O(n) |
| `analyse(data)` | 这份数据相对每个元素处于什么位置？ | O(n · m) |
| `toSpectrum()` | 把环看作频谱，波数位于频率轴 | O(n²) |
| `useAngularSpectrum(cycle, instants, plan)` | 随时间展开的 `(ω, n)` 平面 | O(n² · frames) |

还有两个原语使这个模型更完整：`combineCycles(a, b)` 按最小公倍数把两个环连接起来（这是一次拉回，而非乘积——无法共享同一时刻的配对直接缺席）；`rate()` 给每个元素它自己的固有频率，使环能够相对环境漂移。`jetAt`、`windingAt` 与 `errorIntegralAt` 暴露这种漂移的微分状态。

---

<a id="11-utility-helpers"></a>
## 11. 工具辅助函数

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

---

<a id="12-performance-and-pitfalls"></a>
## 12. 性能与陷阱

**惰性在每一级都有代价。** 每个操作符都会增加一次 generator 跳转。对内存数组上的紧凑数值循环而言，普通的 `for` 循环会胜过任何管道；当源是惰性的、无限的，或管道足够长、让索引纪律的收益能够兑现时，管道才会胜出。

**`toOrdered()` 会排序；`toUnordered()` 不会。** 如果反转看起来“没有生效”，那是因为收集器是无序的——只有当索引被归一化时，索引重写才会成为顺序。

**不带 `interrupt` 的 `useGenerate` 永不结束。** 始终提供一个停止谓词，或下游的 `limit` / `takeWhile`。

**`Cycle` 是一个保持插入顺序的集合。** 元素唯一，并保留各自首次加入时的顺序。重复的 `add` 返回 `false`，而会引入重复的 `set` 会抛出异常。这正是相位可以成为*元素*的函数、而非取决于它恰好占据哪个位置的原因。

**`Spectrum` 的单边辅助方法假定输入是实信号。** `oneSided()`、`getNyquist()` 与 `centroid()` 都假定共轭对称。相位环的空间频谱是复值的，且一般并不对称——一个反向绕行圆周的环会把全部能量放进频格 `n − 1`，越过 Nyquist。请直接读取频格。

---

<a id="13-license"></a>
## 13. 许可证

MIT © Eloy Kim
