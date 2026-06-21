# Add Structural Difficulty to a Primitive

This skill makes a primitive's `config.difficulty` produce a **genuinely harder problem by SHAPE** at higher tiers — not just less help. It is the *second axis* of within-mode difficulty: the "ceiling" half that lets a student who has mastered a mode keep climbing, instead of topping out at "no scaffolding."

## The outcome you're designing for

> **easy/medium/hard produce structurally different PROBLEMS — more carries, subtler gaps, more coupled variables, nearer distractors — while every number stays inside the eval mode's magnitude band.**

`config.difficulty` ('easy' | 'medium' | 'hard') drives up to **two dials**. `/add-support-tiers` builds the first (scaffolding withdrawal — "how much help?"). This skill builds the second (problem shape — "how hard a problem, structurally?"). A strong tier usually does both: a harder problem **and** less help.

The tell that a primitive needs this skill: easy/med/hard currently produce **byte-identical problems** with only the on-screen help toggled. Scaffolding withdrawal alone can't ratchet *up* past "no help," so a strong student tops out. This axis fixes that.

## The one hard rule (the guardrail, not the goal)

**Structural difficulty changes the problem's SHAPE, never its MAGNITUDE, and never its eval mode.** Harder ≠ bigger numbers — that is the retired numeric-difficulty path (`5×+5 ≈ 7×-3`; see [[structural-difficulty-not-numeric]], [[feedback_llm-window-code-builds-structure]]). The lever is a *gap / step / part-count / regroup-count / coupled-variable* change. Magnitude is owned by the eval mode + grade-band scope; the tier never pushes past it, and never reshapes the problem into a *different* eval mode (the eval mode is the task identity).

## Prerequisite & when NOT to use

**Run `/add-support-tiers` FIRST.** This axis rides that skill's harness — the same `config.difficulty` field, the same `normalizeSupportTier()`, the same `if (supportTier)` post-process block, and `buildTierPromptSection` literally *merges* both axes' prompt lines. Without the support-tier plumbing in place there is nothing to hang this on.

- **No clean in-mode structural lever** → a primitive may legitimately support *only* the scaffolding axis. Don't invent a fake lever (a bigger-numbers lever in disguise) just to fill the table. Stop and tell the user.
- **The lever would change the eval mode** → that's not a difficulty tier, it's a different mode (`/add-eval-modes`). (read_scale going off-tick *becomes* scaled_bar_graph — forbidden. Keep it on-tick; let step coarseness be the lever.)
- **Don't scale magnitude by tier** — bigger/smaller numbers is the banned numeric path.

## Architecture (the dataflow)

```
config.difficulty ('easy'|'medium'|'hard')  ── manifest, already emitted per component
        │  ...item.config spread (add-eval-modes registration)
        ▼
generator: gemini-[primitive].ts
   normalizeSupportTier(config.difficulty) → tier              ← FIXED harness (from add-support-tiers)
   resolveSupportStructure(mode, tier) → {scaffold, promptLines}   ← axis 1 (add-support-tiers)
   resolveProblemShape(mode, tier[, places]) → {…levers, promptLines}  ← axis 2 (THIS SKILL)
   buildTierPromptSection(mode, tier) merges BOTH axes' promptLines    ← THIS SKILL upgrades it
        │
        ▼  POST-PROCESS, gated on supportTier:
   count the LLM's actual shape → if it misses the target, RE-SELECT the
   answer-bearing values (operands / gap / step) deterministically       ← THIS SKILL (the core)
        │
        ▼
[Primitive].tsx — recomputes the answer from the rewritten data. NO component change.
```

**This is a generator-only task.** The structural axis re-shapes the *generated problem*; the component already renders whatever it's handed and recomputes the answer. (Contrast axis 1, which usually needs component `showOptions` fields.)

## The structural lever — find yours by archetype

There is **one in-mode structural lever per mode**. Classify the primitive by archetype (the same map `/add-support-tiers` uses), then pick the lever from the right column. The lever names differ by archetype; the procedure does not.

| Archetype | Structural lever (easy → hard) | Code-enforceable? |
|---|---|---|
| **Manipulative / quantity** (ten-frame, base-ten, regrouping-workbench) | **regroup-event count** (carries/borrows 1→2→cascade / cross-zero); parts to coordinate (1 group → many) | **yes** — re-select operands |
| **Multi-step solver** (angle-workshop, tape-diagram) | operation/step depth (one diff → total → two-step); scenario complexity | partly (depth is prompt-shaped + validated) |
| **Graph / data** (bar-model, coordinate-graph) | gap subtlety \|a−b\| (4→1); axis step coarseness (2→5→10); icon multiplier (2→5); dataset ambiguity | **yes** — clamp gap/step/multiplier |
| **Builder / constructor** (equation-builder, number-bond) | # of parts; constraint count | **yes** — control part count |
| **Living simulation** (PhExplorer, GasLaws) | # of coupled/interacting variables; initial-condition complexity | partly |
| **Recognition card** (SightWordCard, RhymingPairs) | distractor similarity (far → near) | **yes** — pick distractors by distance |

> **CAUTION on the floor:** if a mode's *identity* IS a structural property ("with regrouping"), the easy tier must still satisfy it — `add_regroup` easy keeps ≥1 carry; dropping to 0 silently becomes its `_no_regroup` sibling = a forbidden eval-mode jump. Read the catalog `evalModes` and set the floor per mode.

## Step-by-Step Workflow

### Phase 1: Pick the in-mode lever per mode (the design)

1. **Confirm `/add-support-tiers` already ran** on this primitive (there's a `resolveSupportStructure` + an `if (supportTier)` block). If not, stop and run it first.
2. **Read the catalog `evalModes`** for the primitive. For each mode, identify its **one** structural lever (table above) and its **in-mode floor** (the structural property that defines the mode — never drop below it) and **band cap** (the magnitude ceiling the lever must stay under — e.g. operand digit-count, on-tick values).
3. **Write the easy→hard gradient per mode as a small table and confirm it with the user** before coding. Each row: mode · lever · easy/med/hard values · floor · cap. Mark which levers are code-enforceable vs prompt-shaped.

> **The spine — one dial, two places.** `config.difficulty` is a *single* dial, so a structural lever lives in **two places that must never drift**: the **prompt**, where the tier *describes* the harder shape to the LLM (the only handle for soft levers — operation depth, ambiguity), and the **post-process**, where the tier *enforces* the exact value in code (the hard levers — gap, step, regroup-count). The tier enum is the **one key** that reaches both; the student's answer is recomputed from whatever the code finally lands. Phases 2–4 build those two places and the key between them — everything else (merging prompt sections, deduping a constant) is plumbing.

### Phase 2: Describe the lever as data — one source of truth

4. Add a sibling to `resolveSupportStructure` — `resolveProblemShape(mode, tier[, band])` — that turns one tier into one structural intent: a few **enforced numbers** (the hard levers) plus **prompt lines** (the soft description). Both places below consume *this one function*, so the prompt and the code can never disagree about what "hard" means. **Clamp to [floor, cap] inside it**, where the band is known, so the returned target already respects the mode's floor and the magnitude ceiling — a band that only fits one unit of the lever **saturates here, honestly** (a 2-digit problem fits one regroup → its hard tier is 1, not a forced overflow). *Concrete: regrouping returns `{regroupTarget, crossZero, chainedCarry, promptLines}` keyed on `places`; bar-model returns `{compareGap | forcedStep | iconValue, promptLines}`.*

### Phase 3: Reach both places from the one key

5. **Hand each sub-generator the tier enum itself, not a pre-built string.** The tier has two jobs from that one key — *describe* the harder shape in the prompt and *enforce* the exact lever in post-process — and a baked string can only do the first. *Concrete: fold `resolveProblemShape(...).promptLines` into the existing scaffolding prompt block so the LLM sees one coherent "what 'hard' means here," not two competing knobs — in the references this is `buildTierPromptSection`.*
6. **Tell the truth in the guardrail.** This axis re-selects values, so the scaffolding skill's "numbers never change" line is now false. Rename the constant `NUMBERS_NEVER_CHANGE` → `TIER_GUARDRAIL` and reword it: structure changes (gaps/steps/regroup-count/cross-zero), magnitude does not.

### Phase 4: Enforce in code — describe is a hope, enforce is a guarantee

7. **The prompt is advisory; the code is authoritative.** An LLM asked for an exact gap/count drifts, so the post-process owns the hard lever. In the `if (supportTier)` block (gated so the no-tier path stays **byte-identical**), per challenge resolve its shape from its OWN mode and **count → honor-if-valid → reconstruct**:
   - **Count** the LLM's actual shape.
   - **Honor it when it already hits the target** — don't churn a valid problem the LLM wrote a coherent question around.
   - **Otherwise reconstruct deterministically** to the *exact* target, inside the band, preserving solvability invariants (subtraction M>S, comparison taller-bar-wins, options still contain the answer). Soft levers with no clean numeric handle stay prompt-only + validated.
8. **Close the loop on the answer.** Re-selection is answer-bearing, so recompute the answer from the new values (rewrite the `problem` string the component parses, or recompute the emitted answer field) and drop any pre-baked narration keyed to the old values. Log per-challenge target vs. result.

### Phase 5: Verify

9. **Project-local tsc** (per [[tsc-verification-integrity]]): `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit`; confirm zero new errors vs. the baseline global count (~1419/1444) and zero in the two files.
10. **Stress-test the builders offline** — extract the constructive builders + counters into a throwaway node script and assert, over thousands of random runs across every mode/tier/band, that the produced values hit the exact target, stay in band, and preserve invariants (this is how the regrouping pilot caught an `M==S` 0-borrow bug).
11. **Live `/eval-test` sweep** with the tier param: `…/eval-test?componentId=<id>&evalMode=<mode>&difficulty=<easy|medium|hard>` (add `&gradeLevel=grade%204` to reach a wider band). Confirm the problem gets structurally harder across tiers, the **floor holds** (easy never drops below the mode's defining property), the band **saturates honestly** at the small end (no out-of-band inflation), and the math is consistent (claimed lever == actual). Report what you saw.

## Gotchas (read before shipping)

**1. Answer-bearing by construction — this axis rewrites the values the checker reads.** Unlike scaffolding (mostly display-only), re-selecting operands/gaps *is* the answer. Three invariants:
- **Recompute the answer from the NEW values.** If the component derives `correctAnswer` from a parsed `problem` string, rewrite that string and you're done; if the generator emits an answer field, recompute it. A stale answer field rejects the student's correct input.
- **Preserve solvability invariants** when reconstructing (subtraction M>S, no negative result; comparison taller-bar-wins; options still contain the answer).
- **Drop pre-baked narration** keyed to the old values (e.g. `regroupingSteps` with specific from/to digits) — the live tutor narrates fresh.

**2. The in-mode floor & band cap are the two ways this silently breaks.** Below the floor you've changed the eval mode (forbidden); above the cap you've inflated magnitude (the retired path). Clamp `regroupTarget`/etc. to `[floor, cap]` inside `resolveProblemShape`, where the band is known. A mode whose band only fits one unit of the lever saturates there — that's correct, not a bug; say so in the report.

**3. Byte-identical no-tier path.** Gate every structural branch on `supportTier` being present. A generation with no `config.difficulty` must be unchanged from before this skill ran.

## Reference implementations

| | Archetype | Lever | Notable |
|---|---|---|---|
| **regrouping-workbench** | manipulative | **regroup-event count** (carry/borrow 1→2→cascade / **cross-zero** at hard) | `service/math/gemini-regrouping-workbench.ts` — **the worked reference for code-enforced operand re-selection.** Constructive digit builders (`buildAdditionOperands`/`buildSubtractionOperands`, ones-first), `countCarries`/`analyzeBorrows` validate the LLM, cap = `places−1` keeps it in band, M>S strict; `no_regroup` modes pinned at 0. See [[project_structural-difficulty-regrouping-pilot]]. |
| **bar-model** | graph/data | gap \|a−b\| · axis step · icon multiplier · operation depth | `service/math/gemini-bar-model.ts` — **the worked reference for the multi-mode lever table.** `resolveProblemShape` returns `compareGap`/`forcedStep`/`iconValue`, each clamped in its sub-generator's post-process; depth/ambiguity levers are prompt-shaped + validated. |
| **tape-diagram / hundreds-chart** | multi-step / graph | step depth · gap subtlety | dual-axis, code-enforced — skim for additional patterns. |

## Checklist

- [ ] `/add-support-tiers` already on the primitive (shared harness + `if (supportTier)` block exists)
- [ ] One **in-mode** structural lever per mode, each **structural not magnitude**; floor + band cap identified from the catalog `evalModes`; gradient table confirmed with the user
- [ ] `resolveProblemShape(mode, tier[, band])` returns numeric levers + promptLines, **clamped to [floor, cap]** internally
- [ ] **One key, two places:** the tier *enum* (not a baked string) reaches both the prompt (*describes* the shape) and the post-process (*enforces* it); guardrail renamed truthfully `NUMBERS_NEVER_CHANGE` → `TIER_GUARDRAIL`
- [ ] Post-process **counts → honors-if-valid → reconstructs** to the exact target via constructive builders; gated on `supportTier`; **byte-identical** no-tier path
- [ ] **Answer-bearing** handled: answer recomputed from new values, solvability invariants preserved, stale narration dropped
- [ ] Verified: project-local tsc vs. baseline; offline builder stress test (exact + in-band + invariants); live `/eval-test` tier sweep (floor holds, band saturates honestly, math consistent)
