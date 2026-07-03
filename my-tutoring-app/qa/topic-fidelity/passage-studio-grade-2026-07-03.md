# topic-fidelity --grade : passage-studio (2026-07-03)

**Generator:** `my-tutoring-app/src/components/lumina/service/core/gemini-passage-studio.ts`
**Modality:** grade fidelity (does ctx.grade shape realization?)
**Eval mode probed:** `apply` · **Topic:** "the water cycle"
**Risk group:** B (large orchestrator, prose-passthrough)

## Diagnosis
Shape **B (PROSE PASSTHROUGH)**. Line 780 was `const gradeLevel = ctx.gradeContext`, fed
into `runOrchestrator(topic, gradeLevel, …)` and every `generateBlock(…, gradeLevel)`.
The BAND prose flows to the LLM (so cross-band already tracked), but the canonical
numeric grade never reached any prompt — `ctx.grade` was a **dead field**. Because the
eval-test/manifest path delivers the band string ("elementary") for BOTH grade 2 and
grade 5, within-band grades were indistinguishable.

## Fix (Group B minimal — no restructure)
```ts
const gradeLevel = ctx.grade ? `grade ${ctx.grade} student` : ctx.gradeContext;
```
This surfaces the numeric grade in the value passed to the orchestrator + all block
prompts; band prose remains the fallback when no canonical grade is stamped. Schema,
eval-mode/challenge-type axis, and block set untouched. `data.gradeLevel` only feeds
the AI tutor context (useLuminaAI), never a displayed label, so the new value is safe.

## Probe table
| probe | grade | passage words | avg sent len | long words (>=8ch) | note |
|-------|-------|---------------|--------------|--------------------|------|
| BEFORE | 2 | 132 | 11.0 | 11 | title "Amazing Journey of a Water Droplet" |
| BEFORE | 5 | 132 | 13.2 | 12 | SAME title as g2 → LLM noise, band-locked |
| AFTER  | K | 102 | 10.2 | 5  | "Little Drop lives in the big, blue ocean" |
| AFTER  | 2 | 101 | 10.1 | 7  | simple narrative, "invisible mist called vapor" |
| AFTER  | 5 | 131 | 18.7 | 12 | abstract exposition, "closed-off plumbing system" |
| AFTER  | 9 | 121 | 15.1 | 34 | "self-regulating machine… persistent metamorphosis" |
| AFTER  | none (band=elementary) | 128 | 11.6 | 14 | narrative "Drip the droplet" — control unchanged |

## Verdict: PARTIAL_IMPROVED
- Band ladder already tracked (passthrough). Numeric-grade surfacing added.
- Within-band 2 vs 5 now diverge sharply (sent-len 10.1 → 18.7; concrete narrative →
  abstract systems exposition) where before they were near-identical noise.
- Cross-band monotonic (K long-words 5 → g9 34).
- No-grade control matches prior band-only behavior → no regression.
- Grade governs realization only (reading level / vocab / sentence length); eval-mode
  cognitive KIND and schema unchanged. No answer leak (all sampled text is stimulus prose).
