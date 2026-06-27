# Topic Fidelity: multiplication-explorer — 2026-06-27

Scope/theme intended: both factors (and therefore the product) stay within the
range the topic/intent asks for; grade is the ceiling. Difficulty stays
STRUCTURAL — the tier withdraws on-screen support, never enlarges factors.

Context: context-native generator on the harmonized `GenerationContext` contract.
It received a fully-resolved `ctx.scope` but did not read it ("latent"). This
wires `buildScopePromptSection(ctx.scope)` into the prompt.

| Probe | topic | intent | result (fact / challenges) | verdict |
|-------|-------|--------|----------------------------|---------|
| discrimination | Multiplication facts (broad) | factors up to 5 (facts up to 5×5) | fact 5×5; all challenge factors ≤ 5 | tracks |
| discrimination | Multiplication facts (broad) | factors up to 12 (facts up to 12×12) | fact 3×12; factor 12 present | tracks |
| no-regression  | Multiplication | Practice multiplication (generic) | fact 5×2, gradeBand 2-3 | grade default |

**Verdict:** FIDELITY BUG (latent) → fixed at Tier 1.
Under a fixed broad topic, intent now steers the factor range: "up to 5×5" keeps
every factor ≤ 5; "up to 12×12" admits factor 12 (3×12=36). A generic intent falls
back to the sensible grade-2-3 default (no regression / no collapse). Factors are
LLM-chosen (`fact.factor1/factor2`), so prompt prose binds them.

**Mechanism:** prose-only / dead axis — `ctx.scope` passed but never read. The fix
injects the authoritative SCOPE block right after the opening "Create an
educational multiplication explorer activity…" line and BEFORE the grade-level
guidelines, reframing grade as a CEILING.

**No answer leak:** the scope block names the factor range, never a product; the
existing product-readout leak guard (showProduct forced off where the product is
the asked value) is untouched.

**Change:** `gemini-multiplication-explorer.ts` — `import { buildScopePromptSection }`
+ `const scopeSection = buildScopePromptSection(ctx.scope)` interpolated into the
prompt. | tsc: 1419 (baseline).
