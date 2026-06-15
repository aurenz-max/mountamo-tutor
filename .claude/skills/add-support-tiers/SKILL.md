# Add Support Tiers to a Primitive

This skill makes a primitive **consume `config.difficulty`** — the within-mode support tier. It is the *second axis* of the two-field contract that `/add-eval-modes` establishes:

- **`config.targetEvalMode` = WHICH skill** (task identity, resolved from the objective by the manifest). Owned by `/add-eval-modes`.
- **`config.difficulty` = HOW MUCH on-screen SUPPORT** the student gets *within that one skill* (`'easy'` = max scaffolding, `'hard'` = min). Owned by **this skill**.

**The invariant that defines the whole skill:** a support tier never inflates *magnitude*. A harder tier must NOT just make the quantity bigger — that is the retired numeric-difficulty path that was reversed (`5×+5 ≈ 7×-3`). The pedagogical scope and the per-mode count/range tables own the magnitude; the tier never pushes past them. See memory [[structural-difficulty-not-numeric]] and [[feedback_llm-window-code-builds-structure]].

Within that guardrail, `config.difficulty` drives **two** axes (both optional, build whichever the primitive supports):
1. **Scaffolding withdrawal** *(the original focus — Phase 1-4 below)* — same problem, less on-screen/instructional help.
2. **Structural problem difficulty** *(the second axis — see "Structural problem difficulty" below)* — a genuinely harder *problem*, made harder **structurally** (gaps, steps, multipliers, steps-to-solve), never by magnitude and never by crossing into another eval mode.

The first asks "how much help?"; the second asks "how hard a problem, structurally?". A strong tier usually does both: harder problem **and** less help.

## Why this skill exists

The manifest already emits `config.difficulty` ('easy'|'medium'|'hard') for **every** component (`gemini-manifest.ts`), and `/add-eval-modes` registration already spreads `...item.config` to every generator — so the value *reaches* all ~100 generators. But almost all of them **drop it on the floor**: a struggling vs. a strong student gets byte-identical content. This skill closes that no-op, one primitive at a time.

It is deliberately **per-primitive creative work**, not an auto-rollout: "scaffolding" means something different for every primitive (a ten-frame's support ≠ a number line's ≠ a counting board's). The skill gives you a fixed harness and a disciplined way to discover *that primitive's* support levers.

## The 80/20 split (read this first)

Two worked references — **ten-frame** (3 levers, all boolean/numeric) and **counting-board** (4 levers, one of them an enum) — prove what's reusable vs. what's bespoke.

**Fixed scaffold — copy verbatim, zero changes:**
- `SupportTier` type + `SUPPORT_TIERS` + `normalizeSupportTier()`
- The tier gate: apply the scaffold whenever a tier is present, resolved **per challenge from each challenge's own mode** (so blended/auto sessions get difficulty too). Only the `tierSection` *prompt* injection is single-mode — it describes one mode to the LLM for title/description tone
- `config.difficulty?: string` added to the config type
- `tierSection` prompt injection (after the challenge-type section)
- Deterministic application **at the end** of the generator, after structural fixups, with a `[Primitive] Support tier …` log line

**Bespoke — the creative 20%:**
- The `SupportScaffold` interface fields = **that primitive's actual support levers**
- `resolveSupportStructure()` — the easy→hard mapping, per pinned mode
- Which levers are mode-scoped, and the guards that protect UI contracts

> **The single most important step is lever discovery, and it is done by reading the COMPONENT, not the generator.** A primitive's support levers live in its `showOptions` (and per-challenge structural fields like `arrangement`), which only the `.tsx` component reveals — **but the component is not the only place a lever lives** (see the modality catalog below). The generator tells you the *modes*; the component tells you most of the *levers*.

## Support modalities — the lever families to look for

Scaffolding is not one thing. When you discover levers (Phase 1), sweep the **whole menu** below, not just `showOptions`. Most primitives expose 2-3 of these; the richest tiers combine families. Every family obeys the one invariant — **it withdraws help, never changes the numbers or the task identity** (the eval mode owns identity).

1. **Perception / tracking aids** *(visual, lives in `showOptions` + per-challenge structural fields)* — on-screen marks that offload the work of *seeing* the quantity: a count readout, a running tally, line-vs-scattered `arrangement`, tick labels, a protractor reading-cue dot, right-angle / equal-angle marks. Withdraw → the student perceives unaided. **This was the original focus of the skill** (ten-frame, counting-board).

2. **Instruction-as-scaffold — task-step withdrawal** *(text, lives in the generator; usually NO component change)* — **the highest-leverage, most generalizable family, and the cheapest to add.** Decompose the skill into its cognitive sub-steps and hand the student fewer of them per tier. The instruction text *is* the dial. Sub-levers:
   - **Strategy naming** — does the instruction name which rule/relationship/operation applies, or must the student identify it from the figure?
   - **Structure pre-assembly** — is the equation / number-sentence / setup handed over, or must the student build it? (easy `solve_algebraic` hands `(2x+10) + (x+5) = 90`; hard hands nothing.)
   - **Hint explicitness ladder** — explicit formula → conceptual nudge → "read the figure first."

   Applies to **any** primitive whose task has ≥2 cognitive steps (identify → set up → execute). It changes only words the student reads, so the figure and every number are byte-identical across tiers. Worked reference: AngleWorkshop `solve_algebraic` (`easyAlgInstruction` / `genericInstruction` / `conceptHint` in `gemini-angle-workshop.ts`).

3. **Representational support — concrete → abstract (CPA)** — easy pairs a concrete/visual model with the symbol; hard is symbol-only. Withdraw the model, keep the number. The dominant lever for math primitives that have both a manipulative and a notation (array beside the product, then drop the array).

4. **Worked-example fading** — easy shows a fully worked *parallel* example first, medium a partial one, hard none. Strong effect, but heavier to build (needs an example surface).

5. **Answer-form — recognition vs. recall** — easy = choose among options (or fewer distractors); hard = free production. **CAUTION:** this is a support axis *only* if the underlying task is unchanged. If changing the form changes what's being assessed, you've crossed into a different eval mode — that's `/add-eval-modes`, not a tier.

When you reach Phase 1, ask of each family: *does this primitive expose this lever, and does withdrawing it leave the answer and the task identity intact?*

### Priority order — what to reach for first

**The primitives ARE the product, so the bespoke interaction-surface scaffolds come first.** Build in this order:

- **P1 — primitive-specific scaffolding: #1 perception/tracking aids + #3 representational support (CPA).** The bespoke levers on the interaction surface itself — the count readout, the running tally, the manipulative beside the notation. This is the pedagogical core of the skill and the first thing to design. It's also the genuinely creative 20%.
- **P2 — instruction-as-scaffold: #2.** Near-universal, text-cheap, and the fallback that earns a real ladder for primitives with *no* visual levers at all. Always at least consider it; for most primitives it **complements** P1 rather than replacing it (AngleWorkshop combines both).
- **P3 — situational: #4 worked-example fading, #5 answer-form.** Real but case-by-case; not a systematic rollout.

## Structural problem difficulty — the second axis (generator-side)

The five modalities above all answer *"how much help?"* — same problem, scaffolding withdrawn. But a primitive can feel weak if easy/med/hard produce **byte-identical problems** with only the help toggled (a real user complaint). The second axis answers *"how hard a problem, structurally?"* — and it lives entirely **on the generator side** (no component change).

**The hard line that keeps this from becoming the retired numeric path:** difficulty here is **structural, never magnitude**. You may change the *shape* of the problem; you may not just scale the numbers up. And you may **never** push the problem into a different eval mode — the eval mode is the task identity ([[structural-difficulty-not-numeric]]). Each mode gets **one in-mode structural lever**. Worked reference (the proof this composes with the scaffolding axis): **bar-model** (`service/math/gemini-bar-model.ts`):

| mode | structural lever (easy → hard) | where enforced |
|---|---|---|
| compare_bars | height gap `\|a-b\|`: 4 (obvious) → 2 → 1 (subtle) | code post-process |
| read_scale | axis step 1 → 2 (skip-count the axis, still **on-tick** — not interpolation) | code post-process |
| scaled_bar_graph | axis step 2 → 5 → 10 (coarser ticks = harder interpolation) | code post-process |
| picture_graph | icon multiplier 2 → 5 (skip-count by 5s) | code post-process |
| graph_word_problem | operation depth: one difference → total → two-step | prompt-shaped, LLM-validated |
| build_graph | scale-choice ambiguity: obvious → genuinely ambiguous | prompt-shaped |

**The generator-side pattern (mirror of `resolveSupportStructure`):**

1. **`resolveProblemShape(mode, tier)`** — sibling to `resolveSupportStructure`. Returns `{ promptLines, ...numericParams }` where the numeric params (e.g. `compareGap`, `forcedStep`, `iconValue`) are the structural levers enforced deterministically in post-process, and `promptLines` describe the structural intent to the LLM for the levers that can't be code-forced (operation depth, dataset ambiguity).
2. **`buildTierPromptSection(mode, tier)`** — concatenates `resolveSupportStructure(mode, tier).promptLines` (scaffolding tone) **and** `resolveProblemShape(mode, tier).promptLines` (problem shape) into one `## SUPPORT TIER "<tier>"` block, so the LLM sees both axes together. This **replaces** the scaffolding-only `tierSection`.
3. **Thread the `tier` enum (not a pre-built string) into each sub-generator** so it can both inject `buildTierPromptSection(...)` into its prompt **and** apply its `resolveProblemShape(...)` numeric params in post-process (e.g. enforce the exact `compareGap`, snap to `forcedStep`, force `iconValue`). Numeric levers are enforced in **code** (don't trust the LLM to hit an exact gap); prompt-only levers are validated as usual.
4. **Reframe the guardrail constant.** The scaffolding-only skill ships a `NUMBERS_NEVER_CHANGE` prompt line; once this axis exists it's a lie. Rename it to `TIER_GUARDRAIL` and reword: *"Keep every number within scope — this tier changes problem STRUCTURE (gaps, steps, multipliers, steps-to-solve), NOT raw magnitude."*

**Per-lever discipline (the review checklist for each one):**
- **In-mode?** Does the harder problem still belong to the *same* eval mode? (read_scale going off-tick would become scaled_bar_graph — that's a mode jump, forbidden. Keep read_scale on-tick; let *step coarseness* be its lever.)
- **Structural, not magnitude?** Is it a gap/step/multiplier/step-count change, or just "bigger numbers"? The latter is the reversed path.
- **Code-enforce exact numeric levers.** An LLM asked for "gap of exactly 1" will drift; clamp it in post-process. Reserve prompt-only shaping for levers with no clean numeric handle (operation depth, ambiguity).
- **Default (no tier) path unchanged.** Guard every structural branch on the tier being present (`shape?.compareGap != null`), so a no-tier generation is byte-identical to before.

A primitive may legitimately support **only** the scaffolding axis (no clean structural lever — fine, skip this), **only** structural (a single-step task with no scaffolds to withdraw but a real difficulty knob), or **both** (bar-model). Build what fits; don't invent a fake structural lever just to fill the table.

### Answer-bearing levers — keep the checker, instruction, and recomputed value in sync

Most levers above are *display-only*: withdrawing a count readout or an arc changes nothing the answer-checker reads. But some structural levers **recompute the very field the component validates against** — and those need extra discipline, because the LLM authored the instruction/hint *around its own choice of that field*. Get this wrong and the primitive **rejects the student's correct answer** (the worst possible failure: the screen says "50 doesn't fit" when 50 is exactly right).

**A lever is answer-bearing if the component's check function reads the field it sets.** Trace it: find the check (`checkFillMissing` reads `hiddenPositions`; a bar checker reads `answerBarIndex`; an unknown-position lever feeds the validated cell). If your tier code writes that field, you own three invariants:

1. **Honor the LLM's valid choice; only top-up/trim for the tier *count*.** The tier lever controls *how many* gaps (1→2→3), not *which* — the LLM already picked positions and wrote "what's the final number?" around them. Keep every LLM choice that's structurally valid; synthesize extras only to reach the tier count. Never discard a valid LLM choice and substitute an arbitrary one — that's what desyncs the gap from the instruction.
2. **Never narrow the candidate set so the instruction's answer becomes invalid.** The real `skip-counting-runner` SCR bug: the hideable pool excluded `endAt`, so the LLM's end-referencing gap (`hiddenPositions=[50]`, matching "where do we land at the end?") was filtered out and the code substituted a mid-sequence position. Audit your candidate filter against *every* position the instruction can legitimately reference. Exclude only positions that genuinely break the checker (e.g. `startFrom` is always a landing spot, so hiding it makes `!landingSpots.includes(answer)` unsatisfiable — exclude it; but `endAt` is a normal, common answer — keep it).
3. **Verify the recomputed value still passes the checker for the intended answer.** After your tier code writes the field, the student's correct answer (the one the instruction asks for) must satisfy the component's check. This is the `/eval-test` post-fix check: generate at each tier and confirm `instruction → answer` is actually accepted.

**The cleaner structural pattern — decouple the answer from the scaffold** (bar-model's `answerBarIndex`): when a scaffold withdrawal would otherwise move or expose the answer, give the answer its **own** field that the checker reads, independent of the display lever. Then withdrawing the scaffold at hard can't leak *or* invalidate the answer. Reach for this whenever a single field is doing double duty as both "what to show" and "what's correct."

### The tutor is a second scaffold channel — keep it in sync (esp. P2)

If the primitive has a live AI tutor (`useLuminaAI` / it ran `/add-tutoring-scaffold`), the tutor sees the full challenge data and can **leak what a tier withheld** — at a hard tier it might name the very relationship the instruction (#2) deliberately hid, undoing the scaffold. Whenever you apply a tier — and **always** for modality #2 — thread the tier into the tutor's context and calibrate its reveal policy:
- **easy** → tutor may be explicit: name the strategy, walk the setup step by step.
- **medium** → strategy is on-screen; tutor nudges the execution, doesn't solve it.
- **hard** → the instruction withholds the strategy; tutor must NOT name it — ask what the student sees in the figure, never reveal the answer.

`/add-tutoring-scaffold` owns the tutor *wiring*; this skill owns keeping the tutor's **reveal level** consistent with the on-screen scaffold (add `supportTier` to the generated data + `aiPrimitiveData`, and a tier clause in the `sendText` prompts). See Phase 4, step 11b.

## Prerequisites

The primitive must already have eval modes wired (run `/add-eval-modes` first). Specifically:
- A generator that resolves a mode via `resolveEvalModes` **or** the legacy `resolveEvalModeConstraint` — **either works; this skill is resolver-agnostic.** The gate keys off "exactly one mode pinned," not which resolver produced it.
- Catalog `evalModes` for the primitive.
- A component (`.tsx`) with `showOptions` and/or per-challenge structural fields **OR** a multi-step task whose instruction can withdraw sub-steps (modality #2). The visual levers are not required — a text-only ladder is legitimate and often strong.

If the primitive has **no real scaffold levers across the whole modality catalog** — a genuinely single-step task with no perception aids, no setup to hand over, no representation to swap (e.g. a bare flashcard) — it cannot have meaningful support tiers; stop and tell the user, don't invent fake levers. But check modality #2 before concluding this: most "single-shape display" primitives still have an identify/setup step the instruction can scaffold.

## When to use / not use

**Use when:** giving a primitive's `config.difficulty` real effect so personalization (struggling→easy, strong→hard) and the manifest's Introduce→Apply support withdrawal actually change the content.

**Do NOT use for:**
- Adding eval modes (that's `/add-eval-modes` — run it first).
- **Magnitude scaling by tier** — making the target numbers bigger/smaller within scope. That is the **retired** numeric-difficulty path (the old `service/difficulty/difficultyContext.ts` / `computeDifficultyTuple`, now removed from the repo). If a primitive still scales magnitude from a theta/band, **remove it** as part of this skill (see Phase 4) — two difficulty systems must not fight on the same axis. In practice the file is gone; what remains is usually just a dead `difficulty?: number` field to delete. *(Note: changing problem **structure** by tier — gaps, steps, multipliers, steps-to-solve — is the legitimate second axis, see "Structural problem difficulty." The ban is on raw magnitude, not on structure.)*

## Step-by-Step Workflow

### Phase 1: Discover the support levers (the creative core)

1. **Ask which primitive.** Get the `id` and domain.

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

### Phase 3b (optional): Add the structural problem-difficulty axis

If the primitive has a clean **in-mode structural lever** (see "Structural problem difficulty" above), add it now — it's what stops easy/med/hard from producing byte-identical problems:

10a. **Write `resolveProblemShape(mode, tier)`** alongside `resolveSupportStructure` — returns `{ promptLines, ...numericParams }` (the structural levers: `compareGap` / `forcedStep` / `iconValue` / etc.). One lever per mode; in-mode and structural only.

10b. **Upgrade `tierSection` → `buildTierPromptSection(mode, tier)`** that concatenates the scaffolding `promptLines` **and** the problem-shape `promptLines` into one block, and **thread the `tier` enum (not the pre-built string) into the sub-generators** so each can both inject the section *and* apply its `resolveProblemShape` numeric params in post-process. **Code-enforce exact numeric levers** (clamp the gap, snap to step, force the multiplier); gate every branch on the tier being present so the no-tier path stays byte-identical.

10c. **Rename the guardrail prompt constant** `NUMBERS_NEVER_CHANGE` → `TIER_GUARDRAIL` and reword it to "numbers stay in scope; structure changes, magnitude does not" (the old wording becomes false once this axis exists).

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

11b. **Keep the live tutor in sync (if the primitive has one — esp. for modality #2).** A tier that withholds information on screen but lets the tutor reveal it is only half-applied. Do three small things:
    - Persist the tier onto the generated data: add `supportTier?: 'easy' | 'medium' | 'hard'` to the data type and set it **whenever a tier is present** (it now applies per challenge, blends included) — so the tutor matches what's on screen for every challenge, not just single-mode ones.
    - Add `supportTier` to the component's `aiPrimitiveData` so `useLuminaAI` sees it.
    - Add a **mode-aware** tier clause to the `sendText` prompts (at minimum `[ACTIVITY_START]` and the wrong-answer nudge), keyed off the *current challenge's* type so it's correct in a blend: easy → tutor may name the strategy and walk the setup; medium → nudge execution only; hard → do NOT name the strategy the instruction hid, ask what the student sees, never reveal the answer. **Watch the recognition modes** — where the strategy/relationship IS the answer (a classify/identify mode), the tutor must never name it at *any* tier; there the tier only dials coaching depth. (AngleWorkshop's `tutorRevealPolicy(tier, challengeType)` is the worked example.)

12. **Remove any retired numeric-difficulty wiring** from this primitive. The old `service/difficulty/difficultyContext.ts` / `computeDifficultyTuple` (`studentTheta` → numeric band) path has since been **fully removed from the repo** — as of 2026-06-14 that file does not exist and nothing imports it (the only `difficultyContext` hit is an unrelated `buildDifficultyContext` local in `manifest/practice-manifest.ts`). So in practice there is usually nothing to delete here. What you DO still find is a **dead vestigial `difficulty?: number` config field** declared but never read (e.g. sorting-station had one) — delete it so it can't shadow/confuse the new `config.difficulty?: string` support-tier value. If a generator genuinely still scales magnitude from a theta/band, remove that too (it changes the numbers, violating the invariant) — but verify by grep first rather than assuming any primitive on an old "known wirers" list still does; that list is obsolete.

### Phase 5: Verify

13. **Type check** — from the memory [[tsc-verification-integrity]] rule, run the project-local compiler and compare to baseline, do **not** run bare `npx tsc` from repo root:
    ```bash
    cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit
    ```
    Confirm zero new errors vs. the baseline global count (~1444).

14. **Report**: levers discovered (and where in the component), the easy→hard table, files modified, any numeric-difficulty wiring removed.

15. **Remind the user to test**: in the Primitives Tester, pin the mode and toggle difficulty easy/med/hard → confirm scaffolds visibly withdraw and **the numbers stay in range**. Then run `/eval-test` (the Step 2b sweep covers easy/med/hard + a scope-conflict case).

## Reference implementations

Three worked examples — read all three; the *differences* between them are the lesson (each anchors a different modality):

| | Modality | Levers | Notable |
|---|---|---|---|
| **ten-frame** | #1 perception | `showCount`, `showEquation`, `flashDuration` (continuous) | `service/math/gemini-ten-frame.ts` — `resolveSupportStructure`, applied ~end of `generateTenFrame`. Subitize keeps count display off at every tier. |
| **counting-board** | #1 perception | `showRunningCount`, `showLastNumber`, `showGroupCircles`, `arrangement` (enum) | `service/math/gemini-counting-board.ts` — richer lever set; group rings withdrawn at hard; `arrangement` is the perception lever for count/subitize; `subitize_perceptual` only relaxed toward scattered. |
| **angle-workshop** | #1 + **#2 instruction-as-scaffold** | `showReadingCue`, `showPerceptionMarks`; `nameRelationship`, `hintLevel`, `showEquationSetup` | `service/math/gemini-angle-workshop.ts` — **zero `showOptions`; the strongest tiers are text-only.** `solve_algebraic` withdraws one sub-step per tier (solve → set-up → identify) via `easyAlgInstruction` / `genericInstruction` / `conceptHint`. The proof that a primitive needs no visual levers to earn a real ladder. |
| **bar-model** | #1 perception + **structural problem difficulty** | scaffolds `showBarValues`, `showTargetHighlight` (+ `answerBarIndex` answer-guard); structural `compareGap`, `forcedStep`, `iconValue` | `service/math/gemini-bar-model.ts` — **the worked reference for the second axis.** `resolveSupportStructure` (scaffolding) **and** `resolveProblemShape` (structural), merged by `buildTierPromptSection`; one in-mode structural lever per mode (gap / step / multiplier / operation depth), numeric levers code-enforced in each sub-generator's post-process. |
| **skip-counting-runner** | #1 perception + **answer-bearing structural lever** | scaffolds `showTrackLabels`, `showSequenceChips`, `showSkipValueBadge`, `showJumpArcs`; structural `hiddenCount` (1→2→3 gaps) | `service/math/gemini-skip-counting-runner.ts` — **the worked reference for the answer-bearing-lever rule.** `fill_missing`'s `hiddenCount` writes `hiddenPositions`, which `checkFillMissing` validates against. The hideable pool must exclude only `startFrom` (always a landing spot → unsolvable if hidden) and **keep `endAt`** (a valid, LLM-preferred "what's the last number?" answer) — excluding it desynced the gap from the instruction and rejected the correct answer. |

## Checklist

- [ ] Ran `/add-eval-modes` first (primitive has eval modes + catalog `evalModes`)
- [ ] **Swept the full modality catalog** (perception aids #1, instruction-as-scaffold #2, CPA #3, worked-example #4, answer-form #5) — not just `showOptions`
- [ ] Considered modality #2 (instruction-as-scaffold) explicitly — it's almost always available, even with zero `showOptions`
- [ ] Confirmed each lever withdraws *support* without changing the *answer* or the *task identity*
- [ ] **For any answer-bearing lever** (tier code writes a field the component's check function reads — e.g. `hiddenPositions`, `answerBarIndex`, unknown position): honored the LLM's valid choices and only synthesized extras to reach the tier *count*; audited the candidate filter so no instruction-referenceable answer (e.g. `endAt`) is excluded; verified `instruction → answer` still passes the checker at every tier (the SCR "50 doesn't fit" failure mode)
- [ ] Designed + confirmed the easy→hard gradient per mode with the user
- [ ] Added the fixed scaffold verbatim (`SupportTier`, `SUPPORT_TIERS`, `normalizeSupportTier`, `difficulty?: string`)
- [ ] Wrote bespoke `SupportScaffold` (booleans and/or enums) + `resolveSupportStructure` with a numbers-never-change leading prompt line
- [ ] Applied the scaffold **per challenge** (`resolveSupportStructure(ch.type, tier)`), gated only on a tier being present — so blended/auto sessions get difficulty too (NOT gated on `pinnedType`); `pinnedType` (resolver-agnostic: `modes.length === 1` OR `allowedTypes.length === 1`) gates only the prompt `tierSection`
- [ ] Injected `${tierSection}` after the challenge-type section
- [ ] Applied the scaffold deterministically at the END, after structural fixups/force-enables, guarded per mode, with a log line
- [ ] If the primitive has a live tutor: threaded `supportTier` into the data + `aiPrimitiveData` and added a tier reveal-clause to the `sendText` prompts so the tutor doesn't leak what the tier withheld (mandatory for modality #2)
- [ ] Protected UI contracts with per-mode guards (no scaffold turned off that breaks the interaction)
- [ ] **(Optional second axis)** If the primitive has a clean in-mode structural lever: added `resolveProblemShape` + `buildTierPromptSection`, threaded the `tier` enum into the sub-generators, code-enforced exact numeric levers, renamed `NUMBERS_NEVER_CHANGE` → `TIER_GUARDRAIL`. Confirmed each lever stays **in-mode** and is **structural, not magnitude**.
- [ ] **Checked for retired numeric-difficulty wiring** — `difficultyContext.ts` is removed from the repo (usually nothing to do); deleted any dead vestigial `difficulty?: number` config field so it can't shadow the new `config.difficulty?: string`
- [ ] Verified the tier never inflates magnitude beyond scope (structural changes OK; scope + per-mode tables still own magnitude)
- [ ] Project-local `tsc --noEmit` clean vs. baseline (not bare `npx tsc`)
- [ ] Reminded user to test easy/med/hard in the Tester + `/eval-test` Step 2b sweep
