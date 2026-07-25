# di-sentence-reading — L3 support tiers (2026-07-25)

Birth-cert follow-up **#3 struck**. The pack is now L0 → L1 → L2 → L3, all on
its birth day.

## Archetype and lever discovery

The pack fits **none** of the skill's six archetypes — it is a *live-judged
spoken production* primitive where the Live tutor IS the interaction surface. It
has **zero `showOptions`**, no visual scaffolds, and no per-challenge display
fields, so the P1 perception-aid family (the skill's usual lead) does not exist
here at all.

That makes it the **AngleWorkshop case**: the entire ladder is modality **#2,
instruction-as-scaffold** — which the skill calls the highest-leverage, cheapest,
most generalizable family, and the proof that a primitive needs no visual levers
to earn a real ladder.

And the sub-steps were already present. **DISTAR's model → guide → test IS a
scaffold ladder**; a tier simply hands the child fewer of its steps:

| Tier | Spoken cue | What the child must do |
|---|---|---|
| **easy** | `Listen: X` + `Together: X` + `Your turn. Read it.` | read after hearing it twice (the L0 shape) |
| **medium** | `Listen: X` + `Your turn. Read it.` | read alone after hearing it once |
| **hard** | `Your turn. Read it.` | **decode the print COLD, never having heard it** |

The withdrawal is identical across all four eval modes, and that is correct
rather than lazy: every mode is the same act (read this printed sentence aloud),
so the same three sub-steps precede it. A **mode** changes which sentences are
drawn; a **tier** changes how much of the sequence is handed over.
`resolveSupportStructure` is kept per-type-capable so a future mode can diverge.

## Why `hard` matters — it closes the birth audit's open caveat

The L0 answer-leak audit recorded one caveat it could not resolve at birth: the
model line speaks the sentence aloud before the child reads it. That is
legitimate DI instruction rather than a leak (the measured production is the
independent read at the TEST step) — but it does leave an **echo route** open: a
child could repeat what they just heard rather than decode.

At `hard` there is no echo route. The tutor is given nothing to say but the ask,
and the sentence never enters the block it is permitted to speak. **This is the
tier the birth certificate predicted would close that caveat, and it does.**

## What is NEVER withdrawn (and why)

| Kept at every tier | Reason |
|---|---|
| the **printed sentence** on screen | it is the manipulable object — withdrawing it turns reading into listen-and-repeat, a different task ([[feedback_direct-manipulation-first]]) |
| the **correction's re-model** | standing gate 3: DISTAR always re-models on an error. Remediation is not scaffolding |
| the **restating affirm** | bench sitting question (c), settled with evidence — it models the correct reading when it is most useful |
| the **judging contract** | a tier changes how much help precedes the read, never how the read is judged. If this drifted the tiers would stop being comparable evidence |

## The tutor as a second scaffold channel (the tier gotcha)

A tier hidden on screen but revealed by the tutor is only half applied. This
pack had exactly that hole, in its own idiom — **the L2 `scaffoldingLevels`
level 1 said *"Read the sentence once more, slowly."*, which at `hard` would have
read aloud the very sentence the tier withheld.** Fixed three ways:

1. **Level 1 reworded** to `"Ask for one more try, unhurried."` Levels 2 and 3
   are safe unchanged, because they describe what happens AFTER an attempt, and
   a correction re-models at every tier by design.
2. **A per-item cold-read guard in the cue** (`coldReadGuard`) — authoritative
   and per-item, stronger than relying on the omission alone.
3. **`supportTier` added as a catalog contextKey**, threaded through the connect
   payload and the `updateContext` sync, so the tutor's RUNTIME STATE knows
   which tier it is speaking at.

## Deliberate departure: no `tierSection` in the prompt

The skill's Phase 3 says inject `${tierSection}` into the generator prompt. This
pack deliberately does **not**, and the reason is the one hard rule itself:
under Fork A the model's only job is picking sentence ids, so a tier line in the
prompt could do exactly one thing — **nudge it toward different SENTENCES**.
That is tier→content leakage, i.e. structural difficulty through the back door.
Sentence LENGTH is this pack's structural axis and belongs to
`/add-structural-difficulty`. The tier is 100% code-composed into the cue.

## Verification

| Gate | Result |
|---|---|
| `typecheck:lumina` | **0 errors** |
| full `tsc --noEmit` | **0 Lumina-surface errors** |
| `npm test` | **949/949** (89 files, +13 new) |
| new suite `diSentenceReadingScript.support-tiers.test.ts` | **13/13** |
| non-vacuity probe | **5 tests fail** when the tier logic is reverted |

The strongest test is *"hard NEVER puts the sentence in the spoken block"* — it
asserts the target is absent from everything the tutor may say while still
present in the judging contract, which is the precise shape of the tier. It is
one of the 5 that fails under the probe.

### A correction to my own L0 note

The L0 eval report recorded that "session content is stable across repeat runs
on the same objective" (structured-output convergence), based on three generic
runs that came back near-identical. **That is no longer accurate** after L1: a
same-tier control of three runs returned three different sentence sets. The L1
selection path (mode pools, benched back-fill, the review shuffle) introduced
real run-to-run variety. Good news, and it retires the convergence concern the
L0 report queued for `sentence_review`.

That control also corrected a **bad assertion of mine** during this layer's QA:
I first tried to prove "a tier never changes the numbers" by diffing generated
content across easy/med/hard, and it flagged a violation. It cannot work —
comparing separate generation calls cannot isolate a tier's effect when the call
itself is nondeterministic. The rule is established structurally instead (tier
applied post-selection, assigns one field, no prompt injection), corroborated by
`decodable_sentence` returning byte-identical sets at medium and hard, and
pinned by the unit tests.

## Ladder position

L0 → L1 → L2 → **L3 (tiered)**. `/add-structural-difficulty` (L4) is now
unblocked and rides this harness. Its axis is already built and measured:
**sentence LENGTH** (3-8 words), carried per challenge as `wordCount` and per
session as `meanSentenceWords`. Hard constraint for that layer: **the 8-word
benched ceiling is not a difficulty knob** — raising it needs a new bench
sitting, not an L4 decision.

**Live behaviour is UNVERIFIED with a mic.** The `hard` cold-read is the
highest-value thing to hear, since it is the only tier that changes what the
tutor says at the moment that matters. Folds into HUMAN-CHECKS **#54**.
