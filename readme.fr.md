# **Semantic-TypeScript**

**Flux, indexés.** Vos données, sous un contrôle précis.

[English](./readme.md) · [简体中文](./readme.cn.md) · [繁體中文](./readme.tw.md) · [日本語](./readme.jp.md) · [한국어](./readme.kr.md) · [Deutsch](./readme.de.md) · Français · [Español](./readme.es.md) · [Русский](./readme.ru.md)

Une bibliothèque de traitement de flux typée sûre qui unifie **les générateurs JavaScript**, **Java Stream** et
**l'adressage de données par index**. Chaque élément porte un index `bigint`, chaque pipeline est paresseux, et
chaque opération terminale est un choix explicite.

```bash
npm install semantic-typescript
```

- Zéro dépendance au runtime, pur ESM, fournit ses propres types.
- 55 tests de non-régression : `npm install && npm test`.
- Historique des changements complet : [CHANGELOG.md](./CHANGELOG.md).

---

## Table des matières

1. [Philosophie de conception](#1-design-philosophy)
2. [Architecture](#2-architecture)
3. [Flux de données : de la source au résultat](#3-data-flow-from-source-to-result)
4. [Démarrage rapide](#4-quick-start)
5. [Fonctions de fabrique](#5-factory-functions)
6. [Opérateurs de transformation](#6-transformation-operators)
7. [Collectables et opérations terminales](#7-collectables-and-terminal-operations)
8. [Statistiques](#8-statistics)
9. [Fenêtres](#9-windows)
10. [Le modèle d'index](#10-the-index-model)
11. [Le modèle asynchrone](#11-the-asynchronous-model)
12. [Fonctions utilitaires](#12-utility-helpers)
13. [Comparaison avec d'autres bibliothèques](#13-comparison-with-other-libraries)
14. [Caractéristiques de performance](#14-performance-characteristics)
15. [Pièges et FAQ](#15-pitfalls-and-faq)
16. [Licence](#16-license)

---

<a id="1-design-philosophy"></a>
## 1. Philosophie de conception

**1. L'index d'abord.** Dans la plupart des bibliothèques de flux, une position est quelque chose que l'on
*reconstruit* — un compteur que l'on transporte dans `scan`, ou un argument d'index que l'on fait passer
manuellement. Ici la position est *intrinsèque* : le protocole du générateur fournit à chaque élément un index
`bigint`, si bien que `distinct`, `skip`, `sub`, `reverse`, `translate` et `shuffle` s'expriment tous comme une
arithmétique d'index plutôt que comme un état ad hoc. Modifier l'index d'un élément *revient à* le réordonner ;
re-indexer *revient à* filtrer.

**2. Propagation avec un signal d'arrêt explicite.** Une source est une fonction
`(accept, interrupt) => void | Promise<void>`. Elle propage les éléments via `accept(element, index)` et demande
à `interrupt(element, index)` s'il faut s'arrêter. Il n'y a aucun ordonnanceur caché, aucun objet d'abonnement,
aucune phase de démontage à mémoriser — la contre-pression et la terminaison font partie du protocole, et les
flux infinis deviennent des cas ordinaires (et non spéciaux).

**3. La paresse est le défaut ; la matérialisation est un choix.** Les opérateurs se contentent d'encapsuler des
générateurs. Rien ne s'exécute tant qu'un **collectable** ne consomme pas le pipeline, et le collecteur que vous
choisissez détermine le coût : `toUnordered()` est en O(n) et ne touche jamais vos index, `toOrdered()` est en
O(n log n) et les normalise. Comme la décision figure explicitement dans le type renvoyé, vous savez toujours si
l'ordre et la mémoire sont payés.

**4. Redirect est le seul mécanisme de réordonnancement.** `reverse()`, `translate()` et `shuffle()` ne sont rien
d'autre que des stratégies `redirect()` pré-emballées — chacune réécrit l'index d'un élément et rien d'autre. C'est
pourquoi elles **exigent toutes `toOrdered()`** pour prendre effet : le pipeline ne fait que réécrire les index, et
c'est le collecteur ordonné qui décide ce que ces index signifient.

**5. Synchrone et asynchrone : une seule API.** Les mêmes opérateurs existent aussi bien pour des données finies en
mémoire que pour des promesses, itérables asynchrones, minuteries, blobs et abonnements à des événements. Les sources
qui ne peuvent pas être synchrones le disent dans leur type de retour (`AsynchronousSemantic`), si bien que
« ai-je attendu cela ? » cesse d'être une surprise à l'exécution.

---

<a id="2-architecture"></a>
## 2. Architecture

Trois couches, une seule direction. Les données descendent ; le type que vous détenez indique ce que vous pouvez faire ensuite.

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

| Couche | Type | Responsabilité | Vous l'obtenez de |
| :--- | :--- | :--- | :--- |
| Source / pipeline | `SynchronousSemantic<E>`<br>`AsynchronousSemantic<E>` | Construit le pipeline paresseux : transforme, re-indexe, découpe, fusionne. Aucun élément n'est encore touché. | Les fabriques, et chaque opérateur d'un semantic |
| Stockage / vue | `SynchronousUnorderedCollectable<E>`<br>`SynchronousOrderedCollectable<E>`<br>`SynchronousNumericStatistics<E>`<br>`SynchronousBigIntStatistics<E>`<br>`SynchronousWindowCollectable<E>`<br>(+ les contreparties `Asynchronous*`) | Matérialise le pipeline dans un tampon adressé par index et expose l'API terminale. La famille **ordered** possède la comptabilité des index ; la famille **unordered** y renonce au profit du débit. | `toUnordered()` `toOrdered()` `toNumericStatistics()` `toBigintStatistics()` `toWindow()` `toCollectable()` |
| Collecteur | `SynchronousCollector<E, A, R>`<br>`AsynchronousCollector<E, A, R>` | Un pliage réutilisable : `identity → accumulator → finisher`, éventuellement avec un `interruptor`. Alimente chaque opération terminale et peut être écrit par l'utilisateur. | les fabriques de collecteurs `useSynchronous*` / `useAsynchronous*`, ou `Collectable.collect(...)` |

Pourquoi la couche intermédiaire existe : séparer « ce qu'est le pipeline » de « comment il est stocké » permet au
même `toOrdered()` de servir l'inversion, la rotation et le mélange — le pipeline ne fait que réécrire les index, et
le collecteur décide ce que ces index signifient.

---

<a id="3-data-flow-from-source-to-result"></a>
## 3. Flux de données : de la source au résultat

```typescript
const result = useRange(0n, 100n)      // (1) source: reserve indices 0n,1n,2n,…
  .filter(n => n % 2n === 0n)          // (2) operator: index is forwarded unchanged
  .translate(2)                        // (3) operator: index becomes i + 2 (a lazy shift)
  .limit(5n);                          // (4) operator: interrupt() returns true after 5 elements

const ordered = result.toOrdered();    // (5) collectable: materialise; indices normalised mod n, sorted
const array = ordered.toArray();       // (6) terminal: drain the buffer
```

1. **Construire.** Les étapes 1 à 4 ne construisent que des fermetures. Cent éléments ne sont jamais générés.
2. **Propager.** Lorsqu'un collectable exécute enfin le générateur, les éléments circulent sans ordonnanceur : la
   source pilote, `accept` écrit dans le collecteur, `interrupt` décide quand s'arrêter — voilà pourquoi
   `limit(5n)` au milieu d'un intervalle d'un million d'éléments coûte cinq itérations, et non un million.
3. **Indexer.** Les opérateurs ne perdent jamais l'index. `filter` transmet l'index d'origine (ainsi « le 3e
   élément *conservé* » reste « l'index 3 »), tandis que `skip` / `sub` / `limit` / `distinct` re-indexent
   délibérément.
4. **Matérialiser.** Un collectable exécute le générateur exactement une fois, à la construction.
5. **Terminal.** Les méthodes du collectable lisent le tampon ; elles sont peu coûteuses, répétables et ne
   relancent jamais le pipeline.

**La seule règle à retenir :** les transformations sont paresseuses, les collectables sont gourmands, les opérations terminales sont gratuites.

---

<a id="4-quick-start"></a>
## 4. Démarrage rapide

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
## 5. Fonctions de fabrique

### 5.1 Aperçu

La construction est toujours en O(1) — une fabrique se contente d'encapsuler un générateur. Le tableau ci-dessous
indique le coût de *consommation* de `n` éléments de chaque source, ainsi que l'espace supplémentaire dont la source
a besoin au-delà des éléments que vous collectez.

| Fabrique | Signature (résultat) | Temps (consommer n) | Espace (source) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | Les index vont de 0..n−1 ; l'argument spread est déjà matérialisé |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | Encapsule tout `Iterable` / `AsyncIterable` ; itéré une fois à la collecte |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` est exclusif ; `step` doit être non nul ; `number` et `bigint` fonctionnent tous deux |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | Un fournisseur est appelé une fois par élément |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | Élément neutre pour `concat` |
| `useText` | `useText(text)`<br>`useText(text, delimiter)`<br>`useText(text, start)` / `(text, start, end)` | O(n) | O(n) pour le texte | Itère sur les **points de code**, si bien que les emoji et le CJK restent des éléments uniques |
| `useAttribute` | `useAttribute<T>(object) → SynchronousSemantic<{key, value}>` | O(v + e) sur v valeurs et e arêtes | O(d + v) pour l'ensemble visité à la profondeur d | Parcourt récursivement les objets/tableaux imbriqués avec protection anti-cycle |
| `useGenerate` | `useGenerate<E>(supplier, interrupt) → SynchronousSemantic<E>` | O(n) × coût du fournisseur | O(1) | **Doit** avoir un `interrupt` d'arrêt (ou un `limit` / `takeWhile` en aval) |
| `useIterate` | `useIterate<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useIterate<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) par collecte | O(1) | Rejoue l'itérateur à chaque collecte |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period (temps réel) | O(1) | Émet le temps écoulé ; consomme du temps réel |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | Un seul élément à l'index `0n` |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob size) | O(chunk) par copie émise | Le morceau par défaut est de 64 Kio ; chaque morceau est une copie indépendante |
| `useSubscription` | `useSubscription(target, subscriber, event \| events) → AsynchronousSemantic<Event>` | un élément par événement | O(1) | `limit()` / `sub()` / `takeWhile()` définissent la frontière de désabonnement |

### 5.2 Exemples

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
## 6. Opérateurs de transformation

### 6.1 Aperçu

Chaque opérateur renvoie un nouveau `Semantic` ; aucun ne touche un élément tant qu'un collectable ne s'exécute. Le
temps est le coût supplémentaire **par élément** (au-delà du coût propre de l'amont) ; l'espace est la mémoire
supplémentaire conservée par l'opérateur pendant l'exécution du pipeline.

| Opérateur | Objectif | Effet sur l'index | Temps (par élément) | Espace |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | transformation 1:1 | transmis | O(1) | O(1) |
| `filter(predicate)` | conserve les éléments correspondants | transmis | O(1) | O(1) |
| `flat(mapper)` | aplatissement 1:N (itérable ou semantic) | re-indexé à partir de 0 | O(1) par élément émis | O(1) |
| `flatMap(mapper)` | aplatissement 1:N, peut changer le type de l'élément | re-indexé à partir de 0 | O(1) par élément émis | O(1) |
| `distinct(keyExtractor?)` | supprime les clés répétées, conserve la première | transmis | O(1) en moyenne | O(n) pour l'ensemble de clés |
| `peek(consumer)` | effet de bord, l'élément passe à travers | transmis | O(1) | O(1) |
| `limit(count)` | prend les *n* premiers | re-indexé à partir de 0 | O(1), arrête l'amont après n | O(1) |
| `skip(count)` | supprime les *n* premiers | transmis | O(1) par élément sauté | O(1) |
| `sub(start, end)` | tranche positionnelle `[start, end)` | transmis | O(1) | O(1) |
| `takeWhile(predicate)` | prend tant que le prédicat est vrai | transmis | O(1), arrête l'amont à la première défaillance | O(1) |
| `dropWhile(predicate)` | supprime tant que le prédicat est vrai | re-indexé à partir de 0 | O(1) | O(1) |
| `concat(other)` | ajoute un semantic ou un itérable | poursuit l'index | O(1) | O(1) |
| `redirect(redirector)` | calcule un nouvel index comme vous le souhaitez | **le vôtre** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | négative et décalée | O(1) | O(1) |
| `translate(offset)` | décalage paresseux de chaque index de *offset* | `i + offset` | O(1) | O(1) |
| `translate(mapper)` | décalage d'index par élément | `i + mapper(element, i)` | O(1) | O(1) |
| `shuffle(mapper?)` | rend l'index aléatoire (ou utilise votre propre mapper) | aléatoire | O(1) | O(1) |
| `pipe(conversion)` | confie le générateur à une fonction personnalisée | à votre discrétion | le vôtre | le vôtre |
| `semantic()` | remonte un collectable dans un semantic | inchangé | O(1) | O(1) |

### 6.2 Notes importantes

**`reverse`, `translate` et `shuffle` sont tous des stratégies `redirect` et nécessitent un collecteur ordonné.**
Ils ne font que réécrire les index — rien n'est mis en tampon, rien n'est encore rotatif. C'est `toOrdered()` qui
normalise les index modulo le nombre d'éléments et les transforme en un ordre :

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(-2).toOrdered().toArray();        // [3,4,5,1,2]
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3, 4, 5]).shuffle().toOrdered().toArray();            // a fresh permutation per call
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

Collectés avec `toUnordered()` à la place, les mêmes pipelines renvoient les éléments dans l'ordre d'arrivée avec
leurs index bruts — voir [Le modèle d'index](#10-the-index-model).

**`translate` est un décalage d'index pur et paresseux.** Les deux surcharges s'ajoutent à l'index
(`i + offset` ou `i + mapper(element, i)`) et ne mettent jamais le flux en tampon. Une rotation ne se matérialise
que lorsque le *collecteur ordonné* normalise les index modulo le nombre d'éléments — ainsi `translate(2)` reste
peu coûteux même sur un intervalle infini suivi d'un `limit`.

**`redirect` est l'outil général.** Toute stratégie d'index peut s'y exprimer — inversée, entrelacée,
partitionnée par hachage :

```typescript
useFrom([1, 2, 3, 4, 5]).redirect((_e, i) => -i - 1n).toOrdered().toArray();   // [5,4,3,2,1]
useFrom([1, 2, 3, 4]).redirect((_e, i) => i % 2n === 0n ? i + 1n : i - 1n)
  .toOrdered().toArray();                                                       // [2,1,4,3]
```

**Le découpage piloté par l'index reste de première classe :**

```typescript
useOf(1, 2, 3, 4, 5).sub(1, 3).toUnordered().toArray();               // [2,3]
useOf(1, 2, 3, 4, 5).skip(2n).toUnordered().toArray();                // [3,4,5]
useOf(1, 2, 3, 4, 5).takeWhile(n => n < 3).toUnordered().toArray();   // [1,2]
useOf(1, 2, 3, 4, 1).dropWhile(n => n < 3).toUnordered().toArray();   // [3,4,1]
```

---

<a id="7-collectables-and-terminal-operations"></a>
## 7. Collectables et opérations terminales

### 7.1 Choisir un collectable

Le collectable possède à la fois l'**ordre** et la **comptabilité des index**. `n` est le nombre d'éléments.

| Collectable | Structure | Temps | Espace | Ordre | À utiliser quand |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | `Map<bigint, E>` indexée par l'index | O(n) | O(n) | ordre d'insertion | débit maximal, ordre indifférent ; les index bruts sont préservés intacts |
| `toOrdered()` | tableau trié par index d'élément | O(n log n) | O(n) | par index normalisé | inversion/rotation/mélange doivent prendre effet, ou vous avez besoin d'un accès positionnel |
| `toOrdered(comparator)` | trié par votre comparateur, index reconstruit comme position | O(n log n) | O(n) | par votre comparateur | vues triées, lectures de type min/max |
| `toNumericStatistics()` | tampon trié par valeur | O(n log n) | O(n) | par valeur | statistiques sur `number` |
| `toBigintStatistics()` | tampon trié par valeur | O(n log n) | O(n) | par valeur | statistiques sur `bigint` |
| `toWindow()` | tampon trié par valeur | O(n log n) | O(n) | par valeur | `slide` / `tumble` |
| `toCollectable(mapper)` | ce que renvoie le mapper | — | — | — | collectables personnalisés |

### 7.2 Terminaux

Les coûts sont indiqués après matérialisation ; `k` est la position cible et `n` le nombre d'éléments.

| Terminal | Renvoie | Temps | Espace | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | O(n) | O(n) | Vide le tampon |
| `toSet()` | `Set<E>` | O(n) en moyenne | O(n) | Dédoublonne par identité |
| `toMap(keyExtractor, valueExtractor?)` | `Map<K, V>` | O(n) en moyenne | O(n) | La dernière écriture l'emporte |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | O(1) | Le tampon le sait déjà |
| `forEach(action)` | `void` | O(n) | O(1) | `action(element, index)` |
| `join(…)` | `string` | O(n) | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `log()` / `error()` | `void` | O(n) | O(n) | Sortie console encapsulée dans `[prefix … suffix]` |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | O(1) | Terminal de type E/S |
| `collect(collector)`<br>`collect(identity, accumulator, finisher)` | `R` | O(n) | accumulator | Le pliage générique derrière chaque terminal ci-dessus |
| `reduce(accumulator)` | `Optional<E>` | O(n) | O(1) | Flux vide → Optional vide |
| `reduce(identity, accumulator)` | `E` | O(n) | O(1) | — |
| `reduce(identity, accumulator, finisher)` | `R` | O(n) | O(1) | — |
| `group(classifier)` | `Map<K, E[]>` | O(n) en moyenne | O(n) | — |
| `groupBy(keyExtractor, valueExtractor)` | `Map<K, V[]>` | O(n) en moyenne | O(n) | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | O(n) | Round-robin par index dans `count` seaux |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | O(n) | Le numéro de seau provient du classifieur |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) au pire, avec court-circuit | O(1) | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | O(1) | Positionnel dans l'ordre matérialisé |
| `findAt(k)` | `Optional<E>` | O(k), s'arrête tôt | O(1) | Le (k+1)-ième élément **dans l'ordre matérialisé** |
| `findNegativeAt(k)` | `Optional<E>` | O(n−k), s'arrête tôt | O(1) | Compte à rebours depuis la fin de l'ordre matérialisé |
| `findMaximum(comparator?)` / `findMinimum(comparator?)` | `Optional<E>` | O(n) (O(1) sur les statistiques) | O(1) | Comparaison structurelle par défaut |
| `frequency()` | `Map<E, bigint>` | O(n) en moyenne | O(n) | Collectables de statistiques uniquement |
| `[Symbol.iterator]()` / `[Symbol.asyncIterator]()` | itérateur | O(n) | O(1) | `for…of` sur un collectable |

### 7.3 Exemples

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
## 8. Statistiques

`toNumericStatistics()` et `toBigintStatistics()` vous donnent un tampon trié par valeur ainsi qu'une API
statistique. Les deux acceptent un mapper, si bien que vous pouvez calculer sur une valeur projetée :
`.average(element => element.price)`.

| Méthode | Signification | `number` | `bigint` |
| :--- | :--- | :--- | :--- |
| `summate()` | Σx | exact | exact |
| `average()` / `mean()` | Σx / n | exact | division entière |
| `median()` | valeur médiane (moyenne des deux médianes pour les décomptes pairs) | exact | arrondie |
| `mode()` | valeur la plus fréquente | exact | exact |
| `variance()` | variance populationnelle σ² | exact | arrondie |
| `standardDeviation()` | √σ² | exact | arrondie |
| `range()` | max − min | exact | exact |
| `quantile(q)` | quantile au rang le plus proche, `0 ≤ q ≤ 1` | exact | exact |
| `interquartileRange()` | q(0.75) − q(0.25) | exact | exact |
| `skewness()` | Σ((x−μ)/σ)³ / n | exact | arrondie |
| `kurtosis()` | Σ((x−μ)/σ)⁴ / n − 3 (excess) | exact | arrondie |
| `frequency()` | valeur → compte | `Map<E, bigint>` | `Map<E, bigint>` |

Toutes les méthodes sont en O(1) sur le tampon trié (le tri a été payé une fois, à la matérialisation), à
l'exception de `frequency()` qui est en O(n) en moyenne avec un espace O(n).

Les résultats `bigint` sont calculés en virgule flottante puis arrondis à `bigint`, car la division entière les
fausserait autrement (la variance de `[1n,2n,3n,4n]` est `1.25`, et non `3`). Si vous avez besoin de statistiques
fractionnaires exactes, mappez vers `number` et utilisez le collecteur numérique.

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
## 9. Fenêtres

`toWindow()` renvoie un collectable dont les `slide` / `tumble` produisent un semantic *de semantics*.

```typescript
const windows = useOf(1, 2, 3, 4, 5).toWindow();

windows.tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2], [3,4], [5]]

windows.slide(3n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());
// [[1,2,3], [2,3,4], [3,4,5], [4,5], [5]]   — trailing partial windows are included
```

`tumble(size)` est globalement en O(n) ; `slide(size, step)` est en O(n × size) car les fenêtres se chevauchent.

Les sources asynchrones fonctionnent de la même manière ; `slide` / `tumble` attendent que le tampon sous-jacent
soit prêt :

```typescript
const asyncWindows = await useFrom(tick()).toWindow().tumble(2n).toUnordered().toArray();
for (const window of asyncWindows) {
  console.log(await window.toUnordered().toArray());
}
```

---

<a id="10-the-index-model"></a>
## 10. Le modèle d'index

Le modèle d'index comporte deux parties : le **pipeline** réécrit les index à peu de frais et paresseusement ; le
**collectable** décide ce qu'ils signifient. Cette séparation est délibérée, et c'est là que résident les coûts
d'ordonnancement.

| Concept | Comportement |
| :--- | :--- |
| Type d'index | `bigint`, toujours disponible comme second argument de chaque callback |
| Arithmétique du pipeline | `reverse()` = `redirect(-i - 1n)`, `translate(o)` = `redirect(i + o)`, `shuffle()` = `redirect(random)` — tous en O(1) par élément, tous paresseux, aucun ne met quoi que ce soit en tampon |
| `toUnordered()` — aucune comptabilité | Conserve chaque index brut intact dans une `Map`. `translate(2)` collecté non ordonné renvoie encore les index `2n,3n,4n,…`. C'est le contrat de performance : aucun tri, aucune normalisation, O(n) |
| `toOrdered()` — normalisation | Réécrit chaque index en `((i mod n) + n) mod n` (n = nombre d'éléments), puis trie. Les index négatifs ou trop grands se replient dans `0..n−1`, si bien que `reverse`, `translate(7)` et `shuffle` aboutissent tous à une position valide |
| `toOrdered(comparator)` | Trie par valeur et reconstruit les index comme positions — c'est ce que utilisent les statistiques |
| Rotation | Découle de la normalisation : `translate(2)` donne les index `2,3,4,0,1`, qui se trient en la rotation `[4,5,1,2,3]`. Aucune mise en tampon ne se produit dans l'opérateur |
| Index dupliqués | Détectés par `toUnordered()` et dotés de clés substitutives, si bien qu'**aucun élément n'est silencieusement supprimé** ; `toOrdered()` conserve les index égaux dans l'ordre relatif |
| `findAt(k)` / `findNegativeAt(k)` | Adressent l'**ordre matérialisé** — `findAt(1n)` est toujours le second élément de ce que le collectable a produit, `findNegativeAt(-1n)` toujours le dernier — indépendamment de ce que `redirect` / `reverse` / `translate` ont fait aux index bruts |
| `distinct` | Conserve la première occurrence **et son index d'origine** |
| `sub` / `skip` / `limit` | Comptent les éléments, pas les valeurs d'index |

En bref : **`OrderedCollectable` et ses sous-classes possèdent la comptabilité des index** (normalisent modulo n,
trient, adressent positionnellement), tandis que **`UnorderedCollectable` garantit la performance en ne touchant
jamais aux index**. Choisissez par requête, et non par pipeline.

---

<a id="11-the-asynchronous-model"></a>
## 11. Le modèle asynchrone

Les sources dont les données ne peuvent pas encore exister renvoient `AsynchronousSemantic<E>` :

| Source asynchrone | Pourquoi |
| :--- | :--- |
| `usePromise` | la valeur arrive plus tard |
| `useBlob` | `Blob.stream()` est asynchrone |
| `useInterval` | piloté par `setInterval` |
| `useSubscription` | piloté par des événements externes |
| `useFrom` / `useIterate` avec un `AsyncIterable` | produit par `for await` |

La consommation est uniforme — chaque terminal d'un `AsynchronousCollectable` renvoie une `Promise`, et la
sémantique (modèle d'index, normalisation, `findAt` positionnel) est identique au côté synchrone :

```typescript
const stats = await useFrom(asyncGenerator()).map(n => n * 2n).limit(10n).toBigintStatistics();
await stats.summate();

for await (const element of usePromise(Promise.resolve(1)).toUnordered()) {
  console.log(element);
}
```

Trois choses que le système de types ne vous sauvera pas de :

1. **Terminer le flux.** Une source d'événements ou de minuteries ne se termine jamais d'elle-même. Définissez la
   frontière — `limit(n)`, `sub(start, end)` ou `takeWhile(predicate)` — sinon l'abonnement reste actif.
2. **Attendre le collectable.** `toOrdered()`, les statistiques et `toWindow()` attendent que la source soit
   complétée avant de répondre ; une source ne contenant que des promesses qui ne se termine jamais les laisse en
   attente.
3. **Mélanger les couches.** Un collectable synchrone ne peut pas consommer une source asynchrone. Dès qu'une
   fabrique async intervient, gardez tout le pipeline côté async et `await` les terminaux.

---

<a id="12-utility-helpers"></a>
## 12. Fonctions utilitaires

| Assistant | Objectif | Temps |
| :--- | :--- | :--- |
| `useCompare(a, b)` | Comparaison structurelle utilisée par chaque tri/min/max par défaut (`number`, `bigint`, `string`, `boolean`, `symbol`, objets via `Symbol.toPrimitive`) | O(1) pour les primitives |
| `useRandom(start, end?)` | Génère un `number` / `bigint` aléatoire, uniforme sur l'intervalle semi-ouvert | O(1) |
| `useHash(value, …)` | Hachage `bigint` stable d'environ 64 bits pour toute valeur (primitives, objets, cycles) | O(v) sur les valeurs visitées |
| `register(type, handler)` / `unregister(type)` / `maskOf(type)` | Étend le hachage pour des types personnalisés | O(1) |
| `useTraverse(object, callback)` | Parcours en profondeur avec protection anti-cycle ; le callback reçoit `(key, value, path)` | O(v + e) |
| `useStringify(object, callback?)` | Sérialisation JSON qui survit aux références circulaires | O(v + e) |
| `useToNumber(value)` / `useToBigInt(value)` | Conversions totales (ne lèvent jamais d'exception ; renvoient `0` / `0n` pour une entrée inutilisable) | O(1) |
| `useGenerator(iterable)` / `useArrange(source, comparator?)` | Générateur brut `(accept, interrupt)`, et un générateur de tri | O(n) / O(n log n) |
| `Optional<T>` | `of`, `ofNullable`, `ofNonNull`, `empty` ; `map`, `flat`, `flatMap`, `filter`, `get`, `get(default)`, `ifPresent(action, elseAction)`, `orElse`, `isPresent`, `isEmpty`, `semantic()` | O(1) par méthode |
| Gardes de type | `isNumber` (exclut `NaN` et `Infinity`), `isBigInt`, `isString`, `isBoolean`, `isSymbol`, `isFunction`, `isObject`, `isPrimitive`, `isIterable`, `isAsyncIterable`, `isPromise`, `isAsyncFunction`, `isGeneratorFunction`, `isAsyncGeneratorFunction`, `isOptional`, `isSynchronousSemantic` / `isAsynchronousSemantic`, `isSynchronousCollectable` (+ async), `isSynchronousOrderedCollectable`, `isSynchronousUnorderedCollectable`, `isSynchronousStatistics`, `isSynchronousNumericStatistics`, `isSynchronousBigIntStatistics`, `isSynchronousWindowCollectable`, `isSynchronousCollector` | O(1) |

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
## 13. Comparaison avec d'autres bibliothèques

| Aspect | Semantic-TypeScript | RxJS | Itérateurs natifs |
| :--- | :--- | :--- | :--- |
| Modèle | propagation avec un signal `interrupt` explicite | propagation, objets d'abonnement | tirage |
| Position | index `bigint` intrinsèque sur chaque élément | opérateurs que vous composez (`scan`, `withLatestFrom`) | compteur manuel |
| Paresse | opérateurs paresseux, collectables explicites | opérateurs paresseux, `subscribe` gourmand | paresseux |
| Sync + async | une seule API, fabriques async signalées dans le type | asynchrone d'abord | pontage `for await` manuel |
| API terminale | collectable riche (`toArray`, `toMap`, `group`, `reduce`, `find*`, statistiques) | opérateurs uniquement | aucune |
| Statistiques | intégrées, pour `number` et `bigint` | externes | aucune |
| Sécurité du cycle de vie | l'opérateur de frontière se désabonne | `unsubscribe` / `takeUntil` manuels | manuel |
| Écosystème / taille | petit, zéro dépendance | grand écosystème d'opérateurs | zéro |

Choisissez Semantic-TypeScript lorsque vous voulez un traitement de données piloté par l'index avec un modèle de
coût explicite et sans ordonnanceur. Choisissez RxJS lorsque vous avez besoin de son écosystème d'opérateurs, de sa
sémantique multi-observateurs et de son contrôle d'ordonnancement.

---

<a id="14-performance-characteristics"></a>
## 14. Caractéristiques de performance

Le coût d'une requête est la somme de trois parties visibles : source (§5), opérateurs (§6), collectable (§7). Rien
de caché ne s'exécute jamais deux fois.

| Opération | Temps | Espace | Notes |
| :--- | :--- | :--- | :--- |
| `map` / `filter` / `peek` | O(1) par élément | O(1) | transformation pure |
| `limit` / `takeWhile` | O(1) par élément | O(1) | arrête l'amont immédiatement |
| `reverse` / `translate` / `shuffle` | O(1) par élément | O(1) | arithmétique d'index uniquement — aucune mise en tampon |
| `distinct` | O(1) en moyenne par élément | O(n) | `Set` de clés |
| `toUnordered()` | O(n) | O(n) | une insertion `Map` par élément ; index intacts |
| `toOrdered()` | O(n log n) | O(n) | normalise O(n) + tri O(n log n) |
| Statistiques | O(n log n) une fois, puis O(1) par méthode | O(n) | conserve un tampon trié/agrégé |
| `findAt(k)` / `findNegativeAt(k)` | O(k) / O(n−k) | O(1) | interruption anticipée dès que la position est dépassée |
| `findMaximum` / `findMinimum` | O(n) générique, O(1) statistiques | O(1) | passage unique avec le meilleur courant |

Règles générales : gardez le pipeline paresseux jusqu'à ce que vous ayez réellement besoin d'un résultat ; préférez
`toUnordered()` sauf si l'ordre compte ; placez `limit` / `takeWhile` aussi tôt que la sémantique le permet ; laissez
le *collectable*, et non l'opérateur, décider du coût de l'ordonnancement.

---

<a id="15-pitfalls-and-faq"></a>
## 15. Pièges et FAQ

**« Mon pipeline ne renvoie rien / bloque. »** La source ne s'est jamais terminée. `useInterval`,
`useSubscription`, `usePromise` et `useGenerate` ont besoin d'une frontière (`limit`, `sub`, `takeWhile`) ou d'une
source qui se termine.

**« reverse() n'a rien fait. »** Vous l'avez consommé avec `toUnordered()`, qui garantit l'absence de
comptabilité d'index. Utilisez `toOrdered()`.

**« translate(2) a renvoyé les éléments non rotatifs. »** Même raison : `translate` ne fait que décaler les index ;
la rotation est réalisée par la normalisation modulo de `toOrdered()`. Collecté non ordonné, le décalage reste
visible dans les index bruts.

**« Pourquoi un élément manque-t-il ? »** Un amont a produit des index dupliqués et vous consommez via
`toUnordered()`. Les clés substitutives préviennent la perte de données, mais si vous devez *voir* les deux éléments
dans l'ordre, consommez plutôt avec `toOrdered()`.

**« findAt(1n) renvoie quelque chose d'inattendu. »** `findAt` adresse l'**ordre matérialisé**, et non l'index
brut. Après `.reverse().toOrdered()`, la position 1 est le second élément de la séquence inversée. Si vous voulez
l'élément portant l'index brut `1n`, filtrez explicitement sur l'index.

**« Les statistiques bigint semblent arrondies. »** Elles le sont — les résultats `bigint` sont arrondis en entier
par conception (voir [Statistiques](#8-statistics)). Mappez vers `number` pour des fractions exactes.

**« Dois-je appeler `toXxx()` avant `toArray()` ? »** Oui. Les opérations terminales résident sur les collectables,
et non sur les semantics. C'est délibéré : cela rend le coût de stockage et d'ordonnancement visible dans le type.

**« Le tree-shaking fonctionne-t-il ? »** `sideEffects: false` est déclaré, importez donc uniquement ce que vous
utilisez. Notez que `useHash` enregistre ses gestionnaires par défaut au chargement du module.

---

<a id="16-license"></a>
## 16. Licence

MIT © Eloy Kim

Voir [CHANGELOG.md](./CHANGELOG.md) pour l'historique complet des versions.
