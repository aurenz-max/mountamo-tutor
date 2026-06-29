# Topic Fidelity Sweep: Science Primitives — 2026-06-28

Scope: all 47 science content generators across astronomy (11), biology (18),
chemistry (13), physics (5). Question: does each generator honor the lesson's
`topic` AND the per-primitive `intent` the manifest assigned?

## Structural finding

- **No registry-drop bug.** Every science generator is context-native
  (`registerContextGenerator`), so `ctx.topic` and `ctx.intent` are always
  delivered. The older "intent dropped at the registry handler" mechanism does
  not apply here.
- **None use the shared `scopeContext.ts` contract** — each rolls its own prompt.
- **The pervasive failure mode is the dead-intent field**: the generator reads
  `ctx.topic` but never interpolates `ctx.intent` into its Gemini prompt, so the
  manifest's per-primitive objective is silently discarded. Two primitives given
  the same topic but different intents render identically.

## Triage (pre-fix)

| Verdict | Count | Generators |
|---|---|---|
| ✅ Honors both (no action) | 15 | astro: constellation-builder, planetary-explorer, light-shadow-lab · bio: adaptation-investigator, classification-sorter, energy-cycle-engine, evolution-timeline, food-web-builder, habitat-diorama · chem: atom-builder, matter-explorer, molecule-constructor, reaction-lab, states-of-matter, molecule-viewer |
| 🟡 Intent dropped, values LLM-chosen (Tier-1, full fix) | 18 | bio: species-profile✓, organism-card, cell-builder, dna-explorer, inheritance-lab, microscope-viewer, process-animator, protein-folder, compare-contrast, compare-contrast-with-images, life-cycle-sequencer · chem: energy-of-reactions, equation-balancer, ph-explorer, safety-lab, gas-laws-simulator, stoichiometry-lab · phys: motion-diagram |
| 🔴 Intent dropped, values code-picked (Tier-1 partial; Tier-2 deferred) | 13 | astro: day-night-seasons, mission-planner, moon-phases-lab, orbit-mechanics-lab, rocket-builder, scale-comparator, solar-system-explorer, telescope-simulator · phys: gravity-drop-tower, push-pull-arena, race-track-lab · bio: body-system-explorer · chem: mixing-and-dissolving |

Note: `molecule-viewer` (gemini-chemistry.ts) initially looked HIGH-risk in isolation,
but its registry adapter feeds `moleculePrompt = ctx.intent || ctx.title || ctx.topic` —
intent IS the molecule. Reclassified ✅.

## Fix applied

**Tier-1 intent interpolation** (the species-profile pattern): add
`const intent = ctx.intent || "";` + a conditional `intentFocus` directive into the
main student-facing-content prompt. Empty intent → byte-identical prompt → no regression.

- 🟡 cluster: full fix — the LLM picks the student-facing values, so intent now steers them.
- 🔴 cluster: partial fix — intent reaches the LLM-authored TEXT (narrative, objectives,
  question wording), but structurally code-picked values (feature toggles, object/value
  libraries, grade tables) remain grade-bound. Marked with `// TODO: ... (Tier-2)` at the
  picker. True value-fidelity for these is deferred Tier-2 (intent-gated value selection
  or a micro-resolver).

### Pilot verification (species-profile)

Same species (Great White Shark, grade3), intent varied:
- Intent "diet and hunting strategy" → detailed multi-sentence `huntingStrategy`
  ("breach tactic… from the dark depths").
- Intent "habitat and ecological niche" → hunting collapsed to one line; diet/niche
  text pivoted to ecological role.

Intent now TRACKS (was a constant before). tsc: 1417 (baseline 1419), zero new errors.

## Per-domain edit results

**31 generators fixed this sweep; 2 found already-honored (reclassified ✅).**

- **Biology (11 fixed):** species-profile (pilot, verified), organism-card, cell-builder,
  dna-explorer, inheritance-lab, microscope-viewer, process-animator, protein-folder,
  life-cycle-sequencer (FULL); compare-contrast + compare-contrast-with-images — these are
  positional (not ctx-native), so intent was threaded as an optional trailing param and the
  4 call sites in `registry/generators/biologyGenerators.ts` updated to pass `ctx.intent`;
  body-system-explorer (PARTIAL, system code-matched — Tier-2 TODO).
- **Chemistry (5 fixed, 2 skipped):** energy-of-reactions, equation-balancer, ph-explorer,
  safety-lab (FULL); mixing-and-dissolving (PARTIAL — substance pool code-picked, Tier-2 TODO).
  SKIPPED (already interpolate raw `ctx.intent` via `intentHint`): stoichiometry-lab,
  gas-laws-simulator → reclassified ✅.
- **Astronomy (8 fixed, all PARTIAL):** day-night-seasons, mission-planner, moon-phases-lab,
  orbit-mechanics-lab, rocket-builder, scale-comparator, solar-system-explorer,
  telescope-simulator. Intent now drives narrative/objectives/hint/question TEXT; feature
  toggles + grade tables remain grade-bound (Tier-2 TODO at each table).
- **Physics (5 fixed):** motion-diagram (FULL); gravity-drop-tower, push-pull-arena,
  race-track-lab, sound-wave-explorer (PARTIAL — object/value libraries code-picked, Tier-2 TODO).

Every edit is conditional on `ctx.intent` being non-empty → empty intent yields a
byte-identical prompt (no regression). No schemas, grade tables, or existing logic changed.

**Verification:**
- tsc: 1417 (baseline 1419), zero new errors, zero errors in any science generator path.
- species-profile (FULL) probe: same species, intent "diet/hunting" vs "habitat/niche" →
  output facets tracked (hunting strategy detailed under A, collapsed under B).
- push-pull-arena (PARTIAL) probe: intent "friction/surface type" → title + challenge text
  honored ("Super Slippery Surface Challenge", ice floor); structural values stay code-picked.

## Revised tally (post-sweep)

| Verdict | Count |
|---|---|
| ✅ Honors both (incl. 2 reclassified) | 17 |
| ✅ FULL fix applied (intent steers values) | 17 |
| 🟠 PARTIAL fix (intent steers text; values code-picked — Tier-2 deferred) | 13 |
| **Total** | **47** |

## Deferred (Tier-2) follow-ups

The 🔴 cluster's structurally code-picked values still ignore intent. Worth a future
pass (intent-gated value selection, or a `scopeRangeResolver`-style micro-resolver) for:
astronomy simulators (8), physics labs (3, object/value libraries), body-system-explorer
(system selection), mixing-and-dissolving (substance pool).
