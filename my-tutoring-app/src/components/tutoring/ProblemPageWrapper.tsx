// ProblemPageWrapper.tsx
'use client';

import { WebSocketProvider } from '@/lib/use-websocket';
import ProblemInterface from './ProblemInterface';
import GeminiAudioPlayer from './GeminiAudioPlayer';

const ProblemPageWrapper = ({ currentTopic, studentId }) => {
  return (
    <WebSocketProvider>
      <div className="space-y-4">
        <ProblemInterface currentTopic={currentTopic} studentId={studentId} />
        <GeminiAudioPlayer />
      </div>
    </WebSocketProvider>
  );
};

export default ProblemPageWrapper;