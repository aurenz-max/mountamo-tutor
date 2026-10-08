# Contract: word-flip

- **Derived:** 2026-09-28 · evidence window: DI port 3 (2026-08) + reader-fit (`WordFlip.reader-fit.test.tsx`) + workspace rollout B2 + w1 payload + git
- **Component:** `primitives/visual-primitives/literacy/WordFlip.tsx` (workspace only) + `wordFlipWorkspace.ts` + `wordFlipScript.ts` (model pairs, retired DI lines) · **Generator:** `service/literacy/gemini-word-flip.ts` · **Catalog:** `service/manifest/catalog/literacy.ts:3867`
- **Status:** ACTIVE (no open conflicts)

Static derivation for the word-flip slice of handoff 22 L2.

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-2 inflection: plurals (-s, -es, -y→ies, irregular), past tense (-ed, irregular) | catalog evalModes | `literacy.ts` word-flip entry | live |
| K PRE band | reader-fit [2] | `WordFlip.reader-fit.test.tsx`; `qa/reader-fit/word-workout-word-flip-PRE-2026-07-15.md` | 2026-07-15 |
| DI port 3 (answer chips deleted: tapping printed plurals is reading, and printed the answer) | code [5] | `wordFlipScript.ts` header | 2026-08 |
| Shared teaching workspace + live journey | live [2] + code | `wordFlipWorkspace.ts`; w1 payload | 2026-09-24 |

## Requirements

### R1 — The answer is the changed word, said aloud · OBSERVED
- **Property:** plural: "one X, now N: N what?"; past: "today I X … yesterday I…". The source word said back and a doubled rule (dogses, jumpeded) are not it. No answer chips; the source card is tap-to-hear only.
- **Demanded by:** DI port 3; workspace.
- **Evidence:** `wordFlipWorkspace.ts`; `WordFlip.workspace.test.tsx`.
- **Probe:** `npm test -- WordFlip.workspace`.

### R2 — The changed word is a blank until credit · OBSERVED
- **Property:** the many/yesterday card shows the picture(s) and a blank; the answer prints only on credit (`data-flip-reward`). A rule is modeled only on a word the session never asks (`pickModelPair`).
- **Demanded by:** Pedagogy rule #1; DI port 3.
- **Evidence:** `WordFlip.tsx` frame; `wordFlipScript.ts:110-180`.
- **Probe:** `npm test -- WordFlip`.

### R3 — Pre-reader chrome · OBSERVED
- **Property:** at K the grade and mode badges, the counter and the hint line are hidden.
- **Demanded by:** K PRE band.
- **Evidence:** `WordFlip.tsx`; `WordFlip.reader-fit.test.tsx`.
- **Probe:** `npm test -- WordFlip.reader-fit`.

### R4 — In-item levers · OBSERVED
- **Property:** `rule_model_cards` (regular) / `irregular_model` (irregular) show a before/after card pair on a word no session item uses; an irregular model never shares the item's change pattern (foot never gets tooth or goose). `familiar_noun` / `common_irregular` open an ungraded item of the same rule on another common word, not the model's. Carriers `both` / `shown`.
- **Demanded by:** handoff 22 L2.
- **Evidence:** `qa/eval-reports/levers-literacy-L2-2026-09-28.md`.
- **Probe:** `npm test -- wordFlipLevers WordFlip.levers.workspace`.

### R5 — `build_inflect` is a fork · OBSERVED
- **Property:** `build_inflect` (open build: base + ending cards, "I'm done!", many words pass) is its own challenge type and mounts its own surface (`WordBuildAffix` with the inflect rules). R1 and R2 do not apply to it: the answer is made from cards, not said, and the board shows the cards from the start. The six spoken modes are unchanged; a blend with a spoken mode leaves the build out.
- **Demanded by:** OB-8L (`qa/open-build/ROADMAP.md`).
- **Evidence:** `qa/open-build/word-flip-2026-10-08/REPORT.md`.
- **Probe:** `npm test -- WordFlip.buildInflect.workspace`.

## Conflicts

None open.

## Changelog

- 2026-09-28 — derived (initial) with R4 (levers). `MODEL_PAIRS` exported for the levers. --check COMPATIBLE: `WordFlip.workspace`, `WordFlip.reader-fit` pass.
- 2026-10-08 — R5 added: `build_inflect` open build is a fork; R1-R4 unchanged (`WordFlip.workspace` and levers tests pass).
