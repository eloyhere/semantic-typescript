# **Semantic-TypeScript**

**Flujo, indexado.** Tus datos, bajo control preciso.

[English](./readme.md) · [简体中文](./readme.cn.md) · [繁體中文](./readme.tw.md) · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · Español · [Русский](./readme.ru.md)

Una biblioteca de procesamiento de flujos con seguridad de tipos que unifica **generadores de JavaScript**, **Java Stream** y
el **direccionamiento de datos basado en índices**. Cada elemento lleva un índice `bigint`, cada canalización es perezosa y
cada operación terminal es una opción explícita.

```bash
npm install semantic-typescript
```

- Cero dependencias en tiempo de ejecución, ESM puro, incluye sus propios tipos.
- 496 pruebas de regresión: `npm test`.
- Historial de cambios completo: [CHANGELOG.md](./CHANGELOG.md).

---

## Tabla de contenidos

1. [Filosofía de diseño](#1-design-philosophy)
2. [Arquitectura](#2-architecture)
3. [Inicio rápido](#3-quick-start)
4. [Funciones de fábrica](#4-factory-functions)
5. [Operadores de transformación](#5-transformation-operators)
6. [Collectables y operaciones terminales](#6-collectables-and-terminal-operations)
7. [Estadísticas y ventanas](#7-statistics-and-windows)
8. [El modelo de índices](#8-the-index-model)
9. [El modelo asíncrono](#9-the-asynchronous-model)
10. [Análisis periódico: anillos, campos y puntuaciones](#10-periodic-analysis-rings-fields-and-scores)
11. [Funciones auxiliares](#11-utility-helpers)
12. [Rendimiento y problemas comunes](#12-performance-and-pitfalls)
13. [Licencia](#13-license)

---

<a id="1-design-philosophy"></a>
## 1. Filosofía de diseño

Tres ideas, una sola canalización:

**El índice es dato.** Cada elemento está direccionado por un `bigint`. La inversión, la rotación, el barajado y
la partición son aritmética de índices, no operaciones de búfer. Nada se materializa hasta que un
collectable lo pide.

**La pereza es el valor predeterminado.** Una fábrica envuelve un generador; un operador envuelve otro generador. Ningún
elemento se solicita hasta que se ejecuta una operación terminal, así que una fuente infinita es perfectamente
legal siempre que algo aguas abajo la detenga.

**Los terminales son explícitos.** `map` devuelve un `Semantic`, no un array. Los valores aparecen solo cuando
nombras un collectable — `toUnordered()`, `toOrdered()`, `toNumericStatistics()`, `toWindow()` — y cada
uno declara cuánto cuesta y qué orden produce.

La misma disciplina se aplica a la mitad matemática de la biblioteca. Un `Complex`, un `Angle` o una
`Frequency` es un valor inmutable cuyas invariantes se comprueban en la construcción; un `Optional`
sustituye a `null`; y un anillo de fase declara exactamente cuántos elementos contiene, qué periodo tiene y
qué equilibrado está.

---

<a id="2-architecture"></a>
## 2. Arquitectura

```
factory  ──▶  Semantic  ──▶  Semantic  ──▶  Collectable  ──▶  result
 (source)      (map)         (filter)        (terminal)
                    ▲
                    └── cada operador devuelve un nuevo Semantic que envuelve un generador
```

| Capa | Módulo | Responsabilidad |
| :--- | :--- | :--- |
| Fuentes | `synchronous/collectors`, `asynchronous/collectors` | Envolver un iterable, un generador, una promesa, un blob o un destino de eventos |
| Canalizaciones | `synchronous/semantic`, `asynchronous/semantic` | Operadores perezosos y reescritura de índices |
| Collectables | `synchronous/semantic`, `asynchronous/semantic` | Terminales ordenados, desordenados, de estadísticas, de ventanas y personalizados |
| Colectores | `synchronous/collector`, `asynchronous/collector` | Las primitivas de plegado sobre las que se construye cada terminal |
| Matemáticas | `mathematics/*` | Ángulos, complejos, frecuencias, espectros, ventanas, epiciclos, anillos de fase |
| Estructuras | `structure/*` | Listas, conjuntos, mapas, árboles, anillos, campos |

Las familias síncrona y asíncrona comparten un solo vocabulario: los mismos nombres de operador, la misma
semántica de índices, los mismos collectables. Las variantes asíncronas simplemente devuelven promesas y
encolan las escrituras, de modo que una lectura emitida después de una escritura siempre la observa.

---

<a id="3-quick-start"></a>
## 3. Inicio rápido

```typescript
import {
  useOf, useFrom, useRange, useText, useStringify, usePromise
} from "semantic-typescript";

// Agregación numérica
const sum: number = useOf(10, 20, 30, 40)
  .map(n => n * 2)
  .toNumericStatistics()
  .summate();                                   // 200

// Agregación con BigInt
const bigSum: bigint = useOf(10n, 20n, 30n, 40n)
  .map(n => n * 2n)
  .toBigintStatistics()
  .summate();                                   // 200n

// Reordenar es aritmética de índices: recolecta con toOrdered() para que surta efecto
const reversed: number[] = useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();      // [5,4,3,2,1]
const rotated: number[]  = useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();   // [4,5,1,2,3]

// Evaluación perezosa sobre un rango grande
const multiples: bigint[] = useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)
  .limit(10n)
  .toUnordered()
  .toArray();                                   // [0n,17n,…,153n]

// Procesamiento de cadenas seguro con Unicode (puntos de código, no unidades UTF-16)
useText("semantic 👍").toUnordered().forEach(character => console.log(character));

// Serialización segura ante referencias circulares
const cyclic: any = { a: 1 }; cyclic.self = cyclic;
useStringify(cyclic);                           // '{"a":1}'

// Fuentes asíncronas
const total = await usePromise(Promise.resolve(7)).toNumericStatistics().summate();       // 7
```

---

<a id="4-factory-functions"></a>
## 4. Funciones de fábrica

La construcción es siempre O(1) — una fábrica solo envuelve un generador. La tabla indica el coste de
*consumir* `n` elementos, más el espacio adicional que la propia fuente necesita.

| Fábrica | Firma (resultado) | Tiempo (consumir n) | Espacio (fuente) | Notas |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | Los índices son 0..n−1; el argumento de propagación ya está materializado |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | Envuelve cualquier iterable; se itera una vez al recolectar |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` es exclusivo; `step` debe ser distinto de cero; tanto `number` como `bigint` funcionan |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | El proveedor se llama una vez por elemento |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | Elemento neutro para `concat` |
| `useText` | `useText(text, delimiter?)` | O(n) | O(n) para el texto | Itera **puntos de código**, por lo que los emoji y los CJK siguen siendo elementos únicos |
| `useAttribute` | `useAttribute<T>(object)` | O(v + e) | O(d + v) | Recorre recursivamente objetos anidados con protección contra ciclos |
| `useGenerate` | `useGenerate<E>(supplier, interrupt)` | O(n) × coste del proveedor | O(1) | **Debe** tener un `interrupt` de parada o un `limit` aguas abajo |
| `useIterate` | `useIterate<E>(Iterable<E>)` / `(AsyncIterable<E>)` | O(n) por recolección | O(1) | Reproduce el iterador en cada recolección |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period (tiempo real) | O(1) | Emite el tiempo transcurrido |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | Un único elemento en el índice `0n` |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob size) | O(chunk) por copia | El fragmento predeterminado es 64 KiB |
| `useSubscription` | `useSubscription(target, subscriber, event) → AsynchronousSemantic<Event>` | un elemento por evento | O(1) | `limit()` / `takeWhile()` definen el límite de desuscripción |

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
## 5. Operadores de transformación

Cada operador devuelve un nuevo `Semantic`; ninguno toca un elemento hasta que se ejecuta un collectable. El tiempo es
el coste adicional **por elemento**; el espacio es lo que el operador retiene mientras la canalización se ejecuta.

| Operador | Propósito | Efecto en el índice | Tiempo | Espacio |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | transformación 1:1 | reenviado | O(1) | O(1) |
| `filter(predicate)` | conserva los elementos que coinciden | reenviado | O(1) | O(1) |
| `flat(mapper)` / `flatMap(mapper)` | aplanado 1:N | reindexado desde 0 | O(1) por elemento emitido | O(1) |
| `distinct(keyExtractor?)` | descarta claves repetidas, conserva la primera | reenviado | O(1) promedio | O(n) |
| `peek(consumer)` | efecto secundario, el elemento pasa a través | reenviado | O(1) | O(1) |
| `limit(count)` | toma los primeros *n* | reindexado desde 0 | O(1) | O(1) |
| `skip(count)` | descarta los primeros *n* | reenviado | O(1) | O(1) |
| `sub(start, end)` | rebanada posicional `[start, end)` | reenviado | O(1) | O(1) |
| `takeWhile(predicate)` | toma mientras el predicado se cumple | reenviado | O(1) | O(1) |
| `dropWhile(predicate)` | descarta mientras el predicado se cumple | reindexado desde 0 | O(1) | O(1) |
| `concat(other)` | añade un semantic o un iterable | continúa el índice | O(1) | O(1) |
| `redirect(redirector)` | calcula un nuevo índice como quieras | **el tuyo** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | negado y desplazado | O(1) | O(1) |
| `translate(offset \| mapper)` | desplaza cada índice | `i + offset` | O(1) | O(1) |
| `shuffle(mapper?)` | aleatoriza el índice | aleatorio | O(1) | O(1) |
| `pipe(conversion)` | pasa el generador a una función personalizada | según tú | el tuyo | el tuyo |
| `semantic()` | eleva un collectable de nuevo a un semantic | sin cambios | O(1) | O(1) |

**`reverse`, `translate` y `shuffle` solo reescriben índices.** Nada se almacena en búfer ni se rota hasta que
`toOrdered()` normaliza los índices módulo el número de elementos:

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotación)
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

---

<a id="6-collectables-and-terminal-operations"></a>
## 6. Collectables y operaciones terminales

El collectable posee tanto el **orden** como el **control de índices**. `n` es el número de elementos.

| Collectable | Estructura | Tiempo | Orden | Úsalo cuando |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | `Map<bigint, E>` indexado por índice | O(n) | inserción | máximo rendimiento; los índices sin procesar se conservan intactos |
| `toOrdered()` | array ordenado por índice de elemento | O(n log n) | por índice normalizado | la inversión o la rotación deben surtir efecto |
| `toOrdered(comparator)` | ordenado por tu comparador | O(n log n) | por tu comparador | vistas ordenadas |
| `toNumericStatistics()` | búfer ordenado por valor | O(n log n) | por valor | estadísticas sobre `number` |
| `toBigintStatistics()` | búfer ordenado por valor | O(n log n) | por valor | estadísticas sobre `bigint` |
| `toWindow()` | búfer ordenado por valor | O(n log n) | por valor | `slide` / `tumble` |
| `toCollectable(mapper)` | lo que devuelva el mapper | — | — | collectables personalizados |

| Terminal | Devuelve | Tiempo | Notas |
| :--- | :--- | :--- | :--- |
| `toArray()` / `toSet()` | `Array<E>` / `Set<E>` | O(n) | Vacía el búfer; `toSet` desduplica por identidad |
| `toMap(key, value?)` | `Map<K, V>` | O(n) promedio | Gana la última escritura |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | El búfer ya lo sabe |
| `forEach(action)` | `void` | O(n) | `action(element, index)` |
| `join(…)` | `string` | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `reduce(…)` | `Optional<E>` / `E` / `R` | O(n) | Flujo vacío → `Optional` vacío |
| `group(classifier)` / `groupBy(key, value)` | `Map<K, E[]>` | O(n) promedio | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | Round-robin por índice |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | El número de cubo proviene del clasificador |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) peor caso, con cortocircuito | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | Posicional en orden materializado |
| `findAt(k)` / `findNegativeAt(k)` | `Optional<E>` | O(k) / O(n−k) | Cuenta desde el principio / desde el final |
| `findMaximum(cmp?)` / `findMinimum(cmp?)` | `Optional<E>` | O(n) | Por defecto usa una comparación estructural |
| `frequency()` | `Map<E, bigint>` | O(n) promedio | Solo collectables de estadísticas |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | Terminal de tipo IO |
| `collect(collector)` | `R` | O(n) | El plegado genérico detrás de cada terminal anterior |

---

<a id="7-statistics-and-windows"></a>
## 7. Estadísticas y ventanas

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();              // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();              // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();               // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                 // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance();             // 2.56
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation();    // 1.6
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n);                    // [[1,2],[2,3],[3,4]]
```

Ambas familias de estadísticas exponen la misma superficie — `summate`, `average`, `median`, `mode`,
`variance`, `standardDeviation`, `frequency`, `findMaximum`, `findMinimum` — con aritmética `bigint`
para `toBigintStatistics()`. Las ventanas admiten `slide(size, hop)` y `tumble(size)`.

---

<a id="8-the-index-model"></a>
## 8. El modelo de índices

Un índice es un `bigint` asociado a cada elemento. Los operadores lo **reenvían**, lo **reindexan**
desde cero o te dejan **calcularlo**.

La recolección ordenada normaliza cada índice módulo el número de elementos y luego ordena por el resultado. Por eso
`translate(7)` sobre cinco elementos equivale a `translate(2)`: `7 ≡ 2 (mod 5)`.

La recolección desordenada conserva el índice que produjo la canalización y devuelve los elementos en orden de llegada. Los
índices negativos son legales y, una vez normalizados, simplemente ordenan antes que los no negativos.

---

<a id="9-the-asynchronous-model"></a>
## 9. El modelo asíncrono

`AsynchronousSemantic` refleja la superficie síncrona devolviendo promesas. Las escrituras se encolan, así que una
lectura emitida después de una escritura siempre la observa.

```typescript
const cycle = new AsynchronousCycle([1, 2]);
const added   = cycle.add(3);          // en cola
const sampled = cycle.elementAt(2n);   // observa la escritura anterior
await added;
(await sampled).get().element;         // 3
```

Las fábricas que son asíncronas por naturaleza — `usePromise`, `useBlob`, `useInterval`,
`useSubscription` — devuelven `AsynchronousSemantic` directamente, y `useFrom` / `useIterate` se
actualizan solas cuando reciben un `AsyncIterable`.

---

<a id="10-periodic-analysis-rings-fields-and-scores"></a>
## 10. Análisis periódico: anillos, campos y puntuaciones

La mitad matemática de la biblioteca trata un ciclo como un objeto de primera clase en lugar de una tabla
de consulta. Tres construcciones trabajan juntas.

### 10.1 Un anillo es un entero

Un `Cycle` es un **anillo n-ésimo** (n-fold ring): el número de elementos, el periodo posicional y el número de fases
distintas son el mismo entero `n`. La fase de una posición se calcula a partir de su residuo exacto, así que el
anillo es periódico hasta el bit:

```typescript
import { SynchronousCycle } from "semantic-typescript";

const ring = new SynchronousCycle(["a", "b", "c", "d", "e", "f"]);
ring.phaseAt(0n).get().toDegreeValue();   // 0
ring.phaseAt(1n).get().toDegreeValue();   // 60
ring.phaseAt(6n).get().getValue() === ring.phaseAt(0n).get().getValue();   // true, exactamente
ring.purity();                             // 1
ring.isBalanced();                         // true
ring.sequences().map(z => z.magnitude());  // [0, 6, 0, 0, 0, 0]
```

`frequency` es la tasa de rotación **ambiente**, no un paso de fase entre posiciones: el entorno
desplaza todos los fasores un mismo ángulo, así que nunca puede romper el patrón intrínseco. `span` fija cuántas
vueltas ocupa el anillo.

`purity()` es la proporción de energía transportada por el modo fundamental,
`max(|c₁|², |c_{n−1}|²) / (n · Σ|z|²)`. Vale `1` exactamente cuando el anillo es la raíz n-ésima de la unidad
salvo rotación, y cuesta `O(n)` porque solo se necesitan dos bins. Se prueban ambas direcciones
porque un anillo puede recorrer el círculo en cualquiera de los dos sentidos.

### 10.2 Un campo es una puntuación acotada

Un `PhaseField` asigna una fase relativa a una puntuación en `[-1, 1]`:

```typescript
import { useField } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ): +1 alineado, −1 opuesto
const mixed  = useField([0.4, 0.3, 0.3]);  // primeros tres armónicos

cosine.sample(useRadian(0));               //  1
cosine.sample(useRadian(Math.PI));         // -1
```

La puntuación es una serie de cosenos truncada, `a₀ + Σ wₘ·cos(2πmΔ)`, y el constructor impone
`|a₀| + Σ|wₘ| ≤ 1`. Por la desigualdad triangular la puntuación nunca puede salir de `[-1, 1]`: la cota es una
**consecuencia de la construcción**, no un recorte aplicado a posteriori.

La razón de que el campo sea una serie y no una tabla: una tabla de `n` puntos reproduce exactamente sus propias
muestras, pero su interpolante trigonométrico se pasa entre ellas. Una tabla de cinco puntos con puntuaciones
`[+1, +0.5, −1, −0.5, 0]` interpola sobre `[−1.0428, 1.0041]`, lo que ya rompe la promesa.
Una serie acotada no puede.

### 10.3 El análisis mide los datos contra cada elemento

Cada elemento del anillo es una fase de referencia. `analyse` sitúa cada observación de vuelta en el anillo y
la mide contra cada referencia:

```typescript
const ring = new SynchronousCycle(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                              // 5
report.missed;                               // 1  ('zz' no está en el anillo)
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

Cada fila de referencia informa de `count`, la fase relativa media `mean` y la longitud resultante media
`resultant`. Merece la pena recordar una identidad: **`resultant` es la misma para todas las referencias**,
porque cambiar la línea base solo rota todas las fases relativas en una constante. Lo que difiere por
referencia es el recuento y la media.

```typescript
const cycle = new SynchronousCycle(["a", "b", "c"]);
cycle.scoresAt(0, cosine);                   // una puntuación por posición, en [-1, 1]
```

### 10.4 Instrumentos relacionados

| Llamada | Qué responde | Coste |
| :--- | :--- | :--- |
| `purity()` | ¿el anillo sigue siendo la raíz n-ésima de la unidad? | O(n) |
| `resultant(t?)` | ¿cómo de concentrados están los fasores ahora mismo? | O(n) |
| `analyse(data)` | ¿cómo se sitúan estos datos frente a cada elemento? | O(n · m) |
| `toSpectrum()` | el anillo como espectro, con el número de onda en el eje de frecuencias | O(n²) |
| `useAngularSpectrum(cycle, instants, plan)` | el plano `(ω, n)` a lo largo del tiempo | O(n² · frames) |

Otros dos primitivos completan el modelo: `combineCycles(a, b)` une dos anillos en su mínimo común
múltiplo (un pullback, no un producto: los pares que no pueden compartir un instante simplemente están ausentes), y
`rate()` da a cada elemento su propia frecuencia intrínseca para que un anillo pueda derivar respecto al
entorno. `jetAt`, `windingAt` y `errorIntegralAt` exponen el estado diferencial de esa deriva.

---

<a id="11-utility-helpers"></a>
## 11. Funciones auxiliares

| Auxiliar | Propósito |
| :--- | :--- |
| `useCompare(a, b)` | Orden total entre primitivos mixtos |
| `useToNumber` / `useToBigInt` | Conversión numérica sin pérdida y con comprobación de rango |
| `useRandom` | Auxiliares aleatorios con semilla o sin ella |
| `useTraverse` | Recorrido estructural de objetos y arrays anidados |
| `useStringify` | Serialización JSON segura ante referencias circulares |
| `useHash` / `maskOf` / `register` / `unregister` | Hash estructural y el registro de estrategias de hash |
| `invalidate` / `validate` | Guardas que lanzan una forma de error coherente |
| `Optional<T>` | El sustituto de `null` de la biblioteca: `Optional.of(x)` / `Optional.empty()` |

---

<a id="12-performance-and-pitfalls"></a>
## 12. Rendimiento y problemas comunes

**La pereza tiene un precio por etapa.** Cada operador añade un salto de generador. Para bucles numéricos
ajustados sobre arrays en memoria, un `for` simple superará a cualquier canalización; la canalización gana cuando la fuente es
perezosa, infinita, o la canalización es lo bastante larga como para que la disciplina de índices compense.

**`toOrdered()` ordena; `toUnordered()` no.** Si una inversión parece "no haber funcionado", el
colector era desordenado: la reescritura de índices solo se convierte en orden cuando los índices se normalizan.

**`useGenerate` sin un `interrupt` nunca termina.** Proporciona siempre un predicado de parada o un
`limit` / `takeWhile` aguas abajo.

**`Cycle` es un conjunto ordenado por inserción.** Los elementos son únicos y conservan el orden en
que se añadieron por primera vez. Un `add` duplicado devuelve `false`, y un `set` que introduciría
uno lanza una excepción. Esto es lo que permite que una fase sea función del *elemento* y no de la
posición que resulte ocupar.

**`Spectrum` asume una señal real en sus auxiliares de un solo lado.** `oneSided()`, `getNyquist()` y
`centroid()` asumen simetría conjugada. El espectro espacial de un anillo de fase es complejo y en
general no simétrico: un anillo que recorre el círculo hacia atrás pone toda su energía en el bin
`n − 1`, más allá de Nyquist. Lee los bins directamente.

---

<a id="13-license"></a>
## 13. Licencia

MIT © Eloy Kim
