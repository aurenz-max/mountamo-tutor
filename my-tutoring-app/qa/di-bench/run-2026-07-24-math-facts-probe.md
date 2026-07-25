# DI Bench run — 2026-07-24 (math-facts probe: number words as a response class)

First live run of the `Math facts` bench set (`kind:'fact'`, wired `8e30a52`).
User verdict: "worked great!" **Gate (HUMAN-CHECKS #46, standing gate 1 for
di-math-facts): PASS** — number words judged reliably from audio through the
full model→guide→test→judge loop. Run JSON:
`run-2026-07-24-math-facts-probe.json` (captured 2026-07-25T03:10Z ≈ 07-24
23:10 local).

## Headline: the new response class is clean — and ASR writes words, not digits

3/3 attempts affirmed (1+1→"two", 2+1→"three", 2+2→"four"), 0 corrected,
0 off-script, **0 unanchored verdicts, 0 phantom commits, 0 echo-opened
turns** (floors ambient 0.0025 / echo 0.0002 — AEC fully suppressing).
Input ASR lexicalized every answer as the NUMBER WORD ("two"/"three"/"four"),
never the digit — **aliasAgree 3/3**; the digit aliases ("2","3","4") were
never even needed this run. Script fidelity exact: "Listen: one plus one is
two. Together: one plus one is two. Your turn. What is one plus one?" →
"Yes, one plus one is two." — the fact cue branches read naturally at pace.

## Fluency-signal readout (the reason this pack exists)

- responseMs (tutor-audio-fall → Live input transcription): 2,224 / 1,866 /
  2,467 (mean 2,186ms) — clean per-item spread.
- commitLagMs (local voice start → transcript arrival): 936 / 931 / 935 —
  **essentially constant (~933ms)**, meaning `responseMs − commitLag` is a
  stable proxy for think-time. Silent response-time capture as the
  di-math-facts fluency signal is VIABLE on this evidence (no-timer ruling
  holds: nothing visible, everything measured).
- Local utterances ~170–180ms, peaks 0.049–0.091 — single number words are
  short but comfortably above the 0.025 silence bar; minVoiceMs 120 leaves
  ~50ms margin. Watch-item for quieter child voices, not a blocker.

## Coverage gaps (carried, not blocking — mirrors the #41→#43 precedent)

The sitting ended after 3 of 10 items, all answered correctly, so:
- The **fact correction branch** ("My turn: … Your turn. What is …?") never
  fired live — the tutor has never spoken it. Carried to the di-math-facts
  L0 live-loop check (deliberately answer wrong to drive it), exactly as
  word-reading's near-neighbour stress folded into its live loop.
- **Homophone / over-affirmation stress** (one/won, two/too, four/for,
  eight/ate) and the later items (5–10 answers) not driven.
- **Sentinel-opener judgment** (does "My turn" read oddly for arithmetic?):
  no evidence gathered since no correction ran. Decision: **keep the engine
  defaults** — nothing in this run argues against them, they are proven
  collision-safe, and the primitive's live check will hear the correction
  line before the script is considered settled.

## Disposition

Standing gate 1 for di-math-facts: **PASSED** (new response class benched,
affirmation path verified live). Sentinel gate 2: defaults kept, correction
opener to be heard in the primitive's L0 live loop. → `/primitive
di-math-facts` (next queue action, qa/di/BACKLOG.md item 3).
