'use client';

/**
 * Letter-name scenario — benches spoken CHOICE over LETTER NAMES, a content
 * CLASS the choice judge has never been validated against (only CVC words
 * have — see types.ts PRESET_WORDS). LetterSpotter's name-it/match-it modes
 * want voice control, but letter names are the doctrine's worst case:
 *
 *   • the "ee" wall — B C D E G P T V Z all end /iː/, so the DISCRIMINATOR is
 *     the CONSONANT, not the vowel. The production choice-judge prompt
 *     (gemini-choice-judge) explicitly tells the model to "pay closest
 *     attention to the vowel" — tuned for CVC minimal pairs (map/mop). That
 *     guidance is at best useless and at worst MISDIRECTING here. Watch
 *     whether it mis-selects a rhyming neighbor (say "B", it picks D/P/T).
 *   • b / d — the exact reversal pair the primitive is built to disambiguate.
 *   • the "ay" set — A / J / K (+ H) share /eɪ/.
 *   • letter↔word homophones — C=see, R=are, U=you, Y=why. The judge
 *     transcribes first; watch whether "heard" is the WORD ("see") yet still
 *     snaps to the letter option, or drops to selectedOption:"" (no match).
 *
 * This is a pure bench: it drives the REAL judge ladder through studioJudge
 * (no judge changes here). The goal is a verdict — does the class pass, and if
 * not, is the fix content (drop confusable letters from an option set) or a
 * judge-prompt variant for letters. Only after this passes does
 * /add-voice-control wire LetterSpotter. Mirrors ChoiceQueueScenario; the only
 * difference is the option pool (letters, not words) and the cluster picker.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { LuminaPanel, LuminaButton, LuminaVoiceTarget } from '../../../ui';
import {
  useVoiceChoice,
  type SpokenChoiceVerdict,
  type VoiceChoiceContext,
} from '../../../hooks/useVoiceChoice';
import type { CapturedUtterance, VoiceJudgePass } from '../../../hooks/useVoiceCapture';
import { judgeForPass } from '../studioJudge';
import type { StudioScenarioProps } from '../types';
import CaptureSurface from '../CaptureSurface';

const SCENARIO_ID = 'letter-name';

/**
 * Confusion clusters — each is an ordered letter pool (lowercase; the choice
 * judge and grading compare lowercased, and we render uppercase). The first
 * two letters become the two problems' answers; the first four are the shared
 * option board, so the answer always sits among its hardest neighbors.
 */
interface LetterCluster {
  id: string;
  label: string;
  blurb: string;
  letters: string[];
}

const LETTER_CLUSTERS: LetterCluster[] = [
  {
    id: 'ee-wall',
    label: 'The "ee" wall',
    blurb: 'B D P T all end /iː/ — consonant carries the distinction, not the vowel. The hardest case.',
    letters: ['b', 'd', 'p', 't', 'c', 'e', 'g', 'v', 'z'],
  },
  {
    id: 'bd',
    label: 'b / d reversal',
    blurb: "The primitive's core confusion pair, plus p/q. Spoken b vs d is the /iː/ wall again.",
    letters: ['b', 'd', 'p', 'q'],
  },
  {
    id: 'ay',
    label: 'The "ay" set',
    blurb: 'A J K (+ H) share the /eɪ/ nucleus — ay / jay / kay.',
    letters: ['a', 'j', 'k', 'h'],
  },
  {
    id: 'mn',
    label: 'M / N nasals',
    blurb: 'em / en — a nasal minimal pair, two options only.',
    letters: ['m', 'n'],
  },
  {
    id: 'homophone',
    label: 'Letter↔word homophones',
    blurb: 'C=see, R=are, U=you, Y=why. Does the judge snap the WORD it hears back to the letter?',
    letters: ['c', 'r', 'u', 'y'],
  },
  {
    id: 'distinct',
    label: 'Distinct (control)',
    blurb: 'S A O M — aurally far apart. Should pass; this is the baseline the hard clusters are measured against.',
    letters: ['s', 'a', 'o', 'm'],
  },
];

/** Parse a free-typed pool ("b, d, p") into lowercase single letters, deduped. */
function parsePool(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ch of raw.toLowerCase()) {
    if (ch >= 'a' && ch <= 'z' && !seen.has(ch)) {
      seen.add(ch);
      out.push(ch);
    }
  }
  return out;
}

const LetterNameScenario: React.FC<StudioScenarioProps> = ({ config, recordTrial, reportUtterance }) => {
  const [clusterId, setClusterId] = useState(LETTER_CLUSTERS[0].id);
  const [customPool, setCustomPool] = useState('');

  const cluster = LETTER_CLUSTERS.find((c) => c.id === clusterId) ?? LETTER_CLUSTERS[0];

  // Custom pool (≥2 letters) overrides the preset; otherwise use the cluster.
  const pool = useMemo(() => {
    const custom = parsePool(customPool);
    return custom.length >= 2 ? custom : cluster.letters;
  }, [customPool, cluster]);

  // Two problems from the pool: shared option board (first 4), answers = first
  // two letters, so each answer sits among its confusable neighbors. Both
  // boards identical, different answers — the cleanest discrimination probe.
  const items = useMemo(() => {
    const board = pool.slice(0, 4);
    return [
      { answer: board[0], options: board },
      { answer: board[1] ?? board[0], options: board },
    ];
  }, [pool]);

  // Studio judge override: benched models + trial rows instead of the
  // production ladder. Primitives omit `judge` entirely. Letters go through the
  // SAME judgeChoiceAudio path words do — that identity is the whole point.
  const configRef = React.useRef(config);
  configRef.current = config;
  const studioJudge = useCallback(
    async (utt: CapturedUtterance<VoiceChoiceContext>, pass: VoiceJudgePass): Promise<SpokenChoiceVerdict | null> => {
      const v = await judgeForPass(
        { kind: 'choice', options: utt.context.options, word: utt.context.answer },
        utt,
        pass,
        configRef.current,
        SCENARIO_ID,
        recordTrial,
      );
      return v ? { heard: v.heard, selectedOption: v.selectedOption ?? null, confidence: v.confidence } : null;
    },
    [recordTrial],
  );

  // ── The part a real primitive writes ───────────────────────────
  const choice = useVoiceChoice({
    items,
    modality: config.modality,
    actOn: config.actOn,
    voiceAction: config.voiceAction,
    autoStart: config.autoArm,
    judge: studioJudge,
    onVerdict: (verdict, utt) =>
      reportUtterance({
        utterance: utt,
        kind: { kind: 'choice', options: utt.context.options, word: utt.context.answer },
        scenario: SCENARIO_ID,
      }),
    armDelayMs: config.armDelayMs,
    cooldownMs: config.cooldownMs,
  });

  const listeningLabel = choice.allSolved
    ? 'All answered — still listening'
    : `Problem ${choice.focusIdx + 1}: say the letter “${(items[choice.focusIdx]?.answer ?? '').toUpperCase()}”`;

  return (
    <div className="space-y-4">
      {/* Cluster picker (studio apparatus) */}
      <LuminaPanel className="space-y-3">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Confusion cluster</p>
        <div className="flex flex-wrap gap-2">
          {LETTER_CLUSTERS.map((c) => (
            <button
              key={c.id}
              onClick={() => { setClusterId(c.id); setCustomPool(''); }}
              className={`px-4 py-2 rounded-xl border-2 font-bold transition-all ${
                cluster.id === c.id && parsePool(customPool).length < 2
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                  : 'bg-slate-700/40 border-slate-500/30 text-slate-300 hover:bg-slate-600/40'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">{cluster.blurb}</p>

        <p className="text-xs text-slate-500 uppercase tracking-wider pt-1">Custom pool (letters — first two become the answers)</p>
        <input
          value={customPool}
          onChange={(e) => setCustomPool(e.target.value)}
          placeholder="e.g. b d p t"
          className="px-3 py-2 rounded-xl bg-white/5 border border-white/20 text-slate-200 text-sm w-48 focus:outline-none focus:border-emerald-400/50"
        />
        <p className="text-xs text-slate-600">
          The board is the first 4 letters of the pool; both problems share it, with the first two as answers —
          so each answer is judged against its hardest neighbors. Judge prompt still says "focus on the vowel":
          for the /iː/ wall the vowel is identical, so a mis-selection there is the finding, not operator error.
        </p>
      </LuminaPanel>

      {/* The voice-controlled queue — painted from controller state */}
      <LuminaPanel className="text-center space-y-4 py-6">
        <div className="grid sm:grid-cols-2 gap-4 pt-2 pb-1 text-left">
          {items.map((p, i) => {
            const done = !!choice.answers[i]?.correct;
            const isFocus = i === choice.focusIdx && !choice.allSolved;
            return (
              <LuminaVoiceTarget
                key={`${p.answer}-${i}-${p.options.join('')}`}
                label={`Problem ${i + 1}`}
                active={isFocus}
                done={done}
                accent={config.modality === 'open' ? 'purple' : 'cyan'}
                onFocus={() => choice.focusItem(i)}
                activeHint={
                  choice.voice.state === 'recording'
                    ? 'hearing you…'
                    : choice.voice.state === 'armed'
                      ? 'listening…'
                      : 'targeted'
                }
              >
                <p className="text-xs text-slate-500 mb-2">
                  say <span className="font-bold text-slate-300">“{p.answer.toUpperCase()}”</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {p.options.map((w) => {
                    const isVoice = choice.highlight?.idx === i && choice.highlight.word === w;
                    const sub = choice.answers[i]?.word === w ? choice.answers[i] : null;
                    return (
                      <button
                        key={w}
                        onClick={(e) => { e.stopPropagation(); choice.tapOption(i, w); }}
                        className={`w-14 h-14 rounded-xl border-2 text-2xl font-bold transition-all ${
                          sub
                            ? sub.correct
                              ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-100'
                              : 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                            : isVoice
                              ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-100 ring-2 ring-cyan-300/40 animate-pulse'
                              : 'bg-slate-700/40 border-slate-500/30 text-slate-200 hover:bg-slate-600/40'
                        }`}
                      >
                        {isVoice && (
                          <span className="block text-[9px] uppercase tracking-wider text-cyan-300">🎙</span>
                        )}
                        {w.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </LuminaVoiceTarget>
            );
          })}
        </div>

        {choice.allSolved && (
          <div className="space-y-2">
            <p className="text-amber-300 text-sm">Both letters answered! 🎉</p>
            <LuminaButton onClick={choice.reset}>↺ Play again</LuminaButton>
          </div>
        )}

        <CaptureSurface
          voice={choice.voice}
          modality={config.modality}
          idleLabel="Answer by voice"
          listeningLabel={listeningLabel}
          startLabel={config.modality === 'open' ? 'Open mic' : 'Start turn — say the letters'}
          statusNote={choice.note}
        />
      </LuminaPanel>
    </div>
  );
};

export default LetterNameScenario;
