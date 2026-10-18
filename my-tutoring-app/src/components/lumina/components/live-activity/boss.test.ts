/**
 * The guards of the boss framework (`boss.ts`). Every card and boss on disk is checked here, not one pilot, so a
 * boss wired in one place and not another, a card that drags behavior into the catalog, a lever outside its set or
 * a spoken boss off the spoken preset fails CI. The ratchets at the bottom count the legacy patterns the presets
 * replace: they only go down. When one fails, the message names the framework piece to use instead.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { UNIVERSAL_CATALOG, getComponentById } from '../../service/manifest/catalog';
import { classificationSorterBoss } from '../../primitives/visual-primitives/biology/classificationSorter.boss';
import { LIVE_ADAPTERS, type LivePrimitiveId } from './activityContract';
import { LIVE_JOURNEYS } from './liveJourneySpec';
import { ROTATION_DOCTRINE } from './adapters/adapterContract';
import { bossEntry, renderBoss, SPOKEN, TAP_ONE, wiringsOf, type Boss, type Card } from './boss';
import { leverScene, leverSet, type SceneOf } from './bossLevers';
import { supportFact } from './supportFact';

const LUMINA = join(__dirname, '../..');
const PRIMITIVES = join(LUMINA, 'primitives');
const files = (dir: string, test: (f: string) => boolean) =>
  (readdirSync(dir, { recursive: true }) as string[]).map(f => f.replace(/\\/g, '/')).filter(test);
const bossFiles = files(PRIMITIVES, f => f.endsWith('.boss.ts'));
const cardFiles = files(PRIMITIVES, f => f.endsWith('.card.ts'));
const load = async <T>(list: string[], is: (v: any) => boolean) =>
  (await Promise.all(list.map(async f => ({ file: f, mod: await import(pathToFileURL(join(PRIMITIVES, f)).href) }))))
    .map(({ file, mod }) => ({ file, values: Object.values(mod).filter(v => !!v && typeof v === 'object' && is(v)) as T[] }));
const isBoss = (v: any) => 'card' in v && 'drive' in v;
const isCard = (v: any) => 'modes' in v && 'words' in v && 'grades' in v;


const carded = UNIVERSAL_CATALOG.filter(c => c.teachingWorkspace?.card);

describe('every boss on disk', () => {
  it('one card per card file and one boss per boss file, each boss on the card beside it', async () => {
    const cards = await load<Card>(cardFiles, isCard);
    const bosses = await load<Boss>(bossFiles, isBoss);
    for (const { file, values } of [...cards, ...bosses]) expect(values.length, `${file} must export exactly one`).toBe(1);
    for (const { file, values: [boss] } of bosses) {
      const beside = cards.find(c => c.file === file.replace(/\.boss\.ts$/, '.card.ts'));
      expect(beside?.values[0], `${file}: its card goes in ${file.replace(/\.boss\.ts$/, '.card.ts')}`).toBe(boss.card);
    }
  });

  it('is wired from its card and boss everywhere: catalog, adapter, journey', async () => {
    for (const { values: [boss] } of await load<Boss>(bossFiles, isBoss)) {
      const id = boss.card.id as LivePrimitiveId;
      const entry = getComponentById(id);
      const { teachingWorkspace, audioInput } = bossEntry(boss.card);
      expect(entry?.teachingWorkspace, `${id}: the catalog entry spreads ...bossEntry(card)`).toEqual(teachingWorkspace);
      expect(entry?.audioInput, id).toEqual(audioInput);
      expect(Object.keys(boss.card.modes).sort(), `${id}: the card wires every catalog eval mode`).toEqual(
        (entry?.evalModes ?? []).map(m => m.evalMode).sort());
      expect(LIVE_ADAPTERS[id]?.bindsTeachingWorkspace, `${id}: LIVE_ADAPTERS row is bossAdapter(boss)`).toBe(true);
      expect(LIVE_JOURNEYS[id]?.component, `${id}: LIVE_JOURNEYS row is bossJourney(boss)`).toBe(boss.drive.component);
      expect(LIVE_JOURNEYS[id].leakTokens, id).toEqual([...(boss.drive.leakTokens ?? [])]);
    }
  });

  it('carries no scripted cue builders: the boss is the only description of the activity', async () => {
    const CUES = /^export (?:const|function) (itemCue|moveOnCue|completeCue|pronounceCue|judgingContract|correctionLines?|verifyLine|\w+PackBase)\b/m;
    for (const { file, values: [boss] } of await load<Boss>(bossFiles, isBoss)) {
      const dir = join(PRIMITIVES, file, '..');
      const component = join(LUMINA, boss.drive.component);
      const local = [join(PRIMITIVES, file), component].flatMap(f => Array.from(
        readFileSync(f, 'utf8').matchAll(/from '\.\/([\w.]+)'/g), m => join(f === component ? join(component, '..') : dir, `${m[1]}`)));
      for (const mod of Array.from(new Set(local))) {
        const path = [`${mod}.ts`, `${mod}.tsx`].find(p => { try { readFileSync(p); return true; } catch { return false; } });
        const hit = path && readFileSync(path, 'utf8').match(CUES);
        expect(hit?.[1], `${boss.card.id}: ${path} exports ${hit?.[1]}, a scripted cue the tutor never receives; `
          + 'the boss (ask, key, levers, support) describes the activity').toBeUndefined();
      }
    }
  });

  it('is driven by its journey, not by the old scripted DI drive (DI_PORTS)', async () => {
    const ports = readFileSync(join(LUMINA, 'service/qa/di/diDrivePlan.ts'), 'utf8').split('export const DI_PORTS')[1];
    for (const { values: [boss] } of await load<Boss>(bossFiles, isBoss))
      expect(ports.includes(`'${boss.card.id}':`), `${boss.card.id}: a DI_PORTS row replays cues the tutor no longer receives; `
        + 'the boss drive (LIVE_JOURNEYS) is its harness').toBe(false);
  });

  it('a card imports only cards and boss.ts, so the catalog does not load behavior', () => {
    for (const file of cardFiles) {
      const source = readFileSync(join(PRIMITIVES, file), 'utf8');
      const values = Array.from(source.matchAll(/^import (?!type\b)[^;]*?from '([^']+)'/gm), m => m[1]);
      for (const from of values) {
        expect(from.endsWith('/live-activity/boss') || from.endsWith('.card'),
          `${file} imports ${from}: a card holds facts only; import types, or move the constant into a card`).toBe(true);
      }
    }
  });

  it('a boss component is taught only on the workspace: no scripted fallback beside the tutor', async () => {
    for (const { values: [boss] } of await load<Boss>(bossFiles, isBoss)) {
      const source = readFileSync(join(LUMINA, boss.drive.component), 'utf8');
      expect(/withWorkspaceOnly(<[^>]*>)?\(|<DiTeachingStage[<\s]/.test(source),
        `${boss.card.id}: export through withWorkspaceOnly (or mount DiTeachingStage); an unbound mount shows NeedsTutor`).toBe(true);
      for (const legacy of ['withWorkspaceController', 'withTeachingWorkspace(', 'useScriptedProgress', 'useLuminaAI('])
        expect(source.includes(legacy), `${boss.card.id}: ${legacy} keeps a scripted path; delete it (one path, 09-23)`).toBe(false);
    }
  });

  it('a boss wires no Pip: the runner publishes it, the component only marks the dock and the workspace', async () => {
    for (const { values: [boss] } of await load<Boss>(bossFiles, isBoss)) {
      const source = readFileSync(join(LUMINA, boss.drive.component), 'utf8');
      for (const hand of ['useWorkspacePipSurface(', 'usePipSurface(', 'useLuminaAIContext('])
        expect(source.includes(hand), `${boss.card.id}: ${hand} wires Pip by hand; render <PipDock /> and <PipWorkspace> (pip/WorkspacePip.tsx)`).toBe(false);
      // DiTeachingStage is the spoken stage; it publishes Pip itself, once for every pack.
      if (!/<DiTeachingStage[<\s]/.test(source))
        expect(/<PipDock[\s/>]/.test(source) && /<PipWorkspace[\s>]/.test(source), `${boss.card.id}: mark <PipDock /> and <PipWorkspace>`).toBe(true);
    }
  });

  it('a mode wired like a preset uses the preset', async () => {
    const same = (m: object, preset: object) => Object.entries(preset).every(([k, v]) => (m as any)[k] === v);
    for (const { values: [boss] } of await load<Boss>(bossFiles, isBoss)) {
      const modes = Object.values(boss.card.modes);
      if (modes.every(m => same(m, SPOKEN))) expect(boss.preset, `${boss.card.id}: every mode is SPOKEN, so build it with spokenBoss`).toBe('spoken');
      if (modes.every(m => same(m, TAP_ONE))) expect(boss.preset, `${boss.card.id}: every mode is TAP_ONE, so build it with tapBoss`).toBe('tap');
      if (boss.preset === 'spoken') expect(boss.card.audio, `${boss.card.id}: a spoken boss sets SPOKEN_AUDIO`).toEqual({ manual_activity: true });
    }
  });

  it('a card with stepped modes names each item\'s step', async () => {
    for (const { values: [boss] } of await load<Boss>(bossFiles, isBoss)) {
      const stepped = Object.values(boss.card.modes).some(m => 'steps' in m);
      expect(!!boss.stepOf, `${boss.card.id}: a stepped card needs boss.stepOf (the step its scene publishes as kind)`).toBe(stepped);
    }
  });

  it('declares its levers once, by type, answering every miss', async () => {
    for (const { values: [boss] } of await load<Boss>(bossFiles, isBoss)) {
      const { card } = boss;
      expect(!!card.levers, `${card.id}: card.levers is true exactly when the boss has a lever set`).toBe(!!boss.levers?.specs.length);
      const specs = boss.levers?.specs ?? [];
      // One id may have a spec per mode (cell-builder's structure_jobs words its job per mission); never two in one mode.
      for (const mode of Object.keys(card.modes)) {
        const ids = boss.levers?.idsFor(mode) ?? [];
        expect(new Set(ids).size, `${card.id} ${mode}: lever ids are unique`).toBe(ids.length);
      }
      for (const spec of specs) {
        for (const mode of spec.modes ?? []) expect(card.modes, `${card.id} ${spec.id}: mode ${mode}`).toHaveProperty(mode);
        if (spec.type === 'custom') expect(spec.why && spec.carrier, `${card.id} ${spec.id}: a custom lever says why and its carrier`).toBeTruthy();
        if (spec.answers === 'all') continue;
        // A lever offered in several modes may list the misses of any of them.
        const named = new Set(Object.entries(card.modes).filter(([k]) => !spec.modes || spec.modes.includes(k)).flatMap(([, m]) => m.misses));
        for (const miss of spec.answers) expect(named.has(miss), `${card.id} ${spec.id} answers ${miss}, which its modes do not name`).toBe(true);
      }
      for (const [mode, m] of Object.entries(card.modes)) {
        const inMode = specs.filter(s => !s.modes || s.modes.includes(mode));
        const answered = new Set([...inMode.flatMap(s => (s.answers === 'all' ? m.misses : s.answers)), ...(m.unanswered ?? [])]);
        for (const miss of m.misses) expect(answered.has(miss), `${card.id} ${mode}: no lever answers ${miss}; add one or list it in unanswered`).toBe(true);
      }
    }
  });
});

describe('boss cards in the catalog', () => {
  it.each(carded.map(c => c.id))('%s: guidance is the doctrine, and each answer channel is one the curator knows', id => {
    const entry = getComponentById(id)!;
    expect(LIVE_ADAPTERS[id as LivePrimitiveId].guidance).toContain(ROTATION_DOCTRINE(entry.teachingWorkspace!.card!));
    for (const [mode, wiring] of Object.entries(entry.teachingWorkspace!.card!.modes)) {
      const def = entry.evalModes!.find(m => m.evalMode === mode)!;
      for (const { step, wiring: w } of wiringsOf(wiring))
        expect(def.affordances?.answers ?? entry.affordances?.answers, `${id} ${mode}${step ? ` ${step}` : ''}`).toContain(w.answer);
    }
  });

  it('a spoken boss is judged by the tutor and sets the microphone; a board names its check', () => {
    expect(getComponentById('di-spoken-practice')!.audioInput).toEqual({ manual_activity: true });
    expect(LIVE_ADAPTERS['di-spoken-practice'].guidance).toContain('The learner answers out loud, and you judge the spoken answer');
    expect(LIVE_ADAPTERS['cell-builder'].guidance).toContain('after a check you may say how many parts are right, never which');
    expect(LIVE_ADAPTERS['cell-builder'].guidance).toContain('In organelle_placement, the learner taps a structure in the bay, then a region.');
  });

  it('the tap preset plays the boss: a tap on the right group, or on another', () => {
    const data = { title: 't', sortingRule: 'r', categories: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      items: [{ id: 'i1', label: 'bat', correctCategoryId: 'b' }] };
    const ctx = { data: data as Record<string, any>, challenge: null, diItems: [], itemId: 'i1' };
    const journey = LIVE_JOURNEYS['classification-sorter'];
    expect(journey.inputsFor('correct', ctx)).toEqual([{ type: 'touch', target: 'group-b' }]);
    expect(journey.inputsFor('wrong', ctx)).toEqual([{ type: 'touch', target: 'group-a' }]);
    expect(journey.inputsFor('warmup', ctx)).toEqual([]);
    expect(classificationSorterBoss.assignment(data.items[0] as never)).toEqual({ id: 'i1', task: 'Which group does "bat" go in?', response: 'gesture' });
    expect(LIVE_ADAPTERS['classification-sorter'].initialState(data as never)).toMatchObject(
      { instruction: 'Which group does "bat" go in?', totalChallenges: 1 });
  });

  it('the readable card shows how the boss is wired', () => {
    const card = renderBoss(classificationSorterBoss, getComponentById('classification-sorter')!.evalModes);
    expect(card).toContain('MODE sort · Sort into Groups · β 2.5');
    expect(card).toContain('preset tap');
    expect(card).toMatch(/Learner answers\s+TAP/);
    expect(card).toMatch(/Judged by\s+ACTIVITY CHECK/);
    expect(card).toMatch(/Levers\s+group_meaning \(meaning\), card_clue \(clue\), sorted_marks \(marks\)/);
    expect(card).toMatch(/Misses it names\s+repeated_group, parent_group, sibling_group, wrong_group/);
  });

  it('picks the judging sentence from the wiring, and names modes when they differ', () => {
    const words = { job: 'answer', answer: 'the answer', question: 'the prompt' };
    const spoken = ROTATION_DOCTRINE({ words, modes: { say: { answer: 'spoken', judge: 'tutor', flow: 'one-at-a-time' } } });
    expect(spoken).toContain('The learner answers out loud, and you judge the answer against the key the task gives you');
    expect(spoken).not.toContain('The activity checks');
    const mixed = ROTATION_DOCTRINE({ words, modes: {
      say: { answer: 'spoken', judge: 'tutor', flow: 'one-at-a-time' },
      fill: { answer: 'tap', judge: 'activity', flow: 'board' } } });
    expect(mixed).toContain('In say: The learner answers out loud');
    expect(mixed).toContain('In fill: The activity checks the answer');
    expect(mixed).toContain('after a check you may say how many parts are right, never which');
  });

  it('names steps, not modes, when a mode is wired by step', () => {
    const words = { job: 'answer', answer: 'the answer', question: 'the prompt' };
    const say = { answer: 'spoken', judge: 'tutor', flow: 'one-at-a-time' } as const;
    const place = { answer: 'manipulate', judge: 'activity', flow: 'one-at-a-time', moves: 'drags a card into the box' } as const;
    const doctrine = ROTATION_DOCTRINE({ words, modes: {
      short: { steps: { place, solve: say } },
      long: { steps: { classify: say, place, solve: say } } } });
    expect(doctrine).toContain("Each item is one step of the problem, and the task's kind names the step.");
    expect(doctrine).toContain('In the classify and solve steps: The learner answers out loud');
    expect(doctrine).toContain('In the place steps: The activity checks the answer');
    expect(doctrine).toContain('In the place step of short and long, the learner drags a card into the box.');
    // A step wired one way in one mode and another way elsewhere is named with its modes.
    const split = ROTATION_DOCTRINE({ words, modes: { a: { steps: { solve: say } }, b: { steps: { solve: place } } } });
    expect(split).toContain('In the solve (in a) steps: The learner answers out loud');
    // No stepped mode: the text is the one every unstepped card has always had.
    expect(ROTATION_DOCTRINE({ words, modes: { say } })).not.toContain('step');
  });
});

/**
 * Legacy patterns the framework replaces, counted over the source tree. Each number only goes down: when a family
 * moves onto a preset, lower it in the same change. A new instance fails here with the piece to use instead.
 */
describe('support is the lever set\'s: a mode cannot write the tier rule itself', () => {
  type Item = { id: string; supportTier?: 'easy' | 'medium' | 'hard' };
  const model = { id: 'model_it', type: 'model' as const, answers: 'all' as const, when: 'stuck', does: 'shows one solved' };
  const support = { tier: (i: Item) => i.supportTier ?? 'easy', different: 'a different fact', own: "this fact's answer" };

  it('a lever set with a model lever and no support fails when it is built', () => {
    expect(() => leverSet<Item, null>({ missesOf: () => [], specs: [model] })).toThrow(/declares `support`/);
  });

  it('the set writes the fact from the tier and names the model lever', () => {
    const set = leverSet<Item, null>({ missesOf: () => [], support, specs: [model] });
    expect(set.support({ id: 'a', supportTier: 'hard' })).toBe(supportFact('hard', { ...support, different: 'a different fact', lever: 'model_it' }));
    expect(set.support({ id: 'a' })).toMatch(/^before the learner tries, pull the model lever \(model_it\)/);
  });

  it('a scene that writes support or onScreen throws when published', () => {
    expect(() => leverScene({ objects: [], facts: { support: 'answer it cold' } }, { support: 'x', onScreen: '' })).toThrow(/lever set writes it/);
    expect(leverScene({ objects: [], facts: { kind: 'k' } }, { support: 's', onScreen: '' }).facts).toEqual({ kind: 'k', support: 's' });
  });

  it('a scene function cannot type a support fact', () => {
    // @ts-expect-error SceneOf forbids `support`: the lever set writes it.
    const scene: SceneOf = { objects: [], facts: { support: 'answer it cold' } };
    expect(scene).toBeTruthy();
  });

  it('every boss with a model lever declares support', async () => {
    for (const { values: [boss] } of await load<Boss>(bossFiles, isBoss)) {
      const items = boss.levers?.specs ?? [];
      if (items.some(spec => spec.type === 'model')) expect(boss.levers!.support, boss.card.id).toBeTypeOf('function');
    }
  });
});

describe('ratchets: the old wiring only shrinks', () => {
  const sources = files(PRIMITIVES, f => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  const count = (pattern: RegExp) => sources.filter(f => pattern.test(readFileSync(join(PRIMITIVES, f), 'utf8'))).length;
  it.each([
    ['hand-built spoken assignments', /response: 'speech'/, 83, 'spokenBoss builds the assignment from speech.ask/key/misses'],
    ['hand-written spoken key text', /also accept/i, 10, 'spokenKeyText (components/live-activity/spokenKey.ts) writes the key'],
    ['levers built outside a lever set', /kind: '(help|simplify)'|WorkspaceLever\['kind'\]/, 162, 'leverSet (components/live-activity/bossLevers.ts) builds them from typed specs'],
    ['Pip wired by hand in a primitive', /useWorkspacePipSurface\(|usePipSurface\(/, 177, 'the runner publishes Pip: render <PipDock /> and <PipWorkspace> (pip/WorkspacePip.tsx)'],
    ['scripted fallbacks beside the workspace', /withWorkspaceController|withTeachingWorkspace\(/, 94, 'withWorkspaceOnly: an unbound mount shows NeedsTutor'],
    ['hand-written tier support facts', /support: \w+\.supportTier ===|model nothing before|before the learner tries, pull/, 0, 'supportFact (components/live-activity/supportFact.ts) writes when the model comes'],
  ] as const)('%s', (_name, pattern, ceiling, instead) => {
    expect(count(pattern), `more files than the ratchet allows; use ${instead}`).toBeLessThanOrEqual(ceiling);
  });
  it('hand-written spoken key schemas in generators', () => {
    const service = join(LUMINA, 'service');
    const hand = files(service, f => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('spokenKeySchema.ts'))
      .filter(f => /(alsoAccept|acceptRule|signatureError): \{/.test(readFileSync(join(service, f), 'utf8')));
    expect(hand.length, 'a spoken generator spreads spokenKeyProperties (service/spokenKeySchema.ts)').toBeLessThanOrEqual(1);
  });
  it('hand-written live adapters', () => {
    const live = readdirSync(join(__dirname, 'adapters')).filter(f => f.endsWith('Live.ts')).length;
    expect(live, 'a new family is a <name>.card.ts + <name>.boss.ts with bossAdapter(boss), not adapters/<x>Live.ts').toBeLessThanOrEqual(152);
  });
});
