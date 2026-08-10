---
name: pm
description: Reconcile and plan the Lumina project portfolio from repository ground truth. Use when the user invokes $pm, asks what work should happen next, wants WORKSTREAMS.md or HUMAN-CHECKS.md refreshed, needs active and delegated queues reconciled, or wants a workstream closed without losing residual work.
---

# Portfolio reconciliation and planning

Maintain a portfolio that any cold session can use to answer “what’s next?” from `WORKSTREAMS.md` in 30 seconds.

Interpret invocations as follows:

- `$pm`: reconcile the complete portfolio, update the portfolio files, and plan the next moves.
- `$pm plan`: read current portfolio and queue files and propose next moves without reconciling or editing them.
- `$pm close <stream>`: verify the named stream’s residual work is recorded, then retire it to `PARKED` or mark it absorbed by another stream.

## Operating model

Manage work as tasks in queues executed by skills. Pull the top item from an `ACTIVE` stream, name its executor skill, and record its result in the owning queue during the same work slice. Do not invent ad hoc tasks when a truthful queue already supplies the next task.

Treat `WORKSTREAMS.md` as the portfolio index. Streams are `ACTIVE`, `DELEGATED`, or `PARKED`, under a WIP limit of two active streams plus one opportunistic lane. Keep human-only browser and pixel verification in `my-tutoring-app/qa/HUMAN-CHECKS.md`; only the user may close those rows.

Use queue text as the source of truth for what remains, reports as evidence, the working tree as implementation truth, and memory only as a hint.

## Queue and executor registry

| Queue or register | Task type | Executor skill | Update discipline |
|---|---|---|---|
| `my-tutoring-app/qa/reader-fit/BACKLOG.md` | Band accessibility per primitive | `$reader-fit` with optional fix mode | Move completed items to Done with evidence in the same slice. |
| `my-tutoring-app/qa/EVAL_TRACKER.md` | Evaluation-mode or content defects | `$eval-test`, `$eval-fix`, `$oracle-test` | Add confirmed failures during testing and strike rows after verified fixes. |
| `my-tutoring-app/src/components/lumina/docs/PRD_TUTORING_CONTEXT_INTEGRITY.md` and `my-tutoring-app/qa/tutor-reports/` | Tutoring scaffold contracts | `$tutor-test`, `$add-tutoring-scaffold` | Maintain PRD phase gates and batch reports. |
| `my-tutoring-app/qa/topic-traces/` and `my-tutoring-app/qa/topic-fidelity/` | Generator scope and intent fidelity | `$topic-trace`, `$topic-fidelity`, `$eval-fix` | Let census reports seed the owning queues. |
| `my-tutoring-app/qa/primitive-contracts/BACKLOG.md` and `my-tutoring-app/src/components/lumina/docs/contracts/` | Primitive requirements contracts | `$primitive-contract` | Move derivations to Done, append the contract changelog after checks, and treat `derived_at` older than the newest census as stale. |
| `my-tutoring-app/qa/HUMAN-CHECKS.md` | Human-only browser and pixel checks | User | Strike the row here and in the owning report only after user verification. |
| Lifecycle follow-up queues and birth certificates | Per-primitive capability raises | `$add-eval-modes`, `$add-support-tiers`, `$add-structural-difficulty`, `$add-tutoring-scaffold`, `$add-sound`, `$add-voice-control`, `$migrate-primitive` | Follow the ladder in `my-tutoring-app/src/components/lumina/docs/PRIMITIVE_LIFECYCLE.md`. |
| `WORKSTREAMS.md` | Portfolio state | `$pm` | Update the relevant stream’s last-touched value at closure. |

Route a new finding into exactly one owning register with the executor skill named. Add cross-references for findings that span registers; do not create competing duplicate queue entries. Do not fix a newly discovered issue inline unless it is the active task.

## Full reconciliation workflow

For `$pm`, perform these steps in order:

1. Establish ground truth with `git status --short` and `git log --oneline -15`. Preserve unrelated user changes. Map the uncommitted surface to workstreams.
2. Read `WORKSTREAMS.md`, `my-tutoring-app/qa/HUMAN-CHECKS.md`, and every queue, PRD, tracker, or report referenced by `ACTIVE` and `DELEGATED` rows. Resolve paths from the repository rather than assuming stale paths are valid.
3. Sweep for staleness in both directions. Cross-check open backlog items against struck tracker rows and Done entries, verify claims in active plans against the working tree, and correct portfolio text that disagrees with stronger evidence.
4. Refresh human checks. Search newer QA reports for `browser glance`, `pixel`, `NOT browser-verified`, `needs a browser check`, and equivalent phrases. Add missing rows without duplication. Never close a human check without explicit user confirmation.
5. Reconcile every `DELEGATED` lane. Read its tracker and reports, fold residual work into one owning queue, and retire the lane only when no unrecorded residual remains.
6. Enforce the two-plus-one WIP limit. If more than two streams show recent activity, identify the overlap and propose which stream to park. If an active stream is untouched for more than three days, propose either deliberate resumption or parking; do not auto-park based only on age.
7. Update `WORKSTREAMS.md` with verified states, current pointers, as-of dates, and last-touched values. Update parked rows only when evidence supports the change.
8. If the uncommitted surface spans more than one stream, propose coherent `$ship` slices. Put shared files such as trackers, backlogs, and harnesses in an explicit shared slice when appropriate.
9. Re-read each shared file immediately before editing because another session may have changed it.
10. Validate edits with focused diffs and fresh searches for every corrected claim. Do not run broad application tests for planning-only Markdown changes unless a referenced implementation claim requires them.

## Plan-only workflow

For `$pm plan`, do not edit files. Read `WORKSTREAMS.md` and enough of each active queue to verify its current top item. Return the three most valuable concrete moves, each with the owning queue item and executable skill. Call out stale or contradictory evidence but leave reconciliation for a full `$pm` run.

## Close-stream workflow

For `$pm close <stream>`:

1. Locate the exact stream and its owning queue or report.
2. Verify completed work against the working tree and evidence files.
3. Move every remaining actionable residual into one appropriate owning queue with an executor skill and cross-references.
4. Preserve unresolved human verification in `HUMAN-CHECKS.md`.
5. Change the stream to `PARKED` or document absorption into another stream, update dates and pointers, and show the focused diff.
6. Stop and ask the user when the stream identity is ambiguous or closing it would discard unresolved work.

## Output contract

Lead with the plan, not a narrative report. End every run with:

1. One line of health for each active stream.
2. Staleness corrections made, or “none” for plan-only mode.
3. The next three concrete moves, each naming its executor skill and queue item.
4. Blockers and the exact event or decision that unblocks each one.

When files changed, name the changed files and summarize validation. When no trustworthy next move exists, say which queue or evidence is missing instead of inventing work.

## Guardrails

- Do not infer that a reported fix failed from an old report; check tracker strikes and current code.
- Do not overwrite or revert unrelated working-tree changes.
- Do not silently close browser or pixel checks.
- Do not duplicate one finding across multiple owning queues.
- Do not use a missing executor skill as permission to change implementation inline; report the missing skill and preserve the queue item.
- Re-read shared files such as `EVAL_TRACKER.md`, backlogs, and `run_tutor_live.py` before editing.
