# **Semantic-TypeScript**

**資料流，已索引。** 您的資料，盡在精準掌控之中。

[English](./readme.md) · [简体中文](./readme.cn.md) · 繁體中文 · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

一個型別安全的串流處理函式庫，統合了 **JavaScript 生成器**、**Java Stream** 與**以索引定址的資料存取**。每個元素都攜帶一個 `bigint` 索引，每條管線皆為惰性求值，而每個終端操作都需明確選用。

```bash
npm install semantic-typescript
```

- 零執行期依賴，純 ESM，自帶型別定義。
- 622 個迴歸測試：`npm test`。
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
13. [授權](#13-license)

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
| `toCycle(span?)` | `SynchronousCycle<E>` | 走訪順序決定環上位置 | O(n) |
| `toLRUSet(capacity)` | `SynchronousUnorderedLRUSet<E>` | 依最近使用；只留最後 `capacity` 個 | 最差 O(n²) |
| `toLRUMap(capacity, key, value?)` | `SynchronousUnorderedLRUMap<K, V>` | 依最近使用 | 期望 O(n) |
| `toSkipSet(comparator?)` | `SynchronousSkipSet<E>` | 依比較子升冪，可導航 | 最差 O(n²) |
| `toSkipMap(key, value?)` | `SynchronousSkipMap<K, V>` | 依鍵比較子，可導航 | 期望 O(n) |
| `toBinarySearchTree(comparator?)` | `SynchronousBinarySearchTree<E>` | 依比較子升冪，高度平衡 | O(n log n) |
| `toRootedForest()` | `SynchronousRootedForest<E>` | 走訪順序即結構順序 | O(n) |

結果型別跟隨可收集器自身的元素型別，因此沒有任何終端需要型別引數：一個 `SynchronousCollectable<E>` 直接交給你 `Array<E>`、`SynchronousList<E>` 或 `SynchronousOrderedSet<E>`。剩下的只有業務引數——`toOrderedSet` / `toSkipSet` / `toBinarySearchTree` 的比較子、LRU 對的容量、`toCycle` 的跨度，以及映射族的鍵與值提取器。

一個環是集合，因此重複元素只保留首次出現的位置；上述其餘結構除非自身契約另有規定，否則都保留重複（`toOrderedSet`、`toUnorderedSet`、`toSkipSet` 是集合；`toBinarySearchTree` 與 `toList` 不是）。

```typescript
const numbers = useOf(3, 1, 4, 1, 5).toCollectable();

numbers.toOrderedSet().toArray();                        // [1,3,4,5]
numbers.toUnorderedSet().size();                         // 4n — the duplicate 1 collapses
numbers.toList().toArray();                              // [3,1,4,1,5]
numbers.toSkipSet().first().get();                       // 1 — navigable by comparator
numbers.toBinarySearchTree().size();                     // 5n — duplicates retained
numbers.toRootedForest().getRoots().length;              // 1
useOf(1, 2, 3).toCollectable().toCycle().phaseAt(3n).get().toDegreeValue();      // 0
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
const cycle = new AsynchronousCycle([1, 2]);
const added   = cycle.add(3);          // queued
const sampled = cycle.elementAt(2n);   // observes the write above
await added;
(await sampled).get().element;         // 3
```

本質上即為非同步的工廠函式——`usePromise`、`useBlob`、`useInterval`、`useSubscription`——會直接回傳 `AsynchronousSemantic`，而 `useFrom` / `useIterate` 在收到 `AsyncIterable` 時會自行升級。

---

<a id="10-periodic-analysis-rings-fields-and-scores"></a>
## 10. 週期性分析：環、場與分數

函式庫的數學部分將循環視為一等物件，而非查詢表。三種建構協同運作。

### 10.1 一個環就是一個整數

`Cycle` 是一個 **n 重環**：元素數量、位置週期與相異相位的數目都是同一個整數 `n`。位置的相位由其精確餘數計算而得，因此環具有位元級的週期性：

```typescript
import { SynchronousCycle } from "semantic-typescript";

const ring = new SynchronousCycle(["a", "b", "c", "d", "e", "f"]);
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
const ring = new SynchronousCycle(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                              // 5
report.missed;                               // 1  ('zz' is not on the ring)
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

每個參考列都會回報 `count`（計數）、平均相對相位 `mean`，以及平均合力長度 `resultant`。有一個恆等式值得記住：**每個參考的 `resultant` 都相同**，因為改變基準只會讓所有相對相位旋轉一個常數。每個參考不同的是計數與平均值。

```typescript
const cycle = new SynchronousCycle(["a", "b", "c"]);
cycle.scoresAt(0, cosine);                   // one score per position, in [-1, 1]
```

### 10.4 相關工具

| 呼叫 | 回答的問題 | 成本 |
| :--- | :--- | :--- |
| `purity()` | 環是否仍為 `n` 次單位根？ | O(n) |
| `resultant(t?)` | 相量此刻有多集中？ | O(n) |
| `analyse(data)` | 這筆資料相對於每個元素的關係如何？ | O(n · m) |
| `toSpectrum()` | 將環視為頻譜，波數位於頻率軸 | O(n²) |
| `useAngularSpectrum(cycle, instants, plan)` | 隨時間變化的 `(ω, n)` 平面 | O(n² · frames) |

另有兩個基元補全了這個模型：`combineCycles(a, b)` 以最小公倍數聯結兩個環（這是拉回，而非乘積——無法共享同一時刻的配對直接不存在），而 `rate()` 讓每個元素擁有自己的內在頻率，使環得以相對於環境漂移。`jetAt`、`windingAt` 與 `errorIntegralAt` 則揭露該漂移的微分狀態。

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

**`Cycle` 是插入有序的集合。** 元素彼此唯一，並保留首次加入的順序。重複的 `add` 會回傳 `false`，而會引入重複項的 `set` 則會拋出例外。這正是相位得以成為*元素*的函式、而非取決於它恰好佔據哪個位置的原因。

**`Spectrum` 的單側輔助方法假設輸入為實數訊號。** `oneSided()`、`getNyquist()` 與 `centroid()` 假設共軛對稱。相位環的空間頻譜是複數，且一般而言並不對稱——一個反向繞行的環會把全部能量放進頻段 `n − 1`，也就是超出 Nyquist 的位置。請直接讀取頻段。

**結構收集器是終端，不是檢視。** 每一個都會先排清管線，再建構一個完整結構，因此它花費 O(n) 時間與 O(n) 空間，且不能在無限來源上執行。請在管線末尾使用它們，絕不要在走訪管線的迴圈中使用。

**`variance()` 及其同伴回傳 `Optional`。** 在過小的樣本上呼叫 `variance().get()` 會拋出例外；當樣本量不由你掌控時，請用 `.orElse(0)` 或先檢查 `.isPresent()`。`standardDeviation`、`quantile`、`interquartileRange`、`skewness` 與 `kurtosis` 同理。

**週期窗才是分析用的窗。** `useHannWindow` 等對稱形式用於濾波器設計；短時轉換需要 `useHannPeriodicWindow` 及其同族，否則重疊相加的和會在幀與幀相接處起伏。

---

<a id="13-license"></a>
## 13. 授權

MIT © Eloy Kim
