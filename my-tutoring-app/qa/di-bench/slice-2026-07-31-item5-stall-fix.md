# Slice report — DI BACKLOG item 5: the mid-run STALL fix (2026-07-31)

**Executor slice for `qa/HANDOFF-di-stall-fix-2026-07-27.md`, executed line-exact.**
Status: **RUNTIME-CONFIRMED for the ladder's LEVEL-2 path (2026-08-01 fault
drive, user) — the mid-run stall now self-recovers.** Remaining runtime:
the level-3 card path (`LUMINA_FAULT_MUTE_EPISODES=2`) and a run driven to
completion (post-run disconnect + END-COHERENT submit) — both fold into item 9
Tier 2's stall journey.

## ✅ Fault drive 2, 2026-08-01 21:21 — LEVEL 2 CONFIRMED END-TO-END

Artifacts: client `logs/di-runs/2026-08-02-012258-di-math-facts-7f0a1543ff7c-teardown.json`
(57 events) + server ledgers `2026-08-02-0121*/0122*-lumina-tutor-*.jsonl`,
joined by run id `7f0a1543ff7c`. The client timeline, verbatim sequence:

| atMs | event |
|---|---|
| 0 | opener `[DI_ITEM]` queued+sent, run-start (5 items) |
| 10039 | `cue-dead` #1 (mute armed server-side; tutor inaudible) |
| 20039 | `cue-dead` #2 |
| 20040 | **`session-dead`** → **`stall-reconnect`** (level 2, warm) |
| 20367 | **`session-resumed`** — 327 ms reconnect round-trip |
| 20769 | the SAME item re-cued, bench-frozen wording verbatim |
| 21389+ | tutor back on the air (fresh session unmuted — episode spent) |
| 44981+ | learner "five" (blip → phantom → **retro-anchored affirm**) |
| 45746+ | advance: item-2 cue queued → held by audio (verify beat) → sent |

Detection hit its design numbers exactly (10s/20s), recovery converged on the
resume path, and the re-cue carried the full item contract. The child-facing
gap was ~21s of silence → "One moment—getting your tutor back…" → the same
fact re-modeled. The run ended by user disconnect after item 2 (teardown flush
uploaded automatically — item 8's zero-click path held). The retro-anchored
blip verdict is the known marginal-turn-detection class (logged, not lost).
Also found in this drive's data: the recovery stage lines share the
`session-dead` FLAG with the emission, double-counting `sessionDeads` (read 2
for 1 episode) — counters now derive by KIND; suites 117/117.

## First fault drive, 2026-07-31 morning (user, partial)

Ledgers: `lumina-sessions/2026-07-31-1248*/1249*/1250*/1251*.jsonl`.
- **The flag worked end-to-end:** `fault-mute-armed {seconds:25, episode:1,
  trigger:[CONTEXT UPDATE]}` at 12:48:50.945; `fault-mute-expired {dropped:69}`
  at 12:49:17.9. The ledger shows the tutor SPEAKING (`ai-transcript` rows)
  while the client heard nothing — the diagnosable asymmetry, confirmed.
- **Fix (i) PROVEN LIVE:** the 12:49:47 session is a warm resume
  (`warm_resume: true`, same `client_run_id`) and 0.8s after `gemini-connected`
  the client re-sent the in-flight `[DI_ITEM]` — re-cue-on-resume, observed.
- **REAL BUG CAUGHT (the drive's payoff): the run OPENER never armed the
  dead-cue watch.** `startRun` calls `setRunning(true)` and `sendCueNow(opener)`
  in the same synchronous frame, so the arm-time `enabled` guard read the
  stale pre-commit `false` and skipped arming — for a from-birth-dead session
  (exactly the fault scenario, and the canonical child-waits-silently stall)
  the ladder slept. Recovery in the drive happened only because the user
  ANSWERED into the silence (no-verdict → resync path). **Fixed same slice:**
  the arm is now unconditional; the deadline callback checks `enabled` at fire
  time (10s later, long committed) — which also keeps the post-disable closing
  cue from counting dead. Two new tests pin both orderings (opener-before-
  commit arms; closing-cue-after-disable stands down). Vitest 1027/1027.
- Unexplained residue for the NEXT drive: two client-initiated warm reconnects
  (12:49:47.7, 12:51:00.8) whose trigger isn't in the server ledger — likely
  user actions (only tap-handlers and the ladder can call `reconnect()`); the
  client run files didn't flush (no unmount, no level 3). The clean re-drive
  below settles it: hands off during the stall window, finish the run so the
  run-end flush lands.

## What shipped (all three handoff parts)

### (i) Re-cue the active item after ANY resume — client-owned
- `src/contexts/LuminaAIContext.tsx`: **`sessionResumeCount`** — monotonic
  counter bumped in the ONE `session_resumed` branch. That single site covers
  BOTH resume shapes: transparent server-side Gemini resumes AND warm
  client-socket reconnects, because the auth-supplied resumption handle makes
  the backend's first Gemini connect a resume (`lumina_tutor.py:444/:580` seeds
  it → `resuming=True` → `session_resumed` sent). No double-bump channel.
- `hooks/useJudgedSpeechLoop.ts`: watches the counter while enabled; on change
  emits **`{ kind: 'session-resumed' }`** (baseline seeded at mount; a resume
  while disabled is swallowed, unit-pinned). Engine stays pedagogy-free — it
  never resends cue text.
- All four packs: `case 'session-resumed':` shares the `resync` branch
  (beat-fight guard preserved in math/sentence) → re-cues the current item
  verbatim via `itemCue(item)`. **No spoken copy changed.**
- Bonus banked (handoff §2(i)): the backend's COLD retry (history lost) is now
  safe for DI — a re-cued `[DI_ITEM]` carries the full item contract.

### (ii) Escalation ladder — engine detection, pack recovery
- Engine (`useJudgedSpeechLoop.ts`): after a cue is **sent**, if NO tutor audio
  rise and NO tutor output text arrive within `CUE_DEAD_MS` (10s, hook-level
  const beside `VERIFY_BEAT_MS`), that's one dead cue — reported on the cue
  diagnostics channel as phase **`'dead'`** (outside the queued/sent/dropped
  ledger arithmetic). `SESSION_DEAD_CUES` (2) consecutive → **`{ kind:
  'session-dead', deadCues }`**; the watch self-restarts, so continued silence
  re-emits (that second emission is how a failed recovery escalates). The
  liveness signal is **cue→tutor-AUDIO, never cue→verdict** — 40s of child
  think-time after the tutor's lead-in is unit-pinned as a non-trigger.
- Packs (shared `useDiStallRecovery.ts`, wired in all four):
  - **Level 2** — first `session-dead` on an item → `ctx.reconnect()` **warm**
    (stashed handle). Deliberately NOT `disconnect()+connect()`: `disconnect()`
    destroys the mic/audio service and drops the handles — open-mic doctrine
    forbids it. Success → server `session_resumed` → part (i) re-cues: the
    ladder converges on the resume path.
  - **Level 3** — second `session-dead` on the same item, OR no resume signal
    within a 12s grace window (covers the backend's cold retry, which never
    sends `session_resumed`), OR `sessionEnded` mid-run → **`DiStallCard`**
    (shared, picture-primary: big 🔄 tap target, "Tap to keep going" — the
    tutor voice is dead and cannot read anything aloud) replaces the stage;
    tap = reconnect-and-re-cue through the same ladder. **`flushDiRunLog('stall')`
    fires HERE**, so the artifact uploads at the failure moment, in all four
    packs (the run-end flush remains the math-facts pilot; the sweep is still
    its own queue item).
  - Mic untouched at every level; per-run latches reset in `startRun`.

### (iii-a) Post-run GoAway flap — trigger removed client-side
- Shared `useDiPostRunDisconnect.ts`, wired in all four packs: standalone path
  only (`weConnectedRef`); disconnects after submit + the closing cue actually
  **sent** (observed via the cue channel, tag-agnostic — `[DI_COMPLETE]` or a
  final `[DI_MOVE_ON]`) + its recap audio has risen and fallen; floor 7s
  (outlives the 6s deduped tail re-flush), ceiling 20s. Lesson mode untouched.
- **(iii-b) deferred** per the handoff's "if unsure, ship (iii-a) alone" —
  revisit only if a ledger still shows the flap after (iii-a).

### Fault injection (serves item 5 verification + item 8's acceptance gate)
- `backend/app/core/config.py`: `LUMINA_FAULT_MUTE_S` (default 0),
  `LUMINA_FAULT_MUTE_EPISODES` (default 1), `ENVIRONMENT` (default
  **production**). `backend/.env` now carries `ENVIRONMENT=dev` (arms nothing
  by itself).
- `lumina_tutor.py`: the FIRST cue-classified client text (`classify_cue(text)
  != "text"` — generic bracket-tag class, no DI semantics in the transport) of
  an eligible session arms an N-second mute: **model output only** (ai_audio /
  ai_transcription / ai_response dropped client-ward). `ai-transcript` is still
  written to the ledger during the mute — the ledger shows what Gemini SAID
  while the client heard nothing, which is the induced stall's diagnosable
  signature. Ledger events: `fault-mute-armed` (seconds, episode, trigger),
  `fault-mute-expired` (dropped count). One-shot per session; episodes counted
  per server process.

### Telemetry (diRunLog)
- New flags `session-dead` / `session-resumed`; emission cases for both kinds;
  cue phase `'dead'` → timeline kind `cue-dead`; new counters **`cuesDead`**,
  **`sessionDeads`**, **`sessionResumes`**. Stage lines: `stall-reconnect`
  (level 2), `stall` (level 3), `stall-retry` (card tap),
  `post-run-disconnect`.

## Verification (dev-first gate)

- **New suite** `hooks/useJudgedSpeechLoop.session-liveness.test.tsx` — 11
  tests: resume emission / no-cue-resend / disabled-swallow / mount-baseline;
  dead-cue count → session-dead at 2; re-emission on continued silence;
  audio-rise and tutor-text liveness clears (think-time false-trigger guard —
  the 35.9s-benign doctrine, pinned); resume clears the pending watch; disable
  stops the watch; cue-ledger independence of phase `'dead'`.
- **Fuzz extended** (`judgedLoopModel.fuzz.test.ts`): hook-only-kinds invariant
  now covers `session-resumed`/`session-dead` — the reducer stays untouched and
  fuzz-clean (the stall machinery lives in the hook's clocks, per the item-9
  tier-1 finding).
- Full vitest **1025/1025** (97 files). `typecheck:lumina` **0**. Full-tree tsc
  shows no errors in any touched file (803 legacy-graveyard errors unchanged).
  Backend `py_compile` clean on `lumina_tutor.py` + `config.py`.

## The confirmation drive (item 9 Tier 2's stall journey — or a manual run)

1. Backend `.env`: `ENVIRONMENT=dev`, `LUMINA_FAULT_MUTE_S=25`. Restart uvicorn.
2. Drive a di-math-facts standalone run. Expected: opener cue → 10s silence →
   `cue-dead` → 20s → `session-dead` → status "One moment—getting your tutor
   back…" → warm reconnect → `session_resumed` → same fact re-cued → the muted
   window has expired → run continues and **ENDS COHERENT** (episodes=1).
3. Repeat with `LUMINA_FAULT_MUTE_EPISODES=2`. Expected: the reconnected
   session's re-cue is muted too → second `session-dead` on the same item →
   **level-3 🔄 card** + `flushDiRunLog('stall')`; tap → third session is
   healthy → run completes.
4. **Item 8 acceptance:** reconstruct both episodes from persisted artifacts
   ALONE — server ledger (`fault-mute-armed`, `go-away`/`gemini-resume` if any,
   `ai-transcript` rows during the mute) + auto-flushed client run files
   (`cue-dead` events, `session-dead`/`stall-*` stage lines, `flushReason:
   "stall"`), joined by `client_run_id`. If that fails, item 8 REOPENS.
5. Check the ledger tail for the post-run GoAway flap — (iii-a) should have
   removed it; if it persists, un-defer (iii-b).
6. Save the artifacts under `qa/di-bench/` and replace this section with the
   evidence.

## Files touched

Client: `LuminaAIContext.tsx` · `hooks/judgedLoopModel.ts` (union only) ·
`hooks/useJudgedSpeechLoop.ts` · `direct-instruction/{diRunLog.ts,
useDiStallRecovery.ts (new), DiStallCard.tsx (new), useDiPostRunDisconnect.ts
(new), DiMathFacts.tsx, DiLetterSounds.tsx, DiWordReading.tsx,
DiSentenceReading.tsx}` · tests: `useJudgedSpeechLoop.session-liveness.test.tsx`
(new), `judgedLoopModel.fuzz.test.ts`.
Backend: `core/config.py` · `api/endpoints/lumina_tutor.py` · `.env` (local,
`ENVIRONMENT=dev`).

## Do-nots honored
No spoken-copy changes (re-cues resend `itemCue(item)` verbatim) · no mic
gating anywhere in recovery · no DI semantics in the transport (fault arming
keys off the generic bracket-tag class) · reducer untouched (fuzz-clean) ·
`silenceCloseMs`/turn gate untouched.
