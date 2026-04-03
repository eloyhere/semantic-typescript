# **Semantic‑TypeScript**
**Flujos, indexados.** Tus datos, bajo control preciso.

---

### Descripción general

Semantic‑TypeScript representa un avance significativo en el procesamiento de flujos, **fusionando** elegantemente los paradigmas más efectivos de los generadores de JavaScript, los Streams de Java y la indexación al estilo MySQL. Su premisa fundamental es poderosa y deliberada: construir canalizaciones de procesamiento de datos excepcionalmente eficientes mediante indexación inteligente, en lugar de mediante iteración por fuerza bruta convencional.

Donde las bibliotecas típicas imponen bucles sincrónicos o cadenas de promesas engorrosas, Semantic‑TypeScript proporciona una experiencia **completamente asíncrona**, funcionalmente pura y rigurosamente segura en cuanto a tipos, diseñada expresamente para las exigencias del desarrollo moderno de aplicaciones.

Este modelo encarna una forma refinada de flujo de control: los datos solo avanzan hacia el consumidor aguas abajo cuando la canalización aguas arriba invoca explícitamente la función de retorno `accept`. Conservas un control completo y granular sobre el momento del procesamiento: este ocurre precisamente cuando, y solo cuando, es necesario.

---

### ¿Por qué los desarrolladores eligen Semantic‑TypeScript?

-   **Indexación sin código repetitivo** – Cada elemento posee inherentemente su índice natural o personalizado, eliminando el seguimiento manual.
-   **Puramente funcional y seguro en tipos** – Disfruta de inferencia de tipos TypeScript completa e idiomática junto con operaciones inmutables.
-   **Flujos de eventos a prueba de fugas** – El patrón `useSubscription` se diseña teniendo la seguridad de recursos como primer principio. Defines el límite lógico (usando `limit(n)`, `sub(start, end)` o `takeWhile(predicate)`) y la biblioteca gestiona completamente el ciclo de vida de la suscripción. Esto garantiza que no haya oyentes residuales ni fugas de memoria.
-   **Suite estadística integrada** – Accede a análisis exhaustivos para flujos tanto de `number` como de `bigint`, incluyendo promedios, medianas, modas, varianza, asimetría y curtosis, sin dependencias externas.
-   **Rendimiento predecible y ajustable** – Elige entre colectores ordenados o desordenados para adaptarte exactamente a tus requisitos de rendimiento y orden.
-   **Inherentemente eficiente en memoria** – Los flujos se evalúan de forma diferida, procesando elementos bajo demanda para aliviar la presión sobre la memoria.
-   **Sin comportamiento indefinido** – TypeScript garantiza seguridad de tipos completa y nulabilidad. Tus datos de origen permanecen inmutables a menos que se modifiquen explícitamente dentro de tus funciones de retorno.

---

### Instalación

Integra Semantic‑TypeScript en tu proyecto usando tu gestor de paquetes preferido:

```bash
npm install semantic-typescript
```
o
```bash
yarn add semantic-typescript
```

---

### Introducción práctica

Los siguientes ejemplos demuestran conceptos clave, desde transformaciones básicas hasta manejo de eventos del mundo real.

```typescript
import { useOf, useFrom, useRange, useSubscription, useText, useStringify } from "semantic-typescript";

// ====================================================================
// EJEMPLO 1: Operaciones básicas y estadísticas numéricas
// ====================================================================
// Demuestra operaciones de mapeo y estadísticas terminales. Después de la transformación, la canalización debe convertirse en un colector de estadísticas antes de poder llamar a métodos terminales como `.summate()`.

const numericSum: number = useOf(10, 20, 30, 40)
  .map((n: number): number => n * 2)        // Duplica cada elemento: [20, 40, 60, 80]
  .toNumericStatistics()                    // Convierte a un colector de estadísticas
  .summate();                               // Operación terminal: 200

// Otros métodos estadísticos (disponibles después de `.toNumericStatistics()`):
// .average(), .median(), .mode(), .variance(), .skewness(), .kurtosis()

// ====================================================================
// EJEMPLO 2: Estadísticas de BigInt
// ====================================================================
// Funciona de manera idéntica a las estadísticas numéricas pero está optimizado para datos BigInt.

const bigintSum: bigint = useOf(10n, 20n, 30n, 40n)
  .map((n: bigint): bigint => n * 2n)       // Aritmética BigInt
  .toBigIntStatistics()                       // Convierte a un colector de estadísticas BigInt
  .summate();                                // Operación terminal: 200n

// ====================================================================
// EJEMPLO 3: Manipulación de índices para invertir un flujo
// ====================================================================
// Ilustra cómo reordenar elementos reasignando estratégicamente sus índices utilizando el método `.redirect()`, permitiendo patrones personalizados como la inversión.

const reversedArray: number[] = useFrom([1, 2, 3, 4, 5])
  .redirect((_element: number, index: bigint): bigint => -index) // Mapea a índices negativos
  .toOrdered()  // Esencial: recoge elementos ordenados por sus nuevos índices
  .toArray();   // Resultado: [5, 4, 3, 2, 1]

// Para una inversión simple, también está disponible `.reverse()`.

// ====================================================================
// EJEMPLO 4: Mezcla (Shuffle) de un flujo
// ====================================================================
// Permuta aleatoriamente los índices de los elementos usando un algoritmo de mezcla in situ.

const shuffledArray: number[] = useFrom([1, 2, 3, 4, 5])
  .shuffle()      // Reasigna índices aleatoriamente
  .toOrdered()    // Ordena según los nuevos índices aleatorios
  .toArray();     // Ejemplo: [2, 5, 1, 4, 3] (varía en cada ejecución)

// ====================================================================
// EJEMPLO 5: Rotación circular de un flujo
// ====================================================================
// Desplaza elementos cíclicamente. Los valores positivos rotan a la derecha; los negativos a la izquierda.

// Rotación a la derecha 2 posiciones
const rightRotated: number[] = useFrom([1, 2, 3, 4, 5])
  .translate(2)   // Desplaza índices 2 posiciones a la derecha
  .toOrdered()
  .toArray();     // Resultado: [4, 5, 1, 2, 3]

// ====================================================================
// EJEMPLO 6: Evaluación diferida con rangos infinitos
// ====================================================================
// Procesa flujos teóricamente infinitos de forma diferida, calculando elementos solo cuando se necesitan.

const firstTenMultiples: bigint[] = useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)  // Conserva múltiplos de 17
  .limit(10n)                    // Crítico: se detiene después de la décima coincidencia
  .toUnordered()                 // No se requiere ordenación
  .toArray();                    // Resultado: [0, 17, 34, 51, 68, 85, 102, 119, 136, 153]

// Sin `.limit(10n)`, la canalización procesaría el millón de elementos.

// ====================================================================
// EJEMPLO 7: Composición de una canalización compleja
// ====================================================================
// Demuestra la composición secuencial de múltiples operaciones.

const complexResult: number[] = useRange(1n, 100n)
  .map(n => Number(n) * 2)
  .filter(n => n > 50)
  .shuffle()
  .limit(5n)
  .translate(2)
  .toOrdered()
  .toArray();

// ====================================================================
// EJEMPLO 8: Suscripción gestionada a eventos del DOM
// ====================================================================
// Escucha eventos del navegador con limpieza automática y a prueba de fugas.
// La llamada `.limit(n)` define el límite para la eliminación automática del oyente.

// Define un suscriptor para un objetivo Window
const windowSubscriber = {
    mount: (target: Window): void => { /* Lógica de configuración */ },
    subscribe: (target: Window, event: keyof WindowEventMap, handler: EventListener): void => {
        target.addEventListener(event, handler);
    },
    unsubscribe: (target: Window, event: keyof WindowEventMap, handler: EventListener): void => {
        target.removeEventListener(event, handler);
    },
    unmount: (): void => { /* Lógica de limpieza */ }
};

useSubscription(window, windowSubscriber, "resize")
  .limit(5n) // Se da de baja automáticamente después de 5 eventos
  .toUnordered()
  .forEach((ev: Event, idx) =>
    console.log(`Redimensión #${idx}: ${(ev.target as Window).innerWidth}x${(ev.target as Window).innerHeight}`)
  );

// ====================================================================
// EJEMPLO 9: Procesamiento de cadenas por puntos de código Unicode
// ====================================================================
// Itera correctamente sobre una cadena, manejando caracteres Unicode de múltiples bytes.

useText("My emotion now is: 😊, and semantic is 👍")
  .toUnordered()
  .log(); // Registra cada carácter (incluyendo emojis) en una nueva línea.

// ====================================================================
// EJEMPLO 10: Transformación a cadena segura de referencias circulares
// ====================================================================
// Serializa de forma segura objetos que contienen referencias circulares.

const obj = {
  a: 1,
  b: "texto"
};
(obj as any).c = [obj.a, obj.b, (obj as any).c]; // Introduce una referencia circular

// const text: string = JSON.stringify(obj); // Lanza un error
const text: string = useStringify(obj); // Produce de forma segura `{a: 1, b: "texto", c: []}`
```

---

### Conceptos principales

| Concepto | Propósito | Caso de uso principal |
| :--- | :--- | :--- |
| `AsynchronousSemantic` | El constructor principal para flujos asíncronos, eventos y canalizaciones diferidas basadas en *push*. | Eventos en tiempo real, WebSockets, oyentes del DOM o cualquier flujo de larga duración/infinito. |
| `SynchronousSemantic` | El constructor para flujos síncronos, en memoria o basados en *pull* inmediatos (*eager*). | Datos estáticos, rangos finitos o tareas de iteración inmediata. |
| `toUnordered()` | El colector terminal más rápido, utiliza un Map para almacenar índices. | Rutas críticas de rendimiento donde el orden estable no es requerido (tiempo y espacio O(n)). |
| `toOrdered()` | Un colector terminal ordenado, estable en índices. | Cuando se debe preservar el orden de los elementos o se necesita acceso indexado. |
| `toNumericStatistics()` | Un colector que habilita análisis estadísticos completos en flujos de `number`. | Análisis de datos, métricas y cálculos estadísticos. |
| `toBigIntStatistics()` | Un colector que habilita análisis estadísticos completos en flujos de `bigint`. | Análisis y estadísticas para conjuntos de datos de enteros grandes. |
| `toWindow()` | Proporciona operaciones de ventana deslizante (*sliding*) y fija (*tumbling*) sobre un flujo. | Análisis de series temporales, procesamiento por lotes y agregaciones por ventanas. |

---

**Reglas de uso esenciales**

1.  **Los flujos de eventos** (creados a través de fábricas como `useSubscription`) devuelven un `AsynchronousSemantic`.
    → Debes llamar a un método que defina un límite, como `.limit(n)`, `.sub(start, end)` o `.takeWhile(predicate)` para terminar el oyente. De lo contrario, la suscripción permanecerá activa.

2.  **Las operaciones terminales** (`.toArray()`, `.count()`, `.forEach()`, `.findFirst()`, etc.) solo están disponibles después de convertir la canalización en un colector:
    ```typescript
    .toUnordered()   // Para máxima velocidad, sin garantía de orden.
    // o
    .toOrdered()     // Para salida estable y ordenada.
    // o
    .toNumericStatistics() // Para métodos estadísticos.
    ```

---

### Características de rendimiento

| Colector | Complejidad temporal | Complejidad espacial | ¿Orden garantizado? | Escenario ideal |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | O(n) | O(n) | No | El rendimiento bruto es clave; el orden final es irrelevante. |
| `toOrdered()` | O(n log n) | O(n) | Sí (ordenado) | Orden estable, acceso indexado o pre-ordenación para estadísticas. |
| `toNumericStatistics()` | O(n log n) | O(n) | Sí (orden interno) | Realizar operaciones estadísticas que requieren datos ordenados. |
| `toBigIntStatistics()` | O(n log n) | O(n) | Sí (orden interno) | Operaciones estadísticas en datos BigInt. |
| `toWindow()` | O(n log n) | O(n) | Sí (orden interno) | Operaciones de ventana que se benefician de índices ordenados. |

Elige `toUnordered()` cuando la velocidad absoluta es primordial. Opta por `toOrdered()` o un colector de estadísticas solo cuando tu lógica dependa del orden de los elementos.

---

**Análisis comparativo con bibliotecas modernas de flujos**

| Característica | Semantic‑TypeScript | RxJS | Async Iterators / Generators nativos | Most.js |
| :--- | :--- | :--- | :--- | :--- |
| **Integración TypeScript** | De primera clase, fuertemente tipado con conciencia de índice inherente. | Excelente, pero a menudo implica cadenas genéricas complejas. | Buena, pero requiere anotaciones de tipo manuales. | Fuerte, con un estilo de tipado funcional-*first*. |
| **Análisis estadístico integrado** | Soporte nativo completo para `number` y `bigint`. | No disponible de forma nativa (requiere operadores personalizados u otras bibliotecas). | Ninguno. | Ninguno. |
| **Indexación y conciencia de posición** | Indexación BigInt nativa y poderosa en cada elemento. | Requiere operadores personalizados (ej. `scan`, `withLatestFrom`). | Se requiere gestión manual de contadores. | Básica, sin propiedad de índice incorporada. |
| **Gestión de flujos de eventos** | Fábricas dedicadas, seguras en tipos, con control de ciclo de vida explícito y declarativo. | Poderosa pero requiere una gestión manual cuidadosa de las suscripciones para evitar fugas. | Adjuntar oyentes de eventos manualmente y gestionar tokens de cancelación. | Buen `fromEvent`, generalmente liviano. |
| **Rendimiento y memoria** | Excepcional: ofrece colectores optimizados `toUnordered()` y `toOrdered()`. | Muy buena, aunque las cadenas profundas de operadores pueden introducir sobrecarga. | Excelente (sobrecarga nativa mínima). | Excelente. |
| **Tamaño del paquete** | Muy liviano. | Sustancial (incluso con *tree-shaking*). | Cero (característica nativa del lenguaje). | Pequeño. |
| **Filosofía de diseño de API** | Patrón de colector funcional con semántica de índice explícita. | Patrón Observable reactivo. | Patrón Iterator imperativo / Generator declarativo. | Funcional, composición *point-free*. |
| **Control de flujo** | Explícito (`interrupt`, `.limit()`, `.takeWhile()`, `.sub()`). | Bueno (`take`, `takeUntil`, `first`). | Manual (`break` en bucles). | Bueno (`take`, `until`). |
| **Soporte síncrono y asíncrono** | API unificada: soporte de primera clase para ambos paradigmas. | Principalmente asíncrono. | Ambos soportados, pero con puente manual. | Principalmente asíncrono. |
| **Curva de aprendizaje** | Suave para desarrolladores familiarizados con canalizaciones de colecciones funcionales e indexadas. | Más pronunciada (amplio léxico de operadores, conceptos de Observable *hot/cold*). | Baja a media. | Media. |

**La ventaja de Semantic‑TypeScript**

*   **Capacidades únicas:** Las características de estadística e indexación integradas eliminan la necesidad de operaciones manuales de `reduce` o bibliotecas de análisis de datos suplementarias.
*   **Gestión de recursos predecible:** El control explícito sobre los flujos de eventos previene las fugas de memoria que pueden ser sutiles en las aplicaciones RxJS.
*   **Diseño unificado:** Una API consistente para flujos de trabajo tanto síncronos como asíncronos reduce la carga cognitiva y la duplicación de código.

Esta comparación destaca por qué Semantic‑TypeScript es especialmente adecuado para aplicaciones TypeScript modernas que exigen alto rendimiento, solidez en la seguridad de tipos y amplias funciones de procesamiento de datos sin la complejidad de los marcos reactivos tradicionales.

---

### Comienza tu exploración

Semantic‑TypeScript transforma flujos de datos complejos en canalizaciones legibles, componibles y de alto rendimiento. Ya sea que estés manejando eventos de UI en tiempo real, procesando grandes conjuntos de datos o construyendo paneles de análisis, ofrece el poder de la indexación a nivel de base de datos con la elegancia de la programación funcional.

**Tus próximos pasos:**

*   Explora la API completamente tipificada directamente en tu IDE (todas las exportaciones están disponibles desde el punto de entrada principal del paquete).
*   Únete a la creciente comunidad de desarrolladores que han reemplazado iteradores asíncronos complejos y cadenas reactivas con canalizaciones Semantic claras e intencionales.

**Semantic‑TypeScript** – donde los flujos se encuentran con la estructura.

Comienza a construir hoy y experimenta la diferencia tangible que aporta un diseño de indexación reflexivo.

**Construye con claridad, avanza con confianza y transforma datos con intención.**

MIT © Eloy Kim