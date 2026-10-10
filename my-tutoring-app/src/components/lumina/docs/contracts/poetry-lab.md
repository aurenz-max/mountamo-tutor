# Contract: poetry-lab

- **Derived:** 2026-10-09 (W1 binding, batch C22)
- **Component:** `primitives/visual-primitives/literacy/PoetryLab.tsx` · **Domain:** `poetryLabWorkspace.ts` ·
  **Generator:** `service/literacy/gemini-poetry-lab.ts` · **Oracle:** `service/qa/oracles/poetry-lab.ts` ·
  **Adapter:** `components/live-activity/adapters/poetryLabLive.ts`
- **Modes:** `rhyme_hunt` (K-1), `analysis` (G2-6), `composition` (G3-6)

## Requirements

### R1 — rhyme_hunt never reads `supportTier` · OBSERVED
The K-1 band contract (pictured cards, audio-first, no chrome) wins over the tier. Probe: `PoetryLab.support-tiers.test.tsx`.

### R2 — support tiers withdraw display only · OBSERVED
L1 figurative count, L2 rhyme-scheme preview, L3 syllable chips; content and checks are tier-invariant, on both paths.

### R3 — on the teaching workspace, the activity's code is the only judge · OBSERVED (2026-10-09)
Items: one per rhyme round; one per analysis phase the poem supports (`mood`, `figurative`, `rhyme`); one `compose`
item. No key reaches the tutor: no rhyming pair, mood, figurative words or scheme in any scene fact except the menus
the screen prints. Every wrong check names a miss from the catalog's `teachingWorkspace.misses`. Composition checks the
FORM only (lines written with 2+ words, no repeat, acrostic letters, syllables within one of the target).
Probe: `PoetryLab.workspace.test.tsx`, sweep J1-J8.

### R4 — no answer from screen position · OBSERVED (2026-10-09)
Rhyme cards draw in a seeded shuffle (`rhymeCards`): the generator lists them in line order with the pair always on
lines 2 and 4. Mood and scheme choices draw shuffled (`moodChoices`, `schemeChoices`), on both paths. On the workspace
every poem word is its own button on the figurative item, so a phrase is not marked by being the only tappable text.

### R5 — scripted path unchanged otherwise · OBSERVED
Outside a live runtime: rhyme hunt's timers and tutor cues; analysis/composition's Next, Edit, Submit and one submission.

### R6 — levers never mark a card, a choice or a word of the poem · OBSERVED (2026-10-09)
`poetryLabLevers.ts`, workspace path only, state keyed by item. Help levers act on a model outside the item
(`rhyme_model` from a family no round uses; `figure_models` sharing no 4+ letter word with the poem; `model_poem` on
another subject, and copying its line is `line_repeated`) or on everything alike (`mood_faces` only when every mood
has a face; `end_words` unmarked; `phrase_count` how many, never where; `syllable_beats` and `first_letters` read the
learner's own lines). Simplify levers open `<id>~simpler`: a 3-card "I see a ..." round from free families, a pool poem
with two choices (never a line of the session's), one line of the same form on a pool subject. Ungraded; Try again
keeps it; the full item returns blank. Probe: `poetryLabLevers.test.ts`, `PoetryLab.levers.workspace.test.tsx`, sweep J12/J13.

## Open
- **G1** — scripted analysis still makes only the figurative phrases tappable (hover shows them). `/eval-fix`.
- **G2** — composition's free-verse and sonnet-intro draws carry no checkable form beyond line count: the check is
  "every line written". Needs a judged evidence contract (the shared writing judge) or a ruling. `/add-eval-modes`.
- **G3** — generator ships near rhymes as the pair (saved payload: grass/fast). `/oracle-test`.
