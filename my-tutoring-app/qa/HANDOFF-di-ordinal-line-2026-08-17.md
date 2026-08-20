# HANDOFF — DI modality on `ordinal-line` (math port 5)

**Status:** scoped, not started. Executor: `/add-di-loop ordinal-line`, one slice.
**Origin:** user call 2026-08-17 — *"i actually think ordinal line may be a great one?"* — taken
immediately after `compare-objects` shipped (math port 4).
**Queue of record:** `qa/di/BACKLOG.md` item 18 (P4). This brief is the scope; the skill is the method.

---

## 0. Do this first — THE STATED BLOCKER IS FALSE

`qa/di/BACKLOG.md` has said since 2026-08-14:

> `ordinal-line` stays gated — not by #63 but by RESPONSE CLASS (ordinal words are unbenched;
> `identify` is a tap anyway) — do not read this correction as unblocking it.

**Both halves of that are wrong, and the first one is wrong in CODE.**

```ts
// hooks/judgedScriptContract.ts:117
ordinal_word: {
  status: 'benched',
  evidence:
    'Single common words (first..tenth) within the short_spoken_word class; no homophone '
    + 'cluster. Distinct id so an ordinal pack is findable if the class ever needs its own bench.',
},
```

`ordinal_word` is **BENCHED**. The queue line is a stale doctrine line of exactly the kind
WORKSTREAMS warns about — *"a rule is copied forward by the next session and silently changes what
gets built"* — and it did: it kept this primitive off the Class-A list for three months, which is
why port 4 had to be found off-list. **Corrected in the queue in the same slice as this brief.**

The second half — *"`identify` is a tap anyway"* — is not a reason, it is the DEFECT. See §1.

**Nothing else gates this port.** `maxPosition` is clamped to ≤ 10 in the generator
(`gemini-ordinal-line.ts:453`), so every position the child ever names is inside the benched
`first..tenth` window. No #63. No new response class. No bench sitting owed.

---

## 1. Why `ordinal-line` is the right next math port

**The primitive's whole subject is a spoken word, and not one of its five modes lets the child say
it.** The catalog labels mode 1 *"Identify — **Name** ordinal position"*, and the interaction is a
tap on a character. A mode whose own label is a speech act and whose surface is a button is the
purest costume this lane has found since `compare-objects`'s attribute chips — and it is the same
argument, one primitive later: ordinal vocabulary is taught by *saying* it.

Three more reasons it is cheap and high-yield:

- **It fits inside its own benched window by construction** (≤ 10, code-clamped) — the property
  that made `ten-frame` the right first math port.
- **The ask window is already code-owned.** `gemini-ordinal-line.ts:322-332` picks the asked
  position in CODE off `[1..maxPosition]` and narrows only what is asked, never the visible line
  (the position-window fix). A judged pack inherits that for free.
- **Its top misconception is already written down and is perfectly judgeable**: `commonStruggles`
  row 1 is *"Student counts from the wrong end of the line"*. That is a fluent, confident, wrong
  ordinal — the exact shape `discriminationFor` exists to refuse. See §5.

---

## 2. The answer-material fork — DECIDED (Step 1 of the skill)

Four spoken, one placement. Structurally the same shape `compare-objects` shipped, which is a
signal the pattern is settling, not a coincidence to copy blindly.

| mode | today | ships as | class | why |
|---|---|---|---|---|
| `identify` | tap a character | **SPOKEN** | `ordinal_word` **or** `short_spoken_word` | see §3 — it forks by direction |
| `match` | 3-pair matching grid | **SPOKEN**, one item per symbol | `ordinal_word` | reading "3rd" aloud IS the skill; the grid is brute-forceable |
| `relative_position` | multiple choice | **SPOKEN** | `short_spoken_word` / `ordinal_word` | "who is right before the third one?" is answered out loud at a table |
| `sequence_story` | multiple choice | **SPOKEN** | `ordinal_word` | ASS's `solve_story` precedent — the story is read aloud, the answer is said |
| `build_sequence` | place characters from clues | **GESTURE** (keep hands) | `manipulation` | the arrangement IS the answer — the third unsayable shape |

**Do not convert `build_sequence`.** Placing characters into slots from clues is page-work a child
would do with counters at a table. Precedent: `number-bond` decompose, `ten-frame` build,
`compare-objects` order_three. Close it on stillness with a structural shortening when every slot
is filled (`compare-objects`'s 4000ms / 1500ms pair is the starting calibration, and it is
hand-tuned by ear there too — say so in the report).

**`match` is the one that changes shape, not just modality.** One challenge is NOT one item
(defect class 1): a 3-pair grid becomes **three judged asks**, one per symbol — *"This one says…?"*
→ *"third"*. This also dissolves the elimination leak the grid carries by construction (defect
class 3: the last pair matches itself and needs no reading at all).

---

## 3. ⚠️ `identify` FORKS BY DIRECTION, and the two directions are different skills

This is the design decision the port must make deliberately rather than discover:

- **Direction A — position → name.** *"Who is third in line?"* → the child says the CHARACTER'S
  name (`short_spoken_word`, closed per-item set, benched). The ordinal is in the ASK.
- **Direction B — name → position.** *"What position is the dog in?"* → the child says the ORDINAL
  WORD (`ordinal_word`, benched). The ordinal is the ANSWER.

**Only Direction B produces the vocabulary the mode is named for.** The catalog says "Name ordinal
position"; Direction A never makes the child say an ordinal at all. But Direction A is the easier
rung and is genuinely what a K teacher asks first.

**Recommendation: ship BOTH, band-split, as ONE eval mode.** Direction A at K, Direction B at
Grade 1, decided in `itemFromChallenge` from `band` — not as a new eval mode, because they are the
same task identity at two difficulties and the βs are already spent. Record the split in the
catalog `description` so the manifest knows what it routes to.

⚠️ **Whichever direction an item is, the OTHER direction's answer must not be on screen.** See §4.

---

## 4. Content gates specific to `ordinal-line` (Step 4 — DROP, never backfill)

Export every one from `ordinalLineScript.ts` and have the generator IMPORT it. Hand-synced copies
drift (letter-spotter's two sides disagreed live).

1. **⭐ THE ORDINAL LABELS ARE AN ANSWER KEY IN PIXELS.** `showPositionLabels` renders
   `getOrdinalLabel(pos, labelFormat)` under **every** character — literally `3rd (third)` when
   `labelFormat` is `'both'` (`OrdinalLine.tsx:620-623`). Harmless while a button graded it; the
   moment the ask is *"who is third?"* the child reads the answer off the screen, and in Direction
   B the label IS the answer, verbatim. **This is the third port in a row with this defect**
   (ten-frame's running counter, compare-objects' numbered unit boxes, now this) — hold it behind
   `runner.revealHeld` and let the counting walk live in the CORRECTION, where it is earned.
   Audit `showOrdinalLabels` + `labelFormat` at the data level in the same pass.
2. **Position ≤ 10.** The benched window is `first..tenth`. The generator already clamps, but
   assert it in the build gate so a future capacity change cannot launder an unbenched class.
3. **Character names must be sayable and ear-separable.** Consume `isSayableName` and
   `namesEarSeparable` from `compareObjectsScript.ts` (or lift them to a shared math module —
   decide at port time, do not copy them). A line of `dog / dog2` has no honest verdict.
4. **A character name may not carry an ordinal.** Defect class 11, one primitive old: a character
   called *"First-Place Freddie"* or *"Number Three"* answers the ask out loud. Refuse ordinal
   words and digits inside names — and note that this is the SECOND time the class has bitten, so
   generalise the refuse-list rather than re-writing it per port.
5. **`correctAnswer` must agree with `targetPosition`.** The field is `string | number` and both
   forms are live (`checkIdentify` does `Number(correctAnswer)`). Normalize once, then DROP any
   item where they disagree — the tap era never had to justify the pairing.
6. **The ask must name WHICH END is the front.** `context` is one of race / parade / lunch-line /
   train / bookshelf, and `CONTEXT_THEME` gives each a different start label (`START`, `Engine`,
   `Left`). "Third" is meaningless without it, the child cannot read the label, and counting from
   the wrong end is the primitive's #1 recorded misconception. **Code-own the ask and state the
   front aloud** (*"Start at the engine…"*).
7. **Session-wide dedup on (line, position).** The `characters` array is the SAME across the
   challenges of one session, so a second item about the same position is recall, not skill —
   and its half-two bites here in a way it did not on compare-objects: on Direction A an
   already-named character coming back as the answer is free. Keep the two sets separate (port 7
   merged them and ran the pool dry).

---

## 5. The judging contract — the signature errors are unusually good here

Two of them, both fluent and confident, both already documented in `commonStruggles`:

- **Counting from the wrong end.** On a line of five, target 2nd, the child says *"fourth"*
  (position `n + 1 − k`). Name it in `discriminationFor` and compute the wrong-end ordinal in code
  so the clause is exact per item. This is also the harness's `signatureWrong`.
- **Cardinal for ordinal** — *"three"* for *"third"*. `commonStruggles` row 2 calls it out, and it
  is the misconception the mode exists to teach against, so it is **WRONG and corrected**, never
  leniently accepted. This is the pack's sharpest teaching moment; the correction is where
  *"three is how many, third is which one"* gets said.

**Accept clause:** *"the third one"*, *"third place"* and the bare *"third"* all count. On
Direction A accept the character's name alone or any words naming only that character; a pointing
word with no name (*"that one"*) is NOT an answer — treat it as wrong and let the correction re-ask
(`compare-objects` shipped this exact clause; do not invent a second one, and do not write a branch
that produces a sentiment instead of a verdict — that is 18d on the accept side).

**Acoustic note for the mic row, not a block:** `fourth`/`fifth` and `sixth`/`seventh` are the two
near-pairs in `first..tenth`. The class record says "no homophone cluster" and that is right at the
word level, but a five-year-old saying *"fourf"* is real. Accept clause, then hear it.

---

## 6. What gets deleted

`handleCheckAnswer` and all four checkers (`checkIdentify`, `checkMatch`, `checkRelativeOrStory`,
`checkBuildSequence`), the Check control, the Next control, the multiple-choice option rows
(relative-position + sequence-story), the match grid, the tap-to-select on the character line
(Direction A and B are both spoken), the feedback strings that name the position
(*"That's the ${ordinal} position"* — an answer print), `useLuminaAI` and all of its `sendText`
turns, and `tutorRevealPolicy` (the per-tier prose governing improvised turns).

**Survives:** the character line itself, `highlightPosition` (the ask names the anchor, so it is
public), the context theming, `showSlotLabels` on `build_sequence` (the slots are the page), and
the render-side tier levers — minus the label leak in §4.1.

---

## 7. Gates + close

Standard, per the skill §7-8 — no per-primitive deviation. Two pointers worth pre-loading:

- **The live probe is where the content faults surface.** On `compare-objects` it took THREE probe
  rounds: round 1 exposed the name leak, round 2 exposed that the first fix's exemption was wrong.
  Budget for that; a single clean round is not evidence the gates are right.
- **`gemini-ordinal-line.ts` is on the 33-generator silent-fallback list** (20 `fallback` sites).
  Its fallback challenges must pass the new build gates, or a degraded session ships EMPTY rather
  than degraded — `compare-objects` hit exactly this (its `order_three` fallback was pre-sorted
  into the answer order and the gate dropped it).
- Close into `qa/di/BACKLOG.md` item 18, file a mic row, update the WORKSTREAMS math row.

---

## 8. Open decisions — do not resolve these silently

1. **§3's band split (Direction A @ K / Direction B @ G1) is a RECOMMENDATION, not a ruling.** The
   alternative is two eval modes with their own βs, which costs a catalog change and an IRT
   re-anchor. Take the recommendation unless the port finds a reason; record which.
2. **Do `isSayableName` / `namesEarSeparable` / the ordinal refuse-list get lifted to a shared math
   module?** Three primitives will want them after this port. The family's own precedent is that
   copies drift — but a premature shared module is how `numberWordFor` ended up in two copies.
   Decide once, at port time, and say so.
3. **`sequence_story` may need the ASS story gates.** If `storyText` can state the position the
   child must produce, `storyLeaksAnswer`'s analogue is owed; check a live draw before assuming.
