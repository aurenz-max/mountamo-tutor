# Tier-3 Live Tutor Report — phonics-blender — 2026-07-15

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"gradeLevel": "K", "patternType": "cvc", "words": 4, "word0": "cat", "phonemes0": "/k/ + /\u00e6/ + /t/", "word1": "dog", "phonemes1": "/d/ + /o/ + /g/"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — no findings.

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 4.0 | 25.23 | 0.0 | 0.0 | 0.08 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 11.8s · audio: 681604 b64 bytes*
*note: lesson mode: server greeting / [PRIMITIVE SWITCH] — one-sentence cap applies*

> Hi there! I'm Lumina, and I'm so excited to learn with you today! Let's start by listening to some sounds and making them into words. Tap each little sound to hear it!

### activity_start
*expect: turn · turn_ended: True · 12.6s · audio: 718120 b64 bytes*
*note: ORIENT+STIMULUS: the PRE-READER HOW-TO-PLAY directive must voice a play action (tap/listen/say — the protocol a non-reader can't read) and name the first word; must survive the lesson one-sentence cap*

> We're going to practice listening to sounds and turning them into words! First up, let's listen to the sounds in cat: /k/ /æ/ /t/. Tap each little sound to hear it!

### phase_to_build
*expect: turn · turn_ended: True · 5.1s · audio: 231044 b64 bytes*
*note: ORIENT on the build step: the tutor must tell the child to put the sounds in order — the Build/Check chrome is hidden at K, so the instruction must be spoken*

> Now, put the sound tiles in the right order to build the word cat.

### next_word
*expect: turn · turn_ended: True · 9.6s · audio: 528004 b64 bytes*
*note: ORIENT on advance: the next word + a tap/listen action must be enacted too*

> Great job building cat! Next, let's listen to the sounds in dog: /d/ /o/ /g/. Tap each one to hear!


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 10.0s · audio: 583044 b64 bytes*
*note: lesson mode: server greeting / [PRIMITIVE SWITCH] — one-sentence cap applies*

> Hey there! I'm so excited to practice sounds with you today! We're going to have fun blending words together. Let's tap these sounds to hear our first word!

### activity_start
*expect: turn · turn_ended: True · 11.2s · audio: 664324 b64 bytes*
*note: ORIENT+STIMULUS: the PRE-READER HOW-TO-PLAY directive must voice a play action (tap/listen/say — the protocol a non-reader can't read) and name the first word; must survive the lesson one-sentence cap*

> We're going to practice listening to sounds and blending them into words. Tap each little sound to hear them, then put them in order to build the word "cat"! Let's hear the sounds for "cat" first.

### phase_to_build
*expect: turn · turn_ended: True · 4.9s · audio: 231080 b64 bytes*
*note: ORIENT on the build step: the tutor must tell the child to put the sounds in order — the Build/Check chrome is hidden at K, so the instruction must be spoken*

> Now put the sound tiles in the right order to build the word "cat"!

### next_word
*expect: turn · turn_ended: True · 8.0s · audio: 442244 b64 bytes*
*note: ORIENT on advance: the next word + a tap/listen action must be enacted too*

> You built the word "cat"! Now let's listen to the sounds for a new word, "dog". Tap the tiles to hear them!


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 11.3s · audio: 663044 b64 bytes*
*note: lesson mode: server greeting / [PRIMITIVE SWITCH] — one-sentence cap applies*

> Hey there, friend! I'm so glad you're here to learn with me today. We're going to practice some blending fun, starting with some animal words. Tap on each tile to hear the sound and get ready to build it!

### activity_start
*expect: turn · turn_ended: True · 10.2s · audio: 599044 b64 bytes*
*note: ORIENT+STIMULUS: the PRE-READER HOW-TO-PLAY directive must voice a play action (tap/listen/say — the protocol a non-reader can't read) and name the first word; must survive the lesson one-sentence cap*

> I'm so excited to do phonics with you! We're going to listen to sounds and blend them into words. Tap on each sound to hear it, then put them in order to build the word "cat"!

### phase_to_build
*expect: turn · turn_ended: True · 5.1s · audio: 227204 b64 bytes*
*note: ORIENT on the build step: the tutor must tell the child to put the sounds in order — the Build/Check chrome is hidden at K, so the instruction must be spoken*

> Now put those sound tiles in the right order to build the word "cat"!

### next_word
*expect: turn · turn_ended: True · 6.5s · audio: 331560 b64 bytes*
*note: ORIENT on advance: the next word + a tap/listen action must be enacted too*

> Awesome job with "cat"! Now let's see if we can figure out "dog" by tapping those sounds.
