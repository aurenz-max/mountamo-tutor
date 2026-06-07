import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";
import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from "../evalMode";
import type {
  AngleWorkshopData,
  AngleWorkshopChallenge,
  AngleWorkshopChallengeType,
  AnglePairRelationship,
  SolveConfig,
  TransversalShape,
  TransversalRelation,
} from "../../primitives/visual-primitives/math/AngleWorkshop";

// ---------------------------------------------------------------------------
// Challenge type docs (one per eval mode) — feeds the constrained prompt
// ---------------------------------------------------------------------------

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  measure: {
    promptDoc:
      `"measure": Grade 7 entry. The student places a virtual protractor on a drawn angle and reads its measure in degrees. `
      + `Integer angle (multiple of 5). The measure is NEVER printed — reading it is the skill.`,
    schemaDescription: "'measure' (read an angle with a protractor)",
  },
  classify_pairs: {
    promptDoc:
      `"classify_pairs": Grade 7. The student sees two angles in a configuration and names the relationship: `
      + `complementary (add to 90°), supplementary (add to 180°), vertical (opposite, equal), or adjacent (share a side).`,
    schemaDescription: "'classify_pairs' (identify the angle-pair relationship)",
  },
  solve_unknown: {
    promptDoc:
      `"solve_unknown": Grade 7. One angle is labeled; the student uses a relationship `
      + `(complementary / supplementary / vertical / angles around a point) to find the unknown angle in degrees.`,
    schemaDescription: "'solve_unknown' (find a missing angle from a relationship)",
  },
  solve_algebraic: {
    promptDoc:
      `"solve_algebraic": Grade 7-8. The angles are labeled with linear expressions like (2x+10)°. The student sets up `
      + `an equation from the relationship and solves for x. Integer solutions only.`,
    schemaDescription: "'solve_algebraic' (set up and solve an equation for x)",
  },
  transversal: {
    promptDoc:
      `"transversal": Grade 8. Parallel lines cut by a transversal (corresponding / alternate / co-interior angles), `
      + `or triangle angle-sum and exterior-angle problems. The student finds the unknown angle in degrees.`,
    schemaDescription: "'transversal' (parallel-line transversal & triangle angle problems)",
  },
};

// ---------------------------------------------------------------------------
// Per-mode instance counts
// ---------------------------------------------------------------------------

const DEFAULT_INSTANCE_COUNT = 4;
const MAX_INSTANCE_COUNT = 6;

const COUNT_BY_MODE: Record<AngleWorkshopChallengeType, number> = {
  measure: 4,
  classify_pairs: 4,
  solve_unknown: 4,
  solve_algebraic: 4,
  transversal: 5,
};

// ---------------------------------------------------------------------------
// Helpers (deterministic local pool — per-challenge values built in code)
// ---------------------------------------------------------------------------

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T,>(arr: T[]): T => arr[randInt(0, arr.length - 1)];

/** Round to the nearest multiple of 5 (protractor-friendly measures). */
const r5 = (n: number): number => Math.round(n / 5) * 5;

const MEASURE_CTX = [
  'A skateboard ramp', 'The hands of a clock', 'An open laptop', 'A pair of scissors',
  'A slice of pie', 'A folding fan', 'A camera tripod leg', 'A drawbridge',
];
const PAIR_CTX = [
  'Two roads meeting at a corner', 'A pair of chopsticks crossing', 'Roof rafters',
  'A folded map', 'Two beams in a bridge', 'Street markings at an intersection',
];
const SOLVE_CTX = [
  'A signpost', 'A kite frame', 'A tile pattern', 'A window frame', 'A garden trellis',
  'A bracket on a shelf',
];
const TRANSVERSAL_CTX = [
  'Train tracks crossed by a road', 'Notebook lines crossed by a diagonal',
  'A ladder leaning across two shelves', 'Parallel fence rails cut by a brace',
];
const TRIANGLE_CTX = [
  'A triangular sail', 'A yield sign', 'A slice of triangular pizza', 'A roof truss',
];

type RawChallenge = Omit<AngleWorkshopChallenge, 'id'>;

// ---------------------------------------------------------------------------
// measure
// ---------------------------------------------------------------------------

function buildMeasure(): RawChallenge {
  const angleMeasure = randInt(3, 33) * 5; // 15..165, multiples of 5
  return {
    type: 'measure',
    narration: `${pick(MEASURE_CTX)} opens to this angle.`,
    instruction: 'Place the protractor on the angle and read its measure.',
    hint: 'Line up the protractor’s center on the vertex and its baseline on one ray. Read where the other ray crosses the scale.',
    answerKind: 'degrees',
    angleMeasure,
    expectedAnswer: angleMeasure,
    tolerance: 2,
  };
}

// ---------------------------------------------------------------------------
// classify_pairs
// ---------------------------------------------------------------------------

function buildClassify(rel: AnglePairRelationship): RawChallenge {
  const base = {
    type: 'classify_pairs' as const,
    narration: `${pick(PAIR_CTX)} form this pair of angles.`,
    instruction: 'Look at how the two angles meet. What is their relationship?',
    hint: 'Do the outer rays make a straight line (180°), a right angle (90°), or do two lines cross? Equal opposite angles are vertical.',
    answerKind: 'relationship' as const,
    relationship: rel,
    expectedRelationship: rel,
    expectedAnswer: 0,
    tolerance: 0.5,
  };
  if (rel === 'complementary') {
    return { ...base, splitAngle: randInt(2, 16) * 5 }; // 10..80 within a 90° corner
  }
  if (rel === 'supplementary') {
    return { ...base, splitAngle: r5(randInt(30, 150)) }; // 30..150 within a straight line
  }
  if (rel === 'vertical') {
    return { ...base, crossAngle: r5(randInt(25, 80)) };
  }
  // adjacent — outer total is deliberately not 90 or 180
  const outerAngle = r5(randInt(110, 165));
  return { ...base, outerAngle, splitAngle: r5(randInt(25, outerAngle - 25)) };
}

// ---------------------------------------------------------------------------
// solve_unknown
// ---------------------------------------------------------------------------

function buildSolveUnknown(cfg: SolveConfig): RawChallenge {
  const ctx = pick(SOLVE_CTX);
  if (cfg === 'complementary') {
    const knownAngle = randInt(2, 16) * 5; // 10..80
    return {
      type: 'solve_unknown', narration: `${ctx} has two angles that form a right angle.`,
      instruction: 'These two angles are complementary (they add to 90°). Find the unknown angle x.',
      hint: 'Complementary angles add to 90°, so x = 90° − the known angle.',
      answerKind: 'degrees', solveConfig: 'complementary', knownAngle,
      expectedAnswer: 90 - knownAngle, tolerance: 1,
    };
  }
  if (cfg === 'supplementary') {
    const knownAngle = r5(randInt(20, 160));
    return {
      type: 'solve_unknown', narration: `${ctx} has two angles that sit on a straight line.`,
      instruction: 'These two angles are supplementary (they add to 180°). Find the unknown angle x.',
      hint: 'Angles on a straight line add to 180°, so x = 180° − the known angle.',
      answerKind: 'degrees', solveConfig: 'supplementary', knownAngle,
      expectedAnswer: 180 - knownAngle, tolerance: 1,
    };
  }
  if (cfg === 'vertical') {
    const knownAngle = r5(randInt(25, 160));
    return {
      type: 'solve_unknown', narration: `${ctx} has two lines crossing.`,
      instruction: 'x and the labeled angle are vertical angles. Find x.',
      hint: 'Vertical angles (opposite each other where two lines cross) are equal, so x equals the known angle.',
      answerKind: 'degrees', solveConfig: 'vertical', knownAngle,
      expectedAnswer: knownAngle, tolerance: 1,
    };
  }
  // around_point — three angles meeting at a point sum to 360
  const knownAngle = r5(randInt(80, 150));
  const knownAngle2 = r5(randInt(80, 150));
  return {
    type: 'solve_unknown', narration: `${ctx} has three angles meeting at a point.`,
    instruction: 'The three angles go all the way around the point (360°). Find the unknown angle x.',
    hint: 'Angles around a point add to 360°, so x = 360° − the two known angles.',
    answerKind: 'degrees', solveConfig: 'around_point', knownAngle, knownAngle2,
    expectedAnswer: 360 - knownAngle - knownAngle2, tolerance: 1,
  };
}

// ---------------------------------------------------------------------------
// solve_algebraic — back-solve from an integer x so the figure is consistent
// ---------------------------------------------------------------------------

function buildAlgebraic(cfg: 'complementary' | 'supplementary' | 'vertical'): RawChallenge {
  const ctx = pick(SOLVE_CTX);
  const target = cfg === 'complementary' ? 90 : 180;

  for (let tries = 0; tries < 300; tries++) {
    const x = randInt(4, 12);
    const a1 = randInt(1, 3);
    const b1 = randInt(0, 6) * 5; // 0..30
    const angle1 = a1 * x + b1;

    if (cfg === 'vertical') {
      let a2 = randInt(1, 3);
      if (a2 === a1) a2 = a1 === 3 ? 2 : a1 + 1;
      const b2 = angle1 - a2 * x; // makes angle2 === angle1 (vertical → equal)
      if (angle1 < 20 || angle1 > 160) continue;
      if (b2 < -40 || b2 > 60) continue;
      return {
        type: 'solve_algebraic',
        narration: `${ctx} has two crossing lines with angles labeled by expressions.`,
        instruction: 'These two angles are vertical angles, so they are equal. Set the expressions equal and solve for x.',
        hint: 'Vertical angles are equal: set the two expressions equal to each other, then solve for x.',
        answerKind: 'x_value', algConfig: 'vertical', a1, b1, a2, b2,
        expectedAnswer: x, tolerance: 0.01,
      };
    }

    if (angle1 <= 5 || angle1 >= target - 5) continue;
    const angle2 = target - angle1;
    const a2 = randInt(1, 3);
    const b2 = angle2 - a2 * x;
    // Cap the constant term so the label stays readable. Supplementary angles
    // (sum 180) routinely have a larger second angle than complementary (sum 90),
    // so scale the upper bound with the target — a flat 70 cap starved the
    // supplementary branch and forced it into the fallback every time.
    const b2Max = cfg === 'supplementary' ? 150 : 70;
    if (b2 < -40 || b2 > b2Max) continue;
    return {
      type: 'solve_algebraic',
      narration: `${ctx} has angles labeled by expressions.`,
      instruction:
        cfg === 'complementary'
          ? 'These two angles are complementary (add to 90°). Write an equation and solve for x.'
          : 'These two angles are supplementary (add to 180°). Write an equation and solve for x.',
      hint:
        cfg === 'complementary'
          ? 'Add the two expressions, set the sum equal to 90, and solve for x.'
          : 'Add the two expressions, set the sum equal to 180, and solve for x.',
      answerKind: 'x_value', algConfig: cfg, a1, b1, a2, b2,
      expectedAnswer: x, tolerance: 0.01,
    };
  }

  // Fallback — guaranteed-valid simple case
  const x = 10;
  if (cfg === 'vertical') {
    return {
      type: 'solve_algebraic', narration: `${ctx} has two crossing lines.`,
      instruction: 'These two angles are vertical angles, so they are equal. Set the expressions equal and solve for x.',
      hint: 'Vertical angles are equal: set the two expressions equal, then solve for x.',
      answerKind: 'x_value', algConfig: 'vertical', a1: 2, b1: 10, a2: 1, b2: 20,
      expectedAnswer: x, tolerance: 0.01,
    };
  }
  const a1 = 2, b1 = 10, angle1 = a1 * x + b1, angle2 = target - angle1, a2 = 1, b2 = angle2 - a2 * x;
  return {
    type: 'solve_algebraic', narration: `${ctx} has angles labeled by expressions.`,
    instruction:
      cfg === 'complementary'
        ? 'These two angles are complementary (add to 90°). Write an equation and solve for x.'
        : 'These two angles are supplementary (add to 180°). Write an equation and solve for x.',
    hint: 'Add the two expressions, set the sum equal to the total, and solve for x.',
    answerKind: 'x_value', algConfig: cfg, a1, b1, a2, b2,
    expectedAnswer: x, tolerance: 0.01,
  };
}

// ---------------------------------------------------------------------------
// transversal / triangle
// ---------------------------------------------------------------------------

const TRANS_RELATIONS: TransversalRelation[] = [
  'corresponding', 'alternate_interior', 'alternate_exterior', 'co_interior',
];

const RELATION_LABEL: Record<TransversalRelation, string> = {
  corresponding: 'corresponding angles',
  alternate_interior: 'alternate interior angles',
  alternate_exterior: 'alternate exterior angles',
  co_interior: 'co-interior (same-side interior) angles',
};

function buildTransversal(shape: TransversalShape, relation?: TransversalRelation): RawChallenge {
  if (shape === 'parallel_transversal') {
    const rel = relation ?? pick(TRANS_RELATIONS);
    const givenAngle = r5(randInt(40, 140));
    const isSupp = rel === 'co_interior';
    return {
      type: 'transversal',
      narration: `${pick(TRANSVERSAL_CTX)} — two parallel lines cut by a transversal.`,
      instruction: `The marked angle and x are ${RELATION_LABEL[rel]}. Find x.`,
      hint: isSupp
        ? 'Co-interior (same-side interior) angles are supplementary — they add to 180°. So x = 180° − the marked angle.'
        : `${RELATION_LABEL[rel].replace(/s$/, '')} pairs are equal when the lines are parallel, so x equals the marked angle.`,
      answerKind: 'degrees', transversalShape: 'parallel_transversal',
      givenAngle, transRelation: rel,
      expectedAnswer: isSupp ? 180 - givenAngle : givenAngle, tolerance: 1,
    };
  }
  if (shape === 'triangle_sum') {
    let g1 = r5(randInt(35, 90));
    let g2 = r5(randInt(35, 90));
    while (g1 + g2 > 150) { g1 = r5(randInt(35, 80)); g2 = r5(randInt(35, 80)); }
    return {
      type: 'transversal',
      narration: `${pick(TRIANGLE_CTX)} forms a triangle.`,
      instruction: 'The three angles of a triangle add to 180°. Two are given — find the third, x.',
      hint: 'The angles of any triangle add to 180°, so x = 180° − the two known angles.',
      answerKind: 'degrees', transversalShape: 'triangle_sum',
      givenAngle: g1, givenAngle2: g2,
      expectedAnswer: 180 - g1 - g2, tolerance: 1,
    };
  }
  // exterior_angle — exterior = sum of the two remote interior angles
  let g1 = r5(randInt(30, 80));
  let g2 = r5(randInt(30, 80));
  while (g1 + g2 > 150) { g1 = r5(randInt(30, 70)); g2 = r5(randInt(30, 70)); }
  return {
    type: 'transversal',
    narration: `${pick(TRIANGLE_CTX)} has one side extended past a corner.`,
    instruction: 'The exterior angle x equals the sum of the two remote interior angles. Find x.',
    hint: 'An exterior angle of a triangle equals the sum of the two non-adjacent (remote) interior angles.',
    answerKind: 'degrees', transversalShape: 'exterior_angle',
    givenAngle: g1, givenAngle2: g2,
    expectedAnswer: g1 + g2, tolerance: 1,
  };
}

// ---------------------------------------------------------------------------
// Canonical key for de-duplication within a session
// ---------------------------------------------------------------------------

function canonicalKey(ch: RawChallenge): string {
  switch (ch.type) {
    case 'measure':
      return `m|${ch.angleMeasure}`;
    case 'classify_pairs':
      return `c|${ch.relationship}|${ch.splitAngle ?? ''}|${ch.outerAngle ?? ''}|${ch.crossAngle ?? ''}`;
    case 'solve_unknown':
      return `su|${ch.solveConfig}|${ch.knownAngle}|${ch.knownAngle2 ?? ''}`;
    case 'solve_algebraic':
      return `sa|${ch.algConfig}|${ch.a1}x${ch.b1}|${ch.a2}x${ch.b2}`;
    case 'transversal':
      return `t|${ch.transversalShape}|${ch.givenAngle}|${ch.givenAngle2 ?? ''}|${ch.transRelation ?? ''}`;
  }
}

// ---------------------------------------------------------------------------
// Recompute the expected answer from the figure (self-check guard vs drift)
// ---------------------------------------------------------------------------

function recomputeExpected(ch: AngleWorkshopChallenge): number | null {
  switch (ch.type) {
    case 'measure':
      return ch.angleMeasure ?? null;
    case 'classify_pairs':
      return null; // relationship answer — nothing numeric to recompute
    case 'solve_unknown': {
      const k = ch.knownAngle ?? 0;
      switch (ch.solveConfig) {
        case 'complementary': return 90 - k;
        case 'supplementary': return 180 - k;
        case 'vertical': return k;
        case 'around_point': return 360 - k - (ch.knownAngle2 ?? 0);
        default: return null;
      }
    }
    case 'solve_algebraic': {
      const a1 = ch.a1 ?? 0, b1 = ch.b1 ?? 0, a2 = ch.a2 ?? 0, b2 = ch.b2 ?? 0;
      if (ch.algConfig === 'vertical') {
        if (a1 === a2) return null;
        return (b2 - b1) / (a1 - a2);
      }
      const target = ch.algConfig === 'complementary' ? 90 : 180;
      if (a1 + a2 === 0) return null;
      return (target - b1 - b2) / (a1 + a2);
    }
    case 'transversal': {
      const g1 = ch.givenAngle ?? 0, g2 = ch.givenAngle2 ?? 0;
      switch (ch.transversalShape) {
        case 'parallel_transversal':
          return ch.transRelation === 'co_interior' ? 180 - g1 : g1;
        case 'triangle_sum': return 180 - g1 - g2;
        case 'exterior_angle': return g1 + g2;
        default: return null;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Build N distinct challenges for a single-mode session, with variance rules
// ---------------------------------------------------------------------------

export function selectAngleWorkshopChallenges(
  challengeType: AngleWorkshopChallengeType,
  count?: number,
): AngleWorkshopChallenge[] {
  const target = Math.max(
    1,
    Math.min(MAX_INSTANCE_COUNT, count ?? COUNT_BY_MODE[challengeType] ?? DEFAULT_INSTANCE_COUNT),
  );

  const raw: RawChallenge[] = [];
  const seen = new Set<string>();
  const tryPush = (ch: RawChallenge): boolean => {
    const key = canonicalKey(ch);
    if (seen.has(key)) return false;
    seen.add(key);
    raw.push(ch);
    return true;
  };

  // Variance rule: rotate through structural variants, guaranteeing ≥1 of each
  // category before back-filling (mirrors factor-tree / circle-explorer).
  if (challengeType === 'measure') {
    for (let a = 0; a < target * 12 && raw.length < target; a++) tryPush(buildMeasure());
  } else if (challengeType === 'classify_pairs') {
    const rels: AnglePairRelationship[] = ['complementary', 'supplementary', 'vertical', 'adjacent'];
    let i = 0;
    for (let a = 0; a < target * 16 && raw.length < target; a++) {
      const rel = i < rels.length ? rels[i] : pick(rels);
      i++;
      tryPush(buildClassify(rel));
    }
  } else if (challengeType === 'solve_unknown') {
    const cfgs: SolveConfig[] = ['complementary', 'supplementary', 'vertical', 'around_point'];
    let i = 0;
    for (let a = 0; a < target * 16 && raw.length < target; a++) {
      const cfg = i < cfgs.length ? cfgs[i] : pick(cfgs);
      i++;
      tryPush(buildSolveUnknown(cfg));
    }
  } else if (challengeType === 'solve_algebraic') {
    const cfgs: Array<'complementary' | 'supplementary' | 'vertical'> = ['supplementary', 'complementary', 'vertical'];
    let i = 0;
    for (let a = 0; a < target * 18 && raw.length < target; a++) {
      const cfg = i < cfgs.length ? cfgs[i] : pick(cfgs);
      i++;
      tryPush(buildAlgebraic(cfg));
    }
  } else {
    // transversal — rotate shapes; spread the parallel relations
    const shapes: TransversalShape[] = ['parallel_transversal', 'triangle_sum', 'exterior_angle'];
    let i = 0;
    let relIdx = 0;
    for (let a = 0; a < target * 18 && raw.length < target; a++) {
      const shape = i < shapes.length ? shapes[i] : pick(shapes);
      i++;
      const rel = shape === 'parallel_transversal' ? TRANS_RELATIONS[relIdx++ % TRANS_RELATIONS.length] : undefined;
      tryPush(buildTransversal(shape, rel));
    }
  }

  // Fallback — accept duplicates if the candidate space was too narrow.
  while (raw.length < target) {
    switch (challengeType) {
      case 'measure': raw.push(buildMeasure()); break;
      case 'classify_pairs': raw.push(buildClassify(pick(['complementary', 'supplementary', 'vertical', 'adjacent']))); break;
      case 'solve_unknown': raw.push(buildSolveUnknown(pick(['complementary', 'supplementary', 'vertical', 'around_point']))); break;
      case 'solve_algebraic': raw.push(buildAlgebraic(pick(['complementary', 'supplementary', 'vertical']))); break;
      default: raw.push(buildTransversal(pick(['parallel_transversal', 'triangle_sum', 'exterior_angle']))); break;
    }
  }

  // Order easier → harder by a per-mode difficulty proxy.
  const difficulty = (ch: RawChallenge): number => {
    switch (ch.type) {
      case 'measure': return ch.angleMeasure ?? 0;
      case 'classify_pairs': return ['complementary', 'supplementary', 'vertical', 'adjacent'].indexOf(ch.relationship ?? 'adjacent');
      case 'solve_unknown': return ['vertical', 'complementary', 'supplementary', 'around_point'].indexOf(ch.solveConfig ?? 'vertical');
      case 'solve_algebraic': return (ch.a1 ?? 1) + (ch.a2 ?? 1);
      case 'transversal': return ['triangle_sum', 'parallel_transversal', 'exterior_angle'].indexOf(ch.transversalShape ?? 'triangle_sum');
    }
  };
  const sorted = raw.sort((a, b) => difficulty(a) - difficulty(b));
  return sorted.map((ch, i) => ({ ...ch, id: `aw-${i + 1}` }));
}

// ---------------------------------------------------------------------------
// Schema (wrapper metadata only — Gemini does NOT emit per-challenge data)
// ---------------------------------------------------------------------------

const angleWorkshopSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "Title for the multi-problem angle session (e.g., 'Solving for Unknown Angles'). Do NOT name specific angle measures or values — the session walks through several figures.",
    },
    description: {
      type: Type.STRING,
      description: "1-2 sentence educational description of what students will practice across the session.",
    },
    challengeType: {
      type: Type.STRING,
      enum: ['measure', 'classify_pairs', 'solve_unknown', 'solve_algebraic', 'transversal'],
      description: "Difficulty tier of the session. The system uses this to build the angle problem pool.",
    },
    gradeBand: {
      type: Type.STRING,
      enum: ['7', '8'],
      description: "Target grade band (7 for measure/classify/solve, 8 for transversal-heavy work).",
    },
  },
  required: ['title', 'description', 'challengeType'],
};

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export const generateAngleWorkshop = async (
  topic: string,
  gradeLevel: string,
  config?: {
    instanceCount?: number;
    targetEvalMode?: string;
  },
): Promise<AngleWorkshopData> => {
  const validTypes: AngleWorkshopChallengeType[] = [
    'measure', 'classify_pairs', 'solve_unknown', 'solve_algebraic', 'transversal',
  ];

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'angle-workshop',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  const activeSchema = evalConstraint
    ? constrainChallengeTypeEnum(angleWorkshopSchema, evalConstraint.allowedTypes, CHALLENGE_TYPE_DOCS, {
        fieldName: 'challengeType',
        rootLevel: true,
      })
    : angleWorkshopSchema;

  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);

  const prompt = `
Create the wrapper metadata for a multi-problem angle geometry session on "${topic}" for ${gradeLevel} students.

CONTEXT:
- An angle session contains 3-6 separate angle problems, all of the same challenge type.
- The system has ALREADY pre-built each problem (angle measures, relationships, expressions, and answers) — you do NOT pick numbers, angles, relationships, or answers.
- Your job is only to write the session-level title and description, and to set the challengeType + gradeBand.

${challengeTypeSection}

REQUIREMENTS:
1. Write a clear, student-friendly title for the whole session. Do NOT name any specific angle measure, value, or answer.
2. Provide a 1-2 sentence educational description of what students will practice.
3. Set challengeType to the correct difficulty tier (matches the constraint above).
4. Set gradeBand to "7" or "8" as appropriate.

Return ONLY the wrapper fields described above.
`;

  logEvalModeResolution('AngleWorkshop', config?.targetEvalMode, evalConstraint);

  const result = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: prompt,
    config: {
      temperature: 0.9,
      topP: 0.95,
      responseMimeType: "application/json",
      responseSchema: activeSchema,
    },
  });

  const wrapper = result.text ? JSON.parse(result.text) : null;
  if (!wrapper) {
    throw new Error('No valid angle-workshop wrapper returned from Gemini API');
  }

  // ── Resolve challengeType (Gemini → eval constraint → safe default) ──
  let challengeType: AngleWorkshopChallengeType = validTypes.includes(wrapper.challengeType as AngleWorkshopChallengeType)
    ? (wrapper.challengeType as AngleWorkshopChallengeType)
    : (evalConstraint?.allowedTypes[0] as AngleWorkshopChallengeType) ?? 'measure';
  if (!validTypes.includes(challengeType)) challengeType = 'measure';

  const gradeBand: '7' | '8' = wrapper.gradeBand === '8' ? '8' : '7';

  // ── Build the per-challenge pool locally ──
  const challenges = selectAngleWorkshopChallenges(challengeType, config?.instanceCount);

  // ── Post-validation: every numeric expectedAnswer must match its figure ──
  for (const ch of challenges) {
    const recomputed = recomputeExpected(ch);
    if (recomputed === null) continue; // classify mode has no numeric answer
    if (Math.abs(recomputed - ch.expectedAnswer) > 1e-6) {
      console.warn(`[AngleWorkshop] Answer mismatch on ${ch.id} (${ch.type}): stored ${ch.expectedAnswer}, recomputed ${recomputed}. Correcting.`);
      ch.expectedAnswer = recomputed;
    }
  }

  const data: AngleWorkshopData = {
    title: wrapper.title,
    description: wrapper.description,
    challengeType,
    gradeBand,
    challenges,
  };

  const summary = challenges
    .map((c) => {
      if (c.type === 'classify_pairs') return `classify/${c.relationship}`;
      if (c.type === 'solve_algebraic') return `alg/${c.algConfig}→x=${c.expectedAnswer}`;
      if (c.type === 'transversal') return `${c.transversalShape}→${c.expectedAnswer}`;
      if (c.type === 'solve_unknown') return `${c.solveConfig}→${c.expectedAnswer}`;
      return `measure→${c.expectedAnswer}`;
    })
    .join(', ');
  console.log(`[AngleWorkshop] Final: challengeType=${challengeType}, instances=${challenges.length} [${summary}]`);

  return data;
};
