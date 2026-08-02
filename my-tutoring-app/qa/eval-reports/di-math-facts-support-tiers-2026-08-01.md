# di-math-facts — L3 support tiers (2026-08-01)

Birth-cert follow-up **#3 struck**. The pack is now L0 → L1 → L2 → L3. Second
DI pack to reach L3; di-sentence-reading's L3 was the worked template and this
slice follows it point-for-point, with one pedagogical upgrade noted below.

## Archetype and lever discovery

Same verdict as the sibling: the pack fits **none** of the skill's six
archetypes (live-judged spoken production, the Live tutor IS the interaction
surface), has **zero `showOptions`** and no per-challenge display scaffolds —
so the whole ladder is modality **#2, instruction-as-scaffold** (the
AngleWorkshop case). And the sub-steps were already here: **DISTAR's
model → guide → test IS a scaffold ladder.** The birth certificate specified
this fade at L0; this slice built exactly it:

| Tier | Spoken cue | What the child must do |
|---|---|---|
| **easy** | `Listen: two plus one is three.` + `Together: …` + `Your turn. What is two plus one?` | answer after hearing the fact twice (the L0 shape) |
| **medium** | `Listen: …` + `Your turn…` | answer alone after hearing it once |
| **hard** | `Your turn. What is two plus one?` | **retrieve the answer COLD, never having heard it** |

The withdrawal is identical across all four eval modes, and that is correct
rather than lazy: every mode is the same act (see the printed problem, speak
the number word), so the same three sub-steps precede it. A **mode** changes
which facts are drawn; a **tier** changes how much of the sequence is handed
over. `resolveSupportStructure` is kept per-type-capable so a future mode can
diverge.

## Why `hard` matters MORE here than in the template pack

In di-sentence-reading, `hard` closed an **echo route** onto a target that is
still printed on the child's screen. Here the stakes are higher: the screen
never shows the sum (answer-leak rule), so **the model line is the ONLY
pre-attempt channel that ever carries the answer**. Withdrawing it turns the
item into a genuine **retrieval probe** — which is what fact FLUENCY exists to
measure. Corollary: at `hard`, the silent `responseMs`/`meanResponseMs` signal
becomes true retrieval time, where at `easy` it partly measures echo delay of
a fact heard seconds earlier.

## What is NEVER withdrawn (and why)

| Kept at every tier | Reason |
|---|---|
| the **printed problem** on screen | it is the stimulus — withdrawing it would turn a read fact into a dictated one, a different task |
| the **correction's re-model** (plain AND contrastive) | standing gate 3: DISTAR always re-models on an error. Remediation is not scaffolding |
| the **restating affirm** ("Yes, two plus one is three.") | models the complete fact at the moment it is most useful |
| the **judging contract** | a tier changes how much help precedes the answer, never how it is judged — else tiers stop being comparable evidence |

## Bench-proven wording preserved

At `easy` (and absent tier) the composed spoken block is **byte-for-byte** the
`"${model} ${guide} ${test}"` string the #46 probe sitting validated — pinned
by the "absent tier behaves exactly as easy" test. `medium`/`hard` speak only
*subsets* of proven lines plus the proven ask; no new judged wording enters the
pack. The one new spoken-adjacent copy is the per-item `coldAnswerGuard`
(instruction to the tutor, inside the cue, never spoken) — the same shape as
the sibling's `coldReadGuard`.

## The tutor as a second scaffold channel (the tier gotcha)

Audited the whole catalog block; **unlike the sibling, no rewording was
needed**, and the audit note is recorded in `catalog/di.ts`:

- `scaffoldingLevels.level1` ("Repeat the question once, slowly.") repeats the
  QUESTION — the stimulus, already on screen — never the fact statement
  carrying the answer. Tier-safe as-is (the sibling's level 1 re-read the
  withheld TARGET and had to change).
- Levels 2–3 and the fact-modeling `commonStruggles` all describe post-attempt
  (or non-attempt) remediation — correction territory, which re-models at
  every tier by design.

Three additions close the channel anyway:
1. **Per-item `coldAnswerGuard` in the cue** — authoritative, per item.
2. **`supportTier` as a catalog contextKey**, threaded through the connect
   payload, the `updateContext` sync, and `startDiRunLog` (a cold answer that
   leaks is only readable against the tier the run used).
3. **One clause appended to the LIVE-JUDGED directive** (mirrors the sibling's
   CONNECTED TEXT clause): when the quoted text is only the "Your turn" ask,
   the learner is answering cold on purpose — never say the fact or its answer
   first. Sentinel discipline re-checked on the new copy.

## Deliberate departure: no `tierSection` in the prompt

Same ruling as the sibling, same reason: under Fork A the model's only job is
the wrapper + a factScope hint, so a tier line in the prompt could only nudge
the FACT RANGE — tier→content leakage, i.e. structural difficulty through the
back door. Operand structure (within 5 → crossing five → crossing ten) is this
pack's structural axis and belongs to `/add-structural-difficulty` (L4). The
tier is 100% code-composed into the cue (`leadInFor` + `coldAnswerGuard`).

## Tester gap closed (family-wide)

`DirectInstructionPrimitivesTester` had **no difficulty control**, so neither
this ladder nor the sibling's queued #54(d) `hard` mic check was actually
drivable. Added a tier `<select>` (default / easy / medium / hard) that rides
the eval-test route's existing `?difficulty=` tap. This is what makes the
HUMAN-CHECKS rows below runnable.

## Verification

| Gate | Result |
|---|---|
| `typecheck:lumina` | **0 errors** (re-run after every file, incl. the tester) |
| full `tsc --noEmit` | **0 DI-surface errors** (803 pre-existing, all outside `components/lumina/`) |
| `npm test` | **1041/1041** (98 files, +14 new) |
| new suite `diMathFactsScript.support-tiers.test.ts` | **14/14** |
| non-vacuity probe | **5 tests fail** when `hard` is reverted to the full lead-in |
| **runtime — real pipeline** (dev server, eval-test route, real Gemini) | 3/3 probes pass |

The three runtime probes (beyond what the sibling's slice machine-verified):
1. `answer_fact` + `difficulty=hard` → **all 5 challenges `supportTier:'hard'`**,
   every answer within the objective's scope (tier never touched the numbers).
2. `mixed` + `difficulty=medium` → the SP-21 four-identity interleave and
   **every challenge got the tier** — the "gate only on tier presence, never on
   a pinned mode" rule confirmed live (the silent no-op this layer exists to
   kill).
3. No `difficulty` param → **no `supportTier` field at all** — pre-L3 sessions
   are byte-compatible.

The strongest unit test is *"hard NEVER puts the ANSWER in the spoken block"* —
it asserts the answer word is absent from everything the tutor may say while
still present in the judging contract. It is one of the 5 that fails under the
non-vacuity probe.

## Ladder position

L0 → L1 → L2 → **L3 (tiered)**. `/add-structural-difficulty` (L4) is now
unblocked and rides this harness; its axis is already designed on the birth
cert (operand structure within 5 → within 10 crossing five → within 20
crossing ten, plus missing-addend as a separate identity, not a tier).

**Live behaviour is UNVERIFIED with a mic.** The `hard` cold answer is the
highest-value thing to hear — it is the only tier that changes what the tutor
says at the moment that matters, and the first time any DI math item is a pure
retrieval probe. Folded into HUMAN-CHECKS **#50(d)** (rides the same
deliberately-wrong sitting as (b)'s homophone stress).
