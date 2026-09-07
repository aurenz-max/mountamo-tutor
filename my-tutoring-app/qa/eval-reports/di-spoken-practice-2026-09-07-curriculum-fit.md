# DI spoken practice: K curriculum probes, 2026-09-07

`say_answer`, easy, canonical grade K, exact published topic + intent; two draws per
requirement via the production eval-test dispatcher. [Actual tasks and checks](../curriculum-coverage/index.html).

- **DSP-4 — HIGH, generator/fit:** LA004-06-E (subject-verb agreement) returns `items: []`
  in both draws. The component shows its no-practice state. The endpoint incorrectly
  labels these pass because its validation does not establish a nonempty usable DI set.
  This is a failed candidate, not permission to invent a fallback or weaken the objective.
- **DSP-5 — HIGH, scope/answer shortcut:** LA005-02-I (solve riddles from clues) returns
  four answer-depicting emoji stimuli per draw. Source renders them before the response;
  sun/fish/apple/dog can be named without solving the riddle. Repair generator stimulus
  selection for clue reasoning while preserving pictured naming tasks.

Evidence: `qa/curriculum-coverage/evidence/LA004-06-E-*` and `LA005-02-I-*`, with exact
requests and source hashes. `content-checks.json` executes nonempty checks and records
the source-based stimulus finding. No live mic run; no code repair claimed.
