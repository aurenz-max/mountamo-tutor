import type { DiPortAdapter } from './diDrivePlan';
import { rampExplanationPack, type RampExplanationItem } from '../../../primitives/visual-primitives/engineering/rampExplanationScript';
import { measureRampTrial, selectRampChallenges, type RampInvestigationChallenge } from '../../../primitives/visual-primitives/engineering/rampChallenges';

function build(challenges: RampInvestigationChallenge[]) {
  const jobs = challenges.filter(ch => ch.mode === 'explain_from_trials');
  const packs = jobs.map(ch => rampExplanationPack(ch, [measureRampTrial('a', ch.scenarios.a), measureRampTrial('b', ch.scenarios.b)]));
  const items = packs.flatMap(p => p.items);
  const fallback = packs[0] ?? rampExplanationPack(selectRampChallenges(['explain_from_trials'], 1)[0] as RampInvestigationChallenge, []);
  const packFor = (item: RampExplanationItem) => rampExplanationPack(item.challenge, item.trials);
  return { items, dropped: jobs.length - items.length, surface: { ...fallback, items,
    itemCue: (item: RampExplanationItem, opts: Parameters<typeof fallback.itemCue>[1]) => packFor(item).itemCue(item, opts),
    pronounceCue: (item: RampExplanationItem) => packFor(item).pronounceCue!(item),
    contextFor: (item: RampExplanationItem) => packFor(item).contextFor(item),
  } };
}

/** Semantic drive only: records match the code-owned bench, not physical mic input. */
export const rampLabAdapter: DiPortAdapter<RampExplanationItem> = {
  build: data => build((data.challenges ?? []) as RampInvestigationChallenge[]),
  benchBuild: () => build((['surface', 'angle', 'mass'] as const).map(variable => selectRampChallenges(['explain_from_trials'], 1, variable)[0] as RampInvestigationChallenge)),
  answersFor: item => {
    const [a, b] = item.trials;
    const less = a.firstMovingForce < b.firstMovingForce ? 'A' : 'B';
    const more = less === 'A' ? 'B' : 'A';
    const variable = item.challenge.variable === 'mass' ? 'box mass' : item.challenge.variable;
    const correct = `Changing the ${variable} changed the push: setup A moved at ${a.firstMovingForce} newtons and setup B at ${b.firstMovingForce} newtons, so ${less} needed less push.`;
    const wrong = `Setup ${more} needed less push than setup ${less}.`;
    return { correct, plainWrong: wrong, signatureWrong: { text: 'Ramps make work easier.', why: 'No comparison of the actual trial records.' },
      leakTokens: ['needed less push', 'needed more push'],
      probes: [
        { text: correct, bucket: 'valid-canonical', expect: 'affirm', why: 'Changed condition and both recorded results.' },
        { text: `When we changed the ${variable}, ${more} took more push than ${less}.`, bucket: 'valid-paraphrase', expect: 'affirm', why: 'True qualitative comparison is allowed.' },
        { text: wrong, bucket: 'wrong-verdict', expect: 'refuse', why: 'Reversed evidence.' },
        { text: `A moved at ${a.firstMovingForce + 10} newtons and B at ${b.firstMovingForce} newtons, so ${less} needed less push.`, bucket: 'wrong-number', expect: 'refuse', why: 'Correct conclusion with fabricated measurement.' },
        { text: `Setup A moved at ${a.firstMovingForce} newtons.`, bucket: 'answer-not-explanation', expect: 'refuse', why: 'Only one observation, no comparison.' },
        { text: 'Ramps make work easier.', bucket: 'adjacent-concept', expect: 'refuse', why: 'General slogan does not use the records.' },
        { text: 'What did changing the condition do to the push?', bucket: 'echo', expect: 'refuse', why: 'Echo without an explanation.' },
        { text: 'I like pizza.', bucket: 'off-task', expect: 'refuse', why: 'Unrelated to the investigation.' },
      ],
    };
  },
};
