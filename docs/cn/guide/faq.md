# 常见问题

## 一般问题

### 什么是 Semantic-TypeScript？

Semantic-TypeScript 是一个现代化的类型安全流处理库，它结合了 JavaScript Generators、Java Streams 和 MySQL 索引的概念，创建高效的数据处理管道。

### 为什么我应该使用 Semantic-TypeScript 而不是其他流库？

Semantic-TypeScript 提供了几个独特的优势：

- **内置索引** - 每个元素上自动的 bigint 索引
- **原生统计分析** - 对数字和 bigints 的全面支持
- **防泄漏事件流** - 带有自动清理的显式控制
- **统一的 API** - 同步和异步操作的一致接口
- **卓越的 TypeScript 集成** - 完整的类型推断

### 它可以用于生产环境吗？

是的！Semantic-TypeScript 是稳定的，并在生产环境中使用。它具有完整的 TypeScript 类型定义，并正确处理边缘情况。

## 使用问题

### 我需要在终结操作之前调用收集器吗？

**是的！** 终结操作**仅在**转换为收集器**之后**可用：

```typescript
// ✅ 正确
useOf(1, 2, 3)
  .toUnordered() // 必需！
  .toArray();

// ❌ 错误 - 没有收集器
useOf(1, 2, 3).toArray();
```

### 为什么必须限制事件流？

事件流（`useWindow`、`useDocument`、`useHTMLElement`、`useWebSocket`）**必须**使用限制操作来防止内存泄漏：

```typescript
// ✅ 正确 - 带限制
useWindow("resize")
  .limit(5n)          # 必需！
  .toUnordered()
  .forEach(callback);

// ❌ 错误 - 内存泄漏！
useWindow("resize")
  .toUnordered()
  .forEach(callback);

# 监听器永远不会被移除
# 内存使用量无限增长
# 最终导致浏览器崩溃
```

### `toUnordered()` 和 `toOrdered()` 有什么区别？

- **`toUnordered()`** - O(n) 时间/空间，更快，无排序
- **`toOrdered()`** - O(2n) 时间/空间，保持索引顺序，统计所需

当性能至关重要且顺序不重要时，使用 `toUnordered()`。

### 我可以在 Node.js 中使用 Semantic-TypeScript 吗？

是的！虽然是为前端设计的，但它在支持 ES2022 的 Node.js 环境中完美运行。

## 性能问题

### Semantic-TypeScript 性能如何？

是的！它经过性能优化：

- 惰性求值减少内存使用
- `toUnordered()` 收集器是 O(n)
- 尽可能实现零分配操作
- 高效的索引系统

### 我如何选择同步和异步流？

- **使用 SynchronousSemantic** 用于静态数据、范围或立即迭代
- **使用 AsynchronousSemantic** 用于事件、WebSocket 或长时间运行的操作

API 是相同的 - 工厂函数自动返回适当的类型。

## 类型系统问题

### 它支持 TypeScript 严格模式吗？

是的！Semantic-TypeScript 在设计时考虑了 TypeScript 严格模式，并提供完整的类型覆盖。

### 需要什么 TypeScript 版本？

建议使用 TypeScript 5.0 或更高版本以获得最佳体验。

## 支持

### 我可以在哪里获得帮助？

- 浏览 [GitHub Issues](https://github.com/eloyhere/semantic-typescript/issues)

### 我如何报告错误？

请在 [GitHub Issues](https://github.com/eloyhere/semantic-typescript/issues) 上报告错误，并包括：

- 最小复现
- TypeScript 版本
- 预期 vs 实际行为

### 我可以贡献吗？

是的！欢迎贡献。请查看 GitHub 上的[贡献指南](https://github.com/eloyhere/semantic-typescript/blob/main/CONTRIBUTING.md)。
