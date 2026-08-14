/**
 * pushPullArenaScript — the pedagogy lives here (pure, real — no jsdom).
 *
 * What this locks in:
 *  1. The pack passes the contract gates — including that predict's menu is
 *     "moves / stays", never "yes / no": an ask ending "Yes, or no?" opens a
 *     sentence with the affirm sentinel inside our own cue.
 *  2. Every answer is code-computed from the sim's physics: observe from
 *     pushDirection, predict from the static-friction check, compare from the
 *     lighter object, design from the needed-force threshold.
 *  3. The physics idea is modeled only in the correction; the ask never names
 *     one side of the menu alone.
 *  4. compare's contract flags the OTHER object's name as the signature wrong
 *     answer (heavier-moves-more misconception).
 */
import { describe, expect, it } from 'vitest';
import { spokenSpansOf, type JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../hooks/judgedScriptContract.testkit';
import { PHYSICS_CATALOG } from '../../../service/manifest/catalog/physics';
import {
  completeCue,
  designPushSize,
  headNoun,
  itemCue,
  moveOnCue,
  predictMoves,
  SURFACE_SPOKEN,
  type ArenaItem,
  type ArenaItemKind,
} from './pushPullArenaScript';

const item = (kind: ArenaItemKind, extra: Partial<ArenaItem> = {}): ArenaItem => ({
  id: extra.id ?? `${kind}-1`,
  kind,
  answerKind: 'voice',
  responseClass: 'short_spoken_word',
  action: kind,
  objectName: 'Tennis Ball',
  surfaceSpoken: SURFACE_SPOKEN.wood,
  strength: 5,
  direction: 'push',
  spokenAnswer: 'push',
  alternates: ['a push'],
  ...extra,
});

const FIXTURES: ArenaItem[] = [
  item('observe'),
  item('observe', { id: 'observe-2', direction: 'pull', spokenAnswer: 'pull', alternates: ['a pull'] }),
  item('predict', { id: 'p1', spokenAnswer: 'moves', alternates: ['move', 'yes'] }),
  item('predict', { id: 'p2', objectName: 'Rock', surfaceSpoken: SURFACE_SPOKEN.carpet, spokenAnswer: 'stays', alternates: ['stay', 'no'] }),
  item('compare', { id: 'c1', object2Name: 'Rock', spokenAnswer: 'tennis ball', alternates: ['ball'] }),
  item('design', { id: 'd1', objectName: 'Barrel', surfaceSpoken: SURFACE_SPOKEN.carpet, spokenAnswer: 'big', alternates: ['strong'] }),
];

const packOf = (items: ArenaItem[]): JudgedScriptPack<ArenaItem> => ({
  primitiveType: 'push-pull-arena',
  activityLine: 'live direct instruction pushes-and-pulls practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  contextFor: (it) => ({
    challengeType: it.kind,
    objectName: it.objectName,
    surface: it.surfaceSpoken,
    expectedAnswer: it.spokenAnswer,
  }),
});

/** Every line the tutor is told to SPEAK — the shared parser, so every port
 *  reads the same span. */
const spokenLines = spokenSpansOf;

describe('contract gates', () => {
  it('passes the family gates: validate + performed-directions + repeated-asks', () => {
    // checkPackGates = validateJudgedScriptPack PLUS the two gates that exist
    // because a live drive found the defect after every machine gate passed
    // (the performed "[WAIT silently]"; the byte-identical consecutive ask).
    // These fixtures pair observe with observe and predict with predict, so the
    // repeat gate is actually exercised here rather than skipped.
    expect(checkPackGates(packOf(FIXTURES))).toEqual([]);
  });

  it('the catalog keeps its side: audio mode, contextKeys, template keys, sentinel scan', () => {
    const entry = PHYSICS_CATALOG.find((p) => p.id === 'push-pull-arena')!;
    expect(checkDiCatalogEntry(entry, packOf(FIXTURES), FIXTURES[0])).toEqual([]);
  });

  it('predict avoids the yes/no menu — an ask ending "Yes, or no?" would collide with the affirm sentinel', () => {
    const [spoken] = spokenLines(itemCue(FIXTURES[2]));
    expect(spoken).toContain('Say moves, or stays.');
    expect(spoken).not.toMatch(/yes, or no/i);
  });
});

describe('code-computed answers', () => {
  it('predictMoves is the sim’s static-friction check', () => {
    // 4 * 8N = 32N vs ice friction 0.03 * 2 * 9.8 ≈ 0.6N → moves
    expect(predictMoves(4, 2, 'ice')).toBe(true);
    // 2 * 8N = 16N vs carpet friction 0.5 * 9 * 9.8 ≈ 44N → stays
    expect(predictMoves(2, 9, 'carpet')).toBe(false);
  });

  it('designPushSize is decisive at the generator’s constructed setups', () => {
    expect(designPushSize(8, 'carpet')).toBe('big');     // ≈39N needed
    expect(designPushSize(2, 'wood')).toBe('little');    // ≈4N needed
    expect(designPushSize(1, 'ice')).toBe('little');
  });

  it('headNoun accepts the short form of a two-word object name', () => {
    expect(headNoun('Tennis Ball')).toBe('ball');
    expect(headNoun('Refrigerator')).toBe('refrigerator');
  });
});

describe('asks and corrections', () => {
  it('observe asks for the force word and models the idea only in the correction', () => {
    const cue = itemCue(FIXTURES[0]);
    const [spoken] = spokenLines(cue);
    expect(spoken).toContain('Was that a push, or a pull?');
    expect(cue).toContain('It moved away — that is a push.');
    const pullCue = itemCue(FIXTURES[1]);
    expect(pullCue).toContain('It came closer — that is a pull.');
  });

  it('compare names the two objects in the ask and flags the other name as the signature wrong answer', () => {
    const cue = itemCue(FIXTURES[4]);
    const [spoken] = spokenLines(cue);
    expect(spoken).toContain('The Tennis Ball and the Rock get the same push.');
    expect(spoken).toContain('Which one slides farther?');
    expect(cue).toContain('The other object\'s name ("Rock") is the signature wrong answer');
    expect(cue).toContain('heavier does NOT slide farther');
  });

  it('the contract states the accepted alternates — permissiveness is auditable', () => {
    const cue = itemCue(FIXTURES[2]);
    expect(cue).toContain('The correct answer is "moves"');
    expect(cue).toContain('Also accept: "move", "yes"');
  });

  it('every contract STATES the wait as a fact, never orders it', () => {
    // The old wording here ordered it ("Then WAIT silently…") and the test name
    // said so. A model handed an imperative reads it as one more thing on the
    // list of things to say, and voiced it as "[WAIT silently]" on a ten-frame
    // drive; checkPackGates now refuses the imperative form family-wide.
    for (const fixture of FIXTURES) {
      const cue = itemCue(fixture);
      expect(cue).toContain('The quoted line is the ONLY thing you say on this turn');
      expect(cue).toContain('you then stay silent while the learner thinks');
    }
  });

  it('move-on and complete close the way the family does', () => {
    expect(moveOnCue(FIXTURES[0], null)).toContain('Then stop.');
    expect(moveOnCue(FIXTURES[0], FIXTURES[2], { howToPlay: true })).toContain('Say moves, or stays.');
    expect(completeCue()).toContain('Then stop — the activity is over.');
  });
});
