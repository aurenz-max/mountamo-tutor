# picture-vocabulary — `pair_build` open build (OB-8L), 2026-10-08

Built in an agent worktree from 1f2e7854, merged into the main tree (clean) and committed through a separate index.
Contract R7 added: `pair_build` is the stated second tap mode (R1), with no words on its cards.

## Not an existing mode

`opposite` and `association` are spoken: the child sees one word and says its partner. In `pair_build` the child
starts from an empty tray and makes a pair from a board of 8 wordless pictures; several pairs pass on every board.

## Design

- **Task.** "Find two pictures that are opposites and put them together." or "...that go together...". Tap two
  pictures into the pair tray, then "I'm done!". The relation follows the intent ("opposite" → opposites; "go
  together", "associat", "belong together" → goes-together; otherwise alternating, opposites first). Except at the easy
  tier, every second item adds "Then find a different pair."; the first pair stays on screen and repeating it is
  `same_pair`.
- **Judge: code only.** Every picture comes from `PAIR_PICTURES` (36 opposite pictures over 12 kinds, each with a
  pole; 52 goes-together pictures over 26 partner pairs plus 10 decoys). Opposites: same kind, other pole (happy + sad,
  happy + crying). Goes together: listed partners only (sock + shoe, key + lock, candle + cake).
- **Misses** (none names the answer): `alike` (same kind, same pole; every opposites board carries one),
  `not_opposite`, `same_kind` (sock + hat, per the catalog's association rule; every goes-together board carries one),
  `no_link`, `same_pair` (no lever; the found pair stays on screen).
- **No unfair "wrong" pair on a board.** Authoring-time audit (`clash-audit.mjs`): every unlisted pair (506 opposites,
  1,630 goes-together) shown to gemini-flash-latest as emoji + name, 3 times, batches of 10. Any pair accepted once
  is a CLASH and never shares a board (18 pairs, plus a rule keeping a non-partner animal and food apart). The model
  never judges a child; it only checked the table. Decoys held up: 1/7 alike pairs and 5/122 same-kind pairs were
  accepted, and those 5 became clashes.
- **Layout.** No right pair sits side by side or one above the other on the 4-column grid; adapter and oracle refuse a
  board that breaks this.
- **Levers** (bare): `say_names` (help, voiced: every name once, in board order), `model_pair` (help: a right pair of
  the same relation, off the board, sharing no kind with it), `small_board` (simplify, ungraded: 4 pictures, one
  right pair, apart, plus a decoy).
- **Scene facts:** numeric `picturesInTray` (tested: `0 → 2 → 0`), tray, pictures by name, `waysAsked`, `waysMade`,
  `madeBefore`; no pairing is ever stated.
- **Generator.** Pinned `pair_build` makes no model call: 4 boards per session, 3 right pairs + 2 extras each, no right
  pair on two boards. Unpinned mixed sessions do not include it.
- **Surface reuse, no copy.** `rhymePairBuild.ts` gains a `PairBuildRules` interface and `RHYME_PAIR_RULES`;
  `RhymePairSurface.tsx` takes optional `rules` (defaults to rhyme). RhymeStudio unedited; its 7 tests unchanged.
- Catalog β 3.6 (opposite + 0.1), `answers: ['build']`, misses, unanswered, guidance; backend prior; new oracle
  `picture-vocabulary`.

Size: ~640 production lines (402 table, rules, levers and boards), tests 192, probe and audit ~175.

## Gates

| Gate | Result |
|---|---|
| `PicturePair.workspace` + `RhymePair.workspace` | 16/16 |
| vitest (worktree): live-activity | 35 files, 2,436 pass |
| vitest (worktree): all Lumina | 792 files, 12,824 tests; one load failure = the known missing `artifacts/learning-applicability/report.json` |
| `typecheck:lumina` / full tsc | 0 / 770 = baseline (worktree); re-gated on a clean checkout of the commit |
| journey sweep `pair_build` | 4 items, 0 findings, 4/4 misses named; clean 100, wrong-then-right 67; no baseline exception |
| real generator + oracle | 4 cases × 25 sessions = 400 boards, 0 violations, 0 adapter rejections |

Artifacts here: `clash-audit.json`, `clash-audit.mjs`, `gen-*.json`, `generator-run.json`, `journey-sweep.json`.

## Not verified

- No browser drive: tap feel, emoji rendering on older devices (🪺, 🛞 may not render), the 4-column grid at phone width.
- No Live run or replay of the tutor saying names or answering verdicts; rides the literacy class Live gate.

## Rulings owed

1. `same_kind` wrong for goes-together (sock + hat fails, per the catalog rule; the audit agreed on 117/122)?
2. Opposites decoys use near-synonyms (huge, tiny, freezing) that may be above some K vocabularies.
3. Picture names are concept words (🐆 "fast", 🪶 "light"); a child may say "cheetah". The speaker is the support.
4. β 3.6 unrated; half of a mixed session is the easier goes-together relation (association is 3.0).
5. Pinned build: neutral "Picture Pairs" title, no model call (R8).
6. Big/little appears as big/small (🐘/🐜) plus huge/tiny; one emoji cannot show size directly.
