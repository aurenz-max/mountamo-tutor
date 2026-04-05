import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';

// Import data types from component (single source of truth)
import type {
  PlanetaryExplorerData,
  PlanetStop,
  PlanetStat,
  PlanetQuestion,
} from '../../primitives/visual-primitives/astronomy/PlanetaryExplorer';

import {
  resolveEvalModeConstraint,
  constrainChallengeTypeEnum,
  buildChallengeTypePromptSection,
  logEvalModeResolution,
  type ChallengeTypeDoc,
} from '../evalMode';

// ============================================================================
// CHALLENGE TYPE DOCUMENTATION REGISTRY
// ============================================================================

const CHALLENGE_TYPE_DOCS: Record<string, ChallengeTypeDoc> = {
  mc: {
    promptDoc:
      '"mc": Standard multiple-choice. 4 options. Question about a single planet\'s properties. '
      + 'Good for explore and identify modes.',
    schemaDescription: "'mc' (multiple choice, 4 options)",
  },
  compare: {
    promptDoc:
      '"compare": Comparison question spanning 2+ planets. 4 options. '
      + 'Student must recall info from earlier stops. Good for compare and apply modes.',
    schemaDescription: "'compare' (cross-planet comparison, 4 options)",
  },
  'true-false': {
    promptDoc:
      '"true-false": True/false statement about a planet. Exactly 2 options: ["True", "False"]. '
      + 'Good for explore mode at younger grades.',
    schemaDescription: "'true-false' (2 options: True/False)",
  },
};

// ============================================================================
// GRADE-APPROPRIATE CONFIGURATION
// ============================================================================

const GRADE_CONFIGURATIONS: Record<string, { numPlanets: number; guidance: string }> = {
  K: {
    numPlanets: 3,
    guidance: 'Simple vocabulary, short sentences. Focus on explore-mode MC and true-false. Pick familiar planets (Earth, Mars, Jupiter).',
  },
  '1': {
    numPlanets: 3,
    guidance: 'Simple vocabulary. MC and true-false only. Compare Earth to 1-2 others. Warm, encouraging language.',
  },
  '2': {
    numPlanets: 3,
    guidance: 'Introduce basic comparisons. Include comparisonToEarth for every stat. Simple MC and true-false.',
  },
  '3': {
    numPlanets: 4,
    guidance: 'Mix of MC, true-false, and compare questions. Students reason about differences between planets.',
  },
  '4': {
    numPlanets: 4,
    guidance: 'Include compare and apply questions. Students reason about why planets differ (atmosphere, distance from Sun).',
  },
  '5': {
    numPlanets: 5,
    guidance: 'Full range of question types. Deeper reasoning about habitability, atmosphere, orbital mechanics.',
  },
  '6': {
    numPlanets: 5,
    guidance: 'Advanced reasoning. Include apply questions about atmospheric chemistry, gravity effects, and habitability.',
  },
  '7': {
    numPlanets: 5,
    guidance: 'Scientific reasoning about planetary formation, comparative planetology, and real data analysis.',
  },
  '8': {
    numPlanets: 5,
    guidance: 'Advanced comparative planetology. Students should analyze real data, reason about exoplanet habitability criteria.',
  },
};

// ============================================================================
// GEMINI SCHEMA — planets as array, stats/questions flattened within each planet
// ============================================================================

/**
 * Schema strategy: Top-level planets array (3-5 items is manageable for Gemini),
 * but FLATTEN stats and questions within each planet to avoid deeply nested
 * arrays that cause malformed JSON.
 *
 * Each planet has: stat0Label..stat5Label (6 stat slots), q0Question..q2Question (3 question slots).
 * Post-validation reconstructs the nested structure.
 */

// Helper: build flat stat fields for a single planet
function buildFlatStatProperties(): Record<string, Schema> {
  const props: Record<string, Schema> = {};
  for (let i = 0; i < 6; i++) {
    props[`stat${i}Label`] = {
      type: Type.STRING,
      description: `Stat ${i} label (e.g., "Distance from Sun", "Diameter", "Length of Day")`,
      nullable: i >= 4, // first 4 required, 5th and 6th optional
    };
    props[`stat${i}Value`] = {
      type: Type.STRING,
      description: `Stat ${i} value (e.g., "778 million", "139,820")`,
      nullable: i >= 4,
    };
    props[`stat${i}Unit`] = {
      type: Type.STRING,
      description: `Stat ${i} unit (e.g., "km", "hours", "Earth masses")`,
      nullable: true,
    };
    props[`stat${i}ComparisonToEarth`] = {
      type: Type.STRING,
      description: `Stat ${i} comparison to Earth (e.g., "11x Earth's diameter", "5.2x farther than Earth")`,
      nullable: true,
    };
  }
  return props;
}

// Helper: build flat question fields for a single planet
function buildFlatQuestionProperties(): Record<string, Schema> {
  const props: Record<string, Schema> = {};
  for (let i = 0; i < 3; i++) {
    const nullable = i >= 2; // q0 and q1 required, q2 optional
    props[`q${i}Question`] = {
      type: Type.STRING,
      description: `Question ${i} text. NEVER include the answer in the question.`,
      nullable,
    };
    props[`q${i}Type`] = {
      type: Type.STRING,
      enum: ['mc', 'compare', 'true-false'],
      description: `Question ${i} type: 'mc' (4 options), 'compare' (4 options), 'true-false' (2 options)`,
      nullable,
    };
    props[`q${i}Option0`] = { type: Type.STRING, description: `Question ${i}, option A`, nullable };
    props[`q${i}Option1`] = { type: Type.STRING, description: `Question ${i}, option B`, nullable };
    props[`q${i}Option2`] = {
      type: Type.STRING,
      description: `Question ${i}, option C (omit for true-false)`,
      nullable: true,
    };
    props[`q${i}Option3`] = {
      type: Type.STRING,
      description: `Question ${i}, option D (omit for true-false)`,
      nullable: true,
    };
    props[`q${i}CorrectIndex`] = {
      type: Type.NUMBER,
      description: `Question ${i} correct option index (0-based). Must be < number of options.`,
      nullable,
    };
    props[`q${i}Explanation`] = {
      type: Type.STRING,
      description: `Question ${i} explanation shown after answering.`,
      nullable,
    };
    props[`q${i}Difficulty`] = {
      type: Type.STRING,
      enum: ['easy', 'medium', 'hard'],
      description: `Question ${i} difficulty level`,
      nullable,
    };
  }
  return props;
}

const planetaryExplorerResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Engaging title for this planetary exploration journey',
    },
    description: {
      type: Type.STRING,
      description: 'Brief description of what students will learn',
    },
    introduction: {
      type: Type.STRING,
      description: 'Opening narrative (2-3 sentences) that sets the scene for the journey. Do NOT name answers to any questions.',
    },
    celebration: {
      type: Type.STRING,
      description: 'Celebratory message shown when the journey is complete (1-2 sentences)',
    },
    planets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          planetId: {
            type: Type.STRING,
            enum: ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'],
            description: 'Lowercase planet name. Must be a real solar system planet.',
          },
          focusTheme: {
            type: Type.STRING,
            description: 'The pedagogical focus for this stop (e.g., "Extreme Temperatures", "The Red Planet", "Gas Giant")',
          },
          description: {
            type: Type.STRING,
            description: 'Age-appropriate description of this planet (2-3 sentences). Do NOT reveal answers to any questions.',
          },
          funFact: {
            type: Type.STRING,
            description: 'An interesting fun fact about this planet',
          },
          transition: {
            type: Type.STRING,
            description: 'Narrative bridge to the next planet (1 sentence). Leave EMPTY STRING for the last planet.',
          },
          // Flattened stats (6 slots)
          ...buildFlatStatProperties(),
          // Flattened questions (3 slots)
          ...buildFlatQuestionProperties(),
        },
        required: [
          'planetId', 'focusTheme', 'description', 'funFact', 'transition',
          'stat0Label', 'stat0Value',
          'stat1Label', 'stat1Value',
          'stat2Label', 'stat2Value',
          'stat3Label', 'stat3Value',
          'q0Question', 'q0Type', 'q0Option0', 'q0Option1', 'q0CorrectIndex', 'q0Explanation', 'q0Difficulty',
          'q1Question', 'q1Type', 'q1Option0', 'q1Option1', 'q1CorrectIndex', 'q1Explanation', 'q1Difficulty',
        ],
      },
      description: 'Array of 3-5 planet stops. Order by relevance to the topic, NOT by distance from Sun.',
    },
  },
  required: ['title', 'description', 'introduction', 'celebration', 'planets'],
};

// ============================================================================
// RECONSTRUCTION HELPERS
// ============================================================================

/**
 * Reconstruct PlanetStat[] from flat stat0Label..stat5Label fields.
 * Rejects stats missing label or value.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reconstructStats(raw: any): PlanetStat[] {
  const stats: PlanetStat[] = [];
  for (let i = 0; i < 6; i++) {
    const label = raw[`stat${i}Label`];
    const value = raw[`stat${i}Value`];
    if (!label || !value) continue;
    const stat: PlanetStat = { label, value };
    if (raw[`stat${i}Unit`]) stat.unit = raw[`stat${i}Unit`];
    if (raw[`stat${i}ComparisonToEarth`]) stat.comparisonToEarth = raw[`stat${i}ComparisonToEarth`];
    stats.push(stat);
  }
  return stats;
}

/**
 * Reconstruct PlanetQuestion[] from flat q0Question..q2Question fields.
 * Validates correctIndex bounds, option counts, and true-false constraints.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reconstructQuestions(raw: any): PlanetQuestion[] {
  const questions: PlanetQuestion[] = [];
  for (let i = 0; i < 3; i++) {
    const questionText = raw[`q${i}Question`];
    const qType = raw[`q${i}Type`];
    const option0 = raw[`q${i}Option0`];
    const option1 = raw[`q${i}Option1`];
    const correctIndex = raw[`q${i}CorrectIndex`];
    const explanation = raw[`q${i}Explanation`];
    const difficulty = raw[`q${i}Difficulty`];

    // Skip if essential fields are missing
    if (!questionText || !qType || !option0 || !option1 || correctIndex == null || !explanation || !difficulty) {
      continue;
    }

    // Build options array based on question type
    let options: string[];
    if (qType === 'true-false') {
      // Force canonical true-false options regardless of what Gemini sent
      options = ['True', 'False'];
    } else {
      // MC and compare need 4 options
      const option2 = raw[`q${i}Option2`];
      const option3 = raw[`q${i}Option3`];
      if (!option2 || !option3) continue; // Reject MC/compare with < 4 options
      options = [option0, option1, option2, option3];
    }

    // Validate correctIndex is in bounds
    if (correctIndex < 0 || correctIndex >= options.length) {
      console.warn(`[PlanetaryExplorer] Planet q${i}: correctIndex ${correctIndex} out of bounds (options: ${options.length}). Skipping question.`);
      continue;
    }

    // Check for duplicate options (non-true-false)
    if (qType !== 'true-false') {
      const uniqueOptions = new Set(options.map(o => o.toLowerCase().trim()));
      if (uniqueOptions.size < options.length) {
        console.warn(`[PlanetaryExplorer] Planet q${i}: duplicate options detected. Skipping question.`);
        continue;
      }
    }

    // Validate difficulty enum
    const validDifficulties = ['easy', 'medium', 'hard'];
    const resolvedDifficulty = validDifficulties.includes(difficulty) ? difficulty : 'medium';

    // Validate question type enum
    const validTypes = ['mc', 'compare', 'true-false'];
    if (!validTypes.includes(qType)) continue;

    questions.push({
      question: questionText,
      questionType: qType as 'mc' | 'compare' | 'true-false',
      options,
      correctIndex: Math.floor(correctIndex),
      explanation,
      difficulty: resolvedDifficulty as 'easy' | 'medium' | 'hard',
    });
  }
  return questions;
}

// ============================================================================
// HARDCODED FALLBACK (Earth + Mars)
// ============================================================================

function buildFallback(gradeLevel: string): PlanetaryExplorerData {
  console.warn('[PlanetaryExplorer] All planets rejected or generation failed. Using Earth+Mars fallback.');
  return {
    title: 'Exploring Earth and Mars',
    description: 'A quick journey to two familiar planets in our solar system.',
    introduction: 'Welcome, space explorer! Today we will visit two planets you might already know — our home planet Earth, and our red neighbor Mars.',
    celebration: 'Great job exploring Earth and Mars! You are a true space scientist!',
    gradeLevel,
    planets: [
      {
        planetId: 'earth',
        focusTheme: 'Our Home Planet',
        description: 'Earth is the third planet from the Sun and the only planet known to support life. It has liquid water, a breathable atmosphere, and a magnetic field that protects us from solar radiation.',
        keyStats: [
          { label: 'Distance from Sun', value: '150 million', unit: 'km', comparisonToEarth: 'This IS Earth!' },
          { label: 'Diameter', value: '12,742', unit: 'km', comparisonToEarth: 'Reference size' },
          { label: 'Length of Day', value: '24', unit: 'hours', comparisonToEarth: 'Reference time' },
          { label: 'Moons', value: '1', comparisonToEarth: 'Our Moon' },
        ],
        funFact: 'Earth is the only planet in our solar system not named after a Greek or Roman god.',
        transition: 'Now let us travel to our closest neighbor, the mysterious Red Planet!',
        questions: [
          {
            question: 'How many moons does Earth have?',
            questionType: 'mc',
            options: ['0', '1', '2', '4'],
            correctIndex: 1,
            explanation: 'Earth has exactly one moon, which we simply call "the Moon."',
            difficulty: 'easy',
          },
          {
            question: 'What covers most of Earth\'s surface?',
            questionType: 'mc',
            options: ['Sand', 'Water', 'Ice', 'Lava'],
            correctIndex: 1,
            explanation: 'About 70% of Earth\'s surface is covered by liquid water, making it unique in our solar system.',
            difficulty: 'easy',
          },
        ],
      },
      {
        planetId: 'mars',
        focusTheme: 'The Red Planet',
        description: 'Mars is the fourth planet from the Sun. Its red color comes from iron oxide (rust) on its surface. Scientists have sent many rovers to explore Mars.',
        keyStats: [
          { label: 'Distance from Sun', value: '228 million', unit: 'km', comparisonToEarth: '1.5x farther than Earth' },
          { label: 'Diameter', value: '6,779', unit: 'km', comparisonToEarth: 'About half Earth\'s size' },
          { label: 'Length of Day', value: '24.6', unit: 'hours', comparisonToEarth: 'Very similar to Earth!' },
          { label: 'Moons', value: '2', comparisonToEarth: '1 more than Earth' },
        ],
        funFact: 'Mars has the tallest volcano in the solar system — Olympus Mons, which is about 3 times the height of Mount Everest!',
        transition: '',
        questions: [
          {
            question: 'What gives Mars its red color?',
            questionType: 'mc',
            options: ['Lava on the surface', 'Iron oxide (rust)', 'Red clouds', 'Red sunlight'],
            correctIndex: 1,
            explanation: 'Mars appears red because its surface is covered in iron oxide, which is the same chemical we know as rust.',
            difficulty: 'easy',
          },
          {
            question: 'How many moons does Mars have?',
            questionType: 'mc',
            options: ['0', '1', '2', '5'],
            correctIndex: 2,
            explanation: 'Mars has two small moons called Phobos and Deimos.',
            difficulty: 'easy',
          },
        ],
      },
    ],
  };
}

// ============================================================================
// EVAL MODE-SPECIFIC PROMPT GUIDANCE
// ============================================================================

function getEvalModeGuidance(evalMode: string | undefined): string {
  switch (evalMode) {
    case 'explore':
      return `EVAL MODE — EXPLORE:
- Every question should reference information visible in that planet's stats panel or description.
- Recall-level: student reads the stats and answers. No cross-planet comparisons.
- Prefer 'mc' and 'true-false' question types.
- Questions should be answerable from the information provided on this planet's panel.`;

    case 'identify':
      return `EVAL MODE — IDENTIFY:
- Questions should describe a planet WITHOUT naming it, then ask the student to identify which planet matches.
- Include the correct planet name and 3 other planet names as options.
- Use 'mc' question type. The question describes features, the options are planet names.
- Example: "Which planet has a Great Red Spot and is the largest in our solar system?"`;

    case 'compare':
      return `EVAL MODE — COMPARE:
- Questions should span 2 or more planets. The student must remember information from previous stops.
- Use 'compare' question type primarily.
- Example: "Which planet has a longer day — Mars or Jupiter?"
- Ensure comparison questions reference planets the student has already visited (earlier in the list).`;

    case 'apply':
      return `EVAL MODE — APPLY:
- Open reasoning questions about WHY things are the way they are.
- Use 'mc' type but with reasoning-based options.
- Example: "Why can't liquid water exist on the surface of Venus?" with options explaining different scientific reasons.
- Questions should require applying knowledge, not just recalling facts.`;

    default:
      return `No specific eval mode — generate a natural mix of question types (mc, compare, true-false) progressing in difficulty.`;
  }
}

// ============================================================================
// GENERATOR FUNCTION
// ============================================================================

export const generatePlanetaryExplorer = async (
  topic: string,
  gradeLevel: string,
  config?: Partial<{ targetEvalMode?: string }>,
): Promise<PlanetaryExplorerData> => {
  const resolvedGrade = (gradeLevel.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '3') as string;
  const gradeConfig = GRADE_CONFIGURATIONS[resolvedGrade] || GRADE_CONFIGURATIONS['3'];

  // ── Resolve eval mode from the catalog (single source of truth) ──
  const evalConstraint = resolveEvalModeConstraint(
    'planetary-explorer',
    config?.targetEvalMode,
    CHALLENGE_TYPE_DOCS,
  );

  // ── Build mode-constrained schema ──
  // For planetary-explorer, the question type field is inside planets[].q*Type,
  // which is already flattened. We constrain via prompt rather than schema enum
  // since the type fields are per-question flat fields, not a single array path.
  // The schema enum on q*Type fields already lists all types; prompt guidance
  // steers Gemini to the correct subset.
  const activeSchema = planetaryExplorerResponseSchema;

  // ── Build prompt ──
  const challengeTypeSection = buildChallengeTypePromptSection(evalConstraint, CHALLENGE_TYPE_DOCS);
  const evalModeGuidance = getEvalModeGuidance(config?.targetEvalMode);

  const prompt = `
Create an interactive Planetary Explorer journey for ${gradeLevel} students.

**Topic:** ${topic}

**Grade Level:** ${resolvedGrade}
**Grade Guidance:** ${gradeConfig.guidance}

**Journey Structure:**
- Pick ${gradeConfig.numPlanets} planets from our solar system that are MOST RELEVANT to the topic "${topic}".
- Order planets by relevance to the topic, NOT by distance from the Sun.
- Do NOT always start with Mercury. Let the topic guide the selection.
- Each planet is a "stop" on the journey with stats, a fun fact, and 2-3 questions.

**Planet Stop Requirements:**
For each planet, provide:
- planetId: lowercase planet name (mercury, venus, earth, mars, jupiter, saturn, uranus, neptune)
- focusTheme: the pedagogical angle for this stop
- description: 2-3 sentences. NEVER include answers to any questions.
- funFact: an interesting fact
- transition: 1 sentence bridging to the next planet. EMPTY STRING ("") for the last planet.

**Stats (MANDATORY — at least 4 per planet):**
- Use flat fields: stat0Label, stat0Value, stat0Unit, stat0ComparisonToEarth through stat5.
- Include at minimum: stat0 through stat3 (4 stats). stat4 and stat5 are optional bonus stats.
- ALWAYS include comparisonToEarth for every stat — this enables scale learning.
- Good stats: Distance from Sun, Diameter, Mass, Length of Day, Length of Year, Number of Moons, Surface Temperature, Gravity.

**Questions (MANDATORY — at least 2 per planet):**
- Use flat fields: q0Question, q0Type, q0Option0-q0Option3, q0CorrectIndex, q0Explanation, q0Difficulty. Same for q1 and optionally q2.
- q0 and q1 are REQUIRED. q2 is optional.
- For 'mc' and 'compare' types: provide ALL 4 options (q*Option0 through q*Option3).
- For 'true-false' type: provide exactly 2 options. q*Option0 = "True", q*Option1 = "False". q*CorrectIndex must be 0 or 1.
- correctIndex is 0-based and MUST be less than the number of options.
- NEVER include the answer in the question text, planet description, or fun fact.
- Each option must be unique — no duplicate options within a question.

${challengeTypeSection}

${evalModeGuidance}

**CRITICAL RULES:**
1. NEVER reveal the answer in the question text or the planet's description/fun fact.
2. The last planet's transition MUST be an empty string "".
3. Every stat MUST have both a label and a value.
4. Every question MUST have a valid correctIndex that is less than the number of options.
5. For true-false: options MUST be exactly ["True", "False"].
6. Descriptions should be informative but NOT give away question answers.
7. Make questions age-appropriate for grade ${resolvedGrade}.

Generate a complete, pedagogically sound planetary exploration journey.
`;

  logEvalModeResolution('PlanetaryExplorer', config?.targetEvalMode, evalConstraint);

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: activeSchema,
      },
    });

    const raw = JSON.parse(result.text || '{}');

    // ── Validate top-level fields ──
    const title = raw.title;
    const description = raw.description;
    const introduction = raw.introduction;
    const celebration = raw.celebration;

    if (!title || !description || !introduction || !celebration) {
      console.warn('[PlanetaryExplorer] Missing top-level fields. Using fallback.');
      return buildFallback(resolvedGrade);
    }

    // ── Reconstruct planets from flat Gemini fields ──
    const rawPlanets = raw.planets;
    if (!Array.isArray(rawPlanets) || rawPlanets.length === 0) {
      console.warn('[PlanetaryExplorer] No planets returned. Using fallback.');
      return buildFallback(resolvedGrade);
    }

    const validPlanets: PlanetStop[] = [];
    let rejectedCount = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const rawPlanet of rawPlanets as any[]) {
      // Validate required string fields
      const planetId = rawPlanet.planetId;
      const focusTheme = rawPlanet.focusTheme;
      const planetDescription = rawPlanet.description;
      const funFact = rawPlanet.funFact;

      if (!planetId || !focusTheme || !planetDescription || !funFact) {
        console.warn(`[PlanetaryExplorer] Rejecting planet: missing core fields (planetId=${planetId})`);
        rejectedCount++;
        continue;
      }

      // Validate planetId is a known planet
      const validPlanetIds = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
      if (!validPlanetIds.includes(planetId.toLowerCase())) {
        console.warn(`[PlanetaryExplorer] Rejecting planet: unknown planetId "${planetId}"`);
        rejectedCount++;
        continue;
      }

      // Reconstruct stats
      const keyStats = reconstructStats(rawPlanet);
      if (keyStats.length < 4) {
        console.warn(`[PlanetaryExplorer] Rejecting planet "${planetId}": only ${keyStats.length} valid stats (need >= 4)`);
        rejectedCount++;
        continue;
      }

      // Reconstruct questions
      let questions = reconstructQuestions(rawPlanet);

      // ── Post-filter: drop question types not allowed by the eval mode ──
      if (evalConstraint) {
        const allowed = new Set(evalConstraint.allowedTypes);
        const before = questions.length;
        questions = questions.filter((q) => allowed.has(q.questionType));
        if (questions.length < before) {
          console.log(
            `[PlanetaryExplorer] Filtered ${before - questions.length} disallowed question type(s) for "${planetId}" (allowed: ${evalConstraint.allowedTypes.join(', ')})`,
          );
        }
      }

      if (questions.length < 2) {
        console.warn(`[PlanetaryExplorer] Rejecting planet "${planetId}": only ${questions.length} valid questions (need >= 2)`);
        rejectedCount++;
        continue;
      }

      // Transition: use raw value, will fix last-planet empty transition below
      const transition = rawPlanet.transition ?? '';

      validPlanets.push({
        planetId: planetId.toLowerCase(),
        focusTheme,
        description: planetDescription,
        keyStats,
        funFact,
        transition,
        questions,
      });
    }

    if (rejectedCount > 0) {
      console.log(`[PlanetaryExplorer] ${rejectedCount} planet(s) rejected, ${validPlanets.length} survived.`);
    }

    // If all planets rejected, use fallback
    if (validPlanets.length === 0) {
      return buildFallback(resolvedGrade);
    }

    // Ensure last planet has empty transition
    validPlanets[validPlanets.length - 1].transition = '';

    // Ensure no duplicate planet IDs (keep first occurrence)
    const seenIds = new Set<string>();
    const dedupedPlanets = validPlanets.filter((p) => {
      if (seenIds.has(p.planetId)) {
        console.warn(`[PlanetaryExplorer] Removing duplicate planet "${p.planetId}"`);
        return false;
      }
      seenIds.add(p.planetId);
      return true;
    });

    // Ensure minimum 2 planets (fallback if only 1)
    if (dedupedPlanets.length < 2) {
      console.warn('[PlanetaryExplorer] Fewer than 2 unique planets. Using fallback.');
      return buildFallback(resolvedGrade);
    }

    const finalData: PlanetaryExplorerData = {
      title,
      description,
      introduction,
      celebration,
      gradeLevel: resolvedGrade,
      planets: dedupedPlanets,
    };

    console.log(`[PlanetaryExplorer] Generated successfully: ${dedupedPlanets.length} planets, ${dedupedPlanets.reduce((sum, p) => sum + p.questions.length, 0)} total questions.`);

    return finalData;
  } catch (error) {
    console.error('[PlanetaryExplorer] Error generating content:', error);
    return buildFallback(resolvedGrade);
  }
};
