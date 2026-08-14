# LA K-2 Grammar density — BACKLOG (queue of record)

Top = next. Seeded 2026-08-05 from `census-2026-08-05.md` (the roster of record;
supersedes the 2026-07-04 demand map). Executors named per item. **Serial — one item
per slice, committed incrementally** (user token ruling 08-05; no Workflow fan-out).

Every closure strikes its row here AND updates the WORKSTREAMS row in the same slice.

---

## Demand at a glance

138 K-2 LA subskills route to generic `ai-tutor-session` — **131 of them Kindergarten**,
7 Grade 1, 0 Grade 2. Grammar (GK LA004) is **50** of those. Triage verdicts:
11 ROUTE · 19 EXTEND · 4 BIRTH · 16 TIER-3 (tutor by design).

---

## Queue

> **2026-08-05 (latest) — item 1 taken and SPLIT as recommended: `in` + `between` are
> CLOSED (struck below); the viewer-relative pair carries forward as item 1b.** Top is
> now **item 1b** (a DESIGN ruling, not code) — `/pm` may prefer to pull item 2b or 4,
> both of which are buildable without a ruling.

### ~~1. `spatial-scene` containment + two-reference prepositions~~ — **`in` + `between` CLOSED 2026-08-05 (late)**
Both shipped as their own eval modes — **`place_in`** (β 1.5) and **`place_between`**
(β 3.5) — **not** as a widening of the position window. The flagged R11 edit was taken as
a **fork** (ladder rung 1, eval-mode split): `place` is untouched and R11 is now
explicitly scoped, with `allowOccupiedTaps`/`nestPlaced` defaulting off so no existing
mode changed. Both new modes derive `correctCell` in **code** (neither schema carries a
cell) and reject rather than guess. R12 hardened so an unjudgeable word can never survive
as a distractor (**R15**).
**Demand converted at the routing layer:** LA004-05-B (*"Put the pencil in the box"*) now
routes to `place_in` unprompted, LA004-01-F to a `place_in|place|place_between` blend.
27/27 real-Gemini challenges clean incl. a math K.G.1 control; suite 49/49 (+15, 3-of-49
revert-bite); NEW component drive 8/8 (2-of-8 revert-bite — the container cell was
literally unclickable before); Vitest 1670/1670; tsc 803 = baseline.
Also fixed en route: a curator **blend pin** was resolving to null and generating all six
modes (a 17-challenge session). Report:
`spatial-scene-containment-2026-08-05.md` · Contract: **R13/R14/R15, C2 partially resolved**.
**Residual:** no real-browser look at the nested render → `qa/HUMAN-CHECKS.md`.

### 1b. `in_front_of` / `behind` — **DESIGN RULING FIRST, then `/add-eval-modes`**
**Demand: 1-2 subskills** (LA004-05-C "in front/behind").
Deliberately left out of the 08-05 containment slice. Viewer-relative position is
**ambiguous with above/below in a top-down 3×3 grid** — the same arrangement reads as
"above" or "in front of" depending on an implied camera the grid never establishes. That
is a rule-#1 hazard (a child marked wrong for a defensible answer), not a build task, so
it needs a ruling before code: side-elevation view? an explicit depth cue (overlap,
scale, shadow)? a different primitive entirely? The resolver still reports both as
`unsupported` and the generator logs the gap, so the demand stays measurable —
grep `[SpatialScene] Lesson asked for position words this 3x3 grid cannot express`.
Contract **C2** stays OPEN for these.

### ~~2. `on`/`above` ambiguity in `identify`/`describe` — RULE-#1 RISK, small fix~~ — **CLOSED 2026-08-05 (late)**
~~Found 2026-08-05 (evening, `bd1c535`)~~ — **measured, fixed, promoted to contract R12.**
Pinning `identify`+`describe` at LA004-01-F (the mode combination the pilot never
exercised) found the ambiguity in **4 of 18** challenges, in both directions. Closed by a
**geometry-driven** exclusivity guard (`positionHolds` +
`enforceSingleDefensibleOption`), not a synonym table — so it also covers `beside` ⊂
`left_of`/`right_of` at Grade 1. Re-probed **0/36**, math K.G.1 control unchanged.
The probe also caught a second rule-#1 leak in the same options list: `correctPosition`
was `options[0]` in **18/18** and the component renders array order — fixed with a
seeded `placeAnswerSlot`. Suite 34/34 (+19) with a 2-of-34 revert-bite; full Vitest
1,647/1,647; tsc 803 = baseline.
Report: `spatial-scene-c3-exclusivity-2026-08-05.md` · Contract: **R12 OBSERVED, C3 RESOLVED**.
**Residual (not blocking):** no browser drive of an `identify` challenge now that the
answer sits at a varying index — carried to `qa/HUMAN-CHECKS.md` #66.

### 2b. `spatial-scene` `identify`/`describe` HINT hands over the answer — `/eval-fix`
**Found by the closing `/eval-test` of item 2** (`qa/eval-reports/spatial-scene-2026-08-05.md`,
tracker **SS-5**). The `hint` poses the key as a leading yes/no question: key `above` →
*"Is the flower right **above** it?"*. **2 of 3 identify hints leaked; 0 of 3 describe.**
Pre-existing and independent of R12 — but it defeats the same skill R12 just made
answerable, so it belongs to this primitive's next slice, not a future sweep.
**2026-08-05 (latest) — RE-FRAMED by the containment slice: `hint` is a DEAD FIELD.**
`SpatialScene.tsx` never renders `currentChallenge.hint` and `aiPrimitiveData` does not
carry it, so today this leak reaches nobody. The item is therefore not "fix the leak"
but **"decide whether hints should render at all"** — either wire them (and then the
guard below is required) or stop generating them and drop the field. Do that first.
`buildSharedContext` already asks for *"hints that guide without giving the answer"* and
the LLM ignores it, so prose alone is not binding: state it as a hard per-mode constraint
(the support-tier `hard` line already has the right wording — *"must NOT name the position
word"* — it just isn't applied at default/medium) **plus** a post-process check that
rewrites or drops a hint containing the key word. Note c3 leaked *"next to"* for a key of
`beside` — after R12 removed `next_to` from the options, so hint and option list now
disagree in wording; the check must cover synonyms, not just the literal key.
Probe: generate ≥9 identify + 9 describe hints, assert none contains a window word.

### 3. Directional/path prepositions — likely a genuine BIRTH
**Demand: 2 subskills** (LA004-05-H "through, around, across" multi-step directional;
LA004-05-F treasure-map path clues).
A path is not a position — a static 3×3 grid has no route semantics, so this is the one
preposition sub-cluster that fit-first does NOT resolve into `spatial-scene`. Candidate:
a path/route primitive where the child traces a route through a scene. Run
`/curriculum-fit` before `/primitive` — check `grid-drawing`/engineering surfaces first.

### 4. `word-sorter` K picture-pair mode — `/add-eval-modes`
**Demand: 3 subskills** (LA004-03-C singular↔plural picture pairs, LA004-03-G irregular
plurals mouse/mice, LA004-06-G irregular past run/ran).
All three are pair-matching. `match_pairs` (β3.5) is **Grade 1+ only** by an explicit
catalog band floor — "text-to-text matching requires decoding". That floor is *correct*
for word↔word and wrong for **picture↔picture**: a K child can match 🐭→🐭🐭 without
reading. Add a picture-primary pair mode gated to K rather than lowering the existing
floor. `/reader-fit` closes it.

### 5. Sentence Mechanic — BIRTH (`/primitive`, L0)
**Demand: 4 subskills** (LA004-02-D complete-vs-fragment, -02-E ending punctuation
. ? !, -02-F question word order + punctuation, +LA004-01-L mixed grammar review).
`sentence-builder` BUILDS sentences; nothing in the catalog **repairs** them. Confirmed
genuinely new interaction — but note the K band: a pre-reader cannot read a sentence to
repair it, so the L0 birth must be spoken/picture-scaffolded from the start (catalog
`aiDirectives` read-aloud, the `word-sorter` K precedent) or it ships unusable.
**Do `/curriculum-fit` first** — the 08-05 census found the handoff's *other* predicted
birth already existed as a math primitive.

### 6. ROUTE the 11 already-served subskills — curriculum, **draft-first**
**Demand: 11 subskills**, zero primitive code.
`word-sorter` serves these at K today (it is already picture-primary at K — emoji
required on every card and bucket, plus read-aloud `aiDirectives` with a K band floor):
- `binary_sort`: LA004-01-A, LA004-01-D†, LA004-03-B, LA004-03-E, LA004-03-J,
  LA004-04-C, LA004-05-I, LA004-06-C, LA004-06-F
- `ternary_sort`: LA004-06-J
- LA004-02-A
**Pipeline is non-negotiable:** edit draft → `lineage-check` → publish. NEVER
`curriculum_published` directly; lineage record BEFORE any subskill ID change. Write
only the `target_primitive` field — no primitive hints beyond it
([[no-prebaked-primitive-mapping]]).
† **LA004-01-D carries a reader-fit risk** — common vs proper nouns sorts on a *print*
feature (the capital letter) that a pre-reader cannot perceive and an emoji cannot
encode. `/reader-fit` it before publishing its re-target; it may belong in EXTEND.
Each re-target should carry an `/eval-test` before publish.

### 7. `sentence-builder` at Kindergarten — EXTEND (large)
**Demand: 9 subskills** (LA004-02-B/G/H, LA004-03-D/H, LA004-04-F/I, LA004-01-E,
LA004-01-I). Built for grades 1-6 with text tiles; K needs picture-bearing tiles and
read-aloud. Deliberately ranked below the smaller items — it is the biggest EXTEND and
wants its own contract-first slice.

### 8. Conversation Studio — DESIGN, not a primitive fix
**Demand: 16 grammar subskills** (LA004-01-C/H, -03-F/I/K, -04-A/B/G/H/J, -06-A/D/E/H/I)
plus most of the 27 LA005 and 13 LA003/LA007 items outside grammar.
"Use X in guided speaking/storytelling/conversation" — the modality genuinely IS
conversation. These stay on the tutor **by design**; the work is to replace the generic
fallback with a designed surface. This is a `/pm` lane decision, not a grammar item.
Do not force these into tap-primitives.

---

## Closed

- **2026-08-05 (late) — `spatial-scene` containment + two-reference prepositions
  (item 1, `in` + `between` half).** The flagged R11 edit, taken as a **fork**: `place_in`
  (β 1.5) targets the cell the container OCCUPIES — R11 inverted — and `place_between`
  (β 3.5) is judged from TWO references. Neither widens the position window, so R1 stays
  byte-for-byte for math K.G.1 (**R15**). Both derive `correctCell` in code and reject
  rather than guess. Curator now routes LA004-05-B → `place_in` and LA004-01-F →
  `place_in|place|place_between` unprompted. 27/27 real-Gemini clean; suite 49/49
  (3-of-49 bite); NEW jsdom component drive 8/8 (2-of-8 bite); Vitest 1670/1670; tsc 803.
  En route: a curator **blend pin** was silently generating all six modes — fixed.
  Report `spatial-scene-containment-2026-08-05.md` · Contract **R13/R14/R15, C2 partial**.
- **2026-08-05 — `spatial-scene` intent-driven preposition window (7 subskills served).**
  The handoff's headline predicted BIRTH ("Preposition/Spatial Scene") was an
  **anti-duplication catch**: `spatial-scene` already existed at `catalog/math.ts:3743`,
  fully built and at L3, invisible to the 07-04 map because it is filed under math.
  Verdict flipped BIRTH → EXTEND. Measured defect: the curator routes LA prepositions
  here and its own intent said *"Put the ball UNDER the table"*, but the generator's
  hardcoded K window ("ONLY above, below, beside, next_to" — the math K.G.1 vocabulary)
  silently overrode it and emitted above/below/beside. Fixed with the 14l resolver
  template — one temperature-0 schema-bound call resolves the lesson's named position
  words, UNIONed with the band default (widens only, never narrows), and only in-window
  words get grid semantics stated. `on`/`under` are CONTACT-scoped (adjacent) vs
  `above`/`below` (any distance) — that distinction is the LA skill's actual content.
  Math K.G.1 unchanged (no request → band default byte-for-byte). Contract derived
  first (11 R, C1 resolved via the config-axis rung, C2 open) + catalog projection
  applied. Focused 15/15 with 2-of-15 revert-bite; full Vitest **1,628/1,628**;
  typecheck:lumina 0; tsc **803 = baseline**; real-Gemini probes: census replay now
  serves on/under/beside with placements matching the injected rule exactly, math
  replay 11 challenges / 4 modes / 0 out-of-window.
  Report `qa/la-k2-grammar/spatial-scene-prepositions-2026-08-05.md`.
- **2026-08-05 — Phase 0 census + Phase 1 grammar triage.** `census-2026-08-05.md` is
  the roster of record. Three corrections to the 07-04 map recorded there (138 did not
  shrink and *cannot* shrink from primitive builds — `target_primitive` is a stored
  curriculum field; grammar is 50 not ~37; the lane is 95% Kindergarten).
- **2026-08-05 — "word-sorter needs K picture cards + read-aloud" — ALREADY DONE.**
  The handoff predicted this as work. `gemini-word-sorter.ts` already *requires* emoji
  on every word card and bucket at K (reader-fit RF-4) and `catalog/literacy.ts:2144`
  carries three read-aloud `aiDirectives` with a K band floor that never withdraws
  word-voicing even at support tier `hard`. Closure, not a task.

---

## 📥 MOVED FROM `WORKSTREAMS.md` — `/pm` 2026-08-13 (user ruling)

The index's `## ACTIVE` section had grown to ~1,360 lines (79% of the file), so each
stream's DETAIL now lives in its owning queue and the index carries the pointer plus the
one-line state. **Moved verbatim, nothing deleted.** The index remains authority for
STATE (active/parked, what to pull next); this block is authority for the detail behind
it. Where the two disagree, the queue wins on WHAT and reports win on EVIDENCE.

### (PARKED 2026-08-07 by `/pm` — BLOCKED on a user design ruling, not idle; queue trusted as of 2026-08-05) LA K-2 Grammar density — was TOP SLOT (user-pulled 2026-08-05) — last touched **2026-08-05**

*Parked because its queue top — item 1b `in_front_of`/`behind` — is a **DESIGN
RULING, not code** (viewer-relative is ambiguous with above/below in a top-down
grid, a rule-#1 hazard), and nothing machine-gated sits above it. This is a block,
not neglect. **Resuming costs nothing:** the buildable alternates are item **2b**
(the `identify` hint hands over the answer in 2 of 3 hints — tracker SS-5) and item
**4** (`word-sorter` K picture-pair, 3 subskills). Everything below is unchanged and
trustworthy as of 08-05.*

*Section authored by `/pm` 2026-08-05 (2nd pass). The lane was opened, seeded, piloted and
re-probed all on 08-05 but existed only as a snapshot-table row — a cold reader following the
`## ACTIVE` body found reader-fit in slot 1 and no grammar lane at all.*

- **Queue:** `my-tutoring-app/qa/la-k2-grammar/BACKLOG.md` (top = next; 8 items).
  **Roster of record:** `qa/la-k2-grammar/census-2026-08-05.md` — it SUPERSEDES the
  2026-07-04 demand map.
- **Executor skills:** `/add-eval-modes`, `/reader-fit`, `/curriculum-fit` → `/primitive`,
  `/primitive-contract --check` (required before touching `spatial-scene` — R11 is flagged),
  `/eval-test`. Curriculum re-targets are **draft-first**: edit draft → `lineage-check` →
  publish; NEVER `curriculum_published`.
- **Demand:** 138 K-2 LA subskills route to the generic `ai-tutor-session`; **131 are
  Kindergarten** (7 G1, 0 G2), so the pre-reader contract governs essentially the whole lane.
  Grammar (GK LA004) is **50** of the 138. Triage: 11 ROUTE / 19 EXTEND / 4 BIRTH /
  16 TIER-3-by-design.
- **The census corrected the 07-04 map on three counts** — (1) 138 is **unchanged and
  structurally cannot shrink from primitive builds**, because `target_primitive` is a *stored
  curriculum field* (so the handoff's "may have shrunk" premise was wrong by construction);
  (2) grammar is 50, not ~37; (3) the lane is 95% Kindergarten.
- **Standing lesson from the pilot — fit before birth.** The handoff's headline predicted
  BIRTH ("Preposition/Spatial Scene"); the primitive **already existed**, fully built at L3,
  invisible to the 07-04 map only because it is filed under **math**. Verdict flipped
  BIRTH → EXTEND before any code was written. **Run `/curriculum-fit` before `/primitive` on
  every remaining BIRTH candidate in this queue** (items 3 and 5).
- **Honest ledger:** the pilot made `spatial-scene` *able* to serve 7 subskills — **the 138
  demand number has not moved.** Converting demand requires the draft-first re-target
  (item 6), deliberately not entered while `curriculum_published` stayed read-only.
- **Item 2 CLOSED 2026-08-05 (late) — contract C3 → R12, and it was a MEASURED failure, not
  the risk it was queued as.** The pilot never ran `identify`/`describe`; pinning that mode
  combination at the published LA004-01-F objective found **4 of 18** challenges shipping two
  defensible options — in both directions (key `on` next to option `above`, key `above` next
  to option `on`), plus `below`/`under` and `beside`/`next_to`. Closed with a
  **geometry-driven** guard (`positionHolds` + `enforceSingleDefensibleOption`), not a synonym
  table — so it also covers `beside` ⊂ `left_of`/`right_of` before Grade 1 ever runs — and it
  makes R1 **code-enforced** for these two modes (an out-of-window key is now repaired, not
  merely discouraged in the prompt). **The probe found a second rule-#1 leak nobody had
  queued:** `correctPosition` was `options[0]` in **18/18** challenges and the component
  renders array order, so "tap the first button" solved every item without reading the grid —
  fixed with a seeded `placeAnswerSlot`. Post-fix **0/36 ambiguous** across an LA and a math
  K.G.1 control run, answer slots `{0:9, 1:10, 2:9, 3:8}`, **0 out-of-band words in the math
  control (R1 held)**. Gates: focused **34/34** (+19) with a **2-of-34 revert-bite on the
  wiring**, full Vitest **1,647/1,647**, typecheck:lumina **0**, tsc **803 = baseline**.
  Closing **`/eval-test` all 4 modes: 4/4 PASS**, R12 clean on all 6 `identify`/`describe`
  challenges, and **contract R11 upgraded INFERRED → OBSERVED** as a by-product (all 3
  `place` challenges targeted an empty cell — the contract had asked for exactly this on
  first contact). Reports `qa/la-k2-grammar/spatial-scene-c3-exclusivity-2026-08-05.md`
  + `qa/eval-reports/spatial-scene-2026-08-05.md`.
- **New finding, QUEUED not fixed (item 2b, `/eval-fix`, tracker SS-5):** the closing
  eval-test found the `identify` **hint hands over the answer** — *"Is the flower right
  **above** it?"* against a key of `above`, **2 of 3 hints**. Pre-existing and independent
  of R12, but it defeats the same skill R12 just made answerable, so it stays with this
  primitive rather than a future sweep. `buildSharedContext` already asks for hints that
  don't give the answer and the LLM ignores it — so the fix is a hard per-mode constraint
  plus a post-process check, not more prose. One wrinkle to carry: a hint leaked *"next
  to"* for a key of `beside` **after** R12 removed `next_to` from the options, so the
  check must cover synonyms, not just the literal key.
- **Item 1 CLOSED-BY-SPLIT 2026-08-05 (latest) — `in` + `between` SHIPPED; contract C2 goes
  from OPEN to PARTIALLY RESOLVED.** The flagged R11 edit was taken as a **fork, not an
  edit** (ladder rung 1, eval-mode split): containment is `place_in` (β 1.5) and targets the
  cell the container **OCCUPIES** — R11 inverted — while `place_between` (β 3.5) is judged
  from **two** references by `betweenHolds`/`resolveBetweenCell`. The load-bearing decision
  is that **neither word joins the position window**: `composePositionWindow` filters them
  out by construction, so a lesson asking only for containment leaves the K math vocabulary
  byte-for-byte intact (new **R15**), and R11 stays unconditional for `place`. Both new
  modes derive `correctCell` in **code** — neither schema carries a cell — and reject rather
  than guess (non-container, unresolvable reference, non-collinear pair, occupied gap,
  pre-placed target). **Demand converts at the routing layer:** re-probing the published
  objectives, LA004-05-B (*"Put the pencil in the box"*) now routes to `place_in` and
  LA004-01-F to a `place_in|place|place_between` blend — unprompted. That routing probe also
  caught a **real defect nobody had queued: a blend pin was resolving to null**, so the
  generator produced *every* mode — at six modes a 17-challenge session instead of the three
  the curator chose; parsed locally rather than in the shared helper ~60 generators depend
  on. Gates: **27/27** real-Gemini challenges judged independently (incl. a math K.G.1
  control — every `place` cell empty, 0 out-of-window keys/options), focused suite **49/49**
  (+15) with a **3-of-49 revert-bite**, a **NEW jsdom component drive 8/8** with a
  **2-of-8 revert-bite** (this one earned its keep: pre-fix the correct containment answer
  was *literally unclickable* — a failure `tsc` and the generator suite are both blind to),
  full Vitest **1670/1670**, tsc **803 = baseline**. Report
  `qa/la-k2-grammar/spatial-scene-containment-2026-08-05.md` · Contract **R13/R14/R15**.
  **Residuals, honest:** (1) no real-browser look at the nested render — jsdom asserts the
  DOM, not whether "in the box" *looks* like inside the box → **HUMAN-CHECKS #67**; (2) the
  138 demand number still has not moved (same as the pilot — that needs item 6's draft-first
  re-target); (3) `hint` is confirmed **never rendered** by the component, which re-frames
  queued item 2b from "fix the leak" to "decide whether hints should render at all".
- **Next:** **item 1b** — `in_front_of`/`behind`, which is a **DESIGN RULING, not code**
  (viewer-relative is ambiguous with above/below in a top-down grid — a rule-#1 hazard).
  If the ruling isn't wanted now, the buildable pulls are **item 2b** (hint/dead-field
  decision, small, same primitive) or **item 4** (`word-sorter` K picture-pair, 3 subskills).
