# Annotated example: elementary presentation review - 2026-09-12

## Outcome

Implemented a focused presentation and shorter generation guidance, followed by fixes for AE-5..AE-7. The follow-up below records passing content and real-renderer DOM checks; the original failures remain preserved as baseline evidence. Browser visual acceptance is pending because no browser is available. Historical advanced AE-1..AE-4 are not cleared by this review.

## Sampled problems

One real API draw before and after for each topic, all with difficulty=easy, grade=2..5 and matching gradeLevel. This primitive has no catalog eval modes; evalMode=auto merely selects the harness generation path. Its HTTP pass does not establish semantic correctness.

| Grade | Topic | Steps before / after | Annotation words before / after | Content QA |
|---|---|---|---|---|
| 2 | 24 + 13, no regrouping | 4 / 2 | 598 / 148 | FAIL: inset reveals later prediction answer |
| 3 | 3 bags with 4 apples each | 4 / 2 | 545 / 158 | FAIL: original table has wrong added quantity; fresh steps duplicate multiplication |
| 4 | 1/2 expressed in eighths | 4 / 2 | 709 / 167 | FAIL: inset names 4/8 before prediction; diagram has no image |
| 5 | 0.4 + 0.3 | 3 / 2 | 453 / 206 | FAIL: inset reveals 0.7 before prediction; diagram has no image |

Raw generated JSON: `../annotated-example-presentation/grade-{2,3,4,5}-{before,after}.json`. The expected final values are 37, 12, 4/8, and 0.7; sampled final answers match. The table and disclosure failures still make these unsuitable as clean assessment evidence.

Annotation text fell from 2,305 to 679 whitespace-delimited words across these draws (71%). This is a small stochastic comparison, not a guaranteed word cap or controlled study. Problem wording and inset selection also vary between draws.

## Presentation changes

- One visible step with Back/Next navigation; visited steps stay mounted so committed answers survive review.
- New examples reset navigation and completion state. Pending prediction gates disable Next from the first render; gateable problem insets still block the worked solution.
- All five annotation layers live under optional "Help me understand"; they are unavailable while that step has a pending prediction. The strategy stays hidden until prediction gates are complete to avoid exposing legacy solution text early.
- Larger problem text, simpler labels, no student-facing renderer type badges or pipeline debug. The dedicated tester explicitly opts into debug.
- Solver no longer requires 3-6 moves or warns that two steps are incomplete. Elementary explanation guidance uses shorter sentences and concrete language without truncating mathematical content.

## Confirmed issues at initial review

### AE-5 - Upstream and earlier-step answer disclosure
- Severity: HIGH
- Grade 4 before/after problem inset labels the midpoint `4/8`, then asks students to predict `4/8`. Grade 2 and 5 insets similarly mark the answers 37 and 0.7. Grade 3 fresh step title also names multiplication before an operation prediction.
- Fix in: GENERATOR (inset authoring + global challenger). Local annotation hiding is repaired, but cannot solve cross-step or inset disclosures.

### AE-6 - Diagram generator does not produce an image
- Severity: HIGH
- `generators/diagram.ts` returns imagePrompt/altText/labels but never imageBase64; DiagramStepView renders an icon, alt text, and labels. Every original grade sample uses this fallback. Fresh grades 4 and 5 still do.
- Fix in: GENERATOR / COMPONENT. A real structured visual renderer or image hydration is needed; hiding prose cannot supply the missing visual.

### AE-7 - Wrong quantity in a generated table
- Severity: HIGH
- Grade 3 original table headers are Bag Number / Apples Added / Cumulative Total. Second row is `2nd bag / 8 / 8`, although each bag adds 4. The claimed added amounts 4+8+4 do not produce the final total 12.
- Fix in: GENERATOR. Fresh grade 3 has no table, so that draw does not verify a fix.

The fresh grade 3 also repeats `3 times 4 -> 12` in two steps. This is residual SP-16 / AE-1; shorter solver prose reduces average bulk but does not enforce per-step ownership. Existing AE-1..AE-4 remain open.

## Verification

- 14/14 tests passed: new component navigation/inset/reset tests plus existing reader-fit authoring contract tests.
- Lumina typecheck: only two unrelated errors in `visual-primitives/math/baseTenScript.ts`, lines 267 and 295 (JudgedCueOptions missing opening/howToPlay); no changed-file errors.
- Browser unavailable: phone/tablet layout, text size, focus behavior, and real renderer clicks require visual acceptance. Automated tests mock the body renderer and verify the outer presentation contract, not pixel layout or every inner interaction.

## Content integrity fixes and retest - 2026-09-12

AE-5, AE-6, and AE-7 are resolved for the tested failure families. Browser visual acceptance remains open.

- **AE-5:** Challenger now reviews each optional prediction against the problem, inset, earlier steps, annotations, and earlier transformations. Exact disclosed answers are filtered in code; semantic review removes exposed, ambiguous, or invalid questions. Incomplete questions use a neutral title; future algebra transformations and the final result stay hidden until reached. Outer Next also waits for every transformation, preventing an early answer from skipping the rest of the work. Review failure omits the optional question.
- **AE-6:** New diagrams carry bounded structured data and render real SVG number lines, equal groups, fraction bars, or geometric drawings. Number-line jumps use integer tick counts; distances are derived in code and repeating fractions have exact fraction labels. Legacy image payloads remain supported.
- **AE-7:** Tables and diagrams receive an independent content review against the problem and assigned solved work. Rejected content gets one regeneration with feedback; a second rejection fails hydration instead of silently dropping a required step. Review metadata preserves the rejection and attempt count.
- **Repeated work:** Algebra generation is restricted to its assigned work. Identical adjacent algebra derivations are consolidated before predictions are placed, preserving grounding coverage and teaching notes. Different derivations with the same result remain distinct. This addresses the observed duplicate multiplication, not every historical AE-1..AE-4 failure.

### Final live campaign

Artifacts: `../annotated-example-presentation/fixes/closure/`. Ten full API sessions returned nonempty worked examples, with final values independently inspected:

| Grade | Problem family | Steps | Verified result |
|---|---|---|---|
| 2 | 24 + 13 | 2 | 37 |
| 3 | 3 groups of 4 | 2 | 12 |
| 4 | 1/2 in eighths | 2 | 4/8 |
| 5 | 0.4 + 0.3 | 2 | 0.7 |
| 2 | 45 - 12 | 2 | 33 |
| 3 | Equal groups, neighboring context | 2 | 12 |
| 4 | 2/3 in ninths | 2 | 6/9 |
| 5 | 0.6 + 0.2 | 2 | 0.8 |
| 7 | Solve 2x + 3 = 11 | 3 | x = 4 |
| 12 | Area between x and x² on [0,1] | 2 | 1/6 |

The elementary requests use representative topic prompts, so authored scenarios can vary (the neighboring buttons request became plates). The two final advanced controls explicitly pin their intent. These are focused controls, not a clearance of all advanced behavior.

Across these ten sessions: 12 structured diagrams, one table, seven algebra steps, and one graph sketch; nine optional questions retained and three removed as disclosed. One table required regeneration. Observed session latency was 31–100 seconds; the added review calls have a cost.

Forced generator probes passed **7/7**: equal-group, varying-increment, and function tables; groups, decimal number line, fraction bar, and right-triangle diagrams. The equal-group table reproduced the wrong-added-quantity family on its first attempt; review rejected it and the second attempt correctly added 4 each time, with totals 4/8/12. Calibration passed **9/9** expected decisions, including saved incorrect/corrected tables, incorrect/correct diagrams, novel/exposed predictions, and a false inverse-operation rationale.

### Automated verification and limits

- **243 tests pass across five files:** presentation, real renderer gates and SVG content, content-integrity regressions, reader-fit authoring, and the existing oracle suite. Unlike the original presentation-only check, the new tests exercise actual diagram and algebra renderers, including wrong-answer reveal and completion gating.
- Lumina typecheck still reports only the two unrelated `baseTenScript.ts` errors (267, 295), missing `opening`/`howToPlay`. No changed-file diagnostics.
- Browser surfaces are unavailable. Phone/tablet layout, focus behavior, and visual acceptance are still owed in `HUMAN-CHECKS.md`.
- Semantic review is probabilistic; bounded schemas and tick-derived geometry supply deterministic guarantees only for the properties they encode. These samples do not prove arbitrary generated content is correct.

Development evidence is preserved rather than counted as passing: the initial campaign had 7/10 successful hydrations; the intermediate `final/` directory records remote schema rejections and is **not** the accepted campaign. `shape-retest/` exposed inconsistent redundant labels, which were removed. `verified/` returned ten HTTP successes but inspection found rounded ninth jumps and an unpinned algebra wording/operation-rationale defect. Integer ticks and the prediction rationale rule address the corresponding math defects; general unpinned authoring drift remains a limit. `closure/` is the authoritative final campaign. Supporting calibration and shape rounds remain alongside it.
