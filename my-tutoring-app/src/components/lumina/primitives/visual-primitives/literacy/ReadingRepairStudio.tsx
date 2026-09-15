'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaPanel, LuminaBadge, LuminaButton, LuminaChallengeCounter, LuminaPrompt,
  LuminaFeedbackCard, LuminaActionButton, LuminaMicListener, LuminaReadAloud } from '../../../ui';
import { SoundManager } from '../../../utils/SoundManager';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { ReadingRepairStudioMetrics } from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useVoiceCapture } from '../../../hooks/useVoiceCapture';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import { classifyReadingRepair, readingWords, repairSummary, REPAIR_OUTCOME_COPY,
  type ReadingRepairAttempt, type ReadingRepairEvidence, type ReadingRepairVerdict } from './readingRepairEvidence';

export interface ReadingRepairChallenge {
  id: string;
  challengeType: 'notice_and_repair';
  /** A complete 5-8 word sentence. The printed sentence is the reference. */
  text: string;
}

export interface ReadingRepairStudioData {
  title: string;
  description: string;
  gradeLevel: string;
  challengeType: 'notice_and_repair';
  challenges: ReadingRepairChallenge[];
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ReadingRepairStudioMetrics>) => void;
}

const PHASES = { notice_and_repair: { label: 'Checked word reading (provisional)', icon: '📖', accentColor: 'blue' as const } };
const uncertainVerdict = (): ReadingRepairVerdict => ({ status: 'uncertain', transcripts: [], mismatchIndexes: [],
  reason: 'The recording could not be checked.' });

const CHECKING_TIPS = [
  'Look at every letter. Does the word you said match?',
  'Think about what the sentence means. Then check the letters, too. A word that makes sense still needs to match the print.',
  'Listen to your recording. Follow the printed words. Tap a word you want to check, look at all its letters, and read the whole sentence again.',
] as const;
interface ReadingProgress {
  challengeId: string; stage: 'cold_read' | 'recording' | 'checking' | 'reflection';
  supportLevel: number; supportRecorded: boolean; recordingsCount: number; replayCount: number; selectedWordCount: number;
}

interface RoundProps {
  challenge: ReadingRepairChallenge;
  onComplete: (evidence: ReadingRepairEvidence) => void;
  tutorAudible: boolean;
  tutorResponding: boolean;
  onProgress: (progress: ReadingProgress) => void;
  onHearTip: (challengeId: string, level: number) => void;
  onCancelTip: () => void;
}

/** A keyed round owns the recording, pending requests and every editable field.
 * Unmount/advance cannot carry a selection or a late verdict into fresh text. */
function ReadingRepairRound({ challenge, onComplete, tutorAudible, tutorResponding, onProgress, onHearTip, onCancelTip }: RoundProps) {
  const [attempts, setAttempts] = useState<ReadingRepairAttempt[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [supported, setSupported] = useState(false);
  const [supportLevel, setSupportLevel] = useState(0);
  const [message, setMessage] = useState('');
  const [clips, setClips] = useState<string[]>([]);
  const [replays, setReplays] = useState(0);
  const [reflection, setReflection] = useState('');
  const [finishing, setFinishing] = useState(false);
  const recorded = useRef(false);
  const supportRef = useRef(false);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const urls = useRef(new Set<string>());
  const requests = useRef(new Set<AbortController>());
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);
  const words = readingWords(challenge.text);
  // A shared lesson tutor can speak even though this primitive never asks it
  // to. Conservatively invalidate independence whenever that happens.
  if (tutorAudible) supportRef.current = true;
  useEffect(() => { if (tutorAudible) setSupported(true); }, [tutorAudible]);
  const capture = useVoiceCapture<ReadingRepairVerdict, { id: string; epoch: number; selected: number[]; supported: boolean }>({
    modality: 'ptt', autoStart: false, speculative: false, silenceMs: 1800, maxClipMs: 15000,
    activationKey: challenge.id,
    getContext: () => ({ id: challenge.id, epoch: epoch.current, selected: [...selected], supported: supportRef.current }),
    isConfident: () => false,
    judge: async (utterance) => {
      urls.current.add(utterance.url);
      const controller = new AbortController();
      requests.current.add(controller);
      const timer = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch('/api/lumina/reading-repair-judge', { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ text: challenge.text, audioBase64: utterance.base64 }) });
        if (!response.ok) return uncertainVerdict();
        const result = await response.json() as ReadingRepairVerdict;
        return ['matched', 'mismatch', 'uncertain'].includes(result.status) && Array.isArray(result.transcripts)
          && Array.isArray(result.mismatchIndexes) ? result : uncertainVerdict();
      } catch { return uncertainVerdict(); }
      finally {
        clearTimeout(timer);
        requests.current.delete(controller);
        if (!mounted.current) { URL.revokeObjectURL(utterance.url); urls.current.delete(utterance.url); }
      }
    },
    onSettle: (verdict, utterance) => {
      if (!mounted.current || recorded.current || utterance.context.id !== challenge.id || utterance.context.epoch !== epoch.current) return;
      const evidence = verdict ?? uncertainVerdict();
      setAttempts(previous => [...previous, { verdict: evidence, selectedIndexes: utterance.context.selected,
        supportBeforeReading: utterance.context.supported || supportRef.current, capturedAt: new Date().toISOString(), durationMs: utterance.ms }]);
      setClips(previous => [...previous, utterance.url]);
      // The first verdict stays private: neither red words nor a success badge
      // tells the child whether to notice an error. Uncertainty is technical.
      setMessage(evidence.status === 'uncertain'
        ? 'We could not check this recording clearly. You can listen, try again, or keep going.'
        : 'Your recording is ready. Listen back and check the print.');
    },
    onNoSpeech: () => setMessage('We did not catch a reading. Try the microphone again, or continue without a recording.'),
  });
  const busy = capture.state !== 'idle';
  useEffect(() => {
    onProgress({ challengeId: challenge.id, stage: busy ? 'recording' : finishing ? 'reflection' : attempts.length ? 'checking' : 'cold_read',
      supportLevel, supportRecorded: supported, recordingsCount: attempts.length, replayCount: replays, selectedWordCount: selected.length });
  }, [challenge.id, busy, finishing, attempts.length, supportLevel, supported, replays, selected.length, onProgress]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      epoch.current++;
      requests.current.forEach(request => request.abort());
      urls.current.forEach(url => URL.revokeObjectURL(url));
      urls.current.clear();
    };
  }, []);

  const startReading = () => {
    if (busy || finishing || recorded.current || tutorAudible || tutorResponding) return;
    onCancelTip();
    audioRefs.current.forEach(audio => audio?.pause());
    epoch.current++;
    setMessage('');
    capture.start();
  };
  const cancelReading = () => {
    epoch.current++;
    capture.stop();
    requests.current.forEach(request => request.abort());
    setMessage('Recording stopped. You can try again when you are ready.');
  };
  const askForHelp = () => {
    if (busy || finishing) return;
    supportRef.current = true; // synchronous: a quick mic tap cannot bypass support provenance
    setSupported(true);
    setSupportLevel(level => Math.min(3, level + 1));
  };
  const finish = () => {
    if (busy || recorded.current) return;
    recorded.current = true;
    onCancelTip();
    capture.stop();
    onComplete({ challengeId: challenge.id, text: challenge.text, attempts, supportRequested: supported,
      replayCount: replays, reflection, outcome: classifyReadingRepair(attempts) });
  };

  return <div className="space-y-6">
    <LuminaPrompt>{attempts.length ? 'Does your reading match the print?' : 'Read the sentence in your own voice.'}</LuminaPrompt>
    <LuminaPanel className="py-8">
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-4 leading-loose" aria-label="Printed sentence">
        {words.map((word, index) => <button key={`${challenge.id}-${index}`} type="button"
          aria-label={`Revisit ${word}, word ${index + 1}`} aria-pressed={selected.includes(index)}
          disabled={!attempts.length || busy || finishing}
          onClick={() => {
            SoundManager.toggle(!selected.includes(index));
            setSelected(previous => previous.includes(index) ? previous.filter(i => i !== index) : [...previous, index]);
          }}
          className={`rounded-lg border-b-4 px-2 py-1 text-3xl font-medium sm:text-4xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${selected.includes(index)
            ? 'border-cyan-300 text-cyan-200' : 'border-transparent text-slate-100'} disabled:cursor-default`}>
          {word}
        </button>)}
      </div>
      {attempts.length > 0 && !finishing && <p className="mt-5 text-center text-sm text-slate-300">
        Tap any words you want to revisit. Then read the whole sentence again.
      </p>}
    </LuminaPanel>
    {clips.length > 0 && <div className="space-y-3">
      {clips.map((url, index) => <div key={url}>
        <p className="mb-1 text-sm text-slate-300">{index === 0 ? 'My first reading' : `My rereading ${index}`}</p>
        <audio ref={element => { audioRefs.current[index] = element; }} src={url} controls preload="metadata"
          className="w-full" aria-label={index === 0 ? 'Replay my first reading' : `Replay my rereading ${index}`}
          onPlay={() => {
            if (busy || tutorAudible || tutorResponding) { audioRefs.current[index]?.pause(); return; }
            audioRefs.current.forEach((audio, other) => { if (other !== index) audio?.pause(); });
            setReplays(count => count + 1);
          }} />
      </div>)}
    </div>}
    {message && <p role="status" className="text-center text-sm text-slate-300">{message}</p>}
    {!finishing && <>
      {(tutorAudible || tutorResponding) && !busy ? <p role="status" className="text-center text-slate-300">Listen to the tip, then read when you are ready.</p> : <LuminaMicListener state={capture.state} level={capture.level} isSupported={capture.isSupported}
        onStart={startReading} onCancel={cancelReading} accent="emerald"
        idleLabel={attempts.length ? 'Read it again' : 'Record my reading'}
        listeningLabel="Read when you are ready" recordingLabel="I’m listening" judgingLabel="Saving your reading" />}
      {(!capture.isSupported || capture.micPermission === 'denied') && <p role="status" className="text-center text-slate-300">
        The microphone is unavailable. Read with a partner and continue without a score.
      </p>}
      {supportLevel > 0 && <div className="space-y-3">
        <LuminaFeedbackCard status="insight" teachingNote="Help is part of practice.">{CHECKING_TIPS[supportLevel - 1]}</LuminaFeedbackCard>
        <LuminaReadAloud label="Hear this tip" speakingLabel="Listening to the tip" speaking={tutorAudible}
          disabled={busy || tutorAudible || tutorResponding} onClick={() => {
            supportRef.current = true;
            setSupported(true);
            audioRefs.current.forEach(audio => audio?.pause());
            onHearTip(challenge.id, supportLevel);
          }} />
      </div>}
      <div className="flex flex-wrap justify-center gap-3">
        {attempts.length > 0 && supportLevel < 3 && <LuminaButton tone="ghost" disabled={busy} onClick={askForHelp}>
          {supportLevel === 0 ? 'Help me check' : supportLevel === 1 ? 'Another way to check' : 'Walk me through it'}
        </LuminaButton>}
        <LuminaActionButton action="check" disabled={busy || tutorAudible || tutorResponding} onClick={() => { onCancelTip(); setFinishing(true); }}>
          {attempts.length ? 'I’m done checking' : 'Continue without a recording'}
        </LuminaActionButton>
      </div>
    </>}
    {finishing && <LuminaPanel className="space-y-4">
      <p className="text-slate-200">What helped you check? (You can skip this.)</p>
      <div className="flex flex-wrap gap-2">{['The letters', 'The sentence meaning', 'Listening back'].map(strategy =>
        <LuminaButton key={strategy} tone={reflection === strategy ? 'primary' : 'ghost'}
          aria-pressed={reflection === strategy} onClick={() => {
            SoundManager.select();
            setReflection(reflection === strategy ? '' : strategy);
          }}>{strategy}</LuminaButton>)}</div>
      <LuminaActionButton action="next" onClick={finish}>Finish this sentence</LuminaActionButton>
      <LuminaButton tone="ghost" onClick={() => setFinishing(false)}>Go back to my reading</LuminaButton>
    </LuminaPanel>}
  </div>;
}

function ReadingRepairSession({ data, className }: { data: ReadingRepairStudioData; className?: string }) {
  const stableId = useRef(data.instanceId ?? `reading-repair-${crypto.randomUUID()}`);
  const [evidence, setEvidence] = useState<ReadingRepairEvidence[]>([]);
  const [roundDone, setRoundDone] = useState<ReadingRepairEvidence | null>(null);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [tutorEnabled, setTutorEnabled] = useState(false);
  const [tipRequest, setTipRequest] = useState<{ id: number; challengeId: string; level: number } | null>(null);
  const [tipInFlight, setTipInFlight] = useState(false);
  const tipAudioStarted = useRef(false);
  const tipSequence = useRef(0);
  const sentTip = useRef(0);
  const onProgress = useCallback((next: ReadingProgress) => setProgress(next), []);
  const cancelTip = useCallback(() => setTipRequest(null), []);
  const hearTip = useCallback((challengeId: string, level: number) => {
    setTutorEnabled(true);
    setTipRequest({ id: ++tipSequence.current, challengeId, level });
  }, []);
  const { currentIndex, results, isComplete, recordResult, advance } = useChallengeProgress({
    challenges: data.challenges, getChallengeId: challenge => challenge.id,
  });
  const current = data.challenges[currentIndex];
  const summary = useMemo(() => repairSummary(evidence), [evidence]);
  const phaseResults = usePhaseResults({ challenges: data.challenges, results, isComplete,
    getChallengeType: challenge => challenge.challengeType, phaseConfig: PHASES,
    getScore: () => summary.overallAccuracy });
  const { submitResult } = usePrimitiveEvaluation<ReadingRepairStudioMetrics>({
    primitiveType: 'reading-repair-studio', instanceId: stableId.current,
    skillId: data.skillId, subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit, localOnly: true, autoSubmitOnUnmount: false,
  });
  const activeProgress = progress?.challengeId === current?.id && !roundDone ? progress : null;
  // Deliberately omit print, transcripts, verdicts and selected word identities.
  // Only an explicit voice-tip request or final completion enables connection.
  const { sendText, isConnected, isAudioPlaying, isAIResponding, activePrimitiveId } = useLuminaAI({
    primitiveType: 'reading-repair-studio', instanceId: stableId.current,
    gradeLevel: data.gradeLevel, enabled: tutorEnabled || isComplete, ownsOpening: true,
    primitiveData: { assessmentStatus: 'provisional-local-only', sessionComplete: isComplete,
      challengeType: 'notice_and_repair', challengeNumber: Math.min(currentIndex + 1, data.challenges.length),
      totalChallenges: data.challenges.length, stage: isComplete ? 'complete' : roundDone ? 'closed' : activeProgress?.stage ?? 'cold_read',
      supportLevel: activeProgress?.supportLevel ?? 0, supportRecorded: activeProgress?.supportRecorded ?? false,
      independentWindowOpen: !isComplete && !roundDone && !activeProgress?.supportRecorded,
      recordingsCount: activeProgress?.recordingsCount ?? 0, replayCount: activeProgress?.replayCount ?? 0,
      selectedWordCount: activeProgress?.selectedWordCount ?? 0 } });
  useEffect(() => {
    if (!isConnected || !tipRequest || sentTip.current === tipRequest.id || roundDone || isComplete
      || tipRequest.challengeId !== current?.id || !activeProgress?.supportRecorded || activeProgress.stage !== 'checking') return;
    sentTip.current = tipRequest.id;
    tipAudioStarted.current = false;
    setTipInFlight(true);
    sendText(`[READING_HELP] The child tapped Hear this tip. Support was recorded before this request. Level ${tipRequest.level}. Say this checking tip only: ${CHECKING_TIPS[tipRequest.level - 1]}`, { silent: true, activate: true });
  }, [isConnected, tipRequest, roundDone, isComplete, current?.id, activeProgress, sendText]);
  // A connection that never arrives must not speak an old request later.
  useEffect(() => {
    if (!tipRequest) return;
    const timer = setTimeout(cancelTip, 15000);
    return () => clearTimeout(timer);
  }, [tipRequest, cancelTip]);
  // Silent cues do not set the shared isAIResponding flag before first audio.
  // Hold capture/advance through that gap, then release after actual playback.
  useEffect(() => {
    if (!tipInFlight) return;
    if (isAudioPlaying) tipAudioStarted.current = true;
    else if (tipAudioStarted.current) setTipInFlight(false);
  }, [tipInFlight, isAudioPlaying]);
  useEffect(() => {
    if (!tipInFlight) return;
    const timer = setTimeout(() => setTipInFlight(false), 20000);
    return () => clearTimeout(timer);
  }, [tipInFlight]);
  const submitted = useRef(false);
  useEffect(() => { setRoundDone(null); }, [current?.id]);
  useEffect(() => {
    if (!isComplete || submitted.current || evidence.length !== data.challenges.length) return;
    submitted.current = true;
    const attemptsCount = evidence.reduce((sum, row) => sum + row.attempts.length, 0);
    const metrics: ReadingRepairStudioMetrics = { type: 'reading-repair-studio', challengeType: 'notice_and_repair',
      totalChallenges: evidence.length, attemptsCount,
      firstTryCount: summary.accurateFirstReadCount, hintsViewed: evidence.filter(row => row.supportRequested).length,
      averageAttemptsPerChallenge: attemptsCount / evidence.length,
      ...summary, assessmentStatus: 'provisional', masteryEligible: false };
    submitResult(summary.assessableCount > 0 && summary.unresolvedErrorCount === 0, summary.overallAccuracy, metrics,
      { evidence, scoringBasis: 'provisional-word-reading-accuracy', masteryEligible: false,
        assessmentLimitations: ['Agreement is not proof of recognition accuracy.', 'No child-voice calibration yet.',
          'Insertions, omissions, within-recording repairs and unclear audio are unassessable.',
          'Reflection and replay are not proof of correction.'], audioStored: false });
  }, [isComplete, evidence, data.challenges.length, summary, submitResult]);
  const completionSpoken = useRef(false);
  useEffect(() => {
    if (!isComplete || !isConnected || completionSpoken.current) return;
    completionSpoken.current = true;
    sendText('[ALL_COMPLETE] Reading checking practice is finished. Offer one short encouragement for careful checking. Do not claim accuracy or mastery.', { silent: true });
  }, [isComplete, isConnected, sendText]);

  // Pip shares the round (the printed sentence, recordings and controls) as one
  // region and follows the child's taps. Verdicts here are provisional practice
  // feedback, never a confirmed result, so Pip does not celebrate.
  const pip = useWorkspacePipSurface({
    instanceId: stableId.current,
    scopeId: isComplete || roundDone ? null : current?.id ?? null,
    label: 'The sentence you are reading',
    solved: false,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === stableId.current,
  });

  return <LuminaCard className={className}>
    <LuminaCardHeader><div className="flex flex-wrap items-center justify-between gap-3">
      <LuminaCardTitle>{data.title}</LuminaCardTitle><LuminaBadge accent="blue">Read · Check · Reread</LuminaBadge>
    </div><LuminaCardDescription>{data.description}</LuminaCardDescription></LuminaCardHeader>
    <LuminaCardContent className="space-y-6">
      {!isComplete && current && <LuminaChallengeCounter current={currentIndex + 1} total={data.challenges.length} />}
      {pip.store && !isComplete && current && <div {...pip.dock} />}
      {isComplete ? <div className="space-y-5">
        <LuminaPrompt>Your reading practice</LuminaPrompt>
        {evidence.map(row => <LuminaFeedbackCard key={row.challengeId} status="insight"
          teachingNote={REPAIR_OUTCOME_COPY[row.outcome]}>{row.text}</LuminaFeedbackCard>)}
        <p className="text-sm text-slate-300">These audio checks are practice feedback. They do not update mastery.
          Unclear readings are left unscored. Listening back and reflection do not count as repairs.</p>
        {summary.assessableCount === data.challenges.length && <details><summary className="cursor-pointer text-sm text-slate-300">Reading evidence</summary>
          <PhaseSummaryPanel phases={phaseResults} overallScore={summary.overallAccuracy} heading="Provisional word reading" />
          <p className="text-sm text-slate-300">Accurate first readings: {summary.accurateFirstReadCount}. Independent repairs: {summary.independentRepairCount}.
            Repairs after help: {summary.supportedRepairCount}. Unresolved: {summary.unresolvedErrorCount}. Unscored: {summary.unassessableCount}.</p>
        </details>}
      </div> : roundDone ? <div className="space-y-5">
        <LuminaFeedbackCard status="insight">{REPAIR_OUTCOME_COPY[roundDone.outcome]}</LuminaFeedbackCard>
        <LuminaActionButton action="next" onClick={() => { setRoundDone(null); advance(); }}>Try a fresh sentence</LuminaActionButton>
      </div> : current ? <div {...pip.workspace}><ReadingRepairRound key={current.id} challenge={current} tutorAudible={isAudioPlaying}
        tutorResponding={isAIResponding || tipInFlight} onProgress={onProgress} onHearTip={hearTip} onCancelTip={cancelTip} onComplete={row => {
        setEvidence(previous => [...previous, row]);
        setRoundDone(row);
        recordResult({ challengeId: row.challengeId, correct: ['accurate_first_read', 'independent_repair', 'supported_repair'].includes(row.outcome),
          attempts: row.attempts.length, outcome: row.outcome });
      }} /></div> : <p>No sentences are available. Generate a new activity.</p>}
    </LuminaCardContent>
  </LuminaCard>;
}

export default function ReadingRepairStudio(props: { data: ReadingRepairStudioData; className?: string;
  /** Explicit local observer for tester evidence. Renderer-injected callbacks
   * inside data can submit scores to Pulse, so they are deliberately excluded. */
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ReadingRepairStudioMetrics>) => void;
}) {
  // Regeneration may reuse index-derived IDs. The text fingerprint remounts all
  // progress, submission latches, audio and state even in that case.
  const sessionKey = `${props.data.instanceId ?? ''}:${props.data.challenges.map(c => `${c.id}:${c.text}`).join('|')}`;
  return <ReadingRepairSession key={sessionKey} className={props.className}
    data={{ ...props.data, onEvaluationSubmit: props.onEvaluationSubmit }} />;
}
