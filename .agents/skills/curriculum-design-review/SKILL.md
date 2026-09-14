---
name: curriculum-design-review
description: Sample published Lumina curriculum, draft lesson manifests with verified evaluation modes, and produce an HTML pedagogy review with implementation briefs for useful new primitives or modes. Use for curriculum-to-lesson design reviews, not full coverage audits or primitive implementation.
---

# Curriculum Design Review

Turn a reproducible curriculum sample into concrete lesson plans and an evidence-based decision about what Lumina should reuse, extend, or build. The output should let a new session implement a recommended capability without reconstructing this conversation.

## Scope and defaults

- Honor the requested subject, grade, sample size, and format. If unspecified, use five unique skills and two subskills per skill, sampled without replacement; one lesson per selected subskill. Ask for subject/grade only when context cannot resolve them.
- Default deliverable: a standalone HTML report, individual manifest JSON files, a manifest bundle, sampling/source records, and a Markdown build brief for each recommended new primitive. Treat lesson duration as an explicit planning assumption (15 minutes is a useful default).
- This is a design review. Do not implement primitives, edit curriculum, modify mastery paths, or hydrate every lesson unless requested. If the user asks for generated manifests or runtime validation, perform that additional work and report its status separately.
- No quota for new primitives: a conclusion that existing capabilities suffice is valid. A mode extension is usually preferable when the current interaction already supports the learning action.

## 1. Obtain and sample real curriculum

Use the available `curriculum` skill for the published read path. Locate the Lumina repository and its AGENTS.md; do not assume the current working directory is its root.

Current read endpoint: `http://127.0.0.1:8000/api/curriculum/curriculum/{subject_id}?grade={grade}`. Verify the endpoint in `backend/app/api/endpoints/curriculum.py` if it changes. Explicit IPv4 can work when `localhost` times out. If unavailable, use the service's read-only published Firestore fallback. A grade PRD or old report is not a current published snapshot; label any requested snapshot-based fallback and its age.

Save the raw response before sampling. Use [scripts/sample_curriculum.py](scripts/sample_curriculum.py) for the endpoint's unit/skill/subskill shape:

```text
python <skill>/scripts/sample_curriculum.py --input <snapshot.json> --subject LANGUAGE_ARTS --grade 2 --skills 5 --subskills 2 --output <sample.json>
```

The helper creates a fresh recorded seed unless `--seed` is supplied. It validates scope and IDs, sorts candidates by ID, and samples both levels without replacement. It records excluded undersized skills, all eligible parent IDs, selected parents with full sibling sets, Python version, and snapshot hash. Missing scope metadata is a validation failure; inspect the actual service shape instead of inventing grade provenance. If another shape is used, adapt normalization explicitly and preserve the raw snapshot.

Do not redraw because the result is inconvenient or lacks variety. Record intentional stratification or skill selection as a different method. A random sample is not a balanced or exhaustive curriculum audit.

## 2. Ground lesson choices in the current repository

All primitive code is under `my-tutoring-app/src/components/lumina/`:

- Catalog: `service/manifest/catalog/index.ts` and domain catalogs.
- Generators: `service/<domain>/gemini-<id>.ts`.
- Components: `primitives/visual-primitives/<domain>/<Name>.tsx`.
- Generator registrations: `service/registry/generators/`.
- Manifest types: `types.ts` (`ExhibitManifest`, `ManifestItem`, `ObjectiveBlock`).

Export the live catalog using the project's existing tooling (see `my-tutoring-app/scripts/curriculum-coverage-snapshot.mjs` for the Vite module-runner pattern). Save source paths/hashes and the relevant catalog snapshot. Do not freeze today's catalog in this skill.

Treat curriculum `target_primitive` and `target_eval_modes` as hints, not proof of fit. Read each candidate's grade, content, modality, response-form and scoring constraints. Inspect generator and component code for central claims and suspected gaps. Distinguish catalog-supported, source-confirmed, generator-probed and interaction-tested findings.

In particular, verify:

- Does the student recognize, manipulate, speak, read, or write the required thing? A spoken sort is not a drag surface; spoken word production is not spelling.
- Does the mode allow the required content? An intent cannot expand a code-owned word pool, grade band, passage type, or audio length limit.
- What earns credit? Completion, text length, changed text, or modeled rereading may be useful practice without being objective mastery evidence.
- Does the mode actually alter the component's task and scoring, or only its prompt? Check rendered phases and grading branches.
- Are difficulty numbers curriculum values, catalog priors, support tiers or structural difficulty? Do not conflate them or invent calibrated betas.

## 3. Draft the lessons and judge the gaps

For each sampled subskill, preserve the exact published ID, description, parent and mapping. State the intended learner action and independently observable success criteria, then select existing component/mode pairs that honestly contribute.

Use `config.targetEvalMode` with exact current catalog IDs. Preserve objective text, grade and subject through the repository's supported manifest fields and `objectiveBlocks`; keep any flat `layout` consistent. Let generators author item content. Keep proposed IDs outside runnable manifests. Read the current manifest schema before producing JSON.

Provide a coherent introduction, focused practice and fresh independent review. Multiple activities may use the same primitive/mode when pedagogically justified; do not force variety. Budget the whole lesson. If a review requires a person or an unimplemented capability, mark it as an external review protocol or unmet requirement, not a fictional runtime component.

For every lesson, answer: **Could a bespoke primitive or eval mode improve the pedagogy?** Choose among reuse, repair existing scoring/wiring, add a mode, or build a new primitive. Explain the missing learner action/evidence and why the smallest suitable change addresses it. A generic worksheet with a new name is not a new interaction. Distinguish confirmed defects from proposed improvements.

## 4. Produce implementation-ready recommendations

Read [references/deliverables.md](references/deliverables.md) for the report and build-brief contracts. For a new primitive, consult the available `primitive` skill's current design/lifecycle contract; for an eval-mode extension consult `add-eval-modes` as needed. Use those contracts for the handoff, without invoking their implementation/delegation phases during this design-only task.

Default to a high-level pedagogical handoff: learning goal, observed gap, essential learner behavior, concrete example, evidence of success, and important uncertainties. Label interaction ideas as suggestions. Let the implementing session inspect the repository and choose its own schema, architecture, names, integration details, tests and implementation process under current repository guidance. Do not prescribe TypeScript interfaces, file maps, hook lists, scoring formulas or a fixed skill execution sequence unless the user requests that detail or a verified compatibility requirement makes it necessary. Preserve exact existing IDs in manifests; proposed designs need not have finalized technical IDs. A useful handoff is concrete about learning outcomes without pre-solving implementation.

## 5. Validate and deliver

- Check distinct skill/subskill counts, parent membership, scope and exact curriculum text.
- Validate every existing component/mode binding, unique instance IDs and objective references against current catalog/schema. Audit constraints as well as ID existence.
- Check HTML anchors, local artifact links, escaping, complete sections and JSON validity. Preview wide/narrow layouts and expandable manifests when browser tooling is available; disclose when no visual preview was possible.
- If generation or runtime tests were requested, distinguish their results from source review and report unresolved failures; otherwise do not claim those tests ran.
- Link the HTML report and any useful build brief. State whether manifests are authored, generated, hydrated or runtime-tested. Do not claim teaching effectiveness from a catalog check.
