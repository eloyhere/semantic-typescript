# Type Guards

运行时类型检查函数，提供 TypeScript 类型窄化支持。

## 基本类型

## isBoolean

`isBoolean(target: unknown): target is boolean`

检查值是否为布尔类型。

```typescript
if (isBoolean(value)) {
  // value 的类型被窄化为 boolean
}
```

## isString

`isString(target: unknown): target is string`

检查值是否为字符串（非空）。

## isNumber

`isNumber(target: unknown): target is number`

检查值是否为有效数字（非 NaN）。

## isBigInt

`isBigInt(target: unknown): target is bigint`

检查值是否为 bigint。

## isSymbol

`isSymbol(target: unknown): target is symbol`

检查值是否为 symbol。

## isFunction

`isFunction(target: unknown): target is Function`

检查值是否为函数。

## isObject

`isObject(target: unknown): target is object`

检查值是否为非 null 对象。

## isPrimitive

`isPrimitive(target: unknown): target is Primitive`

检查值是否为原始类型。

## 集合类型守卫

## isIterable

`isIterable(target: unknown): target is Iterable<unknown>`

检查值是否为可迭代对象。

```typescript
if (isIterable(value)) {
  for (const item of value) {
    // 处理每个项
  }
}
```

## isAsyncIterable

`isAsyncIterable(target: unknown): target is AsyncIterable<unknown>`

检查值是否为异步可迭代对象。

```typescript
if (isAsyncIterable(value)) {
  for await (const item of value) {
    // 处理每个项
  }
}
```

## isPromise

`isPromise(target: unknown): target is Promise<unknown>`

检查值是否为 Promise。

```typescript
if (isPromise(value)) {
  value.then((result) => console.log(result));
}
```

## 函数类型守卫

## isAsyncFunction

`isAsyncFunction(target: unknown): target is AsyncFunction`

检查值是否为异步函数。

## isGeneratorFunction

`isGeneratorFunction(target: unknown): target is Generator<unknown, unknown, unknown>`

检查值是否为生成器函数。

## isAsyncGeneratorFunction

`isAsyncGeneratorFunction(target: unknown): target is AsyncGenerator<unknown, unknown, unknown>`

检查值是否为异步生成器函数。

## Semantic 类型守卫

## isAsynchronousSemantic

`isAsynchronousSemantic(target: unknown): target is AsynchronousSemantic<unknown>`

检查值是否为 `AsynchronousSemantic`。

```typescript
if (isAsynchronousSemantic(value)) {
  // value 是 AsynchronousSemantic
}
```

## isSynchronousSemantic

`isSynchronousSemantic(target: unknown): target is SynchronousSemantic<unknown>`

检查值是否为 `SynchronousSemantic`。

## isAsynchronousCollectable

`isAsynchronousCollectable(target: unknown): target is AsynchronousSemantic<unknown>`

检查值是否为任何异步可收集类型。

## isSynchronousCollectable

`isSynchronousCollectable(target: unknown): target is SynchronousSemantic<unknown>`

检查值是否为任何同步可收集类型。

## 收集器类型守卫

## isAsynchronousUnorderedCollectable

`isAsynchronousUnorderedCollectable(target: unknown): target is AsynchronousUnorderedCollectable<unknown>`

检查值是否为异步无序可收集类型。

## isSynchronousUnorderedCollectable

`isSynchronousUnorderedCollectable(target: unknown): target is SynchronousUnorderedCollectable<unknown>`

检查值是否为同步无序可收集类型。

## isAsynchronousOrderedCollectable

`isAsynchronousOrderedCollectable(target: unknown): target is AsynchronousOrderedCollectable<unknown>`

检查值是否为异步有序可收集类型。

## isSynchronousOrderedCollectable

`isSynchronousOrderedCollectable(target: unknown): target is SynchronousOrderedCollectable<unknown>`

检查值是否为同步有序可收集类型。

## 统计类型守卫

## isAsynchronousStatistics

`isAsynchronousStatistics(target: unknown): target is AsynchronousStatistics<unknown, number | bigint>`

检查值是否为异步统计收集器。

## isSynchronousStatistics

`isSynchronousStatistics(target: unknown): target is SynchronousStatistics<unknown, number | bigint>`

检查值是否为同步统计收集器。

## isAsynchronousNumericStatistics

`isAsynchronousNumericStatistics(target: unknown): target is AsynchronousNumericStatistics<unknown>`

检查值是否为异步数值统计收集器。

## isSynchronousNumericStatistics

`isSynchronousNumericStatistics(target: unknown): target is SynchronousNumericStatistics<unknown>`

检查值是否为同步数值统计收集器。

## isAsynchronousBigIntStatistics

`isAsynchronousBigIntStatistics(target: unknown): target is AsynchronousBigIntStatistics<unknown>`

检查值是否为异步 bigint 统计收集器。

## isSynchronousBigIntStatistics

`isSynchronousBigIntStatistics(target: unknown): target is SynchronousBigIntStatistics<unknown>`

检查值是否为同步 bigint 统计收集器。

## 窗口类型守卫

## isAsynchronousWindowCollectable

`isAsynchronousWindowCollectable(target: unknown): target is AsynchronousWindowCollectable<unknown>`

检查值是否为异步窗口可收集类型。

## isSynchronousWindowCollectable

`isSynchronousWindowCollectable(target: unknown): target is SynchronousWindowCollectable<unknown>`

检查值是否为同步窗口可收集类型。

## 收集器类类型守卫

## isAsynchronousCollector

`isAsynchronousCollector(target: unknown): target is AsynchronousCollector<unknown, unknown, unknown>`

检查值是否为异步收集器。

## isSynchronousCollector

`isSynchronousCollector(target: unknown): target is SynchronousCollector<unknown, unknown, unknown>`

检查值是否为同步收集器。

## Optional 类型守卫

## isOptional

`isOptional(target: unknown): target is Optional<unknown>`

检查值是否为 `Optional`。

```typescript
if (isOptional(value)) {
  if (value.isPresent()) {
    // 处理值
  }
}
```

## DOM 类型守卫

## isWindow

`isWindow(target: unknown): target is Window`

检查值是否为 `Window` 对象。

## isDocument

`isDocument(target: unknown): target is Document`

检查值是否为 `Document` 对象。

## isHTMLElemet

`isHTMLElemet(target: unknown): target is HTMLElement`

检查值是否为 `HTMLElement`。

::: tip 注意
函数名是 `isHTMLElemet`（不是 `isHTMLElement`）。
:::

## 使用示例

### 类型窄化

```typescript
import { isNumber, isString, isObject } from "semantic-typescript";

function processValue(value: unknown): void {
  if (isNumber(value)) {
    console.log("Number:", value * 2);
  } else if (isString(value)) {
    console.log("String:", value.toUpperCase());
  } else if (isObject(value)) {
    console.log("Object:", JSON.stringify(value));
  }
}
```

### 流类型检查

```typescript
import {
  isAsynchronousSemantic,
  isSynchronousSemantic,
} from "semantic-typescript";

function processStream(stream: unknown): void {
  if (isAsynchronousSemantic(stream) || isSynchronousSemantic(stream)) {
    console.log("Stream detected");
  }
}
```

### 条件处理

```typescript
import { isIterable, isAsyncIterable } from "semantic-typescript";

async function processData(data: unknown): Promise<void> {
  if (isAsyncIterable(data)) {
    for await (const item of data) {
      // 处理异步可迭代
    }
  } else if (isIterable(data)) {
    for (const item of data) {
      // 处理同步可迭代
    }
  }
}
```

## 相关内容

- [Semantic 函数](./semantics.md) - Semantic 工厂函数
- [Collector 函数](./collectors.md) - 收集器函数
