---
name: curriculum-fit
description: Review curriculum homes for a Lumina primitive and its exact modes using the shared HTML coverage atlas; diagnose retrieval separately when attribution is in question.
---

# Curriculum fit: primitive to curriculum

Answer which published requirements a primitive can honestly serve, in which modes,
and with what evidence. Use the primitive-side view of the same relation maintained
by `/curriculum-lumina-audit`; do not create a competing mapping report.

Arguments: `<primitive-id> [grades]`, `<domain>`, or `all`. Scope subject and grade
explicitly. Cross-subject primitives can have multiple homes; catalog file location
alone must not exclude them.

## Shared artifact

Read `my-tutoring-app/qa/curriculum-coverage/README.md`. Primary deliverable:
`my-tutoring-app/qa/curriculum-coverage/index.html`, Primitives -> curriculum view.
It shows exact mode edges, partial capabilities, tested content and development work.
The implemented pilot covers live published K Language Arts only. Another grade or
subject needs its own snapshot and reviewed edges; do not present the pilot as a sweep.

Use imported catalog definitions, not regex extraction of TypeScript strings. Inspect
the exact mode, constraints, generator and component action before asserting a fit.
Keep a catalog candidate, generated-content check and live interaction check distinct.
A missing edge is no reviewed home in this scope, not proof of zero student usage.

When adding/revising mappings, record the verbatim curriculum requirement, exact mode,
reason, unmet action, source basis and next executor in the shared review. Show the
actual generated task in HTML for any content verdict. Reuse the existing generator
probe and check scripts; an HTTP/endpoint pass is not a usable-content verdict.

## Retrieval diagnostics (only when requested or attribution is the issue)

`backend/scripts/curriculum_fit_probe.py` reuses the production matcher, but its current
CLI constructs the fallback description/context query. Production can instead lead
with challenge text and mode description and omit the broad description. Label which
input regime was tested; do not claim a description-only probe reproduces a specific
student submission.

From backend, using its configured venv and PYTHONPATH:

```text
python scripts/curriculum_fit_probe.py --primitive <id> --domain <domain> --grades <K,1|auto> --description <verbatim-description> --json
```

Use its returned thresholds, grade_requested, actual resolved grade, top-k and abstain
reason. Retrieval may widen grade scope: preserve that distinction in findings. A
MATCH demonstrates a retrieval home, not correct content or assessability. A miss
requires checking curriculum presence, scope and catalog wording before proposing a
curriculum gap. For challenge-level parity, extend/replay the probe with production
challenge/mode inputs rather than hand-editing a query until it matches.

Curriculum authoring and publishing remain separate work through `/curriculum-author`.
Do not write target_primitive assignments as the output of a fit review.
