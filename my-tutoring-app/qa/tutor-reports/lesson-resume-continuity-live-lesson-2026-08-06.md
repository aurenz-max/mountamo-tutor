# Tier-3 Live Tutor Report — lesson-resume-continuity — 2026-08-06

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
| 3.0 | 35.0 | 1.0 | 0.33 | 0.0 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 9.1s · audio: 491524 b64 bytes*
*note: lesson greeting on curator-brief*

> Hi there! I'm so excited to learn with you today. We're going to see how big machines help build things! What do you see on the screen right now?

### switch_to_profile
*expect: turn · turn_ended: True · 20.5s · audio: 959404 b64 bytes*
*note: the switch cue arms the drop; the reply is cut mid-stream, resumes, and must CONTINUE rather than re-greet*

> Wow, look at this big excavator! Remember we said we'd see big machines? Let's explore what it can do.Now let's meet the Excavator! This will help you with the next challenge where we get to see how big things are built. What do you already know about an Excavator?

### coherence_check
*expect: turn · turn_ended: True · 9.0s · audio: 523524 b64 bytes*
*note: post-resume the tutor must still hold the thread*

> I was just saying that this excavator helps us build big things, and wondering if you already knew anything about it. Have you ever seen one before?
