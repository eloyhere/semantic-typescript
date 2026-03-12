# 重要使用规则

理解这些规则对于有效使用 Semantic-TypeScript 并避免常见陷阱至关重要。

## 规则 1：事件流必须限制

::: danger 危险
事件流（`useWindow`、`useDocument`、`useHTMLElement`、`useWebSocket`）**必须**使用限制操作来防止内存泄漏。
:::

### 为什么这很重要

事件监听器在显式移除之前一直保持活动状态。没有限制，您的应用程序将累积监听器并最终崩溃。

### 限制操作

对事件流使用以下操作之一：

#### `.limit(n)`

在 `n` 个元素后停止：

```typescript
useWindow("resize")
  .limit(5n) // ✅ 在 5 个事件后停止
  .toUnordered()
  .forEach(callback);
```

#### `.sub(start, end)`

处理从索引 `start` 到 `end` 的元素：

```typescript
useWindow("scroll")
  .sub(0n, 10n) // ✅ 处理前 10 个事件
  .toUnordered()
  .forEach(callback);
```

#### `.takeWhile(predicate)`

当谓词返回 true 时处理元素：

```typescript
useHTMLElement("#input", "keyup")
  .takeWhile((event) => !isSubmitDisabled()) // ✅ 提交禁用时停止
  .toUnordered()
  .forEach(callback);
```

### 没有限制的后果

```typescript
// ❌ 错误 - 内存泄漏！
useWindow("resize").toUnordered().forEach(callback);

// 监听器永远不会被移除
// 内存使用量无限增长
// 最终导致浏览器崩溃
```

### 事件流工厂

以下工厂返回 `AsynchronousSemantic` 并需要限制：

- `useWindow(eventName)`
- `useDocument(eventName)`
- `useHTMLElement(selector, eventName)`
- `useWebSocket(webSocket, messageName)`

## 规则 2：终结操作需要收集器

::: warning 重要
终结操作**仅在**转换为收集器**之后**可用。
:::

### 正确用法

```typescript
// ✅ 正确
useOf(1, 2, 3)
  .toUnordered() // 必需！
  .toArray();

// ✅ 正确
useOf(1, 2, 3)
  .toOrdered() // 也可以
  .toArray();
```

### 错误用法

```typescript
// ❌ 错误 - 属性 'toArray' 不存在
useOf(1, 2, 3).toArray();

// 必须先调用收集器
```

### 可用的收集器

根据您的需求选择正确的收集器：

| 收集器                   | 何时使用                 |
| ------------------------ | ------------------------ |
| `.toUnordered()`         | 性能至关重要，顺序不重要 |
| `.toOrdered()`           | 需要稳定排序或索引访问   |
| `.toNumericStatistics()` | 计算数字的统计数据       |
| `.toBigIntStatistics()`  | 计算 bigint 的统计数据   |
| `.toWindow(size)`        | 滑动/滚动窗口操作        |

### 终结操作

这些操作需要收集器：

- `.toArray()` - 收集到数组
- `.toSet()` - 收集到 Set
- `.toMap()` - 收集到 Map
- `.count()` - 计数元素
- `.summate()` - 求和
- `.average()` - 计算平均值
- `.min()` / `.max()` - 查找最小/最大值
- `.findFirst()` / `.findLast()` - 查找匹配元素
- `.reduce()` - 减少到单个值
- `.forEach()` - 使用副作用迭代
- `.log()` - 记录元素到控制台

## 规则 3：选择正确的语义类型

### 何时使用 SynchronousSemantic

用于静态数据、范围或立即迭代：

```typescript
// ✅ 静态数据
useFrom([1, 2, 3, 4, 5]);

// ✅ 范围
useRange(0n, 100n);

// ✅ 离散值
useOf("a", "b", "c");
```

### 何时使用 AsynchronousSemantic

用于事件、WebSocket 或长时间运行的操作：

```typescript
// ✅ DOM 事件
useWindow("resize");

// ✅ WebSocket
useWebSocket(socket, "message");

// ✅ HTML 元素
useHTMLElement("#input", "change");
```

## 规则 4：不可变操作

所有操作都返回新实例：

```typescript
const stream = useOf(1, 2, 3);
const mapped = stream.map((n) => n * 2);
const filtered = stream.filter((n) => n > 1);

// 原始流保持不变
// 每个操作都创建一个新的独立实例
```

## 规则 5：类型安全

尊重 TypeScript 的类型系统：

```typescript
// ✅ 类型安全的操作
useOf(1, 2, 3)
  .map((n: number): number => n * 2) // 显式类型
  .filter((n: number): boolean => n > 1)
  .toUnordered()
  .toArray();

// ❌ 类型错误将在编译时被捕获
useOf(1, 2, 3).map((n: string): string => n.toUpperCase()); // 错误！
```

## 检查清单

在生产环境中使用 Semantic-TypeScript 之前，请验证：

- [ ] 所有事件流都有限制操作
- [ ] 所有终结操作都在收集器之前
- [ ] 使用了适当的语义类型（同步 vs 异步）
- [ ] 操作尊重不可变性
- [ ] TypeScript 类型正确指定
