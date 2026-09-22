# LA-14 S5 — the four DI packs' scripted drills deleted (2026-09-22)

Handoff: [13](../live-runtime-handoffs/13-delete-di-scripted-drills.md). Executor `/add-live-tutor-tools`.
Packs: di-sentence-reading (pilot), di-letter-sounds, di-word-reading, di-math-facts.

## Ratio

Production: 4,572 lines (four `Di*.tsx`, four `di*Script.ts`, four Pip poses) → 266 lines
(four `Di*.tsx` that export the teaching component). Deleted drill-only tests: 1,819 lines.
Added: the unbound card in `DiTeachingStage` (~20 lines), the DI tester host wiring (~25),
a per-domain pool cap (~10), a step-0 probe script, a sentence JEV case set.

## Step 0 — is the multi-objective blocker reachable?

`scripts/di-drill-unbind-probe.mjs` re-flattens each lesson's manifest with today's
`flattenManifestToLayout`, assembles it, and runs `lessonWorkspaceItems`.

| Set | Lessons | Pack sections | Bound | Content sections with ≠1 objective |
|---|---|---|---|---|
| Saved packages (every `qa/**` lesson package) | 73 | 36 | 34 → **36** after the fix below | 0 |
| Fresh (six K–1 literacy/math topics, generated today) | 6 | 8 | 8 | 0 |

The only multi-objective items are the curator brief and the final assessment
(`knowledge-check` in all 79). **The blocker is unreachable.** Raw output:
`2026-09-22-di-drill-unbind-probe-saved.json`, `…-fresh.json`, fresh packages in
`di-drill-unbind-packages/`.

**The real unbind cause:** both unbound sections were `letter_sound_review` pools of 13 and 19
items. The generator fills a named review set up to `SET_COVERAGE_CAP = 20`; the shared
`validateChallengePool` capped every pool at 12, so the section silently fell back to the drill.
One of today's fresh lessons produced a 13-item pool too. Fix: `validateChallengePool` takes a
per-domain maximum; `DI_LETTER_SOUNDS_MAX_ITEMS = 20` lives in the domain and both the generator
and the adapter read it. The other three generators cap at 6–10.

Other unbind paths (no pin, pin outside the catalog, `validate` throws, no challenges, caregiver
audience) now show a visible state instead of a silent drill: `DiTeachingStage` renders
"This activity needs the tutor…" (`data-di-unbound`) and logs the pin in development.

## What changed

- `Di{LetterSounds,WordReading,MathFacts,SentenceReading}.tsx`: data/props types + the teaching
  component. No `withTeachingWorkspace`, no `Scripted*`.
- Deleted: the four `di*Script.ts`, their `*Script.support-tiers.test.ts`, `diCorrectionContrast.test.ts`,
  `DiMathFacts.{lesson-arm,misconception-evidence,reward-beat}.test.tsx`, the four Pip poses and
  their surface tests.
- Consumers repointed to the domains: generators and their tests, `knowledgeCheckScript`,
  `decodableReader/readAloudStudio/wordWorkoutScript` + tests, `lessonBench/journey/extract.ts`
  (the ask and support tier replace the deleted cue builders; word reading stays modelled+guided,
  as the drill always was), `scripts/lesson-journey.mjs` source hashes.
- Assertions that tested domain facts moved: name-numeral's no-counting-route and different-number
  rules now test `diMathFactsDomain`'s assignment and scene facts.
- `DiLessonIsolation.test.tsx`: now proves an unbound sentence pack takes no voice-turn
  subscription, sends no cue and leaves the CVC drill on its item.
- DI tester: the four packs mount in a one-item `PulseWorkspace` host, pinned to the generated mode.
- `DI_PORTS`: none of the four had an entry. Nothing to retire.

## Verification

- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- Lumina vitest: 7097 passed / 1 failed / 10 skipped. The failure is
  `PulseActivityRenderer.workspace.test.tsx` "…content that is not the pinned mode" on
  counting-board. It expects the mode/content gate that pre-session uncommitted work deleted
  (`modeContentGate.ts`). Not touched here.
- **Sentence reading, first real probes:**
  - Learner intent `--sentences`: 36/39, **0 false help/stop**. Miss: "hard" (a help request)
    read as an answer attempt 3/3. `di-sentence-reading-learner-intent-2026-09-22.json`.
  - JEV `--sentences` (new case set, built from the domain): 26/36. **0 unearned credit**
    (skipped word, swapped word, partial praise, tutor's own model all refused). All 10 misses are
    under-credit: `noisy`/`slow_read` 3/3 abstain, `open_question` 3/3, `wrong_then_corrected` 1/3.
    This is LA-13's sub-threshold-affirmation shape, now in a seventh domain.
    `di-sentence-reading-jev-2026-09-22.json`.
- **Connected `--lesson-entry --audio` journeys** (session-only by harness design; submission is
  covered by the mounted teaching tests):

| Pack | Runs | Failures |
|---|---|---|
| di-sentence-reading | **3/3** | — (one requested demonstration committed visibly before narration) |
| di-math-facts | **3/3** | — |
| di-word-reading | 1/3, rerun **3/3** | tutor spoke a meta line ("*The above response complies…") → protocol-leak assertion; tutor silent after `[LESSON_START]` → timeout |
| di-letter-sounds | 1/3, rerun 1/3 | 3 runs: synthetic "sss" transcribed "S", tutor corrects it as the letter name and loops to timeout; 1 run: observer abstained on "Great job, you made the mmm sound just right" (LA-13) |

  Letter sounds' failures are the synthetic-audio phoneme limit and LA-13, neither touched by
  this slice (its workspace path is unchanged apart from the pool cap, which these ≤12-item
  payloads never reach).
- DI tester in the real app (headless Chromium, signed in): all four packs render bound, with the
  stimulus, counter and connected tutor face; no unbound card. Screenshots:
  `di-tester-workspace-2026-09-22/`.

## Not verified

- Human browser/microphone sitting for a lesson and a Pulse item: HUMAN-CHECKS #167.
- A live evaluation submission (the lesson-entry harness asserts `submissions == 0`).

## Residuals (queued)

- LA-13 shared criterion: seven domains now; next pull in this stream (`/add-live-tutor-tools`).
- Pip on the four packs: lived in the drill; queued once on `DiTeachingStage`
  (`qa/pip-surface/ROLLOUT.md`, `/add-pip-surface`).
- Math facts' Tier-A misconception packet and silent response timing are not produced on the
  workspace path (`qa/di/BACKLOG.md` item 18, `/add-misconception-loop`).
- The four packs' catalog tutoring blocks still describe the scripted cues; bound sections send
  `tutoring: null`, so nothing reads them. Remove with the catalog tidy-up of S4.
