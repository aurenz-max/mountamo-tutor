# Parent report — queue

Answer "how is my child doing?" from data we already store. Prototype (user approved
10-07): https://claude.ai/artifact/2Hg3EpXeCdPonWwr7VbbDH, built by
`backend/scripts/parent_report_proto/` from a raw export of `students/1004`.

**Split:** numbers are deterministic backend code (`app/services/progress_report.py`,
`GET /api/analytics/student/{id}/report`); prose is Gemini over the computed facts and never
computes (`app/services/progress_report_narrative.py`, `GET .../report/narrative`). Mastery =
lifecycle gate 4 only. Surface: `ProgressReport` atop My Progress (avatar menu -> My activity).

| # | Item | State |
|---|---|---|
| PR-1 | Facts endpoint + `ProgressReport` panel, templated sentences | DONE 10-07 |
| PR-2 | Parent-facing sentence per subskill | DONE 10-08 in the curriculum: `parent_summary` + `parent_summary_hash` on every subskill; `draft_curriculum.publish()` fills missing/stale ones (curriculum-authoring-service `app/services/parent_summaries.py`, pytest 2/2) and `subskill_index` carries them. Backfilled all 26 published subjects, 2239/2239, via `scripts/fill_parent_summaries.py --fill --publish` (publishes only drafts identical to published; G5 LA/Math empty drafts reseeded with `backfill_from_published`). Shown in the report and the journey skills panel (`curriculum_service` passes `parent_summary`; driven in app) |
| PR-3 | Gemini narrative (short answer, learning headline, ledes; count headlines stay templated) | DONE 10-08. Code computes the difficulty verdict (needs >=3 active weeks and >=30 answers); any number not in the digest rejects the text and the template stays. Cached `students/{id}/reports/{date}`, key includes the prompt. 3/3 samples grounded; ~5s with thinking budget 512 (30s default) |
| PR-4 | At-home tips per mistake pattern / struggling skill | DONE 10-08. Keyed by pattern at `parent_tips/{key}`, shared across students; none for items more than 1 grade above |
| PR-D1 | Burst attempts | CLOSED 10-08. Cause: a primitive auto-submitting in a loop (number-tracer, letter tracer, base-ten); fixed at source by the submit-once latch in `usePrimitiveEvaluation` (06-07). No burst in any student since 06-09 (403 attempts, max 16/subskill/day). Old bursts stay in L0 and rollups; the report excludes them |
| PR-I1 | INCIDENT 10-08, resolved: the G1 SOCIAL_STUDIES draft carried `grade: "Kindergarten"`, and `deploy_curriculum` writes to the grade inside the doc, so the backfill's G1 publish overwrote published K Social Studies with G1 content (about 25 min). No lineage records were written (the diff ran against `published/1`). Restored K from its own draft (159 K subskills); fixed the draft label; `publish()` now refuses a draft whose grade field disagrees with the grade being published. Audit: all 26 published subjects hold their own grade. Backend curriculum cache (60 min TTL) may serve the bad K SS until it expires or the backend reloads |
| PR-5 | Journey skills panel on the report service | DONE 10-08: `UnitSkillsPanel` reads `subskill_stats` from `GET .../report?grade=` (lifecycle gate, burst-excluded answers, accuracy, lessons); one status per focus from its gate; "N of M mastered" replaces the competency "mastery %"; predicted success only on focuses the child can work on now; LOCKED says when it unlocks. Driven in app (The Alphabet: 9 answers 99% MASTERED, letter-sounds LEARNING 1 answer) |
| PR-D2 | Run `scripts/cleanup_synthetic_lifecycle.py --apply` | user's call; the report already skips ids with no curriculum home |
| PR-R1 | Review flow for generated text (`reviewed: false` on summaries and tips) | open, needs a user ruling on who reviews |
| PR-R2 | A parent's own view (today the learner's account sees its own report; the parent portal is vestigial, user 08-14) | open, needs a user ruling |

Tests 10-08 (each confirmed to FAIL against the bug it pins): authoring service `tests/test_publish_pipeline.py` 9/9 (in-memory Firestore, real publish/deploy/lineage: grade-label overwrite refused, own-grade only, accepted units only, lineage gate, no lineage on unchanged republish, summaries filled, Gemini failure non-blocking, backfill clean check) + `test_parent_summaries.py` 2/2; backend `tests/test_progress_report.py` 6/6 (gates-only mastery, burst exclusion, lowercase twins separate, "3rd" grade, empty student). Pre-existing: `test_foundations_api.py` errors (no `client` fixture).

Verification 10-08: pytest `tests/test_progress_report_narrative.py` 3/3, vitest
`progressReport/reportText.test.ts` 6/6, typecheck:lumina 0, full tsc 771 (0 in touched files).
Probed students 1004 (rich), 1007 (2 answers, grade stored "3rd"), 900001 (no attempts).
Headless drive (login -> My activity): both endpoints 200, narrative + summaries + tips render,
no page errors, no overflow at 400px. Forecast instability (was PR-D3) is not a report item;
the report does not show the forecast.
