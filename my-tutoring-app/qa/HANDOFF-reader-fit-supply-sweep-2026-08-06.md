# HANDOFF — reader-fit SUPPLY-SIDE SWEEP: work queue item 15 (S2 → S15)

Written 2026-08-06 after S1 shipped (`96c3eb6`). Owning queue:
`my-tutoring-app/qa/reader-fit/BACKLOG.md` item **15**. Triage of record:
`qa/reader-fit/supply-sweep-triage-2026-08-06.md`. Executors: `/reader-fit --fix`
(15A) then `/add-tutoring-scaffold` + `/reader-fit --fix` (15B).
**Serial, one primitive per slice, commit each** ([[feedback_serial-over-workflow-token-budget]]).

## Paste-able prompt

> Continue the reader-fit supply-side sweep at item **S2 `orbit-mechanics-lab`**.
> Read `qa/HANDOFF-reader-fit-supply-sweep-2026-08-06.md` first, then the S1
> precedent `qa/reader-fit/telescope-simulator-PRE-2026-08-06.md` — S2 is the same
> defect shape and the fix is a copy of S1's, so follow that report's structure.
> The floor is verified by a **curator A/B**, not by tsc: reproduce the failure
> live before fixing it.

---

## What is already true (do not re-derive)

The sweep is enumerated and risk-ranked. **Do not re-run the census** — it cost a
vitest harness against `UNIVERSAL_CATALOG` and is written up in the triage report:
196 catalog entries · 118 K-selectable · 28 audited · **90 never audited**.

**The finding is one class, verified at the mechanism.** A primitive reaches a
non-reader only via (a) a catalog `tutoring` block or (b) `useLuminaAI`/`sendText(`
in the component. **26 K-claiming primitives have NEITHER**, so
`backend/app/api/endpoints/lumina_tutor.py:385` fires:

```python
if not tutoring_scaffold:
    return base + "\nNo specific scaffolding instructions for this primitive type."
```

**11 of the 26 are ALREADY OWNED** by `qa/engineering-tutoring-scaffold/BACKLOG.md`
Phase A. **Confirm, do not re-file them.** The **15 unowned** are item 15.

**S1 `telescope-simulator` is CLOSED** — WRONG-BAND at PRE/EMERGING, floored to
Grade 2, A/B-verified against the real curator. `96c3eb6`.

---

## The queue, with line-exact anchors (verified 2026-08-06)

### 15A — WRONG-BAND, fix = catalog BAND FLOOR (cheapest; do these first)

| # | Primitive | Catalog anchor | Generator |
|---|---|---|---|
| ~~S1~~ | ~~`telescope-simulator`~~ | ~~`catalog/astronomy.ts:52`~~ | **CLOSED `96c3eb6`** |
| **S2** | **`orbit-mechanics-lab`** | `catalog/astronomy.ts:40` | `service/astronomy/gemini-orbit-mechanics-lab.ts` |
| S3 | `rocket-builder` | `catalog/astronomy.ts:34` | `gemini-rocket-builder.ts` |
| S4 | `story-planner` | `catalog/literacy.ts:1649` | (typing at K — PRE rule 6) |
| S5 | `bio-compare-contrast` | `catalog/biology.ts:45` | component is `biology/CompareContrast.tsx` (name ≠ id) |
| S6 | `species-profile` | `catalog/biology.ts:17` | — |
| S7 | `mission-planner` | `catalog/astronomy.ts:46` | `gemini-mission-planner.ts` |

### 15B — SCAFFOLD-GAP, interaction IS K-fit, only the voice is missing

| # | Primitive | Catalog anchor |
|---|---|---|
| S8 | `moon-phases-lab` | `catalog/astronomy.ts:28` |
| S9 | `classification-sorter` | `catalog/biology.ts:22` |
| S10 | `day-night-seasons` | `catalog/astronomy.ts:23` |
| S11 | `solar-system-explorer` | `catalog/astronomy.ts:11` |
| S12 | `scale-comparator` | `catalog/astronomy.ts:17` |
| S13 | `life-cycle-sequencer` | `catalog/biology.ts:28` |
| S14 | `habitat-diorama` | `catalog/biology.ts:39` |
| S15 | `organism-card` | `catalog/biology.ts:12` |

**⚠️ Ordering may want to change — read "Signal that reorders the queue" below.**

---

## The S1 template — copy this, it is proven

**1. Catalog floor.** `catalog/astronomy.ts:54` is the model. A floor must do three
things or the curator ignores it:
- open `constraints` with **`BAND FLOOR: Grade N+ ONLY — do NOT route this to …`**
- **state WHY** in child terms (what is on screen that a non-reader can't get past)
- **name where the displaced demand goes instead** (S1 names solar-system-explorer /
  day-night-seasons / moon-phases-lab)
- and separately **strip the K claims from `description`** — that is the field that
  advertised "Progressive difficulty from K"; a floor in `constraints` alone leaves
  the advertisement standing.

**2. Generator backstop.** Narrow the response-schema `gradeLevel` enum to the
surviving rungs, delete the K/G1 prompt rungs, fun-facts, default hints and default
object lists, and **strip K guidance from the schema field descriptions** (they
steer Gemini even when the enum forbids the value — `telescope-simulator` had
`"K: 3-4 bright objects"` sitting in a field description).

**3. Test + revert-bite.** `gemini-telescope-simulator.reader-fit.test.ts` is the
model: resolver floor cases, a "NEVER returns a below-floor rung for any input"
sweep, and catalog assertions that the old advertising strings are gone. **Prove
non-vacuity by temporarily reverting the floor and re-running** (S1: 3/10 failed).

---

## ⚠️ MEASURED, UN-QUEUED: the astronomy domain has the `14m` prose-grade defect 10/10

Found while fixing S1 and **verified by scan**, not assumed. `generationContext.ts:68`
states the contract outright:

> `NEVER parse grade out of `gradeContext` prose; read this.`

Every astronomy generator violates it. `ctx.gradeContext` is **prose** ("elementary
students (grades 1-5) - Use age-appropriate…"); `ctx.grade` is canonical ('K'|'1'..'12').

| Generator | `= ctx.gradeContext` | single-char compares against it | reads `ctx.grade` |
|---|---|---|---|
| day-night-seasons | 1 | **13** | 0 |
| moon-phases-lab | 1 | **10** | 0 |
| mission-planner | 1 | **7** | 0 |
| scale-comparator | 1 | **7** | 0 |
| orbit-mechanics-lab | 1 | **4** | 0 |
| solar-system-explorer | 1 | 1 | 0 |
| constellation-builder, light-shadow-lab, planetary-explorer, rocket-builder | 1 | 0 | 0 |
| **telescope-simulator** | **0** | 12 | **2** | ← fixed by S1 |

**Confirmed bite on S2**, `gemini-orbit-mechanics-lab.ts:251` + `:551-557`:

```ts
const gradeLevel = ctx.gradeContext;                       // :251  ← PROSE
data.showOrbitalPeriod = gradeLevel === '4' || gradeLevel === '5';   // :551 never true
data.gravityVisualization = gradeLevel >= '3' ? 'field_lines':'none';// :554 ALWAYS true
data.allowBurns = gradeLevel >= '3';                                  // :556 ALWAYS true
data.burnMode = gradeLevel === '5' ? 'prograde_retrograde' : 'direction_picker'; // :557 never
```

`'e' > '3'` lexically, so `>= '3'` is **true for every grade including K** — orbital
burns and gravity field lines are on at K today, while `showOrbitalPeriod` is
unreachable at every grade. *Predicted from the code; confirm with an eval-test
probe before writing it up.* Fix with the S1/14m template: exported
`<name>GradeFromGrade(grade?)` (canonical, floor applied, `null` when absent) `??`
prose fallback **kept, never deleted**.

**Zero char-compares does NOT mean clean** — the 14m sweep's `matter-explorer` miss
was an *inline* resolver that a named-resolver grep missed
([[feedback_value-origin-not-code-touch]]). Probe, don't grep.

---

## Signal that reorders the queue (decide, don't inherit)

After S1's floor landed, the post-fix K manifest routed to **`planetary-explorer`**
and **`constellation-builder`** — both flagged in the triage as *no read-aloud, no
band gate*. Flooring 15A **pushes K demand onto the 15B set**, so every 15A slice
raises 15B's urgency. Two defensible orders:

- **(a) finish 15A first** (cheap, mechanical, each ~1 slice) — but every floor
  aims more K traffic at primitives that still can't speak.
- **(b) interleave**: after S2/S3 (the two worst K claims), pull **S8
  `moon-phases-lab`** — its K rung (*"Moon looks different on different nights"*,
  `from_earth` view only, drag the Moon) is genuinely K-fit and it is the astronomy
  primitive the curator most wants at K.

**Recommendation: (b).** It matches [[feedback_development-over-testing]] — 15B adds
a capability (a voice on a K-fit primitive), 15A only removes a failure.
`planetary-explorer` + `constellation-builder` are **not currently in item 15**
(they have a channel) — if the interleave is taken, re-audit them at PRE first,
because K traffic now lands on them.

---

## Gates per slice (non-negotiable — S1's bar)

1. Focused test + **revert-bite proven** (temporarily undo the fix, watch it fail).
2. `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` — zero NEW vs
   baseline. **Baseline measured 2026-08-06 = 806** (not the 803 quoted in older
   reports; re-measure with `git stash` rather than trusting either number).
3. `npm run typecheck:lumina` = 0. Full `./node_modules/.bin/vitest run` — **1801/1801
   as of `96c3eb6`**.
4. **Runtime, not tsc** (Verification Doctrine): `/api/lumina/eval-test` at the
   floored grade AND a **higher-grade control** proving the ladder wasn't flattened.
5. **The curator A/B — this is the one that actually tests a band floor:**
   ```
   curl -s -m 280 "http://localhost:3000/api/lumina/topic-trace?topic=<the most
     adversarial topic for this primitive>&gradeLevel=kindergarten&manifestOnly=true"
   ```
   Run it **pre-fix** (`git stash push -- <the catalog file>`) to reproduce the
   selection, then post-fix. S1: pre-fix selected `telescope-simulator`, post-fix did
   not. Component ids are at `response.objectives[].componentIds` (top level, **not**
   `manifest.components`).
6. Report to `qa/reader-fit/<id>-PRE-<date>.md`, strike the queue row in
   `BACKLOG.md`, update `WORKSTREAMS.md` in the SAME slice.

---

## Explicitly NOT in scope (don't scope-creep)

- **The other ~64 unaudited K-selectable entries.** They have at least one channel,
  so they need real per-primitive audits. Deliberately unqueued —
  [[feedback_qa-is-a-gate-not-a-census]]. The ranked table is in the triage report if
  someone wants to pull from it.
- **Engineering Phase A's 11.** Owned elsewhere. Confirm, don't re-file.
- **The G2/DEVELOPING band census.** Legitimate and never-run, queued BELOW item 15.
- **Giving telescope-simulator a scaffold / eval modes.** Real follow-ons, left open
  on purpose in item 15 — a floor makes a primitive unreachable by non-readers, it
  does not give it a tutor at the grades it does serve.

## Open residuals from S1

- telescope-simulator still has **no tutoring block and 0 eval modes** at Grades 2-5
  (`/add-tutoring-scaffold`, `/add-eval-modes`).
- The curator A/B is **one pair on one topic**; curation is stochastic, so it is
  strong evidence rather than proof. The generator enum is the backstop for that.
- No browser check was needed (no component change shipped). Any 15B slice that
  touches a component **does** need one.
