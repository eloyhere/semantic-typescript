# 性能特征

Semantic-TypeScript 专为性能设计。了解这些特征有助于您做出明智的决策。

## 收集器性能

| 收集器                  | 时间复杂度 | 空间复杂度 | 是否排序？ | 最适用于             |
| ----------------------- | ---------- | ---------- | ---------- | -------------------- |
| `toUnordered()`         | O(n)       | O(n)       | 否         | 原始速度，顺序不重要 |
| `toOrdered()`           | O(2n)      | O(n)       | 是         | 稳定排序、索引访问   |
| `toNumericStatistics()` | O(2n)      | O(n)       | 是         | 统计操作             |
| `toBigIntStatistics()`  | O(2n)      | O(n)       | 是         | Bigint 统计          |
| `toWindow()`            | O(2n)      | O(n)       | 是         | 基于时间的窗口化     |

## 选择正确的收集器

### 使用 `toUnordered()` 追求速度

当顺序不重要时，`toUnordered()` 是最快的选择：

```typescript
// ✅ 最快 - O(n)
useOf(3, 1, 4, 1, 5, 9, 2, 6)
  .distinct()
  .toUnordered() // 无排序开销
  .toArray();
```

**使用场景：**

- 去重
- 过滤操作
- 计数元素
- 查找最小/最大值
- 计算聚合（顺序不重要时）

### 使用 `toOrdered()` 保持稳定性

当您需要稳定排序或索引访问时：

```typescript
// ✅ 稳定 - O(2n)
useFrom([5, 2, 8, 1, 9])
  .sort((a, b) => a - b)
  .toOrdered() // 保持排序顺序
  .toArray(); // [1, 2, 5, 8, 9]
```

**使用场景：**

- 排序结果
- 基于索引的操作
- `redirect()` 与负索引
- `translate()` 操作
- 统计计算

### 使用统计收集器进行分析

用于全面的统计分析：

```typescript
// ✅ 完整分析
useOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10).toNumericStatistics().average(); // 5.5
```

**提供的统计：**

- 基本：sum、average、count、min、max
- 位置：median、quartiles、percentiles
- 离散度：variance、standard deviation
- 形状：skewness、kurtosis
- 分布：mode、frequency

## 内存效率

### 惰性求值

流采用惰性求值，减少内存使用：

```typescript
// 仅按需处理元素
useRange(0n, 1_000_000n)
  .filter((n) => n % 17n === 0n)
  .limit(10n) // 内存中只有 10 个元素
  .toUnordered()
  .toArray();
```

### 无中间集合

链式操作不会创建中间数组：

```typescript
// ✅ 高效 - 单次遍历
useOf(1, 2, 3, 4, 5)
  .map((n) => n * 2)
  .filter((n) => n > 5)
  .map((n) => n + 1)
  .toUnordered()
  .toArray();
```

每个元素流经整个管道，无需中间存储。

## 操作复杂度

### O(1) 操作

这些操作是常数时间：

- `.limit(n)` - 设置上限
- `.sub(start, end)` - 定义范围
- `.takeWhile(predicate)` - 条件终止
- `.forEach(fn)` - 迭代

### O(n) 操作

这些操作线性扩展：

- `.map(fn)` - 转换
- `.filter(predicate)` - 过滤
- `.distinct()` - 去重（使用哈希）
- `.sort(comparator)` - 排序（toOrdered）
- `.toUnordered()` - 收集

### O(2n) 操作

这些操作需要两次遍历：

- `.toOrdered()` - 排序和收集
- `.toNumericStatistics()` - 统计计算
- `.toBigIntStatistics()` - 统计计算

## 性能技巧

### 1. 尽可能使用 `toUnordered()`

```typescript
// ✅ 更快 - O(n)
useOf(data)
  .filter((x) => x > 0)
  .toUnordered()
  .count();

// ❌ 较慢 - O(2n)（如果不需要）
useOf(data)
  .filter((x) => x > 0)
  .toOrdered()
  .count();
```

### 2. 尽早限制

尽可能早地应用限制：

```typescript
// ✅ 高效 - 先限制
useRange(0n, 1_000_000n)
  .limit(100n)           # 先限制
  .map(n => expensiveComputation(n))
  .toUnordered()
  .toArray();

// ❌ 低效 - 处理所有元素
useRange(0n, 1_000_000n)
  .map(n => expensiveComputation(n))  # 昂贵！
  .limit(100n)
  .toUnordered()
  .toArray();
```

### 3. 先过滤再映射

首先过滤以减少转换工作量：

```typescript
// ✅ 高效 - 先过滤
useOf(data)
  .filter((x) => x.isValid())
  .map((x) => transform(x))
  .toUnordered()
  .toArray();

// ❌ 低效 - 转换所有内容
useOf(data)
  .map((x) => transform(x))
  .filter((x) => x.isValid())
  .toUnordered()
  .toArray();
```

### 4. 使用原生统计

不要手动实现统计：

```typescript
// ✅ 使用内置统计
useOf(numbers).toNumericStatistics().average();

// ❌ 手动实现较慢
useOf(numbers)
  .toUnordered()
  .reduce((sum, n) => sum + n, 0) / count;
```

## 事件流性能

事件流经过优化，开销最小：

```typescript
// ✅ 高效的事件处理
useWindow("resize")
  .limit(5n)
  .debounce(100)      # 内置防抖
  .toUnordered()
  .forEach(handler);
```

**优势：**

- 自动监听器清理
- 无内存泄漏
- 最小分配
- 高效的回调处理

## 基准测试

始终针对您的特定用例进行基准测试：

```typescript
// 测量性能
console.time("stream");
useOf(data).operation().toUnordered().toArray();
console.timeEnd("stream");
```

## 与 RxJs 的对比

请参阅[对比](./comparison.md)了解与其他流库的详细性能对比。
