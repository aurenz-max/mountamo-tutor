# Reader-fit 14m — PILOT: number-line generator-local grade resolver — 2026-08-03

**Outcome: the calendar-explorer template is PROVEN on number-line. Canonical
`ctx.grade` now decides the band at all 5 resolution sites; the prose parser is
fallback-only. Machine-gated end-to-end; zero sittings. The 14m sweep is UNBLOCKED.**

## Premise correction (matters for the sweep)

The queue said *"`elementary` prose contains no 'k'/'1'/'2' → Grade 1 lands on 3-5."*
Line-exact reality: production never passes the bare band key — it passes
`getGradeLevelContext()` PROSE (`geminiService.ts:54-65`), and **every production
sentence matches the K-2 substring test** ("grades 1-5" contains `1`; middle/high
school prose contains `k` in "thinking"). So the live defect was the inverse:
**every lesson landed K-2 and the 3-5 band was unreachable** — no decimals/fractions
numberType, jump sizes capped [1..5], order sets of 3, and the K-2 `max ≤ 30` range
clamp applied to everything. The bare-key inversion (`'elementary'` → 3-5) exists only
for callers passing raw keys. Both directions are cured by canonical-first. **Sweep
instruction: verify each generator's actual input string before predicting the failure
direction; don't copy the queue's prose-content claim.**

## The edit (template, ~33 insertions / 9 modified lines)

`gemini-number-line.ts`:
- `numberLineGradeBandFromGrade(grade?)` exported next to `resolveGradeBand` — 'K'/1/2
  → `K-2`, 3+ → `3-5`, `null` without a canonical grade (mirrors
  `calendarGradeBandFromGrade`, `423c58f`).
- `generateNumberLine` computes `canonicalBand` from `ctx.grade` (first `ctx.grade`
  read in the file's history) and threads it via `subConfig.canonicalGradeBand`.
- All 4 sub-generators + the top-level validation resolve
  `config?.canonicalGradeBand ?? resolveGradeBand(gradeLevel)` — fallback never deleted.
- `identify` keeps its hard K pin (bypasses both resolvers, unchanged).

Contract-first honored: `docs/contracts/number-line.md` derived this slice (12
requirements, C1 OPEN), pre-edit blast radius printed, post-edit `--check`
**COMPATIBLE** (`qa/primitive-contracts/number-line-check-2026-08-03.md`).

## Gates

- Focused `gemini-number-line.grade-band.test.ts` **7/7** (mocked geminiClient, real
  generator wiring); **non-vacuity: reverting the threading fails the Grade-4 test**.
- `typecheck:lumina` **0**; full tsc **803 = baseline**; full vitest **1327/1327**.
- Real-Gemini `/eval-test` probes (dev :3000): `grade=4` plot → **3-5 / decimal**
  (first runtime 3-5 on this path); `grade=1` → K-2/integer; no-grade → legacy K-2
  unchanged; `identify@4` → pinned {0,10}; `jump@1` → sizes [1..5], valid arithmetic;
  `order@1` → 3-distinct sets; `between@1` → in-range answerable pairs;
  `hard@1` → tier levers move, magnitude stays in band; `K "Counting to 5"` → all ≤5.

## 14k replay — measured, NOT closed

Census topic + 90–110 intent @ grade=1, `between`: band K-2 ✓ (this slice's half),
but range clamps {0,30}, endpoints 63–85, any-interior accept. **14k stays open** with
mechanism pinned (contract C1): K-2 clamp ≤30 vs authored ≤120 (`NBT001-01-a/b`),
uniform pool-window placement (no window floor — the ordinal-line lesson), interior
accept vs exact-adjacent task. Fixing it = fork territory (band+magnitude window per
[[trust-intent-over-hardcoded-caps]]), its own slice.

## Sweep queue (per 14m sequence, now unblocked)

hundreds-chart (14i — different shape: hard `?? '2'` default) → sorting-station,
number-tracer, fraction-circles, shape-composer, net-folder, timeline-builder,
coin-counter (14c rides here) → 11 chemistry generators last (verify the defect bites
before spending). Template per generator: mapper + `??` threading + focused wiring
test + eval-test at two grades. Pilot-then-sweep satisfied: this pilot is
runtime-exercised.
