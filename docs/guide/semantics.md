# Semantic Functions

创建流处理管道的工厂函数，返回 `AsynchronousSemantic` 或 `SynchronousSemantic` 类型。

## 数据源 Semantic

## useOf

`useOf<E>(...elements: E[]): SynchronousSemantic<E>`

从离散值创建流。

```typescript
useOf(1, 2, 3, 4, 5).toUnordered().toArray(); // [1, 2, 3, 4, 5]
```

## useFrom

`useFrom<E>(iterable: Iterable<E>): SynchronousSemantic<E>`

从可迭代对象创建流。

```typescript
useFrom([1, 2, 3, 4, 5]).toUnordered().toArray(); // [1, 2, 3, 4, 5]
```

## useRange

`useRange<N>(start: N, end: N, step?: N): SynchronousSemantic<N>`

创建数值或 bigint 范围流。

```typescript
useRange(0n, 100n)
  .filter((n) => n % 10n === 0n)
  .toUnordered()
  .toArray(); // [0n, 10n, 20n, ..., 90n]
```

## useEmpty

`useEmpty<E>(): SynchronousSemantic<E>`

创建空流。

```typescript
useEmpty<number>().toUnordered().toArray(); // []
```

## useFill

`useFill<E>(element: E, count: bigint): SynchronousSemantic<E>`

创建填充元素的流。

```typescript
useFill(0, 5n).toUnordered().toArray(); // [0, 0, 0, 0, 0]
```

## useGenerate

`useGenerate<E>(supplier: () => E): SynchronousSemantic<E>`

通过供应器函数生成流。

```typescript
useGenerate(() => Math.random())
  .limit(5n)
  .toUnordered()
  .toArray();
```

## useIterate

`useIterate<E>(generator: SynchronousGenerator<E>): SynchronousSemantic<E>`

从生成器创建流。

## usePromise

`usePromise<T>(promise: Promise<T>): SynchronousSemantic<T>`

从 Promise 创建流。

## DOM 事件 Semantic

## useWindow

`useWindow<K, V>(eventName: K): AsynchronousSemantic<V>`

从窗口事件创建流。

```typescript
useWindow("resize")
  .limit(5n)
  .toUnordered()
  .forEach((ev, idx) => console.log(`调整大小 #${idx}`));
```

## useDocument

`useDocument<K, V>(eventName: K): AsynchronousSemantic<V>`

从文档事件创建流。

```typescript
useDocument("DOMContentLoaded")
  .limit(1n)
  .toUnordered()
  .forEach(() => console.log("DOM 就绪"));
```

## useHTMLElement

`useHTMLElement(...args): AsynchronousSemantic<V>`

从 HTML 元素事件创建流。

```typescript
useHTMLElement("#input", "change")
  .limit(1)
  .toUnordered()
  .forEach((event: Event) => submit(event));
```

## 网络 Semantic

## useWebSocket

`useWebSocket<K, V>(socket: WebSocket, eventName?: K): AsynchronousSemantic<V>`

从 WebSocket 消息创建流。

```typescript
useWebSocket(socket, "message")
  .limit(10n)
  .toUnordered()
  .forEach((message: MessageEvent) => console.log(message.data));
```

## useBlob

`useBlob(blob: Blob, chunk?: bigint): SynchronousSemantic<Uint8Array>`

从 Blob 创建流。

## useText

`useText(text: string): SynchronousSemantic<string>`

按码点迭代字符串。

```typescript
useText("你好 😊").toUnordered().toArray(); // ['你', '好', ' ', '😊']
```

## 时间 Semantic

## useAnimationFrame

`useAnimationFrame(period: number, delay?: number): SynchronousSemantic<number>`

从 `requestAnimationFrame` 创建流。

```typescript
useAnimationFrame(16) // ~60 FPS
  .limit(60n)
  .toUnordered()
  .forEach((timestamp) => console.log("帧:", timestamp));
```

## useInterval

`useInterval(period: number, delay?: number): SynchronousSemantic<number>`

从 `setInterval` 创建流。

```typescript
useInterval(1000) // 每秒
  .limit(5n)
  .toUnordered()
  .forEach(() => console.log("滴答"));
```

## 对象 Semantic

## useAttribute

`useAttribute<T>(object: T): SynchronousSemantic<Attribute<T>>`

从对象属性创建流。

## useNonNull

`useNonNull<T>(value: T | null | undefined): SynchronousSemantic<NonNullable<T>>`

创建非空值流。

## useNullable

`useNullable<T>(value: T | null | undefined): SynchronousSemantic<T>`

创建可空值流。

## 工具 Semantic

## useArrange

`useArrange<E>(source, comparator?): SynchronousSemantic<E>`

排序源元素。

## useGenerator

`useGenerator<E>(iterable: Iterable<E>): SynchronousGenerator<E>`

创建生成器。

## useHash

`useHash<E>(): (element: E, index: bigint) => string`

创建哈希函数。

## 相关内容

- [Collector 函数](./collectors.md) - 收集器函数
- [类型守卫](./guards.md) - 类型守卫函数
