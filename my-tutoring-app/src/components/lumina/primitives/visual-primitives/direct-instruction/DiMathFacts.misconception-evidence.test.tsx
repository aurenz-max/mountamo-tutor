// @vitest-environment jsdom
/**
 * Misconception Loop S1 — does a wrong DI answer produce diagnosable evidence?
 *
 * BEFORE THIS SLICE a child who answered wrong produced `{correct: false,
 * score: 0}` and nothing else: the component dropped `attempt-transcript.text`
 * (what the CHILD said) and the engine dropped the tutor's judging sentence
 * (what the JUDGE said about it). The session under test is the artifact that
 * was impossible — a child who answers every subtraction fact with the
 * SUCCESSOR of the first number, twice on the same item, which is a textbook
 * diagnosable misconception rather than a slip.
 *
 * The two claims that matter:
 *  1. **Tier A, not Tier B.** `judgeFeedback` present ⇒ 'judge'. If it comes
 *     back 'structured', the engine half did not land — so the non-vacuity
 *     test drives the identical session with the engine field absent and pins
 *     that the tier really does drop.
 *  2. **`priorAttempts` holds the earlier miss.** That is the consistency
 *     signal the distiller needs to call a mental model rather than a one-off.
 *
 * And one invariant that is a safety property in this family specifically:
 * none of it reaches the student. A stray write to a status line here would be
 * SPOKEN ALOUD by the live tutor.
 */
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LoopEmission } from '../../../hooks/judgedLoopModel';
import {
  classifyEvidenceTier,
  type DiagnosisEvidence,
} from '../../../evaluation/diagnosis/types';

// ── Live context: a mutable bag so a test can drive the audio edge ──────────
const ctxState = {
  isConnected: true,
  isListening: true,
  isAudioPlaying: true,
  sessionMode: 'standalone' as const,
};
vi.mock('@/contexts/LuminaAIContext', () => ({
  // 19b: the mic level is a SUBSCRIPTION now, not a context field. Stubbed
  // flat because nothing here asserts on the orb's spike ring.
  useMicLevel: () => 0,
  useLuminaAIContext: () => ({
    ...ctxState,
    connect: vi.fn(), disconnect: vi.fn(),
    startListening: vi.fn(), stopListening: vi.fn(),
    updateContext: vi.fn(),
  }),
}));

const submitResult = vi.fn();
vi.mock('../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult, hasSubmitted: false, submittedResult: null,
    elapsedMs: 0, resetAttempt: vi.fn(),
  }),
  useEvaluationContext: () => null,
}));

let emit: (e: LoopEmission) => void = () => {};
vi.mock('../../../hooks/useJudgedSpeechLoop', () => ({
  useJudgedSpeechLoop: (options: { onEmission?: (e: LoopEmission) => void }) => {
    emit = (e) => options.onEmission?.(e);
    return {
      voiceTurns: { isVoiceActive: () => false, reset: vi.fn() },
      queueCue: vi.fn(), sendCueNow: vi.fn(), clearQueuedCue: vi.fn(),
      arm: vi.fn(), disarm: vi.fn(), reset: vi.fn(),
      isAwaitingJudgment: () => false,
      config: {},
    };
  },
}));

import { DiMathFacts } from './DiMathFacts';
import type { DiMathFactsChallenge } from './diMathFactsScript';

/** Two take-away facts. The child returns the SUCCESSOR of the first number
 *  on both — counting up where the fact counts back. */
const CHALLENGES: DiMathFactsChallenge[] = [
  {
    id: 'f1', challengeType: 'subtraction_fact', a: 3, b: 1,
    display: '3 - 1', problem: 'three minus one',
    answerWord: 'two', answerNumeral: 2, solvedDisplay: '3 - 1 = 2',
  },
  {
    id: 'f2', challengeType: 'subtraction_fact', a: 5, b: 1,
    display: '5 - 1', problem: 'five minus one',
    answerWord: 'four', answerNumeral: 4, solvedDisplay: '5 - 1 = 4',
  },
];

const renderPack = () => render(
  <DiMathFacts
    data={{
      title: 'Quick Flash Practice',
      description: 'Say your answers out loud',
      challenges: CHALLENGES,
      challengeType: 'subtraction_fact',
      gradeLevel: 'kindergarten',
      instanceId: 'test-di-math-facts-evidence',
    }}
  />,
);

/** The tutor's contrastive corrections, as it would actually speak them. */
const CONTRAST_F1 = 'My turn: not four — three minus one is two. Your turn. What is three minus one?';
const CONTRAST_F2 = 'My turn: not six — five minus one is four. Your turn. What is five minus one?';

/** All the reducer can see before the verdict must fire. Output transcription
 *  streams in sub-word chunks, so the classification lands on the chunk that
 *  completes the sentinel — never on the part that names the error. */
const OPENER = { affirmed: 'Yes', corrected: 'My turn' } as const;

interface AnswerOptions {
  /** The tutor's COMPLETE judging line, delivered by 'verdict-text' once its
   *  audio falls. `null` models the line not completing before the run ends —
   *  a capped correction on the final item submits synchronously, mid-line. */
  fullLine?: string | null;
  /** false ⇒ the engine classifies but discards the sentence, exactly as it
   *  did before this slice. The non-vacuity lever. */
  engineKeepsText?: boolean;
}

/** One learner turn, in the emission order the runtime produces it. */
const answer = (
  heard: string | null,
  verdict: 'affirmed' | 'corrected',
  { fullLine = null, engineKeepsText = true }: AnswerOptions = {},
) => act(() => {
  emit({ kind: 'attempt-open', attempt: {} } as unknown as LoopEmission);
  if (heard !== null) {
    emit({
      kind: 'attempt-transcript', attempt: {}, text: heard,
      responseMs: 1200, commitLagMs: 930,
    } as unknown as LoopEmission);
  }
  emit({
    kind: 'verdict', judgment: verdict, misses: 0, attempt: {},
    ...(engineKeepsText ? { verdictText: OPENER[verdict] } : {}),
  } as unknown as LoopEmission);
  if (engineKeepsText && fullLine) {
    emit({ kind: 'verdict-text', judgment: verdict, text: fullLine } as LoopEmission);
  }
});

/** Release the reward/move-on beat so the stage reaches the next fact. */
const settleBeat = () => act(() => { vi.advanceTimersByTime(3200); });

/**
 * Drive the whole failing session — the child returns the successor on both
 * facts, three times each, so both items cap out at score 0.
 *
 * Note the final turn: a capped correction on the LAST item calls
 * finishAndSubmit synchronously, so the run ends while the tutor is still
 * mid-sentence and that miss's `verdict-text` never arrives. That is the real
 * shape, not a contrivance, and it is what the same-item fallback exists for.
 */
const driveFailedSession = ({ engineKeepsText = true } = {}) => {
  const view = renderPack();
  answer('four', 'corrected', { fullLine: CONTRAST_F1, engineKeepsText });
  answer('four', 'corrected', { fullLine: CONTRAST_F1, engineKeepsText });
  answer('four', 'corrected', { fullLine: CONTRAST_F1, engineKeepsText });
  settleBeat();
  answer('six', 'corrected', { fullLine: CONTRAST_F2, engineKeepsText });
  answer('six', 'corrected', { fullLine: CONTRAST_F2, engineKeepsText });
  answer('six', 'corrected', { fullLine: null, engineKeepsText });
  return view;
};

/** The 6th positional arg of submitResult — the S1 packet. */
const submittedEvidence = (): DiagnosisEvidence | undefined =>
  submitResult.mock.calls[0]?.[5] as DiagnosisEvidence | undefined;

describe('DiMathFacts — misconception evidence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ctxState.isAudioPlaying = true;
    submitResult.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('ships the packet as submitResult’s 6th arg, with partialCredit left undefined', () => {
    driveFailedSession();
    expect(submitResult).toHaveBeenCalledTimes(1);
    const [success, score, , , partialCredit, evidence] = submitResult.mock.calls[0];
    expect(success).toBe(false);
    expect(score).toBe(0);
    expect(partialCredit).toBeUndefined();
    expect(evidence).toBeDefined();
  });

  it('qualifies as Tier A — the judge already explained the failure', () => {
    driveFailedSession();
    const evidence = submittedEvidence();
    expect(classifyEvidenceTier(evidence)).toBe('judge');
    // The COMPLETE line, not the "My turn" opener the verdict fired on. This
    // is the whole point: the opener carries no diagnosis, "not six — five
    // minus one is four" does.
    expect(evidence?.judgeFeedback).toBe(CONTRAST_F2);
    expect(evidence?.judgeFeedback).toContain('not six');
  });

  it('NON-VACUITY: without the engine field the same session drops to Tier B', () => {
    // If this ever passes as 'judge', the Tier-A claim above is being satisfied
    // by something other than the engine change and the test proves nothing.
    driveFailedSession({ engineKeepsText: false });
    const evidence = submittedEvidence();
    expect(classifyEvidenceTier(evidence)).toBe('structured');
    expect(evidence?.judgeFeedback).toBeUndefined();
    // The structured half still stands on its own — expected + observed.
    expect(evidence?.observed).toContain('six');
    expect(evidence?.expected).toContain('four');
  });

  it('falls back to the same ITEM’s finished line when the run submits mid-sentence', () => {
    // The final turn caps corrections on the last fact, so finishAndSubmit
    // fires before that correction's 'verdict-text' can land. Without the
    // fallback the headline judgeFeedback would be the bare "My turn" opener —
    // a Tier-A packet that names nothing, which is worse than honest Tier B.
    driveFailedSession();
    expect(submittedEvidence()?.judgeFeedback).not.toBe('My turn');
    // …and it must come from the SAME fact, never bleed in from fact 1.
    expect(submittedEvidence()?.judgeFeedback).not.toBe(CONTRAST_F1);
  });

  it('records what the CHILD said, not just that they were wrong', () => {
    driveFailedSession();
    expect(submittedEvidence()?.observed).toBe('Student said: "six".');
  });

  it('priorAttempts holds the earlier misses — “they said four both times”', () => {
    driveFailedSession();
    const priors = submittedEvidence()?.priorAttempts ?? [];
    // 6 corrections total, the last is the headline packet.
    expect(priors).toHaveLength(5);
    // The repeat on ONE item is what separates a mental model from a slip.
    const fourSaidOnFactOne = priors.filter(
      (p) => p.observed.includes('"four"') && p.challenge.includes('3 - 1'),
    );
    expect(fourSaidOnFactOne).toHaveLength(3);
    // Priors carry the judge's words too, so consistency is judge-backed.
    expect(priors[0].observed).toContain(CONTRAST_F1);
  });

  it('names the TASK IDENTITY so a primitive-scoped diagnosis stays self-limiting', () => {
    // The accepted risk of `misconceptionScope: 'primitive'` on a 4-identity
    // pack: "counts up instead of back" is a diagnosis on subtraction and the
    // CORRECT move on counting_next. The summary is the mitigation.
    driveFailedSession();
    const summary = submittedEvidence()?.challengeSummary ?? '';
    expect(summary).toContain('SUBTRACTION');
    expect(summary).toContain('5 - 1');
    expect(summary).not.toContain('counting sequence');
  });

  it('a clean session carries NO packet — abstain by construction', () => {
    renderPack();
    answer('two', 'affirmed', { fullLine: 'Yes, two.' });
    settleBeat();
    answer('four', 'affirmed', { fullLine: 'Yes, four.' });
    expect(submitResult).toHaveBeenCalledTimes(1);
    expect(submittedEvidence()).toBeUndefined();
  });

  it('an affirm never overwrites the previous miss’s judge sentence', () => {
    // 'verdict-text' fires for affirmations too. If the component applied it
    // blindly, a wrong-then-right item would have its diagnosis replaced by
    // "Yes, two." — the miss erased by the recovery that followed it.
    renderPack();
    answer('four', 'corrected', { fullLine: CONTRAST_F1 });
    answer('two', 'affirmed', { fullLine: 'Yes, two.' });
    settleBeat();
    answer('six', 'corrected', { fullLine: CONTRAST_F2 });
    answer('six', 'corrected', { fullLine: CONTRAST_F2 });
    answer('six', 'corrected', { fullLine: null });

    const priors = submittedEvidence()?.priorAttempts ?? [];
    expect(priors[0].observed).toContain(CONTRAST_F1);
    expect(priors[0].observed).not.toContain('Yes, two.');
  });

  it('a stale transcript is never attributed to the next attempt', () => {
    // `attempt-open` clears the heard text. Without that, an attempt whose
    // transcription never lands would inherit the previous answer's words and
    // the packet would quote the child saying something they did not say.
    renderPack();
    answer('four', 'corrected', { fullLine: CONTRAST_F1 });
    answer(null, 'corrected', { fullLine: CONTRAST_F1 });
    answer(null, 'corrected', { fullLine: CONTRAST_F1 });
    settleBeat();
    answer('six', 'corrected', { fullLine: CONTRAST_F2 });
    answer('six', 'corrected', { fullLine: CONTRAST_F2 });
    answer('six', 'corrected', { fullLine: null });

    const priors = submittedEvidence()?.priorAttempts ?? [];
    const untranscribed = priors.filter(
      (p) => p.observed.startsWith('Student answered aloud but no transcript'),
    );
    expect(untranscribed).toHaveLength(2);
    // The lost attempts are still Tier-A: the tutor judged the AUDIO (DI-1).
    expect(untranscribed[0].observed).toContain(CONTRAST_F1);
  });

  it('never puts the packet, or the judge’s words, in front of the student', () => {
    // The one place this could go wrong is uniquely bad in a judged loop: the
    // tutor reads the status line aloud, so a leaked diagnosis would be spoken.
    const view = driveFailedSession();
    const onScreen = view.container.textContent ?? '';
    expect(onScreen).not.toContain('My turn');
    expect(onScreen).not.toContain('not four');
    expect(onScreen).not.toContain('Student said');
  });
});
