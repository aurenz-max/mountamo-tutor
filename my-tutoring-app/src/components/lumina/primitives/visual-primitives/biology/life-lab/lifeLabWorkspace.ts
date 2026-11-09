/**
 * Life Lab's scene on the shared tutor/JEV teaching workspace. Shown worlds are checked by the activity, so no key
 * reaches the tutor. The scene says what is drawn and what the child can change, in the world's own declared words:
 * the places and what they are like, the living things in them (with the looks the child compares), the options by
 * look, the goal, and what each run showed. Never which choice, place, part or order is right.
 */
import type { SceneOf } from '../../../../components/live-activity/bossLevers';
import { displayWords } from '../../../../service/agent-kit/displays';
import { teachFrameWords, type TeachStep } from '../../../../service/agent-kit/teach';
import { CARRIER_SCENE, COND_KEYS, COND_WORDS, GROUND_SCENE, type Level } from './lifeLabAtlas';
import { classify, describeWork, featureWords, itemsOf, nameOf, normalizeWorld, optionsOf, type LifeState, type LifeWorld } from './lifeLabWorld';
import type { LifeLabChallenge } from './LifeLab';

export interface LifeTry { work: string; what: string; correct: boolean }
export interface LifeView { state: LifeState; tries: readonly LifeTry[]; running: boolean; solved: boolean }

export function featureLine(key: string, value: unknown): string {
  const v = String(value);
  if (key === 'carrier') return CARRIER_SCENE[v as keyof typeof CARRIER_SCENE] ?? `carried by ${featureWords(v)}`;
  if (key === 'ground') return GROUND_SCENE[v as keyof typeof GROUND_SCENE] ?? featureWords(v);
  if (key === 'color') return `${v} background`;
  if (key === 'medium') return v === 'water' ? 'under water' : `in ${featureWords(v)}`;
  return `${key.replace(/_/g, ' ')}: ${featureWords(v)}`;
}

function placeWords(world: LifeWorld, s: LifeState): string {
  const w = normalizeWorld(world);
  const chooseAmong = (w.controls.find(c => c.type === 'choose') as { among?: string[] } | undefined)?.among ?? [];
  return w.zones.map(z => {
    const c = s.zones[z.id] ?? {};
    const conds = [
      ...COND_KEYS.filter(k => typeof c[k] === 'number').map(k => COND_WORDS[k][c[k] as Level]),
      ...Object.entries(c).filter(([k, v]) => !(COND_KEYS as readonly string[]).includes(k) && v !== undefined).map(([k, v]) => featureLine(k, v)),
    ];
    const here = w.beings.filter(b => s.beings[b.id]?.zone === z.id).map(b => {
      if (b.variants) return b.variants.map(v => `${v.count} ${v.value} ${b.name}s`).join(' and ');
      const t = s.beings[b.id].traits;
      const looks = Object.entries(t).map(([k, v]) => `${v} ${k}`.replace(/_/g, ' '));
      const card = chooseAmong.indexOf(b.id);
      return `${card >= 0 ? `card ${String.fromCharCode(97 + card)}: ` : ''}${b.name}${looks.length ? ` (${looks.join(', ')})` : ''}`;
    });
    return `${z.label}${conds.length ? ` (${conds.join(', ')})` : ''}: ${here.join(', ') || 'empty'}`;
  }).join('; ');
}

function canChange(world: LifeWorld): string {
  const w = normalizeWorld(world);
  return w.controls.map(c => {
    if (c.type === 'condition') return `${c.keys.join(' and ')} in ${c.zones.map(z => w.zones.find(x => x.id === z)?.label).join(', ')}, each turned down or up (three steps)`;
    if (c.type === 'move') return `where ${c.beings.map(b => `the ${nameOf(w, b)}`).join(', ')} live${c.beings.length === 1 ? 's' : ''}`;
    if (c.type === 'trait') return `the ${nameOf(w, c.being)}'s ${c.part === 'color' ? 'coloring' : c.part}, one of: ${optionsOf(w).map(o => o.label).join(', ')}`;
    if (c.type === 'order') return `an order of ${c.slots} box${c.slots > 1 ? 'es' : ''} from: ${itemsOf(w).map(x => x.name).join(', ')}`;
    if (c.type === 'choose') return `which of the young (cards ${c.among.map((_, i) => String.fromCharCode(97 + i)).join(', ')}) belongs to the parents`;
    return `a prediction: which coloring there will be more of (${(w.beings.find(b => b.id === c.of)?.variants ?? []).map(v => v.value).join(' or ')})`;
  }).join('; ');
}

function goalWords(world: LifeWorld): string {
  const w = normalizeWorld(world), r = w.rules[0] as Record<string, unknown>;
  switch (w.goal.kind) {
    case 'all_thrive': return 'every living thing thriving where it is';
    case 'survives': return `the ${nameOf(w, String(r.prey))} not seen by the ${nameOf(w, String(r.predator))}`;
    case 'action': return `a ${String(r.part)} that lets the ${nameOf(w, String(r.being))} ${String(r.job ?? 'do the job')} here`;
    case 'order': return `the stages of a ${String(r.of ?? 'living thing')}'s life, in order`;
    case 'flow': return `${featureWords(r.start)} becoming ${featureWords(r.goal)} inside the ${nameOf(w, String(r.being))}`;
    case 'choose': return 'the young that could belong to these two parents';
    case 'prediction': return `which coloring there will be more of after ${w.steps ?? 4} families`;
    case 'fair_test': return `two pots the same in every way except ${w.goal.variable}, one growing and one not`;
  }
}

/** The scene while a teach frame is up: the tutor says this frame; the task opens after the child taps through. */
export function withTeaching(scene: SceneOf, frame: TeachStep, step: number, total: number, pictureLoaded = false): SceneOf {
  const facts = { ...scene.facts, teaching: teachFrameWords(frame, { pictureLoaded }).slice(0, 500), step: `teaching first: frame ${step + 1} of ${total}. The task opens when the learner taps through.` };
  return { ...scene, facts: facts as unknown as SceneOf['facts'] };
}

export function lifeScene(c: LifeLabChallenge, view: LifeView): SceneOf {
  const w = c.world!;
  const facts: Record<string, string | number> = {
    skill: classify(w)?.mode ?? c.type,
    places: placeWords(w, view.state).slice(0, 500) || 'no places: a row of boxes and a bench of pictures',
    canChange: canChange(w).slice(0, 400),
    goal: goalWords(w),
    ...(w.show?.length ? { shown: w.show.map(displayWords).join('; ').slice(0, 400) } : {}),
    set: describeWork(w, view.state).slice(0, 300),
    step: view.running ? 'the world is running' : view.solved ? 'it worked' : view.tries.length ? 'trying ideas' : 'not started',
    tries: view.tries.length ? view.tries.map((t, i) => `try ${i + 1}: ${t.work}: ${t.what}`).join('; ').slice(0, 600) : 'none yet',
    constraints: (w.goal.kind === 'prediction' || w.goal.kind === 'choose')
      ? 'The learner picks, then "I\'m done!" checks it.'
      : 'Run plays the world and shows what happens; it can be pressed any number of times. "I\'m done!" checks the goal.',
  };
  return { objects: [], facts };
}
