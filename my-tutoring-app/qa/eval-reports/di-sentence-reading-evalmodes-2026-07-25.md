# di-sentence-reading — L1 eval-modes (2026-07-25)

Birth-cert follow-up **#1 struck**. The pack went L0 → L1 the same day it was
born and runtime-verified. Four task identities, all inside the benched response
class, so **standing gate 1 was satisfied with no new bench sitting**.

## The ladder

| evalMode | β | Task identity | Curriculum evidence (birth fit probe) |
|---|---|---|---|
| `decodable_sentence` | 2.5 | Every content word is a sound-it-out CVC word — blending TRANSFERRED to connected text | K *"Read CVC Words in Decodable Phrases & Sentences"* 0.781 |
| `read_sentence` | 3.0 | **L0, unchanged** — accuracy over mixed vocabulary | G1 `LA003-01` Oral Reading Accuracy 0.824 |
| `sentence_review` | 3.5 | Cumulative / spaced wide mix — retention, not first-time decoding | G2 `LA001-05` Reading Fluency 0.807 |
| `sight_phrase_sentence` | 4.0 | Irregular high-frequency density — whole-word RECALL in connected text | G1 `LA001-07` *"Read high-frequency words fluently within connected text"* 0.779 |

**These are identities, not tiers.** The strongest evidence is that
`decodable_sentence` and `read_sentence` have *different curriculum homes at
different grades* — one is phonics transfer (K/G1), the other is general oral
reading accuracy (G1). A useful consequence: **`decodable_sentence` gives the
pack a K home**, the band the birth's fit probe abstained on (diffuse, 0.793).

Ordering mirrors both sibling packs (base → review → the distinct-process rung
on top), and `read_sentence` keeps β3.0 exactly, so nothing about the L0 mode's
calibration shifts.

## Zero new spoken copy

Every mode reads through the **identical bench-proven cue lines**. The L0 script
was already phrased entirely around `it.text` — model, guide, test, affirm, and
correction — so all four skills speak the sentences the standing-gate sitting
proved, byte for byte. Unlike di-math-facts (which needed one type-aware line
for counting direction), this ladder required **no script change at all**: what
a mode changes is the POOL, i.e. which reading skill the item exercises.

## Deferred by design

- **A longer-text rung** — would leave the benched 3-8 word scope and needs its
  own bench sitting first.
- **A pace / expression rung** — read-aloud-studio's territory, and the L0
  judging contract explicitly refuses to judge speed ("judge accuracy, never
  speed"). Adding it here would silently change what the pack measures.

## Verification

| Gate | Result |
|---|---|
| `typecheck:lumina` | **0 errors** |
| full `tsc --noEmit` | 803 errors, **0 on the Lumina surface** (all pre-existing legacy) |
| `npm test` | **936/936** |
| backend registry | 4 rows load with β 2.5 / 3.0 / 3.5 / 4.0 — mirrors the catalog exactly |
| eval-test (real Gemini) | **10/10 runs clean** — 8 pinned + 2 mixed |
| `/topic-trace` | **routing verified end-to-end** (see below) |

### Per-mode POOL assertions (the point of the ladder)

Pinning a mode is not evidence the mode *means* anything — all four render
identically, so the eval-test route's own challengeType validator passes
trivially. The harness therefore asserts the POOL:

| Assertion | Result |
|---|---|
| every pinned mode stamps only its own type | PASS ×8 |
| `sight_phrase_sentence` serves ONLY sight-heavy sentences | PASS |
| `decodable_sentence` NEVER serves an un-blendable sentence (`see`, `ball`) | PASS |
| `decodable_sentence` + "short a" stays vowel-PURE | PASS (4/4 `["a"]`) |
| `sight_phrase_sentence` ignores the vowel scope (its scope IS the word set) | PASS — a "short a" sight objective returns sight sentences, not an empty set |
| `sentence_review` keeps a thread to the lesson (≥1 anchor) | PASS |
| `sentence_review` BROADENS past the focus (≥2 vowel families, not all-focus) | PASS after the fix below |
| **SP-21**: `mixed` yields ≥3 distinct types and a full-length session | PASS ×2 — all **4** types, 4 items |
| all L0 invariants still hold (wordCount recomputed, 3-8 ceiling, sentinel safety, terminal punctuation, no dupes, wrapper leak) | PASS on every run |

### `/topic-trace` — the path the tester cannot exercise

The Primitives Tester and `/api/lumina/eval-test` both always pin
`targetEvalMode`, so neither can test routing. Trace on *"reading sentences with
sight words"* @ G1:

```
objective → "Read short sentences containing sight words out loud."
intent    → "The student reads 3-5 word sentences containing the target sight words…"
resolved  → sight_phrase_sentence (explicit)     ← the NEW mode, via the lesson resolver
ceiling   → 5 (narrowed from 8 by the intent's own "short sentences" language)
data      → Here it is. / Look at me! / We can go up. / My ball is red.
```

Routing was **newly live** in this slice: with one mode `resolveEvalModes`
short-circuits (`modes.length < 2` → mixed), so this path had never executed for
this pack. Report: `qa/topic-traces/reading-sentences-with-sight-words-2026-07-25.md`.

## One design bug found and fixed during QA

**`sentence_review` never broadened — it was the base mode relabelled.** The
first sweep passed every assertion, and the content still showed a short-a review
returning **4/4 short-a sentences**:

```
sentence_review [3w] "The cat sat."                ["a"]
sentence_review [3w] "The rat ran."                ["a"]
sentence_review [5w] "Sam sat on the mat."         ["a"]
sentence_review [7w] "The red hen ran to the pen." ["e","a"]
```

Cause: the model's topical picks are chosen from the prompt menu, which shows
only the FOCUSED pool, so they flooded `preferred` and crowded out the wide pool
the review mode is supposed to draw from. The ≤2 anchor was doing nothing,
because everything else was also focus.

This is **di-math-facts' `fact_review` bug in mirror image** — theirs drew ZERO
items from the focus and lost the thread to the lesson; this drew nothing else
and lost the breadth. Both failures are the same underlying question (what
fraction of a review should be the freshly-taught set), caught from opposite
sides.

Fixed: `sentence_review` now stops at its ≤2 anchors, takes none of the model's
topical picks, back-fills SHUFFLED from the whole menu, and rotates by VOWEL even
when the objective pinned one (breadth across patterns IS the skill). After:

```
sentence_review [3w] "The cat sat."       ["a"]   ← anchor
sentence_review [3w] "Here it is."        ["i"]
sentence_review [4w] "The pup can run."   ["u"]
sentence_review [5w] "Ben has a red pen." ["e"]
```

The assertion was tightened to match: a review must now prove BOTH an anchor and
breadth (≥2 vowel families, not all-focus). The old check would have passed the
broken behaviour — the same lesson as the L0 purity bug, one layer up: **the
automated gate is only as good as the question it asks, and reading the content
is what generates the question.**

## Menu changes

- `decodable` tagged explicitly per entry (30 of 44) rather than inferred —
  whether a sentence is fully blendable is a pedagogical judgement per sentence,
  not a derivable property. Earliest function words (the, a, I, is, on, can) are
  permitted and expected; a non-blendable CONTENT word (`see`, `ball`, `look`,
  `go`) is what disqualifies an entry.
- 5 sight-heavy sentences added (11 total, 3-7 words) so
  `sight_phrase_sentence` has variance room rather than serving the same 6.

## Ladder position

L0 → **L1 (eval-dense)**. Next rung on the birth cert is
`/add-tutoring-scaffold` (L2) — note the pack already ships its tutoring block
in the catalog, so L2's real work is `contextKeys`, `commonStruggles`, and the
RUNTIME STATE sync, plus a `sentences` summary field on the generator.

**The 4 modes' live behaviour is UNVERIFIED with a mic** — but note the cue
wording is bench-proven and byte-identical across all four, so what is untested
is pool selection, not speech. Folds into HUMAN-CHECKS **#54**.
