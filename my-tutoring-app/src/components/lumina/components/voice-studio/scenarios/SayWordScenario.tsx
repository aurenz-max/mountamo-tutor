'use client';

/**
 * Say-the-word scenario — spoken PRODUCTION judging.
 *
 * The original blend-judge bench as a studio plug-in: pick a target word,
 * say it, the judge answers "did they say it?". Doubles as the minimal
 * reference for writing new scenarios: own your surface, wire the engine,
 * judge via judgeForPass, report trials/utterances upward.
 */

import React, { useCallback, useRef, useState } from 'react';
import { LuminaPanel } from '../../../ui';
import { SoundManager } from '../../../utils/SoundManager';
import {
  useVoiceCapture,
  type CapturedUtterance,
  type VoiceCapture,
} from '../../../hooks/useVoiceCapture';
import { judgeForPass } from '../studioJudge';
import { PRESET_WORDS, type LabVerdict, type StudioScenarioProps } from '../types';
import CaptureSurface from '../CaptureSurface';

interface SayContext {
  word: string;
}

const SCENARIO_ID = 'say-word';

const SayWordScenario: React.FC<StudioScenarioProps> = ({ config, recordTrial, reportUtterance }) => {
  const [targetWord, setTargetWord] = useState('map');
  const [customWord, setCustomWord] = useState('');
  const [note, setNote] = useState('');

  const resolvedWord = (customWord.trim() || targetWord).toLowerCase();
  const resolvedWordRef = useRef(resolvedWord);
  resolvedWordRef.current = resolvedWord;

  const configRef = useRef(config);
  configRef.current = config;
  const voiceRef = useRef<VoiceCapture | null>(null);

  const judge = useCallback(
    (utt: CapturedUtterance<SayContext>, pass: 'spec' | 'escalate' | 'fresh') =>
      judgeForPass(
        { kind: 'say', word: utt.context.word },
        utt,
        pass,
        configRef.current,
        SCENARIO_ID,
        recordTrial,
        setNote,
      ),
    [recordTrial],
  );

  const onSettle = useCallback(
    (verdict: LabVerdict | null, utt: CapturedUtterance<SayContext>) => {
      setNote('');
      if (!verdict) SoundManager.invalid();
      else if (verdict.isMatch) SoundManager.playCorrect();
      else SoundManager.playIncorrect();
      reportUtterance({
        utterance: utt,
        kind: { kind: 'say', word: utt.context.word },
        scenario: SCENARIO_ID,
      });
      // A match completes the activation in turn mode (open mic just keeps
      // listening — say it again, change the word, or close it).
      if (verdict?.isMatch && configRef.current.modality === 'turn') {
        voiceRef.current?.stop();
        setNote('Matched — turn complete.');
      }
    },
    [reportUtterance],
  );

  const onNoSpeech = useCallback(() => {
    if (configRef.current.modality === 'ptt') {
      SoundManager.invalid();
      setNote('No speech detected — try again closer to the mic.');
    }
  }, []);

  const voice = useVoiceCapture<LabVerdict, SayContext>({
    modality: config.modality,
    getContext: () => ({ word: resolvedWordRef.current }),
    judge,
    isConfident: (v) => v.confidence === 'high',
    onSettle,
    onNoSpeech,
    autoStart: config.autoArm,
    activationKey: `${SCENARIO_ID}:${resolvedWord}`,
    armDelayMs: config.armDelayMs,
    cooldownMs: config.cooldownMs,
  });
  voiceRef.current = voice;

  return (
    <div className="space-y-4">
      <LuminaPanel className="space-y-3">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Target word</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_WORDS.map((w) => (
            <button
              key={w}
              onClick={() => { setTargetWord(w); setCustomWord(''); }}
              className={`px-4 py-2 rounded-xl border-2 font-bold transition-all ${
                resolvedWord === w
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                  : 'bg-slate-700/40 border-slate-500/30 text-slate-300 hover:bg-slate-600/40'
              }`}
            >
              {w}
            </button>
          ))}
          <input
            value={customWord}
            onChange={(e) => setCustomWord(e.target.value)}
            placeholder="custom…"
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/20 text-slate-200 text-sm w-28 focus:outline-none focus:border-emerald-400/50"
          />
        </div>
      </LuminaPanel>

      <LuminaPanel className="text-center py-6">
        <CaptureSurface
          voice={voice}
          modality={config.modality}
          idleLabel={`Say “${resolvedWord}”`}
          listeningLabel={`Say “${resolvedWord}” now!`}
          startLabel={config.modality === 'open' ? 'Open mic' : `Start turn — say “${resolvedWord}”`}
          statusNote={note}
        />
      </LuminaPanel>
    </div>
  );
};

export default SayWordScenario;
