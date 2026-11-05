# **Semantic-TypeScript**

**Datenfluss, indexiert.** Ihre Daten, präzise unter Kontrolle.

[English](./readme.md) · [简体中文](./readme.cn.md) · [繁體中文](./readme.tw.md) · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · Deutsch · [Français](./readme.fr.md) · [Español](./readme.es.md) · [Русский](./readme.ru.md)

Eine typsichere Stream-Verarbeitungsbibliothek, die **JavaScript-Generatoren**, **Java Stream** und
**indexbasierte Datenadressierung** vereint. Jedes Element trägt einen `bigint`-Index, jede Pipeline ist träge, und
jede Terminaloperation muss ausdrücklich aktiviert werden.

```bash
npm install semantic-typescript
```

- Keine Laufzeitabhängigkeiten, reines ESM, liefert eigene Typen mit.
- 684 Regressionstests: `npm test`.
- Vollständige Änderungshistorie: [CHANGELOG.md](./CHANGELOG.md).

---

## Table of Contents

1. [Entwurfsphilosophie](#1-design-philosophy)
2. [Architektur](#2-architecture)
3. [Schnellstart](#3-quick-start)
4. [Fabrikfunktionen](#4-factory-functions)
5. [Transformationsoperatoren](#5-transformation-operators)
6. [Collectables und Terminaloperationen](#6-collectables-and-terminal-operations)
7. [Statistik und Fenster](#7-statistics-and-windows)
8. [Das Indexmodell](#8-the-index-model)
9. [Das asynchrone Modell](#9-the-asynchronous-model)
10. [Periodische Analyse: Ringe, Felder und Scores](#10-periodic-analysis-rings-fields-and-scores)
11. [Hilfsfunktionen](#11-utility-helpers)
12. [Leistung und Fallstricke](#12-performance-and-pitfalls)
13. [Phasenringe: ein exakter Zyklus](#13-phase-rings)
14. [Signalanalyse: Fenster, Spektren und Zeit](#14-signal-analysis)
15. [Lizenz](#15-license)

---

<a id="1-design-philosophy"></a>
## 1. Entwurfsphilosophie

Drei Ideen, eine Pipeline:

**Index ist Daten.** Jedes Element wird über einen `bigint` adressiert. Umkehrung, Rotation, Mischen
(Shuffling) und Aufteilung sind Index-Arithmetik, keine Pufferoperationen. Nichts wird materialisiert,
bis ein Collectable es anfordert.

**Trägheit ist die Vorgabe.** Eine Fabrik umschließt einen Generator; ein Operator umschließt einen
weiteren Generator. Kein Element wird angefordert, bis eine Terminaloperation läuft, daher ist eine
unendliche Quelle völlig zulässig, solange etwas Nachgelagertes sie stoppt.

**Terminals sind explizit.** `map` gibt ein `Semantic` zurück, kein Array. Werte erscheinen erst, wenn
Sie ein Collectable benennen — `toUnordered()`, `toOrdered()`, `toNumericStatistics()`, `toWindow()` —
und jedes davon sagt, was es kostet und welche Reihenfolge es erzeugt.

Dieselbe Disziplin gilt für die mathematische Hälfte der Bibliothek. Ein `Complex`, ein `Angle` oder
eine `Frequency` ist ein unveränderlicher Wert, dessen Invarianten bei der Konstruktion geprüft
werden; ein `Optional` ersetzt `null`; und ein Phasenring sagt genau, wie viele Elemente er hält,
welche Periode er hat und wie ausgewogen er ist.

---

<a id="2-architecture"></a>
## 2. Architektur

```
factory  ──▶  Semantic  ──▶  Semantic  ──▶  Collectable  ──▶  result
 (source)      (map)         (filter)        (terminal)
                    ▲
                    └── every operator returns a new Semantic wrapping a generator
```

| Schicht | Modul | Verantwortung |
| :--- | :--- | :--- |
| Quellen | `synchronous/collectors`, `asynchronous/collectors` | Umschließt ein Iterable, einen Generator, ein Promise, einen Blob, ein Event-Target |
| Pipelines | `synchronous/semantic`, `asynchronous/semantic` | Träge Operatoren und das Umschreiben von Indizes |
| Collectables | `synchronous/semantic`, `asynchronous/semantic` | Geordnete, ungeordnete, Statistik-, Fenster- und eigene Terminals |
| Collectors | `synchronous/collector`, `asynchronous/collector` | Die Fold-Primitive, aus denen jedes Terminal aufgebaut ist |
| Mathematik | `mathematics/*` | Winkel, Komplexe, Frequenzen, Spektren, Fenster, Schätzer, Epizyklen, Phasenringe |
| Strukturen | `structure/*` | Listen, Sets, Maps, Bäume, Forste, Ringe, Felder |
| Fehler | `structure/error` | Die typisierte `SemanticError`-Hierarchie und ihre Brand-Guards |

Die synchrone und die asynchrone Familie teilen ein Vokabular: dieselben Operatornamen, dieselbe
Indexsemantik, dieselben Collectables. Die asynchronen Varianten geben lediglich Promises zurück und
stellen Schreibzugriffe in eine Warteschlange, sodass ein nach einem Schreibzugriff ausgelöster
Lesezugriff ihn stets beobachtet.

### 2.1 Was dieses Release verschoben und gebrochen hat

Drei Module haben ihren Ort oder ihre Form gewechselt, und eine Reihe von Standardwerten hat die Bedeutung geändert. Jedes alte Verhalten bleibt über eine explizite Option erreichbar; nichts wurde ohne Ersatz entfernt.

| Änderung | Vorher | Jetzt |
| :--- | :--- | :--- |
| Forste | `structure/tree/rootedForest`, `structure/tree/unionFindForest` | `structure/forest/rootedForest`, `structure/forest/unionFindForest`; `tree/index.ts` re-exportiert sie nicht mehr |
| Fehler | ad-hoc native Fehler | eine Hierarchie aus fünfzehn Klassen in `structure/error.ts`, mit je einem Brand-Guard pro Klasse und dem Alias `SemanticRangeError` |
| Schätzer-Optionen | feste Definitionen | `mathematics/quantile.ts` exportiert `QuantileMethod`, `QuantileOptions`, `SkewnessEstimator`, `KurtosisEstimator` und `VarianceOptions` |
| `quantile` | Hyndman–Fan Typ 1 | Typ 7 — R `quantile`, NumPy `linear`, Excel `PERCENTILE.INC` |
| `skewness` / `kurtosis` | `g1` / `g2` | die bias-korrigierten `G1` / `G2` |
| `variance` / `standardDeviation` | `ddof = 0` | `ddof = 1`, in ein `Optional` gehüllt |
| `decibel` | eine `20·log10`-Funktion | entfernt; `amplitudeDecibel` (20·log10) und `powerDecibel` (10·log10) |
| `Spectrum.flatness()` | Beträge über beide Hälften | Leistungen über die einseitige Hälfte |
| `Spectrum.bandEnergy()` | rohe zweiseitige Summe | standardmäßig einseitig, mit Faltung der konjugierten Hälfte |
| `shortTimeFourierTransform` / `spectrogram` | symmetrisches Hann, nur vollständige Frames | periodisches Hann, `boundary: "zeros"`, `padded: true` |

Die Kapitel 6, 7 und 10 dokumentieren die Ersatzlösungen; die gemessenen Folgen stehen in [CHANGELOG.md](./CHANGELOG.md).

---

<a id="3-quick-start"></a>
## 3. Schnellstart

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
## 4. Fabrikfunktionen

Die Konstruktion ist stets O(1) — eine Fabrik umschließt lediglich einen Generator. Die Tabelle nennt
die Kosten für den *Verbrauch* von `n` Elementen sowie den zusätzlichen Speicher, den die Quelle selbst
benötigt.

| Fabrik | Signatur (Ergebnis) | Zeit (n verbrauchen) | Speicher (Quelle) | Anmerkungen |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | Indizes sind 0..n−1; das Spread-Argument ist bereits materialisiert |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | Umschließt jedes Iterable; beim Sammeln einmal iteriert |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` ist exklusiv; `step` muss von Null verschieden sein; `number` und `bigint` funktionieren beide |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | Ein Supplier wird pro Element einmal aufgerufen |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | Neutralelement für `concat` |
| `useText` | `useText(text, delimiter?)` | O(n) | O(n) für den Text | Iteriert über **Code-Punkte**, sodass Emoji und CJK einzelne Elemente bleiben |
| `useAttribute` | `useAttribute<T>(object)` | O(v + e) | O(d + v) | Durchläuft verschachtelte Objekte rekursiv mit Zyklusschutz |
| `useGenerate` | `useGenerate<E>(supplier, interrupt)` | O(n) × Supplier-Kosten | O(1) | **Muss** ein stoppendes `interrupt` besitzen oder ein nachgelagertes `limit` |
| `useIterate` | `useIterate<E>(Iterable<E>)` / `(AsyncIterable<E>)` | O(n) pro Sammlung | O(1) | Spielt den Iterator bei jeder Sammlung erneut ab |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period (Echtzeit) | O(1) | Gibt die verstrichene Zeit aus |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | Ein einzelnes Element am Index `0n` |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob size) | O(chunk) pro Kopie | Standard-Chunk ist 64 KiB |
| `useSubscription` | `useSubscription(target, subscriber, event) → AsynchronousSemantic<Event>` | ein Element pro Ereignis | O(1) | `limit()` / `takeWhile()` definieren die Abmelde-Grenze |

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
## 5. Transformationsoperatoren

Jeder Operator gibt ein neues `Semantic` zurück; keiner berührt ein Element, bis ein Collectable läuft.
Die Zeit ist der zusätzliche Aufwand **pro Element**; der Speicher ist das, was der Operator während
des Pipeline-Laufs hält.

| Operator | Zweck | Indexwirkung | Zeit | Speicher |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | 1:1-Transformation | weitergeleitet | O(1) | O(1) |
| `filter(predicate)` | passende Elemente behalten | weitergeleitet | O(1) | O(1) |
| `flat(mapper)` / `flatMap(mapper)` | 1:N-Entfaltung | neu indiziert ab 0 | O(1) pro Ausgabe | O(1) |
| `distinct(keyExtractor?)` | wiederholte Schlüssel verwerfen, den ersten behalten | weitergeleitet | O(1) im Mittel | O(n) |
| `peek(consumer)` | Seiteneffekt, Element passiert hindurch | weitergeleitet | O(1) | O(1) |
| `limit(count)` | die ersten *n* nehmen | neu indiziert ab 0 | O(1) | O(1) |
| `skip(count)` | die ersten *n* verwerfen | weitergeleitet | O(1) | O(1) |
| `sub(start, end)` | positionsbasierter Ausschnitt `[start, end)` | weitergeleitet | O(1) | O(1) |
| `takeWhile(predicate)` | solange nehmen, wie das Prädikat zutrifft | weitergeleitet | O(1) | O(1) |
| `dropWhile(predicate)` | solange verwerfen, wie das Prädikat zutrifft | neu indiziert ab 0 | O(1) | O(1) |
| `concat(other)` | ein Semantic oder Iterable anhängen | setzt den Index fort | O(1) | O(1) |
| `redirect(redirector)` | einen neuen Index nach Belieben berechnen | **Ihrer** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | negiert und verschoben | O(1) | O(1) |
| `translate(offset \| mapper)` | jeden Index verschieben | `i + offset` | O(1) | O(1) |
| `shuffle(mapper?)` | den Index randomisieren | zufällig | O(1) | O(1) |
| `pipe(conversion)` | den Generator an eine eigene Funktion übergeben | nach Belieben | Ihrer | Ihrer |
| `semantic()` | ein Collectable zurück in ein Semantic heben | unverändert | O(1) | O(1) |

**`reverse`, `translate` und `shuffle` schreiben nur Indizes um.** Nichts wird gepuffert oder rotiert,
bis `toOrdered()` die Indizes modulo der Elementanzahl normalisiert:

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

---

<a id="6-collectables-and-terminal-operations"></a>
## 6. Collectables und Terminaloperationen

### 6.1 Collectables

Das Collectable besitzt sowohl die **Reihenfolge** als auch die **Index-Buchhaltung**. `n` ist die
Elementanzahl.

| Collectable | Struktur | Zeit | Reihenfolge | Verwenden wenn |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | `Map<bigint, E>` mit Index als Schlüssel | O(n) | Einfügungsreihenfolge | maximaler Durchsatz; rohe Indizes bleiben unangetastet |
| `toOrdered()` | nach Elementindex sortiertes Array | O(n log n) | nach normalisiertem Index | Umkehrung/Rotation muss wirksam werden |
| `toOrdered(comparator)` | nach Ihrem Comparator sortiert | O(n log n) | nach Ihrem Comparator | sortierte Ansichten |
| `toNumericStatistics()` | wertsortierter Puffer | O(n log n) | nach Wert | Statistik über `number` |
| `toBigintStatistics()` | wertsortierter Puffer | O(n log n) | nach Wert | Statistik über `bigint` |
| `toWindow()` | wertsortierter Puffer | O(n log n) | nach Wert | `slide` / `tumble` |
| `toCollectable(mapper)` | was auch immer der Mapper zurückgibt | — | — | eigene Collectables |

### 6.2 Terminals

Jedes Terminal lebt am **Collectable**, nicht am `Semantic`. Genau das bedeutet „Terminals sind explizit" in der Praxis: Eine Pipeline erzeugt nichts, bis ein Collectable benannt wird, und `toCollectable()` ohne Mapper ist die günstigste Benennung.

| Terminal | Liefert | Zeit | Anmerkungen |
| :--- | :--- | :--- | :--- |
| `toArray()` / `toSet()` | `Array<E>` / `Set<E>` | O(n) | entleert den Puffer; `toSet` dedupliziert nach Identität |
| `toMap(key, value?)` | `Map<K, V>` | O(n) im Mittel | letzter Schreibzugriff gewinnt |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | der Puffer weiß es bereits |
| `forEach(action)` | `void` | O(n) | `action(element, index)` |
| `join(…)` | `string` | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `reduce(…)` | `Optional<E>` / `E` / `R` | O(n) | leerer Stream → leeres `Optional` |
| `group(classifier)` / `groupBy(key, value)` | `Map<K, E[]>` | O(n) im Mittel | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | Round-Robin nach Index |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | die Bucket-Nummer stammt vom Classifier |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) im schlimmsten Fall, bricht früh ab | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | positionsbasiert in materialisierter Reihenfolge |
| `findAt(k)` / `findNegativeAt(k)` | `Optional<E>` | O(k) / O(n−k) | zählt von vorne / von hinten |
| `findMaximum(cmp?)` / `findMinimum(cmp?)` | `Optional<E>` | O(n) | Standard ist ein struktureller Vergleich |
| `frequency()` | `Map<E, bigint>` | O(n) im Mittel | nur Statistik-Collectables |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | IO-artiges Terminal |
| `collect(collector)` | `R` | O(n) | der generische Fold hinter jedem obigen Terminal |

### 6.3 Struktur-Collectors

`toArray`, `toSet` und `toMap` beenden eine Pipeline in einem JavaScript-Container. Zwölf weitere Terminals beenden sie in einer der Strukturen der Bibliothek selbst, sodass das Ergebnis die Invarianten trägt, die diese Struktur garantiert, statt derer, die ein Array zufällig hat. Sie stehen an jedem Collectable zur Verfügung, auch am nackten Collectable aus `toCollectable()`.

| Terminal | Liefert | Reihenfolge | Kosten |
| :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | Durchlaufreihenfolge | O(n) |
| `toSet()` | `Set<E>` | Einfügungsreihenfolge, SameValueZero | O(n) im Mittel |
| `toMap(key, value?)` | `Map<K, V>` | Einfügungsreihenfolge; der letzte Schreibzugriff gewinnt | O(n) im Mittel |
| `toOrderedSet(comparator?)` | `SynchronousOrderedSet<E>` | comparator-aufsteigend | O(n²) im schlimmsten Fall |
| `toUnorderedSet()` | `SynchronousUnorderedSet<E>` | nicht spezifiziert (Hash-Buckets) | O(n) erwartet |
| `toOrderedMap(key, value?)` | `SynchronousOrderedMap<K, V>` | Einfügungsreihenfolge; der letzte Schreibzugriff gewinnt | O(n) erwartet |
| `toUnorderedMap(key, value?)` | `SynchronousUnorderedMap<K, V>` | nicht spezifiziert | O(n) erwartet |
| `toList()` | `SynchronousList<E>` | Durchlaufreihenfolge, Duplikate bleiben | O(n) |
| `toRing(span?)` | `SynchronousRing<E>` | die Durchlaufreihenfolge legt die Ringpositionen fest | O(n) |
| `toLRUSet(capacity)` | `SynchronousUnorderedLRUSet<E>` | nach Aktualität; nur die letzten `capacity` überleben | O(n²) im schlimmsten Fall |
| `toLRUMap(capacity, key, value?)` | `SynchronousUnorderedLRUMap<K, V>` | nach Aktualität | O(n) erwartet |
| `toSkipSet(comparator?)` | `SynchronousSkipSet<E>` | comparator-aufsteigend, navigierbar | O(n²) im schlimmsten Fall |
| `toSkipMap(key, value?)` | `SynchronousSkipMap<K, V>` | nach dem Schlüssel-Comparator, navigierbar | O(n) erwartet |
| `toBinarySearchTree(comparator?)` | `SynchronousBinarySearchTree<E>` | comparator-aufsteigend, höhenbalanciert | O(n log n) |
| `toRootedForest()` | `SynchronousRootedForest<E>` | die Durchlaufreihenfolge wird zur Struktur | O(n) |

Der Ergebnistyp folgt dem Elementtyp des Collectables selbst, daher braucht kein Terminal ein Typargument: Ein `SynchronousCollectable<E>` liefert direkt `Array<E>`, `SynchronousList<E>` oder `SynchronousOrderedSet<E>`. Es bleiben nur die fachlichen Argumente — der Comparator von `toOrderedSet` / `toSkipSet` / `toBinarySearchTree`, die Kapazität des LRU-Paars, die Spanne von `toRing` und die Schlüssel- und Wert-Extraktoren der Map-Familie.

Ein Ring ist ein Set, daher behalten wiederholte Elemente ihre erste Position; alle übrigen Strukturen oben behalten Duplikate, sofern ihr eigener Vertrag nichts anderes sagt (`toOrderedSet`, `toUnorderedSet` und `toSkipSet` sind Sets; `toBinarySearchTree` und `toList` nicht).

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

Die asynchronen Collectables bieten dieselben Terminals und lösen jedes in einem Promise auf; die Aufrufform gewinnt also nur ein `await` hinzu.

---

<a id="7-statistics-and-windows"></a>
## 7. Statistik und Fenster

### 7.1 Die Statistik-Oberfläche

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();                    // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();                    // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();                     // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                       // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance().get();             // 3.2    (n − 1)
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation().get();    // 1.7889 (n − 1)
```

Beide Statistik-Familien bieten dieselbe Oberfläche — `summate`, `average`, `median`, `mode`, `variance`, `standardDeviation`, `frequency`, `findMaximum`, `findMinimum` — mit `bigint`-Arithmetik für `toBigintStatistics()`. Die Streuungsmaße und die Quantil-Familie geben `Optional` zurück, weil eine Stichprobe zu klein sein kann, um sie zu definieren; entpacken Sie sie mit `.get()`, `.orElse(…)` oder `.isPresent()`.

### 7.2 Schätzer und Standardwerte

Die Standardwerte sind die Definitionen, die R, NumPy, pandas und Excel verwenden; ein hier berechneter Wert lässt sich also ohne Korrekturfaktor mit diesen Werkzeugen vergleichen.

| Statistik | Standard | Vorher | Alten Wert zurückholen mit |
| :--- | :--- | :--- | :--- |
| `quantile(probability)` | Hyndman–Fan Typ 7 | Typ 1 | `{ method: "type-1" }` |
| `interquartileRange()` | Hyndman–Fan Typ 7 | Typ 1 | `{ method: "type-1" }` |
| `skewness()` | bias-korrigiertes `G1` | `g1` | `{ estimator: "g1" }` |
| `kurtosis()` | bias-korrigiertes Excess-`G2` | `g2` | `{ estimator: "g2" }` |
| `variance()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |
| `standardDeviation()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |

Alle neun Hyndman–Fan-Typen stehen als `"type-1"` … `"type-9"` zur Verfügung, und `{ excess: false }` addiert drei wieder zur Kurtosis hinzu und meldet das nicht-exzessive vierte standardisierte Moment. Die Optionstypen — `QuantileMethod`, `QuantileOptions`, `SkewnessEstimator`, `KurtosisEstimator`, `VarianceOptions` — werden aus `mathematics/quantile.ts` exportiert.

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

`G1` und `G2` sind unter drei bzw. vier Beobachtungen undefiniert, und die Stichprobenvarianz sowie die Standardabweichung sind unter `ddof = 1` unter zwei Beobachtungen undefiniert. Das wird als leeres `Optional` gemeldet statt als irreführende Null:

```typescript
useOf(1, 2, 3).toNumericStatistics().kurtosis().isEmpty();     // true  (G2 needs four observations)
useOf(1, 2).toNumericStatistics().skewness().isEmpty();        // true  (G1 needs three)
useOf(1).toNumericStatistics().variance().isEmpty();           // true  (ddof = 1 needs two)
useOf(1).toNumericStatistics().variance({ ddof: 0 }).get();    // 0
```

Die bigint-Ansichten akzeptieren dieselben Optionen und runden jedes Ergebnis auf ein ganzzahliges `bigint` zurück.

### 7.3 Fenster

Fenster legen die gepufferten Elemente erneut als Pipeline von Pipelines offen, sodass ein Fenster konsumiert werden kann, ohne es zuerst in ein Array zu materialisieren. Beide Formen enthalten ein letztes partielles Fenster.

```typescript
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[2,3],[3,4],[4]]

useFrom([1, 2, 3, 4]).toWindow().tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[3,4]]
```

---

<a id="8-the-index-model"></a>
## 8. Das Indexmodell

Ein Index ist ein `bigint`, der jedem Element anhängt. Operatoren **leiten** ihn **weiter**,
**indizieren** ihn **von Null neu** oder lassen Sie ihn **berechnen**.

Das geordnete Sammeln normalisiert jeden Index modulo der Elementanzahl und sortiert dann nach dem
Ergebnis. Deshalb ist `translate(7)` auf fünf Elementen gleich `translate(2)`: `7 ≡ 2 (mod 5)`.

Das ungeordnete Sammeln behält jeden Index, den die Pipeline erzeugt hat, und gibt Elemente in
Ankunftsreihenfolge zurück. Negative Indizes sind zulässig und sortieren nach der Normalisierung
schlicht vor den nicht-negativen.

---

<a id="9-the-asynchronous-model"></a>
## 9. Das asynchrone Modell

`AsynchronousSemantic` spiegelt die synchrone Oberfläche und gibt Promises zurück. Schreibzugriffe
werden in eine Warteschlange gestellt, sodass ein nach einem Schreibzugriff ausgelöster Lesezugriff ihn
stets beobachtet.

```typescript
const ring = new AsynchronousRing([1, 2]);
const added   = ring.add(3);          // queued
const sampled = ring.elementAt(2n);   // observes the write above
await added;
(await sampled).get().element;         // 3
```

Fabriken, die von Natur aus asynchron sind — `usePromise`, `useBlob`, `useInterval`,
`useSubscription` — geben direkt `AsynchronousSemantic` zurück, und `useFrom` / `useIterate` stufen
sich selbst hoch, wenn ihnen ein `AsyncIterable` übergeben wird.

---

<a id="10-periodic-analysis-rings-fields-and-scores"></a>
## 10. Periodische Analyse: Ringe, Felder und Scores

Die mathematische Hälfte der Bibliothek behandelt einen Zyklus als erstklassiges Objekt und nicht als
Nachschlagetabelle. Drei Konstruktionen wirken zusammen.

### 10.1 Ein Ring ist eine ganze Zahl

Ein `Ring` ist ein **n-facher Ring**: Elementanzahl, Positionsperiode und die Anzahl unterscheidbarer
Phasen sind dieselbe ganze Zahl `n`. Die Phase einer Position wird aus ihrem exakten Rest berechnet,
sodass der Ring bis auf das Bit periodisch ist:

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

`frequency` ist die **umgebende** Rotationsrate, kein Phasenschritt zwischen Positionen: Die Umgebung
bewegt jeden Phasor um denselben Winkel, kann das intrinsische Muster also nie brechen. `span` legt
fest, wie viele Umdrehungen der Ring einnimmt.

`purity()` ist der Energieanteil der Grundmode, `max(|c₁|², |c_{n−1}|²) / (n · Σ|z|²)`. Er ist genau
dann `1`, wenn der Ring bis auf Rotation die `n`-ten Einheitswurzeln ist, und er kostet `O(n)`, weil
nur zwei Bins benötigt werden. Beide Richtungen werden geprüft, da ein Ring den Kreis in beide
Richtungen durchlaufen kann.

### 10.2 Ein Feld ist ein beschränkter Score

Ein `PhaseField` bildet eine relative Phase auf einen Score in `[-1, 1]` ab:

```typescript
import { useField, useRadian } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ): +1 aligned, −1 opposed
const mixed  = useField([0.4, 0.3, 0.3]);  // first three harmonics

cosine.sample(useRadian(0));               //  1
cosine.sample(useRadian(Math.PI));         // -1
```

Der Score ist eine abgebrochene Kosinusreihe, `a₀ + Σ wₘ·cos(2πmΔ)`, und der Konstruktor erzwingt
`|a₀| + Σ|wₘ| ≤ 1`. Nach der Dreiecksungleichung kann der Score `[-1, 1]` niemals verlassen — die
Schranke ist eine **Konsequenz der Konstruktion**, kein nachträglich angewendetes Clamping.

Der Grund, warum das Feld eine Reihe und keine Tabelle ist: Eine Tabelle mit `n` Punkten reproduziert
ihre eigenen Stützstellen exakt, ihr trigonometrisches Interpolant schießt dazwischen jedoch über. Eine
Fünf-Punkt-Tabelle mit den Scores `[+1, +0.5, −1, −0.5, 0]` interpoliert über `[−1.0428, 1.0041]`, was
das Versprechen bereits bricht. Eine beschränkte Reihe kann das nicht.

### 10.3 Die Analyse misst Daten gegen jedes Element

Jedes Ringelement ist eine Referenzphase. `analyse` verortet jede Beobachtung wieder auf dem Ring und
misst sie gegen jede Referenz:

```typescript
const ring = new SynchronousRing(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                              // 5
report.missed;                               // 1  ('zz' is not on the ring)
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

Jede Referenzzeile meldet `count`, die mittlere relative Phase `mean` und die mittlere Resultantenlänge
`resultant`. Eine Identität lohnt sich zu merken: **`resultant` ist für jede Referenz gleich**, weil
eine geänderte Basis alle relativen Phasen nur um eine Konstante rotiert. Pro Referenz unterscheiden
sich der Count und der Mittelwert.

```typescript
const ring = new SynchronousRing(["a", "b", "c"]);
ring.scoresAt(0, cosine);                   // one score per position, in [-1, 1]
```

### 10.4 Verwandte Instrumente

| Aufruf | Beantwortet | Kosten |
| :--- | :--- | :--- |
| `purity()` | ist der Ring noch die `n`-ten Einheitswurzeln? | O(n) |
| `resultant(t?)` | wie konzentriert sind die Phasoren gerade jetzt? | O(n) |
| `analyse(data)` | wie liegen diese Daten gegen jedes Element? | O(n · m) |
| `toSpectrum()` | der Ring als Spektrum, Wellenzahl auf der Frequenzachse | O(n²) |
| `useAngularSpectrum(ring, instants, plan)` | die `(ω, n)`-Ebene über die Zeit | O(n² · frames) |

Zwei weitere Primitive runden das Modell ab: `combineRings(a, b)` verbindet zwei Ringe auf ihrem
kleinsten gemeinsamen Vielfachen (ein Pullback, kein Produkt — die Paare, die sich keinen Zeitpunkt
teilen können, fehlen schlicht), und `rate()` gibt jedem Element seine eigene intrinsische Frequenz,
sodass ein Ring gegen die Umgebung driften kann. `jetAt`, `windingAt` und `errorIntegralAt` legen den
differentiellen Zustand dieser Drift offen.

### 10.5 Spektrale Fenster

Die Ringkonstruktionen sind die eine Hälfte der analytischen Oberfläche; die andere arbeitet an abgetasteten Signalen. Ihr meistgenutztes Primitiv ist das Fenster, und jede Form hier hat zwei Varianten. Die symmetrische Variante teilt den Frame durch `count − 1`; die periodische (DFT-gerade) Variante teilt ihn durch `count`, einen Abtastwert weniger als eine volle Periode, sodass die Ausblendung unter der periodischen Fortsetzung, die die DFT annimmt, stetig ist.

```typescript
useHannWindow(1, 4);                                   // 0.75  symmetric
useHannPeriodicWindow(1, 4);                           // 0.5   periodic
coherentGain(useHannPeriodicWindow, 16);               // 0.5
equivalentNoiseBandwidth(useHannPeriodicWindow, 16);   // 1.5
```

| Form | Symmetrisch | Periodisch | Anmerkungen |
| :--- | :--- | :--- | :--- |
| Rechteck | `useRectangularWindow` | — | keine Ausblendung; keine periodische Unterscheidung |
| Hann | `useHannWindow` | `useHannPeriodicWindow` | der Standard der Kurzzeitanalyse |
| Hamming | `useHammingWindow` | `useHammingPeriodicWindow` | — |
| Blackman | `useBlackmanWindow` | `useBlackmanPeriodicWindow` | — |
| Nuttall | `useNuttallWindow` | `useNuttallPeriodicWindow` | viergliedriges Blackman–Harris |
| Flat-Top | `useFlatTopWindow` | `useFlatTopPeriodicWindow` | Amplitudengenauigkeit vor Auflösung |
| Kaiser | `useKaiserWindow(beta)` | `useKaiserPeriodicWindow(beta)` | `beta` bestimmt die Hauptkeulenbreite |

Verwenden Sie die periodische Variante für Analyse und Overlap-Add: Bei einem Halbframe-Hop summiert das periodische Hann-Fenster bei jeder Länge zu `1.000000`, während die symmetrische Variante bei `N = 16` um `0.841 dB` und bei `N = 1024` noch um `0.013 dB` wellig ist. Für den Filterentwurf bleibt die symmetrische Variante richtig, wo der Frame nicht eine Periode der Ausblendung ist.

Die Flat-Top-Fenster liefern an den Frame-Enden **negative Gewichte**, weil ein Flat-Top-Fenster genau das ist. Sie werden unverändert zurückgegeben statt abgeschnitten, denn Abschneiden stört die Hauptkeule und zerstört den geringen Scalloping-Verlust, um dessentwillen das Fenster existiert:

```typescript
useFlatTopWindow(0, 1024);                             // -0.000421 — negative by definition
Array.from({ length: 1024 }, (_unused, index) => useFlatTopWindow(index, 1024))
  .filter(weight => weight < 0).length;                // 578
```

### 10.6 Pegel, Flachheit und Bandenergie

`decibel` ist als einzelne Funktion verschwunden, weil Amplitude und Leistung keinen gemeinsamen Faktor teilen. `amplitudeDecibel` wendet `20·log10` auf ein spannungsartiges Verhältnis an; `powerDecibel` wendet `10·log10` auf eine Leistung, eine Energie, ein mittleres Quadrat oder eine spektrale Leistungsdichte an:

```typescript
amplitudeDecibel(0.25);                                // -12.0412
powerDecibel(0.25);                                    //  -6.0206
```

`Bin.decibel` und `Spectrum.decibelOf` sind Amplitudenpegel; `Spectrum.powerDecibelOf` ist der passende Leistungspegel. Eine Leistung an die Amplitudenform zu geben, meldet `20·log10(power)` und verdoppelt den Pegel in Dezibel.

Zwei Spektrummessungen haben die Lesart gewechselt:

```typescript
const twoBins = new Spectrum(new Sample(2, 1), [new Complex(2, 0), new Complex(1, 0)]);
twoBins.flatness();                                    // 0.8 — geometric over arithmetic mean of power

const shape = new Spectrum(new Sample(4, 1), [
  new Complex(1, 0), new Complex(2, 0), new Complex(0, 0), new Complex(0, 0),
]);
shape.bandEnergy(new Frequency(0), new Frequency(2));                // 9
shape.bandEnergy(new Frequency(0), new Frequency(2), "two-sided");   // 5
```

`flatness()` vergleicht das geometrische und das arithmetische Mittel von `power()` über die einseitige Hälfte des Spektrums, nicht das Betragsmittel über beide Hälften, und die reine Anzeigeverdopplung von `oneSided()` wird bewusst nicht angewandt. `bandEnergy()` nutzt standardmäßig die einseitige Lesart und faltet die konjugierte Hälfte, sodass DC und Nyquist einfach und jeder innere Bin doppelt zählen; ein Band über die gesamte Achse erfüllt dann Parseval, `Σ|X|² = N·Σx²`. Übergeben Sie `"two-sided"` für ein komplexes Spektrum, dessen Bins bereits unabhängig sind.

### 10.7 Kurzzeitanalyse

`Sampler.shortTimeFourierTransform` und `Sampler.spectrogram` folgen den SciPy-`stft`-Konventionen: periodisches Hann-Fenster, eine mit Nullen gefüllte Grenze an beiden Enden und ein mit Nullen gefüllter Schwanz.

```typescript
const sampler = new Sampler(new Sample(64, 1));
const spectrogram = sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8);

spectrogram.size();                     // 9 frames
spectrogram.getBoundary();              // "zeros"
spectrogram.getTime(6);                 // 0.75 — frame centres, not frame starts
sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8, useHannWindow,
  { boundary: "none", padded: false }).size();                       // 7 — complete frames only
```

Die Erweiterung zentriert den ersten Frame auf den ersten Abtastwert, und die Schwanzauffüllung hält die letzten Abtastwerte erreichbar: 64 Abtastwerte bei Frame 16 und Hop 8 ergeben 9 Frames statt 7, und 1000 Abtastwerte bei Frame 256 und Hop 128 ergeben 9 statt 6. Frame-Zeiten sind Mitten — `(k·hop + (frameSize mod 2)/2)/rate` für eine erweiterte Ansicht, `(k·hop + frameSize/2)/rate` für eine nicht erweiterte — und `toFrame()` schneidet die Erweiterung vor der Inversion ab.

---

<a id="11-utility-helpers"></a>
## 11. Hilfsfunktionen

### 11.1 Die Fehlerhierarchie

`structure/error.ts` exportiert eine Hierarchie aus fünfzehn Klassen für die Fehler, die *rund um* eine Pipeline entstehen — in Ihrem eigenen Code, einem eigenen Collector oder einem Adapter:

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

Jede Klasse legt `name` fest, reicht die native `cause` weiter, trägt eine optionale `context`-Tasche und serialisiert über `toJSON()`; jede hat einen gleichnamigen Brand-Guard.

```typescript
const error = new CapacityError("LRU capacity exhausted", { context: { capacity: 0 } });

error.name;                 // "CapacityError"
isCapacityError(error);     // true
isValidationError(error);   // false — a capacity failure is not a validation failure
isSemanticError(error);     // true
error.toJSON();             // { name: "CapacityError", message: "…", context: { capacity: 0 } }
```

`SemanticRangeError` ist dieselbe Klasse wie das exportierte `RangeError`, sodass `instanceof` über beide Namen hinweg gilt; ein Import von `RangeError` verdeckt den globalen Konstruktor für das ganze Modul, und deshalb existiert der Alias. Keine der beiden Klassen wird von den Argumentprüfungen der Bibliothek geworfen, die weiterhin native `TypeError` und `RangeError` auslösen — die Hierarchie ist das Vokabular für die Ebene darüber.

### 11.2 Hilfstabelle

| Hilfsfunktion | Zweck |
| :--- | :--- |
| `useCompare(a, b)` | Totale Ordnung über gemischte Primitive hinweg |
| `useToNumber` / `useToBigInt` | Verlustfreie, bereichsgeprüfte numerische Konvertierung |
| `useRandom` | Zufallshelfer mit oder ohne Seed |
| `useTraverse` | Struktureller Durchlauf verschachtelter Objekte und Arrays |
| `useStringify` | Zyklussichere JSON-Serialisierung |
| `useHash` / `maskOf` / `register` / `unregister` | Strukturelles Hashing und die Registry der Hash-Strategien |
| `invalidate` / `validate` | Guard-Klauseln, die eine konsistente Fehlerform auslösen |
| `Optional<T>` | Der `null`-Ersatz der Bibliothek: `Optional.of(x)` / `Optional.empty()` |

### 11.3 `useTraverse`

`useTraverse(target, callback)` flacht jedes Objekt zu seinen **Nicht-Null-Blättern** ab. Es steigt in verschachtelte Objekte hinab, durchläuft iterierbare Werte nach Position, überspringt `null` und `undefined` und betritt ein bereits besuchtes Objekt nie erneut — ein Objektgraph mit einem Zyklus endet also, statt den Stack zu sprengen.

```typescript
const source = { id: 7, tags: ["a", "b"], owner: { name: "Ada", note: null } };
const leaves: string[] = [];

useTraverse(source, (key, value, path) => {
  leaves.push(`${path.join(".")} = ${String(value)}`);
  return true;
});

leaves;   // ["id = 7", "tags.0 = a", "tags.1 = b", "owner.name = Ada"]
```

Der Callback läuft einmal pro Blatt und erhält den eigenen Schlüssel des Blatts (bei einem iterierbaren Wert dessen Index), den Wert und den Pfad dorthin. Die Rückgabe `false` gibt die **gesamte** Traversierung auf, nicht nur den aktuellen Zweig:

```typescript
let visited = 0;
useTraverse({ a: 1, b: 2, c: 3 }, () => {
  visited += 1;
  return false;
});
visited;   // 1 — the first leaf already stops the walk
```

Aus demselben Grund ist ein Zyklus ungefährlich:

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

**Jeder Callback erhält seinen eigenen Pfad-Schnappschuss.** Der Durchlauf hält intern nur ein Arbeitsarray und kopiert es in dem Moment, in dem ein Blatt übergeben wird, in ein neues, mit `Object.freeze` eingefrorenes Array. Der Schnappschuss ändert sich danach nicht mehr, kann also unverändert behalten werden; zwei Callbacks teilen sich nie ein Array, und ein erneuter Durchlauf stört bereits ausgegebene Schnappschüsse nicht. Sein Typ ist `ReadonlyArray`, ein Schreibzugriff ist daher ein Compile-Fehler, und auf dem eingefrorenen Array wirft er zur Laufzeit zusätzlich einen `TypeError`. Diese Sicherheit kostet eine `O(depth)`-Allokation pro gemeldetem Blatt; ein Zweig, der nichts meldet, allokiert nichts zusätzlich.

```typescript
const paths: Array<ReadonlyArray<PropertyKey>> = [];
useTraverse({ a: { b: 1 }, c: 2 }, (_key, _value, path) => {
  paths.push(path);                      // safe to keep as-is
  return true;
});
paths[0] === paths[1];                   // false — one array per call
paths.map(path => path.join("."));       // ["a.b", "c"]
```

`useAttribute` ist dieser Durchlauf als Fabrik: Sie meldet dieselben Blätter als `{ key, value }`-Paare, also sind Regeln und Kosten identisch.

```typescript
useAttribute({ a: 1, b: { c: 2 } }).toUnordered().toArray();
// [{ key: "a", value: 1 }, { key: "c", value: 2 }]
```

---

<a id="12-performance-and-pitfalls"></a>
## 12. Leistung und Fallstricke

**Trägheit hat einen Preis pro Stufe.** Jeder Operator fügt einen Generator-Hop hinzu. Für enge
numerische Schleifen über In-Memory-Arrays schlägt eine schlichte `for`-Schleife jede Pipeline; die
Pipeline gewinnt, wenn die Quelle träge oder unendlich ist oder die Pipeline lang genug ist, damit sich
die Index-Disziplin auszahlt.

**`toOrdered()` sortiert; `toUnordered()` nicht.** Wenn eine Umkehrung „nicht funktioniert" zu haben
scheint, war der Collector ungeordnet — das Umschreiben von Indizes wird erst dann zu einer Reihenfolge,
wenn die Indizes normalisiert werden.

**`useGenerate` ohne `interrupt` endet nie.** Geben Sie stets ein stoppendes Prädikat oder ein
nachgelagertes `limit` / `takeWhile` an.

**`Ring` ist ein einfügungsgeordnetes Set.** Elemente sind eindeutig und behalten die Reihenfolge, in
der sie zuerst hinzugefügt wurden. Ein doppeltes `add` gibt `false` zurück, und ein `set`, das einen
Doppelgänger einführen würde, wirft. Genau das erlaubt es, eine Phase als Funktion des *Elements* zu
behandeln und nicht der Position, die es gerade zufällig einnimmt.

**`Spectrum` setzt in seinen einseitigen Helfern ein reelles Signal voraus.** `oneSided()`,
`getNyquist()` und `centroid()` unterstellen konjugierte Symmetrie. Das räumliche Spektrum eines
Phasenrings ist komplex und im Allgemeinen nicht symmetrisch — ein Ring, der den Kreis rückwärts
durchläuft, legt seine gesamte Energie in Bin `n − 1`, jenseits von Nyquist. Lesen Sie die Bins direkt.

**Struktur-Collectors sind Terminals, keine Ansichten.** Jeder leert die Pipeline und baut dann eine vollständige Struktur auf; er kostet also O(n) Zeit und O(n) Speicher und läuft nicht auf einer unendlichen Quelle. Verwenden Sie einen am Ende einer Pipeline, niemals innerhalb einer Schleife über eine Pipeline.

**`variance()` und seine Verwandten geben ein `Optional` zurück.** `variance().get()` auf einer zu kleinen Stichprobe wirft; verwenden Sie `.orElse(0)` oder prüfen Sie `.isPresent()`, wenn die Stichprobengröße nicht in Ihrer Hand liegt. Dasselbe gilt für `standardDeviation`, `quantile`, `interquartileRange`, `skewness` und `kurtosis`.

**Die periodischen Fenster sind die Analysefenster.** `useHannWindow` und die anderen symmetrischen Formen sind für den Filterentwurf gedacht; eine Kurzzeitanalyse will `useHannPeriodicWindow` und seine Geschwister, sonst ist die Overlap-Add-Summe an jeder Fuge der Frames wellig.

---

<a id="13-phase-rings"></a>
## 13. Phasenringe: ein exakter Zyklus

Kapitel 10 führte den Ring als Modell eines Zyklus ein und nutzte ihn, um einen Datensatz gegen jede
Phase zu messen. Dieses Kapitel ist die vollständige Oberfläche: wie aus einer Position ein Winkel
wird, was die Umgebungsfrequenz ändert und was nicht, und die Instrumente, die den Ring gegen die
Zeit, gegen Daten und gegen einen anderen Ring lesen.

Ein `SynchronousRing` ist eine Positionsliste, unterlegt von einem kreisförmigen doppelt
verketteten Ring, dessen Kopf und Schwanz verbunden sind. Er ist zugleich eine einfügungsgeordnete
*Menge*: kein Element erscheint zweimal, und ein abgelehnter Schreibvorgang lässt sowohl die
Verkettung als auch die Abtastwerte unberührt. Zum Ring statt zur bloßen Liste macht ihn, dass die
Phase einer Position eine reine Funktion ihres Restes modulo der aktuellen Länge ist; deshalb ist
der Ring bitgenau periodisch, und seine Balance kann nicht driften.

### 13.1 Ein Ring ist eine ganze Zahl, exakt berechnet

Ein Ring trägt `n` Elemente, und Elementanzahl, Positionsperiode und Anzahl verschiedener Phasen
sind dieselbe ganze Zahl. Position `i` trägt

`phase + span · 2π · (((i mod n) + n) mod n) / n`

wobei der Rest in `bigint` reduziert wird, bevor er je eine `number` wird. Genau deshalb sind
`phaseAt(i)` und `phaseAt(i + n)` *identisch* und nicht bloß ähnlich: Der zweite Aufruf reduziert
auf dieselbe ganze Zahl, wertet dasselbe Produkt aus und erzeugt dasselbe Double. Ein Index weit
jenseits des exakten Ganzzahlbereichs von `number` landet noch auf der richtigen Position, und ein
negativer Index läuft den Ring rückwärts.

| Aufruf | Rückgabe | Bedeutung |
| :--- | :--- | :--- |
| `new SynchronousRing(source, options?)` | Ring | `source` ist ein beliebiges Iterable, Duplikate entfallen |
| `getPhase()` / `getFrequency()` / `getSpan()` | `Angle`, `Frequency`, `number` | die drei Konstruktionsparameter |
| `size()` | `bigint` | das `n`, das zugleich die Periode ist |
| `phaseAt(index)` | `Optional<Angle>` | nur die intrinsische Phase; ignoriert Zeit, Rate und Frequenz |
| `elementAt(index)` | `Optional<RingElement>` | Element, intrinsische Phase, Umgebungsfrequenz, Zeiger |
| `frequencyAt(index)` | `Optional<Frequency>` | die Umgebungsrate, leer bei leerem Ring |
| `toComplex()` / `toComplex(index)` | `Complex[]` / `Optional<Complex>` | intrinsische Zeiger |

`RingOptions` ergänzt zwei Funktionen pro Element: `magnitude(element, index)` liefert die
Zeigerlänge und ist standardmäßig eins, `rate(element, index)` gibt dem Element seine eigene
intrinsische Frequenz und ist standardmäßig null, also eine feste Markierung.

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

`phaseAt(-1n)` ist bei einem Ring aus sechs Elementen `300`, und `10n ** 20n` reduziert modulo
sechs auf `4`, liest sich also als `240`. Keiner der Fälle akkumuliert ein Fließkommaprodukt; das
hält die Identität exakt, auch wenn sich die Indexdarstellung ändert.

### 13.2 Die Umgebungsfrequenz und der Zustand zu einem Zeitpunkt

`frequency` ist die **Umgebungsrotationsrate** der Umgebung, in die der Ring eingebettet ist, kein
Phasenschritt zwischen Positionen. Die Umgebung verschiebt die Phase jedes Elements um denselben
Winkel, kann also das intrinsische Muster nicht ändern, die Balance nicht brechen und kein
`phaseAt`-Ergebnis verändern. Der Standard ist `0 Hz`.

`relativeAt(index, time)` zieht diesen gemeinsamen Winkel ab und hinterlässt die Koordinate, gegen
die ein `PhaseField` bewertet wird. `viewAt` und `viewsAt` liefern den vollen Zustand zu einem
Zeitpunkt samt der eigenen `rate` des Elements, und die Differential-Zugriffe legen die Drift frei:

| Aufruf | Formel | Liest |
| :--- | :--- | :--- |
| `relativeAt(index, time)` | `intrinsisch + eigeneRate · t − Umgebung · t` | die Phase, die die Umgebung sieht |
| `viewAt(index, time)` / `viewsAt(time)` | dasselbe plus Element, Index, Zeit, Rate, Zeiger | der volle Zustand |
| `jetAt(index, time)` | Phase bei `t`, eigene Rate, `slip = eigeneRate − Umgebung` | der Differentialzustand |
| `windingAt(index, time)` | `trunc(slip · t)` | ganze Umdrehungen Schlupf, gegen null abgeschnitten |
| `errorIntegralAt(index, time, origin?)` | `∫ relative Phase dt`, in Umdrehungen · Sekunden | wie lange ein Element voraus war |
| `resultant(time?)` | `abs(Σ w · e^{iθ}) / Σ w` | Phasenkonzentration, von Umgebungsrotation unberührt |
| `analyse(data, time?)` | Zählungen und Mittel je Referenz | Daten gegen jedes Element gemessen |
| `scoreAt(index, time, field)` / `scoresAt(time, field)` | das Feld an der relativen Phase abgetastet | ein beschränkter Score je Position |

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

Bei `1 Hz` rückt die Umgebung in `0.25 s` um eine Vierteldrehung vor, die relative Phase von
Position eins ist also `60 − 90 = 330` Grad, während ihre intrinsische Phase `60` bleibt. Der Jet
meldet `slip` von `-1` Hertz, weil das Element selbst ruht, und `purity()` ist weiterhin `1`: Alle
Zeiger um denselben Winkel zu drehen ist keine Verformung.

### 13.3 Reinheit und Balance

`purity()` ist der Energieanteil des Rings, den die Grundmode trägt:

`max(abs(c₁)², abs(c_{n−1})²) / (n · Σ abs(z)²)`

Beide Grundbins werden geprüft, weil ein Ring den Kreis in beide Richtungen durchlaufen kann. Ein
Ring mit `span: 5` über sechs Elemente schreitet um `300` Grad, also `−60` Grad: Er läuft rückwärts,
legt seine ganze Energie in `c₅` und würde von einer Formel, die nur `c₁` betrachtet, als unrein
gemeldet. Die Kosten bleiben `O(n)`, weil nur diese beiden Bins und die Gesamtenergie gebraucht
werden.

Die Randfälle gehören zum Vertrag. Ein Ring mit weniger als zwei Elementen hat keine Grundmode und
meldet `purity() === 0` und `isBalanced() === false`, unabhängig vom Inhalt. Ein Ring, dessen
Zeiger alle die Länge null haben, hat keine Energie und meldet ebenfalls null. `isBalanced(epsilon?)`
ist `1 − purity() <= epsilon`, mit `1E-9` als Standardtoleranz.

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

### 13.4 Resultierende Länge und die Symmetriekomponenten

`resultant(time?)` ist die mittlere resultierende Länge: der Betrag der Zeigersumme geteilt durch
die Summe der Beträge. Anders als `purity`, das fragt, ob der Ring noch die `n`-ten Einheitswurzeln
ist, fragt `resultant`, wie konzentriert die Zeiger gerade sind. Ein balancierter Ring meldet `0`;
ein Ring, dessen Elemente alle einen Winkel teilen, meldete `1`, aber die Mengensemantik verbietet
Duplikate, sodass `1` praktisch erscheint, wenn `magnitude` alle bis auf ein Element nullt.

`zeroSequence()` ist der mittlere Zeiger, also `c₀ / n`. `sequences()` liefert alle `n`
Symmetriekomponenten, niedrigste Ordnung zuerst, über eine direkte Transformation. `toSpectrum()`
packt sie in ein `Spectrum`, dessen Bin `j` `j` Zyklen pro Ringumdrehung meldet, sodass die
Frequenzachse die Wellenzahlachse ist.

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

Die Komponenten sind komplex und im Allgemeinen **nicht konjugiert-symmetrisch**: Ein balancierter
Ring legt seine ganze Energie in Bin eins, ein rückwärts laufender in Bin `n − 1`. Die einseitigen
Hilfsfunktionen von `Spectrum` setzen ein reelles Signal voraus; lies die Bins direkt, statt sie zu
falten.

### 13.5 Daten gegen jedes Element analysieren

`analyse(data, time?)` ordnet jede Beobachtung über Identität dem Ring zu und misst sie gegen jedes
Element als Referenzphase. Beobachtungen, die der Ring nicht hält, werden als `missed` gezählt statt
geraten, denn der Ring ist die einzige Quelle von Phasen. Jede Referenzzeile meldet `count`, die
mittlere relative Phase `mean` und die mittlere resultierende Länge `resultant`.

Eine Identität lohnt sich zu merken: **`resultant` ist für jede Referenz gleich**. Eine andere
Basis dreht alle relativen Phasen um eine Konstante, und eine Drehung kann eine resultierende Länge
nicht ändern. Was sich je Referenz unterscheidet, sind Zählung und Mittel.

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

Bewertung ist die andere Seite derselben Medaille. Ein `PhaseField` ist eine beschränkte
Kosinusreihe (Kapitel 10.2), und `scoreAt`/`scoresAt` tasten sie an der relativen Phase ab, sodass
derselbe Ring gegen Ausrichtung, gegen ein harmonisches Muster oder gegen ein beliebiges Feld
bewertet werden kann, ohne den Ring zu ändern.

```typescript
import { SynchronousRing, useField } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const ring = new SynchronousRing(["a", "b", "c", "d", "e", "f"]);
const cosine = useField([1]);

round(ring.scoreAt(0n, 0, cosine).get());                                  // 1
round(ring.scoreAt(1n, 0, cosine).get());                                  // 0.5
ring.scoresAt(0, cosine).map(score => round(score));                       // [1, 0.5, -0.5, -1, -0.5, 0.5]
```

### 13.6 Ringe kombinieren und das Winkelspektrum

`combineRings(left, right)` verbindet zwei Ringe über ihr kleinstes gemeinsames Vielfaches, nicht
über ihr Produkt. Instant `i` des gemeinsamen Rings liest `i mod m` des linken und `i mod n` des
rechten Rings, sodass der gemeinsame Ring nach `lcm(m, n)` Instants schließt. Die Paare, die nie
gemeinsam auftreten können — deren Positionen modulo `gcd(m, n)` nicht übereinstimmen —, fehlen
einfach; deshalb ist das Ergebnis ein Pullback und kein Produkt, und `aligns(left, right)` meldet,
ob ein gegebenes Paar darstellbar ist.

`useAngularSpectrum(ring, instants, plan)` baut die `(ω, n)`-Ebene: Jeder Instant trägt einen Frame
von Zeigern bei, Frame `k` der Mode `j` ist die `j`-te Symmetriekomponente dieses Frames, und
`cells[frame][order]` ist der Koeffizient. Eine Spalte zu nehmen ergibt die Zeitreihe einer
einzigen räumlichen Mode, und `spectrum(order)` ist ihr zeitliches Spektrum.

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

### 13.7 Fallstricke

**Exaktheit ist exakt.** `phaseAt(i)` und `phaseAt(i + n)` sind dasselbe Double, nicht zwei Werte
innerhalb einer Toleranz. Ein Ring, der pro Element `2π / n` akkumuliert, würde das verfehlen;
dieser reduziert den Index zuerst in `bigint`.

**`frequency` ist kein Phasenschritt.** Es ist die Umgebungsrotationsrate, standardmäßig null, und
alle Zeiger um denselben Winkel zu drehen kann das intrinsische Muster nicht brechen. Wenn sich
Positionen relativ zueinander bewegen sollen, nutze `rate`, nicht `frequency`.

**`purity()` muss beide Grundbins betrachten.** Ein rückwärts laufender Ring ist noch immer die
`n`-ten Einheitswurzeln; nur `c₁` würde ihn für unrein erklären.

**`n < 2` ist ein definierter Randfall.** `purity()` liefert `0` und `isBalanced()` `false`; ein
leerer Ring liefert leere Optionals aus den Abtastmethoden.

**Ein Span, der einen Faktor mit `n` teilt, kollabiert die Umlaufbahn.** Sechs Elemente mit
`span: 2` besuchen nur drei verschiedene Phasen, und der Ring ist nicht mehr balanciert.

**`resultant` ist rotationsinvariant, nicht zeitinvariant.** Die Umgebungsrotation lässt ihn
unverändert; Raten pro Element ändern ihn, während der Ring aus der Phase läuft.

**Der Ring ist eine Menge, und `analyse` ordnet über Identität zu.** Duplikate entfallen bei der
Konstruktion, und ein Objekt, das einem Ringelement strukturell gleicht, aber nicht dieselbe
Referenz ist, zählt als verfehlt.

**`toSpectrum()` ist komplex.** Seine Bins sind nicht konjugiert-symmetrisch, die einseitigen
Hilfsfunktionen von `Spectrum` greifen also nicht. Lies die Bins.

**`windingAt` schneidet gegen null ab, und `errorIntegralAt` integriert die Phase.** Ein halber
Umlauf Schlupf meldet `0n`; das Fehlerintegral ist in Umdrehungen · Sekunden, keine Rate.

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
## 14. Signalanalyse: Fenster, Spektren und Zeit

Kapitel 10 behandelte einen Ring als Zyklus von Phasen. Dieses Kapitel ist das zeitliche
Gegenstück: eine reellwertige Aufzeichnung, die neben ihren Abtastwerten den beiden Kontext
mitführt, den jede Spektralformel braucht — den Abtastplan, der einen Bin-Index in Hertz
verwandelt, und die Fensterfunktion, die sowohl den kohärenten Gewinn als auch die
Rauschbandbreite festlegt.

Das Wertobjekt ist `SynchronousSignalCollectable`, sein eingereihtes Gegenstück ist
`AsynchronousSignalCollectable`. Beide bieten dieselbe `SignalCollectable`-Oberfläche:
dreiundzwanzig Methoden, jede delegiert an genau eine `useSynchronous<Method>`-Fabrik in
`synchronous/collectors`. Die Trennung ist Absicht. Die Klasse ist eine dokumentierte Fassade,
die Fabrik besitzt die Akkumulation, und der Konstruktor berechnet `sum(w) / count` und
`count * sum(w^2) / sum(w)^2` einmal, bei dieser Länge. Wer sich merken muss, „durch den
kohärenten Gewinn zu teilen", vergisst es irgendwann, und die daraus folgenden 6,02 Dezibel
sehen nach einer plausiblen Messung aus.

### 14.1 Ein Signal trägt seine eigene Kalibrierung

Ein Signal entsteht aus einem Iterable und einer Rate, aus einem vorhandenen `Frame` oder über
den Konstruktor mit einem expliziten `Sample`. Das Standardfenster ist das periodische
Hann-Fenster; jede Analyse ohne eigenes Fenster verwendet es, und jede Analyse akzeptiert eine
Überschreibung. Die Metadaten-Zugriffe lesen Zustand, der beim Bauen festgeschrieben wurde, in
konstanter Zeit, sodass ein Signal weitergereicht werden kann, ohne dass der Kontext driftet.

| Aufruf | Rückgabe | Bedeutung |
| :--- | :--- | :--- |
| `SynchronousSignalCollectable.useRate(values, rate, window?)` | Signal | Dauer `count / rate` |
| `SynchronousSignalCollectable.useFrame(frame, window?)` | Signal | behält den Plan des Frames |
| `new SynchronousSignalCollectable(plan, values, window?)` | Signal | Frame-Zahl muss der Abtastwertzahl entsprechen |
| `getSample()` / `getValues()` / `getWindow()` | Plan, Werte, Fenster | der eingefrorene Kontext |
| `getRate()` | `number` | Abtastwerte pro Sekunde |
| `getNyquist()` / `getResolution()` | `Frequency` | `rate / 2` und `rate / count` |
| `getCoherentGain()` / `getNoiseBandwidth()` | `number` | bei genau dieser Länge neu berechnet |
| `size()` / `at(index)` / `toFrame()` / `equals(other)` / `toString()` | — | Wertsemantik |

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

`getResolution()` ist der Bin-Abstand, nicht das Auflösungsvermögen: Er beträgt `rate / count`,
weil die Transformation `count` Bins hat, und Nullen-Auffüllen ändert den Abstand, nicht das,
was das Fenster trennen kann (Abschnitt 14.8).

### 14.2 Die dreiundzwanzig Methoden

Die Methoden bilden sechs Familien. Sieben sind Spektralmessungen, zwei sind Zeit-Frequenz-
Transformationen, vier sind analytische Größen, drei sind Folgestatistiken, fünf sind
Formbeschreibungen, und zwei liefern ein weiteres Signal.

| Methode | Rückgabe | Konvention |
| :--- | :--- | :--- |
| `spectrum(size?, window?)` | `Spectrum` | roh und unnormiert, volles komplexes Raster |
| `oneSided(size?, window?)` | `Bin[]` | konjugierte Hälfte gefaltet, DC und Nyquist nicht verdoppelt |
| `amplitude(window?)` | `number[]` | `2·abs(X) / (count · CG)`, DC und Nyquist einmal |
| `power(window?)` | `number[]` | `A² / 2` je innerem Bin, `A²` bei DC und Nyquist |
| `decibel(window?)` | `number[]` | `20·log10(Amplitude)` |
| `powerDecibel(window?)` | `number[]` | `10·log10(Leistung)` |
| `powerSpectralDensity(frameSize?, hopSize?, window?)` | `SpectralDensity` | Welch-Mittel, `abs(X)² / (rate · Σw²)` |
| `shortTimeFourierTransform(frameSize, hopSize, window?)` | `Spectrum[]` | Ränder erweitert, Zeiten als Frame-Mitten |
| `spectrogram(frameSize, hopSize, window?)` | `Spectrogram` | dieselben Spalten mit Zeitachse |
| `analyticSignal()` | `Complex[]` | Hilbert-Paar `x + i·H(x)` |
| `instantaneousPhase()` | `Angle[]` | in `[0, 2π)` gefaltet |
| `instantaneousFrequency(rate?, gate?)` | `number[]` | entfaltete Phasendifferenz, auf die Hüllkurve gegated |
| `envelope()` | `number[]` | `abs(z[n])`, an den Rändern zirkulär |
| `zeroCrossingRate(perSecond?)` | `number` | Nulldurchgänge pro benachbartem Wertepaar |
| `spectralFlux(frameSize?, hopSize?, window?)` | `number[]` | Betragsabstand normierter Frames |
| `autocorrelation(maximumLag?, normalization?)` | `number[]` | standardmäßig Koeffizient, `ρ[0] = 1` |
| `spectralCentroid(window?)` | `Optional<Frequency>` | leistungsgewichtete Mittelfrequenz |
| `spectralBandwidth(window?)` | `Optional<Frequency>` | leistungsgewichtete Standardabweichung |
| `spectralRolloff(ratio?, window?)` | `Optional<Frequency>` | erster Bin, der `ratio` der Leistung erreicht |
| `spectralFlatness(window?)` | `number` | geometrisches zu arithmetischem Mittel der Leistung |
| `signalToNoiseRatio(frameSize?, hopSize?, window?, floorQuantile?)` | `Optional<number>` | Median-Rauschboden, `10·log10` |
| `detrended(mode?)` | Signal | `"none"`, `"constant"` (Standard), `"linear"` |
| `windowed(window?)` | Signal | wendet ein Fenster an und übernimmt es |

Die optionalen Argumente sind keine Zierde. `frameSize` ist standardmäßig `min(256, size)`, der
Hop eine halbe Fensterlänge abgerundet, `instantaneousFrequency` gated bei `1E-3` der
Spitzenhüllkurve, und `spectralRolloff` nutzt `0.85`. Jeder Standard ist der Wert, den eine
Referenzimplementierung wählt, wenn der Parameter benannt, aber nicht übergeben wird.

### 14.3 Amplitude, Leistung und Dichte

Drei Normierungen sind nötig, weil drei verschiedene Fragen gestellt werden.

`amplitude()` beantwortet „wie groß ist der Sinus auf diesem Bin": `2·abs(X[k]) / (count · CG)`
für einen inneren Bin und `abs(X[k]) / (count · CG)` bei DC und Nyquist. Der Faktor zwei faltet
die konjugierte Hälfte, der kohärente Gewinn entfernt das Fenster. Fehlt eines von beiden, liest
ein Sinus mit Einheitsamplitude `0.5`, also minus 6,02 Dezibel.

`power()` beantwortet „welches mittlere Quadrat hätte ein Sinus auf diesem Bin": `A² / 2` für
einen inneren Bin und `A²` bei DC und Nyquist, weil diese beiden nicht schwingen. Das ist die
Peak-Konvention, und sie erfüllt bewusst nicht Parseval: Ein Fenster verteilt jede Linie über
seine Hauptkeule, sodass die Summe aller Bins das mittlere Quadrat um die äquivalente
Rauschbandbreite übersteigt — bei Hann um `1.5`.

`powerSpectralDensity()` beantwortet „wie viel Leistung pro Hertz": `abs(X)² / (rate · Σw²)`,
gemittelt über überlappende Segmente. Nur die Summe der quadrierten Gewichte hält einen
Weißrauschboden unverzerrt; Division durch `count` liest `0.375` für Einheitsrauschen, Division
durch `count · CG²` liest `1.5`.

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

Das Paar der Summen ist die Prüfung, die man sich merken sollte: Die Peak-Summe ist `0.75`,
während die Dichte zu `0.5` integriert, und das Verhältnis ist genau die Rauschbandbreite. Nur
die Dichte übersteht außerdem eine Änderung der Fensterlänge.

### 14.4 Pegel: die beiden Dezibel-Konventionen

Amplitude und Leistung teilen keinen Faktor, also auch keinen Logarithmus. `amplitudeDecibel`
wendet `20·log10` an und ist für Spannung, Auslenkung oder Schalldruck richtig; `powerDecibel`
wendet `10·log10` an und ist für Leistung, Energie, mittleres Quadrat oder Dichte richtig. Die
Methodennamen des Signals folgen derselben Trennung.

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

Beide Ablesungen desselben Tons sind korrekt: Seine Amplitude ist eins (null Dezibel), sein
mittleres Quadrat ist ein Halb (minus 3,01 Dezibel). Eine Leistung durch die Amplitude-Konvention
zu schicken verdoppelt den Pegel in Dezibel und macht aus den korrekten minus 6,02 die minus
12,04.

### 14.5 Die einseitige Faltung

Ein reelles Signal erfüllt `X[count − k] = conj(X[k])`, die negative Frequenzhälfte trägt also
keine unabhängige Information. Die Faltung verdoppelt jeden inneren Bin und lässt die beiden
selbstkonjugierten Bins — DC und, bei gerader Länge, Nyquist — genau so, wie die Transformation
sie erzeugt hat. Diese beiden sind ihr eigenes Spiegelbild; Verdoppeln erfindet Energie und
meldet exakt 6,02 Dezibel zu hoch.

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

Die rohen Beträge sind `16` und `8`, weil die Gewichte des Fensters sich zu acht summieren;
Division durch `count · CG = 8` macht daraus die kalibrierten Amplituden `2` und `1`. Würde man
die Randbins verdoppeln, läse man `4` und `2`, und der Fehler würde nie eine Ausnahme auslösen.

### 14.6 Zeit-Frequenz-Ansichten

`shortTimeFourierTransform` und `spectrogram` rahmen die Aufzeichnung so wie die referenzierte
Kurzzeit-Transformation: an beiden Enden eine halbe Fensterlänge Nullen, dann ein mit Nullen
aufgefüllter Schwanz, sodass eine ganze Zahl von Hops bleibt. Der erste Frame ist auf den ersten
Abtastwert zentriert, der letzte erreicht den letzten Abtastwert, und Frame `m` ist bei
`m · hop / rate` Sekunden zentriert. Nur vollständige Frames zu behalten würde bis zu
`frameSize − 1` Werte verwerfen — bei 1000 Werten, Fenster 256 und Hop 128 sind das 104 Werte,
etwa ein Zehntel der Aufzeichnung.

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

Jede Spalte ist ein `Spectrum` über `frameSize` Bins, genau wie es `spectrum()` für denselben
Frame liefern würde, und `getTime()` meldet Frame-Mitten statt Frame-Anfänge.

### 14.7 Fenster, kohärenter Gewinn und COLA

Jede Form hat zwei Varianten. Die symmetrische Variante teilt durch `count − 1`; die periodische
(DFT-gerade) Variante teilt durch `count`, einen Abtastwert weniger als eine volle Periode, sodass
die Fensterfunktion unter der periodischen Fortsetzung, die die DFT annimmt, stetig ist. Analyse
und Überlappungs-Addition brauchen die periodische Form; der Filterentwurf behält die
symmetrische.

Der Unterschied ist messbar und löst nie einen Fehler aus. Bei fünfzig Prozent Überlappung
summiert sich das periodische Hann-Fenster an jeder Position zu eins; die symmetrische Form
welligt, um `0.84` Dezibel bei sechzehn Werten, `0.21` bei vierundsechzig und immer noch `0.013`
bei eintausendvierundzwanzig. Die Klasse legt den kohärenten Gewinn und die äquivalente
Rauschbandbreite des Fensters offen, das sie hält, sodass die Korrektur nie fest verdrahtet ist:
Ein symmetrisches Hann liest `0.4375` bei acht Werten, nicht `0.5`.

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

Die Flat-Top-Zeile ist kein Fehler in der Tabelle. Ein Flat-Top-Fenster ist per Definition
teilweise negativ — hier sind 578 von 1024 Gewichten negativ —, und das Abschneiden auf null
würde die Hauptkeule stören und den geringen Scalloping-Verlust zerstören, für den das Fenster
existiert. Die Bibliothek gibt die Reihe unverändert zurück.

### 14.8 Fallstricke

**Nullen-Auffüllen interpoliert, es löst nie auf.** Eine Transformationslänge über der
Abtastwertzahl tastet dieselbe DTFT dichter ab: Die Peak-*Position* wird feiner und der
Bin-Abstand wird `rate / size`, aber ob zwei Komponenten trennbar sind, bestimmen weiterhin
Fensterlänge und -form. Ein Ton genau zwischen zwei Bins liest `82.1093` und `80.8598` auf dem
ungefüllten Raster und `128` bei seiner eigenen Frequenz auf dem gefüllten.

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

Zwei gleich starke Töne im Abstand von `0.4` Bins bleiben bei jeder Auffüllung verschmolzen: Mit
256 Werten und einem Hann-Fenster erzeugt Auffüllen auf 8192 nur ein lokales Maximum, nicht zwei.

**Die Hilbert-Transformation ist zirkulär.** `analyticSignal`, `envelope` und
`instantaneousPhase` behandeln den ersten und den letzten Abtastwert als Nachbarn, sodass eine
Aufzeichnung, deren Periode ihre Länge nicht teilt, an beiden Enden verunreinigt ist. Die Mitte
ist verlässlich, die Enden nicht.

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

**Eine verschwindende Hüllkurve definiert keine Phase.** Wo die Hüllkurve zusammenbricht, kann
die Differenz zweier Rundungsrauschwinkel eine halbe Umdrehung betragen, was als halbe
Abtastrate gelesen wird. Das Gate ist das, was die Zahl sinnvoll hält, und der Standard ist
`1E-3` der Spitzenhüllkurve.

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

**Eine unnormierte Korrelation ist keine Ähnlichkeit.** Die rohe Summe `r[k]` wächst mit der
Aufzeichnungslänge, zwei Längen sind also nicht vergleichbar. Die Standardregel
`"coefficient"` teilt durch `r[0]` und hält jeden Wert in `[-1, 1]`; `"unbiased"` teilt durch
`count − k` und zahlt mit einer Varianz, die mit dem Lag wächst.

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

Eine weitere Ablesung verdient eine Warnung: `spectralFlux` normiert jeden Frame vor dem
Vergleich, eine reine Pegeländerung erzeugt also null Fluss. Sein erster und letzter Wert sind
Randeffekte der Null-Grenze, keine Einsätze.

---

<a id="15-license"></a>
## 15. Lizenz

MIT © Eloy Kim
