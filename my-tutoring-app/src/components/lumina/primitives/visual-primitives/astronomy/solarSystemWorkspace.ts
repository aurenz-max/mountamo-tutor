/**
 * Solar system explorer on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C5). Its only teaching path for challenges: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path). A payload with no askable challenge
 * stays the ungraded free-exploration orrery.
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken planet name, computed in code from the bodies on screen. Tapping a body is looking (it
 * opens the body's card where the band allows one); it never answers.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { askFor, isPairFacet, solarHarnessAnswers, type SolarItem } from './solarSystemScript';

export function solarAssignment(item: SolarItem): TeachingAssignment {
  const signature = item.signatureName ? ` "${item.signatureName}" is not it.` : '';
  const expectedAnswer = item.kind === 'classify'
    ? `Any one of: ${item.answerNames.join(', ')}.${signature} The kind's label with no planet name, or the Sun, is not it.`
    : `${item.answerNames[0]}. The name alone or inside a phrase counts.${signature} The Sun, a colour or "that one" with no name is not it.`;
  const misses = solarSpokenMisses(item);
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer, ...(misses.length ? { misses } : {}) };
}

/** What a wrong spoken name shows (handoff 20 Part B). */
export type SpokenSolarMiss = 'said_sun' | 'neighbour_planet' | 'signature_planet' | 'other_planet';

/** How each facet's signature wrong name relates to the answer, stated as a fact the listener cannot see. */
const SIGNATURE_FACT: Partial<Record<string, (sig: string, answer: string) => string>> = {
  smallest: sig => `${sig} looks tiny but is a dwarf planet or a runner-up, not the smallest true planet.`,
  hottest: sig => `${sig} is the planet closest to the Sun, but it is not the hottest.`,
};

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: the Sun (a star, not a
 * planet); the facet's signature name (the next planet on identify, `hottestTrap` closest planet...); any other
 * planet name. Concrete per item: the names computed from the bodies on screen.
 */
export function solarSpokenMisses(item: SolarItem): KnownMiss[] {
  const answer = item.kind === 'classify' ? item.answerNames.join(', ') : item.answerNames[0];
  const fact = item.kind === 'classify' ? `The right answers are ${answer}.` : `The right answer is ${answer}.`;
  const sig = item.signatureName && item.signatureName !== 'Sun' && !item.answerNames.includes(item.signatureName) ? item.signatureName : undefined;
  const wrong = item.wrongName && item.wrongName !== sig && item.wrongName !== 'Sun' && !item.answerNames.includes(item.wrongName) ? item.wrongName : undefined;
  const sigFact = !sig ? '' : item.kind === 'identify' ? ''
    : item.facet === 'hottest' && !item.hottestTrap ? '' : SIGNATURE_FACT[item.facet] ? ` ${SIGNATURE_FACT[item.facet]!(sig, answer)}` : '';
  return [
    { id: 'said_sun', pattern: `${fact} The learner's answer is the Sun, which is a star, not a planet.`, examples: ['the Sun'] },
    ...(sig ? [{ id: item.kind === 'identify' ? 'neighbour_planet' : 'signature_planet', pattern: item.kind === 'identify' ? `The glowing planet is ${answer}. The learner's answer is ${sig}, the planet next to ${answer}.`
      : `${fact}${sigFact} The learner's answer is ${sig}.`, examples: [sig] }] : []),
    { id: 'other_planet', pattern: `${fact} The learner's answer names a different planet${sig ? ` (not ${sig})` : ''}.`, examples: wrong ? [wrong] : [] },
  ];
}

export function solarScene(item: SolarItem, view: { preReader: boolean }): WorkspaceScene {
  const facts: Record<string, string> = {
    shown: item.kind === 'identify' ? 'The solar system model. One planet glows bright; while this question is open no planet wears its name.'
      : isPairFacet(item.facet) ? `The solar system model, with ${item.pairNames.join(' and ')} glowing together.`
        : `The solar system model: the Sun and ${item.planetCount} planets, each on its own ring.`,
  };
  facts.constraints = 'The learner says a planet name out loud. Tapping a planet is looking, never an answer'
    + (view.preReader || item.kind === 'identify' ? '; no body card opens on this item' : '; it opens that body\'s card')
    + '. You cannot move or mark the planets.';
  return { objects: [], facts };
}

/** The journey's answers: the code-computed name, or a confidently wrong one on screen. */
export function solarJourneyAnswers(item: SolarItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = solarHarnessAnswers(item);
  return { correct, plainWrong };
}
