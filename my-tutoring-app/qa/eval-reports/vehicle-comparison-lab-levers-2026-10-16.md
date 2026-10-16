# vehicle-comparison-lab levers, 2026-10-16

Built with the W1 binding (`../tutor-reports/vehicle-comparison-lab-w1-2026-10-16.md`). Code: `vehicleComparisonLevers.ts`.
Every lever starts released; `config.difficulty` changes the items (rows, columns, how close the race is, how many
minimums), not the levers.

## Failure inventory
There is no real-learner evidence (no demonstrations, misconception or remediation files for this id). The old
catalog `commonStruggles` documented three failures: comparing only two vehicles, looking only at speed, and
struggling with the constraints. The old bay's "only two vehicles" failure no longer applies (the table is fixed). The
rest are inferred from the tasks. The misses below are what the code check (`comparisonMiss`) observes.

| Mode | Failure (class) | Miss |
|---|---|---|
| metric_leader | compares numbers by their first digit (9,800 read as bigger than 13,000) (inferred) | `leading_digit` |
| metric_leader | reads a different column from the one asked (documented: looks only at speed) | `other_column_leader` |
| metric_leader | picks the biggest number where smaller is better (CO2), or the smallest (inferred) | `reversed` |
| metric_leader | stops at a close second, or misreads a number (inferred) | `runner_up`, `not_leader` |
| evidence_choice | picks the right vehicle but cites a column that does not prove the job (inferred) | `wrong_evidence` |
| evidence_choice | picks the impressive vehicle, the leader of another column (documented: looks only at speed) | `other_column_leader` |
| evidence_choice | finds the right column but misreads its numbers (inferred) | `misread_column`, `not_leader` |
| constraint_tradeoff | picks the priority leader without checking the minimums (documented: struggles with constraints) | `ignored_minimum` |
| constraint_tradeoff | reverses the priority, or does not compare the vehicles that qualify (inferred) | `reversed`, `not_priority_leader` |

## Lever table

| Mode | Lever | Kind | What changes | Leak rule (code) |
|---|---|---|---|---|
| all | `count_digits` | help | under each number in the asked column (evidence_choice: every column), its digit count | same note on every row; no ordering or mark (`rankLeak`) |
| metric_leader, CO2 | `smaller_is_better` | help | a card: a smaller CO2 number means less pollution | names no vehicle |
| metric_leader, 2+ columns | `focus_column` | help | fades every column but the asked one | the column is already named in the ask |
| metric_leader, 3+ rows | `two_rows` | simplify | the same column on two other vehicles (never the leader) | practice key differs from the item's key |
| evidence_choice | `column_meanings` | help | a card saying what each column measures, every column alike | names no job and no column as the one needed |
| evidence_choice | `fewer_columns` | simplify | the same job without the leading vehicle, on two columns | practice key differs; another column still has another leader |
| constraint_tradeoff | `mark_minimums` | help | a tick or cross beside each minimum number of every row | marks the minimums only, never the priority column |
| constraint_tradeoff, 2 minimums | `one_minimum` | simplify | one minimum on the table without the answer vehicle; the overall priority leader still misses it | practice key differs |

Every miss an item can show is answered by a help lever first (tested over every tier on two rosters and the
hand-built items). Practice items have no levers and never shrink twice.

## Measured
See the W1 report for the sweep and replay numbers.

## Failures without a lever
- "The job needs this column" is the evidence_choice task itself, so no lever names it; `column_meanings` defines
  every column alike and the learner still makes the match.
- `mark_minimums` does the filter step of a trade-off for the learner: the attempt is recorded as assisted. There is
  no lever between "no help" and "the filter done"; a lever that checks one minimum at a time would sit there.
