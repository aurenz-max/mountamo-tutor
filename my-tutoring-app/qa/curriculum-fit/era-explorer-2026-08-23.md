# Curriculum-Fit: era-explorer — 2026-08-23

**Domain → Subject:** history → SOCIAL_STUDIES (mapping ADDED this slice — see note)
**Query (embedded):** "Deep-dive exploration of a single historical era: students explore the era through lenses (daily life, technology, school and…"

## Results

| Grade | Verdict | Best cosine | Coherence | Matched skill |
|-------|---------|-------------|-----------|---------------|
| K | MATCH | 0.754 | 5/5 | SS004-02-A / SS004-04 "Past vs. Present" — sort objects into past/present |
| 1 | MATCH | 0.766 | 5/5 | SS004-03-a "Family History" + SS004-01 "Past and Present" |
| 2 | MATCH | 0.775 | 3/5 | SS004-03 "Change Over Time" (community past vs present) |
| 3 | MATCH | 0.800 | 5/5 | SS004-05-c "Local and State History" — contrast daily life long ago vs today |
| 4 | MATCH | 0.745 | 5/5 | SS004-05-e "Key Figures" — connect figures to their era; SS004-06 "Working with Sources" |

## Diagnosis & Recommendation

All probed grades have a clear curriculum home. No curriculum or description action.

**Scoping fix shipped with this birth:** the `history` catalog domain was absent from
`_DOMAIN_TO_SUBJECT` in `backend/app/services/curriculum_retrieval_service.py` — the first probe
returned `no_scope` and production submissions would have failed to scope to SOCIAL_STUDIES
(the QA_curriculum_mapping_misattribution bug class). Added `"history": "SOCIAL_STUDIES"`.
Backend line ships WITH its consuming surface (era-explorer) per doctrine.

**Assessability check (rule 4):** era-explorer has a real solve surface — `challenges[]`,
`correctPlacement`, `recordResult`, `submitEvaluation` (canonical multi-instance loop). MATCH +
solve surface → `/add-eval-modes` is a valid next executor.

**Grade-4 note:** the G4 match is coherent but conceptually adjacent (figures-in-era, sources)
rather than continuity-vs-change. The `era_sort` core serves K-3 best; the G4+ demand
(figures/causes) is exactly the `era_compare` / `cause_of_change` ladder candidates on the
birth certificate.
