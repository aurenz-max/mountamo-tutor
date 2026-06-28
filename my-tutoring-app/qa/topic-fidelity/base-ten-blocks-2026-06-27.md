# Topic Fidelity: base-ten-blocks — 2026-06-27

First `/topic-fidelity` pass under the context-native generator API (PRD_GENERATION_CONTEXT_HARMONIZATION).

Scope/theme intended: the number magnitude (targetNumber / numberValue) should respect
both the topic-implied bound and the per-instance objective (`ctx.intent`), with grade
as the ceiling.

| Probe | topic | intent | result (max value / band) | verdict |
|-------|-------|--------|---------------------------|---------|
| honored | Place value to 20 (K) | (none) | max 20, band K-1 | HONORED |
| discrimination | Place value to 1000 (G4) | (none) | max 962, band 2-3 | tracks |
| intent-disc | Place value with base-ten blocks (G2) | Build small numbers up to 20 | max 20, band K-1 | HONORED |
| intent-disc | Place value with base-ten blocks (G2) | Build 3-digit numbers in the hundreds | max 940, band 2-3 | tracks |

**Verdict:** HONORED — no change.
**Mechanism:** honored. `generateBaseTenBlocks` already reads `ctx.intent`
(`config = { ...(ctx.raw), intent: ctx.intent }`) and interpolates it
(`Intent: ${config?.intent || topic}`). Values are LLM-chosen from grade band + topic +
intent prose; the intent alone moved both the gradeBand (K-1 vs 2-3) and the magnitude
under a held-broad topic — the intent contract works end-to-end through the new pipeline.
**tsc:** 1417 (baseline 1419) — unchanged by this report.
</content>
