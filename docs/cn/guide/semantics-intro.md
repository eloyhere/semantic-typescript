# Semantic 介绍

Semantic（语义流）是 Semantic-TypeScript 的核心抽象，代表一个可以按需生成数据序列的懒加载管道。

## 关于

`Semantic` 是一个**惰性求值的数据处理管道**，它不会立即执行操作，而是构建一个执行计划，直到需要结果时才真正计算。这种设计允许进行各种优化和组合。

```typescript
// 创建一个 Semantic - 不会立即执行
const stream = useOf(1, 2, 3, 4, 5)
  .filter((n) => n % 2 === 0)
  .map((n) => n * 2);

// 只有调用终端操作时才开始执行
stream.toUnordered().toArray(); // → [4, 8]
```

## 核心特性

### 1. 惰性求值

Semantic 不会立即执行操作，而是构建一个执行管道。只有当需要结果时，才会真正遍历数据。

```typescript
const stream = useOf(1, 2, 3, 4, 5).map((n) => {
  console.log("处理:", n);
  return n * 2;
});

// 此时不会输出任何内容 - 管道尚未执行
console.log("管道已创建");

// 调用终端操作时才开始执行
stream.toUnordered().toArray();
// 输出:
// 管道已创建
// 处理: 1
// 处理: 2
// 处理: 3
// 处理: 4
// 处理: 5
```

### 2. 链式操作

支持流畅的链式 API，可以组合多个操作来构建复杂的数据处理管道。

```typescript
useOf(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
  .filter((n) => n % 2 === 0) // 筛选偶数
  .map((n) => n * 2) // 乘以 2
  .filter((n) => n > 8) // 筛选大于 8 的数
  .limit(3n) // 只取前 3 个
  .toUnordered()
  .toArray(); // → [12, 16, 20]
```

### 3. 操作融合

多个操作可以融合成单次遍历，避免创建中间集合。

```typescript
// 数组方法：每个操作都会创建新数组
[1, 2, 3, 4, 5]
  .filter((n) => n % 2 === 0) // 第 1 次遍历，创建数组 [2, 4]
  .map((n) => n * 2) // 第 2 次遍历，创建数组 [4, 8]
  .filter((n) => n > 4); // 第 3 次遍历，创建数组 [8]

// Semantic：单次遍历完成所有操作
useOf(1, 2, 3, 4, 5)
  .filter((n) => n % 2 === 0)
  .map((n) => n * 2)
  .filter((n) => n > 4)
  .toUnordered()
  .toArray(); // 只遍历 1 次
```

### 4. 类型安全

Semantic 提供完整的 TypeScript 类型推导，确保类型安全。

```typescript
// 类型自动推导
const stream = useOf(1, 2, 3, 4, 5); // SynchronousSemantic<number>

stream.filter((n) => n > 3); // n 的类型是 number
stream.map((n) => n.toString()); // 返回 SynchronousSemantic<string>
stream.flatMap((n) => [n, n * 2]); // 返回 SynchronousSemantic<number>
```

## Semantic 的两种类型

### SynchronousSemantic（同步流）

处理同步数据源，返回同步结果。适用于：

- 静态数组数据
- 范围生成
- 同步生成器

```typescript
useOf(1, 2, 3, 4, 5).toUnordered().toArray(); // → [1, 2, 3, 4, 5]

useRange(1, 100)
  .filter((n) => n % 10 === 0)
  .toUnordered()
  .toArray(); // → [10, 20, 30, ..., 90]
```

### AsynchronousSemantic（异步流）

处理异步数据源，返回 Promise。适用于：

- DOM 事件
- WebSocket 消息
- 定时器
- 异步生成器

```typescript
useWindow("resize")
  .limit(5n)
  .toUnordered()
  .forEach((ev, idx) => console.log(`Resize #${idx}`));

useInterval(1000)
  .limit(5n)
  .toUnordered()
  .forEach(() => console.log("Tick"));
```

## Semantic 的生命周期

```typescript
// 1. 创建 - 从数据源创建 Semantic
const stream1 = useOf(1, 2, 3, 4, 5);

// 2. 转换 - 应用中间操作（不执行）
const stream2 = stream1.filter((n) => n % 2 === 0).map((n) => n * 2);

// 3. 收集 - 转换为收集器（不执行）
const collector = stream2.toUnordered();

// 4. 终端操作 - 触发执行并获取结果
const result = collector.toArray(); // → [4, 8]
```

## 常见的 Semantic 操作

### 中间操作

中间操作返回一个新的 Semantic，是惰性的：

```typescript
// 过滤
.filter(predicate)

// 映射
.map(mapper)

// 扁平映射
.flatMap(mapper)

// 去重
.distinct()

// 排序
.sorted(comparator)

// 限制
.limit(count)

// 跳过
.skip(count)

// 窗口
.window(size, slide)

// 分组
.groupBy(classifier)
```

### 终端操作

终端操作触发实际执行并返回结果：

```typescript
// 转换为数组
.toArray()

// 转换为 Set
.toSet()

// 转换为 Map
.toMap(mapper)

// 遍历
.forEach(consumer)

// 归约
.reduce(reducer)

// 匹配
.anyMatch(predicate)
.allMatch(predicate)
.noneMatch(predicate)

// 查找
.findFirst()
.findLast()

// 计数
.count()
```

## Semantic vs 数组方法

| 特性         | Semantic    | 数组方法            |
| ------------ | ----------- | ------------------- |
| **惰性求值** | ✅ 支持     | ❌ 立即执行         |
| **无限流**   | ✅ 支持     | ❌ 不支持           |
| **操作融合** | ✅ 单次遍历 | ❌ 多次遍历         |
| **链式调用** | ✅ 不可变   | ✅ 返回新数组       |
| **异步支持** | ✅ 原生支持 | ⚠️ 需要 Promise.all |
| **类型安全** | ✅ 完整推导 | ✅ 支持             |

### 性能对比

```typescript
// 数组方法：3 次遍历，2 个中间数组
console.time("数组");
[1, 2, 3, 4, 5]
  .filter((n) => n % 2 === 0) // 遍历 5 次，创建 [2, 4]
  .map((n) => n * 2) // 遍历 2 次，创建 [4, 8]
  .filter((n) => n > 4); // 遍历 2 次，创建 [8]
console.timeEnd("数组");

// Semantic：1 次遍历，0 个中间数组
console.time("Semantic");
useOf(1, 2, 3, 4, 5)
  .filter((n) => n % 2 === 0)
  .map((n) => n * 2)
  .filter((n) => n > 4)
  .toUnordered()
  .toArray();
console.timeEnd("Semantic");
```

## 何时使用 Semantic？

### ✅ 推荐使用

```typescript
// 1. 复杂数据转换
useOf(users)
  .filter((u) => u.age >= 18)
  .map((u) => ({ ...u, isAdult: true }))
  .sortBy((u) => u.name)
  .toUnordered()
  .toArray();

// 2. 处理大量数据
useRange(1, 1000000)
  .filter((n) => isPrime(n))
  .limit(100)
  .toUnordered()
  .toArray();

// 3. 事件流处理
useWindow("resize")
  .debounce(300)
  .map(() => window.innerWidth)
  .toUnordered()
  .forEach((width) => updateLayout(width));

// 4. 异步数据流
useWebSocket(socket)
  .filter((msg) => msg.type === "data")
  .map((msg) => JSON.parse(msg.data))
  .toUnordered()
  .forEach((data) => processData(data));
```

### ❌ 不推荐使用

```typescript
// 1. 简单操作 - 数组方法更直观
// 不好
useOf(arr).filter(x => x > 0).toUnordered().toArray();
// 更好
arr.filter(x => x > 0);

// 2. 需要多次访问同一数据
// 不好
const stream = useOf(data);
stream.filter(...).toUnordered().toArray();
stream.map(...).toUnordered().toArray(); // 重复计算
// 更好
const arr = data.filter(...);
arr.map(...);

// 3. 需要索引访问或修改
// 不好
useOf(arr).filter(...).toUnordered().toArray()[0];
// 更好
arr.find(...);
```

## 最佳实践

### ✅ 推荐：利用惰性求值

```typescript
// 只有在需要结果时才执行
const stream = useOf(largeDataset).filter(predicate).map(transformer);

// 稍后才决定如何使用
if (needAll) {
  stream.toUnordered().toArray();
} else if (needFirst) {
  stream.limit(1n).toUnordered().toArray();
} else if (needCount) {
  stream.toUnordered().count();
}
```

### ✅ 推荐：使用 limit 避免不必要的计算

```typescript
// 找到第一个满足条件的元素就停止
useOf(1, 2, 3, 4, 5 /* ... */)
  .filter((n) => n > 100)
  .limit(1n) // 提前终止
  .toUnordered()
  .toArray();
```

### ✅ 推荐：链式调用提高可读性

```typescript
useOf(data)
  .filter((item) => item.isActive)
  .map((item) => item.value)
  .distinct()
  .sorted()
  .toUnordered()
  .toArray();
```

### ❌ 避免：在循环中重复创建 Semantic

```typescript
// 不好：每次循环都创建新的 Semantic
for (let i = 0; i < 100; i++) {
  useOf(data).filter(predicate).toUnordered().toArray();
}

// 更好：创建一次，使用 Collector 的灵活性
const processed = useOf(data).filter(predicate).toUnordered().toArray();

for (let i = 0; i < 100; i++) {
  // 使用 processed
}
```
