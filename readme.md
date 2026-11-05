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
- 684 regression tests: `npm test`.
- Full change history: [CHANGELOG.md](./CHANGELOG.md).

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Architecture](#2-architecture)
3. [Quick Start](#3-quick-start)
4. [Factory Functions](#4-factory-functions)
5. [Transformation Operators](#5-transformation-operators)
6. [Collectables and Terminal Operations](#6-collectables-and-terminal-operations)
7. [Statistics and Windows](#7-statistics-and-windows)
8. [The Index Model](#8-the-index-model)
9. [The Asynchronous Model](#9-the-asynchronous-model)
10. [Periodic Analysis: Rings, Fields and Scores](#10-periodic-analysis-rings-fields-and-scores)
11. [Utility Helpers](#11-utility-helpers)
12. [Performance and Pitfalls](#12-performance-and-pitfalls)
13. [Phase Rings: An Exact Cycle of Positions](#13-phase-rings)
14. [Signal Analysis: Windows, Spectra and Time](#14-signal-analysis)
15. [License](#15-license)

---

<a id="1-design-philosophy"></a>
## 1. Design Philosophy

Three ideas, one pipeline:

**Index is data.** Every element is addressed by a `bigint`. Reversal, rotation, shuffling and
partitioning are index arithmetic, not buffer operations. Nothing is materialised until a
collectable asks for it.

**Laziness is the default.** A factory wraps a generator; an operator wraps another generator. No
element is requested until a terminal operation runs, so an infinite source is perfectly legal as
long as something downstream stops it.

**Terminals are explicit.** `map` returns a `Semantic`, not an array. Values appear only when you
name a collectable — `toUnordered()`, `toOrdered()`, `toNumericStatistics()`, `toWindow()` — and each
one states what it costs and what order it produces.

The same discipline applies to the mathematical half of the library. A `Complex`, an `Angle` or a
`Frequency` is an immutable value whose invariants are checked at construction; an `Optional`
replaces `null`; and a phase ring states exactly how many elements it holds, what period it has and
how balanced it is.

---

<a id="2-architecture"></a>
## 2. Architecture

```
factory  ──▶  Semantic  ──▶  Semantic  ──▶  Collectable  ──▶  result
 (source)      (map)         (filter)        (terminal)
                    ▲
                    └── every operator returns a new Semantic wrapping a generator
```

| Layer | Module | Responsibility |
| :--- | :--- | :--- |
| Sources | `synchronous/collectors`, `asynchronous/collectors` | Wrap an iterable, a generator, a promise, a blob, an event target |
| Pipelines | `synchronous/semantic`, `asynchronous/semantic` | Lazy operators and index rewriting |
| Collectables | `synchronous/semantic`, `asynchronous/semantic` | Ordered, unordered, statistics, window and custom terminals |
| Collectors | `synchronous/collector`, `asynchronous/collector` | The fold primitives every terminal is built from |
| Mathematics | `mathematics/*` | Angles, complexes, frequencies, spectra, windows, estimators, epicycles, phase rings |
| Structures | `structure/*` | Lists, sets, maps, trees, forests, rings, fields |
| Errors | `structure/error` | The typed `SemanticError` hierarchy and its brand guards |

Synchronous and asynchronous families share one vocabulary: the same operator names, the same index
semantics, the same collectables. The asynchronous variants simply return promises, and they queue
writes so that a read issued after a write always observes it.

### 2.1 What this release moved and broke

Three modules changed location or shape, and a set of defaults changed meaning. Every old behaviour
is still reachable through an explicit option; nothing was removed without a replacement.

| Change | Before | Now |
| :--- | :--- | :--- |
| Forests | `structure/tree/rootedForest`, `structure/tree/unionFindForest` | `structure/forest/rootedForest`, `structure/forest/unionFindForest`; `tree/index.ts` no longer re-exports them |
| Errors | ad-hoc native errors | a fifteen-class hierarchy in `structure/error.ts`, with one brand guard per class and the `SemanticRangeError` alias |
| Estimator options | fixed definitions | `mathematics/quantile.ts` exports `QuantileMethod`, `QuantileOptions`, `SkewnessEstimator`, `KurtosisEstimator` and `VarianceOptions` |
| `quantile` | Hyndman–Fan type 1 | type 7 — R `quantile`, NumPy `linear`, Excel `PERCENTILE.INC` |
| `skewness` / `kurtosis` | `g1` / `g2` | the bias-corrected `G1` / `G2` |
| `variance` / `standardDeviation` | `ddof = 0` | `ddof = 1`, wrapped in an `Optional` |
| `decibel` | one `20·log10` function | removed; `amplitudeDecibel` (20·log10) and `powerDecibel` (10·log10) |
| `Spectrum.flatness()` | magnitudes over both halves | powers over the one-sided half |
| `Spectrum.bandEnergy()` | raw two-sided sum | one-sided by default, folding the conjugate half |
| `shortTimeFourierTransform` / `spectrogram` | symmetric Hann, complete frames | periodic Hann, `boundary: "zeros"`, `padded: true` |

Chapters 6, 7 and 10 document the replacements; the measured consequences are in
[CHANGELOG.md](./CHANGELOG.md).

---

<a id="3-quick-start"></a>
## 3. Quick Start

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
## 4. Factory Functions

Construction is always O(1) — a factory only wraps a generator. The table states the cost of
*consuming* `n` elements, plus the extra space the source itself needs.

| Factory | Signature (result) | Time (consume n) | Space (source) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | Indices are 0..n−1; the spread argument is already materialised |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | Wraps any iterable; iterated once on collect |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` is exclusive; `step` must be non-zero; `number` and `bigint` both work |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | A supplier is called once per element |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | Identity element for `concat` |
| `useText` | `useText(text, delimiter?)` | O(n) | O(n) for the text | Iterates **code points**, so emoji and CJK stay single elements |
| `useAttribute` | `useAttribute<T>(object)` | O(v + e) | O(d + v) | Recursively walks nested objects with cycle protection |
| `useGenerate` | `useGenerate<E>(supplier, interrupt)` | O(n) × supplier cost | O(1) | **Must** have a stopping `interrupt` or a downstream `limit` |
| `useIterate` | `useIterate<E>(Iterable<E>)` / `(AsyncIterable<E>)` | O(n) per collection | O(1) | Replays the iterator on each collection |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period (real time) | O(1) | Emits elapsed time |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | A single element at index `0n` |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob size) | O(chunk) per copy | Default chunk is 64 KiB |
| `useSubscription` | `useSubscription(target, subscriber, event) → AsynchronousSemantic<Event>` | one element per event | O(1) | `limit()` / `takeWhile()` define the unsubscribe boundary |

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
## 5. Transformation Operators

Every operator returns a new `Semantic`; none touches an element until a collectable runs. Time is
the extra cost **per element**; space is what the operator keeps while the pipeline runs.

| Operator | Purpose | Index effect | Time | Space |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | 1:1 transform | forwarded | O(1) | O(1) |
| `filter(predicate)` | keep matching elements | forwarded | O(1) | O(1) |
| `flat(mapper)` / `flatMap(mapper)` | 1:N flatten | re-indexed from 0 | O(1) per emit | O(1) |
| `distinct(keyExtractor?)` | drop repeated keys, keep the first | forwarded | O(1) average | O(n) |
| `peek(consumer)` | side effect, element passes through | forwarded | O(1) | O(1) |
| `limit(count)` | take the first *n* | re-indexed from 0 | O(1) | O(1) |
| `skip(count)` | drop the first *n* | forwarded | O(1) | O(1) |
| `sub(start, end)` | positional slice `[start, end)` | forwarded | O(1) | O(1) |
| `takeWhile(predicate)` | take while the predicate holds | forwarded | O(1) | O(1) |
| `dropWhile(predicate)` | drop while the predicate holds | re-indexed from 0 | O(1) | O(1) |
| `concat(other)` | append a semantic or iterable | continues the index | O(1) | O(1) |
| `redirect(redirector)` | compute a new index however you like | **yours** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | negated and shifted | O(1) | O(1) |
| `translate(offset \| mapper)` | shift every index | `i + offset` | O(1) | O(1) |
| `shuffle(mapper?)` | randomise the index | random | O(1) | O(1) |
| `pipe(conversion)` | hand the generator to a custom function | up to you | yours | yours |
| `semantic()` | lift a collectable back into a semantic | unchanged | O(1) | O(1) |

**`reverse`, `translate` and `shuffle` only rewrite indices.** Nothing is buffered or rotated until
`toOrdered()` normalises the indices modulo the element count:

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

---

<a id="6-collectables-and-terminal-operations"></a>
## 6. Collectables and Terminal Operations

The collectable owns both the **order** and the **index bookkeeping**. `n` is the element count.

### 6.1 Collectables

| Collectable | Structure | Time | Order | Use when |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | `Map<bigint, E>` keyed by index | O(n) | insertion | maximum throughput; raw indices preserved untouched |
| `toOrdered()` | array sorted by element index | O(n log n) | by normalised index | reversal/rotation must take effect |
| `toOrdered(comparator)` | sorted by your comparator | O(n log n) | by your comparator | sorted views |
| `toNumericStatistics()` | value-sorted buffer | O(n log n) | by value | statistics over `number` |
| `toBigintStatistics()` | value-sorted buffer | O(n log n) | by value | statistics over `bigint` |
| `toWindow()` | value-sorted buffer | O(n log n) | by value | `slide` / `tumble` |
| `toCollectable()` | the collectable itself, wired to the generator | O(1) | — | the cheapest way to reach a terminal |
| `toCollectable(mapper)` | whatever the mapper returns | — | — | custom collectables |

### 6.2 Terminals

Every terminal lives on the **collectable**, not on the `Semantic`. That is what "terminals are
explicit" means in practice: a pipeline produces nothing until a collectable is named, and
`toCollectable()` with no mapper is the cheapest one to name.

| Terminal | Returns | Time | Notes |
| :--- | :--- | :--- | :--- |
| `toArray()` / `toSet()` | `Array<E>` / `Set<E>` | O(n) | Drains the buffer; `toSet` deduplicates by identity |
| `toMap(key, value?)` | `Map<K, V>` | O(n) average | Last write wins |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | The buffer already knows |
| `forEach(action)` | `void` | O(n) | `action(element, index)` |
| `join(…)` | `string` | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `reduce(…)` | `Optional<E>` / `E` / `R` | O(n) | Empty stream → empty `Optional` |
| `group(classifier)` / `groupBy(key, value)` | `Map<K, E[]>` | O(n) average | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | Round-robin by index |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | The bucket number comes from the classifier |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) worst, short-circuits | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | Positional in materialised order |
| `findAt(k)` / `findNegativeAt(k)` | `Optional<E>` | O(k) / O(n−k) | Counts from the front / the end |
| `findMaximum(cmp?)` / `findMinimum(cmp?)` | `Optional<E>` | O(n) | Defaults to a structural comparison |
| `frequency()` | `Map<E, bigint>` | O(n) average | Statistics collectables only |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | IO-like terminal |
| `collect(collector)` | `R` | O(n) | The generic fold behind every terminal above |

### 6.3 Structure collectors

`toArray`, `toSet` and `toMap` end a pipeline in a JavaScript container. Twelve more terminals end it
in one of the library's own structures, so the result carries the invariants that structure
guarantees rather than the ones an array happens to have. They are available on every collectable,
including the bare one from `toCollectable()`.

| Terminal | Returns | Order | Cost |
| :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | traversal | O(n) |
| `toSet()` | `Set<E>` | insertion, SameValueZero | O(n) average |
| `toMap(key, value?)` | `Map<K, V>` | insertion; the last write wins | O(n) average |
| `toOrderedSet(comparator?)` | `SynchronousOrderedSet<E>` | comparator-ascending | O(n²) worst case |
| `toUnorderedSet()` | `SynchronousUnorderedSet<E>` | unspecified (hash buckets) | O(n) expected |
| `toOrderedMap(key, value?)` | `SynchronousOrderedMap<K, V>` | insertion; the last write wins | O(n) expected |
| `toUnorderedMap(key, value?)` | `SynchronousUnorderedMap<K, V>` | unspecified | O(n) expected |
| `toList()` | `SynchronousList<E>` | traversal, duplicates kept | O(n) |
| `toRing(span?)` | `SynchronousRing<E>` | traversal fixes ring positions | O(n) |
| `toLRUSet(capacity)` | `SynchronousUnorderedLRUSet<E>` | recency; the last `capacity` survive | O(n²) worst case |
| `toLRUMap(capacity, key, value?)` | `SynchronousUnorderedLRUMap<K, V>` | recency | O(n) expected |
| `toSkipSet(comparator?)` | `SynchronousSkipSet<E>` | comparator-ascending, navigable | O(n²) worst case |
| `toSkipMap(key, value?)` | `SynchronousSkipMap<K, V>` | key comparator, navigable | O(n) expected |
| `toBinarySearchTree(comparator?)` | `SynchronousBinarySearchTree<E>` | comparator-ascending, height-balanced | O(n log n) |
| `toRootedForest()` | `SynchronousRootedForest<E>` | encounter order becomes structure | O(n) |

The result type follows the collectable's own element type, so no terminal needs a type argument: a
`SynchronousCollectable<E>` hands you `Array<E>`, `SynchronousList<E>` or `SynchronousOrderedSet<E>`
directly. Only the business arguments remain — the comparator of `toOrderedSet` / `toSkipSet` /
`toBinarySearchTree`, the capacity of the LRU pair, the span of `toRing`, and the key and value
extractors of the map family.

A ring is a set, so repeated elements keep their first position; every other structure above keeps
duplicates unless its own contract says otherwise (`toOrderedSet`, `toUnorderedSet`, `toSkipSet` are
sets; `toBinarySearchTree` and `toList` are not).

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

The asynchronous collectables expose the same terminals and resolve each in a promise, so the call
shape only gains an `await`.

---

<a id="7-statistics-and-windows"></a>
## 7. Statistics and Windows

### 7.1 The statistics surface

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();                    // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();                    // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();                     // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                       // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance().get();             // 3.2    (n − 1)
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation().get();    // 1.7889 (n − 1)
```

Both statistics families expose the same surface — `summate`, `average`, `median`, `mode`,
`variance`, `standardDeviation`, `frequency`, `findMaximum`, `findMinimum` — with `bigint` arithmetic
for `toBigintStatistics()`. The dispersion measures and the quantile family return `Optional`,
because a sample can be too small for them to be defined; unwrap them with `.get()`, `.orElse(…)` or
`.isPresent()`.

### 7.2 Estimators and defaults

The defaults are the definitions R, NumPy, pandas and Excel use, so a value computed here can be
compared with those tools without a correction factor.

| Statistic | Default | Previous | Restore the old value with |
| :--- | :--- | :--- | :--- |
| `quantile(probability)` | Hyndman–Fan type 7 | type 1 | `{ method: "type-1" }` |
| `interquartileRange()` | Hyndman–Fan type 7 | type 1 | `{ method: "type-1" }` |
| `skewness()` | bias-corrected `G1` | `g1` | `{ estimator: "g1" }` |
| `kurtosis()` | bias-corrected excess `G2` | `g2` | `{ estimator: "g2" }` |
| `variance()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |
| `standardDeviation()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |

All nine Hyndman–Fan types are available as `"type-1"` … `"type-9"`, and `{ excess: false }` adds
three back to a kurtosis, reporting the non-excess fourth standardised moment. The option types —
`QuantileMethod`, `QuantileOptions`, `SkewnessEstimator`, `KurtosisEstimator`, `VarianceOptions` —
are exported from `mathematics/quantile.ts`.

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

`G1` and `G2` are undefined below three and four observations, and the sample variance and standard
deviation are undefined below two under `ddof = 1`. That is reported as an empty `Optional` rather
than as a misleading zero:

```typescript
useOf(1, 2, 3).toNumericStatistics().kurtosis().isEmpty();     // true  (G2 needs four observations)
useOf(1, 2).toNumericStatistics().skewness().isEmpty();        // true  (G1 needs three)
useOf(1).toNumericStatistics().variance().isEmpty();           // true  (ddof = 1 needs two)
useOf(1).toNumericStatistics().variance({ ddof: 0 }).get();    // 0
```

The bigint views accept the same options and round every result back to a whole `bigint`.

### 7.3 Windows

Windows re-expose the buffered elements as a pipeline of pipelines, so a window can be consumed
without materialising it into an array first. Both forms include a final partial window.

```typescript
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[2,3],[3,4],[4]]

useFrom([1, 2, 3, 4]).toWindow().tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[3,4]]
```

---

<a id="8-the-index-model"></a>
## 8. The Index Model

An index is a `bigint` attached to every element. Operators either **forward** it, **re-index** it
from zero, or let you **compute** it.

Ordered collection normalises each index modulo the element count, then sorts by the result. That is
why `translate(7)` on five elements equals `translate(2)`: `7 ≡ 2 (mod 5)`.

Unordered collection keeps whatever index the pipeline produced and returns elements in arrival
order. Negative indices are legal and simply sort before non-negative ones once normalised.

---

<a id="9-the-asynchronous-model"></a>
## 9. The Asynchronous Model

`AsynchronousSemantic` mirrors the synchronous surface, returning promises. Writes are queued, so a
read issued after a write always observes it.

```typescript
const ring = new AsynchronousRing([1, 2]);
const added   = ring.add(3);          // queued
const sampled = ring.elementAt(2n);   // observes the write above
await added;
(await sampled).get().element;         // 3
```

Factories that are asynchronous by nature — `usePromise`, `useBlob`, `useInterval`,
`useSubscription` — return `AsynchronousSemantic` directly, and `useFrom` / `useIterate` upgrade
themselves when handed an `AsyncIterable`.

---

<a id="10-periodic-analysis-rings-fields-and-scores"></a>
## 10. Periodic Analysis: Rings, Fields and Scores

The mathematical half of the library treats a cycle as a first-class object rather than a lookup
table. Three constructions work together.

### 10.1 A ring is one integer

A `Ring` is an **n-fold cycle**: the element count, the positional period and the number of distinct
phases are the same integer `n`. The phase of a position is computed from its exact residue, so the
ring is periodic to the bit:

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

`frequency` is the **ambient** rotation rate, not a phase step between positions: the environment
moves every phasor by the same angle, so it can never break the intrinsic pattern. `span` fixes how
many turns the ring occupies.

`purity()` is the share of energy carried by the fundamental mode,
`max(|c₁|², |c_{n−1}|²) / (n · Σ|z|²)`. It is `1` exactly when the ring is the `n`-th roots of unity
up to rotation, and it costs `O(n)` because only two bins are needed. Both directions are tested
because a ring may traverse the circle either way.

### 10.2 A field is a bounded score

A `PhaseField` maps a relative phase to a score in `[-1, 1]`:

```typescript
import { useField, useRadian } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ): +1 aligned, −1 opposed
const mixed  = useField([0.4, 0.3, 0.3]);  // first three harmonics

cosine.sample(useRadian(0));               //  1
cosine.sample(useRadian(Math.PI));         // -1
```

The score is a truncated cosine series, `a₀ + Σ wₘ·cos(2πmΔ)`, and the constructor enforces
`|a₀| + Σ|wₘ| ≤ 1`. By the triangle inequality the score can never leave `[-1, 1]` — the bound is a
**consequence of the construction**, not a clamp applied afterwards.

The reason the field is a series rather than a table: an `n`-point table reproduces its own samples
exactly, but its trigonometric interpolant overshoots between them. A five-point table scored
`[+1, +0.5, −1, −0.5, 0]` interpolates over `[−1.0428, 1.0041]`, which already breaks the promise.
A bounded series cannot.

### 10.3 Analysis measures data against every element

Each ring element is a reference phase. `analyse` locates every observation back on the ring and
measures it against each reference:

```typescript
const ring = new SynchronousRing(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                              // 5
report.missed;                               // 1  ('zz' is not on the ring)
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

Each reference row reports `count`, the mean relative phase `mean`, and the mean resultant length
`resultant`. One identity is worth remembering: **`resultant` is the same for every reference**,
because changing the baseline only rotates all relative phases by a constant. What differs per
reference is the count and the mean.

```typescript
const ring = new SynchronousRing(["a", "b", "c"]);
ring.scoresAt(0, cosine);                   // one score per position, in [-1, 1]
```

### 10.4 Related instruments

| Call | Answers | Cost |
| :--- | :--- | :--- |
| `purity()` | is the ring still the `n`-th roots of unity? | O(n) |
| `resultant(t?)` | how concentrated are the phasors right now? | O(n) |
| `analyse(data)` | how does this data sit against every element? | O(n · m) |
| `toSpectrum()` | the ring as a spectrum, wavenumber on the frequency axis | O(n²) |
| `useAngularSpectrum(ring, instants, plan)` | the `(ω, n)` plane over time | O(n² · frames) |

Two more primitives round out the model: `combineRings(a, b)` joins two rings on their least common
multiple (a pullback, not a product — the pairs that cannot share an instant are simply absent), and
`rate()` gives each element its own intrinsic frequency so that a ring can drift against the
environment. `jetAt`, `windingAt` and `errorIntegralAt` expose the differential state of that drift.

### 10.5 Spectral windows

The ring constructions are one half of the analytic surface; the other half works on sampled
signals. Its most reused primitive is the window, and every shape here has two forms. The symmetric
form divides the frame by `count − 1`; the periodic (DFT-even) form divides it by `count`, one
sample short of a full period, so the taper is continuous under the periodic extension the DFT
assumes.

```typescript
useHannWindow(1, 4);                                   // 0.75  symmetric
useHannPeriodicWindow(1, 4);                           // 0.5   periodic
coherentGain(useHannPeriodicWindow, 16);               // 0.5
equivalentNoiseBandwidth(useHannPeriodicWindow, 16);   // 1.5
```

| Shape | Symmetric | Periodic | Notes |
| :--- | :--- | :--- | :--- |
| Rectangular | `useRectangularWindow` | — | no taper; no periodic distinction |
| Hann | `useHannWindow` | `useHannPeriodicWindow` | the short-time default |
| Hamming | `useHammingWindow` | `useHammingPeriodicWindow` | — |
| Blackman | `useBlackmanWindow` | `useBlackmanPeriodicWindow` | — |
| Nuttall | `useNuttallWindow` | `useNuttallPeriodicWindow` | four-term Blackman–Harris |
| Flat-top | `useFlatTopWindow` | `useFlatTopPeriodicWindow` | amplitude accuracy over resolution |
| Kaiser | `useKaiserWindow(beta)` | `useKaiserPeriodicWindow(beta)` | `beta` sets the main-lobe width |

Use the periodic form for analysis and overlap-add: at a half-frame hop the periodic Hann window
sums to `1.000000` at every length, while the symmetric form ripples by `0.841 dB` at `N = 16` and
still by `0.013 dB` at `N = 1024`. Keep the symmetric form for filter design, where the frame is not
one period of the taper.

The flat-top windows return **negative weights** near the ends of the frame, because that is what a
flat-top window is. They are returned unchanged rather than clamped, because clamping perturbs the
main lobe and destroys the low scalloping loss the window exists for:

```typescript
useFlatTopWindow(0, 1024);                             // -0.000421 — negative by definition
Array.from({ length: 1024 }, (_unused, index) => useFlatTopWindow(index, 1024))
  .filter(weight => weight < 0).length;                // 578
```

### 10.6 Levels, flatness and band energy

`decibel` is gone as a single function, because an amplitude and a power do not share a factor.
`amplitudeDecibel` applies `20·log10` to a voltage-like ratio; `powerDecibel` applies `10·log10` to a
power, an energy, a mean square or a power spectral density:

```typescript
amplitudeDecibel(0.25);                                // -12.0412
powerDecibel(0.25);                                    //  -6.0206
```

`Bin.decibel` and `Spectrum.decibelOf` are amplitude levels; `Spectrum.powerDecibelOf` is the
matching power level. Feeding a power to the amplitude form reports `20·log10(power)` and doubles
the level in decibels.

Two spectrum measurements changed reading:

```typescript
const twoBins = new Spectrum(new Sample(2, 1), [new Complex(2, 0), new Complex(1, 0)]);
twoBins.flatness();                                    // 0.8 — geometric over arithmetic mean of power

const shape = new Spectrum(new Sample(4, 1), [
  new Complex(1, 0), new Complex(2, 0), new Complex(0, 0), new Complex(0, 0),
]);
shape.bandEnergy(new Frequency(0), new Frequency(2));                // 9
shape.bandEnergy(new Frequency(0), new Frequency(2), "two-sided");   // 5
```

`flatness()` compares the geometric and arithmetic means of `power()` over the one-sided half of the
spectrum, not of magnitude over both halves, and the display-only amplitude doubling of
`oneSided()` is deliberately not applied. `bandEnergy()` defaults to the one-sided reading, folding
the conjugate half so that DC and Nyquist count once and every interior bin counts twice; a band
that covers the whole axis then satisfies Parseval, `Σ|X|² = N·Σx²`. Pass `"two-sided"` for a
complex spectrum, whose bins are already independent.

### 10.7 Short-time analysis

`Sampler.shortTimeFourierTransform` and `Sampler.spectrogram` follow the SciPy `stft` conventions:
the periodic Hann window, a zero-filled boundary at both ends and a zero-filled tail.

```typescript
const sampler = new Sampler(new Sample(64, 1));
const spectrogram = sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8);

spectrogram.size();                     // 9 frames
spectrogram.getBoundary();              // "zeros"
spectrogram.getTime(6);                 // 0.75 — frame centres, not frame starts
sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8, useHannWindow,
  { boundary: "none", padded: false }).size();                       // 7 — complete frames only
```

The extension centres the first frame on the first sample, and the tail padding keeps the last
samples reachable: 64 samples at frame 16 and hop 8 produce 9 frames instead of 7, and 1000 samples
at frame 256 and hop 128 produce 9 instead of 6. Frame times are centres — `(k·hop + (frameSize mod
2)/2)/rate` for an extended view, `(k·hop + frameSize/2)/rate` for an unextended one — and
`toFrame()` trims the extension before inverting.

---

<a id="11-utility-helpers"></a>
## 11. Utility Helpers

### 11.1 The error hierarchy

`structure/error.ts` exports a fifteen-class hierarchy for the errors raised *around* a pipeline — by
your own code, a custom collector or an adapter:

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

Each class fixes `name`, forwards the native `cause`, carries an optional `context` bag and
serialises through `toJSON()`; each has a brand guard named after it.

```typescript
const error = new CapacityError("LRU capacity exhausted", { context: { capacity: 0 } });

error.name;                 // "CapacityError"
isCapacityError(error);     // true
isValidationError(error);   // false — a capacity failure is not a validation failure
isSemanticError(error);     // true
error.toJSON();             // { name: "CapacityError", message: "…", context: { capacity: 0 } }
```

`SemanticRangeError` is the same class as the exported `RangeError`, so `instanceof` holds across
both names; importing `RangeError` shadows the global constructor for the whole module, which is why
the alias exists. Neither class is thrown by the library's own argument checks, which keep raising
native `TypeError` and `RangeError` — the hierarchy is the vocabulary for the layer above.

### 11.2 Utility table

| Helper | Purpose |
| :--- | :--- |
| `useCompare(a, b)` | Total ordering across mixed primitives |
| `useToNumber` / `useToBigInt` | Lossless, range-checked numeric conversion |
| `useRandom` | Seeded or unseeded random helpers |
| `useTraverse` | Structural walk of nested objects and arrays |
| `useStringify` | Circular-safe JSON serialisation |
| `useHash` / `maskOf` / `register` / `unregister` | Structural hashing and the hash strategy registry |
| `invalidate` / `validate` | Guard clauses that raise a consistent error shape |
| `Optional<T>` | The library's `null` replacement: `Optional.of(x)` / `Optional.empty()` |

### 11.3 `useTraverse`

`useTraverse(target, callback)` flattens any object into its **non-null leaves**. It descends nested
objects, walks iterable values by position, skips `null` and `undefined`, and never re-enters an
object it has already visited — so an object graph with a cycle terminates instead of overflowing
the stack.

```typescript
const source = { id: 7, tags: ["a", "b"], owner: { name: "Ada", note: null } };
const leaves: string[] = [];

useTraverse(source, (key, value, path) => {
  leaves.push(`${path.join(".")} = ${String(value)}`);
  return true;
});

leaves;   // ["id = 7", "tags.0 = a", "tags.1 = b", "owner.name = Ada"]
```

The callback runs once per leaf and receives the leaf's own key (its index when the leaf came from
an iterable), the value, and the path that reached it. Returning `false` abandons the **whole**
traversal, not just the current branch:

```typescript
let visited = 0;
useTraverse({ a: 1, b: 2, c: 3 }, () => {
  visited += 1;
  return false;
});
visited;   // 1 — the first leaf already stops the walk
```

A cycle is safe for the same reason:

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

**Each callback receives its own path snapshot.** The walk keeps a single working array internally and, at the moment a leaf is handed over, copies it into a fresh array frozen with `Object.freeze`. The snapshot never changes afterwards, so it can be stored as it is, two callbacks never share one, and re-running the traversal does not disturb snapshots already handed out. Its type is `ReadonlyArray`, so writing to it is a compile error, and the frozen array also throws a `TypeError` at runtime. The safety costs one `O(depth)` allocation per reported leaf, and a branch that reports nothing allocates nothing extra.

```typescript
const paths: Array<ReadonlyArray<PropertyKey>> = [];
useTraverse({ a: { b: 1 }, c: 2 }, (_key, _value, path) => {
  paths.push(path);                      // safe to keep as-is
  return true;
});
paths[0] === paths[1];                   // false — one array per call
paths.map(path => path.join("."));       // ["a.b", "c"]
```

`useAttribute` is this walk turned into a factory: it reports the same leaves as `{ key, value }`
pairs, so the rules — and the cost — are identical.

```typescript
useAttribute({ a: 1, b: { c: 2 } }).toUnordered().toArray();
// [{ key: "a", value: 1 }, { key: "c", value: 2 }]
```

---

<a id="12-performance-and-pitfalls"></a>
## 12. Performance and Pitfalls

**Laziness has a price per stage.** Each operator adds a generator hop. For tight numeric loops over
in-memory arrays, a plain `for` loop will beat any pipeline; the pipeline wins when the source is
lazy, infinite, or the pipeline is long enough for the index discipline to pay off.

**`toOrdered()` sorts; `toUnordered()` does not.** If a reversal seems to have "not worked", the
collector was unordered — index rewriting only becomes an order when indices are normalised.

**`useGenerate` without an `interrupt` never ends.** Always supply a stopping predicate or a
downstream `limit` / `takeWhile`.

**`Ring` is an insertion-ordered set.** Elements are unique and keep the order in which they were
first added. A duplicate `add` returns `false`, and a `set` that would introduce one throws. This is
what lets a phase be a function of the *element* rather than of whichever position it happens to
occupy.

**`Spectrum` assumes a real signal in its one-sided helpers.** `oneSided()`, `getNyquist()` and
`centroid()` assume conjugate symmetry. The spatial spectrum of a phase ring is complex and in
general not symmetric — a ring that traverses the circle backwards puts all of its energy in bin
`n − 1`, beyond Nyquist. Read the bins directly.

**Structure collectors are terminals, not views.** Each one drains the pipeline and then builds a
full structure, so it costs O(n) time and O(n) space and cannot run on an infinite source. Reach for
one at the end of a pipeline, never inside a loop over one.

**`variance()` and friends return an `Optional`.** `variance().get()` on a sample that is too small
throws; use `.orElse(0)` or check `.isPresent()` when the sample size is not under your control.
The same applies to `standardDeviation`, `quantile`, `interquartileRange`, `skewness` and
`kurtosis`.

**The periodic windows are the analysis windows.** `useHannWindow` and the other symmetric forms are
for filter design; a short-time transform wants `useHannPeriodicWindow` and its siblings, or the
overlap-add sum will ripple wherever the frames meet.

---

<a id="13-phase-rings"></a>
## 13. Phase Rings: An Exact Cycle of Positions

Chapter 10 introduced the ring as the library's model of a cycle and used it to measure a data
set against every phase. This chapter is the complete surface: how a position becomes an angle,
what the ambient frequency does and does not change, and the instruments that read the ring
against time, against data and against another ring.

A `SynchronousRing` is a positional list backed by a circular doubly linked ring whose head and
tail are joined. It is also an insertion-ordered *set*: no element appears twice, and a rejected
write leaves both the links and the samples untouched. What makes it a ring rather than a list is
that the phase of a position is a pure function of its residue modulo the current length, so the
ring is periodic to the bit and its balance cannot drift.

### 13.1 A ring is one integer, computed exactly

A ring carries `n` elements, and the element count, the positional period and the number of
distinct phases are the same integer. Position `i` carries

`phase + span · 2π · (((i mod n) + n) mod n) / n`

with the residue reduced in `bigint` before it ever becomes a `number`. That is the whole reason
`phaseAt(i)` and `phaseAt(i + n)` are *identical* rather than merely close: the second call
reduces to the same integer, evaluates the same product and produces the same double. An index
far beyond the exact integer range of `number` still lands on the right position, and a negative
index walks the ring backwards.

| Call | Returns | Meaning |
| :--- | :--- | :--- |
| `new SynchronousRing(source, options?)` | ring | `source` is any iterable, duplicates dropped |
| `getPhase()` / `getFrequency()` / `getSpan()` | `Angle`, `Frequency`, `number` | the three construction parameters |
| `size()` | `bigint` | the `n` that is also the period |
| `phaseAt(index)` | `Optional<Angle>` | intrinsic phase only; ignores time, rate and frequency |
| `elementAt(index)` | `Optional<RingElement>` | element, intrinsic phase, ambient frequency, phasor |
| `frequencyAt(index)` | `Optional<Frequency>` | the ambient rate, empty for an empty ring |
| `toComplex()` / `toComplex(index)` | `Complex[]` / `Optional<Complex>` | intrinsic phasors |

`RingOptions` adds two per-element functions: `magnitude(element, index)` gives the phasor length
and defaults to one, and `rate(element, index)` gives the element its own intrinsic frequency and
defaults to zero, a fixed marker.

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

`phaseAt(-1n)` is `300` on a six-element ring, and `10n ** 20n` reduces to `4` modulo six, so it
reads `240`. Neither case accumulates a floating-point product, which is what keeps the identity
exact under a change of index representation.

### 13.2 The ambient frequency and the state at an instant

`frequency` is the **ambient rotation rate** of the environment the ring is embedded in, not a
phase step between positions. The environment advances the phase of every element by the same
angle, so it cannot change the intrinsic pattern, cannot break the balance and cannot change any
`phaseAt` result. It defaults to `0 Hz`.

`relativeAt(index, time)` subtracts that common angle, leaving the coordinate a `PhaseField` is
scored against. `viewAt` and `viewsAt` return the full state at an instant, including the
element's own `rate`, and the differential accessors expose the drift:

| Call | Formula | Reads |
| :--- | :--- | :--- |
| `relativeAt(index, time)` | `intrinsic + ownRate · t − ambient · t` | the phase the environment sees |
| `viewAt(index, time)` / `viewsAt(time)` | the same, plus element, index, time, rate, phasor | the full state |
| `jetAt(index, time)` | phase at `t`, own rate, `slip = ownRate − ambient` | the differential state |
| `windingAt(index, time)` | `trunc(slip · t)` | whole turns slipped, truncated toward zero |
| `errorIntegralAt(index, time, origin?)` | `∫ relative phase dt`, in turns · seconds | how long an element has been ahead |
| `resultant(time?)` | `abs(Σ w · e^{iθ}) / Σ w` | phase concentration, unaffected by ambient rotation |
| `analyse(data, time?)` | counts and means per reference | data measured against every element |
| `scoreAt(index, time, field)` / `scoresAt(time, field)` | the field sampled at the relative phase | a bounded score per position |

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

At `1 Hz` the environment advances a quarter turn in `0.25 s`, so the relative phase of position
one is `60 − 90 = 330` degrees while its intrinsic phase stays `60`. The jet reports `slip` of
`-1` hertz because the element itself does not move, and `purity()` is still `1`: rotating every
phasor by the same angle is not a deformation.

### 13.3 Purity and balance

`purity()` is the share of the ring's energy carried by the fundamental mode:

`max(abs(c₁)², abs(c_{n−1})²) / (n · Σ abs(z)²)`

Both fundamental bins are tested because a ring may traverse the circle in either direction. A
ring built with `span: 5` over six elements steps by `300` degrees, which is `−60` degrees: it
runs backwards, puts all of its energy in `c₅`, and would be reported as impure by a formula that
only looked at `c₁`. The cost stays `O(n)` because only those two bins and the total energy are
needed.

The edge cases are part of the contract. A ring of fewer than two elements has no fundamental
mode and reports `purity() === 0` and `isBalanced() === false`, whatever its content. A ring whose
phasors all have zero length has no energy and also reports zero. `isBalanced(epsilon?)` is
`1 − purity() <= epsilon`, with `1E-9` as the default tolerance.

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

### 13.4 Resultant and the symmetric components

`resultant(time?)` is the mean resultant length: the magnitude of the phasor sum divided by the
sum of the magnitudes. Unlike `purity`, which asks whether the ring is still the `n`-th roots of
unity, `resultant` asks how concentrated the phasors are right now. A balanced ring reports `0`;
a ring whose elements all share one angle would report `1`, but the set semantics forbid duplicate
elements, so in practice `1` appears when `magnitude` zeroes all but one element.

`zeroSequence()` is the mean phasor, that is `c₀ / n`. `sequences()` returns all `n` symmetric
components, lowest order first, by a direct transform. `toSpectrum()` wraps them in a `Spectrum`
whose bin `j` reports `j` cycles per ring revolution, so the frequency axis is the wavenumber
axis.

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

The components are complex and in general **not conjugate-symmetric**: a balanced ring puts all
of its energy in bin one, and a backwards ring puts it in bin `n − 1`. The one-sided helpers of
`Spectrum` assume a real signal, so read the bins directly instead of folding them.

### 13.5 Analysing data against every element

`analyse(data, time?)` matches every observation back to the ring by identity and measures it
against each element as a reference phase. Observations the ring does not hold are counted as
`missed` rather than guessed at, because the ring is the only source of phases. Each reference
row reports `count`, the mean relative phase `mean`, and the mean resultant length `resultant`.

One identity is worth remembering: **`resultant` is the same for every reference**. Changing the
baseline rotates all relative phases by a constant, and a rotation cannot change a resultant
length. What differs per reference is the count and the mean.

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

Scoring is the other side of the same coin. A `PhaseField` is a bounded cosine series (chapter
10.2), and `scoreAt`/`scoresAt` sample it at the relative phase, so the same ring can be scored
against alignment, against a harmonic pattern, or against any other field without changing the
ring.

```typescript
import { SynchronousRing, useField } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const ring = new SynchronousRing(["a", "b", "c", "d", "e", "f"]);
const cosine = useField([1]);

round(ring.scoreAt(0n, 0, cosine).get());                                  // 1
round(ring.scoreAt(1n, 0, cosine).get());                                  // 0.5
ring.scoresAt(0, cosine).map(score => round(score));                       // [1, 0.5, -0.5, -1, -0.5, 0.5]
```

### 13.6 Combining rings and the angular spectrum

`combineRings(left, right)` joins two rings on their least common multiple, not their product.
Instant `i` of the joint ring reads `i mod m` of the left ring and `i mod n` of the right ring,
so the joint ring closes after `lcm(m, n)` instants. The pairs that can never co-occur — those
whose positions disagree modulo `gcd(m, n)` — are simply absent, which is why the result is a
pullback rather than a product; `aligns(left, right)` reports whether a given pair is
representable.

`useAngularSpectrum(ring, instants, plan)` builds the `(ω, n)` plane: each instant contributes a
frame of phasors, frame `k` of mode `j` is the `j`-th symmetric component of that frame, and
`cells[frame][order]` is the coefficient. Taking one column gives the time series of a single
spatial mode, and `spectrum(order)` is its temporal spectrum.

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

### 13.7 Pitfalls

**Exactness is exact.** `phaseAt(i)` and `phaseAt(i + n)` are the same double, not two values
within a tolerance. A ring built by accumulating `2π / n` per element would fail this; this one
reduces the index in `bigint` first.

**`frequency` is not a phase step.** It is the ambient rotation rate, it defaults to zero, and
rotating every phasor by the same angle cannot break the intrinsic pattern. If you want positions
to advance relative to each other, use `rate`, not `frequency`.

**`purity()` must look at both fundamental bins.** A backwards ring is still the `n`-th roots of
unity; only `c₁` would call it impure.

**`n < 2` is a defined edge case.** `purity()` returns `0` and `isBalanced()` returns `false`; an
empty ring returns empty optionals from the sampling methods.

**A span that shares a factor with `n` collapses the orbit.** Six elements with `span: 2` visit
only three distinct phases, and the ring is no longer balanced.

**`resultant` is rotation-invariant, not time-invariant.** Ambient rotation leaves it unchanged;
per-element `rate`s change it as the ring de-phases.

**The ring is a set, and `analyse` matches by identity.** Duplicate elements are dropped at
construction, and an object that is structurally equal to a ring element but not the same
reference is counted as missed.

**`toSpectrum()` is complex.** Its bins are not conjugate-symmetric, so the one-sided helpers of
`Spectrum` do not apply. Read the bins.

**`windingAt` truncates toward zero, and `errorIntegralAt` integrates phase.** Half a turn of slip
reports `0n`; the error integral is in turns · seconds, not a rate.

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
## 14. Signal Analysis: Windows, Spectra and Time

Chapter 10 treated a ring as a cycle of phases. This chapter is the temporal counterpart: a
real-valued record that carries, besides its samples, the two pieces of context every spectral
formula needs — the sampling plan that turns a bin index into hertz, and the taper that fixes both
the coherent gain and the noise bandwidth.

The value object is `SynchronousSignalCollectable`, with `AsynchronousSignalCollectable` as its
queued twin. Both expose the same `SignalCollectable` surface: twenty-three methods, each delegating
to exactly one `useSynchronous<Method>` factory in `synchronous/collectors`. The split is
deliberate. The class is a documented facade, the factory owns the accumulation, and the constructor
caches `sum(w) / count` and `count * sum(w^2) / sum(w)^2` once, at this length. A caller who has to
remember "divide by the coherent gain" will eventually forget, and the resulting 6.02 decibels look
like a plausible measurement.

### 14.1 A signal carries its own calibration

A signal is built from an iterable and a rate, from an existing `Frame`, or from the constructor
with an explicit `Sample`. The default taper is the periodic Hann window; every analysis that does
not name a window uses it, and every analysis accepts an override. The metadata accessors are
constant-time reads of state fixed at construction, so a signal can be handed around without the
context drifting.

| Call | Returns | Meaning |
| :--- | :--- | :--- |
| `SynchronousSignalCollectable.useRate(values, rate, window?)` | signal | duration `count / rate` |
| `SynchronousSignalCollectable.useFrame(frame, window?)` | signal | keeps the frame's plan |
| `new SynchronousSignalCollectable(plan, values, window?)` | signal | plan count must equal the sample count |
| `getSample()` / `getValues()` / `getWindow()` | plan, samples, taper | the frozen context |
| `getRate()` | `number` | samples per second |
| `getNyquist()` / `getResolution()` | `Frequency` | `rate / 2` and `rate / count` |
| `getCoherentGain()` / `getNoiseBandwidth()` | `number` | recomputed at this exact length |
| `size()` / `at(index)` / `toFrame()` / `equals(other)` / `toString()` | — | value semantics |

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

`getResolution()` is the bin spacing, not the resolving power: it is `rate / count` because the
transform has `count` bins, and padding the transform changes the spacing without changing what the
window can separate (section 14.8).

### 14.2 The twenty-three methods

The methods fall into six families. Seven are spectral readings, two are time–frequency transforms,
four are analytic quantities, three are sequence statistics, five are shape descriptors, and two
return another signal.

| Method | Returns | Convention |
| :--- | :--- | :--- |
| `spectrum(size?, window?)` | `Spectrum` | raw and unnormalised, full complex grid |
| `oneSided(size?, window?)` | `Bin[]` | conjugate half folded, DC and Nyquist not doubled |
| `amplitude(window?)` | `number[]` | `2·abs(X) / (count · CG)`, once at DC and Nyquist |
| `power(window?)` | `number[]` | `A² / 2` per interior bin, `A²` at DC and Nyquist |
| `decibel(window?)` | `number[]` | `20·log10(amplitude)` |
| `powerDecibel(window?)` | `number[]` | `10·log10(power)` |
| `powerSpectralDensity(frameSize?, hopSize?, window?)` | `SpectralDensity` | Welch average, `abs(X)² / (rate · Σw²)` |
| `shortTimeFourierTransform(frameSize, hopSize, window?)` | `Spectrum[]` | extended boundaries, centre times |
| `spectrogram(frameSize, hopSize, window?)` | `Spectrogram` | the same columns with a time axis |
| `analyticSignal()` | `Complex[]` | the Hilbert pair `x + i·H(x)` |
| `instantaneousPhase()` | `Angle[]` | folded into `[0, 2π)` |
| `instantaneousFrequency(rate?, gate?)` | `number[]` | unwrapped phase difference, gated on the envelope |
| `envelope()` | `number[]` | `abs(z[n])`, circular at the edges |
| `zeroCrossingRate(perSecond?)` | `number` | crossings per adjacent sample pair |
| `spectralFlux(frameSize?, hopSize?, window?)` | `number[]` | unit-norm magnitude distance between frames |
| `autocorrelation(maximumLag?, normalization?)` | `number[]` | coefficient by default, `ρ[0] = 1` |
| `spectralCentroid(window?)` | `Optional<Frequency>` | power-weighted mean frequency |
| `spectralBandwidth(window?)` | `Optional<Frequency>` | power-weighted standard deviation |
| `spectralRolloff(ratio?, window?)` | `Optional<Frequency>` | first bin reaching `ratio` of the power |
| `spectralFlatness(window?)` | `number` | geometric over arithmetic mean of power |
| `signalToNoiseRatio(frameSize?, hopSize?, window?, floorQuantile?)` | `Optional<number>` | median noise floor, `10·log10` |
| `detrended(mode?)` | signal | `"none"`, `"constant"` (default), `"linear"` |
| `windowed(window?)` | signal | applies a taper and adopts it |

The optional arguments are not decoration. `frameSize` defaults to `min(256, size)`, the hop to
half a frame rounded down, `instantaneousFrequency` gates at `1E-3` of the peak envelope, and
`spectralRolloff` uses `0.85`. Each default is the value a reference implementation picks when the
parameter is named rather than supplied.

### 14.3 Amplitude, power and density

Three normalisations are needed because three different questions are being asked.

`amplitude()` answers "how large is the sinusoid on this bin": `2·abs(X[k]) / (count · CG)` for an
interior bin and `abs(X[k]) / (count · CG)` at DC and Nyquist. The factor of two folds the
conjugate half; the coherent gain removes the taper. Omit either and a unit tone reads `0.5`,
which is minus 6.02 decibels.

`power()` answers "what mean square would a sinusoid on this bin have": `A² / 2` for an interior
bin and `A²` at DC and Nyquist, because those two do not oscillate. This is the peak convention,
and it deliberately does not satisfy Parseval: a window spreads each line over its main lobe, so
the sum of every bin exceeds the mean square by the equivalent noise bandwidth — `1.5` for Hann.

`powerSpectralDensity()` answers "how much power per hertz": `abs(X)² / (rate · Σw²)`, averaged
over overlapping segments. Only the sum of the squared weights keeps a white-noise floor unbiased;
dividing by `count` reads `0.375` for unit noise and dividing by `count · CG²` reads `1.5`.

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

The pair of totals is the check worth remembering: the peak-convention sum is `0.75` while the
density integrates to `0.5`, and the ratio is exactly the noise bandwidth. The density is also the
only one of the three that survives a change of frame length.

### 14.4 Levels: the two decibel conventions

An amplitude and a power do not share a factor, so they do not share a logarithm. `amplitudeDecibel`
applies `20·log10` and is correct for a voltage, a displacement or a sound pressure; `powerDecibel`
applies `10·log10` and is correct for a power, an energy, a mean square or a density. The method
names on the signal follow the same split.

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

Both readings of the same tone are correct: its amplitude is one (zero decibels), and its mean
square is one half (minus 3.01 decibels). Feeding a power to the amplitude convention would double
the level in decibels, turning the correct minus 6.02 into minus 12.04.

### 14.5 The one-sided fold

A real signal satisfies `X[count − k] = conj(X[k])`, so the negative-frequency half carries no
independent information. The fold doubles every interior bin and keeps the two self-conjugate bins
— DC and, for an even length, Nyquist — exactly as the transform produced them. Those two are their
own mirror image; doubling them invents energy and reports exactly 6.02 decibels too high.

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

The raw magnitudes are `16` and `8` because the taper's weights sum to eight; dividing by
`count · CG = 8` turns them into the calibrated amplitudes `2` and `1`. Doubling the edge bins
would read `4` and `2`, and the error would never raise an exception.

### 14.6 Time–frequency views

`shortTimeFourierTransform` and `spectrogram` frame the record the way the reference short-time
transform does: half a frame of zeros at each end, then a zero-padded tail so that a whole number
of hops remains. The first frame is centred on the first sample, the last frame reaches the last
sample, and frame `m` is centred at `m · hop / rate` seconds. Retaining only complete frames would
discard up to `frameSize − 1` samples — for 1000 samples at frame 256 and hop 128, that is 104
samples, about a tenth of the record.

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

Every column is a `Spectrum` over `frameSize` bins, exactly as `spectrum()` would produce for the
same frame, and `getTime()` reports frame centres rather than frame starts.

### 14.7 Windows, coherent gain and COLA

Every shape has two forms. The symmetric form divides the frame by `count − 1`; the periodic
(DFT-even) form divides it by `count`, one sample short of a full period, so the taper is continuous
under the periodic extension the DFT assumes. Analysis and overlap-add need the periodic form;
filter design keeps the symmetric one.

The difference is measurable and never raises an error. At fifty per cent overlap the periodic Hann
window sums to one at every position; the symmetric form ripples, by `0.84` decibels at sixteen
samples, `0.21` at sixty-four and still `0.013` at one thousand and twenty-four. The class exposes
the coherent gain and the equivalent noise bandwidth of whichever taper it holds, so the correction
is never hard-coded: a symmetric Hann reads `0.4375` at eight samples, not `0.5`.

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

The flat-top row is not a mistake in the table. A flat-top window is partially negative by
definition — 578 of 1024 weights here — and clamping those weights to zero would perturb the main
lobe and destroy the low scalloping loss the window exists for. The library returns the series
unchanged.

### 14.8 Pitfalls

**Zero padding interpolates, it never resolves.** A transform length above the sample count samples
the same underlying DTFT more densely: the peak *location* becomes finer and the bin spacing
becomes `rate / size`, but the ability to separate two components is still governed by the window
length and shape. A tone exactly between two bins reads `82.1093` and `80.8598` on the unpadded
grid, and `128` at its own frequency on the padded grid.

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

Two equal tones `0.4` bins apart stay merged at any padding: with a 256-point record and a Hann
window, padding to 8192 produces a single local maximum, not two.

**The Hilbert transform is circular.** `analyticSignal`, `envelope` and `instantaneousPhase` treat
the first and last samples as neighbours, so a record whose period does not divide its length is
contaminated at both ends. The middle of the record is trustworthy; the ends are not.

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

**A vanishing envelope does not define a phase.** Where the envelope collapses, the difference of
two rounding-noise angles can be half a turn, which reads as half the sampling rate. The gate is
what keeps the number meaningful, and the default is `1E-3` of the peak envelope.

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

**An unnormalised correlation is not a similarity.** The raw sum `r[k]` grows with the record
length, so two lengths cannot be compared. The default `"coefficient"` rule divides by `r[0]` and
keeps every value in `[-1, 1]`; `"unbiased"` divides by `count − k` and pays with a variance that
grows with the lag.

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

One more reading deserves a warning: `spectralFlux` normalises each frame before comparing, so a
level change alone produces zero flux. Its first and last values are edge artefacts of the zero
boundary, not onsets.

---

<a id="15-license"></a>
## 15. License

MIT © Eloy Kim
