'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { ArrowRight, Check, GitBranch, Table2, Image, TrendingUp, X } from 'lucide-react';
import type {
  StepContent,
  AlgebraStepContent,
  KaTeXTransition,
  KaTeXTransitionChallenge,
  StepChallenge,
  TableStepContent,
  DiagramStepContent,
  GraphSketchStepContent,
  CaseSplitStepContent,
} from './types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  type CanvasConfig,
} from '../visual-primitives/math/canvas-2d/coords';
import {
  drawAxes,
  drawCurve,
  drawShadedRegion,
  drawVector,
  drawLabeledPoint,
} from '../visual-primitives/math/canvas-2d/shapes';
import { sampleCurve } from './canvas-2d-sample';
import { SoundManager } from '../../utils/SoundManager';

// ═══════════════════════════════════════════════════════════════════════
// KaTeX Rendering Utilities
// ═══════════════════════════════════════════════════════════════════════

function renderKatex(latex: string, displayMode = true): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return `<span class="text-red-400 font-mono text-sm">${latex}</span>`;
  }
}

/**
 * Render KaTeX inline — for mixed text/math content. Wraps unescaped `$...$`
 * segments as inline math.
 *
 * Conventions (LaTeX-standard):
 *   - `$...$`     → inline math
 *   - `\$`        → literal dollar (currency, prices) — rendered as plain `$`
 *
 * Safety net: if a captured `$...$` segment is implausibly long (>100 chars)
 * we treat it as text, not math. That guards against an upstream lapse where
 * unescaped currency dollars get paired across a sentence (e.g. `$15 ... $2`
 * would otherwise italicize the whole span between them).
 */
const ESCAPED_DOLLAR_PLACEHOLDER = '';
const MAX_INLINE_MATH_LEN = 100;

function renderMixedContent(text: string): string {
  // Protect literal `\$` so the math regex doesn't pair it with a real `$`.
  const protectedText = text.replace(/\\\$/g, ESCAPED_DOLLAR_PLACEHOLDER);

  const parts = protectedText.split(/(\$[^$]+\$)/g);
  return parts
    .map((part) => {
      if (part.startsWith('$') && part.endsWith('$')) {
        if (part.length > MAX_INLINE_MATH_LEN) return part;
        const inner = part.slice(1, -1);
        return renderKatex(inner, false);
      }
      return part;
    })
    .join('')
    .replace(new RegExp(ESCAPED_DOLLAR_PLACEHOLDER, 'g'), '$');
}

const KaTeX: React.FC<{ latex: string; display?: boolean; className?: string }> = ({
  latex,
  display = true,
  className = '',
}) => {
  const html = React.useMemo(() => renderKatex(latex, display), [latex, display]);
  return (
    <span
      className={`text-slate-100 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const MixedContent: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const html = React.useMemo(() => renderMixedContent(text), [text]);
  return (
    <span
      className={`text-slate-300 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Sub-move ↔ parent-expression hover linking (algebra view)
// ═══════════════════════════════════════════════════════════════════════
//
// The algebra generator emits `\htmlClass{lumina-tok lumina-tok-N}{…}` directly
// inside each transition's `from.latex` / `to.latex` (one wrapper per sub-move,
// indexed 0..2). KaTeX renders those as DOM classes; the CSS rule below
// highlights `.lumina-tok-N` whenever its container has `.lumina-active-N`.
// Hovering a sub-move row sets the active class; hovering a token in the
// rendered KaTeX sets `hoveredSub` via event delegation.

const ALGEBRA_HOVER_STYLE_ID = 'lumina-algebra-hover-styles';
const ALGEBRA_HOVER_CSS = `
.lumina-tok {
  padding: 0 2px;
  margin: 0 -1px;
  border-radius: 3px;
  transition: background-color 150ms ease, box-shadow 150ms ease;
}
.lumina-active-0 .lumina-tok-0,
.lumina-active-1 .lumina-tok-1,
.lumina-active-2 .lumina-tok-2 {
  background-color: rgba(56, 189, 248, 0.25);
  box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.55);
}
`.trim();

/** Inject the hover CSS once into <head>. Idempotent across renders/components. */
function useAlgebraHoverStyles() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(ALGEBRA_HOVER_STYLE_ID)) return;
    const styleEl = document.createElement('style');
    styleEl.id = ALGEBRA_HOVER_STYLE_ID;
    styleEl.textContent = ALGEBRA_HOVER_CSS;
    document.head.appendChild(styleEl);
  }, []);
}

/** KaTeX renderer that allows the `\htmlClass` macro. */
function renderKatexTrusted(latex: string, displayMode = true): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: ({ command }: { command: string }) => command === '\\htmlClass',
    });
  } catch {
    return `<span class="text-red-400 font-mono text-sm">${latex}</span>`;
  }
}

const KaTeXTrusted: React.FC<{ latex: string; display?: boolean; className?: string }> = ({
  latex,
  display = true,
  className = '',
}) => {
  const html = React.useMemo(() => renderKatexTrusted(latex, display), [latex, display]);
  return (
    <span
      className={`text-slate-100 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Step Type Renderers
// ═══════════════════════════════════════════════════════════════════════

// ── Challenge helpers ──────────────────────────────────────────────────
//
// Validation strategy: lexical normalization first (lowercase, strip
// whitespace and trailing punctuation), then a numeric fallback when the
// hidden slot is `to` and both sides parse as plain decimals. The
// generator is responsible for listing reasonable synonyms in
// `acceptableAnswers` (e.g. "add 3 to both sides", "+3", "add 3").

const normalizeAnswer = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[.,;!?]+$/g, '')
    .replace(/[{}\\]/g, '')
    .trim();

const isAnswerCorrect = (
  typed: string,
  challenge: KaTeXTransitionChallenge,
  canonical: string,
): boolean => {
  const normTyped = normalizeAnswer(typed);
  if (!normTyped) return false;
  const normCanonical = normalizeAnswer(canonical);
  if (normTyped === normCanonical) return true;
  for (const acc of challenge.acceptableAnswers) {
    if (normalizeAnswer(acc) === normTyped) return true;
  }
  // Numeric fallback for `to` predictions where both sides parse as decimals.
  if (challenge.hide === 'to') {
    const a = parseFloat(typed);
    const b = parseFloat(canonical);
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.005) return true;
  }
  return false;
};

/**
 * Step-level validator. No backing slot — the canonical answer comes from
 * `acceptableAnswers[0]` directly. Numeric fallback is unconditional because
 * the LLM may emit "(2, 3)" / "2.0" / etc.
 */
const isStepAnswerCorrect = (typed: string, challenge: StepChallenge): boolean => {
  const normTyped = normalizeAnswer(typed);
  if (!normTyped) return false;
  for (const acc of challenge.acceptableAnswers) {
    if (normalizeAnswer(acc) === normTyped) return true;
  }
  const canonical = challenge.acceptableAnswers[0] ?? '';
  const a = parseFloat(typed);
  const b = parseFloat(canonical);
  if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.005) return true;
  return false;
};

interface ChallengeAttempt {
  answer: string;
  correct: boolean;
}

interface ChallengeRowProps {
  challenge: KaTeXTransitionChallenge;
  transition: KaTeXTransition;
  attempt: ChallengeAttempt | null;
  onCommit: (answer: string, correct: boolean) => void;
}

const ChallengeRow: React.FC<ChallengeRowProps> = ({
  challenge,
  transition,
  attempt,
  onCommit,
}) => {
  const [typed, setTyped] = useState('');

  const canonical = challenge.hide === 'operation' ? transition.operation : transition.to.latex;

  // Stable shuffled MCQ choices (correct + distractors) — re-shuffled per
  // mount so the position doesn't always leak the answer, but stable across
  // re-renders within this challenge.
  const choices = useMemo(() => {
    if (!challenge.distractors || challenge.distractors.length === 0) return null;
    const arr = [canonical, ...challenge.distractors];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      const correct = isAnswerCorrect(trimmed, challenge, canonical);
      if (correct) SoundManager.playCorrect();
      else SoundManager.playIncorrect();
      onCommit(trimmed, correct);
    },
    [challenge, canonical, onCommit],
  );

  if (attempt) {
    return (
      <div
        className={`ml-6 rounded-lg border px-3 py-2 text-xs space-y-1 ${
          attempt.correct
            ? 'bg-emerald-500/5 border-emerald-500/30'
            : 'bg-red-500/5 border-red-500/30'
        }`}
      >
        <div
          className={`flex items-center gap-2 font-medium ${
            attempt.correct ? 'text-emerald-300' : 'text-red-300'
          }`}
        >
          {attempt.correct ? <Check size={12} /> : <X size={12} />}
          <span>
            {attempt.correct ? 'Nice — that matches.' : 'Not quite. The expert move is shown below.'}
          </span>
        </div>
        {!attempt.correct && (
          <div className="text-slate-400">
            You answered: <span className="text-slate-200 font-mono">{attempt.answer}</span>
          </div>
        )}
        {challenge.rationale && (
          <div className="text-slate-400 italic">{challenge.rationale}</div>
        )}
      </div>
    );
  }

  return (
    <div className="ml-6 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 space-y-2">
      <div className="text-xs text-amber-300 font-medium">{challenge.prompt}</div>
      {choices ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => submit(choice)}
              className="text-left text-xs px-3 py-2 rounded-md bg-slate-800/40 border border-slate-700/50 hover:border-amber-400/50 hover:bg-amber-500/10 transition-colors text-slate-200"
            >
              {challenge.hide === 'to' ? <KaTeX latex={choice} display={false} /> : choice}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit(typed)}
            placeholder={
              challenge.hide === 'operation'
                ? 'e.g. subtract 3 from both sides'
                : 'e.g. 2x = 4'
            }
            className="flex-1 px-3 py-1.5 text-xs bg-slate-900/60 text-white rounded-md border border-amber-400/30 focus:border-amber-400 focus:outline-none font-mono"
          />
          <button
            onClick={() => submit(typed)}
            disabled={!typed.trim()}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-amber-500/15 border border-amber-400/40 hover:bg-amber-500/25 text-amber-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Check
          </button>
        </div>
      )}
    </div>
  );
};

// ── Step-level challenge gate ─────────────────────────────────────────
//
// Wraps a non-algebra step's content. While uncommitted, only the prompt
// renders — the content underneath is hidden so the student can't trivially
// read the answer. On commit, the result banner replaces the prompt and the
// real content reveals beneath. Algebra steps gate per-transition instead
// (richer interaction loop) and ignore this wrapper.

interface StepChallengeGateProps {
  challenge: StepChallenge;
  children: React.ReactNode;
  onCompletionChange?: (complete: boolean) => void;
}

const StepChallengeGate: React.FC<StepChallengeGateProps> = ({
  challenge,
  children,
  onCompletionChange,
}) => {
  const [attempt, setAttempt] = useState<ChallengeAttempt | null>(null);
  const [typed, setTyped] = useState('');

  const canonical = challenge.acceptableAnswers[0] ?? '';
  const useKatex = challenge.answerFormat === 'katex';

  // Stable shuffle — re-shuffles per mount only.
  const choices = useMemo(() => {
    if (!challenge.distractors || challenge.distractors.length === 0) return null;
    const arr = [canonical, ...challenge.distractors];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      const correct = isStepAnswerCorrect(trimmed, challenge);
      if (correct) SoundManager.playCorrect();
      else SoundManager.playIncorrect();
      setAttempt({ answer: trimmed, correct });
    },
    [challenge],
  );

  // Step counts as complete once an attempt has been committed (correct or
  // not). Matches the algebra view's contract so AnnotatedExample's locking
  // logic works uniformly.
  useEffect(() => {
    onCompletionChange?.(attempt != null);
  }, [attempt, onCompletionChange]);

  if (!attempt) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3.5 space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-amber-400/80 font-semibold">
          Predict before reveal
        </p>
        <div className="text-sm text-amber-200 font-medium leading-relaxed">
          {challenge.prompt}
        </div>
        {choices ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {choices.map((choice, i) => (
              <button
                key={i}
                onClick={() => submit(choice)}
                className="text-left text-sm px-3 py-2 rounded-md bg-slate-800/40 border border-slate-700/50 hover:border-amber-400/50 hover:bg-amber-500/10 transition-colors text-slate-200"
              >
                {useKatex ? <KaTeX latex={choice} display={false} /> : choice}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit(typed)}
              placeholder="Type your prediction"
              className="flex-1 px-3 py-1.5 text-sm bg-slate-900/60 text-white rounded-md border border-amber-400/30 focus:border-amber-400 focus:outline-none"
            />
            <button
              onClick={() => submit(typed)}
              disabled={!typed.trim()}
              className="text-sm font-medium px-3 py-1.5 rounded-md bg-amber-500/15 border border-amber-400/40 hover:bg-amber-500/25 text-amber-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Check
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={`rounded-lg border px-3 py-2 text-xs space-y-1 ${
          attempt.correct
            ? 'bg-emerald-500/5 border-emerald-500/30'
            : 'bg-red-500/5 border-red-500/30'
        }`}
      >
        <div
          className={`flex items-center gap-2 font-medium ${
            attempt.correct ? 'text-emerald-300' : 'text-red-300'
          }`}
        >
          {attempt.correct ? <Check size={12} /> : <X size={12} />}
          <span>
            {attempt.correct
              ? 'Nice — that matches.'
              : 'Not quite. Walk through the worked answer below.'}
          </span>
        </div>
        {!attempt.correct && (
          <div className="text-slate-400">
            You answered:{' '}
            <span className="text-slate-200 font-mono">{attempt.answer}</span>
            <span className="text-slate-500"> · canonical: </span>
            {useKatex ? (
              <KaTeX latex={canonical} display={false} className="text-emerald-300" />
            ) : (
              <span className="text-emerald-300">{canonical}</span>
            )}
          </div>
        )}
        {challenge.rationale && (
          <div className="text-slate-400 italic">{challenge.rationale}</div>
        )}
      </div>
      {children}
    </div>
  );
};

const AlgebraStepView: React.FC<{
  content: AlgebraStepContent;
  /** Called whenever the step's challenge-completion status changes — true
   *  when every challenge in this step has been committed (or there are
   *  none). The parent uses this to gate access to subsequent steps so
   *  the answer to a current prompt isn't visible in the next card. */
  onCompletionChange?: (complete: boolean) => void;
}> = ({ content, onCompletionChange }) => {
  useAlgebraHoverStyles();

  const [activeTransition, setActiveTransition] = useState(0);
  // Which sub-move (if any) is currently being hovered — set by either the
  // sub-move row's onMouseEnter or by event delegation from a parent KaTeX
  // expression when the cursor is over a `lumina-tok-N` token.
  const [hoveredSub, setHoveredSub] = useState<{ transition: number; sub: number } | null>(null);
  /**
   * Per-transition committed challenge attempts. A transition with a
   * `challenge` field is "gated" until its index appears here. Once
   * committed, the canonical reveal proceeds even if the answer was wrong
   * — the mistake is its own teaching moment via the rationale.
   */
  const [attempts, setAttempts] = useState<Record<number, ChallengeAttempt>>({});
  const totalTransitions = content.transitions.length;

  const isGated = useCallback(
    (i: number) => Boolean(content.transitions[i]?.challenge) && !attempts[i],
    [content.transitions, attempts],
  );

  // Emit completion: this step is "complete" once every transition with a
  // challenge has a committed attempt (correct or not — committing reveals
  // the canonical answer either way). Steps with no challenges report
  // complete on mount so non-algebra and unchallenged algebra steps don't
  // block downstream rendering.
  useEffect(() => {
    if (!onCompletionChange) return;
    const challengeCount = content.transitions.filter((t) => Boolean(t.challenge)).length;
    const committedCount = Object.keys(attempts).length;
    onCompletionChange(challengeCount === 0 || committedCount >= challengeCount);
  }, [content.transitions, attempts, onCompletionChange]);

  const commitAttempt = useCallback(
    (i: number, answer: string, correct: boolean) => {
      setAttempts((prev) => ({ ...prev, [i]: { answer, correct } }));
      // Auto-advance reveal so the canonical step shows beneath the result.
      setActiveTransition((cur) => Math.max(cur, i));
    },
    [],
  );

  const advance = useCallback(() => {
    if (isGated(activeTransition)) return; // wait for commit
    setActiveTransition((prev) => Math.min(prev + 1, totalTransitions - 1));
  }, [activeTransition, isGated, totalTransitions]);

  // Walk up from the event target until we find a `lumina-tok-N` class — that
  // tells us which sub-move the user is hovering inside the rendered KaTeX.
  const handleExpressionMouseOver = useCallback(
    (e: React.MouseEvent<HTMLElement>, transitionIdx: number) => {
      let el: HTMLElement | null = e.target as HTMLElement;
      const stop = e.currentTarget as HTMLElement;
      while (el && el !== stop) {
        if (el.classList) {
          for (const cls of Array.from(el.classList)) {
            const m = cls.match(/^lumina-tok-(\d+)$/);
            if (m) {
              setHoveredSub({ transition: transitionIdx, sub: parseInt(m[1], 10) });
              return;
            }
          }
        }
        el = el.parentElement;
      }
    },
    [],
  );

  const clearHover = useCallback(() => setHoveredSub(null), []);

  const transitionActiveClass = (i: number) =>
    hoveredSub?.transition === i ? `lumina-active-${hoveredSub.sub}` : '';

  if (totalTransitions === 0) {
    return (
      <div className="flex items-center gap-2 pt-2">
        <Check size={14} className="text-emerald-400 flex-shrink-0" />
        <KaTeX latex={content.result} className="text-emerald-300 font-semibold" />
      </div>
    );
  }

  const normalize = (s: string) => s.replace(/\s+/g, '').trim();

  return (
    <div className="space-y-4">
      {/* Collapsed chain: initial expression, then per-transition (op → result) rows.
          Skips the `from` of a transition when it chains from the prior `to`. */}
      <div className="space-y-3">
        {/* Initial expression (first transition's `from`) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={`bg-slate-950/50 rounded-lg px-4 py-3 border border-slate-800/50 ${transitionActiveClass(0)}`}
          onMouseOver={(e) => handleExpressionMouseOver(e, 0)}
          onMouseOut={clearHover}
        >
          <KaTeXTrusted latex={content.transitions[0].from.latex} />
        </motion.div>

        {content.transitions.map((t, i) => {
          const isActive = i <= activeTransition;
          const prev = i > 0 ? content.transitions[i - 1] : null;
          const chainsFromPrior = prev && normalize(prev.to.latex) === normalize(t.from.latex);
          const isHoverActive = hoveredSub?.transition === i;
          const challenge = t.challenge;
          const attempt = attempts[i] ?? null;
          // While a challenge is pending we hide BOTH the operation and the
          // `to` expression. Showing one while gating the other lets the
          // student work backwards — e.g. seeing `2x = 8` makes
          // "subtract 5" obvious even when the operation is the slot being
          // asked about. Both reveal together once the attempt commits.
          const transitionRevealed = !challenge || attempt != null;
          const operationRevealed = transitionRevealed;
          const toRevealed = transitionRevealed;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: isActive ? 1 : 0.4, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.15 }}
              className={`flex flex-col gap-2 ${transitionActiveClass(i)}`}
            >
              {/* Discontinuity guard: render `from` when this transition does not chain */}
              {!chainsFromPrior && i > 0 && (
                <div
                  className="bg-slate-950/50 rounded-lg px-4 py-3 border border-slate-800/50"
                  onMouseOver={(e) => handleExpressionMouseOver(e, i)}
                  onMouseOut={clearHover}
                >
                  <KaTeXTrusted latex={t.from.latex} />
                </div>
              )}

              {/* Per-step challenge — student supplies operation OR to */}
              {challenge && isActive && (
                <ChallengeRow
                  challenge={challenge}
                  transition={t}
                  attempt={attempt}
                  onCommit={(answer, correct) => commitAttempt(i, answer, correct)}
                />
              )}

              {/* Operation label + arrow */}
              {operationRevealed && (
                <div className="flex items-center gap-2 pl-2">
                  <ArrowRight size={14} className="text-blue-400 flex-shrink-0" />
                  <span className="text-xs text-blue-400 font-medium italic">{t.operation}</span>
                </div>
              )}

              {/* Per-term sub-moves — make the mechanism visible */}
              {operationRevealed && toRevealed && t.subMoves && t.subMoves.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: isActive ? 1 : 0.4, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.15 + 0.1 }}
                  className="ml-6 rounded-lg border border-blue-500/15 bg-blue-500/5 px-3 py-2 space-y-1.5"
                >
                  {t.subMoves.map((sm, j) => {
                    const isThisSubActive = isHoverActive && hoveredSub.sub === j;
                    return (
                      <div
                        key={j}
                        className={`flex items-center gap-3 text-xs flex-wrap rounded-md px-2 py-1 transition-colors cursor-default ${
                          isThisSubActive ? 'bg-blue-500/15 ring-1 ring-blue-400/40' : ''
                        }`}
                        onMouseEnter={() => setHoveredSub({ transition: i, sub: j })}
                        onMouseLeave={clearHover}
                      >
                        <span className="text-slate-400">
                          <KaTeX latex={sm.from} display={false} />
                        </span>
                        <ArrowRight size={11} className="text-blue-400/60 flex-shrink-0" />
                        <span className="text-slate-200">
                          <KaTeX latex={sm.to} display={false} />
                        </span>
                        <span className="text-blue-400/70 italic ml-auto text-[11px]">
                          {sm.rule}
                        </span>
                      </div>
                    );
                  })}
                </motion.div>
              )}

              {/* Resulting expression */}
              {toRevealed && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: isActive ? 1 : 0.4, scale: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.15 + 0.2 }}
                  className="bg-slate-950/50 rounded-lg px-4 py-3 border border-blue-500/20"
                  onMouseOver={(e) => handleExpressionMouseOver(e, i)}
                  onMouseOut={clearHover}
                >
                  <KaTeXTrusted latex={t.to.latex} />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Play / Next button — disabled while the active transition's challenge
          is still pending, so the student can't skip past their own prediction. */}
      {activeTransition < totalTransitions - 1 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={advance}
          disabled={isGated(activeTransition)}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-500/10"
        >
          {isGated(activeTransition)
            ? 'Answer the prompt to continue'
            : `Next transformation (${activeTransition + 1}/${totalTransitions})`}
        </motion.button>
      )}

      {/* Result */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: activeTransition >= totalTransitions - 1 ? 1 : 0.3 }}
        className="flex items-center gap-2 pt-2 border-t border-slate-800/50"
      >
        <Check size={14} className="text-emerald-400 flex-shrink-0" />
        <KaTeX latex={content.result} className="text-emerald-300 font-semibold" />
      </motion.div>
    </div>
  );
};

const TableStepView: React.FC<{ content: TableStepContent }> = ({ content }) => {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 font-medium">{content.caption}</p>

      <div className="overflow-x-auto rounded-lg border border-slate-800/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/50">
              {content.headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left text-slate-300 font-semibold text-xs uppercase tracking-wider">
                  <MixedContent text={h} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.rows.map((row, ri) => (
              <tr key={ri} className="border-t border-slate-800/30">
                {row.map((cell, ci) => {
                  const isHighlight =
                    content.highlightCell &&
                    content.highlightCell[0] === ri &&
                    content.highlightCell[1] === ci;
                  return (
                    <td
                      key={ci}
                      className={`px-3 py-2 ${isHighlight ? 'bg-emerald-500/10 text-emerald-300 font-semibold' : 'text-slate-400'}`}
                    >
                      <MixedContent text={cell} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DiagramStepView: React.FC<{ content: DiagramStepContent }> = ({ content }) => {
  return (
    <div className="space-y-3">
      {content.imageBase64 ? (
        <div className="rounded-lg overflow-hidden border border-slate-800/50">
          <img src={content.imageBase64} alt={content.altText} className="w-full" />
        </div>
      ) : (
        <div className="rounded-lg bg-slate-950/50 border border-slate-800/50 p-6 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Image size={32} className="text-slate-600 mx-auto" />
            <p className="text-slate-500 text-sm">{content.altText}</p>
          </div>
        </div>
      )}

      {/* Labels */}
      <div className="grid grid-cols-2 gap-2">
        {content.labels.map((label, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-slate-800/30 rounded-lg px-3 py-2 border border-slate-700/30"
          >
            <p className="text-xs font-semibold text-slate-200">{label.text}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// Semantic curve colors → on-canvas hex. Kept narrow so the planner can
// reason about which curve is the "main" vs "supporting" without picking pixels.
const CURVE_COLORS = {
  primary: '#38bdf8',   // cyan
  secondary: '#f59e0b', // amber
  tertiary: '#22c55e',  // emerald
} as const;

const SHADE_FILLS = [
  'rgba(56, 189, 248, 0.18)',
  'rgba(245, 158, 11, 0.18)',
];

const VECTOR_COLOR = '#a78bfa'; // violet

const GraphSketchStepView: React.FC<{ content: GraphSketchStepContent }> = ({ content }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Resolve effective curve list. A non-empty `curves` array supersedes the
  // legacy single `expression` field; otherwise fall back to a single primary
  // curve so existing callers keep rendering.
  const curves = useMemo(() => {
    if (content.curves && content.curves.length > 0) return content.curves;
    if (content.expression) {
      return [{ expression: content.expression, color: 'primary' as const, style: 'solid' as const }];
    }
    return [];
  }, [content.curves, content.expression]);

  const cfg: CanvasConfig = useMemo(
    () => ({
      xMin: content.domain[0],
      xMax: content.domain[1],
      yMin: content.range[0],
      yMax: content.range[1],
      xLabel: content.xLabel ?? 'x',
      yLabel: content.yLabel ?? 'y',
    }),
    [content.domain, content.range, content.xLabel, content.yLabel],
  );

  // Sample each curve over the visible x-range. mathEvaluator returns null
  // outside the domain — drawCurve handles the resulting gaps.
  const sampledCurves = useMemo(
    () =>
      curves.map((c) => ({
        ...c,
        points: sampleCurve(c.expression, cfg.xMin, cfg.xMax, 240),
      })),
    [curves, cfg.xMin, cfg.xMax],
  );

  // Sample shaded regions only over [from, to]; the polygon is bounded by
  // upper / lower expressions sampled at matching x values.
  const sampledShades = useMemo(
    () =>
      (content.shadedRegions ?? []).map((r) => ({
        label: r.label,
        upper: sampleCurve(r.upper, r.from, r.to, 80),
        lower: sampleCurve(r.lower, r.from, r.to, 80),
      })),
    [content.shadedRegions],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawAxes(ctx, cfg);

    // 1. Shaded regions (under everything else).
    sampledShades.forEach((shade, i) => {
      drawShadedRegion(ctx, shade.upper, shade.lower, cfg, SHADE_FILLS[i % SHADE_FILLS.length]);
    });

    // 2. Curves.
    for (const c of sampledCurves) {
      const color = CURVE_COLORS[c.color ?? 'primary'] ?? CURVE_COLORS.primary;
      if (c.style === 'dashed') {
        ctx.save();
        ctx.setLineDash([6, 5]);
        drawCurve(ctx, c.points, cfg, color, 2.5);
        ctx.restore();
      } else {
        drawCurve(ctx, c.points, cfg, color, 2.5);
      }
    }

    // 3. Vectors.
    for (const v of content.vectors ?? []) {
      drawVector(
        ctx,
        { x: v.from[0], y: v.from[1] },
        { x: v.to[0], y: v.to[1] },
        cfg,
        VECTOR_COLOR,
        v.label,
      );
    }

    // 4. Labeled points (drawn last so they sit above curves).
    for (const pt of content.keyPoints) {
      drawLabeledPoint(ctx, { x: pt.x, y: pt.y }, cfg, '#22c55e', pt.label, true);
    }
  }, [cfg, sampledCurves, sampledShades, content.vectors, content.keyPoints]);

  return (
    <div className="space-y-3">
      {/* Caption */}
      {content.caption && (
        <p className="text-xs text-slate-500 font-medium">{content.caption}</p>
      )}

      {/* Curve legend — only when we have multiple curves or labels worth showing. */}
      {curves.length > 0 && (curves.length > 1 || curves[0].label) && (
        <div className="flex flex-wrap gap-3">
          {curves.map((c, i) => {
            const color = CURVE_COLORS[c.color ?? 'primary'] ?? CURVE_COLORS.primary;
            return (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                <span
                  className="inline-block w-4 h-0.5 rounded"
                  style={{ backgroundColor: color }}
                />
                {c.label ? (
                  <KaTeX latex={c.label} display={false} className="text-slate-200" />
                ) : (
                  <KaTeX latex={c.expression} display={false} className="text-slate-200" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Canvas */}
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="rounded-lg border border-slate-800/50 bg-slate-950/60 max-w-full"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>

      {/* Shaded-region labels (rendered as KaTeX-friendly badges so labels like "A = 4/3" parse). */}
      {sampledShades.length > 0 && sampledShades.some((s) => s.label) && (
        <div className="flex flex-wrap gap-2">
          {sampledShades.map(
            (s, i) =>
              s.label && (
                <span
                  key={i}
                  className="text-xs px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-200"
                >
                  <MixedContent text={`$${s.label}$`} />
                </span>
              ),
          )}
        </div>
      )}

      {/* Key points list (in addition to on-canvas markers — useful in compact mode). */}
      {content.keyPoints.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {content.keyPoints.map((pt, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <TrendingUp size={12} className="text-emerald-400 flex-shrink-0" />
              <span className="text-slate-400">
                ({pt.x}, {pt.y})
              </span>
              <span className="text-slate-500 text-xs">{pt.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Feature badges — descriptive metadata, not on-canvas. */}
      {content.features.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {content.features.map((feat, i) => (
            <span
              key={i}
              className="text-xs px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300"
            >
              {feat.kind}: {feat.label} = {feat.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const CaseSplitStepView: React.FC<{ content: CaseSplitStepContent }> = ({ content }) => {
  const [expandedCase, setExpandedCase] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {/* Condition */}
      <div className="flex items-center gap-2 text-sm">
        <GitBranch size={14} className="text-amber-400" />
        <MixedContent text={content.condition} className="text-slate-300 font-medium" />
      </div>

      {/* Cases */}
      <div className="space-y-2">
        {content.cases.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-lg border border-slate-800/50 overflow-hidden"
          >
            <button
              onClick={() => setExpandedCase(expandedCase === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/30 hover:bg-slate-800/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-mono text-xs font-bold">Case {i + 1}</span>
                <span className="text-slate-400 text-sm">{c.label}</span>
              </div>
              <MixedContent text={c.condition} className="text-xs text-slate-500" />
            </button>

            <AnimatePresence>
              {expandedCase === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 py-3 space-y-2 border-t border-slate-800/30">
                    <KaTeX latex={c.work} className="text-sm" />
                    <div className="flex items-center gap-2 pt-1">
                      <ArrowRight size={12} className="text-emerald-400" />
                      <KaTeX latex={c.result} display={false} className="text-emerald-300 text-sm" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Main Router
// ═══════════════════════════════════════════════════════════════════════

const STEP_TYPE_ICONS: Record<string, React.ReactNode> = {
  algebra: <span className="text-blue-400 text-xs font-bold font-mono">f(x)</span>,
  table: <Table2 size={12} className="text-amber-400" />,
  diagram: <Image size={12} className="text-cyan-400" />,
  'graph-sketch': <TrendingUp size={12} className="text-cyan-400" />,
  'case-split': <GitBranch size={12} className="text-amber-400" />,
};

/**
 * Render the body of a step (no challenge wrapping). Algebra owns its own
 * gating via per-transition challenges and is the only consumer of
 * `onCompletionChange` here; other types report completion via the
 * step-level gate when one is attached.
 */
function renderContentBody(
  content: StepContent,
  onCompletionChange?: (complete: boolean) => void,
): React.ReactNode {
  switch (content.type) {
    case 'algebra':
      return <AlgebraStepView content={content} onCompletionChange={onCompletionChange} />;
    case 'table':
      return <TableStepView content={content} />;
    case 'diagram':
      return <DiagramStepView content={content} />;
    case 'graph-sketch':
      return <GraphSketchStepView content={content} />;
    case 'case-split':
      return <CaseSplitStepView content={content} />;
  }
}

export const StepContentRenderer: React.FC<{
  content: StepContent;
  /**
   * Optional step-level challenge gate. Only honored for non-algebra step
   * types; algebra steps gate at the transition level instead. The merge
   * step in challenger.ts enforces this so we never see both at once.
   */
  challenge?: StepChallenge;
  /** Reserved — currently no step type consumes this. Kept on the contract so the
   *  data-level `interactive` flag still flows through to future interactive primitives. */
  interactive?: boolean;
  /**
   * Forwarded to whichever component owns this step's gating: the algebra
   * view for transition-level challenges, or the StepChallengeGate wrapper
   * for step-level challenges. Steps with no gating concept (no challenge
   * field, non-algebra) never call this — AnnotatedExample defaults
   * unreported steps to "complete" so navigation isn't blocked.
   */
  onCompletionChange?: (complete: boolean) => void;
}> = ({ content, challenge, onCompletionChange }) => {
  if (challenge && content.type !== 'algebra') {
    return (
      <StepChallengeGate challenge={challenge} onCompletionChange={onCompletionChange}>
        {renderContentBody(content)}
      </StepChallengeGate>
    );
  }
  return <>{renderContentBody(content, onCompletionChange)}</>;
};

export const StepTypeIcon: React.FC<{ type: string }> = ({ type }) => {
  return <>{STEP_TYPE_ICONS[type] || null}</>;
};

export { KaTeX, MixedContent };
