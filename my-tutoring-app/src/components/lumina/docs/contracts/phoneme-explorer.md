# Contract: phoneme-explorer

- **Derived:** 2026-09-28 · evidence window: eval-report 2026-03-15 (PE-1) + topic-fidelity 2026-07-14 + DI port 6 live reports 2026-08-11/16 + medial probe 2026-09-05 + workspace rollout C1 2026-09-24 + w1 payloads + git to 2026-03
- **Component:** `primitives/visual-primitives/literacy/PhonemeExplorer.tsx` (workspace only) + `phonemeExplorerWorkspace.ts` (assignment, scene, tap requests) + `phonemeExplorerScript.ts` (items, session gate, retired DI cue lines) + `phonemeVoice.ts` · **Generator:** `service/literacy/gemini-phoneme-explorer.ts` · **Catalog:** `service/manifest/catalog/literacy.ts:1899` · **Live adapter:** `components/live-activity/adapters/phonemeExplorerLive.ts`
- **Status:** ACTIVE (no open conflicts)

Derived as step 1 of the phoneme-explorer slice of handoff 22 L2. Static derivation, same channels as the
rhyme-studio contract the same day.

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-1 phonemic awareness: beginning / ending / middle sound, blend, segment, manipulate | catalog + topic-fidelity [2] | `qa/topic-fidelity/phoneme-explorer-2026-07-14.md` (routing away from rhyme) | 2026-07-14 |
| Medial short-vowel objectives ("identify the short a/e/i/o/u sound") | medial probe [2] | `qa/tutor-reports/phoneme-medial-probe-2026-09-05.json` | 2026-09-05 |
| DI port 6 (session gate, sayability, no bare-sound answers) | live [2] | `qa/tutor-reports/phoneme-explorer-live-di-*-2026-08-16.md` | 2026-08-16 |
| Shared teaching workspace + live journey harness | live [2] + code | `e8411569`; `qa/tutor-reports/phoneme-explorer-w1-*-2026-09-24*.json` | 2026-09-24 |
| Support tiers (easy/medium/hard, K band wins) | code [5] | `gemini-phoneme-explorer.ts:155-250` | 2026-08 |
| Pip shared surface | code [5] | `c6f608e9` | 2026-09-15 |

## Requirements

### R1 — Every answer is a spoken word or count · OBSERVED
- **Property:** isolate / ending / medial = the learner says the card word sharing the beginning / ending / middle sound; blend = says the word; segment = says the count; manipulate = says the new word. The learner is never asked to produce an isolated sound. Cards, tiles and pictures are tap-to-hear only (a silent host request for that word or sound).
- **Demanded by:** DI port 6; workspace C1; catalog constraints.
- **Evidence:** `phonemeExplorerWorkspace.ts:17-38,61-66`; `PhonemeExplorer.workspace.test.tsx`.
- **Probe:** `npm test -- PhonemeExplorer.workspace`.

### R2 — What is never shown or said before credit · OBSERVED
- **Property:** ending shows pictures only (target and card words unprinted); medial never prints its target; segment never prints its word (a reader would count letters) and never breaks it into sounds; blend never shows or says the word; manipulate never shows the new word. The ending / middle sound is named only in feedback. The ask never names the medial vowel.
- **Demanded by:** Pedagogy rule #1; DI port 6.
- **Evidence:** `PhonemeExplorer.tsx` render helpers; `phonemeExplorerScript.ts:522-560`; catalog guidance.
- **Probe:** `npm test -- PhonemeExplorer.workspace`.

### R3 — Session gate: no answer heard before it is asked · OBSERVED
- **Property:** a blend or manipulate answer that an earlier item said or printed drops the later item (`itemsFromChallenges`); unsayable walks drop blend items; `c`, `q`, `x` are never spoken as phonemes; an isolate sound label that contains a card word drops the item.
- **Demanded by:** DI port 6 probe (parallel per-mode generation collides).
- **Evidence:** `phonemeExplorerScript.ts:150-470`.
- **Probe:** `npm test -- PhonemeExplorer`.

### R4 — Support tier invariants · OBSERVED
- **Property:** the tier never changes the content. easy/medium/hard withdraw, in order: the example card (isolate), the picture cue and the read-aloud (above K only), the blend cue and the printed operation (hard). At K the picture and the read-aloud are never withdrawn; ending always reads its menu.
- **Demanded by:** support-tier campaign; K band.
- **Evidence:** `gemini-phoneme-explorer.ts:155-250`; `PhonemeExplorer.support-tiers.test.tsx`.
- **Probe:** `npm test -- PhonemeExplorer.support-tiers`.

### R5 — One workspace path, one evaluation · OBSERVED
- **Property:** workspace only (`withWorkspaceOnly`); bound sessions send `tutoring: null`; one evaluation per session with `PhonemeExplorerMetrics`.
- **Demanded by:** workspace C1; IRT.
- **Evidence:** `PhonemeExplorer.tsx` end; `lessonWorkspacePlan.ts:61-66`.
- **Probe:** `npm test -- PhonemeExplorer.workspace lessonWorkspacePlan`.

### R6 — In-item levers, every mode · OBSERVED
- **Property:** help never marks the item's answer or says its asked sound: `position_model` lights one box of a pool word that no session item uses, whose sound there no session item asks; `slide_tiles` moves the item's own tiles together and neither shows nor says the word; `push_tokens` counts only the learner's pushes, with no boxes drawn ahead; `mark_position` empties the changing box and never shows the new sound; `name_cards`, `example_word` and `operation_detail` come back only where the tier withdrew them. Simplify opens an ungraded practice item of the same mode from `CVC_POOL` / `TWO_SOUND_POOL` / a free rhyme family, on words and a sound the session never uses. Every lever is `shown` or `both`.
- **Demanded by:** handoff 22 L2; trigger ladder.
- **Evidence:** `qa/eval-reports/levers-literacy-L2-2026-09-28.md`.
- **Probe:** `npm test -- phonemeExplorerLevers PhonemeExplorer.levers.workspace`.

## Conflicts

None open.

## Catalog projection

- **description / constraints:** faithful. The description still names the DI clock ("the tutor asks, waits and responds … a credited answer moves the lesson on"), which is true in effect.
- **tutoring:** retired DI block; bound sessions never receive it (R5).

## Changelog

- 2026-09-29 — R6 amended (handoff 24): medial and ending also draw from `LONG_MIDDLE_POOL` (rain, mail, feet, seal, boat, soap; boxes print the vowel team, the tutor says the long vowel). Measured gap: a medial session asking all five short vowels, and an ending session asking final n/p/t/g, had no model and no practice item. R2 holds: no session word, no asked sound.
- 2026-09-28 — R6 added (levers, handoff 22 L2). --check COMPATIBLE: R1-R5 suites pass (`PhonemeExplorer.workspace`, `.support-tiers`).
- 2026-09-28 — derived (initial). 5 requirements (all OBSERVED), 0 conflicts.
