# HANDOFF — DI family: stop discarding the wrong answer, feed the misconception loop

**Queue item:** `qa/di/BACKLOG.md` item 1 (FAMILY-WIDE, top of queue)
**Owning stream:** WORKSTREAMS ACTIVE #2 — Direct Instruction primitive family
**Executors:** `/primitive` follow-up (component + engine slice) → `/eval-test` → `/misconception-test`
**Opened:** 2026-07-25 (`/pm`), answering the user's *"so you won't see an incorrect in the logs?"*
**Handoff written:** 2026-07-25 (`/pm`), after a line-exact read of both sides

---

## Outcome

A DI session where a child answers wrong produces a **stored, generative misconception** —
one sentence in student-model form, keyed to the pack, usable as a design spec for the next
problem. Today it produces `{correct: false, score: 0}` and nothing else.

Concretely, the currently-impossible artifact: a child misses `5 − 1` twice saying *"four"*
both times → the loop stores something like *"The student counts up from the first number
instead of back, so subtraction returns the successor."* That is a diagnosable, remediable
misconception, and DI already has every input needed to produce it.

---

## The ruling: YES — use the frontend misconception system. Do NOT invent a bag.

**The BACKLOG item's stated fix shape is superseded by this handoff.** It said:

> Fix shape: accumulate per-attempt `{text, judgment}` into the outcome and ship it in the
> evaluation payload's **non-metric bag**.

That would work and produce nothing. The non-metric bag (`studentWork`, 4th arg of
`submitResult`) is inert storage — no consumer reads it for diagnosis. There is already a
purpose-built, shipped channel: **`diagnosisEvidence`**, the Misconception Loop's S1 contract.

The accumulation half of the BACKLOG item is still exactly right. Only the destination changes.

**Why DI is the best possible producer for this loop — and why it is currently invisible to it:**

The loop grades evidence by tier (`evaluation/diagnosis/types.ts:18-27`):

| Tier | Requires | Meaning |
|---|---|---|
| **A `judge`** | `judgeFeedback` present | *"a judge already explained why the work fell short. **Highest fidelity.**"* |
| **B `structured`** | `expected` + `observed` | a mechanical primitive stating both precisely |
| **C `none`** | neither | engine abstains, no write |

DI is the family the judge tier was written for: **the Live tutor judges the audio in-band and
speaks its judgment.** No other primitive family has a real judge articulating the failure in
natural language at the moment it happens. And since the 2026-07-25 contrastive-correction
ruling, that spoken judgment **names the error** (`My turn: not ⟨what they said⟩ — <correct
form>`) instead of blandly re-modelling — so the tutor's own sentence became diagnostically
rich *this week*. That timing is why this item is worth pulling now rather than later.

Yet **no DI pack reaches the loop at all.** `captureMisconception` gate 3
(`captureMisconception.ts:62-64`):

```ts
const scope = getComponentById(primitiveType)?.misconceptionScope;
if (!scope) return null;
```

`misconceptionScope` is declared in `catalog/literacy.ts` (7 primitives) and `catalog/math.ts`
(3). **`catalog/di.ts` declares none** — so even if evidence existed, every DI submission is
dropped before the distiller. Two independent gates must open: the declaration, and the packet.

---

## Two data-loss points, not one

The BACKLOG item found the first. The second is upstream and is what separates Tier B from
Tier A — **the engine computes the tutor's judging sentence, classifies it, and then throws
the sentence away.**

### Loss 1 — the component drops what the CHILD said

The engine DOES emit it. `hooks/judgedLoopModel.ts:163-171`:

```ts
| {
    kind: 'attempt-transcript';
    attempt: LoopAttempt;
    text: string;          // ← the heard answer
    responseMs: number | null;
    commitLagMs: number;
  }
```

All four packs keep the timing and drop the words — **byte-identical in every pack**:

| Pack | Line |
|---|---|
| `DiLetterSounds.tsx` | `259-261` |
| `DiWordReading.tsx` | `275-277` |
| `DiMathFacts.tsx` | `392-394` |
| `DiSentenceReading.tsx` | `434-436` |

```ts
case 'attempt-transcript':
  lastResponseMsRef.current = emission.responseMs;   // emission.text discarded
  return;
```

…and the outcome push that follows carries no transcript (`DiMathFacts.tsx:333-336` /
`357-360`, and the parallel pairs in the other three).

### Loss 2 — the ENGINE drops what the TUTOR said (this one buys Tier A)

`hooks/judgedLoopModel.ts:252-255`:

```ts
const verdictText = `${state.verdictText} ${event.text}`;
const scan = scanForSentinel(verdictText, config.sentinels);
if (scan) {
  emissions.push({ kind: 'verdict', judgment: scan, attempt: state.attempt, misses: 0 });
  //                                ↑ only the classification survives; verdictText is dropped
}
```

The verdict emission (`:173`) carries `judgment: LoopJudgment` — `'affirmed' | 'corrected' |
…` — and no text. So the component learns THAT the tutor corrected, never *what it said*.
**With contrastive correction live, that discarded sentence contains the diagnosis** ("not the
pot"; "not one"). Recovering it is a one-field additive change and is the difference between
a Tier-B guess and a Tier-A packet.

---

## Worked template — `PhonicsBlender.tsx:540-566`

Do not design this from scratch. PhonicsBlender is a spoken, judge-driven literacy primitive
that already does exactly this, and DI's shape is a superset of it:

```ts
// Misconception Loop S1 — Tier-A evidence packet on failed sessions. The
// judge already articulated the failure (judgeFeedback present ⇒ Tier A);
// earlier fails become priorAttempts, the consistency signal the distiller needs.
const fails = failedVerdictsRef.current;
const latest = fails[fails.length - 1];
const diagnosisEvidence: DiagnosisEvidence | undefined = !success && latest ? {
  challengeSummary: `Blend the spoken phonemes into the word "${latest.word}" …`,
  expected: `Say the blended word "${latest.word}".`,
  observed: `Student said: "${latest.heard}".`,
  judgeFeedback: latest.judgeFeedback,
  priorAttempts: fails.slice(0, -1).map(f => ({ … })),
} : undefined;

submitEvaluation(success, accuracy, metrics, { …studentWork }, undefined, diagnosisEvidence);
```

Note `priorAttempts` (`diagnosis/types.ts:40-45`) — *"the single most important signal for
telling a consistent mental model apart from a one-off slip."* **This is literally the
user's "said 'four' both times."** DI's per-item retry loop (up to the 2-correction cap)
produces it natively; no other family gets same-item retries this cleanly.

---

## Steps

**1. Engine — expose the verdict sentence** (`hooks/judgedLoopModel.ts`)
Add an optional field to the verdict emission at `:173` (e.g. `verdictText?: string`) and
populate it at `:255` from the `verdictText` already computed on the line above. Additive
only — existing consumers ignore it. Do the same at `:287` (`off-script`) only if trivial;
`no-verdict` (`:308`) has no tutor sentence by definition.
**This is `hooks/` — shared by all four packs. Keep it purely additive; changing the existing
emission shape is out of scope.**

**2. Components — accumulate, don't drop** (all four packs, same edit)
Keep `emission.text` at the `attempt-transcript` case; on a `corrected` verdict push
`{ challenge, observed, judgeFeedback }` onto a `failedAttemptsRef`. Mirror PhonicsBlender's
`failedVerdictsRef` naming so the pattern is greppable across families.

**3. Build the packet at submit** (`finishAndSubmit`, e.g. `DiMathFacts.tsx:262-300`)
Assemble `diagnosisEvidence` on failure only, then pass it as the **6th** arg of
`submitResult` — note the current call passes 4 args (`:295-300`), so `partialCredit` must be
`undefined` in the 5th slot (`usePrimitiveEvaluation.ts:228-237`).

**4. Declare `misconceptionScope` in `catalog/di.ts`** — see the decision below. Without it
steps 1-3 are dead code.

**5. Record the scope ruling** in the pack birth certs and this handoff's queue entry.

---

## The one design decision: which scope?

PRD §5 rev-2 (`docs/PRD_MISCONCEPTION_LOOP.md:104-118`):

- **`'primitive'`** — *"the interaction model is itself the concept (narrow manipulatives …
  true across subskills)"*. Identity = `primitive_type` alone; **needs no curriculum anchor**.
- **`'skill'`** — *"the primitive is a content-generic delivery vehicle (KnowledgeCheck,
  MultipleChoice)"*. Identity = `(primitive_type, canonical skill_id)`; **requires an anchor
  at delivery**.

**Recommendation: `'primitive'` for all four packs.** They are the opposite of content-generic
delivery vehicles — each is a hand-authored DISTAR script for one response class. It also
survives the standalone tester, where the subskill is unreliable (the 2026-07-21 run showed
the runtime Gemini re-mapper landing on a different subskill than the birth-cert home), and
skill scope would gate those runs out entirely.

**⚠ Risk the executing session must record, not skip — `di-math-facts` has 4 task identities
under one primitive_type.** Primitive scope stores ONE misconception per pack per student, so
a diagnosis earned on `subtraction_fact` ("counts up instead of back") would also be offered
on `counting_next`, **where counting up is the correct move.** Eval modes here are task
identities, not difficulty tiers, so this is a genuine cross-identity leak, not a pedantic one.

Mitigation that does not require a scope change: put `challengeType` into `challengeSummary`
so the distilled sentence is **self-limiting** ("when subtracting, the student…"), letting
S5/S7 consumption apply it narrowly even though the identity key is coarse. If that proves
insufficient, the escalation is a PRD amendment (identity += declared eval-mode family), NOT
quietly flipping DI to `'skill'` — skill scope would break the standalone path above.
di-sentence-reading carries a milder version of the same tension (4 modes, but all "read this
sentence aloud", so a misconception genuinely does transfer).

---

## Verification

Per the doctrine — **tsc is not verification of behavior here.**

- `typecheck:lumina` 0 + full vitest green (engine suite `judgedLoopModel.test.ts` and
  `diCorrectionContrast.test.ts` 15/15 must both stay green — step 1 touches their subject).
- Unit-cover the packet build: a failed run yields `classifyEvidenceTier(evidence) === 'judge'`
  (**not `'structured'`** — if it comes back structured, step 1 didn't land) and `priorAttempts`
  holds the earlier miss. Prove non-vacuity: revert step 1, assert the tier drops to `structured`.
- **`/misconception-test di-math-facts`** — the skill exists for exactly this question ("does
  the diagnosis loop close for one primitive?"). This is the real gate.
- **Runtime:** the loop only closes on a WRONG answer, and no DI pack has ever been driven to
  a wrong answer. See sequencing.

---

## Sequencing — land this BEFORE the mic sitting

HUMAN-CHECKS **#54 + #50 + #55** ride one mic run answering **wrong on purpose**. That run is
the **first deliberately-wrong DI session ever driven** — five consecutive all-correct sittings
mean `[DI_MOVE_ON]` has never fired in any pack.

Land this item first and that sitting produces the family's first *recorded* wrong-answer
evidence — transcripts, judge sentences, a real distiller call — instead of ears-only notes.
Run it in the other order and the same evidence is spoken once and gone, and you need a second
sitting to get it back.

---

## Do-nots

- **Don't ship the transcript into the non-metric bag** — that's the superseded shape; it
  stores words nothing reads.
- **Don't let the packet reach the student.** `misconceptionText` is *"a design spec for the
  NEXT problem — never feedback for the student"* (`diagnosis/types.ts:80-84`). DI's judged
  loop is the one family where a stray write to a status line would be *spoken aloud*.
- **Don't re-word any cue, judging contract, or correction line.** Bench-proven copy is
  byte-frozen; the contrastive rewording is already UNBENCHED pending #55. This item reads
  the tutor's output, it never changes it.
- **Don't diagnose in the primitive.** *"Primitives supply evidence; they never diagnose"*
  (`diagnosis/types.ts:5-8`). Ship `observed` + `judgeFeedback`; the shared distiller decides,
  and an honest abstain is success.
- **Don't skip the abstain path** — weak evidence writing nothing is the designed behavior,
  not a bug to code around.

---

## Source map

| What | Where |
|---|---|
| Evidence contract + tiers | `src/components/lumina/evaluation/diagnosis/types.ts:18-70` |
| Capture hook + the 4 gates | `src/components/lumina/evaluation/diagnosis/captureMisconception.ts:48-124` |
| `diagnosisEvidence` on the result | `src/components/lumina/evaluation/types.ts:86` |
| `submitResult` signature (6th param) | `src/components/lumina/evaluation/hooks/usePrimitiveEvaluation.ts:228-237` |
| Worked Tier-A template | `src/components/lumina/primitives/visual-primitives/literacy/PhonicsBlender.tsx:540-566` |
| Engine emissions | `src/components/lumina/hooks/judgedLoopModel.ts:160-175`, verdict build `:252-255` |
| DI drop points | `Di{LetterSounds:259,WordReading:275,MathFacts:392,SentenceReading:434}.tsx` |
| DI submit path | `DiMathFacts.tsx:262-300` (+ siblings) |
| Scope ruling (rev 2) | `src/components/lumina/docs/PRD_MISCONCEPTION_LOOP.md:104-118` |
| Who declares scope today | `catalog/literacy.ts` ×7, `catalog/math.ts` ×3, `catalog/di.ts` **×0** |
