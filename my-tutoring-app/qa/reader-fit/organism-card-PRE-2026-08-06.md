# Reader Fit: organism-card @ PRE — 2026-08-06

Item **15B / S15** — the **final** item in the SCAFFOLD-GAP class.

Modes audited: explore | Probes: eval-test ✓ (K + G4 control) ·
tutor-test Tier 1 ✓ · jsdom render ✓ | Live audio: NOT run (see residuals)

## Verdict

**Overall: READY at PRE.** The card shape — a picture and a few facts — is right
for K. Everything printed on it was text a five-year-old cannot read, and there
was no way to hear any of it.

---

## Finding 1 — SCAFFOLD-GAP (queued). Fix: CATALOG + COMPONENT.

No `tutoring` block, no `useLuminaAI`. Added a catalog block (6 contextKeys,
3 levels, 5 struggles, 1 aiDirective) + 3 moments: `[ORGANISM_ORIENT]`,
`[ORGANISM_FACT_OPENED]`, `[ORGANISM_READ_ALOUD]`.

The PRE directive forbids two specific things and supplies replacements: **the
scientific name** (a Latin binomial is not sayable to a five-year-old) and
**measurements** (*"say 'about as big as you' or 'heavier than a car'"*).

## Finding 2 — THE SCAFFOLD PROMISED AN INTERACTION THAT DID NOT EXIST.

The first draft of the catalog block said the student *"taps a fact to open it"*
and carried an `[ORGANISM_FACT_OPENED]` directive. `tutor-test` immediately
returned `directive-tag-never-emitted` — because the fact boxes were **static
`<div>`s**. Nothing was tappable.

Two honest resolutions: delete the promise, or make it true. **Made it true**,
because the audit needed it anyway: at K-2 the card is five facts, all text, and
the header read-aloud only covers name, habitat, diet and the fun fact — *size*
and *locomotion* had no spoken twin at all. Each fact box is now a button at
K-2 that reads its own label and value aloud. At 3-5 they stay plain divs.

This is the second time in the sweep that `tutor-test`'s dead-tag check caught a
scaffold describing a primitive that did not exist (S10 was the first). The
check is earning its place.

## Finding 3 — PROSE-KEYED BAND MAP (the fifth and last copy). Fix: GENERATOR.

Probe at `grade=K` before the fix: `gradeBand: '3-5'` with **8 attributes**,
against a catalog K-2 rung reading *"K-2 shows only basic attributes with simple
language"*.

Fixed by importing the shared `resolveBiologyBand` extracted in S13 — **no fifth
copy of the resolver was written.** All four biology generators that carried the
broken lookup (classification-sorter, life-cycle-sequencer, habitat-diorama,
organism-card) now resolve through one module.

## Finding 4 — PRIMITIVE-GAP, not in the triage. Fix: COMPONENT.

| Offender at K-2 | Rule |
|---|---|
| `Balaenoptera musculus` (Latin binomial) | 7 — and the scaffold forbids saying it |
| `Animalia` kingdom badge | 7 |
| `Grade Band: 3-5` developer readout | 7 |
| five fact boxes with no spoken twin | 1 |

All gated at K-2, all kept at 3-5.

---

## Audit A — text census (K-2 rung)

| String | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| organism.commonName | title | load-bearing | `[ORGANISM_ORIENT]` + 🔊 | COVERED |
| habitat / diet / size / locomotion values | fact boxes | load-bearing | **each box now speaks itself** | COVERED |
| funFact | footer card | load-bearing | own 🔊 + included in the header read-aloud | COVERED |
| organism.scientificName | subtitle | jargon | — | REMOVED at K-2 |
| organism.kingdom badge | header | jargon | — | REMOVED at K-2 |
| "Grade Band: 3-5" | header | debug chrome | — | REMOVED at K-2 |
| attribute LABELS ("HABITAT") | fact boxes | supportive | spoken with the value | COVERED |

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| explore | ✅ `[ORGANISM_ORIENT]` names the organism, invites exploring | ✅ **every fact individually voiced**, plus a whole-card read-aloud | ✅ ORIENT states the task ("tap the little boxes") — and it is now true | ✅ tapped box depresses; the tutor answers | ✅ 5 struggles incl. big≠dangerous and skipping the facts |

## Audit C — band contract (PRE)

| Rule | PASS/FAIL | Note |
|---|---|---|
| 1 Audio is the instruction channel | PASS | **was FAIL** — no channel at all |
| 2 Tap = choose | PASS | reading a card is not a choice task; taps are atomic |
| 3 Pictures are the answer surface | PASS | the organism image is the centre of the card |
| 4 One thing to do per screen | PASS | one card, 4 facts + a fun fact at K-2 |
| 5 Feedback on the touched object | PASS | tap a fact → hear that fact |
| 6 No typing | PASS | none |
| 7 No adult chrome | PASS | **was FAIL** — binomial, kingdom, band readout |
| 8 Assessment in the mechanics | N/A | reference card, no evaluation hook — by design |

---

## Gates

| Gate | Result |
|---|---|
| jsdom render test | `OrganismCard.reader-fit.test.tsx` **12/12** |
| **Revert-bite (PRE gate)** | **5/12 fail** with `isPreReader = false` |
| Shared resolver tests | `gradeBand.test.ts` 13/13 — now **4 consumers** |
| `tsc --noEmit` (src-scoped) | **803 = baseline, zero new** |
| `typecheck:lumina` | 0 errors |
| Full vitest | **1978/1978** |
| tutor-test Tier 1 | `pass`, 0 findings, 3 tags, 6/6 bag keys resolvable |

### Runtime A/B

| | pre-fix @ K | post-fix @ K | G4 control |
|---|---|---|---|
| `gradeBand` | `'3-5'` ❌ | **`'K-2'`** | `'3-5'` |
| `visibleFields` | 8 attributes ❌ | **habitat, diet, size, locomotion, funFact** | 9 incl. bodyTemperature, reproduction, specialAdaptations |
| `bodyTemperature` | present ❌ | **null** | `'cold-blooded'` |

---

## Residuals (open)

- **No Tier-3 live audio run.** Folded into HUMAN-CHECKS #73.
- **No evaluation hook** — a reference card by design; rule 8 is N/A. This is
  the third of the eight (with S11, S12) with no measurement path. The catalog
  positions it as the "unit of biology content" to be used *alongside* graded
  primitives, so that reads as correct rather than as a gap — but it should not
  be routed assessment demand.
- **0 eval modes.**
- **Image is generated on demand** via a button; at K-2 that button is still a
  text-labelled control. It was left alone because the image path is a separate
  concern from this sweep, but a K child cannot invoke it unaided.
