# Eval Report: how-it-works — 2026-03-22

## Key Files

```
Component:  src/components/lumina/primitives/visual-primitives/core/HowItWorks.tsx
Generator:  src/components/lumina/service/core/gemini-how-it-works.ts
Catalog:    src/components/lumina/service/manifest/catalog/core.ts
```

## Results

| Eval Mode | Challenge Types | Status | Issues |
|-----------|----------------|--------|--------|
| guided | identify | PASS | — |
| sequence | sequence, identify | PASS | — |
| predict | predict, explain | PASS | — |

## Notes

### HW-1 — Fixed (2026-03-22)

**Was:** "explain" challenge type used free-form `<textarea>` with naive `.includes()` keyword matching. False negatives for paraphrasing, jarring UX compared to structured MC types.

**Fix:** Converted "explain" to multiple-choice format ("Why is Step X important?" with 4 options). Reuses existing MC rendering from identify/predict. Changes in generator (prompt, schema, validation) and component (removed textarea, added explain to MC render path).

## Screenshot

100% score shown — all challenges correct, all steps explored. Process Mastered. All challenge types now use consistent structured interaction.
