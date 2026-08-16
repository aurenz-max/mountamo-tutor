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
 *  5. ⭐ The fixtures are PRODUCTION OUTPUT. They used to be a hand-rolled
 *     `packOf` literal beside a hand-rolled item list, which is a second source
 *     of truth for the exact strings the pedagogy lives in — it can go green
 *     while production sends something else. Both shipped ports of the 19h-i-b
 *     sweep carried that drift; this file now builds its items with
 *     `itemsFromChallenges` and its pack with `pushPullArenaPackBase`, the same
 *     two calls the component and the headless DI harness make.
 *  6. ⭐ The build gate, which this port did not have: an item whose answer is
 *     not decisive is DROPPED, not asked.
 *  7. ⭐ 18d — no catalog rung quotes a speakable line, and the answer is not in
 *     the state block.
 */
import { describe, expect, it } from 'vitest';
import { spokenSpansOf } from '../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../hooks/judgedScriptContract.testkit';
import { PHYSICS_CATALOG } from '../../../service/manifest/catalog/physics';
import {
  completeCue,
  designPushSize,
  DESIGN_SETUPS,
  FRICTION_MU,
  headNoun,
  itemCue,
  itemsFromChallenges,
  menuSpanFor,
  moveOnCue,
  otherObjectName,
  predictMoves,
  pushPullArenaHarnessAnswers,
  pushPullArenaPackBase,
  type ArenaChallengeLike,
  type ArenaItem,
} from './pushPullArenaScript';

/**
 * Generator-shaped challenges, chosen so every one survives the build gate and
 * the pair-with-itself ordering exercises the repeated-ask gate (observe beside
 * observe, predict beside predict).
 */
const CHALLENGES: ArenaChallengeLike[] = [
  { id: 'observe-1', type: 'observe', objectName: 'Tennis Ball', objectWeight: 2, surface: 'wood', pushStrength: 5, pushDirection: 'push' },
  { id: 'observe-2', type: 'observe', objectName: 'Tennis Ball', objectWeight: 2, surface: 'wood', pushStrength: 5, pushDirection: 'pull' },
  // 4 × 8N = 32N against ice friction 0.03 × 2 × 9.8 ≈ 0.6N — decisively moves.
  { id: 'p1', type: 'predict', objectName: 'Tennis Ball', objectWeight: 2, surface: 'ice', pushStrength: 4 },
  // 2 × 8N = 16N against carpet friction 0.5 × 9 × 9.8 ≈ 44N — decisively stays.
  { id: 'p2', type: 'predict', objectName: 'Rock', objectWeight: 9, surface: 'carpet', pushStrength: 2 },
  { id: 'c1', type: 'compare', objectName: 'Tennis Ball', objectWeight: 2, surface: 'wood', object2Name: 'Rock', object2Weight: 9 },
  // Carpet friction 0.5 × 8 × 9.8 ≈ 39N — clear of the 16–32N murky band.
  { id: 'd1', type: 'design', objectName: 'Barrel', objectWeight: 8, surface: 'carpet' },
];

const FIXTURES: ArenaItem[] = itemsFromChallenges(CHALLENGES);
const byId = (id: string): ArenaItem => FIXTURES.find((i) => i.id === id)!;

const pack = pushPullArenaPackBase(FIXTURES);

/** Every line the tutor is told to SPEAK — the shared parser, so every port
 *  reads the same span. */
const spokenLines = spokenSpansOf;

describe('contract gates', () => {
  it('every fixture challenge survives the build gate', () => {
    expect(FIXTURES.map((i) => i.id)).toEqual(CHALLENGES.map((c) => c.id));
    expect(FIXTURES.map((i) => i.spokenAnswer)).toEqual([
      'push', 'pull', 'moves', 'stays', 'tennis ball', 'big',
    ]);
  });

  it('passes the family gates: validate + performed-directions + repeated-asks', () => {
    // checkPackGates = validateJudgedScriptPack PLUS the two gates that exist
    // because a live drive found the defect after every machine gate passed
    // (the performed "[WAIT silently]"; the byte-identical consecutive ask).
    // These fixtures pair observe with observe and predict with predict, so the
    // repeat gate is actually exercised here rather than skipped.
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('the catalog keeps its side: audio mode, contextKeys, template keys, sentinel scan', () => {
    const entry = PHYSICS_CATALOG.find((p) => p.id === 'push-pull-arena')!;
    expect(checkDiCatalogEntry(entry, pack, FIXTURES[0])).toEqual([]);
  });

  it('predict avoids the yes/no menu — an ask ending "Yes, or no?" would collide with the affirm sentinel', () => {
    const [spoken] = spokenLines(itemCue(byId('p1')));
    expect(spoken).toContain('Say moves, or stays.');
    expect(spoken).not.toMatch(/yes, or no/i);
  });
});

describe('the build gate drops what cannot be asked', () => {
  /** Every drop is an ask with no defensible answer, never a hard one. */
  const drop = (ch: ArenaChallengeLike) => itemsFromChallenges([ch]);

  it('drops a predict sitting on the static-friction boundary', () => {
    // 5 × 8N = 40N against wood friction 0.2 × 20.4 × 9.8 ≈ 40N — a coin flip
    // the child would then be corrected for missing.
    expect(drop({ id: 'x', type: 'predict', objectName: 'Crate', objectWeight: 20.4, surface: 'wood', pushStrength: 5 })).toEqual([]);
  });

  it('drops a design inside designPushSize\'s murky band', () => {
    // Wood friction 0.2 × 10 × 9.8 ≈ 19.6N, inside [16, 32].
    expect(drop({ id: 'x', type: 'design', objectName: 'Crate', objectWeight: 10, surface: 'wood' })).toEqual([]);
  });

  it('drops a compare whose two objects cannot be told apart', () => {
    const same = { id: 'x', type: 'compare' as const, objectName: 'Rock', objectWeight: 5, surface: 'wood' as const };
    expect(drop({ ...same, object2Name: 'Ball', object2Weight: 5 })).toEqual([]); // equal weights — unanswerable
    expect(drop({ ...same, object2Name: 'Rock', object2Weight: 9 })).toEqual([]); // equal names — unspeakable
    expect(drop({ ...same })).toEqual([]);                                        // no second object at all
  });

  it('drops a challenge with no object or an unknown surface', () => {
    expect(drop({ id: 'x', type: 'observe', objectName: '   ', objectWeight: 2, surface: 'wood' })).toEqual([]);
    expect(drop({ id: 'x', type: 'observe', objectName: 'Ball', objectWeight: 2, surface: 'lava' as never })).toEqual([]);
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

  /**
   * The design setups, checked against the rule rather than against their own
   * comments. A live DI probe drew the same setup ("The Barrel is on the
   * carpet…") as items 2 and 3 — the same problem asked twice, byte-identical,
   * inside a set that answered "big" three times of four.
   */
  it('every design setup is decisive, and consecutive setups alternate the answer', () => {
    const WEIGHTS: Record<string, number> = {
      'Tennis Ball': 1, 'Toy Car': 2, 'Book': 3, 'Barrel': 8, 'Rock': 9, 'Refrigerator': 10,
    };
    const answers = DESIGN_SETUPS.map((setup) => {
      const weight = WEIGHTS[setup.objectName];
      expect(weight, `${setup.objectName} must be in the object library`).toBeDefined();
      // Clear of designPushSize's murky band — an ambiguous ask is not a harder
      // task, it is a broken one.
      const frictionN = FRICTION_MU[setup.surface] * weight * 9.8;
      expect(frictionN < 16 || frictionN > 32, `${setup.objectName} on ${setup.surface} = ${frictionN.toFixed(1)}N is inside the murky band`).toBe(true);
      return designPushSize(weight, setup.surface);
    });

    expect(answers).toEqual(['little', 'big', 'little', 'big', 'little', 'big']);
    // No two consecutive setups are the same problem, and the pool is long
    // enough that a 4-6 item lesson never wraps onto a repeat.
    const keys = DESIGN_SETUPS.map((s) => `${s.objectName}|${s.surface}`);
    expect(new Set(keys).size).toBe(DESIGN_SETUPS.length);
    expect(DESIGN_SETUPS.length).toBeGreaterThanOrEqual(6);
  });

  it('headNoun accepts the short form of a two-word object name', () => {
    expect(headNoun('Tennis Ball')).toBe('ball');
    expect(headNoun('Refrigerator')).toBe('refrigerator');
  });
});

describe('asks and corrections', () => {
  it('observe asks for the force word and models the idea only in the correction', () => {
    const cue = itemCue(byId('observe-1'));
    const [spoken] = spokenLines(cue);
    expect(spoken).toContain('Was that a push, or a pull?');
    expect(cue).toContain('It moved away — that is a push.');
    expect(itemCue(byId('observe-2'))).toContain('It came closer — that is a pull.');
  });

  it('compare names the two objects in the ask and flags the other name as the signature wrong answer', () => {
    const cue = itemCue(byId('c1'));
    const [spoken] = spokenLines(cue);
    expect(spoken).toContain('The Tennis Ball and the Rock get the same push.');
    expect(spoken).toContain('Which one slides farther?');
    expect(cue).toContain('The other object\'s name ("Rock") is the signature wrong answer');
    expect(cue).toContain('heavier does NOT slide farther');
  });

  it('design has a discrimination clause too — it was the one mode without one', () => {
    // Its natural miss is REPORTING the experiment instead of committing to a
    // push size, which is fluent, on-topic, and answers a question nobody asked.
    expect(itemCue(byId('d1'))).toContain('Reporting what happened when they tried it');
  });

  it('the contract states the accepted alternates — permissiveness is auditable', () => {
    const cue = itemCue(byId('p1'));
    expect(cue).toContain('The correct answer is "moves"');
    expect(cue).toContain('Also accept: "move", "it moves", "it will move", "yes"');
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
    expect(moveOnCue(byId('observe-1'), byId('p1'), { howToPlay: true })).toContain('Say moves, or stays.');
    expect(completeCue()).toContain('Then stop — the activity is over.');
  });
});

describe('18d — the reply channels are two, and the answer is not in the state block', () => {
  const entry = PHYSICS_CATALOG.find((p) => p.id === 'push-pull-arena')!;

  it('states the two-branch law BEFORE the branches, in the family\'s wording', () => {
    for (const fixture of FIXTURES) {
      const cue = itemCue(fixture);
      expect(cue).toContain('Your whole reply to their attempt is ONE of the quoted lines below and nothing else');
      expect(cue).toContain('no reminder of the method, no scaffolding line');
      expect(cue).toContain('reaches the activity as no verdict at all');
      // BEFORE the branches is the whole point: the earlier phrasing read as a
      // rule about repeats and left the first wrong answer apparently free.
      expect(cue.indexOf('no verdict at all')).toBeLessThan(cue.indexOf('If the answer is right'));
    }
  });

  it('no scaffolding rung quotes a speakable line', () => {
    const rungs = Object.values(entry.tutoring?.scaffoldingLevels ?? {});
    expect(rungs).toHaveLength(3);
    for (const rung of rungs) {
      expect(rung).toMatch(/scripted correction|say nothing further/);
    }
    // The two lines that were sanctioned prose the model could speak verbatim.
    // Level 3's was the observe how-to-play almost word for word.
    const joined = rungs.join(' ');
    expect(joined).not.toContain('Watch which way it goes');
    expect(joined).not.toContain('Tap Go and watch closely. Then tell me.');
  });

  it('the state block carries the stimulus, never the graded answer', () => {
    for (const fixture of FIXTURES) {
      const context = pack.contextFor(fixture);
      expect(Object.keys(context)).not.toContain('expectedAnswer');
      expect(context.stimulus).toBeTruthy();
      // The state block persists for the session; the answer belongs to the
      // turn, and the per-turn judging contract already names it.
      //
      // compare is the one mode whose answer is a NAME the state block has a
      // reason to carry (both objects are on screen). There the rule is that no
      // value may name the answer WITHOUT also naming the alternative — a menu
      // is not a pointer. Everywhere else the answer is simply absent.
      const answer = fixture.spokenAnswer.toLowerCase();
      const other = otherObjectName(fixture).toLowerCase();
      for (const value of Object.values(context)) {
        const said = value.toLowerCase();
        if (fixture.kind === 'compare' && said.includes(answer)) {
          expect(said).toContain(other);
        } else {
          expect(said).not.toContain(answer);
        }
      }
    }
    expect(entry.tutoring?.taskDescription).not.toContain('correct spoken answer');
  });

  it('every cue carries the anti-narration tail, not just the bracket rule', () => {
    for (const fixture of FIXTURES) {
      for (const cue of [itemCue(fixture), moveOnCue(fixture, FIXTURES[0])]) {
        expect(cue).toContain('never announce the activity\'s state or describe what has changed on the screen');
      }
    }
  });
});

describe('harness answer material mirrors the contract it tests', () => {
  it('every mode\'s signature wrong is the miss its contract names', () => {
    expect(pushPullArenaHarnessAnswers(byId('observe-1')).signatureWrong?.text).toBe('it went that way');
    expect(pushPullArenaHarnessAnswers(byId('p1')).signatureWrong?.text).toBe('it is on the ice');
    expect(pushPullArenaHarnessAnswers(byId('c1')).signatureWrong?.text).toBe('the Rock, because it is heavier');
    expect(pushPullArenaHarnessAnswers(byId('d1')).signatureWrong?.text).toBe('I tried it and it moved');
  });

  it('plain wrong is the other side of the menu, and it is never the right answer', () => {
    for (const fixture of FIXTURES) {
      const answers = pushPullArenaHarnessAnswers(fixture);
      expect(answers.correct).toBe(fixture.spokenAnswer);
      expect(answers.plainWrong).not.toBe(answers.correct);
      expect(fixture.alternates).not.toContain(answers.plainWrong);
    }
  });

  /**
   * The leak oracle's precondition, made a unit test rather than a live finding.
   *
   * Every mode here closes on a two-word spoken menu, so the answer is inside
   * the ask by construction and `leakExemptSpan` subtracts it. That only works
   * if the span is a REAL substring of the spoken ask, and it is only SAFE if
   * subtracting it leaves nothing behind — otherwise the exemption would be
   * hiding a genuine leak somewhere else in the line.
   */
  it('subtracting the menu span removes every leak token from the ask — and the span is really in it', () => {
    FIXTURES.forEach((fixture, index) => {
      const answers = pushPullArenaHarnessAnswers(fixture);
      const span = menuSpanFor(fixture);
      // Item 0 opens the run (greeting + how-to-play); the rest re-speak the
      // how-to-play only when the action changed. Check the widest ask.
      const [spoken] = spokenLines(itemCue(fixture, { opening: index === 0, howToPlay: true }));
      expect(spoken).toContain(span);
      expect(answers.leakExemptSpan).toBe(span);
      const rest = spoken.replace(span, ' ').toLowerCase();
      for (const token of answers.leakTokens) {
        expect(rest).not.toMatch(new RegExp(`\\b${token.toLowerCase()}\\b`));
      }
    });
  });
});
