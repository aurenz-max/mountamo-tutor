'use client';

import React from 'react';
import { LuminaMathText } from '../../../../../ui';
import { DISPLAY_CSS } from '../../../../../service/agent-kit/displays';
import { KitDisplay } from '../../../../../service/agent-kit/KitDisplay';
import type { FigureBlockData } from '../types';
import BlockWrapper from './BlockWrapper';
import BlockTutorHelp from './BlockTutorHelp';

interface FigureBlockProps {
  data: FigureBlockData;
  index: number;
  onAskTutor?: (message: string) => void;
}

/** A picture the author drew or the kit drew from values, on the page as the author saw it. Ungraded. */
const FigureBlock: React.FC<FigureBlockProps> = ({ data, index, onAskTutor }) => (
  <BlockWrapper label={data.label} index={index} accent="cyan" variant="default">
    <style>{`${DISPLAY_CSS}.dd-figure .ks-svg svg{max-height:none}`}</style>
    <KitDisplay display={data.display} altText={data.altText} className="dd-figure mx-auto flex max-w-2xl justify-center" />
    {data.caption && <p className="mt-2 text-center text-xs italic text-slate-500"><LuminaMathText text={data.caption} /></p>}
    <BlockTutorHelp
      onAskTutor={onAskTutor}
      label="Talk about this with your tutor"
      message={`[FIGURE_EXPLORE] The student wants to talk about the picture${data.label ? ` ("${data.label}")` : ''}: ${data.altText}. Point out the one thing it shows best, then ask what they notice. Two or three sentences.`}
      className="mt-4"
    />
  </BlockWrapper>
);

export default FigureBlock;
