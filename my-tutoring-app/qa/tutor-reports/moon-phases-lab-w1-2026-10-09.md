# moon-phases-lab W1 (ROLLOUT C14), 2026-10-09: HELD

Executor: `/add-live-tutor-tools` (W1, plain shape P). Outcome: **not bound**. No production files changed.

## Why it is held

1. **No catalog eval modes.** The `moon-phases-lab` entry in `service/manifest/catalog/astronomy.ts` declares no
   `evalModes`. `workspaceAdapter` builds a graded family's modes from `entry.evalModes`, so a graded binding would
   have zero modes: no payload to save (`save_payload.py --mode`), and `workspaceContract.test.tsx` has nothing to
   mount.
2. **The only check is optional and rarely generated.** The payload has one optional `challengePhase`. The
   generator asks Gemini for it only when the topic contains "challenge" or "find"
   (`service/astronomy/gemini-moon-phases-lab.ts`). Without it the activity is free exploration, and
   `handleCheckUnderstanding` scores exploration alone (phases visited / 8, success at 70%).
3. **Where a challenge exists, it can be solved from the labels at grade 2 and up.** The heading reads
   "Challenge: Find the First Quarter", and the pick buttons below it read "🌓 First Quarter". The learner taps
   the button whose name matches the heading. The pick also ignores the Moon model: the task text says "Move the
   Moon to show what a first quarter looks like", but the moon's position is never checked. At K-1 the buttons
   show only emoji, so the pick is a real picture-identification item, but there is only one per lesson.

## What would unblock it (needs a decision, not run here)

- **`/add-eval-modes` (recommended):** give it task identities that code can check from the model, for example
  - `find_phase`: a pictured or spoken target phase; the learner moves the Moon until the Earth view matches. Code
    checks `getPhaseFromAngle(moonPosition)`, and no button names the target.
  - `name_phase`: the Moon is shown in a phase; the learner picks the matching picture (emoji only at every
    grade, with no names on the buttons).
  - `next_phase`: given the current phase, pick the one that comes next.
  The generator should emit a list of challenges per mode, not one optional field. W1 then binds in the plain
  shape like coin-counter.
- **Alternatively, a user ruling to bind it `teachingWorkspace.ungraded`** (exposition face, user ruling 09-24,
  precedent `adaptation-investigator`). The tutor would be present for exploration only, with no credit.

## Gates

None run: there is no binding to test. Phase 2 (levers) was not started, because it needs the W1 binding.

## Sibling note

`day-night-seasons` (same batch) also declares no `evalModes` in `astronomy.ts`.
