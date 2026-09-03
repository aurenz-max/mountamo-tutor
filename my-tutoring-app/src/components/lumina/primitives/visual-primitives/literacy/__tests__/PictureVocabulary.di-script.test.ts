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
import { ASSOCIATION_BENCH_STIMULI } from '@/components/lumina/service/qa/di/associationBench';
import {
  answerKindFor,
  completeCue,
  itemCue,
  isOpenSet,
  itemFromChallenge,
  itemsFromChallenges,
  moveOnCue,
  pickModelAssociationPair,
  pickModelOppositePair,
  pictureVocabularyHarnessAnswers,
  pictureVocabularyPackBase,
  pronounceCue,
  responseClassFor,
  scaleSpokenFor,
  stimulusFor,
  tapVerdictCue,
  type PictureVocabChallengeLike,
  type PictureVocabItem,
} from '../pictureVocabularyScript';
import {
  spokenSpanOf,
  type JudgedScriptPack,
} from '../../../../hooks/judgedScriptContract';
import {
  checkDiCatalogEntry,
  checkPackGates,
} from '../../../../hooks/judgedScriptContract.testkit';
import { LITERACY_CATALOG } from '../../../../service/manifest/catalog/literacy';

// ── Fixtures — one item per mode, session-shaped ────────────────────────────

/** A fixture must SURVIVE the build gate. Typing the null away would let a
 *  fixture the gate rejects sit in the session silently testing nothing. */
const built = (ch: PictureVocabChallengeLike): PictureVocabItem => {
  const item = itemFromChallenge(ch);
  if (!item) throw new Error(`fixture "${ch.id}" was rejected by the build gate`);
  return item;
};

const RECEPTIVE = built({
  id: 'pv-1', type: 'receptive_match', word: 'dog', emoji: '🐶',
  options: [
    { word: 'dog', emoji: '🐶' }, { word: 'sun', emoji: '☀️' },
    { word: 'cup', emoji: '☕' }, { word: 'bus', emoji: '🚌' },
  ],
});
const NAMING = built({ id: 'pv-2', type: 'naming', word: 'apple', emoji: '🍎' });
const OPPOSITE = built({
  id: 'pv-3', type: 'opposite', word: 'small', emoji: '🐭', baseWord: 'big', baseEmoji: '🐘',
});
// NO `options`. That absence is the fixture's whole point: an association
// challenge that carries no cards must still SURVIVE the build gate, which is
// only true because the mode left `TAP_KINDS` (item 25). Before the port this
// same literal was rejected.
const ASSOCIATION = built({
  id: 'pv-4', type: 'association', word: 'shoe', emoji: '👟', baseWord: 'sock', baseEmoji: '🧦',
});
const SCALE = built({
  id: 'pv-5', type: 'gradable_scale', word: 'cool', emoji: '🌡️',
  scaleWords: ['freezing', 'cold', 'cool', 'warm', 'hot'], scaleTargetIndex: 2,
});
// frameSpoken is deliberately kept, and deliberately TRUNCATED, exactly as the
// generator emitted it in the 2026-08-16 probe: the ask must no longer use it.
const FRAME = built({
  id: 'pv-6', type: 'sentence_frame', word: 'bed', emoji: '🛏️',
  frameDisplay: 'We sleep in a ____ at night.',
  frameSpoken: 'We sleep in a... hmm... what?',
});

const ITEMS: PictureVocabItem[] = [RECEPTIVE, NAMING, OPPOSITE, ASSOCIATION, SCALE, FRAME];
const modelPair = pickModelOppositePair(ITEMS);
const assocPair = pickModelAssociationPair(ITEMS);
/** What the pack itself threads — every cue assertion below uses this, so a
 *  test cannot pass under a pair the component would never have picked. */
const pairs = { modelPair, assocPair };

/**
 * The pack PRODUCTION assembles — the shared cue surface itself, not a literal
 * that mirrors it. This file used to re-declare the pack field by field, which
 * is a fixture that can go green while the component and the DI harness send
 * something else; all three earlier ports in this sweep carried the same drift.
 * `PictureVocabulary.tsx` spreads exactly this and adds only its rendered status
 * lines and the diagnosis that reads component state.
 */
const pack: JudgedScriptPack<PictureVocabItem> = pictureVocabularyPackBase(ITEMS);

/** The line the tutor actually SPEAKS — the shared parser, so every port reads
 *  the same span. Everything else in a cue is judge-side instruction. */
const spokenLine = spokenSpanOf;

// ── 1. Structural gates ─────────────────────────────────────────────────────

describe('picture-vocabulary pack · structural gates', () => {
  it('passes the family gates: validate + performed-directions + repeated-asks', () => {
    // checkPackGates = validateJudgedScriptPack PLUS the two gates that exist
    // because a live drive found the defect after every machine gate passed
    // (the performed "[WAIT silently]"; the byte-identical consecutive ask).
    expect(checkPackGates(pack)).toEqual([]);
  });

  it('two items in the SAME mode do not recite the ask twice', () => {
    // One item per mode is the ONE pack shape that cannot trigger the repeat
    // gate — it compares consecutive items of the same action, and a real
    // session runs several naming items in a row.
    const twice = [
      built({ id: 'n1', type: 'naming', word: 'apple', emoji: '🍎' }),
      built({ id: 'n2', type: 'naming', word: 'chair', emoji: '🪑' }),
    ];
    expect(checkPackGates(pictureVocabularyPackBase(twice))).toEqual([]);
  });

  it('maps modes to the ruled answer material and benched classes', () => {
    /**
     * ⭐ THIS TEST WAS INVERTED BY ITEM 25, IN BOTH DIRECTIONS — it used to
     * assert that association was a gesture/manipulation, which was the
     * `open_set_word` BLOCK made testable. The class was benched, so the block
     * is gone and the same assertions now pin the opposite fact.
     *
     * Both halves are load-bearing:
     *  - association must be VOICE + `open_set_word`, or the cards are back;
     *  - receptive_match must STAY gesture + manipulation. That is a ruling,
     *    not debt (the tap IS receptive identification), and converting it
     *    would be a regression, not the next rung.
     */
    expect(answerKindFor('association')).toBe('voice');
    expect(responseClassFor('association')).toBe('open_set_word');
    expect(isOpenSet('association')).toBe(true);

    expect(answerKindFor('receptive_match')).toBe('gesture');
    expect(responseClassFor('receptive_match')).toBe('manipulation');

    for (const kind of ['naming', 'opposite', 'gradable_scale', 'sentence_frame'] as const) {
      expect(answerKindFor(kind)).toBe('voice');
      expect(responseClassFor(kind)).toBe('short_spoken_word');
      expect(isOpenSet(kind)).toBe(false);
    }
  });

  it('builds an association item with NO option cards, and still drops one with no base', () => {
    // The §3 near-miss, pinned: the cards-contain-the-target gate is keyed to
    // TAP_KINDS, so it must no longer reach association — while the base-word
    // gate, which is about the ASK being answerable at all, must still bite.
    expect(itemFromChallenge({
      id: 'a1', type: 'association', word: 'shoe', emoji: '👟', baseWord: 'sock', baseEmoji: '🧦',
    })).not.toBeNull();
    expect(itemFromChallenge({
      id: 'a2', type: 'association', word: 'shoe', emoji: '👟',
    })).toBeNull();
    expect(ASSOCIATION.options).toBeUndefined();
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
    // The ask HANDS OVER now instead of pointing at cards: "Sock. Your turn.
    // What goes with sock?" — no "tap the picture" anywhere in the pack.
    expect(spokenLine(itemCue(ASSOCIATION, {}, pairs))).toContain('What goes with sock?');
    expect(spokenLine(itemCue(ASSOCIATION, {}, pairs))).not.toContain('Tap the picture');
    expect(spokenLine(itemCue(ASSOCIATION, {}, pairs))).not.toContain('shoe');
    expect(spokenLine(itemCue(SCALE))).toContain('freezing, cold, hmm, warm, hot');
    expect(spokenLine(itemCue(FRAME))).toContain('We sleep in a ... hmm ... at night.');
    // REVERT-BITE for the probe's finding: the generator's own frameSpoken was
    // the sentence CUT OFF AT THE BLANK, so the clause that decides the answer
    // never reached the child. The spoken frame is derived from frameDisplay
    // now; the truncated field must not survive anywhere in the ask.
    expect(spokenLine(itemCue(FRAME))).not.toContain('what?');
    expect(spokenLine(itemCue(FRAME))).toContain('at night');
    // A blank at the END must not leave "... hmm ...." — the ellipsis and the
    // sentence's own stop collide, and this line is spoken to a five-year-old.
    const tailBlank = built({
      id: 'pv-7', type: 'sentence_frame', word: 'chair', emoji: '🪑',
      frameDisplay: 'We sit on a ____.',
    });
    expect(spokenLine(itemCue(tailBlank))).toContain('We sit on a ... hmm.');
    expect(spokenLine(itemCue(tailBlank))).not.toContain('hmm ....');
  });

  it('re-speaks the QUESTION on tap-to-hear, never the answer', () => {
    expect(pronounceCue(NAMING)).not.toContain('apple');
    expect(pronounceCue(OPPOSITE)).not.toContain('small');
    expect(pronounceCue(SCALE)).not.toContain('cool');
    expect(pronounceCue(FRAME)).not.toContain('bed');
    // Association re-hears the SPOKEN question now, not a tap instruction.
    expect(pronounceCue(ASSOCIATION)).not.toContain('shoe');
    expect(pronounceCue(ASSOCIATION)).toContain('What goes with sock?');
    expect(pronounceCue(ASSOCIATION)).not.toContain('Tap the picture');
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
    // NO article frame: the pool carries plurals and mass nouns, so "this is
    // a shoes" / "this is a soap" are one live drive apart. The bare word is
    // the model, and it is correct for every noun class.
    expect(naming).toContain('If it is wrong, say exactly: "My turn: Apple. Your turn. What is this?"');
    expect(naming).not.toMatch(/My turn: this is an? /);

    const opposite = itemCue(OPPOSITE, {}, { modelPair });
    expect(opposite).toContain('the opposite of big is small');
    expect(opposite).toContain('Your turn. What is the opposite of big?');

    const scale = itemCue(SCALE);
    expect(scale).toContain('freezing, cold, cool, warm, hot');
    expect(scale).toContain('The missing word is cool');

    const frame = itemCue(FRAME);
    expect(frame).toContain('We sleep in a bed at night.');
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
  it('the SILENCE contract is now receptive_match ALONE', () => {
    const cue = itemCue(RECEPTIVE);
    // The wait is stated as a FACT about the turn, never as an order — the
    // imperative form is what a model performed as "[WAIT silently]", and
    // checkPackGates now refuses it.
    expect(cue).toContain('The quoted line is the ONLY thing you say on this turn');
    expect(cue).toContain('TAPPING a picture');
    expect(cue).not.toContain('If the answer is right');

    // REVERT-BITE (item 25): association used to carry this same contract and a
    // "Never say what goes with sock" line. Both are gone, and their absence is
    // what proves the mode is judged rather than waited out.
    const assoc = itemCue(ASSOCIATION, {}, pairs);
    expect(assoc).not.toContain('TAPPING a picture');
    expect(assoc).not.toContain('Never say what goes with sock');
    expect(assoc).toContain('If the answer is right');
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

  it('an association retry STILL never names a partner — now via the open correction', () => {
    /**
     * THE SAME PEDAGOGY, RE-PINNED ON THE NEW MECHANISM. It used to be enforced
     * on tapVerdictCue's association branch, which no longer exists; the
     * property it protected — a retry that hands over the answer is not a retry
     * — is now carried by the correction modeling the RELATION on a code-owned
     * pair instead of naming the generated partner.
     */
    const cue = itemCue(ASSOCIATION, {}, pairs);
    const corrections = cue.slice(cue.indexOf('If the answer is right'));
    expect(corrections).not.toContain('shoe');
    expect(corrections).toContain(`a ${assocPair[0]} goes with a ${assocPair[1]}`);
    expect(corrections).toContain('What goes with sock?');
  });

  it('hands the judge a RULE, never the generated partner', () => {
    // ⚠️ THE FAILURE THIS BITES: naming the target re-closes the set. A judge
    // told "the correct answer is shoe" grades against shoe and refuses foot,
    // drawer and laundry — the answers real children give.
    const cue = itemCue(ASSOCIATION, {}, pairs);
    expect(cue).not.toContain('The correct answer is "shoe"');
    expect(spokenLine(cue)).not.toContain('shoe');
    expect(cue).toContain('INCLUDING ONE YOU DID NOT THINK OF YOURSELF');
    // The closed modes must NOT have lost their target.
    expect(itemCue(NAMING)).toContain('The correct answer is "apple"');
  });

  it('carries all six guards, and the chain guard by name', () => {
    // The contract CLAIMS these are refused; associationBench.ts is that claim
    // made testable. Change one, change both.
    const cue = itemCue(ASSOCIATION, {}, pairs);
    expect(cue).toContain('"sock" said back is NOT the answer');   // echo
    expect(cue).toContain('invent a story');                        // rationalised chain
    expect(cue).toContain('THEY DO NOT GO TOGETHER');
    expect(cue).toContain('name of the GROUP');                     // category word
    expect(cue).toContain('same KIND of thing');                    // same-category swap
    expect(cue).toContain('A made-up word is NOT the answer');      // nonword
    expect(cue).toContain('they do not know');                      // off-task
    // The symmetry ruling (§2.3.1) is STATED, not left to inference.
    expect(cue).toContain('BOTH WAYS');
  });

  it('gives the same-category guard a worked counterexample, and states precedence', () => {
    /**
     * ⭐ THE 2026-08-21 BENCH FAILURE, MADE UN-REGRESSABLE. `same-category`
     * scored 0/8 while `rationalised-chain` — the bucket the fixture was
     * weighted toward — held 7/8, and the only structural difference between
     * them was that the guard which held ships a worked counterexample and the
     * guard which lost shipped one abstract sentence. Three levers, all three
     * asserted here so none can be quietly dropped by a later edit.
     */
    const cue = itemCue(ASSOCIATION, {}, pairs);

    // 1. A WORKED COUNTEREXAMPLE, from OUTSIDE the fixture. A guard keyed to
    //    its own bench probes would score the bench rather than the rule, so
    //    none of associationBench.ts's same-category words may appear here.
    expect(cue).toContain('An apple is not the answer for a banana');
    expect(cue).toContain('a couch is not the answer for a sofa');
    // The HYPONYM half is separately pinned: `sock`, `dog` and `bed` all held
    // same-category 2/2 on the synonym sentence alone while `cup` still
    // affirmed `mug`. A mug is a KIND of cup, not a second name for one.
    expect(cue).toContain('Nor is a KIND of sock');
    expect(cue).toContain('a second time and it is WRONG');
    // Whole words — 'hat' is a substring of 'that', which the cue is full of.
    for (const probe of ['shirt', 'hat', 'chair', 'table', 'mug', 'bowl', 'bird']) {
      expect(cue).not.toMatch(new RegExp(`\b${probe}\b`));
    }
  });

  it('never names a bench probe word in the contract — a guard keyed to its own fixture scores the bench, not the rule', () => {
    /**
     * ⚠️ THE DEFECT THIS PINS, AND IT COST A 48-PROBE RUN. The first draft of
     * the narrowed accept clause excluded things "kept in the same DRAWER" —
     * and `drawer` is an AFFIRM probe (where socks are kept). The 2026-09-02
     * bench refused it on probe 3: a false refusal manufactured entirely by
     * the contract contradicting itself, indistinguishable in the matrix from
     * a judge that had re-closed the set.
     *
     * The general rule is the one associationBench.ts already states about
     * PROBES and this states about the CONTRACT: fixture words and contract
     * words must not overlap, or the bench is scoring its own crib sheet.
     *
     * TWO SANCTIONED EXCEPTIONS, both load-bearing:
     *  - the stimulus itself, which the cue must name to ask the question;
     *  - `cat`/`sock`, the rationalised-chain guard's worked counterexample.
     *    It predates this rule, it is the guard that HELD 7/8 on 2026-08-21,
     *    and it is a real tension — recorded here rather than resolved by
     *    quietly deleting either the probe or the example.
     */
    const cue = itemCue(ASSOCIATION, {}, pairs);
    const sanctioned = new Set(['sock', 'cat']);
    const named = ASSOCIATION_BENCH_STIMULI
      .flatMap((s) => s.probes.map((probe) => probe.text.toLowerCase()))
      .filter((word) => /^[a-z]+$/.test(word) && !sanctioned.has(word))
      .filter((word) => new RegExp(`\b${word}\b`).test(cue));
    expect(named).toEqual([]);

    // 2. THE ACCEPT CLAUSE NO LONGER LICENSES CO-LOCATION. "keep with it" was
    //    the exact phrase the judge applied to affirm shirt/sock: what is kept
    //    is now a PLACE, never a neighbouring thing.
    expect(cue).not.toContain('keep with it');
    expect(cue).toContain('the place you keep it');
    expect(cue).toContain('merely shares a place with');
    // … and the exclusion must not swallow the PLACE, which is a valid answer.
    expect(cue).toContain('The place itself still counts');

    // 3. PRECEDENCE, AS A DISCRIMINATION PAIR — never as a blunt tie-break.
    //    A rule that makes same-kind decisive refuses `shoe` for `sock`, which
    //    is BOTH the curated partner AND same-category footwear; the
    //    2026-09-02 run proved that within five probes. The pair must carry
    //    one same-kind case that is RIGHT and one that is WRONG, so the
    //    judge reads "used together" as the question rather than "same kind".
    expect(cue).toContain('A glove goes with a hand');
    expect(cue).toContain('A glove does NOT go with a scarf');
    expect(cue).toContain('does not by itself make an answer right');
    expect(cue).not.toContain('THE REFUSAL WINS');
    //    It must come AFTER the accept clause it qualifies.
    expect(cue.indexOf('A glove goes with a hand'))
      .toBeGreaterThan(cue.indexOf('INCLUDING ONE YOU DID NOT THINK OF YOURSELF'));
  });

  it('gives the echo and the group word their OWN branches, ahead of the catch-all', () => {
    /**
     * ⭐ ITEM 24 MOST TRANSFERABLE FINDING. The generic correction is a
     * non-sequitur to an echo, so the model goes off script to say something
     * more apt — and an improvised line opens with NEITHER sentinel, so the
     * engine reads no verdict and the loop goes deaf. It hit 5 of 9 items on
     * the rhyme pilot, always on the first correction.
     *
     * Order is the whole point: a model reading top-down must reach the
     * specific case BEFORE the catch-all.
     */
    const cue = itemCue(ASSOCIATION, {}, pairs);
    const echo = cue.indexOf('If the learner said "sock" back to you');
    const group = cue.indexOf('If the learner named the whole group');
    const generic = cue.indexOf('If it is wrong for any other reason');
    expect(echo).toBeGreaterThan(-1);
    expect(group).toBeGreaterThan(-1);
    expect(generic).toBeGreaterThan(-1);
    expect(echo).toBeLessThan(generic);
    expect(group).toBeLessThan(generic);

    // Every branch opens with the correction sentinel, or the loop cannot hear it.
    expect(cue).toContain('say exactly: "My turn: sock cannot go with itself.');
    expect(cue).toContain('say exactly: "My turn: that names a whole group.');
    // ...and none of them leaks a partner.
    expect(cue.slice(echo)).not.toContain('shoe');
  });

  it('affirms with deixis, because it cannot know what the child said', () => {
    // The first affirmation in this pack that cannot name the answer. "that"
    // carries the reference so the line stays byte-fixed and the family's
    // exact-line oracles need no exception for the open class.
    expect(itemCue(ASSOCIATION, {}, pairs))
      .toContain('say exactly: "Yes, that goes with sock — they belong together."');
    expect(itemCue(NAMING)).toContain('say exactly: "Yes, apple."');
  });

  it('association closes its loop at move-on with ONE partner, not THE partner', () => {
    // A capped item must not end with the relation still unknown — its
    // corrections never named a partner, by design. But the phrasing matters:
    // the child may have said something honest that was not "shoe", so the line
    // offers an example rather than asserting the answer.
    const close = spokenLine(moveOnCue(ASSOCIATION, SCALE, { howToPlay: true }, pairs));
    expect(close).toContain('One thing that goes with sock is shoe');
    expect(close).not.toContain('Sock goes with shoe');
    // Spoken modes modeled the answer in their corrections already — no close line.
    expect(spokenLine(moveOnCue(OPPOSITE, SCALE, {}, pairs))).not.toContain('small');
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

  it('keeps its side of the contract: audio mode, contextKeys, template keys, sentinel scan', () => {
    expect(checkDiCatalogEntry(entry, pack, NAMING)).toEqual([]);
  });

  it('the scale walk helper blanks exactly the target rung', () => {
    expect(scaleSpokenFor(SCALE)).toBe('freezing, cold, hmm, warm, hot');
  });

  it('every rung of the scaffolding ladder routes through the scripted correction (18d)', () => {
    // The defect this bites: level1/level2 used to say "Say the question once
    // more, then wait for them alone." A re-spoken ask opens with NEITHER
    // sentinel, so the reducer records no verdict and the correction counter
    // freezes with the child waiting. level3 was always correct — which is why
    // a per-ENTRY grep reported this entry clean. Assert per RUNG.
    const rungs = Object.values(entry.tutoring!.scaffoldingLevels!);
    expect(rungs).toHaveLength(3);
    for (const rung of rungs) {
      expect(rung.toLowerCase()).toContain('scripted correction line');
      expect(rung.toLowerCase()).not.toMatch(/say the question (once more|again)/);
    }
  });
});

// ── 7. The judged-loop harness surface (19h-i-b port 4) ─────────────────────

describe('picture-vocabulary · DI harness surface', () => {
  it('states the two-branch law BEFORE the branches on every spoken contract', () => {
    // 18d: the law has to arrive before "If the answer is right", or a model
    // reading top-down has already met both branches when it is told they are
    // the only two. Wording is byte-shared with the family so a grep finds it.
    for (const item of [NAMING, OPPOSITE, SCALE, FRAME]) {
      const cue = itemCue(item, {}, { modelPair });
      const law = cue.indexOf('Your whole reply to their attempt is ONE of the quoted lines below');
      expect(law).toBeGreaterThan(-1);
      expect(cue).toContain('no scaffolding line');
      expect(law).toBeLessThan(cue.indexOf('If the answer is right'));
    }
  });

  it('gives every cue the NEVER_PERFORM tail (item 21)', () => {
    const cues = [
      itemCue(NAMING), itemCue(RECEPTIVE),
      moveOnCue(NAMING, SCALE, {}, { modelPair }),
      tapVerdictCue(RECEPTIVE, 'sun'), pronounceCue(SCALE),
    ];
    for (const cue of cues) {
      expect(cue).toContain('never announce the activity\'s state');
      expect(cue).toContain('never announce that you are waiting or listening');
    }
  });

  it('drops asks that have no defensible answer, and keeps the ones that do', () => {
    const kept = itemsFromChallenges([
      { id: 'ok', type: 'naming', word: 'apple', emoji: '🍎' },
      // A tap mode whose cards do not contain the target: the tap can never
      // match, so the child is corrected to the cap for answering correctly.
      { id: 'no-target', type: 'receptive_match', word: 'dog', emoji: '🐶',
        options: [{ word: 'sun', emoji: '☀️' }, { word: 'cup', emoji: '☕' }] },
      // A pair whose two sides are the same word asks for what it just said.
      { id: 'same-word', type: 'opposite', word: 'big', emoji: '🐘', baseWord: 'big', baseEmoji: '🐘' },
      // The blanked rung is not the answer — the ask would say "hmm" in the
      // wrong place and the correction would name a word off the scale.
      { id: 'bad-rung', type: 'gradable_scale', word: 'cool', emoji: '🌡️',
        scaleWords: ['cold', 'cool', 'warm'], scaleTargetIndex: 0 },
      // The answer appears twice on the scale, so the spoken walk says it aloud.
      { id: 'dupe-rung', type: 'gradable_scale', word: 'cool', emoji: '🌡️',
        scaleWords: ['cool', 'warm', 'cool'], scaleTargetIndex: 0 },
      // No blank: frameFilledFor returns the sentence unchanged, so the
      // correction never models the word in place.
      { id: 'no-blank', type: 'sentence_frame', word: 'bed', emoji: '🛏️',
        frameDisplay: 'We sleep in a bedroom.', frameSpoken: 'We sleep in a what?' },
      // The frame names its own target elsewhere in the sentence, so the spoken
      // form gives the answer away before the child can produce it. (The old
      // leak channel — a truncated-or-leaky frameSpoken — is closed by
      // construction now: the spoken frame is derived from frameDisplay.)
      { id: 'frame-leak', type: 'sentence_frame', word: 'bed', emoji: '🛏️',
        frameDisplay: 'A bed is soft, so we sleep in a ____.', frameSpoken: 'ignored' },
    ]);
    expect(kept.map((i) => i.id)).toEqual(['ok']);
  });

  it('never runs two blanks on ONE scale — each ask would speak the other answer', () => {
    // Found by the live drive: the generator padded a thin scale pool by
    // re-blanking a scale it had already used, so item 1 asked
    // "quiet, soft, hmm, noisy" (speaking item 5's answer) and item 5 asked
    // "quiet, hmm, loud, noisy" (speaking item 1's). Neither item is wrong
    // ALONE, so only a session-level gate can see it.
    const SCALE_WORDS = ['quiet', 'soft', 'loud', 'noisy'];
    const kept = itemsFromChallenges([
      { id: 's1', type: 'gradable_scale', word: 'loud', emoji: '🔊',
        scaleWords: SCALE_WORDS, scaleTargetIndex: 2 },
      { id: 's2', type: 'gradable_scale', word: 'soft', emoji: '🔉',
        scaleWords: SCALE_WORDS, scaleTargetIndex: 1 },
      { id: 's3', type: 'gradable_scale', word: 'cool', emoji: '🌡️',
        scaleWords: ['cold', 'cool', 'warm', 'hot'], scaleTargetIndex: 1 },
    ]);
    expect(kept.map((i) => i.id)).toEqual(['s1', 's3']);
    // The surviving asks share no answer with each other.
    const asks = kept.map((i) => spokenLine(itemCue(i)));
    expect(asks[0]).not.toContain('cool');
    expect(asks[1]).not.toContain('loud');
  });

  it('exempts ONLY receptive_match from the leak oracle, and covers its whole ask', () => {
    // receptive_match is the one mode whose ask says the target aloud and is
    // still not a leak: the tutor speaks the word, the child taps its picture.
    // Subtracting the ask keeps the oracle live over the greeting and the
    // how-to-play, so a tutor naming the target while explaining still fails.
    const receptive = pictureVocabularyHarnessAnswers(RECEPTIVE);
    expect(receptive.leakExemptSpan).toBe('Listen: dog. Your turn. Tap the dog.');
    const opening = spokenLine(itemCue(RECEPTIVE, { opening: true, howToPlay: true }));
    expect(opening.replace(receptive.leakExemptSpan!, ' ')).not.toContain('dog');

    for (const item of [NAMING, OPPOSITE, ASSOCIATION, SCALE, FRAME]) {
      expect(pictureVocabularyHarnessAnswers(item).leakExemptSpan).toBeUndefined();
    }
  });

  it('mirrors each mode\'s NAMED miss as its signature wrong', () => {
    // The contract CLAIMS the judge refuses these; this is the claim made
    // drivable. Change one, change both.
    expect(pictureVocabularyHarnessAnswers(OPPOSITE).signatureWrong?.text).toBe('big');
    expect(itemCue(OPPOSITE, {}, { modelPair })).toContain('"big" said back is NOT the answer');

    const scale = pictureVocabularyHarnessAnswers(SCALE);
    expect(SCALE.scaleWords).toContain(scale.signatureWrong?.text);
    expect(scale.signatureWrong?.text).not.toBe('cool');

    expect(pictureVocabularyHarnessAnswers(NAMING).signatureWrong?.text).toBe('a thing');
    expect(itemCue(NAMING)).toContain('true of almost anything like "a thing"');

    const frame = pictureVocabularyHarnessAnswers(FRAME);
    expect(frame.signatureWrong?.text).toBeTruthy();
    expect(frame.signatureWrong?.text).not.toBe('bed');
  });

  it('commits the ONE tap mode with a card the stage actually renders', () => {
    const answers = pictureVocabularyHarnessAnswers(RECEPTIVE);
    const words = (RECEPTIVE.options ?? []).map((o) => o.word);
    expect(answers.tapped?.correct).toBe(RECEPTIVE.word);
    expect(words).toContain(answers.tapped?.wrong);
    expect(answers.tapped?.wrong).not.toBe(RECEPTIVE.word);

    // Every spoken mode commits nothing with its hands — association included
    // since item 25, which is the harness-side proof the cards are gone.
    for (const item of [NAMING, OPPOSITE, ASSOCIATION, SCALE, FRAME]) {
      expect(pictureVocabularyHarnessAnswers(item).tapped).toBeUndefined();
    }
  });

  it('derives only STIMULUS-INDEPENDENT wrong answers for a generated association', () => {
    /**
     * ⚠️⚠️ THE INSTRUMENT MISTAKE THAT COST ITEM 24 A VERDICT. A borrowed or
     * carelessly derived probe does not fail loudly — it produces a confident,
     * well-formatted finding pointing at the WRONG COMPONENT. Three times in
     * one day on the rhyme bench the harness was wrong and the tutor was right.
     *
     * Association is more exposed than rhyme, because "is this a rationalised
     * chain or an honest unlisted partner?" cannot be answered without reading
     * the stimulus. So exactly two wrong answers are derived here, and both are
     * wrong BY DEFINITION rather than by semantics: the base said back, and a
     * nonword. Everything else lives in the hand-authored bench fixture.
     */
    const answers = pictureVocabularyHarnessAnswers(ASSOCIATION);
    expect(answers.signatureWrong?.text).toBe('sock');   // the echo — reaches the new branch
    expect(answers.plainWrong).toBe('blen');             // a nonword — cannot be an honest partner
    expect(answers.correct).toBe('shoe');                // the curated partner
    // A generated item carries NO scored key: scoring needs a human who read
    // the stimulus first.
    expect(answers).not.toHaveProperty('probes');
  });
});
