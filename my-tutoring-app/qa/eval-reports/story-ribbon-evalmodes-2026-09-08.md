# Story Ribbon L1 Eval Modes — 2026-09-08

Story Ribbon now has five distinct task identities. The base connected-account mode remains tense-open; three tense modes add a consistent story-time requirement; the final mode asks for an explained story-to-experience connection without requiring personal disclosure.

## Mode ladder

| Eval mode | β | a | Scaffolding mode | Judged production |
|---|---:|---:|---:|---|
| `tell_connected_account` | 2.5 | 1.0 | 2 | Three event meanings in chronological order; any consistent tense |
| `tell_present_account` | 3.0 | 1.6 | 3 | Connected account consistently in present time (`Today`) |
| `tell_future_account` | 3.5 | 1.6 | 3 | Connected account consistently in future time (`Tomorrow`) |
| `tell_past_account` | 3.5 | 1.6 | 3 | Connected account consistently in past time (`Yesterday`) |
| `story_to_experience` | 4.0 | 1.0 | 4 | Identify an event, give a personal/familiar/observed/heard-about/imagined experience, and explain the connection |

These are design priors, not empirical calibration. Catalog β/a values match `problem_type_registry.py` and `discrimination_priors.py`.

## Architecture

- `resolveEvalModes` consumes explicit pins or resolves from `intent` plus `objectiveText`.
- The flat Fork B schema now carries a root `challengeType`; `constrainChallengeTypeEnum` uses `{ fieldName: 'challengeType', rootLevel: true }`.
- Fork B generates one story per call. A code-owned schedule narrows each story slot to one allowed type, so a curated blend cannot collapse and the five-item mixed session covers all five identities.
- Mode-specific `timeCue` values are schema-constrained and validated: `Today`, `Tomorrow`, `Yesterday`, or no cue.
- Fallbacks are retargeted to the scheduled mode, including hand-authored present/future exemplars.
- The component reads `currentItem.mode`, displays the matching time cue, and changes the experience mode from card swapping to selecting one story event plus a privacy-safe “Your world” surface.
- Tense modes use the accepted-build-ahead `tense_controlled_account` response class. Story connections use `story_experience_connection`; the base mode keeps `connected_account`.

## Runtime verification

- Explicit pins: **10/10 live eval-test runs passed** (two per mode). Every run produced three challenges exclusively of the pinned type with the correct time-cue contract. No fallbacks.
- Curated blend `tell_present_account|tell_future_account`: three challenges in the scheduled sequence present/future/present. No fallback.
- Explicit mixed: five challenges covering all five types exactly once, with correct cue/no-cue contracts. No fallback.
- Unpinned intent resolution through the production `generateComponentContent` path:
  - “happening today” → three `tell_present_account` challenges.
  - “connect one story event to something familiar or imagined” → three `story_to_experience` challenges.
- The eval endpoint validates known single pins directly. Blend and `mixed` are session controls rather than catalog mode keys, so their payloads were checked manually.

## Contract checks

- Generator/script/response-class suites: **47/47 passed**.
- Backend calibration tests: **2/2 passed**.
- `npm run typecheck:lumina`: **0 errors**.
- Picture labels remain time-neutral and model sentences remain hidden before verdict.
- Tense judging requires temporal consistency but accepts child grammar and paraphrase rather than exact verbs.
- Experience judging never grades truth or emotional value, accepts observed/heard-about/imagined alternatives, and forbids requests for private detail.

## Residual acceptance debt

A browser/microphone sitting is still required before adaptive mastery credit: exercise one fluent correct and one fluent wrong-tense response per tense mode, plus personal-decline → imagined-example handling in `story_to_experience`.
