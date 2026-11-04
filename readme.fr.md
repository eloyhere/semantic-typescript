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
- 496 tests de non-régression : `npm test`.
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
                    └── chaque opérateur renvoie un nouveau Semantic encapsulant un générateur
```

| Couche | Module | Responsabilité |
| :--- | :--- | :--- |
| Sources | `synchronous/collectors`, `asynchronous/collectors` | Encapsule un itérable, un générateur, une promesse, un blob, une cible d'événement |
| Pipelines | `synchronous/semantic`, `asynchronous/semantic` | Opérateurs paresseux et réécriture d'index |
| Collectables | `synchronous/semantic`, `asynchronous/semantic` | Terminaux ordonnés, non ordonnés, statistiques, fenêtres et personnalisés |
| Collecteurs | `synchronous/collector`, `asynchronous/collector` | Les primitives de pliage sur lesquelles chaque terminal est bâti |
| Mathématiques | `mathematics/*` | Angles, complexes, fréquences, spectres, fenêtres, épicycles, anneaux de phase |
| Structures | `structure/*` | Listes, ensembles, tables, arbres, anneaux, champs |

Les familles synchrone et asynchrone partagent un seul vocabulaire : les mêmes noms d'opérateurs, la même
sémantique d'index, les mêmes collectables. Les variantes asynchrones se contentent de renvoyer des promesses, et
elles mettent les écritures en file d'attente afin qu'une lecture émise après une écriture l'observe toujours.

---

<a id="3-quick-start"></a>
## 3. Démarrage rapide

```typescript
import {
  useOf, useFrom, useRange, useText, useStringify, usePromise
} from "semantic-typescript";

// Agrégation numérique
const sum: number = useOf(10, 20, 30, 40)
  .map(n => n * 2)
  .toNumericStatistics()
  .summate();                                   // 200

// Agrégation BigInt
const bigSum: bigint = useOf(10n, 20n, 30n, 40n)
  .map(n => n * 2n)
  .toBigintStatistics()
  .summate();                                   // 200n

// Le réordonnancement relève de l'arithmétique d'index — collectez avec toOrdered() pour qu'il prenne effet
const reversed: number[] = useFrom([1, 2, 3, 4, 5]).reverse().toOrdered().toArray();      // [5,4,3,2,1]
const rotated: number[]  = useFrom([1, 2, 3, 4, 5]).translate(2).toOrdered().toArray();   // [4,5,1,2,3]

// Évaluation paresseuse sur un grand intervalle
const multiples: bigint[] = useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)
  .limit(10n)
  .toUnordered()
  .toArray();                                   // [0n,17n,…,153n]

// Traitement de chaînes sûr pour Unicode (points de code, et non unités UTF-16)
useText("semantic 👍").toUnordered().forEach(character => console.log(character));

// Sérialisation sûre face aux cycles
const cyclic: any = { a: 1 }; cyclic.self = cyclic;
useStringify(cyclic);                           // '{"a":1}'

// Sources asynchrones
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

---

<a id="7-statistics-and-windows"></a>
## 7. Statistiques et fenêtres

```typescript
useOf(3, 1, 4, 1, 5).toNumericStatistics().summate();              // 14
useOf(3, 1, 4, 1, 5).toNumericStatistics().average();              // 2.8
useOf(3, 1, 4, 1, 5).toNumericStatistics().median();               // 3
useOf(3, 1, 4, 1, 5).toNumericStatistics().mode();                 // 1
useOf(3, 1, 4, 1, 5).toNumericStatistics().variance();             // 2.56
useOf(3, 1, 4, 1, 5).toNumericStatistics().standardDeviation();    // 1.6
useFrom([1, 2, 3, 4]).toWindow().slide(2n, 1n);                    // [[1,2],[2,3],[3,4]]
```

Les deux familles de statistiques exposent la même surface — `summate`, `average`, `median`, `mode`,
`variance`, `standardDeviation`, `frequency`, `findMaximum`, `findMinimum` — avec de l'arithmétique `bigint`
pour `toBigintStatistics()`. Les fenêtres prennent en charge `slide(size, hop)` et `tumble(size)`.

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
const added   = cycle.add(3);          // mis en file d'attente
const sampled = cycle.elementAt(2n);   // observe l'écriture ci-dessus
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
ring.phaseAt(6n).get().getValue() === ring.phaseAt(0n).get().getValue();   // true, exactement
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
import { useField } from "semantic-typescript";

const cosine = useField([1]);              // cos(2πΔ) : +1 aligné, −1 opposé
const mixed  = useField([0.4, 0.3, 0.3]);  // trois premières harmoniques

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
report.missed;                               // 1  ('zz' n'est pas sur l'anneau)
report.references.map(r => r.count);         // [2, 0, 2, 0, 1]
```

Chaque ligne de référence rapporte `count`, la phase relative moyenne `mean` et la longueur résultante moyenne
`resultant`. Une identité mérite d'être retenue : **`resultant` est identique pour chaque référence**,
car changer la ligne de base ne fait que faire tourner toutes les phases relatives d'une constante. Ce qui diffère
d'une référence à l'autre, c'est le compte et la moyenne.

```typescript
const cycle = new SynchronousCycle(["a", "b", "c"]);
cycle.scoresAt(0, cosine);                   // un score par position, dans [-1, 1]
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

---

<a id="11-utility-helpers"></a>
## 11. Fonctions utilitaires

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

---

<a id="13-license"></a>
## 13. Licence

MIT © Eloy Kim
