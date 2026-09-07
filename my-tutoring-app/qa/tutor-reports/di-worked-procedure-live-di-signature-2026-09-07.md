# Tier-3 Live Tutor Report — di-worked-procedure — 2026-09-07

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "di-worked-procedure", "items": 9, "voice_items": 9, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 2", "undrivable_items": []}`
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
| `wp-1-71-58-c0-decide` | voice/talk_through | eight minus one is seven | ✅ | I can't take eight from one, so I regroup: six tens, eleven ones | ✅ |
| `wp-1-71-58-c0-subtract` | voice/talk_through | seven | ✅ | eleven minus eight is three | ✅ |
| `wp-1-71-58-c1-decide` | voice/talk_through | seven minus five is two | ✅ | no regrouping, six minus five is one | ✅ |
| `wp-2-96-27-c0-decide` | voice/talk_through | seven minus six is one | ✅ | I can't take seven from six, so I regroup: eight tens, sixteen ones | ✅ |
| `wp-2-96-27-c0-subtract` | voice/talk_through | one | ✅ | sixteen minus seven is nine | ✅ |
| `wp-2-96-27-c1-decide` | voice/talk_through | nine minus two is seven | ✅ | no regrouping, eight minus two is six | ✅ |
| `wp-3-80-12-c0-decide` | voice/talk_through | two minus zero is two | ✅ | I can't take two from zero, so I regroup: seven tens, ten ones | ✅ |
| `wp-3-80-12-c0-subtract` | voice/talk_through | two | ✅ | ten minus two is eight | ✅ |
| `wp-3-80-12-c1-decide` | voice/talk_through | eight minus one is seven | ✅ | no regrouping, seven minus one is six | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:wp-1-71-58-c0-decide
*expect: turn · turn_ended: True · 12.9s · audio: 724484 b64 bytes*
*note: voice item (talk_through)*

> We are going to work subtraction out loud, one column at a time. I ask, and you tell me what you do. Seventy-one minus fifty-eight. Start in the ones column. Tell me what you do.

### wrong:wp-1-71-58-c0-decide
*expect: turn · turn_ended: True · 16.5s · audio: 976644 b64 bytes*
*note: student says "eight minus one is seven" — smaller-from-larger: the column turned upside down — fluent, arithmetically true, and the wrong move*

> My turn: not eight minus one is seven — one minus eight, I can't take eight from one, so I regroup. One ten becomes ten ones: six tens, eleven ones. Your turn. The ones column. Tell me what you do.

### right:wp-1-71-58-c0-decide
*expect: turn · turn_ended: True · 4.5s · audio: 208680 b64 bytes*
*note: student says "I can't take eight from one, so I regroup: six tens, eleven ones"*

> Yes, regroup: six tens, eleven ones.

### ask:wp-1-71-58-c0-subtract
*expect: turn · turn_ended: True · 3.7s · audio: 106244 b64 bytes*
*note: voice item (talk_through)*

> Now subtract the ones.

### wrong:wp-1-71-58-c0-subtract
*expect: turn · turn_ended: True · 7.9s · audio: 426244 b64 bytes*
*note: student says "seven" — the digits subtracted the wrong way round — a different digit by the plan gate*

> My turn: not seven — eleven minus eight is three. Your turn. Subtract the ones.

### right:wp-1-71-58-c0-subtract
*expect: turn · turn_ended: True · 3.7s · audio: 152964 b64 bytes*
*note: student says "eleven minus eight is three"*

> Yes, eleven minus eight is three.

### ask:wp-1-71-58-c1-decide
*expect: turn · turn_ended: True · 4.1s · audio: 163204 b64 bytes*
*note: voice item (talk_through)*

> Now the tens column. Tell me what you do.

### wrong:wp-1-71-58-c1-decide
*expect: turn · turn_ended: True · 13.0s · audio: 754564 b64 bytes*
*note: student says "seven minus five is two" — forgot-to-decrement: read the crossed-out digit instead of the one written above it*

> My turn: not seven minus five is two — this column lent one, so it is six now, not seven. Six minus five is one. Your turn. The tens column. Tell me what you do.

### right:wp-1-71-58-c1-decide
*expect: turn · turn_ended: True · 7.7s · audio: 411560 b64 bytes*
*note: student says "no regrouping, six minus five is one"*

> Yes, no regrouping: six minus five is one. Seventy-one minus fifty-eight is thirteen.

### ask:wp-2-96-27-c0-decide
*expect: turn · turn_ended: True · 6.2s · audio: 296324 b64 bytes*
*note: voice item (talk_through)*

> Ninety-six minus twenty-seven. Start in the ones column. Tell me what you do.

### wrong:wp-2-96-27-c0-decide
*expect: turn · turn_ended: True · 16.2s · audio: 953604 b64 bytes*
*note: student says "seven minus six is one" — smaller-from-larger: the column turned upside down — fluent, arithmetically true, and the wrong move*

> My turn: not seven minus six is one — six minus seven, I can't take seven from six, so I regroup. One ten becomes ten ones: eight tens, sixteen ones. Your turn. The ones column. Tell me what you do.

### right:wp-2-96-27-c0-decide
*expect: turn · turn_ended: True · 4.5s · audio: 202244 b64 bytes*
*note: student says "I can't take seven from six, so I regroup: eight tens, sixteen ones"*

> Yes, regroup: eight tens, sixteen ones.

### ask:wp-2-96-27-c0-subtract
*expect: turn · turn_ended: True · 3.6s · audio: 115204 b64 bytes*
*note: voice item (talk_through)*

> Now subtract the ones.

### wrong:wp-2-96-27-c0-subtract
*expect: turn · turn_ended: True · 7.9s · audio: 423044 b64 bytes*
*note: student says "one" — the digits subtracted the wrong way round — a different digit by the plan gate*

> My turn: not one — sixteen minus seven is nine. Your turn. Subtract the ones.

### right:wp-2-96-27-c0-subtract
*expect: turn · turn_ended: True · 3.9s · audio: 166404 b64 bytes*
*note: student says "sixteen minus seven is nine"*

> Yes, sixteen minus seven is nine.

### ask:wp-2-96-27-c1-decide
*expect: turn · turn_ended: True · 4.8s · audio: 153604 b64 bytes*
*note: voice item (talk_through)*

> Now the tens column. Tell me what you do.

### wrong:wp-2-96-27-c1-decide
*expect: turn · turn_ended: True · 12.5s · audio: 720004 b64 bytes*
*note: student says "nine minus two is seven" — forgot-to-decrement: read the crossed-out digit instead of the one written above it*

> My turn: not nine minus two is seven — this column lent one, so it is eight now, not nine. Eight minus two is six. Your turn. The tens column. Tell me what you do.

### right:wp-2-96-27-c1-decide
*expect: turn · turn_ended: True · 7.5s · audio: 401320 b64 bytes*
*note: student says "no regrouping, eight minus two is six"*

> Yes, no regrouping: eight minus two is six. Ninety-six minus twenty-seven is sixty-nine.

### ask:wp-3-80-12-c0-decide
*expect: turn · turn_ended: True · 5.5s · audio: 250244 b64 bytes*
*note: voice item (talk_through)*

> Eighty minus twelve. Start in the ones column. Tell me what you do.

### wrong:wp-3-80-12-c0-decide
*expect: turn · turn_ended: True · 15.7s · audio: 926084 b64 bytes*
*note: student says "two minus zero is two" — smaller-from-larger: the column turned upside down — fluent, arithmetically true, and the wrong move*

> My turn: not two minus zero is two — zero minus two, I can't take two from zero, so I regroup. One ten becomes ten ones: seven tens, ten ones. Your turn. The ones column. Tell me what you do.

### right:wp-3-80-12-c0-decide
*expect: turn · turn_ended: True · 4.7s · audio: 220200 b64 bytes*
*note: student says "I can't take two from zero, so I regroup: seven tens, ten ones"*

> Yes, regroup: seven tens, ten ones.

### ask:wp-3-80-12-c0-subtract
*expect: turn · turn_ended: True · 3.9s · audio: 119044 b64 bytes*
*note: voice item (talk_through)*

> Now subtract the ones.

### wrong:wp-3-80-12-c0-subtract
*expect: turn · turn_ended: True · 7.8s · audio: 416004 b64 bytes*
*note: student says "two" — the digits subtracted the wrong way round — a different digit by the plan gate*

> My turn: not two — ten minus two is eight. Your turn. Subtract the ones.

### right:wp-3-80-12-c0-subtract
*expect: turn · turn_ended: True · 3.7s · audio: 154244 b64 bytes*
*note: student says "ten minus two is eight"*

> Yes, ten minus two is eight.

### ask:wp-3-80-12-c1-decide
*expect: turn · turn_ended: True · 4.3s · audio: 170884 b64 bytes*
*note: voice item (talk_through)*

> Now the tens column. Tell me what you do.

### wrong:wp-3-80-12-c1-decide
*expect: turn · turn_ended: True · 13.2s · audio: 767364 b64 bytes*
*note: student says "eight minus one is seven" — forgot-to-decrement: read the crossed-out digit instead of the one written above it*

> My turn: not eight minus one is seven — this column lent one, so it is seven now, not eight. Seven minus one is six. Your turn. The tens column. Tell me what you do.

### right:wp-3-80-12-c1-decide
*expect: turn · turn_ended: True · 7.6s · audio: 401924 b64 bytes*
*note: student says "no regrouping, seven minus one is six"*

> Yes, no regrouping: seven minus one is six. Eighty minus twelve is sixty-eight.

### complete
*expect: turn · turn_ended: True · 6.9s · audio: 358440 b64 bytes*

> That's the end of our subtraction work. You did every column yourself. Great work today!
