# Contract: sound-swap

- **Derived:** 2026-09-28 · evidence window: DI port (2026-08-09, purely verbal) + workspace rollout B2 + w1 payload 2026-09-24 + git
- **Component:** `primitives/visual-primitives/literacy/SoundSwap.tsx` (workspace only) + boss `soundSwap.card.ts` / `soundSwap.boss.ts` + `soundSwapDomain.ts` (items, ask, key, misses, scene, gate) + `soundSwapLevers.ts` + `phonemeVoice.ts` · **Generator:** `service/literacy/gemini-sound-swap.ts` · **Catalog:** `service/manifest/catalog/literacy.ts:2173`
- **Status:** ACTIVE (no open conflicts)

Static derivation for the sound-swap slice of handoff 22 L2.

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-2 phoneme addition / deletion / substitution | catalog evalModes | `literacy.ts` sound-swap entry | live |
| DI port (purely verbal: say the new word) | code [5] | catalog comment "DI MODALITY, PURELY VERBAL (2026-08-09)" | 2026-08-09 |
| Shared teaching workspace + live journey | live [2] + code | `soundSwap.boss.ts` (was `soundSwapWorkspace.ts`); `qa/tutor-reports/sound-swap-runtime-addition-payload-2026-09-24.json` | 2026-09-24 |
| Support tiers (picture caption, target highlight) | code [5] | `SoundSwap.tsx` `showWordImage` / `showTargetHighlight` | 2026-08 |

## Requirements

### R1 — The answer is the new word, said aloud · OBSERVED · RE-BASED 2026-10-20 (boss)
- **Re-based (boss, 2026-10-20):** the scripted DISTAR lines (`soundSwapScript.ts`: item cue, judging contract, move-on, how-to-play, `[PRONOUNCE_SOUND]`) are deleted; they had not been sent since the workspace port. The ask is `swapAsk` ("The word is cat. Take away /k/. Say the new word."), the move from `moveAsk` (now in `soundSwapDomain.ts`, sounds made sayable by `phonemeVoice`). What the judging contract said is now the `SpokenKey`: the new word; sounding it out first is right; the starting word said back, a different word, or separate sounds are not. A tapped sound calls `runner.requestHear` (silent, host-authored, the sound only). The ask never says the new word by construction (`askLeaks` on `validate`; `given` is the ask's frame only, never the item's words or sounds). Probe: `SoundSwap.workspace.test.tsx`.
- **Property:** the learner hears the starting word and one named sound to add, take away or change, and says the new word; the starting word said back is the named miss. The move always names its sound. Sound tiles are tap-to-hear only (silent host request). No answer buttons.
- **Demanded by:** DI port; workspace.
- **Evidence:** `soundSwapDomain.ts` (`swapAsk`, `moveAsk`, `swapKey`); `SoundSwap.workspace.test.tsx`.
- **Probe:** `npm test -- SoundSwap.workspace`.

### R2 — The new word is never shown, pictured or said before credit · OBSERVED
- **Property:** the result word and its picture appear only after credit (`data-swap-reward`); the scene says so; the tutor never says it before a try.
- **Demanded by:** Pedagogy rule #1 (readers would read it).
- **Evidence:** `SoundSwap.tsx` stage render; catalog guidance.
- **Probe:** `npm test -- SoundSwap.workspace`.

### R3 — Tier invariants · OBSERVED
- **Property:** on the model path the tier never changes the words or the sound (on the word-space path, R5, it picks them); it withdraws the picture caption and, at hard, the substitution highlight. Pre-readers never see the prose caption or the grade/operation badges.
- **Demanded by:** support tiers; K band.
- **Evidence:** `SoundSwap.tsx` (`showImage`, `highlightIdx`, `isPreReader`).
- **Probe:** `npm test -- SoundSwap`.

### R4 — In-item levers · OBSERVED · RE-BASED 2026-10-20 (one lever set)
- **Re-based (boss, 2026-10-20):** the three levers are now `SWAP_LEVERS` (`bossLevers.ts`): `swap_model` type `model` (support fact: the lesson tier, default medium), `mark_target_sound` `marks`, `easier_operation_item` `easier`; swap_build: `pattern_card` `clue`, `model_word` `model`, `small_bank` `easier`, passed to `LetterBuildSurface` through its `boss` prop. Same offers, words and screen; the on-screen fact is `onScreen` (was `levers_on_screen`). Every spoken miss is now answered by a lever (the catalog no longer lists them unanswered).
- **Property:** `mark_target_sound` pulses the tile to change or take away (only where the tier's highlight is not already up) or shows an empty dashed tile where an added sound goes, never its letter; `swap_model` shows and voices the same operation on words no session item uses, with a sound not the item's and a new word that does not rhyme with the item's answer; `easier_operation_item` opens an ungraded item of the same operation on a first, held sound. Carriers `shown` / `both`.
- **Demanded by:** handoff 22 L2.
- **Evidence:** `qa/eval-reports/levers-literacy-L2-2026-09-28.md`.
- **Probe:** `npm test -- soundSwapLevers SoundSwap.levers.workspace`; swap_build: `LetterBuild.workspace.test.tsx`.

### swap_build — open build fork · OBSERVED (2026-10-08)
- **Property:** `swap_build` is its own surface, the shared letter build (`LetterBuildSurface.tsx`, rules in `letterBuild.ts`), mounted when the payload has `task: 'letter_build'`; the existing modes are unchanged. Asks are code-owned from familiar CVC words (`letterBuildWords.ts`), scoped to the lesson's letters; no key ships. Code checks everything the ask states (shape, vowel, family, one letter changed, the given word, a repeat); the shared word judge (`judgeWordBuild`, `only: 'real_word'`) decides whether the word is real.
- **Probe:** `LetterBuild.workspace.test.tsx`; headless drive `qa/open-build/sound-swap-2026-10-08/drive/`.

### R5 — Word space: with a support tier, code picks every pair · OBSERVED 2026-10-13
- **Property:** with `config.difficulty` set and no remediation focus, addition, deletion and substitution draw from `service/wordSpace/soundSwapSpaces.ts`: two familiar one-syllable words whose phonemes differ by one added, removed or changed sound, computed from the library's pronunciations. Beta: first < last < middle sound, a sound inside a cluster (lip → slip) hardest, deleting harder than adding, one-feature changes (b/p, e/i) and stops harder. K adds and removes only a lone first or last sound. Plural/past pairs, heteronyms and the unstressed function words (to, and, the, a) are left out. `deriveOperationFields` computes the move fields from the phoneme arrays, as on the model path; each challenge carries a `wordSpace` stamp. If any operation cannot fill its slots, the session takes the model path. swap_build unchanged.
- **Probe:** `npm test -- src/components/lumina/service/wordSpace/soundSwapSpaces.test.ts`; `scripts/word-space-lab/probe.sh sound-swap after ...`.

## Conflicts

None open.

## Catalog projection

- **description:** corrected 2026-10-20 (a credited word moves the lesson on; the open build named).

## Changelog
- 2026-10-20 — **Boss migration** (`soundSwap.card.ts` + `soundSwap.boss.ts`, spokenBoss). R1 and R4 RE-BASED (above); R2, R3, R5 and the swap_build fork hold. Spoken items: a `SpokenKey`. swap_build: a null key; `LetterBuildSurface` takes the boss's assignment and lever set (`boss` prop). Deleted: `soundSwapScript.ts` + `__tests__/SoundSwap.di-script.test.ts` (still-true ask assertions moved to `SoundSwap.workspace.test.tsx`), `adapters/soundSwapLive.ts` (gate moved to `soundSwapDomain.ts`), hand Pip + `pip/soundSwapPipPose.ts` + `pip/SoundSwap.surface.test.tsx`, the catalog `tutoring` block and guidance prose. `soundSwapWorkspace.ts` became `soundSwapDomain.ts`. Generator (model path): a challenge whose new word repeats an earlier one is dropped (cat, bat, hat → at was one answer said three times), and the prompt asks for distinct new words. The submission's metrics are unchanged.

- 2026-10-13 — **R5 word space** (`/add-word-space`). Before (`qa/word-space-lab/2026-10-13/sound-swap/before.txt`): addition was at/an/it plus a first sound at every tier; deletion at medium returned 0 challenges in both runs; hard deletion shipped stop → sop; substitution repeated cat, pig, sun, hop. After: addition K easy at → sat, egg → leg … hard see → seat, cow → couch; G1 hard room → broom, fill → film; deletion G1 hard ranch → ran, film → fill; substitution K hard line → lime, cup → cop. R3 narrowed to the model path.

- 2026-10-08: `swap_build` open build added as a fork (OB-3L). New challenge type; no existing requirement edited.

- 2026-09-28 — derived (initial) with R4 (levers). --check COMPATIBLE: `SoundSwap.workspace` passes.
