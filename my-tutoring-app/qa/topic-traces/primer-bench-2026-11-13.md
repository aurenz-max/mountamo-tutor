# Primer-contract bench: can manifest + objectives → primitives express the four takeaways? (2026-11-13)

Question (user): the Wharton Primer paper's four portable mechanics are (1) teachback practice, (2) an
evidence-grounded feedback shape, (3) observable objectives, (4) a per-phase journal the next phase reads.
Is Lumina's objectives → manifest → generators path flexible enough to carry them today?

Method: five topic-trace runs against the live pipeline on :3000 (traces in `primer-bench-2026-11-13/`),
one replay of the empty component ×2, one direct planner probe (4 objectives). Spend: $0.11 automated today.

| Run | Objectives (curator or forced) | Selected components |
|---|---|---|
| K `Letter sounds s a t p` (×2, one full) | apply: produce the sounds · identify: match letters | curator-brief, wonder-walk, phoneme-explorer, di-letter-sounds, letter-sound-link, practice-studio, knowledge-check |
| G1 `Making ten to add within 20` | apply · **explain** how a number splits to fill the frame · apply | deep-dive, ten-frame, practice-studio, annotated-example, number-bond, **di-spoken-practice**, strategy-picker, addition-fact-strategies, practice-studio, knowledge-check |
| G4 `Why some objects sink and others float` | apply · compare · **explain** why some stay on top | deep-dive, buoyancy-harbor ×3, practice-studio ×2, comparison-panel, concept-card-grid, **di-spoken-practice**, take-home-activity, knowledge-check |
| forced: two **explain** objectives (make-ten; short /a/ vs cake) | — | annotated-example, ten-frame, **di-spoken-practice**, comparison-panel, phonics-blender, practice-studio, knowledge-check |
| forced, full generators: "Explain to a friend why 8 + 5 can be solved by making ten first" | — | annotated-example (worked example, child reads) · ten-frame (make_ten, child taps) · **di-spoken-practice → `items: []`** · practice-studio (choose the split) · knowledge-check (MC) |

## Verdicts

### 1. Teachback practice — NOT expressible today
- The manifest does route `explain` verbs to a spoken surface: `di-spoken-practice` appears in every lesson with an
  explain objective (3/3). That is the right instinct and the only one.
- That surface is built for a **1–10 word proposition** (`explain_concept`, response class `concept_statement`,
  benched 09-07). Its planner prompt says a procedure ("explain how to solve") is `unsupported`. Direct probe:
  the make-ten objective planned `unsupported` first, then an open `explain_concept` on forced retry; the item
  model's drafts then failed the meaning review twice → the generator shipped `items: []` (3/3 runs, deterministic).
  "Explain why plants need light" threw after two plan reviews. "Explain to a friend who thinks heavy things
  always sink why a big boat floats" planned open with no targets (same item/review path).
- Everything else the manifest gave the explain objective converts the explanation into reading or tapping:
  annotated-example (read a worked example), practice-studio `choose` ("which way splits 5"), knowledge-check MC
  whose intent said "verbalized explanations".
- Gap, stated as a surface: there is no primitive where the child **produces a multi-turn explanation to a
  character who misunderstands**, with the character's confusions drawn from the objective's misconceptions
  and JEV judging the child's turns. The spoken pack is the closest ancestor (meaning-key judging, misses
  `read_back / named_only / bare_number / opposite_idea`, model/easier levers) but is capped at one proposition.

### 2. Evidence-grounded feedback phase — NOT present
- Lesson shape in the manifest prompt is fixed: curator-brief → per-objective blocks on an
  Introduce / Visualize / Apply ladder → optional `finalAssessment` (`knowledge-check` or `flashcard-deck` only).
  Nothing in the schema can name a reflection or coach step; the "Wrapping Up" that Primer's design doc
  requires has no slot.
- The lesson tail is `LessonSummary` (before→after P(correct), gates, "Up next") and `LessonImpact` (graph moves).
  Both are analytics. No self-assessment ask, no cited moment, no transfer question, no tutor voice
  (grep of both files for reflect/hardest/next time/speak/tutor: 0 hits).
- The raw material exists: tutor verdicts per item, `demonstratedSkillLog`, spoken-miss names, lever pulls.
  Nothing reads them back to the child.

### 3. Observable objectives — HALF
- Curator objectives are mostly actions ("produce the sounds for s a t p", "combine counters into groups of
  ten", "test objects in water"). Two of eight are aggregate ("compare heavy and light objects to find
  patterns", "explain why certain objects stay on top") with no criterion.
- The runtime objective (`ObjectiveData`: id, text, verb, icon, label, subskillId, skillId, grade) has **no
  evidence or notCredit field**. Primer's rule (a specific utterance, behavior or count; never "ready") and
  Lumina's own objective record (`/curriculum-design-review`: action, evidence, notCredit, misconceptions,
  progression) both have it; the record lives in `qa/*/panel.json`, not in what the manifest receives.
- Consequence: a generator cannot be told what would count, so `explain` degrades to whatever the primitive
  scores (a tap), and nothing downstream can check "was this objective actually elicited".

### 4. Cross-phase journal — NOT present within a session
- `generationContext` carries `learningObservations` (saved, server-delivered at launch from earlier sessions)
  and a misconception opportunity. Within a lesson: grep for prior/earlier results reaching a later component
  or the tutor = 0 hits; the live tutor does not read `submittedResults`; activity N+1 is hydrated before
  activity N is played.
- So the Primer move "practice sets its first challenge from the mentor-phase evidence; feedback reads both"
  has no channel. The intro briefing's prerequisite quick-check result is not passed to the first primitive.

## What the letters work already shows (why this is a generalization)
The K letters run is the one lesson here where every component asks the child to **produce** (say the sound,
hear-see, first-sound say) and where code owns the item space and the key (word library, `wordSpace` beta),
with the tutor's verdict as the record. The spoken pack's `concept_statement` class is the same design for
ideas instead of sounds. The four takeaways extend that pattern one level up: produce an explanation (not a
sound), judged on meaning, with the objective carrying its own evidence rule and the result flowing forward.

## Ranked work, with the layer each change lives in
1. **Objective schema**: add `evidence` (what the child does/says that counts) and `notCredit` to
   `ObjectiveData`/`preBuiltObjectives`; curator brief writes them, Lesson Builder passes them, generators read
   them. Cheapest change, unlocks 2–4. (curator-brief schema + manifest prompt + generationContext)
2. **Teachback surface**: an agent primitive or practice-studio surface where a character holds one of the
   objective's misconceptions and the child teaches it in 3–5 turns; code picks the misconception and the
   character's questions, JEV judges each turn on meaning, "aha"/still-confused ending by consequence.
   Reuse the spoken pack's meaning key and misses. (`/agent-primitive`, kit `surfaces.ts`)
3. **Session evidence record → feedback stage**: one object (verdicts, misses, levers, skills) built as the
   lesson plays; a closing tutor turn reads it: self-assessment ask, one cited moment, one next action, one
   transfer question; rule: never cite what did not happen. Needs a lesson-shape ruling (new tail stage).
4. **Manifest slot**: once 3 exists, the manifest prompt names the closing stage so the curator can bind it
   per objective (the Primer "Wrapping Up" slot) instead of a global knowledge-check.
5. Side finding, not Primer-related: the K letters full run's `phoneme-explorer` generated phoneme /b/
   (beans/bin) in an s-a-t-p lesson. Route to `/topic-fidelity phoneme-explorer`.

Not to do: a per-lesson chat with three voice characters; prompts hand-cast per lesson; non-gating objectives.

## Status (same day)
1. **Objective schema: BUILT and verified on :3000** (`qa/evidence-spec/QUEUE.md`, "The lesson writes the spec"). The
   brief writes `evidence` per objective on both lesson paths; the flatten stamps it; practice-studio took the lesson's
   spec and recorded 0 of 4 items meeting a `build` act (card picks), which is the honest count this was for.
2. **Teachback surface: BUILT, gates green, author runs seen 11-14** (QUEUE, "`teach`" and EV-16): with the explain
   spec the author built 4 of 4 teach items (kept, evidence 2 of 4 with named gaps, $0.14); on the free-form lesson
   the brief wrote `explain` itself, the manifest routed practice-studio into that block, and the author built 1 teach
   item of 4 (the three card items flagged "Use teach", $0.07). Look-stage renders: `primer-bench-2026-11-13/*.png`.
   Owed: EV-17 (component on the workspace), EV-18 (one spoken session, user).
3. **Feedback stage: queued for a ruling** (EV-19).
4. Manifest slot: after 3.
5. phoneme-explorer /b/ leak: not yet routed.
