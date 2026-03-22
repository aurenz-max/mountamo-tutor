# Eval Report: knowledge-check — 2026-03-21

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| recall    | PASS   | —      |
| apply     | PASS   | —      |
| analyze   | PASS   | —      |
| evaluate  | PASS   | —      |

All 4 modes pass across all 6 problem types.

## Problem Types Tested

| Problem Type | Modes Exercised | Data Shape | Content |
|--------------|----------------|------------|---------|
| `multiple_choice` | recall, apply, analyze, evaluate | ✓ matches component | Math/content correct, no answer leaks |
| `true_false` | recall, apply | ✓ matches component | Statement + boolean correct |
| `fill_in_blanks` | analyze, evaluate | ✓ matches component | textWithBlanks, blanks[], wordBank[] all valid |
| `matching_activity` | recall, apply | ✓ matches component | prompt, leftItems[], rightItems[], mappings[] verified |
| `sequencing_activity` | apply, analyze | ✓ matches component | instruction + items[] in correct logical order |
| `categorization_activity` | analyze, evaluate | ✓ matches component | instruction, categories[], categorizationItems[] valid |

## Fixes Applied

1. **Duplicate catalog entry** — `knowledge-check` was defined in both `core.ts` (tutoring scaffold only, no evalModes) and `assessment.ts` (evalModes only). Since `UNIVERSAL_CATALOG` spreads `CORE_CATALOG` first, `find()` returned the entry without evalModes. Fix: consolidated into `assessment.ts` with both tutoring scaffold and evalModes; removed duplicate from `core.ts`.

2. **Generator always defaulted to multiple_choice** — When `targetEvalMode` was set but no `problemType` specified (the eval-test case), `generateKnowledgeCheck` defaulted to `multiple_choice`. Fix: updated the knowledge-check generator registration in `coreGenerators.ts` to randomly select from the catalog's allowed `challengeTypes` for the active eval mode.

## Cognitive Complexity

Bloom's tier escalation confirmed across all modes:
- **Recall**: Direct fact retrieval ("What is the place value of X?")
- **Apply**: Procedural application ("Round and add to estimate")
- **Analyze**: Multi-step reasoning ("What happens when digits swap positions?")
- **Evaluate**: Judgment between approaches ("Which estimation strategy is best?")
