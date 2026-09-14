# Successful-response observations: frontend continuation

Implemented the first machine slice from the learning-observations handoff. Place Value opts into the shared runner's `responseObservation` callback. It captures factual expected/observed response, item/phase, judge verdict, source, prior correction count and run-wide stimulus replay count before the board is revealed or reset. Voice evidence uses the judged attempt's transcript; absent transcripts are omitted, and stale `lastHeard` text is never substituted. Existing correction diagnosis and resolution behavior remain separate.

The chart submits this ledger in `student_work.learningResponses` through the existing canonical submission. In Developer Tools → Misconception Loop Tester, an accepted activity exposes its recorded responses and a **Preview strengths and support** action. The real Next/LLM distiller requires successful evidence on two distinct items in the same phase, preserves corrections, validates cited item IDs, and abstains on insufficient evidence or invalid output. The existing observations panel displays the result as a tentative, unsaved preview, with source evidence and proposed teaching/next-check guidance.

The first mounted test caught reuse of a failure-specific helper that labeled a correct transcript contradictory. The new callback now preserves raw observed text while reusing the task description. The first live LLM draw also overinterpreted zero corrections as initial attempts and proposed increased difficulty. The prompt now explicitly prohibits both inferences; the final live draw stays within the recorded task scope and reports success without a recorded prior correction.

Verification:

- Full frontend suite: 5,999 passed, 10 skipped. `artifacts/learning-responses-full-tests.log`.
- Lumina typecheck: zero errors. `artifacts/learning-responses-typecheck.log`.
- Mounted chart/runner regression: real successful text, correction count before/after retry, and omission of missing/stale transcripts.
- Distiller tests: score-only, missing, repeated same-item and mixed-phase abstention; citation validation; supported-success requirements; model failures.
- UI test: score-only action disabled, response-linked preview labeled unsaved, one explicit distillation request.
- Real Next/LLM harness: strength, support and score-only abstention PASS. `artifacts/learning-response-preview-live.json`. Run `node scripts/probe-learning-response-preview.mjs` from the frontend directory against the existing port 3000 server. Fictional evidence only; no canonical submission, calibration, Firebase identity or store mutation.

Next: integrate general observation kinds into authenticated capture and saved profile storage. Do not store strengths in the misconception overwrite slot or let them resolve existing hypotheses. Canonical client/backend attempt identity, observation history, a second consumer and human microphone/teaching-effectiveness acceptance remain open. This slice does not claim browser visual acceptance, microphone quality, independence, mastery or transfer.
