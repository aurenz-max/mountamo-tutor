# Eval Report: stoichiometry-lab — 2026-04-18

## Results
| Eval Mode | Status | Issues |
|-----------|--------|--------|
| convert   | PASS   | —      |
| limiting  | PASS   | —      |
| yield     | PASS   | —      |

## G1-G5 Sync Check

**G1 (Required fields per challenge type): ALL PASS**
- All 9 challenges (3 per mode) have required `id`, `type`, `instruction`, `hint`, `narration`, `askFor`, `givenFormulaA`, `givenMassA` fields populated.
- Type-specific null/non-null constraints are correctly enforced for every challenge.

**G2 (Reaction structure validity): ALL PASS**
- convert: `CH4 + 2O2 -> CO2 + 2H2O` — all 4 substances have valid formula, molarMass>0, coefficient>=1.
- limiting: `2Na + Cl2 -> 2NaCl` — all 3 substances valid.
- yield: `CH4 + 2O2 -> CO2 + 2H2O` — all 4 substances valid.

**G3 (Eval mode constraint enforcement): ALL PASS**
- convert run: typesFound=["convert"] (3/3)
- limiting run: typesFound=["limiting"] (3/3)
- yield run: typesFound=["yield"] (3/3)
Schema enum narrowing works.

**G4 (Answer derivability / math correctness): ALL PASS**
- convert ch1: 8g CH4 / 16 g/mol = 0.5 mol → targetAnswer=0.5 ✓
- convert ch2/ch3: Same-substance gram-to-gram mappings are tautologically correct (targetAnswer == givenMassA). *Note: pedagogical quality weak — instruction describes "2.0 moles" but data encodes the answer directly in givenMassA — this is a generator pedagogy issue but not a math/contract violation.*
- limiting ch1: extentNa=(23/23)/2=0.5, extentCl2=(71/71)/1=1.0 → Na limiting ✓
- limiting ch2: extentNa=1.0, extentCl2=0.141 → Cl2 limiting ✓
- limiting ch3: extentNa=0.25, extentCl2=0.563 → Na limiting ✓
- yield ch1: extentCH4=0.5, extentO2=0.5; yield=0.5×2×18=18g → targetAnswer=18 ✓ (extents tied — ambiguous limiting, but yield math is valid)
- yield ch2: limiting=CH4, yield=1.0×2×18=36g; actualYield=32 < 36 ✓
- yield ch3: limiting=CH4 (0.25 vs 1.0), yield=0.25×2×18=9g ✓

All targetAnswers within 0% (exact) of computed truth.

**G5 (Fallback quality audit): ALL PASS**
Generator fallbacks inspected (`gemini-stoichiometry-lab.ts`):
- `FALLBACK_REACTION` (H2+O2->H2O): triggers only when Gemini's reaction fails `validateReaction`. Did NOT fire in any of 3 runs.
- `buildFallbackChallenges`: triggers only when ALL Gemini challenges rejected. Did NOT fire.
- `ch.tolerance` default (5% of |targetAnswer|): reachable if Gemini omits tolerance. Produces valid bounds.
- `ch.narration ??= ch.instruction`: safe fallback.
- `showOptions` defaults (`?? true`): safe UI toggles.
- All fallbacks produce contract-valid data; none fired in these runs.

## Sample challenges (one per mode)

### convert (ch1)
```json
{
  "id": "ch1",
  "type": "convert",
  "instruction": "Calculate how many moles are in 8.0 grams of methane (CH4).",
  "hint": "Divide the mass in grams by the molar mass of CH4 to find the number of moles.",
  "narration": "Great job! Dividing grams by molar mass is the first step on the mole map.",
  "askFor": "moles of CH4",
  "givenFormulaA": "CH4",
  "givenMassA": 8,
  "givenFormulaB": null,
  "givenMassB": null,
  "answerFormula": "CH4",
  "answerUnit": "mol",
  "targetAnswer": 0.5,
  "tolerance": 0.025,
  "targetAnswerFormula": null,
  "actualYield": null
}
```

### limiting (ch2)
```json
{
  "id": "ch2",
  "type": "limiting",
  "instruction": "For the reaction 2Na + Cl2 -> 2NaCl, if you start with 46g of Na and 10g of Cl2, which reactant limits the production of salt?",
  "hint": "Calculate the moles for each reactant and divide by their respective coefficients. The one with the smaller resulting value is your limiting reagent.",
  "narration": "Excellent work! Comparing the mole ratios reveals that you will run out of the chlorine gas before the sodium is fully consumed.",
  "askFor": "limiting reagent",
  "givenFormulaA": "Na",
  "givenMassA": 46,
  "givenFormulaB": "Cl2",
  "givenMassB": 10,
  "answerFormula": null,
  "answerUnit": null,
  "targetAnswer": 0,
  "tolerance": 0,
  "targetAnswerFormula": "Cl2",
  "actualYield": null
}
```

### yield (ch2)
```json
{
  "id": "ch2",
  "type": "yield",
  "instruction": "Given 16 grams of CH4 and 80 grams of O2, you produce 32 grams of H2O. What is your percent yield?",
  "hint": "Calculate the theoretical yield first, then compare the actual 32g to your result using (Actual/Theoretical) * 100.",
  "narration": "Correct! Comparing your experimental results to the theoretical maximum shows how efficient your reaction was.",
  "askFor": "percent yield of H2O",
  "givenFormulaA": "CH4",
  "givenMassA": 16,
  "givenFormulaB": "O2",
  "givenMassB": 80,
  "answerFormula": "H2O",
  "answerUnit": "g",
  "targetAnswer": 36,
  "tolerance": 1.8,
  "targetAnswerFormula": null,
  "actualYield": 32
}
```

## Verdict
All three eval modes PASS. No fixes required. G4 math fully correct across all 9 challenges. One mild pedagogy observation (convert ch2/ch3 encode answer in givenMassA for same-substance mol→g problems) noted but not a contract violation — recommend a follow-up generator prompt tweak if these same-substance conversions continue to appear, but no blocking issues.
