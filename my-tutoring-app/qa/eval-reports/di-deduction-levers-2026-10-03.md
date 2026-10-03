# di-deduction levers: DI family 8 (2026-10-03)

`/add-support-tiers`, plan `qa/support-levers/di-lever-plan-2026-10-03.md` step 6. Table and failure inventory: `qa/support-levers/di-deduction-lever-table-2026-10-03.md`. No real-learner evidence: the misses are synthetic (spoken-miss ids, the 09-07 bench) or documented.

## What was built

| Mode | Help | Simplify |
|---|---|---|
| conclude | `model_case`, `answer_frame` ("A robin ___."), `shared_term` | none (mode floor) |
| deny | `model_case`, `answer_frame` ("___ because ___"), `shared_term` | none |
| cannot_tell | `model_case`, `answer_frame` | `counterexample_card` |

- **Spare rules (R3):** the generator now asks for six rules and ships truth-reviewed rules the session does not use, sharing no content word with it, as `spares`. A spare with a lookalike is reserved before the session is filled when the rest keeps the case floor; if none results, one extra call writes two spares against the session's own words. Code swaps them in at runtime with no LLM call.
- **Model (R1):** the spare worked through yes, no and, when it has a lookalike, can't tell, each with its reason, so the card points at no answer.

### Content defects found and fixed in the slice

| Defect | Evidence | Fix |
|---|---|---|
| No spare ever passed: every animal rule's `kindNoun` ("animal") counted as a shared content word | probe: 0 spares in 3/3 | kind noun excluded; "-ed" stemmed |
| flash-lite filled `lookalikes` with members (duck, owl, swan for "birds have feathers"); the review trimmed them, and cannot_tell sessions shipped with 0-1 rules | probe with the route's grade string: 0 or 1 rule in 4 of 6 cannot_tell runs | schema field renamed `notCategoryButHasProperty` (mapped in code); prompt names good and bad rule choices |
| The truth review truncated or timed out on six rules, and a session shipped empty | probe: 1 truncation, 2 × 504 | review `maxOutputTokens` 16384 and one retry of the call |

After the fixes, with the route's grade string: every session had 2-4 rules, and 5 of 6 runs had a usable spare.

### Class finding: the offer cap

Running the live-activity suite (not run in families 1-4) found four DI adapters over the 2000-character offer cap, where the backend closes the socket: letter-sounds 2204, shapes 2093, deduction 2038, worked-procedure 2031. The guidance of all four was rewritten shorter with the same rules; a replay of shapes, worked-procedure and letter-sounds after the trim kept 0 flags and their earlier fixes (decision framing 0/30, shape descriptions 0/10). The per-family gate now runs `components/live-activity` too.

**Size:** 170 lines of lever module and about 150 of component, generator and catalog change, against 230 lines of new tests and a 40-line probe.

## Measured

| Gate | Result |
|---|---|
| Unit (`diDeductionLevers.test.ts`, 15) | content words; spares never leak on the saved payloads; the model's three cases; a cannot_tell model needs a lookalike; every saved item has a model whose fact never states its conclusion or names its lookalike; frames; shared_term never on cannot_tell; counterexample builder; starting positions; miss → lever; every catalog miss answered |
| Mounted (`DiDeduction.levers.workspace.test.tsx`, 3) | easy model shows yes/no/can't tell on a different rule; frame and lit words, next try carries both; counterexample practice prints its lookalike, ungraded, then the full case credited |
| Dry journey J1-J9 | 3/3 payloads |
| typecheck | lumina 0; live-activity + DI suites 2729 pass |
| Text replay (Flash, 3 payloads × 5) | 0 flags by the checks. Read by hand: 4 of 20 cannot_tell lines stated the reason for the child's own rule ("it does not say only birds lay eggs"). Guidance now forbids it: statements gone, but 3 of 5 "stuck" lines still ask it as a question ("does the rule say only birds lay eggs?") |

## Not covered

- **Leading "only" question on a stuck cannot_tell case** (3/5 replay lines). It names the reason as a question. Left for the class Live gate to measure; if Live shows it, the fix is a cannot_tell-specific `does` on the practice lever.
- A cannot_tell item with no spare that has a lookalike gets no model or practice lever (about 1 run in 6).
- Not browser-checked (HUMAN-CHECKS #183, deduction row). No Live run: the DI class gate waits for all 37 DI modes.

## Next

DI family 9, di-spoken-practice (plan step 7).
