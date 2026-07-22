# Eval Report: di-letter-sounds — 2026-07-20

First primitive of the Direct Instruction (DI) family. Generator = Fork A
(menu-scoped pool service): Gemini selects target letters from a curated menu;
spoken sound / keyword / emoji / elicitation / aliases attached in code.

## Results (GET /api/lumina/eval-test, generator only — the live loop is a human check)

| Run | topic / intent | Status | Letters produced | Notes |
|-----|----------------|--------|------------------|-------|
| birth (`letter_sound`) | "letter sounds m, s, a, f" | PASS | m, s, a, f | exact objective match, teaching order |
| generic | "phonics" | PASS | m, s, f, a | fell back to starter spread (no letters named) |
| vowels | "short vowel sounds a e i o u" | PASS | a, e, i, o (cap 4) | scoped to vowels; all keyword elicitation |

## G1–G5 Sync Check

- **G1 (required fields per type): PASS** — every challenge carries id, challengeType,
  letter, spoken, keyword, emoji, elicitation, asrAliases. Continuants → `elicitation: isolated`,
  short vowels → `elicitation: keyword` (correctly differentiated).
- **G2 (flat-field reconstruction): N/A** — Fork A. Gemini emits only the wrapper
  (title/description/targetLetters); no per-item content, so no flat-field arrays to rebuild.
- **G3 (eval-mode differentiation): N/A at birth** — no `evalModes[]` yet (`/add-eval-modes` layer).
- **G4 (answer derivability): PASS** — the "answer" is the produced sound; `spoken`/`keyword`
  are the curated-menu ground truth the Live judge scores against. Cannot drift from the item.
- **G5 (fallback quality): PASS** — fallback ladder (model selection → scan objective/topic for
  menu letters → starter set [m,s,a,f]) always yields valid curated challenges; no `?? default`
  ever produces a broken/empty item. Back-fill guarantees ≥ 4 items to demonstrate mastery.

## Answer-leak audit

The grapheme is shown and the child is asked to produce its SOUND — this is the DISTAR
model→guide→test format (the tutor MODELS the sound first), so the display is not a leak; the
grapheme→phoneme mapping IS the skill being taught. No label, panel, or default value discloses
the spoken target beyond the tutor's own modeling line.

## Scope

Continuous (stretchable) letter sounds + short vowels (keyword elicitation). Excluded by design:
letter NAMES (blocked — homophone ruling), digraphs/blends, stop consonants (b/t/p/d/k/g — a
later benched item). No `DEFAULT_ITEMS`-style content ships in the component; all items originate
in the menu-scoped generator.

## NOT covered here (human check — see qa/HUMAN-CHECKS.md)

eval-test exercises the GENERATOR only. The live-judged loop (Gemini Live connect + manual-VAD
mic brackets + in-band sentinel verdicts + DI progression + evaluation submit) needs a real
browser + microphone + voice. Verdict/latency/echo behavior is inherited from the engine
(4 bench runs PASS) but has NOT been exercised through THIS primitive yet.
