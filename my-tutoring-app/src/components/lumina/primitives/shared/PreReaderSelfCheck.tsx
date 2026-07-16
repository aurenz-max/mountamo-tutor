'use client';

/**
 * PreReaderSelfCheck — the shared PRE (kindergarten) treatment for the
 * "text-primary explainer with a text-option check" family: foundation-explorer,
 * concept-card-grid, comparison-panel, fact-file, flashcard-deck, media-player.
 *
 * Every one of these primitives teaches with prose, then gates a section behind a
 * small multiple-choice self-check whose OPTIONS are full text phrases — unreadable
 * (and sometimes answer-leaking) to a non-reader. deep-dive's MultipleChoiceBlock and
 * knowledge-check's MultipleChoiceProblem each solved this bespoke; this factors the
 * shared shape out so the sweep is one pattern, not six re-implementations.
 *
 * The PRE contract (reader-fit band rules) this enforces for a self-check:
 *  - Rule 1 (audio is the channel): the question + EVERY option are read aloud —
 *    automatically on first view (IntersectionObserver, once) and on 🔊 replay.
 *  - Rule 2 (tap = choose): one tap commits; no select-then-Check.
 *  - Rule 3 (pictures are the answer surface): options render emoji-primary; the
 *    text phrase is a caption the tutor voices.
 *  - Rule 5 (feedback on the touched object): a wrong tap marks THAT tile and
 *    disables it (eliminate-until-correct — gentlest for K, no forced answer reveal),
 *    plus an eyes-free spoken hint. No transient error prose.
 *
 * The read-aloud SCRIPT is supplied by the parent (only the parent knows the section
 * prose to read first) and enacted by a catalog PRE-READER READ-ALOUD aiDirective, so
 * it survives the lesson-mode one-sentence cap. `buildSelfCheckReadAloud` builds the
 * standard "read the question + every option" body for parents with no extra prose.
 */

import React, { useEffect, useRef } from 'react';
import {
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  LuminaReadAloud,
  type AnswerChoiceState,
  type LuminaAccent,
} from '../../ui';
import { SoundManager } from '../../utils/SoundManager';

/**
 * Fire `onRead` exactly once, when `el` first scrolls ≥40% into view. Primitives
 * in this family stack many sections in one scroll, so mount-time firing would read
 * every check at once — the observer defers each to when the child actually reaches it.
 */
export function useAutoReadOnView<T extends HTMLElement = HTMLDivElement>(
  enabled: boolean,
  onRead: () => void,
): React.MutableRefObject<T | null> {
  const ref = useRef<T | null>(null);
  const firedRef = useRef(false);
  // Keep the latest callback without re-arming the observer each render.
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  useEffect(() => {
    if (!enabled || firedRef.current) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !firedRef.current) {
          firedRef.current = true;
          onReadRef.current();
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}

/**
 * Standard spoken STIMULUS body for a self-check: read the question, then every
 * option slowly with its letter, then ask which the child picks. Answer-free —
 * never name or hint the correct option here. Prepend `intro` to read section prose
 * (a definition, a fact) before the question.
 */
export function buildSelfCheckReadAloud(opts: {
  question: string;
  options: string[];
  tag?: string;
  intro?: string;
  label?: string;
}): string {
  const { question, options, tag = '[SELFCHECK_READ_ALOUD]', intro, label } = opts;
  const choices = options
    .map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`)
    .join('; ');
  return (
    `${tag} A pre-reader is on the ${label ? `"${label}" ` : ''}self-check and cannot read it. `
    + (intro ? `First, read this to them slowly: "${intro}". Then ` : 'Read the ')
    + `question aloud word for word, then each choice slowly with its letter, then ask which one they pick. `
    + `Question: "${question}". Choices: ${choices}.`
  );
}

export interface PreReaderSelfCheckProps {
  question: string;
  /** Text phrases — captions the tutor voices; the emoji is the answer surface. */
  options: string[];
  /** One depicting emoji per option. Missing ones fall back to ⭐. */
  optionEmojis?: string[];
  correctIndex: number;
  /** Display order as original indices (deterministic shuffle). Defaults to identity. */
  optionOrder?: number[];
  /** Shown in the feedback card once resolved. */
  explanation?: string;
  /** Spoken (never shown) on a wrong tap. Answer-free. */
  hint?: string;
  /** Parent-owned completion — a re-visited, already-passed check renders resolved. */
  mastered?: boolean;
  /** The full read-aloud script (parent builds it; see buildSelfCheckReadAloud). */
  readAloudMessage: string;
  /** Tag the catalog RETRY directive keys on. */
  retryTag?: string;
  /** Auto-read on first view. Default true. */
  autoRead?: boolean;
  accent?: LuminaAccent;
  /** Non-silent at PRE: the read-aloud IS the tutor turn. */
  onAskTutor: (msg: string) => void;
  /** Fires once per resolution with the outcome + attempt count. */
  onResult: (correct: boolean, attempts: number) => void;
  className?: string;
}

/**
 * A single PRE self-check: emoji-primary option grid, tap = choose, auto-read + 🔊
 * replay, feedback on the touched tile. Orchestration (which section, advance,
 * scoring) stays with the parent — this owns one check's render + interaction only.
 */
export const PreReaderSelfCheck: React.FC<PreReaderSelfCheckProps> = ({
  question,
  options,
  optionEmojis,
  correctIndex,
  optionOrder,
  explanation,
  hint,
  mastered = false,
  readAloudMessage,
  retryTag = '[SELFCHECK_RETRY]',
  autoRead = true,
  accent = 'amber',
  onAskTutor,
  onResult,
  className,
}) => {
  const [wrongPicks, setWrongPicks] = React.useState<number[]>([]);
  const [resolved, setResolved] = React.useState(mastered);
  const [attempts, setAttempts] = React.useState(0);
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;

  const containerRef = useAutoReadOnView<HTMLDivElement>(
    autoRead && !mastered,
    () => onAskTutor(readAloudMessage),
  );

  const order = optionOrder && optionOrder.length === options.length
    ? optionOrder
    : options.map((_, i) => i);

  const handleChoose = (originalIndex: number) => {
    if (resolvedRef.current || wrongPicks.includes(originalIndex)) return;
    const next = attempts + 1;
    setAttempts(next);

    if (originalIndex === correctIndex) {
      SoundManager.playCorrect();
      setResolved(true);
      onResult(true, next);
    } else {
      SoundManager.playIncorrect();
      setWrongPicks((prev) => [...prev, originalIndex]);
      // Eyes-free RECOVER beat — narrow it down, never reveal the answer.
      onAskTutor(
        `${retryTag} The pre-reader tapped "${options[originalIndex]}" on the question `
        + `"${question}" — not correct. Give ONE warm spoken hint`
        + (hint ? ` (you can lean on: "${hint}")` : '')
        + `, without revealing the answer, and invite them to tap another picture.`,
      );
    }
  };

  const stateFor = (originalIndex: number): AnswerChoiceState => {
    if (resolved) return originalIndex === correctIndex ? 'correct' : 'dimmed';
    if (wrongPicks.includes(originalIndex)) return 'incorrect';
    return 'idle';
  };

  return (
    <div ref={containerRef} className={className}>
      <div className="flex items-start gap-3">
        <p className="flex-1 text-lg font-medium leading-relaxed text-slate-100">{question}</p>
        <LuminaReadAloud
          iconOnly
          size="md"
          accent="cyan"
          aria-label="Hear the question again"
          className="flex-shrink-0"
          onClick={() => {
            SoundManager.tap();
            onAskTutor(readAloudMessage);
          }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {order.map((originalIndex) => {
          const state = stateFor(originalIndex);
          return (
            <LuminaAnswerChoice
              key={originalIndex}
              state={state}
              disabled={resolved || wrongPicks.includes(originalIndex)}
              onClick={() => handleChoose(originalIndex)}
              className="flex min-h-[7rem] flex-col items-center justify-center gap-2 p-5 text-center"
            >
              <span className="text-5xl leading-none" aria-hidden>
                {optionEmojis?.[originalIndex] || '⭐'}
              </span>
              <span className="text-base text-slate-100">{options[originalIndex]}</span>
            </LuminaAnswerChoice>
          );
        })}
      </div>

      {resolved && explanation && (
        <LuminaFeedbackCard status="correct" label="🎉 You did it!" className="mt-4">
          {explanation}
        </LuminaFeedbackCard>
      )}
    </div>
  );
};

export default PreReaderSelfCheck;
