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

### 1. `spatial-scene` containment + two-reference prepositions — `/add-eval-modes` + component
**Demand: 4-5 subskills** (LA004-01-F "in", LA004-05-B "Put the pencil **in** the box",
LA004-05-C "in front/behind", LA004-05-F "between").
Contract `docs/contracts/spatial-scene.md` **C2 (OPEN)** names the whole class. The
2026-08-05 slice shipped `on`/`under` and made the window intent-driven; these are the
words a 3×3 static grid still cannot express:
- **`in` (containment)** — needs same-cell occupancy + a nested render (object drawn
  inside the container's cell). **Inverts contract R11** (`place` currently targets an
  EMPTY cell, and `GridScene` only offers the tap affordance on empty cells) — read R11
  before touching, this is the flagged edit.
- **`between`** — needs TWO reference objects; the schema carries one
  `referenceObjectName`. Schema + checker change.
- **`in_front_of` / `behind`** — viewer-relative; ambiguous with above/below in a
  top-down grid. Needs a design ruling (side-elevation view? depth cue?) before code.
The resolver already reports all of these as `unsupported` and the generator logs the
gap, so demand is measurable today — grep `[SpatialScene] Lesson asked for position
words this 3x3 grid cannot express`.

### 2. Directional/path prepositions — likely a genuine BIRTH
**Demand: 2 subskills** (LA004-05-H "through, around, across" multi-step directional;
LA004-05-F treasure-map path clues).
A path is not a position — a static 3×3 grid has no route semantics, so this is the one
preposition sub-cluster that fit-first does NOT resolve into `spatial-scene`. Candidate:
a path/route primitive where the child traces a route through a scene. Run
`/curriculum-fit` before `/primitive` — check `grid-drawing`/engineering surfaces first.

### 3. `word-sorter` K picture-pair mode — `/add-eval-modes`
**Demand: 3 subskills** (LA004-03-C singular↔plural picture pairs, LA004-03-G irregular
plurals mouse/mice, LA004-06-G irregular past run/ran).
All three are pair-matching. `match_pairs` (β3.5) is **Grade 1+ only** by an explicit
catalog band floor — "text-to-text matching requires decoding". That floor is *correct*
for word↔word and wrong for **picture↔picture**: a K child can match 🐭→🐭🐭 without
reading. Add a picture-primary pair mode gated to K rather than lowering the existing
floor. `/reader-fit` closes it.

### 4. Sentence Mechanic — BIRTH (`/primitive`, L0)
**Demand: 4 subskills** (LA004-02-D complete-vs-fragment, -02-E ending punctuation
. ? !, -02-F question word order + punctuation, +LA004-01-L mixed grammar review).
`sentence-builder` BUILDS sentences; nothing in the catalog **repairs** them. Confirmed
genuinely new interaction — but note the K band: a pre-reader cannot read a sentence to
repair it, so the L0 birth must be spoken/picture-scaffolded from the start (catalog
`aiDirectives` read-aloud, the `word-sorter` K precedent) or it ships unusable.
**Do `/curriculum-fit` first** — the 08-05 census found the handoff's *other* predicted
birth already existed as a math primitive.

### 5. ROUTE the 11 already-served subskills — curriculum, **draft-first**
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

### 6. `sentence-builder` at Kindergarten — EXTEND (large)
**Demand: 9 subskills** (LA004-02-B/G/H, LA004-03-D/H, LA004-04-F/I, LA004-01-E,
LA004-01-I). Built for grades 1-6 with text tiles; K needs picture-bearing tiles and
read-aloud. Deliberately ranked below the smaller items — it is the biggest EXTEND and
wants its own contract-first slice.

### 7. Conversation Studio — DESIGN, not a primitive fix
**Demand: 16 grammar subskills** (LA004-01-C/H, -03-F/I/K, -04-A/B/G/H/J, -06-A/D/E/H/I)
plus most of the 27 LA005 and 13 LA003/LA007 items outside grammar.
"Use X in guided speaking/storytelling/conversation" — the modality genuinely IS
conversation. These stay on the tutor **by design**; the work is to replace the generic
fallback with a designed surface. This is a `/pm` lane decision, not a grammar item.
Do not force these into tap-primitives.

---

## Closed

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
