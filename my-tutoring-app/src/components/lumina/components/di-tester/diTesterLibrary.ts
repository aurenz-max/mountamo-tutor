import { DI_CATALOG } from '../../service/manifest/catalog/di';
import type { EvalModeDefinition } from '../../types';

export const DI_TESTER_PRIMITIVE_IDS = [
  'di-letter-sounds',
  'di-word-reading',
  'di-math-facts',
  'di-dice-roll',
  'di-shapes',
  'di-sentence-reading',
  'di-spoken-practice',
  'di-worked-procedure',
  'di-deduction',
  'di-word-problem-setup',
] as const;

export type DiPrimitiveId = (typeof DI_TESTER_PRIMITIVE_IDS)[number];
export type DiSupportTier = '' | 'easy' | 'medium' | 'hard';

interface PresetInput {
  objective: string;
  gradeLevel?: string;
  difficulty?: DiSupportTier;
}

interface PrimitivePresentation {
  label: string;
  shortLabel: string;
  subtitle: string;
  defaultGrade: string;
  defaultObjective: string;
  examples: Record<string, PresetInput>;
}

export interface DiTesterPreset extends PresetInput {
  id: string;
  primitiveId: DiPrimitiveId;
  primitiveLabel: string;
  evalMode: string;
  label: string;
  description: string;
  beta: number;
  scaffoldingMode: number;
  gradeLevel: string;
  difficulty: DiSupportTier;
}

export interface DiTesterPrimitive extends Omit<PrimitivePresentation, 'examples'> {
  id: DiPrimitiveId;
  evalModes: EvalModeDefinition[];
  presets: DiTesterPreset[];
}

/**
 * Tester-only presentation and request inputs. Evaluation-mode identity and
 * descriptions come from DI_CATALOG below, so this file cannot quietly invent
 * a mode that production does not recognize.
 */
export const DI_TESTER_PRESENTATION: Record<DiPrimitiveId, PrimitivePresentation> = {
  'di-letter-sounds': {
    label: 'Letter Sounds',
    shortLabel: 'Sounds',
    subtitle: 'Produce a sound from a letter or spoken word.',
    defaultGrade: 'kindergarten',
    defaultObjective: 'produce the sounds for m, s, a, and f',
    examples: {
      letter_sound: { objective: 'produce the isolated letter sounds for m, s, a, and f' },
      letter_sound_review: { objective: 'review the letter sounds m, s, a, f, r, n, e, and l' },
      first_sound_in_word: { objective: 'identify the first sound in sun, moon, fan, and rain' },
    },
  },
  'di-word-reading': {
    label: 'Word Reading',
    shortLabel: 'Words',
    subtitle: 'Read one printed decodable or sight word aloud.',
    defaultGrade: 'kindergarten',
    defaultObjective: 'read short-a CVC words and starter sight words',
    examples: {
      cvc_reading: { objective: 'read short-a CVC words: sam, mat, ram, sat' },
      read_word: { objective: 'read a mixed set of short-vowel words and starter sight words' },
      sight_word: { objective: 'read the sight words the, a, I, see, and my' },
      word_reading_review: { objective: 'review taught CVC words and kindergarten sight words' },
    },
  },
  'di-math-facts': {
    label: 'Math Facts',
    shortLabel: 'Facts',
    subtitle: 'Name numerals and answer spoken number relationships.',
    defaultGrade: 'kindergarten',
    defaultObjective: 'addition facts within 5',
    examples: {
      name_numeral: { objective: 'name numerals from 0 through 10' },
      counting_next: { objective: 'say the number that comes next within 20' },
      answer_fact: { objective: 'answer addition facts within 5' },
      fact_review: { objective: 'review addition and subtraction facts within 10', gradeLevel: 'Grade 1' },
      subtraction_fact: { objective: 'answer subtraction facts within 5' },
    },
  },
  'di-dice-roll': {
    label: 'Dice Roll',
    shortLabel: 'Dice',
    subtitle: 'Read, compare, or combine visible pip patterns.',
    defaultGrade: 'kindergarten',
    defaultObjective: 'subitize dice patterns to 6',
    examples: {
      count_pips: { objective: 'subitize and count dice patterns to 6' },
      compare_dice: { objective: 'compare two dice and say left, right, or same' },
      sum_two_dice: { objective: 'add the pip totals on two dice', gradeLevel: 'Grade 1' },
    },
  },
  'di-shapes': {
    label: 'Shapes',
    shortLabel: 'Shapes',
    subtitle: 'Name drawn shapes and speak their visible attributes.',
    defaultGrade: 'kindergarten',
    defaultObjective: 'name basic two-dimensional shapes',
    examples: {
      name_shape: { objective: 'name circles, triangles, squares, rectangles, and hexagons' },
      shape_review: { objective: 'review a mixed set of taught two-dimensional shapes' },
      find_real_object: { objective: 'identify the two-dimensional shape in familiar objects' },
      count_sides: { objective: 'count the sides of triangles, squares, rectangles, pentagons, and hexagons', gradeLevel: 'Grade 1' },
      count_corners: { objective: 'count the corners of triangles, squares, rectangles, pentagons, and hexagons', gradeLevel: 'Grade 1' },
    },
  },
  'di-sentence-reading': {
    label: 'Sentence Reading',
    shortLabel: 'Sentences',
    subtitle: 'Read short connected text aloud, word by word.',
    defaultGrade: 'Grade 1',
    defaultObjective: 'read simple short sentences accurately',
    examples: {
      decodable_sentence: { objective: 'read short-a decodable CVC sentences' },
      read_sentence: { objective: 'read simple sentences with mixed short-vowel words' },
      sentence_review: { objective: 'review taught decodable and sight-word sentences' },
      sight_phrase_sentence: { objective: 'read sentences containing the sight words you, can, see, my, and the' },
    },
  },
  'di-spoken-practice': {
    label: 'Spoken Practice',
    shortLabel: 'Generic',
    subtitle: 'Generate a spoken-response lesson for a new content domain.',
    defaultGrade: 'kindergarten',
    defaultObjective: 'add one more within 5',
    examples: {
      count_and_say: { objective: 'count groups of apples from 1 through 5 and say the total' },
      read_aloud: { objective: 'read numerals from 0 through 10 aloud' },
      compare_choice: { objective: 'compare two pictured objects and say longer, shorter, or same', gradeLevel: 'Grade 1' },
      say_answer: { objective: 'name the color shown using red, blue, yellow, or green' },
      explain_concept: { objective: 'explain why both sides of a balanced equation are equal', gradeLevel: 'Grade 3' },
    },
  },
  'di-worked-procedure': {
    label: 'Talk-Through Subtraction',
    shortLabel: 'Procedure',
    subtitle: 'Narrate multi-digit subtraction one column at a time.',
    defaultGrade: 'Grade 2',
    defaultObjective: 'two-digit subtraction with regrouping',
    examples: {
      subtract_no_regroup: { objective: 'two-digit subtraction without regrouping' },
      subtract_regroup: { objective: 'two-digit subtraction with regrouping' },
    },
  },
  'di-deduction': {
    label: 'Use the Rule',
    shortLabel: 'Deduction',
    subtitle: 'Apply or test a stated rule and explain what follows.',
    defaultGrade: 'Grade 3',
    defaultObjective: 'use rules about animal groups to make deductions',
    examples: {
      conclude: { objective: 'use the rule all birds have feathers to conclude what is true of a robin' },
      deny: { objective: 'use the rule all insects have six legs to rule out animals without six legs' },
      cannot_tell: { objective: 'decide when a one-way animal classification rule does not provide enough information' },
    },
  },
  'di-word-problem-setup': {
    label: 'Set Up the Story',
    shortLabel: 'Stories',
    subtitle: 'Drag each story part into small + small = big, then solve it.',
    defaultGrade: 'Grade 2',
    defaultObjective: 'set up addition and subtraction stories within 20',
    examples: {
      find_big_number: { objective: 'find the whole amount in addition and subtraction stories within 20', gradeLevel: 'Grade 1' },
      build_family: { objective: 'build the number family for addition and subtraction stories within 20' },
      classify_and_build: { objective: 'classify comparison, change, and part-whole stories, then build the number family', gradeLevel: 'Grade 3' },
    },
  },
};

const idSet = new Set<string>(DI_TESTER_PRIMITIVE_IDS);

export const DI_TESTER_PRIMITIVES: DiTesterPrimitive[] = DI_CATALOG
  .filter((definition): definition is typeof definition & { id: DiPrimitiveId } => idSet.has(definition.id))
  .map((definition) => {
    const presentation = DI_TESTER_PRESENTATION[definition.id];
    const evalModes = definition.evalModes ?? [];
    return {
      id: definition.id,
      label: presentation.label,
      shortLabel: presentation.shortLabel,
      subtitle: presentation.subtitle,
      defaultGrade: presentation.defaultGrade,
      defaultObjective: presentation.defaultObjective,
      evalModes,
      presets: evalModes.map((mode) => {
        const input = presentation.examples[mode.evalMode] ?? {
          objective: presentation.defaultObjective,
        };
        return {
          id: `${definition.id}:${mode.evalMode}`,
          primitiveId: definition.id,
          primitiveLabel: presentation.label,
          evalMode: mode.evalMode,
          label: mode.label,
          description: mode.description,
          beta: mode.beta,
          scaffoldingMode: mode.scaffoldingMode,
          objective: input.objective,
          gradeLevel: input.gradeLevel ?? presentation.defaultGrade,
          difficulty: input.difficulty ?? '',
        };
      }),
    };
  });

export const DI_TESTER_PRESETS = DI_TESTER_PRIMITIVES.flatMap((primitive) => primitive.presets);

export const getDiTesterPrimitive = (id: DiPrimitiveId): DiTesterPrimitive =>
  DI_TESTER_PRIMITIVES.find((primitive) => primitive.id === id) ?? DI_TESTER_PRIMITIVES[0];
