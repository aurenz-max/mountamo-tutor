/**
 * rhyme-studio's levers (`/add-support-tiers`, handoff 22 L2): the model pool never uses a session word or
 * family, practice items stay in the mode and off the session, every lever has a shown carrier, and every miss
 * a lever lists is one the catalog declares.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import { itemFromChallenge, itemsFromChallenge, pickModelRhymePair, rhymeSessionWords, type RhymeItem } from './rhymeStudioScript';
import { K_RHYME_FAMILIES, MODEL_RHYME_SETS, PRACTICE_EXTRA_FAMILIES, pickModelRhymeSet, rimeOfWord, sessionWords } from './rhymeModels';
import {
  RHYME_MISSES, contrastModelFor, leversOnScreen, modelLeak, onsetCardsFor, practiceItemFor, practiceLeak,
  rhymeStudioLevers, swapModelFor, usedOnsets,
} from './rhymeStudioLevers';

const PAYLOADS = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const payload = (mode: string): RhymeItem[] =>
  JSON.parse(readFileSync(join(PAYLOADS, `rhyme-studio.${mode}.json`), 'utf8')).data.challenges.flatMap((c: never) => itemsFromChallenge(c));
const rec = (id: string, t: string, c: string, fam: string, doesRhyme: boolean) =>
  itemFromChallenge({ id, mode: 'recognition', targetWord: t, rhymeFamily: fam, comparisonWord: c, doesRhyme });
const open = (id: string, mode: 'production' | 'collection', t: string, fam: string) =>
  itemsFromChallenge({ id, mode, targetWord: t, rhymeFamily: fam });
/** Every practice family in use: a session no practice item can serve. */
const everyFamily = [...K_RHYME_FAMILIES, ...PRACTICE_EXTRA_FAMILIES].map((f, i) => rec(`k${i}`, f.words[0][0], f.words[1][0], f.family, true));

describe('the model pool', () => {
  it.each([['cake', 'ake'], ['tree', 'ee'], ['whale', 'ail'], ['star', 'ar'], ['frog', 'og'], ['ox', 'ox']])('%s rhymes on %s', (w, r) => {
    expect(rimeOfWord(w)).toBe(r);
  });

  it('every model set: pictured, its words rhyme, its foil starts like the anchor and ends apart', () => {
    for (const m of MODEL_RHYME_SETS) {
      for (const w of [...m.words, m.onsetFoil]) expect(w.emoji).toBeTruthy();
      for (const w of m.words) expect(rimeOfWord(w.word)).toBe(m.rime);
      expect(m.onsetFoil.word[0]).toBe(m.words[0].word[0]);
      expect(rimeOfWord(m.onsetFoil.word)).not.toBe(m.rime);
      if (m.swap) expect(new Set(m.words.slice(0, 3).map(w => w.word.slice(0, -m.rime.length))).size).toBe(3);
    }
  });

  it('no model family is a K item or practice family, so a K session always has a model', () => {
    const k = new Set([...K_RHYME_FAMILIES, ...PRACTICE_EXTRA_FAMILIES].map(f => rimeOfWord(`x${f.family.slice(1)}`)));
    for (const f of PRACTICE_EXTRA_FAMILIES) for (const [w] of f.words) expect(rimeOfWord(w)).toBe(rimeOfWord(`x${f.family.slice(1)}`));
    for (const m of MODEL_RHYME_SETS) expect(k.has(m.rime)).toBe(false);
    expect(pickModelRhymeSet(rhymeSessionWords(everyFamily))).not.toBeNull();
  });

  it('excludes a session family spelled another way, and never falls back to a used one', () => {
    const used = sessionWords(['whale', 'bee', 'car', 'snake', 'moon', 'sock', 'king', 'goat', 'fish']);
    expect(pickModelRhymeSet(used)).toBeNull();
    // The retired runner's opening line keeps its fixed pair; the levers get null.
    expect(pickModelRhymePair([rec('r', 'sock', 'rock', '-ock', true)]).pair).toEqual(['bee', 'tree']);
  });
});

describe.each(['recognition', 'identification'])('saved payload: %s', mode => {
  const items = payload(mode);
  it('the contrast model uses no session word or ending', () => {
    const model = contrastModelFor(items)!;
    expect(model).toBeTruthy();
    expect(modelLeak(model, items)).toBe(false);
  });

  it('every practice item keeps the mode and uses no session word or ending', () => {
    for (const item of items) {
      const practice = practiceItemFor(item, items)!;
      expect(practice).toBeTruthy();
      expect(practiceLeak(practice, item, items)).toBe(false);
      expect(practice.id).toBe(`${item.id}~simpler`);
      if (mode === 'identification') {
        expect(practice.choices).toHaveLength(2);
        const [answer, foil] = [practice.choices.find(c => c.isCorrect)!, practice.choices.find(c => !c.isCorrect)!];
        expect(rimeOfWord(answer.word)).toBe(practice.rime);
        expect(foil.word[0]).not.toBe(practice.targetWord[0]);
        expect(rimeOfWord(foil.word)).not.toBe(practice.rime);
        for (const c of practice.choices) expect(c.emoji).toBeTruthy();
      } else {
        expect(practice.comparisonEmoji).toBeTruthy();
        expect(rimeOfWord(practice.comparisonWord!) === practice.rime).toBe(practice.doesRhyme);
      }
    }
  });

  it('the pulled-lever fact names model words only', () => {
    const fact = leversOnScreen(items[0], ['contrast_model'], items)!;
    const session = rhymeSessionWords(items).words;
    expect(Array.from(session).some(w => new RegExp(`\\b${w}\\b`).test(fact))).toBe(false);
  });
});

describe('practice verdicts are not the item\'s', () => {
  it('recognition practice rhymes on some ids and not on others', () => {
    const items = [rec('a', 'cat', 'hat', '-at', true), rec('b', 'pig', 'pot', '-ig', false)];
    const verdicts = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(id => practiceItemFor({ ...items[0], id }, items)!.doesRhyme));
    expect(verdicts).toEqual(new Set([true, false]));
  });

  it('no free family: no practice item and no simplify lever', () => {
    expect(practiceItemFor(everyFamily[0], everyFamily)).toBeNull();
    expect(rhymeStudioLevers(everyFamily[0], [], everyFamily).map(l => l.id)).toEqual(['contrast_model']);
  });
});

describe('production and collection', () => {
  const items = [...open('p', 'production', 'bed', '-ed'), ...open('c', 'collection', 'hat', '-at')];
  it('the onset strip never offers the target\'s first sound; a collection greys what it used', () => {
    expect(onsetCardsFor(items[0]).map(c => c.sound)).not.toContain('b');
    expect(onsetCardsFor(items[1]).map(c => c.sound)).not.toContain('h');
    expect(onsetCardsFor(items[0])).toHaveLength(6);
    expect(Array.from(usedOnsets(['mat', 'bat']))).toEqual(['m', 'b']);
  });

  it('the swap model changes one first sound on a family the session does not use', () => {
    const model = swapModelFor(items)!;
    expect(model.swap).toBe(true);
    expect(modelLeak(model, items)).toBe(false);
  });

  it('practice is open production on a free family; collection practises production', () => {
    for (const item of items) {
      const practice = practiceItemFor(item, items)!;
      expect(practice).toMatchObject({ mode: 'production', choices: [] });
      expect(practiceLeak(practice, item, items)).toBe(false);
      expect(practice.targetEmoji).toBeTruthy();
    }
  });
});

describe('levers, carriers and misses', () => {
  const entry = LITERACY_CATALOG.find(c => c.id === 'rhyme-studio')!.teachingWorkspace!;
  const items = [...payload('recognition'), ...payload('identification'), ...open('p', 'production', 'bed', '-ed'),
    ...open('c', 'collection', 'hat', '-at')];
  const hard = { ...payload('identification')[0], namesChoices: false };

  it('every lever is shown and voiced (K counts it), and answers only misses its mode declares', () => {
    for (const item of [...items, hard]) {
      for (const lever of rhymeStudioLevers(item, [], items)) {
        expect(lever.carrier).toBe('both');
        for (const miss of lever.answers ?? []) expect(entry.misses![item.mode]).toContain(miss);
      }
    }
    for (const mode of Object.keys(RHYME_MISSES) as Array<keyof typeof RHYME_MISSES>) {
      expect(entry.misses![mode]).toEqual(RHYME_MISSES[mode]);
      // No spoken miss is emitted yet (handoff 20 Part B): each is listed unanswered for J9.
      expect(entry.unanswered![mode]).toEqual(RHYME_MISSES[mode]);
    }
    expect(entry.levers).toBe(true);
  });

  it('name_choices only where the tier withdrew the read-aloud', () => {
    expect(rhymeStudioLevers(payload('identification')[0], [], items).map(l => l.id)).not.toContain('name_choices');
    expect(rhymeStudioLevers(hard, [], items).map(l => l.id)).toContain('name_choices');
  });

  it('with no miss the ladder goes help first; a named miss picks the lever that answers it', () => {
    const recognition = payload('recognition')[0];
    expect(nextLever(rhymeStudioLevers(recognition, [], items), undefined)).toBe('contrast_model');
    expect(nextLever(rhymeStudioLevers(recognition, ['contrast_model'], items), 'no_to_rhyme')).toBe('far_pair');
    expect(nextLever(rhymeStudioLevers(items.find(i => i.mode === 'production')!, [], items), 'nonword')).toBe('onset_strip');
    expect(nextLever(rhymeStudioLevers(items.find(i => i.mode === 'production')!, [], items), 'echo_target')).toBe('onset_swap_model');
  });
});
