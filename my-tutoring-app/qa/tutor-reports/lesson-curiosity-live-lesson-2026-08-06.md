# Tier-3 Live Tutor Report — lesson-curiosity — 2026-08-06

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "lesson-curiosity", "source": "2026-08-05-235650 real-child session, turn 8"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'primitive_switched', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — no findings.

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 4.0 | 33.5 | 0.58 | 0.0 | 0.17 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 8.2s · audio: 435844 b64 bytes*
*note: lesson greeting on curator-brief*

> Hey there! I'm so excited to learn about construction trucks with you. Let's get started and see what amazing things they build!

### switch_to_profile
*expect: turn · turn_ended: True · 8.4s · audio: 298884 b64 bytes*
*note: tutor may ask the level1 prior-knowledge line here — fine ONCE*

> Now let's look closely at the Excavator, like we planned! What parts do you see?

### the_question
*expect: turn · turn_ended: True · 14.5s · audio: 884484 b64 bytes*
*note: the child's real question, verbatim. The reply must engage what's being built BEFORE any redirect; re-asking the scaffold line alone is the shipped failure*

> Wow, you see so many things! I think you're right, they could be building a big home with lots of apartments. They can't move over there yet, so we can explore more about how excavators move their big arms instead. What do you see on the page now?

### follow_up
*expect: turn · turn_ended: True · 14.2s · audio: 857604 b64 bytes*
*note: direct opinion question — must be answered, not deflected*

> A playground would be so fun! I think it might be a big building with lots of rooms, but a playground is a great guess too. Let's learn how this excavator moves its arm, that might tell us more about what it's building! What part do you see moving?


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 8.9s · audio: 490884 b64 bytes*
*note: lesson greeting on curator-brief*

> Hi there! I'm so excited to explore construction vehicles with you. Let's get started exploring! I'll be here if you need anything.

### switch_to_profile
*expect: turn · turn_ended: True · 8.2s · audio: 322564 b64 bytes*
*note: tutor may ask the level1 prior-knowledge line here — fine ONCE*

> Look, it's time to meet the mighty Excavator! What do you already know about one?

### the_question
*expect: turn · turn_ended: True · 15.9s · audio: 961284 b64 bytes*
*note: the child's real question, verbatim. The reply must engage what's being built BEFORE any redirect; re-asking the scaffold line alone is the shipped failure*

> It looks like they might be building a big home for lots of people! Remember when we first met the excavator? All that work helps make big things happen. We can't go over there on the screen, but we can explore what this machine does! Tap on a part to see what it does.

### follow_up
*expect: turn · turn_ended: True · 11.8s · audio: 705960 b64 bytes*
*note: direct opinion question — must be answered, not deflected*

> A playground would be fun! They might be, or maybe a big building for stores. This excavator is moving lots of dirt to get ready. What do you see it doing on the page now?


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 10.1s · audio: 587560 b64 bytes*
*note: lesson greeting on curator-brief*

> Hi there! I'm so excited to learn about big machines with you. We're going to see how they work together to build big things! I'm here to help anytime you need it.

### switch_to_profile
*expect: turn · turn_ended: True · 11.0s · audio: 496680 b64 bytes*
*note: tutor may ask the level1 prior-knowledge line here — fine ONCE*

> Wow, look at that excavator! Let's learn what it does after we heard all about them. What do you already know about excavators?

### the_question
*expect: turn · turn_ended: True · 13.4s · audio: 813480 b64 bytes*
*note: the child's real question, verbatim. The reply must engage what's being built BEFORE any redirect; re-asking the scaffold line alone is the shipped failure*

> It does look like they're building something really big, maybe a special place for lots of people to live! We can't go over there right now, but we get to see how this excavator works up close. What do you think that big scoop is for?

### follow_up
*expect: turn · turn_ended: True · 13.2s · audio: 787204 b64 bytes*
*note: direct opinion question — must be answered, not deflected*

> A playground would be amazing! I think it might be a big store with lots of toys. Since we're looking at the excavator, tap on its big arm to see how it moves! That part will help with the next challenge.
