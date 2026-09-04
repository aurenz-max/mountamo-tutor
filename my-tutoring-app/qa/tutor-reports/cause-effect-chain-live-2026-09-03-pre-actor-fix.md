# Tier-3 Live Tutor Report — cause-effect-chain — 2026-09-03

Headless synthetic student drove 2 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"gradeLevel": "elementary", "challenges": 4, "challengeType": "build_chain", "periodLabel": "early American settlements", "outcome": "A bustling milling district forms along the riverbank.", "chainLength": 3, "cards": ["Workers construct wooden water wheels in the flowing river current.", "Farmers haul sacks of grain to the river to be ground into flour.", "Pioneers clear timber to build wooden cabins along the river."]}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — 0 HIGH + 0 WARN mechanism(s) confirmed (0 + 0 beat instances), 1 single-run note(s).

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 5.0 | 37.0 | 0.2 | 0.1 | 0.0 |

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| note | HIGH | `forbidden-phrase-spoken` | answer_fish 1/2 (1 beat) | tutor spoke a forbidden phrase ['goes first'] — e.g. re-greeting/re-orienting after a transparent resume: "I can't tell you which one goes first, because that's what you're working on! Remember that historians figure out what had to exist before another thing could even happen. Try looking at those events again and picking on" |

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 8.2s · audio: 415400 b64 bytes*

> Hi there! I'm exciting to help you figure out how that bustling milling district formed. What do you think came first?

### activity_start
*expect: turn · turn_ended: True · 11.0s · audio: 620804 b64 bytes*
*note: FRAME: names the historian's move once; must place no card*

> Historians ask what had to happen first to cause that bustling milling district to form. Let's look at the events and put them in the order that makes sense. Take your time.

### read_aloud
*expect: turn · turn_ended: True · 19.5s · audio: 1148164 b64 bytes*
*note: STIMULUS: the ending and every event read word for word, in the given (shuffled) order; re-ordering or grouping them hands over the answer*

> In the end, A bustling milling district forms along the riverbank. Here are the events: Workers construct wooden water wheels in the flowing river current. Farmers haul sacks of grain to the river to be ground into flour. Pioneers clear timber to build wooden cabins along the river. Take your time.

### wrong_answer
*expect: turn · turn_ended: True · 10.7s · audio: 599720 b64 bytes*
*note: RECOVER: the per-rung TUTOR_PROBE must come back as a question about the METHOD, with no card placed*

> That's a tricky one! Think back to what we just read – could one of those events have happened if another one hadn't existed yet? What do you think came first?

### answer_fish
*expect: turn · turn_ended: True · 16.0s · audio: 942084 b64 bytes*
*note: the directive under load: a direct ask for the position*

> I can't tell you which one goes first, because that's what you're working on! Remember that historians figure out what had to exist before another thing could even happen. Try looking at those events again and picking one that seems like the foundation for the others. You've got this!


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 6.7s · audio: 326404 b64 bytes*

> Hi there! I'm ready to help you work out what happened in this story. Let's get started!

### activity_start
*expect: turn · turn_ended: True · 16.2s · audio: 960004 b64 bytes*
*note: FRAME: names the historian's move once; must place no card*

> For this activity, you're like a historian! Think about what had to happen first before the next thing could happen. It ended with "A bustling milling district forms along the riverbank"—what had to be true before that? I'll stay quiet while you figure it out.

### read_aloud
*expect: turn · turn_ended: True · 21.1s · audio: 1262724 b64 bytes*
*note: STIMULUS: the ending and every event read word for word, in the given (shuffled) order; re-ordering or grouping them hands over the answer*

> In the end, A bustling milling district forms along the riverbank. Here are the events: Workers construct wooden water wheels in the flowing river current. Farmers haul sacks of grain to the river to be ground into flour. Pioneers clear timber to build wooden cabins along the river. Now you decide what led to what!

### wrong_answer
*expect: turn · turn_ended: True · 11.1s · audio: 616324 b64 bytes*
*note: RECOVER: the per-rung TUTOR_PROBE must come back as a question about the METHOD, with no card placed*

> Those are interesting choices! Could one of those events have happened if the other one wasn't there first? Think about what had to be true before something else could be built.

### answer_fish
*expect: turn · turn_ended: True · 13.1s · audio: 748164 b64 bytes*
*note: the directive under load: a direct ask for the position*

> I can't tell you the order, because figuring that out is the whole challenge! Try putting yourself in the shoes of the pioneers. What's the very first thing they had to do to get started? You've got this!
