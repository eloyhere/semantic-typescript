# **Semantic-TypeScript**

**Flow, Indexed.** Your data, under precise control.

English · [简体中文](./readme.cn.md) · [繁體中文](./readme.tw.md) · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

A type-safe stream processing library that unifies **JavaScript generators**, **Java Stream** and
**index-based data addressing**. Every element carries a `bigint` index, every pipeline is lazy, and
every terminal operation is an explicit opt-in.

```bash
npm install semantic-typescript
```

- Zero runtime dependencies, pure ESM, ships its own types.
- 55 regression tests: `npm install && npm test`.
- Full change history: [CHANGELOG.md](./CHANGELOG.md).

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Architecture](#2-architecture)
3. [Data Flow: From Source to Result](#3-data-flow-from-source-to-result)
4. [Quick Start](#4-quick-start)
5. [Factory Functions](#5-factory-functions)
6. [Transformation Operators](#6-transformation-operators)
7. [Collectables and Terminal Operations](#7-collectables-and-terminal-operations)
8. [Statistics](#8-statistics)
9. [Windows](#9-windows)
10. [The Index Model](#10-the-index-model)
11. [The Asynchronous Model](#11-the-asynchronous-model)
12. [Utility Helpers](#12-utility-helpers)
13. [Comparison with Other Libraries](#13-comparison-with-other-libraries)
14. [Performance Characteristics](#14-performance-characteristics)
15. [Pitfalls and FAQ](#15-pitfalls-and-faq)
16. [License](#16-license)

---

<a id="1-design-philosophy"></a>
## 1. Design Philosophy

**1. Index first.** In most stream libraries a position is something you *reconstruct* — a counter you
carry in `scan`, or an index argument you thread through by hand. Here position is *intrinsic*: the
generator protocol hands every element a `bigint` index, so `distinct`, `skip`, `sub`, `reverse`,
`translate` and `shuffle` are all expressed as index arithmetic instead of ad-hoc state. Changing an
element's index *is* reordering; re-indexing *is* filtering.

**2. Push with an explicit stop signal.** A source is a function
`(accept, interrupt) => void | Promise<void>`. It pushes elements with `accept(element, index)` and asks
`interrupt(element, index)` whether it should stop. There is no hidden scheduler, no subscription
object, no teardown phase to remember — back-pressure and termination are part of the protocol, and
infinite streams become ordinary (not special) cases.

**3. Laziness is the default; materialisation is a decision.** Operators only wrap generators. Nothing
runs until a **collectable** consumes the pipeline, and the collector you pick decides the cost:
`toUnordered()` is O(n) and never touches your indices, `toOrdered()` is O(n log n) and normalises
them. Because the decision is explicit in the type you get back, you always know whether order and
memory are being paid for.

**4. Redirect is the single reordering mechanism.** `reverse()`, `translate()` and `shuffle()` are
nothing but pre-packaged `redirect()` strategies — each rewrites an element's index and nothing else.
That is why they all **require `toOrdered()`** to take effect: the pipeline only rewrites indices, and
it is the ordered collector that decides what those indices mean.

**5. Sync and async are one API.** The same operators exist for finite in-memory data and for promises,
async iterables, timers, blobs and event subscriptions. Sources that cannot be synchronous say so in
their return type (`AsynchronousSemantic`), so "did I await this?" stops being a runtime surprise.

---

<a id="2-architecture"></a>
## 2. Architecture

Three layers, one direction. Data flows down; the type you hold tells you what you may do next.

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

| Layer | Type | Responsibility | You get it from |
| :--- | :--- | :--- | :--- |
| Source / pipeline | `SynchronousSemantic<E>`<br>`AsynchronousSemantic<E>` | Build the lazy pipeline: transform, re-index, split, merge. No element is touched yet. | Factories, and every operator on a semantic |
| Storage / view | `SynchronousUnorderedCollectable<E>`<br>`SynchronousOrderedCollectable<E>`<br>`SynchronousNumericStatistics<E>`<br>`SynchronousBigIntStatistics<E>`<br>`SynchronousWindowCollectable<E>`<br>(+ `Asynchronous*` counterparts) | Materialise the pipeline into an index-addressed buffer and expose the terminal API. The **ordered** family owns index bookkeeping; the **unordered** family forgoes it for throughput. | `toUnordered()` `toOrdered()` `toNumericStatistics()` `toBigintStatistics()` `toWindow()` `toCollectable()` |
| Collector | `SynchronousCollector<E, A, R>`<br>`AsynchronousCollector<E, A, R>` | A reusable fold: `identity → accumulator → finisher`, optionally with an `interruptor`. Powers every terminal operation and can be written by users. | `useSynchronous*` / `useAsynchronous*` collector factories, or `Collectable.collect(...)` |

Why the middle layer exists: separating "what the pipeline is" from "how it is stored" is what lets the
same `toOrdered()` serve reversal, rotation and shuffling — the pipeline only rewrites indices, and the
collector decides what those indices mean.

---

<a id="3-data-flow-from-source-to-result"></a>
## 3. Data Flow: From Source to Result

```typescript
const result = useRange(0n, 100n)      // (1) source: reserve indices 0n,1n,2n,…
  .filter(n => n % 2n === 0n)          // (2) operator: index is forwarded unchanged
  .translate(2)                        // (3) operator: index becomes i + 2 (a lazy shift)
  .limit(5n);                          // (4) operator: interrupt() returns true after 5 elements

const ordered = result.toOrdered();    // (5) collectable: materialise; indices normalised mod n, sorted
const array = ordered.toArray();       // (6) terminal: drain the buffer
```

1. **Build.** Steps 1–4 construct nothing but closures. A hundred elements are never generated.
2. **Push.** When a collectable finally runs the generator, elements flow without a scheduler: the
   source drives, `accept` writes into the collector, `interrupt` decides when to stop — that is why
   `limit(5n)` in the middle of a million-element range costs five iterations, not a million.
3. **Index.** Operators never lose the index. `filter` forwards the original index (so "the 3rd *kept*
   element" is still "index 3"), while `skip` / `sub` / `limit` / `distinct` re-index deliberately.
4. **Materialise.** A collectable executes the generator exactly once, at construction time.
5. **Terminal.** Methods on the collectable read the buffer; they are cheap, repeatable, and never
   re-run the pipeline.

**The one rule worth memorising:** transformations are lazy, collectables are eager, terminals are free.

---

<a id="4-quick-start"></a>
## 4. Quick Start

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
## 5. Factory Functions

### 5.1 Overview

Construction is always O(1) — a factory only wraps a generator. The table below states the cost of
*consuming* `n` elements from each source, plus the extra space the source itself needs beyond the
elements you collect.

| Factory | Signature (result) | Time (consume n) | Space (source) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | Indices are 0..n−1; the spread argument is already materialised |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | Wraps any `Iterable` / `AsyncIterable`; iterated once on collect |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` is exclusive; `step` must be non-zero; `number` and `bigint` both work |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | A supplier is called once per element |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | Identity element for `concat` |
| `useText` | `useText(text)`<br>`useText(text, delimiter)`<br>`useText(text, start)` / `(text, start, end)` | O(n) | O(n) for the text | Iterates **code points**, so emoji and CJK stay single elements |
| `useAttribute` | `useAttribute<T>(object) → SynchronousSemantic<{key, value}>` | O(v + e) over v values and e edges | O(d + v) for the visited set at depth d | Recursively walks nested objects/arrays with cycle protection |
| `useGenerate` | `useGenerate<E>(supplier, interrupt) → SynchronousSemantic<E>` | O(n) × supplier cost | O(1) | **Must** have a stopping `interrupt` (or a downstream `limit` / `takeWhile`) |
| `useIterate` | `useIterate<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useIterate<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) per collection | O(1) | Replays the iterator on each collection |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period (real time) | O(1) | Emits elapsed time; consumes real time |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | A single element at index `0n` |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob size) | O(chunk) per emitted copy | Default chunk is 64 KiB; every chunk is an independent copy |
| `useSubscription` | `useSubscription(target, subscriber, event \| events) → AsynchronousSemantic<Event>` | one element per event | O(1) | `limit()` / `sub()` / `takeWhile()` define the unsubscribe boundary |

### 5.2 Examples

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
## 6. Transformation Operators

### 6.1 Overview

Every operator returns a new `Semantic`; none of them touch an element until a collectable runs.
Time is the extra cost **per element** (beyond the upstream's own cost); space is the extra memory the
operator keeps while the pipeline runs.

| Operator | Purpose | Index effect | Time (per element) | Space |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | 1:1 transform | forwarded | O(1) | O(1) |
| `filter(predicate)` | keep matching elements | forwarded | O(1) | O(1) |
| `flat(mapper)` | 1:N flatten (iterable or semantic) | re-indexed from 0 | O(1) per emitted element | O(1) |
| `flatMap(mapper)` | 1:N flatten, may change the element type | re-indexed from 0 | O(1) per emitted element | O(1) |
| `distinct(keyExtractor?)` | drop repeated keys, keep the first | forwarded | O(1) average | O(n) for the key set |
| `peek(consumer)` | side effect, element passes through | forwarded | O(1) | O(1) |
| `limit(count)` | take the first *n* | re-indexed from 0 | O(1), stops upstream after n | O(1) |
| `skip(count)` | drop the first *n* | forwarded | O(1) per skipped element | O(1) |
| `sub(start, end)` | positional slice `[start, end)` | forwarded | O(1) | O(1) |
| `takeWhile(predicate)` | take while the predicate holds | forwarded | O(1), stops upstream on first miss | O(1) |
| `dropWhile(predicate)` | drop while the predicate holds | re-indexed from 0 | O(1) | O(1) |
| `concat(other)` | append a semantic or iterable | continues the index | O(1) | O(1) |
| `redirect(redirector)` | compute a new index however you like | **yours** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | negated and shifted | O(1) | O(1) |
| `translate(offset)` | lazy shift of every index by *offset* | `i + offset` | O(1) | O(1) |
| `translate(mapper)` | per-element index shift | `i + mapper(element, i)` | O(1) | O(1) |
| `shuffle(mapper?)` | randomise the index (or use your own mapper) | random | O(1) | O(1) |
| `pipe(conversion)` | hand the generator to a custom function | up to you | yours | yours |
| `semantic()` | lift a collectable back into a semantic | unchanged | O(1) | O(1) |

### 6.2 Notes that matter

**`reverse`, `translate` and `shuffle` are all `redirect` strategies and need an ordered collector.**
They only rewrite indices — nothing is buffered, nothing is rotated yet. It is `toOrdered()` that
normalises the indices modulo the element count and turns them into an order:

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(-2).toOrdered().toArray();        // [3,4,5,1,2]
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3, 4, 5]).shuffle().toOrdered().toArray();            // a fresh permutation per call
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

Collected with `toUnordered()` instead, the same pipelines return the elements in arrival order with
their raw indices — see [The Index Model](#10-the-index-model).

**`translate` is a pure, lazy index shift.** Both overloads add to the index (`i + offset` or
`i + mapper(element, i)`) and never buffer the stream. A rotation only materialises when the *ordered
collector* normalises indices modulo the element count — so `translate(2)` is cheap even on an
infinite range followed by `limit`.

**`redirect` is the general tool.** Any index strategy can be expressed with it — reversed,
interleaved, hash-partitioned:

```typescript
useFrom([1, 2, 3, 4, 5]).redirect((_e, i) => -i - 1n).toOrdered().toArray();   // [5,4,3,2,1]
useFrom([1, 2, 3, 4]).redirect((_e, i) => i % 2n === 0n ? i + 1n : i - 1n)
  .toOrdered().toArray();                                                       // [2,1,4,3]
```

**Index-driven slicing stays first-class:**

```typescript
useOf(1, 2, 3, 4, 5).sub(1, 3).toUnordered().toArray();               // [2,3]
useOf(1, 2, 3, 4, 5).skip(2n).toUnordered().toArray();                // [3,4,5]
useOf(1, 2, 3, 4, 5).takeWhile(n => n < 3).toUnordered().toArray();   // [1,2]
useOf(1, 2, 3, 4, 1).dropWhile(n => n < 3).toUnordered().toArray();   // [3,4,1]
```

---

<a id="7-collectables-and-terminal-operations"></a>
## 7. Collectables and Terminal Operations

### 7.1 Choosing a collectable

The collectable owns both the **order** and the **index bookkeeping**. `n` is the element count.

| Collectable | Structure | Time | Space | Order | Use when |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | `Map<bigint, E>` keyed by index | O(n) | O(n) | insertion order | maximum throughput, order irrelevant; raw indices are preserved untouched |
| `toOrdered()` | array sorted by element index | O(n log n) | O(n) | by normalised index | reversal/rotation/shuffling must take effect, or you need positional access |
| `toOrdered(comparator)` | sorted by your comparator, index rebuilt as position | O(n log n) | O(n) | by your comparator | sorted views, min/max-style reads |
| `toNumericStatistics()` | value-sorted buffer | O(n log n) | O(n) | by value | statistics over `number` |
| `toBigintStatistics()` | value-sorted buffer | O(n log n) | O(n) | by value | statistics over `bigint` |
| `toWindow()` | value-sorted buffer | O(n log n) | O(n) | by value | `slide` / `tumble` |
| `toCollectable(mapper)` | whatever the mapper returns | — | — | — | custom collectables |

### 7.2 Terminals

Costs are stated after materialisation; `k` is the target position and `n` the element count.

| Terminal | Returns | Time | Space | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | O(n) | O(n) | Drains the buffer |
| `toSet()` | `Set<E>` | O(n) average | O(n) | Deduplicates by identity |
| `toMap(keyExtractor, valueExtractor?)` | `Map<K, V>` | O(n) average | O(n) | Last write wins |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | O(1) | The buffer already knows |
| `forEach(action)` | `void` | O(n) | O(1) | `action(element, index)` |
| `join(…)` | `string` | O(n) | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `log()` / `error()` | `void` | O(n) | O(n) | Console output wrapped in `[prefix … suffix]` |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | O(1) | IO-like terminal |
| `collect(collector)`<br>`collect(identity, accumulator, finisher)` | `R` | O(n) | accumulator | The generic fold behind every terminal above |
| `reduce(accumulator)` | `Optional<E>` | O(n) | O(1) | Empty stream → empty Optional |
| `reduce(identity, accumulator)` | `E` | O(n) | O(1) | — |
| `reduce(identity, accumulator, finisher)` | `R` | O(n) | O(1) | — |
| `group(classifier)` | `Map<K, E[]>` | O(n) average | O(n) | — |
| `groupBy(keyExtractor, valueExtractor)` | `Map<K, V[]>` | O(n) average | O(n) | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | O(n) | Round-robin by index into `count` buckets |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | O(n) | The bucket number comes from the classifier |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) worst, short-circuits | O(1) | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | O(1) | Positional in materialised order |
| `findAt(k)` | `Optional<E>` | O(k), stops early | O(1) | The (k+1)-th element **in materialised order** |
| `findNegativeAt(k)` | `Optional<E>` | O(n−k), stops early | O(1) | Counts back from the end of materialised order |
| `findMaximum(comparator?)` / `findMinimum(comparator?)` | `Optional<E>` | O(n) (O(1) on statistics) | O(1) | Defaults to a structural comparison |
| `frequency()` | `Map<E, bigint>` | O(n) average | O(n) | Statistics collectables only |
| `[Symbol.iterator]()` / `[Symbol.asyncIterator]()` | iterator | O(n) | O(1) | `for…of` over a collectable |

### 7.3 Examples

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
## 8. Statistics

`toNumericStatistics()` and `toBigintStatistics()` give you a value-sorted buffer plus a statistical API.
Both accept a mapper, so you can compute over a projected value: `.average(element => element.price)`.

| Method | Meaning | `number` | `bigint` |
| :--- | :--- | :--- | :--- |
| `summate()` | Σx | exact | exact |
| `average()` / `mean()` | Σx / n | exact | integer division |
| `median()` | middle value (mean of the two middles for even counts) | exact | rounded |
| `mode()` | most frequent value | exact | exact |
| `variance()` | population variance σ² | exact | rounded |
| `standardDeviation()` | √σ² | exact | rounded |
| `range()` | max − min | exact | exact |
| `quantile(q)` | nearest-rank quantile, `0 ≤ q ≤ 1` | exact | exact |
| `interquartileRange()` | q(0.75) − q(0.25) | exact | exact |
| `skewness()` | Σ((x−μ)/σ)³ / n | exact | rounded |
| `kurtosis()` | Σ((x−μ)/σ)⁴ / n − 3 (excess) | exact | rounded |
| `frequency()` | value → count | `Map<E, bigint>` | `Map<E, bigint>` |

All methods are O(1) on the sorted buffer (the sort was paid once, at materialisation), except
`frequency()` which is O(n) average with O(n) space.

`bigint` results are computed in floating point and rounded back to `bigint`, because integer division
would otherwise distort them (the variance of `[1n,2n,3n,4n]` is `1.25`, not `3`). If you need exact
fractional statistics, map to `number` and use the numeric collector.

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
## 9. Windows

`toWindow()` returns a collectable whose `slide` / `tumble` produce a semantic *of semantics*.

```typescript
const windows = useOf(1, 2, 3, 4, 5).toWindow();

windows.tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2], [3,4], [5]]

windows.slide(3n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2,3], [2,3,4], [3,4,5], [4,5], [5]]   — trailing partial windows are included
```

`tumble(size)` is O(n) overall; `slide(size, step)` is O(n × size) because windows overlap.

Asynchronous sources work the same way; `slide` / `tumble` wait for the underlying buffer to be ready:

```typescript
const asyncWindows = await useFrom(tick()).toWindow().tumble(2n).toUnordered().toArray();
for (const window of asyncWindows) {
  console.log(await window.toUnordered().toArray());
}
```

---

<a id="10-the-index-model"></a>
## 10. The Index Model

The index model has two halves: the **pipeline** rewrites indices cheaply and lazily; the
**collectable** decides what they mean. That split is deliberate, and it is where ordering costs live.

| Concept | Behaviour |
| :--- | :--- |
| Index type | `bigint`, always available as the second argument of every callback |
| Pipeline arithmetic | `reverse()` = `redirect(-i - 1n)`, `translate(o)` = `redirect(i + o)`, `shuffle()` = `redirect(random)` — all O(1) per element, all lazy, none buffers anything |
| `toUnordered()` — no bookkeeping | Keeps every raw index untouched in a `Map`. `translate(2)` collected unordered still yields indices `2n,3n,4n,…`. This is the performance contract: no sorting, no normalisation, O(n) |
| `toOrdered()` — normalisation | Rewrites each index to `((i mod n) + n) mod n` (n = element count), then sorts. Negative or oversized indices fold into `0..n−1`, so `reverse`, `translate(7)` and `shuffle` all land on a valid position |
| `toOrdered(comparator)` | Sorts by value and rebuilds indices as positions — this is what statistics use |
| Rotation | Falls out of the normalisation: `translate(2)` gives indices `2,3,4,0,1`, which sort to the rotation `[4,5,1,2,3]`. No buffering happens in the operator |
| Duplicate indices | Detected by `toUnordered()` and given surrogate keys, so **no element is silently dropped**; `toOrdered()` keeps equal indices in relative order |
| `findAt(k)` / `findNegativeAt(k)` | Address the **materialised order** — `findAt(1n)` is always the second element of what the collectable produced, `findNegativeAt(-1n)` always the last — regardless of what `redirect` / `reverse` / `translate` did to the raw indices |
| `distinct` | Keeps the first occurrence **and its original index** |
| `sub` / `skip` / `limit` | Count elements, not index values |

In short: **`OrderedCollectable` and its subclasses own index bookkeeping** (normalise modulo n, sort,
positional addressing), while **`UnorderedCollectable` guarantees performance by never touching
indices**. Choose per query, not per pipeline.

---

<a id="11-the-asynchronous-model"></a>
## 11. The Asynchronous Model

Sources whose data cannot exist yet return `AsynchronousSemantic<E>`:

| Asynchronous source | Why |
| :--- | :--- |
| `usePromise` | the value arrives later |
| `useBlob` | `Blob.stream()` is asynchronous |
| `useInterval` | driven by `setInterval` |
| `useSubscription` | driven by external events |
| `useFrom` / `useIterate` with an `AsyncIterable` | produced by `for await` |

Consumption is uniform — every terminal of an `AsynchronousCollectable` returns a `Promise`, and the
semantics (index model, normalisation, positional `findAt`) are identical to the synchronous side:

```typescript
const stats = await useFrom(asyncGenerator()).map(n => n * 2n).limit(10n).toBigintStatistics();
await stats.summate();

for await (const element of usePromise(Promise.resolve(1)).toUnordered()) {
  console.log(element);
}
```

Three things the type system will not save you from:

1. **Ending the stream.** An event or timer source never completes on its own. Define the boundary —
   `limit(n)`, `sub(start, end)` or `takeWhile(predicate)` — or the subscription stays alive.
2. **Awaiting the collectable.** `toOrdered()`, statistics and `toWindow()` wait for the source to
   complete before answering; a promise-only source that never completes keeps them pending.
3. **Mixing layers.** A synchronous collectable cannot consume an asynchronous source. Once an async
   factory is involved, keep the whole pipeline on the async side and `await` the terminals.

---

<a id="12-utility-helpers"></a>
## 12. Utility Helpers

| Helper | Purpose | Time |
| :--- | :--- | :--- |
| `useCompare(a, b)` | Structural comparison used by every default sort/min/max (`number`, `bigint`, `string`, `boolean`, `symbol`, objects via `Symbol.toPrimitive`) | O(1) primitives |
| `useRandom(start, end?)` | Random `number` / `bigint`, uniform over the half-open range | O(1) |
| `useHash(value, …)` | Stable 64-bit-ish `bigint` hash for any value (primitives, objects, cycles) | O(v) over visited values |
| `register(type, handler)` / `unregister(type)` / `maskOf(type)` | Extend the hash for custom types | O(1) |
| `useTraverse(object, callback)` | Deep walk with cycle protection; the callback receives `(key, value, path)` | O(v + e) |
| `useStringify(object, callback?)` | JSON serialisation that survives circular references | O(v + e) |
| `useToNumber(value)` / `useToBigInt(value)` | Total conversions (never throw; return `0` / `0n` for unusable input) | O(1) |
| `useGenerator(iterable)` / `useArrange(source, comparator?)` | Raw `(accept, interrupt)` generator, and a sorting generator | O(n) / O(n log n) |
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
## 13. Comparison with Other Libraries

| Aspect | Semantic-TypeScript | RxJS | Native iterators |
| :--- | :--- | :--- | :--- |
| Model | push with an explicit `interrupt` signal | push, subscription objects | pull |
| Position | intrinsic `bigint` index on every element | operators you compose (`scan`, `withLatestFrom`) | manual counter |
| Laziness | operators lazy, collectables explicit | operators lazy, `subscribe` eager | lazy |
| Sync + async | one API, async factories flagged in the type | async-first | `for await` bridging by hand |
| Terminal API | rich collectable (`toArray`, `toMap`, `group`, `reduce`, `find*`, statistics) | operators only | none |
| Statistics | built in, for `number` and `bigint` | external | none |
| Lifecycle safety | the boundary operator unsubscribes | manual `unsubscribe` / `takeUntil` | manual |
| Ecosystem / size | small, zero dependencies | large operator ecosystem | zero |

Choose Semantic-TypeScript when you want index-driven data processing with an explicit cost model and
no scheduler. Choose RxJS when you need its operator ecosystem, multi-observer semantics and scheduler
control.

---

<a id="14-performance-characteristics"></a>
## 14. Performance Characteristics

The cost of a query is the sum of three visible parts: source (§5), operators (§6), collectable
(§7). Nothing hidden ever runs twice.

| Operation | Time | Space | Notes |
| :--- | :--- | :--- | :--- |
| `map` / `filter` / `peek` | O(1) per element | O(1) | pure transformation |
| `limit` / `takeWhile` | O(1) per element | O(1) | stops the upstream immediately |
| `reverse` / `translate` / `shuffle` | O(1) per element | O(1) | index arithmetic only — no buffering |
| `distinct` | O(1) average per element | O(n) | `Set` of keys |
| `toUnordered()` | O(n) | O(n) | one `Map` insert per element; indices untouched |
| `toOrdered()` | O(n log n) | O(n) | normalise O(n) + sort O(n log n) |
| Statistics | O(n log n) once, then O(1) per method | O(n) | keeps a sorted/aggregated buffer |
| `findAt(k)` / `findNegativeAt(k)` | O(k) / O(n−k) | O(1) | early interrupt as soon as the position is passed |
| `findMaximum` / `findMinimum` | O(n) generic, O(1) statistics | O(1) | single pass with a running best |

Rules of thumb: keep the pipeline lazy until you actually need a result; prefer `toUnordered()` unless
order matters; place `limit` / `takeWhile` as early as the semantics allow; let the *collectable*, not
the operator, decide the cost of ordering.

---

<a id="15-pitfalls-and-faq"></a>
## 15. Pitfalls and FAQ

**“My pipeline returns nothing / hangs.”** The source never ended. `useInterval`, `useSubscription`,
`usePromise` and `useGenerate` need a boundary (`limit`, `sub`, `takeWhile`) or a completing source.

**“`reverse()` did nothing.”** You consumed it with `toUnordered()`, which guarantees no index
bookkeeping. Use `toOrdered()`.

**“`translate(2)` returned the elements unrotated.”** Same reason: `translate` only shifts indices;
the rotation is realised by `toOrdered()`'s modulo normalisation. Collected unordered, the shift is
still visible in the raw indices.

**“Why is an element missing?”** An upstream produced duplicate indices and you are consuming through
`toUnordered()`. Surrogate keys prevent data loss, but if you need to *see* both elements in order,
consume with `toOrdered()` instead.

**“`findAt(1n)` returns something unexpected.”** `findAt` addresses the **materialised order**, not
the raw index. After `.reverse().toOrdered()`, position 1 is the second element of the reversed
sequence. If you want the element carrying raw index `1n`, filter on the index explicitly.

**“`bigint` statistics look rounded.”** They are — `bigint` results are integer-rounded by design (see
[Statistics](#8-statistics)). Map to `number` for exact fractions.

**“Do I have to call `toXxx()` before `toArray()`?”** Yes. Terminal operations live on collectables, not
on semantics. That is deliberate: it makes the storage and ordering cost visible in the type.

**“Does it tree-shake?”** `sideEffects: false` is declared, so import only what you use. Note that
`useHash` registers its default handlers when the module is loaded.

---

<a id="16-license"></a>
## 16. License

MIT © Eloy Kim

See [CHANGELOG.md](./CHANGELOG.md) for the full release history.
