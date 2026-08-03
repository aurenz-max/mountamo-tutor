# di-sentence-reading — L4 structural difficulty (2026-08-03)

**Layer: L3 → L4.** `/add-structural-difficulty` on the first DI-family pack to
reach this rung. The tier now drives BOTH within-mode dials: how much of the
DISTAR sequence precedes the read (L3, `resolveSupportStructure`) **and how
much connected text one read coordinates** (L4, `resolveProblemShape`) — a
hard item is a LONGER sentence read COLD. The axis was pre-ruled by the queue
and pre-built by the pack: sentence LENGTH, carried per challenge as
`wordCount` and per session as `meanSentenceWords`, so the tier moves a dial
the telemetry already measures.

**No spoken copy changed.** The cue lines, judging contract, correction line,
and L3 fade are byte-identical — the tier changes WHICH sentences ship, and
the script reads whatever it is handed. That is why this slice, unlike both
L3 siblings, opens **no new ear-check row** (see Tier 3 below).

## The gradient (confirmed against the queue's pre-ruling)

| Mode | Lever | easy | medium | hard | Floor | Cap |
|---|---|---|---|---|---|---|
| all four | word-count band | 3–4 | 5–6 | 7–8 | 3 (`MIN_SENTENCE_WORDS`) | session ceiling (grade/objective-narrowed, ≤ benched 8) |

Uniform across `decodable_sentence` / `read_sentence` / `sentence_review` /
`sight_phrase_sentence`, and that is correct rather than lazy — the L3
precedent verbatim: every mode is the same act (read the printed sentence
aloud), so more words is harder in every one of them. A mode's IDENTITY lives
in its POOL (`poolForType`), which the band never overrides: sight stays
sight and decodable stays decodable whatever the length target. Kept
per-type-capable (`resolveProblemShape(type, tier, ceiling)`) so a future
mode can diverge.

**Band math** (clamped inside the resolver, where the ceiling is known):
easy anchors the floor `[3, min(4, c)]`, hard anchors the ceiling
`[max(3, c−1), c]`, medium takes the middle `[m, min(m+1, c)]` with
`m = max(3, min(⌊(3+c)/2⌋, c−1))`. At the full G1 ceiling (8) that is
[3,4] / [5,6] / [7,8]; a narrowed ceiling **saturates the ladder honestly**
(K ceiling 6 → hard [5,6]; an explicit "short sentences" objective → ceiling
5 → hard [4,5]). A ceiling above 8 clamps to 8.

## The one hard rule, in this pack's terms

**The 8-word benched ceiling is NOT a difficulty knob.** The band lives
strictly inside `resolveWordCeiling`'s result — grade- and
objective-narrowed, capped at the benched `MAX_SENTENCE_WORDS` — and the
generator's last-line `> 8` filter is untouched. Raising the ceiling is a
bench sitting, not an L4 decision. Length-inside-the-band is the pack's
"shape"; the ceiling is its magnitude analog, and the tier never touches it.

## What changed (`gemini-di-sentence-reading.ts` + one new test file — generator-only, no component/script/catalog change)

1. **`resolveProblemShape(type, tier, ceiling)`** — exported sibling of
   `resolveSupportStructure`; returns the clamped band + one advisory prompt
   line. One source of truth both places consume.
2. **One key, two places.** The tier enum reaches the PROMPT (a single
   `DIFFICULTY TIER (…)` preference line, present only when a tier is) and
   the POST-PROCESS (`rankByBand`, below). This deliberately flips the L3
   comment "never inject the tier into the prompt — it could only nudge
   sentence choice": that nudge IS structural difficulty, now designed. What
   remains forbidden: the tier touching the vowel/sight scope, a mode's pool,
   or the ceiling. The stale guardrail comments were rewritten truthfully
   (the skill's `TIER_GUARDRAIL` step — this pack's guardrails were prose,
   not a constant).
3. **Enforcement at selection time** (`bandDistance` + `rankByBand` in
   `buildFor`): one stable re-rank of the deduped candidate list — in-band
   first, nearest next, prior preference order breaking ties — so an
   out-of-band topical pick loses to an in-band back-fill (honor-if-valid:
   in-band picks keep their steering; the code, not the prompt, is
   authoritative). Fork A note: code owns selection end-to-end here, so
   "count → honor → reconstruct" degenerates to ranked selection — there are
   no LLM-authored values to validate, which also means **nothing
   answer-bearing had to be recomputed** (`buildChallenge` derives
   `wordCount`/aliases from the menu entry as always).
4. **Window before rotation** — the slice's one real bug, caught by the new
   suite before it ever ran live: the variance rotation's family-novelty pull
   outranked the band (pass 1 reached past three in-band sight sentences to
   grab a 4-word one for vowel variety, and the shortest-first ramp then
   handed it to the interleave head). Candidates are now trimmed to the
   in-band set (or the nearest *n* when a pool's band support is thin) BEFORE
   rotation: rotation diversifies within the band, never out of it.
5. **Review keeps its lesson thread.** `seedForType` gained an optional band:
   anchors draw nearest-band-first from the FOCUS pool (still shuffled inside
   equal distance), so a hard short-a review anchors on the 8-word pure-a
   entry. Anchors stay in front of the ranked window — the thread is part of
   that mode's identity, and identity outranks the band. The pre-L4 "up to 2"
   semantics are unchanged (rotation may still displace the second anchor).
6. **Seven menu additions** (the pool support that makes the hard band real —
   before them the menu held three entries above six words and hard would
   have saturated at 6 for most scopes): one 7–8-word sentence per pure short
   vowel (`sam-cat-mat` 8w /a/, `ten-red-bed` 7w /e/, `big-pig-pit` 8w /i/,
   `hot-dog-log` 8w /o/, `pup-sun-run` 7w /u/) plus two sight-heavy
   (`you-up-down` 8w, `like-look-dog` 8w). **Every word already appears
   elsewhere in the menu** — the attribution control that makes a miss trace
   to connected text, never to a new word — all entries sit inside the
   benched 3–8 class (items are content; the CLASS is what was benched), and
   all pass the module-load sentinel/length validation. Honest note: the
   additions enrich the NO-TIER draw too (the untiered generic session can
   now rotate onto a long entry, visible in the live control probe below) —
   the no-tier CODE path is byte-identical, but the menu is content and
   content grew.

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck:lumina` | **0 errors** |
| `tsc --noEmit` (project-local, abs path) | **1021 = baseline exactly** (measured before editing), 0 in touched files |
| New `gemini-di-sentence-reading.structural.test.ts` | **17/17** — exhaustive band math (every ceiling 3–8 × tier, clamp above 8, degenerate ceiling), per-tier sweeps, saturation, pool identity, review thread, mixed/SP-21, 24-combo floor/ceiling stress |
| Non-vacuity | disabling the lever fails **9/17** (the 8 that survive are pure band-math + no-tier/L3-stamp tests) |
| Full vitest | **1303/1303** (113 files; was 1286 — +17 new) |
| Live `/eval-test` tier sweep (isolated :3005, real Gemini) | **6/6 PASS** — table below |

| Live probe | Observed |
|---|---|
| `read_sentence` + hard @ G1 | 7,8,8,8 words, all `hard` — two of four are new menu entries |
| `read_sentence` + easy @ G1 | 3,4,4,4 |
| `mixed` + medium @ G1 | all four identities, every item `medium`, all 5w |
| hard @ K (ceiling 6) | 5,6,6,6 — **saturates, never exceeds the K ceiling** |
| "short a" topic + hard | every sentence pure-a (**scope beats band**), reaches the 8-word pure-a entry, rest saturate inside the narrow pool (5,5,6,8) |
| no-difficulty control | no `supportTier`, varied 3–8 lengths — the L0 shape |

Claimed lever == actual on every probe (`wordCount` recomputed from `text` in
code, never trusted from the model — pre-existing invariant).

## Tier 3 (live behaviour) — folds into existing rows, no new gate

No spoken line changed, so there is no new wording to hear. The one genuinely
new live composition is the **8-word COLD read** (L4 hard × L3 hard): both
halves are individually proven (the 8-word item read clean in the bench
sitting; the cold read is L3's checked fade), but the pack's next mic sitting
should include one — it is now the family's hardest ask. Rides the pack's
existing live rows (#53 short-end stress / the next sentence sitting), not a
new HUMAN-CHECKS row.

## Deferred by design

- **Sight-word density and vowel-mixing** (the birth cert's other two lever
  candidates) — one lever per mode; length is the ruled, measured axis.
  Either could become a secondary refinement in a future slice if the length
  band proves too coarse.
- **Within-band variety across repeat sessions** — deterministic benched-lead
  ordering means a pinned tier redraws similar sets (pre-existing property of
  the non-review modes; review shuffles). Revisit only if repeat-session
  telemetry shows it matters.
