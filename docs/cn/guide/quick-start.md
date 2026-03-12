# 快速开始

几分钟内即可上手 Semantic-TypeScript。

## 基本导入

```typescript
import {
  useOf,
  useFrom,
  useRange,
  useWindow,
  useHTMLElement,
  useWebSocket,
  useText,
  useStringify
} from "semantic-typescript";
```

## 数值统计

```typescript
let summate: number = useOf(10, 20, 30, 40)
  .map((n: number): number => n * 2)
  .toNumericStatistics()  // 终结操作前必需
  .summate();             // 200
```

## BigInt 统计

```typescript
let summate: bigint = useOf(10n, 20n, 30n, 40n)
  .map((n: bigint): bigint => n * 2)
  .toBigIntStatistics()   // 终结操作前必需
  .summate();             // 200n
```

## 通过索引反转流

```typescript
useFrom([1, 2, 3, 4, 5])
  .redirect((element: E, index: bigint): bigint => -index)
  .toOrdered()
  .toArray(); // [5, 4, 3, 2, 1]
```

## 打乱流

```typescript
useFrom([1, 2, 3, 4, 5])
  .shuffle()
  .toOrdered()
  .toArray(); // 例如：[2, 5, 1, 4, 3]
```

## 平移元素

```typescript
// 向右移动 2 位
useFrom([1, 2, 3, 4, 5])
  .translate(2)
  .toOrdered()
  .toArray(); // [4, 5, 1, 2, 3]

// 向左移动 2 位
useFrom([1, 2, 3, 4, 5])
  .translate(-2)
  .toOrdered()
  .toArray(); // [3, 4, 5, 1, 2]
```

## 无限范围与提前终止

```typescript
useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)
  .limit(10n)
  .toUnordered()
  .toArray();
```

## 窗口事件

::: warning 重要
事件流**必须**使用限制操作来防止内存泄漏！
:::

```typescript
useWindow("resize")
  .limit(5n)          // 对事件流至关重要
  .toUnordered()
  .forEach((ev, idx) => console.log(`调整大小 #${idx}`));
```

## HTML 元素事件

```typescript
// <input id="input" type="text"/>
useHTMLElement("#input", "change")
  .limit(1)
  .toUnordered()
  .forEach((event: Event) => submit(event));
```

## 多个元素和事件

```typescript
useHTMLElement("input", ["change", "keyup"])
  .takeWhile((event: Event): boolean => validate(event))
  .toUnordered()
  .forEach((event: Event) => submit(event));
```

## WebSocket

```typescript
let webSocket = new WebSocket("ws://localhost:8080");
webSocket.addEventListener("close", (): void => {
  webSocket.close();
});
useWebSocket(webSocket, "message")
  .limit(1)
  .toUnordered()
  .forEach((message: MessageEvent) => console.log(message.data));
```

## 字符串迭代

```typescript
useText("我的情绪现在是：😊，semantic 是：👍")
  .toUnordered()
  .log();
```

## 安全字符串化

```typescript
let o = {
  a: 1,
  b: "text",
  c: [o.a, o.b, o.c] // 循环引用
};

// JSON.stringify(o) 会抛出错误
let text: string = useStringify(o);
// 安全地生成 `{a: 1, b: "text", c: []}`
```

## 下一步

- [核心概念](./core-concepts.md) - 学习核心概念
- [重要规则](./important-rules.md) - 了解关键使用规则
- [性能特征](./performance.md) - 学习性能特征
