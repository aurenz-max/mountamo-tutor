# HANDOFF — DI BACKLOG item 5: the mid-run STALL (dead session behind a silent "Listening…")

**Written `/pm` 2026-07-27, after a line-exact read of both sides** (backend resume loop +
client engine/pack). Executor: one dedicated slice — backend `lumina_tutor.py` +
`LuminaAIContext.tsx` + `useJudgedSpeechLoop.ts` + a small per-pack case. **Dev-first ruling
applies (user, 2026-07-27):** build + verify WITHOUT a human sitting — unit tests + the
fault-injection flag below; a mic run is confirmation, not the gate.

**The defect** (`qa/di-bench/run-2026-07-26-math-facts-stress-sitting.md` Finding 1 — the
family's first real-child run): from ~turn 15 the child kept answering — repeated
`activity_start`/`activity_end` pairs — with ZERO AI output and no verdict, forever. The
surface sat in silent "Listening…" with no recovery and no visible failure state. Lead
suspect (a): a GoAway/resume landed mid-attempt; the resume restored the *session* but
nothing re-cued the *DI item in flight*, so the pending verdict died with the old
connection. Suspect (b): generation wedged under the barge-in storm. Either way the
observed engine behavior is the same: no-verdict → resync → re-cue **into a dead session**,
which is not recovery. This is the largest child-facing defect in the family.

---

## 1. What the read established (do not re-derive)

**Backend (`backend/app/api/endpoints/lumina_tutor.py`) — transparent resume EXISTS and is
instrumented; it just doesn't restore the DI turn:**
- GoAway is caught at `:889-904`; the ledger stamps `go-away` with **`mid_turn`** +
  `pending_text`/`pending_audio` — item 5's suspect (a) is directly readable per session.
- The handler returns `'reconnect'` after sending the client `session_resuming`
  (`:1001-1007`); the drop/error path does the same when a handle exists (`:1015-1039`).
- The resume loop (`:1046-1147`): `MAX_RESUMES = 50` (`:1053`), reconnects with the rolling
  handle, sends the client **`session_resumed`** (`:1078-1082`), and on a stale handle
  **retries COLD** (`:1107-1120`) — a fresh conversation with the system prompt but NO
  history. Ledger events: `gemini-connected`, `gemini-resume`, `gemini-connect-failed`,
  `max-resumes`.
- Text/audio queues outlive connections (`:1084-1085` comment) — a cue queued mid-drop DOES
  send after resume. The loss class is specifically **the verdict in flight**, not the cue.
- `session_ended` is sent when resumes are exhausted (`:1154-1163`).

**Client context (`my-tutoring-app/src/contexts/LuminaAIContext.tsx`) — THE GAP:**
- `session_resuming` stops audio (`:370-375`); **`session_resumed` only clears two flags
  (`:376-380`) — no consumer-visible signal exists.** Packs and the engine cannot know a
  resume happened. This is the missing link for fix (i).
- A full client-socket reconnect is already warm: the rolling handle is stashed
  (`:365-369`) and passed in auth (`:534-537` standalone, `:642-645` lesson). So fix (ii)'s
  "reconnect" step is cheap: `ctx.disconnect()` + `ctx.connect(...)` resumes the same
  conversation.
- `sessionEnded`/`sessionEndedReason` state exists (`:216-217`, exposed `:969-970`).

**Engine (`hooks/useJudgedSpeechLoop.ts` + `judgedLoopModel.ts`) — ladder level 1 EXISTS:**
- `verdictTimeoutMs: 8000` → `no-verdict` miss; `resyncAfterMisses: 2` → `resync` emission
  (`judgedLoopModel.ts:66-71`, emission sites `:460/:481`). The pack re-cues on it.
- The hook owns everything a ladder needs: the cue path (`queueCue`/`sendCueNow`,
  `VERIFY_BEAT_MS`/`PENDING_CUE_MAX_WAIT_MS`/`TICK_MS` at `:41-45`), the tutor-audio fall
  edge (`:124-127`, `:275-284` via `ctx.isAudioPlaying`), the conversation feed
  (`:244-269`), and the cue diagnostics channel (`CueLogEvent`, `:58-64`).
- Fuzz result to respect (BACKLOG item 9 tier 1): **the reducers are clean; the stall lives
  ABOVE them** — build in the hook/pack/transport layers, not the reducer.

**Pack template (`DiMathFacts.tsx:542-554`)** — the `resync` case is the worked example of
"re-cue the current item", INCLUDING the beat-fight guard (mid-reward-beat, the next cue is
already queued by `applyVerdict`; re-cueing would fight it — commit the advance instead).
Any new "re-cue" behavior must reuse this branch's logic, not duplicate it naively.

---

## 2. The fix, three parts

### (i) Re-cue the active item after ANY resume — client-owned

The server must NOT do this: cues are hand-authored DI pedagogy and the transport is
generic (BACKLOG architecture block: "Shared Lumina owns only Live transport"). Chain:

1. **`LuminaAIContext`**: expose a resume signal — recommend a monotonically increasing
   **`sessionResumeCount`** bumped in the `session_resumed` branch (`:376-380`). A counter,
   not a callback: consumers effect-key on it, and a resume during unmount/remount isn't
   lost. Bump it for BOTH transparent server resumes and client-socket warm reconnects.
2. **`useJudgedSpeechLoop`**: watch the counter while `enabled`; on change emit a new
   emission through the existing `onEmission` channel — `{ kind: 'session-resumed' }`.
   Engine stays pedagogy-free; it does NOT auto-resend cue text.
3. **Packs (all four)**: handle `'session-resumed'` in the same switch as `'resync'` — the
   `DiMathFacts.tsx:542-554` branch is already correct for it (beat-fight guard + re-cue
   current item). In most packs this is a shared `case` fallthrough, ~2 lines each.

Bonus this buys: the backend's **cold retry** (`:1107-1120`) — where conversation history
is LOST — becomes safe for DI, because a re-cued `[DI_ITEM]` carries the full item contract
and the script needs no history. Note it in the slice report.

### (ii) Escalation ladder — engine-owned detection, pack-owned recovery + UI

**The liveness signal is cue→tutor-AUDIO, never cue→verdict.** The tutor always speaks
after a cue (model/guide/test lead-in — even `hard` cold reads say "Your turn. Read it.").
Child think-time is unbounded (35.9s observed, benign, in
`run-2026-07-27-math-facts-answer-fact.md`) — a cue→verdict watchdog would false-trigger
on every long think. Detection: after a cue `sent`, if NO tutor audio rise, NO
`ai_transcription`, and NO `ai_interrupted` arrives within `CUE_DEAD_MS` (~10s; hook-level
const beside `VERIFY_BEAT_MS`, promote to config only if a pack needs to differ), count one
dead cue. Ladder:

- **Level 1 (exists):** no-verdict ×2 → `resync` → pack re-cues.
- **Level 2 (new):** `DEAD_CUES` consecutive dead cues (recommend 2, i.e. ~20s of proven
  tutor silence while cues go out) → emit `{ kind: 'session-dead', deadCues: n }`. Pack
  responds: `ctx.disconnect()` + reconnect (warm via the stashed handle, `:534-537`) →
  `session_resumed` → part (i) re-cues automatically. The ladder CONVERGES on (i).
- **Level 3 (new):** reconnect failed (`sessionEnded` stays true / another `session-dead`
  within one item) → **visible state, never silent "Listening…"**: a pack-rendered card —
  kit frame, PRE-friendly since the tutor voice is dead and cannot read it aloud
  (picture-primary: big 🔄 tap target, minimal words) — whose tap re-runs
  connect-and-re-cue. Also call `flushDiRunLog('stall')` HERE so the artifact uploads at
  the moment of failure, not only at teardown.

Mic discipline: the ladder observes audio EDGES for liveness only — it must not gate or
close the mic (`feedback_spoken-mic-decoupled-from-tutor`, open-mic doctrine: no
force-mutes from the primitive).

### (iii) The run-complete GoAway flap — remove the trigger client-side

Observed watch-item: post-run, 4× GoAway→resume→instant re-GoAway until client disconnect.
Two moves, one required and one optional:

- **(iii-a, required, pack-side):** in the standalone tester path, disconnect the session
  once the run is truly over — after submit, the `[DI_COMPLETE]` recap audio has fallen,
  and the deduped tail flush has fired (the 07-27 run shows `[DI_COMPLETE]` cue-sent lands
  ~3s post-submit; the 6s tail re-flush already waits it out — sequence the disconnect
  after that). Lesson mode is untouched: the session outlives any one primitive there.
- **(iii-b, optional hardening, server-side, GENERIC):** in the resume loop, if a resumed
  connection receives a GoAway before ANY client input (text/audio/activity) has been sent
  since the resume, treat it as terminal — return `'stop'` → existing `session_ended` path
  (`:1154-1163`) → client reconnect state. This kills the flap for every Live surface with
  zero DI semantics. Do NOT implement by parsing `[DI_COMPLETE]` server-side — the ledger's
  bracket-tag classification is write-only telemetry; transport behavior must not branch on
  DI content. If unsure, ship (iii-a) alone; (ii) already recovers a mid-run flap.

---

## 3. Fault injection — how this verifies WITHOUT a sitting

Add a dev-only backend flag (env var, e.g. `LUMINA_FAULT_MUTE_S=20`): when set, the
response handler drops model output (audio + transcription forwarding) for the first N
seconds after the next cue-classified client text. Off in every normal path; refuses to
arm unless `settings` says dev. One flag serves TWO queue items:

- **Item 5:** drive a run (agent-driveable through the bench or item 9 Tier 2's headless
  student) with the mute armed → the ladder must fire level 2, reconnect, re-cue, and the
  run must END COHERENT. Repeat with reconnect also failing (second mute) → level 3 card.
- **Item 8's acceptance gate** ("a deliberately induced stall must be fully diagnosable
  from persisted artifacts alone"): the induced stall's ledger + auto-flushed run file must
  reconstruct the whole episode — `go-away`/`gemini-resume` stamps, dead cues in the
  `CueLogEvent` stream, `session-dead`, the flush. If they can't, item 8 reopens.

Unit layer: ladder + resume-signal tests belong beside the existing hook suites
(`useJudgedSpeechLoop.diagnostics.test.tsx` is the pattern; non-vacuity proven by reverting
the ladder). If `LoopEmission` gains kinds, **extend the item-9 fuzz event generator in the
same slice** (its own docblock demands it). Reducer stays untouched by preference — it is
fuzz-clean.

**What stays human (small, optional-timing):** HUMAN-CHECKS #56's ear-halves — how the
recovery FEELS at K (does the reconnect beat read as a hiccup or a break), and #55(e)'s
literal-silence route. With this slice + the fault flag, #56's diagnosability half is
machine-covered; update the row accordingly on close.

---

## 4. Do-nots (family rules that bound this slice)

- **No spoken-copy changes.** Cue scripts, judging contracts, correction lines are
  bench-proven and byte-frozen; a re-cue re-sends the existing `itemCue(item)` verbatim.
  A new cue WORDING would need a bench sitting (family rule) — this slice needs none.
- **No mic gating.** Open-mic doctrine holds; recovery must never force-mute.
- **No DI semantics in the transport.** `lumina_tutor.py` stays generic; anything that
  needs to know "which item is active" lives client-side.
- **Reducer purity.** The stall lives above the reducers (fuzz-proven); prefer
  hook/pack/transport changes.
- **`silenceCloseMs` and the turn gate are NOT this slice.** The 07-26 turn-gate fix is
  verified; do not touch `voiceTurnMachine` thresholds while fixing session liveness.

## 5. On close (same slice)

Strike BACKLOG item 5 (fold the GoAway rapid-resume watch-item into the strike — (iii)
resolves it or explicitly defers (iii-b)); note the fault flag on item 8's residual and on
item 9 Tier 2 (the headless student should arm it in its stall journey); update
HUMAN-CHECKS #56 (diagnosability half machine-covered; ears remain); WORKSTREAMS DI
"last touched" + next-pull (item 9 Tier 2 becomes top). Save the fault-injected run
artifacts under `qa/di-bench/` as the slice's runtime evidence.
