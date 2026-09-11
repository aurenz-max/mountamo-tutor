# Tier-3 Live Tutor Report — ramp-lab — 2026-09-10

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "ramp-lab", "items": 4, "voice_items": 4, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — no findings.

## Findings

None.

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `explain_from_trials-surface-0` | voice/explain_from_trials | Ramps make work easier. | ✅ | Changing the surface changed the push: setup A moved at 20.5 newtons and setup B at 34.5 newtons, so A needed less push. | ✅ |
| `explain_from_trials-surface-1` | voice/explain_from_trials | Ramps make work easier. | ✅ | Changing the surface changed the push: setup A moved at 10.5 newtons and setup B at 17.5 newtons, so A needed less push. | ✅ |
| `explain_from_trials-surface-2` | voice/explain_from_trials | Ramps make work easier. | ✅ | Changing the surface changed the push: setup A moved at 26 newtons and setup B at 39 newtons, so A needed less push. | ✅ |
| `explain_from_trials-angle-3` | voice/explain_from_trials | Ramps make work easier. | ✅ | Changing the angle changed the push: setup A moved at 32.5 newtons and setup B at 22 newtons, so B needed less push. | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:explain_from_trials-surface-0
*expect: turn · turn_ended: True · 7.4s · audio: 371240 b64 bytes*
*note: voice item (explain_from_trials)*

> What did changing the surface do to the push? Use your two trial results to explain.

### wrong:explain_from_trials-surface-0
*expect: turn · turn_ended: True · 14.7s · audio: 859524 b64 bytes*
*note: student says "Ramps make work easier." — No comparison of the actual trial records.*

> My turn: Setup A needed less push: A first moved at 20.5 newtons and B at 34.5 newtons. Connect the changed condition to those two results. Try again.

### right:explain_from_trials-surface-0
*expect: turn · turn_ended: True · 11.7s · audio: 673924 b64 bytes*
*note: student says "Changing the surface changed the push: setup A moved at 20.5 newtons and setup B at 34.5 newtons, so A needed less push."*

> Yes, your explanation agrees with both trials. Setup A needed less push: A first moved at 20.5 newtons and B at 34.5 newtons.

### ask:explain_from_trials-surface-1
*expect: turn · turn_ended: True · 6.9s · audio: 330884 b64 bytes*
*note: voice item (explain_from_trials)*

> What did changing the surface do to the push? Use your two trial results to explain.

### wrong:explain_from_trials-surface-1
*expect: turn · turn_ended: True · 13.5s · audio: 788488 b64 bytes*
*note: student says "Ramps make work easier." — No comparison of the actual trial records.*

> My turn: Setup A needed less push: A first moved at 10.5 newtons and B at 17.5 newtons. Connect the changed condition to those two results. Try again.

### right:explain_from_trials-surface-1
*expect: turn · turn_ended: True · 11.2s · audio: 640004 b64 bytes*
*note: student says "Changing the surface changed the push: setup A moved at 10.5 newtons and setup B at 17.5 newtons, so A needed less push."*

> Yes, your explanation agrees with both trials. Setup A needed less push: A first moved at 10.5 newtons and B at 17.5 newtons.

### ask:explain_from_trials-surface-2
*expect: turn · turn_ended: True · 6.4s · audio: 316164 b64 bytes*
*note: voice item (explain_from_trials)*

> What did changing the surface do to the push? Use your two trial results to explain.

### wrong:explain_from_trials-surface-2
*expect: turn · turn_ended: True · 13.6s · audio: 800644 b64 bytes*
*note: student says "Ramps make work easier." — No comparison of the actual trial records.*

> My turn: Setup A needed less push: A first moved at 26.0 newtons and B at 39.0 newtons. Connect the changed condition to those two results. Try again.

### right:explain_from_trials-surface-2
*expect: turn · turn_ended: True · 11.6s · audio: 664964 b64 bytes*
*note: student says "Changing the surface changed the push: setup A moved at 26 newtons and setup B at 39 newtons, so A needed less push."*

> Yes, your explanation agrees with both trials. Setup A needed less push: A first moved at 26.0 newtons and B at 39.0 newtons.

### ask:explain_from_trials-angle-3
*expect: turn · turn_ended: True · 6.9s · audio: 331524 b64 bytes*
*note: voice item (explain_from_trials)*

> What did changing the ramp angle do to the push? Use your two trial results to explain.

### wrong:explain_from_trials-angle-3
*expect: turn · turn_ended: True · 13.6s · audio: 792324 b64 bytes*
*note: student says "Ramps make work easier." — No comparison of the actual trial records.*

> My turn: Setup B needed less push: A first moved at 32.5 newtons and B at 22.0 newtons. Connect the changed condition to those two results. Try again.

### right:explain_from_trials-angle-3
*expect: turn · turn_ended: True · 11.4s · audio: 653444 b64 bytes*
*note: student says "Changing the angle changed the push: setup A moved at 32.5 newtons and setup B at 22 newtons, so B needed less push."*

> Yes, your explanation agrees with both trials. Setup B needed less push: A first moved at 32.5 newtons and B at 22.0 newtons.

### complete
*expect: turn · turn_ended: True · 4.1s · audio: 142724 b64 bytes*

> Your investigation is recorded.
