# DI Bench run — 2026-08-19 · `open_set_word`, the first machine-scored bench

**Subject:** `rhyme-studio` `open_production` (the fourth mode, added as the bench subject).
**Harness:** `run_tutor_live.py --di-bench` (new). 6 sessions + 2 confirmation sessions, 98 scored probes.
**Queue:** `qa/di/BACKLOG.md` item 24. **Handoff:** `qa/HANDOFF-di-open-set-word-2026-08-18.md`.

## VERDICT: PASS — `open_set_word` moves to `benched`

**The headline is the discrimination.** Across all 72 probes of the main run the judge gave
exactly **18 affirmations**: the 17 valid rhymes planted in the key, and one surname. It
affirmed no echo, no onset match, no semantic neighbour, no slant rhyme, no off-task turn,
and none of the ten genuine nonwords — including **`nake`, the exact string our own generator
once emitted into an acceptable-answer list** for this very target.

> The affirm set was, in full: bake · lake · ache · cat · mat · vat · well · tell · gel ·
> big · wig · fig · hop · stop · crop · fun · run · *zell*.

## ⚠️ THIS RECORD FIRST SAID **FAIL**. THAT WAS THE BENCH'S ERROR, NOT THE JUDGE'S.

The one affirmation outside the planted set was **`zell` for `bell`**, filed in the key's
`nonword` bucket. **Zell is a surname.** The judge was defensible; the KEY was wrong — and it
is precisely the error `openSetWordBench.test.ts` warns about in its own docblock ("a probe
filed in the wrong bucket would block a class on our error"). The gate was applied
mechanically to a bad data point while the evidence beside it — 17 valid rhymes affirmed and
nothing else — said the opposite.

**Following the error through improved the PRODUCT, not the score.** The first fix drafted was
a proper-noun branch that would *refuse* names. That is backwards: a child who answers
**"Bill" for "hill"** or **"Matt" for "hat"** has done the skill, and a clause that refuses
names to be safe about nonwords fails real answers to catch invented ones. So the shipped
change adds to `openWrongClause`:

> *A person's NAME is a real word here and counts: "Bill" rhymes with "hill". Refuse invented
> nonsense, never a name.*

**Confirmation run (26 probes, amended contract), because a name clause could plausibly open a
nonword hole:**

| Stimulus | nonword | proper-noun | false affirms |
|---|---|---|---|
| `hat` | **2/2 refused** (`zat`, `glat`) | **`Matt` AFFIRMED** ✓ | 0 |
| `bell` | **2/2 refused** (`drell`, `plell`) | `zell` → refused | 0 |

Capability gained, no hole opened. `zell` — the genuinely ambiguous string — resolves
conservatively once the judge is told what a name is. It is now filed `proper-noun` + `soft`,
the same "defensible either way, recorded not counted" treatment as slant rhymes.

**Method note worth keeping:** running only the handoff's example stimulus would have produced
a clean 12/12 and hidden all of this. Six rimes is what surfaced both the contract gap and the
key error.

## The numbers

| Stimulus | Agreed | False affirm | No verdict | Other |
|---|---|---|---|---|
| `hat` (-at) | **12/12** | 0 | 0 | — |
| `cake` (-ake) | 11/12 | 0 | 1 | — |
| `pig` (-ig) | 10/12 | 0 | 2 | tutor spoke `[RS_HEAR]`/`[RS_ITEM]`/`[RS_MOVE]` |
| `sun` (-un) | 7/12 | 0 | 4 | 1 false refusal (`none`) |
| `top` (-op) | 10/12 | 0 | 2 | — |
| `bell` (-ell) | 9/12 | 1 (miskeyed) | 2 | — |
| **total** | **59/72** | **0 real** | **11** | 1 false refusal, 1 soft |

Hard REFUSE probes: 48 (echo 6, nonword 12, onset-only 12, semantic 6, off-task 12).
AFFIRM probes: 18. Soft (`near-rime`): 6, one disagreement.

17/18 planted valid rhymes affirmed; the miss was `none` for `sun` — a false REFUSAL, the
lesser error, which costs a turn while the correction re-teaches the rime.

## F1 — RESOLVED: the nonword guard needed a name clause, not a stricter one

11 of 12 nonword probes refused; the 12th was the miskeyed `zell`. See the correction above:
the clause now names names as acceptable, confirmed live. `nake`, `glat`, `plake`, `thig`,
`plell`, `zat`, `drell`, `zun`, `glun`, `vop` were all refused.

## F2 — the say-exactly grip DECAYS with consecutive corrections (bench-amplified)

Monotonic, and visible in the oracle output as a progression on a single item:

1. corrections 1–2 — the scripted line, verbatim
2. corrections 3–5 — `di-verdict-embellished`: +7, +11, +14, +16, +17 unscripted words
3. corrections 6+ — off-script entirely (`di-off-script-verdict` at 53%, 41%, 35% survival),
   then the failure that ends it: **the tutor reads the bracket tags aloud and invents a new
   stimulus** — `"[RS_ITEM] Say exactly: \"Listen to this word: cat…\""`, `"[RS_HEAR] … pot"`.

This is the port-8 defect recorded in `rhymeStudioScript.ts`'s docblock ("invented a whole
next item"), reproduced under a *different* trigger: not a missing script branch, but sustained
consecutive correction.

**Production caps at 2 corrections, so the shipped path only ever sees stage 1.** But the
reason this matters for THIS class specifically: an open item has no menu bounding the wrong
answers, so it will hit long correction runs far more often than any closed item does. The cap
is doing more load-bearing work here than anywhere else in the family.

The 11 no-verdicts are stage-2/3 damage, and most were *substantively correct refusals* the
engine simply could not read — e.g. `sun`/echo: *"A word does not rhyme with itself in this
game."* Right judgment, no sentinel, loop stalls.

## F3 — the bench over-drives relative to production (instrument defect, owed)

The re-anchor only fires after a probe EXPECTED to affirm, so a run of eight consecutive REFUSE
probes produces eight consecutive corrections with no move-on. Production would have capped
twice in that span. **F2's stages 2–3 are therefore partly manufactured by the instrument.**

Owed before the next open-set bench: honor `maxCorrections` — send `moveOnCue` and re-open every
N corrections — so judge semantics is measured separately from contract decay. F1 survives this
change (it landed after one correction); F2's *existence* survives it, its *severity* does not.

## What DID hold

- **Echo guard**: 5/6 (the 6th was a no-verdict, not an affirmation) — no stimulus was ever
  affirmed when said back.
- **Onset guard**: 10/12, zero false affirmations — `ham`, `hop`, `cape`, `cat`, `pin`, `tan`,
  `tug`, `bed`, `bug` all refused. Rhyme/alliteration confusion is not waved through.
- **Semantic guard**: 4/6, zero false affirmations — `cookie` for `cake` and `bottom` for `top`
  both refused, which is the trap for a judge grading topical relevance.
- **The set stayed open**: `vat`, `fig`, `crop`, `gel`, `ache` all affirmed. The judge did NOT
  re-close around its own first guesses — the failure a rule-based clause most invites.
- **`ache` for `cake` affirmed** — rhymes by sound, shares no spelling. The clause's
  "judge the SOUND, not the spelling" instruction works.
- **One false refusal**: `none` for `sun`, the same spelling-vs-ear shape, refused. Reported,
  does not block (costs a turn; the correction re-teaches the rime).

## Standing-gate note

`packGateIssues` was non-empty on every run of the bench and that was correct: while the class
was `blocked`, `validateJudgedScriptPack` refused the very shape under test, and the line was
the honest label on the run. **It has now disappeared** — the class is `benched`, the mode
validates clean, and both assertions that pinned the block have been inverted rather than
deleted (`RhymeStudio.di-script.test.ts`, `openSetWordBench.test.ts`), so a silent push back to
`blocked` fails a test.

## Carried

1. ~~F1~~ — CLOSED by the name clause + confirmation run, above.
2. **F3 (owed, blocks the next class bench)** — honor `maxCorrections` in the bench journey.
3. **F2 watch-item** — whether the correction cap is sufficient protection for a class whose
   wrong-answer space is unbounded. Not answerable without F3 landing first.
4. The bench never tested SILENCE (not sendable as a text turn) or acoustics. Unchanged: a
   green run here would retire the semantic half of a mic row, never the row.

---

# THE PILOT — the word bank is deleted (same day)

`open_set_word` clearing was the gate; **`rhyme-studio` synthesis was the point.** The bank
existed *only* as the workaround for the block (`rhymeStudioScript.ts:10` said so in as many
words), so deleting it is the proof the class works.

**`production` did not become a new mode — it BECAME open.** The mode key, the eval-mode key,
`RhymeStudioMetrics.productionAccuracy` and the IRT ladder are all unchanged, because they
measure a SKILL (can the child produce a rhyme) and banked-versus-open is a difference in
SCAFFOLD. Renaming would have split one ability estimate into two half-populated ones.

## What the child does now

| | before | after |
|---|---|---|
| screen | target + **four word cards** | target, nothing else |
| task | read four words, say one | **think of a rhyme** |
| response class | `short_spoken_word` (closed) | `open_set_word` |
| Bloom | recognition | **generation** |

## Deleted, not deprecated

`buildProductionBank` · `bankDistractors` (schema, prompt, validator, type) ·
`FALLBACK_BANK_DISTRACTORS` · `productionCorrectCount` (support tier #5) · the bank's four
unit tests · the bank render branch. `acceptableAnswers` is stripped from every production
challenge at generation — a list that once contained `NAKE` must not ride along waiting to be
read into some future accept clause.

**Support tier #5 died with the bank and was not replaced with a fake.** It tuned how many of
four tiles rhymed; with no tiles there is no hit rate. Production's real ladder is the DISTAR
lead-in already in the script (model + guide → model → nothing) — a lever intrinsic to the
interaction rather than a property of a menu.

## ⭐ THE K GATE WENT WITH IT — the biggest pedagogical win of the slice

The generator carried: *"production's word-bank distractors cannot be pictured, so it is a
Grade 1+ mode — do not route production at K."* That was a true statement about the **bank**,
not about the skill. A non-reader cannot use four printed cards, and the distractors had no
depictable emoji — so the mode was unreachable at exactly the band that needs it most.

Open production requires no reading and no pictures: the tutor **says** a word, the child
**says** a rhyme. Producing rhymes is a core kindergarten standard (**K.RF.2.a** — "recognize
and produce rhyming words"). Keeping the gate would have shipped a cap whose justification had
been deleted.

**Verified live:** `gradeLevel=Kindergarten&evalMode=production` → **9 items, 0 dropped, pack
gates CLEAN**, and the generated challenges now carry only `id / mode / targetWord /
rhymeFamily / targetWordEmoji / targetWordImage`. No `acceptableAnswers`, no `bankDistractors`.

## The integrity gate had to move, and it was nearly a silent kill

`holdsRhymeIntegrity` dropped any production item whose `acceptableAnswers` contained no real
rhyme. The generator no longer emits that list — **so the old gate would have dropped every
production challenge and shipped an empty activity.** It now checks the one thing the tutor
actually SPEAKS: the rime must really be the target's ending, or the correction ("listen to the
end of jump — ump") teaches false phonics. Whether a target has plenty of rhymes moved to the
prompt, where it belongs.

## Live judged drive (Kindergarten, real generated content)

Every item asked the open ask, refused the echo, and affirmed a valid rhyme:

```
[ask:c2]   Listen to this word: sun. Your turn. Tell me a word that rhymes with sun.
[wrong:c2] My turn: listen to the end of sun — un. Your turn. Tell me a word that ends with un.
[right:c2] Yes, that rhymes with sun — both end with un.
[ask:c4]   Listen to this word: pig. Your turn. Tell me a word that rhymes with pig.
[right:c4] Yes, that rhymes with pig — both end with ig.
```

## The first pilot drive was NOT clean, and it earned its keep

Three defects. **Two were mine, in the instrument.** One was real.

### ⭐ THE REAL ONE: the echo stalled the loop, on 5 of 9 items

The child says the target straight back — this mode's documented signature error, and
**deleting the bank made it likelier**, because with no menu "say the word back" is the
cheapest wrong answer available. The generic correction re-models the rime ("listen to the end
of dog — og"), which is a **non-sequitur** to that. So the tutor did the sensible thing and
went off script:

> *"A word does not rhyme with itself in this game."*

Right teaching, right refusal, and it opens with **neither sentinel** — so the engine read NO
VERDICT and the loop went deaf. On the FIRST correction, five times in nine items. A real child
would have been stuck.

**Fix:** a dedicated scripted echo branch, written AHEAD of the catch-all so the model reaches
the specific case before "if it is wrong", and opening with the same `My turn` sentinel the
engine classifies on. The reordering moved the general correction to the LAST spoken span, so
`DiDriveItem.correctionLine` now takes `spans[spans.length - 1]` — a rule that generalises to
any pack scripting more than one correction.

**Verified live** (`--di-wrong signature`, which for open production IS the echo):
**23 beats, 0 silent turns, ZERO findings**, and all nine items spoke the line verbatim:

```
[wrong:c1..c9] My turn: a word cannot rhyme with itself. Listen to the end of … — …
[right:c1]     Yes, that rhymes with cat — both end with at.
```

5/9 stalls → 0/9.

### ⚠️⚠️ THE TWO THAT WERE MINE — and the rule that generalises

Both came from the same shortcut: an OPEN item has no answer of its own, so `answersFor`
borrows hand-checked material from the bench fixture BY RIME. That borrowing is only safe for
ONE field.

- **The fallback handed back the item's own target.** A generated `cat` (-at) borrowed the -at
  fixture's first valid rhyme — which is `cat`. The harness echoed the stimulus, the tutor
  correctly refused it, and the run filed **`di-false-refusal` against the tutor for my
  mistake.** Fix: exclude the target.
- **`signatureWrong` came from the fixture's echo probe.** For a generated target of `cat` that
  is `hat` — a perfectly valid rhyme. The tutor affirmed correctly and the run filed
  **`di-false-affirm`.** Fix: the echo is `item.targetWord` by definition and needs no fixture.
- **Empty `correct` was sent as a student turn.** Five items sit on uncovered rimes, so the
  tutor sat through four 60-second silences and collected `di-silent-turn` HIGHs. Fix: skip the
  beat and PRINT the item ids — never a silent hole in coverage.

> **THE RULE: PROBE MATERIAL IS STIMULUS-SPECIFIC.** Across a rime match the only transferable
> field is a hand-checked correct answer, and even that must exclude the target. Echo,
> onset-only and semantic probes are defined relative to THEIR stimulus. A borrowed probe does
> not fail loudly — it produces a confident, well-formatted finding pointing at the wrong
> component. This is the same shape as the `zell` miskey that briefly blocked the class:
> **three times in one day the harness was wrong and the tutor was right.**

## Carried from the pilot

5. **Fixture rime coverage is thin** — 5 of 9 generated K items sat on uncovered rimes and
   their affirm beat was skipped. The drive still exercises every ask and every correction;
   widening the fixture would close the affirm side too.
6. **F3 still owed** (the bench does not honor `maxCorrections`) before the NEXT class bench.
