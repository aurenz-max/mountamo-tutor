# In-item support levers: audit and invariants

Date: 2026-09-26, revised 2026-09-27 · Ruling: support levers designed in advance (user, 2026-09-26) · Feeds: rewrite of `/add-support-tiers`, which absorbs `/add-structural-difficulty` (user, 2026-09-27)

## Status (2026-09-27)

The number-line jump pilot is built: the shared lever mechanism (`pull_lever`, levers on the attempt record, an ungraded simpler item that returns to the full item) and two levers, `numbered_hops` and `simpler_jump`. The easy-tier arc leak is fixed. Report: `qa/eval-reports/number-line-levers-2026-09-27.md`. Rollout (Phase B of handoff 18) is under way: B1 ten-frame passed its bench on 09-27; B2 fraction-circles passed its bench and a user browser check on 09-27 (`qa/eval-reports/fraction-circles-levers-2026-09-27.md`). B3 rhyme-studio is next, after its catalog `aiDirectives` defect below. An observer pull is narrated on the tutor's next turn, after its reply to the learner (LB-8).

## The ruling this serves

When a learner fails an item, the answer is a lever inside the primitive that the tutor or the JEV observer can pull on the current item. We work out in advance why learners fail each primitive and build the levers for it. We do not write scripted tutor responses. A missing prerequisite is a lesson-level finding, acted on in the next lesson. The in-moment prerequisite detour (LA-15 Next #1) is parked on the local branch `park/la15-prerequisite-detour` (`e4855c3b`).

## What the three audits found

Audited: `fraction-circles`, `number-line`, `rhyme-studio`. Each audit read the catalog entry, component, generator, workspace binding, and every report and log that mentions the primitive.

**1. Nothing can be pulled mid-item.** Every tier and structural lever is fixed when the content is generated, from the lesson-wide `config.difficulty`. All three workspace bindings publish `objects: []`, `canDemonstrate: false` and a `mark` that does nothing, so the tutor's only move is `begin_help`, which records help and changes nothing on screen.

**2. The tiers mostly toggle text, and at K they do nothing.** Fraction-circles tiers are text readouts only. Number-line's jump mode differs between no tier and medium only in hint text. At K, rhyme-studio's three tier flags have no effect: two are forced on and the third is never drawn for pre-readers.

**3. Two easy tiers leak the answer and shipped as "no leak".**
- `fraction-circles` identify, easy: the caption "N equal pieces, M shaded" states the answer. The oracle skips leak checks.
- `number-line` jump, easy: the worked arc's arrowhead is drawn at the landing.

**4. The levers the failures need mostly do not exist.** Examples:
- number-line: hop-by-hop placement with numbered hops. The interaction is one endpoint click.
- fraction-circles: split each slice of the reference circle into k, to show equivalence.
- fraction-circles: overlay one circle on the other, to compare.
- rhyme-studio: replace a near-miss foil with a maximally different one.

Lever discovery today reads the component's existing `showOptions`, so a missing degree of freedom is never found.

**5. Structural difficulty only escalates.** It adds shape for strong students at generation time. The shape changes a failing learner needs all make the current item simpler:
- fewer hops
- drop the second operation
- fewer or farther choices
- a far-apart comparison pair
- a denominator that is a multiple of the reference

**6. No failure evidence comes from a real learner.** Every "observed" failure is synthetic: the harness's scripted wrong answer, or a fictional session. The number-line evidence is also corrupted by a generator defect: jump starts of 58 and 91 on a 0–30 line, with the click clamped to 30.

**7. Assistance accounting is thin.** Assistance is one boolean per item. Only some primitives record per-attempt support state (`labelsShown`, `arcShown`). Nothing discounts assisted credit in IRT.

## The design: one skill, two kinds of lever

**Objective.** When a learner cannot do the item in front of them, the primitive has a lever the tutor or JEV can pull on that item, so the learner gets part of it right and returns to the full item. The manifest's choice of primitive and eval mode is not in question: the manifest picks the item, and the levers make it teachable.

Structural difficulty is a subset of support (user, 2026-09-27). `/add-support-tiers` owns every lever on the current item. There are two kinds:

- **Help.** The representation shows or does more, and the problem is unchanged. Examples: numbered hops, splitting each slice into parts, a picture beside the word.
- **Simplify.** The problem asks for less, within the same mode and skill. Examples: one operation instead of two, two choices with a far foil, a denominator that is a multiple of the reference.

The generation tier only sets where the levers start: easy starts with some pulled, hard starts with all of them released. Content harder than the mode's full item is a harder eval mode, which the manifest and `/lumina-densify-primitives` own. This skill does not make items harder than the manifest chose, and it adds no within-mode β or routing.

`/add-structural-difficulty` retires. Its build method becomes this skill's section on simplify levers: count the LLM's shape, honor it when valid, otherwise rebuild it in code; recompute the answer; preserve the solvability rules. Its existing implementations (regrouping-workbench, bar-model) stay valid as generation-time starting positions.

### Invariants for every lever

- **S1. Failure first, with evidence class.** Every lever names the failure it addresses and that failure's evidence class: observed with real learners, observed with synthetic learners, documented, or inferred. A lever with no failure is not built. An inventory entry with no evidence class is not accepted.
- **S2. Pullable at runtime.** A lever is a state the workspace can switch on the current item through a workspace operation. A lever that exists only as a generation-time flag does not meet this skill.
- **S3. Never states the answer, checked in code.** Each primitive keeps a leak rule per lever and mode, enforced by code rather than review. A lever that would answer the item acts on a model pair outside the item instead. Examples: a rime highlight answers recognition; an arc ending at the landing answers a jump.
- **S4. Recorded on the next attempt.** Pulling a lever records which lever was pulled and when, and the next attempt carries it. The item keeps its mode's β. Assisted work must not reach the first-response gate or the distiller as independent work.
- **S5. On screen before it is described.** Pulling a lever changes the screen, publishes a scene fact the tutor and JEV read, and has a visible receipt before the tutor may narrate it. The new fact must not state the answer either.
- **S6. A carrier for every reader band.** Each lever declares whether it is shown, voiced, or both. For a pre-reader, a text-only lever does not count.
- **S7. May add capability.** When the primitive lacks the degree of freedom a failure needs, this skill adds the render, data field or interaction, and states the cost. It is not limited to existing `showOptions`.
- **S8. No scripted responses.** A lever declares what it does. The tutor decides when to pull it and says it in its own words. Levers are declared as data in the catalog or adapter, and the runtime and backend never name a primitive.

### Invariants for simplify levers, in addition

- **R1. Code builds the simpler item.** Code builds it and recomputes its answer, preserving the solvability rules. The prompt alone is not trusted to land a shape.
- **R2. The mode floor holds.** A simpler item never crosses the mode's defining property. Turning production into a choice among pictures changes the mode, so it is not a simplify lever. Magnitude stays in the mode's band.
- **R3. Never the learner's own item back.** A simplified item must not repeat the item the learner is stuck on, and must not reveal its answer. This is checked in code. On the parked detour branch, a prompt instruction alone still repeated the item in 3 of 5 generations; a code check brought it to 0 of 5.
- **R4. The full item stays open.** Work on the simpler item is ungraded, with no mastery write (ruling 1). The learner returns to the original item, or to a fresh item of the same mode, and only that answer, given without the lever, is credited.

## Invariants for the skill as a whole

- **B1. Contract first.** Run `/primitive-contract` before touching a primitive. Fraction-circles and rhyme-studio have no contract doc.
- **B2. Fix what corrupts the evidence first.** A lever is not measured on content that is broken. Example: the number-line range defect.
- **B3. One lever set feeds the tutor, JEV and the diagnosis log.** Levers carry the same names in the scene facts, the assistance record and `logs/demonstrations`. Diagnoses that recur in the log then point at the lever a primitive is missing.

## Defects found (to queue)

| Defect | Evidence | Executor |
|---|---|---|
| ~~fraction-circles identify, easy: caption states the answer~~ FIXED 09-27: identify never prints its shaded count (component, whatever the data says; generator easy flag off). 22/22 generated identify items clean; identify easy and medium now match until levers land | `FractionCircles.tsx`, `gemini-fraction-circles.ts` | done |
| ~~number-line jump, easy: the arc's arrowhead marks the landing~~ FIXED 09-27: the arc is replaced by the numbered-hops lever | `NumberLine.tsx`, `numberLineLevers.ts` | done (pilot) |
| ~~number-line generator: jump starts outside the rendered range~~ FIXED 09-27 (`c952e0e0`) | `qa/eval-reports/number-line-display-range-2026-09-27.md` | done |
| ~~Live journey reports PASS when the "correct" answer was never credited~~ FIXED 09-27: `credited()` asserted in the workspace and `--lever` journeys | `run_live_runtime.py` | done |
| rhyme-studio: K tiers do nothing; `remediationMove` stamped, never read; DISTAR lead-in ladder reached only by QA code. 09-28: levers now give K real help (all `shown`+`voiced`); the tier flags and `remediationMove` are unchanged | rhyme audit §3–4; `qa/eval-reports/rhyme-studio-levers-2026-09-28.md` | `/add-support-tiers` (tier start positions) |
| ~~rhyme-studio catalog `aiDirectives` still order "[RS_ITEM] say exactly" turns for a retired runner~~ FIXED 09-28: bound sessions send `tutoring: null` (`lessonWorkspacePlan.ts:65`), so they reached no workspace tutor; removed | `contracts/rhyme-studio.md` | done |
| cvc-speller catalog `description` and `aiDirectives` still describe the retired DI loop (`[DI_CVC_*]`, `[SAY_WORD]`); bound sessions send `tutoring: null`, so they do not receive the directives | `contracts/cvc-speller.md` catalog projection | `/add-live-tutor-tools` (with rhyme-studio's, handoff 22 L2) |
| cvc-speller fill_vowel "stuck": the tutor stretched "c-aaa-t" in 1 of 10 replay samples (states the middle sound) | `qa/tutor-reports/replay/cvc-speller-2026-09-28.json` | `/add-live-tutor-tools` · handoff 22 L2 |
| letter-sound-link hear_see "stuck" (no lever declarable, group-1 payload): the tutor hints "find the letter that looks like a snake" in 3/5 replay samples, which points at S | `qa/tutor-reports/replay/letter-sound-link-2026-09-28.json` | `/add-live-tutor-tools` (guidance: a letter's shape is the answer on hear_see) |
| `replay_checks.py` `no_key_before_try` flags a hear_see tutor repeating the question sound ("/sss/") as stating the key `s`: 2/15 false positives | same | handoff 20 Part C (backend, not literacy files) |
| letter-sound-link `showKeywordAnchor` / `showSharedSoundHint` are stamped by the generator and read by no render path | `contracts/letter-sound-link.md` | `/eval-fix` (delete, or route to the levers' starting position) |
| letter-spotter name_it "stuck": the tutor says the onset sound ("/s/ ... what letter is that?") in 4/5 replay samples; the sound counts as the answer on this mode | `qa/tutor-reports/replay/letter-spotter-2026-09-28.json` | `/add-live-tutor-tools` · handoff 22 L2 |
| `replay_checks.py` `no_key_before_try` reads find_it's key (cell index `1`) in "one line at a time": 9 false positives | same | handoff 20 Part C |
| letter-spotter easy/medium `showTargetReference` shows the target in the grid's own case (glyph matching); contract C1 | `contracts/letter-spotter.md` C1 | `/add-support-tiers` (make it the other-case lever's starting position) |
| number-line: tool-lab `runtimeHint` is set and never rendered | `NumberLine.tsx:846` | `/eval-fix` |
| rhyme-studio: β jumps 2.5 from identification (2.5) to production (5.0) | catalog `literacy.ts:1537-1580` | `/lumina-densify-primitives` |
| No contract docs for fraction-circles ~~and rhyme-studio~~ (rhyme-studio derived 09-28) | audits | `/primitive-contract` |
| rhyme-studio identification @ K: `replay_checks` `no_key_before_try` flags the tutor reading the choices ("hat, or can?"), which `namingChoices` allows at K: 19/20 flags in the 09-28 replay are this | `qa/tutor-reports/replay/rhyme-studio-2026-09-28.json` | handoff 20 Part C (skip a choice named in a list the facts permit) |
| rhyme-studio production/collection levers are vitest-only: no saved payload and no code-owned answer, so neither the dry journey nor replay drives them | `liveJourneySpec.ts:1239` | handoff 20 Part B (spoken misses) / a production payload |
| `tutor_replay.py`: a lever the tutor pulls that the dry journey did not pull is answered with the unchanged packet, so the tutor never sees the change and invents one (sound-swap: "in + /w/ = win", "an + /m/ = man" before its model was the ladder's first lever) | `qa/tutor-reports/replay/sound-swap-2026-09-28.json` (first run, overwritten; see the L2 report) | handoff 20 Part C (build the receipt from the pulled lever, or flag the sample unscorable) |
| syllable-clapper count: `replay_checks` flags "one dot for each clap" as the count `one` on a one-part item (2/10) | `qa/tutor-reports/replay/syllable-clapper-2026-09-28.json` | handoff 20 Part C |
| ~~L1 literacy levers do not set `teachingWorkspace.levers`~~ FIXED 09-29 (handoff 24): set on cvc-speller, letter-sound-link (guidance trimmed under the cap) and letter-spotter. Was: L1 literacy levers (cvc-speller, letter-sound-link, letter-spotter, word-workout, interactive-book) do not set catalog `teachingWorkspace.levers`, so their guidance lacks `LEVER_DOCTRINE`; with it, letter-sound-link (2212) and word-workout (2095) exceed the 2000-char cap. Replay pulled levers 25/25 without it. 09-28 (L3): word-workout and interactive-book now set it, guidance trimmed; cvc-speller, letter-sound-link and letter-spotter still do not | `activityContract.test.ts:53` | `/add-live-tutor-tools` (trim letter-sound-link, then set the flag on the three) |
| decodable-reader and read-aloud-studio got L3 levers without a contract doc (B1 not run) | `qa/eval-reports/levers-literacy-L3-2026-09-28.md` | `/primitive-contract` |
| phonics-blender levers: inventory and table drafted, not built; one ruling owed (may `sound_dots` re-segment the hard tier's joined row?) | same | user OK, then `/add-support-tiers` |
| L3 levers have no starting positions from `config.difficulty` (Phase 6): all start released | same | `/add-support-tiers` |
| story-ribbon easy tier's live order self-check turns green on the story order, so a learner can swap cards until it lights; kept as easy's starting position, never a lever (contract R5) | `contracts/story-ribbon.md` R5 | user ruling: keep, or withdraw at easy too |
| story-bridge start replay: `no_key_before_try` flags the tutor reading story one aloud because story one contains the answer friend's name (5/10) | `qa/tutor-reports/replay/story-bridge-2026-09-29.json` | handoff 20 Part C (exempt the stories line) |
| story-bridge say_alike stuck: with no lever, the tutor retells both friends' actions side by side, nearly stating the comparison | same | `/add-live-tutor-tools` |
| ~~picture-vocabulary opposite, association, gradable_scale, sentence_frame name no misses and have no lever~~ FIXED 09-29 (handoff 24): named misses and one model lever each (contract R6) | `contracts/picture-vocabulary.md` R4 | `/add-support-tiers` (after spoken misses for those modes) |
| story-bridge say_alike, say_different, main_idea_compare: no misses or levers (open comparisons) | `contracts/story-bridge.md` R4 | decide: spoken misses for comparisons (handoff 20 Part B), or ruled out of the class Live gate |
| oral-sentence-studio old story-words payload: at stuck the tutor gives word-meaning hints instead of pulling `sentence_strip` (0/5) | `qa/tutor-reports/replay/oral-sentence-studio-2026-09-29.json` | none needed now (the S2 ladder auto-pulls on the 2nd wrong); watch in the class Live pair |
| letter-sound-link see_hear stuck: the tutor hints "the sound a hissing snake makes" (the answer as an image) and does not pull `letter_model` (0/5); the checks miss it. Same hint in the 09-28 letter-spotter replay | `qa/tutor-reports/replay/letter-sound-link-k2close-2026-09-29.json` | `/add-live-tutor-tools` (guidance) + handoff 20 Part C (a sound-imagery check) |
| number-sequencer K `showNumberLine` prints every number from the train's lowest to its highest under the train, the answer in order beside its neighbours (a starting position, not a lever) | `qa/eval-reports/levers-M2-spoken-2026-09-29.md` | user ruling: keep as the easy start, or withdraw on the spoken modes |
| `replay_checks.py` `no_key_before_try` reads "one less" / "one step back" as the key 1 on number-sequencer before_after (6 flags, all false) | `qa/tutor-reports/replay/number-sequencer-2026-09-29.json` | handoff 20 Part C (with the syllable-clapper row) |
| ~~ordinal-line `word_model` / relative_position stuck: the tutor extended the model to the asked place ("we say tenth") and counted the line up to the anchor, naming the answer (2/20)~~ FIXED 09-29: both levers' `does` text; replay 0/60 | `qa/tutor-reports/replay/ordinal-line-before-2026-09-29.json` | done |
| L4 closed 09-29 | `qa/eval-reports/levers-literacy-L4-2026-09-28.md` | `/add-support-tiers` · handoff 22 L4 |

## Suggested pilot

**number-line jump.** It has the clearest failures, the contract doc already exists, and the lever render already exists as the LA-15 demonstration's numbered hops. The pilot has two levers:
- help: hop-by-hop placement on the learner's own arc;
- simplify: fewer hops, or one operation instead of two.

Fix the range defect first (B2).

## Appendix: ten-frame lever draft (2026-09-27 skill dry run, not confirmed with the user)

**Superseded 09-29:** every ten-frame mode now has levers; the built table and what changed from this draft are in `qa/support-levers/m4-lever-tables-2026-09-29.md` (contract R12).

No real-learner evidence exists for ten-frame (`qa/misconception/ten-frame-2026-09-14.md:4` is fictional). The misses come from `tenFrameScript.ts` scripted wrong answers and catalog `commonStruggles`.

| Mode | Failure (class) | Lever | Kind | Carrier | Leak rule | Exists today? |
|---|---|---|---|---|---|---|
| build / build_teen | miscounts while placing (synthetic) | running count of counters placed | help | shown + voiced at K | counts placed counters only, never the target | generation flag only (`showOptions.showCount`) |
| subitize | counts one at a time (synthetic + documented) | longer flash, or show again | help | shown | never leaves counters visible while the child answers | learner "Show again" button and per-item `flashDuration`; no tutor pull (`present` exists) |
| operate | says back an addend (synthetic + documented) | equation beside the frame, result as `?` | help | shown; text, so voiced at K | never shows the result | generation flag only (`showEquation`) |
| decompose_teen | flips every counter (synthetic) | outline a ten on a model ten outside the item | help | shown + voiced | never outlines the item's own ten | no |
| decompose | leaves one part empty (synthetic + documented) | smaller total (2-3) | simplify | shown | never the learner's total or a pair they have shown | generation prompt only |
| build_teen | rebuilds the whole teen (synthetic) | teen number with fewer ones (11-13) | simplify | shown | never the same teen number | generation prompt only |
