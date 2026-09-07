# Tier-3 Live Tutor Report — di-worked-procedure — 2026-09-07

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "di-worked-procedure", "items": 9, "voice_items": 9, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": true, "capped_item": "wp-1-75-37-c0-decide", "grade": "Grade 2", "undrivable_items": []}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 2 beat instances), 0 single-run note(s).

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `di-correction-verbatim-repeat` | wrong2:wp-1-75-37-c0-decide 1/1, wrong3:wp-1-75-37-c0-decide 1/1 (2 beats) | the correction is word-for-word the previous one on this item — DISTAR firms by escalating, not by repeating |

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `wp-1-75-37-c0-decide` | voice/talk_through | I regroup: six tens, sixteen ones | ✅✅✅ | - | n/a |
| `wp-1-75-37-c0-subtract` | voice/talk_through | seven | ✅ | fifteen minus seven is eight | ✅ |
| `wp-1-75-37-c1-decide` | voice/talk_through | two | ✅ | no regrouping, six minus three is three | ✅ |
| `wp-2-83-44-c0-decide` | voice/talk_through | I regroup: seven tens, fourteen ones | ✅ | I can't take four from three, so I regroup: seven tens, thirteen ones | ✅ |
| `wp-2-83-44-c0-subtract` | voice/talk_through | eight | ✅ | thirteen minus four is nine | ✅ |
| `wp-2-83-44-c1-decide` | voice/talk_through | two | ✅ | no regrouping, seven minus four is three | ✅ |
| `wp-3-90-48-c0-decide` | voice/talk_through | I regroup: eight tens, eleven ones | ✅ | I can't take eight from zero, so I regroup: eight tens, ten ones | ✅ |
| `wp-3-90-48-c0-subtract` | voice/talk_through | one | ✅ | ten minus eight is two | ✅ |
| `wp-3-90-48-c1-decide` | voice/talk_through | three | ✅ | no regrouping, eight minus four is four | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:wp-1-75-37-c0-decide
*expect: turn · turn_ended: True · 13.2s · audio: 752644 b64 bytes*
*note: voice item (talk_through)*

> We are going to work subtraction out loud, one column at a time. I ask, and you tell me what you do. Seventy-five minus thirty-seven. Start in the ones column. Tell me what you do.

### wrong1:wp-1-75-37-c0-decide
*expect: turn · turn_ended: True · 17.3s · audio: 1030404 b64 bytes*
*note: student says "I regroup: six tens, sixteen ones"*

> My turn: not "six tens, sixteen ones" — five minus seven, I can't take seven from five, so I regroup. One ten becomes ten ones: six tens, fifteen ones. Your turn. The ones column. Tell me what you do.

### wrong2:wp-1-75-37-c0-decide
*expect: turn · turn_ended: True · 16.9s · audio: 1008004 b64 bytes*
*note: student says "I regroup: six tens, sixteen ones"*

> My turn: not "six tens, sixteen ones" — five minus seven, I can't take seven from five, so I regroup. One ten becomes ten ones: six tens, fifteen ones. Your turn. The ones column. Tell me what you do.

### wrong3:wp-1-75-37-c0-decide
*expect: turn · turn_ended: True · 17.0s · audio: 1016360 b64 bytes*
*note: student says "I regroup: six tens, sixteen ones"*

> My turn: not "six tens, sixteen ones" — five minus seven, I can't take seven from five, so I regroup. One ten becomes ten ones: six tens, fifteen ones. Your turn. The ones column. Tell me what you do.

### moveon:wp-1-75-37-c0-decide
*expect: turn · turn_ended: True · 7.1s · audio: 358404 b64 bytes*
*note: corrections cap reached — the lesson carries forward carrying the next item's ask*

> Good try. We regroup: six tens, fifteen ones. Now subtract the ones.

### wrong:wp-1-75-37-c0-subtract
*expect: turn · turn_ended: True · 8.0s · audio: 430120 b64 bytes*
*note: student says "seven"*

> My turn: not "seven" — fifteen minus seven is eight. Your turn. Subtract the ones.

### right:wp-1-75-37-c0-subtract
*expect: turn · turn_ended: True · 3.7s · audio: 163844 b64 bytes*
*note: student says "fifteen minus seven is eight"*

> Yes, fifteen minus seven is eight.

### ask:wp-1-75-37-c1-decide
*expect: turn · turn_ended: True · 4.9s · audio: 193924 b64 bytes*
*note: voice item (talk_through)*

> Now the tens column. Tell me what you do.

### wrong:wp-1-75-37-c1-decide
*expect: turn · turn_ended: True · 8.4s · audio: 457604 b64 bytes*
*note: student says "two"*

> My turn: not "two" — six minus three is three. Your turn. The tens column. Tell me what you do.

### right:wp-1-75-37-c1-decide
*expect: turn · turn_ended: True · 7.8s · audio: 419844 b64 bytes*
*note: student says "no regrouping, six minus three is three"*

> Yes, no regrouping: six minus three is three. Seventy-five minus thirty-seven is thirty-eight.

### ask:wp-2-83-44-c0-decide
*expect: turn · turn_ended: True · 6.5s · audio: 314280 b64 bytes*
*note: voice item (talk_through)*

> Eighty-three minus forty-four. Start in the ones column. Tell me what you do.

### wrong:wp-2-83-44-c0-decide
*expect: turn · turn_ended: True · 17.3s · audio: 1029764 b64 bytes*
*note: student says "I regroup: seven tens, fourteen ones"*

> My turn: not "seven tens, fourteen ones" — three minus four, I can't take four from three, so I regroup. One ten becomes ten ones: seven tens, thirteen ones. Your turn. The ones column. Tell me what you do.

### right:wp-2-83-44-c0-decide
*expect: turn · turn_ended: True · 4.8s · audio: 224004 b64 bytes*
*note: student says "I can't take four from three, so I regroup: seven tens, thirteen ones"*

> Yes, regroup: seven tens, thirteen ones.

### ask:wp-2-83-44-c0-subtract
*expect: turn · turn_ended: True · 3.6s · audio: 138884 b64 bytes*
*note: voice item (talk_through)*

> Now subtract the ones.

### wrong:wp-2-83-44-c0-subtract
*expect: turn · turn_ended: True · 7.6s · audio: 416680 b64 bytes*
*note: student says "eight"*

> My turn: not "eight" — thirteen minus four is nine. Your turn. Subtract the ones.

### right:wp-2-83-44-c0-subtract
*expect: turn · turn_ended: True · 4.3s · audio: 199684 b64 bytes*
*note: student says "thirteen minus four is nine"*

> Yes, thirteen minus four is nine.

### ask:wp-2-83-44-c1-decide
*expect: turn · turn_ended: True · 4.2s · audio: 169000 b64 bytes*
*note: voice item (talk_through)*

> Now the tens column. Tell me what you do.

### wrong:wp-2-83-44-c1-decide
*expect: turn · turn_ended: True · 8.8s · audio: 468484 b64 bytes*
*note: student says "two"*

> My turn: not "two" — seven minus four is three. Your turn. The tens column. Tell me what you do.

### right:wp-2-83-44-c1-decide
*expect: turn · turn_ended: True · 7.9s · audio: 424964 b64 bytes*
*note: student says "no regrouping, seven minus four is three"*

> Yes, no regrouping: seven minus four is three. Eighty-three minus forty-four is thirty-nine.

### ask:wp-3-90-48-c0-decide
*expect: turn · turn_ended: True · 6.2s · audio: 300840 b64 bytes*
*note: voice item (talk_through)*

> Ninety minus forty-eight. Start in the ones column. Tell me what you do.

### wrong:wp-3-90-48-c0-decide
*expect: turn · turn_ended: True · 16.8s · audio: 979844 b64 bytes*
*note: student says "I regroup: eight tens, eleven ones"*

> My turn: not "eight tens, eleven ones" — zero minus eight, I can't take eight from zero, so I regroup. One ten becomes ten ones: eight tens, ten ones. Your turn. The ones column. Tell me what you do.

### right:wp-3-90-48-c0-decide
*expect: turn · turn_ended: True · 4.9s · audio: 222724 b64 bytes*
*note: student says "I can't take eight from zero, so I regroup: eight tens, ten ones"*

> Yes, regroup: eight tens, ten ones.

### ask:wp-3-90-48-c0-subtract
*expect: turn · turn_ended: True · 3.8s · audio: 139524 b64 bytes*
*note: voice item (talk_through)*

> Now subtract the ones.

### wrong:wp-3-90-48-c0-subtract
*expect: turn · turn_ended: True · 8.2s · audio: 440360 b64 bytes*
*note: student says "one"*

> My turn: not "one" — ten minus eight is two. Your turn. Subtract the ones.

### right:wp-3-90-48-c0-subtract
*expect: turn · turn_ended: True · 3.9s · audio: 171524 b64 bytes*
*note: student says "ten minus eight is two"*

> Yes, ten minus eight is two.

### ask:wp-3-90-48-c1-decide
*expect: turn · turn_ended: True · 4.0s · audio: 152360 b64 bytes*
*note: voice item (talk_through)*

> Now the tens column. Tell me what you do.

### wrong:wp-3-90-48-c1-decide
*expect: turn · turn_ended: True · 7.9s · audio: 426244 b64 bytes*
*note: student says "three"*

> My turn: not "three" — eight minus four is four. Your turn. The tens column. Tell me what you do.

### right:wp-3-90-48-c1-decide
*expect: turn · turn_ended: True · 7.3s · audio: 391044 b64 bytes*
*note: student says "no regrouping, eight minus four is four"*

> Yes, no regrouping: eight minus four is four. Ninety minus forty-eight is forty-two.

### complete
*expect: turn · turn_ended: True · 6.2s · audio: 316200 b64 bytes*

> That's the end of our subtraction work. You did every column yourself. Great work today!
