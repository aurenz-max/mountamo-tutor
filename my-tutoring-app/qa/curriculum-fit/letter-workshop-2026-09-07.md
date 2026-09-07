# Curriculum-Fit: letter-workshop — 2026-09-07

**Domain → Subject:** literacy → LANGUAGE_ARTS

**Query:** Verbatim catalog description beginning “Kindergarten and grade 1 Language Arts handwriting: assisted uppercase and lowercase letter formation.” No topic, objective, or eval-mode terms added. Full embedded query and top five candidates are in [raw JSON](letter-workshop-2026-09-07.json).

| Grade requested | Runtime verdict | Best cosine | Coherence | Top skill |
|---|---|---|---|---|
| K | MATCH | 0.8166 | 4/5 | Letter Formation (`LANGUAGE_ARTS-U1759978911500-uis7sy0k2-1760800643043-wbpkouvg5`) |
| 1 | MATCH | 0.7302 | 3/5; same-skill 2/5 | Writing Names and Labels (`LA002-03`) |

## Interpretation and recommendation

- **Kindergarten has a clear curriculum home.** All four Letter Formation groups rank first through fourth. Group 1 explicitly calls for guided tracing, correct starting points, and stroke paths before independent writing. The primitive supplies the assisted portion; it does not establish the later independent-writing mastery described in the curriculum. The probe inspected 191 candidates.
- **Grade 1 is a runtime MATCH with a semantic-fit limitation.** The top subskill (`LA002-03-a`) asks children to write their own name with capitalization, which this primitive does not implement. Other retrieved skills include spelling patterns, noun sorting, drawing labels, and picture labels. The live matcher reports coherence 3/5, but only two top-five candidates share the top skill. Do not describe this as verified name-writing coverage or a clean Grade 1 letter-formation home. The probe inspected 65 candidates. Review the Grade 1 curriculum for a dedicated assisted letter-formation subskill via `/curriculum-author`, or keep claims of curriculum alignment scoped to the confirmed Kindergarten home. A runtime retrieval MATCH alone does not resolve this task mismatch.

## Execution

Read-only `backend/scripts/curriculum_fit_probe.py`, live `CurriculumRetrievalMatcher`, grades `K,1`, JSON output, backend virtual environment and `PYTHONPATH`. Firestore initialized and both grades returned full results; no environment block. PowerShell wrapped normal stderr initialization logs as a `NativeCommandError`, producing shell exit 1 despite a complete, parseable JSON report. No curriculum, catalog, student data, or matcher thresholds were changed.
