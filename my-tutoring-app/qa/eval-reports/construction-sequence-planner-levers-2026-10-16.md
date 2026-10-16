# construction-sequence-planner levers, 2026-10-16

Built with the W1 binding (`../tutor-reports/construction-sequence-planner-w1-2026-10-16.md`). Code:
`constructionSequenceLevers.ts`. Every lever starts released; `config.difficulty` changes the items, not the levers.

## Failure inventory
There is no real-learner evidence (no demonstrations, misconception or remediation files for this id). The old
catalog `commonStruggles` documented two failures: the roof placed before the walls, and parallel work not seen. The
rest are inferred from the tasks. The misses below are what the code check observes.

| Mode | Failure (class) | Miss |
|---|---|---|
| sequence | puts a job before what it sits on (documented: roof before walls) | `swapped_neighbors`, `job_before_need` |
| sequence | starts with a job that needs something (inferred) | `wrong_first` |
| sequence | builds last-to-first (inferred) | `reversed` |
| dependency_chain | checks one of two needs and misses the other (inferred) | `missed_second_need` |
| dependency_chain | starts with a job that needs something, or ignores a need (inferred) | `wrong_first`, `job_before_need` |
| parallel | puts a job in the same week as a job it needs (inferred) | `need_same_week` |
| parallel | puts a need in a later week (inferred) | `need_later` |
| parallel | gives every job its own week and misses the deadline (documented: parallel work not seen) | `too_many_weeks` |
| parallel hard | more jobs in a week than crews (inferred) | `crew_over` |
| critical_path | adds every job's weeks (inferred) | `added_all` |
| critical_path | takes a shorter chain, or the chain with the most jobs (inferred) | `shorter_chain`, `most_jobs_chain` |
| critical_path | counts jobs instead of weeks, or miscounts (inferred) | `counted_jobs`, `off_by_one` |

## Lever table

| Mode | Lever | Kind | What changes | Leak rule (code) |
|---|---|---|---|---|
| sequence, dependency_chain, parallel | `check_as_you_go` | help | marks each job in the learner's own plan with a need not before it, and each week over the crew size | marks only placed jobs and weeks; never names the missing job or a place (`asYouGoMarks`) |
| dependency_chain | `tick_needs` | help | a tick beside each need on a card once that need is in the plan | only on needs the card already shows |
| parallel | `same_needs` | help | a letter tag on jobs that need exactly the same jobs (they can share a week) | a letter per group; no week |
| critical_path | `trace_chains` | help | every chain of needs, first job to last, as a row of names | no digits, no "longest/total" (`leverLeak`) |
| critical_path | `week_blocks` | help | each card's weeks drawn as blocks | per card; adds nothing up |
| every mode | `fewer_jobs` | simplify | the same task with one job fewer, on another project, ungraded, then the full item | no job name shared with the stuck item; on critical_path a different total |

`fewer_jobs` is absent on the smallest items (sequence 3 jobs, dependency_chain 3, parallel 4, critical_path 4); the
sweep's easy items are therefore lever-light by design. Every miss an item can show is answered by a help lever first
(tested over every tier and project, all orders up to 6 jobs and 4000 sampled week plans). Practice items have no
levers and never shrink twice.

## Measured
- Workspace test: each help lever changes the screen and the scene fact in the same commit, and the next attempt
  records it (`assisted`, `levers`); `fewer_jobs` opens `<id>~simpler` on another project and the full item comes back.
- Sweep J9, J12, J13, J15: 0 findings on the six payloads.
- Replay: after the two wording fixes in the W1 report, the lever and stuck replies describe each mark, tick, tag or
  row by what it shows and send the learner to read a card (r3). r1 found "swap the last two"; r2 found the needed card
  described ("what the tower needs in the middle"); both fixed in guidance.

## Failures without a lever
None observed. sequence has no lever that teaches the physical reason a job comes first (what it sits on); the tutor
carries that by asking, and `check_as_you_go` only shows where a plan breaks.
