# Grade-fidelity sweep — close-out (2026-07-15)

Executor: probe-driven runtime verification via `eval-test?...&grade=` (the `/topic-fidelity
--grade` engine). Dev server on :3000. All verdicts are from grade-2-vs-grade-5 (or K/1/2)
discrimination draws, never grep. Source brief: `HANDOFF-grade-fidelity-2026-07-15.md`.

**Outcome:** all four tasks CLOSED. Tasks 1-3 confirmed already-honored / behavior-preserving;
**Task 4 surfaced and fixed a real 4-generator dead-lever bug** the handoff flagged as "likely
no-op" — grades 1-2 phonics students were being served kindergarten content.

---

## Task 1 — Daily-session grade threading → VERIFIED HONORED (no code change)

The memory note (c) said the frontend daily-session path drops per-objective grade. **Stale —
the backend field and the frontend threading are both newer than the note.** Full trace:

```
backend planning_service.get_daily_session_plan
  → student_grade = planning.grade_level (students/{id}.grade_level)
  → build_session_plan(...) then plan.grade_level = student_grade   (planning_service.py:1190)
  → persisted; re-read via DailySessionPlan.model_validate (keeps grade_level)
frontend App.tsx handleBlockStart
  → planGrade = sessionPlan.grade_level                              (App.tsx:264)
  → preBuiltObjectives[].grade = planGrade                          (App.tsx:293)
  → flattenManifest stamps config.objectiveGrade = grade            (flattenManifest.ts:109)
  → resolveGenerationContext → ctx.grade = normalizeObjectiveGrade  (the ONE parser)
```

`sessionPlanAPI.ts` has no grade *logic* because it is only the fetch client + types (it *does*
carry `grade_level` on `DailySessionPlan`); the threading lives in `App.tsx`. The daily-session
path uses the **same `objectiveGrade` boundary** the lesson-builder path uses, so any generator
that honors `objectiveGrade` (all of Task 2) honors it from a daily-session launch too. Legacy
plans persisted before `grade_level` existed carry none → UI-band fallback, as designed.

## Task 2 — Probe-sweep high-lever consumers → ALL HONORED (11/11)

Metric = complexity of all string leaves in the generated content. HONORED = g5 monotonically
more complex than g2 AND (spot-checked on fact-file) the no-`&grade=` control sits at the band
default. Topic "The Water Cycle" (core) / "A lost puppy finds its way home" (literacy).

| Generator | avg_word_len g2→g5 | %long-words(≥7) g2→g5 | verdict |
|---|---|---|---|
| fact-file | 4.29 → 4.89 | 9.1 → 21.7 | HONORED |
| fast-fact | 4.69 → 5.16 | 13.5 → 19.9 | HONORED |
| how-it-works | 4.60 → 4.78 | 17.0 → 19.8 | HONORED |
| timeline-explorer | 4.39 → 4.82 | 11.4 → 20.2 | HONORED |
| vocabulary-explorer | 4.60 → 4.96 | 13.3 → 20.4 | HONORED |
| passage-studio (orch.) | 4.63 → 4.93 | 20.1 → 23.9 | HONORED — grade reaches child blocks |
| deep-dive (orch.) | 4.96 → 5.12 | 24.8 → 26.2 | HONORED — grade reaches child blocks |
| genre-explorer | 4.68 → 4.77 | 24.2 → 26.6 | HONORED |
| character-web | 4.77 → 5.06 | 21.2 → 26.7 | HONORED |
| paragraph-architect | 4.84 → 5.56 | 19.6 → 35.1 | HONORED (strong) |
| sentence-builder | see note | see note | HONORED (structural) |

**sentence-builder note — a probe-methodology trap worth recording.** Under a *pinned* eval mode
(`simple`) the g2/g5 draws looked flat/inverted, because sentence-builder's PRIMARY grade lever
is the sentence *type* (simple → compound → complex → compound-complex), which is the eval-mode
axis — pinning the mode clamps it, and the gen even drops the grade-context prose when a mode is
active. Re-probed with grade driving structure (unknown mode → null constraint): **g2 = `simple`,
4-5 tiles; g5 = `compound-complex`, 11 tiles.** Clean monotonic ladder = HONORED. Lesson: for
gens whose grade lever IS the mode axis, probe with the structural axis unclamped.

## Task 3 — Extract duplicated `gradeToBand` + `gradeLine` → DONE (behavior-preserving)

Extracted into `service/scopeContext.ts` (the shared grade home):
- `gradeToBand(grade?)` — numeric grade → audience BAND KEY ('Kindergarten'|'Elementary'|
  'Middle School'|'High School'); '' when absent (caller's prose fallback stands).
- `buildGradeLine(grade?, tuneItems?, extra?)` — the EXACT-grade prompt line; '' when no grade
  (the no-regression control). `tuneItems`/`extra` cover vocabulary-explorer's "definition
  length" clause and fast-fact's `Set gradeBand` output-field instruction.

5 duplicate `gradeToBand` copies removed; 5 call sites updated (`gemini-fact-file`, `-fast-fact`,
`-how-it-works`, `-timeline-explorer`, `-vocabulary-explorer`). `getGradeLevelContext` and
`inferGradeLevelFromContext` left per-gen (their maps differ). Re-probed g2-vs-5 after the
refactor — all 5 still HONORED (word-len + long-word% still climb). tsc: 0 new (808 legacy
baseline unchanged); `typecheck:lumina`: 0 errors.

## Task 4 — K-only phonics spot-check → FOUND + FIXED a real 4-gen dead lever

The handoff estimated this "LOW, likely no-op." Instead, **6 phonics gens with a genuine K/1/2
pedagogical ladder had that ladder dead**, pinned to the 'K' floor:

- `gemini-phonics-blender` (K→cvc, 1→blend, 2→r-controlled)
- `gemini-syllable-clapper`, `gemini-sound-swap`, `gemini-rhyme-studio` (per-rung guidelines)
- `gemini-phoneme-explorer` (`gradeKey`), `gemini-word-sorter` (`resolveGradeKey`) — same bug,
  different variable names; found by grepping the dead-source *shape*
  (`[…].includes(ctx.gradeContext…)`) across all gens, not just `gradeLevelKey`.

**Mechanism (classic mechanism-1 + dead-field):** each read `const gradeLevel = ctx.gradeContext`
— the PROSE band ("kindergarten students …") — and matched it against `["K","1","2"]`. A sentence
never equals 'K'/'1'/'2', so every objective fell to the `: 'K'` fallback. phonics-blender also
destructured `objectiveGrade` and immediately `void`ed it. Live confirmation (before):

```
phonics-blender  grade K → cvc/K   grade 1 → cvc/K   grade 2 → cvc/K   (all pinned)
```

**Fix:** added `clampGradeToK2(grade?, fallback?)` to `scopeContext.ts` (reads the canonical
`ctx.grade`; K/1/2 pass through, grade>2 clamps to '2' — a K-2 primitive tops out by design,
grade-above is WRONG-PRIMITIVE not a taller rung; no canonical grade → fallback = old prose
default). Routed all 4 gens through it. After:

```
phonics-blender  grade K → cvc/K   grade 1 → blend/1   grade 2 → r-controlled/2   (ladder live)
sound-swap       gradeLevel K→K, 2→2 ;  rhyme-studio  gradeLevel K→K, 2→2
syllable-clapper avg syllables 2.62→2.88, max 4→5, harder word set (modest but live)
```

tsc: 0 new; `typecheck:lumina`: 0 errors.

After (phoneme-explorer + word-sorter, added in the close-out review):
```
phoneme-explorer  grade K → avg word-len 3.38 (dog/log/dig) ; grade 2 → 4.44 (frog/flag/shell)
word-sorter       gradeLevel K→K (dog/cat/bus) ; 2→2 (School/Seed/Mountain, grade-2 academic vocab)
```

**Other phonics gens (correct by fallback — no fix):**
- `letter-sound-link` — already prefers `ctx.grade` (pre-reader band-gate, `resolvePreReaderGradeKey`). HONORED by design.
- `letter-spotter`, `cvc-speller`, `word-workout` — no K/1/2 content ladder and no `ctx.grade`
  consumption; a K-floor primitive with no per-grade differentiation. **Correct by fallback, no
  lever** — not forced (per handoff).

**Class-audit (grep to SIZE, not to verify):** swept every gen for the dead-source shape
`gradeLevel = ctx.gradeContext` + `[…].includes(gradeLevel…)` against a grade key. Result: the 6
phonics gens above were the entire population — all now fixed. ~120 other gens read
`ctx.gradeContext` but do NOT match it against a discrete grade key (they use it as a prose band
or ignore it); those are math/science/eng where grade≈scope (handoff item (b), out of scope). No
hidden grade-key dead-source bug remains. Only `phonics-blender` had the destructure-then-`void`
objectiveGrade pattern.

---

## Files changed
- `service/scopeContext.ts` — +`gradeToBand`, +`buildGradeLine`, +`clampGradeToK2`
- `service/core/gemini-{fact-file,fast-fact,how-it-works,timeline-explorer,vocabulary-explorer}.ts` — use shared helpers (Task 3)
- `service/literacy/gemini-{phonics-blender,syllable-clapper,sound-swap,rhyme-studio,phoneme-explorer,word-sorter}.ts` — grade lever via `clampGradeToK2` (Task 4 fix, 6 gens)

## Verification
tsc (`./node_modules/.bin/tsc --noEmit`): 808 errors, all pre-existing legacy graveyard, 0 in
touched files. `npm run typecheck:lumina`: 0 errors. Runtime: probe evidence above.
Uncommitted (per doctrine — commit on user request).
