# Reading Repair Studio — 2026-09-13

Implemented `reading-repair-studio` as **provisional reading practice**, with one core task, `notice_and_repair`. It is available in Lumina → Developer Tools → Language Arts → Reading Repair Studio. Choose Grade 2 and Generate Content.

The existing Read Aloud Studio immediately coaches judged misses and does not retain a replayable cold-reading/independent-noticing ledger. A separate primitive preserves that tool's behavior while providing the new learning process.

## Learner behavior

Three fresh 5–8 word sentences. Read before a model, replay the actual recording, optionally select words to revisit, reread the whole sentence, optionally reflect, then move to fresh text. Every initial verdict remains private until the learner closes checking. Help gives letter-and-meaning prompts and is recorded before it appears. Accurate first readings are recognized without inventing a repair opportunity. No visible timer or speed/prosody score.

Outcome evidence is separate: `accurate_first_read`, `independent_repair`, `supported_repair`, `unresolved_error`, `unassessable`. Independent repair requires an observed initial substitution, the learner's exact word selection, an accurate subsequent full reading, and no prior support. Selecting every word, replaying, reflecting, or completing is insufficient. Tutor audio from a shared session conservatively marks support.

## Required fields and design contract

Generator fork B: three parallel, independent sentence-generation calls, unique normalized text within the session, index-derived IDs, bounded regeneration of invalid/duplicate sentences, explicit failure if three cannot be built. No fixture fallback. The printed text is the answer reference; there is no fabricated target error.

| Scope | Required fields | Consumer |
|---|---|---|
| Session | `title`, `description`, `gradeLevel`, `challengeType: notice_and_repair`, `challenges[]` | Header, tutoring metadata, progress and phase grouping |
| Each challenge | `id`, `challengeType: notice_and_repair`, `text` | Keyed round, clickable printed words, recording comparison |
| Audio evidence | two transcripts with `transcript`, `confidence`, `complete`; derived status and mismatch indexes | Provisional classification only; hidden during independent checking |

## Verification

| Check | Result |
|---|---|
| Focused unit/component/shared-capture tests | 30/30 pass across four files |
| TypeScript | 771 pre-existing errors before and after; no new errors after normalizing source-line shifts |
| Live generation | 3/3 HTTP calls pass; 3 unique valid challenges per session, 9 sentences total, 8 distinct across sessions |
| G1 required fields | PASS on all 9 challenges |
| G2 flat reconstruction | N/A; single sentence field, no nested generated arrays |
| G3 mode differentiation | N/A at birth; one task identity |
| G4 answer derivability | PASS; printed text is the reference, indexes derive only from equal-length aligned transcripts |
| G5 fallback quality | PASS; no content fallback; incomplete/uncertain audio abstains |
| Live audio judge | 6/6 adult synthetic audio cases: accurate, ride/rode substitution, synonym, homophone, incomplete, silence |
| Real-audio evidence classification | 5/5 worked outcomes using the live judge results |
| Browser | Real capture engine with a synthetic WAV microphone, live HTTP judging, recording playback, hidden first verdict, fresh-round reset, one local ledger, zero adaptive writes; desktop and narrow screenshots |
| Curriculum fit | MATCH at grade 2: `LA001-05-c`, Reading Fluency / self-correction; cosine 0.8034, coherence 4/5 |

The generic eval endpoint skips catalog-mode validation at L0 (`catalogMeta: null`, reported challengeCount 0). The actual `fullData.challenges` arrays were inspected and contain three items each. No eval-mode ladder was invented to make that endpoint count them.

## Confirmed findings repaired

- Parent renderer callbacks can send scores independently of `localOnly`. Registry and catalog advertise `supportsEvaluation: false`; injected `data.onEvaluationSubmit` is discarded. The explicit **top-level** observer callback is for local tester inspection. No provisional score enters the adaptive submission path.
- A live browser rerun heard **walked** in synthetic **walk** audio, with both blind transcriptions agreeing. Short `s/es/ed/d` inflection differences now abstain. This is evidence that recognizer agreement is insufficient for a validated assessment, not permission to trust other cases as mastery.
- The narrow tester's fixed sidebar crushed the primitive. Its layout now stacks at narrow widths and preserves a minimum-width-safe content column.
- A looping synthetic microphone initially provided repeated speech rather than one turn. The fixture now includes a 2.5-second pause. This was a test-device correction, not a learner-score change.

## Assessment boundary

**This is not a calibrated self-correction mastery assessment.** Two calls use the same model and can share an error. Child voices, accents, noisy rooms and real reading partners have not been validated. Insertions, omissions, restarts within a recording, unclear/incomplete speech, known homophones and short inflection ambiguities abstain. A recording window ends after 1.8 seconds of silence or 15 seconds total; a slow interrupted reading can remain unassessable. A child may continue with a reading partner and no score.

Numeric metrics describe provisional checked word reading, with an explicit assessable denominator and separate independent repair rate (`null` without observed opportunities). They are local-only and never constitute a mastery award. Raw recordings are held in browser object URLs for replay and revoked on round/session cleanup; the evidence ledger has transcripts and actions, not stored audio. Reflection is learner report, not proof of strategy use.

## Evidence and reproduction

Artifacts: `artifacts/literacy-grade2-design/reading-repair-generation-{1,2,3}.json`, `reading-repair-audio-results.json`, `reading-repair-browser-results.json`, `reading-repair-browser-{first,review,summary,narrow}.png`, `reading-repair-curriculum.json`, `reading-repair-tsc-{before,after}.txt`.

From `my-tutoring-app`: run the four `readingRepairEvidence`, `ReadingRepairStudio`, `gemini-reading-repair-studio`, and `useVoiceCapture.reading` Vitest files. `scripts/reading-repair-audio-fixtures.ps1` creates synthetic WAVs; `node scripts/probe-reading-repair-audio.mjs` calls the real judge. `node scripts/probe-reading-repair-browser.cjs <playwright-package-path>` drives the tester using a saved real generation response and live audio judgments. The browser fixture is confined to the probe; the tester always renders generator data.

## Files

New runtime: `ReadingRepairStudio.tsx`, `readingRepairEvidence.ts`, `gemini-reading-repair-studio.ts`, `reading-repair-judge.ts`, `app/api/lumina/reading-repair-judge/route.ts`.

Registration/integration: `types.ts`, `config/primitiveRegistry.tsx`, `service/registry/generators/literacyGenerators.ts`, `service/manifest/catalog/literacy.ts`, `evaluation/types.ts`, `evaluation/index.ts`, `components/LanguageArtsPrimitivesTester.tsx`, `hooks/useVoiceCapture.ts` (optional connected-reading timing parameters; existing defaults preserved).

Tests/probes: four focused test files above and the three scripts. Handoff: this report, the curriculum-fit report, the birth certificate, and the EVAL_TRACKER dashboard row.
