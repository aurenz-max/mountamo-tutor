# LA-15 D0: detour pedagogy bench (2026-09-26)

**Question:** when a live tutor asks for a new activity for a stuck student, does the activity address the student's obstacle?
**Harness:** `scripts/detour-bench.mjs --run`. It covers 10 stuck-learner scenarios: K–5, math, literacy and science. Each scenario has a parent primitive, an obstacle, evidence and a purpose. A judge (`gemini-flash-latest`) scores each pick together with its generated content, without knowing which arm produced it. Each score is 0–2. **n = 1 per scenario per arm**, so single rows are noisy.

## Arms
- **sandbox** — today's `request_activity`. The tutor model picks `primitiveId` and `mode` from the 63 live-adapter families, and generation runs at `'easy'`.
- **resolver v0** — one call over the curator's catalog view, then `resolveLessonEvalModes`.
- **resolver v1** (`service/manifest/resolveDetour.ts`) has two stages. First it shortlists up to 4 primitives from the curator's catalog view. Then it picks ONE primitive and ONE mode from the shortlist's mode cards, judged against the obstacle.

## Results

| | targets obstacle | easier / prerequisite | different representation | in scope | content usable | leaks | median ready |
|---|---|---|---|---|---|---|---|
| sandbox (v0 run) | 1.0 | 1.5 | 1.1 | 1.6 | 1.6 | 0 | — |
| sandbox (v1 run) | 0.7 | 1.2 | 1.1 | 1.5 | 1.4 | 0 | 3.4 s |
| resolver v0 | 1.7 | 1.6 | 1.9 | 2.0 | 1.5 | 0 | — |
| resolver v1 | 1.7 | 1.5 | 1.6 | 1.8 | 1.5 | 1 | 6.1 s |

Raw rows: `v0-curator-view/results.md`, `v1-two-stage/results.md`. Per-run JSON (pick, intent, content, judgement) is in `*/runs/`.

## Findings
1. **Tutor-picked detours do not address the obstacle.** The sandbox mostly re-serves the parent's own primitive, or a sibling adapter doing the same task (for example `place-value-chart` for a place-value comparison). It scored 0 on "targets obstacle" in 3–5 of 10 scenarios. A catalog-wide pick made from the stated need does much better.
2. **The picker must see modes.** v0 chose `fraction-circles` for fraction addition, but no mode of that primitive combines parts, so the generator produced "shade 1/2" tasks. The lesson mode resolver also returned blends for 2 of 10 targeted detours, because it sees an objective and not the obstacle. v1 fixes both. Every v1 pick is a single valid mode, or a primitive that has no modes.
3. **Generator defect: `number-line` drops a fractions intent.** v1 picked `number-line` in `jump` mode, with an intent that asks for unit-fraction jumps. The generator produced integer jumps (7 + 3). → `/eval-fix number-line`.
4. **Some primitives are too slow to generate for a live detour.** `annotated-example` took about 130 s in both runs, and `custom-visual` took 57–65 s and came back truncated. This needs a runtime generation deadline with a fallback to the next shortlisted primitive. Do not ban these primitives: they are the best pick for some obstacles (the worked comparison for place value).
5. **Answer leak (1 of 10).** Skip-counting content for the clock scenario included the 15→20 jump the student needs. The intent asked for the answer to be avoided; the generator ignored it.

## Not yet shown
- Whether a real child benefits. The judge is a model; no sitting has been run.
- Anything about lesson wiring (D2) or the tutor's own phrasing of the need. The scenarios hand the resolver clean obstacle text.

## Composed demonstrations (pilot, same day)

**Arm `demo`** — `components/live-activity/demo/demoContract.ts` + `service/manifest/composeDemonstration.ts`.
- The detour is ONE teaching move drawn on ONE of three pieces: number line (hops, whole or unit-fraction), place-value columns (compare, make-a-ten) and clock face (minutes from a numeral).
- The model writes a flat script: piece, operation, example values, and the student's own values.
- Code refuses a script that is the student's own problem or has the same answer. It then builds every frame and caption.
- `none` falls back to the resolver.

| | targets obstacle | easier | different repr. | in scope | usable | leaks | ready (median / max) |
|---|---|---|---|---|---|---|---|
| resolver v1 (rerun) | 1.5 | 1.2 | 1.6 | 1.6 | 1.4 | 0 | 5.8 s / 183 s |
| demo, drawable scenarios (5 × 3 reps) | **2.0** | **2.0** | 1.1 | **2.0** | **2.0** | 0 | **1.3 s / 2.9 s** |
| demo + resolver fallback (10) | 2.0 | 1.7 | 1.5 | 2.0 | 1.8 | 0 | 5.2 s / 70 s |

- **Coverage:** 5 of 10 scenarios composed in 15/15 runs (fraction add, subtraction hops, regroup, compare digits, clock). The other 5 declined in 15/15 runs with a correct reason: K counting, multiplication groups, CVC blend, main idea, particles.
- **Differentiation:** "different representation" scores 1.1 because a process demo reuses the parent's own model. LA-12 allows that for `model-process`, so this rubric item does not apply to demos.
- **Defects found on reading the frames, both fixed and unit-tested:**
  - A commuted example leaked the answer (1/5 + 2/5 for the student's 2/5 + 1/5). The refusal now also rejects an example with the same answer.
  - The fraction demo carried the subtraction-hops caption.
- **The judge missed both defects.** Read frames yourself; do not rely on the judge score alone.

**Not shown yet:** nothing is rendered. The judge read captions and view JSON. The pieces need renderers, a mounted host drive, and a child sitting before anyone can claim more than this.

**Next pieces, in the order the uncovered scenarios ask for them:**
- counters in equal groups (multiplication) and a one-to-one tagging row (K counting). LA-12's counter shapes already draw these.
- sound tiles with a blend sweep (CVC).
- a text passage with the main idea and a detail highlighted.
- a particle box (science). This one needs motion, so it should be judged separately.

## Renderers (same day)

- **`demo/DemonstrationView.tsx`** draws the three pieces one frame at a time with Back and Next step. The pieces are SVG for the number line and the clock, and a column grid for place value.
- **In the returnable shell:** `SupportArtifact` has a new kind, `demonstration`. The shell's card is now `SupportArtifactCard`, so a detour and a preview draw the same card.
- **Preview:** the five bench scripts are in `/lumina/live-activity/runtime` → Composed demonstrations.
- **Gates:** live-activity tests 860/860, including 7 new render tests that step each fixture and check the hop count and clock labels against the captions. `typecheck:lumina` 0.
- **Headless Chromium, 28 frames at 1280 and 390 px:** no page errors and no horizontal scroll. The screenshots showed four defects, all fixed and reshot:
  - clock minute labels clipped outside the face;
  - the clock caption "counting to the 3: 15 minutes" read as the time 3:15;
  - place-value columns overflowed on a phone (short headers Th/H/T/O now below `sm`);
  - number-line labels unreadable on a phone.
- **Not yet:** the runtime cannot open a demonstration as a detour. That is D2: a tool call leads to `composeDemonstration`, then suspend, show, and return. Human glance: HUMAN-CHECKS #169.

## D2 — demonstrations in ordinary lessons (same day)

**Path:**
1. The tutor calls `request_demonstration { obstacle, evidence, purpose }`.
2. The backend relays it with the item scope (`live_runtime_tools.py`, lesson sessions only, `demonstrations: true` in `runtime_lesson`).
3. `RuntimeTransport.requestDemonstration` refuses early if it can.
4. `POST /api/lumina/demonstration` authors the demonstration (`composeDemonstration`).
5. `LiveLessonRuntime.openDemonstration` pauses the item and shows the demonstration in the shared card.
6. The tutor narrates it and uses the advertised `return`.

**Where it runs:**
- **Scope:** any lesson section bound to the teaching workspace. There is no per-primitive code; the only requirement is that the adapter can pause, which every `useTeachingWorkspace` binding can.
- **Recording:** each demonstration is recorded as assistance on the item, never as an attempt.
- **Limit:** one detour per item.
- **Hosts:** Pulse and the sandbox leave it off.

**Checks:**
- **Frontend:** 6 new runtime and transport tests, and live-activity 880/880 before the concurrent equation-builder edits.
- **Backend:** `tests/tutor_live` 70/70, including a new relay test.
- **Types:** `typecheck:lumina` 0; full `tsc` 770, which equals the baseline.

**Real model, number-line `jump`, `run_live_runtime.py --lesson-entry --demonstration`:**
- **Journey:** a wrong answer, then "I don't get it. Can you show me how it works?", then return and a correct answer.
- **Results:**
  - Five journeys reached the demonstration.
  - In 5/5 the tutor called `request_demonstration` on the first plain request, and the demonstration reached the screen in 1.2–3.0 s after the call.
  - In 5/5 the tutor narrated the frames with the actual numbers in one turn and returned through the advertised action to the same item.
  - 4/5 finished with a correct answer.
  - The fifth ended on a harness gap: after a question-reply, the closed item needed the shell's Try again. That is fixed, and the next 2/2 passed.
  - Two further runs died on ws 1012, a uvicorn reload triggered by my own harness edits.
- **Evidence:** `d2-number-line-run1.json`, `d2-number-line-runs2-3.json`, `d2-number-line-x3.json`.

**Findings from the transcripts:**
1. **The tutor's diagnosis is weak.** Only 2/5 obstacles named the actual mistake ("jumps to the starting number instead of jumping backward"). The rest were topic-level ("how to hop backwards"). `evidence` was the learner's words ("asks to see how it works") in 3/5, not the wrong answer the packet showed (`learnerWork: Landed the jumps at 3`). The author still drew the right demonstration each time, because it reads the current task.
   - Next: have the host pass the item's `learnerWork` to the author beside the tutor's words, rather than more prompt text.
2. **Near-duplicate demonstrations for one-hop items.** A single-hop item gets a single-hop demonstration from a neighbouring number, for example 4→3 for the student's 3→2. It is correct and does not leak the answer, but it is close to the task itself.
3. **Return lines are thin.** "You've got this!" re-asked nothing. The item was still on screen, so it is not a stall.

**Not shown:**
- A browser or microphone sitting in a real lesson. This run used a JSDOM paint and text answers. See HUMAN-CHECKS #170.
- Any primitive other than number-line.
- The resolver fallback, where "none" mounts a full primitive. It is still to build; today "none" means the tutor teaches in words.

**Follow-up, same day:** the author now reads the learner's last checked answer (`workspace.lastResponse`, which every binding publishes) beside the tutor's words.

- **Change:** the lesson host, the driver and the route send `lastAnswer`. The author diagnoses from the actual answer when the tutor's words only name the topic.
- **Re-drive, `d2-number-line-lastanswer-x3.json`:**
  - 2 of 3 journeys opened, narrated and returned, then finished correct.
  - In both, the demonstration for the four-hop item 6 − 4 was a different three-hop example, 7 − 3 = 4, rather than a neighbouring single hop.
  - The third timed out before any detour: the tutor never spoke its lesson opening, which is a session-start failure unrelated to this path.
- **Tutor wording:** its `obstacle` was specific in 1 of 2 runs ("counts the starting number as the first hop"). The author no longer depends on it.
