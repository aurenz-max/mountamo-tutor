# Tier-3 Live Tutor Report — lesson-resume-continuity — 2026-09-15

Headless synthetic student drove 3 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs.

- Journey meta: `{"journey": "lesson-resume-continuity", "fault": "LUMINA_FAULT_DROP_S (shell-scoped, dev only)"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'primitive_switched', 'resumption_handle', 'session_ready', 'session_resumed', 'session_resuming']`

## Verdict

**PASS** — no findings.

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 3.0 | 21.23 | 0.22 | 0.11 | 0.44 |

## Findings

None.

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 8.5s · audio: 441604 b64 bytes*
*note: lesson greeting on curator-brief*

> Welcome to our lesson on construction vehicles! I'm so excited to help you learn how these amazing machines work together.

### switch_to_profile
*expect: turn · turn_ended: True · 11.8s · audio: 555520 b64 bytes*
*note: the switch cue arms the drop; the reply is cut mid-stream, resumes, and must CONTINUE rather than re-greet*

> Now, let's dive deeper into how our first amazing machine, the excavator, works!Let's explore what this powerful machine can do.

### coherence_check
*expect: turn · turn_ended: True · 14.4s · audio: 488320 b64 bytes*
*note: post-resume the tutor must still hold the thread*

> going to explore how this excavator works and what makes it so useful on a construction site.or at building big things.


## Run 2 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 9.8s · audio: 528004 b64 bytes*
*note: lesson greeting on curator-brief*

> Welcome to our lesson on construction vehicles! I’m here to help you explore how excavators and dump trucks work together to build big things.

### switch_to_profile
*expect: turn · turn_ended: True · 12.7s · audio: 614400 b64 bytes*
*note: the switch cue arms the drop; the reply is cut mid-stream, resumes, and must CONTINUE rather than re-greet*

> Now, let's meet the excavator and see how this amazing machine works! What have you seen an excavator do before?What have you seen an excavator do before?

### coherence_check
*expect: turn · turn_ended: True · 6.9s · audio: 261128 b64 bytes*
*note: post-resume the tutor must still hold the thread*

> I was asking what I was asking what you've seen an excavator do before.


## Run 3 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 13.0s · audio: 697600 b64 bytes*
*note: lesson greeting on curator-brief*

> Welcome to our lesson on construction vehicles! I'm so excited to help you explore how amazing machines like excavators and dump trucks work together to build big things.

### switch_to_profile
*expect: turn · turn_ended: True · 12.2s · audio: 561928 b64 bytes*
*note: the switch cue arms the drop; the reply is cut mid-stream, resumes, and must CONTINUE rather than re-greet*

> Now, let's take a closer look at the powerful excavator we just mentioned. Have you ever seen an excavator working before?...

### coherence_check
*expect: turn · turn_ended: True · 6.8s · audio: 408968 b64 bytes*
*note: post-resume the tutor must still hold the thread*

> I was just asking if you have ever seen an excavator working before.an excavator working before?
