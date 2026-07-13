import { describe, expect, it } from 'vitest';
import type { ExhibitData } from '../../types';
import { getRemediationLabels } from './remediationTrace';

function exhibit(config: Record<string, unknown>): ExhibitData {
  return {
    topic: 'Comparing quantities',
    intro: { hook: '', objectives: [] },
    featureExhibit: null as never,
    comparison: null as never,
    cards: [],
    tables: [],
    relatedTopics: [],
    knowledgeCheck: null as never,
    manifest: {
      topic: 'Comparing quantities',
      gradeLevel: 'elementary',
      themeColor: 'blue',
      objectiveBlocks: [],
      layout: [{
        componentId: 'tape-diagram',
        instanceId: 'td-1',
        title: 'Compare',
        intent: 'Find the difference',
        config,
      }],
    },
  };
}

describe('getRemediationLabels', () => {
  it('returns the curriculum label and never the private diagnosis', () => {
    const privateText = 'The student treats the smaller quantity as the difference.';
    const labels = getRemediationLabels(exhibit({
      remediationFocus: privateText,
      remediationLabel: 'Compare quantities by finding the difference',
    }));
    expect(labels).toEqual(['Compare quantities by finding the difference']);
    expect(labels.join(' ')).not.toContain(privateText);
  });

  it('abstains when only private text is present', () => {
    expect(getRemediationLabels(exhibit({
      remediationFocus: 'Private diagnosis',
    }))).toEqual([]);
  });
});
