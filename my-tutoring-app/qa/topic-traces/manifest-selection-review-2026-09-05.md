# Manifest selection review — 2026-09-05

Scope: review of the current working tree, saved lesson packages, lesson-coverage report, and prior A/B evidence. No production code changed and no fresh generation performed. Existing uncommitted generator work may supersede defects in saved packages.

## Recommendation

Keep the objective-centric pipeline and dedicated mode resolver. First repair objective identity; then pilot selection using a compact account of the student performance each primitive can elicit. Measure whether this improves actual objective coverage before widening the change. Avoid adding another planning or judging service.

Current flow: brief writes objectives → manifest selects primitives from descriptions and base affordances → resolver chooses modes within those selected primitives → flatten stamps objective context → generators produce content → coverage judge evaluates the result.

The principal design limitation is that primitive selection commits before it sees explicit mode capabilities. The later resolver can choose a better mode, but cannot select a different primitive when none of the chosen primitive's modes serves the objective. Whether exposing compact capabilities improves outcomes is an experiment, not an established result.

## Findings and priorities

### 1. Preserve the supplied objective contract (confirmed code defect; first priority)

`gemini-manifest.ts:356` puts objective text, verb and grade into the prompt, but omits IDs. The schema encourages synthetic `obj1` IDs. Both `resolveLessonEvalModes.ts:116` and `flattenManifest.ts:72` join back to authoritative objectives by ID. For curriculum IDs, this misses; the flatten implementation explicitly documents it and recovers only lesson grade.

Consequences at this boundary: original text/verb can lose authority, per-objective curriculum metadata is absent from generated configs, and skill-scoped remediation matching can miss. Later render attribution recovery does not restore the original generation input. This review does not claim student records are necessarily misattributed downstream.

Recommended simplification: let the model return an objective reference and selected components. Code owns objective text, verb, grade and curriculum IDs. Validate references, duplicates, missing objectives and unique instance IDs before resolution. Share one objective binding implementation between resolution and flattening. Test non-`objN` IDs and reordered/missing/unknown blocks; do not silently bind by position.

Related: the model also emits `gradeLevel`, and flatten trusts it as a fallback. The saved regrouping package `grade-2-adding-two-digit-numbers-within-100-with-regroup-20260906013924-j2q2.json` records a requested `1st grade` and returned `Grade 2` (also tracked in lesson-bench BACKLOG item 26e). Preserve explicit caller grades. Keep any optional band-to-precise-grade inference as a separate, explicit policy.

### 2. Select for observable performance (design pilot)

The manifest sees descriptions/constraints and primitive affordances, explicitly excluding mode lists. The resolver sees mode descriptions truncated to 160 characters; it does not pass exact objective grade or mode-specific affordances in its slot representation. Thus useful distinctions available in the catalog are missing at decision time.

Pilot a compact capability summary derived from existing catalog definitions: what the student does, what is judged, supported content, and relevant mode demands. Distinguish naming, recognizing, constructing and explaining; `spoken` alone is a response channel, not proof that explanations can be evaluated. Retain the full catalog; missing metadata remains unknown. Avoid a manually maintained second capability registry or a restrictive retrieval shortlist.

Keep the dedicated resolver: prior ablation evidence supports separating mode selection. First expose concise capability summaries to the manifest and complete relevant mode descriptions/affordances to the resolver. Compare against current behavior before considering joint primitive-and-mode selection.

### 3. Make each selected component's contribution explicit (design pilot)

The manifest repeats a fixed 2–4 components per objective, the introduce/visualize/apply ladder, and a substantial deep-dive preference section. It has no explicit per-slot account of which performance the child will demonstrate. A component's generic `apply` role cannot establish that it assesses this particular objective.

A small per-slot planning annotation such as `purpose` and `expectedStudentAction` would make selection reviewable and distinguish instruction from intended evidence. This is a plan, never assessment credit. Where useful, carry it through the existing intent channel rather than inventing parallel generator instructions.

Experiment with treating 2–4 as guidance, using existing duration facts and the objective's needs to determine block count. A primitive may teach and assess within one experience. Preserve prerequisite ordering. Do not add mandatory blocks to make a judge row pass or weaken objectives to fit existing supply.

### 4. Remove stale fallback assumptions (confirmed inconsistency)

The manifest schema no longer asks for `targetEvalMode`, but resolver comments and failure handling describe retaining curator pins. A missing/invalid pick or timeout can actually leave the slot unpinned. The summary counts this as `kept`, obscuring the difference between a confirmed selection and unresolved selection.

Record resolution status per slot (`resolved`, `unresolved`, `error`) and actual fallback behavior in the existing trace/package. Preserve genuinely supplied pins where present. Do not describe an unpinned slot as a successful fallback or default it arbitrarily to a different skill.

Also reconcile `buildStudentContextBlock`'s `challenging` instruction with the schema and main prompt's `hard` value.

### 5. Reuse the existing harness; improve causal attribution

The report command returned 54 rows, 123 objectives, 65 sufficiently assessed, 16 indirectly assessed and 36 insufficiently assessed. These are mixed-source instrument readings, not a production success rate: only three rows are `build-stream`, 12 are `live-test`, and one is `calibrate`. There are zero error rows but 10 schema fallbacks. The documented Q4 calibration target has not been demonstrated by this dataset.

Concrete inspected example: `grade-1-repeating-and-growing-patterns-20260906014200-f00i.json`, `obj3-speak-the-rule`. The manifest explicitly requests a spoken pattern-rule explanation and pins `say_answer`; the payload is `items: []` with “No matching practice is available for this task.” The stored judge labels the objective insufficiently assessed. This establishes a failed content outcome despite an appropriate intent; it does not establish that changing manifest wording would solve it. Inspect the current generator contract to distinguish supply from generation defects before repair.

## Proposed experiment

1. Fix and deterministically verify objective binding separately from selection experiments.
2. Extend the existing affordance A/B approach with one capability-summary switch. Freeze supplied objective IDs/text, exact grade, profile and brief across arms. Include a baseline-versus-baseline comparison to measure sampling variance.
3. Use a small demand-led slice: numeral naming versus recognition, pattern continuation versus rule explanation, equal-sign understanding, and at least one non-math subject. Run three fresh manifests per arm per case initially; expand if results are ambiguous.
4. Hydrate both arms, run existing lesson-coverage and lesson-bench checks, and inspect cited payloads. Primary outcome: actual direct and sufficient assessment per objective. Also compare missing objectives, generation failures, duration, reading demand, primitive diversity and latency. Manifest-only metrics cannot establish learning coverage.
5. Human-rate disagreements and calibrate Q4. Keep the judge in shadow; no new judge, automatic repair loop or publishing gate.
6. Populate existing package provenance fields: `gitSha` and `promptHash` are currently hardcoded null in `lessonPackage.ts:339`. Record model/catalog/resolver versions or hashes and selected mode status so future comparisons have an identifiable baseline.

Do not repeat rejected experiments: the modality-first within-block A/B reduced mean sequence quality from 4.03 to 3.75 and increased dependency violations from 47% to 61% (`manifest-modality-ab-2026-08-08.md`). Resolver-driven reordering and position-aware picks also have documented rejected experiments. Any change in these areas needs a new, specifically supported hypothesis.

Implementation order: objective identity and explicit grade → truthful resolver status and prompt cleanup → capability-summary A/B → evaluate block-count simplification separately. This keeps each outcome attributable to one change.
