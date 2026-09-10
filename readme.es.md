# **Semantic-TypeScript**

**Flujo, indexado.** Tus datos, bajo control preciso.

[English](./readme.md) · [简体中文](./readme.cn.md) · [繁體中文](./readme.tw.md) · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · [Français](./readme.fr.md) · Español · [Русский](./readme.ru.md)

Una biblioteca de procesamiento de flujos con seguridad de tipos que unifica **generadores de JavaScript**, **Java Stream** y el **direccionamiento de datos basado en índices**. Cada elemento lleva un índice `bigint`, cada canalización es perezosa y cada operación terminal es una opción explícita.

```bash
npm install semantic-typescript
```

- Cero dependencias en tiempo de ejecución, ESM puro, incluye sus propios tipos.
- 55 pruebas de regresión: `npm install && npm test`.
- Historial de cambios completo: [CHANGELOG.md](./CHANGELOG.md).

---

## Tabla de contenidos

1. [Filosofía de diseño](#1-design-philosophy)
2. [Arquitectura](#2-architecture)
3. [Flujo de datos: de la fuente al resultado](#3-data-flow-from-source-to-result)
4. [Inicio rápido](#4-quick-start)
5. [Funciones de fábrica](#5-factory-functions)
6. [Operadores de transformación](#6-transformation-operators)
7. [Collectables y operaciones terminales](#7-collectables-and-terminal-operations)
8. [Estadísticas](#8-statistics)
9. [Ventanas](#9-windows)
10. [El modelo de índices](#10-the-index-model)
11. [El modelo asíncrono](#11-the-asynchronous-model)
12. [Funciones auxiliares](#12-utility-helpers)
13. [Comparación con otras bibliotecas](#13-comparison-with-other-libraries)
14. [Características de rendimiento](#14-performance-characteristics)
15. [Problemas y preguntas frecuentes](#15-pitfalls-and-faq)
16. [Licencia](#16-license)

---

<a id="1-design-philosophy"></a>
## 1. Filosofía de diseño

**1. El índice primero.** En la mayoría de las bibliotecas de flujos, una posición es algo que se *reconstruye* — un contador que se lleva en `scan`, o un argumento de índice que se pasa manualmente. Aquí la posición es *intrínseca*: el protocolo del generador entrega a cada elemento un índice `bigint`, de modo que `distinct`, `skip`, `sub`, `reverse`, `translate` y `shuffle` se expresan como aritmética de índices en lugar de estado ad hoc. Cambiar el índice de un elemento *es* reordenar; reindexar *es* filtrar.

**2. Empuje con una señal de parada explícita.** Una fuente es una función `(accept, interrupt) => void | Promise<void>`. Empuja elementos con `accept(element, index)` y pregunta a `interrupt(element, index)` si debe detenerse. No hay planificador oculto, ni objeto de suscripción, ni fase de limpieza que recordar — la contrapresión y la terminación forman parte del protocolo, y los flujos infinitos se vuelven casos ordinarios (no especiales).

**3. La pereza es el valor predeterminado; la materialización es una decisión.** Los operadores solo envuelven generadores. Nada se ejecuta hasta que un **collectable** consume la canalización, y el colector que elijas decide el coste: `toUnordered()` es O(n) y nunca toca tus índices, `toOrdered()` es O(n log n) y los normaliza. Como la decisión es explícita en el tipo que recibes, siempre sabes si estás pagando por el orden y la memoria.

**4. Redirect es el único mecanismo de reordenamiento.** `reverse()`, `translate()` y `shuffle()` no son más que estrategias `redirect()` preempaquetadas — cada una reescribe el índice de un elemento y nada más. Por eso todas **requieren `toOrdered()`** para hacer efecto: la canalización solo reescribe índices, y es el colector ordenado el que decide qué significan esos índices.

**5. Síncrono y asíncrono son una sola API.** Los mismos operadores existen para datos finitos en memoria y para promesas, iterables asíncronos, temporizadores, blobs y suscripciones a eventos. Las fuentes que no pueden ser síncronas lo indican en su tipo de retorno (`AsynchronousSemantic`), de modo que "¿tuve que esperar (await) esto?" deja de ser una sorpresa en tiempo de ejecución.

---

<a id="2-architecture"></a>
## 2. Arquitectura

Tres capas, una sola dirección. Los datos fluyen hacia abajo; el tipo que sostienes te dice qué puedes hacer a continuación.

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

| Capa | Tipo | Responsabilidad | Lo obtienes de |
| :--- | :--- | :--- | :--- |
| Fuente / canalización | `SynchronousSemantic<E>`<br>`AsynchronousSemantic<E>` | Construir la canalización perezosa: transformar, reindexar, dividir, fusionar. Ningún elemento se toca todavía. | De las fábricas, y de cada operador sobre un semantic |
| Almacenamiento / vista | `SynchronousUnorderedCollectable<E>`<br>`SynchronousOrderedCollectable<E>`<br>`SynchronousNumericStatistics<E>`<br>`SynchronousBigIntStatistics<E>`<br>`SynchronousWindowCollectable<E>`<br>(+ contrapartes `Asynchronous*`) | Materializar la canalización en un búfer direccionado por índice y exponer la API terminal. La familia **ordenada** posee el control de índices; la familia **desordenada** lo prescinde a cambio de rendimiento. | `toUnordered()` `toOrdered()` `toNumericStatistics()` `toBigintStatistics()` `toWindow()` `toCollectable()` |
| Colector | `SynchronousCollector<E, A, R>`<br>`AsynchronousCollector<E, A, R>` | Un plegado reutilizable: `identity → accumulator → finisher`, opcionalmente con un `interruptor`. Alimenta cada operación terminal y puede ser escrito por el usuario. | Las fábricas de colectores `useSynchronous*` / `useAsynchronous*`, o `Collectable.collect(...)` |

Por qué existe la capa intermedia: separar "qué es la canalización" de "cómo se almacena" es lo que permite que el mismo `toOrdered()` sirva para inversión, rotación y barajado — la canalización solo reescribe índices, y el colector decide qué significan esos índices.

---

<a id="3-data-flow-from-source-to-result"></a>
## 3. Flujo de datos: de la fuente al resultado

```typescript
const result = useRange(0n, 100n)      // (1) source: reserve indices 0n,1n,2n,…
  .filter(n => n % 2n === 0n)          // (2) operator: index is forwarded unchanged
  .translate(2)                        // (3) operator: index becomes i + 2 (a lazy shift)
  .limit(5n);                          // (4) operator: interrupt() returns true after 5 elements

const ordered = result.toOrdered();    // (5) collectable: materialise; indices normalised mod n, sorted
const array = ordered.toArray();       // (6) terminal: drain the buffer
```

1. **Construir.** Los pasos 1–4 no construyen nada salvo clausuras. Cien elementos nunca se generan.
2. **Empujar.** Cuando un collectable finalmente ejecuta el generador, los elementos fluyen sin planificador: la fuente conduce, `accept` escribe en el colector, `interrupt` decide cuándo detenerse — por eso `limit(5n)` en medio de un rango de un millón de elementos cuesta cinco iteraciones, no un millón.
3. **Índice.** Los operadores nunca pierden el índice. `filter` reenvía el índice original (así que "el 3.º elemento *conservado*" sigue siendo "índice 3"), mientras que `skip` / `sub` / `limit` / `distinct` reindexan deliberadamente.
4. **Materializar.** Un collectable ejecuta el generador exactamente una vez, en el momento de la construcción.
5. **Terminal.** Los métodos sobre el collectable leen el búfer; son baratos, repetibles y nunca reejecutan la canalización.

**La única regla que vale la pena memorizar:** las transformaciones son perezosas, los collectables son ávidos, los terminales son gratuitos.

---

<a id="4-quick-start"></a>
## 4. Inicio rápido

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
## 5. Funciones de fábrica

### 5.1 Visión general

La construcción es siempre O(1) — una fábrica solo envuelve un generador. La tabla siguiente indica el coste de *consumir* `n` elementos de cada fuente, más el espacio adicional que la propia fuente necesita además de los elementos que recolectas.

| Fábrica | Firma (resultado) | Tiempo (consumir n) | Espacio (fuente) | Notas |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | Los índices son 0..n−1; el argumento de propagación ya está materializado |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | Envuelve cualquier `Iterable` / `AsyncIterable`; se itera una vez al recolectar |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` es exclusivo; `step` debe ser distinto de cero; tanto `number` como `bigint` funcionan |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | Un proveedor se llama una vez por elemento |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | Elemento neutro para `concat` |
| `useText` | `useText(text)`<br>`useText(text, delimiter)`<br>`useText(text, start)` / `(text, start, end)` | O(n) | O(n) para el texto | Itera **puntos de código**, por lo que los emoji y los CJK siguen siendo elementos únicos |
| `useAttribute` | `useAttribute<T>(object) → SynchronousSemantic<{key, value}>` | O(v + e) sobre v valores y e aristas | O(d + v) para el conjunto visitado a profundidad d | Recorre recursivamente objetos/arrays anidados con protección contra ciclos |
| `useGenerate` | `useGenerate<E>(supplier, interrupt) → SynchronousSemantic<E>` | O(n) × coste del proveedor | O(1) | **Debe** tener un `interrupt` de parada (o un `limit` / `takeWhile` aguas abajo) |
| `useIterate` | `useIterate<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useIterate<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) por recolección | O(1) | Reproduce el iterador en cada recolección |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period (tiempo real) | O(1) | Emite el tiempo transcurrido; consume tiempo real |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | Un único elemento en el índice `0n` |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob size) | O(chunk) por copia emitida | El fragmento predeterminado es 64 KiB; cada fragmento es una copia independiente |
| `useSubscription` | `useSubscription(target, subscriber, event \| events) → AsynchronousSemantic<Event>` | un elemento por evento | O(1) | `limit()` / `sub()` / `takeWhile()` definen el límite de desuscripción |

### 5.2 Ejemplos

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
## 6. Operadores de transformación

### 6.1 Visión general

Cada operador devuelve un nuevo `Semantic`; ninguno toca un elemento hasta que un collectable se ejecuta. El tiempo es el coste adicional **por elemento** (adicional al coste propio de la fuente); el espacio es la memoria adicional que el operador retiene mientras la canalización se ejecuta.

| Operador | Propósito | Efecto en el índice | Tiempo (por elemento) | Espacio |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | transformación 1:1 | reenviado | O(1) | O(1) |
| `filter(predicate)` | conserva los elementos que coinciden | reenviado | O(1) | O(1) |
| `flat(mapper)` | aplanado 1:N (iterable o semantic) | reindexado desde 0 | O(1) por elemento emitido | O(1) |
| `flatMap(mapper)` | aplanado 1:N, puede cambiar el tipo del elemento | reindexado desde 0 | O(1) por elemento emitido | O(1) |
| `distinct(keyExtractor?)` | descarta claves repetidas, conserva la primera | reenviado | O(1) promedio | O(n) para el conjunto de claves |
| `peek(consumer)` | efecto secundario, el elemento pasa a través | reenviado | O(1) | O(1) |
| `limit(count)` | toma los primeros *n* | reindexado desde 0 | O(1), detiene la fuente tras n | O(1) |
| `skip(count)` | descarta los primeros *n* | reenviado | O(1) por elemento descartado | O(1) |
| `sub(start, end)` | rebanada posicional `[start, end)` | reenviado | O(1) | O(1) |
| `takeWhile(predicate)` | toma mientras el predicado se cumpla | reenviado | O(1), detiene la fuente en el primer fallo | O(1) |
| `dropWhile(predicate)` | descarta mientras el predicado se cumpla | reindexado desde 0 | O(1) | O(1) |
| `concat(other)` | añade un semantic o iterable | continúa el índice | O(1) | O(1) |
| `redirect(redirector)` | calcula un nuevo índice como desees | **el tuyo** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | negado y desplazado | O(1) | O(1) |
| `translate(offset)` | desplazamiento perezoso de cada índice en *offset* | `i + offset` | O(1) | O(1) |
| `translate(mapper)` | desplazamiento de índice por elemento | `i + mapper(element, i)` | O(1) | O(1) |
| `shuffle(mapper?)` | aleatoriza el índice (o usa tu propio mapper) | aleatorio | O(1) | O(1) |
| `pipe(conversion)` | pasa el generador a una función personalizada | según tú | el tuyo | el tuyo |
| `semantic()` | eleva un collectable de nuevo a un semantic | sin cambios | O(1) | O(1) |

### 6.2 Notas que importan

**`reverse`, `translate` y `shuffle` son todas estrategias `redirect` y necesitan un colector ordenado.** Solo reescriben índices — nada se almacena en búfer, nada se rota todavía. Es `toOrdered()` el que normaliza los índices módulo el número de elementos y los convierte en un orden:

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(-2).toOrdered().toArray();        // [3,4,5,1,2]
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3, 4, 5]).shuffle().toOrdered().toArray();            // a fresh permutation per call
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

Recolectados con `toUnordered()` en su lugar, las mismas canalizaciones devuelven los elementos en orden de llegada con sus índices sin procesar — véase [El modelo de índices](#10-the-index-model).

**`translate` es un desplazamiento de índice puro y perezoso.** Ambas sobrecargas se suman al índice (`i + offset` o `i + mapper(element, i)`) y nunca almacenan el flujo en búfer. Una rotación solo se materializa cuando el *colector ordenado* normaliza los índices módulo el número de elementos — por eso `translate(2)` es barato incluso en un rango infinito seguido de `limit`.

**`redirect` es la herramienta general.** Cualquier estrategia de índice puede expresarse con ella — invertida, entrelazada, particionada por hash:

```typescript
useFrom([1, 2, 3, 4, 5]).redirect((_e, i) => -i - 1n).toOrdered().toArray();   // [5,4,3,2,1]
useFrom([1, 2, 3, 4]).redirect((_e, i) => i % 2n === 0n ? i + 1n : i - 1n)
  .toOrdered().toArray();                                                       // [2,1,4,3]
```

**El particionado por índice sigue siendo de primera clase:**

```typescript
useOf(1, 2, 3, 4, 5).sub(1, 3).toUnordered().toArray();               // [2,3]
useOf(1, 2, 3, 4, 5).skip(2n).toUnordered().toArray();                // [3,4,5]
useOf(1, 2, 3, 4, 5).takeWhile(n => n < 3).toUnordered().toArray();   // [1,2]
useOf(1, 2, 3, 4, 1).dropWhile(n => n < 3).toUnordered().toArray();   // [3,4,1]
```

---

<a id="7-collectables-and-terminal-operations"></a>
## 7. Collectables y operaciones terminales

### 7.1 Elegir un collectable

El collectable posee tanto el **orden** como el **control de índices**. `n` es el número de elementos.

| Collectable | Estructura | Tiempo | Espacio | Orden | Úsalo cuando |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | `Map<bigint, E>` indexado por índice | O(n) | O(n) | orden de inserción | rendimiento máximo, el orden es irrelevante; los índices sin procesar se conservan intactos |
| `toOrdered()` | array ordenado por índice de elemento | O(n log n) | O(n) | por índice normalizado | la inversión/rotación/barajado deben hacer efecto, o necesitas acceso posicional |
| `toOrdered(comparator)` | ordenado por tu comparador, índice reconstruido como posición | O(n log n) | O(n) | por tu comparador | vistas ordenadas, lecturas tipo min/máx |
| `toNumericStatistics()` | búfer ordenado por valor | O(n log n) | O(n) | por valor | estadísticas sobre `number` |
| `toBigintStatistics()` | búfer ordenado por valor | O(n log n) | O(n) | por valor | estadísticas sobre `bigint` |
| `toWindow()` | búfer ordenado por valor | O(n log n) | O(n) | por valor | `slide` / `tumble` |
| `toCollectable(mapper)` | lo que devuelva el mapper | — | — | — | collectables personalizados |

### 7.2 Terminales

Los costes se indican tras la materialización; `k` es la posición objetivo y `n` el número de elementos.

| Terminal | Devuelve | Tiempo | Espacio | Notas |
| :--- | :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | O(n) | O(n) | Vacía el búfer |
| `toSet()` | `Set<E>` | O(n) promedio | O(n) | Desduplica por identidad |
| `toMap(keyExtractor, valueExtractor?)` | `Map<K, V>` | O(n) promedio | O(n) | Gana la última escritura |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | O(1) | El búfer ya lo sabe |
| `forEach(action)` | `void` | O(n) | O(1) | `action(element, index)` |
| `join(…)` | `string` | O(n) | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `log()` / `error()` | `void` | O(n) | O(n) | Salida de consola envuelta en `[prefix … suffix]` |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | O(1) | Terminal tipo EO |
| `collect(collector)`<br>`collect(identity, accumulator, finisher)` | `R` | O(n) | accumulator | El plegado genérico detrás de cada terminal anterior |
| `reduce(accumulator)` | `Optional<E>` | O(n) | O(1) | Flujo vacío → Optional vacío |
| `reduce(identity, accumulator)` | `E` | O(n) | O(1) | — |
| `reduce(identity, accumulator, finisher)` | `R` | O(n) | O(1) | — |
| `group(classifier)` | `Map<K, E[]>` | O(n) promedio | O(n) | — |
| `groupBy(keyExtractor, valueExtractor)` | `Map<K, V[]>` | O(n) promedio | O(n) | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | O(n) | Round-robin por índice en `count` cubos |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | O(n) | El número de cubo proviene del clasificador |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) peor caso, con cortocircuito | O(1) | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | O(1) | Posicional en orden materializado |
| `findAt(k)` | `Optional<E>` | O(k), se detiene antes | O(1) | El (k+1)-ésimo elemento **en orden materializado** |
| `findNegativeAt(k)` | `Optional<E>` | O(n−k), se detiene antes | O(1) | Cuenta hacia atrás desde el final del orden materializado |
| `findMaximum(comparator?)` / `findMinimum(comparator?)` | `Optional<E>` | O(n) (O(1) en estadísticas) | O(1) | Por defecto usa una comparación estructural |
| `frequency()` | `Map<E, bigint>` | O(n) promedio | O(n) | Solo collectables de estadísticas |
| `[Symbol.iterator]()` / `[Symbol.asyncIterator]()` | iterador | O(n) | O(1) | `for…of` sobre un collectable |

### 7.3 Ejemplos

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
## 8. Estadísticas

`toNumericStatistics()` y `toBigintStatistics()` te dan un búfer ordenado por valor más una API estadística. Ambos aceptan un mapper, por lo que puedes calcular sobre un valor proyectado: `.average(element => element.price)`.

| Método | Significado | `number` | `bigint` |
| :--- | :--- | :--- | :--- |
| `summate()` | Σx | exacto | exacto |
| `average()` / `mean()` | Σx / n | exacto | división entera |
| `median()` | valor medio (media de los dos centrales para conteos pares) | exacto | redondeado |
| `mode()` | valor más frecuente | exacto | exacto |
| `variance()` | varianza poblacional σ² | exacto | redondeado |
| `standardDeviation()` | √σ² | exacto | redondeado |
| `range()` | máx − mín | exacto | exacto |
| `quantile(q)` | cuantil de rango más cercano, `0 ≤ q ≤ 1` | exacto | exacto |
| `interquartileRange()` | q(0.75) − q(0.25) | exacto | exacto |
| `skewness()` | Σ((x−μ)/σ)³ / n | exacto | redondeado |
| `kurtosis()` | Σ((x−μ)/σ)⁴ / n − 3 (exceso) | exacto | redondeado |
| `frequency()` | valor → conteo | `Map<E, bigint>` | `Map<E, bigint>` |

Todos los métodos son O(1) sobre el búfer ordenado (la ordenación se pagó una vez, en la materialización), excepto `frequency()` que es O(n) promedio con espacio O(n).

Los resultados `bigint` se calculan en coma flotante y se redondean de nuevo a `bigint`, porque la división entera los distorsionaría de otro modo (la varianza de `[1n,2n,3n,4n]` es `1.25`, no `3`). Si necesitas estadísticas fraccionarias exactas, mapea a `number` y usa el colector numérico.

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
## 9. Ventanas

`toWindow()` devuelve un collectable cuyo `slide` / `tumble` produce un semantic *de semantics*.

```typescript
const windows = useOf(1, 2, 3, 4, 5).toWindow();

windows.tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2], [3,4], [5]]

windows.slide(3n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2,3], [2,3,4], [3,4,5], [4,5], [5]]   — trailing partial windows are included
```

`tumble(size)` es O(n) en total; `slide(size, step)` es O(n × size) porque las ventanas se solapan.

Las fuentes asíncronas funcionan igual; `slide` / `tumble` esperan a que el búfer subyacente esté listo:

```typescript
const asyncWindows = await useFrom(tick()).toWindow().tumble(2n).toUnordered().toArray();
for (const window of asyncWindows) {
  console.log(await window.toUnordered().toArray());
}
```

---

<a id="10-the-index-model"></a>
## 10. El modelo de índices

El modelo de índices tiene dos mitades: la **canalización** reescribe índices de forma barata y perezosa; el **collectable** decide qué significan. Esa separación es deliberada, y es donde residen los costes de orden.

| Concepto | Comportamiento |
| :--- | :--- |
| Tipo de índice | `bigint`, siempre disponible como segundo argumento de cada callback |
| Aritmética de la canalización | `reverse()` = `redirect(-i - 1n)`, `translate(o)` = `redirect(i + o)`, `shuffle()` = `redirect(random)` — todos O(1) por elemento, todos perezosos, ninguno almacena nada en búfer |
| `toUnordered()` — sin control de índices | Conserva cada índice sin procesar intacto en un `Map`. `translate(2)` recolectado desordenado sigue dando índices `2n,3n,4n,…`. Este es el contrato de rendimiento: sin ordenación, sin normalización, O(n) |
| `toOrdered()` — normalización | Reescribe cada índice a `((i mod n) + n) mod n` (n = número de elementos), luego ordena. Los índices negativos o demasiado grandes se pliegan en `0..n−1`, por lo que `reverse`, `translate(7)` y `shuffle` aterrizan todos en una posición válida |
| `toOrdered(comparator)` | Ordena por valor y reconstruye los índices como posiciones — esto es lo que usan las estadísticas |
| Rotación | Surge de la normalización: `translate(2)` da índices `2,3,4,0,1`, que se ordenan en la rotación `[4,5,1,2,3]`. No hay almacenamiento en búfer en el operador |
| Índices duplicados | Detectados por `toUnordered()` y dotados de claves sustitutas, por lo que **ningún elemento se descarta en silencio**; `toOrdered()` mantiene los índices iguales en orden relativo |
| `findAt(k)` / `findNegativeAt(k)` | Dirigido al **orden materializado** — `findAt(1n)` es siempre el segundo elemento de lo que produjo el collectable, `findNegativeAt(-1n)` siempre el último — sin importar lo que `redirect` / `reverse` / `translate` hayan hecho a los índices sin procesar |
| `distinct` | Conserva la primera aparición **y su índice original** |
| `sub` / `skip` / `limit` | Cuenta elementos, no valores de índice |

En resumen: **`OrderedCollectable` y sus subclases poseen el control de índices** (normalizan módulo n, ordenan, direccionamiento posicional), mientras que **`UnorderedCollectable` garantiza el rendimiento al no tocar nunca los índices**. Elige por consulta, no por canalización.

---

<a id="11-the-asynchronous-model"></a>
## 11. El modelo asíncrono

Las fuentes cuyos datos aún no pueden existir devuelven `AsynchronousSemantic<E>`:

| Fuente asíncrona | Por qué |
| :--- | :--- |
| `usePromise` | el valor llega más tarde |
| `useBlob` | `Blob.stream()` es asíncrono |
| `useInterval` | impulsado por `setInterval` |
| `useSubscription` | impulsado por eventos externos |
| `useFrom` / `useIterate` con un `AsyncIterable` | producido por `for await` |

El consumo es uniforme — cada terminal de un `AsynchronousCollectable` devuelve una `Promise`, y la semántica (modelo de índices, normalización, `findAt` posicional) es idéntica a la parte síncrona:

```typescript
const stats = await useFrom(asyncGenerator()).map(n => n * 2n).limit(10n).toBigintStatistics();
await stats.summate();

for await (const element of usePromise(Promise.resolve(1)).toUnordered()) {
  console.log(element);
}
```

Tres cosas de las que el sistema de tipos no te salvará:

1. **Terminar el flujo.** Una fuente de eventos o temporizador nunca se completa por sí sola. Define el límite — `limit(n)`, `sub(start, end)` o `takeWhile(predicate)` — o la suscripción se mantiene activa.
2. **Esperar el collectable.** `toOrdered()`, las estadísticas y `toWindow()` esperan a que la fuente se complete antes de responder; una fuente solo-promesa que nunca se completa los deja pendientes.
3. **Mezclar capas.** Un collectable síncrono no puede consumir una fuente asíncrona. Una vez que interviene una fábrica async, mantén toda la canalización en el lado async y usa `await` en los terminales.

---

<a id="12-utility-helpers"></a>
## 12. Funciones auxiliares

| Auxiliar | Propósito | Tiempo |
| :--- | :--- | :--- |
| `useCompare(a, b)` | Comparación estructural usada por cada orden/mín/máx predeterminado (`number`, `bigint`, `string`, `boolean`, `symbol`, objetos vía `Symbol.toPrimitive`) | O(1) primitivos |
| `useRandom(start, end?)` | `number` / `bigint` aleatorio, uniforme sobre el intervalo semiabierto | O(1) |
| `useHash(value, …)` | Hash `bigint` estable de 64 bits aproximados para cualquier valor (primitivos, objetos, ciclos) | O(v) sobre valores visitados |
| `register(type, handler)` / `unregister(type)` / `maskOf(type)` | Extiende el hash para tipos personalizados | O(1) |
| `useTraverse(object, callback)` | Recorrido profundo con protección contra ciclos; el callback recibe `(key, value, path)` | O(v + e) |
| `useStringify(object, callback?)` | Serialización JSON que sobrevive a referencias circulares | O(v + e) |
| `useToNumber(value)` / `useToBigInt(value)` | Conversiones totales (nunca lanzan excepción; devuelven `0` / `0n` para entradas no utilizables) | O(1) |
| `useGenerator(iterable)` / `useArrange(source, comparator?)` | Generador `(accept, interrupt)` en bruto, y un generador de ordenación | O(n) / O(n log n) |
| `Optional<T>` | `of`, `ofNullable`, `ofNonNull`, `empty`; `map`, `flat`, `flatMap`, `filter`, `get`, `get(default)`, `ifPresent(action, elseAction)`, `orElse`, `isPresent`, `isEmpty`, `semantic()` | O(1) por método |
| Guardas de tipo | `isNumber` (excluye `NaN` e `Infinity`), `isBigInt`, `isString`, `isBoolean`, `isSymbol`, `isFunction`, `isObject`, `isPrimitive`, `isIterable`, `isAsyncIterable`, `isPromise`, `isAsyncFunction`, `isGeneratorFunction`, `isAsyncGeneratorFunction`, `isOptional`, `isSynchronousSemantic` / `isAsynchronousSemantic`, `isSynchronousCollectable` (+ async), `isSynchronousOrderedCollectable`, `isSynchronousUnorderedCollectable`, `isSynchronousStatistics`, `isSynchronousNumericStatistics`, `isSynchronousBigIntStatistics`, `isSynchronousWindowCollectable`, `isSynchronousCollector` | O(1) |

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
## 13. Comparación con otras bibliotecas

| Aspecto | Semantic-TypeScript | RxJS | Iteradores nativos |
| :--- | :--- | :--- | :--- |
| Modelo | empuje con una señal `interrupt` explícita | empuje, objetos de suscripción | tirar (pull) |
| Posición | índice `bigint` intrínseco en cada elemento | operadores que compones (`scan`, `withLatestFrom`) | contador manual |
| Pereza | operadores perezosos, collectables explícitos | operadores perezosos, `subscribe` ávido | perezoso |
| Síncrono + asíncrono | una API, fábricas async marcadas en el tipo | async primero | puente `for await` manual |
| API terminal | collectable rico (`toArray`, `toMap`, `group`, `reduce`, `find*`, estadísticas) | solo operadores | ninguna |
| Estadísticas | integradas, para `number` y `bigint` | externas | ninguna |
| Seguridad del ciclo de vida | el operador límite se desuscribe | `unsubscribe` / `takeUntil` manual | manual |
| Ecosistema / tamaño | pequeño, cero dependencias | gran ecosistema de operadores | cero |

Elige Semantic-TypeScript cuando quieras procesamiento de datos dirigido por índices con un modelo de coste explícito y sin planificador. Elige RxJS cuando necesites su ecosistema de operadores, semántica multiobservador y control del planificador.

---

<a id="14-performance-characteristics"></a>
## 14. Características de rendimiento

El coste de una consulta es la suma de tres partes visibles: fuente (§5), operadores (§6), collectable (§7). Nada oculto se ejecuta dos veces.

| Operación | Tiempo | Espacio | Notas |
| :--- | :--- | :--- | :--- |
| `map` / `filter` / `peek` | O(1) por elemento | O(1) | transformación pura |
| `limit` / `takeWhile` | O(1) por elemento | O(1) | detiene la fuente inmediatamente |
| `reverse` / `translate` / `shuffle` | O(1) por elemento | O(1) | solo aritmética de índices — sin almacenamiento en búfer |
| `distinct` | O(1) promedio por elemento | O(n) | `Set` de claves |
| `toUnordered()` | O(n) | O(n) | una inserción `Map` por elemento; índices intactos |
| `toOrdered()` | O(n log n) | O(n) | normalizar O(n) + ordenar O(n log n) |
| Estadísticas | O(n log n) una vez, luego O(1) por método | O(n) | mantiene un búfer ordenado/agregado |
| `findAt(k)` / `findNegativeAt(k)` | O(k) / O(n−k) | O(1) | interrupción anticipada en cuanto se pasa la posición |
| `findMaximum` / `findMinimum` | O(n) genérico, O(1) estadísticas | O(1) | un solo recorrido con el mejor actual |

Reglas prácticas: mantén la canalización perezosa hasta que realmente necesites un resultado; prefiere `toUnordered()` a menos que el orden importe; coloca `limit` / `takeWhile` tan pronto como lo permita la semántica; deja que el *collectable*, no el operador, decida el coste del orden.

---

<a id="15-pitfalls-and-faq"></a>
## 15. Problemas y preguntas frecuentes

**“Mi canalización no devuelve nada / se cuelga.”** La fuente nunca terminó. `useInterval`, `useSubscription`, `usePromise` y `useGenerate` necesitan un límite (`limit`, `sub`, `takeWhile`) o una fuente que se complete.

**“`reverse()` no hizo nada.”** Lo consumiste con `toUnordered()`, que garantiza no llevar control de índices. Usa `toOrdered()`.

**“`translate(2)` devolvió los elementos sin rotar.”** Por la misma razón: `translate` solo desplaza índices; la rotación se realiza mediante la normalización módulo de `toOrdered()`. Recolectado desordenado, el desplazamiento sigue siendo visible en los índices sin procesar.

**“¿Por qué falta un elemento?”** Una fuente aguas arriba produjo índices duplicados y los estás consumiendo mediante `toUnordered()`. Las claves sustitutas evitan la pérdida de datos, pero si necesitas *ver* ambos elementos en orden, consume con `toOrdered()`.

**“`findAt(1n)` devuelve algo inesperado.”** `findAt` se dirige al **orden materializado**, no al índice sin procesar. Tras `.reverse().toOrdered()`, la posición 1 es el segundo elemento de la secuencia invertida. Si quieres el elemento que lleva el índice sin procesar `1n`, filtra sobre el índice explícitamente.

**“Las estadísticas `bigint` parecen redondeadas.”** Lo están — los resultados `bigint` se redondean a enteros por diseño (véase [Estadísticas](#8-statistics)). Mapea a `number` para fracciones exactas.

**“¿Tengo que llamar a `toXxx()` antes de `toArray()`?”** Sí. Las operaciones terminales residen en los collectables, no en los semantics. Eso es deliberado: hace visible en el tipo el coste de almacenamiento y orden.

**“¿Hace tree-shaking?”** Se declara `sideEffects: false`, así que importa solo lo que usas. Ten en cuenta que `useHash` registra sus manejadores predeterminados cuando se carga el módulo.

---

<a id="16-license"></a>
## 16. Licencia

MIT © Eloy Kim

Consulta [CHANGELOG.md](./CHANGELOG.md) para el historial completo de versiones.
