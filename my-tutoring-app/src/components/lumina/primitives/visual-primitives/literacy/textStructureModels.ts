/**
 * Hand-written models for text-structure-analyzer's levers (lever plan 2026-10-03 R2, R5, R6). Link sentences carry
 * exactly one code-owned linking word between two ideas; mini passages are three sentences of one structure and never
 * print a word of any structure's name (R6), so naming the structure is not word matching on the model either.
 */
import type { StructureTypeId } from './textStructureAnalyzerScript';

export interface LinkModel { sentence: string; word: string }
const l = (sentence: string, word: string): LinkModel => ({ sentence, word });

export const LINK_MODELS: LinkModel[] = [
  l('The ice melted, so the path got wet.', 'so'),
  l('We stayed inside because the wind was cold.', 'because'),
  l('Max wanted soup, but the pot was empty.', 'but'),
  l('The baby slept after her warm bath.', 'after'),
  l('Wash your hands before you eat lunch.', 'before'),
  l('Ben fed the puppy, then he walked it.', 'then'),
  l('Lia likes apples, whereas Sam likes pears.', 'whereas'),
  l('The road was icy, therefore the bus went slowly.', 'therefore'),
  l('Although it rained, the game went on.', 'although'),
  l('The kite flew high since the wind was strong.', 'since'),
  l('Owls hunt at night, unlike most birds.', 'unlike'),
  l('Pat was tired, but he kept running.', 'but'),
  l('The plant grew tall because it got sun.', 'because'),
  l('The milk spilled, so Ana grabbed a towel.', 'so'),
  l('Lee finished his homework before dinner.', 'before'),
  l('Rosa felt sleepy, though it was only noon.', 'though'),
  l('We skipped the slide and used the swings instead.', 'instead'),
];

export interface MiniPassage { structure: StructureTypeId; text: string; signals: string[] }
const mp = (structure: StructureTypeId, text: string, ...signals: string[]): MiniPassage => ({ structure, text, signals });

export const MINI_PASSAGES: MiniPassage[] = [
  mp('chronological', 'First, Dad mixed the flour and eggs. Next, he poured the batter into a pan. Finally, the cake baked in the oven.', 'First', 'Next', 'Finally'),
  mp('chronological', 'First, the seed sank into the soil. Then a tiny root pushed down. Finally, a green shoot reached for the sun.', 'First', 'Then', 'Finally'),
  mp('description', 'A cactus has thick green stems. For example, the stems store water. It also has sharp spines that keep animals away.', 'For example', 'also'),
  mp('description', 'The snowy owl has soft white feathers. It also has large yellow eyes. For example, it can spot a mouse in the dark.', 'also', 'For example'),
  mp('cause-effect', 'Heavy snow fell all night. Because of the snow, the school closed. As a result, kids built snowmen in the yard.', 'Because', 'As a result'),
  mp('cause-effect', 'The pond dried up in the hot summer. So the frogs moved to the river. Therefore the pond grew quiet.', 'So', 'Therefore'),
  mp('compare-contrast', 'Frogs have smooth, wet skin. However, toads have bumpy, dry skin. Similarly, both of them eat insects.', 'However', 'Similarly'),
  mp('compare-contrast', 'A bus carries many riders at once. But a bike carries only one rider. Likewise, both of them need roads.', 'But', 'Likewise'),
  mp('problem-solution', 'The class garden kept drying out. To fix this, the class set up a rain barrel. Now the plants get water every day.', 'To fix this'),
  mp('problem-solution', 'Litter piled up at the park. The town solved it by adding more bins. As a result, the grass is clean again.', 'As a result'),
];

/** Which structures each grade has met: a model or practice passage stays in the band. */
export const STRUCTURES_BY_GRADE: Record<number, StructureTypeId[]> = {
  2: ['chronological', 'description'],
  3: ['chronological', 'description', 'cause-effect'],
  4: ['chronological', 'description', 'cause-effect', 'compare-contrast', 'problem-solution'],
};
export const structuresForGrade = (grade: number): StructureTypeId[] =>
  STRUCTURES_BY_GRADE[Math.min(Math.max(grade, 2), 4)];
