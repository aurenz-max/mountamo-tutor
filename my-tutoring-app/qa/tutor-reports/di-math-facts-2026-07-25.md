# di-math-facts — L2 tutoring scaffold (2026-07-25)

**Layer: L1 → L2 (tutored).** `/add-tutoring-scaffold` on the third DI-family
pack. Birth-cert follow-up **#2 struck**. Mirrors di-letter-sounds' L2 move
(2026-07-23) exactly — the DI family's L2 is a *relocation plus focusing*, not a
new scaffold: `DI_MATH_FACTS_TUTORING` moved out of `diMathFactsScript.ts` into
`catalog/di.ts` `tutoring:`, so both connect paths (standalone fallback + lesson
auth/`switch_primitive`) resolve it from the single source of truth.

## What changed

| File | Change |
|---|---|
| `service/manifest/catalog/di.ts` | di-math-facts gains `tutoring:` — the moved block + `{{challengeType}}`, `contextKeys`, and 4 `commonStruggles` (new at this layer) |
| `direct-instruction/diMathFactsScript.ts` | `DI_MATH_FACTS_TUTORING` deleted (+ its now-unused `TutoringScaffold` import); replaced by the sibling's pointer comment. Cue lines and `judgingContract` **untouched** — the bench-proven wording is byte-identical |
| `direct-instruction/DiMathFacts.tsx` | drops the local `tutoring:` connect arg (catalog resolves it); data bag grows `challengeType` / `display` / `problem` / `facts`; new `updateContext` effect keeps RUNTIME STATE truthful as facts advance |
| `service/direct-instruction/gemini-di-math-facts.ts` | attaches the flat `facts` summary (printed problems only), so RUNTIME STATE is populated from the **first auth-time prompt**, before the component's live sync takes over — same as letter-sounds' `letters` |

**Scaffold content added at this layer** (the L0 block had none of it):
- `contextKeys: ['challengeType', 'display', 'problem', 'facts']` — stimulus side
  only. `answerWord` / `solvedDisplay` are deliberately **absent**: the tutor
  already receives the answer inside each `[DI_ITEM]` judging contract, and
  RUNTIME STATE is echoed far more loosely than a scripted line.
- 4 `commonStruggles` (from the birth cert + the #48 stress list): near-miss
  number, counting without landing, repeating the problem back, silence after
  "Your turn".
- NUMBER WORDS gained one clause for the #48 homophone stress: *you are judging
  the SOUND, so a word that sounds like the target number IS the target number
  ("won"/one, "too"/two, "for"/four, "ate"/eight)* — widened for homophones of
  the TARGET only; the "a DIFFERENT number is always wrong" rule is unchanged.
- Sentinel discipline re-checked: no scaffolding level, struggle response, or
  directive line begins with "Yes" or "My turn". Gate-3 correction-opener
  directive preserved verbatim.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` (project-local, abs path) | **0 Lumina-surface errors** (legacy `src/lib/*` graveyard unchanged) |
| `/tutor-test di-math-facts` (Tier 1) | **warn** — 2 findings, both structural to the DI family (see below). **0 HIGH.** Identical to di-letter-sounds' baseline |
| Tier-2 probe, `answer_fact` @ K "adding within 5" | all 4 contextKeys resolve; `challengeType: answer_fact`, `display: 0 + 4`, `problem: zero plus four` |
| Tier-2 probe, `subtraction_fact` @ G1 "take away within 10" | all 4 resolve; `display: 5 - 2`, `problem: five minus two`, `facts: 5 - 2, 5 - 4, 5 - 3, 9 - 0, 8 - 1`. **No `(not set)` anywhere; no answer in RUNTIME STATE** |

### The two WARNs are the DI family's shape, not defects

- `data-bag-unparsed` — the auditor parses `useLuminaAI({ primitiveData })`. DI
  primitives connect through `ctx.connect({ primitive_data })` + `updateContext`
  instead, so the bag is invisible to static analysis. **Resolved by the Tier-2
  probe above**, which shows every key populated.
- `no-sendtext-moments` — DI cues travel as `[DI_ITEM]` / `[DI_MOVE_ON]` /
  `[DI_COMPLETE]` through the judged-loop engine (`loop.sendCueNow` /
  `queueCue`), never `sendText`. The tutor cannot go silent: every item is cued.
  The directive-tag check passes because the script file emits all three tags.

di-letter-sounds carries the same two WARNs at the same layer — this is the
family's `pass`.

## Verdict

**L2 connection verified (Tiers 1–2), and the scaffold has now RUN LIVE.**

**Tier-3, same day (user mic run, "worked great!"):** a full `subtraction_fact`
session, 5/5 affirmed, was the first run against the catalog-resolved block. The
tutor held the scripted lines across all 5 items — so the 4 added
`commonStruggles` did **not** loosen it into chattiness, which was this layer's
named risk. Report: `qa/eval-reports/di-math-facts-live-2026-07-25.md`.

**Still unexercised: the homophone clause.** The run was all-correct, so the one
piece of genuinely NEW judging copy (a word that sounds like the target number IS
the target — "won"/one, "too"/two, "for"/four, "ate"/eight) has never been put
under load, and neither has the risk it carries: that widening for target
homophones softened wrong-number strictness. That needs a deliberately wrong
answer → **HUMAN-CHECKS #50**.
