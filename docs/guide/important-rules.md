# Important Usage Rules

Understanding these rules is crucial for using Semantic-TypeScript effectively and avoiding common pitfalls.

## Rule 1: Event Streams Must Be Limited

::: danger Critical
Event streams (`useWindow`, `useDocument`, `useHTMLElement`, `useWebSocket`) **must** use limiting operations to prevent memory leaks.
:::

### Why This Matters

Event listeners remain active until explicitly removed. Without limits, your application will accumulate listeners and eventually crash.

### Limiting Operations

Use one of these operations on event streams:

#### `.limit(n)`

Stop after `n` elements:

```typescript
useWindow("resize")
  .limit(5n)          // ✅ Stop after 5 events
  .toUnordered()
  .forEach(callback);
```

#### `.sub(start, end)`

Process elements from index `start` to `end`:

```typescript
useWindow("scroll")
  .sub(0n, 10n)       // ✅ Process first 10 events
  .toUnordered()
  .forEach(callback);
```

#### `.takeWhile(predicate)`

Process elements while the predicate returns true:

```typescript
useHTMLElement("#input", "keyup")
  .takeWhile((event) => !isSubmitDisabled())  // ✅ Stop when submit is disabled
  .toUnordered()
  .forEach(callback);
```

### What Happens Without Limits?

```typescript
// ❌ WRONG - Memory leak!
useWindow("resize")
  .toUnordered()
  .forEach(callback);

// The listener is NEVER removed
// Memory usage grows indefinitely
// Eventually crashes the browser
```

### Event Stream Factories

These factories return `AsynchronousSemantic` and require limiting:

- `useWindow(eventName)`
- `useDocument(eventName)`
- `useHTMLElement(selector, eventName)`
- `useWebSocket(webSocket, messageName)`

## Rule 2: Terminal Operations Require Collectors

::: warning Important
Terminal operations are **only available** after converting to a collector.
:::

### Correct Usage

```typescript
// ✅ Correct
useOf(1, 2, 3)
  .toUnordered()   // Required!
  .toArray();

// ✅ Correct
useOf(1, 2, 3)
  .toOrdered()     // Also works
  .toArray();
```

### Incorrect Usage

```typescript
// ❌ Error - Property 'toArray' does not exist
useOf(1, 2, 3)
  .toArray();

// You MUST call a collector first
```

### Available Collectors

Choose the right collector for your needs:

| Collector | When to Use |
|-----------|-------------|
| `.toUnordered()` | Performance is critical, order doesn't matter |
| `.toOrdered()` | Need stable ordering or indexed access |
| `.toNumericStatistics()` | Computing statistics on numbers |
| `.toBigIntStatistics()` | Computing statistics on bigints |
| `.toWindow(size)` | Sliding/tumbling window operations |

### Terminal Operations

These operations require collectors:

- `.toArray()` - Collect all elements into an array
- `.toSet()` - Collect into a Set
- `.toMap()` - Collect into a Map
- `.count()` - Count elements
- `.summate()` - Sum all elements
- `.average()` - Calculate average
- `.min()` / `.max()` - Find minimum/maximum
- `.findFirst()` / `.findLast()` - Find matching elements
- `.reduce()` - Reduce to single value
- `.forEach()` - Iterate with side effects
- `.log()` - Log elements to console

## Rule 3: Choose the Right Semantic Type

### When to Use SynchronousSemantic

Use for static data, ranges, or immediate iteration:

```typescript
// ✅ Static data
useFrom([1, 2, 3, 4, 5])

// ✅ Ranges
useRange(0n, 100n)

// ✅ Discrete values
useOf('a', 'b', 'c')
```

### When to Use AsynchronousSemantic

Use for events, WebSockets, or long-running operations:

```typescript
// ✅ DOM events
useWindow("resize")

// ✅ WebSocket
useWebSocket(socket, "message")

// ✅ HTML elements
useHTMLElement("#input", "change")
```

## Rule 4: Immutable Operations

All operations return new instances:

```typescript
const stream = useOf(1, 2, 3);
const mapped = stream.map(n => n * 2);
const filtered = stream.filter(n => n > 1);

// Original stream is unchanged
// Each operation creates a new independent instance
```

## Rule 5: Type Safety

Respect TypeScript's type system:

```typescript
// ✅ Type-safe operations
useOf(1, 2, 3)
  .map((n: number): number => n * 2)  // Explicit types
  .filter((n: number): boolean => n > 1)
  .toUnordered()
  .toArray();

// ❌ Type errors will be caught at compile time
useOf(1, 2, 3)
  .map((n: string): string => n.toUpperCase())  // Error!
```

## Checklist

Before using Semantic-TypeScript in production, verify:

- [ ] All event streams have limiting operations
- [ ] All terminal operations are preceded by collectors
- [ ] Appropriate semantic type is used (sync vs async)
- [ ] Operations respect immutability
- [ ] TypeScript types are correctly specified

## Next Steps

- [Performance](./performance.md) - Learn about performance characteristics
- [Comparison](./comparison.md) - See how Semantic-TypeScript compares to alternatives
