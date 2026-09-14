# Birth Certificate — reading-repair-studio (2026-09-13)

**Lifecycle: L0 practice implementation plus L1 single-mode routing, L2 tutoring and L5 sound, provisional evidence.** The brief's assessment boundary takes precedence over ordinary birth-time scored routing: catalog/registry `supportsEvaluation` remains false, while multi-instance progress, typed metrics, local evaluation and the tester observer are wired. Independent self-correction mastery is not claimed.

- Core task: `notice_and_repair`; three fresh sentence challenges.
- Generator: fork B, orchestrator-same-mode, independent sentence calls with rejection and deduplication.
- Tutor: three requested checking tips; `[READING_HELP]` speaks only on an explicit `Hear this tip` tap after support is recorded. `[ALL_COMPLETE]` encourages practice after all independent windows close. Routine rounds stay quiet. Active text and hidden verdicts never enter its context. Shared tutor speech is conservatively counted as support.
- Sound: neutral word mark/unmark and optional reflection cues. Shared capture and navigation own their existing sounds; no added verdict cue.
- Answer-leak audit: cold print has no preselected/highlighted target, model audio, target placeholder, diagnostic label or initial verdict. Recording playback is the learner's own voice. Help is logged before display. Post-check feedback cannot be undone to reopen independence on the same text.
- Curriculum: MATCH `LA001-05-c` at grade 2 (0.8034; coherence 4/5).
- QA: 30 focused tests; three live generator sessions; six synthetic-audio cases; five real-audio outcome classifications; browser capture/replay/ledger test; no new TypeScript errors. See `reading-repair-studio-2026-09-13.md` for evidence and limitations.
- L2/L5 QA: 39 focused tests, passing Tier 1/2 tutor audit, three complete real Gemini Live journeys with no findings, browser help/reset/sound verification and inspected 390 px layout. See [layer report](../tutor-reports/reading-repair-studio-2026-09-13.md).
- L1 QA: 47 focused tests; seven live routing cases, pinned eval endpoint and real tester session pass. `notice_and_repair` beta 4.5 is a design prior only. See [mode report](reading-repair-studio-evalmodes-2026-09-13.md).

## Design gate

1. Direct manipulation — pass: the child touches the printed words to mark their own revisit plan and controls replay of their own voice.
2. Living process — pass: real captured audio and changing word selections show the read/check/reread process. No physical simulation is appropriate for this reading task.
3. Production — pass: cold oral reading and full-sentence rereading produce the evidence; reflection choices never prove repair.
4. Timer — pass: silent capture bounds and duration metrics only; no countdown, WPM or speed reward.
5. Layout leak — pass: every word begins with identical styling, the first audio verdict stays hidden, and no model reading is supplied.

## Follow-up queue

**Assessment gate before enabling scored routing:** review recordings from real second-grade readers across accents, pauses and noise; check omissions, restarts and short endings; calibrate recognizer uncertainty against independent human annotation. The walk/walked false-miss bench finding demonstrates why two agreeing model calls are insufficient. Preserve accurate-first, independent, supported, unresolved and unassessable channels. Do not turn on adaptive updates merely by adding an eval mode.

| Order | Skill | Layer | Input from this birth |
|---|---|---|---|
| Complete | `/add-eval-modes` | L1 | Single-mode `notice_and_repair` routing and mirrored beta 4.5 prior; explicit pin, auto and mixed verified. Mode metadata does not enable adaptive assessment. Distinct future tasks need actual interactions, not outcome or support-level aliases. |
| Complete | `/add-tutoring-scaffold` | L2 | Twelve safe progress context fields, three requested tips, four observable struggles, two speech tags, quiet independent windows, real three-run live verification. No verdict or printed text supplied. |
| 3 | `/add-support-tiers` | L3 | Candidate aids: explanation of word marking, generic letter/meaning prompts, explicit replay instructions. Withdrawal must preserve accessible replay and micless continuation, and must not erase whether help preceded the reread. |
| 4 | `/add-structural-difficulty` | L4 | After L3: number of clauses, semantic distance of context clues and connected sentence count, bounded by the validated audio window. Do not substitute speed pressure for reading complexity. |
| Complete | `/add-sound` | L5 | Word mark/unmark and optional reflection use neutral shared sounds. Capture owns ready/ack/processing sounds; advancement owns navigation. Browser wiring verified; human listening comfort still owed. |
| 6 | Spoken-audio calibration / `/add-spoken-judge` review | L5 | This is connected reading, not the skill's single-word yes/no task. Keep the generic capture engine; verify child audio and improve alignment/uncertainty before adapting any judge ladder. |
| Every layer | `/eval-test reading-repair-studio` | QA | Re-run generation contracts, worked outcome tests, answer-leak checks and real capture. Verify that provisional evidence cannot reach either EvaluationContext or renderer/Pulse score callbacks. |

Human acceptance still owed: actual second-grade voices and usability; real independent noticing without adult/tutor intervention; supported correction without disguising it as independence; fresh-text transfer. Recorded practice remains useful while these assessment gates are open.

The initial handoff unnecessarily put mode registration behind calibration. L1 is now implemented at the user's request with the local-only boundary intact. L3 support tiers may proceed within this mode, and L4 follows L3; calibration gates adaptive scoring, not these development layers.
