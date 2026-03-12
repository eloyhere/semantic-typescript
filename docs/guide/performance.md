# Performance Characteristics

Semantic-TypeScript is designed for performance. Understanding these characteristics helps you make informed decisions.

## Collector Performance

| Collector               | Time Complexity | Space Complexity | Sorted? | Best For                        |
| ----------------------- | --------------- | ---------------- | ------- | ------------------------------- |
| `toUnordered()`         | O(n)            | O(n)             | No      | Raw speed, order not required   |
| `toOrdered()`           | O(2n)           | O(n)             | Yes     | Stable ordering, indexed access |
| `toNumericStatistics()` | O(2n)           | O(n)             | Yes     | Statistical operations          |
| `toBigIntStatistics()`  | O(2n)           | O(n)             | Yes     | Bigint statistics               |
| `toWindow()`            | O(2n)           | O(n)             | Yes     | Time-based windowing            |

## Choosing the Right Collector

### Use `toUnordered()` for Speed

When order doesn't matter, `toUnordered()` is the fastest choice:

```typescript
// ✅ Fastest - O(n)
useOf(3, 1, 4, 1, 5, 9, 2, 6)
  .distinct()
  .toUnordered() // No sorting overhead
  .toArray();
```

**Use cases:**

- Removing duplicates
- Filtering operations
- Counting elements
- Finding min/max
- Computing aggregates where order doesn't matter

### Use `toOrdered()` for Stability

When you need stable ordering or indexed access:

```typescript
// ✅ Stable - O(2n)
useFrom([5, 2, 8, 1, 9])
  .sort((a, b) => a - b)
  .toOrdered() // Maintains sorted order
  .toArray();
```

**Use cases:**

- Sorted results
- Index-based operations
- `redirect()` with negative indices
- `translate()` operations
- Statistical computations

### Use Statistics Collectors for Analytics

For comprehensive statistical analysis:

```typescript
// ✅ Complete analytics
useOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10).toNumericStatistics().average(); // 5.5
```

**Statistics provided:**

- Basic: sum, average, count, min, max
- Position: median, quartiles, percentiles
- Dispersion: variance, standard deviation
- Shape: skewness, kurtosis
- Distribution: mode, frequency

## Memory Efficiency

### Lazy Evaluation

Streams are evaluated lazily, reducing memory usage:

```typescript
// Only processes elements as needed
useRange(0n, 1_000_000n)
  .filter((n) => n % 17n === 0n)
  .limit(10n) // Only 10 elements in memory
  .toUnordered()
  .toArray();
```

### No Intermediate Collections

Chained operations don't create intermediate arrays:

```typescript
// ✅ Efficient - single pass
useOf(1, 2, 3, 4, 5)
  .map((n) => n * 2)
  .filter((n) => n > 5)
  .map((n) => n + 1)
  .toUnordered()
  .toArray();
```

Each element flows through the entire pipeline without intermediate storage.

## Operation Complexity

### O(1) Operations

These operations are constant time:

- `.limit(n)` - Sets upper bound
- `.sub(start, end)` - Defines range
- `.takeWhile(predicate)` - Conditional termination
- `.forEach(fn)` - Iteration

### O(n) Operations

These operations scale linearly:

- `.map(fn)` - Transformation
- `.filter(predicate)` - Filtering
- `.distinct()` - Deduplication (with hash)
- `.sort(comparator)` - Sorting (toOrdered)
- `.toUnordered()` - Collection

### O(2n) Operations

These operations require two passes:

- `.toOrdered()` - Sorting and collection
- `.toNumericStatistics()` - Statistical computation
- `.toBigIntStatistics()` - Statistical computation

## Performance Tips

### 1. Use `toUnordered()` When Possible

```typescript
// ✅ Faster - O(n)
useOf(data)
  .filter((x) => x > 0)
  .toUnordered()
  .count();

// ❌ Slower - O(2n) if not needed
useOf(data)
  .filter((x) => x > 0)
  .toOrdered()
  .count();
```

### 2. Limit Early

Apply limits as early as possible:

```typescript
// ✅ Efficient - limits before expensive operations
useRange(0n, 1_000_000n)
  .limit(100n) // Limit first
  .map((n) => expensiveComputation(n))
  .toUnordered()
  .toArray();

// ❌ Inefficient - processes all elements
useRange(0n, 1_000_000n)
  .map((n) => expensiveComputation(n)) // Expensive!
  .limit(100n)
  .toUnordered()
  .toArray();
```

### 3. Filter Before Mapping

Filter first to reduce transformation work:

```typescript
// ✅ Efficient - filter first
useOf(data)
  .filter((x) => x.isValid())
  .map((x) => transform(x))
  .toUnordered()
  .toArray();

// ❌ Less efficient - transforms everything
useOf(data)
  .map((x) => transform(x))
  .filter((x) => x.isValid())
  .toUnordered()
  .toArray();
```

### 4. Use Native Statistics

Don't implement statistics manually:

```typescript
// ✅ Use built-in statistics
useOf(numbers).toNumericStatistics().average();

// ❌ Manual implementation is slower
useOf(numbers)
  .toUnordered()
  .reduce((sum, n) => sum + n, 0) / count;
```

## Event Stream Performance

Event streams are optimized for minimal overhead:

```typescript
// ✅ Efficient event handling
useWindow("resize")
  .limit(5n)
  .debounce(100) // Built-in debouncing
  .toUnordered()
  .forEach(handler);
```

**Benefits:**

- Automatic listener cleanup
- No memory leaks
- Minimal allocation
- Efficient callback handling

## Benchmarking

Always benchmark for your specific use case:

```typescript
// Measure performance
console.time("stream");
useOf(data).operation().toUnordered().toArray();
console.timeEnd("stream");
```

## Comparison with Alternatives

See [Comparison](./comparison.md) for detailed performance comparisons with other stream libraries.

## Next Steps

- [Comparison](./comparison.md) - Compare with alternatives
