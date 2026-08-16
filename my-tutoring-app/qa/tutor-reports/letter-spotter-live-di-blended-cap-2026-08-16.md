# Tier-3 Live Tutor Report — letter-spotter — 2026-08-16

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "letter-spotter", "items": 6, "voice_items": 2, "gesture_items": 4, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "grade": "K"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 2 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:ch1 1/1, wrong3:ch1 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `ch1` | voice/name-it | M | ✅✅✅ | - | n/a |
| `ch2` | gesture/find-it | (placement) | ✅ | (placement) | ✅ |
| `ch3` | gesture/match-it | (placement) | ✅ | (placement) | ✅ |
| `ch4` | voice/name-it | M | ✅ | I | ✅ |
| `ch5` | gesture/find-it | (placement) | ✅ | (placement) | ✅ |
| `ch6` | gesture/match-it | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:ch1
*expect: turn · turn_ended: True · 16.9s · audio: 974084 b64 bytes*
*note: voice item (name-it)*

> Hi! Time to go letter spotting! The star is hiding the first letter of the word — you tell me the letter it is hiding! Listen for the sound at the very start of the word. Listen: I can see the sun. Your turn. Say the letter that sun starts with.

### wrong1:ch1
*expect: turn · turn_ended: True · 8.7s · audio: 474884 b64 bytes*
*note: student says "M"*

> My turn: listen to the start of the word. Sss … sun. Your turn. Say the letter that sun starts with.

### wrong2:ch1
*expect: turn · turn_ended: True · 8.5s · audio: 472964 b64 bytes*
*note: student says "M"*

> My turn: listen to the start of the word. Sss … sun. Your turn. Say the letter that sun starts with.

### wrong3:ch1
*expect: turn · turn_ended: True · 9.4s · audio: 490884 b64 bytes*
*note: student says "M"*

> My turn: listen to the start of the word. Sss … sun. Your turn. Say the letter that sun starts with.

### moveon:ch1
*expect: turn · turn_ended: True · 16.8s · audio: 970884 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try! The word sun starts with S. Here comes the next one. I name a letter — you find it in the boxes and tap it! Look at one row at a time, all the way across. Find the letter A. Your turn. Tap it in the boxes.

### hands-hold:ch2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:ch2
*expect: turn · turn_ended: True · 9.1s · audio: 444804 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the letter we want is A. Your turn. Look along each row and tap the letter A.

### commit-right:ch2
*expect: turn · turn_ended: True · 3.7s · audio: 131204 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is the letter A.

### ask:ch3
*expect: turn · turn_ended: True · 13.7s · audio: 780164 b64 bytes*
*note: gesture item (match-it)*

> You will see one big letter, and some little letters underneath. Big letters and little letters can look different and still be the same letter. Look at the big letter. Your turn. Tap the little letter that is the same letter.

### hands-hold:ch3
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:ch3
*expect: turn · turn_ended: True · 8.9s · audio: 470404 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: big T and little t are the same letter. Your turn. Tap the little letter that is the same as the big one.

### commit-right:ch3
*expect: turn · turn_ended: True · 3.8s · audio: 162564 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, big T and little t go together.

### ask:ch4
*expect: turn · turn_ended: True · 14.9s · audio: 847364 b64 bytes*
*note: voice item (name-it)*

> The star is hiding the first letter of the word — you tell me the letter it is hiding! Listen for the sound at the very start of the word. Listen: Insects crawl on the hay. Your turn. Say the letter that insects starts with.

### wrong:ch4
*expect: turn · turn_ended: True · 9.5s · audio: 516484 b64 bytes*
*note: student says "M"*

> My turn: listen to the start of the word. Iii … insects. Your turn. Say the letter that insects starts with.

### right:ch4
*expect: turn · turn_ended: True · 4.0s · audio: 136964 b64 bytes*
*note: student says "I"*

> Yes, insects starts with I.

### ask:ch5
*expect: turn · turn_ended: True · 12.0s · audio: 650920 b64 bytes*
*note: gesture item (find-it)*

> I name a letter — you find it in the boxes and tap it! Look at one row at a time, all the way across. Find the letter P. Your turn. Tap it in the boxes.

### hands-hold:ch5
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:ch5
*expect: turn · turn_ended: True · 8.6s · audio: 448680 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the letter we want is P. Your turn. Look along each row and tap the letter P.

### commit-right:ch5
*expect: turn · turn_ended: True · 4.4s · audio: 130564 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is the letter P.

### ask:ch6
*expect: turn · turn_ended: True · 14.3s · audio: 793604 b64 bytes*
*note: gesture item (match-it)*

> You will see one big letter, and some little letters underneath. Big letters and little letters can look different and still be the same letter. Look at the big letter. Your turn. Tap the little letter that is the same letter.

### hands-hold:ch6
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:ch6
*expect: turn · turn_ended: True · 9.3s · audio: 485124 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: big N and little n are the same letter. Your turn. Tap the little letter that is the same as the big one.

### commit-right:ch6
*expect: turn · turn_ended: True · 3.9s · audio: 167684 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, big N and little n go together.

### complete
*expect: turn · turn_ended: True · 5.9s · audio: 276484 b64 bytes*

> What great letter spotting today! Your eyes are getting sharp. See you next time!
