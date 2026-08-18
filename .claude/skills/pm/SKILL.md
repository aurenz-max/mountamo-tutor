# PM — Portfolio Reconciliation & Planning

Run the project-management function for the Lumina portfolio: reconcile every
queue against ground truth, refresh `WORKSTREAMS.md` and `HUMAN-CHECKS.md`, and
propose the next moves. The outcome of a `/pm` run is that ANY session (or the
user, cold) can trust `WORKSTREAMS.md` to answer "what's next?" in 30 seconds.

**Arguments:** `/pm` (full reconcile + plan) · `/pm plan` (skip reconcile, just
propose next moves from current files) · `/pm close <stream>` (retire a stream:
verify residuals recorded, move to PARKED/absorbed)

## Operating model

Work is managed as **tasks in queues, executed by skills** — not by ad-hoc
orchestration. A session should rarely invent its own next task: it pulls the
top item from an ACTIVE stream's queue, runs that item's executor skill, and
records the result in the same slice. `/pm` is the layer that keeps the queues
truthful and ordered; the per-primitive skills are the workers.

### Portfolio model

`WORKSTREAMS.md` (repo root) is the portfolio index: streams are ACTIVE,
DELEGATED, or PARKED, each pointing at its queue file, under a **WIP limit of
2+1** (two ACTIVE streams plus one opportunistic). Human-only browser/pixel
verification debt lives in `my-tutoring-app/qa/HUMAN-CHECKS.md` — never buried
in per-stream Done entries, because only the user can close those rows.

### ⚖️ THE INDEX HOLDS STATE ONLY — run these three gates before you finish

**Restructured 2026-08-16 after the index was split three times in four days and
regrew each time** (08-12 at 358KB; on 08-16 ONE table cell was 31,526 chars = 37%
of the file, one day after 41,365 chars had been moved out of that same cell).
**Splitting has a ~24h half-life. The cause was routing, not volume.**

```bash
wc -c < WORKSTREAMS.md                                  # ≤ 10000
awk 'length>400 && /^\|/ {c++} END {print c+0}' WORKSTREAMS.md   # 0
grep -c '^> ### ' WORKSTREAMS.md                        # 0 — no reconcile notes
```

**`/pm` does NOT write a reconcile note.** It reports its run to the USER in chat
and edits rows in place. The predecessor-archiving rule is retired: superseded
state lives in `git log -p WORKSTREAMS.md`, which is what an archive was manually
re-implementing.

**Route every finding at write time — never into the index:**

| The finding… | Home |
|---|---|
| changes how the next slice is DONE | the executor skill (`/add-di-loop`, `/reader-fit`, …) |
| is true about ONE primitive | `docs/contracts/<id>.md` |
| is a defect CLASS | its own queue item (18d, 19h-i-c, SP-31) |
| is evidence of a run | `qa/tutor-reports/`, `qa/<lane>/` |
| is state (lane, health, next pull) | **the index — as a row** |

*Measured 2026-08-16: of 12 landmark judged-loop findings, 12 were in the queue and
only 2 were in the skill the executor reads. The index was the third copy — the one
whose reader could not act on any of them.*

### Queue → executor registry

| Queue / register | Task type | Executor skill(s) | Update discipline |
|---|---|---|---|
| `my-tutoring-app/qa/reader-fit/BACKLOG.md` | band accessibility per primitive | `/reader-fit [--fix]` | closer moves item to Done w/ evidence, same slice |
| `my-tutoring-app/qa/EVAL_TRACKER.md` | eval-mode/content defects per primitive | `/eval-test`, `/eval-fix`, `/oracle-test` | `/eval-test` writes rows; fixes strike rows |
| SP-27: `docs/PRD_TUTORING_CONTEXT_INTEGRITY.md` + `qa/tutor-reports/` | scaffold contract per primitive | `/tutor-test`, `/add-tutoring-scaffold` | phase gates in the PRD; batch reports |
| `qa/topic-traces/` + `qa/topic-fidelity/` | scope/intent fidelity per generator | `/topic-trace`, `/topic-fidelity`, `/eval-fix` | census reports seed the other queues |
| `qa/primitive-contracts/BACKLOG.md` + `docs/contracts/` | per-primitive requirements contracts | `/primitive-contract [--check\|--census]` | derivations move queue items to Done; every `--check` appends the contract changelog; `derived_at` older than newest census = stale |
| `qa/HUMAN-CHECKS.md` | human-only browser/pixel checks | the USER (only they can close these) | strike here + in owning report |
| Lifecycle follow-up queues (birth certificates) | layer raises per primitive | `/add-eval-modes`, `/add-support-tiers`, `/add-structural-difficulty`, `/add-tutoring-scaffold`, `/add-sound`, `/add-voice-control`, `/migrate-primitive` | `PRIMITIVE_LIFECYCLE.md` ladder |
| `WORKSTREAMS.md` (repo root) | the portfolio itself | `/pm` | every closing session updates "last touched" |

### Discovery routing
New findings (from censuses, audits, live failures, user observations) are
QUEUED in the owning register with the executor skill named — not fixed inline —
unless they ARE the active task. A finding that spans registers (e.g. a census
scope-drop that's also a band failure) gets ONE owning queue entry with
cross-references, never two competing entries.

## Reconcile procedure (`/pm`)

1. **Ground truth first.** `git status` + `git log --oneline -15`. Note the
   uncommitted surface and which streams it belongs to.
2. **Staleness sweep — the known failure mode is "recorded-open but actually
   done" and its inverse.** Cross-check:
   - Open queue items in `BACKLOG.md` vs struck rows in `EVAL_TRACKER.md`
     (grep the primitive id for `~~` strikes and Done entries).
   - Claims in any ACTIVE PRD/plan vs the working tree (e.g. "primitive X has
     broken syntax" → grep the catalog block before trusting).
   - Memory hooks vs queue state (memory lags; queues win; fix the memory).
3. **Human-check refresh.** Grep `qa/` for new `browser glance|pixel|NOT
   browser-verified|needs a browser check` debt in reports newer than
   HUMAN-CHECKS.md's as-of date; add rows; strike verified ones.
4. **Delegated-lane check.** For each DELEGATED lane, read its report/tracker
   rows: fold residuals back into the owning queue and retire the lane when done.
5. **WIP enforcement.** If >2 streams show recent activity, flag it and propose
   which to park. If an ACTIVE stream is starved (>3 days untouched), propose
   parking or resuming it deliberately.
6. **Update `WORKSTREAMS.md`** — states, "now" pointers, as-of dates. Update
   parked-stream rows ONLY with verified facts. **Then run the three gates above.**
   If a row will not fit in 400 chars, the overflow is a finding and belongs in one
   of the homes in the routing table — not in a longer cell.
7. **Ship-hygiene nudge.** If the uncommitted surface spans >1 stream, propose
   `/ship` slices (shared files — EVAL_TRACKER, BACKLOG, harness — in their own
   slice).
8. **Output: a plan, not a report.** End with (a) 1-line health per ACTIVE
   stream, (b) staleness corrections made, (c) the next 3 concrete moves with
   executor skill + queue item each, (d) anything BLOCKED with what unblocks it.

## Cadence
- **Session-start (cheap):** read `WORKSTREAMS.md`; pull the top task of an
  ACTIVE stream. No full reconcile needed.
- **Session-end (cheap):** closer updates owning queue + WORKSTREAMS "last
  touched" in the same slice as the work.
- **Full `/pm` (this skill):** when starting a planning conversation, after a
  multi-stream day, before committing a big batch, or on a schedule (a `/loop`
  or scheduled routine may run `/pm` read-only and report drift — it should NOT
  auto-park streams or rewrite queues without the user).

## Gotchas
- EVAL_TRACKER.md, BACKLOG.md, and `run_tutor_live.py` are shared multi-session
  files — expect them to change on disk mid-session; re-read before editing.
- Never conclude a fix "didn't happen" from a stale report — check the tracker
  strike and the working tree (the 2026-07-14 sweep listed comparison-builder
  syntax already fixed the same day).
- Queue text is the source of truth for WHAT; reports are the source of truth
  for EVIDENCE; memory is a hint, never authority.
