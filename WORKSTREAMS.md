# Workstreams — Portfolio Index

The single orientation surface for all Lumina workstreams. Any session answering
"what's next?" starts HERE, then pulls the top item of an ACTIVE stream's queue.

## ⚖️ THE RULE THAT MAKES THIS FILE WORK (restructured 2026-08-16)

**This file holds STATE. It does not hold findings, evidence, or reasoning.**

| Hard rule | Check it mechanically |
|---|---|
| **Every table cell ≤ 400 chars** (≈4 lines) | `awk -F'\t' 'length>400 && /^\|/ {print FNR": "length}' WORKSTREAMS.md` → empty |
| **Whole file ≤ 10,000 chars** | `wc -c < WORKSTREAMS.md` → over budget means something is in the wrong home |
| **No reconcile notes in this file** | `grep -c '^> ### ' WORKSTREAMS.md` → **0**. `/pm` reports its run to the user and edits rows; it never appends prose |

*400 is the number this restructure could actually hold while keeping the deploy caveats
and pull pointers intact — checked, not aspired to. The previous caps ("a row that needs
scrolling belongs in its queue") failed because they were prose inside the file they
governed, with no number and no command.*

**Why this is stricter than it looks.** The index was split three times in four days
(08-12 at 358KB, 08-13, 08-16) and regrew each time. On 2026-08-16 **one table cell —
the judged-loop row — was 31,526 chars, 37% of the file**, one day after 41,365 chars
had been moved out of that same cell. Splitting has a ~24h half-life. The cause was
never volume; it was **routing**: findings were written here instead of where their
reader acts.

### 📍 Where a finding goes instead (decide at WRITE time)

| The finding… | Home | Reader |
|---|---|---|
| changes how the next slice is **DONE** | the executor skill (`/add-di-loop`, `/reader-fit`, …) | whoever runs it next |
| is true about **ONE primitive** | `docs/contracts/<id>.md` | the next edit to that primitive |
| is a **defect CLASS** | its own queue item (18d, 19h-i-c, SP-31) | whoever pulls that item |
| is **evidence of a run** | `qa/tutor-reports/<id>-*.md`, `qa/<lane>/*.md` | anyone auditing the claim |
| is **state** (lane, health, next pull) | **this file — a row** | a session orienting cold |

*Measured 2026-08-16: of 12 landmark judged-loop findings, 12 were in the queue and
only 2 were in the skill the executor actually reads. The index was the third copy.*

**History:** superseded reconcile notes and prior snapshots are in
[`git log -p WORKSTREAMS.md`](WORKSTREAMS.md) (95+ commits). Read it for *why* a call
was made, never for what is true now. **Queues are authority over this file; this file
is authority over memory.**

| State | Meaning |
|---|---|
| ACTIVE | being worked now; queue is trusted |
| DELEGATED | handed to another session; check its report before touching |
| PARKED | intentionally idle; queue trusted only as of the noted date |
| BLOCKED | waiting on a named dependency |

## Portfolio — as of 2026-08-17

**WIP limit 2 ACTIVE + 1 opportunistic. Running 1 real + 1 starved — see stream 00, which is
9 days untouched and needs a pull-or-park ruling rather than another "as of" bump.**

| Lane | State | Pull now | As of |
|---|---|---|---|
| 🚀 **PROD / `main`** | ✅ SHIPPED | `main` = `origin/main` = ship branch = `c7f5ad7a`, tree clean; all 19 judged ports in production. **Two carried:** the Vercel deploy off `910e981` is unverified (no branch config in `vercel.json`), and the backend has NOT moved — `cloudbuild.yaml` names `ai-tutor-backend`, the live service is `mountamo-education`. | 08-16 |
| 🔝 **JUDGED-LOOP FAMILY** | **ACTIVE** | ✅ `genre-explorer` SHIPPED 08-17 — DI port 19, item 22 port **2/5**, **all three eval modes** (the scope's open `compare_genres` fork answered SHIPS: it needed no new response class, and forking would have left the Tier-4 mode tapping beside two spoken siblings). Mic row #105. 4 defects found by the live gates, incl. a Tier-1 binary silently going three-way and a reader-fit accommodation hanging off a model-authored grade field. **➡️ Next: `/add-di-loop sentence-analyzer`** (item 22 port 3/5 — zero-queue; its two lower modes are literally multiple choice). **Alt:** 19h-i-b ports 9–11, led by `rhyme-studio` (in 5 queues). | 08-17 |
| 🎙️ **Judged-loop human queue** | 6 mic rows + 2 | **#100** story-talk · **#101** word-workout · **#102** word-sorter *(filed late 08-17; the ship block claimed it, no row existed)* · **#103** word-builder · **#104** text-structure-analyzer · **#105** genre-explorer *(`yes_no`'s first high-volume caller — its acceptance drive has been owed since #94 — plus the longest tutor self-audio window the family has shipped)*. Plus **#63** (BLOCKS code — unlocks >20 math) and **#90** (2-min glance). Sitting closed 08-14: ports ship on gates + probe + `--di`. | 08-17 |
| 00. **Lesson ordering** | ⚠️ **ACTIVE but STARVED 8 DAYS** | **Top = B′**, the deterministic within-block sort: ~15 lines, no LLM call, data already on all 541 modes, criterion already measured (19 of 72 blocks inverted → 0). **Pull it or park it deliberately.** `qa/topic-traces/HANDOFF-primitive-selection-2026-08-08.md` §5. | 08-08 |
| 0. **Science depth** | PARKED (was ACTIVE) | Resume top = **CELL-1**: `ZONE_BOUNDS` barely discriminate (one drop point satisfies 5 of 6 zones) and feed IRT evidence. **`/primitive-contract` FIRST, then `/eval-fix`.** DNA-1 ✅ CB-1 ✅; #80 open. `qa/science-depth/BACKLOG.md`. | 08-09 |
| 🆕 **Silent generator fallbacks** | OPENED then DEMOTED | 33 generators carry a hardcoded fallback with no retry and no warn; **32 are math**. ⚖️ Ruling 08-16: not its own sweep — **math DI ports force the same live probe**, so the 33-item list is the checklist a math port consults. List in this row's git history. | 08-16 |
| 🆕 **`di-spoken-practice`** | SHIPPED, 2 open | `71cba07` + `ead9ae1` on `main`. Open: **item 17** (embedded insets — scoped, not started) and the routing hold. `qa/di/BACKLOG.md` items 16–17. | 08-12 |
| **DI closeout (CTX-2)** | Documentation + 1 probe | The excavators run already carries the post-fix floor-gate numbers (27 batches, wedged 0, superseded 0). Write the report citing it. Genuinely unproven: the **`wedged` watchdog** — a wedged-0 run cannot show it fires. `qa/di/BACKLOG.md` item 15. | 08-10 |
| 🧮 **`multiplication-explorer`** | ✅ DONE + PUSHED `927b754` | Human gate **#90** — never looked at, ~2 min screen glance. EVAL_TRACKER SP-30. | 08-11 |
| 1. **Reader-fit sweep** | PARKED — BLOCKED | Item 17 gated on HUMAN-CHECKS **#77** (`solar-system-explorer`). Resume the moment #77 is struck; executor `/add-eval-modes`, 3 primitives. It is an eval-hook portfolio decision, not a band fix — probe the tutor channel BEFORE scoping. | 08-08 |
| **Support tiers (non-math) · LA K-2 grammar** | PARKED | Batch-3 needs evidence via `/eval-test`; grammar is BLOCKED on a user design ruling, not capacity. | 08-05 |
| ⚠️ **IMG-1 — tutor is blind to images** | PARKED (user: *"I don't think we push this forward"*) | If resumed, the cheap pedagogy half comes first: the tutor SAYING it cannot see, instead of confabulating. Record: `qa/tutor-reports/lesson-live-2026-08-10-excavators.md`. | 08-10 |
| ⚠️ **`npm test` exits 1, 0 failing tests** | FILED | `canvas-confetti` rAF after jsdom teardown, parallel-only. Belongs to whoever next touches `solar-system-explorer`. | 08-09 |
| **Pip — the Curator's character** | SHIPPED `997c875`, UNFILED | User product call (stream vs one-off); 100% pixels, no machine gate. | 08-08 |
| **Delegated lane** | NONE | — | 08-16 |

### Recorded once so it is not re-discovered as new

- **`parent/link-student` has no verification.** NOT a row — user ruling 2026-08-14: the
  parent portal is **vestigial, pre-Lumina**, may be picked up at a future state. `POST
  /api/parent/link-student` has a literal `# TODO` where verification should be. If the
  portal is ever revived, verification is the first thing it needs.
- **Pilot onboarding — CLOSED 2026-08-14** (user: *"onboarding is done"*). Queue deleted;
  items 1–3 retired unbuilt, deliberately.

## Standing hygiene

- Human-only verification debt lives in `my-tutoring-app/qa/HUMAN-CHECKS.md`. **ONE
  format, one list, newest first: file new rows at the TOP as `### #N — …`.** There is no
  second section, and there used to be — which is how a row came to exist twice and
  disagree with itself. **Re-grep for the next free ID immediately before filing;**
  concurrent sessions in these lanes are normal and IDs move.
- **A stale doctrine line costs more than a stale status line.** Status decays visibly; a
  rule (*"class X is BLOCKED"*, *"this stream is uncommitted"*) is copied forward by the
  next session and silently changes what gets built. When a user ruling overturns a rule,
  grep for its prose copies in queues, scripts and docblocks — `tsc` sees none of them.
- **Commit at the mechanism boundary.** In a lane two sessions are both in, commit while
  you still know which lines are yours. Shared files (EVAL_TRACKER, BACKLOG,
  `run_tutor_live.py`) commit in their own slice.
- **Every closing session updates the owning queue AND this file's "As of" in the same
  slice** — and routes its findings per the table at the top, not into this file.
