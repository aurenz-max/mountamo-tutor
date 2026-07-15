# Human Checks — browser/pixel verification queue

Things only a human at a browser can close. Each was verified headlessly
(jsdom/tsc/live-harness) — only the pixel look or a real click remains.
Burn down in ONE sitting: `cd my-tutoring-app && npm run dev`, then walk the list.
When a row is verified, strike it here AND note it in the owning report.
Maintained by `/pm` (it re-greps reports for new "browser glance" debt).

## Open (as of 2026-07-14)

| # | Surface | What to check | How to reach it | Source report |
|---|---|---|---|---|
| 2 | knowledge-check @ PRE | emoji-grid MCQ: tap=choose fires, auto-read + 🔊 replay, chrome hidden | K lesson closing quiz | `qa/reader-fit/knowledge-check-PRE-2026-07-14.md` |
| 3 | comparison-builder @ K | tappable SVG group boxes + middle `=` pixel look | K comparison lesson, compare_groups | `qa/reader-fit/comparison-builder-PRE-2026-07-14.md` |
| 4 | addition-subtraction-scene @ K | NumberTileRow toy-tile look + layout; create_story build flow feel | K add/sub lesson | `qa/reader-fit/addition-subtraction-scene-PRE-1b-2026-07-14.md` |
| 5 | letter-sound-link @ K | wordless ear→check glyphs read as "listen then keep" | K letter-sound lesson | `qa/reader-fit/letter-sound-link-PRE-2026-07-14.md` |
| 6 | deep-dive @ PRE | quiz grid + 🔊 buttons; "Read to me" prose button | DeepDiveTester + Ctrl+Alt+K | `qa/reader-fit/deep-dive-PRE-2026-07-14.md` |
| 7 | decodable-reader read_along @ K | tap=choose picture options actually select on click | K CVC lesson, read_along mode | `qa/reader-fit/decodable-reader-PRE-2026-07-14.md` (BACKLOG Done) |
| 9 | Misconception loop phase 1 | items under "NOT verified (needs a browser check)" | see report | `qa/misconception-phase1-2026-07-10.md` |
| 10 | multiplication-explorer fluency | answer "2 × 2" → "Correct!" (30s) | fluency card | `qa/eval-reports/multiplication-explorer-2026-07-07.md` |
| 11 | knowledge-check voice (TF + MCQ) | say "true"/an option label → credits+advances; gibberish → no penalty; Ctrl+M kills; katex/non-sayable MCQ shows NO orb | any knowledge-check with TF/MCQ | memory `project_voice-control-knowledge-check` — user believes done; confirm + strike |
| 12 | sorting-station @ K | picture-primary bins (big emoji + word caption, or color circle when no `bucketEmoji`) read as tappable groups; emoji sizing/layout at 2-3 bins; odd_one_out taps auto-submit with no Check button | MathPrimitivesTester → sorting-station, sort_one / odd_one_out, grade K (or Ctrl+Alt+K) | `qa/reader-fit/sorting-station-PRE-2026-07-15.md` |
| 13 | drop-zone Batch-3 math (7 gens) | each answer slot: idle dashed invite → filled hold → correct pop (emerald) / incorrect shake (rose); no leftover hand-typed colored borders. Drive one correct + one incorrect drop per gen. | MathPrimitivesTester → NumberSequencer, PatternBuilder, EquationBuilder, ComparisonBuilder (order), OrdinalLine (build), TapeDiagram, LengthLab (order) | `qa/HANDOFF-dropzone-batch3-2026-07-15.md` + `DROPZONE_MIGRATION_PRD.md` §3 |
| 14 | drop-zone Batch-3 misc (3 gens) | same zone-state language on timeline/sequence slots; TimelineBuilder per-slot correct/incorrect after Check | calendar TimelineBuilder; engineering PropulsionTimeline (sequence phase); DeepDive TimelineBlock (order mode) | same as #13 |
| 15 | phonics-blender @ K (cvc) | letter-primary tiles (big letter, no `/k/`); phase stepper + word counter + badges hidden; build phase has NO Clear button (tap a placed tile to remove) but KEEPS Check; tapping a placed tile removes it; word emoji sizing/layout | LiteracyPrimitivesTester → phonics-blender, cvc, grade K (or Ctrl+Alt+K) | `qa/reader-fit/phonics-blender-PRE-2026-07-15.md` |
| 16 | rhyme-studio @ K (recognition + identification) | emoji-primary word cards (big emoji + small word caption); recognition answers are big 👍/👎; identification option tiles emoji-primary + tap=choose selects on click; question sentence + text feedback card + chrome (title/badges/counter/"N correct"/progress bar) all hidden; ▶ Start / ▶/🎉 advance read as wordless | LiteracyPrimitivesTester → rhyme-studio, recognition & identification, grade K (or Ctrl+Alt+K) | `qa/reader-fit/rhyme-studio-PRE-2026-07-15.md` |

## Done
- word-sorter @ K staged-word presentation — user browser check 2026-07-14 (RF-3).
- K-stage presentation mode MVP (was #1) — user browser check 2026-07-15.
- LuminaReadAloud pilot renders/plays (was #8) — user browser check 2026-07-15.
