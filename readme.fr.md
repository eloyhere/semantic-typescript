# **Semantic‑TypeScript**
**Flux, indexés.** Vos données, sous contrôle précis.

---

### Vue d'ensemble

Semantic‑TypeScript représente une avancée significative dans le traitement des flux, **synthétisant** avec élégance les paradigmes les plus efficaces des générateurs JavaScript, des Streams Java et de l'indexation de style MySQL. Son postulat fondamental est à la fois puissant et délibéré : construire des pipelines de traitement de données exceptionnellement efficaces grâce à une indexation intelligente, plutôt que par une itération conventionnelle en force brute.

Là où les bibliothèques typiques imposent des boucles synchrones ou des chaînes de promesses (*Promises*) maladroites, Semantic‑TypeScript fournit une expérience **entièrement asynchrone**, fonctionnellement pure et rigoureusement sûre au niveau des types, conçue expressément pour les exigences du développement d'applications modernes.

Ce modèle incarne une forme raffinée de flux de contrôle : les données ne sont transmises au consommateur en aval que lorsque le pipeline en amont invoque explicitement le rappel (*callback*) `accept`. Vous conservez un contrôle complet et granulaire sur le moment du traitement – celui‑ci se produit précisément quand, et seulement quand, c'est nécessaire.

---

### Pourquoi les développeurs choisissent Semantic‑TypeScript

-   **Indexation sans répétition** – Chaque élément possède intrinsèquement son index naturel ou sur mesure, éliminant le suivi manuel.
-   **Purement fonctionnel et sûr pour les types** – Bénéficiez d'une inférence de types TypeScript complète et idiomatique avec des opérations immuables.
-   **Flux d'événements étanches aux fuites** – Le modèle `useSubscription` est conçu avec la sécurité des ressources comme premier principe. Vous définissez la limite logique – en utilisant `limit(n)`, `sub(start, end)` ou `takeWhile(predicate)` – et la bibliothèque gère entièrement le cycle de vie de l'abonnement. Cela garantit l'absence d'écouteurs (*listeners*) résiduels et de fuites de mémoire.
-   **Suite statistique intégrée** – Accédez à des analyses exhaustives pour les flux de type `number` et `bigint`, incluant moyennes, médianes, modes, variance, asymétrie (*skewness*) et aplatissement (*kurtosis*), sans dépendances externes.
-   **Performances prévisibles et ajustables** – Choisissez entre des collecteurs ordonnés ou non ordonnés pour correspondre exactement à vos besoins en matière de performances et d'ordre.
-   **Inhéremment économe en mémoire** – Les flux sont évalués de manière paresseuse (*lazy*), traitant les éléments à la demande pour soulager la pression sur la mémoire.
-   **Aucun comportement indéfini** – TypeScript garantit une sécurité des types et une nullabilité complètes. Vos données sources restent immuables, sauf si elles sont modifiées explicitement dans vos fonctions de rappel.

---

### Installation

Intégrez Semantic‑TypeScript à votre projet en utilisant votre gestionnaire de paquets préféré :

```bash
npm install semantic-typescript
```
ou
```bash
yarn add semantic-typescript
```

---

### Introduction pratique

Les exemples suivants démontrent des concepts clés, des transformations fondamentales à la gestion d'événements réels.

```typescript
import { useOf, useFrom, useRange, useSubscription, useText, useStringify } from "semantic-typescript";

// ====================================================================
// EXEMPLE 1 : Opérations fondamentales et statistiques numériques
// ====================================================================
// Démontre les opérations de mappage (*map*) et les opérations statistiques terminales. Après transformation, le pipeline doit être converti en un collecteur de statistiques avant de pouvoir appeler des méthodes terminales comme `.summate()`.

const numericSum: number = useOf(10, 20, 30, 40)
  .map((n: number): number => n * 2)        // Double chaque élément : [20, 40, 60, 80]
  .toNumericStatistics()                    // Convertit en un collecteur de statistiques
  .summate();                               // Opération terminale : 200

// Autres méthodes statistiques (disponibles après `.toNumericStatistics()`) :
// .average(), .median(), .mode(), .variance(), .skewness(), .kurtosis()

// ====================================================================
// EXEMPLE 2 : Statistiques BigInt
// ====================================================================
// Fonctionne de manière identique aux statistiques numériques mais est optimisé pour les données BigInt.

const bigintSum: bigint = useOf(10n, 20n, 30n, 40n)
  .map((n: bigint): bigint => n * 2n)       // Arithmétique BigInt
  .toBigIntStatistics()                     // Convertit en un collecteur de statistiques BigInt
  .summate();                               // Opération terminale : 200n

// ====================================================================
// EXEMPLE 3 : Manipulation d'index pour inverser un flux
// ====================================================================
// Illustre le réordonnancement des éléments en réattribuant stratégiquement leurs index à l'aide de la méthode `.redirect()`, permettant des modèles personnalisés comme l'inversion.

const reversedArray: number[] = useFrom([1, 2, 3, 4, 5])
  .redirect((_element: number, index: bigint): bigint => -index) // Mappe sur des index négatifs
  .toOrdered()  // Essentiel : collecte les éléments triés selon leurs nouveaux index
  .toArray();   // Résultat : [5, 4, 3, 2, 1]

// Pour une inversion simple, `.reverse()` est également disponible.

// ====================================================================
// EXEMPLE 4 : Mélange (*Shuffle*) d'un flux
// ====================================================================
// Permute aléatoirement les index des éléments à l'aide d'un algorithme de mélange sur place (*in‑place*).

const shuffledArray: number[] = useFrom([1, 2, 3, 4, 5])
  .shuffle()      // Réattribue aléatoirement les index
  .toOrdered()    // Trie selon les nouveaux index aléatoires
  .toArray();     // Par exemple : [2, 5, 1, 4, 3] (varie à chaque exécution)

// ====================================================================
// EXEMPLE 5 : Rotation circulaire d'un flux
// ====================================================================
// Décale les éléments de manière cyclique. Les valeurs positives tournent vers la droite ; les valeurs négatives vers la gauche.

// Rotation à droite de 2 positions
const rightRotated: number[] = useFrom([1, 2, 3, 4, 5])
  .translate(2)   // Décale les index de 2 vers la droite
  .toOrdered()
  .toArray();     // Résultat : [4, 5, 1, 2, 3]

// ====================================================================
// EXEMPLE 6 : Évaluation paresseuse (*Lazy*) avec des plages infinies
// ====================================================================
// Traite des flux théoriquement infinis de manière paresseuse, ne calculant les éléments que lorsqu'ils sont nécessaires.

const firstTenMultiples: bigint[] = useRange(0n, 1_000_000n)
  .filter(n => n % 17n === 0n)  // Conserve les multiples de 17
  .limit(10n)                   // Critique : s'arrête après le 10e élément correspondant
  .toUnordered()                // Aucun tri requis
  .toArray();                   // Résultat : [0, 17, 34, 51, 68, 85, 102, 119, 136, 153]

// Sans `.limit(10n)`, le pipeline traiterait le million d'éléments.

// ====================================================================
// EXEMPLE 7 : Composition d'un pipeline complexe
// ====================================================================
// Démontre la composition séquentielle de plusieurs opérations.

const complexResult: number[] = useRange(1n, 100n)
  .map(n => Number(n) * 2)
  .filter(n => n > 50)
  .shuffle()
  .limit(5n)
  .translate(2)
  .toOrdered()
  .toArray();

// ====================================================================
// EXEMPLE 8 : Abonnement géré aux événements du DOM
// ====================================================================
// Écoute les événements du navigateur avec un nettoyage automatique et étanche aux fuites.
// L'appel `.limit(n)` définit la limite pour la suppression automatique de l'écouteur.

// Définit un abonné pour une cible Window
const windowSubscriber = {
    mount: (target: Window): void => { /* Logique de configuration */ },
    subscribe: (target: Window, event: keyof WindowEventMap, handler: EventListener): void => {
        target.addEventListener(event, handler);
    },
    unsubscribe: (target: Window, event: keyof WindowEventMap, handler: EventListener): void => {
        target.removeEventListener(event, handler);
    },
    unmount: (): void => { /* Logique de nettoyage */ }
};

useSubscription(window, windowSubscriber, "resize")
  .limit(5n) // Se désabonne automatiquement après 5 événements
  .toUnordered()
  .forEach((ev: Event, idx) =>
    console.log(`Redimensionnement #${idx} : ${(ev.target as Window).innerWidth}x${(ev.target as Window).innerHeight}`)
  );

// ====================================================================
// EXEMPLE 9 : Traitement de chaînes par points de code Unicode
// ====================================================================
// Parcourt correctement une chaîne, gérant les caractères Unicode multi‑octets.

useText("My emotion now is: 😊, and semantic is 👍")
  .toUnordered()
  .log(); // Affiche chaque caractère (y compris les émojis) sur une nouvelle ligne.

// ====================================================================
// EXEMPLE 10 : Transformation sécurisée en chaîne pour références circulaires
// ====================================================================
// Sérialise de manière sûre des objets contenant des références circulaires.

const obj = {
  a: 1,
  b: "texte"
};
(obj as any).c = [obj.a, obj.b, (obj as any).c]; // Introduit une référence circulaire

// const text: string = JSON.stringify(obj); // Lance une erreur
const text: string = useStringify(obj); // Produit de manière sûre `{a: 1, b: "texte", c: []}`
```

---

### Concepts principaux

| Concept | Objectif | Cas d'utilisation principal |
| :--- | :--- | :--- |
| `AsynchronousSemantic` | Le constructeur principal pour les flux asynchrones, les événements et les pipelines paresseux basés sur une poussée (*push*). | Événements en temps réel, WebSockets, écouteurs DOM ou tout flux de longue durée/infini. |
| `SynchronousSemantic` | Le constructeur pour les flux synchrones, en mémoire ou basés sur une traction (*pull*) immédiate (*eager*). | Données statiques, plages finies ou tâches d'itération immédiate. |
| `toUnordered()` | Le collecteur terminal le plus rapide, utilise une Map pour stocker les index. | Chemins critiques pour les performances où l'ordre stable n'est pas requis (temps et espace O(n)). |
| `toOrdered()` | Un collecteur terminal trié, stable en termes d'index. | Lorsque l'ordre des éléments doit être préservé ou qu'un accès indexé est nécessaire. |
| `toNumericStatistics()` | Un collecteur permettant des analyses statistiques riches sur les flux de type `number`. | Analyse de données, métriques et calculs statistiques. |
| `toBigIntStatistics()` | Un collecteur permettant des analyses statistiques riches sur les flux de type `bigint`. | Analyse et statistiques pour des jeux de données d'entiers de grande taille. |
| `toWindow()` | Fournit des opérations de fenêtre glissante (*sliding*) et fixe (*tumbling*) sur un flux. | Analyse de séries temporelles, traitement par lots et agrégations par fenêtres. |

---

**Règles d'utilisation essentielles**

1.  **Les flux d'événements** (créés via des fabriques comme `useSubscription`) retournent un `AsynchronousSemantic`.
    → Vous **devez** appeler une méthode définissant une limite, comme `.limit(n)`, `.sub(start, end)` ou `.takeWhile(predicate)` pour mettre fin à l'écoute. Sinon, l'abonnement restera actif.

2.  **Les opérations terminales** (`.toArray()`, `.count()`, `.forEach()`, `.findFirst()`, etc.) ne sont **disponibles qu'après** avoir converti le pipeline en un collecteur :
    ```typescript
    .toUnordered()   // Pour une vitesse maximale, sans garantie d'ordre.
    // ou
    .toOrdered()     // Pour une sortie stable et triée.
    // ou
    .toNumericStatistics() // Pour les méthodes statistiques.
    ```

---

### Caractéristiques de performance

| Collecteur | Complexité temporelle | Complexité spatiale | Ordre garanti ? | Scénario idéal |
| :--- | :--- | :--- | :--- | :--- |
| `toUnordered()` | O(n) | O(n) | Non | Le débit brut est primordial ; l'ordre final est sans importance. |
| `toOrdered()` | O(n log n) | O(n) | Oui (trié) | Ordre stable, accès indexé ou pré‑tri pour les statistiques. |
| `toNumericStatistics()` | O(n log n) | O(n) | Oui (tri interne) | Exécution d'opérations statistiques nécessitant des données triées. |
| `toBigIntStatistics()` | O(n log n) | O(n) | Oui (tri interne) | Opérations statistiques sur des données BigInt. |
| `toWindow()` | O(n log n) | O(n) | Oui (tri interne) | Opérations de fenêtre bénéficiant d'index triés. |

Choisissez `toUnordered()` lorsque la vitesse absolue est primordiale. Optez pour `toOrdered()` ou un collecteur de statistiques uniquement lorsque votre logique dépend de l'ordre des éléments.

---

**Analyse comparative avec les bibliothèques de flux modernes**

| Caractéristique | Semantic‑TypeScript | RxJS | Async Iterators / Generators natifs | Most.js |
| :--- | :--- | :--- | :--- | :--- |
| **Intégration TypeScript** | De première classe, fortement typée avec une conscience d'index inhérente. | Excellente, mais implique souvent des chaînes génériques complexes. | Bonne, mais nécessite des annotations de type manuelles. | Solide, avec un style de typage fonctionnel‑*first*. |
| **Analyse statistique intégrée** | Prise en charge native complète pour `number` et `bigint`. | Non disponible nativement (nécessite des opérateurs personnalisés ou d'autres bibliothèques). | Aucune. | Aucune. |
| **Indexation et conscience de position** | Indexation BigInt native et puissante sur chaque élément. | Nécessite des opérateurs personnalisés (ex. `scan`, `withLatestFrom`). | Gestion manuelle de compteur nécessaire. | Basique, aucune propriété d'index intégrée. |
| **Gestion des flux d'événements** | Fabriques dédiées, sûres pour les types, avec contrôle de cycle de vie explicite et déclaratif. | Puissante mais nécessite une gestion manuelle minutieuse des abonnements pour éviter les fuites. | Attachement manuel des écouteurs d'événements et gestion de jetons d'annulation. | Bon `fromEvent`, généralement léger. |
| **Performances et mémoire** | Exceptionnel – offre des collecteurs optimisés `toUnordered()` et `toOrdered()`. | Très bonne, bien que les chaînes profondes d'opérateurs puissent introduire une surcharge. | Excellente (surcharge native minimale). | Excellente. |
| **Taille du bundle** | Très léger. | Substantielle (même avec l'élagage d'arbre – *tree‑shaking*). | Zéro (fonctionnalité native du langage). | Petit. |
| **Philosophie de conception d'API** | Modèle de collecteur fonctionnel avec sémantique d'index explicite. | Modèle Observable réactif. | Modèle Iterator impératif / Generator déclaratif. | Fonctionnel, composition *point‑free*. |
| **Contrôle de flux** | Explicite (`interrupt`, `.limit()`, `.takeWhile()`, `.sub()`). | Bon (`take`, `takeUntil`, `first`). | Manuel (`break` dans les boucles). | Bon (`take`, `until`). |
| **Support synchrone et asynchrone** | API unifiée – support de première classe pour les deux paradigmes. | Principalement asynchrone. | Les deux pris en charge, mais avec un pont manuel. | Principalement asynchrone. |
| **Courbe d'apprentissage** | Douce pour les développeurs familiers avec les pipelines de collections fonctionnelles et indexées. | Plus raide (lexique étendu d'opérateurs, concepts Observable chaud/froid – *hot/cold*). | Faible à moyenne. | Moyenne. |

**L'avantage de Semantic‑TypeScript**

*   **Capacités uniques :** Les fonctionnalités de statistique et d'indexation intégrées éliminent le besoin d'opérations manuelles de `reduce` ou de bibliothèques d'analyse de données supplémentaires.
*   **Gestion prévisible des ressources :** Le contrôle explicite des flux d'événements prévient les fuites de mémoire qui peuvent être subtiles dans les applications RxJS.
*   **Conception unifiée :** Une API cohérente pour les flux de travail synchrones et asynchrones réduit la charge cognitive et la duplication de code.

Cette comparaison met en lumière pourquoi Semantic‑TypeScript est particulièrement adapté aux applications TypeScript modernes qui exigent des performances élevées, une robustesse en matière de sécurité des types et des fonctionnalités de traitement de données riches sans la complexité des frameworks réactifs traditionnels.

---

### Commencez votre exploration

Semantic‑TypeScript transforme des flux de données complexes en pipelines lisibles, composables et performants. Que vous manipuliez des événements d'interface utilisateur en temps réel, traitiez de grands ensembles de données ou construisiez des tableaux de bord analytiques, il offre la puissance de l'indexation au niveau base de données avec l'élégance de la programmation fonctionnelle.

**Vos prochaines étapes :**

*   Explorez l'API entièrement typée directement dans votre IDE (toutes les exportations sont disponibles depuis le point d'entrée principal du paquet).
*   Rejoignez la communauté grandissante de développeurs qui ont remplacé des itérateurs asynchrones complexes et des chaînes réactives par des pipelines Semantic clairs et intentionnels.

**Semantic‑TypeScript** – où les flux rencontrent la structure.

Commencez à construire dès aujourd'hui et expérimentez la différence tangible qu'apporte une conception d'indexation réfléchie.

**Construisez avec clarté, avancez avec confiance et transformez les données avec intention.**

MIT © Eloy Kim