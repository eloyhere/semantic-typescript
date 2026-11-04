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
- 496 Regressionstests: `npm test`.
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
13. [Lizenz](#13-license)

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
| Mathematik | `mathematics/*` | Winkel, Komplexe, Frequenzen, Spektren, Fenster, Epizyklen, Phasenringe |
| Strukturen | `structure/*` | Listen, Sets, Maps, Bäume, Ringe, Felder |

Die synchrone und die asynchrone Familie teilen ein Vokabular: dieselben Operatornamen, dieselbe
Indexsemantik, dieselben Collectables. Die asynchronen Varianten geben lediglich Promises zurück und
stellen Schreibzugriffe in eine Warteschlange, sodass ein nach einem Schreibzugriff ausgelöster
Lesezugriff ihn stets beobachtet.

---

<a id="3-quick-start"></a>
## 3. Schnellstart

```typescript
import {
  useOf, useFrom, useRange, useText, useStringify, usePromise
} from "semantic-typescript";

// Numerische Aggregation
const sum: number = useOf(10, 20, 30, 40)
  .map(n => n * 2)
  .toNumericStatistics()
  .summate();                                   // 200

// BigInt-Aggregation
const bigSum: bigint = useOf(10n, 20n, 30n, 40n)
  .map(n => n * 2n)
  .toBigintStatistics()
  .summate();                                   // 200n

// Neuanordnung ist Index-Arithmetik — mit toOrdered() sammeln, damit sie wirkt
const reversed: number[] = useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();      // [5,4,3,2,1]
const rotated: number[]  = useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();   // [4,5,1,2,3]

// Träge Auswertung über einen großen Bereich
const multiples: bigint[] = useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)
  .limit(10n)
  .toUnordered()
  .toArray();                                   // [0n,17n,…,153n]

// Unicode-sichere String-Verarbeitung (Code-Punkte, nicht UTF-16-Einheiten)
useText("semantic 👍").toUnordered().forEach(character => console.log(character));

// Zyklussichere Serialisierung
const cyclic: any = { a: 1 }; cyclic.self = cyclic;
useStringify(cyclic);                           // '{"a":1}'

// Asynchrone Quellen
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
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (Rotation)
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

---

<a id="6-collectables-and-terminal-operations"></a>
## 6. Collectables und Terminaloperationen

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

---

<a id="7-statistics-and-windows"></a>
## 7. Statistik und Fenster

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();              // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();              // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();               // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                 // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance();             // 2.56
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation();    // 1.6
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n);                    // [[1,2],[2,3],[3,4]]
```

Beide Statistik-Familien bieten dieselbe Oberfläche — `summate`, `average`, `median`, `mode`,
`variance`, `standardDeviation`, `frequency`, `findMaximum`, `findMinimum` — mit `bigint`-Arithmetik
für `toBigintStatistics()`. Fenster unterstützen `slide(size, hop)` und `tumble(size)`.

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
const cycle = new AsynchronousCycle([1, 2]);
const added   = cycle.add(3);          // in der Warteschlange
const sampled = cycle.elementAt(2n);   // beobachtet den Schreibzugriff oben
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

Ein `Cycle` ist ein **n-facher Ring**: Elementanzahl, Positionsperiode und die Anzahl unterscheidbarer
Phasen sind dieselbe ganze Zahl `n`. Die Phase einer Position wird aus ihrem exakten Rest berechnet,
sodass der Ring bis auf das Bit periodisch ist:

```typescript
import { SynchronousCycle } from "semantic-typescript";

const ring = new SynchronousCycle(["a", "b", "c", "d", "e", "f"]);
ring.phaseAt(0n).get().toDegreeValue();   // 0
ring.phaseAt(1n).get().toDegreeValue();   // 60
ring.phaseAt(6n).get().getValue() === ring.phaseAt(0n).get().getValue();   // true, exakt
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
import { useField } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ): +1 gleichgerichtet, −1 entgegengesetzt
const mixed  = useField([0.4, 0.3, 0.3]);  // erste drei Harmonische

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
const ring = new SynchronousCycle(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                              // 5
report.missed;                               // 1  ('zz' liegt nicht auf dem Ring)
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

Jede Referenzzeile meldet `count`, die mittlere relative Phase `mean` und die mittlere Resultantenlänge
`resultant`. Eine Identität lohnt sich zu merken: **`resultant` ist für jede Referenz gleich**, weil
eine geänderte Basis alle relativen Phasen nur um eine Konstante rotiert. Pro Referenz unterscheiden
sich der Count und der Mittelwert.

```typescript
const cycle = new SynchronousCycle(["a", "b", "c"]);
cycle.scoresAt(0, cosine);                   // ein Score pro Position, in [-1, 1]
```

### 10.4 Verwandte Instrumente

| Aufruf | Beantwortet | Kosten |
| :--- | :--- | :--- |
| `purity()` | ist der Ring noch die `n`-ten Einheitswurzeln? | O(n) |
| `resultant(t?)` | wie konzentriert sind die Phasoren gerade jetzt? | O(n) |
| `analyse(data)` | wie liegen diese Daten gegen jedes Element? | O(n · m) |
| `toSpectrum()` | der Ring als Spektrum, Wellenzahl auf der Frequenzachse | O(n²) |
| `useAngularSpectrum(cycle, instants, plan)` | die `(ω, n)`-Ebene über die Zeit | O(n² · frames) |

Zwei weitere Primitive runden das Modell ab: `combineCycles(a, b)` verbindet zwei Ringe auf ihrem
kleinsten gemeinsamen Vielfachen (ein Pullback, kein Produkt — die Paare, die sich keinen Zeitpunkt
teilen können, fehlen schlicht), und `rate()` gibt jedem Element seine eigene intrinsische Frequenz,
sodass ein Ring gegen die Umgebung driften kann. `jetAt`, `windingAt` und `errorIntegralAt` legen den
differentiellen Zustand dieser Drift offen.

---

<a id="11-utility-helpers"></a>
## 11. Hilfsfunktionen

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

**`Cycle` ist ein einfügungsgeordnetes Set.** Elemente sind eindeutig und behalten die Reihenfolge, in
der sie zuerst hinzugefügt wurden. Ein doppeltes `add` gibt `false` zurück, und ein `set`, das einen
Doppelgänger einführen würde, wirft. Genau das erlaubt es, eine Phase als Funktion des *Elements* zu
behandeln und nicht der Position, die es gerade zufällig einnimmt.

**`Spectrum` setzt in seinen einseitigen Helfern ein reelles Signal voraus.** `oneSided()`,
`getNyquist()` und `centroid()` unterstellen konjugierte Symmetrie. Das räumliche Spektrum eines
Phasenrings ist komplex und im Allgemeinen nicht symmetrisch — ein Ring, der den Kreis rückwärts
durchläuft, legt seine gesamte Energie in Bin `n − 1`, jenseits von Nyquist. Lesen Sie die Bins direkt.

---

<a id="13-license"></a>
## 13. Lizenz

MIT © Eloy Kim
