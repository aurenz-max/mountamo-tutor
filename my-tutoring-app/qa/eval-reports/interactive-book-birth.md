# Birth Certificate — interactive-book (2026-07-14)

**Lifecycle layer: L1 eval-dense, with L2 tutoring and voice interaction pulled forward.**

- Core task identity: `find-feature` — the learner turns a coherent nonfiction picture book's pages and locates its printed title, author, heading, caption, and page number.
- Generator fork: coherent-book hybrid. Gemini authors one flat structured book; code reconstructs three pages and derives all five answer contracts exclusively from visible book fields. One corrective retry is followed by a validated, difficulty-banded fallback.
- Image scaffold: cover and page prompts hydrate lazily through the shared image service (`gemini-3.1-flash-lite-image`), with alt-text fallback and retry UI.
- Word scaffold: every page contains two single-token underlined focus words. Opening one reveals a child-friendly definition and a picture-location cue. The `easy`, `medium`, and `hard` bands change decoding/vocabulary complexity and sentence shape.
- Voice interaction: `useVoiceChoice` judges the actual short visible feature text; tapping uses the same answer path. Voice remains optional and tap-complete.
- Tutor tags: `[ACTIVITY_START]`, `[FIRST_VOICE_SUCCESS]`, `[CHALLENGE_INCORRECT]`, `[HINT_REQUESTED]`, `[ALL_COMPLETE]`.
- Answer-leak audit: prompts and hints are validated not to contain `targetText`; tutor messages name only the feature category and may not quote the target; the page-number navigation label is hidden as `Book page` until resolution. Literal feature options remain printed because locating them on the learning object is the task.

## Design gate

1. Direct manipulation — pass: the child turns pages and taps printed features in the book itself.
2. Living visual — pass: the picture page carries meaning; generated images visibly ground both underlined focus words.
3. Production over recognition — pass for the selected task: optional voice asks the child to say the short printed feature they located, never a meta-command such as “title.”
4. No visible timer — pass: elapsed time is evaluation telemetry only.
5. No answer-leak by layout — pass after gating the page-number navigation label.

## Curriculum home

- Kindergarten: **MATCH**, LA006-06 Text Features, cosine 0.7874, coherence 5/5.
- Grade 2: **MATCH**, LA007-02 Text Features and Facts, cosine 0.7951, coherence 5/5.
- Grade 1: abstain-diffuse. Keep `medium` as a support/generation band, but do not claim a Grade 1 node yet.

## Verification at birth

- Eval generation: 3/3 `find-feature` runs PASS for G1/G2/G4/G5; each produced one book, three pages, and five solvable challenges.
- TypeScript: no diagnostics on the touched Interactive Book surface; the repository-wide check remains nonzero on unrelated baseline diagnostics.
- Tutor scaffold: Tier 1 static contract PASS and Tier 2 generated-content probe PASS. Tier 3 live browser/audio journey remains to run.

## Follow-up queue

| # | Skill / gate | Next layer |
|---|---|---|
| ✓ | `/add-eval-modes` | Applied 2026-07-14: `find-feature` plus tutor-led `read-focus-word`; unpinned sessions mix both honestly. |
| 2 | `/add-support-tiers` | Withdraw image cues, automatic target-page positioning, and hint strength while preserving the same find-feature skill. |
| 3 | `/add-structural-difficulty` | After support tiers: easy cover features → medium headings/captions/page numbers → hard functional navigation and learner-created labels. |
| 4 | `/add-sound` | Optional quiet page-turn, word-open, and completion earcons; keep voice listening acoustically uncluttered. |
| 5 | Browser voice smoke + Tier 3 tutor journey | Verify mic start/stop, wrong or unclear speech neutrality, tap fallback, quiet-law behavior, and live tutor transcripts. |

Detailed reports:

- `qa/eval-reports/interactive-book-2026-07-14.md`
- `qa/tutor-reports/interactive-book-2026-07-14.md`
- `qa/curriculum-fit/interactive-book-2026-07-14.md`
