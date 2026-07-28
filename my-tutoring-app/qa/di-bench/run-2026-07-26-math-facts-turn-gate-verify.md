# DI sitting 2026-07-26 (2nd) — turn-gate fix VERIFIED live + first [DI_MOVE_ON] in any pack

**Surface:** `di-math-facts` (standalone tester), `fact_review` / "addition facts within 5",
5 items, kindergarten, `silenceCloseMs: 500`. Run JSON: `run-2026-07-26-math-facts-turn-gate-verify.json`.
**Verdict: PASS — coherent end-to-end through the family's first live correction cap.**

## 1. The turn-gate fix's four predicted numbers all hit

`run-2026-07-26-math-facts-turn-gate.md` §Open predicted what a fixed run must show. Actual:

| predicted | actual |
|---|---|
| `unanchored 0` | **0** (was 2) |
| `retro-anchored 0` | **0** — the safety net never needed |
| `voiced ~170ms` on one-word answers | **165–254ms** across all 7 closes (`voicedMs = durationMs + one 85ms frame`) |
| a `move-on` flag where the cap is due | **seq 185, `flag: "move-on"`** at the 2-correction cap |

The raw `durationMs` values (80–169ms, i.e. two frames) are EXACTLY the population the broken
gate rejected — every one of these answers would have been dropped yesterday.
`belowMinVoiceCloses` **0** (was 2), `phantoms` **0** (was 2), `offScript` **0** (was 2),
`cuesStalled` **0**, 7 voice-closes = 7 attempts = 7 transcripts (every verdict anchored),
0 supersessions / no-verdict / resyncs / echo-opened. Counters internally consistent
(recomputed: mean response 12,684/7 = 1,812ms; mean commit lag 5,776/7 = 825ms). No stall —
the watchdog gap was never entered; run completed to recap.

## 2. First live [DI_MOVE_ON] — hypothesis (a) of the decoherence list survives one firing

`1 + 3` answered **"three" three times** — incidentally the exact **echo misconception**
(last number heard) named in the L2 contract. Two contrastive corrections → cap →
`[DI_MOVE_ON]` queued at verdict time, held by audio ~2.5s, sent at 96.4s; recap rendered
("Great work today!", 4 ✅ + 1 retry tile). The pack stayed coherent through the whole branch.

## 3. Contrastive correction, math half (#55c/d) — spoken fidelity confirmed in transcript

Both corrections captured complete via `verdict-text`, **byte-identical** across the repeat
(no drift to a third wording), slot filled, no ⟨⟩ marks, no editorialising:

> My turn: not three — one plus three is four. Your turn. What is one plus three?

Sentinel classified `corrected` all three times; 0 off-script.

## 4. fact_review spread (#49c)

Drawn facts: 2+2, 0+5, 2+1, 1+1, 1+3 — sums 4/5/3/2/4, includes a zero fact, no cluster.

## NOT reached by this run (deliberate — one capped item ≠ the sustained-miss recipe)

- **Misconception S1 live capture:** session mean = (4×100 + 0)/5 = **80**, above the <60 gate —
  the distiller correctly did NOT fire. This is the recipe working as documented, not a miss.
- **#50(b)** homophone stress, **#50(c)** MATHEMATICS attribution (no `[DI eval]`/backend evidence
  in scope), sustained-miss stress (multi-cap → resync (b) / rapid-retry (d)), sentence-reading
  half of #55/#54/#53, #49(a) The Number After.

## Ear residuals — BOTH USER-CONFIRMED 2026-07-26 (post-run)

1. ~~Was **"Good try. We will practice more later."** actually heard after 96.4s?~~ **Confirmed
   heard** (user, drawing on their sittings). The log ending at `cue-sent` is log truncation at
   run end, not a lost cue.
2. ~~Does **"My turn"** read acceptably as an *arithmetic* correction opener?~~ **Confirmed
   acceptable** — the sentinel decision's live half is settled for math. → **#50(a) fully struck.**

## Log quirk (cosmetic, noted)

Affirmed `verdict-text` events stamp the NEXT item's id — advance fires at verdict, the
completing sentence lands after the pointer moves. Corrected ones stamp correctly
(retry-in-place), and those are the ones diagnosis reads (same-item exact-match fallback).
