# Curriculum fit: place-value-chart — 2026-09-12

Live production retrieval used the verbatim math catalog description, beginning “Live tutor-judged place value (DI modality) over 2- to 5-digit whole numbers.”

| Grade | Retrieval verdict | Best cosine | Same-skill coherence | Top result |
|---|---|---|---|---|
| 3 | MATCH | 0.7587 | 3/5 | NBT003-02-a: three-digit worth |
| 4 | MATCH | 0.7953 | 4/5 | NBT004-02-d: construct multi-digit numbers |

The broad primitive has curriculum homes, but the compare pilot needs a narrower objective. Grade 3's three-digit requirement is incompatible with its existing 1111–9999 band. Grade 4 rank 2, `NBT004-01-b` (cosine 0.7693), explicitly asks learners to identify digit place and numeric value in whole numbers up to one million. Its allowed range includes four-digit numbers. Bind the pilot to this explicit objective; do not assume the broad retrieval top result certifies digit-worth remediation.

Published Grade 4 revision: `98202434-e96c-42ed-8c8e-6fd801b451ef@2026-06-09T03:49:30.592858`. Reviewed backend retest range: 1111–9999; compare/medium, tens/hundreds contrast. This is immediate evidence about a hypothesis, not proof of mastery through millions. No curriculum or catalog edits.

Reproduce with `backend/scripts/probe_place_value_curriculum.py`. Raw retrieval and publication snapshots are in `artifacts/place-value-curriculum-fit.json` and `artifacts/place-value-published-curriculum.json`.
