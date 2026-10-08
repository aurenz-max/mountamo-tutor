# syllable-clapper — `build_parts` open build (OB-8L), 2026-10-08

Built in an agent worktree from 1f2e7854, merged into the main tree with `tools/merge_wt.py` (clean) and gated on a
clean checkout of the commit.

## Surface reused, and why

The letter build surface (`LetterBuildSurface.tsx` + `letterBuild.ts`) with a new ask kind `syllables`. Not
rhyme-studio's picture surface: a syllable ("ter", "na") has no picture. The letter surface already had the bank,
"I'm done!" through the workspace progress hook, Try again keeping the work, `ways: 2` on every second item (off at
the easy tier), the small-bank practice item and the `only: 'real_word'` judge call. Pre-readers hear every card,
the task, their own word ("Hear my word") and the model through the kit's `LuminaReadAloud`, each a silent host
request to the tutor (rhyme-studio's `sayNameRequest` pattern).

## Design

- **Task.** "Make a word with three parts." (2 or 3 at K; 2, 3 or 4 at grade 1.) Cards tap into a row that grows one
  card at a time and shows one empty slot, never N, so the layout does not count for the learner. Words the seed list
  does not name pass (but + ter = butter).
- **Judge.** Code counts the cards, lowering the count when cards run together into fewer vowel sounds ("to" + "o" =
  too; a vitest pins every seed word at its own count). The shared `judgeWordBuild` (`only: 'real_word'`, request
  unchanged) decides only whether the word is real; it is never asked for a number.
- **Misses:** `too_few_parts`, `too_many_parts`, `counted_letters` (one card per letter: "pop" for three parts),
  `same_word`, `pick_another`, `not_a_word`. Verdicts never give the count of the learner's word.
- **Levers** (bare): `clap_cards` (help: a 👏 under each placed card, `data-aid`), `model_word` (help: a word from
  other cards with a different count, spoken in parts), `small_bank` (simplify: a two-part ask from four cards,
  ungraded). `same_word` and `pick_another` are unanswered.
- **Banks** come from `syllableBuildWords.ts` (59 familiar words with splits; dialect-variable words, run-together
  syllables and consonant + e cards excluded). Each bank holds 3 words with the asked count (2 for four) plus one
  with another count. No seed word's parts sit side by side (code gate + oracle check). Counts vary across a
  session, never twice in a row; no word answers two items.
- **Scene facts:** `partsPlaced`, `learnersWord`, `cardBank` (tested: `partsPlaced 0 → 4 → 3`).
- **Generator.** Pinned `build_parts` makes no model call; intent routing that resolves to the build serves it; a
  blend with the build generates its spoken acts only (one payload, one shape).
- Catalog β 2.6 (count_parts + 0.1), `answers: ['build']`, misses, a guidance sentence (never say a fitting word,
  which cards, or how many parts the learner's word has); backend prior; new oracle `syllable-clapper`.

Size: ~350 production lines (`syllableBuild.ts` 240, seed list 33, ~70 in host/surface/adapter), oracle 79, tests 234,
probes ~140. `letterBuild.ts` +21/−4 (one-line dispatches); new surface behaviour sits behind `isOpenRow(kind)`.

## Gates

| Gate | Result |
|---|---|
| `SyllableBuild.workspace.test.tsx` | 11/11, including 400 random K/G1 sessions through the gate and oracle (0 violations) and runtime drives of miss → Try again → pass, levers, simplify, ways-2 |
| vitest (worktree): live-activity, literacy, qa, service/literacy, catalog, pip | 301 files, 6,707 pass, 0 fail |
| `typecheck:lumina` / full tsc | 0 / 770 = baseline |
| journey sweep | `build_parts` is J1 by design in the baseline (judge-checked, like the other literacy builds); spoken payloads no findings |
| real generator + oracle | 7 sessions, 20 build items, 0 violations, 0 adapter rejections |
| real judge, labelled set | 40/40: 20 real words (incl. butter, cater, baby from cross-word cards), 20 real-syllable non-words (bafly, napcorn...); 0 false passes, 0 false rejects |

Artifacts here: `generator-run.json`, `pinned-*.json`, `intent-K.json`, `spoken-count-K.json`,
`blend-count-build-K.json`, `journey-sweep.json`, `labelled.json`, `calibration-s1.json`, `calibrate-syllables.mjs`.

## SYC-1

Left open for `/eval-fix`: the fix needs a session-level rule (≥2 distinct counts), a redraw when it fails, and a prompt
line, not a one-line spread. The two spoken K draws in this run did spread counts (1/2/3), so it may be G2-specific.

## Not verified

- No browser drive (tap feel, hear buttons with a live tutor, 9-11 card bank wrapping, phone width).
- No Live run; rides the literacy class Live gate.
- No contract doc exists; the build-mode fork entry is owed when one is derived.
- The beat guard is a heuristic that only lowers the count; a rare word with vowels across two cards (di + et = diet)
  could be wrongly refused; "lion" (li + on) is dialect-variable and refused.

## Rulings owed

1. β 2.6 unrated.
2. No model call; topic-free title "Make Words From Parts" (R8); seed words not themed to the lesson topic.
3. Workspace grades stay K and 1, so 4-part asks reach grade 1 only.
4. Cards are printed as well as voiced. Pictures only for pre-readers? A syllable has no picture.
