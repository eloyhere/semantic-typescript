# FAQ

## General Questions

### What is Semantic-TypeScript?

Semantic-TypeScript is a modern type-safe stream processing library that combines concepts from JavaScript Generators, Java Streams, and MySQL indexing to create efficient data processing pipelines.

### Why should I use Semantic-TypeScript over other stream libraries?

Semantic-TypeScript offers several unique advantages:

- **Built-in indexing** with automatic bigint indices on every element
- **Native statistical analysis** for numbers and bigints
- **Leak-proof event streams** with automatic cleanup
- **Unified API** for both synchronous and asynchronous operations
- **Superior TypeScript integration** with full type inference

### Is it production-ready?

Yes! Semantic-TypeScript is stable and used in production environments. It has comprehensive TypeScript type definitions and handles edge cases properly.

## Usage Questions

### Do I need to call a collector before terminal operations?

**Yes!** Terminal operations (`.toArray()`, `.count()`, `.average()`, etc.) are **only available** after converting to a collector:

```typescript
// ✅ Correct
useOf(1, 2, 3)
  .toUnordered() // or .toOrdered()
  .toArray();

// ❌ Error - no collector
useOf(1, 2, 3).toArray();
```

### Why must I limit event streams?

Event streams (`useWindow`, `useDocument`, `useHTMLElement`, `useWebSocket`) **must** use limiting operations to prevent memory leaks:

```typescript
// ✅ Correct - with limit
useWindow("resize")
  .limit(5n) // Required!
  .toUnordered()
  .forEach(callback);

// ❌ Wrong - memory leak!
useWindow("resize").toUnordered().forEach(callback);
```

### What's the difference between `toUnordered()` and `toOrdered()`?

- **`toUnordered()`** - O(n) time/space, faster, no sorting
- **`toOrdered()`** - O(2n) time/space, maintains index order, required for statistics

Use `toUnordered()` when order doesn't matter for better performance.

### Can I use Semantic-TypeScript in Node.js?

Yes! While designed with front-end in mind, it works perfectly in Node.js environments that support ES2022.

## Performance Questions

### Is Semantic-TypeScript performant?

Yes! It's optimized for performance:

- Lazy evaluation reduces memory usage
- `toUnordered()` collector is O(n)
- Zero-allocation operations where possible
- Efficient indexing system

### How do I choose between sync and async streams?

- **Use `SynchronousSemantic`** for static data, ranges, or immediate iteration
- **Use `AsynchronousSemantic`** for events, WebSockets, or long-running streams

The API is the same - the factory functions automatically return the appropriate type.

## Type System Questions

### Does it support TypeScript strict mode?

Yes! Semantic-TypeScript is built with TypeScript strict mode in mind and provides complete type coverage.

### What TypeScript version is required?

TypeScript 5.0 or higher is recommended for the best experience.

## Support

### Where can I get help?

- Browse [GitHub Issues](https://github.com/your-username/semantic-typescript/issues)

### How do I report bugs?

Please report bugs on [GitHub Issues](https://github.com/your-username/semantic-typescript/issues) with:

- A minimal reproduction
- TypeScript version
- Expected vs actual behavior

### Can I contribute?

Yes! Contributions are welcome. Please see the [contributing guidelines](https://github.com/your-username/semantic-typescript/blob/main/CONTRIBUTING.md) on GitHub.
