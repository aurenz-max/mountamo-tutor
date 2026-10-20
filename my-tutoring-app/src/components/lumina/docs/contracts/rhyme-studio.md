# Contract: rhyme-studio

- **Derived:** 2026-09-28 · evidence window: eval-report 2026-03-15 + reader-fit PRE 2026-07-15 (live `--lesson` 3/3 ×2) + DI bench `open_set_word` 2026-08-19 + live DI reports 2026-08-19 + workspace rollout C1 2026-09-24 + w1 payloads 2026-09-24/26 + git to 2026-03
- **Component:** `primitives/visual-primitives/literacy/RhymeStudio.tsx` (workspace only, `withWorkspaceOnly`) · **Boss (2026-10-20):** `rhymeStudio.card.ts` (modes, misses, words) + `rhymeStudio.boss.ts` (spoken preset) + `rhymeStudioDomain.ts` (items, ask, spoken key, misses, scene, hear request, content gate, harness) + `rhymeStudioLevers.ts` (one lever set) · **pair_build:** shared `RhymePairSurface.tsx` (`boss` prop) + `rhymePairBuild.ts` · **Generator:** `service/literacy/gemini-rhyme-studio.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (`...bossEntry(rhymeStudioCard)`) · **Live adapter:** `bossAdapter(rhymeStudioBoss)` · **Journey:** `bossJourney(rhymeStudioBoss)`
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
| Shared teaching workspace (tutor/JEV, rollout C1; boss framework 2026-10-20) + live journey harness | live [2] + code | `qa/tutor-reports/workspace-rollout-C1-2026-09-24.md`; `bossJourney(rhymeStudioBoss)` | 2026-10-20 |
| Misconception loop (`contrast_rime` / `diagnostic_option` / `constrained_production`) | code [5] | `gemini-rhyme-studio.ts:18,522,583` | 2026-07 |
| Support tiers (easy / medium / hard) | code [5] | `gemini-rhyme-studio.ts:225-305`; `423c58f5` | 2026-08 |
| Pip shared surface (runner-published since 2026-10-20: `<PipDock />` + `<PipWorkspace>`) | code [5] | `pip/WorkspacePip.surface.test.tsx` | 2026-10-20 |
| Learner interests theming | code [5] | `704fa9cc` | 2026-09 |

## Requirements

### R1 — Every mode is answered out loud; nothing is tapped to answer · OBSERVED
- **Property:** recognition = the learner says yes or no; identification = says the choice that rhymes from the visible closed set; production = says any real rhyme with nothing on screen but the target; collection = says three different rhymes, one per slot, each credited word filling its slot. Tapping a word card only asks the tutor (silent host message) to repeat the question. No Next / Check / Start gate. A simplify lever never turns a spoken mode into a choice or a tap (R2 of handoff 22).
- **Demanded by:** user ruling 2026-08-12 (recognition spoken); open_set_word bench (production); workspace C1.
- **Evidence:** `RhymeStudio.tsx` header; `rhymeStudioDomain.ts` (`rhymeAsk`, `rhymeKey`, `hearRhymeRequest`); `rhymeStudio.card.ts` (four `SPOKEN` modes, card move "may tap the word card to hear the question again"); `RhymeStudio.workspace.test.tsx`.
- **Probe:** `npm test -- RhymeStudio.workspace`.

### R2 — Nothing names the rhyme before credit · OBSERVED
- **Property:** before a credited answer, no word on the item is stretched, split or lit at its ending; the ask never names the rime; the rhyming choice is ringed only after credit; recognition lights endings only after the verdict (the comparison only when the pair rhymes). The scene's `constraints` forbid naming the ending or stretching a word before a try (moved from the retired catalog guidance, 2026-10-20). Any teaching of the rule acts on a code-owned model set whose words and FAMILY are outside the session (`pickModelRhymeSet`, family exclusion).
- **Demanded by:** every consumer (Pedagogy rule #1); DI script question 1.
- **Evidence:** `RhymeStudio.tsx` (leak guards); `rhymeStudioDomain.ts` (`rhymeAsk`, `rhymeScene` constraints; `askLeaks` on every saved payload via `boss.test.ts`); `RhymeStudio.workspace.test.tsx` "marks the rhyming choice only after credit".
- **Probe:** `npm test -- RhymeStudio.workspace boss.test`.

### R3 — Production and collection judge by a rule, never a list · OBSERVED
- **Property:** production and collection accept any real word that rhymes with the target, not the target itself, not a made-up word; collection also refuses a word already collected. No example rhyme is ever put on screen or in the tutor's key (the "nake" nonword was a generated acceptable answer). Empty collection slots show no example. On the boss the key is a `SpokenKey` whose `answer` is the rule itself ("any real word that rhymes with bed"), with the ending in `acceptRule` and the echo / same-start / meaning / nonword refusals in `signatureError`; a collection key names the family's credited words.
- **Demanded by:** open_set_word bench; user ruling 2026-08-18 ("trust the model").
- **Evidence:** `rhymeStudioDomain.ts` (`rhymeKey`, `recordCollectedRhyme`).
- **Probe:** `npm test -- RhymeStudio.workspace` (open keys name no example; collection key names the collected words).

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
- **Evidence:** `rhymeModels.ts` (`isSentinelSafeWord`, moved from the deleted script module 2026-10-20); `rhymeStudioDomain.ts` (`itemFromChallenge` filters choices); `gemini-rhyme-studio.ts`, `rhymeSpaces.ts` (pools).
- **Probe:** `npm test -- rhymeSpaces gemini-rhyme-studio`.

### R7 — Support tier invariants · OBSERVED
- **Property:** on the model path the tier never changes words, families or the correct choice (on the word-space path, R10, it picks the words; families stay the target's own ending and the key stays computed). easy: rime highlight on the target card and the prose image caption; medium: neither; hard: the tutor also may not read the choices (`namesChoices` false, readers only). At K the picture and the read-aloud are forced on.
- **Demanded by:** support-tier campaign; K PRE band.
- **Evidence:** `gemini-rhyme-studio.ts:225-305`; `RhymeStudio.tsx` (`showRhymeFamilyHighlight`, `showWordImage`); `rhymeStudioDomain.ts` (`rhymeScene` `namingChoices`).
- **Probe:** eval-test `evalMode=identification&difficulty=easy|hard&grade=1` → scaffold fields stamped, words unchanged.

### R8 — One workspace path and one evaluation · OBSERVED
- **Property:** the component runs only on the teaching workspace (unbound mount = the "needs the tutor" card). The catalog carries no `tutoring` block (deleted 2026-10-20) and no hand-written guidance: the tutor's instruction is built from the card (`bossEntry`). One evaluation per session with `RhymeStudioMetrics` (per-mode accuracy, families practiced), unchanged by the boss move. A collection's three slots are three items of one challenge.
- **Demanded by:** workspace C1 (user ruling 09-23: one path); IRT.
- **Evidence:** `RhymeStudio.tsx` (`withWorkspaceOnly`, `finish`); `boss.test.ts` (catalog = `bossEntry(card)`); `lessonWorkspacePlan.ts:61-66`.
- **Probe:** `npm test -- RhymeStudio.workspace lessonWorkspacePlan`.

### R9 — In-item levers, every mode · OBSERVED
- **Property:** help never touches the item's words: `contrast_model` and `onset_swap_model` (type `model`) draw model words from `rhymeModels.ts`, excluded by word and by ending sound from every session item, with no fallback to a used family; `onset_strip` (type `clue`) shows single first sounds on pictures whose words cannot rhyme with a CVC target, never the target's own sound; `name_choices` (type `legend`) exists only where the tier withdrew the read-aloud. Simplify (type `easier`) opens an ungraded practice item of the same mode (collection practises production) on a family no session word uses; a recognition practice verdict is chosen by the item id, not copied from the item. No lever turns a spoken answer into a choice or a tap. Every word lever's carrier is `both` (shown and voiced). Since 2026-10-20 the levers are one lever set (`RHYME_LEVERS`) and every spoken miss is answered by a lever of its mode (none listed unanswered); when the model lever comes is the set's `support` fact (item tier, default medium).
- **Demanded by:** handoff 22 L2; trigger ladder (handoff 21 S2).
- **Evidence:** `qa/eval-reports/rhyme-studio-levers-2026-09-28.md`.
- **Probe:** `npm test -- rhymeStudioLevers RhymeStudio.levers.workspace` (pulled-lever facts are now `onScreen`, not `levers_on_screen`).

### pair_build — open build fork · OBSERVED (2026-10-08)
- **Property:** Its own surface (`RhymePairSurface.tsx`, rules in `rhymePairBuild.ts`), mounted for `task: 'pair_build'`. Eight code-owned emoji pictures, no print; two that rhyme pass, checked in code from the pictures' known rimes; every board holds a same-first-sound decoy (`same_start`). No model call. The existing modes are unchanged. Since 2026-10-20 rhyme-studio hands the shared surface its boss wiring (`boss` prop: the gesture assignment and the bound lever set `say_names` / `model_pair` / `small_board`), and Pip comes from the runner; picture-vocabulary's pair_build passes no `boss` and is unchanged. The boss drive plays the board through its pictures, so the dry journey now drives pair_build (baseline entry deleted).
- **Probe:** `RhymePair.workspace.test.tsx`; `PicturePair.workspace.test.tsx` (the other host); `npm run test:primitive -- rhyme-studio` (dry journey); headless drive `qa/open-build/rhyme-studio-2026-10-08/drive/`.

### R10 — Word space: with a support tier, code picks every item · OBSERVED 2026-10-13
- **Property:** with a support tier and no remediation focus, recognition, identification, production and collection draw from `service/wordSpace/rhymeSpaces.ts`: pictured one-syllable familiar words. A rhyme is a shared sound rime AND the same spelled ending (so the R5 gate and the rime highlight agree: bear/pear yes, bow/cow and bear/hair never). The wrong word's nearness is the difficulty: same first sound (cat/cap) > same last sound (cat/pot) > same vowel > unrelated; recognition draws half rhymes, half not (`tierPickSplit`). Production/collection targets rank by how many familiar words share the rime; R3 is unchanged (no list reaches the judge). K identification shows 2 pictures, readers 3; every card's picture is distinct and comes from the library (no ⭐ placeholder). `holdsRhymeIntegrity` passes every item unchanged. Each challenge carries a `wordSpace` stamp. pair_build unchanged.
- **Probe:** `npm test -- src/components/lumina/service/wordSpace/rhymeSpaces.test.ts`; `scripts/word-space-lab/probe.sh rhyme-studio after ...`.

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
- **tutoring:** deleted 2026-10-20 with the boss move (bound sessions never received it, R8).
- **teachingWorkspace / audioInput:** `...bossEntry(rhymeStudioCard)` since 2026-10-20.

## Changelog
- 2026-10-20 — **Boss framework** (wave 2, bucket D). Card + spoken boss; `pair_build` a keyless board through `speech.show`. Deleted: `rhymeStudioScript.ts` (retired DI cue lines), `rhymeStudioWorkspace.ts`, `adapters/rhymeStudioLive.ts`, the `DI_PORTS` row (and the open_set_word bench's plan tests that drove it; the fixture stays), `pip/rhymeStudioPipPose.ts`, `pip/RhymeStudio.surface.test.tsx`, `__tests__/RhymeStudio.di-script.test.ts`, the catalog `tutoring` block. Re-based: R1, R2, R3, R6, R7, R8 evidence (runner-era files gone); R9 levers as one set, every spoken miss answered; the "never name the ending / never stretch a word" rule moved from catalog guidance to scene `constraints` (word items and the pair board). Requirements unchanged in substance.
- 2026-10-13 — **R10 word space** (`/add-word-space`). Before (`qa/word-space-lab/2026-10-13/rhyme-studio/before.txt`): cat/hat, pig/dog, sun at every tier in every mode; identification wrong cards pictured as ⭐. After: recognition easy fox/box, cap/leg → hard dig/dog (same first sound), ship/soap (same last sound); identification K hard cat → hat vs kiss; G1 hard hook → book vs hand, truck; production easy bee, cat → hard hen, sock, mug. R7 narrowed to the model path.

- 2026-10-08: `pair_build` open build added as a fork (OB-3L). New challenge type; no existing requirement edited.

- 2026-09-28 — R9 added (levers, handoff 22 L2). `aiDirectives` removed. The K word menu moved to `rhymeModels.ts` (R4 unchanged). --check COMPATIBLE: R1-R8 suites pass.
- 2026-09-28 — derived (initial), step 1 of handoff 22 L2. 8 requirements (all OBSERVED), 1 open conflict (C1, pre-existing).
