# Reading Repair Studio — L2 tutoring and L5 sound

The practice activity now has three requested checking tips and optional spoken delivery. The tutor stays quiet through cold reading, recording, word marking, replay, and fresh-text transitions. No scoring eligibility or content difficulty changed.

## Implementation

- Help progresses from checking every letter, to comparing meaning and print, to a replay/mark/reread walkthrough. Each request records support synchronously before revealing help. These are tutoring levels, not scored task identities or difficulty tiers.
- `Hear this tip` is the only in-round speech trigger (`[READING_HELP]`). Written help works without authentication or a tutor connection. `[ALL_COMPLETE]` gives one practice encouragement after the local submission; it waits for a real connection and cannot duplicate the submission.
- Twelve explicit context fields describe stage, challenge position, support provenance and action counts. No printed sentence, transcript, hidden verdict, target index, or reflection answer enters the component's tutor context. Catalog directives also prohibit modeling print that might arrive through generic lesson bootstrap data.
- `useLuminaAI` exposes the transport's existing `owns_opening` capability as optional `ownsOpening`. An explicit `activate` option lets a real help tap claim lesson focus while its protocol message remains silent in chat. Default background cues retain their existing focus behavior.
- Disconnected tip requests expire after 15 seconds and are canceled by recording, closing checking, or finishing. Sent tips hold recording/advance until playback ends, with a 20-second failure escape. Any shared or late tutor speech still records support conservatively; it cannot establish an independent repair.
- Two neutral sound points: `SoundManager.toggle` on word mark/unmark and `SoundManager.select` on optional reflection. Capture and `useChallengeProgress` retain their existing sounds. No provisional verdict creates a new success/error sound.

## Verification

| Gate | Result |
|---|---|
| Tier 1 scaffold audit | PASS; 12/12 context fields resolve, both tags are silent, no findings |
| Tier 2 generated-content prompt | PASS; no unresolved fields or `(not set)` values; component-owned values are explicitly identified as runtime values |
| Tier 3 real Gemini Live | PASS; 3/3 complete eight-beat journeys, 12/12 silence windows silent, 9/9 requested tips spoken exactly, three practice-only completions, no findings |
| Focused regression suite | 39/39 tests across five files, including local-only submission, support provenance, delayed-request cancellation, speech latency guard, neutral sounds, and explicit lesson focus |
| TypeScript | 771 baseline errors, 771 after; no new diagnostics. Only source-line shifts and the existing generated Next route union's member order differ |
| Browser | PASS; actual capture hook with synthetic WAV input and live audio judge, replay, all three help levels, fresh-round reset, one local ledger, zero adaptive writes, zero page errors |
| Sound wiring | Browser logs confirm toggleOn/toggleOff/select with running AudioContext; existing capture/navigation sounds remain. Human listening acceptance is still owed |
| Narrow layout | 390 px screenshot inspected; no horizontal overflow, readable tip and reachable controls |

Live tutor results are recorded separately in [the three-run transcript](reading-repair-studio-live-2026-09-13.md). This tests the real backend WebSocket and Gemini Live strategy coach; it is not a child-voice audio-judgment calibration or an authenticated browser voice-button test. The first harness attempt was interrupted by backend service restart (1012); the completed run is the evidence of behavior.

Artifacts under `artifacts/literacy-grade2-design`: `reading-repair-tutor-probe.json`, `reading-repair-l2-tests.txt`, `reading-repair-l2-tsc.txt`, and `reading-repair-browser-l2-{results.json,first.png,review.png,help-narrow.png,summary.png,narrow.png}`.

Reproduce browser checks from `my-tutoring-app` with `node scripts/probe-reading-repair-browser.cjs <playwright-package-path> --support`. Run live tutoring from the repository root with `backend/venv/Scripts/python.exe backend/tests/tutor_live/run_tutor_live.py --component reading-repair-studio --runs 3 --grade "Grade 2" --topic "A trip to the pond"`.

## Remaining lifecycle gates

Updated after the user's L1 request: [single-mode routing is implemented](../eval-reports/reading-repair-studio-evalmodes-2026-09-13.md) while adaptive scoring remains disabled. The earlier interpretation unnecessarily gated mode metadata on calibration. L3 support tiers can now proceed within `notice_and_repair`; L4 follows L3. Do not turn on adaptive scores to satisfy lifecycle ordering.

Human acceptance: real Grade 2 voices across accents, noise and pauses; independent human annotation of recognizer uncertainty; independent noticing and fresh-text transfer; child usability and listening comfort. The current evidence remains provisional and local only.
