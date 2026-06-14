# Add Support Tiers to a Primitive

This skill makes a primitive **consume `config.difficulty`** — the within-mode support tier. It is the *second axis* of the two-field contract that `/add-eval-modes` establishes:

- **`config.targetEvalMode` = WHICH skill** (task identity, resolved from the objective by the manifest). Owned by `/add-eval-modes`.
- **`config.difficulty` = HOW MUCH on-screen SUPPORT** the student gets *within that one skill* (`'easy'` = max scaffolding, `'hard'` = min). Owned by **this skill**.

**The invariant that defines the whole skill:** a support tier withdraws *scaffolding*, never changes the *numbers*. A harder tier means less help tracking/perceiving the quantity — never a bigger quantity. The pedagogical scope and the per-mode count/range tables own the numbers; the tier never touches them. See memory [[structural-difficulty-not-numeric]] and [[feedback_llm-window-code-builds-structure]].

## Why this skill exists

The manifest already emits `config.difficulty` ('easy'|'medium'|'hard') for **every** component (`gemini-manifest.ts`), and `/add-eval-modes` registration already spreads `...item.config` to every generator — so the value *reaches* all ~100 generators. But almost all of them **drop it on the floor**: a struggling vs. a strong student gets byte-identical content. This skill closes that no-op, one primitive at a time.

It is deliberately **per-primitive creative work**, not an auto-rollout: "scaffolding" means something different for every primitive (a ten-frame's support ≠ a number line's ≠ a counting board's). The skill gives you a fixed harness and a disciplined way to discover *that primitive's* support levers.

## The 80/20 split (read this first)

Two worked references — **ten-frame** (3 levers, all boolean/numeric) and **counting-board** (4 levers, one of them an enum) — prove what's reusable vs. what's bespoke.

**Fixed scaffold — copy verbatim, zero changes:**
- `SupportTier` type + `SUPPORT_TIERS` + `normalizeSupportTier()`
- The single-mode gate (apply only when exactly one mode is pinned)
- `config.difficulty?: string` added to the config type
- `tierSection` prompt injection (after the challenge-type section)
- Deterministic application **at the end** of the generator, after structural fixups, with a `[Primitive] Support tier …` log line

**Bespoke — the creative 20%:**
- The `SupportScaffold` interface fields = **that primitive's actual support levers**
- `resolveSupportStructure()` — the easy→hard mapping, per pinned mode
- Which levers are mode-scoped, and the guards that protect UI contracts

> **The single most important step is lever discovery, and it is done by reading the COMPONENT, not the generator.** A primitive's support levers live in its `showOptions` (and per-challenge structural fields like `arrangement`), which only the `.tsx` component reveals. The generator tells you the *modes*; the component tells you the *levers*.

## Prerequisites

The primitive must already have eval modes wired (run `/add-eval-modes` first). Specifically:
- A generator that resolves a mode via `resolveEvalModes` **or** the legacy `resolveEvalModeConstraint` — **either works; this skill is resolver-agnostic.** The gate keys off "exactly one mode pinned," not which resolver produced it.
- Catalog `evalModes` for the primitive.
- A component (`.tsx`) with `showOptions` and/or per-challenge structural fields that act as scaffolds.

If the primitive has **no real scaffold levers** (a pure free-text or single-shape display), it cannot have meaningful support tiers — stop and tell the user; don't invent fake levers.

## When to use / not use

**Use when:** giving a primitive's `config.difficulty` real effect so personalization (struggling→easy, strong→hard) and the manifest's Introduce→Apply support withdrawal actually change the content.

**Do NOT use for:**
- Adding eval modes (that's `/add-eval-modes` — run it first).
- Anything that changes target numbers by tier. That is the **retired** numeric-difficulty path (`service/difficulty/difficultyContext.ts`, `computeDifficultyTuple`). If the primitive still wires that, **remove it** as part of this skill (see Phase 4) — two difficulty systems must not fight on the same axis.

## Step-by-Step Workflow

### Phase 1: Discover the support levers (the creative core)

1. **Ask which primitive.** Get the `id` and domain.

2. **Read the COMPONENT first** — `primitives/visual-primitives/[domain]/[Primitive].tsx`:
   - List every field in `showOptions` (e.g. `showCount`, `showEquation`, `showRunningCount`, `showGroupCircles`, `showLastNumber`, `flashDuration`). Each is a candidate support lever.
   - List per-challenge structural fields that affect *how hard the task is to do without changing the number*: `arrangement` (line vs scattered), flash window, number-of-distractors, unknown position, whether a worked step is shown.
   - For each candidate, decide: does turning it OFF make the student work more unaided **without changing the answer**? If yes → it's a support lever. If turning it off changes the answer or breaks the UI → it's not.

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
   // Single resolved mode only — a curated BLEND has no single tier surface.
   // (resolveEvalModes:)  resolution && resolution.modes.length === 1 ? resolution.allowedTypes[0] : undefined
   // (resolveEvalModeConstraint:)  evalConstraint?.allowedTypes.length === 1 ? evalConstraint.allowedTypes[0] : undefined
   const pinnedType = /* per resolver, see above */ as ChallengeType | undefined;
   const supportTier = normalizeSupportTier(config?.difficulty);
   const tierScaffold = pinnedType && supportTier
     ? resolveSupportStructure(pinnedType, supportTier) : null;
   const tierSection = tierScaffold
     ? `\n## WITHIN-MODE SUPPORT TIER (scaffolding level — NOT number size)\n${tierScaffold.promptLines.map((l) => `- ${l}`).join('\n')}\n`
     : '';
   ```

10. **Inject `${tierSection}`** into the prompt, immediately after the challenge-type section.

### Phase 4: Apply deterministically + clean up

11. **Apply the scaffold in code at the END of the generator** — after the empty-fallback and all structural fixups/force-enables, before `return`. Code owns the support *structure*; the LLM only chose the numbers. Guard each lever to its relevant modes, and protect UI contracts (e.g. ten-frame keeps subitize's count display off at every tier; counting-board only relaxes `subitize_perceptual` toward `scattered`, never `line`). End with a log line:

    ```typescript
    if (tierScaffold && pinnedType) {
      if (!data.showOptions) data.showOptions = { /* safe defaults */ };
      // ...assign each lever from tierScaffold, guarded by pinnedType...
      console.log(`[Primitive] Support tier "${supportTier}" on mode "${pinnedType}" → <levers>`);
    }
    ```

12. **Remove any retired numeric-difficulty wiring** from this primitive — imports/calls into `service/difficulty/difficultyContext.ts` (`computeDifficultyTuple`, `studentTheta` → numeric band). It changes the numbers, which violates the invariant and fights this skill. (Known wirers to check: number-sequencer, number-line, base-ten-blocks, sorting-station.)

### Phase 5: Verify

13. **Type check** — from the memory [[tsc-verification-integrity]] rule, run the project-local compiler and compare to baseline, do **not** run bare `npx tsc` from repo root:
    ```bash
    cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit
    ```
    Confirm zero new errors vs. the baseline global count (~1444).

14. **Report**: levers discovered (and where in the component), the easy→hard table, files modified, any numeric-difficulty wiring removed.

15. **Remind the user to test**: in the Primitives Tester, pin the mode and toggle difficulty easy/med/hard → confirm scaffolds visibly withdraw and **the numbers stay in range**. Then run `/eval-test` (the Step 2b sweep covers easy/med/hard + a scope-conflict case).

## Reference implementations

Two worked examples — read both; the *difference* between them is the lesson:

| | Levers | Notable |
|---|---|---|
| **ten-frame** | `showCount`, `showEquation`, `flashDuration` (continuous) | `service/math/gemini-ten-frame.ts` — `resolveSupportStructure`, applied ~end of `generateTenFrame`. Subitize keeps count display off at every tier. |
| **counting-board** | `showRunningCount`, `showLastNumber`, `showGroupCircles`, `arrangement` (enum) | `service/math/gemini-counting-board.ts` — richer lever set; group rings withdrawn at hard; `arrangement` is the perception lever for count/subitize; `subitize_perceptual` only relaxed toward scattered. |

## Checklist

- [ ] Ran `/add-eval-modes` first (primitive has eval modes + catalog `evalModes`)
- [ ] **Read the COMPONENT** and enumerated its support levers from `showOptions` + per-challenge structural fields
- [ ] Confirmed each lever withdraws *support* without changing the *answer*
- [ ] Designed + confirmed the easy→hard gradient per mode with the user
- [ ] Added the fixed scaffold verbatim (`SupportTier`, `SUPPORT_TIERS`, `normalizeSupportTier`, `difficulty?: string`)
- [ ] Wrote bespoke `SupportScaffold` (booleans and/or enums) + `resolveSupportStructure` with a numbers-never-change leading prompt line
- [ ] Gated on exactly ONE pinned mode (resolver-agnostic: `resolution.modes.length === 1` OR `allowedTypes.length === 1`)
- [ ] Injected `${tierSection}` after the challenge-type section
- [ ] Applied the scaffold deterministically at the END, after structural fixups/force-enables, guarded per mode, with a log line
- [ ] Protected UI contracts with per-mode guards (no scaffold turned off that breaks the interaction)
- [ ] **Removed any retired numeric-difficulty wiring** (`difficultyContext.ts`) from this primitive
- [ ] Verified the tier NEVER changes target numbers (scope + per-mode tables still own them)
- [ ] Project-local `tsc --noEmit` clean vs. baseline (not bare `npx tsc`)
- [ ] Reminded user to test easy/med/hard in the Tester + `/eval-test` Step 2b sweep
