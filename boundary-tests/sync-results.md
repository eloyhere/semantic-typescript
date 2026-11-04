# Synchronous Boundary Test Results

Run against the already-built `dist/index.js`; no production source or existing test was changed.

## Result

- Command: `& 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' --test boundary-tests/sync.boundary.mjs`
- Leaf cases: 14 total, 13 passed, 1 failed.
- Node reports 19 total tests because it includes the 5 parent group tests in addition to the 14 leaf cases. The short-circuit group failure is an aggregate of its single failed child, not another defect.
- Confirmed distinct defects: 1.

## Confirmed Finding

### High: `flatMap` cannot short-circuit an infinite inner iterable

- Minimal reproduction: `useOf(1).flatMap(() => infiniteIterable()).limit(1).toUnordered().toArray()`
- Expected: produce one element and terminate, consistent with lazy pipeline semantics, `limit` stopping upstream after n elements (README `readme.md:268`) and `flatMap`'s per-emitted-element behavior (`readme.md:265`).
- Actual: child process exceeded the 1500 ms timeout; the test isolates this scenario with `spawnSync` and ignored stdio, so the test runner remains bounded.
- Relevant source: `src/synchronous/semantic.ts:189-204` (`flatMap` iterates the inner iterable without checking its `stop` flag between yielded elements). `limit` signals interruption in `src/synchronous/semantic.ts:217-225`.
- Failing leaf: `boundary-tests/sync.boundary.mjs:116-119`.
- Severity rationale: a valid short-circuit pipeline hangs forever when its mapper returns an infinite iterable.

## Passing Coverage

13 leaves passed: empty and singleton sources/terminals; negative, out-of-range, and large positions; zero and negative skip/limit; filter+skip+limit composition; iterable and semantic concat order; flatMap order and output indexes; positive window parameter checks; README tumble and trailing partial slide examples; larger step gaps; finite-source limit pull behavior; and downstream limit on an infinite synchronous source.

## Contract Notes

README explicitly defines `sub(start,end)` as positional slice `[start,end)` but does not say how negative or reversed endpoints should be normalized. The test's reversed-endpoint case currently passes under the implementation's min/max behavior; it is not reported as a defect. README does not specify the semantics for `findNegativeAt` offsets more negative than the stream length, so that case is intentionally not asserted. Negative skip/limit behavior is also unspecified; those checks record current observed behavior, not a confirmed contract requirement.
