# bar-model levers, 12 modes (2026-10-08 class sweep)

`/add-support-tiers` on every bar-model mode except make_graph (which already had levers). The user waived the Phase 2 confirmation stop for this sweep.

## Failure inventory

No real-learner evidence (`logs/demonstrations`, `qa/tutor-reports`, `qa/misconception` have nothing on bar-model). Sources: **synthetic**, from the journey rows' scripted wrong answers (option = another option, row = next row, sticker row off by one, wrong step); **documented**, from catalog `commonStruggles` (ignoring the scale, more/less confusion, reading a picture graph as 1:1, picking the scale step) and `barModelRemediation.ts`; **observed by code**, from the check's own miss ids (`barModelMiss`, `barModelSpokenMisses`). Each lever answers a miss the check names.

Catalog corrections: `picked_icon_count` cannot happen on a scaled bar graph (the check needs a picture key above 1), so read_scale, scaled_bar_graph and graph_word_problem no longer list it. compare_bars has two bars, so the check always says `reversed`, never `other_row`. No `unanswered` entries are needed.

## Lever table

| Mode | Misses | Lever (kind) | What it draws | Leak rule (code) |
|---|---|---|---|---|
| read_one_to_one | another_row | mark_row (help) | the amber mark on the asked row (tier starts it on unless hard) | only where the answer is the row's number (`markRowLeaks`) |
| | one_short … over_by_more | group_fives (help) | a gap after every 5th picture | only if the asked row has more than 5 pictures; no digit |
| | all | simpler_graph | 2 rows, the asked row 2-4 long | never the item's answer or rows (`simplerLeaks`) |
| most_least | reversed | word_model (help, both) | a model in pictures the graph does not use, rows labelled "most"/"fewest" | glyph not on the item, rows not the item's (`wordModelLeaks`) |
| | other_row | group_fives; simpler_graph | 3 rows, the extreme row 3 ahead, a different row is the extreme | |
| compare_bars | reversed | word_model; simpler_graph | the same two bars 5 apart, the other bar is now the answer | |
| match_to_bar | off misses | pile_row (help); simpler_graph | the group drawn again as a row in the graph's columns, not tappable, no row marked | no number, no mark |
| build_one_to_one | rows_swapped, several_rows_off, off | sort_pile (help); group_fives; simpler_graph | the pile sorted one line per kind, in row order; 2 kinds, a sorted pile | no number |
| say_what_it_shows | reversed_comparison, no_comparison / same_for_different | word_model ("more"/"fewer") / group_fives | | as above |
| compare_two_graphs | rows_not_graphs, same_for_different / reversed_comparison, no_comparison | pair_rows (help) / word_model | each kind's morning and afternoon rows next to each other | no number |
| read_scale, scaled_bar_graph | another_row, one_step_off, off | mark_row; guide_line (help); minor_ticks (help, step > 1); simpler_graph (step 1 or 2 axis) | dashed line from the asked bar's end to the axis; unlabelled marks at every 1 | no number written; numbered ticks unchanged |
| picture_graph | picked_icon_count, one_step_off, off / another_row | icon_values (help); simpler_graph (1 picture = 2) / mark_row | the key's number under every picture, never a running total | the prompt's "stands for N" is rewritten for the easier graph |
| graph_word_problem | another_row / one_step_off, off | mark_bars (help) / bar_values (help), minor_ticks; simpler_graph (two-bar "how many more", axis by 1) | the bars the question names marked; bars' numbers | bar_values is withheld when the answer equals a bar (`barValuesLeak`) |
| build_graph | rows_swapped, several_rows_off, off / wrong_step | data_beside (help) / step_marks (help) | the question's own number beside each row's buttons; marks each step needs to reach the learner's tallest bar | data_beside only if every number appears next to its label in the prompt (`dataBesideLeaks`); step_marks refused before a bar is set, no step marked as best |

## Gaps per item (saved payloads)

- read_scale, picture_graph, scaled_bar_graph: when the tier already marks the row, `another_row` has no fresh row lever. `guide_line` also answers it on scaled graphs. On picture_graph the gap stays: the mark is on and no other lever helps a learner who reads the wrong row.
- read_one_to_one with the asked row of 5 or fewer pictures: there is no group_fives, only the easier graph. With 2 or fewer pictures there is nothing.
- compare_bars with bars already 4 or more apart (all saved payloads): there is no easier graph, only word_model.
- No simplify on build_graph: the "best step" key is chosen by the generator with no code rule to rebuild it. No simplify on the two spoken modes (help only).
- Starting positions: the tier fields that already existed (`showTargetHighlight`, `showBarValues`) are published as pulled levers and are not recorded as pulls. New levers start bare at every tier. The generator is unchanged.

## Built

- `barModelLevers.ts` (new): the lever declarations, leak rules, `simplerGraph` builders for 8 modes, `leverFacts`, and `leverRefusal`.
- `BarModel.tsx`: one lever and practice path for every mode. make_graph still uses its own levers. The help renders are the five gaps, guide line, minor ticks, icon values, pile row, sorted pile, word model, paired rows, data beside and step marks. Try again on an easier graph now reopens that graph. Before this change it reset to the full graph's rows.
- Catalog: the miss-list corrections above. Journey row: rebuilds `~simpler` (and make_graph's `~two`) items from their parent.

## Tests

- `barModelLevers.test.ts`: 32 tests (miss → nextLever table, every leak rule, catalog misses fully answered on the payloads, simplify builders over 2700 generated items).
- `BarModel.levers.workspace.test.tsx`: 6 mounted tests. They cover a pull changing the screen and the scene fact in one commit, the lever recorded on the next attempt, refused pulls leaving the screen, levers and attempts unchanged, the easier graph staying ungraded and kept on retry, and the full graph coming back blank and credited.
- Existing bar-model suites: 13 files, 167 passed. Journey sweep filtered to bar-model (`-t bar-model`): 13 passed. `typecheck:lumina`: 0 errors.
- Not run: tutor replay and Live runs. Not checked in a browser: the new renders were checked only in jsdom, not by eye.

Size: about 330 production lines (levers module plus component) and about 430 test lines.
