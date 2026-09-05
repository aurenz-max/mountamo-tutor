# Reader Fit: hundreds-chart @ PRE — 2026-09-05

Modes audited: highlight_sequence (the K mode by catalog constraint), complete_sequence (same surface), identify_pattern, find_skip_value (Grade 2-3 by constraint, but the generator honours a K pin on a 1-10 board, so both were probed) | Probes: eval-test ✓ (3 modes @ `grade=K`, topic "Counting objects to 10" → `gridMax 10`, `gradeBand '1'`) · tutor-test --probe ✓ before and after the fix · live `--lesson --runs 3` ✓ (see Loop log)

Not a source: `hundreds-chart-14i-2026-08-04.md` is the grade-band resolver fix, not a reading-band verdict.

## Audit A — text census (before the fix)
| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "Tap every number in order, all the way to 10." / "…in the skip-counting-by-2s pattern…" | LuminaPrompt | Load-bearing (what to do, which pattern) | challenge 1: **none** — the component fired no `[ACTIVITY_START]`; only `[ANSWER_*]`, `[NEXT_ITEM]`, `[ALL_COMPLETE]`. Challenges 2+: `[NEXT_ITEM]` quotes the instruction | **UNCOVERED at challenge 1** (standalone). In a lesson the K stage's `[SECTION_START]` / greeting gives the tutor `{{instruction}}` under a one-sentence cap, with no directive telling it to say the instruction |
| "Click or drag across cells to select them" | sub-line | Supportive | — | n/a |
| Grid cells `1..10` | stimulus + answer surface | Numerals, not text | — | n/a |
| identify_pattern options: "Every other cell in each row", "They fill every row completely", "A single diagonal line" | LuminaAnswerChoice | Load-bearing — the answer surface is sentences | none | **UNCOVERED** — text-only answer surface |
| find_skip_value options: "1", "2", "3", "5" | LuminaAnswerChoice | Numerals | question via `[NEXT_ITEM]` | COVERED (the concept is G2-3; not a reading matter) |
| "Check Answer" / "Next Challenge" | buttons | Protocol confirm on a multi-cell selection | none | ACCEPTABLE |
| Feedback card | below grid | Supportive — cells stay painted; tutor speaks | spoken | COVERED |
| Title, description, "1 / 7" counter | header | Decorative | — | chrome |

## Audit B — sufficiency contract (before the fix)
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| highlight_sequence | **✗ challenge 1** (no moment; no directive) / ✓ from challenge 2 | ✓ board | ✓ instruction names the pattern, once spoken | ✓ painted cells + spoken | ✓ "say each number out loud as you click it" |
| complete_sequence | same | ✓ given cells painted | ✓ | ✓ | ✓ |
| identify_pattern | ✓/✗ as above | ✓ | ✗ options are sentences | ✓ | ✓ |
| find_skip_value | ✓/✗ as above | ✓ | ✓ | ✓ | ✓ |

## Audit C — band contract
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 audio is the instruction channel | **FAIL → fixed** | challenge 1 had no spoken instruction |
| 2 tap = choose | PASS | multi-cell selection + confirm |
| 3 pictures are the answer surface | PASS (highlight/complete: numerals on a 1-10 board) / FAIL (identify_pattern: sentences) | |
| 4 ≤5 elements | PASS at K (10 cells + Check; the cells are one surface) | |
| 5 feedback on the touched object | PASS | cells paint on tap; card + spoken after Check |
| 6 no typing | PASS | |
| 7 no adult chrome | FAIL | counter, description — K-stage systemic |
| 8 assessment in the mechanics | PASS | |

**Overall (after the fix): READY on the reading axis for highlight_sequence / complete_sequence / find_skip_value; WRONG-BAND @ PRE for identify_pattern (text-only answer surface by design — a Grade 2-3 mode).**

**Reader field derivation → primitive `reader: 'none'`; `identify_pattern` override `reader: 'developing'`** (the add-affordances rule: WRONG-BAND @ PRE whose cause is a text-only answer surface).

## Loop log
| iteration | change | check | re-audit |
|---|---|---|---|
| 1 | Tier 1 SCAFFOLD-GAP: `HundredsChart.tsx` fires `[ACTIVITY_START]` (silent) with the first instruction, mirroring number-tracer / number-sequencer / fast-fact; catalog `aiDirectives` gains "SAY THE INSTRUCTION — THE STUDENT MAY NOT BE ABLE TO READ IT" ({{instruction}}, overrides the one-sentence cap) so the beat survives the lesson greeting / `[PRIMITIVE SWITCH]` path | `typecheck:lumina` 0, full tsc 802 = baseline; tutor-test --probe: `sendTextTags` now include `ACTIVITY_START`, the directive renders with `instruction` resolved by the component; hundreds-chart vitest 2 files pass | Audit A: challenge-1 instruction COVERED; Audit B ORIENT ✓ |
| live | `run_tutor_live.py --component hundreds-chart --lesson --runs 3` (generic journey — greeting, "What should I do first here?", "Just tell me the answer"; content is the harness's G1 1-100 draw, not a K board) → `qa/tutor-reports/hundreds-chart-live-lesson-2026-09-05.md` | **ORIENT confirmed 3/3:** every greeting spoke the instruction ("…tap every number in the skip-counting-by-2s pattern, all the way to 100"), and every orientation turn enacted it ("start by tapping the number 2, then count by 2s"). Answer-fish refused 3/3. **Harness verdict FAIL on `tag-syntax-spoken` 2/3** — on the orientation and answer-fish beats the tutor recited the `[CURRENT STATE]: {…}` block before answering (run 1 with the harness's «runtime:» placeholders, run 3 with the JSON). Known class on the generic journey (formula-lab 08-23, word-sorter lesson 07-14); the run-1 greeting also opened on "states of matter", the harness's default lesson frame. Not a reader finding; if it recurs on a bespoke hundreds-chart journey, route to the TUTOR queue per [[prompt-fix-vs-transport-defect]] (find who sent the state block as a turn) | ORIENT ✓ live |
