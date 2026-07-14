# Tier-3 Live Tutor Report — word-sorter — 2026-07-14

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"gradeLevel": "K", "challenges": 3, "challenge0": "Sort these into Animals and Things We Do!", "buckets0": ["Animals", "Actions"], "stagedWord": "pig", "challenge1": "Sort these into Foods and Animals!"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — 0 HIGH + 0 WARN confirmed, 4 single-run note(s).

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 5.0 | 27.2 | 0.33 | 0.13 | 0.0 |

## Findings

| Status | Severity | Check | Beat | Rate | Example |
|---|---|---|---|---|---|
| note | HIGH | `tag-syntax-spoken` | greeting | 1/3 | tutor read system-message syntax aloud: "Hey there, I'm so excited to learn with you today! Let's sort these animals and actions – is it an animal, or something an animal does? Our buckets are 'Animals" |
| note | HIGH | `tag-syntax-spoken` | activity_start | 1/3 | tutor read system-message syntax aloud: "We're going to sort these into Animals and Things We Do! Our buckets are 'Animals' and 'Actions'. Is it an animal, or something an animal does?

[PRONOUNCE] pig" |
| note | HIGH | `tag-syntax-spoken` | word_staged | 1/3 | tutor read system-message syntax aloud: "[PRONOUNCE] pig" |
| note | HIGH | `tag-syntax-spoken` | next_item | 1/3 | tutor read system-message syntax aloud: "Great job working so hard! Now we're going to sort these into Foods and Animals! Our buckets are 'Foods' and 'Animals'. Is it something you can eat, or somethin" |

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 13.2s · audio: 792964 b64 bytes*
*note: server auto-queues the greeting on auth (lesson greeting + one-sentence cap in --lesson)*

> Hey friend! I'm so glad you're here to learn with me.

We're going to sort things into "Animals" and "Things We Do!" Is it an animal, or something an animal does? Let's start with this one.

pig

### activity_start
*expect: turn · turn_ended: True · 12.3s · audio: 725160 b64 bytes*
*note: ORIENT/DISAMBIGUATE: the tutor must name every bucket and ask the sorting question — a bare 'let's sort words!' greeting strands a non-reader*

> Let's sort things into "Animals" and "Things We Do!" Our buckets are Animals and Actions. Is it an animal, or something an animal does? You're holding... pig!

### word_staged
*expect: turn · turn_ended: True · 2.3s · audio: 46084 b64 bytes*
*note: STIMULUS: the staged word must be SAID (the child cannot read the card); its correct bucket must not be asserted*

> pig

### wrong_bucket
*expect: turn · turn_ended: True · 7.9s · audio: 459524 b64 bytes*
*note: RECOVER: eyes-free hint without asserting the correct bucket*

> Say pig out loud with me. Now, think about what a pig is... is it an animal, or something you can do?

### next_item
*expect: turn · turn_ended: True · 13.2s · audio: 807080 b64 bytes*
*note: ORIENT on advance: the next challenge's buckets + question must be enacted too*

> Look, we did it! Now let's sort things into "Foods" and "Animals!" Our buckets are Foods and Animals. Is it something you eat, or is it an animal? You're holding... cow!


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 17.4s · audio: 1057284 b64 bytes*
*note: server auto-queues the greeting on auth (lesson greeting + one-sentence cap in --lesson)*

> Hey friend! I'm so glad you're here to play with animals and actions with me today. Let's get started on our first challenge! We're going to sort these words into 'Animals' and 'Things We Do!' What kind of word is 'pig'? Is it an animal, or something an animal does?

### activity_start
*expect: turn · turn_ended: True · 10.8s · audio: 652164 b64 bytes*
*note: ORIENT/DISAMBIGUATE: the tutor must name every bucket and ask the sorting question — a bare 'let's sort words!' greeting strands a non-reader*

> Let's sort these words into 'Animals' and 'Things We Do!' Our two buckets are 'Animals' and 'Actions'. Is a word like "pig" an animal, or something a person does?

### word_staged
*expect: turn · turn_ended: True · 2.4s · audio: 49284 b64 bytes*
*note: STIMULUS: the staged word must be SAID (the child cannot read the card); its correct bucket must not be asserted*

> pig

### wrong_bucket
*expect: turn · turn_ended: True · 12.4s · audio: 752040 b64 bytes*
*note: RECOVER: eyes-free hint without asserting the correct bucket*

> Hmm, let's think about it a little bit. When you think of a pig, is that something that lives on a farm, or is it something that you do, like running or jumping? Which bucket makes more sense?

### next_item
*expect: turn · turn_ended: True · 14.2s · audio: 869160 b64 bytes*
*note: ORIENT on advance: the next challenge's buckets + question must be enacted too*

> Look at that, you're moving on up! Now we need to sort these ones into 'Foods' and 'Animals'. Our new buckets are 'Foods' and 'Animals'. Is a word like "pizza" something you can eat, or is it a creature?


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 13.1s · audio: 775684 b64 bytes*
*note: server auto-queues the greeting on auth (lesson greeting + one-sentence cap in --lesson)*

> Hey there, I'm so excited to learn with you today! Let's sort these animals and actions – is it an animal, or something an animal does? Our buckets are 'Animals' and 'Actions'.

[PRONOUNCE] pig

### activity_start
*expect: turn · turn_ended: True · 10.6s · audio: 637444 b64 bytes*
*note: ORIENT/DISAMBIGUATE: the tutor must name every bucket and ask the sorting question — a bare 'let's sort words!' greeting strands a non-reader*

> We're going to sort these into Animals and Things We Do! Our buckets are 'Animals' and 'Actions'. Is it an animal, or something an animal does?

[PRONOUNCE] pig

### word_staged
*expect: turn · turn_ended: True · 2.4s · audio: 48004 b64 bytes*
*note: STIMULUS: the staged word must be SAID (the child cannot read the card); its correct bucket must not be asserted*

> [PRONOUNCE] pig

### wrong_bucket
*expect: turn · turn_ended: True · 12.3s · audio: 748200 b64 bytes*
*note: RECOVER: eyes-free hint without asserting the correct bucket*

> Wait a second! Let's listen to that word again. Pig — say it with me. Is 'pig' something you see at a zoo, or something that changes where you are? Tap the bucket you think!

### next_item
*expect: turn · turn_ended: True · 12.6s · audio: 769320 b64 bytes*
*note: ORIENT on advance: the next challenge's buckets + question must be enacted too*

> Great job working so hard! Now we're going to sort these into Foods and Animals! Our buckets are 'Foods' and 'Animals'. Is it something you can eat, or something that is alive?

[PRONOUNCE] cow
