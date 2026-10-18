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
import { bossEntry, renderBoss, SPOKEN, TAP_ONE, type Boss, type Card } from './boss';

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
      expect(def.affordances?.answers ?? entry.affordances?.answers).toContain(wiring.answer);
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
});

/**
 * Legacy patterns the framework replaces, counted over the source tree. Each number only goes down: when a family
 * moves onto a preset, lower it in the same change. A new instance fails here with the piece to use instead.
 */
describe('ratchets: the old wiring only shrinks', () => {
  const sources = files(PRIMITIVES, f => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  const count = (pattern: RegExp) => sources.filter(f => pattern.test(readFileSync(join(PRIMITIVES, f), 'utf8'))).length;
  it.each([
    ['hand-built spoken assignments', /response: 'speech'/, 90, 'spokenBoss builds the assignment from speech.ask/key/misses'],
    ['hand-written spoken key text', /also accept/i, 12, 'spokenKeyText (components/live-activity/spokenKey.ts) writes the key'],
    ['levers built outside a lever set', /kind: '(help|simplify)'|WorkspaceLever\['kind'\]/, 171, 'leverSet (components/live-activity/bossLevers.ts) builds them from typed specs'],
    ['Pip wired by hand in a primitive', /useWorkspacePipSurface\(|usePipSurface\(/, 177, 'the runner publishes Pip: render <PipDock /> and <PipWorkspace> (pip/WorkspacePip.tsx)'],
    ['scripted fallbacks beside the workspace', /withWorkspaceController|withTeachingWorkspace\(/, 94, 'withWorkspaceOnly: an unbound mount shows NeedsTutor'],
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
    expect(live, 'a new family is a <name>.card.ts + <name>.boss.ts with bossAdapter(boss), not adapters/<x>Live.ts').toBeLessThanOrEqual(161);
  });
});
