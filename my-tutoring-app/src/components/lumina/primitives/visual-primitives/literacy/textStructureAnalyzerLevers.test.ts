import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import { ALL_STRUCTURE_TYPES, askFor, askIsAnswerFree, countConnectives, isStructureType, passageNamesStructure,
  structureDistance, STRUCTURE_LABEL, wordBoundedIndexOf, type TextStructureItem } from './textStructureAnalyzerScript';
import { textStructureItems, textStructureSpokenMisses } from './textStructureAnalyzerWorkspace';
import { anchorFor, linkModelFor, shortLinkFor, sourceFor, sourceLeak, startingLevers, structureModelFor,
  structurePracticeFor, textStructureLevers, twoPartFor, type TsaSession } from './textStructureAnalyzerLevers';
import { LINK_MODELS, MINI_PASSAGES, structuresForGrade } from './textStructureModels';

const DIR = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
const PAYLOADS = readdirSync(DIR).filter(f => f.startsWith('text-structure-analyzer.')).map(f => {
  const data = JSON.parse(readFileSync(join(DIR, f), 'utf-8')).data;
  const b = textStructureItems(data, 'tsa');
  const session: TsaSession = { passage: data.passage, sentences: b.sentences, items: b.items, spares: b.spares,
    grade: Number(String(data.gradeLevel).replace(/[^0-9]/g, '')) || 4,
    structure: isStructureType(data.structureType) ? data.structureType : null, hasAnchor: !!data.anchorIdeaId };
  return { file: f, mode: JSON.parse(readFileSync(join(DIR, f), 'utf-8')).evalMode as string, session };
});
const free = (item: TextStructureItem) => askIsAnswerFree(askFor(item), item.answer, item.choices.length ? item.choices.join(', ') : undefined);

describe('the pool', () => {
  it('every link model has exactly one linking word, the one it names', () => {
    for (const m of LINK_MODELS) {
      expect(countConnectives(m.sentence), m.sentence).toBe(1);
      expect(wordBoundedIndexOf(m.sentence.toLowerCase(), m.word)).toBeGreaterThanOrEqual(0);
    }
  });
  it('no mini passage prints a word of any structure name (R6), and every listed signal is in it', () => {
    for (const p of MINI_PASSAGES) {
      for (const k of ALL_STRUCTURE_TYPES) expect(passageNamesStructure(p.text, k), `${p.text} / ${k}`).toBe(false);
      for (const sig of p.signals) expect(p.text).toContain(sig);
    }
    for (const k of ALL_STRUCTURE_TYPES) expect(MINI_PASSAGES.filter(p => p.structure === k).length).toBeGreaterThanOrEqual(2);
  });
});

describe.each(PAYLOADS.map(p => [p.file, p] as const))('%s', (_f, { session: s }) => {
  it('has items', () => expect(s.items.length).toBeGreaterThan(0));
  it.each(s.items.map(i => [i.id, i] as const))('%s: levers are leak-free and answer the misses they can', (_id, item) => {
    const levers = textStructureLevers(item, s, []);
    const ids = levers.map(l => l.id);
    if (item.action === 'find-signal') {
      expect(ids.includes('focus_sentence')).toBe(!item.showFocusSentence);
      const m = linkModelFor(item, s);
      expect(m).not.toBeNull();
      expect(wordBoundedIndexOf(s.passage.toLowerCase(), m!.word)).toBe(-1);
      const p = shortLinkFor(item, s)!;
      expect(p).not.toBeNull();
      expect(p.answer).not.toBe(m!.word);
      expect(p.onCard).toBe(true);
      expect(wordBoundedIndexOf(s.passage.toLowerCase(), p.answer)).toBe(-1);
      expect(free(p)).toBe(true);
    }
    if (item.action === 'name-structure') {
      const answer = (Object.keys(STRUCTURE_LABEL) as Array<keyof typeof STRUCTURE_LABEL>).find(k => STRUCTURE_LABEL[k] === item.answer)!;
      const model = structureModelFor(item, s), practice = structurePracticeFor(item, s);
      if (item.choices.length < 3 || s.grade <= 2) {
        // Grade 2 decision: a two-option menu answers by elimination, so no model and no practice.
        expect(model).toBeNull(); expect(practice).toBeNull();
      } else {
        expect(model).not.toBeNull();
        expect(model!.structure).not.toBe(answer);
        expect(structuresForGrade(s.grade)).toContain(model!.structure);
        expect(practice).not.toBeNull();
        expect(practice!.item.choices).toHaveLength(2);
        expect(practice!.item.choices).toContain(practice!.item.answer);
        expect(practice!.item.answer).not.toBe(item.answer);
        expect(practice!.text).not.toBe(model!.text);
        const [a, b] = practice!.item.choices.map(l => (Object.keys(STRUCTURE_LABEL) as Array<keyof typeof STRUCTURE_LABEL>).find(k => STRUCTURE_LABEL[k] === l)!);
        expect(structureDistance(a, b)).toBeGreaterThanOrEqual(2);
      }
      expect(ids.includes('say_choices')).toBe(!item.namesChoices);
    }
    if (item.action === 'place-idea') {
      const anchor = anchorFor(item, s);
      if (anchor) {
        expect(s.items.map(i => i.stimulusText)).not.toContain(anchor.text);
        expect(item.choices).toContain(anchor.region);
      }
      const src = sourceFor(item, s);
      if (src) expect(sourceLeak(item, src)).toBe(false);
      const two = twoPartFor(item, s);
      if (item.choices.length === 2) expect(two).toBeNull();
      if (two) {
        expect(two.choices).toHaveLength(2);
        expect(two.choices).toContain(two.answer);
        expect(s.items.map(i => i.stimulusText)).not.toContain(two.stimulusText);
        expect(two.stimulusText).not.toBe(anchor?.text);
      }
    }
    const misses = textStructureSpokenMisses(item, { signals: s.items.filter(i => i.action === 'find-signal').map(i => i.answer) });
    for (const miss of misses) {
      const fits = levers.filter(l => l.answers?.includes(miss.id));
      if (item.action === 'name-structure' && (item.choices.length < 3 || s.grade <= 2)) {
        expect(fits.filter(l => l.id !== 'say_choices')).toEqual([]); continue;
      }
      if (item.action === 'place-idea' && !fits.length) continue; // anchor and source refuse when nothing safe exists
      expect(fits.length, miss.id).toBeGreaterThan(0);
      expect(levers.find(l => l.id === nextLever(levers, miss.id))?.kind, miss.id).toBe('help');
    }
  });
});

describe('catalog and tiers', () => {
  it('declares levers; every mode miss is answered by a lever on a saved payload of that mode', () => {
    const tw = getComponentById('text-structure-analyzer')!.teachingWorkspace!;
    expect(tw.levers).toBe(true);
    for (const [mode, misses] of Object.entries(tw.misses!)) {
      const answered = new Set(PAYLOADS.filter(p => p.mode === mode).flatMap(p => p.session.items
        .flatMap(i => textStructureLevers(i, p.session, []).flatMap(l => l.answers ?? []))));
      for (const m of misses) expect(answered.has(m), `${mode} ${m}`).toBe(true);
    }
  });
  it('the tier sets the starting positions only', () => {
    expect(startingLevers('easy')).toEqual(['focus_sentence', 'say_choices', 'anchor_idea']);
    expect(startingLevers('medium')).toEqual(['focus_sentence', 'say_choices']);
    expect(startingLevers(undefined)).toEqual(['focus_sentence', 'say_choices']);
    expect(startingLevers('hard')).toEqual([]);
  });
});
