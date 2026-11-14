# gemini-decision-1 vs Jev on the JEV observation kinds — 2026-11-11

Adapter: `service/manifest/typesafe/geminiDecisions.ts`, reached through `systemOne(..., { model: 'gemini-decision-1', media })`
or `LUMINA_SYSTEM_ONE_MODEL=gemini-decision-1`. Same questions, same decide functions. Spend: $0.04 for ~611 calls.

## Text: the kinds' own case sets (2 runs each)

| kind | Jev pass | Gemini pass | unsafe (both) | flips Jev / Gemini | p50 ms Jev / Gemini |
|---|---|---|---|---|---|
| item_score (24) | 43/48 (90%) | 34/48 (71%) | 0 / 0 | 1 / 0 | 79 / 234 |
| learner_intent (129, every domain) | 252/266 (95%) | 256/266 (96%) | 0 / 0 | 12 / 2 | 78 / 192 |
| assignment_outcome (16) | 28/32 (88%) | 28/32 (88%) | 0 / 0 | 0 / 0 | 85 / 201 |

- Gemini's item_score misses are all "unclear" (0.2–0.8), never wrong-way: it is on the right side of 0.5 on 23/24 cases and
  has the better Brier (0.034 vs 0.041). The 0.8/0.2 gate was tuned on Jev's sharper outputs.
- These case sets and prompts were iterated against Jev, so the text comparison leans toward Jev.

## Audio: spoken-audio-cases.mjs (24 cases, transcript = a plausible ASR error, gold = what was said; SAPI adult voices ×2, 2 runs)

| arm | pass | right side of 0.5 | false credit | Brier | p50 ms |
|---|---|---|---|---|---|
| jev/text | 6/48 | 15/48 | 13 | 0.560 | 78 |
| gemini/text | 10/48 | 12/48 | 14 | 0.642 | 231 |
| gemini/text+audio | 56/96 | 66/96 | 12 | 0.229 | 342 |
| gemini/audio only | 78/96 | 88/96 | 4 | 0.074 | 329 |

- Text arms fail by construction (the transcript is wrong); the result is that audio recovers the answer: letter sound vs
  letter name from an identical transcript "s"/"m", forty vs fourteen, four heard as five, rectangle heard as triangle.
- Sending the transcript beside the audio makes it worse: the model anchors on the transcript (cat_as_cut 0.08,
  forty_as_fourteen 0.31). Audio alone is the arm to build on.
- Audio-only misses: cot→cat false credit ×4 (SAPI vowel, unverified), skipped "the" in a sentence 0.70, silence 0.43,
  letter name "ess" 0.26 (Zira). Zero run-to-run flips.

Limits: synthetic adult speech, not child speech; neutral tutor reply; 24 cases. Next evidence needed: real learner clips.

## Shadow wiring (same day): letter-sound-link and every spoken family with misses

- `spoken_miss_audio` kind (`service/typesafe/observeSpokenAudio.ts`) + `/api/lumina/observe-spoken-audio`: the item's own
  misses and questions, audio only, gemini-decision-1.
- Client: `utils/learnerClip.ts` keeps the mic frames between a tutor turn's end and the next tutor audio (LuminaAIContext);
  `useTeachingWorkspace.observeSpokenMiss` posts the clip beside the Jev transcript call and records trace stage
  `spoken_audio`. Nothing reads it. Off unless the JEV inspector checkbox is on (`localStorage lumina.decisionsAudio`).
- Not yet run against the model: `scripts/spoken-audio-probe.mjs` (letter-sound-link see_hear, SAPI clips, Jev transcript
  arm beside it) hit HTTP 429 "monthly spending cap" on the Google project. Re-run it once the cap is raised.
