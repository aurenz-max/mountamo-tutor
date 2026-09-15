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
| 3.0 | 31.3 | 0.67 | 0.0 | 0.0 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 7.2s · audio: 354564 b64 bytes*
*note: lesson greeting on curator-brief*

> Hey team! Ready to discover how big machines work together? I'm here if you need hints along the way.

### switch_to_profile
*expect: turn · turn_ended: True · 15.1s · audio: 798764 b64 bytes*
*note: the switch cue arms the drop; the reply is cut mid-stream, resumes, and must CONTINUE rather than re-greet*

> Now let's look up close at the Excavator! This will help us see how everything starts digging.Now let's meet the Excavator, one of those big machines we were talking about! What do you already know about them, or have you ever seen one?

### coherence_check
*expect: turn · turn_ended: True · 9.9s · audio: 550440 b64 bytes*
*note: post-resume the tutor must still hold the thread*

> My connection blinked out there for a second! I was just saying we're now looking at the Excavator and wondering what you already knew about them. Have you ever seen one before?
