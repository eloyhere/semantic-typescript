# Changelog

Notable changes to `semantic-typescript`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the version numbers
follow [Semantic Versioning](https://semver.org/).

A Simplified Chinese edition is kept in [`CHANGELOG.cn.md`](./CHANGELOG.cn.md).

---

## [Unreleased]

This entry covers the work merged after 1.2.0 and not yet released. It is a
large change: the collection families were split, the phase-ring API was
reworked, and several asynchronous lifecycle defects were fixed. Read the
"Breaking", "Changed" and "Removed" sections before upgrading.

### Breaking

**Statistics now default to the definitions used by R, NumPy, pandas and Excel**

These are deliberate, owner-approved breaks: the old values were defined
differently from the mainstream tools, so keeping them would have preserved
compatibility at the cost of correctness. Each old behaviour remains reachable
through an explicit option.

- **`quantile(probability)` now defaults to Hyndman–Fan type 7**, the
  parameterisation `h = (n - 1)p + 1` with linear interpolation, instead of
  type 1 (`ceil(np)` nearest rank). Type 7 is the default of R `quantile`,
  NumPy `quantile` (`method="linear"`), Excel `PERCENTILE.INC` and pandas
  `quantile`. On `[1..8]` at `p = 0.75` it returns `6.25` where it returned
  `6`; on `[2,4,4,4,5,5,7,9]` at `p = 0.9` it returns `7.6` where it returned
  `9`. All nine types are available as
  `quantile(p, { method: "type-1" })` … `{ method: "type-9" }`, and
  `"type-1"` restores the old nearest-rank answer exactly.
- **`interquartileRange()` follows the same method** (default type 7), so
  Tukey fences now line up with R and NumPy: `[1..8]` gives `3.5`, not `4`,
  and `[1,2,3,4]` gives `1.5`, not `2`. Pass `{ method }` to change the type.
- **`kurtosis()` now defaults to the bias-corrected excess estimator `G2`**,
  `G2 = ((n - 1) / ((n - 2)(n - 3))) · ((n + 1)g2 + 6)`, matching Excel
  `KURT` and pandas `kurt`, instead of the biased `g2 = m4 / m2² - 3`. On
  `[1,2,3,4]` it returns `-1.2` where it returned `-1.36`; pass
  `{ estimator: "g2" }` for the old value. `{ excess: false }` adds three back
  and reports the non-excess fourth standardised moment.
- **`skewness()` now defaults to the bias-corrected `G1`**,
  `G1 = √(n(n - 1))/(n - 2) · g1`, matching Excel `SKEW`, pandas `skew` and
  SPSS, instead of the biased `g1 = m3 / m2^(3/2)`; pass
  `{ estimator: "g1" }` to restore `g1`.
- **`variance()` and `standardDeviation()` now divide by `n - 1`** (Bessel's
  correction), matching R `var`/`sd`, pandas and NumPy `var(ddof=1)`, instead
  of `n`. On `[1,2,3,4]` the variance is `5/3` where it was `5/4`; pass
  `{ ddof: 0 }` for the previous population value. `standardDeviation` is the
  square root of that variance, so it remains very slightly biased even under
  normality (Jensen's inequality).
- **Small samples now return an empty `Optional` instead of `0` or `NaN`.**
  `G2` is undefined below four observations, `G1` below three, and the sample
  variance and standard deviation below two; every statistic on an empty view
  is undefined too, as are skewness and kurtosis on a constant sample. For
  example, with three observations the default `kurtosis()` is empty while
  `{ estimator: "g2" }` is defined, and with two observations `skewness()` is
  empty while `{ estimator: "g1" }` is `0`. Bigint views return the same
  empties; with `{ ddof: 0 }` a single observation still has a defined
  variance of zero.
- **`variance()` and `standardDeviation()` now use a two-pass computation**
  (mean first, then squared deviations) instead of the collector's
  `sum(x²) - sum(x)²/n` form, which suffers catastrophic cancellation when the
  standard deviation is small relative to the mean.
- **`skewness` and `kurtosis` gained closed-form standard errors.**
  `skewnessStandardError()` and `kurtosisStandardError()` on the numeric
  statistics views return `√(6n(n - 1)/((n - 2)(n + 1)(n + 3)))` and
  `√(24n(n - 1)²/((n - 3)(n - 2)(n + 3)(n + 5)))`, the SAS/SPSS and
  `e1071::skewness`/`e1071::kurtosis` forms. They require three and four
  observations respectively. The bigint views omit them because rounding a
  standard error to an integer would report zero for most samples.
- **These methods now return `Optional`.** `variance`, `standardDeviation`,
  `quantile`, `interquartileRange`, `skewness` and `kurtosis` all wrap their
  result, so callers must unwrap with `.get()`, `.orElse(...)` or test
  `.isPresent()`. The bigint view still rounds each result to a whole bigint.
- **Reconciliation.** The new defaults reproduce the published results:
  `[1,2,3,4]` gives `variance(ddof = 1) = 5/3`, `G2 = -1.2`, `g2 = -1.36`,
  `G1 = g1 = 0`; `[1..8]` at `p = 0.75` gives type 7 `6.25` and type 1 `6`;
  the Wikipedia kurtosis example (`n = 20`) gives `g1 = 4.129251`,
  `G1 = 4.471885`, `g2 = 15.051427`, `G2 = 19.998429`, and standard errors
  `0.512103` and `0.992384`. These match R, NumPy, pandas and Excel to the
  published precision.

**Signal analysis now uses the physical power and DFT-even conventions**

These are also deliberate, owner-approved breaks: the old definitions mixed
amplitude and power or assumed that only complete frames exist, so they returned
systematically biased levels and time-frequency frames.

- **`decibel` is removed and split into `amplitudeDecibel` and
  `powerDecibel`.** `amplitudeDecibel` keeps the old `20·log10` convention for
  amplitude-like ratios; `powerDecibel` applies `10·log10` for power, energy,
  mean square and power spectral density. Power `0.25` is `−6.02 dB` under
  `powerDecibel`, while the old function reported `−12.04 dB`. `Bin.decibel` and
  `Spectrum.decibelOf` remain amplitude levels; `Spectrum.powerDecibelOf` is the
  matching power level.
- **`Spectrum.bandEnergy(low, high)` now defaults to the one-sided reading.**
  A real spectrum's conjugate half is folded into the non-negative axis, with
  DC and Nyquist counted once and every interior bin counted twice, so a band
  that covers the whole one-sided axis satisfies Parseval (`Σ|X|² = N·Σx²`).
  The old raw sum, which counted only the positive half of a band below Nyquist
  (−3.01 dB), remains available as `bandEnergy(low, high, "two-sided")`; use it
  for complex spectra.
- **`Spectrum.flatness()` now measures the one-sided power spectrum.** The old
  method took the geometric/arithmetic mean of magnitudes over both complex
  halves. The result is now computed from `power()`, over bins `0` through
  `floor(count/2)`, without the display-only amplitude doubling of
  `oneSided()`; a zero bin still reports `0`.
- **`Sampler.shortTimeFourierTransform` and `Sampler.spectrogram` now default
  to the periodic Hann window, `boundary: "zeros"` and `padded: true`.** The
  symmetric Hann window and the old "complete frames only" path (`7` frames for
  `64` samples, frame `16`, hop `8`) remain reachable with
  `useHannWindow`/`useHannPeriodicWindow` and
  `{ boundary: "none", padded: false }`; the default now returns `9` frames,
  loses no tail samples, and matches SciPy's `stft` defaults. The new optional
  fifth argument takes `{ boundary, padded }`.
- **`Spectrogram` frame times are now frame centres.** `getTime(k)` returns
  `(k·hop + frameSize/2)/rate` for an unextended view and
  `(k·hop + (frameSize mod 2)/2)/rate` for an extended one, instead of the frame
  start. `getDuration()` and `toFrame()` also trim the boundary extension.
  The constructor gained an optional fourth argument, the boundary mode, which
  defaults to `"none"`.

### Added

**Collection families**

- **`OrderedSet` / `UnorderedSet`**, each in synchronous and asynchronous form.
  `OrderedSet` decides uniqueness and iteration order by a comparator (defaulting
  to `useCompare`); `UnorderedSet` buckets by `useHash` and compares with
  SameValueZero. Iteration order is part of the contract for the ordered variant
  and explicitly unspecified for the unordered one.
- **`OrderedLRUSet` / `UnorderedLRUSet`** and **`OrderedSkipSet` /
  `UnorderedSkipSet`**, closing the gap where the LRU and SKIP families offered
  ordered and unordered maps but only an undifferentiated set.
- **`OrderedMap` / `UnorderedMap`** promoted to independent root interfaces. The
  former common base is gone, so neither variant inherits ordering promises from
  the other.

**Error model**

- A typed error hierarchy in `structure/error.ts`: fifteen classes covering
  validation, indexing, capacity, state, concurrency, collection protocol,
  serialisation, numeric, phase, and configuration failures. Each carries a
  stable `name`, an optional `cause` for the originating error, and an optional
  `context` bag for diagnostics, and each has a brand guard.
- **`SemanticRangeError`**, an alias for the exported `RangeError` class. Both
  names denote one class, so `instanceof` checks hold across them. The class
  keeps its historical name — no library module imports it implicitly, so a bare
  `new RangeError(...)` still reaches the global constructor — but a consumer that
  writes `import { RangeError }` shadows that global for the whole module,
  turning an incidental `new RangeError(...)` in the same file into a library
  error. Importing `SemanticRangeError` instead leaves the global untouched.

**Module layout**

- **Collector factories moved to `collectors.ts`.** `collector.ts` now declares
  only `SynchronousCollector` and `AsynchronousCollector` (about 340 and 350
  lines); the fifty-three `useSynchronousXxx` and fifty-three `useAsynchronousXxx`
  factories live in `synchronous/collectors.ts` and `asynchronous/collectors.ts`.
  The dependency runs one way — `collectors.ts` imports `collector.ts`, never the
  reverse — and `factory.ts` remains the module that builds `Semantic` values, so
  creating a `Semantic` and creating a collector are now separate jobs.
- **Forests get their own module.** `rootedForest` and `unionFindForest` left
  `structure/tree/` for `structure/forest/`, with `forest/index.ts` and a
  `structure/forest.ts` barrel beside the existing `structure/tree.ts`. The
  binomial and Fibonacci heaps, the breadth-first and depth-first search trees
  and the minimum spanning tree import the rooted forest from the new path, as
  does the tree-API boundary type test.

**Phase rings**

- `PhaseField` and `useField` in `mathematics/field.ts`: a bounded score in
  `[-1, 1]` defined as a truncated cosine series. The constructor enforces
  `|offset| + Σ|weight| ≤ 1`, so the bound is a consequence of the construction
  rather than a clamp applied afterwards.
- `Cycle` now reports its own state: `purity()`, `sequences()`,
  `zeroSequence()`, `isBalanced()`, `resultant()`, `relativeAt()`, `viewAt()`,
  `viewsAt()`, `jetAt()`, `windingAt()`, `errorIntegralAt()`, `scoreAt()`,
  `scoresAt()`, `analyse()`, and `toSpectrum()`.
- `combineCycles(a, b)` joins two rings on their least common multiple and
  reports the pair-compatibility condition, so the joint ring is a pullback
  rather than a product.
- `useAngularSpectrum(cycle, instants, plan)` builds the two-dimensional
  `(ω, n)` plane, one column per spatial mode.
- `BlobLike`, a structural description of the bytes `useBlob` needs, so the
  published declarations no longer depend on the DOM library being present in the
  consumer's compilation.

**Signal analysis**

- **Periodic, DFT-even windows**: `useHannPeriodicWindow`,
  `useHammingPeriodicWindow`, `useBlackmanPeriodicWindow`,
  `useNuttallPeriodicWindow`, `useFlatTopPeriodicWindow` and
  `useKaiserPeriodicWindow(beta)`. They evaluate the same shapes as the
  symmetric windows against `count` rather than `count - 1`, so a periodic Hann
  window has a constant overlap-add sum of `1.000000` at a half-frame hop for
  every length, while the symmetric form ripples by `0.841 dB` at `N = 16` and
  still by `0.013 dB` at `N = 1024`. The existing symmetric exports are
  unchanged.
- **`Spectrum.powerDecibelOf(index, normalization?, reference?)`**, the power
  counterpart of `decibelOf`, returning `10·log10(power / reference)`.
- **`BandSidedness`** (`"one-sided" | "two-sided"`), the explicit argument type
  of the corrected `Spectrum.bandEnergy`.
- **`TimeFrequencyOptions`**, the `{ boundary?, padded? }` options of
  `shortTimeFourierTransform` and `spectrogram`, and the `BoundaryExtension`
  (`"zeros" | "constant" | "none"`) type they use.
- **`Spectrogram.getBoundary()`** and **`Sampler.spectrogram(..., options)`**,
  so a spectrogram retains the extension mode and trims it during `toFrame`.

**Project**

- README rewritten in nine languages on a shared thirteen-section outline, with a
  new section on periodic analysis.
- `.vscode/settings.json` so editor auto-imports prefer the project's path alias
  over relative specifiers.

### Changed

- **`Cycle.frequency` is the ambient rotation rate**, not a phase step between
  positions. The environment advances every phasor by the same angle and therefore
  cannot break the intrinsic pattern. Position phases are now derived from the
  exact residue `i mod n`, which makes `phaseAt(i)` and `phaseAt(i + n)`
  identical to the bit rather than merely close.
- **`useText` slices by code point** rather than by UTF-16 index, so astral
  characters stay whole; inverted bounds are still swapped and negative positions
  still clamped to zero, matching the documented slice behaviour.
- **`useRange` accepts descending ranges** when the step is negative, and rejects
  a step whose numeric kind differs from the bounds' kind instead of coercing
  between `number` and `bigint`.
- The JSDoc for every factory in `factory.ts` and every hook in `hook.ts` was
  rewritten to document actual behaviour, including the overloads.
- Every one of the 296 interfaces exported from `structure/tree/` now carries an
  interface JSDoc block that states its contract, defaults and cost. Both
  `collectors.ts` modules document their thirty-four factory interfaces and every
  overload in the same way.

### Removed

- **`SynchronousSet` / `AsynchronousSet` / `SynchronousMap` / `AsynchronousMap`**,
  together with their brand symbols and guards. Use the ordered or unordered
  variant that matches the semantics you need. There is no compatibility alias.
- The `Collector` base types of the map family, which are replaced by internal,
  unbranded contracts used only to compose the LRU and SKIP families.
- **The `structure/tree/rootedForest` and `structure/tree/unionFindForest` entry
  points**, together with their re-exports from `tree/index.ts`. Both contracts
  now live under `structure/forest/`; no compatibility re-export remains at the
  old path.

### Fixed

- **`useSubscription` no longer leaks its subscription.** Teardown is idempotent
  and runs on every exit path: the consumer asking to stop, the consumer throwing,
  a subscription failing partway through, and an event arriving after the run has
  ended. Every recorded `unsubscribe` is attempted even when an earlier one
  throws, and `unmount` is attempted even when an unsubscribe threw, so one
  failing host method cannot strand the others. Errors raised during teardown are
  swallowed rather than masking the error that caused the teardown.
- **`useSubscription` completes at the accepted limit** rather than waiting for
  one more event, and an empty event name list now completes immediately instead
  of never settling. A host that fires the handler synchronously from `subscribe`
  is also handled: the handler is unsubscribed once registration returns.
- **Event names are no longer restricted to strings.** A symbol or a number is
  accepted as a single event name; previously it was rejected even though such
  keys are ordinary property keys.
- **`useInterval` clears both of its handles.** A consumer that throws used to
  leave the timer running forever, and a pending initial delay was not tracked at
  all. Both are now cleared as soon as the run stops, and the consumer's error is
  propagated unchanged.
- **`usePromise` no longer hangs.** The asynchronous executor that swallowed
  rejections is gone: a rejected source and a throwing consumer both reject the
  collection with the original reason.
- **`useBlob` cancels the stream on the error path.** It previously released the
  reader's lock without cancelling the stream, leaving the underlying source
  producing into a discarded buffer.
- **The flat-top window keeps its negative lobe.** `useFlatTopWindow` clamped
  every weight at zero with `Math.max(0, ...)`, but a flat-top window is defined
  to be partially negative: at `N = 1024` the unclamped symmetric window has
  `578` negative samples (minimum `−0.070560`), coherent gain `0.215368` and
  noise bandwidth `3.773946` bins, where the clamped version reported `0.233280`
  and `3.199558`. Scalloping loss recovers from `−0.3087 dB` to `−0.0097 dB`
  (about 32× better), and the periodic form matches the research target
  (`CG 0.215579`, `ENBW 3.7702`, `HPBW 3.7247`, `−0.0098 dB`, `577` negative
  samples).
- **The short-time transform no longer drops the signal tail.** The default
  `boundary: "zeros"` and `padded: true` extend the signal by half a frame at
  each end and zero-pad the tail, so `64` samples at frame `16` and hop `8`
  produce `9` frames instead of `7` and every source sample is covered; a
  `1000`-sample signal at frame `256` and hop `128` produces `9` frames instead
  of `6` (232 samples were previously unreachable).
- **The short-time transform uses a periodic window by default.** The symmetric
  Hann window does not satisfy constant-overlap-add: at 50 per cent overlap its
  overlap-add sum ripples by `0.841 dB` at `N = 16` and `0.013 dB` at
  `N = 1024`, whereas the new default `useHannPeriodicWindow` sums to
  `1.000000` at every length.
- **`Spectrum.flatness()` uses the power spectrum.** The old method took the
  geometric/arithmetic mean of magnitudes over the full two-sided spectrum; it
  now uses `power()` over the one-sided half. Two bins with powers `4` and `1`
  report `0.8` where the amplitude reading gave `0.9428`, and a unit impulse
  reports `1`.
- **`Spectrum.bandEnergy()` no longer halves a band below Nyquist.** The old raw
  two-sided sum counted only the positive half of a real spectrum: a unit cosine
  at bin `1` of an `8`-point spectrum read `16` over `[0, 2)` although its total
  power is `32`. The default one-sided reading folds the conjugate half (DC and
  Nyquist once, interior bins twice) and now reads `32`, satisfying Parseval;
  `"two-sided"` preserves the raw sum.

### Tests

- 622 assertions, all passing, with `tsc` reporting no diagnostics. New files
  cover the ordered and unordered sets, the error hierarchy, forest
  construction, and the 1.3.0 statistics definitions: all nine Hyndman–Fan
  quantile types, `G1`/`G2` against `g1`/`g2`, `ddof`, the closed-form
  standard errors, and the small-sample empty optionals across the
  synchronous, asynchronous, numeric and bigint views.

---

## [1.2.0] - 2026-09-11

This release redrew the **division of responsibility in the index model**: a
pipeline performs only cheap, lazy index rewriting, and index tidying is left
entirely to the collectable. `translate` returns to a pure shift, `findAt` and
`findNegativeAt` address materialised order, and four asynchronous and boundary
defects are fixed.

### Changed

- **`translate` is a pure lazy index shift again.** Both the numeric and the
  functional overload now do only `i + offset` and `i + mapper(element, i)`, and
  no longer materialise the stream (in 1.1.0 the numeric overload buffered
  everything before taking the remainder). `translate` can therefore be used on an
  infinite stream followed by `limit`.
- **The ordered collectable normalises indices.** `toOrdered()` rewrites every
  index to `((i mod n) + n) mod n`, where `n` is the element count, and then sorts
  by index. The rotation, reversal and shuffling produced by `reverse`,
  `translate` and `shuffle` only become visible at this step — `translate(7)` and
  `translate(2)` are equivalent on five elements.
- **The unordered collectable does not tidy indices**, as a performance contract.
  `toUnordered()` stores the raw index in a `Map` without normalisation or
  sorting, keeping O(n) throughput; `translate(2)` collected unordered still
  reports indices `2n, 3n, 4n, …`.
- **`findAt(k)` and `findNegativeAt(k)` address materialised order.** `findAt(1n)`
  is always the second element of the materialised sequence and
  `findNegativeAt(-1n)` always the last, whatever index rewriting happened
  upstream. Both stop early, at O(k) and O(n − k) respectively.
- **`reverse()` is `-index - 1n`** rather than `-index`. Under remainder
  normalisation `-index` pins the first element in place, because `-0n === 0n`;
  only `-index - 1n` reverses.
- **`redirect` is the sole reordering mechanism.** `reverse`, `translate` and
  `shuffle` are preset strategies over it, and all of them require `toOrdered()`
  to take effect; an unordered collectable promises arrival order only.

### Fixed

- An asynchronous `translate` failed to chain onto the upstream promise, losing
  elements or returning nothing (there was no such defect on the synchronous
  side).
- The asynchronous ordered collectable omitted the remainder normalisation and
  disagreed with the synchronous side; `translate(2).toOrdered()` returned an
  unrotated sequence.
- Asynchronous `flatMap` resolved after the first inner iterable and silently
  dropped the rest.
- `dropWhile` discarded the first element that failed the predicate, in both
  families: `[1,2,3,4,1].dropWhile(n < 3)` returned `[4,1]` instead of `[3,4,1]`.

### Documentation

- README rewritten in full (English as the reference edition, in British
  English). Every factory, operator, collectable and terminal now states its time
  and space cost, and the design rationale, architecture and data flow have their
  own chapters.
- The index-model chapter was rewritten around the split between lazy pipeline
  rewriting and collectable tidying.
- All nine language editions were regenerated: the Simplified Chinese and
  Japanese tables of contents were left untranslated and the Russian edition was
  missing. Every code block is byte-identical to the English edition.

---

## [1.1.0] - 2026-09-11

A **comprehensive defect release**: it fixes sixteen blocking defects introduced
in 1.0.0 — among them "the published package cannot be imported from Node", "index
reordering has no effect" and "the asynchronous chain returns nothing or hangs
forever" — and introduces regression tests for the first time. Three factories
changed their return type; read "Changed" before upgrading.

### Changed

- **`useBlob(...)` returns `AsynchronousSemantic`** (was `SynchronousSemantic`).
  Reading a blob is inherently asynchronous, so a synchronous collectable saw an
  empty array.
- **`useInterval(...)` returns `AsynchronousSemantic`** (was
  `SynchronousSemantic`). The data is produced by a timer, and a synchronous
  collectable finished before the first tick.
- **`useFrom(AsyncIterable)` returns `AsynchronousSemantic`** (was
  `SynchronousSemantic`). The previous implementation silently returned `[]`.
- **`translate(offset)` became a cyclic shift**, matching README example 5
  (positive rotates right, negative rotates left). The numeric overload needs the
  stream length and therefore materialises it; the functional overload
  `translate(mapper)` remains element-wise and lazy.
- **`partition(count)` is defined as bucket selection by element index**, that is
  `partitionBy((_element, index) => index % count)`.
- **`shuffle()` is genuinely random.** The previous implementation derived indices
  from element hashes, so the same input produced the same order every run.

### Fixed

**Packaging and tooling**

- The published artefact could not be loaded from Node: `tsconfig` moved to
  `module`/`moduleResolution: NodeNext` and sixty relative imports in the source
  gained their `.js` extension. Both ESM and CJS consumers used to fail with
  `ERR_MODULE_NOT_FOUND`; only bundlers could resolve the package.
- `engines.node` corrected from `>=14.0.0` to `>=18.17.0`, matching the ES2022
  target and the use of `Blob` and `WritableStream` in the types.
- `devDependencies.typescript` was missing, so `npm run build` failed on any fresh
  clone.

**Indices and collectables**

- `toOrdered()` lost the real index of each element, having faked it from the
  array position; `redirect`, `reverse`, `translate` and `shuffle` now reorder
  correctly.
- Added the `toOrdered(comparator)` overload, which sorts by value and renumbers
  the indices in sequence (the statistics collectables depend on that).
- The unordered collectable falls back to a spare key on a duplicate index rather
  than silently dropping data; `useText("a,b,c", ",")` used to return only
  `["c"]`.

**Asynchronous chain**

- The asynchronous ordered collectable defined `buffer` as a read-only property at
  construction, so assigning it from the `then` callback threw a `TypeError`; the
  symptom was `toOrdered()` and the statistics collectables returning `[]`, or
  `.summate()` hanging forever.
- `source()` resolved without waiting for the data to be ready, which is why
  `useInterval` was always empty.
- Added `settled()`: `findFirst`, `findLast`, `findAny`, `findAt`, `findMaximum`
  and `findMinimum` now wait or reject correctly instead of hanging forever when
  the stream is unfinished or empty.
- `findMaximum` and `findMinimum` compare by element value when no comparator is
  given, rather than by index.

**Terminal operations**

- `findFirst`, `findLast`, `findAny`, `findMaximum` and `findMinimum` always
  returned an empty value.
- `reduce(accumulator)`, the overload without an identity, always returned an
  empty `Optional`.
- `numericStatistics.range()` consequently always returned `0`, because it depends
  on `findFirst` and `findLast`.
- `nonMatch()` returned the exact opposite of the truth: the collectable finisher
  negated one time too many.

**Operators and factories**

- `partition` threw `RangeError: Division by zero` on the first element.
- `partitionBy` used the element index rather than the classifier, raising a
  `TypeError`.
- `sub(start, end)` deadlocked its counter and never produced an element.
- `useGenerate(supplier, interrupt)` shadowed its second parameter with an
  identically named local, so the stop condition never applied.
- `useIterate` produced only the first element of an asynchronous iterable (a
  stray `break`) and never advanced its index.
- `useText` gained the single-argument overload (splitting by Unicode code point,
  so emoji are handled) and no longer loses data in the delimiter branch, where
  the index failed to advance.
- `useStringify` re-entered serialisation recursively inside the replacer and threw
  a `TypeError` on a cyclic reference.
- `useRandom` looped forever with probability about 15/16 on wide bigint ranges,
  because rejection sampling reused one sample; the low three bits of a random
  bigint were always zero, so `useRandom(1n, 10n)` returned only `1` or `9`.
- `useBlob` pointed every chunk at the same in-place buffer, so chunks overwrote
  one another.
- `useInterval` checked the interrupt after `accept`, leaking the boundary
  element.
- `useSubscription` unsubscribed twice when the boundary was reached.
- `toWindow().slide()` and `tumble()` produced zero windows on an asynchronous
  stream, reading the buffer before it was ready.

**Statistics**

- The numeric kurtosis formula is corrected from `sum(z⁴)/n² - 3` to
  `sum(z⁴)/n - 3`: `[1,2,3,4]` changes from `-2.59` to `-1.36`.
- Bigint statistics: `standardDeviation`, `skewness` and `kurtosis` threw because
  `BigInt(Math.sqrt(...))` rejects a non-integral square root, and variance and
  standard deviation suffered integer-division truncation (`[1,2,3,4]` reported a
  variance of `3`). The statistics are now computed in floating point and rounded
  back to `bigint`, matching the numeric editions.

**Other**

- `useHash`, `register`, `unregister` and `maskOf` were not exported, because
  `src/index.ts` omitted `./hash`.
- The synchronous and asynchronous statistics brands shared one `Symbol.for` key,
  and two guard functions mis-spelled their field names;
  `isSynchronousNumericStatistics` returned `false` for a numeric statistics
  object.
- `useTraverse` pushed onto its path without ever popping, so the path accumulated
  across sibling branches.
- The primitive hash cache gained a ceiling (cleared beyond a hundred thousand
  entries) so a long-running process does not grow without bound.

### Added

- **Regression tests**: `test/semantic.test.mjs`, 55 assertions covering every
  fixed defect, the normal paths, the window operators and the asynchronous chain.
  They use the built-in `node:test`, adding no runtime dependency.
- **`npm test`**: `npm run build && node --test`, ready for CI.
- **`CHANGELOG.md`**: this file.
- **`FIXES.md`**: a defect-by-defect account with root causes, the list of
  breaking changes and follow-up scheduling.

### Changed (tooling)

- `package.json` gained `"sideEffects": false` so bundlers can tree-shake.
- The `dist/` artefacts joined `.gitignore`; they are built by `prepublishOnly`.

### Acknowledgements

Thanks to issues `#1` to `#5`. This release adopts their findings on build
artefacts, naming and extensibility, and keeps the remainder on the schedule
described in section four of `FIXES.md`.

---

## Earlier versions

- **[1.0.0] - 2026-04-07**: the latest version previously on npm. It carries the
  sixteen blocking defects listed above, so **upgrading straight to 1.1.0 is
  recommended**. The repository `package.json` was still at `0.7.1` when it was
  published, so the repository and the published artefact were briefly out of
  step.
- **0.6.0 and earlier**: every version before 0.6.0 is marked deprecated on npm
  (`< 0.5.0` lacks the event-stream API, and `0.5.x` has circular dependencies).
- The repository had no git tags; `.github/workflows/publish.yml` triggers on
  `v*` tags, and the `v1.1.0` tag was added with that release.

[1.1.0]: https://github.com/eloyhere/semantic-typescript/releases/tag/v1.1.0
[1.0.0]: https://www.npmjs.com/package/semantic-typescript/v/1.0.0
