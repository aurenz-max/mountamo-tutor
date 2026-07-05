# Topic Fidelity: picture-vocabulary — 2026-07-04

Axis under test: **theme + intent** (default modality). Values are **LLM-picked**
(Gemini emits the word pool; code owns only challenge assembly), so the fidelity
lever is the prompt — a Tier-1-fixable generator if it had missed.

Scope/theme intended: the topic should flavor the K-1 noun pool; the per-primitive
intent should lean word choices; a generic topic should fall back to everyday K nouns.

## Intent contract — already wired (no Phase 0.5 fix)

Context-native generator. `registerContextGenerator('picture-vocabulary', …)`
([literacyGenerators.ts:584](../../src/components/lumina/service/registry/generators/literacyGenerators.ts#L584))
forwards the full `ctx`, and `resolveGenerationContext` resolves `ctx.intent` /
`ctx.topic` at the boundary. Both reach the prompt via `preamble()`
([gemini-picture-vocabulary.ts:527-530](../../src/components/lumina/service/literacy/gemini-picture-vocabulary.ts#L527-L530)) —
topic as the theme, intent as a SOFT "lean toward … when possible, but always
prioritize concreteness/picturability." The soft weighting is deliberate K-1
pedagogy, and probes show it still tracks decisively.

## Probes (evalMode=naming, grade band=kindergarten)

| Probe | topic | intent | words produced | verdict |
|-------|-------|--------|----------------|---------|
| honored        | Farm Animals            | —                 | tractor, apple, barn, sun, horse   | on-theme (apple/sun = allowed everyday fills) |
| discrimination | Ocean & Sea Creatures   | —                 | octopus, shark, fish, starfish, turtle | tracks (5/5) |
| discrimination | Things in the Kitchen   | —                 | plate, clock, spoon, chair, bread  | tracks |
| no-regression  | Vocabulary practice     | —                 | house, duck, apple, lamp, spoon    | everyday-K default |
| intent-disc    | Words we know           | clothes we wear   | **sock, hat, dress**, apple, clock | intent tracks |
| intent-disc    | Words we know           | vehicles          | **plane, bike, boat, truck**, apple | intent tracks |

**Verdict:** HONORED. Topic themes the pool, intent leans it under a fixed broad
topic, and the generic topic falls back to everyday K nouns. No change made.
**Mechanism:** honored (LLM-picked values, topic + intent both in the prompt).

## Notes / observations (no action)

- `opposite` and `sentence_frame` modes draw from a constrained concrete-opposite /
  frame space (big/small, hot/cold, "We sleep in a ____"). Theme is intrinsically
  secondary there — the prompt correctly says "theme wherever a concrete noun fits."
  A near-generic opposite pool on a strong theme is expected, not a fidelity bug.
- **Grade axis (not this invocation):** the generator reads `ctx.gradeContext`
  (band prose), not `ctx.grade`. The primitive is intrinsically K-1 (catalog:
  "ESSENTIAL for K-1 vocabulary development"), so a `--grade` run above grade 1
  would be WRONG PRIMITIVE (K-1 ceiling by design), not a bug. No `ctx.grade`
  migration warranted.

tsc: not run — no code changed.
