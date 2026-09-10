# **Semantic-TypeScript**

**Datenfluss, indexiert.** Ihre Daten, präzise unter Kontrolle.

[English](./readme.md) · [简体中文](./readme.cn.md) · [繁體中文](./readme.tw.md) · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · Deutsch · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

Eine typsichere Stream-Verarbeitungsbibliothek, die **JavaScript-Generatoren**, **Java Stream** und **indexbasierte Datenadressierung** vereint. Jedes Element trägt einen `bigint`-Index, jede Pipeline ist träge, und jede Terminaloperation muss explizit aktiviert werden.

```bash
npm install semantic-typescript
```

- Keine Laufzeitabhängigkeiten, reines ESM, liefert eigene Typen mit.
- 55 Regressionstests: `npm install && npm test`.
- Vollständige Änderungshistorie: [CHANGELOG.md](./CHANGELOG.md).

---

## Table of Contents

1. [Entwurfsphilosophie](#1-design-philosophy)
2. [Architektur](#2-architecture)
3. [Datenfluss: Von der Quelle zum Ergebnis](#3-data-flow-from-source-to-result)
4. [Schnellstart](#4-quick-start)
5. [Fabrikfunktionen](#5-factory-functions)
6. [Transformationsoperatoren](#6-transformation-operators)
7. [Collectables und Terminaloperationen](#7-collectables-and-terminal-operations)
8. [Statistik](#8-statistics)
9. [Fenster](#9-windows)
10. [Das Indexmodell](#10-the-index-model)
11. [Das asynchrone Modell](#11-the-asynchronous-model)
12. [Hilfsfunktionen](#12-utility-helpers)
13. [Vergleich mit anderen Bibliotheken](#13-comparison-with-other-libraries)
14. [Leistungsmerkmale](#14-performance-characteristics)
15. [Fallstricke und FAQ](#15-pitfalls-and-faq)
16. [Lizenz](#16-license)

---

<a id="1-design-philosophy"></a>
## 1. Entwurfsphilosophie

**1. Index zuerst.** In den meisten Stream-Bibliotheken ist eine Position etwas, das man *rekonstruiert* — ein Zähler, den man in `scan` mitführt, oder ein Index-Argument, das man manuell durchreicht. Hier ist die Position *intrinsisch*: Das Generatorprotokoll übergibt jedem Element einen `bigint`-Index, weshalb `distinct`, `skip`, `sub`, `reverse`, `translate` und `shuffle` allesamt als Index-Arithmetik statt als ad-hoc-Zustand ausgedrückt werden. Den Index eines Elements zu ändern *bedeutet* Neuanordnung; Neuindizierung *bedeutet* Filterung.

**2. Push mit explizitem Stoppsignal.** Eine Quelle ist eine Funktion `(accept, interrupt) => void | Promise<void>`. Sie übergibt Elemente mit `accept(element, index)` und fragt `interrupt(element, index)`, ob sie anhalten soll. Es gibt keinen verborgenen Scheduler, kein Abonnement-Objekt, keine Teardown-Phase, an die man sich erinnern müsste — Backpressure und Beendigung sind Teil des Protokolls, und unendliche Streams werden zu gewöhnlichen (nicht besonderen) Fällen.

**3. Trägheit ist die Vorgabe; Materialisierung ist eine Entscheidung.** Operatoren umschließen lediglich Generatoren. Es läuft nichts, bis ein **Collectable** die Pipeline verbraucht, und der gewählte Collector entscheidet über die Kosten: `toUnordered()` ist O(n) und greift niemals Ihre Indizes an, `toOrdered()` ist O(n log n) und normalisiert sie. Da die Entscheidung im zurückgegebenen Typ explizit ist, wissen Sie stets, ob für Reihenfolge und Speicher bezahlt wird.

**4. Redirect ist der einzige Reihenfolge-Mechanismus.** `reverse()`, `translate()` und `shuffle()` sind nichts weiter als vorgepackte `redirect()`-Strategien — jede schreibt den Index eines Elements um und sonst nichts. Daher benötigen sie alle **`toOrdered()`**, um wirksam zu werden: Die Pipeline schreibt nur Indizes um, und der geordnete Collector entscheidet, was diese Indizes bedeuten.

**5. Sync und Async sind eine API.** Dieselben Operatoren existieren für endliche In-Memory-Daten sowie für Promises, asynchrone Iterables, Timer, Blobs und Ereignisabonnements. Quellen, die nicht synchron sein können, geben dies in ihrem Rückgabetyp an (`AsynchronousSemantic`), sodass „Habe ich hier awaited?" keine Laufzeitüberraschung mehr ist.

---

<a id="2-architecture"></a>
## 2. Architektur

Drei Schichten, eine Richtung. Daten fließen nach unten; der Typ, den Sie halten, sagt Ihnen, was Sie als Nächstes tun dürfen.

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

| Schicht | Typ | Verantwortung | Erhalten über |
| :--- | :--- | :--- | :--- |
| Quelle / Pipeline | `SynchronousSemantic<E>`<br>`AsynchronousSemantic<E>` | Die träge Pipeline aufbauen: transformieren, neu indizieren, aufteilen, zusammenführen. Es wird noch kein Element berührt. | Fabriken sowie jeder Operator auf einem Semantic |
| Speicher / Sicht | `SynchronousUnorderedCollectable<E>`<br>`SynchronousOrderedCollectable<E>`<br>`SynchronousNumericStatistics<E>`<br>`SynchronousBigIntStatistics<E>`<br>`SynchronousWindowCollectable<E>`<br>(+ `Asynchronous*`-Gegenstücke) | Die Pipeline in einen index-adressierten Puffer materialisieren und die Terminal-API bereitstellen. Die **ordered**-Familie übernimmt die Index-Buchhaltung; die **unordered**-Familie verzichtet darauf zugunsten des Durchsatzes. | `toUnordered()` `toOrdered()` `toNumericStatistics()` `toBigintStatistics()` `toWindow()` `toCollectable()` |
| Collector | `SynchronousCollector<E, A, R>`<br>`AsynchronousCollector<E, A, R>` | Ein wiederverwendbarer Fold: `identity → accumulator → finisher`, optional mit einem `interruptor`. Treibt jede Terminaloperation an und kann von Nutzern geschrieben werden. | `useSynchronous*` / `useAsynchronous*`-Collector-Fabriken oder `Collectable.collect(...)` |

Warum die mittlere Schicht existiert: Die Trennung von „was die Pipeline ist" von „wie sie gespeichert wird" ist es, die es demselben `toOrdered()` erlaubt, Umkehrung, Rotation und Mischung (Shuffling) zu bedienen — die Pipeline schreibt nur Indizes um, und der Collector entscheidet, was diese Indizes bedeuten.

---

<a id="3-data-flow-from-source-to-result"></a>
## 3. Datenfluss: Von der Quelle zum Ergebnis

```typescript
const result = useRange(0n, 100n)      // (1) source: reserve indices 0n,1n,2n,…
  .filter(n => n % 2n === 0n)          // (2) operator: index is forwarded unchanged
  .translate(2)                        // (3) operator: index becomes i + 2 (a lazy shift)
  .limit(5n);                          // (4) operator: interrupt() returns true after 5 elements

const ordered = result.toOrdered();    // (5) collectable: materialise; indices normalised mod n, sorted
const array = ordered.toArray();       // (6) terminal: drain the buffer
```

1. **Aufbau.** Die Schritte 1–4 konstruieren lediglich Closures. Es werden niemals hundert Elemente erzeugt.
2. **Push.** Wenn ein Collectable schließlich den Generator ausführt, fließen die Elemente ohne Scheduler: Die Quelle treibt, `accept` schreibt in den Collector, `interrupt` entscheidet, wann gestoppt wird — daher kostet `limit(5n)` mitten in einem Millionen-Element-Bereich fünf Iterationen, nicht eine Million.
3. **Index.** Operatoren verlieren den Index nie. `filter` leitet den ursprünglichen Index weiter (also ist „das 3. *beibehaltene* Element" nach wie vor „Index 3"), während `skip` / `sub` / `limit` / `distinct` bewusst neu indizieren.
4. **Materialisieren.** Ein Collectable führt den Generator genau einmal aus, nämlich beim Konstruieren.
5. **Terminal.** Methoden auf dem Collectable lesen den Puffer; sie sind günstig, wiederholbar und führen die Pipeline nie erneut aus.

**Die eine Regel, die sich zu merken lohnt:** Transformationen sind träge, Collectables sind eager, Terminals sind kostenlos.

---

<a id="4-quick-start"></a>
## 4. Schnellstart

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
## 5. Fabrikfunktionen

### 5.1 Übersicht

Die Konstruktion ist stets O(1) — eine Fabrik umschließt lediglich einen Generator. Die folgende Tabelle gibt die Kosten für den *Verbrauch* von `n` Elementen aus jeder Quelle an, zuzüglich des zusätzlichen Speichers, den die Quelle selbst über die gesammelten Elemente hinaus benötigt.

| Fabrik | Signatur (Ergebnis) | Zeit (n verbrauchen) | Speicher (Quelle) | Anmerkungen |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | Indizes sind 0..n−1; das Spread-Argument ist bereits materialisiert |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | Umschließt jedes `Iterable` / `AsyncIterable`; beim Sammeln einmal iteriert |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` ist exklusiv; `step` muss von Null verschieden sein; `number` und `bigint` funktionieren beide |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | Ein Supplier wird pro Element einmal aufgerufen |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | Neutralelement für `concat` |
| `useText` | `useText(text)`<br>`useText(text, delimiter)`<br>`useText(text, start)` / `(text, start, end)` | O(n) | O(n) für den Text | Iteriert über **Code-Punkte**, sodass Emoji und CJK einzelne Elemente bleiben |
| `useAttribute` | `useAttribute<T>(object) → SynchronousSemantic<{key, value}>` | O(v + e) über v Werte und e Kanten | O(d + v) für die besuchte Menge in Tiefe d | Durchläuft verschachtelte Objekte/Arrays rekursiv mit Zyklusschutz |
| `useGenerate` | `useGenerate<E>(supplier, interrupt) → SynchronousSemantic<E>` | O(n) × Supplier-Kosten | O(1) | **Muss** ein stoppendes `interrupt` besitzen (oder ein nachgelagertes `limit` / `takeWhile`) |
| `useIterate` | `useIterate<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useIterate<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) pro Sammlung | O(1) | Spielt den Iterator bei jeder Sammlung erneut ab |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period (Echtzeit) | O(1) | Gibt die verstrichene Zeit aus; verbraucht echte Zeit |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | Ein einzelnes Element am Index `0n` |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob size) | O(chunk) pro ausgegebenem Kopie | Standard-Chunk ist 64 KiB; jeder Chunk ist eine unabhängige Kopie |
| `useSubscription` | `useSubscription(target, subscriber, event \| events) → AsynchronousSemantic<Event>` | ein Element pro Ereignis | O(1) | `limit()` / `sub()` / `takeWhile()` definieren die Abmelde-Grenze |

### 5.2 Beispiele

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
## 6. Transformationsoperatoren

### 6.1 Übersicht

Jeder Operator gibt ein neues `Semantic` zurück; keiner von ihnen berührt ein Element, bis ein Collectable ausgeführt wird. Zeit ist die zusätzliche Kosten **pro Element** (zusätzlich zu den Kosten des Upstreams); Speicher ist der zusätzliche Speicher, den der Operator während des Pipeline-Laufs hält.

| Operator | Zweck | Indexwirkung | Zeit (pro Element) | Speicher |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | 1:1-Transformation | weitergeleitet | O(1) | O(1) |
| `filter(predicate)` | passende Elemente behalten | weitergeleitet | O(1) | O(1) |
| `flat(mapper)` | 1:N-Entfaltung (iterable oder semantic) | neu indiziert ab 0 | O(1) pro ausgegebenem Element | O(1) |
| `flatMap(mapper)` | 1:N-Entfaltung, kann den Elementtyp ändern | neu indiziert ab 0 | O(1) pro ausgegebenem Element | O(1) |
| `distinct(keyExtractor?)` | wiederholte Schlüssel verwerfen, den ersten behalten | weitergeleitet | O(1) im Mittel | O(n) für die Schlüsselmenge |
| `peek(consumer)` | Seiteneffekt, Element passiert hindurch | weitergeleitet | O(1) | O(1) |
| `limit(count)` | die ersten *n* nehmen | neu indiziert ab 0 | O(1), stoppt Upstream nach n | O(1) |
| `skip(count)` | die ersten *n* verwerfen | weitergeleitet | O(1) pro übersprungenem Element | O(1) |
| `sub(start, end)` | positionsbasierter Ausschnitt `[start, end)` | weitergeleitet | O(1) | O(1) |
| `takeWhile(predicate)` | solange nehmen, wie das Prädikat zutrifft | weitergeleitet | O(1), stoppt Upstream beim ersten Fehlschlag | O(1) |
| `dropWhile(predicate)` | solange verwerfen, wie das Prädikat zutrifft | neu indiziert ab 0 | O(1) | O(1) |
| `concat(other)` | ein Semantic oder Iterable anhängen | setzt den Index fort | O(1) | O(1) |
| `redirect(redirector)` | einen neuen Index nach Belieben berechnen | **Ihrer** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | negiert und verschoben | O(1) | O(1) |
| `translate(offset)` | träge Verschiebung jedes Index um *offset* | `i + offset` | O(1) | O(1) |
| `translate(mapper)` | Indexverschiebung pro Element | `i + mapper(element, i)` | O(1) | O(1) |
| `shuffle(mapper?)` | den Index randomisieren (oder eigenen Mapper nutzen) | zufällig | O(1) | O(1) |
| `pipe(conversion)` | den Generator an eine eigene Funktion übergeben | nach Belieben | Ihrer | Ihrer |
| `semantic()` | ein Collectable zurück in ein Semantic heben | unverändert | O(1) | O(1) |

### 6.2 Wichtige Hinweise

**`reverse`, `translate` und `shuffle` sind allesamt `redirect`-Strategien und benötigen einen geordneten Collector.** Sie schreiben lediglich Indizes um — es wird nichts gepuffert, nichts wird noch rotiert. Erst `toOrdered()` normalisiert die Indizes modulo der Elementanzahl und verwandelt sie in eine Reihenfolge:

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(-2).toOrdered().toArray();        // [3,4,5,1,2]
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3, 4, 5]).shuffle().toOrdered().toArray();            // a fresh permutation per call
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

Mit `toUnordered()` gesammelt, geben dieselben Pipelines die Elemente in Ankunftsreihenfolge mit ihren rohen Indizes zurück — siehe [Das Indexmodell](#10-the-index-model).

**`translate` ist eine reine, träge Indexverschiebung.** Beide Überladungen addieren zum Index (`i + offset` oder `i + mapper(element, i)`) und puffern den Stream nie. Eine Rotation materialisiert erst, wenn der *geordnete Collector* die Indizes modulo der Elementanzahl normalisiert — daher ist `translate(2)` selbst bei einem unendlichen Bereich mit nachfolgendem `limit` günstig.

**`redirect` ist das allgemeine Werkzeug.** Jede Indexstrategie lässt sich damit ausdrücken — umgekehrt, verschränkt, hash-partitioniert:

```typescript
useFrom([1, 2, 3, 4, 5]).redirect((_e, i) => -i - 1n).toOrdered().toArray();   // [5,4,3,2,1]
useFrom([1, 2, 3, 4]).redirect((_e, i) => i % 2n === 0n ? i + 1n : i - 1n)
  .toOrdered().toArray();                                                       // [2,1,4,3]
```

**Indexgesteuerte Ausschneiden bleibt erstklassig:**

```typescript
useOf(1, 2, 3, 4, 5).sub(1, 3).toUnordered().toArray();               // [2,3]
useOf(1, 2, 3, 4, 5).skip(2n).toUnordered().toArray();                // [3,4,5]
useOf(1, 2, 3, 4, 5).takeWhile(n => n < 3).toUnordered().toArray();   // [1,2]
useOf(1, 2, 3, 4, 1).dropWhile(n => n < 3).toUnordered().toArray();   // [3,4,1]
```

---

<a id="7-collectables-and-terminal-operations"></a>
## 7. Collectables und Terminaloperationen

### 7.1 Wahl eines Collectable

Das Collectable besitzt sowohl die **Reihenfolge** als auch die **Index-Buchhaltung**. `n` ist die Elementanzahl.

| Collectable | Struktur | Zeit | Speicher | Reihenfolge | Verwenden wenn |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | `Map<bigint, E>` mit Index als Schlüssel | O(n) | O(n) | Einfügungsreihenfolge | maximaler Durchsatz, Reihenfolge irrelevant; rohe Indizes bleiben unangetastet |
| `toOrdered()` | nach Elementindex sortiertes Array | O(n log n) | O(n) | nach normalisiertem Index | Umkehrung/Rotation/Shuffling muss wirksam werden, oder Sie benötigen positionsbasierte Zugriffe |
| `toOrdered(comparator)` | nach Ihrem Comparator sortiert, Index als Position neu aufgebaut | O(n log n) | O(n) | nach Ihrem Comparator | sortierte Ansichten, Min/Max-artige Lesezugriffe |
| `toNumericStatistics()` | wertsortierter Puffer | O(n log n) | O(n) | nach Wert | Statistik über `number` |
| `toBigintStatistics()` | wertsortierter Puffer | O(n log n) | O(n) | nach Wert | Statistik über `bigint` |
| `toWindow()` | wertsortierter Puffer | O(n log n) | O(n) | nach Wert | `slide` / `tumble` |
| `toCollectable(mapper)` | was auch immer der Mapper zurückgibt | — | — | — | eigene Collectables |

### 7.2 Terminals

Kosten sind nach der Materialisierung angegeben; `k` ist die Zielposition und `n` die Elementanzahl.

| Terminal | Liefert | Zeit | Speicher | Anmerkungen |
| :--- | :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | O(n) | O(n) | entleert den Puffer |
| `toSet()` | `Set<E>` | O(n) im Mittel | O(n) | dedupliziert nach Identität |
| `toMap(keyExtractor, valueExtractor?)` | `Map<K, V>` | O(n) im Mittel | O(n) | letzter Schreibzugriff gewinnt |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | O(1) | der Puffer weiß es bereits |
| `forEach(action)` | `void` | O(n) | O(1) | `action(element, index)` |
| `join(…)` | `string` | O(n) | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `log()` / `error()` | `void` | O(n) | O(n) | Konsolenausgabe, umschlossen von `[prefix … suffix]` |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | O(1) | IO-artiges Terminal |
| `collect(collector)`<br>`collect(identity, accumulator, finisher)` | `R` | O(n) | accumulator | der generische Fold hinter jedem obigen Terminal |
| `reduce(accumulator)` | `Optional<E>` | O(n) | O(1) | leerer Stream → leeres Optional |
| `reduce(identity, accumulator)` | `E` | O(n) | O(1) | — |
| `reduce(identity, accumulator, finisher)` | `R` | O(n) | O(1) | — |
| `group(classifier)` | `Map<K, E[]>` | O(n) im Mittel | O(n) | — |
| `groupBy(keyExtractor, valueExtractor)` | `Map<K, V[]>` | O(n) im Mittel | O(n) | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | O(n) | Round-Robin nach Index in `count` Buckets |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | O(n) | die Bucket-Nummer stammt aus dem Classifier |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) im schlimmsten Fall, bricht früh ab | O(1) | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | O(1) | positionsbasiert in materialisierter Reihenfolge |
| `findAt(k)` | `Optional<E>` | O(k), stoppt früh | O(1) | das (k+1)-te Element **in materialisierter Reihenfolge** |
| `findNegativeAt(k)` | `Optional<E>` | O(n−k), stoppt früh | O(1) | zählt vom Ende der materialisierten Reihenfolge rückwärts |
| `findMaximum(comparator?)` / `findMinimum(comparator?)` | `Optional<E>` | O(n) (O(1) bei Statistik) | O(1) | Standard ist ein struktureller Vergleich |
| `frequency()` | `Map<E, bigint>` | O(n) im Mittel | O(n) | nur Statistik-Collectables |
| `[Symbol.iterator]()` / `[Symbol.asyncIterator]()` | Iterator | O(n) | O(1) | `for…of` über ein Collectable |

### 7.3 Beispiele

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
## 8. Statistik

`toNumericStatistics()` und `toBigintStatistics()` bieten Ihnen einen wertsortierten Puffer plus eine statistische API. Beide akzeptieren einen Mapper, sodass Sie über einen projizierten Wert rechnen können: `.average(element => element.price)`.

| Methode | Bedeutung | `number` | `bigint` |
| :--- | :--- | :--- | :--- |
| `summate()` | Σx | exakt | exakt |
| `average()` / `mean()` | Σx / n | exakt | Ganzzahldivision |
| `median()` | mittlerer Wert (bei gerader Anzahl Mittel der beiden mittleren) | exakt | gerundet |
| `mode()` | häufigster Wert | exakt | exakt |
| `variance()` | Varianz der Grundgesamtheit σ² | exakt | gerundet |
| `standardDeviation()` | √σ² | exakt | gerundet |
| `range()` | max − min | exakt | exakt |
| `quantile(q)` | Quantil nach Nearest-Rank, `0 ≤ q ≤ 1` | exakt | exakt |
| `interquartileRange()` | q(0.75) − q(0.25) | exakt | exakt |
| `skewness()` | Σ((x−μ)/σ)³ / n | exakt | gerundet |
| `kurtosis()` | Σ((x−μ)/σ)⁴ / n − 3 (excess) | exakt | gerundet |
| `frequency()` | Wert → Anzahl | `Map<E, bigint>` | `Map<E, bigint>` |

Alle Methoden sind O(1) auf dem sortierten Puffer (das Sortieren wurde einmalig bei der Materialisierung bezahlt), mit Ausnahme von `frequency()`, das O(n) im Mittel bei O(n) Speicher ist.

`bigint`-Ergebnisse werden in Fließkomma berechnet und auf `bigint` zurückgerundet, da eine Ganzzahldivision sie sonst verfälschen würde (die Varianz von `[1n,2n,3n,4n]` ist `1.25`, nicht `3`). Wenn Sie exakte gebrochene Statistiken benötigen, projizieren Sie auf `number` und nutzen Sie den numerischen Collector.

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
## 9. Fenster

`toWindow()` liefert ein Collectable, dessen `slide` / `tumble` ein Semantic *von Semantics* erzeugt.

```typescript
const windows = useOf(1, 2, 3, 4, 5).toWindow();

windows.tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2], [3,4], [5]]

windows.slide(3n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2,3], [2,3,4], [3,4,5], [4,5], [5]]   — trailing partial windows are included
```

`tumble(size)` ist insgesamt O(n); `slide(size, step)` ist O(n × size), da sich Fenster überlappen.

Asynchrone Quellen funktionieren genauso; `slide` / `tumble` warten, bis der zugrunde liegende Puffer bereit ist:

```typescript
const asyncWindows = await useFrom(tick()).toWindow().tumble(2n).toUnordered().toArray();
for (const window of asyncWindows) {
  console.log(await window.toUnordered().toArray());
}
```

---

<a id="10-the-index-model"></a>
## 10. Das Indexmodell

Das Indexmodell hat zwei Hälften: Die **Pipeline** schreibt Indizes günstig und träge um; das **Collectable** entscheidet, was sie bedeuten. Diese Trennung ist bewusst und beherbergt die Reihenfolge-Kosten.

| Konzept | Verhalten |
| :--- | :--- |
| Indextyp | `bigint`, stets als zweites Argument jedes Callbacks verfügbar |
| Pipeline-Arithmetik | `reverse()` = `redirect(-i - 1n)`, `translate(o)` = `redirect(i + o)`, `shuffle()` = `redirect(random)` — alles O(1) pro Element, alles träge, nichts puffert etwas |
| `toUnordered()` — keine Buchhaltung | behält jeden rohen Index unangetastet in einer `Map`. `translate(2)` ungeordnet gesammelt liefert weiterhin die Indizes `2n,3n,4n,…`. Das ist der Leistungsvertrag: kein Sortieren, keine Normalisierung, O(n) |
| `toOrdered()` — Normalisierung | schreibt jeden Index auf `((i mod n) + n) mod n` um (n = Elementanzahl) und sortiert dann. Negative oder überdimensionierte Indizes falten in `0..n−1`, sodass `reverse`, `translate(7)` und `shuffle` alle auf einer gültigen Position landen |
| `toOrdered(comparator)` | sortiert nach Wert und baut Indizes als Positionen neu auf — das nutzen Statistiken |
| Rotation | ergibt sich aus der Normalisierung: `translate(2)` liefert die Indizes `2,3,4,0,1`, die zur Rotation `[4,5,1,2,3]` sortiert werden. Im Operator findet kein Puffern statt |
| Doppelte Indizes | werden von `toUnordered()` erkannt und mit Ersatzschlüsseln versehen, sodass **kein Element stillschweigend verworfen** wird; `toOrdered()` behält gleiche Indizes in relativer Reihenfolge |
| `findAt(k)` / `findNegativeAt(k)` | adressiert die **materialisierte Reihenfolge** — `findAt(1n)` ist stets das zweite Element dessen, was das Collectable erzeugte, `findNegativeAt(-1n)` stets das letzte — unabhängig davon, was `redirect` / `reverse` / `translate` mit den rohen Indizes getan haben |
| `distinct` | behält das erste Vorkommen **samt seinem ursprünglichen Index** |
| `sub` / `skip` / `limit` | zählt Elemente, nicht Indexwerte |

Kurz gesagt: **`OrderedCollectable` und seine Unterklassen besitzen die Index-Buchhaltung** (modulo n normalisieren, sortieren, positionsbasierte Adressierung), während **`UnorderedCollectable` die Leistung garantiert, indem es Indizes niemals antastet**. Wählen Sie pro Abfrage, nicht pro Pipeline.

---

<a id="11-the-asynchronous-model"></a>
## 11. Das asynchrone Modell

Quellen, deren Daten noch nicht existieren können, liefern `AsynchronousSemantic<E>`:

| Asynchrone Quelle | Warum |
| :--- | :--- |
| `usePromise` | der Wert trifft später ein |
| `useBlob` | `Blob.stream()` ist asynchron |
| `useInterval` | getrieben von `setInterval` |
| `useSubscription` | getrieben von externen Ereignissen |
| `useFrom` / `useIterate` mit einem `AsyncIterable` | erzeugt von `for await` |

Der Verbrauch ist einheitlich — jedes Terminal eines `AsynchronousCollectable` liefert ein `Promise`, und die Semantik (Indexmodell, Normalisierung, positionsbasiertes `findAt`) ist identisch zur synchronen Seite:

```typescript
const stats = await useFrom(asyncGenerator()).map(n => n * 2n).limit(10n).toBigintStatistics();
await stats.summate();

for await (const element of usePromise(Promise.resolve(1)).toUnordered()) {
  console.log(element);
}
```

Drei Dinge, vor denen das Typsystem Sie nicht bewahrt:

1. **Beenden des Streams.** Eine Ereignis- oder Timer-Quelle endet nie von selbst. Definieren Sie die Grenze — `limit(n)`, `sub(start, end)` oder `takeWhile(predicate)` — sonst bleibt das Abonnement aktiv.
2. **Await des Collectable.** `toOrdered()`, Statistiken und `toWindow()` warten auf den Abschluss der Quelle, bevor sie antworten; eine nur aus einem Promise bestehende Quelle, die nie abschließt, hält sie im Schwebezustand.
3. **Vermischen der Schichten.** Ein synchrones Collectable kann keine asynchrone Quelle verbrauchen. Sobald eine async-Fabrik beteiligt ist, halten Sie die gesamte Pipeline auf der async-Seite und `await`en Sie die Terminals.

---

<a id="12-utility-helpers"></a>
## 12. Hilfsfunktionen

| Hilfsfunktion | Zweck | Zeit |
| :--- | :--- | :--- |
| `useCompare(a, b)` | Struktureller Vergleich, den jede Standardsortierung/-min/max nutzt (`number`, `bigint`, `string`, `boolean`, `symbol`, Objekte über `Symbol.toPrimitive`) | O(1) bei Primitiven |
| `useRandom(start, end?)` | Zufällige(s) `number` / `bigint`, gleichverteilt über den halboffenen Bereich | O(1) |
| `useHash(value, …)` | stabiler, 64-Bit-artiger `bigint`-Hash für jeden Wert (Primitiven, Objekte, Zyklen) | O(v) über besuchte Werte |
| `register(type, handler)` / `unregister(type)` / `maskOf(type)` | den Hash für eigene Typen erweitern | O(1) |
| `useTraverse(object, callback)` | tiefe Traversierung mit Zyklusschutz; der Callback erhält `(key, value, path)` | O(v + e) |
| `useStringify(object, callback?)` | JSON-Serialisierung, die zirkuläre Referenzen übersteht | O(v + e) |
| `useToNumber(value)` / `useToBigInt(value)` | totale Konvertierungen (werfen nie; liefern `0` / `0n` für unbrauchbare Eingabe) | O(1) |
| `useGenerator(iterable)` / `useArrange(source, comparator?)` | roher `(accept, interrupt)`-Generator sowie ein sortierender Generator | O(n) / O(n log n) |
| `Optional<T>` | `of`, `ofNullable`, `ofNonNull`, `empty`; `map`, `flat`, `flatMap`, `filter`, `get`, `get(default)`, `ifPresent(action, elseAction)`, `orElse`, `isPresent`, `isEmpty`, `semantic()` | O(1) pro Methode |
| Type guards | `isNumber` (schließt `NaN` und `Infinity` aus), `isBigInt`, `isString`, `isBoolean`, `isSymbol`, `isFunction`, `isObject`, `isPrimitive`, `isIterable`, `isAsyncIterable`, `isPromise`, `isAsyncFunction`, `isGeneratorFunction`, `isAsyncGeneratorFunction`, `isOptional`, `isSynchronousSemantic` / `isAsynchronousSemantic`, `isSynchronousCollectable` (+ async), `isSynchronousOrderedCollectable`, `isSynchronousUnorderedCollectable`, `isSynchronousStatistics`, `isSynchronousNumericStatistics`, `isSynchronousBigIntStatistics`, `isSynchronousWindowCollectable`, `isSynchronousCollector` | O(1) |

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
## 13. Vergleich mit anderen Bibliotheken

| Aspekt | Semantic-TypeScript | RxJS | Native Iteratoren |
| :--- | :--- | :--- | :--- |
| Modell | Push mit explizitem `interrupt`-Signal | Push, Abonnement-Objekte | Pull |
| Position | intrinsischer `bigint`-Index auf jedem Element | selbst zusammengesetzte Operatoren (`scan`, `withLatestFrom`) | manueller Zähler |
| Trägheit | Operatoren träge, Collectables explizit | Operatoren träge, `subscribe` eager | träge |
| Sync + Async | eine API, async-Fabriken im Typ markiert | async-zuerst | `for await`-Brücke von Hand |
| Terminal-API | reichhaltiges Collectable (`toArray`, `toMap`, `group`, `reduce`, `find*`, Statistik) | nur Operatoren | keine |
| Statistik | eingebaut, für `number` und `bigint` | extern | keine |
| Lebenszyklus-Sicherheit | der Grenz-Operator meldet ab | manuelles `unsubscribe` / `takeUntil` | manuell |
| Ökosystem / Größe | klein, keine Abhängigkeiten | großes Operator-Ökosystem | null |

Wählen Sie Semantic-TypeScript, wenn Sie indexgesteuerte Datenverarbeitung mit einem expliziten Kostenmodell und ohne Scheduler wünschen. Wählen Sie RxJS, wenn Sie dessen Operator-Ökosystem, Multi-Observer-Semantik und Scheduler-Steuerung benötigen.

---

<a id="14-performance-characteristics"></a>
## 14. Leistungsmerkmale

Die Kosten einer Abfrage sind die Summe dreier sichtbarer Teile: Quelle (§5), Operatoren (§6), Collectable (§7). Nichts Verborgenes läuft jemals zweimal.

| Operation | Zeit | Speicher | Anmerkungen |
| :--- | :--- | :--- | :--- |
| `map` / `filter` / `peek` | O(1) pro Element | O(1) | reine Transformation |
| `limit` / `takeWhile` | O(1) pro Element | O(1) | stoppt den Upstream sofort |
| `reverse` / `translate` / `shuffle` | O(1) pro Element | O(1) | nur Index-Arithmetik — kein Puffern |
| `distinct` | O(1) im Mittel pro Element | O(n) | `Set` von Schlüsseln |
| `toUnordered()` | O(n) | O(n) | ein `Map`-Eintrag pro Element; Indizes unberührt |
| `toOrdered()` | O(n log n) | O(n) | normalisieren O(n) + sortieren O(n log n) |
| Statistik | O(n log n) einmalig, danach O(1) pro Methode | O(n) | hält einen sortierten/aggregierten Puffer |
| `findAt(k)` / `findNegativeAt(k)` | O(k) / O(n−k) | O(1) | früher Abbruch, sobald die Position passiert ist |
| `findMaximum` / `findMinimum` | O(n) generisch, O(1) Statistik | O(1) | ein einziger Durchlauf mit laufendem Bestwert |

Faustregeln: Halten Sie die Pipeline träge, bis Sie tatsächlich ein Ergebnis benötigen; bevorzugen Sie `toUnordered()`, sofern die Reihenfolge keine Rolle spielt; setzen Sie `limit` / `takeWhile` so früh wie die Semantik es erlaubt; lassen Sie das *Collectable*, nicht den Operator, über die Kosten der Reihenfolge entscheiden.

---

<a id="15-pitfalls-and-faq"></a>
## 15. Fallstricke und FAQ

**„Meine Pipeline liefert nichts / hängt."** Die Quelle endete nie. `useInterval`, `useSubscription`, `usePromise` und `useGenerate` benötigen eine Grenze (`limit`, `sub`, `takeWhile`) oder eine abschließende Quelle.

**„`reverse()` hat nichts bewirkt."** Sie haben es mit `toUnordered()` verbraucht, das keine Index-Buchhaltung garantiert. Nutzen Sie `toOrdered()`.

**„`translate(2)` lieferte die Elemente unrotiert zurück."** Aus demselben Grund: `translate` verschiebt nur Indizes; die Rotation wird durch `toOrdered()`s Modulo-Normalisierung realisiert. Ungeordnet gesammelt, ist die Verschiebung in den rohen Indizes weiterhin sichtbar.

**„Warum fehlt ein Element?"** Ein Upstream erzeugte doppelte Indizes, und Sie verbrauchen über `toUnordered()`. Ersatzschlüssel verhindern Datenverlust, aber wenn Sie *beide* Elemente in Reihenfolge *sehen* müssen, verbrauchen Sie stattdessen mit `toOrdered()`.

**„`findAt(1n)` liefert etwas Unerwartetes."** `findAt` adressiert die **materialisierte Reihenfolge**, nicht den rohen Index. Nach `.reverse().toOrdered()` ist Position 1 das zweite Element der umgekehrten Folge. Wenn Sie das Element mit dem rohen Index `1n` wünschen, filtern Sie explizit auf den Index.

**„`bigint`-Statistiken sehen gerundet aus."** Das sind sie — `bigint`-Ergebnisse sind per Design ganzzahlig gerundet (siehe [Statistik](#8-statistics)). Projizieren Sie auf `number` für exakte Brüche.

**„Muss ich `toXxx()` vor `toArray()` aufrufen?"** Ja. Terminaloperationen liegen auf Collectables, nicht auf Semantics. Das ist bewusst: Es macht die Speicher- und Reihenfolge-Kosten im Typ sichtbar.

**„Wird es tree-shaken?"** `sideEffects: false` ist deklariert, importieren Sie also nur, was Sie nutzen. Beachten Sie, dass `useHash` seine Standard-Handler beim Laden des Moduls registriert.

---

<a id="16-license"></a>
## 16. Lizenz

MIT © Eloy Kim

Siehe [CHANGELOG.md](./CHANGELOG.md) für die vollständige Versionshistorie.
