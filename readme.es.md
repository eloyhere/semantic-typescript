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
- 622 pruebas de regresión: `npm test`.
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
| `toCycle(span?)` | `SynchronousCycle<E>` | el orden de recorrido fija las posiciones en el anillo | O(n) |
| `toLRUSet(capacity)` | `SynchronousUnorderedLRUSet<E>` | por recencia; solo sobreviven los últimos `capacity` | O(n²) peor caso |
| `toLRUMap(capacity, key, value?)` | `SynchronousUnorderedLRUMap<K, V>` | por recencia | O(n) esperado |
| `toSkipSet(comparator?)` | `SynchronousSkipSet<E>` | ascendente según el comparador, navegable | O(n²) peor caso |
| `toSkipMap(key, value?)` | `SynchronousSkipMap<K, V>` | según el comparador de claves, navegable | O(n) esperado |
| `toBinarySearchTree(comparator?)` | `SynchronousBinarySearchTree<E>` | ascendente según el comparador, equilibrado en altura | O(n log n) |
| `toRootedForest()` | `SynchronousRootedForest<E>` | el orden de recorrido se vuelve la estructura | O(n) |

El tipo del resultado sigue el tipo de elemento del propio collectable, así que ningún terminal recibe un argumento de tipo: un `SynchronousCollectable<E>` entrega directamente `Array<E>`, `SynchronousList<E>` o `SynchronousOrderedSet<E>`. Solo quedan los argumentos de negocio: el comparador de `toOrderedSet` / `toSkipSet` / `toBinarySearchTree`, la capacidad del par LRU, el span de `toCycle` y los extractores de clave y valor de la familia de mapas.

Un ciclo es un conjunto, así que los elementos repetidos conservan su primera posición; el resto de estructuras de arriba conserva duplicados salvo que su propio contrato diga otra cosa (`toOrderedSet`, `toUnorderedSet` y `toSkipSet` son conjuntos; `toBinarySearchTree` y `toList` no lo son).

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
const cycle = new AsynchronousCycle([1, 2]);
const added   = cycle.add(3);          // queued
const sampled = cycle.elementAt(2n);   // observes the write above
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
const ring = new SynchronousCycle(["a", "b", "c", "d", "e"]);
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
const cycle = new SynchronousCycle(["a", "b", "c"]);
cycle.scoresAt(0, cosine);                   // one score per position, in [-1, 1]
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

**`Cycle` es un conjunto ordenado por inserción.** Los elementos son únicos y conservan el orden en
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

<a id="13-license"></a>
## 13. Licencia

MIT © Eloy Kim
