---
name: curriculum-lumina-audit
description: Audit published curriculum requirements against Lumina primitive modes, produce the shared HTML fit atlas, test candidate content, and route concrete repairs or primitive development.
---

# Curriculum to Lumina: reviewed fits with evidence

Primary output is an interactive HTML reference, not a table of legacy assignments.
Use curriculum requirements LEFT JOIN reviewed primitive/mode edges. `/curriculum-fit`
reads the other direction of the same relation. Multiple candidates and partial support
are normal; a primitive need not teach and assess an entire objective by itself.

Arguments: `audit <subject> [grade] [unit]`, `gaps`, `unused`, `verify <requirement-id>`.
`unused` means no reviewed home in the selected curriculum scope, not runtime usage.

## Existing implementation

Read `my-tutoring-app/qa/curriculum-coverage/README.md`. It documents the runnable
snapshot, explicit review, generation probe, content checks and HTML build commands.
The implemented pilot is K LANGUAGE_ARTS (191 requirements); the six content-probed
pairs are listed in `scripts/curriculum-coverage-probe.mjs`. Do not run it for a different
subject and imply that subject was tested. Extend scope-specific inputs/reviews first.

The atlas at `qa/curriculum-coverage/index.html` includes grade/subject navigation,
requirements and primitive modes in both directions, generated task previews, source
provenance and a grouped development queue. Keep HTML primary; JSON is internal evidence.

## Review and verify

- Read published curriculum with an explicit subject AND grade through the existing
  backend. Preserve IDs, source text and hashes. Failed/missing snapshots are not gaps.
- Import the complete catalog and modes. Legacy target_primitive/target_eval_modes are
  provenance only: ai-tutor-session does not mean no suitable primitive exists.
- Review the required action against each proposed mode, including non-reader access,
  spoken versus manipulative responses, picture requirements, and scope limits. General
  tools are eligible when they satisfy the action; specialist branding is not evidence.
- Classify direct candidate, partial support or development needed, with a specific
  reason and next action. Inspect plausible alternatives across catalog domains before
  proposing a new primitive. A development recommendation is not proof of impossibility.
- Probe candidates with exact curriculum text, grade, mode and scoped intent through
  the production dispatcher. Inspect the generated data with its component and production
  item conversion. Check nonempty usable items, valid answers, scope and answer shortcuts.
  Use `/eval-test`, `/oracle-test` and `/topic-fidelity` where appropriate.
- Persist each actual payload and check result; embed readable task previews in HTML.
  Content samples do not certify live interaction. Use `/tutor-test` or an actual drive
  for the voice path and leave it untested until exercised. Review at least the identified
  failure family, not just a random fresh passing draw.
- Source/curriculum changes invalidate affected evidence. `review-basis.json` freezes
  the reviewed curriculum and catalog; never refresh its hashes merely to silence a stale
  review error. Review the changed requirements/capabilities before updating that basis.

## Turn gaps into work

Use `qa/curriculum-coverage/work-items.json` and the HTML Development queue. Each item
needs blocked requirement IDs, closest existing capability and its limitation, proposed
minimal change, executor and acceptance examples. Deduplicate shared missing actions.
Distinguish generator/interaction repair, existing-mode extension, new primitive, and
ambiguous curriculum. Confirmed component/generator defects also enter EVAL_TRACKER.md.
Prioritize actual blocked tasks; do not count an untested assignment as solved.

The previous `upgrade`/`full-loop` behavior that rewrote curriculum to name a primitive
is retired. Curriculum defines what to teach; audited mappings live in QA. If the user
requests actual curriculum changes, route those through `/curriculum-author` with its
draft-first and lineage rules. This audit does not publish or modify student state.

Finish with the clickable HTML artifact and a short account of scope, verified findings
and remaining untested work. Neither a catalog match nor an endpoint pass certifies fit.
