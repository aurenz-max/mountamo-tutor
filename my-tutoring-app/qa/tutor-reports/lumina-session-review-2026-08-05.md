# Lesson-mode session tutor — real-child session review (2026-08-05)

Two real mixed-lesson open-mic sessions driven by the user's son (K-age), reviewed
at the user's request. These are the first extended real-child drives of the
session-wide open mic shipped in `9d08687` — effectively HUMAN-CHECKS **#64 driven
in the wild**, and criterion **#64(b)** ("ask the tutor a question during a non-DI
section and get a spoken answer") **FAILED**.

**Sessions (server ledgers, `backend/logs/lumina-sessions/`):**
- `2026-08-05-140310-lumina-tutor-fc0e95518468.jsonl` — 16.7 min, curator-brief
  excavator/dump-truck lesson, morning. 710 events.
- `2026-08-05-235650-lumina-tutor-57f1dc98f7d5.jsonl` — 17.3 min, same lesson
  family, evening (the session the user's excerpt came from). 601 events.

Both sessions show genuinely strong engagement: the child asked a real mechanism
question and self-answered it ("What does it use to push up the dumper? …the
hydraulics!"), barge-in yielded correctly all 16 times per session, and he
finished the final quiz 6/6. The failures below are worth fixing precisely
because the engagement is real.

## Finding A (headline, pedagogy): the script outranks the student

**Evidence (evening, turn 8, at 3:28):** child, mid-`machine-profile`:

> "Whoa. What's this? … What do you think they're making here? … Are they going
> to build a big um place for people to live? … Are they going to build a bunch
> of apartments? Hey, can we go over there? Yeah."

Tutor reply:

> "It definitely looks like a very busy place! **What do you already know about
> an excavator? Have you ever seen one—**"

That reply is a **verbatim recitation of machine-profile's level1 scaffold line**
(`catalog/engineering.ts:146`: `"What do you already know about {{machineName}}?
Have you ever seen one?"`). The tutor had already asked it once at the primitive
switch (turn 6); when the child responded with his own question-burst, the model
gave a token acknowledgment and reset to the script.

**Root-cause chain (three layers, all prompt-side):**

1. **Unscoped anti-leak rules.** `build_lesson_system_instruction`
   (`backend/app/api/endpoints/lumina_tutor.py:394-397`) says *"Never give
   direct answers"* and *"Use Socratic questioning — ask guiding questions
   instead of stating facts."* Those rules exist to protect graded challenge
   answers; the model generalizes them to ALL student questions. machine-profile
   is display-only — there was no answer to protect.
2. **The right rule exists but at the lowest altitude.** The scaffold's own
   commonStruggles entry (`engineering.ts:152`) says *"Asks questions the
   profile doesn't cover → Answer the student's question using your general
   knowledge, then guide them back."* It loses to the level1 line and to the
   global rules above it.
3. **scaffoldingLevels misused as an opener.** The system prompt frames the
   levels as hint-ladder responses ("when the student requests a hint"), but the
   model deploys level1 as its default re-engagement move whenever it doesn't
   know what else to do.

Product frame: the child's spontaneous question was the peak-engagement moment
of the session — exactly what the open-mic transport exists for
(open-mic-over-turn-windows ruling). Deflecting it teaches the child the tutor
doesn't listen.

**Aggravator (not the cause):** the question arrived as a single ~48-second
input-transcript blob with heavy repetition — the model acknowledged generically
rather than parsing the content. The fix below is tested against this exact blob.

## Finding B (transport): recovery works, conversational continuity doesn't

**Evidence:** 7 Gemini-side connection deaths across the two sessions, all
auto-resumed by the resumption layer in ≤500ms with pending mic audio requeued:

| Session | at | Error | Recovery |
|---|---|---|---|
| evening | 0:53 | `1007 Precondition check failed` (2s after the first 4KB `[PRIMITIVE SWITCH]` injection on a fresh conn) | resumed 377ms, 5 audio chunks requeued |
| evening | 3:49 | `1011 Internal error` | resumed 454ms, 5 audio chunks requeued |
| evening | 8:03, 11:40, 14:14 | `1008 aborted` ×3 (idle stretches, no GoAway warning) | resumed each ≤470ms |
| morning | 9:00 | GoAway `time_left=50s` (clean, known path) | resumed 345ms |
| morning | 14:47 | `1008 aborted` | resumed 348ms |

The transport machinery held 7/7 (the known-1008/GoAway work). What the child
experienced at the visible one (the 1011, ~20s after the Finding-A exchange):
**cut off mid-sentence → ~17s dead air → a re-orientation greeting** ("Which part
do you want to explore first?") instead of continuing. The parent read this as
"an error where it disconnected." Notably the post-resume context replay meant
the tutor *finally answered* the building question ("It looks like they're
working on something big!") — the data survives resume; the conversational
thread doesn't.

Morning session tail: after the last resume at 14:17:53 there is zero activity
(no AI speech, no inbound audio) for the final 2 minutes before client
disconnect — ambiguous between "child was done" and "session hung"; the ledger
cannot distinguish. Watch, don't chase.

Out of scope: preventing 1007/1011/1008 — they are Google-side.

## Riders (same file, small)

- **The tutor spoke the literal string "(not set)" as an entire turn** (morning
  14:12:44, seq 584). `primitive_data.get(key, '(not set)')`
  (`lumina_tutor.py:204`) renders missing contextKeys into outbound scaffold /
  context text and the model read it aloud. `/tutor-test` Tier 2 already treats
  `(not set)` as a structural failure for DI packs; the lesson path has no such
  guard.
- **Switch-greeting spam under tab-flipping.** Morning 0:32–1:14: 7 primitive
  switches in ~40s, each injecting "Greet the student briefly for this new
  activity" — the tutor greeted activities the child had already left.
- **`session-end` telemetry is inflated garbage.** Every audio CHUNK increments
  `conversation_turns`/`voice_interactions` (`lumina_tutor.py:844-846`) —
  evening logged `turns: 3059` for a ~30-turn conversation.
- **ASR language drift on child speech (watch-item, no action).** Several
  utterances transcribed as Korean/French/Spanish ("이킹제 엠베이예", "Bébé,
  aide. Oh, maman.", "¿Qué es el número de cuenta?"). Known Gemini Live weakness
  with young children's voices; the DI family's judge-over-transcript doctrine
  is the standing mitigation. Lesson-mode conversational turns have no judge, so
  these turns were garbage-in — nothing to fix on our side today.

## Fix shape + autonomous gate

Queued as **`qa/di/BACKLOG.md` item 11** (DI family → session voice lane), which
carries the full fix design and the machine gate. Summary: one prompt-altitude
carve-out (student curiosity questions always get a real answer first, one
sentence, then bridge back; "never give answers" rescoped to the active
challenge's answer), a `[SESSION RESUMED] continue, don't re-greet` steering
injection on resume, and the three riders — gated by a new `lesson-curiosity`
Tier-3 journey in `run_tutor_live.py` that replays the child's turn-8 blob
verbatim and **must FAIL before the fix** (3/3 runs post-fix), plus a
fault-injected resume-continuity probe. Human acceptance = the user's next
real-child drive (existing HUMAN-CHECKS #64).
