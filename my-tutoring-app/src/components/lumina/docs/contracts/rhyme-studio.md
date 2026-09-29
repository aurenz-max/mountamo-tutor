# Contract: rhyme-studio

- **Derived:** 2026-09-28 · evidence window: eval-report 2026-03-15 + reader-fit PRE 2026-07-15 (live `--lesson` 3/3 ×2) + DI bench `open_set_word` 2026-08-19 + live DI reports 2026-08-19 + workspace rollout C1 2026-09-24 + w1 payloads 2026-09-24/26 + git to 2026-03
- **Component:** `primitives/visual-primitives/literacy/RhymeStudio.tsx` (workspace only, `withWorkspaceOnly`) + `rhymeStudioWorkspace.ts` (assignment, scene, hear request) + `rhymeStudioScript.ts` (items, collection state, model pair; the retired DI cue lines still live here) · **Generator:** `service/literacy/gemini-rhyme-studio.ts` · **Catalog:** `service/manifest/catalog/literacy.ts:1481` · **Live adapter:** `components/live-activity/adapters/rhymeStudioLive.ts`
- **Status:** ACTIVE (one open conflict on the easy tier, C1)

Derived as step 1 of handoff 22 L2 (`qa/live-runtime-handoffs/22-literacy-levers.md:57`), before in-item
levers are added. Static derivation: no fresh census (channel [1] = the reader-fit census note), channel [3]
and [4] not attempted (as for the L1 contracts, same day).

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| K rhyme lesson: recognition + identification drawn together (K.RF.2.a) | census [1] + reader-fit [2] | `qa/reader-fit/rhyme-studio-PRE-2026-07-15.md` | 2026-07-15 |
| K PRE band (pre-reader), READY (RF-1..RF-3) | reader-fit [2] | `qa/EVAL_TRACKER.md:708-710` | 2026-07-15 |
| Free rhyme generation ("tell me a word that rhymes with cat"), production + collection | catalog constraints + DI bench [2] | `qa/di-bench/run-2026-08-19-open-set-word.md`; `c3b30098` | 2026-08-19 |
| Shared teaching workspace (tutor/JEV, rollout C1) + live journey harness | live [2] + code | `qa/tutor-reports/workspace-rollout-C1-2026-09-24.md`; `liveJourneySpec.ts:1233` | 2026-09-24 |
| Misconception loop (`contrast_rime` / `diagnostic_option` / `constrained_production`) | code [5] | `gemini-rhyme-studio.ts:18,522,583` | 2026-07 |
| Support tiers (easy / medium / hard) | code [5] | `gemini-rhyme-studio.ts:225-305`; `423c58f5` | 2026-08 |
| Pip shared surface | code [5] | `c6f608e9`; `pip/rhymeStudioPipPose.ts` | 2026-09-15 |
| Learner interests theming | code [5] | `704fa9cc` | 2026-09 |

## Requirements

### R1 — Every mode is answered out loud; nothing is tapped to answer · OBSERVED
- **Property:** recognition = the learner says yes or no; identification = says the choice that rhymes from the visible closed set; production = says any real rhyme with nothing on screen but the target; collection = says three different rhymes, one per slot, each credited word filling its slot. Tapping a word card only asks the tutor (silent host message) to repeat the question. No Next / Check / Start gate. A simplify lever never turns a spoken mode into a choice or a tap (R2 of handoff 22).
- **Demanded by:** user ruling 2026-08-12 (recognition spoken); open_set_word bench (production); workspace C1.
- **Evidence:** `RhymeStudio.tsx` header; `rhymeStudioWorkspace.ts:14-40,72-73`; `RhymeStudio.workspace.test.tsx`.
- **Probe:** `npm test -- RhymeStudio.workspace`.

### R2 — Nothing names the rhyme before credit · OBSERVED
- **Property:** before a credited answer, no word on the item is stretched, split or lit at its ending; the ask never names the rime; the rhyming choice is ringed only after credit; recognition lights endings only after the verdict (the comparison only when the pair rhymes). Tutor guidance forbids naming the ending or stretching a word. Any teaching of the rule acts on a code-owned model pair whose words and FAMILY are outside the session (`pickModelRhymePair`, family exclusion).
- **Demanded by:** every consumer (Pedagogy rule #1); DI script question 1.
- **Evidence:** `RhymeStudio.tsx:410-440` (leak guards); `rhymeStudioWorkspace.ts:13`; `rhymeStudioScript.ts:95-102,408-443`; `RhymeStudio.workspace.test.tsx` "marks the rhyming choice only after credit".
- **Probe:** `npm test -- RhymeStudio.workspace RhymeStudio.di-script`.

### R3 — Production and collection judge by a rule, never a list · OBSERVED
- **Property:** production and collection accept any real word that rhymes with the target, not the target itself, not a made-up word; collection also refuses a word already collected. No example rhyme is ever put on screen or in the tutor's key (the "nake" nonword was a generated acceptable answer). Empty collection slots show no example.
- **Demanded by:** open_set_word bench; user ruling 2026-08-18 ("trust the model").
- **Evidence:** `rhymeStudioScript.ts:1-60,300-330`; `rhymeStudioWorkspace.ts:35-38`.
- **Probe:** `npm test -- RhymeStudio.workspace` (collection key names the collected words).

### R4 — Pre-reader picture surface · OBSERVED
- **Property:** at K every word the learner must tell apart (target, comparison, every option) carries a depicting emoji from the curated `K_RHYME_FAMILIES` menu, attached in code (never asked of the model); the picture is primary and the word a caption; no rime colouring, no prose image caption, no adult chrome. `tutorNamesOptions` and `showWordImage` are forced true at K.
- **Demanded by:** K PRE band (RF-2, RF-3).
- **Evidence:** `gemini-rhyme-studio.ts:40-78,680-690,300-302`; `RhymeStudio.tsx:318-340`; `RhymeStudio.reader-fit.test.tsx`.
- **Probe:** `npm test -- RhymeStudio.reader-fit gemini-rhyme-studio`.

### R5 — Recognition content integrity · OBSERVED
- **Property:** recognition pairs never use irregular-spelling words (`IRREGULAR_RHYME_WORDS`); `doesRhyme` is trusted from the model, not recomputed from spelling (RS-3 removed suffix validators that flipped "eight"/"gate"). Identification carries one onset-sharing distractor (cat → cap).
- **Demanded by:** eval-test 2026-03-15 (RS-1..RS-5).
- **Evidence:** `qa/EVAL_TRACKER.md:977-987`; `gemini-rhyme-studio.ts:28-37,529,714`.
- **Probe:** eval-test `componentId=rhyme-studio&evalMode=recognition` → no irregular word in any pair.

### R6 — Sentinel-safe words · OBSERVED
- **Property:** no generated word that could open a verdict sentence ("yes", "my", "turn") reaches a choice or a spoken line (`isSentinelSafeWord`).
- **Demanded by:** DI port 8 (a hardcoded pool once held "yes").
- **Evidence:** `rhymeStudioScript.ts:150-165,270-273`.
- **Probe:** `npm test -- RhymeStudio.di-script`.

### R7 — Support tier invariants · OBSERVED
- **Property:** the tier never changes words, families or the correct choice. easy: rime highlight on the target card and the prose image caption; medium: neither; hard: the tutor also may not read the choices (`namesChoices` false, readers only). At K the picture and the read-aloud are forced on.
- **Demanded by:** support-tier campaign; K PRE band.
- **Evidence:** `gemini-rhyme-studio.ts:225-305`; `RhymeStudio.tsx:302-304`; `rhymeStudioWorkspace.ts:51-56`.
- **Probe:** eval-test `evalMode=identification&difficulty=easy|hard&grade=1` → scaffold fields stamped, words unchanged.

### R8 — One workspace path and one evaluation · OBSERVED
- **Property:** the component runs only on the teaching workspace (unbound mount = the "needs the tutor" card). Bound sessions send `tutoring: null`, so the catalog `tutoring` block never reaches a workspace tutor; its instruction is `teachingWorkspace.guidance`. One evaluation per session with `RhymeStudioMetrics` (per-mode accuracy, families practiced). A collection's three slots are three items of one challenge.
- **Demanded by:** workspace C1 (user ruling 09-23: one path); IRT.
- **Evidence:** `RhymeStudio.tsx:598-600`; `lessonWorkspacePlan.ts:61-66`; `adapterContract.ts:158`.
- **Probe:** `npm test -- RhymeStudio.workspace lessonWorkspacePlan`.

### R9 — In-item levers, every mode · OBSERVED
- **Property:** help never touches the item's words: `contrast_model` and `onset_swap_model` draw model words from `rhymeModels.ts`, excluded by word and by ending sound from every session item, with no fallback to a used family; `onset_strip` shows single first sounds on pictures whose words cannot rhyme with a CVC target, never the target's own sound; `name_choices` exists only where the tier withdrew the read-aloud. Simplify opens an ungraded practice item of the same mode (collection practises production) on a family no session word uses; a recognition practice verdict is chosen by the item id, not copied from the item. No lever turns a spoken answer into a choice or a tap. Every lever is `shown` and `voiced`.
- **Demanded by:** handoff 22 L2; trigger ladder (handoff 21 S2).
- **Evidence:** `qa/eval-reports/rhyme-studio-levers-2026-09-28.md`.
- **Probe:** `npm test -- rhymeStudioLevers RhymeStudio.levers.workspace`.

## Conflicts

### C1 — R7 easy tier vs R2 — OPEN (existing, not caused by levers)
At reader grades the easy tier colours the target's rime before any attempt. On identification a reader can
match that spelled ending to the choice that ends in the same letters, so the easy start states part of the
answer. It is a tier start, not a pulled lever, and predates this contract. Levers must not reuse it: help on
the item's own words is forbidden by R2. Resolution belongs to a support-tier pass, not to handoff 22.

## Catalog projection

- **description:** stale on the DI clock ("the tutor asks, waits and responds … a credited answer moves the lesson on" is still true in effect; "Requires a microphone" is true). Faithful enough; not changed.
- **constraints:** faithful.
- **evalModes:** faithful.
- **tutoring:** stale DI block. `aiDirectives` order bracketed `[RS_ITEM]` turns and "Yes," / "My turn:" openers for the retired runner; bound sessions never receive them (R8). Removed 2026-09-28 (handoff 22 L2 step 1).

## Changelog

- 2026-09-28 — R9 added (levers, handoff 22 L2). `aiDirectives` removed. The K word menu moved to `rhymeModels.ts` (R4 unchanged). --check COMPATIBLE: R1-R8 suites pass.
- 2026-09-28 — derived (initial), step 1 of handoff 22 L2. 8 requirements (all OBSERVED), 1 open conflict (C1, pre-existing).
