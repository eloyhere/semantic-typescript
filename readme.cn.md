# **Semantic‑TypeScript**
**流处理，索引化。** 让您的数据处于精准控制之下。

---

### 概述

Semantic‑TypeScript 代表了流处理领域的一次重大演进，它巧妙地**融合**了 JavaScript 生成器、Java Streams 和 MySQL 风格索引中最有效的范式。其核心理念强大而明确：通过智能索引而非传统的蛮力迭代，构建极其高效的数据处理管道。

传统的库通常强制使用同步循环或笨重的 Promise 链，而 Semantic‑TypeScript 则提供了一个**完全异步**、函数式纯正且类型绝对安全的体验，专为满足现代应用程序开发的需求而设计。

该模型体现了一种精炼的控制流：数据仅在上游管道显式调用 `accept` 回调时，才会传递给下游消费者。您可以对处理时机保持完全、细粒度的掌控——处理仅在需要时、且仅在要求的时刻发生。

---

### 开发者为何选择 Semantic‑TypeScript

-   **零模板索引** – 每个元素天生拥有其自然或自定义的索引，无需手动跟踪。
-   **纯函数式与类型安全** – 在支持不可变操作的同时，享受完整、地道的 TypeScript 类型推断。
-   **无泄漏的事件流** – `useSubscription` 模式将资源安全作为首要原则设计。您通过 `limit(n)`、`sub(start, end)` 或 `takeWhile(predicate)` 定义逻辑边界，库则管理完整的订阅生命周期，确保没有残留的监听器和内存泄漏。
-   **内置统计套件** – 无需外部依赖，即可访问针对 `number` 和 `bigint` 流的全面分析功能，包括平均值、中位数、众数、方差、偏度和峰度。
-   **可预测、可调优的性能** – 根据您对性能和顺序的精确需求，选择有序或无序收集器。
-   **天然的内存高效** – 流采用惰性求值，按需处理元素以减轻内存压力。
-   **无未定义行为** – TypeScript 保证完整的类型安全性和可空性。除非在回调函数中显式修改，否则您的源数据保持不变。

---

### 安装

使用您偏好的包管理器将 Semantic‑TypeScript 集成到项目中：

```bash
npm install semantic-typescript
```
或
```bash
yarn add semantic-typescript
```

---

### 快速入门

以下示例演示了从基础转换到实际事件处理的核心概念。

```typescript
import { useOf, useFrom, useRange, useSubscription, useText, useStringify } from "semantic-typescript";

// ====================================================================
// 示例 1: 基础操作与数值统计
// ====================================================================
// 演示映射和终端统计操作。转换后，管道必须转换为统计收集器才能调用 `.summate()` 等终端方法。

const numericSum: number = useOf(10, 20, 30, 40)
  .map((n: number): number => n * 2)        // 每个元素翻倍: [20, 40, 60, 80]
  .toNumericStatistics()                     // 转换为统计收集器
  .summate();                               // 终端操作: 200

// 其他统计方法（在 .toNumericStatistics() 后可用）:
// .average(), .median(), .mode(), .variance(), .skewness(), .kurtosis()

// ====================================================================
// 示例 2: BigInt 统计
// ====================================================================
// 与数值统计操作相同，但针对 BigInt 数据进行了优化。

const bigintSum: bigint = useOf(10n, 20n, 30n, 40n)
  .map((n: bigint): bigint => n * 2n)       // BigInt 算术
  .toBigIntStatistics()                      // 转换为 BigInt 统计收集器
  .summate();                                // 终端操作: 200n

// ====================================================================
// 示例 3: 通过索引操作实现流反转
// ====================================================================
// 使用 `.redirect()` 方法通过策略性地重新分配元素索引来说明如何重新排序元素，从而实现反转等自定义模式。

const reversedArray: number[] = useFrom([1, 2, 3, 4, 5])
  .redirect((_element: number, index: bigint): bigint => -index) // 映射到负索引
  .toOrdered()  // 关键步骤：按新索引收集并排序元素
  .toArray();   // 结果: [5, 4, 3, 2, 1]

// 对于简单的反转，`.reverse()` 方法同样可用。

// ====================================================================
// 示例 4: 流洗牌
// ====================================================================
// 使用原地洗牌算法随机置换元素索引。

const shuffledArray: number[] = useFrom([1, 2, 3, 4, 5])
  .shuffle()      // 随机重新分配索引
  .toOrdered()    // 按新的随机索引排序
  .toArray();     // 例如: [2, 5, 1, 4, 3] (每次执行结果不同)

// ====================================================================
// 示例 5: 循环流旋转
// ====================================================================
// 循环移动元素。正值向右旋转；负值向左旋转。

// 向右旋转 2 个位置
const rightRotated: number[] = useFrom([1, 2, 3, 4, 5])
  .translate(2)   // 将索引向右移动 2
  .toOrdered()
  .toArray();     // 结果: [4, 5, 1, 2, 3]

// ====================================================================
// 示例 6: 无限范围的惰性求值
// ====================================================================
// 惰性地处理理论上的无限流，仅在需要时计算元素。

const firstTenMultiples: bigint[] = useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)  // 保留 17 的倍数
  .limit(10n)                   // 关键：在第 10 个匹配项后停止
  .toUnordered()                // 不需要排序
  .toArray();                   // 结果: [0, 17, 34, 51, 68, 85, 102, 119, 136, 153]

// 没有 `.limit(10n)` 的话，管道将处理所有一百万个元素。

// ====================================================================
// 示例 7: 组合复杂管道
// ====================================================================
// 演示多个操作的顺序组合。

const complexResult: number[] = useRange(1n, 100n)
  .map(n => Number(n) * 2)
  .filter(n => n > 50)
  .shuffle()
  .limit(5n)
  .translate(2)
  .toOrdered()
  .toArray();

// ====================================================================
// 示例 8: 托管 DOM 事件订阅
// ====================================================================
// 监听浏览器事件，并附带自动、无泄漏的清理功能。
// `.limit(n)` 调用定义了自动移除监听器的边界。

// 为 Window 目标定义一个订阅者
const windowSubscriber = {
    mount: (target: Window): void => { /* 设置逻辑 */ },
    subscribe: (target: Window, event: keyof WindowEventMap, handler: EventListener): void => {
        target.addEventListener(event, handler);
    },
    unsubscribe: (target: Window, event: keyof WindowEventMap, handler: EventListener): void => {
        target.removeEventListener(event, handler);
    },
    unmount: (): void => { /* 清理逻辑 */ }
};

useSubscription(window, windowSubscriber, "resize")
  .limit(5n) // 5 个事件后自动取消订阅
  .toUnordered()
  .forEach((ev: Event, idx) =>
    console.log(`调整大小 #${idx}: ${(ev.target as Window).innerWidth}x${(ev.target as Window).innerHeight}`)
  );

// ====================================================================
// 示例 9: 按 Unicode 码点处理字符串
// ====================================================================
// 正确遍历字符串，处理多字节 Unicode 字符。

useText("My emotion now is: 😊, and semantic is 👍")
  .toUnordered()
  .log(); // 将每个字符（包括表情符号）在新行打印。

// ====================================================================
// 示例 10: 安全的循环引用字符串化
// ====================================================================
// 安全地序列化包含循环引用的对象。

const obj = {
  a: 1,
  b: "text"
};
(obj as any).c = [obj.a, obj.b, (obj as any).c]; // 引入循环引用

// const text: string = JSON.stringify(obj); // 抛出错误
const text: string = useStringify(obj); // 安全地产生 `{a: 1, b: "text", c: []}`
```

---

### 核心概念

| 概念 | 目的 | 主要使用场景 |
| :--- | :--- | :--- |
| `AsynchronousSemantic` | 用于异步流、事件和基于推送的惰性管道的核心构建器。 | 实时事件、WebSockets、DOM 监听器或任何长时间运行/无限流。 |
| `SynchronousSemantic` | 用于同步、内存中或基于拉取的急切流的构建器。 | 静态数据、有限范围或需要立即迭代的任务。 |
| `toUnordered()` | 最快的终端收集器，使用 Map 存储索引。 | 性能关键路径，且不需要稳定顺序的场景（O(n) 时间和空间）。 |
| `toOrdered()` | 有序、索引稳定的终端收集器。 | 当需要保持元素顺序或需要索引访问时。 |
| `toNumericStatistics()` | 启用对 `number` 流进行丰富统计分析功能的收集器。 | 数据分析、指标和统计计算。 |
| `toBigIntStatistics()` | 启用对 `bigint` 流进行丰富统计分析功能的收集器。 | 大型整数数据集的分析和统计。 |
| `toWindow()` | 提供对流进行滑动和滚动窗口操作的功能。 | 时间序列分析、批处理和窗口聚合。 |

---

**基本使用规则**

1.  **事件流**（通过 `useSubscription` 等工厂函数创建）返回一个 `AsynchronousSemantic`。
    → 您**必须**调用一个定义边界的方法，如 `.limit(n)`、`.sub(start, end)` 或 `.takeWhile(predicate)` 来终止监听器。否则订阅将保持活动状态。

2.  **终端操作**（`.toArray()`、`.count()`、`.forEach()`、`.findFirst()` 等）**仅在**将管道转换为收集器**之后**可用：
    ```typescript
    .toUnordered()   // 用于最大速度，不保证顺序。
    // 或
    .toOrdered()     // 用于稳定、有序的输出。
    // 或
    .toNumericStatistics() // 用于统计方法。
    ```

---

### 性能特征

| 收集器 | 时间复杂度 | 空间复杂度 | 保证顺序？ | 理想场景 |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | O(n) | O(n) | 否 | 原始吞吐量是关键；最终顺序无关紧要。 |
| `toOrdered()` | O(n log n) | O(n) | 是（已排序） | 需要稳定顺序、索引访问或为统计进行预排序。 |
| `toNumericStatistics()` | O(n log n) | O(n) | 是（内部排序） | 执行需要排序数据的统计操作。 |
| `toBigIntStatistics()` | O(n log n) | O(n) | 是（内部排序） | 对 BigInt 数据进行统计操作。 |
| `toWindow()` | O(n log n) | O(n) | 是（内部排序） | 能从排序索引中受益的窗口操作。 |

当绝对速度至关重要时，选择 `toUnordered()`。仅当您的逻辑依赖于元素顺序时，才选择 `toOrdered()` 或统计收集器。

---

**与现代流处理库的对比分析**

| 特性 | Semantic‑TypeScript | RxJS | 原生 Async Iterators / Generators | Most.js |
| :--- | :--- | :--- | :--- | :--- |
| **TypeScript 集成** | 一等公民，深度类型化，具有固有的索引感知。 | 优秀，但通常涉及复杂的泛型链。 | 良好，但需要手动类型注解。 | 强大，采用函数优先的编码风格。 |
| **内置统计分析** | 对 `number` 和 `bigint` 提供全面的原生支持。 | 非原生支持（需要自定义操作符或其他库）。 | 无。 | 无。 |
| **索引与位置感知** | 原生、强大的 BigInt 索引，每个元素都具备。 | 需要自定义操作符（如 `scan`、`withLatestFrom`）。 | 需要手动管理计数器。 | 基础，无内置索引属性。 |
| **事件流管理** | 专用的、类型安全的工厂，具有显式、声明式的生命周期控制。 | 强大，但需要谨慎的手动订阅管理以防止泄漏。 | 手动事件监听器附加和取消令牌管理。 | 良好的 `fromEvent`，通常较轻量。 |
| **性能与内存** | 卓越 – 提供优化的 `toUnordered()` 和 `toOrdered()` 收集器。 | 非常好，但深度操作符链可能引入开销。 | 优秀（最小的原生开销）。 | 优秀。 |
| **包体积** | 非常轻量。 | 较大（即使有 tree-shaking）。 | 零（原生语言特性）。 | 小。 |
| **API 设计理念** | 具有显式索引语义的函数式收集器模式。 | 响应式 Observable 模式。 | 命令式 Iterator / 声明式 Generator 模式。 | 函数式、无点组合。 |
| **流控制** | 显式（`interrupt`、`.limit()`、`.takeWhile()`、`.sub()`）。 | 良好（`take`、`takeUntil`、`first`）。 | 手动（循环中的 `break`）。 | 良好（`take`、`until`）。 |
| **同步与异步支持** | 统一的 API – 对两种范式都提供一等公民支持。 | 主要面向异步。 | 两者都支持，但需要手动桥接。 | 主要面向异步。 |
| **学习曲线** | 对于熟悉函数式和索引集合管道的开发者来说较平缓。 | 较陡峭（大量的操作符词汇、热/冷 Observable 概念）。 | 低到中等。 | 中等。 |

**Semantic‑TypeScript 的优势**

*   **独特能力：** 集成的统计和索引功能，无需手动 `reduce` 操作或辅助的数据分析库。
*   **可预测的资源管理：** 对事件流的显式控制，防止了 RxJS 应用中可能出现的微妙内存泄漏。
*   **统一设计：** 同步和异步工作流采用一致的 API，减少了认知负担和代码重复。

此对比凸显了为何 Semantic‑TypeScript 特别适合需要高性能、健壮的类型安全性和丰富数据处理功能，而又不希望引入传统响应式框架复杂性的现代 TypeScript 应用程序。

---

### 开始探索

Semantic‑TypeScript 将复杂的数据流转化为可读、可组合且高性能的管道。无论您是在处理实时 UI 事件、处理大量数据集，还是构建分析仪表板，它都能提供数据库级索引的强大功能与函数式编程的优雅。

**您的后续步骤：**

*   直接在您的 IDE 中探索完全类型化的 API（所有导出都可在主包入口点找到）。
*   加入不断壮大的开发者社区，他们已用清晰、有意的 Semantic 管道替代了复杂的异步迭代器和响应式链。

**Semantic‑TypeScript** – 流与结构的交汇点。

立即开始构建，体验深思熟虑的索引设计所带来的切实差异。

**清晰构建，自信前行，以意图驱动数据转换。**

MIT © Eloy Kim