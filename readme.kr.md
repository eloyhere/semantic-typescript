# **Semantic-TypeScript**

**Flow, Indexed.** 데이터를 정밀하게 제어하세요.

[English](./readme.md) · [简体中文](./readme.cn.md) · [繁體中文](./readme.tw.md) · [日本語](./readme.jp.md) · 한국어 · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

타입 안전성을 갖춘 스트림 처리 라이브러리로, **JavaScript 제너레이터**, **Java Stream**, **인덱스 기반 데이터 주소 지정**을 하나로 통합합니다. 모든 요소는 `bigint` 인덱스를 지니고, 모든 파이프라인은 지연 평가되며, 모든 터미널 연산은 명시적으로 선택해야 합니다.

```bash
npm install semantic-typescript
```

- 런타임 의존성 없음, 순수 ESM, 자체 타입 제공.
- 684개 회귀 테스트: `npm test`.
- 전체 변경 이력: [CHANGELOG.md](./CHANGELOG.md).

---

## Table of Contents

1. [설계 철학](#1-design-philosophy)
2. [아키텍처](#2-architecture)
3. [빠른 시작](#3-quick-start)
4. [팩토리 함수](#4-factory-functions)
5. [변환 연산자](#5-transformation-operators)
6. [콜렉터블과 터미널 연산](#6-collectables-and-terminal-operations)
7. [통계와 윈도우](#7-statistics-and-windows)
8. [인덱스 모델](#8-the-index-model)
9. [비동기 모델](#9-the-asynchronous-model)
10. [주기 분석: 링, 필드, 스코어](#10-periodic-analysis-rings-fields-and-scores)
11. [유틸리티 헬퍼](#11-utility-helpers)
12. [성능과 함정](#12-performance-and-pitfalls)
13. [위상 링: 정확한 주기](#13-phase-rings)
14. [신호 분석: 윈도우, 스펙트럼, 시간](#14-signal-analysis)
15. [라이선스](#15-license)

---

<a id="1-design-philosophy"></a>
## 1. 설계 철학

세 가지 아이디어, 하나의 파이프라인:

**인덱스가 곧 데이터입니다.** 모든 요소는 `bigint`로 주소가 지정됩니다. 역순, 회전, 셔플, 분할은 버퍼 연산이 아니라 인덱스 산술입니다. 콜렉터블이 요구하기 전까지는 아무것도 구체화되지 않습니다.

**지연 평가가 기본값입니다.** 팩토리는 제너레이터를 감싸고, 연산자는 또 다른 제너레이터를 감쌉니다. 터미널 연산이 실행되기 전까지는 어떤 요소도 요청되지 않으므로, 하류에서 무언가 멈춰 주기만 한다면 무한 소스도 얼마든지 합법입니다.

**터미널은 명시적입니다.** `map`은 배열이 아니라 `Semantic`을 반환합니다. 값은 콜렉터블(`toUnordered()`, `toOrdered()`, `toNumericStatistics()`, `toWindow()`)을 지정할 때에만 나타나며, 각각은 무엇을 치르는지, 어떤 순서를 만들어 내는지를 밝힙니다.

같은 규율은 라이브러리의 수학적 절반에도 적용됩니다. `Complex`, `Angle`, `Frequency`는 생성 시점에 불변식이 검사되는 불변 값이고, `Optional`은 `null`을 대체하며, 위상 링(phase ring)은 자신이 몇 개의 요소를 담고 있는지, 주기가 얼마인지, 얼마나 균형 잡혀 있는지를 정확히 밝힙니다.

---

<a id="2-architecture"></a>
## 2. 아키텍처

```
factory  ──▶  Semantic  ──▶  Semantic  ──▶  Collectable  ──▶  result
 (source)      (map)         (filter)        (terminal)
                    ▲
                    └── every operator returns a new Semantic wrapping a generator
```

| 계층 | 모듈 | 책임 |
| :--- | :--- | :--- |
| 소스 | `synchronous/collectors`, `asynchronous/collectors` | 이터러블, 제너레이터, promise, blob, 이벤트 타깃을 감쌉니다 |
| 파이프라인 | `synchronous/semantic`, `asynchronous/semantic` | 지연 연산자와 인덱스 재작성 |
| 콜렉터블 | `synchronous/semantic`, `asynchronous/semantic` | ordered, unordered, 통계, 윈도우 및 사용자 정의 터미널 |
| 콜렉터 | `synchronous/collector`, `asynchronous/collector` | 모든 터미널이 기반으로 삼는 폴드 프리미티브 |
| 수학 | `mathematics/*` | 각도, 복소수, 주파수, 스펙트럼, 윈도우, 추정량, 에피사이클, 위상 링 |
| 구조 | `structure/*` | 리스트, 집합, 맵, 트리, 포레스트, 링, 필드 |
| 오류 | `structure/error` | 타입이 지정된 `SemanticError` 계층과 그 브랜드 가드 |

동기 계열과 비동기 계열은 하나의 어휘를 공유합니다: 연산자 이름도, 인덱스 의미론도, 콜렉터블도 동일합니다. 비동기 변형은 단지 promise를 반환하며, 쓰기를 큐에 쌓아 두므로 쓰기 이후에 발행된 읽기는 항상 그 쓰기를 관찰합니다.

### 2.1 이번 릴리스에서 옮겨진 것, 깨진 것

세 모듈이 위치나 형태를 바꿨고, 여러 기본값의 의미가 달라졌습니다. 모든 옛 동작은 명시적 옵션으로 여전히 도달할 수 있으며, 대체물 없이 제거된 것은 없습니다.

| 변경 | 이전 | 현재 |
| :--- | :--- | :--- |
| 포레스트 | `structure/tree/rootedForest`, `structure/tree/unionFindForest` | `structure/forest/rootedForest`, `structure/forest/unionFindForest`; `tree/index.ts`는 더 이상 다시 내보내지 않습니다 |
| 오류 | 임시방편의 네이티브 오류 | `structure/error.ts`의 열다섯 클래스 계층. 클래스마다 브랜드 가드가 있고 `SemanticRangeError` 별칭도 있습니다 |
| 추정량 옵션 | 고정된 정의 | `mathematics/quantile.ts`가 `QuantileMethod`, `QuantileOptions`, `SkewnessEstimator`, `KurtosisEstimator`, `VarianceOptions`를 내보냅니다 |
| `quantile` | Hyndman–Fan 타입 1 | 타입 7 — R `quantile`, NumPy `linear`, Excel `PERCENTILE.INC` |
| `skewness` / `kurtosis` | `g1` / `g2` | 편향 보정된 `G1` / `G2` |
| `variance` / `standardDeviation` | `ddof = 0` | `ddof = 1`, `Optional`로 감쌈 |
| `decibel` | 단일 `20·log10` 함수 | 제거됨; `amplitudeDecibel`(20·log10)과 `powerDecibel`(10·log10)로 분리 |
| `Spectrum.flatness()` | 양쪽 반쪽의 진폭 | 단측 반쪽의 파워 |
| `Spectrum.bandEnergy()` | 원시 양측 합 | 기본이 단측이며 켤레 반쪽을 접습니다 |
| `shortTimeFourierTransform` / `spectrogram` | 대칭 Hann, 완전한 프레임만 | 주기 Hann, `boundary: "zeros"`, `padded: true` |

6, 7, 10장이 대체물을 설명합니다. 측정된 영향은 [CHANGELOG.md](./CHANGELOG.md)에 있습니다.

---

<a id="3-quick-start"></a>
## 3. 빠른 시작

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
## 4. 팩토리 함수

생성은 항상 O(1)입니다 — 팩토리는 제너레이터만 감쌉니다. 표는 `n`개 요소를 *소비*하는 비용과, 소스 자체가 필요로 하는 추가 공간을 명시합니다.

| 팩토리 | 시그니처 (결과) | 시간 (n 소비) | 공간 (소스) | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | 인덱스는 0..n−1입니다. 전개 인자는 이미 구체화되어 있습니다 |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | 어떤 이터러블이든 감쌉니다. 수집 시 한 번 이터레이션됩니다 |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end`는 배타적입니다. `step`은 0이 아니어야 합니다. `number`와 `bigint` 모두 동작합니다 |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | 공급자는 요소마다 한 번 호출됩니다 |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | `concat`의 항등 요소 |
| `useText` | `useText(text, delimiter?)` | O(n) | 텍스트에 대해 O(n) | **코드 포인트** 단위로 이터레이션하므로, 이모지와 CJK는 단일 요소로 유지됩니다 |
| `useAttribute` | `useAttribute<T>(object)` | O(v + e) | O(d + v) | 순환 보호와 함께 중첩 객체를 재귀적으로 순회합니다 |
| `useGenerate` | `useGenerate<E>(supplier, interrupt)` | O(n) × 공급자 비용 | O(1) | 정지 `interrupt` 또는 하류의 `limit`이 **반드시** 필요합니다 |
| `useIterate` | `useIterate<E>(Iterable<E>)` / `(AsyncIterable<E>)` | 수집당 O(n) | O(1) | 수집마다 이터레이터를 재생합니다 |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period (실시간) | O(1) | 경과 시간을 방출합니다 |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | 인덱스 `0n`의 단일 요소 |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob 크기) | 사본당 O(chunk) | 기본 청크는 64 KiB입니다 |
| `useSubscription` | `useSubscription(target, subscriber, event) → AsynchronousSemantic<Event>` | 이벤트당 요소 하나 | O(1) | `limit()` / `takeWhile()`이 구독 해제 경계를 정의합니다 |

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
## 5. 변환 연산자

모든 연산자는 새로운 `Semantic`을 반환하며, 콜렉터블이 실행되기 전까지 어떤 연산자도 요소를 건드리지 않습니다. 시간은 **요소당** 추가 비용이고, 공간은 파이프라인이 실행되는 동안 연산자가 유지하는 메모리입니다.

| 연산자 | 목적 | 인덱스 효과 | 시간 | 공간 |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | 1:1 변환 | forwarded | O(1) | O(1) |
| `filter(predicate)` | 일치하는 요소 유지 | forwarded | O(1) | O(1) |
| `flat(mapper)` / `flatMap(mapper)` | 1:N 평면화 | re-indexed from 0 | 방출당 O(1) | O(1) |
| `distinct(keyExtractor?)` | 반복 키 제거, 첫 번째 유지 | forwarded | O(1) average | O(n) |
| `peek(consumer)` | 부수 효과, 요소는 그대로 통과 | forwarded | O(1) | O(1) |
| `limit(count)` | 앞의 *n*개 취함 | re-indexed from 0 | O(1) | O(1) |
| `skip(count)` | 앞의 *n*개 버림 | forwarded | O(1) | O(1) |
| `sub(start, end)` | 위치 기반 슬라이스 `[start, end)` | forwarded | O(1) | O(1) |
| `takeWhile(predicate)` | 술어가 유지되는 동안 취함 | forwarded | O(1) | O(1) |
| `dropWhile(predicate)` | 술어가 유지되는 동안 버림 | re-indexed from 0 | O(1) | O(1) |
| `concat(other)` | 시맨틱이나 이터러블 덧붙임 | continues the index | O(1) | O(1) |
| `redirect(redirector)` | 원하는 방식으로 새 인덱스 계산 | **yours** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | negated and shifted | O(1) | O(1) |
| `translate(offset \| mapper)` | 모든 인덱스 이동 | `i + offset` | O(1) | O(1) |
| `shuffle(mapper?)` | 인덱스 무작위화 | random | O(1) | O(1) |
| `pipe(conversion)` | 제너레이터를 사용자 정의 함수에 전달 | up to you | yours | yours |
| `semantic()` | 콜렉터블을 다시 시맨틱으로 승격 | unchanged | O(1) | O(1) |

**`reverse`, `translate`, `shuffle`는 인덱스만 다시 씁니다.** `toOrdered()`가 인덱스를 요소 수로 나머지 연산하여 정규화하기 전까지는 아무것도 버퍼링되거나 회전하지 않습니다:

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

---

<a id="6-collectables-and-terminal-operations"></a>
## 6. 콜렉터블과 터미널 연산

### 6.1 콜렉터블

콜렉터블은 **순서**와 **인덱스 장부**를 모두 소유합니다. `n`은 요소 개수입니다.

| 콜렉터블 | 구조 | 시간 | 순서 | 사용 시점 |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | 인덱스로 키가 지정된 `Map<bigint, E>` | O(n) | insertion | 최대 처리량; 원시 인덱스가 그대로 보존됨 |
| `toOrdered()` | 요소 인덱스로 정렬된 배열 | O(n log n) | by normalised index | 역순/회전이 반영되어야 할 때 |
| `toOrdered(comparator)` | 사용자 비교자로 정렬 | O(n log n) | by your comparator | 정렬된 뷰 |
| `toNumericStatistics()` | 값으로 정렬된 버퍼 | O(n log n) | by value | `number`에 대한 통계 |
| `toBigintStatistics()` | 값으로 정렬된 버퍼 | O(n log n) | by value | `bigint`에 대한 통계 |
| `toWindow()` | 값으로 정렬된 버퍼 | O(n log n) | by value | `slide` / `tumble` |
| `toCollectable(mapper)` | 매퍼가 반환하는 것 | — | — | 사용자 정의 콜렉터블 |

### 6.2 터미널

모든 터미널은 `Semantic`이 아니라 **콜렉터블** 위에 있습니다. "터미널은 명시적이다"라는 말의 실제 의미가 이것입니다. 콜렉터블을 지정하기 전까지 파이프라인은 아무것도 만들지 않으며, 매퍼 없는 `toCollectable()`이 가장 저렴한 지정 방법입니다.

| 터미널 | 반환 | 시간 | 비고 |
| :--- | :--- | :--- | :--- |
| `toArray()` / `toSet()` | `Array<E>` / `Set<E>` | O(n) | 버퍼를 비웁니다. `toSet`은 동일성 기준으로 중복을 제거합니다 |
| `toMap(key, value?)` | `Map<K, V>` | O(n) average | 마지막 쓰기가 우선 |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | 버퍼가 이미 알고 있습니다 |
| `forEach(action)` | `void` | O(n) | `action(element, index)` |
| `join(…)` | `string` | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `reduce(…)` | `Optional<E>` / `E` / `R` | O(n) | 빈 스트림 → 빈 `Optional` |
| `group(classifier)` / `groupBy(key, value)` | `Map<K, E[]>` | O(n) average | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | 인덱스 기준 라운드 로빈 |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | 버킷 번호는 분류자에서 옵니다 |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) worst, short-circuits | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | 구체화된 순서에서의 위치 기반 |
| `findAt(k)` / `findNegativeAt(k)` | `Optional<E>` | O(k) / O(n−k) | 앞에서부터 / 끝에서부터 셉니다 |
| `findMaximum(cmp?)` / `findMinimum(cmp?)` | `Optional<E>` | O(n) | 기본값은 구조적 비교 |
| `frequency()` | `Map<E, bigint>` | O(n) average | 통계 콜렉터블 전용 |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | IO 유사 터미널 |
| `collect(collector)` | `R` | O(n) | 위의 모든 터미널을 뒷받침하는 범용 폴드 |

### 6.3 구조 콜렉터

`toArray`, `toSet`, `toMap`은 파이프라인을 JavaScript 컨테이너로 끝냅니다. 나머지 열둘의 터미널은 라이브러리 자체 구조 중 하나로 끝냅니다. 그래서 결과는 배열이 우연히 지니는 불변량이 아니라 그 구조가 보장하는 불변량을 지닙니다. 이들은 모든 콜렉터블에서 사용할 수 있으며, `toCollectable()`이 주는 맨 콜렉터블도 포함됩니다.

| 터미널 | 반환 | 순서 | 비용 |
| :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | 순회 순서 | O(n) |
| `toSet()` | `Set<E>` | 삽입 순서, SameValueZero | 평균 O(n) |
| `toMap(key, value?)` | `Map<K, V>` | 삽입 순서; 마지막 쓰기 우선 | 평균 O(n) |
| `toOrderedSet(comparator?)` | `SynchronousOrderedSet<E>` | 비교자 오름차순 | 최악 O(n²) |
| `toUnorderedSet()` | `SynchronousUnorderedSet<E>` | 미지정(해시 버킷) | 기대 O(n) |
| `toOrderedMap(key, value?)` | `SynchronousOrderedMap<K, V>` | 삽입 순서; 마지막 쓰기 우선 | 기대 O(n) |
| `toUnorderedMap(key, value?)` | `SynchronousUnorderedMap<K, V>` | 미지정 | 기대 O(n) |
| `toList()` | `SynchronousList<E>` | 순회 순서, 중복 유지 | O(n) |
| `toRing(span?)` | `SynchronousRing<E>` | 순회 순서가 링 위의 위치를 정합니다 | O(n) |
| `toLRUSet(capacity)` | `SynchronousUnorderedLRUSet<E>` | 최근 사용 순; 마지막 `capacity`개만 남습니다 | 최악 O(n²) |
| `toLRUMap(capacity, key, value?)` | `SynchronousUnorderedLRUMap<K, V>` | 최근 사용 순 | 기대 O(n) |
| `toSkipSet(comparator?)` | `SynchronousSkipSet<E>` | 비교자 오름차순, 탐색 가능 | 최악 O(n²) |
| `toSkipMap(key, value?)` | `SynchronousSkipMap<K, V>` | 키 비교자 순, 탐색 가능 | 기대 O(n) |
| `toBinarySearchTree(comparator?)` | `SynchronousBinarySearchTree<E>` | 비교자 오름차순, 높이 균형 | O(n log n) |
| `toRootedForest()` | `SynchronousRootedForest<E>` | 순회 순서가 곧 구조 순서 | O(n) |

결과 타입은 콜렉터블 자체의 요소 타입을 따르므로 어떤 터미널도 타입 인자를 받지 않습니다. `SynchronousCollectable<E>`는 `Array<E>`, `SynchronousList<E>`, `SynchronousOrderedSet<E>`를 그대로 건넵니다. 남는 것은 업무 인자뿐입니다 — `toOrderedSet` / `toSkipSet` / `toBinarySearchTree`의 비교자, LRU 쌍의 용량, `toRing`의 스팬, 그리고 맵 계열의 키와 값 추출기입니다.

링은 집합이므로 중복 요소는 처음 위치만 유지합니다. 나머지 구조는 자체 계약이 달리 정하지 않는 한 중복을 유지합니다(`toOrderedSet`, `toUnorderedSet`, `toSkipSet`은 집합이고, `toBinarySearchTree`와 `toList`는 아닙니다).

```typescript
const numbers = useOf(3, 1, 4, 1, 5).toCollectable();

numbers.toOrderedSet().toArray();                        // [1,3,4,5]
numbers.toUnorderedSet().size();                         // 4n — the duplicate 1 collapses
numbers.toList().toArray();                              // [3,1,4,1,5]
numbers.toSkipSet().first().get();                       // 1 — navigable by comparator
numbers.toBinarySearchTree().size();                     // 5n — duplicates retained
numbers.toRootedForest().getRoots().length;              // 1
useOf(1, 2, 3).toCollectable().toRing().phaseAt(3n).get().toDegreeValue();      // 0
useOf(3, 1, 3).toCollectable().toOrderedMap(n => n, n => `v${n}`).get(3).get();  // "v3"
```

비동기 콜렉터블도 같은 터미널을 제공하며 각각을 promise로 해석합니다. 따라서 호출 형태에는 `await`가 하나 더 붙을 뿐입니다.

---

<a id="7-statistics-and-windows"></a>
## 7. 통계와 윈도우

### 7.1 통계 표면

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();                    // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();                    // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();                     // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                       // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance().get();             // 3.2    (n − 1)
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation().get();    // 1.7889 (n − 1)
```

두 통계 계열은 같은 표면을 노출합니다 — `summate`, `average`, `median`, `mode`, `variance`, `standardDeviation`, `frequency`, `findMaximum`, `findMinimum` — 그리고 `toBigintStatistics()`에서는 `bigint` 산술을 씁니다. 산포 측도와 분위수 계열은 `Optional`을 반환합니다. 표본이 너무 작아 정의되지 않을 수 있기 때문입니다. `.get()`, `.orElse(…)`, `.isPresent()`로 꺼내세요.

### 7.2 추정량과 기본 정의

기본값은 R, NumPy, pandas, Excel이 쓰는 정의 그대로입니다. 따라서 여기서 계산한 값은 보정 계수 없이 그 도구들과 비교할 수 있습니다.

| 통계량 | 기본 | 이전 | 옛 값을 얻으려면 |
| :--- | :--- | :--- | :--- |
| `quantile(probability)` | Hyndman–Fan 타입 7 | 타입 1 | `{ method: "type-1" }` |
| `interquartileRange()` | Hyndman–Fan 타입 7 | 타입 1 | `{ method: "type-1" }` |
| `skewness()` | 편향 보정된 `G1` | `g1` | `{ estimator: "g1" }` |
| `kurtosis()` | 편향 보정된 초과 `G2` | `g2` | `{ estimator: "g2" }` |
| `variance()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |
| `standardDeviation()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |

아홉 가지 Hyndman–Fan 타입은 모두 `"type-1"` … `"type-9"`로 쓸 수 있고, `{ excess: false }`는 첨도에 3을 다시 더해 비초과 사차 표준화 모멘트를 보고합니다. 이 옵션 타입들 — `QuantileMethod`, `QuantileOptions`, `SkewnessEstimator`, `KurtosisEstimator`, `VarianceOptions` — 은 `mathematics/quantile.ts`에서 내보냅니다.

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

`G1`과 `G2`는 각각 관측치가 셋, 넷 미만이면 정의되지 않으며, `ddof = 1`의 표본 분산과 표준편차는 둘 미만에서 정의되지 않습니다. 그럴 때 라이브러리는 오해를 부르는 0이 아니라 빈 `Optional`을 돌려줍니다.

```typescript
useOf(1, 2, 3).toNumericStatistics().kurtosis().isEmpty();     // true  (G2 needs four observations)
useOf(1, 2).toNumericStatistics().skewness().isEmpty();        // true  (G1 needs three)
useOf(1).toNumericStatistics().variance().isEmpty();           // true  (ddof = 1 needs two)
useOf(1).toNumericStatistics().variance({ ddof: 0 }).get();    // 0
```

bigint 뷰도 같은 옵션을 받아들이고 모든 결과를 정수 `bigint`로 반올림합니다.

### 7.3 윈도우

윈도우는 버퍼의 요소를 "파이프라인의 파이프라인"으로 다시 노출합니다. 그래서 윈도우를 배열로 구체화하지 않고 소비할 수 있습니다. 두 형식 모두 마지막의 부분 윈도우를 포함합니다.

```typescript
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[2,3],[3,4],[4]]

useFrom([1, 2, 3, 4]).toWindow().tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[3,4]]
```

---

<a id="8-the-index-model"></a>
## 8. 인덱스 모델

인덱스는 모든 요소에 붙는 `bigint`입니다. 연산자는 인덱스를 **전달**하거나, 0부터 **재인덱싱**하거나, 직접 **계산**하도록 맡깁니다.

ordered 수집은 각 인덱스를 요소 수로 나머지 연산하여 정규화한 뒤, 그 결과로 정렬합니다. 요소가 다섯 개일 때 `translate(7)`이 `translate(2)`와 같은 이유입니다: `7 ≡ 2 (mod 5)`.

unordered 수집은 파이프라인이 만들어 낸 인덱스를 그대로 유지하고 요소를 도착 순서대로 반환합니다. 음수 인덱스도 합법이며, 정규화되고 나면 음이 아닌 인덱스보다 앞에 정렬될 뿐입니다.

---

<a id="9-the-asynchronous-model"></a>
## 9. 비동기 모델

`AsynchronousSemantic`은 동기 측의 표면을 그대로 비추며 promise를 반환합니다. 쓰기는 큐에 쌓이므로, 쓰기 이후에 발행된 읽기는 항상 그 쓰기를 관찰합니다.

```typescript
const ring = new AsynchronousRing([1, 2]);
const added   = ring.add(3);          // queued
const sampled = ring.elementAt(2n);   // observes the write above
await added;
(await sampled).get().element;         // 3
```

본질적으로 비동기인 팩토리(`usePromise`, `useBlob`, `useInterval`, `useSubscription`)는 `AsynchronousSemantic`을 직접 반환하고, `useFrom` / `useIterate`는 `AsyncIterable`을 받으면 스스로 비동기로 승격합니다.

---

<a id="10-periodic-analysis-rings-fields-and-scores"></a>
## 10. 주기 분석: 링, 필드, 스코어

라이브러리의 수학적 절반은 주기를 조회 표가 아니라 일급 객체로 다룹니다. 세 가지 구성이 함께 동작합니다.

### 10.1 링은 하나의 정수입니다

`Ring`은 **n중 링(n-fold ring)**입니다: 요소 개수, 위치 주기, 서로 다른 위상의 개수가 모두 같은 정수 `n`입니다. 어떤 위치의 위상은 정확한 나머지로부터 계산되므로, 링은 비트 단위까지 주기적입니다:

```typescript
import { SynchronousRing } from "semantic-typescript";

const ring = new SynchronousRing(["a", "b", "c", "d", "e", "f"]);
ring.phaseAt(0n).get().toDegreeValue();   // 0
ring.phaseAt(1n).get().toDegreeValue();   // 60
ring.phaseAt(6n).get().getValue() === ring.phaseAt(0n).get().getValue();   // true, exactly
ring.purity();                             // 1
ring.isBalanced();                         // true
ring.sequences().map(z => z.magnitude());  // [0, 6, 0, 0, 0, 0]
```

`frequency`는 위치 사이의 위상 간격이 아니라 **주변(ambient)** 회전 속도입니다: 환경이 모든 페이저(phasor)를 같은 각도만큼 움직이므로, 고유한 패턴을 결코 깨뜨릴 수 없습니다. `span`은 링이 차지하는 회전 수를 고정합니다.

`purity()`는 기본 모드(fundamental mode)가 나르는 에너지의 비율로, `max(|c₁|², |c_{n−1}|²) / (n · Σ|z|²)`입니다. 링이 회전을 무시하면 `n`차 단위근일 때 정확히 `1`이고, 두 개의 빈만 필요하므로 `O(n)`입니다. 링은 원을 어느 방향으로도 돌 수 있으므로 양방향을 모두 검사합니다.

### 10.2 필드는 유계 스코어입니다

`PhaseField`는 상대 위상을 `[-1, 1]` 범위의 스코어로 매핑합니다:

```typescript
import { useField, useRadian } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ): +1 aligned, −1 opposed
const mixed  = useField([0.4, 0.3, 0.3]);  // first three harmonics

cosine.sample(useRadian(0));               //  1
cosine.sample(useRadian(Math.PI));         // -1
```

스코어는 절단된 코사인 급수 `a₀ + Σ wₘ·cos(2πmΔ)`이며, 생성자는 `|a₀| + Σ|wₘ| ≤ 1`을 강제합니다. 삼각 부등식에 의해 스코어는 `[-1, 1]`을 벗어날 수 없습니다 — 이 경계는 나중에 적용하는 클램프가 아니라 **구성의 필연적 결과**입니다.

필드가 표가 아니라 급수인 이유는 이렇습니다: `n`점 표는 자기 자신의 샘플을 정확히 재현하지만, 그 삼각 보간자는 샘플 사이에서 오버슈트합니다. `[+1, +0.5, −1, −0.5, 0]` 점수를 가진 5점 표는 `[−1.0428, 1.0041]` 구간으로 보간되는데, 이는 이미 약속을 깨뜨립니다. 경계가 있는 급수는 그럴 수 없습니다.

### 10.3 분석은 데이터를 모든 요소에 견주어 측정합니다

각 링 요소는 하나의 참조 위상입니다. `analyse`는 모든 관측값의 위치를 링 위에서 되짚어 찾아내고, 각 참조에 대해 측정합니다:

```typescript
const ring = new SynchronousRing(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                              // 5
report.missed;                               // 1  ('zz' is not on the ring)
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

각 참조 행은 `count`, 평균 상대 위상 `mean`, 평균 합성 길이(mean resultant length) `resultant`를 보고합니다. 기억해 둘 만한 항등식이 하나 있습니다: **`resultant`는 모든 참조에서 동일합니다**. 기준선을 바꾸는 일은 모든 상대 위상을 상수만큼 회전시킬 뿐이기 때문입니다. 참조마다 달라지는 것은 개수와 평균입니다.

```typescript
const ring = new SynchronousRing(["a", "b", "c"]);
ring.scoresAt(0, cosine);                   // one score per position, in [-1, 1]
```

### 10.4 관련 도구

| 호출 | 답하는 것 | 비용 |
| :--- | :--- | :--- |
| `purity()` | 링이 아직 `n`차 단위근인가? | O(n) |
| `resultant(t?)` | 지금 페이저들이 얼마나 집중되어 있는가? | O(n) |
| `analyse(data)` | 이 데이터가 각 요소에 대해 어떻게 놓이는가? | O(n · m) |
| `toSpectrum()` | 주파수 축에 파수를 둔 링의 스펙트럼 | O(n²) |
| `useAngularSpectrum(ring, instants, plan)` | 시간에 따른 `(ω, n)` 평면 | O(n² · frames) |

모델을 완성하는 프리미티브가 두 개 더 있습니다: `combineRings(a, b)`는 두 링을 최소공배수 위에서 결합하며(곱이 아닌 당김(pullback)입니다 — 같은 순간을 공유할 수 없는 쌍은 그냥 존재하지 않습니다), `rate()`는 각 요소에 고유 주파수를 부여하여 링이 환경에 대해 표류할 수 있게 합니다. `jetAt`, `windingAt`, `errorIntegralAt`은 그 표류의 미분 상태를 노출합니다.

### 10.5 스펙트럼 윈도우

링 구성은 해석 표면의 절반이고, 나머지 절반은 샘플링된 신호를 다룹니다. 가장 많이 재사용되는 프리미티브는 윈도우 함수이며, 여기 있는 모든 모양에는 두 가지 형식이 있습니다. 대칭 형식은 프레임을 `count − 1`로 나누고, 주기(DFT-even) 형식은 `count`로 나눕니다. 후자는 완전한 한 주기보다 한 샘플 짧아서, DFT가 전제하는 주기적 확장 아래에서 테이퍼가 연속이 됩니다.

```typescript
useHannWindow(1, 4);                                   // 0.75  symmetric
useHannPeriodicWindow(1, 4);                           // 0.5   periodic
coherentGain(useHannPeriodicWindow, 16);               // 0.5
equivalentNoiseBandwidth(useHannPeriodicWindow, 16);   // 1.5
```

| 모양 | 대칭 | 주기 | 비고 |
| :--- | :--- | :--- | :--- |
| 사각 | `useRectangularWindow` | — | 테이퍼 없음; 주기 구분 없음 |
| Hann | `useHannWindow` | `useHannPeriodicWindow` | 단시간 변환의 기본 |
| Hamming | `useHammingWindow` | `useHammingPeriodicWindow` | — |
| Blackman | `useBlackmanWindow` | `useBlackmanPeriodicWindow` | — |
| Nuttall | `useNuttallWindow` | `useNuttallPeriodicWindow` | 4항 Blackman–Harris |
| 플랫톱 | `useFlatTopWindow` | `useFlatTopPeriodicWindow` | 분해능보다 진폭 정확도 |
| Kaiser | `useKaiserWindow(beta)` | `useKaiserPeriodicWindow(beta)` | `beta`가 주엽 폭을 정합니다 |

해석과 중첩 덧셈에는 주기 형식을 쓰세요. 반 프레임 홉에서 주기 Hann 윈도우는 어떤 길이에서도 합이 `1.000000`이지만, 대칭 형식은 `N = 16`에서 `0.841 dB`, `N = 1024`에서도 `0.013 dB` 출렁입니다. 필터 설계에는 대칭 형식을 남겨 두세요. 거기서 프레임은 테이퍼의 한 주기가 아닙니다.

플랫톱 윈도우는 프레임 양 끝에서 **음수 가중치**를 반환합니다. 플랫톱 윈도우는 정의상 그렇기 때문입니다. 0으로 자르지 않고 그대로 반환합니다. 자르면 주엽이 흐트러지고, 이 윈도우가 존재하는 유일한 이유인 낮은 스캘럽 손실이 무너지기 때문입니다.

```typescript
useFlatTopWindow(0, 1024);                             // -0.000421 — negative by definition
Array.from({ length: 1024 }, (_unused, index) => useFlatTopWindow(index, 1024))
  .filter(weight => weight < 0).length;                // 578
```

### 10.6 레벨, 평탄도, 대역 에너지

`decibel`은 단일 함수로서 사라졌습니다. 진폭과 파워는 같은 인자를 공유하지 않기 때문입니다. `amplitudeDecibel`은 전압 같은 비율에 `20·log10`을 적용하고, `powerDecibel`은 파워, 에너지, 평균 제곱, 파워 스펙트럼 밀도에 `10·log10`을 적용합니다.

```typescript
amplitudeDecibel(0.25);                                // -12.0412
powerDecibel(0.25);                                    //  -6.0206
```

`Bin.decibel`과 `Spectrum.decibelOf`는 진폭 레벨이고, `Spectrum.powerDecibelOf`가 대응하는 파워 레벨입니다. 파워를 진폭 형식에 넣으면 `20·log10(power)`를 보고하여 데시벨 값을 두 배로 만듭니다.

두 가지 스펙트럼 측정의 읽는 법이 바뀌었습니다.

```typescript
const twoBins = new Spectrum(new Sample(2, 1), [new Complex(2, 0), new Complex(1, 0)]);
twoBins.flatness();                                    // 0.8 — geometric over arithmetic mean of power

const shape = new Spectrum(new Sample(4, 1), [
  new Complex(1, 0), new Complex(2, 0), new Complex(0, 0), new Complex(0, 0),
]);
shape.bandEnergy(new Frequency(0), new Frequency(2));                // 9
shape.bandEnergy(new Frequency(0), new Frequency(2), "two-sided");   // 5
```

`flatness()`는 스펙트럼의 단측 반쪽에서 `power()`의 기하평균과 산술평균을 비교합니다. 양쪽 반쪽의 진폭 평균이 아니며, `oneSided()`의 표시 전용 진폭 두 배도 의도적으로 적용하지 않습니다. `bandEnergy()`는 기본이 단측 읽기로, 켤레 반쪽을 접어 DC와 나이퀴스트는 한 번, 내부 빈은 두 번 셉니다. 축 전체를 덮는 대역은 이로써 Parseval, `Σ|X|² = N·Σx²`을 만족합니다. 복소 스펙트럼에는 `"two-sided"`를 넘기세요. 그 빈들은 이미 독립입니다.

### 10.7 단시간 분석

`Sampler.shortTimeFourierTransform`과 `Sampler.spectrogram`은 SciPy `stft` 관례를 따릅니다. 주기 Hann 윈도우, 양 끝의 0 경계, 그리고 꼬리의 0 채우기입니다.

```typescript
const sampler = new Sampler(new Sample(64, 1));
const spectrogram = sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8);

spectrogram.size();                     // 9 frames
spectrogram.getBoundary();              // "zeros"
spectrogram.getTime(6);                 // 0.75 — frame centres, not frame starts
sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8, useHannWindow,
  { boundary: "none", padded: false }).size();                       // 7 — complete frames only
```

양 끝 확장은 첫 프레임을 첫 샘플에 중심을 맞추고, 꼬리 채우기는 마지막 샘플들을 도달 가능하게 만듭니다. 64 샘플, 프레임 16, 홉 8이면 7이 아니라 9 프레임이 나오고, 1000 샘플, 프레임 256, 홉 128이면 6이 아니라 9 프레임이 나옵니다. 프레임 시각은 시작이 아니라 중심입니다 — 확장된 뷰에서는 `(k·hop + (frameSize mod 2)/2)/rate`, 확장되지 않은 뷰에서는 `(k·hop + frameSize/2)/rate` — 그리고 `toFrame()`은 역변환 전에 확장을 잘라냅니다.

---

<a id="11-utility-helpers"></a>
## 11. 유틸리티 헬퍼

### 11.1 오류 계층

`structure/error.ts`는 파이프라인 **주변**에서 던져지는 오류 — 여러분의 코드, 사용자 정의 콜렉터, 어댑터에서 — 를 위한 열다섯 클래스 계층을 내보냅니다.

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

각 클래스는 `name`을 고정하고 네이티브 `cause`를 전달하며 선택적 `context` 진단 묶음을 지니고 `toJSON()`으로 직렬화합니다. 그리고 같은 이름의 브랜드 가드를 가집니다.

```typescript
const error = new CapacityError("LRU capacity exhausted", { context: { capacity: 0 } });

error.name;                 // "CapacityError"
isCapacityError(error);     // true
isValidationError(error);   // false — a capacity failure is not a validation failure
isSemanticError(error);     // true
error.toJSON();             // { name: "CapacityError", message: "…", context: { capacity: 0 } }
```

`SemanticRangeError`는 내보내는 `RangeError`와 같은 클래스이므로 `instanceof`가 두 이름 모두에서 성립합니다. `RangeError`를 가져오면 모듈 전체에서 전역 생성자를 가리기 때문에 이 별칭이 존재합니다. 두 클래스 모두 라이브러리 자체의 인자 검사에서 던져지지 않습니다. 거기서는 여전히 네이티브 `TypeError`와 `RangeError`가 나옵니다. 이 계층은 그 위 계층을 위한 어휘입니다.

### 11.2 도구 표

| 헬퍼 | 목적 |
| :--- | :--- |
| `useCompare(a, b)` | 혼합 프리미티브 전반의 전순서 |
| `useToNumber` / `useToBigInt` | 무손실, 범위 검사가 적용된 숫자 변환 |
| `useRandom` | 시드 기반 또는 비시드 난수 헬퍼 |
| `useTraverse` | 중첩 객체와 배열의 구조적 순회 |
| `useStringify` | 순환 안전 JSON 직렬화 |
| `useHash` / `maskOf` / `register` / `unregister` | 구조적 해싱과 해시 전략 레지스트리 |
| `invalidate` / `validate` | 일관된 오류 형태를 던지는 가드 절 |
| `Optional<T>` | 라이브러리의 `null` 대체물: `Optional.of(x)` / `Optional.empty()` |

### 11.3 `useTraverse`

`useTraverse(target, callback)`는 임의의 객체를 **널이 아닌 리프**의 나열로 평탄화합니다. 중첩 객체를 내려가고, 이터러블 값은 위치별로 순회하며, `null`과 `undefined`는 건너뛰고, 이미 방문한 객체에는 다시 들어가지 않습니다. 따라서 순환이 있는 객체 그래프도 스택을 넘치게 하지 않고 끝납니다.

```typescript
const source = { id: 7, tags: ["a", "b"], owner: { name: "Ada", note: null } };
const leaves: string[] = [];

useTraverse(source, (key, value, path) => {
  leaves.push(`${path.join(".")} = ${String(value)}`);
  return true;
});

leaves;   // ["id = 7", "tags.0 = a", "tags.1 = b", "owner.name = Ada"]
```

콜백은 리프마다 한 번 실행되며, 그 리프 자신의 키(이터러블에서 온 경우 그 인덱스), 값, 그리고 거기까지의 경로를 받습니다. `false`를 반환하면 현재 가지만이 아니라 **순회 전체**를 포기합니다.

```typescript
let visited = 0;
useTraverse({ a: 1, b: 2, c: 3 }, () => {
  visited += 1;
  return false;
});
visited;   // 1 — the first leaf already stops the walk
```

순환이 안전한 이유도 같습니다.

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

**콜백마다 독립적인 경로 스냅샷을 받습니다.** 순회는 내부에 작업 배열 하나만 두고, 리프를 넘기는 순간 그것을 `Object.freeze`로 얼린 새 배열로 복사합니다. 스냅샷은 이후 바뀌지 않으므로 그대로 보관할 수 있고, 두 콜백이 같은 배열을 공유하지 않으며, 순회를 다시 해도 이미 넘긴 스냅샷은 흔들리지 않습니다. 타입이 `ReadonlyArray`이므로 쓰기는 컴파일 오류이고, 얼린 배열에 실행 중 쓰면 `TypeError`가 납니다. 이 안전성의 대가는 보고하는 리프마다 `O(depth)` 할당이 한 번 더 드는 것이며, 아무것도 보고하지 않는 가지에서는 추가 할당이 없습니다.

```typescript
const paths: Array<ReadonlyArray<PropertyKey>> = [];
useTraverse({ a: { b: 1 }, c: 2 }, (_key, _value, path) => {
  paths.push(path);                      // safe to keep as-is
  return true;
});
paths[0] === paths[1];                   // false — one array per call
paths.map(path => path.join("."));       // ["a.b", "c"]
```

`useAttribute`는 이 순회를 팩토리로 만든 것입니다. 같은 리프를 `{ key, value }` 쌍으로 보고하므로 규칙과 비용이 동일합니다.

```typescript
useAttribute({ a: 1, b: { c: 2 } }).toUnordered().toArray();
// [{ key: "a", value: 1 }, { key: "c", value: 2 }]
```

---

<a id="12-performance-and-pitfalls"></a>
## 12. 성능과 함정

**지연 평가는 단계마다 값을 치릅니다.** 연산자마다 제너레이터 홉이 하나씩 붙습니다. 메모리 내 배열을 도는 빡빡한 숫자 루프에서는 평범한 `for` 루프가 어떤 파이프라인보다 빠릅니다. 파이프라인은 소스가 지연적이거나 무한할 때, 또는 인덱스 규율이 값을 할 만큼 파이프라인이 길 때 이깁니다.

**`toOrdered()`는 정렬하고 `toUnordered()`는 정렬하지 않습니다.** 역순이 "동작하지 않은" 것처럼 보인다면 콜렉터가 unordered였던 것입니다 — 인덱스 재작성은 인덱스가 정규화될 때에만 순서가 됩니다.

**`interrupt` 없는 `useGenerate`는 끝나지 않습니다.** 항상 정지 술어나 하류의 `limit` / `takeWhile`을 함께 주세요.

**`Ring`은 삽입 순서를 유지하는 집합입니다.** 요소는 유일하며 처음 추가된 순서를 유지합니다. 중복된 `add`는 `false`를 반환하고, 중복을 도입하게 될 `set`은 예외를 던집니다. 덕분에 위상은 요소가 우연히 차지한 위치가 아니라 *요소*의 함수가 될 수 있습니다.

**`Spectrum`의 단측 헬퍼는 실수 신호를 가정합니다.** `oneSided()`, `getNyquist()`, `centroid()`는 켤레 대칭을 가정합니다. 위상 링의 공간 스펙트럼은 복소수이며 일반적으로 대칭이 아닙니다 — 원을 거꾸로 도는 링은 모든 에너지를 나이퀴스트 너머인 `n − 1` 빈에 둡니다. 빈을 직접 읽으세요.

**구조 콜렉터는 뷰가 아니라 터미널입니다.** 각각은 파이프라인을 비운 뒤 완전한 구조를 만듭니다. 그래서 O(n) 시간과 O(n) 공간을 쓰며 무한 소스에서는 동작하지 않습니다. 파이프라인 끝에서 쓰고, 파이프라인을 도는 루프 안에서는 절대 쓰지 마세요.

**`variance()`와 그 동료들은 `Optional`을 반환합니다.** 너무 작은 표본에서 `variance().get()`을 호출하면 예외가 납니다. 표본 크기를 스스로 통제할 수 없을 때는 `.orElse(0)`을 쓰거나 `.isPresent()`를 먼저 확인하세요. `standardDeviation`, `quantile`, `interquartileRange`, `skewness`, `kurtosis`도 마찬가지입니다.

**분석에는 주기 윈도우를 씁니다.** `useHannWindow` 같은 대칭 형식은 필터 설계용입니다. 단시간 변환에는 `useHannPeriodicWindow`와 그 동족이 필요합니다. 그렇지 않으면 중첩 덧셈의 합이 프레임이 만나는 곳마다 출렁입니다.

---

<a id="13-phase-rings"></a>
## 13. 위상 링: 정확한 주기

10장은 링을 "주기"의 모델로 소개하고 데이터 집합을 모든 위상에 비추어 재는 데 사용했다. 이
장은 완전한 표면을 준다. 위치가 어떻게 각도가 되는지, 환경 회전이 무엇을 바꾸고 무엇을 바꾸지
않는지, 그리고 링을 시간에, 데이터에, 또 다른 링에 비추어 읽는 도구들이다.

`SynchronousRing`은 위치 목록이며, 그 밑에는 머리와 꼬리가 이어진 원형 이중 연결 리스트가
있다. 동시에 삽입 순서의 *집합*이다. 같은 원소는 두 번 나타나지 않고, 거부된 쓰기는 링크도
샘플도 바꾸지 않는다. 이것을 단순한 목록이 아니라 링으로 만드는 것은 위치의 위상이 현재 길이에
대한 나머지로만 결정된다는 점이다. 그래서 링은 비트 단위로 주기적이고 균형은 표류하지 않는다.

### 13.1 하나의 정수를 정확히 계산한다

링은 `n`개의 원소를 가지며, 원소 수·위치 주기·서로 다른 위상의 수가 같은 정수다. 위치 `i`의
위상은

`phase + span · 2π · (((i mod n) + n) mod n) / n`

이고, 나머지는 `number`가 되기 전에 `bigint`에서 환원된다. `phaseAt(i)`와 `phaseAt(i + n)`이
단지 가까운 것이 아니라 *비트 단위로 동일*한 이유가 이것이다. 두 번째 호출은 같은 정수로
환원되고 같은 곱을 평가하며 같은 배정밀도 값을 낳는다. `number`의 정확한 정수 범위를 훨씬
넘는 인덱스도 올바른 위치에 닿고, 음수 인덱스는 링을 거꾸로 걷는다.

| 호출 | 반환 | 의미 |
| :--- | :--- | :--- |
| `new SynchronousRing(source, options?)` | 링 | `source`는 임의의 반복 가능 객체, 중복은 버림 |
| `getPhase()` / `getFrequency()` / `getSpan()` | `Angle`, `Frequency`, `number` | 세 가지 구성 매개변수 |
| `size()` | `bigint` | 주기이기도 한 `n` |
| `phaseAt(index)` | `Optional<Angle>` | 고유 위상만; 시간·속도·주파수 무시 |
| `elementAt(index)` | `Optional<RingElement>` | 원소, 고유 위상, 환경 주파수, 페이저 |
| `frequencyAt(index)` | `Optional<Frequency>` | 환경 회전, 빈 링에서는 빈 값 |
| `toComplex()` / `toComplex(index)` | `Complex[]` / `Optional<Complex>` | 고유 페이저 |

`RingOptions`에는 원소별 함수가 둘 있다. `magnitude(element, index)`는 페이저 길이를 주며
기본값은 1이다. `rate(element, index)`는 원소 자신의 고유 주파수를 주며 기본값은 0, 즉 고정
마커다.

```typescript
import { SynchronousRing } from "semantic-typescript";

const ring = new SynchronousRing(["a", "b", "c", "d", "e", "f"]);

ring.size();                                                             // 6n
ring.phaseAt(0n).get().toDegreeValue();                                  // 0
ring.phaseAt(1n).get().toDegreeValue();                                  // 60
ring.phaseAt(-1n).get().toDegreeValue();                                 // 300
ring.phaseAt(6n).get().getValue() === ring.phaseAt(0n).get().getValue(); // true
ring.phaseAt(10n ** 20n).get().toDegreeValue();                          // 240
```

여섯 원소 링에서 `phaseAt(-1n)`은 `300`이고, `10n ** 20n`은 6으로 나눈 나머지가 `4`라서 `240`로
읽힌다. 둘 다 부동소수 곱을 누적하지 않는다. 인덱스 표현이 바뀌어도 항등식이 정확히 유지되는
이유다.

### 13.2 환경 회전과 한 순간의 상태

`frequency`는 링이 놓인 환경의 **환경 회전 속도**이며, 위치 사이의 위상 걸음이 아니다. 환경은
모든 원소의 위상을 같은 각도만큼 진행시키므로 고유 무늬를 바꿀 수 없고, 균형을 깨뜨릴 수 없고,
어떤 `phaseAt` 결과도 바꿀 수 없다. 기본값은 `0 Hz`다.

`relativeAt(index, time)`은 그 공통 각도를 빼서 `PhaseField`가 점수 매기는 좌표를 남긴다.
`viewAt`과 `viewsAt`은 원소 자신의 `rate`까지 포함한 완전한 상태를 반환하고, 미분 접근자는
드리프트를 드러낸다.

| 호출 | 공식 | 읽는 것 |
| :--- | :--- | :--- |
| `relativeAt(index, time)` | `고유 위상 + 자신 속도 · t − 환경 회전 · t` | 환경이 보는 위상 |
| `viewAt(index, time)` / `viewsAt(time)` | 위에 원소·인덱스·시간·속도·페이저를 더함 | 완전한 상태 |
| `jetAt(index, time)` | `t`의 위상, 자신 속도, `slip = 자신 속도 − 환경 회전` | 미분 상태 |
| `windingAt(index, time)` | `trunc(slip · t)` | 미끄러진 정수 회전, 0 방향 절단 |
| `errorIntegralAt(index, time, origin?)` | `∫ 상대 위상 dt`, 단위 회전 · 초 | 얼마나 앞서거나 뒤졌는가 |
| `resultant(time?)` | `abs(Σ w · e^{iθ}) / Σ w` | 위상 집중도, 환경 회전에 영향 없음 |
| `analyse(data, time?)` | 참조별 계수와 평균 | 데이터를 각 원소에 비추어 잼 |
| `scoreAt(index, time, field)` / `scoresAt(time, field)` | 상대 위상으로 장을 표본화 | 위치별 유계 점수 |

```typescript
import { SynchronousRing, useHertz } from "semantic-typescript";

const moving = new SynchronousRing(["a", "b", "c", "d", "e", "f"], {
  frequency: useHertz(1),
});

moving.getFrequency().getHertz();                        // 1
moving.phaseAt(1n).get().toDegreeValue();                // 60 — intrinsic
moving.relativeAt(1n, 0.25).get().toDegreeValue();       // 330 — 60 − 90
moving.viewAt(1n, 0.25).get().relative.toDegreeValue();  // 330
moving.jetAt(1n, 0.25).get().slip;                       // -1
moving.purity();                                         // 1 — rotation cannot break it
```

`1 Hz`에서 환경은 `0.25 s`에 사분의 일 회전을 진행하므로 위치 하나의 상대 위상은
`60 − 90 = 330`도가 되고, 고유 위상은 `60` 그대로다. 원소 자신은 움직이지 않으므로 jet의
`slip`은 `-1`헤르츠이고, `purity()`는 여전히 `1`이다. 모든 페이저를 같은 각도로 돌리는 것은
변형이 아니다.

### 13.3 순도와 균형

`purity()`는 링 에너지 중 기본 모드가 나르는 몫이다.

`max(abs(c₁)², abs(c_{n−1})²) / (n · Σ abs(z)²)`

링은 어느 방향으로든 원을 따라갈 수 있으므로 두 기본 빈을 모두 본다. 여섯 원소에 `span: 5`인
링은 한 걸음이 `300`도, 즉 `−60`도다. 거꾸로 달리며 모든 에너지를 `c₅`에 두므로, `c₁`만 보는
공식은 그것을 불순하다고 오판한다. 필요한 것은 이 두 빈과 전체 에너지뿐이므로 비용은
`O(n)`으로 유지된다.

경계 처리도 계약의 일부다. 두 원소 미만의 링에는 기본 모드가 없어 내용과 무관하게
`purity() === 0`과 `isBalanced() === false`를 보고한다. 페이저 길이가 모두 0인 링은 에너지가
없어 마찬가지로 0을 보고한다. `isBalanced(epsilon?)`은 `1 − purity() <= epsilon`이며 기본
허용오차는 `1E-9`다.

```typescript
import { SynchronousRing } from "semantic-typescript";

const forward = new SynchronousRing(["a", "b", "c", "d", "e", "f"]);
const backward = new SynchronousRing(["a", "b", "c", "d", "e", "f"], { span: 5 });
const weighted = new SynchronousRing(["a", "b", "c", "d"], {
  magnitude: element => element === "a" ? 1 : 0,
});

forward.purity();                             // 1
backward.phaseAt(1n).get().toDegreeValue();   // 300 — it runs backwards
backward.purity();                            // 1 — the energy sits in c₅
new SynchronousRing(["only"]).purity();       // 0
new SynchronousRing(["only"]).isBalanced();   // false
weighted.purity();                            // 0.25
```

### 13.4 합성 길이와 대칭 성분

`resultant(time?)`는 평균 합성 길이다. 페이저 합의 크기를 크기 합으로 나눈 값이다. 링이 아직
`n`차 단위근인지를 묻는 `purity`와 달리, `resultant`는 지금 페이저가 얼마나 집중되었는지를
묻는다. 균형 링은 `0`을 보고한다. 모든 원소가 같은 각도를 공유하는 링이라면 `1`이지만, 집합
의미론이 중복 원소를 금지하므로 실제로는 `magnitude`가 하나만 남기고 모두 0으로 만들 때 `1`이
나타난다.

`zeroSequence()`는 평균 페이저, 즉 `c₀ / n`이다. `sequences()`는 직접 변환으로 `n`개의 대칭
성분을 낮은 차수부터 반환한다. `toSpectrum()`은 그것을 `Spectrum`에 담고, 빈 `j`는 링 한
회전당 `j` 주기를 보고하므로 주파수 축이 파수 축이 된다.

```typescript
import { SynchronousRing } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const ring = new SynchronousRing(["a", "b", "c", "d", "e", "f"]);

round(ring.resultant().get());                                        // 0
round(ring.zeroSequence().get().magnitude());                         // 0
ring.sequences().map(component => round(component.magnitude()));      // [0, 6, 0, 0, 0, 0]
ring.toSpectrum().get().size();                                       // 6
ring.toSpectrum().get().getResolution().getHertz();                   // 1
```

성분은 복소수이며 일반적으로 **켤레 대칭이 아니다**. 균형 링은 모든 에너지를 빈 하나에 두고,
거꾸로 가는 링은 빈 `n − 1`에 둔다. `Spectrum`의 단측 보조 함수는 실신호를 가정하므로 접지
말고 빈을 직접 읽어야 한다.

### 13.5 데이터를 각 원소에 비추어 분석한다

`analyse(data, time?)`은 각 관측을 동일성으로 링에 대응시키고 각 원소를 참조 위상으로 삼아
잰다. 링이 갖지 않은 관측은 추측하지 않고 `missed`로 센다. 위상의 유일한 원천이 링이기
때문이다. 각 참조 행은 `count`, 평균 상대 위상 `mean`, 평균 합성 길이 `resultant`를 보고한다.

기억할 만한 항등식이 하나 있다. **`resultant`는 모든 참조에서 같다**. 기준을 바꾸면 모든 상대
위상이 상수만큼 회전하고, 회전은 합성 길이를 바꿀 수 없다. 참조마다 다른 것은 계수와 평균이다.

```typescript
import { SynchronousRing } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const ring = new SynchronousRing(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                                                  // 5
report.missed;                                                   // 1
report.references.map(row => row.count);                         // [2, 0, 2, 0, 1]
report.references.map(row => round(row.resultant));              // [0.1453, 0.1453, 0.1453, 0.1453, 0.1453]
```

점수 매기기는 같은 동전의 뒷면이다. `PhaseField`는 유계 코사인 급수(10.2절)이고,
`scoreAt`/`scoresAt`은 상대 위상에서 그것을 표본화한다. 그래서 같은 링을 정렬에, 어떤 조화
무늬에, 또는 임의의 장에 대해 링 자체를 바꾸지 않고 점수 매길 수 있다.

```typescript
import { SynchronousRing, useField } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const ring = new SynchronousRing(["a", "b", "c", "d", "e", "f"]);
const cosine = useField([1]);

round(ring.scoreAt(0n, 0, cosine).get());                                  // 1
round(ring.scoreAt(1n, 0, cosine).get());                                  // 0.5
ring.scoresAt(0, cosine).map(score => round(score));                       // [1, 0.5, -0.5, -1, -0.5, 0.5]
```

### 13.6 링의 합성과 각도 스펙트럼

`combineRings(left, right)`는 두 링을 곱이 아니라 최소공배수로 잇는다. 결합 링의 순간 `i`는
왼쪽 링의 `i mod m`과 오른쪽 링의 `i mod n`을 읽으므로 `lcm(m, n)` 순간 뒤에 닫힌다. 결코 함께
일어날 수 없는 짝——위치가 `gcd(m, n)`을 법으로 어긋나는 것들——은 아예 존재하지 않는다. 그래서
결과는 곱이 아니라 당김이며, `aligns(left, right)`는 주어진 짝이 표현 가능한지 보고한다.

`useAngularSpectrum(ring, instants, plan)`은 `(ω, n)` 평면을 만든다. 각 순간이 페이저 프레임을
기여하고, 모드 `j`의 프레임 `k`는 그 프레임의 `j`번째 대칭 성분이며, `cells[frame][order]`가
계수다. 한 열을 취하면 단일 공간 모드의 시계열이 되고, `spectrum(order)`는 그 시간 스펙트럼이다.

```typescript
import { Sample, SynchronousRing, combineRings, useAngularSpectrum } from "semantic-typescript";

const left = new SynchronousRing(["a", "b", "c", "d"]);
const right = new SynchronousRing(["x", "y", "z", "w", "v", "u"]);
const joined = combineRings(left, right);

joined.period;                                     // 12n
joined.divisor;                                    // 2n
joined.ring.size();                                // 12n
joined.aligns(0n, 0n);                             // true
joined.aligns(1n, 0n);                             // false
joined.ring.get(0n).join("-");                     // a-x

const angular = useAngularSpectrum(left, [0, 0.25, 0.5, 0.75], new Sample(4, 1));
angular.order;                                     // 4
angular.frameCount;                                // 4
angular.cells[0][1].magnitude();                   // 4
angular.spectrum(1).get().size();                  // 4
```

### 13.7 함정

**정확함은 정확함이다.** `phaseAt(i)`와 `phaseAt(i + n)`은 같은 배정밀도 값이며 허용오차 안의
두 값이 아니다. 원소마다 `2π / n`을 누적해 만든 링은 이것을 만족하지 못한다. 이 링은 먼저
`bigint`에서 인덱스를 환원한다.

**`frequency`는 위상 걸음이 아니다.** 환경 회전 속도이고 기본값은 0이며, 모든 페이저를 같은
각도로 돌려도 고유 무늬는 깨지지 않는다. 위치들이 상대적으로 진행하게 하려면 `frequency`가
아니라 `rate`를 쓴다.

**`purity()`는 두 기본 빈을 모두 봐야 한다.** 거꾸로 가는 링도 `n`차 단위근이다. `c₁`만 보면
불순하다고 판정한다.

**`n < 2`는 정의된 경계다.** `purity()`는 `0`, `isBalanced()`는 `false`를 반환한다. 빈 링의
표본화 메서드는 빈 `Optional`을 반환한다.

**`n`과 인수를 공유하는 span은 궤도를 붕괴시킨다.** 여섯 원소에 `span: 2`는 세 개의 서로 다른
위상만 방문하고 링은 더 이상 균형이 아니다.

**`resultant`는 회전 불변이지 시간 불변이 아니다.** 환경 회전은 바꾸지 않지만, 원소별 `rate`는
링이 위상을 잃으면서 바꾼다.

**링은 집합이고 `analyse`는 동일성으로 대응시킨다.** 중복 원소는 구성 시 버려지고, 링 원소와
구조적으로 같지만 같은 참조가 아닌 객체는 missed로 센다.

**`toSpectrum()`은 복소 스펙트럼이다.** 빈이 켤레 대칭이 아니므로 `Spectrum`의 단측 보조
함수를 적용할 수 없다. 빈을 직접 읽어라.

**`windingAt`은 0 방향으로 절단하고, `errorIntegralAt`은 위상을 적분한다.** 반 회전 미끄러짐은
`0n`으로 보고된다. 오차 적분의 단위는 회전 · 초이지 속도가 아니다.

```typescript
import { SynchronousRing, useHertz } from "semantic-typescript";

const collapsed = new SynchronousRing(["a", "b", "c", "d", "e", "f"], { span: 2 });
collapsed.phaseAt(1n).get().toDegreeValue();   // 120
collapsed.phaseAt(3n).get().toDegreeValue();   // 0
Number(collapsed.purity().toFixed(4));         // 0

const falling = new SynchronousRing(["a", "b", "c", "d"], {
  frequency: useHertz(2),
  rate: () => useHertz(0.5),
});
falling.jetAt(0n, 2).get().slip;               // -1.5
falling.windingAt(0n, 1).get();                // -1n
falling.windingAt(0n, 0.5).get();              // 0n

const objects = new SynchronousRing([{ key: 1 }, { key: 2 }]);
objects.analyse([{ key: 1 }]).missed;          // 1 — identity, not structure
```

---

<a id="14-signal-analysis"></a>
## 14. 신호 분석: 윈도우, 스펙트럼, 시간

10장은 링을 위상의 주기로 다루었다. 이 장은 그 시간적 대응물이다. 실수 값 기록은 샘플 자체
외에도 모든 스펙트럼 공식이 필요로 하는 두 가지 문맥을 함께 지닌다. 빈 번호를 헤르츠로 바꾸는
샘플링 계획과, 코히런트 이득과 잡음 대역폭을 동시에 결정하는 윈도우다.

값 객체는 `SynchronousSignalCollectable`이고, 대기열 버전 쌍둥이는
`AsynchronousSignalCollectable`이다. 둘 다 같은 `SignalCollectable` 표면을 노출한다. 스물세
개의 메서드가 있고, 각각은 `synchronous/collectors`의 `useSynchronous<Method>` 팩토리 하나에
정확히 위임한다. 이 분리는 의도적이다. 클래스는 문서화된 파사드이고, 팩토리가 누적을
소유하며, 생성자는 이 길이에서 `sum(w) / count`와 `count * sum(w^2) / sum(w)^2`를 한 번만
계산해 둔다. "코히런트 이득으로 나누라"는 것을 기억해야 하는 호출자는 언젠가 잊게 되고,
그렇게 생긴 6.02 데시벨은 그럴듯한 측정값처럼 보인다.

### 14.1 신호는 스스로 보정을 지닌다

신호는 반복 가능한 객체와 샘플링 레이트로, 기존 `Frame`으로, 또는 명시적 `Sample`을 받는
생성자로 만든다. 기본 윈도우는 주기 Hann 윈도우다. 윈도우를 지정하지 않는 모든 분석이 이것을
사용하고, 모든 분석은 재정의를 받는다. 메타데이터 접근자는 생성 시 고정된 상태를 상수 시간에
읽으므로 신호를 주고받아도 문맥이 흐트러지지 않는다.

| 호출 | 반환 | 의미 |
| :--- | :--- | :--- |
| `SynchronousSignalCollectable.useRate(values, rate, window?)` | 신호 | 길이 `count / rate` |
| `SynchronousSignalCollectable.useFrame(frame, window?)` | 신호 | 해당 frame의 계획 유지 |
| `new SynchronousSignalCollectable(plan, values, window?)` | 신호 | 계획의 프레임 수는 샘플 수와 같아야 함 |
| `getSample()` / `getValues()` / `getWindow()` | 계획, 샘플, 윈도우 | 동결된 문맥 |
| `getRate()` | `number` | 초당 샘플 수 |
| `getNyquist()` / `getResolution()` | `Frequency` | `rate / 2`와 `rate / count` |
| `getCoherentGain()` / `getNoiseBandwidth()` | `number` | 이 길이에서 다시 계산됨 |
| `size()` / `at(index)` / `toFrame()` / `equals(other)` / `toString()` | — | 값 의미론 |

```typescript
import { SynchronousSignalCollectable } from "semantic-typescript";

const signal = SynchronousSignalCollectable.useRate(
  Array.from({ length: 64 }, (_unused, index) => Math.cos(2 * Math.PI * 8 * index / 64)),
  64,
);

signal.size();                       // 64n
signal.getRate();                    // 64
signal.getNyquist().getHertz();      // 32
signal.getResolution().getHertz();   // 1
signal.getCoherentGain();            // 0.5
signal.getNoiseBandwidth();          // 1.5
```

`getResolution()`은 빈 간격이지 분해능이 아니다. 변환이 `count`개의 빈을 가지므로
`rate / count`이고, 영 채움은 간격을 바꾸지만 윈도우가 무엇을 분리할 수 있는지는 바꾸지 않는다
(14.8절).

### 14.2 스물세 개의 메서드

메서드는 여섯 갈래로 나뉜다. 일곱은 스펙트럼 판독, 둘은 시간-주파수 변환, 넷은 해석적 양,
셋은 시퀀스 통계량, 다섯은 형상 기술자, 그리고 둘은 또 다른 신호를 반환한다.

| 메서드 | 반환 | 규약 |
| :--- | :--- | :--- |
| `spectrum(size?, window?)` | `Spectrum` | 원시 비정규화, 복소 격자 전체 유지 |
| `oneSided(size?, window?)` | `Bin[]` | 켤레 반쪽을 접고, DC와 Nyquist는 두 배 하지 않음 |
| `amplitude(window?)` | `number[]` | `2·abs(X) / (count · CG)`, DC와 Nyquist는 한 번만 |
| `power(window?)` | `number[]` | 내부 빈은 `A² / 2`, DC와 Nyquist는 `A²` |
| `decibel(window?)` | `number[]` | `20·log10(진폭)` |
| `powerDecibel(window?)` | `number[]` | `10·log10(전력)` |
| `powerSpectralDensity(frameSize?, hopSize?, window?)` | `SpectralDensity` | Welch 평균, `abs(X)² / (rate · Σw²)` |
| `shortTimeFourierTransform(frameSize, hopSize, window?)` | `Spectrum[]` | 양끝 확장, 프레임 중심 시각 보고 |
| `spectrogram(frameSize, hopSize, window?)` | `Spectrogram` | 같은 열에 시간 축을 붙임 |
| `analyticSignal()` | `Complex[]` | Hilbert 쌍 `x + i·H(x)` |
| `instantaneousPhase()` | `Angle[]` | `[0, 2π)`로 접음 |
| `instantaneousFrequency(rate?, gate?)` | `number[]` | 위상 차분을 펼치고 포락선으로 게이트 |
| `envelope()` | `number[]` | `abs(z[n])`, 양끝은 순환 영향 |
| `zeroCrossingRate(perSecond?)` | `number` | 인접 샘플 쌍당 영교차 비율 |
| `spectralFlux(frameSize?, hopSize?, window?)` | `number[]` | 프레임 간 단위 노름 진폭 거리 |
| `autocorrelation(maximumLag?, normalization?)` | `number[]` | 기본은 계수 규약, `ρ[0] = 1` |
| `spectralCentroid(window?)` | `Optional<Frequency>` | 전력 가중 평균 주파수 |
| `spectralBandwidth(window?)` | `Optional<Frequency>` | 전력 가중 표준편차 |
| `spectralRolloff(ratio?, window?)` | `Optional<Frequency>` | 누적 전력이 처음 `ratio`에 닿는 빈 |
| `spectralFlatness(window?)` | `number` | 전력의 기하평균 / 산술평균 |
| `signalToNoiseRatio(frameSize?, hopSize?, window?, floorQuantile?)` | `Optional<number>` | 중앙값 잡음 바닥, `10·log10` |
| `detrended(mode?)` | 신호 | `"none"`, `"constant"`(기본), `"linear"` |
| `windowed(window?)` | 신호 | 윈도우를 적용하고 그것을 채택 |

선택 인자는 장식이 아니다. `frameSize` 기본값은 `min(256, size)`, 홉은 반 프레임 내림,
`instantaneousFrequency`의 게이트는 최대 포락선의 `1E-3`, `spectralRolloff`는 `0.85`다.
모든 기본값은 참조 구현이 "이름만 주고 값을 주지 않을 때" 고르는 값이다.

### 14.3 진폭, 전력, 밀도

세 가지 다른 질문이 있으므로 세 가지 정규화가 필요하다.

`amplitude()`는 "이 빈의 사인파가 얼마나 큰가"에 답한다. 내부 빈은
`2·abs(X[k]) / (count · CG)`, DC와 Nyquist는 `abs(X[k]) / (count · CG)`다. 두 배는 켤레
반쪽의 접기이고, 코히런트 이득은 윈도우 제거다. 둘 중 하나만 빠져도 단위 진폭 사인파는
`0.5`, 즉 -6.02 데시벨로 읽힌다.

`power()`는 "이 빈의 사인파가 얼마의 평균 제곱을 갖는가"에 답한다. 내부 빈은 `A² / 2`,
DC와 Nyquist는 `A²`다. 뒤의 둘은 진동하지 않기 때문이다. 이것은 피크 규약이며 파스발 정리를
의도적으로 만족하지 않는다. 윈도우가 각 스펙트럼 선을 주엽으로 퍼뜨리므로 모든 빈의 합은
평균 제곱보다 등가 잡음 대역폭만큼 크다. Hann은 `1.5`다.

`powerSpectralDensity()`는 "헤르츠당 얼마의 전력인가"에 답한다.
`abs(X)² / (rate · Σw²)`를 겹치는 구간에서 평균한다. 가중치 제곱합을 분모로 쓸 때만 백색
잡음 바닥이 불편이 된다. `count`로 나누면 단위 잡음이 `0.375`, `count · CG²`로 나누면 `1.5`로
읽힌다.

```typescript
import { SynchronousSignalCollectable } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const tone = SynchronousSignalCollectable.useRate(
  Array.from({ length: 256 }, (_unused, index) => Math.cos(2 * Math.PI * 32 * index / 256)),
  256,
);

round(tone.amplitude()[32]);                                 // 1
round(tone.power()[32]);                                     // 0.5
round(tone.power().reduce((sum, power) => sum + power, 0));  // 0.75
round(tone.powerSpectralDensity(64n, 32n).totalPower());     // 0.5
tone.powerSpectralDensity(64n, 32n).getSegments();           // 7n
```

기억할 만한 것은 이 두 총량이다. 피크 규약의 합은 `0.75`, 밀도의 적분은 `0.5`이고, 그 비가
정확히 잡음 대역폭이다. 셋 중 프레임 길이를 바꿔도 의미가 유지되는 것은 밀도뿐이다.

### 14.4 레벨: 두 가지 데시벨 규약

진폭과 전력은 같은 인자를 공유하지 않으므로 같은 로그도 공유하지 않는다. `amplitudeDecibel`은
`20·log10`을 적용하며 전압, 변위, 음압에 맞다. `powerDecibel`은 `10·log10`을 적용하며 전력,
에너지, 평균 제곱, 밀도에 맞다. 신호의 메서드 이름도 같은 구분을 따른다.

```typescript
import { amplitudeDecibel, powerDecibel, SynchronousSignalCollectable } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const tone = SynchronousSignalCollectable.useRate(
  Array.from({ length: 256 }, (_unused, index) => Math.cos(2 * Math.PI * 32 * index / 256)),
  256,
);

amplitudeDecibel(0.25);           // -12.0412
powerDecibel(0.25);               // -6.0206
round(tone.decibel()[32]);        // 0
round(tone.powerDecibel()[32]);   // -3.0103
```

같은 음의 두 판독값은 모두 옳다. 진폭은 1(0 데시벨)이고 평균 제곱은 이분의 일(-3.01
데시벨)이다. 전력을 진폭 규약에 넣으면 데시벨 값이 두 배가 되어 올바른 -6.02가 -12.04가 된다.

### 14.5 단측 접기

실신호는 `X[count − k] = conj(X[k])`를 만족하므로 음의 주파수 반쪽은 독립 정보를 지니지
않는다. 접기는 모든 내부 빈을 두 배로 하고, 자기 켤레인 두 빈——DC와 짝수 길이의 Nyquist——은
변환이 만든 그대로 둔다. 이 둘은 자기 자신의 거울상이므로 두 배로 하면 에너지를 조작하고
정확히 6.02 데시벨 높게 보고한다.

```typescript
import { SynchronousSignalCollectable } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const edge = SynchronousSignalCollectable.useRate(
  Array.from({ length: 16 }, (_unused, index) => 2 + Math.cos(Math.PI * index)),
  16,
);
const bins = edge.oneSided();

bins.length;                  // 9
round(bins[0].magnitude());   // 16
round(bins[8].magnitude());   // 8
round(edge.amplitude()[0]);   // 2
round(edge.amplitude()[8]);   // 1
```

원시 진폭이 `16`과 `8`인 것은 윈도우 가중치 합이 8이기 때문이다. `count · CG = 8`로 나누면
보정된 진폭 `2`와 `1`이 된다. 가장자리 빈을 두 배로 하면 `4`와 `2`로 읽히고, 그 오류는
결코 예외를 던지지 않는다.

### 14.6 시간-주파수 보기

`shortTimeFourierTransform`과 `spectrogram`은 참조 단시간 변환처럼 기록을 나눈다. 양끝에 반
프레임의 영을 두고, 꼬리를 영으로 채워 정수 개의 홉에 맞춘다. 첫 프레임은 첫 샘플을 중심으로
하고 마지막 프레임은 마지막 샘플에 닿으며, 프레임 `m`의 중심은 `m · hop / rate`초다. 완전한
프레임만 남기면 최대 `frameSize − 1`개 샘플을 버린다. 1000 샘플, 프레임 256, 홉 128에서는
104개로 기록의 약 10분의 1이다.

```typescript
import { SynchronousSignalCollectable } from "semantic-typescript";

const tone = SynchronousSignalCollectable.useRate(
  Array.from({ length: 64 }, (_unused, index) => Math.cos(2 * Math.PI * 4 * index / 64)),
  64,
);
const spectrogram = tone.spectrogram(16n, 8n);

spectrogram.size();                               // 9
spectrogram.getFrameSize();                       // 16
spectrogram.getBoundary();                        // "zeros"
spectrogram.getTime(0);                           // 0
spectrogram.getTime(6);                           // 0.75
tone.shortTimeFourierTransform(16n, 8n).length;   // 9
tone.spectralFlux(16n, 8n).length;                // 8
```

각 열은 `frameSize`개 빈의 `Spectrum`이며, 같은 프레임에 `spectrum()`을 호출한 결과와 정확히
같다. `getTime()`은 프레임 시작이 아니라 중심을 보고한다.

### 14.7 윈도우, 코히런트 이득, COLA

모든 형상에는 두 가지 형태가 있다. 대칭 형태는 분모가 `count − 1`이고, 주기(DFT 짝수) 형태는
분모가 `count`로 한 주기보다 하나 짧아 DFT가 가정하는 주기 확장 아래에서 연속이다. 분석과
겹침 가산에는 주기 형태가 필요하고, 필터 설계는 대칭 형태를 유지한다.

차이는 측정 가능하며 결코 예외가 되지 않는다. 50% 겹침에서 주기 Hann 윈도우의 합은 모든
위치에서 1이다. 대칭 형태는 물결치며, 16 샘플에서 `0.84` 데시벨, 64에서 `0.21`, 1024에서도
`0.013` 남는다. 클래스는 보유한 윈도우의 코히런트 이득과 등가 잡음 대역폭을 노출하므로 보정은
결코 하드코딩되지 않는다. 대칭 Hann은 8 샘플에서 `0.4375`로 읽히고 `0.5`가 아니다.

```typescript
import {
  coherentGain, equivalentNoiseBandwidth, useFlatTopWindow,
  useHannPeriodicWindow, useHannWindow,
} from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));

round(useHannWindow(1, 4));                           // 0.75
round(useHannPeriodicWindow(1, 4));                   // 0.5
coherentGain(useHannPeriodicWindow, 16);              // 0.5
equivalentNoiseBandwidth(useHannPeriodicWindow, 16);  // 1.5
useFlatTopWindow(0, 1024);                            // -0.000421
Array.from({ length: 1024 }, (_unused, i) => useFlatTopWindow(i, 1024)).filter(w => w < 0).length;  // 578
```

플랫톱 행은 표의 오류가 아니다. 플랫톱 윈도우는 정의상 부분적으로 음수이며, 여기서는 1024개
가중치 중 578개가 음수다. 그것을 0으로 자르면 주엽이 흐트러지고 이 윈도우가 존재하는 이유인
낮은 스캘로핑 손실이 무너진다. 라이브러리는 계열을 그대로 반환한다.

### 14.8 함정

**영 채움은 보간이며 결코 분해하지 않는다.** 변환 길이를 샘플 수보다 크게 해도 같은 DTFT를
더 촘촘히 표본화할 뿐이다. 피크의 *위치*는 세밀해지고 빈 간격은 `rate / size`가 되지만, 두
성분을 분리할 수 있는지는 여전히 윈도우 길이와 모양이 정한다. 정확히 두 빈 사이에 있는 음은
채우지 않은 격자에서 `82.1093`과 `80.8598`, 채운 격자에서 자기 주파수에서 `128`로 읽힌다.

```typescript
import { SynchronousSignalCollectable, useRectangularWindow } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const tone = SynchronousSignalCollectable.useRate(
  Array.from({ length: 256 }, (_unused, index) => Math.cos(2 * Math.PI * 100.5 * index / 256)),
  256,
);
const flat = tone.spectrum(256n, useRectangularWindow);
const padded = tone.spectrum(1024n, useRectangularWindow);

flat.getResolution().getHertz();           // 1
padded.getResolution().getHertz();         // 0.25
round(flat.magnitudeAt(100).get());        // 82.1093
round(flat.magnitudeAt(101).get());        // 80.8598
round(padded.magnitudeAt(402).get());      // 128
padded.frequencyAt(402).get().getHertz();  // 100.5
```

`0.4` 빈 떨어진 두 등진폭 음은 어떤 영 채움에서도 합쳐진 채로 남는다. 256점 기록과 Hann
윈도우에서 8192까지 채워도 국소 최대는 하나만 나타난다.

**Hilbert 변환은 순환적이다.** `analyticSignal`, `envelope`, `instantaneousPhase`는 처음과
마지막 샘플을 이웃으로 취급하므로 주기가 길이를 나누지 않는 기록은 양끝이 오염된다. 기록의
중간은 신뢰할 수 있지만 양끝은 아니다.

```typescript
import { SynchronousSignalCollectable } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const edge = SynchronousSignalCollectable.useRate(
  Array.from({ length: 512 }, (_unused, index) => Math.cos(2 * Math.PI * 8.3 * index / 512)),
  512,
);
const envelope = edge.envelope();

round(envelope.slice(8, -8).reduce((sum, value) => sum + value, 0) / 496);  // 1.0025
round(Math.max(...envelope.slice(0, 8)));                                   // 1.2592
round(Math.min(...envelope.slice(-8)));                                     // 0.1314
```

**사라지는 포락선은 위상을 정의하지 않는다.** 포락선이 무너지는 곳에서 반올림 잡음인 두 각의
차이는 반 회전이 될 수 있고, 이는 샘플링 레이트의 절반으로 읽힌다. 게이트가 바로 이 수를
의미 있게 만드는 장치이며 기본값은 최대 포락선의 `1E-3`이다.

```typescript
import { SynchronousSignalCollectable } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const beat = SynchronousSignalCollectable.useRate(
  Array.from({ length: 4096 }, (_unused, index) =>
    Math.cos(2 * Math.PI * 100 * index / 2048) + Math.cos(2 * Math.PI * 102 * index / 2048)),
  2048,
);

round(Math.max(...beat.instantaneousFrequency(2048, 0).map(Math.abs)));  // 920.218
round(Math.max(...beat.instantaneousFrequency().map(Math.abs)));         // 101
```

**정규화되지 않은 상관은 유사도가 아니다.** 원시 합 `r[k]`는 기록 길이와 함께 커지므로 두
길이를 비교할 수 없다. 기본 `"coefficient"` 규칙은 `r[0]`으로 나누어 모든 값을 `[-1, 1]`에
둔다. `"unbiased"`는 `count − k`로 나누고 분산이 지연과 함께 커지는 대가를 치른다.

```typescript
import { SynchronousSignalCollectable } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const periodic = SynchronousSignalCollectable.useRate(
  Array.from({ length: 1024 }, (_unused, index) => Math.cos(2 * Math.PI * 8 * index / 1024)),
  1024,
);
const rho = periodic.autocorrelation(200n);

round(rho[0]);                                     // 1
round(rho[128]);                                   // 0.875
round(rho[64]);                                    // -0.9375
round(periodic.autocorrelation(200n, "none")[0]);  // 512
```

한 가지 판독값이 더 경고할 만하다. `spectralFlux`는 비교 전에 각 프레임을 정규화하므로 순수한
레벨 변화는 영 플럭스를 만든다. 첫 값과 마지막 값은 영 경계의 가장자리 효과이지 어택이 아니다.

---

<a id="15-license"></a>
## 15. 라이선스

MIT © Eloy Kim
