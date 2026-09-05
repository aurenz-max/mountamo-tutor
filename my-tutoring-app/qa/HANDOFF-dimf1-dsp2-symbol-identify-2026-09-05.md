# HANDOFF — DIMF-1 × DSP-2: does the eval-mode resolver have a symbol-identify gap?

Paste-able execution prompt. Authored `/lesson-coverage` session 2026-09-05; every
anchor verified against the working tree at HEAD `315f7bfb`. **This is a diagnostic
handoff, not a fix handoff** — the honest read of the evidence below is that DIMF-1
does NOT cleanly confirm DSP-2's hypothesis, and the recommended next action is a
narrow, low-blast-radius catalog fix on `di-math-facts` alone, NOT an edit to the
shared `resolveLessonEvalModes.ts`. Read the whole "Two hypotheses" section before
touching the resolver — that is the point of this handoff.

## The prompt

`qa/lesson-bench/BACKLOG.md` item 24 (2026-09-05): the coverage judge scored a fresh
K "subtraction" package WARN — obj2 ("Identify the minus sign and the equals sign in
a simple take-away sentence") `ASSESSED_INSUFFICIENTLY`, citing
`off_target_assessment @obj2-di-math-facts`: *"prompts students to compute and
vocalize differences rather than identifying the minus or equals signs."*
Package: `qa/lesson-bench/packages/kindergarten-subtraction-for-kindergarten-20260905202425-mb4f.json`,
block `obj2-di-math-facts` (`:966-1067`) — `challengeType: 'subtraction_fact'`,
5 challenges like `{a:4, b:0, display:'4 - 0', problem:'four minus zero'}`. Every
challenge is a bare compute-and-say-the-answer task; none touches a printed `-` or
`=` glyph as an object of identification.

This was filed alongside `EVAL_TRACKER.md` **DIMF-1**, cross-referenced with **DSP-2**
(`qa/eval-reports/di-spoken-practice-2026-09-05.md`, filed by item 21's addition
pass) because the SYMPTOM is the same shape: a compute/production eval mode fighting
a "identify the printed symbol" objective. DSP-2 asked for 2-3 more instances before
touching the shared resolver (`resolveLessonEvalModes.ts`) on n=1. This handoff is
that follow-up — and it finds the two cases are NOT mechanically identical.

## Two hypotheses — read this before editing anything

**H1 — same defect as DSP-2 (resolver picked the wrong mode from valid siblings).**
DSP-2's shape: `di-spoken-practice` had TWO existing candidate modes (`read_aloud`,
`say_answer`); one fits "identify a symbol" (`say_answer` — stimulus ≠ answer, the
recall workhorse) and one doesn't (`read_aloud` — stimulus === answer, decoding);
the resolver picked the wrong one anyway. If DIMF-1 is the same shape, `di-math-facts`
should have SOME candidate mode whose description is close to "see a printed symbol,
say/point at what it means" that the resolver passed over for `subtraction_fact`.

**Checked against the catalog — it does not.** `di-math-facts`'s full mode list
(`src/components/lumina/service/manifest/catalog/di.ts:328-366`): `name_numeral`
("see one printed numeral, say its name aloud"), `counting_next` ("say the number
that comes next"), `answer_fact` / `subtraction_fact` (compute and say the answer),
`fact_review` (mixed recall). **None of these describe identifying a printed
operator or relational symbol** — `name_numeral` is the closest in shape (bare
perceptual naming) but it names NUMERALS, not SIGNS, and the pool builder
(`gemini-di-math-facts.ts:~406-421`, per the prior `name_numeral` handoff) only ever
emits numeral pairs, never a bare `-` or `=` glyph. **There was no correct candidate
for the resolver to pick.** This is the load-bearing difference from DSP-2, where a
correct candidate existed and was passed over.

**H2 — this is a SELECTION-layer defect one stage earlier, not a resolver defect.**
`resolveLessonEvalModes.ts` (`collectSlots`, `:150-199`) only chooses AMONG the modes
of a component the CURATOR already placed under this objective
(`walkBlocks`/`objectiveBlocks` come in already paired, `:104-124`) — it never
chooses which primitive serves an objective, and it cannot invent a mode. If no mode
on the assigned primitive fits, the resolver's job was unsolvable before it ever ran;
picking `subtraction_fact` (the highest-β, most generic "practice the family's core
skill" mode, `di.ts:360-365`) over `name_numeral`/`counting_next` is a defensible
"least-wrong of five wrong options" pick, not a sibling-mode mis-rank. The actual
placement of `di-math-facts` under `obj2` happens earlier, at manifest/curator time
— `c.description`/`c.constraints` render into the curator's primitive-selection
prompt (`gemini-manifest.ts:327`), and `di-math-facts`'s own `description`
(`di.ts:312`) advertises fact fluency AND numeral naming broadly across "K/G1
MATHEMATICS operations" without excluding symbol/sign-identification objectives —
plausibly broad enough that a curator reaches for it whenever an objective mentions
a math symbol at all, whether or not any of its modes actually serve that verb.
This is the same shape `di-math-facts`'s own `constraints` field already handles for
a DIFFERENT carve-out (`di.ts:313`: *"Use a dedicated counting primitive when
COUNTING ITSELF is the objective... naming a written numeral aloud... IS served
here"*) — the pattern for narrowing what this primitive should be selected FOR
already exists in this exact file, just missing the "identify a sign" exclusion.

**Read of the evidence: H2 is the better-supported explanation.** DIMF-1 is real
and worth fixing, but it does NOT confirm DSP-2's specific claim (resolver mis-ranks
valid sibling modes) — it's evidence of the same PATTERN (symbol-identify objectives
attract fact/production primitives) surfacing through a different MECHANISM (wrong
primitive selected, not wrong mode chosen from the right primitive). Do not count
this as DSP-2's requested n=2 without qualification; note the mechanism split if a
future session decides to act on DSP-2.

## What to do about DIMF-1 itself (narrow, ready to execute)

Mirrors DSP-1's restraint (fix scoped to the one primitive that misfired, not the
shared stage) more than DSP-2's (needs more data before touching shared code):

- **`src/components/lumina/service/manifest/catalog/di.ts:313`** (`constraints`) —
  add a clause excluding symbol/sign-identification objectives, parallel to the
  existing counting-vs-numeral carve-out in the same sentence: e.g. *"Not for
  objectives asking the child to identify or name a printed OPERATOR or relational
  symbol (+, −, =) — none of this pack's modes test symbol recognition, only
  numeral naming and fact computation; a symbol-identification objective needs a
  different primitive's assess/apply block."*
- **`di.ts:312`** (`description`) — the numeral-naming sentence added for the
  `name_numeral` handoff already sets the precedent of naming what the pack does
  NOT do generically; consider whether the exclusion belongs in `description` (what
  the curator reads to decide whether to select the primitive at all,
  `gemini-manifest.ts:327`) rather than only `constraints`, since `constraints` may
  get less selection-time weight than `description` — check both fields' actual
  prompt placement before choosing where the sentence lives.
- This is a **description/constraints-only edit** on ONE catalog entry — same
  blast-radius class as DSP-1, not the shared resolver. No resolver, generator, or
  schema change implied.

## Confirming step before either fix lands

Re-run `resolveLessonEvalModes` with its own rationale log captured
(`resolveLessonEvalModes.ts:391-397` already logs a per-slot rationale string to
console) on a fresh regeneration of this topic, and read what the model actually
said for the `di-math-facts` slot. If the rationale explicitly invokes labor
division ("siblings already cover sign identification, this slot reinforces fact
fluency" — RULES rule 3, `resolveLessonEvalModes.ts:231`), that confirms H2 exactly
as diagnosed above. If the rationale claims `subtraction_fact` DOES teach sign
identification, that would be a genuine resolver miscalibration worth its own
n=1 report, separate from this one — do not skip this check and assume H2 by
inference alone; it costs one server-log grep on the next `topic-trace` call for
this topic.

## Gates

- `/lesson-coverage confirm` on `kindergarten-subtraction-for-kindergarten-20260905202425-mb4f`
  plus a fresh `topic-trace` regeneration of the same topic, before/after the
  `constraints`/`description` edit — obj2 should stop citing `obj2-di-math-facts`
  as an off-target assessment surface (it may still get selected as pure practice;
  the fix is that it no longer counts against coverage, or is no longer selected
  under `obj2` at all).
- tsc 0 new vs baseline (prose-only catalog edit, no type surface touched).
- Do NOT treat this fix as closing DSP-2. DSP-2 still needs its own 2-3 clean
  same-mechanism instances (two-plus EXISTING valid modes on one primitive, wrong
  one picked) before the shared `resolveLessonEvalModes.ts` RULES (`:228-231`) are
  touched. If the rationale-log check above finds a THIRD instance where a correct
  candidate mode existed on the assigned primitive and was passed over, promote
  DSP-2 from "structural, needs a probe" to an actual resolver fix and file it as
  its own handoff — do not fold that work into this one.

## Bookkeeping

- Once the `di.ts` edit lands and is confirmed, update `EVAL_TRACKER.md` DIMF-1's
  row to `FIXED` with a before/after coverage table, and cross out the "cross-
  referenced with DSP-2" framing in favor of "evidence toward the SAME PATTERN via
  a DIFFERENT MECHANISM — see this handoff" so a future reader doesn't over-read
  it as DSP-2 confirmation.
- `qa/lesson-bench/BACKLOG.md` item 24(b): strike once fixed, link this handoff.
- If the rationale-log check surfaces a genuine 3rd DSP-2-shaped instance, that's
  a new memory-worthy signal (`project_*`, not `feedback_*` — it's a data point,
  not yet a ruling) once the resolver fix itself is scoped.

## Executed 2026-09-05 (same day) — outcome

**Confirming step (run first, before any edit).** `resolveLessonEvalModes` driven headlessly through the
Vite module runner on the frozen `…mb4f` manifest with every multi-mode pin stripped (curator state), ×3:

| run | pick for `obj2-di-math-facts` | rationale (verbatim) |
|---|---|---|
| 1 | `subtraction_fact` | "presents simple subtraction sentences where children recognize signs and speak the resulting count, fitting subtraction_fact" |
| 2 | `subtraction_fact` | "Presents simple subtraction sentences within 5 for the student to state the remaining count." |
| 3 | `subtraction_fact` | "Presents printed subtraction sentences to practice recognizing take-away facts and stating the remaining count." |

No rationale invokes labor division and none claims the mode teaches sign identification — run 1 echoes the
CURATOR'S intent ("recognize the minus and equals sign and speak the resulting remaining count"), which is the
smoking gun for H2: the curator believed this pack could serve sign recognition, and the resolver had no
correct candidate to pick. **H2 confirmed; not a resolver miscalibration; not DSP-2's n=2.**

**Fix (catalog only, `di.ts` `di-math-facts`).** `description` gains "NOT for identifying the SIGNS
themselves … served by a symbol-introduction or equation-building block, never by this pack"; `constraints`
gains the parallel clause after the counting carve-out ("Likewise NOT for objectives asking the child to
identify, name, or point at a printed OPERATOR or relational symbol (+, -, =) …"). Both render on the one
catalog line the curator reads (`gemini-manifest.ts:327`); the resolver prompt never sees either field, so
the edit is confined to the selection layer by construction. tsc 775 total, 0 in `di.ts`/`manifest/`.

**Before/after — curator selection on the frozen objectives + brief (manifest-only regenerations).**

| arm | draws | `di-math-facts` under obj2 | obj2 blocks drawn |
|---|---|---|---|
| before (incl. the filed package) | 4 | 1/4 | foundation-explorer + equation-builder every draw; `di-spoken-practice[say_answer]` once; `di-math-facts` once (the filed package) |
| after | 3 | 0/3 | foundation-explorer + equation-builder every draw; `concept-card-grid` once |

The mis-selection was intermittent to begin with, so 0/3 is consistent with the fix, not proof of it. The
resolver-rationale table above is the load-bearing evidence, not the selection rate.

**Coverage gate.**

| package | judge | obj2 | items | off-target |
|---|---|---|---|---|
| `…mb4f` frozen, re-judged | WARN 0.75 | ASSESSED_INSUFFICIENTLY | 2 | still cites `obj2-di-math-facts` (content frozen — judge stable) |
| `kindergarten-subtraction-20260905220159-e1b7` fresh after-fix | **PASS 1.00** | **ASSESSED_SUFFICIENTLY** | 7 (`obj2-build-sentence` ×5 + final check ×2, both signs) | none |

Scorer on `…e1b7`: BROKEN on G1/Q8 only (`equation-builder` `reads: developing` @ PRE — the known dup,
reader-fit BACKLOG 20a). KC-1 happened to cover "=" in this draw; n=1 on a shared generator closes nothing —
KC-1 stays open. Side data point for DSP-2 recorded on its tracker row (one baseline draw selected
`di-spoken-practice` and the resolver picked `say_answer` with the reworded mode descriptions).

Bookkeeping done: `EVAL_TRACKER.md` DIMF-1 struck FIXED with this table; `BACKLOG.md` 24(b) struck;
`WORKSTREAMS.md` Lesson Bench row updated. Scratch (bodies, resolver script, raw draws) in the session scratchpad.
