# Handoff: the constructive modality (Open Builder) — 2026-10-06

## 1. What we are trying to do

Chi's ICAP framework ranks learning activity Passive < Active < Constructive < Interactive. Learning
gains rise with each step.

- **Active** is where almost every Lumina primitive sits. The child selects, drags or taps inside a
  scene we built, toward one answer we hold. Pip, support tiers and the Live tutor make Active better,
  but the child is still working on our item.
- **Constructive**: the child produces something that was not on the screen. Annotated example with
  student drawing reached this, and nothing has since.
- **Interactive**: a partner responds to what *this* child made, and the child revises. Nothing in
  Lumina does this yet.

**The goal is a general modality, not a primitive.** Every lesson that uses it runs this loop:

> open goal → the child constructs → the world reacts as they build → a partner responds to the
> child's specific construction → the child revises → the build passes.

Its properties:
- Many builds pass.
- Order matters when the goal says so: the build log is the sequence.
- The partner points at the child's own pieces, never at a model answer.

Open Builder (`creation/open-builder`) is the first instance. Construction is its first preset. Other
presets (garden, undersea, city) are skins on the same loop.

**Non-goals:**
- A sandbox with no objective (the "Little Builder" play pages).
- A disguised one-answer task: a goal so narrow only the reference build passes.

## 2. Evidence so far

- **The judge is not the bottleneck.**
  - Raw build JSON scored 81/81 on `gemini-flash-latest` (`qa/open-build/judge-*.json`).
  - On generated projects: 20/20 in substance. Reference builds and shifted variants were met; a
    missing roof was `missing_part`; pipes after the roof were `wrong_order`.
  - Flash-lite gave away the fix, so it is not used for judging.
- **The loop runs end to end** in Chrome through the real tester: generate → miss with a nudge
  question → Try again → pass → next. Birth record: `qa/eval-reports/open-builder-birth.md`.

## 3. What broke

The user's first real build (screenshot, 10-06) shows the loop is brittle.

- **The judge was right about the verdict.** "Two families" needs two doors and the build had one.
- **The world could not show what the goal was about.**
  - The goal said "two separate rooms", but a room existed only as a gap in coordinates.
  - Walls were one column wide, so the build had no visible interior at all.
  - Windows stacked on top of walls instead of sitting in them.
- **The generator wrote goals in architecture words the world has no representation for** ("separate
  rooms", "wide car opening"). The judge had to infer them from numbers, and the child could not see
  them at all.
- **Feedback arrived only at Check**, so the world was not a living simulation.

**Root cause:** goals were generated without a contract with the world. A task is doable only if every
idea it names is something the world computes and draws. Testing each project by hand would leave us
fixing this one task at a time, so the fix is a world contract plus a gate that tests it.

## 4. Design rule: each preset declares a concept vocabulary

Each preset ships an analyzer (pure code) that computes its concepts from the build. The same output
drives three things:

1. **The board, live.**
   - A room is shaded and labeled the moment it is enclosed.
   - A beam held up at one end only sags.
   - A door shows which room it opens into.
2. **The judge.** It reads facts ("Room 1: 1 door, roofed, ground floor; Room 2: 0 doors") instead of
   coordinates.
3. **The generator.** Its rules are predicates over the vocabulary, e.g. `rooms >= 2`,
   `every room has a door`, `pipes before roof`. A goal may name only those concepts.

The goal's wording stays free, and so does the build. Only the vocabulary of ideas is fixed, because it
is exactly what the child can see.

**Construction vocabulary (first cut):**

| Concept | Defined as |
|---|---|
| room | empty cells closed in by solids on both sides and covered above |
| floor level | which floor a room is on |
| door / window of a room | in-wall door and window pieces bounding the room |
| roofed | a roof or beam covers the room |
| supported | a beam or roof is held at both ends |
| step order | the order of fixtures (pipes, wires, paint) relative to roofs and walls |

Pieces change with it:
- walls with a door or window built in (replacing windows stacked on walls)
- beams and foundations wide enough for 2-3-cell rooms

Garden would declare planted, watered, sunlit and growing order; undersea would declare zone and
belongs-here.

## 5. The testing regime: a gate over generated tasks, not a census of projects

**Question it answers:** can a child actually do the tasks this preset generates, and does the partner
loop get them there?

It runs per preset × band on a batch of about 20 generated projects. It reports rates, never single
items. A failure is fixed at its class (generator, preset vocabulary, analyzer, judge prompt), never by
patching one project.

| Gate | Checks | How | Pass bar (first cut) |
|---|---|---|---|
| G1 Contract | every rule is a predicate over the preset vocabulary; the goal names no concept outside it | code, plus one LLM extraction of the goal's concepts | 100% |
| G2 Solvable | the reference build passes physics, the hopper counts and every predicate | code | 100% (failures dropped at generation; drop rate reported) |
| G3 Visible | every predicate's concept is drawn on the board when true | code (vocabulary = renderer) | 100% |
| G4 Discriminating | each project rejects mutants that break a predicate (remove a piece, reorder fixtures, unroof) and accepts neutral ones (shift sideways, add an unrelated decoration) | code mutations, then the judge | ≥90% correct verdicts; ≥1 breaking mutant per project |
| G5 Doable | a naive learner agent builds through the same action API, seeing only what a child sees (goal, hopper, board facts, the inspector's replies). It gets up to 3 checks and never sees the reference | LLM agent | ≥80% pass within 3 checks; checks-to-pass reported |
| G6 Not trivial | a plausible-random builder (uses the hopper with no plan) rarely passes | code builder, then the judge | ≤10% pass |
| G7 Hearable | the goal suits the band: length, vocabulary, one idea for K-2 | `/reader-fit` rules | 100% |

**G5 measures the Interactive property directly:** does what the inspector says let a builder who
could not do it the first time succeed on revision? Two numbers matter:
- first-check pass rate (how hard the task is)
- final pass rate (how well the partner loop helps)

A low first-check rate with a high final rate is the target. A low final rate means the partner loop
does not help.

**Cost:** about 20 projects × (2 generation + about 8 mutant judges + about 6 agent turns) ≈ 300-400
flash calls per preset × band. No Live sessions. It runs as a script in `scripts/` and writes
`qa/open-build/gate-<preset>-<band>-<date>.json`.

**Where it plugs in:** it is this modality's `/oracle-test` (G1-G4, G6, G7 are code-judged and CI-able)
plus a learner-agent tier (G5). Every new preset must pass the gate before it ships; no preset is
tested by a hand-played project.

## 6. Order of work

1. **Construction analyzer and vocabulary:**
   - `creation/constructionAnalyzer.ts`: rooms, levels, doors/windows per room, roofed, supported
   - live rendering of those facts on the board
   - in-wall door and window pieces; wider beams
2. **Generator on predicates:** rules as `{ concept, op, value }` over the vocabulary, checked in code
   against the reference build. The judge receives the analyzer facts beside the raw build.
3. **The gate script** (G1-G7) on construction K-2 and 3-5. Fix at class until it passes. Record the
   baseline.
4. **Second preset** (garden), only through the gate. This proves the contract generalizes.
5. **Layers after the gate holds:**
   - `/add-eval-modes`: `fix_the_build`, `plan_then_build`, `crew_schedule`
   - `/add-support-tiers`: help = replay the build log, ghost "something holds each end"; simplify = no
     order rule, smaller hopper
   - tutor replay (needs an inspector stand-in in the journey sweep)

## 7. Decisions for the user

- **Learner-agent tier (G5) as a standing gate?** It is the only tier that measures whether the loop
  teaches. It costs flash calls, not Live.
- **Pass bars in §5:** first cut; adjust after the first baseline.
- **Commit now?** The born primitive is uncommitted on `ship/2026-08-10-judged-loop`. Files are in
  `open-builder-birth.md`.

## 8. Files

- Primitive:
  - `src/components/lumina/primitives/visual-primitives/creation/` (model, workspace, component,
    art, test)
  - `src/components/lumina/service/creation/` (generator, judge)
- Tester: `src/components/lumina/components/CreationPrimitivesTester.tsx` (Developer Tools → Creation
  Primitives, offline by default)
- Evidence:
  - `qa/open-build/` (judge probes)
  - `qa/eval-reports/open-builder-birth.md`
  - `scripts/open-build-judge-*.mjs`
