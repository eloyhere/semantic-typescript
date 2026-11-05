# **Semantic-TypeScript**

**資料流，已索引。** 您的資料，盡在精準掌控之中。

[English](./readme.md) · [简体中文](./readme.cn.md) · 繁體中文 · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

一個型別安全的串流處理函式庫，統合了 **JavaScript 生成器**、**Java Stream** 與**以索引定址的資料存取**。每個元素都攜帶一個 `bigint` 索引，每條管線皆為惰性求值，而每個終端操作都需明確選用。

```bash
npm install semantic-typescript
```

- 零執行期依賴，純 ESM，自帶型別定義。
- 684 個迴歸測試：`npm test`。
- 完整變更歷程：[CHANGELOG.md](./CHANGELOG.md)。

---

## Table of Contents

1. [設計哲學](#1-design-philosophy)
2. [架構](#2-architecture)
3. [快速上手](#3-quick-start)
4. [工廠函式](#4-factory-functions)
5. [轉換算子](#5-transformation-operators)
6. [可收集器與終端操作](#6-collectables-and-terminal-operations)
7. [統計與視窗](#7-statistics-and-windows)
8. [索引模型](#8-the-index-model)
9. [非同步模型](#9-the-asynchronous-model)
10. [週期性分析：環、場與分數](#10-periodic-analysis-rings-fields-and-scores)
11. [輔助工具](#11-utility-helpers)
12. [效能與陷阱](#12-performance-and-pitfalls)
13. [相位環：一個精確的循環](#13-phase-rings)
14. [訊號分析：窗、頻譜與時間](#14-signal-analysis)
15. [授權](#15-license)

---

<a id="1-design-philosophy"></a>
## 1. 設計哲學

三個想法，一條管線：

**索引即資料。** 每個元素都以一個 `bigint` 定址。反轉、輪轉、洗牌與分割都是索引算術，而非緩衝區操作。在可收集器要求它之前，不會有任何東西被具體化。

**惰性是預設。** 工廠函式包裝生成器；算子再包裝另一個生成器。直到終端操作執行之前，都不會要求任何元素，因此只要下游有東西讓它停下來，無限來源便完全合法。

**終端是明確的。** `map` 回傳的是 `Semantic`，而不是陣列。唯有你指名可收集器時，值才會出現——`toUnordered()`、`toOrdered()`、`toNumericStatistics()`、`toWindow()`——而每一個都說明了它的成本，以及它產生的順序。

同樣的紀律也適用於函式庫的數學部分。`Complex`、`Angle` 或 `Frequency` 是不可變的值，其不變量在建構時即受檢查；`Optional` 取代 `null`；而相位環則確切說明它持有多少元素、具有什麼週期，以及平衡程度如何。

---

<a id="2-architecture"></a>
## 2. 架構

```
factory  ──▶  Semantic  ──▶  Semantic  ──▶  Collectable  ──▶  result
 (source)      (map)         (filter)        (terminal)
                    ▲
                    └── every operator returns a new Semantic wrapping a generator
```

| 層級 | 模組 | 職責 |
| :--- | :--- | :--- |
| 來源 | `synchronous/collectors`, `asynchronous/collectors` | 包裝一個可迭代物件、生成器、promise、blob、事件目標 |
| 管線 | `synchronous/semantic`, `asynchronous/semantic` | 惰性算子與索引重寫 |
| 可收集器 | `synchronous/semantic`, `asynchronous/semantic` | 有序、無序、統計、視窗與自訂終端 |
| 收集器 | `synchronous/collector`, `asynchronous/collector` | 每個終端據以建構的摺疊基元 |
| 數學 | `mathematics/*` | 角、複數、頻率、頻譜、視窗、估計量、本輪、相位環 |
| 結構 | `structure/*` | 串列、集合、映射、樹、森林、環、場 |
| 錯誤 | `structure/error` | 型別化的 `SemanticError` 階層及其品牌守衛 |

同步與非同步家族共用同一套詞彙：相同的算子名稱、相同的索引語意、相同的可收集器。非同步變體只是回傳 promise，並且會將寫入排入佇列，因此寫入之後發出的讀取必定能觀察到它。

### 2.1 本次發佈移動了什麼、破壞了什麼

有三個模組改變了位置或形態，另有一組預設值的含義發生了變化。每一種舊行為都仍可透過明確選項抵達；沒有任何東西在沒有替代品的情況下被移除。

| 變更 | 之前 | 現在 |
| :--- | :--- | :--- |
| 森林 | `structure/tree/rootedForest`、`structure/tree/unionFindForest` | `structure/forest/rootedForest`、`structure/forest/unionFindForest`；`tree/index.ts` 不再重新匯出它們 |
| 錯誤 | 臨時的原生錯誤 | `structure/error.ts` 中的十五類階層，每類各帶一個品牌守衛，另有 `SemanticRangeError` 別名 |
| 估計量選項 | 固定定義 | `mathematics/quantile.ts` 匯出 `QuantileMethod`、`QuantileOptions`、`SkewnessEstimator`、`KurtosisEstimator` 與 `VarianceOptions` |
| `quantile` | Hyndman–Fan 型別 1 | 型別 7 —— R `quantile`、NumPy `linear`、Excel `PERCENTILE.INC` |
| `skewness` / `kurtosis` | `g1` / `g2` | 偏差校正的 `G1` / `G2` |
| `variance` / `standardDeviation` | `ddof = 0` | `ddof = 1`，並以 `Optional` 包裝 |
| `decibel` | 一個 `20·log10` 函式 | 已移除；改為 `amplitudeDecibel`（20·log10）與 `powerDecibel`（10·log10） |
| `Spectrum.flatness()` | 兩半的振幅 | 單側半的功率 |
| `Spectrum.bandEnergy()` | 原始雙側求和 | 預設單側，並折疊共軛半邊 |
| `shortTimeFourierTransform` / `spectrogram` | 對稱 Hann、僅完整幀 | 週期 Hann、`boundary: "zeros"`、`padded: true` |

第 6、7、10 章記錄了這些替代品；實測影響見 [CHANGELOG.md](./CHANGELOG.md)。

---

<a id="3-quick-start"></a>
## 3. 快速上手

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
## 4. 工廠函式

建構恆為 O(1)——工廠函式只包裝生成器。下表說明*消費* `n` 個元素的成本，再加上來源本身所需的額外空間。

| 工廠函式 | 簽章（結果） | 時間（消費 n） | 空間（來源） | 備註 |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | 索引為 0..n−1；展開引數已具體化 |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | 包裝任何可迭代物件；收集時迭代一次 |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` 為開區間（不含）；`step` 必須非零；`number` 與 `bigint` 皆可運作 |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | supplier 會為每個元素呼叫一次 |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | `concat` 的單位元素 |
| `useText` | `useText(text, delimiter?)` | O(n) | 文字本身為 O(n) | 迭代**碼點**，因此 emoji 與 CJK 皆保持為單一元素 |
| `useAttribute` | `useAttribute<T>(object)` | O(v + e) | O(d + v) | 以循環保護遞迴走訪巢狀物件 |
| `useGenerate` | `useGenerate<E>(supplier, interrupt)` | O(n) × supplier 成本 | O(1) | **必須**具備停止用的 `interrupt`，或下游的 `limit` |
| `useIterate` | `useIterate<E>(Iterable<E>)` / `(AsyncIterable<E>)` | 每次收集 O(n) | O(1) | 每次收集時重播迭代器 |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period（真實時間） | O(1) | 發出經過的時間 |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | 位於索引 `0n` 的單一元素 |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob 大小) | 每次複製 O(chunk) | 預設區塊為 64 KiB |
| `useSubscription` | `useSubscription(target, subscriber, event) → AsynchronousSemantic<Event>` | 每個事件一個元素 | O(1) | `limit()` / `takeWhile()` 定義取消訂閱的邊界 |

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
## 5. 轉換算子

每個算子都回傳一個新的 `Semantic`；在可收集器執行之前，沒有任何算子會觸及元素。時間是**每個元素**的額外成本；空間則是管線執行期間算子保留的記憶體。

| 算子 | 用途 | 索引效果 | 時間 | 空間 |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | 1:1 轉換 | 轉發 | O(1) | O(1) |
| `filter(predicate)` | 保留符合的元素 | 轉發 | O(1) | O(1) |
| `flat(mapper)` / `flatMap(mapper)` | 1:N 扁平化 | 自 0 重新索引 | 每次發出 O(1) | O(1) |
| `distinct(keyExtractor?)` | 捨棄重複的鍵，保留第一個 | 轉發 | 平均 O(1) | O(n) |
| `peek(consumer)` | 副作用，元素直接通過 | 轉發 | O(1) | O(1) |
| `limit(count)` | 取前 *n* 個 | 自 0 重新索引 | O(1) | O(1) |
| `skip(count)` | 捨棄前 *n* 個 | 轉發 | O(1) | O(1) |
| `sub(start, end)` | 依位置的切片 `[start, end)` | 轉發 | O(1) | O(1) |
| `takeWhile(predicate)` | 述詞成立時持續取用 | 轉發 | O(1) | O(1) |
| `dropWhile(predicate)` | 述詞成立時持續捨棄 | 自 0 重新索引 | O(1) | O(1) |
| `concat(other)` | 附加一個語意物件或可迭代物件 | 延續索引 | O(1) | O(1) |
| `redirect(redirector)` | 隨你計算新索引 | **由你決定** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | 取負並位移 | O(1) | O(1) |
| `translate(offset \| mapper)` | 位移每個索引 | `i + offset` | O(1) | O(1) |
| `shuffle(mapper?)` | 隨機化索引 | 隨機 | O(1) | O(1) |
| `pipe(conversion)` | 將生成器交給自訂函式 | 由你決定 | 由你決定 | 由你決定 |
| `semantic()` | 將可收集器提升回語意物件 | 不變 | O(1) | O(1) |

**`reverse`、`translate` 與 `shuffle` 只重寫索引。** 在 `toOrdered()` 以元素數量為模數正規化索引之前，不會有任何東西被緩衝或輪轉：

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

---

<a id="6-collectables-and-terminal-operations"></a>
## 6. 可收集器與終端操作

### 6.1 可收集器

可收集器同時擁有**順序**與**索引簿記**。`n` 為元素數量。

| 可收集器 | 結構 | 時間 | 順序 | 適用時機 |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | `Map<bigint, E>` 以索引為鍵 | O(n) | 插入順序 | 最大吞吐量；原始索引原封不動地保留 |
| `toOrdered()` | 依元素索引排序的陣列 | O(n log n) | 依正規化索引 | 反轉／輪轉必須生效 |
| `toOrdered(comparator)` | 依你的比較子排序 | O(n log n) | 依你的比較子 | 已排序的視圖 |
| `toNumericStatistics()` | 依值排序的緩衝區 | O(n log n) | 依值 | 針對 `number` 的統計 |
| `toBigintStatistics()` | 依值排序的緩衝區 | O(n log n) | 依值 | 針對 `bigint` 的統計 |
| `toWindow()` | 依值排序的緩衝區 | O(n log n) | 依值 | `slide` / `tumble` |
| `toCollectable(mapper)` | 由 mapper 回傳的內容決定 | — | — | 自訂可收集器 |

### 6.2 終端

每個終端都活在**可收集器**上，而不是 `Semantic` 上。這正是「終端是顯式的」在實踐中的含義：在指定一個可收集器之前，管線不產生任何東西，而不帶 mapper 的 `toCollectable()` 就是最便宜的指定方式。

| 終端 | 回傳 | 時間 | 備註 |
| :--- | :--- | :--- | :--- |
| `toArray()` / `toSet()` | `Array<E>` / `Set<E>` | O(n) | 排清緩衝區；`toSet` 依同一性去重複 |
| `toMap(key, value?)` | `Map<K, V>` | 平均 O(n) | 後寫入者勝出 |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | 緩衝區已經知道 |
| `forEach(action)` | `void` | O(n) | `action(element, index)` |
| `join(…)` | `string` | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `reduce(…)` | `Optional<E>` / `E` / `R` | O(n) | 空串流 → 空 `Optional` |
| `group(classifier)` / `groupBy(key, value)` | `Map<K, E[]>` | 平均 O(n) | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | 依索引輪詢分配 |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | 桶號來自分類器 |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | 最差 O(n)，會短路 | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | 依具體化順序定位 |
| `findAt(k)` / `findNegativeAt(k)` | `Optional<E>` | O(k) / O(n−k) | 從前端／末端起算 |
| `findMaximum(cmp?)` / `findMinimum(cmp?)` | `Optional<E>` | O(n) | 預設為結構化比較 |
| `frequency()` | `Map<E, bigint>` | 平均 O(n) | 僅限統計可收集器 |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | 類 IO 的終端 |
| `collect(collector)` | `R` | O(n) | 上述每個終端背後的通用摺疊 |

### 6.3 結構收集器

`toArray`、`toSet` 與 `toMap` 把管線終結在 JavaScript 容器裡。另有十二個終端把它終結在函式庫自有的某個結構中，於是結果攜帶的是那個結構所保證的不變量，而不是陣列恰好具有的那些。它們在每個可收集器上都可用，包括 `toCollectable()` 給出的那個裸可收集器。

| 終端 | 回傳 | 順序 | 代價 |
| :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | 走訪順序 | O(n) |
| `toSet()` | `Set<E>` | 插入順序，SameValueZero | 平均 O(n) |
| `toMap(key, value?)` | `Map<K, V>` | 插入順序；後寫覆蓋 | 平均 O(n) |
| `toOrderedSet(comparator?)` | `SynchronousOrderedSet<E>` | 依比較子升冪 | 最差 O(n²) |
| `toUnorderedSet()` | `SynchronousUnorderedSet<E>` | 未指定（雜湊桶） | 期望 O(n) |
| `toOrderedMap(key, value?)` | `SynchronousOrderedMap<K, V>` | 插入順序；後寫覆蓋 | 期望 O(n) |
| `toUnorderedMap(key, value?)` | `SynchronousUnorderedMap<K, V>` | 未指定 | 期望 O(n) |
| `toList()` | `SynchronousList<E>` | 走訪順序，保留重複 | O(n) |
| `toRing(span?)` | `SynchronousRing<E>` | 走訪順序決定環上位置 | O(n) |
| `toLRUSet(capacity)` | `SynchronousUnorderedLRUSet<E>` | 依最近使用；只留最後 `capacity` 個 | 最差 O(n²) |
| `toLRUMap(capacity, key, value?)` | `SynchronousUnorderedLRUMap<K, V>` | 依最近使用 | 期望 O(n) |
| `toSkipSet(comparator?)` | `SynchronousSkipSet<E>` | 依比較子升冪，可導航 | 最差 O(n²) |
| `toSkipMap(key, value?)` | `SynchronousSkipMap<K, V>` | 依鍵比較子，可導航 | 期望 O(n) |
| `toBinarySearchTree(comparator?)` | `SynchronousBinarySearchTree<E>` | 依比較子升冪，高度平衡 | O(n log n) |
| `toRootedForest()` | `SynchronousRootedForest<E>` | 走訪順序即結構順序 | O(n) |

結果型別跟隨可收集器自身的元素型別，因此沒有任何終端需要型別引數：一個 `SynchronousCollectable<E>` 直接交給你 `Array<E>`、`SynchronousList<E>` 或 `SynchronousOrderedSet<E>`。剩下的只有業務引數——`toOrderedSet` / `toSkipSet` / `toBinarySearchTree` 的比較子、LRU 對的容量、`toRing` 的跨度，以及映射族的鍵與值提取器。

一個環是集合，因此重複元素只保留首次出現的位置；上述其餘結構除非自身契約另有規定，否則都保留重複（`toOrderedSet`、`toUnorderedSet`、`toSkipSet` 是集合；`toBinarySearchTree` 與 `toList` 不是）。

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

非同步可收集器暴露同一批終端，並把每一個都解析進 promise，因此呼叫形式只多了一個 `await`。

---

<a id="7-statistics-and-windows"></a>
## 7. 統計與視窗

### 7.1 統計介面

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();                    // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();                    // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();                     // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                       // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance().get();             // 3.2    (n − 1)
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation().get();    // 1.7889 (n − 1)
```

兩個統計家族提供相同的介面——`summate`、`average`、`median`、`mode`、`variance`、`standardDeviation`、`frequency`、`findMaximum`、`findMinimum`——而 `toBigintStatistics()` 使用 `bigint` 算術。離散度量與分位數一族回傳 `Optional`，因為樣本可能小到讓它們無從定義；請用 `.get()`、`.orElse(…)` 或 `.isPresent()` 取出。

### 7.2 估計量與預設定義

這些預設值就是 R、NumPy、pandas 與 Excel 所使用的定義，因此這裡算出的值可以直接與那些工具比對，無需任何修正因子。

| 統計量 | 預設 | 舊預設 | 恢復舊值的方式 |
| :--- | :--- | :--- | :--- |
| `quantile(probability)` | Hyndman–Fan 型別 7 | 型別 1 | `{ method: "type-1" }` |
| `interquartileRange()` | Hyndman–Fan 型別 7 | 型別 1 | `{ method: "type-1" }` |
| `skewness()` | 偏差校正的 `G1` | `g1` | `{ estimator: "g1" }` |
| `kurtosis()` | 偏差校正的超額 `G2` | `g2` | `{ estimator: "g2" }` |
| `variance()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |
| `standardDeviation()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |

九種 Hyndman–Fan 型別均可寫為 `"type-1"` … `"type-9"`，而 `{ excess: false }` 會把三加回峰度，報告非超額的四階標準化動差。這些選項型別——`QuantileMethod`、`QuantileOptions`、`SkewnessEstimator`、`KurtosisEstimator`、`VarianceOptions`——由 `mathematics/quantile.ts` 匯出。

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

`G1` 與 `G2` 分別在少於三個、四個觀測時無定義；在 `ddof = 1` 下，樣本變異數與標準差在少於兩個觀測時無定義。此時函式庫回傳空 `Optional`，而不是一個誤導性的零：

```typescript
useOf(1, 2, 3).toNumericStatistics().kurtosis().isEmpty();     // true  (G2 needs four observations)
useOf(1, 2).toNumericStatistics().skewness().isEmpty();        // true  (G1 needs three)
useOf(1).toNumericStatistics().variance().isEmpty();           // true  (ddof = 1 needs two)
useOf(1).toNumericStatistics().variance({ ddof: 0 }).get();    // 0
```

bigint 檢視接受相同的選項，並把每個結果四捨五入回整數 `bigint`。

### 7.3 視窗

視窗把緩衝區中的元素重新暴露為「管線的管線」，因此一個視窗無需先具體化成陣列就能被消費。兩種形式都包含最後一個不完整的視窗。

```typescript
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[2,3],[3,4],[4]]

useFrom([1, 2, 3, 4]).toWindow().tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[3,4]]
```

---

<a id="8-the-index-model"></a>
## 8. 索引模型

索引是附加在每個元素上的 `bigint`。算子不是**轉發**它、從零**重新索引**，就是讓你**自行計算**它。

有序收集會將每個索引以元素數量為模數正規化，再依結果排序。這就是為何在五個元素上，`translate(7)` 等同於 `translate(2)`：`7 ≡ 2 (mod 5)`。

無序收集則保留管線所產生的任何索引，並依到達順序回傳元素。負索引是合法的，且一旦正規化之後，就只是排在非負索引之前。

---

<a id="9-the-asynchronous-model"></a>
## 9. 非同步模型

`AsynchronousSemantic` 映照同步端的介面，但回傳 promise。寫入會被排入佇列，因此寫入之後發出的讀取必定能觀察到它。

```typescript
const ring = new AsynchronousRing([1, 2]);
const added   = ring.add(3);          // queued
const sampled = ring.elementAt(2n);   // observes the write above
await added;
(await sampled).get().element;         // 3
```

本質上即為非同步的工廠函式——`usePromise`、`useBlob`、`useInterval`、`useSubscription`——會直接回傳 `AsynchronousSemantic`，而 `useFrom` / `useIterate` 在收到 `AsyncIterable` 時會自行升級。

---

<a id="10-periodic-analysis-rings-fields-and-scores"></a>
## 10. 週期性分析：環、場與分數

函式庫的數學部分將循環視為一等物件，而非查詢表。三種建構協同運作。

### 10.1 一個環就是一個整數

`Ring` 是一個 **n 重環**：元素數量、位置週期與相異相位的數目都是同一個整數 `n`。位置的相位由其精確餘數計算而得，因此環具有位元級的週期性：

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

`frequency` 是**環境**旋轉速率，而不是位置之間的相位步進：環境會讓每個相量移動相同的角度，因此它永遠無法破壞內在樣式。`span` 則固定環所佔據的圈數。

`purity()` 是基頻模態所攜帶的能量佔比，`max(|c₁|², |c_{n−1}|²) / (n · Σ|z|²)`。當環在容許旋轉的意義下等同於 `n` 次單位根時，它恰好為 `1`，而其成本為 `O(n)`，因為只需要兩個頻段。兩個方向都會納入測試，因為環可能以任一方向繞行圓周。

### 10.2 場是一個有界分數

`PhaseField` 會將相對相位映射為 `[-1, 1]` 區間內的分數：

```typescript
import { useField, useRadian } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ): +1 aligned, −1 opposed
const mixed  = useField([0.4, 0.3, 0.3]);  // first three harmonics

cosine.sample(useRadian(0));               //  1
cosine.sample(useRadian(Math.PI));         // -1
```

分數是一個截斷的餘弦級數，`a₀ + Σ wₘ·cos(2πmΔ)`，而建構函式會強制 `|a₀| + Σ|wₘ| ≤ 1`。由三角不等式可知，分數永遠不會離開 `[-1, 1]`——這個界限是**建構的必然結果**，而不是事後施加的夾限。

場之所以是級數而非表格，原因在於：`n` 點表格能精確重現自身的取樣值，但其三角內插在取樣點之間會過衝。一張評分為 `[+1, +0.5, −1, −0.5, 0]` 的五點表格，內插結果落在 `[−1.0428, 1.0041]`，這已經違背了承諾。有界的級數則不會。

### 10.3 分析以每個元素為基準衡量資料

每個環元素都是一個參考相位。`analyse` 會將每個觀測值定位回環上，並以每個參考相位來衡量它：

```typescript
const ring = new SynchronousRing(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                              // 5
report.missed;                               // 1  ('zz' is not on the ring)
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

每個參考列都會回報 `count`（計數）、平均相對相位 `mean`，以及平均合力長度 `resultant`。有一個恆等式值得記住：**每個參考的 `resultant` 都相同**，因為改變基準只會讓所有相對相位旋轉一個常數。每個參考不同的是計數與平均值。

```typescript
const ring = new SynchronousRing(["a", "b", "c"]);
ring.scoresAt(0, cosine);                   // one score per position, in [-1, 1]
```

### 10.4 相關工具

| 呼叫 | 回答的問題 | 成本 |
| :--- | :--- | :--- |
| `purity()` | 環是否仍為 `n` 次單位根？ | O(n) |
| `resultant(t?)` | 相量此刻有多集中？ | O(n) |
| `analyse(data)` | 這筆資料相對於每個元素的關係如何？ | O(n · m) |
| `toSpectrum()` | 將環視為頻譜，波數位於頻率軸 | O(n²) |
| `useAngularSpectrum(ring, instants, plan)` | 隨時間變化的 `(ω, n)` 平面 | O(n² · frames) |

另有兩個基元補全了這個模型：`combineRings(a, b)` 以最小公倍數聯結兩個環（這是拉回，而非乘積——無法共享同一時刻的配對直接不存在），而 `rate()` 讓每個元素擁有自己的內在頻率，使環得以相對於環境漂移。`jetAt`、`windingAt` 與 `errorIntegralAt` 則揭露該漂移的微分狀態。

### 10.5 頻譜窗

環的構造是分析介面的一半；另一半工作在取樣訊號上。它最常被複用的基元是窗函式，而這裡的每一種形狀都有兩種形式。對稱形式用 `count − 1` 去除幀長；週期（DFT-even）形式用 `count`，比一個完整週期少一個取樣，因此在 DFT 所設想的週期延拓下，這個漸變是連續的。

```typescript
useHannWindow(1, 4);                                   // 0.75  symmetric
useHannPeriodicWindow(1, 4);                           // 0.5   periodic
coherentGain(useHannPeriodicWindow, 16);               // 0.5
equivalentNoiseBandwidth(useHannPeriodicWindow, 16);   // 1.5
```

| 形狀 | 對稱 | 週期 | 說明 |
| :--- | :--- | :--- | :--- |
| 矩形 | `useRectangularWindow` | — | 無漸變；沒有週期之分 |
| Hann | `useHannWindow` | `useHannPeriodicWindow` | 短時轉換的預設窗 |
| Hamming | `useHammingWindow` | `useHammingPeriodicWindow` | — |
| Blackman | `useBlackmanWindow` | `useBlackmanPeriodicWindow` | — |
| Nuttall | `useNuttallWindow` | `useNuttallPeriodicWindow` | 四項 Blackman–Harris |
| 平頂 | `useFlatTopWindow` | `useFlatTopPeriodicWindow` | 以解析度換取振幅精度 |
| Kaiser | `useKaiserWindow(beta)` | `useKaiserPeriodicWindow(beta)` | `beta` 決定主瓣寬度 |

分析與重疊相加請用週期形式：在半幀跳距下，週期 Hann 窗在任何長度上都求和為 `1.000000`，而對稱形式在 `N = 16` 時起伏 `0.841 dB`，到 `N = 1024` 仍有 `0.013 dB`。濾波器設計請保留對稱形式，那裡的幀並不是漸變的一個週期。

平頂窗在幀的兩端回傳**負權重**，因為平頂窗本來就是這樣。它們原樣回傳而不被截斷，因為截斷會擾動主瓣、摧毀這個窗存在的唯一理由——低扇貝損失：

```typescript
useFlatTopWindow(0, 1024);                             // -0.000421 — negative by definition
Array.from({ length: 1024 }, (_unused, index) => useFlatTopWindow(index, 1024))
  .filter(weight => weight < 0).length;                // 578
```

### 10.6 位準、平坦度與頻帶能量

`decibel` 作為單一函式已不復存在，因為振幅與功率並不共享同一個因子。`amplitudeDecibel` 對類似電壓的比值施加 `20·log10`；`powerDecibel` 對功率、能量、均方或功率頻譜密度施加 `10·log10`：

```typescript
amplitudeDecibel(0.25);                                // -12.0412
powerDecibel(0.25);                                    //  -6.0206
```

`Bin.decibel` 與 `Spectrum.decibelOf` 是振幅位準；`Spectrum.powerDecibelOf` 是對應的功率位準。把一個功率餵給振幅形式會報出 `20·log10(power)`，把分貝值翻倍。

有兩項頻譜量測改變了讀法：

```typescript
const twoBins = new Spectrum(new Sample(2, 1), [new Complex(2, 0), new Complex(1, 0)]);
twoBins.flatness();                                    // 0.8 — geometric over arithmetic mean of power

const shape = new Spectrum(new Sample(4, 1), [
  new Complex(1, 0), new Complex(2, 0), new Complex(0, 0), new Complex(0, 0),
]);
shape.bandEnergy(new Frequency(0), new Frequency(2));                // 9
shape.bandEnergy(new Frequency(0), new Frequency(2), "two-sided");   // 5
```

`flatness()` 比較的是頻譜單側半上 `power()` 的幾何平均與算術平均，而不是兩半上的振幅平均，並且刻意不施加 `oneSided()` 那個僅供顯示的振幅加倍。`bandEnergy()` 預設採用單側讀法，折疊共軛半邊，使 DC 與 Nyquist 各計一次、每個內部頻段計兩次；覆蓋整個頻帶的頻帶由此滿足 Parseval，即 `Σ|X|² = N·Σx²`。對複數頻譜請傳 `"two-sided"`，它的頻段本來就是獨立的。

### 10.7 短時分析

`Sampler.shortTimeFourierTransform` 與 `Sampler.spectrogram` 遵循 SciPy `stft` 的慣例：週期 Hann 窗、兩端零填充邊界，以及尾端零填充。

```typescript
const sampler = new Sampler(new Sample(64, 1));
const spectrogram = sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8);

spectrogram.size();                     // 9 frames
spectrogram.getBoundary();              // "zeros"
spectrogram.getTime(6);                 // 0.75 — frame centres, not frame starts
sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8, useHannWindow,
  { boundary: "none", padded: false }).size();                       // 7 — complete frames only
```

兩端延拓把第一幀的中心對準第一個取樣，尾端填充則讓最後幾個取樣不再不可達：64 個取樣、幀長 16、跳距 8 會產出 9 幀而不是 7 幀；1000 個取樣、幀長 256、跳距 128 會產出 9 幀而不是 6 幀。幀時間是中心而非起點——有延拓的檢視為 `(k·hop + (frameSize mod 2)/2)/rate`，無延拓的檢視為 `(k·hop + frameSize/2)/rate`——而 `toFrame()` 在反轉換前會裁掉延拓。

---

<a id="11-utility-helpers"></a>
## 11. 輔助工具

### 11.1 錯誤階層

`structure/error.ts` 匯出一個十五類的階層，用於在管線**周圍**拋出的錯誤——來自你自己的程式碼、自訂收集器或轉接器：

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

每個類別固定 `name`、轉發原生 `cause`、攜帶可選的 `context` 診斷包，並透過 `toJSON()` 序列化；每個類別都有一個同名的品牌守衛。

```typescript
const error = new CapacityError("LRU capacity exhausted", { context: { capacity: 0 } });

error.name;                 // "CapacityError"
isCapacityError(error);     // true
isValidationError(error);   // false — a capacity failure is not a validation failure
isSemanticError(error);     // true
error.toJSON();             // { name: "CapacityError", message: "…", context: { capacity: 0 } }
```

`SemanticRangeError` 與匯出的 `RangeError` 是同一個類別，因此 `instanceof` 在兩個名字之間都成立；而匯入 `RangeError` 會在整個模組內遮蔽全域建構子，這正是該別名存在的原因。這兩個類別都不會被函式庫自身的參數檢查拋出——那裡仍然拋原生的 `TypeError` 與 `RangeError`——這個階層是給上層使用的詞彙表。

### 11.2 工具表

| 輔助工具 | 用途 |
| :--- | :--- |
| `useCompare(a, b)` | 跨混合基元型別的全序 |
| `useToNumber` / `useToBigInt` | 無損、具範圍檢查的數值轉換 |
| `useRandom` | 具種子或不具種子的隨機輔助工具 |
| `useTraverse` | 巢狀物件與陣列的結構化走訪 |
| `useStringify` | 循環安全的 JSON 序列化 |
| `useHash` / `maskOf` / `register` / `unregister` | 結構化雜湊與雜湊策略註冊表 |
| `invalidate` / `validate` | 會拋出一致錯誤形狀的防護子句 |
| `Optional<T>` | 函式庫的 `null` 替代品：`Optional.of(x)` / `Optional.empty()` |

### 11.3 `useTraverse`

`useTraverse(target, callback)` 把任意物件攤平成它的**非空葉子**。它下鑽巢狀物件、依位置走訪可迭代值、跳過 `null` 與 `undefined`，並且永不重新進入已經造訪過的物件——因此帶環的物件圖會終止，而不是撐爆呼叫堆疊。

```typescript
const source = { id: 7, tags: ["a", "b"], owner: { name: "Ada", note: null } };
const leaves: string[] = [];

useTraverse(source, (key, value, path) => {
  leaves.push(`${path.join(".")} = ${String(value)}`);
  return true;
});

leaves;   // ["id = 7", "tags.0 = a", "tags.1 = b", "owner.name = Ada"]
```

回呼對每個葉子執行一次，收到葉子自身的鍵（葉子來自可迭代物件時是它的索引）、值，以及抵達它的路徑。回傳 `false` 會放棄**整次**走訪，而不只是當前分支：

```typescript
let visited = 0;
useTraverse({ a: 1, b: 2, c: 3 }, () => {
  visited += 1;
  return false;
});
visited;   // 1 — the first leaf already stops the walk
```

環之所以安全，原因相同：

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

**每次回呼都會拿到獨立的徑路快照。** 走訪內部只保留一個工作陣列，在交出葉子的那一刻把它複製成一個以 `Object.freeze` 凍結的新陣列。快照之後不再變化，因此可以原樣留存；兩個回呼之間從不共用同一個陣列，再次走訪也不會擾動已經發出的快照。它的型別是 `ReadonlyArray`，所以寫入它是編譯錯誤，而被凍結的陣列在執行期寫入還會拋 `TypeError`。這份安全性的代價是每個上報葉子多一次 `O(depth)` 的配置，而不會上報任何葉子的分支不產生額外配置。

```typescript
const paths: Array<ReadonlyArray<PropertyKey>> = [];
useTraverse({ a: { b: 1 }, c: 2 }, (_key, _value, path) => {
  paths.push(path);                      // safe to keep as-is
  return true;
});
paths[0] === paths[1];                   // false — one array per call
paths.map(path => path.join("."));       // ["a.b", "c"]
```

`useAttribute` 就是把這次走訪變成工廠：它以 `{ key, value }` 對的形式回報同樣的葉子，因此規則與代價完全一致。

```typescript
useAttribute({ a: 1, b: { c: 2 } }).toUnordered().toArray();
// [{ key: "a", value: 1 }, { key: "c", value: 2 }]
```

---

<a id="12-performance-and-pitfalls"></a>
## 12. 效能與陷阱

**惰性在每個階段都有代價。** 每個算子都會增加一層生成器跳躍。對於記憶體陣列上的緊密數值迴圈，樸素的 `for` 迴圈會勝過任何管線；當來源是惰性的、無限的，或管線長到足以讓索引紀律回本時，管線才會勝出。

**`toOrdered()` 會排序；`toUnordered()` 不會。** 如果反轉似乎「沒有生效」，那是因為收集器是無序的——索引重寫唯有在索引被正規化之後，才會成為順序。

**沒有 `interrupt` 的 `useGenerate` 永遠不會結束。** 請務必提供停止述詞，或下游的 `limit` / `takeWhile`。

**`Ring` 是插入有序的集合。** 元素彼此唯一，並保留首次加入的順序。重複的 `add` 會回傳 `false`，而會引入重複項的 `set` 則會拋出例外。這正是相位得以成為*元素*的函式、而非取決於它恰好佔據哪個位置的原因。

**`Spectrum` 的單側輔助方法假設輸入為實數訊號。** `oneSided()`、`getNyquist()` 與 `centroid()` 假設共軛對稱。相位環的空間頻譜是複數，且一般而言並不對稱——一個反向繞行的環會把全部能量放進頻段 `n − 1`，也就是超出 Nyquist 的位置。請直接讀取頻段。

**結構收集器是終端，不是檢視。** 每一個都會先排清管線，再建構一個完整結構，因此它花費 O(n) 時間與 O(n) 空間，且不能在無限來源上執行。請在管線末尾使用它們，絕不要在走訪管線的迴圈中使用。

**`variance()` 及其同伴回傳 `Optional`。** 在過小的樣本上呼叫 `variance().get()` 會拋出例外；當樣本量不由你掌控時，請用 `.orElse(0)` 或先檢查 `.isPresent()`。`standardDeviation`、`quantile`、`interquartileRange`、`skewness` 與 `kurtosis` 同理。

**週期窗才是分析用的窗。** `useHannWindow` 等對稱形式用於濾波器設計；短時轉換需要 `useHannPeriodicWindow` 及其同族，否則重疊相加的和會在幀與幀相接處起伏。

---

<a id="13-phase-rings"></a>
## 13. 相位環：一個精確的循環

第 10 章把環引介為函式庫對「週期」的建模，並用它把一組資料對照每個相位來度量。本章給出完整
介面：位置如何變成角度、環境轉速改變了什麼又不改變什麼，以及按時間、按資料、按另一個環來
讀取這個環的那些工具。

`SynchronousRing` 是一個位置串列，底層是首尾相接的循環雙向鏈結串列。它同時是一個按插入
順序的*集合*：同一個元素不會出現兩次，被拒絕的寫入既不改動鏈結也不改動取樣點。讓它成為環
而不是普通串列的，是位置的相位只由它對目前長度的餘數決定，因此環逐位週期，平衡也不會漂移。

### 13.1 一個整數，精確計算

一個環帶 `n` 個元素，而元素個數、位置週期與不同相位的個數是同一個整數。位置 `i` 的相位是

`phase + span · 2π · (((i mod n) + n) mod n) / n`

其中餘數在變成 `number` 之前先在 `bigint` 裡歸約。正因如此，`phaseAt(i)` 與 `phaseAt(i + n)`
是*逐位相同*，而不只是接近：第二次呼叫歸約到同一個整數，計算同一個乘積，得到同一個雙精度值。
遠超 `number` 精確整數範圍的索引仍然落在正確位置，負索引則反向繞環。

| 呼叫 | 回傳 | 含義 |
| :--- | :--- | :--- |
| `new SynchronousRing(source, options?)` | 環 | `source` 是任意可迭代物件，重複元素被丟棄 |
| `getPhase()` / `getFrequency()` / `getSpan()` | `Angle`、`Frequency`、`number` | 三個建構參數 |
| `size()` | `bigint` | 同時也是週期的那個 `n` |
| `phaseAt(index)` | `Optional<Angle>` | 只給固有相位；忽略時間、速率與頻率 |
| `elementAt(index)` | `Optional<RingElement>` | 元素、固有相位、環境頻率、相量 |
| `frequencyAt(index)` | `Optional<Frequency>` | 環境轉速，空環回傳空 |
| `toComplex()` / `toComplex(index)` | `Complex[]` / `Optional<Complex>` | 固有相量 |

`RingOptions` 另有兩個逐元素函式：`magnitude(element, index)` 給出相量長度，預設 1；
`rate(element, index)` 給元素自己的固有頻率，預設 0，即固定標記。

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

在六元素環上 `phaseAt(-1n)` 是 `300`，而 `10n ** 20n` 對六取餘是 `4`，所以讀作 `240`。兩種
情況都不累積浮點乘積，這正是身份在索引表示改變時仍然精確的原因。

### 13.2 環境轉速與某一瞬間的狀態

`frequency` 是環所嵌入環境的**環境轉速**，不是位置之間的相位步進。環境把每個元素的相位推進
同一個角度，因此它不能改變固有圖案、不能破壞平衡，也不能改變任何 `phaseAt` 的結果。它預設
是 `0 Hz`。

`relativeAt(index, time)` 減掉這個公共角度，留下 `PhaseField` 打分所用的座標。`viewAt` 與
`viewsAt` 回傳某一瞬間的完整狀態，含元素自己的 `rate`；微分存取器則暴露漂移：

| 呼叫 | 公式 | 讀取什麼 |
| :--- | :--- | :--- |
| `relativeAt(index, time)` | `固有相位 + 自身速率 · t − 環境轉速 · t` | 環境看到的相位 |
| `viewAt(index, time)` / `viewsAt(time)` | 同上，外加元素、索引、時間、速率、相量 | 完整狀態 |
| `jetAt(index, time)` | `t` 時刻的相位、自身速率、`slip = 自身速率 − 環境轉速` | 微分狀態 |
| `windingAt(index, time)` | `trunc(slip · t)` | 滑過的整圈數，向零截斷 |
| `errorIntegralAt(index, time, origin?)` | `∫ 相對相位 dt`，單位 圈 · 秒 | 元素領先或落後了多久 |
| `resultant(time?)` | `abs(Σ w · e^{iθ}) / Σ w` | 相位集中度，不受環境旋轉影響 |
| `analyse(data, time?)` | 每個參考的計數與均值 | 把資料對照每個元素度量 |
| `scoreAt(index, time, field)` / `scoresAt(time, field)` | 用相對相位取樣場 | 每個位置一個界內得分 |

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

在 `1 Hz` 下，環境在 `0.25 s` 內推進四分之一圈，所以位置一的相對相位是 `60 − 90 = 330`
度，而它的固有相位仍是 `60`。jet 報告的 `slip` 是 `-1` 赫茲，因為元素自身沒有動；而
`purity()` 仍是 `1`：把所有相量旋轉同一個角度不是形變。

### 13.3 純度與平衡

`purity()` 是環的能量中由基模攜帶的份額：

`max(abs(c₁)², abs(c_{n−1})²) / (n · Σ abs(z)²)`

兩個基模 bin 都要看，因為環可以沿任一方向繞圈。六個元素、`span: 5` 的環每步 `300` 度，即
`−60` 度：它反向行走，把全部能量放進 `c₅`，只看 `c₁` 的公式會把它誤判為不純。代價仍是
`O(n)`，因為只需要這兩個 bin 和總能量。

邊界情形是約定的一部分。少於兩個元素的環沒有基模，無論內容如何都報告 `purity() === 0` 與
`isBalanced() === false`。所有相量長度為零的環沒有能量，同樣報告零。`isBalanced(epsilon?)`
即 `1 − purity() <= epsilon`，預設容差 `1E-9`。

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

### 13.4 合向量長度與對稱分量

`resultant(time?)` 是平均合向量長度：相量和的模除以長度之和。`purity` 問的是環是否仍是
`n` 次單位根，而 `resultant` 問的是此刻相量有多集中。平衡環報告 `0`；所有元素共享同一角度
的環會報告 `1`，但集合語意禁止重複元素，所以實務上 `1` 出現在 `magnitude` 把所有元素清零、
只留一個的時候。

`zeroSequence()` 是平均相量，也就是 `c₀ / n`。`sequences()` 用直接變換回傳全部 `n` 個對稱
分量，最低階在前。`toSpectrum()` 把它們裝進一個 `Spectrum`，其第 `j` 個 bin 報告每環轉
`j` 個週期，因此頻率軸就是波數軸。

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

這些分量是複數，一般**不滿足共軛對稱**：平衡環把全部能量放在 bin 一，反向環放在 bin
`n − 1`。`Spectrum` 的單邊輔助函式假設實訊號，所以請直接讀 bin，不要折疊。

### 13.5 把資料對照每個元素來分析

`analyse(data, time?)` 按身份把每個觀測匹配回環，並以每個元素為參考相位來度量它。環不持有
的觀測記為 `missed`，而不是猜測，因為環是相位的唯一來源。每個參考列報告 `count`、平均相對
相位 `mean` 與平均合向量長度 `resultant`。

有一個值得記住的恆等式：**`resultant` 對每個參考都相同**。改變基準只是把所有相對相位旋轉
一個常數，而旋轉不會改變合向量長度。每個參考不同的是計數與均值。

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

打分是同一枚硬幣的另一面。`PhaseField` 是有界的餘弦級數（第 10.2 節），`scoreAt` /
`scoresAt` 在相對相位處取樣它，所以同一個環可以對照對齊、對照某個諧波圖案、或對照任意
場來打分，而環本身不變。

```typescript
import { SynchronousRing, useField } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const ring = new SynchronousRing(["a", "b", "c", "d", "e", "f"]);
const cosine = useField([1]);

round(ring.scoreAt(0n, 0, cosine).get());                                  // 1
round(ring.scoreAt(1n, 0, cosine).get());                                  // 0.5
ring.scoresAt(0, cosine).map(score => round(score));                       // [1, 0.5, -0.5, -1, -0.5, 0.5]
```

### 13.6 合成環與角譜

`combineRings(left, right)` 按最小公倍數而不是乘積把兩個環接在一起。聯合環的第 `i` 個瞬間
讀取左環的 `i mod m` 與右環的 `i mod n`，所以它在 `lcm(m, n)` 個瞬間後閉合。永遠不可能
共現的配對——位置模 `gcd(m, n)` 不一致的那些——直接不存在，這就是結果是一個拉回而不是乘積
的原因；`aligns(left, right)` 報告給定配對是否可表示。

`useAngularSpectrum(ring, instants, plan)` 建構 `(ω, n)` 平面：每個瞬間貢獻一幀相量，模式
`j` 的第 `k` 幀是該幀的第 `j` 個對稱分量，`cells[frame][order]` 是係數。取一行就是單一空間
模式的時間序列，`spectrum(order)` 是它的時間頻譜。

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

**精確就是精確。** `phaseAt(i)` 與 `phaseAt(i + n)` 是同一個雙精度值，不是容差內的兩個值。
按每個元素累加 `2π / n` 建構的環做不到這一點；這個環先在 `bigint` 裡歸約索引。

**`frequency` 不是相位步進。** 它是環境轉速，預設零，把所有相量旋轉同一角度不會破壞固有
圖案。想讓位置之間相對推進，請用 `rate`，不要用 `frequency`。

**`purity()` 必須看兩個基模 bin。** 反向環仍是 `n` 次單位根；只看 `c₁` 會把它判為不純。

**`n < 2` 是已定義的邊界。** `purity()` 回傳 `0`，`isBalanced()` 回傳 `false`；空環的取樣
方法回傳空 `Optional`。

**與 `n` 有公因子的 span 會坍縮軌道。** 六個元素配 `span: 2` 只訪問三個不同相位，環不再
平衡。

**`resultant` 是旋轉不變，不是時間不變。** 環境旋轉不改變它；逐元素 `rate` 會隨著環失相而
改變它。

**環是集合，`analyse` 按身份匹配。** 重複元素在建構時被丟棄；與某個環元素結構相等但不是同一
個參照的物件會被計為 missed。

**`toSpectrum()` 是複數譜。** 它的 bin 不滿足共軛對稱，`Spectrum` 的單邊輔助函式不適用。
請直接讀 bin。

**`windingAt` 向零截斷，`errorIntegralAt` 積分的是相位。** 滑過半圈報告 `0n`；誤差積分的
單位是 圈 · 秒，不是速率。

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
## 14. 訊號分析：窗、頻譜與時間

第 10 章把環當作相位的週期來討論。本章是它的時間對應物：一段實值記錄，除了取樣點本身，還
攜帶每個頻譜公式都需要的兩項上下文——把 bin 序號變成赫茲的取樣計畫，以及同時決定相干增益
與雜訊頻寬的窗。

值物件是 `SynchronousSignalCollectable`，它的排隊孿生是 `AsynchronousSignalCollectable`。
兩者暴露同一套 `SignalCollectable` 介面：二十三個方法，每個恰好委託給
`synchronous/collectors` 裡的一個 `useSynchronous<Method>` 工廠。這個拆分是刻意的：類別是
有文件的門面，工廠持有累加過程，建構子只在目前長度上計算一次 `sum(w) / count` 與
`count * sum(w^2) / sum(w)^2`。需要自己記住「除以相干增益」的呼叫者遲早會忘，而由此產生的
6.02 分貝看起來卻像一個合理的量測值。

### 14.1 訊號自帶校正

訊號可以從一個可迭代物件加取樣率建構，也可以來自既有的 `Frame`，或者用建構子配一個顯式的
`Sample`。預設窗是週期 Hann 窗；任何不指定窗的分析都使用它，而每個分析都接受覆寫。
中介資料存取器讀取的是建構時固定下來的狀態，耗時恆定，因此訊號可以在傳遞過程中不遺失上下文。

| 呼叫 | 回傳 | 含義 |
| :--- | :--- | :--- |
| `SynchronousSignalCollectable.useRate(values, rate, window?)` | 訊號 | 時長 `count / rate` |
| `SynchronousSignalCollectable.useFrame(frame, window?)` | 訊號 | 保留該 frame 的取樣計畫 |
| `new SynchronousSignalCollectable(plan, values, window?)` | 訊號 | 計畫的幀數必須等於取樣點數 |
| `getSample()` / `getValues()` / `getWindow()` | 計畫、取樣點、窗 | 凍結的上下文 |
| `getRate()` | `number` | 每秒取樣點數 |
| `getNyquist()` / `getResolution()` | `Frequency` | `rate / 2` 與 `rate / count` |
| `getCoherentGain()` / `getNoiseBandwidth()` | `number` | 在目前長度上重新計算 |
| `size()` / `at(index)` / `toFrame()` / `equals(other)` / `toString()` | — | 值語意 |

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

`getResolution()` 是 bin 間距，不是解析能力：它是 `rate / count`，因為變換有 `count` 個
bin；補零會改變間距，卻不會改變窗能分開什麼（見 14.8 節）。

### 14.2 二十三個方法

這些方法分成六族。七個是頻譜讀數，兩個是時頻變換，四個是解析量，三個是序列統計量，五個是
形狀描述子，還有兩個回傳新的訊號。

| 方法 | 回傳 | 約定 |
| :--- | :--- | :--- |
| `spectrum(size?, window?)` | `Spectrum` | 原始未正規化，保留完整複數網格 |
| `oneSided(size?, window?)` | `Bin[]` | 折疊共軛半，DC 與 Nyquist 不翻倍 |
| `amplitude(window?)` | `number[]` | `2·abs(X) / (count · CG)`，DC 與 Nyquist 只算一次 |
| `power(window?)` | `number[]` | 內部 bin 為 `A² / 2`，DC 與 Nyquist 為 `A²` |
| `decibel(window?)` | `number[]` | `20·log10(振幅)` |
| `powerDecibel(window?)` | `number[]` | `10·log10(功率)` |
| `powerSpectralDensity(frameSize?, hopSize?, window?)` | `SpectralDensity` | Welch 平均，`abs(X)² / (rate · Σw²)` |
| `shortTimeFourierTransform(frameSize, hopSize, window?)` | `Spectrum[]` | 兩端延拓，按幀中心回報時間 |
| `spectrogram(frameSize, hopSize, window?)` | `Spectrogram` | 同一批行，帶時間軸 |
| `analyticSignal()` | `Complex[]` | Hilbert 對 `x + i·H(x)` |
| `instantaneousPhase()` | `Angle[]` | 折疊進 `[0, 2π)` |
| `instantaneousFrequency(rate?, gate?)` | `number[]` | 解纏後的相位差分，受包絡門檻保護 |
| `envelope()` | `number[]` | `abs(z[n])`，兩端受循環影響 |
| `zeroCrossingRate(perSecond?)` | `number` | 相鄰取樣點的過零比例 |
| `spectralFlux(frameSize?, hopSize?, window?)` | `number[]` | 幀間單位範數振幅距離 |
| `autocorrelation(maximumLag?, normalization?)` | `number[]` | 預設係數約定，`ρ[0] = 1` |
| `spectralCentroid(window?)` | `Optional<Frequency>` | 功率加權平均頻率 |
| `spectralBandwidth(window?)` | `Optional<Frequency>` | 功率加權標準差 |
| `spectralRolloff(ratio?, window?)` | `Optional<Frequency>` | 累計功率首次達到 `ratio` 的 bin |
| `spectralFlatness(window?)` | `number` | 功率的幾何平均 / 算術平均 |
| `signalToNoiseRatio(frameSize?, hopSize?, window?, floorQuantile?)` | `Optional<number>` | 中位數雜訊底，`10·log10` |
| `detrended(mode?)` | 訊號 | `"none"`、`"constant"`（預設）、`"linear"` |
| `windowed(window?)` | 訊號 | 施加窗並採用它 |

可選參數不是裝飾。`frameSize` 預設 `min(256, size)`，跳長預設為半幀向下取整，
`instantaneousFrequency` 的預設門檻是峰值包絡的 `1E-3`，`spectralRolloff` 預設 `0.85`。
每個預設值都是參考實作在「給參數命名而不傳值」時選擇的那個值。

### 14.3 振幅、功率與密度

需要三種正規化，因為問的是三個不同的問題。

`amplitude()` 回答「這個 bin 上的正弦有多大」：內部 bin 為 `2·abs(X[k]) / (count · CG)`，
DC 與 Nyquist 為 `abs(X[k]) / (count · CG)`。因子 2 折疊共軛半；相干增益去掉窗的影響。
少做任何一步，單位振幅正弦都會讀成 `0.5`，也就是負 6.02 分貝。

`power()` 回答「這個 bin 上的正弦會有多大均方」：內部 bin 為 `A² / 2`，DC 與 Nyquist 為
`A²`，因為後兩者不振盪。這是峰值約定，它刻意不滿足帕塞瓦爾定理：窗把每條譜線攤到主瓣上，
所以所有 bin 之和會比均方多出等效雜訊頻寬——Hann 窗是 `1.5`。

`powerSpectralDensity()` 回答「每赫茲有多少功率」：`abs(X)² / (rate · Σw²)`，並在重疊段上
平均。只有用權重平方和作分母，白雜訊底才是無偏的；除以 `count` 會把單位雜訊讀成 `0.375`，
除以 `count · CG²` 會讀成 `1.5`。

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

值得記住的是這兩個總量：峰值約定的和是 `0.75`，密度積分是 `0.5`，比值恰好是雜訊頻寬。
三者之中也只有密度能在改變幀長後繼續成立。

### 14.4 位準：兩種分貝約定

振幅與功率不共享同一個因子，因此也不共享同一個對數。`amplitudeDecibel` 用 `20·log10`，
適用於電壓、位移或聲壓；`powerDecibel` 用 `10·log10`，適用於功率、能量、均方或密度。
訊號上的方法名遵循同樣的劃分。

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

同一個音的兩個讀數都是對的：它的振幅是 1（零分貝），均方是二分之一（負 3.01 分貝）。把功率
送進振幅約定會讓分貝值翻倍，把正確的負 6.02 變成負 12.04。

### 14.5 單邊折疊

實訊號滿足 `X[count − k] = conj(X[k])`，所以負頻率半不攜帶獨立資訊。折疊把每個內部 bin
翻倍，而把兩個自共軛 bin——DC 以及偶數長度下的 Nyquist——原樣保留。這兩個 bin 是自己的
鏡像，翻倍等於憑空製造能量，讀數正好高 6.02 分貝。

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

原始振幅是 `16` 與 `8`，因為窗的權重和是 8；除以 `count · CG = 8` 就得到校正後的振幅
`2` 與 `1`。若把邊緣 bin 也翻倍，會讀成 `4` 與 `2`，而這個錯誤永遠不會拋出例外。

### 14.6 時頻視圖

`shortTimeFourierTransform` 與 `spectrogram` 按參考短時變換的方式分幀：兩端各補半幀零，
再在尾端補零以湊成整數個跳長。第一幀以第一個取樣點為中心，最後一幀覆蓋到最後一個取樣點，
第 `m` 幀的中心在 `m · hop / rate` 秒。只保留完整幀會丟掉最多 `frameSize − 1` 個取樣點——
1000 個取樣點、幀長 256、跳長 128 時是 104 個，約為整段記錄的十分之一。

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

每一行都是一個 `frameSize` 個 bin 的 `Spectrum`，與對同一幀呼叫 `spectrum()` 完全一致；
`getTime()` 回報的是幀中心，不是幀起點。

### 14.7 窗、相干增益與 COLA

每種形狀都有兩種形式。對稱形式用 `count − 1` 作分母；週期（DFT 偶數）形式用 `count` 作
分母，比一個整週期少一個取樣點，因此在 DFT 所假設的週期延拓下是連續的。分析路徑與重疊相加
需要週期形式；濾波器設計保留對稱形式。

差異可以量測，且永遠不會報錯。在 50% 重疊下，週期 Hann 窗在每個位置的和都等於 1；對稱形式
則有漣波，16 個取樣點時 `0.84` 分貝，64 個取樣點時 `0.21`，1024 個取樣點時仍有 `0.013`。
類別會暴露它所持窗的相干增益與等效雜訊頻寬，所以校正量從不硬編碼：對稱 Hann 在 8 個取樣點
時讀作 `0.4375`，不是 `0.5`。

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

平頂窗那一列不是表格出錯。平頂窗按定義就是部分取負的——這裡 1024 個權重中有 578 個為負——
把這些權重截斷為零會擾動主瓣，破壞這個窗存在的理由：極低的扇貝損失。函式庫原樣回傳該序列。

### 14.8 陷阱

**補零是插值，永遠不是解析。** 變換長度大於取樣點數只是在更密的網格上取樣同一個 DTFT：
峰值*位置*更精細，bin 間距變成 `rate / size`，但能否分開兩個分量仍由窗長與窗形決定。正好
落在兩個 bin 中間的音，在未補零的網格上讀作 `82.1093` 與 `80.8598`，在補零網格上自己的
頻率處讀作 `128`。

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

相隔 `0.4` 個 bin 的兩個等振幅音在任何補零下都保持合併：256 點記錄加 Hann 窗，補零到 8192
只產生一個局部極大值，而不是兩個。

**Hilbert 變換是循環的。** `analyticSignal`、`envelope` 與 `instantaneousPhase` 把首尾
取樣點當作鄰居，因此週期不能整除長度的記錄兩端都受到污染。記錄中段可信，兩端不可信。

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

**包絡消失處不定義相位。** 包絡塌陷時，兩個捨入雜訊角度之差可以是半圈，讀出來就是取樣率的
一半。門檻正是讓這個數字有意義的東西，預設值是峰值包絡的 `1E-3`。

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

**未正規化的相關不是相似度。** 原始和 `r[k]` 隨記錄長度增長，因此兩個長度無法比較。預設的
`"coefficient"` 規則除以 `r[0]`，把所有值留在 `[-1, 1]`；`"unbiased"` 除以 `count − k`，
代價是變異數隨延遲增長。

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

還有一個讀數值得提醒：`spectralFlux` 在比較前會把每幀正規化，所以純粹的位準變化產生零通量。
它的首尾兩個值是零邊界的邊緣效應，不是起音。

---

<a id="15-license"></a>
## 15. 授權

MIT © Eloy Kim
