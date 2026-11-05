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
- 684 pruebas de regresión: `npm test`.
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
13. [Anillos de fase: un ciclo exacto](#13-phase-rings)
14. [Análisis de señales: ventanas, espectros y tiempo](#14-signal-analysis)
15. [Licencia](#15-license)

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
                    └── every operator returns a new Semantic wrapping a generator
```

| Capa | Módulo | Responsabilidad |
| :--- | :--- | :--- |
| Fuentes | `synchronous/collectors`, `asynchronous/collectors` | Envolver un iterable, un generador, una promesa, un blob o un destino de eventos |
| Canalizaciones | `synchronous/semantic`, `asynchronous/semantic` | Operadores perezosos y reescritura de índices |
| Collectables | `synchronous/semantic`, `asynchronous/semantic` | Terminales ordenados, desordenados, de estadísticas, de ventanas y personalizados |
| Colectores | `synchronous/collector`, `asynchronous/collector` | Las primitivas de plegado sobre las que se construye cada terminal |
| Matemáticas | `mathematics/*` | Ángulos, complejos, frecuencias, espectros, ventanas, estimadores, epiciclos, anillos de fase |
| Estructuras | `structure/*` | Listas, conjuntos, mapas, árboles, bosques, anillos, campos |
| Errores | `structure/error` | La jerarquía tipada `SemanticError` y sus guardas de marca |

Las familias síncrona y asíncrona comparten un solo vocabulario: los mismos nombres de operador, la misma
semántica de índices, los mismos collectables. Las variantes asíncronas simplemente devuelven promesas y
encolan las escrituras, de modo que una lectura emitida después de una escritura siempre la observa.

### 2.1 Qué movió y qué rompió esta versión

Tres módulos cambiaron de sitio o de forma, y una serie de valores por defecto cambió de significado. Cada comportamiento antiguo sigue siendo alcanzable mediante una opción explícita; nada se eliminó sin un reemplazo.

| Cambio | Antes | Ahora |
| :--- | :--- | :--- |
| Bosques | `structure/tree/rootedForest`, `structure/tree/unionFindForest` | `structure/forest/rootedForest`, `structure/forest/unionFindForest`; `tree/index.ts` ya no los reexporta |
| Errores | errores nativos ad hoc | una jerarquía de quince clases en `structure/error.ts`, con una guarda de marca por clase y el alias `SemanticRangeError` |
| Opciones de estimador | definiciones fijas | `mathematics/quantile.ts` exporta `QuantileMethod`, `QuantileOptions`, `SkewnessEstimator`, `KurtosisEstimator` y `VarianceOptions` |
| `quantile` | Hyndman–Fan tipo 1 | tipo 7 — R `quantile`, NumPy `linear`, Excel `PERCENTILE.INC` |
| `skewness` / `kurtosis` | `g1` / `g2` | los corregidos por sesgo `G1` / `G2` |
| `variance` / `standardDeviation` | `ddof = 0` | `ddof = 1`, envueltos en un `Optional` |
| `decibel` | una función `20·log10` | eliminada; `amplitudeDecibel` (20·log10) y `powerDecibel` (10·log10) |
| `Spectrum.flatness()` | magnitudes sobre ambas mitades | potencias sobre la mitad unilateral |
| `Spectrum.bandEnergy()` | suma bilateral cruda | unilateral por defecto, plegando la mitad conjugada |
| `shortTimeFourierTransform` / `spectrogram` | Hann simétrica, solo tramas completas | Hann periódica, `boundary: "zeros"`, `padded: true` |

Los capítulos 6, 7 y 10 documentan los reemplazos; las consecuencias medidas están en [CHANGELOG.md](./CHANGELOG.md).

---

<a id="3-quick-start"></a>
## 3. Inicio rápido

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
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

---

<a id="6-collectables-and-terminal-operations"></a>
## 6. Collectables y operaciones terminales

### 6.1 Collectables

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

### 6.2 Terminales

Cada terminal vive en el **collectable**, no en el `Semantic`. Eso es lo que «los terminales son explícitos» significa en la práctica: una canalización no produce nada hasta que se nombra un collectable, y `toCollectable()` sin mapper es la forma más barata de nombrarlo.

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

### 6.3 Colectores de estructura

`toArray`, `toSet` y `toMap` terminan una canalización en un contenedor de JavaScript. Otros doce terminales la terminan en una de las estructuras de la propia biblioteca, de modo que el resultado lleva las invariantes que esa estructura garantiza en lugar de las que un array tiene por casualidad. Están disponibles en cada collectable, incluido el collectable desnudo que devuelve `toCollectable()`.

| Terminal | Devuelve | Orden | Coste |
| :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | orden de recorrido | O(n) |
| `toSet()` | `Set<E>` | orden de inserción, SameValueZero | O(n) promedio |
| `toMap(key, value?)` | `Map<K, V>` | orden de inserción; gana la última escritura | O(n) promedio |
| `toOrderedSet(comparator?)` | `SynchronousOrderedSet<E>` | ascendente según el comparador | O(n²) peor caso |
| `toUnorderedSet()` | `SynchronousUnorderedSet<E>` | sin especificar (cubos de hash) | O(n) esperado |
| `toOrderedMap(key, value?)` | `SynchronousOrderedMap<K, V>` | orden de inserción; gana la última escritura | O(n) esperado |
| `toUnorderedMap(key, value?)` | `SynchronousUnorderedMap<K, V>` | sin especificar | O(n) esperado |
| `toList()` | `SynchronousList<E>` | orden de recorrido, duplicados conservados | O(n) |
| `toRing(span?)` | `SynchronousRing<E>` | el orden de recorrido fija las posiciones en el anillo | O(n) |
| `toLRUSet(capacity)` | `SynchronousUnorderedLRUSet<E>` | por recencia; solo sobreviven los últimos `capacity` | O(n²) peor caso |
| `toLRUMap(capacity, key, value?)` | `SynchronousUnorderedLRUMap<K, V>` | por recencia | O(n) esperado |
| `toSkipSet(comparator?)` | `SynchronousSkipSet<E>` | ascendente según el comparador, navegable | O(n²) peor caso |
| `toSkipMap(key, value?)` | `SynchronousSkipMap<K, V>` | según el comparador de claves, navegable | O(n) esperado |
| `toBinarySearchTree(comparator?)` | `SynchronousBinarySearchTree<E>` | ascendente según el comparador, equilibrado en altura | O(n log n) |
| `toRootedForest()` | `SynchronousRootedForest<E>` | el orden de recorrido se vuelve la estructura | O(n) |

El tipo del resultado sigue el tipo de elemento del propio collectable, así que ningún terminal recibe un argumento de tipo: un `SynchronousCollectable<E>` entrega directamente `Array<E>`, `SynchronousList<E>` o `SynchronousOrderedSet<E>`. Solo quedan los argumentos de negocio: el comparador de `toOrderedSet` / `toSkipSet` / `toBinarySearchTree`, la capacidad del par LRU, el span de `toRing` y los extractores de clave y valor de la familia de mapas.

Un anillo es un conjunto, así que los elementos repetidos conservan su primera posición; el resto de estructuras de arriba conserva duplicados salvo que su propio contrato diga otra cosa (`toOrderedSet`, `toUnorderedSet` y `toSkipSet` son conjuntos; `toBinarySearchTree` y `toList` no lo son).

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

Los collectables asíncronos exponen los mismos terminales y resuelven cada uno en una promesa, así que la forma de la llamada solo gana un `await`.

---

<a id="7-statistics-and-windows"></a>
## 7. Estadísticas y ventanas

### 7.1 La superficie estadística

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();                    // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();                    // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();                     // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                       // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance().get();             // 3.2    (n − 1)
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation().get();    // 1.7889 (n − 1)
```

Ambas familias estadísticas exponen la misma superficie — `summate`, `average`, `median`, `mode`, `variance`, `standardDeviation`, `frequency`, `findMaximum`, `findMinimum` — con aritmética `bigint` para `toBigintStatistics()`. Las medidas de dispersión y la familia de cuantiles devuelven un `Optional`, porque una muestra puede ser demasiado pequeña para que estén definidas; desenvuélvelas con `.get()`, `.orElse(…)` o `.isPresent()`.

### 7.2 Estimadores y valores por defecto

Los valores por defecto son las definiciones que usan R, NumPy, pandas y Excel, así que un valor calculado aquí se puede comparar con esas herramientas sin factor de corrección.

| Estadístico | Defecto | Antes | Recuperar el valor antiguo con |
| :--- | :--- | :--- | :--- |
| `quantile(probability)` | Hyndman–Fan tipo 7 | tipo 1 | `{ method: "type-1" }` |
| `interquartileRange()` | Hyndman–Fan tipo 7 | tipo 1 | `{ method: "type-1" }` |
| `skewness()` | `G1` corregido por sesgo | `g1` | `{ estimator: "g1" }` |
| `kurtosis()` | `G2` de exceso corregido por sesgo | `g2` | `{ estimator: "g2" }` |
| `variance()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |
| `standardDeviation()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |

Los nueve tipos de Hyndman–Fan están disponibles como `"type-1"` … `"type-9"`, y `{ excess: false }` vuelve a sumar tres a la curtosis para informar del cuarto momento estandarizado no excesivo. Los tipos de opciones — `QuantileMethod`, `QuantileOptions`, `SkewnessEstimator`, `KurtosisEstimator`, `VarianceOptions` — los exporta `mathematics/quantile.ts`.

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

`G1` y `G2` no están definidos por debajo de tres y cuatro observaciones, y la varianza y la desviación típica muestrales tampoco por debajo de dos con `ddof = 1`. Eso se informa con un `Optional` vacío en lugar de con un cero engañoso:

```typescript
useOf(1, 2, 3).toNumericStatistics().kurtosis().isEmpty();     // true  (G2 needs four observations)
useOf(1, 2).toNumericStatistics().skewness().isEmpty();        // true  (G1 needs three)
useOf(1).toNumericStatistics().variance().isEmpty();           // true  (ddof = 1 needs two)
useOf(1).toNumericStatistics().variance({ ddof: 0 }).get();    // 0
```

Las vistas bigint aceptan las mismas opciones y redondean cada resultado a un `bigint` entero.

### 7.3 Ventanas

Las ventanas vuelven a exponer los elementos almacenados en el búfer como una canalización de canalizaciones, de modo que una ventana se puede consumir sin materializarla antes en un array. Ambas formas incluyen una última ventana parcial.

```typescript
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[2,3],[3,4],[4]]

useFrom([1, 2, 3, 4]).toWindow().tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[3,4]]
```

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
const ring = new AsynchronousRing([1, 2]);
const added   = ring.add(3);          // queued
const sampled = ring.elementAt(2n);   // observes the write above
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

Un `Ring` es un **anillo n-ésimo** (n-fold ring): el número de elementos, el periodo posicional y el número de fases
distintas son el mismo entero `n`. La fase de una posición se calcula a partir de su residuo exacto, así que el
anillo es periódico hasta el bit:

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
import { useField, useRadian } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ): +1 aligned, −1 opposed
const mixed  = useField([0.4, 0.3, 0.3]);  // first three harmonics

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
const ring = new SynchronousRing(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                              // 5
report.missed;                               // 1  ('zz' is not on the ring)
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

Cada fila de referencia informa de `count`, la fase relativa media `mean` y la longitud resultante media
`resultant`. Merece la pena recordar una identidad: **`resultant` es la misma para todas las referencias**,
porque cambiar la línea base solo rota todas las fases relativas en una constante. Lo que difiere por
referencia es el recuento y la media.

```typescript
const ring = new SynchronousRing(["a", "b", "c"]);
ring.scoresAt(0, cosine);                   // one score per position, in [-1, 1]
```

### 10.4 Instrumentos relacionados

| Llamada | Qué responde | Coste |
| :--- | :--- | :--- |
| `purity()` | ¿el anillo sigue siendo la raíz n-ésima de la unidad? | O(n) |
| `resultant(t?)` | ¿cómo de concentrados están los fasores ahora mismo? | O(n) |
| `analyse(data)` | ¿cómo se sitúan estos datos frente a cada elemento? | O(n · m) |
| `toSpectrum()` | el anillo como espectro, con el número de onda en el eje de frecuencias | O(n²) |
| `useAngularSpectrum(ring, instants, plan)` | el plano `(ω, n)` a lo largo del tiempo | O(n² · frames) |

Otros dos primitivos completan el modelo: `combineRings(a, b)` une dos anillos en su mínimo común
múltiplo (un pullback, no un producto: los pares que no pueden compartir un instante simplemente están ausentes), y
`rate()` da a cada elemento su propia frecuencia intrínseca para que un anillo pueda derivar respecto al
entorno. `jetAt`, `windingAt` y `errorIntegralAt` exponen el estado diferencial de esa deriva.

### 10.5 Ventanas espectrales

Las construcciones de anillos son una mitad de la superficie analítica; la otra trabaja sobre señales muestreadas. Su primitiva más reutilizada es la ventana, y cada forma de aquí tiene dos variantes. La variante simétrica divide la trama por `count − 1`; la variante periódica (DFT par) la divide por `count`, un muestreo menos que un periodo completo, de modo que el taper es continuo bajo la extensión periódica que supone la DFT.

```typescript
useHannWindow(1, 4);                                   // 0.75  symmetric
useHannPeriodicWindow(1, 4);                           // 0.5   periodic
coherentGain(useHannPeriodicWindow, 16);               // 0.5
equivalentNoiseBandwidth(useHannPeriodicWindow, 16);   // 1.5
```

| Forma | Simétrica | Periódica | Notas |
| :--- | :--- | :--- | :--- |
| Rectangular | `useRectangularWindow` | — | sin taper; sin distinción periódica |
| Hann | `useHannWindow` | `useHannPeriodicWindow` | la opción por defecto del análisis de corto plazo |
| Hamming | `useHammingWindow` | `useHammingPeriodicWindow` | — |
| Blackman | `useBlackmanWindow` | `useBlackmanPeriodicWindow` | — |
| Nuttall | `useNuttallWindow` | `useNuttallPeriodicWindow` | Blackman–Harris de cuatro términos |
| Flat-top | `useFlatTopWindow` | `useFlatTopPeriodicWindow` | precisión de amplitud antes que resolución |
| Kaiser | `useKaiserWindow(beta)` | `useKaiserPeriodicWindow(beta)` | `beta` fija el ancho del lóbulo principal |

Usa la variante periódica para el análisis y el overlap-add: con un salto de media trama, la ventana de Hann periódica suma `1.000000` a cualquier longitud, mientras que la simétrica ondula `0.841 dB` con `N = 16` y todavía `0.013 dB` con `N = 1024`. Conserva la variante simétrica para el diseño de filtros, donde la trama no es un periodo del taper.

Las ventanas flat-top devuelven **pesos negativos** cerca de los extremos de la trama, porque una ventana flat-top es exactamente eso. Se devuelven sin recortar, porque recortarlos perturba el lóbulo principal y destruye la baja pérdida de scalloping que justifica la existencia de la ventana:

```typescript
useFlatTopWindow(0, 1024);                             // -0.000421 — negative by definition
Array.from({ length: 1024 }, (_unused, index) => useFlatTopWindow(index, 1024))
  .filter(weight => weight < 0).length;                // 578
```

### 10.6 Niveles, planitud y energía de banda

`decibel` ha desaparecido como función única, porque una amplitud y una potencia no comparten factor. `amplitudeDecibel` aplica `20·log10` a una razón de tipo tensión; `powerDecibel` aplica `10·log10` a una potencia, una energía, un cuadrado medio o una densidad espectral de potencia:

```typescript
amplitudeDecibel(0.25);                                // -12.0412
powerDecibel(0.25);                                    //  -6.0206
```

`Bin.decibel` y `Spectrum.decibelOf` son niveles de amplitud; `Spectrum.powerDecibelOf` es el nivel de potencia correspondiente. Dar una potencia a la forma de amplitud informa `20·log10(power)` y duplica el nivel en decibelios.

Dos medidas del espectro cambiaron de lectura:

```typescript
const twoBins = new Spectrum(new Sample(2, 1), [new Complex(2, 0), new Complex(1, 0)]);
twoBins.flatness();                                    // 0.8 — geometric over arithmetic mean of power

const shape = new Spectrum(new Sample(4, 1), [
  new Complex(1, 0), new Complex(2, 0), new Complex(0, 0), new Complex(0, 0),
]);
shape.bandEnergy(new Frequency(0), new Frequency(2));                // 9
shape.bandEnergy(new Frequency(0), new Frequency(2), "two-sided");   // 5
```

`flatness()` compara las medias geométrica y aritmética de `power()` sobre la mitad unilateral del espectro, no la media de magnitudes sobre ambas mitades, y el doblado de amplitud de `oneSided()`, que es solo para visualización, no se aplica deliberadamente. `bandEnergy()` usa por defecto la lectura unilateral, plegando la mitad conjugada: DC y Nyquist cuentan una vez y cada bin interior cuenta dos; una banda que cubre todo el eje satisface entonces Parseval, `Σ|X|² = N·Σx²`. Pasa `"two-sided"` para un espectro complejo, cuyos bins ya son independientes.

### 10.7 Análisis de corto plazo

`Sampler.shortTimeFourierTransform` y `Sampler.spectrogram` siguen las convenciones de `stft` de SciPy: ventana de Hann periódica, borde relleno de ceros en ambos extremos y cola rellena de ceros.

```typescript
const sampler = new Sampler(new Sample(64, 1));
const spectrogram = sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8);

spectrogram.size();                     // 9 frames
spectrogram.getBoundary();              // "zeros"
spectrogram.getTime(6);                 // 0.75 — frame centres, not frame starts
sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8, useHannWindow,
  { boundary: "none", padded: false }).size();                       // 7 — complete frames only
```

La extensión centra la primera trama en el primer muestreo, y el relleno de cola mantiene alcanzables los últimos muestreos: 64 muestreos con trama 16 y salto 8 producen 9 tramas en vez de 7, y 1000 muestreos con trama 256 y salto 128 producen 9 en vez de 6. Los tiempos de trama son centros — `(k·hop + (frameSize mod 2)/2)/rate` para una vista extendida, `(k·hop + frameSize/2)/rate` para una no extendida — y `toFrame()` recorta la extensión antes de invertir.

---

<a id="11-utility-helpers"></a>
## 11. Funciones auxiliares

### 11.1 La jerarquía de errores

`structure/error.ts` exporta una jerarquía de quince clases para los errores lanzados *alrededor* de una canalización: por tu propio código, un colector personalizado o un adaptador.

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

Cada clase fija `name`, reenvía la `cause` nativa, lleva una bolsa `context` opcional y se serializa mediante `toJSON()`; cada una tiene una guarda de marca con su mismo nombre.

```typescript
const error = new CapacityError("LRU capacity exhausted", { context: { capacity: 0 } });

error.name;                 // "CapacityError"
isCapacityError(error);     // true
isValidationError(error);   // false — a capacity failure is not a validation failure
isSemanticError(error);     // true
error.toJSON();             // { name: "CapacityError", message: "…", context: { capacity: 0 } }
```

`SemanticRangeError` es la misma clase que el `RangeError` exportado, así que `instanceof` se cumple con ambos nombres; importar `RangeError` ensombrece el constructor global en todo el módulo, y por eso existe el alias. Ninguna de las dos clases la lanza la comprobación de argumentos de la biblioteca, que sigue lanzando `TypeError` y `RangeError` nativos: la jerarquía es el vocabulario de la capa de arriba.

### 11.2 Tabla de utilidades

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

### 11.3 `useTraverse`

`useTraverse(target, callback)` aplana cualquier objeto en sus **hojas no nulas**. Desciende por los objetos anidados, recorre los valores iterables por posición, omite `null` y `undefined` y nunca vuelve a entrar en un objeto que ya visitó; así, un grafo de objetos con un ciclo termina en lugar de desbordar la pila.

```typescript
const source = { id: 7, tags: ["a", "b"], owner: { name: "Ada", note: null } };
const leaves: string[] = [];

useTraverse(source, (key, value, path) => {
  leaves.push(`${path.join(".")} = ${String(value)}`);
  return true;
});

leaves;   // ["id = 7", "tags.0 = a", "tags.1 = b", "owner.name = Ada"]
```

El callback se ejecuta una vez por hoja y recibe la clave propia de la hoja (su índice cuando proviene de un iterable), el valor y la ruta que lleva hasta ella. Devolver `false` abandona **todo** el recorrido, no solo la rama actual:

```typescript
let visited = 0;
useTraverse({ a: 1, b: 2, c: 3 }, () => {
  visited += 1;
  return false;
});
visited;   // 1 — the first leaf already stops the walk
```

Un ciclo es seguro por la misma razón:

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

**Cada callback recibe su propia instantánea de la ruta.** El recorrido mantiene internamente un único array de trabajo y lo copia, en el momento de entregar una hoja, a un array nuevo congelado con `Object.freeze`. La instantánea ya no cambia, así que puede guardarse tal cual; dos callbacks nunca comparten un array, y repetir el recorrido no altera las instantáneas ya entregadas. Su tipo es `ReadonlyArray`, de modo que escribir en ella es un error de compilación, y el array congelado lanza además un `TypeError` en tiempo de ejecución. Esa seguridad cuesta una asignación `O(depth)` por hoja informada; una rama que no informa nada no asigna nada extra.

```typescript
const paths: Array<ReadonlyArray<PropertyKey>> = [];
useTraverse({ a: { b: 1 }, c: 2 }, (_key, _value, path) => {
  paths.push(path);                      // safe to keep as-is
  return true;
});
paths[0] === paths[1];                   // false — one array per call
paths.map(path => path.join("."));       // ["a.b", "c"]
```

`useAttribute` es este recorrido convertido en fábrica: informa de las mismas hojas como pares `{ key, value }`, así que las reglas —y el coste— son idénticos.

```typescript
useAttribute({ a: 1, b: { c: 2 } }).toUnordered().toArray();
// [{ key: "a", value: 1 }, { key: "c", value: 2 }]
```

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

**`Ring` es un conjunto ordenado por inserción.** Los elementos son únicos y conservan el orden en
que se añadieron por primera vez. Un `add` duplicado devuelve `false`, y un `set` que introduciría
uno lanza una excepción. Esto es lo que permite que una fase sea función del *elemento* y no de la
posición que resulte ocupar.

**`Spectrum` asume una señal real en sus auxiliares de un solo lado.** `oneSided()`, `getNyquist()` y
`centroid()` asumen simetría conjugada. El espectro espacial de un anillo de fase es complejo y en
general no simétrico: un anillo que recorre el círculo hacia atrás pone toda su energía en el bin
`n − 1`, más allá de Nyquist. Lee los bins directamente.

**Los colectores de estructura son terminales, no vistas.** Cada uno vacía la canalización y luego construye una estructura completa, así que cuesta O(n) de tiempo y de espacio y no puede ejecutarse sobre una fuente infinita. Úsalo al final de una canalización, nunca dentro de un bucle sobre una.

**`variance()` y sus compañeros devuelven un `Optional`.** `variance().get()` sobre una muestra demasiado pequeña lanza una excepción; usa `.orElse(0)` o comprueba `.isPresent()` cuando el tamaño de la muestra no está bajo tu control. Lo mismo vale para `standardDeviation`, `quantile`, `interquartileRange`, `skewness` y `kurtosis`.

**Las ventanas periódicas son las ventanas de análisis.** `useHannWindow` y las demás formas simétricas son para diseño de filtros; un análisis de corto plazo quiere `useHannPeriodicWindow` y sus hermanas, o la suma de overlap-add ondulará en cada unión de tramas.

---

<a id="13-phase-rings"></a>
## 13. Anillos de fase: un ciclo exacto

El capítulo 10 presentó el anillo como el modelo del ciclo y lo usó para medir un conjunto de datos
contra cada fase. Este capítulo es la superficie completa: cómo una posición se convierte en un
ángulo, qué cambia y qué no cambia la frecuencia ambiente, y los instrumentos que leen el anillo
contra el tiempo, contra los datos y contra otro anillo.

Un `SynchronousRing` es una lista posicional respaldada por un anillo circular doblemente enlazado
cuya cabeza y cola están unidas. Es también un *conjunto* ordenado por inserción: ningún elemento
aparece dos veces, y una escritura rechazada deja intactos tanto los enlaces como las muestras. Lo
que lo convierte en anillo y no en una lista es que la fase de una posición es una función pura de
su resto módulo la longitud actual, así que el anillo es periódico al bit y su equilibrio no puede
derivar.

### 13.1 Un anillo es un entero, calculado exactamente

Un anillo lleva `n` elementos, y el número de elementos, el periodo posicional y el número de fases
distintas son el mismo entero. La posición `i` lleva

`phase + span · 2π · (((i mod n) + n) mod n) / n`

con el resto reducido en `bigint` antes de convertirse en `number`. Esa es toda la razón por la que
`phaseAt(i)` y `phaseAt(i + n)` son *idénticos* y no meramente parecidos: la segunda llamada se
reduce al mismo entero, evalúa el mismo producto y produce el mismo doble. Un índice mucho más allá
del rango entero exacto de `number` aterriza igualmente en la posición correcta, y un índice
negativo recorre el anillo hacia atrás.

| Llamada | Devuelve | Significado |
| :--- | :--- | :--- |
| `new SynchronousRing(source, options?)` | anillo | `source` es cualquier iterable, los duplicados se descartan |
| `getPhase()` / `getFrequency()` / `getSpan()` | `Angle`, `Frequency`, `number` | los tres parámetros de construcción |
| `size()` | `bigint` | el `n` que también es el periodo |
| `phaseAt(index)` | `Optional<Angle>` | solo fase intrínseca; ignora tiempo, tasa y frecuencia |
| `elementAt(index)` | `Optional<RingElement>` | elemento, fase intrínseca, frecuencia ambiente, fasor |
| `frequencyAt(index)` | `Optional<Frequency>` | la tasa ambiente, vacía en un anillo vacío |
| `toComplex()` / `toComplex(index)` | `Complex[]` / `Optional<Complex>` | fasores intrínsecos |

`RingOptions` añade dos funciones por elemento: `magnitude(element, index)` da la longitud del fasor
y vale uno por defecto, y `rate(element, index)` da al elemento su propia frecuencia intrínseca y
vale cero por defecto, es decir, un marcador fijo.

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

`phaseAt(-1n)` vale `300` en un anillo de seis elementos, y `10n ** 20n` se reduce a `4` módulo
seis, así que se lee `240`. Ninguno de los dos casos acumula un producto en coma flotante, que es lo
que mantiene exacta la identidad cuando cambia la representación del índice.

### 13.2 La frecuencia ambiente y el estado en un instante

`frequency` es la **velocidad de rotación ambiente** del entorno en el que está inmerso el anillo,
no un paso de fase entre posiciones. El entorno avanza la fase de cada elemento el mismo ángulo, así
que no puede cambiar el patrón intrínseco, ni romper el equilibrio, ni alterar ningún resultado de
`phaseAt`. Su valor por defecto es `0 Hz`.

`relativeAt(index, time)` resta ese ángulo común y deja la coordenada contra la que se puntúa un
`PhaseField`. `viewAt` y `viewsAt` devuelven el estado completo en un instante, incluida la `rate`
propia del elemento, y los accesores diferenciales exponen la deriva:

| Llamada | Fórmula | Lee |
| :--- | :--- | :--- |
| `relativeAt(index, time)` | `intrínseca + tasaPropia · t − ambiente · t` | la fase que ve el entorno |
| `viewAt(index, time)` / `viewsAt(time)` | lo mismo, más elemento, índice, tiempo, tasa, fasor | el estado completo |
| `jetAt(index, time)` | fase en `t`, tasa propia, `slip = tasaPropia − ambiente` | el estado diferencial |
| `windingAt(index, time)` | `trunc(slip · t)` | vueltas enteras deslizadas, truncadas hacia cero |
| `errorIntegralAt(index, time, origin?)` | `∫ fase relativa dt`, en vueltas · segundos | cuánto tiempo lleva adelantado un elemento |
| `resultant(time?)` | `abs(Σ w · e^{iθ}) / Σ w` | concentración de fase, inmune a la rotación ambiente |
| `analyse(data, time?)` | cuentas y medias por referencia | los datos medidos contra cada elemento |
| `scoreAt(index, time, field)` / `scoresAt(time, field)` | el campo muestreado en la fase relativa | una puntuación acotada por posición |

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

A `1 Hz` el entorno avanza un cuarto de vuelta en `0.25 s`, así que la fase relativa de la posición
uno es `60 − 90 = 330` grados mientras su fase intrínseca sigue siendo `60`. El jet informa un
`slip` de `-1` hercios porque el elemento mismo no se mueve, y `purity()` sigue valiendo `1`:
rotar todos los fasores el mismo ángulo no es una deformación.

### 13.3 Pureza y equilibrio

`purity()` es la parte de la energía del anillo que porta el modo fundamental:

`max(abs(c₁)², abs(c_{n−1})²) / (n · Σ abs(z)²)`

Se prueban los dos bins fundamentales porque un anillo puede recorrer el círculo en cualquier
dirección. Un anillo construido con `span: 5` sobre seis elementos avanza `300` grados, es decir
`−60` grados: gira al revés, coloca toda su energía en `c₅` y una fórmula que solo mirara `c₁` lo
declararía impuro. El coste sigue siendo `O(n)` porque solo hacen falta esos dos bins y la energía
total.

Los casos límite forman parte del contrato. Un anillo de menos de dos elementos no tiene modo
fundamental y reporta `purity() === 0` e `isBalanced() === false`, sea cual sea su contenido. Un
anillo cuyos fasores tienen todos longitud cero no tiene energía y también reporta cero.
`isBalanced(epsilon?)` es `1 − purity() <= epsilon`, con `1E-9` como tolerancia por defecto.

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

### 13.4 Longitud resultante y componentes simétricas

`resultant(time?)` es la longitud resultante media: el módulo de la suma de fasores dividido por la
suma de los módulos. A diferencia de `purity`, que pregunta si el anillo sigue siendo las raíces
`n`-ésimas de la unidad, `resultant` pregunta cuán concentrados están los fasores ahora mismo. Un
anillo equilibrado reporta `0`; un anillo cuyos elementos comparten un mismo ángulo reportaría `1`,
pero la semántica de conjunto prohíbe los duplicados, así que en la práctica `1` aparece cuando
`magnitude` anula todos menos uno.

`zeroSequence()` es el fasor medio, es decir `c₀ / n`. `sequences()` devuelve las `n` componentes
simétricas, de menor orden a mayor, mediante una transformada directa. `toSpectrum()` las envuelve
en un `Spectrum` cuyo bin `j` reporta `j` ciclos por vuelta de anillo, así que el eje de frecuencias
es el eje de números de onda.

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

Las componentes son complejas y en general **no conjugadas-simétricas**: un anillo equilibrado pone
toda su energía en el bin uno, y uno que gira al revés en el bin `n − 1`. Los ayudantes unilaterales
de `Spectrum` suponen una señal real; lea los bins directamente en lugar de plegarlos.

### 13.5 Analizar datos contra cada elemento

`analyse(data, time?)` empareja cada observación con el anillo por identidad y la mide contra cada
elemento como fase de referencia. Las observaciones que el anillo no contiene se cuentan como
`missed` en lugar de adivinarse, porque el anillo es la única fuente de fases. Cada fila de
referencia reporta `count`, la fase relativa media `mean` y la longitud resultante media `resultant`.

Una identidad merece recordarse: **`resultant` es la misma para cada referencia**. Cambiar la base
solo rota todas las fases relativas una constante, y una rotación no puede cambiar una longitud
resultante. Lo que difiere por referencia es la cuenta y la media.

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

La puntuación es la otra cara de la misma moneda. Un `PhaseField` es una serie de cosenos acotada
(capítulo 10.2), y `scoreAt`/`scoresAt` lo muestrean en la fase relativa, así que el mismo anillo
puede puntuarse contra una alineación, contra un patrón armónico o contra cualquier campo sin
cambiar el anillo.

```typescript
import { SynchronousRing, useField } from "semantic-typescript";

const round = (value: number): number => Number(value.toFixed(4));
const ring = new SynchronousRing(["a", "b", "c", "d", "e", "f"]);
const cosine = useField([1]);

round(ring.scoreAt(0n, 0, cosine).get());                                  // 1
round(ring.scoreAt(1n, 0, cosine).get());                                  // 0.5
ring.scoresAt(0, cosine).map(score => round(score));                       // [1, 0.5, -0.5, -1, -0.5, 0.5]
```

### 13.6 Combinar anillos y el espectro angular

`combineRings(left, right)` une dos anillos por su mínimo común múltiplo, no por su producto. El
instante `i` del anillo conjunto lee `i mod m` del anillo izquierdo e `i mod n` del derecho, así que
el anillo conjunto se cierra tras `lcm(m, n)` instantes. Los pares que nunca pueden coexistir —los
que difieren en posición módulo `gcd(m, n)`— simplemente no existen; por eso el resultado es un
pullback y no un producto, y `aligns(left, right)` informa si un par dado es representable.

`useAngularSpectrum(ring, instants, plan)` construye el plano `(ω, n)`: cada instante aporta una
trama de fasores, la trama `k` del modo `j` es la `j`-ésima componente simétrica de esa trama, y
`cells[frame][order]` es el coeficiente. Tomar una columna da la serie temporal de un único modo
espacial, y `spectrum(order)` es su espectro temporal.

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

### 13.7 Trampas

**La exactitud es exacta.** `phaseAt(i)` y `phaseAt(i + n)` son el mismo doble, no dos valores
dentro de una tolerancia. Un anillo construido acumulando `2π / n` por elemento fallaría esto; este
reduce primero el índice en `bigint`.

**`frequency` no es un paso de fase.** Es la velocidad de rotación ambiente, vale cero por defecto,
y rotar todos los fasores el mismo ángulo no puede romper el patrón intrínseco. Si quiere que las
posiciones avancen unas respecto de otras, use `rate`, no `frequency`.

**`purity()` debe mirar los dos bins fundamentales.** Un anillo que gira al revés sigue siendo las
raíces `n`-ésimas de la unidad; solo `c₁` lo declararía impuro.

**`n < 2` es un caso límite definido.** `purity()` devuelve `0` e `isBalanced()` devuelve `false`;
un anillo vacío devuelve opcionales vacíos en los métodos de muestreo.

**Un span que comparte un factor con `n` colapsa la órbita.** Seis elementos con `span: 2` visitan
solo tres fases distintas, y el anillo deja de estar equilibrado.

**`resultant` es invariante a la rotación, no al tiempo.** La rotación ambiente lo deja igual; las
`rate` por elemento lo cambian a medida que el anillo se desfasa.

**El anillo es un conjunto, y `analyse` empareja por identidad.** Los duplicados se descartan al
construir, y un objeto estructuralmente igual a un elemento del anillo pero que no es la misma
referencia se cuenta como perdido.

**`toSpectrum()` es complejo.** Sus bins no son conjugados-simétricos, así que los ayudantes
unilaterales de `Spectrum` no aplican. Lea los bins.

**`windingAt` trunca hacia cero, y `errorIntegralAt` integra la fase.** Media vuelta de deslizamiento
reporta `0n`; la integral de error está en vueltas · segundos, no es una tasa.

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
## 14. Análisis de señales: ventanas, espectros y tiempo

El capítulo 10 trataba un anillo como un ciclo de fases. Este capítulo es su contraparte temporal:
un registro real que lleva, además de sus muestras, los dos contextos que necesita toda fórmula
espectral — el plan de muestreo que convierte un índice de bin en hercios, y la ventana que fija a
la vez la ganancia coherente y el ancho de banda de ruido.

El objeto valor es `SynchronousSignalCollectable`, y su gemelo en cola es
`AsynchronousSignalCollectable`. Ambos exponen la misma superficie `SignalCollectable`:
veintitrés métodos, cada uno delegando en exactamente una fábrica `useSynchronous<Method>` de
`synchronous/collectors`. La separación es deliberada. La clase es una fachada documentada, la
fábrica posee la acumulación, y el constructor calcula una sola vez, a esta longitud,
`sum(w) / count` y `count * sum(w^2) / sum(w)^2`. Quien tenga que recordar «dividir por la
ganancia coherente» acabará olvidándolo, y los 6,02 decibelios resultantes parecen una medición
plausible.

### 14.1 Una señal lleva su propia calibración

Una señal se construye desde un iterable y una tasa, desde un `Frame` existente, o desde el
constructor con un `Sample` explícito. La ventana por defecto es la ventana de Hann periódica;
toda análisis que no nombre una la usa, y todo análisis acepta una sustitución. Los accesores de
metadatos leen en tiempo constante un estado fijado en la construcción, así que una señal puede
pasarse de mano en mano sin que el contexto derive.

| Llamada | Devuelve | Significado |
| :--- | :--- | :--- |
| `SynchronousSignalCollectable.useRate(values, rate, window?)` | señal | duración `count / rate` |
| `SynchronousSignalCollectable.useFrame(frame, window?)` | señal | conserva el plan del frame |
| `new SynchronousSignalCollectable(plan, values, window?)` | señal | el número de tramas debe igualar el de muestras |
| `getSample()` / `getValues()` / `getWindow()` | plan, muestras, ventana | el contexto congelado |
| `getRate()` | `number` | muestras por segundo |
| `getNyquist()` / `getResolution()` | `Frequency` | `rate / 2` y `rate / count` |
| `getCoherentGain()` / `getNoiseBandwidth()` | `number` | recalculados a esta longitud exacta |
| `size()` / `at(index)` / `toFrame()` / `equals(other)` / `toString()` | — | semántica de valor |

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

`getResolution()` es el espaciado entre bins, no el poder de resolución: vale `rate / count`
porque la transformada tiene `count` bins, y rellenar con ceros cambia el espaciado sin cambiar
qué puede separar la ventana (sección 14.8).

### 14.2 Los veintitrés métodos

Los métodos forman seis familias. Siete son lecturas espectrales, dos son transformadas
tiempo–frecuencia, cuatro son magnitudes analíticas, tres son estadísticos de secuencia, cinco son
descriptores de forma, y dos devuelven otra señal.

| Método | Devuelve | Convención |
| :--- | :--- | :--- |
| `spectrum(size?, window?)` | `Spectrum` | crudo y sin normalizar, rejilla compleja completa |
| `oneSided(size?, window?)` | `Bin[]` | mitad conjugada plegada, DC y Nyquist sin duplicar |
| `amplitude(window?)` | `number[]` | `2·abs(X) / (count · CG)`, DC y Nyquist una sola vez |
| `power(window?)` | `number[]` | `A² / 2` por bin interior, `A²` en DC y Nyquist |
| `decibel(window?)` | `number[]` | `20·log10(amplitud)` |
| `powerDecibel(window?)` | `number[]` | `10·log10(potencia)` |
| `powerSpectralDensity(frameSize?, hopSize?, window?)` | `SpectralDensity` | media de Welch, `abs(X)² / (rate · Σw²)` |
| `shortTimeFourierTransform(frameSize, hopSize, window?)` | `Spectrum[]` | bordes extendidos, tiempos en el centro de trama |
| `spectrogram(frameSize, hopSize, window?)` | `Spectrogram` | las mismas columnas con eje de tiempo |
| `analyticSignal()` | `Complex[]` | par de Hilbert `x + i·H(x)` |
| `instantaneousPhase()` | `Angle[]` | plegada en `[0, 2π)` |
| `instantaneousFrequency(rate?, gate?)` | `number[]` | diferencia de fase desenvuelta, con puerta de envolvente |
| `envelope()` | `number[]` | `abs(z[n])`, circular en los bordes |
| `zeroCrossingRate(perSecond?)` | `number` | cruces por par de muestras adyacentes |
| `spectralFlux(frameSize?, hopSize?, window?)` | `number[]` | distancia de norma unitaria entre tramas |
| `autocorrelation(maximumLag?, normalization?)` | `number[]` | coeficiente por defecto, `ρ[0] = 1` |
| `spectralCentroid(window?)` | `Optional<Frequency>` | frecuencia media ponderada por potencia |
| `spectralBandwidth(window?)` | `Optional<Frequency>` | desviación típica ponderada por potencia |
| `spectralRolloff(ratio?, window?)` | `Optional<Frequency>` | primer bin que alcanza `ratio` de la potencia |
| `spectralFlatness(window?)` | `number` | media geométrica sobre aritmética de la potencia |
| `signalToNoiseRatio(frameSize?, hopSize?, window?, floorQuantile?)` | `Optional<number>` | suelo mediano, `10·log10` |
| `detrended(mode?)` | señal | `"none"`, `"constant"` (defecto), `"linear"` |
| `windowed(window?)` | señal | aplica una ventana y la adopta |

Los argumentos opcionales no son decoración. `frameSize` vale `min(256, size)` por defecto, el
salto media trama redondeada hacia abajo, `instantaneousFrequency` pone la puerta en `1E-3` de la
envolvente de pico, y `spectralRolloff` usa `0.85`. Cada valor por defecto es el que elige una
implementación de referencia cuando el parámetro se nombra pero no se pasa.

### 14.3 Amplitud, potencia y densidad

Hacen falta tres normalizaciones porque se hacen tres preguntas distintas.

`amplitude()` responde «qué tamaño tiene el seno en este bin»: `2·abs(X[k]) / (count · CG)` para
un bin interior y `abs(X[k]) / (count · CG)` en DC y Nyquist. El factor dos pliega la mitad
conjugada; la ganancia coherente quita la ventana. Omitir cualquiera de los dos hace que un seno de
amplitud unidad se lea `0.5`, es decir, menos 6,02 decibelios.

`power()` responde «qué cuadrado medio tendría un seno en este bin»: `A² / 2` para un bin interior
y `A²` en DC y Nyquist, porque estos dos no oscilan. Es la convención de pico, y deliberadamente no
cumple Parseval: la ventana reparte cada línea por su lóbulo principal, así que la suma de todos los
bins supera el cuadrado medio en el ancho de banda de ruido equivalente — `1.5` para Hann.

`powerSpectralDensity()` responde «cuánta potencia por hercio»: `abs(X)² / (rate · Σw²)`,
promediada sobre segmentos solapados. Solo la suma de los pesos al cuadrado mantiene insesgado un
suelo de ruido blanco; dividir por `count` lee `0.375` para ruido unitario, dividir por
`count · CG²` lee `1.5`.

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

El par de totales es la comprobación que conviene recordar: la suma en convención de pico vale
`0.75` mientras que la densidad integra `0.5`, y la razón es exactamente el ancho de banda de
ruido. La densidad es además la única de las tres que sobrevive a un cambio de longitud de trama.

### 14.4 Niveles: las dos convenciones de decibelio

Una amplitud y una potencia no comparten factor, así que tampoco comparten logaritmo.
`amplitudeDecibel` aplica `20·log10` y es correcto para una tensión, un desplazamiento o una
presión sonora; `powerDecibel` aplica `10·log10` y es correcto para una potencia, una energía, un
cuadrado medio o una densidad. Los nombres de método de la señal siguen la misma división.

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

Las dos lecturas del mismo tono son correctas: su amplitud es uno (cero decibelios) y su cuadrado
medio es un medio (menos 3,01 decibelios). Pasar una potencia por la convención de amplitud
duplicaría el nivel en decibelios, convirtiendo el menos 6,02 correcto en menos 12,04.

### 14.5 El plegado unilateral

Una señal real cumple `X[count − k] = conj(X[k])`, así que la mitad de frecuencias negativas no
lleva información independiente. El plegado duplica cada bin interior y deja los dos bins
autoconjugados — DC y, para longitud par, Nyquist — exactamente como los produjo la transformada.
Esos dos son su propio espejo; duplicarlos inventa energía y reporta exactamente 6,02 decibelios de
más.

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

Las magnitudes crudas son `16` y `8` porque los pesos de la ventana suman ocho; dividir por
`count · CG = 8` las convierte en las amplitudes calibradas `2` y `1`. Duplicar los bins de borde
leería `4` y `2`, y el error nunca lanzaría una excepción.

### 14.6 Vistas tiempo–frecuencia

`shortTimeFourierTransform` y `spectrogram` enmarcan el registro como la transformada de corto
tiempo de referencia: media trama de ceros en cada extremo y luego una cola rellenada con ceros
hasta completar un número entero de saltos. La primera trama se centra en la primera muestra, la
última alcanza la última muestra, y la trama `m` se centra en `m · hop / rate` segundos. Conservar
solo las tramas completas descartaría hasta `frameSize − 1` muestras — para 1000 muestras, trama
256 y salto 128 son 104 muestras, alrededor de una décima parte del registro.

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

Cada columna es un `Spectrum` de `frameSize` bins, exactamente lo que produciría `spectrum()` para
la misma trama, y `getTime()` informa centros de trama, no inicios.

### 14.7 Ventanas, ganancia coherente y COLA

Cada forma tiene dos variantes. La simétrica divide por `count − 1`; la periódica (DFT par) divide
por `count`, una muestra menos que un periodo completo, de modo que la ventana es continua bajo la
extensión periódica que supone la DFT. El análisis y la suma con solapamiento necesitan la forma
periódica; el diseño de filtros conserva la simétrica.

La diferencia es medible y nunca lanza un error. Al cincuenta por ciento de solapamiento, la
ventana de Hann periódica suma uno en toda posición; la forma simétrica ondula, `0.84` decibelios
con dieciséis muestras, `0.21` con sesenta y cuatro y todavía `0.013` con mil veinticuatro. La
clase expone la ganancia coherente y el ancho de banda de ruido equivalente de la ventana que
guarda, así que la corrección nunca está codificada a mano: un Hann simétrico lee `0.4375` con
ocho muestras, no `0.5`.

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

La fila del flat-top no es un error de la tabla. Una ventana flat-top es parcialmente negativa por
definición — aquí 578 de 1024 pesos — y recortar esos pesos a cero perturbaría el lóbulo principal
y destruiría la baja pérdida de scalloping para la que existe la ventana. La biblioteca devuelve la
serie sin cambios.

### 14.8 Trampas

**Rellenar con ceros interpola, nunca resuelve.** Una longitud de transformada mayor que el número
de muestras muestrea la misma DTFT con más densidad: la *posición* del pico se afina y el espaciado
entre bins pasa a `rate / size`, pero la capacidad de separar dos componentes sigue gobernada por
la longitud y la forma de la ventana. Un tono exactamente entre dos bins lee `82.1093` y `80.8598`
en la rejilla sin relleno, y `128` en su propia frecuencia en la rejilla rellenada.

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

Dos tonos iguales separados `0.4` bins siguen fusionados con cualquier relleno: con un registro de
256 puntos y una ventana de Hann, rellenar hasta 8192 produce un solo máximo local, no dos.

**La transformada de Hilbert es circular.** `analyticSignal`, `envelope` e `instantaneousPhase`
tratan la primera y la última muestra como vecinas, así que un registro cuya periodo no divide su
longitud queda contaminado en ambos extremos. El centro del registro es fiable; los extremos no.

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

**Una envolvente que se anula no define una fase.** Donde la envolvente se desploma, la diferencia
de dos ángulos de ruido de redondeo puede llegar a media vuelta, lo que se lee como la mitad de la
tasa de muestreo. La puerta es lo que mantiene significativo el número, y el valor por defecto es
`1E-3` de la envolvente de pico.

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

**Una correlación sin normalizar no es una similitud.** La suma cruda `r[k]` crece con la longitud
del registro, así que dos longitudes no son comparables. La regla por defecto `"coefficient"`
divide por `r[0]` y mantiene cada valor en `[-1, 1]`; `"unbiased"` divide por `count − k` y paga
con una varianza que crece con el desfase.

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

Una lectura más merece advertencia: `spectralFlux` normaliza cada trama antes de compararla, así
que un cambio puro de nivel produce flujo cero. Su primer y último valor son artefactos de borde de
la frontera de ceros, no ataques.

---

<a id="15-license"></a>
## 15. Licencia

MIT © Eloy Kim
