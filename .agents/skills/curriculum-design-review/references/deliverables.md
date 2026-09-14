# Deliverable contracts

## HTML report

Use responsive, readable HTML with embedded CSS and no network dependency. Include a concise conclusion, navigation, a sample table, a section/card for each lesson, recommendations, implementation briefs and provenance. Collapsible manifest JSON keeps the report readable; link sibling downloads. Escape curriculum and JSON text before embedding in HTML. A copy-brief button is optional; its fallback should be a working download, not a dead clipboard action.

Sampling/provenance must distinguish published facts from authored decisions:

- Subject, grade, retrieval source and timestamp; raw snapshot SHA-256.
- Sampling algorithm/seed, candidate population, exclusions, selected parent and child IDs, and full sibling records for replay.
- Current catalog and inspected component/generator sources with hashes or commit identity.
- Validation performed and not performed. State source-level inferences as such.

Each lesson should contain:

1. Exact curriculum hierarchy/description and original target mapping.
2. Child-friendly title, learner action and lesson sequence with estimated total duration.
3. Exact existing component/eval-mode bindings and why each contributes.
4. Independent evidence criteria and fresh review task; distinguish mastery evidence from prerequisite or supported practice.
5. Current content, grade, response or assessment limitations.
6. A reuse/repair/new-mode/new-primitive decision, scoped to this objective.
7. Inspectable manifest and downloadable JSON.

Keep design metadata outside `ExhibitManifest` in a wrapper, for example:

```json
{
  "lessonId": "lesson-01",
  "curriculum": { "subject": "LANGUAGE_ARTS", "grade": "2", "skillId": "published-parent-id", "subskillId": "published-child-id" },
  "status": "authored; catalog-checked; not hydrated",
  "manifest": {},
  "sequence": [],
  "evidenceCriteria": [],
  "coverageLimits": [],
  "recommendation": { "kind": "new-mode", "proposedBinding": null, "rationale": "" }
}
```

The empty objects above describe the wrapper, not valid completed manifests. Populate `manifest` according to the current repository types. Do not insert proposed primitive/mode names into its live bindings. When no honest existing binding exists, state the gap and provide a proposed design manifest separately, explicitly non-runnable.

## New primitive build brief

Make this independently usable in a new session. Include the relevant curriculum excerpt and IDs; do not rely on an earlier HTML link for the objective. Default to a concise product/pedagogy brief, not a technical specification.

- **Learning goal and gap:** who the learner is, what they should learn, what current tools fail to elicit, and evidence for that conclusion. Recommend reuse, extension or a new primitive while allowing the implementing session to reconsider after inspecting current code.
- **Essential behavior:** what the learner must be able to do and what teaching support must preserve. Separate these requirements from one possible interaction concept; avoid prescribing screens or a fixed state machine.
- **Worked example:** show a meaningful successful response and a plausible misconception. Examples clarify the learning contract, not the schema.
- **Evidence of success:** describe what would demonstrate independent learning versus supported practice, what should not earn credit, and important uncertainty cases. Leave metrics representation and scoring implementation open unless an exact rule is essential to pedagogical validity.
- **Constraints and open questions:** grade/topic scope, answer exposure, accessibility or audio limitations relevant to this activity. Label current implementation limitations as observations to recheck, rather than permanent design rules.
- **Handoff:** ask the next session to inspect current repository guidance and related capabilities, follow its own design and implementation process, and deliver the working capability with appropriate verification. Explicitly leave schema, architecture, component/mode naming and build sequence to that session.

Keep exact interfaces, file-by-file plans, hook lists, generator fork decisions, beta values and prescribed lifecycle sequences out of the default brief. Include technical detail only if requested or necessary to preserve a verified integration constraint, explaining why it is binding. The current implementation skills own their technical guidance; this review should not duplicate it.

For a mode extension, a smaller brief is enough: likely owning primitive, missing learner action, desired evidence, a concrete example and scope constraints. If the real problem is incorrect scoring in an existing mode, recommend fixing that mode rather than hiding the defect behind a new name.
