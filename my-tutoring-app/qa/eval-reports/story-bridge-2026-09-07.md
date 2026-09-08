# Eval Report: story-bridge — 2026-09-07 (birth, L0 + L2)

K Comparing Texts, judged-loop GESTURE primitive born from the design-studio theme "Story Bridge" (`qa/curriculum-coverage/design-studio.html`). Core task `match_character`: the Live tutor reads two stories, names an anchor character, the child taps the far-shore character who acted alike.

## Generation (eval-test single-test path, `evalMode=match_character`, K)

| Run | Topic | Status | Stories | Challenges | Fallback | Notes |
|-----|-------|--------|---------|------------|----------|-------|
| 1 | Comparing characters across two stories | pass | 2 | 3 | no | Descriptive names ("Sleepy Cat" ↔ "Yawning Dog") let a child match from names alone → name gate + prompt line added |
| 2 | friendship stories | pass | 2 | 3 | no | Looks-trap present (👦 Sam / 👦 Max not partners); one emoji/name gender mismatch (cosmetic) |
| 3 | animals who help | pass | 2 | 3 | no | One `sharedBehavior` drifted from the evidence ("carried heavy sticks to fix a broken bridge" vs blocks/logs) → prompt fidelity line added |
| 4 | friends who help (tutor-test probe) | pass | 2 | 3 | no | post-fix; plain names, evidence-true shared clauses |
| 5 | animals who help (tutor-test probe) | pass | 2 | 3 | no | post-fix |

Catalog-mode eval-test does not list the primitive (no `evalModes` at L0 — expected; `/add-eval-modes` owns it). The route's `validateChallengeTypes` skips for the same reason.

## G1–G5 sync check

- **G1 required fields:** every story carries title / sceneEmoji / opening / closing / 3 characters (id, name, emoji, sentence); every challenge carries pairId, anchor/target story + character ids, sharedBehavior. PASS (5/5 runs).
- **G2 flat-field reconstruction:** 29 flat fields → 2 stories × 3 characters + 3 shared behaviors; no empty arrays. PASS.
- **G3:** N/A at birth (single challenge type).
- **G4 answer derivability:** every pair is defensible from the two evidence sentences the tutor reads; paired emojis differ; all six names distinct. Residual: `sharedBehavior` wording can paraphrase beyond the evidence (run 3) — prompt-level fix, not gated.
- **G5 fallback quality:** the explicit familiar pair fires only when NO pair survives (0/5 runs); the description discloses it when it does. Retry-once, reject-whole; no field-level `??` defaults.

## Answer-leak audit (walked)

- Story text is audio-only pre-verdict; the two evidence sentences print only on the affirm. Cards carry picture + name, one chrome for all, anchor ring only; far shore reshuffled per item; anchor shore never tappable.
- **Two leak classes caught and gated at birth:** (1) a far-shore title containing a character's name (the fallback's own "The Little Bird"/Bird — caught by the script test), gate `titleNamesNoCharacter`; (2) describing-word names (run 1), gate in `isSayableName` (two-word names whose first word ends -y/-ing/-ful/-ish). `sharedBehavior` is gated name-free; paired emojis must differ.
- Cue contract: the ask names the anchor only; correction re-models the anchor's evidence + "both …" and never names the partner; affirm names the pair and reads both sentences.

## Tests

- `storyBridgeScript.test.ts` 14/14 (gates, cue leak rules, verdict cues, generator validation).
- DI-script suites after the drive-plan adapter: 40 files / 1636 tests pass.
- `typecheck:lumina` 0; full tsc shows 0 errors in touched files.

## L2 tutoring block + `/tutor-test`

Tier 1: WARN only (`data-bag-unparsed`, `no-sendtext-moments` — both expected for a judged pack whose runner pushes `contextFor`). Tier 2 (`&probe=1`): all 8 contextKeys and 8 `{{vars}}` resolve, 0 `(not set)` — via the new `diPortContextBag` (any DI port resolves through its pack's `contextFor`).

## Runtime: headless judged-loop drive (`/tutor-test --di`, plain wrong)

[Report](../tutor-reports/story-bridge-live-di-plain-2026-09-07.md): **PASS, no findings.** 13 beats; 3/3 wrong taps refused with the scripted "My turn:" correction, 3/3 right taps affirmed with "Yes!", tutor silent on every hands-hold beat, opening line carried greeting + how-to-play + both stories + the first ask; complete cue spoken. `packGateIssues: []`, 0 challenges dropped.

What a green drive buys: the LOOP and the JUDGE's cue compliance (sentinel discipline, silence on taps, correction shape). It does not exercise acoustics, a real child's tap timing, or the stage's shuffle/reveal in a browser — a browser/mic sitting is owed (human-check queue).

## Residuals (queued on the birth certificate)

1. Browser/mic sitting: stage shuffle, reveal-on-affirm, hear-again, physical tap on a tablet.
2. `sharedBehavior` evidence-fidelity is prompt-level; add a code check (shared clause's content words ⊂ the two evidence sentences' words) if drift recurs.
3. Curriculum fit: K MATCH but the birth target LA006-04-B ranks 5th behind single-story A — lead the description with "match … using visual aids".
4. `affordances` catalog tags missing (every other entry has them) → `/add-affordances`.
