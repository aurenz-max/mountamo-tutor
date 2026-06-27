# Topic Fidelity: math-fact-fluency — 2026-06-27

Scope/theme intended: every operand and result stays within the range the
topic/intent implies (maxNumber); grade is the ceiling. Difficulty stays
STRUCTURAL — the tier never enlarges numbers.

Context: context-native generator on the harmonized `GenerationContext` contract.
It received a fully-resolved `ctx.scope` but did not read it ("latent"). This
wires `buildScopePromptSection(ctx.scope)` into the prompt.

| Probe | topic | intent | result (maxNumber / sums) | verdict |
|-------|-------|--------|---------------------------|---------|
| discrimination | Addition facts (broad) | Add within 5 (sums to 5) | maxNumber 5; all sums ≤ 5 | tracks |
| discrimination | Addition facts (broad) | Add within 10 (sums to 10) | maxNumber 10; sums up to 10 | tracks |

**Verdict:** FIDELITY BUG (latent) → fixed at Tier 1.
Under a fixed broad topic, intent now steers magnitude scope: "within 5" →
maxNumber 5, every operand/result ≤ 5; "within 10" → maxNumber 10. The numbers
are LLM-chosen (`maxNumber` + per-challenge operands), so prompt prose binds them.

**Mechanism:** prose-only / dead axis — `ctx.scope` passed but never read. The fix
injects the authoritative SCOPE block right after the opening "Create a math fact
fluency activity…" line and BEFORE the grade guidelines, reframing grade as a
CEILING. The support-tier system (structural-only, magnitude-fixed) is untouched.

**No answer leak:** the scope block names the range, never an answer; the existing
"NEVER reveal the answer in the instruction text" rules still hold.

**Change:** `gemini-math-fact-fluency.ts` — `import { buildScopePromptSection }` +
`const scopeSection = buildScopePromptSection(ctx.scope)` interpolated into the
prompt. | tsc: 1419 (baseline).
