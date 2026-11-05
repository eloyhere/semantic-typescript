# **Semantic-TypeScript**

**Поток, проиндексированный.** Ваши данные под точным контролем.

[English](./readme.md) · [简体中文](./readme.cn.md) · [繁體中文](./readme.tw.md) · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · [Español](./readme.es.md) · Русский

Библиотека типобезопасной потоковой обработки, объединяющая **генераторы JavaScript**, **Java Stream** и
**адресацию данных по индексу**. Каждый элемент несёт `bigint`-индекс, каждый конвейер ленив, и
каждая терминальная операция — явный выбор.

```bash
npm install semantic-typescript
```

- Нулевые зависимости времени выполнения, чистый ESM, поставляется со своими типами.
- 622 регрессионных тестов: `npm test`.
- Полная история изменений: [CHANGELOG.md](./CHANGELOG.md).

---

## Оглавление

1. [Философия проектирования](#1-design-philosophy)
2. [Архитектура](#2-architecture)
3. [Быстрый старт](#3-quick-start)
4. [Фабричные функции](#4-factory-functions)
5. [Операторы преобразования](#5-transformation-operators)
6. [Коллектораблы и терминальные операции](#6-collectables-and-terminal-operations)
7. [Статистика и окна](#7-statistics-and-windows)
8. [Модель индексов](#8-the-index-model)
9. [Асинхронная модель](#9-the-asynchronous-model)
10. [Периодический анализ: кольца, поля и оценки](#10-periodic-analysis-rings-fields-and-scores)
11. [Вспомогательные функции](#11-utility-helpers)
12. [Производительность и подводные камни](#12-performance-and-pitfalls)
13. [Лицензия](#13-license)

---

<a id="1-design-philosophy"></a>
## 1. Философия проектирования

Три идеи, один конвейер:

**Индекс — это данные.** Каждый элемент адресуется через `bigint`. Обращение, ротация, перемешивание и
разбиение — это индексная арифметика, а не операции с буфером. Ничего не материализуется, пока этого не
потребует коллекторабл.

**Лень — значение по умолчанию.** Фабрика оборачивает генератор; оператор оборачивает другой генератор.
Ни один элемент не запрашивается, пока не выполнится терминальная операция, поэтому бесконечный источник
вполне допустим — лишь бы что-то ниже по потоку его остановило.

**Терминалы явны.** `map` возвращает `Semantic`, а не массив. Значения появляются только тогда, когда вы
называете коллекторабл — `toUnordered()`, `toOrdered()`, `toNumericStatistics()`, `toWindow()` — и каждый
из них сообщает, чего он стоит и какой порядок порождает.

Та же дисциплина действует и в математической половине библиотеки. `Complex`, `Angle` или
`Frequency` — это неизменяемое значение, инварианты которого проверяются при построении; `Optional`
заменяет `null`; а фазовое кольцо точно сообщает, сколько элементов оно содержит, какой у него период и
насколько оно сбалансировано.

---

<a id="2-architecture"></a>
## 2. Архитектура

```
factory  ──▶  Semantic  ──▶  Semantic  ──▶  Collectable  ──▶  result
 (source)      (map)         (filter)        (terminal)
                    ▲
                    └── every operator returns a new Semantic wrapping a generator
```

| Слой | Модуль | Ответственность |
| :--- | :--- | :--- |
| Источники | `synchronous/collectors`, `asynchronous/collectors` | Оборачивают итерируемое, генератор, промис, блоб, цель событий |
| Конвейеры | `synchronous/semantic`, `asynchronous/semantic` | Ленивые операторы и переписывание индексов |
| Коллектораблы | `synchronous/semantic`, `asynchronous/semantic` | Упорядоченные, неупорядоченные, статистические, оконные и пользовательские терминалы |
| Коллекторы | `synchronous/collector`, `asynchronous/collector` | Примитивы свёртывания, из которых построен каждый терминал |
| Математика | `mathematics/*` | Углы, комплексы, частоты, спектры, окна, оценки, эпициклы, фазовые кольца |
| Структуры | `structure/*` | Списки, множества, отображения, деревья, леса, кольца, поля |
| Ошибки | `structure/error` | Типизированная иерархия `SemanticError` и её брендовые стражи |

Синхронное и асинхронное семейства используют один словарь: те же имена операторов, та же семантика
индексов, те же коллектораблы. Асинхронные варианты просто возвращают промисы и ставят записи в очередь,
так что чтение, выданное после записи, всегда её наблюдает.

### 2.1 Что этот выпуск перенёс и что сломал

Три модуля сменили расположение или форму, и ряд значений по умолчанию изменил смысл. Каждое старое поведение по-прежнему достижимо через явную опцию; ничего не удалено без замены.

| Изменение | Раньше | Теперь |
| :--- | :--- | :--- |
| Леса | `structure/tree/rootedForest`, `structure/tree/unionFindForest` | `structure/forest/rootedForest`, `structure/forest/unionFindForest`; `tree/index.ts` больше их не реэкспортирует |
| Ошибки | разрозненные нативные ошибки | иерархия из пятнадцати классов в `structure/error.ts`, по одному брендовому стражу на класс и псевдоним `SemanticRangeError` |
| Опции оценок | фиксированные определения | `mathematics/quantile.ts` экспортирует `QuantileMethod`, `QuantileOptions`, `SkewnessEstimator`, `KurtosisEstimator` и `VarianceOptions` |
| `quantile` | Хайндман–Фан тип 1 | тип 7 — R `quantile`, NumPy `linear`, Excel `PERCENTILE.INC` |
| `skewness` / `kurtosis` | `g1` / `g2` | скорректированные на смещение `G1` / `G2` |
| `variance` / `standardDeviation` | `ddof = 0` | `ddof = 1`, обёрнутые в `Optional` |
| `decibel` | одна функция `20·log10` | удалена; `amplitudeDecibel` (20·log10) и `powerDecibel` (10·log10) |
| `Spectrum.flatness()` | амплитуды по обеим половинам | мощности по односторонней половине |
| `Spectrum.bandEnergy()` | сырая двусторонняя сумма | по умолчанию односторонняя, со свёрткой сопряжённой половины |
| `shortTimeFourierTransform` / `spectrogram` | симметричное окно Ханна, только полные кадры | периодическое окно Ханна, `boundary: "zeros"`, `padded: true` |

Главы 6, 7 и 10 описывают замены; измеренные последствия — в [CHANGELOG.md](./CHANGELOG.md).

---

<a id="3-quick-start"></a>
## 3. Быстрый старт

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
## 4. Фабричные функции

Построение всегда O(1) — фабрика лишь оборачивает генератор. Таблица указывает стоимость
*потребления* `n` элементов, а также дополнительную память, которая нужна самому источнику.

| Фабрика | Сигнатура (результат) | Время (потребление n) | Память (источник) | Примечания |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | Индексы 0..n−1; spread-аргумент уже материализован |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | Оборачивает любое итерируемое; итерируется один раз при сборе |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` исключается; `step` должен быть ненулевым; `number` и `bigint` оба работают |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | Поставщик вызывается один раз на элемент |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | Нейтральный элемент для `concat` |
| `useText` | `useText(text, delimiter?)` | O(n) | O(n) для текста | Итерирует **кодовые точки**, поэтому эмодзи и иероглифы CJK остаются единичными элементами |
| `useAttribute` | `useAttribute<T>(object)` | O(v + e) | O(d + v) | Рекурсивно обходит вложенные объекты с защитой от циклов |
| `useGenerate` | `useGenerate<E>(supplier, interrupt)` | O(n) × стоимость поставщика | O(1) | **Должен** иметь останавливающий `interrupt` или нижестоящий `limit` |
| `useIterate` | `useIterate<E>(Iterable<E>)` / `(AsyncIterable<E>)` | O(n) за сборку | O(1) | Воспроизводит итератор при каждой сборке |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period (реальное время) | O(1) | Порождает истекшее время |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | Один элемент с индексом `0n` |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(размер blob) | O(chunk) на копию | Размер чанка по умолчанию — 64 КиБ |
| `useSubscription` | `useSubscription(target, subscriber, event) → AsynchronousSemantic<Event>` | один элемент на событие | O(1) | `limit()` / `takeWhile()` определяют границу отписки |

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
## 5. Операторы преобразования

Каждый оператор возвращает новую `Semantic`; ни один не трогает элемент, пока не запустится коллекторабл.
Время — это дополнительная стоимость **на элемент**; память — то, что оператор удерживает, пока идёт конвейер.

| Оператор | Назначение | Эффект для индекса | Время | Память |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | 1:1 преобразование | передаётся | O(1) | O(1) |
| `filter(predicate)` | оставляет подходящие элементы | передаётся | O(1) | O(1) |
| `flat(mapper)` / `flatMap(mapper)` | 1:N развёртывание | переиндексация с 0 | O(1) на порождённый элемент | O(1) |
| `distinct(keyExtractor?)` | удаляет повторяющиеся ключи, оставляет первый | передаётся | O(1) в среднем | O(n) |
| `peek(consumer)` | побочный эффект, элемент проходит сквозь | передаётся | O(1) | O(1) |
| `limit(count)` | берёт первые *n* | переиндексация с 0 | O(1) | O(1) |
| `skip(count)` | пропускает первые *n* | передаётся | O(1) | O(1) |
| `sub(start, end)` | позиционный срез `[start, end)` | передаётся | O(1) | O(1) |
| `takeWhile(predicate)` | берёт, пока предикат истинен | передаётся | O(1) | O(1) |
| `dropWhile(predicate)` | пропускает, пока предикат истинен | переиндексация с 0 | O(1) | O(1) |
| `concat(other)` | добавляет семантику или итерируемое | продолжает индекс | O(1) | O(1) |
| `redirect(redirector)` | вычисляет новый индекс как угодно | **ваш** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | инвертирован и смещён | O(1) | O(1) |
| `translate(offset \| mapper)` | сдвигает каждый индекс | `i + offset` | O(1) | O(1) |
| `shuffle(mapper?)` | рандомизирует индекс | случайный | O(1) | O(1) |
| `pipe(conversion)` | передаёт генератор пользовательской функции | на ваше усмотрение | ваш | ваш |
| `semantic()` | поднимает коллекторабл обратно в семантику | неизменён | O(1) | O(1) |

**`reverse`, `translate` и `shuffle` только переписывают индексы.** Ничего не буферизуется и не вращается, пока
`toOrdered()` не нормализует индексы по модулю количества элементов:

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

---

<a id="6-collectables-and-terminal-operations"></a>
## 6. Коллектораблы и терминальные операции

### 6.1 Коллектораблы

Коллекторабл владеет и **порядком**, и **учётом индексов**. `n` — это количество элементов.

| Коллекторабл | Структура | Время | Порядок | Используйте когда |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | `Map<bigint, E>` с индексом в качестве ключа | O(n) | порядок вставки | максимальная пропускная способность; сырые индексы сохраняются нетронутыми |
| `toOrdered()` | массив, отсортированный по индексу элемента | O(n log n) | по нормализованному индексу | обращение или ротация должны вступить в силу |
| `toOrdered(comparator)` | сортировка по вашему компаратору | O(n log n) | по вашему компаратору | отсортированные представления |
| `toNumericStatistics()` | буфер, отсортированный по значению | O(n log n) | по значению | статистика по `number` |
| `toBigintStatistics()` | буфер, отсортированный по значению | O(n log n) | по значению | статистика по `bigint` |
| `toWindow()` | буфер, отсортированный по значению | O(n log n) | по значению | для `slide` / `tumble` |
| `toCollectable(mapper)` | то, что вернёт маппер | — | — | пользовательские коллектораблы |

### 6.2 Терминалы

Каждый терминал живёт на **коллекторабле**, а не на `Semantic`. Именно это и означает «терминалы явные» на практике: конвейер ничего не производит, пока не назван коллекторабл, а `toCollectable()` без маппера — самый дешёвый способ его назвать.

| Терминал | Возвращает | Время | Примечания |
| :--- | :--- | :--- | :--- |
| `toArray()` / `toSet()` | `Array<E>` / `Set<E>` | O(n) | Опустошает буфер; `toSet` дедуплицирует по идентичности |
| `toMap(key, value?)` | `Map<K, V>` | O(n) в среднем | Побеждает последняя запись |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | Буфер уже знает |
| `forEach(action)` | `void` | O(n) | `action(element, index)` |
| `join(…)` | `string` | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `reduce(…)` | `Optional<E>` / `E` / `R` | O(n) | Пустой поток → пустой `Optional` |
| `group(classifier)` / `groupBy(key, value)` | `Map<K, E[]>` | O(n) в среднем | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | Round-robin по индексу |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | Номер бакета берётся из классификатора |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) в худшем, короткое замыкание | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | Позиционные в материализованном порядке |
| `findAt(k)` / `findNegativeAt(k)` | `Optional<E>` | O(k) / O(n−k) | Считает с начала / с конца |
| `findMaximum(cmp?)` / `findMinimum(cmp?)` | `Optional<E>` | O(n) | По умолчанию — структурное сравнение |
| `frequency()` | `Map<E, bigint>` | O(n) в среднем | Только коллектораблы статистики |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | Терминал, подобный IO |
| `collect(collector)` | `R` | O(n) | Общее свёртывание, лежащее в основе каждого терминала выше |

### 6.3 Структурные коллекторы

`toArray`, `toSet` и `toMap` завершают конвейер контейнером JavaScript. Ещё двенадцать терминалов завершают его одной из собственных структур библиотеки, так что результат несёт инварианты, которые гарантирует эта структура, а не те, что случайно есть у массива. Они доступны на каждом коллекторабле, включая голый коллекторабл из `toCollectable()`.

| Терминал | Возвращает | Порядок | Стоимость |
| :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | порядок обхода | O(n) |
| `toSet()` | `Set<E>` | порядок вставки, SameValueZero | O(n) в среднем |
| `toMap(key, value?)` | `Map<K, V>` | порядок вставки; побеждает последняя запись | O(n) в среднем |
| `toOrderedSet(comparator?)` | `SynchronousOrderedSet<E>` | по возрастанию компаратора | O(n²) в худшем случае |
| `toUnorderedSet()` | `SynchronousUnorderedSet<E>` | не определён (хеш-бакеты) | O(n) ожидаемо |
| `toOrderedMap(key, value?)` | `SynchronousOrderedMap<K, V>` | порядок вставки; побеждает последняя запись | O(n) ожидаемо |
| `toUnorderedMap(key, value?)` | `SynchronousUnorderedMap<K, V>` | не определён | O(n) ожидаемо |
| `toList()` | `SynchronousList<E>` | порядок обхода, дубликаты сохраняются | O(n) |
| `toCycle(span?)` | `SynchronousCycle<E>` | порядок обхода задаёт позиции на кольце | O(n) |
| `toLRUSet(capacity)` | `SynchronousUnorderedLRUSet<E>` | по давности; выживают только последние `capacity` | O(n²) в худшем случае |
| `toLRUMap(capacity, key, value?)` | `SynchronousUnorderedLRUMap<K, V>` | по давности | O(n) ожидаемо |
| `toSkipSet(comparator?)` | `SynchronousSkipSet<E>` | по возрастанию компаратора, с навигацией | O(n²) в худшем случае |
| `toSkipMap(key, value?)` | `SynchronousSkipMap<K, V>` | по компаратору ключей, с навигацией | O(n) ожидаемо |
| `toBinarySearchTree(comparator?)` | `SynchronousBinarySearchTree<E>` | по возрастанию компаратора, сбалансировано по высоте | O(n log n) |
| `toRootedForest()` | `SynchronousRootedForest<E>` | порядок обхода становится структурой | O(n) |

Тип результата следует за типом элемента самого коллекторабла, поэтому ни один терминал не принимает аргумент типа: `SynchronousCollectable<E>` сразу отдаёт `Array<E>`, `SynchronousList<E>` или `SynchronousOrderedSet<E>`. Остаются только деловые аргументы — компаратор `toOrderedSet` / `toSkipSet` / `toBinarySearchTree`, ёмкость пары LRU, диапазон `toCycle` и извлекатели ключа и значения семейства отображений.

Кольцо — это множество, поэтому повторяющиеся элементы сохраняют первую позицию; все остальные структуры выше сохраняют дубликаты, если их собственный контракт не говорит иного (`toOrderedSet`, `toUnorderedSet` и `toSkipSet` — множества; `toBinarySearchTree` и `toList` — нет).

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

Асинхронные коллектораблы предоставляют те же терминалы и разрешают каждый в promise, поэтому форма вызова приобретает только `await`.

---

<a id="7-statistics-and-windows"></a>
## 7. Статистика и окна

### 7.1 Поверхность статистики

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();                    // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();                    // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();                     // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                       // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance().get();             // 3.2    (n − 1)
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation().get();    // 1.7889 (n − 1)
```

Оба статистических семейства предоставляют одну и ту же поверхность — `summate`, `average`, `median`, `mode`, `variance`, `standardDeviation`, `frequency`, `findMaximum`, `findMinimum` — с `bigint`-арифметикой для `toBigintStatistics()`. Меры разброса и семейство квантилей возвращают `Optional`, потому что выборка может оказаться слишком мала для их определения; извлекайте их через `.get()`, `.orElse(…)` или `.isPresent()`.

### 7.2 Оценки и значения по умолчанию

Значения по умолчанию — это определения, которые используют R, NumPy, pandas и Excel, поэтому вычисленное здесь значение можно сравнивать с этими инструментами без поправочного коэффициента.

| Статистика | По умолчанию | Раньше | Вернуть старое значение через |
| :--- | :--- | :--- | :--- |
| `quantile(probability)` | Хайндман–Фан тип 7 | тип 1 | `{ method: "type-1" }` |
| `interquartileRange()` | Хайндман–Фан тип 7 | тип 1 | `{ method: "type-1" }` |
| `skewness()` | скорректированный `G1` | `g1` | `{ estimator: "g1" }` |
| `kurtosis()` | скорректированный избыточный `G2` | `g2` | `{ estimator: "g2" }` |
| `variance()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |
| `standardDeviation()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |

Все девять типов Хайндмана–Фана доступны как `"type-1"` … `"type-9"`, а `{ excess: false }` возвращает тройку к эксцессу и сообщает неизбыточный четвёртый стандартизованный момент. Типы опций — `QuantileMethod`, `QuantileOptions`, `SkewnessEstimator`, `KurtosisEstimator`, `VarianceOptions` — экспортируются из `mathematics/quantile.ts`.

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

`G1` и `G2` не определены при менее чем трёх и четырёх наблюдениях, а выборочные дисперсия и стандартное отклонение — при менее чем двух при `ddof = 1`. Это сообщается пустым `Optional`, а не вводящим в заблуждение нулём:

```typescript
useOf(1, 2, 3).toNumericStatistics().kurtosis().isEmpty();     // true  (G2 needs four observations)
useOf(1, 2).toNumericStatistics().skewness().isEmpty();        // true  (G1 needs three)
useOf(1).toNumericStatistics().variance().isEmpty();           // true  (ddof = 1 needs two)
useOf(1).toNumericStatistics().variance({ ddof: 0 }).get();    // 0
```

Представления bigint принимают те же опции и округляют каждый результат до целого `bigint`.

### 7.3 Окна

Окна заново выставляют буферизованные элементы как конвейер конвейеров, поэтому окно можно потребить, не материализуя его сначала в массив. Обе формы включают последнее частичное окно.

```typescript
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[2,3],[3,4],[4]]

useFrom([1, 2, 3, 4]).toWindow().tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[3,4]]
```

---

<a id="8-the-index-model"></a>
## 8. Модель индексов

Индекс — это `bigint`, прикреплённый к каждому элементу. Операторы либо **передают** его, либо
**переиндексируют** с нуля, либо позволяют вам его **вычислить**.

Упорядоченный сбор нормализует каждый индекс по модулю количества элементов, а затем сортирует по результату.
Именно поэтому `translate(7)` на пяти элементах эквивалентен `translate(2)`: `7 ≡ 2 (mod 5)`.

Неупорядоченный сбор сохраняет тот индекс, который произвёл конвейер, и возвращает элементы в порядке
прибытия. Отрицательные индексы допустимы и после нормализации просто сортируются раньше неотрицательных.

---

<a id="9-the-asynchronous-model"></a>
## 9. Асинхронная модель

`AsynchronousSemantic` повторяет синхронную поверхность, возвращая промисы. Записи ставятся в очередь,
поэтому чтение, выданное после записи, всегда её наблюдает.

```typescript
const cycle = new AsynchronousCycle([1, 2]);
const added   = cycle.add(3);          // queued
const sampled = cycle.elementAt(2n);   // observes the write above
await added;
(await sampled).get().element;         // 3
```

Фабрики, асинхронные по своей природе, — `usePromise`, `useBlob`, `useInterval`,
`useSubscription` — возвращают `AsynchronousSemantic` напрямую, а `useFrom` / `useIterate`
переходят в асинхронный режим, когда им передают `AsyncIterable`.

---

<a id="10-periodic-analysis-rings-fields-and-scores"></a>
## 10. Периодический анализ: кольца, поля и оценки

Математическая половина библиотеки трактует цикл как полноценный объект, а не как таблицу
поиска. Три конструкции работают вместе.

### 10.1 Кольцо — это одно целое число

`Cycle` — это **n-кратное кольцо**: количество элементов, позиционный период и число различных
фаз — одно и то же целое `n`. Фаза позиции вычисляется из её точного остатка, поэтому
кольцо периодично до бита:

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

`frequency` — это **окружающая** (ambient) скорость вращения, а не шаг фазы между позициями: среда
сдвигает каждый фазор (phasor) на один и тот же угол, поэтому она никогда не может нарушить внутренний
узор. `span` задаёт, сколько оборотов занимает кольцо.

`purity()` — это доля энергии, переносимая основной модой,
`max(|c₁|², |c_{n−1}|²) / (n · Σ|z|²)`. Она равна `1` ровно тогда, когда кольцо с точностью до
поворота совпадает с корнями `n`-й степени из единицы, и стоит `O(n)`, потому что нужны всего два бина.
Проверяются оба направления, поскольку кольцо может обходить окружность в любую сторону.

### 10.2 Поле — это ограниченная оценка

`PhaseField` отображает относительную фазу в оценку из `[-1, 1]`:

```typescript
import { useField, useRadian } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ): +1 aligned, −1 opposed
const mixed  = useField([0.4, 0.3, 0.3]);  // first three harmonics

cosine.sample(useRadian(0));               //  1
cosine.sample(useRadian(Math.PI));         // -1
```

Оценка — это усечённый ряд косинусов, `a₀ + Σ wₘ·cos(2πmΔ)`, и конструктор обеспечивает
`|a₀| + Σ|wₘ| ≤ 1`. По неравенству треугольника оценка никогда не покидает `[-1, 1]` — граница является
**следствием конструкции**, а не ограничением, наложенным после.

Причина, по которой поле является рядом, а не таблицей: таблица из `n` точек точно воспроизводит свои
собственные отсчёты, но её тригонометрический интерполянт даёт выбросы между ними. Таблица из пяти
точек со значениями `[+1, +0.5, −1, −0.5, 0]` интерполируется в диапазон `[−1.0428, 1.0041]`, что уже
нарушает обещание. Ограниченный ряд не может.

### 10.3 Анализ измеряет данные относительно каждого элемента

Каждый элемент кольца — это опорная фаза. `analyse` отыскивает каждое наблюдение на кольце и
измеряет его относительно каждой опоры:

```typescript
const ring = new SynchronousCycle(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                              // 5
report.missed;                               // 1  ('zz' is not on the ring)
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

Каждая строка опоры сообщает `count`, среднюю относительную фазу `mean` и среднюю результирующую длину
`resultant`. Одно тождество стоит запомнить: **`resultant` одинаков для каждой опоры**,
потому что смена базовой линии лишь поворачивает все относительные фазы на константу. От опоры к опоре
различаются только счётчик и среднее.

```typescript
const cycle = new SynchronousCycle(["a", "b", "c"]);
cycle.scoresAt(0, cosine);                   // one score per position, in [-1, 1]
```

### 10.4 Связанные инструменты

| Вызов | Отвечает | Стоимость |
| :--- | :--- | :--- |
| `purity()` | остаётся ли кольцо корнями `n`-й степени из единицы? | O(n) |
| `resultant(t?)` | насколько фазоры сконцентрированы прямо сейчас? | O(n) |
| `analyse(data)` | как эти данные соотносятся с каждым элементом? | O(n · m) |
| `toSpectrum()` | кольцо как спектр, волновое число на оси частот | O(n²) |
| `useAngularSpectrum(cycle, instants, plan)` | плоскость `(ω, n)` во времени | O(n² · frames) |

Модель дополняют ещё два примитива: `combineCycles(a, b)` соединяет два кольца по их наименьшему общему
кратному (обратный образ, pullback, а не произведение — пары, которые не могут разделить момент,
просто отсутствуют), а `rate()` даёт каждому элементу свою внутреннюю частоту, чтобы кольцо могло
дрейфовать относительно среды. `jetAt`, `windingAt` и `errorIntegralAt` показывают дифференциальное состояние дрейфа.

### 10.5 Спектральные окна

Построения колец — одна половина аналитической поверхности; другая работает с дискретизированными сигналами. Её самый переиспользуемый примитив — окно, и у каждой формы здесь две версии. Симметричная версия делит кадр на `count − 1`; периодическая (DFT-чётная) делит его на `count`, на один отсчёт меньше полного периода, поэтому спад непрерывен при периодическом продолжении, которое предполагает DFT.

```typescript
useHannWindow(1, 4);                                   // 0.75  symmetric
useHannPeriodicWindow(1, 4);                           // 0.5   periodic
coherentGain(useHannPeriodicWindow, 16);               // 0.5
equivalentNoiseBandwidth(useHannPeriodicWindow, 16);   // 1.5
```

| Форма | Симметричная | Периодическая | Примечания |
| :--- | :--- | :--- | :--- |
| Прямоугольная | `useRectangularWindow` | — | без спада; нет периодического различия |
| Ханна | `useHannWindow` | `useHannPeriodicWindow` | вариант по умолчанию для коротковременного преобразования |
| Хэмминга | `useHammingWindow` | `useHammingPeriodicWindow` | — |
| Блэкмана | `useBlackmanWindow` | `useBlackmanPeriodicWindow` | — |
| Наттолла | `useNuttallWindow` | `useNuttallPeriodicWindow` | четырёхчленный Блэкман–Харрис |
| Плосковершинная | `useFlatTopWindow` | `useFlatTopPeriodicWindow` | точность амплитуды важнее разрешения |
| Кайзера | `useKaiserWindow(beta)` | `useKaiserPeriodicWindow(beta)` | `beta` задаёт ширину главного лепестка |

Используйте периодическую версию для анализа и overlap-add: при полукадровом шаге периодическое окно Ханна суммируется в `1.000000` при любой длине, тогда как симметричное колеблется на `0.841 dB` при `N = 16` и ещё на `0.013 dB` при `N = 1024`. Симметричную версию оставьте для проектирования фильтров, где кадр не является одним периодом спада.

Плосковершинные окна возвращают **отрицательные веса** у краёв кадра, потому что плосковершинное окно именно таково. Они возвращаются без обрезки, поскольку обрезка искажает главный лепесток и уничтожает малые потери на «гребешке», ради которых окно и существует:

```typescript
useFlatTopWindow(0, 1024);                             // -0.000421 — negative by definition
Array.from({ length: 1024 }, (_unused, index) => useFlatTopWindow(index, 1024))
  .filter(weight => weight < 0).length;                // 578
```

### 10.6 Уровни, плоскостность и энергия полосы

`decibel` исчез как единая функция, потому что амплитуда и мощность не делят один множитель. `amplitudeDecibel` применяет `20·log10` к отношению типа напряжения; `powerDecibel` применяет `10·log10` к мощности, энергии, среднему квадрату или спектральной плотности мощности:

```typescript
amplitudeDecibel(0.25);                                // -12.0412
powerDecibel(0.25);                                    //  -6.0206
```

`Bin.decibel` и `Spectrum.decibelOf` — уровни амплитуды; `Spectrum.powerDecibelOf` — соответствующий уровень мощности. Подача мощности в амплитудную форму сообщает `20·log10(power)` и удваивает уровень в децибелах.

Два измерения спектра изменили чтение:

```typescript
const twoBins = new Spectrum(new Sample(2, 1), [new Complex(2, 0), new Complex(1, 0)]);
twoBins.flatness();                                    // 0.8 — geometric over arithmetic mean of power

const shape = new Spectrum(new Sample(4, 1), [
  new Complex(1, 0), new Complex(2, 0), new Complex(0, 0), new Complex(0, 0),
]);
shape.bandEnergy(new Frequency(0), new Frequency(2));                // 9
shape.bandEnergy(new Frequency(0), new Frequency(2), "two-sided");   // 5
```

`flatness()` сравнивает геометрическое и арифметическое средние `power()` по односторонней половине спектра, а не среднее амплитуд по обеим половинам, и чисто визуальное удвоение амплитуды из `oneSided()` намеренно не применяется. `bandEnergy()` по умолчанию использует одностороннее чтение, свёртывая сопряжённую половину: DC и Найквист считаются один раз, а каждый внутренний бин — дважды; полоса, покрывающая всю ось, тогда удовлетворяет равенству Парсеваля, `Σ|X|² = N·Σx²`. Передайте `"two-sided"` для комплексного спектра, чьи бины уже независимы.

### 10.7 Коротковременный анализ

`Sampler.shortTimeFourierTransform` и `Sampler.spectrogram` следуют соглашениям `stft` из SciPy: периодическое окно Ханна, граница, заполненная нулями с обоих концов, и хвост, заполненный нулями.

```typescript
const sampler = new Sampler(new Sample(64, 1));
const spectrogram = sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8);

spectrogram.size();                     // 9 frames
spectrogram.getBoundary();              // "zeros"
spectrogram.getTime(6);                 // 0.75 — frame centres, not frame starts
sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8, useHannWindow,
  { boundary: "none", padded: false }).size();                       // 7 — complete frames only
```

Расширение центрирует первый кадр на первом отсчёте, а заполнение хвоста делает последние отсчёты достижимыми: 64 отсчёта при кадре 16 и шаге 8 дают 9 кадров вместо 7, а 1000 отсчётов при кадре 256 и шаге 128 дают 9 вместо 6. Время кадра — это центр, а не начало: `(k·hop + (frameSize mod 2)/2)/rate` для расширенного представления и `(k·hop + frameSize/2)/rate` для нерасширенного, а `toFrame()` срезает расширение перед обратным преобразованием.

---

<a id="11-utility-helpers"></a>
## 11. Вспомогательные функции

### 11.1 Иерархия ошибок

`structure/error.ts` экспортирует иерархию из пятнадцати классов для ошибок, возбуждаемых *вокруг* конвейера — вашим собственным кодом, собственным коллектором или адаптером:

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

Каждый класс фиксирует `name`, пересылает нативную `cause`, несёт необязательный мешок `context` и сериализуется через `toJSON()`; у каждого есть одноимённый брендовый страж.

```typescript
const error = new CapacityError("LRU capacity exhausted", { context: { capacity: 0 } });

error.name;                 // "CapacityError"
isCapacityError(error);     // true
isValidationError(error);   // false — a capacity failure is not a validation failure
isSemanticError(error);     // true
error.toJSON();             // { name: "CapacityError", message: "…", context: { capacity: 0 } }
```

`SemanticRangeError` — тот же класс, что и экспортируемый `RangeError`, поэтому `instanceof` выполняется для обоих имён; импорт `RangeError` затеняет глобальный конструктор во всём модуле, и именно поэтому существует псевдоним. Ни один из этих классов не возбуждается собственными проверками аргументов библиотеки — там по-прежнему возбуждаются нативные `TypeError` и `RangeError`; иерархия — это словарь для слоя выше.

### 11.2 Таблица помощников

| Помощник | Назначение |
| :--- | :--- |
| `useCompare(a, b)` | Тотальное упорядочение для смешанных примитивов |
| `useToNumber` / `useToBigInt` | Преобразование чисел без потерь с проверкой диапазона |
| `useRandom` | Случайные помощники с начальным значением или без него |
| `useTraverse` | Структурный обход вложенных объектов и массивов |
| `useStringify` | Сериализация JSON, переживающая циклические ссылки |
| `useHash` / `maskOf` / `register` / `unregister` | Структурное хеширование и реестр стратегий хеша |
| `invalidate` / `validate` | Стражные проверки, порождающие ошибку единой формы |
| `Optional<T>` | Замена `null` в библиотеке: `Optional.of(x)` / `Optional.empty()` |

### 11.3 `useTraverse`

`useTraverse(target, callback)` разворачивает любой объект в последовательность его **непустых листьев**. Он спускается во вложенные объекты, обходит итерируемые значения по позициям, пропускает `null` и `undefined` и никогда не входит повторно в уже посещённый объект — поэтому граф объектов с циклом завершается, а не переполняет стек.

```typescript
const source = { id: 7, tags: ["a", "b"], owner: { name: "Ada", note: null } };
const leaves: string[] = [];

useTraverse(source, (key, value, path) => {
  leaves.push(`${path.join(".")} = ${String(value)}`);
  return true;
});

leaves;   // ["id = 7", "tags.0 = a", "tags.1 = b", "owner.name = Ada"]
```

Обратный вызов выполняется один раз на лист и получает собственный ключ листа (его индекс, если лист пришёл из итерируемого значения), значение и путь к нему. Возврат `false` прекращает **весь** обход, а не только текущую ветвь:

```typescript
let visited = 0;
useTraverse({ a: 1, b: 2, c: 3 }, () => {
  visited += 1;
  return false;
});
visited;   // 1 — the first leaf already stops the walk
```

Цикл безопасен по той же причине:

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

**Каждый обратный вызов получает собственный снимок пути.** Обход держит внутри единственный рабочий массив и в момент передачи листа копирует его в новый массив, замороженный через `Object.freeze`. Снимок после этого не меняется, поэтому его можно сохранять как есть; два обратных вызова никогда не делят один массив, а повторный обход не задевает уже выданные снимки. Его тип — `ReadonlyArray`, поэтому запись в него будет ошибкой компиляции, а у замороженного массива она вдобавок бросит `TypeError` во время выполнения. Такая надёжность стоит одной аллокации `O(depth)` на каждый сообщённый лист; ветвь, не сообщающая ничего, лишнего не выделяет.

```typescript
const paths: Array<ReadonlyArray<PropertyKey>> = [];
useTraverse({ a: { b: 1 }, c: 2 }, (_key, _value, path) => {
  paths.push(path);                      // safe to keep as-is
  return true;
});
paths[0] === paths[1];                   // false — one array per call
paths.map(path => path.join("."));       // ["a.b", "c"]
```

`useAttribute` — это тот же обход в виде фабрики: она сообщает те же листья парами `{ key, value }`, поэтому правила и стоимость совпадают.

```typescript
useAttribute({ a: 1, b: { c: 2 } }).toUnordered().toArray();
// [{ key: "a", value: 1 }, { key: "c", value: 2 }]
```

---

<a id="12-performance-and-pitfalls"></a>
## 12. Производительность и подводные камни

**У лени есть цена на каждой ступени.** Каждый оператор добавляет переход через генератор. Для плотных
числовых циклов по массивам в памяти обычный цикл `for` побьёт любой конвейер; конвейер выигрывает, когда
источник ленив, бесконечен или конвейер достаточно длинен, чтобы дисциплина индексов окупилась.

**`toOrdered()` сортирует; `toUnordered()` — нет.** Если кажется, что обращение «не сработало», коллектор был
неупорядоченным — переписывание индексов становится порядком только тогда, когда индексы нормализованы.

**`useGenerate` без `interrupt` никогда не завершается.** Всегда передавайте останавливающий предикат или
нижестоящий `limit` / `takeWhile`.

**`Cycle` — это множество с порядком вставки.** Элементы уникальны и сохраняют порядок, в котором были
впервые добавлены. Повторный `add` возвращает `false`, а `set`, который ввёл бы дубликат, бросает
исключение. Именно это позволяет фазе быть функцией *элемента*, а не той позиции, которую ему случилось
занимать.

**`Spectrum` предполагает вещественный сигнал в своих односторонних помощниках.** `oneSided()`, `getNyquist()` и
`centroid()` предполагают сопряжённую симметрию. Пространственный спектр фазового кольца комплексен и в
общем случае не симметричен — кольцо, которое обходит окружность в обратную сторону, помещает всю свою
энергию в бин `n − 1`, за пределы Найквиста. Читайте бины напрямую.

**Структурные коллекторы — это терминалы, а не представления.** Каждый опустошает конвейер, а затем строит полную структуру, поэтому стоит O(n) времени и O(n) памяти и не может работать на бесконечном источнике. Используйте его в конце конвейера и никогда внутри цикла по конвейеру.

**`variance()` и его собратья возвращают `Optional`.** `variance().get()` на слишком малой выборке бросает исключение; используйте `.orElse(0)` или проверяйте `.isPresent()`, когда размер выборки не в вашей власти. То же относится к `standardDeviation`, `quantile`, `interquartileRange`, `skewness` и `kurtosis`.

**Периодические окна — это окна анализа.** `useHannWindow` и другие симметричные формы предназначены для проектирования фильтров; коротковременному преобразованию нужны `useHannPeriodicWindow` и его родня, иначе сумма overlap-add будет колебаться на каждом стыке кадров.

---

<a id="13-license"></a>
## 13. Лицензия

MIT © Eloy Kim
