import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../../service/geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));
import { ai } from '../../service/geminiClient';
import { distillLearningObservation } from './distillLearningObservation';
import { eligibleLearningResponses, type LearningResponseEvidence } from '../learningResponseEvidence';

const row = (itemId: string, patch: Partial<LearningResponseEvidence> = {}): LearningResponseEvidence => ({
  itemId, phase: 'say_value', challenge: 'Say the value of the highlighted digit', expected: 'forty', observed: 'forty',
  verdict: 'affirmed', source: 'voice', priorCorrections: 0, hearTapsSoFar: 0, support: 'Other assistance unknown', ...patch,
});
const draft = { abstain: false, kind: 'strength', summary: 'The recorded responses suggest success saying digit values in these tasks.',
  teachingImplication: 'Offer another value task.', checkNext: 'Check a fresh response without correction.', evidenceItemIds: ['a', 'b'] };
beforeEach(() => vi.clearAllMocks());
it('abstains before calling the LLM on score-only, absent, mixed-phase, or repeated same-item success', async () => {
  for (const input of [null, { score: 100 }, [row('a')], [row('a'), row('a')], [row('a'), row('b', { observed: '' })],
    [row('a'), row('b', { phase: 'find_place' })], [row('a', { verdict: 'corrected' }), row('b')]]) {
    expect((await distillLearningObservation(input)).abstain).toBe(true);
  }
  expect(ai.models.generateContent).not.toHaveBeenCalled();
});
it('keeps corrected evidence alongside successes and rejects unsupported or cross-phase citations', async () => {
  const rows = [row('a', { verdict: 'corrected', observed: 'four' }), row('a', { priorCorrections: 1 }), row('b'), row('c', { phase: 'find_place' })];
  expect(eligibleLearningResponses(rows)).toHaveLength(4);
  for (const patch of [{ evidenceItemIds: ['a', 'invented'] }, { evidenceItemIds: ['a', 'c'] }, { kind: 'support' }, { abstain: 'false' }]) {
    vi.mocked(ai.models.generateContent).mockResolvedValue({ text: JSON.stringify({ ...draft, ...patch }) } as never);
    expect((await distillLearningObservation(rows)).abstain).toBe(true);
  }
});
it('returns a bounded evidence-linked strength or supported-success draft and honestly abstains on model failure', async () => {
  vi.mocked(ai.models.generateContent).mockResolvedValue({ text: JSON.stringify(draft) } as never);
  expect(await distillLearningObservation([row('a'), row('b')])).toEqual(draft);
  vi.mocked(ai.models.generateContent).mockResolvedValue({ text: JSON.stringify({ ...draft, kind: 'support' }) } as never);
  expect(await distillLearningObservation([row('a', { priorCorrections: 1 }), row('b', { priorCorrections: 2 })])).toMatchObject({ abstain: false, kind: 'support' });
  vi.mocked(ai.models.generateContent).mockRejectedValue(new Error('offline'));
  expect((await distillLearningObservation([row('a'), row('b')])).abstain).toBe(true);
});
