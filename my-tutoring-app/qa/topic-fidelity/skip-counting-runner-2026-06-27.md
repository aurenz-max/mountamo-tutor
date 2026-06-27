# Topic Fidelity: skip-counting-runner — 2026-06-27

Scope/theme intended: the skip interval and track range (skipValue / startFrom /
endAt) match what the topic/intent asks for; grade is the ceiling. Difficulty
stays STRUCTURAL — the tier withdraws on-workspace support, never enlarges the
skip value or lengthens the track.

Context: context-native generator on the harmonized `GenerationContext` contract.
It received a fully-resolved `ctx.scope` but did not read it ("latent"). This
wires `buildScopePromptSection(ctx.scope)` into the prompt.

| Probe | topic | intent | result (skipValue / range) | verdict |
|-------|-------|--------|----------------------------|---------|
| discrimination | Skip counting (broad) | Skip count by 5s up to 30 | skipValue 5, 0→30 | tracks |
| discrimination | Skip counting (broad) | Skip count by 2s up to 20 | skipValue 2, 0→20 | tracks |

**Verdict:** FIDELITY BUG (latent) → fixed at Tier 1.
Under a fixed broad topic, intent now steers both the learning target and the
track: "by 5s up to 30" → skipValue 5, endAt 30; "by 2s up to 20" → skipValue 2,
endAt 20. skipValue, startFrom, and endAt are all LLM-chosen from the prompt, so
prompt prose binds them.

**Mechanism (pool checked, NOT touched):** the skip-value pool is `createDiscretePool`
over `GRADE_BAND_SKIP_VALUES` — a grade-band-*legal* candidate set (== scope), not a
contiguous numeric band, and its `toPromptSection` already declares the topic
authoritative. So scope already had a path to `skipValue` via the prompt; the LLM
picks from the legal pool while reading the topic. Tier 1 strengthens this by adding
objectiveText + intent to the authoritative SCOPE block. **No Tier-2 resolver and no
pool filtering** — filtering the pool by topic would (a) re-introduce regex-on-topic
(violating [[schema-over-regex-and-prompt]]) and (b) add a per-render micro-LLM call
for no benefit, since the pool is already scope == grade-legal and topic-authoritative.

**No answer leak:** the scope block names the interval/range, never an answer; the
existing per-mode leak guards (skip-value badge suppressed where the value is the
answer) are untouched.

**Change:** `gemini-skip-counting-runner.ts` — `import { buildScopePromptSection }`
+ `const scopeSection = buildScopePromptSection(ctx.scope)` interpolated into the
prompt right after the opening line. The pool/range pickers were intentionally left
as-is. | tsc: 1419 (baseline).
