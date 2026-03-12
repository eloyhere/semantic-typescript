# 推拉模式

理解 Semantic-TypeScript 如何通过"中断信号"机制统一推（Push）与拉（Pull）两种数据流模式。

## 什么是推模式与拉模式？

### 推模式（Push）

**定义**：数据源掌控主动权，当新数据产生时，主动"推"给消费者。

**特点**：

- 数据源主动发送数据
- 消费者被动接收
- 无法控制数据到达的节奏

**典型场景**：

```typescript
// DOM 事件 - 浏览器主动推送事件
window.addEventListener("resize", (event) => {
  console.log("窗口大小改变了");
});

// WebSocket - 服务器主动推送消息
socket.addEventListener("message", (event) => {
  console.log("收到消息:", event.data);
});
```

**问题**：资源管理困难

- 何时该停止监听？
- 忘记移除监听器 → 内存泄漏
- 监听器生命周期不明确

---

### 拉模式（Pull）

**定义**：消费者掌控主动权，按需从数据源"拉"取数据。

**特点**：

- 消费者主动请求数据
- 完全控制数据节奏
- 可以随时停止拉取

**典型场景**：

```typescript
// 数组遍历 - 消费者控制遍历节奏
const arr = [1, 2, 3, 4, 5];
for (const item of arr) {
  console.log(item); // 消费者决定何时处理下一个
  if (item === 3) break; // 可以随时停止
}

// Generator 函数
function* numbers() {
  yield 1;
  yield 2;
  yield 3;
}

const gen = numbers();
console.log(gen.next().value); // 消费者主动拉取
console.log(gen.next().value);
```

**优势**：

- 资源管理清晰
- 消费者完全控制
- 无内存泄漏风险

---

## 困境：推与拉的冲突

现实世界中的数据源大多是**推模式**的：

- DOM 事件
- WebSocket 消息
- 定时器
- 用户交互

但我们的业务逻辑往往需要**拉模式**的控制力：

- "我只需要前 10 个消息"
- "我只在条件满足时接收"
- "处理完这批就停止"

**传统方案的妥协：**

```typescript
// ❌ 不够优雅：手动管理监听器
const handler = (event) => {
  console.log(event);
  if (shouldStop) {
    element.removeEventListener("type", handler); // 容易忘记
  }
};
element.addEventListener("type", handler);

// ❌ 认知负荷：RxJS 的热/冷 Observable
observable.pipe(take(5)).subscribe({
  next: (value) => console.log(value),
  // 需要理解订阅、取消、热/冷等概念
});
```

---

## Semantic-TypeScript 的解决方案：双向信号通道

Semantic-TypeScript 不试图掩盖推拉模式的差异，而是建立一套**严谨的协议**让它们和谐共处。

### 核心设计：AsynchronousGenerator

```typescript
type AsynchronousGenerator<E> = (
  accept: (element: E, index: bigint) => void, // 通道1：推数据
  interrupt: (element: E, index: bigint) => boolean // 通道2：拉中断信号
) => Promise<void>;
```

这是一个**精妙的双向通道**设计：

#### 1. 推送通道 (`accept`) - 从源到消费者

```typescript
useWebSocket(socket, "message")
  .limit(5) // 消费者声明：只要 5 个
  .toUnordered()
  .forEach((msg, idx) => console.log(`第 ${idx} 条:`, msg));
```

**工作流程：**

1. WebSocket 收到消息
2. 工厂函数调用 `accept(message, index)` 推送数据
3. 数据沿管道向下流动
4. 最终到达 `forEach` 回调

#### 2. 拉取通道 (`interrupt`) - 从消费者到源

```typescript
useWebSocket(socket, "message")
  .limit(5) // ← 关键：具有"决断力"的操作符
  .toUnordered()
  .forEach((msg, idx) => console.log(msg));
```

**工作流程：**

1. 每次准备推送数据前，工厂函数先调用 `interrupt(event, index)`
2. 向下游"询问"："我可以推送这个数据吗？"
3. `limit(5)` 在第 5 个数据后，返回 `true`
4. `true` 信号逆流而上，直达 `useWebSocket`
5. 工厂函数收到 `true`，立即清理资源

---

### 完整的生命周期

```typescript
useWebSocket(socket, "message")
  .filter((msg) => msg.type === "data")
  .limit(5)
  .toUnordered()
  .forEach((msg) => processMessage(msg));
```

**1. 创建阶段**

```typescript
// 工厂函数被调用，但尚未开始监听
const generator = useWebSocket(socket, "message");
```

**2. 订阅阶段**

```typescript
// 调用 forEach 开始执行
generator.toUnordered().forEach(callback);
// ↓
// 工厂函数内部：
// socket.addEventListener("message", handler);  // 开始监听
```

**3. 数据推送阶段**

```typescript
// WebSocket 收到消息
socket.onmessage = (event) => {
  // 先询问：可以推送吗？
  const shouldStop = interrupt(event, index);
  if (shouldStop) return; // 下游说停止，不推送

  // 可以推送，通过 accept 通道发送
  accept(event, index); // 数据流向下游
};
```

**4. 中断阶段**

```typescript
// 第 5 个消息后，limit(5) 决定停止
interrupt(event, 5n); // → 返回 true
// ↓
// 信号逆流而上到工厂函数
// ↓
socket.removeEventListener("message", handler); // 清理监听器
promise.resolve(); // 标记任务完成
```

---

## 为何需要"拉取中断信号"？

### 问题的本质

在推送模型中，数据源（上游）**不知道**消费者（下游）何时满足：

- `WebSocket` 会一直有消息
- `window` 会一直触发 `resize` 事件

如果只靠下游被动等待 Promise 结束：

- 上游永远无法自行决定停止
- 监听器永远悬挂
- 资源永远泄漏

### 解决方案：主动权归下游

**"何时停止"的决定权必须交给业务逻辑：**

```typescript
// 业务逻辑声明需求
useWebSocket(socket, "message")
  .limit(5) // "我要 5 个"
  .takeWhile((msg) => msg.isValid) // "只要有效的"
  .toUnordered()
  .forEach((msg) => processMessage(msg));
```

这些操作符将业务需求翻译成中断信号：

- `.limit(5)` → 第 5 个后返回 `true`
- `.takeWhile(predicate)` → 条件为 `false` 时返回 `true`
- `.sub(start, end)` → 超出范围时返回 `true`

### 一个形象的比喻

> 上游（事件源）是一个不知疲倦的送水工，不断地从井里打水（事件）。
> 下游（业务）是一个用水户。
>
> 仅仅用水户在家里等着（Promise），送水工不会知道该送多少。
>
> 于是，我们在两家之间装了一个**红色的门铃（interrupt 通道）**。
>
> 送水工每次送水前，都先按一下门铃问："还要水吗？"
>
> - 用户说"要"（返回 `false`），他就送一桶
> - 直到用户说"够了！"（返回 `true`），送水工立刻停止工作回家
>
> 这个"问"的动作，就是**"拉取中断信号"**。

---

## 同步与异步：统一的抽象

### 同步流：瞬间的拉取

```typescript
type SynchronousGenerator<E> = (
  accept: (element: E, index: bigint) => void,
  interrupt: (element: E, index: bigint) => boolean
) => void; // 注意：没有 Promise
```

**特点：**

- 处理有限、同步的数据源（Array、Range、Iterable）
- 上游在开始时就已知终点
- 通过循环条件自然停止
- 整个过程是同步、瞬时的

```typescript
useOf(1, 2, 3, 4, 5).limit(3).toUnordered().toArray(); // → [1, 2, 3]
```

**执行过程：**

```
for (let i = 0; i < 5; i++) {
  if (interrupt(i, i)) break;  // 第 3 次返回 true，停止
  accept(i, i);  // 否则推送
}
```

### 异步流：持续的、可中断的订阅

```typescript
type AsynchronousGenerator<E> = (
  accept: (element: E, index: bigint) => void,
  interrupt: (element: E, index: bigint) => boolean
) => Promise<void>; // 有 Promise
```

**特点：**

- 处理无限、异步的数据源（WebSocket、DOM 事件）
- 上游不知道何时会有数据、何时结束
- 通过 `interrupt` 信号主动停止
- 需要 Promise 协调异步生命周期

```typescript
useWindow("resize")
  .limit(5)
  .toUnordered()
  .forEach((ev, idx) => console.log(`第 ${idx} 次调整`));
```

**执行过程：**

```
// 订阅开始
window.addEventListener("resize", handler);

// 每次 resize 事件
handler = (event) => {
  if (interrupt(event, index++)) {
    // 第 5 次，返回 true
    window.removeEventListener("resize", handler);  // 清理
    promise.resolve();  // 完成
    return;
  }
  accept(event, index);  // 否则推送
};
```

### 设计哲学：统一的使用体验

**对使用者：** 统一的 API，无需关心同步还是异步

```typescript
// 完全相同的使用方式
useOf(1, 2, 3).map(f).filter(p).limit(n).toArray();
useWindow("event").map(f).filter(p).limit(n).toArray();
```

**在内部：** 两种精确的类型，适配不同的世界模型

| 特性     | 同步流     | 异步流           |
| -------- | ---------- | ---------------- |
| 数据源   | 有限、已知 | 无限、未知       |
| 控制方式 | 循环条件   | interrupt 信号   |
| 生命周期 | 瞬时       | Promise 协调     |
| 资源管理 | 自动       | 自动（中断触发） |

---

## 实战示例

### 示例 1：限制 WebSocket 消息数量

```typescript
useWebSocket(socket, "message")
  .limit(10) // 只要 10 条消息
  .toUnordered()
  .forEach((msg) => {
    console.log("收到:", msg);
    // 第 10 条后，自动清理监听器
  });
```

**执行过程：**

1. WebSocket 收到第 1-10 条消息 → 通过 `accept` 推送
2. 收到第 11 条消息前 → 调用 `interrupt`，返回 `true`
3. 工厂函数收到 `true` → 移除监听器，解决 Promise

### 示例 2：条件性接收事件

```typescript
useWindow("scroll")
  .takeWhile(() => !userScrolledToBottom) // 滚动到底部就停止
  .toUnordered()
  .forEach((event) => {
    console.log("滚动中...");
  });
```

**执行过程：**

1. 每次 scroll 事件 → 调用 `interrupt` 检查条件
2. `userScrolledToBottom` 为 `false` → 继续推送
3. `userScrolledToBottom` 为 `true` → 返回 `true`，停止监听

### 示例 3：组合多个限制条件

```typescript
useWebSocket(socket, "message")
  .filter((msg) => msg.type === "data") // 只要 data 类型
  .sub(0n, 100n) // 索引在 0-100 之间
  .limit(50) // 最多 50 条
  .toUnordered()
  .forEach((msg) => processMessage(msg));
```

**中断逻辑：**

- 类型不是 `data` → `filter` 不推送，但不中断
- 索引超出 0-100 → `sub` 返回 `true`，中断
- 已推送 50 条 → `limit` 返回 `true`，中断

---

## 最佳实践

### ✅ 推荐：始终使用限制操作

```typescript
// 事件流必须使用 limit/sub/takeWhile 防止内存泄漏
useWindow("resize")
  .limit(10n) // 必须！
  .toUnordered()
  .forEach(callback);

useHTMLElement("#input", "input")
  .takeWhile(() => formValid) // 必须！
  .toUnordered()
  .forEach(callback);
```

### ✅ 推荐：明确声明需求

```typescript
// 清晰：我要 100 条以内的有效消息
useWebSocket(socket, "message")
  .filter((msg) => msg.isValid)
  .limit(100)
  .toUnordered()
  .forEach(handler);
```

### ❌ 避免：忘记限制事件流

```typescript
// 危险：内存泄漏！
useWindow("resize").toUnordered().forEach(callback); // 永远不会停止

// 正确：添加限制
useWindow("resize")
  .limit(100n) // 或其他合理的限制
  .toUnordered()
  .forEach(callback);
```

### ❌ 避免：手动管理监听器

```typescript
// 不推荐：手动管理（容易出错）
const handler = (event) => {
  /* ... */
};
element.addEventListener("event", handler);
// ... 忘记移除

// 推荐：让框架管理
useHTMLElement(element, "event").limit(1).toUnordered().forEach(handler); // 自动清理
```

---

## 背压机制

### 什么是背压？

**背压（Backpressure）** 是一种流量控制机制，用于在**生产者速度快于消费者处理速度**时，防止系统过载、内存溢出或资源耗尽。

在推送模型中，数据源（生产者）可以快速产生大量数据：

- WebSocket 每秒接收数千条消息
- 鼠标移动事件每秒触发数十次
- 定时器按固定节奏持续触发

如果消费者处理速度跟不上：

- **消息堆积** → 内存占用不断增长
- **处理延迟** → 响应越来越慢
- **系统崩溃** → 最终内存溢出或浏览器卡死

### 背压的解决思路

> 🎯 **核心原则**：让消费者告诉生产者"慢下来"或"停下来"

传统方案的问题：

```typescript
// ❌ 无背压：消息不断堆积
const messages: MessageEvent[] = [];
socket.addEventListener("message", (event) => {
  messages.push(event); // 无限制堆积
});
// messages 可能增长到数万条，导致内存溢出

// ❌ 手动背压：容易出错
let processing = false;
socket.addEventListener("message", async (event) => {
  if (processing) return; // 丢弃消息？丢失数据！
  processing = true;
  await processMessage(event);
  processing = false;
});
```

---

## Semantic-TypeScript 的背压实现

Semantic-TypeScript 通过 **`interrupt` 信号通道** 实现了**自动背压控制**：

### 1. 基于缓冲区的背压

```typescript
useWebSocket(socket, "message")
  .buffer(100) // 最多缓冲 100 条消息
  .toUnordered()
  .forEach(async (msg) => {
    await slowProcessing(msg); // 慢速处理
  });
```

**工作原理：**

1. `buffer(100)` 在内部维护一个固定大小的队列（最多 100 条）
2. 当队列满时，`interrupt` 返回 `true`，暂停接收新消息
3. 当消费者处理完一条，队列腾出空间，继续接收
4. **结果**：内存占用恒定，不会无限增长

### 2. 基于处理的背压

```typescript
useWebSocket(socket, "message")
  .toUnordered()
  .forEach(async (msg) => {
    // forEach 内部自动实现背压
    await processMessage(msg); // 每次只处理一条
  });
```

**背压机制：**

- `forEach` 等待当前消息处理完成后，才允许下一条消息通过 `accept` 推送
- 上游收到"正在处理"的信号，暂停推送
- **结果**：天然背压，每条消息处理完才接收下一条

### 3. 基于节流的背压

```typescript
useWindow("resize")
  .throttle(100) // 每 100ms 最多处理一次
  .toUnordered()
  .forEach((event) => {
    updateLayout(event);
  });
```

**背压机制：**

- `throttle(100)` 限制处理频率
- 在 100ms 内的后续事件，`interrupt` 返回 `true`，丢弃
- **结果**：控制处理速率，避免过度计算

---

## 实战示例

### 示例 1：高速消息流背压

**场景**：WebSocket 每秒接收 1000 条消息，但处理函数每条需要 50ms

```typescript
// ❌ 没有背压：灾难
useWebSocket(socket, "message")
  .toUnordered()
  .forEach(async (msg) => {
    await processMessage(msg); // 每秒只能处理 20 条
  });
// 结果：消息堆积 → 内存爆炸

// ✅ 有背压：安全
useWebSocket(socket, "message")
  .buffer(50) // 最多缓冲 50 条
  .toUnordered()
  .forEach(async (msg) => {
    await processMessage(msg);
  });
// 结果：
// - 队列最多 50 条，内存可控
// - 生产者暂停，等待队列有空位
// - 不会丢失数据（在缓冲区范围内）
```

### 示例 2：事件节流背压

**场景**：鼠标移动事件每秒触发 60 次，但 UI 更新很昂贵

```typescript
// ✅ 使用 throttle 实现背压
useWindow(document, "mousemove")
  .throttle(50) // 每 50ms 最多一次（20 FPS）
  .map((event) => ({ x: event.clientX, y: event.clientY }))
  .toUnordered()
  .forEach((pos) => {
    updateCursor(pos); // 昂贵的 UI 更新
  });
```

**背压效果：**

- 每秒 60 次事件 → 降低到每秒 20 次
- 节省 66% 的计算资源
- 用户体验仍然流畅

### 示例 3：防抖背压

**场景**：搜索框输入，每次按键触发搜索请求

```typescript
// ✅ 使用 debounce 实现背压
useHTMLElement(input, "input")
  .debounce(300) // 停止输入 300ms 后才触发
  .map((event) => event.target.value)
  .filter((query) => query.length >= 2)
  .toUnordered()
  .forEach((query) => {
    fetchSearchResults(query);
  });
```

**背压效果：**

- 用户快速输入 "hello"（5 个按键）
- 只触发 1 次搜索，而非 5 次
- 节省 80% 的网络请求

### 示例 4：窗口滑动背压

**场景**：批量处理高速数据流，避免逐条处理开销

```typescript
// ✅ 使用 window 实现批量背压
useWebSocket(socket, "message")
  .window(100, 1000) // 每 100 条或 1 秒，批量处理
  .toUnordered()
  .forEach(async (batch) => {
    // 批量处理：一次性处理 100 条
    await bulkInsert(batch);
  });
```

**背压效果：**

- 单条处理 → 批量处理（性能提升 10-100 倍）
- 降低数据库/网络压力
- 减少请求往返次数

---

## 背压操作符速查

| 操作符                  | 背压类型   | 使用场景             |
| ----------------------- | ---------- | -------------------- |
| `.buffer(size)`         | 缓冲区背压 | 限制内存中的消息数量 |
| `.throttle(ms)`         | 频率背压   | 限制处理频率         |
| `.debounce(ms)`         | 延迟背压   | 等待静默后才处理     |
| `.window(size, slide)`  | 批量背压   | 批量处理提升性能     |
| `.limit(count)`         | 数量背压   | 只处理固定数量后停止 |
| `.takeWhile(predicate)` | 条件背压   | 满足条件时才处理     |

---

## 背压最佳实践

### ✅ 推荐：始终考虑背压

```typescript
// 高速事件流 + 慢速处理 → 必须有背压
useWebSocket(socket, "message")
  .buffer(100) // ✅ 防止内存爆炸
  .toUnordered()
  .forEach(handler);

// 高频触发 + 昂贵操作 → 必须有背压
useWindow("resize")
  .throttle(100) // ✅ 降低更新频率
  .toUnordered()
  .forEach(handler);
```

### ✅ 推荐：选择合适的背压策略

```typescript
// 场景 1：内存受限 → 使用 buffer
useWebSocket(socket, "message")
  .buffer(50) // 固定内存占用
  .forEach(handler);

// 场景 2：性能受限 → 使用 throttle
useWindow("scroll")
  .throttle(50) // 降低更新频率
  .forEach(handler);

// 场景 3：需要最终结果 → 使用 debounce
useHTMLElement(input, "input")
  .debounce(300) // 等待用户停止输入
  .forEach(handler);
```

### ✅ 推荐：监控背压状态

```typescript
let bufferFullCount = 0;

useWebSocket(socket, "message")
  .buffer(100, {
    onFull: () => {
      bufferFullCount++;
      console.warn(`缓冲区已满，丢弃 ${bufferFullCount} 条消息`);
    },
  })
  .toUnordered()
  .forEach(handler);
```

### ❌ 避免：没有背压的高速流

```typescript
// 危险：WebSocket 高速消息流
useWebSocket(socket, "message")
  .toUnordered()
  .forEach(async (msg) => {
    await slowProcess(msg); // 太慢！
  });
// → 消息堆积 → 内存溢出

// 危险：高频事件流
useWindow("mousemove")
  .toUnordered()
  .forEach((event) => {
    expensiveUpdate(event); // 太昂贵！
  });
// → 卡顿、掉帧
```

---

## 背压 vs 其他方案对比

| 方案              | 优点                   | 缺点                   | 适用场景             |
| ----------------- | ---------------------- | ---------------------- | -------------------- |
| **Semantic 背压** | 自动、类型安全、零配置 | 需要学习操作符         | 所有 TypeScript 项目 |
| **RxJS 背压**     | 功能强大、操作符丰富   | 学习曲线陡峭、包体积大 | 复杂流处理           |
| **手动背压**      | 完全控制               | 易错、代码冗长         | 特殊需求             |
| **无背压**        | 简单                   | 内存泄漏、性能崩溃     | ❌ 不推荐            |

---

## 总结

### 背压的核心价值

**"资源的确定性"** + **"流量的可控性"**

| 问题           | Semantic 方案                  |
| -------------- | ------------------------------ |
| 内存无限增长   | `buffer(size)` 限制缓冲区      |
| 处理速度跟不上 | `forEach` 自动等待             |
| 事件频率过高   | `throttle`/`debounce` 降低频率 |
| 性能瓶颈       | `window` 批量处理              |

### 设计哲学

> 你不需要手动管理流量，只需声明你的需求：
>
> - "我要限制缓冲区大小" → `.buffer(100)`
> - "我要控制处理频率" → `.throttle(50)`
> - "我要批量处理" → `.window(100)`
>
> 框架自动处理背压，你只需关注业务逻辑。

---

## 总结

### 推与拉的和谐

在 Semantic-TypeScript 的设计下，**推与拉没有冲突，只有合作**：

1. **推的方向（数据）**：通过 `accept` 回调，让数据顺畅流动
2. **拉的方向（控制）**：通过 `interrupt` 回调，将控制权交还给业务逻辑
3. **协调的媒介**：`Promise<void>` 标记异步流的完整生命周期

### 设计目标

**"资源的确定性"** + **"意图的明确性"**

| 方面     | 你声明                  | 框架保障                 |
| -------- | ----------------------- | ------------------------ |
| 数据量   | `.limit(5)`             | 精确接收 5 个后停止      |
| 接收条件 | `.takeWhile(predicate)` | 条件为 `false` 时停止    |
| 数据范围 | `.sub(start, end)`      | 超出范围时停止           |
| 资源清理 | 自动                    | 移除监听器、解决 Promise |

### 核心价值

你以**"拉"的掌控力**，去安全、优雅地驾驭那个充满**"推"**的异步世界。

- 你声明"要什么" → 业务逻辑清晰
- 框架保障"如何做" → 资源管理自动
- 永远不需要手动调用 `removeEventListener`

---
