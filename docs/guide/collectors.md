# Collector Functions

终端收集器函数，用于将流转换为最终结果。

## 匹配操作

## useSynchronousAnyMatch

`useSynchronousAnyMatch<E>(predicate): SynchronousCollector<E, boolean, boolean>`

检查是否有任何元素匹配谓词。

```typescript
useOf(1, 2, 3, 4, 5).collect(useSynchronousAnyMatch((n) => n > 4)); // true
```

## useAsynchronousAnyMatch

`useAsynchronousAnyMatch<E>(predicate): AsynchronousCollector<E, boolean, boolean>`

异步版本的任意匹配。

## useSynchronousAllMatch

`useSynchronousAllMatch<E>(predicate): SynchronousCollector<E, boolean, boolean>`

检查是否所有元素都匹配谓词。

```typescript
useOf(1, 2, 3, 4, 5).collect(useSynchronousAllMatch((n) => n > 0)); // true
```

## useAsynchronousAllMatch

`useAsynchronousAllMatch<E>(predicate): AsynchronousCollector<E, boolean, boolean>`

异步版本的全匹配。

## useSynchronousNoneMatch

`useSynchronousNoneMatch<E>(predicate): SynchronousCollector<E, boolean, boolean>`

检查是否没有元素匹配谓词。

```typescript
useOf(1, 2, 3, 4, 5).collect(useSynchronousNoneMatch((n) => n < 0)); // true
```

## useAsynchronousNoneMatch

`useAsynchronousNoneMatch<E>(predicate): AsynchronousCollector<E, boolean, boolean>`

异步版本的无效匹配。

## 查找操作 Collector

## useSynchronousFindFirst

`useSynchronousFindFirst<E>(): SynchronousCollector<E, Optional<E>, Optional<E>>`

查找第一个元素。

```typescript
useOf(1, 2, 3, 4, 5).collect(useSynchronousFindFirst()).get(); // 1
```

## useAsynchronousFindFirst

`useAsynchronousFindFirst<E>(): AsynchronousCollector<E, Optional<E>, Optional<E>>`

异步版本的首个查找。

## useSynchronousFindLast

`useSynchronousFindLast<E>(): SynchronousCollector<E, Optional<E>, Optional<E>>`

查找最后一个元素。

```typescript
useOf(1, 2, 3, 4, 5).collect(useSynchronousFindLast()).get(); // 5
```

## useAsynchronousFindLast

`useAsynchronousFindLast<E>(): AsynchronousCollector<E, Optional<E>, Optional<E>>`

异步版本的末尾查找。

## useSynchronousFindAny

`useSynchronousFindAny<E>(): SynchronousCollector<E, Optional<E>, Optional<E>>`

查找任意元素。

## useAsynchronousFindAny

`useAsynchronousFindAny<E>(): AsynchronousCollector<E, Optional<E>, Optional<E>>`

异步版本的任意查找。

## useSynchronousFindAt

`useSynchronousFindAt<E>(index: number | bigint): SynchronousCollector<E, E[], Optional<E>>`

在指定索引处查找元素。

```typescript
useOf(1, 2, 3, 4, 5).collect(useSynchronousFindAt(2)).get(); // 3
```

## useAsynchronousFindAt

`useAsynchronousFindAt<E>(index: number | bigint): AsynchronousCollector<E, E[], Optional<E>>`

异步版本的索引查找。

## useSynchronousFindMinimum

`useSynchronousFindMinimum<E>(): SynchronousCollector<E, Optional<E>, Optional<E>>`

查找最小元素。

```typescript
useOf(5, 2, 8, 1, 9).collect(useSynchronousFindMinimum()).get(); // 1
```

## useAsynchronousFindMinimum

`useAsynchronousFindMinimum<E>(): AsynchronousCollector<E, Optional<E>, Optional<E>>`

异步版本的最小值查找。

## useSynchronousFindMaximum

`useSynchronousFindMaximum<E>(): SynchronousCollector<E, Optional<E>, Optional<E>>`

查找最大元素。

```typescript
useOf(5, 2, 8, 1, 9).collect(useSynchronousFindMaximum()).get(); // 9
```

## useAsynchronousFindMaximum

`useAsynchronousFindMaximum<E>(): AsynchronousCollector<E, Optional<E>, Optional<E>>`

异步版本的最大值查找。

## 聚合操作 Collector

## useSynchronousCount

`useSynchronousCount<E>(): SynchronousCollector<E, bigint, bigint>`

计数元素。

```typescript
useOf(1, 2, 3, 4, 5).collect(useSynchronousCount()); // 5n
```

## useAsynchronousCount

`useAsynchronousCount<E>(): AsynchronousCollector<E, bigint, bigint>`

异步版本的计数。

## useSynchronousReduce

`useSynchronousReduce<E, A, R>(...args): SynchronousCollector<E, A, R>`

归约到单个值。

```typescript
useOf(1, 2, 3, 4, 5).collect(
  useSynchronousReduce(
    () => 0,
    (sum, n) => sum + n,
    (sum) => sum
  )
); // 15
```

## useAsynchronousReduce

`useAsynchronousReduce<E, A, R>(...args): AsynchronousCollector<E, A, R>`

异步版本的归约。

## 统计操作 Collector

### 数值统计

## useSynchronousNumericAverage

`useSynchronousNumericAverage<E>(): SynchronousCollector<E, number, number>`

计算平均值。

## useSynchronousNumericSummate

`useSynchronousNumericSummate<E>(): SynchronousCollector<E, number, number>`

计算总和。

## useSynchronousNumericMedian

`useSynchronousNumericMedian<E>(): SynchronousCollector<E, number, number>`

计算中位数。

## useSynchronousNumericMode

`useSynchronousNumericMode<E>(): SynchronousCollector<E, number, number>`

计算众数。

## useSynchronousNumericVariance

`useSynchronousNumericVariance<E>(): SynchronousCollector<E, number, number>`

计算方差。

## useSynchronousNumericStandardDeviation

`useSynchronousNumericStandardDeviation<E>(): SynchronousCollector<E, number, number>`

计算标准差。

### Bigint 统计

## useSynchronousBigIntAverage

`useSynchronousBigIntAverage<E>(): SynchronousCollector<E, bigint, bigint>`

计算 bigint 平均值。

## useSynchronousBigIntSummate

`useSynchronousBigIntSummate<E>(): SynchronousCollector<E, bigint, bigint>`

计算 bigint 总和。

## useSynchronousBigIntMedian

`useSynchronousBigIntMedian<E>(): SynchronousCollector<E, bigint, bigint>`

计算 bigint 中位数。

## useSynchronousBigIntMode

`useSynchronousBigIntMode<E>(): SynchronousCollector<E, bigint, bigint>`

计算 bigint 众数。

## useSynchronousBigIntVariance

`useSynchronousBigIntVariance<E>(): SynchronousCollector<E, bigint, bigint>`

计算 bigint 方差。

## useSynchronousBigIntStandardDeviation

`useSynchronousBigIntStandardDeviation<E>(): SynchronousCollector<E, bigint, bigint>`

计算 bigint 标准差。

### 异步统计

所有同步统计函数都有对应的异步版本：

- `useAsynchronousNumericAverage`
- `useAsynchronousNumericSummate`
- `useAsynchronousNumericMedian`
- `useAsynchronousNumericMode`
- `useAsynchronousNumericVariance`
- `useAsynchronousNumericStandardDeviation`
- `useAsynchronousBigIntAverage`
- `useAsynchronousBigIntSummate`
- `useAsynchronousBigIntMedian`
- `useAsynchronousBigIntMode`
- `useAsynchronousBigIntVariance`
- `useAsynchronousBigIntStandardDeviation`

## 分组操作 Collector

## useSynchronousGroup

`useSynchronousGroup<E>(): SynchronousCollector<E, E[], E[][]>`

按相邻元素分组。

## useAsynchronousGroup

`useAsynchronousGroup<E>(): AsynchronousCollector<E, E[], E[][]>`

异步版本的分组。

## useSynchronousGroupBy

`useSynchronousGroupBy<E, K>(classifier): SynchronousCollector<E, Map<K, E[]>>`

按分类器分组。

```typescript
useOf(1, 2, 3, 4, 5, 6).collect(useSynchronousGroupBy((n) => n % 2));
// Map {0 => [2, 4, 6], 1 => [1, 3, 5]}
```

## useAsynchronousGroupBy

`useAsynchronousGroupBy<E, K>(classifier): AsynchronousCollector<E, Map<K, E[]>>`

异步版本的分组。

## useSynchronousPartition

`useSynchronousPartition<E>(predicate): SynchronousCollector<E, E[], [E[], E[]]>`

分区为两个数组。

```typescript
useOf(1, 2, 3, 4, 5).collect(useSynchronousPartition((n) => n % 2 === 0));
// [[2, 4], [1, 3, 5]]
```

## useAsynchronousPartition

`useAsynchronousPartition<E>(predicate): AsynchronousCollector<E, E[], [E[], E[]]>`

异步版本的分区。

## useSynchronousPartitionBy

`useSynchronousPartitionBy<E, K>(classifier): SynchronousCollector<E, Map<K, E[]>>`

按分类器分区。

## useAsynchronousPartitionBy

`useAsynchronousPartitionBy<E, K>(classifier): AsynchronousCollector<E, Map<K, E[]>>`

异步版本的分区。

## useSynchronousFrequency

`useSynchronousFrequency<E>(): SynchronousCollector<E, Map<E, bigint>>`

计算元素频率。

```typescript
useOf(1, 2, 2, 3, 3, 3).collect(useSynchronousFrequency());
// Map {1 => 1n, 2 => 2n, 3 => 3n}
```

## useAsynchronousFrequency

`useAsynchronousFrequency<E>(): AsynchronousCollector<E, Map<E, bigint>>`

异步版本的频率计算。

## 转换操作 Collector

## useSynchronousToArray

`useSynchronousToArray<E>(): SynchronousCollector<E, E[], E[]>`

收集到数组。

```typescript
useOf(1, 2, 3, 4, 5).collect(useSynchronousToArray()); // [1, 2, 3, 4, 5]
```

## useAsynchronousToArray

`useAsynchronousToArray<E>(): AsynchronousCollector<E, E[], E[]>`

异步版本的数组收集。

## useSynchronousToSet

`useSynchronousToSet<E>(): SynchronousCollector<E, Set<E>, Set<E>>`

收集到 Set。

```typescript
useOf(1, 2, 2, 3, 3, 3).collect(useSynchronousToSet()); // Set {1, 2, 3}
```

## useAsynchronousToSet

`useAsynchronousToSet<E>(): AsynchronousCollector<E, Set<E>, Set<E>>`

异步版本的 Set 收集。

## useSynchronousToMap

`useSynchronousToMap<E, K, V>(mapper): SynchronousCollector<E, Map<K, V>, Map<K, V>>`

收集到 Map。

```typescript
useOf([
  ["a", 1],
  ["b", 2],
]).collect(useSynchronousToMap((entry) => entry));
// Map {'a' => 1, 'b' => 2}
```

## useAsynchronousToMap

`useAsynchronousToMap<E, K, V>(mapper): AsynchronousCollector<E, Map<K, V>, Map<K, V>>`

异步版本的 Map 收集。

## 连接操作 Collector

## useSynchronousJoin

`useSynchronousJoin<E>(separator: string): SynchronousCollector<E, string, string>`

连接元素为字符串。

```typescript
useOf("a", "b", "c").collect(useSynchronousJoin(", ")); // "a, b, c"
```

## useAsynchronousJoin

`useAsynchronousJoin<E>(separator: string): AsynchronousCollector<E, string, string>`

异步版本的连接。

## 迭代操作 Collector

## useSynchronousForEach

`useSynchronousForEach<E>(consumer): SynchronousCollector<E, void, void>`

迭代每个元素。

```typescript
useOf(1, 2, 3, 4, 5).collect(useSynchronousForEach((n) => console.log(n)));
```

## useAsynchronousForEach

`useAsynchronousForEach<E>(consumer): AsynchronousCollector<E, void, void>`

异步版本的迭代。

## useSynchronousLog

`useSynchronousLog<E>(): SynchronousCollector<E, void, void>`

记录元素到控制台。

```typescript
useOf(1, 2, 3, 4, 5).collect(useSynchronousLog());
```

## useAsynchronousLog

`useAsynchronousLog<E>(): AsynchronousCollector<E, void, void>`

异步版本的日志。

## I/O 操作 Collector

## useSynchronousWrite

`useSynchronousWrite<E>(writer): SynchronousCollector<E, void, void>`

写入元素。

## useAsynchronousWrite

`useAsynchronousWrite<E>(writer): AsynchronousCollector<E, void, void>`

异步版本的写入。

## useSynchronousError

`useSynchronousError<E>(...args): SynchronousCollector<E, string, string>`

创建错误。

## 通用 Collector

## useSynchronousCollect

`useSynchronousCollect<E, A, R>(...args): SynchronousCollector<E, A, R>`

通用同步收集器。

## useAsynchronousCollect

`useAsynchronousCollect<E, A, R>(...args): AsynchronousCollector<E, A, R>`

通用异步收集器。

## 相关内容

- [Semantic 函数](./semantics.md) - Semantic 工厂函数
- [类型守卫](./guards.md) - 类型守卫函数
