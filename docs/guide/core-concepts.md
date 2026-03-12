# Core Concepts

Semantic-TypeScript is built on several powerful concepts that work together to provide efficient, type-safe stream processing.

## Core Builders

### AsynchronousSemantic

The core builder for asynchronous streams, events, and lazy pipelines.

**Use for:**
- Real-time events (DOM events, WebSockets)
- Long-running or infinite streams
- I/O-bound operations
- Network requests

```typescript
import { useWindow, useWebSocket } from "semantic-typescript";

// Real-time window resize events
useWindow("resize")
  .limit(5n)
  .toUnordered()
  .forEach((ev, idx) => console.log(`Resize #${idx}`));

// WebSocket messages
useWebSocket(webSocket, "message")
  .limit(10n)
  .toUnordered()
  .forEach(msg => console.log(msg.data));
```

### SynchronousSemantic

The builder for synchronous, in-memory, or loop-based streams.

**Use for:**
- Static data arrays
- Numeric ranges
- Immediate iteration
- CPU-bound operations

```typescript
import { useOf, useFrom, useRange } from "semantic-typescript";

// From discrete values
useOf(1, 2, 3, 4, 5)
  .map(n => n * 2)
  .toUnordered()
  .toArray(); // [2, 4, 6, 8, 10]

// From array
useFrom([10, 20, 30, 40, 50])
  .filter(n => n > 25)
  .toUnordered()
  .toArray(); // [30, 40, 50]

// From range
useRange(0n, 100n)
  .filter(n => n % 10n === 0n)
  .toUnordered()
  .toArray(); // [0n, 10n, 20n, ..., 90n]
```

## Collectors

### toUnordered()

The fastest terminal collector using Map-based indexing.

**Characteristics:**
- Time Complexity: O(n)
- Space Complexity: O(n)
- Sorted: No
- Best for: Performance-critical paths

```typescript
useOf(3, 1, 4, 1, 5, 9, 2, 6)
  .distinct()
  .toUnordered()   // Fastest!
  .toArray();
```

### toOrdered()

Sorted, index-stable collector that maintains insertion order.

**Characteristics:**
- Time Complexity: O(2n)
- Space Complexity: O(n)
- Sorted: Yes
- Best for: Stable ordering, indexed access

```typescript
useFrom([5, 2, 8, 1, 9])
  .sort((a, b) => a - b)
  .toOrdered()     // Maintains order
  .toArray();      // [1, 2, 5, 8, 9]
```

### toNumericStatistics()

Rich numeric statistical analysis for `number` types.

**Provides:**
- Basic: sum, average, count, min, max
- Advanced: median, mode, variance, standard deviation
- Shape: skewness, kurtosis

```typescript
useOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
  .toNumericStatistics()
  .average();      // 5.5
```

### toBigIntStatistics()

Rich bigint statistical analysis for `bigint` types.

Same capabilities as `toNumericStatistics()` but for arbitrary-precision integers.

```typescript
useOf(1n, 2n, 3n, 4n, 5n)
  .map(n => n * n)
  .toBigIntStatistics()
  .summate();      // 55n
```

### toWindow()

Sliding and tumbling window support for time-series processing.

```typescript
useOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
  .toWindow(3)     // Window size of 3
  .map(window => window.summate())
  .toUnordered()
  .toArray();      // [6, 9, 12, 15, 18, 21, 24, 27]
```

## The Generator Pattern

Streams don't execute immediately—they return generator functions:

```typescript
// This doesn't execute yet
const stream = useOf(1, 2, 3)
  .map(n => n * 2);

// Execution happens here
const result = stream
  .toUnordered()
  .toArray();
```

Each element automatically carries a `bigint` index:

```typescript
useOf('a', 'b', 'c')
  .toUnordered()
  .forEach((element, index) => {
    console.log(`${index}: ${element}`);
    // Output:
    // 0: a
    // 1: b
    // 2: c
  });
```

## Callback System

The stream model uses two callbacks:

- **`accept(element, index)`** - Called for each element that passes through
- **`interrupt(element, index)`** - Called when early termination occurs

```typescript
useRange(0n, 1000n)
  .takeWhile((n, idx) => {
    console.log(`Processing ${n} at index ${idx}`);
    return n < 100n;  // Interrupt after 100
  })
  .toUnordered()
  .toArray();
```

## Immutable Operations

All operations return new instances without modifying the original:

```typescript
const original = useOf(1, 2, 3);
const doubled = original.map(n => n * 2);
const tripled = original.map(n => n * 3);

// original, doubled, and tripled are all independent
```

## Type Safety

Every operation is fully typed with TypeScript:

```typescript
// Type inference works perfectly
const numbers = useOf(1, 2, 3)
  .map(n => n * 2);        // Type: SynchronousSemantic<number>

const strings = useOf('a', 'b', 'c')
  .map(s => s.toUpperCase());  // Type: SynchronousSemantic<string>
```

## Next Steps

- [Important Rules](./important-rules.md) - Learn critical usage rules
- [Performance](./performance.md) - Understand performance characteristics
