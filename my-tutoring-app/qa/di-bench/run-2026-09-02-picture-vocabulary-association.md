# DI Bench run — 2026-09-02 · `picture-vocabulary` / `association`

**Gate 7 re-run, `qa/di/BACKLOG.md` item 26.** Gate 8 was banked on 2026-08-21 and is not
re-driven here; HUMAN-CHECKS **#118** is untouched and stays OPEN.

Run as **four `--di-bench-item` runs**, one per stimulus, aggregated by hand — the narrowed
workflow item 27's I2 fix made performable. All four scored against the FINAL contract text.

---

## VERDICT — ✅ PASS

| Stimulus | Agreed | same-category | Verdict |
|---|---|---|---|
| `sock` | **12/12** | **2/2** | PASS |
| `dog` | 11/12 | **2/2** | PASS — `mailman` soft |
| `bed` | **12/12** | **2/2** | PASS |
| `cup` | 11/12 | 1/2 | PASS — `bowl` soft |
| **total** | **46/48** | **7/7 hard** | **0 false affirmations · 0 false refusals** |

Both disagreements are the fixture's own `soft` probes — recorded, never counted, and both
were pre-marked soft on 2026-08-19 for exactly the reason they tripped.

**`same-category` went 0/8 → 7/7 hard.** Every other bucket held where it already held.

Evidence: `run-2026-09-02-picture-vocabulary-association-<stimulus>-console.txt` beside this
file, and `qa/tutor-reports/picture-vocabulary-live-di-bench-bench-assoc-<stimulus>-2026-09-02.md`.

---

## What changed — three levers, and the one the run rejected

Item 26 named three levers "in order of expected yield". The bench disagreed with the
ordering, and that is the finding worth carrying.

**1. A worked counterexample on the same-category guard — the lever that worked.**
The guard shipped one abstract sentence where `rationalised-chain` (7/8, the bucket the
fixture was weighted toward) ships a worked pair. It now ships apple/banana — same kind,
same basket, same bag, still not a pairing — plus couch/sofa for the second-name case.
**Confirmed: in an open-set contract, an abstraction loses to a concrete accept clause.**

**2. Narrowing "keep with it" — necessary, and it cost a run to get right.**
"find with it, use with it, or keep with it" became "use with it, put on it or in it, or the
place you keep it". What is kept is now a PLACE, never a neighbouring thing.

**3. A blunt precedence line — WRITTEN, MEASURED, AND REJECTED.**
The first shape was *"when two of these rules are both true, THE REFUSAL WINS"*. It refused
`shoe` — the **generated partner** — within five probes. `sock`/`shoe` is simultaneously the
curated right answer AND a same-category pair (both footwear), so **any rule that makes
same-kind decisive at all destroys the answer the mode teaches.**
Replaced by a **discrimination pair**: `glove`/`hand` is RIGHT and `glove`/`scarf` is WRONG,
differing only in whether the two are used together. Category is not the question; use is.

**4. The hyponym clause — NOT in item 26's plan, and the gate needed it.**
`sock`, `dog` and `bed` all held same-category 2/2 on levers 1–3 alone, and `cup` still
affirmed `mug` — the fixture's own "purest same-category failure". A mug is not a second
NAME for a cup, it is a KIND of cup, and no clause named that relation. Added: *"Nor is a
KIND of X, or the thing X is a kind of … they have named X a second time."* `mug` refused on
the next run, with `plate`, `saucer` and `tea` all still affirmed.

> ⭐ **Carry all four to the remaining `open_set_word` packs** (word-builder morphology,
> knowledge-check 2b, retell, the six proposition packs): a worked counterexample on every
> guard, no accept phrase that licenses mere co-location, precedence as a discrimination
> pair rather than a tie-break, and a hyponym clause wherever the stimulus has kinds.

---

## ⚠️ TWO SELF-INFLICTED FAULTS, both now machine-gated

Neither was a judge failure. Both produced findings that read exactly like product defects.

**F1 — the contract named a fixture word.** The first draft of the narrowed accept clause
excluded things *"kept in the same drawer"* — and `drawer` is an **AFFIRM** probe (where
socks are kept). The judge refused it on probe 3: a false refusal manufactured entirely by
the contract contradicting itself, and **indistinguishable in the matrix from a judge that
had re-closed the set.** This is `associationBench.ts`'s own warning about PROBES, pointing
the other way — at the CONTRACT.
**Gate:** a test fails if ANY `ASSOCIATION_BENCH_STIMULI` probe word appears as a whole word
in the association cue. Two sanctioned exceptions: the stimulus itself, and the pre-existing
`cat`/`sock` chain example — a real tension recorded rather than resolved by deleting either.

**F2 — a lever that fixes one bucket by breaking another.** The blunt precedence line above.
**Gate:** the pack test now asserts the discrimination PAIR and asserts `THE REFUSAL WINS`
is absent, so the rejected shape cannot come back.

---

## Instrument: item 27's fixes are confirmed live — first end-to-end proof

I2 said its first proof would be this re-run. It is.

- **I1 — clean.** Zero `di-verdict-embellished` findings across all runs, including every
  correctly-fired specific branch. Pre-fix this class threw 8 bogus WARNs on one bench.
- **I2 — clean.** Four stimulus reports sat side by side under
  `picture-vocabulary-live-di-bench-bench-assoc-<stimulus>-2026-09-02.md`; nothing
  overwrote anything. A same-shape re-drive announced itself on stdout first, as designed.
- **I2b — clean.** The bench reports carry the probe matrix.
- **I3 — clean.** No rhyme vocabulary in an association summary.

**Also confirmed: four `--di-bench` runs execute in PARALLEL against one backend** with no
1008/1012 and no cross-talk. That cuts a 4-stimulus bench from ~6h serial to ~1.5h.

---

## Findings that are NOT gate-7 failures

**⚠️ TU-6 fired live — 7 × HIGH `di-tag-spoken`.** The `sock` re-run had the tutor read
`[CURRENT STATE]` aloud on **every reanchor beat** (0, 1, 2, 4, 6, 8, 10). This is the open
TU-6 class on WORKSTREAMS (`PrimitiveState.attach`, `lumina_tutor.py:310`), not a
picture-vocabulary defect and not caused by this slice.
**What this run adds to that row: it is INTERMITTENT.** The earlier `sock` run on the same
day, same pack, same beats, threw none. A fix cannot be validated by a single clean run.

**`di-correction-verbatim-repeat` — not a defect, bench-amplified.** Already ruled on
2026-08-21: a bench drives more consecutive refusals than production's cap allows, so
identical general corrections in a row are the expected shape.

**One `di-no-verdict` on `cup`/off-task "um", in the pre-hyponym run only** — the tutor
re-asked instead of correcting, which stalls the loop. It did NOT recur on the passing
re-run (off-task 2/2). Recorded as a single-run observation, not a filed defect.

---

## The key was audited before any of this was believed

Per the handoff's instrument warning, and per what it cost item 24 three times in one day.
Both soft disagreements are the fixture's own pre-marked judgment calls:

- **`mailman` for dog** — the cliché chain, marked soft on 2026-08-19 because a mail carrier
  genuinely is an everyday part of a dog's world. A judge affirming it is being defensible.
- **`bowl` for cup** — marked soft because tableware genuinely is kept together. It is the
  boundary of the guard, not its centre; `saucer` (affirmed) pairs with a cup specifically.

Neither turns the verdict. The hard buckets are 7/7.

---

## What is owed next

1. **Gate 8 is banked** (2026-08-21, both drives) and nothing in this slice touches the
   correction branches' ORDER — but four new sentences entered the cue, so a cheap
   `--di --eval-mode association` re-drive before ship is prudent.
2. **HUMAN-CHECKS #118 stays OPEN.** These runs retire the semantic half of criteria 1–3 and
   now settle the same-category swap that blocked 08-21. Acoustics, ASR and ear-separability
   remain the user's sitting.
3. **TU-6 has live, intermittent evidence** — worth attaching to that row.
