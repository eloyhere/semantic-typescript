# 核心概念

Semantic-TypeScript 建立在几个强大的概念之上，这些概念协同工作以提供高效、类型安全的流处理。

## 核心构建器

### AsynchronousSemantic

异步流、事件和惰性管道的核心构建器。

**适用于：**
- 实时事件（DOM 事件、WebSocket）
- 长时间运行或无限流
- I/O 密集型操作
- 网络请求

```typescript
import { useWindow, useWebSocket } from "semantic-typescript";

// 实时窗口调整大小事件
useWindow("resize")
  .limit(5n)
  .toUnordered()
  .forEach((ev, idx) => console.log(`调整大小 #${idx}`));

// WebSocket 消息
useWebSocket(webSocket, "message")
  .limit(10n)
  .toUnordered()
  .forEach(msg => console.log(msg.data));
```

### SynchronousSemantic

同步、内存中或基于循环的流的构建器。

**适用于：**
- 静态数据数组
- 数值范围
- 立即迭代
- CPU 密集型操作

```typescript
import { useOf, useFrom, useRange } from "semantic-typescript";

// 从离散值创建
useOf(1, 2, 3, 4, 5)
  .map(n => n * 2)
  .toUnordered()
  .toArray(); // [2, 4, 6, 8, 10]

// 从数组创建
useFrom([10, 20, 30, 40, 50])
  .filter(n => n > 25)
  .toUnordered()
  .toArray(); // [30, 40, 50]

// 从范围创建
useRange(0n, 100n)
  .filter(n => n % 10n === 0n)
  .toUnordered()
  .toArray(); // [0n, 10n, 20n, ..., 90n]
```

## 收集器

### toUnordered()

使用基于 Map 的索引的最快终结收集器。

**特征：**
- 时间复杂度：O(n)
- 空间复杂度：O(n)
- 排序：否
- 最适合：性能关键路径

```typescript
useOf(3, 1, 4, 1, 5, 9, 2, 6)
  .distinct()
  .toUnordered()   // 最快！
  .toArray();
```

### toOrdered()

排序的、索引稳定的收集器，保持插入顺序。

**特征：**
- 时间复杂度：O(2n)
- 空间复杂度：O(n)
- 排序：是
- 最适合：稳定排序、索引访问

```typescript
useFrom([5, 2, 8, 1, 9])
  .sort((a, b) => a - b)
  .toOrdered()     // 保持排序顺序
  .toArray();      // [1, 2, 5, 8, 9]
```

### toNumericStatistics()

丰富的数值统计分析，适用于 `number` 类型。

**提供：**
- 基本：sum、average、count、min、max
- 位置：median、quartiles、percentiles
- 离散度：variance、standard deviation
- 形状：skewness、kurtosis
- 分布：mode、frequency

```typescript
useOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
  .toNumericStatistics()
  .average();      // 5.5
```

### toBigIntStatistics()

丰富的 bigint 统计分析，适用于 `bigint` 类型。

与 `toNumericStatistics()` 相同的功能，但用于任意精度整数。

```typescript
useOf(1n, 2n, 3n, 4n, 5n)
  .map(n => n * n)
  .toBigIntStatistics()
  .summate();      // 55n
```

### toWindow()

滑动和滚动窗口支持，用于时间序列处理。

```typescript
useOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
  .toWindow(3)     // 窗口大小为 3
  .map(window => window.summate())
  .toUnordered()
  .toArray();      // [6, 9, 12, 15, 18, 21, 24, 27]
```

## 生成器模式

流不会立即执行——它们返回生成器函数：

```typescript
// 这不会立即执行
const stream = useOf(1, 2, 3)
  .map(n => n * 2);

// 在这里执行
const result = stream
  .toUnordered()
  .toArray();
```

每个元素自动携带一个 `bigint` 索引：

```typescript
useOf('a', 'b', 'c')
  .toUnordered()
  .forEach((element, index) => {
    console.log(`${index}: ${element}`);
    // 输出：
    // 0: a
    // 1: b
    // 2: c
  });
```

## 回调系统

流模型使用两个回调：

- **`accept(element, index)`** - 为每个通过的元素调用
- **`interrupt(element, index)`** - 提前终止时调用

```typescript
useRange(0n, 1000n)
  .takeWhile((n, idx) => {
    console.log(`处理 ${n}，索引 ${idx}`);
    return n < 100n;  // 在 100 后中断
  })
  .toUnordered()
  .toArray();
```

## 不可变操作

所有操作都返回新实例而不修改原数据：

```typescript
const original = useOf(1, 2, 3);
const doubled = original.map(n => n * 2);
const tripled = original.map(n => n * 3);

// original、doubled 和 tripled 都是独立的
```

## 类型安全

每个操作都有完整的 TypeScript 类型支持：

```typescript
// 类型推断完美工作
const numbers = useOf(1, 2, 3)
  .map(n => n * 2);        // 类型：SynchronousSemantic<number>

const strings = useOf('a', 'b', 'c')
  .map(s => s.toUpperCase());  // 类型：SynchronousSemantic<string>
```

## 下一步

- [重要规则](./important-rules.md) - 学习关键使用规则
- [性能特征](./performance.md) - 了解性能特征
