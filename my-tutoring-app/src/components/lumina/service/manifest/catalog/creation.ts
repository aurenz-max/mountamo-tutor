/**
 * Creation Catalog - Component definitions for open-ended creation primitives
 *
 * Primitives where the learner makes something with no single right answer, and a judge reads
 * what they made against a goal.
 */

import { ComponentDefinition } from '../../../types';
import { OPEN_BUILDER_MISSES, type OpenBuilderMiss } from '../../../primitives/visual-primitives/creation/openBuilderWorkspace';
import { missLists } from './missLists';

export const CREATION_CATALOG: ComponentDefinition[] = [
  {
    id: 'open-builder',
    description: 'Open-ended block-building studio where young learners BUILD something freely from an unlimited supply of plain toy blocks (small, plank, long, tall, big, triangle, wheel; five colors) to meet a goal set in a scene: a bridge so the car can cross the river, a tower as tall as the giraffe, a house to keep the puppy dry, steps up to a stuck kitten, a castle with two towers, a rocket, a robot, a truck with wheels, a wall to keep the sheep from the flowers. Blocks drop and stack on a side-view board. There is no single right build: a building buddy looks at a picture of the board, says what it notices in the child\'s own build, and when the goal is not met yet asks one question about one part. Teaches engineering design (define the job, build, test, improve), parts of a structure and what they are for, spatial reasoning, and comparing sizes. Perfect for lessons on building and construction, bridges and towers, homes and shelters, engineering design and simple machines. ESSENTIAL for grades K-2 engineering design.',
    constraints: 'Best for grades K-3. Each session is 3 projects, each set in one of the primitive\'s own scenes; the generator picks scenes and words goals from the lesson intent, and the manifest must NOT supply goals, scenes or blocks.',
    affordances: { representation: ['pictorial'], reader: 'emerging', answers: ['build'], role: ['apply'], minutes: 8 },
    supportsEvaluation: true,
    evalModes: [
      {
        evalMode: 'build_to_goal',
        label: 'Build to the goal',
        beta: 0.0,
        scaffoldingMode: 3,
        challengeTypes: ['build_to_goal'],
        description: 'Build freely with blocks so the build does the job the goal names; a building buddy looks at a picture of it',
      },
    ],
    teachingWorkspace: {
      grades: ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
      guidance: 'The check is a building buddy who looks at a picture of the board when the learner presses "I\'m done!". '
        + 'Many different builds meet a goal, so never describe one particular build, never say where blocks go, and '
        + 'never place or name blocks for the learner. The tutor may ask what the goal needs the build to do, talk about '
        + 'what the learner already built, and help them use what the buddy asked.',
      // The buddy's verdict names the miss (`openBuilderModel.ts`).
      misses: missLists<OpenBuilderMiss>({
        build_to_goal: [...OPEN_BUILDER_MISSES],
      }),
    },
  },
];
