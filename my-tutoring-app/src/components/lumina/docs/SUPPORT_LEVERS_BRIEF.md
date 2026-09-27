# In-item support levers: audit and invariants

Date: 2026-09-26, revised 2026-09-27 · Ruling: support levers designed in advance (user, 2026-09-26) · Feeds: rewrite of `/add-support-tiers`, which absorbs `/add-structural-difficulty` (user, 2026-09-27)

## Status (2026-09-27)

The number-line jump pilot is built: the shared lever mechanism (`pull_lever`, levers on the attempt record, an ungraded simpler item that returns to the full item) and two levers, `numbered_hops` and `simpler_jump`. The easy-tier arc leak is fixed. Report: `qa/eval-reports/number-line-levers-2026-09-27.md`. Rollout (Phase B of handoff 18) is under way: B1 ten-frame passed its bench on 09-27; B2 fraction-circles is next. An observer pull is narrated on the tutor's next turn, after its reply to the learner (LB-8).

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
| fraction-circles identify, easy: caption states the answer | `gemini-fraction-circles.ts:206-244`, `FractionCircles.tsx:558-563` | `/eval-fix` |
| ~~number-line jump, easy: the arc's arrowhead marks the landing~~ FIXED 09-27: the arc is replaced by the numbered-hops lever | `NumberLine.tsx`, `numberLineLevers.ts` | done (pilot) |
| ~~number-line generator: jump starts outside the rendered range~~ FIXED 09-27 (`c952e0e0`) | `qa/eval-reports/number-line-display-range-2026-09-27.md` | done |
| ~~Live journey reports PASS when the "correct" answer was never credited~~ FIXED 09-27: `credited()` asserted in the workspace and `--lever` journeys | `run_live_runtime.py` | done |
| rhyme-studio: K tiers do nothing; `remediationMove` stamped, never read; DISTAR lead-in ladder reached only by QA code | rhyme audit §3–4 | `/add-support-tiers` (rewritten) |
| rhyme-studio catalog `aiDirectives` still order "[RS_ITEM] say exactly" turns for a retired runner; not confirmed whether workspace sessions receive them | `literacy.ts:1650-1667`, `lumina_tutor.py:634` | `/add-live-tutor-tools` |
| number-line: tool-lab `runtimeHint` is set and never rendered | `NumberLine.tsx:846` | `/eval-fix` |
| rhyme-studio: β jumps 2.5 from identification (2.5) to production (5.0) | catalog `literacy.ts:1537-1580` | `/lumina-densify-primitives` |
| No contract docs for fraction-circles and rhyme-studio | audits | `/primitive-contract` |

## Suggested pilot

**number-line jump.** It has the clearest failures, the contract doc already exists, and the lever render already exists as the LA-15 demonstration's numbered hops. The pilot has two levers:
- help: hop-by-hop placement on the learner's own arc;
- simplify: fewer hops, or one operation instead of two.

Fix the range defect first (B2).

## Appendix: ten-frame lever draft (2026-09-27 skill dry run, not confirmed with the user)

No real-learner evidence exists for ten-frame (`qa/misconception/ten-frame-2026-09-14.md:4` is fictional). The misses come from `tenFrameScript.ts` scripted wrong answers and catalog `commonStruggles`.

| Mode | Failure (class) | Lever | Kind | Carrier | Leak rule | Exists today? |
|---|---|---|---|---|---|---|
| build / build_teen | miscounts while placing (synthetic) | running count of counters placed | help | shown + voiced at K | counts placed counters only, never the target | generation flag only (`showOptions.showCount`) |
| subitize | counts one at a time (synthetic + documented) | longer flash, or show again | help | shown | never leaves counters visible while the child answers | learner "Show again" button and per-item `flashDuration`; no tutor pull (`present` exists) |
| operate | says back an addend (synthetic + documented) | equation beside the frame, result as `?` | help | shown; text, so voiced at K | never shows the result | generation flag only (`showEquation`) |
| decompose_teen | flips every counter (synthetic) | outline a ten on a model ten outside the item | help | shown + voiced | never outlines the item's own ten | no |
| decompose | leaves one part empty (synthetic + documented) | smaller total (2-3) | simplify | shown | never the learner's total or a pair they have shown | generation prompt only |
| build_teen | rebuilds the whole teen (synthetic) | teen number with fewer ones (11-13) | simplify | shown | never the same teen number | generation prompt only |
