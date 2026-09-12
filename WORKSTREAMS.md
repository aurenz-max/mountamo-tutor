# Workstreams — Portfolio Index

Start here for "what's next?", then pull the top item of an ACTIVE stream's queue.
**Queues are authority over this file; this file over memory.**

## ⚖️ Rules

This file holds **state** — not findings, evidence, or reasoning. Run the three gates
before you finish:

```bash
wc -c < WORKSTREAMS.md                                            # ≤ 10000 BYTES
awk 'length>400 && /^\|/ {print FNR": "length}' WORKSTREAMS.md    # empty (whole LINE, bytes)
grep -c '^> ### ' WORKSTREAMS.md                                  # 0 — /pm edits rows, never appends
```

It was split three times in four days and regrew each time — because findings were written
here instead of where their reader acts. Decide the home at WRITE time:

| The finding… | Home |
|---|---|
| changes how the next slice is **DONE** | the executor skill (`/add-di-loop`, `/reader-fit`, …) |
| is true about **ONE primitive** | `docs/contracts/<id>.md` |
| is a **defect CLASS** | its own queue item |
| is **evidence of a run** | `qa/tutor-reports/`, `qa/<lane>/` |
| is **state** (lane, health, next pull) | **here — as a row** |

**States:** ACTIVE = worked now · DELEGATED = another session holds it, read its report
first · PARKED = idle, queue trusted only as of its date · BLOCKED = named dependency.
Prior snapshots and the reasoning behind past calls: `git log -p WORKSTREAMS.md`.

## Portfolio — as of 2026-09-04

**WIP 2 ACTIVE + 1.** Judged-loop ports are ONE stream (`/add-di-loop`, queue
`qa/di/BACKLOG.md`); science / math / picture-vocabulary are its items, not rival lanes.

| Lane | State | Pull now | As of |
|---|---|---|---|
| 🚀 **PROD / `main`** | ✅ **LEVEL at `41fbce0a`** | Shipped 09-04 in **10 slices**: item 31, DI-GREET-1, ports 23/24/25, `di-dice-roll` L0→L5, Lesson Bench, counting-board `config.count`, fast-fact phases, queues. Every commit typechecked STANDALONE in a worktree. **Owed: mic sittings #125–#130** — `di-dice-roll` reached `main` with NO live drive. | 09-04 |
| 🔝 **JUDGED-LOOP PORTS** | **ACTIVE** — `qa/di/BACKLOG.md` | Shipped: 18 math port, 31, **34**, **36 ✅ 09-07** (`explain_concept` — `concept_statement` BENCHED 0/32 false affirms, paraphrase 8/8; 6/6 fresh explain objectives `SUFFICIENT` when the block ships; `DI_PORTS` adapter closes #137's no-drive; mic #139; residual = fresh-draw yield ~60%, queued). Open: **33** `poetry-lab[rhyme_hunt]`; 30 owns 2 cap WARNs (+ a third witness: the ten-rod sitting's off-script drift). **35 RETRACTED**. **40 ✅ 09-12** — `syllable-clapper` three ACTS (`blend_syllables` β1.5 · `count_parts` β2.5 · `delete_compound` β3.5) where there were three word LENGTHS; length moved to the tier, `metrics.evalMode` fixed (attempts had all filed as `'default'`). First literacy adopter of `diModeContract`. 6 drives PASS, 0 HIGH; the live probe renamed the deletion mode and bought a positive compound oracle. Owed: mic row for `short_spoken_word` on multisyllable answers, `/curriculum-fit`. **Next = `gas-laws-simulator` · `ph-explorer`.** | 09-12 |
| ↳ 🧮 **DI for older learners** | **3 of 7 SHIPPED**, uncommitted | Items **37** `di-worked-procedure` · **38** `di-deduction` · **39** `di-word-problem-setup` (09-10, first HANDS+VOICE math pack; bench zero false affirms; mic **#149**; **G3 = curriculum gap**, user ruling owed). Evidence in `qa/di/BACKLOG.md`. **Next = the three class sittings, then `di-mental-chain`.** | 09-10 |
| ? **math ports** | same stream | `number-sequencer` DI implemented 09-11 (six modes; mic #150/#63). Evidence: item 18 and `qa/number-sequencer-di/REPORT.md`. `3d-shape-explorer` mic #131; `place-value-chart` #113/#63; `sorting-station` post-port reader-fit still owed. | 09-11 |
| ↳ **picture-vocabulary** | ✅ **g7+g8 PASS — item 26 CLOSED 09-02** | `same-category` **0/8 → 7/7 hard**, 46/48, zero false affirms/refusals. Took **4 levers not 3**; blunt precedence REJECTED (refused the generated partner). Item 27 confirmed live — `--di-bench-item` runs go **in parallel** (~6h → ~1.5h). Only **mic #118** left. **TU-6 fired live, INTERMITTENT.** | 09-02 |
| 📊 **Coverage campaign (200)** | **ACTIVE** | `fast-fact` L1 **CLOSED 09-02**: FF-4 + FF-5 struck. The `apply` bleed was not in the mode docs — an unconditional block handed back `'recall'` six lines under "generate ONLY apply". Prompt-only fix, 110 challenges clean. [report](my-tutoring-app/qa/eval-reports/fast-fact-2026-09-02.md). **Pull = the phase-enum trio.** | 09-02 |
| **Curriculum fit atlas** | **ACTIVE — refreshed** | 12 themes, **4 built**: `letter-workshop`, `you-and-me`, `story-bridge`, `story-ribbon` L0–L5. DSP-4, DSP-5, and PV-3 **CLOSED 09-09**. PV-3: shared picture gate; 2 association + 5 sibling runs pass. Pull: `k-grammar-completion` via `/add-eval-modes`. Human acceptance #143–#146. | 09-09 |
| **K Math fit atlas** | **ACTIVE** — slice 3 closed, slice 7 part-closed | Slices 1-6 CLOSED 09-08. **CB-5 CLOSED 09-09**: compare_groups pools inside the range the objective names (shared `resolveScopeRange`, band = outer ceiling); A/MEAS draws 1-5, B draws 6-10, 5/5 distinct with an equal case. **Slice 7, 09-09**: 26 rows unblocked — bar-model K one-to-one (4 modes, 9 rows), counting-board counting-out family + count_on covered at K (5 modes, 5 rows), **measure-lab BORN** (pan balance + pour-to-fill, 4 modes, 4 rows), analog-clock K parts (3 modes, 3 rows), length-lab estimate/two-unit + body-part units (2 modes, 3 rows), shape-sorter real-object stimulus (2 rows), and both no-code catalog refreshes. Every mode probed live through its oracle and driven in headless Chrome. **Slice 3 CLOSED 09-09**: strategy-picker now resolves the objective number window (K "within 10" → maxNumber 10, sums 6-10 in both guided draws; control still 5); the resolver is shared with addition-subtraction-scene at `service/objectiveNumberWindow.ts`, probe 12/12. Residual SPK-2 in EVAL_TRACKER: the K strategy MENU still withholds make-ten and doubles. **`k-band-floor-reaudit` CLOSED 09-09** — the two floors that HELD on 09-08 now have K-reachable modes instead of a re-audit, and both redirects the review had named were probed first and neither carried its objective: `missing_part` gave ten unknown-addend turns with no subtraction in them, and `analog-clock / read` has no sequence while `sequence-5` bans clock times at K by design. Built `number-bond / related_fact` (β 3.0, spoken: one bond, two judged turns, and turn 2's known part is the number the child produced on turn 1 — so a symmetric bond is DROPPED, both turns would otherwise share an answer) and `time-sequencer / clock-sequence` (β 3.5, K: order activity cards each carrying an analog FACE at a whole hour; four code-owned drop gates because the face is the only cue and a cue that lies is worse than none). 18/18 + 8/8 draws, 9/9 Chrome drive, 3 rows partial → candidate (atlas 137 → 140). [report](my-tutoring-app/qa/eval-reports/k-held-floors-2026-09-09.md). Owed: a live mic drive of the bond loop and `/eval-test` on both modes. **`sorting-station-k-draw-quality` CLOSED 09-09**: honours `challengeCount`, variety rounds past 3 come from another set (not a forced axis), count+2 generated so the speakability drop gate trims overage not the lesson, and a label/picture agreement gate now guards the sort family + `two_attributes` (which had none). 2 K draws/mode at count=5 → 5/5; 14/14 unit; contract R11+R12. REMAINING slice 7: `pattern-k-gaps` (code half), `calendar-days-k`, `count-to-100-k`, `picture-thermometer`, `physical-observation`. | 09-09 |
| **Lesson Bench** | **PAUSED by user request** | Manifest self-evaluation, coverage-judge iteration, and synthetic lesson journeys paused. `/lesson-coverage` and `/lesson-journey` retired. Evidence and residuals retained in `qa/lesson-bench/BACKLOG.md`; no automatic pulls or re-judge gates. Independent primitive work continues in its owning queue. | 09-07 |
| 🏛️ **History suite (C3)** | **ACTIVE** — item 29 | `cause-effect-chain` **PORT 25 SHIPPED 09-03**: yes/no per card (spoken), chain built by HANDS on a stillness close, root pick spoken. Drives identify 10/10 · hands 5/5 · pick 5/5; tsc at baseline; mic **#130**. `era-explorer` port 24 (mic **#127**). Queued: G5 3-card chains (`/eval-fix`). **Next birth: `source-detective`.** | 09-03 |
| 🗣️ **TU-6 — tutor speaks state** | **unowned** — evidence in di item 32 | **CLASS, not a primitive bug.** `[CURRENT STATE]` read aloud 3/3 + 3/3 (08-23). **09-04, lesson END: the tutor FABRICATED a `[PRIMITIVE SWITCH]` and read it with NO text sent** — phantom mic turns + a switch held forever. Prompt-only bans lose. **Needs a non-voiceable channel + di item 32 (a).** | 09-04 |
| 🎙️ **Human-check queue** | **99 open** — only the user closes these | Mic **#100**–**#108**, **#110**–**#118**, **#123**, **#126**–**#131**, **#133**, **#134**, **#137 NEW** (`compare_choice` menu). Non-mic **#109**, **#119**, **#120**, **#122**, **#124**, **#125**, **#132**, **#135**, **#136** (a RULING). **#121** part-superseded by #127. **#63** BLOCKS code; **#90**. Next **#138**. | 09-06 |
| 0. **Science depth** | PARKED (was ACTIVE) | CELL-1 ✅ 08-18. Resume top = **LCS-1**, `/oracle-test` first. DNA-1 ✅ CB-1 ✅; #80 open. `qa/science-depth/`. | 08-18 |
| 1. **Reader-fit sweep** | PARKED — ✅ **UNBLOCKED 08-22** | Item 17's gate (**#77**) is VOID: the 08-19 DI port made all 5 solar-system modes spoken, so the tap-answer template it protected is gone. **The 08-08 template is superseded — do not copy it.** Executor `/add-eval-modes`, 3 primitives, an eval-hook decision. | 08-22 |
| **DI closeout (CTX-2)** | Docs + 1 probe | The excavators run carries the post-fix floor-gate numbers; write the report citing it. Unproven: the **`wedged` watchdog** — a wedged-0 run cannot show it fires. item 15. | 08-10 |
| **`di-spoken-practice`** | SHIPPED, 5 modes | `71cba07` + `ead9ae1` + compare_choice `a5eb7ba` on `main`; **`explain_concept` UNCOMMITTED 09-07** (di item 36). Now DI-drivable (`--di`/`--di-bench`). Open: item 17 (embedded insets), the routing hold, fresh-draw yield (di 36 (1)). | 09-07 |
| 00. **Lesson ordering** | ⛔ **PARKED — top item REJECTED** | B′ killed 08-10 (`32267345`); arms B and C also rejected. **No ordering work left.** Residual is per-primitive content → `/primitive-contract`. | 08-18 |
| **Silent generator fallbacks** | DEMOTED, not a sweep | 33 generators fall back with no retry and no warn; 32 are math. Math DI ports force the same live probe, so it is a checklist a port consults. List in this row's git history. | 08-16 |
| **Support tiers (non-math) · LA K-2 grammar** | PARKED | Batch-3 needs evidence via `/eval-test`; grammar is BLOCKED on a user design ruling. | 08-05 |
| ⚠️ **IMG-1 — tutor blind to images** | PARKED (user: do not push forward) | If resumed, the cheap pedagogy half first: the tutor SAYING it cannot see instead of confabulating. `qa/tutor-reports/lesson-live-2026-08-10-excavators.md`. | 08-10 |
| **Closed, no code owed** | 4 filed | `multiplication-explorer` ✅ `927b754` (gate #90). `Pip` ✅ `997c875`, UNFILED. **Intent contract 174/174 green 08-21** — `sentence-analyzer` was the last generator on the legacy signature; migrated context-native, runtime-probed. `npm test` exits 1 with 0 failing tests (`canvas-confetti` rAF) — rides the next `solar-system-explorer` touch. | 08-21 |
| **Delegated lane** | NONE | — | 08-16 |

## Recorded once, so it is not re-discovered as new

- **Deploy caveats.** `my-tutoring-app/vercel.json` pins **no branch**, so which branch
  production tracks is unconfirmed. `backend/cloudbuild.yaml` deploys Cloud Run
  **`ai-tutor-backend`** (us-east5); the live service is **`mountamo-education`** — the
  backend has not moved. Verified in-file 08-18.
- **`parent/link-student` has no verification** — a literal `# TODO`. NOT a row: the parent
  portal is vestigial and pre-Lumina (user ruling 08-14).
- **Pilot onboarding CLOSED 08-14** (user: onboarding is done). Queue deleted, items 1-3
  retired unbuilt on purpose.

## Standing hygiene

- **Strike the row in the same slice as the event.** The `main` row sold three days of
  phantom ship debt because the fast-forward happened and nothing came back here.
- **Re-grep IDs immediately before filing** — both HUMAN-CHECKS rows (`### #N`, newest at
  the TOP, one list) and queue items (`^### [0-9]`). Concurrent sessions are normal and IDs
  move; 08-21 found `qa/di/BACKLOG.md` carrying two item 25s filed a day apart.
- **A stale doctrine line costs more than a stale status line.** A rule (*"class X is
  BLOCKED"*) gets copied forward and silently changes what is built. When a ruling
  overturns one, grep its prose copies in queues, scripts and docblocks — `tsc` sees none.
- **Commit at the mechanism boundary** — in a shared lane, while you still know which lines
  are yours. Shared files (EVAL_TRACKER, BACKLOG, `run_tutor_live.py`) get their own slice.
- **Every closing session updates the owning queue AND this file's "As of" in the same
  slice**, routing findings per the table above rather than into this file.
