// @vitest-environment jsdom
/**
 * Judged-evidence census, stage E (evidence): mount each declared judged source with REAL generated data,
 * capture the pack the component hands the runner, and build the evidence the runner would submit for a
 * fictional run (three of five items wrong first with the pack's own signature miss, corrected once, then
 * right). The output is what the shared capture layer would receive, byte for byte — the component's own
 * `diagnosisObservation` and `evidenceSummary` through `judgedRunEvidence`.
 *
 * Driven by `scripts/misconception-harness/judged-evidence-census.mjs`, which generates the data (stage G)
 * and runs the real distiller on each evidence packet (stage D). Skipped unless JUDGED_CENSUS_DIR is set,
 * so the ordinary suite never mounts 23 primitives or reads a run directory.
 */
import React from 'react';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiHarnessAnswers, DiPortAdapter } from '../../service/qa/di/diDrivePlan';
import type { JudgedScriptItem, JudgedScriptPack } from '../../hooks/judgedScriptContract';
import { judgedRunEvidence } from '../../hooks/judgedRunEvidence';
import { isDiagnosableFailure } from './types';

const DIR = process.env.JUDGED_CENSUS_DIR ?? '';
const captured = vi.hoisted(() => ({ pack: null as JudgedScriptPack<JudgedScriptItem> | null }));

// The runner is mocked at the seam: the census wants the PACK the component builds (its observation and
// summary closures), not a live loop. Everything else the component touches is inert.
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0, useLuminaAIContext: () => new Proxy({
  isConnected: false, isListening: false, isAudioPlaying: false, isAIResponding: false, sessionMode: 'idle', activePrimitiveId: null,
  sessionResumeCount: 0, conversation: [] }, { get: (t, k) => (k in t ? (t as Record<string | symbol, unknown>)[k] : vi.fn()) }) }));
vi.mock('@/components/lumina/hooks/useJudgedScriptRunner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useJudgedScriptRunner')>();
  return { ...actual, useJudgedScriptRunner: (options: { pack: JudgedScriptPack<JudgedScriptItem> }) => {
    captured.pack = options.pack;
    return { running: false, preparing: false, stage: 'idle', statusLine: '', currentIndex: 0, currentItem: options.pack.items[0] ?? null,
      solvedIds: new Set(), currentSolved: false, canAttempt: false, summary: null, micState: 'idle', tutorSpeaking: false, cuedItemId: null,
      revealedItemId: null, revealHeld: false, stimulusTapped: false, hearStimulus: vi.fn(), isAwaitingGesture: () => false,
      submitGestureAttempt: vi.fn(), start: vi.fn(), reset: vi.fn(), armStillness: vi.fn(), clearStillness: vi.fn() };
  } };
});
vi.mock('@/components/lumina/evaluation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false, submittedResult: null, elapsedMs: 0 }),
    useEvaluationContext: () => null };
});
vi.mock('@/components/lumina/hooks/useLuminaAI', () => ({ useLuminaAI: () => new Proxy({ isConnected: false, isAIResponding: false,
  isAudioPlaying: false, isListening: false, conversation: [] }, { get: (t, k) => (k in t ? (t as Record<string | symbol, unknown>)[k] : vi.fn()) }) }));
vi.mock('@/components/lumina/hooks/useSpokenWordCapture', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useSpokenWordCapture: () => ({ state: 'idle', level: 0, isSupported: false, start: vi.fn(), cancel: vi.fn() }) };
});
vi.mock('@/components/lumina/components/JudgedMicPanel', () => ({ default: () => null }));
vi.mock('@/components/lumina/components/DiActionPanel', () => ({ default: () => null }));
vi.mock('@/components/lumina/utils/SoundManager', () => ({ SoundManager: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock('@/lib/authApiClient', () => ({ authApi: { post: vi.fn(), get: vi.fn() } }));

type Loader = () => Promise<{ default: React.ComponentType<{ data: Record<string, unknown> }> }>;
const COMPONENTS: Record<string, Loader> = {
  '3d-shape-explorer': () => import('../../primitives/visual-primitives/math/ThreeDShapeExplorer'),
  'compare-objects': () => import('../../primitives/visual-primitives/math/CompareObjects'),
  'counting-board': () => import('../../primitives/visual-primitives/math/CountingBoard'),
  'ten-frame': () => import('../../primitives/visual-primitives/math/TenFrame'),
  'decodable-reader': () => import('../../primitives/visual-primitives/literacy/DecodableReader'),
  'di-deduction': () => import('../../primitives/visual-primitives/direct-instruction/DiDeduction'),
  'di-dice-roll': () => import('../../primitives/visual-primitives/direct-instruction/DiDiceRoll'),
  'di-word-problem-setup': () => import('../../primitives/visual-primitives/direct-instruction/DiWordProblemSetup'),
  'di-worked-procedure': () => import('../../primitives/visual-primitives/direct-instruction/DiWorkedProcedure'),
  'letter-sound-link': () => import('../../primitives/visual-primitives/literacy/LetterSoundLink'),
  'letter-spotter': () => import('../../primitives/visual-primitives/literacy/LetterSpotter'),
  'oral-sentence-studio': () => import('../../primitives/visual-primitives/literacy/OralSentenceStudio'),
  'ordinal-line': () => import('../../primitives/visual-primitives/math/OrdinalLine'),
  'phoneme-explorer': () => import('../../primitives/visual-primitives/literacy/PhonemeExplorer'),
  'picture-vocabulary': () => import('../../primitives/visual-primitives/literacy/PictureVocabulary'),
  'place-value-chart': () => import('../../primitives/visual-primitives/math/PlaceValueChart'),
  'sentence-analyzer': () => import('../../primitives/visual-primitives/literacy/SentenceAnalyzer'),
  'sorting-station': () => import('../../primitives/visual-primitives/math/SortingStation'),
  'word-builder': () => import('../../primitives/WordBuilder'),
  'di-spoken-practice': () => import('../../primitives/visual-primitives/direct-instruction/DiSpokenPractice'),
  'read-aloud-studio': () => import('../../primitives/visual-primitives/literacy/ReadAloudStudio'),
} as unknown as Record<string, Loader>;

/** Ports without a drive adapter but with exported answer material. */
async function adapterFor(id: string): Promise<DiPortAdapter<JudgedScriptItem> | null> {
  const { DI_PORTS } = await import('../../service/qa/di/diDrivePlan');
  if (DI_PORTS[id]) return DI_PORTS[id];
  if (id === 'oral-sentence-studio') {
    const s = await import('../../primitives/visual-primitives/literacy/oralSentenceStudioScript');
    return {
      build: (data: Record<string, unknown>) => { const items = s.itemsFromChallenges((data.challenges ?? []) as never[]); return { items, dropped: 0, surface: s.oralSentenceStudioPack(items) }; },
      answersFor: (item: JudgedScriptItem) => { const a = s.oralSentenceHarnessAnswers(item as never); return { correct: a.valid[0] ?? '', plainWrong: a.unrelated,
        signatureWrong: { text: a.fragment, why: 'a fragment: both target words and the object, no verb — the contract refuses it' }, leakTokens: [] } as DiHarnessAnswers; },
    } as unknown as DiPortAdapter<JudgedScriptItem>;
  }
  return null;
}

interface CensusCase { id: string; evalMode?: string; gradeLevel: string; topic: string; data: Record<string, unknown> }
const cases: CensusCase[] = DIR && existsSync(DIR)
  ? readdirSync(DIR).filter((f) => f.startsWith('data-') && f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as CensusCase)
  : [];

afterEach(() => { cleanup(); captured.pack = null; });

describe.skipIf(!DIR)('judged-evidence census (stage E)', () => {
  for (const c of cases) {
    it(`${c.id}: evidence for a wrong-first, corrected-once run`, async () => {
      const out = join(DIR, `evidence-${c.id}.json`);
      const record = (body: Record<string, unknown>) => writeFileSync(out, JSON.stringify({ id: c.id, evalMode: c.evalMode, gradeLevel: c.gradeLevel, topic: c.topic, ...body }, null, 2));
      try {
        const adapter = await adapterFor(c.id);
        if (!adapter) { record({ skipped: 'no drive adapter and no exported answer material' }); return; }
        const load = COMPONENTS[c.id];
        if (!load) { record({ skipped: 'no component mapping in the census' }); return; }
        const { default: Component } = await load();
        render(<Component data={{ ...c.data, instanceId: `census-${c.id}`, skillId: 'CENSUS', subskillId: 'CENSUS-a' }} />);
        const pack = captured.pack;
        if (!pack) { record({ skipped: 'component did not call the runner on mount (stage may need a start gesture)' }); return; }
        const items = pack.items;
        const answers = new Map(items.map((item) => [item.id, adapter.answersFor(item)]));
        const voice = items.filter((item) => item.answerKind === 'voice' && answers.get(item.id)?.signatureWrong?.text);
        if (!voice.length) { record({ skipped: `no voice item with a signature wrong (${items.length} items: ${items.map((i) => `${i.answerKind}/${i.responseClass}`).join(', ')})` }); return; }
        // Slice 2: one `observation` callback per attempt; the legacy `diagnosisObservation` still serves unmigrated packs.
        const observe = pack.observation
          ? (item: JudgedScriptItem, heard: string) => pack.observation!(item, { heard, verdict: 'corrected' })
          : pack.diagnosisObservation
            ? (item: JudgedScriptItem, heard: string) => pack.diagnosisObservation!(item, { lastHeard: heard })
            : null;
        if (!observe) { record({ skipped: 'pack has no observation callback: the runner records nothing for it' }); return; }
        // Three of five: 60% of the items asked are wrong first, bounded by the voice items that carry a signature miss.
        const wrongCount = Math.max(1, Math.min(voice.length, Math.ceil(items.length * 0.6)));
        const wrong = new Set(voice.slice(0, wrongCount).map((i) => i.id));
        const observations = [];
        let nullObservations = 0;
        for (const item of items) {
          if (!wrong.has(item.id)) continue;
          const a = answers.get(item.id)!;
          const observed = observe(item, a.signatureWrong!.text);
          if (!observed) { nullObservations += 1; continue; }
          observations.push({ ...observed, itemId: item.id, phase: item.action ?? item.responseClass,
            support: 'Correction observation; 0 prior corrections on this item. Other assistance is not established.',
            judgeFeedback: `My turn: ${a.correct}.` });
        }
        const outcomes = items.map((item) => ({ id: item.id, solved: true, corrections: wrong.has(item.id) ? 1 : 0, score: wrong.has(item.id) ? 67 : 100, seconds: 5 }));
        const score = Math.round(outcomes.reduce((s, o) => s + o.score, 0) / outcomes.length);
        const evidence = judgedRunEvidence({ outcomes, observations, items, pack });
        const gate = isDiagnosableFailure({ success: true, score }, evidence);
        record({ itemCount: items.length, voiceCount: voice.length, wrongCount: wrong.size, nullObservations, score, gate, evidence,
          signature: voice.slice(0, wrongCount).map((i) => ({ id: i.id, correct: answers.get(i.id)!.correct, wrong: answers.get(i.id)!.signatureWrong!.text, why: answers.get(i.id)!.signatureWrong!.why })) });
        expect(evidence).toBeDefined();
      } catch (error) {
        const cause = (error as { cause?: Error })?.cause;
        record({ error: `${String((error as Error)?.stack ?? error)}${cause ? `
CAUSE: ${String(cause.stack ?? cause)}` : ''}` });
      }
    });
  }
});
