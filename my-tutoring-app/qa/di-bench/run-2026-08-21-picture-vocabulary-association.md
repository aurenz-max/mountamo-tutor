# DI Bench run — 2026-08-21 · `picture-vocabulary` / `association`

**Gates 7 and 8 of `qa/di/BACKLOG.md` item 26.** Machine work only; HUMAN-CHECKS #118 is
untouched and stays OPEN. Stack was already up (backend `:8000`, frontend `:3000`) — the
item's "BLOCKED on a running stack" state was stale, not a real dependency.

This benched the **PACK**, not the class. `open_set_word` was benched on 2026-08-19
(rhyme-studio) and nothing here reopens that. Three of this pack's six guards are new.

---

## VERDICT

| Gate | Result |
|---|---|
| **7 — the bench run** | ⛔ **FAIL.** 39/48 agreed, **7 false affirmations**, all in ONE bucket |
| **8 — `--di-wrong signature` drive** | ✅ **PASS.** The new scripted echo branch fired 5/5 with the sentinel |
| **8 — `--di` plain drive** | ✅ **PASS.** 16 beats, zero findings at any severity |

**The mode does not ship on this run.** One guard failed totally; every other guard held.

---

## Gate 7 — the numbers

48 probes, 4 stimuli × 12, four relation types. Evidence:
`run-2026-08-21-picture-vocabulary-association-console.txt` (beside this file — see I2
below for why the harness's own report is not the evidence).

| Bucket | Agreed | |
|---|---|---|
| partner | **4/4** | |
| partner-unlisted | **8/8** | ⭐ the §2.2 ruling held perfectly |
| echo | **4/4** | the new scripted branch |
| category-word | **4/4** | the new scripted branch |
| nonword | **4/4** | |
| off-task | **8/8** | |
| rationalised-chain | **7/8** | the 1 miss is `mailman`, filed `soft` — recorded, not counted |
| **same-category** | **0/8** | **7 hard false affirms** + `bowl` (`soft`) |
| **total** | **39/48** | **7 false affirmations · 0 false refusals** |

Affirmed when they should have been refused: `shirt` and `hat` (sock), `cat` and `bird`
(dog), `chair` and `table` (bed), `mug` (cup). Every one drew the same line —
*"Yes, that goes with X — they belong together."*

**Zero false refusals is the other half of the result and it is not a footnote.** All 12
AFFIRM-side probes were accepted, including all eight *unlisted* partners — `foot`,
`drawer`, `leash`, `collar`, `blanket`, `sheet`, `saucer`, `tea`. The judge did NOT
re-close the set around its own generated pair, which was the §2.2 ruling's whole worry.

---

## ⭐ THE MECHANISM — the accept clause defeats the same-category guard, by construction

Not a judge that rationalised. A judge that applied the contract **as written**, where two
clauses are simultaneously true of the same word and no precedence is stated.

**Accept** (`pictureVocabularyScript.ts:578`):
> *"something you would find with it, use with it, or **keep with it** in ordinary life"* …
> *"Any such thing is correct, INCLUDING ONE YOU DID NOT THINK OF YOURSELF."*

**Guard** (`pictureVocabularyScript.ts:632`):
> *"Another member of that same group is not the answer either: being the same KIND of
> thing is not the same as going together."*

Socks **are** kept with shirts and hats — a drawer, a wardrobe, the laundry. Mugs are kept
with cups. Chairs stand with tables. *"Keep with it"* licenses co-membership almost
definitionally: things of the same kind are exactly the things most reliably stored
together. The accept clause is concrete and generous; the guard is one abstract sentence,
fourth of six, mid-paragraph. The generous clause won 8/8.

**And note WHICH guard survived.** `rationalised-chain` — the bucket the whole fixture was
weighted toward, the one predicted to fail — held **7/8**, including the sharpest probe in
the set (`moon` for dog, a real cultural association). The difference between the guard that
held and the guard that lost is not subtlety, it is **a worked counterexample**:

> rationalised-chain ships one — *"A cat goes with a sock because cats play with socks is a
> story, and that answer is wrong."*
> same-category ships none.

That is the transferable finding: **in an open-set contract, a guard stated as an
abstraction loses to an accept clause stated as an example.** It should be carried to the
remaining `open_set_word` packs (word-builder morphology, knowledge-check 2b, retell, the
six proposition packs) before they are written, not after they fail.

### The key was audited before this was believed

Per the handoff's instrument warning, and it holds:

- The mode teaches **complementary pairing** — its own opening frames it, *"a hammer goes
  with a nail."* Co-membership is a different relation.
- `mug` for `cup` is indefensible under any reading: a mug **is** a cup. That is the echo
  failure wearing a synonym.
- `cat` for `dog` blurs `association` into `opposite` — a *separate eval mode of this same
  primitive*. Affirming it makes two modes measure one thing.
- `shirt` for `sock` is the one genuinely arguable probe (you do dress in both). Discount
  both clothes probes and the bucket is still **0/6 hard**. The verdict does not turn on it.

**This is a product defect, not an instrument error.**

---

## Gate 8 — both drives PASS

**`--di-wrong signature`** (`qa/tutor-reports/picture-vocabulary-live-di-signature-2026-08-21.md`).
The signature wrong for `association` is `item.baseWord` — the stimulus said straight back —
so this is the only drive that reaches the new echo branch. It fired on **5/5** items:

> *"My turn: pillow cannot go with itself. A hammer goes with a nail. Your turn. Tell me
> somet…"*

Sentinel on every one, no `di-no-verdict`, no stall, `complete` reached. **Item 24's §5
defect did not recur** — the one that stalled 5 of 9 rhyme items before the branch existed,
and which removing the option cards was predicted to make *more* likely here.

**`--di` plain** (`...-di-plain-2026-08-21.md`). 16 beats, 5 items, **zero findings at any
severity.** The general correction fires on the nonword, the affirm on the partner.

---

## Three INSTRUMENT defects — do not read any of them as tutor failures

**I1 — `di-verdict-embellished` fires on every correctly-fired specific branch.**
`run_tutor_live.py:2418` sets `expected_line = item["correctionLine"]`, a single string. The
pack now has **three** correction branches; the plan surfaces only the general one
(`spans[len-1]`). So when echo or category-word correctly fires, the oracle diffs it against
the *general* line and reports "added 8 unscripted words."

Proven three ways, which is why it is filed against the harness and not the judge:

- Every one of the 8 bench WARNs sits on an `echo` or `category-word` probe — and those two
  buckets scored **4/4 and 4/4 agreed**. The verdicts were right.
- The signature drive reproduced it at **5/5**, same 8-word delta, zero HIGH findings.
- **The plain drive is the control**: same primitive, same oracle, same session shape, only
  the *general* branch firing — and it threw **no embellishment WARN at all**.

The handoff §5 predicted this consequence for pack *tests*. The oracle was missed. Fix:
carry the branch set, not one line, into `expected_line`.

**I2 — the bench report filename collides with a plain drive's, and the plain drive wins.**
`--di-bench` implies `--di` and leaves `--di-wrong` at its default, so it wrote
`picture-vocabulary-live-di-plain-2026-08-21.md` — and the gate-8 plain drive later that
session **silently overwrote it**. `grep -c bench-assoc` on that file is now `0`; the
48-probe matrix is gone from it. Nothing was lost here only because the console output was
captured and is preserved beside this record. A bench needs its own filename
(`…-di-bench-…`), or the next session runs a bench, runs a drive, and destroys its own
evidence without a word.

**I3 — rhyme vocabulary leaks into an association bench.** The harness prints
`VERDICT: FAIL - open_set_word stays blocked` and `2 slant-rhyme disagreement(s)`. Both are
wrong here: this benched a **pack**, the class is already benched, and there are no rhymes
in this fixture. Left alone, that line is exactly the stale-doctrine shape WORKSTREAMS
warns about — a future reader takes "the class is blocked" as current and re-derives a
ruling that was overturned on 2026-08-19.

**Not a defect, recorded once:** `di-correction-verbatim-repeat` × 14 is bench-amplified. A
bench drives up to 8 consecutive refusals on one item where production caps at 2, so
identical general corrections in a row are the expected shape. Same family as item 24's F2.
The gate-8 drives, which respect the cap, threw none.

---

## What is owed next

1. **Fix the same-category guard, then re-run gate 7.** Three levers, in order of expected
   yield: give the guard a **worked counterexample** (the only structural difference from
   the guard that held); **narrow "keep with it"** in the accept clause, which is the exact
   phrase that licenses co-membership; and add an explicit **precedence line** — same kind
   of thing as the stimulus loses to the accept clause. Executor `/add-di-loop
   picture-vocabulary`. Re-bench is the gate; nothing else changes.
2. **I1 and I2 are worth fixing before the next open-set port**, because both corrupt the
   evidence a bench exists to produce. I2 especially — it destroys it.
3. **HUMAN-CHECKS #118 stays OPEN.** These runs retire the *semantic* half of criteria 1
   (unlisted partner, 8/8), 2 (the chain, 7/8) and 3 (the echo, 4/4 + 5/5), and they add a
   criterion the row does not have: **the same-category swap.** Acoustics, ASR and
   ear-separability remain the user's sitting.
