/**
 * fast-fact's boss, on the spoken preset (`components/live-activity/boss.ts`): every mode is SAY_OR_SHOW, split per
 * item. An item whose choices can all be said has a key (`factKey`): the learner says a choice (the tutor judges it) or
 * taps it (the activity checks it). An item with a picture or symbol choice, or whose question names its own answer,
 * has no key, gets the gesture assignment, and plays through `show`. The card is `fastFact.card.ts`; this file holds
 * the content check, the items, the ask and key, the levers and the harness play.
 */
import type { FastFactChallenge, FastFactData } from './FastFact';
import { spokenBoss, hasText } from '../../../components/live-activity/boss';
import { fastFactCard, type FastFactMiss } from './fastFact.card';
import { FAST_FACT_LEVERS } from './fastFactLevers';
import { factGiven, factHarnessChoices, factKey, factQuestion, fastFactSpokenMisses, isAnswerCorrect } from './fastFactWorkspace';

const CHALLENGE_TYPES = ['recognize', 'recall', 'apply'];

/** A question with at least two distinct choices, exactly one of which the activity's check credits. */
function answerable(c: FastFactChallenge): boolean {
  const options = Array.isArray(c.options) ? c.options.filter(o => typeof o === 'string' && o.trim()) : [];
  return options.length >= 2 && new Set(options.map(o => o.trim().toLowerCase())).size === options.length
    && typeof c.correctAnswer === 'string' && options.filter(o => isAnswerCorrect(o, c)).length === 1;
}

/** Reject a fast-fact lesson whose challenges cannot be attempted. */
export function validateFastFactData(value: unknown): FastFactData {
  const d = value as FastFactData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || !hasText(c.id) || !CHALLENGE_TYPES.includes(c.challengeType)
        || !c.prompt || typeof c.prompt.text !== 'string' || !factQuestion(c).trim()))
    throw new Error('Generated fast fact has invalid lesson content.');
  for (const c of d.challenges)
    if (!answerable(c)) throw new Error(`A fast-fact ${c.challengeType} challenge cannot be answered as generated.`);
  return d;
}

export const fastFactBoss = spokenBoss<FastFactData, FastFactChallenge, FastFactMiss>({
  card: fastFactCard,
  validate: validateFastFactData,
  items: d => d.challenges,
  levers: FAST_FACT_LEVERS,
  speech: {
    ask: factQuestion,
    // A tap-only item (picture choices, or a question that names its answer) has no key: the activity checks it.
    key: factKey,
    given: factGiven,
    misses: fastFactSpokenMisses,
    say: c => { const { correct, wrong } = factHarnessChoices(c); return { correct, plainWrong: wrong }; },
    modeOf: c => c.challengeType,
    // A tap-only item through its real choice button; the wrong tap is the most telling wrong choice (`fastFactMiss`).
    show: (right, c) => {
      const { correct, wrong } = factHarnessChoices(c);
      return [{ type: 'choose', label: right ? correct : wrong }];
    },
  },
  drive: {
    component: 'primitives/visual-primitives/core/FastFact.tsx',
    instanceId: 'facts',
    defaults: { grade: 'Grade 2', mode: 'recall', topic: 'Addition facts within 20' },
    mounted: '[data-pip-object="workspace"]',
  },
});
