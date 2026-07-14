# Eval Report: interactive-book — 2026-07-14

## Results

| Probe | Runtime | Challenges | G1 | G2 | G3 | G4 | G5 | Verdict |
|-------|---------|------------|----|----|----|----|----|---------|
| `find-feature` run 1 | RUN | 5 | PASS | PASS | N/A | PASS | PASS | PASS |
| `find-feature` run 2 | RUN | 5 | PASS | PASS | N/A | PASS | PASS | PASS |
| `find-feature` run 3 | RUN | 5 | PASS | PASS | N/A | PASS | PASS | PASS |

Each run produced exactly one book, three pages, and five challenges. Manual contract validation passed for all generated payloads: required strings were nonempty; focus words were whole, single-token paragraph matches with definitions and picture cues; IDs were unique; target pages existed; target text exactly matched one visible hotspot; option arrays exactly matched the target-page hotspots; and prompts/hints did not contain the literal target text.

The originally requested URL omitted `evalMode`, so the route returned its catalog response on all three attempts. Re-running with `evalMode=find-feature` exercised generation successfully. Because this L0 catalog entry intentionally has no `evalModes` ladder yet, the route reported `No eval mode in catalog (skipped validation)`; the PASS above is from the explicit G1/G2/G4/G5 contract validator, not the route's skipped catalog validator.

## Confirmed findings fixed

- **COMPONENT — pre-answer page-number leak:** the navigation label repeated the exact `Page 3` target outside the clickable book hotspot. It now displays `Book page` until that challenge is resolved.
- **GENERATOR — invisible multi-word focus phrases:** reconstruction allowed a space-separated focus phrase, while the component only underlines token-sized words. Reconstruction now requires exactly one token (hyphenated words remain valid).
- **GENERATOR — incomplete leak validator:** derived-challenge validation checked prompts but not hints. It now rejects any hint containing the literal target text.

## Verification

- G1 required fields: PASS
- G2 flat scalar reconstruction: PASS across all sampled pages and focus-word groups
- G3 eval-mode differentiation: N/A at L0
- G4 answer derivability and visible-hotspot equality: PASS
- G5 fallback quality: PASS; the deterministic easy/medium/hard fallback books are complete, renderable, and derive the same five solvable challenges
- Filtered TypeScript check: no errors for `InteractiveBook`, its generator, literacy catalog, tester, or evaluation types. The repository-wide check remains nonzero with 1,026 lines of unrelated baseline diagnostics.

