# Reader Fit: comparison-builder @ PRE — item 2b (2026-07-16)

Browser-confirmed open in the 2026-07-16 Pulse walk. Three fixes, one loop, in
priority order. Contract-first: derived `docs/contracts/comparison-builder.md`
(7 requirements, 0 conflicts, 1 gap) BEFORE editing — the 2026-07-16 edit is
assessed **COMPATIBLE** (no fork; see the contract changelog).

## Fixes

### 1 — PEDAGOGY-CRITICAL: K chrome band-gate (count-leak killed)
At `gradeBand==='K'` (`isK`) the component now hides the adult chrome that either
stranded or handed the answer to a non-reader:
- **"Left: N / Right: N" count badges** — HARD-gated OFF at K (`showCountBadges && !isK`).
  This is the rule-#1 leak the Pulse walk flagged: a child meant to compare the two
  group PICTURES could read the numerals and skip the comparison. (reader-fit Audit A
  had already classified it "Supportive→leaks count".)
- **"Challenge 1 of N" counter + mode tabs** — the whole `LuminaModeTabs`/
  `LuminaChallengeCounter` row is `!isK`.
- **"Kindergarten" grade badge + challenge-type badge** — the header badge cluster is `!isK`.

Kept at K (the answer surface, per contract R1): the two tappable group pictures + the
middle "=" (compare-groups), plus the LuminaPrompt instruction (now re-voiceable, see #3).

### 2 — one_more_less DISAMBIGUATE symmetry ("one less" voiced identically)
The Pulse walk found the tutor voiced the beat after "one MORE" but was **silent on
"one LESS"**. Fixed on both layers:
- **COMPONENT** — a new `voiceOtherOneMoreLess(justAnswered)`: for an askFor='both'
  challenge at K, after the child answers ONE part the component fires a silent
  `[DISAMBIGUATE]` system trigger voicing the OTHER part ("Now find one LESS than N /
  one MORE than N"), symmetric by construction, each side latched to fire once
  (`disambiguatedMoreRef`/`disambiguatedLessRef`, cleared in the per-challenge reset).
  Answer-free (never states N±1).
- **CATALOG** (`math.ts` ORIENT directive) — the one-more-one-less branch rewritten to
  voice EVERY ask the screen shows, "giving 'one less' exactly the same attention as
  'one more'… Never skip or shortchange the 'one less' side."

### 3 — Persistent 🔊 "Read me" replay (pilots a systemic pattern)
New shared helper `primitives/shared/ReadMeButton.tsx` (`buildReadMeMessage` +
`<ReadMeButton>`, a thin wrapper over the kit's `LuminaReadAloud`). Rendered at K in the
prompt row (SAME position across all four eval modes), it re-voices the current
instruction + an answer-free per-mode ask on demand — so a non-reader who missed or
forgot the ORIENT can always re-hear it. Built to generalize (BACKLOG systemic item,
akin to `PreReaderSelfCheck`). Student-initiated → NON-silent (claims focus); routed
through the helper so it isn't a component system-trigger.

## Verification (Verification Doctrine — runtime-exercised, not tsc-only)

| Gate | Result |
|---|---|
| `tsc --noEmit` (project-local, abs path) | **0 new** (808 baseline; 1 dead `=== 'K'` inside `!isK` fixed) |
| `typecheck:lumina` | **0 errors** |
| jsdom `ComparisonBuilder.reader-fit.test.tsx` | **12/12** (5 pre-existing + 4 chrome band-gate + 3 DISAMBIGUATE symmetry) |
| full vitest suite | **790/790** (64 files) |
| tutor-test Tier-1 (static audit) | **pass, 0 findings** (DISAMBIGUATE silent; no leak; no orphan) |
| tutor-test Tier-2 `--probe` (one_more_less, K) | **pass, 0 findings**; real K content; all vars resolve `component`; no `(not set)`; ORIENT renders symmetric + answer-free |
| **Tier-3 live `--lesson --runs 3` (one_more_less)** | **decrement beat spoke the "one less" ask 3/3** — the Pulse silence bug is fixed. Report: `qa/tutor-reports/comparison-builder-live-lesson-2026-07-16.md` |

jsdom band assertions: at K the count badges (`/Left:/`), counter (`/Challenge 1 of/`),
mode tabs + type badge (`/Compare Groups/`), and Kindergarten badge are ABSENT and the
🔊 Read-me button is PRESENT; the grade-1 control has all chrome present and NO Read-me.

Live transcript (all 3 runs voiced the decrement identically):
- R1 *"You found one more! Now find one LESS than 3. Tap the number that is one less."*
- R2 *"You found one more! Now let's look for the number on the other side. Tap the one that is one less."*
- R3 *"You found the number for one more! Now find the number for one LESS than 3. Tap the number…"*

Style metrics healthy: 0.0 superlatives/turn, stacked-? 0.07, ends-with-? 0.40.

## Residuals

- **Single-run note (NOT confirmed, ≥2/3 bar):** `stimulus-not-read @next_item` [1/3] —
  on run 1 the advance ORIENT for the 2nd one_more_less challenge phrased the ask
  (5 droplets, "if one evaporates…") without the literal "one more/less" keyword the
  harness must_include is strict on. Gemini phrasing variance on the generic advance
  beat, not the decrement fix. Watch across future runs; not a blocker.
- **Pixel look → HUMAN-CHECKS** (#26): K chrome-gated compare screen + the 🔊 Read-me
  placement/tap target across the four modes.
- **Other three modes' remaining PRE band-gate** (compare_numbers `< > =` read, order
  direction badge, one_more_less 21-cell load) stay as contract **G1** / BACKLOG 2b
  tail — the 🔊 Read-me + symmetric DISAMBIGUATE now cover them at the scaffold layer;
  the per-mode picture-primary passes are follow-ups.
