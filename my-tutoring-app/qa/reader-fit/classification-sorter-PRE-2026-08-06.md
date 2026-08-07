# Reader Fit: classification-sorter @ PRE — 2026-08-06

Item **15B / S9** of the reader-fit supply-side sweep.

Modes audited: single sort flow | Probes: eval-test ✓ (K + G4 control) ·
tutor-test Tier 1 ✓ · Tier 2 `--probe` @ K ✓ · jsdom render ✓ |
Live audio: NOT run (see residuals)

## Verdict

**Overall: READY at PRE** — but the queued verdict was **incomplete**. The
triage classified this SCAFFOLD-GAP ("tap/drag creatures into groups", risk 6),
i.e. the interaction is fine and only the voice is missing. The voice was
indeed missing, but the interaction was **not** fine: the only way to place an
item was HTML5 drag-and-drop. Three defects closed here, two of them unqueued.

---

## Finding 1 — SCAFFOLD-GAP (the queued one). Fix: CATALOG + COMPONENT.

No `tutoring` block, no `useLuminaAI`. Every channel to the student was text:
the item label, the group names, the group descriptions, the sorting-rule
badge, the instructions and the hints. A non-reader had nothing.

**Fixed:** catalog `tutoring` block (8 contextKeys, 3 levels, 5 struggles,
2 aiDirectives) + component channel with 6 moments — `[SORT_ORIENT]`,
`[SORT_ITEM_STAGED]`, `[SORT_ITEM_TAP]`, `[SORT_INCORRECT]`,
`[SORT_ALL_COMPLETE]`, `[SORT_READ_ALOUD]`.

**The answer/question split is the pedagogically load-bearing part here.** For a
sorter, the *rule* and the *group names* are the QUESTION — a non-reader must
hear them repeatedly or the task is unstateable. The *correct group for this
item* is the ANSWER. So the scaffold says the first freely and is explicitly
forbidden the second, including by elimination:

> `Never name it, never hint at it by elimination ("it is not the other one"),
> and never read the item's hint text aloud before they have tried.`

`[SORT_ITEM_STAGED]` carries the same clause, and `[SORT_INCORRECT]` deliberately
does **not** interpolate `correctCategoryId` — only the item, the group they
chose, and the rule. Locked by tests that assert the answer string is absent
from those messages.

## Finding 2 — PRIMITIVE-GAP, NOT in the triage. Fix: COMPONENT.

`draggable` + `onDragStart`/`onDrop` was the sole placement path. HTML5 drag is
not a protocol a five-year-old executes, and it is a two-part act (which item →
which bin) against PRE contract rule 2.

**Fixed with the WordSorter PRE precedent** rather than a new invention: at K-2
exactly **one item is staged** at a time and the group cards become the answer
buttons, so the two-part drag collapses to **tap-a-group = choose**. The item
pool (and its "(N remaining)" counter) disappears, satisfying rule 4 as well.
Tapping the staged card replays its name. Drag remains untouched at 3-5 and 6-8.

Both protocols funnel through **one** `placeItem()` so scoring, feedback and the
tutor moment cannot drift apart between bands.

## Finding 3 — GRADE-BLIND GENERATOR, found by probe. Fix: GENERATOR.

Pre-fix probe at `grade=K` returned **`gradeBand: '3-5'` with THREE categories**,
against a catalog K-2 rung that reads *"Binary sorts only (2 categories)"*.

Mechanism, `gemini-classification-sorter.ts:152` (pre-fix):

```ts
const gradeBand = config.gradeBand || gradeBandMap[ctx.gradeContext] || '3-5';
```

`gradeBandMap` is keyed on bare tokens (`'K'`, `'1'`, … `'8'`) but indexed with
`ctx.gradeContext`, which is **prose**. The lookup therefore missed on *every*
input at *every* grade and the `|| '3-5'` default always won. This is the
biology flavour of the same `14m` class S8 hit — a different mechanism (map
lookup vs regex) with an identical signature, so **grepping for the S8 pattern
would have missed it**.

Same compounding as S8: the new `isPreReader` gate keys off `data.gradeBand`, so
a generator that can never emit `'K-2'` would have left it dead code.

**Fixed:** exported `classificationBandFromGrade()` (canonical-first, null when
absent) `??` `classificationBandFromProse()` — and the prose fallback was
*rewritten* to actually parse prose, since the old map could never match one.

## Incidental — `imagePrompt` rendered as student copy

`renderItem` printed `item.imagePrompt` as italic body text under every label.
That field is an image-GENERATION instruction ("a red-breasted robin on a
branch"). Prompt-engineering was in the child's field **at every grade**, not
just PRE. Removed; locked by a test.

---

## Audit A — text census (K-2 rung)

| String | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| title + instructions | header | load-bearing | 🔊 read-aloud (`lg` at PRE) + `[SORT_ORIENT]` | COVERED |
| sortingRule badge | header | load-bearing | spoken in ORIENT + read-aloud; repeated on every wrong placement | COVERED |
| item label | staged card | load-bearing | `[SORT_ITEM_STAGED]` + tap-to-replay + "Say it again" | COVERED |
| category labels | group cards | load-bearing | spoken in ORIENT; `aria-label` "Put it in X" | COVERED |
| category descriptions | group cards | supportive | — | REMOVED at K-2 |
| "Progress: 3 / 8 items sorted correctly" + % | progress bar | chrome | — | REMOVED at K-2 |
| "Items to Sort (5 remaining)" | pool header | chrome | — | REMOVED at K-2 (pool replaced by the stage) |
| "Grade Band: K-2" | debug readout | chrome | — | REMOVED (dev-only now) |
| item.imagePrompt | item card | **leak** | — | REMOVED at all grades |
| item.hint (on error) | error card | load-bearing | `[SORT_INCORRECT]` paraphrases without the answer | COVERED |

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| sort | ✅ `[SORT_ORIENT]` on mount, states rule + groups | ✅ every staged item voiced; rule re-spoken on error | ✅ the rule IS the disambiguator and is spoken freely; groups named by voice | ✅ zone flash + SFX on the touched card, plus a spoken struggle response | ✅ 5 struggles incl. boundary cases + an explicit pre-reader clause |

## Audit C — band contract (PRE)

| Rule | PASS/FAIL | Note |
|---|---|---|
| 1 Audio is the instruction channel | PASS | ORIENT + per-item voicing; no text gates progress |
| 2 Tap = choose | PASS | **was FAIL** — drag-only; now one staged item + tappable groups |
| 3 Pictures are the answer surface | **PARTIAL** | items are still word cards. `imagePrompt` exists but no image pipeline is wired for this primitive — see residuals |
| 4 One thing to do per screen | PASS | **was FAIL** — full pool + N bins; now 1 card + 2 bins |
| 5 Feedback on the touched object | PASS | zone pop/shake + SFX land on the tapped group |
| 6 No typing | PASS | none |
| 7 No adult chrome | PASS | **was FAIL** — progress fraction, %, remaining-counter and a literal debug readout all gated off |
| 8 Assessment in the mechanics | PASS | the sort itself is the measurement |

---

## Gates

| Gate | Result |
|---|---|
| Focused tests | `gemini-classification-sorter.reader-fit.test.ts` **13/13** |
| **Revert-bite (band resolver)** | **5/13 fail** with the prose-keyed map restored |
| jsdom render test | `ClassificationSorter.reader-fit.test.tsx` **12/12** |
| **Revert-bite (PRE gate)** | **6/12 fail** with `isPreReader = false` |
| `tsc --noEmit` (src-scoped) | **803 vs 804 baseline — one FEWER, zero new** |
| `typecheck:lumina` | 0 errors |
| Full vitest | **1853/1853** |
| tutor-test Tier 1 | `pass`, 0 findings, 6 tags |
| tutor-test Tier 2 `--probe` @ K | 14/14 vars `resolvedBy: component`; no literal `(not set)` |

### Runtime A/B

| | pre-fix @ K | post-fix @ K | G4 control |
|---|---|---|---|
| `gradeBand` | `'3-5'` ❌ | **`'K-2'`** | `'3-5'` unchanged |
| categories | 3 ❌ | **2** (Has Wings / No Wings) | 3 (Birds/Insects/Mammals) unchanged |

---

## ⚠️ Methodology note — the absolute tsc count is not a stable gate here

Measured this slice: the same unchanged tree reported **805**, then **806**,
then **807**. The drift is **not** source — it is `.next/types/app/**`, which
tsconfig includes and which the *running dev server regenerates* while these
probes run. The two floating errors were stale route types for a deleted
`dev-scene-probe` page.

Since every reader-fit slice needs the dev server up (eval-test / tutor-test),
this will recur for S10–S15. **Gate on the `src/`-scoped error SET diff**
(`comm -13 baseline current`), not on the total. Recorded because a future
session comparing against "805" from the S8 report will chase a phantom.

*(Same cause resolved an S8 residual: `typecheck:lumina` was run before the
jsdom test file was added, so a `/u`-flag regex error in it went unseen until
this slice. Fixed here — S8's other gates are unaffected.)*

---

## Residuals (open)

- **No Tier-3 live audio run.** → HUMAN-CHECKS (folded into the S8 row's sitting).
- **Rule 3 is only PARTIAL.** Item cards are words, not pictures. The data
  carries `imagePrompt` per item but nothing renders images for this primitive.
  Making the answer surface pictorial is a real follow-on, not a gating fix —
  the tutor now voices every card, so the child is not blocked. Queue as a
  picture-surface item if K sorting demand grows.
- **0 eval modes** — `/add-eval-modes` is a separate layer.
- **The prose-keyed-map defect is shared by S13/S14/S15** (life-cycle-sequencer,
  habitat-diorama, organism-card all use `gradeBandMap[ctx.gradeContext]`).
  Confirmed by reading, to be confirmed per-primitive by probe.
