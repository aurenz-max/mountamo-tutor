# Eval Report: story-talk — eval modes (L0→L1) — 2026-07-05

Lifecycle: **L1 (eval-dense)**. Added the comprehension ladder. `first_next_last` (needs a
sequencing render) and `retell` (needs the short-phrase judge) remain deferred.

## Ladder (catalog `evalModes` + backend β priors, matched)

| evalMode | β | Skill (task identity) |
|----------|---|----------------------|
| who_what_where | 2.0 | Literal recall — answer is STATED in the story |
| feeling_check | 3.0 | Emotion inference — feeling is NOT stated (inferred from events) |
| why_because | 4.0 | Causal inference — the CAUSE is a picturable word in the story |

## Architecture

- Single shared render (question + 4 emoji taps) → single shared schema; Gemini self-labels each
  story via a `challengeType` enum, `constrainChallengeTypeEnum({arrayName:'stories', fieldName:'challengeType'})`
  narrows it to the pinned/resolved/mixed set. `resolveEvalModes` routes explicit-pin | intent | mixed.
- **Mode-aware validation** (the key correctness nuance): `REQUIRES_ANSWER_IN_STORY = {who_what_where, why_because}`
  — those answers must appear in the story; `feeling_check` is the inference exception and must NOT be required
  (requiring it would reject every valid inference item). Answer-leak gate (answer ∉ question) applies to all modes.
- Session variety enforced via `selectWithTypeVariety` (blend/mixed cover every allowed type at least once).

## eval-test sweep (topic "The Forest") — G1/G2/G3/G4/G5

| Run (evalMode) | Challenges | All type-pinned | answer∈story (mode-correct) | leak in Q | Verdict |
|----------------|-----------|-----------------|-----------------------------|-----------|---------|
| who_what_where | 5 | ✅ all who_what_where | ✅ True (required) | none | PASS |
| feeling_check | 5 | ✅ all feeling_check | ✅ False (inference — correct) | none | PASS |
| why_because | 5 | ✅ all why_because | ✅ True (cause stated) | none | PASS |
| mixed | 5 | ✅ 2 feeling + 2 who + 1 why | ✅ per-mode correct | none | PASS |

- **G3 (eval-mode differentiation):** CONFIRMED — feeling answers are emotion faces (scared/tired/excited/
  surprised/sad), why answers are causes (dark/hungry/fly/scared/rain), who answers are nouns (bear/acorn/
  branch/rain). Genuinely distinct skills, not difficulty reskins.
- **G4:** every feeling_check item correctly had `answer∉story`; every who/why item had `answer∈story`; zero
  question leaks across all 20 challenges; every answer present in its 4 options.
- **G5:** generator rejects-never-fabricates; throws if <5 usable after one corrective retry.

tsc: clean, holds 1101 baseline.

## Follow-up (unchanged from birth queue)
`/add-tutoring-scaffold` (read-aloud directives) → `/add-support-tiers` → `/add-structural-difficulty`
→ `/add-sound` → `/add-spoken-judge` (spoken-answer beat). `first_next_last` = new sequencing render
(own build); `retell` = gated on the Blend-Judge-Lab short-phrase bench.
