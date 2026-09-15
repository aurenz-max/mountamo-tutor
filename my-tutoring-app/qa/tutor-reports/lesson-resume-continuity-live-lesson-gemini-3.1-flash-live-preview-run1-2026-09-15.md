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
| 3.0 | 32.3 | 0.33 | 0.33 | 0.0 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 8.2s · audio: 428200 b64 bytes*
*note: lesson greeting on curator-brief*

> Hey there! I'm excited to explore how construction vehicles work together with you. I'm here if you need any hints along the way!

### switch_to_profile
*expect: turn · turn_ended: True · 16.3s · audio: 878728 b64 bytes*
*note: the switch cue arms the drop; the reply is cut mid-stream, resumes, and must CONTINUE rather than re-greet*

> Now you get to meet the Excavator up close, just like we were briefed on before! What do you notice about it first?It looks like you've just met the mighty Excavator! Have you ever seen one in real life, or are you curious about how they work?

### coherence_check
*expect: turn · turn_ended: True · 9.6s · audio: 514564 b64 bytes*
*note: post-resume the tutor must still hold the thread*

> My connection dropped for a moment, but I was asking if you'd ever seen an Excavator in real life, or if you're curious about how they work.
