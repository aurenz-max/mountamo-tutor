# Tier-3 Live Tutor Report — story-talk — 2026-08-14

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "story-talk", "items": 5, "voice_items": 5, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "grade": "Kindergarten"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 2 WARN mechanism(s) confirmed (0 + 3 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:story-talk-1 1/1, wrong3:story-talk-1 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |
| CONFIRMED | WARN | `di-capped-item-asks-then-withdraws` | wrong3:story-talk-1 1/1 (1 beat) | the last correction before the cap ends in a question the runner is about to withdraw with the move-on cue — the child is asked, then told to move on before they can answer |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `story-talk-1` | voice/who_what_where | walrus | ✅✅✅ | - | n/a |
| `story-talk-2` | voice/who_what_where | walrus | ✅ | owl | ✅ |
| `story-talk-3` | voice/who_what_where | walrus | ✅ | berry | ✅ |
| `story-talk-4` | voice/who_what_where | walrus | ✅ | frog | ✅ |
| `story-talk-5` | voice/who_what_where | walrus | ✅ | acorn | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:story-talk-1
*expect: turn · turn_ended: True · 23.8s · audio: 1408004 b64 bytes*
*note: voice item (who_what_where)*

> Hi! Story time! I tell you a little story, then I ask you about it. You tell me the answer out loud! Listen. Oliver the brave otter waddled down to the muddy river bank. He slid his tummy right down the mud into the water. He splashed happily in the cold stream. Your turn. Where did the otter slide his tummy?

### wrong1:story-talk-1
*expect: turn · turn_ended: True · 6.4s · audio: 323844 b64 bytes*
*note: student says "walrus"*

> My turn: river. Your turn. Where did the otter slide his tummy?

### wrong2:story-talk-1
*expect: turn · turn_ended: True · 6.6s · audio: 327684 b64 bytes*
*note: student says "walrus"*

> My turn: river. Your turn. Where did the otter slide his tummy?

### wrong3:story-talk-1
*expect: turn · turn_ended: True · 6.1s · audio: 316164 b64 bytes*
*note: student says "walrus"*

> My turn: river. Your turn. Where did the otter slide his tummy?

### moveon:story-talk-1
*expect: turn · turn_ended: True · 19.7s · audio: 1155844 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! The answer was river. Here comes the next story. Listen. Fiona the fluffy owl woke up when the sun went down. She spread her wings to fly across the night sky. She looked for mice in the dark forest. Your turn. Who woke up when the sun went down?

### wrong:story-talk-2
*expect: turn · turn_ended: True · 7.2s · audio: 332840 b64 bytes*
*note: student says "walrus"*

> My turn: owl. Your turn. Who woke up when the sun went down?

### right:story-talk-2
*expect: turn · turn_ended: True · 3.2s · audio: 95400 b64 bytes*
*note: student says "owl"*

> Yes, owl!

### ask:story-talk-3
*expect: turn · turn_ended: True · 15.5s · audio: 892804 b64 bytes*
*note: voice item (who_what_where)*

> Listen. Felix the red fox walked softly through the green grass. He spotted a sweet red berry on a low bush. He gobbled up the tasty treat for a snack. Your turn. What did the fox eat for a snack?

### wrong:story-talk-3
*expect: turn · turn_ended: True · 6.6s · audio: 344324 b64 bytes*
*note: student says "walrus"*

> My turn: berry. Your turn. What did the fox eat for a snack?

### right:story-talk-3
*expect: turn · turn_ended: True · 3.4s · audio: 135720 b64 bytes*
*note: student says "berry"*

> Yes, berry!

### ask:story-talk-4
*expect: turn · turn_ended: True · 15.4s · audio: 890920 b64 bytes*
*note: voice item (who_what_where)*

> Listen. Penny the little frog hopped right to the edge of the water. She jumped high into the blue pond with a big splash. She swam around to catch tiny bugs. Your turn. What animal jumped into the pond?

### wrong:story-talk-4
*expect: turn · turn_ended: True · 6.6s · audio: 352680 b64 bytes*
*note: student says "walrus"*

> My turn: frog. Your turn. What animal jumped into the pond?

### right:story-talk-4
*expect: turn · turn_ended: True · 3.5s · audio: 133160 b64 bytes*
*note: student says "frog"*

> Yes, frog!

### ask:story-talk-5
*expect: turn · turn_ended: True · 14.2s · audio: 810244 b64 bytes*
*note: voice item (who_what_where)*

> Listen. Sammy the squirrel hopped up into the tall tree. He found a crunchy acorn sitting on a branch. Sammy picked it up with his paws to eat. Your turn. What did the squirrel find on the branch?

### wrong:story-talk-5
*expect: turn · turn_ended: True · 6.9s · audio: 355880 b64 bytes*
*note: student says "walrus"*

> My turn: acorn. Your turn. What did the squirrel find on the branch?

### right:story-talk-5
*expect: turn · turn_ended: True · 3.1s · audio: 109444 b64 bytes*
*note: student says "acorn"*

> Yes, acorn!

### complete
*expect: turn · turn_ended: True · 7.7s · audio: 413444 b64 bytes*

> What wonderful listening today! You heard every story and told me all the answers. See you next time!
