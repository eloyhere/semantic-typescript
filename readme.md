# **Semantic-TypeScript**

**Flow, Indexed.** Your data, under precise control.

---

[Home](https://eloyhere.github.io/semantic-typescript/)

### Overview

Semantic-TypeScript marks a significant leap forward in stream processing technology, **synthesising** the most effective concepts from JavaScript `GeneratorFunction`, Java Streams, and MySQL-style indexing. Its core philosophy is both simple and powerful: construct exceptionally efficient data-processing pipelines through intelligent indexing, not through brute-force iteration.

Where conventional libraries impose synchronous loops or unwieldy promise chains, Semantic-TypeScript delivers a **fully asynchronous**, functionally pure, and rigorously type-safe experience, designed for the demands of modern front-end development.

In its elegant model, data only reaches the consumer when the upstream pipeline explicitly invokes the `accept` (and optionally `interrupt`) callbacks. You have complete control over the timing—exactly when it is needed.

---

### Why Developers Prefer It

- **Zero-Boilerplate Indexing** — every element carries its natural or bespoke index.
- **Pure Functional Style** — with full TypeScript inference.
- **Leak-Proof Event Streams** — `useWindow`, `useDocument`, `useHTMLElement`, and `useWebSocket` are built with safety in mind. You define the boundary—using `limit(n)`, `sub(start, end)`, or `takeWhile(predicate)`—and the library manages the cleanup. No lingering listeners, no memory leaks.
- **Built-in Statistics** — comprehensive numeric and bigint analytics including averages, medians, modes, variance, skewness, and kurtosis.
- **Predictable Performance** — choose between ordered or unordered collectors based on your requirements.
- **Memory-Efficient** — streams are evaluated lazily, alleviating memory concerns.
- **No Undefined Behaviour** — TypeScript guarantees type safety and nullability. Input data remains unmodified unless explicitly altered within your callback functions.

---

### Installation

```bash
npm install semantic-typescript
```

or

```bash
yarn add semantic-typescript
```

---

### Quick Start

```typescript
import {
  useOf,
  useFrom,
  useRange,
  useWindow,
  useHTMLElement,
  useWebSocket,
  useText,
  useStringify,
} from "semantic-typescript";

// Numeric statistics
let summate: number = useOf(10, 20, 30, 40)
  .map((n: number): number => n * 2)
  .toNumericStatistics() // Required before terminal operation
  .summate(); // 200

// Bigint statistics
let summate: bigint = useOf(10n, 20n, 30n, 40n)
  .map((n: bigint): bigint => n * 2)
  .toBigIntStatistics() // Required before terminal operation
  .summate(); // 200n

// Reverse a stream by index
useFrom([1, 2, 3, 4, 5])
  .redirect((element: E, index: bigint): bigint => -index) // Negative index for reversal
  .toOrdered() // Call toOrdered() to preserve index order
  .toArray(); // [5, 4, 3, 2, 1]

// Shuffle a stream
useFrom([1, 2, 3, 4, 5]).shuffle().toOrdered().toArray(); // e.g., [2, 5, 1, 4, 3]

// Translate elements within a stream
useFrom([1, 2, 3, 4, 5])
  .translate(2) // Shift elements right by 2 positions
  .toOrdered()
  .toArray(); // [4, 5, 1, 2, 3]

useFrom([1, 2, 3, 4, 5])
  .translate(-2) // Shift elements left by 2 positions
  .toOrdered()
  .toArray(); // [3, 4, 5, 1, 2]

// Infinite range with early termination
useRange(0n, 1_000_000n)
  .filter((n) => n % 17n === 0n)
  .limit(10n) // Stop after 10 elements
  .toUnordered()
  .toArray();

// Real-time window resize (stops automatically after 5 events)
useWindow("resize")
  .limit(5n) // Crucial for event streams
  .toUnordered()
  .forEach((ev, idx) => console.log(`Resize #${idx}`));

// Listen to an HTML element
// <input id="input" type="text"/>
useHTMLElement("#input", "change")
  .limit(1)
  .toUnordered()
  .forEach((event: Event) => submit(event));

// Listen to multiple elements and events
useHTMLElement("input", ["change", "keyup"])
  .takeWhile((event: Event): boolean => validate(event))
  .toUnordered()
  .forEach((event: Event) => submit(event));

// Listen to a WebSocket
let webSocket = new WebSocket("ws://localhost:8080");
webSocket.addEventListener("close", (): void => {
  webSocket.close(); // Manage the WebSocket lifecycle manually
});
useWebSocket(webSocket, "message")
  .limit(1)
  .toUnordered()
  .forEach((message: MessageEvent) => console.log(message.data));

// Iterate over a string by code point
useText("My emotion now is: 😊, and semantic is 👍").toUnordered().log(); // Outputs the string

// Safely stringify an object with circular references
let o = {
  a: 1,
  b: "text",
  c: [o.a, o.b, o.c], // Circular reference
};
// let text: string = JSON.stringify(o); // Throws an error
let text: string = useStringify(o); // Safely yields `{a: 1, b: "text", c: []}`
```

---

### Core Concepts

| Concept                 | Purpose                                                                               | When to Use                                                                    |
| :---------------------- | :------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------- |
| `AsynchronousSemantic`  | Core builder for asynchronous streams, events, and lazy pipelines.                    | Real-time events, WebSockets, DOM listeners, long-running or infinite streams. |
| `SynchronousSemantic`   | Builder for synchronous, in-memory, or loop-based streams.                            | Static data, ranges, immediate iteration.                                      |
| `toUnordered()`         | Fastest terminal collector (Map-based indexing).                                      | Performance-critical paths (O(n) time & space, no sorting).                    |
| `toOrdered()`           | Sorted, index-stable collector.                                                       | When stable ordering or indexed access is required.                            |
| `toNumericStatistics()` | Rich numeric statistical analysis (mean, median, variance, skewness, kurtosis, etc.). | Data analytics and statistical computations.                                   |
| `toBigIntStatistics()`  | Rich bigint statistical analysis.                                                     | Data analytics and statistical computations for large integers.                |
| `toWindow()`            | Sliding and tumbling window support.                                                  | Time-series processing, batching, and windowed operations.                     |

---

**Important Usage Rules**

1.  **Event streams** (`useWindow`, `useDocument`, `useHTMLElement`, `useWebSocket`, …) return an `AsynchronousSemantic`.
    → You **must** call `.limit(n)`, `.sub(start, end)`, or `.takeWhile()` to cease listening. Otherwise, the listener remains active.

2.  **Terminal operations** (`.toArray()`, `.count()`, `.average()`, `.reduce()`, `.findFirst()`, etc.) are **only available after** conversion to a collector:
    ```typescript
    .toUnordered()   // O(n) time & space, no sorting
    // or
    .toOrdered()     // Sorted, maintains order
    ```

---

### Performance Characteristics

| Collector               | Time Complexity | Space Complexity | Sorted? | Best For                                      |
| :---------------------- | :-------------- | :--------------- | :------ | :-------------------------------------------- |
| `toUnordered()`         | O(n)            | O(n)             | No      | Raw speed, order not required.                |
| `toOrdered()`           | O(2n)           | O(n)             | Yes     | Stable ordering, indexed access, analytics.   |
| `toNumericStatistics()` | O(2n)           | O(n)             | Yes     | Statistical operations requiring sorted data. |
| `toBigIntStatistics()`  | O(2n)           | O(n)             | Yes     | Statistical operations for bigint.            |
| `toWindow()`            | O(2n)           | O(n)             | Yes     | Time-based windowing operations.              |

Opt for `toUnordered()` when speed is paramount. Use `toOrdered()` only when you require stable ordering or statistical methods that depend on sorted data.

---

**Comparison with Other Front-End Stream Processors**

| Feature                                | Semantic-TypeScript                                                   | RxJS                                                  | Native Async Iterators / Generators   | Most.js                         |
| :------------------------------------- | :-------------------------------------------------------------------- | :---------------------------------------------------- | :------------------------------------ | :------------------------------ |
| **TypeScript Integration**             | First-class, deeply typed with native index awareness.                | Excellent, but involves complex generics.             | Good, requires manual typing.         | Strong, functional-first style. |
| **Built-in Statistical Analysis**      | Comprehensive native support for `number` and `bigint`.               | Not available natively (requires custom operators).   | None.                                 | None.                           |
| **Indexing & Position Awareness**      | Native, powerful bigint indexing on every element.                    | Requires custom operators (`scan`, `withLatestFrom`). | Manual counter required.              | Basic, no built-in index.       |
| **Event Stream Management**            | Dedicated, type-safe factories with explicit early-stop control.      | Powerful but requires manual subscription management. | Manual event listener + cancellation. | Good `fromEvent`, lightweight.  |
| **Performance & Memory Efficiency**    | Exceptional – optimised `toUnordered()` and `toOrdered()` collectors. | Very good, but operator chains add overhead.          | Excellent (zero overhead).            | Excellent.                      |
| **Bundle Size**                        | Very lightweight.                                                     | Large (even with tree-shaking).                       | Zero (native).                        | Small.                          |
| **API Design Philosophy**              | Functional collector pattern with explicit indexing.                  | Reactive Observable pattern.                          | Iterator / Generator pattern.         | Functional, point-free.         |
| **Early Termination & Control**        | Explicit (`interrupt`, `.limit()`, `.takeWhile()`, `.sub()`).         | Good (`take`, `takeUntil`, `first`).                  | Manual (`break` in `for await…of`).   | Good (`take`, `until`).         |
| **Synchronous & Asynchronous Support** | Unified API – first-class support for both.                           | Primarily asynchronous.                               | Both, but manual.                     | Primarily asynchronous.         |
| **Learning Curve**                     | Gentle for developers familiar with functional and indexed pipelines. | Steeper (many operators, hot/cold observables).       | Low.                                  | Moderate.                       |

**Key Advantages of Semantic-TypeScript**

- Unique built-in statistical and indexing capabilities, eliminating the need for manual `reduce` or external libraries.
- Explicit control over event streams prevents the memory leaks common in RxJS.
- A unified synchronous/asynchronous design provides a single, consistent API for diverse use cases.

This comparison illustrates why Semantic-TypeScript is particularly well-suited for modern TypeScript front-end applications that demand performance, type safety, and rich analytics without the ceremony of traditional reactive libraries.

---

### Ready to Explore?

Semantic-TypeScript transforms complex data flows into readable, composable, and high-performance pipelines. Whether you are handling real-time UI events, processing large datasets, or building analytics dashboards, it provides the power of database-grade indexing with the elegance of functional programming.

**Next Steps:**

- Browse the fully typed API in your IDE (all exports are from the main package).
- Join the growing community of developers who have replaced convoluted async iterators with clean Semantic pipelines.

**Semantic-TypeScript** — where streams meet structure.

Begin building today and experience the difference that thoughtful indexing delivers.

**Build with clarity, proceed with confidence, and transform data with intent.**

MIT © Eloy Kim
