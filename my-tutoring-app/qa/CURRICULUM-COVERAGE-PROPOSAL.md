# Curriculum coverage: shared mappings and executable evidence

Proposed 2026-09-07 after reviewing the two curriculum skills and their implementations.
The K Language Arts pilot is now implemented: see [the HTML atlas](curriculum-coverage/index.html)
and [runnable workflow](curriculum-coverage/README.md). It contains 191 live curriculum
reviews and 12 fresh content draws over six pairs. Other scopes, a general CLI and SQLite
storage remain proposed. Both repository curriculum skills now use the shared artifact.
The pause on manifest self-evaluation and lesson journeys remains in effect.

## Findings

- `.claude/skills/curriculum-fit/SKILL.md` is a useful retrieval diagnostic, but overstates
  equivalence with production inputs. `backend/scripts/curriculum_fit_probe.py` calls
  `_build_retrieval_query` without `eval_mode_description` or `challenge_text`; production
  supports both and, when present, excludes the broad primitive description. Keep a
  description-only diagnostic, but distinguish it from mode/content attribution tests.
- `backend/scripts/curriculum_fit_sweep.py` repeats that fallback and extracts catalogs
  using exact indentation and single-line string regexes. Export the imported TS catalog
  instead; reconcile exported IDs with the generator/component registries.
- `.claude/skills/curriculum-lumina-audit/SKILL.md` audits stored `target_primitive`
  assignments, labels catalog matches GREEN, and proposes rewriting curriculum to fit
  primitives. This conflicts with the repository's curriculum/implementation separation.
  Its `unused` means unreferenced in stored assignments, not unused by students.
- That skill's generic-is-bad rule confuses specificity with suitability. Evaluate the
  required learner action and evidence instead. A display may teach without assessing;
  a specialist can still fail to assess, and a general tool can meet a specific demand.
- `/api/lumina/eval-test` already invokes the production generator dispatcher with mode,
  intent, grade and difficulty. Its pass status is a payload/type check, not proof of
  objective fulfillment, correct answer keys, usable interactions, or learning.
- Existing `scripts/lib/lesson-planner-pairs.mjs` constructs primitive/mode task cards.
  Reuse/extract the catalog projection, not its lesson planning or closing-task policy.

## One relation, two views

Use three normalized datasets, plus evidence artifacts:

1. Curriculum requirements: snapshot, subject, canonical grade, subskill ID, verbatim
   source objective/constraints, and reviewed requirement clauses. Derived clauses retain
   provenance and must not silently change the curriculum. Compound objectives can have
   multiple clauses without changing curriculum IDs.
2. Primitive capabilities: catalog snapshot, primitive ID, exact mode (or explicit
   non-assessment capability), constraints, resolved affordances, source/registry references.
   Keep no-mode and cross-subject primitives visible; absent metadata means unknown.
3. Mapping edges: requirement key, primitive/mode key, proposed contribution (teach,
   practice, assess), applicable configuration/scope, rationale, decision, and evidence IDs.

An edge is many-to-many. Separate candidate, reviewed fit, generated-content evidence,
and interaction evidence. Store pass/fail/unknown/stale per dimension, not one green score.
Keep attempted/rejected pairs so a failed candidate remains distinguishable from no search.

Curriculum LEFT JOIN edges LEFT JOIN capabilities exposes requirements with no candidate,
only partial contribution, untested candidates, failed tests, or verified support.
Capabilities LEFT JOIN edges LEFT JOIN curriculum exposes capabilities without a reviewed
home in the selected scope. Assess coverage clause by clause before rolling up a subskill.
Retain every requirement/capability in denominators, including those with zero edges.

These are ordinary joins after the relation exists. Producing and verifying that relation
is the substantive work; embedding similarity proposes edges but cannot certify them.
Stored target_primitive values can be imported as legacy candidate hints, not ground truth.
An unmapped capability is not evidence of zero runtime utilization or a reason to retire it.

## Proposed tool

The primary output is a self-contained, interactive HTML curriculum atlas. Start with a
local CLI and SQLite evidence store; JSON/CSV are secondary interchange formats. No new
hosted service is needed for the pilot. Commands below are proposed, not currently runnable:

```text
curriculum-coverage snapshot --subject MATHEMATICS --grade K
curriculum-coverage candidates --snapshot <id> --unit <id>
curriculum-coverage review --import <decisions.json>
curriculum-coverage verify --edges <ids> --draws 3
curriculum-coverage report --from curriculum
curriculum-coverage report --from primitives
curriculum-coverage backlog
```

The HTML opens with a grade-by-subject matrix, then drills into units, requirements,
primitive modes, evidence, and recommended work. Both join directions share filters and
the same underlying records. Distinguish missing snapshots, unreviewed candidates, partial
support, failed checks and stale evidence visually and in text. Never color an untested
catalog match as verified. Each future evidence result should expose its actual generated
task, student action and check results; link playable artifacts when available.

A working audited reference is at `qa/curriculum-coverage/index.html`. Regenerate with
`node scripts/curriculum-coverage-artifact.mjs`. It embeds a live-read K Language Arts
snapshot, explicit reviewed mode edges, generated task examples and a development queue.
Legacy assignments are hidden under provenance. Other scopes are explicitly not loaded.
The pilot uses versioned JSON evidence internally; HTML is its primary report. Generic
candidate discovery and multi-subject orchestration remain future work.

- Snapshot explicit subject/grade published curriculum through the existing read API;
  record source revision/content hash and catalog hash. Failed reads are errors, not gaps.
- Export catalog via TS imports; check IDs, modes and registrations deterministically.
- Retrieve candidate modes, allow manually nominated candidates, then inspect actual
  generator/component behavior against requirements. A top-k miss is unresolved until
  broader candidate inspection supports a gap decision. Calibrate discovery recall on
  reviewed positive and negative pairs before making portfolio-wide gap claims.
- Persist review decisions with source references and narrowly scoped exclusions.
  Record who/what reviewed, rubric version, and any unresolved ambiguity.
- Generate directly through the existing dispatcher, fixing curriculum text and scoped
  intent as inputs; do not ask Gemini to choose or rewrite the learning objective.
- Persist each request, full payload, checks, source hashes, model identifier, timing,
  outcome and error. Fresh draws are samples, not a statistical reliability guarantee;
  record observed results rather than claiming deterministic seed reproducibility.
- Invalidate affected evidence when curriculum, catalog, generator, component or rubric
  changes. Allow an edge-specific rerun and explicit count/cost limits for generation.

## What verification must establish

Evaluate three distinct questions for each candidate edge:

1. Does the implementation support the required action and scope? Read component,
   generator, mode definition and constraints; citation-based review produces a test plan.
2. Does generated content actually instantiate that action? Check scope, target concepts,
   answer correctness, solvability and answer leakage using existing oracles where possible.
   Use explicit reviewed rubrics for semantic claims; model judgments are advisory evidence,
   with human spot checks and unresolved cases retained as unknown.
3. Can the student perform it and receive correct feedback? Exercise representative
   correct, incorrect and retry interactions. For spoken tasks, include live voice evidence
   or mark that dimension unverified. A payload pass cannot imply an interaction pass.

Use eval-test/oracle-test/topic-fidelity/tutor-test as executors where applicable, not as
competing evidence stores. Keep teaching and independent assessment separate. One primitive
need not deliver a whole lesson. These checks establish tested curriculum support, not
learning effectiveness or mastery for actual students.

## Recommendations become actionable work

Route by the missing capability, deduplicated across blocked requirements:

| Finding | Action |
|---|---|
| Existing behavior meets demand; metadata/retrieval misses it | Fix discovery/catalog evidence |
| Existing mode emits out-of-scope or incorrect content | topic-fidelity / eval-fix |
| Existing primitive lacks the needed action or mode | Extend primitive through lifecycle skills |
| Supported action is broken in interaction/evaluation | Repair component/evaluation, rerun edge tests |
| No existing primitive can supply the required action | New primitive brief through primitive skill |
| Curriculum requirement is ambiguous/inconsistent | Curriculum review; retain original requirement |

Each work item includes blocked requirement IDs, closest alternatives and why rejected,
minimal required interaction, proposed mode/configuration, acceptance examples, counterexamples,
and the evidence command to rerun. Rank by verified unmet requirements addressed, reuse and
implementation effort. Prioritize extensions over new primitives when they honestly suffice.
Do not count a mapped-but-untested requirement as solved or repeatedly propose a known task.

## Skill refactor and delivery order

1. Build the shared snapshot, catalog export, edge schema, and both join reports. Use one
   published K Mathematics unit as a pilot, selected after reading its actual IDs/text.
   Include reviewed positives, negatives, zero-candidate requirements and unmapped modes.
   Gate: complete snapshot row accounting; both views derive from the same edge set;
   broken registrations, duplicates and dangling IDs surface explicitly.
2. Wire edge verification into generation and existing QA. For a small set of pilot pairs,
   run multiple fresh draws and representative interactions. The existing ordinal-name
   fixture illustrates a useful distinction: recognize a position versus produce its name.
   It explicitly has tester-authored IDs, so it must not substitute for published curriculum.
   Gate: report separates candidate fit, content results and interaction results; a failed
   candidate produces a concrete repair or extension brief and can be rerun after repair.
3. Refactor curriculum-lumina-audit into the curriculum-side view plus recommendation/work
   routing. Remove assignment rewrites, generic-is-bad colors, and publishing from its core
   loop. Refactor curriculum-fit into the primitive-side view plus explicit retrieval
   diagnostics (description, mode, actual challenge). Both read/write the same evidence.
   Gate: at least one pilot repair is confirmed through the same stored edge, then expand
   to another unit/subject to check generality before attempting an all-curriculum sweep.

Keep this evidence store outside published curriculum and runtime selection initially.
Persisting audited relationships is useful without making them mandatory production routes.
If the user later wants verified mappings to constrain selection, treat that as an explicit
architecture change with freshness, fallback and attribution behavior defined and tested.
