# **Semantic-TypeScript**

**Flow, Indexed.** 데이터를 정밀하게 제어하세요.

[English](./readme.md) · [简体中文](./readme.cn.md) · [繁體中文](./readme.tw.md) · [日本語](./readme.jp.md) · 한국어 · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

타입 안전성을 갖춘 스트림 처리 라이브러리로, **JavaScript 제너레이터**, **Java Stream**, **인덱스 기반 데이터 주소 지정**을 하나로 통합합니다. 모든 요소는 `bigint` 인덱스를 지니고, 모든 파이프라인은 지연 평가되며, 모든 터미널 연산은 명시적으로 선택해야 합니다.

```bash
npm install semantic-typescript
```

- 런타임 의존성 없음, 순수 ESM, 자체 타입 제공.
- 55개 회귀 테스트: `npm install && npm test`.
- 전체 변경 이력: [CHANGELOG.md](./CHANGELOG.md).

---

## Table of Contents

1. [설계 철학](#1-design-philosophy)
2. [아키텍처](#2-architecture)
3. [데이터 흐름: 소스에서 결과까지](#3-data-flow-from-source-to-result)
4. [빠른 시작](#4-quick-start)
5. [팩토리 함수](#5-factory-functions)
6. [변환 연산자](#6-transformation-operators)
7. [콜렉터블과 터미널 연산](#7-collectables-and-terminal-operations)
8. [통계](#8-statistics)
9. [윈도우](#9-windows)
10. [인덱스 모델](#10-the-index-model)
11. [비동기 모델](#11-the-asynchronous-model)
12. [유틸리티 헬퍼](#12-utility-helpers)
13. [다른 라이브러리와의 비교](#13-comparison-with-other-libraries)
14. [성능 특성](#14-performance-characteristics)
15. [함정과 FAQ](#15-pitfalls-and-faq)
16. [라이선스](#16-license)

---

<a id="1-design-philosophy"></a>
## 1. 설계 철학

**1. 인덱스 우선.** 대부분의 스트림 라이브러리에서 위치는 당신이 *재구성*하는 무언가입니다 — `scan`에서 들고 다니는 카운터나, 손으로 하나하나 흘려보내는 인덱스 인자. 여기서는 위치가 *본질적*입니다: 제너레이터 프로토콜이 모든 요소에 `bigint` 인덱스를 부여하므로, `distinct`, `skip`, `sub`, `reverse`, `translate`, `shuffle`은 모두 임기응변 상태가 아닌 인덱스 산술로 표현됩니다. 요소의 인덱스를 바꾸는 것 *자체가* 재정렬이며, 재인덱싱 *자체가* 필터링입니다.

**2. 명시적 정지 신호와 함께 푸시.** 소스는 `(accept, interrupt) => void | Promise<void>` 함수입니다. `accept(element, index)`로 요소를 푸시하고, `interrupt(element, index)`로 정지 여부를 묻습니다. 숨겨진 스케줄러도, 구독 객체도, 기억해야 할 해체 단계도 없습니다 — 백프레셔와 종료는 프로토콜의 일부이며, 무한 스트림은 (특별한 것이 아닌) 보통의 경우가 됩니다.

**3. 지연 평가는 기본, 구체화는 결정.** 연산자는 제너레이터만 감쌉니다. **콜렉터블**이 파이프라인을 소비하기 전까지는 아무것도 실행되지 않으며, 선택한 콜렉터가 비용을 결정합니다: `toUnordered()`는 O(n)이고 인덱스를 결코 건드리지 않고, `toOrdered()`는 O(n log n)이며 이를 정규화합니다. 그 결정이 반환받는 타입에 명시되므로, 순서와 메모리에 대가를 치르는지 항상 알 수 있습니다.

**4. Redirect는 유일한 재정렬 메커니즘.** `reverse()`, `translate()`, `shuffle()`은 포장된 `redirect()` 전략일 뿐입니다 — 각각 요소의 인덱스를 다시 쓰고 그 외에는 아무것도 하지 않습니다. 그래서 이들 모두 효과를 발휘하려면 **`toOrdered()`가 필요**한 것입니다: 파이프라인은 인덱스만 다시 쓰고, 그 인덱스가 의미하는 바를 결정하는 것은 ordered 콜렉터입니다.

**5. 동기와 비동기는 하나의 API.** 동일한 연산자가 유한한 메모리 내 데이터뿐만 아니라 promise, 비동기 이터러블, 타이머, blob, 이벤트 구독에도 존재합니다. 동기화할 수 없는 소스는 반환 타입(`AsynchronousSemantic`)에 그렇게 명시하므로, "이걸 await 했나?"가 런타임의 놀람이 되지 않습니다.

---

<a id="2-architecture"></a>
## 2. 아키텍처

세 계층, 하나의 방향. 데이터는 아래로 흐릅니다. 당신이 가진 타입이 다음에 무엇을 할 수 있는지 알려줍니다.

```
            SOURCES                     PIPELINE                      SINKS
 ┌──────────────────────────┐   ┌────────────────────────┐   ┌───────────────────────────┐
 │  useOf  useFrom  useRange│   │  map  filter  flatMap  │   │  toUnordered()  → Map     │
 │  useFill useEmpty useText│   │  distinct  limit  skip │   │  toOrdered()    → sorted  │
 │  useAttribute useGenerate│ → │  sub  takeWhile drop   │ → │  toNumericStatistics()    │
 │  usePromise useBlob      │   │  concat  peek  redirect│   │  toBigintStatistics()     │
 │  useIterate useInterval  │   │  reverse  translate    │   │  toWindow()               │
 │  useSubscription         │   │  shuffle  pipe         │   │  toCollectable(custom)    │
 └──────────────────────────┘   └────────────────────────┘   └───────────────────────────┘
        Semantic<E>                    Semantic<E>                 Collectable<E>

                                     terminal operations on the Collectable:
                        toArray  toMap  toSet  count  forEach  join  group  reduce
                        findFirst  findLast  findAt  findMaximum  …  anyMatch  …
```

| 계층 | 타입 | 책임 | 얻는 곳 |
| :--- | :--- | :--- | :--- |
| 소스 / 파이프라인 | `SynchronousSemantic<E>`<br>`AsynchronousSemantic<E>` | 지연 파이프라인을 구성합니다: 변환, 재인덱싱, 분할, 병합. 아직 어떤 요소도 건드리지 않습니다. | 팩토리, 그리고 시맨틱의 모든 연산자 |
| 저장소 / 뷰 | `SynchronousUnorderedCollectable<E>`<br>`SynchronousOrderedCollectable<E>`<br>`SynchronousNumericStatistics<E>`<br>`SynchronousBigIntStatistics<E>`<br>`SynchronousWindowCollectable<E>`<br>(+ `Asynchronous*` counterparts) | 파이프라인을 인덱스 주소 지정 버퍼로 구체화하고 터미널 API를 노출합니다. **ordered** 계열은 인덱스 장부를 소유하고, **unordered** 계열은 처리량을 위해 이를 포기합니다. | `toUnordered()` `toOrdered()` `toNumericStatistics()` `toBigintStatistics()` `toWindow()` `toCollectable()` |
| 콜렉터 | `SynchronousCollector<E, A, R>`<br>`AsynchronousCollector<E, A, R>` | 재사용 가능한 폴드: `identity → accumulator → finisher`, 선택적으로 `interruptor` 포함. 모든 터미널 연산을 구동하며 사용자가 작성할 수 있습니다. | `useSynchronous*` / `useAsynchronous*` 콜렉터 팩토리, 또는 `Collectable.collect(...)` |

중간 계층이 존재하는 이유: "파이프라인이 무엇인지"와 "어떻게 저장되는지"를 분리하는 것이 동일한 `toOrdered()`가 역순, 회전, 셔플을 모두 수행하게 합니다 — 파이프라인은 인덱스만 다시 쓰고, 그 인덱스가 의미하는 바를 결정하는 것은 콜렉터입니다.

---

<a id="3-data-flow-from-source-to-result"></a>
## 3. 데이터 흐름: 소스에서 결과까지

```typescript
const result = useRange(0n, 100n)      // (1) source: reserve indices 0n,1n,2n,…
  .filter(n => n % 2n === 0n)          // (2) operator: index is forwarded unchanged
  .translate(2)                        // (3) operator: index becomes i + 2 (a lazy shift)
  .limit(5n);                          // (4) operator: interrupt() returns true after 5 elements

const ordered = result.toOrdered();    // (5) collectable: materialise; indices normalised mod n, sorted
const array = ordered.toArray();       // (6) terminal: drain the buffer
```

1. **구축.** 1~4단계는 클로저만 구성합니다. 백 개의 요소가 생성되지 않습니다.
2. **푸시.** 콜렉터블이 마침내 제너레이터를 실행하면, 요소는 스케줄러 없이 흐릅니다: 소스가 주도하고, `accept`가 콜렉터에 기록하며, `interrupt`가 정지 시점을 결정합니다 — 그래서 백만 개 요소 범위 중간의 `limit(5n)`은 백만 번이 아닌 다섯 번의 반복만 듭니다.
3. **인덱스.** 연산자는 인덱스를 결코 잃지 않습니다. `filter`는 원래 인덱스를 전달하고(그래서 "3번째 *보존된* 요소"는 여전히 "인덱스 3"), `skip` / `sub` / `limit` / `distinct`는 의도적으로 재인덱싱합니다.
4. **구체화.** 콜렉터블은 제너레이터를 생성 시점에 정확히 한 번 실행합니다.
5. **터미널.** 콜렉터블의 메서드는 버퍼를 읽습니다. 이들은 저렴하고 반복 가능하며, 파이프라인을 다시 실행하지 않습니다.

**기억할 가치가 있는 단 하나의 규칙:** 변환은 게으르고, 콜렉터블은 즉시 실행되며, 터미널은 무료입니다.

---

<a id="4-quick-start"></a>
## 4. 빠른 시작

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

// Async sources
const total = await usePromise(Promise.resolve(7)).toNumericStatistics().summate();       // 7
```

---

<a id="5-factory-functions"></a>
## 5. 팩토리 함수

### 5.1 개요

생성은 항상 O(1)입니다 — 팩토리는 제너레이터만 감쌉니다. 아래 표는 각 소스에서 `n`개 요소를 *소비*하는 비용과, 수집하는 요소 외에 소스 자체가 필요로 하는 추가 공간을 명시합니다.

| 팩토리 | 시그니처 (결과) | 시간 (n 소비) | 공간 (소스) | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | 인덱스는 0..n−1입니다. 전개 인자는 이미 구체화되어 있습니다 |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | 모든 `Iterable` / `AsyncIterable`를 감쌉니다. 수집 시 한 번 이터레이션됩니다 |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end`는 배타적입니다. `step`은 0이 아니어야 합니다. `number`와 `bigint` 모두 동작합니다 |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | 공급자는 요소마다 한 번 호출됩니다 |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | `concat`을 위한 항등 요소 |
| `useText` | `useText(text)`<br>`useText(text, delimiter)`<br>`useText(text, start)` / `(text, start, end)` | O(n) | O(n) for the text | **코드 포인트** 단위로 이터레이션하므로, 이모지와 CJK는 단일 요소로 유지됩니다 |
| `useAttribute` | `useAttribute<T>(object) → SynchronousSemantic<{key, value}>` | O(v + e) over v values and e edges | O(d + v) for the visited set at depth d | 순환 보호와 함께 중첩된 객체/배열을 재귀적으로 순회합니다 |
| `useGenerate` | `useGenerate<E>(supplier, interrupt) → SynchronousSemantic<E>` | O(n) × supplier cost | O(1) | 정지 `interrupt`(또는 하류의 `limit` / `takeWhile`)가 **반드시** 필요합니다 |
| `useIterate` | `useIterate<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useIterate<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) per collection | O(1) | 수집마다 이터레이터를 재생합니다 |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period (real time) | O(1) | 경과 시간을 방출합니다. 실제 시간을 소비합니다 |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | `0n` 인덱스의 단일 요소 |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob size) | O(chunk) per emitted copy | 기본 청크는 64 KiB입니다. 모든 청크는 독립적인 사본입니다 |
| `useSubscription` | `useSubscription(target, subscriber, event \| events) → AsynchronousSemantic<Event>` | one element per event | O(1) | `limit()` / `sub()` / `takeWhile()`가 구독 해제 경계를 정의합니다 |

### 5.2 예제

```typescript
// useOf / useFrom
useOf(1, 2, 3).toUnordered().toArray();                       // [1,2,3]
useFrom(new Set([1, 2, 2])).toUnordered().toArray();          // [1,2]
useFrom(new Map([["a", 1]])).toUnordered().toArray();         // [["a",1]]

// useRange — half-open interval, number or bigint
useRange(0, 5).toUnordered().toArray();                       // [0,1,2,3,4]
useRange(10n, 0n, -5n).toUnordered().toArray();               // [10n,5n]

// useFill
useFill("x", 3n).toUnordered().toArray();                     // ["x","x","x"]
useFill(() => Math.random(), 2n).toUnordered().toArray();     // two fresh randoms

// useText — code-point aware
useText("A😊B").toUnordered().toArray();                      // ["A","😊","B"]
useText("a,b,c", ",").toUnordered().toArray();                // ["a","b","c"]
useText("abcdef", 1, 3).toUnordered().toArray();              // ["b","c"]

// useGenerate — infinite supplier with a stop predicate
useGenerate(() => 7, (_element, index) => index >= 3n).toUnordered().toArray();   // [7,7,7]

// useIterate — async generator
async function* tick() { yield 1n; yield 2n; }
await useIterate(tick()).toUnordered().toArray();             // [1n,2n]

// useBlob — chunked binary read
const blob = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);
await useBlob(blob, 2n).toUnordered().toArray();              // [Uint8Array[1,2], Uint8Array[3,4], Uint8Array[5]]

// useSubscription — the boundary defines the unsubscribe point
const subscriber = {
  mount: () => { },
  unmount: () => { },
  subscribe: (event, handler) => window.addEventListener(event, handler),
  unsubscribe: (event, handler) => window.removeEventListener(event, handler)
};
useSubscription(window, () => subscriber, "resize")
  .limit(5n)
  .toUnordered()
  .forEach((event, index) => console.log(index, event));      // auto-unsubscribes after 5 events
```

---

<a id="6-transformation-operators"></a>
## 6. 변환 연산자

### 6.1 개요

모든 연산자는 새로운 `Semantic`을 반환합니다. 콜렉터블이 실행되기 전까지는 어떤 연산자도 요소를 건드리지 않습니다. 시간은 **요소당** 추가 비용(상류 자체 비용 외)이고, 공간은 파이프라인 실행 중 연산자가 유지하는 추가 메모리입니다.

| 연산자 | 목적 | 인덱스 효과 | 시간 (요소당) | 공간 |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | 1:1 변환 | forwarded | O(1) | O(1) |
| `filter(predicate)` | 일치하는 요소 유지 | forwarded | O(1) | O(1) |
| `flat(mapper)` | 1:N 평면화 (이터러블 또는 시맨틱) | re-indexed from 0 | O(1) per emitted element | O(1) |
| `flatMap(mapper)` | 1:N 평면화, 요소 타입 변경 가능 | re-indexed from 0 | O(1) per emitted element | O(1) |
| `distinct(keyExtractor?)` | 반복 키 제거, 첫 번째 유지 | forwarded | O(1) average | O(n) for the key set |
| `peek(consumer)` | 부수 효과, 요소는 그대로 통과 | forwarded | O(1) | O(1) |
| `limit(count)` | 앞의 *n*개 취함 | re-indexed from 0 | O(1), stops upstream after n | O(1) |
| `skip(count)` | 앞의 *n*개 버림 | forwarded | O(1) per skipped element | O(1) |
| `sub(start, end)` | 위치 기반 슬라이스 `[start, end)` | forwarded | O(1) | O(1) |
| `takeWhile(predicate)` | 술어가 유지되는 동안 취함 | forwarded | O(1), stops upstream on first miss | O(1) |
| `dropWhile(predicate)` | 술어가 유지되는 동안 버림 | re-indexed from 0 | O(1) | O(1) |
| `concat(other)` | 시맨틱이나 이터러블 덧붙임 | continues the index | O(1) | O(1) |
| `redirect(redirector)` | 원하는 방식으로 새 인덱스 계산 | **yours** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | negated and shifted | O(1) | O(1) |
| `translate(offset)` | 모든 인덱스를 *offset*만큼 지연 이동 | `i + offset` | O(1) | O(1) |
| `translate(mapper)` | 요소별 인덱스 이동 | `i + mapper(element, i)` | O(1) | O(1) |
| `shuffle(mapper?)` | 인덱스 무작위화 (또는 직접 만든 매퍼 사용) | random | O(1) | O(1) |
| `pipe(conversion)` | 제너레이터를 사용자 정의 함수에 전달 | up to you | yours | yours |
| `semantic()` | 콜렉터블을 다시 시맨틱으로 승격 | unchanged | O(1) | O(1) |

### 6.2 중요 노트

**`reverse`, `translate`, `shuffle`는 모두 `redirect` 전략이며 ordered 콜렉터가 필요합니다.** 이들은 인덱스만 다시 씁니다 — 아무것도 버퍼링되지 않고, 아무것도 아직 회전하지 않습니다. 인덱스를 요소 수로 나머지 연산하여 정규화하고 그걸 순서로 바꾸는 것은 `toOrdered()`입니다:

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(-2).toOrdered().toArray();        // [3,4,5,1,2]
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3, 4, 5]).shuffle().toOrdered().toArray();            // a fresh permutation per call
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

`toUnordered()`로 수집하면, 동일한 파이프라인은 원시 인덱스를 그대로 가진 채 도착 순서대로 요소를 반환합니다 — [인덱스 모델](#10-the-index-model) 참조.

**`translate`는 순수하고 지연된 인덱스 이동입니다.** 두 오버로드는 인덱스에 더합니다(`i + offset` 또는 `i + mapper(element, i)`)이며 스트림을 절대 버퍼링하지 않습니다. 회전은 *ordered 콜렉터*가 인덱스를 요소 수로 나머지 연산하여 정규화할 때만 구체화되므로, `translate(2)`는 `limit`이 따르는 무한 범위에서도 저렴합니다.

**`redirect`는 범용 도구입니다.** 어떤 인덱스 전략이든 표현할 수 있습니다 — 역순, 인터리브, 해시 분할 등:

```typescript
useFrom([1, 2, 3, 4, 5]).redirect((_e, i) => -i - 1n).toOrdered().toArray();   // [5,4,3,2,1]
useFrom([1, 2, 3, 4]).redirect((_e, i) => i % 2n === 0n ? i + 1n : i - 1n)
  .toOrdered().toArray();                                                       // [2,1,4,3]
```

**인덱스 기반 슬라이싱은 여전히 일급입니다:**

```typescript
useOf(1, 2, 3, 4, 5).sub(1, 3).toUnordered().toArray();               // [2,3]
useOf(1, 2, 3, 4, 5).skip(2n).toUnordered().toArray();                // [3,4,5]
useOf(1, 2, 3, 4, 5).takeWhile(n => n < 3).toUnordered().toArray();   // [1,2]
useOf(1, 2, 3, 4, 1).dropWhile(n => n < 3).toUnordered().toArray();   // [3,4,1]
```

---

<a id="7-collectables-and-terminal-operations"></a>
## 7. 콜렉터블과 터미널 연산

### 7.1 콜렉터블 선택

콜렉터블은 **순서**와 **인덱스 장부**를 모두 소유합니다. `n`은 요소 개수입니다.

| 콜렉터블 | 구조 | 시간 | 공간 | 순서 | 사용 시점 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | `Map<bigint, E>` keyed by index | O(n) | O(n) | insertion order | 최대 처리량, 순서 무관; 원시 인덱스가 그대로 보존됨 |
| `toOrdered()` | array sorted by element index | O(n log n) | O(n) | by normalised index | 역순/회전/셔플이 반영되어야 하거나 위치 기반 접근이 필요할 때 |
| `toOrdered(comparator)` | sorted by your comparator, index rebuilt as position | O(n log n) | O(n) | by your comparator | 정렬 뷰, 최소/최대 스타일 읽기 |
| `toNumericStatistics()` | value-sorted buffer | O(n log n) | O(n) | by value | `number`에 대한 통계 |
| `toBigintStatistics()` | value-sorted buffer | O(n log n) | O(n) | by value | `bigint`에 대한 통계 |
| `toWindow()` | value-sorted buffer | O(n log n) | O(n) | by value | `slide` / `tumble` |
| `toCollectable(mapper)` | whatever the mapper returns | — | — | — | 사용자 정의 콜렉터블 |

### 7.2 터미널

비용은 구체화 이후를 기준으로 합니다. `k`는 목표 위치, `n`은 요소 개수입니다.

| 터미널 | 반환 | 시간 | 공간 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | O(n) | O(n) | 버퍼를 비웁니다 |
| `toSet()` | `Set<E>` | O(n) average | O(n) | 동일성 기준 중복 제거 |
| `toMap(keyExtractor, valueExtractor?)` | `Map<K, V>` | O(n) average | O(n) | 마지막 쓰기가 우선 |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | O(1) | 버퍼가 이미 알고 있습니다 |
| `forEach(action)` | `void` | O(n) | O(1) | `action(element, index)` |
| `join(…)` | `string` | O(n) | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `log()` / `error()` | `void` | O(n) | O(n) | `[prefix … suffix]`로 감싼 콘솔 출력 |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | O(1) | IO 유사 터미널 |
| `collect(collector)`<br>`collect(identity, accumulator, finisher)` | `R` | O(n) | accumulator | 위 모든 터미널을 뒷받침하는 범용 폴드 |
| `reduce(accumulator)` | `Optional<E>` | O(n) | O(1) | 빈 스트림 → 빈 Optional |
| `reduce(identity, accumulator)` | `E` | O(n) | O(1) | — |
| `reduce(identity, accumulator, finisher)` | `R` | O(n) | O(1) | — |
| `group(classifier)` | `Map<K, E[]>` | O(n) average | O(n) | — |
| `groupBy(keyExtractor, valueExtractor)` | `Map<K, V[]>` | O(n) average | O(n) | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | O(n) | 인덱스별 라운드 로빈으로 `count`개 버킷에 분배 |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | O(n) | 버킷 번호는 분류자에서 옵니다 |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) worst, short-circuits | O(1) | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | O(1) | 구체화된 순서에서의 위치 기반 |
| `findAt(k)` | `Optional<E>` | O(k), stops early | O(1) | 구체화된 순서에서의 (k+1)번째 요소 |
| `findNegativeAt(k)` | `Optional<E>` | O(n−k), stops early | O(1) | 구체화된 순서의 끝에서 거슬러 셉니다 |
| `findMaximum(comparator?)` / `findMinimum(comparator?)` | `Optional<E>` | O(n) (O(1) on statistics) | O(1) | 기본값은 구조적 비교 |
| `frequency()` | `Map<E, bigint>` | O(n) average | O(n) | 통계 콜렉터블 전용 |
| `[Symbol.iterator]()` / `[Symbol.asyncIterator]()` | iterator | O(n) | O(1) | 콜렉터블에 대한 `for…of` |

### 7.3 예제

```typescript
const stream = () => useOf(1, 2, 3, 4, 5).toUnordered();

stream().count();                                    // 5n
stream().anyMatch(n => n > 4);                       // true
stream().allMatch(n => n > 0);                       // true
stream().nonMatch(n => n > 9);                       // true
stream().findFirst().orElse(-1);                     // 1
stream().findLast().orElse(-1);                      // 5
stream().findMaximum().orElse(-1);                   // 5
stream().findAt(2n).orElse(-1);                      // 3 (materialised position 2)
stream().findNegativeAt(-1n).orElse(-1);             // 5 (last materialised element)
stream().join("|");                                  // "[1|2|3|4|5]"
stream().reduce((a, b) => a + b).orElse(0);          // 15
stream().reduce(100, (a, b) => a + b);               // 115
stream().group(n => (n % 2 === 0 ? "even" : "odd"));  // Map { odd: [1,3,5], even: [2,4] }

useRange(0n, 9n).toUnordered().partition(3n);
// [[0n,3n,6n], [1n,4n,7n], [2n,5n,8n]] — round-robin by index

useRange(0n, 6n).toUnordered().partitionBy((_element, index) => index % 2n);
// [[0n,2n,4n], [1n,3n,5n]]

// The fold is public: write your own collector inline
useOf(1, 2, 3).toUnordered().collect(
  () => 0,                          // identity
  (sum, element) => sum + element,  // accumulator
  sum => `total=${sum}`             // finisher
);                                                 // "total=6"
```

---

<a id="8-statistics"></a>
## 8. 통계

`toNumericStatistics()`와 `toBigintStatistics()`는 값 정렬 버퍼와 통계 API를 제공합니다. 둘 다 매퍼를 받으므로, 투영된 값에 대해 계산할 수 있습니다: `.average(element => element.price)`.

| 메서드 | 의미 | `number` | `bigint` |
| :--- | :--- | :--- | :--- |
| `summate()` | Σx | exact | exact |
| `average()` / `mean()` | Σx / n | exact | integer division |
| `median()` | 중앙값 (짝수 개수는 두 중앙값의 평균) | exact | rounded |
| `mode()` | 최빈값 | exact | exact |
| `variance()` | 모분산 σ² | exact | rounded |
| `standardDeviation()` | √σ² | exact | rounded |
| `range()` | max − min | exact | exact |
| `quantile(q)` | 최근접 순위 분위수, `0 ≤ q ≤ 1` | exact | exact |
| `interquartileRange()` | q(0.75) − q(0.25) | exact | exact |
| `skewness()` | Σ((x−μ)/σ)³ / n | exact | rounded |
| `kurtosis()` | Σ((x−μ)/σ)⁴ / n − 3 (excess) | exact | rounded |
| `frequency()` | 값 → 개수 | `Map<E, bigint>` | `Map<E, bigint>` |

모든 메서드는 정렬된 버퍼에서 O(1)입니다(정렬 비용은 구체화 시 한 번 지불). `frequency()`만 O(n) 평균, O(n) 공간입니다.

`bigint` 결과는 부동소수점으로 계산되어 `bigint`로 반올림됩니다. 정수 나눗셈은 그렇지 않으면 왜곡되기 때문입니다(`[1n,2n,3n,4n]`의 분산은 `3`이 아니라 `1.25`). 정확한 분수 통계가 필요하면 `number`로 매핑해 수치 콜렉터를 사용하세요.

```typescript
const stats = useOf(1, 2, 3, 4).toNumericStatistics();
stats.summate();              // 10
stats.average();              // 2.5
stats.median();               // 2.5
stats.variance();             // 1.25
stats.standardDeviation();    // 1.118…
stats.skewness();             // 0
stats.kurtosis();             // -1.36 (excess kurtosis)
stats.range();                // 3
stats.quantile(0.5);          // 2 (nearest rank)
stats.frequency();            // Map { 1 => 1n, 2 => 1n, 3 => 1n, 4 => 1n }

// Projected statistics
useOf({ price: 10 }, { price: 30 }).toNumericStatistics().average(item => item.price);   // 20
```

---

<a id="9-windows"></a>
## 9. 윈도우

`toWindow()`는 `slide` / `tumble`이 시맨틱 *의 시맨틱*을 생성하는 콜렉터블을 반환합니다.

```typescript
const windows = useOf(1, 2, 3, 4, 5).toWindow();

windows.tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2], [3,4], [5]]

windows.slide(3n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2,3], [2,3,4], [3,4,5], [4,5], [5]]   — trailing partial windows are included
```

`tumble(size)`는 전체적으로 O(n)입니다. `slide(size, step)`은 윈도우가 겹치므로 O(n × size)입니다.

비동기 소스도 동일하게 동작합니다. `slide` / `tumble`은 기저 버퍼가 준비되기를 기다립니다:

```typescript
const asyncWindows = await useFrom(tick()).toWindow().tumble(2n).toUnordered().toArray();
for (const window of asyncWindows) {
  console.log(await window.toUnordered().toArray());
}
```

---

<a id="10-the-index-model"></a>
## 10. 인덱스 모델

인덱스 모델은 두 부분으로 이루어집니다: **파이프라인**은 인덱스를 저렴하고 게으르게 다시 쓰고, **콜렉터블**은 그 의미를 결정합니다. 이 분리는 의도적인 것이며, 순서 비용이 자리하는 곳입니다.

| 개념 | 동작 |
| :--- | :--- |
| Index type | `bigint`, 모든 콜백의 두 번째 인자로 항상 사용 가능 |
| Pipeline arithmetic | `reverse()` = `redirect(-i - 1n)`, `translate(o)` = `redirect(i + o)`, `shuffle()` = `redirect(random)` — 모두 요소당 O(1), 모두 지연, 어느 것도 버퍼링하지 않음 |
| `toUnordered()` — no bookkeeping | 모든 원시 인덱스를 `Map`에 그대로 유지합니다. unordered로 수집된 `translate(2)`는 여전히 인덱스 `2n,3n,4n,…`를 산출합니다. 이것이 성능 계약입니다: 정렬 없음, 정규화 없음, O(n) |
| `toOrdered()` — normalisation | 각 인덱스를 `((i mod n) + n) mod n`(n = 요소 개수)로 다시 쓰고 정렬합니다. 음수나 초과 인덱스는 `0..n−1`로 접어들어, `reverse`, `translate(7)`, `shuffle` 모두 유효한 위치에 도달합니다 |
| `toOrdered(comparator)` | 값으로 정렬하고 인덱스를 위치로 재구축합니다 — 이것이 통계가 사용하는 방식입니다 |
| Rotation | 정규화에서 자연스레 나옵니다: `translate(2)`는 인덱스 `2,3,4,0,1`을 주고, 이는 회전 `[4,5,1,2,3]`로 정렬됩니다. 연산자에서는 버퍼링이 일어나지 않습니다 |
| Duplicate indices | `toUnordered()`가 감지하여 대리 키를 부여하므로 **어떤 요소도 조용히 버려지지 않습니다**. `toOrdered()`는 동일 인덱스를 상대 순서대로 유지합니다 |
| `findAt(k)` / `findNegativeAt(k)` | **구체화된 순서**를 가리킵니다 — `findAt(1n)`은 항상 콜렉터블이 생성한 두 번째 요소, `findNegativeAt(-1n)`은 항상 마지막 요소입니다. `redirect` / `reverse` / `translate`가 원시 인덱스에 무엇을 했든 상관없이 |
| `distinct` | 첫 번째 발생 **과 그 원래 인덱스**를 유지합니다 |
| `sub` / `skip` / `limit` | 인덱스 값이 아닌 요소를 셉니다 |

요약하자면: **`OrderedCollectable`과 그 하위 클래스는 인덱스 장부를 소유**합니다(모듈로 n 정규화, 정렬, 위치 주소 지정). 반면 **`UnorderedCollectable`은 인덱스를 절대 건드리지 않음으로써 성능을 보장**합니다. 파이프라인이 아닌 쿼리마다 선택하세요.

---

<a id="11-the-asynchronous-model"></a>
## 11. 비동기 모델

데이터가 아직 존재할 수 없는 소스는 `AsynchronousSemantic<E>`를 반환합니다:

| 비동기 소스 | 이유 |
| :--- | :--- |
| `usePromise` | 값이 나중에 도착함 |
| `useBlob` | `Blob.stream()`이 비동기임 |
| `useInterval` | `setInterval`에 의해 구동됨 |
| `useSubscription` | 외부 이벤트에 의해 구동됨 |
| `useFrom` / `useIterate` with an `AsyncIterable` | `for await`로 생성됨 |

소비는 일관적입니다 — `AsynchronousCollectable`의 모든 터미널은 `Promise`를 반환하며, 의미(인덱스 모델, 정규화, 위치 기반 `findAt`)는 동기 측과 동일합니다:

```typescript
const stats = await useFrom(asyncGenerator()).map(n => n * 2n).limit(10n).toBigintStatistics();
await stats.summate();

for await (const element of usePromise(Promise.resolve(1)).toUnordered()) {
  console.log(element);
}
```

타입 시스템이 당신을 구해주지 못하는 세 가지:

1. **스트림 종료.** 이벤트나 타이머 소스는 스스로 완료되지 않습니다. 경계를 정의하세요 — `limit(n)`, `sub(start, end)` 또는 `takeWhile(predicate)` — 그렇지 않으면 구독이 살아있게 됩니다.
2. **콜렉터블 대기.** `toOrdered()`, 통계, `toWindow()`는 응답하기 전에 소스가 완료되기를 기다립니다. 절대 완료되지 않는 promise 전용 소스는 이들을 보류 상태로 둡니다.
3. **계층 혼합.** 동기 콜렉터블은 비동기 소스를 소비할 수 없습니다. 비동기 팩토리가 관여하면, 파이프라인 전체를 비동기 측에 두고 터미널을 `await` 하세요.

---

<a id="12-utility-helpers"></a>
## 12. 유틸리티 헬퍼

| 헬퍼 | 목적 | 시간 |
| :--- | :--- | :--- |
| `useCompare(a, b)` | 모든 기본 정렬/최소/최대에서 사용하는 구조적 비교(`number`, `bigint`, `string`, `boolean`, `symbol`, `Symbol.toPrimitive`를 통한 객체) | O(1) primitives |
| `useRandom(start, end?)` | 반열린 범위에서 균등한 난수 `number` / `bigint` | O(1) |
| `useHash(value, …)` | 모든 값(원시값, 객체, 순환)을 위한 안정적인 64비트급 `bigint` 해시 | O(v) over visited values |
| `register(type, handler)` / `unregister(type)` / `maskOf(type)` | 사용자 정의 타입을 위한 해시 확장 | O(1) |
| `useTraverse(object, callback)` | 순환 보호를 갖춘 깊은 순회. 콜백은 `(key, value, path)`를 받습니다. | O(v + e) |
| `useStringify(object, callback?)` | 순환 참조를 견디는 JSON 직렬화 | O(v + e) |
| `useToNumber(value)` / `useToBigInt(value)` | 총체적 변환(절대 던지지 않음. 쓸 수 없는 입력에는 `0` / `0n` 반환) | O(1) |
| `useGenerator(iterable)` / `useArrange(source, comparator?)` | 원시 `(accept, interrupt)` 제너레이터와 정렬 제너레이터 | O(n) / O(n log n) |
| `Optional<T>` | `of`, `ofNullable`, `ofNonNull`, `empty`; `map`, `flat`, `flatMap`, `filter`, `get`, `get(default)`, `ifPresent(action, elseAction)`, `orElse`, `isPresent`, `isEmpty`, `semantic()` | O(1) per method |
| Type guards | `isNumber` (excludes `NaN` and `Infinity`), `isBigInt`, `isString`, `isBoolean`, `isSymbol`, `isFunction`, `isObject`, `isPrimitive`, `isIterable`, `isAsyncIterable`, `isPromise`, `isAsyncFunction`, `isGeneratorFunction`, `isAsyncGeneratorFunction`, `isOptional`, `isSynchronousSemantic` / `isAsynchronousSemantic`, `isSynchronousCollectable` (+ async), `isSynchronousOrderedCollectable`, `isSynchronousUnorderedCollectable`, `isSynchronousStatistics`, `isSynchronousNumericStatistics`, `isSynchronousBigIntStatistics`, `isSynchronousWindowCollectable`, `isSynchronousCollector` | O(1) |

```typescript
useCompare(1, 2);                        // negative
useRandom(1n, 10n);                      // 1n … 9n
useHash({ a: 1 }) === useHash({ a: 1 }); // true — stable and structural
useTraverse({ a: { b: 1 } }, (key, value) => console.log(key, value));
useToBigInt("42");                       // 42n
Optional.ofNullable(null).orElse(5);     // 5
```

---

<a id="13-comparison-with-other-libraries"></a>
## 13. 다른 라이브러리와의 비교

| 측면 | Semantic-TypeScript | RxJS | 네이티브 이터레이터 |
| :--- | :--- | :--- | :--- |
| Model | 명시적 `interrupt` 신호와 함께 푸시 | 푸시, 구독 객체 | 풀 |
| Position | 모든 요소의 본질적 `bigint` 인덱스 | 조합하는 연산자(`scan`, `withLatestFrom`) | 수동 카운터 |
| Laziness | 연산자 지연, 콜렉터블 명시적 | 연산자 지연, `subscribe` 즉시 | 지연 |
| Sync + async | 하나의 API, 타입에 플래그된 비동기 팩토리 | 비동기 우선 | 수동 `for await` 연결 |
| Terminal API | 풍부한 콜렉터블(`toArray`, `toMap`, `group`, `reduce`, `find*`, statistics) | 연산자만 | 없음 |
| Statistics | 내장, `number`와 `bigint` 지원 | 외부 | 없음 |
| Lifecycle safety | 경계 연산자가 구독 해제 | 수동 `unsubscribe` / `takeUntil` | 수동 |
| Ecosystem / size | 작음, 의존성 없음 | 큼, 풍부한 연산자 생태계 | 없음 |

명시적 비용 모델과 스케줄러 없이 인덱스 기반 데이터 처리를 원한다면 Semantic-TypeScript를 선택하세요. 연산자 생태계, 다중 관찰자 의미론, 스케줄러 제어가 필요하면 RxJS를 선택하세요.

---

<a id="14-performance-characteristics"></a>
## 14. 성능 특성

쿼리의 비용은 보이는 세 부분의 합입니다: 소스(§5), 연산자(§6), 콜렉터블(§7). 숨겨진 것은 두 번 실행되지 않습니다.

| 연산 | 시간 | 공간 | 비고 |
| :--- | :--- | :--- | :--- |
| `map` / `filter` / `peek` | O(1) per element | O(1) | 순수 변환 |
| `limit` / `takeWhile` | O(1) per element | O(1) | 상류를 즉시 정지 |
| `reverse` / `translate` / `shuffle` | O(1) per element | O(1) | 인덱스 산술만 — 버퍼링 없음 |
| `distinct` | O(1) average per element | O(n) | 키의 `Set` |
| `toUnordered()` | O(n) | O(n) | 요소당 `Map` 삽입 하나, 인덱스 미변경 |
| `toOrdered()` | O(n log n) | O(n) | 정규화 O(n) + 정렬 O(n log n) |
| Statistics | O(n log n) once, then O(1) per method | O(n) | 정렬/집계 버퍼 유지 |
| `findAt(k)` / `findNegativeAt(k)` | O(k) / O(n−k) | O(1) | 위치를 지나자마자 조기 중단 |
| `findMaximum` / `findMinimum` | O(n) generic, O(1) statistics | O(1) | 최적값을 유지하는 단일 패스 |

경험적 규칙: 실제로 결과가 필요할 때까지 파이프라인을 지연 상태로 두세요. 순서가 중요하지 않다면 `toUnordered()`를 선호하세요. `limit` / `takeWhile`은 의미론이 허용하는 한 일찍 배치하세요. 순서 비용을 결정하는 것은 연산자가 아닌 *콜렉터블*에 맡기세요.

---

<a id="15-pitfalls-and-faq"></a>
## 15. 함정과 FAQ

**"내 파이프라인이 아무것도 반환하지 않거나 멈춥니다."** 소스가 끝나지 않았습니다. `useInterval`, `useSubscription`, `usePromise`, `useGenerate`는 경계(`limit`, `sub`, `takeWhile`)나 완료되는 소스가 필요합니다.

**"`reverse()`가 아무 효과도 없었습니다."** 이를 인덱스 장부를 보장하지 않는 `toUnordered()`로 소비했습니다. `toOrdered()`를 사용하세요.

**"`translate(2)`가 회전되지 않은 요소를 반환했습니다."** 같은 이유입니다: `translate`는 인덱스만 이동시킵니다. 회전은 `toOrdered()`의 나머지 정규화로 실현됩니다. unordered로 수집하면 이동은 원시 인덱스에서 여전히 보입니다.

**"요소가 하나 사라진 이유는?"** 상류가 중복 인덱스를 생성했고 당신은 `toUnordered()`로 소비 중입니다. 대리 키는 데이터 손실을 막지만, 두 요소를 순서대로 *보고* 싶다면 대신 `toOrdered()`로 소비하세요.

**"`findAt(1n)`가 예상치 못한 것을 반환합니다."** `findAt`은 원시 인덱스가 아닌 **구체화된 순서**를 가리킵니다. `.reverse().toOrdered()` 이후 위치 1은 역순 시퀀스의 두 번째 요소입니다. 원시 인덱스 `1n`을 지닌 요소를 원한다면 인덱스로 명시적으로 필터링하세요.

**"`bigint` 통계가 반올림된 것처럼 보입니다."** 맞습니다 — `bigint` 결과는 설계상 정수 반올림됩니다([통계](#8-statistics) 참조). 정확한 분수를 위해 `number`로 매핑하세요.

**"`toArray()` 전에 `toXxx()`를 호출해야 하나요?"** 예. 터미널 연산은 시맨틱이 아닌 콜렉터블에 있습니다. 이는 의도적입니다: 저장소와 순서 비용을 타입에서 보이게 하기 위함입니다.

**"트리 쉐이킹이 되나요?"** `sideEffects: false`가 선언되어 있으므로 사용하는 것만 import 하세요. `useHash`는 모듈이 로드될 때 기본 핸들러를 등록한다는 점에 유의하세요.

---

<a id="16-license"></a>
## 16. 라이선스

MIT © Eloy Kim

전체 릴리스 이력을 보려면 [CHANGELOG.md](./CHANGELOG.md)를 참조하세요.
