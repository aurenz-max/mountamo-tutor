# HANDOFF — LA K-2 Grammar density: verify demand, fit-first, then birth

Paste-able execution prompt. Authored `/pm` 2026-08-05; anchors verified against
HEAD `13eb9cf`. Executors: `/curriculum` (roster pull) → `/curriculum-fit` +
`/add-eval-modes` or `/primitive` per the triage → `/eval-test` + `/reader-fit`.
Serial, one item per slice, committing incrementally (user token ruling 08-05 —
no Workflow fan-out).

## Why this lane

The LA K-2 demand map (2026-07-04) found **138 K-2 LA subskills routed to
generic `ai-tutor-session`** — no fitting primitive — and named the Grammar
family (~37) the biggest cluster. Converting these into real primitives IS the
content-density frontier (CLAUDE.md priority 3). Under the 08-05
development-first ruling this lane now occupies the top ACTIVE slot.

**The map is 31 days stale and the world moved.** Two of its three prescribed
grammar builds already shipped, so DO NOT trust its counts or its build list:

- `word-sorter` — BUILT (`catalog/literacy.ts:2075`; `qa/PRIMITIVE_GAPS.md`
  GAP-010, the "single highest-ROI literacy build": configurable bucket sort —
  nouns/verbs, singular/plural, location/direction prepositions; support tiers
  wired in batch 2).
- `sentence-builder` — BUILT, GAP-012 ✓ CLOSED (`catalog/literacy.ts:1765`,
  grades 1-6, color-coded grammatical-role tiles, 4 eval modes; the gap doc
  says LA004-01-G/K + LA004-02-C "can be assigned immediately").
- `sentence-analyzer` (`catalog/literacy.ts:21`) exists but is **grades 2-8
  text parsing — NOT a K-2 home; do not stretch it down.**
- `picture-vocabulary` (`catalog/literacy.ts:989`) absorbed the Tier-0 oral
  vocab cluster (6 modes) — the precedent that absorption beats birthing when
  the interaction shape matches.

## Phase 0 — refresh the roster (the census of record)

Query the live published curriculum (backend up; `/curriculum` skill or the
curriculum API the 07-04 artifact used) for K-2 LANGUAGE_ARTS subskills whose
target is still `ai-tutor-session`, clustered by strand — grammar strands
first (LA004 family: parts of speech LA004-01, pronouns LA004-04, prepositions
LA004-05, sentence structure). Save the roster as
`qa/la-k2-grammar/census-<date>.md` with counts per cluster and grade. This is
the number everything else keys off — the ~37 may have shrunk since
word-sorter/sentence-builder shipped, and the GK LA graph repair edited this
band. **Do not skip to building.**

## Phase 1 — fit-first triage (anti-duplication gate)

For each cluster, decide EXTEND vs BIRTH — in that order of preference:

1. **Already served, just not routed:** if word-sorter / sentence-builder /
   picture-vocabulary genuinely serves the subskill today, the fix is
   curriculum re-targeting — which goes **draft-first ONLY** (edit draft →
   `lineage-check` → publish; NEVER `curriculum_published` directly; lineage
   records before any subskill ID change). Never write primitive hints into
   curriculum beyond the target field — the manifest resolves from the live
   catalog.
2. **Same interaction, missing mode/band:** `/add-eval-modes` on the existing
   primitive (+ K band gates via `/reader-fit`). Likely: word-sorter grammar
   modes at K need picture-primary cards + read-aloud (a K pre-reader cannot
   read a bare word card); check its existing modes before adding.
3. **Genuinely new interaction:** `/primitive` birth at L0. Expected true
   births from the map, to be confirmed by the census:
   - **Preposition/Spatial Scene** (~7 subskills): the child ENACTS "the bear
     is UNDER the table" by dragging the bear — direct-manipulation-first
     (user law). word-sorter can sort preposition WORDS but cannot enact
     spatial relations; that modality gap is what justifies a birth.
   - **Sentence Mechanic** (capitalization/punctuation fix-it): sentence-builder
     BUILDS sentences but nothing exercises mechanics repair. Confirm demand
     exists in the census before birthing.

Record every triage verdict in the census file — a cluster resolved as
"route-to-existing" is a closure, not a skip.

## Phase 2 — pilot ONE slice

Pick the highest-demand cluster whose verdict requires work (not the cheapest —
[[worked-primitives-self-select]]). Run it end-to-end: build → gates → commit,
before touching the next. `/primitive` births follow the full L0 lifecycle
(birth certificate + follow-up queue; Gemini generator pattern, NEVER
hardcoded test data; menu-scoped content with code-attached emoji — the
flash-lite footguns; bounded schema arrays; kit UI, kit = frame only).

## Phase 3 — serial expansion

One cluster per slice. Seed `qa/la-k2-grammar/BACKLOG.md` from the census
(top = next) — it becomes this lane's queue of record; every closure strikes it
and updates the WORKSTREAMS row in the same slice.

## House rules that bite here

- **K band = pre-reader contract** (`/reader-fit`): picture-primary faces,
  nothing load-bearing in text, 🔊 read-aloud via catalog aiDirectives, no
  chrome leaks; rule #1 — never leak the answer in layout/defaults/labels.
- **Voice:** the session-wide voice transport SHIPPED `9d08687` — new
  primitives get conversational tutor voice for free. But GRADED spoken
  production still uses the spoken-judge ladder (`useSpokenWordCapture`, Azure
  dual-signal → flash-latest, never flash-lite) — live in-band audio judging
  stays DI-only. Quiet-tutor law: frame once, silent per-round.
- **Grade = ceiling** (scope-context contract); canonical `ctx.grade` first,
  prose fallback kept.
- Every new eval mode/primitive needs a `/curriculum-fit` MATCH (it is
  `/primitive` Phase 7) and real-Gemini `/eval-test` probes; revert-bite
  focused tests; `typecheck:lumina` 0; tsc 0 NEW; full Vitest ≥ 1,613.
- Shared registers (WORKSTREAMS, EVAL_TRACKER, HUMAN-CHECKS) change on disk
  mid-session — re-read before editing.
