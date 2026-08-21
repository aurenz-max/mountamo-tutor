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

## Portfolio — as of 2026-08-18

**WIP limit 2 ACTIVE + 1 opportunistic. ⚠️ OVER: judged-loop literacy + math + two lanes opened
08-18 by user directive (`open_set_word`, coverage). Deliberate — but pick 2 to actually run.**

| Lane | State | Pull now | As of |
|---|---|---|---|
| 🚀 **PROD / `main`** | ⚠️ **5 SLICES NOT ON `main`** | `/pm` 08-18: `main` = **`730e8a7d`**, not `c7f5ad7a` as this row claimed. Ship branch is **5 commits ahead** + ~100 dirty files — 3 judged ports pushed, **not in production**. **➡️ ff `main`, then `/ship`.** Deploy caveats below. | 08-18 |
| 🔝 **JUDGED-LOOP FAMILY** | **ACTIVE** | 🆕 **Item 25 `states-of-matter` SHIPPED 08-20 (third science port): ALL THREE MODES SPOKEN, zero taps — the temperature slider went to the TUTOR (a slider beside a live beaker answers “what state WILL it be” by experiment), and her affirmation RUNS the experiment as the reveal. Content is code (10 substances, real thresholds, every key computed); `boilingIsReal` refuses “chocolate boils at 350 degrees”. ⭐ Two carry-forwards: **defect 6 needed a SECOND half** — `{{stimulus}}` must sit LAST in `taskDescription` with the never-read-aloud clause immediately before it (3/6 → 2/6 → **0/6**); and **the DRAW is a third recitation channel** — alternating facets per item re-speaks the how-to-play every round and `findRepeatedConsecutiveAsks` cannot see it (`FACET_RUN=2`). 37/37 di-script, 480 probe draws 0 drops, all 3 modes green plain+signature, cap drill PASS; mic **#117**. Earlier: `habitat-diorama` (#116, headless drive still owed), `periodic-table` (#115), `solar-system-explorer` (#114). **➡️ Next: habitat semantic drives, then the mic sitting.** | 08-20 |
| 🎙️ **Judged-loop human queue** | **66 open rows** | Mic **#100**–**#108**, **#110**–**#117** *(#114 solar-system-explorer; #115 periodic-table; #116 habitat-diorama; **#117 states-of-matter**)*. Non-mic **#109**. Plus **#63** (BLOCKS code), **#90**. Full list: `qa/HUMAN-CHECKS.md`. | 08-20 |
| 🔢 **Judged loop — MATH (item 18)** | **ACTIVE** | ✅ `place-value-chart` SHIPPED 08-18 (math port 8, user call) — **THE FIRST PORT PAST THE ≤20 BENCH**: new `place_value_word` class accepted-build-ahead (user ruling 08-19), spoken places + values, build = DICTATION (target never prints); all drives green, cap drill 0 HIGH after the ones-place leak fix; mic **#113 = the #63 acceptance material — one sitting closes both and unblocks the >20 tier**. ✅ `ordinal-line` port 6 (mic #110) · ✅ `sorting-station` 7/7 modes (owes `/reader-fit`). **➡️ Next: the #63/#113 mic sitting (user), or `3d-shape-explorer` (shape-sorter's machinery, benched classes).** | 08-18 |
| 00. **Lesson ordering** | ⛔ **PARKED — top item was REJECTED** | `/pm` 08-18: this row sold **B′** as a ready ~15-line pull for 10 days; handoff §5 **killed B′ on 08-10** (`32267345`) — 886 mode pairs, zero disagreeing with β. Arms B and C also rejected. **No ordering work left.** Residual is per-primitive content → `/primitive-contract`. | 08-18 |
| 0. **Science depth** | PARKED (was ACTIVE) | CELL-1 ✅ 08-18: discrete model regions + 4 eval modes; focused runtime 10/10, real API draw blocked upstream. Resume top = **LCS-1** (`/oracle-test` first). DNA-1 ✅ CB-1 ✅; #80 open. `qa/science-depth/BACKLOG.md`. | 08-18 |
| 🆕 **Silent generator fallbacks** | OPENED then DEMOTED | 33 generators carry a hardcoded fallback with no retry and no warn; **32 are math**. ⚖️ Ruling 08-16: not its own sweep — **math DI ports force the same live probe**, so the 33-item list is the checklist a math port consults. List in this row's git history. | 08-16 |
| 🆕 **`di-spoken-practice`** | SHIPPED, 2 open | `71cba07` + `ead9ae1` on `main`. Open: **item 17** (embedded insets — scoped, not started) and the routing hold. `qa/di/BACKLOG.md` items 16–17. | 08-12 |
| **DI closeout (CTX-2)** | Documentation + 1 probe | The excavators run already carries the post-fix floor-gate numbers (27 batches, wedged 0, superseded 0). Write the report citing it. Genuinely unproven: the **`wedged` watchdog** — a wedged-0 run cannot show it fires. `qa/di/BACKLOG.md` item 15. | 08-10 |
| 1. **Reader-fit sweep** | PARKED — BLOCKED | Item 17 gated on HUMAN-CHECKS **#77** (`solar-system-explorer`). Resume the moment #77 is struck; executor `/add-eval-modes`, 3 primitives. It is an eval-hook portfolio decision, not a band fix — probe the tutor channel BEFORE scoping. | 08-08 |
| **Support tiers (non-math) · LA K-2 grammar** | PARKED | Batch-3 needs evidence via `/eval-test`; grammar is BLOCKED on a user design ruling, not capacity. | 08-05 |
| ⚠️ **IMG-1 — tutor is blind to images** | PARKED (user: *"I don't think we push this forward"*) | If resumed, the cheap pedagogy half comes first: the tutor SAYING it cannot see, instead of confabulating. Record: `qa/tutor-reports/lesson-live-2026-08-10-excavators.md`. | 08-10 |
| **Closed, no code owed** | 3 filed | `multiplication-explorer` ✅ `927b754` (gate **#90**). `Pip` ✅ `997c875`, UNFILED. `npm test` exits 1 with 0 failing tests (`canvas-confetti` rAF after jsdom teardown) — rides whoever next touches `solar-system-explorer`. | 08-18 |
| 🗣️ **`open_set_word` + rhyme-studio pilot** | ✅ **BOTH SHIPPED 08-19. No blocked response class left in the family.** | Bench: **72 probes / 6 rimes, the judge's affirm set was EXACTLY the 17 planted valid rhymes** (`qa/di-bench/run-2026-08-19-open-set-word.md`). ⭐ Its only apparent false affirm was OUR miskey (`zell` = a surname); chasing it gained a capability — **names COUNT**. **PILOT: the word bank is DELETED.** `production` became open — read-four-say-one → **think of a rhyme** (recognition → generation). ⭐ **K unlocked**: the Grade-1+ gate existed because bank distractors could not be pictured; open production is oral, and rhyme production is K.RF.2.a. Live at K: 9 items, 0 dropped, gates clean. **Built for reuse: `--di-bench` + scored probe keys.** **➡️ Next: queue the 11 unblocked packs; widen fixture rime coverage.** ✅ `maxCorrections` FIXED 08-20 (item 25's F3). ⛔ The "`picture-vocabulary` first — tap becomes name-it" note named the WRONG MODE: `naming` was already spoken, the tap was `association`, and it converted on 08-20. di item 24. | 08-19 |
| 🖼️ **picture-vocabulary `association` → spoken** | 🎙️ **BUILT 08-20, machine-gated. 3 live gates OWED.** | The first port to spend the newly-benched `open_set_word`, and the hardest open-set case yet — *"goes with"* is fuzzy where rhyme was near-binary, so the failure mode is the judge RATIONALISING a chain (*"a cat goes with a sock, cats play with socks"*). **Shipped:** `association` → voice/`open_set_word`; an accept clause that authorises the UNLISTED partner (`sock → foot`/`drawer`) and draws the line at the story; **six guards**; **three scripted correction branches** (echo + category-word got their own, per item 24 §5); the correction models the relation on a **code-owned pair** because an open correction cannot name the answer without killing the re-elicit; `associationBench.ts` (4 stimuli × 12 probes, 4 relation types); **F3 fixed** — `--di-bench` honors `maxCorrections`. Generator also lost association's 3-distractor pool floor. `receptive_match` untouched — still a tap, still a ruling. **Gates:** tsc 0 new (806 vs 811 baseline), vitest 4205 pass, 52 pack assertions. **⚠️ OWED, all need a running stack:** the bench RUN, a live `--di` + `--di-wrong signature` drive (the only way to exercise the echo branch), and a mic row. di item 25. | 08-20 |
| 📊 **Coverage campaign (200)** | 🆕 **OPENED 08-18 (user directive)** | Catalog measured: **197 entries — evalModes 70%, tutoring 80%, judged pack 18%.** ⭐ **103 are DI-portable TODAY** (chemistry 13 untouched after `periodic-table` 08-19, math 53). Constraint is **throughput, not prerequisites** — cluster by response-class SHAPE. 41 need eval modes; 17 presentational. `qa/coverage/BACKLOG.md`. | 08-18 |
| **Delegated lane** | NONE | — | 08-16 |

### Recorded once so it is not re-discovered as new

- **`parent/link-student` has no verification.** NOT a row — user ruling 2026-08-14: the
  parent portal is **vestigial, pre-Lumina**, may be picked up at a future state. `POST
  /api/parent/link-student` has a literal `# TODO` where verification should be. If the
  portal is ever revived, verification is the first thing it needs.
- **Deploy caveats (carried).** `my-tutoring-app/vercel.json` pins **no branch**, so which branch
  production tracks is unconfirmed. `backend/cloudbuild.yaml` deploys Cloud Run service
  **`ai-tutor-backend`** (us-east5); the live service is **`mountamo-education`** — the backend has
  not moved. Both verified in-file by `/pm` 2026-08-18.
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
