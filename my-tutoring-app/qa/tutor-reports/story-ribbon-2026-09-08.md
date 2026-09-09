# Story Ribbon — L2 tutoring scaffold

2026-09-08. Story Ribbon now has a mode-aware catalog tutoring contract for its five L1 task identities. The shared judged-script runner remains the single connection, speech-trigger, verdict, and progression owner; no competing `useLuminaAI` hook or duplicate Gemini turn was added.

| Check | Result |
|---|---|
| Tier 1 connection audit | PASS, zero findings |
| Tier 2 `tell_connected_account` | PASS, all runtime keys component-resolved; no `(not set)` |
| Tier 2 `tell_present_account` | PASS, `Today` context preserved; no `(not set)` |
| Tier 2 `tell_future_account` | PASS, `Tomorrow` context preserved; no `(not set)` |
| Tier 2 `tell_past_account` | PASS, `Yesterday` context preserved; no `(not set)` |
| Tier 2 `story_to_experience` | PASS, privacy-safe task identity preserved; no `(not set)` |
| Focused Story Ribbon tests | 16/16 PASS |
| Lumina typecheck | PASS, zero errors |
| Tier 3 live microphone behavior | Not driven; remains owed |

Eight focused task keys are published at connection and on every item change: `challengeType`, `storyTitle`, `characterName`, `setting`, `timeCue`, `taskFocus`, `currentTurn`, and `totalTurns`. L3 additionally publishes seven support-state keys: `supportTier`, four visibility flags, `instructionLevel`, and `tutorRevealPolicy`. Hidden event sentences, canonical answer order, target verb forms, and model connections are intentionally absent from this context bag.

The three scaffold levels follow the existing judged-loop progression: the visible ribbon plus exact item ask, the item-specific post-attempt correction, then the same correction repeated more slowly before the runner-owned cap and move-on. Observable struggles cover missing events, disconnected labels, reversed chronology, tense drift, incomplete story-to-experience responses, unexplained similarities, and planning pauses.

Four existing silent scripted tags are documented and verified: `[SR_ITEM]`, `[SR_MOVE]`, `[SR_COMPLETE]`, and `[SR_HEAR]`. Directives require exact-line delivery, active-mode judging, silence during card planning, post-verdict-only modeling, and privacy-safe alternatives to personal disclosure.

Tier 1–2 verify the connection and assembled prompt, not live speech behavior. The L3 follow-up re-ran Tier 1 plus easy/hard prompt probes with zero findings. Tier 3 should confirm one Gemini turn per cue, exact correction/affirmation sentinels, silence while pictures are being arranged, no restoration of tier-withdrawn help, no pre-verdict answer leak, and no pressure for personal details in `story_to_experience`.
