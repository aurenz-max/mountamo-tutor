import { describe, expect, it, vi } from 'vitest';

vi.mock('../geminiClient', () => ({ ai: { models: { generateContent: vi.fn() } } }));

import { buildGrammarFrameItems, hasGrammarCoverage, MODE_FRAMES } from './spokenGrammarFrames';
import { grammarSpace } from '../wordSpace/grammarSpaces';
import { articleFor } from '../wordSpace/grammarFacts';
import { lexWord } from '../wordSpace/lexicon';
import { findAnswerLeaks, gateSpokenItems, type GrammarFrameMode } from '../../primitives/visual-primitives/direct-instruction/diSpokenPracticeScript';
import { spokenPracticeKey } from '../../primitives/visual-primitives/direct-instruction/diSpokenPracticeWorkspace';
import { askLeaks } from '../../components/live-activity/spokenKey';

const TIERS = ['easy', 'medium', 'hard'] as const;

describe('grammar frame spaces', () => {
  it('keys a/an on the first sound and leaves out words whose letter and sound disagree', () => {
    for (const w of ['hour', 'unicorn', 'one']) {
      const x = lexWord(w);
      if (x) expect(articleFor(x)).toBeNull();
    }
    const space = grammarSpace('a_an', 'K');
    expect(space.some((i) => i.payload.answer === 'an')).toBe(true);
    for (const it of space) {
      const noun = it.words[0];
      expect(it.payload.answer === 'an').toBe(/^[aeiou]/.test(noun));
      expect(it.payload.emoji).toBeTruthy();
    }
  });

  it('pictures one clear person or group for a pronoun, never a child, baby or job word', () => {
    for (const f of ['he_she', 'he_she_they', 'possessive', 'subject_object'] as const) {
      for (const it of grammarSpace(f, 'K')) {
        expect(['child', 'baby', 'person', 'teacher', 'farmer'].some((w) => it.words.includes(w))).toBe(false);
      }
    }
    expect(grammarSpace('he_she', 'K').every((i) => i.payload.answer !== 'they')).toBe(true);
  });

  it('every frame has two or more answer groups with room to tier', () => {
    for (const frames of Object.values(MODE_FRAMES)) {
      for (const { frame } of frames) {
        const space = grammarSpace(frame, 'K');
        const groups = new Set(space.map((i) => i.payload.group));
        expect(groups.size, frame).toBeGreaterThanOrEqual(2);
        for (const it of space) expect(it.payload.wrong.includes(it.payload.answer), frame).toBe(false);
      }
    }
  });
});

describe('grammar frame sessions', () => {
  for (const [mode, frames] of Object.entries(MODE_FRAMES) as Array<[GrammarFrameMode, typeof MODE_FRAMES[GrammarFrameMode]]>) {
    for (const { frame } of frames) {
      for (const tier of TIERS) {
        it(`${mode} / ${frame} / ${tier}: builds, passes the gates, keeps the contrast, never says the answer unasked`, () => {
          let built = null;
          for (let seed = 1; seed < 8 && !built; seed++) built = buildGrammarFrameItems(mode, [frame], 'kindergarten', tier, 4, seed);
          expect(built, `${frame} ${tier}`).not.toBeNull();
          const { kept, reasons } = gateSpokenItems(built!);
          expect(reasons, JSON.stringify(reasons) + JSON.stringify(built!.map(i => i.ask))).toEqual({});
          expect(hasGrammarCoverage(kept, 4)).toBe(true);
          expect(findAnswerLeaks(kept)).toEqual([]);
          for (const item of kept) {
            expect(item.mode).toBe(mode);
            expect(item.stimulusEmoji).toBeTruthy();
            // Spoken-preset check: the ask says every menu word, or names no accepted answer.
            expect(askLeaks(item.ask, spokenPracticeKey(item))).toEqual([]);
            if (!item.choices) expect(tier === 'easy').toBe(false);
            // The model card: two sides of the contrast, never this sentence, never a session picture.
            const models = item.grammar!.models;
            expect(models.length, `${frame} ${item.ask}`).toBe(2);
            expect(models[0].answer).not.toBe(models[1].answer);
            for (const m of models) {
              expect(m.sentence.toLowerCase()).not.toBe(item.grammar!.sentence.replace('...', item.expectedAnswer).toLowerCase());
              expect(kept.some((i) => i.stimulusEmoji === m.emoji)).toBe(false);
            }
            expect(item.grammar!.easier?.choices?.length).toBe(2);
          }
          expect(new Set(kept.map((i) => i.stimulusEmoji + i.grammar!.sentence)).size).toBe(4);
        });
      }
    }
  }

  it('40 draws per frame and tier: every built session passes the gates and every model card is clean', () => {
    let built = 0;
    for (const [mode, frames] of Object.entries(MODE_FRAMES) as Array<[GrammarFrameMode, typeof MODE_FRAMES[GrammarFrameMode]]>) {
      for (const { frame } of frames) for (const tier of TIERS) for (let seed = 100; seed < 140; seed++) {
        const items = buildGrammarFrameItems(mode, [frame], 'K', tier, 5, seed);
        if (!items) continue;
        built++;
        expect(gateSpokenItems(items).dropped, `${frame} ${tier} ${seed}`).toEqual([]);
        for (const item of items) for (const m of item.grammar!.models) {
          expect(m.sentence.toLowerCase()).not.toBe(item.grammar!.sentence.replace('...', item.expectedAnswer).toLowerCase());
        }
      }
    }
    expect(built).toBeGreaterThan(1000);
  });

  it('mixes two frames in one session', () => {
    const built = buildGrammarFrameItems('verb_tense', ['past_regular', 'past_irregular', 'future_will'], 'K', 'medium', 6, 3);
    expect(built).not.toBeNull();
    expect(new Set(built!.map((i) => i.grammar!.frame)).size).toBe(3);
  });
});
