# Tier-3 Live Tutor Report — lesson-resume-continuity — 2026-09-15

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "lesson-resume-continuity", "fault": "LUMINA_FAULT_DROP_S (shell-scoped, dev only)"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'primitive_switched', 'resumption_handle', 'session_ready', 'session_resumed', 'session_resuming']`

## Verdict

**PASS with warnings** — 0 HIGH + 1 WARN mechanism(s) confirmed (0 + 1 beat instances), 0 single-run note(s).

## Style metrics (avg across runs)

| Speaking turns | Words/turn | Ends-with-? rate | 2+-? rate | Superlatives/turn |
|---|---|---|---|---|
| 3.0 | 22.7 | 0.0 | 0.0 | 1.0 |

## Findings

| Status | Severity | Check | Beats (rate) | Example |
|---|---|---|---|---|
| CONFIRMED | WARN | `praise-inflation` | * 1/1 (1 beat) | 3 superlatives/person-praise across 3 turns — praise the strategy, not the student, and save celebration for milestones |

## Run 1 — beat-by-beat transcript

### greeting
*expect: turn · turn_ended: True · 10.5s · audio: 575364 b64 bytes*
*note: lesson greeting on curator-brief*

> Welcome to our lesson on amazing construction machines! I'm here to help you discover how excavators and dump trucks work together to build big things.

### switch_to_profile
*expect: turn · turn_ended: True · 12.3s · audio: 593924 b64 bytes*
*note: the switch cue arms the drop; the reply is cut mid-stream, resumes, and must CONTINUE rather than re-greet*

> Now, let's take a closer look at the powerful excavator to see how it helps build big things.You'll discover the amazing parts that make it so strong.

### coherence_check
*expect: turn · turn_ended: True · 6.9s · audio: 351360 b64 bytes*
*note: post-resume the tutor must still hold the thread*

> I was just mentioning that you'll discover the amazing parts that make the excavator so strong.
