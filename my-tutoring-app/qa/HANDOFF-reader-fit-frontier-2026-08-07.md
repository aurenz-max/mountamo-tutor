# HANDOFF — reader-fit frontier: `planetary-explorer` + `constellation-builder`

Written 2026-08-07 at HEAD **`98e4928`**, immediately after **item 15 closed 15/15**
(15B 8/8 + 15A 7/7). This is the next ranked item on the frontier, named in
`qa/reader-fit/BACKLOG.md` and `WORKSTREAMS.md`.

**Every claim below was verified at this HEAD, not carried forward.** The anchors
in `qa/HANDOFF-reader-fit-2026-08-07.md` are now STALE again — S7 added a
`tutoring` block to `catalog/astronomy.ts` and shifted every id below
`mission-planner`.

---

## Paste-able prompt

> Continue the reader-fit sweep. **Item 15 is CLOSED 15/15** — the next pull is the
> frontier item: **`planetary-explorer` + `constellation-builder`**, the last two
> astronomy generators still on the prose-grade contract violation, and the two
> that now carry the K astronomy demand S1's floor and 15B's fixes redirected onto
> them. Read `qa/HANDOFF-reader-fit-frontier-2026-08-07.md` first — it carries
> re-derived anchors and a **reproduced** defect, so do not re-probe to confirm it,
> probe to extend it. Take `constellation-builder` first (see "Which one first").
> Serial, one primitive per slice, `/ship` each with its own report and queue
> strike.

---

## The defect is already REPRODUCED — do not re-derive it

Both generators resolve grade with the **S8 `moon-phases-lab` regex**, over prose:

```ts
const gradeLevel  = ctx.gradeContext;                                  // PROSE
const resolvedGrade = (gradeLevel.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '3');
```

`gemini-planetary-explorer.ts:630/636` · `gemini-constellation-builder.ts:335/341`.
**Both read `ctx.grade` exactly ZERO times.** Kindergarten prose
(*"kindergarten students (ages 5-6) — Use clear, simple language"*) contains no
"grade N", so the regex misses and the literal `'3'` wins.

**Probed live at this HEAD, `&grade=K&gradeLevel=kindergarten`:**

| primitive | stamped `gradeLevel` | title returned |
|---|---|---|
| `planetary-explorer` | **`"3"`** | "Exploring Earth and Mars" |
| `constellation-builder` | **`"3"`** | "Star Pictures in the Night Sky" |

That `resolvedGrade` also drives `GRADE_CONFIGURATIONS[resolvedGrade]`, the
prompt's `**Grade Level:** 3` line, and (planetary-explorer) `buildFallback()`.
So **a Kindergartener gets the Grade 3 configuration, the Grade 3 prompt, and a
Grade 3 rung stamped on the output.**

**One difference from 15A worth knowing:** unlike S2/S3/S4/S6, the rung **IS**
stamped onto the output (`gradeLevel: resolvedGrade`). It is stamped *wrong*, not
missing. So you do not need a stamping fix — you need the resolver to be
canonical-first. Use the S8/S1 template (`moonPhasesGradeFromGrade`), keep the
prose regex as the second resolver, and **export it so it is testable**.

---

## What each one actually is — the two-channel test, re-run at HEAD

| | `planetary-explorer` | `constellation-builder` |
|---|---|---|
| catalog anchor | **`catalog/astronomy.ts:656`** | **`catalog/astronomy.ts:602`** |
| generator | `astronomy/gemini-planetary-explorer.ts` (958 ln) | `astronomy/gemini-constellation-builder.ts` (578 ln) |
| component | `visual-primitives/astronomy/PlanetaryExplorer.tsx` (1036 ln) | `.../ConstellationBuilder.tsx` (759 ln) |
| catalog `tutoring` block | ✅ real (9 contextKeys, 3 levels, struggles) | ✅ real (7 contextKeys, 3 levels, struggles) |
| **`aiDirectives`** | ❌ **ABSENT** | ❌ **ABSENT** |
| component `useLuminaAI` / `sendText` | ✅ **18 hits, 8+ moment tags** | ❌ **ZERO** |
| band gate on `data.gradeLevel` | ❌ none | ❌ none |
| `LuminaReadAloud` | ❌ none | ❌ none |
| eval modes | `K`, `compare`, `mc` | `free_connect`, `guided_trace`, `identify`, `properties`, `seasonal` |
| `supportsEvaluation` | ✅ | ✅ |

**Neither is mute** — that is why they were never in item 15. Both reach the tutor
through the catalog. The gap is different and more specific:

- **Neither has a single `aiDirective`,** so neither has a **PRE-READER
  READ-ALOUD** directive with the cap-override clause. Whatever the tutor says at
  K is unguided, and in a lesson the `[PRIMITIVE SWITCH]` one-sentence cap applies
  with nothing overriding it.
- **Neither component has one band gate or one read-aloud surface.** Every string
  is silent text at K.

**A quotable pre-reader failure, already found — `planetary-explorer`'s own
scaffold is written for a reader:**

> `level1: "Look at the stats panel — one of those numbers will help you."`

That instructs a five-year-old to read a numeric stats panel. Fixing the generator
alone leaves that line in place.

**Answer-leak check already run, and it is CLEAN:** `planetary-explorer` carries
`correctAnswer` in `contextKeys` (fine — tutor reference), and **zero spoken lines
interpolate it**. Do not "fix" this; do preserve it when you add directives.

---

## Which one first

**Take `constellation-builder` first.** Three reasons:

1. It is the smaller surface (578 + 759 lines vs 958 + 1036).
2. It has **no component channel at all**, so it is the cleaner
   catalog-block + `useLuminaAI` + read-aloud slice — the shape you have now run
   eight times.
3. Its `guided_trace` eval mode is **already the K-shaped identity** — S13
   (`life-cycle-sequencer`) borrowed "one tap places into the next empty slot"
   *from this primitive* and named it "the constellation-builder `guided_trace`
   shape". So the K interaction may genuinely need little protocol surgery. Verify
   with an Audit C; do not assume it (that assumption was wrong 15 times out of 15).

`planetary-explorer` is the harder one and benefits from going second: it already
has 8 moment tags, so the work is **auditing an existing voice for band-fitness**
rather than adding one — a different job, and the first time in the sweep it comes
up.

---

## Per-slice recipe (unchanged, and it has held 15/15)

1. **Probe first** at K **and the neighbouring grade** — S7 proved the defect can
   bite at the grade *above* (`grade=4` → `gradeLevel: '1'`), not just below.
   ```bash
   curl -s -m 280 "http://localhost:3000/api/lumina/eval-test?componentId=<id>&evalMode=<mode>&gradeLevel=kindergarten&grade=K&topic=<worst case>"
   ```
2. **Audit C from the rendered state**, not the source.
3. **Generator:** canonical-first exported resolver, prose kept as fallback.
   *Do not* also rewrite `!== 'K'` comparisons as "bugs" without biting them —
   they are equivalent once the rung is canonical (S3 and S7 both proved this).
   Only `>=` / `<=` are broken, because `'K'` sorts above every numeral.
4. **Catalog:** add `aiDirectives` — a PRE-READER READ-ALOUD carrying
   *"this OVERRIDES any instruction to keep it to one sentence"*, plus a rule
   naming what must NOT be said (for these two: the constellation's answer shape,
   and planetary measurements/numbers at K) with **the replacement register
   supplied**.
5. **Component:** `useLuminaAI` + **flat-literal** `aiPrimitiveData` + moments +
   `LuminaReadAloud` on every load-bearing string + band-gate chrome by
   conditional render (never Tailwind `hidden`).
6. **Two test files**: exported-resolver/catalog test + `// @vitest-environment jsdom`
   render test. Copy `MissionPlanner.reader-fit.test.tsx` (S7) for the shape.
7. **Revert-bite every claim.** A test that does not bite is decoration; a bite
   that does not bite is either a test gap or a no-op — say which, out loud.
8. Report → strike the BACKLOG row → update `WORKSTREAMS.md` → commit, same slice.

---

## Gates (baselines measured at `98e4928`)

- **src-scoped tsc `803`** — gate on the SET diff, never the count:
  ```bash
  ./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep "^src/" | sort > now.txt
  comm -13 baseline.txt now.txt   # must be empty
  ```
  The absolute count is unusable while the dev server runs (`.next/types` churn).
- `npm run typecheck:lumina` = **0**, run *after* the last test file exists.
- Full vitest — **2278/2278** at this HEAD.
- `tutor-test?componentId=<id>` Tier 1 `pass`, then `&probe=1&gradeLevel=kindergarten`
  with `dataBagDynamic: false` and **zero `(not set)`**.
- **Runtime A/B**: eval-test at K plus a higher-grade control proving the ladder
  was not flattened.
- **One real-Chrome drive.** Non-negotiable now — see below.

---

## Traps that cost real time in S5–S7

- **A jsdom suite that mocks `useLuminaAI` cannot see a missing
  `LuminaAIProvider`.** The hook *throws*. Four 15B biology primitives had been
  crashing `BiologyPrimitivesTester` since they shipped; S5 found and fixed it.
  **`AstronomyPrimitivesTester` already has the wrapper** — verified — so these two
  are safe, but the lesson generalises: drive one browser render per slice.
- **Chrome catches what jsdom renders silently.** S5's `LuminaReadAloud` nested
  inside a full-row `<button>` was invalid HTML that only real Chrome flagged.
  Guard structurally: `container.querySelectorAll('button button')`.
- **Adding a route to a running Next dev server makes it 404 its own client
  chunks** — the page renders but never hydrates and looks like a component crash.
  Restart the dev server. Cost time twice in one session.
- **Two dev servers running at once** breaks chunk serving the same way. Check
  before diagnosing.
- **The predicted grade-shape is a hint, not a finding.** S5's "fourth shape" was
  S9's map relocated to the call site; S6's predicted prose-grade was real but was
  *not* the defect. **This handoff is different — the defect here is reproduced,
  not predicted.** Extend it; don't re-litigate it.
- **A band failure can be a CONTENT gap** (S4, S6). Check what the child would
  actually DO before scoping a slice as catalog- or component-only.

---

## Scope fence

- These are **two separate slices**, not one. Serial
  ([[feedback_serial-over-workflow-token-budget]]).
- Don't add eval modes — both already have them, and it is a different layer.
- Don't re-open item 15. It is closed 15/15.
- `telescope-simulator` (S1) remains a **band-floor REVISIT CANDIDATE** under
  [[feedback_make-age-friendly-not-band-floor]] — related, but its own item.

---

## Open portfolio decision this sweep keeps re-raising

**Four primitives now have no evaluation hook at all** — `solar-system-explorer`
(S11), `scale-comparator` (S12), `organism-card` (S15), `species-profile` (S6) —
so band-contract rule 8 is **N/A rather than passing**, while `supportsEvaluation`
still lets the manifest route assessment demand at them. That is a decision, not a
slice: `/add-eval-modes`, or declare them exploration-only.

**Neither of the two primitives in this handoff is in that set** — both have eval
modes and real evaluation. Good news, and worth stating so nobody re-files them.
