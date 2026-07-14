'use client';

/**
 * DesignStudio — the living storybook for the Lumina UI kit (`lumina/ui`).
 *
 * Renders every chrome element independently so the aesthetic can be reviewed
 * and evolved in one place. Edit `lumina/ui/tokens.ts` and everything here —
 * and every primitive — moves together. Styled in the Sound Lab aesthetic.
 *
 * This component dogfoods the kit: it is built FROM `Lumina*` components and
 * tokens, so it doubles as a smoke test that the kit renders correctly.
 */
import React, { useEffect, useRef, useState } from 'react';
import { X, Check, Lightbulb, AlertTriangle, Gauge, Wrench, Clock } from 'lucide-react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardDescription,
  LuminaCardContent,
  LuminaButton,
  LuminaBadge,
  LuminaPanel,
  LuminaCallout,
  LuminaSectionLabel,
  LuminaSlider,
  LuminaStat,
  LuminaChoiceChip,
  LuminaAccordion,
  LuminaAccordionItem,
  LuminaProgress,
  LuminaStepper,
  LuminaModeTabs,
  LuminaChallengeCounter,
  LuminaPrompt,
  LuminaInlineStat,
  LuminaTable,
  LuminaFeedbackCard,
  LuminaAnswerChoice,
  LuminaActionButton,
  LuminaHintDisclosure,
  LuminaScoreRing,
  LuminaFillBlankSlot,
  LuminaChip,
  LuminaChipBank,
  LuminaInput,
  LuminaMark,
  LuminaDropZone,
  type DropZoneState,
  type AnswerChoiceState,
  LUMINA_ACCENTS,
  answerStateClasses,
  motion,
  accentText,
  accentBorder,
  accentGlow,
  surface,
  text,
  type LuminaAccent,
} from '../ui';

interface DesignStudioProps {
  onBack: () => void;
}

// ── A labelled showcase cell with an optional usage snippet ──────────────
const Spec: React.FC<{
  label: string;
  code?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, code, children, className }) => (
  <div className={`space-y-2 ${className ?? ''}`}>
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{label}</span>
      {code && (
        <code className="text-[10px] font-mono text-slate-500 truncate">{code}</code>
      )}
    </div>
    {children}
  </div>
);

// ── A section header in the Sound Lab style ──────────────────────────────
const Section: React.FC<{ title: string; blurb: string; children: React.ReactNode }> = ({
  title,
  blurb,
  children,
}) => (
  <section className="space-y-3">
    <div className="flex items-baseline gap-3">
      <h2 className="text-lg font-bold text-slate-100">{title}</h2>
      <p className="text-xs text-slate-500">{blurb}</p>
    </div>
    {children}
  </section>
);

// Drop-zone demo content — inputs (true) vs outputs (false) of photosynthesis.
const DROP_WORDS: { word: string; ok: boolean }[] = [
  { word: 'sunlight', ok: true },
  { word: 'water', ok: true },
  { word: 'glucose', ok: false },
  { word: 'carbon dioxide', ok: true },
  { word: 'oxygen', ok: false },
];

const DROP_ZONE_STATES: DropZoneState[] = ['idle', 'dragOver', 'filled', 'correct', 'incorrect'];

const SURFACES: { key: keyof typeof surface; blurb: string }[] = [
  { key: 'glass', blurb: 'Default Lumina card' },
  { key: 'nested', blurb: 'Section inside a card' },
  { key: 'elevated', blurb: 'Modal / focal surface' },
];

export const DesignStudio: React.FC<DesignStudioProps> = ({ onBack }) => {
  const [disabled, setDisabled] = useState(false);
  const [markProgress, setMarkProgress] = useState(65);
  const [force, setForce] = useState(50);
  const [selectedChip, setSelectedChip] = useState('tracks');
  const [count, setCount] = useState(3);
  // Motion demos replay by remounting the animated node (key bump).
  const [popKey, setPopKey] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [revealKey, setRevealKey] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // Drop-zone demo — mechanics live here (the "primitive"); colors/motion from the kit.
  const [zoneState, setZoneState] = useState<DropZoneState>('idle');
  const [placedWords, setPlacedWords] = useState<string[]>([]);
  const [heldWord, setHeldWord] = useState<string | null>(null); // tap-to-place selection
  const dragWord = useRef<string | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    []
  );
  const gradeDrop = (word: string | null) => {
    if (!word) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    const ok = DROP_WORDS.some((w) => w.word === word && w.ok);
    const nextPlaced = ok ? [...placedWords, word] : placedWords;
    if (ok) setPlacedWords(nextPlaced);
    setHeldWord(null);
    setZoneState(ok ? 'correct' : 'incorrect');
    settleTimer.current = setTimeout(
      () => setZoneState(nextPlaced.length > 0 ? 'filled' : 'idle'),
      900
    );
  };
  const resetDropDemo = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setPlacedWords([]);
    setHeldWord(null);
    setZoneState('idle');
  };
  const correctAnswer = true;
  const isCorrect = answer === correctAnswer;
  const choiceState = (v: boolean): AnswerChoiceState =>
    !submitted
      ? answer === v
        ? 'selected'
        : 'idle'
      : v === correctAnswer
        ? 'correct'
        : answer === v
          ? 'incorrect'
          : 'dimmed';

  return (
    <div className="flex-1 animate-fade-in max-w-5xl mx-auto w-full px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <LuminaButton onClick={onBack} className="text-slate-300">
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </LuminaButton>
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <span>🎨</span> Design Studio
          </h1>
          <p className="text-sm text-slate-400">
            The Lumina UI kit — every chrome element, live. Edit{' '}
            <code className="text-slate-300">lumina/ui/tokens.ts</code> and all of it (and every
            primitive) evolves at once.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main column ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {/* Brand mark */}
          <Section title="Brand mark" blurb="LuminaMark — the Aurora Core, which doubles as a progress ring">
            <LuminaCard>
              <LuminaCardContent className="pt-6 space-y-6">
                <Spec label="Identity" code="<LuminaMark /> · variant='tile' | 'bare'">
                  <div className="flex items-end gap-8">
                    <div className="flex flex-col items-center gap-2">
                      <LuminaMark size={72} />
                      <span className="text-[10px] font-mono text-slate-500">tile · logo</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <LuminaMark size={72} variant="bare" />
                      <span className="text-[10px] font-mono text-slate-500">bare · inline</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <LuminaMark size={32} />
                      <span className="text-xl font-bold tracking-tight text-white">
                        Lumina <span className="text-slate-500 font-light">Exhibits</span>
                      </span>
                    </div>
                  </div>
                </Spec>

                <Spec label="Reactive progress" code="<LuminaMark progress={pct} /> — fills as the lesson advances">
                  <div className="space-y-4">
                    <div className="flex items-end justify-between gap-6">
                      {[0, 25, 50, 75, 100].map((p) => (
                        <div key={p} className="flex flex-col items-center gap-2">
                          <LuminaMark size={56} progress={p} />
                          <span className="text-[10px] font-mono text-slate-500">{p}%</span>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-4">
                        <LuminaMark size={64} progress={markProgress} />
                        <LuminaMark size={64} progress={markProgress} variant="bare" />
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                              Lesson progress
                            </span>
                            <span className={`text-xs font-mono ${accentText.purple}`}>{markProgress}%</span>
                          </div>
                          <LuminaSlider
                            accent="purple"
                            value={[markProgress]}
                            onValueChange={([v]) => setMarkProgress(v)}
                            min={0}
                            max={100}
                            step={1}
                          />
                          <p className="text-[11px] text-slate-500">
                            Drag — the ring fills clockwise and the core lights up as it nears 100%.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Spec>
              </LuminaCardContent>
            </LuminaCard>
          </Section>

          {/* Surfaces */}
          <Section title="Surfaces" blurb="LuminaCard — the glass containers">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SURFACES.map(({ key, blurb }) => (
                <LuminaCard key={key} surface={key}>
                  <LuminaCardHeader>
                    <LuminaCardTitle className="text-base">{key}</LuminaCardTitle>
                    <LuminaCardDescription>{blurb}</LuminaCardDescription>
                  </LuminaCardHeader>
                  <LuminaCardContent>
                    <code className="text-[10px] font-mono text-slate-500">surface="{key}"</code>
                  </LuminaCardContent>
                </LuminaCard>
              ))}
            </div>
          </Section>

          {/* Buttons */}
          <Section title="Buttons" blurb="LuminaButton — tone maps to intent">
            <LuminaCard>
              <LuminaCardContent className="pt-6 space-y-4">
                <Spec label="Tones" code='tone="ghost | primary | danger | subtle"'>
                  <div className="flex flex-wrap gap-2">
                    <LuminaButton disabled={disabled}>Ghost</LuminaButton>
                    <LuminaButton tone="primary" disabled={disabled}>
                      Primary
                    </LuminaButton>
                    <LuminaButton tone="danger" disabled={disabled}>
                      Danger
                    </LuminaButton>
                    <LuminaButton tone="subtle" disabled={disabled}>
                      Subtle
                    </LuminaButton>
                  </div>
                </Spec>
                <Spec label="Sizes" code='size="sm | default | lg"'>
                  <div className="flex flex-wrap items-center gap-2">
                    <LuminaButton size="sm">Small</LuminaButton>
                    <LuminaButton size="default">Default</LuminaButton>
                    <LuminaButton size="lg">Large</LuminaButton>
                  </div>
                </Spec>
                <div className="flex items-center gap-2 pt-1">
                  <LuminaButton tone="subtle" size="sm" onClick={() => setDisabled((d) => !d)}>
                    {disabled ? 'Enable' : 'Disable'} the buttons above
                  </LuminaButton>
                  <span className="text-[11px] text-slate-500">
                    disabled state is inherited from shadcn
                  </span>
                </div>
              </LuminaCardContent>
            </LuminaCard>
          </Section>

          {/* Badges */}
          <Section title="Badges" blurb="LuminaBadge — accent drives the category color">
            <LuminaCard>
              <LuminaCardContent className="pt-6 space-y-4">
                <Spec label="Default" code="<LuminaBadge>">
                  <LuminaBadge>Neutral</LuminaBadge>
                </Spec>
                <Spec label="Accents" code='accent="…"'>
                  <div className="flex flex-wrap gap-2">
                    {LUMINA_ACCENTS.map((accent) => (
                      <LuminaBadge key={accent} accent={accent}>
                        {accent}
                      </LuminaBadge>
                    ))}
                  </div>
                </Spec>
              </LuminaCardContent>
            </LuminaCard>
          </Section>

          {/* Panels */}
          <Section title="Panels" blurb="LuminaPanel — nested sections & readouts">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LuminaPanel>
                <p className={`text-sm ${text.primary}`}>Plain panel</p>
                <code className="text-[10px] font-mono text-slate-500">{'<LuminaPanel>'}</code>
              </LuminaPanel>
              <LuminaPanel accent="cyan">
                <p className={`text-sm ${text.primary}`}>With accent rail</p>
                <code className="text-[10px] font-mono text-slate-500">accent="cyan"</code>
              </LuminaPanel>
            </div>
          </Section>

          {/* Text hierarchy */}
          <Section title="Text hierarchy" blurb="The slate ramp from tokens.text">
            <LuminaCard>
              <LuminaCardContent className="pt-6 space-y-2">
                <p className={text.primary}>Primary — text-slate-100 · main content</p>
                <p className={text.secondary}>Secondary — text-slate-400 · descriptions</p>
                <p className={text.muted}>Muted — text-slate-600 · labels, metadata</p>
              </LuminaCardContent>
            </LuminaCard>
          </Section>

          {/* Accent tokens */}
          <Section title="Accent tokens" blurb="text · border · glow, per accent">
            <LuminaCard>
              <LuminaCardContent className="pt-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {LUMINA_ACCENTS.map((accent: LuminaAccent) => (
                    <div
                      key={accent}
                      className={`rounded-lg border p-3 ${accentBorder[accent]} ${accentGlow[accent]}`}
                    >
                      <p className={`text-sm font-semibold ${accentText[accent]}`}>{accent}</p>
                      <p className="text-[10px] font-mono text-slate-500 mt-1">-300 / -400/30 / -500/10</p>
                    </div>
                  ))}
                </div>
              </LuminaCardContent>
            </LuminaCard>
          </Section>

          {/* Motion */}
          <Section title="Motion" blurb="motion tokens — the feedback grammar: pop · shake · reveal · press">
            <LuminaCard>
              <LuminaCardContent className="pt-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Spec label="Pop — correct lands" code="motion.pop">
                    <button
                      key={`pop-${popKey}`}
                      type="button"
                      onClick={() => setPopKey((k) => k + 1)}
                      className={`w-full rounded-xl border p-4 text-center text-lg font-bold ${answerStateClasses.correct} ${motion.pop}`}
                    >
                      7 × 8 = 56
                    </button>
                    <p className="text-[11px] text-slate-500">Click to replay — 350ms spring overshoot.</p>
                  </Spec>
                  <Spec label="Shake — incorrect" code="motion.shake">
                    <button
                      key={`shake-${shakeKey}`}
                      type="button"
                      onClick={() => setShakeKey((k) => k + 1)}
                      className={`w-full rounded-xl border p-4 text-center text-lg font-bold ${answerStateClasses.incorrect} ${motion.shake}`}
                    >
                      7 × 8 = 54
                    </button>
                    <p className="text-[11px] text-slate-500">
                      Click to replay — decaying shake reads as &ldquo;try again&rdquo;, not punishment.
                    </p>
                  </Spec>
                </div>

                <Spec label="Reveal — feedback enters" code="motion.reveal — baked into LuminaFeedbackCard">
                  <div className="space-y-3">
                    <LuminaButton tone="subtle" size="sm" onClick={() => setRevealKey((k) => k + 1)}>
                      Replay reveal
                    </LuminaButton>
                    <LuminaFeedbackCard
                      key={revealKey}
                      status="correct"
                      teachingNote="One entrance for every feedback card, hint, and results panel."
                    >
                      Spreading weight over a larger area lowers the pressure on the ground.
                    </LuminaFeedbackCard>
                  </div>
                </Spec>

                <Spec label="Press + duration ramp" code="motion.press · motion.transition · motion.transitionSlow">
                  <div className="flex flex-wrap items-center gap-2">
                    <LuminaButton tone="primary" className={motion.press}>
                      Press me
                    </LuminaButton>
                    <span
                      className={`cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:-translate-y-0.5 hover:bg-white/10 ${motion.transition}`}
                    >
                      standard · 200ms
                    </span>
                    <span
                      className={`cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:-translate-y-0.5 hover:bg-white/10 ${motion.transitionSlow}`}
                    >
                      gentle · 300ms
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Hover to compare the two blessed durations; press compresses via active:scale-95. All
                    motions are motion-safe: they vanish under prefers-reduced-motion. The evaluation loop
                    below now pops/shakes automatically — LuminaAnswerChoice wires grading motion in.
                  </p>
                </Spec>
              </LuminaCardContent>
            </LuminaCard>
          </Section>

          {/* Section labels */}
          <Section title="Section labels" blurb="LuminaSectionLabel — accent eyebrow headers">
            <LuminaCard>
              <LuminaCardContent className="pt-6 space-y-4">
                <LuminaSectionLabel accent="purple">Synthesis &amp; Analysis</LuminaSectionLabel>
                <LuminaSectionLabel accent="cyan" size="sm">In the Diagram</LuminaSectionLabel>
              </LuminaCardContent>
            </LuminaCard>
          </Section>

          {/* Callouts */}
          <Section title="Callouts" blurb="LuminaCallout — the most-repeated pattern">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LuminaCallout accent="rose" label="Key Differences" icon={<X className="w-4 h-4" />}>
                Wheels focus weight on a point; tracks spread it across a line.
              </LuminaCallout>
              <LuminaCallout accent="emerald" label="Key Similarities" icon={<Check className="w-4 h-4" />}>
                Both help heavy machines move from place to place.
              </LuminaCallout>
              <LuminaCallout accent="blue" label="When to Use" icon={<Lightbulb className="w-4 h-4" />}>
                Use tracks in deep mud where you need to stay on top.
              </LuminaCallout>
              <LuminaCallout accent="amber" label="Common Misconception" icon={<AlertTriangle className="w-4 h-4" />} italic>
                Tracks aren&apos;t just heavy metal — it&apos;s the surface area.
              </LuminaCallout>
            </div>
          </Section>

          {/* Stats */}
          <Section title="Stat tiles" blurb="LuminaStat — living-simulation readouts">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <LuminaStat label="Pressure" value="4.0" unit="N/cm²" />
              <LuminaStat label="Output Force" value={450} unit="Newtons" accent="amber" />
              <LuminaStat label="Multiplier" value="9.0x" unit="area ratio" accent="cyan" />
              <LuminaStat label="Load Status" value="Stuck" accent="rose" />
            </div>
          </Section>

          {/* Sliders */}
          <Section title="Sliders" blurb="LuminaSlider — drag it: smooth tracking, integer output, grow-on-grab">
            <LuminaCard>
              <LuminaCardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Input Force
                    </span>
                    <span className={`text-xs font-mono ${accentText.cyan}`}>{force} N</span>
                  </div>
                  <LuminaSlider
                    accent="cyan"
                    value={[force]}
                    onValueChange={([v]) => setForce(v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>
                <LuminaSlider accent="amber" defaultValue={[70]} min={0} max={100} step={1} />
              </LuminaCardContent>
            </LuminaCard>
          </Section>

          {/* Choice chips */}
          <Section title="Choice chips" blurb="LuminaChoiceChip — labelled selectors">
            <LuminaCard>
              <LuminaCardContent className="pt-6">
                <div className="flex flex-wrap gap-2">
                  <LuminaChoiceChip
                    accent="cyan"
                    label="Tracks"
                    selected={selectedChip === 'tracks'}
                    onClick={() => setSelectedChip('tracks')}
                  />
                  <LuminaChoiceChip
                    accent="orange"
                    label="The House"
                    selected={selectedChip === 'house'}
                    onClick={() => setSelectedChip('house')}
                  />
                  <LuminaChoiceChip
                    accent="emerald"
                    label="The Boom"
                    selected={selectedChip === 'boom'}
                    onClick={() => setSelectedChip('boom')}
                  />
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>explored</span>
                    <span>1/3</span>
                  </div>
                  <LuminaProgress value={33} accent="cyan" />
                </div>
              </LuminaCardContent>
            </LuminaCard>
          </Section>

          {/* Accordion */}
          <Section title="Accordion" blurb="LuminaAccordion — profile sections">
            <LuminaAccordion type="single" collapsible defaultValue="stats">
              <LuminaAccordionItem value="stats" accent="amber" icon={<Gauge className="w-5 h-5" />} label="Quick Stats">
                <p className="text-sm text-slate-300">Top speed, weight, range…</p>
              </LuminaAccordionItem>
              <LuminaAccordionItem value="parts" accent="cyan" icon={<Wrench className="w-5 h-5" />} label="Key Components">
                <p className="text-sm text-slate-300">Boom, house, tracks…</p>
              </LuminaAccordionItem>
              <LuminaAccordionItem value="history" accent="purple" icon={<Clock className="w-5 h-5" />} label="History">
                <p className="text-sm text-slate-300">Invented 1882; hydraulics in the 1950s…</p>
              </LuminaAccordionItem>
            </LuminaAccordion>
          </Section>

          {/* Table */}
          <Section title="Table" blurb="LuminaTable — data-driven glass data table">
            <LuminaTable
              accent="emerald"
              caption="Comparative analysis of decoherence parameters in optical substrate media"
              columns={['Substrate Medium', 'Intrinsic Loss (dB/cm)', 'Coherence (ms)', 'Thermal Drift (ppm/K)']}
              rows={[
                ['Fused Silica', '0.001 - 0.005', '500 - 800', '0.5 - 0.8'],
                ['Standard Borosilicate', '0.02 - 0.05', '50 - 120', '3.0 - 4.5'],
                ['Doped Borosilicate', '0.008 - 0.015', '250 - 400', '1.2 - 2.0'],
              ]}
            />
          </Section>

          {/* Answer input */}
          <Section title="Answer input" blurb="LuminaInput — glassy typed-answer entry (no native spinners) + on-brand submit">
            <LuminaCard>
              <LuminaCardContent className="pt-6 space-y-3">
                <p className="text-sm text-slate-300">What is 200 × 20?</p>
                <div className="flex gap-2">
                  <LuminaInput
                    type="number"
                    inputMode="numeric"
                    defaultValue={4000}
                    placeholder="Enter answer"
                    className="flex-1 font-mono"
                  />
                  <LuminaButton tone="primary">Check</LuminaButton>
                </div>
                <p className="text-[11px] text-slate-500">
                  Replaces the generic native input (ugly spinner arrows) + solid-blue button.
                </p>
              </LuminaCardContent>
            </LuminaCard>
          </Section>

          {/* Chip bank */}
          <Section title="Chip bank" blurb="LuminaChip + LuminaChipBank — selectable tokens, grade via answerStateClasses">
            <LuminaChipBank label="Word Bank">
              <LuminaChip state="idle">photosynthesis</LuminaChip>
              <LuminaChip state="idle">glucose</LuminaChip>
              <LuminaChip state="selected">sunlight</LuminaChip>
              <LuminaChip state="dimmed">water</LuminaChip>
              <LuminaChip state="correct">starch</LuminaChip>
              <LuminaChip state="incorrect">oxygen</LuminaChip>
            </LuminaChipBank>
          </Section>

          {/* Drop zones */}
          <Section
            title="Drop zones"
            blurb="LuminaDropZone + dropZoneStateClasses — shared target language; drag mechanics stay bespoke"
          >
            <LuminaCard>
              <LuminaCardContent className="pt-6 space-y-5">
                <Spec label="States" code="state='idle | dragOver | filled | correct | incorrect'">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {DROP_ZONE_STATES.map((s) => (
                      <div key={s} className="space-y-1.5">
                        <span className="text-[10px] font-mono text-slate-500">{s}</span>
                        <LuminaDropZone
                          state={s}
                          className="pointer-events-none min-h-[72px] p-2 text-xs"
                          emptyPrompt={
                            s === 'dragOver'
                              ? 'Release to place'
                              : s === 'incorrect'
                                ? 'Not quite'
                                : 'Drop here'
                          }
                        >
                          {(s === 'filled' || s === 'correct') && (
                            <LuminaChip state={s === 'correct' ? 'correct' : 'idle'} className="text-xs px-2.5 py-1">
                              sunlight
                            </LuminaChip>
                          )}
                        </LuminaDropZone>
                      </div>
                    ))}
                  </div>
                </Spec>

                <Spec label="Live — drag or tap-to-place" code="mechanics in the primitive; colors + motion from the kit">
                  <p className="text-sm text-slate-300">
                    Which of these are <strong className="text-slate-100">inputs</strong> of
                    photosynthesis? Drag into the zone — or tap a chip, then tap the zone.
                  </p>
                  <LuminaChipBank label="Word Bank">
                    {DROP_WORDS.filter(({ word }) => !placedWords.includes(word)).map(({ word }) => (
                      <LuminaChip
                        key={word}
                        state={heldWord === word ? 'selected' : 'idle'}
                        draggable
                        onDragStart={(e) => {
                          dragWord.current = word;
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          dragWord.current = null;
                        }}
                        onClick={() => setHeldWord((h) => (h === word ? null : word))}
                        className="cursor-grab active:cursor-grabbing"
                      >
                        {word}
                      </LuminaChip>
                    ))}
                  </LuminaChipBank>
                  <LuminaDropZone
                    state={zoneState}
                    emptyPrompt="Inputs of photosynthesis — drop here"
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (zoneState !== 'dragOver') setZoneState('dragOver');
                    }}
                    onDragLeave={() =>
                      setZoneState(placedWords.length > 0 ? 'filled' : 'idle')
                    }
                    onDrop={(e) => {
                      e.preventDefault();
                      gradeDrop(dragWord.current);
                      dragWord.current = null;
                    }}
                    onClick={() => gradeDrop(heldWord)}
                    className={heldWord ? 'cursor-pointer' : undefined}
                  >
                    {placedWords.map((word) => (
                      <LuminaChip key={word} state="correct" disabled>
                        {word}
                      </LuminaChip>
                    ))}
                  </LuminaDropZone>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-500">
                      Wrong drops shake (motion.shake); right drops keep the chip and pop
                      (motion.pop). The zone narrates state — no toast needed.
                    </p>
                    <LuminaButton tone="subtle" size="sm" onClick={resetDropDemo}>
                      Reset
                    </LuminaButton>
                  </div>
                </Spec>
              </LuminaCardContent>
            </LuminaCard>
          </Section>

          {/* Fill-in-the-blank slot */}
          <Section title="Fill-in-the-blank" blurb="LuminaFillBlankSlot — grades via the shared answerStateClasses token">
            <LuminaCard>
              <LuminaCardContent className="pt-6 text-lg text-slate-200 leading-loose">
                Plants make food through
                <LuminaFillBlankSlot state="correct" value="photosynthesis" />, using energy from
                <LuminaFillBlankSlot state="empty" /> and water from
                <LuminaFillBlankSlot state="incorrect" value="the air" />, while glucose is stored as
                <LuminaFillBlankSlot state="filled" value="starch" />.
              </LuminaCardContent>
            </LuminaCard>
          </Section>

          {/* Multi-phase scaffold (Tier 3) */}
          <Section title="Multi-phase scaffold" blurb="ModeTabs · ChallengeCounter · Prompt · InlineStat · Stepper — assembled">
            <LuminaCard>
              <LuminaCardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <LuminaModeTabs
                    accent="orange"
                    active="count_on"
                    tabs={[
                      { value: 'count', label: 'Count' },
                      { value: 'subitize', label: 'Subitize' },
                      { value: 'organize', label: 'Organize' },
                      { value: 'count_on', label: 'Count On' },
                    ]}
                  />
                  <LuminaChallengeCounter current={1} total={5} />
                </div>

                <LuminaPrompt>There are 3 stars already counted. Can you count on to find the total?</LuminaPrompt>

                <div className="flex flex-col items-center gap-3 py-2">
                  <LuminaInlineStat label="Counted" value={count} suffix="/ 6" accent="orange" />
                  <LuminaStepper value={count} onChange={setCount} min={0} max={6} accent="blue" />
                  <LuminaButton tone="primary" size="sm">Check Answer</LuminaButton>
                </div>
              </LuminaCardContent>
            </LuminaCard>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LuminaPanel>
                <p className="text-xs text-slate-400 mb-2">Dots counter + editable stepper</p>
                <div className="space-y-3">
                  <LuminaChallengeCounter current={1} total={4} variant="dots" accent="purple" />
                  <LuminaStepper value={count} onChange={setCount} min={0} editable accent="purple" />
                </div>
              </LuminaPanel>
              <LuminaPanel>
                <p className="text-xs text-slate-400 mb-2">Inline readouts</p>
                <div className="flex gap-4">
                  <LuminaInlineStat label="Counters" value={8} accent="orange" />
                  <LuminaInlineStat label="Empty" value={12} />
                </div>
              </LuminaPanel>
            </div>
          </Section>

          {/* Evaluation loop (problem → eval → results) */}
          <Section title="Evaluation loop" blurb="FeedbackCard · AnswerChoice · ActionButton · HintDisclosure · ScoreRing — the problem→eval→results spec">
            <LuminaCard>
              <LuminaCardContent className="pt-6 space-y-4">
                <LuminaPrompt>Tracks spread a machine&apos;s weight over a larger area. True or false?</LuminaPrompt>

                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                  {[
                    { value: true, label: 'True' },
                    { value: false, label: 'False' },
                  ].map(({ value, label }) => (
                    <LuminaAnswerChoice
                      key={label}
                      state={choiceState(value)}
                      disabled={submitted}
                      onClick={() => setAnswer(value)}
                    >
                      <span className="block text-center text-lg font-bold">{label}</span>
                    </LuminaAnswerChoice>
                  ))}
                </div>

                <div className="flex flex-col items-center gap-4">
                  {!submitted ? (
                    <LuminaActionButton
                      action="check"
                      disabled={answer === null}
                      onClick={() => setSubmitted(true)}
                    />
                  ) : (
                    <div className="w-full space-y-4">
                      <LuminaFeedbackCard
                        status={isCorrect ? 'correct' : 'insight'}
                        teachingNote="A wide base is the real trick — large surface area keeps the machine on top of soft ground."
                      >
                        {isCorrect
                          ? 'Right — spreading weight over a larger area lowers the pressure on the ground.'
                          : 'Think about why a machine on tracks doesn’t sink in mud.'}
                      </LuminaFeedbackCard>
                      <div className="flex justify-center">
                        <LuminaActionButton
                          action="retry"
                          onClick={() => {
                            setSubmitted(false);
                            setAnswer(null);
                          }}
                        />
                      </div>
                    </div>
                  )}
                  <LuminaHintDisclosure>
                    Picture a machine on skinny wheels versus wide flat tracks in deep mud.
                  </LuminaHintDisclosure>
                </div>
              </LuminaCardContent>
            </LuminaCard>

            <div className="mt-3">
              <LuminaPanel>
                <p className="text-xs text-slate-400 mb-3">Results — LuminaScoreRing (tier from score)</p>
                <div className="flex justify-around">
                  <LuminaScoreRing score={100} size={104} />
                  <LuminaScoreRing score={87} size={104} />
                  <LuminaScoreRing score={64} size={104} />
                  <LuminaScoreRing score={38} size={104} />
                </div>
              </LuminaPanel>
            </div>
          </Section>

          {/* Card top accent */}
          <Section title="Card focus bar" blurb="LuminaCard topAccent — consistent active affordance">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LuminaCard topAccent="blue">
                <LuminaCardHeader>
                  <LuminaCardTitle className="text-base">Focused</LuminaCardTitle>
                  <LuminaCardDescription>topAccent="blue"</LuminaCardDescription>
                </LuminaCardHeader>
              </LuminaCard>
              <LuminaCard>
                <LuminaCardHeader>
                  <LuminaCardTitle className="text-base">Default</LuminaCardTitle>
                  <LuminaCardDescription>no bar</LuminaCardDescription>
                </LuminaCardHeader>
              </LuminaCard>
            </div>
          </Section>
        </div>

        {/* ── Side column ──────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-4">
            <LuminaCard>
              <LuminaCardHeader>
                <LuminaCardTitle className="text-sm uppercase tracking-wider">
                  How to use
                </LuminaCardTitle>
              </LuminaCardHeader>
              <LuminaCardContent>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Compose primitive chrome from these components — never hand-type glass class
                  strings. Import from{' '}
                  <code className="text-slate-300">lumina/ui</code>:
                </p>
                <pre className="mt-2 text-[10px] font-mono text-slate-400 bg-black/30 rounded-md p-2 overflow-x-auto">
{`import {
  LuminaCard, LuminaButton,
  LuminaBadge, LuminaPanel,
} from '../../../ui';`}
                </pre>
              </LuminaCardContent>
            </LuminaCard>

            <LuminaPanel accent="amber">
              <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${accentText.amber}`}>
                Frame, not painting
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                The kit is the <strong className="text-slate-300">chrome</strong>. A primitive's
                bespoke interaction surface — canvas, drag targets, the simulation object the
                student manipulates — stays custom. Standardize the frame; never force the
                interaction into a kit box.
              </p>
            </LuminaPanel>

            <LuminaPanel>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Evolve at scale
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every value here flows from{' '}
                <code className="text-slate-300">tokens.ts</code>. Change a surface, a text shade,
                or an accent there and all ~140 primitives follow — no per-file edits.
              </p>
            </LuminaPanel>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignStudio;
