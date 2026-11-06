/**
 * body-workshop's in-item levers (/add-support-tiers; reports qa/eval-reports/body-workshop-levers-2026-11-05.md and
 * body-workshop-fuel-2026-11-05.md). No real-learner evidence yet: the misses are what `judgeBuild` observes. The path
 * IS the answer, so no lever places, lights, orders or names a part of the item's real path.
 *
 * Help (the screen does more; the item is unchanged):
 * - `where_it_breathes` (clue, deliver_oxygen) the habitat at the start of the row shows air or water, and the tutor
 *   reads where the animal is when it breathes. Answers `wrong_breather`.
 * - `how_it_eats` (clue, fuel_the_body) one sentence on what and how the animal eats ("a bird has no teeth; it
 *   swallows hard seeds whole, and tiny stones too"). Answers `not_mashed`, `not_this_animal`.
 * - `animal_fact` (clue) one sentence on what this animal does NOT use for the job. Answers `not_this_animal`.
 * - `no_food_parts` / `no_breath_parts` (layout) the other job's parts leave the bench: they are never on this job's
 *   path for any animal, so removing them says nothing about this one. Answer `food_path` / `breath_part`.
 * - `count_parts` (marks) one empty slot per part of the real path nearest the learner's row: how many, never which.
 * - `show_flow` (legend) every part shows, as pictures, what it takes in and passes on. Every part alike, none marked.
 *   Answers every miss of the mode.
 * Every clue's words are leak-checked against the item's path parts (`answersOf`).
 *
 * Simplify (`easier_animal`, easier): an ungraded practice item: an easy-tier animal of the same task whose real paths
 * share none with the item's, the same goal, and a smaller bench. The full item comes back after it (`practiceLeaks`).
 *
 * Starting positions (`config.difficulty`, the generator's `startLevers`): easy starts with the other job's parts off
 * the bench. A starting lever is drawn and listed as on screen, but it is not a pull and is never recorded as help.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { BODY_ATLAS, jobFor, jobOf } from './bodyAtlas';
import {
  FLOW, PART_NAMES, TOKEN_WORDS, offJobParts, type BodyChallenge, type BodyPart, type BodyTask, type Token,
} from './bodyModel';
import { bodyWorkshopCard } from './bodyWorkshop.card';

export const WHERE_LEVER = 'where_it_breathes';
export const EATS_LEVER = 'how_it_eats';
export const FACT_LEVER = 'animal_fact';
export const NO_FOOD_LEVER = 'no_food_parts';
export const NO_BREATH_LEVER = 'no_breath_parts';
export const COUNT_LEVER = 'count_parts';
export const FLOW_LEVER = 'show_flow';
export const EASIER_LEVER = 'easier_animal';
export const PRACTICE_SUFFIX = '~simpler';
export const PRACTICE_NOTE = 'An easier practice animal, ungraded; the full animal comes back after it.';

/** The lever that takes the other job's parts off the bench, for a task. */
export const offJobLever = (task: BodyTask) => (task === 'deliver_oxygen' ? NO_FOOD_LEVER : NO_BREATH_LEVER);

export const isPracticeBody = (c: Pick<BodyChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
export const practiceParentId = (id: string | null | undefined) =>
  id?.endsWith(PRACTICE_SUFFIX) ? id.slice(0, -PRACTICE_SUFFIX.length) : null;

/** What the levers read from the screen: the learner's row. */
export interface BodyLeverContext { build: readonly BodyPart[] }

const realPaths = (c: Pick<BodyChallenge, 'animal' | 'goal' | 'type'>) => jobFor(c.animal, c.type)?.paths[c.goal] ?? [];
/** The parts on the item's real paths: no clue may name one. */
export const pathParts = (c: BodyChallenge): BodyPart[] => Array.from(new Set(realPaths(c).flat()));

/** The bench the learner sees: the other job's parts leave it while its lever is on. */
export function benchShown(c: BodyChallenge, on: readonly string[]): BodyPart[] {
  return on.includes(offJobLever(c.type)) ? c.bench.filter(p => !offJobParts(c.type).includes(p)) : c.bench;
}

/** `count_parts`: the length of the real path nearest the learner's row (most parts in common, then the shortest). */
export function partsCount(c: BodyChallenge, build: readonly BodyPart[]): number {
  const paths = realPaths(c);
  if (!paths.length) return 0;
  const score = (p: readonly BodyPart[]) => p.filter(x => build.includes(x)).length;
  return [...paths].sort((a, b) => score(b) - score(a) || a.length - b.length)[0].length;
}

// ── easier_animal (simplify) ───────────────────────────────────────────────

const sameSeq = (a: readonly BodyPart[], b: readonly BodyPart[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Leak rule: never the item's animal or id, and none of the practice animal's real paths is one of the item's. */
export function practiceLeaks(p: BodyChallenge, c: BodyChallenge): boolean {
  return p.animal === c.animal || p.id === c.id || p.type !== c.type
    || realPaths(p).some(pp => realPaths(c).some(cp => sameSeq(pp, cp)));
}

/**
 * The practice item: an easy-tier animal of the same task ≠ the item's, whose paths share none with it (so none for a
 * food item whose path is the plain mouth, stomach, intestines every easy animal shares), preferring
 * one that starts from the same thing and then one whose path is no longer than the item's; its bench is its first
 * real path plus two parts from the item's bench that are not the other job's and not on that path. Null on a
 * practice item, or when none fits.
 */
export function practiceBody(c: BodyChallenge | null | undefined): BodyChallenge | null {
  if (!c || isPracticeBody(c)) return null;
  const own = jobFor(c.animal, c.type);
  const ownAnimal = BODY_ATLAS.find(a => a.id === c.animal);
  if (!own || !ownAnimal) return null;
  const longest = Math.max(...own.paths[c.goal].map(p => p.length));
  const candidates = BODY_ATLAS.filter(a => a.id !== c.animal && jobOf(a, c.type)?.tier === 'easy');
  const medium = (id: string) => (c.type === 'fuel_the_body' ? 'outside_food' : BODY_ATLAS.find(a => a.id === id)!.medium);
  const rank = (id: string) => (medium(id) === c.medium ? 0 : 2) + (jobOf(BODY_ATLAS.find(a => a.id === id)!, c.type)!.paths[c.goal][0].length <= longest ? 0 : 1);
  for (const a of [...candidates].sort((x, y) => rank(x.id) - rank(y.id))) {
    const job = jobOf(a, c.type)!;
    const path = job.paths[c.goal][0];
    const extra = c.bench.filter(p => !offJobParts(c.type).includes(p) && !path.includes(p)).slice(0, 2);
    const p: BodyChallenge = {
      ...c, id: `${c.id}${PRACTICE_SUFFIX}`, animal: a.id, name: a.name, emoji: a.emoji, habitat: a.habitat,
      medium: medium(a.id), muscle: a.muscle, intro: a.intro, principle: job.principle[c.goal], jobs: job.jobs,
      ...(job.food ? { food: job.food } : {}),
      instruction: c.instruction.split(c.name).join(a.name).split(ownAnimal.muscle).join(a.muscle),
      bench: [...path, ...extra].sort((x, y) => c.bench.indexOf(x) - c.bench.indexOf(y)), startLevers: [],
    };
    if (!practiceLeaks(p, c)) return p;
  }
  return null;
}

/** "air → oxygen in the blood" for one part, in kid words. */
export function flowWords(p: BodyPart): string {
  return Object.entries(FLOW[p]).map(([i, o]) => `${TOKEN_WORDS[i as Token]} → ${TOKEN_WORDS[o as Token]}`).join(', ');
}

// ── The set ────────────────────────────────────────────────────────────────

/** The misses where the path itself broke: what each part takes in and passes on answers them. */
const FLOW_MISSES: readonly string[] = ['food_path', 'breath_part', 'no_way_in', 'wrong_breather', 'not_mashed', 'no_pump', 'stops_short', 'blocked'];
const OXYGEN = ['deliver_oxygen'];
const FUEL = ['fuel_the_body'];
const MISSES = bodyWorkshopCard.modes;

export const BODY_LEVERS = leverSet<BodyChallenge, BodyLeverContext>({
  modeOf: c => c.type,
  missesOf: mode => MISSES[mode as BodyTask]?.misses ?? [],
  // A clue never names a part of the item's real path.
  answersOf: c => pathParts(c).map(p => PART_NAMES[p]),
  specs: [
    { id: WHERE_LEVER, type: 'clue', modes: OXYGEN, answers: ['wrong_breather'],
      when: 'The learner gave lungs water or gills air, or seems unsure whether this animal breathes air or water.',
      does: 'The habitat at the start of the row shows whether this animal takes its breath from the air or the water, '
        + 'and one sentence says where it is when it breathes. No body part is named.',
      offer: c => !isPracticeBody(c),
      content: c => jobFor(c.animal, c.type)?.clue ?? null,
      fact: (sentence: string) => `The start of the row now shows where the breath comes from: ${sentence}` },
    { id: EATS_LEVER, type: 'clue', modes: FUEL, answers: ['not_mashed', 'not_this_animal'],
      when: 'The learner skipped mashing the food, or used a part this animal does not eat with.',
      does: 'One sentence under the animal says what it eats and how (chews, gulps, swallows whole). No body part is named.',
      offer: c => !isPracticeBody(c),
      content: c => jobFor(c.animal, c.type)?.clue ?? null,
      fact: (sentence: string) => `Under the animal: ${sentence}` },
    { id: FACT_LEVER, type: 'clue', answers: ['not_this_animal'],
      when: 'The learner built a path that works but uses a part this animal does not use for this job.',
      does: 'One sentence under the animal says what this animal does NOT have for this job. It never names a part it uses.',
      offer: c => !isPracticeBody(c),
      content: c => jobFor(c.animal, c.type)?.hasNo ?? null,
      fact: (sentence: string) => `Under the animal: ${sentence}` },
    { id: NO_FOOD_LEVER, type: 'layout', modes: OXYGEN, answers: ['food_path'],
      when: 'The learner put a food part (stomach, intestines) in the breath\'s path.',
      does: 'The food parts leave the bench (they carry food, never a breath, in every animal).',
      offer: c => !isPracticeBody(c) && c.bench.some(p => offJobParts(c.type).includes(p)),
      fact: 'The food parts are off the bench: they never carry a breath.' },
    { id: NO_BREATH_LEVER, type: 'layout', modes: FUEL, answers: ['breath_part'],
      when: 'The learner put a breathing part (nose, windpipe, lungs) in the food\'s path.',
      does: 'The breathing parts leave the bench (they carry air, never food, in every animal).',
      offer: c => !isPracticeBody(c) && c.bench.some(p => offJobParts(c.type).includes(p)),
      fact: 'The breathing parts are off the bench: they never carry food.' },
    { id: COUNT_LEVER, type: 'marks', answers: ['skips_a_part', 'stops_short'],
      when: 'The learner left a part out, or the path stops before the goal.',
      does: 'The row shows one empty slot for each part the path needs, and no more. Which parts is still the learner\'s.',
      offer: c => !isPracticeBody(c),
      content: (c, ctx) => partsCount(c, ctx.build) || null,
      fact: (n: number) => `The row shows ${n} slot${n === 1 ? '' : 's'}: the path needs ${n} part${n === 1 ? '' : 's'}.` },
    { id: FLOW_LEVER, type: 'legend', answers: FLOW_MISSES,
      answersOn: c => MISSES[c.type].misses.filter(m => FLOW_MISSES.includes(m)),
      when: 'The path stopped at a part that cannot take what reached it, or the learner does not know what a part does.',
      does: 'Every part, on the bench and in the row, shows pictures of what it takes in and what it passes on '
        + '(air, water, food, mashed food, blood). Every part alike, none marked.',
      offer: c => !isPracticeBody(c),
      fact: (_on: unknown, c: BodyChallenge) => 'Every part shows what it takes in and passes on: '
        + c.bench.slice(0, 6).map(p => `${PART_NAMES[p]}: ${flowWords(p)}`).join('; ')
        + '; and the same for every other part on the bench.' },
    { id: EASIER_LEVER, type: 'easier', answers: ['not_this_animal', 'skips_a_part', 'stops_short', 'blocked'],
      when: 'The learner cannot build this animal\'s path yet, even with the pictures.',
      does: 'Opens an easier practice animal first (a familiar one, with fewer parts on the bench). It is not graded; '
        + 'the full animal comes back after it.',
      content: c => practiceBody(c) },
  ],
});
