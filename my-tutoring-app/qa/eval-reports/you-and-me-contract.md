# You & Me — birth contract

L1 extension (2026-09-07): `type` now also admits `describe_independent_action`. That task asserts the displayed actor completed the action without help, requires a bound myself/yourself form alongside I/you, and keeps model words hidden until feedback. Single mode has three paired scenes; mixed/blend has two per mode. Session `challengeType` may be `mixed`; rendering and per-mode metrics use each challenge's type. See [L1 verification](you-and-me-l1-2026-09-07.md). The birth contract below remains the compatibility baseline for `describe_action`.

Source: `qa/curriculum-coverage/design-studio.html`, concept `you-and-me`, Kindergarten Language Arts, LA004-04-B.

Core: `describe_action`. Produce a spoken sentence using I/you from a named partner's perspective. Three content-bearing scenes, each played twice with the same actor and opposite speakers (six scored turns). Reflexives LA004-04-J and observed transfer into real classroom routines are outside this birth.

Required fields: session `title`, `description`, `gradeLevel`, `challengeType=describe_action`, `challenges[]`; each challenge `id`, `sceneId`, `type=describe_action`, `participants` (two distinct names and emoji), `actor` and `speaker` (0 or 1), `object`, `objectEmoji`, subject-free past-tense `action`. Pronoun and model sentence are derived from actor/speaker; no independent answer key.

Generator fork B: three parallel scene generations, locally assigned roles, paired speaker reversal, validation and deduplication before rendering.

Design gate:
- Manipulation exception: oral perspective-taking is performed with speech; the scene is the stimulus, not a tile-selection task.
- Living process: speaker highlight changes while the actor and action remain fixed across a pair.
- Production: original spoken sentences; no supplied answer menu or exact transcript matching.
- Timer: no visible countdown.
- Layout: actor/speaker labels communicate the stimulus; neither color nor position permanently means I/you. Named scene narration contains no model response.

Integration exception: use the existing `useJudgedScriptRunner` and `phaseResultsFromSummary` instead of adding a competing `useChallengeProgress` / `usePhaseResults` loop. The runner owns live connection, silent scripted cues, capped corrections, stale-verdict handling, attempt ledger and progression. `concept_statement` is the existing semantic proposition class; this pronoun-specific contract still needs live spoken acceptance checks (especially fluent wrong-perspective sentences).
