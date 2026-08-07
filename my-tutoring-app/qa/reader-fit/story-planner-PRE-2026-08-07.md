# Reader Fit: story-planner @ PRE — 2026-08-07

Item **15A / S4**. Modes audited: `story_structure` (the K-3 mode; the other three
are 2-5 identities). Probes: eval-test @ K ✓ @ G1 ✓ @ G3 control ✓ ·
tutor-test Tier 1 ✓ + `probe=1` ✓ · **real-Chrome drive of the full K flow ✓** ·
live audio ✗ (→ HUMAN-CHECKS #73).

**Overall: READY at PRE** — was **SCAFFOLD-GAP + PRIMITIVE-GAP**, fixed by making
the primitive K-fit rather than flooring it.

---

## The prediction held — and it was only half the story

The 15A queue and the 08-07 handoff both predicted **this generator is CLEAN, do
not "fix" it**. That was **correct and confirmed live**: it reads canonical
`ctx.grade` first with an explicit contract comment, and probed right at *both* K
and G1 on the happy path *and* on the degrade path. It is the only generator in
the whole sweep that needed no grade-resolution work. That prediction is now
locked as a regression test rather than re-derived.

**But the queue's framing — "audit component + scaffold only" — could not have
produced a K-fit primitive**, because the thing missing at K was *content*, and
only the generator can make content. See "Scope" below.

---

## Audit A — text census @ K (pre-fix)

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| `Tell a fun story about what happens when you go to play at the park!` | writing-prompt panel | **load-bearing** (it IS the task) | none — no tutoring block, no `sendText` | **UNCOVERED** |
| `Who is going to the park in your story?` | element prompt | **load-bearing** | none | **UNCOVERED** |
| `What fun thing happens first and how does your day finish?` | element prompt | **load-bearing** | none | **UNCOVERED** |
| `Character` / `What Happened` | element headers | supportive | none | UNCOVERED |
| `Beginning` / `End` | arc slot labels | **load-bearing** (they name the sequence) | none | **UNCOVERED** |
| `What happens in the beginning?` | textarea placeholder | **load-bearing** | none | **UNCOVERED** |
| `Grade K` | badge | decorative chrome | — | chrome |
| `Plan Elements` / `Story Arc` / `Review` | phase ribbon | decorative chrome | — | chrome |
| `Writing Prompt:` | panel caption | decorative chrome | — | chrome |
| `*` (required marker) | element header | decorative chrome | — | chrome |
| `Empty` | review placeholder | decorative chrome | — | chrome |

**Audit A FAILED on six load-bearing strings with zero spoken twins.**
`story-planner` was one of the 26 **mute** primitives: no catalog `tutoring`
block *and* no `useLuminaAI`/`sendText`, so the tutor received the literal
*"No specific scaffolding instructions for this primitive type."*

Post-fix: every one of the six is either **spoken** (writing prompt + element
question + option captions + event-card captions, via the ORIENT/ASKED beats and
two `LuminaReadAloud` surfaces) or **gone from the K screen** (arc labels
replaced by numerals; placeholders deleted with the textareas).

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| `story_structure` @ K **pre-fix** | ✗ | ✗ | ✗ | ✗ | ✗ |
| `story_structure` @ K **post-fix** | ✓ | ✓ | ✓ | ✓ | ✓ |

- **ORIENT** — `[STORY_ELEMENT_ASKED]` fires at mount and on every element screen.
- **STIMULUS** — the first beat reads the writing prompt **word for word** and
  carries the *"this OVERRIDES any instruction to keep it to one sentence"*
  clause, in the **catalog `aiDirectives`** as well as the component message, so
  it survives the lesson `[PRIMITIVE SWITCH]` cap.
- **DISAMBIGUATE** — the beat states the question *and* speaks all three option
  captions. This is load-bearing: the tutor's voice **is** the option labels.
- **FEEDBACK** — sound + the card leaving the tray + the tutor echoing the pick;
  ✅ on each slot after Finish. No error prose, no counts.
- **RECOVER** — 3 scaffolding levels, 5 struggles led by the two this primitive
  actually produces (*"they think there is a right answer"*, *"puts the ending
  first because it is the picture they like best"*).

## Audit C — band contract @ K

| Rule | Pre-fix | Post-fix | Offender / fix |
|---|---|---|---|
| 1 audio is the instruction channel | **FAIL** | PASS | mute primitive → catalog block + 7 moments |
| 2 tap = choose | **FAIL** | PASS | typing → one tap picks *and* advances |
| 3 pictures are the answer surface | **FAIL** | PASS | emoji-primary cards, words as captions |
| 4 one thing per screen, ≤~5 elements | PASS | **PARTIAL** | 5 tap targets on element screen 1, **6 on screen 2** (the ⬅️ back arrow) — see residuals |
| 5 feedback on the touched object | **FAIL** | PASS | sound + card moves + ✅ per slot |
| 6 no typing | **FAIL** | PASS | 0 `<textarea>` in the whole K flow (asserted) |
| 7 no adult chrome | **FAIL** | PASS | grade badge, phase ribbon, "Writing Prompt:", `*`, "Empty", story-mountain chart all conditionally rendered away |
| 8 assessment hides in the mechanics | **FAIL** | PASS | `text.length > 5` → plan complete (40%) + events in story order (60%) |

**Rule 8 was the worst finding and was not queued.** Pre-fix the score was
`elementsPlanned` by `trim().length > 5` plus an 18-word hardcoded adjective
regex. At K that means **a child who cannot type scored 0, and `"aaaaaa"` scored
full marks** — the `day-night-seasons` (S10) defect, second appearance in the
sweep. The replacement is stricter than what it replaced.

---

## Scope — I went past "component + scaffold only", deliberately

The instruction was to audit the component and scaffold and leave the generator
alone. **I kept the fence that mattered** (grade resolution: untouched, and now
regression-tested) but **added two fields**, because the audit showed a
component-only pass could not produce a K-fit primitive:

At K the screen is two questions with **no answers to choose from** — the plan is
free composition. Band-gating chrome and adding read-aloud would have left a
five-year-old listening to a nicely-spoken question in front of two empty text
boxes. That is a *worse* outcome than the honest failure, because it would have
been recorded as READY.

Both additions are **additive and band-scoped**, and grade 2+ output is
byte-identical (proved by the G3 control and two tests):

- `elements[].choices?: string[]` — 3 emoji-prefixed picture options per element
- `arcEvents?: string[]` — one emoji-prefixed event per arc slot, **in story order**

The K act is now: **pick your character → pick what happens → put the events in
order**. That is not a workaround — it is what K narrative planning *is*
(CCSS W.K.3 is explicitly *"drawing, dictating, and writing"*, not writing), and
the ordering half is the real `story_structure` task identity, assessed properly
for the first time.

**Flash-lite handled it clean, first try, at both K and G1** — including the
`choices` array **nested inside** the `elements` object array, under an emoji
ask. That is the shape
[[feedback_flash-lite-drops-nested-array-under-emoji-ask]] warns about; keeping
the emoji **inside the string** (`"🐶 A happy puppy"`) instead of asking for an
`{label, emoji}` object appears to be why it survived. Worth reusing.

---

## Other findings

**The rung was never STAMPED (the S2/S3 defect #3, third appearance).**
`gradeLevel` is `required` in the schema, so what came back was Gemini's **echo**
— right on both probes, but not something a band gate may key off. Every K-1 gate
added this slice reads that field, so without the stamp they would have been
**dead on arrival**. Now stamped from the resolver, with an explicit config pin
still winning. *This is not the grade-resolution fix the fence forbade — the
resolution was already right; it just never reached the component.*

**The band list lives in one shared module.** `service/literacy/storyPlannerBand.ts`
(`normalizeStoryPlannerGrade` / `isStoryPlannerPictureBand` / `STORY_PLANNER_PICTURE_BAND`)
is imported by both the generator and the component. Following S13's
`service/biology/gradeBand.ts` precedent rather than hand-copying a list into two
files, where drift is silent.

**Answer-leak discipline.** The generator emits `arcEvents` **in correct order** —
that is the answer. Three guards: the component shuffles by a content-seeded
rotation that is a **guaranteed derangement** (no card starts in its own slot);
the ordered array is **kept out of `aiPrimitiveData`** (only the shuffled tray
labels go to the tutor); and the `ORDER IS THE ANSWER` directive forbids stating
it *including by elimination*. The `[STORY_EVENT_PLACED]` beat is **provably
identical** for a right and a wrong placement — asserted by diffing the two
messages, not by grepping for the word "correct".

**`Math.random` would have been wrong twice.** A random shuffle reshuffles the
board on every render and cannot be tested. The seeded rotation is deterministic
*and* derangement-guaranteed.

---

## Gates

| Gate | Result |
|---|---|
| Focused tests | **20** (generator/band) + **28** (jsdom) = **48**, all green |
| **Revert-bite** | **11 bites, 11 bite: 2 / 1 / 2 / 1 / 1 / 3 / 18 / 2 / 1 / 3 / 5** — no decoration |
| `tsc` src-scoped **SET diff** | **803 vs 803 stashed baseline — zero new, zero fixed, set-identical** |
| `typecheck:lumina` | 0 |
| Full vitest | **2154 / 2154** (was 2106 at S3 close) |
| tutor-test Tier 1 | `pass`, `findings: []`, `dataBagDynamic: false`, 7 sendText tags, no dead tags |
| tutor-test Tier 2 @ K | **22/22 vars `resolvedBy: component`**, zero `(not set)`, `arcEvents` in `generatedKeys` |

### Runtime A/B (real generated content, real Chrome)

| | pre-fix | post-fix |
|---|---|---|
| **K** | `gradeLevel:'K'`, 2 elements, **2 textareas**, no picture content | `'K'`, 2 elements × 3 picture choices, 2 `arcEvents`, **0 textareas** |
| **G1** | `'1'`, 3 elements, **3 textareas** | `'1'`, 3 elements × 3 choices, 3 `arcEvents`, **0 textareas** |
| **G3 (control)** | `'3'`, 5 elements, 5 textareas, badge + ribbon + prompt panel | **identical** — 5 textareas, `Grade 3`, `Plan Elements`, `Writing Prompt:`, no choices, no `arcEvents` |

Driven in Chrome end to end at K with the real K draw: two picture screens
(182×116px tap targets) → arc board → both cards placed → Finish → ✅ per slot +
*"Your story is ready!"* + *"Tell me my story"*. **Zero console/page errors.**
The tray rendered **"Went back home to rest" above "Came to the big park"** —
the answer order is not on screen, confirmed in the real DOM, not just jsdom.

---

## Residuals (NOT closed)

- **Rule 4 is PARTIAL:** 6 tap targets on element screen 2 (the ⬅️ back arrow
  pushes it one over ~5). Same shape as `rocket-builder`'s residual. Removing the
  back arrow would cost the only way to change a pick.
- **Two read-aloud surfaces on the K plan screen** ("Tell me the story idea
  again" in the header, "Hear the question" in the body). They do different
  things and both are legitimate, but it is two cyan pills on a child's screen.
- **The title still renders as text at K** (`A Day at the Park Adventure`) —
  decorative, pre-existing, and the systemic answer is the shared K-stage
  presentation mode, not a fork here.
- **Degraded generation falls back to textareas at K.** If Gemini returns no
  `choices`, `pickMode` is false and the free-text planner comes back — chrome
  still gated, but a non-reader is stranded. All-or-nothing guards make partial
  content impossible, but *empty* content is still reachable. A K-1 hard fallback
  (retry, or a generic picture set) would be its own slice.
- **No Tier-3 live audio run** → HUMAN-CHECKS #73.
- **`arcEvents` quality is unverified beyond 2 draws.** The whole ordering
  assessment rests on Gemini emitting events that make sense in **exactly one**
  order. Both draws did (`arrive → go home`, `arrive → play → go home`), but a
  draw with two interchangeable middles would mark a defensible answer wrong.
  Worth an `/oracle-test` contract if this primitive gets real K traffic.
- **4 eval modes, none band-floored.** `character_setting` / `conflict_resolution`
  / `theme_craft` are grade 2-6 identities; nothing stops the resolver picking
  one at K, where they would render the picture surface against elements that do
  not suit it. Not observed, not fixed.
