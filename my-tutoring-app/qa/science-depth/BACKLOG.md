# Science depth — Queue

Queue of record for the biology/science answer-leak class (CELL-1, LCS-1, CS-1,
PA-1, BIO-1, BIO-2). Created by `/pm` 2026-08-13 when this stream's detail moved out
of `WORKSTREAMS.md`: it was the one stream on the board with no queue file, which is
why its detail had nowhere to live but the index.

**Evidence lives in `qa/EVAL_TRACKER.md` rows and `qa/oracle-test/` reports; this file
is authority for WHAT is queued and in what order.** Executors: `/primitive-contract`,
`/oracle-test`, `/eval-fix`.

Top = next.

---

## 📥 MOVED FROM `WORKSTREAMS.md` — `/pm` 2026-08-13 (user ruling)

The index's `## ACTIVE` section had grown to ~1,360 lines (79% of the file), so each
stream's DETAIL now lives in its owning queue and the index carries the pointer plus the
one-line state. **Moved verbatim, nothing deleted.** The index remains authority for
STATE (active/parked, what to pull next); this block is authority for the detail behind
it. Where the two disagree, the queue wins on WHAT and reports win on EVIDENCE.

### 0. Science depth — the biology answer-leak class — **PROMOTED TO ACTIVE `/pm` 2026-08-08** — last touched **2026-08-18**

- **Queue:** `my-tutoring-app/qa/EVAL_TRACKER.md` (rows DNA-1 ✅ / CB-1 ✅ /
  CELL-1 ✅ / **LCS-1** / CS-1 / PA-1 / DNA-2 / BIO-1 / BIO-2). **Executors:**
  `/oracle-test` then `/eval-fix` for the three unmeasured rows.
- **Why it took the slot.** It was carried as "QUEUED, rides as the +1" for two
  days. Then DNA-1 was actually pulled (08-08) and the fix's own domain scan found
  **four more**, one of which `/pm` verified in code this run and which is worse
  than the original.
- **✅ CB-1 `cell-builder` CLOSED 2026-08-08 — component-only, as filed.** The palette
  row renders the organelle name alone; the correct zone now appears on the *placed*
  organelle behind `placeChecked && !zoneCorrect` (the corrective reveal — where it
  should have gone), matching the gate the quantity-reasoning block already used at
  `:1022`. Swept the rest of the component for the same class — phase 1's
  `fb.explanation` is post-check and wrong-only, phase 3 uses `shuffledFunctions`,
  quantity feedback is `placeChecked`-gated — **CB-1 was the only leak.**
  **One correction to the filing:** the diagram's drop zones do *not* carry zone
  names. `getZoneFromPosition` is submit-metrics-only (`:520`) and the cell is a
  single unlabelled `LuminaDropZone`, so the palette label was the **only** zone
  vocabulary on screen — hence a corrective reveal rather than a plain delete.
  `npm run typecheck:lumina` 0 errors; full `tsc` 806 = baseline. **Not
  browser-driven** (render-path change → needs a look at the Place phase).
  **⚠️ UNCOMMITTED.**
- **✅ CELL-1 `cell-builder` CLOSED 2026-08-18 — contract-first redesign.**
  Free-coordinate `ZONE_BOUNDS` grading is gone. Six mutually exclusive model-region
  targets now emit one discrete `CellZone` per organelle; the surface says it is a
  relationship map rather than a literal 2D coordinate claim. First commit locks
  before corrective reveal, so retries cannot rewrite IRT evidence. Four eval modes
  make inventory, placement, function, and specialization independently routable.
  Contract: `src/components/lumina/docs/contracts/cell-builder.md`; focused runtime
  10/10. Real eval-test API draw is blocked upstream by the unrelated missing
  `gemini-word-flip` module.
- **✅ DNA-1 CLOSED 2026-08-08** — and **the old row under-counted it**. The 6/10
  figure counted only exact `givenStrand === templateStrand`; the dominant form was
  **PARTIAL overlap** (a 4-base given inside an 8-base displayed strand), so the
  true pre-fix rate was **19/20 generations, 22/44 challenges**. **The shipped
  oracle had the same blind spot** — it returned `pass, 0 violations` over 10
  generations of which 7 were leaking, and its own "clean" fixture was itself
  leaking. Fixed at the **code** layer (no JSON schema expresses a cross-field
  constraint, and prose did not bind FF-1 either): `validateDnaExplorerData` runs
  post-config-merge, recomputes the complement, minimum-edit-repairs any
  shared-4-base-run given, and **derives** every `correctAnswer`. Oracle
  strengthened independently so the guard cannot certify itself. Post-fix **0/20**.
  **Residual → HUMAN-CHECKS #78** (the repair rewrites content at render time and
  nobody has opened the Build tab). Report
  `qa/eval-reports/dna-explorer-DNA-1-2026-08-08.md`. **⚠️ UNCOMMITTED.**
- **The generalisable finding, and it is the one to carry:** *a guard written by
  the same understanding that missed the defect will certify the defect.* The
  oracle and the leak shared a blind spot for eleven months. When fixing a leak,
  re-derive the detector **from scratch**, and re-measure the OLD number before
  trusting it — DNA-1's headline was wrong by 3×.
- **➡️ TOP = LCS-1. Three unmeasured rows are filed with predicates so the probe is cheap:** LCS-1
  (`life-cycle-sequencer` — does stage *i*'s `description` name stage *i±1*'s
  label?), CS-1 (`classification-sorter` — does the retry hint name the target
  category? the SS-5 pattern, already measured at 2/3 on spatial-scene), PA-1
  (`bio-process-animator` — is the correct option a verbatim span of the preceding
  narration, and does one slot hold >70% of keys?). **Measure before asserting
  severity.**
- **Scope fence.** DNA-2 (variety) is LOW and explicitly **do not spend on it** —
  same shape as SST-1, where a prompt-entropy lever A/B-proved only MODERATE and
  was reverted. BIO-2 is a density campaign,
  not this lane; it needs a demand check first. **Measured by `/pm` 2026-08-18, correcting
  the "~42" estimate: 60 of 197 catalog entries carry NO `evalModes` field** — engineering
  18, biology 17, core 12, astronomy 7, media 3, plus `scale-spectrum`, `word-flip`,
  `motion-diagram`. The count is real but NOT all of it is demand: some are presentational
  by design (`formula-card`, `image-panel`, `concept-card-grid`, `curator-brief`,
  `take-home-activity`) and some are DI-judged without a mode ladder (`word-flip` — shipped
  literacy port, `supportsEvaluation: true`, no `evalModes`). **So the demand check is a
  triage, not a headcount: split the 60 into presentational / DI-judged / genuinely-unwired
  before scoping any campaign.** Executor `/add-eval-modes`, after `/curriculum-fit`.
