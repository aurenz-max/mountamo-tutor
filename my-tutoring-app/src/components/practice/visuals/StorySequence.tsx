'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';

interface Event {
  stage: 'Beginning' | 'Middle' | 'End';
  text: string;
  image?: string;
}

interface StorySequenceData {
  events: Event[];
  layout?: 'horizontal' | 'vertical';
}

interface StorySequenceProps {
  data: StorySequenceData;
  className?: string;
}

/**
 * StorySequence - Renders story beginning/middle/end sequence
 * Used for story structure, sequencing, narrative analysis
 * Matches backend STORY_SEQUENCE_SCHEMA
 */
export const StorySequence: React.FC<StorySequenceProps> = ({ data, className = '' }) => {
  const { events = [], layout = 'horizontal' } = data;

  if (!events || events.length === 0) {
    return null;
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Beginning':
        return 'bg-green-100 border-green-400 text-green-900';
      case 'Middle':
        return 'bg-yellow-100 border-yellow-400 text-yellow-900';
      case 'End':
        return 'bg-purple-100 border-purple-400 text-purple-900';
      default:
        return 'bg-gray-100 border-gray-400 text-gray-900';
    }
  };

  if (layout === 'vertical') {
    return (
      <div className={`story-sequence space-y-4 ${className}`}>
        {events.map((event, index) => (
          <div key={index} className="flex flex-col items-center">
            <div className={`w-full p-4 rounded-lg border-2 ${getStageColor(event.stage)}`}>
              <div className="flex items-start gap-3">
                {event.image && (
                  <div className="text-4xl flex-shrink-0" role="img" aria-label={event.stage}>
                    {event.image}
                  </div>
                )}
                <div className="flex-1">
                  <h4 className="font-bold text-sm mb-1">{event.stage}</h4>
                  <p className="text-sm">{event.text}</p>
                </div>
              </div>
            </div>
            {index < events.length - 1 && (
              <div className="my-2">
                <ArrowRight className="text-gray-400 rotate-90" size={24} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Horizontal layout
  return (
    <div className={`story-sequence flex items-center gap-3 ${className}`}>
      {events.map((event, index) => (
        <React.Fragment key={index}>
          <div className={`flex-1 p-4 rounded-lg border-2 min-w-[200px] ${getStageColor(event.stage)}`}>
            {event.image && (
              <div className="text-4xl mb-2 text-center" role="img" aria-label={event.stage}>
                {event.image}
              </div>
            )}
            <h4 className="font-bold text-sm mb-2 text-center">{event.stage}</h4>
            <p className="text-sm text-center">{event.text}</p>
          </div>
          {index < events.length - 1 && (
            <ArrowRight className="text-gray-400 flex-shrink-0" size={24} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default StorySequence;
