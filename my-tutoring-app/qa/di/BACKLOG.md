# Direct Instruction — Primitive Family Backlog

Working queue for the DI primitive family. Top = next. Graduated 2026-07-20 from
`qa/HANDOFF-di-bench-2026-07-16.md` per its own gate ("graduate to a BACKLOG file
if the bench passes") — the bench passed: open-mic run, probe run, hook-parity
run, engine-gate run all PASS (`qa/di-bench/run-2026-07-*.md`). User call
2026-07-20: DI becomes a **new primitive family** alongside core/math/literacy,
first set custom-made.

## Architecture (settled — do not re-litigate per item)

The engine stack is committed and runtime-verified; primitives are CONTENT PACKS
over it:

- `hooks/voiceTurnMachine.ts` + `hooks/useLiveVoiceTurns.ts` — open-mic turn
  authority (DI-2 dual barge-in threshold). Generic.
- `hooks/judgedLoopModel.ts` + `hooks/useJudgedSpeechLoop.ts` — live-judged
  call-response loop (voice-anchored attempts DI-1, arming DI-3,
  sentence-scoped sentinel verdicts, resync). Generic; sentinels parameterized.
- The Live tutor judges the AUDIO in-band per the cue's judging contract; the
  sentinel scan only reads which branch it took. Word-matching is the reporting
  channel, not the judge (proven: /s/ affirmed from audio over a "Shh." ASR).
- Bench (`di-bench` home card 🎯) stays the modality's measurement harness —
  every new response class benches there BEFORE a primitive wires it.

**"Custom-made" means:** cue scripts, judging contracts, sentinels, and
progression policy are HAND-AUTHORED per primitive (exact wording is the
pedagogy — DISTAR discipline). Item CONTENT is generator-scoped per objective:
curated speakable/picturable item menus injected into the prompt, attachments
made in code (rhyme-studio K pattern; scope-context contract). No
`DEFAULT_ITEMS`-style hardcoded content ships in a primitive.

**Registration:** new `primitives/direct-instruction/` family dir + new
`service/manifest/catalog/di.ts` catalog section. Entry through the normal
manifest/lesson path — catalog entries + eval modes, NO new launch surface
(lesson-entry principle). Response time captured silently; no visible timers.

## Standing gates (every DI primitive)

1. **Bench-first per response class:** a new class of expected spoken response
   (number words, blends, sight words…) gets a ~30-min bench sitting with a
   hand-rolled item list before any primitive wiring. Letter NAMES remain
   BLOCKED (LetterSpotter homophone ruling — needs a Voice Studio bench first).
2. **Sentinel-collision check:** the script contract ("never begin any other
   sentence with <affirm>/<correct>") must be re-verified per domain script —
   pick collision-free openers where the domain phrasing fights it (math tutors
   want to say "Yes!"). Engine sentinels are configurable per pack.
3. **Correction-opener directive:** the tutoring block must remind that EVERY
   correction begins with the correct sentinel (engine-gate run: model dropped
   "My turn:" on a re-correction).
4. Standard lifecycle: `/primitive` L0 birth + `/curriculum-fit` (every mode
   needs a curriculum home) + `/eval-test`; `/tutor-test` probe for the
   directive block. Open-mic doctrine holds: no force-mutes from the primitive.

## Queue

> **ORDERING RULING (user, 2026-08-01): PUSH DEVELOPMENT — supersedes the 07-27
> pull order below.** After two weeks of testing-heavy DI iteration the user
> wants sessions spending tokens on PLATFORM CAPABILITY, favoring work that does
> not require substantial testing (machine-gated ladder rungs, design slices,
> mechanical sweeps) over test-infrastructure builds and mic sittings. New pull
> order: **the family ladder** (di-math-facts L3 → di-letter-sounds L3 →
> di-word-reading L2 → di-sentence-reading L4 — all script/config-level,
> eval-test/tutor-test gated, zero sittings required; **di-math-facts L3 DONE
> 2026-08-01** — the delegated slice landed (script-composed fade + `supportTier`
> contextKey + the tester's new family tier selector; 14/14 new tests, 3/3
> real-pipeline probes; ear-check → HUMAN-CHECKS #50(d); report
> `qa/eval-reports/di-math-facts-support-tiers-2026-08-01.md`);
> **di-letter-sounds L3 DONE 2026-08-01** — third use of the template
> (`leadInFor` + `coldSoundGuard` composed in the script; per-mode composition
> verified — onset keeps the WORD in the ask while its sound withdraws, vowels
> keep the keyword while "short a" naming withdraws; catalog audit clean like
> math's, no rewording; 20 new tests with non-vacuity ×7, 3/3 real-pipeline
> probes incl. mixed-all-tiered; ear-check → HUMAN-CHECKS **#57**; report
> `qa/eval-reports/di-letter-sounds-support-tiers-2026-08-01.md`); the ladder
> still runs SERIALLY and `catalog/di.ts` is free again — **next rung =
> di-word-reading L2**) → **item 2**
> remediation-lever design (the misconception loop's consumption half — a real
> platform capability; gate = `/misconception-test`, automated) → ~~**item 8's
> flush sweep** (mechanical, pilot passed 3×)~~ **(DONE 2026-08-01, parallel
> lane — no file overlap with the L3 slice)** → **item 6** probe (backend-only).
> **Item 9 Tier 2 is DEMOTED from top pull but stays queued** as the absorber of
> item 5's residual runtime checks (the level-3 🔄 card via
> `LUMINA_FAULT_MUTE_EPISODES=2` + an end-coherent full run) — build it when a
> testing-capability slice is warranted again, not next.
>
> **FAULT-FLAG HYGIENE (user ruling, 2026-08-01: "we are making ticking time
> bombs").** `LUMINA_FAULT_MUTE_S=25` had been left in `backend/.env` and was
> silently sabotaging the first run of every backend boot. Defused + guarded
> the same day: the flag is gone from .env, and `lumina_tutor.py` now REFUSES
> to arm any fault flag that reaches settings without being in the PROCESS
> environment (pydantic loads .env without touching os.environ, so persistence
> is detectable) — it logs one loud ERROR naming the fix instead. Fault drives
> arm shell-scoped for one run only: `$env:LUMINA_FAULT_MUTE_S='25'; uvicorn
> app.main:app`. The rule generalizes: any dev/testing affordance must be
> impossible to leave armed — refuse persisted forms loudly, never rely on a
> human remembering to clean up.
>
> *(07-27 ruling, kept for the record — human sittings must not be the critical
> path; that half still stands. Its pull order — item 9 Tier 2 → flush sweep →
> item 6 → item 2 — is superseded above. Item 7 fixed 2026-07-27. Human rows
> (#56, the sentence sitting, #45) stay valuable but nothing waits on them —
> the ONLY code frozen on a sitting is the contrastive-correction port to
> di-letter-sounds/di-word-reading (#55, family rule; leave it last).)*

8. **FAMILY-WIDE + BACKEND: DIAGNOSIS-GRADE TELEMETRY — ~~TOP PULL~~ built +
   smoke-verified; residual = acceptance gate ONLY (rides a sitting or item 9
   Tier 2) — the 3-pack flush sweep DONE 2026-08-01. Original ruling
   2026-07-26 ("first, we need enough logging to actually diagnose, evaluate,
   and improve").** *(Executor: dedicated slice, before item 5's fix and before
   any further sittings.)* Third consecutive failure sitting whose FIRST finding
   was "the record can't support diagnosis": 07-25 decoherence (no record
   survived), 07-26 morning (took two sittings to make `belowMinVoice` visible),
   07-26 child run (no client JSON — panel not copied; server log untimestamped
   and truncated). Scope:
   - **(a) timestamps + session/turn ids on every backend log line** (logging
     format change, trivial);
   - **(b) a server-side structured per-session JSONL ledger** — the server twin
     of the client panel: cue sent/acked, activity signals, transcription events
     with ts, verdict-relevant turns, **GoAway/resume stamped with whether a cue
     or attempt was IN FLIGHT** (makes item 5's suspect (a) directly readable);
   - **(c) client run log AUTO-PERSISTS** — every run, saved without a human
     click (localStorage ring + auto-download or dev-endpoint POST at run end
     AND on disconnect/beforeunload). Copy-run-JSON stays as the convenience
     path, never the only path;
   - **(d) a correlation key stamped on BOTH sides** (session id + cue seq) so
     client `seq` joins server turns;
   **Acceptance gate: a deliberately induced stall must be fully diagnosable
   from persisted artifacts alone — no human memory, no lucky copy.**
   **BUILT 2026-07-26 (same session as the ruling) — needs one live sitting to
   close.** Shipped: (a) `main.py` basicConfig gains `force=True` — the
   timestamped format was ALREADY configured but was a no-op because
   `gemini.py`'s import-time `basicConfig` (no format) won the root-logger race;
   (b) `services/session_ledger.py` (write-only, never-throws) + full wiring in
   `lumina_tutor.py` → `logs/lumina-sessions/<ts>-<id>.jsonl`: auth/init,
   text-to-Gemini classified by bracket tag, activity signals, both transcript
   streams, turn start/end, barge-ins, **GoAway stamped with `mid_turn` +
   pending queue depths** (item 5's suspect (a) becomes directly readable),
   resume/connect-failed/max-resumes, client disconnect, session errors (the
   clock-skew class now lands in the ledger), final metrics; (c)
   `POST /api/di-run-logs` (token auth) → `logs/di-runs/*.json`; (d) client:
   `diRunLog` mints `meta.runId`, mirrors every run into a localStorage ring
   (last 5, throttled 1s), and `flushDiRunLog(reason)` auto-uploads — piloted in
   **DiMathFacts only** (run-end + teardown, deduped) per pilot-then-sweep; (e)
   correlation: `clientRunId` registry → `client_run_id` in BOTH LuminaAIContext
   auth sends → stamped into the ledger `session-init`. Gates: py_compile clean,
   `typecheck:lumina` 0, full vitest 1014/1014.
   **SMOKE-VERIFIED LIVE 2026-07-26, two user runs.** Run 1 (3/4): timestamps ✓,
   ledger narrative ✓ (180 events), zero-click upload ✓ — but `client_run_id:
   None`: the runId was minted at arm time, ~200ms AFTER the auth message left.
   Fixed same slice (pack registers the id BEFORE `ctx.connect`; `startDiRunLog`
   claims it, second-run collision guarded) + a deduped 6s tail re-flush (run 1's
   `cuesStalled: 1` was flush truncation — `[DI_COMPLETE]` lands ~3s after
   submit). Run 2 (4/4): ledger `session-init client_run_id = 4b9baa743d20` ===
   both run files' runId; tail file shows cues 6/6, stalled 0. **Remaining:** the
   acceptance gate rides the item-1 recipe sitting (induced-stall diagnosability
   via the last-item silence segment); ~~then sweep flush wiring to the other
   three packs (pilot passed)~~ **FLUSH SWEEP DONE 2026-08-01** — the pilot's
   four pieces replicated byte-for-byte from DiMathFacts into DiLetterSounds /
   DiWordReading / DiSentenceReading: pre-connect `setClientRunId(mintRunId())`
   (the correlation-race fix — the WS auth message must already carry the id),
   `run-end` flush + deduped 6s `run-end-tail` re-flush (fits under
   `useDiPostRunDisconnect`'s 7s floor), and `teardown` flush on unmount. The
   stall-moment flush was already family-wide via shared `useDiStallRecovery`.
   Gates: `typecheck:lumina` 0, full vitest 1041/1041. Runtime status,
   honestly: the pattern passed 3 live runs in DiMathFacts and this is
   mechanical replication, but no non-math pack has flushed live yet — the next
   live run of each pack is the free confirmation (its artifact lands in
   `logs/di-runs/` joined to the session ledger, or this reopens).
   **Update 2026-07-31 (item 5 slice): the
   acceptance gate is now MACHINE-COVERABLE — `LUMINA_FAULT_MUTE_S` induces the
   stall on demand (dev-gated), and the artifacts to reconstruct it all exist:
   ledger `fault-mute-armed`/`go-away`/`gemini-resume` stamps + still-ledgered
   `ai-transcript` during the mute, client `cue-dead` events, `session-dead` /
   `stall-reconnect` / `stall` stage lines, and the NEW `flushDiRunLog('stall')`
   at the failure moment. Drive it via item 9 Tier 2's stall journey (or #56);
   if the episode can't be reconstructed from persisted files alone, this item
   reopens.**
1. **FAMILY-WIDE: SUSTAINED-MISS DECOHERENCE — CLOSED 2026-07-26** (root cause
   = turn gate, fixed, fix verified live, and the full recipe run re-driven
   COHERENT the same day — see the strike at the bottom of this item; residual
   = S1 console confirm + the 90s silence micro-run). *(opened 2026-07-25 from
   the user's first deliberately-wrong mic sitting; diagnosed 2026-07-26.)*
   **DIAGNOSED — none of the four hypotheses below; the channel was the voice
   turn GATE.** `minVoiceMs: 120` silently meant "three 85ms capture frames", so
   a two-frame one-word answer ("five") was rejected as a blip while its audio
   had already gone to Gemini → the judge affirmed → `unanchored-verdict` →
   dropped → desync. Exposure = the single-word response class (three of four
   packs). Full mechanism, why the bench never caught it (3 coin-flip turns at
   ~50ms margin), and fixes (framePeriodMs plumbed → `voicedMs`; retro-anchor
   inside 4s; belowMinVoice observability + cue ledger — all engine-level):
   `qa/di-bench/run-2026-07-26-math-facts-turn-gate.md`.
   **FIX VERIFIED LIVE 2026-07-26** (`run-2026-07-26-math-facts-turn-gate-verify.md`
   + JSON): coherent `fact_review` run, all four predicted numbers hit
   (unanchored 0 / retroAnchored 0 / voiced 165–254ms on one-word answers /
   move-on flagged), and **hypothesis (a) is retired — `[DI_MOVE_ON]` fired live
   for the first time in any pack and stayed coherent** through cap → cue held
   by audio → sent → recap. Contrastive correction (c) also held: two byte-identical
   filled contrasts, no drift, no marks spoken (#55 math half).
   **REMAINING — one capped item is not the sustained-miss stress:** re-drive the
   #50 recipe proper (wrong on MOST items, SAME rule, session mean < 60) to (i)
   stress resync-vs-re-elicitation (b) and rapid-retry unanchored (d) at
   MULTIPLE caps, and (ii) reach the S1 misconception live capture — the 07-26
   run's mean was 80, correctly below the write gate. Also still open from the
   turn-gate report: **watchdog** (no timeout on "item cued, nothing happened")
   and **`facts` in RUNTIME STATE** (the fabrication vector).
   **What happened:** the user drove `di-math-facts` answering with a consistent
   wrong rule (always the successor: `5 − 1` → "six"), per the #50 recipe. The
   run decohered. **No usable record survived**, which is itself the first
   finding.
   **✅ FIXED IN THE SAME SLICE — the packs were structurally blind to desync.**
   `diRunLog.ts` + `DiRunLogPanel.tsx` (new, shared by all four packs) give the
   primitive path bench parity. Before it, a pack handled 5 of the 8
   `LoopEmission` kinds and hit `default: return` on the three that MEAN
   decoherence — `attempt-superseded`, `phantom-transcript`, and
   `unanchored-verdict` (the canonical DI-1 signal) — and wired neither
   `onTutorText` nor `onVoiceTurnClose`, so **there was no record of what the
   tutor actually said** and none of the mic floors telemetry. The panel leads
   with a coherence row (superseded / phantom / unanchored / off-script /
   no-verdict) and has Copy-run-JSON mirroring the bench payload.
   Verified: `typecheck:lumina` 0; full vitest **997/997**; new
   `diRunLog.test.ts` 12/12 with **non-vacuity proven** (reverting the three
   captures fails 5). Logging is write-only — it cannot influence progression.
   **RULED OUT, do not re-chase:** the misconception slice that landed the same
   day. `awaitingJudgeTextRef` is pure record-keeping, cleared on `attempt-open`
   and on reset, and never gates progression; `off-script` is also handled
   correctly (returns, keeps listening).
   **LIVE HYPOTHESES, in order — all first-observation paths, which is why five
   all-correct sittings never surfaced this:**
   - **(a) `[DI_MOVE_ON]` at the correction cap.** A consistent wrong rule caps
     EVERY item, and move-on had never fired live in any pack. Now flagged
     `move-on` in the log.
   - **(b) resync fighting the tutor's own re-elicitation.** After 2 misses the
     engine emits `resync` and the pack re-cues, but the correction line already
     re-elicited in-band → two competing cues. Unit-covered, never observed live.
   - **(c) contrastive-correction fidelity (#55, UNBENCHED).** The tutor now
     fills a `⟨what they said⟩` slot; drift, editorialising, or speaking the
     `⟨ ⟩` marks would break sentinel classification → repeated off-script. The
     complete judging line is now captured via `verdict-text` + `onTutorText`,
     which is exactly where this shows.
   - **(d) unanchored verdicts under rapid retry** — previously invisible.
   **Cheap bisect available:** the `di-bench` math-facts probe (`kind: 'fact'`)
   has always been fully instrumented. Driving the same successor rule there
   separates an ENGINE fault (reproduces in the bench) from a PACK
   orchestration fault (bench clean, pack breaks) — the bench has no cue
   builders, reward beat, or advance scheduling.
   ~~**Next action: re-drive HUMAN-CHECKS #50 with the panel open and Copy run
   JSON**, save under `qa/di-bench/`, then triage by flag.~~ **Done 2026-07-26 —
   triage complete (see the status block above).** ~~Next action: the
   sustained-miss recipe run (mean < 60), same panel + Copy run JSON.~~
   **THE RECIPE RUN RAN 2026-07-26 EOD — COHERENT. Item 1's decoherence is
   CLOSED** (`qa/di-bench/run-2026-07-26-math-facts-sustained-miss.md`): all 5
   items capped, **5× `[DI_MOVE_ON]`**, 15 contrastive corrections all
   byte-template (#55 c/d-math at scale), 1 benign supersession absorbed, 0
   unanchored/phantom/no-verdict/stalled, no GoAway, no stall — under the exact
   conditions that decohered 07-25. Learner ran the ECHO rule 5/5 consistent
   (mean 0 → S1 gate reached; ASR wrote "SeaWorld"/"cero" for a spoken "zero",
   judge named it right — judge-over-transcript confirmed a 2nd time).
   ~~**Residuals, one micro-run + one console line:** (i) user to confirm the
   `[captureMisconception]` console result (stored/abstained);~~ **(i) CONFIRMED
   2026-07-26 — S1 CLOSED, the loop's FIRST LIVE CAPTURE:** `stored for
   di-math-facts: "The student identifies the answer to a subtraction fact as
   the second number in the expression."` — correct on all 5 items, bounded
   (subtraction-scoped, no overreach), generative (predicts unseen items), and
   distilled from Tier-A judge sentences over garbage ASR. A real active
   misconception now sits in Firestore under `misconceptionKey: "di-math-facts"`
   — **item 2's consumption design now has live data.** Remaining: (ii) the 90s
   SILENCE run (answer nothing on item 1) → no-verdict→resync live, #55(e)
   fallback, and item 8's induced-stall acceptance gate.
5. ~~**FAMILY-WIDE: mid-run STALL — no verdict ever arrives and the primitive
   dead-ends in silent "Listening…" (the first real-child run's biggest break).**~~
   **BUILT + UNIT-VERIFIED 2026-07-31; LEVEL-2 RECOVERY RUNTIME-CONFIRMED
   2026-08-01 (user fault drive, `LUMINA_FAULT_MUTE_S=25`):** dead cues at
   exactly 10s/20s → `session-dead` → warm reconnect in **327ms** →
   `session-resumed` → the in-flight item re-cued verbatim → answer affirmed →
   run advanced. Artifacts reconstruct the whole episode from files alone
   (run `7f0a1543ff7c`: client teardown flush + server ledgers). Two bugs the
   drives caught, both fixed same slice: the OPENER never armed the dead-cue
   watch (stale-`enabled` at arm time — the ladder slept for the from-birth-dead
   session; arm is now unconditional, gate at fire time) and `sessionDeads`
   double-counted (flag→kind). **Remaining runtime = the level-3 card
   (`LUMINA_FAULT_MUTE_EPISODES=2`) + an end-coherent full run — fold into
   item 9 Tier 2's stall journey.** Slice report:
   `qa/di-bench/slice-2026-07-31-item5-stall-fix.md`. What shipped, per the
   handoff's three parts:
   - **(i) Re-cue after ANY resume, client-owned:** `LuminaAIContext` exposes
     **`sessionResumeCount`** (bumped in the ONE `session_resumed` branch —
     covers transparent server resumes AND warm client reconnects, since the
     auth-supplied handle makes the backend's first connect a resume too);
     `useJudgedSpeechLoop` watches it and emits **`{ kind: 'session-resumed' }`**;
     all four packs handle it as a shared case with `resync` (beat-fight guard
     preserved in math/sentence). Bonus banked: the backend's COLD retry
     (history lost) is now safe for DI — a re-cued `[DI_ITEM]` carries the full
     contract.
   - **(ii) Escalation ladder:** engine-owned detection — after a cue is SENT,
     no tutor audio rise AND no output text within `CUE_DEAD_MS` (10s) = one
     dead cue (cue channel phase `'dead'`); 2 consecutive → **`{ kind:
     'session-dead' }`**, re-emitting on continued silence so failed recovery
     escalates. Liveness is cue→tutor-AUDIO, never cue→verdict — 40s think-time
     is unit-pinned benign. Pack-owned recovery — shared `useDiStallRecovery`:
     level 2 = `ctx.reconnect()` **warm** (NOT disconnect()+connect(), which
     would destroy the mic — open-mic doctrine); level 3 (second death on one
     item / 12s grace with no resume signal — covers the cold-retry corner,
     which sends no `session_resumed` / `sessionEnded` mid-run) = shared
     **`DiStallCard`** (picture-primary 🔄, tap = reconnect-and-re-cue) +
     **`flushDiRunLog('stall')` at the failure moment**. The ladder converges
     on (i). Mic untouched everywhere.
   - **(iii-a) Post-run GoAway flap, pack-side:** shared `useDiPostRunDisconnect`
     — standalone path only (`weConnectedRef`), disconnects after submit + the
     closing cue actually SENT + its recap audio risen-and-fallen, floor 7s
     (outlives the 6s tail re-flush), ceiling 20s. Lesson mode untouched.
     **(iii-b) — server-side terminal-GoAway-before-input — explicitly
     DEFERRED** per the handoff's "if unsure, ship (iii-a) alone"; revisit only
     if the flap survives (iii-a) in a ledger.
   - **Fault injection (serves item 8's gate too):** `LUMINA_FAULT_MUTE_S` (+
     `LUMINA_FAULT_MUTE_EPISODES`, default 1) in backend settings — the FIRST
     cue-classified text of a session arms an N-second mute of MODEL OUTPUT
     only (audio/transcription/text dropped client-ward; `ai-transcript` still
     ledgered, so the ledger shows what Gemini said while the client heard
     nothing — the diagnosable asymmetry). Refuses to arm unless
     `ENVIRONMENT` says dev (new setting, default production; local `.env` now
     carries `ENVIRONMENT=dev`). EPISODES=1 → recovery's reconnect gets a
     healthy session (run must END COHERENT); =2 → the reconnect stalls too →
     level-3 card.
   - **Verified (dev-first):** new `useJudgedSpeechLoop.session-liveness.test.tsx`
     (11 tests: resume signal incl. disabled-swallow + no-cue-resend; dead-cue
     ladder incl. think-time false-trigger guard, liveness clears, re-emission,
     ledger independence); fuzz hook-only-kinds invariant extended
     (`session-resumed`/`session-dead` never from the reducer — reducer
     untouched, stays fuzz-clean); full vitest **1025/1025**;
     `typecheck:lumina` **0**; backend py_compile clean. **NOT yet exercised at
     runtime** — the fault-injected drive is the confirmation gate and lands
     with item 9 Tier 2 (its stall journey MUST arm the flag).
   *(original finding, kept as the trail: opened 2026-07-26 from the child
   stress run, `qa/di-bench/run-2026-07-26-math-facts-stress-sitting.md`
   Finding 1 — CORRECTED report: the earlier "fabricated contrast" defect was
   withdrawn, the child really said "three"; ASR wrote "Please".)*
   **📋 HANDOFF (executed 2026-07-31): `qa/HANDOFF-di-stall-fix-2026-07-27.md`** — paste-able,
   line-exact, written after reading both sides (backend resume loop + client
   engine/pack). It SUPERSEDES the verification note above per the dev-first
   ruling: build + verify via unit tests + a dev-only fault-injection flag
   (`LUMINA_FAULT_MUTE_S`, which also machine-covers item 8's induced-stall
   acceptance gate); a sitting is confirmation, not the gate. Key findings from
   the read: `session_resumed` is swallowed inside `LuminaAIContext` (`:376-380`,
   flags only — the missing link for re-cue-on-resume); the liveness signal must
   be cue→tutor-AUDIO, never cue→verdict (35.9s benign think observed 07-27);
   the `DiMathFacts.tsx:542` resync branch is the worked re-cue template incl.
   the beat-fight guard; recovery converges on the resume signal (ladder level 2
   reconnects warm via the stashed handle, then part (i) re-cues). From ~turn 15 the child kept answering — repeated
   `activity_start`/`activity_end` pairs — with ZERO AI output and no verdict;
   "Waiting for Gemini response (turn 16)" never satisfied; no recovery, no visible
   failure state. **Mechanism candidates (log truncated + untimestamped, can't pin):
   (a) GoAway/resume mid-attempt drops the in-flight turn and nothing re-cues the
   active item on resume** (Session A shows GoAways cycling ~50s with instant
   re-GoAway); **(b) generation wedged under the barge-in storm.** The no-verdict
   timeout → resync exists and likely fired (same-item re-cue observed) but re-cueing
   a dead session is not recovery. **Fix shape: (i) re-cue the active `[DI_ITEM]`
   after any resume; (ii) client escalation ladder — N re-cues with no tutor audio →
   reconnect + re-cue → still dead = visible "let's reconnect" state, never silent
   Listening…; (iii) the GoAway watch-item's "run complete, stop resuming" exit.**
9. **STOCHASTIC ADVERSARIAL STUDENT — make the child run repeatable (opened
   2026-07-26 from the user's design question: the loop must be robust to a kid
   who finds wrong answers funny).** Three tiers, different failure classes:
   - **Tier 1 — reducer fuzz — SHIPPED 2026-07-26, green.**
     `voiceTurnMachine.fuzz.test.ts` + `judgedLoopModel.fuzz.test.ts`: seeded
     mulberry32 PRNG (a failure names its seed+step and replays exactly), 120
     seeds × 250-300 random events per suite, invariants asserted every step.
     Load-bearing oracles: the voice open/close ledger (alternation, post-close
     state === IDLE, `voicedMs = durationMs + frame`, quantised-config variant)
     and the **attempt ledger** — every attempt opened is accounted for
     (superseded / resolved by a non-retro verdict / discarded by arm-disarm /
     still open); an attempt lost with no verdict is the stall class. Also
     pinned: disarmed loop is inert, resync pairs with its miss-verdict in-step,
     reducer never emits `verdict-text`, no negative timing fields. Runs in
     `npm test` (1014/1014). Found no violations in current code — the reducers
     are clean; the stall lives ABOVE them (transport/session), which is item
     5's territory. Extend the event generator when new emission kinds land.
     **Extended 2026-07-31 (item 5 slice):** `session-resumed`/`session-dead`
     joined `verdict-text` in the hook-only-kinds invariant — the reducer stays
     untouched and fuzz-clean; the ladder lives in the hook's clocks.
   - **Tier 2 — headless adversarial live student (item 5 shipped 2026-07-31 —
     THIS IS NOW TOP PULL). Its stall journey MUST arm `LUMINA_FAULT_MUTE_S`
     (+ a second journey with `LUMINA_FAULT_MUTE_EPISODES=2` for the level-3
     card path) — that drive is item 5's runtime confirmation AND item 8's
     acceptance-gate evidence.** Build
     ON `backend/tests/tutor_live/run_tutor_live.py` (user call 2026-07-26 —
     take inspiration from /tutor-test): it already authenticates on the real WS
     like LuminaAIContext, replays beats, captures per-beat transcripts, judges
     with code oracles, and scores rate-based over `--runs N`; add a DI journey
     family + audio/activity-signal student turns (the WS protocol already
     accepts both), reusing its taxonomy/triage. NOT a new harness — the
     tutor-live Tier-3 pattern driving the REAL judged loop, `--runs N`, with
     behavior policies drawn stochastically per turn: wrong-same-rule,
     wrong-random, silence through a test prompt, barge-in mid-model,
     answer-over-tutor-audio, rapid double answers, walk-away. Pass criterion is
     the liveness invariant (no state older than X s without escalation), NOT
     item scores. TTS input will not reproduce child ACOUSTICS — fine; this tier
     targets orchestration, not ASR.
   - **Tier 3 — periodic real-child sittings:** the only source of the
     child-acoustics class (ASR collapse, judge-over-transcript) and of genuine
     adversarial creativity. Keep them; with item 8 landed, each one
     automatically leaves a diagnosable record.
2. **FAMILY-WIDE: DI packs produce no REMEDIATION content from a stored
   misconception (S5).** *(opened 2026-07-25 by `/misconception-test di-math-facts`
   — executor: `/add-misconception-loop`, then re-run `/misconception-test` for a
   full-gate PASS.)* Item 2 below closed the PRODUCTION half: a wrong DI answer
   now yields a Tier-A packet and the distiller writes a real, bounded diagnosis
   from it (Probe D 10/10). The CONSUMPTION half is untouched — **no DI generator
   imports `buildRemediationPrompt`**, so an active misconception changes nothing
   about the next session and Probe G is **NOT-WIRED**.
   **This is a design question, not a missing import.** Every literacy/math
   primitive that consumes `remediationFocus` does it by rewording the generator
   prompt; DI's spoken copy is **bench-proven and byte-frozen** (do-not: "don't
   re-word any cue, judging contract, or correction line"). So the only honest
   lever here is **which items the pool draws** — e.g. a "counts up instead of
   back" diagnosis biases the subtraction pool toward take-away facts whose
   answer is NOT the successor, so the wrong rule visibly fails. Decide that
   lever before writing code; do not reach for prompt rewording by analogy with
   the literacy packs.
   Report: `qa/misconception/di-math-facts-2026-07-25.md`.
6. **Free-form DI attribution lands off-grade/off-family: K `fact_review` →
   `OPS002-04-c @ grade=2` (subject override ✓ MATHEMATICS).** *(opened 2026-07-26,
   stress-sitting report; #50(c) half-closed by the same evidence. Executor: probe
   `curriculum_retrieval_service` on the standalone free-form path — is the scope
   grade coming from student 1004's profile instead of the content, and is
   `fact_review`'s "across the whole grade range" evalModeDescription steering the
   embedding? Standalone-only exposure; lesson mode carries the objective's subskill.)*
   Birth-cert home is the OPS001 family (K OPS001-03 / G1 OPS001-01); the full data
   loop (calibration θ, mastery gate 0→2, XP) wrote against OPS002-04-c, so standalone
   DI sittings are calibrating the WRONG node.
7. ~~**Tutor WebSocket hard-fails on 1s clock skew.**~~ **FIXED 2026-07-27 (`/pm`
   session).** `clock_skew_seconds=10` passed at both scoped sites: the Lumina
   tutor WS auth (`lumina_tutor.py`, where the observed failure killed a live
   session) and the shared HTTP path (`auth.py` `verify_firebase_token`, which
   `require_auth` — incl. the DI run-log drop-box — rides). firebase-admin 6.9.0
   supports the param (≥6.4). py_compile clean. **Honest verification note:** the
   1s-skew condition cannot be reproduced on demand locally; this is the SDK's
   documented mitigation for exactly the logged error (`Token used too early,
   1785081560 < 1785081561`). Runtime evidence arrives free — the session ledger
   now records auth failures, so any recurrence would be visible in
   `logs/lumina-sessions/`. Other WS endpoints (gemini/education/practice/
   daily-briefing/core-utils) share the same class but were left untouched —
   out of the item's scope; sweep only if the ledger ever shows them failing.
   *(original finding: `Token used too early` → `InvalidIdTokenError` → session
   dead, client must reconnect; opened 2026-07-26, stress-sitting report.)*
3. ~~**FAMILY-WIDE: the wrong answer's CONTENT is discarded**~~ **DONE 2026-07-25 — STRUCK, see Done.**
   *(kept below for the reasoning trail.)* *(found 2026-07-25
   answering the user's "so you won't see an incorrect in the logs?" — executor:
   `/primitive` follow-up or a dedicated slice; all three packs, engine-adjacent
   but component-owned).* A miss IS recorded — `outcomes[]` carries
   `{correct, attempts, score}` and metrics carry `attemptsCount` /
   `firstTryCount` / `overallAccuracy`, so a wrong-then-right lands as
   `attempts: 2, score: 67` and a capped miss as `correct: false, score: 0`.
   **But WHAT the child said is thrown away.** The engine emits
   `attempt-transcript` with `text` (the heard answer); every DI component keeps
   only `emission.responseMs` and drops the text on the floor. So we can see
   THAT a child missed `5 - 1` twice, never that they said "four" both times —
   an off-by-one that is a textbook diagnosable misconception. This is exactly
   the input `project_misconception-loop` wants, and DI is the family best
   positioned to produce it (the tutor already judged the audio).
   **📋 HANDOFF: `qa/HANDOFF-di-misconception-evidence-2026-07-25.md`** — paste-able,
   line-exact, written after reading both sides. **It SUPERSEDES the fix shape
   stated below** (kept for the reasoning trail).
   *(superseded fix shape: "accumulate per-attempt `{text, judgment}` into the
   outcome and ship it in the evaluation payload's non-metric bag".)* The
   accumulation half is right; the destination is wrong — the non-metric bag
   (`studentWork`) is inert storage no consumer reads for diagnosis. The shipped
   channel is **`diagnosisEvidence`** (Misconception Loop S1,
   `evaluation/diagnosis/types.ts`), passed as `submitResult`'s 6th arg.
   **Two findings from the handoff read that change the job:**
   - **`catalog/di.ts` declares NO `misconceptionScope`,** so all four packs are
     invisible to the loop — `captureMisconception` gate 3 drops every DI
     submission before the distiller. Two gates must open: the declaration AND
     the packet. (Scope ruling + the `di-math-facts` cross-identity risk are
     worked in the handoff; recommendation is `'primitive'`.)
   - **The ENGINE discards the tutor's judging sentence too** — `judgedLoopModel.ts:252-255`
     computes `verdictText`, classifies it with `scanForSentinel`, and emits only
     the `judgment`. That sentence is what buys **Tier A** (`judgeFeedback`, the
     loop's highest-fidelity tier, written for exactly this family), and since
     contrastive correction it NAMES the error. One additive field.
   Template to copy, not design from scratch: `PhonicsBlender.tsx:540-566`
   (spoken, judge-driven, already Tier A). **Sequence this BEFORE the #54/#50/#55
   mic sitting** — that is the first deliberately-wrong DI run ever driven, and
   with this landed it yields recorded evidence instead of ears-only notes.
4. ~~**DI sentence reading — 4th pack.**~~ **BORN L0 2026-07-25 — STRUCK, see Done.**
   *(Kept below: the sitting's rulings, which are now the pack's design record and
   the input to its ladder. Standing gate 1 PASSED 2026-07-25, user mic sitting,
   "this worked so well!".)* 10/10 items, 10 affirmed / 3 corrected / **0
   off-script / 0 unanchored**. Report:
   `qa/di-bench/run-2026-07-25-sentence-reading-probe.md`.
   **What the sitting settled — carry ALL of it into `/primitive`:**
   - **(a) One-word errors ARE detectable: 2/2.** Deliberate OMISSIONS ("big"
     from a 6-word sentence, "red" from a 7-word) were both caught and
     corrected, both retries affirmed. Omission is the hardest class to hear —
     nothing wrong is said, something merely isn't. The pack is viable.
   - **(b) Whole-sentence correction is SETTLED — do not re-litigate.** The
     learner self-repaired the missing word on the FIRST retry both times.
     Word-targeted correction would buy nothing and costs the off-script risk of
     making the tutor fill a variable the script can't know.
   - **(c) Keep the restating affirm.** ~2-3s against a ~15-17s item cycle whose
     dominant term is learner think-time (8-11s). Tutor talk is not the
     bottleneck for connected text; the child reading is.
   - **SHIP-BLOCKING, cheap: `silenceCloseMs` must be raised for sentences.**
     Three "attempt superseded" events — a child reading connected text PAUSES
     mid-sentence, and the 500ms close (tuned for one-word answers) splits one
     read into two voice turns. It broke the alias cross-check (both alias
     disagreements in the run trace to this, NOT judge error) and nulled
     `responseMs` on second fragments. Pass ~1100ms via
     `useJudgedSpeechLoop({ voice: { config: { silenceCloseMs } } })`. **Do NOT
     change the family default** — 500ms is right for the three short-response
     packs.
   - **Scope: 3-8 words, no ceiling found.** The 8-word item read clean first
     try. Longer text is unbenched — don't let a generator exceed 8 until it is.
   - **Residual → HUMAN-CHECKS #53:** both deliberate errors landed on the 6-
     and 7-word items, so the SHORT end is unstressed, and item 1 ("The cat
     sat.") transcribed as "the car" yet affirmed — ASR artifact or false
     affirm, unresolved. A short sentence gives the judge less context to notice
     a swap, so it may be HARDER than the long ones.
   - Minor, family-wide: the opening turn added an unscripted greeting before
     the scripted "Listen:". `offScript: 0` didn't catch it (that counter
     classifies verdicts, not fidelity). Almost certainly present in all three
     shipped packs. Not a blocker.
   *(superseded — kept for the reasoning trail)* **PROBE WIRED 2026-07-25.** *(user call 2026-07-25:
   "can we turn read-aloud-studio into a DI-style primitive?" — yes, but as a
   FORK, see the ruling below.)*
   **Ruling — fork, do NOT convert `read-aloud-studio`.** It is a live catalog
   entry with 3 eval modes (`accuracy` β2.0 / `expression` β3.5 / `dialogue`
   β4.5), `supportsEvaluation: true`, and a row in the backend
   `problem_type_registry.py` — so the manifest can route to it today.
   Rewriting its modality in place would silently change what those three eval
   modes MEAN and invalidate their β calibration: the contract-first
   fork-on-conflict case. Instead, `di-sentence-reading` takes judged
   short-sentence accuracy at G1-2, and read-aloud-studio keeps the territory
   where self-assessment is defensible — longer passages, WPM tracking,
   expression/dialogue practice for older readers. Two primitives, one honest
   boundary; revisit read-aloud-studio's LOWER band only after the pack ships.
   **Probe now live in the bench** (`Sentence reading`, 10 items,
   `kind: 'sentence'`): length ladder 3→8 words, vocabulary carried from the
   word-reading probe so a failure is attributable to connected text rather
   than new words; one-word-error stress built in (hen/pen, hat/hut, had/has,
   and a repeated "we go" phrase where an omission is easy to produce). The
   sentence branch gets its OWN judging criteria — the generic "reasonably
   close for a kindergartener" is right for one short production and WRONG for
   connected text, where "close" rubber-stamps exactly the dropped/swapped word
   that reading fluency exists to catch. Verified: bench tests 22/22, tsc 0
   Lumina errors. **The sitting decides three things** (all named in the
   `SENTENCE_READING_PROBE_ITEMS` docblock): (a) can Live detect a ONE-WORD
   error inside a 5-8 word utterance — make-or-break; (b) does the safe
   whole-sentence correction hold, or does the pack need word-targeted
   correction and the off-script risk that carries; (c) does the restating
   affirm drag at sentence length.
   **Original framing, still the why:** `read-aloud-studio` already owns G1-6 fluency and its own
   catalog says **"Student self-assessment only, no AI speech grading" /
   "No AI grading of speech"** — it has a mic, records, tracks WPM, and judges
   nothing. A child cannot self-assess reading accuracy, so that primitive
   produces no real evidence for the IRT model. Converting connected-text
   fluency to a judged DI pack is the rung directly above di-word-reading
   (sound → word → sentence) and matches `feedback_production-modality-roadmap`.
   **Gated by standing gate 1:** connected text is a NEW response class — all
   three existing packs judge a SHORT response (one sound, one word, one number
   word), and judging a multi-word utterance brings partial credit,
   self-corrections, and pace. Needs its own ~30-min bench sitting before any
   wiring. Do NOT skip the bench because the mechanism looks familiar — the
   probe being wired is NOT the gate; the sitting is.

*(the ladder — the default pull once the numbered queue above is empty. Updated
`/pm` 2026-07-25 EOD; the prior note said "three packs at L0+" and was written
before di-sentence-reading existed.)*

**Family ladder state — four packs, all born, all L0 live-gated:**

| Pack | Born | L0 live gate | L1 modes | L2 scaffold | L3 tiers | Next rung |
|---|---|---|---|---|---|---|
| di-letter-sounds | 07-20 | ✅ 07-21 (#36) | ✅ 07-22 (3) | ✅ 07-23 | ✅ 08-01 | `/add-structural-difficulty` (L4) |
| di-word-reading | 07-22 | ✅ 07-23 (#43) | — (1 mode) | ✅ 08-03 | — | `/add-eval-modes` (L1 — the pack's own next rung; birth-cert candidates cvc_reading / sight_word / word_reading_review) |
| di-math-facts | 07-24 | ✅ 07-25 (#48) | ✅ 07-24 (4) | ✅ 07-25 | ✅ 08-01 | `/add-structural-difficulty` (L4) |
| di-sentence-reading | 07-25 | ✅ 07-25 (#54) | ✅ 07-25 (4) | ✅ 07-25 | ✅ 07-25 | `/add-structural-difficulty` (L4) |

~~**di-word-reading L2**~~ **DONE 2026-08-03** — the family is now ENTIRELY
catalog-resolved (no pack ships a script-local tutoring block). Added what L0
deferred: `{{challengeType}}` + 4 contextKeys (`challengeType`/`word`/`wordType`/
`words`), 5 observed `commonStruggles`, a generator flat `words` summary, the
component `updateContext` sync, and ONE new directive clause (the word list is
now visible in RUNTIME STATE, so the tutor is told never to preview a word that
is still coming). The handoff's 5th contextKey (`graphemes`/sound-out) was
dropped by design — absent on every sight word, derived rather than generated
(so it can never resolve at probe time), and already carried verbatim in the
`[DI_ITEM]` cue. Cue lines + `correctionLine` byte-untouched (#55 still gates the
contrastive port). Gates: typecheck:lumina 0, `npm test` 1286/1286, `/tutor-test`
Tier 1 **0 HIGH** (the family's 2 structural WARNs), **Tier 2 × 3 content shapes**
all keys resolved / zero `(not set)`; standing gates 2+3 re-verified mechanically
over the assembled prompt (37 sentences, 0 sentinel openers). Live glance (5
struggles → chattiness; the never-preview clause needs a run reaching item 2+)
rides the next DI sitting — not a new gate. Report
`qa/tutor-reports/di-word-reading-2026-08-03.md`.

Nearest rungs, in order: **di-sentence-reading L4**
(axis already built and measured — sentence LENGTH via
`wordCount`/`meanSentenceWords`; hard constraint: the **8-word benched ceiling
is NOT a difficulty knob**, raising it needs a bench sitting) ·
**di-letter-sounds L4** (item-set composition per its birth cert:
continuants-only → +short vowels → confusable contrasts m/n, f/v) ·
di-math-facts L4 (operand structure, per its birth cert).
~~di-math-facts L3~~ **DONE 2026-08-01**. ~~di-letter-sounds L3~~ **DONE
2026-08-01** (third template use; ear-check → #57; report
`qa/eval-reports/di-letter-sounds-support-tiers-2026-08-01.md`).

**Two family-wide debts sit ABOVE the ladder** and are why the numbered queue is
not empty: **item 1** (no remediation content from a stored misconception — the
consumption half of the loop, all four packs) and the **contrastive-correction
port** to di-letter-sounds + di-word-reading, which is gated on HUMAN-CHECKS #55
(the rewording is UNBENCHED until that sitting).
*(The prior first debt — the wrong answer's content being discarded — closed
2026-07-25; the packet now reaches the distiller and a real diagnosis comes back.
What is still missing is anything that USES it.)*

A **fifth pack** is a user phase call, not a queue default — the remaining
benched-class gap is **blends**. A "counting sequence" pack is no longer a
candidate at all: di-math-facts absorbed the next-number step as `counting_next`.

## Watch-items (from the engine-gate run)
- Resync + no-verdict timeout are unit-covered but not yet observed live —
  first primitive's live runs should try to trigger both. **Update 2026-07-26:
  the child stress run re-sent the same `[DI_ITEM]` (1+1) after ≥2 misses — the
  resync signature, LIKELY first live firing, but uninstrumented (no client run
  JSON); the item-1 recipe sitting confirms or denies.**
- ~~**(2026-07-26 stress run)** GoAway rapid-resume loop: post-run, 4×
  GoAway→resume→instant GoAway until client disconnect — no "run complete, stop
  resuming" exit in `lumina_tutor.py`. **Striking MID-run this is item 5's stall
  candidate (a)** — the fix rides that item.~~ **FOLDED INTO the item-5 strike
  2026-07-31:** the MID-run half is the shipped ladder; the POST-run flap's
  trigger is removed client-side by (iii-a) `useDiPostRunDisconnect` (standalone
  disconnects once the recap has played). **(iii-b) — server-side "resumed
  connection GoAways before ANY client input → terminal" — DEFERRED**; revisit
  only if a ledger still shows the flap after (iii-a). Watch the first
  fault-injected / #56 run's ledger tail for it.
- **(2026-07-26 stress run)** Session metrics counters count audio frames, not
  turns (`Turns: 28885` for a ~90s session) — fix before anyone charts them.
- **(2026-07-26 stress run — reading outcome data)** with a real child voice the
  ASR transcript is garbage ("Please" for a spoken "three", "sechs" for "six")
  while the in-band judge stays right — so `attempts` on a capped item are real
  answers even when transcripts read as noise, and NO channel that echoes ASR
  text (server log, panel `attempt-transcript`, misconception packet transcript
  field) is a trustworthy record of what a child said. The judge's own sentence
  (`verdict-text`/`judgeFeedback`, Tier A) is. Item 2's remediation design must
  lean on Tier A, never raw transcripts.
- Echo blip class: floors readout margin was ~6× in the hook-parity run; keep
  the floors readout available in primitive dev builds.
- **(2026-07-27 child-paced K run, `answer_fact`, runId `42279e964031`)**
  counting-up-aloud produces rapid supersession chains — 1+3 answered by counting
  "one → two → three → four" = 3 consecutive supersessions, and the engine absorbed
  all of them: intermediate count words were superseded BEFORE any verdict could
  bind, the final answer judged correctly (5 supersessions run-total, 0 unanchored).
  This is item 9 Tier-2's "rapid double answers" behavior class, first observed
  live, benign — keep it in the Tier-2 policy list as a REGRESSION check, not a new
  build item. Same run: third clean zero-click auto-persist for the item-8 pilot
  (tail flush captured `[DI_COMPLETE]`, cuesStalled 0) and three live firings of
  the plain correction FALLBACK, byte-stable → #55(e) half-closed.
  Report: `qa/di-bench/run-2026-07-27-math-facts-answer-fact.md`.

## Done
- **FAMILY-WIDE: the wrong answer now feeds the misconception loop (2026-07-25,
  queue item 1 struck).** All four packs. A DI miss used to produce
  `{correct: false, score: 0}` and nothing else; it now produces a **Tier-A
  `DiagnosisEvidence` packet** — what the child said, what the tutor said about
  it, and the earlier misses as `priorAttempts`. Executed per
  `qa/HANDOFF-di-misconception-evidence-2026-07-25.md`; the handoff's ruling held
  (the destination is `diagnosisEvidence`, submitResult's **6th** arg, NOT the
  inert non-metric bag).
  **THE HANDOFF'S STEP 1 WAS NOT SUFFICIENT, and the gap is the finding worth
  keeping.** It said to add `verdictText` to the verdict emission and populate it
  from the string the reducer already computes. Correct as far as it goes — but
  the reducer classifies from the sentinel **opener** and fires immediately (by
  design: progression must not wait on a sentence), while Gemini forwards
  `output_transcription` in **sub-word chunks** (which is why `couldBecomeOpener`
  exists at all). So `verdictText` is truncated at "My turn" — and for a
  contrastive correction the opener is precisely the part carrying **no
  diagnosis**; "not one — two plus one is three" arrives after it. Shipping that
  as `judgeFeedback` would have produced a Tier-A packet that names nothing,
  which is **worse than honest Tier B**. Fixed with a second, additive emission:
  `useJudgedSpeechLoop` keeps accumulating past the verdict and emits
  **`verdict-text`** when the line completes (audio falls, or the learner answers
  over it). Reducer untouched; one place, not four.
  **Two runtime details that only a test caught:** transcription chunks carry
  their own leading whitespace, so the accumulator concatenates WITHOUT a
  separator (joining with a space fabricates "My turn : not one"); and a capped
  correction on the FINAL item submits synchronously, mid-sentence, so the
  headline packet falls back to the fullest line captured for the **same item**
  (exact `challenge` match, never a heuristic on the text).
  **Scope ruling recorded: `misconceptionScope: 'primitive'` on all four packs**
  (module docblock in `catalog/di.ts` carries the full reasoning + the accepted
  risk). The `di-math-facts` cross-identity leak is real — 4 task identities, one
  key, and "counts up instead of back" is CORRECT on `counting_next` — and the
  mitigation is shipped, not deferred: each pack names its task identity inside
  `challengeSummary`. **Probe D confirmed it works at the sentence level:** both
  draws came back bounded ("treats *subtraction by one* as addition by one"),
  never the unbounded "the student counts up". Escalation if it ever fails stays
  a PRD amendment (identity += eval-mode family), NOT flipping DI to `'skill'`.
  Verified: `typecheck:lumina` **0**; vitest **985/985** (was 964; the engine
  suite and `diCorrectionContrast` 15/15 both stayed green); backend round-trip
  **9/9** with a new DI scope case; `/misconception-test di-math-facts` —
  **Probe D 10/10 draws** (3 GENERATIVE + 2 ABSTAINED, 0 LEAK, 0 OVERREACH, every
  packet at `tier=judge`), **Probe R CLOSED**, **S4 Firestore exposure pass**
  (`misconceptionKey: "di-math-facts"`). Non-vacuity proven twice: reverting the
  engine field drops the tier to `structured`, and reverting the same-item
  fallback leaves the headline as the bare "My turn" opener.
  **Gate is PARTIAL, deliberately: Probe G is NOT-WIRED → new queue item 1.**
  **S1 live capture stays browser-owned → HUMAN-CHECKS #54/#50/#55**, which is
  the first deliberately-wrong DI sitting and now yields RECORDED evidence.
  Report: `qa/misconception/di-math-facts-2026-07-25.md`.
- **Contrastive correction — di-sentence-reading + di-math-facts (2026-07-25, user
  ruling; MVP scope, audio only).** The first live correction run in ANY DI pack
  (#54 sitting) overturned the sentence pack's bench finding (b): a reader read
  "Mom got THE pot" for "Mom got a pot" **three times** against an identical
  whole-sentence re-model. A re-model asks the learner to diff it against their
  memory of what they just said — they never learn WHICH word was wrong. The
  bench's evidence for (b) was n=2 and both were OMISSIONS the learner
  self-repaired on the first retry; a SUBSTITUTION with no self-repair was never
  observed. **User ruling: name the error and contrast it, verbally only — no
  screen change.**
  **The sitting's stated blocker did not survive inspection.** It called
  word-targeting "a direct threat to the sentinel discipline"; sentinel
  classification matches **OPENERS only** (`matchesOpener`, `judgedLoopModel.ts`),
  so a mid-line slot cannot reach it. The residual risk is "speak exactly"
  fidelity alone — which is what #55 measures.
  **Shape (both packs, one pattern):** `correctionLine` survives **byte-for-byte**
  as the fallback for a miss with nothing to contrast (silence / unintelligible /
  no number), and a new `contrastCorrectionLine` is preferred whenever the miss is
  localisable — `My turn: not ⟨what they said⟩ — <correct form> Your turn. <ask>`.
  `⟨…⟩` is a slot the tutor fills from the audio it already judged (it heard the
  error; it is not inferring anything new). Opener unchanged, so zero engine
  change. Ends on the CORRECT form (recency) before re-eliciting, keeping standing
  gate 3. The judging contract now routes three ways (contrast / fallback /
  affirm), forbids drifting to a third wording on a repeat miss, and tells the
  tutor never to speak the ⟨ ⟩ marks. Math also carries the **echo misconception**
  the user named — answering "2 + 1" with "one", the last number heard — in the
  contract and as a 5th catalog `commonStruggle`.
  Verified: `typecheck:lumina` **0**; full vitest **964/964**; new
  `diCorrectionContrast.test.ts` **15/15** pinning the load-bearing invariant —
  both packs' contrast lines, **filled and unfilled**, still `scanForSentinel` →
  `corrected`, exactly one slot each, and the bench-proven fallbacks byte-identical.
  **UNBENCHED — the family rule is "do not re-word without a new sitting"
  → HUMAN-CHECKS #55, which rides the same mic run as #54/#50(a).** The same
  whole-sentence re-model is still in di-letter-sounds and di-word-reading; port
  it there only after #55 confirms the fidelity risk is acceptable.
- **di-sentence-reading L3 support tiers (2026-07-25, birth-cert follow-up #3
  struck) — the pack reached L0→L1→L2→L3 on its birth day.** The pack fits NONE
  of the skill's six archetypes (live-judged spoken production, where the Live
  tutor IS the interaction surface) and has **zero `showOptions`**, so the whole
  ladder is modality #2 instruction-as-scaffold — the AngleWorkshop case. The
  sub-steps were already there: **DISTAR's model→guide→test IS a scaffold
  ladder.** easy = model+guide+test (the L0 shape) / medium = model+test (choral
  "Together" withdrawn) / hard = **cold read** ("Your turn. Read it." — the child
  decodes print never having heard it). Lives in the SCRIPT (`leadInFor`) as the
  birth cert specified, never a UI flag.
  **`hard` closes the answer-leak caveat the birth audit could not resolve:** the
  model line speaks the sentence before the child reads, which is legitimate DI
  instruction but leaves an ECHO ROUTE open; at hard the sentence never enters
  the block the tutor may speak, so no echo route survives.
  NEVER withdrawn at any tier: the printed sentence (the manipulable object), the
  correction's re-model (standing gate 3 — remediation is not scaffolding), the
  restating affirm (bench question (c)), and the judging contract (or tiers stop
  being comparable evidence).
  **Tutor second-channel hole found + fixed** (the tier gotcha, in this pack's
  idiom): L2's `scaffoldingLevels` level 1 said "Read the sentence once more,
  slowly" — at hard that reads aloud the very sentence the tier withheld. Fixed
  three ways: level 1 reworded (levels 2-3 safe, they are post-attempt), a
  per-item `coldReadGuard` in the cue, and `supportTier` added as a contextKey +
  threaded through connect and `updateContext`.
  **Deliberate departure:** NO `tierSection` injected into the generator prompt.
  Under Fork A the model's only job is picking sentence ids, so a tier line could
  only nudge it toward different SENTENCES = tier→content leakage, i.e.
  structural difficulty by the back door. The tier is 100% code-composed.
  Verified: typecheck:lumina 0; full tsc 0 Lumina-surface; vitest **949/949**
  (89 files); new suite `diSentenceReadingScript.support-tiers.test.ts` 13/13
  with **non-vacuity proven** (5 fail when the tier logic is reverted, incl. the
  key "hard NEVER puts the sentence in the spoken block"). **A bad assertion of
  mine was caught and corrected in QA:** diffing generated content across
  easy/med/hard to prove "a tier never changes the numbers" CANNOT work — a
  same-tier control returned three different sets, so the call itself is
  nondeterministic; the rule is established structurally instead. That control
  also **retires the L0 report's convergent-selection note** — L1's selection
  path introduced real run-to-run variety. Report:
  `qa/eval-reports/di-sentence-reading-support-tiers-2026-07-25.md`.
  Ladder next = `/add-structural-difficulty` (L4, now unblocked; axis =
  sentence LENGTH, already carried as `wordCount`/`meanSentenceWords` — and the
  8-word benched ceiling is NOT a difficulty knob).
- **di-sentence-reading L2 tutoring scaffold (2026-07-25, birth-cert follow-up
  #2 struck) — the pack reached L0 → live → L1 → live → L2 in a single day.**
  The pack is the family's exception: it already shipped its catalog `tutoring:`
  block AT BIRTH (di-letter-sounds' L2 slice had built the family lesson-mode
  wiring, so putting it there cost nothing and made lesson mode work day one).
  L2 therefore added precisely what birth left out: `contextKeys`
  (challengeType/text/wordCount/sentences), the **`{{challengeType}}` placeholder
  those keys make safe** (an unfilled `{{key}}` renders SILENTLY, so it could not
  ship before its key), 5 `commonStruggles` describing behaviour actually
  observed in the bench sitting + two live runs, a generator `sentences` flat
  summary (RUNTIME STATE populated from the first auth-time prompt), and a
  component `updateContext` effect (silent channel — never perturbs the judged
  loop). Bench-proven `aiDirectives` + cue lines + judging contract untouched,
  byte for byte; sentinel discipline re-checked on all new copy.
  **Sibling difference recorded:** di-math-facts deliberately keeps its ANSWER
  out of RUNTIME STATE; that reasoning does NOT transfer here, because the
  printed sentence is stimulus and target both — the tutor must have it to model
  it and the child is already looking at it. No key is withheld.
  Verified: typecheck:lumina 0; vitest 936/936; `/tutor-test` **0 HIGH** — 2
  WARNs that are the DI family's SHAPE (`data-bag-unparsed`: DI connects via
  `ctx.connect`/`updateContext`, not a parseable `useLuminaAI` bag;
  `no-sendtext-moments`: DI cues ride `[DI_ITEM]`/`[DI_MOVE_ON]`/`[DI_COMPLETE]`
  so the tutor structurally cannot go silent) — the identical pair both siblings
  carry. Tier-2 probe on THREE modes: `probe.findings: []` every run, all four
  keys real and mode-correct, and the `sentences` summary tracks the pinned
  mode's pool (proof L1 and L2 did not drift). The 5 `(not set)` strings in the
  response are confined to `staticPromptPreview`, which by construction has no
  generated content — verified by walking every string field.
  **Tier 3 rides HUMAN-CHECKS #54** (no new gate): three of the five struggles
  only fire on a MISS, so #54's deliberately-wrong read exercises them. Watch
  the named risk — 5 struggles could loosen a scripted tutor into chattiness
  (di-math-facts cleared this with 4). Report:
  `qa/tutor-reports/di-sentence-reading-2026-07-25.md`.
  Ladder next = `/add-support-tiers` (L3).
- **di-sentence-reading L1 eval-modes (2026-07-25, birth-cert follow-up #1
  struck) — the pack went L0 → live-verified → L1 in ONE day.** Full 4-mode
  ladder: `decodable_sentence` (β2.5, every content word sound-it-out — blending
  transferred to connected text) / `read_sentence` (β3.0, L0 unchanged) /
  `sentence_review` (β3.5, cumulative wide mix) / `sight_phrase_sentence` (β4.0,
  irregular high-frequency density — whole-word recall). **Standing gate 1
  satisfied with NO new bench sitting** (every mode is the same response class),
  and — unlike di-math-facts, which needed one type-aware line — this ladder
  shipped with **ZERO new spoken copy**: the L0 script was already phrased around
  `it.text`, so all four skills read through the bench-proven sentences byte for
  byte. What a mode changes is the POOL. **These are identities, not tiers:**
  `decodable_sentence` and `read_sentence` have different curriculum homes at
  different grades, and `decodable_sentence` gives the pack the **K home** the
  birth fit probe abstained on. Verified: typecheck:lumina 0; full tsc 0
  Lumina-surface errors; vitest 936/936; backend β rows mirror the catalog;
  real-Gemini eval-test **10/10 clean** with per-mode **POOL** assertions (not
  just type stamps — all four modes render identically, so the route's own
  validator passes trivially): sight mode serves only sight-heavy, decodable
  never serves an un-blendable sentence, decodable+short-a stays vowel-pure,
  sight correctly IGNORES the vowel scope, **mixed yields all four types**
  (SP-21). `/topic-trace` closed the routing path the tester structurally cannot
  reach (it always pins): a sight-word objective → `sight_phrase_sentence`
  end-to-end, **newly live** (with one mode the resolver short-circuited).
  **Found + fixed in QA: `sentence_review` never broadened past the focus** — a
  short-a review returned 4/4 short-a, i.e. the base mode relabelled, because
  the model's picks (drawn from the focused prompt menu) crowded out the wide
  pool. This is di-math-facts' `fact_review` bug in MIRROR IMAGE — theirs drew
  zero focus items and lost the thread; this drew nothing else and lost the
  breadth. Review now stops at its ≤2 anchors, back-fills shuffled from the whole
  menu, and rotates by vowel even under a pinned scope. Deferred by design: a
  longer-text rung (leaves the benched scope) and pace/expression
  (read-aloud-studio's territory; L0 judging refuses to judge speed). Report:
  `qa/eval-reports/di-sentence-reading-evalmodes-2026-07-25.md` + trace
  `qa/topic-traces/reading-sentences-with-sight-words-2026-07-25.md`.
  **L1 VERIFIED LIVE same day (user mic run on `sight_phrase_sentence`, "these
  are so good!") — HUMAN-CHECKS #54(c) struck.** 4/4 affirmed, all four sentences
  from the sight-heavy pool: the mode means at runtime what the catalog says, and
  the bench-proven cue lines carried a vocabulary (see/go/you/my/and) that no
  prior sitting had spoken — the last plausible place for the ladder to have
  disturbed proven speech. Post-affirmation reward emoji confirmed rendering.
  Ladder next = `/add-tutoring-scaffold` (L2 — note the tutoring block is
  already in the catalog, so L2's real work is contextKeys + commonStruggles +
  the RUNTIME STATE sync).
- **di-sentence-reading L0 LIVE GATE CLOSED (2026-07-25, user mic run — "it
  worked fantastically!") — born and runtime-verified the SAME DAY.** 4/4
  affirmed (The rat ran. / I see a pig. / The red hen ran. / The dog is hot.),
  session completed and submitted, recap all-emerald. Closes three things at
  once: the judged loop end-to-end through THIS component (its `applyVerdict` →
  `recordResult` → `advance` path and cue builders had never run with a real
  mic), **the reward beat at SENTENCE length** (the named pacing risk — the
  affirm restates the whole sentence, ~2-3s, well past what the 900ms/3.5s beat
  was tuned against; not flagged as dragging or clipping), and the one-sentence
  stage invariant. **Residuals, both quantitative → HUMAN-CHECKS #54:** (a) the
  `silenceCloseMs: 1100` fix has no numeric proof yet — the run did not visibly
  break, but 0-supersessions / non-null `responseMs` / `aliasMatch` live in the
  `[DI eval]` console payload, not the UI; (b) the SHORT end (#53) and the
  correction branch stayed dark — **fourth consecutive all-correct DI sitting**,
  and `[DI_MOVE_ON]` has still never fired in any pack (note the difference from
  math-facts: the sentence correction WORDING is bench-proven, 3 corrections
  incl. 2 deliberate omissions; it is the COMPONENT's retry/cap path that is
  untested). Report: `qa/eval-reports/di-sentence-reading-live-2026-07-25.md`.
- **#2 di-sentence-reading — BORN L0 (2026-07-25). Fourth DI pack, and the
  family's first CONNECTED TEXT pack.** Separate content pack over the committed
  engine; sibling packs byte-untouched, NO `hooks/` change.
  `DiSentenceReading.tsx` + hand-authored `diSentenceReadingScript.ts` (every
  spoken line **byte-for-byte** the bench's proven `kind:'sentence'` branch) +
  `gemini-di-sentence-reading.ts` (Fork A: 37-sentence code-owned decodable menu,
  Gemini enum-selects ids + wrapper only; vocabulary carried from the
  word-reading menu so a miss is attributable to connected text, not new words) +
  full registration (catalog `read_sentence` β3.0 + `audioInput` + the L0
  `tutoring:` block, `registerContextGenerator`, metrics union, primitiveRegistry,
  ComponentId, backend `problem_type_registry`, tester **Sentence Reading**
  picker + a per-pack `defaultGrade` so the tester stops sending kindergarten for
  every pack).
  **The ship-blocking bench finding landed in the same slice:** `silenceCloseMs`
  **1100ms** pack-level (a mid-sentence pause is part of one response); the
  family default stays 500ms for the three short-response packs.
  **All three sitting rulings honoured:** whole-sentence correction (no
  word-targeting), restating affirm kept, 3-8 word scope code-capped with a final
  filter after every other rule.
  Verified: `typecheck:lumina` **0**; full tsc **0 Lumina-surface errors** (805
  pre-existing, all in the legacy graveyard); vitest **936/936**; real-Gemini
  eval-test **PASS ×11** with every check programmatic (wordCount recomputed from
  text, benched ceiling, sentinel safety, wrapper leak, teaching order, vowel
  purity) — `qa/eval-reports/di-sentence-reading-2026-07-25.md`; curriculum-fit
  **MATCH ×2** (G1 `LA003-01` Oral Reading Accuracy 0.824 — whose top subskill
  *"self-correct reading miscues by re-reading"* is a near-verbatim statement of
  the judging contract; G2 `LA001-05` Reading Fluency 0.807, whose sibling
  subskills are read-aloud-studio's self-assessment territory — independent
  confirmation of the fork ruling) —
  `qa/curriculum-fit/di-sentence-reading-2026-07-25.md`. EVAL_TRACKER row added
  (362/379).
  **Found + fixed during QA:** phonics scope was vowel OVERLAP, not purity — a
  "short a" objective was being served "Sam has a red cup." (a/e/u). The pool now
  prefers sentences whose vowels are a SUBSET of the scope and widens only if
  pure cannot fill the session; all five vowels now serve pure sets.
  **One departure worth knowing:** the tutoring block ships in the CATALOG at
  birth (not the script, as the two older reading packs did) because
  di-letter-sounds' L2 slice already built the family lesson-mode wiring that
  resolves both connect paths from there — so lesson mode works on day one. L2
  still owns `contextKeys` / `commonStruggles` / the RUNTIME STATE sync.
  Birth cert + 6-layer queue: `qa/eval-reports/di-sentence-reading-birth.md`.
  **L0 gate NOT closed — the live loop has never been driven → HUMAN-CHECKS #54**,
  which carries five named stresses, headed by the `silenceCloseMs` fix's own
  proof (0 attempt-supersessions + non-null `responseMs` + `aliasMatch` true) and
  the unresolved SHORT-end residual #53.
- **di-math-facts L0 LIVE GATE CLOSED (2026-07-25, user mic run — "worked
  great!").** `subtraction_fact` / "subtraction within 5": **5/5 affirmed** +
  recap. One sitting closed three layers at once: the L0 judged loop end-to-end
  (no desync, stall, or phantom verdict), the reworked reward beat (pacing not
  flagged as dragging or clipping — the audio-edge design holds live), and the
  **first live run of the L2 catalog scaffold** — the tutor held the scripted
  lines across 5 items, so the 4 new `commonStruggles` did not loosen it into
  chattiness, which was the named risk of adding them. Also confirmed
  `subtraction_fact` cue wording + code-built `solvedDisplay` live (#49b).
  **The pack is now runtime-verified at L0+L1+L2.** HUMAN-CHECKS #48 struck.
  **Residual — third consecutive ALL-CORRECT sitting:** the correction branch,
  the homophone/over-affirmation stress, and the MATHEMATICS submit attribution
  all still need a deliberately WRONG answer → new HUMAN-CHECKS **#50**.
  Report: `qa/eval-reports/di-math-facts-live-2026-07-25.md`.
- **di-math-facts reward beat — one fact on screen at a time (2026-07-25, user
  browser check; CONFIRMED live same day).** The stage was showing the NEXT problem while the LAST
  answer's equation sat in a chip below it — two facts at once, overload at K.
  Fixed in two halves: (1) the completed equation now REPLACES the printed
  problem in the big slot instead of stacking under it; (2) `advance()` is
  deferred to a reward beat instead of firing at verdict time. The beat is
  **edge-driven, not timed** — the engine already sends the next `[DI_ITEM]` cue
  400ms after the tutor's audio falls (`VERIFY_BEAT_MS`), so the visual rides
  that same falling edge and the swap lands exactly when the tutor stops talking
  about this fact; a 900ms floor stops a clipped affirmation flashing past, a
  3s cap releases the stage if the edge never comes, and `attempt-open` /
  `resync` flush the beat so a resolved fact can never be up while the child
  answers the next one. `commitAdvance` bumps `idxRef` with the state (emissions
  fire inside the loop's dispatch, a render before React catches up). Applies to
  the capped-correction path too — `moveOnCue` CONTAINS the next fact's model
  line, so its swap belongs at the same edge. Verified: new jsdom suite
  `DiMathFacts.reward-beat.test.tsx` **6/6** (non-vacuity probed: reverting the
  deferred advance fails 2, reverting the in-place render fails a 3rd), full
  vitest **921/921**, tsc 0 Lumina errors. **The FEEL still needs the mic
  sitting — HUMAN-CHECKS #48 updated** (its old text described the removed
  behavior).
- **di-math-facts L2 tutoring scaffold (2026-07-25, birth-cert follow-up #2
  struck).** `DI_MATH_FACTS_TUTORING` moved from `diMathFactsScript.ts` into
  `catalog/di.ts` `tutoring:` — both connect paths now resolve it from the
  catalog (the shared family lesson-mode wiring from di-letter-sounds' L2 was
  already in place, so this pack needed no transport work). Cue lines and
  `judgingContract` untouched: the bench-proven wording is byte-identical.
  Added at this layer: `contextKeys` (challengeType/display/problem/facts —
  **stimulus side only**, the answer reaches the tutor inside the `[DI_ITEM]`
  contract, never RUNTIME STATE), 4 `commonStruggles`, and one NUMBER WORDS
  clause for the #48 homophone stress (a word that SOUNDS like the target
  number IS it — "won"/one, "too"/two, "for"/four, "ate"/eight; widened for
  homophones of the TARGET only). Component drops the local `tutoring:` arg and
  gains an `updateContext` effect (silent channel — never perturbs the judged
  loop); generator attaches the flat `facts` summary so RUNTIME STATE is
  populated from the first auth-time prompt. Verified: tsc 0 Lumina errors;
  `/tutor-test` **0 HIGH** (2 WARNs = the DI family's shape — `useLuminaAI`-bag
  parsing and `sendText` moments don't apply to a judged-loop cue path; same
  two as di-letter-sounds); Tier-2 probe on TWO modes shows all 4 keys
  populated with real values, no `(not set)`, no answer in RUNTIME STATE.
  Report: `qa/tutor-reports/di-math-facts-2026-07-25.md`. **Tier-3 rides
  HUMAN-CHECKS #48/#49** — the new struggle/homophone copy is exercised by the
  same sitting that drives the correction branch. Ladder next = `/add-support-tiers` (L3).
- **di-math-facts L1 eval-modes (2026-07-24, birth-cert follow-up #1 struck).**
  User chose the FULL birth-cert ladder — 4 identities: `counting_next` (β1.5),
  `answer_fact` (β2.0, L0 unchanged), `fact_review` (β2.5), `subtraction_fact`
  (β3.0). Standing gate 1 satisfied WITHOUT a new bench sitting: every mode
  answers with a spoken NUMBER WORD, the class benched in #46. The bench-proven
  L0 cue wording is byte-for-byte intact — the L0 lines were already phrased
  around `it.problem`, so all four skills read through the same proven sentences
  ("three minus one is two", "the number after five is six"); the only
  type-aware line is the counting DIRECTION in the judging contract (subtraction
  counts back, not up). Fork A held: code owns pools/answers/aliases and stamps
  `challengeType`. New code-built `solvedDisplay` field so the post-affirmation
  reward is correct per skill ("5 → 6", not "5 → ? = 6"). Verified: real-Gemini
  eval-test **PASS ×8** (4 pinned single-type + mixed = all-four interleave
  (SP-21) + curated blend), **40/40 challenges recomputed correct**, and
  `/topic-trace` on a real K subtraction topic routed manifest →
  **`subtraction_fact`** end-to-end (intent routing was newly live — with one
  mode it could never fire); typecheck:lumina 0; vitest 915/915. Caught + closed
  in the run: `fact_review` on a doubles objective drew ZERO doubles (anchors
  only applied to explicitly named facts) — now anchors ≤2 items from the
  focused pool for any scope. **The 3 new modes' cue wording is UNVERIFIED live
  → HUMAN-CHECKS #49** (fold into #48, one sitting). Report:
  `qa/eval-reports/di-math-facts-evalmodes-2026-07-24.md`. Deferred by design:
  G3 `multiplication_fact` (needs its own curriculum-fit probe + grade gate) and
  missing-addend (L4). Ladder next = `/add-tutoring-scaffold` (L2).
- **#3 di-math-facts — BORN L0 (2026-07-24).** Third DI pack, first MATH pack —
  separate content pack over the committed engine, sibling files untouched, NO
  hooks/ change. `DiMathFacts.tsx` + hand-authored `diMathFactsScript.ts`
  (BENCH-PROVEN cue wording from the #46 probe; permissive on th-fronting +
  counting-up, STRICT on a different number; sentinels = engine defaults,
  collision-checked) + `gemini-di-math-facts.ts` (Fork A: code-owned fact pool,
  scope code-enforced named→make-10→doubles→within-N→grade default K=5/G1=10;
  Gemini wrapper-only with digit/number-word leak-guard on title/description)
  + registrations (catalog/di.ts `answer_fact` β2.0 + audioInput, diGenerators
  registerContextGenerator, metrics union + `meanResponseMs` silent fluency
  signal, primitiveRegistry, ComponentId, backend problem_type_registry,
  tester Math Facts picker). **Family REVISIT closed: `subject_for_primitive`
  per-primitive override (di-math-facts → MATHEMATICS)** wired through
  retrieval matcher + mapping service + submission_service (both the
  use_retrieval gate AND resolve_by_retrieval — the second one mattered).
  Answer-leak rule: sum gated behind affirmation everywhere (stage equation
  reward, recap, generator title guard). Verified: typecheck:lumina 0; vitest
  915/915; backend pytest identical to HEAD baseline (10 pre-existing
  failures, 0 new); real-Gemini eval-test PASS 6/6 scope matrix,
  programmatically recomputed (`qa/eval-reports/di-math-facts-2026-07-24.md`);
  curriculum-fit **MATCH ×2** (K OPS001-03 fluency-within-5 0.785; G1
  OPS001-01 addition-within-10 0.830; `qa/curriculum-fit/di-math-facts-2026-07-24.md`).
  Birth cert + follow-up queue: `qa/eval-reports/di-math-facts-birth.md`.
  **Live loop NOT yet driven — HUMAN-CHECKS #48 is the real L0 gate**
  (correction branch never heard live + #46's homophone stress + MATHEMATICS
  attribution as the subject-override runtime check).
- **di-letter-sounds L2 tutoring scaffold + FAMILY lesson-mode wiring (2026-07-23,
  birth-cert follow-up #2 struck).** DI tutoring block moved from
  `diLetterSoundsScript.ts` into `catalog/di.ts` `tutoring:` (single source of
  truth; +contextKeys challengeType/letter/keyword/letters, +3 commonStruggles
  from birth QA; sentinel-collision re-checked on the new copy). The two carried
  L0 gaps CLOSED for the whole family: (a) **lesson-mode connect** — new
  `ComponentDefinition.audioInput` (types.ts); both DI packs declare
  `{ manual_activity: true }`; `connectLesson` scans the manifest and opens the
  shared Gemini session with it (audio config is connect-time-fixed);
  `switch_primitive` carries `tutoring` + `audio_input`; standalone `connect`
  falls back to the catalog for both — DiLetterSounds dropped its explicit
  passes. Subskill carry comes free in lesson mode (ManifestOrderRenderer
  injection → usePrimitiveEvaluation), ending the 07-21 Gemini re-map watch-item.
  (b) **`subject_for_domain('di') → LANGUAGE_ARTS`** in the retrieval matcher
  (REVISIT at di-math-facts birth — family will span subjects). Generator grew a
  flat `letters` summary field so the auth-time prompt resolves; component syncs
  per-item RUNTIME STATE via silent `updateContext`. Verified: typecheck:lumina 0;
  tutor-test Tier 1 PASS (0 HIGH; 2 WARNs structural to the engine pattern) +
  Tier 2 probe PASS (0 `(not set)`): `qa/tutor-reports/di-letter-sounds-2026-07-23.md`.
  **Live lesson-mode loop NOT driven → HUMAN-CHECKS #45** (incl. the named
  trade-off: a DI-bearing lesson runs manual VAD session-wide, so non-DI chat
  turns in a MIXED lesson won't open). di-word-reading's own catalog `tutoring:`
  move stays its L2 item; the shared wiring is already in place for it.
- **#2 di-word-reading — BORN L0 (2026-07-22).** Second DI pack over the
  committed engine — separate content pack, letter-sounds files untouched, NO
  hooks/ change. `DiWordReading.tsx` + hand-authored `diWordReadingScript.ts`
  (DISTAR two-branch cues: CVC sound-out "sss-aaa-mmm… sam" / sight whole-word;
  STRICT near-neighbour judging contract) + `gemini-di-word-reading.ts` (Fork A:
  30-CVC-by-vowel + 8-sight menu in code, Gemini enum-selects words,
  graphemes/emoji/aliases attached in code, vowel + sight scope CODE-enforced) +
  registrations (catalog/di.ts single `read_word` mode β2.5, diGenerators,
  metrics union, primitiveRegistry, ComponentId, backend problem_type_registry)
  + direct-instruction-tester grew a **Letter Sounds ⇄ Word Reading primitive
  picker** (no cloned tester). Answer-leak rule inverted vs letter-sounds
  honored: printed word ONLY before the read; emoji = post-affirmation reward.
  Sentinel note: handoff §4's classic "My turn." model opener re-worded to
  "I'll sound it out…" (collision with the correction sentinel). **Standing
  gate 1 (bench sitting #41) WAIVED by user ruling 2026-07-22** — near-neighbour
  stress folded into the live-loop check. typecheck:lumina 0; eval-test PASS ×4
  (named words honored / generic → CVC spread + 1 sight / sight-scoped → sight
  set only / "short a" → hard vowel scope). Curriculum-fit: **MATCH @ G1
  LA001-01** (0.800; LA001-07 Sight Words in top-5); K diffuse-abstain =
  vote-splitting across sibling CVC families (top-1 0.819 IS the right
  concept), not a gap. Birth cert + follow-up queue:
  `qa/eval-reports/di-word-reading-birth.md`; eval report
  `qa/eval-reports/di-word-reading-2026-07-22.md`; fit report
  `qa/curriculum-fit/di-word-reading-2026-07-22.md`. **Live loop NOT yet
  driven — HUMAN-CHECKS #43 is the real L0 gate** (mirror of #36); shared
  lesson-mode connect + `subject_for_domain('di')` gaps carried to the family
  `/add-tutoring-scaffold` item, not re-solved.
- **#1 di-letter-sounds — BORN L0 (2026-07-20).** First DI primitive, first
  engine consumer. New family: `primitives/visual-primitives/direct-instruction/`
  (`DiLetterSounds.tsx` + hand-authored `diLetterSoundsScript.ts`), `catalog/di.ts`,
  `service/direct-instruction/gemini-di-letter-sounds.ts` (Fork A menu-scoped:
  curated continuant + short-vowel menu; Gemini picks target letters from the
  objective, code attaches spoken/keyword/emoji), `registry/generators/diGenerators.ts`.
  Standing gates met: sentinel-collision ✓ (engine defaults, no line opens with a
  sentinel), correction re-model/opener directive ✓ (in tutoring block + script).
  typecheck:lumina PASS; eval-test PASS ×3 (topic fidelity: named letters honored,
  generic → starter spread, vowels → keyword elicitation). Curriculum-fit: MATCH
  (K LANGUAGE_ARTS Letter-Sound Correspondence, top-1 0.788 — the starved GK band).
  Birth cert + follow-up queue: `qa/eval-reports/di-letter-sounds-birth.md`. **Live
  loop VERIFIED end-to-end 2026-07-21 (HUMAN-CHECKS #36 struck)** — user mic run PASS
  through the primitive; full data loop fired on submit (curriculum resolve → score
  9.2 → competency/calibration/mastery/+38 XP). **L0 fully runtime-verified; ladder
  UNBLOCKED (`/add-eval-modes` next).** Two known L0 gaps carried to
  `/add-tutoring-scaffold`: lesson-mode connect needs `manual_activity`+DI-tutoring
  through the shared session (the 07-21 run confirmed the standalone tester re-maps
  the subskill via Gemini — landed on CVC-decode LA001-01-a, not the letter-sound
  home; the lesson path must carry the objective's subskill instead); add
  `subject_for_domain('di')→LANGUAGE_ARTS` to the retrieval matcher.
- Engine stack steps 1–3 groundwork (bench POC → live-judged pivot → open-mic →
  extraction 1 `4af21b6` → engine `bc2d303`), runs 2026-07-19..21 all PASS.
  History lives in WORKSTREAMS (DI stream) + `qa/di-bench/` reports.
