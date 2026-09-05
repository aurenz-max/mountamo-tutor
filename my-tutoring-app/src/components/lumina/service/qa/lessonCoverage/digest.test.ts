import { describe, expect, it } from 'vitest';
import { buildLessonDigest, renderDigest } from './digest';
import { makeExhibit } from './fixtures';

/**
 * Regression for the 2026-09-05 /lesson-coverage finding: `media-player`'s
 * per-segment `knowledgeCheck` (its actual assessment content) was folded into
 * the generic `fields` blob and truncated at 700 chars, so a judge only ever
 * saw the FIRST segment's item and falsely flagged later segments' shapes as
 * "never assessed" — they were assessed, just invisible past the cutoff.
 * `segments` must itemize like `challenges`/`problems` so every segment gets
 * its own citable evidence id and survives truncation independently.
 */
describe('digest — media-player segments are itemized', () => {
  const exhibit = makeExhibit({
    topic: 'shapes',
    objectives: [{ id: 'obj1', text: 'Find shapes hidden in real-world objects', verb: 'apply' }],
    blocks: [
      {
        instanceId: 'obj1-media-shape-hunt',
        componentId: 'media-player',
        title: 'Shape Hunt',
        intent: 'Narrate a shape-hunt story',
        objectiveIds: ['obj1'],
        targetEvalMode: 'listen_and_look',
        data: {
          title: 'Secret Shapes',
          segments: [
            { title: 'Round Clock', script: 'a'.repeat(300), knowledgeCheck: { question: 'What shape is the clock?', options: ['Circle', 'Square'], correctOptionIndex: 0 } },
            { title: 'Square Window', script: 'b'.repeat(300), knowledgeCheck: { question: 'What shape is the window?', options: ['Circle', 'Square'], correctOptionIndex: 1 } },
            { title: 'Triangle Pizza', script: 'c'.repeat(300), knowledgeCheck: { question: 'What shape is the pizza?', options: ['Triangle', 'Square'], correctOptionIndex: 0 } },
          ],
        },
      },
    ],
  });

  const digest = buildLessonDigest(exhibit);
  const block = digest.blocks.find((b) => b.instanceId === 'obj1-media-shape-hunt')!;

  it('produces one citable item per segment, not a single truncated fields blob', () => {
    expect(block.items.map((i) => i.id)).toEqual([
      'obj1-media-shape-hunt#segments[0]',
      'obj1-media-shape-hunt#segments[1]',
      'obj1-media-shape-hunt#segments[2]',
    ]);
  });

  it('keeps each segment\'s own knowledgeCheck question readable in its item text', () => {
    expect(block.items[0].text).toContain('What shape is the clock?');
    expect(block.items[1].text).toContain('What shape is the window?');
    expect(block.items[2].text).toContain('What shape is the pizza?');
  });

  it('carries all three segment ids into evidenceIds, so a judge can cite any of them', () => {
    expect(digest.evidenceIds).toEqual(expect.arrayContaining(block.items.map((i) => i.id)));
  });

  it('renders every segment\'s question in the text the judge reads', () => {
    const text = renderDigest(digest);
    expect(text).toContain('What shape is the clock?');
    expect(text).toContain('What shape is the window?');
    expect(text).toContain('What shape is the pizza?');
  });
});
