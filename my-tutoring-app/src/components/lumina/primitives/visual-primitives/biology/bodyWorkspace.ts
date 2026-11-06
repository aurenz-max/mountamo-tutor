/**
 * Body Workshop's scene on the shared tutor/JEV teaching workspace. Every item is a build the activity checks, so no
 * key reaches the tutor. The scene says what is drawn: the animal and where it lives, the goal, the bench parts by what
 * they look like, the row the learner has built, and what each try did. Never which parts belong, never whether the
 * animal breathes air or water (that is what the learner works out), and the jobs only once the path works.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import {
  HABITAT_WORDS, PART_LOOKS, PART_NAMES, TASK_NOUN, TASK_STUFF, TASK_VERB, describeBuild, goalWords, type BodyChallenge,
  type BodyPart,
} from './bodyModel';

export interface BodyTry { build: BodyPart[]; why: string; correct: boolean }

export interface BodyView {
  build: readonly BodyPart[];
  tries: readonly BodyTry[];
  running: boolean;
  solved: boolean;
}

export function bodyScene(c: BodyChallenge, view: BodyView): SceneOf {
  const fuel = c.type === 'fuel_the_body';
  const noun = TASK_NOUN[c.type];
  const start = fuel ? `the ${c.name}'s food (${c.food ?? 'food'})` : `a picture of where the ${c.name} lives (${HABITAT_WORDS[c.habitat].toLowerCase()})`;
  const facts: Record<string, string | number> = {
    board: `one row, left to right: ${start}, then the body parts the learner has tapped in, then the goal `
      + `(${c.goal === 'to_muscle' ? `the ${c.muscle}` : 'the blood'}). A bench of picture buttons sits under it; tapping a `
      + 'part in the row takes it out.',
    animal: `${c.name} (${HABITAT_WORDS[c.habitat].toLowerCase()}): ${c.intro}`,
    goal: fuel ? `get the food the ${c.name} eats ${goalWords(c)}, where it can be used for energy`
      : `get oxygen from where the ${c.name} lives ${goalWords(c)}`,
    bench: c.bench.map(p => `${PART_NAMES[p]} (${PART_LOOKS[p]})`).join('; ').slice(0, 500),
    built: describeBuild(c, view.build),
    step: view.running ? `the ${noun} is moving along the row` : view.solved ? 'the path works' : view.tries.length ? 'trying ideas' : 'not started',
    tries: view.tries.length
      ? view.tries.map((t, i) => `try ${i + 1}: ${t.build.map(p => PART_NAMES[p]).join(' → ') || 'nothing'}: ${t.why}`).join('; ').slice(0, 500)
      : 'none yet',
    constraints: `${TASK_VERB[c.type]} sends the ${noun} along the row and shows where it stops and why (the ${TASK_STUFF[c.type]} `
      + 'changes as it goes); it can be pressed any number of times. "I\'m done!" checks the path.',
  };
  if (view.solved) {
    facts.howItWorks = c.principle;
    facts.jobs = view.build.map(p => `${PART_NAMES[p]}: ${c.jobs[p] ?? ''}`).join('; ').slice(0, 500);
  }
  return { objects: [], facts };
}
