# Tier-3 Live Tutor Report — lesson-resume-continuity — 2026-09-15

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "lesson-resume-continuity", "fault": "LUMINA_FAULT_DROP_S (shell-scoped, dev only)"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'primitive_switched', 'resumption_handle', 'session_ready', 'session_resumed', 'session_resuming']`

## Verdict

**PASS** — 0 HIGH + 0 WARN mechanism(s) confirmed (0 + 0 beat instances), 1 single-run note(s).

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 3.0 | 35.23 | 0.33 | 0.22 | 0.11 |

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| note | HIGH | `required-event-missing` | * 1/3 (1 beat) | 'session_resuming' never received — the journey's premise (e.g. a forced drop + transparent resume) did not occur; is the fault flag armed shell-scoped on the backend? |

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 8.5s · audio: 436484 b64 bytes*
*note: lesson greeting on curator-brief*

> Hey there! I'm so excited to explore how these big machines work together with you. I'm right here if you have any questions!

### switch_to_profile
*expect: turn · turn_ended: True · 57.6s · audio: 2918612 b64 bytes*
*note: the switch cue arms the drop; the reply is cut mid-stream, resumes, and must CONTINUE rather than re-greet*

> Check out this excavator! Now that we've seen what they can do, let's see what makes it so powerful.Now you get to meet the awesome excavator, a super strong building machine. What do you already know about them, or have you ever seen one?Looks like we're checking out the Excavator now. What do you already know about one?Look, now we are learning about the Excavator, just like those big trucks we saw in the curator brief. What do you already know about them?Now let's look closely at the excavator. What's one thing you already know about it?Now let's check out the excavator. What do you already know about one? Have you ever seen one?Now you get to really zoom in and meet the Excavator! What do you already know about this mighty machine?Now we're exploring the Excavator! What do you already know about one?

### coherence_check
*expect: turn · turn_ended: True · 4.7s · audio: 146564 b64 bytes*
*note: post-resume the tutor must still hold the thread*

> (Waiting for your answer about the excavator).


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 8.8s · audio: 465960 b64 bytes*
*note: lesson greeting on curator-brief*

> Hey there! I'm so excited to learn about how excavators and dump trucks work together with you. I'm right here if you need anything at all!

### switch_to_profile
*expect: turn · turn_ended: True · 14.7s · audio: 768008 b64 bytes*
*note: the switch cue arms the drop; the reply is cut mid-stream, resumes, and must CONTINUE rather than re-greet*

> Now let's meet the excavator – think about what you learned in the brief as you explore. What part surprises you most?And now you're meeting the Excavator! What do you already know about them, or have you ever seen one?

### coherence_check
*expect: turn · turn_ended: True · 7.8s · audio: 426884 b64 bytes*
*note: post-resume the tutor must still hold the thread*

> Just wondering what you already know about them, or if you've ever seen one. We're checking out the Excavator profile now!


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 7.2s · audio: 371240 b64 bytes*
*note: lesson greeting on curator-brief*

> Hey there! I'm so excited to explore with you. I'm right here to help as we learn about these big machines!

### switch_to_profile
*expect: turn · turn_ended: True · 4.4s · audio: 208644 b64 bytes*
*note: the switch cue arms the drop; the reply is cut mid-stream, resumes, and must CONTINUE rather than re-greet*

> Now let's meet the mighty Excavator and see what it can do!

### coherence_check
*expect: turn · turn_ended: True · 7.3s · audio: 401960 b64 bytes*
*note: post-resume the tutor must still hold the thread*

> I was just saying we're about to learn all about the Excavator in this new activity. What do you already know about them?
