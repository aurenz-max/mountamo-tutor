# vocabulary-explorer W1 binding (ROLLOUT C34), 2026-10-16

**Shape P, three modes, all bound** (explore, recall, apply). Levers in `../eval-reports/vocabulary-explorer-levers-2026-10-16.md`. Not committed.

## Verdict on the old screen, and what changed
The old primitive did not do what its modes said. Gemini wrote every challenge, its options and its key, and the
component ignored the pin's descriptions: explore said "term cards still visible" (they were hidden), recall said
"without definitions visible" (true only because every mode hid them). The fill-in-the-blank sentence was usually the
card's own example sentence with the word cut out, so it tested recognition of a sentence the learner had just read.
The match column was shuffled per render. The score counted cards opened (30%). A learner had to open every card
before the check unlocked, which forced clicking, not reading.

Rebuilt so that code builds and keys every item from the word bank (`vocabularyExplorerWorkspace.ts`). Gemini writes
only the bank: 6-8 words, each with a meaning, an example sentence (on its card), a second sentence that uses the word
(`clozeSentence`, never shown on the card) and a short situation that never names it (`scenario`).
- **Study first, every mode.** The word cards (meaning, example, related words, origin) open the activity; the check
  starts when the learner presses Start the check, and the cards close for good. On the workspace path the scene is
  `readyForResponse: false` while the cards are open, the task is the study task, and no lever is offered.
- **match** (explore 2 items; recall 1): tap a word, then its meaning. easy 3 pairs, medium 4, hard 4 with one extra
  meaning that goes with none. The meaning column is never in the word column's order, and a meaning that names a word
  of its match is never used.
- **fill_blank** (recall 2; apply 1): the `clozeSentence` with the word blanked (else the card's example); choose the
  word. easy 3 choices whose other words are another kind of word; medium 4 at random; hard 4 whose other words are
  related to the answer or of the same kind.
- **context** (apply 2): the situation; choose the word. Choices as fill_blank.
- A sentence or situation that contains the word or a form of it ("condense" for "condensation") is never used; a
  choice word that appears in the clue is never offered.
- **Generator**: one call for the bank, then one judge call listing every choice that also fits each clue; a listed
  choice is never offered beside that answer again, and the items are rebuilt (two rounds at most). Code cannot read
  meaning, so this is the only guard against two right answers ("steam rises from a pot": vapor or evaporation).
- **Legacy payloads** (model-written challenges) are rebuilt from their bank and their challenge types; their sentence
  is the card's example (no `clozeSentence`) and their situation is the meaning (no `scenario`).

fill_blank and context are `speech` with `acceptsGesture` (J14), judged by `vocabExpectedAnswer` when spoken and by
`vocabCorrect` when tapped (tap, then Check Answer). match is a gesture. Misses (`vocabMiss`; spoken ids are the same):
match `extra_meaning`, `swapped_pair`, `several_wrong`; choice `related_word`, `wrong_kind_of_word`, `other_word`.

## Rulings (closed 2026-10-16) (removed or reshaped)
**Accepted by the user 2026-10-16** (`../HANDOFF-r1-batch4-rulings-2026-10-16.md`): R5 `identify` removed, R16 cards close during the check, R18 accuracy-only score, R27 second flash-lite call kept (reject rate measured on `/oracle-test vocabulary-explorer`).
- **The "open every card" gate is gone.** Start the check is always available; the count of cards opened is shown and
  still reported (`termsExplored`), but it no longer scores 30% of the result.
- **The cards close during the check in every mode.** explore's old description promised them visible; matching words
  to meanings with the meanings on the cards is a lookup. explore's guided support is now the `show_examples` lever.
  The catalog description of explore was rewritten to match.
- **The `identify` challenge type (pick the definition) is gone**; no mode listed it. Legacy payloads drop it.
- **The scripted messages `[ALL_TERMS_EXPLORED]` and `[RELATED_WORD_CLICKED]` are gone** (scripted path only);
  `[CHECK_STARTED]` replaces them. The catalog `tutoring` block stays for the scripted fallback, with those directives
  updated.
- **The generator makes a second Gemini call** (the fit judge), flash-lite, one per generation, up to two.
- Eval-mode ids and betas unchanged; `problem_type_registry.py` not touched. Catalog eval-mode descriptions and the
  entry's description and constraints were rewritten.

## Gates
- `typecheck:lumina`: 0 errors in these files. The run shows 2 foreign errors (`EngineeringPrimitivesTester.tsx`,
  `VehicleComparisonLab.workspace.test.tsx`), other agents' files mid-edit. Full `tsc` not run (orchestrator).
- `VocabularyExplorer.workspace.test.tsx` 13/13 (three modes bind behind the study phase, the key off the screen and out
  of the scene; match swap and extra-meaning misses, Try again, `show_examples`, `fewer_pairs` practice and return;
  sentence and situation misses, all three choice levers, a spoken word that completes and submits once; pure rules
  over 12 built sessions per mode: valid, structural tiers, every miss answered by a help lever first, no clue or lever
  names the key, the smaller match shares no word with its item, legacy rebuild).
- `misses.test.ts`, `lessonWorkspacePlan.test.ts`, `pip/ExhibitWorkspaces.surface.test.tsx` (opens unscoped: no Pip
  surface on the cards), oracles: 35 files, 871 passed.
- Oracle rewritten for code-built items (`service/qa/oracles/vocabulary-explorer.ts`: bank membership, key among
  choices, no form of the key in the clue, one blank, no meaning naming a word of its match, column not aligned, every
  task of the mode present); 6 cases; 0 violations on the three payloads.
- Payloads `w1-payloads/vocabulary-explorer.{explore,recall,apply}.json` (explore hard, recall medium, apply hard,
  Grade 4, the water cycle). `workspaceContract.test.tsx` 13/13 on them.
- Sweep: 0 findings J1-J14 on the three payloads; misses named 2/2, 3/3, 3/3. Advisories ("scene facts contain the key")
  come from the choice list, which is on screen.

## Replay (gemini-3.8-flash, `TUTOR_REPLAY_ITEMS=all`, 8 items x 5 samples, `--observe`; `replay/vocabulary-explorer-2026-10-16{,-r2,-r3}.json`)
Read every start, miss, stuck, lever and credit reply on each run. Empty replies are 429 rate limits (other agents
replaying at the same time): 10 in r1, 3 in r3.
- **r1.** Automatic checks: 0 flags beyond the 429s. By reading: the tutor put the scene into the words of the right
  meaning on sentence and situation items ("see which one describes the liquid turning into a gas when warmed by the
  sun", apply#2 stuck 4/5; "which word best describes water gathering together in one place", recall#2 stuck 4/5),
  and said what kind of word the blank needs once the choices were labeled ("which action word describes what happens
  to the ice cube?", recall#3 miss 3/5, lever 3/5; melt was the only verb).
- **Fixes.** Guidance: never put what is happening into the words of the right meaning, read the clue as written and
  ask about it; never say what kind of word the blank needs; never name an idea from one meaning for the learner to
  look for. Lever text: `tag_word_kinds` and `show_meanings` say the same.
- **r2.** Paraphrase into the meaning gone; kind-of-word stated 0/15. Two new: the tutor read every meaning aloud after
  `show_meanings` (6 replies, flagged by `no_key_before_try` because the key's word is read with the others), and 2/5
  recall stuck replies named the contrast between two meanings ("whether each one talks about warming up into gas or
  cooling into droplets"). Guidance: the learner reads the meanings, read aloud only when asked, every one; and the
  contrast sentence above.
- **r3.** No automatic flags. By reading, no reply states a key, points to a choice or meaning, names a kind for the
  blank, or claims something not on screen. Study-phase replies welcome the learner and point to Start the check
  without asking the check's questions. Credit replies cite the learner's own work.

Shared lever doctrine (counted only, not this primitive's): first-person lever narration ("I've added the example
sentences") in most miss replies in all three runs.

## Undriven modes
None. The sweep drives Start the check, match taps (`term-<n>`, `meaning-<n>`) and choice taps; the workspace test
drives a spoken answer on a situation item.

## Open findings
- Two right answers on a clue: the fit judge is not measured. The saved apply payload after it ran still offers
  "vapor" beside "evaporation" for "a wet shirt ... dries out because the wetness goes into the air" (defensible, not
  clean). Needs N generations read by hand or a judged check. `/eval-test` (then `/oracle-test` cannot see it: meaning).
- The model writes nearly every word of a science bank as a noun (2 verbs in the 9 banks generated today), so
  `tag_word_kinds` and the easy tier's other-kind foils rarely apply. `/eval-test` on a language-arts topic.
- Needs a browser check: the study cards, the match board (pair numbers, the extra meaning), the lever text inside the
  choice buttons. Only JSDOM has run it. `/eval-test`.
- No `docs/contracts/vocabulary-explorer.md`; the new requirements (code keys, cards close at the check, no form of the
  key in a clue, the extra meaning on hard) are recorded only here. `/primitive-contract`.
- The spoken path is not swept (the row taps), so the spoken-miss probe has no requests. `/eval-test`.
- `replay_checks.py` `no_key_before_try` flags a tutor reading every on-screen meaning in order (r2, 6 replies): the
  key's word is read with the others. `/add-live-tutor-tools` (replay checks).

## Follow-up 2026-10-16 (R27)
- The fit judge's effect, 12 generations (4 per mode): it runs only when an item has choices (explore has none);
  over 20 choice items it removed 5 foils a careful reader could defend (0.25 per choice item), 0 judge failures.
