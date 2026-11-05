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
- 622 tests de non-régression : `npm test`.
- Historique des changements complet : [CHANGELOG.md](./CHANGELOG.md).

---

## Table des matières

1. [Philosophie de conception](#1-design-philosophy)
2. [Architecture](#2-architecture)
3. [Démarrage rapide](#3-quick-start)
4. [Fonctions de fabrique](#4-factory-functions)
5. [Opérateurs de transformation](#5-transformation-operators)
6. [Collectables et opérations terminales](#6-collectables-and-terminal-operations)
7. [Statistiques et fenêtres](#7-statistics-and-windows)
8. [Le modèle d'index](#8-the-index-model)
9. [Le modèle asynchrone](#9-the-asynchronous-model)
10. [Analyse périodique : anneaux, champs et scores](#10-periodic-analysis-rings-fields-and-scores)
11. [Fonctions utilitaires](#11-utility-helpers)
12. [Performance et pièges](#12-performance-and-pitfalls)
13. [Licence](#13-license)

---

<a id="1-design-philosophy"></a>
## 1. Philosophie de conception

Trois idées, un seul pipeline :

**L'index, c'est de la donnée.** Chaque élément est adressé par un `bigint`. L'inversion, la rotation, le mélange et
le partitionnement sont de l'arithmétique d'index, pas des opérations sur tampon. Rien n'est matérialisé tant qu'un
collectable ne le demande.

**La paresse est le défaut.** Une fabrique encapsule un générateur ; un opérateur en encapsule un autre. Aucun
élément n'est demandé tant qu'une opération terminale ne s'exécute, si bien qu'une source infinie est parfaitement
légale tant que quelque chose en aval l'arrête.

**Les terminaux sont explicites.** `map` renvoie un `Semantic`, pas un tableau. Les valeurs n'apparaissent que
lorsque vous nommez un collectable — `toUnordered()`, `toOrdered()`, `toNumericStatistics()`, `toWindow()` — et
chacun énonce ce qu'il coûte et quel ordre il produit.

La même discipline s'applique à la moitié mathématique de la bibliothèque. Un `Complex`, un `Angle` ou une
`Frequency` est une valeur immuable dont les invariants sont vérifiés à la construction ; un `Optional` remplace
`null` ; et un anneau de phase énonce exactement combien d'éléments il contient, quelle période il a et
dans quelle mesure il est équilibré.

---

<a id="2-architecture"></a>
## 2. Architecture

```
factory  ──▶  Semantic  ──▶  Semantic  ──▶  Collectable  ──▶  result
 (source)      (map)         (filter)        (terminal)
                    ▲
                    └── every operator returns a new Semantic wrapping a generator
```

| Couche | Module | Responsabilité |
| :--- | :--- | :--- |
| Sources | `synchronous/collectors`, `asynchronous/collectors` | Encapsule un itérable, un générateur, une promesse, un blob, une cible d'événement |
| Pipelines | `synchronous/semantic`, `asynchronous/semantic` | Opérateurs paresseux et réécriture d'index |
| Collectables | `synchronous/semantic`, `asynchronous/semantic` | Terminaux ordonnés, non ordonnés, statistiques, fenêtres et personnalisés |
| Collecteurs | `synchronous/collector`, `asynchronous/collector` | Les primitives de pliage sur lesquelles chaque terminal est bâti |
| Mathématiques | `mathematics/*` | Angles, complexes, fréquences, spectres, fenêtres, estimateurs, épicycles, anneaux de phase |
| Structures | `structure/*` | Listes, ensembles, tables, arbres, forêts, anneaux, champs |
| Erreurs | `structure/error` | La hiérarchie typée `SemanticError` et ses gardes de marque |

Les familles synchrone et asynchrone partagent un seul vocabulaire : les mêmes noms d'opérateurs, la même
sémantique d'index, les mêmes collectables. Les variantes asynchrones se contentent de renvoyer des promesses, et
elles mettent les écritures en file d'attente afin qu'une lecture émise après une écriture l'observe toujours.

### 2.1 Ce que cette version a déplacé et cassé

Trois modules ont changé de place ou de forme, et une série de valeurs par défaut a changé de sens. Chaque ancien comportement reste accessible par une option explicite ; rien n'a été retiré sans remplacement.

| Changement | Avant | Maintenant |
| :--- | :--- | :--- |
| Forêts | `structure/tree/rootedForest`, `structure/tree/unionFindForest` | `structure/forest/rootedForest`, `structure/forest/unionFindForest` ; `tree/index.ts` ne les réexporte plus |
| Erreurs | des erreurs natives ad hoc | une hiérarchie de quinze classes dans `structure/error.ts`, avec une garde de marque par classe et l'alias `SemanticRangeError` |
| Options d'estimateur | des définitions figées | `mathematics/quantile.ts` exporte `QuantileMethod`, `QuantileOptions`, `SkewnessEstimator`, `KurtosisEstimator` et `VarianceOptions` |
| `quantile` | Hyndman–Fan type 1 | type 7 — R `quantile`, NumPy `linear`, Excel `PERCENTILE.INC` |
| `skewness` / `kurtosis` | `g1` / `g2` | les estimateurs corrigés du biais `G1` / `G2` |
| `variance` / `standardDeviation` | `ddof = 0` | `ddof = 1`, enveloppé dans un `Optional` |
| `decibel` | une fonction `20·log10` | supprimée ; `amplitudeDecibel` (20·log10) et `powerDecibel` (10·log10) |
| `Spectrum.flatness()` | les magnitudes sur les deux moitiés | les puissances sur la moitié unilatérale |
| `Spectrum.bandEnergy()` | la somme brute bilatérale | unilatérale par défaut, avec repliement de la moitié conjuguée |
| `shortTimeFourierTransform` / `spectrogram` | Hann symétrique, trames complètes seulement | Hann périodique, `boundary: "zeros"`, `padded: true` |

Les chapitres 6, 7 et 10 documentent les remplacements ; les conséquences mesurées sont dans [CHANGELOG.md](./CHANGELOG.md).

---

<a id="3-quick-start"></a>
## 3. Démarrage rapide

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
## 4. Fonctions de fabrique

La construction est toujours en O(1) — une fabrique se contente d'encapsuler un générateur. Le tableau indique le
coût de *consommation* de `n` éléments, plus l'espace supplémentaire dont la source elle-même a besoin.

| Fabrique | Signature (résultat) | Temps (consommer n) | Espace (source) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `useOf` | `useOf<E>(...elements) → SynchronousSemantic<E>` | O(n) | O(n) | Les index vont de 0..n−1 ; l'argument spread est déjà matérialisé |
| `useFrom` | `useFrom<E>(Iterable<E>) → SynchronousSemantic<E>`<br>`useFrom<E>(AsyncIterable<E>) → AsynchronousSemantic<E>` | O(n) | O(1) | Encapsule tout itérable ; itéré une fois à la collecte |
| `useRange` | `useRange<N>(start, end, step?) → SynchronousSemantic<N>` | O(n) | O(1) | `end` est exclusif ; `step` doit être non nul ; `number` et `bigint` fonctionnent tous deux |
| `useFill` | `useFill<E>(element \| supplier, count) → SynchronousSemantic<E>` | O(n) | O(1) | Un fournisseur est appelé une fois par élément |
| `useEmpty` | `useEmpty<E>() → SynchronousSemantic<E>` | O(1) | O(1) | Élément neutre pour `concat` |
| `useText` | `useText(text, delimiter?)` | O(n) | O(n) pour le texte | Itère sur les **points de code**, si bien que les emoji et le CJK restent des éléments uniques |
| `useAttribute` | `useAttribute<T>(object)` | O(v + e) | O(d + v) | Parcourt récursivement les objets imbriqués avec protection anti-cycle |
| `useGenerate` | `useGenerate<E>(supplier, interrupt)` | O(n) × coût du fournisseur | O(1) | **Doit** avoir un `interrupt` d'arrêt ou un `limit` en aval |
| `useIterate` | `useIterate<E>(Iterable<E>)` / `(AsyncIterable<E>)` | O(n) par collecte | O(1) | Rejoue l'itérateur à chaque collecte |
| `useInterval` | `useInterval(period, delay?) → AsynchronousSemantic<number>` | n × period (temps réel) | O(1) | Émet le temps écoulé |
| `usePromise` | `usePromise<T>(promise) → AsynchronousSemantic<T>` | O(1) | O(1) | Un seul élément à l'index `0n` |
| `useBlob` | `useBlob(blob, chunk?) → AsynchronousSemantic<Uint8Array>` | O(blob size) | O(chunk) par copie | Le morceau par défaut est de 64 Kio |
| `useSubscription` | `useSubscription(target, subscriber, event) → AsynchronousSemantic<Event>` | un élément par événement | O(1) | `limit()` / `takeWhile()` définissent la frontière de désabonnement |

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
## 5. Opérateurs de transformation

Chaque opérateur renvoie un nouveau `Semantic` ; aucun ne touche un élément tant qu'un collectable ne s'exécute.
Le temps est le coût supplémentaire **par élément** ; l'espace est ce que l'opérateur conserve pendant l'exécution.

| Opérateur | Objectif | Effet sur l'index | Temps | Espace |
| :--- | :--- | :--- | :--- | :--- |
| `map(mapper)` | transformation 1:1 | transmis | O(1) | O(1) |
| `filter(predicate)` | conserve les éléments correspondants | transmis | O(1) | O(1) |
| `flat(mapper)` / `flatMap(mapper)` | aplatissement 1:N | re-indexé à partir de 0 | O(1) par élément émis | O(1) |
| `distinct(keyExtractor?)` | supprime les clés répétées, conserve la première | transmis | O(1) en moyenne | O(n) |
| `peek(consumer)` | effet de bord, l'élément passe à travers | transmis | O(1) | O(1) |
| `limit(count)` | prend les *n* premiers | re-indexé à partir de 0 | O(1) | O(1) |
| `skip(count)` | supprime les *n* premiers | transmis | O(1) | O(1) |
| `sub(start, end)` | tranche positionnelle `[start, end)` | transmis | O(1) | O(1) |
| `takeWhile(predicate)` | prend tant que le prédicat est vrai | transmis | O(1) | O(1) |
| `dropWhile(predicate)` | supprime tant que le prédicat est vrai | re-indexé à partir de 0 | O(1) | O(1) |
| `concat(other)` | ajoute un semantic ou un itérable | poursuit l'index | O(1) | O(1) |
| `redirect(redirector)` | calcule un nouvel index comme vous le souhaitez | **le vôtre** | O(1) | O(1) |
| `reverse()` | `redirect((_e, i) => -i - 1n)` | négatif et décalé | O(1) | O(1) |
| `translate(offset \| mapper)` | décale chaque index | `i + offset` | O(1) | O(1) |
| `shuffle(mapper?)` | rend l'index aléatoire | aléatoire | O(1) | O(1) |
| `pipe(conversion)` | confie le générateur à une fonction personnalisée | à votre discrétion | le vôtre | le vôtre |
| `semantic()` | remonte un collectable dans un semantic | inchangé | O(1) | O(1) |

**`reverse`, `translate` et `shuffle` ne réécrivent que des index.** Rien n'est mis en tampon ni tourné tant que
`toOrdered()` n'a pas normalisé les index modulo le nombre d'éléments :

```typescript
useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();            // [5,4,3,2,1]
useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();         // [4,5,1,2,3]  (rotation)
useFrom([1, 2, 3, 4, 5]).translate(7).toOrdered().toArray();         // [4,5,1,2,3]  (7 ≡ 2 mod 5)
useFrom([1, 2, 3]).shuffle((_e, i) => -i - 1n).toOrdered().toArray();   // [3,2,1]
```

---

<a id="6-collectables-and-terminal-operations"></a>
## 6. Collectables et opérations terminales

### 6.1 Collectables

Le collectable possède à la fois l'**ordre** et la **comptabilité des index**. `n` est le nombre d'éléments.

| Collectable | Structure | Temps | Ordre | À utiliser quand |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | `Map<bigint, E>` indexée par l'index | O(n) | insertion | débit maximal ; les index bruts sont préservés intacts |
| `toOrdered()` | tableau trié par index d'élément | O(n log n) | par index normalisé | une inversion/rotation doit prendre effet |
| `toOrdered(comparator)` | trié par votre comparateur | O(n log n) | par votre comparateur | vues triées |
| `toNumericStatistics()` | tampon trié par valeur | O(n log n) | par valeur | statistiques sur `number` |
| `toBigintStatistics()` | tampon trié par valeur | O(n log n) | par valeur | statistiques sur `bigint` |
| `toWindow()` | tampon trié par valeur | O(n log n) | par valeur | `slide` / `tumble` |
| `toCollectable(mapper)` | ce que renvoie le mapper | — | — | collectables personnalisés |

### 6.2 Terminaux

Chaque terminal vit sur le **collectable**, pas sur le `Semantic`. C'est ce que « les terminaux sont explicites » veut dire en pratique : un pipeline ne produit rien tant qu'un collectable n'est pas nommé, et `toCollectable()` sans mapper est la façon la moins coûteuse de le nommer.

| Terminal | Renvoie | Temps | Notes |
| :--- | :--- | :--- | :--- |
| `toArray()` / `toSet()` | `Array<E>` / `Set<E>` | O(n) | Vide le tampon ; `toSet` dédoublonne par identité |
| `toMap(key, value?)` | `Map<K, V>` | O(n) en moyenne | La dernière écriture l'emporte |
| `count()` / `isEmpty()` | `bigint` / `boolean` | O(1) | Le tampon le sait déjà |
| `forEach(action)` | `void` | O(n) | `action(element, index)` |
| `join(…)` | `string` | O(n) | `join()`, `join(delimiter)`, `join(prefix, delimiter, suffix)` |
| `reduce(…)` | `Optional<E>` / `E` / `R` | O(n) | Flux vide → `Optional` vide |
| `group(classifier)` / `groupBy(key, value)` | `Map<K, E[]>` | O(n) en moyenne | — |
| `partition(count)` | `Array<Array<E>>` | O(n) | Round-robin par index |
| `partitionBy(classifier)` | `Array<Array<E>>` | O(n) | Le numéro de seau provient du classifieur |
| `anyMatch` / `allMatch` / `nonMatch` | `boolean` | O(n) au pire, avec court-circuit | — |
| `findAny` / `findFirst` / `findLast` | `Optional<E>` | O(1)–O(n) | Positionnel dans l'ordre matérialisé |
| `findAt(k)` / `findNegativeAt(k)` | `Optional<E>` | O(k) / O(n−k) | Compte depuis le début / la fin |
| `findMaximum(cmp?)` / `findMinimum(cmp?)` | `Optional<E>` | O(n) | Comparaison structurelle par défaut |
| `frequency()` | `Map<E, bigint>` | O(n) en moyenne | Collectables de statistiques uniquement |
| `write(stream, accumulator?)` | `WritableStream<S>` | O(n) | Terminal de type E/S |
| `collect(collector)` | `R` | O(n) | Le pliage générique derrière chaque terminal ci-dessus |

### 6.3 Collecteurs de structure

`toArray`, `toSet` et `toMap` terminent un pipeline dans un conteneur JavaScript. Douze autres terminaux le terminent dans l'une des structures de la bibliothèque elle-même, si bien que le résultat porte les invariants que cette structure garantit plutôt que ceux qu'un tableau possède par accident. Ils sont disponibles sur chaque collectable, y compris le collectable nu rendu par `toCollectable()`.

| Terminal | Renvoie | Ordre | Coût |
| :--- | :--- | :--- | :--- |
| `toArray()` | `Array<E>` | ordre de parcours | O(n) |
| `toSet()` | `Set<E>` | ordre d'insertion, SameValueZero | O(n) en moyenne |
| `toMap(key, value?)` | `Map<K, V>` | ordre d'insertion ; la dernière écriture l'emporte | O(n) en moyenne |
| `toOrderedSet(comparator?)` | `SynchronousOrderedSet<E>` | croissant selon le comparateur | O(n²) au pire |
| `toUnorderedSet()` | `SynchronousUnorderedSet<E>` | non spécifié (seaux de hachage) | O(n) attendu |
| `toOrderedMap(key, value?)` | `SynchronousOrderedMap<K, V>` | ordre d'insertion ; la dernière écriture l'emporte | O(n) attendu |
| `toUnorderedMap(key, value?)` | `SynchronousUnorderedMap<K, V>` | non spécifié | O(n) attendu |
| `toList()` | `SynchronousList<E>` | ordre de parcours, doublons conservés | O(n) |
| `toCycle(span?)` | `SynchronousCycle<E>` | l'ordre de parcours fixe les positions sur l'anneau | O(n) |
| `toLRUSet(capacity)` | `SynchronousUnorderedLRUSet<E>` | par récence ; seuls les `capacity` derniers survivent | O(n²) au pire |
| `toLRUMap(capacity, key, value?)` | `SynchronousUnorderedLRUMap<K, V>` | par récence | O(n) attendu |
| `toSkipSet(comparator?)` | `SynchronousSkipSet<E>` | croissant selon le comparateur, navigable | O(n²) au pire |
| `toSkipMap(key, value?)` | `SynchronousSkipMap<K, V>` | selon le comparateur de clés, navigable | O(n) attendu |
| `toBinarySearchTree(comparator?)` | `SynchronousBinarySearchTree<E>` | croissant selon le comparateur, équilibré en hauteur | O(n log n) |
| `toRootedForest()` | `SynchronousRootedForest<E>` | l'ordre de parcours devient la structure | O(n) |

Le type du résultat suit le type d'élément du collectable lui-même, donc aucun terminal ne prend d'argument de type : un `SynchronousCollectable<E>` vous remet directement `Array<E>`, `SynchronousList<E>` ou `SynchronousOrderedSet<E>`. Seuls restent les arguments métier — le comparateur de `toOrderedSet` / `toSkipSet` / `toBinarySearchTree`, la capacité de la paire LRU, l'étendue de `toCycle`, et les extracteurs de clé et de valeur de la famille des tables.

Un cycle est un ensemble, donc les éléments répétés gardent leur première position ; toutes les autres structures ci-dessus conservent les doublons sauf si leur propre contrat en décide autrement (`toOrderedSet`, `toUnorderedSet` et `toSkipSet` sont des ensembles ; `toBinarySearchTree` et `toList` n'en sont pas).

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

Les collectables asynchrones exposent les mêmes terminaux et résolvent chacun dans une promesse ; la forme de l'appel ne gagne donc qu'un `await`.

---

<a id="7-statistics-and-windows"></a>
## 7. Statistiques et fenêtres

### 7.1 La surface statistique

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();                    // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();                    // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();                     // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                       // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance().get();             // 3.2    (n − 1)
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation().get();    // 1.7889 (n − 1)
```

Les deux familles statistiques exposent la même surface — `summate`, `average`, `median`, `mode`, `variance`, `standardDeviation`, `frequency`, `findMaximum`, `findMinimum` — avec de l'arithmétique `bigint` pour `toBigintStatistics()`. Les mesures de dispersion et la famille des quantiles renvoient un `Optional`, car un échantillon peut être trop petit pour qu'elles soient définies ; déballez-les avec `.get()`, `.orElse(…)` ou `.isPresent()`.

### 7.2 Estimateurs et valeurs par défaut

Les valeurs par défaut sont les définitions qu'utilisent R, NumPy, pandas et Excel : une valeur calculée ici se compare donc à ces outils sans facteur de correction.

| Statistique | Défaut | Auparavant | Retrouver l'ancienne valeur avec |
| :--- | :--- | :--- | :--- |
| `quantile(probability)` | Hyndman–Fan type 7 | type 1 | `{ method: "type-1" }` |
| `interquartileRange()` | Hyndman–Fan type 7 | type 1 | `{ method: "type-1" }` |
| `skewness()` | `G1` corrigé du biais | `g1` | `{ estimator: "g1" }` |
| `kurtosis()` | `G2` d'excès corrigé du biais | `g2` | `{ estimator: "g2" }` |
| `variance()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |
| `standardDeviation()` | `ddof = 1` | `ddof = 0` | `{ ddof: 0 }` |

Les neuf types de Hyndman–Fan sont disponibles sous `"type-1"` … `"type-9"`, et `{ excess: false }` rajoute trois au kurtosis pour rapporter le quatrième moment standardisé non excessif. Les types d'options — `QuantileMethod`, `QuantileOptions`, `SkewnessEstimator`, `KurtosisEstimator`, `VarianceOptions` — sont exportés par `mathematics/quantile.ts`.

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

`G1` et `G2` sont indéfinis en dessous de trois et quatre observations, et la variance et l'écart-type d'échantillon le sont en dessous de deux observations avec `ddof = 1`. Cela est rapporté par un `Optional` vide plutôt que par un zéro trompeur :

```typescript
useOf(1, 2, 3).toNumericStatistics().kurtosis().isEmpty();     // true  (G2 needs four observations)
useOf(1, 2).toNumericStatistics().skewness().isEmpty();        // true  (G1 needs three)
useOf(1).toNumericStatistics().variance().isEmpty();           // true  (ddof = 1 needs two)
useOf(1).toNumericStatistics().variance({ ddof: 0 }).get();    // 0
```

Les vues bigint acceptent les mêmes options et arrondissent chaque résultat en un `bigint` entier.

### 7.3 Fenêtres

Les fenêtres réexposent les éléments tamponnés sous forme de pipeline de pipelines, si bien qu'une fenêtre peut être consommée sans la matérialiser d'abord en tableau. Les deux formes incluent une dernière fenêtre partielle.

```typescript
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[2,3],[3,4],[4]]

useFrom([1, 2, 3, 4]).toWindow().tumble(2n).toUnordered().toArray()
  .map(window => window.toUnordered().toArray());        // [[1,2],[3,4]]
```

---

<a id="8-the-index-model"></a>
## 8. Le modèle d'index

Un index est un `bigint` attaché à chaque élément. Les opérateurs le **transmettent**, le **re-indexent**
à partir de zéro, ou vous laissent le **calculer**.

La collecte ordonnée normalise chaque index modulo le nombre d'éléments, puis trie sur le résultat. C'est
pourquoi `translate(7)` sur cinq éléments équivaut à `translate(2)` : `7 ≡ 2 (mod 5)`.

La collecte non ordonnée conserve l'index que le pipeline a produit et renvoie les éléments dans l'ordre
d'arrivée. Les index négatifs sont légaux et se trient simplement avant les non négatifs une fois normalisés.

---

<a id="9-the-asynchronous-model"></a>
## 9. Le modèle asynchrone

`AsynchronousSemantic` reflète la surface synchrone, en renvoyant des promesses. Les écritures sont mises en file
d'attente, si bien qu'une lecture émise après une écriture l'observe toujours.

```typescript
const cycle = new AsynchronousCycle([1, 2]);
const added   = cycle.add(3);          // queued
const sampled = cycle.elementAt(2n);   // observes the write above
await added;
(await sampled).get().element;         // 3
```

Les fabriques asynchrones par nature — `usePromise`, `useBlob`, `useInterval`, `useSubscription` — renvoient
directement un `AsynchronousSemantic`, et `useFrom` / `useIterate` se mettent à niveau lorsqu'on leur confie un
`AsyncIterable`.

---

<a id="10-periodic-analysis-rings-fields-and-scores"></a>
## 10. Analyse périodique : anneaux, champs et scores

La moitié mathématique de la bibliothèque traite un cycle comme un objet de première classe plutôt que comme une
table de correspondance. Trois constructions travaillent ensemble.

### 10.1 Un anneau est un entier

Un `Cycle` est un **anneau n-fois** : le nombre d'éléments, la période positionnelle et le nombre de phases
distinctes sont le même entier `n`. La phase d'une position est calculée à partir de son résidu exact, si bien que
l'anneau est périodique au bit près :

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

`frequency` est la vitesse de rotation **ambiante**, non un pas de phase entre positions : l'environnement
déplace chaque phaseur du même angle, si bien qu'il ne peut jamais briser le motif intrinsèque. `span` fixe le
nombre de tours qu'occupe l'anneau.

`purity()` est la part d'énergie portée par le mode fondamental,
`max(|c₁|², |c_{n−1}|²) / (n · Σ|z|²)`. Elle vaut `1` exactement lorsque l'anneau est constitué des racines
`n`-ièmes de l'unité à une rotation près, et elle coûte `O(n)` car seuls deux bins sont nécessaires. Les deux
sens sont testés, car un anneau peut parcourir le cercle dans un sens ou dans l'autre.

### 10.2 Un champ est un score borné

Un `PhaseField` associe une phase relative à un score dans `[-1, 1]` :

```typescript
import { useField, useRadian } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ): +1 aligned, −1 opposed
const mixed  = useField([0.4, 0.3, 0.3]);  // first three harmonics

cosine.sample(useRadian(0));               //  1
cosine.sample(useRadian(Math.PI));         // -1
```

Le score est une série de cosinus tronquée, `a₀ + Σ wₘ·cos(2πmΔ)`, et le constructeur impose
`|a₀| + Σ|wₘ| ≤ 1`. Par l'inégalité triangulaire, le score ne peut jamais sortir de `[-1, 1]` — la borne est une
**conséquence de la construction**, et non un écrêtage appliqué après coup.

La raison pour laquelle le champ est une série et non une table : une table à `n` points reproduit exactement ses
propres échantillons, mais son interpolant trigonométrique dépasse entre ceux-ci. Une table à cinq points notée
`[+1, +0.5, −1, −0.5, 0]` interpole sur `[−1.0428, 1.0041]`, ce qui brise déjà la promesse.
Une série bornée ne le peut pas.

### 10.3 L'analyse mesure les données à chaque élément

Chaque élément de l'anneau est une phase de référence. `analyse` replace chaque observation sur l'anneau et la
mesure par rapport à chaque référence :

```typescript
const ring = new SynchronousCycle(["a", "b", "c", "d", "e"]);
const report = ring.analyse(["a", "c", "c", "a", "zz", "e"]);

report.matched;                              // 5
report.missed;                               // 1  ('zz' is not on the ring)
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

Chaque ligne de référence rapporte `count`, la phase relative moyenne `mean` et la longueur résultante moyenne
`resultant`. Une identité mérite d'être retenue : **`resultant` est identique pour chaque référence**,
car changer la ligne de base ne fait que faire tourner toutes les phases relatives d'une constante. Ce qui diffère
d'une référence à l'autre, c'est le compte et la moyenne.

```typescript
const cycle = new SynchronousCycle(["a", "b", "c"]);
cycle.scoresAt(0, cosine);                   // one score per position, in [-1, 1]
```

### 10.4 Instruments associés

| Appel | Répond | Coût |
| :--- | :--- | :--- |
| `purity()` | l'anneau est-il toujours les racines `n`-ièmes de l'unité ? | O(n) |
| `resultant(t?)` | à quel point les phaseurs sont-ils concentrés maintenant ? | O(n) |
| `analyse(data)` | comment ces données se situent-elles par rapport à chaque élément ? | O(n · m) |
| `toSpectrum()` | l'anneau comme spectre, nombre d'onde sur l'axe des fréquences | O(n²) |
| `useAngularSpectrum(cycle, instants, plan)` | le plan `(ω, n)` au fil du temps | O(n² · frames) |

Deux primitives supplémentaires complètent le modèle : `combineCycles(a, b)` joint deux anneaux sur leur plus petit
commun multiple (un pullback, pas un produit — les paires qui ne peuvent pas partager un instant sont simplement
absentes), et `rate()` donne à chaque élément sa propre fréquence intrinsèque, afin qu'un anneau puisse dériver par
rapport à l'environnement. `jetAt`, `windingAt` et `errorIntegralAt` exposent l'état différentiel de cette dérive.

### 10.5 Fenêtres spectrales

Les constructions d'anneaux sont une moitié de la surface analytique ; l'autre travaille sur des signaux échantillonnés. Sa primitive la plus réutilisée est la fenêtre, et chaque forme ici possède deux variantes. La variante symétrique divise la trame par `count − 1` ; la variante périodique (DFT paire) la divise par `count`, un échantillon de moins qu'une période complète, de sorte que le taper est continu sous l'extension périodique que suppose la DFT.

```typescript
useHannWindow(1, 4);                                   // 0.75  symmetric
useHannPeriodicWindow(1, 4);                           // 0.5   periodic
coherentGain(useHannPeriodicWindow, 16);               // 0.5
equivalentNoiseBandwidth(useHannPeriodicWindow, 16);   // 1.5
```

| Forme | Symétrique | Périodique | Notes |
| :--- | :--- | :--- | :--- |
| Rectangulaire | `useRectangularWindow` | — | sans taper ; pas de distinction périodique |
| Hann | `useHannWindow` | `useHannPeriodicWindow` | le défaut de l'analyse à court terme |
| Hamming | `useHammingWindow` | `useHammingPeriodicWindow` | — |
| Blackman | `useBlackmanWindow` | `useBlackmanPeriodicWindow` | — |
| Nuttall | `useNuttallWindow` | `useNuttallPeriodicWindow` | Blackman–Harris à quatre termes |
| Flat-top | `useFlatTopWindow` | `useFlatTopPeriodicWindow` | la précision d'amplitude avant la résolution |
| Kaiser | `useKaiserWindow(beta)` | `useKaiserPeriodicWindow(beta)` | `beta` fixe la largeur du lobe principal |

Utilisez la variante périodique pour l'analyse et l'overlap-add : à un saut d'une demi-trame, la fenêtre de Hann périodique somme à `1.000000` quelle que soit la longueur, tandis que la variante symétrique ondule de `0.841 dB` à `N = 16` et encore de `0.013 dB` à `N = 1024`. Gardez la variante symétrique pour la conception de filtres, où la trame n'est pas une période du taper.

Les fenêtres flat-top renvoient des **poids négatifs** près des extrémités de la trame, parce qu'une fenêtre flat-top est exactement cela. Ils sont renvoyés tels quels plutôt qu'écrêtés, car écrêter perturbe le lobe principal et détruit la faible perte de scalloping qui justifie l'existence de la fenêtre :

```typescript
useFlatTopWindow(0, 1024);                             // -0.000421 — negative by definition
Array.from({ length: 1024 }, (_unused, index) => useFlatTopWindow(index, 1024))
  .filter(weight => weight < 0).length;                // 578
```

### 10.6 Niveaux, platitude et énergie de bande

`decibel` a disparu en tant que fonction unique, parce qu'une amplitude et une puissance ne partagent pas le même facteur. `amplitudeDecibel` applique `20·log10` à un rapport de type tension ; `powerDecibel` applique `10·log10` à une puissance, une énergie, un carré moyen ou une densité spectrale de puissance :

```typescript
amplitudeDecibel(0.25);                                // -12.0412
powerDecibel(0.25);                                    //  -6.0206
```

`Bin.decibel` et `Spectrum.decibelOf` sont des niveaux d'amplitude ; `Spectrum.powerDecibelOf` est le niveau de puissance correspondant. Donner une puissance à la forme amplitude rapporte `20·log10(power)` et double le niveau en décibels.

Deux mesures de spectre ont changé de lecture :

```typescript
const twoBins = new Spectrum(new Sample(2, 1), [new Complex(2, 0), new Complex(1, 0)]);
twoBins.flatness();                                    // 0.8 — geometric over arithmetic mean of power

const shape = new Spectrum(new Sample(4, 1), [
  new Complex(1, 0), new Complex(2, 0), new Complex(0, 0), new Complex(0, 0),
]);
shape.bandEnergy(new Frequency(0), new Frequency(2));                // 9
shape.bandEnergy(new Frequency(0), new Frequency(2), "two-sided");   // 5
```

`flatness()` compare les moyennes géométrique et arithmétique de `power()` sur la moitié unilatérale du spectre, et non la moyenne des magnitudes sur les deux moitiés, et le doublement d'amplitude purement affichage de `oneSided()` n'est délibérément pas appliqué. `bandEnergy()` utilise par défaut la lecture unilatérale, en repliant la moitié conjuguée : DC et Nyquist comptent une fois et chaque bin intérieur compte deux fois ; une bande couvrant tout l'axe satisfait alors Parseval, `Σ|X|² = N·Σx²`. Passez `"two-sided"` pour un spectre complexe, dont les bins sont déjà indépendants.

### 10.7 Analyse à court terme

`Sampler.shortTimeFourierTransform` et `Sampler.spectrogram` suivent les conventions `stft` de SciPy : fenêtre de Hann périodique, bordure remplie de zéros aux deux extrémités et queue remplie de zéros.

```typescript
const sampler = new Sampler(new Sample(64, 1));
const spectrogram = sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8);

spectrogram.size();                     // 9 frames
spectrogram.getBoundary();              // "zeros"
spectrogram.getTime(6);                 // 0.75 — frame centres, not frame starts
sampler.spectrogram(time => Math.cos(2 * Math.PI * 4 * time), 16, 8, useHannWindow,
  { boundary: "none", padded: false }).size();                       // 7 — complete frames only
```

L'extension centre la première trame sur le premier échantillon, et le remplissage de queue rend les derniers échantillons atteignables : 64 échantillons avec une trame de 16 et un saut de 8 donnent 9 trames au lieu de 7, et 1000 échantillons avec une trame de 256 et un saut de 128 donnent 9 trames au lieu de 6. Les temps de trame sont des centres — `(k·hop + (frameSize mod 2)/2)/rate` pour une vue étendue, `(k·hop + frameSize/2)/rate` pour une vue non étendue — et `toFrame()` rogne l'extension avant d'inverser.

---

<a id="11-utility-helpers"></a>
## 11. Fonctions utilitaires

### 11.1 La hiérarchie d'erreurs

`structure/error.ts` exporte une hiérarchie de quinze classes pour les erreurs levées *autour* d'un pipeline — par votre propre code, un collecteur personnalisé ou un adaptateur :

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

Chaque classe fixe `name`, transmet la `cause` native, porte un sac `context` optionnel et se sérialise via `toJSON()` ; chacune possède une garde de marque du même nom.

```typescript
const error = new CapacityError("LRU capacity exhausted", { context: { capacity: 0 } });

error.name;                 // "CapacityError"
isCapacityError(error);     // true
isValidationError(error);   // false — a capacity failure is not a validation failure
isSemanticError(error);     // true
error.toJSON();             // { name: "CapacityError", message: "…", context: { capacity: 0 } }
```

`SemanticRangeError` est la même classe que le `RangeError` exporté, donc `instanceof` tient pour les deux noms ; importer `RangeError` masque le constructeur global pour tout le module, et c'est pourquoi l'alias existe. Aucune des deux classes n'est levée par les vérifications d'arguments de la bibliothèque, qui continuent de lever les `TypeError` et `RangeError` natifs — la hiérarchie est le vocabulaire de la couche au-dessus.

### 11.2 Table des utilitaires

| Assistant | Objectif |
| :--- | :--- |
| `useCompare(a, b)` | Ordre total entre primitives mixtes |
| `useToNumber` / `useToBigInt` | Conversion numérique sans perte et vérifiée en plage |
| `useRandom` | Assistants aléatoires avec ou sans graine |
| `useTraverse` | Parcours structurel d'objets et de tableaux imbriqués |
| `useStringify` | Sérialisation JSON sûre face aux cycles |
| `useHash` / `maskOf` / `register` / `unregister` | Hachage structurel et registre de stratégies de hachage |
| `invalidate` / `validate` | Gardes qui lèvent une forme d'erreur cohérente |
| `Optional<T>` | Le remplacement de `null` de la bibliothèque : `Optional.of(x)` / `Optional.empty()` |

### 11.3 `useTraverse`

`useTraverse(target, callback)` aplatit n'importe quel objet en ses **feuilles non nulles**. Il descend dans les objets imbriqués, parcourt les valeurs itérables par position, ignore `null` et `undefined` et ne rentre jamais dans un objet déjà visité — un graphe d'objets comportant un cycle se termine donc au lieu de faire déborder la pile.

```typescript
const source = { id: 7, tags: ["a", "b"], owner: { name: "Ada", note: null } };
const leaves: string[] = [];

useTraverse(source, (key, value, path) => {
  leaves.push(`${path.join(".")} = ${String(value)}`);
  return true;
});

leaves;   // ["id = 7", "tags.0 = a", "tags.1 = b", "owner.name = Ada"]
```

Le rappel s'exécute une fois par feuille et reçoit la clé propre de la feuille (son indice lorsqu'elle provient d'un itérable), la valeur, et le chemin qui y mène. Renvoyer `false` abandonne **tout** le parcours, pas seulement la branche courante :

```typescript
let visited = 0;
useTraverse({ a: 1, b: 2, c: 3 }, () => {
  visited += 1;
  return false;
});
visited;   // 1 — the first leaf already stops the walk
```

Un cycle est sûr pour la même raison :

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

**Chaque rappel reçoit son propre instantané de chemin.** Le parcours ne garde en interne qu'un tableau de travail et le copie, au moment où une feuille est remise, dans un nouveau tableau gelé par `Object.freeze`. L'instantané ne change plus ensuite : il peut être conservé tel quel, deux rappels ne partagent jamais un tableau, et relancer le parcours ne perturbe pas les instantanés déjà remis. Son type est `ReadonlyArray`, y écrire est donc une erreur de compilation, et le tableau gelé lève en plus un `TypeError` à l'exécution. Cette sûreté coûte une allocation `O(depth)` par feuille rapportée ; une branche qui ne rapporte rien n'alloue rien de plus.

```typescript
const paths: Array<ReadonlyArray<PropertyKey>> = [];
useTraverse({ a: { b: 1 }, c: 2 }, (_key, _value, path) => {
  paths.push(path);                      // safe to keep as-is
  return true;
});
paths[0] === paths[1];                   // false — one array per call
paths.map(path => path.join("."));       // ["a.b", "c"]
```

`useAttribute` est ce parcours transformé en fabrique : elle rapporte les mêmes feuilles sous forme de paires `{ key, value }`, donc les règles — et le coût — sont identiques.

```typescript
useAttribute({ a: 1, b: { c: 2 } }).toUnordered().toArray();
// [{ key: "a", value: 1 }, { key: "c", value: 2 }]
```

---

<a id="12-performance-and-pitfalls"></a>
## 12. Performance et pièges

**La paresse a un prix par étage.** Chaque opérateur ajoute un saut de générateur. Pour des boucles numériques
serrées sur des tableaux en mémoire, une simple boucle `for` battra n'importe quel pipeline ; le pipeline gagne
lorsque la source est paresseuse, infinie, ou que le pipeline est assez long pour que la discipline d'index paie.

**`toOrdered()` trie ; `toUnordered()` ne trie pas.** Si une inversion semble « ne pas avoir marché », le
collecteur était non ordonné — une réécriture d'index ne devient un ordre que lorsque les index sont normalisés.

**`useGenerate` sans `interrupt` ne se termine jamais.** Fournissez toujours un prédicat d'arrêt ou un
`limit` / `takeWhile` en aval.

**`Cycle` est un ensemble à ordre d'insertion.** Les éléments sont uniques et conservent l'ordre dans lequel ils ont
été ajoutés pour la première fois. Un `add` en double renvoie `false`, et un `set` qui en introduirait un lève une
exception. C'est ce qui permet à une phase d'être une fonction de l'*élément* plutôt que de la position
qu'il occupe par hasard.

**`Spectrum` suppose un signal réel dans ses assistants unilatéraux.** `oneSided()`, `getNyquist()` et
`centroid()` supposent une symétrie conjuguée. Le spectre spatial d'un anneau de phase est complexe et en
général non symétrique — un anneau qui parcourt le cercle à rebours place toute son énergie dans le bin
`n − 1`, au-delà de Nyquist. Lisez les bins directement.

**Les collecteurs de structure sont des terminaux, pas des vues.** Chacun vide le pipeline puis construit une structure complète : il coûte donc O(n) en temps et en espace et ne peut pas tourner sur une source infinie. Utilisez-en un à la fin d'un pipeline, jamais à l'intérieur d'une boucle sur un pipeline.

**`variance()` et ses compagnons renvoient un `Optional`.** `variance().get()` sur un échantillon trop petit lève une exception ; utilisez `.orElse(0)` ou vérifiez `.isPresent()` quand la taille de l'échantillon ne dépend pas de vous. Il en va de même pour `standardDeviation`, `quantile`, `interquartileRange`, `skewness` et `kurtosis`.

**Les fenêtres périodiques sont les fenêtres d'analyse.** `useHannWindow` et les autres formes symétriques sont destinées à la conception de filtres ; une analyse à court terme veut `useHannPeriodicWindow` et ses sœurs, sinon la somme d'overlap-add ondule à chaque jonction de trames.

---

<a id="13-license"></a>
## 13. Licence

MIT © Eloy Kim
