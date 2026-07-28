# Misconception Test: di-math-facts (DI family) — 2026-07-25

**Gate: PARTIAL — the PRODUCTION half closes; the CONSUMPTION half (S5) is NOT-WIRED.**

Run against the slice that landed `qa/HANDOFF-di-misconception-evidence-2026-07-25.md`
(engine `verdictText` + `verdict-text`, per-pack evidence accumulation,
`misconceptionScope: 'primitive'` ×4). Before it, no DI pack reached the loop at
all: the components dropped the transcript, the engine dropped the tutor's
sentence, and `catalog/di.ts` declared no scope, so gate 3 dropped every DI
submission before the distiller.

## Phase 0 — Wiring inventory

| # | Station | di-math-facts | Note |
|---|---|---|---|
| 1 | Catalog `misconceptionScope` | ✅ `'primitive'` | family ruling, all 4 packs |
| 2 | Component evidence → 6th arg | ✅ | `diDiagnosisEvidence.ts`, shared by all 4 packs |
| 3 | Generator `buildRemediationPrompt` + move enum | ❌ **NOT-WIRED** | no DI generator imports it |
| 4 | Golden scenarios | ✅ 5 added | 3 generative + 2 abstain, all Tier A |
| 5 | Round-trip pytest coverage | ✅ added | primitive-scoped + sibling + weak-submit |

Station 3 is a genuinely separate layer and was correctly outside the handoff's
scope — see "What is NOT closed" below.

## Verdicts

| Probe | Case | Verdict | Evidence (one line) |
|-------|------|---------|---------------------|
| D | di-math-facts-successor-for-subtraction | **GENERATIVE** | "treats subtraction by one as addition by one, providing the number that comes after" — 2/2 draws, high/judge |
| D | di-math-facts-echoes-last-number | **GENERATIVE** | "responds to addition problems by stating only the second addend" — 2/2 draws, high/judge |
| D | di-letter-sounds-name-for-sound | **GENERATIVE** | "provides the letter name instead of the letter sound" — 2/2 draws, high/judge |
| D | di-math-facts-single-fact-slip | **ABSTAINED** | "only a single attempt with no corroborating pattern" — 2/2 draws |
| D | di-sentence-reading-mixed-misreads | **ABSTAINED** | "isolated slip rather than a consistent wrong rule" — 2/2 draws |
| G | di-math-facts (any mode) | **NOT-WIRED** | no `buildRemediationPrompt` in any DI generator; not probed (skill: never probe an unwired primitive) |
| R | journey + scope matrix | **CLOSED** | pytest **9/9**, incl. the new DI case |
| R | S4 Firestore exposure | **pass** | `misconceptionKey: "di-math-facts"` — primitive scope, no skill suffix |

**10/10 Probe D draws matched expectation. 0 LEAK, 0 OVERREACH, 0 VAGUE.**

## What Probe D actually proved

Three things worth recording, because each was a live risk of this design:

1. **Every packet landed at `tier=judge` (Tier A), including the abstains.** That
   is the whole premise of the handoff: DI is the family the judge tier was
   written for, and the evidence now carries the tutor's own sentence.

2. **Tier A did not become a licence to overreach.** The two abstain scenarios
   are Tier-A packets — `judgeFeedback` present, a real correction line — and
   the distiller still declined on both, twice each, with honest reasons
   ("previously read the word 'a' correctly… an isolated slip"). A distiller
   that treated the presence of a judge as proof of a rule would have been the
   most likely failure mode of this slice. It doesn't.

3. **The cross-identity mitigation works at the sentence level.** `di-math-facts`
   has four task identities under one primitive-scoped key, so a subtraction
   diagnosis could be offered on `counting_next` where counting up is CORRECT.
   Both draws came back bounded by the task — *"treats **subtraction by one**
   as addition by one"*, *"responds to **addition problems**"* — never the
   unbounded "the student counts up". That is the `challengeSummary` task-identity
   prefix doing its job, and it is the reason the scope ruling can stay
   `'primitive'` without a PRD amendment for now.

## What is NOT closed

- **S5 / Probe G — remediation generation. NOT-WIRED, queued, not improvised.**
  No DI generator consumes `remediationFocus`, so a stored diagnosis currently
  changes nothing about the next session. This is a real design question rather
  than a missing import: DI's spoken copy is **bench-proven and byte-frozen**, so
  remediation cannot reword cues the way a literacy generator rewords a prompt —
  the only honest lever is *which facts the pool draws*. Deciding that lever is
  `/add-misconception-loop`'s job, not this slice's.
- **S1 live capture — browser-owned, as always.** Probes cannot reach the
  component's own capture path. Unit-covered instead
  (`DiMathFacts.misconception-evidence.test.tsx`, 11/11, non-vacuity proven),
  but the real thing needs a mic sitting — and per the handoff's sequencing note
  that sitting is HUMAN-CHECKS #54/#50/#55, which is the **first deliberately
  wrong DI session ever driven**. With this landed it now produces recorded
  evidence instead of ears-only notes.
- **Probe D scenarios are hand-authored packets, not runtime output.** They are
  byte-shaped to what `diDiagnosisEvidence.ts` builds (challengeSummary and
  observed wording copied from the source), so they regress the real contract —
  but the first genuine end-to-end proof is still the mic sitting.

## Distiller handoff

Probe G would have run on Probe D's actual output. Kept for when S5 lands:

> "When subtracting one, the student says the number that comes after the given
> number instead of before it."

## Verification

`typecheck:lumina` **0** · vitest **985/985** (92 files; was 964 — 21 new, and
`diCorrectionContrast.test.ts` 15/15 still green) · backend
`test_misconception_round_trip.py` **9/9** · S4 Firestore probe **pass**.
