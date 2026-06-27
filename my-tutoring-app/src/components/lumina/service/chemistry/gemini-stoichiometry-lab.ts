import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import type { GenerationContext } from "../generation/generationContext";
import type {
  StoichiometryLabData,
  StoichChallenge,
  StoichReaction,
  StoichSubstance,
} from "../../primitives/visual-primitives/chemistry/StoichiometryLab";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// Re-export type for convenience (no redefinition — sourced from the component)
export type { StoichiometryLabData };

// ---------------------------------------------------------------------------
// Per-challenge-type docs (used for prompt + schema description narrowing)
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  convert: {
    promptDoc:
      `"convert": Single mass-to-mole or mole-to-mass conversion. ` +
      `givenFormulaA + givenMassA (one given mass — formula must appear in reaction.reactants or reaction.products). ` +
      `givenFormulaB and givenMassB MUST be null. ` +
      `answerFormula = which substance to find (often the same as given, or a product via the mole ratio from coefficients). ` +
      `answerUnit = "g" or "mol". ` +
      `targetAnswer = the correct numerical answer (compute it precisely using grams ÷ molarMass → moles → × coefficient ratio → × molarMass if asking for grams). ` +
      `tolerance = 0.05 * |targetAnswer| (5%). ` +
      `targetAnswerFormula and actualYield MUST be null.`,
    schemaDescription: "'convert' (mass-mole conversion)",
  },
  limiting: {
    promptDoc:
      `"limiting": Limiting reagent identification from two given reactant masses. ` +
      `givenFormulaA + givenMassA + givenFormulaB + givenMassB (BOTH reactant masses; they MUST be two DIFFERENT formulas that both appear in reaction.reactants). ` +
      `targetAnswerFormula = the limiting reagent (must equal givenFormulaA or givenFormulaB). ` +
      `Compute moles ÷ coefficient for each reactant; the smaller value is the limiting reagent. ` +
      `CRITICAL: choose masses so the limiting reagent is UNAMBIGUOUS (at least a 20% gap in extents, not borderline). ` +
      `answerFormula, answerUnit, and actualYield MUST be null. ` +
      `targetAnswer MUST be 0 (unused). tolerance MUST be 0.`,
    schemaDescription: "'limiting' (limiting reagent identification)",
  },
  yield: {
    promptDoc:
      `"yield": Theoretical yield (or percent yield) calculation. ` +
      `givenFormulaA + givenMassA + givenFormulaB + givenMassB (BOTH reactant masses; two DIFFERENT formulas that both appear in reaction.reactants). ` +
      `answerFormula = which PRODUCT to compute yield for (must appear in reaction.products). ` +
      `answerUnit MUST be "g". ` +
      `targetAnswer = the THEORETICAL yield of answerFormula in grams, computed correctly from the limiting reagent ` +
      `(limitingExtent = min(moles_A / coeff_A, moles_B / coeff_B); yield_g = limitingExtent * product_coeff * product_molarMass). ` +
      `tolerance = 0.05 * targetAnswer. ` +
      `Optionally include actualYield (a realistic measured value strictly less than targetAnswer, typically 80-95% of theoretical) to turn this into a percent-yield question. ` +
      `targetAnswerFormula MUST be null.`,
    schemaDescription: "'yield' (theoretical / percent yield)",
  },
};

// ---------------------------------------------------------------------------
// Within-mode support tier (config.difficulty) — scaffolding level, NOT numbers
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/** STRICT lookup — the manifest enum-constrains config.difficulty to these.
 *  Unknown/absent → null (no tier applied; grade-band defaults stand). */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

// ---------------------------------------------------------------------------
// Support-tier scaffold — which on-screen / instructional helps are withdrawn
// per pinned challenge type. INVARIANT: a tier only removes scaffolding; it
// never touches a given mass, a coefficient, a molar mass, targetAnswer, or
// targetAnswerFormula (the post-validation block above owns every number).
//
// Levers (all display-/instruction-only — none are read by the check function):
//   showReactionOutput → the "Run the reaction" overlay that prints the computed
//                        limiting reagent + product yields (a direct self-check of
//                        the answer). easy/medium: shown; hard: withdrawn.
//   showMoleLadder     → the pre-computed grams→moles ladder (#1 perception / CPA).
//                        easy: shown; medium/hard: withdrawn (student does ÷molarMass).
//   showRatioStrip     → the mole-ratio strip derived from coefficients (#3 CPA).
//                        easy/medium: shown; hard: withdrawn (student reads the
//                        ratio off the balanced equation themselves).
//   nameStrategy       → whether the instruction names the governing step/relation
//                        (the mole-map step, or "limiting reagent = smallest
//                        moles÷coeff"). easy/medium: named; hard: withheld.
//   hintLevel          → 'formula' (explicit rule) at easy → 'concept' (nudge only)
//                        at medium/hard.
// The lever set is resolved PER CHALLENGE from each challenge's OWN type, so a
// blended/auto session gets difficulty too (difficulty is a student property).
// ---------------------------------------------------------------------------

interface StoichSupportScaffold {
  showReactionOutput: boolean;
  showMoleLadder: boolean;
  showRatioStrip: boolean;
  nameStrategy: boolean;
  hintLevel: 'formula' | 'concept';
  promptLines: string[];
}

// ---------------------------------------------------------------------------
// TIER_GUARDRAIL — the one hard rule for BOTH within-mode axes.
// (Renamed from the scaffolding skill's "numbers never change" — that line is
//  now false: this generator ALSO carries a structural difficulty axis that
//  re-selects answer-bearing values.)
//
// A tier changes the problem's STRUCTURE, never its MAGNITUDE, and never its
// eval mode (the eval mode = the task identity = convert | limiting | yield):
//   - convert: # of mole-map steps engaged (same-substance unit conversion →
//              cross-substance 1:1 ratio → cross-substance NON-1:1 ratio).
//              Still ONE given mass, one conversion — never becomes limiting/yield.
//   - limiting: the extent-gap subtlety |extentA−extentB| (wide & obvious →
//               near-borderline but STILL unambiguous). The gap NEVER drops below
//               the mode's unambiguity floor (that would make the mode unsolvable).
//   - yield: whether the percent-yield step is engaged (theoretical only →
//            theoretical + actual÷theoretical×100), riding the same limiting gap.
// Magnitude (grade-band mass range, molar masses, coefficients of the reaction)
// is owned by the eval mode + grade scope; the tier never pushes past it. The
// student's answer is RECOMPUTED from whatever values the code finally lands.
// ---------------------------------------------------------------------------
const TIER_GUARDRAIL =
  'Structural difficulty changes the problem SHAPE (mole-map steps engaged, '
  + 'extent-gap subtlety, percent-yield step), never the MAGNITUDE (mass range, '
  + 'molar masses, coefficients) and never the eval mode (convert | limiting | yield).';

// ---------------------------------------------------------------------------
// Structural difficulty (2nd axis) — config.difficulty drives a harder PROBLEM
// SHAPE, not less help. Rides the same tier enum as the scaffolding axis.
//
// Per-mode lever (easy → hard):
//   convert  · mole-map steps: 'same' (g↔mol of ONE substance, no ratio) →
//              'ratio1to1' (cross-substance, coeffA==coeffB) →
//              'ratioNonUnity' (cross-substance, coeffA!=coeffB — the ratio step bites)
//              FLOOR: one given mass, one conversion (never limiting/yield).
//              CAP: substances/coefficients of THIS reaction (no magnitude inflation).
//   limiting · gapTarget: the fractional extent gap |eA−eB|/max(eA,eB) to engineer.
//              easy 0.55 (obvious) → medium 0.35 → hard 0.20 (tight, still unambiguous).
//              FLOOR: 0.18 (catalog requires ≥~20% / post-validation rejects <0.15;
//              never go borderline-undecidable). CAP: 0.85 (a wider gap is just a
//              different obvious problem, not magnitude).
//   yield    · percentYield: false (theoretical only) → true (extra actual÷theo×100
//              step) at hard; rides the same limiting gapTarget (easy 0.50 wide →
//              hard 0.22 tight). FLOOR: theoretical yield always computed. CAP: same gap cap.
// ---------------------------------------------------------------------------

const LIMITING_GAP_FLOOR = 0.18;
const LIMITING_GAP_CAP = 0.85;

type ConvertSteps = 'same' | 'ratio1to1' | 'ratioNonUnity';

interface StoichProblemShape {
  /** convert only: how many mole-map steps the conversion engages. */
  convertSteps: ConvertSteps;
  /** limiting/yield only: target fractional extent gap, clamped to [floor, cap]. */
  gapTarget: number;
  /** yield only: engage the percent-yield step (requires actualYield). */
  percentYield: boolean;
  promptLines: string[];
}

const clampGap = (g: number): number =>
  Math.min(LIMITING_GAP_CAP, Math.max(LIMITING_GAP_FLOOR, g));

/**
 * Turn one tier into one structural intent per mode. Clamped to [floor, cap]
 * internally so the returned target already respects the mode's floor and the
 * magnitude ceiling. Both the prompt (describe) and the post-process (enforce)
 * consume THIS function, so they can never disagree about what "hard" means.
 */
function resolveProblemShape(
  pinnedType: string,
  tier: SupportTier,
): StoichProblemShape {
  if (pinnedType === 'convert') {
    const convertSteps: ConvertSteps =
      tier === 'easy' ? 'same' : tier === 'medium' ? 'ratio1to1' : 'ratioNonUnity';
    const desc: Record<ConvertSteps, string> = {
      same:
        'a SAME-SUBSTANCE conversion: convert a given mass of one substance to moles '
        + '(or moles back to grams) of the SAME substance — molar mass only, NO mole-ratio step.',
      ratio1to1:
        'a CROSS-SUBSTANCE conversion where the two coefficients are EQUAL (a 1:1 mole ratio) — '
        + 'grams of A → moles of A → moles of B → grams/moles of B, but the ratio step is the trivial 1:1.',
      ratioNonUnity:
        'a CROSS-SUBSTANCE conversion where the two coefficients DIFFER (a non-1:1 mole ratio, e.g. 2:1 or 3:2) — '
        + 'the student MUST apply the coefficient ratio; skipping it gives a wrong answer.',
    };
    return {
      convertSteps,
      gapTarget: 0,
      percentYield: false,
      promptLines: [
        `Structural shape (HARDER PROBLEM, not less help): make every "convert" challenge ${desc[convertSteps]}`,
        'Keep it a SINGLE conversion with ONE given mass — never two givens, never a limiting-reagent question.',
      ],
    };
  }
  if (pinnedType === 'limiting') {
    const gapTarget = clampGap(tier === 'easy' ? 0.55 : tier === 'medium' ? 0.35 : 0.20);
    return {
      convertSteps: 'same',
      gapTarget,
      percentYield: false,
      promptLines: [
        `Structural shape: engineer the two given masses so the limiting reagent is ${
          tier === 'easy'
            ? 'OBVIOUS — one reactant runs out well before the other (a wide extent gap)'
            : tier === 'medium'
              ? 'clear but NOT lopsided — a moderate extent gap that takes real mole math to settle'
              : 'TIGHT — the two reactants are close, so only careful moles÷coefficient math (NOT comparing masses) reveals which runs out first'
        }.`,
        `Aim for roughly a ${Math.round(gapTarget * 100)}% gap between the two extents (moles÷coefficient), but keep it UNAMBIGUOUS — never a tie.`,
      ],
    };
  }
  // yield
  const gapTarget = clampGap(tier === 'easy' ? 0.50 : tier === 'medium' ? 0.32 : 0.22);
  const percentYield = tier === 'hard';
  return {
    convertSteps: 'same',
    gapTarget,
    percentYield,
    promptLines: [
      `Structural shape: ${
        percentYield
          ? 'this is a PERCENT-YIELD problem — include a realistic actualYield (80–95% of theoretical) so the student must compute theoretical yield AND then actual÷theoretical×100'
          : 'this is a THEORETICAL-yield-only problem — do NOT include actualYield (no percent-yield step)'
      }.`,
      `Engineer the two given masses for a ${
        tier === 'hard' ? 'TIGHT' : tier === 'medium' ? 'moderate' : 'wide'
      } extent gap (~${Math.round(gapTarget * 100)}%) so finding the limiting reagent takes real mole math, but keep it unambiguous.`,
    ],
  };
}

function resolveSupportStructure(
  pinnedType: string,
  tier: SupportTier,
): StoichSupportScaffold {
  const lead =
    'This tier changes only how much on-screen / instructional help the student gets. '
    + 'It NEVER changes the reaction, the given masses, the molar masses, or the answer.';

  // Self-check overlay: the "Run the reaction" panel literally prints the limiting
  // reagent and product yields — it is the single strongest self-check. Withdrawn
  // only at hard so a strong student computes unaided.
  const showReactionOutput = tier !== 'hard';
  // The grams→moles ladder pre-computes moles for the given mass — a perception/CPA
  // aid. Kept at easy (the struggling student leans on it), withdrawn from medium up.
  const showMoleLadder = tier === 'easy';
  // The mole-ratio strip restates the coefficients as a ratio — withdrawn at hard,
  // where the student reads the ratio directly off the balanced equation.
  const showRatioStrip = tier !== 'hard';
  // Instruction-as-scaffold: name the governing step at easy/medium; withhold at hard.
  const nameStrategy = tier !== 'hard';
  const hintLevel: 'formula' | 'concept' = tier === 'easy' ? 'formula' : 'concept';

  const strategyName =
    pinnedType === 'limiting'
      ? 'that the limiting reagent is the reactant with the smallest moles ÷ coefficient'
      : pinnedType === 'yield'
        ? 'the mole-map route through the limiting reagent (grams → moles → ratio → grams of product)'
        : 'the mole-map route (grams → moles → ratio → moles → grams)';

  return {
    showReactionOutput,
    showMoleLadder,
    showRatioStrip,
    nameStrategy,
    hintLevel,
    promptLines: [
      lead,
      `The "Run the reaction" self-check overlay (computed limiting reagent + product yields) is ${showReactionOutput ? 'available to the student' : 'WITHDRAWN — the student must reach the result without the worked output'}.`,
      `The pre-computed grams→moles ladder is ${showMoleLadder ? 'shown' : 'withdrawn — the student converts mass to moles themselves'}; the mole-ratio strip is ${showRatioStrip ? 'shown' : 'withdrawn — the student reads the ratio off the balanced equation'}.`,
      `The instruction ${nameStrategy ? `NAMES the strategy (${strategyName})` : 'does NOT name the strategy — the student must decide how to attack the problem from the equation and givens'}.`,
      `The hint is ${hintLevel === 'formula' ? 'an explicit formula/rule for the next step' : 'a conceptual nudge only — no formula, no plugged-in numbers'}.`,
      'Keep the title and description neutral — never state the support level, and never state the limiting reagent or the numeric answer.',
    ],
  };
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const substanceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    formula: {
      type: Type.STRING,
      description: "Chemical formula (e.g. 'H2', 'O2', 'H2O', 'CH4', 'Fe2O3')",
    },
    molarMass: {
      type: Type.NUMBER,
      description:
        "Molar mass in g/mol. MUST be > 0 and computed correctly from atomic masses " +
        "(H=1, C=12, N=14, O=16, Na=23, Mg=24, Al=27, S=32, Cl=35.5, K=39, Ca=40, Fe=56, Cu=63.5, Zn=65).",
    },
    coefficient: {
      type: Type.NUMBER,
      description:
        "Stoichiometric coefficient in the balanced equation. Integer >= 1.",
    },
  },
  required: ["formula", "molarMass", "coefficient"],
};

const stoichiometryLabSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short engaging title for the activity (e.g. 'Stoichiometry of Combustion').",
    },
    description: {
      type: Type.STRING,
      description: "One-sentence activity description in grade-appropriate language.",
    },
    gradeBand: {
      type: Type.STRING,
      enum: ["8", "9-10", "11-12"],
      description: "Target grade band.",
    },
    reaction: {
      type: Type.OBJECT,
      description:
        "The balanced chemical reaction for this activity. All challenges refer to this single reaction.",
      properties: {
        equation: {
          type: Type.STRING,
          description:
            "Balanced equation as a string (e.g. '2H2 + O2 -> 2H2O'). Must match coefficients in reactants/products.",
        },
        reactants: {
          type: Type.ARRAY,
          description: "Array of reactant substances with formula, molarMass, and coefficient. Non-empty.",
          items: substanceSchema,
        },
        products: {
          type: Type.ARRAY,
          description: "Array of product substances with formula, molarMass, and coefficient. Non-empty.",
          items: substanceSchema,
        },
      },
      required: ["equation", "reactants", "products"],
    },
    challenges: {
      type: Type.ARRAY,
      description:
        "3-5 challenges. When an eval mode is targeted, all challenges must share the SAME challenge type.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge id (e.g. 'ch1', 'ch2').",
          },
          type: {
            type: Type.STRING,
            enum: ["convert", "limiting", "yield"],
            description:
              "Challenge type: 'convert' (mass-mole conversion), 'limiting' (limiting reagent ID), 'yield' (theoretical/percent yield)",
          },
          instruction: {
            type: Type.STRING,
            description: "Grade-appropriate instruction telling the student what to do.",
          },
          hint: {
            type: Type.STRING,
            description: "Scaffolding hint that nudges without revealing the answer.",
          },
          narration: {
            type: Type.STRING,
            description:
              "Short celebratory reinforcement to display when the student answers correctly. Reinforces the mole-map reasoning.",
          },
          askFor: {
            type: Type.STRING,
            description:
              "A short phrase naming what the student must find (e.g. 'grams of H2O produced', 'limiting reagent', 'percent yield').",
          },
          givenFormulaA: {
            type: Type.STRING,
            description:
              "Formula of the given reactant/product (MUST appear in reaction.reactants or reaction.products).",
          },
          givenMassA: {
            type: Type.NUMBER,
            description: "Mass in grams of givenFormulaA. Must be > 0.",
          },
          givenFormulaB: {
            type: Type.STRING,
            description:
              "Formula of the second given reactant. REQUIRED for 'limiting' and 'yield' (must differ from givenFormulaA, both in reaction.reactants). MUST be null for 'convert'.",
            nullable: true,
          },
          givenMassB: {
            type: Type.NUMBER,
            description:
              "Mass in grams of givenFormulaB (> 0). REQUIRED for 'limiting' and 'yield'. MUST be null for 'convert'.",
            nullable: true,
          },
          answerFormula: {
            type: Type.STRING,
            description:
              "Formula the numeric answer refers to. REQUIRED for 'convert' (anything in the reaction) and 'yield' (a product). MUST be null for 'limiting'.",
            nullable: true,
          },
          answerUnit: {
            type: Type.STRING,
            enum: ["g", "mol"],
            description:
              "Unit of the numeric answer. 'g' or 'mol' for 'convert'. MUST be 'g' for 'yield'. MUST be null for 'limiting'.",
            nullable: true,
          },
          targetAnswer: {
            type: Type.NUMBER,
            description:
              "Correct numeric answer (grams or moles). For 'limiting', set to 0 (unused). For 'convert'/'yield', compute precisely from the given masses, coefficients, and molar masses.",
          },
          tolerance: {
            type: Type.NUMBER,
            description:
              "Acceptable +/- range on the numeric answer (about 5% of |targetAnswer|). For 'limiting', set to 0.",
          },
          targetAnswerFormula: {
            type: Type.STRING,
            description:
              "For 'limiting': the limiting reagent formula (must equal givenFormulaA or givenFormulaB). MUST be null for 'convert' and 'yield'.",
            nullable: true,
          },
          actualYield: {
            type: Type.NUMBER,
            description:
              "OPTIONAL, only for 'yield' challenges. If present, the student computes percent yield (actualYield / targetAnswer * 100). Must be > 0 and < targetAnswer (typically 80-95% of targetAnswer). MUST be null otherwise.",
            nullable: true,
          },
        },
        required: [
          "id",
          "type",
          "instruction",
          "hint",
          "narration",
          "askFor",
          "givenFormulaA",
          "givenMassA",
          "givenFormulaB",
          "givenMassB",
          "answerFormula",
          "answerUnit",
          "targetAnswer",
          "tolerance",
          "targetAnswerFormula",
          "actualYield",
        ],
      },
    },
    showOptions: {
      type: Type.OBJECT,
      description: "UI panel toggles.",
      properties: {
        showMoleLadder: {
          type: Type.BOOLEAN,
          description: "Show the grams↔moles ladder visual for each given reactant.",
        },
        showLeftovers: {
          type: Type.BOOLEAN,
          description: "Show leftover (excess) reactant amounts after the reaction runs.",
        },
        showRatioStrip: {
          type: Type.BOOLEAN,
          description: "Show the mole-ratio strip derived from coefficients.",
        },
        showPercentYield: {
          type: Type.BOOLEAN,
          description: "Show percent yield tools (grade 11-12 only).",
        },
        showReactionOutput: {
          type: Type.BOOLEAN,
          description: "Show the 'Run the reaction' output panel (computed limiting reagent, product yields, leftovers). Default true.",
        },
      },
      required: ["showMoleLadder", "showLeftovers", "showRatioStrip", "showPercentYield", "showReactionOutput"],
    },
  },
  required: [
    "title",
    "description",
    "gradeBand",
    "reaction",
    "challenges",
    "showOptions",
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type GradeBand = "8" | "9-10" | "11-12";

const resolveGradeBand = (gradeLevel: string): GradeBand => {
  const gl = (gradeLevel || "").toLowerCase();
  if (
    gl.includes("11") ||
    gl.includes("12") ||
    gl.includes("11-12") ||
    gl.includes("high school") ||
    gl.includes("advanced")
  ) {
    return "11-12";
  }
  if (gl.includes("9") || gl.includes("10") || gl.includes("9-10")) {
    return "9-10";
  }
  if (gl.includes("8") || gl.includes("grade 8")) {
    return "8";
  }
  return "9-10";
};

const GRADE_BAND_GUIDANCE: Record<GradeBand, string> = {
  "8":
    "Grade 8 stoichiometry introduction. Use a SIMPLE synthesis reaction such as " +
    "2H2 + O2 -> 2H2O, N2 + 3H2 -> 2NH3, 2Mg + O2 -> 2MgO, or Zn + 2HCl -> ZnCl2 + H2. " +
    "Focus primarily on 'convert' challenges (single mass-mole conversion). Use simple masses (2-20 g) " +
    "that give whole-ish mole numbers. Vocabulary: 'molar mass', 'moles', 'ratio'. Avoid hydrocarbons and complex combustion.",
  "9-10":
    "Grades 9-10. Use common reactions such as CH4 + 2O2 -> CO2 + 2H2O, Fe + CuSO4 -> FeSO4 + Cu, " +
    "2H2 + O2 -> 2H2O, or 2Na + Cl2 -> 2NaCl. Mix 'convert' and 'limiting' challenges (or match the eval mode). " +
    "Use masses in the 5-50 g range. Vocabulary: 'limiting reagent', 'excess', 'theoretical yield'.",
  "11-12":
    "Grades 11-12. Use more demanding balanced equations such as 4Al + 3O2 -> 2Al2O3, " +
    "2C2H6 + 7O2 -> 4CO2 + 6H2O, or 3Cu + 8HNO3 -> 3Cu(NO3)2 + 2NO + 4H2O. " +
    "Emphasize 'limiting' and 'yield' challenges, including percent-yield problems via actualYield. " +
    "Use masses in the 10-200 g range. Vocabulary: 'stoichiometric coefficients', 'percent yield', 'theoretical yield'.",
};

const FALLBACK_REACTION: StoichReaction = {
  equation: "2H2 + O2 -> 2H2O",
  reactants: [
    { formula: "H2", molarMass: 2, coefficient: 2 },
    { formula: "O2", molarMass: 32, coefficient: 1 },
  ],
  products: [
    { formula: "H2O", molarMass: 18, coefficient: 2 },
  ],
};

/** Build a fallback challenge set (one per type, all mathematically correct). */
function buildFallbackChallenges(allowedTypes: string[] | null): StoichChallenge[] {
  const allChallenges: Record<string, StoichChallenge> = {
    convert: {
      id: "ch-convert",
      type: "convert",
      instruction:
        "How many grams of water (H2O) are produced from 4 g of hydrogen (H2) reacting with excess oxygen?",
      hint: "Convert grams of H2 to moles using its molar mass, then use the 2:2 mole ratio to H2O, then multiply by H2O's molar mass.",
      narration: "Exactly — 4 g H2 is 2 mol H2, which makes 2 mol H2O = 36 g H2O.",
      askFor: "grams of H2O produced",
      givenFormulaA: "H2",
      givenMassA: 4,
      givenFormulaB: null,
      givenMassB: null,
      answerFormula: "H2O",
      answerUnit: "g",
      targetAnswer: 36,
      tolerance: 1.8,
      targetAnswerFormula: null,
      actualYield: null,
    },
    limiting: {
      id: "ch-limiting",
      type: "limiting",
      instruction:
        "You combine 4 g of H2 with 16 g of O2. Which reactant is the limiting reagent?",
      hint: "Compute moles ÷ coefficient for each reactant. The smaller result is the limiting reagent.",
      narration:
        "H2: 4÷2 = 2 mol, ÷2 = 1.0. O2: 16÷32 = 0.5 mol, ÷1 = 0.5. O2 runs out first — it's limiting.",
      askFor: "limiting reagent",
      givenFormulaA: "H2",
      givenMassA: 4,
      givenFormulaB: "O2",
      givenMassB: 16,
      answerFormula: null,
      answerUnit: null,
      targetAnswer: 0,
      tolerance: 0,
      targetAnswerFormula: "O2",
      actualYield: null,
    },
    yield: {
      id: "ch-yield",
      type: "yield",
      instruction:
        "Starting with 4 g H2 and 16 g O2, what is the theoretical yield of H2O in grams?",
      hint: "Find the limiting reagent's extent (moles ÷ coefficient), then multiply by H2O's coefficient and molar mass.",
      narration:
        "O2 is limiting at 0.5 extent. H2O yield = 0.5 × 2 × 18 = 18 g.",
      askFor: "grams of H2O (theoretical yield)",
      givenFormulaA: "H2",
      givenMassA: 4,
      givenFormulaB: "O2",
      givenMassB: 16,
      answerFormula: "H2O",
      answerUnit: "g",
      targetAnswer: 18,
      tolerance: 0.9,
      targetAnswerFormula: null,
      actualYield: null,
    },
  };

  if (allowedTypes && allowedTypes.length > 0) {
    return allowedTypes
      .filter((t) => allChallenges[t])
      .map((t) => allChallenges[t]);
  }
  return [allChallenges.convert, allChallenges.limiting, allChallenges.yield];
}

/** Validate the reaction has non-empty, well-formed reactant and product arrays. */
function validateReaction(reaction: unknown): reaction is StoichReaction {
  if (!reaction || typeof reaction !== "object") return false;
  const r = reaction as Record<string, unknown>;
  if (!r.equation || typeof r.equation !== "string" || r.equation.trim() === "") return false;
  const reactants = r.reactants as StoichSubstance[] | undefined;
  const products = r.products as StoichSubstance[] | undefined;
  if (!Array.isArray(reactants) || reactants.length === 0) return false;
  if (!Array.isArray(products) || products.length === 0) return false;

  const checkSubstance = (s: unknown): boolean => {
    if (!s || typeof s !== "object") return false;
    const o = s as Record<string, unknown>;
    if (typeof o.formula !== "string" || o.formula.trim() === "") return false;
    if (typeof o.molarMass !== "number" || !Number.isFinite(o.molarMass) || o.molarMass <= 0) return false;
    if (typeof o.coefficient !== "number" || !Number.isFinite(o.coefficient) || o.coefficient < 1) return false;
    return true;
  };

  return reactants.every(checkSubstance) && products.every(checkSubstance);
}

// ---------------------------------------------------------------------------
// Instruction / hint rewrites for the hard + medium support tiers.
// These withhold the NAMED strategy / explicit formula only — they never restate
// or alter any given mass, coefficient, or answer. `askFor` still tells the
// student WHAT to find (the task identity); the rewrite only removes HOW-help.
// ---------------------------------------------------------------------------

/** Hard tier: an instruction that states the task (what to find) but does NOT name
 *  the governing strategy — the student decides how to attack it from the figure. */
function neutralizeStrategy(ch: StoichChallenge): string {
  const A = ch.givenFormulaA;
  const B = ch.givenFormulaB;
  switch (ch.type) {
    case 'limiting':
      return `You start with ${ch.givenMassA} g of ${A} and ${ch.givenMassB ?? '?'} g of ${B}. `
        + `Using the balanced equation, work out the amount of each and decide which reactant the products depend on. `
        + `Find the ${ch.askFor}.`;
    case 'yield':
      return `You start with ${ch.givenMassA} g of ${A} and ${ch.givenMassB ?? '?'} g of ${B}. `
        + `Use the balanced equation to find the ${ch.askFor}.`;
    default: // convert
      return `You are given ${ch.givenMassA} g of ${A}. `
        + `Use the balanced equation to find the ${ch.askFor}.`;
  }
}

/** Conceptual hint (no formula, no plugged-in numbers). `named` = the instruction
 *  still names the strategy (medium tier); otherwise point the student to read the
 *  equation first (hard tier). Never reveals the answer. */
function conceptHint(ch: StoichChallenge, named: boolean): string {
  if (named) {
    switch (ch.type) {
      case 'limiting':
        return 'You know the rule — now do the mole math for each reactant and compare.';
      case 'yield':
        return 'Work from the limiting reagent you found, then carry its amount through to the product.';
      default:
        return 'Take it one step of the mole-map at a time, then finish the conversion.';
    }
  }
  switch (ch.type) {
    case 'limiting':
      return 'Start by turning each given mass into a count of particles, then account for how many of each the equation needs.';
    case 'yield':
      return 'Decide first which reactant caps the reaction, then follow that amount through to the product.';
    default:
      return 'Think about how mass, particle count, and the equation\'s ratio connect before you compute.';
  }
}

// ---------------------------------------------------------------------------
// Structural-difficulty post-process helpers (count → honor → reconstruct).
// These re-select ANSWER-BEARING values, so each closes the loop on the answer.
// ---------------------------------------------------------------------------

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Fractional extent gap between two reactants (the limiting-mode lever). */
function extentGap(extentA: number, extentB: number): number {
  const hi = Math.max(extentA, extentB);
  if (hi <= 0) return 0;
  return Math.abs(extentA - extentB) / hi;
}

/** Classify a convert challenge's actual mole-map shape against the reaction. */
function countConvertSteps(
  ch: StoichChallenge,
  reaction: StoichReaction,
): ConvertSteps | null {
  if (!ch.answerFormula) return null;
  if (ch.answerFormula === ch.givenFormulaA) return 'same';
  const all = [...reaction.reactants, ...reaction.products];
  const subGiven = all.find((s) => s.formula === ch.givenFormulaA);
  const subAns = all.find((s) => s.formula === ch.answerFormula);
  if (!subGiven || !subAns) return null;
  return subGiven.coefficient === subAns.coefficient ? 'ratio1to1' : 'ratioNonUnity';
}

/** Pick an answer substance for a convert challenge that realizes the target shape.
 *  Returns the chosen answerFormula, or null if the reaction can't support the shape
 *  (caller then SATURATES to the best available shape). */
function pickConvertAnswerFormula(
  givenFormula: string,
  target: ConvertSteps,
  reaction: StoichReaction,
): string | null {
  const all = [...reaction.reactants, ...reaction.products];
  const given = all.find((s) => s.formula === givenFormula);
  if (!given) return null;
  if (target === 'same') return givenFormula;
  // cross-substance candidates (anything but the given formula)
  const others = all.filter((s) => s.formula !== givenFormula);
  if (target === 'ratio1to1') {
    const eq = others.find((s) => s.coefficient === given.coefficient);
    return eq ? eq.formula : null;
  }
  // ratioNonUnity
  const neq = others.find((s) => s.coefficient !== given.coefficient);
  return neq ? neq.formula : null;
}

/** Recompute a convert challenge's targetAnswer from grams→moles→ratio→(grams|moles). */
function computeConvertAnswer(
  givenMass: number,
  givenSub: StoichSubstance,
  ansSub: StoichSubstance,
  unit: 'g' | 'mol',
): number {
  const molesGiven = givenMass / givenSub.molarMass;
  const molesAns = molesGiven * (ansSub.coefficient / givenSub.coefficient);
  return unit === 'g' ? molesAns * ansSub.molarMass : molesAns;
}

/**
 * Re-select givenMassB so the extent gap hits gapTarget while keeping the SAME
 * limiting reagent the LLM intended (preserves the question's narrative) and
 * staying inside the grade-band mass window. Returns the new givenMassB (>0).
 *
 * We hold givenMassA / extentA fixed and solve for the B-mass that yields the
 * target gap. To keep A limiting: extentB = extentA / (1 - gap). To keep B
 * limiting: extentB = extentA * (1 - gap). massB = extentB * coeffB * molarMassB.
 */
function reselectMassBForGap(
  extentA: number,
  subB: StoichSubstance,
  gapTarget: number,
  keepALimiting: boolean,
  massWindow: { min: number; max: number },
): number {
  const g = clampGap(gapTarget);
  const extentB = keepALimiting ? extentA / (1 - g) : extentA * (1 - g);
  let massB = extentB * subB.coefficient * subB.molarMass;
  // Clamp into the grade-band window WITHOUT breaking the gap: if clamping the
  // mass would change the gap, we accept the in-window mass (band cap wins —
  // magnitude is owned by the band) and let the post-validation gap-floor stand.
  massB = Math.min(massWindow.max, Math.max(massWindow.min, massB));
  return round2(massB);
}

/** Grade-band mass window (matches GRADE_BAND_GUIDANCE prose). */
const MASS_WINDOW: Record<GradeBand, { min: number; max: number }> = {
  '8': { min: 2, max: 20 },
  '9-10': { min: 5, max: 50 },
  '11-12': { min: 10, max: 200 },
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate Stoichiometry Lab data using Gemini.
 *
 * Creates an interactive stoichiometry activity covering mole conversions,
 * limiting reagent identification, and theoretical/percent yield. Because
 * Gemini frequently miscomputes stoichiometry, targetAnswer for 'yield' and
 * targetAnswerFormula for 'limiting' are RECOMPUTED from the reaction data.
 */
type StoichiometryLabConfig = Partial<{
    targetEvalMode?: string;
    intent?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis: difficulty = how much scaffolding within the mode. NEVER changes
     * numbers — only withdraws on-screen overlays and instruction/hint explicitness.
     */
    difficulty?: string;
}>;

export const generateStoichiometryLab = async (
  ctx: GenerationContext,
): Promise<StoichiometryLabData> => {
  const { topic } = ctx;
  const gradeLevel = ctx.gradeContext;
  const config: StoichiometryLabConfig = { ...(ctx.raw as StoichiometryLabConfig), intent: ctx.intent };
  const gradeBand = resolveGradeBand(gradeLevel);

  // Resolve eval mode constraint and narrow schema
  const constraint = resolveEvalModeConstraint(
    'stoichiometry-lab',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // Within-mode support tier (scaffolding level — NOT number size). pinnedType
  // drives prompt TONE only (a single pinned mode); the application below runs
  // PER CHALLENGE off each challenge's own type so blended sessions get it too.
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType =
    constraint && constraint.allowedTypes.length === 1
      ? constraint.allowedTypes[0]
      : undefined;
  const tierScaffold = pinnedType && supportTier
    ? resolveSupportStructure(pinnedType, supportTier)
    : null;
  // Axis 2: structural shape. The tier ENUM (not a baked string) reaches both
  // the prompt (describe the harder shape) here and the post-process (enforce
  // it) below — buildTierPromptSection merges both axes into one coherent block.
  const tierShape = pinnedType && supportTier
    ? resolveProblemShape(pinnedType, supportTier)
    : null;
  const tierSection = (tierScaffold || tierShape)
    ? `\n## WITHIN-MODE DIFFICULTY TIER (config.difficulty = "${supportTier}")\n`
      + `${TIER_GUARDRAIL}\n`
      + [
          ...(tierShape ? tierShape.promptLines : []),
          ...(tierScaffold ? tierScaffold.promptLines : []),
        ].map((l) => `- ${l}`).join('\n')
      + '\n'
    : '';
  const constrainedSchema = constraint
    ? constrainChallengeTypeEnum(
        stoichiometryLabSchema,
        constraint.allowedTypes,
        CHALLENGE_TYPE_DOCS,
      )
    : stoichiometryLabSchema;

  const challengeTypePromptSection = buildChallengeTypePromptSection(
    constraint,
    CHALLENGE_TYPE_DOCS,
  );

  logEvalModeResolution('stoichiometry-lab', config?.targetEvalMode, constraint);

  const intentHint = config?.intent ? `\nInstructor intent: ${config.intent}` : "";

  const generationPrompt = `Create a Stoichiometry Lab activity about "${topic}" for grade band ${gradeBand} students.${intentHint}

GRADE BAND GUIDANCE:
${GRADE_BAND_GUIDANCE[gradeBand]}

${challengeTypePromptSection}
${tierSection}
REACTION REQUIREMENTS:
1. Provide a SINGLE balanced chemical reaction that all challenges reference.
2. The "equation" string must show the balanced form with coefficients (e.g. "2H2 + O2 -> 2H2O").
3. "reactants" and "products" arrays MUST be non-empty and each substance MUST include:
   - formula (matches the equation)
   - molarMass (positive number in g/mol, computed correctly from atomic masses)
   - coefficient (integer >= 1 — matches the balanced equation)
4. Use accurate atomic masses: H=1, C=12, N=14, O=16, Na=23, Mg=24, Al=27, S=32, Cl=35.5, K=39, Ca=40, Fe=56, Cu=63.5, Zn=65.
   Example compound molar masses: H2=2, O2=32, H2O=18, CO2=44, CH4=16, NH3=17, NaCl=58.5, Fe2O3=160, Al2O3=102.

CHALLENGE REQUIREMENTS (produce 3-5):
1. Each challenge's "id" must be unique ("ch1", "ch2", …).
2. "instruction" is grade-appropriate and clear. "hint" scaffolds the next step without giving the answer. "narration" reinforces the mole-map when correct.
3. "askFor" is a short phrase naming the target (e.g. "grams of CO2 produced").
4. For EVERY challenge, "givenFormulaA" MUST match a formula that appears in reaction.reactants or reaction.products, and "givenMassA" MUST be > 0.
5. Fill the mode-specific fields strictly:
   - type="convert": givenFormulaB=null, givenMassB=null, targetAnswerFormula=null, actualYield=null. Set answerFormula, answerUnit ("g" or "mol"), targetAnswer (correct value), and tolerance (~5% of |targetAnswer|).
   - type="limiting": set givenFormulaB (DIFFERENT reactant from reaction.reactants) and givenMassB (> 0). Set targetAnswerFormula to the limiting reagent (the one whose moles÷coefficient is smaller; MUST equal givenFormulaA or givenFormulaB). Set answerFormula=null, answerUnit=null, actualYield=null, targetAnswer=0, tolerance=0. Choose masses so the limiting reagent is UNAMBIGUOUS (at least 20% gap in extents).
   - type="yield": set givenFormulaB, givenMassB, answerFormula (a product formula), answerUnit="g". Compute targetAnswer as the THEORETICAL yield in grams of answerFormula from the limiting reagent (yield = min(moles_A/coeff_A, moles_B/coeff_B) * product_coeff * product_molarMass). Set tolerance ≈ 5% of targetAnswer. Set targetAnswerFormula=null. Optionally include actualYield < targetAnswer for a percent-yield variant.
6. If an eval mode is targeted, ALL challenges MUST share the same challenge type (the schema enum will reject other values).

SHOW OPTIONS:
- showMoleLadder: true (always helpful)
- showLeftovers: true for limiting/yield; true is safe for convert too
- showRatioStrip: true
- showPercentYield: true for grade 11-12, false otherwise

DOUBLE-CHECK:
- Verify each targetAnswer numerically: grams ÷ molarMass → moles → × (product_coeff / reactant_coeff) → × product_molarMass for grams of product.
- Verify the limiting reagent by computing moles ÷ coefficient for BOTH reactants.
- Verify that every formula you reference in a challenge exists in the reaction (reactants or products).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: generationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: constrainedSchema,
        systemInstruction:
          "You are an expert chemistry educator creating interactive stoichiometry activities for " +
          "grades 8-12. Your top priority is NUMERICAL ACCURACY: every molar mass, every coefficient, " +
          "every targetAnswer must be computed precisely from the balanced reaction. Never invent " +
          "molar masses — derive them from atomic masses. Never guess a limiting reagent — compute " +
          "moles ÷ coefficient for each reactant. Never estimate theoretical yield — compute it from " +
          "the limiting reagent's extent and the product's coefficient and molar mass. Write clear, " +
          "grade-appropriate language that guides students through the mole map: grams → moles → " +
          "mole ratio → moles → grams.",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini API for stoichiometry-lab");
    }

    const raw = JSON.parse(text) as Partial<StoichiometryLabData> & {
      challenges?: unknown[];
      reaction?: unknown;
    };

    // -----------------------------------------------------------------------
    // Reaction validation
    // -----------------------------------------------------------------------

    let reaction: StoichReaction;
    if (validateReaction(raw.reaction)) {
      reaction = raw.reaction as StoichReaction;
      // Normalize: coerce coefficient to int-like integer, molarMass to number
      reaction.reactants = reaction.reactants.map((s) => ({
        formula: s.formula,
        molarMass: Number(s.molarMass),
        coefficient: Math.max(1, Math.round(Number(s.coefficient))),
      }));
      reaction.products = reaction.products.map((s) => ({
        formula: s.formula,
        molarMass: Number(s.molarMass),
        coefficient: Math.max(1, Math.round(Number(s.coefficient))),
      }));
    } else {
      console.warn('[stoichiometry-lab] Reaction invalid — using fallback 2H2 + O2 -> 2H2O');
      reaction = {
        equation: FALLBACK_REACTION.equation,
        reactants: FALLBACK_REACTION.reactants.map((s) => ({ ...s })),
        products: FALLBACK_REACTION.products.map((s) => ({ ...s })),
      };
    }

    const allFormulas = [...reaction.reactants, ...reaction.products].map((s) => s.formula);
    const reactantFormulas = reaction.reactants.map((r) => r.formula);
    const productFormulas = reaction.products.map((p) => p.formula);

    // -----------------------------------------------------------------------
    // Per-challenge post-validation (THE critical step)
    // -----------------------------------------------------------------------

    const validated: StoichChallenge[] = [];
    const rawChallenges = Array.isArray(raw.challenges) ? (raw.challenges as Partial<StoichChallenge>[]) : [];

    for (const chRaw of rawChallenges) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ch = { ...(chRaw as any) } as StoichChallenge;

      // Required core fields
      if (!ch.id || typeof ch.id !== "string") continue;
      if (!ch.type || !["convert", "limiting", "yield"].includes(ch.type)) continue;
      if (!ch.instruction || !ch.hint || !ch.askFor) continue;
      if (typeof ch.givenMassA !== "number" || !Number.isFinite(ch.givenMassA) || ch.givenMassA <= 0) continue;
      if (!ch.givenFormulaA || !allFormulas.includes(ch.givenFormulaA)) continue;
      if (!ch.narration) ch.narration = ch.instruction;

      if (ch.type === "convert") {
        if (!ch.answerFormula || !allFormulas.includes(ch.answerFormula)) continue;
        if (ch.answerUnit !== "g" && ch.answerUnit !== "mol") continue;
        if (typeof ch.targetAnswer !== "number" || !Number.isFinite(ch.targetAnswer) || ch.targetAnswer <= 0) continue;

        // Force null fields
        ch.givenFormulaB = null;
        ch.givenMassB = null;
        ch.targetAnswerFormula = null;
        ch.actualYield = null;

        if (typeof ch.tolerance !== "number" || !Number.isFinite(ch.tolerance) || ch.tolerance <= 0) {
          ch.tolerance = Math.max(0.05 * Math.abs(ch.targetAnswer), 0.01);
        }
      } else if (ch.type === "limiting") {
        if (!ch.givenFormulaB || ch.givenFormulaB === ch.givenFormulaA) continue;
        if (typeof ch.givenMassB !== "number" || !Number.isFinite(ch.givenMassB) || ch.givenMassB <= 0) continue;
        if (!reactantFormulas.includes(ch.givenFormulaA) || !reactantFormulas.includes(ch.givenFormulaB)) continue;
        if (
          !ch.targetAnswerFormula ||
          (ch.targetAnswerFormula !== ch.givenFormulaA && ch.targetAnswerFormula !== ch.givenFormulaB)
        ) {
          // Fall through — we will recompute; but only if the formula field exists at all, we still recompute below
        }

        const subA = reaction.reactants.find((r) => r.formula === ch.givenFormulaA);
        const subB = reaction.reactants.find((r) => r.formula === ch.givenFormulaB);
        if (!subA || !subB) continue;
        const extentA = (ch.givenMassA / subA.molarMass) / subA.coefficient;
        const extentB = (ch.givenMassB! / subB.molarMass) / subB.coefficient;
        if (!Number.isFinite(extentA) || !Number.isFinite(extentB)) continue;
        if (extentA <= 0 || extentB <= 0) continue;

        // Require a clear limiting reagent (>= 15% gap in extents)
        const gap = Math.abs(extentA - extentB) / Math.max(extentA, extentB);
        if (gap < 0.15) continue;

        // Recompute ground truth (never trust Gemini here)
        ch.targetAnswerFormula = extentA < extentB ? ch.givenFormulaA : ch.givenFormulaB;

        // Force null / zero fields
        ch.answerFormula = null;
        ch.answerUnit = null;
        ch.actualYield = null;
        ch.targetAnswer = 0;
        ch.tolerance = 0;
      } else if (ch.type === "yield") {
        if (!ch.givenFormulaB || ch.givenFormulaB === ch.givenFormulaA) continue;
        if (typeof ch.givenMassB !== "number" || !Number.isFinite(ch.givenMassB) || ch.givenMassB <= 0) continue;
        if (!reactantFormulas.includes(ch.givenFormulaA) || !reactantFormulas.includes(ch.givenFormulaB)) continue;
        if (!ch.answerFormula || !productFormulas.includes(ch.answerFormula)) continue;

        const subA = reaction.reactants.find((r) => r.formula === ch.givenFormulaA);
        const subB = reaction.reactants.find((r) => r.formula === ch.givenFormulaB);
        const prod = reaction.products.find((p) => p.formula === ch.answerFormula);
        if (!subA || !subB || !prod) continue;
        const extentA = (ch.givenMassA / subA.molarMass) / subA.coefficient;
        const extentB = (ch.givenMassB! / subB.molarMass) / subB.coefficient;
        if (!Number.isFinite(extentA) || !Number.isFinite(extentB) || extentA <= 0 || extentB <= 0) continue;

        const limitingExtent = Math.min(extentA, extentB);
        const computedYield = limitingExtent * prod.coefficient * prod.molarMass;
        if (!Number.isFinite(computedYield) || computedYield <= 0) continue;

        // Override with computed truth (Gemini gets this wrong too often)
        ch.targetAnswer = Math.round(computedYield * 100) / 100;
        ch.answerUnit = "g";
        ch.tolerance = Math.max(0.05 * ch.targetAnswer, 0.05);
        ch.targetAnswerFormula = null;

        // Normalize actualYield
        if (ch.actualYield != null) {
          const ay = Number(ch.actualYield);
          if (!Number.isFinite(ay) || ay <= 0 || ay >= ch.targetAnswer) {
            ch.actualYield = null;
          } else {
            ch.actualYield = Math.round(ay * 100) / 100;
          }
        } else {
          ch.actualYield = null;
        }
      } else {
        continue;
      }

      validated.push(ch);
    }

    // -----------------------------------------------------------------------
    // Fallback if everything got rejected
    // -----------------------------------------------------------------------

    let challenges = validated;
    if (challenges.length === 0) {
      console.warn('[stoichiometry-lab] All Gemini challenges rejected — using hardcoded fallback set');
      // If we have a constraint, fall back to only that type; otherwise one of each.
      // Also, if the reaction isn't the canonical H2/O2/H2O set, switch to that for fallback challenges.
      const isCanonicalHO = (
        reactantFormulas.includes("H2") &&
        reactantFormulas.includes("O2") &&
        productFormulas.includes("H2O")
      );
      if (!isCanonicalHO) {
        reaction = {
          equation: FALLBACK_REACTION.equation,
          reactants: FALLBACK_REACTION.reactants.map((s) => ({ ...s })),
          products: FALLBACK_REACTION.products.map((s) => ({ ...s })),
        };
      }
      challenges = buildFallbackChallenges(constraint?.allowedTypes ?? null);
    }

    // -----------------------------------------------------------------------
    // Assemble final result with defaults
    // -----------------------------------------------------------------------

    const showOptions = {
      showMoleLadder: raw.showOptions?.showMoleLadder ?? true,
      showLeftovers: raw.showOptions?.showLeftovers ?? true,
      showRatioStrip: raw.showOptions?.showRatioStrip ?? true,
      showPercentYield: raw.showOptions?.showPercentYield ?? (gradeBand === "11-12"),
      showReactionOutput: raw.showOptions?.showReactionOutput ?? true,
    };

    // -----------------------------------------------------------------------
    // Within-mode support tier — withdraw on-screen / instructional help only.
    // Gated ONLY on supportTier (NOT pinnedType) so blended/auto sessions get
    // difficulty too. The overlay flags (showReactionOutput/showMoleLadder/
    // showRatioStrip) depend only on the tier, so they apply to the whole
    // session's global showOptions; the instruction/hint levers resolve PER
    // CHALLENGE from each challenge's own type. Numbers are never touched.
    // -----------------------------------------------------------------------
    if (supportTier) {
      // Global overlays — resolved off the tier (identical across challenge types).
      const overlay = resolveSupportStructure(challenges[0]?.type ?? 'convert', supportTier);
      showOptions.showReactionOutput = overlay.showReactionOutput;
      showOptions.showMoleLadder = overlay.showMoleLadder;
      showOptions.showRatioStrip = overlay.showRatioStrip;

      const window = MASS_WINDOW[(raw.gradeBand as GradeBand) || gradeBand] ?? MASS_WINDOW['9-10'];

      // ------------------------------------------------------------------
      // AXIS 2 — structural shape. Per challenge: resolve the target shape
      // from its OWN type, COUNT the LLM's actual shape, HONOR if it already
      // hits the target, else RECONSTRUCT deterministically to the exact
      // target (in band, solvability preserved) and RECOMPUTE the answer.
      // ------------------------------------------------------------------
      for (const ch of challenges) {
        const shape = resolveProblemShape(ch.type, supportTier);

        if (ch.type === 'convert') {
          const actual = countConvertSteps(ch, reaction);
          if (actual !== shape.convertSteps) {
            // Reconstruct: pick an answerFormula realizing the target shape.
            // SATURATE honestly — if the reaction can't realize the target, fall
            // back ratioNonUnity→ratio1to1→same (richest available shape).
            const ladder: ConvertSteps[] =
              shape.convertSteps === 'ratioNonUnity'
                ? ['ratioNonUnity', 'ratio1to1', 'same']
                : shape.convertSteps === 'ratio1to1'
                  ? ['ratio1to1', 'ratioNonUnity', 'same']
                  : ['same'];
            let chosen: string | null = null;
            for (const want of ladder) {
              chosen = pickConvertAnswerFormula(ch.givenFormulaA, want, reaction);
              if (chosen) break;
            }
            if (chosen) {
              ch.answerFormula = chosen;
              const all = [...reaction.reactants, ...reaction.products];
              const givenSub = all.find((s) => s.formula === ch.givenFormulaA);
              const ansSub = all.find((s) => s.formula === chosen);
              if (givenSub && ansSub) {
                const unit: 'g' | 'mol' = (ch.answerUnit === 'mol') ? 'mol' : 'g';
                ch.answerUnit = unit;
                ch.targetAnswer = round2(
                  computeConvertAnswer(ch.givenMassA, givenSub, ansSub, unit),
                );
                ch.tolerance = Math.max(0.05 * Math.abs(ch.targetAnswer), 0.01);
                ch.narration = ch.instruction; // drop stale narration keyed to old answer
              }
            }
          }
        } else if (ch.type === 'limiting' || ch.type === 'yield') {
          const subA = reaction.reactants.find((r) => r.formula === ch.givenFormulaA);
          const subB = reaction.reactants.find((r) => r.formula === ch.givenFormulaB);
          if (subA && subB && ch.givenMassB != null) {
            const extentA = (ch.givenMassA / subA.molarMass) / subA.coefficient;
            const extentB0 = (ch.givenMassB / subB.molarMass) / subB.coefficient;
            const actualGap = extentGap(extentA, extentB0);
            const keepALimiting = extentA <= extentB0; // preserve which reactant limits
            // HONOR if the LLM's gap is already within ±0.06 of the target & in floor.
            if (Math.abs(actualGap - shape.gapTarget) > 0.06 || actualGap < LIMITING_GAP_FLOOR) {
              const newMassB = reselectMassBForGap(
                extentA, subB, shape.gapTarget, keepALimiting, window,
              );
              ch.givenMassB = newMassB;
            }
            // RECOMPUTE answer-bearing fields from the (possibly) new mass.
            const eB = (ch.givenMassB! / subB.molarMass) / subB.coefficient;
            if (ch.type === 'limiting') {
              ch.targetAnswerFormula = extentA < eB ? ch.givenFormulaA : ch.givenFormulaB;
              ch.targetAnswer = 0;
              ch.tolerance = 0;
              ch.actualYield = null;
            } else {
              const prod = reaction.products.find((p) => p.formula === ch.answerFormula);
              if (prod) {
                const limitingExtent = Math.min(extentA, eB);
                ch.targetAnswer = round2(limitingExtent * prod.coefficient * prod.molarMass);
                ch.answerUnit = 'g';
                ch.tolerance = Math.max(0.05 * ch.targetAnswer, 0.05);
                ch.targetAnswerFormula = null;
                // Percent-yield step is the hard-tier lever for yield.
                if (shape.percentYield) {
                  // 80–95% of theoretical, deterministic (88%), rounded.
                  ch.actualYield = round2(ch.targetAnswer * 0.88);
                  if (ch.actualYield >= ch.targetAnswer) ch.actualYield = round2(ch.targetAnswer * 0.85);
                } else {
                  ch.actualYield = null;
                }
              }
            }
            ch.narration = ch.instruction; // drop stale narration keyed to old values
          }
        }
      }

      // Per-challenge instruction/hint explicitness — mode-correct (axis 1).
      // Runs AFTER axis-2 reselection so neutralizeStrategy reads the final masses.
      for (const ch of challenges) {
        const sc = resolveSupportStructure(ch.type, supportTier);
        if (!sc.nameStrategy) {
          ch.instruction = neutralizeStrategy(ch);
        }
        if (sc.hintLevel === 'concept') {
          ch.hint = conceptHint(ch, sc.nameStrategy);
        }
      }
      console.log(`[stoichiometry-lab] Difficulty tier "${supportTier}" applied per-challenge (scaffold + structural shape; ${pinnedType ? 'single-mode ' + pinnedType : 'blended'})`);
    }

    const result: StoichiometryLabData = {
      title: raw.title || "Stoichiometry Lab",
      description: raw.description || "Walk the mole map from grams to moles to grams.",
      gradeBand: (raw.gradeBand as GradeBand) || gradeBand,
      reaction,
      challenges,
      showOptions,
      ...(supportTier ? { supportTier } : {}),
    };

    console.log("\u2697\uFE0F Stoichiometry Lab Generated:", {
      title: result.title,
      gradeBand: result.gradeBand,
      reaction: reaction.equation,
      challengeCount: result.challenges.length,
      challengeTypes: result.challenges.map((c) => c.type),
      evalMode: config?.targetEvalMode ?? 'mixed',
    });

    return result;
  } catch (error) {
    console.error("Error generating stoichiometry-lab data:", error);

    // Absolute last-resort fallback
    const fallbackReaction: StoichReaction = {
      equation: FALLBACK_REACTION.equation,
      reactants: FALLBACK_REACTION.reactants.map((s) => ({ ...s })),
      products: FALLBACK_REACTION.products.map((s) => ({ ...s })),
    };
    return {
      title: "Stoichiometry Lab",
      description: "Walk the mole map from grams to moles to grams.",
      gradeBand,
      reaction: fallbackReaction,
      challenges: buildFallbackChallenges(constraint?.allowedTypes ?? null),
      showOptions: {
        showMoleLadder: true,
        showLeftovers: true,
        showRatioStrip: true,
        showPercentYield: gradeBand === "11-12",
        showReactionOutput: true,
      },
    };
  }
};
