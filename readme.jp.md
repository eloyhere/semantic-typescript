# **Semantic-TypeScript**

**Flow, Indexed.** あなたのデータを、正確に制御します。

[English](./readme.md) · [简体中文](./readme.cn.md) · [繁體中文](./readme.tw.md) · 日本語 · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

**JavaScript ジェネレーター**、**Java Stream**、そして**インデックスベースのデータアドレッシング**を統合する、型安全なストリーム処理ライブラリです。各要素は `bigint` インデックスを保持し、すべてのパイプラインは遅延評価され、すべての終端操作は明示的な opt-in です。

```bash
npm install semantic-typescript
```

- 実行時依存関係ゼロ、純粋な ESM、独自の型定義を同梱。
- 496 のリグレッションテスト：`npm test`。
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
                    └── すべてのオペレーターは、ジェネレーターをラップした新しい Semantic を返します
```

| Layer | Module | Responsibility |
| :--- | :--- | :--- |
| Sources | `synchronous/collectors`, `asynchronous/collectors` | イテラブル、ジェネレーター、Promise、Blob、イベントターゲットをラップします |
| Pipelines | `synchronous/semantic`, `asynchronous/semantic` | 遅延オペレーターとインデックスの書き換え |
| Collectables | `synchronous/semantic`, `asynchronous/semantic` | 順序付き、順序なし、統計、ウィンドウ、およびカスタムの終端 |
| Collectors | `synchronous/collector`, `asynchronous/collector` | すべての終端がそこから組み立てられる畳み込みプリミティブ |
| Mathematics | `mathematics/*` | 角度、複素数、周波数、スペクトル、ウィンドウ、周転円、位相リング |
| Structures | `structure/*` | リスト、集合、マップ、ツリー、リング、場 |

同期系と非同期系はひとつの語彙を共有します。同じオペレーター名、同じインデックスセマンティクス、同じコレクタブルです。非同期版は単に Promise を返し、書き込みをキューに入れるため、書き込みの後に発行された読み取りは常にその書き込みを観測します。

---

<a id="3-quick-start"></a>
## 3. クイックスタート

```typescript
import {
  useOf, useFrom, useRange, useText, useStringify, usePromise
} from "semantic-typescript";

// 数値の集約
const sum: number = useOf(10, 20, 30, 40)
  .map(n => n * 2)
  .toNumericStatistics()
  .summate();                                   // 200

// BigInt の集約
const bigSum: bigint = useOf(10n, 20n, 30n, 40n)
  .map(n => n * 2n)
  .toBigintStatistics()
  .summate();                                   // 200n

// 並べ替えはインデックス演算です — 効果を得るには toOrdered() で収集します
const reversed: number[] = useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();      // [5,4,3,2,1]
const rotated: number[]  = useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();   // [4,5,1,2,3]

// 大きなレンジに対する遅延評価
const multiples: bigint[] = useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)
  .limit(10n)
  .toUnordered()
  .toArray();                                   // [0n,17n,…,153n]

// Unicode 安全な文字列処理（UTF-16 単位ではなくコードポイント）
useText("semantic 👍").toUnordered().forEach(character => console.log(character));

// 循環参照に安全なシリアライズ
const cyclic: any = { a: 1 }; cyclic.self = cyclic;
useStringify(cyclic);                           // '{"a":1}'

// 非同期ソース
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
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  （回転）
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  （7 ≡ 2 mod 5）
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

---

<a id="6-collectables-and-terminal-operations"></a>
## 6. コレクタブルと終端操作

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

---

<a id="7-statistics-and-windows"></a>
## 7. 統計とウィンドウ

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();              // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();              // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();               // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                 // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance();             // 2.56
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation();    // 1.6
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n);                    // [[1,2],[2,3],[3,4]]
```

両方の統計ファミリーは同じサーフェス — `summate`、`average`、`median`、`mode`、`variance`、`standardDeviation`、`frequency`、`findMaximum`、`findMinimum` — を持ち、`toBigintStatistics()` では `bigint` 演算になります。ウィンドウは `slide(size, hop)` と `tumble(size)` をサポートします。

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
const added   = cycle.add(3);          // キューに入る
const sampled = cycle.elementAt(2n);   // 上の書き込みを観測します
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
ring.phaseAt(6n).get().getValue() === ring.phaseAt(0n).get().getValue();   // true、厳密に
ring.purity();                             // 1
ring.isBalanced();                         // true
ring.sequences().map(z => z.magnitude());  // [0, 6, 0, 0, 0, 0]
```

`frequency` は位置間の位相ステップではなく、**環境（ambient）**の回転速度です：環境はすべてのフェーザー（phasor）を同じ角度だけ動かすので、内在的なパターンを壊すことは決してありません。`span` はリングが何回転分を占めるかを固定します。

`purity()` は基本モードが運ぶエネルギーの割合であり、`max(|c₁|², |c_{n−1}|²) / (n · Σ|z|²)` です。リングが回転を除いて 1 の `n` 乗根であるとき、かつそのときに限り `1` になり、必要なビンは二つだけなのでコストは `O(n)` です。リングは円をどちら向きにも周りうるため、両方向が検査されます。

### 10.2 場は有界のスコア

`PhaseField` は相対位相を `[-1, 1]` のスコアに写します：

```typescript
import { useField } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ)：+1 が一致、−1 が逆位相
const mixed  = useField([0.4, 0.3, 0.3]);  // 最初の三つの高調波

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
report.missed;                               // 1  （'zz' はリング上にありません）
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

各参照の行は `count`、平均相対位相 `mean`、平均合成ベクトル長（mean resultant length）`resultant` を報告します。覚えておく価値のある同一性がひとつあります：**`resultant` はすべての参照で同じ**です。基準を変えても、すべての相対位相が定数分だけ回転するからです。参照ごとに異なるのは件数と平均です。

```typescript
const cycle = new SynchronousCycle(["a", "b", "c"]);
cycle.scoresAt(0, cosine);                   // 位置ごとにひとつのスコア（[-1, 1] の範囲）
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

---

<a id="11-utility-helpers"></a>
## 11. ユーティリティヘルパー

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

---

<a id="12-performance-and-pitfalls"></a>
## 12. パフォーマンスと落とし穴

**遅延にはステージごとのコストがあります。** オペレーターはそれぞれジェネレーターのホップを一つ増やします。メモリ内配列に対するタイトな数値ループでは、素の `for` ループがどのパイプラインにも勝ります。パイプラインが有利になるのは、ソースが遅延的もしくは無限であるか、インデックスの規律が元を取れるほどパイプラインが長い場合です。

**`toOrdered()` はソートし、`toUnordered()` はソートしません。** 反転が「効いていない」ように見えるなら、そのコレクターは順序なしでした — インデックスの書き換えは、インデックスが正規化されて初めて順序になります。

**`interrupt` のない `useGenerate` は決して終わりません。** 停止述語か、下流の `limit` / `takeWhile` を必ず与えてください。

**`Cycle` は挿入順を保つ集合です。** 要素は一意であり、最初に追加された順序を保ちます。重複する `add` は `false` を返し、重複を導入する `set` は例外を投げます。これにより、位相は（たまたま占めている位置ではなく）*要素*の関数になり得ます。

**`Spectrum` の片側ヘルパーは実信号を前提とします。** `oneSided()`、`getNyquist()`、`centroid()` は共役対称性を仮定します。位相リングの空間スペクトルは複素数であり、一般に対称ではありません — 円を逆向きに周るリングは、そのエネルギーをすべてナイキストの外側であるビン `n − 1` に置きます。ビンを直接読んでください。

---

<a id="13-license"></a>
## 13. ライセンス

MIT © Eloy Kim
