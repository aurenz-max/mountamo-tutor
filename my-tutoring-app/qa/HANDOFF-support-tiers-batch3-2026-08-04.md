# HANDOFF — Support-Tiers Batch 3 (orchestrated workflow) — written 2026-08-04

Paste this file's contents into a fresh session to execute. **Pasting this
handoff IS the user's opt-in for the multi-agent Workflow orchestration** —
the batch-2 pattern this handoff replicates ran as an 8-agent Workflow
(~1.28M subagent tokens, 22 min wall; expect somewhat more at 10 items).

**Owning queue:** `my-tutoring-app/qa/support-tiers/BACKLOG.md` (top = next).
**Executor skill:** `/add-support-tiers` semantics, batch-orchestrated.
**Campaign state at writing:** 21/36 eligible non-math primitives wired
(batch 1 = 13, batch 2 = 8 @ `423c58f`). This batch takes 10 of the
remaining 15 → 31/36.

---

## Scope — 10 primitives, anchors VERIFIED 2026-08-04

All 10 confirmed: generator exists at the path below, `resolveEvalMode*`
present (eligible), **zero** existing `supportTier` references (unwired),
and **no derived contract in `docs/contracts/`** (checked — so no
`--check` gate applies, but see the poetry-lab caveat).

Paths relative to `my-tutoring-app/src/components/lumina/`:

| # | Primitive | Generator | Catalog |
|---|---|---|---|
| 1 | spelling-pattern-explorer | `service/literacy/gemini-spelling-pattern-explorer.ts` | `literacy.ts` |
| 2 | story-map | `service/literacy/gemini-story-map.ts` | `literacy.ts` |
| 3 | opinion-builder | `service/literacy/gemini-opinion-builder.ts` | `literacy.ts` |
| 4 | paragraph-architect | `service/literacy/gemini-paragraph-architect.ts` | `literacy.ts` |
| 5 | poetry-lab | `service/literacy/gemini-poetry-lab.ts` | `literacy.ts` |
| 6 | revision-workshop | `service/literacy/gemini-revision-workshop.ts` | `literacy.ts` |
| 7 | sound-wave-explorer | `service/physics/gemini-sound-wave-explorer.ts` | `physics.ts` |
| 8 | constellation-builder | `service/astronomy/gemini-constellation-builder.ts` | `astronomy.ts` |
| 9 | planetary-explorer | `service/astronomy/gemini-planetary-explorer.ts` | `astronomy.ts` |
| 10 | construction-sequence-planner | `service/engineering/gemini-construction-sequence-planner.ts` | `engineering.ts` |

Catalog patch spread: 6 in `literacy.ts` (the collision surface — serial
application is mandatory), 2 in `astronomy.ts`, 1 each in `physics.ts` /
`engineering.ts`.

**Poetry-lab caveat:** no contract exists, but the primitive carries prior
reader-fit work (RF fix + K `rhyme_hunt` mode — memory
`project_poetry-lab-rf-fix-rhyme-hunt`, FULLY RESOLVED). Its profile agent
must read the poetry-lab reports under `qa/reader-fit/` and treat the K
band behavior as keep-true. Band gates WIN over tier everywhere anyway,
but this one has history worth reading before choosing levers.

**Deliberately EXCLUDED — do not pull into this batch:**
- **hydraulics-lab** — owned by the mission-reimagining stream; wiring
  tiers over a surface being rebuilt is wasted work.
- **timeline-builder** — carries the reader-fit **14m** grade-resolver
  defect; the 14m sweep owns the resolver fix, tiers come in a separate
  slice AFTER it lands.
- The ~59 not-yet-eligible generators (need `/add-eval-modes` first) —
  opening that frontier is its own decision, not a batch side effect.
- Anything in math (41/41 complete — never re-touch).

---

## Division of labor (the batch-2 pattern, proven — do not improvise)

1. **Phase 0 — orchestrating session, before any agent:** re-read
   `qa/support-tiers/BACKLOG.md` + WORKSTREAMS stream 3 from disk (shared
   multi-session files; expect drift since this handoff was written).
   Re-measure baselines fresh: `npm run typecheck:lumina` (expect 0), full
   project-local tsc error count (803 at writing — it drifts), full vitest
   count (1327 at writing — it grows). Record them; "0 new vs baseline"
   is the merge gate, not the absolute numbers here.
2. **Phase 1 — profile agents (read-only), one per primitive, parallel:**
   each reads its component + generator + catalog entry and returns: the
   always-on scaffolds (most non-math components have ZERO `showOptions` —
   scaffolds are hardcoded renders), the eval modes and what each mode's
   task identity is, any band/PRE gating already present, whether a live
   tutor is wired (batch 1 found orphans), and any smells (answer leaks,
   unanswerable modes, grade-prose parsing — batch 2 found all three).
3. **Phase 2 — the ORCHESTRATOR (not agents) picks levers** and writes
   per-primitive line-anchored specs, including explicit SKIPs with
   reasons. Lever quality bar: withdraw scaffolding intrinsic to the
   interaction, usually via NEW optional per-challenge fields defaulting
   to byte-identical legacy (easy = current behavior).
4. **Phase 3 — implementer agents, parallel, disjoint files:** generator +
   component + tests per primitive. **Catalog patches are returned BY
   VALUE, never written by agents** — zero collisions in batch 2 came
   from this.
5. **Phase 4 — orchestrator applies all catalog patches SERIALLY**, then
   runs merge gates over the whole tree.
6. **Phase 5 — registers + ship** (see "Closing the slice").

---

## House pattern (non-negotiable, from batches 1–2)

- Tier stamped in CODE post-parse from `ctx.supportTier` — never
  prompt-steered (one sanctioned exception existed in batch 2:
  word-sorter's instruction-wording lever; a new exception needs the same
  explicit justification in the spec).
- **Gate ONLY on `supportTier`, never `pinnedType`** — the batch-1
  silent-no-op trap.
- Band (K/PRE) gates COMPOSE with tier and WIN over it.
- Per-challenge optional fields default to byte-identical legacy; the
  no-tier path must be byte-compatible (probe-verified).
- Thread `supportTier` to the live tutor where one exists + ship a
  SUPPORT-TIER reveal-policy directive — 6 of 8 batch-2 profiles showed
  the tutor would otherwise re-supply every withdrawn scaffold.
- Answer-form levers only where the correct option is always retained
  (distractor count yes; **MC ↔ free-production NEVER** — that changes
  task identity, which is eval-mode territory).
- For narrative/production primitives, instruction-as-scaffold is
  **prompt-driven, not code-reconstructed** — deterministically rewriting
  NL prose desyncs it from the answer. Code owns deterministic display
  levers + hard guarantees (e.g. delete `ch.hint` at hard).
- Living sims: overlays/hints withdraw; **the manipulable object never
  does** (direct-manipulation-first).
- Canonical harness reference: `gemini-angle-workshop.ts` (math template).

**Archetype expectations for this roster:** the literacy six are mostly
production/structure primitives (story-map, opinion-builder,
paragraph-architect, revision-workshop) — expect sentence frames, word
banks, structure outlines as the withdrawable scaffolds, with the
prompt-driven rule above in force. sound-wave-explorer is a living sim.
constellation-builder / planetary-explorer / spelling-pattern-explorer
lean builder/recognition — watch for rule-#1 leaks when a highlight or
label correlates with the answer (the rhyme-studio class).

---

## Gates

**Per item (its implementer agent):**
- New `*.support-tiers.*` vitest suite with **reverted-gating
  non-vacuity evidence** (disable the gate → named tests fail).
- Existing suites for that primitive stay green.
- **≥3 real-Gemini probes** via `/api/lumina/eval-test` (dev server;
  use an isolated port like `:3005` if `:3000` is contended): hard =
  withdrawal stamps present; easy = full help; no-param = fields absent,
  byte-compatible legacy.

**Merge (orchestrator, after serial catalog application):**
- `npm run typecheck:lumina` → 0.
- Project-local `./node_modules/.bin/tsc --noEmit` → 0 NEW vs the
  Phase-0 baseline.
- Full vitest → 100%, count ≥ Phase-0 baseline.
- Artifact scan of applied catalog patches for encoding damage — **decode
  agent journals/structured output as UTF-8 explicitly**; PS 5.1
  `Get-Content` ANSI-default once mojibake'd em-dashes into the catalogs.

**Defects found en route** (expect some — batch 2 found 7, including two
rule-#1 leaks and the bug that became 14m): fix in-slice ONLY if inside
the primitive being wired; anything systemic or cross-primitive gets
QUEUED in its owning register with executor named, per `/pm` discovery
routing — never fixed inline.

---

## Closing the slice (same session, same day)

1. Strike the 10 rows in `qa/support-tiers/BACKLOG.md` with evidence
   links (re-read from disk first).
2. Report: `qa/eval-reports/support-tiers-batch3-<date>.md` — scoreboard
   table (implemented / partial / abstained + levers + defects), probe
   evidence pointer, orchestration lessons.
3. `WORKSTREAMS.md` stream 3: state → 31/36, last touched, report link.
4. `qa/HUMAN-CHECKS.md`: ONE new row — batch-3 hard-tier feel pass, all
   10 in one sitting, modeled on row #60. Check the numbering note for
   the next free ID at run time (62 at writing; shared file, may move).
5. Ship: code slice(s) per the batch (batch 2 shipped as one commit —
   acceptable, one campaign's work) + registers in their own
   `docs(pm)` commit. Push.

**What NOT to do:** don't re-derive the roster (this file + the queue are
authority); don't touch hydraulics-lab / timeline-builder / math; don't
let an agent write a catalog file; don't trust `status: pass` alone from
eval-test without the stamp assertions (the probes name what to check);
don't leave the batch report unwritten because "the journal has it".
