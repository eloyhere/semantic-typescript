# **Semantic-TypeScript**

**Flow, Indexed.** あなたのデータを、正確に制御します。

[English](./readme.md) · [简体中文](./readme.cn.md) · [繁體中文](./readme.tw.md) · 日本語 · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

**JavaScript ジェネレーター**、**Java Stream**、そして**インデックスベースのデータアドレッシング**を統合する、型安全なストリーム処理ライブラリです。各要素は `bigint` インデックスを保持し、すべてのパイプラインは遅延評価され、すべての終端操作は明示的な opt-in です。

```bash
npm install semantic-typescript
```

- 実行時依存関係ゼロ、純粋な ESM、独自の型定義を同梱。
- 622 のリグレッションテスト：`npm test`。
- 変更履歴全体：[CHANGELOG.md](./CHANGELOG.md)。

---

## Table of Contents

1. [設計哲学](#1-design-philosophy)
2. [アーキテクチャ](#2-architecture)
3. [クイックスタート](#3-quick-start)
4. [ファクトリ関数](#4-factory-functions)
5. [変換オペレーター](#5-transformation-operators)
6. [コレクタブルと終端操作](#6-collectables-and-terminal-operations)
7. [統計とウィンドウ](#7-statistics-and-windows)
8. [インデックスモデル](#8-the-index-model)
9. [非同期モデル](#9-the-asynchronous-model)
10. [周期性解析：リング・場・スコア](#10-periodic-analysis-rings-fields-and-scores)
11. [ユーティリティヘルパー](#11-utility-helpers)
12. [パフォーマンスと落とし穴](#12-performance-and-pitfalls)
13. [ライセンス](#13-license)

---

<a id="1-design-philosophy"></a>
## 1. 設計哲学

三つのアイデア、ひとつのパイプライン：

**インデックスはデータです。** すべての要素は `bigint` によってアドレス指定されます。反転、回転、シャッフル、分割はバッファ操作ではなくインデックス演算です。コレクタブルが要求するまで、何も具体化されません。

**遅延がデフォルトです。** ファクトリはジェネレーターをラップし、オペレーターはさらに別のジェネレーターをラップします。終端操作が実行されるまで要素は要求されないため、下流の何かが停止させる限り、無限のソースはまったく合法です。

**終端は明示的です。** `map` が返すのは配列ではなく `Semantic` です。値が現れるのは `toUnordered()`、`toOrdered()`、`toNumericStatistics()`、`toWindow()` といったコレクタブルを名指ししたときだけで、それぞれがどれだけのコストを払い、どのような順序を生むのかを明示します。

同じ規律はライブラリの数学的な半分にも当てはまります。`Complex`、`Angle`、`Frequency` は構築時に不変条件が検査される不変オブジェクトであり、`Optional` は `null` を置き換え、位相リングは自分が保持する要素数、周期、そしてどれだけ均衡しているかを正確に語ります。

---

<a id="2-architecture"></a>
## 2. アーキテクチャ

```
factory  ──▶  Semantic  ──▶  Semantic  ──▶  Collectable  ──▶  result
 (source)      (map)         (filter)        (terminal)
                    ▲
                    └── every operator returns a new Semantic wrapping a generator
```

| Layer | Module | Responsibility |
| :--- | :--- | :--- |
| Sources | `synchronous/collectors`, `asynchronous/collectors` | イテラブル、ジェネレーター、Promise、Blob、イベントターゲットをラップします |
| Pipelines | `synchronous/semantic`, `asynchronous/semantic` | 遅延オペレーターとインデックスの書き換え |
| Collectables | `synchronous/semantic`, `asynchronous/semantic` | 順序付き、順序なし、統計、ウィンドウ、およびカスタムの終端 |
| Collectors | `synchronous/collector`, `asynchronous/collector` | すべての終端がそこから組み立てられる畳み込みプリミティブ |
| Mathematics | `mathematics/*` | 角度、複素数、周波数、スペクトル、ウィンドウ、推定量、周転円、位相リング |
| Structures | `structure/*` | リスト、集合、マップ、ツリー、フォレスト、リング、場 |
| Errors | `structure/error` | 型付き `SemanticError` 階層とそのブランドガード |

同期系と非同期系はひとつの語彙を共有します。同じオペレーター名、同じインデックスセマンティクス、同じコレクタブルです。非同期版は単に Promise を返し、書き込みをキューに入れるため、書き込みの後に発行された読み取りは常にその書き込みを観測します。

### 2.1 今回のリリースで移ったもの、壊れたもの

三つのモジュールが位置または形を変え、いくつかの既定値は意味が変わりました。古い挙動はどれも明示的なオプションから到達できます。置き換えなしに削除されたものはありません。

| Change | Before | Now |
| :--- | :--- | :--- |
| フォレスト | `structure/tree/rootedForest`、`structure/tree/unionFindForest` | `structure/forest/rootedForest`、`structure/forest/unionFindForest`；`tree/index.ts` は再エクスポートしなくなりました |
| エラー | 場当たり的なネイティブエラー | `structure/error.ts` の十五クラス階層。各クラスにブランドガード、加えて `SemanticRangeError` 別名 |
| 推定量オプション | 固定の定義 | `mathematics/quantile.ts` が `QuantileMethod`、`QuantileOptions`、`SkewnessEstimator`、`KurtosisEstimator`、`VarianceOptions` をエクスポート |
| `quantile` | Hyndman–Fan タイプ 1 | タイプ 7 — R `quantile`、NumPy `linear`、Excel `PERCENTILE.INC` |
| `skewness` / `kurtosis` | `g1` / `g2` | バイアス補正された `G1` / `G2` |
| `variance` / `standardDeviation` | `ddof = 0` | `ddof = 1`、`Optional` でラップ |
| `decibel` | 単一の `20·log10` 関数 | 削除。`amplitudeDecibel`（20·log10）と `powerDecibel`（10·log10）に分割 |
| `Spectrum.flatness()` | 両半分の振幅 | 片側半分のパワー |
| `Spectrum.bandEnergy()` | 生の両側和 | 既定は片側で、共役な半分を折り畳みます |
| `shortTimeFourierTransform` / `spectrogram` | 対称 Hann、完全なフレームのみ | 周期 Hann、`boundary: "zeros"`、`padded: true` |

第 6、7、10 章が置き換えを説明しています。実測された影響は [CHANGELOG.md](./CHANGELOG.md) にあります。

---

<a id="3-quick-start"></a>
## 3. クイックスタート

```typescript
import {
  useOf, useFrom, useRange, useText, useStringify, usePromise
} from "semantic-typescript";

// Numeric aggregation
const sum: number = useOf(10, 20, 30, 40)
  .map(n => n * 2)
  .toNumericStatistics()
  .summate();                                   // 200

// BigInt aggregation
const bigSum: bigint = useOf(10n, 20n, 30n, 40n)
  .map(n => n * 2n)
  .toBigintStatistics()
  .summate();                                   // 200n

// Reordering is index arithmetic — collect with toOrdered() for it to take effect
const reversed: number[] = useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();      // [5,4,3,2,1]
const rotated: number[]  = useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();   // [4,5,1,2,3]

// Lazy evaluation over a large range
const multiples: bigint[] = useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)
  .limit(10n)
  .toUnordered()
  .toArray();                                   // [0n,17n,…,153n]

// Unicode-safe string processing (code points, not UTF-16 units)
useText("semantic 👍").toUnordered().forEach(character => console.log(character));

// Circular-safe serialisation
const cyclic: any = { a: 1 }; cyclic.self = cyclic;
useStringify(cyclic);                           // '{"a":1}'

// Terminals hand the elements to real structures, not only to arrays
useOf(3, 1, 4, 1, 5).toCollectable().toOrderedSet().toArray();          // [1,3,4,5]
useFrom([3, 1, 4, 1, 5]).toCollectable().toBinarySearchTree().size();   // 5n

// Async sources
const total = await usePromise(Promise.resolve(7)).toNumericStatistics().summate();       // 7
```

---

<a id="4-factory-functions"></a>
## 4. ファクトリ関数

構築は常に O(1) です — ファクトリはジェネレーターをラップするだけです。以下の表は `n` 個の要素を*消費*するコストと、ソース自身が必要とする追加の空間を示します。

| Factory | Signature (result) | Time (consume n) | Space (source) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | インデックスは 0..n−1；スプレッド引数はすでに具体化されています |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | 任意のイテラブルをラップ；収集時に一度だけ反復します |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` は排他的；`step` は非ゼロでなければならず、`number` と `bigint` の両方が使えます |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | サプライヤーは要素ごとに一度だけ呼ばれます |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | `concat` の単位元 |
| `useText` | `useText(text, delimiter?)` | O(n) | テキスト長に対して O(n) | **コードポイント**単位で反復するため、絵文字や CJK も単一要素のままです |
| `useAttribute` | `useAttribute<T>(object)` | O(v + e) | O(d + v) | 循環保護付きでネストしたオブジェクトを再帰的に走査します |
| `useGenerate` | `useGenerate<E>(supplier, interrupt)` | O(n) × サプライヤーのコスト | O(1) | 停止する `interrupt` か、下流の `limit` が**必須**です |
| `useIterate` | `useIterate<E>(Iterable<E>)` / `(AsyncIterable<E>)` | 収集ごとに O(n) | O(1) | 収集のたびにイテレーターを再生します |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period（実時間） | O(1) | 経過時間を発行します |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | インデックス `0n` の単一要素 |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob のサイズ) | コピーごとに O(chunk) | デフォルトのチャンクは 64 KiB |
| `useSubscription` | `useSubscription(target, subscriber, event) → AsynchronousSemantic<Event>` | イベントごとに 1 要素 | O(1) | `limit()` / `takeWhile()` が購読解除の境界を定義します |

```typescript
useOf(1, 2, 3).toUnordered().toArray();                       // [1,2,3]
useFrom(new Set([1, 2, 2])).toUnordered().toArray();          // [1,2]
useRange(0, 5).toUnordered().toArray();                       // [0,1,2,3,4]
useRange(10n, 0n, -5n).toUnordered().toArray();               // [10n,5n]
useFill("x", 3n).toUnordered().toArray();                     // ["x","x","x"]
useText("A😊B").toUnordered().toArray();                      // ["A","😊","B"]
useGenerate(() => 7, (_e, index) => index >= 3n).toUnordered().toArray();   // [7,7,7]
```

---

<a id="5-transformation-operators"></a>
## 5. 変換オペレーター

すべてのオペレーターは新しい `Semantic` を返します；コレクタブルが実行されるまで、どれも要素に触れません。Time は**要素ごと**の追加コストであり、Space はパイプラインの実行中にオペレーターが保持し続けるものです。

| Operator | Purpose | Index effect | Time | Space |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | 1:1 変換 | 転送 | O(1) | O(1) |
| `filter(predicate)` | 条件に合う要素を残す | 転送 | O(1) | O(1) |
| `flat(mapper)` / `flatMap(mapper)` | 1:N の平坦化 | 0 から再インデックス | 発行ごとに O(1) | O(1) |
| `distinct(keyExtractor?)` | 重複キーを捨て、最初のものを残す | 転送 | 平均 O(1) | O(n) |
| `peek(consumer)` | 副作用、要素はそのまま通過 | 転送 | O(1) | O(1) |
| `limit(count)` | 最初の *n* 個を取る | 0 から再インデックス | O(1) | O(1) |
| `skip(count)` | 最初の *n* 個を捨てる | 転送 | O(1) | O(1) |
| `sub(start, end)` | 位置指定スライス `[start, end)` | 転送 | O(1) | O(1) |
| `takeWhile(predicate)` | 述語が成り立つ間だけ取る | 転送 | O(1) | O(1) |
| `dropWhile(predicate)` | 述語が成り立つ間だけ捨てる | 0 から再インデックス | O(1) | O(1) |
| `concat(other)` | `Semantic` またはイテラブルを後ろに連結 | インデックスを継続 | O(1) | O(1) |
| `redirect(redirector)` | 新しいインデックスを好きなように計算 | **任意** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | 符号反転してシフト | O(1) | O(1) |
| `translate(offset \| mapper)` | すべてのインデックスをシフト | `i + offset` | O(1) | O(1) |
| `shuffle(mapper?)` | インデックスをランダム化 | ランダム | O(1) | O(1) |
| `pipe(conversion)` | ジェネレーターを独自関数に渡す | 任意 | 任意 | 任意 |
| `semantic()` | コレクタブルを `Semantic` に戻す | 変更なし | O(1) | O(1) |

**`reverse`、`translate`、`shuffle` はインデックスを書き換えるだけです。** `toOrdered()` が要素数を法としてインデックスを正規化するまで、何もバッファリングされず、何も回転しません：

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

---

<a id="6-collectables-and-terminal-operations"></a>
## 6. コレクタブルと終端操作

### 6.1 コレクタブル

コレクタブルは**順序**と**インデックスの簿記**の両方を担います。`n` は要素数です。

| Collectable | Structure | Time | Order | Use when |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | インデックスをキーとする `Map<bigint, E>` | O(n) | 挿入順 | 最大のスループット；生のインデックスはそのまま保持されます |
| `toOrdered()` | 要素インデックスでソートされた配列 | O(n log n) | 正規化されたインデックス順 | 反転や回転を反映させたいとき |
| `toOrdered(comparator)` | 独自の比較器でソート | O(n log n) | 独自の比較器順 | ソート済みのビュー |
| `toNumericStatistics()` | 値でソートされたバッファ | O(n log n) | 値順 | `number` に対する統計 |
| `toBigintStatistics()` | 値でソートされたバッファ | O(n log n) | 値順 | `bigint` に対する統計 |
| `toWindow()` | 値でソートされたバッファ | O(n log n) | 値順 | `slide` / `tumble` |
| `toCollectable(mapper)` | mapper が返したもの | — | — | カスタムのコレクタブル |

### 6.2 終端

すべての終端は `Semantic` ではなく**コレクタブル**の上にあります。「終端は明示的である」とは実践的にはそういう意味です。コレクタブルを名指しするまでパイプラインは何も生み出さず、mapper を渡さない `toCollectable()` がもっとも安価な名指しの方法です。

| Terminal | Returns | Time | Notes |
| :--- | :--- | :--- | :--- |
| `toArray()` / `toSet()` | `Array<E>` / `Set<E>` | O(n) | バッファを排出します；`toSet` は同一性で重複排除します |
| `toMap(key, value?)` | `Map<K, V>` | 平均 O(n) | 最後の書き込みが優先されます |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | バッファがすでに知っています |
| `forEach(action)` | `void` | O(n) | `action(element, index)` |
| `join(…)` | `string` | O(n) | `join()`、`join(delimiter)`、`join(prefix, delimiter, suffix)` |
| `reduce(…)` | `Optional<E>` / `E` / `R` | O(n) | 空のストリーム → 空の `Optional` |
| `group(classifier)` / `groupBy(key, value)` | `Map<K, E[]>` | 平均 O(n) | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | インデックスによるラウンドロビン |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | バケット番号は分類器から決まります |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | 最悪 O(n)、短絡します | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | 具体化された順序での位置指定 |
| `findAt(k)` / `findNegativeAt(k)` | `Optional<E>` | O(k) / O(n−k) | 先頭／末尾から数えます |
| `findMaximum(cmp?)` / `findMinimum(cmp?)` | `Optional<E>` | O(n) | デフォルトは構造的比較 |
| `frequency()` | `Map<E, bigint>` | 平均 O(n) | 統計コレクタブルのみ |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | IO 的な終端 |
| `collect(collector)` | `R` | O(n) | 上記すべての終端を支える汎用の畳み込み |

### 6.3 構造コレクター

`toArray`、`toSet`、`toMap` はパイプラインを JavaScript のコンテナで終わらせます。さらに十二の終端は、ライブラリ自身の構造のいずれかでそれを終わらせます。結果は配列がたまたま持つ不変量ではなく、その構造が保証する不変量を携えます。これらはすべてのコレクタブルで利用でき、`toCollectable()` が返す生のコレクタブルも含まれます。

| Terminal | Returns | Order | Cost |
| :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | 走査順 | O(n) |
| `toSet()` | `Set<E>` | 挿入順、SameValueZero | 平均 O(n) |
| `toMap(key, value?)` | `Map<K, V>` | 挿入順；後書きが優先 | 平均 O(n) |
| `toOrderedSet(comparator?)` | `SynchronousOrderedSet<E>` | 比較器の昇順 | 最悪 O(n²) |
| `toUnorderedSet()` | `SynchronousUnorderedSet<E>` | 未指定（ハッシュバケット） | 期待 O(n) |
| `toOrderedMap(key, value?)` | `SynchronousOrderedMap<K, V>` | 挿入順；後書きが優先 | 期待 O(n) |
| `toUnorderedMap(key, value?)` | `SynchronousUnorderedMap<K, V>` | 未指定 | 期待 O(n) |
| `toList()` | `SynchronousList<E>` | 走査順、重複を保持 | O(n) |
| `toCycle(span?)` | `SynchronousCycle<E>` | 走査順がリング上の位置を決めます | O(n) |
| `toLRUSet(capacity)` | `SynchronousUnorderedLRUSet<E>` | 最近使用順；最後の `capacity` 個だけが残ります | 最悪 O(n²) |
| `toLRUMap(capacity, key, value?)` | `SynchronousUnorderedLRUMap<K, V>` | 最近使用順 | 期待 O(n) |
| `toSkipSet(comparator?)` | `SynchronousSkipSet<E>` | 比較器の昇順、ナビゲート可能 | 最悪 O(n²) |
| `toSkipMap(key, value?)` | `SynchronousSkipMap<K, V>` | キー比較器順、ナビゲート可能 | 期待 O(n) |
| `toBinarySearchTree(comparator?)` | `SynchronousBinarySearchTree<E>` | 比較器の昇順、高さ平衡 | O(n log n) |
| `toRootedForest()` | `SynchronousRootedForest<E>` | 走査順がそのまま構造順になります | O(n) |

結果の型はコレクタブル自身の要素型に従うため、どの終端も型引数を取りません。`SynchronousCollectable<E>` は `Array<E>`、`SynchronousList<E>`、`SynchronousOrderedSet<E>` をそのまま返します。残るのは業務上の引数だけです — `toOrderedSet` / `toSkipSet` / `toBinarySearchTree` の比較器、LRU ペアの容量、`toCycle` のスパン、そしてマップ族のキーと値の抽出器です。

リングは集合なので、重複した要素は最初の位置だけを保ちます。ほかの構造は、自身の契約が別段に定めない限り重複を保持します（`toOrderedSet`、`toUnorderedSet`、`toSkipSet` は集合であり、`toBinarySearchTree` と `toList` はそうではありません）。

```typescript
const numbers = useOf(3, 1, 4, 1, 5).toCollectable();

numbers.toOrderedSet().toArray();                        // [1,3,4,5]
numbers.toUnorderedSet().size();                         // 4n — the duplicate 1 collapses
numbers.toList().toArray();                              // [3,1,4,1,5]
numbers.toSkipSet().first().get();                       // 1 — navigable by comparator
numbers.toBinarySearchTree().size();                     // 5n — duplicates retained
numbers.toRootedForest().getRoots().length;              // 1
useOf(1, 2, 3).toCollectable().toCycle().phaseAt(3n).get().toDegreeValue();      // 0
useOf(3, 1, 3).toCollectable().toOrderedMap(n => n, n => `v${n}`).get(3).get();  // "v3"
```

非同期のコレクタブルも同じ終端を持ち、それぞれを promise に解決します。したがって呼び出しの形は `await` が一つ増えるだけです。

---

<a id="7-statistics-and-windows"></a>
## 7. 統計とウィンドウ

### 7.1 統計のサーフェス

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();                    // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();                    // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();                     // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                       // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance().get();             // 3.2    (n − 1)
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation().get();    // 1.7889 (n − 1)
```

両方の統計ファミリーは同じサーフェスを公開します — `summate`、`average`、`median`、`mode`、`variance`、`standardDeviation`、`frequency`、`findMaximum`、`findMinimum` — そして `toBigintStatistics()` では `bigint` 演算になります。散らばりの尺度と分位点ファミリーは `Optional` を返します。標本が小さすぎて定義できないことがあるからです。`.get()`、`.orElse(…)`、`.isPresent()` で取り出してください。

### 7.2 推定量と既定値

既定値は R、NumPy、pandas、Excel が使う定義そのものです。したがってここで算出した値は、補正係数なしでそれらのツールと比較できます。

| 統計量 | 既定 | 以前 | 古い値を取り出すには |
| :--- | :--- | :--- | :--- |
| `quantile(probability)` | Hyndman–Fan タイプ 7 | タイプ 1 | `{ method: "type-1" }` |
| `interquartileRange()` | Hyndman–Fan タイプ 7 | タイプ 1 | `{ method: "type-1" }` |
| `skewness()` | バイアス補正された `G1` | `g1` | `{ estimator: "g1" }` |
| `kurtosis()` | バイアス補正された超過 `G2` | `g2` | `{ estimator: "g2" }` |
| `variance()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |
| `standardDeviation()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |

九つの Hyndman–Fan タイプはすべて `"type-1"` … `"type-9"` として利用でき、`{ excess: false }` は峰度に三を足し戻して非超過の四次標準化モーメントを報告します。オプション型 — `QuantileMethod`、`QuantileOptions`、`SkewnessEstimator`、`KurtosisEstimator`、`VarianceOptions` — は `mathematics/quantile.ts` からエクスポートされます。

```typescript
const sample = useOf(1, 2, 3, 4).toNumericStatistics();

sample.variance().get();                                // 1.6667  (5/3, ddof = 1)
sample.variance({ ddof: 0 }).get();                     // 1.25
sample.standardDeviation().get();                       // 1.2910
sample.skewness().get();                                // 0
sample.kurtosis().get();                                // -1.2    (G2)
sample.kurtosis({ estimator: "g2" }).get();             // -1.36
sample.kurtosis({ excess: false }).get();               // 1.8

const quartiles = useOf(1, 2, 3, 4, 5, 6, 7, 8).toNumericStatistics();
quartiles.quantile(0.75).get();                         // 6.25    (type 7)
quartiles.quantile(0.75, { method: "type-1" }).get();   // 6       (nearest rank)
quartiles.interquartileRange().get();                   // 3.5
```

`G1` と `G2` はそれぞれ観測が三つ、四つ未満だと未定義になり、`ddof = 1` の標本分散と標準偏差は二つ未満で未定義になります。その場合ライブラリは誤解を招くゼロではなく、空の `Optional` を返します。

```typescript
useOf(1, 2, 3).toNumericStatistics().kurtosis().isEmpty();     // true  (G2 needs four observations)
useOf(1, 2).toNumericStatistics().skewness().isEmpty();        // true  (G1 needs three)
useOf(1).toNumericStatistics().variance().isEmpty();           // true  (ddof = 1 needs two)
useOf(1).toNumericStatistics().variance({ ddof: 0 }).get();    // 0
```

bigint ビューも同じオプションを受け取り、すべての結果を整数の `bigint` に丸め戻します。

### 7.3 ウィンドウ

ウィンドウはバッファ内の要素を「パイプラインのパイプライン」として再公開します。そのため、ウィンドウを配列に具体化せずに消費できます。どちらの形式も最後の部分的なウィンドウを含みます。

```typescript
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[2,3],[3,4],[4]]

useFrom([1, 2, 3, 4]).toWindow().tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[3,4]]
```

---

<a id="8-the-index-model"></a>
## 8. インデックスモデル

インデックスはすべての要素に付随する `bigint` です。オペレーターはそれを**転送**するか、ゼロから**再インデックス**するか、あなたに**計算**させます。

順序付き収集は各インデックスを要素数で剰余正規化してから、その結果でソートします。5 要素に対する `translate(7)` が `translate(2)` と同じになるのはこのためです：`7 ≡ 2 (mod 5)`。

順序なし収集はパイプラインが生成したインデックスをそのまま保ち、要素を到着順に返します。負のインデックスは合法であり、正規化されれば非負のインデックスより前に並ぶだけです。

---

<a id="9-the-asynchronous-model"></a>
## 9. 非同期モデル

`AsynchronousSemantic` は同期版のサーフェスを写し取り、Promise を返します。書き込みはキューに入るため、書き込みの後に発行された読み取りは常にそれを観測します。

```typescript
const cycle = new AsynchronousCycle([1, 2]);
const added   = cycle.add(3);          // queued
const sampled = cycle.elementAt(2n);   // observes the write above
await added;
(await sampled).get().element;         // 3
```

本質的に非同期なファクトリ — `usePromise`、`useBlob`、`useInterval`、`useSubscription` — は直接 `AsynchronousSemantic` を返し、`useFrom` / `useIterate` は `AsyncIterable` を渡されると自分自身をアップグレードします。

---

<a id="10-periodic-analysis-rings-fields-and-scores"></a>
## 10. 周期性解析：リング・場・スコア

ライブラリの数学的な半分は、周期（cycle）をルックアップテーブルではなく第一級のオブジェクトとして扱います。三つの構成物が協調して働きます。

### 10.1 リングはひとつの整数

`Cycle` は **n 重リング**（n-fold ring）です：要素数、位置的周期、異なる位相の数は、すべて同じ整数 `n` です。位置の位相はその正確な剰余から計算されるため、リングはビット単位で周期的です：

```typescript
import { SynchronousCycle } from "semantic-typescript";

const ring = new SynchronousCycle(["a", "b", "c", "d", "e", "f"]);
ring.phaseAt(0n).get().toDegreeValue();   // 0
ring.phaseAt(1n).get().toDegreeValue();   // 60
ring.phaseAt(6n).get().getValue() === ring.phaseAt(0n).get().getValue();   // true, exactly
ring.purity();                             // 1
ring.isBalanced();                         // true
ring.sequences().map(z => z.magnitude());  // [0, 6, 0, 0, 0, 0]
```

`frequency` は位置間の位相ステップではなく、**環境（ambient）**の回転速度です：環境はすべてのフェーザー（phasor）を同じ角度だけ動かすので、内在的なパターンを壊すことは決してありません。`span` はリングが何回転分を占めるかを固定します。

`purity()` は基本モードが運ぶエネルギーの割合であり、`max(|c₁|², |c_{n−1}|²) / (n · Σ|z|²)` です。リングが回転を除いて 1 の `n` 乗根であるとき、かつそのときに限り `1` になり、必要なビンは二つだけなのでコストは `O(n)` です。リングは円をどちら向きにも周りうるため、両方向が検査されます。

### 10.2 場は有界のスコア

`PhaseField` は相対位相を `[-1, 1]` のスコアに写します：

```typescript
import { useField, useRadian } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ): +1 aligned, −1 opposed
const mixed  = useField([0.4, 0.3, 0.3]);  // first three harmonics

cosine.sample(useRadian(0));               //  1
cosine.sample(useRadian(Math.PI));         // -1
```

スコアは打ち切られた余弦級数 `a₀ + Σ wₘ·cos(2πmΔ)` であり、コンストラクターが `|a₀| + Σ|wₘ| ≤ 1` を強制します。三角不等式により、スコアが `[-1, 1]` を外れることは決してありません — この境界は**構築の帰結**であり、後から適用されるクランプではありません。

場がテーブルではなく級数である理由：`n` 点のテーブルは自分のサンプルを正確に再現しますが、その三角補間はサンプル間でオーバーシュートします。スコア `[+1, +0.5, −1, −0.5, 0]` を持つ 5 点のテーブルは `[−1.0428, 1.0041]` に補間され、これだけで約束を破っています。有界の級数ならそうはなりません。

### 10.3 解析はデータをすべての要素に対して測る

リングの各要素は参照位相です。`analyse` はすべての観測をリング上に位置づけ直し、各参照に対して測定します：

```typescript
const ring = new SynchronousCycle(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                              // 5
report.missed;                               // 1  ('zz' is not on the ring)
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

各参照の行は `count`、平均相対位相 `mean`、平均合成ベクトル長（mean resultant length）`resultant` を報告します。覚えておく価値のある同一性がひとつあります：**`resultant` はすべての参照で同じ**です。基準を変えても、すべての相対位相が定数分だけ回転するからです。参照ごとに異なるのは件数と平均です。

```typescript
const cycle = new SynchronousCycle(["a", "b", "c"]);
cycle.scoresAt(0, cosine);                   // one score per position, in [-1, 1]
```

### 10.4 関連する道具

| Call | Answers | Cost |
| :--- | :--- | :--- |
| `purity()` | リングはまだ 1 の `n` 乗根ですか？ | O(n) |
| `resultant(t?)` | フェーザーは今どれだけ集中していますか？ | O(n) |
| `analyse(data)` | このデータは各要素に対してどう位置づけられますか？ | O(n · m) |
| `toSpectrum()` | リングをスペクトルとして表現、周波数軸には波数 | O(n²) |
| `useAngularSpectrum(cycle, instants, plan)` | 時間にわたる `(ω, n)` 平面 | O(n² · frames) |

さらに二つのプリミティブがモデルを完成させます：`combineCycles(a, b)` は二つのリングを最小公倍数の上で結合し（積ではなく引き戻し（pullback）であり、同じ時点を共有できないペアは単に存在しません）、`rate()` は各要素に固有の周波数を与えて、リングが環境に対してドリフトできるようにします。`jetAt`、`windingAt`、`errorIntegralAt` はそのドリフトの微分状態を公開します。

### 10.5 スペクトルウィンドウ

リングの構成は解析サーフェスの半分です。もう半分はサンプリングされた信号を扱います。もっとも再利用されるプリミティブは窓関数で、ここにあるどの形状にも二つの形式があります。対称形式はフレームを `count − 1` で割り、周期（DFT-even）形式は `count` で割ります。後者は完全な一周期より一つ短いので、DFT が前提とする周期的拡張のもとでテーパーが連続になります。

```typescript
useHannWindow(1, 4);                                   // 0.75  symmetric
useHannPeriodicWindow(1, 4);                           // 0.5   periodic
coherentGain(useHannPeriodicWindow, 16);               // 0.5
equivalentNoiseBandwidth(useHannPeriodicWindow, 16);   // 1.5
```

| 形状 | 対称 | 周期 | 備考 |
| :--- | :--- | :--- | :--- |
| 矩形 | `useRectangularWindow` | — | テーパーなし；周期の区別なし |
| Hann | `useHannWindow` | `useHannPeriodicWindow` | 短時間変換の既定 |
| Hamming | `useHammingWindow` | `useHammingPeriodicWindow` | — |
| Blackman | `useBlackmanWindow` | `useBlackmanPeriodicWindow` | — |
| Nuttall | `useNuttallWindow` | `useNuttallPeriodicWindow` | 4項 Blackman–Harris |
| フラットトップ | `useFlatTopWindow` | `useFlatTopPeriodicWindow` | 分解能より振幅精度 |
| Kaiser | `useKaiserWindow(beta)` | `useKaiserPeriodicWindow(beta)` | `beta` がメインローブ幅を決めます |

解析と重畳加算には周期形式を使ってください。半フレームのホップでは、周期 Hann 窓はどの長さでも和が `1.000000` になりますが、対称形式は `N = 16` で `0.841 dB`、`N = 1024` でも `0.013 dB` 波打ちます。フィルタ設計では対称形式を保ってください。そこでのフレームはテーパーの一周期ではありません。

フラットトップ窓はフレームの両端で**負の重み**を返します。フラットトップ窓とはそういうものだからです。ゼロで切り詰めず、そのまま返します。切り詰めるとメインローブが乱れ、この窓の存在理由である低いスキャロップ損失が壊れるからです。

```typescript
useFlatTopWindow(0, 1024);                             // -0.000421 — negative by definition
Array.from({ length: 1024 }, (_unused, index) => useFlatTopWindow(index, 1024))
  .filter(weight => weight < 0).length;                // 578
```

### 10.6 レベル、平坦度、帯域エネルギー

`decibel` は単一の関数としては消えました。振幅とパワーは同じ係数を共有しないからです。`amplitudeDecibel` は電圧のような比に `20·log10` を適用し、`powerDecibel` はパワー、エネルギー、平均二乗、パワースペクトル密度に `10·log10` を適用します。

```typescript
amplitudeDecibel(0.25);                                // -12.0412
powerDecibel(0.25);                                    //  -6.0206
```

`Bin.decibel` と `Spectrum.decibelOf` は振幅レベルであり、`Spectrum.powerDecibelOf` が対応するパワーレベルです。パワーを振幅形式に与えると `20·log10(power)` を報告し、デシベル値が二倍になります。

二つのスペクトル測定は読み方が変わりました。

```typescript
const twoBins = new Spectrum(new Sample(2, 1), [new Complex(2, 0), new Complex(1, 0)]);
twoBins.flatness();                                    // 0.8 — geometric over arithmetic mean of power

const shape = new Spectrum(new Sample(4, 1), [
  new Complex(1, 0), new Complex(2, 0), new Complex(0, 0), new Complex(0, 0),
]);
shape.bandEnergy(new Frequency(0), new Frequency(2));                // 9
shape.bandEnergy(new Frequency(0), new Frequency(2), "two-sided");   // 5
```

`flatness()` はスペクトルの片側半分について `power()` の幾何平均と算術平均を比較します。両半分の振幅平均ではなく、`oneSided()` の表示専用の振幅二倍も意図的に適用しません。`bandEnergy()` は既定で片側の読み方を使い、共役な半分を折り畳みます。DC とナイキストは一度だけ、内部の各ビンは二度数えられます。軸全体を覆う帯域はこれで Parseval、`Σ|X|² = N·Σx²` を満たします。複素スペクトルには `"two-sided"` を渡してください。そのビンはすでに独立しています。

### 10.7 短時間解析

`Sampler.shortTimeFourierTransform` と `Sampler.spectrogram` は SciPy `stft` の慣例に従います。周期 Hann 窓、両端のゼロ境界、そして末尾のゼロ詰めです。

```typescript
const sampler = new Sampler(new Sample(64, 1));
const spectrogram = sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8);

spectrogram.size();                     // 9 frames
spectrogram.getBoundary();              // "zeros"
spectrogram.getTime(6);                 // 0.75 — frame centres, not frame starts
sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8, useHannWindow,
  { boundary: "none", padded: false }).size();                       // 7 — complete frames only
```

両端の拡張は最初のフレームを最初のサンプルに中心合わせし、末尾の詰め物は最後のサンプルを到達可能にします。64 サンプル、フレーム 16、ホップ 8 では 7 ではなく 9 フレームになり、1000 サンプル、フレーム 256、ホップ 128 では 6 ではなく 9 フレームになります。フレーム時刻は開始ではなく中心です — 拡張ありのビューでは `(k·hop + (frameSize mod 2)/2)/rate`、拡張なしのビューでは `(k·hop + frameSize/2)/rate` — そして `toFrame()` は逆変換の前に拡張を切り詰めます。

---

<a id="11-utility-helpers"></a>
## 11. ユーティリティヘルパー

### 11.1 エラー階層

`structure/error.ts` は、パイプラインの**周囲**で送出されるエラー — 自分のコード、カスタムコレクター、アダプターから — のための十五クラス階層をエクスポートします。

```text
SemanticError
├── IllegalOperationError
├── ValidationError
│   ├── IndexError
│   ├── RangeError        (also exported as SemanticRangeError)
│   └── ConfigurationError
├── CapacityError
├── StateError
│   └── IllegalStateError
├── ConcurrencyError
├── CollectionError
├── SerializationError
├── NumericError
│   └── ArithmeticError
└── PhaseError
```

各クラスは `name` を固定し、ネイティブの `cause` を転送し、任意の `context` 診断バッグを携え、`toJSON()` で直列化します。そして同名のブランドガードを持ちます。

```typescript
const error = new CapacityError("LRU capacity exhausted", { context: { capacity: 0 } });

error.name;                 // "CapacityError"
isCapacityError(error);     // true
isValidationError(error);   // false — a capacity failure is not a validation failure
isSemanticError(error);     // true
error.toJSON();             // { name: "CapacityError", message: "…", context: { capacity: 0 } }
```

`SemanticRangeError` はエクスポートされる `RangeError` と同じクラスなので、`instanceof` はどちらの名前でも成立します。`RangeError` をインポートするとモジュール全体でグローバルコンストラクタを隠してしまうため、この別名が存在します。どちらのクラスもライブラリ自身の引数検査からは送出されません。そこではネイティブの `TypeError` と `RangeError` が投げられます。この階層はその上の層のための語彙です。

### 11.2 ツール表

| Helper | Purpose |
| :--- | :--- |
| `useCompare(a, b)` | 混在するプリミティブ間の全順序 |
| `useToNumber` / `useToBigInt` | 無損失かつ範囲検査付きの数値変換 |
| `useRandom` | シード付き／シードなしの乱数ヘルパー |
| `useTraverse` | ネストしたオブジェクトと配列の構造的走査 |
| `useStringify` | 循環参照に安全な JSON シリアライズ |
| `useHash` / `maskOf` / `register` / `unregister` | 構造的ハッシュとハッシュ戦略レジストリ |
| `invalidate` / `validate` | 一貫したエラー形状を送出するガード節 |
| `Optional<T>` | ライブラリにおける `null` の置き換え：`Optional.of(x)` / `Optional.empty()` |

### 11.3 `useTraverse`

`useTraverse(target, callback)` は任意のオブジェクトをその**非 null の葉**へ平坦化します。ネストしたオブジェクトを下り、イテラブル値は位置ごとに走査し、`null` と `undefined` は飛ばし、一度訪れたオブジェクトには二度と入りません — したがって循環のあるオブジェクトグラフはスタックを溢れさせずに終了します。

```typescript
const source = { id: 7, tags: ["a", "b"], owner: { name: "Ada", note: null } };
const leaves: string[] = [];

useTraverse(source, (key, value, path) => {
  leaves.push(`${path.join(".")} = ${String(value)}`);
  return true;
});

leaves;   // ["id = 7", "tags.0 = a", "tags.1 = b", "owner.name = Ada"]
```

コールバックは葉ごとに一度だけ呼ばれ、その葉自身のキー（イテラブル由来ならその添字）、値、そしてそこへ至るパスを受け取ります。`false` を返すと現在の枝だけでなく**走査全体**を放棄します。

```typescript
let visited = 0;
useTraverse({ a: 1, b: 2, c: 3 }, () => {
  visited += 1;
  return false;
});
visited;   // 1 — the first leaf already stops the walk
```

循環が安全なのも同じ理由です。

```typescript
const cyclic: any = { name: "root", child: { name: "leaf" } };
cyclic.child.parent = cyclic;

const names: string[] = [];
useTraverse(cyclic, (_key, value) => {
  if (typeof value === "string") names.push(value);
  return true;
});
names;     // ["root", "leaf"] — the back edge to `cyclic` is not revisited
```

**コールバックごとに独立したパスのスナップショットが渡されます。** 走査は内部に作業用配列を一つだけ持ち、葉を引き渡す瞬間にそれを `Object.freeze` で凍結した新しい配列へ複製します。スナップショットはその後変化しないので、そのまま保持でき、二つのコールバックが同じ配列を共有することも、走査をやり直して既に渡したスナップショットが乱れることもありません。型は `ReadonlyArray` なので書き込みはコンパイルエラーであり、凍結された配列への実行時の書き込みは `TypeError` も投げます。この安全性の代償は、報告する葉ごとに `O(depth)` の割り当てが一度増えることで、何も報告しない枝では追加の割り当ては発生しません。

```typescript
const paths: Array<ReadonlyArray<PropertyKey>> = [];
useTraverse({ a: { b: 1 }, c: 2 }, (_key, _value, path) => {
  paths.push(path);                      // safe to keep as-is
  return true;
});
paths[0] === paths[1];                   // false — one array per call
paths.map(path => path.join("."));       // ["a.b", "c"]
```

`useAttribute` はこの走査をファクトリにしたものです。同じ葉を `{ key, value }` の組として報告するので、規則もコストも同一です。

```typescript
useAttribute({ a: 1, b: { c: 2 } }).toUnordered().toArray();
// [{ key: "a", value: 1 }, { key: "c", value: 2 }]
```

---

<a id="12-performance-and-pitfalls"></a>
## 12. パフォーマンスと落とし穴

**遅延にはステージごとのコストがあります。** オペレーターはそれぞれジェネレーターのホップを一つ増やします。メモリ内配列に対するタイトな数値ループでは、素の `for` ループがどのパイプラインにも勝ります。パイプラインが有利になるのは、ソースが遅延的もしくは無限であるか、インデックスの規律が元を取れるほどパイプラインが長い場合です。

**`toOrdered()` はソートし、`toUnordered()` はソートしません。** 反転が「効いていない」ように見えるなら、そのコレクターは順序なしでした — インデックスの書き換えは、インデックスが正規化されて初めて順序になります。

**`interrupt` のない `useGenerate` は決して終わりません。** 停止述語か、下流の `limit` / `takeWhile` を必ず与えてください。

**`Cycle` は挿入順を保つ集合です。** 要素は一意であり、最初に追加された順序を保ちます。重複する `add` は `false` を返し、重複を導入する `set` は例外を投げます。これにより、位相は（たまたま占めている位置ではなく）*要素*の関数になり得ます。

**`Spectrum` の片側ヘルパーは実信号を前提とします。** `oneSided()`、`getNyquist()`、`centroid()` は共役対称性を仮定します。位相リングの空間スペクトルは複素数であり、一般に対称ではありません — 円を逆向きに周るリングは、そのエネルギーをすべてナイキストの外側であるビン `n − 1` に置きます。ビンを直接読んでください。

**構造コレクターは終端であり、ビューではありません。** どれもパイプラインを排出してから完全な構造を構築するので、O(n) 時間と O(n) 空間を要し、無限のソースでは動きません。パイプラインの末尾で使い、パイプラインを回すループの中では決して使わないでください。

**`variance()` とその仲間は `Optional` を返します。** 小さすぎる標本で `variance().get()` を呼ぶと例外になります。標本サイズを自分で制御できないときは `.orElse(0)` を使うか `.isPresent()` を先に確認してください。`standardDeviation`、`quantile`、`interquartileRange`、`skewness`、`kurtosis` も同じです。

**解析に使うのは周期窓です。** `useHannWindow` などの対称形式はフィルタ設計用です。短時間変換には `useHannPeriodicWindow` とその同族が必要です。そうでなければ重畳加算の和がフレームの継ぎ目で波打ちます。

---

<a id="13-license"></a>
## 13. ライセンス

MIT © Eloy Kim
