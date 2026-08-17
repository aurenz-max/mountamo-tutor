# Tier-3 Live Tutor Report — word-sorter — 2026-08-16

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "di-judged-loop", "component": "word-sorter", "items": 12, "voice_items": 12, "gesture_items": 0, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "signature", "cap_drill": false, "capped_item": null, "grade": "Grade 3"}`
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
| `match_pairs-0::p4` | voice/match_pairs | fast | ✅✅ | slow | ✅✅ |
| `match_pairs-0::p0` | voice/match_pairs | hot | ✅✅ | cold | ✅✅ |
| `match_pairs-0::p3` | voice/match_pairs | wet | ✅✅ | dry | ✅✅ |
| `match_pairs-0::p2` | voice/match_pairs | hard | ✅✅ | soft | ✅✅ |
| `match_pairs-0::p1` | voice/match_pairs | solid | ✅✅ | liquid | ✅✅ |
| `match_pairs-1::p3` | voice/match_pairs | frost | ✅✅ | lost | ✅✅ |
| `match_pairs-1::p4` | voice/match_pairs | pool | ✅✅ | cool | ✅✅ |
| `match_pairs-1::p0` | voice/match_pairs | ice | ✅✅ | nice | ✅✅ |
| `match_pairs-1::p1` | voice/match_pairs | melt | ✅✅ | felt | ✅✅ |
| `match_pairs-1::p2` | voice/match_pairs | steam | ✅✅ | beam | ✅✅ |
| `match_pairs-2::p1` | voice/match_pairs | steam | ✅✅ | vapor | ✅✅ |
| `match_pairs-2::p3` | voice/match_pairs | puddle | ✅✅ | pool | ✅✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:match_pairs-0::p4
*expect: turn · turn_ended: True · 17.4s · audio: 1022724 b64 bytes*
*note: voice item (match_pairs)*

> Hi! Let us play a sorting game! I say a word — you find the one on the screen that fits it, and you say that one out loud. Two words can belong together because of what they mean. Your turn. Listen: fast. Which word means the opposite of fast?

### wrong:match_pairs-0::p4
*expect: turn · turn_ended: True · 9.5s · audio: 535684 b64 bytes*
*note: student says "fast" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: fast and slow are opposites. Your turn. Listen: fast. Which word means the opposite of fast?

### right:match_pairs-0::p4
*expect: turn · turn_ended: True · 4.3s · audio: 174724 b64 bytes*
*note: student says "slow"*

> Yes, the opposite of fast is slow.

### ask:match_pairs-0::p0
*expect: turn · turn_ended: True · 6.6s · audio: 316804 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: hot. Which word means the opposite of hot?

### wrong:match_pairs-0::p0
*expect: turn · turn_ended: True · 9.0s · audio: 499844 b64 bytes*
*note: student says "hot" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: hot and cold are opposites. Your turn. Listen: hot. Which word means the opposite of hot?

### right:match_pairs-0::p0
*expect: turn · turn_ended: True · 3.8s · audio: 165124 b64 bytes*
*note: student says "cold"*

> Yes, the opposite of hot is cold.

### ask:match_pairs-0::p3
*expect: turn · turn_ended: True · 6.6s · audio: 329604 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: wet. Which word means the opposite of wet?

### wrong:match_pairs-0::p3
*expect: turn · turn_ended: True · 9.0s · audio: 503684 b64 bytes*
*note: student says "wet" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: wet and dry are opposites. Your turn. Listen: wet. Which word means the opposite of wet?

### right:match_pairs-0::p3
*expect: turn · turn_ended: True · 3.8s · audio: 164484 b64 bytes*
*note: student says "dry"*

> Yes, the opposite of wet is dry.

### ask:match_pairs-0::p2
*expect: turn · turn_ended: True · 6.6s · audio: 334084 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: hard. Which word means the opposite of hard?

### wrong:match_pairs-0::p2
*expect: turn · turn_ended: True · 9.2s · audio: 508164 b64 bytes*
*note: student says "hard" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: hard and soft are opposites. Your turn. Listen: hard. Which word means the opposite of hard?

### right:match_pairs-0::p2
*expect: turn · turn_ended: True · 4.8s · audio: 186920 b64 bytes*
*note: student says "soft"*

> Yes, the opposite of hard is soft.

### ask:match_pairs-0::p1
*expect: turn · turn_ended: True · 7.2s · audio: 339844 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: solid. Which word means the opposite of solid?

### wrong:match_pairs-0::p1
*expect: turn · turn_ended: True · 9.6s · audio: 536964 b64 bytes*
*note: student says "solid" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: solid and liquid are opposites. Your turn. Listen: solid. Which word means the opposite of solid?

### right:match_pairs-0::p1
*expect: turn · turn_ended: True · 4.3s · audio: 170244 b64 bytes*
*note: student says "liquid"*

> Yes, the opposite of solid is liquid.

### ask:match_pairs-1::p3
*expect: turn · turn_ended: True · 6.3s · audio: 310404 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: frost. Which word rhymes with frost?

### wrong:match_pairs-1::p3
*expect: turn · turn_ended: True · 8.5s · audio: 472324 b64 bytes*
*note: student says "frost" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: frost and lost rhyme. Your turn. Listen: frost. Which word rhymes with frost?

### right:match_pairs-1::p3
*expect: turn · turn_ended: True · 3.9s · audio: 151684 b64 bytes*
*note: student says "lost"*

> Yes, frost and lost rhyme.

### ask:match_pairs-1::p4
*expect: turn · turn_ended: True · 6.2s · audio: 301444 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: pool. Which word rhymes with pool?

### wrong:match_pairs-1::p4
*expect: turn · turn_ended: True · 8.5s · audio: 469764 b64 bytes*
*note: student says "pool" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: pool and cool rhyme. Your turn. Listen: pool. Which word rhymes with pool?

### right:match_pairs-1::p4
*expect: turn · turn_ended: True · 3.8s · audio: 153640 b64 bytes*
*note: student says "cool"*

> Yes, pool and cool rhyme.

### ask:match_pairs-1::p0
*expect: turn · turn_ended: True · 6.7s · audio: 299524 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: ice. Which word rhymes with ice?

### wrong:match_pairs-1::p0
*expect: turn · turn_ended: True · 8.7s · audio: 478084 b64 bytes*
*note: student says "ice" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: ice and nice rhyme. Your turn. Listen: ice. Which word rhymes with ice?

### right:match_pairs-1::p0
*expect: turn · turn_ended: True · 3.6s · audio: 140804 b64 bytes*
*note: student says "nice"*

> Yes, ice and nice rhyme.

### ask:match_pairs-1::p1
*expect: turn · turn_ended: True · 6.4s · audio: 308484 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: melt. Which word rhymes with melt?

### wrong:match_pairs-1::p1
*expect: turn · turn_ended: True · 8.8s · audio: 486404 b64 bytes*
*note: student says "melt" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: melt and felt rhyme. Your turn. Listen: melt. Which word rhymes with melt?

### right:match_pairs-1::p1
*expect: turn · turn_ended: True · 4.1s · audio: 140804 b64 bytes*
*note: student says "felt"*

> Yes, melt and felt rhyme.

### ask:match_pairs-1::p2
*expect: turn · turn_ended: True · 6.6s · audio: 311044 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: steam. Which word rhymes with steam?

### wrong:match_pairs-1::p2
*expect: turn · turn_ended: True · 8.7s · audio: 481284 b64 bytes*
*note: student says "steam" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: steam and beam rhyme. Your turn. Listen: steam. Which word rhymes with steam?

### right:match_pairs-1::p2
*expect: turn · turn_ended: True · 3.7s · audio: 161320 b64 bytes*
*note: student says "beam"*

> Yes, steam and beam rhyme.

### ask:match_pairs-2::p1
*expect: turn · turn_ended: True · 6.9s · audio: 336644 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: steam. Which word means the same as steam?

### wrong:match_pairs-2::p1
*expect: turn · turn_ended: True · 9.8s · audio: 547844 b64 bytes*
*note: student says "steam" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: steam and vapor mean the same thing. Your turn. Listen: steam. Which word means the same as steam?

### right:match_pairs-2::p1
*expect: turn · turn_ended: True · 4.2s · audio: 174084 b64 bytes*
*note: student says "vapor"*

> Yes, steam and vapor mean the same thing.

### ask:match_pairs-2::p3
*expect: turn · turn_ended: True · 6.5s · audio: 316804 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: puddle. Which word means the same as puddle?

### wrong:match_pairs-2::p3
*expect: turn · turn_ended: True · 9.5s · audio: 525444 b64 bytes*
*note: student says "puddle" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: puddle and pool mean the same thing. Your turn. Listen: puddle. Which word means the same as puddle?

### right:match_pairs-2::p3
*expect: turn · turn_ended: True · 4.0s · audio: 175364 b64 bytes*
*note: student says "pool"*

> Yes, puddle and pool mean the same thing.

### complete
*expect: turn · turn_ended: True · 6.0s · audio: 288644 b64 bytes*

> Great sorting today! You told me every one out loud. See you next time!


## Run 2 — beat-by-beat transcript

### ask:match_pairs-0::p4
*expect: turn · turn_ended: True · 17.4s · audio: 1022084 b64 bytes*
*note: voice item (match_pairs)*

> Hi! Let us play a sorting game! I say a word — you find the one on the screen that fits it, and you say that one out loud. Two words can belong together because of what they mean. Your turn. Listen: fast. Which word means the opposite of fast?

### wrong:match_pairs-0::p4
*expect: turn · turn_ended: True · 9.4s · audio: 532484 b64 bytes*
*note: student says "fast" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: fast and slow are opposites. Your turn. Listen: fast. Which word means the opposite of fast?

### right:match_pairs-0::p4
*expect: turn · turn_ended: True · 4.1s · audio: 174724 b64 bytes*
*note: student says "slow"*

> Yes, the opposite of fast is slow.

### ask:match_pairs-0::p0
*expect: turn · turn_ended: True · 6.6s · audio: 325764 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: hot. Which word means the opposite of hot?

### wrong:match_pairs-0::p0
*expect: turn · turn_ended: True · 8.8s · audio: 486404 b64 bytes*
*note: student says "hot" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: hot and cold are opposites. Your turn. Listen: hot. Which word means the opposite of hot?

### right:match_pairs-0::p0
*expect: turn · turn_ended: True · 3.7s · audio: 162564 b64 bytes*
*note: student says "cold"*

> Yes, the opposite of hot is cold.

### ask:match_pairs-0::p3
*expect: turn · turn_ended: True · 6.7s · audio: 330244 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: wet. Which word means the opposite of wet?

### wrong:match_pairs-0::p3
*expect: turn · turn_ended: True · 9.0s · audio: 496644 b64 bytes*
*note: student says "wet" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: wet and dry are opposites. Your turn. Listen: wet. Which word means the opposite of wet?

### right:match_pairs-0::p3
*expect: turn · turn_ended: True · 3.8s · audio: 153604 b64 bytes*
*note: student says "dry"*

> Yes, the opposite of wet is dry.

### ask:match_pairs-0::p2
*expect: turn · turn_ended: True · 7.3s · audio: 333480 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: hard. Which word means the opposite of hard?

### wrong:match_pairs-0::p2
*expect: turn · turn_ended: True · 9.4s · audio: 513284 b64 bytes*
*note: student says "hard" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: hard and soft are opposites. Your turn. Listen: hard. Which word means the opposite of hard?

### right:match_pairs-0::p2
*expect: turn · turn_ended: True · 3.7s · audio: 161284 b64 bytes*
*note: student says "soft"*

> Yes, the opposite of hard is soft.

### ask:match_pairs-0::p1
*expect: turn · turn_ended: True · 6.9s · audio: 345604 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: solid. Which word means the opposite of solid?

### wrong:match_pairs-0::p1
*expect: turn · turn_ended: True · 9.5s · audio: 522244 b64 bytes*
*note: student says "solid" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: solid and liquid are opposites. Your turn. Listen: solid. Which word means the opposite of solid?

### right:match_pairs-0::p1
*expect: turn · turn_ended: True · 4.2s · audio: 173444 b64 bytes*
*note: student says "liquid"*

> Yes, the opposite of solid is liquid.

### ask:match_pairs-1::p3
*expect: turn · turn_ended: True · 6.5s · audio: 321924 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: frost. Which word rhymes with frost?

### wrong:match_pairs-1::p3
*expect: turn · turn_ended: True · 8.7s · audio: 476164 b64 bytes*
*note: student says "frost" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: frost and lost rhyme. Your turn. Listen: frost. Which word rhymes with frost?

### right:match_pairs-1::p3
*expect: turn · turn_ended: True · 3.4s · audio: 140164 b64 bytes*
*note: student says "lost"*

> Yes, frost and lost rhyme.

### ask:match_pairs-1::p4
*expect: turn · turn_ended: True · 6.3s · audio: 302724 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: pool. Which word rhymes with pool?

### wrong:match_pairs-1::p4
*expect: turn · turn_ended: True · 8.4s · audio: 457604 b64 bytes*
*note: student says "pool" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: pool and cool rhyme. Your turn. Listen: pool. Which word rhymes with pool?

### right:match_pairs-1::p4
*expect: turn · turn_ended: True · 3.4s · audio: 136324 b64 bytes*
*note: student says "cool"*

> Yes, pool and cool rhyme.

### ask:match_pairs-1::p0
*expect: turn · turn_ended: True · 6.5s · audio: 318724 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: ice. Which word rhymes with ice?

### wrong:match_pairs-1::p0
*expect: turn · turn_ended: True · 8.5s · audio: 468484 b64 bytes*
*note: student says "ice" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: ice and nice rhyme. Your turn. Listen: ice. Which word rhymes with ice?

### right:match_pairs-1::p0
*expect: turn · turn_ended: True · 3.4s · audio: 134440 b64 bytes*
*note: student says "nice"*

> Yes, ice and nice rhyme.

### ask:match_pairs-1::p1
*expect: turn · turn_ended: True · 6.7s · audio: 316164 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: melt. Which word rhymes with melt?

### wrong:match_pairs-1::p1
*expect: turn · turn_ended: True · 8.9s · audio: 479364 b64 bytes*
*note: student says "melt" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: melt and felt rhyme. Your turn. Listen: melt. Which word rhymes with melt?

### right:match_pairs-1::p1
*expect: turn · turn_ended: True · 3.5s · audio: 132484 b64 bytes*
*note: student says "felt"*

> Yes, melt and felt rhyme.

### ask:match_pairs-1::p2
*expect: turn · turn_ended: True · 6.6s · audio: 322564 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: steam. Which word rhymes with steam?

### wrong:match_pairs-1::p2
*expect: turn · turn_ended: True · 8.9s · audio: 490244 b64 bytes*
*note: student says "steam" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: steam and beam rhyme. Your turn. Listen: steam. Which word rhymes with steam?

### right:match_pairs-1::p2
*expect: turn · turn_ended: True · 4.8s · audio: 159364 b64 bytes*
*note: student says "beam"*

> Yes, steam and beam rhyme.

### ask:match_pairs-2::p1
*expect: turn · turn_ended: True · 7.0s · audio: 344964 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: steam. Which word means the same as steam?

### wrong:match_pairs-2::p1
*expect: turn · turn_ended: True · 9.6s · audio: 542084 b64 bytes*
*note: student says "steam" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: steam and vapor mean the same thing. Your turn. Listen: steam. Which word means the same as steam?

### right:match_pairs-2::p1
*expect: turn · turn_ended: True · 4.5s · audio: 204840 b64 bytes*
*note: student says "vapor"*

> Yes, steam and vapor mean the same thing.

### ask:match_pairs-2::p3
*expect: turn · turn_ended: True · 6.7s · audio: 327684 b64 bytes*
*note: voice item (match_pairs)*

> Your turn. Listen: puddle. Which word means the same as puddle?

### wrong:match_pairs-2::p3
*expect: turn · turn_ended: True · 10.2s · audio: 576008 b64 bytes*
*note: student says "puddle" — the stimulus word said straight back — it is a real word, said confidently, that the tutor itself spoke two seconds earlier, so a judge listening for "something relevant to this item" affirms it. The contract names this miss by name*

> My turn: puddle and pool mean the same thing. Your turn. Listen: puddle. Which word means the same as puddle?

### right:match_pairs-2::p3
*expect: turn · turn_ended: True · 4.0s · audio: 180484 b64 bytes*
*note: student says "pool"*

> Yes, puddle and pool mean the same thing.

### complete
*expect: turn · turn_ended: True · 5.9s · audio: 296324 b64 bytes*

> Great sorting today! You told me every one out loud. See you next time!
