# Comparison with Alternatives

Semantic-TypeScript offers unique advantages compared to other stream processing libraries.

## Feature Comparison

| Feature                           | Semantic-TypeScript                                                  | RxJS                                                 | Native Async Iterators               | Most.js                        |
| --------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------ | ------------------------------ |
| **TypeScript Integration**        | First-class, deeply typed with native index awareness                | Excellent, but involves complex generics             | Good, requires manual typing         | Strong, functional-first style |
| **Built-in Statistics**           | Comprehensive native support for `number` and `bigint`               | Not available natively                               | None                                 | None                           |
| **Indexing & Position Awareness** | Native, powerful bigint indexing on every element                    | Requires custom operators                            | Manual counter required              | Basic, no built-in index       |
| **Event Stream Management**       | Dedicated, type-safe factories with explicit early-stop control      | Powerful but requires manual subscription management | Manual event listener + cancellation | Good `fromEvent`, lightweight  |
| **Performance & Memory**          | Exceptional – optimized `toUnordered()` and `toOrdered()` collectors | Very good, but operator chains add overhead          | Excellent (zero overhead)            | Excellent                      |
| **Bundle Size**                   | Very lightweight                                                     | Large (even with tree-shaking)                       | Zero (native)                        | Small                          |
| **API Design**                    | Functional collector pattern with explicit indexing                  | Reactive Observable pattern                          | Iterator/Generator pattern           | Functional, point-free         |
| **Early Termination**             | Explicit (`interrupt`, `.limit()`, `.takeWhile()`, `.sub()`)         | Good (`take`, `takeUntil`, `first`)                  | Manual (`break` in `for await…of`)   | Good (`take`, `until`)         |
| **Sync & Async Support**          | Unified API – first-class support for both                           | Primarily asynchronous                               | Both, but manual                     | Primarily asynchronous         |
| **Learning Curve**                | Gentle for developers familiar with functional and indexed pipelines | Steeper (many operators, hot/cold observables)       | Low                                  | Moderate                       |

## Key Advantages

### 1. Built-in Statistical Analysis

Semantic-TypeScript includes comprehensive statistical capabilities natively:

```typescript
// Semantic-TypeScript - Built-in statistics
useOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
  .toNumericStatistics()
  .average();      // 5.5
  .median();       // 5.5
  .mode();         // [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  .variance();     // 8.25
  .skewness();     // 0
  .kurtosis();     // -1.224244

// RxJS - No native statistics, requires custom operators
from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  .pipe(
    reduce((acc, val) => acc + val, 0),
    map(sum => sum / 10)
  )
  .subscribe(avg => console.log(avg)); // Only average
```

### 2. Automatic Indexing

Every element carries a bigint index automatically:

```typescript
// Semantic-TypeScript - Automatic indexing
useOf("a", "b", "c")
  .toUnordered()
  .forEach((element, index) => {
    console.log(`${index}: ${element}`);
    // 0: a
    // 1: b
    // 2: c
  });

// RxJS - Manual indexing required
from(["a", "b", "c"])
  .pipe(map((value, index) => ({ value, index })))
  .subscribe(({ value, index }) => {
    console.log(`${index}: ${value}`);
  });
```

### 3. Leak-Proof Event Streams

Explicit control prevents memory leaks:

```typescript
// Semantic-TypeScript - Automatic cleanup
useWindow("resize")
  .limit(5n) // Automatic cleanup after 5 events
  .toUnordered()
  .forEach(handler);
// Listener automatically removed - no memory leak!

// RxJS - Manual cleanup required
const resize$ = fromEvent(window, "resize").pipe(take(5));
const subscription = resize$.subscribe(handler);
// Must remember to unsubscribe!
subscription.unsubscribe();
```

### 4. Unified Sync/Async API

Single API for both synchronous and asynchronous streams:

```typescript
// Semantic-TypeScript - Same API
// Sync
useOf(1, 2, 3)
  .map((n) => n * 2)
  .toUnordered()
  .toArray();

// Async
useWindow("resize")
  .map((event) => event.type)
  .limit(5n)
  .toUnordered()
  .toArray();

// RxJS - Different approaches
// Sync-like (but actually async)
of(1, 2, 3)
  .pipe(map((n) => n * 2))
  .toArray()
  .subscribe((result) => console.log(result));

// Async
fromEvent(window, "resize")
  .pipe(
    map((event) => event.type),
    take(5),
    toArray()
  )
  .subscribe((result) => console.log(result));
```

### 5. Type Safety

Comprehensive TypeScript support:

```typescript
// Semantic-TypeScript - Full type inference
const result = useOf(1, 2, 3)
  .map((n) => n * 2) // Type: SynchronousSemantic<number>
  .filter((n) => n > 0) // Type: SynchronousSemantic<number>
  .toUnordered() // Type: UnorderedCollector<number>
  .toArray(); // Type: number[]

// RxJS - Good types but more complex
const result$ = of(1, 2, 3).pipe(
  map((n) => n * 2), // Observable<number>
  filter((n) => n > 0) // Observable<number>
);
```

## When to Use Semantic-TypeScript

Semantic-TypeScript is ideal for:

- **Front-end applications** requiring type-safe stream processing
- **Data analytics** needing built-in statistical operations
- **Event handling** where memory leaks are a concern
- **Applications** that need both sync and async stream processing
- **Projects** that value simple, functional APIs

## When to Consider Alternatives

### Use RxJS when:

- You need complex reactive patterns (mergeMap, switchMap, etc.)
- Your team is already experienced with RxJS
- You need extensive community support and ecosystem

### Use Native Async Iterators when:

- Bundle size is critical (zero overhead)
- You only need basic async iteration
- You don't need additional features

### Use Most.js when:

- Performance is the only concern
- You prefer point-free functional style
- You don't need built-in statistics

## Migration Guide

### From RxJS

```typescript
// RxJS
fromEvent(window, "resize")
  .pipe(
    debounceTime(100),
    take(5),
    map((event) => event.type)
  )
  .subscribe(console.log);

// Semantic-TypeScript
useWindow("resize")
  .debounce(100)
  .limit(5n)
  .map((event) => event.type)
  .toUnordered()
  .forEach(console.log);
```

### From Native Iterators

```typescript
// Native async iterator
const results = [];
for await (const item of asyncIterable) {
  if (item > 10) break;
  results.push(item * 2);
}

// Semantic-TypeScript
useFrom(asyncIterable)
  .takeWhile((item) => item <= 10)
  .map((item) => item * 2)
  .toUnordered()
  .toArray();
```

## Conclusion

Semantic-TypeScript fills a unique niche in the TypeScript ecosystem:

- **More powerful** than native iterators with built-in statistics and indexing
- **Simpler and safer** than RxJS for most use cases
- **More feature-rich** than Most.js with native analytics
- **Type-safe** by design with excellent TypeScript integration

Choose Semantic-TypeScript when you want a modern, type-safe stream processing library that combines the best features of functional programming, reactive streams, and database-style indexing.

**Next Steps:**

- [Quick Start](./quick-start.md) - Get started with examples
