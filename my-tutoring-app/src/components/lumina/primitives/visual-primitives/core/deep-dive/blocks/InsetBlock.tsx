'use client';

import React from 'react';
import { LuminaMathText } from '../../../../../ui';
import { ChartInsetRenderer } from '../../../../problem-primitives/insets/ChartInsetRenderer';
import { NumberLineInsetRenderer } from '../../../../problem-primitives/insets/NumberLineInsetRenderer';
import { DefinitionBoxInsetRenderer } from '../../../../problem-primitives/insets/DefinitionBoxInsetRenderer';
import { PassageInsetRenderer } from '../../../../problem-primitives/insets/PassageInsetRenderer';
import type { ChartBlockData, DefinitionBlockData, NumberLineBlockData, PassageBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import BlockTutorHelp from './BlockTutorHelp';

type InsetBlockData = ChartBlockData | NumberLineBlockData | DefinitionBlockData | PassageBlockData;

interface InsetBlockProps {
  data: InsetBlockData;
  index: number;
  onAskTutor?: (message: string) => void;
}

/** What the tutor is told when the learner asks about the block: everything on it, since nothing on it is graded. */
function tutorMessage(data: InsetBlockData): string {
  const about = data.label ? ` ("${data.label}")` : '';
  switch (data.blockType) {
    case 'chart': {
      const c = data.inset;
      return `[CHART_EXPLORE] The student wants to talk about the ${c.chartType} chart${about} "${c.title}": ${c.data.map((d) => `${d.label} ${d.value}`).join(', ')}${c.yLabel ? ` (${c.yLabel})` : ''}. Point out the one thing the shape of the data shows, then ask what they notice. Two or three sentences.`;
    }
    case 'number-line': {
      const n = data.inset;
      const marks = (n.points ?? []).map((p) => `${p.label} at ${p.value}`).join(', ');
      return `[NUMBER_LINE_EXPLORE] The student wants to talk about the number line${about} from ${n.min} to ${n.max}${marks ? ` with ${marks}` : ''}${n.region ? `, shading ${n.region.from} to ${n.region.to}` : ''}. Say what the positions show, then ask one quick question about where something sits. Two or three sentences.`;
    }
    case 'definition':
      return `[DEFINITION_EXPLORE] The student wants to talk about the word "${data.inset.term}": ${data.inset.definition}. Give one everyday example of it, then ask them to think of their own. Two sentences.`;
    case 'passage':
      return `[PASSAGE_EXPLORE] The student wants to talk about this text${data.inset.attribution ? ` by ${data.inset.attribution}` : ''}: "${data.inset.text.slice(0, 700)}". Say in one sentence what it is about in plain words, then ask what stood out to them.`;
  }
}

const ACCENT = { chart: 'cyan', 'number-line': 'blue', definition: 'purple', passage: 'amber' } as const;

/** A display block drawn by a knowledge-check inset renderer: chart, number line, definition or passage. */
const InsetBlock: React.FC<InsetBlockProps> = ({ data, index, onAskTutor }) => (
  <BlockWrapper label={data.label} index={index} accent={ACCENT[data.blockType]} variant={data.blockType === 'definition' ? 'compact' : 'default'}>
    {data.blockType === 'passage' && data.intro && (
      <p className="mb-3 text-sm text-slate-400"><LuminaMathText text={data.intro} /></p>
    )}
    <div data-deep-dive-inset={data.blockType}>
      {data.blockType === 'chart' && <ChartInsetRenderer data={data.inset} />}
      {data.blockType === 'number-line' && <NumberLineInsetRenderer data={data.inset} />}
      {data.blockType === 'definition' && <DefinitionBoxInsetRenderer data={data.inset} />}
      {data.blockType === 'passage' && <PassageInsetRenderer data={data.inset} />}
    </div>
    {(data.blockType === 'chart' || data.blockType === 'number-line') && data.caption && (
      <p className="mt-2 text-xs italic text-slate-500"><LuminaMathText text={data.caption} /></p>
    )}
    <BlockTutorHelp onAskTutor={onAskTutor} label="Talk about this with your tutor" message={tutorMessage(data)} className="mt-4" />
  </BlockWrapper>
);

export default InsetBlock;
