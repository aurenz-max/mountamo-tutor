# PRD: Generation-Context Harmonization — One Contract, Manifest → Generator → Service

**Status:** Proposed
**Last Updated:** 2026-06-27
**Author:** Engineering (triggered by the intent-threading audit, 2026-06-27)
**Related skills:** `/add-eval-modes`, `/add-support-tiers`, `/add-structural-difficulty`, `/topic-fidelity`, `/primitive`
**Supersedes the partial seam:** `service/scopeContext.ts` (the [[scope-context-contract]] — generalized here)

---

## 1. Overview

The manifest → generator → service pathway has **no enforced contract**. `ManifestItem.config`
is typed `{ [key: string]: unknown }` (an untyped bag), so each of the ~100 generators invented
its own way to read what the manifest sends, and the registry boundary grew ~5 different
config-shaping idioms. The result is **100+ independently-developed copies of the same plumbing** —
intent threading, scope resolution, eval-mode constraint, support tiers, structural difficulty —
each subtly different. A change to *how* the pathway works (e.g. "intent should reach generators")
becomes a 100-file, error-prone sweep, and divergence silently produces bugs.

**This PRD replaces the per-generator contract with a single typed `GenerationContext`,**
resolved **once** at the registry boundary and consumed uniformly by every generator. Every
cross-cutting axis — pedagogical scope, eval-mode constraint, support tier, structural difficulty —
becomes a field on that context, resolved in one place. Adding or changing an axis is a one-file
change, not a hundred.

**Decision (2026-06-27):** Full envelope refactor (not an opt-in adapter) covering the full
generation context (all four axes, not just intent). The end state has **no legacy config path**.

---

## 2. The problem, with evidence

The 2026-06-27 intent audit swept all 189 `registerGenerator` handlers against their generators.
It is the canonical illustration of the divergence this PRD eliminates.

### 2.1 The untyped contract

```ts
// contentRegistry.ts — the entire compile-time contract for what a generator receives:
export interface ManifestItemConfig { [key: string]: unknown; }   // ← a bag of anything
export interface ManifestItem<TConfig = ManifestItemConfig> {
  componentId: ComponentId; instanceId: string;
  title?: string; intent?: string; config?: TConfig;              // ← intent is a SIBLING of config
}
```

### 2.2 The originating mismatch

`flattenManifestToLayout` (gemini-manifest.ts:73–88) puts `intent` at **top-level `item.intent`**
and injects only `objectiveId/objectiveText/objectiveVerb` into `config` — **never `intent`**.
Yet `scopeContext.ts`'s `ScopeBearingConfig` comment claims intent *is* injected into config.
**The documented contract and the actual contract disagree.** Generators reading `config.intent`
therefore only work if their handler manually re-injects `intent: item.intent` — and most don't.

### 2.3 Five config-shaping idioms at the boundary (one job, five spellings)

| Idiom | Example handler | Effect on intent |
|---|---|---|
| bare `item.config` | `number-tracer`, `stoichiometry-lab` | **dropped** |
| `{ ...item.config }` | `letter-spotter` | **dropped** |
| `{ ...item.config, intent: item.intent \|\| item.title }` | `counting-board` | threaded |
| `{ intent: item.intent }` (config discarded!) | `matter-explorer` | threaded, other config lost |
| positional `item.intent \|\| item.title \|\| topic` | `molecule-viewer` | threaded as `topic` |

### 2.4 The bugs this divergence caused (this session)

- **4 silent production bugs (Category A):** `gas-laws-simulator`, `stoichiometry-lab`,
  `number-tracer`, `practice-problem` — generators that *read* `config.intent` but whose
  handlers *dropped* it. Invisible to `eval-test` (the route injects `config.intent` directly),
  so they survived QA. Fixed one-by-one this session.
- **4 dead threads (Category D):** `multiplication-explorer`, `shape-builder`,
  `skip-counting-runner`, `math-fact-fluency` — registry threads intent, generator ignores it.
- **~80 latent (Category B):** both sides unwired; intent silently discarded.

Each of these is the *same* defect wearing a different mask. A single contract makes the entire
class unrepresentable.

### 2.5 The same story, four times over

Intent is only ONE axis. The pattern repeats for every cross-cutting concern, each re-implemented
per generator:

| Axis | Per-generator surface today | Shared seam (partial) |
|---|---|---|
| Pedagogical scope (topic/objective/intent → range ceiling) | `resolvePedagogicalScope` adopted by ~5 gens; most ignore objective | `scopeContext.ts` ✅ exists, ~5% adopted |
| Eval-mode constraint (which challenge types) | `resolveEvalModeConstraint` + `constrainChallengeTypeEnum` hand-wired per gen | `evalMode.ts` ✅ exists |
| Support tiers (scaffolding withdrawal) | `normalizeSupportTier` + `resolveSupportStructure` **copied into ~41 math gens** | none — copy-paste |
| Structural difficulty (problem shape) | `resolveProblemShape` + `constrainStructuralEnums` + `buildTierPromptSection` copied per gen | none — copy-paste |

Support tiers and structural difficulty have **no shared module at all** — they are duplicated
source in dozens of files. This is the maintenance treadmill the CLAUDE.md philosophy warns about,
realized at the generator layer.

---

## 3. Goals & non-goals

### Goals
1. **One typed `GenerationContext`** is the sole input every generator receives (besides its
   response schema). No generator reads `item`, `config`, or top-level fields directly.
2. **One resolution pipeline** builds that context at the registry boundary, covering all four
   axes. Each axis is resolved in exactly one place.
3. **Cross-cutting change = one-file change.** Adding intent, a fifth axis, or changing how scope
   binds is edited once in the pipeline, not per generator.
4. **The defect class is unrepresentable.** A handler cannot "forget" to thread intent because
   handlers no longer shape config — the pipeline does.
5. **Behavior-preserving migration.** No-tier / no-evalMode paths stay byte-identical; pedagogy
   invariants (§7) hold; `tsc` returns to baseline (1419).

### Non-goals
- Changing the manifest's authored shape, the catalog, or IRT β/a/c calibration.
- Changing primitive UIs or the response schemas themselves (only how they're *constrained*).
- Re-pedagogy of any axis — this is plumbing harmonization, not a teaching change.
- The number-range *resolver* heuristics (e.g. number-line's `resolveTopicNumberRange`) — those
  remain primitive-specific value-pickers; the context only carries the *inputs* they need.

---

## 4. The contract: `GenerationContext`

A single typed envelope, resolved once, consumed everywhere.

```ts
// service/generation/generationContext.ts  (NEW — the canonical contract)

export interface GenerationContext {
  // ── Identity ───────────────────────────────────────────────
  componentId: ComponentId;
  instanceId: string;

  // ── Lesson framing (always present) ────────────────────────
  topic: string;            // broad lesson topic, e.g. "Counting to 5"
  gradeLevel: string;       // raw grade key, e.g. "kindergarten" (the CEILING)
  gradeContext: string;     // grade-appropriate prose for prompts

  // ── Objective / intent (the per-component assignment) ──────
  /** Specific objective the manifest assigned to THIS instance (≠ topic). */
  intent?: string;
  objective?: { id?: string; text?: string; verb?: string };  // Bloom-tagged

  // ── Axis 1: pedagogical scope (range/representation ceiling) 
  scope: PedagogicalScope;          // from scopeContext.ts, always built

  // ── Axis 2: eval-mode constraint (which challenge types) ───
  evalMode?: EvalModeConstraint;    // null ⇒ unconstrained (mixed)

  // ── Axis 3: support tier (scaffolding withdrawal) ──────────
  supportTier?: SupportTier;        // 'easy' | 'medium' | 'hard' | undefined

  // ── Axis 4: structural difficulty (problem shape) ──────────
  /** Resolved per (pinnedMode, supportTier); undefined when no clean lever. */
  structuralDifficulty?: ProblemShape;

  // ── Escape hatch: still-bespoke per-primitive config ───────
  /** Typed-narrowing accessor for the rare primitive-specific field
   *  (e.g. maxNumber override). Discouraged; tracked for eventual removal. */
  raw: Readonly<Record<string, unknown>>;
}
```

Key properties:
- **`scope` is always built** (degrades gracefully when objective/intent absent) — so every
  generator can bind scope with zero per-generator wiring.
- **The four axes are resolved by the pipeline**, not the generator. A generator that only cares
  about scope reads `ctx.scope`; one that pins a mode reads `ctx.evalMode`. None of them re-resolve.
- **`raw`** is the pressure valve for genuinely primitive-specific fields during migration, with a
  lint rule to drive its usage to zero over time.

### 4.1 The new generator signature

```ts
// BEFORE (every generator, bespoke + divergent):
export const generateX = (topic: string, gradeLevel: string, config?: {…bespoke…}) => {…}

// AFTER (uniform):
export const generateX = (ctx: GenerationContext) => {…}     // returns Promise<XData>
```

### 4.2 The resolution pipeline (the single place)

```ts
// service/generation/resolveGenerationContext.ts  (NEW)
// Called ONCE inside registerGenerator's wrapper — generators never see `item`.

export function resolveGenerationContext(
  item: ManifestItem, topic: string, gradeContext: string, gradeLevel: string,
): GenerationContext {
  const intent = (item.config?.intent as string | undefined) ?? item.intent ?? item.title;
  const objective = {
    id:   item.config?.objectiveId   as string | undefined,
    text: item.config?.objectiveText as string | undefined,
    verb: item.config?.objectiveVerb as string | undefined,
  };
  const scope = resolvePedagogicalScope(topic, item.config, intent);          // axis-1, always
  const evalMode = resolveEvalModeConstraint(item.componentId,                // axis-2
                     item.config?.targetEvalMode as string | undefined, /*docs from registry*/);
  const supportTier = normalizeSupportTier(item.config?.difficulty as string);// axis-3
  const structuralDifficulty = resolveProblemShape(evalMode?.pinnedType, supportTier); // axis-4
  return { componentId: item.componentId, instanceId: item.instanceId,
           topic, gradeLevel, gradeContext, intent, objective,
           scope, evalMode, supportTier, structuralDifficulty,
           raw: item.config ?? {} };
}
```

Because this runs inside the `registerGenerator` wrapper, **a handler physically cannot drop an
axis** — there is no per-handler config object to get wrong. §2.3's five idioms collapse to zero.

> Note: axes 2–4 need per-primitive metadata (the eval-mode `ChallengeTypeDoc` registry, the
> support/structural lever tables). Today those live inside each generator. The migration lifts
> them into per-primitive **descriptors** (§6.2) the pipeline reads — so the *data* stays
> primitive-specific while the *resolution* is centralized.

---

## 5. Architecture

```
manifest (authored)
   │  flattenManifestToLayout  ── FIX: also inject intent into config (belt-and-suspenders)
   ▼
ManifestItem { componentId, instanceId, title, intent, config }
   │
   ▼  registerGenerator wrapper  ───────────────────────────────┐
        resolveGenerationContext(item, topic, gradeContext, grade)│  ← THE ONE PLACE
   ▼                                                              │
GenerationContext { topic, intent, objective, scope,             │
                    evalMode, supportTier, structuralDifficulty } │
   │                                                              │
   ▼  generateX(ctx)  ── reads ctx.* ; builds prompt from         │
        buildScopePromptSection(ctx.scope) + buildEvalSection(…)  │
        + buildTierSection(…) ; constrains schema via shared      │
        constrainChallengeTypeEnum / constrainStructuralEnums     │
   ▼                                                              │
GeneratedComponent { type, instanceId, data } ───────────────────┘
```

The four shared builder/constrainer functions (`buildScopePromptSection`,
`buildChallengeTypePromptSection`, the tier section builder, `constrainStructuralEnums`) already
exist or exist-as-copies. The refactor **promotes them to a single `service/generation/` module
set** and deletes the per-generator copies.

---

## 6. Migration plan (full refactor, ~100 generators)

### 6.1 Phase 0 — Land the contract (no generator changes yet)
1. Create `service/generation/`: `generationContext.ts`, `resolveGenerationContext.ts`, and move
   `scopeContext.ts` + the eval/tier/structural builders under it (re-export old paths to avoid a
   big import churn in one commit).
2. Fix `flattenManifestToLayout` to also set `config.intent = component.intent` (makes the
   documented contract true; belt-and-suspenders with the pipeline). Correct the
   `ScopeBearingConfig` comment.
3. Add the `registerGenerator` overload that accepts a **context-native** generator
   `(ctx: GenerationContext) => Promise<GeneratedComponent>` alongside the legacy signature, so
   migration is incremental *per generator* even though the end state is uniform.

### 6.2 Phase 1 — Lift per-primitive axis metadata into descriptors
For each primitive that implements eval modes / support tiers / structural difficulty, extract its
`CHALLENGE_TYPE_DOCS`, support-tier table, and `resolveProblemShape` mapping into a colocated
`<name>.descriptor.ts` the pipeline can read. This is mechanical and codemod-assisted. Generators
keep working (legacy path) until Phase 2 migrates them.

### 6.3 Phase 2 — Codemod the generator signatures (the ~100-file sweep)
A codemod rewrites each generator from `(topic, gradeLevel, config?)` to `(ctx)`, mapping:
`topic→ctx.topic`, `gradeLevel→ctx.gradeLevel`, `config?.intent→ctx.intent`,
`config?.difficulty→ctx.supportTier`, `config?.targetEvalMode→ctx.evalMode`, scope calls →
`ctx.scope`, and any residual field → `ctx.raw.<field>` (flagged for manual review). Each handler
becomes `registerGenerator('x', generateX)` with **no config object at all**.

Order of attack (lowest-risk first, each a reviewable PR):
1. The 4 already-fixed Category-A generators + the 4 Category-D (validate the pattern end-to-end).
2. The ~25 Category-C intent-wired generators (behavior-preserving by construction).
3. The ~80 Category-B latent generators (gain intent/scope for free).
4. Special cases: orchestrator-routed (`practice-problem`, `annotated-example`,
   `distribution-explorer`), positional (`molecule-viewer`), media `focusArea`.

### 6.4 Phase 3 — Delete the divergence
Remove per-generator copies of `normalizeSupportTier`/`resolveSupportStructure`/`resolveProblemShape`;
remove the legacy `registerGenerator` overload; drop `ManifestItemConfig`'s untyped escape once
`raw` usage hits zero. Update `/primitive`, `/add-eval-modes`, `/add-support-tiers`,
`/add-structural-difficulty` to emit descriptors + a context-native generator (no registry config
wiring step — it no longer exists).

### 6.5 Verification at each PR
- `tsc --noEmit` returns to baseline **1419** (see [[tsc-verification-integrity]]).
- `/topic-fidelity` intent-discrimination probe (fixed broad topic, varied intent) on a sample of
  each batch — output must track intent.
- `/eval-test` parity: a migrated generator's no-tier / no-evalMode output is behavior-equivalent
  to pre-migration.
- A new **`intent-contract` integration test**: asserts every registered generator, run through the
  *production* `resolveGenerationContext` path (not the eval-test shortcut), receives a defined
  `ctx.intent` when the manifest supplies `item.intent`. This is the regression guard the eval-test
  route structurally cannot provide (§2.4).

---

## 7. Invariants & guardrails (must hold through migration)

1. **Pedagogy rule #1 — no answer leak.** Objective/intent/scope text describes the *task*, never
   the answer. The scope block and tier sections already enforce this; carried verbatim.
2. **Grade is the CEILING, topic/objective WINS when narrower.** `buildScopePromptSection`'s
   existing rule is preserved ([[structural-difficulty-not-numeric]]).
3. **No-tier path is byte-identical.** When `supportTier`/`evalMode` are absent, the resolved
   context yields the same prompt + schema as today (the support-tier work's "byte-identical
   no-tier" guarantee, [[project_math-support-tiers-complete]]).
4. **Difficulty is STRUCTURAL, not numeric.** Axis-3/4 change shape, never magnitude
   ([[feedback_structural-difficulty-not-numeric]]).
5. **Schema is the constraint channel, not prose.** Constraints flow through
   `constrainChallengeTypeEnum`/`constrainStructuralEnums`, never regex on the topic
   ([[schema-over-regex-and-prompt]]).

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| 100-file codemod introduces silent behavior drift | Per-batch `eval-test` parity + `tsc` baseline gate; smallest-risk batches first; each batch its own PR |
| Hidden per-generator config fields lost in the sweep | `ctx.raw.<field>` catch-all + a lint that flags every `raw` access for manual review before Phase 3 deletion |
| Orchestrator-routed generators don't fit the prompt-section model | Treated as explicit special cases in Phase 2.4; context still carries intent as `context:` input |
| Eval-test continues to mask production-only drops | New §6.5 `intent-contract` test runs the *production* resolver; CI-enforced |
| Big-bang merge conflicts with in-flight primitive work | Phase 0 re-exports keep old import paths alive; migrate in small batches over time, not one PR |

---

## 9. Success metrics

- **Divergence eliminated:** 0 generators read `item`/`config` directly; 0 registry handlers shape
  a config object; 0 copied `normalizeSupportTier`/`resolveProblemShape` definitions.
- **Defect class closed:** the 4 Category-A bug shapes are unrepresentable; `intent-contract` test
  green for 100% of registered generators.
- **Change cost:** a new cross-cutting axis is added in 1 pipeline file + N descriptors, with 0
  generator-signature changes.
- **`tsc` at baseline (1419)**; eval-test parity across a migration sample.

---

## 10. Open questions

1. **Descriptor colocation vs. catalog.** Should per-primitive axis metadata (§6.2) live beside the
   generator (`<name>.descriptor.ts`) or fold into the existing catalog entry? Catalog already holds
   eval-mode definitions — consolidating there may be cleaner but enlarges catalog files.
2. **`gradeLevel` vs `gradeContext` duplication.** The `ContentGenerator` type already passes both;
   the context formalizes it. Confirm every generator that currently only gets `gradeContext` is
   unaffected by also receiving the raw `gradeLevel`.
3. **Orchestrator-routed generators** (`practice-problem`, `annotated-example`): do they consume the
   full `GenerationContext`, or a projection (`{ topic, intent, objective }`) forwarded as the
   orchestrator's `context`? Likely a projection — define it in Phase 2.4.
4. **Codemod confidence threshold.** Which residual-field rewrites are auto-applied vs. flagged for
   human review? Propose: anything not in the known field-map → `ctx.raw` + review comment.
```
