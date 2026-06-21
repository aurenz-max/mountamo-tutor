import { Type, Schema } from "@google/genai";
import { RegroupingWorkbenchData } from "../../primitives/visual-primitives/math/RegroupingWorkbench";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";

// ---------------------------------------------------------------------------
// Challenge type documentation registry
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Support tier harness (fixed) + bespoke scaffold resolution
// ---------------------------------------------------------------------------

type SupportTier = 'easy' | 'medium' | 'hard';
const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/**
 * Read the manifest's support tier. The manifest schema enum-constrains
 * config.difficulty to exactly these values, so this is a STRICT lookup.
 * Unknown/absent → null (no tier applied; grade-band defaults stand).
 */
function normalizeSupportTier(difficulty?: string): SupportTier | null {
  const d = difficulty?.toLowerCase().trim() ?? '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : null;
}

type RWChallengeType = 'add_no_regroup' | 'subtract_no_regroup' | 'add_regroup' | 'subtract_regroup';

/**
 * Per-challenge support scaffolds. Every field here is DISPLAY-ONLY — the
 * answer checker compares the student's entered digits against the operands'
 * computed result, never against any of these flags. A withdrawn scaffold can
 * therefore never leak the answer, and the magnitudes (operands) never change.
 */
interface SupportScaffold {
  /** Pre-marked carry/borrow digits & the column-sum regroup-hint marks in the
   *  algorithm (the "carry box pre-filled" cue). Withdrawn at hard so the student
   *  decides WHEN to regroup. */
  showCarryBorrow: boolean;
  /** Per-column "regroup needed here" hint marks (red highlight + the carry-box
   *  outline above each column that overflows). Withdrawn at hard. */
  showRegroupHints: boolean;
  /** Place-value column header labels (Ones / Tens / Hundreds). Withdrawn at hard
   *  so the student tracks place value themselves. */
  showPlaceColumns: boolean;
  /** Column-count badges: a small "+N" badge over each column showing how many
   *  blocks are stacked there (helps the student read the per-column quantity).
   *  NEVER shows the final regrouped answer digit — only the raw stacked count. */
  showColumnBadges: boolean;
  /** Guided step-by-step prompting. On at easy, off at hard. */
  stepByStepMode: boolean;
  /** Prompt guidance describing the scaffolding level at this tier. */
  promptLines: string[];
}

/**
 * Guardrail line shared by BOTH axes of config.difficulty. Replaces the old
 * "numbers never change" framing, which became a lie once the structural axis
 * (resolveProblemShape) started re-selecting operands: the operands DO change,
 * but only to change problem STRUCTURE (regroup count, cross-zero), never to
 * inflate magnitude past the eval-mode + grade-band scope.
 */
const TIER_GUARDRAIL =
  'Numbers stay within the eval-mode + grade-band scope. This tier changes the '
  + 'problem STRUCTURE (how many carries/borrows, and whether a borrow crosses a zero) '
  + 'and how much on-screen help is shown — NOT the magnitude. Never just make the numbers bigger.';

/**
 * Resolve the on-workspace support structure for a tier on a pinned challenge
 * type. Support is withdrawn as the tier hardens; the per-mode lines reframe the
 * SAME task with less scaffolding — never a different task, never bigger numbers.
 *
 * easy  → carry/borrow boxes pre-marked + column-count badges + place-value labels.
 * medium→ keep place labels + carry/borrow row, drop the per-column regroup hint marks & badges.
 * hard  → withdraw the regroup hint marks AND the carry/borrow boxes AND the place
 *         labels & badges: the student decides when to regroup and tracks place value
 *         themselves. The answer-input boxes & blocks stay — they ARE the task surface.
 */
function resolveSupportStructure(pinnedType: RWChallengeType, tier: SupportTier): SupportScaffold {
  const requiresRegroup = pinnedType === 'add_regroup' || pinnedType === 'subtract_regroup';
  const isAddition = pinnedType.startsWith('add');
  const cue = isAddition ? 'carry' : 'borrow';

  const showCarryBorrow = tier !== 'hard';       // the pre-marked carry/borrow cue
  const showRegroupHints = tier === 'easy';      // per-column "regroup here" hint marks
  const showPlaceColumns = tier !== 'hard';      // place-value column labels
  const showColumnBadges = tier === 'easy';      // column-count badges
  const stepByStepMode = tier === 'easy';        // guided prompting

  const promptLines: string[] = [
    `Support tier: ${tier.toUpperCase()} — this sets on-workspace SCAFFOLDING only `
    + `(${tier === 'easy'
        ? 'maximum support: the workspace pre-marks where to regroup and labels every place so the student can self-check'
        : tier === 'medium'
          ? 'moderate support: place labels and the carry/borrow row stay, but the student decides which columns need regrouping'
          : 'minimum support: the student decides WHEN to regroup, tracks place value unaided, and explains each trade'}). `
    + TIER_GUARDRAIL,
  ];

  if (requiresRegroup) {
    promptLines.push(
      tier === 'easy'
        ? `Pre-mark the ${cue} cue: the column that overflows is highlighted and the ${cue} box above it is ready to fill. Narration may name which column to ${cue} from.`
        : tier === 'hard'
          ? `Withdraw the ${cue} hint marks and the place-value column labels. The student must NOTICE that a column overflows and decide to ${cue} without prompting; hints should ask what they see in each column, never name when to ${cue}.`
          : `Keep the place labels and the ${cue} row visible, but do NOT pre-highlight which column needs regrouping — the student finds it.`,
    );
  } else {
    promptLines.push(
      tier === 'easy'
        ? 'Keep place-value labels and column-count badges visible so the student lines up the columns and self-checks each place.'
        : tier === 'hard'
          ? 'Withdraw the place-value column labels and column-count badges; the student aligns the columns and tracks place value unaided.'
          : 'Keep the place-value labels; drop the column-count badges so the student reads each column themselves.',
    );
  }

  return { showCarryBorrow, showRegroupHints, showPlaceColumns, showColumnBadges, stepByStepMode, promptLines };
}

// ---------------------------------------------------------------------------
// Structural PROBLEM difficulty — the SECOND axis of config.difficulty.
//
// Distinct from the scaffolding above (which answers "how much help?"), this
// makes the generated PROBLEM itself genuinely harder per tier — but
// STRUCTURALLY, never by inflating magnitude and never by crossing into another
// eval mode (the eval mode is operation-based, so a regroup-count change is
// orthogonal to it). The lever is the REGROUP-EVENT COUNT, magnitude held fixed
// inside the grade band:
//   add_regroup       → # of carries: 1 → 2 → cascading (chained) carry
//   subtract_regroup  → # of borrows: 1 → 2 → borrow ACROSS A ZERO (e.g. 305-78)
//   add_no_regroup    → 0 carries always; "breadth" (how many live columns) is
//   subtract_no_regroup → 0 borrows always;  prompt-shaped — the count NEVER rises
//                         above 0 (that would jump to a different, regrouping mode).
//
// In-mode floor: a "_regroup" mode keeps ≥1 regroup at EVERY tier — easy never
// drops to 0 (that would silently become its "_no_regroup" sibling). The count
// is also CAPPED at places-1 so the top column never carries/borrows out and the
// result stays in-band. The exact count is enforced in code (re-selecting
// operands in post-process); the prompt only describes the intent.
// See memory [[structural-difficulty-not-numeric]] / [[feedback_llm-window-code-builds-structure]].
// ---------------------------------------------------------------------------

interface ProblemShape {
  /** Exact number of carry/borrow events to force in code (0 for no-regroup modes). */
  regroupTarget: number;
  /** Subtraction hard: force a borrow across a zero (e.g. 305 − 78). */
  crossZero: boolean;
  /** Addition hard: make the upper carry a CHAINED carry (its own digits sum to 9,
   *  it carries only because of the incoming carry — the classic cascade trap). */
  chainedCarry: boolean;
  /** Prompt lines describing the structural intent to the LLM (code still enforces). */
  promptLines: string[];
}

/**
 * Resolve the in-mode structural lever for a tier. `places` (2/3/4 from the grade
 * band's maxPlace) bounds the achievable regroup count so we never push past the
 * band: a 2-digit problem can only fit ONE regroup, so its hard tier saturates at
 * 1 (the scaffolding axis still varies). The real ladder lives at 3-digit.
 */
function resolveProblemShape(mode: RWChallengeType, tier: SupportTier, places: number): ProblemShape {
  const noRegroup = mode.includes('no_regroup');
  const isSub = mode.startsWith('subtract');
  const ev = isSub ? 'borrow' : 'carry';

  if (noRegroup) {
    return {
      regroupTarget: 0,
      crossZero: false,
      chainedCarry: false,
      promptLines: [
        tier === 'easy'
          ? `PROBLEM SHAPE: a clean ${places}-digit ${isSub ? 'subtraction' : 'addition'} with NO regrouping — keep some columns trivial (a digit may be 0) so only one or two columns need real work.`
          : tier === 'medium'
            ? `PROBLEM SHAPE: a ${places}-digit ${isSub ? 'subtraction' : 'addition'} with NO regrouping, but EVERY column has two non-zero digits to combine. Still no ${ev}.`
            : `PROBLEM SHAPE: a ${places}-digit ${isSub ? 'subtraction' : 'addition'} with NO regrouping where the columns sit "close to the edge" (sums near 9 / digits near-equal) so the student must verify carefully that NO column ${isSub ? 'borrows' : 'carries'}.`,
      ],
    };
  }

  // _regroup modes: floor 1 (mode identity), cap places-1 (stay in band).
  const cap = Math.max(1, places - 1);
  const ideal = tier === 'easy' ? 1 : tier === 'medium' ? 2 : 3;
  const regroupTarget = Math.min(Math.max(ideal, 1), cap);
  const crossZero = isSub && tier === 'hard' && places >= 3 && regroupTarget >= 2;
  const chainedCarry = !isSub && tier === 'hard' && regroupTarget >= 2;

  let line: string;
  if (crossZero) {
    line = `PROBLEM SHAPE: a BORROW ACROSS A ZERO — the minuend has a 0 in the tens place, so the ones-place borrow must cascade THROUGH the zero up to the hundreds (e.g. 305 − 78). The hardest elementary borrow.`;
  } else if (chainedCarry) {
    line = `PROBLEM SHAPE: a CASCADING carry — the ones column carries, and that carry pushes the tens column over 10 even though its own two digits sum to only 9 (a hidden, chained carry students often miss).`;
  } else if (regroupTarget >= 2) {
    line = `PROBLEM SHAPE: exactly TWO ${ev}s — both the ones and tens columns ${ev}.`;
  } else {
    line = `PROBLEM SHAPE: exactly ONE ${ev} (the ones column); keep every other column ${ev}-free.`;
  }
  return { regroupTarget, crossZero, chainedCarry, promptLines: [line] };
}

// --- Operand re-selection (code-enforced structural levers) ----------------
// The LLM picks operands in the grade magnitude band; we re-select them in
// post-process to land the EXACT regroup count (never trust the LLM to hit it),
// while keeping every operand `places`-digit (= in band). Digit arrays are
// ones-first to match the component's getDigits().

const placeCount = (p?: string): number => (p === 'thousands' ? 4 : p === 'hundreds' ? 3 : 2);
const randInt = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (Math.max(lo, hi) - lo + 1));
const fromDigits = (digits: number[]): number => digits.reduce((n, d, i) => n + d * Math.pow(10, i), 0);
const toDigits = (num: number, places: number): number[] => {
  const out: number[] = [];
  let n = Math.abs(Math.floor(num));
  for (let i = 0; i < places; i++) { out.push(n % 10); n = Math.floor(n / 10); }
  return out;
};

/** Pick [da, db] with da∈[aMin,9], db∈[bMin,9], da+db within [sumLo,sumHi]. */
function pickPair(sumLo: number, sumHi: number, aMin: number, bMin: number): [number, number] {
  const lo = Math.max(sumLo, aMin + bMin);
  const hi = Math.min(Math.max(sumHi, lo), 18);
  const sum = randInt(lo, hi);
  const daLo = Math.max(aMin, sum - 9);
  const daHi = Math.min(9, sum - bMin);
  const da = randInt(daLo, daHi);
  const db = Math.min(9, Math.max(bMin, sum - da));
  return [da, db];
}

/**
 * Build two `places`-digit addends whose column addition produces EXACTLY
 * `carries` carry events, with NO carry out of the top column (result stays
 * `places`-digit → in band). The lowest `carries` columns are the carrying ones.
 * When `chained`, the highest carrying column carries only via the incoming
 * carry (its own digits sum to 9).
 */
function buildAdditionOperands(places: number, carries: number, chained: boolean): [number, number] {
  const a = new Array(places).fill(0);
  const b = new Array(places).fill(0);
  let carryIn = 0;
  for (let i = 0; i < places; i++) {
    const top = i === places - 1;
    const aMin = top ? 1 : 0;
    const bMin = top ? 1 : 0;
    let da: number, db: number;
    if (i < carries) {
      const isChainTop = chained && i === carries - 1 && carryIn === 1;
      // need da + db + carryIn >= 10
      const sumLo = isChainTop ? 9 : Math.max(10 - carryIn, aMin + bMin);
      const sumHi = isChainTop ? 9 : 16;
      [da, db] = pickPair(sumLo, sumHi, aMin, bMin);
      carryIn = 1;
    } else {
      // need da + db + carryIn <= 9
      [da, db] = pickPair(aMin + bMin, 9 - carryIn, aMin, bMin);
      carryIn = 0;
    }
    a[i] = da; b[i] = db;
  }
  return [fromDigits(a), fromDigits(b)];
}

/**
 * Build minuend & subtrahend (`places`-digit) whose subtraction needs EXACTLY
 * `borrows` borrow events, with NO borrow out of the top column (M > S, both in
 * band). When `crossZero`, the minuend's tens digit is forced to 0 so the
 * ones-place borrow must cascade across the zero (e.g. 305 − 78).
 */
function buildSubtractionOperands(places: number, borrows: number, crossZero: boolean): [number, number] {
  const m = new Array(places).fill(0);
  const s = new Array(places).fill(0);
  let borrowIn = 0;
  for (let i = 0; i < places; i++) {
    const top = i === places - 1;
    const mMin = top ? 1 : 0;
    const sMin = top ? 1 : 0;
    let md: number, sd: number;
    if (i < borrows) {
      if (crossZero && i === 1) {
        md = 0; // force the across-zero column
        sd = randInt(Math.max(1, sMin), 9);
      } else {
        md = randInt(mMin, 8);
        const effM = md - borrowIn;
        sd = randInt(Math.max(sMin, effM + 1, 1), 9);
        if (sd <= effM) sd = Math.min(9, effM + 1);
      }
      borrowIn = 1;
    } else {
      // No borrow: effective M (md - borrowIn) >= sd. For the TOP column force a
      // STRICT inequality so the whole minuend exceeds the subtrahend (M > S) even
      // when every lower column is equal — otherwise a 0-borrow problem could land
      // M == S (e.g. 87 − 87).
      sd = randInt(sMin, 7);
      const slack = top ? 1 : 0;
      md = randInt(Math.max(mMin, sd + borrowIn + slack), 9);
      borrowIn = 0;
    }
    m[i] = md; s[i] = sd;
  }
  return [fromDigits(m), fromDigits(s)];
}

/** Count carry events when adding a + b across `places` columns. */
function countCarries(a: number, b: number, places: number): number {
  const da = toDigits(a, places), db = toDigits(b, places);
  let carry = 0, n = 0;
  for (let i = 0; i < places; i++) {
    if (da[i] + db[i] + carry >= 10) { carry = 1; n++; } else carry = 0;
  }
  return n;
}

/** Count borrow events for m − s and flag whether any borrow crosses a zero. */
function analyzeBorrows(m: number, s: number, places: number): { borrows: number; crossesZero: boolean } {
  const dm = toDigits(m, places), ds = toDigits(s, places);
  let borrow = 0, n = 0, crossesZero = false;
  for (let i = 0; i < places; i++) {
    if (dm[i] - borrow < ds[i]) {
      if (i + 1 < places && dm[i + 1] === 0) crossesZero = true;
      borrow = 1; n++;
    } else borrow = 0;
  }
  return { borrows: n, crossesZero };
}

/**
 * Combined tier prompt block: scaffolding tone (resolveSupportStructure) PLUS
 * structural problem difficulty (resolveProblemShape). One section so the LLM
 * sees both axes of config.difficulty together — though the structural lever is
 * ultimately CODE-enforced on the operands, not left to the LLM.
 */
function buildTierPromptSection(mode: RWChallengeType, tier: SupportTier, places: number): string {
  const lines = [
    ...resolveSupportStructure(mode, tier).promptLines,
    ...resolveProblemShape(mode, tier, places).promptLines,
  ];
  return `\n## WITHIN-MODE SUPPORT TIER "${tier}" (scaffolding + problem STRUCTURE — NOT bigger numbers)\n${lines.map((l) => `- ${l}`).join('\n')}\n`;
}

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  add_no_regroup: {
    promptDoc:
      `"add_no_regroup": Addition problems where NO carrying is needed. `
      + `Ones digits must sum to 9 or less (e.g., 23+14, 31+42). `
      + `Set operation='addition', requiresRegrouping=false, regroupCount=0. `
      + `Great for building confidence before introducing carrying.`,
    schemaDescription: "'add_no_regroup' (addition without carrying)",
  },
  subtract_no_regroup: {
    promptDoc:
      `"subtract_no_regroup": Subtraction problems where NO borrowing is needed. `
      + `Each digit of operand1 must be >= the corresponding digit of operand2 (e.g., 47-23, 86-34). `
      + `Set operation='subtraction', requiresRegrouping=false, regroupCount=0. `
      + `Builds subtraction fluency before introducing borrowing.`,
    schemaDescription: "'subtract_no_regroup' (subtraction without borrowing)",
  },
  add_regroup: {
    promptDoc:
      `"add_regroup": Addition problems that REQUIRE carrying (regrouping). `
      + `Ones digits must sum to 10+ (e.g., 27+45, 38+24). `
      + `Set operation='addition', requiresRegrouping=true, regroupCount=1+. `
      + `CRITICAL for Grades 1-2 (gradeBand "1-2"): Both addends MUST be 2-digit numbers between 10 and 49. `
      + `The sum MUST be ≤ 99. Do NOT use addends like 67, 85, or 128 for Grades 1-2. `
      + `Good examples: 27+45=72, 38+24=62, 19+36=55. Bad examples: 67+85=152 (sum>99). `
      + `Grades 3-4: 3-digit, 1-2 regroups.`,
    schemaDescription: "'add_regroup' (addition with carrying)",
  },
  subtract_regroup: {
    promptDoc:
      `"subtract_regroup": Subtraction problems that REQUIRE borrowing. `
      + `At least one digit of operand1 must be smaller than the corresponding digit of operand2 (e.g., 52-17, 403-248). `
      + `Set operation='subtraction', requiresRegrouping=true, regroupCount=1+. `
      + `operand1 MUST be larger than operand2 (no negative results).`,
    schemaDescription: "'subtract_regroup' (subtraction with borrowing)",
  },
};

// ---------------------------------------------------------------------------
// Base schema (all challenge types)
// ---------------------------------------------------------------------------

const regroupingWorkbenchSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title for the activity (e.g., 'Adding with Regrouping', 'Subtraction with Borrowing')"
    },
    description: {
      type: Type.STRING,
      description: "Brief educational description"
    },
    operation: {
      type: Type.STRING,
      description: "Operation: 'addition' or 'subtraction'"
    },
    operand1: {
      type: Type.NUMBER,
      description: "First operand (the larger number for subtraction)"
    },
    operand2: {
      type: Type.NUMBER,
      description: "Second operand"
    },
    maxPlace: {
      type: Type.STRING,
      description: "Maximum place value: 'tens' (2-digit), 'hundreds' (3-digit), or 'thousands' (4-digit)"
    },
    decimalMode: {
      type: Type.BOOLEAN,
      description: "Whether to use decimals (grade 4+)"
    },
    initialState: {
      type: Type.OBJECT,
      properties: {
        blocksPlaced: {
          type: Type.BOOLEAN,
          description: "Whether blocks are pre-placed on the workspace"
        },
        algorithmVisible: {
          type: Type.BOOLEAN,
          description: "Whether the written algorithm is shown"
        }
      },
      required: ["blocksPlaced", "algorithmVisible"]
    },
    regroupingSteps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          place: {
            type: Type.STRING,
            description: "Place value: 'ones', 'tens', or 'hundreds'"
          },
          type: {
            type: Type.STRING,
            description: "'carry' for addition, 'borrow' for subtraction"
          },
          fromValue: {
            type: Type.NUMBER,
            description: "Value before regrouping at this place"
          },
          toValue: {
            type: Type.NUMBER,
            description: "Value after regrouping at this place"
          },
          narration: {
            type: Type.STRING,
            description: "AI tutor narration for this regrouping step"
          }
        },
        required: ["place", "type", "fromValue", "toValue", "narration"]
      },
      description: "Step-by-step regrouping instructions"
    },
    challenges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "Unique challenge ID"
          },
          type: {
            type: Type.STRING,
            enum: ["add_no_regroup", "add_regroup", "subtract_no_regroup", "subtract_regroup"],
            description: "Challenge type: 'add_no_regroup' (addition without carrying), 'subtract_no_regroup' (subtraction without borrowing), 'add_regroup' (addition with carrying), 'subtract_regroup' (subtraction with borrowing)"
          },
          problem: {
            type: Type.STRING,
            description: "The problem string (e.g., '27 + 45', '52 - 17')"
          },
          requiresRegrouping: {
            type: Type.BOOLEAN,
            description: "Whether this problem requires regrouping"
          },
          regroupCount: {
            type: Type.NUMBER,
            description: "How many times regrouping is needed"
          },
          hint: {
            type: Type.STRING,
            description: "Hint text shown after 2+ incorrect attempts"
          },
          narration: {
            type: Type.STRING,
            description: "AI narration for introducing this problem"
          }
        },
        required: ["id", "type", "problem", "requiresRegrouping", "regroupCount", "hint", "narration"]
      },
      description: "Array of 3-5 progressive challenges"
    },
    showOptions: {
      type: Type.OBJECT,
      properties: {
        showAlgorithm: {
          type: Type.BOOLEAN,
          description: "Show the written algorithm panel"
        },
        showCarryBorrow: {
          type: Type.BOOLEAN,
          description: "Show carry/borrow digits"
        },
        showPlaceColumns: {
          type: Type.BOOLEAN,
          description: "Show place value column headers"
        },
        animateRegrouping: {
          type: Type.BOOLEAN,
          description: "Animate the regrouping process"
        },
        stepByStepMode: {
          type: Type.BOOLEAN,
          description: "Guided step-by-step mode"
        }
      },
      required: ["showAlgorithm", "showCarryBorrow", "showPlaceColumns", "animateRegrouping", "stepByStepMode"]
    },
    wordProblemContext: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: "Whether a word problem context is provided"
        },
        story: {
          type: Type.STRING,
          description: "The word problem story (e.g., 'A farmer has 27 apples and picks 45 more...')"
        },
        imagePrompt: {
          type: Type.STRING,
          description: "Image prompt for the word problem context"
        }
      },
      required: ["enabled"]
    },
    gradeBand: {
      type: Type.STRING,
      description: "Grade band: '1-2' or '3-4'"
    }
  },
  required: ["title", "description", "operation", "operand1", "operand2", "maxPlace", "challenges", "showOptions", "gradeBand"]
};

/**
 * Generate regrouping workbench data for interactive arithmetic
 *
 * Grade-aware content:
 * - Grades 1-2: Two-digit problems with one regroup. Addition focus.
 * - Grades 3-4: Three-digit with multiple regroups. Word problems. Subtraction.
 *
 * @param topic - The math topic or concept
 * @param gradeLevel - Grade level for age-appropriate content
 * @param config - Optional configuration hints
 * @returns RegroupingWorkbenchData with complete configuration
 */
export const generateRegroupingWorkbench = async (
  topic: string,
  gradeLevel: string,
  config?: {
    operation?: 'addition' | 'subtraction';
    gradeBand?: '1-2' | '3-4';
    maxPlace?: 'tens' | 'hundreds' | 'thousands';
    /** Target eval mode from the IRT calibration system. */
    targetEvalMode?: string;
    /**
     * Per-component support tier from the manifest ('easy' | 'medium' | 'hard').
     * Second axis of the two-field contract: targetEvalMode = which skill,
     * difficulty = how much on-screen scaffolding within it. NEVER changes numbers.
     */
    difficulty?: string;
  }
): Promise<RegroupingWorkbenchData> => {
  // Resolve eval mode from catalog (single source of truth)
  const evalConstraint = resolveEvalModeConstraint(
    'regrouping-workbench',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );
  logEvalModeResolution('RegroupingWorkbench', config?.targetEvalMode, evalConstraint);

  // Constrain schema when eval mode is active
  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(regroupingWorkbenchSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS)
    : regroupingWorkbenchSchema;

  // Build challenge type prompt section
  const challengeTypeSection = buildChallengeTypePromptSection(
    evalConstraint,
    CHALLENGE_TYPE_DOCS,
  );

  // Resolve the support tier (the STUDENT's tier — drives application below).
  // pinnedType is ONLY for the prompt tone (single-mode sessions have one mode
  // to describe to the LLM; blended sessions still apply per-challenge below).
  const supportTier = normalizeSupportTier(config?.difficulty);
  const pinnedType = (evalConstraint?.allowedTypes.length === 1
    ? evalConstraint.allowedTypes[0]
    : undefined) as RWChallengeType | undefined;
  // Best-effort place count for the PROMPT (the post-process uses data.maxPlace,
  // which is authoritative). Lets the structural prompt-shape match the band.
  const promptGradeBand: '1-2' | '3-4' = config?.gradeBand
    ?? ((gradeLevel.includes('1') || gradeLevel.includes('2')) ? '1-2' : '3-4');
  const promptPlaces = config?.maxPlace
    ? placeCount(config.maxPlace)
    : (promptGradeBand === '1-2' ? 2 : 3);
  const tierSection = pinnedType && supportTier
    ? buildTierPromptSection(pinnedType, supportTier, promptPlaces)
    : '';

  // Infer operation constraint from eval mode
  const evalOperation = evalConstraint?.allowedTypes[0]?.startsWith('add') ? 'addition'
    : evalConstraint?.allowedTypes[0]?.startsWith('subtract') ? 'subtraction'
    : undefined;
  const effectiveOperation = evalOperation ?? config?.operation;

  const prompt = `
Create an educational regrouping (carry/borrow) activity for teaching "${topic}" to ${gradeLevel} students.

CONTEXT:
- Regrouping is when 10 ones become 1 ten (carrying in addition) or 1 ten becomes 10 ones (borrowing in subtraction)
- Students use base-ten blocks (ones cubes, tens rods, hundreds flats) alongside the written algorithm
- The blocks make the "carry" and "borrow" visible and concrete

${challengeTypeSection}
${tierSection}
${!evalConstraint ? `
GUIDELINES FOR GRADE LEVELS:
- Grades 1-2 (gradeBand "1-2"):
  * Two-digit numbers ONLY (maxPlace: 'tens')
  * Start with a non-regrouping problem, then problems that require 1 regroup
  * Addition focus. Can include simple subtraction with borrowing.
  * Operands: 10-99. Problems like 27+45, 38+24, 52-17
  * stepByStepMode: true (guided)
  * Word problems: simple contexts (apples, toys, stickers)
  * CRITICAL: First challenge should NOT require regrouping. Second and beyond should.

- Grades 3-4 (gradeBand "3-4"):
  * Three-digit numbers (maxPlace: 'hundreds')
  * Problems with 1-2 regroups
  * Both addition and subtraction
  * Operands: 100-999. Problems like 347+285, 503-247
  * stepByStepMode: false (free exploration)
  * Word problems: more complex contexts
  * Can include problems that regroup across multiple places
` : ''}

CHALLENGE REQUIREMENTS:
1. Generate 3-5 challenges${evalConstraint ? ' all of the constrained type' : ' that progress in difficulty'}
2. Each challenge MUST have a "type" field matching one of the allowed challenge types
3. The 'problem' field should be formatted as "27 + 45" or "52 - 17"
4. Set requiresRegrouping and regroupCount accurately for each problem
5. For subtraction: operand1 must be LARGER than operand2 (no negative results)
6. Include conversational narration: "Whoa, 7 + 5 = 12! That's more than 9!"
7. Include regroupingSteps for the FIRST problem that requires regrouping
8. If wordProblemContext is enabled, the story MUST be generic enough for ALL challenges — do NOT include specific numbers. Use phrases like "some items", "a group of objects", or "several toys" instead of exact quantities. The numbers change per challenge, so the story must not contradict any of them.

IMPORTANT:
- For addition with regroup: ones digits should sum to 10+ (e.g., 7+5, 8+6, 9+4)
- For subtraction with regroup: ones digit of operand1 should be smaller than operand2's ones digit (e.g., 42-17: 2<7)
- For no-regroup problems: ensure NO column requires regrouping

${effectiveOperation ? `- Operation: ${effectiveOperation}` : ''}
${config?.gradeBand ? `- Grade band: ${config.gradeBand}` : ''}
${config?.maxPlace ? `- Max place: ${config.maxPlace}` : ''}

Return the complete regrouping workbench configuration.
`;

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const data = result.text ? JSON.parse(result.text) : null;

  if (!data) {
    throw new Error('No valid regrouping workbench data returned from Gemini API');
  }

  // Validation: ensure operation is valid
  if (data.operation !== 'addition' && data.operation !== 'subtraction') {
    data.operation = effectiveOperation ?? 'addition';
  }

  // Validation: ensure gradeBand
  if (data.gradeBand !== '1-2' && data.gradeBand !== '3-4') {
    data.gradeBand = gradeLevel.toLowerCase().includes('1') || gradeLevel.toLowerCase().includes('2') ? '1-2' : '3-4';
  }

  // Validation: ensure maxPlace
  const validPlaces = ['tens', 'hundreds', 'thousands'];
  if (!validPlaces.includes(data.maxPlace)) {
    data.maxPlace = data.gradeBand === '1-2' ? 'tens' : 'hundreds';
  }

  // Grades 1-2 should not exceed tens
  if (data.gradeBand === '1-2' && data.maxPlace !== 'tens') {
    data.maxPlace = 'tens';
  }

  // Ensure operands are positive numbers
  if (typeof data.operand1 !== 'number' || data.operand1 <= 0) data.operand1 = 27;
  if (typeof data.operand2 !== 'number' || data.operand2 <= 0) data.operand2 = 45;

  // For subtraction, ensure operand1 > operand2
  if (data.operation === 'subtraction' && data.operand1 <= data.operand2) {
    const temp = data.operand1;
    data.operand1 = data.operand2;
    data.operand2 = temp;
  }

  // Ensure challenges
  data.challenges = (data.challenges || []).filter(
    (c: { problem: string }) => c.problem && c.problem.length > 0
  );

  // Post-process: clamp challenges that overflow maxPlace (SP-2 fix for RW-2)
  const maxForPlace: Record<string, number> = { tens: 99, hundreds: 999, thousands: 9999 };
  const placeLimit = maxForPlace[data.maxPlace] ?? 99;
  data.challenges = data.challenges.filter((c: { problem: string; type?: string }) => {
    const nums = c.problem.match(/\d+/g)?.map(Number) ?? [];
    if (nums.length < 2) return true; // can't validate, keep it
    const [a, b] = nums;
    const isAdd = c.type?.startsWith('add') || data.operation === 'addition';
    const result = isAdd ? a + b : a - b;
    // Reject if any operand or result exceeds the place limit
    return a <= placeLimit && b <= placeLimit && result <= placeLimit && result >= 0;
  });

  if (data.challenges.length === 0) {
    const fallbackType = evalConstraint?.allowedTypes[0] ?? 'add_regroup';
    const isAddition = fallbackType.startsWith('add');
    const op = isAddition ? '+' : '-';
    data.challenges = [{
      id: 'c1',
      type: fallbackType,
      problem: `${data.operand1} ${op} ${data.operand2}`,
      requiresRegrouping: fallbackType.includes('regroup'),
      regroupCount: fallbackType.includes('regroup') ? 1 : 0,
      hint: isAddition
        ? 'Add the ones first. If you get more than 9, trade 10 ones for 1 ten!'
        : 'If you can\'t subtract the ones, borrow 1 ten to get 10 more ones.',
      narration: isAddition
        ? `Let's add ${data.operand1} and ${data.operand2}! Start with the ones column.`
        : `Let's subtract ${data.operand2} from ${data.operand1}! Start with the ones column.`,
    }];
  }

  // Ensure showOptions
  if (!data.showOptions) {
    data.showOptions = {
      showAlgorithm: true,
      showCarryBorrow: true,
      showPlaceColumns: true,
      animateRegrouping: true,
      stepByStepMode: data.gradeBand === '1-2',
    };
  }

  // Ensure wordProblemContext
  if (!data.wordProblemContext) {
    data.wordProblemContext = { enabled: false };
  }

  // Apply config overrides (only non-eval-mode config)
  if (config) {
    if (config.operation !== undefined && !evalOperation) data.operation = config.operation;
    if (config.gradeBand !== undefined) data.gradeBand = config.gradeBand;
    if (config.maxPlace !== undefined) data.maxPlace = config.maxPlace;
  }

  // -------------------------------------------------------------------------
  // Apply the support tier (scaffolding withdrawal only — magnitudes untouched).
  // Gated ONLY on supportTier so blended sessions get it too. Resolved per
  // challenge from its OWN type. showOptions is a single object, so we derive the
  // workbench-wide scaffolds from the per-challenge resolution (single-mode →
  // uniform; blended → take the MAX support so no challenge is left unsupported
  // beyond its tier). Every field below is display-only; the answer checker is
  // independent of these flags.
  // -------------------------------------------------------------------------
  if (supportTier) {
    data.supportTier = supportTier;
    if (!data.showOptions) {
      data.showOptions = {
        showAlgorithm: true,
        showCarryBorrow: true,
        showPlaceColumns: true,
        animateRegrouping: true,
        stepByStepMode: data.gradeBand === '1-2',
      };
    }

    // --- AXIS 2: structural problem difficulty (code-enforced operand lever) ---
    // Re-select each challenge's operands to land the EXACT regroup count for the
    // tier (honoring the LLM's numbers when they already hit it), keeping every
    // operand inside the grade magnitude band (`places`-digit). The component
    // recomputes correctAnswer from the rewritten `problem`, so nothing is leaked.
    const places = placeCount(data.maxPlace);
    let rewroteAny = false;
    for (const ch of data.challenges as Array<{ type?: string; problem?: string; requiresRegrouping?: boolean; regroupCount?: number }>) {
      const t = (ch.type as RWChallengeType) ?? (pinnedType ?? 'add_regroup');
      const shape = resolveProblemShape(t, supportTier, places);
      const isAdd = t.startsWith('add');
      const nums = ch.problem?.match(/\d+/g)?.map(Number) ?? [];
      let a = nums[0];
      let b = nums[1];

      let needRebuild = !(Number.isFinite(a) && Number.isFinite(b));
      if (!needRebuild) {
        if (isAdd) {
          needRebuild = countCarries(a, b, places) !== shape.regroupTarget || shape.chainedCarry;
        } else {
          if (a < b) { const tmp = a; a = b; b = tmp; }
          const { borrows, crossesZero } = analyzeBorrows(a, b, places);
          needRebuild = a <= b || borrows !== shape.regroupTarget || (shape.crossZero && !crossesZero);
        }
      }
      if (needRebuild) {
        [a, b] = isAdd
          ? buildAdditionOperands(places, shape.regroupTarget, shape.chainedCarry)
          : buildSubtractionOperands(places, shape.regroupTarget, shape.crossZero);
        rewroteAny = true;
      }

      ch.problem = `${a} ${isAdd ? '+' : '-'} ${b}`;
      ch.requiresRegrouping = shape.regroupTarget > 0;
      ch.regroupCount = shape.regroupTarget;
    }
    if (rewroteAny) {
      // Sync the umbrella operands to challenge 1 and drop the pre-baked regrouping
      // narration — its from/to values were keyed to the old operands. The live
      // tutor narrates each regroup step itself, so nothing is lost.
      const firstNums = data.challenges[0]?.problem?.match(/\d+/g)?.map(Number) ?? [];
      if (firstNums.length >= 2) { data.operand1 = firstNums[0]; data.operand2 = firstNums[1]; }
      data.regroupingSteps = [];
    }
    console.log(
      `[RegroupingWorkbench] Structural tier "${supportTier}" applied (places=${places}) → `
      + `${(data.challenges as Array<{ problem?: string; regroupCount?: number }>).map((c) => `${c.problem}[${c.regroupCount}]`).join(', ')}`,
    );

    let anyCarryBorrow = false;
    let anyRegroupHints = false;
    let anyPlaceColumns = false;
    let anyColumnBadges = false;
    let anyStepByStep = false;
    for (const ch of data.challenges as Array<{ type?: string; supportTier?: string }>) {
      const t = (ch.type as RWChallengeType) ?? (pinnedType ?? 'add_regroup');
      const sc = resolveSupportStructure(t, supportTier);
      ch.supportTier = supportTier; // per-challenge stamp for the tutor reveal level
      anyCarryBorrow = anyCarryBorrow || sc.showCarryBorrow;
      anyRegroupHints = anyRegroupHints || sc.showRegroupHints;
      anyPlaceColumns = anyPlaceColumns || sc.showPlaceColumns;
      anyColumnBadges = anyColumnBadges || sc.showColumnBadges;
      anyStepByStep = anyStepByStep || sc.stepByStepMode;
    }
    // showAlgorithm stays ON at every tier — it holds the answer-input boxes and
    // is the task surface, not a scaffold. Never withdraw it.
    data.showOptions.showAlgorithm = true;
    data.showOptions.showCarryBorrow = anyCarryBorrow;
    data.showOptions.showRegroupHints = anyRegroupHints;
    data.showOptions.showPlaceColumns = anyPlaceColumns;
    data.showOptions.showColumnBadges = anyColumnBadges;
    data.showOptions.stepByStepMode = anyStepByStep;

    console.log(
      `[RegroupingWorkbench] Support tier "${supportTier}" applied per-challenge `
      + `(${pinnedType ? `single-mode ${pinnedType}` : 'blended'}) → `
      + `carryBorrow=${anyCarryBorrow}, regroupHints=${anyRegroupHints}, `
      + `placeColumns=${anyPlaceColumns}, columnBadges=${anyColumnBadges}, stepByStep=${anyStepByStep}`,
    );
  }

  return data;
};
