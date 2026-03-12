# Collector 介绍

Collector（收集器）是 Semantic-TypeScript 流处理管道的**终端操作**，负责将流中的元素累积成最终结果。

## 什么是 Collector？

在流式处理中，数据通过中间操作（如 `filter`、`map`）进行转换，最终必须通过 Collector 来触发实际计算并获取结果。

```typescript
useOf(1, 2, 3, 4, 5)
  .filter(n => n % 2 === 0)
  .map(n => n * 2)
  .toUnordered()
  .collect(useSynchronousToArray()); // → [4, 8]
```

## Collector 的核心特性

### 1. 惰性求值

流处理管道在调用 Collector 之前不会执行任何实际计算。这允许进行优化，如合并多个操作、短路求值等。

```typescript
// 流不会立即执行
const stream = useOf(1, 2, 3, 4, 5)
  .filter(n => n % 2 === 0)
  .map(n => n * 2);

// 只有调用 collect 时才开始计算
const result = stream.collect(useSynchronousToArray()); // [4, 8]
```

### 2. 累积器模式

Collector 内部维护一个累积器（accumulator），逐个处理流中的元素并更新累积状态。

```typescript
useOf(1, 2, 3, 4, 5).collect(
  useSynchronousReduce(
    () => 0,           // 初始累积器
    (sum, n) => sum + n, // 累积函数
    sum => sum         // 最终转换
  )
); // 15
```

### 3. 类型安全

所有 Collector 都是强类型的，确保输入元素类型、累积器类型和结果类型的类型安全。

```typescript
type SynchronousCollector<E, A, R>
// E - 输入元素类型
// A - 累积器类型
// R - 最终结果类型
```

## Collector 的分类

### 按同步/异步分类

- **SynchronousCollector** - 处理同步流，返回同步结果
- **AsynchronousCollector** - 处理异步流，返回 Promise

### 按功能分类

- **匹配操作** - `anyMatch`、`allMatch`、`noneMatch`
- **查找操作** - `findFirst`、`findLast`、`findAt`、`findMinimum`、`findMaximum`
- **聚合操作** - `count`、`reduce`
- **统计操作** - `average`、`summate`、`median`、`mode`、`variance`、`standardDeviation`
- **分组操作** - `group`、`groupBy`、`partition`、`partitionBy`、`frequency`
- **转换操作** - `toArray`、`toSet`、`toMap`
- **连接操作** - `join`
- **迭代操作** - `forEach`、`log`

## Collector 的使用方式

Collector 通过 `.collect()` 方法调用：

```typescript
useOf(1, 2, 3, 4, 5)
  .toUnordered()           // 先转换为收集器
  .collect(useSynchronousToArray());  // 再执行收集操作
```

## 为什么需要 Collector？

### 1. 性能优化

- **单次遍历完成多个操作** - 避免多次遍历数据
- **支持短路求值** - 如 `anyMatch` 找到匹配项即停止

```typescript
// 短路求值示例：找到第一个大于 10 的数就停止
useOf(1, 2, 3, 4, 5, 100, 200, 300)
  .toUnordered()
  .collect(useSynchronousAnyMatch(n => n > 10)); // 只遍历到 100 就停止
```

### 2. 灵活性

- 同样的流可以用不同方式收集
- 支持自定义累积逻辑

```typescript
const stream = useOf(1, 2, 3, 4, 5);

// 收集为数组
stream.collect(useSynchronousToArray()); // [1, 2, 3, 4, 5]

// 收集为总和
stream.collect(useSynchronousReduce(() => 0, (s, n) => s + n, s => s)); // 15

// 收集为 Set
stream.collect(useSynchronousToSet()); // Set {1, 2, 3, 4, 5}
```

### 3. 资源管理

- 控制何时触发实际计算
- 避免不必要的中间集合创建

```typescript
// 不好的做法：创建不必要的中间集合
const filtered = useOf(1, 2, 3, 4, 5)
  .toUnordered()
  .toArray()
  .filter(n => n % 2 === 0); // 额外的数组创建

// 好的做法：流式处理
useOf(1, 2, 3, 4, 5)
  .filter(n => n % 2 === 0)
  .toUnordered()
  .collect(useSynchronousToArray());
```

## Collector vs 数组方法

| 特性 | Collector | 数组方法 |
|------|-----------|---------|
| **惰性求值** | ✅ 支持 | ❌ 立即执行 |
| **无限流** | ✅ 支持 | ❌ 不支持 |
| **短路求值** | ✅ 自动优化 | ⚠️ 部分支持（`some`、`find`） |
| **单次遍历** | ✅ 多操作一次遍历 | ❌ 每个方法一次遍历 |
| **链式调用** | ✅ 流式 API | ✅ 支持 |

```typescript
// 数组方法：每次调用都创建新数组
[1, 2, 3, 4, 5]
  .filter(n => n % 2 === 0)  // 遍历 5 次
  .map(n => n * 2)           // 遍历 2 次
  .filter(n => n > 4);       // 遍历 2 次

// Collector：单次遍历完成所有操作
useOf(1, 2, 3, 4, 5)
  .filter(n => n % 2 === 0)
  .map(n => n * 2)
  .filter(n => n > 4)
  .toUnordered()
  .collect(useSynchronousToArray()); // 只遍历 1 次
```

## 最佳实践

### ✅ 推荐：选择最合适的 Collector

```typescript
// 需要检查是否存在时使用 anyMatch
const hasEven = useOf(1, 2, 3, 4, 5)
  .toUnordered()
  .collect(useSynchronousAnyMatch(n => n % 2 === 0));

// 需要所有元素时使用 toArray
const allNumbers = useOf(1, 2, 3, 4, 5)
  .toUnordered()
  .collect(useSynchronousToArray());

// 需要统计时使用对应的统计 Collector
const average = useOf(1, 2, 3, 4, 5)
  .toUnordered()
  .collect(useSynchronousNumericAverage());
```

### ✅ 推荐：利用短路求值

```typescript
// limit 限制后 anyMatch 会提前终止
useOf(1, 2, 3, 4, 5, /* ... 无限流 */)
  .limit(10n)
  .toUnordered()
  .collect(useSynchronousAnyMatch(n => n > 100));
```

### ❌ 避免：不必要的中间集合

```typescript
// 不推荐：先转数组再操作
useOf(1, 2, 3)
  .toUnordered()
  .collect(useSynchronousToArray())
  .filter(...); // 失去流式处理的优势

// 推荐：直接使用流操作
useOf(1, 2, 3)
  .filter(...)
  .toUnordered()
  .collect(useSynchronousToArray());
```

### ❌ 避免：在循环中重复收集

```typescript
// 不推荐：在循环中多次遍历
const stream = useOf(1, 2, 3, 4, 5);
for (let i = 0; i < 10; i++) {
  stream.collect(useSynchronousToArray()); // 每次都重新遍历
}

// 推荐：收集一次，多次使用
const data = useOf(1, 2, 3, 4, 5)
  .toUnordered()
  .collect(useSynchronousToArray());
for (let i = 0; i < 10; i++) {
  // 使用 data
}
```

## 相关内容

- [Collector 函数参考](./collectors.md) - 所有 Collector 函数的详细文档
- [Semantic 函数](./semantics.md) - 创建流的工厂函数
- [核心概念](./core-concepts.md) - 了解 Semantic 和 Collector 的关系
