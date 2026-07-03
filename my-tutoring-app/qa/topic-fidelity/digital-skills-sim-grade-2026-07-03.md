# Topic-Fidelity (--grade) — digital-skills-sim

Date: 2026-07-03
Generator: `my-tutoring-app/src/components/lumina/service/core/gemini-digital-skills-sim.ts`
Modality: `/topic-fidelity --grade`
Verdict: **WRONG_PRIMITIVE** (routing concern — no reading-level grade ladder by design)

## What this primitive is

A K-1 digital motor-skills tutorial. Eval modes are `click` / `drag` / `type` — the
student clicks an emoji target, drags an item to a drop zone, or presses a highlighted
key. Content is not academic; there is no passage, definition, vocabulary tier, or
reading level that could scale with grade.

Catalog (`manifest/catalog/core.ts:685`) is explicit:
- description: "ESSENTIAL for K-1 digital literacy."
- constraints: **"K-1 only. Challenges are very simple motor-skill tasks, not academic content."**

The generator prompt itself hardcodes the audience in three places:
`"young learners (K-1)"`, `TARGET AUDIENCE: ${gradeLevel} students (ages 5-7)`,
`"simple, encouraging language appropriate for ages 5-7"`. `gradeLevel = ctx.gradeContext`
is interpolated once but is dominated by the hardcoded K-1 / ages-5-7 framing.

## Ladder granularity

None. There is no band map and no numeric reading-level ladder. `getGradeLevelContext`
is not used here (so the shape-A always-Elementary bug does not apply). The only grade
signal is prose passed into a prompt that overrides it to K-1.

## Probes (evalMode=click, topic="animals")

| probe | grade | structural signals | notes |
|-------|-------|--------------------|-------|
| K  | K | title "Fun Animal Click Adventure"; 5 click challenges; "Click the friendly dog! 🐶", "Click the busy cat! 🐱" | baby-level motor task |
| 9  | 9 | title "Fun Animal Click Adventure"; 5 click challenges; "Click the friendly dog! 🐶", "Click the happy cat! 🐱" | **identical** structure/register to K |

Cross-band K vs 9 output is structurally identical — same title, same "Click the
[adjective] [animal]!" instruction shape, same single-emoji targets, same 5-item count.
This is the correct and intended behavior: a grade-9 student is not routed here, and if
they were, the primitive should still emit K-1 motor practice, not "grade-9 click-the-dog".

## Decision

No reading-level realization axis exists to make grade-fidelity meaningful. Injecting a
numeric grade line would be nonsensical (there is no reading level to tune) and would
fight the catalog's hard K-1 constraint. Per the skill's WRONG_PRIMITIVE branch:
**change nothing; report as routing.** The correct fix, if grade-9 traffic ever reaches
this primitive, lives in the manifest/selection layer (don't route non-K-1 objectives to
a K-1 motor-skills primitive), not in this generator.

No edit made. No answer leak observed (instructions are action prompts; emoji target is
the interaction, not a revealed answer).
