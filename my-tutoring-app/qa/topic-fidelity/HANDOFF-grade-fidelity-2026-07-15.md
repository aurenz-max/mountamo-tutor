# Handoff: Grade-fidelity sweep — close-out (probe + 2 real gaps + 1 refactor)

Paste-ready brief for a fresh session. Source: memory `project_grade-fidelity-dead-band`
+ a 2026-07-15 `/pm` ground-truth pass. **Read this whole preamble first — the sweep is
much further along than the WORKSTREAMS one-liner implied, and the remaining work is NOT
"wire N generators."**

## Corrected state (verified 2026-07-15 against the tree)

The **boundary + core sweep is DONE and committed** (working tree clean):
- `normalizeObjectiveGrade` in `service/generation/resolveGenerationContext.ts` is the
  ONE grade-string parser → produces canonical `ctx.grade` ('K'|'1'..'12'|undefined).
- **184 of ~210 generators consume `ctx.grade`.** Poetry-lab pilot + a 15-gen literacy
  fan-out + 7 core text gens were all fixed onto `ctx.grade` on 2026-07-03 (the old
  always-'4' poetry-lab bug is dead). Do NOT re-do that work.

So "3/210" (an earlier `/pm` mis-metric that counted references to the *parser* instead of
consumers of its *output*) is wrong. The parser is a boundary function — few files call it
by name; the generators consume the result.

**But `ctx.grade` consumption ≠ grade HONORED.** Per `[[value-origin-not-code-touch]]` and
the topic-fidelity "dead field" finding, a generator can read `ctx.grade` into a prose line
the LLM ignores. The remaining work is to CONFIRM by probe, plus two concrete gaps and one
refactor. **Probe, never grep.**

## Ground rules (non-negotiable)

- **Verification = runtime probe, not type check.** Executor is the grade modality of the
  existing skill: `/topic-fidelity <generator-id> --grade [topic]` (SKILL.md §"Grade
  modality", line ~203). It drives real draws via `eval-test?...&grade=`. A fix is done only
  when grade-2 vs grade-5 draws show monotonic structural difference (reading level / vocab
  tier / passage length / unlocked features) AND the no-`&grade=` band control is unchanged.
- **The matching-fallback trap:** a K-band phonics gen hardcodes fallback 'K', so a K probe
  reads HONORED while grade is fully ignored. **The grade-2 vs grade-5 discrimination runs
  are the real test** — always probe two separated grades, never just K.
- **Type check exactly:** `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit`
  (project-local binary, absolute path) + `npm run typecheck:lumina`. Zero NEW errors vs
  baseline. Necessary, never sufficient.
- **Fix template = the poetry-lab / core-gen pattern** (already in the tree): consume
  `ctx.grade` clamped to the gen's real ladder; above-ceiling → top rung; band fallback
  K→floor else mid; inject the NUMERIC grade into the prompt so grade-2 ≠ grade-4 within a
  band. Reference impl: `service/literacy/gemini-poetry-lab.ts`, and the core-gen
  `gradeToBand`+`gradeLine` shape in `service/core/gemini-fact-file.ts`.
- Dev servers (Next :3000, backend :8000) may already be running — do NOT restart them;
  don't write under `backend/app/` mid-run (uvicorn --reload).
- Don't commit or push unless the user asks. Save one dated report per task under
  `qa/topic-fidelity/` (pattern: `<gen>-grade-2026-07-15.md`). Update the WORKSTREAMS
  PARKED "Grade-fidelity sweep" row + this handoff's checklist as you close each task.

---

## Task 1 — Daily-session grade threading (REAL FUNCTIONAL GAP, do first)

**Evidence:** the backend already carries grade — `backend/app/.../lesson_plan.py`
`BlockSubskill.grade_level: Optional[str]` (line ~155, comment explicitly warns the band
alone "would serve grade 1-5 content to a K student"). But the FRONTEND daily-session path
`service/manifest/sessionPlanAPI.ts` has **zero** grade references — grep it. So a lesson
launched via the daily-session/pulse path likely drops the per-objective grade before it
reaches `resolveGenerationContext`, leaving those draws grade-blind while lesson-builder
launches honor grade. This is the launch-surface parity gap noted as item (c) in memory.

**Do:**
1. Trace how `sessionPlanAPI.ts` builds the objects that become `preBuiltObjectives` /
   `config.objectiveGrade`. Confirm whether `grade_level` from the backend `BlockSubskill`
   survives to `normalizeObjectiveGrade`. (Compare against the lesson-builder producer that
   already carries `grade: s.grade` — IdleScreen / Lesson Group Builder.)
2. If it's dropped, thread it: session-plan objective → `objectiveGrade` at the same
   boundary the lesson-builder path uses. No new parser — reuse `normalizeObjectiveGrade`.
3. **Done when:** a daily-session-originated lesson probed at two grades (K vs 5, or 2 vs 5)
   shows grade-appropriate content on a high-lever primitive (poetry-lab / a core text gen),
   and the lesson-builder path still works. tsc + typecheck:lumina clean. Report the trace +
   before/after draws.

If the trace shows grade already survives (backend field is newer than the memory note),
downgrade this to a one-paragraph "verified honored" report and move on.

## Task 2 — Probe-sweep the high-lever consumers (confirm honor, catch dead fields)

Grade's lever bites hardest on **literacy + core text** primitives (math grade ≈
number-scope, already the topic axis; science/eng sims have only a weak prose lever). Probe
the consumers where a dead-field bug would actually hurt, grade-2 vs grade-5:

- Core text: `fact-file`, `fast-fact`, `how-it-works`, `timeline-explorer`,
  `vocabulary-explorer` (these five ALSO feed Task 3), plus `passage-studio`, `deep-dive`
  (Group-B prose-passthrough orchestrators — verify the numeric grade still reaches child
  blocks).
- Literacy: spot-check 3-4 of the 15 already-fixed gens (`genre-explorer`, `character-web`,
  `sentence-builder`, `paragraph-architect`) to confirm the 2026-07-03 fix still holds after
  the 541b8ea intent/scope sweep touched every generator.

For each: `HONORED` → one-line note; `FIDELITY_BUG` → fix via the template, re-probe, report.
**Done when:** each probed gen is HONORED (monotonic grade signal + band control intact) or
fixed-and-reverified. Batch the one-liners into a single `grade-probe-sweep-2026-07-15.md`.

## Task 3 — Extract the duplicated `gradeToBand` + `gradeLine` helper (refactor, item d)

`gradeToBand` is copy-pasted across 5 core gens: `gemini-fact-file.ts`, `gemini-fast-fact.ts`,
`gemini-how-it-works.ts`, `gemini-timeline-explorer.ts`, `gemini-vocabulary-explorer.ts`
(grep `function gradeToBand`). Extract `gradeToBand(ctx.grade)` + the numeric `gradeLine`
builder into `service/scopeContext.ts` (the shared home) and replace the 5 duplicates.
**Done when:** one canonical helper, 5 call sites updated, and the 5 gens re-probed at 2-vs-5
still HONORED (behavior-preserving). tsc + typecheck:lumina clean.

## Task 4 — Spot-check the K-only phonics gens (LOW, likely no-ops, item a)

~9-10 phonics gens (`letter-spotter`, `letter-sound-link`, `cvc-speller`, `syllable-clapper`,
`phoneme-explorer`, `sound-swap`, `phonics-blender`, `rhyme-studio`, `word-sorter`,
`word-workout`) were deliberately SKIPPED — fallback 'K' is correct and grade-above is
WRONG-PRIMITIVE. Just check whether any has a real K/1/2 lever worth laddering; if not, record
"correct by fallback, no lever" and close. Do NOT force a grade ladder where it's pedagogically
meaningless.

---

## Explicitly OUT of scope (don't pull these in)
- **(b) science / eng / math prose-reading-level gens** — weak lever, grade ≈ scope there
  (already the topic axis). Note-only unless a probe surfaces a real regression.
- **(e) poetry-lab analysis mode** sometimes omits `correctMood`/`figurativeInstances` — that's
  a content-completeness bug for `/eval-fix`, a separate ticket, not grade fidelity.

## Definition of done for the whole stream
Task 1 closed (daily-session honors grade or verified already-honored); Task 2 probe-sweep
green across high-lever gens; Task 3 helper extracted; Task 4 phonics recorded. Then flip the
WORKSTREAMS PARKED "Grade-fidelity sweep" row to CLOSED with the probe evidence.

---

## CLOSE-OUT — 2026-07-15 (all tasks done)

Full report + probe evidence: `qa/topic-fidelity/grade-fidelity-closeout-2026-07-15.md`.

- [x] **Task 1** — VERIFIED HONORED, no code change. Backend `plan.grade_level`
  (`planning_service.py:1190`) + `App.tsx handleBlockStart` (`grade: planGrade`) thread grade
  through the same `objectiveGrade` boundary as lesson-builder. Memory note (c) was stale.
- [x] **Task 2** — 11/11 HONORED (g2-vs-g5 monotonic; band control intact). sentence-builder
  needed the structural axis unclamped (its grade lever IS the mode axis) — HONORED once probed
  right (g2 simple/4-5 tiles → g5 compound-complex/11 tiles).
- [x] **Task 3** — `gradeToBand` + `buildGradeLine` extracted to `scopeContext.ts`; 5 call sites;
  re-probed HONORED; behavior-preserving.
- [x] **Task 4** — NOT a no-op: 4 laddered phonics gens (phonics-blender, syllable-clapper,
  sound-swap, rhyme-studio) had a DEAD K/1/2 lever (read `ctx.gradeContext` prose → pinned 'K').
  Fixed via new `clampGradeToK2` reading `ctx.grade`. phonics-blender now K→cvc / 1→blend /
  2→r-controlled. Remaining phonics gens = correct-by-fallback, no lever (recorded, not forced).

tsc 0-new (808 legacy baseline); `typecheck:lumina` 0. **Uncommitted** — commit on request.
WORKSTREAMS DELEGATED item 3 flipped to CLOSED.
