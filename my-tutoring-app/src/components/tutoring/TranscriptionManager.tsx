import React, { useState, useEffect, useMemo } from 'react';
import './InteractiveWorkspace.css';

interface Transcript {
  id: string | number;
  text: string;
  speaker: string;
  timestamp: string;
  isPartial: boolean;
}

interface TranscriptionManagerProps {
  enabled: boolean;
  transcripts: Transcript[];
  partialTranscripts: Record<string, Transcript>;
  className?: string;
}

const TranscriptionManager: React.FC<TranscriptionManagerProps> = ({
  enabled,
  transcripts,
  partialTranscripts,
  className = '',
}) => {
  const [completedUtterances, setCompletedUtterances] = useState<Transcript[]>([]);

  // Memoize completed utterances updates to avoid unnecessary re-renders
  useEffect(() => {
    if (!enabled || !transcripts?.length) return;

    // Filter out duplicates based on text content and ID
    const newCompleted = transcripts.filter(
      (t) => !t.isPartial && 
             !completedUtterances.some(
               existing => existing.id === t.id || existing.text === t.text
             )
    );

    if (newCompleted.length > 0) {
      setCompletedUtterances(prev => {
        // Remove any old utterances with the same text or ID
        const filtered = prev.filter(p => 
          !newCompleted.some(n => n.id === p.id || n.text === p.text)
        );
        return [...filtered, ...newCompleted];
      });
    }
  }, [transcripts, enabled, completedUtterances]);

  // Cleanup old completed utterances
  useEffect(() => {
    if (!enabled) {
      setCompletedUtterances([]);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      setCompletedUtterances((prev) =>
        prev.filter((t) => now - new Date(t.timestamp).getTime() < 5000)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled]);

  // Memoize active subtitles to prevent recalculating on every render
  const activeSubtitles = useMemo(() => {
    if (!enabled || !partialTranscripts) return [];
    
    // Convert partial transcripts object to array and sort by timestamp
    return Object.values(partialTranscripts)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [enabled, partialTranscripts]);

  if (!enabled) return null;

  return (
    <div className={`transcription-container ${className}`}>
      {/* Fixed subtitle area for partial (streaming) transcripts */}
      <div className="subtitle-area">
        {activeSubtitles.map((subtitle) => {
          const uniqueKey = `subtitle-${subtitle.id}-${subtitle.timestamp}`;
          return (
            <div
              key={uniqueKey}
              className={`subtitle-container ${
                subtitle.speaker.includes('1') ? 'subtitle-left' : 'subtitle-right'
              }`}
            >
              <div className="speaker-indicator">
                {subtitle.speaker.includes('1') ? 'You' : 'Tutor'}
              </div>
              <p className="subtitle-text">{subtitle.text}</p>
            </div>
          );
        })}
      </div>

      {/* Floating completed utterances */}
      <div className="absolute inset-0 pointer-events-none">
        {completedUtterances.map((utterance) => {
          const uniqueKey = `final-${utterance.id}-${utterance.timestamp}`;
          return (
            <div
              key={uniqueKey}
              className={`floating-text final ${
                utterance.speaker.includes('1') ? 'left-side' : 'right-side'
              }`}
            >
              {utterance.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TranscriptionManager;