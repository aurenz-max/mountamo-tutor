import { describe, expect, it } from 'vitest';
import { spokenSpanOf, validateJudgedScriptPack } from '../../../hooks/judgedScriptContract';
import { STORY_RIBBON_FALLBACKS } from '../../../service/literacy/gemini-story-ribbon';
import {
  affirmFor,
  correctionFor,
  itemCue,
  itemsFromChallenges,
  modelAccountFor,
  mixedEventIds,
  moveOnCue,
  storyRibbonPack,
} from './storyRibbonScript';
import { resolveSupportStructure } from './storyRibbonSupport';

describe('story-ribbon birth contract', () => {
  const items = itemsFromChallenges(STORY_RIBBON_FALLBACKS.slice(0, 3));

  it('builds three valid connected-account items and passes the runner contract', () => {
    expect(items).toHaveLength(3);
    expect(items.every((item) => item.answerKind === 'voice')).toBe(true);
    expect(items.every((item) => item.responseClass === 'connected_account')).toBe(true);
    expect(validateJudgedScriptPack(storyRibbonPack(items))).toEqual([]);
  });

  it('starts every board away from the canonical answer order', () => {
    for (const random of [() => 0, () => 0.5, () => 0.999999]) {
      const mixed = mixedEventIds(items[0], random);
      expect(mixed).not.toEqual(items[0].challenge.events.map((event) => event.id));
      expect(new Set(mixed)).toEqual(new Set(items[0].challenge.events.map((event) => event.id)));
    }
  });

  it('keeps hidden event sentences out of the spoken ask', () => {
    const item = items[0];
    const spokenAsk = spokenSpanOf(itemCue(item, { opening: true }));
    expect(spokenAsk).toContain('Move them into story order');
    for (const event of item.challenge.events) {
      expect(spokenAsk).not.toContain(event.modelSentence);
    }
  });

  it('models all three meanings only after a failed attempt', () => {
    const item = items[0];
    const correction = correctionFor(item);
    expect(correction).toMatch(/^My turn:/);
    expect(correction).toContain('First,');
    expect(correction).toContain('Next,');
    expect(correction).toContain('Last,');
    for (const event of item.challenge.events) {
      expect(correction.toLowerCase()).toContain(event.modelSentence.toLowerCase());
    }
    expect(affirmFor()).toMatch(/^Yes,/);
  });

  it('closes a capped story with a model and opens the next task without leaking it', () => {
    const cue = moveOnCue(items[0], items[1]);
    const spoken = spokenSpanOf(cue);
    expect(spoken).toContain(modelAccountFor(items[0].challenge.events));
    for (const event of items[1].challenge.events) {
      expect(spoken).not.toContain(event.modelSentence);
    }
  });

  it('drops malformed or incomplete event ribbons', () => {
    const missing = { ...STORY_RIBBON_FALLBACKS[0], events: STORY_RIBBON_FALLBACKS[0].events.slice(0, 2) };
    const scriptedLabel = {
      ...STORY_RIBBON_FALLBACKS[1],
      events: STORY_RIBBON_FALLBACKS[1].events.map((event, index) =>
        index === 0 ? { ...event, pictureLabel: 'First Omar flew the kite.' } : event),
    };
    expect(itemsFromChallenges([missing])).toEqual([]);
    expect(itemsFromChallenges([scriptedLabel])).toEqual([]);
  });

  it('builds distinct tense-task contracts without exposing the hidden model', () => {
    const futureChallenge = {
      ...STORY_RIBBON_FALLBACKS[0],
      id: 'future-story',
      type: 'tell_future_account' as const,
      timeCue: 'Tomorrow' as const,
      events: STORY_RIBBON_FALLBACKS[0].events.map((event, index) => ({
        ...event,
        id: `future-event-${index}`,
        modelSentence: [
          'Mina will plant three seeds in soft soil.',
          'Mina will water the seeds every morning.',
          'A green sprout will push through the soil.',
        ][index],
      })),
    };
    const [future] = itemsFromChallenges([futureChallenge]);
    expect(future.mode).toBe('tell_future_account');
    expect(future.responseClass).toBe('tense_controlled_account');
    expect(spokenSpanOf(itemCue(future))).toContain('future time');
    expect(itemCue(future)).toContain('consistently use FUTURE-time language');
    expect(validateJudgedScriptPack(storyRibbonPack([future]))).toEqual([]);
    for (const event of future.challenge.events) {
      expect(spokenSpanOf(itemCue(future))).not.toContain(event.modelSentence);
    }
  });

  it('gives story-to-experience its own privacy-safe response contract', () => {
    const experienceChallenge = {
      ...STORY_RIBBON_FALLBACKS[0],
      id: 'experience-story',
      type: 'story_to_experience' as const,
      events: STORY_RIBBON_FALLBACKS[0].events.map((event, index) => ({
        ...event,
        id: `experience-event-${index}`,
      })),
    };
    const [experience] = itemsFromChallenges([experienceChallenge]);
    const cue = itemCue(experience);
    expect(experience.responseClass).toBe('story_experience_connection');
    expect(spokenSpanOf(cue)).toContain('did, saw, heard about, or imagined');
    expect(cue).toContain('Never judge whether a memory is true');
    expect(cue).toContain('Never ask for private detail');
    expect(validateJudgedScriptPack(storyRibbonPack([experience]))).toEqual([]);
  });

  it('publishes focused, turn-aware tutor context without hidden event sentences', () => {
    const context = storyRibbonPack(items).contextFor(items[1]);
    expect(context).toMatchObject({
      challengeType: 'tell_connected_account',
      storyTitle: items[1].challenge.title,
      characterName: items[1].challenge.characterName,
      setting: items[1].challenge.setting,
      timeCue: 'none',
      currentTurn: '2',
      totalTurns: '3',
    });
    const serialized = JSON.stringify(context);
    for (const event of items[1].challenge.events) {
      expect(serialized).not.toContain(event.modelSentence);
    }
  });

  it('keeps the tutor aligned with withdrawn hard-tier supports', () => {
    const hardChallenge = {
      ...STORY_RIBBON_FALLBACKS[0],
      id: 'hard-story',
      supportTier: 'hard' as const,
      support: resolveSupportStructure('tell_connected_account', 'hard'),
    };
    const [hard] = itemsFromChallenges([hardChallenge]);
    const spokenAsk = spokenSpanOf(itemCue(hard));
    expect(spokenAsk).toContain('Plan with the picture ribbon');
    expect(spokenAsk).not.toContain('First');
    expect(spokenAsk).not.toContain('Next');
    expect(spokenAsk).not.toContain('Last');

    expect(storyRibbonPack([hard]).contextFor(hard)).toMatchObject({
      supportTier: 'hard',
      showSequenceLabels: 'false',
      showFlowArrows: 'false',
      showSelfCheck: 'false',
      showConnectionFrame: 'false',
      instructionLevel: 'minimal',
    });
  });
});
