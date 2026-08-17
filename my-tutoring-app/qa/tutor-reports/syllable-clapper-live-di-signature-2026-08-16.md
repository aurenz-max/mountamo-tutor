# Tier-3 Live Tutor Report — syllable-clapper — 2026-08-16

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "syllable-clapper", "items": 8, "voice_items": 8, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "K"}`
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
| `c1` | voice/count-parts | one, two, three | ✅✅✅ | two | ✅✅✅ |
| `c2` | voice/count-parts | one, two, three | ✅✅✅ | two | ✅✅✅ |
| `c3` | voice/count-parts | one, two, three | ✅✅✅ | two | ✅✅✅ |
| `c4` | voice/count-parts | one, two, three, four | ✅✅✅ | three | ✅✅✅ |
| `c5` | voice/count-parts | one, two, three, four | ✅✅✅ | three | ✅✅✅ |
| `c6` | voice/count-parts | one, two, three | ✅✅✅ | two | ✅✅✅ |
| `c7` | voice/count-parts | one, two, three, four | ✅✅✅ | three | ✅✅✅ |
| `c8` | voice/count-parts | one, two, three | ✅✅✅ | two | ✅✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 22.2s · audio: 1328644 b64 bytes*
*note: voice item (count-parts)*

> Hi! Words are made of parts, and we can hear them! Watch me first: umbrella. Um … brel … la. That is three parts. Listen: zebra. Again, slowly: zebra. Your turn. Clap the parts with your hands, then tell me how many parts in zebra.

### wrong:c1
*expect: turn · turn_ended: True · 10.2s · audio: 537640 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: zebra. Ze … bra. Two parts. Your turn. How many parts in zebra?

### right:c1
*expect: turn · turn_ended: True · 3.8s · audio: 104360 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c2
*expect: turn · turn_ended: True · 11.7s · audio: 636804 b64 bytes*
*note: voice item (count-parts)*

> Listen: monkey. Again, slowly: monkey. Your turn. Clap the parts with your hands, then tell me how many parts in monkey.

### wrong:c2
*expect: turn · turn_ended: True · 9.5s · audio: 535720 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: monkey. Mon … key. Two parts. Your turn. How many parts in monkey?

### right:c2
*expect: turn · turn_ended: True · 3.2s · audio: 96040 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c3
*expect: turn · turn_ended: True · 11.7s · audio: 636164 b64 bytes*
*note: voice item (count-parts)*

> Listen: penguin. Again, slowly: penguin. Your turn. Clap the parts with your hands, then tell me how many parts in penguin.

### wrong:c3
*expect: turn · turn_ended: True · 9.9s · audio: 537640 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: penguin. Pen … guin. Two parts. Your turn. How many parts in penguin?

### right:c3
*expect: turn · turn_ended: True · 3.2s · audio: 96680 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c4
*expect: turn · turn_ended: True · 11.4s · audio: 632324 b64 bytes*
*note: voice item (count-parts)*

> Listen: gorilla. Again, slowly: gorilla. Your turn. Clap the parts with your hands, then tell me how many parts in gorilla.

### wrong:c4
*expect: turn · turn_ended: True · 11.0s · audio: 622120 b64 bytes*
*note: student says "one, two, three, four" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: gorilla. Go … ril … la. Three parts. Your turn. How many parts in gorilla?

### right:c4
*expect: turn · turn_ended: True · 3.0s · audio: 86440 b64 bytes*
*note: student says "three"*

> Yes, three parts.

### ask:c5
*expect: turn · turn_ended: True · 12.0s · audio: 666884 b64 bytes*
*note: voice item (count-parts)*

> Listen: flamingo. Again, slowly: flamingo. Your turn. Clap the parts with your hands, then tell me how many parts in flamingo.

### wrong:c5
*expect: turn · turn_ended: True · 11.6s · audio: 657960 b64 bytes*
*note: student says "one, two, three, four" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: flamingo. Fla … min … go. Three parts. Your turn. How many parts in flamingo?

### right:c5
*expect: turn · turn_ended: True · 3.5s · audio: 101800 b64 bytes*
*note: student says "three"*

> Yes, three parts.

### ask:c6
*expect: turn · turn_ended: True · 11.5s · audio: 637444 b64 bytes*
*note: voice item (count-parts)*

> Listen: cheetah. Again, slowly: cheetah. Your turn. Clap the parts with your hands, then tell me how many parts in cheetah.

### wrong:c6
*expect: turn · turn_ended: True · 10.1s · audio: 560680 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: cheetah. Chee … tah. Two parts. Your turn. How many parts in cheetah?

### right:c6
*expect: turn · turn_ended: True · 3.2s · audio: 96680 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c7
*expect: turn · turn_ended: True · 12.1s · audio: 679044 b64 bytes*
*note: voice item (count-parts)*

> Listen: kangaroo. Again, slowly: kangaroo. Your turn. Clap the parts with your hands, then tell me how many parts in kangaroo.

### wrong:c7
*expect: turn · turn_ended: True · 11.4s · audio: 647720 b64 bytes*
*note: student says "one, two, three, four" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: kangaroo. Kan … ga … roo. Three parts. Your turn. How many parts in kangaroo?

### right:c7
*expect: turn · turn_ended: True · 3.2s · audio: 101800 b64 bytes*
*note: student says "three"*

> Yes, three parts.

### ask:c8
*expect: turn · turn_ended: True · 12.1s · audio: 664964 b64 bytes*
*note: voice item (count-parts)*

> Listen: tortoise. Again, slowly: tortoise. Your turn. Clap the parts with your hands, then tell me how many parts in tortoise.

### wrong:c8
*expect: turn · turn_ended: True · 10.9s · audio: 592040 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: tortoise. Tor … toise. Two parts. Your turn. How many parts in tortoise?

### right:c8
*expect: turn · turn_ended: True · 3.3s · audio: 99240 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### complete
*expect: turn · turn_ended: True · 7.0s · audio: 361000 b64 bytes*

> What great listening today! Your ears found the parts in every word. See you next time!


## Run 2 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 20.9s · audio: 1231364 b64 bytes*
*note: voice item (count-parts)*

> Hi! Words are made of parts, and we can hear them! Watch me first: umbrella. Um … brel … la. That is three parts. Listen: zebra. Again, slowly: zebra. Your turn. Clap the parts with your hands, then tell me how many parts in zebra.

### wrong:c1
*expect: turn · turn_ended: True · 9.2s · audio: 517124 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: zebra. Ze … bra. Two parts. Your turn. How many parts in zebra?

### right:c1
*expect: turn · turn_ended: True · 3.4s · audio: 118440 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c2
*expect: turn · turn_ended: True · 11.3s · audio: 616964 b64 bytes*
*note: voice item (count-parts)*

> Listen: monkey. Again, slowly: monkey. Your turn. Clap the parts with your hands, then tell me how many parts in monkey.

### wrong:c2
*expect: turn · turn_ended: True · 8.8s · audio: 478084 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: monkey. Mon … key. Two parts. Your turn. How many parts in monkey?

### right:c2
*expect: turn · turn_ended: True · 3.4s · audio: 113924 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c3
*expect: turn · turn_ended: True · 11.7s · audio: 634244 b64 bytes*
*note: voice item (count-parts)*

> Listen: penguin. Again, slowly: penguin. Your turn. Clap the parts with your hands, then tell me how many parts in penguin.

### wrong:c3
*expect: turn · turn_ended: True · 9.5s · audio: 528644 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: penguin. Pen … guin. Two parts. Your turn. How many parts in penguin?

### right:c3
*expect: turn · turn_ended: True · 4.2s · audio: 113284 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c4
*expect: turn · turn_ended: True · 12.0s · audio: 653444 b64 bytes*
*note: voice item (count-parts)*

> Listen: gorilla. Again, slowly: gorilla. Your turn. Clap the parts with your hands, then tell me how many parts in gorilla.

### wrong:c4
*expect: turn · turn_ended: True · 10.1s · audio: 565764 b64 bytes*
*note: student says "one, two, three, four" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: gorilla. Go … ril … la. Three parts. Your turn. How many parts in gorilla?

### right:c4
*expect: turn · turn_ended: True · 3.3s · audio: 112680 b64 bytes*
*note: student says "three"*

> Yes, three parts.

### ask:c5
*expect: turn · turn_ended: True · 11.8s · audio: 654724 b64 bytes*
*note: voice item (count-parts)*

> Listen: flamingo. Again, slowly: flamingo. Your turn. Clap the parts with your hands, then tell me how many parts in flamingo.

### wrong:c5
*expect: turn · turn_ended: True · 10.3s · audio: 576644 b64 bytes*
*note: student says "one, two, three, four" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: flamingo. Fla … min … go. Three parts. Your turn. How many parts in flamingo?

### right:c5
*expect: turn · turn_ended: True · 3.4s · audio: 116484 b64 bytes*
*note: student says "three"*

> Yes, three parts.

### ask:c6
*expect: turn · turn_ended: True · 11.2s · audio: 609320 b64 bytes*
*note: voice item (count-parts)*

> Listen: cheetah. Again, slowly: cheetah. Your turn. Clap the parts with your hands, then tell me how many parts in cheetah.

### wrong:c6
*expect: turn · turn_ended: True · 9.2s · audio: 508164 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: cheetah. Chee … tah. Two parts. Your turn. How many parts in cheetah?

### right:c6
*expect: turn · turn_ended: True · 3.2s · audio: 110724 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c7
*expect: turn · turn_ended: True · 11.9s · audio: 656644 b64 bytes*
*note: voice item (count-parts)*

> Listen: kangaroo. Again, slowly: kangaroo. Your turn. Clap the parts with your hands, then tell me how many parts in kangaroo.

### wrong:c7
*expect: turn · turn_ended: True · 10.7s · audio: 606084 b64 bytes*
*note: student says "one, two, three, four" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: kangaroo. Kan … ga … roo. Three parts. Your turn. How many parts in kangaroo?

### right:c7
*expect: turn · turn_ended: True · 3.8s · audio: 113284 b64 bytes*
*note: student says "three"*

> Yes, three parts.

### ask:c8
*expect: turn · turn_ended: True · 11.5s · audio: 631684 b64 bytes*
*note: voice item (count-parts)*

> Listen: tortoise. Again, slowly: tortoise. Your turn. Clap the parts with your hands, then tell me how many parts in tortoise.

### wrong:c8
*expect: turn · turn_ended: True · 9.9s · audio: 531204 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: tortoise. Tor … toise. Two parts. Your turn. How many parts in tortoise?

### right:c8
*expect: turn · turn_ended: True · 3.2s · audio: 111364 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### complete
*expect: turn · turn_ended: True · 6.8s · audio: 355844 b64 bytes*

> What great listening today! Your ears found the parts in every word. See you next time!


## Run 3 — beat-by-beat transcript

### ask:c1
*expect: turn · turn_ended: True · 23.5s · audio: 1406724 b64 bytes*
*note: voice item (count-parts)*

> Hi! Words are made of parts, and we can hear them! Watch me first: umbrella. Um … brel … la. That is three parts. Listen: zebra. Again, slowly: zebra. Your turn. Clap the parts with your hands, then tell me how many parts in zebra.

### wrong:c1
*expect: turn · turn_ended: True · 9.1s · audio: 486404 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: zebra. Ze … bra. Two parts. Your turn. How many parts in zebra?

### right:c1
*expect: turn · turn_ended: True · 3.2s · audio: 107524 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c2
*expect: turn · turn_ended: True · 11.7s · audio: 634244 b64 bytes*
*note: voice item (count-parts)*

> Listen: monkey. Again, slowly: monkey. Your turn. Clap the parts with your hands, then tell me how many parts in monkey.

### wrong:c2
*expect: turn · turn_ended: True · 10.1s · audio: 538244 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: monkey. Mon … key. Two parts. Your turn. How many parts in monkey?

### right:c2
*expect: turn · turn_ended: True · 3.3s · audio: 112004 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c3
*expect: turn · turn_ended: True · 11.6s · audio: 609284 b64 bytes*
*note: voice item (count-parts)*

> Listen: penguin. Again, slowly: penguin. Your turn. Clap the parts with your hands, then tell me how many parts in penguin.

### wrong:c3
*expect: turn · turn_ended: True · 10.3s · audio: 577284 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: penguin. Pen … guin. Two parts. Your turn. How many parts in penguin?

### right:c3
*expect: turn · turn_ended: True · 3.5s · audio: 103044 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c4
*expect: turn · turn_ended: True · 11.4s · audio: 627204 b64 bytes*
*note: voice item (count-parts)*

> Listen: gorilla. Again, slowly: gorilla. Your turn. Clap the parts with your hands, then tell me how many parts in gorilla.

### wrong:c4
*expect: turn · turn_ended: True · 10.9s · audio: 615684 b64 bytes*
*note: student says "one, two, three, four" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: gorilla. Go … ril … la. Three parts. Your turn. How many parts in gorilla?

### right:c4
*expect: turn · turn_ended: True · 4.0s · audio: 157444 b64 bytes*
*note: student says "three"*

> Yes, three parts.

### ask:c5
*expect: turn · turn_ended: True · 12.6s · audio: 700804 b64 bytes*
*note: voice item (count-parts)*

> Listen: flamingo. Again, slowly: flamingo. Your turn. Clap the parts with your hands, then tell me how many parts in flamingo.

### wrong:c5
*expect: turn · turn_ended: True · 12.0s · audio: 683524 b64 bytes*
*note: student says "one, two, three, four" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: flamingo. Fla … min … go. Three parts. Your turn. How many parts in flamingo?

### right:c5
*expect: turn · turn_ended: True · 4.2s · audio: 171524 b64 bytes*
*note: student says "three"*

> Yes, three parts.

### ask:c6
*expect: turn · turn_ended: True · 11.5s · audio: 637444 b64 bytes*
*note: voice item (count-parts)*

> Listen: cheetah. Again, slowly: cheetah. Your turn. Clap the parts with your hands, then tell me how many parts in cheetah.

### wrong:c6
*expect: turn · turn_ended: True · 9.5s · audio: 534404 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: cheetah. Chee … tah. Two parts. Your turn. How many parts in cheetah?

### right:c6
*expect: turn · turn_ended: True · 3.3s · audio: 104964 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### ask:c7
*expect: turn · turn_ended: True · 12.1s · audio: 670084 b64 bytes*
*note: voice item (count-parts)*

> Listen: kangaroo. Again, slowly: kangaroo. Your turn. Clap the parts with your hands, then tell me how many parts in kangaroo.

### wrong:c7
*expect: turn · turn_ended: True · 12.0s · audio: 686084 b64 bytes*
*note: student says "one, two, three, four" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: kangaroo. Kan … ga … roo. Three parts. Your turn. How many parts in kangaroo?

### right:c7
*expect: turn · turn_ended: True · 3.7s · audio: 157444 b64 bytes*
*note: student says "three"*

> Yes, three parts.

### ask:c8
*expect: turn · turn_ended: True · 11.7s · audio: 640004 b64 bytes*
*note: voice item (count-parts)*

> Listen: tortoise. Again, slowly: tortoise. Your turn. Clap the parts with your hands, then tell me how many parts in tortoise.

### wrong:c8
*expect: turn · turn_ended: True · 10.2s · audio: 566404 b64 bytes*
*note: student says "one, two, three" — a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" clause opens, and over-counting is this primitive's documented commonest error*

> My turn: tortoise. Tor … toise. Two parts. Your turn. How many parts in tortoise?

### right:c8
*expect: turn · turn_ended: True · 3.9s · audio: 167044 b64 bytes*
*note: student says "two"*

> Yes, two parts.

### complete
*expect: turn · turn_ended: True · 7.1s · audio: 357764 b64 bytes*

> What great listening today! Your ears found the parts in every word. See you next time!
