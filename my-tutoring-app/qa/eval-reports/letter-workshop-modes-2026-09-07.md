# Letter Workshop mode implementation — 2026-09-07

Trace, copy beside a separate model, and write from an audible letter name are implemented. Copy/write sessions provide provisional shape feedback locally and do not update adaptive progress. This report supplements the original L0 evaluation.

| Check | Result |
|---|---|
| Pins: trace/copy/write | PASS: live generation and browser drawing/check/next/finish |
| Explicit blend and mixed | PASS: live generation covers only selected modes and preserves lowercase-l scope |
| Unpinned copy/write intent | PASS: real resolver selects the requested task |
| Geometry, routing, evidence, cue failure, local-only isolation, context adapter | 264 tests passed across seven files |
| Full TypeScript | 770 baseline errors, 770 after; no new diagnostics |
| Lumina TypeScript | Initial check passed at zero; final rerun blocked by one concurrent, unrelated TS2802 in `service/literacy/gemini-you-and-me.test.ts:49`. No Letter Workshop diagnostics. |
| Actual speaker output / child touch and stylus | Not verified; browser speech completion was simulated |

The browser probe drove 12 generated challenges across three sessions, including horizontally shifted copy/write productions. It checked blank paper, absence of the write target before feedback, no stale model on the next write item, per-attempt exposure, and one callback per session. No page errors. Synthetic submissions were intercepted before student history.

Matching catalog/backend design priors: trace β 1.5, copy β 3.5, write β 5.0; discrimination uses the shared 1.4 fallback. These are not empirical calibration results. The copy/write scorer accepts horizontal placement variation while preserving height, orientation, and ordered stroke structure; alternate manuscript conventions and real-child tolerances still need review.

Evidence: [live routing draws](letter-workshop-modes-live.json), [write eval-test draw](letter-workshop-modes-write.json), [browser payloads and attempt ledgers](letter-workshop-modes-browser.json), [copy surface](letter-workshop-copy-mode.png), [write surface](letter-workshop-write-mode.png).

Run browser probe from `my-tutoring-app`: `node scripts/probe-letter-workshop-modes.cjs <playwright-module-path>`. Probe audio is synthetic; it verifies the playback lifecycle, not audibility or pronunciation.

Remaining: review all 52 forms and accepted stroke conventions; listen to cues on supported devices; test child finger/stylus attempts; calibrate formation feedback and verify backend evidence replay before permitting copy/write adaptive updates. Tutoring scaffold, support tiers, structural difficulty, and sound remain queued in the birth report.
