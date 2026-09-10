# **Semantic-TypeScript**

**Поток, проиндексированный.** Ваши данные под точным контролем.

[English](./readme.md) · [简体中文](./readme.cn.md) · [繁體中文](./readme.tw.md) · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · Русский

Библиотека типобезопасной потоковой обработки, объединяющая **генераторы JavaScript**, **Java Stream** и адресацию данных по индексу. Каждый элемент несёт `bigint`-индекс, каждый конвейер ленив, и каждая терминальная операция — явный выбор.

```bash
npm install semantic-typescript
```

- Нулевые зависимости времени выполнения, чистый ESM, поставляется со своими типами.
- 55 регрессионных тестов: `npm install && npm test`.
- Полная история изменений: [CHANGELOG.md](./CHANGELOG.md).

---

## Оглавление

1. [Философия проектирования](#1-design-philosophy)
2. [Архитектура](#2-architecture)
3. [Поток данных: от источника к результату](#3-data-flow-from-source-to-result)
4. [Быстрый старт](#4-quick-start)
5. [Фабричные функции](#5-factory-functions)
6. [Операторы преобразования](#6-transformation-operators)
7. [Коллектораблы и терминальные операции](#7-collectables-and-terminal-operations)
8. [Статистика](#8-statistics)
9. [Окна](#9-windows)
10. [Модель индексов](#10-the-index-model)
11. [Асинхронная модель](#11-the-asynchronous-model)
12. [Вспомогательные функции](#12-utility-helpers)
13. [Сравнение с другими библиотеками](#13-comparison-with-other-libraries)
14. [Характеристики производительности](#14-performance-characteristics)
15. [Подводные камни и FAQ](#15-pitfalls-and-faq)
16. [Лицензия](#16-license)

---

<a id="1-design-philosophy"></a>
## 1. Философия проектирования

**1. Сначала индекс.** В большинстве библиотек потоков позиция — это то, что вы *воссоздаёте* — счётчик, который вы носите в `scan`, или аргумент индекса, который пробрасываете вручную. Здесь позиция *интринсична*: протокол генератора передаёт каждому элементу `bigint`-индекс, поэтому `distinct`, `skip`, `sub`, `reverse`, `translate` и `shuffle` выражаются как индексная арифметика, а не ad-hoc состояние. Изменить индекс элемента — *значит* переупорядочить; переиндексация — *значит* отфильтровать.

**2. Проталкивание с явным сигналом остановки.** Источник — это функция `(accept, interrupt) => void | Promise<void>`. Она проталкивает элементы через `accept(element, index)` и спрашивает `interrupt(element, index)`, следует ли остановиться. Нет скрытого планировщика, нет объекта подписки, нет фазы очистки, которую нужно помнить, — обратное давление и завершение являются частью протокола, а бесконечные потоки становятся обычным (не особым) случаем.

**3. Лень — значение по умолчанию; материализация — решение.** Операторы лишь оборачивают генераторы. Ничего не выполняется, пока **коллекторабл** не поглотит конвейер, а выбранный вами коллектор определяет стоимость: `toUnordered()` — это O(n) и никогда не трогает ваши индексы, `toOrdered()` — это O(n log n) и нормализует их. Поскольку решение явно выражено в возвращаемом типе, вы всегда знаете, платите ли вы за порядок и память.

**4. Перенаправление — единственный механизм переупорядочивания.** `reverse()`, `translate()` и `shuffle()` — не что иное, как заранее упакованные стратегии `redirect()`; каждая переписывает индекс элемента и ничего больше. Именно поэтому все они **требуют `toOrdered()`**, чтобы вступить в силу: конвейер лишь переписывает индексы, и именно упорядочивающий коллектор решает, что эти индексы означают.

**5. Синхронность и асинхронность — один API.** Одни и те же операторы существуют как для конечных данных в памяти, так и для промисов, асинхронных итерируемых объектов, таймеров, блобов и подписок на события. Источники, которые не могут быть синхронными, заявляют об этом в возвращаемом типе (`AsynchronousSemantic`), поэтому «нужно ли мне было делать await?» перестаёт быть сюрпризом во время выполнения.

---

<a id="2-architecture"></a>
## 2. Архитектура

Три слоя, одно направление. Данные текут вниз; тип, который вы держите, говорит вам, что можно сделать дальше.

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

| Слой | Тип | Ответственность | Получаете из |
| :--- | :--- | :--- | :--- |
| Источник / конвейер | `SynchronousSemantic<E>`<br>`AsynchronousSemantic<E>` | Строит ленивый конвейер: преобразование, переиндексация, разбиение, слияние. Элементы ещё не затрагиваются. | Фабрик и каждого оператора над семантикой |
| Хранилище / представление | `SynchronousUnorderedCollectable<E>`<br>`SynchronousOrderedCollectable<E>`<br>`SynchronousNumericStatistics<E>`<br>`SynchronousBigIntStatistics<E>`<br>`SynchronousWindowCollectable<E>`<br>(+ `Asynchronous*` counterparts) | Материализует конвейер в буфер с адресацией по индексу и предоставляет терминальный API. Семейство **ordered** владеет учётом индексов; семейство **unordered** отказывается от него ради пропускной способности. | `toUnordered()` `toOrdered()` `toNumericStatistics()` `toBigintStatistics()` `toWindow()` `toCollectable()` |
| Коллектор | `SynchronousCollector<E, A, R>`<br>`AsynchronousCollector<E, A, R>` | Переиспользуемое свёртывание: `identity → accumulator → finisher`, опционально с `interruptor`. Обеспечивает каждую терминальную операцию и может быть написано пользователем. | фабрики коллекторов `useSynchronous*` / `useAsynchronous*` или `Collectable.collect(...)` |

Зачем существует средний слой: разделение «что представляет собой конвейер» и «как он хранится» позволяет одному `toOrdered()` обслуживать обращение, ротацию и перемешивание — конвейер лишь переписывает индексы, а коллектор решает, что они означают.

---

<a id="3-data-flow-from-source-to-result"></a>
## 3. Поток данных: от источника к результату

```typescript
const result = useRange(0n, 100n)      // (1) source: reserve indices 0n,1n,2n,…
  .filter(n => n % 2n === 0n)          // (2) operator: index is forwarded unchanged
  .translate(2)                        // (3) operator: index becomes i + 2 (a lazy shift)
  .limit(5n);                          // (4) operator: interrupt() returns true after 5 elements

const ordered = result.toOrdered();    // (5) collectable: materialise; indices normalised mod n, sorted
const array = ordered.toArray();       // (6) terminal: drain the buffer
```

1. **Сборка.** Шаги 1–4 не создают ничего, кроме замыканий. Сотня элементов никогда не генерируется.
2. **Проталкивание.** Когда коллекторабл наконец запускает генератор, элементы текут без планировщика: источник ведёт, `accept` записывает в коллектор, `interrupt` решает, когда остановиться, — именно поэтому `limit(5n)` посреди диапазона в миллион элементов стоит пяти итераций, а не миллиона.
3. **Индекс.** Операторы никогда не теряют индекс. `filter` передаёт исходный индекс (поэтому «3-й *сохранённый* элемент» — это всё ещё «индекс 3»), тогда как `skip` / `sub` / `limit` / `distinct` намеренно переиндексируют.
4. **Материализация.** Коллекторабл выполняет генератор ровно один раз — во время построения.
5. **Терминальная операция.** Методы коллекторабла читают буфер; они дешевы, повторяемы и никогда не перезапускают конвейер.

**Единственное правило, стоящее запоминания:** преобразования ленивы, коллектораблы жадны, терминальные операции бесплатны.

---

<a id="4-quick-start"></a>
## 4. Быстрый старт

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
## 5. Фабричные функции

### 5.1 Обзор

Построение всегда O(1) — фабрика лишь оборачивает генератор. Таблица ниже указывает стоимость *потребления* `n` элементов из каждого источника, а также дополнительную память, которую сам источник требует сверх собираемых вами элементов.

| Фабрика | Сигнатура (результат) | Время (потребление n) | Память (источник) | Примечания |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | Индексы 0..n−1; spread-аргумент уже материализован |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | Оборачивает любой `Iterable` / `AsyncIterable`; итерируется один раз при сборе |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` исключается; `step` должен быть ненулевым; `number` и `bigint` оба работают |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | Поставщик вызывается один раз на элемент |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | Нейтральный элемент для `concat` |
| `useText` | `useText(text)`<br>`useText(text, delimiter)`<br>`useText(text, start)` / `(text, start, end)` | O(n) | O(n) для текста | Итерирует **кодовые точки**, поэтому эмодзи и иероглифы CJK остаются единичными элементами |
| `useAttribute` | `useAttribute<T>(object) → SynchronousSemantic<{key, value}>` | O(v + e) по v значениям и e рёбрам | O(d + v) для посещённого множества на глубине d | Рекурсивно обходит вложенные объекты/массивы с защитой от циклов |
| `useGenerate` | `useGenerate<E>(supplier, interrupt) → SynchronousSemantic<E>` | O(n) × стоимость поставщика | O(1) | **Должен** иметь останавливающий `interrupt` (или нижестоящий `limit` / `takeWhile`) |
| `useIterate` | `useIterate<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useIterate<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) за сборку | O(1) | Воспроизводит итератор при каждой сборке |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period (реальное время) | O(1) | Порождает истекшее время; потребляет реальное время |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | Один элемент с индексом `0n` |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(размер blob) | O(chunk) на порождённую копию | Размер чанка по умолчанию — 64 КиБ; каждый чанк — независимая копия |
| `useSubscription` | `useSubscription(target, subscriber, event \| events) → AsynchronousSemantic<Event>` | один элемент на событие | O(1) | `limit()` / `sub()` / `takeWhile()` определяют границу отписки |

### 5.2 Примеры

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
## 6. Операторы преобразования

### 6.1 Обзор

Каждый оператор возвращает новую `Semantic`; ни один из них не трогает элемент, пока не запустится коллекторабл. Время — это дополнительная стоимость **на элемент** (сверх собственной стоимости вышестоящего); память — это дополнительная память, которую оператор удерживает во время работы конвейера.

| Оператор | Назначение | Эффект для индекса | Время (на элемент) | Память |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | 1:1 преобразование | передаётся | O(1) | O(1) |
| `filter(predicate)` | оставляет подходящие элементы | передаётся | O(1) | O(1) |
| `flat(mapper)` | 1:N развёртывание (итерируемое или семантика) | переиндексация с 0 | O(1) на порождённый элемент | O(1) |
| `flatMap(mapper)` | 1:N развёртывание, может менять тип элемента | переиндексация с 0 | O(1) на порождённый элемент | O(1) |
| `distinct(keyExtractor?)` | удаляет повторяющиеся ключи, оставляет первый | передаётся | O(1) в среднем | O(n) для множества ключей |
| `peek(consumer)` | побочный эффект, элемент проходит сквозь | передаётся | O(1) | O(1) |
| `limit(count)` | берёт первые *n* | переиндексация с 0 | O(1), останавливает вышестоящий после n | O(1) |
| `skip(count)` | пропускает первые *n* | передаётся | O(1) на пропущенный элемент | O(1) |
| `sub(start, end)` | позиционный срез `[start, end)` | передаётся | O(1) | O(1) |
| `takeWhile(predicate)` | берёт, пока предикат истинен | передаётся | O(1), останавливает вышестоящий при первом несовпадении | O(1) |
| `dropWhile(predicate)` | пропускает, пока предикат истинен | переиндексация с 0 | O(1) | O(1) |
| `concat(other)` | добавляет семантику или итерируемое | продолжает индекс | O(1) | O(1) |
| `redirect(redirector)` | вычисляет новый индекс как угодно | **ваш** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | инвертирован и смещён | O(1) | O(1) |
| `translate(offset)` | ленивый сдвиг каждого индекса на *offset* | `i + offset` | O(1) | O(1) |
| `translate(mapper)` | посдвиг индекса на элемент | `i + mapper(element, i)` | O(1) | O(1) |
| `shuffle(mapper?)` | рандомизирует индекс (или использует свой маппер) | случайный | O(1) | O(1) |
| `pipe(conversion)` | передаёт генератор пользовательской функции | на ваше усмотрение | ваш | ваш |
| `semantic()` | поднимает коллекторабл обратно в семантику | неизменён | O(1) | O(1) |

### 6.2 Важные замечания

**`reverse`, `translate` и `shuffle` — это все стратегии `redirect` и требуют упорядочивающего коллектора.** Они лишь переписывают индексы — ничего не буферизуется, ничего ещё не вращается. Именно `toOrdered()` нормализует индексы по модулю количества элементов и превращает их в порядок:

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(-2).toOrdered().toArray();        // [3,4,5,1,2]
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3, 4, 5]).shuffle().toOrdered().toArray();            // a fresh permutation per call
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

Собранные через `toUnordered()`, те же конвейеры возвращают элементы в порядке прибытия с их сырыми индексами — см. [Модель индексов](#10-the-index-model).

**`translate` — чистый, ленивый сдвиг индекса.** Обе перегрузки добавляются к индексу (`i + offset` или `i + mapper(element, i)`) и никогда не буферизуют поток. Ротация материализуется только тогда, когда *упорядочивающий коллектор* нормализует индексы по модулю количества элементов, — поэтому `translate(2)` дёшев даже на бесконечном диапазоне с последующим `limit`.

**`redirect` — универсальный инструмент.** Любая стратегия индекса может быть выражена через него — обращённая, чередующаяся, хеш-партиционированная:

```typescript
useFrom([1, 2, 3, 4, 5]).redirect((_e, i) => -i - 1n).toOrdered().toArray();   // [5,4,3,2,1]
useFrom([1, 2, 3, 4]).redirect((_e, i) => i % 2n === 0n ? i + 1n : i - 1n)
  .toOrdered().toArray();                                                       // [2,1,4,3]
```

**Управляемое индексом сечение остаётся полноценным:**

```typescript
useOf(1, 2, 3, 4, 5).sub(1, 3).toUnordered().toArray();               // [2,3]
useOf(1, 2, 3, 4, 5).skip(2n).toUnordered().toArray();                // [3,4,5]
useOf(1, 2, 3, 4, 5).takeWhile(n => n < 3).toUnordered().toArray();   // [1,2]
useOf(1, 2, 3, 4, 1).dropWhile(n => n < 3).toUnordered().toArray();   // [3,4,1]
```

---

<a id="7-collectables-and-terminal-operations"></a>
## 7. Коллектораблы и терминальные операции

### 7.1 Выбор коллекторабла

Коллекторабл владеет и **порядком**, и **учётом индексов**. `n` — это количество элементов.

| Коллекторабл | Структура | Время | Память | Порядок | Используйте когда |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | `Map<bigint, E>` keyed by index | O(n) | O(n) | порядок вставки | максимальная пропускная способность, порядок не важен; сырые индексы сохраняются нетронутыми |
| `toOrdered()` | array sorted by element index | O(n log n) | O(n) | по нормализованному индексу | обращение/ротация/перемешивание должны вступить в силу, либо нужен позиционный доступ |
| `toOrdered(comparator)` | sorted by your comparator, index rebuilt as position | O(n log n) | O(n) | по вашему компаратору | отсортированные представления, чтение вида min/max |
| `toNumericStatistics()` | value-sorted buffer | O(n log n) | O(n) | по значению | статистика по `number` |
| `toBigintStatistics()` | value-sorted buffer | O(n log n) | O(n) | по значению | статистика по `bigint` |
| `toWindow()` | value-sorted buffer | O(n log n) | O(n) | по значению | для `slide` / `tumble` |
| `toCollectable(mapper)` | whatever the mapper returns | — | — | — | пользовательские коллектораблы |

### 7.2 Терминальные операции

Стоимости указаны после материализации; `k` — целевая позиция, `n` — количество элементов.

| Терминал | Возвращает | Время | Память | Примечания |
| :--- | :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | O(n) | O(n) | Опустошает буфер |
| `toSet()` | `Set<E>` | O(n) в среднем | O(n) | Дедубликация по идентичности |
| `toMap(keyExtractor, valueExtractor?)` | `Map<K, V>` | O(n) в среднем | O(n) | Побеждает последняя запись |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | O(1) | Буфер уже знает |
| `forEach(action)` | `void` | O(n) | O(1) | `action(element, index)` |
| `join(…)` | `string` | O(n) | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `log()` / `error()` | `void` | O(n) | O(n) | Консольный вывод, обёрнутый в `[prefix … suffix]` |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | O(1) | Терминал, подобный IO |
| `collect(collector)`<br>`collect(identity, accumulator, finisher)` | `R` | O(n) | accumulator | Общее свёртывание, лежащее в основе каждого терминала выше |
| `reduce(accumulator)` | `Optional<E>` | O(n) | O(1) | Пустой поток → пустой Optional |
| `reduce(identity, accumulator)` | `E` | O(n) | O(1) | — |
| `reduce(identity, accumulator, finisher)` | `R` | O(n) | O(1) | — |
| `group(classifier)` | `Map<K, E[]>` | O(n) в среднем | O(n) | — |
| `groupBy(keyExtractor, valueExtractor)` | `Map<K, V[]>` | O(n) в среднем | O(n) | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | O(n) | Round-robin по индексу в `count` бакетов |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | O(n) | Номер бакета берётся из классификатора |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) в худшем, короткое замыкание | O(1) | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | O(1) | Позиционные в материализованном порядке |
| `findAt(k)` | `Optional<E>` | O(k), останавливается рано | O(1) | (k+1)-й элемент **в материализованном порядке** |
| `findNegativeAt(k)` | `Optional<E>` | O(n−k), останавливается рано | O(1) | Считает с конца материализованного порядка |
| `findMaximum(comparator?)` / `findMinimum(comparator?)` | `Optional<E>` | O(n) (O(1) на статистике) | O(1) | По умолчанию — структурное сравнение |
| `frequency()` | `Map<E, bigint>` | O(n) в среднем | O(n) | Только коллектораблы статистики |
| `[Symbol.iterator]()` / `[Symbol.asyncIterator]()` | iterator | O(n) | O(1) | `for…of` по коллектораблу |

### 7.3 Примеры

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
## 8. Статистика

`toNumericStatistics()` и `toBigintStatistics()` дают буфер, отсортированный по значению, плюс статистический API. Обе принимают маппер, поэтому можно вычислять по проецируемому значению: `.average(element => element.price)`.

| Метод | Значение | `number` | `bigint` |
| :--- | :--- | :--- | :--- |
| `summate()` | Σx | точно | точно |
| `average()` / `mean()` | Σx / n | точно | целочисленное деление |
| `median()` | среднее значение (среднее двух средних при чётном количестве) | точно | округлено |
| `mode()` | наиболее частое значение | точно | точно |
| `variance()` | генеральная дисперсия σ² | точно | округлено |
| `standardDeviation()` | √σ² | точно | округлено |
| `range()` | max − min | точно | точно |
| `quantile(q)` | квантиль ближайшего ранга, `0 ≤ q ≤ 1` | точно | точно |
| `interquartileRange()` | q(0.75) − q(0.25) | точно | точно |
| `skewness()` | Σ((x−μ)/σ)³ / n | точно | округлено |
| `kurtosis()` | Σ((x−μ)/σ)⁴ / n − 3 (excess) | точно | округлено |
| `frequency()` | значение → количество | `Map<E, bigint>` | `Map<E, bigint>` |

Все методы имеют сложность O(1) на отсортированном буфере (сортировка оплачена один раз при материализации), кроме `frequency()`, которая в среднем O(n) с памятью O(n).

Результаты `bigint` вычисляются в числах с плавающей точкой и округляются обратно до `bigint`, поскольку иначе целочисленное деление исказило бы их (дисперсия `[1n,2n,3n,4n]` равна `1.25`, а не `3`). Если нужна точная дробная статистика, проецируйте в `number` и используйте числовой коллектор.

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
## 9. Окна

`toWindow()` возвращает коллекторабл, чьи `slide` / `tumble` порождают семантику *семантик*.

```typescript
const windows = useOf(1, 2, 3, 4, 5).toWindow();

windows.tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2], [3,4], [5]]

windows.slide(3n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2,3], [2,3,4], [3,4,5], [4,5], [5]]   — trailing partial windows are included
```

`tumble(size)` в целом O(n); `slide(size, step)` — O(n × size), поскольку окна перекрываются.

Асинхронные источники работают так же; `slide` / `tumble` ожидают готовности нижележащего буфера:

```typescript
const asyncWindows = await useFrom(tick()).toWindow().tumble(2n).toUnordered().toArray();
for (const window of asyncWindows) {
  console.log(await window.toUnordered().toArray());
}
```

---

<a id="10-the-index-model"></a>
## 10. Модель индексов

Модель индексов состоит из двух частей: **конвейер** дёшево и лениво переписывает индексы; **коллекторабл** решает, что они означают. Это разделение намеренно, и именно в нём живут затраты на упорядочивание.

| Понятие | Поведение |
| :--- | :--- |
| Тип индекса | `bigint`, всегда доступен как второй аргумент каждого обратного вызова |
| Индексная арифметика конвейера | `reverse()` = `redirect(-i - 1n)`, `translate(o)` = `redirect(i + o)`, `shuffle()` = `redirect(random)` — все O(1) на элемент, все ленивые, ни один ничего не буферизует |
| `toUnordered()` — без учёта | Хранит каждый сырой индекс нетронутым в `Map`. Собранный неупорядоченно `translate(2)` всё ещё даёт индексы `2n,3n,4n,…`. Это производственный контракт: без сортировки, без нормализации, O(n) |
| `toOrdered()` — нормализация | Переписывает каждый индекс в `((i mod n) + n) mod n` (n = количество элементов), затем сортирует. Отрицательные или слишком большие индексы сворачиваются в `0..n−1`, поэтому `reverse`, `translate(7)` и `shuffle` все попадают в допустимую позицию |
| `toOrdered(comparator)` | Сортирует по значению и перестраивает индексы как позиции — это использует статистика |
| Ротация | Вытекает из нормализации: `translate(2)` даёт индексы `2,3,4,0,1`, которые сортируются в ротацию `[4,5,1,2,3]`. В операторе буферизации не происходит |
| Дублирующиеся индексы | Обнаруживаются `toUnordered()` и получают суррогатные ключи, поэтому **ни один элемент не удаляется незаметно**; `toOrdered()` сохраняет равные индексы в относительном порядке |
| `findAt(k)` / `findNegativeAt(k)` | Адресуют **материализованный порядок** — `findAt(1n)` — это всегда второй элемент того, что произвёл коллекторабл, `findNegativeAt(-1n)` — всегда последний, независимо от того, что `redirect` / `reverse` / `translate` сделали с сырыми индексами |
| `distinct` | Сохраняет первое вхождение **и его исходный индекс** |
| `sub` / `skip` / `limit` | Считают элементы, а не значения индексов |

Короче: **`OrderedCollectable` и его подклассы владеют учётом индексов** (нормализация по модулю n, сортировка, позиционная адресация), тогда как **`UnorderedCollectable` гарантирует производительность, никогда не трогая индексы**. Выбирайте для каждого запроса, а не для каждого конвейера.

---

<a id="11-the-asynchronous-model"></a>
## 11. Асинхронная модель

Источники, чьи данные ещё не могут существовать, возвращают `AsynchronousSemantic<E>`:

| Асинхронный источник | Почему |
| :--- | :--- |
| `usePromise` | значение приходит позже |
| `useBlob` | `Blob.stream()` асинхронен |
| `useInterval` | управляется `setInterval` |
| `useSubscription` | управляется внешними событиями |
| `useFrom` / `useIterate` с `AsyncIterable` | порождается `for await` |

Потребление единообразно — каждый терминал `AsynchronousCollectable` возвращает `Promise`, а семантика (модель индексов, нормализация, позиционный `findAt`) идентична синхронной стороне:

```typescript
const stats = await useFrom(asyncGenerator()).map(n => n * 2n).limit(10n).toBigintStatistics();
await stats.summate();

for await (const element of usePromise(Promise.resolve(1)).toUnordered()) {
  console.log(element);
}
```

Три вещи, от которых система типов вас не спасёт:

1. **Завершение потока.** Источник событий или таймеров никогда не завершается сам. Определите границу — `limit(n)`, `sub(start, end)` или `takeWhile(predicate)` — иначе подписка остаётся активной.
2. **Ожидание коллекторабла.** `toOrdered()`, статистика и `toWindow()` ожидают завершения источника перед ответом; источник только из промиса, который никогда не завершается, держит их в ожидании.
3. **Смешивание слоёв.** Синхронный коллекторабл не может потребить асинхронный источник. Как только задействована асинхронная фабрика, держите весь конвейер на асинхронной стороне и делайте `await` терминалов.

---

<a id="12-utility-helpers"></a>
## 12. Вспомогательные функции

| Помощник | Назначение | Время |
| :--- | :--- | :--- |
| `useCompare(a, b)` | Структурное сравнение, используемое каждой сортировкой/выборкой min/max по умолчанию (`number`, `bigint`, `string`, `boolean`, `symbol`, объекты через `Symbol.toPrimitive`) | O(1) для примитивов |
| `useRandom(start, end?)` | Случайные `number` / `bigint`, равномерно на полуоткрытом диапазоне | O(1) |
| `useHash(value, …)` | Стабильный 64-битный (приблизительно) `bigint`-хеш для любого значения (примитивы, объекты, циклы) | O(v) по посещённым значениям |
| `register(type, handler)` / `unregister(type)` / `maskOf(type)` | Расширяет хеш для пользовательских типов | O(1) |
| `useTraverse(object, callback)` | Глубокий обход с защитой от циклов; обратный вызов получает `(key, value, path)` | O(v + e) |
| `useStringify(object, callback?)` | Сериализация JSON, переживающая циклические ссылки | O(v + e) |
| `useToNumber(value)` / `useToBigInt(value)` | Тотальные преобразования (никогда не бросают исключений; возвращают `0` / `0n` для неприменимого ввода) | O(1) |
| `useGenerator(iterable)` / `useArrange(source, comparator?)` | «Сырой» генератор `(accept, interrupt)` и сортирующий генератор | O(n) / O(n log n) |
| `Optional<T>` | `of`, `ofNullable`, `ofNonNull`, `empty`; `map`, `flat`, `flatMap`, `filter`, `get`, `get(default)`, `ifPresent(action, elseAction)`, `orElse`, `isPresent`, `isEmpty`, `semantic()` | O(1) на метод |
| Стражи типов | `isNumber` (исключает `NaN` и `Infinity`), `isBigInt`, `isString`, `isBoolean`, `isSymbol`, `isFunction`, `isObject`, `isPrimitive`, `isIterable`, `isAsyncIterable`, `isPromise`, `isAsyncFunction`, `isGeneratorFunction`, `isAsyncGeneratorFunction`, `isOptional`, `isSynchronousSemantic` / `isAsynchronousSemantic`, `isSynchronousCollectable` (+ async), `isSynchronousOrderedCollectable`, `isSynchronousUnorderedCollectable`, `isSynchronousStatistics`, `isSynchronousNumericStatistics`, `isSynchronousBigIntStatistics`, `isSynchronousWindowCollectable`, `isSynchronousCollector` | O(1) |

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
## 13. Сравнение с другими библиотеками

| Аспект | Semantic-TypeScript | RxJS | Нативные итераторы |
| :--- | :--- | :--- | :--- |
| Модель | проталкивание с явным сигналом `interrupt` | проталкивание, объекты подписки | вытягивание |
| Позиция | интринсичный `bigint`-индекс у каждого элемента | составляемые операторы (`scan`, `withLatestFrom`) | ручной счётчик |
| Лень | операторы ленивы, коллектораблы явные | операторы ленивы, `subscribe` жаден | ленивые |
| Синхронность + асинхронность | один API, асинхронные фабрики помечены в типе | ориентированность на async | мост `for await` вручную |
| Терминальный API | богатый коллекторабл (`toArray`, `toMap`, `group`, `reduce`, `find*`, статистика) | только операторы | отсутствует |
| Статистика | встроена, для `number` и `bigint` | внешняя | отсутствует |
| Безопасность жизненного цикла | оператор границы отписывается | ручной `unsubscribe` / `takeUntil` | вручную |
| Экосистема / размер | маленькая, нулевые зависимости | большая экосистема операторов | ноль |

Выбирайте Semantic-TypeScript, когда нужна индекс-управляемая обработка данных с явной моделью стоимости и без планировщика. Выбирайте RxJS, когда нужна её экосистема операторов, семантика множественных наблюдателей и управление планировщиком.

---

<a id="14-performance-characteristics"></a>
## 14. Характеристики производительности

Стоимость запроса — это сумма трёх видимых частей: источник (§5), операторы (§6), коллекторабл (§7). Ничего скрытого никогда не выполняется дважды.

| Операция | Время | Память | Примечания |
| :--- | :--- | :--- | :--- |
| `map` / `filter` / `peek` | O(1) на элемент | O(1) | чистое преобразование |
| `limit` / `takeWhile` | O(1) на элемент | O(1) | немедленно останавливает вышестоящий |
| `reverse` / `translate` / `shuffle` | O(1) на элемент | O(1) | только индексная арифметика — без буферизации |
| `distinct` | O(1) в среднем на элемент | O(n) | `Set` ключей |
| `toUnordered()` | O(n) | O(n) | одна вставка `Map` на элемент; индексы нетронуты |
| `toOrdered()` | O(n log n) | O(n) | нормализация O(n) + сортировка O(n log n) |
| Статистика | O(n log n) один раз, затем O(1) на метод | O(n) | хранит отсортированный/агрегированный буфер |
| `findAt(k)` / `findNegativeAt(k)` | O(k) / O(n−k) | O(1) | раннее прерывание, как только позиция пройдена |
| `findMaximum` / `findMinimum` | O(n) в общем, O(1) на статистике | O(1) | один проход с текущим лучшим |

Правила большого пальца: держите конвейер ленивым, пока действительно не понадобится результат; предпочитайте `toUnordered()`, если порядок не важен; размещайте `limit` / `takeWhile` как можно раньше, насколько позволяет семантика; пусть *коллекторабл*, а не оператор, решает стоимость упорядочивания.

---

<a id="15-pitfalls-and-faq"></a>
## 15. Подводные камни и FAQ

**«Мой конвейер ничего не возвращает / зависает.»** Источник никогда не завершился. `useInterval`, `useSubscription`, `usePromise` и `useGenerate` нуждаются в границе (`limit`, `sub`, `takeWhile`) или завершающемся источнике.

**«`reverse()` ничего не сделал.»** Вы поглотили его через `toUnordered()`, который гарантирует отсутствие учёта индексов. Используйте `toOrdered()`.

**«`translate(2)` вернул элементы неповёрнутыми.»** По той же причине: `translate` лишь сдвигает индексы; ротация реализуется модульной нормализацией `toOrdered()`. Собранный неупорядоченно, сдвиг всё ещё виден в сырых индексах.

**«Почему отсутствует элемент?»** Вышестоящий породил дублирующиеся индексы, и вы потребляете через `toUnordered()`. Суррогатные ключи предотвращают потерю данных, но если нужно *увидеть* оба элемента по порядку, потребляйте через `toOrdered()`.

**«`findAt(1n)` возвращает неожиданное.»** `findAt` адресует **материализованный порядок**, а не сырой индекс. После `.reverse().toOrdered()` позиция 1 — это второй элемент обращённой последовательности. Если нужен элемент с сырым индексом `1n`, отфильтруйте по индексу явно.

**«Статистика `bigint` выглядит округлённой.»** Так и есть — результаты `bigint` целочисленно округляются по замыслу (см. [Статистика](#8-statistics)). Проецируйте в `number` для точных дробей.

**«Должен ли я вызывать `toXxx()` перед `toArray()`?»** Да. Терминальные операции живут на коллектораблах, а не на семантиках. Это сделано намеренно: это делает стоимость хранения и упорядочивания видимой в типе.

**«Происходит ли tree-shaking?»** Объявлено `sideEffects: false`, поэтому импортируйте только то, что используете. Учтите, что `useHash` регистрирует свои обработчики по умолчанию при загрузке модуля.

---

<a id="16-license"></a>
## 16. Лицензия

MIT © Eloy Kim

Полную историю выпусков см. в [CHANGELOG.md](./CHANGELOG.md).
