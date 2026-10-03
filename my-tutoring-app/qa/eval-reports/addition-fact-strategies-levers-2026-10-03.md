# addition-fact-strategies — support levers (design approved 2026-10-03)

Status: BUILT 2026-10-03 on the W1 workspace binding (`../tutor-reports/addition-fact-strategies-workspace-2026-10-03.md`).
Table approved by the user the same day.

## Failure inventory

No observed-real or observed-synthetic evidence exists (no demonstrations, tutor reports,
misconception runs; the birth eval-test drove only the scripted path). Classes below are
documented (source game "Pip's Number Adventure" hint sequence; catalog `commonStruggles`
written 2026-10-03) or inferred.

## Lever table

| Mode(s) | Failure (class) | Miss id | Lever | Kind | Carrier | Leak rule | Exists today? |
|---|---|---|---|---|---|---|---|
| all | wrong total, guessed (documented) | `off_by_more`, `addend` | `count_groups`: addends as tappable object groups | help | shown | no combined total printed; numbers only from the child's own taps | auto on 1st miss, not pullable |
| plus_one, plus_two, small addend in big facts | counts all, slips by one (documented) | `one_short`, `one_over` | `hop_strip`: start at the bigger addend, one blank hop per unit of the smaller | help | shown + voiced | start number only; landing never drawn | no (intro only) |
| turnaround | doesn't use the flip (documented) | any | `known_fact`: flipped fact card | help | shown | only b + a, never this order; attempt assisted | auto on 1st miss |
| big_facts, turnaround with addends 1-2 apart | can't bridge from a double (documented) | `one_short`, `one_over`, `off_by_more` | `near_double`: the double as two equal dot rows plus extra dot(s) apart, "7 + 7" without its sum | help | shown | double's sum and item's sum never printed | no |
| plus_zero | adds one, or answers 0 (inferred) | `one_over`, `addend` | covered by `count_groups` (empty group) | help | shown | as above | yes |
| all | too hard right now (inferred) | any, after help | `smaller_fact`: smaller fact, same family, ungraded, then back | simplify | shown | never this fact or its turn-around; same family | no |
| big_facts 9s | make-ten bridge (inferred) | — | no lever: not in the source; crosses into make-ten | — | — | — | — |

Behaviour changes (approved): easy starts with `count_groups` pulled; medium and hard start
released. The 1st miss no longer auto-shows help; the 2nd wrong auto-pulls `nextLever(miss)`.

## Built

- `additionFactStrategiesLevers.ts` (declarations, `startLevers`, `smallerFact`, `leverFacts`, leak rule
  `leverNumbers`); `additionFactPools.ts` (the family pools, moved out of the generator so the component builds
  the smaller fact at runtime). Component: lever state per session item, the four help renders
  (`data-lever` = count-groups, hop-strip, near-double, known-fact), the ungraded smaller fact, `pullLever` /
  `endPractice`. Generator: `config.difficulty` -> `supportTier` (easy starts `count_groups`).
- Changes from the table: `count_groups` answers every miss (declared last), because the dry sweep's J9 found
  off-by-one misses on doubles and +0 that no lever answered. Removed: the miss-driven help (objects on the
  1st miss, counted aloud on the 2nd); help now comes only from a lever.
- AF-1 (peer eval-test finding, same day): each challenge's `type` is now the strategy, so the eval-test route
  accepts every mode (6/6 re-run on the live route).

## Measured

- Unit: help levers per family, miss -> `nextLever` table (12 rows), leak rule over every fact of every family,
  smaller_fact over every fact (in family, smaller total, never a session fact). Mounted: 6 lever tests (pull
  draws in the same commit, scene states no total, attempt carries the lever, refused second pull, easy start
  not recorded, simplify round trip credited only on the full item).
- Dry sweep J1-J11 on the six payloads: pass. typecheck:lumina 0; full tsc 771, none in touched files.
- Tutor replay, 6 payloads x 5 samples: 0 misses on every check incl. `lever` and `stuck`. On "I'm stuck" the
  tutor pulled a lever itself 30/30 and described what it drew without the total.
- Not run: Live (none owed for the gate; the class Live pair is a separate decision), human browser check
  (HUMAN-CHECKS #167), `/eval-test` tier sweep of the starting positions.

## Failures with no lever
- Make-ten bridge for the 9s (approved: none). Near doubles as a family of its own: queued as `near_doubles`
  (`/add-eval-modes`, birth queue 1b).
