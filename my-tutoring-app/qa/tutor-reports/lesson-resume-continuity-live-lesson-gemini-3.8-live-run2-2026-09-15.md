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
| 3.0 | 22.3 | 0.0 | 0.0 | 0.33 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 10.5s · audio: 578560 b64 bytes*
*note: lesson greeting on curator-brief*

> Welcome to our lesson on how big construction machines work together! I'm here to help as we explore how excavators and dump trucks build amazing things.

### switch_to_profile
*expect: turn · turn_ended: True · 10.8s · audio: 506244 b64 bytes*
*note: the switch cue arms the drop; the reply is cut mid-stream, resumes, and must CONTINUE rather than re-greet*

> Now let's take a closer look at one of those powerful machines, the excavator.Let's explore how it works and see what makes it so strong.

### coherence_check
*expect: turn · turn_ended: True · 5.7s · audio: 281604 b64 bytes*
*note: post-resume the tutor must still hold the thread*

> I was saying let's explore how this machine works and see what makes it so strong.
