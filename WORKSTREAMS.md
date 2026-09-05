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
| 🔝 **JUDGED-LOOP PORTS** | **ACTIVE** — `qa/di/BACKLOG.md` | **Item 18 math port shipped 09-04:** `3d-shape-explorer`, all 5 modes spoken, 49/49 plain+signature and post-fix cap 0 HIGH (mic **#131**). Item 31 shipped 09-04 (mic #129). Item 30 owns the two cap WARNs. **Next remains `gas-laws-simulator` · `ph-explorer`.** | 09-04 |
| ↳ **math ports** | same stream, queued | `3d-shape-explorer` shipped 09-04: one-item fan-out, code-owned facts/riddles, all answer controls removed; mic **#131**. `place-value-chart` #113 remains the #63 material; `sorting-station` still owes a **post-port** `/reader-fit` (its 07-15 PRE verdict stands for the reading axis — the port only removed demand — and it was tagged `reader: 'none'` on that basis 09-05; the re-audit is about the ported surface). Item 18 names no next math primitive yet. | 09-04 |
| ↳ **picture-vocabulary** | ✅ **g7+g8 PASS — item 26 CLOSED 09-02** | `same-category` **0/8 → 7/7 hard**, 46/48, zero false affirms/refusals. Took **4 levers not 3**; blunt precedence REJECTED (refused the generated partner). Item 27 confirmed live — `--di-bench-item` runs go **in parallel** (~6h → ~1.5h). Only **mic #118** left. **TU-6 fired live, INTERMITTENT.** | 09-02 |
| 📊 **Coverage campaign (200)** | **ACTIVE** | `fast-fact` L1 **CLOSED 09-02**: FF-4 + FF-5 struck. The `apply` bleed was not in the mode docs — an unconditional block handed back `'recall'` six lines under "generate ONLY apply". Prompt-only fix, 110 challenges clean. [report](my-tutoring-app/qa/eval-reports/fast-fact-2026-09-02.md). **Pull = the phase-enum trio.** | 09-02 |
| 🧪 **Lesson Bench** | **ACTIVE**, `qa/lesson-bench/BACKLOG.md` | **Item 13 full-registry sweep 09-05 PM:** `/add-affordances` finished the catalog — the remaining 163 primitives tagged in one pass via ten domain-parallel agents, `affordance-coverage.mjs` now reads **201/201, 0 untagged**. Gates: consistency test 10/10, typecheck 802 = baseline (0 new). No A/B run yet at this scale (item 13's gate was only proven to 29/201) — **item 18 queues one `--runs 3` sanity A/B** before trusting the tags broadly. **Item 17 (journey) 09-05 PM:** first closed loop on phonics-starter — generators now READ the objective (group, named set, `count`, cold-assess tier; stops reported as `unaskableLetters`); phonics-1 BLOCKED → INSUFFICIENT_EVIDENCE 18/18, 0 out-of-scope; 5 extractor adapters + `--waive-prerequisites` audit: all 54 runs INSUFFICIENT (0 BLOCKED, 0-1 unknown blocks). Viewer = every run's `.html` (artifact `3e84064c`). **Item 19 SHIPPED 09-05 PM:** objective-coverage eval, SHADOW, every `build-stream` lesson → `qa/lesson-coverage/evals.jsonl`; live 6/6; phonics-1 drive flagged t/p unassessed + `content_guard` unaided. **Pull = 19(a) calibrate vs hand labels**, then 18, 17(a). **#125** open. | 09-05 |
| 🏛️ **History suite (C3)** | **ACTIVE** — item 29 | `cause-effect-chain` **PORT 25 SHIPPED 09-03**: yes/no per card (spoken), chain built by HANDS on a stillness close, root pick spoken. Drives identify 10/10 · hands 5/5 · pick 5/5; tsc at baseline; mic **#130**. `era-explorer` port 24 (mic **#127**). Queued: G5 3-card chains (`/eval-fix`). **Next birth: `source-detective`.** | 09-03 |
| 🗣️ **TU-6 — tutor speaks state** | **unowned** — evidence in di item 32 | **CLASS, not a primitive bug.** `[CURRENT STATE]` read aloud 3/3 + 3/3 (08-23). **09-04, lesson END: the tutor FABRICATED a `[PRIMITIVE SWITCH]` and read it with NO text sent** — phantom mic turns + a switch held forever. Prompt-only bans lose. **Needs a non-voiceable channel + di item 32 (a).** | 09-04 |
| 🎙️ **Human-check queue** | **94 open** — only the user closes these | Mic **#100**–**#108**, **#110**–**#118**, **#123**, **#126**–**#131** (#128 + #129 = ONE lesson-bench sitting, `…pgr5`; #131 = 3d shapes). Non-mic **#109**, **#119**, **#120**, **#122**, **#124**, **#125**. **#121 PARTLY SUPERSEDED** by #127. **#63** BLOCKS code; **#90**. Next free **#132**. | 09-04 |
| 0. **Science depth** | PARKED (was ACTIVE) | CELL-1 ✅ 08-18. Resume top = **LCS-1**, `/oracle-test` first. DNA-1 ✅ CB-1 ✅; #80 open. `qa/science-depth/`. | 08-18 |
| 1. **Reader-fit sweep** | PARKED — ✅ **UNBLOCKED 08-22** | Item 17's gate (**#77**) is VOID: the 08-19 DI port made all 5 solar-system modes spoken, so the tap-answer template it protected is gone. **The 08-08 template is superseded — do not copy it.** Executor `/add-eval-modes`, 3 primitives, an eval-hook decision. | 08-22 |
| **DI closeout (CTX-2)** | Docs + 1 probe | The excavators run carries the post-fix floor-gate numbers; write the report citing it. Unproven: the **`wedged` watchdog** — a wedged-0 run cannot show it fires. item 15. | 08-10 |
| **`di-spoken-practice`** | SHIPPED, 2 open | `71cba07` + `ead9ae1` on `main`. Open: item 17 (embedded insets, scoped not started) and the routing hold. | 08-12 |
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
