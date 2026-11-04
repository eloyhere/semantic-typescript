# **Semantic-TypeScript**

**Flow, Indexed.** 데이터를 정밀하게 제어하세요.

[English](./readme.md) · [简体中文](./readme.cn.md) · [繁體中文](./readme.tw.md) · [日本語](./readme.jp.md) · 한국어 · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

타입 안전성을 갖춘 스트림 처리 라이브러리로, **JavaScript 제너레이터**, **Java Stream**, **인덱스 기반 데이터 주소 지정**을 하나로 통합합니다. 모든 요소는 `bigint` 인덱스를 지니고, 모든 파이프라인은 지연 평가되며, 모든 터미널 연산은 명시적으로 선택해야 합니다.

```bash
npm install semantic-typescript
```

- 런타임 의존성 없음, 순수 ESM, 자체 타입 제공.
- 496개 회귀 테스트: `npm test`.
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
13. [라이선스](#13-license)

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
                    └── 연산자마다 제너레이터를 감싼 새 Semantic을 반환합니다
```

| 계층 | 모듈 | 책임 |
| :--- | :--- | :--- |
| 소스 | `synchronous/collectors`, `asynchronous/collectors` | 이터러블, 제너레이터, promise, blob, 이벤트 타깃을 감쌉니다 |
| 파이프라인 | `synchronous/semantic`, `asynchronous/semantic` | 지연 연산자와 인덱스 재작성 |
| 콜렉터블 | `synchronous/semantic`, `asynchronous/semantic` | ordered, unordered, 통계, 윈도우 및 사용자 정의 터미널 |
| 콜렉터 | `synchronous/collector`, `asynchronous/collector` | 모든 터미널이 기반으로 삼는 폴드 프리미티브 |
| 수학 | `mathematics/*` | 각도, 복소수, 주파수, 스펙트럼, 윈도우, 에피사이클, 위상 링 |
| 구조 | `structure/*` | 리스트, 집합, 맵, 트리, 링, 필드 |

동기 계열과 비동기 계열은 하나의 어휘를 공유합니다: 연산자 이름도, 인덱스 의미론도, 콜렉터블도 동일합니다. 비동기 변형은 단지 promise를 반환하며, 쓰기를 큐에 쌓아 두므로 쓰기 이후에 발행된 읽기는 항상 그 쓰기를 관찰합니다.

---

<a id="3-quick-start"></a>
## 3. 빠른 시작

```typescript
import {
  useOf, useFrom, useRange, useText, useStringify, usePromise
} from "semantic-typescript";

// 숫자 집계
const sum: number = useOf(10, 20, 30, 40)
  .map(n => n * 2)
  .toNumericStatistics()
  .summate();                                   // 200

// BigInt 집계
const bigSum: bigint = useOf(10n, 20n, 30n, 40n)
  .map(n => n * 2n)
  .toBigintStatistics()
  .summate();                                   // 200n

// 재정렬은 인덱스 산술입니다 — 효과를 보려면 toOrdered()로 수집하세요
const reversed: number[] = useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();      // [5,4,3,2,1]
const rotated: number[]  = useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();   // [4,5,1,2,3]

// 큰 범위에 대한 지연 평가
const multiples: bigint[] = useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)
  .limit(10n)
  .toUnordered()
  .toArray();                                   // [0n,17n,…,153n]

// 유니코드 안전 문자열 처리 (UTF-16 단위가 아닌 코드 포인트)
useText("semantic 👍").toUnordered().forEach(character => console.log(character));

// 순환 안전 직렬화
const cyclic: any = { a: 1 }; cyclic.self = cyclic;
useStringify(cyclic);                           // '{"a":1}'

// 비동기 소스
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

---

<a id="7-statistics-and-windows"></a>
## 7. 통계와 윈도우

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();              // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();              // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();               // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                 // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance();             // 2.56
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation();    // 1.6
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n);                    // [[1,2],[2,3],[3,4]]
```

두 통계 계열은 동일한 표면(`summate`, `average`, `median`, `mode`, `variance`, `standardDeviation`, `frequency`, `findMaximum`, `findMinimum`)을 노출하며, `toBigintStatistics()`에는 `bigint` 산술을 사용합니다. 윈도우는 `slide(size, hop)`과 `tumble(size)`를 지원합니다.

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
const cycle = new AsynchronousCycle([1, 2]);
const added   = cycle.add(3);          // 큐에 들어감
const sampled = cycle.elementAt(2n);   // 위의 쓰기를 관찰함
await added;
(await sampled).get().element;         // 3
```

본질적으로 비동기인 팩토리(`usePromise`, `useBlob`, `useInterval`, `useSubscription`)는 `AsynchronousSemantic`을 직접 반환하고, `useFrom` / `useIterate`는 `AsyncIterable`을 받으면 스스로 비동기로 승격합니다.

---

<a id="10-periodic-analysis-rings-fields-and-scores"></a>
## 10. 주기 분석: 링, 필드, 스코어

라이브러리의 수학적 절반은 주기를 조회 표가 아니라 일급 객체로 다룹니다. 세 가지 구성이 함께 동작합니다.

### 10.1 링은 하나의 정수입니다

`Cycle`은 **n중 링(n-fold ring)**입니다: 요소 개수, 위치 주기, 서로 다른 위상의 개수가 모두 같은 정수 `n`입니다. 어떤 위치의 위상은 정확한 나머지로부터 계산되므로, 링은 비트 단위까지 주기적입니다:

```typescript
import { SynchronousCycle } from "semantic-typescript";

const ring = new SynchronousCycle(["a", "b", "c", "d", "e", "f"]);
ring.phaseAt(0n).get().toDegreeValue();   // 0
ring.phaseAt(1n).get().toDegreeValue();   // 60
ring.phaseAt(6n).get().getValue() === ring.phaseAt(0n).get().getValue();   // true (정확히 일치)
ring.purity();                             // 1
ring.isBalanced();                         // true
ring.sequences().map(z => z.magnitude());  // [0, 6, 0, 0, 0, 0]
```

`frequency`는 위치 사이의 위상 간격이 아니라 **주변(ambient)** 회전 속도입니다: 환경이 모든 페이저(phasor)를 같은 각도만큼 움직이므로, 고유한 패턴을 결코 깨뜨릴 수 없습니다. `span`은 링이 차지하는 회전 수를 고정합니다.

`purity()`는 기본 모드(fundamental mode)가 나르는 에너지의 비율로, `max(|c₁|², |c_{n−1}|²) / (n · Σ|z|²)`입니다. 링이 회전을 무시하면 `n`차 단위근일 때 정확히 `1`이고, 두 개의 빈만 필요하므로 `O(n)`입니다. 링은 원을 어느 방향으로도 돌 수 있으므로 양방향을 모두 검사합니다.

### 10.2 필드는 유계 스코어입니다

`PhaseField`는 상대 위상을 `[-1, 1]` 범위의 스코어로 매핑합니다:

```typescript
import { useField } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ): +1 정렬, −1 반대
const mixed  = useField([0.4, 0.3, 0.3]);  // 처음 세 조화파

cosine.sample(useRadian(0));               //  1
cosine.sample(useRadian(Math.PI));         // -1
```

스코어는 절단된 코사인 급수 `a₀ + Σ wₘ·cos(2πmΔ)`이며, 생성자는 `|a₀| + Σ|wₘ| ≤ 1`을 강제합니다. 삼각 부등식에 의해 스코어는 `[-1, 1]`을 벗어날 수 없습니다 — 이 경계는 나중에 적용하는 클램프가 아니라 **구성의 필연적 결과**입니다.

필드가 표가 아니라 급수인 이유는 이렇습니다: `n`점 표는 자기 자신의 샘플을 정확히 재현하지만, 그 삼각 보간자는 샘플 사이에서 오버슈트합니다. `[+1, +0.5, −1, −0.5, 0]` 점수를 가진 5점 표는 `[−1.0428, 1.0041]` 구간으로 보간되는데, 이는 이미 약속을 깨뜨립니다. 경계가 있는 급수는 그럴 수 없습니다.

### 10.3 분석은 데이터를 모든 요소에 견주어 측정합니다

각 링 요소는 하나의 참조 위상입니다. `analyse`는 모든 관측값의 위치를 링 위에서 되짚어 찾아내고, 각 참조에 대해 측정합니다:

```typescript
const ring = new SynchronousCycle(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                              // 5
report.missed;                               // 1  ('zz'는 링 위에 없음)
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

각 참조 행은 `count`, 평균 상대 위상 `mean`, 평균 합성 길이(mean resultant length) `resultant`를 보고합니다. 기억해 둘 만한 항등식이 하나 있습니다: **`resultant`는 모든 참조에서 동일합니다**. 기준선을 바꾸는 일은 모든 상대 위상을 상수만큼 회전시킬 뿐이기 때문입니다. 참조마다 달라지는 것은 개수와 평균입니다.

```typescript
const cycle = new SynchronousCycle(["a", "b", "c"]);
cycle.scoresAt(0, cosine);                   // 위치마다 스코어 하나, [-1, 1] 범위
```

### 10.4 관련 도구

| 호출 | 답하는 것 | 비용 |
| :--- | :--- | :--- |
| `purity()` | 링이 아직 `n`차 단위근인가? | O(n) |
| `resultant(t?)` | 지금 페이저들이 얼마나 집중되어 있는가? | O(n) |
| `analyse(data)` | 이 데이터가 각 요소에 대해 어떻게 놓이는가? | O(n · m) |
| `toSpectrum()` | 주파수 축에 파수를 둔 링의 스펙트럼 | O(n²) |
| `useAngularSpectrum(cycle, instants, plan)` | 시간에 따른 `(ω, n)` 평면 | O(n² · frames) |

모델을 완성하는 프리미티브가 두 개 더 있습니다: `combineCycles(a, b)`는 두 링을 최소공배수 위에서 결합하며(곱이 아닌 당김(pullback)입니다 — 같은 순간을 공유할 수 없는 쌍은 그냥 존재하지 않습니다), `rate()`는 각 요소에 고유 주파수를 부여하여 링이 환경에 대해 표류할 수 있게 합니다. `jetAt`, `windingAt`, `errorIntegralAt`은 그 표류의 미분 상태를 노출합니다.

---

<a id="11-utility-helpers"></a>
## 11. 유틸리티 헬퍼

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

---

<a id="12-performance-and-pitfalls"></a>
## 12. 성능과 함정

**지연 평가는 단계마다 값을 치릅니다.** 연산자마다 제너레이터 홉이 하나씩 붙습니다. 메모리 내 배열을 도는 빡빡한 숫자 루프에서는 평범한 `for` 루프가 어떤 파이프라인보다 빠릅니다. 파이프라인은 소스가 지연적이거나 무한할 때, 또는 인덱스 규율이 값을 할 만큼 파이프라인이 길 때 이깁니다.

**`toOrdered()`는 정렬하고 `toUnordered()`는 정렬하지 않습니다.** 역순이 "동작하지 않은" 것처럼 보인다면 콜렉터가 unordered였던 것입니다 — 인덱스 재작성은 인덱스가 정규화될 때에만 순서가 됩니다.

**`interrupt` 없는 `useGenerate`는 끝나지 않습니다.** 항상 정지 술어나 하류의 `limit` / `takeWhile`을 함께 주세요.

**`Cycle`은 삽입 순서를 유지하는 집합입니다.** 요소는 유일하며 처음 추가된 순서를 유지합니다. 중복된 `add`는 `false`를 반환하고, 중복을 도입하게 될 `set`은 예외를 던집니다. 덕분에 위상은 요소가 우연히 차지한 위치가 아니라 *요소*의 함수가 될 수 있습니다.

**`Spectrum`의 단측 헬퍼는 실수 신호를 가정합니다.** `oneSided()`, `getNyquist()`, `centroid()`는 켤레 대칭을 가정합니다. 위상 링의 공간 스펙트럼은 복소수이며 일반적으로 대칭이 아닙니다 — 원을 거꾸로 도는 링은 모든 에너지를 나이퀴스트 너머인 `n − 1` 빈에 둡니다. 빈을 직접 읽으세요.

---

<a id="13-license"></a>
## 13. 라이선스

MIT © Eloy Kim
