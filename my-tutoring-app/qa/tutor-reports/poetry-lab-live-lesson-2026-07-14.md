# Tier-3 Live Tutor Report — poetry-lab — 2026-07-14

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"mode": "rhyme_hunt", "rounds": 4, "round0": ["The small brown dog", "Sat on the mat", "It looks for food", "Inside a big hat"], "round1": ["Go look for bugs", "Under the red sun", "We play all day", "Having lots of fun"]}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — both lesson-mode runs read each poem, recovered without naming the
answer pair, celebrated briefly, and produced no real HIGH/WARN finding.

Post-run harness correction: Gemini transcription inserted Markdown emphasis
inside stretched words (`do**g**`, `foo**d**`). The stimulus normalizer replaced
the asterisks with spaces and falsely concluded that `dog`/`food` were absent,
even though both transcripts plainly contain them. `_norm` now strips inline
Markdown before word matching; this is a harness false-positive fix, not a tutor
behavior waiver.

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 6.0 | 23.1 | 0.09 | 0.0 | 0.0 |

## Findings

None after correcting the Markdown-normalization false positive.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 19.7s · audio: 1197444 b64 bytes*

> Hello! I'm so happy you're here! We're going to listen to a little poem and find the two words that rhyme.

The small brown dog
Sat on the mat
It looks for food
Inside a big hat.

Rhyming words sound the same at the end, like cat and hat. Tap the two words that rhyme.

### activity_start
*expect: turn · turn_ended: True · 13.7s · audio: 823080 b64 bytes*
*note: ORIENT+STIMULUS: frame once and read every line ending aloud*

> We're going to listen to a little poem and find the two words that rhyme.

The small brown dog
Sat on the mat
It looks for food
Inside a big hat.

Tap the two words that rhyme.

### rhyme_miss
*expect: turn · turn_ended: True · 8.6s · audio: 474884 b64 bytes*
*note: RECOVER: stretch only the tapped words; do not disclose the pair*

> Listen closely as we stretch those words.

Do doooog and foooood sound the same at the end?

### round_start
*expect: turn · turn_ended: True · 9.3s · audio: 517124 b64 bytes*
*note: STIMULUS on advance: read the next poem, one tutor turn*

> Go look for bugs
Under the red sun
We play all day
Having lots of fun.

Tap the two words that rhyme.

### rhyme_correct
*expect: turn · turn_ended: True · 3.3s · audio: 172804 b64 bytes*
*note: quiet celebration without repeating the answer pair*

> You listened so carefully and found them!

### activity_complete
*expect: turn · turn_ended: True · 4.0s · audio: 191364 b64 bytes*
*note: one-sentence closing celebration*

> You did it, you found all the rhyming words!


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 11.6s · audio: 686120 b64 bytes*

> Hello there! I'm so excited to learn with you today. We're going to listen to a little poem and find the two words that rhyme. Tap the two words that sound the same at the end.

### activity_start
*expect: turn · turn_ended: True · 14.7s · audio: 885160 b64 bytes*
*note: ORIENT+STIMULUS: frame once and read every line ending aloud*

> We're going to listen to a little poem and find the two words that rhyme.

The small brown **dog**
Sat on the **mat**
It looks for **food**
Inside a big **hat**

Tap the two words that rhyme.

### rhyme_miss
*expect: turn · turn_ended: True · 8.5s · audio: 473000 b64 bytes*
*note: RECOVER: stretch only the tapped words; do not disclose the pair*

> Listen to those endings: do do**g** and foo**d** sound the same? Try tapping two more!

### round_start
*expect: turn · turn_ended: True · 10.2s · audio: 577284 b64 bytes*
*note: STIMULUS on advance: read the next poem, one tutor turn*

> Go look for **bugs**
Under the red **sun**
We play all **day****
Having lots of **fun**

Tap the two words that rhyme.

### rhyme_correct
*expect: turn · turn_ended: True · 4.1s · audio: 223364 b64 bytes*
*note: quiet celebration without repeating the answer pair*

> You found them, those two match perfectly!

### activity_complete
*expect: turn · turn_ended: True · 4.8s · audio: 269444 b64 bytes*
*note: one-sentence closing celebration*

> You worked so hard today, look at all those rhyming pairs you heard!
