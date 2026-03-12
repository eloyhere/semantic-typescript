# Quick Start

Get up and running with Semantic-TypeScript in minutes.

## Basic Import

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

## Numeric Statistics

```typescript
let summate: number = useOf(10, 20, 30, 40)
  .map((n: number): number => n * 2)
  .toNumericStatistics()  // Required before terminal operation
  .summate();             // 200
```

## BigInt Statistics

```typescript
let summate: bigint = useOf(10n, 20n, 30n, 40n)
  .map((n: bigint): bigint => n * 2)
  .toBigIntStatistics()   // Required before terminal operation
  .summate();             // 200n
```

## Reverse a Stream by Index

```typescript
useFrom([1, 2, 3, 4, 5])
  .redirect((element: E, index: bigint): bigint => -index)
  .toOrdered()
  .toArray(); // [5, 4, 3, 2, 1]
```

## Shuffle a Stream

```typescript
useFrom([1, 2, 3, 4, 5])
  .shuffle()
  .toOrdered()
  .toArray(); // e.g., [2, 5, 1, 4, 3]
```

## Translate Elements

```typescript
// Shift elements right by 2 positions
useFrom([1, 2, 3, 4, 5])
  .translate(2)
  .toOrdered()
  .toArray(); // [4, 5, 1, 2, 3]

// Shift elements left by 2 positions
useFrom([1, 2, 3, 4, 5])
  .translate(-2)
  .toOrdered()
  .toArray(); // [3, 4, 5, 1, 2]
```

## Infinite Range with Early Termination

```typescript
useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)
  .limit(10n)
  .toUnordered()
  .toArray();
```

## Window Events

::: warning Important
Event streams **must** use limiting operations to prevent memory leaks!
:::

```typescript
useWindow("resize")
  .limit(5n)          // Crucial for event streams
  .toUnordered()
  .forEach((ev, idx) => console.log(`Resize #${idx}`));
```

## HTML Element Events

```typescript
// <input id="input" type="text"/>
useHTMLElement("#input", "change")
  .limit(1)
  .toUnordered()
  .forEach((event: Event) => submit(event));
```

## Multiple Elements and Events

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

## String Iteration by Code Point

```typescript
useText("My emotion now is: 😊, and semantic is 👍")
  .toUnordered()
  .log();
```

## Safe Stringify with Circular References

```typescript
let o = {
  a: 1,
  b: "text",
  c: [o.a, o.b, o.c] // Circular reference
};

// JSON.stringify(o) throws an error
let text: string = useStringify(o);
// Safely yields `{a: 1, b: "text", c: []}`
```

## Next Steps

- [Core Concepts](./core-concepts.md) - Learn about the core concepts
- [Important Rules](./important-rules.md) - Understand critical usage rules
- [Performance](./performance.md) - Learn about performance characteristics
