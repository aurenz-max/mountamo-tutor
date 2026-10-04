# genre-explorer levers: literacy G2-6 family 3 (2026-10-04)

`/add-support-tiers`, plan `qa/support-levers/literacy-lever-plan-2026-10-03.md` step 3. Table and failure inventory: `qa/support-levers/genre-explorer-lever-table-2026-10-03.md` (rulings R1-R9 taken as recommended; R4 allows genre names on a model card for kinds off the menu). No real-learner evidence: the misses are the spoken-miss ids, the 08-17 Live DI reports and `commonStruggles`.

## What was built

| Action | Help | Simplify |
|---|---|---|
| check-feature (identify_basic, classify_genre) | `read_again` (grades 1-2), `sentence_rows`, `text_model` | none (already the smallest action) |
| pick-excerpt (compare_genres) | `two_checks`, `read_again` (grades 1-2), `pair_model` | none (one text is the yes/no step) |
| name-genre (all) | `kind_pair_model` (not identify_basic), `read_glosses` | `two_far_kinds` (not identify_basic) |

- **Pool (R2):** `genreModels.ts`, 15 hand-written texts over all 14 specific kinds, each with one feature found in its words.
- **Misses:** per-mode lists replace the shared six, so no mode lists a miss its actions cannot show; new `said_broad_kind` (the broad side named where the menu lists specific kinds; never a form the answer accepts).
- **Guidance:** two sentences reworded for the levers ("Nothing marks the kind of this text until credit; models name only kinds off the menu", "You cannot point at the text yourself"); 1871 of 2000 delivered.
- **Tier:** easy starts with the rows, the two checks or the menu marks, by action.

**Size:** about 290 production lines (pool 40, lever module 190, component 70, misses 15), against 230 test lines.

## Measured

| Gate | Result |
|---|---|
| Unit (`genreExplorerLevers.test.ts`, 68) | pool names no kind and reads aloud; on every saved payload (6) every item's models are leak-free, the kind pair and practice kinds are off the menu, the practice foil is far and the practice ask answer-free; every miss → a help lever first; per-mode catalog misses answered |
| Mounted (`GenreExplorer.levers.workspace.test.tsx`, 4) | band floor read-again, rows (all styled alike), text model; on a grade-4 hard sibling menu the kind pair names no menu kind, glosses mark every card, the practice menu shares no kind with the session, the full item returns; two empty checks and a pair model; easy starts with the rows |
| R8 class check | three genre rows (one per action) |
| Dry journey J1-J11 | 6/6 payloads |
| typecheck / suites | lumina 0; full tsc 771 (baseline); live-activity + literacy suites 4610 pass |
| Text replay (Flash, 6 payloads × 5) | 0 flags. First run: 7 `no_key_before_try`. Five were the text model voiced as "the answer is yes" (the key, and the runtime's verdict sentinel): the card, fact and `does` now say "this one does …" and forbid yes or no about the model. Two were "tell me: yes or no?", the answer form naming both: a check false positive, fixed in `replay_checks.py` (both verdicts named say neither) with a test; the word-builder and sentence-analyzer replays rescore at 0 |

## Not covered

- The replay limitation from word-builder applies: a tutor's own model pull in the stuck moment is answered with the pre-pull packet, so the tutor sometimes describes a model it has not seen. Live answers with the receipt.
- Not browser-checked (HUMAN-CHECKS #184). No Live run: the class gate (plan step 5) runs when all four families are built.
