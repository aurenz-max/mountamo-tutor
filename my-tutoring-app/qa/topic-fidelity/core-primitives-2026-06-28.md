# Topic Fidelity: core primitives sweep — 2026-06-28

Scope/theme intended: every core/narrative/assessment generator should let the
manifest's per-component `intent` (not just the broad `topic`) shape its output.

## Audit (27 core generators registered in `coreGenerators.ts`)

The context-native migration delivers `ctx.intent` / `ctx.scope` to every generator
boundary, but a generator can still **drop intent in the prompt** (dead field). Static
read + probe found a systemic gap: ~10 core generators never interpolated intent.

| Status | Generators |
|---|---|
| **DEAD-FIELD** (intent never in prompt) → FIXED | knowledge-check, fast-fact, fact-file, how-it-works, timeline-explorer, vocabulary-explorer, digital-skills-sim, deep-dive, passage-studio, curator-brief |
| **Already honored** (no change) | scale-spectrum, annotated-example, formula-card, image-panel, take-home-activity, interactive-passage, word-builder, custom-visual, sentence-analyzer, math-visual (`Purpose: ${intent}`), graph-board (self-contained; intent = description) |
| **Honored-lite** (intent interpolated as a label, left as-is) | concept-cards, feature-exhibit, comparison-panel, generative-table |

## Verification — discrimination probe (vocabulary-explorer, fixed topic)

| Probe | topic | intent | result (terms) | verdict |
|-------|-------|--------|----------------|---------|
| A | Animals | ocean/sea creatures only | Marine, Tentacle, Coral ("Ocean Life Explorer") | tracks |
| B | Animals | insects and bugs only | Exoskeleton, Metamorphosis ("Insect World Explorer") | tracks |

Topic held constant, output tracks intent → the dead field is now live. All six
ctx-native fixes share the identical mechanism, so this validates the pattern.

**Verdict:** FIDELITY BUG (systemic dead field) → fixed at Tier 1 (prompt injection).
**Mechanism:** dead field — `ctx.intent`/`ctx.scope` reached the generator but never the prompt.

## Changes | tsc: 1417 (baseline 1419, no new errors)

- **fast-fact, fact-file, how-it-works, timeline-explorer, vocabulary-explorer, digital-skills-sim**
  — import + inject `buildScopePromptSection(ctx.scope)` after the TOPIC line ([[scope-context-contract]] pattern; these were missed in the rollout).
- **deep-dive, passage-studio** — thread `buildScopePromptSection(ctx.scope)` through
  `runOrchestrator → buildOrchestratorPrompt` so every block brief honors intent + range.
- **curator-brief** — added `intent?` param + a "This Lesson's Specific Focus" prompt block
  (hook/big-idea/objectives aim at intent, grade = ceiling, no answer leak); registry now
  passes `item.intent`. Function previously didn't accept intent at all.
- **knowledge-check** — registry folds `item.intent` into `objectiveText`, which flows to the
  orchestrator + every problem prompt via the existing ADDITIONAL CONTEXT channel.

No schemas changed. The scope block only ever NARROWS to the topic/intent; grade stays a ceiling.
