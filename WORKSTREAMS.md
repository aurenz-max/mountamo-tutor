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

## Portfolio — as of 2026-09-03

**WIP 2 ACTIVE + 1.** Judged-loop ports are ONE stream (`/add-di-loop`, queue
`qa/di/BACKLOG.md`); science / math / picture-vocabulary are its items, not rival lanes.

| Lane | State | Pull now | As of |
|---|---|---|---|
| 🚀 **PROD / `main`** | ✅ **LEVEL at `f8bcae52`** | Shipped 09-02: the 47-file tree went out in **5 slices** — di-bench item 27 (`d9264313`), `era-explorer` L0→L4 (`096c6c4b`), `formula-lab` L0→L3 (`57e49801`), `fast-fact` L1 (`095d8006`, WIP then **closed 09-02**), queues (`f8bcae52`). `main` fast-forwarded and pushed; branch, `main` and `origin` all level. Nothing owed. | 09-02 |
| 🔝 **JUDGED-LOOP PORTS** | **ACTIVE** — `qa/di/BACKLOG.md` | **Item 31 SHIPPED 09-04**: scroll-layout lessons — a run the student scrolled away from kept the shared bracket + its ears; loops now follow `activePrimitiveId` (mic **#129**). `era-explorer` shipped 09-03 (port 24). Item 30 = cap-drill WARNs, one contract call. **Next = `gas-laws-simulator` · `ph-explorer`.** | 09-04 |
| ↳ **math ports** | same stream, queued | `place-value-chart` shipped 08-18 (port 8, first past the ≤20 bench). **Mic #113 IS the #63 material — one sitting closes both and unblocks >20.** `sorting-station` owes `/reader-fit`. **Next codeable: `3d-shape-explorer`.** item 18. | 08-21 |
| ↳ **picture-vocabulary** | ✅ **g7+g8 PASS — item 26 CLOSED 09-02** | `same-category` **0/8 → 7/7 hard**, 46/48, zero false affirms/refusals. Took **4 levers not 3**; blunt precedence REJECTED (refused the generated partner). Item 27 confirmed live — `--di-bench-item` runs go **in parallel** (~6h → ~1.5h). Only **mic #118** left. **TU-6 fired live, INTERMITTENT.** | 09-02 |
| 📊 **Coverage campaign (200)** | **ACTIVE** | `fast-fact` L1 **CLOSED 09-02**: FF-4 + FF-5 struck. The `apply` bleed was not in the mode docs — an unconditional block handed back `'recall'` six lines under "generate ONLY apply". Prompt-only fix, 110 challenges clean. [report](my-tutoring-app/qa/eval-reports/fast-fact-2026-09-02.md). **Pull = the phase-enum trio.** | 09-02 |
| 🧪 **Lesson Bench** | **NEW 09-03 — ACTIVE**, `qa/lesson-bench/BACKLOG.md` | Replayable **Lesson Package** (manifest + brief + every block) drops on a dev panel, plays through the ONE launch verb (`generate({replay})`) and the production assembly step, live tutor connects as in production; a rail takes the human label in the rubric's own vocabulary (G1–G6 / Q1–Q8 / 1–5 anchors) and writes the package back with `human` filled. Route probe: 7/7 blocks. **Browser drive = #125.** Next = persistence endpoint → Tier A scorer → frozen set (40 + 5 control). | 09-03 |
| 🏛️ **History suite (C3)** | **ACTIVE** — item 29 | `cause-effect-chain` **PORT 25 SHIPPED 09-03**: yes/no per card (spoken), chain built by HANDS on a stillness close, root pick spoken. Drives identify 10/10 · hands 5/5 · pick 5/5; tsc at baseline; mic **#130**. `era-explorer` port 24 (mic **#127**). Queued: G5 3-card chains (`/eval-fix`). **Next birth: `source-detective`.** | 09-03 |
| 🗣️ **TU-6 — tutor speaks state** | **unowned** — evidence in di item 32 | **CLASS, not a primitive bug.** `[CURRENT STATE]` read aloud 3/3 + 3/3 (08-23). **09-04, lesson END: the tutor FABRICATED a `[PRIMITIVE SWITCH]` and read it with NO text sent** — phantom mic turns + a switch held forever. Prompt-only bans lose. **Needs a non-voiceable channel + di item 32 (a).** | 09-04 |
| 🎙️ **Human-check queue** | **93 open** — only the user closes these | Mic **#100**–**#108**, **#110**–**#118**, **#123**, **#126**–**#130** (#128 + #129 = ONE lesson-bench sitting, `…pgr5`; #130 = cause-effect port 25). Non-mic **#109**, **#119**, **#120**, **#122**, **#124**, **#125**. **#121 PARTLY SUPERSEDED** by #127. **#63** BLOCKS code; **#90**. Next free **#131**. | 09-04 |
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
