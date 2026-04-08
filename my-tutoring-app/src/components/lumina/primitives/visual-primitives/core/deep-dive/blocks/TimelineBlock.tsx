'use client';

import React from 'react';
import type { TimelineBlockData } from '../types';
import BlockWrapper from './BlockWrapper';

interface TimelineBlockProps {
  data: TimelineBlockData;
  index: number;
}

const TimelineBlock: React.FC<TimelineBlockProps> = ({ data, index }) => {
  const { events, label } = data;

  return (
    <BlockWrapper label={label} index={index} accent="rose" variant="default">
      <div className="relative">
        {/* Central timeline line */}
        <div className="absolute left-[calc(50%-0.5px)] top-0 bottom-0 w-px bg-gradient-to-b from-rose-400/40 via-rose-400/20 to-transparent hidden md:block" />
        {/* Mobile: left-aligned line */}
        <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-rose-400/40 via-rose-400/20 to-transparent md:hidden" />

        <div className="space-y-6">
          {events.map((event, i) => {
            const isLeft = i % 2 === 0;

            return (
              <div
                key={i}
                className="relative flex items-start gap-4 md:gap-0"
              >
                {/* Mobile layout: all left-aligned */}
                <div className="md:hidden flex items-start gap-4 w-full">
                  {/* Dot */}
                  <div className="relative z-10 mt-1 flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-400/50 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-rose-400" />
                    </div>
                  </div>
                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <div className="inline-block px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/25 mb-2">
                      <span className="text-xs font-mono text-rose-300/90">{event.date}</span>
                    </div>
                    <h4 className="text-sm font-medium text-slate-100 mb-1">{event.title}</h4>
                    <p className="text-sm text-slate-400 leading-relaxed">{event.description}</p>
                  </div>
                </div>

                {/* Desktop layout: alternating left/right */}
                <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4 w-full items-start">
                  {/* Left content */}
                  <div className={`${isLeft ? '' : 'invisible'} text-right pr-2`}>
                    {isLeft && (
                      <>
                        <div className="inline-block px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/25 mb-2">
                          <span className="text-xs font-mono text-rose-300/90">{event.date}</span>
                        </div>
                        <h4 className="text-sm font-medium text-slate-100 mb-1">{event.title}</h4>
                        <p className="text-sm text-slate-400 leading-relaxed">{event.description}</p>
                      </>
                    )}
                  </div>

                  {/* Center dot */}
                  <div className="relative z-10 mt-1 flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-rose-500/20 border border-rose-400/50 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-rose-400" />
                    </div>
                  </div>

                  {/* Right content */}
                  <div className={`${isLeft ? 'invisible' : ''} pl-2`}>
                    {!isLeft && (
                      <>
                        <div className="inline-block px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/25 mb-2">
                          <span className="text-xs font-mono text-rose-300/90">{event.date}</span>
                        </div>
                        <h4 className="text-sm font-medium text-slate-100 mb-1">{event.title}</h4>
                        <p className="text-sm text-slate-400 leading-relaxed">{event.description}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </BlockWrapper>
  );
};

export default TimelineBlock;
