'use client';

/**
 * LandingPrimitiveDemos — playable mini-primitives for the landing's
 * "A peek inside" section.
 *
 * These are real, interactive Lumina primitives in miniature — built entirely
 * from the `lumina/ui` kit so they look and grade exactly like the ones inside
 * a lesson. State is local and self-contained; each card exposes an `onOpen`
 * that launches the full topic in /lumina.
 */
import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Gauge,
  Check,
  Calculator,
  BookOpen,
  FlaskConical,
  Globe2,
  GraduationCap,
  PencilLine,
  MousePointerClick,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { SoundManager } from '@/components/lumina/utils/SoundManager';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaBadge,
  LuminaPrompt,
  LuminaInlineStat,
  LuminaFillBlankSlot,
  LuminaChip,
  LuminaChipBank,
  LuminaAnswerChoice,
  LuminaActionButton,
  LuminaFeedbackCard,
  accentText,
  accentChipBg,
  accentSoftBorder,
  type AnswerChoiceState,
  type LuminaAccent,
} from '@/components/lumina/ui';

// Shared "Open this lesson →" footer link, color-matched per card.
const OpenLink: React.FC<{ onClick: () => void; className: string }> = ({ onClick, className }) => (
  <button onClick={onClick} className={`flex items-center gap-1 text-xs font-semibold transition-colors ${className}`}>
    Open this lesson <ArrowRight className="h-3 w-3" />
  </button>
);

// ── Math · Counting — tap the ten-frame to make a target number ──────────
export const CountingDemo: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const TARGET = 8;
  const [filled, setFilled] = useState<Set<number>>(() => new Set([0, 1, 2, 3, 4]));
  const [submitted, setSubmitted] = useState(false);
  const count = filled.size;
  const correct = count === TARGET;

  const toggle = (i: number) => {
    if (submitted) return;
    const adding = !filled.has(i);
    SoundManager.toggle(adding); // rising blips on add, falling on remove
    setFilled((prev) => {
      const next = new Set(prev);
      adding ? next.add(i) : next.delete(i);
      return next;
    });
  };

  const check = () => {
    setSubmitted(true);
    correct ? SoundManager.playCorrect() : SoundManager.playIncorrect();
  };

  const reset = () => {
    SoundManager.tap();
    setSubmitted(false);
    setFilled(new Set([0, 1, 2, 3, 4]));
  };

  return (
    <LuminaCard surface="glass" topAccent="cyan">
      <LuminaCardContent className="flex h-full flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <LuminaBadge accent="cyan">Math · Counting</LuminaBadge>
          <LuminaInlineStat label="Counted" value={count} suffix="/ 10" accent="cyan" />
        </div>
        <LuminaPrompt>Tap the frame to show {TARGET} counters.</LuminaPrompt>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }).map((_, i) => {
            const on = filled.has(i);
            return (
              <button
                key={i}
                onClick={() => toggle(i)}
                disabled={submitted}
                className={`flex aspect-square items-center justify-center rounded-lg border transition-all ${
                  on
                    ? 'border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                } ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {on && <span className="h-3 w-3 rounded-full bg-cyan-300" />}
              </button>
            );
          })}
        </div>

        {submitted ? (
          <LuminaFeedbackCard
            status={correct ? 'correct' : 'insight'}
            className="!p-4"
            teachingNote={correct ? undefined : `A full row is 5 — count on from there to reach ${TARGET}.`}
          >
            <span className="text-base">
              {correct ? `That's ${TARGET}! Nicely counted.` : `You have ${count}. Try for exactly ${TARGET}.`}
            </span>
          </LuminaFeedbackCard>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-1">
          <OpenLink onClick={onOpen} className="text-cyan-300 hover:text-cyan-200" />
          {submitted ? (
            <LuminaActionButton action="retry" size="sm" onClick={reset} />
          ) : (
            <LuminaActionButton action="check" size="sm" onClick={check} />
          )}
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
};

// ── Reading · Vocabulary — click words into the blanks ───────────────────
export const FillBlankDemo: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const CORRECT = new Set(['sunlight', 'water']);
  const BANK = ['sunlight', 'water', 'soil'];
  const [blanks, setBlanks] = useState<(string | null)[]>([null, null]);
  const [submitted, setSubmitted] = useState(false);

  const placed = blanks.filter(Boolean) as string[];
  const bothFilled = blanks.every(Boolean);
  const allCorrect = blanks.every((w) => !!w && CORRECT.has(w));

  const placeWord = (w: string) => {
    if (submitted || placed.includes(w)) return;
    const i = blanks.indexOf(null);
    if (i < 0) {
      SoundManager.invalid(); // no empty blank to drop into
      return;
    }
    SoundManager.snap(); // word lands in the blank
    const next = [...blanks];
    next[i] = w;
    setBlanks(next);
  };
  const clearBlank = (i: number) => {
    if (submitted || !blanks[i]) return;
    SoundManager.tap();
    const next = [...blanks];
    next[i] = null;
    setBlanks(next);
  };
  const check = () => {
    setSubmitted(true);
    allCorrect ? SoundManager.playCorrect() : SoundManager.playIncorrect();
  };
  const reset = () => {
    SoundManager.tap();
    setSubmitted(false);
    setBlanks([null, null]);
  };

  const blankState = (i: number): 'empty' | 'filled' | 'correct' | 'incorrect' => {
    const w = blanks[i];
    if (!w) return 'empty';
    if (!submitted) return 'filled';
    return CORRECT.has(w) ? 'correct' : 'incorrect';
  };
  const chipState = (w: string): AnswerChoiceState =>
    submitted || placed.includes(w) ? 'dimmed' : 'idle';

  return (
    <LuminaCard surface="glass" topAccent="pink">
      <LuminaCardContent className="flex h-full flex-col gap-4 pt-6">
        <LuminaBadge accent="pink">Reading · Vocabulary</LuminaBadge>
        <LuminaPrompt>Tap a word to fill each blank.</LuminaPrompt>
        <p className="text-base leading-loose text-slate-200">
          Plants use
          <LuminaFillBlankSlot state={blankState(0)} value={blanks[0] ?? undefined} onClick={() => clearBlank(0)} className="!min-w-[110px]" />
          and
          <LuminaFillBlankSlot state={blankState(1)} value={blanks[1] ?? undefined} onClick={() => clearBlank(1)} className="!min-w-[110px]" />
          to make food.
        </p>
        <LuminaChipBank label="Word bank" className="!p-3">
          {BANK.map((w) => (
            <LuminaChip key={w} state={chipState(w)} onClick={() => placeWord(w)} disabled={submitted || placed.includes(w)}>
              {w}
            </LuminaChip>
          ))}
        </LuminaChipBank>

        {submitted ? (
          <LuminaFeedbackCard
            status={allCorrect ? 'correct' : 'insight'}
            className="!p-4"
            teachingNote={allCorrect ? undefined : 'Plants need light and water — soil holds them in place, but isn’t the food source.'}
          >
            <span className="text-base">
              {allCorrect ? 'Exactly — sunlight and water!' : 'Close — check which two plants actually use.'}
            </span>
          </LuminaFeedbackCard>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-1">
          <OpenLink onClick={onOpen} className="text-pink-300 hover:text-pink-200" />
          {submitted ? (
            <LuminaActionButton action="retry" size="sm" onClick={reset} />
          ) : (
            <LuminaActionButton action="check" size="sm" disabled={!bothFilled} onClick={check} />
          )}
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
};

// ── Science · States of matter — pick True / False, then check ───────────
export const TrueFalseDemo: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const CORRECT = true;
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = answer === CORRECT;

  const choiceState = (v: boolean): AnswerChoiceState =>
    !submitted
      ? answer === v
        ? 'selected'
        : 'idle'
      : v === CORRECT
        ? 'correct'
        : answer === v
          ? 'incorrect'
          : 'dimmed';

  const select = (v: boolean) => {
    SoundManager.select();
    setAnswer(v);
  };
  const check = () => {
    setSubmitted(true);
    isCorrect ? SoundManager.playCorrect() : SoundManager.playIncorrect();
  };
  const reset = () => {
    SoundManager.tap();
    setSubmitted(false);
    setAnswer(null);
  };

  return (
    <LuminaCard surface="glass" topAccent="emerald">
      <LuminaCardContent className="flex h-full flex-col gap-4 pt-6">
        <LuminaBadge accent="emerald">Science · States of matter</LuminaBadge>
        <LuminaPrompt>Ice, water, and steam are the same material. True or false?</LuminaPrompt>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: true, label: 'True' },
            { value: false, label: 'False' },
          ].map(({ value, label }) => (
            <LuminaAnswerChoice
              key={label}
              state={choiceState(value)}
              disabled={submitted}
              onClick={() => select(value)}
            >
              <span className="block text-center font-bold">{label}</span>
            </LuminaAnswerChoice>
          ))}
        </div>

        {submitted ? (
          <LuminaFeedbackCard
            status={isCorrect ? 'correct' : 'insight'}
            className="!p-4"
            teachingNote="They're all H₂O — heating and cooling just changes the state, not the material."
          >
            <span className="text-base">
              {isCorrect ? 'Right — same material, different states!' : 'Think about what ice melts into…'}
            </span>
          </LuminaFeedbackCard>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-1">
          <OpenLink onClick={onOpen} className="text-emerald-300 hover:text-emerald-200" />
          {submitted ? (
            <LuminaActionButton action="retry" size="sm" onClick={reset} />
          ) : (
            <LuminaActionButton action="check" size="sm" disabled={answer === null} onClick={check} />
          )}
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
};

// ── Visual, not worksheets — the same sum, two worlds ────────────────────
// Show, don't tell. A segmented toggle flips one problem (4 + 3) between a dead
// paper worksheet — a symbol to memorize, nothing to do but write a number —
// and the live Lumina primitive, where you BUILD the sum by tapping a ten-frame
// and the answer falls out of the interaction. The contrast IS the pitch.
const WS_A = 4;
const WS_B = 3;
const WS_SUM = WS_A + WS_B;

const WORKSHEET_VISUAL_CSS = `
@keyframes luminaTabNudge { 0%, 70%, 100% { box-shadow: 0 0 0 0 rgba(168,85,247,0); } 85% { box-shadow: 0 0 0 4px rgba(168,85,247,0.18); } }
.lumina-tab-nudge { animation: luminaTabNudge 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .lumina-tab-nudge { animation: none; } }
`;

export const WorksheetVsVisualDemo: React.FC = () => {
  const [mode, setMode] = useState<'worksheet' | 'lumina'>('worksheet');
  const [touchedLumina, setTouchedLumina] = useState(false); // stop nudging once they explore

  // Lumina side — the first WS_A cells are the given "4" (locked); the student
  // taps empty cells to add the "+3" until the frame shows the whole sum.
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const total = WS_A + added.size;
  const correct = total === WS_SUM;

  const switchMode = (m: 'worksheet' | 'lumina') => {
    if (m === mode) return;
    SoundManager.select();
    setMode(m);
    if (m === 'lumina') setTouchedLumina(true);
  };

  const toggleCell = (i: number) => {
    if (submitted) return;
    const adding = !added.has(i);
    SoundManager.toggle(adding);
    setAdded((prev) => {
      const next = new Set(prev);
      adding ? next.add(i) : next.delete(i);
      return next;
    });
  };
  const check = () => {
    setSubmitted(true);
    correct ? SoundManager.playCorrect() : SoundManager.playIncorrect();
  };
  const reset = () => {
    SoundManager.tap();
    setSubmitted(false);
    setAdded(new Set());
  };

  return (
    <LuminaCard surface="glass" topAccent="purple">
      <style>{WORKSHEET_VISUAL_CSS}</style>
      <LuminaCardContent className="flex h-full flex-col gap-4 pt-7">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/20 text-purple-300">
          <MousePointerClick className="h-5 w-5" />
        </span>
        <h3 className="text-lg font-bold text-slate-100">Visual, not worksheets</h3>

        {/* Segmented toggle — the same problem, two worlds */}
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
          <button
            type="button"
            onClick={() => switchMode('worksheet')}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              mode === 'worksheet'
                ? 'bg-white/10 text-slate-100'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <PencilLine className="h-3.5 w-3.5" /> Worksheet
          </button>
          <button
            type="button"
            onClick={() => switchMode('lumina')}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              mode === 'lumina'
                ? `${accentChipBg.purple} ${accentText.purple}`
                : `text-slate-500 hover:text-slate-300 ${touchedLumina ? '' : 'lumina-tab-nudge'}`
            }`}
          >
            <MousePointerClick className="h-3.5 w-3.5" /> Lumina
          </button>
        </div>

        {mode === 'worksheet' ? (
          /* ── Dead paper: a symbol to memorize, nothing to do ── */
          <div
            className="select-none cursor-not-allowed rounded-xl border border-black/10 p-5 text-slate-800 shadow-inner"
            style={{
              backgroundColor: '#eef0f2',
              backgroundImage:
                'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(30,58,138,0.16) 31px, rgba(30,58,138,0.16) 32px)',
            }}
            aria-label="A paper worksheet"
          >
            <div className="flex items-baseline gap-2 font-serif text-3xl leading-[2rem] tracking-wide">
              {WS_A} + {WS_B} ={' '}
              <span className="inline-block w-12 border-b-2 border-slate-700/70" />
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <PencilLine className="h-3.5 w-3.5" /> Write the answer. Hand it in.
            </div>
          </div>
        ) : (
          /* ── Live primitive: build the sum, the answer falls out ── */
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <LuminaBadge accent="purple">{WS_A} + {WS_B}</LuminaBadge>
              <LuminaInlineStat label="Total" value={total} suffix={`/ ${WS_SUM}`} accent="purple" />
            </div>
            <LuminaPrompt>Tap to add {WS_B} more.</LuminaPrompt>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, i) => {
                const given = i < WS_A;
                const isAdded = added.has(i);
                return (
                  <button
                    key={i}
                    onClick={() => !given && toggleCell(i)}
                    disabled={given || submitted}
                    className={`flex aspect-square items-center justify-center rounded-lg border transition-all ${
                      given
                        ? 'cursor-default border-cyan-400/40 bg-cyan-500/10'
                        : isAdded
                          ? 'border-purple-400/50 bg-purple-500/15 hover:bg-purple-500/25'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
                    } ${submitted ? 'cursor-default' : ''}`}
                  >
                    {given && <span className="h-3 w-3 rounded-full bg-cyan-300" />}
                    {isAdded && <span className="h-3 w-3 rounded-full bg-purple-300" />}
                  </button>
                );
              })}
            </div>

            {submitted ? (
              <LuminaFeedbackCard
                status={correct ? 'correct' : 'insight'}
                className="!p-4"
                teachingNote={correct ? undefined : `Start with ${WS_A}, then add ${WS_B} one at a time.`}
              >
                <span className="text-base">
                  {correct ? `${WS_A} and ${WS_B} make ${WS_SUM} — you built it!` : `You have ${total}. Aim for ${WS_SUM}.`}
                </span>
              </LuminaFeedbackCard>
            ) : null}
          </div>
        )}

        {/* Caption + (Lumina-mode) check — the line that names the difference */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <p className="text-xs leading-relaxed text-slate-500">
            {mode === 'worksheet'
              ? 'A symbol to recall. The page can’t tell if it clicked.'
              : 'You’re not recalling 7 — you’re watching it add up. The interaction is the teaching.'}
          </p>
          {mode === 'lumina' ? (
            submitted ? (
              <LuminaActionButton action="retry" size="sm" onClick={reset} />
            ) : (
              <LuminaActionButton action="check" size="sm" disabled={total === WS_A} onClick={check} />
            )
          ) : null}
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
};

// ── Adapts in real time — a self-playing IRT ramp (low β → high β) ────────
// Show, don't tell: a student answers, and each correct answer pushes the
// selected eval mode up the difficulty ladder. Auto-plays and loops.
const RUNGS = [
  { mode: 'Add within 10', problem: '4 + 3', answer: 7 },
  { mode: '2-digit, no regroup', problem: '23 + 14', answer: 37 },
  { mode: 'Regroup once', problem: '28 + 7', answer: 35 },
  { mode: '2-digit regroup', problem: '47 + 38', answer: 85 },
  { mode: '3-digit regroup', problem: '156 + 67', answer: 223 },
];

export const AdaptiveDemo: React.FC = () => {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // Two-beat loop: pose the problem → reveal the correct answer → advance a rung.
  useEffect(() => {
    const delay = revealed ? 1150 : 1000;
    const t = setTimeout(() => {
      if (revealed) {
        setRevealed(false);
        setIdx((i) => (i + 1) % RUNGS.length);
      } else {
        setRevealed(true);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [revealed, idx]);

  const rung = RUNGS[idx];

  return (
    <LuminaCard surface="glass" topAccent="cyan">
      <LuminaCardContent className="flex h-full flex-col gap-4 pt-7">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/20 text-cyan-300">
          <Gauge className="h-5 w-5" />
        </span>
        <h3 className="text-lg font-bold text-slate-100">Adapts in real time</h3>
        <p className="text-sm leading-relaxed text-slate-400">
          Each correct answer pushes the difficulty up — watch the eval mode
          climb the ladder.
        </p>

        {/* Current problem */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-center">
          <div className="font-mono text-2xl tracking-wide text-slate-100">
            {rung.problem} ={' '}
            {revealed ? (
              <span className="text-emerald-300">{rung.answer}</span>
            ) : (
              <span className="text-slate-600">?</span>
            )}
          </div>
          <div className="mt-1.5 flex h-5 items-center justify-center text-xs font-semibold">
            {revealed ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="h-3.5 w-3.5" /> Correct — leveling up
              </span>
            ) : (
              <span className="text-slate-600">thinking…</span>
            )}
          </div>
        </div>

        {/* Difficulty ladder (β) */}
        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-purple-200 transition-all">{rung.mode}</span>
            <span className="font-mono text-[10px] text-slate-500">tier {idx + 1}/{RUNGS.length}</span>
          </div>
          <div className="flex gap-1">
            {RUNGS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  i === idx
                    ? 'bg-gradient-to-r from-cyan-400 to-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                    : i < idx
                      ? 'bg-cyan-500/40'
                      : 'bg-white/10'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-slate-500">
            <span>low β</span>
            <span>high β</span>
          </div>
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
};

// ── How it works — a self-playing pipeline: pick → build → adapt ──────────
// Show, don't tell. The three steps stop being captions and become one live,
// looping run of the real pipeline: a topic is typed in, then the lesson
// assembles itself the way the product actually shows it — a "Component
// Assembly" checklist whose rows flip from a spinner to a green check, each
// tagged with its Bloom verb — and finally the difficulty ladder climbs. The
// numbered spine doubles as a progress tracker for the active step.

type HiwComponent = { bloom: string; title: string };
type HiwTopic = { topic: string; subject: string; accent: LuminaAccent; components: HiwComponent[] };

// Bloom verb → accent, mirroring the real "What you'll master" objective cards
// (IDENTIFY blue, EXPLAIN purple, COMPARE amber…).
const BLOOM_ACCENT: Record<string, LuminaAccent> = {
  Identify: 'blue',
  Explain: 'purple',
  Apply: 'cyan',
  Compare: 'amber',
};

const HIW_TOPICS: HiwTopic[] = [
  {
    topic: 'adding fractions',
    subject: 'Math',
    accent: 'cyan',
    components: [
      { bloom: 'Identify', title: 'Name the parts of a fraction' },
      { bloom: 'Explain', title: 'Build ¾ on a bar' },
      { bloom: 'Apply', title: 'Add halves and quarters' },
      { bloom: 'Compare', title: 'Which fraction is bigger?' },
    ],
  },
  {
    topic: 'the water cycle',
    subject: 'Science',
    accent: 'emerald',
    components: [
      { bloom: 'Identify', title: 'Spot evaporation' },
      { bloom: 'Explain', title: 'Why the rain falls' },
      { bloom: 'Apply', title: 'Run the whole cycle' },
      { bloom: 'Compare', title: 'Rain vs. snow' },
    ],
  },
  {
    topic: 'telling time',
    subject: 'Math',
    accent: 'purple',
    components: [
      { bloom: 'Identify', title: 'Read the hour hand' },
      { bloom: 'Explain', title: 'Minutes around the clock' },
      { bloom: 'Apply', title: 'Set it to 3:30' },
      { bloom: 'Compare', title: 'Morning vs. night' },
    ],
  },
];

const HIW_STEPS: { n: string; title: string; accent: LuminaAccent; caption: string }[] = [
  { n: '1', title: 'Pick anything', accent: 'blue', caption: 'Type a topic — or tap one. Any K–5 idea works.' },
  { n: '2', title: 'Lumina builds the lesson', accent: 'purple', caption: 'Objectives are set, then each component assembles to fit.' },
  { n: '3', title: 'Practice adapts', accent: 'cyan', caption: 'Difficulty moves with mastery until the skill sticks.' },
];

const HIW_LADDER = 5;

const HOW_IT_WORKS_CSS = `
@keyframes luminaCaret { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
.lumina-caret { animation: luminaCaret 1s step-end infinite; }
@media (prefers-reduced-motion: reduce) { .lumina-caret { animation: none; opacity: 1; } }
`;

// One step's frame: a numbered/Check spine marker, a title, the live stage, and
// a caption. The active step is lit; completed steps go green; pending steps dim.
const HiwStageShell: React.FC<{
  step: { n: string; title: string; accent: LuminaAccent; caption: string };
  index: number;
  active: number;
  children: React.ReactNode;
}> = ({ step, index, active, children }) => {
  const done = active > index;
  const isActive = active === index;
  return (
    <LuminaCard surface="glass" topAccent={step.accent}>
      <LuminaCardContent className="flex h-full flex-col gap-4 pt-6">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-all duration-500 ${
              isActive
                ? `${accentSoftBorder[step.accent]} ${accentChipBg[step.accent]} ${accentText[step.accent]} scale-110`
                : done
                  ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/10 bg-white/5 text-slate-500'
            }`}
          >
            {done ? <Check className="h-4 w-4" /> : step.n}
          </div>
          <h3 className={`text-sm font-bold transition-colors ${isActive || done ? 'text-slate-100' : 'text-slate-500'}`}>
            {step.title}
          </h3>
        </div>
        <div className={`flex flex-1 flex-col transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-50'}`}>
          {children}
        </div>
        <p className="text-xs leading-relaxed text-slate-500">{step.caption}</p>
      </LuminaCardContent>
    </LuminaCard>
  );
};

export const HowItWorksDemo: React.FC = () => {
  const [step, setStep] = useState(0); // 0 pick · 1 build · 2 adapt
  const [topicIdx, setTopicIdx] = useState(0);
  const [typed, setTyped] = useState(''); // typewriter for step 0
  const [built, setBuilt] = useState(0); // resolved components for step 1
  const [rung, setRung] = useState(0); // climbed difficulty rung for step 2

  const topic = HIW_TOPICS[topicIdx];

  // Driver — advance pick → build → adapt, then turn to the next topic and loop.
  // Each beat is paced to outlast its inner animation.
  useEffect(() => {
    const STEP_MS = [2300, 2500, 2300];
    const t = setTimeout(() => {
      if (step < 2) setStep(step + 1);
      else {
        setStep(0);
        setTopicIdx((i) => (i + 1) % HIW_TOPICS.length);
      }
    }, STEP_MS[step]);
    return () => clearTimeout(t);
  }, [step, topicIdx]);

  // Step 0 — type the topic out a character at a time; show it whole once past.
  useEffect(() => {
    if (step !== 0) {
      setTyped(topic.topic);
      return;
    }
    setTyped('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(topic.topic.slice(0, i));
      if (i >= topic.topic.length) clearInterval(id);
    }, 70);
    return () => clearInterval(id);
  }, [step, topicIdx, topic.topic]);

  // Step 1 — resolve the assembly rows one by one; hold them all done at step 2.
  useEffect(() => {
    const len = topic.components.length;
    if (step < 1) {
      setBuilt(0);
      return;
    }
    if (step > 1) {
      setBuilt(len);
      return;
    }
    setBuilt(0);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setBuilt(n);
      if (n >= len) clearInterval(id);
    }, 430);
    return () => clearInterval(id);
  }, [step, topicIdx, topic.components.length]);

  // Step 2 — climb the difficulty ladder a rung at a time.
  useEffect(() => {
    if (step !== 2) {
      setRung(0);
      return;
    }
    setRung(0);
    let r = 0;
    const id = setInterval(() => {
      r += 1;
      setRung(r);
      if (r >= HIW_LADDER - 1) clearInterval(id);
    }, 420);
    return () => clearInterval(id);
  }, [step, topicIdx]);

  return (
    <>
      <style>{HOW_IT_WORKS_CSS}</style>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* ── 1 · Pick anything — a topic typed into the box ── */}
        <HiwStageShell step={HIW_STEPS[0]} index={0} active={step}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
              <Sparkles className={`h-4 w-4 shrink-0 ${accentText.blue}`} />
              <span className="truncate text-sm text-slate-100">
                {typed}
                {step === 0 ? (
                  <span className="lumina-caret ml-px inline-block h-4 w-[2px] -translate-y-px bg-slate-300 align-middle" />
                ) : null}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {HIW_TOPICS.map((t, i) => (
                <span
                  key={t.topic}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-all duration-300 ${
                    i === topicIdx
                      ? `${accentSoftBorder.blue} ${accentChipBg.blue} ${accentText.blue}`
                      : 'border-white/10 bg-white/5 text-slate-500'
                  }`}
                >
                  {t.topic}
                </span>
              ))}
            </div>
          </div>
        </HiwStageShell>

        {/* ── 2 · Lumina builds the lesson — the real Component Assembly view ── */}
        <HiwStageShell step={HIW_STEPS[1]} index={1} active={step}>
          {step >= 1 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Component assembly
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  {Math.min(built, topic.components.length)}/{topic.components.length}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {topic.components.map((c, i) => {
                  const ready = i < built;
                  const ba = BLOOM_ACCENT[c.bloom] ?? topic.accent;
                  return (
                    <div
                      key={c.title}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-all duration-300 ${
                        ready ? 'border-emerald-400/20 bg-emerald-500/[0.06]' : 'border-white/10 bg-white/[0.03]'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                          ready ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-500'
                        }`}
                      >
                        {ready ? <Check className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
                      </span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${accentChipBg[ba]} ${accentText[ba]}`}
                      >
                        {c.bloom}
                      </span>
                      <span className={`truncate text-[11px] ${ready ? 'text-slate-200' : 'text-slate-500'}`}>
                        {c.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center gap-1.5 text-xs text-slate-600">
              <Loader2 className="h-4 w-4" /> waiting for a topic…
            </div>
          )}
        </HiwStageShell>

        {/* ── 3 · Practice adapts — the difficulty ladder climbs ── */}
        <HiwStageShell step={HIW_STEPS[2]} index={2} active={step}>
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-center">
              <div className="font-mono text-lg text-slate-100">
                tier {Math.min(rung + 1, HIW_LADDER)}
                <span className="text-slate-600">/{HIW_LADDER}</span>
              </div>
              <div className="mt-0.5 flex h-4 items-center justify-center text-[11px] font-semibold">
                {step === 2 ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Check className="h-3 w-3" /> correct — leveling up
                  </span>
                ) : (
                  <span className="text-slate-600">ready when you are</span>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: HIW_LADDER }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                    step === 2 && i === rung
                      ? 'bg-gradient-to-r from-cyan-400 to-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                      : step === 2 && i < rung
                        ? 'bg-cyan-500/40'
                        : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] uppercase tracking-widest text-slate-500">
              <span>low β</span>
              <span>high β</span>
            </div>
          </div>
        </HiwStageShell>
      </div>
    </>
  );
};

// ── Built for K–5 — an auto-touring curriculum map ───────────────────────
// Show, don't tell. A grade wheel turns through K–5; for the selected grade the
// four core subjects fan out; and the featured subject's units draw themselves
// into a little prerequisite graph — the same curriculum → primitive map the
// adaptive engine routes a learner through. Auto-plays, and every grade and
// subject is clickable.

export type ShowcaseSubject = {
  name: string;
  accent: LuminaAccent;
  icon: React.ReactNode;
  units: string[]; // up to 4 rendered as the diamond graph; relaxed from a fixed tuple so real curricula (any length) fit
  total: number; // real unit count for this grade × subject ("+N more")
  inProgress?: boolean; // not yet published — titles borrowed from grade 4
  /**
   * Optional mastery status per unit (aligned to `units`), from the student's
   * knowledge graph. When present, unit frames are tinted by status instead of
   * the subject accent. Absent on the marketing demo (nodes stay accent-colored).
   */
  unitStatus?: string[];
};

// Mastery-status tint for a unit frame (used only when unitStatus is supplied).
const UNIT_STATUS_CLASSES: Record<string, string> = {
  mastered: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  frontier: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  in_progress: 'border-blue-500/40 bg-blue-500/15 text-blue-200',
  not_started: 'border-white/10 bg-white/[0.04] text-slate-400',
  locked: 'border-slate-700/40 bg-slate-800/40 text-slate-600',
};
export type ShowcaseGrade = { label: string; full: string; subjects: ShowcaseSubject[] };

const SUBJECT_META = {
  math: { name: 'Math', accent: 'cyan' as LuminaAccent, icon: <Calculator className="h-3.5 w-3.5" /> },
  reading: { name: 'Reading', accent: 'pink' as LuminaAccent, icon: <BookOpen className="h-3.5 w-3.5" /> },
  science: { name: 'Science', accent: 'emerald' as LuminaAccent, icon: <FlaskConical className="h-3.5 w-3.5" /> },
  social: { name: 'Social Studies', accent: 'amber' as LuminaAccent, icon: <Globe2 className="h-3.5 w-3.5" /> },
} as const;

/**
 * Map a curriculum-service subject name (e.g. "Mathematics", "Language Arts",
 * "Social Studies") onto the showcase's visual language (accent + icon), so a
 * real-data map reads identically to the demo. Falls back to a neutral accent
 * for anything unrecognized.
 */
export function subjectVisual(subjectName: string): { accent: LuminaAccent; icon: React.ReactNode } {
  const n = subjectName.toLowerCase();
  if (n.includes('math')) return SUBJECT_META.math;
  if (n.includes('read') || n.includes('language') || n.includes('english') || n.includes('ela') || n.includes('literacy'))
    return SUBJECT_META.reading;
  if (n.includes('science')) return SUBJECT_META.science;
  if (n.includes('social') || n.includes('history') || n.includes('geograph') || n.includes('civic'))
    return SUBJECT_META.social;
  return { accent: 'purple', icon: <GraduationCap className="h-3.5 w-3.5" /> };
}

const sub = (
  key: keyof typeof SUBJECT_META,
  units: [string, string, string, string],
  total: number,
  inProgress = false
): ShowcaseSubject => ({ ...SUBJECT_META[key], units, total, inProgress });

// Real unit titles pulled verbatim from the published curriculum service
// (GET /api/curriculum/curriculum/{subject}?grade={g}). Four are shown per
// subject as a peek; `total` is the true count so "+N more" stays honest.
// NOTE: G5 Science + G5 Social Studies aren't published yet — those two cells
// borrow grade 4's real titles and render an "in progress" tag; swap to the
// published titles once those units ship.
const GRADES: ShowcaseGrade[] = [
  {
    label: 'K',
    full: 'Kindergarten',
    subjects: [
      sub('math', ['Counting & Cardinality', 'Operations & Algebraic Thinking', 'Geometry', 'Measurement & Data'], 6),
      sub('reading', ['The Alphabet', 'Phonics & Word Recognition', 'Vocabulary Development', 'Reading Comprehension'], 10),
      sub('science', ['Physical Sciences', 'Life Sciences', 'Earth & Space Sciences', 'Engineering & Technology'], 4),
      sub('social', ['Civics & Government', 'Economics', 'Geography', 'History'], 5),
    ],
  },
  {
    label: '1',
    full: 'Grade 1',
    subjects: [
      sub('math', ['Operations & Algebraic Thinking', 'Number & Operations in Base Ten', 'Measurement & Data', 'Geometry'], 5),
      sub('reading', ['Phonics & Decoding', 'Reading Comprehension & Fluency', 'Grammar & Sentence Building', 'Vocabulary & Word Study'], 7),
      sub('science', ['Sound & Light', 'Structure, Function & Heredity', 'Machines That Build', 'Patterns in the Sky'], 4),
      sub('social', ['Civics & Government', 'Economics', 'Geography', 'History'], 5),
    ],
  },
  {
    label: '2',
    full: 'Grade 2',
    subjects: [
      sub('math', ['Operations & Algebraic Thinking', 'Number & Operations in Base Ten', 'Measurement & Data', 'Geometry'], 4),
      sub('reading', ['Reading Foundations', 'Reading Literature', 'Reading Informational Text', 'Vocabulary'], 7),
      sub('science', ['Properties of Matter', 'Life Sciences', 'Earth Sciences', 'Engineering & Technology'], 4),
      sub('social', ['Civics', 'Economics', 'Geography', 'History'], 5),
    ],
  },
  {
    label: '3',
    full: 'Grade 3',
    subjects: [
      sub('math', ['Operations & Algebraic Thinking', 'Number & Operations — Fractions', 'Geometry', 'Measurement & Data'], 5),
      sub('reading', ['Reading Literature', 'Reading Informational Text', 'Writing', 'Vocabulary'], 6),
      sub('science', ['Forces & Interactions', 'Life Cycles & Traits', 'Ecosystems', 'Weather & Climate'], 5),
      sub('social', ['Civics', 'Economics', 'Geography', 'History'], 4),
    ],
  },
  {
    label: '4',
    full: 'Grade 4',
    subjects: [
      sub('math', ['Operations & Algebraic Thinking', 'Number & Operations in Base Ten', 'Number & Operations — Fractions', 'Geometry'], 5),
      sub('reading', ['Reading Literature', 'Reading Informational Text', 'Writing', 'Language'], 6),
      sub('science', ['Energy', 'Waves', 'Structure & Function', "Earth's Resources"], 5),
      sub('social', ['Civics', 'Economics', 'Geography', 'History'], 4),
    ],
  },
  {
    label: '5',
    full: 'Grade 5',
    subjects: [
      sub('math', ['Operations & Algebraic Thinking', 'Number & Operations in Base Ten', 'Fractions', 'Geometry'], 5),
      sub('reading', ['Reading Literature', 'Reading Informational Text', 'Writing', 'Vocabulary'], 6),
      // G5 Science + Social Studies aren't published yet — borrow grade 4, flag in progress.
      sub('science', ['Energy', 'Waves', 'Structure & Function', "Earth's Resources"], 5, true),
      sub('social', ['Civics', 'Economics', 'Geography', 'History'], 4, true),
    ],
  },
];

// Diamond DAG — entry → two parallel strands → convergence. Percentages map
// 1:1 onto both the SVG edge layer (viewBox 0 0 100 100) and the HTML frames.
const NODE_POS = [
  { x: 14, y: 50 },
  { x: 47, y: 18 },
  { x: 47, y: 82 },
  { x: 84, y: 50 },
];
const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
];

// Entrance + idle-float for the unit frames, draw-in for the edges, slow spin
// for the wheel's accent ring. Re-mounting the keyed graph replays the first
// two; reduced-motion users get the resting state.
const SHOWCASE_CSS = `
@keyframes luminaNodeIn { from { opacity: 0; transform: translateY(6px) scale(.85); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes luminaFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes luminaDraw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes luminaSpin { to { transform: rotate(360deg); } }
.lumina-node { animation: luminaNodeIn .5s ease-out both, luminaFloat 4.5s ease-in-out infinite; }
.lumina-edge { stroke-dasharray: 1; stroke-dashoffset: 1; animation: luminaDraw .7s ease-out forwards; }
.lumina-wheel-ring { animation: luminaSpin 44s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .lumina-node, .lumina-edge, .lumina-wheel-ring { animation: none !important; }
  .lumina-edge { stroke-dashoffset: 0; }
  .lumina-node { opacity: 1; }
}
`;

export interface CurriculumShowcaseProps {
  /** Grades to render. Defaults to the built-in K–5 marketing demo data. */
  grades?: ShowcaseGrade[];
  /** Which grade the wheel opens on. Defaults to Grade 3 (the richest demo map). */
  initialGradeIndex?: number;
  /** Auto-walk subjects then grades. Defaults to true (marketing); turn off for a pinned student view. */
  autoTour?: boolean;
  /** Notified when a grade is selected — lets a data-driven parent lazily load that grade's units. */
  onSelectGrade?: (gradeIndex: number) => void;
  /**
   * Notified when a subject becomes the featured one (on chip click and for the
   * initial/grade-change selection) — lets a data-driven parent lazily load just
   * that subject's mastery graph instead of all subjects at once.
   */
  onSelectSubject?: (gradeIndex: number, subjectIndex: number) => void;
  /** Notified when a unit frame is clicked. When set, unit frames become clickable (deep dive). */
  onSelectUnit?: (gradeIndex: number, subjectIndex: number, unitIndex: number) => void;
}

export const CurriculumShowcase: React.FC<CurriculumShowcaseProps> = ({
  grades = GRADES,
  initialGradeIndex = 3,
  autoTour = true,
  onSelectGrade,
  onSelectSubject,
  onSelectUnit,
}) => {
  const clamp = (i: number) => Math.min(Math.max(i, 0), Math.max(grades.length - 1, 0));
  const [g, setG] = useState(() => clamp(initialGradeIndex)); // grade index
  const [s, setS] = useState(0); // featured subject index

  // Auto-tour: walk a grade's subjects, then turn the wheel. Off for pinned views.
  useEffect(() => {
    if (!autoTour) return;
    const t = setTimeout(() => {
      if (s < grades[g].subjects.length - 1) setS(s + 1);
      else {
        setS(0);
        setG((prev) => (prev + 1) % grades.length);
      }
    }, 2600);
    return () => clearTimeout(t);
  }, [g, s, autoTour, grades]);

  const grade = grades[g] ?? grades[0];
  const subject = grade?.subjects[s] ?? grade?.subjects[0];
  const accent = subject?.accent ?? 'cyan';

  const pickGrade = (i: number) => {
    SoundManager.tap();
    setG(i);
    setS(0);
    onSelectGrade?.(i);
  };
  const pickSubject = (i: number) => {
    SoundManager.select();
    setS(i);
  };

  // Lazily load the featured subject's mastery graph — on first paint and
  // whenever the grade or featured subject changes (incl. chip clicks and
  // auto-tour). Keeps the parent from building every subject's graph up front.
  useEffect(() => {
    onSelectSubject?.(g, s);
  }, [g, s, onSelectSubject]);

  // A data-driven parent can hand us an empty/still-loading grade; render nothing
  // rather than crash until the units arrive.
  if (!grade || !subject) return null;

  return (
    <LuminaCard surface="glass" topAccent="emerald">
      <style>{SHOWCASE_CSS}</style>
      <LuminaCardContent className="grid grid-cols-1 items-center gap-8 p-6 md:grid-cols-[240px,1fr] md:gap-10 md:p-8">
        {/* ── Grade wheel ── */}
        <div className="relative mx-auto aspect-square w-full max-w-[230px]">
          <div className="lumina-wheel-ring absolute inset-1 rounded-full border border-dashed border-white/10" />
          <div className="absolute inset-3 rounded-full bg-gradient-to-br from-cyan-500/[0.07] to-purple-500/[0.07]" />

          {/* Center hub — the active grade */}
          <div className="absolute left-1/2 top-1/2 flex h-[36%] w-[36%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-white/15 bg-slate-900/70 backdrop-blur-md">
            <span className="text-2xl font-bold leading-none text-white">{grade.label}</span>
            <span className="mt-1 text-[8px] font-semibold uppercase tracking-widest text-slate-500">
              {g === 0 ? 'Kinder' : 'Grade'}
            </span>
          </div>

          {/* Grade tokens around the ring — evenly spaced for however many grades */}
          {grades.map((gr, i) => {
            const ang = ((-90 + i * (360 / grades.length)) * Math.PI) / 180;
            const x = 50 + 38 * Math.cos(ang);
            const y = 50 + 38 * Math.sin(ang);
            const active = i === g;
            return (
              <button
                key={gr.label}
                type="button"
                onClick={() => pickGrade(i)}
                style={{ left: `${x}%`, top: `${y}%` }}
                aria-label={gr.full}
                className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-sm font-bold transition-all duration-300 ${
                  active
                    ? 'scale-125 border-white/30 bg-gradient-to-br from-cyan-400/30 to-purple-400/30 text-white shadow-[0_0_18px_rgba(168,85,247,0.45)]'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/25 hover:text-slate-200'
                }`}
              >
                {gr.label}
              </button>
            );
          })}
        </div>

        {/* ── Subjects + unit graph ── */}
        <div className="flex flex-col gap-4">
          {/* Subject chips */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {grade.subjects.map((sj, i) => {
              const on = i === s;
              return (
                <button
                  key={sj.name}
                  type="button"
                  onClick={() => pickSubject(i)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-all ${
                    on
                      ? `${accentChipBg[sj.accent]} ${accentSoftBorder[sj.accent]} ${accentText[sj.accent]}`
                      : 'border-white/10 bg-white/[0.03] text-slate-500 hover:border-white/20 hover:text-slate-300'
                  }`}
                >
                  <span className={on ? accentText[sj.accent] : 'text-slate-500'}>{sj.icon}</span>
                  <span className="truncate">{sj.name}</span>
                </button>
              );
            })}
          </div>

          {/* The floating frame graph — units of the featured subject */}
          <div className="relative">
            <div className="mb-1 flex items-center justify-between">
              <span className={`text-xs font-bold ${accentText[accent]}`}>{subject.name} · units</span>
              {subject.inProgress ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                  In progress
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-widest text-slate-500">
                  mapped &amp; sequenced
                </span>
              )}
            </div>

            <div key={`${g}-${s}`} className="relative h-52 w-full">
              {/* Real curricula can carry any number of units; the diamond shows
                  up to 4 (and "+N more"). Empty units mean the parent is still
                  fetching this grade — show a shimmer instead of a bare frame. */}
              {(() => {
                const nodes = subject.units.slice(0, 4);
                if (nodes.length === 0) {
                  return (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-xs text-slate-500 animate-pulse">Loading units…</span>
                    </div>
                  );
                }
                return (
                  <>
                    {/* Edge layer — prerequisite arrows, drawn behind the frames.
                        Only edges between rendered nodes, so fewer than 4 units
                        never leave a connector dangling into empty space. */}
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="absolute inset-0 h-full w-full"
                      aria-hidden
                    >
                      {EDGES.filter(([a, b]) => a < nodes.length && b < nodes.length).map(([a, b], i) => (
                        <line
                          key={i}
                          x1={NODE_POS[a].x}
                          y1={NODE_POS[a].y}
                          x2={NODE_POS[b].x}
                          y2={NODE_POS[b].y}
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          pathLength={1}
                          style={{ animationDelay: `${0.15 * i}s` }}
                          className={`lumina-edge ${accentText[accent]} opacity-50`}
                        />
                      ))}
                    </svg>

                    {/* Unit frames — uniform width, and opaque so the connectors
                        tuck cleanly under each card edge instead of crossing through.
                        Clickable (deep dive) + status-tinted when the parent supplies
                        those; otherwise a plain accent-colored frame (marketing demo). */}
                    {nodes.map((u, i) => {
                      const statusCls = subject.unitStatus?.[i]
                        ? UNIT_STATUS_CLASSES[subject.unitStatus[i]]
                        : undefined;
                      const frameInner = (
                        <>
                          {/* Opaque base — occludes any connector running beneath the card */}
                          <span className="absolute inset-0 bg-slate-950" />
                          <div
                            className={`relative flex min-h-[44px] items-center justify-center rounded-lg border px-2.5 py-1.5 text-center text-[10px] font-semibold leading-[1.2] ${
                              statusCls ?? `${accentSoftBorder[accent]} ${accentChipBg[accent]} ${accentText[accent]}`
                            }`}
                          >
                            {u}
                          </div>
                        </>
                      );
                      const nodeCls = 'lumina-node relative w-[136px] overflow-hidden rounded-lg shadow-lg shadow-black/30';
                      return (
                        <div
                          key={i}
                          style={{ left: `${NODE_POS[i].x}%`, top: `${NODE_POS[i].y}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2"
                        >
                          {onSelectUnit ? (
                            <button
                              type="button"
                              onClick={() => onSelectUnit(g, s, i)}
                              style={{ animationDelay: `${0.08 * i}s` }}
                              className={`${nodeCls} cursor-pointer transition-transform hover:scale-[1.05] focus:outline-none focus:ring-2 focus:ring-white/40`}
                            >
                              {frameInner}
                            </button>
                          ) : (
                            <div className={nodeCls} style={{ animationDelay: `${0.08 * i}s` }}>
                              {frameInner}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* +N more — keeps "4 shown of {total}" honest */}
                    {subject.total > 4 && (
                      <span className="absolute bottom-0 right-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                        +{subject.total - 4} more
                      </span>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Footer caption */}
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" /> {grade.full}
              </span>
              <span className="hidden sm:inline">Math · Reading · Science · Social Studies</span>
            </div>
          </div>
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
};
