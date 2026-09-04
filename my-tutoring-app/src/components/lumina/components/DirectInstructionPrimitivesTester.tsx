'use client';

import React, { useState, useCallback } from 'react';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import { EvaluationProvider } from '../evaluation';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import DiDiceRoll, { type DiDiceRollData } from '../primitives/visual-primitives/direct-instruction/DiDiceRoll';
import DiLetterSounds, { type DiLetterSoundsData } from '../primitives/visual-primitives/direct-instruction/DiLetterSounds';
import DiWordReading, { type DiWordReadingData } from '../primitives/visual-primitives/direct-instruction/DiWordReading';
import DiMathFacts, { type DiMathFactsData } from '../primitives/visual-primitives/direct-instruction/DiMathFacts';
import DiShapes, { type DiShapesData } from '../primitives/visual-primitives/direct-instruction/DiShapes';
import DiSentenceReading, { type DiSentenceReadingData } from '../primitives/visual-primitives/direct-instruction/DiSentenceReading';
import DiSpokenPractice, { type DiSpokenPracticeData } from '../primitives/visual-primitives/direct-instruction/DiSpokenPractice';
import { DiSpokenPracticeScriptPanel } from '../primitives/visual-primitives/direct-instruction/DiSpokenPracticeScriptPanel';
import { DiRunLogPanel } from '../primitives/visual-primitives/direct-instruction/DiRunLogPanel';

interface Props { onBack: () => void; }

// The generators are server-only (they import geminiClient). A client tester
// must NEVER import them directly — generate via the eval-test API route.
// One picker drives every DI pack; eval modes must mirror catalog/di.ts.
// 'mixed' pins nothing → generator spread (letter-sounds L1 only).
type DiPrimitiveId = 'di-dice-roll' | 'di-letter-sounds' | 'di-word-reading' | 'di-math-facts' | 'di-shapes' | 'di-sentence-reading' | 'di-spoken-practice';

interface DiPrimitiveOption {
  id: DiPrimitiveId;
  label: string;
  subtitle: string;
  defaultTopic: string;
  /** The band the pack is curriculum-scoped to. Grade is a real generator input
   *  (di-sentence-reading narrows its word ceiling below G1), so the tester must
   *  not send kindergarten for every pack. */
  defaultGrade: string;
  evalModes: ReadonlyArray<{ key: string; label: string }>;
}

const DI_PRIMITIVES: DiPrimitiveOption[] = [
  {
    id: 'di-letter-sounds',
    label: 'Letter Sounds',
    subtitle: 'Continuous letter sounds, spoken call-response.',
    defaultTopic: 'letter sounds m, s, a, f',
    defaultGrade: 'kindergarten',
    evalModes: [
      { key: 'letter_sound', label: 'Letter Sound (isolated)' },
      { key: 'letter_sound_review', label: 'Sound Review (mixed set)' },
      { key: 'first_sound_in_word', label: 'First Sound in a Word' },
      { key: 'mixed', label: 'Mixed (all modes)' },
    ],
  },
  {
    id: 'di-dice-roll',
    label: 'Dice Roll',
    subtitle: 'Roll, count, compare, or add visible dice pips aloud.',
    defaultTopic: 'subitizing dice patterns to 6',
    defaultGrade: 'kindergarten',
    evalModes: [
      { key: 'count_pips', label: 'Count the Pips' },
      { key: 'compare_dice', label: 'Compare Two Dice' },
      { key: 'sum_two_dice', label: 'Add Two Dice' },
      { key: 'mixed', label: 'Mixed (all modes)' },
    ],
  },
  {
    id: 'di-word-reading',
    label: 'Word Reading',
    subtitle: 'Read printed CVC + sight words aloud ("What word?").',
    defaultTopic: 'reading short a words',
    defaultGrade: 'kindergarten',
    evalModes: [
      { key: 'read_word', label: 'Read a Word' },
    ],
  },
  {
    id: 'di-math-facts',
    label: 'Math Facts',
    subtitle: 'Printed facts, spoken number-word answers ("What is 2 plus 1?").',
    defaultTopic: 'addition facts within 5',
    defaultGrade: 'kindergarten',
    evalModes: [
      { key: 'counting_next', label: 'The Number After' },
      { key: 'answer_fact', label: 'Answer a Fact' },
      { key: 'fact_review', label: 'Fact Review (mixed set)' },
      { key: 'subtraction_fact', label: 'Take-Away Fact' },
    ],
  },
  {
    id: 'di-shapes',
    label: 'Shapes',
    subtitle: 'A drawn 2D shape, spoken answers — its name, or how many sides/corners.',
    defaultTopic: 'naming basic shapes',
    defaultGrade: 'kindergarten',
    evalModes: [
      { key: 'name_shape', label: 'Name the Shape' },
      { key: 'shape_review', label: 'Shape Review (mixed set)' },
      { key: 'count_sides', label: 'How Many Sides' },
      { key: 'count_corners', label: 'How Many Corners' },
      { key: 'mixed', label: 'Mixed (all modes)' },
    ],
  },
  {
    id: 'di-sentence-reading',
    label: 'Sentence Reading',
    subtitle: 'Read a printed 3-8 word sentence aloud, judged word by word.',
    defaultTopic: 'reading simple sentences',
    defaultGrade: 'first grade',
    evalModes: [
      { key: 'decodable_sentence', label: 'Sound-It-Out Sentence' },
      { key: 'read_sentence', label: 'Read a Sentence' },
      { key: 'sentence_review', label: 'Sentence Review (mixed set)' },
      { key: 'sight_phrase_sentence', label: 'Sight-Word Sentence' },
      { key: 'mixed', label: 'Mixed (all modes)' },
    ],
  },
  {
    // The content-generic pack. Unlike the five above, its ITEMS are generated
    // — so the topic box is the real control here: change the topic and the
    // same component becomes a different lesson. Read the script panel below
    // the run before driving it; that is what this pack exists to expose.
    id: 'di-spoken-practice',
    label: 'Spoken Practice (generic)',
    subtitle: 'ANY short-spoken-answer skill — items, asks and judging clauses all generated.',
    defaultTopic: 'adding one more, within 5',
    defaultGrade: 'kindergarten',
    evalModes: [
      { key: 'say_answer', label: 'Say the Answer (recall)' },
      { key: 'read_aloud', label: 'Read It Aloud (decode)' },
      { key: 'count_and_say', label: 'Count and Say' },
    ],
  },
];

type DiData =
  | { id: 'di-dice-roll'; data: DiDiceRollData }
  | { id: 'di-letter-sounds'; data: DiLetterSoundsData }
  | { id: 'di-word-reading'; data: DiWordReadingData }
  | { id: 'di-math-facts'; data: DiMathFactsData }
  | { id: 'di-shapes'; data: DiShapesData }
  | { id: 'di-sentence-reading'; data: DiSentenceReadingData }
  | { id: 'di-spoken-practice'; data: DiSpokenPracticeData };

const DirectInstructionPrimitivesTesterContent: React.FC<Props> = ({ onBack }) => {
  const [primitive, setPrimitive] = useState<DiPrimitiveOption>(DI_PRIMITIVES[0]);
  const [generated, setGenerated] = useState<DiData | null>(null);
  const [topic, setTopic] = useState(DI_PRIMITIVES[0].defaultTopic);
  const [evalMode, setEvalMode] = useState<string>(DI_PRIMITIVES[0].evalModes[0].key);
  // L3 support tier (config.difficulty). '' = manifest default (absent tier =
  // the L0 easy shape). The eval-test route already threads ?difficulty=
  // verbatim into config, so this is the runtime path for the tier mic checks
  // (HUMAN-CHECKS #50(d) math / #54(d) sentence — hear the `hard` cold ask).
  const [difficulty, setDifficulty] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped on every Generate so the rendered pack REMOUNTS. The DI components
  // kick the live loop off a mic gesture and don't reset on new data (a lesson
  // gives each objective a fresh instance, so they never need to) — in this
  // tester the same instance is reused across mode switches, so without a fresh
  // key it would keep showing the prior run's recap instead of re-engaging.
  const [runKey, setRunKey] = useState(0);

  const pickPrimitive = useCallback((opt: DiPrimitiveOption) => {
    setPrimitive(opt);
    setTopic(opt.defaultTopic);
    setEvalMode(opt.evalModes[0].key);
    setGenerated(null);
    setError(null);
  }, []);

  const generate = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({
        componentId: primitive.id,
        evalMode,
        topic,
        gradeLevel: primitive.defaultGrade,
        intent: topic,
      });
      if (difficulty) params.set('difficulty', difficulty);
      const res = await fetch(`/api/lumina/eval-test?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.fullData) {
        throw new Error(json.error || 'Generation failed');
      }
      setGenerated({ id: primitive.id, data: json.fullData } as DiData);
      setRunKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }, [topic, evalMode, difficulty, primitive.id, primitive.defaultGrade]);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm text-white hover:bg-slate-700/50">← Back</button>
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Direct Instruction — {primitive.label}</h1>
          <p className="text-xs text-slate-400">{primitive.subtitle} Generate objective-scoped items, then tap the mic to run the live-judged loop.</p>
        </div>
      </div>
      <div className="mb-4 flex items-center gap-2">
        {DI_PRIMITIVES.map((opt) => (
          <button
            key={opt.id}
            onClick={() => pickPrimitive(opt)}
            className={`rounded-full border px-4 py-2 text-sm ${opt.id === primitive.id
              ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
              : 'border-white/10 bg-slate-900/40 text-slate-300 hover:bg-slate-800/50'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} className="flex-1 rounded border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-200" placeholder="objective / target items" />
        <select value={evalMode} onChange={(e) => setEvalMode(e.target.value)} className="rounded border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
          {primitive.evalModes.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-200" title="L3 support tier — how much of the DISTAR sequence precedes the child's turn">
          <option value="">Tier: default (easy)</option>
          <option value="easy">Tier: easy (model + guide)</option>
          <option value="medium">Tier: medium (model only)</option>
          <option value="hard">Tier: hard (cold)</option>
        </select>
        <button onClick={() => void generate()} disabled={loading} className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-200 disabled:opacity-40">{loading ? 'Generating…' : 'Generate'}</button>
      </div>
      {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}
      {/* Mount exactly as a lesson does — ONE `data` prop with the evaluation
          props merged in (ManifestOrderRenderer's shape). The bench used to
          spread the data across props, which is why the packs' props-are-data
          signature survived here and only crashed in a real lesson. */}
      {generated?.id === 'di-dice-roll' && (
        <DiDiceRoll key={`di-run-${runKey}`} data={{ ...generated.data, instanceId: 'di-tester-1', onEvaluationSubmit: (r) => console.log('[DI eval]', r) }} />
      )}
      {generated?.id === 'di-letter-sounds' && (
        <DiLetterSounds key={`di-run-${runKey}`} data={{ ...generated.data, instanceId: 'di-tester-1', onEvaluationSubmit: (r) => console.log('[DI eval]', r) }} />
      )}
      {generated?.id === 'di-word-reading' && (
        <DiWordReading key={`di-run-${runKey}`} data={{ ...generated.data, instanceId: 'di-tester-1', onEvaluationSubmit: (r) => console.log('[DI eval]', r) }} />
      )}
      {generated?.id === 'di-math-facts' && (
        <DiMathFacts key={`di-run-${runKey}`} data={{ ...generated.data, instanceId: 'di-tester-1', onEvaluationSubmit: (r) => console.log('[DI eval]', r) }} />
      )}
      {generated?.id === 'di-shapes' && (
        <DiShapes key={`di-run-${runKey}`} data={{ ...generated.data, instanceId: 'di-tester-1', onEvaluationSubmit: (r) => console.log('[DI eval]', r) }} />
      )}
      {generated?.id === 'di-sentence-reading' && (
        <DiSentenceReading key={`di-run-${runKey}`} data={{ ...generated.data, instanceId: 'di-tester-1', onEvaluationSubmit: (r) => console.log('[DI eval]', r) }} />
      )}
      {generated?.id === 'di-spoken-practice' && (
        <>
          <DiSpokenPractice key={`di-run-${runKey}`} data={{ ...generated.data, instanceId: 'di-tester-1', onEvaluationSubmit: (r) => console.log('[DI eval]', r) }} />
          {/* The point of this pack: READ what the model wrote before a child
              hears it. Shows every generated clause plus the assembled cue. */}
          <DiSpokenPracticeScriptPanel items={generated.data.items} />
        </>
      )}
      {/* Bench-parity diagnostics. Reads the diRunLog module store, so it needs
          no props from the pack and never renders in a lesson. Read its FLAGS
          row first when a sitting decoheres. */}
      {generated && <DiRunLogPanel />}
    </div>
  );
};

const DirectInstructionPrimitivesTester: React.FC<Props> = (props) => (
  <EvaluationProvider><ExhibitProvider objectives={[]} manifestItems={[]}><LuminaAIProvider><DirectInstructionPrimitivesTesterContent {...props} /></LuminaAIProvider></ExhibitProvider></EvaluationProvider>
);

export default DirectInstructionPrimitivesTester;
