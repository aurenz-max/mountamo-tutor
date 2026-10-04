# genre-explorer: failure inventory and lever table (2026-10-03)

**DRAFT 2026-10-03**. `/add-support-tiers` Phases 1-2, literacy G2-6 family 3 of 4.
Rulings carried over: literacy leak rules (handoff 22): help on a recognition item acts on a model outside the
session; a spoken answer never becomes a tap; simplify never repeats the learner's item (R3). DI levers (10-02):
"my turn" models a DIFFERENT item, never the learner's. Removing choices is assisted work, never unaided credit.

## Phase 1: failure inventory

Evidence: **no observed-real.** `logs/demonstrations` has no genre-explorer entries; `qa/misconception` and
`service/**/*Remediation.ts` have none. Synthetic = the four 2026-08-17 DI-era Live reports
(`qa/tutor-reports/genre-explorer-live-di-*.md`: scripted wrongs "Folktale" for Fable, "both of them", the feature said
back, the opposite verdict) and the 09-29 dry sweep, which names every spoken miss on all three saved payloads
(identify_basic 4/4, classify_genre 9/9, compare_genres 6/6). These test the judge, not why a child fails.
Documented = catalog `commonStruggles` (six patterns, three of them failures) and the script's strategy lines
(`modelLine`: "Answer from the words in front of you, not from what you expect to be there"). There is no
`docs/contracts/genre-explorer.md` (Phase 3 derives it).

The modes are three Bloom tiers over three **actions**; the action, not the mode, decides what can go wrong:

| Mode (β) | Items it builds (saved payload) |
|---|---|
| identify_basic (2.0) | per text: 1-2 `check-feature` (yes/no), then `name-genre` from Fiction/Nonfiction (4 items) |
| classify_genre (3.0) | per text: 1-2 `check-feature`, then `name-genre` from a 3-6 kind menu (9 items) |
| compare_genres (4.5) | 2-4 `pick-excerpt` (which of two texts), then `name-genre` per text (6 items) |

| Action (modes) | Failure | Class |
|---|---|---|
| check-feature (identify, classify) | gives the opposite verdict: answers from what it expects of that kind of text, not from the words (`opposite_verdict`) | synthetic + documented (strategy line) |
| check-feature | grade 1-2: has lost the text, which was read aloud once on the first item and is not re-read on the re-ask | inferred (the re-ask drops `readAloud` by design); same miss id |
| check-feature | says the feature back with no yes or no (`said_feature_back`) | synthetic + documented |
| pick-excerpt (compare) | names the other text (`other_text`) | synthetic |
| pick-excerpt | answers "both" or "neither" (`said_both`) | synthetic + documented |
| name-genre (all) | names a close relative on the menu: Folktale for Fable, Autobiography for Biography; on identify_basic every wrong answer is this, because Fiction and Nonfiction are each other's sibling (`close_relative`) | synthetic + documented |
| name-genre (classify, compare) | names another kind on the menu (`other_genre`) | synthetic |
| name-genre (classify, compare) | names the broad side ("fiction", "made up", "a true story", "real") when the menu lists only specific kinds | inferred; **no miss id** (lands as no match). Most likely wrong at G3, and partly right |
| name-genre (grades 1-2, and hard tier above it) | does not know what the menu words mean: glosses are printed, never spoken; at hard the labels are not spoken either | inferred from the tier design (`namesChoices` false at hard) |
| all | silence, asks to hear it again | documented; no lever (the tutor waits; the re-ask exists) |

**Mode/miss mismatch (catalog defect).** The catalog gives all three modes the same six misses (`sameMisses`), but
identify_basic and classify_genre build no `pick-excerpt` (so `other_text`, `said_both` never fire), compare_genres
builds no `check-feature` (`opposite_verdict`, `said_feature_back` never fire), and identify_basic's binary menu makes
`other_genre` unreachable (`GENRE_SIBLING.fiction = [nonfiction]`). J9 would demand a lever or a recorded reason for
seven misses that cannot happen. Fix: per-mode `missLists` (Miss list change, below).

**Content defects on the saved payloads** (for `/eval-fix`; none blocks drafting, F1 blocks measuring identify_basic):

| # | Payload | Defect |
|---|---|---|
| F1 | identify_basic | One feature for two texts, so the session is 4 items with two genre asks (catalog: "a binary answered once is a coin flip"). The one predicate, "tell a made-up story from someone's imagination", restates Fiction's gloss ("A made-up story.") and alternate ("made up"): the yes/no IS the genre verdict in other words, not a feature found in the words. The 08-17 band-floor run shows the same shape ("give facts you could look up" = Nonfiction). Gate to add: on identify_basic a predicate may not contain a `GENRE_ALTERNATES` phrase of Fiction or Nonfiction; require at least two kept features. |
| F2 | identify_basic, classify_genre, compare_genres | Convergent content: the lion-and-mouse text and the honeybee text appear in both identify_basic and classify_genre; the sun-god chariot opens both classify_genre and compare_genres. Variety, low severity. |
| F3 | classify_genre | "explain how ancient people understood nature" is a judgment about the myth, not something in its words (the text never mentions people). Low. |
| F4 | all three | All grade 3, no `supportTier`: no band-floor payload (the read-aloud path) and no hard payload (`namesChoices` false, sibling-heavy menu), so the levers below that depend on either cannot be shown by J1-J9. |

**Tier finding.** The tier's strategy axis (`leadInFor`: easy = model + guide line, medium = model line) reaches only
`itemCue`, the retired DI cue path; `genreAssignment` sends `askFor`, which has no lead-in. On the bound path the
tier changes only menu size, distractor closeness and `namesChoices`. Phase 6 below replaces the dead axis with
starting positions.

## Phase 2: lever table

One code-owned pool, `genreModels.ts` (new, hand-authored like `rhymeModels.ts`): for every kind, one or two texts of
one or two sentences that pass `namesAGenre` and `isReadableAloud`, each with one or two features (base-verb
predicate, verdict, evidence span) and the clue that tells it from its sibling. All model and practice levers draw
from it, never from the LLM at runtime.

| Mode | Answers | Lever | Kind | Carrier | Leak rule (code) | Exists today? | Cost |
|---|---|---|---|---|---|---|---|
| identify_basic, classify_genre (check-feature) | opposite_verdict, said_feature_back | `text_model`: a card beside the text with a DIFFERENT pool text, a different feature, its evidence words underlined, verdict given: "My turn: does this one have a person telling about their own day? Yes, it says 'this morning I…'" | help | both (underline shown; question and verdict voiced, which also models the yes/no answer form) | Model text is no session excerpt; model predicate shares no content word with any session predicate; neither names a kind (`namesAGenre`) nor contains a `GENRE_ALTERNATES` phrase of a menu kind; `does` forbids saying what the model means for the learner's text | no | pool + picker + leak check + card render |
| identify_basic, classify_genre (check-feature) | opposite_verdict | `sentence_rows`: the item's text redrawn one sentence per row, each row with the same plain marker; the tutor says check each line for the feature | help | shown | Rows are the text's sentences in order; no row is styled from the key; scene fact says "one sentence per row", never which row | no (one paragraph) | sentence split + render |
| all three, grades 1-2 only (any item carrying a text) | opposite_verdict, other_text, said_both | `read_again`: the text panel (both panels on pick-excerpt) gets a speaker mark and the tutor reads the whole text again, evenly | help | both | Band floor only (`readsAloud`); `does` quotes the full `spokenText`, in order, nothing stressed or repeated; refused above the band floor, where reading the text is the learner's job. Safe because no text names its kind (`namesAGenre` gate) | partly: read-aloud on the first item only; re-ask drops it | glyph on panel + does text |
| compare_genres (pick-excerpt) | said_both, other_text | `two_checks`: an empty check under each text; the tutor asks the feature of one text at a time, then hands back "which one?" | help | both | Code never fills either check; scene fact says both are empty; `does` forbids answering either (story-bridge `two_questions` precedent) | no | render + does text |
| compare_genres (pick-excerpt) | said_both, other_text | `pair_model`: two pool texts side by side, the feature's evidence underlined in exactly one: "My turn: only this one has someone giving an opinion" | help | both | Same as `text_model`, over both model texts; the model feature is true of exactly one model text | no | same module, pair card |
| all three (name-genre) | close_relative (identify_basic); other_genre, said_broad_kind (classify, compare) | `read_glosses`: each menu card gets a speaker mark and the tutor reads every label with its printed gloss, in screen order | help | both | Every card, in printed order, gloss text exactly `GENRE_GLOSS`; no card marked alone; refused when the menu is empty. At hard it also restores the spoken labels (rhyme-studio `name_choices` precedent) | no (glosses printed, never spoken) | speaker marks + does text |
| classify_genre, compare_genres (name-genre) | close_relative | `kind_pair_model`: two pool texts of a sibling pair, each with its clue underlined and its label and gloss: "My turn: this one says 'I was born…', the person wrote it, Autobiography; this one says 'she was born', someone else wrote it, Biography" | help | both | Both model kinds are off the session menu (so naming them answers no item, now or later); model texts are no session excerpt; refused when no sibling pair is fully off the menu (`GENRE_SIBLING` pairs: bio/auto, auto/memoir, legend/tall-tale, myth/legend, fable/folktale, info/persuasive, realistic/historical, poem/drama); `does` forbids linking a model to the learner's text | no | pool pairs + card |
| classify_genre, compare_genres (name-genre) | close_relative, other_genre, said_broad_kind | `two_far_kinds`: an ungraded practice item: a pool text, named from a two-kind menu of its own kind and one from the other side of fiction/nonfiction; then the full item returns | simplify | both | Practice kind and foil are both off the session menu; foil is not in `GENRE_SIBLING[practice]` and sits in the other `BINARY_BUCKET`; text is no session excerpt and passes `namesAGenre`; answer recomputed; `askIsAnswerFree` on the practice ask. Refused on identify_basic (its menu is already two) | no (tier sets menu size at generation only) | runtime builder + practice wiring |

nextLever order per action: check-feature `read_again` → `sentence_rows` → `text_model`; pick-excerpt `two_checks` →
`read_again` → `pair_model`; name-genre `kind_pair_model` (close_relative) / `read_glosses` → `two_far_kinds`.

J9 per mode after the miss list change: every miss answered, unanswered list empty.

| Mode | Misses → levers |
|---|---|
| identify_basic | opposite_verdict → read_again, sentence_rows, text_model · said_feature_back → text_model · close_relative → read_glosses |
| classify_genre | opposite_verdict, said_feature_back as above · close_relative → kind_pair_model, two_far_kinds · other_genre, said_broad_kind → read_glosses, two_far_kinds |
| compare_genres | other_text, said_both → two_checks, read_again, pair_model · close_relative, other_genre, said_broad_kind as classify_genre |

### Rejected and no-lever rows

- **Highlighting the evidence in the item's text** (check-feature, pick-excerpt). A lit span says "yes", and no
  span says "no"; on pick-excerpt it says which text. `sentence_rows` marks every sentence alike instead.
- **A genre model on identify_basic.** Any model names Fiction or Nonfiction, both on the two-item menu, so the model
  answers by sameness or by elimination (di-shapes `NEAR_SHAPE` reasoning). identify_basic name-genre gets
  `read_glosses` only.
- **Removing a close relative from the item's own menu.** On the same question it repeats the item with the
  discrimination taken out (R3); `two_far_kinds` puts the fewer, farther choices on a practice text instead.
- **Simplify on check-feature: no lever.** It is already the smallest action in the primitive; a shorter text is
  easier text, not a simpler shape, and another yes/no asks the same thing.
- **Simplify on pick-excerpt: no lever.** One text turns the contrast into check-feature, which is the mode floor
  compare_genres sits above; another pair asks the same thing.
- **Simplify on identify_basic name-genre: no lever.** The binary menu is the mode.
- **Pinning the learner's findings beside the menu.** Credited findings already print directly above the menu
  (`renderFindings`); a lever would move text that is on screen.
- **A printed "yes, it does / no, it does not" frame** for `said_feature_back`. Text only, and `text_model` already
  voices the answer form.
- **Silence, "say it again":** the re-ask exists; the tutor waits.

### Miss list change (build work)

1. Replace `sameMisses` with per-mode `missLists<SpokenGenreMiss>`: identify_basic `opposite_verdict,
   said_feature_back, close_relative`; classify_genre `opposite_verdict, said_feature_back, close_relative,
   other_genre, said_broad_kind`; compare_genres `other_text, said_both, close_relative, other_genre, said_broad_kind`.
2. New `said_broad_kind` in `genreSpokenMisses` (name-genre, only when the menu has neither Fiction nor Nonfiction):
   "The learner names the broad side (fiction or nonfiction, made up, true, real) instead of a kind on the printed
   list." Examples are filtered against the answer's own `GENRE_ALTERNATES` ("a true story about a person" is a
   correct Biography answer). Extend `contentSpokenMisses.test.ts`.

## Phase 6: starting positions

The generator already stamps `supportTier` (`gemini-genre-explorer.ts` `resolveSupportStructure`); keep its menu
size and distractor ordering. Add per item:

| Tier | Starts on screen (not a pull, never recorded) |
|---|---|
| easy | `sentence_rows` on check-feature, `two_checks` on pick-excerpt, speaker marks on the menu (glosses read with the ask at the band floor) |
| medium, no tier | none |
| hard | none (labels unspoken as today; `read_glosses` is the pull that restores them) |

Remove `leadInFor`'s model/guide lines or leave them to the DI test only; they reach no learner.

## Guidance offer cap

Guidance 671 + `WORKSPACE_DOCTRINE` 948 = 1620 today; with `levers: true` and `LEVER_DOCTRINE` (213) it is **1834 of
2000**, 166 to spare. Two sentences become false and must change in the same slice, within that budget: "You cannot
point at or highlight the text." (levers now mark it; the tutor still cannot) and "Nothing on screen marks a genre
until credit." (a model names off-menu kinds). Proposed: "You cannot point at the text yourself." and "Nothing marks
this text's kind until credit; models name only kinds off the menu." (+~45 chars, about 1880). Re-run
`activityContract.test.ts` (the 2000 check).

## Rulings needed

| # | Question | Recommendation |
|---|---|---|
| R1 | `kind_pair_model` prints kind names on screen. The script's tier note forbids a worked exemplar ("Modelling 'a story with talking animals is a Fable' would say a genre name that is very often the NEXT item's answer"), and the component header says "NO GENRE BADGE ANYWHERE". | **Allow, with the off-menu leak rule.** The rule's reason is that the session shares one menu; a model whose two kinds are both off that menu names no answer now or later, and it is the 10-02 parallel-item model. Record it in the contract as a lever exception, not an edit of the no-badge rule. |

## Build notes

- **New capability:** the `genreModels.ts` pool (about 16 kinds × 1-2 texts with features, clues and sibling pairs:
  the bulk of the work, hand-authored and gated by `namesAGenre`/`isReadableAloud` in a unit test); a model card
  (single and pair); sentence rows; two empty checks; speaker marks on panels and menu cards; the `two_far_kinds`
  practice item on the spoken path (rhyme-studio `far_foil_item` is the spoken-practice precedent).
- **Reuse:** `WorkspaceLever`/`pull_lever`/practice plumbing in `useWorkspaceRunner`; `LuminaReadAloudGlyph`;
  `GENRE_GLOSS`, `GENRE_SIBLING`, `BINARY_BUCKET`, `namesAGenre`, `askIsAnswerFree` from `genreExplorerScript.ts`;
  `missLists`. The component must start publishing `levers`, `pullLever`, `endPractice` in `workspace.current`
  (today it publishes the scene only), keyed by item. Set `levers: true` on the catalog `teachingWorkspace`.
- **Size: M.** About 450 production lines (pool ~180, `genreExplorerLevers.ts` ~150, component ~100, miss + catalog
  ~25), about 350 test lines (leak rule per lever × action, builder over every session shape, miss → `nextLever`
  table, `GenreExplorer.levers.workspace.test.tsx`).
- **Contract first:** run `/primitive-contract genre-explorer` (no contract doc exists); the build-gate requirements
  (`namesAGenre`, one ask per genre, the identify_basic binary gate, compare's two-contrast floor) are what the levers
  must not break.
- **Payloads to generate before building** (one Flash generation each, `save_payload.py`): identify_basic grade 1
  (band floor: `read_again`, read-aloud path); classify_genre grade 4 hard (`namesChoices` false, sibling menu:
  `close_relative`, `read_glosses` restoring labels, `two_far_kinds`); compare_genres grade 5 hard. Regenerate
  identify_basic grade 3 after F1 is fixed.
- **Before measuring:** F1 to `/eval-fix` (identify_basic features restate the answer). F2/F3 are low and can ride
  the same fix.
- **Gate:** free and text-only (vitest, dry journey J1-J9, tutor replay). No Live run for this primitive; the
  literacy G2-6 class Live pair waits until all four primitives have every mode levered.
