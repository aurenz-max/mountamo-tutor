# timeline-builder: a life timeline by age

Curriculum IDs: SS004-02-a, sibling SS004-02-b (SOCIAL_STUDIES, grade 1). Source: design review ss-g1-2026-10-17.

## Curriculum

- **SS004-02-a** (Personal Timelines): "Follow a step-by-step interactive guide to learn how to create a timeline of your life events. Focus: Understanding the components of a chronological timeline. Examples: Pick events, order events, add dates, ... label years, identify sequence. Constraints: Use 4 clear steps, keep text short, require simple confirmation actions."
- Sibling SS004-02-b: "Arrange a series of important life milestones in the correct chronological order on a visual timeline."

## Gap

The child reads how a timeline is made, but never makes one:
- how-it-works (sequence) turned the topic into four steps (pick events, order them, add dates, draw the line) and asked the child to order those steps. "Draw the line" could just as well come first.
- timeline-explorer (order) presented the four steps themselves as timeline events dated "First Step" to "Fourth Step".
- timeline-builder has the right interaction (place event cards on a scaled time axis), but its modes are daily, yearly (months) and historical (decades).

## Missing learner action

Build a life timeline: place milestones of a child's life on an axis labelled by age (born, 1, 2, ... 6) or year, then answer a question that reads it ("What happened before you started school?").

## Evidence wanted

- Places 4-5 milestones in order on an age axis, checked in code against each milestone's age.
- Reads a finished life timeline (before/after, how many years between).
- The steps of making a timeline appear as the child does them (pick, order, add the age, read), not as a list to memorise.

## Example

A story child, Ava: born (age 0), first steps (age 1), first word (age 1-2), started preschool (age 4), lost first tooth (age 6). Ava's events are placed on 0-6. Question: "What did Ava do before she started preschool?"

A misconception to catch: ordering by how important an event feels rather than by age.

## Constraints

- Use a story child with stated ages, not the student's own life, for anything that earns credit. The student's own timeline can be an ungraded step.
- Milestone ages vary across children (first steps, first word). Keep ages stated on each card, or use milestones with a fixed order (born before started school), so the key is not a developmental claim.
- The current yearly mode prints the month in every card's description (`gemini-timeline-builder.ts:319`, TimelineBuilder.tsx:693-697). Decide on purpose whether the age is shown on the card.

## Handoff

Read the timeline-builder contract if present (`/primitive-contract` otherwise), then add the mode with `/add-eval-modes` or another route you judge better, and close with `/eval-test`.
