# HANDOFF — `open_set_word`: unblock spoken PRODUCTION

**Opened:** 2026-08-18, by user directive.
**Executor:** bench first (no skill), then `/add-di-loop rhyme-studio` for the pilot.
**Owning queue:** `qa/di/BACKLOG.md` — file as item 24.
**Status:** SCOPED, not started.

---

## 1. The user directive, verbatim — it is the design

> *"we need to trust the ai model to hear the answer and judge correctly, then wire the
> primitive on if it agrees? we dont need a full schema but we do need to specify the
> problem and allow the ai to judge and impact the screen."*

> *"agree with you on rhyme studio we shouldnt need an answer bank for synthesis, trust
> the model."*

Two rulings, and they are the whole architecture:

1. **Specify the PROBLEM, not the ANSWER SET.** Every shipped response class hands the
   judge an enumerated target — one word, or a printed menu of N choices. This class hands
   it a **rule** ("a real word that rhymes with *hat*") and asks it to decide whether the
   utterance satisfies the rule. No schema of valid answers.
2. **The verdict drives the screen.** The judge's affirmation is what advances the loop —
   the same sentinel scan every pack already uses. Nothing new in the transport.

---

## 2. Why this is the ceiling of the whole modality

`judgedScriptContract.ts` carries twelve response classes. Eleven are `benched` or
`accepted-build-ahead`. **One is `blocked`**, and its evidence line is four words:
*"Open-set production has no bench."*

That block is cited as the reason for a tap, a word bank, or a printed menu in **eleven
shipped packs**:

| Primitive | The ask it cannot make today |
|---|---|
| `rhyme-studio` | generate a rhyme — the word bank exists ONLY to dodge this |
| `picture-vocabulary` | name the picture (code: *"PRODUCTION would be open_set_word — that is why it taps"*) |
| `word-builder` | *"tele means far. So what does telescope mean?"* |
| `addition-subtraction-scene` | tell the whole story |
| `knowledge-check` | 2 of its item kinds (already queued as item 23 slice 2b) |
| `decodable-reader` · `genre-explorer` · `sentence-analyzer` · `text-structure-analyzer` · `story-talk` · `di-spoken-practice` | free propositions |

**Every judged port shipped to date is RECOGNITION.** Picking "cat" off a menu and
generating a rhyme for "hat" are different learning events; the product can currently only
measure the first. This is a Bloom tier jump, not a coverage increase.

**The user's own rulings have been pointing here three times.** rhyme-studio (*"weird to
need the thumbs up and thumbs down"*), letter-spotter (*"they dont need to click a
button"*), decodable-reader (*"i need to click on the button even though im speaking"*).
Each was resolved with `closed_set_choice` — *say which one* — **and the menu stayed on
screen.** `open_set_word` is the version with no menu, which is what all three were
reaching for.

---

## 3. The design

### 3.1 What replaces the answer schema

A pack item today carries an enumerated target. An open-set item carries a **problem
specification** — the constraint, plus what makes an answer wrong, in the tutor's own cue
language. Sketch (name the fields in the bench, not here — this shape is a proposal, and
the bench is what ratifies it):

```
{
  id: 'rhyme-hat',
  answerKind: 'voice',
  responseClass: 'open_set_word',
  // NOT: word: 'cat' | choices: [...]
  problem: {
    rule:        'a real English word that rhymes with "hat"',
    satisfiedBy: 'shares the /æt/ rime and is a real word',
    violatedBy: [
      'the stimulus word itself ("hat")',
      'a nonword ("zat")',
      'a word that shares only the onset ("hop")',
    ],
  },
}
```

**The judge is told the rule and asked for a verdict.** It is not handed a list to match
against. That is the entire difference from `closed_set_choice`, and it is the thing the
bench must measure.

### 3.2 What does NOT change

- The transport. `useJudgedScriptRunner` + the sentinel scan are untouched — the tutor's
  affirmation still advances the loop, the pack still declares the stimulus gate,
  stillness window and reveal hold. **Do not hand-roll any of those** (19c+18b, closed).
- Open-mic doctrine. No force-mutes, no advance timers. The tutor owns the clock.
- `manipulation` items, gesture rules, `audioInput` declaration.

### 3.3 The honest risk, stated up front

Every shipped class is safe because of **closed-set arithmetic**: the judge is handed the
exact choices and told which is right, so it classifies rather than evaluates. Remove the
menu and that argument is gone. Open-set judging is genuinely harder, and the failure mode
is **false affirmation** — the judge accepting a nonword, the stimulus echoed back, or an
onset match. A child who says "hat" back and is told "Yes!" has been taught the wrong
thing, which is a pedagogy failure, not a UX one.

**This is why the bench comes before any wiring** (standing gate 1), and why the bench is
weighted toward the wrong answers.

---

## 4. The bench — machine-first, and that is what makes this cheap now

Standing gate 1 demands a bench sitting per new class. That used to mean mic time.
**`/tutor-test --di` drives the judged loop headlessly**, so the judge's semantics are
machine-testable before a child ever speaks.

**Build a synthetic answer set per stimulus and score verdicts against a key.** For
`rhyme-studio` with stimulus *hat*, at minimum:

| Bucket | Examples | Expected verdict |
|---|---|---|
| valid rhyme, common | cat, bat, mat, sat | AFFIRM |
| valid rhyme, less common | vat, gnat | AFFIRM |
| **the stimulus echoed** | hat | **REFUSE** |
| **nonword with the right rime** | zat, glat | **REFUSE** |
| onset match only | hop, hit, ham | REFUSE |
| semantic neighbour | cap, coat | REFUSE |
| near-rime / slant | hack, hand | REFUSE (record disagreement) |
| silence / off-task | *(nothing)*, "I don't know" | REFUSE, no false affirm |

**Gate to clear before wiring:** zero false affirmations in the REFUSE buckets across the
run. A missed valid rhyme is a lesser fault (the child gets another turn); a false
affirmation teaches the error. **Weight the gate accordingly — they are not symmetric.**

Run it over ≥3 stimuli with different rimes, not just *hat*, so the result is a class
verdict rather than one lucky rime. Record the run at `qa/di/` and cite it in the class's
`evidence` field — replacing the *"has no bench"* line.

---

## 5. The pilot — `rhyme-studio`, and delete the bank

**Why this primitive:** its word bank exists *purely* as the workaround for this block —
`rhymeStudioScript.ts:10` says so in as many words. Deleting the bank IS the proof the
class works. It is also the most-worked primitive on the board (five queues), so the
contract is well understood.

**Read first:** `docs/contracts/rhyme-studio.md` if it exists, and run
`/primitive-contract rhyme-studio --check` before the edit. The bank may be load-bearing
for a mode other than synthesis — **`rhyme_hunt` (K) is recognition and must keep whatever
it needs.** If synthesis and recognition disagree, fork per the contract system; do not
edit in place over a conflict.

**The scope is synthesis only.** Do not sweep the other ten primitives in this slice —
pilot-then-sweep. They queue behind the pilot's live probe.

---

## 6. Gates before this is "done"

1. `judgedScriptContract.ts` — `open_set_word` status moved off `blocked` with a real
   `evidence` pointer and `notes` naming what a pack must do that the class cannot (the
   echo guard and the nonword guard, at minimum). Follow the `closed_set_choice` record as
   the format precedent.
2. Bench run recorded, zero false affirmations in the REFUSE buckets.
3. `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` — zero NEW errors vs
   baseline. Project-local binary, absolute path.
4. `npm run typecheck:lumina` → 0.
5. Vitest green, including the existing guard
   `RhymeStudio.di-script.test.ts:146` — *"would REFUSE a free-production item —
   open_set_word is still blocked"*. **That test asserts the block. It must be rewritten,
   not deleted** — it becomes the test that the class is wired and the echo/nonword guards
   refuse.
6. A live generation probe through the real lesson path (not the tester).
7. A HUMAN-CHECKS mic row — **re-grep for the next free ID immediately before filing**;
   IDs move. (`#112` was taken 2026-08-18; a collision at `#106` had to be repaired the
   same day.)

---

## 7. What this unblocks next, in priority order

Once the class is `benched` (or `accepted-build-ahead` on a user ruling), these stop being
blocked. **Queue them; do not batch them into the pilot:**

1. `picture-vocabulary` — the tap becomes a name-it. Highest pedagogical delta: naming a
   picture aloud is the canonical vocabulary assessment.
2. `word-builder` — morphology production (*"what does telescope mean?"*).
3. `knowledge-check` slice 2b — the 2 remaining item kinds, closing the cross-cutting port.
4. `addition-subtraction-scene` — full story retell.
5. The remaining six proposition packs.

---

## 8. Do not re-derive

- **ROUTE / CONVERT / LEAVE was REJECTED.** Do not re-open it.
- **The tutor owns the clock.** No advance timers survive a port.
- **DI is spoken-first.** A blocked class is not a licence to add buttons — that ruling is
  what created this item.
- **The runner owns the stimulus gate, stillness window and reveal hold.** DECLARE them.
