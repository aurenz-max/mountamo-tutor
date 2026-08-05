# HANDOFF — DI 14g: di-math-facts `counting_next` collapses a 1–120 ask to 12

Paste-able execution prompt. Authored `/pm` 2026-08-05; every anchor verified
against the working tree at HEAD `bcd0c06`. Executor: `/topic-fidelity` to
measure, then `/eval-fix` — in the DI lane, serial single session (user token
ruling 08-05, no Workflow fan-out). `gemini-di-math-facts.ts` and
`catalog/di.ts` are clean at HEAD; the concurrent 14l surface does not touch DI.

## The prompt

Close reader-fit 14g's remaining half: `di-math-facts counting_next` served
values only through 12 against the published Grade-1 objective `NBT001-01-a`
("Identify missing numbers when counting forward … within 120"). Census
evidence: `qa/topic-traces/g1-count-forward-to-120-2026-08-01.md` (row 2 +
"Scope drops" §1: objective and intent both retain 1–120 → data uses only
6, 7, 8, and 12-class values). Queue entries: `qa/reader-fit/BACKLOG.md` §14g
(still-open half) + the DI lane pull in WORKSTREAMS.

### Line-exact mechanism (verified 2026-08-05 — TWO layers, don't stop at one)

All in `src/components/lumina/service/direct-instruction/gemini-di-math-facts.ts`:

1. **The parse BUG (unambiguous, fix regardless of the fork below):**
   `resolveTextScope` at `:233` matches
   `/(?:within|up\s+to|sums?\s+to|to)\s+(\d{1,2})/i` — a **two-digit capture**,
   so "within 120" parses as "within 12" (any 3-digit ask is silently mangled:
   100 → 10). `:235` then clamps `Math.min(20, Math.max(5, 12))` → `maxSum 12`
   → `ceilingOf` (`:257`) → `buildCountingPool(12)` (`:312-313`, pairs a=0..11)
   → answers ≤ 12. That is byte-for-byte the census observation.
2. **The design boundary (this is why it's a FORK, not a one-liner):**
   `NUMBER_WORDS` (`:156-161`) is 0..20 and its doc comment declares it "the
   full answer range this pack can ever speak"; `buildChallenge`'s counting
   branch (`:653-663`) speaks `problem: "the number after ${NUMBER_WORDS[pair.a]}"`
   and stamps `answerWord: NUMBER_WORDS[answer]` (`:649`) — beyond 20 these are
   `undefined`. The benched spoken response class is **single number words**
   (probe #46, `qa/di-bench/run-2026-07-24-math-facts-probe.md`, items 1–10).
   Multi-word numerals ("one hundred seven") are an **unbenched response
   class**, and DI standing gate 1 (`qa/di/BACKLOG.md`) requires a bench
   sitting per NEW response class before wiring.

### The fork — decide with evidence, record the ruling (14g precedent)

The queue filed this as a genuine in-scope failure ("counting_next IS the
pack's mode; the range is the contract") — but that ruling predates the
line-exact read above. Two honest resolutions; the 14g word-reading half is the
template for flipping a verdict when measurement says so
(`qa/tutor-reports/di-word-reading-2026-08-03.md`, steering measured 2/3→0/3):

- **Option A — fix + honest saturation + steering (machine-gated, no sitting;
  the default unless the user opts into B):** fix the regex (`\d{1,3}`), keep
  the clamp at the pack's benched ceiling so a 120 ask saturates at 20
  honestly — the exact di-sentence-reading precedent (the benched 8-word
  ceiling is a HARD CAP that saturates, never a knob;
  `qa/eval-reports/di-sentence-reading-structural-difficulty-2026-08-03.md`) —
  AND fix the `catalog/di.ts` di-math-facts `constraints` steering so
  high-range counting asks stop routing here: name counting beyond twenty out
  of scope and point at the primitives that now genuinely serve `NBT001-01-a`
  (number-sequencer reaches 120 since 14h `da7da58`; number-line exact
  missing-number 0–120 since 14k `1fbf4a1`; hundreds-chart band work in 14i).
  Measure the steering like 14g did: `manifestOnly` traces on the exact census
  topic, picks before vs after, and confirm the pack's real homes (K within-5 /
  G1 within-10 facts) still route.
- **Option B — extend the pack to 120 (real DI development; gated):**
  code-owned compound number words + aliases to 120, `buildCountingPool`
  windowed near the objective's range (a 1–120 session must drill decade
  transitions near the intent focus, e.g. 96..120 windows — the 14k
  focus-window idea; NEVER 0→1 rote from the bottom), tier composition kept
  narrowing-only (`:864-866`), and the DISTAR cue lines re-checked for the
  longer spoken forms. **Gate: one ~30-min bench sitting for the multi-word
  numeral response class BEFORE wiring** (standing gate 1 — this is a
  development-enabling sitting, not testing-for-testing; teens/decades
  homophone risk: "thirteen/thirty" class). If the user wants B, do A's regex
  fix first in its own slice anyway — B builds on a correct parse.

Do NOT: widen via prompt (Fork A — the wrapper only emits title/scope hints;
pools are code-owned), turn the benched ceiling into a difficulty knob, or
regex-parse anything new out of NL beyond the existing code-enforced scope
resolver's shape.

### Gates

- Non-vacuity: a focused test on the exact census objective text ("within
  120") that FAILS at HEAD (parses 12) and passes after (parses 120 → then
  saturates or extends per the chosen fork). Revert-bite for every behavior
  change; keep the existing suites green (`gemini-di-math-facts` tests +
  `.remediation` suites are committed and must not regress).
- `typecheck:lumina` 0; tsc 0 NEW vs baseline; full Vitest ≥ current
  (1,589 with the 14l surface in-tree — re-baseline at run time).
- Real-pipeline probes: pinned `counting_next` via the eval-test route (an
  isolated :3005 dev server if :3000 is busy — house pattern), plus the
  `manifestOnly` census-topic steering measurement if Option A.
- Same-slice bookkeeping: strike 14g fully in `qa/reader-fit/BACKLOG.md`
  (re-read from disk first — the 14l session edited it), EVAL_TRACKER row,
  report `qa/tutor-reports/di-math-facts-14g-<date>.md` (or eval-reports if
  Option B), WORKSTREAMS DI row "last touched". No new spoken copy in Option A
  ⇒ no new HUMAN-CHECKS row; Option B's live ear-check rides #50's sitting
  (next free ID = 63 if a new row is truly needed).

After this closes, the DI lane's next pull is authoring its next DEVELOPMENT
item with the user (new pack in a benched response class / spoken expansion) —
item 6 is DEPRIORITIZED (user 08-05) and item 9 Tier 2 stays demoted.
