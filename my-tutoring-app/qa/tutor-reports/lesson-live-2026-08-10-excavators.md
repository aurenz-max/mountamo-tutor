# Live lesson — excavators & dump trucks (2026-08-10)

Ledger: `backend/logs/lumina-sessions/2026-08-10-000249-lumina-tutor-cdab143abd9c.jsonl`
(1,698 events · 16m50s · lesson mode · 8 primitives / 9 switches · `interactions 153, turns 141, voice 127`)

**Driven by the user WITH his son (two speakers on one mic, ages adult + pre-reader).**
Not a harness run. **PARKED on purpose — user call 2026-08-10: "I don't think we push
this forward."** The value of this session was confirmation, not a work queue. Nothing
below is an ACTIVE lane; IMG-1 is the only item worth building when a slot opens.

## What this run PROVED (do not re-verify)

- **Session resumption holds under real fire.** 6 mid-session drops — 3× `1011 Internal
  error`, 3× `1007 Precondition check failed` — every one resumed in **282/360/297/391/328/328 ms**,
  all with `mid_turn` steering, zero `pending_text` lost. The session never restarted cold.
  This is the first time that machinery has been loaded past a synthetic test.
- **Floor gate is clean at scale.** `yielded 0 · superseded 0 · merged 3 · interrupted 2 ·
  wedged 0` across 27 outbound batches, including 8,650- and 5,380-char state attachments.
  No cue-ordering races, watchdog never fired.
- **`context_window_compression` held** — 17 minutes of audio, no `1008`.
- All 4 read-alouds (`READ_INSTRUCTIONS`, `READ_SCENARIO`, `READ_INTRO`, `READ_SEQUENCE`)
  landed and were spoken verbatim.
- **Restraint works.** 126 human utterances, tutor spoke 59 → **silent through 53% of
  student turns**, with a hot mic (human voice = 53% of wall clock).
- **DI-1 confirmed a fourth time, outside the DI lane.** ASR wrote *"Church"*; the tutor
  said *"You got it, tracks!"* The model judges AUDIO; the transcript is a spectator.

## IMG-1 — the tutor is blind to every image on screen *(the one item worth building)*

The student asked what colour the dump truck was (254.7s). The tutor said **"That one is
yellow!"** It was red. Corrected, it laundered the miss into the student's claim
(*"A big red dump truck sounds fast!"*) without ever acknowledging it had been wrong.
At 698.5s, asked what was in the background, it invented **"big green trees."**

- **0 of ~160 tutoring scaffolds across all 14 catalogs pass any image field.** Not the
  URL, not even the prompt. `machine-profile` sends
  `contextKeys: ['machineName','category','era','sectionsOpened']`
  (`service/manifest/catalog/engineering.ts:144`).
- **Even the prompt wouldn't be authoritative** — the image is AI-generated on demand from
  `imagePrompt` (`MachineProfile.tsx:120`). The image model picks the colour; only the
  pixels know.
- **There is no image input path at all.** Client sends `text` and `audio` only
  (`LuminaAIContext.tsx:920,944`); backend only ever calls `send_realtime_input(text=…)`
  / `(audio=…)`. The Live API accepts image frames; we have never wired one.

Two fixes, independent:
1. **Prompt-level, cheap, no new channel:** the tutor must say *"I can't see the picture —
   tell me what colour it is!"* instead of confabulating a visual detail. A warm,
   well-formed, wrong answer to a child who can see the screen is a pedagogy defect
   (CLAUDE.md §Pedagogy: *every primitive must teach something real*), and it reads as
   quality until you know she is blind. **This is the half that should ship first.**
2. **Caption the pixels at generation time:** when `generateMachineImage` returns, one
   vision pass over the ACTUAL returned image → store `imageDescription` → add to
   `contextKeys`. Text-only, rides the existing scaffold channel, survives the 6
   reconnects for free. Live image frames are the long-term answer for interactive
   surfaces, but a transient frame does not survive a resume.

Executor: `/primitive-contract` on `machine-profile` first (this changes what the scaffold
promises the tutor), then the caption pass. **Not started.**

## TRN-1 — model meta-preamble reaches the client transcript (cosmetic, small)

**14 of 22 model turns** had `ai_transcription` open with a fabricated cue block —
`[CURRENT STATE]: The student is on concept 3 of 4: "Stick"…`, `[CHALLENGE_COMPLETED]
Student correctly chose "Heavy Haul Dump Truck"…`, and one full `[PRIMITIVE SWITCH]` block.

- **It was NOT spoken.** Strip the preamble and every turn's remainder lands at
  **17–21 chars/sec**, matching the clean turns exactly, while the full text implies
  30–130 cps against the same audio (738.2s: 494 chars / 9.96s = 49.6 cps → tail 203
  chars = 20.4 cps). The child heard nothing wrong.
- **It is confabulated, not echoed.** `construction-team-loop` / `obj3-teamwork-sim`
  appear nowhere in the ledger and nowhere in the codebase; the real switch 5.6s later
  was to `how-it-works` / `obj3-teamwork-process`.
- It is forwarded to the client (`lumina_tutor.py:1548`) → `conversation`
  (`LuminaAIContext.tsx:403`) → rendered by `CuratorCompanion` (Pip's bubble,
  `CuratorCompanion.tsx:220`) and `CuratorConsole`.

Fix: strip a leading `[A-Z_ ]+]`-tagged block from `ai_text` before both the ledger write
and the ws forward.

## ASR-1 — the input transcript is untrustworthy, and there is NO lever

A pre-reader's vocalisations transcribed as **"Guten Morgen." / "Ya está." / "Quem gosta
de morango?" / "Sim." / "しないでよ。" / "I'm 21."** and, at 745.7s, **an obscenity**.
**56 of 126 windows (44%) produced no transcript at all.**

- **The model never sees any of it.** `response_modalities=["AUDIO"]` — Gemini consumes
  the audio natively; `input_audio_transcription` is a **separate parallel ASR pass whose
  output is never fed back into context**. Proof: the obscenity at 745.7s drew a reply
  about the construction site being funny, with no reaction whatsoever.
- **No config lever in the SDK we pin.** `types.AudioTranscriptionConfig` is literally
  `pass` — zero fields, no `language_code`; the docstring says the transcript *"aligns
  with the input audio language"* (auto-detected). `speech_config.language_code` is output
  synthesis only. **⚠️ Qualifier, and it is the first thing to check if this is ever
  resumed: that is `google-genai==1.16.1` (`requirements.txt:31`), which is well behind
  the model we call (`gemini-3.1-flash-live-preview`). An empty type in a pinned SDK is
  NOT proof the API lacks the field.** Bump-and-re-inspect before concluding this is
  unfixable — it is cheap and it was not done.

So the fix is entirely consumer-side, and the sharp part is not the rendering:
- Do not render `user_transcription` on any child- or parent-visible surface.
- **Any eval that scores tutor behaviour against `user-transcript` is scoring a channel
  the model never saw.** That is a correctness problem for `/tutor-test` and the live
  harness triage — worth a loud comment at `lumina_tutor.py:1531`.

## FLOOR-1 — flat 900ms close hands the tutor the floor mid-conversation

| | |
|---|---|
| Median gap: human stops → tutor starts | **1.28s** (p10 **0.91s**) |
| Onsets within 1.5s of a human stopping | **35 of 57** |
| Onsets landing *on top of* open human speech | 10 of 59 (17%) |
| Median barge-in | **7.5s into the tutor's turn**; 31 of 44 >5s; **none <1s** |
| Human windows >8s | **16** (longest 32.6s) |

Barge-in is a **symptom, not a cause** — nobody cut the tutor off reflexively. The cause is
`silenceCloseMs: 900` for all lesson primitives (`lessonVoiceTurnPolicy.ts:28`). The >8s
windows are whole parent↔child exchanges collapsed into one "student utterance"; at
165.3–183.0s the parent ran his own Socratic loop and **the tutor answered his question to
his son** (*"The dump truck uses wheels to drive on the road."*).

- **`proactive_audio` is NOT available.** `ProactivityConfig` exists in the SDK but
  proactive audio is unsupported on `gemini-3.1-flash-live-preview`
  (`lumina_tutor.py:46`) — it and `enable_affective_dialog` are native-audio-family
  features, and the SDK would accept the field and silently no-op. **Do not swap models
  for it:** this run is the evidence that the current half-cascade stack survives 6 drops
  with `session_resumption` + `context_window_compression` both load-bearing.
- **We already own the gate.** `manual_activity: true` disables Gemini's VAD entirely
  (`lumina_tutor.py:831-835`), so the tutor gets the floor only when we send
  `activity_end`. Current policy is just "always yield after 900ms."
- Lever if resumed: **asymmetric close** — keep ~900ms when the tutor just asked or a
  challenge is open (the child is answering *her*); ~2–2.5s in free exploration.
  Needs a real session with a child to judge; no machine gate can pass it.
