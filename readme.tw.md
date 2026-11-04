# **Semantic-TypeScript**

**資料流，已索引。** 您的資料，盡在精準掌控之中。

[English](./readme.md) · [简体中文](./readme.cn.md) · 繁體中文 · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

一個型別安全的串流處理函式庫，統合了 **JavaScript 生成器**、**Java Stream** 與**以索引定址的資料存取**。每個元素都攜帶一個 `bigint` 索引，每條管線皆為惰性求值，而每個終端操作都需明確選用。

```bash
npm install semantic-typescript
```

- 零執行期依賴，純 ESM，自帶型別定義。
- 496 個迴歸測試：`npm test`。
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
| 數學 | `mathematics/*` | 角、複數、頻率、頻譜、視窗、本輪、相位環 |
| 結構 | `structure/*` | 串列、集合、映射、樹、環、場 |

同步與非同步家族共用同一套詞彙：相同的算子名稱、相同的索引語意、相同的可收集器。非同步變體只是回傳 promise，並且會將寫入排入佇列，因此寫入之後發出的讀取必定能觀察到它。

---

<a id="3-quick-start"></a>
## 3. 快速上手

```typescript
import {
  useOf, useFrom, useRange, useText, useStringify, usePromise
} from "semantic-typescript";

// 數值聚合
const sum: number = useOf(10, 20, 30, 40)
  .map(n => n * 2)
  .toNumericStatistics()
  .summate();                                   // 200

// BigInt 聚合
const bigSum: bigint = useOf(10n, 20n, 30n, 40n)
  .map(n => n * 2n)
  .toBigintStatistics()
  .summate();                                   // 200n

// 重新排序是索引算術——以 toOrdered() 收集才會生效
const reversed: number[] = useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();      // [5,4,3,2,1]
const rotated: number[]  = useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();   // [4,5,1,2,3]

// 對大型區間進行惰性求值
const multiples: bigint[] = useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)
  .limit(10n)
  .toUnordered()
  .toArray();                                   // [0n,17n,…,153n]

// Unicode 安全的字串處理（以碼點為單位，而非 UTF-16 單元）
useText("semantic 👍").toUnordered().forEach(character => console.log(character));

// 循環安全的序列化
const cyclic: any = { a: 1 }; cyclic.self = cyclic;
useStringify(cyclic);                           // '{"a":1}'

// 非同步來源
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
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (輪轉)
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

---

<a id="6-collectables-and-terminal-operations"></a>
## 6. 可收集器與終端操作

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

---

<a id="7-statistics-and-windows"></a>
## 7. 統計與視窗

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();              // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();              // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();               // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                 // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance();             // 2.56
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation();    // 1.6
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n);                    // [[1,2],[2,3],[3,4]]
```

兩個統計家族提供相同的介面——`summate`、`average`、`median`、`mode`、`variance`、`standardDeviation`、`frequency`、`findMaximum`、`findMinimum`——而 `toBigintStatistics()` 使用 `bigint` 算術。視窗支援 `slide(size, hop)` 與 `tumble(size)`。

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
const added   = cycle.add(3);          // 已排入佇列
const sampled = cycle.elementAt(2n);   // 可觀察到上述的寫入
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
ring.phaseAt(6n).get().getValue() === ring.phaseAt(0n).get().getValue();   // true，精確相等
ring.purity();                             // 1
ring.isBalanced();                         // true
ring.sequences().map(z => z.magnitude());  // [0, 6, 0, 0, 0, 0]
```

`frequency` 是**環境**旋轉速率，而不是位置之間的相位步進：環境會讓每個相量移動相同的角度，因此它永遠無法破壞內在樣式。`span` 則固定環所佔據的圈數。

`purity()` 是基頻模態所攜帶的能量佔比，`max(|c₁|², |c_{n−1}|²) / (n · Σ|z|²)`。當環在容許旋轉的意義下等同於 `n` 次單位根時，它恰好為 `1`，而其成本為 `O(n)`，因為只需要兩個頻段。兩個方向都會納入測試，因為環可能以任一方向繞行圓周。

### 10.2 場是一個有界分數

`PhaseField` 會將相對相位映射為 `[-1, 1]` 區間內的分數：

```typescript
import { useField } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ)：+1 同相，−1 反相
const mixed  = useField([0.4, 0.3, 0.3]);  // 前三項諧波

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
report.missed;                               // 1  （'zz' 不在環上）
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

每個參考列都會回報 `count`（計數）、平均相對相位 `mean`，以及平均合力長度 `resultant`。有一個恆等式值得記住：**每個參考的 `resultant` 都相同**，因為改變基準只會讓所有相對相位旋轉一個常數。每個參考不同的是計數與平均值。

```typescript
const cycle = new SynchronousCycle(["a", "b", "c"]);
cycle.scoresAt(0, cosine);                   // 每個位置一個分數，落在 [-1, 1] 中
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

---

<a id="11-utility-helpers"></a>
## 11. 輔助工具

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

---

<a id="12-performance-and-pitfalls"></a>
## 12. 效能與陷阱

**惰性在每個階段都有代價。** 每個算子都會增加一層生成器跳躍。對於記憶體陣列上的緊密數值迴圈，樸素的 `for` 迴圈會勝過任何管線；當來源是惰性的、無限的，或管線長到足以讓索引紀律回本時，管線才會勝出。

**`toOrdered()` 會排序；`toUnordered()` 不會。** 如果反轉似乎「沒有生效」，那是因為收集器是無序的——索引重寫唯有在索引被正規化之後，才會成為順序。

**沒有 `interrupt` 的 `useGenerate` 永遠不會結束。** 請務必提供停止述詞，或下游的 `limit` / `takeWhile`。

**`Cycle` 是插入有序的集合。** 元素彼此唯一，並保留首次加入的順序。重複的 `add` 會回傳 `false`，而會引入重複項的 `set` 則會拋出例外。這正是相位得以成為*元素*的函式、而非取決於它恰好佔據哪個位置的原因。

**`Spectrum` 的單側輔助方法假設輸入為實數訊號。** `oneSided()`、`getNyquist()` 與 `centroid()` 假設共軛對稱。相位環的空間頻譜是複數，且一般而言並不對稱——一個反向繞行的環會把全部能量放進頻段 `n − 1`，也就是超出 Nyquist 的位置。請直接讀取頻段。

---

<a id="13-license"></a>
## 13. 授權

MIT © Eloy Kim
