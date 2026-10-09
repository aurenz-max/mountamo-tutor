# counting-board levers: subitize_perceptual `one_over` gap (2026-10-08 sweep, built 10-09)

`/add-support-tiers`, class sweep (Phase 2 stop waived by the user on 2026-10-08). Closes J12 queue row
`counting-board.subitize_perceptual` (`qa/support-levers/QUEUE-item-gaps-2026-10-09.md`).

## Failure inventory (subitize_perceptual: 1-3 objects, pick the matching hand from 1/2/3 fingers, no numerals)

| Miss | Class | Lever before this slice |
|---|---|---|
| `one_over` / `one_short` (a hand one finger off) | observed-synthetic (journey sweep wrong pick), `countMiss` | `line_up` only, and it is not offered on a single object or on a group already in a row |
| `short_by_more` / `over_by_more` (the far hand) | observed-synthetic | `two_hands` |

There is still no real-learner evidence. Per-item gap: on the saved payload, c1 and c4 are single fish (target 1), so a pick of the two-finger hand (`one_over`) had no lever. The same gap existed, unsaved, on any group of 2 or 3 drawn in a `line`.

## Lever table

| Mode | Failure (class) | Lever | Kind | Carrier | Leak rule | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| subitize_perceptual | a hand one off, on any item (synthetic) | `pair_up`: the group in a row above the fingers of the learner's last wrong hand, a line joining each object to the finger under it | help | shown | drawn only after a wrong pick, only for that wrong hand (`pairedHand`), never the matching hand; no number in the `does` text or the fact; the fact names what is drawn, not which row has an unpaired member | no | lever + one state + a small SVG strip |

No simplify lever: a group of 1 against three hands is already the plainest shape of the mode, and fewer hands is `two_hands`.

## Built

- `countingBoardLevers.ts`: `PAIR_LEVER`, `pairedHand` (the leak rule), `countingBoardLevers(..., missed)`, scene fact.
- `CountingBoard.tsx`: `missedHand` state, keyed by item, set on a wrong pick and kept across Try again; the `pair_up` strip (`data-lever="pair-up"`) under the hand prompt.
- Contract R15 + changelog; queue row closed; J12 baseline entry for `counting-board.subitize_perceptual` removed. Catalog unchanged: every listed miss now has a lever on every item.

## Tests

- `countingBoardLevers.test.ts` + `CountingBoard.levers.workspace.test.tsx`: 108/108. New: pair_up answers each one-off (target, pick) in scattered, line and groups; the leak rule over every (target, pick); the saved payload has a lever for every one-off pick on every item; the mounted test checks that a pull before a miss is refused and changes nothing, the pull draws 1 object, 2 fingers and 1 line plus the fact in one commit, a refused re-pull changes nothing, the strip survives Try again, and the next pick is assisted with `levers: ['pair_up']`.
- All counting-board suites: 263/263. Journey sweep on this payload only (`-t counting-board.subitize_perceptual`, baseline entry removed): pass.
- `npm run typecheck:lumina`: 0.

## Left

- No browser check of the strip's look. Needs a check on the Pre-K hand-match flow.
- Not run (batch step): full journey sweep and tutor replay.
