# Workspace rollout C8: cause-effect-chain, era-explorer, periodic-table, knowledge-check (2026-09-26)

Queue: [`qa/workspace-rollout/ROLLOUT.md`](../workspace-rollout/ROLLOUT.md) row C8. Executor: `/add-live-tutor-tools`.

## What shipped

The last four runner-era families outside the pilots now run only on the teaching workspace, every catalog mode
(one-path ruling 09-23). periodic-table and knowledge-check keep a non-tutor face for payloads the workspace cannot
run: the exploration table (no challenges) and the tap flow (a set the build gates cannot ask aloud).

| Primitive | Commit | Items | Production (+/−) |
| --- | --- | --- | --- |
| cause-effect-chain | `9971102c` | identify_cause: one spoken yes or no per card. root_vs_proximate: one card named. build_chain: every card tapped into the slots, checked in code once the full board sits still | +262 / −175 |
| era-explorer | `40195b9d` | One spoken pick from the three-part menu the ask states (lens; then, now or both; this era, the one before or both; a cause) | +215 / −191 |
| periodic-table | `a6358ad6` | explore: a checked tap on a box. identify: an element name read off the table. trend: the bigger or more reactive of two, or an outer-electron count | +229 / −138 |
| knowledge-check | `aa9feb4b` | Seven spoken kinds (true/false, spoken menu, match, sort, blank, say_it, how_many) and two checked touches (a symbol menu, a sign in a number sentence) | +270 / −121 |

Production +976 / −625. Tests and payloads +1,359 / −152: four `<X>.workspace.test.tsx` files, seven w1 payloads, and
both runner-mock Pip suites (`StimulusRunners.surface.test.tsx`, `pip/KnowledgeCheck.surface.test.tsx`) ported into the
workspace tests and deleted.

Carried over and now tested on the workspace:

- Each family's judging contract moved into the item's `expectedAnswer`: the accepted short forms (a card's own words or
  its place; a menu choice's distinguisher; a fumbled element name) and each mode's signature miss (a consequence card
  called a cause; "today" on a two-era compare; the group number given as the outer-electron count; the symbol letters
  read back; a word-bank word that does not fit; the item being sorted said back).
- Checked gestures publish no key: cause-effect `build_chain` (`chainMatches`), periodic `find` (`cellMatches`),
  knowledge-check `choice_tap` and `point_to`. A partial chain never commits; removing a card inside the stillness
  window cancels the commit; a miss empties the board.
- knowledge-check's per-problem `::pN` evaluation bridges are unchanged (contract R7; the workspace test checks three
  problems submit three times). Contract changelog records the re-base.
- era-explorer tells the tutor when the hard tier has folded the era cards away, and publishes them once opened.

## Behaviour changes (recorded)

- The tap-to-hear / "Say that again" buttons and mic panels are gone on all four; with the tutor present, the learner asks
  it to repeat. The background and era-card read-alouds stay, as silent host requests for the paragraph.
- knowledge-check: the render-time microphone probe is gone (the runtime owns the mic). A device without `getUserMedia`
  used to get the tap flow; a judged-viable set now binds the workspace there too. Catalog description updated.
- era-explorer: the extra success sound on the reveal is gone (the shared lifecycle plays it once).
- Catalog descriptions that said the tutor's own affirmation advances (periodic-table, knowledge-check) now say a
  credited answer does; cause-effect's constraints say the chain is checked by the activity.

## Smoke drives (`--lesson-entry --progression-only`)

| Row | Result | Raw file |
| --- | --- | --- |
| cause-effect-chain build_chain text | PASS | `cause-effect-chain-w1-build_chain-text-2026-09-26.json` |
| cause-effect-chain identify_cause `--audio` (Grade 2) | PASS | `cause-effect-chain-w1-identify_cause-audio-2026-09-26.json` |
| era-explorer era_sort text | PASS | `era-explorer-w1-era_sort-text-2026-09-26.json` |
| era-explorer cause_of_change `--audio` (Grade 4) | PASS | `era-explorer-w1-cause_of_change-audio-2026-09-26.json` |
| periodic-table explore text | PASS | `periodic-table-w1-explore-text-2026-09-26.json` |
| periodic-table trend `--audio` | PASS | `periodic-table-w1-trend-audio-2026-09-26.json` |
| knowledge-check recall text (Grade 2) | not run: the generated one-problem set was not judged-viable (a 30-word question over the 24-word gate), so a lesson keeps the tap flow; the driver then crashed in `initialState` on the unvalidated payload | `knowledge-check-w1-recall-text-2026-09-26.json` |
| knowledge-check recall `--audio` (Kindergarten) | PASS on a three-problem set (`--input`: three real K generations merged, because the probe generates one problem without lesson objectives and the journey needs two items). A single-problem K set completed correctly and then timed out waiting for a second item | `knowledge-check-w1-recall-audio-2026-09-26.json`, input `knowledge-check-w1-k-set-input-2026-09-26.json` |

Undriven modes, each covered by its workspace test: cause-effect root_vs_proximate; era lens_id and era_compare;
periodic identify; knowledge-check apply, analyze, evaluate and the blank/match/sort/production kinds.

## Findings (recorded, not patched)

- **After a wrong answer the tutor gives or nearly gives the answer** (cause-effect: "could loading mail onto a fast
  steam train help…"; era_sort: "many children today still help their families with chores"; periodic trend: "atoms get
  larger as you move down a group"). Now in ten families; the scoring question stays with `$student-data-loop`.
- **The tutor skipped or replaced the ask on the first item** twice: era cause_of_change opened with "Let's think about
  how modern technology in our homes makes… washing clothes so much easier", which names neither the statement nor the
  menu and points at the answer; periodic trend opened with the rule question instead of the pair. Same shape as C3/C4's
  shortened asks.
- **Model scratch text reached the learner once**: the last knowledge-check turn ended with
  `ant: * Goal: Determine the meaning of the word "extrapolating." <search_query>…`. Same family as C2's markdown and
  C7's LaTeX outputs.
- **The credit line repeats once after the advance** (cause-effect identify, knowledge-check), as in C7.
- **The tutor called `begin_help` at lesson start** on era cause_of_change, before any learner turn, so the first item
  records assistance. Seen once.
- **knowledge-check content fit**: without lesson objectives the generator plans one problem, and at Grade 2 that problem
  failed the 24-word ask gate. In real lessons the set is sized from the objectives (≥2 per objective); how often a
  generated set is judged-viable (workspace) versus the tap flow is not measured.
- cause-effect identify: one generated "cause" (store owners sweeping the floor, for bananas on the shelves) is a weak
  cause; content, not binding.

## Checks

- `typecheck:lumina` 0; full `tsc` 771 = the C7 close (its extra error is the `.next/types` eval-test artifact).
- All Lumina tests: 578 files, 8,096 tests pass (10 skipped).
- The generic W1 contract passes on the seven new payloads.

Human acceptance (browser and mic) remains open under HUMAN-CHECKS #167.
