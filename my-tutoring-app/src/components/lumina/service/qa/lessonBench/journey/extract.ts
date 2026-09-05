/** Content adapters read the production cue builders. Catalog roles cannot prove instruction. */
import { itemCue as soundCue, type DiLetterSoundChallenge } from '../../../../primitives/visual-primitives/direct-instruction/diLetterSoundsScript';
import { itemCue as blendCue, canWalk, type BlendItem } from '../../../../primitives/visual-primitives/literacy/phonicsBlenderScript';
import { itemCue as wordCue, type DiWordReadingChallenge } from '../../../../primitives/visual-primitives/direct-instruction/diWordReadingScript';
import { itemsFromChallenges, itemCue as linkCue } from '../../../../primitives/visual-primitives/literacy/letterSoundLinkScript';
import type { LetterSoundChallengeLike, LetterSoundTier } from '../../../../primitives/visual-primitives/literacy/letterSoundLinkScript';
import { itemsFromChallenges as spotterItems, itemCue as spotterCue } from '../../../../primitives/visual-primitives/literacy/letterSpotterScript';
import type { LetterSpotterChallengeLike, LetterSpotterTier } from '../../../../primitives/visual-primitives/literacy/letterSpotterScript';
import { itemsFromChallenges as phonemeItems, itemCue as phonemeCue } from '../../../../primitives/visual-primitives/literacy/phonemeExplorerScript';
import type { PhonemeChallengeLike } from '../../../../primitives/visual-primitives/literacy/phonemeExplorerScript';
import type { LessonPackage } from '../lessonPackage';
import type { ExtractedLesson, InstructionEvent, LessonContract } from './types';

const lower = (s: string) => s.trim().toLowerCase();
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown): string => typeof v === 'string' ? v : '';
// V1 is deliberately restricted to unambiguous short-vowel/single-letter correspondences.
// An unknown spelling/sound needs another adapter, not a guessed teaching credit.
const canonicalSound = (s: string) => lower(s).replace(/[\/\s]/g, '').replace(/(.)\1+/g, '$1');
const sounds: Record<string, string[]> = {
  a: ['a', 'æ', 'ă'], e: ['e', 'ɛ', 'ĕ'], i: ['i', 'ɪ', 'ĭ'], o: ['o', 'ɒ', 'ɑ', 'ŏ'], u: ['u', 'ʌ', 'ŭ'],
  c: ['k'], q: ['kw'], x: ['ks'],
};
const soundMatches = (grapheme: string, sound: string) =>
  (sounds[lower(grapheme)] ?? [lower(grapheme)]).includes(canonicalSound(sound));
/** Do not include the private answer key / judging contract in the learner's observation. */
export function spokenOpening(cue: string): string {
  const match = cue.match(/(?:Speak|Say) exactly:\s*"([\s\S]*?)"/);
  if (!match) throw new Error('Production cue has no recognized spoken opening');
  return match[1];
}
export function openingModelsAnswer(opening: string, answer: string): boolean {
  const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z])${escaped}(?:$|[^a-z])`, 'i').test(opening);
}

/** The letter a tap question is ABOUT: "…starts with the sss sound" → s, "the letter 'a' makes…" → a,
 *  "Which letter starts the word goat?" → the answer letter. Null when the question is not one of those. */
export function tapQuestionTarget(question: string, answerText: string): { capability: 'onset' | 'sound-recognition'; letter: string } | null {
  const q = question.toLowerCase();
  const answer = answerText.trim().toLowerCase();
  if (/which letter (?:starts|begins)|what letter (?:do|does)|which letter (?:makes|says)/.test(q) && /^[a-z]$/.test(answer)) {
    return { capability: 'sound-recognition', letter: answer };
  }
  if (/(?:starts?|begins?|beginning) with/.test(q) && /^[a-z]/.test(answer)) {
    // The sound named in the question is the target; the answer word's initial is the same letter.
    const named = q.match(/(?:the|sound)\s+\/?([a-z])\1{0,2}\/?\s+sound|\/([a-z])[^a-z\/]*\/|\bletter\s+['"]?([a-z])['"]?/);
    const letter = (named?.[1] ?? named?.[2] ?? named?.[3] ?? answer[0]).toLowerCase();
    return { capability: 'onset', letter };
  }
  const tf = q.match(/letter\s+['"]?([a-z])['"]?\s+(?:makes|says|has)/);
  if (tf) return { capability: 'sound-recognition', letter: tf[1] };
  return null;
}

export function extractLesson(pkg: LessonPackage, contract: LessonContract): ExtractedLesson {
  const out: ExtractedLesson = { packageId: pkg.id, events: [], findings: [], unknowns: [], exposures: [] };
  const payloads = new Map(pkg.components.map((c, i) => [c.instanceId, { c, i }]));
  for (const block of pkg.manifest.layout ?? []) {
    if (block.componentId === 'curator-brief' || block.componentId === 'take-home-activity') continue;
    const found = payloads.get(block.instanceId);
    if (!found || found.c.componentId !== block.componentId || !found.c.data) {
      out.findings.push({ code: 'MISSING_PAYLOAD', layer: 'CONTENT', instanceId: block.instanceId, note: 'The selected block has no matching playable payload.' });
      continue;
    }
    const data = record(found.c.data);
    const config = record(block.config);
    const objectiveId = block.objectiveIds?.length === 1 ? block.objectiveIds[0] : null;
    const scope = objectiveId ? contract.objectiveScope?.[objectiveId] : undefined;
    const base = {
      packageId: pkg.id, instanceId: block.instanceId, componentId: block.componentId,
      objectiveId, skillId: text(config.skillId) || scope?.skillId,
      subskillId: text(config.subskillId) || scope?.subskillId,
      reader: 'none' as const, feedback: true,
    };
    const add = (event: Omit<InstructionEvent, keyof typeof base>) => {
      const full = { ...base, ...event };
      const allowed = new Set(contract.allowedGraphemes.map(lower));
      const outside = event.graphemes.filter((g) => !allowed.has(lower(g)));
      if (outside.length) out.findings.push({ code: 'OUT_OF_SCOPE', layer: 'CONTENT', instanceId: block.instanceId, source: event.source, note: `Untaught/out-of-contract graphemes: ${outside.join(', ')}` });
      out.events.push(full);
    };
    try {
      const source = `/components/${found.i}/data`;
      if (block.componentId === 'di-letter-sounds') {
        if (!Array.isArray(data.challenges) || !data.challenges.length) throw new Error('No challenges');
        data.challenges.forEach((raw, i) => {
          const it = raw as DiLetterSoundChallenge;
          if (!it.id || !it.letter || !it.spoken || !it.keyword || !['letter_sound', 'letter_sound_review', 'first_sound_in_word'].includes(it.challengeType)) throw new Error(`Malformed challenge ${i}`);
          if (!['isolated', 'keyword'].includes(it.elicitation) || !soundMatches(it.letter, it.spoken)) throw new Error(`Challenge ${i}: sound/letter contract mismatch`);
          // Keyword elicitation asks the child to repeat the WORD, not produce a phoneme.
          const capability = it.elicitation === 'keyword' ? 'keyword' : it.challengeType === 'first_sound_in_word' ? 'onset' : 'sound-production';
          const cue = spokenOpening(soundCue(it, i === 0));
          add({ itemId: it.id, evalMode: it.challengeType, capability,
            target: lower(capability === 'keyword' ? it.keyword : it.letter), graphemes: [lower(it.letter)],
            cue, source: `${source}/challenges/${i}`,
            modality: 'spoken', modeled: openingModelsAnswer(cue, it.elicitation === 'keyword' ? it.keyword : it.spoken),
            guided: /Together[,:]/i.test(cue), explainsRelation: it.elicitation !== 'keyword',
          });
        });
      } else if (block.componentId === 'phonics-blender') {
        if (!Array.isArray(data.words) || !data.words.length) throw new Error('No words');
        data.words.forEach((raw, i) => {
          const it = raw as BlendItem;
          if (!it.id || !it.targetWord || !Array.isArray(it.phonemes) || !it.phonemes.length || it.phonemes.some((p) => !p.letters || !p.sound)) throw new Error(`Malformed word ${i}`);
          if (lower(it.phonemes.map((p) => p.letters).join('')) !== lower(it.targetWord)) throw new Error(`Word ${i}: graphemes disagree with targetWord`);
          if (!/^[a-z][aeiou][a-z]$/.test(lower(it.targetWord)) || it.phonemes.some((p) => !soundMatches(p.letters, p.sound))) throw new Error(`Word ${i}: outside the verified CVC sound adapter`);
          const nameSounds = data.nameTargetPhonemes !== false;
          const cue = spokenOpening(blendCue(it, { nameSounds, opening: i === 0, howToPlay: true }));
          add({ itemId: it.id, evalMode: text(config.targetEvalMode) || 'mixed', capability: 'decode',
            target: lower(it.targetWord), graphemes: it.phonemes.map((p) => lower(p.letters)),
            cue, source: `${source}/words/${i}`,
            modality: 'spoken', modeled: openingModelsAnswer(cue, it.targetWord), guided: /Together[,:]/i.test(cue), explainsRelation: nameSounds && canWalk(it),
          });
        });
      } else if (block.componentId === 'di-word-reading') {
        if (!Array.isArray(data.challenges) || !data.challenges.length) throw new Error('No challenges');
        data.challenges.forEach((raw, i) => {
          const it = raw as DiWordReadingChallenge;
          if (!it.id || !it.word || it.wordType !== 'cvc' || !it.graphemes?.length) throw new Error(`Word ${i}: only explicit CVC grapheme sequences are supported by this adapter`);
          if (lower(it.graphemes.join('')) !== lower(it.word)) throw new Error(`Word ${i}: graphemes disagree with word`);
          const cue = spokenOpening(wordCue(it, i === 0));
          add({ itemId: it.id, evalMode: it.challengeType, capability: 'decode', target: lower(it.word), graphemes: it.graphemes.map(lower),
            cue, source: `${source}/challenges/${i}`,
            modality: 'spoken', modeled: openingModelsAnswer(cue, it.word), guided: /Together[,:]/i.test(cue), explainsRelation: true });
        });
      } else if (block.componentId === 'letter-sound-link') {
        if (!Array.isArray(data.challenges) || !data.challenges.length) throw new Error('No challenges');
        const items = itemsFromChallenges(data.challenges as LetterSoundChallengeLike[], (data.supportTier ?? 'medium') as LetterSoundTier);
        if (items.length !== data.challenges.length) throw new Error('Production adapter filtered/retargeted challenges; inspect source mapping before certifying');
        items.forEach((it, i) => {
          const capability = it.mode === 'see-hear' ? 'sound-production' : it.mode === 'hear-see' ? 'sound-recognition' : 'keyword';
          const cue = spokenOpening(linkCue(it));
          add({ itemId: it.id, evalMode: it.mode, capability, target: lower(capability === 'keyword' ? it.answer : it.letter), graphemes: [lower(it.letter)],
            cue, source: `${source}/challenges/${i}`,
            modality: it.mode === 'hear-see' ? 'tap' : 'spoken', modeled: it.mode === 'see-hear' ? openingModelsAnswer(cue, it.spoken) : it.mode === 'keyword-match' && openingModelsAnswer(cue, it.answer),
            guided: /Together[,:]/i.test(cue), explainsRelation: it.mode !== 'keyword-match' });
        });
      } else if (block.componentId === 'letter-spotter') {
        if (!Array.isArray(data.challenges) || !data.challenges.length) throw new Error('No challenges');
        const items = spotterItems(data.challenges as LetterSpotterChallengeLike[], (data.supportTier ?? 'medium') as LetterSpotterTier);
        if (!items.length) throw new Error('Production adapter kept no items');
        items.forEach((it, i) => {
          // find-it / match-it: a letterFORM by tap. name-it: the letter NAME, spoken. Neither is a sound.
          const spoken = it.mode === 'name-it';
          const cue = spokenOpening(spotterCue(it, { opening: i === 0, howToPlay: i === 0 }));
          add({ itemId: it.id, evalMode: it.mode, capability: spoken ? 'letter-name' : 'letter-recognition', target: lower(it.targetLetter), graphemes: [lower(it.targetLetter)],
            cue, source: `${source}/challenges/${i}`, modality: spoken ? 'spoken' : 'tap',
            modeled: spoken ? openingModelsAnswer(cue, it.targetLetter) : false, guided: /Together[,:]/i.test(cue), explainsRelation: false });
        });
      } else if (block.componentId === 'phoneme-explorer') {
        if (!Array.isArray(data.challenges) || !data.challenges.length) throw new Error('No challenges');
        const items = phonemeItems(data.challenges as PhonemeChallengeLike[]);
        if (!items.length) throw new Error('Production adapter kept no items');
        items.forEach((it, i) => {
          if (it.kind !== 'isolate' || !it.phoneme) throw new Error(`Item ${i}: only the isolate kind is adapted`);
          // Hear a sound, say the menu word that starts with it: onset, spoken, closed set.
          const letter = lower(it.phoneme).replace(/[^a-z]/g, '').slice(0, 1);
          if (!letter) throw new Error(`Item ${i}: phoneme is not a single letter`);
          const cue = spokenOpening(phonemeCue(it, { opening: i === 0, howToPlay: i === 0 }));
          add({ itemId: it.id, evalMode: it.kind, capability: 'onset', target: letter, graphemes: [letter],
            cue, source: `${source}/challenges/${i}`, modality: 'spoken',
            modeled: openingModelsAnswer(cue, it.answer), guided: false, explainsRelation: false });
        });
      } else if (block.componentId === 'knowledge-check') {
        if (!Array.isArray(data.problems) || !data.problems.length) throw new Error('No problems');
        data.problems.forEach((raw, i) => {
          const p = record(raw);
          const id = text(p.id) || `p${i + 1}`;
          if (p.type === 'multiple_choice') {
            const options = Array.isArray(p.options) ? p.options.map(record) : [];
            const answer = options.find((o) => o.id === p.correctOptionId);
            const answerText = text(answer?.text);
            const target = tapQuestionTarget(text(p.question), answerText);
            if (!target) throw new Error(`Problem ${i}: not a letter-sound question this adapter can read`);
            // At K the tutor reads the question and the options; the answer word is among them.
            const cue = `${text(p.question)} ${options.map((o) => text(o.text)).filter(Boolean).join(', ')}`.trim();
            add({ itemId: id, evalMode: 'multiple_choice', capability: target.capability, target: target.letter, graphemes: [target.letter],
              cue, source: `${source}/problems/${i}`, modality: 'tap', modeled: false, guided: false, explainsRelation: false });
          } else if (p.type === 'true_false') {
            const target = tapQuestionTarget(text(p.statement), 'x');
            if (!target) throw new Error(`Problem ${i}: not a letter-sound statement this adapter can read`);
            add({ itemId: id, evalMode: 'true_false', capability: target.capability, target: target.letter, graphemes: [target.letter],
              cue: text(p.statement), source: `${source}/problems/${i}`, modality: 'tap', modeled: false, guided: false, explainsRelation: false });
          } else throw new Error(`Problem ${i}: ${text(p.type) || 'unknown'} problems are not adapted`);
        });
      } else if (block.componentId === 'fast-fact') {
        if (!Array.isArray(data.challenges) || !data.challenges.length) throw new Error('No challenges');
        data.challenges.forEach((raw, i) => {
          const c = record(raw);
          const prompt = record(c.prompt);
          const question = text(prompt.text);
          const answerText = text(c.correctAnswer);
          const target = tapQuestionTarget(question, answerText);
          if (!target || c.responseMode !== 'choice') throw new Error(`Challenge ${i}: not a choice letter-sound question this adapter can read`);
          const options = Array.isArray(c.options) ? c.options.map((o) => text(o)) : [];
          add({ itemId: text(c.id) || `c${i + 1}`, evalMode: text(c.challengeType) || 'recall', capability: target.capability, target: target.letter, graphemes: [target.letter],
            cue: `${question} ${options.join(', ')}`.trim(), source: `${source}/challenges/${i}`, modality: 'tap', modeled: false, guided: false, explainsRelation: false });
        });
      } else if (block.componentId === 'concept-card-grid') {
        const cards = Array.isArray(data.cards) ? data.cards.length : 0;
        if (!cards) throw new Error('No cards');
        out.exposures.push({ code: 'EXPOSURE_ONLY', layer: 'EVIDENCE', instanceId: block.instanceId, source,
          note: `concept-card-grid: ${cards} card(s) shown; nothing is asked of the child, so nothing is credited.` });
      } else {
        out.unknowns.push({ code: 'NO_CONTENT_ADAPTER', layer: 'EVIDENCE', instanceId: block.instanceId, source,
          note: `${block.componentId}: no content/interaction adapter; its catalog role earns no learning credit.` });
      }
    } catch (error) {
      // A partly parsed block must not award credit for its valid prefix.
      out.events = out.events.filter((e) => e.instanceId !== block.instanceId);
      out.unknowns.push({ code: 'UNSUPPORTED_CONTENT', layer: 'CONTENT', instanceId: block.instanceId,
        note: error instanceof Error ? error.message : String(error) });
    }
  }
  return out;
}
