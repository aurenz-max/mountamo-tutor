# di-math-facts — L1 eval-modes (2026-07-24)

**Layer: L0 → L1 (eval-dense).** `/add-eval-modes` on the third DI-family pack,
run the same day it was born (`7be0883`). Birth-cert follow-up **#1 struck**.

**Ladder chosen by the user: the FULL birth-cert candidate set.** Four task
identities, ordered easiest → hardest:

| evalMode | β | scaffoldingMode | The skill |
|---|---|---|---|
| `counting_next` | 1.5 | 1 | See a number, say the number that comes next ("5 →" → "six") |
| `answer_fact` | 2.0 | 1 | *(L0, unchanged)* printed addition fact → spoken sum |
| `fact_review` | 2.5 | 2 | Cumulative mix drawn WIDE across the grade band, anchored on the lesson's focus |
| `subtraction_fact` | 3.0 | 3 | Printed subtraction fact → spoken difference |

**Deferred, deliberately:** the G3 `multiplication_fact` variant (the pack is
curriculum-fit at K/G1 only — it needs its own `/curriculum-fit` probe *and* a
grade gate before a K session could ever draw it) and the missing-addend shape
("2 + ? is 5"), which the birth cert queues at L4.

## Standing gate 1 (bench-first per response class): SATISFIED, no new sitting

Every mode's spoken answer is a **number word** — precisely the response class
benched in the #46 probe sitting (3/3 affirmed from audio, aliasAgree 3/3, 0
unanchored/phantom/echo). What changes across the ladder is the SKILL, not the
mouth-shape of the answer. This is the same reasoning di-letter-sounds L1 used
for its three continuant modes, and the birth cert stated it in advance.

## Architecture: one cue shape, four skills

The DI packs are hand-authored scripts (exact wording IS the pedagogy), so the
risk in widening a DI primitive is **regressing the bench-proven cue wording**.
That was avoided structurally: the L0 cue lines were already phrased around
`it.problem` rather than around addition, so all four identities read correctly
through the *same* proven sentences —

- "Listen: **two plus one** is three." / "Listen: **three minus one** is two."
- "Your turn. What is **the number after five**?"

so adding an identity is a GENERATOR change (which problems, phrased how), not
a script rewrite. **The L0 addition wording is byte-for-byte what the probe
validated.** The single type-aware line is the counting DIRECTION inside the
judging contract: addition and counting-on count *up*, subtraction counts
*back* — naming the wrong one would tell the tutor to affirm a child who
counted the wrong way.

Fork A discipline holds (as in both sibling packs): Gemini emits only the
session wrapper + a scope hint; **code owns every operand, answer, number word,
solved form and ASR alias**, and code stamps `challengeType` — there is no
schema enum to constrain.

### New field: `solvedDisplay`
The component previously rendered the post-affirmation reward as
`` `${display} = ${answerNumeral}` ``, which is wrong for counting ("5 → ? = 6").
The completed form is now built in code per skill (`2 + 1 = 3`, `3 - 1 = 2`,
`5 → 6`) and the component just renders it — in both the reward chip and the
completion recap. The answer-leak rule is unchanged: `solvedDisplay` renders
ONLY after affirmation, and the recap shows it only for affirmed items.

### Per-skill pools, one scope
All four skills derive from the SAME objective scope, so a "make ten" lesson
drills ten's partners rather than arbitrary numbers:

- `counting_next` → the sequence up to the scope ceiling.
- `subtraction_fact` → make_10 becomes the make-ten **inverse** (10 − n);
  doubles becomes **halving** (2n − n); otherwise every minuend to the ceiling.
  `b < a` throughout, so no item ever answers zero.
- `fact_review` → pool is the **grade band**, not the narrow focus (a review
  that re-drills only the freshly-taught cluster is not a review), with up to 2
  **anchors** from the focused pool to keep its thread to the lesson.
- Variance/dedup generalized per skill: addition commutes (2+3 ≡ 3+2),
  subtraction does not; "trivial" means ±0 for facts and counting-from-zero.

## Verification

**Real-Gemini eval-test, dev server :3000 — 8 runs, all PASS.**

Pinned modes (4/4 single-type, `typesFound` matches the catalog exactly):

| Mode | Topic | Items produced |
|---|---|---|
| `counting_next` | "counting to 5" @ K | 2→3, 1→2, 3→4, 4→5, 0→1 |
| `answer_fact` | "addition facts within 5" @ K | 2+2=4, 2+3=5, 3+0=3, 1+1=2, 2+1=3 |
| `fact_review` | "doubles facts" @ K | 1+1=2, 5+5=10, 4+1=5, 1+0=1, 1+2=3 |
| `subtraction_fact` | "take away facts within 5" @ K | 4−3=1, 2−0=2, 4−1=3, 5−1=4, 5−4=1 |

Blend + mixed:
- **Mixed (SP-21 Fork-A discipline)** — `evalMode=mixed` produced all FOUR
  types round-robin interleaved (counting → answer → review → subtraction →
  counting). The unconstrained path does NOT collapse to one type.
- **Curated blend** — `answer_fact|subtraction_fact` produced exactly those two,
  alternating.

**All 40 generated challenges were recomputed by hand — every answer correct**,
every item inside its scope, `solvedDisplay` correct per skill.

### Intent routing verified through the REAL pipeline (not just a tester pin)
This is newly-live behavior: with one mode the resolver could never run the
intent path (`modes.length < 2` short-circuits to mixed). `/topic-trace` on
*"taking away objects to subtract within 5"* @ K:

- the manifest selected `di-math-facts` for a subtraction objective;
- `resolveLessonEvalModes` pinned **`targetEvalMode: 'subtraction_fact'`**
  (`targetEvalModeValid: true`, `evalModeCount: 4`);
- the generator produced 5−1=4, 5−0=5, 4−2=2, 5−4=1, 5−2=3 — all correct, all
  within 5 at K.

A real K objective now routes to the right *new* skill end-to-end.

### Gate results
- `npm run typecheck:lumina` → **0 errors**.
- Full `tsc --noEmit` → 1021 errors, **all pre-existing legacy-graveyard**;
  zero in `components/lumina/` or in any di-math-facts file (baseline unchanged).
- `npx vitest run` → **915/915 passed, 86 files** (includes the context-native
  generator ledger).

## One design gap the run caught and closed

The first `fact_review` run on a **doubles** objective drew **zero doubles** —
review broadened to the grade band and lost its thread to what was just taught
(the anchors only applied to explicitly *named* facts). Fixed by seeding up to 2
anchors from the focused pool for any scope. Re-verified: doubles @ K now
anchors `1+1` and `5+5`; make-ten @ G1 anchors `4+6` and `7+3` then broadens to
4+4, 3+4, 0+5.

*Note:* those anchors follow the OBJECTIVE's scope, so a K doubles lesson can
include `5+5=10` even though the K grade default is within-5. That is the
documented scope ladder working as intended — the objective's own scope beats
the grade default, and the child was just taught that fact.

## Residual / not verified here

- **The three NEW modes' cue wording has never been heard live** (mirror of
  di-letter-sounds' #42) → **HUMAN-CHECKS #49**. Fold it into the pack's L0
  live loop (**#48**), which is still open — one mic sitting closes both.
- `config.difficulty` arrives from the manifest (topic-trace stamped `hard`) but
  is **inert** — support tiers are this pack's L3 (`/add-support-tiers`), where
  the DISTAR fade (model+guide+test → model+test → test-only) is the natural
  withdrawal.
- Backend β priors updated to match the catalog (4 entries); no calibration
  observations exist for the new modes yet, so they run on priors.

## Files changed

| File | Change |
|---|---|
| `primitives/visual-primitives/direct-instruction/diMathFactsScript.ts` | 4-type union; `solvedDisplay` on the challenge; type-aware counting direction in the judging contract; tutoring directive covers minus/next |
| `service/direct-instruction/gemini-di-math-facts.ts` | 4 `CHALLENGE_TYPE_DOCS`; per-skill pools (`buildSubtractionPool`, `buildCountingPool`); `answerFor`/`keyFor`/`isTrivial` per skill; `seedForType` anchors; mixed = all four interleaved |
| `service/manifest/catalog/di.ts` | 4 `evalModes` (β 1.5/2.0/2.5/3.0); description + constraints widened, with an explicit "use a dedicated counting primitive when counting itself is the objective" boundary |
| `backend/app/services/calibration/problem_type_registry.py` | 4 β priors mirroring the catalog |
| `evaluation/types.ts` | `DiMathFactsMetrics.challengeType` widened to the 4-identity union |
| `primitives/.../DiMathFacts.tsx` | reward chip + recap render `solvedDisplay` |
| `components/DirectInstructionPrimitivesTester.tsx` | Math Facts mode selector lists all 4 |
| `service/registry/generators/diGenerators.ts` | comment only (registration already correct: `...ctx.raw` + `intent`) |

## Ladder next

`/add-tutoring-scaffold` (L2, birth-cert follow-up #2) — move
`DI_MATH_FACTS_TUTORING` into `catalog/di.ts` `tutoring:`, mirroring
di-letter-sounds. The shared lesson-mode wiring (`audioInput.manual_activity`,
`connectLesson`) is already in place from the 07-23 family slice, and
`{{challengeType}}` now has four values to carry.
