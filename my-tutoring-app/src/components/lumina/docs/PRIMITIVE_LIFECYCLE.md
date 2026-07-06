# Primitive Lifecycle — the Layered Build Ladder

Every Lumina primitive is built in **layers**, not in one pass. `/primitive` births a primitive at **L0** — pedagogically sound, measurable, single core mode — and each add- skill raises it one layer. Each skill is the **single source of truth** for its layer: no skill inlines another's templates (copies drift), and no layer is "half-done" inside another skill's run.

**Why layered:** one-pass builds ask a single session to get five design disciplines right simultaneously (interaction, generator schema, eval-mode ladder, tutoring copy, difficulty axes) — and quality dies in the contention. The cut line is **retrofit cost**: decisions that are expensive to retrofit (multi-instance schema, challenge-type field, Fork A/B, answer-leak gating, kit chrome, `onEvaluationSubmit`) are locked at birth; everything else layers on cheaply afterward.

## The ladder

| Layer | Name | Built by | What it adds | Before it runs (accepted degradation) | Detection signal in code |
|-------|------|----------|--------------|----------------------------------------|--------------------------|
| **L0** | Born | `/primitive` | Component (kit chrome, multi-instance, answer-leak audited, `sendText` hooks), generator (one core task identity, Fork A/B), catalog entry, registry, tester, metrics | — (below L0 the primitive doesn't exist) | `id` present in `catalog/<domain>.ts` + `primitiveRegistry.tsx` + a registered generator |
| **L1** | Eval-dense | `/add-eval-modes` | Task-identity ladder: catalog `evalModes[]` + β priors, backend `problem_type_registry.py`, `resolveEvalModes` + schema constraining, Fork A mixed path (SP-21) | Unpinned generic routing; IRT can't ladder difficulty across modes | catalog entry has `evalModes[]`; generator calls `resolveEvalModes` |
| **L2** | Tutored | `/add-tutoring-scaffold` | Catalog `tutoring:` block (taskDescription, contextKeys, scaffoldingLevels, commonStruggles, aiDirectives) | Generic tutor (component `sendText` hooks fire, but no primitive-specific scaffold) | catalog entry has `tutoring:` **AND** component uses `useLuminaAI` — one without the other is the orphaned-config bug |
| **L3** | Tiered | `/add-support-tiers` | `config.difficulty` withdraws scaffolding intrinsic to the interaction (axis 1: how much help) | easy/medium/hard are a no-op — identical output at every tier | generator has `normalizeSupportTier` / `resolveSupportStructure` |
| **L4** | Shaped | `/add-structural-difficulty` | `config.difficulty` also changes problem SHAPE — regroup count, gap subtlety, part count — inside the mode's magnitude band (axis 2: how hard a problem) | Difficulty = help-withdrawal only; a strong student tops out at "no help" | generator has `resolveProblemShape` + enforced post-process |
| **L5** | Polished | `/add-sound` (+ `/add-spoken-judge` for spoken-production primitives) | 2-4 tactile interaction sounds; spoken clip-judge ladder where the student produces speech | Interactions are silent (global navigate/correct/celebration sounds are automatic regardless) | component calls `SoundManager.*`; spoken: `useVoiceAnswer` / `useVoiceChoice` wiring (`/add-voice-control`) |

**Hard ordering rules:** L4 requires L3 (structural difficulty rides the support-tier harness — same `config.difficulty`, same `if (supportTier)` block, `buildTierPromptSection` merges both axes). L1 before L3/L4 (tiers apply within a *pinned mode*; without a ladder there's nothing to pin). L2 can run any time after L0. Some primitives legitimately stop before L4 — a scaffolding-only primitive with no clean in-mode structural lever stays at L3; don't invent a fake lever.

## The QA loop — `/eval-test` closes every layer

**A layer only counts when `/eval-test` passes at that layer.** It is the cross-cutting verification loop, not a rung:

- **After L0:** `/eval-test <id>` — single core mode, G1/G2/G4/G5 sync rules (G3 is N/A until L1).
- **After L1:** `/eval-test <id> <mode>` for every mode (+ the Auto/mixed path for Fork A pool-service generators — the SP-21 blind spot per-mode testing can't see).
- **After L3/L4:** the tier sweep — `…&difficulty=easy|medium|hard` per mode; confirm tiers actually differ (L3) and the shape hardens while magnitude holds (L4).
- **Findings** route through `/eval-fix` (structured fix workflow) — not ad-hoc patches.
- Reports land in `my-tutoring-app/qa/eval-reports/<id>-<date>.md`; intent honoring is `/topic-fidelity`'s job.

## The birth certificate

`/primitive` ends every run by printing a **birth certificate** and saving it to `my-tutoring-app/qa/eval-reports/<id>-birth.md`: the L0 record (core task identity, fork, sendText tags, answer-leak audit, curriculum home) plus the **follow-up queue** — one row per remaining layer, each pre-filled with real input from the birth session (ladder candidates for L1, contextKeys candidates for L2, withdrawal-scaffold observations for L3). A later session picks up the queue cold from that file. The layering framework is only as reliable as this handoff.

## Reading a primitive's layer

Don't keep a ledger — **derive the layer from the code** using the detection-signal column above (`/lumina-portfolio health` does this per domain). A stale ledger is the pre-baked-mapping mistake in new clothes; the catalog, generator, and component are the truth.
