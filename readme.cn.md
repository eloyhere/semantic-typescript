# **Semantic-TypeScript**

**流式，索引化。** 数据尽在精准掌控。

[English](./readme.md) · 简体中文 · [繁體中文](./readme.tw.md) · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

一个类型安全的流处理库，统一了 **JavaScript generators**、**Java Stream** 与**基于索引的数据寻址**。每个元素都携带一个 `bigint` 索引，每条管道都是惰性的，而每个终止操作都是显式选择（opt-in）。

```bash
npm install semantic-typescript
```

- 零运行时依赖，纯 ESM，自带类型定义。
- 55 个回归测试：`npm install && npm test`。
- 完整变更历史：[CHANGELOG.md](./CHANGELOG.md)。

---

## 目录

1. [设计哲学](#1-design-philosophy)
2. [架构](#2-architecture)
3. [数据流：从源到结果](#3-data-flow-from-source-to-result)
4. [快速开始](#4-quick-start)
5. [工厂函数](#5-factory-functions)
6. [转换操作符](#6-transformation-operators)
7. [可收集对象与终止操作](#7-collectables-and-terminal-operations)
8. [统计](#8-statistics)
9. [窗口](#9-windows)
10. [索引模型](#10-the-index-model)
11. [异步模型](#11-the-asynchronous-model)
12. [工具辅助函数](#12-utility-helpers)
13. [与其他库的对比](#13-comparison-with-other-libraries)
14. [性能特征](#14-performance-characteristics)
15. [陷阱与常见问题](#15-pitfalls-and-faq)
16. [许可证](#16-license)

---

<a id="1-design-philosophy"></a>
## 1. 设计哲学

**1. 索引优先。** 在大多数流处理库中，位置是你*重建*出来的东西——一个在 `scan` 中携带的计数器，或者你手动逐层传递的索引参数。而在这里，位置是*内在*的：generator 协议给每个元素都附带一个 `bigint` 索引，因此 `distinct`、`skip`、`sub`、`reverse`、`translate` 和 `shuffle` 都被表达为索引运算，而非临时状态。改变一个元素的索引*就是*重排序；重新索引*就是*过滤。

**2. 借助显式停止信号进行推送。** 数据源是一个函数 `(accept, interrupt) => void | Promise<void>`。它通过 `accept(element, index)` 推送元素，并通过 `interrupt(element, index)` 询问是否应当停止。这里没有隐藏的调度器，没有订阅对象，也没有需要记住的清理阶段——背压与终止都是协议的一部分，因此无限流成了普通（而非特殊）情形。

**3. 惰性为默认；物化是一项决策。** 操作符只是包裹 generator。在**可收集对象（collectable）**消费管道之前，什么都不会执行；而你选择的收集器决定了开销：`toUnordered()` 为 O(n) 且从不触碰你的索引，`toOrdered()` 为 O(n log n) 并会对其归一化。由于这个决策明确体现在你拿回的类型之中，你始终清楚是否需要为顺序与内存付出代价。

**4. Redirect 是唯一的重排序机制。** `reverse()`、`translate()` 与 `shuffle()` 不过是预先打包好的 `redirect()` 策略——各自只重写元素的索引，此外别无他物。这正是它们全都**需要 `toOrdered()`** 才会生效的原因：管道只重写索引，而由有序收集器来决定这些索引的含义。

**5. 同步与异步是同一个 API。** 无论是有限的内存数据，还是 promises、异步可迭代对象、定时器、blob 与事件订阅，都使用同一套操作符。无法同步的数据源会在其返回类型中表明自己（`AsynchronousSemantic`），于是“我是不是该 await 它？”不再是一个运行时意外。

---

<a id="2-architecture"></a>
## 2. 架构

三层结构，单向流动。数据向下流转；你所持有的类型会告诉你下一步可以做什么。

```
            SOURCES                     PIPELINE                      SINKS
 ┌──────────────────────────┐   ┌────────────────────────┐   ┌───────────────────────────┐
 │  useOf  useFrom  useRange│   │  map  filter  flatMap  │   │  toUnordered()  → Map     │
 │  useFill useEmpty useText│   │  distinct  limit  skip │   │  toOrdered()    → sorted  │
 │  useAttribute useGenerate│ → │  sub  takeWhile drop   │ → │  toNumericStatistics()    │
 │  usePromise useBlob      │   │  concat  peek  redirect│   │  toBigintStatistics()     │
 │  useIterate useInterval  │   │  reverse  translate    │   │  toWindow()               │
 │  useSubscription         │   │  shuffle  pipe         │   │  toCollectable(custom)    │
 └──────────────────────────┘   └────────────────────────┘   └───────────────────────────┘
        Semantic<E>                    Semantic<E>                 Collectable<E>

                                     terminal operations on the Collectable:
                        toArray  toMap  toSet  count  forEach  join  group  reduce
                        findFirst  findLast  findAt  findMaximum  …  anyMatch  …
```

| 层 | 类型 | 职责 | 来源 |
| :--- | :--- | :--- | :--- |
| 源 / 管道 | `SynchronousSemantic<E>`<br>`AsynchronousSemantic<E>` | 构建惰性管道：转换、重新索引、拆分、合并。此时尚未触碰任何元素。 | 工厂函数，以及语义对象上的每个操作符 |
| 存储 / 视图 | `SynchronousUnorderedCollectable<E>`<br>`SynchronousOrderedCollectable<E>`<br>`SynchronousNumericStatistics<E>`<br>`SynchronousBigIntStatistics<E>`<br>`SynchronousWindowCollectable<E>`<br>(+ `Asynchronous*` counterparts) | 将管道物化为一个按索引寻址的缓冲区，并暴露终止 API。**有序（ordered）** 一族负责索引记账；**无序（unordered）** 一族为吞吐而放弃记账。 | `toUnordered()` `toOrdered()` `toNumericStatistics()` `toBigintStatistics()` `toWindow()` `toCollectable()` |
| 收集器 | `SynchronousCollector<E, A, R>`<br>`AsynchronousCollector<E, A, R>` | 一个可复用的折叠：`identity → accumulator → finisher`，可选带一个 `interruptor`。驱动每一个终止操作，且可由用户自行编写。 | `useSynchronous*` / `useAsynchronous*` 收集器工厂，或 `Collectable.collect(...)` |

中间层存在的理由：将“管道是什么”与“它如何存储”分离，才使得同一个 `toOrdered()` 既能服务于反转、旋转，也能服务于洗牌——管道只重写索引，而收集器决定这些索引的含义。

---

<a id="3-data-flow-from-source-to-result"></a>
## 3. 数据流：从源到结果

```typescript
const result = useRange(0n, 100n)      // (1) source: reserve indices 0n,1n,2n,…
  .filter(n => n % 2n === 0n)          // (2) operator: index is forwarded unchanged
  .translate(2)                        // (3) operator: index becomes i + 2 (a lazy shift)
  .limit(5n);                          // (4) operator: interrupt() returns true after 5 elements

const ordered = result.toOrdered();    // (5) collectable: materialise; indices normalised mod n, sorted
const array = ordered.toArray();       // (6) terminal: drain the buffer
```

1. **构建。** 第 1–4 步只构造闭包，不产生任何东西。一百个元素绝不会被预先生成。
2. **推送。** 当可收集对象最终运行 generator 时，元素在无调度器的情况下流动：源驱动，`accept` 写入收集器，`interrupt` 决定何时停止——这正是百万级范围中位于中间的 `limit(5n)` 只需五次迭代、而非一百万次的原因。
3. **索引。** 操作符从不丢失索引。`filter` 转发原始索引（因此“第 3 个*保留*的元素”仍是“索引 3”），而 `skip` / `sub` / `limit` / `distinct` 会刻意地重新索引。
4. **物化。** 可收集对象在构造时恰好执行一次 generator。
5. **终止。** 可收集对象上的方法读取缓冲区；它们开销低、可重复，且绝不会重新运行管道。

**最值得记住的一条规则：** 转换是惰性的，可收集对象（collectable）是及早的，终止操作是免费的。

---

<a id="4-quick-start"></a>
## 4. 快速开始

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

// Async sources
const total = await usePromise(Promise.resolve(7)).toNumericStatistics().summate();       // 7
```

---

<a id="5-factory-functions"></a>
## 5. 工厂函数

### 5.1 概述

构造始终为 O(1)——工厂只包裹一个 generator。下表列出了从每个源*消费* `n` 个元素的开销，以及源在你要收集的元素之外所需的额外空间。

| 工厂 | 签名（结果） | 时间（消费 n） | 空间（源） | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | 索引为 0..n−1；展开参数已被物化 |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | 包裹任意 `Iterable` / `AsyncIterable`；在收集时迭代一次 |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` 为开区间；`step` 必须非零；`number` 与 `bigint` 均可 |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | 每个元素调用一次 supplier |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | `concat` 的单位元 |
| `useText` | `useText(text)`<br>`useText(text, delimiter)`<br>`useText(text, start)` / `(text, start, end)` | O(n) | O(n) for the text | 按**码点（code point）**迭代，因此 emoji 与 CJK 字符保持为单个元素 |
| `useAttribute` | `useAttribute<T>(object) → SynchronousSemantic<{key, value}>` | O(v + e) over v values and e edges | O(d + v) for the visited set at depth d | 在深度 d 处为已访问集合占用 O(d + v)；通过递归遍历嵌套对象/数组并保护环 |
| `useGenerate` | `useGenerate<E>(supplier, interrupt) → SynchronousSemantic<E>` | O(n) × supplier cost | O(1) | **必须**带一个停止用的 `interrupt`（或下游的 `limit` / `takeWhile`） |
| `useIterate` | `useIterate<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useIterate<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) per collection | O(1) | 每次收集时重放迭代器 |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period (real time) | O(1) | 发出经过的时间；消耗真实时间 |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | 位于索引 `0n` 的单个元素 |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob size) | O(chunk) per emitted copy | 默认分块为 64 KiB；每个分块都是独立副本 |
| `useSubscription` | `useSubscription(target, subscriber, event \| events) → AsynchronousSemantic<Event>` | one element per event | O(1) | `limit()` / `sub()` / `takeWhile()` 定义退订边界 |

### 5.2 示例

```typescript
// useOf / useFrom
useOf(1, 2, 3).toUnordered().toArray();                       // [1,2,3]
useFrom(new Set([1, 2, 2])).toUnordered().toArray();          // [1,2]
useFrom(new Map([["a", 1]])).toUnordered().toArray();         // [["a",1]]

// useRange — half-open interval, number or bigint
useRange(0, 5).toUnordered().toArray();                       // [0,1,2,3,4]
useRange(10n, 0n, -5n).toUnordered().toArray();               // [10n,5n]

// useFill
useFill("x", 3n).toUnordered().toArray();                     // ["x","x","x"]
useFill(() => Math.random(), 2n).toUnordered().toArray();     // two fresh randoms

// useText — code-point aware
useText("A😊B").toUnordered().toArray();                      // ["A","😊","B"]
useText("a,b,c", ",").toUnordered().toArray();                // ["a","b","c"]
useText("abcdef", 1, 3).toUnordered().toArray();              // ["b","c"]

// useGenerate — infinite supplier with a stop predicate
useGenerate(() => 7, (_element, index) => index >= 3n).toUnordered().toArray();   // [7,7,7]

// useIterate — async generator
async function* tick() { yield 1n; yield 2n; }
await useIterate(tick()).toUnordered().toArray();             // [1n,2n]

// useBlob — chunked binary read
const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);
await useBlob(blob, 2n).toUnordered().toArray();              // [Uint8Array[1,2], Uint8Array[3,4], Uint8Array[5]]

// useSubscription — the boundary defines the unsubscribe point
const subscriber = {
  mount: () => { },
  unmount: () => { },
  subscribe: (event, handler) => window.addEventListener(event, handler),
  unsubscribe: (event, handler) => window.removeEventListener(event, handler)
};
useSubscription(window, () => subscriber, "resize")
  .limit(5n)
  .toUnordered()
  .forEach((event, index) => console.log(index, event));      // auto-unsubscribes after 5 events
```

---

<a id="6-transformation-operators"></a>
## 6. 转换操作符

### 6.1 概述

每个操作符都返回一个新的 `Semantic`；在可收集对象运行之前，它们都不会触碰任何元素。时间是指**每个元素**的额外开销（不包含上游自身的开销）；空间是操作符在管道运行期间保留的额外内存。

| 操作符 | 用途 | 索引效果 | 时间（每元素） | 空间 |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | 1:1 转换 | 转发 | O(1) | O(1) |
| `filter(predicate)` | 保留匹配的元素 | 转发 | O(1) | O(1) |
| `flat(mapper)` | 1:N 扁平化（可迭代对象或语义对象） | 从 0 重新索引 | 每个发出元素 O(1) | O(1) |
| `flatMap(mapper)` | 1:N 扁平化，可能改变元素类型 | 从 0 重新索引 | 每个发出元素 O(1) | O(1) |
| `distinct(keyExtractor?)` | 丢弃重复键，保留首次出现 | 转发 | 平均 O(1) | 键集合占用 O(n) |
| `peek(consumer)` | 副作用，元素直接通过 | 转发 | O(1) | O(1) |
| `limit(count)` | 取前 *n* 个 | 从 0 重新索引 | O(1)，在 n 之后停止上游 | O(1) |
| `skip(count)` | 丢弃前 *n* 个 | 转发 | 每个被跳过元素 O(1) | O(1) |
| `sub(start, end)` | 按位置的切片 `[start, end)` | 转发 | O(1) | O(1) |
| `takeWhile(predicate)` | 谓词成立时持续取用 | 转发 | O(1)，首次未命中即停止上游 | O(1) |
| `dropWhile(predicate)` | 谓词成立时持续丢弃 | 从 0 重新索引 | O(1) | O(1) |
| `concat(other)` | 追加一个语义对象或可迭代对象 | 延续索引 | O(1) | O(1) |
| `redirect(redirector)` | 按你的意愿计算新索引 | **由你决定** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | 取负并平移 | O(1) | O(1) |
| `translate(offset)` | 每个索引导惰性平移 *offset* | `i + offset` | O(1) | O(1) |
| `translate(mapper)` | 逐元素索引平移 | `i + mapper(element, i)` | O(1) | O(1) |
| `shuffle(mapper?)` | 随机化索引（或使用你自己的 mapper） | 随机 | O(1) | O(1) |
| `pipe(conversion)` | 将 generator 交给自定义函数 | 由你决定 | 由你 | 由你 |
| `semantic()` | 将可收集对象提升回语义对象 | 不变 | O(1) | O(1) |

### 6.2 重要说明

**`reverse`、`translate` 与 `shuffle` 都是 `redirect` 策略，且需要有序收集器。** 它们只重写索引——不缓冲任何内容，也尚未旋转。是 `toOrdered()` 将索引按元素数量取模归一化，并据此确定顺序：

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(-2).toOrdered().toArray();        // [3,4,5,1,2]
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3, 4, 5]).shuffle().toOrdered().toArray();            // a fresh permutation per call
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

改用 `toUnordered()` 收集时，同样的管道会按到达顺序、保留原始索引返回元素——见 [索引模型](#10-the-index-model)。

**`translate` 是一次纯粹的、惰性的索引平移。** 两个重载都会对索引做加法（`i + offset` 或 `i + mapper(element, i)`），且从不缓冲流。旋转只有在*有序收集器*按元素数量将索引取模归一化时才会物化——因此即便在“无限范围后接 `limit`”的场景下，`translate(2)` 也很廉价。

**`redirect` 是通用工具。** 任何索引策略都可以用它表达——反转、交错、哈希分区：

```typescript
useFrom([1, 2, 3, 4, 5]).redirect((_e, i) => -i - 1n).toOrdered().toArray();   // [5,4,3,2,1]
useFrom([1, 2, 3, 4]).redirect((_e, i) => i % 2n === 0n ? i + 1n : i - 1n)
  .toOrdered().toArray();                                                       // [2,1,4,3]
```

**以索引驱动的切片仍是一等公民：**

```typescript
useOf(1, 2, 3, 4, 5).sub(1, 3).toUnordered().toArray();               // [2,3]
useOf(1, 2, 3, 4, 5).skip(2n).toUnordered().toArray();                // [3,4,5]
useOf(1, 2, 3, 4, 5).takeWhile(n => n < 3).toUnordered().toArray();   // [1,2]
useOf(1, 2, 3, 4, 1).dropWhile(n => n < 3).toUnordered().toArray();   // [3,4,1]
```

---

<a id="7-collectables-and-terminal-operations"></a>
## 7. 可收集对象与终止操作

### 7.1 选择可收集对象

可收集对象同时拥有**顺序**与**索引记账**。`n` 为元素数量。

| 可收集对象 | 结构 | 时间 | 空间 | 顺序 | 使用场景 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | 按索引键控的 `Map<bigint, E>` | O(n) | O(n) | 插入顺序 | 最大吞吐、顺序无关；原始索引原样保留 |
| `toOrdered()` | 按元素索引排序的数组 | O(n log n) | O(n) | 按归一化索引 | 必须让反转/旋转/洗牌生效，或你需要按位置访问 |
| `toOrdered(comparator)` | 按你的比较器排序，索引重建为位置 | O(n log n) | O(n) | 按你的比较器 | 排序视图、最小/最大式读取 |
| `toNumericStatistics()` | 按值排序的缓冲区 | O(n log n) | O(n) | 按值 | 对 `number` 做统计 |
| `toBigintStatistics()` | 按值排序的缓冲区 | O(n log n) | O(n) | 按值 | 对 `bigint` 做统计 |
| `toWindow()` | 按值排序的缓冲区 | O(n log n) | O(n) | 按值 | `slide` / `tumble` |
| `toCollectable(mapper)` | 由 mapper 返回的结果 | — | — | — | 自定义可收集对象 |

### 7.2 终止操作

开销以物化之后计；`k` 为目标位置，`n` 为元素数量。

| 终止操作 | 返回 | 时间 | 空间 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | O(n) | O(n) | 排空缓冲区 |
| `toSet()` | `Set<E>` | O(n) average | O(n) | 按标识去重 |
| `toMap(keyExtractor, valueExtractor?)` | `Map<K, V>` | O(n) average | O(n) | 后写覆盖 |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | O(1) | 缓冲区已知 |
| `forEach(action)` | `void` | O(n) | O(1) | `action(element, index)` |
| `join(…)` | `string` | O(n) | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `log()` / `error()` | `void` | O(n) | O(n) | 包裹在 `[prefix … suffix]` 中的控制台输出 |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | O(1) | 类 IO 的终止操作 |
| `collect(collector)`<br>`collect(identity, accumulator, finisher)` | `R` | O(n) | accumulator | 上述每个终止操作背后的通用折叠 |
| `reduce(accumulator)` | `Optional<E>` | O(n) | O(1) | 空流 → 空 Optional |
| `reduce(identity, accumulator)` | `E` | O(n) | O(1) | — |
| `reduce(identity, accumulator, finisher)` | `R` | O(n) | O(1) | — |
| `group(classifier)` | `Map<K, E[]>` | O(n) average | O(n) | — |
| `groupBy(keyExtractor, valueExtractor)` | `Map<K, V[]>` | O(n) average | O(n) | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | O(n) | 按索引以轮询方式分到 `count` 个桶 |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | O(n) | 桶编号来自分类器 |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) worst, short-circuits | O(1) | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | O(1) | 物化顺序中的位置 |
| `findAt(k)` | `Optional<E>` | O(k), stops early | O(1) | 物化顺序中的第 (k+1) 个元素 |
| `findNegativeAt(k)` | `Optional<E>` | O(n−k), stops early | O(1) | 从物化顺序末尾倒数 |
| `findMaximum(comparator?)` / `findMinimum(comparator?)` | `Optional<E>` | O(n) (O(1) on statistics) | O(1) | 默认为结构性比较 |
| `frequency()` | `Map<E, bigint>` | O(n) average | O(n) | 仅统计类可收集对象 |
| `[Symbol.iterator]()` / `[Symbol.asyncIterator]()` | iterator | O(n) | O(1) | 对可收集对象使用 `for…of` |

### 7.3 示例

```typescript
const stream = () => useOf(1, 2, 3, 4, 5).toUnordered();

stream().count();                                    // 5n
stream().anyMatch(n => n > 4);                       // true
stream().allMatch(n => n > 0);                       // true
stream().nonMatch(n => n > 9);                       // true
stream().findFirst().orElse(-1);                     // 1
stream().findLast().orElse(-1);                      // 5
stream().findMaximum().orElse(-1);                   // 5
stream().findAt(2n).orElse(-1);                      // 3 (materialised position 2)
stream().findNegativeAt(-1n).orElse(-1);             // 5 (last materialised element)
stream().join("|");                                  // "[1|2|3|4|5]"
stream().reduce((a, b) => a + b).orElse(0);          // 15
stream().reduce(100, (a, b) => a + b);               // 115
stream().group(n => (n % 2 === 0 ? "even" : "odd"));  // Map { odd: [1,3,5], even: [2,4] }

useRange(0n, 9n).toUnordered().partition(3n);
// [[0n,3n,6n], [1n,4n,7n], [2n,5n,8n]] — round-robin by index

useRange(0n, 6n).toUnordered().partitionBy((_element, index) => index % 2n);
// [[0n,2n,4n], [1n,3n,5n]]

// The fold is public: write your own collector inline
useOf(1, 2, 3).toUnordered().collect(
  () => 0,                          // identity
  (sum, element) => sum + element,  // accumulator
  sum => `total=${sum}`             // finisher
);                                                 // "total=6"
```

---

<a id="8-statistics"></a>
## 8. 统计

`toNumericStatistics()` 与 `toBigintStatistics()` 提供按值排序的缓冲区及一套统计 API。两者都接受 mapper，因此你可以基于投影值计算：`.average(element => element.price)`。

| 方法 | 含义 | `number` | `bigint` |
| :--- | :--- | :--- | :--- |
| `summate()` | Σx | 精确 | 精确 |
| `average()` / `mean()` | Σx / n | 精确 | 整数除法 |
| `median()` | 中间值（偶数个时取两个中间值的平均） | 精确 | 取整 |
| `mode()` | 最频繁的值 | 精确 | 精确 |
| `variance()` | 总体方差 σ² | 精确 | 取整 |
| `standardDeviation()` | √σ² | 精确 | 取整 |
| `range()` | 最大值 − 最小值 | 精确 | 精确 |
| `quantile(q)` | 最近秩分位数，`0 ≤ q ≤ 1` | 精确 | 精确 |
| `interquartileRange()` | q(0.75) − q(0.25) | 精确 | 精确 |
| `skewness()` | Σ((x−μ)/σ)³ / n | 精确 | 取整 |
| `kurtosis()` | Σ((x−μ)/σ)⁴ / n − 3（超额） | 精确 | 取整 |
| `frequency()` | 值 → 计数 | `Map<E, bigint>` | `Map<E, bigint>` |

在已排序的缓冲区上，所有方法均为 O(1)（排序在物化时只付一次），例外是 `frequency()`，其平均 O(n)、空间 O(n)。

`bigint` 结果以浮点计算后再取整回 `bigint`，因为整数除法会扭曲结果（ `[1n,2n,3n,4n]` 的方差是 `1.25`，而非 `3`）。若需要精确的小数统计，请映射到 `number` 并使用数值收集器。

```typescript
const stats = useOf(1, 2, 3, 4).toNumericStatistics();
stats.summate();              // 10
stats.average();              // 2.5
stats.median();               // 2.5
stats.variance();             // 1.25
stats.standardDeviation();    // 1.118…
stats.skewness();             // 0
stats.kurtosis();             // -1.36 (excess kurtosis)
stats.range();                // 3
stats.quantile(0.5);          // 2 (nearest rank)
stats.frequency();            // Map { 1 => 1n, 2 => 1n, 3 => 1n, 4 => 1n }

// Projected statistics
useOf({ price: 10 }, { price: 30 }).toNumericStatistics().average(item => item.price);   // 20
```

---

<a id="9-windows"></a>
## 9. 窗口

`toWindow()` 返回一个可收集对象，其 `slide` / `tumble` 会生成一个*语义的语义*。

```typescript
const windows = useOf(1, 2, 3, 4, 5).toWindow();

windows.tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2], [3,4], [5]]

windows.slide(3n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2,3], [2,3,4], [3,4,5], [4,5], [5]]   — trailing partial windows are included
```

`tumble(size)` 整体为 O(n)；`slide(size, step)` 为 O(n × size)，因为窗口会重叠。

异步源的工作方式相同；`slide` / `tumble` 会等待底层缓冲区就绪：

```typescript
const asyncWindows = await useFrom(tick()).toWindow().tumble(2n).toUnordered().toArray();
for (const window of asyncWindows) {
  console.log(await window.toUnordered().toArray());
}
```

---

<a id="10-the-index-model"></a>
## 10. 索引模型

索引模型分成两半：**管道**廉价而惰性地重写索引；**可收集对象**决定这些索引的含义。这种拆分是刻意的，排序开销也正源于此。

| 概念 | 行为 |
| :--- | :--- |
| 索引类型 | `bigint`，始终作为每个回调的第二个参数可用 |
| 管道运算 | `reverse()` = `redirect(-i - 1n)`，`translate(o)` = `redirect(i + o)`，`shuffle()` = `redirect(random)`——全部为每元素 O(1)、全部惰性、均不缓冲任何内容 |
| `toUnordered()`——不做记账 | 在 `Map` 中保留每个原始索引原样不动。`translate(2)` 以无序方式收集时仍产生索引 `2n,3n,4n,…`。这正是性能契约：不排序、不归一化、O(n) |
| `toOrdered()`——归一化 | 将每个索引重写为 `((i mod n) + n) mod n`（n = 元素数量），然后排序。负数或过大的索引会折叠进 `0..n−1`，因此 `reverse`、`translate(7)` 与 `shuffle` 都落在有效位置上 |
| `toOrdered(comparator)` | 按值排序并将索引重建为位置——统计即使用此方式 |
| 旋转 | 源自归一化：`translate(2)` 给出索引 `2,3,4,0,1`，排序后得到旋转 `[4,5,1,2,3]`。操作符内部不发生缓冲 |
| 重复索引 | 由 `toUnordered()` 检测并赋予代理键，因此**不会静默丢弃任何元素**；`toOrdered()` 保持相等索引的相对顺序 |
| `findAt(k)` / `findNegativeAt(k)` | 寻址**物化顺序**——`findAt(1n)` 永远是可收集对象产出的第二个元素，`findNegativeAt(-1n)` 永远是最后一个——无论 `redirect` / `reverse` / `translate` 对原始索引做了什么 |
| `distinct` | 保留首次出现**及其原始索引** |
| `sub` / `skip` / `limit` | 计数元素，而非索引值 |

简而言之：**`OrderedCollectable` 及其子类拥有索引记账**（按 n 取模归一化、排序、按位置寻址），而**`UnorderedCollectable` 通过永不触碰索引来保证性能**。请按查询而非按管道来选择。

---

<a id="11-the-asynchronous-model"></a>
## 11. 异步模型

数据尚不存在的源会返回 `AsynchronousSemantic<E>`：

| 异步源 | 原因 |
| :--- | :--- |
| `usePromise` | 值稍后到达 |
| `useBlob` | `Blob.stream()` 是异步的 |
| `useInterval` | 由 `setInterval` 驱动 |
| `useSubscription` | 由外部事件驱动 |
| `useFrom` / `useIterate` 搭配 `AsyncIterable` | 由 `for await` 产出 |

消费是统一的——`AsynchronousCollectable` 的每个终止操作都返回 `Promise`，且其语义（索引模型、归一化、按位置 `findAt`）与同步侧完全一致：

```typescript
const stats = await useFrom(asyncGenerator()).map(n => n * 2n).limit(10n).toBigintStatistics();
await stats.summate();

for await (const element of usePromise(Promise.resolve(1)).toUnordered()) {
  console.log(element);
}
```

类型系统无法替你规避的三件事：

1. **结束流。** 事件或定时器源不会自行完成。请定义边界——`limit(n)`、`sub(start, end)` 或 `takeWhile(predicate)`——否则订阅会一直存活。
2. **await 可收集对象。** `toOrdered()`、统计与 `toWindow()` 会等待源完成才返回；一个永不完成的、仅含 promise 的源会让它们一直挂起。
3. **混用层。** 同步可收集对象无法消费异步源。一旦涉及异步工厂，请让整条管道保持在异步侧，并对终止操作 `await`。

---

<a id="12-utility-helpers"></a>
## 12. 工具辅助函数

| 辅助函数 | 用途 | 时间 |
| :--- | :--- | :--- |
| `useCompare(a, b)` | 每个默认排序/最小/最大所使用的结构性比较（`number`、`bigint`、`string`、`boolean`、`symbol`、经 `Symbol.toPrimitive` 的对象） | 基础类型 O(1) |
| `useRandom(start, end?)` | 随机 `number` / `bigint`，在半开区间上均匀 | O(1) |
| `useHash(value, …)` | 对任意值（基础类型、对象、环）稳定的约等于 64 位 `bigint` 哈希 | 已访问值上 O(v) |
| `register(type, handler)` / `unregister(type)` / `maskOf(type)` | 为自定义类型扩展哈希 | O(1) |
| `useTraverse(object, callback)` | 带环保护的深度遍历；回调接收 `(key, value, path)` | O(v + e) |
| `useStringify(object, callback?)` | 可承受循环引用的 JSON 序列化 | O(v + e) |
| `useToNumber(value)` / `useToBigInt(value)` | 全转换（从不抛出；对不可用输入返回 `0` / `0n`） | O(1) |
| `useGenerator(iterable)` / `useArrange(source, comparator?)` | 原始 `(accept, interrupt)` generator，以及一个排序 generator | O(n) / O(n log n) |
| `Optional<T>` | `of`、`ofNullable`、`ofNonNull`、`empty`；`map`、`flat`、`flatMap`、`filter`、`get`、`get(default)`、`ifPresent(action, elseAction)`、`orElse`、`isPresent`、`isEmpty`、`semantic()` | 每个方法 O(1) |
| 类型守卫 | `isNumber`（排除 `NaN` 与 `Infinity`）、`isBigInt`、`isString`、`isBoolean`、`isSymbol`、`isFunction`、`isObject`、`isPrimitive`、`isIterable`、`isAsyncIterable`、`isPromise`、`isAsyncFunction`、`isGeneratorFunction`、`isAsyncGeneratorFunction`、`isOptional`、`isSynchronousSemantic` / `isAsynchronousSemantic`、`isSynchronousCollectable`（含异步）、`isSynchronousOrderedCollectable`、`isSynchronousUnorderedCollectable`、`isSynchronousStatistics`、`isSynchronousNumericStatistics`、`isSynchronousBigIntStatistics`、`isSynchronousWindowCollectable`、`isSynchronousCollector` | O(1) |

```typescript
useCompare(1, 2);                        // negative
useRandom(1n, 10n);                      // 1n … 9n
useHash({ a: 1 }) === useHash({ a: 1 }); // true — stable and structural
useTraverse({ a: { b: 1 } }, (key, value) => console.log(key, value));
useToBigInt("42");                       // 42n
Optional.ofNullable(null).orElse(5);     // 5
```

---

<a id="13-comparison-with-other-libraries"></a>
## 13. 与其他库的对比

| 维度 | Semantic-TypeScript | RxJS | 原生迭代器 |
| :--- | :--- | :--- | :--- |
| 模型 | 采用显式 `interrupt` 信号的推送 | 推送、订阅对象 | 拉取 |
| 位置 | 每个元素上的内在 `bigint` 索引 | 你组合出的操作符（`scan`、`withLatestFrom`） | 手动计数器 |
| 惰性 | 操作符惰性、可收集对象显式 | 操作符惰性、`subscribe` 及早 | 惰性 |
| 同步 + 异步 | 同一套 API，异步工厂在类型中标明 | 异步优先 | 手动桥接 `for await` |
| 终止 API | 丰富的可收集对象（`toArray`、`toMap`、`group`、`reduce`、`find*`、统计） | 仅操作符 | 无 |
| 统计 | 内建，支持 `number` 与 `bigint` | 外部 | 无 |
| 生命周期安全 | 边界操作符负责退订 | 手动 `unsubscribe` / `takeUntil` | 手动 |
| 生态 / 体积 | 小巧、零依赖 | 庞大的操作符生态 | 零 |

当你需要带显式开销模型、且无调度器的索引驱动数据处理时，选择 Semantic-TypeScript。当你需要其操作符生态、多观察者语义与调度器控制时，选择 RxJS。

---

<a id="14-performance-characteristics"></a>
## 14. 性能特征

一次查询的开销是三个可见部分之和：源（§5）、操作符（§6）、可收集对象（§7）。没有任何隐藏部分会被运行两次。

| 操作 | 时间 | 空间 | 说明 |
| :--- | :--- | :--- | :--- |
| `map` / `filter` / `peek` | O(1) 每元素 | O(1) | 纯转换 |
| `limit` / `takeWhile` | O(1) 每元素 | O(1) | 立即停止上游 |
| `reverse` / `translate` / `shuffle` | O(1) 每元素 | O(1) | 仅索引运算——不缓冲 |
| `distinct` | 平均 O(1) 每元素 | O(n) | 键的 `Set` |
| `toUnordered()` | O(n) | O(n) | 每个元素一次 `Map` 插入；索引不动 |
| `toOrdered()` | O(n log n) | O(n) | 归一化 O(n) + 排序 O(n log n) |
| 统计 | 一次性 O(n log n)，之后每个方法 O(1) | O(n) | 保留已排序/已聚合的缓冲区 |
| `findAt(k)` / `findNegativeAt(k)` | O(k) / O(n−k) | O(1) | 一旦越过该位置即提前中断 |
| `findMaximum` / `findMinimum` | 通用 O(n)，统计上 O(1) | O(1) | 单次遍历并维护当前最优 |

经验法则：在真正需要结果之前保持管道惰性；除非顺序重要，否则优先使用 `toUnordered()`；尽可能早地放置 `limit` / `takeWhile`（在语义允许的前提下）；让*可收集对象*而非操作符来决定排序的开销。

---

<a id="15-pitfalls-and-faq"></a>
## 15. 陷阱与常见问题

**「我的管道什么也不返回 / 卡住了。」** 源从未结束。`useInterval`、`useSubscription`、`usePromise` 与 `useGenerate` 需要一个边界（`limit`、`sub`、`takeWhile`）或一个会完成的源。

**「`reverse()` 没起作用。」** 你用 `toUnordered()` 消费了它，而后者保证不做索引记账。请改用 `toOrdered()`。

**「`translate(2)` 返回的元素未旋转。」** 同样的原因：`translate` 只平移索引；旋转由 `toOrdered()` 的模归一化实现。以无序方式收集时，平移在原始索引中依然可见。

**「为什么少了一个元素？」** 上游产生了重复索引，而你正通过 `toUnordered()` 消费。代理键可防止数据丢失，但如果你需要按顺序*看到*两个元素，请改用 `toOrdered()` 消费。

**「`findAt(1n)` 返回了意想不到的结果。」** `findAt` 寻址的是**物化顺序**，而非原始索引。在 `.reverse().toOrdered()` 之后，位置 1 是反转序列的第二个元素。若想要携带原始索引 `1n` 的元素，请显式按索引过滤。

**「`bigint` 统计看起来被取整了。」** 确实如此——`bigint` 结果按设计做了整数取整（见 [统计](#8-statistics)）。映射到 `number` 可获得精确的分数。

**「我必须在 `toArray()` 之前调用 `toXxx()` 吗？」** 是的。终止操作存在于可收集对象上，而非语义对象上。这是刻意的设计：它让存储与排序开销在类型中可见。

**「它支持 tree-shaking 吗？」** 已声明 `sideEffects: false`，因此请只导入你用到的内容。注意：模块加载时 `useHash` 会注册其默认处理器。

---

<a id="16-license"></a>
## 16. 许可证

MIT © Eloy Kim

完整发布历史见 [CHANGELOG.md](./CHANGELOG.md)。
