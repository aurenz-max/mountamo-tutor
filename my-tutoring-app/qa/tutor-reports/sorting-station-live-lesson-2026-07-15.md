# Tier-3 Live Tutor Report — sorting-station — 2026-07-15

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"gradeBand": "K", "challenges": 4, "challenge0": "Can you help sort these items into things we need to survive and things we just want for fun?", "bins0": ["Need", "Want"], "challenge1": "Let's sort these items again! Which ones are needs and which ones are wants?", "bins1": ["Need", "Want"]}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — 0 HIGH + 0 WARN confirmed, 1 single-run note(s).

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 3.0 | 46.2 | 0.0 | 0.33 | 0.0 |

## Findings

| Status | Severity | Check | Beat | Rate | Example |
|---|---|---|---|---|---|
| note | WARN | `question-stacking` | * | 1/3 | 3/3 turns ask 2+ questions in one breath |

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 16.7s · audio: 1011240 b64 bytes*
*note: server auto-queues the lesson greeting on auth (one-sentence cap in --lesson)*

> Hey there! I'm so excited to learn with you today. We're going to play a game sorting things into things we need to stay healthy and safe, and things we want for fun! We have a 'Need' bin and a 'Want' bin. Is this something we NEED, or just WANT? Tap the bin it goes in.

### activity_start
*expect: turn · turn_ended: True · 10.3s · audio: 620804 b64 bytes*
*note: ORIENT/DISAMBIGUATE: the tutor must name every bin and ask the sorting question — a bare 'let's sort!' greeting strands a non-reader who cannot read the rule or the bin labels*

> Look at all these things! Let's sort them together. We have a 'Need' bin and a 'Want' bin. Is this something we NEED, or just WANT? Tap the bin it goes in.

### next_item
*expect: turn · turn_ended: True · 9.4s · audio: 548484 b64 bytes*
*note: ORIENT on advance: the next challenge's bins + question must be enacted too*

> Alright, let's sort these items again! We still have a 'Need' bin and a 'Want' bin. Is this something we NEED, or just WANT? Tap the bin it goes in.


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 14.8s · audio: 890884 b64 bytes*
*note: server auto-queues the lesson greeting on auth (one-sentence cap in --lesson)*

> Welcome to the sorting station! I'm here to help you sort these items into things we need to survive and things we just want for fun. We have a "need" bin and a "want" bin. Is this something we NEED, or something we WANT? Tap the bin it goes in.

### activity_start
*expect: turn · turn_ended: True · 15.3s · audio: 915204 b64 bytes*
*note: ORIENT/DISAMBIGUATE: the tutor must name every bin and ask the sorting question — a bare 'let's sort!' greeting strands a non-reader who cannot read the rule or the bin labels*

> Look at all these things! Let's sort them together. We need to put them into things we need to survive and things we just want for fun. We have a "need" bin and a "want" bin. Is this something we NEED, or something we WANT? Tap the bin it goes in.

### next_item
*expect: turn · turn_ended: True · 12.7s · audio: 756484 b64 bytes*
*note: ORIENT on advance: the next challenge's bins + question must be enacted too*

> Let's sort these items again! We need to figure out which ones are needs and which ones are wants. We have a "need" bin and a "want" bin. Is this something we NEED, or something we WANT? Tap the bin it goes in.


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 19.8s · audio: 1214084 b64 bytes*
*note: server auto-queues the lesson greeting on auth (one-sentence cap in --lesson)*

> Hi there! I'm so excited to sort these objects with you today!

Can you help me sort these items into things we need to survive and things we just want for fun?

We have a bin for **Needs** and a bin for **Wants**.

Is this something we NEED, or something we WANT? Tap the bin it goes in.

### activity_start
*expect: turn · turn_ended: True · 18.0s · audio: 1105284 b64 bytes*
*note: ORIENT/DISAMBIGUATE: the tutor must name every bin and ask the sorting question — a bare 'let's sort!' greeting strands a non-reader who cannot read the rule or the bin labels*

> Look at all these things! Let's sort them together.

Can you help me sort these items into things we need to survive and things we just want for fun?

We have a bin for **Needs** and a bin for **Wants**.

Is this something we NEED, or something we WANT? Tap the bin it goes in.

### next_item
*expect: turn · turn_ended: True · 13.9s · audio: 852520 b64 bytes*
*note: ORIENT on advance: the next challenge's bins + question must be enacted too*

> Let's sort these items again!

Which ones are needs and which ones are wants?

Remember, we have a bin for **Needs** and a bin for **Wants**.

Is this something we NEED, or something we WANT? Tap the bin it goes in.
