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

// ── Built for K–5 — an auto-touring curriculum map ───────────────────────
// Show, don't tell. A grade wheel turns through K–5; for the selected grade the
// four core subjects fan out; and the featured subject's units draw themselves
// into a little prerequisite graph — the same curriculum → primitive map the
// adaptive engine routes a learner through. Auto-plays, and every grade and
// subject is clickable.

type ShowcaseSubject = {
  name: string;
  accent: LuminaAccent;
  icon: React.ReactNode;
  units: [string, string, string, string];
};
type ShowcaseGrade = { label: string; full: string; subjects: ShowcaseSubject[] };

const SUBJECT_META = {
  math: { name: 'Math', accent: 'cyan' as LuminaAccent, icon: <Calculator className="h-3.5 w-3.5" /> },
  reading: { name: 'Reading', accent: 'pink' as LuminaAccent, icon: <BookOpen className="h-3.5 w-3.5" /> },
  science: { name: 'Science', accent: 'emerald' as LuminaAccent, icon: <FlaskConical className="h-3.5 w-3.5" /> },
  social: { name: 'Social Studies', accent: 'amber' as LuminaAccent, icon: <Globe2 className="h-3.5 w-3.5" /> },
} as const;

const sub = (
  key: keyof typeof SUBJECT_META,
  units: [string, string, string, string]
): ShowcaseSubject => ({ ...SUBJECT_META[key], units });

const GRADES: ShowcaseGrade[] = [
  {
    label: 'K',
    full: 'Kindergarten',
    subjects: [
      sub('math', ['Count to 20', 'Compare sets', '2-D shapes', 'Add within 5']),
      sub('reading', ['Letter sounds', 'Rhyming', 'Sight words', 'Story retell']),
      sub('science', ['Five senses', 'Weather', 'Living vs not', 'Push & pull']),
      sub('social', ['My family', 'Community helpers', 'Maps & globes', 'Rules']),
    ],
  },
  {
    label: '1',
    full: 'Grade 1',
    subjects: [
      sub('math', ['Add within 20', 'Place value', 'Measure length', 'Time to hour']),
      sub('reading', ['Blends', 'Vowel teams', 'Main idea', 'Sequence events']),
      sub('science', ['Light & sound', 'Plant parts', 'Sun & seasons', 'Materials']),
      sub('social', ['Neighborhoods', 'Needs & wants', 'Past & present', 'Symbols']),
    ],
  },
  {
    label: '2',
    full: 'Grade 2',
    subjects: [
      sub('math', ['Regroup add', 'Arrays', 'Money', 'Bar graphs']),
      sub('reading', ['Prefixes', 'Compare texts', 'Context clues', 'Point of view']),
      sub('science', ['States of matter', 'Habitats', 'Earth changes', 'Life cycles']),
      sub('social', ['Communities', 'Goods & services', 'Landforms', 'Government']),
    ],
  },
  {
    label: '3',
    full: 'Grade 3',
    subjects: [
      sub('math', ['Multiplication', 'Fractions', 'Area', 'Perimeter']),
      sub('reading', ['Multisyllable', 'Theme', 'Text features', 'Inference']),
      sub('science', ['Forces', 'Adaptations', 'Weather data', 'Fossils']),
      sub('social', ['Regions', 'Economy basics', 'Maps & routes', 'Citizenship']),
    ],
  },
  {
    label: '4',
    full: 'Grade 4',
    subjects: [
      sub('math', ['Multi-digit ×', 'Equiv. fractions', 'Decimals', 'Angles']),
      sub('reading', ['Root words', 'Summarize', "Author's purpose", 'Compare POV']),
      sub('science', ['Energy', 'Waves', 'Earth systems', 'Structures of life']),
      sub('social', ['U.S. regions', 'Trade', 'Geography', 'Branches of gov']),
    ],
  },
  {
    label: '5',
    full: 'Grade 5',
    subjects: [
      sub('math', ['Decimal ops', 'Volume', 'Coordinate plane', 'Multiply fractions']),
      sub('reading', ['Figurative language', 'Argument', 'Synthesize', 'Tone']),
      sub('science', ['Ecosystems', 'Matter cycles', 'Space systems', 'Engineering']),
      sub('social', ['Early America', 'Economics', 'Map skills', 'Constitution']),
    ],
  },
];

// Diamond DAG — entry → two parallel strands → convergence. Percentages map
// 1:1 onto both the SVG edge layer (viewBox 0 0 100 100) and the HTML frames.
const NODE_POS = [
  { x: 13, y: 50 },
  { x: 45, y: 17 },
  { x: 45, y: 83 },
  { x: 86, y: 50 },
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

export const CurriculumShowcase: React.FC = () => {
  const [g, setG] = useState(3); // grade index — open on Grade 3 (richest map)
  const [s, setS] = useState(0); // featured subject index

  // Auto-tour: walk the four subjects of a grade, then turn the wheel.
  useEffect(() => {
    const t = setTimeout(() => {
      if (s < 3) setS(s + 1);
      else {
        setS(0);
        setG((prev) => (prev + 1) % GRADES.length);
      }
    }, 2600);
    return () => clearTimeout(t);
  }, [g, s]);

  const grade = GRADES[g];
  const subject = grade.subjects[s];
  const accent = subject.accent;

  const pickGrade = (i: number) => {
    SoundManager.tap();
    setG(i);
    setS(0);
  };
  const pickSubject = (i: number) => {
    SoundManager.select();
    setS(i);
  };

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

          {/* Grade tokens around the ring */}
          {GRADES.map((gr, i) => {
            const ang = ((-90 + i * 60) * Math.PI) / 180;
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
              <span className="text-[10px] uppercase tracking-widest text-slate-500">
                mapped &amp; sequenced
              </span>
            </div>

            <div key={`${g}-${s}`} className="relative h-44 w-full">
              {/* Edge layer — prerequisite arrows, drawn behind the frames */}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                aria-hidden
              >
                {EDGES.map(([a, b], i) => (
                  <line
                    key={i}
                    x1={NODE_POS[a].x}
                    y1={NODE_POS[a].y}
                    x2={NODE_POS[b].x}
                    y2={NODE_POS[b].y}
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    pathLength={1}
                    style={{ animationDelay: `${0.15 * i}s` }}
                    className={`lumina-edge ${accentText[accent]} opacity-40`}
                  />
                ))}
              </svg>

              {/* Unit frames */}
              {subject.units.map((u, i) => (
                <div
                  key={i}
                  style={{ left: `${NODE_POS[i].x}%`, top: `${NODE_POS[i].y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                >
                  <div className="lumina-node" style={{ animationDelay: `${0.08 * i}s` }}>
                    <div
                      className={`flex max-w-[100px] items-center justify-center rounded-lg border px-2 py-1.5 text-center text-[11px] font-semibold leading-tight backdrop-blur-md ${accentSoftBorder[accent]} ${accentChipBg[accent]} ${accentText[accent]}`}
                    >
                      {u}
                    </div>
                  </div>
                </div>
              ))}
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
