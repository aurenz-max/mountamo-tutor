# Add Support Tiers to a Primitive

This skill makes a primitive's `config.difficulty` actually change what the student sees, so that **a struggling student and a strong student working the *same* skill get genuinely different content** — the struggling one keeps on-screen scaffolds (a count readout, a named strategy, a pre-built equation), the strong one works unaided and justifies their thinking.

## The outcome you're designing for

> **easy = the workspace helps the student self-check. hard = the student works unaided and justifies their thinking.**

`config.difficulty` ('easy' | 'medium' | 'hard') is the *second* field of the two-field contract `/add-eval-modes` sets up — `targetEvalMode` = WHICH skill (the task identity), `difficulty` = HOW MUCH support within it. It drives up to **two dials** (build whichever the primitive supports — many support only one):

1. **How much help?** — *scaffolding withdrawal.* Same problem, less on-screen / instructional support.
2. **How hard a problem, structurally?** — *structural difficulty.* A genuinely harder problem, made harder by **shape** (gaps, steps, multipliers, steps-to-solve), never by bigger numbers.

A strong tier usually does both: a harder problem **and** less help.

## The one hard rule (the guardrail, not the goal)

**A support tier never changes the numbers.** A harder tier must not just make the quantity bigger — that is the retired numeric-difficulty path that was reversed because it didn't work (`5×+5 ≈ 7×-3`; see [[structural-difficulty-not-numeric]], [[feedback_llm-window-code-builds-structure]]). Magnitude is owned by the pedagogical scope and the per-mode count/range tables; the tier never pushes past them, and never pushes the problem into a *different* eval mode (the eval mode is the task identity). Keep this in your pocket as the review test for every lever — but design the outcome first, then check each lever against the rule.

## Why this skill exists

The manifest already emits `config.difficulty` ('easy'|'medium'|'hard') for **every** component (`gemini-manifest.ts`), and `/add-eval-modes` registration already spreads `...item.config` to every generator — so the value *reaches* all ~100 generators. But almost all of them **drop it on the floor**: a struggling vs. a strong student gets byte-identical content. This skill closes that no-op, one primitive at a time.

It is deliberately **per-primitive creative work**, not an auto-rollout: "scaffolding" means something different for every primitive (a ten-frame's support ≠ a number line's ≠ a pH simulation's ≠ a sight-word card's). The skill gives you a fixed harness and a disciplined way to discover *that primitive's* support levers.

## Architecture (the dataflow)

```
┌──────────────────────────────────────────────────────────────┐
│  gemini-manifest.ts                                          │
│  emits config.difficulty: 'easy'|'medium'|'hard' per component│
└───────────────┬──────────────────────────────────────────────┘
                │ ...item.config spread (add-eval-modes registration)
                ▼
┌──────────────────────────────────────────────────────────────┐
│  generator: gemini-[primitive].ts                            │
│  normalizeSupportTier(config.difficulty) → tier              │  ← FIXED harness
│  resolveSupportStructure(mode, tier) → {scaffold, promptLines}│
│  [optional] resolveProblemShape(mode, tier) → structural params│  ← 2nd axis
│  applied PER CHALLENGE at the END, after structural fixups   │
└───────────────┬──────────────────────────────────────────────┘
                │ challenge.showOptions / structural fields / supportTier
                ▼
┌──────────────────────────────────────────────────────────────┐
│  [Primitive].tsx — renders FEWER scaffolds at harder tiers    │
│  live tutor (if any) reads supportTier → calibrates reveal     │
└──────────────────────────────────────────────────────────────┘
```

This is a **generator + component** task (plus a tutor touch if one exists). No backend, no manifest changes — the difficulty value already arrives at every generator; the work is making the generator *honor* it.

## What's fixed vs. what you invent

Most of the harness is copy-paste; the value is in per-primitive lever discovery (the **bespoke** `SupportScaffold` fields + `resolveSupportStructure()` mapping). The architecture diagram above marks what's fixed; Phases 2–3 give the exact code.

> **The single most important step is lever discovery — and you do it by reading the COMPONENT, not the generator.** Levers live in the `.tsx`'s `showOptions` and per-challenge structural fields (`arrangement`, unknown position); the generator only tells you the *modes*. (One family — instruction-as-scaffold — lives in the generator instead; see the modality catalog.)

**Every worked example here is a math primitive** — math (~29 generators) is the only domain wired. The other ~95 generators (chemistry, physics, literacy, engineering, …) are the frontier and expose the same lever families. On a non-math primitive, **don't pattern-match the math examples** (no count-readout or `compareGap` exists) — classify by **archetype** (below) and read the math example that shares its *archetype*, not its subject. The fixed harness is identical across domains.

## Primitive archetypes — find yours first, then sweep its modalities

Before discovering levers, classify the primitive by **how the student interacts with it** (archetype), not by subject. The archetype predicts which modalities carry the weight and which math example to read as a structural template. Most primitives are one archetype; a few blend two (a multi-step solver *over* a simulation).

| Archetype | What it is | Examples (math · non-math) | Lead modalities | Structural-difficulty lever | Math template to read |
|---|---|---|---|---|---|
| **Manipulative / quantity** | Student builds or reads a concrete quantity | ten-frame, base-ten · AtomBuilder, MoleculeConstructor | #1 perception + #3 CPA | parts to coordinate (1 group → many) | ten-frame, counting-board |
| **Multi-step solver** | Identify → set up → execute over a figure/passage | angle-workshop, tape-diagram · ContextCluesDetective, FigurativeLanguageFinder | #2 instruction + #5 answer-form | step count / scenario complexity | **angle-workshop** |
| **Living simulation** | Student drives a physics/chemistry sim with real consequences | (none in math) · PhExplorer, GasLawsSimulator, physics sims | #1 sim overlays (readouts, vectors, trace, gridlines) | # interacting / coupled variables; initial-condition complexity | bar-model (overlay-as-scaffold) |
| **Recognition card** | Recognize / recall a single item | (flashcard-shaped) · SightWordCard, RhymingPairs, SoundSort | #5 recognition↔recall + #1 cue (audio replay, picture, letter highlight) | distractor similarity (far → near) | — (#5-led; see CAUTION) |
| **Graph / data** | Read or build a plotted dataset | bar-model, coordinate-graph · distribution-explorer | #1 tick labels/gridlines | axis step coarseness; dataset ambiguity | **bar-model** |
| **Builder / constructor** | Assemble parts into a valid whole | equation-builder, number-bond · EquationBalancer, word-builder | #1 slot hints/templates + #2 setup pre-assembly | # of parts; constraint count | bar-model (`answerBarIndex` decouple) |

> The lever **families** (#1–#5 below) are universal — PhExplorer has a `showOptions` struct exactly like ten-frame's; ContextCluesDetective has a `showDictionary` compare-view (#3), highlight cues (#1), a multi-phase identify→define flow (#2), and distractor options (#5). What differs by archetype is *which* families dominate and *what the structural lever is called* — never the procedure. The simulation/recognition archetypes are also where memory's [[feedback_direct-manipulation-first]] and [[feedback_living-simulation-pattern]] apply: withdraw overlays/cues, never the manipulable object itself.

## Support modalities — the lever families to sweep

Scaffolding is not one thing. In Phase 1 sweep the **whole menu**, not just `showOptions`. Most primitives expose 2–3; the richest tiers combine families. Every family obeys the one hard rule — **withdraw help, never change the numbers or the task identity.** (The archetype table above lists each family's non-math instances.)

| # | Family | Where it lives | What you withdraw | Priority |
|---|--------|----------------|-------------------|----------|
| **1** | **Perception / tracking aids** | `showOptions` + per-challenge structural fields | on-screen marks that offload *seeing* the quantity/state — count readout, running tally, `arrangement`, tick labels, reading-cue dot, right-angle marks; in sims = overlays (readouts, vectors, trace, gridlines). The skill's original focus (ten-frame, counting-board). | **P1** |
| **3** | **Representational support (CPA)** | generator + component | easy pairs a concrete/visual model with the symbol; hard = symbol-only. Withdraw the model, keep the number/word (array beside the product → drop it). | **P1** |
| **2** | **Instruction-as-scaffold** (task-step withdrawal) | the generator's instruction text (usually NO component change) | **highest-leverage, cheapest, most generalizable.** Decompose the task into cognitive sub-steps, hand the student fewer per tier: *strategy naming* (does the text name which rule applies?), *structure pre-assembly* (is the equation handed over? easy `solve_algebraic` hands `(2x+10)+(x+5)=90`, hard hands nothing), *hint-explicitness ladder*. Applies to **any** task with ≥2 steps; changes only words, so every number is byte-identical. | **P2** (complements P1; the *only* ladder for primitives with no visual levers — AngleWorkshop) |
| **4** | **Worked-example fading** | needs an example surface | easy = full worked parallel example, medium = partial, hard = none. Strong but heavier to build. | P3 |
| **5** | **Answer-form** (recognition vs. recall) | component | easy = choose among options (fewer/dissimilar distractors); hard = free production. Dominant for **recognition-card** archetypes. **CAUTION:** a support axis *only* if the task is unchanged — if changing the form changes what's assessed, that's a new eval mode (`/add-eval-modes`), not a tier. | P3 |

For each candidate ask: *does this primitive expose this lever, and does withdrawing it leave the answer and the task identity intact?* If not → not a support lever. **The bespoke interaction-surface scaffolds (P1) come first — they're the pedagogical core and the creative 20%.**

## The second axis — structural problem difficulty (now its own skill)

The modalities above all answer *"how much help?"* — same problem, scaffolding withdrawn. But a primitive feels weak if easy/med/hard produce **byte-identical problems** with only the help toggled. The second axis answers *"how hard a problem, structurally?"* — a genuinely harder problem by **shape** (gaps/steps/regroup-count/coupled-variables), never by bigger numbers, entirely generator-side.

That axis rides this skill's harness but is a substantial procedure of its own (an in-mode structural lever per mode, plus **code-enforced re-selection** of the answer-bearing values — don't trust the LLM to land an exact gap/regroup-count). It now lives in its own skill:

> **Run `/add-structural-difficulty` after this one** to add the structural axis. It reuses the `normalizeSupportTier` harness and the `if (supportTier)` block you build here, upgrades `buildTierPromptSection` to merge both axes, and renames `NUMBERS_NEVER_CHANGE` → `TIER_GUARDRAIL`. Worked references: `gemini-regrouping-workbench.ts` (code-enforced operand re-selection) and `gemini-bar-model.ts` (multi-mode lever table). A primitive may legitimately support **only** the scaffolding axis, **only** structural, or **both** — build what fits.

> Two gotchas apply once you build certain levers — **answer-bearing levers** (tier code writes a field the checker reads) and **a live tutor that can leak what a tier hid.** Both are covered in **Gotchas** after the workflow; Phase 4 points back to them.

## Prerequisites & when NOT to use

Run `/add-eval-modes` **first** — the primitive needs a generator that resolves a mode (via `resolveEvalModes` *or* legacy `resolveEvalModeConstraint`; resolver-agnostic — the gate keys off "exactly one mode pinned") plus catalog `evalModes`. It also needs **either** a component with `showOptions` / per-challenge structural fields **or** a multi-step task whose instruction can withdraw sub-steps (#2) — visual levers are not required.

- **No real levers across the whole modality catalog** (a genuinely single-step task — a bare flashcard) → it can't have meaningful tiers; stop and tell the user. But check #2 first: most "single display" primitives still have an identify/setup step the instruction can scaffold.
- **Don't use this to scale magnitude by tier** — bigger/smaller numbers is the retired numeric path (already banned by the one hard rule). If a generator still scales magnitude from a theta/band, *remove* it here (Phase 4).

> **Pilot-then-sweep gate (mandatory):** never fan this skill out across multiple primitives (workflow / parallel subagents / batch) until ONE pilot has passed Phase 5 **at runtime** — tiers toggled in the Primitives Tester or `/eval-test`-swept with real generations — and the user has seen the result. A type-checked pilot is not a validated pilot; a sweep multiplies whatever the pilot got wrong (CLAUDE.md Verification Doctrine).

## Step-by-Step Workflow

### Phase 1: Discover the support levers (the creative core)

1. **Ask which primitive, then classify its archetype.** Get the `id` and domain, and place it on the **archetype map** (manipulative / multi-step solver / living simulation / recognition card / graph-data / builder). The archetype tells you which modalities to expect to carry the weight, what the structural lever will be called, and which math reference to read as a template — *especially important for non-math primitives, where no count-readout/`compareGap` analog exists.*

2. **Read the COMPONENT first** — `primitives/visual-primitives/[domain]/[Primitive].tsx`:
   - List every field in `showOptions` (e.g. `showCount`, `showEquation`, `showRunningCount`, `showGroupCircles`, `showLastNumber`, `flashDuration`). Each is a candidate **perception-aid** lever (modality #1).
   - List per-challenge structural fields that affect *how hard the task is to do without changing the number*: `arrangement` (line vs scattered), flash window, number-of-distractors, unknown position, whether a worked step is shown.
   - **Also read the instruction/hint text the generator builds** (modality #2). Even a primitive with no `showOptions` at all almost always has an instruction-as-scaffold lever: break its task into sub-steps and ask which the instruction hands over. AngleWorkshop has *zero* `showOptions` and still got a full easy→hard ladder this way.
   - For each candidate (any modality), decide: does withdrawing it make the student work more unaided **without changing the answer or the task identity**? If yes → it's a support lever. If withdrawing it changes the answer or breaks the UI → it's not.

3. **Read the generator** — `service/[domain]/gemini-[primitive].ts`:
   - Confirm how the mode is resolved (`resolveEvalModes` → `resolution.modes.length === 1`; or `resolveEvalModeConstraint` → `evalConstraint.allowedTypes.length === 1`).
   - Note where `showOptions` is set and where any structural fixups / force-enables happen (e.g. counting-board force-enables `showGroupCircles` when group challenges exist). **Your tier application must run AFTER those** so a hard tier can withdraw them.

4. **Design the easy→hard gradient per mode** and present it to the user as a small table before coding. Principle: **easy = the workspace helps the student self-check; hard = the student works unaided and justifies their thinking.** Map each lever, and note mode-specific exceptions (e.g. subitize is flashed, so a count readout is irrelevant; group rings only exist for group modes).

   Example (counting-board, for shape):

   | Mode | easy | medium | hard |
   |---|---|---|---|
   | count_all / count_on | line, running tally + number tags on | varied, tags on, tally off | scattered, tracking aids off |
   | subitize | line/cluster (easy to perceive) | varied | scattered (must decompose) |
   | group_count / compare | grouping rings on | rings on | rings off (mentally segment) |

### Phase 2: Add the fixed scaffold (copy verbatim)

5. **Add the tier types + normalizer** near the top of the generator, after `CHALLENGE_TYPE_DOCS`:

   ```typescript
   type SupportTier = 'easy' | 'medium' | 'hard';
   const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

   /** STRICT lookup — the manifest enum-constrains config.difficulty to these.
    *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
   function normalizeSupportTier(difficulty?: string): SupportTier | null {
     const d = difficulty?.toLowerCase().trim() ?? '';
     return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
   }
   ```

6. **Add `difficulty?: string` to the generator's config type:**

   ```typescript
   /**
    * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
    * Second axis of the two-field contract: targetEvalMode = which skill,
    * difficulty = how much on-screen scaffolding within it. NEVER changes numbers.
    */
   difficulty?: string;
   ```

### Phase 3: Write the bespoke scaffold (the creative 20%)

7. **Define `SupportScaffold`** — one field per lever you found in Phase 1. This interface is **primitive-specific**; do not try to share it. Fields may be booleans *or* enums (counting-board's `arrangement` is `'line' | 'scattered' | null`, where `null` = "let the LLM vary it" for the medium tier).

8. **Write `resolveSupportStructure(pinnedType, tier)`** — returns the scaffold + `promptLines`. Always include a leading prompt line stating the tier is scaffolding-only and never changes the numbers, then per-mode lines describing the withdrawal. Use ten-frame / counting-board as templates.

9. **Resolve the tier in the generator function** (place after mode resolution):

   ```typescript
   const supportTier = normalizeSupportTier(config?.difficulty); // the STUDENT's tier — DRIVES application (single OR blend)
   // pinnedType is ONLY for the prompt tone (a curated BLEND has no single mode to describe to the LLM).
   // (resolveEvalModes:)         resolution && resolution.modes.length === 1 ? resolution.allowedTypes[0] : undefined
   // (resolveEvalModeConstraint:) evalConstraint?.allowedTypes.length === 1 ? evalConstraint.allowedTypes[0] : undefined
   const pinnedType = /* per resolver, see above */ as ChallengeType | undefined;
   const tierScaffold = pinnedType && supportTier
     ? resolveSupportStructure(pinnedType, supportTier) : null; // tierSection tone only — NOT the application
   const tierSection = tierScaffold
     ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
     : '';
   ```

10. **Inject `${tierSection}`** into the prompt, immediately after the challenge-type section.

### Phase 3b (optional): the structural problem-difficulty axis → `/add-structural-difficulty`

If the primitive has a clean **in-mode structural lever** (gap / step / regroup-count / coupled-variable), add the second axis so easy/med/hard stop producing byte-identical problems — but do it via the dedicated **`/add-structural-difficulty`** skill, which builds `resolveProblemShape`, upgrades `tierSection` → `buildTierPromptSection` (merging both axes), code-enforces the exact numeric lever, and renames `NUMBERS_NEVER_CHANGE` → `TIER_GUARDRAIL`. It reuses the harness and the `if (supportTier)` block from this skill, so finish Phases 1–5 here first.

### Phase 4: Apply deterministically + clean up

11. **Apply the scaffold in code at the END of the generator** — after the empty-fallback and all structural fixups/force-enables, before `return`. **Gate only on `supportTier` being present, and resolve each challenge's scaffold from its OWN mode (`ch.type`), applying per challenge.** This is the global rule: difficulty is a *student* property, so a blended/auto session must get it too — single-mode just happens to give every challenge the same scaffold. (Do NOT gate on `pinnedType` — that silently drops difficulty for every blended session, the exact no-op this skill exists to kill.) Code owns the support *structure*; the LLM only chose the numbers. Guard each lever to its relevant modes, and protect UI contracts (e.g. ten-frame keeps subitize's count display off at every tier; counting-board only relaxes `subitize_perceptual` toward `scattered`, never `line`). End with a log line:

    ```typescript
    if (supportTier) {
      for (const ch of challenges) {
        const sc = resolveSupportStructure(ch.type, supportTier); // per-challenge, mode-correct
        // ...assign each lever from sc, guarded by ch.type; protect UI contracts...
      }
      console.log(`[Primitive] Support tier "${supportTier}" applied per-challenge (${pinnedType ? `single-mode ${pinnedType}` : 'blended'})`);
    }
    ```

11b. **If the primitive has a live tutor, keep it in sync** (mandatory for modality #2) — see **Gotcha #2** below. A tier that hides something on screen but lets the tutor reveal it is only half-applied.

12. **Delete any dead `difficulty?: number` config field.** The old numeric-difficulty path (`service/difficulty/difficultyContext.ts` / `computeDifficultyTuple`) is fully removed from the repo, so usually there's nothing to do — but a vestigial `difficulty?: number` field declared-but-never-read can shadow the new `config.difficulty?: string`; remove it. If a generator genuinely still scales magnitude from a theta/band, remove that too (grep to confirm; don't trust the obsolete "known wirers" list).

### Phase 5: Verify

13. **Type check** — from the memory [[tsc-verification-integrity]] rule, run the project-local compiler and compare to baseline, do **not** run bare `npx tsc` from repo root:
    ```bash
    cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit
    ```
    Confirm zero new errors vs. the baseline global count (~1444).

14. **Report**: levers discovered (and where in the component), the easy→hard table, files modified, any numeric-difficulty wiring removed.

15. **Remind the user to test**: in the Primitives Tester, pin the mode and toggle difficulty easy/med/hard → confirm scaffolds visibly withdraw and **the numbers stay in range**. Then run `/eval-test` (the Step 2b sweep covers easy/med/hard + a scope-conflict case).

## Gotchas (read before shipping)

**1. Answer-bearing levers — keep the checker, instruction, and recomputed value in sync.** Most levers are *display-only* (withdrawing a count readout changes nothing the checker reads). But a lever is **answer-bearing** if the component's check function reads the field your tier code writes (`checkFillMissing` reads `hiddenPositions`; a bar checker reads `answerBarIndex`). Get this wrong and the primitive **rejects the student's correct answer** — "50 doesn't fit" when 50 is exactly right. Three invariants:
- **Honor the LLM's valid choice; only top-up/trim for the tier *count*.** The lever controls *how many* gaps (1→2→3), not *which* — the LLM picked positions and wrote the question around them. Synthesize extras only to reach the count; never swap a valid choice for an arbitrary one.
- **Never narrow the candidate set so the instruction's answer becomes invalid.** The real SCR bug: the hideable pool excluded `endAt`, so the LLM's end-referencing gap was filtered out and a mid-sequence position substituted. Exclude only positions that genuinely break the checker (`startFrom` is always a landing spot → unsolvable if hidden; but `endAt` is a normal answer → keep it).
- **Verify `instruction → answer` still passes at every tier** (the `/eval-test` post-fix check).
- **Cleaner pattern — decouple the answer from the scaffold** (bar-model's `answerBarIndex`): give the answer its *own* field the checker reads, independent of the display lever, so withdrawing a scaffold at hard can't leak *or* invalidate it.

**2. The tutor is a second scaffold channel** (esp. modality #2). If the primitive has a live AI tutor, it sees the full challenge data and can **leak what a tier withheld**. Whenever you apply a tier — always for #2 — thread the tier in and calibrate reveal: easy → name the strategy, walk the setup; medium → nudge execution only; hard → do NOT name the strategy the instruction hid, ask what the student sees, never reveal the answer. Three changes: add `supportTier` to the data type (set whenever a tier is present, per challenge) + the component's `aiPrimitiveData`, and a mode-aware tier clause in the `sendText` prompts. **Watch recognition modes** — where the relationship IS the answer, the tutor never names it at any tier. `/add-tutoring-scaffold` owns the wiring; this skill owns the reveal level. (AngleWorkshop's `tutorRevealPolicy(tier, challengeType)` is the worked example.)

## Reference implementations

All worked examples are **math** — the only domain wired so far. Read them by **archetype, not subject**: the archetype map tells you which one is the structural template for *your* primitive (a chemistry simulation reads bar-model for its overlay/structural pattern; a phonics card is #5-led with no direct math twin and leans on the modality catalog). The *differences* between these examples are the lesson — each anchors a different modality:

| | Modality | Levers | Notable |
|---|---|---|---|
| **ten-frame** | #1 perception | `showCount`, `showEquation`, `flashDuration` (continuous) | `service/math/gemini-ten-frame.ts` — `resolveSupportStructure`, applied ~end of `generateTenFrame`. Subitize keeps count display off at every tier. |
| **counting-board** | #1 perception | `showRunningCount`, `showLastNumber`, `showGroupCircles`, `arrangement` (enum) | `service/math/gemini-counting-board.ts` — richer lever set; group rings withdrawn at hard; `arrangement` is the perception lever for count/subitize; `subitize_perceptual` only relaxed toward scattered. |
| **angle-workshop** | #1 + **#2 instruction-as-scaffold** | `showReadingCue`, `showPerceptionMarks`; `nameRelationship`, `hintLevel`, `showEquationSetup` | `service/math/gemini-angle-workshop.ts` — **zero `showOptions`; the strongest tiers are text-only.** `solve_algebraic` withdraws one sub-step per tier (solve → set-up → identify) via `easyAlgInstruction` / `genericInstruction` / `conceptHint`. The proof that a primitive needs no visual levers to earn a real ladder. |
| **bar-model** | #1 perception + **structural problem difficulty** | scaffolds `showBarValues`, `showTargetHighlight` (+ `answerBarIndex` answer-guard); structural `compareGap`, `forcedStep`, `iconValue` | `service/math/gemini-bar-model.ts` — **the worked reference for the second axis.** `resolveSupportStructure` (scaffolding) **and** `resolveProblemShape` (structural), merged by `buildTierPromptSection`; one in-mode structural lever per mode (gap / step / multiplier / operation depth), numeric levers code-enforced in each sub-generator's post-process. |
| **skip-counting-runner** | #1 perception + **answer-bearing structural lever** | scaffolds `showTrackLabels`, `showSequenceChips`, `showSkipValueBadge`, `showJumpArcs`; structural `hiddenCount` (1→2→3 gaps) | `service/math/gemini-skip-counting-runner.ts` — **the worked reference for the answer-bearing-lever rule.** `fill_missing`'s `hiddenCount` writes `hiddenPositions`, which `checkFillMissing` validates against. The hideable pool must exclude only `startFrom` (always a landing spot → unsolvable if hidden) and **keep `endAt`** (a valid, LLM-preferred "what's the last number?" answer) — excluding it desynced the gap from the instruction and rejected the correct answer. |

## Checklist

- [ ] `/add-eval-modes` run first; classified the **archetype** and read the math reference that shares it (not its subject)
- [ ] Swept the **full modality catalog** (not just `showOptions`); considered #2 instruction-as-scaffold explicitly; each lever withdraws *support* without changing the *answer* or *task identity*
- [ ] Designed + confirmed the easy→hard gradient per mode with the user
- [ ] Fixed harness verbatim (`SupportTier`/`SUPPORT_TIERS`/`normalizeSupportTier`, `difficulty?: string`); bespoke `SupportScaffold` + `resolveSupportStructure`
- [ ] Applied the scaffold at the END, **per challenge** (`resolveSupportStructure(ch.type, tier)`), gated only on a tier being present (NOT `pinnedType`); `${tierSection}` injected; UI contracts guarded per mode; log line present
- [ ] **Answer-bearing levers** (Gotcha #1): honored LLM choices, top-up only to the tier *count*, no instruction-referenceable answer (e.g. `endAt`) excluded, `instruction → answer` passes at every tier
- [ ] **Live tutor** (Gotcha #2): `supportTier` threaded into data + `aiPrimitiveData` + a tier reveal-clause in `sendText` (mandatory for #2)
- [ ] **(Optional 2nd axis)** if the primitive has a clean in-mode structural lever, follow up with **`/add-structural-difficulty`** (builds `resolveProblemShape`, merges `buildTierPromptSection`, code-enforces the lever, renames `NUMBERS_NEVER_CHANGE` → `TIER_GUARDRAIL`)
- [ ] Deleted any dead `difficulty?: number` field; tier never inflates magnitude beyond scope
- [ ] Project-local `tsc --noEmit` clean vs. baseline (not bare `npx tsc`); reminded user to test easy/med/hard + `/eval-test`
---
name: add-support-tiers
description: >-
  Add visible scaffolding and support tiers to an existing Lumina primitive. Use when config.difficulty should control self-check aids, hints, workspace support, and justification requirements for the same skill.
---
