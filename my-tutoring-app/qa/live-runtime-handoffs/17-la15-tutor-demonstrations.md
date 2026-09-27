# Tutor-requested demonstrations in lessons (LA-15)

Date: 2026-09-26 · Owner: roadmap LA-15 (`docs/LIVE_LESSON_ROADMAP.md`) · Executor: `/add-live-tutor-tools`
· Evidence: [report](../tutor-reports/detour-bench-2026-09-26/REPORT.md) · Shipped: `abf31741`, `dddaf8e2`,
`d12f6db4`, `4479f2d8` on `ship/2026-08-10-judged-loop`

## Status

Built, and verified by the bench and by real-model journeys on number-line only. No human browser or microphone sitting yet (HUMAN-CHECKS #169, #170).

When a learner is stuck in an ordinary lesson, the tutor calls `request_demonstration`. The host reads what the learner actually did from the mounted primitive and asks the author to diagnose it. The author returns a short worked demonstration on a different example, and code builds every frame and caption. The lesson pauses the item, shows the demonstration ungraded, and returns to the same item.

It works on any section bound to the teaching workspace, with no per-primitive code.

## User rulings (2026-09-26), do not reopen

1. **Detour work is ungraded.** A fresh parent item checks transfer. No mastery write.
2. **The tutor accepts the host's pick.** There is no shortlist for the tutor. A JEV judge of the pick is queued only if testing shows poor picks.
3. **The tool is global, not per-primitive.** Canonical case: a learner on a harder primitive shows a misconception, and an easier activity targets that specific failure.
4. **A demonstration is built for the example, not a re-wired primitive.** A demonstration is one teaching move on a representation piece taken out of a primitive.
5. **Diagnosis comes from the primitive's evidence, not the tutor's words.** The tutor decides when and narrates. The measured reason: the tutor named the real error in 3 of 7 live requests, while evidence alone matched the full input on the bench.

## How it fits together

```
tutor: request_demonstration { note? }                  backend/app/services/live_runtime_tools.py (lesson sessions with
  -> backend relays with item scope                      runtime_lesson.demonstrations = true; DEMONSTRATION_INSTRUCTION)
  -> browser: transport.requestDemonstration             runtime/runtimeTransport.ts (refuse early, then author, then commit)
       evidence = demonstrationEvidence(snapshot)        demo/demonstrationEvidence.ts (task, values, facts, responses on item)
       POST /api/lumina/demonstration                    src/app/api/lumina/demonstration/route.ts (+ diagnosis log)
         composeDemonstration(lesson, evidence, note)    service/manifest/composeDemonstration.ts (diagnosis + flat script)
         buildDemonstration(script)                      demo/demoContract.ts (pieces, refusals, repairScript, frames)
  -> runtime.openDemonstration(scope, demo, diagnosis)   runtime/LiveLessonRuntime.ts (suspend, one detour per item)
  -> SupportArtifactCard -> DemonstrationView            runtime/LiveRuntimeSurface.tsx, demo/DemonstrationView.tsx
  -> tutor narrates, then the advertised `return`
```

The paths above are under `my-tutoring-app/src/components/lumina/components/live-activity/` unless shown otherwise.

- **Lesson host:** `LessonWorkspace.tsx`. `lessonDemonstrationContext` reads the objective and grade from the manifest layout. `WorkspaceHostProvider` turns demonstrations on only when it is given that context, so Pulse and the sandbox leave them off.
- **Fallback:** the resolver in `service/manifest/resolveDetour.ts` picks a whole primitive and mode from the curator's catalog view plus mode cards. It is built and benched but NOT wired. Today, when no piece fits, the tutor teaches in words.

## Pieces today

- number-line: add and subtract, whole numbers or unit fractions
- place-value: compare, make-a-ten
- clock: minutes-from-numeral

The author answers `none` when none of these draws the step, and the diagnosis still reaches the tutor.

## Commands

```bash
# Pedagogy bench, model-judged. Arms: sandbox, resolver, demo, demo-evidence
cd "<abs>/my-tutoring-app" && node scripts/detour-bench.mjs --run --arms demo-evidence --reps 3 --out qa/tutor-reports/<dir>
# Real-model lesson journey: wrong answer, "can you show me?", detour, return, correct
cd "<abs>" && backend/venv/Scripts/python.exe backend/tests/tutor_live/run_live_runtime.py --primitive number-line \
  --runs 3 --lesson-entry --demonstration --objective "Subtract within 10 by counting back on a number line" --output <json>
# Preview of the five bench demos: /lumina/live-activity/runtime -> Composed demonstrations
# Diagnosis log (dev): my-tutoring-app/logs/demonstrations/<UTC date>.jsonl
```

## Evidence summary

| Measure | Result |
|---|---|
| Today's sandbox `request_activity` pick, "targets the obstacle" | 0.7–1.0 / 2 |
| Resolver: whole primitive + mode | 1.5–1.7 / 2; `annotated-example` ~130 s and `custom-visual` ~60 s to generate |
| Demonstrations, evidence only, 3 reps | 15/15 at 2/2 on the five drawable scenarios; 15/15 correct `none`; 0 leaks; 1.3 s median |
| Real model, number-line | Every journey that reached the request opened, narrated and returned to the same item, including 3 with no tutor diagnosis |
| Gates at `4479f2d8` | `npm test` 8267 passed; `typecheck:lumina` 0; `tests/tutor_live` 70/70 |

## Next, in order

1. **Prerequisite-based fallback.** When the author says `none`, pick an easier activity from the failed eval mode and the curriculum's prerequisite edges, instead of the resolver's LLM shortlist. Then mount it ungraded in the returnable shell. The shell today renders support artifacts only; it needs a slot that renders a generated primitive via `getPrimitive(componentId)` with no evaluation write. Put a generation deadline on it. Read `.claude/skills/student-data-loop/SKILL.md` for where prerequisites live before choosing the source.
2. **More pieces, in the order the uncovered bench scenarios ask for them:**
   - equal-group counters and a one-to-one tagging row (multiplication, K counting). LA-12's counter shapes already draw most of this.
   - sound tiles with a blend (CVC words).
   - a text passage with a main idea and a detail highlighted.
   - a particle box. This one needs motion, so judge it separately.

   Each piece is a view pulled out of an existing primitive, plus its operations in `DEMO_OPERATIONS` and `DEMO_MENU`, plus a builder, plus refusals. Add a bench fixture and a lab preview entry for each.
3. **A second workspace primitive in the harness,** such as `place-value-chart` or `analog-clock`, so the lesson path is proven beyond number-line.
4. **Promotion from the log.** When a diagnosis recurs on a primitive, classify it in code, for example "landed one past the target" means "counted the start". A durable cross-session store is a `/student-data-loop` decision; do not add a writer without it.

## Open questions for the user

- **Should the tutor say the diagnosis aloud?** It narrates the example but rarely links it to the child's mistake ("you counted where you started"). Settle this in sitting #170.
- **Should the author's diagnosis feed the misconception loop or the student record?** Both are out of scope until the user rules.

## Gotchas

- **A backend edit kills a running drive.** Editing any file under `backend/`, including `tests/`, reloads uvicorn and closes the drive with ws 1012. Wait for the reload before driving.
- **Some runs fail at lesson start.** 3 of about 15 drives timed out because the tutor never spoke its lesson opening, before any detour. That is a session-start issue on the Live model, not this path.
- **Large enums break the response schema.** About 200 catalog IDs, or all 255 live modes as an enum, return 400 INVALID_ARGUMENT from `gemini-flash-latest`. Validate IDs after the call instead.
- **Prompt lines did not fix two model behaviours:** naming an ambiguous diagnosis, and avoiding a same-answer example. A schema field (`sameAnswerOtherMistake`) fixed the first, and code (`repairScript`) fixed the second. Prefer schema or code first.
- **Read the frames yourself.** The bench judge missed a commuted-answer leak and a wrong caption. Its score is not enough.
- **Bash heredocs corrupt backslashes.** They turned `\\n` and regex backslashes into real control characters. Write patch scripts to the scratchpad with the Write tool instead.
- **`run_live_runtime.py` and `liveJourneySpec.ts` are shared with rollout sessions.** Stage only your own hunks (`git apply --cached`).
