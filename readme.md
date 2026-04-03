# **Semantic‑TypeScript**
**Flow, Indexed.** Your data, under precise control.

---

### Overview

Semantic‑TypeScript represents a significant evolution in stream processing, elegantly **synthesising** the most effective paradigms from JavaScript generators, Java Streams, and MySQL-style indexing. Its foundational premise is both powerful and deliberate: to construct exceptionally efficient data‑processing pipelines through intelligent indexing, rather than through conventional brute‑force iteration.

Where typical libraries enforce synchronous loops or unwieldy promise chains, Semantic‑TypeScript provides a **fully asynchronous**, functionally pure, and rigorously type‑safe experience, designed expressly for the demands of modern application development.

This model embodies a refined form of control flow: data only proceeds to the consumer when the upstream pipeline explicitly invokes the `accept` callback. You retain complete, granular command over timing—processing occurs precisely when, and only when, it is required.

---

### Why Developers Choose Semantic‑TypeScript

- **Zero‑Boilerplate Indexing** – Every element inherently possesses its natural or bespoke index, eliminating manual tracking.
- **Purely Functional & Type‑Safe** – Enjoy full, idiomatic TypeScript inference alongside immutable operations.
- **Leak‑Proof Event Streams** – The `useSubscription` pattern is designed with resource safety as a first principle. You define the logical boundary—using `limit(n)`, `sub(start, end)`, or `takeWhile(predicate)`—and the library manages the complete subscription lifecycle. This ensures no lingering listeners and no memory leaks.
- **Built‑in Statistical Suite** – Access comprehensive analytics for both `number` and `bigint` streams, including averages, medians, modes, variance, skewness, and kurtosis without external dependencies.
- **Predictable, Tunable Performance** – Select between ordered or unordered collectors to match your exact performance and ordering requirements.
- **Inherently Memory‑Efficient** – Streams are evaluated lazily, processing elements on‑demand to alleviate memory pressure.
- **No Undefined Behaviour** – TypeScript guarantees complete type safety and nullability. Your source data remains immutable unless explicitly altered within your callback functions.

---

### Installation

Integrate Semantic‑TypeScript into your project using your preferred package manager:

```bash
npm install semantic-typescript
```
or
```bash
yarn add semantic-typescript
```

---

### A Practical Introduction

The following examples demonstrate core concepts, from foundational transformations to real‑world event handling.

```typescript
import { useOf, useFrom, useRange, useSubscription, useText, useStringify } from "semantic-typescript";

// ====================================================================
// EXAMPLE 1: Foundational Operations & Numeric Statistics
// ====================================================================
// Demonstrates mapping and terminal statistical operations. After transformation,
// the pipeline must be converted to a statistics collector before calling
// terminal methods like `.summate()`.

const numericSum: number = useOf(10, 20, 30, 40)
  .map((n: number): number => n * 2)        // Double each element: [20, 40, 60, 80]
  .toNumericStatistics()                     // Convert to a statistics collector
  .summate();                               // Terminal operation: 200

// Additional statistical methods (available after .toNumericStatistics()):
// .average(), .median(), .mode(), .variance(), .skewness(), .kurtosis()

// ====================================================================
// EXAMPLE 2: BigInt Statistics
// ====================================================================
// Operates identically to numeric statistics but is optimised for BigInt data.

const bigintSum: bigint = useOf(10n, 20n, 30n, 40n)
  .map((n: bigint): bigint => n * 2n)       // BigInt arithmetic
  .toBigIntStatistics()                      // Convert to BigInt statistics collector
  .summate();                                // Terminal operation: 200n

// ====================================================================
// EXAMPLE 3: Index Manipulation for Stream Reversal
// ====================================================================
// Illustrates reordering elements by strategically reassigning their indices
// using the `.redirect()` method, enabling custom patterns like reversal.

const reversedArray: number[] = useFrom([1, 2, 3, 4, 5])
  .redirect((_element: number, index: bigint): bigint => -index) // Map to negative indices
  .toOrdered()  // Essential: collects elements sorted by their new indices
  .toArray();   // Result: [5, 4, 3, 2, 1]

// For simple reversal, `.reverse()` is also available.

// ====================================================================
// EXAMPLE 4: Stream Shuffling
// ====================================================================
// Randomly permutes element indices using an in-place shuffle algorithm.

const shuffledArray: number[] = useFrom([1, 2, 3, 4, 5])
  .shuffle()      // Randomly reassigns indices
  .toOrdered()    // Orders by the new random indices
  .toArray();     // e.g., [2, 5, 1, 4, 3] (varies per execution)

// ====================================================================
// EXAMPLE 5: Circular Stream Rotation
// ====================================================================
// Shifts elements cyclically. Positive values rotate right; negative values rotate left.

// Right rotation by 2 positions
const rightRotated: number[] = useFrom([1, 2, 3, 4, 5])
  .translate(2)   // Shift indices right by 2
  .toOrdered()
  .toArray();     // Result: [4, 5, 1, 2, 3]

// ====================================================================
// EXAMPLE 6: Lazy Evaluation with Infinite Ranges
// ====================================================================
// Processes theoretically infinite streams lazily, computing elements only as needed.

const firstTenMultiples: bigint[] = useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)  // Keep multiples of 17
  .limit(10n)                   // Critical: stops after the 10th match
  .toUnordered()                // No sorting required
  .toArray();                   // Result: [0, 17, 34, 51, 68, 85, 102, 119, 136, 153]

// Without `.limit(10n)`, the pipeline would process all one million elements.

// ====================================================================
// EXAMPLE 7: Composing a Complex Pipeline
// ====================================================================
// Demonstrates sequential composition of multiple operations.

const complexResult: number[] = useRange(1n, 100n)
  .map(n => Number(n) * 2)
  .filter(n => n > 50)
  .shuffle()
  .limit(5n)
  .translate(2)
  .toOrdered()
  .toArray();

// ====================================================================
// EXAMPLE 8: Managed DOM Event Subscription
// ====================================================================
// Listens to browser events with automatic, leak-proof cleanup.
// The `.limit(n)` call defines the boundary for automatic listener removal.

// Define a subscriber for a Window target
const windowSubscriber = {
    mount: (target: Window): void => { /* Setup logic */ },
    subscribe: (target: Window, event: keyof WindowEventMap, handler: EventListener): void => {
        target.addEventListener(event, handler);
    },
    unsubscribe: (target: Window, event: keyof WindowEventMap, handler: EventListener): void => {
        target.removeEventListener(event, handler);
    },
    unmount: (): void => { /* Cleanup logic */ }
};

useSubscription(window, windowSubscriber, "resize")
  .limit(5n) // Automatically unsubscribes after 5 events
  .toUnordered()
  .forEach((ev: Event, idx) =>
    console.log(`Resize #${idx}: ${(ev.target as Window).innerWidth}x${(ev.target as Window).innerHeight}`)
  );

// ====================================================================
// EXAMPLE 9: String Processing by Unicode Code Points
// ====================================================================
// Iterates over a string correctly, handling multi-byte Unicode characters.

useText("My emotion now is: 😊, and semantic is 👍")
  .toUnordered()
  .log(); // Logs each character, including emoji, on a new line.

// ====================================================================
// EXAMPLE 10: Safe Circular Reference Stringification
// ====================================================================
// Safely serialises objects containing circular references.

const obj = {
  a: 1,
  b: "text"
};
(obj as any).c = [obj.a, obj.b, (obj as any).c]; // Introduce circularity

// const text: string = JSON.stringify(obj); // Throws an error
const text: string = useStringify(obj); // Safely yields `{a: 1, b: "text", c: []}`
```

---

### Core Concepts

| Concept | Purpose | Primary Use Case |
| :--- | :--- | :--- |
| `AsynchronousSemantic` | The core builder for asynchronous streams, events, and lazy, push‑based pipelines. | Real‑time events, WebSockets, DOM listeners, or any long‑running/infinite stream. |
| `SynchronousSemantic` | The builder for synchronous, in‑memory, or eager, pull‑based streams. | Static data, finite ranges, or immediate iteration tasks. |
| `toUnordered()` | The fastest terminal collector, using a Map for index storage. | Performance‑critical paths where stable order is not required (O(n) time & space). |
| `toOrdered()` | A sorted, index‑stable terminal collector. | When element order must be preserved or indexed access is needed. |
| `toNumericStatistics()` | A collector enabling rich statistical analysis on `number` streams. | Data analytics, metrics, and statistical computations. |
| `toBigIntStatistics()` | A collector enabling rich statistical analysis on `bigint` streams. | Analytics and statistics for large integer datasets. |
| `toWindow()` | Provides sliding and tumbling window operations over a stream. | Time‑series analysis, batch processing, and windowed aggregations. |

---

**Essential Usage Rules**

1.  **Event streams** (created via factories like `useSubscription`) return an `AsynchronousSemantic`.
    → You **must** call a boundary‑defining method like `.limit(n)`, `.sub(start, end)`, or `.takeWhile(predicate)` to terminate the listener. Failure to do so will leave the subscription active.

2.  **Terminal operations** (`.toArray()`, `.count()`, `.forEach()`, `.findFirst()`, etc.) are **only available after** converting the pipeline to a collector:
    ```typescript
    .toUnordered()   // For maximum speed, order not guaranteed.
    // or
    .toOrdered()     // For stable, sorted output.
    // or
    .toNumericStatistics() // For statistical methods.
    ```

---

### Performance Characteristics

| Collector | Time Complexity | Space Complexity | Order Guarantee? | Ideal Scenario |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | O(n) | O(n) | No | Raw throughput is key; final order is irrelevant. |
| `toOrdered()` | O(n log n) | O(n) | Yes (sorted) | Stable ordering, indexed access, or pre‑sorting for statistics. |
| `toNumericStatistics()` | O(n log n) | O(n) | Yes (internal sort) | Performing statistical operations which require sorted data. |
| `toBigIntStatistics()` | O(n log n) | O(n) | Yes (internal sort) | Statistical operations on BigInt data. |
| `toWindow()` | O(n log n) | O(n) | Yes (internal sort) | Windowing operations which benefit from sorted indices. |

Select `toUnordered()` when absolute speed is paramount. Opt for `toOrdered()` or a statistics collector only when your logic depends on element order.

---

**Comparative Analysis with Contemporary Stream Libraries**

| Feature | Semantic‑TypeScript | RxJS | Native Async Iterators / Generators | Most.js |
| :--- | :--- | :--- | :--- | :--- |
| **TypeScript Integration** | First‑class, deeply typed with inherent index awareness. | Excellent, though often involving complex generic chains. | Good, but requires manual type annotations. | Strong, with a functional‑first typing style. |
| **Built‑in Statistical Analysis** | Comprehensive native support for `number` and `bigint`. | Not available natively (requires custom operators or other libraries). | None. | None. |
| **Indexing & Position Awareness** | Native, powerful BigInt indexing on every element. | Requires custom operators (e.g., `scan`, `withLatestFrom`). | Manual counter management is necessary. | Basic, no built‑in index property. |
| **Event Stream Management** | Dedicated, type‑safe factories with explicit, declarative lifecycle control. | Powerful but requires careful manual subscription management to prevent leaks. | Manual event listener attachment and cancellation token management. | Good `fromEvent`, generally lightweight. |
| **Performance & Memory** | Exceptional – offers optimised `toUnordered()` and `toOrdered()` collectors. | Very good, though deep operator chains can introduce overhead. | Excellent (minimal native overhead). | Excellent. |
| **Bundle Size** | Very lightweight. | Substantial (even with tree‑shaking). | Zero (native language feature). | Small. |
| **API Design Philosophy** | Functional collector pattern with explicit indexing semantics. | Reactive Observable pattern. | Imperative Iterator / declarative Generator pattern. | Functional, point‑free composition. |
| **Flow Control** | Explicit (`interrupt`, `.limit()`, `.takeWhile()`, `.sub()`). | Good (`take`, `takeUntil`, `first`). | Manual (`break` in loops). | Good (`take`, `until`). |
| **Sync & Async Support** | Unified API – first‑class support for both paradigms. | Primarily asynchronous. | Both supported, but with manual bridging. | Primarily asynchronous. |
| **Learning Curve** | Gentle for developers familiar with functional and indexed collection pipelines. | Steeper (extensive operator lexicon, hot/cold observable concepts). | Low to moderate. | Moderate. |

**The Semantic‑TypeScript Advantage**

*   **Unique Capabilities:** Integrated statistical and indexing features eliminate the need for manual `reduce` operations or supplementary data‑analysis libraries.
*   **Predictable Resource Management:** Explicit control over event streams prevents the memory leaks that can be subtle in RxJS applications.
*   **Unified Design:** A consistent API for both synchronous and asynchronous workflows reduces cognitive load and code duplication.

This comparison highlights why Semantic‑TypeScript is particularly well‑suited for modern TypeScript applications that demand high performance, robust type safety, and rich data‑processing features without the complexity of traditional reactive frameworks.

---

### Begin Your Exploration

Semantic‑TypeScript transforms intricate data flows into readable, composable, and high‑performance pipelines. Whether you are handling real‑time UI events, processing substantial datasets, or constructing analytical dashboards, it delivers the power of database‑grade indexing with the elegance of functional programming.

**Your Next Steps:**

*   Explore the fully typed API directly within your IDE (all exports are available from the main package entry point).
*   Join the growing community of developers who have replaced convoluted async iterators and complex reactive chains with clear, intentional Semantic pipelines.

**Semantic‑TypeScript** — where streams meet structure.

Begin building today and experience the tangible difference that thoughtful indexing delivers.

**Build with clarity, proceed with confidence, and transform data with intent.**

MIT © Eloy Kim