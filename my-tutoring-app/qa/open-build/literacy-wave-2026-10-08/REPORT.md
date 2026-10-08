# Literacy build wave (OB-3L), 2026-10-07/08

Seven literacy primitives now have an open build mode: the learner MAKES something and many answers pass. All seven
are built, gated and driven in headless Chromium through the Language Arts tester (offline lever bench, real
generation, real judge). Nothing is committed.

| # | Primitive · mode | The learner makes | Judged by | β | Report |
|---|---|---|---|---|---|
| L1 | word-builder `build_affix` | a word for a meaning from prefix/root/suffix cards | code shape + Jev (flash second opinion) | 2.1 | `../word-builder-2026-10-07/` |
| L2 | cvc-speller `make_word` | a real CVC word with a short vowel, or one that rhymes with a given word | code (vowel, family, shape) + judge (real word) | 2.6 | `../cvc-speller-2026-10-08/` |
| L3 | sound-swap `swap_build` | a new real word by changing one letter of a given word | code (one letter) + judge (real word) | 4.1 | `../cvc-speller-2026-10-08/` |
| L4 | phonics-blender `build_blend` | a real word that starts or ends with a blend, from a start tile and an ending tile | code (blend, tile order) + judge (real word) | 2.6 | this report |
| L5 | rhyme-studio `pair_build` | a rhyming pair from eight pictures (pre-reader, no print) | code only (code-owned pictures with known rimes) | 2.6 | this report |
| L6 | paragraph-architect `build_paragraph` | a paragraph from sentence cards: topic first, 2+ facts that belong, closing last | code only (card roles) | 2.6 | this report |
| L7 | sentence-builder `build_sentence` | a question or a telling sentence about a named thing from word tiles | code (end mark, start) + judge (sense, topic) | 1.6 | this report |

## Shared pieces
- **The word judge** (`service/build-layer/`, route `judgeWordBuild`):
  - Jev answers typed questions and code decides; a Jev rejection gets a flash-latest second opinion.
  - Three modes: word (real word + fits the ask), `only: 'real_word'` (spelling builds whose fit is code-checked) and
    `unit: 'sentence'` (makes sense + about the thing).
  - Calibration (`../word-build-judge-2026-10-07/`): words 46-47/50 per run with 0-1 false rejects; sentences 20/20 for
    both Jev and flash.
- **The letter build surface** (`LetterBuildSurface.tsx` + `letterBuild.ts`) hosts five ask kinds across three
  primitives: vowel, rhyme, swap, blend start, blend end. Asks come from code-owned seed words (`letterBuildWords.ts`,
  kid-safe, familiar given words); the seed list only writes asks and never judges. "plug" and "span", which are not
  in the list, passed in the drives.
- **Every build:**
  - "I'm done!" commits through the workspace runner, and Try again keeps the work.
  - Every second item asks for a second, different answer (not at the easy tier).
  - Levers start bare: a frame or pattern (help), a solved model on other content (help), and a smaller board or bank
    (simplify, ungraded).
  - Every named miss is answered by a lever or declared unanswered.

## Fixed along the way
- **PHB-1:** phonics-blender `cvce_blend` never served a blend. Resolved: the session pattern now follows the
  objective. The blends objective now gets blue, stop, lamp, hand, fast.
- **Letter surface:** its full-row check was hard-coded to three boxes. A vitest caught it on the two-tile blend kind.
- **Paragraph closings** must open with a wrap-up phrase. "Dolphins are wonderful ocean animals." could just as well
  open the paragraph, which would fail a fair order.
- **Swap asks:** given words differ in 2+ letters (one draw gave bat, cat, can). Rhyme and swap asks use only familiar
  given words (an early draw gave "rhymes with rut").

## Drives (headless Chromium, real generation, real judge)
- **phonics-blender build_blend:**
  - "man" → no_blend (code)
  - "span" → pass (a real word not in the seed list)
  - end-blend item: "land" kept, "land" again refused, "must" → pass
- **rhyme-studio pair_build:**
  - "snake + sock" → same_start: "Those two start the same. Rhymes END the same."
  - "moon + spoon" → pass
- **paragraph-architect build_paragraph:**
  - topic second → "Which sentence tells what the whole paragraph is about?"
  - an off-topic fact → "Is every one about honeybees?"
  - three facts → pass
- **sentence-builder build_sentence:**
  - no end mark → the end-mark miss
  - reversed words → not_question_start (code)
  - "Can the dog play or does it sleep?" → pass
- L1-L3 drives are in their own reports. Screenshots and `drive.json` are in each `<primitive>-<date>/drive/`.

## Gates
- `typecheck:lumina`: 0.
- **vitest:**
  - New: LetterBuild 13, RhymePair 7, ParagraphBuild 5, SentenceBuild 3, WordBuilder.buildAffix 11.
  - Full Lumina suite: 795 files, 12,810 pass. The only failure is the flaky train-yard generator test TY-F1 (1 in 4
    runs, unrelated, filed).
- **Journey sweep:**
  - every new payload is in `w1-payloads/`
  - paragraph-architect is driven end to end (wrong then right) because its check is code
  - the judge-based builds are recorded "by design" in the baseline, as open-builder is
- **Backend priors:** all seven match the catalog β.

## Not verified / open
- **No Live run.** The tutor's words on these verdicts, pauses and levers ride one literacy class Live gate (paid;
  needs your go-ahead).
- **No phone-width check:** a 14-letter bank and the 2-column card grid.
- **Rulings:**
  - **R12:** paragraph-architect and sentence-builder are bound ONLY for their build mode. The adapter refuses their
    older modes' payloads, so those keep their old path. Keep, or bind the older modes too?
  - **R13:** builds admit grades 1-2 (cvc-speller K-2, word-builder 1-8), following R11.
- **β priors are unrated:** each is its closed-answer neighbour + 0.1.
- **Judge risks:**
  - "review" passes for "look at something before" (a word Jev reads as fitting).
  - `pick_another` is a short code list of real words a lesson should not credit.
- `/api/lumina/eval-test` reports `fail` for every build payload: its shape check looks for a challenge array. The
  content is fine.
