# Topic Fidelity: shape-builder — 2026-06-27

Scope/theme intended: the target shape's properties (sides, right angles, etc.)
stay within what the topic/intent asks for; grade is the ceiling.

Context: context-native generator on the harmonized `GenerationContext` contract.
It received a fully-resolved `ctx.scope` (built from topic + objective + intent)
but did not read it — "latent": the contract delivered scope, the prompt ignored
it. This wires `buildScopePromptSection(ctx.scope)` into the prompt.

| Probe | topic | intent | result (target sides) | verdict |
|-------|-------|--------|-----------------------|---------|
| discrimination | 2D shapes (broad) | Build triangles (3-sided shapes) | sides [3, 3, 3] | tracks |
| discrimination | 2D shapes (broad) | Build quadrilaterals (4-sided shapes) | sides [4, 4, 4] | tracks |

**Verdict:** FIDELITY BUG (latent) → fixed at Tier 1.
Under a fixed broad topic, the per-component intent now steers the target shape:
"triangles" → every challenge targets 3 sides; "quadrilaterals" → 4 sides
(rectangle/parallelogram). Before the wiring the generator could only honor the
broad lesson topic; the assigned intent was delivered as `ctx.scope` but dropped.

**Mechanism:** prose-only / dead axis — `ctx.scope` was passed but never read.
The fix injects the authoritative SCOPE block right after the opening
"Create an educational geometry activity…" line and BEFORE the grade-band
guidance, so the topic/objective/intent reframe grade as a CEILING. Shape
properties are LLM-chosen from the prompt, so Tier 1 (prompt prose) binds.

**No answer leak:** the scope block describes the task scope (which shapes), never
the constructed geometry; the component still validates from placed vertices.

**Change:** `gemini-shape-builder.ts` — `import { buildScopePromptSection }` +
`const scopeSection = buildScopePromptSection(ctx.scope)` interpolated into the
prompt. | tsc: 1419 (baseline).
