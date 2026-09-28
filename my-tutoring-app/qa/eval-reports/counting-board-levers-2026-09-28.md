# counting-board levers — 2026-09-28

`/add-support-tiers`, handoff 21 M1. The lever table the user approved is in
`qa/support-levers/m1-lever-tables-2026-09-28.md`; the requirement is contract R15.

## What was built

- `countingBoardLevers.ts` (pure): 5 levers, their `answers`, leak rules, `smallerGive`, `droppedHand`, and `leverFacts` (scene facts, no numbers).
- `CountingBoard.tsx`:
  - lever state keyed by the session item; the easier ask shown as practice in place of the item;
  - handlers read the item on screen;
  - running count and tags driven by the levers on give_me_n;
  - `line_up` overrides the arrangement; `two_hands` filters the hands.
- Catalog `levers: true`.
- Journey row: drives hand picks (`hand-N`) and the easier ask.
- New payload `counting-board.subitize_perceptual.json` (one generation call).

## Gate

| Check | Result |
|---|---|
| `countingBoardLevers.test.ts` (nextLever table, leak rules over 30 boards, saved payloads) | 50/50 |
| `CountingBoard.levers.workspace.test.tsx` (pull changes the DOM and scene in the same commit; practice returns to the full item; only the unaided answer is first-try; removed hand is assisted) | 4/4 |
| Sweep J1-J9 on give_me_n, count and subitize_perceptual payloads | green |
| live-activity + math + manifest suites | 147 files green |
| `typecheck:lumina` | 0 in these files. The 4 errors in `cvcSpellerLevers.ts` belong to the parallel literacy session |
| Full tsc (excluding those 4) | 773, the baseline |
| Replay, 3 payloads × 5 | clean after two fixes (below) |

## Found by replay

1. **`two_hands` wording spoke a number.** The lever said "takes away one hand, so two hands are left", and on a group of one fish the tutor said "One hand went away … two hands left" in 5/5 samples. That item is pre-numeric. The lever text now carries no number word, and a unit test holds that.
2. **The replay key check had a false positive.** It read "the one that matches" as the key "1". `said_key` now skips pronoun "one" (shared with `said_fix`) and the partitive "one of the hands" (key check only; as an instruction "one of the slices" is still a fix, LB-11). Both cases are pinned in `test_replay_checks.py`.

**Judgment call for the user.** On a pre-numeric item the tutor still says "one of the hands went away". I classified it as naming *which* hand, not *how many* fish. Guidance says pre-numeric items use no number words at all. If that rule is strict, this is a tutor-wording finding for `/add-live-tutor-tools`.

## Not covered

- Spoken kinds have no levers (help-first by `when` text is a later slice).
- There is no real-learner evidence.
- No browser check yet; it is filed with the class.
