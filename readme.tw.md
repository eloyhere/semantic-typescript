# **Semantic-TypeScript**

**資料流，已索引。** 您的資料，盡在精準掌控之中。

[English](./readme.md) · [简体中文](./readme.cn.md) · 繁體中文 · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

一個型別安全的串流處理函式庫，統合了 **JavaScript 生成器**、**Java Stream** 與**以索引定址的資料存取**。每個元素都攜帶一個 `bigint` 索引，每條管線皆為惰性求值，而每個終端操作都需明確選用。

```bash
npm install semantic-typescript
```

- 零執行期依賴，純 ESM，自帶型別定義。
- 55 個迴歸測試：`npm install && npm test`。
- 完整變更歷程：[CHANGELOG.md](./CHANGELOG.md)。

---

## Table of Contents

1. [設計哲學](#1-design-philosophy)
2. [架構](#2-architecture)
3. [資料流：從來源到結果](#3-data-flow-from-source-to-result)
4. [快速上手](#4-quick-start)
5. [工廠函式](#5-factory-functions)
6. [轉換算子](#6-transformation-operators)
7. [可收集器與終端操作](#7-collectables-and-terminal-operations)
8. [統計](#8-statistics)
9. [視窗](#9-windows)
10. [索引模型](#10-the-index-model)
11. [非同步模型](#11-the-asynchronous-model)
12. [輔助工具](#12-utility-helpers)
13. [與其他函式庫的比較](#13-comparison-with-other-libraries)
14. [效能特性](#14-performance-characteristics)
15. [陷阱與常見問答](#15-pitfalls-and-faq)
16. [授權](#16-license)

---

<a id="1-design-philosophy"></a>
## 1. 設計哲學

**1. 索引優先。** 在大多數串流函式庫中，位置是你需要*重建*的東西——在 `scan` 中攜帶的計數器，或是你手動貫穿傳遞的索引引數。在這裡，位置是*內在的*：生成器協定為每個元素賦予一個 `bigint` 索引，因此 `distinct`、`skip`、`sub`、`reverse`、`translate` 與 `shuffle` 全都表達為索引算術，而非臨時狀態。改變元素的索引*就是*重新排序；重新索引*就是*過濾。

**2. 透過明確的停止訊號推送。** 來源是一個函式 `(accept, interrupt) => void | Promise<void>`。它透過 `accept(element, index)` 推送元素，並以 `interrupt(element, index)` 詢問是否應該停止。沒有隱藏的排程器、沒有訂閱物件、也沒有需要記住的拆解階段——背壓與終止都是協定的一部分，無限串流因而成為尋常（而非特殊）的情況。

**3. 惰性為預設；具體化成為一項選擇。** 算子只包裝生成器。在**可收集器**消費管線之前，什麼都不會執行，而你選擇的收集器決定了成本：`toUnordered()` 為 O(n) 且絕不觸及你的索引，`toOrdered()` 為 O(n log n) 並對其進行正規化。因為這項選擇明確反映在你取得的型別中，你始終清楚是否為順序與記憶體付出代價。

**4. Redirect 是唯一的重新排序機制。** `reverse()`、`translate()` 與 `shuffle()` 不過是預先封裝好的 `redirect()` 策略——各自僅重寫元素的索引，別無其他。這正是它們全都**需要 `toOrdered()`** 才會生效的原因：管線只重寫索引，而決定這些索引意義的，是有序收集器。

**5. 同步與非同步共用同一套 API。** 相同的算子既適用於有限的記憶體內資料，也適用於 promise、非同步可迭代物件、計時器、blob 與事件訂閱。無法同步的來源會在其回傳型別（`AsynchronousSemantic`）中表明，因此「我有 await 它嗎？」不再成為執行期的意外。

---

<a id="2-architecture"></a>
## 2. 架構

三個層級，單一方向。資料向下流動；你持有的型別會告知下一步能做的操作。

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

| 層級 | 型別 | 職責 | 取得方式 |
| :--- | :--- | :--- | :--- |
| Source / pipeline | `SynchronousSemantic<E>`<br>`AsynchronousSemantic<E>` | 建構惰性管線：轉換、重新索引、分割、合併。尚未觸及任何元素。 | 工廠函式，以及語意物件上的每個算子 |
| Storage / view | `SynchronousUnorderedCollectable<E>`<br>`SynchronousOrderedCollectable<E>`<br>`SynchronousNumericStatistics<E>`<br>`SynchronousBigIntStatistics<E>`<br>`SynchronousWindowCollectable<E>`<br>(+ `Asynchronous*` counterparts) | 將管線具體化為以索引定址的緩衝區，並暴露終端 API。**ordered** 系列負責索引簿記；**unordered** 系列則為吞吐量而捨棄它。 | `toUnordered()` `toOrdered()` `toNumericStatistics()` `toBigintStatistics()` `toWindow()` `toCollectable()` |
| Collector | `SynchronousCollector<E, A, R>`<br>`AsynchronousCollector<E, A, R>` | 可重用的摺疊：`identity → accumulator → finisher`，可選搭配 `interruptor`。驅動每個終端操作，且可由使用者自行撰寫。 | `useSynchronous*` / `useAsynchronous*` 收集器工廠，或 `Collectable.collect(...)` |

中間層存在的原因：將「管線是什麼」與「如何儲存」分離，正是讓同一個 `toOrdered()` 能服務反轉、輪轉與洗牌的關鍵——管線只重寫索引，而收集器決定這些索引的意義。

---

<a id="3-data-flow-from-source-to-result"></a>
## 3. 資料流：從來源到結果

```typescript
const result = useRange(0n, 100n)      // (1) source: reserve indices 0n,1n,2n,…
  .filter(n => n % 2n === 0n)          // (2) operator: index is forwarded unchanged
  .translate(2)                        // (3) operator: index becomes i + 2 (a lazy shift)
  .limit(5n);                          // (4) operator: interrupt() returns true after 5 elements

const ordered = result.toOrdered();    // (5) collectable: materialise; indices normalised mod n, sorted
const array = ordered.toArray();       // (6) terminal: drain the buffer
```

1. **建構。** 步驟 1–4 只建構出閉包，什麼都不會產生。即使是一百個元素也不會被生成。
2. **推送。** 當可收集器最終執行生成器時，元素在無排程器的情況下流動：由來源驅動，`accept` 寫入收集器，`interrupt` 決定何時停止——這正是為什麼在百萬級元素的區間中段呼叫 `limit(5n)` 只需五次迭代，而非一百萬次。
3. **索引。** 算子永不遺失索引。`filter` 轉發原始索引（因此「第 3 個*保留*的元素」仍是「索引 3」），而 `skip` / `sub` / `limit` / `distinct` 則刻意重新索引。
4. **具體化。** 可收集器會在建構時，將生成器確切執行一次。
5. **終端。** 可收集器上的方法讀取緩衝區；它們成本低廉、可重複執行，且不會重新執行管線。

**值得牢記的唯一規則：** 轉換是惰性的，可收集器是急切的，終端操作是免費的。

---

<a id="4-quick-start"></a>
## 4. 快速上手

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
## 5. 工廠函式

### 5.1 概覽

建構恆為 O(1)——工廠函式只包裝生成器。下表說明從各來源*消費* `n` 個元素的成本，以及該來源本身在已收集元素之外所需的額外空間。

| 工廠函式 | 簽章（結果） | 時間（消費 n） | 空間（來源） | 備註 |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | 索引為 0..n−1；其展開引數已具體化 |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | 包裝任何 `Iterable` / `AsyncIterable`；於收集時迭代一次 |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` 為開區間（不含）；`step` 必須非零；`number` 與 `bigint` 皆可使用 |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | 每個元素呼叫一次 supplier |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | `concat` 的單位元素 |
| `useText` | `useText(text)`<br>`useText(text, delimiter)`<br>`useText(text, start)` / `(text, start, end)` | O(n) | O(n) for the text | 迭代**碼點**，因此 emoji 與 CJK 字元皆保持為單一元素 |
| `useAttribute` | `useAttribute<T>(object) → SynchronousSemantic<{key, value}>` | O(v + e) over v values and e edges | O(d + v) for the visited set at depth d | 以循環保護遞迴走訪巢狀物件/陣列 |
| `useGenerate` | `useGenerate<E>(supplier, interrupt) → SynchronousSemantic<E>` | O(n) × supplier cost | O(1) | **必須**具備停止用的 `interrupt`（或下游的 `limit` / `takeWhile`） |
| `useIterate` | `useIterate<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useIterate<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) per collection | O(1) | 每次收集時重播迭代器 |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period (real time) | O(1) | 發出經過的時間；消耗真實時間 |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | 位於索引 `0n` 的單一元素 |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob size) | O(chunk) per emitted copy | 預設區塊為 64 KiB；每個區塊皆為獨立副本 |
| `useSubscription` | `useSubscription(target, subscriber, event \| events) → AsynchronousSemantic<Event>` | one element per event | O(1) | `limit()` / `sub()` / `takeWhile()` 定義取消訂閱的邊界 |

### 5.2 範例

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
## 6. 轉換算子

### 6.1 概覽

每個算子都回傳一個新的 `Semantic`；在可收集器執行之前，沒有任何算子會觸及元素。時間是**每個元素**的額外成本（不含上游自身的成本）；空間則是管線執行期間算子保留的額外記憶體。

| 算子 | 用途 | 索引效果 | 時間（每元素） | 空間 |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | 1:1 轉換 | 轉發 | O(1) | O(1) |
| `filter(predicate)` | 保留符合的元素 | 轉發 | O(1) | O(1) |
| `flat(mapper)` | 1:N 扁平化（可迭代物件或語意物件） | 自 0 重新索引 | O(1) per emitted element | O(1) |
| `flatMap(mapper)` | 1:N 扁平化，可能改變元素型別 | 自 0 重新索引 | O(1) per emitted element | O(1) |
| `distinct(keyExtractor?)` | 捨棄重複的鍵，保留第一個 | 轉發 | O(1) average | O(n) for the key set |
| `peek(consumer)` | 副作用，元素直接通過 | 轉發 | O(1) | O(1) |
| `limit(count)` | 取前 *n* 個 | 自 0 重新索引 | O(1), stops upstream after n | O(1) |
| `skip(count)` | 捨棄前 *n* 個 | 轉發 | O(1) per skipped element | O(1) |
| `sub(start, end)` | 依位置的切片 `[start, end)` | 轉發 | O(1) | O(1) |
| `takeWhile(predicate)` | 當述詞成立時取用 | 轉發 | O(1), stops upstream on first miss | O(1) |
| `dropWhile(predicate)` | 當述詞成立時捨棄 | 自 0 重新索引 | O(1) | O(1) |
| `concat(other)` | 串接一個語意物件或可迭代物件 | 延續索引 | O(1) | O(1) |
| `redirect(redirector)` | 隨你計算新索引 | **由你決定** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | 取負並位移 | O(1) | O(1) |
| `translate(offset)` | 將每個索引惰性位移 *offset* | `i + offset` | O(1) | O(1) |
| `translate(mapper)` | 逐元素的索引位移 | `i + mapper(element, i)` | O(1) | O(1) |
| `shuffle(mapper?)` | 將索引隨機化（或使用你自己的 mapper） | 隨機 | O(1) | O(1) |
| `pipe(conversion)` | 將生成器交給自訂函式 | 由你決定 | yours | yours |
| `semantic()` | 將可收集器提升回語意物件 | 不變 | O(1) | O(1) |

### 6.2 值得留意的說明

**`reverse`、`translate` 與 `shuffle` 都是 `redirect` 策略，且需要有序收集器。** 它們只重寫索引——不會緩衝任何內容，也尚未進行任何旋轉。`toOrdered()` 才會以元素數量為模數對索引進行正規化，並將其轉化為順序：

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(-2).toOrdered().toArray();        // [3,4,5,1,2]
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3, 4, 5]).shuffle().toOrdered().toArray();            // a fresh permutation per call
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

若改以 `toUnordered()` 收集，相同的管線會依到達順序、連同原始索引一併回傳元素——請見 [索引模型](#10-the-index-model)。

**`translate` 是純粹、惰性的索引位移。** 兩個多載都會對索引加上某值（`i + offset` 或 `i + mapper(element, i)`），且永不緩衝串流。旋轉只有在*有序收集器*以元素數量為模數對索引正規化時才會具體化——因此即便在無限區間後接 `limit`，`translate(2)` 依然成本低廉。

**`redirect` 是通用工具。** 任何索引策略都能用它表達——反轉、交錯、雜湊分區皆可：

```typescript
useFrom([1, 2, 3, 4, 5]).redirect((_e, i) => -i - 1n).toOrdered().toArray();   // [5,4,3,2,1]
useFrom([1, 2, 3, 4]).redirect((_e, i) => i % 2n === 0n ? i + 1n : i - 1n)
  .toOrdered().toArray();                                                       // [2,1,4,3]
```

**以索引驅動的切片仍是一等公民：**

```typescript
useOf(1, 2, 3, 4, 5).sub(1, 3).toUnordered().toArray();               // [2,3]
useOf(1, 2, 3, 4, 5).skip(2n).toUnordered().toArray();                // [3,4,5]
useOf(1, 2, 3, 4, 5).takeWhile(n => n < 3).toUnordered().toArray();   // [1,2]
useOf(1, 2, 3, 4, 1).dropWhile(n => n < 3).toUnordered().toArray();   // [3,4,1]
```

---

<a id="7-collectables-and-terminal-operations"></a>
## 7. 可收集器與終端操作

### 7.1 選擇可收集器

可收集器同時擁有**順序**與**索引簿記**。`n` 為元素數量。

| 可收集器 | 結構 | 時間 | 空間 | 順序 | 適用時機 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | `Map<bigint, E>` 以索引為鍵 | O(n) | O(n) | 插入順序 | 最大吞吐量，順序無關緊要；原始索引原封不動地保留 |
| `toOrdered()` | 依元素索引排序的陣列 | O(n log n) | O(n) | 依正規化索引 | 反轉/輪轉/洗牌必須生效，或你需要位置存取 |
| `toOrdered(comparator)` | 依你的比較子排序，索引重建為位置 | O(n log n) | O(n) | 依你的比較子 | 已排序視圖、min/max 風格的讀取 |
| `toNumericStatistics()` | 依值排序的緩衝區 | O(n log n) | O(n) | 依值 | 針對 `number` 的統計 |
| `toBigintStatistics()` | 依值排序的緩衝區 | O(n log n) | O(n) | 依值 | 針對 `bigint` 的統計 |
| `toWindow()` | 依值排序的緩衝區 | O(n log n) | O(n) | 依值 | `slide` / `tumble` |
| `toCollectable(mapper)` | 由 mapper 回傳的內容決定 | — | — | — | 自訂可收集器 |

### 7.2 終端操作

成本以具體化之後為準；`k` 為目標位置，`n` 為元素數量。

| 終端 | 回傳 | 時間 | 空間 | 備註 |
| :--- | :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | O(n) | O(n) | 排清緩衝區 |
| `toSet()` | `Set<E>` | O(n) average | O(n) | 依同一性去重複 |
| `toMap(keyExtractor, valueExtractor?)` | `Map<K, V>` | O(n) average | O(n) | 後寫入者勝出 |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | O(1) | 緩衝區已經知道 |
| `forEach(action)` | `void` | O(n) | O(1) | `action(element, index)` |
| `join(…)` | `string` | O(n) | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `log()` / `error()` | `void` | O(n) | O(n) | 以 `[prefix … suffix]` 包裹的控制台輸出 |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | O(1) | 類 IO 的終端 |
| `collect(collector)`<br>`collect(identity, accumulator, finisher)` | `R` | O(n) | accumulator | 上述每個終端的通用摺疊 |
| `reduce(accumulator)` | `Optional<E>` | O(n) | O(1) | 空串流 → 空 Optional |
| `reduce(identity, accumulator)` | `E` | O(n) | O(1) | — |
| `reduce(identity, accumulator, finisher)` | `R` | O(n) | O(1) | — |
| `group(classifier)` | `Map<K, E[]>` | O(n) average | O(n) | — |
| `groupBy(keyExtractor, valueExtractor)` | `Map<K, V[]>` | O(n) average | O(n) | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | O(n) | 依索引以輪詢方式分配到 `count` 個桶中 |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | O(n) | 桶編號來自分類器 |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) worst, short-circuits | O(1) | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | O(1) | 位於具體化順序中的位置存取 |
| `findAt(k)` | `Optional<E>` | O(k), stops early | O(1) | 具體化順序中的第 (k+1) 個元素 |
| `findNegativeAt(k)` | `Optional<E>` | O(n−k), stops early | O(1) | 從具體化順序的末端倒數 |
| `findMaximum(comparator?)` / `findMinimum(comparator?)` | `Optional<E>` | O(n) (O(1) on statistics) | O(1) | 預設為結構化比較 |
| `frequency()` | `Map<E, bigint>` | O(n) average | O(n) | 僅限統計可收集器 |
| `[Symbol.iterator]()` / `[Symbol.asyncIterator]()` | iterator | O(n) | O(1) | 對可收集器進行 `for…of` |

### 7.3 範例

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
## 8. 統計

`toNumericStatistics()` 與 `toBigintStatistics()` 提供一個依值排序的緩衝區，外加一套統計 API。兩者皆接受 mapper，因此你可針對投影後的值進行計算：`.average(element => element.price)`。

| 方法 | 意義 | `number` | `bigint` |
| :--- | :--- | :--- | :--- |
| `summate()` | Σx | 精確 | 精確 |
| `average()` / `mean()` | Σx / n | 精確 | 整數除法 |
| `median()` | 中位數（偶數個時取中間兩值的平均） | 精確 | 四捨五入 |
| `mode()` | 出現最頻繁的值 | 精確 | 精確 |
| `variance()` | 母體變異數 σ² | 精確 | 四捨五入 |
| `standardDeviation()` | √σ² | 精確 | 四捨五入 |
| `range()` | 最大值 − 最小值 | 精確 | 精確 |
| `quantile(q)` | 最接近秩的分位數，`0 ≤ q ≤ 1` | 精確 | 精確 |
| `interquartileRange()` | 四等分距（q(0.75) − q(0.25)） | 精確 | 精確 |
| `skewness()` | 偏度 Σ((x−μ)/σ)³ / n | 精確 | 四捨五入 |
| `kurtosis()` | 峰度 Σ((x−μ)/σ)⁴ / n − 3（超額） | 精確 | 四捨五入 |
| `frequency()` | 值 → 計數 | `Map<E, bigint>` | `Map<E, bigint>` |

在已排序的緩衝區上，所有方法皆為 O(1)（排序成本在具體化時一次性支付完畢），唯獨 `frequency()` 為 O(n) 平均、O(n) 空間。

`bigint` 結果以浮點數計算後四捨五入回 `bigint`，因為整數除法會扭曲結果（[1n,2n,3n,4n] 的變異數為 `1.25`，而非 `3`）。若你需要精確的分數統計，請映射至 `number` 並使用數值收集器。

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
## 9. 視窗

`toWindow()` 回傳一個可收集器，其 `slide` / `tumble` 會產出*語意物件之語意物件*。

```typescript
const windows = useOf(1, 2, 3, 4, 5).toWindow();

windows.tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2], [3,4], [5]]

windows.slide(3n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2,3], [2,3,4], [3,4,5], [4,5], [5]]   — trailing partial windows are included
```

`tumble(size)` 整體為 O(n)；`slide(size, step)` 為 O(n × size)，因為視窗彼此重疊。

非同步來源運作方式相同；`slide` / `tumble` 會等待底層緩衝區準備就緒：

```typescript
const asyncWindows = await useFrom(tick()).toWindow().tumble(2n).toUnordered().toArray();
for (const window of asyncWindows) {
  console.log(await window.toUnordered().toArray());
}
```

---

<a id="10-the-index-model"></a>
## 10. 索引模型

索引模型分為兩半：**管線**以低成本、惰性地重寫索引；**可收集器**則決定這些索引的意義。此劃分是刻意的，排序成本也由此而來。

| 概念 | 行為 |
| :--- | :--- |
| 索引型別 | `bigint`，永遠可作為每個回呼的第二個引數使用 |
| 管線算術 | `reverse()` = `redirect(-i - 1n)`、`translate(o)` = `redirect(i + o)`、`shuffle()` = `redirect(random)`——皆為每元素 O(1)、皆為惰性、皆不緩衝任何內容 |
| `toUnordered()`——不進行簿記 | 在 `Map` 中保留每個原始索引原封不動。以無序方式收集的 `translate(2)` 仍會產出索引 `2n,3n,4n,…`。這就是效能契約：不排序、不正規化、O(n) |
| `toOrdered()`——正規化 | 將每個索引重寫為 `((i mod n) + n) mod n`（n = 元素數量），再進行排序。負數或過大的索引會摺疊進 `0..n−1`，因此 `reverse`、`translate(7)` 與 `shuffle` 都能落到有效位置 |
| `toOrdered(comparator)` | 依值排序並將索引重建為位置——這正是統計所使用的方式 |
| 輪轉 | 源自正規化：`translate(2)` 給出索引 `2,3,4,0,1`，排序後即為輪轉 `[4,5,1,2,3]`。算子內不會發生任何緩衝 |
| 重複索引 | 由 `toUnordered()` 偵測並給予代理鍵，因此**不會有任何元素被靜默捨棄**；`toOrdered()` 會保留相等索引的相對順序 |
| `findAt(k)` / `findNegativeAt(k)` | 定址**具體化順序**——`findAt(1n)` 永遠是可收集器所產出元素中的第二個，`findNegativeAt(-1n)` 永遠是最後一個——無論 `redirect` / `reverse` / `translate` 對原始索引做了什麼 |
| `distinct` | 保留首次出現者**及其原始索引** |
| `sub` / `skip` / `limit` | 計算元素個數，而非索引值 |

簡言之：**`OrderedCollectable` 及其子類擁有索引簿記**（以 n 為模數正規化、排序、位置定址），而**`UnorderedCollectable` 透過永不觸及索引來保證效能**。請依查詢而非依管線來選擇。

---

<a id="11-the-asynchronous-model"></a>
## 11. 非同步模型

資料尚不存在的來源會回傳 `AsynchronousSemantic<E>`：

| 非同步來源 | 原因 |
| :--- | :--- |
| `usePromise` | 值稍後才抵達 |
| `useBlob` | `Blob.stream()` 為非同步 |
| `useInterval` | 由 `setInterval` 驅動 |
| `useSubscription` | 由外部事件驅動 |
| `useFrom` / `useIterate` with an `AsyncIterable` | 由 `for await` 產生 |

消費方式一致——`AsynchronousCollectable` 的每個終端都回傳 `Promise`，且其語意（索引模型、正規化、位置式 `findAt`）與同步端完全相同：

```typescript
const stats = await useFrom(asyncGenerator()).map(n => n * 2n).limit(10n).toBigintStatistics();
await stats.summate();

for await (const element of usePromise(Promise.resolve(1)).toUnordered()) {
  console.log(element);
}
```

型別系統無法替你省去的三件事：

1. **結束串流。** 事件或計時器來源永遠不會自行完成。請定義邊界——`limit(n)`、`sub(start, end)` 或 `takeWhile(predicate)`——否則訂閱會持續存在。
2. **等待可收集器。** `toOrdered()`、統計與 `toWindow()` 會等待來源完成後才回應；而永遠不會完成的純 promise 來源會使它們持續擱置。
3. **混用層級。** 同步可收集器無法消費非同步來源。一旦涉及非同步工廠，請讓整條管線停留在非同步端，並對終端操作 `await`。

---

<a id="12-utility-helpers"></a>
## 12. 輔助工具

| 輔助工具 | 用途 | 時間 |
| :--- | :--- | :--- |
| `useCompare(a, b)` | 每個預設排序/最小/最大所使用的結構化比較（`number`、`bigint`、`string`、`boolean`、`symbol`、透過 `Symbol.toPrimitive` 的物件） | O(1) primitives |
| `useRandom(start, end?)` | 隨機的 `number` / `bigint`，在半開區間上均勻分佈 | O(1) |
| `useHash(value, …)` | 適用於任何值的穩定、約 64 位元 `bigint` 雜湊（基本型別、物件、環狀參照） | O(v) over visited values |
| `register(type, handler)` / `unregister(type)` / `maskOf(type)` | 為自訂型別擴充雜湊 | O(1) |
| `useTraverse(object, callback)` | 具循環保護的深度走訪；回呼接收 `(key, value, path)` | O(v + e) |
| `useStringify(object, callback?)` | 能倖存於循環參照的 JSON 序列化 | O(v + e) |
| `useToNumber(value)` / `useToBigInt(value)` | 全函數式轉換（永不拋出；對無法使用的輸入回傳 `0` / `0n`） | O(1) |
| `useGenerator(iterable)` / `useArrange(source, comparator?)` | 原始的 `(accept, interrupt)` 生成器，以及一個排序用生成器 | O(n) / O(n log n) |
| `Optional<T>` | `of`, `ofNullable`, `ofNonNull`, `empty`; `map`, `flat`, `flatMap`, `filter`, `get`, `get(default)`, `ifPresent(action, elseAction)`, `orElse`, `isPresent`, `isEmpty`, `semantic()` | O(1) per method |
| Type guards | `isNumber` (excludes `NaN` and `Infinity`), `isBigInt`, `isString`, `isBoolean`, `isSymbol`, `isFunction`, `isObject`, `isPrimitive`, `isIterable`, `isAsyncIterable`, `isPromise`, `isAsyncFunction`, `isGeneratorFunction`, `isAsyncGeneratorFunction`, `isOptional`, `isSynchronousSemantic` / `isAsynchronousSemantic`, `isSynchronousCollectable` (+ async), `isSynchronousOrderedCollectable`, `isSynchronousUnorderedCollectable`, `isSynchronousStatistics`, `isSynchronousNumericStatistics`, `isSynchronousBigIntStatistics`, `isSynchronousWindowCollectable`, `isSynchronousCollector` | O(1) |

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
## 13. 與其他函式庫的比較

| 面向 | Semantic-TypeScript | RxJS | 原生迭代器 |
| :--- | :--- | :--- | :--- |
| 模型 | 帶有明確 `interrupt` 訊號的推送 | 推送、訂閱物件 | 拉取 |
| 位置 | 每個元素上內在的 `bigint` 索引 | 你組合的算子（`scan`、`withLatestFrom`） | 手動計數器 |
| 惰性 | 算子惰性、可收集器明確 | 算子惰性、`subscribe` 急切 | 惰性 |
| 同步＋非同步 | 單一 API，非同步工廠在型別中標記 | 非同步優先 | 手動以 `for await` 橋接 |
| 終端 API | 豐富的可收集器（`toArray`、`toMap`、`group`、`reduce`、`find*`、統計） | 僅算子 | 無 |
| 統計 | 內建，適用於 `number` 與 `bigint` | 外部 | 無 |
| 生命週期安全 | 邊界算子自動取消訂閱 | 手動 `unsubscribe` / `takeUntil` | 手動 |
| 生態系／體積 | 小巧、零依賴 | 龐大的算子生態系 | 零 |

當你需要以索引驅動、具備明確成本模型且無排程器的資料處理時，請選擇 Semantic-TypeScript。當你需要其算子生態系、多觀察者語意與排程器控制時，請選擇 RxJS。

---

<a id="14-performance-characteristics"></a>
## 14. 效能特性

一次查詢的成本是三個可見部分之和：來源（§5）、算子（§6）、可收集器（§7）。隱藏的部分永遠不會執行兩次。

| 操作 | 時間 | 空間 | 備註 |
| :--- | :--- | :--- | :--- |
| `map` / `filter` / `peek` | O(1) per element | O(1) | 純轉換 |
| `limit` / `takeWhile` | O(1) per element | O(1) | 立即停止上游 |
| `reverse` / `translate` / `shuffle` | O(1) per element | O(1) | 僅索引算術——不緩衝 |
| `distinct` | O(1) average per element | O(n) | 鍵的 `Set` |
| `toUnordered()` | O(n) | O(n) | 每個元素一次 `Map` 插入；索引不變 |
| `toOrdered()` | O(n log n) | O(n) | 正規化 O(n) + 排序 O(n log n) |
| Statistics | O(n log n) once, then O(1) per method | O(n) | 保留已排序/已聚合的緩衝區 |
| `findAt(k)` / `findNegativeAt(k)` | O(k) / O(n−k) | O(1) | 一旦通過該位置便提前中斷 |
| `findMaximum` / `findMinimum` | O(n) generic, O(1) statistics | O(1) | 單次遍歷並維持當前最佳值 |

經驗法則：在真正需要結果之前，讓管線保持惰性；除非順序重要，否則優先使用 `toUnordered()`；在語意允許的情況下，盡早放置 `limit` / `takeWhile`；讓*可收集器*而非算子來決定排序的成本。

---

<a id="15-pitfalls-and-faq"></a>
## 15. 陷阱與常見問答

**「我的管線什麼都沒回傳／卡住了。」** 來源從未結束。`useInterval`、`useSubscription`、`usePromise` 與 `useGenerate` 需要一個邊界（`limit`、`sub`、`takeWhile`）或一個會完成的來源。

**「`reverse()` 什麼都沒做。」** 你用 `toUnordered()` 來消費它，而該收集器保證不進行索引簿記。請改用 `toOrdered()`。

**「`translate(2)` 回傳的元素未輪轉。」** 原因相同：`translate` 只位移索引；輪轉是由 `toOrdered()` 的模數正規化實現的。以無序方式收集時，該位移在原始索引中仍清晰可見。

**「為什麼少了某個元素？」** 上游產出了重複索引，而你正透過 `toUnordered()` 消費。代理鍵能防止資料遺失，但如果你需要依序*看見*這兩個元素，請改用 `toOrdered()`。

**「`findAt(1n)` 回傳了出乎預期的結果。」** `findAt` 定址的是**具體化順序**，而非原始索引。在 `.reverse().toOrdered()` 之後，位置 1 是反轉序列中的第二個元素。若你想要的是攜帶原始索引 `1n` 的元素，請明確地依索引過濾。

**「`bigint` 統計看起來被四捨五入了。」** 確實如此——`bigint` 結果依設計為整數四捨五入（見 [統計](#8-statistics)）。請映射至 `number` 以取得精確分數。

**「我必須在 `toArray()` 之前先呼叫 `toXxx()` 嗎？」** 是的。終端操作存在於可收集器上，而非語意物件上。這是刻意的：它讓儲存與排序成本在型別中顯現。

**「它支援 tree-shake 嗎？」** 已宣告 `sideEffects: false`，因此請只匯入你所使用的部分。請注意 `useHash` 會在模組載入時註冊其預設處理器。

---

<a id="16-license"></a>
## 16. 授權

MIT © Eloy Kim

完整發行歷程請見 [CHANGELOG.md](./CHANGELOG.md)。
