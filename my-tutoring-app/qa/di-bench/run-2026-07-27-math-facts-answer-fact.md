# DI run — di-math-facts `answer_fact` @ K — 2026-07-27 (child-paced, COHERENT)

- **runId `42279e964031`**, started 2026-07-28T02:04:14Z (evening 07-27 local). 5 items:
  1+0 / 1+3 / 1+1 / 4+1 / 1+2. `silenceCloseMs: 500` (family default, correct for this pack).
- **Source artifact — zero-click:** `backend/logs/di-runs/2026-07-28-020735-di-math-facts-42279e964031-run-end-tail.json`,
  `flushReason: run-end-tail`. Nobody hit Copy-run-JSON; the item-8 pilot persisted it alone,
  and the deduped tail flush captured the `[DI_COMPLETE]` cue-sent AFTER `run-end` (seq 226 > 225)
  with `cuesStalled: 0` — the 07-26 flush-truncation class stayed fixed.

## Verdict: COHERENT

5/5 items completed and affirmed, 3 corrections (item 3 ×1, item 5 ×2), 0 move-ons.
Coherence row all-benign: **5 supersessions (all absorbed), 0 phantom / 0 unanchored /
0 off-script / 0 no-verdict / 0 resync / 0 retro-anchored / 0 echo-opened / 0 belowMinVoice**.
Cues 6 queued / 6 sent / 0 dropped / 0 stalled; 4 held-by-audio then re-fired on the audio
edge (normal pacing). No GoAway, no stall.

## Per-item narrative

| Item | What the learner did | Outcome |
|---|---|---|
| 1+0 | "Hey, um let me let me try 1 + 0." → superseded → " is 1." | affirmed |
| 1+3 | **Counted up aloud**: "Juan" (ASR for "one") → " two" → " three" → " four" — 3 rapid supersessions | affirmed on "four" |
| 1+1 | "One plus one is" (trailed off, no number) → **plain fallback correction** → "One plus one is is it two?" | corrected ×1, then affirmed |
| 4+1 | Voice turn with NO transcript (superseded — the run's attempts 13 vs transcripts 12) → "one two three four five" (counted all) | affirmed |
| 1+2 | "Uh I need help on this one. Can you do that again?" → fallback correction → "Can Can you help me?" → **byte-identical fallback repeat** → 35.9s think → "Um, is it three?" | corrected ×2, then affirmed |

## Findings → registers

1. **HUMAN-CHECKS #55(e) — HALF-CLOSED (the fallback-selection half).** All three
   corrections were misses with NOTHING to contrast (a trailed-off answer, two help
   requests — no number in any of them) and every one drew the **plain bench-proven
   re-model** ("My turn: one plus two is three. Your turn. What is one plus two?"),
   **byte-identical on the repeat miss**, never a contrast with an empty slot. That is
   the exact failure (e) guards, live ×3. **Still undriven: the SILENCE route** (no
   voice turn at all → no-verdict timeout → resync) — (e) as written.
2. **Counting-up-aloud supersession chains — first live observation, benign.** A
   learner who finds the answer by counting emits one voice turn per count word; the
   supersession mechanism did load-bearing work — the intermediate "two"/"three" on
   1+3 were superseded BEFORE any verdict could bind to them, so the permissive-on-
   counting-up judging clause was never even needed. This is item 9 Tier-2's "rapid
   double answers" behavior class, observed live and absorbed (5 supersessions,
   0 unanchored). Recorded as a BACKLOG watch-item.
3. **Judge-over-transcript reinforced (again):** ASR wrote "Juan" for a spoken "one".
   (No verdict bound to it — superseded — so this is NOT the #50(b) homophone-affirm
   test; that stays open.)
4. **Help request handled pedagogically right:** "Can you help me?" judged `corrected`
   → the DISTAR correction (model + re-elicit) IS the help; the learner then produced
   the correct answer after a 35.9s think, well inside the 60s walk-away bound, and
   the affirm landed. No design change indicated.
5. **Timing:** meanResponseMs 11742 (child think-time; max 35.9s), meanCommitLagMs
   2977 (long utterances push commit lag — 8.7s on the count-all attempt; the bench's
   ~933ms constant was one-word answers). The silent fluency signal captures pace
   with no visible timer, as designed.

## What this run does NOT close

- **Item 8 acceptance gate** (induced-stall diagnosability) — no stall was induced;
  this is only the pilot's third clean zero-click persist.
- **Item 1 residual (ii)** — the 90s SILENCE micro-run (no-verdict → resync live).
- **#50(b)** homophone/over-affirmation — no homophone was ever JUDGED here.
- **#49(a)** `counting_next` cue wording — this run was `answer_fact`.
- **Item 5** (mid-run stall fix) — nothing exercised; the fix is still unbuilt.
