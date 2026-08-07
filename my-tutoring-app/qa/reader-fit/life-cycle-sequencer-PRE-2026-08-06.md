# Reader Fit: life-cycle-sequencer @ PRE — 2026-08-06

Item **15B / S13** of the reader-fit supply-side sweep.

Modes audited: sequence | Probes: eval-test ✓ (K + G4 control) ·
tutor-test Tier 1 ✓ · jsdom render ✓ | Live audio: NOT run (see residuals)

## Verdict

**Overall: READY at PRE.** Triage risk was **3** — the lowest in the Class-B set
— and the ordering interaction really is K-fit. It still needed a component
band-gate pass, which is now 5 slices out of 6.

---

## Finding 1 — SCAFFOLD-GAP (queued). Fix: CATALOG + COMPONENT.

No `tutoring` block, no `useLuminaAI`. Added a catalog block (8 contextKeys,
3 levels, 5 struggles, 2 aiDirectives) + 3 moments: `[CYCLE_ORIENT]`,
`[CYCLE_STAGE_PLACED]`, `[CYCLE_READ_ALOUD]`.

**The answer discipline here is unusually tight, because the ANSWER IS AN
ORDER.** Naming even one position — *"the egg comes first"* — gives away a piece
of it. So the `ORDER IS THE ANSWER` directive forbids stating the sequence,
forbids confirming or denying a placement before the student checks, and draws
the line explicitly: *describing what is happening IN a picture is the stimulus
and is free; saying where it goes is the answer and is not*. `[CYCLE_STAGE_PLACED]`
carries the same clause, and the ORIENT beat is tested to contain no
first-stage claim.

## Finding 2 — PRIMITIVE-GAP, not in the triage. Fix: COMPONENT.

| Offender at K-2 | Rule |
|---|---|
| `stage.imagePrompt` rendered as visible card text | leak — *"a female butterfly laying a tiny egg on a milkweed leaf"* |
| select-a-card then target-a-slot (two acts) | 2 |
| `{data.gradeBand}` badge in the header | 7 |
| `scaleContext` prose ("about 4 weeks from egg to butterfly") | 7 |
| "Available Cards (4)" live tally | 7 |
| "Drop stage here" / "Tap or drop to place" in every slot | 1 |

**The protocol fix:** at K-2, tapping a picture places it in the next empty
slot, so ordering costs **one tap per card**. This is the constellation-builder
`guided_trace` shape ("taps stars in order"), not a new invention. Select-then-
target is untouched at 3-5 and 6-8, where it is a reasonable two-part
construction and the skill's own guidance says tap=choose applies only to atomic
selections.

**`imagePrompt` is removed at every grade**, not just PRE — same call as S9.
It was never student copy.

## Finding 3 — PROSE-KEYED BAND MAP. Fix: SHARED GENERATOR MODULE.

Confirmed by probe at `grade=K` before the fix: `gradeBand: '3-5'`.

Rather than write the S9 resolver a third time, the fix was **extracted to
`service/biology/gradeBand.ts`** (`biologyBandFromGrade` / `biologyBandFromProse`
/ `resolveBiologyBand`) and S9 was re-pointed at it via aliases, so its public
names and its tests are unchanged. S14 and S15 carry the identical broken lookup
and will import the same module.

This is the "close the channel" move: four generators had independently written
the same wrong thing, so the correct behaviour is now obtained **by import
rather than by re-derivation**, and a fifth biology generator gets it for free.

---

## Audit A — text census (K-2 rung)

| String | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| title + instructions | header | load-bearing | 🔊 (`lg`) + `[CYCLE_ORIENT]` | COVERED |
| stage.label | cards + slots | load-bearing | `[CYCLE_STAGE_PLACED]` names it | COVERED |
| stage.description | expanded card | load-bearing | voiced on placement | COVERED |
| stage.imagePrompt | card image area | **leak** | — | REMOVED at all grades |
| "Drop stage here" / "Tap or drop to place" | slots | load-bearing protocol | ORIENT states it | REMOVED at K-2 |
| "Available Cards (4)" | pool heading | chrome | — | REMOVED at K-2 |
| `K-2` band badge | header | chrome | — | REMOVED at K-2 |
| scaleContext | header | supportive prose | — | REMOVED at K-2 |
| slot numbers (1,2,3) | slots | supportive | — | kept (numerals are not text at PRE) |

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| sequence | ✅ `[CYCLE_ORIENT]`, states the task, withholds the order | ✅ each placed picture named + described | ✅ ORIENT says "the order they really happen, starting with the very first" | ✅ card moves into the slot on tap; check produces per-slot marks | ✅ 5 struggles incl. size-vs-time and the circular-cycle confusion |

## Audit C — band contract (PRE)

| Rule | PASS/FAIL | Note |
|---|---|---|
| 1 Audio is the instruction channel | PASS | **was FAIL** — protocol lived in slot text |
| 2 Tap = choose | PASS | **was FAIL** — select-then-target; now one tap places |
| 3 Pictures are the answer surface | PARTIAL | cards are a Sparkles glyph + a word label; no image pipeline is wired (same as S9) |
| 4 One thing to do per screen | PASS | pool + timeline, tally and prompts removed |
| 5 Feedback on the touched object | PASS | the card visibly moves into its slot |
| 6 No typing | PASS | none |
| 7 No adult chrome | PASS | **was FAIL** — badge, tally, scale prose |
| 8 Assessment in the mechanics | PASS | the order IS the measurement |

---

## Gates

| Gate | Result |
|---|---|
| Shared resolver tests | `gradeBand.test.ts` **13/13** |
| jsdom render test | `LifeCycleSequencer.reader-fit.test.tsx` **11/11** |
| S9 regression through the refactor | `gemini-classification-sorter.reader-fit.test.ts` **13/13** still green |
| **Revert-bite (both)** | **10/24 fail** with map semantics + `isPreReader=false` |
| `tsc --noEmit` (src-scoped) | **803 = baseline, zero new** |
| `typecheck:lumina` | 0 errors |
| Full vitest | **1953/1953** |
| tutor-test Tier 1 | `pass`, 0 findings, 3 tags |

### Runtime A/B

| | pre-fix @ K | post-fix @ K | G4 control |
|---|---|---|---|
| `gradeBand` | `'3-5'` ❌ | **`'K-2'`** | `'3-5'` |
| stage prose register | *"The female butterfly lays a tiny egg on a milkweed leaf. The egg contains…"* | **"A mama butterfly lays a tiny egg on a leaf. It is so small you can barely…"** | adult register retained |

The register shift is the clearest evidence yet that the band now reaches the
prompt — same topic, same stage, different child.

---

## Residuals (open)

- **No Tier-3 live audio run.** Folded into HUMAN-CHECKS #73.
- **Rule 3 only PARTIAL** — the "pictures" are a Sparkles placeholder plus a word
  label; `imagePrompt` exists in the data but no image pipeline is wired for
  this primitive. Same residual as S9, same reasoning: the tutor voices every
  card, so the child is not blocked. If K biology demand grows, wiring images
  for classification-sorter and life-cycle-sequencer together is one slice.
- **0 eval modes.**
- **S14 and S15 still carry the prose-keyed map** — they now have a shared module
  to import instead of a fourth and fifth copy.
