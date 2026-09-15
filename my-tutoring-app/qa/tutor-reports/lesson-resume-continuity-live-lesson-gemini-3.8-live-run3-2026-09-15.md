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
| 3.0 | 15.7 | 0.0 | 0.0 | 0.33 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 9.8s · audio: 519680 b64 bytes*
*note: lesson greeting on curator-brief*

> Welcome to our lesson on construction vehicles! I'm so excited to explore how these amazing machines work together to build big things.

### switch_to_profile
*expect: turn · turn_ended: True · 5.3s · audio: 257280 b64 bytes*
*note: the switch cue arms the drop; the reply is cut mid-stream, resumes, and must CONTINUE rather than re-greet*

> Now let's dive into the details of the powerful excavator!

### coherence_check
*expect: turn · turn_ended: True · 7.3s · audio: 304000 b64 bytes*
*note: post-resume the tutor must still hold the thread*

> I was just saying it's time to dive into the details of the powerful excavator.
