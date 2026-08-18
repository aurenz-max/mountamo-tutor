# HANDOFF — `/add-di-loop` on `text-structure-analyzer` (item 22, port 1 of 5)

> # ✅ EXECUTED AND CLOSED — the port SHIPPED 2026-08-17 as `a4792128` (DI port 18)
>
> **Do not execute this as a scope.** It is kept as the reasoning record behind a shipped
> port; the close block lives in `qa/di/BACKLOG.md` item 22, and `/add-di-loop` carries the
> defect classes this port contributed.
>
> ### ⚠️ The ⛔ header that stood here from 08-16 08:06 was a FALSE ALARM, and it is worth
> ### one paragraph because the failure mode is cheap to repeat
>
> It read *"A CONCURRENT SESSION IS ALREADY PORTING THIS PRIMITIVE — do not touch their
> files"*, citing an untracked `textStructureAnalyzerScript.ts` (1,273 lines), a rewritten
> `TextStructureAnalyzer.tsx` and `gemini-text-structure-analyzer.ts` at +244. **All three
> were real. None belonged to a third party** — a `/pm` run read the in-flight working tree
> of the session executing *this file's own handoff* and reported it as an unknown session.
> `git status` before scoping a port is still right; what it needed was to check the pull
> pointer it had itself just written. **The header inverted its own lesson**: it warned that
> a `??` on a `<primitive>Script.ts` is the signature of an in-flight port, which is true,
> and then concluded a stranger was writing it.
>
> *Left standing, this would have parked a lane on a phantom. A stale doctrine line ("do not
> touch these files") outlives a stale status line, because the next session copies it
> forward — `tsc` sees none of it.*

**Task (as originally scoped):** port `text-structure-analyzer` to the DI judged loop.
**Queue of record:** `qa/di/BACKLOG.md` **item 22** (carries the close block and the roster).
**State claim as written — *"nothing built"* — was true when written and false 8 hours later.**

## 0. ⭐ HOW THE SHIPPED PORT ANSWERED THIS FILE

The pack exports `answerKindFor`, `responseClassFor`, `EarSeparable`,
`MIN_STRUCTURE_OPTIONS_EASY`, `MAX_SIGNAL_ITEMS`, `MAX_MAP_ITEMS` — §4 (the fork), §5
(ear-separability + the easy guess floor) and the one-challenge-is-not-one-item split all
landed. **§3 — this file's sharpest finding — was resolved STRUCTURALLY rather than with the
`answeredOnce` invariant it proposed:** one payload is one passage, so a pinned session yields
exactly ONE `name-structure` ask and the same-answer-every-item problem cannot arise.
⚠️ **One call in §4 was overturned in the build:** `place-idea` ships as `short_spoken_word`,
not `closed_set_choice` — a region label is a NAME ("Cause", "Effect"), not a proposition,
which is word-sorter's mats exactly, and that class is BENCHED rather than build-ahead.

> **⚠️ THE ONE THING TO READ BEFORE SCOPING: §3 below.** A session pinned to one eval mode has
> **the same correct answer on every item at the Identify step, by construction.** That is not a
> detail — it decides the pack's whole shape, and no earlier port has had it this badly.

---

## 1. Why this primitive, and what the lane just corrected

The 08-16 reconcile's Class C table listed 13 literacy primitives as *"BLOCKED on a judge
capability that does not exist"* and priced a new response class at 13 unlocks. **That table was
built from mode NAMES and primitive DESCRIPTIONS.** Reading the actual `evalModes` splits it:
5 are `closed_set_choice` today, 3 need one read, and only ~4-5 are genuinely blocked. Item 22
is the first group; this is its first port.

**User picked this direction 2026-08-16** over finishing the 19h-i-b adapter sweep, under the
standing *"capability before re-testing"* ruling. Two supporting facts: `text-structure-analyzer`
is in **3** queues against `rhyme-studio`'s **5**, and its own catalog block calls informational
text structure **ESSENTIAL for grades 2-6**.

**⚠️ And apply the correction to yourself.** This handoff is written from the **generator + a
component skim** — one layer deeper than the table it corrects, still one shallower than the fork
needs. **Five predictions in four days have died on contact with the answer material**
(story-talk's per-mode split, word-workout's sentinel collision, word-builder's hybrid tap, the
Class C table, and its parent). Treat §3's fork as a *reading*, not a decision.

---

## 2. The answer material — what actually exists

`gemini-text-structure-analyzer.ts` (630 lines) →
`TextStructureAnalyzerData`. **Grade band is 2–6, not K-2** — the second judged port above K-2
after `word-builder`.

| Field | Shape | What it is |
|---|---|---|
| `passage` | string, 4–10 sentences | the informational text |
| `signalWords[]` | `{word, startIndex, endIndex}` | "because", "first", "however" — offsets **recomputed in code** (`recomputeSignalWordOffsets`), and a word not found in the passage is **dropped with a `console.warn`** |
| `structureType` | enum of 5 | **the Identify answer**: `cause-effect` · `compare-contrast` · `problem-solution` · `chronological` · `description` |
| `structureOptions[]` | `{type, label, description}` | the printed menu — "Cause and Effect", "Sequence / Time Order", each with a kid-friendly gloss |
| `templateRegions[]` | `{regionId, label}` | the mats — "Cause" / "Effect", "Problem" / "Solution" |
| `keyIdeas[]` | `{ideaId, text, correctRegionId}` | excerpts the child assigns to a region |

The component (`AnalysisPhase`) runs **four phases**:
`'signal-words'` → `'identify'` → `'map'` → `'review'`, advanced by
`LuminaActionButton action="next"` (*"Next: Identify Structure"*). **That is the click-to-advance
modality this port exists to delete**, and there are `attemptsCount` / `showFeedback` click-era
grading fields to go with it.

---

## 3. ⭐ THE FINDING THAT DECIDES THE PACK: a pinned session has ONE answer

**The eval modes ARE the structure types.** `cause_effect`, `compare_contrast`,
`problem_solution`, `chronological_description` — and `resolveEvalModeConstraint` +
`constrainChallengeTypeEnum` pin `structureType` to the mode's allowed set (`rootLevel: true`).
**The manifest pins a mode for essentially every production lesson** (letter-spotter's finding).

So in a pinned session, **every challenge's Identify answer is the same structure type.** Item 1
closes with an affirmation or a capped move-on that NAMES it — *"Yes, Cause and Effect."* — and
items 2..N ask the identical question with the identical answer. **The child answers item 2 from
memory of item 1's verdict, not from the passage.** Neither item is wrong alone.

This is §4d (*a thing may be answered once per session*) in its strongest form yet — stronger
than letter-spotter's (one letter per session) or word-builder's (no word contains another),
because here it is not a collision to avoid but the **default state of every pinned run**.

**Three ways out. Pick deliberately and write the reason down:**

1. **One challenge = one Identify item.** The session carries one passage's Identify ask, and the
   remaining items come from the other phases (signal words, idea mapping) — which vary per item
   even when the structure does not. *This is the reading the material most supports.*
2. **Ask the Identify step for its JUSTIFICATION, not its label,** on items 2..N: the label is
   spent, but *"which word in this line told you?"* is not. Turns the repeat into the signal-word
   channel rather than deleting it.
3. **Blended sessions only** — i.e. the pack refuses to build more than one Identify item under a
   pinned constraint. Cheapest to gate, but it hands the problem to the manifest, which pins.

**Do not** solve it by shuffling distractors. The answer is the answer; a fresh menu around a
known answer is still a known answer.

---

## 4. The fork as read (confirm against the component before writing a line)

| Phase | Click-era answer | Reading | Class |
|---|---|---|---|
| 1 `signal-words` | click spans in the passage to highlight | **SPOKEN.** The child reads the line and SAYS the transition word. Better pedagogy than highlighting, and it is a word from the passage. | `short_spoken_word` |
| 2 `identify` | pick from a printed menu of 2–4 | **SPOKEN** — say which structure. This is the mode's core, and `closed_set_choice` was built for exactly it. | `closed_set_choice` |
| 3 `map` | `onClick(mapIdeaToRegion)` — assign each idea to a labelled region | **SPOKEN, on `word-sorter`'s precedent** — the regions are named mats, so the answer is the mat's NAME. word-sorter's fork ended with zero taps over exactly this shape. | `closed_set_choice` |
| 4 `review` | — | not an answer | — |

**Provisional call: this may be an ALL-VOICE port.** If that survives the component read, say so
explicitly in the report — a four-phase primitive going to zero taps is worth recording.

⚠️ **Phase 1 is the one to think hardest about.** Highlighting a span is a POSITION answer, which
is one of the three legitimately-unsayable shapes. It is *sayable* here only because the signal
word is a word — but if a passage repeats "then" three times, *"say the transition word"* has
three right answers and one printed target. **That is an ambiguous ask, i.e. a broken one** —
either scope the ask to a line (*"read the second sentence — which word tells you the order?"*)
or drop the duplicate. Do not judge it leniently.

---

## 5. ⚠️ Axis-2 structural difficulty FIGHTS ear-separability — this is the port's sharpest trap

`closed_set_choice` requires (`optionsEarSeparable`, `decodableReaderScript.ts`) that **every
option carry a word no other option has**, or an utterance fits two of them and there is no
honest verdict.

**This generator is engineered to do the opposite.** `STRUCTURE_DISTANCE` +
`resolveProblemShape` + `buildDistractorOrder` deliberately select the **most confusable**
siblings at `hard`:

> *"the wrong answer choices should be the structures most easily MISTAKEN for the correct one
> (e.g. cause-effect vs problem-solution — both 'this leads to that')"*

Word-level those labels are separable ("Cause and Effect" vs "Problem and Solution" share no
word). **Check it at the level the gate actually needs**, and check what a child SAYS: a
five-year-old's accepted short form is *"cause"* or *"the first one"*, and the accept clause is
where two structures can collide even when the labels do not.

**Do not weaken axis 2 to make the judge's life easier** — it is shipped, deliberate, documented
difficulty. If a tier produces an unjudgeable pair, that ask DROPS at that tier; the tier does
not soften. (word-sorter's tier-conditional exemption is the pattern to copy.)

**Also note `maxStructureOptions: 2` at `easy`** — correct + 1 distractor, a **1-in-2 guess
floor** at the Identify step. That is the costume test's own example. Under a judged loop the
guess floor is the thing being deleted, so decide whether `easy` keeps a 2-option menu at all
once the answer is spoken.

---

## 6. Generator notes for the same slice

- **No silent fallback** — it `throw`s on error (line ~626). It is *not* on the 33-generator
  silent-fallback list, so do not "fix" it into one.
- **⚠️ Truncation risk is real and unbounded.** `gemini-flash-lite-latest`, **no
  `maxOutputTokens` set at all**, and a wide schema whose arrays (`signalWords`,
  `structureOptions`, `templateRegions`, `keyIdeas`) are **all unbounded**. This is the
  `flash-lite-truncation-template` target shape. ⚠️ **Do NOT paste 8192** — word-builder proved
  it is a non-thinking number that gets spent on reasoning first and truncates at ~850 chars on
  a thinking model. Bound the arrays first; pick the ceiling from the model actually configured.
- **`recomputeSignalWordOffsets` can drop to zero**, which leaves Phase 1 with no askable item.
  Needs a build gate (drop the item, never backfill).
- **Import the gates from the script module, never copy them** — letter-spotter's two sides of
  the wire drifted to 90 vs 100 chars. Export `optionsEarSeparable` and the label constants from
  `textStructureAnalyzerScript.ts` and have the generator consume them.

---

## 7. Closest worked examples

- **`wordSorterScript.ts`** (884 lines, shipped 2026-08-16) — **read this one first.** Same
  shape: a menu of labelled mats, a closed set, a tier-conditional leak exemption, one ask per
  item, and the ruling that the mats are the PAGE while the tap was the costume.
- **`decodableReaderScript.ts`** — `optionsEarSeparable` reference, and `leakExemptSpan` as a
  LIST.
- **`letterSoundLinkScript.ts`** — the tier-conditional pattern and the accept-side 18d rows.

---

## 8. Gates + close

Standard: `/add-di-loop` §7 in full (typecheck:lumina 0 · tsc = baseline, 0 in touched files ·
census greps 0 · live probe per eval mode · `--di` plain + signature per mode, cap per CONTRACT
shape · revert-bite). Register the adapter in `service/qa/di/diDrivePlan.ts` (16 ports there now).

Close into **`qa/di/BACKLOG.md` item 22** — dated block, files, deletions, findings, gates, probe
words — and update the WORKSTREAMS judged-loop row. **File a mic row only under the standing
rule**: `closed_set_choice` is proven by word-sorter, so a row is owed only if this port's answer
material is genuinely new. *(A multi-word structure LABEL from a deliberately-confusable set may
qualify — see §5. Re-grep `HUMAN-CHECKS.md` for the next free ID immediately before filing;
#100–#103 are open and IDs move.)*

---

## 9. Uncommitted state you are inheriting

Three register files modified, **not committed**, all from the `/pm` run that opened this lane:

- `WORKSTREAMS.md` — new reconcile note, predecessor archived, PROD row corrected (the ff HAD
  been taken), pull pointer forked to item 22
- `my-tutoring-app/qa/WORKSTREAMS-archive.md` — the archived predecessor note
- `my-tutoring-app/qa/di/BACKLOG.md` — **item 22 inserted at the top of the queue**

Tree was otherwise clean at `730e8a7d`; `main` = `origin/main` = `ship/2026-08-10-judged-loop`.
**Commit the register slice on its own** before the port work starts — this lane has had two
sessions in the same shared files on one day, and the standing rule is to commit at the mechanism
boundary while you still know which lines are yours.
