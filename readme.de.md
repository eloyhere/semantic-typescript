# **Semantic‑TypeScript**
**Ströme, indiziert.** Ihre Daten unter präziser Kontrolle.

---

### Überblick

Semantic‑TypeScript stellt eine bedeutende Weiterentwicklung in der Stream‑Verarbeitung dar und vereint elegant die effektivsten Paradigmen aus JavaScript‑Generatoren, Java‑Streams und MySQL‑artiger Indizierung. Die Grundidee ist sowohl leistungsfähig als auch bewusst gewählt: Ausnahmslos effiziente Datenverarbeitungspipelines durch intelligente Indizierung zu konstruieren, anstatt durch konventionelle Brute‑Force‑Iteration.

Wo typische Bibliotheken synchrone Schleifen oder umständliche Promise‑Ketten erzwingen, bietet Semantic‑TypeScript eine **vollständig asynchrone**, funktional reine und rigoros typsichere Erfahrung, die ausdrücklich für die Anforderungen moderner Anwendungsentwicklung konzipiert ist.

Dieses Modell verkörpert eine raffinierte Form des Kontrollflusses: Daten werden nur dann an den nachgelagerten Verbraucher weitergegeben, wenn die vorgelagerte Pipeline explizit den `accept`‑Callback aufruft. Sie behalten die vollständige, granulare Kontrolle über den Zeitpunkt – die Verarbeitung erfolgt genau dann und nur dann, wenn es erforderlich ist.

---

### Warum Entwickler Semantic‑TypeScript wählen

-   **Zero‑Boilerplate‑Indizierung** – Jedes Element besitzt inhärent seinen natürlichen oder maßgeschneiderten Index, wodurch manuelle Nachverfolgung entfällt.
-   **Rein funktional & typsicher** – Genießen Sie vollständige, idiomatische TypeScript‑Inferenz zusammen mit unveränderlichen Operationen.
-   **Leck‑sichere Ereignisströme** – Das `useSubscription`‑Muster wurde mit Ressourcensicherheit als erstem Prinzip entworfen. Sie definieren die logische Grenze – mittels `limit(n)`, `sub(start, end)` oder `takeWhile(predicate)` – und die Bibliothek verwaltet den vollständigen Abonnement‑Lebenszyklus. Dies stellt sicher, dass keine verbleibenden Listener und keine Speicherlecks entstehen.
-   **Integrierte Statistik‑Suite** – Greifen Sie ohne externe Abhängigkeiten auf umfassende Analysen für sowohl `number`‑ als auch `bigint`‑Ströme zu, einschließlich Mittelwert, Median, Modus, Varianz, Schiefe und Kurtosis.
-   **Vorhersehbare, fein abstimmbare Leistung** – Wählen Sie zwischen geordneten oder ungeordneten Sammlern, um Ihren genauen Leistungs‑ und Reihenfolgeanforderungen gerecht zu werden.
-   **Inherent speichereffizient** – Ströme werden lazy evaluiert, verarbeiten Elemente bei Bedarf und entlasten so den Speicher.
-   **Kein undefiniertes Verhalten** – TypeScript garantiert vollständige Typsicherheit und Nullsicherheit. Ihre Quelldaten bleiben unveränderlich, es sei denn, sie werden explizit in Ihren Callback‑Funktionen geändert.

---

### Installation

Integrieren Sie Semantic‑TypeScript mit Ihrem bevorzugten Paketmanager in Ihr Projekt:

```bash
npm install semantic-typescript
```
oder
```bash
yarn add semantic-typescript
```

---

### Praktische Einführung

Die folgenden Beispiele demonstrieren Kernkonzepte, von grundlegenden Transformationen bis zur praktischen Ereignisbehandlung.

```typescript
import { useOf, useFrom, useRange, useSubscription, useText, useStringify } from "semantic-typescript";

// ====================================================================
// BEISPIEL 1: Grundlegende Operationen & numerische Statistik
// ====================================================================
// Demonstriert Mapping und terminale Statistikoperationen. Nach der Transformation muss die Pipeline in einen Statistik‑Collector umgewandelt werden, bevor terminale Methoden wie `.summate()` aufgerufen werden können.

const numericSum: number = useOf(10, 20, 30, 40)
  .map((n: number): number => n * 2)        // Verdoppelt jedes Element: [20, 40, 60, 80]
  .toNumericStatistics()                     // In einen Statistik‑Collector umwandeln
  .summate();                               // Terminale Operation: 200

// Weitere statistische Methoden (verfügbar nach .toNumericStatistics()):
// .average(), .median(), .mode(), .variance(), .skewness(), .kurtosis()

// ====================================================================
// BEISPIEL 2: BigInt‑Statistik
// ====================================================================
// Funktioniert identisch zur numerischen Statistik, ist jedoch für BigInt‑Daten optimiert.

const bigintSum: bigint = useOf(10n, 20n, 30n, 40n)
  .map((n: bigint): bigint => n * 2n)       // BigInt‑Arithmetik
  .toBigIntStatistics()                      // In BigInt‑Statistik‑Collector umwandeln
  .summate();                                // Terminale Operation: 200n

// ====================================================================
// BEISPIEL 3: Indexmanipulation zur Stromumkehrung
// ====================================================================
// Veranschaulicht die Neuanordnung von Elementen durch strategische Neuzuweisung ihrer Indizes mithilfe der `.redirect()`‑Methode, was benutzerdefinierte Muster wie Umkehrung ermöglicht.

const reversedArray: number[] = useFrom([1, 2, 3, 4, 5])
  .redirect((_element: number, index: bigint): bigint => -index) // Auf negative Indizes abbilden
  .toOrdered()  // Essentiell: Sammelt Elemente sortiert nach ihren neuen Indizes
  .toArray();   // Ergebnis: [5, 4, 3, 2, 1]

// Für einfache Umkehrung ist auch `.reverse()` verfügbar.

// ====================================================================
// BEISPIEL 4: Strom‑Mischen (Shuffle)
// ====================================================================
// Permutiert Elementindizes zufällig mit einem In‑Place‑Shuffle‑Algorithmus.

const shuffledArray: number[] = useFrom([1, 2, 3, 4, 5])
  .shuffle()      // Weist Indizes zufällig neu zu
  .toOrdered()    // Sortiert nach den neuen zufälligen Indizes
  .toArray();     // Z.B.: [2, 5, 1, 4, 3] (variiert bei jeder Ausführung)

// ====================================================================
// BEISPIEL 5: Zirkuläre Strom‑Rotation
// ====================================================================
// Verschiebt Elemente zyklisch. Positive Werte rotieren nach rechts; negative Werte nach links.

// Rechts‑Rotation um 2 Positionen
const rightRotated: number[] = useFrom([1, 2, 3, 4, 5])
  .translate(2)   // Verschiebt Indizes um 2 nach rechts
  .toOrdered()
  .toArray();     // Ergebnis: [4, 5, 1, 2, 3]

// ====================================================================
// BEISPIEL 6: Lazy Evaluation mit unendlichen Bereichen
// ====================================================================
// Verarbeitet theoretisch unendliche Ströme lazy, berechnet Elemente nur bei Bedarf.

const firstTenMultiples: bigint[] = useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)  // Behält Vielfache von 17
  .limit(10n)                   // Kritisch: Stoppt nach dem 10. Treffer
  .toUnordered()                // Keine Sortierung erforderlich
  .toArray();                   // Ergebnis: [0, 17, 34, 51, 68, 85, 102, 119, 136, 153]

// Ohne `.limit(10n)` würde die Pipeline alle eine Million Elemente verarbeiten.

// ====================================================================
// BEISPIEL 7: Zusammensetzung einer komplexen Pipeline
// ====================================================================
// Demonstriert die sequentielle Komposition mehrerer Operationen.

const complexResult: number[] = useRange(1n, 100n)
  .map(n => Number(n) * 2)
  .filter(n => n > 50)
  .shuffle()
  .limit(5n)
  .translate(2)
  .toOrdered()
  .toArray();

// ====================================================================
// BEISPIEL 8: Verwaltete DOM‑Ereignis‑Abonnements
// ====================================================================
// Hört auf Browser‑Ereignisse mit automatischer, lecksicherer Bereinigung.
// Der `.limit(n)`‑Aufruf definiert die Grenze für die automatische Listener‑Entfernung.

// Definiere einen Abonnenten für ein Window‑Ziel
const windowSubscriber = {
    mount: (target: Window): void => { /* Setup‑Logik */ },
    subscribe: (target: Window, event: keyof WindowEventMap, handler: EventListener): void => {
        target.addEventListener(event, handler);
    },
    unsubscribe: (target: Window, event: keyof WindowEventMap, handler: EventListener): void => {
        target.removeEventListener(event, handler);
    },
    unmount: (): void => { /* Cleanup‑Logik */ }
};

useSubscription(window, windowSubscriber, "resize")
  .limit(5n) // Automatische Abmeldung nach 5 Ereignissen
  .toUnordered()
  .forEach((ev: Event, idx) =>
    console.log(`Größenänderung #${idx}: ${(ev.target as Window).innerWidth}x${(ev.target as Window).innerHeight}`)
  );

// ====================================================================
// BEISPIEL 9: String‑Verarbeitung nach Unicode‑Codepunkten
// ====================================================================
// Iteriert korrekt über einen String, behandelt Multi‑Byte‑Unicode‑Zeichen.

useText("My emotion now is: 😊, and semantic is 👍")
  .toUnordered()
  .log(); // Gibt jedes Zeichen (inkl. Emoji) in einer neuen Zeile aus.

// ====================================================================
// BEISPIEL 10: Sichere Stringifizierung zirkulärer Referenzen
// ====================================================================
// Serialisiert sicher Objekte, die zirkuläre Referenzen enthalten.

const obj = {
  a: 1,
  b: "text"
};
(obj as any).c = [obj.a, obj.b, (obj as any).c]; // Führt zirkuläre Referenz ein

// const text: string = JSON.stringify(obj); // Wirft einen Fehler
const text: string = useStringify(obj); // Ergibt sicher `{a: 1, b: "text", c: []}`
```

---

### Kernkonzepte

| Konzept | Zweck | Hauptanwendungsfall |
| :--- | :--- | :--- |
| `AsynchronousSemantic` | Der Kern‑Builder für asynchrone Ströme, Ereignisse und push‑basierte lazy Pipelines. | Echtzeit‑Ereignisse, WebSockets, DOM‑Listener oder jeder langlebige/unendliche Strom. |
| `SynchronousSemantic` | Der Builder für synchrone, speicherinterne oder pull‑basierte eager Ströme. | Statische Daten, endliche Bereiche oder sofortige Iterationsaufgaben. |
| `toUnordered()` | Der schnellste terminale Collector, verwendet eine Map zur Indexspeicherung. | Leistungskritische Pfade, bei denen stabile Reihenfolge nicht erforderlich ist (O(n) Zeit & Speicher). |
| `toOrdered()` | Ein sortierter, indexstabiler terminaler Collector. | Wenn die Elementreihenfolge erhalten bleiben muss oder Indexzugriff benötigt wird. |
| `toNumericStatistics()` | Ein Collector, der umfangreiche statistische Analysen auf `number`‑Strömen ermöglicht. | Datenanalyse, Metriken und statistische Berechnungen. |
| `toBigIntStatistics()` | Ein Collector, der umfangreiche statistische Analysen auf `bigint`‑Strömen ermöglicht. | Analyse und Statistik für große Integer‑Datensätze. |
| `toWindow()` | Bietet Sliding‑ und Tumbling‑Window‑Operationen über einen Strom. | Zeitreihenanalyse, Batch‑Verarbeitung und Fenster‑Aggregationen. |

---

**Wesentliche Nutzungsregeln**

1.  **Ereignisströme** (erstellt über Fabriken wie `useSubscription`) geben ein `AsynchronousSemantic` zurück.
    → Sie **müssen** eine grenzendefinierende Methode wie `.limit(n)`, `.sub(start, end)` oder `.takeWhile(predicate)` aufrufen, um den Listener zu beenden. Andernfalls bleibt das Abonnement aktiv.

2.  **Terminale Operationen** (`.toArray()`, `.count()`, `.forEach()`, `.findFirst()`, etc.) sind **erst nach** der Umwandlung der Pipeline in einen Collector **verfügbar**:
    ```typescript
    .toUnordered()   // Für maximale Geschwindigkeit, Reihenfolge nicht garantiert.
    // oder
    .toOrdered()     // Für stabile, sortierte Ausgabe.
    // oder
    .toNumericStatistics() // Für statistische Methoden.
    ```

---

### Leistungsmerkmale

| Collector | Zeitkomplexität | Speicherkomplexität | Reihenfolge garantiert? | Ideales Szenario |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | O(n) | O(n) | Nein | Rohdurchsatz ist entscheidend; Endreihenfolge irrelevant. |
| `toOrdered()` | O(n log n) | O(n) | Ja (sortiert) | Stabile Reihenfolge, Indexzugriff oder Vorsortierung für Statistiken. |
| `toNumericStatistics()` | O(n log n) | O(n) | Ja (interne Sortierung) | Durchführung statistischer Operationen, die sortierte Daten erfordern. |
| `toBigIntStatistics()` | O(n log n) | O(n) | Ja (interne Sortierung) | Statistische Operationen auf BigInt‑Daten. |
| `toWindow()` | O(n log n) | O(n) | Ja (interne Sortierung) | Fensteroperationen, die von sortierten Indizes profitieren. |

Wählen Sie `toUnordered()`, wenn absolute Geschwindigkeit entscheidend ist. Entscheiden Sie sich nur dann für `toOrdered()` oder einen Statistik‑Collector, wenn Ihre Logik von der Elementreihenfolge abhängt.

---

**Vergleichende Analyse mit modernen Stream‑Bibliotheken**

| Merkmal | Semantic‑TypeScript | RxJS | Native Async Iterators / Generators | Most.js |
| :--- | :--- | :--- | :--- | :--- |
| **TypeScript‑Integration** | Erstklassig, tief typisiert mit inhärenter Index‑Wahrnehmung. | Hervorragend, beinhaltet jedoch oft komplexe Generika‑Ketten. | Gut, erfordert jedoch manuelle Typannotationen. | Stark, mit funktional‑first‑Typisierungsstil. |
| **Integrierte Statistik‑Analyse** | Umfassende native Unterstützung für `number` und `bigint`. | Nicht nativ verfügbar (erfordert benutzerdefinierte Operatoren oder andere Bibliotheken). | Keine. | Keine. |
| **Indizierung & Positionsbewusstsein** | Native, leistungsstarke BigInt‑Indizierung für jedes Element. | Erfordert benutzerdefinierte Operatoren (z.B. `scan`, `withLatestFrom`). | Manuelle Zählerverwaltung notwendig. | Basis, keine integrierte Index‑Eigenschaft. |
| **Ereignisstrom‑Management** | Dedizierte, typsichere Fabriken mit expliziter, deklarativer Lebenszyklus‑Steuerung. | Leistungsstark, erfordert jedoch sorgfältige manuelle Abonnementverwaltung, um Lecks zu verhindern. | Manuelles Anhängen von Event‑Listenern und Verwaltung von Abbruchtokens. | Gutes `fromEvent`, generell leichtgewichtig. |
| **Leistung & Speicher** | Herausragend – bietet optimierte `toUnordered()` und `toOrdered()` Collector. | Sehr gut, tiefe Operator‑Ketten können jedoch Overhead einführen. | Hervorragend (minimaler nativer Overhead). | Hervorragend. |
| **Bundle‑Größe** | Sehr leichtgewichtig. | Substantiell (selbst mit Tree‑Shaking). | Null (natives Sprachfeature). | Klein. |
| **API‑Design‑Philosophie** | Funktionales Collector‑Muster mit expliziter Index‑Semantik. | Reaktives Observable‑Muster. | Imperatives Iterator / deklaratives Generator‑Muster. | Funktional, point‑free Komposition. |
| **Flusskontrolle** | Explizit (`interrupt`, `.limit()`, `.takeWhile()`, `.sub()`). | Gut (`take`, `takeUntil`, `first`). | Manuell (`break` in Schleifen). | Gut (`take`, `until`). |
| **Sync & Async Support** | Vereinheitlichte API – Erstklassiger Support für beide Paradigmen. | Hauptsächlich asynchron. | Beide unterstützt, aber mit manueller Brücke. | Hauptsächlich asynchron. |
| **Lernkurve** | Flach für Entwickler, die mit funktionalen und indizierten Collection‑Pipelines vertraut sind. | Steiler (umfangreicher Operator‑Wortschatz, Hot/Cold‑Observable‑Konzepte). | Niedrig bis mittel. | Mittel. |

**Der Semantic‑TypeScript‑Vorteil**

*   **Einzigartige Fähigkeiten:** Integrierte Statistik‑ und Index‑Funktionen eliminieren die Notwendigkeit manueller `reduce`‑Operationen oder ergänzender Datenanalyse‑Bibliotheken.
*   **Vorhersehbare Ressourcenverwaltung:** Explizite Kontrolle über Ereignisströme verhindert die speicherlecks, die in RxJS‑Anwendungen subtil auftreten können.
*   **Vereinheitlichtes Design:** Eine konsistente API für sowohl synchrone als auch asynchrone Workflows reduziert kognitive Belastung und Code‑Duplizierung.

Dieser Vergleich unterstreicht, warum Semantic‑TypeScript besonders gut für moderne TypeScript‑Anwendungen geeignet ist, die hohe Leistung, robuste Typsicherheit und umfangreiche Datenverarbeitungsfunktionen ohne die Komplexität traditioneller reaktiver Frameworks erfordern.

---

### Beginnen Sie Ihre Erkundung

Semantic‑TypeScript verwandelt komplexe Datenflüsse in lesbare, komponierbare und hochleistungsfähige Pipelines. Egal, ob Sie Echtzeit‑UI‑Ereignisse verarbeiten, umfangreiche Datensätze bearbeiten oder Analyse‑Dashboards erstellen – es bietet die Leistung von Datenbank‑Level‑Indizierung mit der Eleganz der funktionalen Programmierung.

**Ihre nächsten Schritte:**

*   Erkunden Sie die vollständig typisierte API direkt in Ihrer IDE (alle Exporte sind über den Hauptpaket‑Einstiegspunkt verfügbar).
*   Werden Sie Teil der wachsenden Community von Entwicklern, die komplexe asynchrone Iteratoren und reaktive Ketten durch klare, intentionale Semantic‑Pipelines ersetzt haben.

**Semantic‑TypeScript** – wo Ströme auf Struktur treffen.

Beginnen Sie noch heute mit dem Bauen und erleben Sie den spürbaren Unterschied, den durchdachte Indizierung bringt.

**Bauen Sie mit Klarheit, handeln Sie mit Vertrauen und transformieren Sie Daten mit Absicht.**

MIT © Eloy Kim