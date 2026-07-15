# Human Checks — browser/pixel verification queue

Things only a human at a browser can close. Each was verified headlessly
(jsdom/tsc/live-harness) — only the pixel look or a real click remains.
Burn down in ONE sitting: `cd my-tutoring-app && npm run dev`, then walk the list.
When a row is verified, strike it here AND note it in the owning report.
Maintained by `/pm` (it re-greps reports for new "browser glance" debt).

## Open (as of 2026-07-14)

| # | Surface | What to check | How to reach it | Source report |
|---|---|---|---|---|
| 1 | K-stage presentation mode | whole flow: one-section rail, wordless arrow advance, [SECTION_START] narration | any K lesson (auto-on) or Ctrl+Alt+K | reader-fit BACKLOG systemic item |
| 2 | knowledge-check @ PRE | emoji-grid MCQ: tap=choose fires, auto-read + 🔊 replay, chrome hidden | K lesson closing quiz | `qa/reader-fit/knowledge-check-PRE-2026-07-14.md` |
| 3 | comparison-builder @ K | tappable SVG group boxes + middle `=` pixel look | K comparison lesson, compare_groups | `qa/reader-fit/comparison-builder-PRE-2026-07-14.md` |
| 4 | addition-subtraction-scene @ K | NumberTileRow toy-tile look + layout; create_story build flow feel | K add/sub lesson | `qa/reader-fit/addition-subtraction-scene-PRE-1b-2026-07-14.md` |
| 5 | letter-sound-link @ K | wordless ear→check glyphs read as "listen then keep" | K letter-sound lesson | `qa/reader-fit/letter-sound-link-PRE-2026-07-14.md` |
| 6 | deep-dive @ PRE | quiz grid + 🔊 buttons; "Read to me" prose button | DeepDiveTester + Ctrl+Alt+K | `qa/reader-fit/deep-dive-PRE-2026-07-14.md` |
| 7 | decodable-reader read_along @ K | tap=choose picture options actually select on click | K CVC lesson, read_along mode | `qa/reader-fit/decodable-reader-PRE-2026-07-14.md` (BACKLOG Done) |
| 8 | LuminaReadAloud pilot | migrated pilot surface renders/plays | see handoff | `qa/HANDOFF_read-aloud-sweep.md` |
| 9 | Misconception loop phase 1 | items under "NOT verified (needs a browser check)" | see report | `qa/misconception-phase1-2026-07-10.md` |
| 10 | multiplication-explorer fluency | answer "2 × 2" → "Correct!" (30s) | fluency card | `qa/eval-reports/multiplication-explorer-2026-07-07.md` |
| 11 | knowledge-check voice (TF + MCQ) | say "true"/an option label → credits+advances; gibberish → no penalty; Ctrl+M kills; katex/non-sayable MCQ shows NO orb | any knowledge-check with TF/MCQ | memory `project_voice-control-knowledge-check` — user believes done; confirm + strike |

## Done
- word-sorter @ K staged-word presentation — user browser check 2026-07-14 (RF-3).
