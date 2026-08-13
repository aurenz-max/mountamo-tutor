/**
 * pictureVocabularyScript — the pedagogy lives here, so this is where it is
 * pinned. Pure, no jsdom, no mocked live loop.
 *
 * What this locks in:
 *  1. The pack passes the family's structural gates (validateJudgedScriptPack:
 *     benched response classes, sentinel discipline over every cue, cue
 *     builders that don't throw).
 *  2. ANSWER-LEAK: no spoken-mode ask, pronounce line, or context push ever
 *     contains the target word; the two tap modes' asks DO speak their
 *     stimulus (there the word is the question, not the answer).
 *  3. The ask STATES its problem aloud (a pre-reader cannot read the screen,
 *     and every correction re-ask inherits the ask).
 *  4. Corrections re-model then re-elicit, and they are the FIRST place the
 *     answer is spoken. An association retry never names the answer — a retry
 *     that gives the answer away is free, not a retry.
 *  5. Tap items carry a SILENCE contract; the tap verdict is code-computed.
 *  6. The catalog entry keeps its side of the contract: template keys resolve
 *     against exactly what the pack pushes, and no catalog sentence opens
 *     with a verdict sentinel.
 */
import { describe, it, expect } from 'vitest';
import {
  answerKindFor,
  completeCue,
  itemCue,
  itemFromChallenge,
  moveOnCue,
  pickModelOppositePair,
  pronounceCue,
  responseClassFor,
  scaleSpokenFor,
  stimulusFor,
  tapVerdictCue,
  type PictureVocabItem,
} from '../pictureVocabularyScript';
import {
  findSentinelCollisions,
  findUnresolvedTemplateKeys,
  validateJudgedScriptPack,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import { LITERACY_CATALOG } from '../../../../service/manifest/catalog/literacy';

// ── Fixtures — one item per mode, session-shaped ────────────────────────────

const RECEPTIVE = itemFromChallenge({
  id: 'pv-1', type: 'receptive_match', word: 'dog', emoji: '🐶',
  options: [
    { word: 'dog', emoji: '🐶' }, { word: 'sun', emoji: '☀️' },
    { word: 'cup', emoji: '☕' }, { word: 'bus', emoji: '🚌' },
  ],
});
const NAMING = itemFromChallenge({ id: 'pv-2', type: 'naming', word: 'apple', emoji: '🍎' });
const OPPOSITE = itemFromChallenge({
  id: 'pv-3', type: 'opposite', word: 'small', emoji: '🐭', baseWord: 'big', baseEmoji: '🐘',
});
const ASSOCIATION = itemFromChallenge({
  id: 'pv-4', type: 'association', word: 'shoe', emoji: '👟', baseWord: 'sock', baseEmoji: '🧦',
  options: [
    { word: 'shoe', emoji: '👟' }, { word: 'fork', emoji: '🍴' },
    { word: 'nest', emoji: '🪺' }, { word: 'key', emoji: '🔑' },
  ],
});
const SCALE = itemFromChallenge({
  id: 'pv-5', type: 'gradable_scale', word: 'cool', emoji: '🌡️',
  scaleWords: ['freezing', 'cold', 'cool', 'warm', 'hot'], scaleTargetIndex: 2,
});
const FRAME = itemFromChallenge({
  id: 'pv-6', type: 'sentence_frame', word: 'bed', emoji: '🛏️',
  frameDisplay: 'We sleep in a ____.', frameSpoken: 'We sleep in a... hmm... what?',
});

const ITEMS: PictureVocabItem[] = [RECEPTIVE, NAMING, OPPOSITE, ASSOCIATION, SCALE, FRAME];
const modelPair = pickModelOppositePair(ITEMS);

/** The pack exactly as the component assembles it (minus component closures). */
const pack: JudgedScriptPack<PictureVocabItem> = {
  primitiveType: 'picture-vocabulary',
  activityLine: 'live direct instruction picture vocabulary practice',
  items: ITEMS,
  itemCue: (item, opts) => itemCue(item, opts, { modelPair }),
  moveOnCue: (item, next, opts) => moveOnCue(item, next, opts, { modelPair }),
  completeCue,
  pronounceCue,
  contextFor: (item) => ({ challengeType: item.kind, stimulus: stimulusFor(item) }),
};

/** The line the tutor actually SPEAKS — the quote after the first
 *  `Say exactly:`. Everything else in a cue is judge-side instruction. */
const spokenLine = (cue: string): string => {
  const match = cue.match(/Say exactly:\s*"([\s\S]*?)"/);
  return match ? match[1] : '';
};

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('picture-vocabulary pack · structural gates', () => {
  it('passes validateJudgedScriptPack with zero issues', () => {
    expect(validateJudgedScriptPack(pack)).toEqual([]);
  });

  it('maps modes to the ruled answer material and benched classes', () => {
    // Association TAPS because open-set spoken production is a BLOCKED class —
    // this mapping is the ruling; changing it needs a bench, not an edit.
    expect(answerKindFor('receptive_match')).toBe('gesture');
    expect(answerKindFor('association')).toBe('gesture');
    expect(responseClassFor('receptive_match')).toBe('manipulation');
    expect(responseClassFor('association')).toBe('manipulation');
    for (const kind of ['naming', 'opposite', 'gradable_scale', 'sentence_frame'] as const) {
      expect(answerKindFor(kind)).toBe('voice');
      expect(responseClassFor(kind)).toBe('short_spoken_word');
    }
  });

  it('stamps action per item so mixed sessions re-speak the how-to-play on mode change', () => {
    for (const item of ITEMS) expect(item.action).toBe(item.kind);
  });

  it('picks an opposite model pair that shares no word with the session', () => {
    const words = new Set(ITEMS.flatMap((i) => [i.word, i.baseWord ?? '']));
    expect(words.has(modelPair[0])).toBe(false);
    expect(words.has(modelPair[1])).toBe(false);
  });
});

// ── 2. Answer-leak: spoken modes never say or push the answer ───────────────

describe('picture-vocabulary pack · answer-leak', () => {
  it('never puts the target word in a spoken-mode ask', () => {
    // REVERT-BITE for the stated-problem rule too: opposite and scale asks
    // must state their stimulus while withholding their answer.
    expect(spokenLine(itemCue(NAMING))).not.toContain('apple');
    expect(spokenLine(itemCue(OPPOSITE, {}, { modelPair }))).not.toContain('small');
    expect(spokenLine(itemCue(SCALE))).not.toContain('cool');
    expect(spokenLine(itemCue(FRAME))).not.toContain('bed');
  });

  it('speaks the stimulus in every ask (the problem is STATED, not printed)', () => {
    expect(spokenLine(itemCue(RECEPTIVE))).toContain('dog');            // the word IS the question
    expect(spokenLine(itemCue(OPPOSITE, {}, { modelPair }))).toContain('opposite of big');
    expect(spokenLine(itemCue(ASSOCIATION))).toContain('sock');
    expect(spokenLine(itemCue(ASSOCIATION))).not.toContain('shoe');
    expect(spokenLine(itemCue(SCALE))).toContain('freezing, cold, hmm, warm, hot');
    expect(spokenLine(itemCue(FRAME))).toContain('We sleep in a... hmm... what?');
  });

  it('re-speaks the QUESTION on tap-to-hear, never the answer', () => {
    expect(pronounceCue(NAMING)).not.toContain('apple');
    expect(pronounceCue(OPPOSITE)).not.toContain('small');
    expect(pronounceCue(SCALE)).not.toContain('cool');
    expect(pronounceCue(FRAME)).not.toContain('bed');
    expect(pronounceCue(RECEPTIVE)).toContain('Tap the dog.'); // the word IS the question here
  });

  it('pushes only the answer-free question side through the context channel', () => {
    // di-math-facts rule: naming's picture word IS the answer, so naming
    // pushes no word at all.
    expect(stimulusFor(NAMING)).not.toContain('apple');
    expect(stimulusFor(RECEPTIVE)).toBe('dog');
    expect(stimulusFor(OPPOSITE)).toBe('big');
    expect(stimulusFor(ASSOCIATION)).toBe('sock');
    expect(stimulusFor(SCALE)).toContain('hmm');
    expect(stimulusFor(SCALE)).not.toContain('cool');
    expect(stimulusFor(FRAME)).toContain('____');
    expect(stimulusFor(FRAME)).not.toContain('bed');
  });
});

// ── 3. Corrections re-model then re-elicit; the answer is EARNED there ──────

describe('picture-vocabulary pack · corrections', () => {
  it('every spoken-mode correction opens with the correct sentinel, names the answer, and re-elicits', () => {
    const naming = itemCue(NAMING);
    expect(naming).toContain('If it is wrong, say exactly: "My turn:');
    expect(naming).toContain('this is an apple');   // article-correct model
    expect(naming).toContain('Your turn. What is this?');

    const opposite = itemCue(OPPOSITE, {}, { modelPair });
    expect(opposite).toContain('the opposite of big is small');
    expect(opposite).toContain('Your turn. What is the opposite of big?');

    const scale = itemCue(SCALE);
    expect(scale).toContain('freezing, cold, cool, warm, hot');
    expect(scale).toContain('The missing word is cool');

    const frame = itemCue(FRAME);
    expect(frame).toContain('We sleep in a bed.');
    expect(frame).toContain('Your turn. Say the missing word.');
  });

  it('names what looks like an answer and is not, per mode', () => {
    expect(itemCue(OPPOSITE, {}, { modelPair })).toContain('"big" said back is NOT the answer');
    expect(itemCue(SCALE)).toContain('A word already in the list is NOT the answer');
    expect(itemCue(NAMING)).toContain('A category word like animal');
  });

  it('carries the accept side — a right answer that does not look right', () => {
    expect(itemCue(NAMING)).toContain('like puppy for a dog');
    expect(itemCue(OPPOSITE, {}, { modelPair })).toContain('truly means the opposite');
    expect(itemCue(FRAME)).toContain('honestly finishes the sentence');
  });
});

// ── 4. Tap modes: silence contract + code-computed verdict ──────────────────

describe('picture-vocabulary pack · tap items', () => {
  it('tap asks carry a SILENCE contract, not a judging contract', () => {
    for (const item of [RECEPTIVE, ASSOCIATION]) {
      const cue = itemCue(item);
      expect(cue).toContain('WAIT in complete silence');
      expect(cue).toContain('TAPPING a picture');
      expect(cue).not.toContain('If the answer is right');
    }
    expect(itemCue(ASSOCIATION)).toContain('Never say what goes with sock');
  });

  it('computes the verdict in code and hands the tutor its exact line', () => {
    const match = tapVerdictCue(RECEPTIVE, 'dog');
    expect(match).toContain('MATCHES');
    expect(match).toContain('"Yes! You found the dog."');

    const miss = tapVerdictCue(RECEPTIVE, 'sun');
    expect(miss).toContain('does NOT match');
    expect(spokenLine(miss)).toContain('dog'); // re-stimulus is safe here
    expect(spokenLine(miss).startsWith('My turn:')).toBe(true);
  });

  it('an association retry NEVER names the answer', () => {
    // REVERT-BITE: the target rides in the instruction (judge's eyes) but the
    // spoken correction must not say it, or the retry is free.
    const miss = tapVerdictCue(ASSOCIATION, 'fork');
    expect(miss).toContain('does NOT match');
    expect(spokenLine(miss)).not.toContain('shoe');
    expect(spokenLine(miss)).toContain('sock');
  });

  it('association closes its loop at move-on by naming the pair', () => {
    expect(spokenLine(moveOnCue(ASSOCIATION, SCALE, { howToPlay: true }, { modelPair })))
      .toContain('Sock goes with shoe');
    // Spoken modes modeled the answer in their corrections already — no close line.
    expect(spokenLine(moveOnCue(OPPOSITE, SCALE, {}, { modelPair }))).not.toContain('small');
  });
});

// ── 5. Session frame ────────────────────────────────────────────────────────

describe('picture-vocabulary pack · session frame', () => {
  it('the opening cue has ONE job: greeting + how-to-play + ask inside the quoted line', () => {
    const opening = spokenLine(itemCue(RECEPTIVE, { opening: true, howToPlay: true }));
    expect(opening).toContain('Hi! Time to play with words!');
    expect(opening).toContain('tap its picture');
    expect(opening).toContain('Tap the dog.');
  });

  it('models the opposite rule on the code-owned pair, never a session word', () => {
    const opening = spokenLine(itemCue(OPPOSITE, { opening: true, howToPlay: true }, { modelPair }));
    expect(opening).toContain(`like ${modelPair[0]} and ${modelPair[1]}`);
  });

  it('the final move-on and the complete cue both stop the tutor', () => {
    expect(moveOnCue(FRAME, null, {}, { modelPair })).toContain('Then stop');
    expect(completeCue()).toContain('Then stop — the activity is over.');
  });
});

// ── 6. The catalog keeps its side of the contract ───────────────────────────

describe('picture-vocabulary catalog · DI frame', () => {
  const entry = LITERACY_CATALOG.find((p) => p.id === 'picture-vocabulary')!;

  it('declares the family audio mode', () => {
    expect(entry.audioInput).toEqual({ manual_activity: true });
  });

  it('template keys resolve against exactly what the pack pushes', () => {
    const provided = Object.keys(pack.contextFor(NAMING));
    expect(entry.tutoring?.contextKeys).toEqual(provided);
    const prose = [
      entry.tutoring?.taskDescription ?? '',
      ...Object.values(entry.tutoring?.scaffoldingLevels ?? {}),
      ...(entry.tutoring?.aiDirectives ?? []).map((d) => d.instruction),
    ].join('\n');
    expect(findUnresolvedTemplateKeys(prose, provided)).toEqual([]);
  });

  it('no catalog sentence opens with a verdict sentinel (standing gate 2)', () => {
    const cues = [
      { label: 'taskDescription', text: entry.tutoring?.taskDescription ?? '' },
      ...Object.entries(entry.tutoring?.scaffoldingLevels ?? {}).map(([label, text]) => ({ label, text })),
      ...(entry.tutoring?.commonStruggles ?? []).map((s, i) => ({ label: `struggle-${i}`, text: `${s.pattern}. ${s.response}` })),
      ...(entry.tutoring?.aiDirectives ?? []).map((d) => ({ label: d.title, text: d.instruction })),
    ];
    expect(findSentinelCollisions(cues)).toEqual([]);
  });

  it('the scale walk helper blanks exactly the target rung', () => {
    expect(scaleSpokenFor(SCALE)).toBe('freezing, cold, hmm, warm, hot');
  });
});
