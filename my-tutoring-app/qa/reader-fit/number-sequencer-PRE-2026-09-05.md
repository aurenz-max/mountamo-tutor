# Reader Fit: number-sequencer @ PRE — 2026-09-05

Modes audited: count_from, before_after, order_cards, fill_missing (K-claimed; decade_fill is Grade 1 by contract R2) | Probes: eval-test ✓ (count_from, before_after, order_cards @ `grade=K`: dots ON, number line ON, values ≤10) · tutor-test --probe ✓ (0 findings) · K packages hand it `order_cards` at medium tier (4 cards) · live: not run (no ORIENT/STIMULUS finding)

Not a source: `number-sequencer-14h-2026-08-04.md` is the Grade-1 ceiling fix, not a reading-band verdict. Contract `docs/contracts/number-sequencer.md` R1–R9 carries no reader line.

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "Can you start at 1 and count forward?" / "What number comes after 2?" / "Can you put these three numbers in the correct order?" | instruction panel | Load-bearing for before-after (direction) — but the train encodes it: `[2][ ]` vs `[ ][5]` | `[ACTIVITY_START]` + `[NEXT_ITEM]` quote `instruction` | COVERED |
| "Tap cards in the correct order:" / "Your order:" | order-cards labels | Supportive (pool above, numbered slots below) | — | n/a |
| Train cars: numerals + dot arrays (`showDotArrays` at K) | stimulus | Not text | — | n/a |
| "Check Answer" / "Next Challenge" / "Undo" / "Reset" | buttons | Protocol confirm (multi-slot construction) | none | ACCEPTABLE |
| Feedback line (green/red text) | below train | Supportive — spoken `[ANSWER_CORRECT]`/`[ANSWER_INCORRECT]`; slots flash correct/incorrect | spoken + slot state | COVERED |
| Title, "Kindergarten" badge, phase badge, progress dots, "Challenge 1 of 5", description | header | Decorative | — | chrome |

No UNCOVERED load-bearing string. **Audit A passes.**

## Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| count_from | ✓ | ✓ start car + arrow | ✓ direction in the instruction; arrow + mirrored train | ✓ | ✓ "count slowly: 5… 6… what comes next?" |
| before_after | ✓ | ✓ | ✓ blank position + instruction; struggle #4 enacts before/after | ✓ | ✓ |
| order_cards | ✓ | ✓ shuffled pool | ✓ "smallest to biggest" | ✓ slots flash | ✓ |
| fill_missing | ✓ | ✓ blanks in train | ✓ | ✓ | ✓ |

## Audit C — band contract
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 audio is the instruction channel | PASS | |
| 2 tap = choose | PASS (order_cards) / n/a | multi-slot confirm allowed |
| 3 pictures are the answer surface | PASS | numerals + dot arrays |
| 4 ≤5 elements | PASS at K draws (3–5 cars); FAIL at hard-tier order_cards (8 cards + 8 slots) | tier, not band |
| 5 feedback on the touched object | PASS | slot flash + spoken |
| 6 no typing | **FAIL** | count_from / before_after / fill_missing / decade_fill answer through `<input type="number">` — the child must open a keyboard and type a digit. order_cards is tap. |
| 7 no adult chrome | FAIL | grade badge, phase badge, progress dots, "Challenge N of M", description |
| 8 assessment in the mechanics | PASS | |

**Overall: READY on the reading axis; PRIMITIVE-GAP on rule 6 (typed numerals) for the four fill modes; chrome (C-7) systemic.**
Typing a numeral is an answer-modality demand, not a reading demand — it belongs in `answers`, which the pilot tag had wrong (`['manipulate','tap']`; nothing in the component drags).

**Reader field derivation → `reader: 'none'`; `answers` corrected to `['type','tap']` with per-mode overrides (fill modes `type`, order_cards `tap`).**
Findings → fix layer: rule 6 → COMPONENT band-gate at K: replace the number input with a tap-a-numeral picker bounded by `rangeMin..rangeMax` (the ten-frame item-12 / coin-counter shape) — reader-fit BACKLOG 19a; chrome → K-stage systemic.
