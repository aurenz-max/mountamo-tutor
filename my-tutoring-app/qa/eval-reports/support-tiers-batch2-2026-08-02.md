# Support Tiers — Batch 2 (workflow-orchestrated), 2026-08-02

**What ran:** an 8-agent parallel Workflow (`support-tiers-batch2`, run `wf_57eec15d-d3a`, Opus
implementers, ~1.28M subagent tokens, 22 min wall) executing per-primitive handoffs DESIGNED by the
orchestrating session from 8 read-only profile passes. Division of labor per `skill-optimization`:
profiles → orchestrator picks levers + writes line-anchored specs → agents implement mechanically →
orchestrator applies all catalog patches serially, runs full gates, slices commits. This is the
first tier batch gated on **per-item real-Gemini probes** (batch 1 shipped without them).

**Scoreboard: 7 implemented, 1 partial, 0 abstained.** Non-math tier coverage moves 13/36 → **21/36**.

| Primitive | Status | Levers shipped | Defects fixed en route |
|---|---|---|---|
| phoneme-explorer | implemented | worked-example withdrawal (3-step), choice-emoji at render, blend-cue + operation-neutral line, tutor option-enumeration gate | — |
| phonics-blender | implemented | blend-preview (full → word-only → hidden), slot-count, tile-letters; contract R1-R9 honored, changelog appended | stale contract note corrected; dead `difficulty` void replaced by `ctx.supportTier` |
| syllable-clapper | implemented | clap-counter withdrawal (incl. Check-label echo), directional-hint neutralization; DEAD scaffoldingLevels ladder wired to a real tier selector | tutor was an ungated second scaffold channel (segmented re-say at every difficulty) |
| rhyme-studio | implemented | rime-highlight, instruction-text, tutor-names-options (PRE-forced), production bank 1-of-4 at hard | **rule-#1 answer leak**: recognition-mode rime highlight rendered only when the pair rhymed — the highlight WAS the yes/no answer; now post-resolution only |
| word-sorter | implemented | bucket-emoji (K-forced), filed-words, names-sort-criterion (prompt lever), match-column distractors | match `[ANSWER_INCORRECT]` would have sent `'?'` with distractors present; WordSorter.test SoundManager mock missing playPerfect/playStreak |
| word-workout | implemented | chain-cue 3-level, instruction + sentence-model-read withdrawal, real-vs-nonsense pronounce gate, comprehension choice count | sentence-reading instruction line was missing the `!isPreReader` gate the other three modes had |
| letter-sound-link | **partial** | keyword-anchor 3-step, per-mode strategyHint, single-tap commit (keyword_match only), MAX_ATTEMPTS 3/3/2 | **live rule-#1 tutor leaks ×3** ([ACTIVITY_START] named the sound/keyword pre-challenge; [NEXT_CHALLENGE] repeated letter+sound+keyword; [SAY_KEYWORD] fired mid-attempt) + catalog scaffoldingLevels/HOW-TO-PLAY named answers — all rewritten mode-aware |
| calendar-explorer | implemented | target-day-column withdrawal, day-headers/month-label, easy wide-spread count options, hard neutral hint | **unanswerable day-name identify** (options hidden + numeric-only click; shipped fallback in the broken class); tutor pinned to challenge[0]; **`resolveGradeBand` matched digits anywhere in grade prose — a grade=1 probe emitted band 4-5** (the 14c bug class, live here) |

**The partial:** letter-sound-link dropped single-tap-commit for `see_hear` — its options are bare
speaker bubbles with no visual identity, so committing on first tap would commit an *unheard*
option. Correct judgment; `keyword_match` got the lever, `hear_see` already shipped single-tap.

**Levers dropped by design (all spec'd SKIPs or guard-protected):** phoneme-explorer optionCount
(schema churn); phonics-blender distractor tiles / word-difficulty (contract R6/R7/R9);
syllable-clapper printed-word, maxClaps, undo, attempts; word-workout picture-match speaker (the
mode's point at PRE) and tier metrics (out of scope).

**House pattern held everywhere:** per-challenge optional fields default to byte-identical legacy;
tier stamped in CODE post-parse from `ctx.supportTier` (never prompt-steered, except word-sorter's
one sanctioned instruction-wording lever); band (K/PRE) gates compose and WIN over tier; every
item threads `supportTier` to the tutor + ships a SUPPORT-TIER reveal-policy directive so the voice
channel matches the screen (6 of 8 profiles independently showed the tutor would otherwise
re-supply every withdrawn scaffold); syllable-clapper's probes demonstrate eval-mode/tier
orthogonality (its eval modes are literally named easy/medium/hard).

**Verification (per item, by its agent):** targeted vitest suites incl. new `*.support-tiers.*`
files with reverted-gating non-vacuity evidence; existing reader-fit/PRE suites green; ≥3
real-Gemini probes each via `/api/lumina/eval-test` (hard = stamps present; easy = full help;
no-param = fields absent, byte-compatible legacy). Full per-item evidence: workflow journal
`wf_57eec15d-d3a/journal.jsonl` + `scratchpad/batch2-results-utf8.json`.

**Merge-level gates (orchestrator):** see the commit body — full vitest, `typecheck:lumina`, tsc
baseline, run after all 20 catalog patches were applied serially.

**Orchestration lessons (for the next batch):**
1. Structured-output patches must be applied with **UTF-8 decoding + newline normalization** —
   PowerShell 5.1 `Get-Content` ANSI-decoded the journal and briefly wrote em-dash mojibake into
   the catalogs (caught by artifact scan, fully repaired, 20/20 patches verified byte-correct).
2. The catalog-patches-by-value pattern worked: 7 agents would otherwise have collided in
   `catalog/literacy.ts`; zero collisions occurred.
3. Reserve-the-registers-for-the-orchestrator also proved out: the concurrent 14f session's
   uncommitted register edits were untouched by all 8 agents.

**Residuals:**
- Browser feel-pass on the hard tiers (one sitting, all 8 primitives) — human-only.
- Live-tutor ear-check that the reveal-policy directives hold in real audio — rides any DI/lesson
  sitting at a hard tier.
- calendar-explorer's `resolveGradeBand` fix should be re-checked when 14c (coin-counter G2) is
  worked — same class, now one live instance fixed.
