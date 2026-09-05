# Reader Fit: number-tracer @ PRE — 2026-09-05

Modes audited: trace, copy, write, sequence (all four are K-claimed: "0-20 for K") | Probes: eval-test ✓ (4 modes @ `grade=K`, 5 challenges each) · tutor-test --probe ✓ (0 findings, every key resolves from the component) · live: not run (no ORIENT/STIMULUS finding to confirm)

Purpose: the Lesson Bench item-15 reader verdict — `number-tracer` is in every K counting package and carried no `reader` field.

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "Trace the number 1!" / "Copy the number 2!" / "Write the number 3!" | LuminaPrompt | Supportive in trace/copy (the dotted ghost numeral + green start dot + arrows ARE the task); load-bearing in write (the digit lives only here) | `[ACTIVITY_START]` and `[NEXT_ITEM]` both carry `instruction` + `digit` with "Introduce" | COVERED (the numeral inside the sentence is not text) |
| "What's the missing number? Fill in the blank!" + `0, ?, 2, 3` | sequence panel | Supportive — the `?` slot in a numeral run is self-evident | same moments | COVERED |
| "Write the missing number below" | sequence panel caption | Decorative | — | n/a |
| "Model" | copy panel caption | Decorative | — | n/a |
| Hint ("Start at the top and pull straight down.") | after 2 attempts | Supportive | `[ANSWER_INCORRECT]` → "Give a hint" | COVERED |
| "Check" / "Clear" / "Next" / "Finish" | buttons | Protocol — Check is the confirm on a multi-stroke construction (rule 2 allows it) | none; one primary button after drawing | ACCEPTABLE (position, not decoding) |
| "Excellent writing!" / "Good job!" feedback card, `87%` badge | feedback | Supportive — the tutor speaks `[ANSWER_CORRECT]`/`[ANSWER_INCORRECT]` | spoken | COVERED, but see C-5/C-7 |
| Title, description, "Kindergarten" badge, "1 / 5" counter | header | Decorative | — | n/a (chrome) |

No UNCOVERED load-bearing string. **Audit A passes.**

## Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| trace | ✓ `[ACTIVITY_START]` quotes the instruction | ✓ ghost numeral on canvas | n/a | ✓ spoken + card | ✓ struggles say "green dot", "follow arrows" — eyes-free |
| copy | ✓ | ✓ model panel (numeral) | n/a | ✓ | ✓ |
| write | ✓ `[NEXT_ITEM]` names the digit | ✓ spoken digit | n/a | ✓ | ✓ |
| sequence | ✓ | ✓ numeral run with `?` | ✓ "missing number" is stated | ✓ | ✓ "count aloud from the first number" |

Note (not a reader finding): `[NEXT_ITEM]` hands the tutor `digit: N` in sequence mode, where N IS the answer, with "Introduce briefly" — an answer-leak invitation in the spoken intro. Tutor-reference in the bag is fine; the moment text should not invite saying it. Queued below (19c).

## Audit C — band contract
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 audio is the instruction channel | PASS | both moments carry the instruction |
| 2 tap = choose | PASS | Check is a multi-stroke confirm (allowed) |
| 3 pictures are the answer surface | PASS | the canvas |
| 4 one thing per screen, ≤5 elements | PASS | canvas + 2 buttons |
| 5 feedback on the touched object | PARTIAL | text card + `%` badge; the stroke itself does not react. Spoken feedback carries it |
| 6 no typing | PASS | |
| 7 no adult chrome | FAIL | grade badge, "1 / 5" counter, `87%` score badge, description paragraph — inside the card, so the K stage does not hide them |
| 8 assessment hides in the mechanics | PASS | tracing IS the measure |

**Overall: READY on the reading axis (Audit A + B clean at PRE); PRIMITIVE-GAP on chrome (C-7, C-5).**
The chrome finding is the systemic K-stage case (BACKLOG "Systemic items"), recorded, not fixed here.

**Reader field derivation → `reader: 'none'`** (the child's own path after read-aloud needs no reading: numerals, a ghost digit, one confirm button). `answers: ['manipulate']` (finger/stylus on canvas) confirmed.
Findings → fix layer: C-7/C-5 chrome → COMPONENT band-gate, or K-stage systemic; `[NEXT_ITEM]` digit-in-moment at sequence → COMPONENT (reader-fit BACKLOG 19c).
