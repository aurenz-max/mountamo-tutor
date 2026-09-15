# Tier-3 Live Tutor Report — lesson-resume-continuity — 2026-09-15

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "lesson-resume-continuity", "fault": "LUMINA_FAULT_DROP_S (shell-scoped, dev only)"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'primitive_switched', 'resumption_handle', 'session_ready', 'session_resumed', 'session_resuming']`

## Verdict

**PASS** — no findings.

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 3.0 | 31.3 | 0.0 | 0.0 | 0.0 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 8.2s · audio: 428164 b64 bytes*
*note: lesson greeting on curator-brief*

> Hey there! I'm excited to explore how construction machines work together with you today. I'm right here if you need any help!

### switch_to_profile
*expect: turn · turn_ended: True · 15.6s · audio: 813484 b64 bytes*
*note: the switch cue arms the drop; the reply is cut mid-stream, resumes, and must CONTINUE rather than re-greet*

> Now that you know what we're looking for, let's meet the Excavator! What do you already know about them?It looks like we're about to learn all about excavators. Try tapping the Key Components section to see what's inside!

### coherence_check
*expect: turn · turn_ended: True · 10.5s · audio: 589480 b64 bytes*
*note: post-resume the tutor must still hold the thread*

> I was just suggesting you try tapping the Key Components section to see what's inside and learn more about excavators! This will help you with the next challenge, where you get to meet one.
