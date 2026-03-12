# Collectable 介绍

Collectable（可收集器）是 Semantic 流处理管道中的**中间转换状态**，用于准备流数据以便进行终端操作。

## 什么是 Collectable？

在 Semantic-TypeScript 中，流处理分为三个阶段：
1. **创建 Semantic** - 构建数据源
2. **转换为 Collectable** - 准备收集策略
3. **执行终端操作** - 获取最终结果

Collectable 是 Semantic 和终端操作之间的桥梁，它决定了数据如何被组织和累积。

```typescript
useOf(1, 2, 3, 4, 5)
  // ← SynchronousSemantic：可以继续添加中间操作
  .filter(n => n % 2 === 0)
  .map(n => n * 2)
  // ↓ 转换为 Collectable
  .toUnordered()  // ← SynchronousUnorderedCollectable：准备收集
  // ↓ 执行终端操作
  .toArray();     // → [4, 8]
```

## 为什么需要 Collectable？

### 1. 性能优化

不同的 Collectable 类型使用不同的数据结构和算法，选择合适的 Collectable 可以显著提高性能。

```typescript
// 不需要排序时使用 toUnordered - O(n)
useOf(5, 2, 8, 1, 9)
  .toUnordered()
  .toArray(); // → [5, 2, 8, 1, 9]（原始顺序）

// 需要排序时使用 toOrdered - O(2n)
useOf(5, 2, 8, 1, 9)
  .toOrdered()
  .toArray(); // → [1, 2, 5, 8, 9]（排序后）
```

### 2. 明确意图

Collectable 让代码的意图更加清晰——你是需要保持顺序，还是只需要最终结果？

```typescript
// 明确表示不需要保持顺序
stream.toUnordered().count();

// 明确表示需要保持顺序
stream.toOrdered().toArray();
```

### 3. 统一接口

所有终端操作都通过 Collectable 调用，提供一致的 API。

```typescript
stream.toUnordered().toArray();
stream.toUnordered().toSet();
stream.toUnordered().count();
stream.toUnordered().forEach(consumer);
```

## Collectable 的类型

### 按同步/异步分类

**同步 Collectable：**
- `SynchronousUnorderedCollectable<E>` - 同步无序收集
- `SynchronousOrderedCollectable<E>` - 同步有序收集

**异步 Collectable：**
- `AsynchronousUnorderedCollectable<E>` - 异步无序收集
- `AsynchronousOrderedCollectable<E>` - 异步有序收集

### 按功能分类

## 可用的 Collectable 转换

### 1. toUnordered()

**无序收集器** - 不保证元素顺序，性能最优。

**时间复杂度：** O(n)
**空间复杂度：** O(n)
**特点：** 基于 Map，不排序

```typescript
useOf(1, 2, 3, 4, 5)
  .toUnordered()
  .toArray(); // → [1, 2, 3, 4, 5]

// 适用于不需要保持顺序的场景
useOf(users)
  .filter(u => u.age >= 18)
  .toUnordered()
  .count();
```

**何时使用：**
- ✅ 不关心元素顺序
- ✅ 追求最佳性能
- ✅ 只需要统计结果（count、sum、average 等）
- ✅ 使用基于 Set/Map 的操作（distinct、grouping 等）

**何时避免：**
- ❌ 需要保持原始顺序
- ❌ 需要按特定顺序处理元素

---

### 2. toOrdered()

**有序收集器** - 保持元素的处理顺序。

**时间复杂度：** O(2n)
**空间复杂度：** O(n)
**特点：** 保持索引顺序

```typescript
useOf(1, 2, 3, 4, 5)
  .toOrdered()
  .toArray(); // → [1, 2, 3, 4, 5]

// 适用于需要保持顺序的场景
useOf(events)
  .toOrdered()
  .forEach(event => console.log(event.timestamp));
```

**何时使用：**
- ✅ 需要保持原始顺序
- ✅ 按顺序处理元素很重要
- ✅ 需要稳定的可重复结果

**何时避免：**
- ❌ 不关心顺序（性能考虑）
- ❌ 只需要聚合统计结果

---

### 3. toNumericStatistics()

**数值统计收集器** - 专门用于数值数据的统计分析。

**支持的统计操作：**
- `average` - 平均值
- `summate` - 总和
- `median` - 中位数
- `mode` - 众数
- `variance` - 方差
- `standardDeviation` - 标准差

```typescript
useOf(1, 2, 3, 4, 5)
  .toNumericStatistics()
  .average(); // → 3

useOf(1, 2, 3, 4, 5)
  .toNumericStatistics()
  .summate(); // → 15

useOf(1, 2, 3, 4, 5)
  .toNumericStatistics()
  .standardDeviation();
```

**何时使用：**
- ✅ 需要数值统计分析
- ✅ 需要多个统计指标（避免多次遍历）

---

### 4. toBigIntStatistics()

**BigInt 统计收集器** - 专门用于大整数数据的统计分析。

**支持的统计操作：** 与 `toNumericStatistics()` 相同

```typescript
useOf(1n, 2n, 3n, 4n, 5n)
  .toBigIntStatistics()
  .average(); // → 3n

useOf(1n, 2n, 3n, 4n, 5n)
  .toBigIntStatistics()
  .summate(); // → 15n
```

**何时使用：**
- ✅ 处理超出 number 范围的大整数
- ✅ 需要精确的大数计算

---

## Collectable 使用流程

```typescript
// 1. 创建 Semantic
const stream = useOf(1, 2, 3, 4, 5);

// 2. 应用中间操作（可选）
const processed = stream
  .filter(n => n % 2 === 0)
  .map(n => n * 2);

// 3. 转换为 Collectable
const collectable = processed.toUnordered();

// 4. 执行终端操作
const result1 = collectable.toArray();     // [4, 8]
const result2 = collectable.count();       // 2n
const result3 = collectable.average();     // 6

// 可以链式调用
useOf(1, 2, 3, 4, 5)
  .filter(n => n % 2 === 0)
  .map(n => n * 2)
  .toUnordered()
  .toArray(); // → [4, 8]
```

## 选择合适的 Collectable

### 决策流程图

```
需要统计数值数据？
├─ 是 → 使用 toNumericStatistics() 或 toBigIntStatistics()
└─ 否 → 需要保持顺序？
    ├─ 是 → 使用 toOrdered()
    └─ 否 → 使用 toUnordered()（推荐）
```

### 对比表

| Collectable | 时间复杂度 | 保持顺序 | 适用场景 |
|-------------|-----------|---------|---------|
| `toUnordered()` | O(n) | ❌ | 性能优先、不需要排序 |
| `toOrdered()` | O(2n) | ✅ | 需要稳定顺序 |
| `toNumericStatistics()` | O(2n) | ✅ | 数值统计分析 |
| `toBigIntStatistics()` | O(2n) | ✅ | 大整数统计分析 |

### 实际示例

```typescript
// 场景 1：只需要计数 - 使用 toUnordered
useOf(users)
  .filter(u => u.isActive)
  .toUnordered()  // ✅ 不需要顺序
  .count();

// 场景 2：需要按时间顺序处理 - 使用 toOrdered
useOf(events)
  .toOrdered()    // ✅ 保持时间顺序
  .forEach(event => processByTime(event));

// 场景 3：数值统计 - 使用 toNumericStatistics
useOf(1, 2, 3, 4, 5)
  .toNumericStatistics()  // ✅ 专门的统计收集器
  .average();

// 场景 4：去重操作 - 使用 toUnordered
useOf(items)
  .toUnordered()  // ✅ 去重不需要顺序
  .toSet();
```

## 常见问题

### Q: 为什么必须先转换为 Collectable？

**A:** 这是设计决策，确保用户明确选择收集策略。不同的策略有不同的性能特征，强制选择可以避免意外的性能问题。

```typescript
// 明确选择收集策略
stream.toUnordered().count();  // 明确：不需要顺序
stream.toOrdered().toArray();  // 明确：需要保持顺序
```

### Q: 可以多次转换 Collectable 吗？

**A:** 不建议。Collectable 转换会触发数据累积，多次转换会导致性能损失。

```typescript
// ❌ 不推荐：多次转换
stream.toUnordered().toOrdered().toArray();

// ✅ 推荐：直接选择需要的 Collectable
stream.toOrdered().toArray();
```

### Q: toUnordered 真的无序吗？

**A:** `toUnordered` 使用 Map 数据结构，不保证迭代顺序。对于大多数情况，它可能保持插入顺序，但**不应依赖这种行为**。

```typescript
// 不要依赖 toUnordered 的顺序
useOf(5, 2, 8, 1, 9)
  .toUnordered()
  .toArray(); // 结果顺序不确定
```

## 最佳实践

### ✅ 推荐：根据需求选择 Collectable

```typescript
// 统计操作 - 使用 toUnordered
stream.toUnordered().count();
stream.toUnordered().anyMatch(predicate);

// 需要顺序 - 使用 toOrdered
stream.toOrdered().toArray();
stream.toOrdered().forEach(consumer);

// 数值统计 - 使用专用 Collectable
stream.toNumericStatistics().average();
```

### ✅ 推荐：在链式调用最后转换

```typescript
useOf(data)
  .filter(predicate)
  .map(transformer)
  .distinct()  // 中间操作
  .toUnordered()  // 最后转换
  .toArray();
```

### ❌ 避免：不必要的 Collectable 转换

```typescript
// ❌ 不好：多次转换
stream.toUnordered().toArray();
stream.toOrdered().toArray();

// ✅ 更好：选择一次
stream.toOrdered().toArray();
```

### ❌ 避免：在不需要时使用 toOrdered

```typescript
// ❌ 不好：只需要计数却使用 toOrdered
stream.toOrdered().count();  // 性能损失

// ✅ 更好：使用 toUnordered
stream.toUnordered().count();  // 更快
```

## 相关内容

- [Semantic 介绍](./semantics-intro) - 了解 Semantic 流的概念
- [Collector 介绍](./collectors-intro) - 了解终端操作和 Collector
- [核心概念](./core-concepts.md) - 深入了解流处理架构
