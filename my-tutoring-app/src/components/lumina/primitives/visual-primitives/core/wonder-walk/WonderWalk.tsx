import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../../evaluation';
import type { WonderWalkMetrics } from '../../../../evaluation/types';
import { LuminaCard, LuminaCardContent, LuminaFeedbackCard } from '../../../../ui';
import { SoundManager } from '../../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../../components/live-activity/runtime/useWorkspaceProgress';
import { describeWork, moveMiss, moveMatches, pickMiss, stopMatches, wordMatches, wordMiss, workspaceScene } from './wonderWalkWorkspace';
import { WonderWalkWordStage } from './WonderWalkWordStage';
import { targetsFor, type Arrangement, type CounterColor, type World, type WorldObject, type WorldPlace } from './wonderWalkWorld';
import type { WordWorld } from './wonderWalkWords';
import { wonderWalkBoss } from './wonderWalk.boss';

/**
 * Wonder Walk — an agent-authored walk for a child who cannot read yet (Kindergarten).
 *
 * A walk is 3-5 stops on one big idea. Each stop is one screen: a scene that shows the idea, the tutor's narration of
 * it, and something to do. Audio is the instruction channel: nothing on screen must be read, nothing to type, no
 * counters or meters.
 *
 * `which-one` (science, social studies): tap which of 2-3 pictures fits the idea; never the scene's own example.
 *
 * Math stops are small worlds the author describes (`service/core/wonder-walk/world.ts`): places (a group, a pile, a
 * basket, coloured plates, ten-frames, a cup that hides what is under it) holding pictures, a story the tutor tells
 * (some join, some leave: drawn with a ring, or as ghosts), and an answer: tap a place, tap a number, or move things
 * until a goal holds and tap Done. Code derives the key and names the eval mode from the structure: how-many,
 * more-fewer, count-out, add-take, parts, teens, sort-count, count-on.
 */

// ============================================================================
// Types (single source of truth)
// ============================================================================

export type WonderWalkMathType = 'how-many' | 'more-fewer' | 'count-out' | 'add-take' | 'parts' | 'teens' | 'sort-count' | 'count-on';
/** Language stops (word worlds, `wonderWalkWords.ts`). */
export type WonderWalkWordType = 'rhyme' | 'first-sound' | 'last-sound' | 'middle-sound' | 'syllables' | 'blend' | 'change-sound'
  | 'letter-name' | 'letter-sound' | 'spell-word' | 'word-kinds' | 'one-many' | 'where-is' | 'story-detail' | 'story-order';
export type WonderWalkStopType = 'which-one' | WonderWalkMathType | WonderWalkWordType;

/**
 * How a wrong picture or place can draw a child in. Null on the right one.
 * which-one (named by the author): looks_like, goes_with, other.
 * math (computed by code): one_off, far_off, reversed (the opposite of most or fewest).
 */
export type WonderWalkTrap = 'looks_like' | 'goes_with' | 'other' | 'one_off' | 'far_off' | 'reversed';

export interface WonderWalkOption {
  id: string;
  /** A word from the reviewed word library; the picture is its emoji. */
  word: string;
  emoji: string;
  trap: WonderWalkTrap | null;
}

export interface WonderWalkStop {
  id: string;
  challengeType: WonderWalkStopType;
  /** The idea this stop teaches, one short sentence (tutor-facing). */
  idea: string;
  /** What the tutor says over the scene. Never names the right picture; on a math stop, tells the story with its parts. */
  narration: string;
  /** The question the tutor asks. Never names the right picture or says the answer number. */
  ask: string;
  /** The why-card after a wrong answer: the idea again in other words. Never the answer. */
  why: string;
  /** What the scene picture shows, as library words (the fallback picture is their emoji). */
  sceneWords: string[];
  sceneEmoji: string[];
  /** Math stops: the world the child sees and acts on. */
  world?: World;
  /** Language stops: the word world (pictures and letters with their sounds, a story, a tap, sort or order). */
  words?: WordWorld;
  /** Math stops: the standards this world serves (from its structure). */
  standards?: string;
  /** Math stops: the difficulty code computed from the structure (tester and calibration; never shown or said). */
  difficulty?: { band: 'easy' | 'medium' | 'hard'; score: number; reasons: string[] };
  /** A generated scene picture, when one was made. Math stops never get one. */
  sceneImage: string | null;
  /** which-one: 2-3 pictures in code-shuffled order (math stops: none; their answer lives in `world`). */
  options: WonderWalkOption[];
  /** which-one: the right picture. Math tap: `place-<id>`; number: `num-<n>`; move: empty (the goal is the check). */
  correctOptionId: string;
  /**
   * What the child produces, chosen by the author (`wonderWalkSpoken.ts`): `show` (on screen only), `say` (say the one
   * answer, or tap it), `say-any` (say any word the rule holds for, or tap the card that fits). Absent on older stops:
   * read as `say` when the answer can be said.
   */
  respond?: 'show' | 'say' | 'say-any';
  /** say-any: other library words the rule holds for, computed by code when the stop was built (the judge's examples). */
  sayAny?: string[];
}

export interface WonderWalkData {
  title: string;
  /** The walk's one big idea, one sentence. */
  bigIdea: string;
  /** The strand the walk serves. */
  domain: 'science' | 'language' | 'math' | 'social-studies';
  gradeBand: 'K';
  /** The walk's eval mode: the type of its first stop (a blend mixes stop types; each stop carries its own). */
  challengeType: WonderWalkStopType;
  challenges: WonderWalkStop[];
  /** Author trace for the tester (turns, checks); never rendered to the child. */
  agentDebug?: Record<string, unknown>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<WonderWalkMetrics>) => void;
}

interface WonderWalkProps {
  data: WonderWalkData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

// ============================================================================
// Drawing a world
// ============================================================================

const DISC: Record<CounterColor, string> = { red: 'bg-red-500/70', blue: 'bg-sky-500/70', yellow: 'bg-yellow-400/70', green: 'bg-emerald-500/70' };
const RIM: Record<CounterColor, string> = { red: 'border-red-400', blue: 'border-sky-400', yellow: 'border-yellow-300', green: 'border-emerald-400' };

/** One emoji size per stop, from the widest row any place draws and how many places share the width. */
function sizeFor(world: World): string {
  const per = (p: WorldPlace) => world.objects.filter(o => o.place === p.id).length;
  const widest = Math.max(1, ...world.places.map(p => (p.arrangement === 'line' ? per(p) : Math.min(5, per(p)))));
  const cols = Math.max(1, world.places.length);
  const room = widest * cols;
  return room > 24 ? 'text-xs sm:text-base' : room > 15 ? 'text-base sm:text-xl' : room > 8 ? 'text-xl sm:text-3xl' : 'text-3xl sm:text-5xl';
}

const ObjectGlyph: React.FC<{ o: WorldObject; size: string; selected?: boolean }> = ({ o, size, selected }) => (
  <span className={`inline-flex items-center justify-center leading-none select-none rounded-full ${size}
    ${o.color ? `${DISC[o.color]} p-0.5` : ''}
    ${o.event === 'join' ? 'ring-2 ring-emerald-300/80' : ''}
    ${o.event === 'leave' ? 'opacity-25 grayscale' : ''}
    ${selected ? 'ring-4 ring-violet-300 scale-110' : ''}`}>{o.emoji}</span>
);

interface PlaceViewProps {
  place: WorldPlace;
  objects: WorldObject[];
  size: string;
  /** The objects started here (scattered positions only hold in their own place). */
  home: boolean;
  renderObject: (o: WorldObject) => React.ReactNode;
}

const Arranged: React.FC<{ arrangement: Arrangement; objects: WorldObject[]; home: boolean; render: (o: WorldObject) => React.ReactNode }> = ({ arrangement, objects, home, render }) => {
  if (arrangement === 'scattered' && home && objects.every(o => o.position)) {
    return (
      <div className="relative w-full aspect-square min-w-[7rem] max-w-[13rem]">
        {objects.map(o => (
          <div key={o.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${o.position![0] * 100}%`, top: `${o.position![1] * 100}%` }}>{render(o)}</div>
        ))}
      </div>
    );
  }
  if (arrangement === 'ten-frame') {
    const frames = Math.max(1, Math.ceil(objects.length / 10));
    return (
      <div className="flex flex-col gap-1">
        {Array.from({ length: frames }, (_, f) => (
          <div key={f} className="grid grid-cols-5 gap-0.5 rounded-lg border-2 border-white/30 p-0.5">
            {Array.from({ length: 10 }, (_, k) => {
              const o = objects[f * 10 + k];
              return <div key={k} className="aspect-square min-w-[1.5rem] rounded border border-white/20 flex items-center justify-center">{o ? render(o) : null}</div>;
            })}
          </div>
        ))}
      </div>
    );
  }
  const perRow = arrangement === 'line' ? Math.max(1, objects.length) : 5;
  const rows = Array.from({ length: Math.ceil(objects.length / perRow) }, (_, r) => objects.slice(r * perRow, r * perRow + perRow));
  return (
    <div className="flex flex-col items-start gap-1">
      {rows.map((row, r) => <div key={r} className="flex gap-1">{row.map(o => <React.Fragment key={o.id}>{render(o)}</React.Fragment>)}</div>)}
    </div>
  );
};

const PlaceView: React.FC<PlaceViewProps> = ({ place, objects, size, home, renderObject }) => {
  if (place.kind === 'cup') {
    return (
      <div aria-label="a cup hiding some" className="w-24 h-24 rounded-t-full bg-gradient-to-b from-amber-200/80 to-amber-500/70 border-4 border-amber-200/60 flex items-end justify-center pb-2 text-3xl select-none">❓</div>
    );
  }
  const frame = place.kind === 'basket' ? 'rounded-3xl border-4 border-dashed border-amber-300/50 bg-amber-900/20 min-w-[8rem] min-h-[6rem]'
    : place.kind === 'plate' ? `rounded-full border-4 ${place.color ? RIM[place.color] : 'border-white/30'} bg-slate-200/10 min-w-[8rem] min-h-[8rem] items-center justify-center`
    : place.kind === 'ten-frame' ? ''
    : '';
  const arrangement: Arrangement = place.kind === 'ten-frame' ? 'ten-frame' : place.arrangement;
  return (
    <div className={`flex flex-col p-2 ${frame}`}>
      {place.kind === 'basket' && <span aria-hidden className="text-3xl select-none">🧺</span>}
      <Arranged arrangement={arrangement} objects={objects} home={home} render={renderObject} />
    </div>
  );
};

// ============================================================================
// Surface
// ============================================================================

const useWonderWalkProgress = useWorkspaceProgressFor('wonder-walk');

const WonderWalkSurface = ({ data, className = '', runtimePlanItemId }: WonderWalkProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  // The picture, place or number tapped on this try, or 'done' once a move is committed (cleared by Try again).
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ id: string; ok: boolean } | null>(null);
  // Move worlds: where each object is now, and the object picked up (waiting for a place).
  const [where, setWhere] = useState<Record<string, string>>({});
  const [held, setHeld] = useState<string | null>(null);
  // Language sorts and tracks: the basket each card is in, and the cards on the track in order.
  const [basketOf, setBasketOf] = useState<Record<string, string | null>>({});
  const [track, setTrack] = useState<string[]>([]);
  // The stop whose why-card is up: set by a wrong answer, kept through Try again, cleared on the next stop.
  const [whyFor, setWhyFor] = useState<string | null>(null);
  const lastWrong = useRef<Map<string, string>>(new Map());
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const { instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const resolvedInstanceId = useMemo(() => instanceId || `wonder-walk-${Date.now()}`, [instanceId]);

  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useWonderWalkProgress({
    challenges: data.challenges,
    getChallengeId: stop => stop.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: wonderWalkBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: result => finish.current(result),
  });

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<WonderWalkMetrics>({
    primitiveType: 'wonder-walk',
    instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  const stop = data.challenges[progress.currentIndex] ?? null;
  const world = stop?.world;
  const whyShown = !!stop && whyFor === stop.id;
  const placeOf = (o: WorldObject) => where[o.id] ?? o.place;

  // A fresh stop opens blank; Try again keeps the why-card up (the idea, never the answer) and puts things back.
  // The runtime opens (and re-opens) the stop on screen around mount. A move world's state is local until Done, so a
  // re-open with nothing committed keeps what the child already moved: only a new stop, or Try again after an answer,
  // resets it.
  const openedIndex = useRef(0);
  openItem.current = (index, retry) => {
    if (index === openedIndex.current && pickedId === null) return;
    openedIndex.current = index;
    setPickedId(null);
    setFlash(null);
    setWhere({});
    setHeld(null);
    setBasketOf({});
    setTrack([]);
    if (!retry) setWhyFor(null);
  };

  const open = !!stop && progress.canAttempt !== false && pickedId === null && !hasSubmitted;
  const placed = () => (world ? world.objects.map(o => ({ ...o, place: placeOf(o) })) : []);

  const flashOn = (id: string, ok: boolean) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash({ id, ok });
    flashTimer.current = setTimeout(() => setFlash(f => (f && f.ok ? f : null)), 900);
  };

  // A tap on a picture, a place (tap answer) or a number.
  const pick = (id: string) => {
    if (!open || !stop) return;
    SoundManager.snap();
    const correct = stopMatches(stop, id);
    const miss = pickMiss(stop, id, lastWrong.current.get(stop.id) ?? null);
    if (!correct) { lastWrong.current.set(stop.id, id); setWhyFor(stop.id); }
    setPickedId(id);
    progress.commitCheck(describeWork(stop, { pickedId: id, placed: placed() }), correct, miss);
    if (correct) SoundManager.playCorrect(); else SoundManager.invalid();
    flashOn(id, correct);
  };

  // Move worlds: tap a thing to pick it up (or move it straight there when it has one place to go), tap a place to drop.
  const tapObject = (o: WorldObject) => {
    if (!open || !world || world.answer.kind !== 'move' || o.event === 'leave') return;
    SoundManager.snap();
    const targets = targetsFor(world, placeOf(o));
    if (targets.length === 1) { setWhere(w => ({ ...w, [o.id]: targets[0] })); setHeld(null); return; }
    setHeld(h => (h === o.id ? null : o.id));
  };
  const tapPlace = (p: WorldPlace) => {
    if (!open || !world) return;
    if (world.answer.kind === 'tap') { if (p.choosable) pick(`place-${p.id}`); return; }
    if (world.answer.kind === 'move' && held && p.droppable) {
      SoundManager.snap();
      setWhere(w => ({ ...w, [held]: p.id }));
      setHeld(null);
    }
  };
  const done = () => {
    if (!open || !stop || !world) return;
    const now = placed();
    const correct = moveMatches(stop, now);
    if (!correct) setWhyFor(stop.id);
    setPickedId('done');
    progress.commitCheck(describeWork(stop, { pickedId: 'done', placed: now }), correct, moveMiss(stop, now));
    if (correct) SoundManager.playCorrect(); else SoundManager.invalid();
    flashOn('done', correct);
  };

  // Language stops: a tap answers; a sort picks a card up and drops it in a basket; a track takes cards in turn.
  const words = stop?.words;
  const tapThing = (id: string) => {
    if (!open || !words) return;
    if (words.answer.kind === 'tap') { pick(`thing-${id}`); return; }
    SoundManager.snap();
    if (words.answer.kind === 'sort') {
      if (basketOf[id]) { setBasketOf(b => ({ ...b, [id]: null })); setHeld(null); return; }
      setHeld(h => (h === id ? null : id));
      return;
    }
    setTrack(t => (t.includes(id) ? t.filter(x => x !== id) : t.length < words.things.length ? [...t, id] : t));
  };
  const tapBasket = (b: string) => {
    if (!open || !words || words.answer.kind !== 'sort' || !held) return;
    SoundManager.snap();
    setBasketOf(m => ({ ...m, [held]: b }));
    setHeld(null);
  };
  const wordDone = () => {
    if (!open || !stop || !words) return;
    const view = { basketOf, track };
    const correct = wordMatches(stop, view);
    if (!correct) setWhyFor(stop.id);
    setPickedId('done');
    progress.commitCheck(describeWork(stop, { pickedId: 'done', placed: [], ...view }), correct, wordMiss(stop, view));
    if (correct) SoundManager.playCorrect(); else SoundManager.invalid();
    flashOn('done', correct);
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false) return;
    const total = data.challenges.length;
    const metrics: WonderWalkMetrics = {
      type: 'wonder-walk',
      challengeType: data.challengeType,
      totalChallenges: total,
      correctCount: result.solvedCount,
      attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount,
      hintsViewed: 0,
      overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: total ? result.attemptsCount / total : 0,
    };
    submitResult(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // The scene the tutor and observer see, republished after every render.
  useLayoutEffect(() => {
    if (stop) workspace.current = { ...workspaceScene(data, stop, { pickedId, placed: placed(), whyShown, basketOf, track }) };
  });

  if (!stop) return null;

  const stateOf = (id: string) => (flash?.id === id ? (flash.ok ? 'correct' : 'incorrect') : pickedId === id && stopMatches(stop, id) ? 'correct' : 'idle');
  const ring = (id: string) => {
    const s = stateOf(id);
    return s === 'correct' ? 'border-emerald-400 bg-emerald-900/30' : s === 'incorrect' ? 'border-rose-400 animate-[shake_0.4s]' : 'border-white/10';
  };

  // ── A language stop: the word world ──
  if (stop.words) {
    return (
      <div className={`w-full max-w-3xl mx-auto ${className}`}>
        <WonderWalkWordStage words={stop.words} open={open} ring={ring} held={held} basketOf={basketOf} track={track}
          onThing={tapThing} onBasket={tapBasket} onDone={wordDone} />
        {whyShown && (
          <LuminaFeedbackCard status="insight" label="Remember" className="mt-6" data-pip-object="why">
            <p className="text-slate-200 text-lg">{stop.why}</p>
          </LuminaFeedbackCard>
        )}
      </div>
    );
  }

  // ── A math stop: the world ──
  if (world) {
    const size = sizeFor(world);
    const moving = world.answer.kind === 'move';
    const renderObject = (o: WorldObject) => (moving && o.event !== 'leave'
      ? <button type="button" data-pip-object={`obj-${o.id}`} aria-label={`${o.word} ${o.id.split('-').pop()}`} disabled={!open} onClick={e => { e.stopPropagation(); tapObject(o); }}
          className={open ? 'cursor-pointer active:scale-95' : 'cursor-default'}><ObjectGlyph o={o} size={size} selected={held === o.id} /></button>
      : <ObjectGlyph key={o.id} o={o} size={size} />);
    return (
      <div className={`w-full max-w-3xl mx-auto ${className}`}>
        <LuminaCard className="mb-6 overflow-hidden">
          <LuminaCardContent className="p-0">
            <div data-pip-object="scene" className="w-full min-h-[14rem] bg-slate-900/60 flex flex-wrap items-center justify-center gap-4 p-4">
              {world.places.map(p => {
                const here = world.objects.filter(o => placeOf(o) === p.id);
                const home = here.every(o => o.place === p.id);
                const view = <PlaceView place={p} objects={here} size={size} home={home} renderObject={renderObject} />;
                if (moving && p.droppable) {
                  // Things inside are buttons themselves, so the drop target is a div, not a button.
                  return (
                    <div key={p.id} role="button" tabIndex={0} data-pip-object={`place-${p.id}`} aria-label={`spot ${p.id}`}
                      onClick={() => tapPlace(p)} onKeyDown={e => { if (e.key === 'Enter') tapPlace(p); }}
                      className={`rounded-3xl border-4 p-1 ${held ? 'border-violet-300/60 cursor-pointer' : 'border-transparent'}`}>{view}</div>
                  );
                }
                const live = world.answer.kind === 'tap' && p.choosable;
                return live
                  ? <button key={p.id} type="button" data-pip-object={`place-${p.id}`} aria-label={`spot ${p.id}`}
                      disabled={!open} onClick={() => tapPlace(p)}
                      className={`rounded-3xl border-4 p-1 transition-transform ${world.answer.kind === 'tap' ? ring(`place-${p.id}`) : held ? 'border-violet-300/60' : 'border-transparent'}
                        ${open ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'}`}>{view}</button>
                  : <div key={p.id} data-pip-object={`place-${p.id}`}>{view}</div>;
              })}
            </div>
          </LuminaCardContent>
        </LuminaCard>

        <PipDock />
        <PipWorkspace>
          {world.answer.kind === 'number' && (
            <div className="flex justify-center gap-4">
              {world.answer.choices.map(n => (
                <button key={n} type="button" data-pip-object={`num-${n}`} aria-label={`${n}`} disabled={!open} onClick={() => pick(`num-${n}`)}
                  className={`w-24 h-24 rounded-3xl border-4 bg-slate-800/60 text-5xl font-bold text-slate-100 ${ring(`num-${n}`)} ${open ? 'cursor-pointer hover:scale-[1.03] active:scale-95' : 'cursor-default'}`}>
                  {n}
                </button>
              ))}
            </div>
          )}
          {moving && (
            <div className="flex justify-center">
              <button type="button" data-pip-object="done" aria-label="Done" disabled={!open} onClick={done}
                className={`w-28 h-20 rounded-3xl border-4 bg-emerald-800/40 text-4xl ${ring('done')} ${open ? 'cursor-pointer hover:scale-[1.03] active:scale-95' : 'cursor-default opacity-60'}`}>✅</button>
            </div>
          )}
        </PipWorkspace>

        {whyShown && (
          <LuminaFeedbackCard status="insight" label="Remember" className="mt-6" data-pip-object="why">
            <p className="text-slate-200 text-lg">{stop.why}</p>
          </LuminaFeedbackCard>
        )}
      </div>
    );
  }

  // ── A which-one stop: the scene and its pictures ──
  return (
    <div className={`w-full max-w-3xl mx-auto ${className}`}>
      <LuminaCard className="mb-6 overflow-hidden">
        <LuminaCardContent className="p-0">
          <div data-pip-object="scene" className="relative w-full aspect-video bg-slate-900/60 flex items-center justify-center">
            {stop.sceneImage
              ? <img src={stop.sceneImage} alt="" className="w-full h-full object-cover" />
              : <div aria-hidden className="flex gap-6 text-8xl select-none">{stop.sceneEmoji.map((e, i) => <span key={i}>{e}</span>)}</div>}
          </div>
        </LuminaCardContent>
      </LuminaCard>

      <PipDock />
      <PipWorkspace>
        <div className={`grid gap-4 sm:gap-6 ${stop.options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {stop.options.map(option => (
            <button
              key={option.id}
              type="button"
              data-pip-object={`option-${option.id}`}
              aria-label={option.word}
              disabled={!open}
              onClick={() => pick(option.id)}
              className={`aspect-square rounded-3xl border-4 flex flex-col items-center justify-center gap-2 p-2 transition-transform
                bg-slate-800/60 ${open ? 'cursor-pointer hover:scale-[1.03] active:scale-95' : 'cursor-default'} ${ring(option.id)}`}
            >
              <span aria-hidden className="text-7xl sm:text-8xl leading-none select-none">{option.emoji}</span>
              <span className="text-sm text-slate-400">{option.word}</span>
            </button>
          ))}
        </div>
      </PipWorkspace>

      {whyShown && (
        <LuminaFeedbackCard status="insight" label="Remember" className="mt-6" data-pip-object="why">
          <p className="text-slate-200 text-lg">{stop.why}</p>
        </LuminaFeedbackCard>
      )}
    </div>
  );
};

const WonderWalk = withWorkspaceOnly<WonderWalkProps>('wonder-walk', WonderWalkSurface, props => props.data.title);

export default WonderWalk;
