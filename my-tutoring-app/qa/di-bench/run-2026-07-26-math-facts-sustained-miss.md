# DI sitting 2026-07-26 (4th) — SUSTAINED-MISS RECIPE RUN: coherent through five caps

**Surface:** `di-math-facts` standalone tester, `subtraction_fact` / "subtraction within 5",
5 items, K. **The re-run of the sitting that decohered 2026-07-25** — this time on the fixed
turn gate, with full telemetry (item 8 stack, first real outing).
**Artifacts (auto-persisted, zero clicks, all joined on runId `62e43d42c39a`):**
`backend/logs/di-runs/2026-07-26-172110…-run-end.json` + `…172116…-run-end-tail.json`;
server ledger `backend/logs/lumina-sessions/2026-07-26-171719-lumina-tutor-e6d77654f3be.jsonl`
(480 events, `client_run_id` matches).

## Verdict: PASS — the decoherence is gone under the exact conditions that produced it

All five items deliberately failed to the correction cap. 230 seconds, 16 attempts,
15 corrections, **5× `[DI_MOVE_ON]`** (no session had ever fired more than one), 8 barge-ins,
cues 6/6 sent / 0 stalled, **0 unanchored / 0 phantom / 0 no-verdict / 0 off-script**,
0 resyncs, 1 supersession (benign: a rapid 16th voice turn superseded the pending 15th before
its verdict at 228.1s; the verdict anchored to it, the cap fired, run completed to recap).
No GoAway occurred; single fresh Gemini connection throughout. The 2026-07-25 decoherence is
now fully attributed to the turn-gate `minVoiceMs` bug — closed by this run.

## The learner ran the ECHO rule, 5/5 consistent (better evidence than the recipe)

Not the successor rule — **echo-the-last-number**, the misconception already named in the
catalog's commonStruggles: 5−4→"four", 3−0→"zero", 5−1→"one", 5−3→"three", 4−1→"one".
Session mean **0** → the S1 capture gate was reached with a perfectly consistent wrong rule.
**S1 CLOSED — user-confirmed console line (post-run):**

> `[captureMisconception] stored for di-math-facts: The student identifies the answer to a
> subtraction fact as the second number in the expression.`

**The diagnosis is correct on all five items and properly BOUNDED** — it names the rule
(second operand), scopes it to subtraction facts, and does not overreach to "can't subtract".
It is also generative: it predicts the wrong answer on unseen items (4−2 → "two"). This is
the loop's first live capture ever, and it was distilled from Tier-A judge sentences while
the ASR transcripts for one item read "SeaWorld"/"cero"/"3 * 0 = 0" — the judge-over-transcript
design carrying diagnosis, exactly as intended. Submit confirmed: score 0, success false,
duration 231.8s (`[DI eval]` + `/api/problems/submit`). A real active misconception now
sits in Firestore under `misconceptionKey: "di-math-facts"` — BACKLOG item 2 (remediation
consumption / Probe G) now has live data to design against, not just golden scenarios.

ASR collapsed again and the judge did not: item 3−0's three transcripts read **"SeaWorld" /
"cero" / "3 * 0 = 0"** while the judge corrected "not zero" all three times — the child said
"zero"; only the judge's sentence knew it. (Second independent confirmation of the
judge-over-transcript finding from the child stress run.)

## #55 math half at SCALE

14 complete judge lines captured via `verdict-text`: every one byte-exact to the template
`My turn: not ⟨heard⟩ — <fact>. Your turn. <ask>`, slot filled correctly every time, no
drift on repeats, no ⟨ ⟩ spoken, no editorialising. (c)+(d)-math are done; (a)/(b) reading
half + (e) silence fallback still open.

## Telemetry stack (item 8) — first real-failure outing, clean

Timestamps, full ledger narrative (333 tutor-transcript fragments, all cue sends classified,
barge-ins), run-end + deduped 6s tail flush (tail shows the final `[DI_MOVE_ON]` cue-sent;
counters settle at stalled 0), correlation key joining all three records. Known cosmetic
quirk still present: the cap-triggering correction's `verdict-text` completes after advance
and stamps the NEXT item's id.

## Still open after this run

- **S1 console line** (stored/abstained) — user to confirm; then item 1 closes entirely.
- **No-verdict → resync live** + **#55(e) silence fallback** + **item 8's induced-stall
  acceptance gate**: the learner answered every prompt, so none triggered. One 90-second
  micro-run (answer nothing on item 1) drives all three.
- #50(b) homophones (separate short run); item 5 (stall fix) unchanged — no GoAway occurred
  here, so suspect (a) stays untested by absence; item 6 attribution; sweep of the flush
  wiring to the other three packs.
