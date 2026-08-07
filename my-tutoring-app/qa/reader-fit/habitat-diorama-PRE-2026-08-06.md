# Reader Fit: habitat-diorama @ PRE — 2026-08-06

Item **15B / S14** of the reader-fit supply-side sweep.

Modes audited: explore | Probes: eval-test ✓ (K + G4 control) ·
tutor-test Tier 1 ✓ · jsdom render ✓ | Live audio: NOT run (see residuals)

## Verdict

**Overall: READY at PRE.** This slice has the most interesting shape in the set:
**the component was already written band-aware and its band gates had never
run.**

---

## Finding 1 — FIVE CORRECT BAND GATES, ALL DEAD CODE. Fix: GENERATOR.

`HabitatDiorama.tsx` carries five `data.gradeBand !== 'K-2'` conditions —
disruption scenario, relationship overlay, the relationships panel inside the
info card, the 6-8 relationship descriptions, and the legend descriptions. The
author did the right thing.

None of them had ever fired, because the generator resolved its band with the
S9 prose-keyed map, so `'K-2'` was never emitted. Probe at `grade=K` **before**
the fix:

```
gradeBand: '3-5'
organisms: 7          ← catalog K-2: "4-5 recognizable organisms"
relationships: 4      ← catalog K-2: "basic predator-prey relationships only"
disruptionScenario: present   ← catalog K-2: "NO disruption scenario (too complex)"
```

Fixed by importing the shared `resolveBiologyBand` extracted in S13. **The
generator fix is what turns the component author's original intent back on** —
most of this slice's PRE improvement came from deleting one broken lookup, not
from writing new gates.

Worth stating plainly, because it changes how the remaining backlog should be
read: *a component containing band-gating code is not evidence that band-gating
happens.* Only a probe at the band is.

## Finding 2 — SCAFFOLD-GAP (queued). Fix: CATALOG + COMPONENT.

No `tutoring` block, no `useLuminaAI`. Added a catalog block (7 contextKeys,
3 levels, 5 struggles, 2 aiDirectives) + 3 moments: `[HABITAT_ORIENT]`,
`[HABITAT_ORGANISM_SELECTED]`, `[HABITAT_READ_ALOUD]`.

Two scaffold decisions:

**A no-jargon rule at PRE.** The directive forbids *producer, consumer,
decomposer, herbivore, carnivore, trophic* with a pre-reader and supplies the
replacement: *"it makes its own food from sunshine"*, *"it eats plants"*, *"it
hunts other animals"*. Dropped at 3-5 where that vocabulary is the objective
(asserted both ways).

**`NOTHING HERE IS THE VILLAIN`.** Young children reliably read predators as
mean and prey as victims. The directive forbids reinforcing that framing even
playfully and tells the tutor to reframe to what the animal *needs*. One of the
five `commonStruggles` covers the same ground.

## Finding 3 — PRIMITIVE-GAP, not in the triage. Fix: COMPONENT.

**The roles legend was gated backwards.** At K-2 the existing code hid each
role's *description* but kept the five *terms* — Producer, Primary Consumer,
Secondary Consumer, Tertiary Consumer, Decomposer. That is strictly worse than
leaving it alone: five pieces of undecodable technical vocabulary with their
explanations removed. The whole legend is now hidden at K-2 and shown **with**
its descriptions at 3-5.

**The organism buttons had no accessible name at all.** The scene is emoji-only
by design — which is correct at PRE (rule 3, pictures are the answer surface) —
but the buttons carried no `aria-label`, so assistive tech announced nothing on
any of them. Names added to organisms and environmental features. This is an
accessibility fix at every grade, not a PRE-only one.

The role badge on the info card is also gated at K-2, matching the scaffold's
own prohibition: if the tutor may not say "primary consumer", the screen should
not print it.

---

## Audit A — text census (K-2 rung)

| String | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| organism.commonName | info card + `aria-label` | load-bearing | `[HABITAT_ORGANISM_SELECTED]` + ORIENT lists them | COVERED |
| organism.description | info card | load-bearing | 🔊 "Tell me about the …" | COVERED |
| organism.role badge | info card | jargon | — | REMOVED at K-2 |
| "Organism Roles:" legend (5 terms) | footer | jargon | — | REMOVED at K-2 (was half-removed) |
| "Relationships:" panel | info card | load-bearing | — | already gated by the author; now actually gated |
| disruption scenario prose | panel | load-bearing | — | already gated; now actually gated |
| adaptations bullets | info card | supportive | — | kept (short phrases) |

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| explore | ✅ `[HABITAT_ORIENT]` names every living thing | ✅ each tapped organism voiced in child words | ✅ ORIENT states the task ("tap an animal or plant to find out about it") | ✅ tapped organism scales up + gets a viewed dot | ✅ 5 struggles incl. plants-are-alive and predators-aren't-villains |

## Audit C — band contract (PRE)

| Rule | PASS/FAIL | Note |
|---|---|---|
| 1 Audio is the instruction channel | PASS | **was FAIL** — no channel existed |
| 2 Tap = choose | PASS | tapping an organism is atomic and always was |
| 3 Pictures are the answer surface | PASS | emoji scene; the strongest of the eight on this rule |
| 4 One thing to do per screen | PASS | **was FAIL** — 7 organisms + relationships + disruption + legend; now 4 organisms and a scene |
| 5 Feedback on the touched object | PASS | scale-up + viewed marker on the tapped creature |
| 6 No typing | PASS | none |
| 7 No adult chrome | PASS | **was FAIL** — role badge + half-gated jargon legend |
| 8 Assessment in the mechanics | PARTIAL | `submitResult` exists and tracks viewed organisms; there is no challenge, so it measures exposure rather than understanding |

---

## Gates

| Gate | Result |
|---|---|
| jsdom render test | `HabitatDiorama.reader-fit.test.tsx` **13/13** |
| **Revert-bite (PRE gate)** | **4/13 fail** with `isPreReader = false` |
| Shared resolver tests | `gradeBand.test.ts` 13/13 (unchanged, now 3 consumers) |
| `tsc --noEmit` (src-scoped) | **803 = baseline, zero new** |
| `typecheck:lumina` | 0 errors |
| Full vitest | **1966/1966** |
| tutor-test Tier 1 | `pass`, 0 findings, 3 tags, **7/7 bag keys statically resolvable** |

### A tutor-test finding worth keeping

The first Tier-1 run returned `context-key-unresolvable` WARNs on every
contextKey, with the hedge *"(bag has dynamic keys — verify at runtime)"*. Cause:
`aiPrimitiveData` was assembled behind a local statement inside the `useMemo`,
so the static analyzer could not see the object literal. Restructured to a flat
literal with the lookup hoisted → all 7 keys resolve. **A bag built behind
statements turns a real check into a shrug** — worth doing in every primitive.

### Runtime A/B

| | pre-fix @ K | post-fix @ K | G4 control |
|---|---|---|---|
| `gradeBand` | `'3-5'` ❌ | **`'K-2'`** | `'3-5'` |
| organisms | 7 ❌ | **4** | 6 |
| relationships | 4 ❌ | **2** | 5 |
| disruption scenario | present ❌ | **absent** | present |

---

## Residuals (open)

- **No Tier-3 live audio run.** Folded into HUMAN-CHECKS #73.
- **Rule 8 only PARTIAL** — the primitive submits a result based on how many
  organisms were viewed, i.e. exposure, not understanding. Not a PRE problem
  (nothing blocks the child) but it means routing assessment demand here buys
  little. Same family of concern as S11/S12's missing hooks.
- **0 eval modes.**
- **The emoji for each organism is chosen by string-matching `imagePrompt`**
  (`imagePrompt.includes('bird')` → 🦅, else falls through to 🐰). A forest
  scene whose prompts do not contain those substrings silently renders rabbits
  for everything. Not band-specific and not blocking, but it is a content-
  fidelity bug worth its own item if biology scenes get more use.
