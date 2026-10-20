'use client';

/**
 * mission-planner at Kindergarten and Grade 1: the ungraded planning story (user ruling 10-16). Pick a place, pack, fly,
 * hear how long the trip takes in words. Nothing is scored or submitted, and it never mounts the graded workspace (the
 * boss's `validate` refuses a story grade), so it is not taught by the boss: its tutor voice is the scripted session's,
 * each message saying what to do. The graded planner (grades 2-5) is `MissionPlanner.tsx`, on its boss.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import { ReadMeButton } from '../../shared/ReadMeButton';
import {
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaFeedbackCard,
  LuminaPrompt,
} from '../../../ui';
import { PLACE_COLOR, STORY_TRIP, storyPlaces, type Place, type StoryPlace } from './missionWorkspace';
import type { MissionPlannerData } from './MissionPlanner';

/** A place, always the same size (a bigger picture must not hint at a farther place). */
export function PlacePicture({ place, size = 56 }: { place: Place | StoryPlace; size?: number }) {
  const c = size / 2, r = size * 0.36, fill = PLACE_COLOR[place];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" data-place={place}>
      {place === 'asteroids' ? (
        [[-10, -6, 5], [6, -9, 4], [9, 5, 6], [-6, 8, 4], [0, 0, 3], [-13, 4, 3]].map(([dx, dy, rr], i) => (
          <circle key={i} cx={c + dx} cy={c + dy} r={rr} fill={fill} stroke="#57534e" strokeWidth={0.8} />
        ))
      ) : (
        <>
          <circle cx={c} cy={c} r={r} fill={fill} stroke="#0f172a" strokeWidth={0.8} />
          {place === 'saturn' && <ellipse cx={c} cy={c} rx={r * 1.45} ry={r * 0.38} fill="none" stroke="#fde68a" strokeWidth={2} />}
          {place === 'jupiter' && <path d={`M${c - r} ${c - 3} H${c + r} M${c - r + 2} ${c + 5} H${c + r - 2}`} stroke="#92400e" strokeWidth={2} opacity={0.6} />}
          {place === 'moon' && <><circle cx={c - 5} cy={c - 4} r={3} fill="#94a3b8" /><circle cx={c + 6} cy={c + 5} r={2.4} fill="#94a3b8" /></>}
        </>
      )}
    </svg>
  );
}

type StoryStep = 'choose' | 'pack' | 'fly' | 'arrived';
const STORY_PACK = [
  { id: 'food', icon: '🍎', name: 'Food' },
  { id: 'water', icon: '💧', name: 'Water' },
  { id: 'air', icon: '🫧', name: 'Air' },
] as const;
const STORY_SAY: Record<StoryStep, string> = {
  choose: 'Where shall our spaceship fly? Pick a place.',
  pack: 'Astronauts need food, water and air. Tap them to put them in the ship, then press Fly.',
  fly: 'Off we go!',
  arrived: 'We made it! Want to fly somewhere else?',
};
const STORY_NAME: Record<StoryPlace, string> = { moon: 'The Moon', mars: 'Mars', jupiter: 'Jupiter' };

export default function MissionStory({ data, className }: { data: MissionPlannerData; className?: string }) {
  const { title, gradeLevel, instanceId } = data;
  const places = useMemo<StoryPlace[]>(() => {
    const asked = (data.story?.places ?? []).filter((p): p is StoryPlace => p in STORY_TRIP);
    return asked.length >= 2 ? asked : storyPlaces(gradeLevel);
  }, [data.story?.places, gradeLevel]);
  const stableId = useRef(instanceId || `mission-planner-story-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableId.current;
  const [step, setStep] = useState<StoryStep>('choose');
  const [place, setPlace] = useState<StoryPlace | null>(null);
  const [packed, setPacked] = useState<string[]>([]);
  const [flown, setFlown] = useState(false);

  const aiPrimitiveData = useMemo(() => ({
    title, gradeLevel: gradeLevel ?? 'K', mode: 'story (ungraded: nothing is right or wrong)',
    ask: `${STORY_SAY[step]} Places: ${places.map(p => STORY_NAME[p]).join(', ')}. Chosen: ${place ? STORY_NAME[place] : 'nothing yet'}.`,
  }), [title, gradeLevel, step, places, place]);
  const { sendText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'mission-planner', instanceId: resolvedInstanceId, primitiveData: aiPrimitiveData, gradeLevel: 'kindergarten',
  });
  const tell = (text: string) => sendText(text, { silent: true });

  const oriented = useRef(false);
  useEffect(() => {
    if (oriented.current) return;
    oriented.current = true;
    tell(`[MISSION_ORIENT] A pre-reader who cannot read any text opened a space-trip story: "${title}". They pick a place to `
      + `fly to (${places.map(p => STORY_NAME[p]).join(' or ')}). Nothing here is right or wrong and nothing is scored. Say what to do in child words.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The flight takes a moment on screen, then the arrival.
  useEffect(() => {
    if (step !== 'fly') return;
    const raf = requestAnimationFrame(() => setFlown(true));
    const t = setTimeout(() => {
      setStep('arrived');
      if (place) tell(`[MISSION_ARRIVED] The ship reached ${STORY_NAME[place]}. Say, without numbers: "${STORY_TRIP[place]}"`);
    }, 2600);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const choose = (p: StoryPlace) => {
    SoundManager.select();
    setPlace(p); setStep('pack');
    tell(`[MISSION_DESTINATION_SELECTED] The child picked ${STORY_NAME[p]}. Say its name and one thing about it they can picture. Any place is a fine choice.`);
  };
  const togglePack = (id: string) => { SoundManager.select(); setPacked(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id])); };
  const fly = () => { SoundManager.playCorrect(); setFlown(false); setStep('fly'); };
  const again = () => { setPlace(null); setPacked([]); setFlown(false); setStep('choose'); };

  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: 'story',
    label: 'The space trip story',
    solved: step === 'arrived',
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  const farX = place === 'moon' ? 120 : place === 'mars' ? 220 : 290;
  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{`🛸 ${title || 'Space Trip'}`}</LuminaCardTitle>
      </LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <LuminaPrompt accent="cyan" className="flex-1">{STORY_SAY[step]}</LuminaPrompt>
          <ReadMeButton instruction={STORY_SAY[step]} ask="Then wait." speaking={isAudioPlaying}
            onAskTutor={m => sendText?.(m)} tag="[MISSION_READ_ALOUD]" className="flex-shrink-0" aria-label="Read it to me" />
        </div>
        {pip.store && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-3" data-story-step={step}>
          {step === 'choose' && (
            <div className={`grid gap-2 ${places.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {places.map(p => (
                <LuminaAnswerChoice key={p} aria-label={STORY_NAME[p]} state="idle" className="flex flex-col items-center gap-1 p-3" onClick={() => choose(p)}>
                  <PlacePicture place={p} size={64} />
                  <span className="text-sm font-semibold">{STORY_NAME[p]}</span>
                </LuminaAnswerChoice>
              ))}
            </div>
          )}
          {step === 'pack' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {STORY_PACK.map(s => (
                  <LuminaAnswerChoice key={s.id} aria-label={s.name} state={packed.includes(s.id) ? 'selected' : 'idle'}
                    className="flex flex-col items-center gap-1 p-3" onClick={() => togglePack(s.id)}>
                    <span aria-hidden="true" className="text-3xl">{s.icon}</span>
                    <span className="text-sm">{s.name}</span>
                  </LuminaAnswerChoice>
                ))}
              </div>
              <div className="flex justify-center">
                <LuminaActionButton action="next" onClick={fly}>🚀 Fly!</LuminaActionButton>
              </div>
            </div>
          )}
          {(step === 'fly' || step === 'arrived') && place && (
            <svg viewBox="0 0 320 120" className="block w-full rounded-xl bg-[#0b1026]" role="img" aria-label={`The ship flying to ${STORY_NAME[place]}`} data-story-flight>
              <circle cx={30} cy={70} r={16} fill="#4a90d9" />
              <g transform={`translate(${farX - 28} 42)`}><PlacePicture place={place} size={56} /></g>
              <path d={`M46 66 Q${(46 + farX) / 2} 18 ${farX - 22} 64`} fill="none" stroke="#94a3b8" strokeDasharray="4 4" />
              <text fontSize={20} style={{ transition: 'transform 2.4s ease-in-out', transform: `translate(${flown ? farX - 40 : 40}px, ${flown ? 60 : 64}px)` }} data-ship>🚀</text>
              <text x={8} y={112} fontSize={10} fill="#cbd5e1">{packed.map(id => STORY_PACK.find(s => s.id === id)?.icon).join(' ')}</text>
            </svg>
          )}
          {step === 'arrived' && place && (
            <div className="space-y-3">
              <LuminaFeedbackCard status="insight" label={`${STORY_NAME[place]}!`}>{STORY_TRIP[place]}</LuminaFeedbackCard>
              <div className="flex justify-center">
                <LuminaActionButton action="next" onClick={again}>Fly somewhere else</LuminaActionButton>
              </div>
            </div>
          )}
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
}
