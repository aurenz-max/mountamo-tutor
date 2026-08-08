# Reader Fit: bio-compare-contrast @ PRE — 2026-08-07

Item **15A / S5** of the supply-side sweep. Worked under the ruling that overturned
15A's band-floor theory ([[feedback_make-age-friendly-not-band-floor]]): if the
curator routes a primitive at a grade, make it work at that grade.

Modes audited: `side-by-side`, `venn-interactive` (the primitive declares 0 eval
modes; these are its two display modes and they are different task identities).
Probes: eval-test ✓ (K, G1, G4 control, pre- and post-fix; plus a second K draw on
a different topic) · tutor-test Tier 1 ✓ + Tier 2 `--probe` ✓ · **real Chrome
drive ✓** (K-2 venn, K-2 side-by-side, 3-5 control) · live audio ✗ (→ HUMAN-CHECKS).

**Overall: SCAFFOLD-GAP + PRIMITIVE-GAP → now READY at PRE.**
Not WRONG-BAND. The comparative act ("does this belong to A, to B, or to both?")
is genuinely K-fit; what failed was the channel, the protocol, the chrome — and,
unexpectedly, the answer key itself.

---

## What the queue predicted, and what was actually there

The handoff predicted a **fourth grade-shape**: `gradeBand` is a function
parameter defaulting to `'3-5'`, so the defect would be at the CALL SITE. **That
was right about the location and wrong about the shape.** The call site
(`registry/generators/biologyGenerators.ts:260`) held a verbatim **fifth copy of
the S9 biology map**:

```ts
const gradeBandMap: Record<string, 'K-2'|'3-5'|'6-8'> = { 'K': 'K-2', … };
const gradeBand = config.gradeBand || gradeBandMap[ctx.gradeContext] || '3-5';
```

keyed on grade TOKENS, indexed with `ctx.gradeContext` PROSE. `gemini-compare-contrast.ts`
itself is clean — which is exactly why a grep over `service/biology/*.ts` for the
other four copies missed it. **The lesson generalises: a generator with a clean
body can still be grade-blind if its band arrives as an argument.**

Fixed by importing the shared `resolveBiologyBand` from `service/biology/gradeBand.ts`
(S13's resolver, now used by five call sites). **No fifth copy written.**

---

## Audit A — text census

Pre-fix the primitive had **NO channel to a non-reader at all**: no catalog
`tutoring` block and no `useLuminaAI`/`sendText` in the component. It was one of
the 26 mute primitives, so *every* load-bearing string was UNCOVERED and
`tutor-test` returned no scaffold.

| String (abridged) | Where | Class | Spoken twin (post-fix) | Verdict |
|---|---|---|---|---|
| `data.title` — "Exploring Plants: Trees and Flowers" | header | supportive | `LuminaReadAloud` + `[COMPARE_ORIENT]` | COVERED |
| Entity names "Tree" / "Flower" | targets + headers | **load-bearing** (they are the answer options) | `[COMPARE_ORIENT]`, per-name read-aloud, image beside each | COVERED |
| The staged characteristic — "Needs to grow: Needs sunlight and water" | staged card | **load-bearing** (it IS the question) | `[COMPARE_ATTRIBUTE_SHOWN]` fires on every change + `LuminaReadAloud size=lg` | COVERED |
| Attribute rows (side-by-side) | comparison grid | **load-bearing** | each row IS a `LuminaReadAloud` at K-2 | COVERED |
| `keyInsight` — a full paragraph | footer card | supportive | `LuminaReadAloud` on "The big idea" | COVERED |
| "Drag each characteristic into the correct region of the Venn diagram: X only, Y only, or Both" | venn instructions | **load-bearing protocol** | — | **gone at K-2** (protocol replaced) |
| "Check My Work" / "Submitted" / "Try Again" | venn controls | load-bearing | — | **gone at K-2** |
| "✗ Should be in **A-only**" | venn feedback | load-bearing + **dev slug** | — | slug replaced by the entity name at every grade |
| `entity.imagePrompt` — "a friendly golden retriever sitting on grass…" | image placeholder + caption | **not student copy at all** | — | **removed at every grade** |
| "Generate Visual" / "Click to generate an AI visualization" | image placeholder | chrome | — | **gone at K-2** |
| "Grade 3-5 • Visual Comparison" | header | chrome | — | **gone at K-2** |

`imagePrompt` printed as visible body text is the **third appearance** of the S9 /
S13 leak — an image-GENERATION instruction rendered at the student. Removed at all
grades, as in both prior slices.

---

## Audit B — sufficiency contract

Pre-fix: structurally FAIL on all five, at both modes — no scaffold existed.

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| venn-interactive @ K-2 | PASS — `[COMPARE_ORIENT]` fires once, names both entities, states the act | PASS — `[COMPARE_ATTRIBUTE_SHOWN]` on every staged change; **the tutor's voice IS the card** | PASS — the beat asks "A, B, or BOTH?" explicitly and is forbidden from ruling any out | PASS — target flashes emerald/rose instantly + `[COMPARE_ANSWERED]` in child words | PASS — 5 struggles incl. the two real ones (everything-in-BOTH, nothing-in-BOTH) |
| side-by-side @ K-2 | PASS — orient states "this one is for looking and listening" | PASS — every row is tappable and reads itself | N/A — nothing to decide | N/A — viewer | PASS |
| both @ 3-5 / 6-8 | PASS | PASS | PASS | PASS | PASS |

**Answer discipline.** The answer here is *which side a characteristic belongs
on*, so the `WHICH SIDE IT BELONGS ON IS THE ANSWER` directive forbids stating it
**and forbids elimination** — "it is not the cat" hands over a three-way answer as
completely as naming it. Describing the characteristic and describing either
picture is the stimulus and is explicitly free. Post-answer reaction is allowed
(that item is finished) but running ahead to unseen items is not.

**Register.** A `NO JARGON AT K-2` directive bans vertebrate / mammal / species /
adaptation / classification / physiological / characteristic / attribute / trait /
organism and supplies the replacements, and is **explicitly dropped at 3-5 and
6-8** where that vocabulary is the objective.

---

## Audit C — band contract (K-2, from the rendered state)

| Rule | Pre-fix | Post-fix | Offender / note |
|---|---|---|---|
| 1 Audio is the instruction channel | **FAIL** | PASS | no channel at all existed |
| 2 Tap = choose | **FAIL** | PASS | HTML5 drag-only + deferred "Check My Work"; now one tap answers and advances (**0 draggables at K-2**, confirmed in Chrome) |
| 3 Pictures are the answer surface | **FAIL** | **PASS (answer) / PARTIAL (stimulus)** | the three targets are real generated photos; the *characteristic* is still words + voice — no picture per attribute exists in the schema |
| 4 One thing per screen, ≤5 elements | **FAIL** (~17 draggables + 3 zones + submit) | **PARTIAL** | 3 targets + 3 read-aloud buttons = 6 |
| 5 Feedback on the touched object | **FAIL** | PASS | was deferred, text-only, and printed `A-only`; now instant flash on the tapped target |
| 6 No typing | PASS | PASS | — |
| 7 No adult chrome | **FAIL** | PASS | grade readout, `imagePrompt`, "Generate Visual", shared-attributes ledger, region slugs — all gated or removed |
| 8 Assessment in the mechanics | **FAIL** | PASS (venn) / N/A (side-by-side) | the tap task IS the comparison; side-by-side is a viewer by design (S11/S15 posture) |

---

## Two answer-key defects, at EVERY grade, unqueued

Found while building the K path on top of the existing key. Both are CLAUDE.md #1.

**1. The B-only region was structurally unreachable.** Entity B's attributes were
filtered with `!entityA.attributes.some(a => a.category === b.category)` while the
generator prompt explicitly demands *"Use the SAME categories as Entity A where
comparing the same aspect"*. The two rules cancel. Measured on live draws:

| draw | entityA | entityB | shared | **B-only cards kept** |
|---|---|---|---|---|
| K | 7 | 7 | 3 | **0** |
| G1 | 8 | 8 | 3 | **0** |
| G4 | 8 | 8 | 4 | **0** |

One of the three Venn regions was never correct for anything, at any grade — and
it makes the K three-target task unanswerable, which is why this was fixed here
rather than filed. Post-fix the same K draw yields **A-only 3 / shared 2 / B-only 3**.

**2. The key could contradict itself.** A shared attribute was emitted both as an
entity-A card (`'A-only'`) and as a shared card (`'shared'`); placements are keyed
on `category: value`, so when those strings matched, one card carried two answers.
Run the generator's **own K-2 example** (Dog vs Cat) through the old builder and a
perfect player is capped at **60%**. It stayed hidden on the three live draws only
because Gemini wrote longer distinct prose for the shared entries — **the shorter
the values, the likelier it fires, i.e. it fires hardest at the youngest band.**

Fixed in one exported, tested helper (`buildComparisonItems`) with a deliberately
narrow rule: *identical text cannot carry two different answers*. `isShared` is
**not** trusted as a region signal on its own, because its value is often
entity-specific prose ("Vertebrate mammal belonging to the canine family") which
would be wrong in the middle of a Venn.

---

## A shipped regression this slice found in 15B

**`BiologyPrimitivesTester` had no `LuminaAIProvider`.** `useLuminaAI` does not
degrade — it throws `useLuminaAIContext must be used within a LuminaAIProvider`.
Five biology primitives now call it: `classification-sorter` (S9),
`life-cycle-sequencer` (S13), `habitat-diorama` (S14), `organism-card` (S15) and
this one. **The first four shipped in 15B and crash the biology tester today.**

It went unnoticed because all four 15B biology slices verified in **jsdom, which
mocks the hook**, and none drove the tester in a browser. The astronomy tester
already carries the wrapper; the biology one never got it. Fixed here (one import
+ one wrapper), which is also what unblocked this slice's own browser drive.

**Carry this forward: a jsdom suite that mocks `useLuminaAI` cannot see a missing
provider. Only a real render can.**

---

## Fixes, by layer

**Tier 3 — registry call site** (`biologyGenerators.ts`)
- `resolveBiologyBand(config.gradeBand, ctx.grade, ctx.gradeContext)` replaces the
  prose-keyed map. Imported, not re-written.
- `generateImages` defaults ON at K-2 (explicit config still wins either way), so
  the answer surface is pictures for the band that cannot read the names. This
  primitive already had an image pipeline — unlike S9/S13, whose rule-3 residual
  was "no image pipeline wired".

**Tier 1 — catalog** (`catalog/biology.ts`)
- `tutoring` block: 9 contextKeys, 3 scaffolding levels, 5 struggles, 3
  aiDirectives (PRE-READER READ-ALOUD with the cap-override clause; WHICH SIDE IT
  BELONGS ON IS THE ANSWER; NO JARGON AT K-2).
- `constraints` now states the K-2 tap protocol so the manifest can see it.

**Tier 2 — component** (`CompareContrast.tsx`)
- `useLuminaAI` + flat-literal `aiPrimitiveData` + 5 moments + `LuminaReadAloud`
  on every load-bearing surface.
- New `PreReaderCompareView`: one characteristic staged, three picture targets,
  tap = choose = commit = advance, dots not counters, celebration on finish. This
  is the **S9 WordSorter precedent** (stage one item, group cards become answer
  buttons) applied to the same drag mechanic — not a new invention. Drag is
  untouched at 3-5+.
- `buildComparisonItems` exported and shared by both paths.
- Chrome gated at K-2: grade readout, "Generate Visual", shared-attributes ledger,
  numeric counters. `imagePrompt` and the region slugs removed at **every** grade.
- Side-by-side rows become `LuminaReadAloud` at K-2.

**Tester** (`BiologyPrimitivesTester.tsx`) — `LuminaAIProvider` wrapper.

---

## Gates

- **50 focused tests** (34 jsdom + 16 registry/catalog), **12 revert-bites, 12 bite**
  (7 / 1 / 2 / 1 / 16 / 3 / 1 / 1 / 1 / 1 / 1 / 1).
  **Four did not bite on the first attempt and were restructured rather than left
  as decoration:** the shared-vs-A-only rule (the shared-first ordering already
  covered the tested path — a second case was added for the both-say-it-identically
  path), the region-slug test (asserted on an un-submitted render; now drives
  place-all → submit), the silent-send test (only covered mount-time beats; now
  clicks read-aloud and answer), and the cap-override catalog bite — **which was a
  HARNESS bug, not a test gap: that clause appears 5× in `biology.ts`, so the bite
  hit the wrong entry.** Re-targeted, it bites.
- **src-scoped tsc 803 = baseline, set-identical** (zero new; one self-inflicted
  `--downlevelIteration` error found and fixed in-slice).
- `typecheck:lumina` **0**.
- Full vitest **2219/2219** (2169 + exactly 50).
- `tutor-test` Tier 1 `pass` · Tier 2 `findings: []`, **`dataBagDynamic: false`**,
  9/9 contextKeys resolve, 5 tags emitted, **zero `(not set)`**.

**Runtime A/B (eval-test, real Gemini):**

| | PRE | POST |
|---|---|---|
| K | `3-5`, 7/7 attrs, no images, *"Mammalian Predators… vertebrate mammals… evolved as social pack runners"* | **`K-2`**, 5/5, images, *"Comparing Our Furry Friends… furry pets that live in our homes"* |
| G1 | `3-5`, 8/8 | **`K-2`**, 5/5, images |
| **G4 control** | `3-5`, 8/8, no images | **`3-5`, 8/8, no images — unchanged** |

A second K draw on a different topic (*Trees vs Flowers*) confirms the K register
is real and not the few-shot example being parroted: *"Very tall and big"*, *"Has a
hard, woody trunk"*, *"grow outside"*, 5/5 attributes, images generated.

**Real-Chrome drive** (real generated K data, real generated images):
K-2 venn — 0 draggables, 4 images, three targets `Tree only | Both of them | Flower only`,
**8 taps to completion + celebration**, no grade badge, no "Check My Work", no counter.
K-2 side-by-side — 7 row read-aloud buttons, no ledger, no "Generate Visual", no
`imagePrompt` leak. 3-5 control — grade readout, ledger, 8 draggables, "Check My
Work" all present. **Zero console errors.**

**One bug found only in Chrome:** the first K-2 row implementation nested a
`LuminaReadAloud` button inside a full-row button —
`validateDOMNesting: <button> cannot appear as a descendant of <button>`. jsdom
rendered it silently. Fixed by making the row *be* the kit component, and locked
with a structural `container.querySelectorAll('button button')` guard.

---

## Residuals — stated, not buried

- **No Tier-3 live audio run** → HUMAN-CHECKS #73/#74 class. Nobody has heard this
  scaffold; the read-aloud and the STIMULUS beat are the load-bearing part.
- **Rule 4 PARTIAL** — 6 interactive elements at K-2 (3 targets + 3 read-aloud
  buttons). The lever is collapsing the title/big-idea read-alouds into the stage
  frame; that is the shared K-stage presentation mode, not a per-primitive fix.
- **Rule 3 PARTIAL on the stimulus** — the characteristic itself is words + voice.
  There is no per-attribute image in the schema. Adding one is a generator change
  (Tier 3) and would be the single biggest further PRE improvement.
- **The generator hard-throws when it cannot find two entities.** `tutor-test`'s
  live probe surfaced it: `cannot determine what to compare … topic="general
  practice", title="undefined"`. Pre-existing, every grade, and it means a manifest
  that routes this primitive without a `vs` title or `entityA`/`entityB` config
  produces an exception rather than degraded content. **Worth its own item.**
- **`mode` is almost always `side-by-side`** — the registry only picks
  `venn-interactive` when the intent mentions "venn" or "drag". So the assessed K
  path is reachable but rarely routed, and `supportsEvaluation: true` can attract
  assessment demand to a viewer. A routing/portfolio question, not a band one.
- **0 eval modes** → `/add-eval-modes` (L1), out of reader-fit scope.
- **Two dev servers were running** during this session, which broke Next's chunk
  serving until one was restarted. Not a code defect; noted because it cost real
  time and looked like a route bug.
