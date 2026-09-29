# Contract: sound-swap

- **Derived:** 2026-09-28 · evidence window: DI port (2026-08-09, purely verbal) + workspace rollout B2 + w1 payload 2026-09-24 + git
- **Component:** `primitives/visual-primitives/literacy/SoundSwap.tsx` (workspace only) + `soundSwapWorkspace.ts` + `soundSwapScript.ts` (move wording, retired DI lines) + `phonemeVoice.ts` · **Generator:** `service/literacy/gemini-sound-swap.ts` · **Catalog:** `service/manifest/catalog/literacy.ts:2173`
- **Status:** ACTIVE (no open conflicts)

Static derivation for the sound-swap slice of handoff 22 L2.

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-2 phoneme addition / deletion / substitution | catalog evalModes | `literacy.ts` sound-swap entry | live |
| DI port (purely verbal: say the new word) | code [5] | catalog comment "DI MODALITY, PURELY VERBAL (2026-08-09)" | 2026-08-09 |
| Shared teaching workspace + live journey | live [2] + code | `soundSwapWorkspace.ts`; `qa/tutor-reports/sound-swap-runtime-addition-payload-2026-09-24.json` | 2026-09-24 |
| Support tiers (picture caption, target highlight) | code [5] | `SoundSwap.tsx` `showWordImage` / `showTargetHighlight` | 2026-08 |

## Requirements

### R1 — The answer is the new word, said aloud · OBSERVED
- **Property:** the learner hears the starting word and one named sound to add, take away or change, and says the new word; the starting word said back is the named miss. The move always names its sound. Sound tiles are tap-to-hear only (silent host request). No answer buttons.
- **Demanded by:** DI port; workspace.
- **Evidence:** `soundSwapWorkspace.ts`; `soundSwapScript.ts:81-115`; `SoundSwap.workspace.test.tsx`.
- **Probe:** `npm test -- SoundSwap.workspace`.

### R2 — The new word is never shown, pictured or said before credit · OBSERVED
- **Property:** the result word and its picture appear only after credit (`data-swap-reward`); the scene says so; the tutor never says it before a try.
- **Demanded by:** Pedagogy rule #1 (readers would read it).
- **Evidence:** `SoundSwap.tsx` stage render; catalog guidance.
- **Probe:** `npm test -- SoundSwap.workspace`.

### R3 — Tier invariants · OBSERVED
- **Property:** the tier never changes the words or the sound; it withdraws the picture caption and, at hard, the substitution highlight. Pre-readers never see the prose caption or the grade/operation badges.
- **Demanded by:** support tiers; K band.
- **Evidence:** `SoundSwap.tsx` (`showImage`, `highlightIdx`, `isPreReader`).
- **Probe:** `npm test -- SoundSwap`.

### R4 — In-item levers · OBSERVED
- **Property:** `mark_target_sound` pulses the tile to change or take away (only where the tier's highlight is not already up) or shows an empty dashed tile where an added sound goes, never its letter; `swap_model` shows and voices the same operation on words no session item uses, with a sound not the item's and a new word that does not rhyme with the item's answer; `easier_operation_item` opens an ungraded item of the same operation on a first, held sound. Carriers `shown` / `both`.
- **Demanded by:** handoff 22 L2.
- **Evidence:** `qa/eval-reports/levers-literacy-L2-2026-09-28.md`.
- **Probe:** `npm test -- soundSwapLevers SoundSwap.levers.workspace`.

## Conflicts

None open.

## Catalog projection

- **description:** stale on the clock ("its own affirmation moves the lesson on"); true in effect. Not changed.

## Changelog

- 2026-09-28 — derived (initial) with R4 (levers). --check COMPATIBLE: `SoundSwap.workspace` passes.
