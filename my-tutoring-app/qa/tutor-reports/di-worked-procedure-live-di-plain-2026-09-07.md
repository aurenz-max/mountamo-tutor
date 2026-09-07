# Tier-3 Live Tutor Report — di-worked-procedure — 2026-09-07

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "di-worked-procedure", "items": 9, "voice_items": 9, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "capped_item": null, "grade": "Grade 2", "undrivable_items": []}`
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
| `wp-1-83-39-c0-decide` | voice/talk_through | I regroup: seven tens, fourteen ones | ✅ | I can't take nine from three, so I regroup: seven tens, thirteen ones | ✅ |
| `wp-1-83-39-c0-subtract` | voice/talk_through | three | ✅ | thirteen minus nine is four | ✅ |
| `wp-1-83-39-c1-decide` | voice/talk_through | three | ✅ | no regrouping, seven minus three is four | ✅ |
| `wp-2-95-78-c0-decide` | voice/talk_through | I regroup: eight tens, sixteen ones | ✅ | I can't take eight from five, so I regroup: eight tens, fifteen ones | ✅ |
| `wp-2-95-78-c0-subtract` | voice/talk_through | six | ✅ | fifteen minus eight is seven | ✅ |
| `wp-2-95-78-c1-decide` | voice/talk_through | two | ✅ | no regrouping, eight minus seven is one | ✅ |
| `wp-3-81-53-c0-decide` | voice/talk_through | I regroup: seven tens, twelve ones | ✅ | I can't take three from one, so I regroup: seven tens, eleven ones | ✅ |
| `wp-3-81-53-c0-subtract` | voice/talk_through | seven | ✅ | eleven minus three is eight | ✅ |
| `wp-3-81-53-c1-decide` | voice/talk_through | one | ✅ | no regrouping, seven minus five is two | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:wp-1-83-39-c0-decide
*expect: turn · turn_ended: True · 11.6s · audio: 632964 b64 bytes*
*note: voice item (talk_through)*

> We are going to work subtraction out loud, one column at a time. I ask, and you tell me what you do. Eighty-three minus thirty-nine. Start in the ones column. Tell me what you do.

### wrong:wp-1-83-39-c0-decide
*expect: turn · turn_ended: True · 15.3s · audio: 869764 b64 bytes*
*note: student says "I regroup: seven tens, fourteen ones"*

> My turn: not fourteen ones — three minus nine, I can't take nine from three, so I regroup. One ten becomes ten ones: seven tens, thirteen ones. Your turn. The ones column. Tell me what you do.

### right:wp-1-83-39-c0-decide
*expect: turn · turn_ended: True · 5.4s · audio: 234244 b64 bytes*
*note: student says "I can't take nine from three, so I regroup: seven tens, thirteen ones"*

> Yes, regroup: seven tens, thirteen ones.

### ask:wp-1-83-39-c0-subtract
*expect: turn · turn_ended: True · 3.6s · audio: 101764 b64 bytes*
*note: voice item (talk_through)*

> Now subtract the ones.

### wrong:wp-1-83-39-c0-subtract
*expect: turn · turn_ended: True · 7.4s · audio: 401284 b64 bytes*
*note: student says "three"*

> My turn: not three — thirteen minus nine is four. Your turn. Subtract the ones.

### right:wp-1-83-39-c0-subtract
*expect: turn · turn_ended: True · 4.0s · audio: 160004 b64 bytes*
*note: student says "thirteen minus nine is four"*

> Yes, thirteen minus nine is four.

### ask:wp-1-83-39-c1-decide
*expect: turn · turn_ended: True · 3.8s · audio: 143364 b64 bytes*
*note: voice item (talk_through)*

> Now the tens column. Tell me what you do.

### wrong:wp-1-83-39-c1-decide
*expect: turn · turn_ended: True · 8.1s · audio: 427524 b64 bytes*
*note: student says "three"*

> My turn: not three — seven minus three is four. Your turn. The tens column. Tell me what you do.

### right:wp-1-83-39-c1-decide
*expect: turn · turn_ended: True · 8.0s · audio: 417284 b64 bytes*
*note: student says "no regrouping, seven minus three is four"*

> Yes, no regrouping: seven minus three is four. Eighty-three minus thirty-nine is forty-four.

### ask:wp-2-95-78-c0-decide
*expect: turn · turn_ended: True · 6.2s · audio: 288644 b64 bytes*
*note: voice item (talk_through)*

> Ninety-five minus seventy-eight. Start in the ones column. Tell me what you do.

### wrong:wp-2-95-78-c0-decide
*expect: turn · turn_ended: True · 14.6s · audio: 850564 b64 bytes*
*note: student says "I regroup: eight tens, sixteen ones"*

> My turn: not sixteen ones — five minus eight, I can't take eight from five, so I regroup. One ten becomes ten ones: eight tens, fifteen ones. Your turn. The ones column. Tell me what you do.

### right:wp-2-95-78-c0-decide
*expect: turn · turn_ended: True · 5.0s · audio: 231080 b64 bytes*
*note: student says "I can't take eight from five, so I regroup: eight tens, fifteen ones"*

> Yes, regroup: eight tens, fifteen ones.

### ask:wp-2-95-78-c0-subtract
*expect: turn · turn_ended: True · 3.8s · audio: 122244 b64 bytes*
*note: voice item (talk_through)*

> Now subtract the ones.

### wrong:wp-2-95-78-c0-subtract
*expect: turn · turn_ended: True · 7.7s · audio: 417284 b64 bytes*
*note: student says "six"*

> My turn: not six — fifteen minus eight is seven. Your turn. Subtract the ones.

### right:wp-2-95-78-c0-subtract
*expect: turn · turn_ended: True · 4.4s · audio: 148484 b64 bytes*
*note: student says "fifteen minus eight is seven"*

> Yes, fifteen minus eight is seven.

### ask:wp-2-95-78-c1-decide
*expect: turn · turn_ended: True · 4.4s · audio: 171524 b64 bytes*
*note: voice item (talk_through)*

> Now the tens column. Tell me what you do.

### wrong:wp-2-95-78-c1-decide
*expect: turn · turn_ended: True · 10.8s · audio: 614404 b64 bytes*
*note: student says "two"*

> My turn: not two — this column lent one, so it is eight now, not nine. Eight minus seven is one. Your turn. The tens column. Tell me what you do.

### right:wp-2-95-78-c1-decide
*expect: turn · turn_ended: True · 7.4s · audio: 391684 b64 bytes*
*note: student says "no regrouping, eight minus seven is one"*

> Yes, no regrouping: eight minus seven is one. Ninety-five minus seventy-eight is seventeen.

### ask:wp-3-81-53-c0-decide
*expect: turn · turn_ended: True · 6.6s · audio: 320040 b64 bytes*
*note: voice item (talk_through)*

> Eighty-one minus fifty-three. Start in the ones column. Tell me what you do.

### wrong:wp-3-81-53-c0-decide
*expect: turn · turn_ended: True · 14.6s · audio: 844804 b64 bytes*
*note: student says "I regroup: seven tens, twelve ones"*

> My turn: not twelve ones — one minus three, I can't take three from one, so I regroup. One ten becomes ten ones: seven tens, eleven ones. Your turn. The ones column. Tell me what you do.

### right:wp-3-81-53-c0-decide
*expect: turn · turn_ended: True · 4.7s · audio: 220840 b64 bytes*
*note: student says "I can't take three from one, so I regroup: seven tens, eleven ones"*

> Yes, regroup: seven tens, eleven ones.

### ask:wp-3-81-53-c0-subtract
*expect: turn · turn_ended: True · 4.0s · audio: 125444 b64 bytes*
*note: voice item (talk_through)*

> Now subtract the ones.

### wrong:wp-3-81-53-c0-subtract
*expect: turn · turn_ended: True · 7.8s · audio: 422440 b64 bytes*
*note: student says "seven"*

> My turn: not seven — eleven minus three is eight. Your turn. Subtract the ones.

### right:wp-3-81-53-c0-subtract
*expect: turn · turn_ended: True · 3.9s · audio: 168964 b64 bytes*
*note: student says "eleven minus three is eight"*

> Yes, eleven minus three is eight.

### ask:wp-3-81-53-c1-decide
*expect: turn · turn_ended: True · 4.3s · audio: 181800 b64 bytes*
*note: voice item (talk_through)*

> Now the tens column. Tell me what you do.

### wrong:wp-3-81-53-c1-decide
*expect: turn · turn_ended: True · 8.1s · audio: 437124 b64 bytes*
*note: student says "one"*

> My turn: not one — seven minus five is two. Your turn. The tens column. Tell me what you do.

### right:wp-3-81-53-c1-decide
*expect: turn · turn_ended: True · 7.2s · audio: 384644 b64 bytes*
*note: student says "no regrouping, seven minus five is two"*

> Yes, no regrouping: seven minus five is two. Eighty-one minus fifty-three is twenty-eight.

### complete
*expect: turn · turn_ended: True · 6.2s · audio: 314244 b64 bytes*

> That's the end of our subtraction work. You did every column yourself. Great work today!
