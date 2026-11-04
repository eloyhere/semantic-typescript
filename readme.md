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
- 496 regression tests: `npm test`.
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
13. [License](#13-license)

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
| Mathematics | `mathematics/*` | Angles, complexes, frequencies, spectra, windows, epicycles, phase rings |
| Structures | `structure/*` | Lists, sets, maps, trees, rings, fields |

Synchronous and asynchronous families share one vocabulary: the same operator names, the same index
semantics, the same collectables. The asynchronous variants simply return promises, and they queue
writes so that a read issued after a write always observes it.

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

| Collectable | Structure | Time | Order | Use when |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | `Map<bigint, E>` keyed by index | O(n) | insertion | maximum throughput; raw indices preserved untouched |
| `toOrdered()` | array sorted by element index | O(n log n) | by normalised index | reversal/rotation must take effect |
| `toOrdered(comparator)` | sorted by your comparator | O(n log n) | by your comparator | sorted views |
| `toNumericStatistics()` | value-sorted buffer | O(n log n) | by value | statistics over `number` |
| `toBigintStatistics()` | value-sorted buffer | O(n log n) | by value | statistics over `bigint` |
| `toWindow()` | value-sorted buffer | O(n log n) | by value | `slide` / `tumble` |
| `toCollectable(mapper)` | whatever the mapper returns | — | — | custom collectables |

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

---

<a id="7-statistics-and-windows"></a>
## 7. Statistics and Windows

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();              // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();              // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();               // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                 // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance();             // 2.56
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation();    // 1.6
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n);                    // [[1,2],[2,3],[3,4]]
```

Both statistics families expose the same surface — `summate`, `average`, `median`, `mode`,
`variance`, `standardDeviation`, `frequency`, `findMaximum`, `findMinimum` — with `bigint` arithmetic
for `toBigintStatistics()`. Windows support `slide(size, hop)` and `tumble(size)`.

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
const cycle = new AsynchronousCycle([1, 2]);
const added   = cycle.add(3);          // queued
const sampled = cycle.elementAt(2n);   // observes the write above
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

A `Cycle` is an **n-fold ring**: the element count, the positional period and the number of distinct
phases are the same integer `n`. The phase of a position is computed from its exact residue, so the
ring is periodic to the bit:

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
import { useField } from "semantic-typescript";

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
const ring = new SynchronousCycle(["a", "b", "c", "d", "e"]);
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
const cycle = new SynchronousCycle(["a", "b", "c"]);
cycle.scoresAt(0, cosine);                   // one score per position, in [-1, 1]
```

### 10.4 Related instruments

| Call | Answers | Cost |
| :--- | :--- | :--- |
| `purity()` | is the ring still the `n`-th roots of unity? | O(n) |
| `resultant(t?)` | how concentrated are the phasors right now? | O(n) |
| `analyse(data)` | how does this data sit against every element? | O(n · m) |
| `toSpectrum()` | the ring as a spectrum, wavenumber on the frequency axis | O(n²) |
| `useAngularSpectrum(cycle, instants, plan)` | the `(ω, n)` plane over time | O(n² · frames) |

Two more primitives round out the model: `combineCycles(a, b)` joins two rings on their least common
multiple (a pullback, not a product — the pairs that cannot share an instant are simply absent), and
`rate()` gives each element its own intrinsic frequency so that a ring can drift against the
environment. `jetAt`, `windingAt` and `errorIntegralAt` expose the differential state of that drift.

---

<a id="11-utility-helpers"></a>
## 11. Utility Helpers

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

**`Cycle` is an insertion-ordered set.** Elements are unique and keep the order in which they were
first added. A duplicate `add` returns `false`, and a `set` that would introduce one throws. This is
what lets a phase be a function of the *element* rather than of whichever position it happens to
occupy.

**`Spectrum` assumes a real signal in its one-sided helpers.** `oneSided()`, `getNyquist()` and
`centroid()` assume conjugate symmetry. The spatial spectrum of a phase ring is complex and in
general not symmetric — a ring that traverses the circle backwards puts all of its energy in bin
`n − 1`, beyond Nyquist. Read the bins directly.

---

<a id="13-license"></a>
## 13. License

MIT © Eloy Kim
